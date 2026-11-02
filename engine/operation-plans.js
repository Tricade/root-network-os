/** Explicit one-shot plans. No executable text, recursive actions or unbounded queues. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['operation-plans'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    function planPayload(action, p) {
      if (
        action === 'upgradeRackBatch' &&
        typeof p.rackId === 'string' &&
        ctx.maintenanceComponents(p.components) &&
        typeof p.announce === 'boolean'
      )
        return {
          rackId: p.rackId,
          components: ctx.maintenanceComponents(p.components),
          announce: p.announce,
        };
      if (action === 'createBackup') return {};
      if (action === 'buildFloor') return {};
      if (
        action === 'buildRoom' &&
        Number.isSafeInteger(p.floor) &&
        p.floor >= 1 &&
        p.floor <= 1000
      )
        return { floor: p.floor };
      if (
        action === 'buildServiceRoom' &&
        ['control', 'cooling', 'ups', 'distribution'].includes(p.roomType)
      )
        return { roomType: p.roomType };
      if (
        action === 'upgradeRack' &&
        typeof p.rackId === 'string' &&
        ['power', 'cooling', 'switch'].includes(p.component)
      )
        return { rackId: p.rackId, component: p.component };
      if (action === 'upgradeCentral' && ['cooling', 'ups', 'distribution'].includes(p.system))
        return { system: p.system };
      if (
        action === 'convertRoomSupply' &&
        typeof p.roomId === 'string' &&
        ['cooling', 'power'].includes(p.system) &&
        Object.hasOwn(ctx.SUPPLY_MODES, p.mode) &&
        !(p.system === 'cooling' && p.mode === 'ups')
      )
        return { roomId: p.roomId, system: p.system, mode: p.mode };
      return null;
    }
    function planQuote(s, item) {
      if (item.action === 'createBackup') return ctx.getResilience(s).backup;
      if (item.action === 'convertRoomSupply') return ctx.supplyQuote(s, item.payload);
      return ctx.quoteHardware(s, item.action, item.payload);
    }
    function applyPlan(s, action, p) {
      const o = s.operations;
      if (action === 'queueOperation') {
        const payload = planPayload(p.action, p.payload || {});
        if (
          !payload ||
          (payload.rackId && !s.facility.racks.some((r) => r.id === payload.rackId)) ||
          o.queue.length >= 12 ||
          !Number.isSafeInteger(p.ceiling) ||
          p.ceiling < 0 ||
          p.ceiling > ctx.PLAN_MAX_COST ||
          !Number.isFinite(p.notBefore ?? s.time) ||
          (p.notBefore ?? s.time) < 0 ||
          (p.notBefore ?? s.time) > s.time + 30 * 86400
        )
          return { ok: false, message: 'Ungültiger oder voller Ablaufplan.' };
        const item = {
          id: '',
          action: p.action,
          payload,
          ceiling: p.ceiling,
          // The confirmation dialog can stay open while simulation time advances.
          notBefore: Math.max(s.time, p.notBefore ?? s.time),
          reason: '',
        };
        if (!ctx.planTargetsValid(s, [...o.queue, item]))
          return {
            ok: false,
            message: 'Die Reihenfolge enthält ein noch nicht geplantes Bauziel.',
          };
        if (!ctx.planStepPossible(s, item, o.queue))
          return {
            ok: false,
            message: 'Ausbauziel ist nicht verfügbar oder bereits vollständig ausgebaut.',
          };
        item.id = ctx.uid(s, 'plan');
        o.queue.push(item);
        o.nextCheck = s.time;
        return {
          ok: true,
          message: 'Maßnahme eingeplant. Ausführung innerhalb deiner Budgetgrenzen.',
        };
      }
      if (action === 'cancelPlannedOperation') {
        const index = o.queue.findIndex((x) => x.id === p.id);
        if (index < 0) return { ok: false, message: 'Geplante Maßnahme nicht gefunden.' };
        const next = o.queue.filter((_, i) => i !== index);
        if (!ctx.planTargetsValid(s, next))
          return { ok: false, message: 'Entferne zuerst die davon abhängigen Bauaufträge.' };
        o.queue = next;
        return { ok: true, message: 'Geplante Maßnahme entfernt.' };
      }
      if (action === 'movePlannedOperation') {
        const index = o.queue.findIndex((x) => x.id === p.id),
          target = index + p.direction;
        if (index < 0 || ![-1, 1].includes(p.direction) || target < 0 || target >= o.queue.length)
          return { ok: false, message: 'Diese Maßnahme kann nicht weiter verschoben werden.' };
        const next = [...o.queue];
        [next[index], next[target]] = [next[target], next[index]];
        if (!ctx.planTargetsValid(s, next))
          return {
            ok: false,
            message: 'Die Reihenfolge enthält ein noch nicht geplantes Bauziel.',
          };
        o.queue = next;
        o.nextCheck = s.time;
        return { ok: true, message: 'Reihenfolge gespeichert.' };
      }
      if (action === 'pauseOperations') {
        if (typeof p.value !== 'boolean') return { ok: false, message: 'Ungültiger Ablaufplan.' };
        o.paused = p.value;
        o.nextCheck = s.time;
        return { ok: true, message: 'Ablaufplan gespeichert.' };
      }
      return null;
    }
    function advancePlan(s) {
      const o = s.operations,
        item = o.queue[0];
      if (o.paused || !item) return;
      if (s.time < (item.notBefore || 0)) {
        item.reason = 'Wartet auf den frühesten Starttermin.';
        return;
      }
      if (
        s.facility.building.project ||
        s.preventiveMaintenance?.operation ||
        s.resilience.operation ||
        s.facility.operation ||
        s.facility.centralOperation ||
        s.business.rooms.some((r) => r.conversion)
      ) {
        item.reason = 'Wartet auf den Abschluss der laufenden Maßnahme.';
        return;
      }
      const q = planQuote(s, item),
        policy = ctx.maintenancePolicy(s);
      if (!q.enabled) {
        item.reason = q.reason;
        return;
      }
      if (q.cost > item.ceiling) {
        item.reason = 'Der aktuelle Preis überschreitet deine Freigabe.';
        return;
      }
      if (o.planSpent + q.cost > policy.plan) {
        item.reason = 'Das Stundenbudget für geplante Maßnahmen reicht nicht aus.';
        return;
      }
      if (s.credits - q.cost < Math.max(policy.reserve, policy.savings)) {
        item.reason = 'Geschützte Reserve oder Sparziel würden unterschritten.';
        return;
      }
      const result = ctx.act(s, item.action, item.payload);
      if (result.ok) {
        o.planSpent += q.cost;
        o.queue.shift();
        ctx.addLog(s, 'system', 'Geplante Maßnahme gestartet.');
      } else item.reason = result.message;
    }
    return { planPayload, planQuote, applyPlan, advancePlan };
  };
});
