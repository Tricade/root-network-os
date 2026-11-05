'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const enginePath = path.join(__dirname, '..', 'engine.js');
const {
  catalog,
  createState,
  normalizeState,
  getMetrics,
  getResilience,
  advance,
  act,
  cost,
} = require(enginePath);

function finiteTree(value, label = 'state', seen = new Set()) {
  if (typeof value === 'number')
    assert.ok(Number.isFinite(value), `${label} should be finite, got ${value}`);
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) value.forEach((v, i) => finiteTree(v, `${label}[${i}]`, seen));
  else for (const [key, child] of Object.entries(value)) finiteTree(child, `${label}.${key}`, seen);
}

function assertQueueBounds(state) {
  assert.ok(state.history.length <= 60, 'history remains bounded at 60');
  assert.ok(state.log.length <= 80, 'log remains bounded at 80');
  assert.ok(state.events.length <= 3, 'events remain bounded at 3');
  assert.ok(state.offers.length <= 6, 'offers remain bounded at 6');
  assert.ok(state.agents.length <= 12, 'agents remain bounded at 12');
  assert.ok(state.servers.length <= 16, 'servers remain bounded at 16');
}

test('catalog, initial state, and exported engine API match the ROOT contract', () => {
  for (const name of [
    'catalog',
    'createState',
    'normalizeState',
    'getMetrics',
    'getResilience',
    'getAgentOperations',
    'getRackModel',
    'quoteHardware',
    'advance',
    'act',
    'cost',
  ]) {
    assert.ok(name in require(enginePath), `exports ${name}`);
  }
  assert.deepEqual(Object.keys(catalog.servers).sort(), ['ai', 'compute', 'edge', 'storage']);
  assert.deepEqual(Object.keys(catalog.roles).sort(), ['analyst', 'engineer', 'operator']);
  for (const id of ['edge', 'compute', 'storage', 'ai']) {
    assert.ok(Number.isFinite(catalog.servers[id].baseCost) && catalog.servers[id].baseCost > 0);
  }
  const state = createState(12345);
  assert.equal(state.version, 11);
  assert.equal(state.seed, 12345);
  assert.ok(state.servers.length >= 1);
  assert.ok(state.agents.length >= 2);
  assert.ok(state.jobs.length >= 1);
  assert.ok(state.credits >= 800);
  assert.ok(Number.isFinite(state.savedAt));
  assertQueueBounds(state);
  finiteTree(state);
});

test('seeded creation and equal simulation inputs are reproducible', () => {
  const initialA = createState(517),
    initialB = createState(517),
    differentSeed = createState(518);
  initialA.savedAt = initialB.savedAt = differentSeed.savedAt = 0;
  assert.deepEqual(initialA, initialB);
  assert.notDeepEqual(initialA, differentSeed);
  const a = createState(91);
  const b = createState(91);
  a.savedAt = b.savedAt = 0;
  const resultA = advance(a, 3600);
  const resultB = advance(b, 3600);
  assert.deepEqual(a, b);
  assert.deepEqual(resultA, resultB);
});

test('simulation clamps negative and excessive elapsed time, stays finite, and bounds queues', () => {
  const state = createState(22);
  const before = state.time;
  const negative = advance(state, -500);
  assert.equal(negative.seconds, 0);
  assert.equal(state.time, before);
  const result = advance(state, 1e12);
  assert.equal(result.seconds, 43200, 'offline catch-up is capped at 12 hours');
  assert.equal(state.time, before + 43200);
  finiteTree(state);
  assertQueueBounds(state);
  assert.ok(state.credits >= 0 && state.research >= 0 && state.reputation >= 0);
});

test('malformed and unsupported save versions are rejected; normalization is isolated and strips unknown fields', () => {
  assert.throws(() => normalizeState(null));
  assert.throws(() => normalizeState({ version: 999 }));
  assert.throws(
    () => normalizeState({ ...createState(1), credits: 'corrupt' }),
    /Ungültiger|Ungultiger/i,
  );
  assert.throws(() => normalizeState({ ...createState(1), jobs: 'not-an-array' }));
  const source = createState(8);
  source.injected = { should: 'not survive' };
  source.servers[0].intruder = 'not survive';
  const normalized = normalizeState(source);
  assert.notStrictEqual(normalized, source);
  assert.equal(Object.hasOwn(normalized, 'injected'), false);
  assert.equal(Object.hasOwn(normalized.servers[0], 'intruder'), false);
  assert.equal(Object.hasOwn(source, 'injected'), true, 'normalization does not mutate source');
  finiteTree(normalized);
  assertQueueBounds(normalized);
});

test('invalid actions do not mutate any part of a save', () => {
  const state = createState(3);
  for (const [action, payload] of [
    ['not-a-real-action', {}],
    ['buyServer', { type: 'not-a-server' }],
    ['setServerMode', { id: 'missing', mode: 'turbo' }],
    ['setPolicy', { key: 'not-a-policy', value: 'anything' }],
  ]) {
    const before = structuredClone(state);
    const result = act(state, action, payload);
    assert.equal(result.ok, false, `${action} should be rejected`);
    assert.deepEqual(state, before, `${action} failure must leave state unchanged`);
  }
});

test('completed jobs pay their reward once and then leave the active queue', () => {
  const state = createState(66);
  const job = state.jobs[0];
  const metrics = getMetrics(state);
  job.work = Math.max(0, job.totalWork - metrics.workPerSecond * 0.5);
  const before = {
    credits: state.credits,
    research: state.research,
    reputation: state.reputation,
    completed: state.counters.jobs,
  };
  const first = advance(state, 1);
  assert.equal(
    first.jobsCompleted,
    1,
    'near-finished job completes during the next simulated second',
  );
  assert.equal(state.counters.jobs, before.completed + 1);
  assert.ok(state.credits > before.credits, 'the completion grants credits');
  assert.ok(state.research > before.research, 'the completion grants research');
  assert.ok(state.reputation > before.reputation, 'the completion grants reputation');
  assert.equal(
    state.jobs.some((item) => item.id === job.id),
    false,
    'completed job is removed',
  );
  const later = advance(state, 90);
  assert.equal(later.jobsCompleted, 0, 'the same job cannot complete again');
  assert.equal(
    state.counters.jobs,
    before.completed + 1,
    'completion counter increments exactly once',
  );
});
test('declined or resolved opportunities cannot grant a reward twice', () => {
  const state = createState(12);
  if (state.offers.length) {
    const id = state.offers[0].id;
    const offer = structuredClone(state.offers[0]);
    const before = state.credits;
    const declined = act(state, 'declineJob', { id });
    assert.equal(declined.ok, true);
    assert.equal(state.credits, before, 'declining is not a job reward');
    const again = act(state, 'acceptJob', { id });
    assert.equal(again.ok, false, 'removed offer cannot be accepted after decline');
    assert.deepEqual(offer.id, id);
  }
  const events = createState(73);
  if (events.events.length) {
    const event = events.events[0];
    const id = event.id;
    const choice = 0;
    const result = act(events, 'resolveEvent', { id, choice });
    assert.equal(result.ok, true);
    const afterOnce = structuredClone(events);
    const duplicate = act(events, 'resolveEvent', { id, choice });
    assert.equal(duplicate.ok, false, 'resolved event cannot reward twice');
    assert.deepEqual(events, afterOnce);
  }
});

test('server modes, job priority, and agent focus expose measurable tradeoffs', () => {
  const base = createState(44);
  const serverId = base.servers[0].id;
  const baseMetrics = getMetrics(base);
  const performanceState = structuredClone(base);
  assert.equal(
    act(performanceState, 'setServerMode', { id: serverId, mode: 'performance' }).ok,
    true,
  );
  const performance = getMetrics(performanceState);
  const ecoState = structuredClone(base);
  assert.equal(act(ecoState, 'setServerMode', { id: serverId, mode: 'eco' }).ok, true);
  const eco = getMetrics(ecoState);
  assert.ok(performance.capacity > baseMetrics.capacity);
  assert.ok(performance.power > baseMetrics.power);
  assert.equal(
    performance.heat,
    baseMetrics.heat,
    'a cold rack does not invent heat on a mode change',
  );
  assert.ok(performance.workPerSecond > baseMetrics.workPerSecond);
  assert.ok(eco.capacity < baseMetrics.capacity);
  assert.ok(eco.power < baseMetrics.power);
  assert.equal(eco.heat, baseMetrics.heat);
  assert.ok(eco.workPerSecond < baseMetrics.workPerSecond);

  const focusState = structuredClone(base);
  const analyst = focusState.agents.find((agent) => agent.role === 'analyst');
  const researchFocus = getMetrics(focusState);
  assert.equal(act(focusState, 'setAgentFocus', { id: analyst.id, focus: 'income' }).ok, true);
  const incomeFocus = getMetrics(focusState);
  assert.ok(researchFocus.researchPerSecond > incomeFocus.researchPerSecond);
  assert.ok(researchFocus.workPerSecond < incomeFocus.workPerSecond);

  const priorityState = structuredClone(base);
  const alternate = structuredClone(priorityState.jobs[0]);
  alternate.id = 'test-priority-job';
  alternate.reward *= 8;
  alternate.science = 1;
  priorityState.jobs.push(alternate);
  const incomePriority = structuredClone(priorityState);
  assert.equal(act(incomePriority, 'setPolicy', { key: 'priority', value: 'income' }).ok, true);
  const researchPriority = structuredClone(priorityState);
  assert.equal(act(researchPriority, 'setPolicy', { key: 'priority', value: 'research' }).ok, true);
  assert.ok(
    getMetrics(incomePriority).jobRates[alternate.id] >
      getMetrics(incomePriority).jobRates[priorityState.jobs[0].id],
  );
  assert.ok(
    getMetrics(researchPriority).jobRates[alternate.id] <
      getMetrics(researchPriority).jobRates[priorityState.jobs[0].id],
  );

  const ecoPolicy = structuredClone(base);
  const performancePolicy = structuredClone(base);
  assert.equal(act(ecoPolicy, 'setPolicy', { key: 'power', value: 'eco' }).ok, true);
  assert.equal(
    act(performancePolicy, 'setPolicy', { key: 'power', value: 'performance' }).ok,
    true,
  );
  assert.ok(getMetrics(ecoPolicy).upkeep < baseMetrics.upkeep);
  assert.ok(getMetrics(performancePolicy).upkeep > baseMetrics.upkeep);
  assert.ok(Number.isFinite(cost(base, 'sector')) && cost(base, 'sector') > 0);
  assert.ok(Number.isFinite(cost(base, 'server', 'edge')) && cost(base, 'server', 'edge') > 0);
  assert.ok(Number.isFinite(baseMetrics.incomePerSecond));
});
test('initial network is not softlocked and a sector expansion is reachable through normal operations', () => {
  const state = createState(82);
  state.resilience.graceUntil = 1e9;
  let metrics = getMetrics(state);
  assert.ok(metrics.capacity > 0);
  assert.ok(metrics.serverLimit >= state.servers.length);
  assert.ok(metrics.agentLimit >= state.agents.length);
  assert.ok(metrics.jobLimit >= state.jobs.length);
  assert.ok(metrics.incomePerSecond > 0, 'the network has positive passive net income');
  assert.ok(Number.isFinite(cost(state, 'sector')) && cost(state, 'sector') > 0);

  const firstServer = act(state, 'buyServer', { type: 'edge' });
  assert.equal(firstServer.ok, true, 'the starter balance allows an early infrastructure choice');
  while (state.counters.jobs < 3) {
    if (!state.jobs.length) {
      if (!state.offers.length) advance(state, 300);
      assert.ok(state.offers.length, 'new contracts eventually become available');
      assert.equal(act(state, 'acceptJob', { id: state.offers[0].id }).ok, true);
    }
    const job = state.jobs[0];
    const rate = getMetrics(state).jobRates[job.id];
    job.work = Math.max(0, job.totalWork - rate * 0.5);
    assert.equal(advance(state, 1).jobsCompleted, 1, 'each accepted contract can be completed');
  }

  advance(state, 43200);
  for (let bought = 0; !getMetrics(state).expansionReady && bought < 16; bought++) {
    const result = act(state, 'buyServer', { type: 'edge' });
    assert.equal(result.ok, true, 'passive income funds the servers needed for expansion');
  }
  metrics = getMetrics(state);
  assert.equal(
    metrics.expansionReady,
    true,
    'credits, servers, and three completed jobs unlock expansion',
  );
  const previousSector = state.sector;
  assert.equal(act(state, 'expandSector', {}).ok, true);
  assert.equal(state.sector, previousSector + 1);
  assert.ok(cost(state, 'sector') > 0, 'progression continues with a next-sector target');
  finiteTree(state);
  assertQueueBounds(state);
});

test('purchased server names remain valid strings instead of exposing undefined counter values', () => {
  const state = createState(501);
  state.credits = 10000;
  for (const type of ['compute', 'storage', 'edge']) {
    const result = act(state, 'buyServer', { type });
    assert.equal(result.ok, true);
  }
  for (const server of state.servers) {
    assert.equal(typeof server.name, 'string');
    assert.match(server.name, /\S/);
    assert.doesNotMatch(server.name, /NaN|undefined|null/);
  }
  assert.equal(new Set(state.servers.map((server) => server.id)).size, state.servers.length);
});

test('real active job load produces a finite utilization consistent with used capacity', () => {
  const state = createState(502);
  const job = state.jobs[0];
  const initial = getMetrics(state);
  assert.ok(job.load > 0);
  assert.ok(initial.usedCapacity > 0, 'the active starter job consumes capacity');
  assert.ok(initial.load > 0.005, 'the starter job is visible as nontrivial utilization');
  assert.ok(initial.load < 1);
  assert.ok(Math.abs(initial.load - initial.usedCapacity / initial.capacity) < 1e-12);
  job.work = job.totalWork;
  const loaded = getMetrics(state);
  assert.ok(
    loaded.usedCapacity > job.load,
    'capacity includes customer commitments as well as the active project',
  );
  assert.ok(Math.abs(loaded.load - loaded.usedCapacity / loaded.capacity) < 1e-12);
});

test('global power modes trade higher throughput for higher upkeep and eco savings for slower work', () => {
  const base = createState(503);
  const balanced = getMetrics(base);
  const performanceState = structuredClone(base);
  assert.equal(act(performanceState, 'setPolicy', { key: 'power', value: 'performance' }).ok, true);
  const performance = getMetrics(performanceState);
  const ecoState = structuredClone(base);
  assert.equal(act(ecoState, 'setPolicy', { key: 'power', value: 'eco' }).ok, true);
  const eco = getMetrics(ecoState);
  assert.ok(
    performance.workPerSecond > balanced.workPerSecond,
    'performance mode should speed job work',
  );
  assert.ok(performance.upkeep > balanced.upkeep, 'performance mode should cost more to run');
  assert.ok(eco.upkeep < balanced.upkeep, 'eco mode should save upkeep');
  assert.ok(eco.workPerSecond < balanced.workPerSecond, 'eco mode should slow job work');
});

test('autorepair trades credits for better network condition on a stressed fleet', () => {
  const base = createState(504);
  base.credits = 100000;
  base.servers[0].type = 'compute';
  base.servers[0].level = 10;
  base.servers[0].condition = 80;
  base.servers[0].mode = 'performance';
  base.jobs[0].load = 0.75;
  base.jobs[0].work = base.jobs[0].totalWork;
  base.agents = base.agents.filter((agent) => agent.role !== 'engineer');
  const enabled = normalizeState(base);
  const disabled = normalizeState(base);
  disabled.policies.autorepair = false;
  assert.ok(
    getMetrics(enabled).reliability < 90,
    'fixture starts stressed enough to trigger repairs',
  );
  assert.ok(
    getMetrics(enabled).upkeep > getMetrics(disabled).upkeep,
    'autorepair adds a measurable maintenance cost',
  );
  const beforeCredits = enabled.credits;
  advance(enabled, 1800);
  advance(disabled, 1800);
  assert.ok(
    getMetrics(enabled).reliability > getMetrics(disabled).reliability,
    'autorepair improves reliability',
  );
  assert.ok(
    getMetrics(enabled).upkeep > getMetrics(disabled).upkeep,
    'the maintenance cost remains measurable after simulation',
  );
  assert.ok(
    enabled.credits > 0 && enabled.credits < beforeCredits,
    'an oversized, underutilized fleet spends its reserve instead of printing free income',
  );
});

test('autocontract fills an idle network from real offers and refills completed slots', () => {
  const state = createState(505);
  state.credits = 1e6;
  act(state, 'buyServer', { type: 'compute' });
  state.resilience.graceUntil = 1e9;
  state.jobs = [];
  const initialOffers = new Set(state.offers.map((offer) => offer.id));
  assert.equal(state.jobs.length, 0, 'fixture starts idle with real offers waiting');
  assert.equal(act(state, 'setPolicy', { key: 'autocontract', value: true }).ok, true);
  const limit = Math.min(getMetrics(state).jobLimit, state.agents.length + 1);
  assert.ok(state.jobs.length > 0, 'turning autocontract on fills idle slots immediately');
  assert.ok(
    state.jobs.every((job) => initialOffers.has(job.id)),
    'the first jobs came from real offers',
  );
  for (const job of state.jobs) job.work = 0;
  const observedOffers = new Set();
  for (
    let attempt = 0;
    attempt < 12 && (state.jobs.length < limit || observedOffers.size < limit);
    attempt++
  ) {
    state.timers.offer = 1;
    advance(state, 1);
    for (const offer of state.offers) observedOffers.add(offer.id);
  }
  assert.ok(observedOffers.size >= limit, 'enough real offers arrive for the full job queue');
  assert.equal(state.jobs.length, limit, 'the network operates at its current job limit');
  for (const job of state.jobs) {
    const rate = getMetrics(state).jobRates[job.id];
    job.work = job.totalWork - rate * 0.5;
  }
  const completed = advance(state, 1);
  assert.ok(completed.jobsCompleted > 0);
  assert.equal(
    state.jobs.length,
    limit,
    'completed slots are replenished to the current job limit',
  );
  assert.ok(
    state.jobs.every((job) => initialOffers.has(job.id) || observedOffers.has(job.id)),
    'refills use offers the network actually saw',
  );
  assert.ok(
    state.jobs.length <= getMetrics(state).jobLimit,
    'automatic contracts never oversubscribe slots',
  );
});

test('routing research keeps its advertised +12% benefit at level six', () => {
  const state = createState(506);
  state.research = 100000;
  state.upgrades.routing = 5;
  state.lab.owned = ['network-fabric']; // completed foundation; this case measures the repeatable level
  state.resilience.graceUntil = 1e9;
  state.policies.autobackup = false; // compare steady work rates without an unrelated backup window
  const description = catalog.research.find((item) => item.id === 'routing').description;
  assert.match(description, /12 Prozentpunkte.*Arbeitstempo je Stufe/i);
  const baseRateState = structuredClone(state);
  baseRateState.upgrades.routing = 0;
  const baseRate = getMetrics(baseRateState).workPerSecond;
  const before = getMetrics(state).workPerSecond;
  assert.equal(cost(state, 'research', 'routing') > 0, true);
  assert.equal(act(state, 'buyResearch', { id: 'routing' }).ok, true);
  assert.equal(state.upgrades.routing, 5, 'funding alone does not grant the next level');
  advance(state, state.lab.project.total);
  assert.equal(state.upgrades.routing, 6);
  const after = getMetrics(state).workPerSecond;
  assert.ok(after > before, 'sixth routing level remains mechanically useful');
  assert.ok(
    Math.abs((after - before) / baseRate - 0.12) < 0.005,
    'actual gain matches the advertised 12 percentage points of base work speed',
  );
});
test('generated events offer varied, distinct decisions and never resolve twice', () => {
  const signatures = new Set();
  for (let seed = 1; seed <= 32; seed++) {
    const state = createState(seed * 177);
    state.credits = 10000;
    state.timers.event = 1;
    advance(state, 1);
    const event = state.events[0];
    assert.ok(event, `seed ${seed} should generate an event`);
    assert.ok(event.choices.length >= 2);
    const signature = event.choices.map((choice) => `${choice.key}:${choice.label}`).join('|');
    signatures.add(signature);
    const left = structuredClone(state);
    const right = structuredClone(state);
    const first = act(left, 'resolveEvent', { id: event.id, choice: 0 });
    const second = act(right, 'resolveEvent', { id: event.id, choice: 1 });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.notDeepEqual(
      [left.credits, left.research, left.reputation],
      [right.credits, right.research, right.reputation],
      'each offered choice has a distinct effect',
    );
    const once = structuredClone(left);
    const duplicate = act(left, 'resolveEvent', { id: event.id, choice: 0 });
    assert.equal(duplicate.ok, false);
    assert.deepEqual(left, once, 'a resolved event cannot grant its effect twice');
  }
  assert.ok(
    signatures.size >= 3,
    `expected multiple event choice variants, saw ${signatures.size}`,
  );
});

test('save imports reject or repair nextId collisions before a future ID can duplicate', () => {
  const source = createState(507);
  source.nextId = 1;
  let normalized;
  try {
    normalized = normalizeState(source);
  } catch (error) {
    assert.ok(error instanceof Error, 'rejecting a colliding imported ID counter is valid');
    return;
  }
  const numericSuffixes = [
    ...normalized.servers,
    ...normalized.agents,
    ...normalized.jobs,
    ...normalized.offers,
    ...normalized.events,
    ...normalized.log,
  ].map((item) => Number(item.id.match(/-(\d+)$/)?.[1] || 0));
  assert.ok(
    normalized.nextId > Math.max(0, ...numericSuffixes),
    'normalization repairs a colliding nextId',
  );
  normalized.credits = 100000;
  assert.equal(act(normalized, 'buyServer', { type: 'storage' }).ok, true);
  const allIds = [
    ...normalized.servers,
    ...normalized.agents,
    ...normalized.jobs,
    ...normalized.offers,
    ...normalized.events,
    ...normalized.log,
  ].map((item) => item.id);
  assert.equal(new Set(allIds).size, allIds.length, 'subsequent actions preserve unique IDs');
});

test('extreme imported upgrade levels are rejected or bounded before metrics and resaves can overflow', () => {
  const source = createState(508);
  source.upgrades = {
    routing: 1e6,
    cooling: 1e6,
    market: 1e6,
    automation: 1e6,
    synthesis: 1e6,
    unexpected: 1e99,
  };
  let normalized;
  try {
    normalized = normalizeState(source);
  } catch (error) {
    assert.ok(error instanceof Error, 'rejecting an extreme malformed upgrade save is safe');
    return;
  }
  finiteTree(getMetrics(normalized), 'metrics');
  for (const item of catalog.research) {
    assert.ok(
      Number.isFinite(cost(normalized, 'research', item.id)),
      `${item.id} research price remains finite`,
    );
  }
  const roundTrip = normalizeState(JSON.parse(JSON.stringify(normalized)));
  finiteTree(roundTrip, 'round-trip save');
  finiteTree(getMetrics(roundTrip), 'round-trip metrics');
  for (const item of catalog.research)
    assert.ok(Number.isFinite(cost(roundTrip, 'research', item.id)));
});

test('moderately advanced purchased fleets survive normalization and can keep advancing the frontier', () => {
  const state = createState(509);
  state.credits = 1e6;
  state.research = 1e6;
  state.resilience.graceUntil = 1e9;
  // Complete actual funded projects sequentially; the S1 fleet buys physical
  // cooling rather than depending on the S2 thermal-research prerequisite.
  for (const id of ['network-fabric', 'automation-workflows', 'routing', 'automation']) {
    assert.equal(act(state, 'buyResearch', { id }).ok, true);
    advance(state, state.lab.project.total);
  }
  for (const component of ['power', 'cooling'])
    for (let level = 1; level < 7; level++) {
      assert.equal(
        act(state, 'upgradeRack', { rackId: state.facility.racks[0].id, component }).ok,
        true,
      );
      advance(state, state.facility.operation.total);
    }
  for (const type of ['compute', 'storage', 'edge', 'compute'])
    assert.equal(act(state, 'buyServer', { type }).ok, true);
  for (const role of ['engineer', 'analyst', 'operator'])
    assert.equal(act(state, 'recruitAgent', { role }).ok, true);
  assert.equal(act(state, 'setPolicy', { key: 'autocontract', value: true }).ok, true);
  const loaded = normalizeState(JSON.parse(JSON.stringify(state)));
  loaded.resilience.graceUntil = loaded.time + 43200;
  assert.equal(loaded.servers.length, 5);
  assert.equal(loaded.agents.length, 5);
  assert.equal(loaded.upgrades.routing, 1);
  finiteTree(getMetrics(loaded), 'advanced metrics');
  advance(loaded, 43200);
  assert.ok(
    loaded.counters.jobs >= 3,
    'advanced network completes enough contracts to reach the frontier',
  );
  assert.ok(loaded.credits > 0);
  assert.ok(getMetrics(loaded).expansionReady, 'the purchased fleet can unlock the next sector');
  assert.equal(act(loaded, 'expandSector', {}).ok, true);
  const reloaded = normalizeState(JSON.parse(JSON.stringify(loaded)));
  assert.equal(reloaded.sector, loaded.sector);
  assert.ok(Number.isFinite(getMetrics(reloaded).incomePerSecond));
  advance(reloaded, 3600);
  finiteTree(reloaded, 'advanced frontier state');
  assert.ok(reloaded.sector >= 2);
});

test('a reliability achievement stays unlocked after reliability falls and survives a save roundtrip', () => {
  const damaged = createState(510);
  damaged.credits = 10000;
  damaged.policies.reserve = 0;
  damaged.policies.autorepair = true;
  damaged.policies.autobackup = false;
  damaged.resilience.graceUntil = 1e9;
  for (const job of damaged.jobs) job.totalWork = 1e9;
  damaged.servers[0].condition = 1;
  damaged.achievementUnlocks.steady_network = false;
  const lowReliability = normalizeState(JSON.parse(JSON.stringify(damaged)));
  assert.ok(getMetrics(lowReliability).reliability < 90);
  assert.equal(lowReliability.achievementUnlocks.steady_network, false);

  const overhaul = getResilience(lowReliability).servers[0].repairs.find(
    (option) => option.key === 'overhaul',
  );
  assert.equal(
    act(lowReliability, 'repairServer', { id: lowReliability.servers[0].id, method: 'overhaul' })
      .ok,
    true,
  );
  advance(lowReliability, overhaul.duration);
  assert.ok(getMetrics(lowReliability).reliability >= 90);
  assert.equal(
    lowReliability.achievementUnlocks.steady_network,
    true,
    'reaching the threshold permanently records the unlock',
  );

  lowReliability.servers[0].condition = 1;
  lowReliability.servers[0].status = 'failed';
  lowReliability.servers[0].fault = 'Hardwarefehler';
  assert.ok(
    getMetrics(lowReliability).reliability < 90,
    'the network can later fall below the threshold',
  );
  const loaded = normalizeState(JSON.parse(JSON.stringify(lowReliability)));
  assert.equal(
    loaded.achievementUnlocks.steady_network,
    true,
    'the unlock survives reload even when its live condition no longer holds',
  );
  const beforeCredits = loaded.credits;
  assert.equal(act(loaded, 'claimAchievement', { id: 'steady_network' }).ok, true);
  assert.equal(
    loaded.credits - beforeCredits,
    catalog.achievements.find((item) => item.id === 'steady_network').reward,
  );
  const claimed = structuredClone(loaded);
  assert.equal(act(loaded, 'claimAchievement', { id: 'steady_network' }).ok, false);
  assert.deepEqual(loaded, claimed, 'the unlocked reward cannot be claimed twice');
});
