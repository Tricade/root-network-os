'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../engine.js');
const V1_FIXTURE = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'v1-save.json'), 'utf8'),
);
const V2_FIXTURE = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'v2-save.json'), 'utf8'),
);
const V2_REPAIR_FIXTURE = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'v2-active-repair-save.json'), 'utf8'),
);
const V2_CRISIS_FIXTURE = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'v2-active-crisis-save.json'), 'utf8'),
);
const {
  catalog,
  createState,
  normalizeState,
  getMetrics,
  getResilience,
  getAgentOperations,
  getRackModel,
  advance,
  act,
  cost,
} = E;

function finiteTree(value, label = 'value', seen = new Set()) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `${label} must be finite`);
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value))
    value.forEach((item, index) => finiteTree(item, `${label}[${index}]`, seen));
  else for (const [key, child] of Object.entries(value)) finiteTree(child, `${label}.${key}`, seen);
}

function stressed(seed, withBackup = false) {
  const state = createState(seed);
  state.credits = 100000;
  state.research = 1000;
  state.policies.autorepair = false;
  state.policies.autobackup = false;
  state.policies.repairBudget = 0;
  state.policies.reserve = 0;
  state.resilience.graceUntil = state.time;
  state.jobs.forEach((job, index) => {
    job.totalWork = 1e8;
    job.work = 800 + index * 40;
  });
  if (withBackup) {
    // This fixture starts with a completed prerequisite; its subject is backup
    // accounting for a real funded project, not the technology-unlock workflow.
    state.lab.owned = ['network-fabric'];
    const result = act(state, 'createBackup', {});
    assert.equal(result.ok, true, 'test fixture creates a real in-world backup');
    advance(state, getResilience(state).operation.remaining);
    assert.ok(getResilience(state).backupAt !== null);
    const price = cost(state, 'research', 'routing');
    assert.equal(act(state, 'buyResearch', { id: 'routing' }).ok, true);
    assert.equal(
      state.resilience.backup.protectedResearch,
      Math.max(0, state.resilience.backup.research - price),
    );
    for (const job of state.jobs) {
      job.totalWork = 1e8;
      job.work = 800 + state.jobs.indexOf(job) * 40;
    }
  }
  state.resilience.graceUntil = state.time;
  state.servers.forEach((server) => {
    server.condition = 10;
    server.mode = 'performance';
  });
  state.policies.power = 'performance';
  return state;
}

const incidentCache = new Map();
function incidentFixture(kind, withBackup = false) {
  const cacheKey = `${kind}:${withBackup}`;
  if (incidentCache.has(cacheKey)) return structuredClone(incidentCache.get(cacheKey));
  for (let seed = 1; seed <= 48; seed++) {
    const state = stressed(seed * 7919 + 31, withBackup);
    let elapsed = 0;
    while (elapsed < 43200 && !getResilience(state).incident) {
      const step = Math.min(300, 43200 - elapsed);
      advance(state, step);
      elapsed += step;
    }
    const incident = getResilience(state).incident;
    if (incident?.kind === kind) {
      // These fixtures exercise legacy global recovery promises; scoped v4
      // behavior has separate dependency and local-recovery regression tests.
      delete state.resilience.incident.scope;
      delete state.resilience.incident.rackId;
      delete state.resilience.incident.roomId;
      incidentCache.set(cacheKey, structuredClone(state));
      return state;
    }
  }
  assert.fail(
    `deterministic high-risk fixtures did not produce ${kind} within 48 seeds and 12 hours each`,
  );
}

function sumWork(state) {
  return state.jobs.reduce((sum, job) => sum + job.work, 0);
}
function sumSnapshotWork(backup) {
  return backup.jobs.reduce((sum, job) => sum + job.work, 0);
}
function assertOptionShape(option, prefix) {
  for (const field of [
    'key',
    'label',
    'description',
    'cost',
    'parts',
    'duration',
    'enabled',
    'reason',
    'researchLoss',
    'workLoss',
  ]) {
    assert.ok(Object.hasOwn(option, field), `${prefix} option includes ${field}`);
  }
  assert.equal(typeof option.description, 'string');
  assert.ok(option.description.length > 15, `${prefix} description explains the consequence`);
  assert.ok(Number.isFinite(option.cost) && option.cost >= 0);
  assert.ok(Number.isFinite(option.parts) && option.parts >= 0);
  assert.ok(Number.isFinite(option.duration) && option.duration >= 0);
  if (!option.enabled) assert.ok(option.reason.length > 5, `${prefix} disabled option states why`);
}

function assertQueueBounds(state) {
  assert.ok(state.log.length <= 80);
  assert.ok(state.history.length <= 60);
  assert.ok(state.jobs.length <= 8);
  assert.ok(state.offers.length <= 6);
  assert.ok(state.events.length <= 3);
  assert.ok(state.servers.length <= 16);
  assert.ok(state.agents.length <= 12);
}

test('new state exposes a read-only resilience model and consequential starting policies', () => {
  const state = createState(1101);
  const before = structuredClone(state);
  const model = getResilience(state);
  for (const field of [
    'online',
    'failed',
    'repairing',
    'condition',
    'integrity',
    'riskPerHour',
    'riskLabel',
    'safetyMode',
    'graceRemaining',
    'parts',
    'budget',
    'spent',
    'reserve',
    'backupAt',
    'backupAge',
    'backupCooldown',
    'backupProtectedResearch',
    'backupJobCount',
    'operation',
    'incident',
    'servers',
    'backup',
    'partsPurchase',
  ]) {
    assert.ok(Object.hasOwn(model, field), `read model exposes ${field}`);
  }
  assert.equal(state.version, 9);
  assert.deepEqual(state, before, 'reading resilience must not change persisted state');
  assert.equal(model.online, state.servers.length);
  assert.equal(model.failed, 0);
  assert.equal(model.graceRemaining, 600);
  assert.equal(model.parts, 3);
  assert.equal(model.backupAt, null, 'a fresh network has no fabricated operational backup');
  assert.equal(state.policies.repairBudget, 300);
  assert.equal(state.policies.reserve, 250);
  assert.equal(state.policies.autobackup, true);
  finiteTree(model, 'read model');
});

test('v1 migration preserves purchased assets and progress while adding a fresh protection grace period', () => {
  const old = structuredClone(V1_FIXTURE);
  old.networkName = 'Nordlicht Leitstelle';
  old.time = 72000;
  old.credits = 43210;
  old.research = 876.5;
  old.reputation = 37;
  old.lifetimeCredits = 123456;
  old.sector = 3;
  old.servers[0].level = 4;
  old.servers[0].mode = 'eco';
  old.agents[0].level = 3;
  old.agents[0].focus = 'maintenance';
  old.jobs[0].work = 21.25;
  old.upgrades = { routing: 4, cooling: 2 };
  old.policies = { power: 'eco', autocontract: true, autorepair: false, priority: 'income' };
  const migrated = normalizeState(old);
  assert.equal(migrated.version, 9);
  assert.equal(migrated.networkName, old.networkName);
  for (const key of ['credits', 'research', 'reputation', 'lifetimeCredits', 'sector', 'time'])
    assert.equal(migrated[key], old[key], `${key} survives migration`);
  assert.deepEqual(
    migrated.servers.map(({ id, type, name, level, mode }) => ({ id, type, name, level, mode })),
    old.servers,
  );
  assert.deepEqual(
    migrated.agents.map(({ id, name, role, level, focus, trait }) => ({
      id,
      name,
      role,
      level,
      focus,
      trait,
    })),
    old.agents,
  );
  assert.equal(migrated.jobs.find((job) => job.id === old.jobs[0].id).work, old.jobs[0].work);
  assert.deepEqual(migrated.upgrades, old.upgrades);
  assert.deepEqual(
    {
      power: migrated.policies.power,
      autocontract: migrated.policies.autocontract,
      autorepair: migrated.policies.autorepair,
      priority: migrated.policies.priority,
    },
    old.policies,
  );
  assert.equal(
    migrated.servers.every(
      (server) => server.condition === 100 && server.status === 'online' && server.fault === null,
    ),
    true,
  );
  assert.equal(migrated.resilience.parts, 3);
  assert.equal(migrated.resilience.graceUntil, old.time + 600);
  assert.equal(
    migrated.resilience.backup,
    null,
    'migration does not claim an operational backup that never existed',
  );
  assert.equal(getResilience(migrated).backupAt, null);
});

test('large v1 legacy fleets migrate with enough rack cooling to avoid a new thermal capacity penalty', () => {
  const old = structuredClone(V1_FIXTURE);
  old.sector = 3;
  old.servers = Array.from({ length: 8 }, (_, index) => ({
    id: `server-${index + 1}`,
    type: 'compute',
    name: `Legacy compute ${index + 1}`,
    level: 3,
    mode: 'balanced',
  }));
  const migrated = normalizeState(old);
  const model = getRackModel(migrated);
  const rawCapacity = migrated.servers.reduce(
    (sum, server) => sum + catalog.servers[server.type].capacity * Math.pow(server.level, 0.82),
    0,
  );
  assert.equal(migrated.servers.length, 8, 'the full legacy fleet is retained');
  assert.ok(model.racks.length >= 1);
  assert.ok(
    model.racks.every((rack) => rack.temperature <= 35),
    'migration provides cooling headroom below the thermal-throttle threshold',
  );
  assert.ok(
    model.racks.every((rack) => !rack.warnings.some((warning) => /Temperatur/i.test(warning))),
    'the migrated rack does not report new thermal stress',
  );
  assert.ok(
    Math.abs(getMetrics(migrated).capacity - rawCapacity) < 1e-8,
    'the migrated fleet keeps its pre-hardware nominal capacity',
  );
});

test('a failed v2 legacy server remains powered through migration and returns online after repair', () => {
  const old = structuredClone(V2_FIXTURE);
  old.credits = 5000;
  old.policies.reserve = 0;
  old.servers[0].condition = 35;
  old.servers[0].status = 'failed';
  old.servers[0].fault = 'Hardwarefehler';
  const migrated = normalizeState(old);
  const server = migrated.servers.find((row) => row.id === old.servers[0].id);
  assert.equal(server.status, 'failed', 'migration preserves the legacy failure');
  assert.equal(
    server.powered,
    true,
    'migration does not add an extra manual power-on step after repair',
  );
  assert.equal(
    getMetrics(migrated).capacity,
    0,
    'the failed server contributes no capacity before repair',
  );
  const repair = act(migrated, 'repairServer', { id: server.id, method: 'manual' });
  assert.equal(repair.ok, true, repair.message);
  advance(migrated, getResilience(migrated).operation.remaining);
  assert.equal(server.status, 'online');
  assert.equal(server.powered, true);
  assert.ok(
    getMetrics(migrated).capacity > 0,
    'repair restores usable capacity without manual power-on',
  );
  assert.equal(
    getRackModel(migrated)
      .racks.find((rack) => rack.id === server.rackId)
      .servers.find((node) => node.id === server.id).status,
    'online',
  );
});

test('v2 migration packs legacy assets into physical hardware without inventing recovery state', () => {
  const old = structuredClone(V2_FIXTURE);
  old.networkName = 'V2 migration lab';
  old.credits = 54321;
  old.research = 765.5;
  old.servers[0].level = 4;
  old.servers[0].mode = 'eco';
  old.jobs[0].work = 18.25;
  const migrated = normalizeState(old);
  assert.equal(migrated.version, 9);
  for (const key of [
    'networkName',
    'credits',
    'research',
    'reputation',
    'lifetimeCredits',
    'sector',
    'time',
    'upgrades',
    'policies',
  ]) {
    assert.deepEqual(migrated[key], old[key], `${key} survives v2 migration`);
  }
  for (const [id, claimed] of Object.entries(old.achievements))
    if (claimed) assert.equal(migrated.achievements[id], true, `${id} claimed state survives`);
  assert.equal(
    Object.values(migrated.achievements).some(Boolean),
    Object.values(old.achievements).some(Boolean),
    'migration does not invent claimed rewards',
  );
  assert.equal(migrated.jobs.find((job) => job.id === old.jobs[0].id).work, old.jobs[0].work);
  assert.equal(migrated.servers.length, old.servers.length);
  assert.equal(migrated.servers[0].level, old.servers[0].level);
  assert.equal(migrated.servers[0].mode, old.servers[0].mode);
  assert.ok(migrated.facility.racks.length >= 1);
  assert.ok(
    migrated.servers.every((server) =>
      migrated.facility.racks.some((rack) => rack.id === server.rackId),
    ),
  );
  assert.equal(
    migrated.servers.every((server) => server.powered === true && server.bootRemaining === 0),
    true,
  );
  assert.equal(
    migrated.resilience.backup,
    null,
    'migration never fabricates an operational backup',
  );
  assert.equal(
    migrated.resilience.graceUntil,
    old.resilience.graceUntil,
    'adding hardware does not erase the existing grace window',
  );
  for (const rack of migrated.facility.racks) {
    assert.equal(
      rack.units,
      undefined,
      'fixed physical dimensions come from the engine model, not an untrusted persisted override',
    );
    assert.equal(new Set(rack.disabledPorts).size, rack.disabledPorts.length);
  }
  const model = E.getRackModel(migrated);
  assert.ok(
    model.totalUnits >=
      migrated.servers.reduce(
        (sum, server) => sum + (server.type === 'edge' ? 1 : server.type === 'compute' ? 2 : 3),
        0,
      ),
  );
});

test('v2 migration preserves an active repair and its remaining maintenance time', () => {
  const old = structuredClone(V2_REPAIR_FIXTURE);
  const priorOperation = structuredClone(old.resilience.operation);
  const priorCredits = old.credits;
  const migrated = normalizeState(old);
  assert.equal(migrated.version, 9);
  assert.deepEqual(migrated.resilience.operation, priorOperation);
  assert.equal(
    migrated.servers.find((server) => server.id === priorOperation.serverId)?.status,
    'repairing',
  );
  assert.equal(migrated.resilience.operation.remaining, priorOperation.remaining);
  assert.equal(
    migrated.credits,
    priorCredits,
    'migration does not start, restart, or charge for maintenance',
  );
  const loaded = normalizeState(JSON.parse(JSON.stringify(migrated)));
  assert.equal(
    loaded.resilience.operation.remaining,
    priorOperation.remaining,
    'v3 save reload preserves remaining time',
  );
  advance(loaded, 1);
  assert.equal(loaded.resilience.operation.remaining, priorOperation.remaining - 1);
});

test('v2 migration preserves an active major crisis and already-damaged assets', () => {
  const old = structuredClone(V2_CRISIS_FIXTURE);
  const priorIncident = structuredClone(old.resilience.incident);
  const priorCondition = old.servers.find((server) =>
    priorIncident.affected.includes(server.id),
  ).condition;
  const priorCredits = old.credits;
  const migrated = normalizeState(old);
  assert.equal(migrated.version, 9);
  assert.deepEqual(migrated.resilience.incident, priorIncident);
  assert.equal(
    migrated.servers.find((server) => server.id === priorIncident.affected[0]).status,
    'failed',
  );
  assert.equal(
    migrated.servers.find((server) => server.id === priorIncident.affected[0]).condition,
    priorCondition,
  );
  assert.equal(
    migrated.credits,
    priorCredits,
    'migration does not bill a choice or silently repair the incident',
  );
  assert.equal(
    getRackModel(migrated).operation,
    null,
    'no rack upgrade is invented during migration',
  );
});

test('v2 roundtrip keeps failed nodes, operation progress, snapshot, and protected research', () => {
  const state = createState(1103);
  state.policies.reserve = 0;
  state.policies.autorepair = false;
  state.policies.autobackup = false;
  state.servers[0].fault = 'Hardwarefehler';
  state.resilience.parts = 5;
  assert.equal(act(state, 'createBackup', {}).ok, true);
  advance(state, getResilience(state).operation.remaining);
  state.servers[0].status = 'failed';
  state.servers[0].condition = 45;
  state.servers[0].fault = 'Hardwarefehler';
  assert.equal(act(state, 'repairServer', { id: state.servers[0].id, method: 'patch' }).ok, true);
  const modelBefore = getResilience(state);
  const restored = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.version, 9);
  assert.equal(restored.servers[0].status, 'repairing');
  assert.equal(restored.resilience.operation.remaining, state.resilience.operation.remaining);
  assert.equal(
    restored.resilience.backup.protectedResearch,
    state.resilience.backup.protectedResearch,
  );
  assert.deepEqual(getResilience(restored).servers[0], modelBefore.servers[0]);
  finiteTree(restored, 'roundtrip');
});

test('damaged-node repair quotes match actual costs, parts, duration, downtime, and resulting condition', () => {
  const base = createState(1104);
  base.credits = 10000;
  base.policies.reserve = 0;
  base.resilience.parts = 8;
  const server = base.servers[0];
  server.condition = 35;
  server.status = 'failed';
  server.fault = 'Hardwarefehler';
  const originalMetrics = getMetrics(base);
  assert.equal(originalMetrics.onlineServers, 0);
  assert.equal(originalMetrics.workPerSecond, 0);
  assert.ok(
    originalMetrics.incomePerSecond > 0,
    'emergency income keeps a fully offline network recoverable',
  );
  const repairs = getResilience(base).servers.find((row) => row.id === server.id).repairs;
  const byMethod = Object.fromEntries(repairs.map((option) => [option.key, option]));
  for (const method of ['patch', 'overhaul', 'manual']) assertOptionShape(byMethod[method], method);
  assert.equal(byMethod.manual.cost, 0);
  assert.equal(byMethod.manual.parts, 0);
  assert.ok(byMethod.manual.duration > byMethod.patch.duration);
  assert.ok(byMethod.patch.cost > 0 && byMethod.patch.parts > 0);
  assert.ok(byMethod.overhaul.cost > byMethod.patch.cost);
  assert.ok(byMethod.overhaul.duration > byMethod.patch.duration);
  assert.ok(byMethod.overhaul.parts > byMethod.patch.parts);

  const outcomes = {};
  for (const method of ['patch', 'overhaul', 'manual']) {
    const state = structuredClone(base);
    const option = getResilience(state).servers[0].repairs.find((row) => row.key === method);
    const credits = state.credits,
      parts = state.resilience.parts;
    const result = act(state, 'repairServer', { id: server.id, method });
    assert.equal(result.ok, true, `${method} is a real available intervention`);
    assert.equal(
      credits - state.credits,
      option.cost,
      `${method} charges its displayed amount once`,
    );
    assert.equal(parts - state.resilience.parts, option.parts);
    assert.equal(state.servers[0].status, 'repairing');
    const operation = getResilience(state).operation;
    assert.equal(operation.total, option.duration);
    assert.equal(operation.remaining, option.duration);
    assert.equal(getMetrics(state).onlineServers, 0, 'repair downtime is reflected in metrics');
    const afterStart = structuredClone(state);
    const duplicate = act(state, 'repairServer', { id: server.id, method });
    assert.equal(duplicate.ok, false, 'an active repair cannot be charged twice');
    assert.deepEqual(state, afterStart);
    advance(state, option.duration);
    assert.equal(state.servers[0].status, 'online');
    assert.equal(state.servers[0].fault, null);
    assert.equal(
      state.servers[0].condition,
      option.condition,
      'repair reaches its quoted condition without an unquoted loss on the completion step',
    );
    outcomes[method] = state.servers[0].condition;
  }
  assert.ok(outcomes.overhaul > outcomes.patch);
  assert.ok(
    outcomes.patch > outcomes.manual,
    'free manual recovery stays a slower, lower-quality fallback',
  );
});

test('invalid resilience actions preserve the complete save and upgrades cannot bypass downtime', () => {
  const state = createState(1105);
  state.credits = 10000;
  state.policies.reserve = 0;
  state.servers[0].condition = 40;
  state.servers[0].status = 'failed';
  state.servers[0].fault = 'Hardwarefehler';
  const cases = [
    ['repairServer', { id: 'missing', method: 'patch' }],
    ['repairServer', { id: state.servers[0].id, method: 'turbo' }],
    ['resolveIncident', { id: 'missing', choice: 'manual' }],
  ];
  for (const [action, payload] of cases) {
    const before = structuredClone(state);
    assert.equal(act(state, action, payload).ok, false);
    assert.deepEqual(state, before, `${action} failure is mutation-free`);
  }
  const price = cost(state, 'serverUpgrade', state.servers[0].id);
  const before = structuredClone(state);
  assert.equal(act(state, 'upgradeServer', { id: state.servers[0].id }).ok, false);
  assert.deepEqual(state, before, 'a failed server cannot be upgraded instead of repaired');
  assert.ok(price > 0);
});

test('manual backup is bounded by cooldown, operation lock, funds, and snapshot asset preservation', () => {
  const state = createState(1106);
  state.lab.owned = ['network-fabric'];
  state.credits = 10000;
  state.research = 321;
  state.policies.reserve = 0;
  state.policies.autobackup = false;
  for (const job of state.jobs) {
    job.totalWork = 1e8;
    job.work = 1200;
  }
  const quote = getResilience(state).backup;
  assertOptionShape(quote, 'backup');
  const beforeCredits = state.credits;
  assert.equal(act(state, 'createBackup', {}).ok, true);
  assert.equal(beforeCredits - state.credits, quote.cost);
  assert.equal(getResilience(state).operation.total, quote.duration);
  const during = structuredClone(state);
  assert.equal(
    act(state, 'createBackup', {}).ok,
    false,
    'a second backup cannot overlap the first',
  );
  assert.deepEqual(state, during);
  advance(state, quote.duration);
  const protectedResearch = getResilience(state).backupProtectedResearch;
  const protectedJobs = state.resilience.backup.jobs.map((job) => ({ ...job }));
  assert.equal(protectedResearch, state.research);
  assert.equal(sumSnapshotWork(state.resilience.backup), sumWork(state));
  assert.ok(getResilience(state).backupCooldown > 0);
  const price = cost(state, 'research', 'routing');
  assert.equal(act(state, 'buyResearch', { id: 'routing' }).ok, true);
  assert.equal(
    getResilience(state).backupProtectedResearch,
    Math.max(0, protectedResearch - price),
    'a purchase debits what the older snapshot can protect',
  );
  assert.equal(state.resilience.backup.jobs.length, protectedJobs.length);
  assert.equal(state.resilience.backup.jobs[0].work, protectedJobs[0].work);
  const afterPurchase = structuredClone(state);
  assert.equal(
    act(state, 'createBackup', {}).ok,
    false,
    'cooldown prevents overwriting the snapshot',
  );
  assert.deepEqual(state, afterPurchase);
  finiteTree(normalizeState(JSON.parse(JSON.stringify(state))), 'v2 backup roundtrip');
});

test('parts bundle cost, actual quantity, and storage cap agree without duplicate purchases', () => {
  const state = createState(1107);
  state.credits = 10000;
  state.policies.reserve = 0;
  state.resilience.parts = 17;
  const option = getResilience(state).partsPurchase;
  assertOptionShape(option, 'parts purchase');
  assert.equal(option.parts, 3);
  const beforeCredits = state.credits;
  assert.equal(act(state, 'buyParts', {}).ok, true);
  assert.equal(state.credits, beforeCredits - option.cost);
  assert.equal(state.resilience.parts, 17, 'a paid delivery does not arrive immediately');
  const full = getResilience(state).partsPurchase;
  assert.equal(full.enabled, false);
  assert.ok(full.reason.length > 5);
  const before = structuredClone(state);
  assert.equal(act(state, 'buyParts', {}).ok, false);
  assert.deepEqual(state, before, 'a full parts store cannot charge again');
  state.resilience.graceUntil = 1e9;
  advance(state, 1800);
  assert.equal(state.resilience.parts, 20);
});

test('poor condition and performance raise transparent per-hour risk; equal seeds replay long runs identically', () => {
  const healthy = createState(1108);
  const exposed = structuredClone(healthy);
  exposed.policies.power = 'performance';
  exposed.policies.autorepair = false;
  exposed.resilience.graceUntil = exposed.time;
  for (const server of exposed.servers) {
    server.condition = 20;
    server.mode = 'performance';
  }
  assert.ok(getResilience(exposed).riskPerHour > getResilience(healthy).riskPerHour);
  const left = structuredClone(exposed);
  const right = structuredClone(exposed);
  const resultLeft = advance(left, 43200);
  const resultRight = advance(right, 43200);
  assert.deepEqual(resultLeft, resultRight);
  assert.deepEqual(left, right, 'seeded risk and consequences are reproducible');
  assert.equal(resultLeft.seconds, 43200);
  finiteTree(left, '12h exposed network');
  assertQueueBounds(left);
  assert.ok(left.credits >= 0 && left.research >= 0 && left.reputation >= 0);
});

test('one major crisis latches containment for 12 hours without repeating damage or rewards', () => {
  const state = incidentFixture('power');
  const resilience = getResilience(state);
  const incident = structuredClone(resilience.incident);
  assert.equal(resilience.safetyMode, true);
  assert.equal(getMetrics(state).workPerSecond, 0);
  const damaged = Object.fromEntries(state.servers.map((server) => [server.id, server.condition]));
  const jobs = Object.fromEntries(state.jobs.map((job) => [job.id, job.work]));
  const counters = structuredClone(state.counters);
  const criticalEntries = state.log.filter(
    (entry) => entry.type === 'critical' && entry.message.includes(incident.title),
  ).length;
  const first = advance(state, 43200);
  assert.equal(first.seconds, 43200);
  assert.deepEqual(
    getResilience(state).incident,
    incident,
    'the decision remains pending until chosen',
  );
  assert.deepEqual(
    Object.fromEntries(state.servers.map((server) => [server.id, server.condition])),
    damaged,
    'containment stops additional wear',
  );
  assert.deepEqual(
    Object.fromEntries(state.jobs.map((job) => [job.id, job.work])),
    jobs,
    'jobs wait safely during containment',
  );
  assert.deepEqual(
    state.counters,
    counters,
    'an unattended incident grants no repeated completion or event effects',
  );
  assert.equal(
    state.log.filter((entry) => entry.type === 'critical' && entry.message.includes(incident.title))
      .length,
    criticalEntries,
  );
  assert.equal(getResilience(state).incident.id, incident.id);
  finiteTree(state, 'contained network');
});

test('major crisis choices quote the consequences that are actually charged and applied', () => {
  const kinds = ['power', 'cooling', 'corruption'];
  for (const kind of kinds) {
    const base = incidentFixture(kind, kind === 'corruption');
    const incident = getResilience(base).incident;
    assert.ok(incident, `${kind} incident is present`);
    assert.ok(incident.choices.length >= 2, `${kind} incident presents meaningful alternatives`);
    const outcomes = new Set();
    for (const quote of incident.choices) {
      assertOptionShape(quote, `${kind}/${quote.key}`);
      assert.ok(
        quote.description.includes(String(quote.duration)),
        'description quotes its duration',
      );
      assert.ok(
        quote.description.includes(String(quote.condition)),
        'description quotes the resulting condition',
      );
      assert.ok(quote.description.includes(String(quote.cost)), 'description quotes its cost');
      if (quote.researchLoss > 0)
        assert.ok(
          quote.description.includes(quote.researchLoss.toFixed(1)),
          'description discloses the exact research loss',
        );
      if (quote.workLoss > 0)
        assert.ok(
          quote.description.includes(quote.workLoss.toFixed(1)),
          'description discloses the exact work loss',
        );
      if (quote.reputationLoss > 0)
        assert.ok(
          quote.description.includes(String(quote.reputationLoss)),
          'description discloses reputation loss',
        );
      if (!quote.enabled) continue;
      const state = structuredClone(base);
      state.credits = Math.max(state.credits, quote.cost + state.policies.reserve + 1000);
      state.resilience.parts = Math.max(state.resilience.parts, quote.parts);
      const credits = state.credits,
        parts = state.resilience.parts;
      const workBefore = sumWork(state),
        researchBefore = state.research;
      const result = act(state, 'resolveIncident', { id: incident.id, choice: quote.key });
      assert.equal(result.ok, true);
      assert.equal(
        credits - state.credits,
        quote.cost,
        `${kind}/${quote.key} charges its quote once`,
      );
      assert.equal(parts - state.resilience.parts, quote.parts);
      const operation = getResilience(state).operation;
      assert.equal(operation.total, quote.duration);
      assert.equal(
        getResilience(state).incident.id,
        incident.id,
        'containment remains until work finishes',
      );
      const afterChoice = structuredClone(state);
      assert.equal(
        act(state, 'resolveIncident', { id: incident.id, choice: quote.key }).ok,
        false,
        'the same choice cannot be charged twice',
      );
      assert.deepEqual(state, afterChoice);
      advance(state, quote.duration);
      assert.equal(getResilience(state).incident, null);
      assert.equal(getResilience(state).operation, null);
      assert.ok(
        state.servers
          .filter((server) => incident.affected.includes(server.id))
          .every((server) => server.status === 'online' && server.condition === quote.condition),
        'resolves affected nodes to the quoted condition',
      );
      const actualWorkLoss = workBefore - sumWork(state);
      const actualResearchLoss = researchBefore - state.research;
      if (kind !== 'corruption' || quote.key !== 'restore_backup') {
        assert.ok(
          Math.abs(actualWorkLoss - quote.workLoss) < 1e-6,
          `${kind}/${quote.key} work loss matches preview`,
        );
      }
      if (kind === 'corruption') {
        assert.ok(
          Math.abs(actualResearchLoss - quote.researchLoss) < 1e-6,
          `${kind}/${quote.key} research loss matches preview`,
        );
      }
      outcomes.add(
        [
          quote.cost,
          quote.duration,
          quote.condition,
          quote.workLoss,
          quote.researchLoss,
          quote.reputationLoss,
        ].join('/'),
      );
    }
    assert.ok(outcomes.size >= 2, `${kind} choices have distinct outcomes`);
  }
});

test('each major crisis has a free manual escape even with no credits or parts', () => {
  for (const kind of ['power', 'cooling', 'corruption']) {
    const state = incidentFixture(kind, kind === 'corruption');
    state.credits = 0;
    state.policies.reserve = 5000;
    state.resilience.parts = 0;
    const manual = getResilience(state).incident.choices.find((option) => option.key === 'manual');
    assert.ok(manual, `${kind} has a manual fallback`);
    assert.equal(manual.cost, 0);
    assert.equal(manual.parts, 0);
    assert.ok(manual.enabled, `${kind} manual escape stays available without funds`);
    const result = act(state, 'resolveIncident', {
      id: state.resilience.incident.id,
      choice: manual.key,
    });
    assert.equal(result.ok, true);
    assert.equal(state.credits, 0);
    advance(state, manual.duration);
    assert.equal(getResilience(state).incident, null);
    assert.ok(getResilience(state).online > 0, 'manual path restores at least one usable node');
    assert.ok(state.credits >= 0);
  }
});

test('corruption recovery shows missing and stale snapshot losses; restore uses protected snapshot data without reviving spent research', () => {
  const missing = incidentFixture('corruption', false);
  const restoreUnavailable = getResilience(missing).incident.choices.find(
    (option) => option.key === 'restore_backup',
  );
  assert.equal(restoreUnavailable.enabled, false);
  assert.ok(restoreUnavailable.reason.includes('Betriebssicherung'));
  const rebuild = getResilience(missing).incident.choices.find(
    (option) => option.key === 'rebuild',
  );
  const manual = getResilience(missing).incident.choices.find((option) => option.key === 'manual');
  assert.ok(rebuild.researchLoss > 0 && rebuild.workLoss > 0);
  assert.ok(manual.researchLoss > rebuild.researchLoss);
  assert.ok(manual.workLoss > rebuild.workLoss);

  const state = incidentFixture('corruption', true);
  const backup = structuredClone(state.resilience.backup);
  assert.ok(
    backup.protectedResearch < backup.research,
    'a purchase after backup reduced protected research',
  );
  assert.ok(backup.jobs[0].work > 0);
  for (const job of state.jobs) job.work = 0; // Model the current working copy after the integrity failure.
  state.research = 0;
  const normalized = normalizeState(JSON.parse(JSON.stringify(state)));
  const quote = getResilience(normalized).incident.choices.find(
    (option) => option.key === 'restore_backup',
  );
  assert.ok(quote.enabled);
  assert.ok(
    quote.workRestore > 0,
    'preview shows saved work that the damaged working copy no longer has',
  );
  assert.ok(quote.researchRestore > 0, 'preview shows the remaining protected research');
  const credits = normalized.credits;
  assert.equal(
    act(normalized, 'resolveIncident', {
      id: normalized.resilience.incident.id,
      choice: 'restore_backup',
    }).ok,
    true,
  );
  assert.equal(credits - normalized.credits, quote.cost);
  advance(normalized, quote.duration);
  assert.equal(
    normalized.research,
    backup.protectedResearch,
    'restore does not regrant research already spent after the snapshot',
  );
  assert.equal(
    sumWork(normalized),
    sumSnapshotWork(backup),
    'restore recovers saved work instead of clamping it to the corrupted zero',
  );
  assert.equal(
    normalized.upgrades.routing,
    1,
    'already purchased infrastructure research is not rolled back',
  );
  assert.equal(
    normalized.counters.jobs,
    state.counters.jobs,
    'restore cannot repeat completed-job counters',
  );
  assert.equal(
    normalized.credits,
    credits - quote.cost + (normalized.credits - (credits - quote.cost)),
    'the restoration itself does not replace credits or completed rewards',
  );
});

test('automatic repairs respect the hourly budget, cash reserve, parts, and cannot reset spending by toggling policy', () => {
  const state = createState(1110);
  state.credits = 10000;
  state.policies.repairBudget = 100;
  state.policies.reserve = 250;
  state.policies.autorepair = true;
  state.policies.autobackup = false;
  state.resilience.parts = 3;
  state.resilience.graceUntil = 1e6;
  const extra = {
    ...structuredClone(state.servers[0]),
    id: 'server-auto-2',
    name: 'Reserve Node',
    unit: 3,
    port: 2,
    condition: 55,
    status: 'failed',
    fault: 'Hardwarefehler',
  };
  state.servers[0].condition = 55;
  state.servers[0].status = 'failed';
  state.servers[0].fault = 'Hardwarefehler';
  state.servers.push(extra);
  const normalized = normalizeState(state);
  const firstCost = getResilience(normalized).servers[0].repairs.find(
    (option) => option.key === 'patch',
  ).cost;
  assert.ok(firstCost <= normalized.policies.repairBudget);
  assert.equal(normalized.credits - firstCost >= normalized.policies.reserve, true);
  advance(normalized, 1);
  assert.ok(
    getResilience(normalized).operation,
    'eligible failed hardware is automatically repaired',
  );
  assert.ok(getResilience(normalized).spent > 0);
  assert.ok(getResilience(normalized).spent <= normalized.policies.repairBudget);
  assert.ok(normalized.credits >= normalized.policies.reserve);
  const spent = normalized.resilience.budgetSpent;
  assert.equal(act(normalized, 'setPolicy', { key: 'repairBudget', value: 1000 }).ok, true);
  assert.equal(act(normalized, 'setPolicy', { key: 'repairBudget', value: 0 }).ok, true);
  assert.equal(act(normalized, 'setPolicy', { key: 'repairBudget', value: 100 }).ok, true);
  assert.equal(
    normalized.resilience.budgetSpent,
    spent,
    'changing settings cannot reset the current-hour spend',
  );
  advance(normalized, getResilience(normalized).operation.remaining);
  advance(normalized, 1);
  assert.ok(
    normalized.resilience.budgetSpent <= 100,
    'a second intervention cannot exceed the hourly cap',
  );
  assert.ok(normalized.credits >= normalized.policies.reserve);

  const constrained = createState(1111);
  constrained.credits = 300;
  constrained.policies.reserve = 250;
  constrained.policies.repairBudget = 1000;
  constrained.policies.autobackup = false;
  constrained.servers[0].condition = 55;
  constrained.servers[0].status = 'failed';
  constrained.servers[0].fault = 'Hardwarefehler';
  const blockedQuote = getResilience(constrained).servers[0].repairs.find(
    (option) => option.key === 'patch',
  );
  assert.equal(
    blockedQuote.enabled,
    true,
    'manual repair can use credits protected only from automation',
  );
  advance(constrained, 10);
  assert.equal(getResilience(constrained).operation, null);
  assert.equal(constrained.resilience.budgetSpent, 0);
  assert.ok(constrained.credits >= constrained.policies.reserve);
  const manual = structuredClone(constrained);
  const manualQuote = getResilience(manual).servers[0].repairs.find(
    (option) => option.key === 'patch',
  );
  const manualCredits = manual.credits;
  assert.equal(act(manual, 'repairServer', { id: manual.servers[0].id, method: 'patch' }).ok, true);
  assert.equal(manualCredits - manual.credits, manualQuote.cost);
  assert.ok(
    manual.credits < manual.policies.reserve,
    'a chosen manual repair may spend into the reserve',
  );
  assert.equal(getResilience(manual).operation.kind, 'repair');
});

test('automatic backup policy also stays above reserve and includes its spend in the hourly budget', () => {
  const state = createState(1112);
  state.policies.autobackup = true;
  state.policies.repairBudget = 300;
  state.policies.reserve = 250;
  state.resilience.autoBackupNextAt = 0;
  state.credits = state.policies.reserve + getResilience(state).backup.cost - 1;
  const option = getResilience(state).backup;
  assert.equal(
    option.enabled,
    true,
    'manual backup remains available when total credits cover it, even below reserve',
  );
  advance(state, 1);
  assert.equal(getResilience(state).operation, null);
  assert.equal(
    getResilience(state).backupAt,
    null,
    'automation cannot spend from the protected reserve',
  );
  assert.equal(getResilience(state).parts, 3);
  assert.equal(getResilience(state).spent, 0);
  assert.ok(
    state.credits >= state.policies.reserve,
    'passive income may increase funds, but the reserve remains untouched',
  );
});

test('manual backup can spend protected reserve funds while automatic backup preserves them', () => {
  const state = createState(1114);
  state.policies.reserve = 250;
  state.policies.autobackup = false;
  state.credits = state.policies.reserve + getResilience(state).backup.cost - 1;
  const quote = getResilience(state).backup;
  assert.equal(quote.enabled, true);
  const before = state.credits;
  assert.equal(act(state, 'createBackup', {}).ok, true);
  assert.equal(before - state.credits, quote.cost);
  assert.ok(state.credits < state.policies.reserve, 'user-selected backup may use reserve funds');
  assert.equal(getResilience(state).operation.kind, 'backup');
});

test('automatic backups cannot exceed the remaining hourly repair budget', () => {
  const state = createState(1113);
  state.credits = 10000;
  state.policies.reserve = 0;
  state.policies.repairBudget = 100;
  state.policies.autobackup = true;
  state.resilience.autoBackupNextAt = 0;
  state.resilience.graceUntil = 1e9;
  const cost = getResilience(state).backup.cost;
  assert.ok(
    cost > state.policies.repairBudget,
    'fixture has a backup cost above the selected hourly budget',
  );
  advance(state, 1);
  assert.equal(
    getResilience(state).operation,
    null,
    'automation defers a backup it cannot afford from this hour budget',
  );
  assert.equal(getResilience(state).backupAt, null);
  assert.equal(state.resilience.budgetSpent, 0);
  assert.ok(
    state.resilience.autoBackupNextAt > state.time,
    'automation schedules a later retry without resetting budget',
  );
});

function missionReadyState(seed = 1201) {
  const state = createState(seed);
  state.credits = 10000;
  state.policies.autorepair = false;
  state.policies.autobackup = false;
  state.resilience.graceUntil = 1e9;
  for (const job of state.jobs) {
    job.totalWork = 1e9;
    job.work = 0;
  }
  return state;
}

function agentForRole(state, role) {
  let agent = state.agents.find((item) => item.role === role);
  if (!agent) {
    assert.equal(act(state, 'recruitAgent', { role }).ok, true, `fixture recruits ${role}`);
    agent = state.agents.find((item) => item.role === role);
  }
  return agent;
}

test('agent missions quote role bonuses and charge the exact cost while removing that worker from production', () => {
  const cases = [
    ['engineer', 'diagnose', 90],
    ['operator', 'diagnose', 120],
    ['operator', 'optimize', 120],
    ['engineer', 'optimize', 180],
    ['analyst', 'research', 240],
    ['operator', 'research', 300],
  ];
  for (const [role, mission, duration] of cases) {
    const state = missionReadyState(1202);
    const agent = agentForRole(state, role);
    const option = getAgentOperations(state)
      .agents.find((row) => row.id === agent.id)
      .options.find((row) => row.key === mission);
    assert.equal(
      option.duration,
      duration,
      `${role}/${mission} has its role-specific dispatch time`,
    );
    assert.ok(
      option.description.includes(String(option.cost)) &&
        option.description.includes(String(duration)),
    );
    assert.ok(option.description.includes('keine normale Betriebsleistung'));
    const credits = state.credits;
    const before = getMetrics(state);
    assert.equal(act(state, 'dispatchAgent', { id: agent.id, mission }).ok, true);
    assert.equal(credits - state.credits, option.cost);
    assert.equal(agent.assignment.kind, mission);
    assert.ok(
      getMetrics(state).workPerSecond < before.workPerSecond,
      'the dispatched worker leaves normal network output during the mission',
    );
    const loaded = normalizeState(JSON.parse(JSON.stringify(state)));
    assert.deepEqual(
      loaded.agents.find((row) => row.id === agent.id).assignment,
      agent.assignment,
      'save import preserves an in-progress mission',
    );
    assert.deepEqual(
      getAgentOperations(loaded).agents.find((row) => row.id === agent.id).assignment,
      getAgentOperations(state).agents.find((row) => row.id === agent.id).assignment,
    );
  }
});

test('research mission pays its finite advertised reward once and respects cooldown and assigned-agent locks', () => {
  const state = missionReadyState(1203);
  const analyst = state.agents.find((agent) => agent.role === 'analyst');
  const operator = state.agents.find((agent) => agent.role === 'operator');
  const quote = getAgentOperations(state)
    .agents.find((row) => row.id === analyst.id)
    .options.find((row) => row.key === 'research');
  const reward = Math.ceil(
    8 + 18 * analyst.level + (analyst.focus === 'research' ? 6 * analyst.level : 0),
  );
  assert.ok(quote.description.includes(`${reward} Forschungspunkte bei Abschluss.`));
  const startingResearch = state.research;
  assert.equal(act(state, 'dispatchAgent', { id: analyst.id, mission: 'research' }).ok, true);
  const passiveRate = getMetrics(state).researchPerSecond;
  const locked = structuredClone(state);
  for (const [action, payload] of [
    ['upgradeAgent', { id: analyst.id }],
    ['setAgentFocus', { id: analyst.id, focus: 'income' }],
  ]) {
    assert.equal(act(state, action, payload).ok, false, `${action} cannot bypass assignment time`);
    assert.deepEqual(state, locked, `${action} rejection is mutation-free`);
  }
  const competing = getAgentOperations(state)
    .agents.find((row) => row.id === operator.id)
    .options.find((row) => row.key === 'research');
  assert.equal(
    competing.enabled,
    false,
    'a second research mission cannot duplicate the same active benefit',
  );
  assert.equal(act(state, 'dispatchAgent', { id: operator.id, mission: 'research' }).ok, false);
  assert.deepEqual(state, locked, 'duplicate mission rejection does not charge or alter state');
  advance(state, quote.duration);
  assert.equal(analyst.assignment, null);
  assert.equal(analyst.cooldownUntil, state.time + 300);
  assert.ok(
    Math.abs(state.research - startingResearch - (passiveRate * quote.duration + reward)) < 1e-6,
    'mission adds its finite reward once, in addition to ordinary research output from other available workers',
  );
  const cooldownBefore = structuredClone(state);
  assert.equal(act(state, 'dispatchAgent', { id: analyst.id, mission: 'research' }).ok, false);
  assert.deepEqual(state, cooldownBefore, 'cooldown rejection cannot charge twice');
  advance(state, 300);
  assert.equal(getAgentOperations(state).agents.find((row) => row.id === analyst.id).cooldown, 0);
  assert.equal(
    act(state, 'dispatchAgent', { id: analyst.id, mission: 'research' }).ok,
    true,
    'the mission becomes available again when cooldown expires',
  );
});

test('diagnosis and optimization effects have their promised magnitude and duration', () => {
  const diagnosis = missionReadyState(1204);
  const engineer = agentForRole(diagnosis, 'engineer');
  const initialRisk = getMetrics(diagnosis).riskPerHour;
  const diagnose = getAgentOperations(diagnosis)
    .agents.find((row) => row.id === engineer.id)
    .options.find((row) => row.key === 'diagnose');
  assert.equal(act(diagnosis, 'dispatchAgent', { id: engineer.id, mission: 'diagnose' }).ok, true);
  advance(diagnosis, diagnose.duration);
  assert.equal(
    getAgentOperations(diagnosis).effects.find((row) => row.kind === 'diagnose').remaining,
    1200,
  );
  assert.equal(
    getMetrics(diagnosis).riskPerHour,
    Math.max(1, initialRisk - 12),
    'diagnosis reduces risk by 12 percentage points per hour',
  );
  advance(diagnosis, 1200);
  assert.equal(
    getAgentOperations(diagnosis).effects.some((row) => row.kind === 'diagnose'),
    false,
    'risk protection expires after 20 minutes',
  );
  assert.equal(getMetrics(diagnosis).riskPerHour, initialRisk);

  const optimization = missionReadyState(1205);
  const operator = optimization.agents.find((agent) => agent.role === 'operator');
  const optimize = getAgentOperations(optimization)
    .agents.find((row) => row.id === operator.id)
    .options.find((row) => row.key === 'optimize');
  assert.equal(
    act(optimization, 'dispatchAgent', { id: operator.id, mission: 'optimize' }).ok,
    true,
  );
  advance(optimization, optimize.duration);
  const boosted = getMetrics(optimization).workPerSecond;
  const control = structuredClone(optimization);
  control.resilience.agentEffects.optimizeRemaining = 0;
  assert.ok(
    Math.abs(boosted / getMetrics(control).workPerSecond - 1.15) < 1e-12,
    'optimization multiplies throughput by exactly 15%',
  );
  assert.equal(
    getAgentOperations(optimization).effects.find((row) => row.kind === 'optimize').remaining,
    900,
  );
  advance(optimization, 900);
  assert.equal(
    getAgentOperations(optimization).effects.some((row) => row.kind === 'optimize'),
    false,
    'throughput boost expires after 15 minutes',
  );
});

test('major containment pauses assigned missions and blocks new dispatches without losing progress', () => {
  const mission = missionReadyState(1206);
  const operator = mission.agents.find((agent) => agent.role === 'operator');
  assert.equal(act(mission, 'dispatchAgent', { id: operator.id, mission: 'optimize' }).ok, true);
  const latched = incidentFixture('power');
  const pending = structuredClone(latched);
  pending.agents.find((agent) => agent.id === operator.id).assignment = structuredClone(
    operator.assignment,
  );
  pending.agents.find((agent) => agent.id === operator.id).cooldownUntil = operator.cooldownUntil;
  const loaded = normalizeState(JSON.parse(JSON.stringify(pending)));
  const remaining = loaded.agents.find((agent) => agent.id === operator.id).assignment.remaining;
  const model = getAgentOperations(loaded);
  assert.equal(model.paused, true);
  assert.ok(model.pausedReason.length > 5);
  assert.equal(
    model.agents
      .find((row) => row.id === operator.id)
      .options.find((option) => option.key === 'diagnose').enabled,
    false,
  );
  const before = structuredClone(loaded);
  assert.equal(act(loaded, 'dispatchAgent', { id: operator.id, mission: 'diagnose' }).ok, false);
  assert.deepEqual(loaded, before, 'a paused network cannot start another paid mission');
  advance(loaded, 600);
  assert.equal(
    loaded.agents.find((agent) => agent.id === operator.id).assignment.remaining,
    remaining,
    'time in containment does not silently consume the assigned worker mission',
  );
  assert.equal(getAgentOperations(loaded).paused, true);
});

test('save import cannot bypass same-mission exclusivity or stack a mission with its active effect', () => {
  const duplicated = missionReadyState(1207);
  const analyst = duplicated.agents.find((agent) => agent.role === 'analyst');
  assert.equal(act(duplicated, 'dispatchAgent', { id: analyst.id, mission: 'research' }).ok, true);
  const operator = duplicated.agents.find((agent) => agent.role === 'operator');
  operator.assignment = {
    kind: 'research',
    label: 'Forschungsauftrag',
    remaining: 300,
    total: 300,
  };
  assert.throws(
    () => normalizeState(JSON.parse(JSON.stringify(duplicated))),
    /Agenteneffekte|Einsatz|Mission|doppelt|gleichzeitig/i,
    'a crafted imported save cannot schedule two copies of the finite research reward',
  );

  const stacked = missionReadyState(1208);
  const engineer = agentForRole(stacked, 'engineer');
  assert.equal(act(stacked, 'dispatchAgent', { id: engineer.id, mission: 'diagnose' }).ok, true);
  stacked.resilience.agentEffects.diagnoseRemaining = 600;
  assert.throws(
    () => normalizeState(JSON.parse(JSON.stringify(stacked))),
    /Agenteneffekte|Einsatz|Wirkung|Diagnose|gleichzeitig/i,
    'a crafted import cannot combine an unfinished diagnosis with an already-running diagnosis buff',
  );
});
