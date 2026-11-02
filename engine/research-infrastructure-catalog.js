/** Named research paths: id, label, tier, prerequisites and existing engine effect factors. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['research-infrastructure-catalog'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function () {
    return {
      INFRASTRUCTURE_RESEARCH: {
        network: [
          ['queues', 'Warteschlangendisziplin', 3, ['network-scheduling'], { work: 1.025 }],
          ['isolation', 'Mandantenisolation', 3, ['network-telemetry'], { risk: 0.975 }],
          ['qos', 'Dienstklassensteuerung', 4, ['network-queues'], { serviceEfficiency: 0.975 }],
          [
            'fabric-control',
            'Fabric-Steuerung',
            4,
            ['network-isolation', 'automation-maintenance'],
            { wear: 0.98 },
          ],
          ['congestion', 'Stauvermeidung', 5, ['network-qos', 'network-failover'], { work: 1.035 }],
          [
            'convergence',
            'Schnelle Konvergenz',
            5,
            ['network-fabric-control', 'network-failover'],
            { risk: 0.965 },
          ],
          [
            'throughput',
            'Durchsatz-Doktrin',
            6,
            ['network-congestion', 'network-convergence'],
            { work: 1.12, research: 0.94 },
          ],
          [
            'determinism',
            'Deterministische Netze',
            6,
            ['network-congestion', 'network-convergence'],
            { risk: 0.88, work: 0.94 },
          ],
        ],
        cooling: [
          ['heat', 'Wärmebilanz', 1, ['network-fabric'], { risk: 0.985 }],
          ['airflow', 'Strömungslehre', 2, ['cooling-heat'], { energy: 0.985 }],
          ['dewpoint', 'Taupunktüberwachung', 2, ['cooling-heat'], { risk: 0.985 }],
          ['pressure', 'Differenzdruckregelung', 3, ['cooling-airflow'], { energy: 0.98 }],
          ['envelope', 'Thermische Betriebsgrenzen', 3, ['cooling-dewpoint'], { wear: 0.985 }],
          ['hydraulics', 'Hydraulischer Abgleich', 4, ['cooling-pressure'], { energy: 0.975 }],
          [
            'thermal-mass',
            'Thermische Trägheit',
            4,
            ['cooling-envelope', 'network-telemetry'],
            { risk: 0.975 },
          ],
          [
            'economizer',
            'Freikühlungssteuerung',
            5,
            ['cooling-hydraulics', 'automation-power'],
            { energy: 0.97 },
          ],
          ['valves', 'Ventilkoordination', 5, ['cooling-thermal-mass'], { wear: 0.975 }],
          ['plant', 'Anlagenregelung', 5, ['cooling-economizer', 'cooling-valves'], { risk: 0.97 }],
          ['economy', 'Sparsame Kühlstrategie', 6, ['cooling-plant'], { energy: 0.88, risk: 1.06 }],
          ['safe', 'Konstante Kühlstrategie', 6, ['cooling-plant'], { risk: 0.88, energy: 1.06 }],
        ],
        power: [
          ['metering', 'Leistungsmessung', 1, ['automation-workflows'], { energy: 0.985 }],
          ['harmonics', 'Oberschwingungsanalyse', 2, ['power-metering'], { wear: 0.985 }],
          ['loads', 'Lastgangprofile', 2, ['power-metering'], { energy: 0.985 }],
          ['selectivity', 'Selektivitätsplanung', 3, ['power-harmonics'], { risk: 0.98 }],
          ['balance', 'Phasenausgleich', 3, ['power-loads'], { energy: 0.98 }],
          ['batteries', 'Batteriemanagement', 4, ['power-selectivity'], { wear: 0.975 }],
          [
            'transfer',
            'Geordnete Umschaltung',
            4,
            ['power-balance', 'network-failover'],
            { risk: 0.975 },
          ],
          [
            'efficiency',
            'Wirkungsgradkennfelder',
            5,
            ['power-batteries', 'automation-power'],
            { energy: 0.97 },
          ],
          ['sequencing', 'Startsequenzierung', 5, ['power-transfer'], { wear: 0.975 }],
          [
            'grid',
            'Netzqualitätsregelung',
            5,
            ['power-efficiency', 'power-sequencing'],
            { risk: 0.97 },
          ],
          ['lean', 'Schlanke Energieversorgung', 6, ['power-grid'], { energy: 0.88, wear: 1.06 }],
          [
            'protected',
            'Schonende Energieversorgung',
            6,
            ['power-grid'],
            { wear: 0.88, energy: 1.06 },
          ],
        ],
      },
    };
  };
});
