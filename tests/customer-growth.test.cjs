'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const createCustomerGrowth = require('../engine/customer-growth');

const SERVICES = {
  hosting: { fee: 0.14 },
  archive: { fee: 0.26 },
  database: { fee: 0.44 },
  inference: { fee: 0.72 },
};
const TERMS = [86400, 259200, 604800];

function harness({ capacity = true, seed = 81, credits = 1000, reserve = 100, draw = 0 } = {}) {
  let serviceQuotes = 0;
  const ctx = {
    SERVICES,
    CUSTOMER_TERMS: TERMS,
    CUSTOMER_ROOM_LIMIT: 16,
    personnelHash: (_seed, _key) => draw,
    maintenancePolicy: () => ({ reserve }),
    serviceSetupCost: (kind, units) => Math.round(SERVICES[kind].fee * 1800) * units,
    addLog: (s, type, message) => s.log.push({ type, message, time: s.time }),
    serviceQuote: (s, _action, p) => {
      serviceQuotes++;
      const cost = Math.round(SERVICES[p.kind].fee * 1800) * p.units;
      return {
        enabled: capacity && s.credits >= cost,
        reason: capacity ? (s.credits < cost ? 'funds' : '') : 'capacity',
        cost,
        duration: 600,
        resources: { cpu: p.units * 2 },
      };
    },
    uid: (s, prefix) => `${prefix}-${s.nextId++}`,
    makeCustomer: (s, roomId, kind, units) => ({
      id: `customer-${s.nextId++}`,
      client: 'New client',
      roomId,
      kind,
      units,
      term: 259200,
      remaining: 259200,
      stage: 'setup',
      premium: false,
      renew: true,
      satisfaction: 100,
      deficit: 0,
      issue: '',
      notice: 0,
      departure: '',
      reviewAt: s.time + 21600,
      work: 'setup',
      workRemaining: 600,
      workTotal: 600,
      agentId: null,
      retentionUsed: false,
    }),
    syncCustomerGroups: (s) => {
      for (const group of s.business.rooms[0].groups) {
        const rows = s.customers.contracts.filter(
          (c) => c.roomId === 'room-1' && c.kind === group.kind,
        );
        group.units = rows.filter((c) => c.stage === 'active').reduce((n, c) => n + c.units, 0);
        group.pending = rows.reduce(
          (n, c) => n + (c.stage === 'setup' ? c.units : c.growthUnits || 0),
          0,
        );
        group.onboarding = rows
          .filter((c) => c.stage === 'setup' || c.work === 'growth')
          .reduce((n, c) => Math.max(n, c.workRemaining), 0);
      }
    },
    assignCustomerWork: (s) => {
      const busy = new Set(s.customers.contracts.map((c) => c.agentId).filter(Boolean));
      for (const c of s.customers.contracts) {
        if (c.work && !c.agentId) {
          const agent = s.agents.find((a) => !busy.has(a.id));
          if (agent) {
            c.agentId = agent.id;
            busy.add(agent.id);
          }
        }
      }
    },
  };
  const domain = createCustomerGrowth(ctx);
  const source = {
    id: 'customer-1',
    client: 'Fixture Labs',
    roomId: 'room-1',
    kind: 'hosting',
    units: 3,
    term: 259200,
    remaining: 259200,
    stage: 'active',
    premium: false,
    renew: true,
    satisfaction: 100,
    deficit: 0,
    issue: '',
    notice: 0,
    departure: '',
    reviewAt: 21600,
    work: '',
    workRemaining: 0,
    workTotal: 0,
    agentId: null,
    retentionUsed: false,
  };
  const s = {
    time: 0,
    seed,
    nextId: 2,
    credits,
    reputation: 20,
    customers: { contracts: [source], won: 0 },
    business: {
      revenue: 0,
      rooms: [
        {
          roomId: 'room-1',
          groups: Object.keys(SERVICES).map((kind) => ({
            kind,
            units: kind === 'hosting' ? source.units : 0,
            pending: 0,
            onboarding: 0,
            nextPremium: false,
            renew: true,
          })),
        },
      ],
    },
    agents: [{ id: 'agent-1', assignment: null }],
    log: [],
  };
  s.customerGrowth = domain.growthDefaults(s);
  return {
    s,
    domain,
    source,
    setCapacity(value) {
      capacity = value;
    },
    get serviceQuotes() {
      return serviceQuotes;
    },
  };
}

function generateRequest(h) {
  h.s.time = 21600;
  h.domain.advanceGrowth(h.s, 1);
  return h.s.customerGrowth.requests[0];
}

function promise(h, request, { windowSeconds = 3600, budgetCeiling = 300 } = {}) {
  return h.domain.applyGrowth(h.s, 'promiseCustomerGrowth', {
    id: request.id,
    windowSeconds,
    budgetCeiling,
  });
}

// A schema 10 commitment could be paid before capacity became available.
function legacyPromise(h, request) {
  const budgetCeiling = 300;
  h.s.credits -= budgetCeiling;
  Object.assign(request, {
    status: 'promised',
    promisedAt: h.s.time,
    windowSeconds: 3600,
    deadlineAt: h.s.time + 3600,
    budgetCeiling,
    escrow: budgetCeiling,
    nextAttemptAt: h.s.time,
  });
}

test('growth requests are deterministic, modest, bounded, and never roll the simulation RNG', () => {
  const a = harness({ seed: 91 }),
    b = harness({ seed: 91 });
  a.s.rng = b.s.rng = 12345;
  const requestA = generateRequest(a),
    requestB = generateRequest(b);
  assert.equal(requestA.units, 1);
  assert.equal(requestA.expiresAt, 108000);
  assert.deepEqual(requestA, requestB);
  assert.equal(a.s.rng, 12345);
  assert.deepEqual(a.s.customerGrowth, b.s.customerGrowth);

  a.domain.applyGrowth(a.s, 'declineCustomerGrowth', { id: requestA.id });
  a.s.time = 43200;
  a.domain.advanceGrowth(a.s, 1);
  assert.equal(a.s.customerGrowth.requests.length, 0, 'an origin receives at most one request');
});

test('offer list is capped at twelve while every source remains distinct', () => {
  const h = harness();
  for (let i = 2; i <= 20; i++)
    h.s.customers.contracts.push({ ...h.source, id: `customer-${i}`, client: `Client ${i}` });
  h.s.time = 21600;
  h.domain.advanceGrowth(h.s, 1);
  assert.equal(h.s.customerGrowth.requests.length, 12);
  assert.equal(new Set(h.s.customerGrowth.requests.map((r) => r.sourceId)).size, 12);
  assert.equal(new Set(h.s.customerGrowth.requests.map((r) => r.id)).size, 12);
});

test('growth chance has a deterministic five-percent boundary and unaccepted requests expire free', () => {
  const rejected = harness({ draw: 500 });
  generateRequest(rejected);
  assert.equal(rejected.s.customerGrowth.requests.length, 0);

  const offered = harness({ draw: 499 }),
    startCredits = offered.s.credits,
    request = generateRequest(offered);
  assert.ok(request);
  offered.s.time = request.expiresAt;
  offered.domain.advanceGrowth(offered.s, 1);
  assert.equal(offered.s.customerGrowth.requests.length, 0);
  assert.equal(offered.s.credits, startCredits);
  assert.equal(offered.s.reputation, 20);
  assert.equal(offered.source.satisfaction, 100);
});

test('promise quote is pure, requires an explicit allowed window and charges the exact setup cost', () => {
  const h = harness(),
    request = generateRequest(h),
    before = structuredClone(h.s);
  const q = h.domain.growthQuote(h.s, 'promiseCustomerGrowth', {
    id: request.id,
    windowSeconds: 3600,
    budgetCeiling: 300,
  });
  assert.equal(q.enabled, true, q.reason);
  assert.equal(q.setupCost, 252);
  assert.equal(q.cost, 252);
  assert.deepEqual(h.s, before);
  assert.equal(
    h.domain.growthQuote(h.s, 'promiseCustomerGrowth', {
      id: request.id,
      windowSeconds: 7200,
      budgetCeiling: 300,
    }).enabled,
    false,
  );
  assert.equal(
    h.domain.growthQuote(h.s, 'promiseCustomerGrowth', {
      id: request.id,
      windowSeconds: 3600,
      budgetCeiling: 251,
    }).enabled,
    false,
  );
  assert.equal(promise(h, request).ok, true);
  assert.equal(h.s.credits, 748);
  assert.equal(h.domain.getGrowth(h.s).reservedBudget, 0);
  assert.equal(h.s.business.revenue, 0, 'the setup fee is not revenue');
});

test('promise cannot outlive a nonrenewing contract or an existing notice', () => {
  const h = harness(),
    request = generateRequest(h);
  h.source.renew = false;
  h.source.remaining = 3600;
  assert.equal(
    h.domain.growthQuote(h.s, 'promiseCustomerGrowth', {
      id: request.id,
      windowSeconds: 3600,
      budgetCeiling: 300,
    }).enabled,
    false,
  );
  h.source.renew = true;
  h.source.notice = 14400;
  assert.equal(
    h.domain.growthQuote(h.s, 'promiseCustomerGrowth', {
      id: request.id,
      windowSeconds: 14400,
      budgetCeiling: 300,
    }).enabled,
    false,
  );
});

test('the setup fee cannot cross the protected reserve', () => {
  const h = harness({ credits: 351, reserve: 100 }),
    request = generateRequest(h);
  assert.equal(
    h.domain.growthQuote(h.s, 'promiseCustomerGrowth', {
      id: request.id,
      windowSeconds: 3600,
      budgetCeiling: 300,
    }).enabled,
    false,
  );
  assert.equal(h.s.credits, 351);
});

test('a legacy paid promise retries only once per minute and funds the existing contract when capacity becomes available', () => {
  const h = harness({ capacity: false });
  const request = generateRequest(h);
  assert.equal(promise(h, request).ok, false, 'new promises require available capacity');
  legacyPromise(h, request);
  h.s.time++;
  h.domain.advanceGrowth(h.s, 1);
  assert.equal(h.source.work, '');
  assert.equal(request.nextAttemptAt, 21661);
  const quoteCalls = h.serviceQuotes;
  h.s.time = 21660;
  h.domain.advanceGrowth(h.s, 1);
  assert.equal(h.serviceQuotes, quoteCalls);

  h.setCapacity(true);
  h.s.time++;
  h.domain.advanceGrowth(h.s, 1);
  assert.equal(h.s.customers.contracts.length, 1);
  assert.equal(h.source.work, 'growth');
  assert.equal(h.source.units, 3);
  assert.equal(h.source.growthUnits, 1);
  assert.equal(h.source.agentId, 'agent-1');
  assert.equal(h.s.credits, 748, 'unused old escrow is returned exactly once');
  assert.equal(request.status, 'provisioning');
});

test('delivery completed exactly at the deadline credits the same contract once', () => {
  const h = harness();
  const request = generateRequest(h);
  assert.equal(promise(h, request).ok, true);
  h.s.time = request.deadlineAt;
  h.domain.finishGrowthWork(h.s, h.source);
  assert.equal(h.s.customerGrowth.requests.length, 0);
  assert.equal(h.s.customers.contracts.length, 1);
  assert.equal(h.source.units, 4);
  assert.equal(h.source.growthUnits, undefined);
  assert.equal(h.s.reputation, 20);
  assert.equal(h.source.satisfaction, 100);
});

test('missed unstarted promise refunds escrow and applies one bounded reputation and relationship penalty', () => {
  const h = harness({ capacity: false }),
    request = generateRequest(h),
    startCredits = h.s.credits;
  legacyPromise(h, request);
  h.s.time = 25200;
  h.domain.advanceGrowth(h.s, 1);
  assert.equal(h.s.customerGrowth.requests.length, 0);
  assert.equal(h.s.credits, startCredits);
  assert.equal(h.s.reputation, 15);
  assert.equal(h.source.satisfaction, 90);
  h.domain.advanceGrowth(h.s, 1);
  assert.equal(h.s.reputation, 15, 'penalty cannot repeat');
});

test('late started setup may finish, but applies the late penalty only once', () => {
  const h = harness(),
    request = generateRequest(h);
  assert.equal(promise(h, request).ok, true);
  h.s.time = 25200;
  h.domain.advanceGrowth(h.s, 1);
  assert.equal(h.s.reputation, 15);
  assert.equal(h.s.customerGrowth.requests[0].latePenaltyApplied, true);
  h.domain.advanceGrowth(h.s, 1);
  assert.equal(h.s.reputation, 15);
  h.s.time++;
  h.domain.finishGrowthWork(h.s, h.source);
  assert.equal(h.s.customerGrowth.requests.length, 0);
  assert.equal(h.source.units, 4);
  assert.equal(h.s.reputation, 15);
});

test('normalization rejects altered escrow, duplicate origins and invalid linked contract references', () => {
  const h = harness(),
    request = generateRequest(h);
  assert.equal(promise(h, request).ok, true);
  const normalized = h.domain.normalizeGrowth(h.s, structuredClone(h.s.customerGrowth));
  assert.deepEqual(normalized, h.s.customerGrowth);

  const alteredEscrow = structuredClone(h.s.customerGrowth);
  alteredEscrow.requests[0].escrow++;
  assert.throws(() => h.domain.normalizeGrowth(h.s, alteredEscrow), /Kundenwachstumspläne/);
  const duplicateOrigin = structuredClone(h.s.customerGrowth);
  duplicateOrigin.usedOrigins.push(request.sourceId);
  assert.throws(() => h.domain.normalizeGrowth(h.s, duplicateOrigin), /Kundenwachstumspläne/);
  const badLink = structuredClone(h.s.customerGrowth);
  badLink.linkedContracts.push('customer-999');
  assert.throws(() => h.domain.normalizeGrowth(h.s, badLink), /Kundenwachstumspläne/);
});
