/** Actions recovery: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['actions-recovery'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const addLog = (...args) => context.addLog(...args);
    const applyWorkLosses = (...args) => context.applyWorkLosses(...args);
    const getResilience = (...args) => context.getResilience(...args);
    const incidentQuotes = (...args) => context.incidentQuotes(...args);
    const workLosses = (...args) => context.workLosses(...args);

    function applyRecovery(s, action, payload, m) {
      const fail = (message) => ({ ok: false, message });
      if (action === 'repairServer') {
        const server = s.servers.find((x) => x.id === payload.id);
        if (!server) return fail('Server nicht gefunden.');
        const option = getResilience(s)
          .servers.find((x) => x.id === server.id)
          ?.repairs.find((x) => x.key === payload.method);
        if (!option) return fail('Diese Reparaturmethode ist ungültig.');
        if (!option.enabled)
          return fail(option.reason || 'Diese Reparatur ist derzeit nicht verfügbar.');
        const workTotal = s.jobs.reduce((sum, j) => sum + j.work, 0),
          fraction = workTotal > 0 ? option.workLoss / workTotal : 0;
        const losses = workLosses(s, fraction);
        if (payload.method === 'manual') applyWorkLosses(s, losses);
        s.credits -= option.cost;
        s.resilience.parts -= option.parts;
        server.status = 'repairing';
        s.resilience.operation = {
          kind: 'repair',
          label: option.label,
          remaining: option.duration,
          total: option.duration,
          serverId: server.id,
          cost: option.cost,
          effect: {
            condition: option.condition,
            workLosses: payload.method === 'manual' ? [] : losses,
            reputationLoss: 0,
          },
        };
        addLog(
          s,
          'system',
          `${option.label} gestartet: ${server.name}; ${option.cost} Credits, ${option.parts} Ersatzteile, ${option.duration} Sekunden.`,
        );
        return { ok: true, message: `${option.label} gestartet.` };
      }
      if (action === 'createBackup') {
        const option = getResilience(s).backup;
        if (!option.enabled)
          return fail(option.reason || 'Eine Betriebssicherung ist derzeit nicht verfügbar.');
        s.credits -= option.cost;
        s.resilience.backupCooldownUntil = s.time + 300;
        s.resilience.autoBackupNextAt = Math.max(s.resilience.autoBackupNextAt, s.time + 900);
        s.resilience.operation = {
          kind: 'backup',
          label: 'Betriebssicherung',
          remaining: option.duration,
          total: option.duration,
          serverId: null,
          cost: option.cost,
          effect: { snapshot: true },
        };
        addLog(
          s,
          'system',
          `Betriebssicherung gestartet: ${option.cost} Credits; Abschluss in ${option.duration} Sekunden.`,
        );
        return { ok: true, message: 'Betriebssicherung wird erstellt.' };
      }
      if (action === 'buyParts') {
        return context.orderParts(s, {
          quantity: Math.min(
            3,
            context.partsCapacity(s) -
              s.resilience.parts -
              s.operations.orders.reduce((n, o) => n + o.quantity, 0),
          ),
          method: 'standard',
        });
      }
      if (action === 'resolveIncident') {
        const incident = s.resilience.incident;
        if (!incident || incident.id !== payload.id)
          return fail('Diese Krise ist nicht mehr offen.');
        const option = incidentQuotes(s).find((x) => x.key === payload.choice);
        if (!option) return fail('Diese Krisenmaßnahme ist ungültig.');
        if (!option.enabled)
          return fail(option.reason || 'Diese Krisenmaßnahme ist derzeit nicht verfügbar.');
        const totalWork = s.jobs.reduce((sum, j) => sum + j.work, 0),
          fraction = totalWork > 0 ? option.workLoss / totalWork : 0;
        const targetConditions = incident.affected.map((id) => ({
          id,
          condition: option.condition,
        }));
        let effect;
        if (incident.kind === 'corruption' && option.key === 'restore_backup') {
          effect = {
            conditions: targetConditions,
            integrity: 100,
            reputationLoss: option.reputationLoss,
            restoreSnapshot: true,
            clearCorruption: true,
            workLosses: [],
          };
        } else {
          const researchTarget =
            incident.kind === 'corruption' ? Math.max(0, s.research - option.researchLoss) : null;
          effect = {
            conditions: targetConditions,
            integrity: 100,
            reputationLoss: option.reputationLoss,
            clearCorruption: incident.kind === 'corruption',
            workLosses: workLosses(s, fraction),
          };
          if (researchTarget !== null) effect.research = researchTarget;
        }
        s.credits -= option.cost;
        s.resilience.parts -= option.parts;
        incident.resolution = option.key;
        // A local recovery cannot roll back work earned elsewhere while its
        // technician is busy. Apply only the quoted affected share at start.
        if (incident.scope) {
          if (effect.restoreSnapshot) {
            const backup = s.resilience.backup,
              share = context.incidentShare(s),
              saved = new Map(backup.jobs.map((j) => [j.id, j.work]));
            s.research = Math.max(0, s.research + (backup.protectedResearch - s.research) * share);
            for (const job of s.jobs)
              job.work = Math.max(0, job.work + ((saved.get(job.id) || 0) - job.work) * share);
          } else {
            applyWorkLosses(s, effect.workLosses);
            if (effect.research !== undefined) s.research = effect.research;
          }
          effect.restoreSnapshot = false;
          effect.workLosses = [];
          delete effect.research;
        }
        s.resilience.operation = {
          kind: incident.kind,
          label: option.label,
          remaining: option.duration,
          total: option.duration,
          serverId: null,
          cost: option.cost,
          effect,
        };
        addLog(
          s,
          'critical',
          `${incident.title}: ${option.label} gewählt. ${option.cost} Credits, ${option.parts} Ersatzteile und ${option.duration} Sekunden bis zur Wiederherstellung.`,
        );
        return { ok: true, message: `${option.label} gestartet.` };
      }
      return null;
    }
    return { applyRecovery };
  };
});
