'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict');
const E = require('../engine');
const { grantSpace } = require('./helpers/facility.cjs');
function setup() {
  const s = E.createState(910);
  s.credits = 1e9;
  s.sector = 10;
  s.resilience.graceUntil = 1e9;
  s.facility.racks.push({
    ...s.facility.racks[0],
    id: 'rack-20',
    name: 'Other',
    disabledPorts: [],
  });
  s.servers.push({ ...s.servers[0], id: 'server-21', name: 'Other', rackId: 'rack-20' });
  grantSpace(s, { rooms: 2, specialRooms: ['cooling', 'distribution', 'ups'] });
  s.facility.racks[1].roomId = 'room-2';
  s.facility.central = { cooling: 2, distribution: 2, ups: 2 };
  return s;
}
test('plant does not magically connect local rooms; conversion is paid, delayed and isolated', () => {
  const s = setup(),
    before = E.getRackModel(s).racks;
  assert.equal(before[0].centralCoolingW, 0);
  assert.equal(E.getMetrics(s).upsCoverage, 0);
  const payload = { roomId: 'room-1', system: 'cooling', mode: 'central' },
    q = E.quoteSupply(s, payload),
    money = s.credits;
  assert.ok(q.enabled, q.reason);
  assert.ok(E.act(s, 'convertRoomSupply', payload).ok);
  assert.equal(s.credits, money - q.cost);
  assert.equal(E.getMetrics(s).onlineServers, 1);
  assert.equal(E.getRackModel(s).racks[1].servers[0].status, 'online');
  assert.ok(E.normalizeState(s).business.rooms[0].conversion);
  E.advance(s, 180);
  const rack = E.getRackModel(s).racks[0];
  assert.equal(s.business.rooms[0].supply.cooling, 'central');
  assert.equal(rack.coolingW, 7000);
  assert.equal(s.business.rooms[0].conversion, null);
});
test('shared plant failure affects central clients; local and hybrid supplies retain independent capacity', () => {
  const s = setup();
  s.business.rooms[0].supply = { cooling: 'central', power: 'central' };
  const node = s.servers[0];
  node.status = 'failed';
  node.fault = 'Stromausfall';
  node.condition = 35;
  s.resilience.incident = {
    id: 'incident-990',
    kind: 'power',
    title: 'Test',
    description: 'Test',
    consequence: 'Test',
    affected: [node.id],
    resolution: null,
    scope: 'central',
    system: 'power',
    rackId: 'rack-1',
    roomId: 'room-1',
  };
  assert.equal(E.getMetrics(s).onlineServers, 1);
  assert.equal(E.getRackModel(s).racks[1].servers[0].status, 'online');
  s.business.rooms[1].supply.power = 'hybrid';
  assert.equal(E.getMetrics(s).onlineServers, 1);
  assert.equal(E.getRackModel(s).racks[1].powerCapacityW, 2000);
  assert.equal(E.normalizeState(s).resilience.incident.system, 'power');
  s.business.rooms[1].supply.power = 'central';
  assert.equal(E.getMetrics(s).onlineServers, 0);
});
test('central expansion scales beyond five modules and inadequate conversion quotes reject without mutation', () => {
  const s = setup();
  s.facility.central.cooling = 5;
  assert.ok(E.act(s, 'upgradeCentral', { system: 'cooling' }).ok);
  E.advance(s, 300);
  assert.equal(s.facility.central.cooling, 6);
  assert.equal(E.normalizeState(s).facility.central.cooling, 6);
  s.servers[0].level = 100;
  const original = structuredClone(s);
  const result = E.act(s, 'convertRoomSupply', {
    roomId: 'room-1',
    system: 'cooling',
    mode: 'central',
  });
  assert.equal(result.ok, false);
  assert.deepEqual(s, original);
});
test('UPS-only rooms can disconnect without owning distribution; paid conversion rejects tampering and rack changes', () => {
  const s = setup();
  s.facility.central.distribution = 0;
  s.facility.building.specialRooms = ['ups', 'cooling'];
  s.business.rooms[0].supply.power = 'ups';
  const payload = { roomId: 'room-1', system: 'power', mode: 'local' };
  assert.ok(E.act(s, 'convertRoomSupply', payload).ok);
  assert.equal(E.normalizeState(s).business.rooms[0].conversion.mode, 'local');
  assert.equal(E.act(s, 'buyRack', { roomId: 'room-1' }).ok, false);
  const bad = structuredClone(s);
  bad.business.rooms[0].conversion.cost = 0;
  assert.throws(() => E.normalizeState(bad), /Umbaupreis/);
  E.advance(s, 180);
  assert.equal(s.business.rooms[0].supply.power, 'local');
});
