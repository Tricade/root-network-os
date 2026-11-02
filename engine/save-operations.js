/** Canonical, bounded v4 operation plans. Persist data, never executable actions. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['save-operations'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    function normalizeOperations(input, s) {
      const o = ctx.checkedRecord(input),
        n = ctx.checkedNumber,
        b = ctx.checkedBoolean;
      if (o.version !== 1) throw new Error('Ungültiger Betriebsplan.');
      const limits = {};
      ctx.checkedRecord(o.limits);
      for (const key of ctx.LIMIT_KEYS)
        limits[key] =
          o.limits[key] === null && ['repair', 'backup', 'reserve'].includes(key)
            ? null
            : n(o.limits[key], 0, ctx.PLAN_MAX_COST, true);
      function list(value, max) {
        if (!Array.isArray(value) || value.length > max) throw new Error('Zu großer Betriebsplan.');
        return value;
      }
      const orders = list(o.orders, 2).map((v) => {
        ctx.checkedRecord(v);
        if (!['standard', 'express'].includes(v.method)) throw new Error('Ungültige Lieferung.');
        return {
          quantity: n(v.quantity, 1, 200, true),
          cost: n(v.cost, 1, 1e12, true),
          method: v.method,
          arrivalAt: n(v.arrivalAt, s.time, s.time + (v.method === 'express' ? 300 : 1800)),
        };
      });
      if (
        orders.reduce((sum, v) => sum + v.quantity, 0) + s.resilience.parts >
        ctx.partsCapacity(s)
      )
        throw new Error('Überbuchtes Ersatzteillager.');
      const ids = new Set();
      const queue = list(o.queue, 12).map((v) => {
        ctx.checkedRecord(v);
        if (
          typeof v.id !== 'string' ||
          !/^plan-\d+$/.test(v.id) ||
          ids.has(v.id) ||
          Number(v.id.slice(5)) >= s.nextId
        )
          throw new Error('Ungültige Plan-ID.');
        ids.add(v.id);
        const payload = ctx.planPayload(v.action, ctx.checkedRecord(v.payload));
        if (!payload) throw new Error('Unzulässige geplante Aktion.');
        if (payload.rackId && !s.facility.racks.some((r) => r.id === payload.rackId))
          throw new Error('Unbekanntes Planziel.');
        if (typeof v.reason !== 'string' || v.reason.length > 250)
          throw new Error('Ungültiger Planstatus.');
        return {
          id: v.id,
          action: v.action,
          payload,
          ceiling: n(v.ceiling, 0, ctx.PLAN_MAX_COST, true),
          notBefore: n(v.notBefore ?? 0, 0, s.time + 30 * 86400),
          reason: v.reason,
        };
      });
      if (!ctx.planTargetsValid(s, queue)) throw new Error('Ungültige Bauplan-Reihenfolge.');
      const busy = new Set();
      const projects = list(o.projects, 12).map((v) => {
        ctx.checkedRecord(v);
        const a = s.agents.find((a) => a.id === v.agentId),
          def = ctx.PROJECTS[v.kind];
        if (
          !a ||
          a.assignment ||
          busy.has(a.id) ||
          !def ||
          v.level !== a.level ||
          v.role !== a.role ||
          v.focus !== a.focus ||
          v.total !== def.duration
        )
          throw new Error('Ungültiges Agentenprojekt.');
        busy.add(a.id);
        const synthesis = n(v.synthesis, 0, ctx.MAX_RESEARCH_LEVEL, true),
          cost = Math.ceil(180 * Math.sqrt(a.level) * (def.duration / 1800));
        const research = ctx.projectReward(v.kind, a.level, a.role, a.focus, synthesis),
          reputation = v.kind === 'audit' ? Math.ceil(15 * Math.sqrt(a.level)) : 0;
        if (v.cost !== cost || v.research !== research || v.reputation !== reputation)
          throw new Error('Veränderte Projektzusage.');
        return {
          agentId: a.id,
          kind: v.kind,
          remaining: n(v.remaining, Number.MIN_VALUE, def.duration),
          total: def.duration,
          cost,
          level: a.level,
          role: a.role,
          focus: a.focus,
          synthesis,
          research,
          reputation,
        };
      });
      return {
        version: 1,
        limits,
        backupSpent: n(o.backupSpent, 0, 1e12),
        partsSpent: n(o.partsSpent, 0, 1e12),
        planSpent: n(o.planSpent, 0, ctx.PLAN_MAX_COST),
        partsTarget: n(o.partsTarget, 0, ctx.partsCapacity(s), true),
        autoParts: b(o.autoParts),
        orders,
        queue,
        paused: b(o.paused),
        nextCheck: n(o.nextCheck, 0, s.time + 60),
        projects,
      };
    }
    return { normalizeOperations };
  };
});
