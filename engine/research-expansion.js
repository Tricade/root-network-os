/** Eight research districts. Rows name real efficiency work; terminal doctrines are alternatives. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['research-expansion'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    const EXPANSION_TREES = [
      {
        id: 'cooling',
        name: 'Thermodynamik',
        description: 'Wärme verstehen, Anlagen schonen und Energie sparen.',
        art: 'cooling',
      },
      {
        id: 'power',
        name: 'Energietechnik',
        description: 'Stromkosten, Lastwechsel und elektrische Betriebssicherheit.',
        art: 'power',
      },
      {
        id: 'storage',
        name: 'Datenarchitektur',
        description: 'Daten effizient verarbeiten, speichern und bereitstellen.',
        art: 'storage',
      },
      {
        id: 'reliability',
        name: 'Resilienz',
        description: 'Risiken senken und einen verlässlichen Betrieb organisieren.',
        art: 'reliability',
      },
    ];
    // id, name, tier, prerequisite IDs, effects. All factors act through existing simulation channels.
    const rows = {
      ...ctx.INFRASTRUCTURE_RESEARCH,
      ...ctx.BUSINESS_RESEARCH,
      ...ctx.COMPUTE_RESEARCH,
    };
    const legacyCosts = [0, 200, 500, 1200, 2600, 5000, 10000];
    const costs = [0, 350, 1300, 3600, 9600, 19200, 48000];
    const seconds = [0, 1800, 7200, 14400, 28800, 43200, 86400];
    const sectors = [0, 2, 3, 4, 6, 8, 10];
    const EXPANSION_TECHNOLOGIES = Object.entries(rows).flatMap(([tree, list]) =>
      list.map(([id, name, tier, requires, effects]) => ({
        id: `${tree}-${id}`,
        tree,
        name,
        tier,
        requires,
        effects,
        expansion: true,
        description:
          tier === 6
            ? 'Spezialisierung mit Zielkonflikt. Pro Zweig ist eine aktiv; ein Wechsel kostet erneut Punkte und Laborzeit.'
            : 'Verbessert bestehende Betriebsabläufe. Der Zusatznutzen nimmt mit dem Forschungsstand ab; Hardware und Versorgung bleiben erforderlich.',
        cost: costs[tier],
        legacyCost: legacyCosts[tier],
        duration: seconds[tier],
        sector: sectors[tier],
        ...(tier === 6 ? { doctrine: tree } : {}),
      })),
    );
    // Additional benefit saturates instead of multiplying dozens of small nodes exponentially.
    // Penalties remain multiplicative, so no amount of research erases a doctrine's downside.
    const RESEARCH_LIMITS = {
      work: 0.2,
      risk: 0.18,
      wear: 0.15,
      onboarding: 0.2,
      patience: 0.25,
      serviceEfficiency: 0.18,
      retentionBonus: 0.1,
      energy: 0.2,
      research: 0.18,
      aiReward: 0.24,
      inferenceIncome: 0.2,
    };
    const REDUCED_FACTORS = new Set(['risk', 'wear', 'serviceEfficiency', 'energy']);
    function expandedResearchEffects(base, nodes) {
      for (const [key, limit] of Object.entries(RESEARCH_LIMITS)) {
        let benefit = 0,
          penalty = 1;
        for (const n of nodes) {
          const value = n.effects[key];
          if (value === undefined) continue;
          const gain =
            key === 'retentionBonus' ? value : (value - 1) * (REDUCED_FACTORS.has(key) ? -1 : 1);
          if (gain > 0) benefit += gain;
          else penalty *= value;
        }
        const delta = limit * (1 - Math.exp(-benefit / limit));
        base[key] =
          key === 'retentionBonus'
            ? base[key] + delta
            : base[key] * (1 + delta * (REDUCED_FACTORS.has(key) ? -1 : 1)) * penalty;
      }
      return base;
    }
    return { EXPANSION_TREES, EXPANSION_TECHNOLOGIES, RESEARCH_LIMITS, expandedResearchEffects };
  };
});
