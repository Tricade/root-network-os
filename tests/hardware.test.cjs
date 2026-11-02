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
  advance,
  act,
  quoteHardware,
} = E;

function ready(seed = 3101) {
  const state = createState(seed);
  state.credits = 1e7;
  state.policies.reserve = 0;
  state.policies.autobackup = false;
  state.policies.autorepair = false;
  state.resilience.graceUntil = 1e9;
  for (const job of state.jobs) job.totalWork = 1e9;
  return state;
}

function quoteFields(q, label) {
  for (const key of ['label', 'description', 'cost', 'duration', 'enabled', 'reason']) {
    assert.ok(Object.hasOwn(q, key), `${label} quote includes ${key}`);
  }
  assert.ok(Number.isFinite(q.cost) && q.cost >= 0);
  assert.ok(Number.isFinite(q.duration) && q.duration >= 0);
  assert.equal(typeof q.description, 'string');
  if (!q.enabled) assert.ok(q.reason.length > 4, `${label} unavailable reason is visible`);
}

function startUpgrade(state, rackId, component) {
  const quote = quoteHardware(state, 'upgradeRack', { rackId, component });
  quoteFields(quote, component);
  assert.equal(quote.enabled, true, `${component} upgrade quote enabled`);
  const beforeCredits = state.credits;
  assert.equal(act(state, 'upgradeRack', { rackId, component }).ok, true);
  assert.equal(beforeCredits - state.credits, quote.cost);
  const operation = state.facility.operation;
  assert.equal(operation.kind, component);
  assert.equal(operation.rackId, rackId);
  assert.equal(operation.total, quote.duration);
  assert.equal(operation.remaining, quote.duration);
  assert.equal(getRackModel(state).racks.find((rack) => rack.id === rackId).status, 'maintenance');
  return quote;
}

test('rack model reports physical footprints, fictional device specifications, real watts, and linked ports', () => {
  const state = createState(3101);
  const model = getRackModel(state);
  for (const field of [
    'rackLimit',
    'buyRack',
    'operation',
    'totalUnits',
    'usedUnits',
    'totalPowerW',
    'totalCoolingW',
    'totalDemandMbps',
    'totalUplinkMbps',
    'networkFactor',
    'racks',
  ]) {
    assert.ok(Object.hasOwn(model, field), `rack model includes ${field}`);
  }
  assert.ok(model.racks.length >= 1);
  assert.equal(model.totalUnits, model.racks.length * 18);
  assert.equal(
    model.racks.reduce((sum, rack) => sum + rack.usedUnits, 0),
    model.usedUnits,
  );
  assert.ok(
    Math.abs(getMetrics(state).power * 1000 - model.totalPowerW) <= 1,
    'displayed kW matches total physical watts',
  );
  assert.equal(
    model.racks.reduce((sum, rack) => sum + rack.powerW, 0),
    model.totalPowerW,
    'rack overhead is included in both rack and facility totals',
  );
  const occupied = new Map();
  for (const server of state.servers) {
    const rack = model.racks.find((row) => row.id === server.rackId);
    const row = rack.servers.find((item) => item.id === server.id);
    assert.ok(row);
    assert.ok(row.unit >= 2 && row.unit + row.units - 1 <= 17, 'server body occupies only U2-U17');
    assert.equal(row.status, 'online');
    assert.equal(row.link, true);
    for (let unit = row.unit; unit < row.unit + row.units; unit++) {
      const key = `${rack.id}:${unit}`;
      assert.equal(occupied.has(key), false, `unit ${unit} is physically unique`);
      occupied.set(key, server.id);
    }
  }
  const specs = {
    edge: { model: 'ROOT R120', units: 1, cores: 8, ramGB: 32, driveBays: 2 },
    compute: { model: 'ROOT C240', units: 2, cores: 24, ramGB: 128, driveBays: 4 },
    storage: { model: 'ROOT S360', units: 3, cores: 12, ramGB: 64, driveBays: 8 },
  };
  for (const server of model.racks.flatMap((rack) => rack.servers)) {
    for (const [field, value] of Object.entries(specs[server.type]))
      assert.equal(server[field], value, `${server.type} ${field}`);
    assert.ok(Number.isFinite(server.storageTB) && server.storageTB > 0);
  }
  const rack = model.racks[0];
  assert.equal(rack.units, 18);
  assert.ok(rack.ports.length >= 8);
  assert.equal(rack.ports[0].serverId, state.servers[0].id);
  assert.equal(rack.ports[0].link, true);
  assert.ok(Number.isFinite(rack.temperature) && rack.temperature >= 22);
  assert.ok(Number.isFinite(rack.uplinkMbps) && rack.uplinkMbps > 0);
});

test('v3 normalization rejects overlapping units, reserved units, duplicate/invalid ports, and unknown racks', () => {
  const base = ready(3102);
  const server = base.servers[0];
  const cloneWith = (mutate) => {
    const state = structuredClone(base);
    mutate(state, state.servers[0]);
    return state;
  };
  const cases = [
    [
      'overlap',
      cloneWith((state) => {
        state.servers[0].unit = 1;
      }),
    ],
    [
      'reserved switch unit',
      cloneWith((state) => {
        state.servers[0].unit = 18;
      }),
    ],
    [
      'fractional unit',
      cloneWith((state) => {
        state.servers[0].unit = 2.5;
      }),
    ],
    [
      'duplicate slot',
      cloneWith((state, first) => {
        state.servers.push({ ...first, id: 'server-qa-2', name: 'Overlap', port: 2 });
      }),
    ],
    [
      'duplicate port',
      cloneWith((state, first) => {
        state.servers.push({ ...first, id: 'server-qa-3', name: 'Port collision', unit: 4 });
      }),
    ],
    [
      'unknown rack',
      cloneWith((state) => {
        state.servers[0].rackId = 'rack-missing';
      }),
    ],
    [
      'out of range port',
      cloneWith((state) => {
        state.servers[0].port = 9;
      }),
    ],
    [
      'fractional port',
      cloneWith((state) => {
        state.servers[0].port = 1.5;
      }),
    ],
    [
      'duplicate disabled port',
      cloneWith((state) => {
        state.facility.racks[0].disabledPorts = [2, 2];
      }),
    ],
    [
      'unknown port disable',
      cloneWith((state) => {
        state.facility.racks[0].disabledPorts = [9];
      }),
    ],
  ];
  for (const [label, invalid] of cases)
    assert.throws(() => normalizeState(invalid), /./, `${label} is not accepted`);
  assert.equal(
    server.rackId,
    base.facility.racks[0].id,
    'fixture construction leaves the original state intact',
  );
});

test('rack purchase and explicit server placement use the same quote and reject occupied spaces without mutation', () => {
  const state = ready(3103);
  const rackQuote = quoteHardware(state, 'buyRack');
  quoteFields(rackQuote, 'rack purchase');
  assert.equal(rackQuote.enabled, true);
  const creditsBeforeRack = state.credits;
  assert.equal(act(state, 'buyRack', {}).ok, true);
  assert.equal(creditsBeforeRack - state.credits, rackQuote.cost);
  const target = state.facility.racks.at(-1);
  assert.equal(target.switchLevel, 1);
  assert.equal(target.powerLevel, 1);
  assert.equal(target.coolingLevel, 1);

  const payload = { type: 'compute', rackId: target.id, unit: 2, port: 1 };
  const serverQuote = quoteHardware(state, 'buyServer', payload);
  quoteFields(serverQuote, 'server placement');
  assert.equal(serverQuote.enabled, true);
  const creditsBeforeServer = state.credits;
  assert.equal(act(state, 'buyServer', payload).ok, true);
  assert.equal(creditsBeforeServer - state.credits, serverQuote.cost);
  const placed = state.servers.at(-1);
  assert.equal(placed.rackId, target.id);
  assert.equal(placed.unit, 2);
  assert.equal(placed.port, 1);
  assert.equal(getRackModel(state).racks.at(-1).servers[0].units, 2);

  const invalid = { type: 'edge', rackId: target.id, unit: 3, port: 2 };
  const blockedQuote = quoteHardware(state, 'buyServer', invalid);
  assert.equal(
    blockedQuote.enabled,
    false,
    'server footprint cannot overlap the installed 2-HE device',
  );
  const before = structuredClone(state);
  assert.equal(act(state, 'buyServer', invalid).ok, false);
  assert.deepEqual(state, before, 'rejected placement does not spend, allocate IDs, or write logs');
  const unavailable = structuredClone(state);
  unavailable.credits = 0;
  const failedQuote = quoteHardware(unavailable, 'buyRack');
  assert.equal(failedQuote.enabled, false);
  const beforeUnavailable = structuredClone(unavailable);
  assert.equal(act(unavailable, 'buyRack', {}).ok, false);
  assert.deepEqual(unavailable, beforeUnavailable);
});

test('legacy buyServer calls first-fit a valid unit and port, and over-budget placement warns before purchase', () => {
  const state = ready(3109);
  for (const type of ['compute', 'storage']) {
    const quote = quoteHardware(state, 'buyServer', { type });
    assert.equal(quote.enabled, true);
    assert.equal(
      act(state, 'buyServer', { type }).ok,
      true,
      'legacy action works without explicit rack coordinates',
    );
  }
  const model = getRackModel(state).racks[0];
  assert.equal(model.servers.find((row) => row.type === 'compute').unit, 3);
  assert.equal(model.servers.find((row) => row.type === 'storage').unit, 5);
  const units = new Set();
  const ports = new Set();
  for (const server of model.servers) {
    for (let unit = server.unit; unit < server.unit + server.units; unit++) {
      assert.equal(units.has(unit), false);
      units.add(unit);
    }
    assert.equal(ports.has(server.port), false);
    ports.add(server.port);
  }

  const stressed = ready(3110);
  for (let index = 0; index < 3; index++)
    assert.equal(act(stressed, 'buyServer', { type: 'compute' }).ok, true);
  const fourth = quoteHardware(stressed, 'buyServer', { type: 'compute' });
  assert.equal(
    fourth.enabled,
    true,
    'the user may accept a physically installable over-budget node',
  );
  assert.ok(
    fourth.warnings?.some((warning) => /Nennleistung|Stromlast|drossel/i.test(warning)),
    'the quote warns before the installation exceeds rack capacity',
  );
  assert.equal(act(stressed, 'buyServer', { type: 'compute' }).ok, true);
  assert.ok(
    getRackModel(stressed).racks[0].warnings.some((warning) =>
      /Nennleistung|Stromlast|drossel/i.test(warning),
    ),
  );
  assert.equal(getRackModel(stressed).racks[0].status, 'limited');
});

test('a disconnected switch port and a powered-off or booting node lose usable capacity and server income', () => {
  const state = ready(3104);
  const server = state.servers[0],
    rack = state.facility.racks.find((item) => item.id === server.rackId);
  const baseMetrics = getMetrics(state),
    baseCounters = structuredClone(state.counters);
  const portBefore = getRackModel(state)
    .racks.find((item) => item.id === rack.id)
    .ports.find((item) => item.number === server.port);
  assert.equal(portBefore.link, true);
  assert.equal(
    act(state, 'setSwitchPort', { rackId: rack.id, port: server.port, enabled: false }).ok,
    true,
  );
  let model = getRackModel(state).racks.find((item) => item.id === rack.id);
  assert.equal(model.ports.find((item) => item.number === server.port).enabled, false);
  assert.equal(model.ports.find((item) => item.number === server.port).link, false);
  assert.equal(model.servers.find((item) => item.id === server.id).status, 'disconnected');
  assert.equal(getMetrics(state).onlineServers, 0);
  assert.equal(getMetrics(state).workPerSecond, 0);
  assert.equal(
    getMetrics(state).incomePerSecond,
    0.08,
    'offline emergency income does not include the disconnected server',
  );
  assert.equal(
    act(state, 'setSwitchPort', { rackId: rack.id, port: server.port, enabled: true }).ok,
    true,
  );

  assert.equal(act(state, 'setServerPower', { id: server.id, on: false }).ok, true);
  assert.equal(server.powered, false);
  assert.equal(getMetrics(state).onlineServers, 0);
  assert.equal(act(state, 'setServerPower', { id: server.id, on: true }).ok, true);
  assert.equal(server.bootRemaining, 30);
  model = getRackModel(state).racks.find((item) => item.id === rack.id);
  assert.equal(model.servers.find((item) => item.id === server.id).status, 'booting');
  assert.equal(model.ports.find((item) => item.number === server.port).link, false);
  assert.equal(getMetrics(state).onlineServers, 0);
  advance(state, 30);
  model = getRackModel(state).racks.find((item) => item.id === rack.id);
  assert.equal(server.bootRemaining, 0);
  assert.equal(model.servers.find((item) => item.id === server.id).status, 'online');
  assert.equal(model.ports.find((item) => item.number === server.port).link, true);
  assert.equal(getMetrics(state).onlineServers, 1);
  assert.deepEqual(
    state.counters,
    baseCounters,
    'power and port toggles grant no contract or infrastructure rewards',
  );
  assert.ok(
    getMetrics(state).incomePerSecond <= baseMetrics.incomePerSecond + 1e-6,
    'reconnection does not mint an immediate income bonus',
  );

  const failed = structuredClone(state);
  failed.servers[0].status = 'failed';
  failed.servers[0].condition = 20;
  failed.servers[0].fault = 'Hardwarefehler';
  const beforeFailed = structuredClone(failed);
  assert.equal(act(failed, 'setServerPower', { id: failed.servers[0].id, on: false }).ok, false);
  assert.deepEqual(failed, beforeFailed, 'power controls cannot repair or mutate a failed server');
});

test('rack capacity totals match engine metrics across server modes and global power policies', () => {
  const state = ready(3121);
  assert.equal(act(state, 'buyServer', { type: 'compute' }).ok, true);
  const modes = ['eco', 'balanced', 'performance'];
  const policies = ['eco', 'balanced', 'performance'];
  for (const policy of policies) {
    state.policies.power = policy;
    for (const firstMode of modes) {
      for (const secondMode of modes) {
        state.servers[0].mode = firstMode;
        state.servers[1].mode = secondMode;
        const metrics = getMetrics(state);
        const model = getRackModel(state);
        const physicalCapacity = model.racks
          .flatMap((rack) => rack.servers)
          .reduce((sum, server) => sum + server.capacity, 0);
        assert.ok(
          Math.abs(physicalCapacity - metrics.capacity) < 1e-8,
          `rack model (${policy}, ${firstMode}/${secondMode}) sums to metrics.capacity`,
        );
      }
    }
  }
});

test('rack status and temperature warning reflect the measured thermal throttle above 35 degrees', () => {
  const state = ready(3124);
  state.servers[0].level = 8;
  const model = getRackModel(state).racks[0];
  assert.ok(
    model.temperature > 35 && model.temperature < 55,
    `fixture reaches the early throttle band (${model.temperature} °C)`,
  );
  assert.equal(
    model.status,
    'limited',
    'the rack reports throttling as soon as thermal capacity is reduced',
  );
  assert.ok(
    model.warnings.some((warning) => /Temperatur/i.test(warning)),
    'the rack explains that temperature is reducing performance',
  );
  const nominalCapacity = catalog.servers.edge.capacity * Math.pow(state.servers[0].level, 0.82);
  assert.ok(
    getMetrics(state).capacity < nominalCapacity,
    'the physical model confirms a real capacity reduction in that temperature band',
  );
});

test('disconnecting a powered server removes capacity but preserves draw and upkeep; powering it off removes both', () => {
  const state = ready(3122);
  const server = state.servers[0],
    rackId = server.rackId;
  const baseline = getMetrics(state);
  const portOff = act(state, 'setSwitchPort', { rackId, port: server.port, enabled: false });
  assert.equal(portOff.ok, true);
  const disconnected = getMetrics(state);
  assert.equal(
    disconnected.capacity,
    0,
    'a switch-disconnected server contributes no usable capacity',
  );
  assert.equal(
    disconnected.powerW,
    baseline.powerW,
    'the powered but disconnected server still draws physical power',
  );
  assert.equal(
    disconnected.upkeep,
    baseline.upkeep,
    'the powered but disconnected server still incurs economic upkeep',
  );
  assert.equal(getRackModel(state).totalPowerW, disconnected.powerW);

  assert.equal(act(state, 'setServerPower', { id: server.id, on: false }).ok, true);
  const poweredOff = getMetrics(state);
  assert.equal(poweredOff.capacity, 0);
  assert.ok(
    poweredOff.powerW < disconnected.powerW,
    'powering off the disconnected server cuts its electrical draw',
  );
  assert.ok(
    poweredOff.upkeep < disconnected.upkeep,
    'powering off the disconnected server cuts its upkeep',
  );
  assert.equal(getRackModel(state).totalPowerW, poweredOff.powerW);
});

test('a disconnected low-condition server cannot distort reliability or gain a condition bonus', () => {
  const state = ready(3123);
  assert.equal(act(state, 'buyServer', { type: 'compute' }).ok, true);
  const linked = state.servers[0],
    disconnected = state.servers[1];
  linked.condition = 82;
  disconnected.condition = 1;
  assert.equal(
    act(state, 'setSwitchPort', {
      rackId: disconnected.rackId,
      port: disconnected.port,
      enabled: false,
    }).ok,
    true,
  );
  const lowConditionReliability = getMetrics(state).reliability;
  disconnected.condition = 100;
  const recoveredButDisconnectedReliability = getMetrics(state).reliability;
  assert.equal(
    recoveredButDisconnectedReliability,
    lowConditionReliability,
    'changing only the disconnected server condition does not change network reliability',
  );
  disconnected.condition = 82;
  assert.equal(
    act(state, 'setSwitchPort', {
      rackId: disconnected.rackId,
      port: disconnected.port,
      enabled: true,
    }).ok,
    true,
  );
  const linkedReliability = getMetrics(state).reliability;
  assert.ok(
    linkedReliability <= lowConditionReliability,
    'connecting another node with the same condition cannot invent a reliability bonus',
  );
});

test('rack upgrades charge the quote once, take the quoted time, lock the rack, and improve the matching tier', () => {
  for (const component of ['switch', 'power', 'cooling']) {
    const state = ready(3110 + component.length);
    const rack = state.facility.racks[0],
      before = getRackModel(state).racks[0];
    const q = quoteHardware(state, 'upgradeRack', { rackId: rack.id, component });
    const versionBefore = structuredClone(state);
    const quote = startUpgrade(state, rack.id, component);
    assert.equal(state.credits, versionBefore.credits - q.cost);
    const blocked = quoteHardware(state, 'upgradeRack', {
      rackId: rack.id,
      component: component === 'switch' ? 'power' : 'switch',
    });
    assert.equal(blocked.enabled, false, 'a second shared facility operation cannot overlap');
    const during = structuredClone(state);
    assert.equal(
      act(state, 'upgradeRack', {
        rackId: rack.id,
        component: component === 'switch' ? 'power' : 'switch',
      }).ok,
      false,
    );
    assert.deepEqual(state, during);
    const loaded = normalizeState(JSON.parse(JSON.stringify(state)));
    assert.deepEqual(
      loaded.facility.operation,
      state.facility.operation,
      'an active facility upgrade survives a save reload',
    );
    advance(loaded, quote.duration);
    const after = getRackModel(loaded).racks[0];
    assert.equal(loaded.facility.operation, null);
    assert.equal(after[component + 'Level'], before[component + 'Level'] + 1);
    if (component === 'switch')
      assert.ok(
        after.uplinkMbps > before.uplinkMbps &&
          after.ports[0].speedMbps > before.ports[0].speedMbps,
      );
    if (component === 'power') assert.equal(after.powerCapacityW, before.powerCapacityW + 2000);
    if (component === 'cooling') assert.equal(after.coolingW, before.coolingW + 2000);
    assert.equal(after.status, 'online');
  }
});

test('switch, power, and cooling limits throttle a demanding node and upgrades relieve the measured bottlenecks', () => {
  const network = ready(3114);
  network.servers[0].level = 1000;
  network.jobs[0].load = 250;
  const networkRack = network.facility.racks[0];
  const initialNetwork = getRackModel(network).racks[0];
  const baseNetworkWork = getMetrics(network).workPerSecond;
  assert.ok(
    initialNetwork.networkDemandMbps > initialNetwork.uplinkMbps,
    'a high-level server load exceeds its small-switch uplink',
  );
  assert.ok(initialNetwork.networkFactor < 1);
  let q = startUpgrade(network, networkRack.id, 'switch');
  advance(network, q.duration);
  const switched = getRackModel(network).racks[0];
  assert.ok(switched.networkFactor > initialNetwork.networkFactor);
  assert.ok(
    getMetrics(network).workPerSecond > baseNetworkWork,
    'switch upgrade improves actual server throughput',
  );

  const state = ready(3118);
  state.servers[0].level = 12;
  const rack = state.facility.racks[0];
  const initial = getRackModel(state).racks[0];
  const baseWork = getMetrics(state).workPerSecond;
  assert.ok(
    initial.powerW > initial.powerCapacityW,
    'a high-level server exceeds rack power budget',
  );
  assert.ok(
    initial.warnings.length > 0 && initial.status === 'limited',
    'power bottleneck is visible in the physical model',
  );
  q = startUpgrade(state, rack.id, 'power');
  advance(state, q.duration);
  const powered = getRackModel(state).racks[0];
  assert.ok(powered.powerCapacityW > initial.powerCapacityW);
  assert.ok(
    getMetrics(state).workPerSecond > baseWork,
    'power budget upgrade increases useful throughput',
  );

  q = startUpgrade(state, rack.id, 'cooling');
  advance(state, q.duration);
  const cooled = getRackModel(state).racks[0];
  assert.ok(cooled.coolingW > powered.coolingW);
  assert.ok(
    cooled.temperature < powered.temperature,
    'cooling capacity lowers measured rack temperature',
  );
  assert.ok(
    getMetrics(state).workPerSecond > baseWork,
    'cooling upgrade improves actual work rate',
  );
  assert.equal(
    state.resilience.incident,
    null,
    'facility maintenance does not introduce risk or damage during the grace fixture',
  );
});

test('rack relocation charges once, boots at the destination, and refuses occupied or unavailable targets', () => {
  const state = ready(3115);
  assert.equal(act(state, 'buyRack', {}).ok, true);
  const server = state.servers[0],
    target = state.facility.racks.at(-1);
  const payload = { id: server.id, rackId: target.id, unit: 2, port: 1 };
  const quote = quoteHardware(state, 'moveServer', payload);
  quoteFields(quote, 'relocation');
  assert.equal(quote.enabled, true);
  const counters = structuredClone(state.counters),
    credits = state.credits;
  assert.equal(act(state, 'moveServer', payload).ok, true);
  assert.equal(credits - state.credits, quote.cost);
  assert.equal(server.rackId, target.id);
  assert.equal(server.unit, 2);
  assert.equal(server.port, 1);
  assert.equal(server.bootRemaining, 30);
  assert.equal(
    getRackModel(state).racks.find((row) => row.id === target.id).servers[0].status,
    'booting',
  );
  const blocked = quoteHardware(state, 'moveServer', payload);
  assert.equal(blocked.enabled, false, 'a booting node cannot be moved and charged again');
  const beforeBlocked = structuredClone(state);
  assert.equal(act(state, 'moveServer', payload).ok, false);
  assert.deepEqual(state, beforeBlocked);
  advance(state, 30);
  assert.equal(
    getRackModel(state).racks.find((row) => row.id === target.id).servers[0].status,
    'online',
  );
  assert.deepEqual(
    state.counters,
    counters,
    'relocation does not grant achievements or server purchases',
  );

  const failed = structuredClone(state);
  failed.servers[0].status = 'failed';
  failed.servers[0].condition = 20;
  failed.servers[0].fault = 'Hardwarefehler';
  const unavailable = quoteHardware(failed, 'moveServer', {
    id: failed.servers[0].id,
    rackId: state.facility.racks[0].id,
    unit: 2,
    port: 1,
  });
  assert.equal(unavailable.enabled, false, 'relocation cannot clear a failed state');
  const beforeFailed = structuredClone(failed);
  assert.equal(
    act(failed, 'moveServer', {
      id: failed.servers[0].id,
      rackId: state.facility.racks[0].id,
      unit: 2,
      port: 1,
    }).ok,
    false,
  );
  assert.deepEqual(failed, beforeFailed);
});

test('relocation is blocked during repair, facility maintenance, and major containment', () => {
  const repairing = ready(3119);
  repairing.servers[0].condition = 35;
  repairing.servers[0].status = 'failed';
  repairing.servers[0].fault = 'Hardwarefehler';
  assert.equal(
    act(repairing, 'repairServer', { id: repairing.servers[0].id, method: 'manual' }).ok,
    true,
  );
  const moveDuringRepair = {
    id: repairing.servers[0].id,
    rackId: repairing.facility.racks[0].id,
    unit: 4,
    port: 2,
  };
  assert.equal(quoteHardware(repairing, 'moveServer', moveDuringRepair).enabled, false);
  const repairBefore = structuredClone(repairing);
  assert.equal(act(repairing, 'moveServer', moveDuringRepair).ok, false);
  assert.deepEqual(repairing, repairBefore);

  const maintaining = ready(3120);
  const rackId = maintaining.facility.racks[0].id;
  startUpgrade(maintaining, rackId, 'switch');
  const moveDuringMaintenance = { id: maintaining.servers[0].id, rackId, unit: 4, port: 2 };
  assert.equal(quoteHardware(maintaining, 'moveServer', moveDuringMaintenance).enabled, false);
  const maintenanceBefore = structuredClone(maintaining);
  assert.equal(act(maintaining, 'moveServer', moveDuringMaintenance).ok, false);
  assert.deepEqual(maintaining, maintenanceBefore);

  const crisis = normalizeState(
    JSON.parse(
      require('node:fs').readFileSync(
        require('node:path').join(__dirname, 'fixtures', 'v2-active-crisis-save.json'),
        'utf8',
      ),
    ),
  );
  const affected = crisis.resilience.incident.affected[0];
  const moveDuringCrisis = { id: affected, rackId: crisis.facility.racks[0].id, unit: 8, port: 3 };
  assert.equal(quoteHardware(crisis, 'moveServer', moveDuringCrisis).enabled, false);
  const crisisBefore = structuredClone(crisis);
  assert.equal(act(crisis, 'moveServer', moveDuringCrisis).ok, false);
  assert.deepEqual(crisis, crisisBefore);
});

test('a failed server stays failed through all power and relocation paths', () => {
  const state = ready(3116);
  assert.equal(act(state, 'buyRack', {}).ok, true);
  const server = state.servers[0];
  server.condition = 20;
  server.status = 'failed';
  server.fault = 'Hardwarefehler';
  const before = structuredClone(state);
  assert.equal(act(state, 'setServerPower', { id: server.id, on: false }).ok, false);
  assert.deepEqual(state, before);
  assert.equal(
    act(state, 'moveServer', {
      id: server.id,
      rackId: state.facility.racks[1].id,
      unit: 2,
      port: 1,
    }).ok,
    false,
  );
  assert.deepEqual(state, before);
  assert.equal(server.status, 'failed');
});

test('long offline hardware simulation remains finite and preserves nonoverlapping geometry', () => {
  const state = ready(3117);
  state.servers[0].level = 12;
  const operationQuote = startUpgrade(state, state.facility.racks[0].id, 'cooling');
  const result = advance(state, 1e12);
  assert.equal(result.seconds, 43200, 'offline catch-up remains capped at 12 hours');
  assert.equal(
    state.facility.operation,
    null,
    'the persisted hardware operation completes during elapsed simulation',
  );
  assert.equal(state.time, 43200);
  const loaded = normalizeState(JSON.parse(JSON.stringify(state)));
  const model = getRackModel(loaded);
  assert.ok(Number.isFinite(model.totalPowerW) && Number.isFinite(model.totalDemandMbps));
  assert.ok(
    loaded.servers.every((server) => server.rackId && server.unit >= 2 && server.port >= 1),
  );
  assert.ok(model.racks.every((rack) => rack.usedUnits <= 16));
  assert.equal(loaded.facility.racks[0].coolingLevel, 2);
  assert.ok(operationQuote.duration > 0);
});
