/** Delivered services finance infrastructure; project throughput comes from actual hardware. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['service-metrics'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    const { clamp, RESOURCES, fraction, zeroResources } = ctx;
    function serviceMetrics(s, base, hardware, customers) {
      const research = ctx.researchEffects(s);
      const services = ctx.serviceSnapshot(s, hardware, customers);
      const active = s.agents.filter((a) => ctx.agentProductive(s, a, customers.assignments));
      const engineers = active
        .filter((a) => a.role === 'engineer')
        .reduce((sum, a) => sum + a.level * ctx.agentEffects(a).care, 0);
      const analysts = active
        .filter((a) => a.role === 'analyst')
        .reduce((sum, a) => sum + a.level * ctx.agentEffects(a).research, 0);
      const researchFocus = active
        .filter((a) => a.focus === 'research')
        .reduce((sum, a) => sum + a.level * ctx.agentEffects(a).research, 0);
      const temperature =
        services.rooms.reduce((sum, r) => sum + r.temperature * r.racks, 0) /
        Math.max(1, s.facility.racks.length);
      const physicalHeat = Math.max(0, temperature - 22) * 1.5;
      const heat = clamp(physicalHeat / (1 + 0.04 * (s.upgrades.cooling || 0)), 0, 100);
      const available = services.rooms.reduce((n, r) => n + r.available.cpu, 0);
      const productive = [...hardware.values()].flatMap((r) =>
        r.servers
          .filter((n) => n.available && ctx.serverLinkState(s, n.server, r.rack))
          .map((n) => n.server),
      );
      const condition = productive.length
        ? productive.reduce((sum, n) => sum + n.condition, 0) / productive.length
        : 100;
      const reliability = productive.length
        ? clamp(99.5 - heat * 0.4 - Math.max(0, 90 - condition) * 0.5, 20, 99.5)
        : 20;
      const cooling = Math.min(6, (s.upgrades.cooling || 0) * 0.3);
      const riskPerHour = clamp(
        8 +
          heat * 0.25 +
          base.failedServers * 0.3 +
          Math.max(0, 80 - condition) * 0.18 +
          (s.policies.power === 'performance' ? 2 : 0) -
          Math.min(5, engineers * 0.25) -
          cooling -
          (s.policies.power === 'eco' ? 1 : 0) -
          (s.resilience.agentEffects.diagnoseRemaining > 0 ? 12 : 0),
        1,
        70,
      );
      const energy =
        (base.powerW / 1000) *
        (s.policies.power === 'eco' ? 0.045 : s.policies.power === 'performance' ? 0.09 : 0.065) *
        research.energy;
      const assetCare = s.servers.reduce(
        (sum, a) =>
          sum +
          ctx.catalog.servers[a.type].power * a.level * (s.policies.autorepair ? 0.012 : 0.006),
        0,
      );
      const personnel = s.agents.reduce((sum, a) => sum + ctx.agentWage(a), 0) + services.crewCost;
      const efficiency =
        1 - (0.25 * (s.upgrades.automation || 0)) / ((s.upgrades.automation || 0) + 12);
      const upkeep =
        (energy + assetCare) * efficiency +
        personnel +
        base.centralUpkeep +
        s.facility.racks.length * 0.025;
      const rawIncome = services.gross - upkeep;
      const recoveryAllowance = base.onlineServers === 0 ? Math.max(0, 0.08 - rawIncome) : 0;
      const projectDemand = zeroResources(),
        jobNeeds = s.jobs.map(ctx.jobResources);
      for (const needs of jobNeeds) for (const key of RESOURCES) projectDemand[key] += needs[key];
      const jobFactor = fraction(projectDemand, services.free);
      const workBase = services.free.cpu * 0.15;
      const workforce =
        1 +
        Math.min(
          0.25,
          active.reduce(
            (sum, a) => sum + a.level * (a.focus === 'income' ? 2 : 1) * ctx.agentEffects(a).work,
            0,
          ) / 200,
        );
      const workPerSecond =
        workBase *
        research.work *
        (s.lab?.project ? 0.9 : 1) *
        (1 + 0.12 * (s.upgrades.routing || 0)) *
        workforce *
        (s.resilience.operation?.kind === 'backup' ? 0.5 : 1) *
        (s.resilience.agentEffects.optimizeRemaining > 0 ? 1.15 : 1);
      // A GPU shortage blocks GPU work, not unrelated CPU work. Resource shares
      // remain proportional, so accepting more projects never creates capacity.
      const readiness = jobNeeds.map((needs) =>
        Math.min(
          1,
          ...RESOURCES.filter((k) => needs[k] > 0).map(
            (k) => services.free[k] / Math.max(projectDemand[k], 0.001),
          ),
        ),
      );
      const weights = s.jobs.map(
        (j, i) =>
          readiness[i] *
          (s.policies.priority === 'income'
            ? j.reward / j.totalWork
            : s.policies.priority === 'research'
              ? j.science / j.totalWork
              : 1),
      );
      const total = weights.reduce((a, b) => a + b, 0);
      const jobRates = Object.fromEntries(
        s.jobs.map((j, i) => [
          j.id,
          total ? ((workPerSecond * weights[i]) / total) * readiness[i] : 0,
        ]),
      );
      const researchPerSecond = base.onlineServers
        ? research.research *
          (0.008 + analysts * 0.026 + researchFocus * 0.012) *
          (1 + (0.6 * (s.upgrades.synthesis || 0)) / ((s.upgrades.synthesis || 0) + 12)) *
          base.hardwareFactor
        : 0;
      return {
        ...base,
        heat,
        reliability,
        riskPerHour: clamp(riskPerHour * research.risk, 1, 70),
        upkeep,
        incomePerSecond: recoveryAllowance > 0 ? 0.08 : rawIncome,
        workPerSecond,
        researchPerSecond,
        jobRates,
        serviceIncome: services.gross,
        serviceModel: services,
        customerSupply: Object.fromEntries(
          services.rooms.map((r) => [
            r.roomId,
            {
              ...Object.fromEntries(r.groups.map((g) => [g.kind, g.supplied])),
              available: r.available,
              reserved: r.reserved,
              changing: r.changeRemaining > 0 || Boolean(r.conversion),
            },
          ]),
        ),
        personnelCost: personnel,
        recoveryAllowance,
        serviceUnits: services.totalUnits,
        serviceDelivered: services.delivered,
        usedCapacity:
          (base.capacity * (services.committedCPU + projectDemand.cpu)) / Math.max(1, available),
        load: Math.min(2, (services.committedCPU + projectDemand.cpu) / Math.max(1, available)),
        freeResources: services.free,
        admissionResources: services.committedFree,
        gpuUsed: Math.min(
          base.gpuCapacity,
          Math.max(0, base.gpuCapacity - services.free.gpu) + projectDemand.gpu,
        ),
        gpuLoad: base.gpuCapacity
          ? Math.min(
              1,
              (Math.max(0, base.gpuCapacity - services.free.gpu) + projectDemand.gpu) /
                base.gpuCapacity,
            )
          : 0,
        resourceFulfillment: jobFactor,
        jobBlockedReasons: Object.fromEntries(
          s.jobs
            .filter((j, i) => readiness[i] < 0.001)
            .map((j) => [
              j.id,
              j.kind === 'ai' && services.free.gpu === 0
                ? ctx.gpuUnavailableReason(s)
                : 'Benötigte Ressourcen sind derzeit nicht verfügbar.',
            ]),
        ),
        safetyMode: ctx.globalIncident(s),
      };
    }
    return { serviceMetrics };
  };
});
