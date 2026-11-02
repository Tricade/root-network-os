'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../engine.js');
const { grantSpace } = require('./helpers/facility.cjs');

function ready(seed = 920) {
  const state = E.createState(seed);
  state.sector = 30;
  state.credits = 1e12;
  state.resilience.graceUntil = 1e9;
  return state;
}
const quote = (state, action, payload = {}) => E.quoteHardware(state, action, payload);
const roundtrip = (state) => E.normalizeState(JSON.parse(JSON.stringify(state)));

test('fresh bunker owns only one server room and one floor; sector upgrades grant no free space', () => {
  const state = E.createState();
  for (const sector of [1, 8, 100, 1000000]) {
    state.sector = sector;
    const layout = E.getFacilityLayout(state);
    assert.equal(layout.roomCount, 1);
    assert.equal(layout.floorCount, 1);
    assert.deepEqual(layout.specialRooms, []);
    assert.equal(layout.rackCapacity, 6);
    assert.ok(E.getCentralInfrastructure(state).systems.every((system) => !system.available));
  }
});

test('quotes are pure and reflect expensive excavations and escalating depth', () => {
  const state = ready(),
    before = JSON.stringify(state);
  assert.equal(quote(state, 'buildRoom', { floor: 1 }).cost, 20000000);
  assert.equal(quote(state, 'buildFloor').cost, 500000000);
  assert.ok(quote(state, 'buildFloor').cost > quote(state, 'buildRoom', { floor: 1 }).cost * 20);
  E.getBuildingModel(state);
  E.getConstructionProject(state);
  E.getFacilityLayout(state);
  assert.equal(JSON.stringify(state), before);
  grantSpace(state, { rooms: 4 });
  assert.ok(quote(state, 'buildRoom', { floor: 1 }).reason.includes('vier'));
  assert.equal(quote(state, 'buildFloor').cost, 500000000);
  state.facility.building.floors = 2;
  assert.ok(quote(state, 'buildFloor').cost > 3000000000);
  assert.ok(quote(state, 'buildRoom', { floor: 2 }).cost > 100000000);
});

test('insufficient funds, unknown plots and duplicate starts never change state', () => {
  const state = ready();
  state.credits = 10;
  for (const [action, payload] of [
    ['buildRoom', { floor: 1 }],
    ['buildFloor', {}],
    ['buildRoom', { floor: 2 }],
    ['buildRoom', { floor: '1' }],
    ['buildServiceRoom', { roomType: 'unknown' }],
  ]) {
    const before = JSON.stringify(state);
    assert.equal(E.act(state, action, payload).ok, false);
    assert.equal(JSON.stringify(state), before);
  }
  state.credits = 1e12;
  assert.equal(E.act(state, 'buildRoom', { floor: 1 }).ok, true);
  const before = JSON.stringify(state);
  assert.equal(E.act(state, 'buildFloor').ok, false);
  assert.equal(JSON.stringify(state), before);
});

test('room payment is charged once; capacity and an empty destination appear only on completion', () => {
  const state = ready();
  for (let i = 1; i < 6; i++) assert.ok(E.act(state, 'buyRack').ok);
  assert.equal(quote(state, 'buyRack').enabled, false);
  const q = quote(state, 'buildRoom', { floor: 1 }),
    cash = state.credits;
  assert.ok(E.act(state, 'buildRoom', { floor: 1 }).ok);
  assert.equal(state.credits, cash - q.cost);
  E.advance(state, q.duration - 0.25);
  assert.equal(E.getFacilityLayout(state).roomCount, 1);
  const restored = roundtrip(state);
  E.advance(restored, 0.25);
  assert.equal(restored.facility.building.project, null);
  const room = E.getFacilityLayout(restored).rooms[1];
  assert.equal(room.rackCount, 0);
  assert.equal(room.floor, 1);
  const rackQuote = quote(restored, 'buyRack', { roomId: room.id }),
    balance = restored.credits;
  assert.ok(E.act(restored, 'buyRack', { roomId: room.id }).ok);
  assert.equal(restored.credits, balance - rackQuote.cost);
  assert.equal(restored.facility.racks.at(-1).roomId, room.id);
  assert.equal(E.getFacilityLayout(restored).rooms[0].rackCount, 6);
});

test('a completed floor is initially empty and a room must be purchased separately', async () => {
  const { corridorPlan, roomLocation, roomStructureKey, roomNavigationKey } =
    await import('../room-navigation.js');
  const state = ready(),
    before = E.getFacilityLayout(state),
    central = E.getCentralInfrastructure(state);
  const oldStructure = roomStructureKey(before),
    oldNav = roomNavigationKey(before, central, { id: 'hall', floor: 1 }, 'en');
  const q = quote(state, 'buildFloor');
  assert.ok(E.act(state, 'buildFloor').ok);
  E.advance(state, q.duration);
  const layout = E.getFacilityLayout(state);
  assert.equal(layout.floorCount, 2);
  assert.equal(layout.roomCount, 1);
  assert.equal(roomLocation(layout, 'hall', 2).floor, 2);
  assert.deepEqual(corridorPlan(layout, central, 2).doors, []);
  assert.deepEqual(
    corridorPlan(layout, central, 2).stairs.map((stair) => stair.direction),
    ['up'],
  );
  assert.deepEqual(
    corridorPlan(layout, central, 1).stairs.map((stair) => stair.direction),
    ['down'],
  );
  assert.notEqual(roomStructureKey(layout), oldStructure);
  assert.notEqual(roomNavigationKey(layout, central, { id: 'hall', floor: 1 }, 'en'), oldNav);
  const roomQuote = quote(state, 'buildRoom', { floor: 2 });
  assert.ok(E.act(state, 'buildRoom', { floor: 2 }).ok);
  E.advance(state, roomQuote.duration);
  assert.equal(E.getFacilityLayout(state).rooms[1].floor, 2);
  assert.equal(E.getFacilityLayout(roundtrip(state)).rooms[1].rackCount, 0);
});

test('control and utility rooms require construction before devices or corridor access', async () => {
  const { corridorPlan, roomLocation } = await import('../room-navigation.js');
  const state = E.createState();
  state.credits = 1e12;
  state.resilience.graceUntil = 1e9;
  assert.equal(quote(state, 'buildServiceRoom', { roomType: 'control' }).enabled, false);
  assert.equal(roomLocation(E.getFacilityLayout(state), 'control').id, 'hall');
  state.sector = 8;
  assert.match(quote(state, 'upgradeCentral', { system: 'cooling' }).reason, /Technikraum/);
  for (const roomType of ['control', 'cooling', 'ups', 'distribution']) {
    const q = quote(state, 'buildServiceRoom', { roomType });
    const balance = state.credits;
    assert.ok(E.act(state, 'buildServiceRoom', { roomType }).ok);
    assert.equal(state.credits, balance - q.cost);
    assert.ok(!E.getFacilityLayout(state).specialRooms.includes(roomType));
    E.advance(state, q.duration);
    assert.ok(E.getFacilityLayout(state).specialRooms.includes(roomType));
    assert.equal(quote(state, 'buildServiceRoom', { roomType }).enabled, false);
    assert.ok(
      corridorPlan(E.getFacilityLayout(state), E.getCentralInfrastructure(state), 1).doors.some(
        (door) => door.id === roomType,
      ),
    );
  }
  assert.ok(quote(state, 'upgradeCentral', { system: 'cooling' }).enabled);
  assert.equal(
    E.getCentralInfrastructure(state).systems[0].level,
    0,
    'construction does not install equipment',
  );
  assert.doesNotThrow(() => roundtrip(state));
});

test('building is independent of safety maintenance and survives a crisis while repairs remain possible', () => {
  const state = ready(),
    q = quote(state, 'buildRoom', { floor: 1 });
  assert.ok(E.act(state, 'buildRoom', { floor: 1 }).ok);
  state.servers[0].status = 'failed';
  state.servers[0].condition = 40;
  state.servers[0].fault = 'Hardwarefehler';
  assert.ok(E.act(state, 'repairServer', { id: state.servers[0].id, method: 'manual' }).ok);
  const restored = roundtrip(state);
  E.advance(restored, q.duration);
  assert.equal(restored.facility.building.rooms.length, 2);
  assert.equal(restored.servers[0].status, 'online');
  const crisis = E.normalizeState(
    JSON.parse(
      fs.readFileSync(path.join(__dirname, 'fixtures/v2-active-crisis-save.json'), 'utf8'),
    ),
  );
  const incident = crisis.resilience.incident;
  crisis.resilience.incident = null;
  crisis.credits = 1e12;
  const cq = quote(crisis, 'buildRoom', { floor: 1 });
  assert.ok(E.act(crisis, 'buildRoom', { floor: 1 }).ok);
  crisis.resilience.incident = incident;
  E.advance(crisis, cq.duration);
  assert.ok(crisis.resilience.incident, 'the incident still waits for a decision');
  assert.equal(crisis.facility.building.rooms.length, 2);
  assert.doesNotThrow(() => roundtrip(crisis));
});

test('online slices, reload and offline catch-up produce the same completed construction', () => {
  const a = ready(921);
  assert.ok(E.act(a, 'buildFloor').ok);
  const b = roundtrip(a);
  const c = roundtrip(a);
  E.advance(a, 7200);
  for (let i = 0; i < 120; i++) E.advance(b, 60);
  E.advance(c, 3500);
  const reloaded = roundtrip(c);
  E.advance(reloaded, 3700);
  for (const state of [b, reloaded]) {
    assert.deepEqual(state.facility.building, a.facility.building);
    assert.equal(state.credits, a.credits);
    assert.equal(state.time, a.time);
  }
});

test('legacy space migrates once without charging or relocating a rack; unknown modern room IDs are rejected', () => {
  const state = ready();
  state.facility.racks = Array.from({ length: 25 }, (_, i) => ({
    ...state.facility.racks[0],
    id: `rack-${i + 1}`,
  }));
  state.version = 3;
  delete state.business;
  delete state.facility.building;
  const source = JSON.stringify(state);
  const restored = roundtrip(state),
    layout = E.getFacilityLayout(restored);
  assert.equal(JSON.stringify(state), source);
  assert.equal(restored.credits, state.credits);
  assert.equal(layout.roomCount, 5);
  assert.equal(layout.floorCount, 2);
  assert.deepEqual(
    layout.rooms.map((room) => room.rackCount),
    [6, 6, 6, 6, 1],
  );
  assert.deepEqual(layout.specialRooms, ['control', 'cooling', 'ups', 'distribution']);
  assert.deepEqual(restored.facility.building, roundtrip(restored).facility.building);
  restored.facility.racks[0].roomId = 'room-999';
  assert.throws(() => roundtrip(restored));
  assert.throws(() => E.getFacilityLayout(restored));
});

test('malformed building ownership and altered construction terms are rejected', () => {
  const base = ready();
  assert.ok(E.act(base, 'buildRoom', { floor: 1 }).ok);
  for (const mutate of [
    (s) => {
      s.facility.building.project.cost++;
    },
    (s) => {
      s.facility.building.project.total++;
    },
    (s) => {
      s.facility.building.project.floor = 2;
    },
    (s) => {
      s.facility.building.project.remaining = -1;
    },
    (s) => {
      s.facility.building.project.remaining = Infinity;
    },
    (s) => {
      s.facility.building.project.roomId = 'room-3';
    },
    (s) => {
      s.facility.building.rooms.push({ id: 'room-1', floor: 1 });
    },
    (s) => {
      s.facility.building.floors = 0;
    },
    (s) => {
      s.facility.building.specialRooms = ['unknown'];
    },
    (s) => {
      s.facility.central.cooling = 1;
    },
  ]) {
    const state = structuredClone(base);
    mutate(state);
    assert.throws(() => E.normalizeState(state));
  }
});

test('construction ceilings remain finite without inventing extra usable rack capacity', () => {
  const state = ready();
  state.sector = 1000000;
  grantSpace(state, { rooms: 1667, floors: 417 });
  assert.equal(E.getFacilityLayout(state).rackCapacity, 10000);
  const model = E.getBuildingModel(state);
  assert.equal(model.buyFloor.enabled, false);
  assert.ok(Number.isFinite(model.buyFloor.cost));
  assert.ok(model.floors.every((floor) => Number.isFinite(floor.buyRoom.cost)));
  assert.doesNotThrow(() => roundtrip(state));
});
