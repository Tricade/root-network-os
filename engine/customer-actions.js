/** Every commercial promise is quoted against hardware, staffing and existing commitments. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['customer-actions'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    function customerQuote(s, action, p = {}) {
      let reason = '',
        cost = 0,
        duration = 0,
        resources = {};
      const c = s.customers.contracts.find((c) => c.id === p.id);
      if (action === 'acceptCustomerLead') {
        const lead = s.customers.leads.find((l) => l.id === p.id && l.expiresAt > s.time);
        if (!lead) reason = 'Diese Kundenanfrage ist nicht mehr verfügbar.';
        else {
          const q = ctx.serviceQuote(s, 'contractService', {
            roomId: p.roomId,
            kind: lead.kind,
            units: lead.units,
          });
          reason = q.reason;
          cost = q.cost;
          duration = q.duration;
          resources = q.resources;
          if (
            !reason &&
            s.customers.contracts.filter((c) => c.roomId === p.roomId).length >=
              ctx.CUSTOMER_ROOM_LIMIT
          )
            reason = 'Die Vertragsverwaltung dieses Raums ist ausgelastet.';
        }
      } else if (action === 'assignCustomerAgent') {
        const a = s.agents.find((a) => a.id === p.agentId);
        if (!c?.work) reason = 'Dieser Kunde benötigt gerade keinen Agenteneinsatz.';
        else if (!a || !ctx.agentProductive(s, a))
          reason = 'Dieser Agent ist gerade nicht verfügbar.';
      } else if (action === 'supportCustomer' || action === 'retainCustomer') {
        if (!c || c.stage !== 'active') reason = 'Aktiver Kundenvertrag nicht gefunden.';
        else if (c.work) reason = 'Dieser Kunde wird bereits betreut.';
        else if (action === 'supportCustomer' && !c.issue)
          reason = 'Es liegt keine offene Kundenanfrage vor.';
        else if (action === 'retainCustomer' && (!c.notice || c.retentionUsed))
          reason = 'Ein Rückgewinnungsversuch ist gerade nicht möglich.';
        duration = action === 'retainCustomer' ? 1200 : 600;
        cost = c
          ? Math.ceil(
              Math.max(
                60,
                ctx.SERVICES[c.kind].fee * c.units * (action === 'retainCustomer' ? 900 : 120),
              ),
            )
          : 0;
      } else if (action === 'setCustomerRenewal') {
        if (!c || typeof p.value !== 'boolean') reason = 'Ungültiger Vertragsplan.';
      } else if (action === 'declineCustomerLead') {
        if (!s.customers.leads.some((l) => l.id === p.id))
          reason = 'Diese Kundenanfrage ist nicht mehr verfügbar.';
      } else if (action === 'setCustomerPolicy') {
        if (
          !['autoAccept', 'autoAssign', 'budget'].includes(p.key) ||
          (p.key === 'budget'
            ? !Number.isSafeInteger(p.value) || p.value < 0 || p.value > 1e9
            : typeof p.value !== 'boolean')
        )
          reason = 'Ungültige Kundenautomatik.';
      } else return { enabled: false, reason: 'Unbekannter Kundenauftrag.', cost: 0, duration: 0 };
      if (!reason && s.credits < cost) reason = 'Das verfügbare Budget reicht nicht aus.';
      return { enabled: !reason, reason, cost, duration, resources };
    }
    function applyCustomers(s, action, p) {
      if (action === 'contractService')
        return { ok: false, message: 'Neue Verträge entstehen aus eingehenden Kundenanfragen.' };
      if (
        ![
          'acceptCustomerLead',
          'assignCustomerAgent',
          'supportCustomer',
          'retainCustomer',
          'setCustomerRenewal',
          'declineCustomerLead',
          'setCustomerPolicy',
        ].includes(action)
      )
        return null;
      const q = customerQuote(s, action, p);
      if (!q.enabled) return { ok: false, message: q.reason };
      const c = s.customers.contracts.find((c) => c.id === p.id);
      s.credits -= q.cost;
      if (action === 'acceptCustomerLead') {
        const lead = s.customers.leads.find((l) => l.id === p.id);
        const contract = ctx.makeCustomer(s, p.roomId, lead.kind, lead.units, true);
        const group = s.business.rooms
          .find((r) => r.roomId === p.roomId)
          .groups.find((g) => g.kind === lead.kind);
        Object.assign(contract, {
          client: lead.client,
          term: lead.term,
          remaining: lead.term,
          premium: group.nextPremium,
          renew: group.renew,
        });
        s.customers.contracts.push(contract);
        s.customers.leads = s.customers.leads.filter((l) => l.id !== lead.id);
        s.customers.won = Math.min(1e9, s.customers.won + 1);
        ctx.syncCustomerGroups(s);
        ctx.assignCustomerWork(s);
        ctx.addLog(
          s,
          'system',
          `${contract.client}: Vertrag angenommen. Ein Agent muss den Dienst einrichten.`,
        );
        return {
          ok: true,
          message: contract.agentId
            ? 'Kundenvertrag angenommen. Einrichtung gestartet.'
            : 'Kundenvertrag angenommen. Einrichtung wartet auf einen verfügbaren Agenten.',
        };
      }
      if (action === 'assignCustomerAgent') c.agentId = p.agentId;
      if (action === 'supportCustomer' || action === 'retainCustomer') {
        c.work = action === 'retainCustomer' ? 'retention' : 'support';
        c.workRemaining = c.workTotal = q.duration;
        if (action === 'retainCustomer') c.retentionUsed = true;
      }
      if (action === 'setCustomerRenewal') c.renew = p.value;
      if (action === 'declineCustomerLead')
        s.customers.leads = s.customers.leads.filter((l) => l.id !== p.id);
      if (action === 'setCustomerPolicy') s.customers[p.key] = p.value;
      return {
        ok: true,
        message:
          action === 'acceptCustomerLead'
            ? 'Kundenvertrag angenommen. Einrichtung wartet auf einen verfügbaren Agenten.'
            : 'Kundenauftrag gespeichert.',
      };
    }
    return { customerQuote, applyCustomers };
  };
});
