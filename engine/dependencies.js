/** Failure domains follow physical connections, never a global "any node failed" flag. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {}).dependencies = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    function globalIncident(s) {
      return Boolean(s.resilience.incident && !s.resilience.incident.scope);
    }
    function incidentAffects(s, server, rack) {
      const incident = s.resilience.incident;
      if (!incident) return false;
      if (!incident.scope) return true; // Keep already-paid legacy recovery semantics.
      if (incident.scope === 'nodes') return incident.affected.includes(server.id);
      if (incident.scope === 'central')
        return ctx.roomSupply(s, rack?.roomId)[incident.system] === 'central';
      if (incident.scope === 'rack') return incident.rackId === server.rackId;
      return incident.roomId === rack?.roomId;
    }
    function incidentShare(s) {
      if (globalIncident(s)) return 1;
      const racks = new Map(s.facility.racks.map((r) => [r.id, r]));
      return (
        s.servers.filter((n) => incidentAffects(s, n, racks.get(n.rackId))).length /
        Math.max(1, s.servers.length)
      );
    }
    function rackIncident(s, rack) {
      const i = s.resilience.incident;
      if (!i || !rack) return false;
      if (!i.scope) return true;
      if (i.scope === 'central') return ctx.roomSupply(s, rack.roomId)[i.system] === 'central';
      if (i.scope === 'room') return i.roomId === rack.roomId;
      if (i.scope === 'rack') return i.rackId === rack.id;
      return false; // A failed node does not lock every other slot in its rack.
    }
    return { globalIncident, incidentAffects, incidentShare, rackIncident };
  };
});
