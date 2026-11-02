/** Project only bounded construction prerequisites. Quotes never mutate paid state. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['capital-plans'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    const PLAN_MAX_COST = 2e14;
    function projectedPlanState(s, preceding = []) {
      const b = s.facility.building;
      const projected = {
        ...s,
        credits: PLAN_MAX_COST * 2,
        facility: {
          ...s.facility,
          operation: null,
          centralOperation: null,
          central: { ...s.facility.central },
          racks: s.facility.racks.map((rack) => ({ ...rack })),
          building: {
            ...b,
            rooms: b.rooms.map((r) => ({ ...r })),
            specialRooms: [...b.specialRooms],
            project: null,
          },
        },
        business: {
          ...s.business,
          rooms: s.business.rooms.map((r) => ({ ...r, conversion: null })),
        },
      };
      const building = projected.facility.building;
      const complete = (kind, floor, roomType) => {
        if (kind === 'floor') building.floors++;
        if (kind === 'room') {
          const roomId = `room-${building.rooms.length + 1}`;
          building.rooms.push({ id: roomId, floor });
          projected.business.rooms.push(ctx.roomDefaults(roomId));
        }
        if (kind === 'service' && !building.specialRooms.includes(roomType))
          building.specialRooms.push(roomType);
      };
      if (b.project) complete(b.project.kind, b.project.floor, b.project.roomType);
      const upgradeRack = (payload, targetLevel) => {
        const rack = projected.facility.racks.find((r) => r.id === payload.rackId);
        if (rack)
          rack[payload.component + 'Level'] = targetLevel ?? rack[payload.component + 'Level'] + 1;
      };
      if (['power', 'cooling', 'switch'].includes(s.facility.operation?.kind))
        upgradeRack(
          { rackId: s.facility.operation.rackId, component: s.facility.operation.kind },
          s.facility.operation.targetLevel,
        );
      if (s.facility.operation?.kind === 'rack-batch')
        for (const change of s.facility.operation.changes)
          upgradeRack(
            { rackId: s.facility.operation.rackId, component: change.component },
            change.targetLevel,
          );
      if (s.facility.centralOperation)
        projected.facility.central[s.facility.centralOperation.system] =
          s.facility.centralOperation.targetLevel;
      for (const item of preceding.slice(0, 12)) {
        if (item.action === 'buildFloor') complete('floor');
        if (item.action === 'buildRoom') complete('room', item.payload.floor);
        if (item.action === 'buildServiceRoom') complete('service', 1, item.payload.roomType);
        if (item.action === 'upgradeCentral') projected.facility.central[item.payload.system]++;
        if (item.action === 'upgradeRack') upgradeRack(item.payload);
        if (item.action === 'upgradeRackBatch')
          for (const component of item.payload.components)
            upgradeRack({ ...item.payload, component });
      }
      return projected;
    }
    function planTargetsValid(s, queue) {
      const preceding = [];
      for (const item of queue) {
        const projected = projectedPlanState(s, preceding),
          p = item.payload,
          b = projected.facility.building;
        if (item.action === 'buildFloor' && b.floors >= ctx.MAX_FLOORS) return false;
        if (item.action === 'buildRoom' && b.rooms.length >= ctx.MAX_ROOMS) return false;
        if (p.rackId && !s.facility.racks.some((r) => r.id === p.rackId)) return false;
        if (p.roomId && !b.rooms.some((r) => r.id === p.roomId)) return false;
        if (
          item.action === 'buildRoom' &&
          (p.floor > b.floors || b.rooms.filter((r) => r.floor === p.floor).length >= 4)
        )
          return false;
        if (item.action === 'buildServiceRoom' && b.specialRooms.includes(p.roomType)) return false;
        preceding.push(item);
      }
      return true;
    }
    function quotePlannedOperation(s, item, preceding = s.operations.queue) {
      const projected = projectedPlanState(s, preceding);
      const q = ctx.planQuote(projected, item);
      return {
        ...q,
        costNow: 0,
        estimated: true,
        canSchedule:
          planTargetsValid(s, [...preceding, item]) && planStepPossible(s, item, preceding),
        ceiling: item.ceiling,
        notBefore: item.notBefore ?? s.time,
      };
    }
    function planStepPossible(s, item, preceding) {
      const projected = projectedPlanState(s, preceding),
        p = item.payload;
      if (item.action === 'upgradeRackBatch')
        return p.components.every((component) =>
          planStepPossible(
            s,
            { action: 'upgradeRack', payload: { rackId: p.rackId, component } },
            preceding,
          ),
        );
      if (item.action === 'upgradeRack') {
        const rack = projected.facility.racks.find((r) => r.id === p.rackId);
        return Boolean(
          rack && rack[p.component + 'Level'] < (p.component === 'switch' ? 3 : ctx.MAX_RACK_LEVEL),
        );
      }
      if (item.action === 'upgradeCentral') {
        const system = ctx.CENTRAL_SYSTEMS.find((row) => row.id === p.system);
        return Boolean(
          system &&
          projected.facility.building.specialRooms.includes(p.system) &&
          projected.facility.central[p.system] < system.maxLevel,
        );
      }
      return true;
    }
    return {
      PLAN_MAX_COST,
      projectedPlanState,
      planTargetsValid,
      quotePlannedOperation,
      planStepPossible,
    };
  };
});
