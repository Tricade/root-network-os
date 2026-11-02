'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const { grantSpace } = require('./helpers/facility.cjs');

test('loss of GPU supply does not stop unrelated hosting customers in the same room', () => {
  const s = E.createState(730);
  s.business.rooms[0].groups.find((g) => g.kind === 'inference').units = 1;
  const model = E.getBusinessModel(s),
    groups = model.rooms[0].groups;
  assert.equal(groups.find((g) => g.kind === 'inference').supplied, 0);
  assert.ok(groups.find((g) => g.kind === 'hosting').supplied > 0.5);
  assert.ok(E.getMetrics(s).serviceIncome > 0);
});
test('premium obligations cannot be toggled off during an outage', () => {
  const s = E.createState(731),
    g = s.business.rooms[0].groups[0];
  const contract = s.customers.contracts[0];
  contract.premium = true;
  g.premium = true;
  g.nextPremium = true;
  assert.ok(E.act(s, 'setServicePremium', { roomId: 'room-1', kind: 'hosting', value: false }).ok);
  assert.equal(g.premium, true);
  assert.equal(g.nextPremium, false);
  contract.remaining = 1;
  E.advance(s, 1);
  assert.equal(contract.premium, false);
});

test('customers use real resources, new idle servers do not mint unearned revenue', () => {
  const s = E.createState(701),
    base = E.getMetrics(s);
  s.credits = 1e6;
  assert.ok(E.act(s, 'buyServer', { type: 'edge' }).ok);
  const next = E.getMetrics(s);
  assert.equal(next.serviceIncome, base.serviceIncome);
  assert.ok(next.upkeep > base.upkeep);
  const lead = {
    id: 'lead-' + s.nextId++,
    client: 'Fixture customer',
    kind: 'hosting',
    units: 2,
    term: 259200,
    expiresAt: s.time + 14400,
  };
  s.customers.leads.push(lead);
  const q = E.quoteCustomer(s, 'acceptCustomerLead', { id: lead.id, roomId: 'room-1' });
  assert.ok(q.enabled, q.reason);
  assert.ok(E.act(s, 'acceptCustomerLead', { id: lead.id, roomId: 'room-1' }).ok);
  assert.equal(E.getMetrics(s).serviceIncome, base.serviceIncome);
  s.resilience.graceUntil = 1e9;
  E.advance(s, 600);
  assert.equal(s.business.rooms[0].groups[0].units, 5);
  assert.ok(E.getMetrics(s).serviceIncome > base.serviceIncome);
  assert.deepEqual(E.normalizeState(s).business, s.business);
});
test('capacity promises cannot be overbooked and rejected requests leave state untouched', () => {
  const s = E.createState(702);
  s.credits = 1e6;
  for (const units of [NaN, Infinity, -1, 0, 0.5, 1000001, 1000]) {
    const before = structuredClone(s);
    assert.equal(
      E.act(s, 'contractService', { roomId: 'room-1', kind: 'hosting', units }).ok,
      false,
    );
    assert.deepEqual(s, before);
  }
  const base = E.getMetrics(s);
  s.servers[0].powered = false;
  assert.equal(E.getMetrics(s).serviceIncome, 0);
  assert.ok(base.serviceIncome > 0);
});
test('GPU jobs stall independently; CPU work uses the remaining resource pool', () => {
  const s = E.createState(703);
  s.resilience.graceUntil = 1e9;
  s.jobs.push({ ...s.jobs[0], id: 'job-900', kind: 'ai', gpuDemand: 1, specialty: 'training' });
  const m = E.getMetrics(s);
  assert.equal(m.jobRates['job-900'], 0);
  assert.ok(m.jobRates['job-1'] > 0);
  E.advance(s, 60);
  assert.equal(s.jobs[1].work, 0);
  assert.ok(s.jobs[0].work > 0);
});
test('legacy v3 migration keeps assets, balances and contractual promises', () => {
  const s = E.createState(704);
  s.version = 3;
  delete s.business;
  s.credits = 14000000;
  const copy = E.normalizeState(s);
  assert.equal(copy.version, 8);
  assert.equal(copy.credits, s.credits);
  assert.deepEqual(copy.jobs, s.jobs);
  assert.deepEqual(copy.servers, s.servers);
  assert.equal(copy.business.transitionUntil, s.time + 43200);
  assert.deepEqual(E.normalizeState(copy), copy);
  const invalid = structuredClone(copy);
  delete invalid.business;
  assert.throws(() => E.normalizeState(invalid));
});
test('resource ratios make storage, memory, network and AI project choices distinct', () => {
  const resource = (kind) => E.jobResources({ kind, load: 5, gpuDemand: 1 });
  assert.ok(resource('archive').storage > resource('monitoring').storage * 10);
  assert.ok(resource('database').ram > resource('monitoring').ram * 5);
  assert.ok(resource('replication').network > resource('audit').network * 5);
  assert.ok(resource('ai').vram > 0);
  assert.equal(resource('database').gpu, 0);
  const s = E.createState(705);
  s.resilience.graceUntil = 1e9;
  s.policies.autocontract = true;
  const titles = new Set(),
    kinds = new Set();
  for (let i = 0; i < 200; i++) {
    for (const job of s.offers) {
      titles.add(job.title);
      kinds.add(job.kind);
    }
    s.offers = [];
    E.advance(s, 75);
  }
  assert.ok(kinds.size >= 14);
  assert.ok(titles.size >= 35);
});
test('large fleets never produce negative resource budgets or exponential trust income', () => {
  const s = E.createState(706);
  s.sector = 100;
  s.servers = [];
  s.facility.racks = [];
  for (let i = 0; i < 60; i++) {
    const rackId = 'rack-' + (i + 1);
    s.facility.racks.push({
      id: rackId,
      name: rackId,
      switchLevel: 1,
      powerLevel: 1,
      coolingLevel: 1,
      disabledPorts: [],
    });
    for (let j = 0; j < 4; j++)
      s.servers.push({
        id: `server-${i * 4 + j + 1}`,
        name: 'Synthetic',
        type: 'edge',
        level: 10,
        mode: 'performance',
        condition: 100,
        status: 'online',
        fault: null,
        rackId,
        unit: 2 + j,
        port: j + 1,
        powered: true,
        bootRemaining: 0,
      });
  }
  grantSpace(s);
  const model = E.getBusinessModel(s);
  for (const room of model.rooms)
    for (const value of Object.values(room.available))
      assert.ok(value >= 0 && Number.isFinite(value));
  s.reputation = 0;
  const base = E.getMetrics(s).serviceIncome;
  s.reputation = 1e6;
  assert.ok(E.getMetrics(s).serviceIncome <= base * 1.15 + 1e-9);
});
