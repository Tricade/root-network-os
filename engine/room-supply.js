/** Explicit room connections to shared plant; local capacity is never counted twice. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['room-supply'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    const SUPPLY_MODES = {
      local: 'Lokal',
      central: 'Zentral',
      hybrid: 'Zentral mit lokaler Reserve',
      ups: 'Lokaler Strom mit zentraler USV',
    };
    // Room objects are mutated in place; membership changes only append or
    // replace the array. Weak keys keep caches out of saves and avoid retention.
    const roomCache = new WeakMap();
    function roomState(s, id) {
      const source = s.business?.rooms;
      if (!source) return null;
      let cached = roomCache.get(source);
      if (!cached || cached.length !== source.length) {
        cached = { length: source.length, byId: new Map(source.map((r) => [r.roomId, r])) };
        roomCache.set(source, cached);
      }
      return cached.byId.get(id);
    }
    function roomSupply(s, id) {
      return (
        roomState(s, id)?.supply || {
          cooling: 'hybrid',
          power: 'hybrid',
        }
      );
    }
    function conversionPrice(system, mode, racks) {
      return Math.ceil(
        (system === 'power' ? 3200 : 4200) * Math.max(1, racks) * (mode === 'hybrid' ? 1.35 : 1),
      );
    }
    function supplyAllocation(s, activeRacks) {
      const rooms = new Map((s.business?.rooms || []).map((r) => [r.roomId, r]));
      const rows = new Map(
        s.facility.racks.map((r) => [
          r.id,
          { ...roomSupply(s, r.roomId), converting: Boolean(rooms.get(r.roomId)?.conversion) },
        ]),
      );
      const cooling = [...rows].filter(
        ([id, r]) => activeRacks.has(id) && r.cooling !== 'local' && !r.converting,
      );
      const power = [...rows].filter(
        ([id, r]) =>
          activeRacks.has(id) && ['central', 'hybrid'].includes(r.power) && !r.converting,
      );
      const ups = [...rows].filter(
        ([id, r]) => activeRacks.has(id) && r.power !== 'local' && !r.converting,
      );
      const levels = ctx.centralLevels(s),
        incident = s.resilience.incident;
      const coolingFailed = incident?.scope === 'central' && incident.system === 'cooling';
      const powerFailed = incident?.scope === 'central' && incident.system === 'power';
      for (const [id, row] of rows) {
        const active = activeRacks.has(id) && !row.converting;
        row.coolingW =
          active && row.cooling !== 'local' && !coolingFailed
            ? (levels.cooling * 3500) / Math.max(1, cooling.length)
            : 0;
        row.drawW =
          active && row.cooling !== 'local' && !coolingFailed
            ? (levels.cooling * 500) / Math.max(1, cooling.length)
            : 0;
        row.powerW =
          active && ['central', 'hybrid'].includes(row.power) && !powerFailed
            ? (levels.distribution * 6000) / Math.max(1, power.length)
            : 0;
        row.upsW =
          active && row.power !== 'local' ? (levels.ups * 3000) / Math.max(1, ups.length) : 0;
      }
      return rows;
    }
    function supplyQuote(s, p) {
      const room = s.business.rooms.find((r) => r.roomId === p.roomId),
        mode = p.mode,
        system = p.system;
      if (
        !room ||
        !['cooling', 'power'].includes(system) ||
        !Object.hasOwn(SUPPLY_MODES, mode) ||
        (system === 'cooling' && mode === 'ups')
      )
        return { enabled: false, reason: 'Ungültiger Versorgungsplan.', cost: 0 };
      const racks = s.facility.racks.filter((r) => r.roomId === room.roomId),
        key = mode === 'ups' ? 'ups' : system === 'power' ? 'distribution' : 'cooling';
      const cost = conversionPrice(system, mode, racks.length);
      let reason = '';
      if (room.conversion) reason = 'Dieser Raum wird bereits umgebaut.';
      else if (
        s.preventiveMaintenance?.operation &&
        racks.some((r) => r.id === s.preventiveMaintenance.operation.rackId)
      )
        reason = 'Eine vorbeugende Rackwartung läuft bereits.';
      else if (room.supply[system] === mode) reason = 'Diese Versorgung ist bereits aktiv.';
      else if (mode !== 'local' && (!ctx.serviceRoomOwned(s, key) || ctx.centralLevels(s)[key] < 1))
        reason = 'Baue und bestücke zuerst den zugehörigen Technikraum.';
      else if (ctx.globalIncident(s)) reason = 'Die laufende Krise muss zuerst behoben werden.';
      else if (s.credits < cost) reason = 'Das verfügbare Budget reicht nicht aus.';
      const hardware = ctx.hardwareSnapshot(s);
      // Reserve the design load even while a previous conversion has shut a
      // room down. Otherwise two pending conversions could promise the same plant.
      const designLoad = (r) =>
        Math.max(
          hardware.get(r.id).powerW,
          42 + hardware.get(r.id).servers.reduce((n, v) => n + v.nominalPowerW, 0),
        );
      const demand = racks.reduce((sum, r) => sum + designLoad(r), 0);
      const centralCapacity =
        ctx.centralLevels(s)[key] * (key === 'ups' ? 3000 : system === 'power' ? 6000 : 3500);
      const other = s.facility.racks.filter((r) => {
        const plan = roomState(s, r.roomId)?.conversion;
        const target = plan?.system === system ? plan.mode : roomSupply(s, r.roomId)[system];
        return (
          r.roomId !== room.roomId &&
          (key === 'distribution' ? ['central', 'hybrid'].includes(target) : target !== 'local')
        );
      });
      const otherDemand = other.reduce((sum, r) => sum + designLoad(r), 0);
      if (
        !reason &&
        ['central', 'ups'].includes(mode) &&
        centralCapacity < (demand + otherDemand) * (system === 'cooling' ? 1.4 : 1.1)
      )
        reason = 'Die Zentralanlage hat zu wenig Reserve für alle angeschlossenen Räume.';
      return {
        enabled: !reason,
        reason,
        label: 'Raumversorgung umbauen',
        cost,
        duration: 180,
        quotedRacks: Math.max(1, racks.length),
        centralCapacity,
        demand,
        otherDemand,
      };
    }
    function applySupply(s, action, p) {
      if (action !== 'convertRoomSupply') return null;
      const q = supplyQuote(s, p);
      if (!q.enabled) return { ok: false, message: q.reason };
      s.credits -= q.cost;
      s.business.rooms.find((r) => r.roomId === p.roomId).conversion = {
        system: p.system,
        mode: p.mode,
        remaining: q.duration,
        total: q.duration,
        cost: q.cost,
        quotedRacks: q.quotedRacks,
      };
      ctx.addLog(
        s,
        'system',
        'Raumumbau begonnen. Der betroffene Raum ist für drei Minuten offline.',
      );
      return { ok: true, message: 'Umbau gestartet. Andere Räume arbeiten weiter.' };
    }
    function advanceSupply(s, dt) {
      for (const room of s.business.rooms) {
        const p = room.conversion;
        if (!p) continue;
        p.remaining = Math.max(0, p.remaining - dt);
        if (!p.remaining) {
          room.supply[p.system] = p.mode;
          room.conversion = null;
          ctx.addLog(s, 'success', 'Raumversorgung umgebaut. Der Bereich ist wieder verfügbar.');
        }
      }
    }
    return {
      SUPPLY_MODES,
      roomState,
      roomSupply,
      supplyAllocation,
      supplyQuote,
      applySupply,
      advanceSupply,
      conversionPrice,
    };
  };
});
