/** Schema 8 preserves commitments while giving older saves opt-in planning defaults. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['save-planning'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    function migratePlanning(s) {
      s.customerGrowth = ctx.growthDefaults(s);
      s.preventiveMaintenance = ctx.preventiveMaintenanceDefaults(s.time);
      s.servicePriorities = {};
      s.version = 8;
    }
    function normalizeV8(input) {
      const s = ctx.normalizeV7({ ...input, version: 7 });
      s.customerGrowth = ctx.normalizeGrowth(s, input.customerGrowth);
      s.preventiveMaintenance = ctx.normalizePreventiveMaintenance(input.preventiveMaintenance, s);
      s.servicePriorities = ctx.normalizeServicePriorities(input.servicePriorities, s);
      const operation = s.preventiveMaintenance.operation;
      if (operation) {
        const agent = s.agents.find((a) => a.id === operation.agentId);
        if (
          agent.assignment ||
          ctx.customerAssignment(s, agent.id) ||
          s.operations.projects.some((p) => p.agentId === agent.id)
        )
          throw new Error('Techniker ist mehrfach für Arbeit eingeplant.');
        if (
          s.facility.operation?.rackId === operation.rackId ||
          s.business.rooms.find(
            (r) => r.roomId === s.facility.racks.find((r) => r.id === operation.rackId).roomId,
          )?.conversion
        )
          throw new Error('Rackwartung überschneidet sich mit einem Umbau.');
      }
      s.version = 8;
      return s;
    }
    return { migratePlanning, normalizeV8 };
  };
});
