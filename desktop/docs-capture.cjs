'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const E = require('../engine.js');
const { fleet } = require('../tools/balance/scenarios.cjs');

function presentedFrame(contents) {
  return new Promise((resolve, reject) => {
    let count = 0;
    const deadline = setTimeout(() => {
      contents.endFrameSubscription();
      reject(new Error('Documentation presentation did not complete'));
    }, 5000);
    // DOM readiness does not prove that Chromium has presented its new layers.
    // Observe actual frames, with an explicit repaint for the otherwise idle UI.
    contents.beginFrameSubscription(false, (image) => {
      if (++count < 3) {
        contents.invalidate();
        return;
      }
      clearTimeout(deadline);
      contents.endFrameSubscription();
      resolve(image);
    });
    contents.invalidate();
  });
}

function demonstration() {
  const s = fleet(18, 83210);
  assert.ok(s, 'The public gallery fixture must pass the save validator');
  s.networkName = 'ROOT / OPERATIONS';
  s.credits = 1860000;
  s.research = 420;
  s.savedAt = Date.now();
  s.upgrades = { routing: 3, cooling: 2, market: 2, automation: 2, synthesis: 1 };
  s.lab.owned = ['network-fabric', 'business-desk', 'automation-workflows', 'science-methods'];
  s.facility.building.specialRooms = ['control'];
  s.policies.autocontract = true;
  s.resilience.graceUntil = s.time + 3600;
  for (const a of s.agents) a.name = a.role === 'analyst' ? 'ROOT / A-02' : 'ROOT / O-01';
  for (const candidate of E.getPersonnel(s).candidates.slice(0, 4))
    E.act(s, 'hireCandidate', { id: candidate.id });
  for (const a of s.agents) if (a.profile?.joinedAt > 0) a.name = 'ROOT / ' + a.id.toUpperCase();
  assert.equal(E.act(s, 'buyResearch', { id: 'network-telemetry' }).ok, true);
  E.advance(s, 60);
  assert.ok(E.normalizeState(s));
  return s;
}
/** Optional, reproducible native captures. This module never opens a player profile. */
async function captureDocumentation({ window, output }) {
  const directory = path.join(output, 'documentation');
  await fs.mkdir(directory, { recursive: true });
  const s = demonstration(),
    contents = window.webContents;
  const seeded = await contents.executeJavaScript(`(async()=>{
    localStorage.setItem('root.arrival.enabled','0');localStorage.removeItem('root.network.save.v1');sessionStorage.clear();
    const state=${JSON.stringify(s)};
    const response=await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});
    return response.status;
  })()`);
  assert.equal(seeded, 200);
  // The normal reload helper flushes the previous renderer state. This explicit
  // capture-only reload follows our fixture POST instead; the profile is synthetic.
  const loaded = new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Documentation renderer did not reload')),
      15000,
    );
    contents.once('did-finish-load', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
  contents.reload();
  await loaded;
  await contents.executeJavaScript(`new Promise((resolve,reject)=>{
    const done=()=>document.querySelector('.sidebar [data-nav="business"]');if(done())return resolve();
    const timer=setTimeout(()=>{observer.disconnect();reject(new Error('Documentation UI did not boot'));},12000);
    const observer=new MutationObserver(()=>{if(done()){clearTimeout(timer);observer.disconnect();resolve();}});
    observer.observe(document.body,{childList:true,subtree:true});
  })`);
  const installed = await contents.executeJavaScript(
    `(async()=>{const r=await(await fetch('/api/save')).json();return {name:r.save.networkName,servers:r.save.servers.length};})()`,
  );
  assert.deepEqual(installed, { name: s.networkName, servers: s.servers.length });
  const captureStyle = await contents.insertCSS('#toast-root { visibility: hidden !important; }');
  const files = [];
  for (const [view, name] of [
    ['overview', 'overview'],
    ['business', 'customers'],
    ['network', 'hardware'],
    ['agents', 'agents'],
    ['research', 'research'],
    ['achievements', 'achievements'],
    ['jobs', 'jobs'],
    ['resilience', 'resilience'],
    ['automation', 'automation'],
    ['facility', 'construction'],
  ]) {
    const rendered = await contents.executeJavaScript(`(async()=>{
      document.querySelector('.sidebar [data-nav="${view}"]').click();
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      await Promise.all(Array.from(document.images).filter(image=>!image.complete).map(image=>image.decode().catch(()=>{})));
      await document.fonts.ready;
      await Promise.all(document.getAnimations().filter(animation=>Number.isFinite(animation.effect.getTiming().iterations)).map(animation=>animation.finished.catch(()=>{})));
      window.scrollTo(0,0);
      return {view:document.querySelector('.sidebar [aria-current="page"]').dataset.nav,title:document.querySelector('#main h1').textContent};
    })()`);
    assert.equal(rendered.view, view);
    const image = await presentedFrame(contents);
    await fs.writeFile(path.join(directory, name + '-full.jpg'), image.toJPEG(88));
    await fs.writeFile(
      path.join(directory, name + '.jpg'),
      image.resize({ width: 1200 }).toJPEG(85),
    );
    files.push({ name, title: rendered.title });
    if (view === 'research') {
      await contents.executeJavaScript(
        `document.querySelector('[data-atlas-control="expand"]').click()`,
      );
      await fs.writeFile(
        path.join(directory, 'research-tree.jpg'),
        (await presentedFrame(contents)).toJPEG(88),
      );
      await contents.executeJavaScript(
        `document.querySelector('[data-atlas-control="expand"]').click()`,
      );
    }
  }
  const upgradeOpacity = await contents.executeJavaScript(`(async()=>{
    document.querySelector('.sidebar [data-nav="agents"]').click();
    document.querySelector('[data-modal="agent-upgrade"]').click();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    // Presented frames can still belong to the modal's 150ms fade-in. Wait for
    // its finite animation, as the page captures above already do.
    await Promise.all(document.getAnimations().filter(animation=>Number.isFinite(animation.effect.getTiming().iterations)).map(animation=>animation.finished.catch(()=>{})));
    return getComputedStyle(document.querySelector('.modal-backdrop')).opacity;
  })()`);
  assert.equal(upgradeOpacity, '1', 'The upgrade comparison must be fully opaque before capture');
  const upgrade = await presentedFrame(contents);
  await fs.writeFile(path.join(directory, 'agent-upgrade.jpg'), upgrade.toJPEG(88));
  await contents.executeJavaScript(
    `document.querySelector('.modal [data-command="close"]').click()`,
  );
  await contents.executeJavaScript(`(async()=>{
    document.querySelector('.sidebar [data-nav="overview"]').click();
    await new Promise((resolve,reject)=>{
      const ready=()=>document.querySelector('[data-room-enter]')?.disabled===false&&Number(document.querySelector('.root-room-canvas')?.dataset.drawCalls)>0;
      if(ready())return resolve();
      const deadline=setTimeout(()=>{observer.disconnect();reject(new Error('Control room graphics did not become ready'));},12000);
      const observer=new MutationObserver(()=>{if(ready()){clearTimeout(deadline);observer.disconnect();resolve();}});
      observer.observe(document.body,{childList:true,subtree:true,attributes:true});
    });
    document.querySelector('[data-room-control]').click();
    document.querySelector('[data-room-enter]').click();
  })()`);
  await contents.executeJavaScript(`new Promise((resolve,reject)=>{
    const ready=()=>document.querySelector('.root-room-canvas')?.dataset.roomId==='control'&&!document.querySelector('.modal');
    if(ready())return resolve();
    const timer=setTimeout(()=>{observer.disconnect();reject(new Error('Control room was not rendered'));},10000);
    const observer=new MutationObserver(()=>{if(ready()){clearTimeout(timer);observer.disconnect();resolve();}});
    observer.observe(document.body,{childList:true,subtree:true,attributes:true});
  })`);
  await contents.executeJavaScript(`document.querySelector('[data-room-terminal]').click()`);
  const roomConsole = await contents.executeJavaScript(
    `(()=>{const panel=document.querySelector('.root-room-console'),body=panel.querySelector('.room-console-content');return {groups:panel.querySelectorAll('.room-console-groups button').length,rim:panel.getBoundingClientRect().bottom-body.getBoundingClientRect().bottom,blur:getComputedStyle(panel).backdropFilter};})()`,
  );
  assert.equal(roomConsole.groups, 5);
  assert.ok(roomConsole.rim >= 14);
  assert.equal(roomConsole.blur, 'none');
  await fs.writeFile(
    path.join(directory, 'room-console.jpg'),
    (await presentedFrame(contents)).toJPEG(88),
  );
  await contents.executeJavaScript(`document.querySelector('[data-room-console-close]').click()`);
  await fs.writeFile(
    path.join(directory, 'control-room.jpg'),
    (await presentedFrame(contents)).toJPEG(88),
  );
  await contents.removeInsertedCSS(captureStyle);
  return {
    files,
    fixture: {
      servers: s.servers.length,
      racks: s.facility.racks.length,
      contracts: s.customers.contracts.length,
    },
    directory: 'documentation',
    roomConsole,
  };
}
module.exports = { captureDocumentation, demonstration };
