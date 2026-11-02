const { grantSpace } = require('./helpers/facility.cjs');
('use strict');

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  createState,
  normalizeState,
  getMetrics,
  getFacilityLayout,
  quoteHardware,
  advance,
  act,
} = require(path.join(__dirname, '..', 'engine.js'));

function racks(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `rack-${index + 1}`,
    name: `Rack ${String(index + 1).padStart(2, '0')}`,
    switchLevel: 2,
    powerLevel: 1,
    coolingLevel: 1,
    disabledPorts: [],
  }));
}

test('existing v3 saves normalize without changing the source or their rack assignments', () => {
  const original = createState(701);
  const before = structuredClone(original);
  const restored = normalizeState(original);

  assert.deepEqual(original, before, 'normalization does not mutate the saved object');
  assert.equal(restored.version, 8);
  assert.deepEqual(restored.facility.racks, original.facility.racks);
  assert.equal(restored.servers[0].rackId, original.servers[0].rackId);
  assert.equal(restored.sector, original.sector);
});

test('sector six needs a completed paid room before buying a seventh rack', () => {
  const state = createState(702);
  state.sector = 6;
  state.counters.sectors = 6;
  state.facility.racks = racks(6);
  grantSpace(state);
  state.servers[0].rackId = 'rack-1';
  state.credits = 4e7;
  state.resilience.graceUntil = 1e9;

  const normalized = normalizeState(state);
  assert.equal(getFacilityLayout(normalized).rackLimit, 6);
  assert.equal(quoteHardware(normalized, 'buyRack').enabled, false);
  const construction = quoteHardware(normalized, 'buildRoom', { floor: 1 });
  assert.equal(act(normalized, 'buildRoom', { floor: 1 }).ok, true);
  assert.equal(getFacilityLayout(normalized).roomCount, 1);
  advance(normalized, construction.duration);
  assert.equal(getFacilityLayout(normalized).rackLimit, 7);
  const quote = quoteHardware(normalized, 'buyRack');
  assert.equal(quote.enabled, true);
  const balance = normalized.credits;
  const result = act(normalized, 'buyRack');

  assert.equal(result.ok, true);
  assert.equal(normalized.facility.racks.length, 7);
  assert.equal(normalized.credits, balance - quote.cost);
  assert.equal(getFacilityLayout(normalized).roomCount, 2);
});

test('sector unlocks allow a 33rd server and v3 validation accepts the grown network', () => {
  const state = createState(703);
  state.sector = 15;
  state.counters.sectors = 15;
  state.facility.racks = racks(3);
  grantSpace(state);
  state.servers = Array.from({ length: 32 }, (_, index) => ({
    ...state.servers[0],
    id: `server-${index + 1}`,
    rackId: `rack-${Math.floor(index / 16) + 1}`,
    unit: 2 + (index % 16),
    port: 1 + (index % 16),
  }));
  state.credits = 1e9;

  const normalized = normalizeState(state);
  assert.equal(getMetrics(normalized).serverLimit, 33);
  const result = act(normalized, 'buyServer', { type: 'edge' });
  assert.equal(result.ok, true);
  assert.equal(normalized.servers.length, 33);
  assert.equal(normalizeState(normalized).servers.length, 33);
});

test('facility layout groups stable rack order into six-rack rooms and four-room floors', () => {
  const state = createState(704);
  state.sector = 24;
  state.counters.sectors = 24;
  state.facility.racks = racks(25);
  grantSpace(state);
  state.servers[0].rackId = 'rack-1';

  const layout = getFacilityLayout(normalizeState(state));
  assert.deepEqual(
    {
      racksPerRoom: layout.racksPerRoom,
      roomsPerFloor: layout.roomsPerFloor,
      roomCount: layout.roomCount,
      floorCount: layout.floorCount,
    },
    {
      racksPerRoom: 6,
      roomsPerFloor: 4,
      roomCount: 5,
      floorCount: 2,
    },
  );
  assert.deepEqual(
    layout.rooms.map((room) => room.rackCount),
    [6, 6, 6, 6, 1],
  );
  assert.deepEqual(
    layout.rooms.map((room) => room.floor),
    [1, 1, 1, 1, 2],
  );
  assert.deepEqual(layout.rooms[0].rackIds, [
    'rack-1',
    'rack-2',
    'rack-3',
    'rack-4',
    'rack-5',
    'rack-6',
  ]);
  assert.equal(layout.rooms[0].serverCount, 1);
});
