/** Budgeted maintenance and bounded parts deliveries use simulation time only. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {}).operations = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    const LIMIT_KEYS = ['repair', 'backup', 'parts', 'reserve', 'plan', 'savings'];
    function operationsDefaults() {
      return {
        version: 1,
        limits: { repair: null, backup: null, parts: 600, reserve: null, plan: 0, savings: 0 },
        backupSpent: 0,
        partsSpent: 0,
        planSpent: 0,
        partsTarget: 3,
        autoParts: false,
        orders: [],
        queue: [],
        paused: false,
        nextCheck: 0,
        projects: [],
      };
    }
    function maintenancePolicy(s) {
      const l = s.operations?.limits || {};
      return {
        repair: l.repair ?? s.policies.repairBudget,
        backup: l.backup ?? s.policies.repairBudget,
        parts: l.parts ?? 0,
        reserve: l.reserve ?? s.policies.reserve,
        plan: l.plan ?? 0,
        savings: l.savings ?? 0,
      };
    }
    function partsCapacity(s) {
      return Math.min(20000, 20 * Math.max(1, s.facility.building.rooms.length));
    }
    function deliveryQuote(s, p = {}) {
      const quantity = Number(p.quantity ?? 3),
        method = p.method ?? 'standard';
      const pending = s.operations.orders.reduce((n, o) => n + o.quantity, 0);
      const cost = Math.ceil(
        quantity *
          (220 / 3) *
          (1 + Math.max(0, s.sector - 1) * 0.2) *
          (method === 'express' ? 2 : 1),
      );
      let reason = '';
      if (
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > 200 ||
        !['standard', 'express'].includes(method)
      )
        reason = 'Ungültige Teilebestellung.';
      else if (s.operations.orders.length >= 2)
        reason = 'Es sind bereits zwei Lieferungen unterwegs.';
      else if (quantity + s.resilience.parts + pending > partsCapacity(s))
        reason = 'Das Ersatzteillager hat zu wenig freie Plätze.';
      else if (s.credits < cost) reason = 'Das verfügbare Budget reicht nicht aus.';
      return {
        enabled: !reason,
        reason,
        cost,
        quantity,
        method,
        duration: method === 'express' ? 300 : 1800,
        label: method === 'express' ? 'Expresslieferung bestellen' : 'Ersatzteile bestellen',
      };
    }
    function orderParts(s, p, automatic = false) {
      const q = deliveryQuote(s, p);
      if (!q.enabled) return { ok: false, message: q.reason };
      const policy = maintenancePolicy(s);
      if (
        automatic &&
        (s.operations.partsSpent + q.cost > policy.parts || s.credits - q.cost < policy.reserve)
      )
        return { ok: false, message: 'Das Beschaffungsbudget reicht nicht aus.' };
      s.credits -= q.cost;
      if (automatic) s.operations.partsSpent += q.cost;
      s.operations.orders.push({
        quantity: q.quantity,
        cost: q.cost,
        method: q.method,
        arrivalAt: s.time + q.duration,
      });
      ctx.addLog(
        s,
        'system',
        `${q.quantity} Ersatzteile bestellt. Lieferung in ${q.duration} Sekunden.`,
      );
      return { ok: true, message: 'Lieferung beauftragt.' };
    }
    function advanceOperations(s, dt) {
      const o = s.operations;
      if (!o) return;
      o.orders = o.orders.filter((order) => {
        if (order.arrivalAt > s.time) return true;
        s.resilience.parts += order.quantity;
        ctx.addLog(s, 'success', `${order.quantity} Ersatzteile eingetroffen.`);
        return false;
      });
      ctx.advanceProjects(s, dt);
      if (s.time < o.nextCheck) return;
      o.nextCheck = s.time + 60;
      if (o.autoParts) {
        const quantity = Math.min(
          200,
          o.partsTarget - s.resilience.parts - o.orders.reduce((n, x) => n + x.quantity, 0),
        );
        if (quantity > 0) orderParts(s, { quantity, method: 'standard' }, true);
      }
      ctx.advancePlan(s);
    }
    function applyOperations(s, action, p) {
      if (action === 'orderParts') return orderParts(s, p);
      if (action === 'setOperationsPolicy') {
        const limits = {};
        for (const key of LIMIT_KEYS) {
          const v = p[key];
          if (!Number.isSafeInteger(v) || v < 0 || v > ctx.PLAN_MAX_COST)
            return { ok: false, message: 'Ungültige Budgetgrenze.' };
          limits[key] = v;
        }
        if (
          !Number.isSafeInteger(p.partsTarget) ||
          p.partsTarget < 0 ||
          p.partsTarget > partsCapacity(s) ||
          typeof p.autoParts !== 'boolean'
        )
          return { ok: false, message: 'Ungültiger Lagerplan.' };
        s.operations.limits = limits;
        s.operations.partsTarget = p.partsTarget;
        s.operations.autoParts = p.autoParts;
        s.operations.nextCheck = s.time;
        return { ok: true, message: 'Betriebsbudgets gespeichert. Verbrauch bleibt erhalten.' };
      }
      return ctx.applyPlan(s, action, p) || ctx.applyProjects(s, action, p);
    }
    function getOperations(s) {
      return {
        ...s.operations,
        limits: maintenancePolicy(s),
        partsCapacity: partsCapacity(s),
        repairSpent: s.resilience.budgetSpent,
        queue: s.operations.queue.map((item, index) => ({
          ...item,
          quote: ctx.quotePlannedOperation(s, item, s.operations.queue.slice(0, index)),
        })),
        projectOptions: s.agents.map((a) => ({
          id: a.id,
          options: Object.keys(ctx.PROJECTS).map((kind) => ctx.projectQuote(s, { id: a.id, kind })),
        })),
      };
    }
    return {
      LIMIT_KEYS,
      operationsDefaults,
      maintenancePolicy,
      partsCapacity,
      deliveryQuote,
      orderParts,
      advanceOperations,
      applyOperations,
      getOperations,
    };
  };
});
