const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

test('plan sections retain drafts while switching, then discard them at a save replacement', async () => {
  const { createOperationsUI } = await import('../ui/operations.js');
  const ctx = {
    E,
    state: E.createState(720),
    $$: () => [],
    tr: String,
    esc: String,
    fmt: String,
    duration: String,
    head: () => '',
    panelHeader: String,
    preventiveMarkup: () => '',
  };
  const ui = createOperationsUI(ctx);
  ui.operationsInput({
    hasAttribute: () => true,
    dataset: { opsField: 'repair' },
    type: 'number',
    value: '987',
  });
  ui.operationsInput({
    hasAttribute: () => true,
    dataset: { opsField: 'autoParts' },
    type: 'checkbox',
    checked: true,
  });
  ui.selectOperationsSection('maintenance');
  ui.selectOperationsSection('budget');
  assert.match(ui.operationsView(), /data-ops-field="repair"[^>]*value="987"/);
  assert.match(ui.operationsView(), /data-ops-field="autoParts"[^>]*checked/);
  ctx.state = E.createState(721);
  ctx.state.operations.limits.repair = 456;
  ctx.state.operations.autoParts = false;
  ui.resetOperationsDrafts();
  const restored = ui.operationsView();
  assert.match(restored, /data-ops-field="repair"[^>]*value="456"/);
  assert.doesNotMatch(restored, /data-ops-field="autoParts"[^>]*checked/);
  assert.equal(ui.selectOperationsSection('missing'), false);
});

test('capital draft reset releases old rack references and a manually entered ceiling', async () => {
  const { createCapitalPlanUI } = await import('../ui/capital-plan.js');
  const ctx = {
    E,
    state: E.createState(722),
    tr: String,
    esc: String,
    fmt: String,
    duration: String,
    panelHeader: String,
    render() {},
  };
  const ui = createCapitalPlanUI(ctx);
  ui.capitalChange({
    hasAttribute: () => true,
    dataset: { capitalField: 'action' },
    value: 'upgradeRack',
    blur() {},
  });
  ui.capitalChange({
    hasAttribute: () => true,
    dataset: { capitalField: 'ceiling' },
    value: '987654',
    blur() {},
  });
  assert.match(ui.capitalMarkup(), /value="987654"/);
  ctx.state = E.createState(723);
  ui.resetCapitalDraft();
  const markup = ui.capitalMarkup();
  assert.match(markup, /value="buildRoom" selected/);
  assert.doesNotMatch(markup, /value="987654"/);
});
