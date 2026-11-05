/** Save v3: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['save-v3'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    const {
      HARDWARE,
      FIRST_DEVICE_UNIT,
      LAST_DEVICE_UNIT,
      MAX_RACK_LEVEL,
      RACKS_PER_ROOM,
      CENTRAL_SYSTEMS,
      CENTRAL_DEFAULTS,
      clamp,
      finite,
    } = context;
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const centralQuote = (...args) => context.centralQuote(...args);
    const normalizeV2 = (...args) => context.normalizeV2(...args);
    const portCount = (...args) => context.portCount(...args);
    const rackComponentQuote = (...args) => context.rackComponentQuote(...args);
    const rackLimit = (...args) => context.rackLimit(...args);

    function normalizeV3(input) {
      const serverRows = Array.isArray(input.servers) ? input.servers : [];
      const coreInput = {
        ...input,
        version: 2,
        servers: serverRows.map((server) => {
          if (!server || typeof server !== 'object') return server;
          const { rackId, unit, port, powered, bootRemaining, ...core } = server;
          return core;
        }),
      };
      delete coreInput.facility;
      const s = normalizeV2(coreInput),
        num = (v, key, lo = 0, hi = 1e15) => {
          if (!finite(v)) throw new Error('Ungültiger Zahlenwert: ' + key);
          return clamp(v, lo, hi);
        };
      const intStrict = (v, key, lo, hi) => {
        if (!Number.isInteger(v) || v < lo || v > hi) throw new Error('Ungültige Ganzzahl: ' + key);
        return v;
      };
      const str = (v, key, max = 64) => {
        if (typeof v !== 'string' || v.length > max) throw new Error('Ungültiger Textwert: ' + key);
        return v;
      };
      const facility = input.facility;
      if (
        !facility ||
        typeof facility !== 'object' ||
        Array.isArray(facility) ||
        !Array.isArray(facility.racks) ||
        facility.racks.length < 1 ||
        facility.racks.length > rackLimit(s)
      )
        throw new Error('Ungültige Rackanlage.');
      const legacySpace = facility.building === undefined;
      const building = context.normalizeBuildingSpace(facility, s.sector);
      const roomLimits = new Map(
          building.rooms.map((room) => [room.id, context.roomRackSlots(room)]),
        ),
        rackCounts = new Map();
      let central = { ...CENTRAL_DEFAULTS };
      if (facility.central !== undefined) {
        if (
          !facility.central ||
          typeof facility.central !== 'object' ||
          Array.isArray(facility.central)
        )
          throw new Error('Ungültige zentrale Infrastruktur.');
        for (const system of CENTRAL_SYSTEMS)
          central[system.id] = intStrict(
            facility.central[system.id],
            `facility.central.${system.id}`,
            0,
            system.maxLevel,
          );
      }
      const rackIds = new Set(),
        racks = facility.racks.map((rack, index) => {
          if (!rack || typeof rack !== 'object' || Array.isArray(rack))
            throw new Error('Ungültiges Rack.');
          const id = str(rack.id, 'rack.id');
          if (!/^[a-z][a-z0-9-]{0,63}$/i.test(id) || rackIds.has(id))
            throw new Error('Ungültige oder doppelte Rack-ID.');
          rackIds.add(id);
          const switchLevel = intStrict(rack.switchLevel, 'rack.switchLevel', 1, 3);
          const powerLevel = intStrict(rack.powerLevel, 'rack.powerLevel', 1, MAX_RACK_LEVEL);
          const coolingLevel = intStrict(rack.coolingLevel, 'rack.coolingLevel', 1, MAX_RACK_LEVEL);
          if (!Array.isArray(rack.disabledPorts) || rack.disabledPorts.length > 16)
            throw new Error('Ungültige Switch-Ports.');
          const disabledPorts = rack.disabledPorts.map((port) =>
            intStrict(port, 'rack.disabledPort', 1, switchLevel === 1 ? 8 : 16),
          );
          if (new Set(disabledPorts).size !== disabledPorts.length)
            throw new Error('Doppelter deaktivierter Port.');
          const temperature =
            rack.temperature === undefined
              ? undefined
              : num(rack.temperature, 'rack.temperature', 22, 100);
          const roomId = legacySpace
            ? building.rooms[Math.floor(index / RACKS_PER_ROOM)].id
            : rack.roomId;
          if (!roomLimits.has(roomId))
            throw new Error('Rack verweist auf einen nicht gebauten Serverraum.');
          rackCounts.set(roomId, (rackCounts.get(roomId) || 0) + 1);
          if (rackCounts.get(roomId) > roomLimits.get(roomId))
            throw new Error('Serverraum enthält mehr Racks als ausgebaute Rackplätze.');
          return {
            id,
            name: str(rack.name, 'rack.name', 36),
            roomId,
            switchLevel,
            powerLevel,
            coolingLevel,
            disabledPorts,
            ...(temperature === undefined ? {} : { temperature }),
          };
        });
      const rackMap = new Map(racks.map((r) => [r.id, r])),
        units = new Map(),
        ports = new Map();
      s.servers = s.servers.map((server, index) => {
        const original = serverRows[index],
          rackId = str(original && original.rackId, 'server.rackId');
        const rack = rackMap.get(rackId);
        if (!rack) throw new Error('Server verweist auf ein unbekanntes Rack.');
        const unit = intStrict(original.unit, 'server.unit', FIRST_DEVICE_UNIT, LAST_DEVICE_UNIT);
        const size = HARDWARE[server.type].units;
        if (unit + size - 1 > LAST_DEVICE_UNIT)
          throw new Error('Server überschreitet die Rackhöhe.');
        let occupied = units.get(rackId);
        if (!occupied) {
          occupied = new Set();
          units.set(rackId, occupied);
        }
        for (let u = unit; u < unit + size; u++) {
          if (occupied.has(u)) throw new Error('Rack-Geräte überlappen sich.');
          occupied.add(u);
        }
        const port = intStrict(original.port, 'server.port', 1, portCount(rack));
        let rackPorts = ports.get(rackId);
        if (!rackPorts) {
          rackPorts = new Set();
          ports.set(rackId, rackPorts);
        }
        if (rackPorts.has(port)) throw new Error('Switch-Port ist doppelt belegt.');
        rackPorts.add(port);
        const powered = original.powered;
        if (typeof powered !== 'boolean') throw new Error('Ungültiger Server-Schaltzustand.');
        const bootRemaining = num(original.bootRemaining, 'server.bootRemaining', 0, 30);
        if (bootRemaining > 0 && (!powered || server.status !== 'online'))
          throw new Error('Ungültiger Bootvorgang.');
        return { ...server, rackId, unit, port, powered, bootRemaining };
      });
      let operation = null;
      if (facility.operation !== null) {
        const op = facility.operation;
        if (
          !op ||
          typeof op !== 'object' ||
          !['switch', 'power', 'cooling'].includes(op.kind) ||
          !rackMap.has(op.rackId)
        )
          throw new Error('Ungültiger Rack-Ausbau.');
        const rack = rackMap.get(op.rackId),
          level = rack[op.kind + 'Level'];
        const duration = op.kind === 'switch' ? 45 : op.kind === 'power' ? 60 : 90;
        if (
          intStrict(op.targetLevel, 'facility.operation.targetLevel', 2, MAX_RACK_LEVEL) !==
            level + 1 ||
          (op.kind === 'switch' && level >= 3)
        )
          throw new Error('Ungültiges Ausbauziel.');
        const total = num(op.total, 'facility.operation.total', 0.001, 1000),
          remaining = num(op.remaining, 'facility.operation.remaining', 0, total);
        if (total !== duration || s.resilience.operation)
          throw new Error('Rack-Ausbau kollidiert mit einem laufenden Betriebseingriff.');
        const q = rackComponentQuote({ ...s, facility: { racks, operation: null } }, rack, op.kind);
        const costValue = num(op.cost, 'facility.operation.cost', 0, 1e9);
        if (costValue !== q.cost)
          throw new Error('Rack-Ausbaukosten stimmen nicht mit dem Ausbauziel überein.');
        operation = {
          kind: op.kind,
          label: str(op.label, 'facility.operation.label', 64),
          rackId: op.rackId,
          remaining,
          total,
          targetLevel: level + 1,
          cost: costValue,
        };
      }
      let centralOperation = null;
      if (facility.centralOperation !== undefined && facility.centralOperation !== null) {
        const op = facility.centralOperation;
        const system = op && CENTRAL_SYSTEMS.find((item) => item.id === op.system);
        if (
          !system ||
          !op ||
          typeof op !== 'object' ||
          Array.isArray(op) ||
          s.sector < system.unlockSector
        )
          throw new Error('Ungültiger zentraler Ausbau.');
        const level = central[system.id],
          targetLevel = intStrict(
            op.targetLevel,
            'facility.centralOperation.targetLevel',
            1,
            system.maxLevel,
          );
        if (targetLevel !== level + 1) throw new Error('Ungültiges zentrales Ausbauziel.');
        const duration = Math.min(300, system.duration + (targetLevel - 1) * 30);
        if (
          !finite(op.total) ||
          op.total !== duration ||
          !finite(op.remaining) ||
          op.remaining < 0 ||
          op.remaining > op.total
        )
          throw new Error('Ungültige zentrale Ausbaudauer.');
        const total = op.total,
          remaining = op.remaining;
        const q = centralQuote(
          { ...s, facility: { racks, operation, central, centralOperation: null } },
          system,
        );
        if (!finite(op.cost) || op.cost < 0 || op.cost > 1e12)
          throw new Error('Ungültige zentrale Ausbaukosten.');
        const costValue = op.cost;
        if (costValue !== q.cost)
          throw new Error('Zentrale Ausbaukosten stimmen nicht mit dem Ausbauziel überein.');
        centralOperation = { system: system.id, targetLevel, remaining, total, cost: costValue };
      }
      if ((operation && centralOperation) || (centralOperation && s.resilience.operation))
        throw new Error('Zentrale, Rack- und Betriebsmaßnahmen dürfen nicht parallel laufen.');
      if (!legacySpace)
        building.project = context.normalizeConstruction(
          { ...s, facility: { racks, building } },
          facility.building.project,
        );
      for (const system of CENTRAL_SYSTEMS) {
        if (
          (central[system.id] > 0 || centralOperation?.system === system.id) &&
          !building.specialRooms.includes(system.id)
        )
          throw new Error('Zentrale Anlage ohne gebauten Technikraum.');
      }
      s.facility = { racks, operation, central, centralOperation, building };
      s.version = 3;
      const allIds = new Set(
        [...s.servers, ...s.agents, ...s.jobs, ...s.offers, ...s.events, ...s.log].map((x) => x.id),
      );
      if (s.resilience.incident) allIds.add(s.resilience.incident.id);
      for (const id of rackIds) {
        if (allIds.has(id))
          throw new Error('Rack-ID kollidiert mit einer Geräte- oder Auftrags-ID.');
        allIds.add(id);
      }
      const maxId = [...allIds].reduce((max, id) => {
        const match = /-(\d+)$/.exec(id);
        return match ? Math.max(max, Number(match[1])) : max;
      }, 0);
      s.nextId = Math.max(s.nextId, maxId + 1);
      if (s.nextId > 1e9) throw new Error('nextId liegt außerhalb des unterstützten Bereichs.');
      return s;
    }
    return { normalizeV3 };
  };
});
