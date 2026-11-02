'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine');
const { grantSpace } = require('./helpers/facility.cjs');
function fixture() {
  const s = E.createState(810);
  s.credits = 1e8;
  s.sector = 10;
  s.jobs[0].totalWork = 1e6;
  const first = s.servers[0];
  s.facility.racks.push({
    ...s.facility.racks[0],
    id: 'rack-90',
    name: 'Second',
    disabledPorts: [],
  });
  s.servers.push({ ...first, id: 'server-91', name: 'Second node', rackId: 'rack-90' });
  grantSpace(s, { rooms: 2 });
  s.facility.racks[1].roomId = 'room-2';
  s.business.rooms[1].groups[0].units = 2;
  const customer = {
    ...structuredClone(s.customers.contracts[0]),
    id: 'customer-' + s.nextId++,
    roomId: 'room-2',
    units: 2,
  };
  s.customers.contracts.push(customer);
  s.resilience.graceUntil = 1e9;
  return s;
}
test('one hardware fault leaves other rack customers, project work and research running', () => {
  const s = fixture(),
    before = E.getMetrics(s);
  s.servers[0].status = 'failed';
  s.servers[0].condition = 42;
  s.servers[0].fault = 'Hardwarefehler';
  const after = E.getMetrics(s);
  assert.equal(after.onlineServers, 1);
  assert.ok(after.serviceIncome > 0 && after.serviceIncome < before.serviceIncome);
  assert.ok(after.jobRates['job-1'] > 0);
  assert.ok(after.researchPerSecond > 0);
  assert.equal(after.safetyMode, false);
  const work = s.jobs[0].work;
  E.advance(s, 30);
  assert.ok(s.jobs[0].work > work);
});
test('failure domains isolate nodes, racks or supplied rooms and persist exactly', () => {
  for (const scope of ['nodes', 'rack', 'room']) {
    const s = fixture();
    s.servers[0].status = 'failed';
    s.servers[0].condition = 35;
    s.servers[0].fault = 'Stromausfall';
    s.resilience.incident = {
      id: 'incident-999',
      kind: 'power',
      title: 'Synthetic',
      description: 'Test',
      consequence: 'Test',
      affected: ['server-1'],
      resolution: null,
      scope,
      rackId: 'rack-1',
      roomId: 'room-1',
    };
    const m = E.getMetrics(s);
    assert.equal(m.onlineServers, 1);
    assert.equal(m.safetyMode, false);
    assert.ok(m.workPerSecond > 0);
    assert.ok(m.serviceIncome > 0);
    assert.equal(E.getRackModel(s).racks[1].servers[0].status, 'online');
    assert.equal(E.normalizeState(s).resilience.incident.scope, scope);
    assert.ok(E.act(s, 'dispatchAgent', { id: 'agent-2', mission: 'research' }).ok);
    E.advance(s, 30);
    assert.equal(s.agents[1].assignment.remaining, 210);
  }
});
test('switch ports and rack maintenance affect only their actual downstream nodes', () => {
  const s = fixture();
  s.facility.racks[0].disabledPorts = [1];
  assert.equal(E.getMetrics(s).onlineServers, 1);
  assert.equal(E.getRackModel(s).racks[1].servers[0].status, 'online');
  s.facility.racks[0].disabledPorts = [];
  assert.ok(E.act(s, 'upgradeRack', { rackId: 'rack-1', component: 'power' }).ok);
  assert.equal(E.getMetrics(s).onlineServers, 1);
  assert.ok(E.getMetrics(s).jobRates['job-1'] > 0);
});
