'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const { personnelHash } = require('../engine/personnel.js')({});

function ready(seed = 8101) {
  const s = E.createState(seed);
  s.credits = 1e6;
  s.resilience.graceUntil = 1e9;
  assert.ok(E.act(s, 'buyServer', { type: 'edge' }).ok);
  return s;
}
function lead(s, overrides = {}) {
  const value = {
    id: 'lead-' + s.nextId++,
    client: 'Fixture Labs',
    kind: 'hosting',
    units: 1,
    term: 259200,
    expiresAt: s.time + 14400,
    ...overrides,
  };
  s.customers.leads.push(value);
  return value;
}

test('customer setup requires a real available agent and pays only after provisioning', () => {
  const s = ready();
  const request = lead(s),
    income = E.getMetrics(s).serviceIncome;
  const q = E.quoteCustomer(s, 'acceptCustomerLead', { id: request.id, roomId: 'room-1' });
  assert.ok(q.enabled, q.reason);
  assert.ok(E.act(s, 'acceptCustomerLead', { id: request.id, roomId: 'room-1' }).ok);
  const c = s.customers.contracts.at(-1),
    agentId = c.agentId;
  assert.ok(agentId);
  assert.equal(E.getMetrics(s).serviceIncome, income);
  assert.equal(E.quoteProject(s, { id: agentId, kind: 'audit' }).enabled, false);
  assert.equal(E.act(s, 'dismissAgent', { id: agentId }).ok, false);
  assert.equal(
    E.getAgentOperations(s).agents.find((a) => a.id === agentId).assignment.kind,
    'customer',
  );
  E.advance(s, 599);
  assert.equal(c.stage, 'setup');
  E.advance(s, 1);
  assert.equal(c.stage, 'active');
  assert.equal(c.agentId, null);
  assert.equal(s.business.rooms[0].groups[0].units, 4);
  assert.ok(E.getMetrics(s).serviceIncome > income);
  assert.deepEqual(E.normalizeState(s).customers, s.customers);
});

test('queued setups reserve capacity, survive reload and wait when automatic staffing is disabled', () => {
  const s = ready(8102);
  s.customers.autoAssign = false;
  const request = lead(s);
  assert.ok(E.act(s, 'acceptCustomerLead', { id: request.id, roomId: 'room-1' }).ok);
  const c = s.customers.contracts.at(-1);
  E.advance(s, 700);
  assert.equal(c.stage, 'setup');
  assert.equal(c.workRemaining, 600);
  assert.equal(c.agentId, null);
  assert.deepEqual(E.normalizeState(s).customers, s.customers);
  assert.ok(E.act(s, 'assignCustomerAgent', { id: c.id, agentId: s.agents[0].id }).ok);
  E.advance(s, 600);
  assert.equal(c.stage, 'active');
});

test('customers can leave for commercial reasons and cancellation affects only their own capacity', () => {
  let s;
  for (let seed = 1; seed <= 1000; seed++) {
    const candidate = E.createState(seed),
      c = candidate.customers.contracts[0];
    if (personnelHash(candidate.seed, c.id + '/review/0') % 10000 < 125) {
      s = candidate;
      break;
    }
  }
  assert.ok(s, 'deterministic commercial departure fixture exists');
  s.resilience.graceUntil = 1e9;
  const c = s.customers.contracts[0];
  c.reviewAt = 0;
  E.advance(s, 1);
  assert.ok(['budget', 'consolidation', 'competitor'].includes(c.departure));
  assert.ok(c.notice > 0, 'departure has a notice period');
  c.notice = 2;
  E.advance(s, 2);
  assert.equal(s.customers.contracts.length, 0);
  assert.equal(s.business.rooms[0].groups[0].units, 0);
  assert.equal(s.customers.history.length, 1);
  assert.equal(s.servers[0].status, 'online');
  assert.ok(E.getMetrics(s).capacity > 0, 'losing a contract does not stop the hardware');
  assert.deepEqual(E.normalizeState(s).customers, s.customers);
});

test('brief service interruptions allow repairs; long failures create complaints and notice', () => {
  const s = E.createState(8104),
    c = s.customers.contracts[0];
  s.resilience.graceUntil = 1e9;
  s.servers[0].powered = false;
  E.advance(s, 120);
  assert.equal(c.notice, 0);
  assert.equal(c.issue, '');
  E.advance(s, 780);
  assert.equal(c.issue, 'outage');
  assert.equal(c.notice, 0);
  E.advance(s, 6300);
  assert.equal(c.departure, 'sla');
  assert.ok(c.notice > 0);
  assert.equal(s.customers.contracts.length, 1, 'repair window remains open');
});

test('lead and ledger limits are bounded, quotes are pure, and stale or arbitrary purchases fail', () => {
  const s = ready(8105),
    request = lead(s);
  const before = structuredClone(s);
  E.quoteCustomer(s, 'acceptCustomerLead', { id: request.id, roomId: 'room-1' });
  assert.deepEqual(s, before);
  assert.equal(
    E.act(s, 'contractService', { roomId: 'room-1', kind: 'hosting', units: 1 }).ok,
    false,
  );
  assert.equal(E.act(s, 'acceptCustomerLead', { id: 'missing', roomId: 'room-1' }).ok, false);
  assert.deepEqual(s, before);
  E.advance(s, 14400);
  assert.ok(s.customers.leads.length <= 12);
  assert.ok(s.customers.history.length <= 20);
  assert.equal(
    s.customers.leads.some((l) => l.id === request.id),
    false,
  );
  const corrupt = structuredClone(s);
  corrupt.customers.contracts[0].units++;
  assert.throws(() => E.normalizeState(corrupt), /Kundenverwaltung/);
});

test('automatic sales respect the exact hourly fee and cash reserve, never charge a waiting setup again', () => {
  const s = ready(8106);
  s.customers.leads = [];
  const request = lead(s);
  const q = E.quoteCustomer(s, 'acceptCustomerLead', { id: request.id, roomId: 'room-1' });
  assert.equal(q.cost, 252, 'decimal service fees do not round up by a stray credit');
  const reserved = E.getBusinessModel(s).rooms[0].reserved;
  const probe = structuredClone(s);
  assert.ok(E.act(probe, 'acceptCustomerLead', { id: request.id, roomId: 'room-1' }).ok);
  const after = E.getBusinessModel(probe).rooms[0].reserved;
  for (const [key, need] of Object.entries(q.resources))
    assert.ok(
      Math.abs(after[key] - reserved[key] - need) < 1e-9,
      'Quoted ' + key + ' must match the actual commitment',
    );
  s.customers.autoAccept = true;
  s.customers.autoAssign = false;
  s.customers.budget = 251;
  E.advance(s, 60);
  assert.equal(s.customers.spent, 0);
  assert.equal(s.customers.contracts.length, 1);
  s.customers.budget = 252;
  E.advance(s, 60);
  assert.equal(s.customers.spent, 252);
  assert.equal(s.customers.contracts.length, 2);
  assert.equal(s.customers.contracts.at(-1).agentId, null);
  E.advance(s, 60);
  assert.equal(s.customers.spent, 252);
  assert.deepEqual(E.normalizeState(s).customers, s.customers);
});

test('schema 5 progress migrates once and stale customer ID counters cannot create duplicates', () => {
  const prior = ready(8107);
  prior.version = 5;
  delete prior.customers;
  const before = structuredClone(prior),
    loaded = E.normalizeState(prior);
  assert.deepEqual(prior, before, 'migration leaves source bytes/data alone');
  assert.deepEqual(loaded.servers, prior.servers);
  assert.equal(loaded.credits, prior.credits);
  assert.equal(loaded.research, prior.research);
  assert.equal(loaded.customers.contracts[0].units, 3);
  loaded.customers.contracts[0].id = 'customer-99999';
  loaded.nextId = 5;
  const restored = E.normalizeState(loaded);
  assert.ok(restored.nextId > 99999);
  const request = lead(restored);
  assert.ok(E.act(restored, 'acceptCustomerLead', { id: request.id, roomId: 'room-1' }).ok);
  assert.equal(new Set(restored.customers.contracts.map((c) => c.id)).size, 2);
});
