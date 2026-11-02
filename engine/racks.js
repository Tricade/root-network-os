/** Racks: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['racks'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    const { catalog, HARDWARE, RACK_UNITS, FIRST_DEVICE_UNIT, LAST_DEVICE_UNIT, clamp } = context;
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const getFacilityLayout = (...args) => context.getFacilityLayout(...args);
    const getMetrics = (...args) => context.getMetrics(...args);
    const gpuSnapshot = (...args) => context.gpuSnapshot(...args);
    const hardwareSnapshot = (...args) => context.hardwareSnapshot(...args);
    const portCount = (...args) => context.portCount(...args);
    const quoteHardware = (...args) => context.quoteHardware(...args);
    const rackComponentQuote = (...args) => context.rackComponentQuote(...args);
    const serverDemandMbps = (...args) => context.serverDemandMbps(...args);
    const serverLinkState = (...args) => context.serverLinkState(...args);

    function getRackModel(s, metrics = getMetrics(s)) {
      const rows = hardwareSnapshot(s),
        all = [];
      const gpu = gpuSnapshot(s, rows);
      const jobLoad = s.jobs.reduce((sum, job) => sum + job.load, 0);
      const activity = clamp(jobLoad / Math.max(1, metrics.capacity), 0, 1);
      const workload =
        jobLoad /
        Math.max(
          1,
          s.servers.reduce(
            (sum, server) =>
              sum + catalog.servers[server.type].capacity * Math.pow(server.level, 0.82),
            0,
          ),
        );
      for (const rack of s.facility.racks) {
        const row = rows.get(rack.id);
        const occupied = new Set(),
          servers = [];
        const portServers = new Map(row.servers.map((node) => [node.server.port, node.server]));
        for (const physicalNode of row.servers
          .slice()
          .sort((a, b) => a.server.unit - b.server.unit)) {
          const server = physicalNode.server;
          const spec = HARDWARE[server.type];
          for (let u = server.unit; u < server.unit + spec.units; u++) occupied.add(u);
          const linked = Boolean(
            physicalNode.available && !rack.disabledPorts.includes(server.port),
          );
          const networkFactor = linked ? physicalNode.networkFactor : 0;
          const status =
            context.rackMaintenanceOffline(s, rack.id) || context.preventiveRackOffline(s, rack.id)
              ? 'maintenance'
              : server.status === 'failed'
                ? 'failed'
                : server.status === 'repairing'
                  ? 'repairing'
                  : server.bootRemaining > 0 && server.powered
                    ? 'booting'
                    : !server.powered
                      ? 'standby'
                      : !linked
                        ? 'disconnected'
                        : 'online';
          const serverActivity = status === 'online' ? activity : 0;
          const gpuCount = (spec.gpuCount || 0) * server.level;
          const gpuCapacity =
            physicalNode && physicalNode.available && linked
              ? gpuCount * networkFactor * row.powerFactor * row.thermalFactor
              : 0;
          const gpuUsed = gpu.capacity > 0 ? (gpu.used * gpuCapacity) / gpu.capacity : 0;
          servers.push({
            id: server.id,
            name: server.name,
            type: server.type,
            model: spec.model,
            level: server.level,
            unit: server.unit,
            units: spec.units,
            port: server.port,
            cores: spec.cores * server.level,
            ramGB: spec.ramGB * server.level,
            storageTB: spec.storageTB * server.level,
            driveBays: spec.driveBays,
            gpuCount,
            vramGB: (spec.vramGB || 0) * server.level,
            gpuCapacity,
            gpuUsed,
            gpuLoad: gpuCapacity > 0 ? gpuUsed / gpuCapacity : 0,
            networkDemandMbps: physicalNode ? Math.round(physicalNode.demand) : 0,
            powerW: physicalNode ? physicalNode.powerW : 0,
            temperature: row.temperature,
            condition: server.condition,
            powered: server.powered,
            bootRemaining: server.bootRemaining,
            status,
            link: linked,
            activity: serverActivity,
            capacity:
              catalog.servers[server.type].capacity *
              Math.pow(server.level, 0.82) *
              (server.mode === 'performance' ? 1.35 : server.mode === 'eco' ? 0.78 : 1) *
              (s.policies.power === 'performance' ? 1.15 : s.policies.power === 'eco' ? 0.9 : 1) *
              networkFactor *
              row.powerFactor *
              row.thermalFactor,
            networkFactor,
            warnings: [
              ...(row.powerW > row.powerCapacityW
                ? ['Rack-Stromlast liegt über der Nennleistung.']
                : []),
              ...(row.temperature > 35 ? ['Hohe Racktemperatur drosselt den Durchsatz.'] : []),
              ...(!linked && server.status === 'online'
                ? ['Keine aktive Verbindung zum Switch.']
                : []),
            ],
          });
        }
        const ports = Array.from({ length: portCount(rack) }, (_, index) => {
          const number = index + 1,
            server = portServers.get(number),
            enabled = !rack.disabledPorts.includes(number),
            link = Boolean(server && enabled && serverLinkState(s, server, rack));
          const demand = link ? serverDemandMbps(server, workload) : 0;
          return {
            number,
            serverId: server ? server.id : null,
            enabled,
            link,
            speedMbps: row.portSpeed,
            trafficMbps: link
              ? Math.min(row.portSpeed, demand * Math.min(1, row.uplink / Math.max(1, row.demand)))
              : 0,
          };
        });
        const warnings = [];
        const saturatedPorts = row.servers.filter(
          (node) =>
            node.available && serverLinkState(s, node.server, rack) && node.demand > row.portSpeed,
        );
        if (saturatedPorts.length)
          warnings.push(
            `${saturatedPorts.length} Switch-Port${saturatedPorts.length > 1 ? 's' : ''} begrenzt: ${row.portSpeed} Mbit/s je Anschluss. Ein Switch-Ausbau erhöht die nutzbare Leistung.`,
          );
        if (row.powerW > row.powerCapacityW)
          warnings.push(
            `Last ${Math.round(row.powerW)} W über Nennleistung ${row.powerCapacityW} W; Server werden gedrosselt.`,
          );
        if (row.temperature > 35)
          warnings.push(`Temperatur ${Math.round(row.temperature)} °C reduziert Leistung.`);
        if (row.demand > row.uplink)
          warnings.push(`Uplink überlastet: ${Math.round(row.demand)} / ${row.uplink} Mbit/s.`);
        const status =
          context.rackMaintenanceOffline(s, rack.id) || context.preventiveRackOffline(s, rack.id)
            ? 'maintenance'
            : row.powerW > row.powerCapacityW ||
                row.temperature > 35 ||
                row.demand > row.uplink ||
                saturatedPorts.length > 0
              ? 'limited'
              : 'online';
        all.push({
          id: rack.id,
          name: rack.name,
          units: RACK_UNITS,
          usedUnits: occupied.size,
          freeUnits: LAST_DEVICE_UNIT - FIRST_DEVICE_UNIT + 1 - occupied.size,
          switchLevel: rack.switchLevel,
          powerLevel: rack.powerLevel,
          coolingLevel: rack.coolingLevel,
          powerW: Math.round(row.powerW),
          powerCapacityW: row.powerCapacityW,
          basePowerCapacityW: row.basePowerCapacityW,
          centralPowerCapacityW: row.centralPowerCapacityW,
          powerFactor: row.powerFactor,
          coolingW: row.coolingW,
          centralCoolingW: row.centralCoolingW,
          temperature: row.temperature,
          targetTemperature: row.targetTemperature,
          networkDemandMbps: Math.round(row.demand),
          uplinkMbps: row.uplink,
          networkFactor: row.networkFactor,
          status,
          warnings,
          upgrades: {
            switch: rackComponentQuote(s, rack, 'switch'),
            power: rackComponentQuote(s, rack, 'power'),
            cooling: rackComponentQuote(s, rack, 'cooling'),
          },
          ports,
          servers,
        });
      }
      const totalDemandMbps = all.reduce((n, r) => n + r.networkDemandMbps, 0);
      return {
        rackLimit: getFacilityLayout(s).rackLimit,
        buyRack: quoteHardware(s, 'buyRack'),
        operation: s.facility.operation
          ? {
              kind: s.facility.operation.kind,
              label: s.facility.operation.label,
              rackId: s.facility.operation.rackId,
              remaining: s.facility.operation.remaining,
              total: s.facility.operation.total,
              targetLevel: s.facility.operation.targetLevel,
              cost: s.facility.operation.cost,
              noticeRemaining: s.facility.operation.noticeRemaining || 0,
              noticeLead: s.facility.operation.noticeLead || 0,
            }
          : null,
        totalUnits: all.length * RACK_UNITS,
        usedUnits: all.reduce((n, r) => n + r.usedUnits, 0),
        totalPowerW: Math.round(metrics.powerW),
        totalCoolingW: all.reduce((n, r) => n + r.coolingW, 0),
        totalDemandMbps,
        totalUplinkMbps: all.reduce((n, r) => n + r.uplinkMbps, 0),
        networkFactor: totalDemandMbps
          ? clamp(
              all.reduce((n, r) => n + r.networkDemandMbps * r.networkFactor, 0) / totalDemandMbps,
              0,
              1,
            )
          : 1,
        gpuCapacity: metrics.gpuCapacity,
        gpuInstalled: metrics.gpuInstalled,
        gpuUsed: metrics.gpuUsed,
        gpuLoad: metrics.gpuLoad,
        racks: all,
      };
    }
    return { getRackModel };
  };
});
