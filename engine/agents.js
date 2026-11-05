/** Agents: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['agents'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const addLog = (...args) => context.addLog(...args);
    const cashReason = (...args) => context.cashReason(...args);
    // Above the bounded maximum passive research forgone during this short
    // assignment, so developing an analyst cannot make research missions worse.
    function missionResearch(a, terms = context.RESEARCH_TERMS) {
      if (terms === 1)
        return (
          8 + a.level * (a.role === 'analyst' ? 18 : 9) + (a.focus === 'research' ? 6 * a.level : 0)
        );
      const expertise = context.researchExpertise(a.level, a.role, a.focus);
      return Math.ceil(6 + 36 * context.researchStaffShare(expertise));
    }

    function getAgentOperations(s) {
      const customers = context.customerReadModel(s);
      const r = s.resilience,
        activeEffects = [];
      if (r.agentEffects.diagnoseRemaining > 0)
        activeEffects.push({
          kind: 'diagnose',
          label: 'Risikodiagnose aktiv',
          remaining: r.agentEffects.diagnoseRemaining,
        });
      if (r.agentEffects.optimizeRemaining > 0)
        activeEffects.push({
          kind: 'optimize',
          label: 'Optimierungsprofil aktiv',
          remaining: r.agentEffects.optimizeRemaining,
        });
      const paused = context.globalIncident(s);
      const agents = s.agents.map((agent) => {
        const project = s.operations?.projects.find((p) => p.agentId === agent.id);
        const cooldown = Math.max(0, agent.cooldownUntil - s.time);
        const customer = customers.assignments.get(agent.id);
        const maintenance = s.preventiveMaintenance?.operation;
        const assignment =
          maintenance?.agentId === agent.id
            ? {
                kind: 'preventive',
                label: 'Vorbeugende Rackwartung',
                remaining: maintenance.remaining,
                total: maintenance.total,
              }
            : customer
              ? {
                  kind: 'customer',
                  label:
                    customer.work === 'setup'
                      ? 'Kundeneinrichtung'
                      : customer.work === 'growth'
                        ? 'Kundenerweiterung'
                        : customer.work === 'retention'
                          ? 'Kundenrückgewinnung'
                          : 'Kundenbetreuung',
                  remaining: customer.workRemaining,
                  total: customer.workTotal,
                }
              : agent.assignment
                ? {
                    kind: agent.assignment.kind,
                    label: agent.assignment.label,
                    remaining: agent.assignment.remaining,
                    total: agent.assignment.total,
                  }
                : project
                  ? {
                      kind: 'project',
                      label: context.PROJECTS[project.kind].name,
                      remaining: project.remaining,
                      total: project.total,
                    }
                  : null;
        const definitions = [
          {
            key: 'diagnose',
            label: 'Netzdiagnose',
            base: 30,
            duration: agent.role === 'engineer' ? 90 : 120,
            result:
              'Verringert das Störungsrisiko um bis zu 12 Prozentpunkte pro Stunde für 20 Minuten.',
          },
          {
            key: 'optimize',
            label: 'Last optimieren',
            base: 60,
            duration: agent.role === 'operator' ? 120 : 180,
            result: 'Erhöht den Auftragsdurchsatz um 15% für 15 Minuten.',
          },
          {
            key: 'research',
            label: 'Forschungsauftrag',
            base: 100,
            duration: agent.role === 'analyst' ? 240 : 300,
            result: `${missionResearch(agent)} Forschungspunkte bei Abschluss.`,
          },
        ];
        const options = definitions.map((def) => {
          const costValue = Math.ceil(
            def.base * (1 + Math.min(20, Math.max(0, s.sector - 1)) * 0.12),
          );
          let reason;
          if (!context.agentAvailable(s, agent))
            reason = 'Dieser Agent wartet sich selbst und kehrt automatisch zurück.';
          else if (paused)
            reason = 'Krisenbetrieb: Einsätze beginnen erst nach der Wiederherstellung.';
          else if (s.operations?.projects.some((p) => p.agentId === agent.id))
            reason = 'Dieser Agent arbeitet an einem Langzeitprojekt.';
          else if (assignment)
            reason = `${agent.name} ist bereits im Einsatz: ${assignment.label}.`;
          else if (cooldown > 0) reason = `Wieder verfügbar in ${Math.ceil(cooldown)} Sekunden.`;
          else if (s.agents.some((other) => other.assignment && other.assignment.kind === def.key))
            reason = 'Ein gleicher Einsatz läuft bereits; Wirkungen lassen sich nicht stapeln.';
          else if (def.key === 'diagnose' && r.agentEffects.diagnoseRemaining > 0)
            reason = 'Eine Diagnosewirkung ist bereits aktiv.';
          else if (def.key === 'optimize' && r.agentEffects.optimizeRemaining > 0)
            reason = 'Eine Optimierungswirkung ist bereits aktiv.';
          else reason = cashReason(s, costValue);
          return {
            key: def.key,
            label: def.label,
            description: `${costValue} Credits, ${def.duration} Sekunden Einsatzzeit, danach 300 Sekunden Abklingzeit. ${def.result} ${agent.name} liefert während des Einsatzes keine normale Betriebsleistung.`,
            cost: costValue,
            duration: def.duration,
            cooldown: 300,
            enabled: !reason,
            reason,
          };
        });
        return { id: agent.id, assignment, cooldown, options, ...context.agentHealth(s, agent) };
      });
      return {
        effects: activeEffects,
        agents,
        paused,
        pausedReason: paused
          ? 'Alle laufenden Agenteneinsätze bleiben angehalten, bis die offene Krise behoben ist.'
          : '',
      };
    }

    function finishAgentMission(s, agent) {
      const assignment = agent.assignment;
      if (!assignment) return;
      if (assignment.kind === 'diagnose') s.resilience.agentEffects.diagnoseRemaining = 1200;
      else if (assignment.kind === 'optimize') s.resilience.agentEffects.optimizeRemaining = 900;
      else if (assignment.kind === 'research') {
        const reward = missionResearch(agent, context.readResearchTerms(assignment.terms));
        s.research = Math.min(1e15, s.research + reward);
        addLog(
          s,
          'success',
          `${agent.name} hat den Forschungsauftrag abgeschlossen: +${reward} Forschungspunkte.`,
        );
      }
      if (assignment.kind !== 'research')
        addLog(
          s,
          'success',
          `${agent.name} hat den Einsatz „${assignment.label}“ abgeschlossen. Die Wirkung ist aktiv.`,
        );
      agent.assignment = null;
      agent.cooldownUntil = s.time + 300;
    }
    return { getAgentOperations, finishAgentMission, missionResearch };
  };
});
