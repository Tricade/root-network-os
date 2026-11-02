'use strict';

// Explicit CLI diagnostics use a fresh synthetic profile, never a real save.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

async function runSelfTest({ app, output, startDesktop }) {
  require('node:fs').mkdirSync(output, { recursive: true });
  const result = { ok: false, version: app.getVersion(), runtime: { ...process.versions } };
  const write = () =>
    fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  const deadline = setTimeout(
    async () => {
      result.error = 'Desktop did not finish within 60 seconds';
      await write();
      app.exit(1);
    },
    process.env.ROOT_CAPTURE_DOCS === '1' ? 120000 : 60000,
  );
  async function fail(error) {
    clearTimeout(deadline);
    result.error = error.message;
    await write();
    app.exit(1);
  }
  await startDesktop({
    profile: path.join(output, 'synthetic-profile'),
    hidden: true,
    smoke: true,
    onReady(context) {
      inspect(context).catch(fail);
    },
    async beforeQuit({ saved }) {
      assert.equal(saved, true, 'Renderer must confirm its last disk save');
      result.ok = true;
      await write();
      clearTimeout(deadline);
    },
  }).catch(fail);

  async function inspect({ window, installation, close, reload, dataDir, profile }) {
    assert.equal(app.getPath('sessionData'), path.join(profile, 'chromium'));
    const contents = window.webContents;
    result.installation = installation.kind;
    if (process.env.ROOT_EXPECT_INSTALLATION)
      assert.equal(installation.kind, process.env.ROOT_EXPECT_INSTALLATION);
    const initial = await contents.executeJavaScript(`(async () => {
      const health = await (await fetch('/api/health')).json();
      const stored = await (await fetch('/api/save')).json();
      const info = await window.rootDesktop.info();
      localStorage.setItem('root.desktop.smoke', 'retained');
      return { origin: location.origin, node: typeof process, require: typeof require,
        health, network: stored.save.networkName, servers: stored.save.servers.length,
        racks: stored.save.facility.racks.length, canUpdate: info.canUpdate,
        settingsButton: Boolean(document.querySelector('[data-modal="settings"]')) };
    })()`);
    assert.equal(initial.origin, 'root://app');
    assert.equal(initial.node, 'undefined');
    assert.equal(initial.require, 'undefined');
    assert.equal(initial.health.release, app.getVersion());
    assert.equal(initial.servers, 1);
    assert.equal(initial.racks, 1);
    assert.equal(initial.settingsButton, true);
    assert.equal(initial.canUpdate, ['nsis', 'deb'].includes(installation.kind));
    result.initial = initial;
    // A fresh installation presents its guide before the optional arrival animation.
    result.onboarding = await contents.executeJavaScript(`(() => {
      const welcome = document.querySelector('.modal .welcome-steps');
      if (!welcome) return { visible: false };
      document.querySelector('.modal [data-command="close"]').click();
      return { visible: true, dismissed: !document.querySelector('.modal') };
    })()`);
    assert.equal(result.onboarding.visible, true);
    assert.equal(result.onboarding.dismissed, true);
    result.catchup = await require('./catchup-smoke.cjs').checkCatchup(contents);
    result.arrival = await require('./arrival-smoke.cjs').checkArrival({ window, output });
    // Reload the same origin while the loopback service keeps its ephemeral port.
    assert.equal(await reload(), true);
    const reloaded = await contents.executeJavaScript(`(async () => {
      const saved = await (await fetch('/api/save')).json();
      return { marker: localStorage.getItem('root.desktop.smoke'), network: saved.save.networkName,
        welcomeRepeated: Boolean(document.querySelector('.modal .welcome-steps')) };
    })()`);
    assert.equal(reloaded.marker, 'retained');
    assert.equal(reloaded.network, initial.network);
    assert.equal(reloaded.welcomeRepeated, false);
    // The boot-ready bridge fires once per renderer. Wait for the real settings
    // control rather than treating did-finish-load as simulation readiness.
    await contents.executeJavaScript(`new Promise((resolve, reject) => {
      if (document.querySelector('[data-modal="settings"]')) return resolve();
      const deadline = setTimeout(() => { observer.disconnect(); reject(new Error('UI boot timeout')); }, 15000);
      const observer = new MutationObserver(() => {
        if (!document.querySelector('[data-modal="settings"]')) return;
        clearTimeout(deadline); observer.disconnect(); resolve();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    })`);
    result.graphics = await contents.executeJavaScript(`new Promise((resolve, reject) => {
      document.querySelector('[data-room-slot]').scrollIntoView();
      const inspect = () => {
        const canvas = document.querySelector('.root-room-canvas');
        // The canvas is attached before its first frame. Number(undefined) is
        // NaN, so a <= 0 guard alone would incorrectly accept that early state.
        if (!canvas || !(Number(canvas.dataset.drawCalls) > 0) || !(Number(canvas.dataset.triangles) > 0)) return null;
        const gl = canvas.getContext('webgl2');
        const debug = gl.getExtension('WEBGL_debug_renderer_info');
        return { drawCalls: Number(canvas.dataset.drawCalls), triangles: Number(canvas.dataset.triangles),
          models: document.querySelector('.root-room-badge')?.textContent,
          renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER) };
      };
      const initial = inspect();
      if (initial) return resolve(initial);
      const deadline = setTimeout(() => { observer.disconnect(); reject(new Error('3D renderer did not produce a frame')); }, 25000);
      const observer = new MutationObserver(() => {
        const value = inspect(); if (!value) return;
        clearTimeout(deadline); observer.disconnect(); resolve(value);
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    })`);
    assert.ok(result.graphics.triangles > 0);
    if (result.arrival.deliberateWalkthrough) {
      const restoredWalk = await contents.executeJavaScript(
        `Boolean(document.querySelector('.root-room.exploring'))`,
      );
      assert.equal(restoredWalk, true, 'Reload must retain an explicitly started walkthrough');
      result.arrival.reloadRestoresWalkthrough = restoredWalk;
    }
    const scrollbars = await contents.executeJavaScript(`({
      width: getComputedStyle(document.documentElement).scrollbarWidth,
      color: getComputedStyle(document.documentElement).scrollbarColor,
    })`);
    assert.equal(scrollbars.width, 'thin');
    assert.match(scrollbars.color, /rgb\(91, 112, 84\)/);
    result.scrollbars = scrollbars;
    assert.equal(result.graphics.models, 'LIVE / 3D');
    if (
      process.platform === 'linux' &&
      process.env.CI === 'true' &&
      process.env.ROOT_DESKTOP_SOFTWARE_RENDERING === '1'
    )
      assert.match(result.graphics.renderer, /SwiftShader/i);
    await contents.executeJavaScript(`document.querySelector('[data-modal="settings"]').click()`);
    await contents.executeJavaScript(
      `const language = document.querySelector('[data-change="language"]'); language.value = 'en'; language.dispatchEvent(new Event('change', { bubbles: true }));`,
    );
    const settings = await contents.executeJavaScript(`({
      visible: Boolean(document.querySelector('[data-desktop-section]')),
      checkVisible: !document.querySelector('[data-desktop-command="check"]').hidden,
      installHidden: document.querySelector('[data-desktop-command="install"]').hidden,
      downloadHidden: document.querySelector('[data-desktop-command="download"]').hidden,
    })`);
    assert.equal(settings.visible, true);
    assert.equal(settings.checkVisible, initial.canUpdate);
    assert.equal(settings.installHidden, true);
    assert.equal(settings.downloadHidden, true);
    result.settings = settings;
    const english = await contents.executeJavaScript(
      `document.querySelector('#modal-root').innerText`,
    );
    assert.match(english, /Desktop & updates/);
    assert.match(english, /Automatically saves every 15 seconds/);
    assert.doesNotMatch(english, /Automatisches Speichern/);
    result.language = 'en';
    await contents.executeJavaScript(`Promise.all(
      document.querySelector('.modal-backdrop').getAnimations({ subtree: true })
        .filter(animation => Number.isFinite(animation.effect.getTiming().iterations))
        .map(animation => animation.finished.catch(() => {}))
    )`);
    const modalVisible = await contents.executeJavaScript(`(() => {
      const button = document.querySelector('[data-desktop-command="releases"]');
      button.scrollIntoView({ block: 'center' });
      const box = button.getBoundingClientRect();
      const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return box.width > 0 && box.height > 0 && button.contains(top);
    })()`);
    assert.equal(modalVisible, true, 'Desktop settings must be visible above the 3D view');
    result.settings.modalVisible = modalVisible;
    await contents.executeJavaScript(
      'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
    );
    const image = await contents.capturePage();
    await fs.writeFile(path.join(output, 'desktop.png'), image.toPNG());
    const save = JSON.parse(await fs.readFile(path.join(dataDir, 'save.json'), 'utf8'));
    assert.equal(save.networkName, initial.network);
    assert.equal(save.servers.length, 1);
    result.saved = true;
    result.reloaded = reloaded;
    result.workspaces = await require('./workspace-smoke.cjs').checkWorkspaces(contents);
    result.sidebar = await require('./sidebar-smoke.cjs').checkSidebar({ window, output });
    if (process.env.ROOT_CAPTURE_DOCS === '1')
      result.documentation = await require('./docs-capture.cjs').captureDocumentation({
        window,
        output,
        reload,
      });
    result.updateTransport = await require('./update-smoke.cjs').checkUpdateTransport({
      directory: output,
      version: app.getVersion(),
    });
    // Completion is written only after the renderer confirms the final disk save.
    const accepted = await close();
    assert.equal(accepted, true);
  }
}

module.exports = { runSelfTest };
