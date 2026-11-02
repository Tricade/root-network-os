const test = require('node:test');
const assert = require('node:assert/strict');
const release = require('../release.js');

async function harness(memory = new Map(), version = release.version) {
  const { createStartupUI } = await import('../ui/startup.js');
  const opened = [];
  const ctx = {
    modal: null,
    storageGet: (key) => memory.get(key),
    storageSet: (key, value) => memory.set(key, value),
    openModal(type, extra) {
      this.modal = { type, extra };
      opened.push(type);
    },
    tr: (s) => s,
    esc: (s) => String(s).replaceAll('<', '&lt;'),
    I18N: { getLanguage: () => 'en' },
  };
  return { ctx, opened, memory, ui: createStartupUI(ctx, { ...release, version }) };
}

test('first installation welcomes once; a reload or a new network does not repeat it', async () => {
  const h = await harness();
  h.ui.prepareStartup({ hasSave: false });
  assert.equal(h.ui.showNextStartup(), true);
  assert.deepEqual(h.opened, ['welcome']);
  assert.equal(h.memory.get('root.release.seen'), release.version);
  const again = await harness(h.memory);
  again.ui.prepareStartup({ hasSave: true });
  assert.equal(again.ui.showNextStartup(), false);
  again.ui.prepareStartup({ hasSave: false });
  assert.equal(again.ui.showNextStartup(), false);
});

test('upgrading an existing network from before release markers shows notes once', async () => {
  const h = await harness();
  h.ui.prepareStartup({ hasSave: true });
  assert.equal(
    h.memory.has('root.release.seen'),
    false,
    'notes are not marked read before opening',
  );
  assert.equal(h.ui.showNextStartup(), true);
  assert.deepEqual(h.opened, ['changelog']);
  assert.equal(h.memory.get('root.release.seen'), release.version);
  const again = await harness(h.memory);
  again.ui.prepareStartup({ hasSave: true });
  assert.equal(again.ui.showNextStartup(), false);
});

test('an update waits behind the offline report, appears once, and stays available in help', async () => {
  const h = await harness(new Map([['root.release.seen', '1.4.0']]));
  const offline = { seconds: 600, credits: -20 };
  h.ui.prepareStartup({ hasSave: true, offline });
  assert.equal(h.ui.showNextStartup(), true);
  assert.deepEqual(h.ctx.modal, { type: 'offline', extra: offline });
  assert.equal(h.ui.showNextStartup(), false, 'a visible dialog must never be overwritten');
  assert.equal(h.memory.get('root.release.seen'), '1.4.0', 'unshown notes remain pending');
  h.ctx.modal = null;
  assert.equal(h.ui.showNextStartup(), true);
  assert.deepEqual(h.opened, ['offline', 'changelog']);
  const again = await harness(h.memory);
  again.ui.prepareStartup({ hasSave: true });
  assert.equal(again.ui.showNextStartup(), false);
  assert.ok(again.ui.changelogModal().includes(again.ctx.esc(release.notes[0][1])));
  assert.match(again.ui.welcomeModal(), /welcome-steps/);
  assert.equal(again.memory.get('root.release.seen'), release.version);
});

test('a legacy upgrade also keeps its notes pending until the offline report closes', async () => {
  const h = await harness();
  h.ui.prepareStartup({ hasSave: true, offline: { seconds: 120 } });
  assert.equal(h.ui.showNextStartup(), true);
  assert.deepEqual(h.opened, ['offline']);
  assert.equal(h.memory.has('root.release.seen'), false);
  assert.equal(h.ui.showNextStartup(), false);
  h.ctx.modal = null;
  assert.equal(h.ui.showNextStartup(), true);
  assert.deepEqual(h.opened, ['offline', 'changelog']);
});

test('release notes, desktop package and web UI share one release number', () => {
  assert.equal(release.version, require('../package.json').version);
  assert.ok(release.notes.length > 0);
  for (const note of release.notes) {
    assert.equal(note.length, 2);
    assert.ok(note.every((text) => typeof text === 'string' && text.trim().length > 0));
  }
});
