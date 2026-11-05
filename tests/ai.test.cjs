'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const {
  catalog,
  createState,
  normalizeState,
  getMetrics,
  getRackModel,
  getResilience,
  advance,
  act,
  quoteHardware,
  cost,
} = E;

function ready(seed = 4810) {
  const state = createState(seed);
  state.credits = 1e7;
  state.policies.reserve = 0;
  state.policies.autobackup = false;
  state.policies.autorepair = false;
  state.resilience.graceUntil = 1e9;
  for (const job of state.jobs) job.totalWork = 1e9;
  return state;
}

function aiJob(id, gpuDemand = 1) {
  return {
    id,
    title: 'KI-Inferenz auswerten',
    client: 'KI-Labor',
    kind: 'ai',
    gpuDemand,
    totalWork: 1e6,
    work: 0,
    reward: 600,
    science: 12,
    rep: 3,
    load: 8,
  };
}

function installAI(state, rackId = 'rack-1') {
  const quote = quoteHardware(state, 'buyServer', { type: 'ai', rackId });
  assert.equal(quote.enabled, true, quote.reason);
  const before = state.credits;
  assert.equal(act(state, 'buyServer', { type: 'ai', rackId }).ok, true);
  assert.equal(before - state.credits, quote.cost);
  return state.servers.find((server) => server.type === 'ai');
}

function upgradeSwitch(state, rackId) {
  assert.equal(act(state, 'upgradeRack', { rackId, component: 'switch' }).ok, true);
  advance(state, 45);
}

test('v1/v2 saves still migrate all pre-existing servers, racks, jobs, and backups', () => {
  for (const file of [
    'v1-save.json',
    'v2-save.json',
    'v2-active-crisis-save.json',
    'v2-active-repair-save.json',
  ]) {
    const input = require('./fixtures/' + file);
    const migrated = normalizeState(input);
    assert.equal(migrated.version, 10, file);
    assert.equal(migrated.servers.length, input.servers.length, `${file}: no server lost`);
    assert.deepEqual(
      migrated.servers.map((server) => server.type),
      input.servers.map((server) => server.type),
      `${file}: hardware preserved`,
    );
    assert.ok(migrated.facility.racks.length >= 1, `${file}: rack migration present`);
    assert.ok(
      migrated.jobs.length <= input.jobs.length,
      `${file}: existing jobs retained unless completed before migration`,
    );
  }
});

test('schema-3 saves with all 16 legacy servers and two racks round-trip losslessly', () => {
  const old = ready(4811);
  old.sector = 13;
  old.facility.racks.push({
    id: 'rack-legacy-2',
    name: 'Rack 02',
    roomId: 'room-1',
    switchLevel: 1,
    powerLevel: 2,
    coolingLevel: 2,
    disabledPorts: [8],
    temperature: 29.5,
  });
  const types = [
    ...Array(8).fill('edge'),
    ...Array(5).fill('edge'),
    'compute',
    'compute',
    'storage',
  ];
  const sizes = { edge: 1, compute: 2, storage: 3 },
    units = [2, 2],
    ports = [1, 1];
  old.servers = types.map((type, index) => {
    const rackIndex = index < 8 ? 0 : 1,
      rackId = rackIndex === 0 ? 'rack-1' : 'rack-legacy-2';
    const server = {
      ...old.servers[0],
      id: `server-legacy-${index + 1}`,
      name: `Knoten ${index + 1}`,
      type,
      rackId,
      unit: units[rackIndex],
      port: ports[rackIndex],
    };
    units[rackIndex] += sizes[type];
    ports[rackIndex]++;
    return server;
  });
  old.servers[0].id = 'server-1';
  old.nextId = 100;
  const loaded = normalizeState(structuredClone(old));
  assert.equal(loaded.servers.length, 16);
  assert.equal(loaded.facility.racks.length, 2);
  assert.deepEqual(loaded.servers, old.servers);
  assert.deepEqual(loaded.facility.racks, old.facility.racks);
  assert.equal(loaded.jobs.length, old.jobs.length);
  assert.equal(loaded.offers.length, old.offers.length);
  assert.equal(loaded.facility.racks[1].temperature, 29.5);
  assert.ok(Number.isFinite(getMetrics(loaded).gpuCapacity));
  assert.equal(getMetrics(loaded).serverLimit, 29);
  const rackQuote = quoteHardware(loaded, 'buyRack');
  assert.equal(rackQuote.enabled, true, rackQuote.reason);
  assert.equal(act(loaded, 'buyRack').ok, true);
  const newRack = loaded.facility.racks[2];
  const aiQuote = quoteHardware(loaded, 'buyServer', { type: 'ai', rackId: newRack.id });
  assert.equal(aiQuote.enabled, true, aiQuote.reason);
  assert.equal(act(loaded, 'buyServer', { type: 'ai', rackId: newRack.id }).ok, true);
  assert.equal(
    loaded.servers.length,
    17,
    'a sector 13 network can grow beyond the old fixed 16-server ceiling',
  );
  const roundtrip = normalizeState(structuredClone(loaded));
  assert.equal(roundtrip.servers.length, 17);
  assert.equal(roundtrip.servers.filter((server) => server.type === 'ai').length, 1);
  assert.equal(roundtrip.facility.racks.length, 3);
});

test('ROOT A480 purchase quote reflects the 4U footprint, 4 GPUs, VRAM and 1.5 kW draw', () => {
  assert.equal(catalog.servers.ai.model, 'ROOT A480');
  assert.equal(catalog.servers.ai.units, 4);
  assert.equal(catalog.servers.ai.gpuCount, 4);
  assert.equal(catalog.servers.ai.vramGB, 320);
  assert.equal(catalog.servers.ai.power, 15);
  const state = ready();
  const before = getRackModel(state).racks[0].usedUnits;
  const ai = installAI(state);
  assert.equal(act(state, 'buyServer', { type: 'compute', rackId: ai.rackId }).ok, true);
  const model = getRackModel(state),
    rack = model.racks[0],
    device = rack.servers.find((server) => server.id === ai.id);
  const compute = rack.servers.find((server) => server.type === 'compute');
  assert.equal(rack.usedUnits - before, 6);
  assert.equal(device.units, 4);
  assert.equal(device.gpuCount, 4);
  assert.equal(device.vramGB, 320);
  assert.equal(device.powerW, 1500);
  assert.ok(
    device.networkDemandMbps > compute.networkDemandMbps,
    'AI server demands more network capacity than the compute node',
  );
  assert.equal(model.totalPowerW, rack.powerW);
  assert.equal(getMetrics(state).gpuInstalled, 4);
  assert.ok(
    getMetrics(state).gpuCapacity > 0 && getMetrics(state).gpuCapacity < 4,
    '1 GbE uplink throttles usable GPU capacity',
  );
  assert.equal(cost(state, 'server', 'ai'), quoteHardware(state, 'buyServer', { type: 'ai' }).cost);
});

test('AI jobs require GPU capacity, consume it exclusively, and the catalog offers them only after matching hardware is installed', () => {
  const state = ready();
  const ai = installAI(state);
  upgradeSwitch(state, ai.rackId);
  const first = aiJob('job-gpu-1', 3),
    second = aiJob('job-gpu-2', 2);
  state.offers.push(first, second);
  assert.equal(act(state, 'acceptJob', { id: first.id }).ok, true);
  const rejected = act(state, 'acceptJob', { id: second.id });
  assert.equal(rejected.ok, false);
  assert.match(rejected.message, /GPUs/);
  const metrics = getMetrics(state);
  assert.equal(metrics.gpuCapacity, 4);
  assert.equal(metrics.gpuUsed, 3);
  assert.equal(metrics.gpuLoad, 0.75);

  state.sector = 2;
  state.policies.autocontract = true;
  state.jobs = [state.jobs[0]];
  state.jobs[0].load = 1;
  state.offers = [aiJob('job-auto-3', 3), aiJob('job-auto-2', 2)];
  advance(state, 1);
  const acceptedGpu = state.jobs
    .filter((job) => job.kind === 'ai')
    .reduce((sum, job) => sum + job.gpuDemand, 0);
  assert.ok(
    acceptedGpu <= getMetrics(state).gpuCapacity + 1e-9,
    'automatic contracts do not overbook GPUs',
  );
  assert.ok(
    state.offers.some((job) => job.kind === 'ai'),
    'the GPU-incompatible offer stays available',
  );

  let generated = false;
  for (let i = 0; i < 8 && !generated; i++) {
    advance(state, 75);
    generated = state.offers.some((job) => job.kind === 'ai' && job.gpuDemand <= 4);
  }
  assert.equal(generated, true, 'eligible infrastructure eventually receives an AI offer');
});

test('generated AI offers scale work, reward and science with GPU demand, with a modest reward-per-work bonus', () => {
  const state = ready(4812);
  installAI(state);
  state.sector = 2;
  const classes = new Map([1, 2, 3, 4].map((demand) => [demand, []]));
  for (let i = 0; i < 400 && [...classes.values()].some((rows) => rows.length < 3); i++) {
    state.offers = [];
    state.timers.offer = 0;
    advance(state, 1);
    for (const offer of state.offers)
      if (offer.kind === 'ai' && classes.has(offer.gpuDemand))
        classes.get(offer.gpuDemand).push(offer);
  }
  const mean = (rows, field) => rows.reduce((sum, row) => sum + row[field], 0) / rows.length;
  const stats = [1, 2, 3, 4].map((demand) => {
    const rows = classes.get(demand);
    assert.ok(rows.length >= 3, `generated offers include demand ${demand}`);
    return {
      work: mean(rows, 'totalWork'),
      reward: mean(rows, 'reward'),
      science: mean(rows, 'science'),
      ratio: mean(
        rows.map((row) => ({ value: row.reward / row.totalWork })),
        'value',
      ),
    };
  });
  for (let index = 1; index < stats.length; index++) {
    assert.ok(stats[index].work > stats[index - 1].work, 'higher GPU demand has a larger workload');
    assert.ok(stats[index].reward > stats[index - 1].reward, 'higher GPU demand pays more credits');
    assert.ok(
      stats[index].science > stats[index - 1].science,
      'higher GPU demand yields more research',
    );
    const bonusStep = stats[index].ratio / stats[index - 1].ratio;
    assert.ok(bonusStep > 1.07 && bonusStep < 1.17, 'reward per work rises by a modest step');
  }
});

test('rack status explains a GPU bottleneck at a port even with spare uplink capacity', () => {
  const state = ready();
  act(state, 'buyRack');
  const ai = installAI(state, state.facility.racks[1].id);
  state.jobs = [aiJob('job-port-limit', 4)];
  state.jobs[0].load = 8;
  let rack = getRackModel(state).racks.find((r) => r.id === ai.rackId);
  assert.ok(rack.networkDemandMbps < rack.uplinkMbps, 'uplink still has spare capacity');
  assert.ok(getMetrics(state).gpuCapacity < 4, 'port limits effective GPUs');
  assert.equal(rack.status, 'limited');
  assert.ok(rack.warnings.some((w) => w.includes('Switch-Port')));
  upgradeSwitch(state, ai.rackId);
  rack = getRackModel(state).racks.find((r) => r.id === ai.rackId);
  assert.equal(rack.status, 'online');
  assert.equal(getMetrics(state).gpuCapacity, 4);
});

test('AI jobs pause on power, port and rack maintenance, resume after recovery, and CPU jobs keep working', () => {
  const state = ready();
  const secondRackQuote = quoteHardware(state, 'buyRack');
  assert.equal(secondRackQuote.enabled, true);
  assert.equal(act(state, 'buyRack').ok, true);
  const ai = installAI(state, state.facility.racks[1].id);
  upgradeSwitch(state, ai.rackId);
  const gpuJob = aiJob('job-gpu-life', 1);
  const cpuJob = { ...state.jobs[0], id: 'job-cpu-life', work: 0, totalWork: 1e6, load: 1 };
  state.jobs = [cpuJob, gpuJob];
  advance(state, 10);
  assert.ok(gpuJob.work > 0);

  assert.equal(act(state, 'setServerPower', { id: ai.id, on: false }).ok, true);
  const pausedAt = gpuJob.work,
    cpuAt = cpuJob.work;
  advance(state, 10);
  assert.equal(gpuJob.work, pausedAt);
  assert.ok(cpuJob.work > cpuAt);
  assert.match(getMetrics(state).jobBlockedReasons[gpuJob.id], /ausgeschaltet/);
  assert.equal(act(state, 'setServerPower', { id: ai.id, on: true }).ok, true);
  advance(state, 31);
  const bootedAt = gpuJob.work;
  assert.ok(bootedAt > pausedAt);

  assert.equal(
    act(state, 'setSwitchPort', { rackId: ai.rackId, port: ai.port, enabled: false }).ok,
    true,
  );
  advance(state, 8);
  assert.equal(gpuJob.work, bootedAt);
  assert.ok(cpuJob.work > cpuAt);
  assert.equal(
    act(state, 'setSwitchPort', { rackId: ai.rackId, port: ai.port, enabled: true }).ok,
    true,
  );
  advance(state, 8);
  assert.ok(gpuJob.work > bootedAt);

  const coolingQuote = quoteHardware(state, 'upgradeRack', {
    rackId: ai.rackId,
    component: 'cooling',
  });
  assert.equal(coolingQuote.enabled, true);
  assert.equal(act(state, 'upgradeRack', { rackId: ai.rackId, component: 'cooling' }).ok, true);
  const maintAt = gpuJob.work,
    cpuBeforeMaintenance = cpuJob.work;
  assert.match(getMetrics(state).jobBlockedReasons[gpuJob.id], /Rack-Wartung/);
  advance(state, coolingQuote.duration);
  advance(state, 1);
  assert.ok(gpuJob.work > maintAt);
  assert.ok(cpuJob.work > cpuBeforeMaintenance, 'CPU-only work continues in the other rack');

  ai.status = 'failed';
  ai.fault = 'Hardwarefehler';
  ai.condition = 20;
  const failedAt = gpuJob.work;
  advance(state, 5);
  assert.equal(gpuJob.work, failedAt);
  assert.match(getMetrics(state).jobBlockedReasons[gpuJob.id], /ausgefallen/);
  const repair = getResilience(state)
    .servers.find((row) => row.id === ai.id)
    .repairs.find((option) => option.key === 'patch');
  assert.equal(repair.enabled, true, repair.reason);
  assert.equal(act(state, 'repairServer', { id: ai.id, method: 'patch' }).ok, true);
  advance(state, repair.duration);
  advance(state, 5);
  assert.ok(gpuJob.work > failedAt, 'GPU work resumes after server repair');
});

test('AI jobs, in-progress work and backup references survive schema-3 save/load', () => {
  const state = ready();
  const ai = installAI(state);
  upgradeSwitch(state, ai.rackId);
  const job = aiJob('job-saved-ai', 2);
  state.jobs.push(job);
  advance(state, 12);
  assert.ok(job.work > 0);
  const backupQuote = getResilience(state).backup;
  assert.equal(backupQuote.enabled, true, backupQuote.reason);
  assert.equal(act(state, 'createBackup').ok, true);
  advance(state, backupQuote.duration);
  const loaded = normalizeState(structuredClone(state));
  const loadedJob = loaded.jobs.find((row) => row.id === job.id);
  assert.equal(loadedJob.kind, 'ai');
  assert.equal(loadedJob.gpuDemand, 2);
  assert.equal(loadedJob.work, job.work);
  assert.ok(
    loaded.resilience.backup.jobs.some((row) => row.id === job.id && row.work === job.work),
  );
  assert.equal(getMetrics(loaded).gpuInstalled, 4);
  const missingDemand = structuredClone(loaded);
  delete missingDemand.jobs.find((row) => row.id === job.id).gpuDemand;
  assert.equal(
    normalizeState(missingDemand).jobs.find((row) => row.id === job.id).gpuDemand,
    1,
    'optional demand has a compatible default',
  );
  for (const invalidDemand of [0, 1.5, 5]) {
    const invalid = structuredClone(loaded);
    invalid.jobs.find((row) => row.id === job.id).gpuDemand = invalidDemand;
    assert.throws(() => normalizeState(invalid), /GPU-Bedarf/);
  }
});
