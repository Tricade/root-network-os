'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
function fixture() {
  const s = E.createState(83);
  s.credits = 1e6;
  s.resilience.graceUntil = 1e9;
  s.business.transitionUntil = 0;
  s.customers.autoAssign = false;
  s.customers.contracts[0].satisfaction = 80;
  return s;
}
const payload = (announce = false) => ({
  rackId: 'rack-1',
  components: ['power', 'cooling', 'switch'],
  announce,
});
test('one paid outage completes all three upgrades once; the normal path has no notice fee or delay', () => {
  const s = fixture(),
    p = payload(),
    q = E.quoteHardware(s, 'upgradeRackBatch', p);
  assert.equal(q.cost, 940);
  assert.equal(q.duration, 195);
  assert.equal(q.noticeFee, 0);
  assert.equal(q.noticeLead, 0);
  assert.ok(E.act(s, 'upgradeRackBatch', p).ok);
  assert.equal(s.credits, 1e6 - q.cost);
  assert.equal(E.getRackModel(s).racks[0].status, 'maintenance');
  E.advance(s, 194.5);
  assert.equal(s.facility.racks[0].powerLevel, 1);
  const reloaded = E.normalizeState(s);
  E.advance(reloaded, 0.5);
  for (const key of p.components) assert.equal(reloaded.facility.racks[0][key + 'Level'], 2);
  assert.equal(reloaded.facility.operation, null);
  E.advance(reloaded, 10);
  assert.equal(reloaded.facility.racks[0].powerLevel, 2);
});
test('paid notice keeps hardware online until the precise lead-time boundary and persists consent', () => {
  const s = fixture(),
    p = payload(true),
    q = E.quoteHardware(s, 'upgradeRackBatch', p);
  assert.equal(q.noticeFee, 101);
  assert.ok(E.act(s, 'upgradeRackBatch', p).ok);
  assert.equal(E.getRackModel(s).racks[0].status, 'online');
  E.advance(s, 119.5);
  const loaded = E.normalizeState(s);
  assert.deepEqual(loaded.facility.operation, s.facility.operation);
  E.advance(loaded, 0.5);
  assert.equal(loaded.facility.operation.remaining, 195);
  assert.equal(E.getRackModel(loaded).racks[0].status, 'maintenance');
  E.advance(loaded, 195);
  assert.equal(loaded.facility.operation, null);
});
test('notice halves only maintenance-attributable dissatisfaction, never delivery deficits', () => {
  const paid = fixture();
  assert.ok(E.act(paid, 'upgradeRackBatch', payload(true)).ok);
  E.advance(paid, 120);
  const ordinary = structuredClone(paid);
  ordinary.facility.operation = null;
  assert.ok(E.act(ordinary, 'upgradeRackBatch', payload()).ok);
  const initial = paid.customers.contracts[0].satisfaction;
  E.advance(paid, 30);
  E.advance(ordinary, 30);
  const a = paid.customers.contracts[0],
    b = ordinary.customers.contracts[0];
  assert.ok(Math.abs(initial - a.satisfaction - (initial - b.satisfaction) / 2) < 1e-8);
  assert.equal(a.deficit, b.deficit);
  assert.equal(E.getMetrics(paid).serviceDelivered, E.getMetrics(ordinary).serviceDelivered);
  const failed = fixture();
  failed.servers[0].powered = false;
  assert.ok(E.act(failed, 'upgradeRackBatch', payload(true)).ok);
  E.advance(failed, 120);
  const start = failed.customers.contracts[0].satisfaction;
  E.advance(failed, 30);
  assert.ok(
    Math.abs(start - failed.customers.contracts[0].satisfaction - 30 / 180) < 1e-8,
    'an unrelated powered-off server cannot receive maintenance protection',
  );
});
test('batch does not stop the other rack, and failed requests cannot debit or partially upgrade', () => {
  const s = fixture();
  assert.ok(E.act(s, 'buyRack').ok);
  const rackId = s.facility.racks[1].id;
  assert.ok(E.act(s, 'buyServer', { type: 'edge', rackId }).ok);
  for (const components of [
    [],
    ['power', 'power'],
    ['bad'],
    ['power', 'cooling', 'switch', 'power'],
  ]) {
    const before = JSON.stringify(s);
    assert.equal(E.act(s, 'upgradeRackBatch', { ...payload(), components }).ok, false);
    assert.equal(JSON.stringify(s), before);
  }
  assert.ok(E.act(s, 'upgradeRackBatch', payload()).ok);
  const other = E.getRackModel(s).racks.find((r) => r.id === rackId);
  assert.equal(other.status, 'online');
  assert.ok(other.servers.every((v) => v.status === 'online'));
  assert.equal(E.act(s, 'upgradeRack', { rackId, component: 'cooling' }).ok, false);
});
test('maintenance research improves cost and lead time without making notice mandatory', () => {
  const s = fixture();
  s.sector = 4;
  const definitions = E.getResearch(s).technologies;
  const own = (id) => {
    for (const dep of definitions.find((d) => d.id === id).requires) own(dep);
    if (!s.lab.owned.includes(id)) s.lab.owned.push(id);
  };
  own('business-maintenance');
  const q = E.quoteHardware(s, 'upgradeRackBatch', payload(true));
  const base = E.quoteHardware(
    { ...s, lab: { ...s.lab, owned: [] } },
    'upgradeRackBatch',
    payload(true),
  );
  assert.equal(q.noticeFee, Math.ceil((20 + 5 + q.upgradeCost * 0.08) * 0.75));
  assert.ok(q.noticeFee < base.noticeFee);
  assert.equal(q.noticeLead, 60);
  assert.equal(E.quoteHardware(s, 'upgradeRackBatch', payload()).noticeFee, 0);
  assert.ok(E.act(s, 'upgradeRackBatch', payload(true)).ok);
  s.sector = 5;
  assert.deepEqual(
    E.normalizeState(s).facility.operation,
    s.facility.operation,
    'paid sector price is frozen',
  );
});
test('save validator rejects forged costs, target levels, consent and overlapping work', () => {
  const s = fixture();
  assert.ok(E.act(s, 'upgradeRackBatch', payload(true)).ok);
  for (const mutate of [
    (op) => op.cost--,
    (op) => (op.noticeFee = 0),
    (op) => (op.noticeProtection = 1),
    (op) => op.changes[0].targetLevel++,
    (op) => op.changes.push(op.changes[0]),
    (op) => (op.notified = ['customer-999999']),
    (op) => (op.noticeLead = 1),
    (op) => (op.remaining = 0),
    (op) => (op.noticeDiscount = 0.75),
  ]) {
    const copy = structuredClone(s);
    mutate(copy.facility.operation);
    assert.throws(() => E.normalizeState(copy));
  }
  const legacy = fixture();
  legacy.version = 8;
  assert.equal(E.normalizeState(legacy).version, 11);
});
test('queue projects batch targets, honors budget and starts a single shared outage', () => {
  const s = fixture(),
    p = payload();
  assert.ok(
    E.act(s, 'queueOperation', { action: 'upgradeRackBatch', payload: p, ceiling: 1000 }).ok,
  );
  const next = E.quotePlannedOperation(s, {
    action: 'upgradeRack',
    payload: { rackId: 'rack-1', component: 'power' },
  });
  assert.ok(next.cost > 300);
  assert.equal(E.normalizeState(s).operations.queue[0].payload.components.length, 3);
  s.operations.limits.plan = 0;
  E.advance(s, 61);
  assert.equal(s.facility.operation, null);
  s.operations.limits.plan = 5000;
  E.advance(s, 61);
  assert.equal(s.facility.operation?.kind, 'rack-batch');
  assert.equal(s.operations.queue.length, 0);
});
