/** Deterministic proportional service allocation with an optional first-priority group. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['priority-allocation'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    const { RESOURCES } = context;

    function proportionalFractions(available, demands) {
      const total = Object.fromEntries(RESOURCES.map((key) => [key, 0]));
      for (const row of demands) for (const key of RESOURCES) total[key] += row.resources[key] || 0;

      const result = new Map();
      for (const row of demands) {
        result.set(
          row.kind,
          Math.min(
            1,
            ...RESOURCES.filter((key) => row.resources[key] > 0).map(
              (key) => available[key] / Math.max(0.001, total[key]),
            ),
          ),
        );
      }
      return result;
    }

    function allocateServiceResources(available, demands, priority = 'balanced') {
      if (!['balanced', 'hosting', 'archive', 'database', 'inference'].includes(priority))
        throw new Error('Ungültige Dienstpriorität.');

      const preferred =
        priority === 'balanced' ? null : demands.find((row) => row.kind === priority);
      if (!preferred) return proportionalFractions(available, demands);

      const result = new Map();
      const preferredFraction = Math.min(
        1,
        ...RESOURCES.filter((key) => preferred.resources[key] > 0).map(
          (key) => available[key] / Math.max(0.001, preferred.resources[key]),
        ),
      );
      result.set(preferred.kind, preferredFraction);

      const remainingAvailable = Object.fromEntries(
        RESOURCES.map((key) => [
          key,
          Math.max(0, available[key] - preferred.resources[key] * preferredFraction),
        ]),
      );
      const remainingDemands = demands.filter((row) => row !== preferred);
      for (const [kind, fraction] of proportionalFractions(remainingAvailable, remainingDemands))
        result.set(kind, fraction);

      return result;
    }

    return { allocateServiceResources };
  };
});
