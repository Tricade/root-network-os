/** Quotes and lifecycle for pooled customers and room operating profiles. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['services'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    const { SERVICES, PROFILES, RESOURCES } = ctx;
    function syncServiceRooms(s) {
      if (!s.business) return;
      const known = new Set(s.business.rooms.map((x) => x.roomId));
      for (const room of s.facility.building.rooms)
        if (!known.has(room.id)) s.business.rooms.push(ctx.roomDefaults(room.id));
    }
    function serviceQuote(s, action, p = {}) {
      const room = s.business?.rooms.find((r) => r.roomId === p.roomId);
      if (!room) return { enabled: false, reason: 'Raum nicht gefunden.', cost: 0 };
      const snapshot = ctx.serviceSnapshot(s);
      const model = snapshot.rooms.find((r) => r.roomId === p.roomId);
      let cost = 0,
        duration = 0,
        reason = '',
        label = 'Betriebsplan ändern',
        capacity = 0,
        resources = {};
      if (action === 'contractService') {
        const def = SERVICES[p.kind],
          units = Number(p.units),
          group = room.groups.find((g) => g.kind === p.kind);
        if (!def || !Number.isSafeInteger(units) || units < 1 || units > 1e6)
          reason = 'Ungültige Vertragsmenge.';
        else {
          const reserve = 1 - room.reserve,
            efficiency =
              (room.profile === def.profile ? 0.9 : 1) * ctx.researchEffects(s).serviceEfficiency;
          resources = ctx.groupDemand(
            room,
            { kind: p.kind, units, pending: 0 },
            false,
            ctx.researchEffects(s).serviceEfficiency,
          );
          const projects = ctx.zeroResources();
          for (const job of s.jobs)
            for (const [key, value] of Object.entries(ctx.jobResources(job)))
              projects[key] += value;
          capacity = Math.max(
            0,
            Math.floor(
              Math.min(
                model.crewCapacity - model.groups.reduce((n, g) => n + g.units + g.pending, 0),
                ...RESOURCES.filter((k) => def.needs[k]).map(
                  (k) =>
                    Math.min(
                      model.available[k] * reserve - model.reserved[k],
                      snapshot.committedFree[k] - projects[k],
                    ) /
                    (def.needs[k] * efficiency),
                ),
              ),
            ),
          );
          // The catalog charges an integer setup price per service unit.
          cost = Math.round(def.fee * 1800) * units;
          duration = 600;
          label = 'Kundenvertrag abschließen';
          if (s.sector < def.sector) reason = 'Diese Kundengruppe ist noch nicht freigeschaltet.';
          else if (group.pending) reason = 'Die Aufnahme dieser Kundengruppe läuft bereits.';
          else if (units > capacity || units + group.units > 1e6)
            reason = 'Kapazität oder Team fehlen für diese Zusage.';
        }
      } else if (action === 'configureServiceRoom') {
        if (!Object.hasOwn(PROFILES, p.profile) || ![0, 0.2, 0.35].includes(Number(p.reserve)))
          reason = 'Ungültiges Raumprofil.';
        else if (room.changeRemaining > 0) reason = 'Die Umstellung läuft bereits.';
        else if (room.profile === p.profile && room.reserve === Number(p.reserve))
          reason = 'Dieses Profil ist bereits aktiv.';
        cost = room.profile === p.profile ? 0 : Math.ceil(1200 * Math.max(1, model.racks));
        duration = 120;
        label = 'Raumprofil umstellen';
      } else if (action === 'hireCrew') {
        cost = Math.ceil(200 * Math.pow(room.crew, 1.35) * (1 + 0.08 * (s.sector - 1)));
        label = 'Betriebsteam erweitern';
        if (room.crew >= 100000) reason = 'Die Teamgrenze ist erreicht.';
      } else if (action === 'assignManager') {
        if (p.id !== null && !s.agents.some((a) => a.id === p.id)) reason = 'Agent nicht gefunden.';
        else if (
          p.id &&
          s.business.rooms.some((r) => r.roomId !== room.roomId && r.managerId === p.id)
        )
          reason = 'Dieser Agent leitet bereits einen anderen Bereich.';
      } else if (action === 'setServiceRenewal' || action === 'setServicePremium') {
        if (!room.groups.some((g) => g.kind === p.kind) || typeof p.value !== 'boolean')
          reason = 'Ungültiger Vertragsplan.';
        const racks = new Set(
          s.facility.racks.filter((r) => r.roomId === room.roomId).map((r) => r.id),
        );
        const nodes = s.servers.filter(
          (n) => racks.has(n.rackId) && n.powered && n.status === 'online',
        );
        if (action === 'setServicePremium' && p.value && (room.reserve < 0.2 || nodes.length < 2))
          reason = 'Premiumverträge benötigen Reserve und mindestens zwei aktive Knoten.';
      } else return { enabled: false, reason: 'Unbekannter Betriebsauftrag.', cost: 0 };
      if (!reason && s.credits < cost) reason = 'Das verfügbare Budget reicht nicht aus.';
      return { enabled: !reason, reason, cost, duration, label, capacity, resources };
    }
    function applyServices(s, action, p) {
      if (
        ![
          'contractService',
          'configureServiceRoom',
          'hireCrew',
          'assignManager',
          'setServiceRenewal',
          'setServicePremium',
        ].includes(action)
      )
        return null;
      const q = serviceQuote(s, action, p);
      if (!q.enabled) return { ok: false, message: q.reason };
      const room = s.business.rooms.find((r) => r.roomId === p.roomId),
        group = room.groups.find((g) => g.kind === p.kind);
      s.credits -= q.cost;
      if (action === 'contractService') {
        group.pending = Number(p.units);
        group.onboarding = q.duration;
      }
      if (action === 'configureServiceRoom') {
        room.profile = p.profile;
        room.reserve = Number(p.reserve);
        room.changeRemaining = q.duration;
      }
      if (action === 'hireCrew') room.crew++;
      if (action === 'assignManager') room.managerId = p.id;
      if (action === 'setServiceRenewal') {
        group.renew = p.value;
        for (const c of s.customers.contracts)
          if (c.roomId === p.roomId && c.kind === p.kind) c.renew = p.value;
      }
      if (action === 'setServicePremium') {
        group.nextPremium = p.value;
        if (!group.units && !group.pending) group.premium = p.value;
      }
      ctx.addLog(s, 'system', q.label);
      return {
        ok: true,
        message: q.duration ? 'Betriebsauftrag gestartet.' : 'Betriebsplan gespeichert.',
      };
    }
    function advanceServices(s, dt) {
      if (!s.business) return;
      for (const room of s.business.rooms)
        room.changeRemaining = Math.max(0, room.changeRemaining - dt);
    }
    function getBusinessModel(s, metrics = null) {
      const model = metrics?.serviceModel || ctx.serviceSnapshot(s);
      return {
        ...model,
        services: SERVICES,
        profiles: PROFILES,
        transitionRemaining: Math.max(0, s.business.transitionUntil - s.time),
      };
    }
    function migrateBusiness(s) {
      s.business = ctx.businessDefaults(s, true);
      // Map the old implicit customer base onto real, conservatively provisioned
      // services. Existing credits, accepted projects and hardware stay intact.
      const resources = ctx.roomResources(s);
      for (const room of s.business.rooms) {
        room.supply = {
          cooling: s.facility.central.cooling > 0 ? 'hybrid' : 'local',
          power:
            s.facility.central.distribution > 0
              ? 'hybrid'
              : s.facility.central.ups > 0
                ? 'ups'
                : 'local',
        };
        const available = { ...resources.get(room.roomId).installed };
        const kinds =
          available.gpu > 0
            ? ['inference', 'hosting', 'archive', 'database']
            : ['hosting', 'archive', 'database'];
        for (const kind of kinds) {
          const def = SERVICES[kind];
          if (s.sector < def.sector) continue;
          const units = Math.max(
            0,
            Math.floor(
              Math.min(
                ...RESOURCES.filter((k) => def.needs[k]).map(
                  (k) => (available[k] * 0.45) / def.needs[k],
                ),
              ),
            ),
          );
          room.groups.find((g) => g.kind === kind).units = units;
          for (const k of RESOURCES) available[k] -= units * (def.needs[k] || 0);
        }
        room.crew = Math.max(1, Math.ceil(room.groups.reduce((sum, g) => sum + g.units, 0) / 24));
      }
    }
    return {
      syncServiceRooms,
      serviceQuote,
      applyServices,
      advanceServices,
      getBusinessModel,
      migrateBusiness,
    };
  };
});
