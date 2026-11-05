/** Maintenance: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['maintenance'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    const { finite } = context;
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const addLog = (s, severity, message) => context.addLog(s, severity, message, 'maintenance');
    const repairQuotes = (...args) => context.repairQuotes(...args);
    const workSnapshot = (...args) => context.workSnapshot(...args);

    function startOperation(s, operation, automated = false) {
      s.resilience.operation = operation;
      if (automated) {
        if (operation.kind === 'backup') s.operations.backupSpent += operation.cost || 0;
        else s.resilience.budgetSpent += operation.cost || 0;
      }
    }

    function finishOperation(s) {
      const r = s.resilience,
        op = r.operation;
      if (!op) return;
      if (op.kind === 'backup') {
        r.backup = {
          createdAt: s.time,
          research: s.research,
          protectedResearch: s.research,
          jobs: workSnapshot(s),
        };
        r.autoBackupNextAt = s.time + 900;
        addLog(
          s,
          'success',
          `Betriebssicherung abgeschlossen: ${s.research.toFixed(1)} Forschung und ${s.jobs.length} Auftragsstände geschützt.`,
        );
      } else if (op.kind === 'repair') {
        const server = s.servers.find((x) => x.id === op.serverId);
        if (server) {
          server.condition = op.effect.condition;
          server.status = 'online';
          server.fault = null;
        }
        applyWorkLosses(s, op.effect.workLosses || []);
        if (op.effect.reputationLoss)
          s.reputation = Math.max(0, s.reputation - op.effect.reputationLoss);
        addLog(
          s,
          'success',
          `Wartung abgeschlossen${server ? `: ${server.name} bei ${Math.round(server.condition)}% Zustand` : ''}.`,
        );
      } else {
        const effect = op.effect;
        for (const item of effect.conditions || []) {
          const server = s.servers.find((x) => x.id === item.id);
          if (server) {
            server.condition = item.condition;
            server.status = 'online';
            server.fault = null;
          }
        }
        if (effect.restoreSnapshot && r.backup) {
          s.research = r.backup.protectedResearch;
          const snapshot = new Map(r.backup.jobs.map((j) => [j.id, j.work]));
          for (const job of s.jobs) job.work = snapshot.has(job.id) ? snapshot.get(job.id) : 0;
          r.backup.protectedResearch = s.research;
        } else {
          applyWorkLosses(s, effect.workLosses || []);
          if (finite(effect.research)) s.research = Math.max(0, effect.research);
        }
        if (finite(effect.integrity)) r.integrity = effect.integrity;
        if (effect.clearCorruption) r.corrupted = false;
        if (effect.reputationLoss) s.reputation = Math.max(0, s.reputation - effect.reputationLoss);
        r.incident = null;
        addLog(
          s,
          'success',
          `Krisenmaßnahme abgeschlossen: ${op.label}. Der geschützte Betrieb ist wieder freigegeben.`,
        );
      }
      r.operation = null;
    }

    function applyWorkLosses(s, rows) {
      for (const row of rows) {
        const job = s.jobs.find((x) => x.id === row.id);
        if (job) job.work = Math.max(0, job.work - row.amount);
      }
    }

    function autoBudgetReason(s, option, kind) {
      const policy = context.maintenancePolicy(s);
      const spent = kind === 'backup' ? s.operations.backupSpent : s.resilience.budgetSpent;
      if (option.cost > policy[kind]) return 'Das Stundenbudget deckt die nächste Maßnahme nicht.';
      if (spent + option.cost > policy[kind])
        return 'Das Stundenbudget ist für diese Maßnahme ausgeschöpft.';
      if (s.credits - option.cost < policy.reserve)
        return 'Die geschützte Geldreserve blockiert die Automatik.';
      return '';
    }

    function quoteWithinAutoPolicy(s, option) {
      return option.enabled && !autoBudgetReason(s, option, 'repair');
    }

    function automaticRepairTarget(s) {
      let target = null;
      for (const server of s.servers)
        if (
          server.status === 'failed' &&
          server.fault === 'Hardwarefehler' &&
          (!target || server.condition < target.condition)
        )
          target = server;
      return target;
    }

    function startAutomaticReroute(s) {
      const r = s.resilience,
        incident = r.incident;
      if (
        !s.policies.autoReroute ||
        incident?.kind !== 'power' ||
        incident.resolution ||
        r.operation ||
        s.facility.operation ||
        s.facility.centralOperation
      )
        return false;
      const option = context.incidentQuotes(s).find((o) => o.key === 'reroute');
      if (!option || !quoteWithinAutoPolicy(s, option)) return false;
      const result = context.applyRecovery(s, 'resolveIncident', {
        id: incident.id,
        choice: option.key,
      });
      if (!result?.ok) return false;
      r.budgetSpent += option.cost;
      addLog(s, 'system', 'Notfallplan hat die sichere Stromumschaltung gestartet.');
      return true;
    }

    function startAutomaticRepair(s) {
      if (
        !s.policies.autorepair ||
        s.resilience.operation ||
        s.resilience.incident ||
        s.facility.operation ||
        s.facility.centralOperation
      )
        return false;
      const server = automaticRepairTarget(s);
      if (!server) return false;
      const option = repairQuotes(s, server).find((x) => x.key === 'patch');
      if (!option || !quoteWithinAutoPolicy(s, option)) return false;
      s.credits -= option.cost;
      s.resilience.parts -= option.parts;
      server.status = 'repairing';
      startOperation(
        s,
        {
          kind: 'repair',
          label: 'Automatische Schnellreparatur',
          remaining: option.duration,
          total: option.duration,
          serverId: server.id,
          cost: option.cost,
          effect: { condition: option.condition, workLosses: [], reputationLoss: 0 },
        },
        true,
      );
      addLog(
        s,
        'system',
        `Automatische Wartung gestartet: ${server.name}, ${option.cost} Credits und ${option.parts} Ersatzteil.`,
      );
      return true;
    }

    function startAutomaticBackup(s) {
      if (
        !s.policies.autobackup ||
        s.time < s.resilience.autoBackupNextAt ||
        s.resilience.operation ||
        s.resilience.incident ||
        s.resilience.corrupted ||
        s.facility.operation ||
        s.facility.centralOperation
      )
        return false;
      const option = context.backupQuote(s);
      if (!option.enabled || autoBudgetReason(s, option, 'backup')) {
        s.resilience.autoBackupNextAt = s.time + 300;
        return false;
      }
      s.credits -= option.cost;
      s.resilience.backupCooldownUntil = s.time + 300;
      startOperation(
        s,
        {
          kind: 'backup',
          label: 'Automatische Betriebssicherung',
          remaining: option.duration,
          total: option.duration,
          serverId: null,
          cost: option.cost,
          effect: { snapshot: true },
        },
        true,
      );
      addLog(s, 'system', `Automatische Betriebssicherung gestartet: ${option.cost} Credits.`);
      return true;
    }
    return {
      startOperation,
      finishOperation,
      applyWorkLosses,
      autoBudgetReason,
      automaticRepairTarget,
      quoteWithinAutoPolicy,
      startAutomaticReroute,
      startAutomaticRepair,
      startAutomaticBackup,
    };
  };
});
