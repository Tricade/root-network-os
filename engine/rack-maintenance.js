/** One paid outage for up to three components; customer notice is always opt-in. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['rack-maintenance'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    const COMPONENTS = ['switch', 'power', 'cooling'];
    function maintenanceComponents(input) {
      return Array.isArray(input) &&
        input.length >= 1 &&
        input.length <= 3 &&
        new Set(input).size === input.length &&
        input.every((v) => COMPONENTS.includes(v))
        ? COMPONENTS.filter((v) => input.includes(v))
        : null;
    }
    function rackMaintenanceOffline(s, id) {
      const op = s.facility.operation;
      return Boolean(op?.rackId === id && !(op.kind === 'rack-batch' && op.noticeRemaining > 0));
    }
    function quoteRackMaintenance(s, p = {}) {
      const components = maintenanceComponents(p.components);
      const rack = s.facility.racks.find((r) => r.id === p.rackId);
      const empty = {
        label: 'Rack-Wartungsfenster',
        description: '',
        cost: 0,
        duration: 0,
        noticeFee: 0,
        noticeLead: 0,
        affected: [],
        changes: [],
        enabled: false,
      };
      if (!rack || !components || (p.announce !== undefined && typeof p.announce !== 'boolean'))
        return {
          ...empty,
          reason: 'Wähle ein Rack und ein bis drei unterschiedliche Komponenten.',
        };
      const quotes = components.map((component) => ctx.rackComponentQuote(s, rack, component));
      const affected = s.customers.contracts
        .filter((c) => c.roomId === rack.roomId && c.stage === 'active')
        .map((c) => c.id);
      const upgradeCost = quotes.reduce((sum, q) => sum + q.cost, 0);
      const research = ctx.researchEffects(s);
      const noticeFee = p.announce
        ? Math.ceil((20 + affected.length * 5 + upgradeCost * 0.08) * research.noticeCost)
        : 0;
      const noticeLead = p.announce ? Math.round(120 * research.noticeLead) : 0;
      const duration = quotes.reduce((sum, q) => sum + q.duration, 0);
      const reason =
        (ctx.globalIncident(s)
          ? 'Während einer Krise oder laufenden Infrastrukturmaßnahme nicht verfügbar.'
          : '') ||
        quotes.find((q) => !q.enabled)?.reason ||
        (p.announce && !affected.length
          ? 'In diesem Raum gibt es keine aktiven Kunden für eine Ankündigung.'
          : '') ||
        ctx.cashReason(s, upgradeCost + noticeFee);
      return {
        ...empty,
        cost: upgradeCost + noticeFee,
        upgradeCost,
        noticeFee,
        noticeLead,
        duration,
        affected,
        enabled: !reason,
        reason,
        description:
          'Ein gemeinsamer Stillstand für alle gewählten Komponenten. Bestehende Defekte bleiben bestehen.',
        changes: components.map((component) => ({
          component,
          targetLevel: rack[component + 'Level'] + 1,
        })),
        warnings: quotes.flatMap((q) => q.warnings || []),
      };
    }
    function startRackMaintenance(s, p) {
      const q = quoteRackMaintenance(s, p);
      if (!q.enabled) return { ok: false, message: q.reason };
      const rack = s.facility.racks.find((r) => r.id === p.rackId);
      s.credits -= q.cost;
      s.facility.operation = {
        kind: 'rack-batch',
        label: q.label,
        rackId: rack.id,
        changes: q.changes,
        remaining: q.duration,
        total: q.duration,
        cost: q.cost,
        pricingSector: s.sector,
        noticeFee: q.noticeFee,
        noticeLead: q.noticeLead,
        noticeRemaining: q.noticeLead,
        noticeProtection: p.announce ? 0.5 : 0,
        notified: p.announce ? q.affected : [],
        noticeDiscount: p.announce ? ctx.researchEffects(s).noticeCost : 1,
      };
      ctx.addLog(
        s,
        'system',
        p.announce
          ? `Wartung angekündigt: ${rack.name}; ${q.affected.length} Kunden informiert; Beginn in ${q.noticeLead} Sekunden.`
          : `Rack-Wartungsfenster begonnen: ${rack.name}; ${q.changes.length} Ausbauten.`,
        'maintenance',
      );
      return {
        ok: true,
        message: p.announce
          ? 'Kundenankündigung versendet. Das Rack bleibt bis zum Wartungsbeginn online.'
          : 'Rack-Wartungsfenster gestartet.',
      };
    }
    function advanceRackMaintenance(s, dt) {
      const op = s.facility.operation;
      if (op?.kind !== 'rack-batch') return false;
      if (op.noticeRemaining > 0) {
        op.noticeRemaining = Math.max(0, op.noticeRemaining - dt);
        if (!op.noticeRemaining)
          ctx.addLog(s, 'system', 'Angekündigtes Rack-Wartungsfenster begonnen.', 'maintenance');
        return true;
      }
      op.remaining = Math.max(0, op.remaining - dt);
      if (op.remaining) return true;
      const rack = s.facility.racks.find((r) => r.id === op.rackId);
      if (rack)
        for (const change of op.changes) rack[change.component + 'Level'] = change.targetLevel;
      s.facility.operation = null;
      ctx.addLog(
        s,
        'success',
        `Rack-Wartungsfenster abgeschlossen: ${rack?.name || 'Rack'}; ${op.changes.length} Ausbauten.`,
        'upgrade',
      );
      return true;
    }
    function announcedMaintenanceSupply(s) {
      const op = s.facility.operation;
      if (op?.kind !== 'rack-batch' || !op.noticeProtection || op.noticeRemaining > 0) return null;
      // Compute the capacity without ONLY this planned outage. Failed servers,
      // global incidents, crew shortages and central-unit limits remain intact.
      const without = { ...s, facility: { ...s.facility, operation: null } };
      const rack = s.facility.racks.find((r) => r.id === op.rackId);
      const room = ctx
        .serviceSnapshot(without, ctx.hardwareSnapshot(without))
        .rooms.find((r) => r.roomId === rack?.roomId);
      return {
        notified: new Set(op.notified),
        protection: op.noticeProtection,
        supply: Object.fromEntries((room?.groups || []).map((g) => [g.kind, g.supplied])),
      };
    }
    return {
      maintenanceComponents,
      rackMaintenanceOffline,
      quoteRackMaintenance,
      startRackMaintenance,
      advanceRackMaintenance,
      announcedMaintenanceSupply,
    };
  };
});
