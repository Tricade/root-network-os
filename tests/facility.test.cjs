const { grantSpace, serviceRoomsAt } = require('./helpers/facility.cjs');
('use strict');

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  createState,
  normalizeState,
  getMetrics,
  getCentralInfrastructure,
  getRackModel,
  quoteHardware,
  advance,
  act,
} = require(path.join(__dirname, '..', 'engine.js'));

function stateAtSector(sector) {
  const state = createState(911);
  state.sector = sector;
  state.counters.sectors = sector;
  state.credits = 1e7;
  state.resilience.graceUntil = 1e9;
  grantSpace(state, { specialRooms: serviceRoomsAt(sector) });
  return normalizeState(state);
}

function central(state, id) {
  return getCentralInfrastructure(state).systems.find((system) => system.id === id);
}

test('repeat central upgrades quote the actual gain, final capacity and ongoing costs in both languages', () => {
  const I18N = require('../i18n.js');
  for (const policy of ['balanced', 'performance', 'eco'])
    for (const system of ['cooling', 'ups', 'distribution']) {
      const state = stateAtSector(8);
      state.facility.central = { cooling: 1, ups: 1, distribution: 1 };
      state.policies.power = policy;
      const before = getMetrics(state),
        quote = quoteHardware(state, 'upgradeCentral', { system });
      const field =
        system === 'cooling'
          ? 'centralCoolingW'
          : system === 'ups'
            ? 'upsCapacityW'
            : 'centralDistributionCapacityW';
      assert.ok(quote.enabled);
      assert.equal(quote.capacityAfterW, before[field] + quote.capacityGainW);
      assert.equal(act(state, 'upgradeCentral', { system }).ok, true);
      advance(state, quote.duration);
      const after = getMetrics(state);
      assert.equal(after[field] - before[field], quote.capacityGainW);
      assert.equal(after[field], quote.capacityAfterW);
      assert.ok(Math.abs(after.centralUpkeep - before.centralUpkeep - quote.upkeepIncrease) < 1e-9);
      assert.equal(after.centralPowerW - before.centralPowerW, quote.powerIncreaseW);
      const english = I18N.translate(quote.description, 'en');
      assert.match(english, /Additional running costs:/);
      assert.match(english, /additional power draw:/);
      assert.ok(!/danach|Mehrkosten|zusätzliche/.test(english), english);
    }
});

test('legacy v3 facility saves gain zeroed central systems; malformed added data is rejected', () => {
  const legacy = createState(912);
  delete legacy.facility.central;
  delete legacy.facility.centralOperation;
  const original = structuredClone(legacy);
  const restored = normalizeState(legacy);

  assert.deepEqual(legacy, original, 'migration does not mutate the saved object');
  assert.deepEqual(restored.facility.central, { cooling: 0, ups: 0, distribution: 0 });
  assert.equal(restored.facility.centralOperation, null);
  assert.throws(
    () =>
      normalizeState({
        ...restored,
        facility: { ...restored.facility, central: { ...restored.facility.central, cooling: 1.5 } },
      }),
    /zentrale|Ganzzahl/i,
  );
  assert.throws(
    () =>
      normalizeState({
        ...restored,
        facility: { ...restored.facility, central: { ...restored.facility.central, ups: 10001 } },
      }),
    /zentrale|Ganzzahl/i,
  );
});

test('sector gates quotes and central upgrades charge once, save in progress, and apply after maintenance', () => {
  const state = stateAtSector(4);
  state.servers[0].level = 18;
  state.facility.racks[0].powerLevel = 3;
  const baseline = getMetrics(state);
  const beforeCredits = state.credits;
  const quote = quoteHardware(state, 'upgradeCentral', { system: 'cooling' });
  assert.equal(quote.enabled, true);
  assert.ok(quote.duration > 0 && quote.duration <= 300);
  assert.equal(central(state, 'ups').available, false);
  assert.match(central(state, 'ups').quote.reason, /Sektor 6/);

  assert.equal(act(state, 'upgradeCentral', { system: 'cooling' }).ok, true);
  assert.equal(state.credits, beforeCredits - quote.cost);
  assert.equal(state.facility.central.cooling, 0, 'the benefit is not applied at purchase time');
  const inProgress = normalizeState(state);
  assert.equal(
    inProgress.facility.centralOperation.system,
    'cooling',
    'an active operation survives save normalization',
  );
  assert.equal(getCentralInfrastructure(state).operation.label, 'Zentrale Klimaanlage ausbauen');
  const balanceDuringOperation = state.credits;
  const duplicate = act(state, 'upgradeCentral', { system: 'cooling' });
  assert.equal(duplicate.ok, false);
  assert.equal(state.credits, balanceDuringOperation, 'a repeated click cannot charge again');

  advance(state, quote.duration - 1);
  assert.equal(state.facility.central.cooling, 0);
  advance(state, 1);
  assert.equal(state.facility.central.cooling, 1);
  assert.equal(state.facility.centralOperation, null);
  assert.ok(
    act(state, 'convertRoomSupply', { roomId: 'room-1', system: 'cooling', mode: 'hybrid' }).ok,
  );
  advance(state, 480);
  const system = central(state, 'cooling');
  const rack = getRackModel(state).racks[0];
  assert.equal(system.totalCoolingW, 3500);
  assert.equal(system.allocatedCoolingW, 3500);
  assert.ok(
    rack.temperature < 74,
    'central cooling lowers the rack target through the existing temperature inertia',
  );
  assert.ok(
    getMetrics(state).upkeep > baseline.upkeep,
    'central power and maintenance add operating cost',
  );
  assert.ok(getMetrics(state).powerW > baseline.powerW, 'the cooling plant consumes electricity');
});

test('UPS and distribution provide bounded measurable capacity and unlock at their sectors', () => {
  const upsState = stateAtSector(6);
  const upsBefore = getMetrics(upsState);
  const upsQuote = quoteHardware(upsState, 'upgradeCentral', { system: 'ups' });
  assert.equal(upsQuote.enabled, true);
  assert.equal(act(upsState, 'upgradeCentral', { system: 'ups' }).ok, true);
  advance(upsState, upsQuote.duration);
  assert.ok(
    act(upsState, 'convertRoomSupply', { roomId: 'room-1', system: 'power', mode: 'ups' }).ok,
  );
  advance(upsState, 180);
  const ups = central(upsState, 'ups');
  assert.equal(ups.upsCapacityW, 3000);
  assert.equal(ups.coverage, 1, 'capacity covers this small active installation');
  assert.equal(ups.powerRiskReductionPct, 65);
  assert.ok(
    ups.powerRiskReductionPct < 100,
    'the UPS reduces rather than eliminates power failure risk',
  );
  assert.equal(
    getMetrics(upsState).riskPerHour,
    upsBefore.riskPerHour,
    'riskPerHour remains the aggregate rate across all crisis types',
  );
  assert.match(ups.quote.description, /Chance schwerer Stromausfälle/);
  assert.ok(getMetrics(upsState).upkeep > upsBefore.upkeep);
  assert.equal(central(upsState, 'distribution').available, false);

  const distributionState = stateAtSector(8);
  distributionState.servers[0].level = 15;
  distributionState.facility.racks.push({
    id: 'rack-2',
    name: 'Rack 02',
    roomId: 'room-1',
    switchLevel: 1,
    powerLevel: 1,
    coolingLevel: 1,
    disabledPorts: [],
  });
  distributionState.servers.push({
    ...distributionState.servers[0],
    id: 'server-2',
    name: 'Edge-Knoten 02',
    rackId: 'rack-2',
    unit: 2,
    port: 1,
  });
  const powerBefore = getRackModel(distributionState).racks[0].powerFactor;
  const distributionQuote = quoteHardware(distributionState, 'upgradeCentral', {
    system: 'distribution',
  });
  assert.equal(distributionQuote.enabled, true);
  assert.match(distributionQuote.description, /6000 W zusätzliche Gesamtreserve/);
  assert.equal(act(distributionState, 'upgradeCentral', { system: 'distribution' }).ok, true);
  advance(distributionState, distributionQuote.duration);
  assert.ok(
    act(distributionState, 'convertRoomSupply', {
      roomId: 'room-1',
      system: 'power',
      mode: 'hybrid',
    }).ok,
  );
  advance(distributionState, 180);
  const racks = getRackModel(distributionState).racks;
  assert.deepEqual(
    racks.map((rack) => rack.centralPowerCapacityW),
    [3000, 3000],
    'the 6 kW budget is split equally across active racks',
  );
  assert.ok(racks.every((rack) => rack.powerCapacityW === rack.basePowerCapacityW + 3000));
  assert.ok(racks[0].powerFactor > powerBefore, 'the distributed reserve improves headroom');
  assert.equal(central(distributionState, 'distribution').distributionCapacityW, 6000);
  assert.equal(central(distributionState, 'distribution').additionalPowerWPerRack, 3000);
  assert.equal(
    racks.reduce((sum, rack) => sum + rack.centralPowerCapacityW, 0),
    6000,
    'total rack bonuses cannot exceed the central budget',
  );
  distributionState.facility.racks.push({
    id: 'rack-3',
    name: 'Rack 03',
    roomId: 'room-1',
    switchLevel: 1,
    powerLevel: 1,
    coolingLevel: 1,
    disabledPorts: [],
  });
  const afterEmptyRack = getRackModel(distributionState).racks;
  assert.deepEqual(
    afterEmptyRack.map((rack) => rack.centralPowerCapacityW),
    [3000, 3000, 0],
    'buying an empty rack grants no extra central capacity',
  );
  assert.equal(
    afterEmptyRack.reduce((sum, rack) => sum + rack.centralPowerCapacityW, 0),
    6000,
  );
  assert.ok(getMetrics(distributionState).upkeep > 0);
});

test('central expansion cannot overlap rack or resilience maintenance', () => {
  const state = stateAtSector(8);
  const rackQuote = quoteHardware(state, 'upgradeRack', {
    rackId: state.facility.racks[0].id,
    component: 'cooling',
  });
  assert.equal(rackQuote.enabled, true);
  assert.equal(
    act(state, 'upgradeRack', { rackId: state.facility.racks[0].id, component: 'cooling' }).ok,
    true,
  );
  const quote = quoteHardware(state, 'upgradeCentral', { system: 'cooling' });
  assert.equal(quote.enabled, false);
  assert.match(quote.reason, /Infrastrukturmaßnahme/);
  assert.equal(act(state, 'upgradeCentral', { system: 'cooling' }).ok, false);
});
