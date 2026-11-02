'use strict';
const assert = require('node:assert/strict');

/** Exercise real navigation and modal layout in the isolated Electron profile. */
async function checkWorkspaces(contents) {
  const result = await contents.executeJavaScript(`(async()=>{
    const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const click=(selector)=>{const button=document.querySelector(selector);if(!button)throw new Error('Missing workspace control: '+selector);button.click();};
    window.ROOTI18N.setLanguage('en');
    click('.modal [data-command="close"]');
    const leave=document.querySelector('[data-room-leave]');
    if(leave&&!leave.hidden){leave.click();await frame();}
    click('.sidebar [data-nav="overview"]');await frame();
    const dashboard=Boolean(document.querySelector('[data-dashboard="activeContracts"]'));
    const nav=[];
    for(const view of ['business','facility','agents','research','achievements','operations']){
      click('.sidebar [data-nav="'+view+'"]');await frame();
      const heading=document.querySelector('#main h1');
      if(!heading)throw new Error('Workspace has no heading: '+view);
      nav.push({view,title:heading.textContent});
    }
    click('.sidebar [data-nav="agents"]');await frame();
    click('[data-modal="agent-upgrade"]');await frame();
    const modal=document.querySelector('.modal'),body=document.querySelector('.modal-body');
    body.scrollTop=body.scrollHeight;await frame();
    const preview={title:document.querySelector('#modal-title').textContent,rows:document.querySelectorAll('.development-row').length,
      rim:modal.getBoundingClientRect().bottom-body.getBoundingClientRect().bottom,
      blur:getComputedStyle(modal).backdropFilter,scrollable:body.scrollHeight>body.clientHeight};
    click('[data-agent-upgrade]');await frame();
    const upgradeModalClosed=!document.querySelector('.modal');
    return {dashboard,nav,preview,upgradeModalClosed};
  })()`);
  assert.equal(result.dashboard, true);
  assert.equal(result.nav.length, 6);
  assert.equal(
    result.nav.find((n) => n.view === 'achievements').title,
    'Achievements & milestones',
  );
  assert.equal(result.preview.title, 'Review agent upgrade');
  assert.equal(result.preview.rows, 8);
  assert.ok(result.preview.rim >= 14);
  assert.equal(result.preview.blur, 'none');
  assert.equal(result.preview.scrollable, true);
  assert.equal(
    result.upgradeModalClosed,
    true,
    'A paid upgrade must close its old comparison before another purchase',
  );
  return result;
}
module.exports = { checkWorkspaces };
