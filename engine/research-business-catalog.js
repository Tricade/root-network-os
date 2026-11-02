/** Named research paths: id, label, tier, prerequisites and existing engine effect factors. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['research-business-catalog'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function () {
    return {
      BUSINESS_RESEARCH: {
        business: [
          ['runbooks', 'Kundenhandbücher', 3, ['business-care'], { onboarding: 1.03 }],
          ['forecast', 'Bedarfsprognosen', 3, ['business-planning'], { serviceEfficiency: 0.975 }],
          ['escalation', 'Eskalationsmatrix', 4, ['business-runbooks'], { patience: 1.035 }],
          [
            'capacity-sales',
            'Kapazitätszusagen',
            4,
            ['business-forecast', 'network-scheduling'],
            { serviceEfficiency: 0.975 },
          ],
          [
            'relationship',
            'Kundenentwicklung',
            5,
            ['business-escalation', 'business-accounts'],
            { retentionBonus: 0.02 },
          ],
          [
            'handover',
            'Standardisierte Übergabe',
            5,
            ['business-capacity-sales', 'business-accounts'],
            { onboarding: 1.04 },
          ],
          [
            'concierge',
            'Intensivbetreuung',
            6,
            ['business-relationship', 'business-handover'],
            { patience: 1.18, onboarding: 0.94 },
          ],
          [
            'volume',
            'Volumenbetrieb',
            6,
            ['business-relationship', 'business-handover'],
            { onboarding: 1.15, patience: 0.93 },
          ],
        ],
        automation: [
          ['inventory', 'Maschineninventar', 3, ['automation-maintenance'], { wear: 0.98 }],
          ['templates', 'Bereitstellungsvorlagen', 3, ['automation-power'], { onboarding: 1.03 }],
          [
            'sensors',
            'Sensorkalibrierung',
            4,
            ['automation-inventory', 'network-telemetry'],
            { risk: 0.975 },
          ],
          ['dispatch', 'Auftragsdisposition', 4, ['automation-templates'], { work: 1.025 }],
          [
            'fleet',
            'Flottenkoordination',
            5,
            ['automation-sensors', 'automation-lab'],
            { wear: 0.97 },
          ],
          [
            'orchestration',
            'Ablauforchestrierung',
            5,
            ['automation-dispatch', 'automation-lab'],
            { onboarding: 1.04 },
          ],
          [
            'agile',
            'Agile Bereitstellung',
            6,
            ['automation-fleet', 'automation-orchestration'],
            { onboarding: 1.15, wear: 1.06 },
          ],
          [
            'conservative',
            'Konservativer Betrieb',
            6,
            ['automation-fleet', 'automation-orchestration'],
            { wear: 0.88, onboarding: 0.94 },
          ],
        ],
        reliability: [
          ['register', 'Risikoregister', 1, ['science-methods'], { risk: 0.985 }],
          ['inspection', 'Inspektionsroutinen', 2, ['reliability-register'], { wear: 0.985 }],
          ['communication', 'Krisenkommunikation', 2, ['reliability-register'], { patience: 1.02 }],
          ['isolation', 'Fehlerisolation', 3, ['reliability-inspection'], { risk: 0.98 }],
          ['handoff', 'Schichtübergabe', 3, ['reliability-communication'], { onboarding: 1.025 }],
          ['routines', 'Wartungsstandards', 4, ['reliability-isolation'], { wear: 0.975 }],
          [
            'triage',
            'Vorfalltriage',
            4,
            ['reliability-handoff', 'business-care'],
            { patience: 1.035 },
          ],
          [
            'drills',
            'Wiederanlaufübungen',
            5,
            ['reliability-routines', 'network-failover'],
            { risk: 0.97 },
          ],
          ['learning', 'Vorfallnachbereitung', 5, ['reliability-triage'], { research: 1.025 }],
          [
            'assurance',
            'Betriebsabsicherung',
            5,
            ['reliability-drills', 'reliability-learning'],
            { retentionBonus: 0.02 },
          ],
          [
            'safety',
            'Sicherheitsorientierung',
            6,
            ['reliability-assurance'],
            { risk: 0.88, work: 0.94 },
          ],
          [
            'availability',
            'Verfügbarkeitsorientierung',
            6,
            ['reliability-assurance'],
            { work: 1.12, risk: 1.06 },
          ],
        ],
      },
    };
  };
});
