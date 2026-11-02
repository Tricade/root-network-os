/** Named research paths: id, label, tier, prerequisites and existing engine effect factors. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['research-compute-catalog'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function () {
    return {
      COMPUTE_RESEARCH: {
        science: [
          [
            'reproducibility',
            'Reproduzierbare Experimente',
            3,
            ['science-knowledge'],
            { research: 1.025 },
          ],
          [
            'quantization',
            'Modellquantisierung',
            3,
            ['science-ai-validation'],
            { serviceEfficiency: 0.975 },
          ],
          [
            'benchmarks',
            'Vergleichbare Benchmarks',
            4,
            ['science-reproducibility'],
            { aiReward: 1.035 },
          ],
          [
            'batching',
            'Inferenz-Bündelung',
            4,
            ['science-quantization', 'business-planning'],
            { inferenceIncome: 1.025 },
          ],
          [
            'distillation',
            'Wissensdestillation',
            5,
            ['science-benchmarks', 'science-serving'],
            { research: 1.035 },
          ],
          [
            'serving-pipeline',
            'Modell-Pipeline',
            5,
            ['science-batching', 'science-serving'],
            { aiReward: 1.04 },
          ],
          [
            'exploration',
            'Grundlagenlabor',
            6,
            ['science-distillation', 'science-serving-pipeline'],
            { research: 1.12, inferenceIncome: 0.94 },
          ],
          [
            'production',
            'Produktionslabor',
            6,
            ['science-distillation', 'science-serving-pipeline'],
            { inferenceIncome: 1.12, research: 0.94 },
          ],
        ],
        storage: [
          ['layout', 'Datenlayout', 1, ['business-desk'], { serviceEfficiency: 0.985 }],
          ['index', 'Indexstrategien', 2, ['storage-layout'], { work: 1.015 }],
          ['dedup', 'Deduplizierungsanalyse', 2, ['storage-layout'], { serviceEfficiency: 0.985 }],
          ['locality', 'Datenlokalität', 3, ['storage-index'], { work: 1.025 }],
          ['checksums', 'Integritätsprüfung', 3, ['storage-dedup'], { risk: 0.98 }],
          ['tiering', 'Speicherklassen', 4, ['storage-locality'], { serviceEfficiency: 0.975 }],
          [
            'replicas',
            'Replikatabgleich',
            4,
            ['storage-checksums', 'network-telemetry'],
            { risk: 0.975 },
          ],
          [
            'cache',
            'Cache-Koordination',
            5,
            ['storage-tiering', 'network-scheduling'],
            { work: 1.035 },
          ],
          [
            'retention',
            'Aufbewahrungsplanung',
            5,
            ['storage-replicas'],
            { serviceEfficiency: 0.97 },
          ],
          [
            'consistency',
            'Konsistenzmodelle',
            5,
            ['storage-cache', 'storage-retention'],
            { risk: 0.97 },
          ],
          [
            'density',
            'Hohe Datendichte',
            6,
            ['storage-consistency'],
            { serviceEfficiency: 0.88, work: 0.94 },
          ],
          [
            'latency',
            'Niedrige Datenlatenz',
            6,
            ['storage-consistency'],
            { work: 1.12, serviceEfficiency: 1.06 },
          ],
        ],
      },
    };
  };
});
