'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict');
const E = require('../engine');
function setup() {
  const s = E.createState(980);
  s.credits = 1e6;
  s.resilience.graceUntil = 1e9;
  s.policies.autobackup = false;
  s.policies.autorepair = false;
  return s;
}
test('repair and backup spending are independent and changing limits never clears consumption', () => {
  const s = setup();
  s.policies.autobackup = true;
  s.resilience.autoBackupNextAt = 0;
  s.resilience.budgetSpent = 300;
  E.advance(s, 1);
  assert.equal(s.resilience.operation.kind, 'backup');
  assert.equal(s.resilience.budgetSpent, 300);
  assert.equal(s.operations.backupSpent, 133);
  const p = {
    repair: 5000,
    backup: 9000,
    parts: 2000,
    reserve: 100,
    plan: 50000,
    savings: 10000,
    partsTarget: 10,
    autoParts: true,
  };
  assert.ok(E.act(s, 'setOperationsPolicy', p).ok);
  assert.equal(s.resilience.budgetSpent, 300);
  assert.equal(s.operations.backupSpent, 133);
  s.resilience.budgetSpent = 4000;
  assert.equal(E.normalizeState(s).resilience.budgetSpent, 4000);
});
test('deliveries charge once, reserve storage and survive reload with online/offline parity', () => {
  const s = setup(),
    before = s.credits;
  const q = E.quoteDelivery(s, { quantity: 10, method: 'express' });
  assert.ok(E.act(s, 'orderParts', { quantity: 10, method: 'express' }).ok);
  assert.equal(s.credits, before - q.cost);
  assert.equal(s.resilience.parts, 3);
  assert.equal(E.act(s, 'orderParts', { quantity: 10, method: 'standard' }).ok, false);
  const loaded = E.normalizeState(s),
    online = structuredClone(loaded);
  E.advance(loaded, 299);
  assert.equal(loaded.resilience.parts, 3);
  E.advance(loaded, 1);
  assert.equal(loaded.resilience.parts, 13);
  for (let i = 0; i < 300; i++) E.advance(online, 1);
  assert.deepEqual(loaded, online);
});
test('plans serialize backup before rack downtime and never repeat a charged action', () => {
  const s = setup();
  s.operations.limits.plan = 10000;
  s.operations.limits.reserve = 0;
  for (const [action, payload] of [
    ['createBackup', {}],
    ['upgradeRack', { rackId: 'rack-1', component: 'cooling' }],
  ])
    assert.ok(E.act(s, 'queueOperation', { action, payload, ceiling: 1000 }).ok);
  E.advance(s, 1);
  assert.equal(s.resilience.operation.kind, 'backup');
  assert.equal(s.facility.operation, null);
  assert.equal(s.operations.queue.length, 1);
  const loaded = E.normalizeState(s);
  E.advance(loaded, 60);
  assert.equal(loaded.facility.operation.kind, 'cooling');
  assert.equal(loaded.operations.queue.length, 0);
  E.advance(loaded, 180);
  assert.equal(loaded.facility.racks[0].coolingLevel, 2);
  assert.equal(loaded.operations.planSpent, 413);
});
test('queue safeguards respect savings, price ceilings, explicit action whitelist and bounded size', () => {
  const s = setup();
  s.operations.limits.plan = 1000;
  s.operations.limits.savings = s.credits + 10000;
  assert.ok(E.act(s, 'queueOperation', { action: 'createBackup', payload: {}, ceiling: 500 }).ok);
  E.advance(s, 1);
  assert.equal(s.resilience.operation, null);
  assert.match(s.operations.queue[0].reason, /Sparziel/);
  const bad = structuredClone(s);
  bad.operations.queue[0].action = 'resolveIncident';
  assert.throws(() => E.normalizeState(bad), /Aktion/);
  const before = structuredClone(s);
  assert.equal(
    E.act(s, 'queueOperation', { action: 'queueOperation', payload: {}, ceiling: 0 }).ok,
    false,
  );
  assert.deepEqual(s, before);
  for (const [action, payload] of [
    ['upgradeRack', { rackId: 'missing', component: 'cooling' }],
    ['convertRoomSupply', { roomId: 'missing', system: 'power', mode: 'central' }],
  ]) {
    assert.equal(E.act(s, 'queueOperation', { action, payload, ceiling: 10000 }).ok, false);
    assert.deepEqual(s, before, 'invalid references must not consume ids or poison the save');
  }
  s.operations.limits.savings = 0;
  s.operations.queue[0].ceiling = 1;
  E.advance(s, 60);
  assert.match(s.operations.queue[0].reason, /Preis/);
});
test('long projects remove management and normal work, preserve fixed rewards, and finish once', () => {
  const s = setup(),
    agent = s.agents[1];
  s.business.rooms[0].managerId = agent.id;
  const capacity = E.getBusinessModel(s).rooms[0].crewCapacity,
    q = E.quoteProject(s, { id: agent.id, kind: 'audit' });
  assert.ok(E.act(s, 'startProject', { id: agent.id, kind: 'audit' }).ok);
  assert.ok(E.getBusinessModel(s).rooms[0].crewCapacity < capacity);
  assert.equal(E.act(s, 'upgradeAgent', { id: agent.id }).ok, false);
  assert.equal(E.act(s, 'dispatchAgent', { id: agent.id, mission: 'research' }).ok, false);
  const loaded = E.normalizeState(s);
  loaded.jobs = [];
  loaded.policies.autocontract = false;
  const start = loaded.research,
    passive = E.getMetrics(loaded).researchPerSecond;
  E.advance(loaded, q.duration);
  assert.equal(loaded.operations.projects.length, 0);
  assert.ok(Math.abs(loaded.research - start - passive * q.duration - q.research) < 1e-6);
  assert.equal(E.getBusinessModel(loaded).rooms[0].crewCapacity, capacity);
  assert.ok(loaded.agents[1].cooldownUntil > loaded.time);
});

test('a technician on a long project also stops reducing routine hardware wear', () => {
  const working = setup();
  working.resilience.graceUntil = 0;
  working.agents[0].role = 'engineer';
  working.agents[0].level = 10;
  const assigned = structuredClone(working);
  assert.ok(E.act(assigned, 'startProject', { id: assigned.agents[0].id, kind: 'audit' }).ok);
  E.advance(working, 1);
  E.advance(assigned, 1);
  assert.ok(assigned.servers[0].condition < working.servers[0].condition);
});
