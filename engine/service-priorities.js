/** A declared service policy redistributes shortages; it never creates resources. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['service-priorities'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    const PRIORITIES = ['balanced', 'hosting', 'archive', 'database', 'inference'];
    function servicePriority(s, roomId) {
      return s.servicePriorities?.[roomId] || { kind: 'balanced', until: 0 };
    }
    function quoteServicePriority(s, p = {}) {
      const current = servicePriority(s, p.roomId),
        room = s.business.rooms.find((r) => r.roomId === p.roomId);
      let reason = '';
      if (!room || !PRIORITIES.includes(p.kind)) reason = 'Ungültige Dienstpriorität.';
      else if (current.kind === p.kind) reason = 'Diese Priorität ist bereits aktiv.';
      else if (current.until > s.time)
        reason = 'Die Dienstpriorität bleibt für eine Stunde verbindlich.';
      else if (
        s.resilience.incident ||
        s.facility.operation ||
        s.facility.centralOperation ||
        room.conversion ||
        s.preventiveMaintenance?.operation
      )
        reason = 'Dienstprioritäten müssen vor einer Störung oder Wartung festgelegt werden.';
      else if (
        ctx
          .serviceSnapshot(s)
          .rooms.find((r) => r.roomId === p.roomId)
          .groups.some((g) => g.units > 0 && g.supplied < 0.999999)
      )
        reason = 'Stelle zuerst die vollständige Versorgung dieses Raums wieder her.';
      return {
        enabled: !reason,
        reason,
        cost: 0,
        duration: 3600,
        label: 'Dienstpriorität festlegen',
        kind: p.kind,
        roomId: p.roomId,
      };
    }
    function applyServicePriority(s, action, p) {
      if (action !== 'setServicePriority') return null;
      const q = quoteServicePriority(s, p);
      if (!q.enabled) return { ok: false, message: q.reason };
      s.servicePriorities ||= {};
      s.servicePriorities[p.roomId] = { kind: p.kind, until: s.time + 3600 };
      ctx.addLog(s, 'system', 'Dienstpriorität für eine Stunde verbindlich festgelegt.');
      return {
        ok: true,
        message: 'Dienstpriorität gespeichert. Andere Dienste teilen die verbleibende Kapazität.',
      };
    }
    function normalizeServicePriorities(input, s) {
      ctx.checkedRecord(input);
      const rooms = new Set(s.business.rooms.map((r) => r.roomId)),
        result = {};
      if (Object.keys(input).length > rooms.size) throw new Error('Ungültige Dienstprioritäten.');
      for (const [id, value] of Object.entries(input)) {
        if (!rooms.has(id) || !PRIORITIES.includes(value?.kind))
          throw new Error('Ungültige Dienstprioritäten.');
        result[id] = { kind: value.kind, until: ctx.checkedNumber(value.until, 0, s.time + 3600) };
      }
      return result;
    }
    return {
      PRIORITIES,
      servicePriority,
      quoteServicePriority,
      applyServicePriority,
      normalizeServicePriorities,
    };
  };
});
