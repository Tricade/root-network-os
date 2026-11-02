'use strict';
// Reproducible, fictional fleets only. Never reads or changes a player's save.
const E = require('../../engine.js');
const { roomDefaults } = require('../../engine/service-catalog.js')({});

function fresh(seed, automatic = true) {
  const s = E.createState(seed);
  s.policies.autocontract = automatic;
  return s;
}

function fleet(count = 24, seed = 101) {
  const s = fresh(seed),
    template = s.servers[0],
    rack = s.facility.racks[0];
  const rackCount = Math.ceil(count / 3),
    roomCount = Math.ceil(rackCount / 6);
  // Sector capacity is 3 + 2 * sector; large fixtures must obey the same rule as saves.
  s.sector = Math.max(15, Math.ceil((count - 3) / 2));
  s.credits = 1e6;
  s.nextId = count + rackCount + roomCount + 1000;
  s.facility.building = {
    version: 1,
    floors: Math.ceil(roomCount / 4),
    project: null,
    specialRooms: [],
    rooms: Array.from({ length: roomCount }, (_, i) => ({
      id: `room-${i + 1}`,
      floor: Math.floor(i / 4) + 1,
    })),
  };
  s.facility.racks = Array.from({ length: rackCount }, (_, i) => ({
    ...rack,
    id: `rack-${i + 1}`,
    name: `Rack ${i + 1}`,
    roomId: `room-${Math.floor(i / 6) + 1}`,
    switchLevel: 3,
    powerLevel: 12,
    coolingLevel: 12,
    disabledPorts: [],
  }));
  s.servers = Array.from({ length: count }, (_, i) => ({
    ...template,
    id: `server-${i + 1}`,
    name: `Node ${i + 1}`,
    type: ['compute', 'storage', 'ai'][i % 3],
    rackId: `rack-${Math.floor(i / 3) + 1}`,
    unit: 2 + (i % 3) * 4,
    port: (i % 3) + 1,
    level: 3,
    condition: 100,
    status: 'online',
    fault: null,
  }));
  s.business.rooms = s.facility.building.rooms.map((r) => ({ ...roomDefaults(r.id), crew: 20 }));
  s.jobs = [];
  // Fixed mixed workload, proportional to fitted hardware; no synthetic income multiplier.
  for (const room of s.business.rooms) {
    const racks = s.facility.racks.filter((r) => r.roomId === room.roomId).length;
    for (const g of room.groups)
      g.units = { hosting: 10, archive: 2, database: 5, inference: 2 }[g.kind] * racks;
  }
  s.operations.limits = {
    repair: 10000,
    backup: 100000,
    parts: 10000,
    reserve: 5000,
    plan: 0,
    savings: 0,
  };
  s.operations.partsTarget = Math.min(20 * roomCount, 30);
  s.operations.autoParts = true;
  // This fixture constructs the historical service ledger, then follows the
  // real migration path to named customer contracts and an empty research lab.
  s.version = 5;
  delete s.customers;
  delete s.lab;
  return E.normalizeState(s);
}
module.exports = { fresh, fleet };
