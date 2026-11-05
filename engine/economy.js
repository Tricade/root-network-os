/** Economy: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['economy'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    const { catalog, MAX, own } = context;

    function cost(s, kind, id) {
      const sectorScale = 1 + Math.max(0, s.sector - 1) * 0.42;
      if (kind === 'server' && own(catalog.servers, id))
        return Math.ceil(
          catalog.servers[id].baseCost *
            sectorScale *
            (1 + s.servers.filter((x) => x.type === id).length * 0.68),
        );
      if (kind === 'serverUpgrade') {
        const x = s.servers.find((v) => v.id === id);
        return x
          ? Math.ceil(
              catalog.servers[x.type].baseCost * 0.58 * Math.pow(x.level, 1.72) * sectorScale,
            )
          : Infinity;
      }
      if (kind === 'agent' && own(catalog.roles, id))
        return Math.ceil(
          catalog.roles[id].baseCost *
            sectorScale *
            (1 + s.agents.filter((x) => x.role === id).length * 0.55),
        );
      if (kind === 'agentUpgrade') {
        const x = s.agents.find((v) => v.id === id);
        return x
          ? Math.ceil(catalog.roles[x.role].baseCost * 0.48 * Math.pow(x.level, 1.82) * sectorScale)
          : Infinity;
      }
      if (kind === 'research')
        return catalog.research.some((entry) => entry.id === id)
          ? context.researchPrice(s, id)
          : Infinity;
      if (kind === 'sector') return Math.ceil(1800 * Math.pow(s.sector, 1.62));
      return Infinity;
    }

    function rackPrice(s) {
      return Math.ceil(
        1100 *
          (1 + Math.max(0, s.sector - 1) * 0.42) *
          (1 + Math.max(0, s.facility.racks.length - 1) * 0.28),
      );
    }

    function getServerLimit(s) {
      return Math.min(MAX.servers, 3 + s.sector * 2);
    }
    // Low-reputation starts retain their old income. The concave tail and additive
    // automation prevent reputation and research multiplying into an exponential mint.
    function reputationIncome(reputation) {
      return 0.002 * Math.min(reputation, 1000) + 0.025 * Math.sqrt(Math.max(0, reputation - 1000));
    }
    function automationMultiplier(level) {
      return 1 + 0.09 * Math.min(context.MAX_RESEARCH_LEVEL, level);
    }
    return { cost, rackPrice, getServerLimit, reputationIncome, automationMultiplier };
  };
});
