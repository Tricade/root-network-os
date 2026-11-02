const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const model = import('../ui/dashboard-model.js');
test('dashboard and physical instruments agree with actual business and agent assignments', async () => {
  const { dashboardModel } = await model,
    { stationRows, STATION_CONFIGS } = await import('../room/station-content.js');
  const s = E.createState(201),
    m = E.getMetrics(s),
    saved = JSON.stringify(s),
    d = dashboardModel(E, s, m);
  assert.equal(d.net, m.incomePerSecond * 60);
  assert.equal(d.customers.units, m.serviceUnits);
  assert.equal(d.activeAgents + d.workingAgents + d.absentAgents, s.agents.length);
  const f = { one: String, fmt: String, pct: (v) => String(v * 100), duration: String };
  assert.equal(
    stationRows('overview', s, m, d.protection, E.getAgentOperations(s), d, f)[3][1],
    d.net + ' CR',
  );
  assert.equal(STATION_CONFIGS.business.title, 'Kunden & Verträge');
  assert.equal(STATION_CONFIGS.network.title, 'Racks & Server');
  assert.equal(JSON.stringify(s), saved);
});
test('dashboard flags waiting customer work and notices without inventing a supply deficit', async () => {
  const { dashboardModel } = await model;
  const s = E.createState(202),
    c = s.customers.contracts[0];
  c.notice = 600;
  c.departure = 'budget';
  c.work = 'support';
  c.agentId = null;
  c.workRemaining = 600;
  c.workTotal = 600;
  const d = dashboardModel(E, s);
  assert.ok(d.actions.some((a) => a.id === 'notices'));
  assert.ok(d.actions.some((a) => a.id === 'staff'));
  s.customers.contracts = [];
  s.business.rooms.forEach((r) =>
    r.groups.forEach((g) => {
      g.units = 0;
      g.pending = 0;
    }),
  );
  const empty = dashboardModel(E, s);
  assert.equal(empty.supply, null);
  assert.equal(
    empty.actions.some((a) => a.id === 'supply'),
    false,
  );
});
