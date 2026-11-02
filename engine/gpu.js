/** Gpu: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['gpu'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    const { HARDWARE } = context;
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const hardwareSnapshot = (...args) => context.hardwareSnapshot(...args);
    const serverLinkState = (...args) => context.serverLinkState(...args);

    function gpuSnapshot(s, hardware = hardwareSnapshot(s)) {
      let installed = 0,
        capacity = 0;
      for (const server of s.servers) {
        const gpuCount = HARDWARE[server.type].gpuCount || 0;
        if (!gpuCount) continue;
        installed += gpuCount * server.level;
        const rack = hardware.get(server.rackId),
          node = rack && rack.servers.find((row) => row.server.id === server.id);
        if (node && node.available && serverLinkState(s, server, rack.rack))
          capacity +=
            gpuCount * server.level * node.networkFactor * rack.powerFactor * rack.thermalFactor;
      }
      let remaining = capacity,
        used = 0;
      const allocations = {},
        blocked = {};
      for (const job of s.jobs) {
        if (job.kind !== 'ai') continue;
        const demand = job.gpuDemand || 1;
        const allocated = Math.min(demand, remaining);
        allocations[job.id] = allocated;
        remaining -= allocated;
        used += allocated;
        if (allocated + 1e-9 < demand)
          blocked[job.id] =
            allocated > 0
              ? `GPU-Auftrag gedrosselt: ${allocated.toFixed(1)} von ${demand} GPUs effektiv verfügbar.`
              : capacity <= 0
                ? gpuUnavailableReason(s)
                : 'GPU-Kapazität ist belegt; der Auftrag wartet auf freie Beschleuniger.';
      }
      return {
        installed,
        capacity,
        used,
        load: capacity > 0 ? used / capacity : 0,
        allocations,
        blocked,
      };
    }

    function gpuUnavailableReason(s) {
      if (context.globalIncident(s))
        return 'KI-Aufträge pausieren während der offenen Versorgungskrise.';
      const aiServers = s.servers.filter((server) => server.type === 'ai');
      if (!aiServers.length) return 'Kein ROOT A480 mit verfügbaren GPUs installiert.';
      if (
        s.facility.operation &&
        aiServers.some((server) => server.rackId === s.facility.operation.rackId)
      )
        return 'KI-Aufträge pausieren während der Rack-Wartung.';
      if (aiServers.every((server) => !server.powered))
        return 'KI-Aufträge pausieren: Beschleuniger-Server ist ausgeschaltet.';
      if (aiServers.every((server) => server.bootRemaining > 0))
        return 'KI-Aufträge pausieren: Beschleuniger-Server startet noch.';
      if (aiServers.every((server) => server.status === 'failed' || server.status === 'repairing'))
        return 'KI-Aufträge pausieren: Beschleuniger-Server ist ausgefallen oder in Wartung.';
      return 'KI-Aufträge pausieren: keine betriebsbereite GPU-Verbindung verfügbar.';
    }
    return { gpuSnapshot, gpuUnavailableReason };
  };
});
