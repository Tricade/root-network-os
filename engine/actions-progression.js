/** Actions progression: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['actions-progression'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    const { catalog, clamp } = context;
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const addLog = (...args) => context.addLog(...args);
    const autoContract = (...args) => context.autoContract(...args);
    const cost = (...args) => context.cost(...args);
    const gpuUnavailableReason = (...args) => context.gpuUnavailableReason(...args);

    function applyProgression(s, action, payload, m) {
      const fail = (message) => ({ ok: false, message });
      if (action === 'acceptJob') {
        const j = s.offers.find((v) => v.id === payload.id);
        if (!j) return fail('Dieser Auftrag ist nicht mehr verfügbar.');
        if (s.jobs.length >= m.jobLimit) return fail('Alle Auftragsplätze sind belegt.');
        if (context.globalIncident(s))
          return fail('Während einer offenen Krise bleiben neue Aufträge in der Warteschlange.');
        if (
          s.business &&
          j.kind === 'ai' &&
          (j.gpuDemand || 1) >
            m.admissionResources.gpu -
              s.jobs.reduce((n, x) => n + (x.kind === 'ai' ? x.gpuDemand || 1 : 0), 0) +
              1e-9
        )
          return fail(
            m.freeResources.gpu <= 0
              ? gpuUnavailableReason(s)
              : 'Dafür sind nicht genügend freie GPUs verfügbar.',
          );
        if (
          s.business
            ? !context.jobsFit(s, j, m.admissionResources)
            : m.usedCapacity + j.load > m.capacity * 1.08
        )
          return fail('Dafür fehlt derzeit Serverkapazität.');
        if (!s.business && j.kind === 'ai' && (j.gpuDemand || 1) > m.gpuCapacity - m.gpuUsed + 1e-9)
          return fail(
            m.gpuCapacity <= 0
              ? gpuUnavailableReason(s)
              : 'Dafür sind nicht genügend freie GPUs verfügbar.',
          );
        s.offers = s.offers.filter((v) => v.id !== j.id);
        s.jobs.push(j);
        addLog(s, 'system', `Auftrag angenommen: ${j.title}.`);
        return { ok: true, message: 'Auftrag angenommen.' };
      }
      if (action === 'declineJob') {
        const j = s.offers.find((v) => v.id === payload.id);
        if (!j) return fail('Dieser Auftrag ist nicht mehr verfügbar.');
        s.offers = s.offers.filter((v) => v.id !== j.id);
        addLog(s, 'system', `Auftrag abgelehnt: ${j.title}.`);
        return { ok: true, message: 'Auftrag aus der Liste entfernt.' };
      }
      if (action === 'setPolicy') {
        const { key, value } = payload;
        const valid =
          key === 'power'
            ? ['balanced', 'performance', 'eco'].includes(value)
            : key === 'priority'
              ? ['balanced', 'income', 'research'].includes(value)
              : key === 'autocontract' || key === 'autorepair' || key === 'autobackup'
                ? typeof value === 'boolean'
                : key === 'repairBudget'
                  ? [0, 100, 300, 1000].includes(value)
                  : key === 'reserve'
                    ? [0, 250, 1000, 5000].includes(value)
                    : false;
        if (!valid) return fail('Diese Richtlinieneinstellung ist ungültig.');
        s.policies[key] = value;
        if (key === 'repairBudget') s.operations.limits.repair = null;
        if (key === 'reserve') s.operations.limits.reserve = null;
        addLog(s, 'system', 'Netzwerkrichtlinie aktualisiert.');
        if (key === 'autocontract' && value) autoContract(s);
        return { ok: true, message: 'Richtlinie aktualisiert.' };
      }
      if (action === 'resolveEvent') {
        if (context.globalIncident(s))
          return fail('Ereignisse bleiben während des Krisenbetriebs in der Warteschlange.');
        const e = s.events.find((v) => v.id === payload.id);
        if (!e) return fail('Diese Entscheidung ist nicht mehr verfügbar.');
        const index = Number(payload.choice);
        if (!Number.isInteger(index) || !e.choices[index])
          return fail('Diese Auswahl ist ungültig.');
        const choice = e.choices[index];
        const outcomes = {
          signal_analyze: [0, 8, 1],
          signal_license: [48, 0, 0],
          grant_funds: [85, 0, 0],
          grant_research: [0, 12, 2],
          maintenance_care: [0, 4, 4],
          maintenance_study: [55, 0, 1],
          client_help: [72, 0, 1],
          client_knowledge: [0, 9, 2],
          discovery_research: [0, 15, 0],
          discovery_publish: [42, 0, 3],
          procurement_funds: [105, 0, 0],
          procurement_evaluate: [0, 11, 2],
        };
        const outcome = outcomes[choice.key];
        if (!outcome) return fail('Diese Auswahl wird nicht unterstützt.');
        s.credits += outcome[0];
        s.lifetimeCredits += outcome[0];
        s.research += outcome[1];
        s.reputation = clamp(s.reputation + outcome[2], 0, 1e6);
        addLog(s, 'success', `${e.title}: ${choice.label} umgesetzt.`);
        s.events = s.events.filter((v) => v.id !== e.id);
        s.counters.events++;
        return { ok: true, message: 'Entscheidung umgesetzt.' };
      }
      if (action === 'expandSector') {
        if (s.facility.centralOperation)
          return fail(
            'Während eines zentralen Infrastruktur-Ausbaus kann kein weiterer Sektor erschlossen werden.',
          );
        if (s.sector >= 1e6) return fail('Die maximale Zahl von Sektoren wurde erreicht.');
        const price = cost(s, 'sector');
        if (!m.expansionReady)
          return fail(
            `Sektor ${s.sector + 1} ist noch nicht bereit. Schließe weitere Aufträge ab und baue das Netz aus.`,
          );
        if (s.credits < price) return fail(`Es fehlen ${Math.ceil(price - s.credits)} Credits.`);
        s.credits -= price;
        s.sector++;
        s.counters.sectors++;
        addLog(
          s,
          'success',
          `Sektor ${s.sector} erschlossen. Neue Verträge und Ausbauplätze sind verfügbar.`,
        );
        return { ok: true, message: `Sektor ${s.sector} erschlossen.` };
      }
      if (action === 'claimAchievement') {
        const a = catalog.achievements.find((v) => v.id === payload.id);
        if (!a) return fail('Dieser Meilenstein ist unbekannt.');
        if (s.achievements[a.id]) return fail('Dieser Meilenstein wurde bereits eingelöst.');
        if (!s.achievementUnlocks[a.id] && !a.check(s))
          return fail('Dieser Meilenstein ist noch nicht freigeschaltet.');
        s.achievements[a.id] = true;
        s.achievementUnlocks[a.id] = true;
        s.credits += a.reward;
        s.lifetimeCredits += a.reward;
        addLog(s, 'success', `Meilenstein eingelöst: ${a.name} (+${a.reward} Credits).`);
        return { ok: true, message: `${a.name}: +${a.reward} Credits.` };
      }
      if (action === 'renameNetwork') {
        const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 36) : '';
        if (name.length < 2)
          return fail('Der Netzwerkname muss mindestens zwei Zeichen lang sein.');
        s.networkName = name;
        return { ok: true, message: 'Netzwerk umbenannt.' };
      }
      return null;
    }
    return { applyProgression };
  };
});
