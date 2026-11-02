/** Metrics: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['metrics'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    const { catalog, MAX, MAX_RESEARCH_LEVEL, clamp } = context;
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const centralLevels = (...args) => context.centralLevels(...args);
    const centralOperatingCost = (...args) => context.centralOperatingCost(...args);
    const cost = (...args) => context.cost(...args);
    const getServerLimit = (...args) => context.getServerLimit(...args);
    const gpuSnapshot = (...args) => context.gpuSnapshot(...args);
    const hardwareSnapshot = (...args) => context.hardwareSnapshot(...args);
    const serverLinkState = (...args) => context.serverLinkState(...args);

    function getMetrics(s) {
      const upgrades = s.upgrades || {};
      const customers = context.customerReadModel(s);
      const hardware = hardwareSnapshot(s);
      const gpu = gpuSnapshot(s, hardware);
      const cooling = Math.pow(0.92, Math.min(MAX_RESEARCH_LEVEL, upgrades.cooling || 0));
      const central = centralLevels(s);
      const globalPower = s.policies.power;
      const policyCapacity = globalPower === 'performance' ? 1.15 : globalPower === 'eco' ? 0.9 : 1;
      const policyPower = globalPower === 'performance' ? 1.3 : globalPower === 'eco' ? 0.68 : 1;
      const policyHeat = globalPower === 'performance' ? 1.35 : globalPower === 'eco' ? 0.72 : 1;
      const policyWork = globalPower === 'performance' ? 1.12 : globalPower === 'eco' ? 0.86 : 1;
      let capacity = 0,
        serverIncome = 0,
        economicPower = 0,
        physicalPowerW = 0,
        heat = 0,
        onlineServers = 0,
        failedServers = 0,
        hardwareWeighted = 0,
        hardwareWeight = 0;
      for (const server of s.servers) {
        const rack = hardware.get(server.rackId);
        const node = rack && rack.servers.find((x) => x.server.id === server.id);
        if (
          server.status !== 'online' ||
          server.condition <= 0 ||
          !node ||
          !node.available ||
          !serverLinkState(s, server, rack.rack)
        ) {
          if (server.status === 'failed') failedServers++;
          continue;
        }
        onlineServers++;
        const c = catalog.servers[server.type],
          level = server.level;
        const physicalFactor = node.networkFactor * rack.powerFactor * rack.thermalFactor;
        const mode = server.mode;
        const capFactor = mode === 'performance' ? 1.35 : mode === 'eco' ? 0.78 : 1;
        const powerFactor = mode === 'performance' ? 1.65 : mode === 'eco' ? 0.58 : 1;
        capacity +=
          c.capacity * Math.pow(level, 0.82) * capFactor * policyCapacity * physicalFactor;
        const baseCapacity = c.capacity * Math.pow(level, 0.82) * capFactor * policyCapacity;
        hardwareWeighted += baseCapacity * physicalFactor;
        hardwareWeight += baseCapacity;
        economicPower += c.power * level * powerFactor * policyPower;
        physicalPowerW += node.powerW;
        serverIncome +=
          (server.type === 'ai'
            ? 0.62
            : server.type === 'compute'
              ? 0.72
              : server.type === 'storage'
                ? 0.48
                : 0.56) *
          Math.pow(level, 0.72) *
          (mode === 'eco' ? 1.08 : mode === 'performance' ? 0.92 : 1) *
          physicalFactor;
        heat +=
          (server.type === 'ai'
            ? 12
            : server.type === 'compute'
              ? 5.6
              : server.type === 'storage'
                ? 2.2
                : 3.1) *
          level *
          (mode === 'performance' ? 1.8 : mode === 'eco' ? 0.42 : 1) *
          policyHeat *
          (1 + Math.max(0, rack.temperature - 35) / 80);
      }
      physicalPowerW = [...hardware.values()].reduce((sum, row) => sum + row.powerW, 0);
      // A disconnected node still consumes electricity. A powered-off node does not.
      economicPower = [...hardware.values()].reduce(
        (sum, row) => sum + row.servers.reduce((value, node) => value + node.powerW / 100, 0),
        0,
      );
      const power = physicalPowerW / 1000;
      const facilityMaintenance = s.facility.racks.reduce(
        (sum, r) => sum + 0.025 * (r.switchLevel + r.powerLevel + r.coolingLevel),
        0,
      );
      const centralPowerW = [...hardware.values()].reduce((sum, row) => sum + row.centralPowerW, 0);
      const centralDistributionCapacityW = central.distribution * 6000;
      const connectedPowerRacks = [...hardware.values()].filter(
        (r) => r.centralPowerCapacityW > 0,
      ).length;
      const centralDistributionWPerRack = connectedPowerRacks
        ? [...hardware.values()].reduce((sum, row) => sum + row.centralPowerCapacityW, 0) /
          connectedPowerRacks
        : 0;
      const centralUpkeep = centralOperatingCost(central, centralPowerW, s.policies.power);
      const installedEconomicPower = s.servers.reduce(
        (sum, server) => sum + catalog.servers[server.type].power * server.level,
        0,
      );
      const usedCapacity = s.jobs.reduce((a, j) => a + j.load, 0);
      const load = capacity > 0 ? usedCapacity / capacity : 1;
      const hardwareFactor = hardwareWeight > 0 ? hardwareWeighted / hardwareWeight : 0;
      const activeAgents = s.agents.filter((a) =>
        context.agentProductive(s, a, customers.assignments),
      );
      const engineers = activeAgents
        .filter((a) => a.role === 'engineer')
        .reduce((v, a) => v + a.level * context.agentEffects(a).care, 0);
      const maintenanceFocus = activeAgents
        .filter((a) => a.focus === 'maintenance')
        .reduce((v, a) => v + a.level * context.agentEffects(a).care, 0);
      heat = Math.max(
        0,
        heat * cooling * (1 - Math.min(0.32, engineers * 0.035 + maintenanceFocus * 0.018)) +
          Math.max(0, load - 0.68) * 20,
      );
      const averageCondition = onlineServers
        ? s.servers
            .filter((x) => serverLinkState(s, x, hardware.get(x.rackId)?.rack))
            .reduce((v, x) => v + x.condition, 0) / onlineServers
        : 25;
      const reliability = clamp(
        91 -
          Math.max(0, heat - 8) * 0.55 -
          Math.max(0, load - 0.8) * 34 +
          Math.min(10, engineers * 1.4) +
          (s.policies.autorepair ? 9 : -7) -
          Math.max(0, 90 - averageCondition) * 0.32,
        20,
        99.5,
      );
      const upkeep =
        economicPower *
          (s.policies.power === 'eco'
            ? 0.035
            : s.policies.power === 'performance'
              ? 0.105
              : 0.064) *
          Math.max(0.48, 1 - engineers * 0.045) +
        installedEconomicPower * (s.policies.autorepair ? 0.025 : 0) +
        facilityMaintenance +
        centralUpkeep;
      const ops = activeAgents
        .filter((a) => a.role === 'operator')
        .reduce((v, a) => v + a.level * context.agentEffects(a).work, 0);
      const incomeMult = context.automationMultiplier(upgrades.automation || 0);
      const incomePerSecond =
        onlineServers === 0 || (s.resilience && s.resilience.incident)
          ? 0.08 + serverIncome * 0.12
          : (0.32 + serverIncome + ops * 0.12 + context.reputationIncome(s.reputation)) *
              incomeMult -
            upkeep;
      const analysts = activeAgents
        .filter((a) => a.role === 'analyst')
        .reduce((v, a) => v + a.level * context.agentEffects(a).research, 0);
      const contained = Boolean(s.resilience && s.resilience.incident);
      const researchPerSecond =
        (onlineServers > 0 && !contained ? 1 : 0) *
        hardwareFactor *
        (0.008 +
          analysts * 0.026 +
          activeAgents
            .filter((a) => a.focus === 'research')
            .reduce((v, a) => v + a.level * 0.012 * context.agentEffects(a).research, 0)) *
        Math.pow(1.15, Math.min(MAX_RESEARCH_LEVEL, upgrades.synthesis || 0));
      const workBase = activeAgents.reduce(
        (v, a) =>
          v +
          (a.role === 'engineer' ? 0.83 : 1) *
            a.level *
            (a.focus === 'income' ? 1.08 : 1) *
            context.agentEffects(a).work,
        0,
      );
      // A fleet average is bounded independently of fleet size. Switched-off or
      // disconnected hardware cannot lend a mode bonus to the remaining nodes.
      const productive = s.servers.filter((server) =>
        serverLinkState(s, server, hardware.get(server.rackId)?.rack),
      );
      const modePerformance = productive.length
        ? productive.reduce(
            (sum, server) =>
              sum + (server.mode === 'performance' ? 0.03 : server.mode === 'eco' ? -0.015 : 0),
            0,
          ) / productive.length
        : 0;
      const heatFactor = clamp(1 - heat / 190, 0.52, 1);
      const loadFactor = clamp(1 - Math.max(0, load - 0.62) * 0.42, 0.55, 1);
      const operationFactor =
        s.resilience && s.resilience.operation && s.resilience.operation.kind === 'backup'
          ? 0.5
          : 1;
      const agentBoost =
        s.resilience && s.resilience.agentEffects && s.resilience.agentEffects.optimizeRemaining > 0
          ? 1.15
          : 1;
      const workPerSecond =
        onlineServers > 0 && !contained
          ? workBase *
            (1 + Math.min(MAX_RESEARCH_LEVEL, upgrades.routing || 0) * 0.12 + modePerformance) *
            policyWork *
            heatFactor *
            loadFactor *
            Math.max(0.35, reliability / 100) *
            operationFactor *
            agentBoost *
            hardwareFactor
          : 0;
      const activeLoad = s.jobs.reduce((v, j) => v + j.load, 0);
      const jobRates = {};
      const weightFor = (j) =>
        s.policies.priority === 'income'
          ? j.reward / Math.max(1, j.totalWork)
          : s.policies.priority === 'research'
            ? j.science / Math.max(1, j.totalWork)
            : 1;
      const totalWeight = s.jobs.reduce((v, j) => v + weightFor(j), 0);
      for (const j of s.jobs) {
        const gpuFactor =
          j.kind === 'ai' ? (gpu.allocations[j.id] || 0) / Math.max(1, j.gpuDemand || 1) : 1;
        jobRates[j.id] =
          totalWeight > 0 ? ((workPerSecond * weightFor(j)) / totalWeight) * gpuFactor : 0;
      }
      const jobLimit = Math.min(
        MAX.jobs,
        Math.max(2, Math.floor(capacity / 9) + Math.floor(s.sector / 2)),
      );
      const serverLimit = getServerLimit(s);
      const agentLimit = Math.min(MAX.agents, 3 + s.sector * 2);
      const sectorCost = cost(s, 'sector');
      const exposed = s.servers.filter((server) =>
        serverLinkState(s, server, hardware.get(server.rackId)?.rack),
      );
      const riskCondition = exposed.length
        ? exposed.reduce((v, x) => v + (100 - x.condition), 0) / exposed.length
        : 0;
      const diagnoseBonus =
        s.resilience && s.resilience.agentEffects && s.resilience.agentEffects.diagnoseRemaining > 0
          ? 12
          : 0;
      const riskMitigation = Math.min(
        26,
        engineers * 2.6 +
          maintenanceFocus * 1.1 +
          (s.policies.autorepair ? 4 : 0) +
          Math.min(3, (upgrades.cooling || 0) * 0.35) +
          diagnoseBonus,
      );
      const riskPerHour = clamp(
        24 +
          Math.max(0, heat - 8) * 0.42 +
          Math.max(0, load - 0.55) * 24 +
          riskCondition * 0.48 +
          (globalPower === 'performance' ? 9 : globalPower === 'eco' ? -7 : 0) +
          failedServers * 14 -
          riskMitigation,
        4,
        96,
      );
      const upsCapacityW = central.ups * 3000;
      const upsCoverage =
        [...hardware.values()].reduce(
          (sum, r) => sum + Math.min(r.powerW, r.upsCapacityW || 0),
          0,
        ) / Math.max(1, physicalPowerW);
      const powerRiskReductionPct = upsCoverage * 65;
      const incidentActive = Boolean(s.resilience && s.resilience.incident);
      const safetyMode = incidentActive;
      const metrics = {
        capacity,
        usedCapacity,
        load,
        power,
        powerW: physicalPowerW,
        maxRackTemperature: Math.max(22, ...[...hardware.values()].map((row) => row.temperature)),
        heat: clamp(heat, 0, 100),
        hardwareFactor,
        reliability,
        incomePerSecond: Math.max(0.025, incomePerSecond),
        researchPerSecond,
        workPerSecond,
        upkeep,
        serverLimit,
        agentLimit,
        jobLimit,
        sectorCost,
        expansionReady:
          !incidentActive &&
          s.credits >= sectorCost &&
          s.servers.length >= Math.min(serverLimit, 2 + s.sector) &&
          s.counters.jobs >= s.sector * 3,
        jobRates,
        activeLoad,
        onlineServers,
        failedServers,
        riskPerHour,
        upsCapacityW,
        upsCoverage,
        powerRiskReductionPct,
        centralCoolingW: central.cooling * 3500,
        centralDistributionCapacityW,
        centralDistributionWPerRack,
        centralUpkeep,
        centralPowerW,
        safetyMode,
        incidentActive,
        gpuCapacity: gpu.capacity,
        gpuInstalled: gpu.installed,
        gpuUsed: gpu.used,
        gpuLoad: gpu.load,
        jobBlockedReasons: gpu.blocked,
      };
      return s.business ? context.serviceMetrics(s, metrics, hardware, customers) : metrics;
    }
    return { getMetrics };
  };
});
