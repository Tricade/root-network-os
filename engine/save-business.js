/** Strict v4 service validation. Unknown fields are never used as executable plans. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['save-business'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    function checkedNumber(value, min, max, integer = false) {
      if (
        !Number.isFinite(value) ||
        value < min ||
        value > max ||
        (integer && !Number.isSafeInteger(value))
      )
        throw new Error('Ungültiger Betriebswert.');
      return value;
    }
    function checkedBoolean(value) {
      if (typeof value !== 'boolean') throw new Error('Ungültiger Betriebsplan.');
      return value;
    }
    function checkedRecord(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Ungültiger Betriebsplan.');
      return value;
    }
    function normalizeBusiness(input, s) {
      const b = checkedRecord(input),
        owned = new Set(s.facility.building.rooms.map((r) => r.id));
      if (b.version !== 1 || !Array.isArray(b.rooms) || b.rooms.length !== owned.size)
        throw new Error('Unvollständiger Raumplan.');
      const seen = new Set(),
        managers = new Set(),
        agents = new Set(s.agents.map((a) => a.id));
      const rooms = b.rooms.map((value) => {
        const r = checkedRecord(value);
        if (!owned.has(r.roomId) || seen.has(r.roomId)) throw new Error('Ungültiger Betriebsraum.');
        seen.add(r.roomId);
        if (!Object.hasOwn(ctx.PROFILES, r.profile) || ![0, 0.2, 0.35].includes(r.reserve))
          throw new Error('Ungültiges Raumprofil.');
        if (r.managerId !== null && (!agents.has(r.managerId) || managers.has(r.managerId)))
          throw new Error('Ungültige Teamleitung.');
        if (r.managerId) managers.add(r.managerId);
        const supply = checkedRecord(r.supply),
          kinds = new Set();
        for (const system of ['cooling', 'power'])
          if (
            !Object.hasOwn(ctx.SUPPLY_MODES, supply[system]) ||
            (system === 'cooling' && supply[system] === 'ups')
          )
            throw new Error('Ungültige Raumversorgung.');
        let conversion = null;
        if (r.conversion !== null) {
          const c = checkedRecord(r.conversion);
          if (
            !['cooling', 'power'].includes(c.system) ||
            !Object.hasOwn(ctx.SUPPLY_MODES, c.mode) ||
            c.mode === supply[c.system] ||
            c.total !== 180 ||
            (c.system === 'cooling' && c.mode === 'ups')
          )
            throw new Error('Ungültiger Versorgungsumbau.');
          conversion = {
            system: c.system,
            mode: c.mode,
            total: 180,
            remaining: checkedNumber(c.remaining, Number.MIN_VALUE, 180),
            cost: checkedNumber(c.cost, 0, 1e12),
            quotedRacks: checkedNumber(c.quotedRacks, 1, 6, true),
          };
          if (conversion.cost !== ctx.conversionPrice(c.system, c.mode, conversion.quotedRacks))
            throw new Error('Ungültiger bezahlter Umbaupreis.');
          if (
            conversion.quotedRacks !==
            Math.max(1, s.facility.racks.filter((x) => x.roomId === r.roomId).length)
          )
            throw new Error('Raumbelegung während des Umbaus verändert.');
        }
        for (const system of ['cooling', 'power'])
          for (const mode of [
            supply[system],
            conversion?.system === system ? conversion.mode : 'local',
          ]) {
            if (mode === 'local') continue;
            const key = mode === 'ups' ? 'ups' : system === 'power' ? 'distribution' : 'cooling';
            if (s.facility.central[key] < 1 || !s.facility.building.specialRooms.includes(key))
              throw new Error('Zentralanschluss ohne gebaute Anlage.');
          }
        if (!Array.isArray(r.groups) || r.groups.length !== Object.keys(ctx.SERVICES).length)
          throw new Error('Unvollständiger Kundenplan.');
        const groups = r.groups.map((value) => {
          const g = checkedRecord(value);
          if (!Object.hasOwn(ctx.SERVICES, g.kind) || kinds.has(g.kind))
            throw new Error('Ungültige Kundengruppe.');
          kinds.add(g.kind);
          const units = checkedNumber(g.units, 0, 1e6, true),
            pending = checkedNumber(g.pending, 0, 1e6, true),
            onboarding = checkedNumber(g.onboarding, 0, 600);
          if (units + pending > 1e6 || Boolean(pending) !== Boolean(onboarding))
            throw new Error('Ungültige Kundenaufnahme.');
          return {
            kind: g.kind,
            units,
            pending,
            onboarding,
            remaining: checkedNumber(g.remaining, 0, 259200),
            renew: checkedBoolean(g.renew),
            premium: checkedBoolean(g.premium),
            nextPremium: checkedBoolean(g.nextPremium),
          };
        });
        return {
          roomId: r.roomId,
          profile: r.profile,
          reserve: r.reserve,
          crew: checkedNumber(r.crew, 1, 100000, true),
          managerId: r.managerId,
          changeRemaining: checkedNumber(r.changeRemaining, 0, 120),
          supply: { cooling: supply.cooling, power: supply.power },
          conversion,
          groups,
        };
      });
      return {
        version: 1,
        rooms,
        migrated: checkedBoolean(b.migrated),
        transitionUntil: checkedNumber(b.transitionUntil, 0, s.time + 43200),
        revenue: checkedNumber(b.revenue, 0, 1e15),
        wages: checkedNumber(b.wages, 0, 1e15),
        delivered: checkedNumber(b.delivered, 0, 1e15),
        unserved: checkedNumber(b.unserved, 0, 1e15),
      };
    }
    return { checkedNumber, checkedBoolean, checkedRecord, normalizeBusiness };
  };
});
