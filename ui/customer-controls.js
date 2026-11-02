/** Customer policies and confirmation share the same engine quotes in web and room UI. */
export function createCustomerControls(ctx) {
  function customerAutomationView() {
    const book = ctx.state.customers;
    return `<section class="panel section-spacer customer-policies">${ctx.panelHeader('Kundenautomatik')}<div class="panel-body"><p>Neue Anfragen werden nur bei passender Kapazität, verfügbarer Teamkapazität, Geldreserve und verbleibendem Stundenbudget angenommen. Bezahlte Einrichtungen und Betreuungen warten bei Bedarf auf einen freien Agenten.</p>${['autoAccept', 'autoAssign'].map((key) => `<div class="policy-row"><div class="policy-copy"><strong>${key === 'autoAccept' ? 'Passende Kundenanfragen automatisch annehmen' : 'Agenten automatisch zuweisen'}</strong></div><button class="toggle" role="switch" aria-label="${key === 'autoAccept' ? 'Kundenanfragen automatisch annehmen' : 'Kundenagenten automatisch zuweisen'}" aria-checked="${book[key]}" data-customer="setCustomerPolicy" data-key="${key}" data-value="${!book[key]}"></button></div>`).join('')}<div class="business-controls" data-customer-budget><label class="field-label">Kundenbudget / Stunde<input class="input" data-field="budget" type="number" min="0" max="1000000000" step="100" value="${book.budget}"></label><button class="button" data-customer="setCustomerPolicy" data-key="budget">Budget speichern</button></div><p><span>Im aktuellen Stundenfenster ausgegeben</span>: <strong data-customer-spent>${ctx.fmt(book.spent)} CR</strong></p></div></section>`;
  }
  function customerConfirm(extra) {
    const q = ctx.E.quoteCustomer(ctx.state, extra.action, extra.payload);
    const lead = ctx.state.customers.leads.find((l) => l.id === extra.payload.id);
    const contract = ctx.state.customers.contracts.find((c) => c.id === extra.payload.id);
    return `<p class="modal-intro">${ctx.esc(lead?.client || contract?.client || '')}</p><div class="status-row"><span>Einmalige Kosten</span><strong>${ctx.fmt(q.cost)} CR</strong></div><div class="status-row"><span>Agentenzeit</span><strong>${ctx.duration(q.duration)}</strong></div>${lead ? `<div class="status-row"><span>Vertragslaufzeit ab Einrichtung</span><strong>${ctx.duration(lead.term)}</strong></div><p>Die Einrichtung bindet einen Agenten. Kapazität ist sofort reserviert; Einnahmen beginnen nach der Einrichtung. Spätere Ausfälle können Beschwerden, Zahlungsausgleich und Kündigungen auslösen.</p>` : '<p>Betreuung ersetzt keine Reparatur. Rückgewinnung gelingt nur bei ausreichender Versorgung und kann auch aus geschäftlichen Gründen abgelehnt werden. Bezahlte Einsätze warten ohne weiteren Kostenabzug auf einen verfügbaren Agenten.</p>'}${q.reason ? `<p class="modal-alert">${ctx.esc(ctx.tr(q.reason))}</p>` : ''}<button class="button primary block" data-service-confirm ${q.enabled ? '' : 'disabled'}>Bestätigen</button>`;
  }
  function customerClick(target) {
    const action = target.dataset.customer;
    if (!action) return false;
    const payload = { id: target.dataset.id };
    if (action === 'acceptCustomerLead') payload.roomId = target.dataset.roomId;
    if (action === 'assignCustomerAgent')
      payload.agentId =
        target.closest('[data-customer-id],.attention-item')?.querySelector('[data-customer-agent]')
          ?.value || ctx.$(`[data-customer-agent="${payload.id}"]`)?.value;
    if (action === 'setCustomerRenewal') payload.value = target.dataset.value === 'true';
    if (action === 'setCustomerPolicy') {
      payload.key = target.dataset.key;
      payload.value =
        payload.key === 'budget'
          ? Number(target.closest('[data-customer-budget]').querySelector('input').value)
          : target.dataset.value === 'true';
    }
    if (['acceptCustomerLead', 'supportCustomer', 'retainCustomer'].includes(action))
      ctx.openModal('business-confirm', { action, payload });
    else ctx.execute(action, payload);
    return true;
  }
  return { customerAutomationView, customerConfirm, customerClick };
}
