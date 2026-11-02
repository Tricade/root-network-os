/** Strict persisted preventive-maintenance data, kept separate from scheduling. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['preventive-save'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function () {
    const DAY = 86400,
      MINUTE = 60;
    function readPreventiveMaintenance(input, s) {
      const fail = () => {
        throw new Error('Ungültige vorbeugende Wartungsdaten.');
      };
      if (!input || typeof input !== 'object' || Array.isArray(input) || input.version !== 1)
        fail();
      const policy = input.policy;
      if (
        !policy ||
        typeof policy !== 'object' ||
        Array.isArray(policy) ||
        typeof policy.automatic !== 'boolean' ||
        !Number.isInteger(policy.threshold) ||
        policy.threshold < 50 ||
        policy.threshold > 80 ||
        !Number.isFinite(policy.earliestAt) ||
        policy.earliestAt < 0 ||
        !Number.isSafeInteger(policy.windowStart) ||
        policy.windowStart < 0 ||
        policy.windowStart >= DAY ||
        !Number.isSafeInteger(policy.windowEnd) ||
        policy.windowEnd < 0 ||
        policy.windowEnd >= DAY ||
        !Number.isFinite(policy.minimumSupply) ||
        ![0.95, 1].includes(policy.minimumSupply) ||
        !Number.isSafeInteger(policy.dailyLimit) ||
        policy.dailyLimit < 0 ||
        policy.dailyLimit > 1e12
      )
        fail();
      const dayStart = Math.floor(s.time / DAY) * DAY;
      if (
        input.dayStart !== dayStart ||
        !Number.isFinite(input.dailySpent) ||
        input.dailySpent < 0 ||
        input.dailySpent > 1e12 ||
        !Number.isFinite(input.nextCheck) ||
        input.nextCheck < 0 ||
        input.nextCheck > s.time + MINUTE
      )
        fail();
      const readRack = (id) => s.facility.racks.find((rack) => rack.id === id);
      let schedule = null;
      if (input.schedule !== null) {
        const v = input.schedule;
        if (
          !v ||
          typeof v !== 'object' ||
          Array.isArray(v) ||
          !readRack(v.rackId) ||
          !s.agents.some((agent) => agent.id === v.agentId && agent.role === 'engineer') ||
          !Number.isInteger(v.threshold) ||
          v.threshold < 50 ||
          v.threshold > 80 ||
          !Number.isFinite(v.earliestAt) ||
          v.earliestAt < 0 ||
          v.earliestAt > s.time + 30 * DAY ||
          !Number.isSafeInteger(v.ceiling) ||
          v.ceiling < 0 ||
          v.ceiling > 1e12 ||
          !Number.isSafeInteger(v.windowStart) ||
          v.windowStart < 0 ||
          v.windowStart >= DAY ||
          !Number.isSafeInteger(v.windowEnd) ||
          v.windowEnd < 0 ||
          v.windowEnd >= DAY ||
          typeof v.reason !== 'string' ||
          v.reason.length > 250
        )
          fail();
        schedule = { ...v };
      }
      let operation = null;
      if (input.operation !== null) {
        const v = input.operation,
          rack = v && readRack(v.rackId);
        if (
          !v ||
          typeof v !== 'object' ||
          Array.isArray(v) ||
          !rack ||
          !s.agents.some((agent) => agent.id === v.agentId && agent.role === 'engineer') ||
          !Number.isFinite(v.startedAt) ||
          v.startedAt > s.time ||
          !Number.isInteger(v.threshold) ||
          v.threshold < 50 ||
          v.threshold > 80 ||
          !Number.isSafeInteger(v.total) ||
          v.total < 1 ||
          !Number.isFinite(v.remaining) ||
          v.remaining < 0 ||
          v.remaining > v.total ||
          !Number.isSafeInteger(v.effort) ||
          v.effort < 1 ||
          !Number.isSafeInteger(v.cost) ||
          v.cost < 0 ||
          !Number.isSafeInteger(v.parts) ||
          v.parts < 0 ||
          !Number.isSafeInteger(v.downtimeTotal) ||
          v.downtimeTotal < 0 ||
          !Number.isFinite(v.downtimeRemaining) ||
          v.downtimeRemaining < 0 ||
          v.downtimeRemaining > v.downtimeTotal ||
          v.targetCondition !== 85 ||
          !Array.isArray(v.serverIds) ||
          !v.serverIds.length ||
          v.serverIds.length > 18 ||
          new Set(v.serverIds).size !== v.serverIds.length ||
          v.serverIds.some(
            (id) => !s.servers.some((server) => server.id === id && server.rackId === rack.id),
          )
        )
          fail();
        operation = { ...v, serverIds: [...v.serverIds] };
        const engineer = s.agents.find((a) => a.id === v.agentId),
          effort = 180 + 90 * v.serverIds.length;
        const duration = Math.ceil(
          effort / (1 + Math.min(1.5, Math.sqrt(Math.max(0, engineer.level - 1)) * 0.2)),
        );
        if (
          v.effort !== effort ||
          v.total !== duration ||
          v.parts !== Math.ceil(v.serverIds.length / 3) ||
          v.downtimeTotal !== Math.min(180, 30 + v.serverIds.length * 10) ||
          v.startedAt < 0 ||
          v.cost > 1e12
        )
          fail();
      }
      if (schedule && operation) fail();
      return {
        version: 1,
        policy: { ...policy },
        dayStart,
        dailySpent: input.dailySpent,
        nextCheck: input.nextCheck,
        schedule,
        operation,
      };
    }

    return { readPreventiveMaintenance };
  };
});
