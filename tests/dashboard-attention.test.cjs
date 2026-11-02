const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

test('dashboard pages one actionable item, retains selection on arrivals and advances after resolution', async (t) => {
  const { createDashboardAttention } = await import('../ui/dashboard-attention.js');
  const { dashboardModel } = await import('../ui/dashboard-model.js');
  const state = E.createState(710);
  state.events = [1, 2, 3].map((n) => ({ id: `event-${n}`, title: `Event ${n}`, choices: [] }));
  const root = { dataset: {}, innerHTML: '', querySelector: () => null, contains: () => false };
  const oldDocument = global.document;
  global.document = { activeElement: null };
  t.after(() => {
    global.document = oldDocument;
  });
  const ctx = {
    E,
    state,
    tr: String,
    esc: String,
    fmt: String,
    icon: () => '',
    panelHeader: (s) => `<h2>${s}</h2>`,
    $$: () => [root],
    attentionCard: (entry) => `<article data-shown="${entry.id}">${entry.title}</article>`,
    getDashboardModel: () => dashboardModel(E, state),
    updateAttentionCards() {},
  };
  const ui = createDashboardAttention(ctx);
  const click = (key, value) =>
    ui.dashboardClick({
      dataset: { [key]: value },
      hasAttribute: (attr) =>
        attr === `data-${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`,
    });
  ui.updateAttention(ctx.getDashboardModel());
  assert.match(root.innerHTML, /data-shown="event:event-1"/);
  assert.equal((root.innerHTML.match(/data-shown=/g) || []).length, 1);
  click('dashboardPage', '1');
  assert.match(root.innerHTML, /data-shown="event:event-2"/);
  state.events.unshift({ id: 'event-new', title: 'New arrival', choices: [] });
  ui.updateAttention(ctx.getDashboardModel());
  assert.match(root.innerHTML, /data-shown="event:event-2"/);
  const unchanged = root.innerHTML;
  ui.updateAttention(ctx.getDashboardModel());
  assert.equal(root.innerHTML, unchanged);
  state.events = state.events.filter((e) => e.id !== 'event-2');
  ui.updateAttention(ctx.getDashboardModel());
  assert.match(root.innerHTML, /data-shown="event:event-3"/);
  click('dashboardPage', '1');
  assert.match(root.innerHTML, /data-shown="event:event-3"/, 'last page stays bounded');
  state.events = [];
  ui.updateAttention(ctx.getDashboardModel());
  assert.doesNotMatch(root.innerHTML, /data-shown="event:/);
  assert.equal((root.innerHTML.match(/data-shown=/g) || []).length, 1);
});

test('deep links select the relevant operations section before navigation', async () => {
  const { createAttentionCards } = await import('../ui/attention-cards.js');
  const calls = [];
  const ui = createAttentionCards({
    selectOperationsSection: (key) => calls.push(['section', key]),
    navigate: (route) => calls.push(['navigate', route]),
  });
  assert.equal(
    ui.attentionClick({
      hasAttribute: (key) => key === 'data-attention-route',
      dataset: { attentionRoute: 'operations', opsSection: 'maintenance' },
    }),
    true,
  );
  assert.deepEqual(calls, [
    ['section', 'maintenance'],
    ['navigate', 'operations'],
  ]);
});
