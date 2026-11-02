'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const { grantSpace } = require('./helpers/facility.cjs');

function fleet(count) {
  const s = E.createState(72);
  s.sector = count;
  s.facility.racks = [];
  s.servers = Array.from({ length: count }, (_, i) => {
    const rackId = `rack-${i + 1}`;
    s.facility.racks.push({
      id: rackId,
      name: `Rack ${i + 1}`,
      switchLevel: 3,
      powerLevel: 2,
      coolingLevel: 2,
      disabledPorts: [],
    });
    return {
      id: `server-${i + 1}`,
      name: `Server ${i + 1}`,
      type: 'edge',
      level: 1,
      rackId,
      unit: 2,
      port: 1,
      condition: 100,
      powered: true,
      bootRemaining: 0,
      status: 'online',
      fault: null,
      mode: 'eco',
    };
  });
  grantSpace(s);
  s.resilience.graceUntil = 1e9;
  s.policies.autobackup = false;
  return s;
}

test('large eco fleets advance work and unpowered modes do not change production', () => {
  const s = fleet(100);
  assert(E.getMetrics(s).workPerSecond > 0);
  s.jobs[0].totalWork = 1e9;
  E.advance(s, 1);
  assert(s.jobs[0].work > 0);
  for (const server of s.servers.slice(1)) server.powered = false;
  const before = E.getMetrics(s).workPerSecond;
  for (const server of s.servers.slice(1)) server.mode = 'performance';
  assert.equal(E.getMetrics(s).workPerSecond, before);
});

test('automatic offer queue replaces impossible pending work without cancelling accepted work', () => {
  const s = E.createState(15);
  s.resilience.graceUntil = 1e9;
  s.policies.autocontract = true;
  s.policies.autobackup = false;
  s.jobs = [];
  s.offers = Array.from({ length: 6 }, (_, i) => ({
    id: `blocked-${i}`,
    kind: 'ai',
    gpuDemand: 4,
    title: 'GPU',
    client: 'Test',
    totalWork: 100,
    work: 0,
    reward: 100,
    science: 1,
    rep: 1,
    load: 2,
  }));
  E.advance(s, 3600);
  assert(s.counters.jobs > 0);
  assert(s.offers.length <= 6);
});

test('two outstanding hardware faults do not prevent further incidents', () => {
  const s = fleet(10);
  s.resilience.graceUntil = 0;
  s.policies.autorepair = false;
  s.policies.power = 'performance';
  s.rng = 1;
  s.servers.forEach((n) => (n.condition = 10));
  for (const server of s.servers.slice(0, 2)) {
    server.status = 'failed';
    server.condition = 42;
    server.fault = 'Hardwarefehler';
  }
  E.advance(s, 43200);
  assert(s.resilience.incident);
  assert.equal(s.resilience.incident.scope, 'nodes');
  assert(
    s.servers
      .slice(2)
      .some(
        (n) =>
          E.getRackModel(s).racks.find((r) => r.id === n.rackId).servers[0].status === 'online',
      ),
  );
  assert(s.servers.filter((x) => x.status === 'failed').length <= 2);
  E.normalizeState(s);
});
