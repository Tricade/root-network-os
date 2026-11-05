/** Actions workforce: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['actions-workforce'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    const { FOCI } = context;
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const addLog = (...args) => context.addLog(...args);
    const getAgentOperations = (...args) => context.getAgentOperations(...args);

    function applyWorkforce(s, action, payload, m) {
      const fail = (message) => ({ ok: false, message });
      if (action === 'setAgentFocus') {
        const x = s.agents.find((v) => v.id === payload.id);
        if (!x) return fail('Agent nicht gefunden.');
        if (
          x.assignment ||
          context.preventiveAgentBusy(s, x.id) ||
          s.operations.projects.some((p) => p.agentId === x.id) ||
          context.customerAssignment(s, x.id)
        )
          return fail('Der Agent ist im Einsatz; der Schwerpunkt lässt sich danach wieder ändern.');
        if (!FOCI.includes(payload.focus)) return fail('Dieser Schwerpunkt ist ungültig.');
        x.focus = payload.focus;
        return { ok: true, message: 'Schwerpunkt angepasst.' };
      }
      if (action === 'upgradeAgent') {
        const quote = context.quoteAgentUpgrade(s, payload.id);
        if (!quote.enabled) return fail(quote.reason);
        const x = s.agents.find((v) => v.id === payload.id);
        s.credits -= quote.cost;
        x.level++;
        addLog(s, 'success', `${x.name} erreicht Stufe ${x.level}.`);
        return { ok: true, message: 'Agent entwickelt.' };
      }
      if (action === 'specializeAgent') {
        const q = context.quoteAgentSpecialty(s, payload.id, payload.specialty);
        if (!q.enabled) return fail(q.reason);
        const agent = s.agents.find((a) => a.id === payload.id);
        s.credits -= q.cost;
        agent.specialty = payload.specialty;
        addLog(
          s,
          'success',
          `${agent.name}: Spezialisierung „${context.AGENT_SPECIALTIES[agent.specialty].name}“ aktiviert.`,
        );
        return { ok: true, message: 'Spezialisierung aktiviert.' };
      }
      if (action === 'dispatchAgent') {
        const agent = s.agents.find((x) => x.id === payload.id);
        if (!agent) return fail('Agent nicht gefunden.');
        const option = getAgentOperations(s)
          .agents.find((x) => x.id === agent.id)
          ?.options.find((x) => x.key === payload.mission);
        if (!option) return fail('Dieser Einsatz ist unbekannt.');
        if (!option.enabled)
          return fail(option.reason || 'Dieser Einsatz ist derzeit nicht verfügbar.');
        s.credits -= option.cost;
        agent.assignment = {
          kind: option.key,
          label: option.label,
          remaining: option.duration,
          total: option.duration,
          ...(option.key === 'research' ? { terms: context.RESEARCH_TERMS } : {}),
        };
        addLog(
          s,
          'system',
          `${agent.name} beginnt „${option.label}“ für ${option.cost} Credits; normaler Betriebsausstoß ruht für ${option.duration} Sekunden.`,
        );
        return { ok: true, message: `${option.label} für ${agent.name} gestartet.` };
      }
      return null;
    }
    return { applyWorkforce };
  };
});
