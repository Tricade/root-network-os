/** Agent development previews use the same rates and caps as the simulation. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['agent-development'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    const AGENT_SPECIALTY_LEVEL = 14;
    const AGENT_SPECIALTIES = {
      service: { name: 'Kundendienst', base: 0.12, cap: 0.32 },
      maintenance: { name: 'Rackwartung', base: 0.15, cap: 0.35, role: 'engineer' },
      projects: { name: 'Projektabnahme', base: 0.035, cap: 0.1 },
    };

    function agentSpecialtyBonus(a, specialty) {
      if (a.specialty !== specialty || a.level < AGENT_SPECIALTY_LEVEL) return 0;
      const def = AGENT_SPECIALTIES[specialty];
      const experience = a.level - AGENT_SPECIALTY_LEVEL;
      return def.base + ((def.cap - def.base) * experience) / (experience + 12);
    }

    function developmentLock(s, a) {
      if (!a) return 'Agent nicht gefunden.';
      if (
        a.assignment ||
        ctx.preventiveAgentBusy(s, a.id) ||
        s.operations.projects.some((p) => p.agentId === a.id) ||
        ctx.customerAssignment(s, a.id)
      )
        return 'Der Agent ist im Einsatz und kann erst danach entwickelt werden.';
      return '';
    }

    function quoteAgentSpecialty(s, id, specialty) {
      const a = s.agents.find((agent) => agent.id === id);
      const def = Object.hasOwn(AGENT_SPECIALTIES, specialty) ? AGENT_SPECIALTIES[specialty] : null;
      const cost = a && def ? Math.ceil(ctx.cost(s, 'agentUpgrade', id) * 0.4) : 0;
      let reason = developmentLock(s, a);
      if (!reason) {
        if (!def) reason = 'Unbekannte Spezialisierung.';
        else if (a.level < AGENT_SPECIALTY_LEVEL)
          reason = 'Spezialisierungen sind ab Stufe 14 verfügbar.';
        else if (a.specialty === specialty) reason = 'Diese Spezialisierung ist bereits aktiv.';
        else if (def.role && a.role !== def.role)
          reason = 'Diese Spezialisierung benötigt einen Techniker.';
        else if (s.credits < cost) reason = `Es fehlen ${Math.ceil(cost - s.credits)} Credits.`;
      }
      return {
        enabled: !reason,
        reason,
        cost,
        bonus: a && def ? agentSpecialtyBonus({ ...a, specialty }, specialty) : 0,
      };
    }

    function quoteAgentUpgrade(s, id) {
      const a = s.agents.find((a) => a.id === id);
      const cost = a ? ctx.cost(s, 'agentUpgrade', id) : 0;
      let reason = developmentLock(s, a);
      if (!reason && a.level >= 10000)
        reason = 'Dieser Agent hat die höchste Entwicklungsstufe erreicht.';
      if (!reason && s.credits < cost) reason = `Es fehlen ${Math.ceil(cost - s.credits)} Credits.`;
      return { enabled: !reason, reason, cost };
    }
    function customerWorkSpeed(s, a) {
      return (
        Math.min(1.5, 1 + Math.max(0, a.level - 1) * 0.04) *
        (1 + agentSpecialtyBonus(a, 'service')) *
        ctx.agentEffects(a).work *
        ctx.researchEffects(s).onboarding
      );
    }
    function maintenanceWorkSpeed(a) {
      return (
        (1 + Math.min(1.5, Math.sqrt(Math.max(0, a.level - 1)) * 0.2)) *
        (1 + agentSpecialtyBonus(a, 'maintenance'))
      );
    }
    function managerMultiplier(a) {
      return a
        ? 1 +
            Math.min(
              0.2,
              Math.log2(1 + a.level) * 0.025 +
                (a.role === 'operator' ? 0.025 : 0) +
                ctx.agentEffects(a).management,
            )
        : 1;
    }
    function serverWearPerHour(s, m) {
      const customers = ctx.customerReadModel(s);
      const active = s.agents.filter((a) => ctx.agentProductive(s, a, customers.assignments));
      const care = active
        .filter((a) => a.role === 'engineer')
        .reduce((n, a) => n + a.level * ctx.agentEffects(a).care, 0);
      const focus = active
        .filter((a) => a.focus === 'maintenance')
        .reduce((n, a) => n + a.level * ctx.agentEffects(a).care, 0);
      return (
        Math.max(
          0.002,
          (0.012 +
            Math.max(0, m.heat - 8) * 0.0015 +
            Math.max(0, m.load - 0.65) * 0.035 +
            (s.policies.power === 'performance' ? 0.025 : 0) +
            (!s.policies.autorepair ? 0.018 : 0)) *
            Math.max(
              0.25,
              1 -
                Math.min(
                  0.65,
                  care * 0.045 +
                    focus * 0.025 +
                    (s.upgrades.cooling || 0) * 0.008 +
                    (s.policies.power === 'eco' ? 0.18 : 0) +
                    (s.policies.autorepair ? 0.14 : 0),
                ),
            ),
        ) * ctx.researchEffects(s).wear
      );
    }
    function getAgentDevelopment(s, id) {
      const a = s.agents.find((a) => a.id === id);
      if (!a) return null;
      // Copy only the changed agent; metric reads are pure, so the saved state is untouched.
      const next = { ...a, level: Math.min(10000, a.level + 1) };
      const changed = { ...s, agents: s.agents.map((agent) => (agent.id === id ? next : agent)) };
      const before = ctx.getMetrics(s),
        after = ctx.getMetrics(changed);
      const rates = (state, agent, m) => ({
        work: m.workPerSecond * 60,
        research: m.researchPerSecond * 60,
        risk: m.riskPerHour,
        wear: serverWearPerHour(state, m),
        wage: ctx.agentWage(agent) * 3600,
        customerSeconds: 600 / customerWorkSpeed(state, agent),
        maintenanceSeconds: 270 / maintenanceWorkSpeed(agent),
        management: (managerMultiplier(agent) - 1) * 100,
        missionResearch: ctx.missionResearch(agent),
      });
      return {
        id,
        level: a.level,
        nextLevel: next.level,
        ...quoteAgentUpgrade(s, id),
        productive: ctx.agentProductive(s, a),
        before: rates(s, a, before),
        after: rates(changed, next, after),
      };
    }
    return {
      AGENT_SPECIALTY_LEVEL,
      AGENT_SPECIALTIES,
      agentSpecialtyBonus,
      quoteAgentSpecialty,
      quoteAgentUpgrade,
      getAgentDevelopment,
      customerWorkSpeed,
      maintenanceWorkSpeed,
      managerMultiplier,
      serverWearPerHour,
    };
  };
});
