/** Contracts: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['contracts'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    const { HARDWARE } = context;
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const getMetrics = (...args) => context.getMetrics(...args);
    const rand = (...args) => context.rand(...args);
    const uid = (...args) => context.uid(...args);

    function makeJob(s, tier = 0) {
      const gpuInstalled = s.servers.reduce(
        (sum, server) => sum + (HARDWARE[server.type].gpuCount || 0) * server.level,
        0,
      );
      const kinds = Object.keys(context.JOB_PROFILES).filter(
        (k) => k !== 'ai' || (s.sector >= 2 && gpuInstalled > 0),
      );
      // Small monitoring work remains available at every stage; sector progression
      // widens the market without turning every offer into an oversized contract.
      const kind = rand(s) < 0.2 ? 'monitoring' : kinds[Math.floor(rand(s) * kinds.length)];
      const def = context.JOB_PROFILES[kind],
        variation = Math.floor(rand(s) * def.titles.length);
      const factor =
        (1 + Math.min(12, Math.sqrt(s.sector - 1) * 0.35) + tier * 0.12) * (0.85 + rand(s) * 0.3);
      const gpuDemand = kind === 'ai' ? 1 + Math.floor(rand(s) * Math.min(4, gpuInstalled)) : 0;
      const scale = kind === 'ai' ? 0.6 + 0.4 * gpuDemand : 1;
      return {
        id: uid(s, 'job'),
        title: def.titles[variation],
        client: context.JOB_CLIENTS[Math.floor(rand(s) * context.JOB_CLIENTS.length)],
        kind,
        ...(kind === 'ai'
          ? { gpuDemand, specialty: ['training', 'inference', 'evaluation', 'tuning'][variation] }
          : {}),
        totalWork: Math.round(def.work * factor * scale),
        work: 0,
        reward: Math.round(
          def.pay * factor * scale * (kind === 'ai' ? 1 + 0.12 * (gpuDemand - 1) : 1),
        ),
        science: Math.max(1, Math.round(def.science * factor * scale)),
        rep: Math.max(1, Math.round(def.rep * factor)),
        load: Math.round(def.load * factor * scale * 10) / 10,
      };
    }

    function makeEvent(s) {
      const variants = [
        {
          kind: 'signal',
          title: 'Ungewöhnliche Messreihe',
          description:
            'Ein Sensorverbund meldet ein neues Muster. Beide Wege bringen sicheren Nutzen.',
          choices: [
            {
              label: 'Muster analysieren',
              description: '+8 Forschung und +1 Ansehen.',
              key: 'signal_analyze',
            },
            { label: 'Datensatz lizenzieren', description: '+48 Credits.', key: 'signal_license' },
          ],
        },
        {
          kind: 'grant',
          title: 'Förderfenster geöffnet',
          description:
            'Ein regionales Programm unterstützt offene Infrastruktur oder gemeinsame Forschung.',
          choices: [
            { label: 'Infrastruktur fördern', description: '+85 Credits.', key: 'grant_funds' },
            {
              label: 'Forschung teilen',
              description: '+12 Forschung und +2 Ansehen.',
              key: 'grant_research',
            },
          ],
        },
        {
          kind: 'maintenance',
          title: 'Wartungsfenster verfügbar',
          description:
            'Ein Partner stellt Zeit für vorsorgliche Pflege oder eine Effizienzstudie bereit.',
          choices: [
            {
              label: 'Netzpflege durchführen',
              description: '+4 Ansehen und +4 Forschung.',
              key: 'maintenance_care',
            },
            {
              label: 'Effizienzstudie nutzen',
              description: '+55 Credits und +1 Ansehen.',
              key: 'maintenance_study',
            },
          ],
        },
        {
          kind: 'client',
          title: 'Anfrage aus dem Feld',
          description:
            'Ein Kunde braucht kurzfristige Unterstützung und bietet eine sichere Anschlussleistung an.',
          choices: [
            {
              label: 'Soforthilfe leisten',
              description: '+72 Credits und +1 Ansehen.',
              key: 'client_help',
            },
            {
              label: 'Wissen weitergeben',
              description: '+9 Forschung und +2 Ansehen.',
              key: 'client_knowledge',
            },
          ],
        },
        {
          kind: 'discovery',
          title: 'Neue Anomalie entdeckt',
          description: 'Eine seltene Abweichung lässt sich dokumentieren oder genauer untersuchen.',
          choices: [
            {
              label: 'Tiefer untersuchen',
              description: '+15 Forschung.',
              key: 'discovery_research',
            },
            {
              label: 'Befund veröffentlichen',
              description: '+42 Credits und +3 Ansehen.',
              key: 'discovery_publish',
            },
          ],
        },
        {
          kind: 'procurement',
          title: 'Gemeinsame Beschaffung',
          description:
            'Ein Verbundprojekt bietet Mittel für Ausstattung oder technische Evaluation.',
          choices: [
            {
              label: 'Beschaffungsbudget sichern',
              description: '+105 Credits.',
              key: 'procurement_funds',
            },
            {
              label: 'Technik evaluieren',
              description: '+11 Forschung und +2 Ansehen.',
              key: 'procurement_evaluate',
            },
          ],
        },
      ];
      const item = variants[Math.floor(rand(s) * variants.length)];
      return {
        id: uid(s, 'event'),
        title: item.title,
        description: item.description,
        kind: item.kind,
        choices: item.choices.map((c) => ({ ...c })),
      };
    }

    function autoContract(s) {
      if (!s.policies.autocontract || context.globalIncident(s)) return 0;
      let accepted = 0,
        metrics = getMetrics(s);
      const target = Math.min(
        metrics.jobLimit,
        Math.max(1, s.agents.filter((agent) => !agent.assignment).length + 1),
      );
      while (s.jobs.length < target && s.offers.length) {
        metrics = getMetrics(s);
        const candidates = s.offers.filter((j) =>
          s.business
            ? context.jobsFit(s, j, metrics.admissionResources)
            : metrics.usedCapacity + j.load <= metrics.capacity * 0.98 &&
              (j.kind !== 'ai' ||
                (j.gpuDemand || 1) <= metrics.gpuCapacity - metrics.gpuUsed + 1e-9),
        );
        if (!candidates.length) break;
        const score = (j) =>
          s.policies.priority === 'income'
            ? j.reward / j.totalWork
            : s.policies.priority === 'research'
              ? j.science / j.totalWork
              : 1 / j.totalWork;
        candidates.sort((a, b) => score(b) - score(a));
        const picked = candidates[0];
        s.offers = s.offers.filter((j) => j.id !== picked.id);
        s.jobs.push(picked);
        accepted++;
      }
      return accepted;
    }
    return { makeJob, makeEvent, autoContract };
  };
});
