/** Named customer batches keep commercial work bounded as the bunker grows. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['customer-catalog'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    const CUSTOMER_TERMS = [86400, 259200, 604800];
    const CUSTOMER_NAMES = [
      'Aster Labs',
      'Vela Systems',
      'Cobalt Works',
      'Quasar Media',
      'Lumen Archive',
      'Orion Studio',
      'Nova Analytics',
      'Helix Cloud',
      'Mosaic Research',
      'Pulsar Digital',
      'Cirrus Works',
      'Aurora Services',
    ];
    const CUSTOMER_ROOM_LIMIT = 16;
    function makeCustomer(s, roomId, kind, units, pending = false) {
      const id = ctx.uid(s, 'customer');
      return {
        id,
        client:
          CUSTOMER_NAMES[ctx.personnelHash(s.seed, id) % CUSTOMER_NAMES.length] +
          ' / ' +
          id.split('-').at(-1),
        roomId,
        kind,
        units,
        term: 259200,
        remaining: 259200,
        stage: pending ? 'setup' : 'active',
        premium: false,
        renew: true,
        satisfaction: 100,
        deficit: 0,
        issue: '',
        notice: 0,
        departure: '',
        reviewAt: s.time + 21600,
        work: pending ? 'setup' : '',
        workRemaining: pending ? 600 : 0,
        workTotal: pending ? 600 : 0,
        agentId: null,
        retentionUsed: false,
      };
    }
    function customerDefaults(s) {
      const contracts = [];
      for (const room of s.business.rooms)
        for (const group of room.groups) {
          if (group.units) {
            const c = makeCustomer(s, room.roomId, group.kind, group.units);
            Object.assign(c, {
              remaining: group.remaining || 259200,
              premium: group.premium,
              renew: group.renew,
            });
            contracts.push(c);
          }
          if (group.pending) {
            const c = makeCustomer(s, room.roomId, group.kind, group.pending, true);
            c.workRemaining = group.onboarding;
            c.renew = group.renew;
            c.premium = group.nextPremium;
            contracts.push(c);
          }
        }
      const book = {
        version: 1,
        contracts,
        leads: [],
        history: [],
        nextLeadAt: s.time + 900,
        autoAccept: false,
        autoAssign: true,
        budget: 600,
        spent: 0,
        budgetWindow: Math.floor(s.time / 3600) * 3600,
        nextCheck: s.time,
        won: 0,
        lost: 0,
      };
      for (let i = 0; i < 3; i++) book.leads.push(makeCustomerLead(s));
      return book;
    }
    function makeCustomerLead(s) {
      // Independent stream: commercial enquiries never reroll incidents or job offers.
      let seed = ctx.personnelHash(s.seed, 'lead/' + s.nextId);
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      const kinds = Object.keys(ctx.SERVICES).filter((key) => s.sector >= ctx.SERVICES[key].sector);
      const kind = kinds[Math.floor(random() * kinds.length)];
      const needs = ctx.SERVICES[kind].needs;
      const roomCapacity = ctx
        .serviceSnapshot(s)
        .rooms.reduce(
          (max, room) =>
            Math.max(
              max,
              Math.min(
                ...Object.entries(needs).map(([key, demand]) => room.installed[key] / demand),
              ),
            ),
          0,
        );
      // Enquiries grow with usable hardware, including upgrades, rather than an arbitrary account count.
      const scale = Math.max(1, Math.min(1e6, Math.floor(roomCapacity * 0.15)));
      const id = ctx.uid(s, 'lead');
      return {
        id,
        client:
          CUSTOMER_NAMES[Math.floor(random() * CUSTOMER_NAMES.length)] +
          ' / ' +
          id.split('-').at(-1),
        kind,
        units: 1 + Math.floor(random() * scale),
        term: CUSTOMER_TERMS[Math.floor(random() * CUSTOMER_TERMS.length)],
        expiresAt: s.time + 14400,
      };
    }
    function customerAssignment(s, agentId) {
      return s.customers?.contracts.find((c) => c.work && c.agentId === agentId) || null;
    }
    function syncCustomerGroups(s) {
      const ledger = new Map();
      for (const c of s.customers.contracts) {
        const key = c.roomId + '/' + c.kind;
        if (!ledger.has(key)) ledger.set(key, { units: 0, pending: 0, onboarding: 0 });
        const g = ledger.get(key);
        if (c.stage === 'active') {
          g.units += c.units;
        } else {
          g.pending += c.units;
          g.onboarding = Math.max(g.onboarding, c.workRemaining);
        }
      }
      for (const r of s.business.rooms)
        for (const g of r.groups)
          Object.assign(
            g,
            ledger.get(r.roomId + '/' + g.kind) || {
              units: 0,
              pending: 0,
              onboarding: 0,
            },
          );
    }
    function customerReadModel(s) {
      const premiums = new Map(),
        assignments = new Map();
      for (const c of s.customers?.contracts || []) {
        if (c.work && c.agentId) assignments.set(c.agentId, c);
        if (c.stage === 'active') {
          const key = c.roomId + '/' + c.kind,
            row = premiums.get(key) || { units: 0, premium: 0 };
          row.units += c.units;
          if (c.premium) row.premium += c.units;
          premiums.set(key, row);
        }
      }
      return { premiums, assignments };
    }
    function getCustomers(s, options = {}) {
      const contracts = s.customers?.contracts || [];
      return {
        ...s.customers,
        contracts: options.summaryOnly
          ? []
          : contracts
              .filter((c) => !options.roomId || c.roomId === options.roomId)
              .map((c) => ({ ...c })),
        history: (s.customers?.history || []).map((entry) => ({ ...entry })),
        leads: (s.customers?.leads || []).map((l) => ({ ...l })),
        active: contracts.filter((c) => c.stage === 'active').length,
        settingUp: contracts.filter((c) => c.stage === 'setup').length,
        attention: contracts.filter((c) => c.issue || c.notice).length,
        notices: contracts.filter((c) => c.notice > 0).length,
        waitingAgents: contracts.filter((c) => c.work && !c.agentId).length,
        units: contracts.filter((c) => c.stage === 'active').reduce((n, c) => n + c.units, 0),
      };
    }
    return {
      CUSTOMER_TERMS,
      CUSTOMER_ROOM_LIMIT,
      makeCustomer,
      customerDefaults,
      makeCustomerLead,
      customerAssignment,
      syncCustomerGroups,
      customerReadModel,
      getCustomers,
    };
  };
});
