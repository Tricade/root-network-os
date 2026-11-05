'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const createPreventiveMaintenance = require('../engine/preventive-maintenance.js');

function fixture({ engineers = 1, supplyAfter = 0.98 } = {}) {
  const s = {
    time: 0,
    sector: 1,
    credits: 10000,
    servers: [
      { id: 'srv-1', rackId: 'rack-1', status: 'online', powered: true, condition: 55 },
      { id: 'srv-2', rackId: 'rack-1', status: 'online', powered: true, condition: 64 },
      { id: 'srv-3', rackId: 'rack-1', status: 'failed', powered: true, condition: 20 },
      { id: 'srv-4', rackId: 'rack-2', status: 'online', powered: true, condition: 50 },
    ],
    facility: {
      racks: [
        { id: 'rack-1', name: 'Rack A', disabledPorts: [] },
        { id: 'rack-2', name: 'Rack B', disabledPorts: [] },
      ],
      operation: null,
      centralOperation: null,
    },
    agents: Array.from({ length: engineers }, (_, i) => ({
      id: `tech-${i + 1}`,
      role: 'engineer',
      level: 1 + i,
      assignment: null,
      cooldownUntil: 0,
    })),
    resilience: { operation: null, incident: null, parts: 10 },
    operations: { projects: [] },
    business: { contracts: [], rooms: [] },
    creditsReserve: 200,
    log: [],
    nextId: 1,
  };
  const ctx = {
    addLog(state, type, message) {
      state.log.unshift({ type, message });
    },
    getMetrics(state) {
      const down = Boolean(state.facility.operation);
      const loss = down ? supplyAfter : 1;
      return { serviceUnits: 100, serviceDelivered: 100 * loss };
    },
    agentProductive(state, agent) {
      return !agent.assignment && !state.operations.projects.some((p) => p.agentId === agent.id);
    },
    agentAvailable: () => true,
    globalIncident: (state) => Boolean(state.resilience.incident),
    maintenancePolicy: (state) => ({ reserve: state.creditsReserve }),
    serverLinkState: () => true,
  };
  Object.assign(
    ctx,
    require('../engine/agent-development.js')(ctx),
    require('../engine/preventive-save.js')(ctx),
  );
  const domain = createPreventiveMaintenance(ctx);
  s.preventiveMaintenance = domain.preventiveMaintenanceDefaults(0);
  s.preventiveMaintenance.policy.minimumSupply = 0.95;
  return { s, domain };
}

function advance(s, domain, seconds) {
  for (let i = 0; i < seconds; i++) {
    s.time++;
    domain.advancePreventiveMaintenance(s, 1);
  }
}

test('preventive quote targets only live worn servers and prices below patching them individually', () => {
  const { s, domain } = fixture();
  const quote = domain.quotePreventiveMaintenance(s, { rackId: 'rack-1', agentId: 'tech-1' });
  const scale = 1 + (s.servers.length - 1) * 0.03,
    patchCost = [55, 64].reduce(
      (sum, condition) => sum + Math.ceil((78 + Math.max(0, 60 - condition) * 1.7) * scale),
      0,
    );
  assert.equal(quote.enabled, true, quote.reason);
  assert.deepEqual(quote.servers, ['srv-1', 'srv-2']);
  assert.equal(quote.parts, 1);
  assert.equal(quote.targetCondition, 85);
  assert.ok(quote.cost < patchCost);
  assert.ok(quote.effort > 0 && quote.duration > 0);
  assert.ok(quote.downtime < quote.duration);
});

test('a scheduled job respects its earliest service window, uses an engineer and never revives failed hardware', () => {
  const { s, domain } = fixture();
  assert.equal(
    domain.applyPreventiveMaintenance(s, 'schedulePreventiveMaintenance', {
      rackId: 'rack-1',
      agentId: 'tech-1',
      earliestAt: 60,
      windowStart: 120,
      windowEnd: 240,
    }).ok,
    true,
  );
  advance(s, domain, 120);
  assert.equal(s.preventiveMaintenance.operation, null);
  advance(s, domain, 1);
  const operation = s.preventiveMaintenance.operation;
  const workRemaining = operation.remaining;
  assert.ok(operation);
  assert.equal(operation.startedAt, 121);
  assert.equal(domain.preventiveAgentBusy(s, 'tech-1'), true);
  assert.equal(domain.preventiveRackOffline(s, 'rack-1'), true);
  assert.equal(s.resilience.parts, 9);
  assert.ok(s.credits < 10000);
  advance(s, domain, operation.downtimeTotal);
  assert.equal(domain.preventiveRackOffline(s, 'rack-1'), false);
  s.servers[0].status = 'failed';
  advance(s, domain, workRemaining - operation.downtimeTotal);
  assert.equal(s.preventiveMaintenance.operation, null);
  assert.equal(s.servers[0].status, 'failed');
  assert.equal(s.servers[1].condition, 85);
  assert.equal(s.servers[2].status, 'failed');
  assert.equal(domain.preventiveAgentBusy(s, 'tech-1'), false);
});

test('automatic maintenance defaults off, starts no more than once a minute and requires spare staffing', () => {
  const { s, domain } = fixture({ engineers: 1 });
  assert.equal(s.preventiveMaintenance.policy.automatic, false);
  const configured = domain.applyPreventiveMaintenance(s, 'setPreventiveMaintenancePolicy', {
    automatic: true,
    threshold: 70,
    earliestAt: 0,
    windowStart: 0,
    windowEnd: 86399,
    minimumSupply: 0.95,
    dailyLimit: 2500,
  });
  assert.equal(configured.ok, true);
  advance(s, domain, 121);
  assert.equal(s.preventiveMaintenance.operation, null);
  s.agents.push({ id: 'tech-2', role: 'engineer', level: 2, assignment: null, cooldownUntil: 0 });
  advance(s, domain, 59);
  assert.equal(s.preventiveMaintenance.operation, null);
  advance(s, domain, 1);
  assert.ok(s.preventiveMaintenance.operation);
  assert.equal(s.preventiveMaintenance.operation.agentId, 'tech-2');
});

test('automatic start protects customer supply, cash reserve and daily spend cap', () => {
  const lowSupply = fixture({ engineers: 2, supplyAfter: 0.9 });
  lowSupply.domain.applyPreventiveMaintenance(lowSupply.s, 'setPreventiveMaintenancePolicy', {
    automatic: true,
    threshold: 70,
    earliestAt: 0,
    windowStart: 0,
    windowEnd: 86399,
    minimumSupply: 0.95,
    dailyLimit: 2500,
  });
  advance(lowSupply.s, lowSupply.domain, 60);
  assert.equal(lowSupply.s.preventiveMaintenance.operation, null);
  assert.equal(lowSupply.s.credits, 10000);
  assert.equal(lowSupply.s.resilience.parts, 10);

  const capped = fixture({ engineers: 2 });
  capped.s.preventiveMaintenance.policy.automatic = true;
  capped.s.preventiveMaintenance.dailySpent = 2499;
  advance(capped.s, capped.domain, 60);
  assert.equal(capped.s.preventiveMaintenance.operation, null);
  capped.s.preventiveMaintenance.dailySpent = 0;
  capped.s.credits = 100;
  advance(capped.s, capped.domain, 60);
  assert.equal(capped.s.preventiveMaintenance.operation, null);
});

test('maintenance waits through repairs, crisis and unavailable project/customer technicians', () => {
  const { s, domain } = fixture();
  s.resilience.operation = { kind: 'repair' };
  assert.equal(
    domain.quotePreventiveMaintenance(s, { rackId: 'rack-1', agentId: 'tech-1' }).enabled,
    false,
  );
  s.resilience.operation = null;
  s.operations.projects.push({ agentId: 'tech-1' });
  assert.equal(
    domain.quotePreventiveMaintenance(s, { rackId: 'rack-1', agentId: 'tech-1' }).enabled,
    false,
  );
  s.operations.projects.length = 0;
  s.agents[0].assignment = { kind: 'customer', label: 'Kundenbetreuung' };
  assert.equal(
    domain.quotePreventiveMaintenance(s, { rackId: 'rack-1', agentId: 'tech-1' }).enabled,
    false,
  );
});

test('strict normalization validates references and preserves deterministic active work', () => {
  const { s, domain } = fixture();
  assert.equal(
    domain.applyPreventiveMaintenance(s, 'schedulePreventiveMaintenance', {
      rackId: 'rack-1',
      agentId: 'tech-1',
      earliestAt: 1,
    }).ok,
    true,
  );
  advance(s, domain, 60);
  const normalized = domain.normalizePreventiveMaintenance(s.preventiveMaintenance, s);
  assert.ok(normalized.operation);
  assert.equal(normalized.operation.agentId, 'tech-1');
  const invalid = structuredClone(s.preventiveMaintenance);
  invalid.operation.rackId = 'missing-rack';
  assert.throws(() => domain.normalizePreventiveMaintenance(invalid, s), /Wartungsdaten/);
});

test('active maintenance advances identically for online and offline simulation time', () => {
  const { s, domain } = fixture();
  assert.equal(
    domain.applyPreventiveMaintenance(s, 'schedulePreventiveMaintenance', {
      rackId: 'rack-1',
      agentId: 'tech-1',
      earliestAt: 1,
    }).ok,
    true,
  );
  advance(s, domain, 1);
  const offlineState = structuredClone(s);
  advance(s, domain, 360);
  advance(offlineState, domain, 360);
  assert.deepEqual(offlineState, s);
});

test('unknown actions and failed cancellation leave simulation state untouched', () => {
  const { s, domain } = fixture(),
    before = structuredClone(s);
  assert.equal(domain.applyPreventiveMaintenance(s, 'unrelatedAction', {}), null);
  assert.equal(domain.applyPreventiveMaintenance(s, 'cancelPreventiveMaintenance', {}).ok, false);
  assert.deepEqual(s, before);
});
