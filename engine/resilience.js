/** Resilience: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['resilience'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const cashReason = (...args) => context.cashReason(...args);
    const getMetrics = (...args) => context.getMetrics(...args);
    const getRackModel = (...args) => context.getRackModel(...args);
    const incidentQuotes = (...args) => context.incidentQuotes(...args);
    const makeOption = (...args) => context.makeOption(...args);
    const repairQuotes = (...args) => context.repairQuotes(...args);

    function workSnapshot(s) {
      return s.jobs.map((j) => ({ id: j.id, work: j.work }));
    }

    function getResilience(s, rackModel = null, metrics = null) {
      const m = metrics || getMetrics(s),
        r = s.resilience;
      const now = s.time;
      const incident = r.incident
        ? {
            id: r.incident.id,
            kind: r.incident.kind,
            title: r.incident.title,
            description: r.incident.description,
            consequence: r.incident.consequence,
            affected: r.incident.affected.slice(),
            choices: incidentQuotes(s),
          }
        : null;
      const backupCost = Math.ceil(
        (125 + s.servers.length * 8) * (1 + Math.max(0, s.sector - 1) * 0.12),
      );
      let backupReason =
        r.operation ||
        r.incident ||
        r.corrupted ||
        s.facility.operation ||
        s.facility.centralOperation
          ? 'Eine Krisen- oder Wartungsmaßnahme verhindert gerade eine neue Sicherung.'
          : '';
      if (!backupReason && now < r.backupCooldownUntil)
        backupReason = `Die Betriebssicherung ist erst in ${Math.ceil(r.backupCooldownUntil - now)} Sekunden wieder verfügbar.`;
      if (!backupReason) backupReason = cashReason(s, backupCost);
      const backup = makeOption({
        key: 'create',
        label: 'Betriebssicherung erstellen',
        cost: backupCost,
        duration: 30,
        enabled: !backupReason,
        reason: backupReason,
        description: `${backupCost} Credits und 30 Sekunden mit halbiertem Auftragsdurchsatz; speichert ${s.research.toFixed(1)} Forschung und ${s.jobs.length} aktive Aufträge. Kein Datenverlust.`,
      });
      const policy = context.maintenancePolicy(s);
      const parts = Math.min(
        3,
        context.partsCapacity(s) -
          r.parts -
          s.operations.orders.reduce((n, o) => n + o.quantity, 0),
      );
      const order = context.deliveryQuote(s, { quantity: parts });
      const partsPurchase = makeOption({
        key: 'bundle',
        label: 'Ersatzteile bestellen',
        cost: order.cost,
        parts,
        duration: order.duration,
        enabled: order.enabled,
        reason: order.reason,
        description: `${order.cost} Credits für ${parts} Ersatzteile; Lieferung nach 30 Minuten.`,
      });
      const displayStatuses = new Map(
        (rackModel || getRackModel(s, m)).racks.flatMap((rack) =>
          rack.servers.map((server) => [server.id, server.status]),
        ),
      );
      const servers = s.servers.map((server) => ({
        id: server.id,
        condition: server.condition,
        status: server.status,
        displayStatus: displayStatuses.get(server.id) || server.status,
        fault: server.fault,
        repairs: repairQuotes(s, server),
      }));
      const conditions = s.servers.length
        ? s.servers.reduce((v, x) => v + x.condition, 0) / s.servers.length
        : 0;
      return {
        online: m.onlineServers,
        failed: m.failedServers,
        repairing: s.servers.filter((x) => x.status === 'repairing').length,
        condition: conditions,
        integrity: r.integrity,
        riskPerHour: m.riskPerHour,
        riskLabel:
          m.riskPerHour < 28
            ? 'niedrig'
            : m.riskPerHour < 52
              ? 'erhöht'
              : m.riskPerHour < 76
                ? 'hoch'
                : 'kritisch',
        safetyMode: m.safetyMode,
        graceRemaining: Math.max(0, r.graceUntil - now),
        parts: r.parts,
        budget: policy.repair,
        spent: r.budgetSpent,
        reserve: policy.reserve,
        backupBudget: policy.backup,
        backupSpent: s.operations.backupSpent,
        partsCapacity: context.partsCapacity(s),
        budgetScope:
          'Reparaturen, Backups und Beschaffung haben getrennte Stundenbudgets. Manuelle Eingriffe sind ausgenommen.',
        backupAt: r.backup ? r.backup.createdAt : null,
        backupAge: r.backup ? Math.max(0, now - r.backup.createdAt) : null,
        backupCooldown: Math.max(0, r.backupCooldownUntil - now),
        backupProtectedResearch: r.backup ? r.backup.protectedResearch : 0,
        backupJobCount: r.backup ? r.backup.jobs.length : 0,
        operation: r.operation
          ? {
              kind: r.operation.kind,
              label: r.operation.label,
              remaining: r.operation.remaining,
              total: r.operation.total,
              serverId: r.operation.serverId,
            }
          : null,
        incident,
        servers,
        backup,
        partsPurchase,
      };
    }
    return { workSnapshot, getResilience };
  };
});
