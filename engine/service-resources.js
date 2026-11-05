/** Physical resources are shared by tenants and project work, never double booked. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['service-resources'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    const { RESOURCES, SERVICES, HARDWARE, zeroResources, fraction } = ctx;
    function roomResources(s, hardware = ctx.hardwareSnapshot(s)) {
      const rooms = new Map(
        s.facility.building.rooms.map((room) => [
          room.id,
          {
            id: room.id,
            installed: zeroResources(),
            available: zeroResources(),
            powerW: 0,
            temperature: 22,
            racks: 0,
          },
        ]),
      );
      for (const rack of hardware.values()) {
        const room = rooms.get(rack.rack.roomId);
        if (!room) continue;
        room.racks++;
        room.powerW += rack.powerW;
        room.temperature = Math.max(room.temperature, rack.temperature);
        let installedNetwork = 0,
          availableNetwork = 0;
        for (const node of rack.servers) {
          const server = node.server,
            spec = HARDWARE[server.type];
          const mode = server.mode === 'performance' ? 1.35 : server.mode === 'eco' ? 0.78 : 1;
          const policy =
            s.policies.power === 'performance' ? 1.15 : s.policies.power === 'eco' ? 0.9 : 1;
          const nominal = {
            cpu: spec.cores * server.level * mode * policy,
            ram: spec.ramGB * server.level,
            storage: spec.storageTB * server.level,
            network: rack.portSpeed,
            gpu: (spec.gpuCount || 0) * server.level,
            vram: (spec.vramGB || 0) * server.level,
          };
          const active = node.available && ctx.serverLinkState(s, server, rack.rack);
          const efficiency = active
            ? node.networkFactor * rack.powerFactor * rack.thermalFactor
            : 0;
          for (const key of RESOURCES) {
            if (key === 'network') continue;
            room.installed[key] += nominal[key];
            room.available[key] += nominal[key] * efficiency;
          }
          installedNetwork += nominal.network;
          availableNetwork += nominal.network * efficiency;
        }
        // Uplink is a shared bottleneck, not one uplink per port.
        room.installed.network += Math.min(rack.uplink, installedNetwork);
        room.available.network += Math.min(rack.uplink, availableNetwork);
      }
      return rooms;
    }
    function groupDemand(room, group, includePending = false, efficiency = 1) {
      const needs = SERVICES[group.kind].needs;
      const units = group.units + (includePending ? group.pending : 0);
      const profile = room.profile === SERVICES[group.kind].profile ? 0.9 : 1;
      return Object.fromEntries(
        RESOURCES.map((key) => [key, (needs[key] || 0) * units * profile * efficiency]),
      );
    }
    function serviceSnapshot(s, hardware, customers = ctx.customerReadModel(s)) {
      const premiums = customers.premiums;
      const research = ctx.researchEffects(s);
      const physical = roomResources(s, hardware),
        rows = [],
        free = zeroResources(),
        committedFree = zeroResources();
      const byRoom = new Map(s.business.rooms.map((r) => [r.roomId, r]));
      const agents = new Map(
        s.agents
          .filter((a) => ctx.agentProductive(s, a, customers.assignments))
          .map((a) => [a.id, a]),
      );
      let gross = 0,
        crewCost = 0,
        totalUnits = 0,
        delivered = 0,
        committedCPU = 0;
      for (const owned of s.facility.building.rooms) {
        const room = byRoom.get(owned.id) || ctx.roomDefaults(owned.id);
        const raw = physical.get(room.roomId),
          demand = zeroResources(),
          reserved = zeroResources();
        for (const group of room.groups) {
          const active = groupDemand(room, group, false, research.serviceEfficiency),
            committed = groupDemand(room, group, true, research.serviceEfficiency);
          for (const key of RESOURCES) {
            demand[key] += active[key];
            reserved[key] += committed[key];
          }
        }
        const units = room.groups.reduce((sum, g) => sum + g.units, 0);
        const manager = agents.get(room.managerId);
        const management = ctx.managerMultiplier(manager);
        const crewCapacity = room.crew * 24 * management;
        const crewFactor =
          Math.min(1, crewCapacity / Math.max(1, units)) * (room.changeRemaining > 0 ? 0.5 : 1);
        const trust = 1 + (0.15 * s.reputation) / (s.reputation + 1000);
        let revenue = 0,
          roomDelivered = 0;
        const consumed = zeroResources(),
          groups = [];
        const priority = ctx.servicePriority(s, room.roomId);
        const fractions = ctx.allocateServiceResources(
          raw.available,
          room.groups.map((group) => ({
            kind: group.kind,
            resources: groupDemand(room, group, false, research.serviceEfficiency),
          })),
          priority.kind,
        );
        for (const group of room.groups) {
          const needs = groupDemand(room, group, false, research.serviceEfficiency);
          // Only resources needed by this service can block it. A missing GPU
          // must not stop hosting or archives sharing the same room.
          const supplied = crewFactor * fractions.get(group.kind);
          for (const key of RESOURCES) consumed[key] += needs[key] * supplied;
          roomDelivered += group.units * supplied;
          groups.push({ ...group, supplied });
          const contracted = premiums.get(room.roomId + '/' + group.kind);
          const premiumShare =
            contracted?.units === group.units && group.units
              ? contracted.premium / group.units
              : group.premium
                ? 1
                : 0;
          const premium = 1 + 0.15 * premiumShare;
          const compensation =
            s.time >= s.business.transitionUntil ? 0.2 * premiumShare * (1 - supplied) : 0;
          revenue +=
            group.units *
            SERVICES[group.kind].fee *
            (group.kind === 'inference' ? research.inferenceIncome : 1) *
            trust *
            Math.max(0, supplied * premium - compensation);
        }
        const wages = raw.racks === 0 && units === 0 ? 0 : room.crew * 0.035 + units * 0.008;
        for (const key of RESOURCES) {
          free[key] += Math.max(0, raw.available[key] - consumed[key]);
          committedFree[key] += Math.max(0, raw.available[key] - reserved[key]);
        }
        gross += revenue;
        crewCost += wages;
        totalUnits += units;
        delivered += roomDelivered;
        committedCPU += consumed.cpu;
        rows.push({
          ...room,
          ...raw,
          priority: priority.kind,
          priorityUntil: priority.until,
          demand,
          reserved,
          units,
          supplied: units ? roomDelivered / units : 1,
          groups,
          revenue,
          wages,
          crewCapacity,
        });
      }
      return {
        rooms: rows,
        free,
        committedFree,
        gross,
        crewCost,
        totalUnits,
        delivered,
        committedCPU,
      };
    }
    function jobResources(job) {
      const needs = ctx.JOB_PROFILES[job.kind]?.needs || SERVICES.hosting.needs;
      const factor = Math.max(0.05, job.load / 5);
      const demand = Object.fromEntries(RESOURCES.map((key) => [key, (needs[key] || 0) * factor]));
      if (job.kind === 'ai') {
        demand.gpu = job.gpuDemand || 1;
        demand.vram =
          demand.gpu *
          (job.specialty === 'inference' ? 24 : job.specialty === 'evaluation' ? 40 : 64);
      }
      return demand;
    }
    function jobsFit(s, job, free) {
      if (!s.business) return true;
      const available = free || serviceSnapshot(s).committedFree,
        demand = jobResources(job);
      for (const current of s.jobs) {
        const needs = jobResources(current);
        for (const key of RESOURCES) demand[key] += needs[key];
      }
      return fraction(demand, available) >= 0.98;
    }
    function allocateProjectWork(jobs, free, workPerSecond, priority) {
      const needs = jobs.map(jobResources),
        demand = zeroResources();
      for (const resources of needs) for (const key of RESOURCES) demand[key] += resources[key];
      // Resource shortages slow only the projects that need the constrained resource.
      const readiness = needs.map((resources) =>
        Math.min(
          1,
          ...RESOURCES.filter((key) => resources[key] > 0).map(
            (key) => free[key] / Math.max(demand[key], 0.001),
          ),
        ),
      );
      const weights = jobs.map(
        (job, index) =>
          readiness[index] *
          (priority === 'income'
            ? job.reward / job.totalWork
            : priority === 'research'
              ? job.science / job.totalWork
              : 1),
      );
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      const jobRates = Object.fromEntries(
        jobs.map((job, index) => [
          job.id,
          total ? ((workPerSecond * weights[index]) / total) * readiness[index] : 0,
        ]),
      );
      return { demand, readiness, jobRates };
    }
    return {
      roomResources,
      groupDemand,
      serviceSnapshot,
      jobResources,
      jobsFit,
      allocateProjectWork,
    };
  };
});
