/** Long agent assignments trade current workforce/management for fixed rewards. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {}).projects = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    const PROJECTS = {
      audit: { name: 'Betriebsaudit', duration: 1800 },
      research: { name: 'Forschungsprojekt', duration: 3600 },
      tuning: { name: 'Kapazitätsanalyse', duration: 7200 },
    };
    function projectReward(kind, level, role, focus, synthesis) {
      const duration = PROJECTS[kind].duration;
      const foregone =
        (role === 'analyst' ? level * 0.026 : 0) + (focus === 'research' ? level * 0.012 : 0);
      return Math.ceil(
        duration *
          (0.03 + foregone) *
          (1 + (0.6 * synthesis) / (synthesis + 12)) *
          (kind === 'research' ? 1.5 : 1.15),
      );
    }
    function projectQuote(s, p) {
      const agent = s.agents.find((a) => a.id === p.id),
        def = PROJECTS[p.kind];
      if (!agent || !def) return { enabled: false, reason: 'Unbekannter Projektauftrag.', cost: 0 };
      const cost = Math.ceil(180 * Math.sqrt(agent.level) * (def.duration / 1800));
      const reason = !ctx.agentAvailable(s, agent)
        ? 'Dieser Agent wartet sich selbst und kehrt automatisch zurück.'
        : !ctx.agentProductive(s, agent)
          ? 'Dieser Agent ist bereits im Einsatz.'
          : agent.cooldownUntil > s.time
            ? 'Dieser Agent benötigt eine Einsatzpause.'
            : ctx.globalIncident(s)
              ? 'Krisenbetrieb: Projekte warten auf die Wiederherstellung.'
              : s.credits < cost
                ? 'Das verfügbare Budget reicht nicht aus.'
                : '';
      return {
        enabled: !reason,
        reason,
        cost,
        duration: def.duration,
        label: def.name,
        kind: p.kind,
        research: projectReward(
          p.kind,
          agent.level,
          agent.role,
          agent.focus,
          s.upgrades.synthesis || 0,
        ),
        reputation: p.kind === 'audit' ? Math.ceil(15 * Math.sqrt(agent.level)) : 0,
      };
    }
    function applyProjects(s, action, p) {
      if (action !== 'startProject') return null;
      const q = projectQuote(s, p);
      if (!q.enabled) return { ok: false, message: q.reason };
      const a = s.agents.find((a) => a.id === p.id);
      s.credits -= q.cost;
      s.operations.projects.push({
        agentId: a.id,
        kind: p.kind,
        remaining: q.duration,
        total: q.duration,
        cost: q.cost,
        level: a.level,
        role: a.role,
        focus: a.focus,
        synthesis: s.upgrades.synthesis || 0,
        research: q.research,
        reputation: q.reputation,
      });
      ctx.addLog(s, 'system', `${a.name}: ${q.label} gestartet.`);
      return {
        ok: true,
        message: 'Projekt gestartet. Teamleitung und regulärer Beitrag pausieren.',
      };
    }
    function advanceProjects(s, dt = 1) {
      s.operations.projects = s.operations.projects.filter((p) => {
        if (
          ctx.globalIncident(s) ||
          !ctx.agentAvailable(
            s,
            s.agents.find((a) => a.id === p.agentId),
          )
        )
          return true;
        p.remaining = Math.max(0, p.remaining - dt);
        if (p.remaining) return true;
        s.research += p.research;
        s.reputation = Math.min(1e6, s.reputation + p.reputation);
        if (p.kind === 'tuning')
          s.resilience.agentEffects.optimizeRemaining = Math.max(
            900,
            s.resilience.agentEffects.optimizeRemaining,
          );
        const a = s.agents.find((a) => a.id === p.agentId);
        a.cooldownUntil = s.time + 300;
        ctx.addLog(
          s,
          'success',
          `${PROJECTS[p.kind].name} abgeschlossen: ${p.research} Forschungspunkte.`,
        );
        return false;
      });
    }
    return { PROJECTS, projectReward, projectQuote, applyProjects, advanceProjects };
  };
});
