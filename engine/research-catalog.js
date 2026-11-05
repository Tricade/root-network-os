/** Declarative research trees. New branches can be added without new simulation switches. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['research-catalog'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    const RESEARCH_TREES = [
      {
        id: 'network',
        name: 'Netzarchitektur',
        art: 'routing',
        description: 'Durchsatz und verlässliche Infrastruktur.',
      },
      {
        id: 'business',
        name: 'Kundenbetrieb',
        art: 'market',
        description: 'Einrichtung, Ressourcenplanung und Kundenbindung.',
      },
      {
        id: 'automation',
        name: 'Betriebsautomatisierung',
        art: 'automation',
        description: 'Pflege und Energie effizienter organisieren.',
      },
      {
        id: 'science',
        name: 'Wissen & KI',
        art: 'synthesis',
        description: 'Forschungsgrundlagen und spezialisierte KI-Dienste.',
      },
    ];
    const TECHNOLOGIES = [
      {
        id: 'network-fabric',
        tree: 'network',
        name: 'Paketvermittlung',
        description: '+4 % Projektarbeit aus freier CPU-Leistung.',
        cost: 35,
        duration: 600,
        sector: 1,
        requires: [],
        effects: { work: 1.04 },
      },
      {
        id: 'network-telemetry',
        tree: 'network',
        name: 'Thermische Telemetrie',
        description: '5 % geringeres Störungsrisiko. Physische Kühlung bleibt erforderlich.',
        cost: 90,
        duration: 1800,
        sector: 2,
        requires: ['network-fabric'],
        effects: { risk: 0.95 },
      },
      {
        id: 'network-scheduling',
        tree: 'network',
        name: 'Lastverteilung',
        description: '+8 % Projektarbeit aus freien Ressourcen. Erzeugt keine Hardwarekapazität.',
        cost: 200,
        duration: 3600,
        sector: 3,
        requires: ['network-fabric'],
        effects: { work: 1.08 },
      },
      {
        id: 'network-failover',
        tree: 'network',
        name: 'Failover-Verfahren',
        description: '5 % weniger Hardwareverschleiß durch geordnete Betriebswechsel.',
        cost: 450,
        duration: 7200,
        sector: 5,
        requires: ['network-telemetry', 'network-scheduling'],
        effects: { wear: 0.95 },
      },
      {
        id: 'business-desk',
        tree: 'business',
        name: 'Service Desk',
        description: 'Agenten erledigen Einrichtung und Kundenbetreuung 10 % schneller.',
        cost: 25,
        duration: 600,
        sector: 1,
        requires: [],
        effects: { onboarding: 1.1 },
      },
      {
        id: 'business-care',
        tree: 'business',
        name: 'Störungsbegleitung',
        description:
          '25 % mehr Geduld vor einer Kündigung wegen Versorgungsdefiziten. Beschwerden bleiben sichtbar.',
        cost: 75,
        duration: 1800,
        sector: 2,
        requires: ['business-desk'],
        effects: { patience: 1.25 },
      },
      {
        id: 'business-planning',
        tree: 'business',
        name: 'Kapazitätsplanung',
        description:
          'Kundendienste benötigen 5 % weniger CPU, RAM, Speicher und Netzressourcen einschließlich GPU/VRAM.',
        cost: 180,
        duration: 3600,
        sector: 3,
        requires: ['business-desk'],
        effects: { serviceEfficiency: 0.95 },
      },
      {
        id: 'business-accounts',
        tree: 'business',
        name: 'Account Management',
        description: 'Rückgewinnung hat bei gesunder Versorgung 80 % statt 65 % Erfolgschance.',
        cost: 400,
        duration: 7200,
        sector: 5,
        requires: ['business-care', 'business-planning'],
        effects: { retentionBonus: 0.15 },
      },
      {
        id: 'automation-workflows',
        tree: 'automation',
        name: 'Bereitstellungsabläufe',
        description: 'Agenten erledigen Einrichtung und Kundenbetreuung 5 % schneller.',
        cost: 40,
        duration: 900,
        sector: 1,
        requires: [],
        effects: { onboarding: 1.05 },
      },
      {
        id: 'automation-maintenance',
        tree: 'automation',
        name: 'Vorausschauende Pflege',
        description:
          '5 % weniger Hardwareverschleiß. Reparaturen und Ersatzteile bleiben notwendig.',
        cost: 100,
        duration: 2400,
        sector: 2,
        requires: ['automation-workflows'],
        effects: { wear: 0.95 },
      },
      {
        id: 'automation-power',
        tree: 'automation',
        name: 'Energiekoordination',
        description: '6 % niedrigere Energiekosten. Verändert keine Strom- oder Kühlleistung.',
        cost: 220,
        duration: 3600,
        sector: 3,
        requires: ['automation-workflows'],
        effects: { energy: 0.94 },
      },
      {
        id: 'automation-lab',
        tree: 'automation',
        name: 'Laborautomatisierung',
        description: '+8 % laufende Forschungspunkte. Belegte Laborzeit bleibt eine Entscheidung.',
        cost: 500,
        duration: 7200,
        sector: 5,
        requires: ['automation-maintenance', 'automation-power'],
        effects: { research: 1.08 },
      },
      {
        id: 'science-methods',
        tree: 'science',
        name: 'Experimentelle Methodik',
        description: '+4 % laufende Forschungspunkte.',
        cost: 30,
        duration: 600,
        sector: 1,
        requires: [],
        effects: { research: 1.04 },
      },
      {
        id: 'science-knowledge',
        tree: 'science',
        name: 'Wissenstransfer',
        description: '+5 % laufende Forschungspunkte.',
        cost: 80,
        duration: 1800,
        sector: 2,
        requires: ['science-methods'],
        effects: { research: 1.05 },
      },
      {
        id: 'science-ai-validation',
        tree: 'science',
        name: 'KI-Validierungsverfahren',
        description:
          '+8 % Belohnung für KI-Projektaufträge. Benötigt passende KI-Hardware für diese Aufträge.',
        cost: 250,
        duration: 5400,
        sector: 4,
        requires: ['science-methods', 'network-telemetry'],
        effects: { aiReward: 1.08 },
      },
      {
        id: 'science-serving',
        tree: 'science',
        name: 'Produktive Modellbereitstellung',
        description: '+6 % Umsatz aus tatsächlich erbrachter KI-Inferenz.',
        cost: 550,
        duration: 10800,
        sector: 6,
        requires: ['science-knowledge', 'science-ai-validation', 'business-planning'],
        effects: { inferenceIncome: 1.06 },
      },
    ];
    TECHNOLOGIES.push({
      id: 'business-maintenance',
      tree: 'business',
      name: 'Wartungsankündigungen',
      description:
        'Optionale Kundenankündigungen kosten 25 % weniger und benötigen nur 60 statt 120 Sekunden Vorlauf. Zufriedenheitsschutz bleibt bei 50 %; SLA und Lieferausfälle bleiben unverändert.',
      cost: 450,
      duration: 7200,
      sector: 4,
      requires: ['business-desk', 'automation-maintenance'],
      effects: { noticeCost: 0.75, noticeLead: 0.5 },
    });
    for (const node of TECHNOLOGIES) {
      node.legacyCost = node.cost;
      // Preserve the four entry projects. Advanced foundations require a
      // research budget as well as the higher sector and longer lab time.
      if (node.sector > 1) node.cost *= Math.min(6, node.sector + 1);
    }
    RESEARCH_TREES.push(...ctx.EXPANSION_TREES);
    TECHNOLOGIES.push(...ctx.EXPANSION_TECHNOLOGIES);
    const REPEATABLE_GATES = {
      routing: 'network-fabric',
      cooling: 'network-telemetry',
      market: 'business-desk',
      automation: 'automation-workflows',
      synthesis: 'science-methods',
    };
    function researchDefaults() {
      return { version: 1, owned: [], project: null };
    }
    let cachedKey = null,
      cachedEffects = null;
    function researchEffects(s) {
      const key = (s.lab?.owned || []).join('|');
      if (key === cachedKey) return { ...cachedEffects };
      const owned = new Set(s.lab?.owned || []);
      const effects = {
        work: 1,
        risk: 1,
        wear: 1,
        onboarding: 1,
        patience: 1,
        serviceEfficiency: 1,
        retentionBonus: 0,
        energy: 1,
        research: 1,
        aiReward: 1,
        inferenceIncome: 1,
        noticeCost: 1,
        noticeLead: 1,
      };
      for (const node of TECHNOLOGIES)
        if (owned.has(node.id) && !node.expansion)
          for (const [key, value] of Object.entries(node.effects))
            if (key.endsWith('Bonus')) effects[key] += value;
            else effects[key] *= value;
      cachedKey = key;
      cachedEffects = ctx.expandedResearchEffects(
        effects,
        TECHNOLOGIES.filter((n) => n.expansion && owned.has(n.id)),
      );
      return { ...cachedEffects };
    }
    return { RESEARCH_TREES, TECHNOLOGIES, REPEATABLE_GATES, researchDefaults, researchEffects };
  };
});
