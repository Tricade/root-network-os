/** Schema 9 keeps paid batch work and notice consent across reloads and catch-up. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['save-maintenance'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    function normalizeV9(input) {
      const batch =
        input.facility?.operation?.kind === 'rack-batch' ? input.facility.operation : null;
      // The older validator still owns every unrelated field and single-component upgrade.
      const s = ctx.normalizeV8(
        batch ? { ...input, facility: { ...input.facility, operation: null } } : input,
      );
      if (batch) s.facility.operation = normalizeBatch(s, batch);
      s.version = 9;
      return s;
    }
    function normalizeBatch(s, op) {
      const fail = () => {
        throw new Error('Ungültiges Rack-Wartungsfenster.');
      };
      const n = ctx.checkedNumber;
      const rack = s.facility.racks.find((r) => r.id === op.rackId);
      const components = ctx.maintenanceComponents(op.changes?.map((c) => c?.component));
      if (
        !rack ||
        !components ||
        s.resilience.operation ||
        s.facility.centralOperation ||
        s.preventiveMaintenance.operation ||
        ctx.roomState(s, rack.roomId)?.conversion
      )
        fail();
      const changes = components.map((component) => {
        const targetLevel = op.changes.find((c) => c.component === component).targetLevel;
        if (
          targetLevel !== rack[component + 'Level'] + 1 ||
          targetLevel > (component === 'switch' ? 3 : ctx.MAX_RACK_LEVEL)
        )
          fail();
        return { component, targetLevel };
      });
      const pricingSector = n(op.pricingSector, 1, s.sector, true);
      const quotes = components.map((component) =>
        ctx.rackComponentQuote({ ...s, sector: pricingSector }, rack, component),
      );
      const total = quotes.reduce((sum, q) => sum + q.duration, 0);
      const remaining = n(op.remaining, 0.000001, total);
      if (
        op.total !== total ||
        !Array.isArray(op.notified) ||
        op.notified.length > ctx.CUSTOMER_ROOM_LIMIT ||
        new Set(op.notified).size !== op.notified.length ||
        op.notified.some(
          (id) =>
            typeof id !== 'string' ||
            !/^customer-[1-9][0-9]*$/.test(id) ||
            id.length > 40 ||
            Number(id.slice(9)) >= s.nextId,
        )
      )
        fail();
      // Contracts may have expired since notice; their original IDs and fee stay frozen.
      const notified = [...op.notified];
      const announced = op.noticeProtection === 0.5;
      const researched = s.lab.owned.includes('business-maintenance');
      const noticeDiscount = op.noticeDiscount;
      if (
        announced
          ? !notified.length || ![1, ...(researched ? [0.75] : [])].includes(noticeDiscount)
          : op.noticeProtection !== 0 || notified.length || noticeDiscount !== 1
      )
        fail();
      const noticeLead = announced ? (noticeDiscount === 0.75 ? 60 : 120) : 0;
      const noticeRemaining = n(op.noticeRemaining, 0, noticeLead);
      const upgradeCost = quotes.reduce((sum, q) => sum + q.cost, 0);
      const noticeFee = announced
        ? Math.ceil((20 + notified.length * 5 + upgradeCost * 0.08) * noticeDiscount)
        : 0;
      if (
        op.noticeLead !== noticeLead ||
        op.noticeFee !== noticeFee ||
        op.cost !== upgradeCost + noticeFee ||
        (noticeRemaining > 0 && remaining !== total)
      )
        fail();
      return {
        kind: 'rack-batch',
        label: 'Rack-Wartungsfenster',
        rackId: rack.id,
        changes,
        remaining,
        total,
        cost: op.cost,
        pricingSector,
        noticeFee,
        noticeLead,
        noticeRemaining,
        noticeProtection: announced ? 0.5 : 0,
        notified,
        noticeDiscount,
      };
    }
    return { normalizeV9 };
  };
});
