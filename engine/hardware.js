/** Hardware: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['hardware'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    const { catalog, HARDWARE, FIRST_DEVICE_UNIT, LAST_DEVICE_UNIT, clamp, finite } = context;
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const activeRackIds = (...args) => context.activeRackIds(...args);

    function serverDemandMbps(server, loadFraction = 0.15) {
      const base =
        server.type === 'ai'
          ? 4200
          : server.type === 'compute'
            ? 1800
            : server.type === 'storage'
              ? 1000
              : 550;
      return Math.max(
        60,
        base * Math.pow(server.level, 0.72) * (0.2 + clamp(loadFraction, 0, 1) * 0.8),
      );
    }

    function hardwareSnapshot(s) {
      const rackRows = new Map();
      const aggregateLoad = s.jobs.reduce((sum, job) => sum + job.load, 0);
      const aggregateCapacity = s.servers.reduce(
        (sum, server) => sum + catalog.servers[server.type].capacity * Math.pow(server.level, 0.82),
        0,
      );
      const workload = aggregateCapacity > 0 ? clamp(aggregateLoad / aggregateCapacity, 0, 1) : 0;
      const allocation = context.supplyAllocation(s, activeRackIds(s));
      for (const rack of s.facility.racks) {
        const supply = allocation.get(rack.id);
        rackRows.set(rack.id, {
          rack,
          servers: [],
          supply,
          powerW: 42 + supply.drawW,
          coolingW: (supply.cooling === 'central' ? 0 : rack.coolingLevel * 2000) + supply.coolingW,
          centralCoolingW: supply.coolingW,
          centralPowerW: supply.drawW,
          centralPowerCapacityW: supply.powerW,
          upsCapacityW: supply.upsW,
          temperature: 22,
          demand: 0,
          uplink: rack.switchLevel === 1 ? 2500 : rack.switchLevel === 2 ? 25000 : 100000,
          portSpeed: rack.switchLevel === 1 ? 1000 : rack.switchLevel === 2 ? 10000 : 25000,
        });
      }
      for (const server of s.servers) {
        const row = rackRows.get(server.rackId);
        if (!row) continue;
        const rawW = specPowerW(server, s.policies.power);
        const available =
          server.powered &&
          server.bootRemaining <= 0 &&
          server.status === 'online' &&
          server.condition > 0 &&
          !row.supply.converting &&
          !context.incidentAffects(s, server, row.rack) &&
          !context.preventiveRackOffline(s, server.rackId) &&
          !context.rackMaintenanceOffline(s, server.rackId);
        const demand =
          available && !row.rack.disabledPorts.includes(server.port)
            ? serverDemandMbps(server, workload)
            : 0;
        const drawW = available
          ? rawW
          : server.powered && server.bootRemaining > 0 && server.status === 'online'
            ? rawW * 0.3
            : 0;
        row.powerW += drawW;
        row.demand += demand;
        row.servers.push({
          server,
          powerW: Math.round(drawW),
          nominalPowerW: Math.round(rawW),
          demand,
          available,
        });
      }
      for (const row of rackRows.values()) {
        row.basePowerCapacityW = row.rack.powerLevel * 2000;
        row.centralPowerCapacityW = row.centralPowerCapacityW || 0;
        row.powerCapacityW =
          row.supply.power === 'central'
            ? Math.min(row.basePowerCapacityW, row.centralPowerCapacityW)
            : row.basePowerCapacityW + row.centralPowerCapacityW;
        const powerRatio = row.powerCapacityW > 0 ? row.powerW / row.powerCapacityW : 1;
        const thermalRatio = row.coolingW > 0 ? row.powerW / row.coolingW : 1;
        row.targetTemperature = clamp(
          22 + Math.max(0, thermalRatio - 0.45) * 34 + Math.max(0, powerRatio - 0.88) * 24,
          22,
          100,
        );
        row.temperature = finite(row.rack.temperature)
          ? clamp(row.rack.temperature, 22, 100)
          : row.targetTemperature;
        const uplinkFactor = row.demand <= 0 ? 1 : Math.min(1, row.uplink / row.demand);
        for (const node of row.servers)
          node.networkFactor =
            node.demand <= 0
              ? 1
              : clamp(Math.min(1, row.portSpeed / node.demand, uplinkFactor), 0.08, 1);
        row.networkFactor =
          row.demand <= 0
            ? 1
            : clamp(
                row.servers.reduce(
                  (sum, node) =>
                    sum +
                    node.demand *
                      Math.min(1, row.portSpeed / Math.max(1, node.demand), uplinkFactor),
                  0,
                ) / row.demand,
                0.08,
                1,
              );
        row.powerFactor = powerRatio <= 1 ? 1 : clamp(1 / powerRatio, 0.55, 1);
        row.thermalFactor = clamp(1 - Math.max(0, row.temperature - 35) * 0.012, 0.55, 1);
      }
      return rackRows;
    }

    function advanceTemperatures(s, dt) {
      for (const row of hardwareSnapshot(s).values()) {
        const passiveCooling = Boolean(context.rackMaintenanceOffline(s, row.rack.id));
        const tau = row.targetTemperature > row.temperature ? 45 : passiveCooling ? 180 : 120;
        const next =
          row.targetTemperature + (row.temperature - row.targetTemperature) * Math.exp(-dt / tau);
        row.rack.temperature =
          Math.abs(next - row.targetTemperature) < 0.005
            ? row.targetTemperature
            : clamp(next, 22, 100);
      }
    }

    function serverLinkState(
      s,
      server,
      rack = s.facility.racks.find((x) => x.id === server.rackId),
    ) {
      return Boolean(
        rack &&
        server.status === 'online' &&
        server.condition > 0 &&
        server.powered &&
        server.bootRemaining <= 0 &&
        !rack.disabledPorts.includes(server.port) &&
        !context.preventiveRackOffline(s, rack.id) &&
        !context.rackMaintenanceOffline(s, rack.id) &&
        !context.incidentAffects(s, server, rack) &&
        !context.roomState(s, rack.roomId)?.conversion,
      );
    }

    function portCount(rack) {
      return rack.switchLevel === 1 ? 8 : 16;
    }

    function fitServer(s, rack, type, requestedUnit, requestedPort, exceptId = null) {
      if (context.roomState(s, rack.roomId)?.conversion)
        return { ok: false, reason: 'Dieser Bereich wird umgebaut.' };
      const size = HARDWARE[type].units;
      const occupied = new Set();
      const usedPorts = new Set();
      for (const server of s.servers)
        if (server.id !== exceptId && server.rackId === rack.id) {
          usedPorts.add(server.port);
          for (let u = server.unit; u < server.unit + HARDWARE[server.type].units; u++)
            occupied.add(u);
        }
      const unit =
        requestedUnit == null
          ? (() => {
              for (let u = FIRST_DEVICE_UNIT; u + size - 1 <= LAST_DEVICE_UNIT; u++) {
                let free = true;
                for (let v = u; v < u + size; v++) if (occupied.has(v)) free = false;
                if (free) return u;
              }
              return null;
            })()
          : requestedUnit;
      const port =
        requestedPort == null
          ? (() => {
              for (let p = 1; p <= portCount(rack); p++)
                if (!usedPorts.has(p) && !rack.disabledPorts.includes(p)) return p;
              return null;
            })()
          : requestedPort;
      if (!Number.isInteger(unit) || unit < FIRST_DEVICE_UNIT || unit + size - 1 > LAST_DEVICE_UNIT)
        return {
          ok: false,
          reason: 'Das Gerät passt nicht in die freien Höheneinheiten dieses Racks.',
        };
      for (let u = unit; u < unit + size; u++)
        if (occupied.has(u)) return { ok: false, reason: `Höheneinheit U${u} ist bereits belegt.` };
      if (!Number.isInteger(port) || port < 1 || port > portCount(rack))
        return { ok: false, reason: `Dieser Switch hat ${portCount(rack)} Ports.` };
      if (usedPorts.has(port)) return { ok: false, reason: `Port ${port} ist bereits belegt.` };
      if (rack.disabledPorts.includes(port))
        return { ok: false, reason: `Port ${port} ist deaktiviert.` };
      return { ok: true, unit, port };
    }

    function specPowerW(server, policy = 'balanced') {
      const modeFactor = server.mode === 'performance' ? 1.65 : server.mode === 'eco' ? 0.58 : 1;
      const policyFactor = policy === 'performance' ? 1.3 : policy === 'eco' ? 0.68 : 1;
      return Math.round(
        catalog.servers[server.type].power * server.level * 100 * modeFactor * policyFactor,
      );
    }
    return {
      serverDemandMbps,
      hardwareSnapshot,
      advanceTemperatures,
      serverLinkState,
      portCount,
      fitServer,
      specPowerW,
    };
  };
});
