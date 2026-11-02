/** Schema 6 validates the commercial ledger against already validated room resources. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['save-customers'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    function normalizeV6(input) {
      const s = ctx.normalizeV5({ ...input, version: 5 });
      const b = ctx.checkedRecord(input.customers);
      const bad = () => {
        throw new Error('Ungültige Kundenverwaltung.');
      };
      const num = ctx.checkedNumber,
        bool = ctx.checkedBoolean;
      const seen = new Set(),
        assigned = new Set(),
        roomCount = new Map();
      const reserved = new Set(
        [
          ...s.servers,
          ...s.agents,
          ...s.jobs,
          ...s.offers,
          ...s.events,
          ...s.log,
          ...s.facility.racks,
          ...s.operations.queue,
        ].map((v) => v.id),
      );
      if (s.resilience.incident) reserved.add(s.resilience.incident.id);
      const roomIds = new Set(s.business.rooms.map((r) => r.roomId));
      const agents = new Map(s.agents.map((a) => [a.id, a]));
      function identity(v, prefix) {
        if (
          typeof v.id !== 'string' ||
          !new RegExp('^' + prefix + '-[1-9][0-9]*$').test(v.id) ||
          seen.has(v.id) ||
          reserved.has(v.id) ||
          typeof v.client !== 'string' ||
          !v.client.trim() ||
          v.client.length > 120 ||
          [...v.client].some((c) => c.codePointAt(0) < 32) ||
          !Object.hasOwn(ctx.SERVICES, v.kind)
        )
          bad();
        seen.add(v.id);
        return { id: v.id, client: v.client, kind: v.kind, units: num(v.units, 1, 1e6, true) };
      }
      if (
        b.version !== 1 ||
        !Array.isArray(b.contracts) ||
        b.contracts.length > roomIds.size * ctx.CUSTOMER_ROOM_LIMIT ||
        !Array.isArray(b.leads) ||
        b.leads.length > 12 ||
        !Array.isArray(b.history) ||
        b.history.length > 20
      )
        bad();
      const contracts = b.contracts.map((v) => {
        const c = identity(v, 'customer');
        if (
          !roomIds.has(v.roomId) ||
          !ctx.CUSTOMER_TERMS.includes(v.term) ||
          !['active', 'setup'].includes(v.stage) ||
          !['', 'setup', 'support', 'retention'].includes(v.work) ||
          (v.stage === 'setup' ? v.work !== 'setup' : v.work === 'setup') ||
          !['', 'outage', 'question', 'observing'].includes(v.issue) ||
          !['', 'sla', 'budget', 'consolidation', 'competitor'].includes(v.departure)
        )
          bad();
        const count = (roomCount.get(v.roomId) || 0) + 1;
        if (count > ctx.CUSTOMER_ROOM_LIMIT) bad();
        roomCount.set(v.roomId, count);
        const workRemaining = num(v.workRemaining, 0, 1200),
          workTotal = num(v.workTotal, 0, 1200);
        if (
          Boolean(v.work) !== Boolean(workRemaining) ||
          (v.work && ![600, 1200].includes(workTotal)) ||
          workRemaining > workTotal ||
          (!v.work && (workTotal || v.agentId !== null)) ||
          Boolean(v.notice) !== Boolean(v.departure)
        )
          bad();
        if (v.agentId !== null) {
          const a = agents.get(v.agentId);
          if (
            !v.work ||
            !a ||
            assigned.has(a.id) ||
            a.assignment ||
            s.operations.projects.some((p) => p.agentId === a.id)
          )
            bad();
          assigned.add(a.id);
        }
        return {
          ...c,
          roomId: v.roomId,
          term: v.term,
          remaining: num(v.remaining, Number.MIN_VALUE, v.term),
          stage: v.stage,
          premium: bool(v.premium),
          renew: bool(v.renew),
          satisfaction: num(v.satisfaction, 0, 100),
          deficit: num(v.deficit, 0, 86400),
          issue: v.issue,
          notice: num(v.notice, 0, v.term),
          departure: v.departure,
          reviewAt: num(v.reviewAt, 0, s.time + 21600),
          work: v.work,
          workRemaining,
          workTotal,
          agentId: v.agentId,
          retentionUsed: bool(v.retentionUsed),
        };
      });
      const leads = b.leads.map((v) => {
        const l = identity(v, 'lead');
        if (!ctx.CUSTOMER_TERMS.includes(v.term)) bad();
        return { ...l, term: v.term, expiresAt: num(v.expiresAt, 0, s.time + 14400) };
      });
      const history = b.history.map((v) => {
        const h = identity(v, 'customer');
        if (!['sla', 'budget', 'consolidation', 'competitor', 'term'].includes(v.reason)) bad();
        return { ...h, reason: v.reason, time: num(v.time, 0, s.time) };
      });
      for (const id of seen) s.nextId = Math.max(s.nextId, Number(id.split('-').at(-1)) + 1);
      if (!Number.isSafeInteger(s.nextId) || s.nextId > 1e9) bad();
      s.customers = {
        version: 1,
        contracts,
        leads,
        history,
        nextLeadAt: num(b.nextLeadAt, 0, s.time + 900),
        autoAccept: bool(b.autoAccept),
        autoAssign: bool(b.autoAssign),
        budget: num(b.budget, 0, 1e9, true),
        spent: num(b.spent, 0, 1e9),
        budgetWindow: num(b.budgetWindow, 0, Math.floor(s.time / 3600) * 3600),
        nextCheck: num(b.nextCheck, 0, s.time + 60),
        won: num(b.won, 0, 1e9, true),
        lost: num(b.lost, 0, 1e9, true),
      };
      const before = s.business.rooms.map((r) => r.groups.map((g) => [g.units, g.pending]));
      ctx.syncCustomerGroups(s);
      if (
        JSON.stringify(before) !==
        JSON.stringify(s.business.rooms.map((r) => r.groups.map((g) => [g.units, g.pending])))
      )
        bad();
      s.version = 6;
      return s;
    }
    function migrateCustomers(s) {
      s.customers = ctx.customerDefaults(s);
      s.version = 6;
    }
    return { normalizeV6, migrateCustomers };
  };
});
