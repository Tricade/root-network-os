/** Customer expansion promises: offers and staffed capacity commitments. */
export function createCustomerGrowthUI(ctx) {
  const formValues = new Map();
  const windows = [
    [3600, '1 Stunde'],
    [14400, '4 Stunden'],
    [43200, '12 Stunden'],
  ];
  const resources = (values = {}) =>
    Object.entries({
      cpu: 'CPU',
      ram: 'GB RAM',
      storage: 'TB',
      network: 'Mbit/s',
      gpu: 'GPU',
      vram: 'GB VRAM',
    })
      .filter(([key]) => Number(values[key]) > 0)
      .map(([key, label]) => `${ctx.dec(values[key])} ${label}`)
      .join(' · ') || ctx.tr('Keine zusätzlichen Ressourcen');
  const growth = () => ctx.E.getGrowth(ctx.state);
  const requestQuote = (request, values = formValues.get(request.id)) => {
    const value = values || { windowSeconds: 3600, budgetCeiling: request.quote?.setupCost || 0 };
    return ctx.E.quoteGrowth(ctx.state, 'promiseCustomerGrowth', {
      id: request.id,
      windowSeconds: Number(value.windowSeconds),
      budgetCeiling: Number(value.budgetCeiling),
    });
  };
  function growthMarkup() {
    const g = growth();
    for (const id of formValues.keys())
      if (!g.requests.some((r) => r.id === id)) formValues.delete(id);
    const requests = g.requests.slice(0, 12);
    const offers = requests.filter((r) => r.status === 'offered');
    const accepted = requests.filter((r) => r.status !== 'offered');
    if (!requests.length)
      return `<div class="helper-card growth-empty"><strong>${ctx.tr('Kundenwachstum')}</strong><p>${ctx.tr('Zufriedene Bestandskunden können später Erweiterungen anfragen. Zusagen brauchen Kapazität und Einrichtung.')}</p></div>`;
    return `<section class="panel section-spacer customer-growth"><div class="panel-header"><div><h2>${ctx.tr('Kundenwachstum')}</h2><p>${ctx.tr('Bestehende Kunden fragen gelegentlich nach einer Erweiterung. Liefertermine sind Zusagen; Kapazität, Einrichtung und Erlös bleiben an den normalen Kundenprozess gebunden.')}</p></div><span class="tag">${ctx.fmt(offers.length)} ${ctx.tr('offen')}</span></div><div class="panel-body">
      <p class="policy-explainer">${ctx.tr('Reservierte Budgets')} <strong data-growth-reserved>${ctx.fmt(g.reservedBudget)} CR</strong>. ${ctx.tr('Neue Zusagen reservieren die Kapazität sofort. Nach der Einrichtung wachsen die Einheiten des bestehenden Vertrags.')}</p>
      ${
        offers.length
          ? `<div class="business-grid">${offers
              .map((r) => {
                const values = formValues.get(r.id) || {
                  windowSeconds: 3600,
                  budgetCeiling: r.quote?.setupCost || 0,
                };
                const q = requestQuote(r, values);
                return `<article class="panel customer-growth-card" data-growth-card="${ctx.esc(r.id)}"><span class="tag blue">${ctx.tr('ERWEITERUNGSANFRAGE')}</span><h3>${ctx.esc(r.client)}</h3><p>${ctx.esc(ctx.tr(ctx.E.catalog.services?.[r.kind]?.name || { hosting: 'Hosting', archive: 'Archiv', database: 'Datenbank', inference: 'KI-Inferenz' }[r.kind] || r.kind))} · ${ctx.fmt(r.units)} ${ctx.tr('Einheiten')} · ${ctx.tr(`Raum ${Number(String(r.roomId).replace('room-', ''))}`)}</p><p>${ctx.tr('Zusätzlicher Bedarf')}: ${ctx.esc(resources(r.quote?.resources))}</p><p>${ctx.tr('Einrichtung')}: ${ctx.fmt(r.quote?.setupCost || 0)} CR · ${ctx.duration(600)} ${ctx.tr('Agentenzeit')}</p><p>${ctx.tr('Angebot verfällt in')} <strong data-growth-expiry="${ctx.esc(r.id)}"></strong></p><div class="business-controls"><label class="field-label">${ctx.tr('Lieferfenster')}<select class="select" data-growth-field="windowSeconds" data-growth-id="${ctx.esc(r.id)}">${windows.map(([n, label]) => `<option value="${n}" ${Number(values.windowSeconds) === n ? 'selected' : ''}>${ctx.tr(label)}</option>`).join('')}</select></label><label class="field-label">${ctx.tr('Budgetobergrenze (CR)')}<input class="input" type="number" min="${r.quote?.setupCost || 1}" max="1000000000000" step="1" value="${ctx.esc(values.budgetCeiling)}" data-growth-field="budgetCeiling" data-growth-id="${ctx.esc(r.id)}"></label></div><p class="protection-reason" data-growth-reason="${ctx.esc(r.id)}">${ctx.esc(ctx.tr(q.reason || 'Kapazität und Einrichtung werden bei der Zusage gebucht.'))}</p><div class="card-actions"><button class="button primary" data-growth="promise" data-id="${ctx.esc(r.id)}" ${q.enabled ? '' : 'disabled'}>${ctx.tr('Liefertermin prüfen')}</button><button class="button" data-growth="decline" data-id="${ctx.esc(r.id)}">${ctx.tr('Ablehnen')}</button></div></article>`;
              })
              .join('')}</div>`
          : `<p class="policy-explainer">${ctx.tr('Zurzeit liegen keine Erweiterungsanfragen vor.')}</p>`
      }
      ${
        accepted.length
          ? `<h3>${ctx.tr('Zugesagte Erweiterungen')}</h3><div class="business-grid">${accepted
              .map((r) => {
                const contract =
                  r.contractId && ctx.state.customers.contracts.find((c) => c.id === r.contractId);
                const remaining = Math.max(0, r.deadlineAt - ctx.state.time);
                const work = contract?.work
                  ? { remaining: contract.workRemaining, total: contract.workTotal }
                  : null;
                const progress = work
                  ? Math.max(0, Math.min(1, 1 - work.remaining / Math.max(1, work.total)))
                  : 0;
                const label =
                  r.status === 'provisioning'
                    ? contract?.agentId
                      ? 'Einrichtung läuft'
                      : 'Wartet auf einen Agenten'
                    : 'Wartet auf freie Kapazität';
                return `<article class="panel customer-growth-card" data-growth-live="${ctx.esc(r.id)}"><span class="tag ${r.status === 'provisioning' ? 'blue' : 'amber'}">${ctx.tr(label)}</span><h3>${ctx.esc(r.client)}</h3><p>${ctx.tr('Liefertermin')}: <strong data-growth-deadline="${ctx.esc(r.id)}">${ctx.duration(remaining)}</strong> · ${ctx.fmt(r.units)} ${ctx.tr('Einheiten')}</p>${r.escrow ? `<p>${ctx.tr('Zurückgehaltene Kaution')}: <strong data-growth-escrow="${ctx.esc(r.id)}">${ctx.fmt(r.escrow)} CR</strong></p>` : ''}${work ? `<p data-growth-work="${ctx.esc(r.id)}">${ctx.tr('Einrichtung')}: ${ctx.duration(work.remaining)}</p><div class="progress-track"><div class="progress-fill blue" data-growth-progress="${ctx.esc(r.id)}" style="width:${progress * 100}%"></div></div>` : `<p>${ctx.tr('Einrichtung startet, sobald die normale Kundenkapazität und ein Agent verfügbar sind.')}</p>`}<small>${ctx.tr('Zusätzlicher Erlös entsteht nach der Einrichtung aus gelieferter Leistung.')}</small></article>`;
              })
              .join('')}</div>`
          : ''
      }
    </div></section>`;
  }
  function growthClick(target) {
    if (target.hasAttribute('data-growth-confirm')) {
      const extra = ctx.modal?.extra;
      if (ctx.modal?.type !== 'growth-confirm' || !extra) return true;
      const q = ctx.E.quoteGrowth(ctx.state, extra.action, extra.payload);
      if (!q.enabled) return true;
      ctx.closeModal();
      ctx.execute(extra.action, extra.payload);
      return true;
    }
    const command = target.dataset.growth;
    if (!command) return false;
    const id = target.dataset.id;
    if (command === 'decline') ctx.execute('declineCustomerGrowth', { id });
    if (command === 'promise') {
      const card = target.closest('[data-growth-card]');
      const payload = {
        id,
        windowSeconds: Number(card.querySelector('[data-growth-field="windowSeconds"]').value),
        budgetCeiling: Number(card.querySelector('[data-growth-field="budgetCeiling"]').value),
      };
      ctx.openModal('growth-confirm', { action: 'promiseCustomerGrowth', payload });
    }
    return true;
  }
  function growthChange(el) {
    if (!el.matches('[data-growth-field]')) return false;
    const id = el.dataset.growthId;
    const row = growth().requests.find((r) => r.id === id);
    const values = formValues.get(id) || {
      windowSeconds: 3600,
      budgetCeiling: row?.quote?.setupCost || 0,
    };
    values[el.dataset.growthField] = el.value;
    formValues.set(id, values);
    const card = el.closest('[data-growth-card]');
    if (card) {
      const request = growth().requests.find((r) => r.id === id);
      if (request) {
        const q = requestQuote(request, values);
        const reason = card.querySelector(`[data-growth-reason="${CSS.escape(id)}"]`);
        if (reason)
          reason.textContent = ctx.tr(
            q.reason || 'Kapazität und Einrichtung werden bei der Zusage gebucht.',
          );
        const button = card.querySelector('[data-growth="promise"]');
        if (button) button.disabled = !q.enabled;
      }
    }
    return true;
  }
  function growthConfirm(extra) {
    const q = ctx.E.quoteGrowth(ctx.state, extra.action, extra.payload);
    const r = growth().requests.find((item) => item.id === extra.payload.id);
    return `<p class="modal-intro">${ctx.esc(r?.client || '')}</p><div class="status-row"><span>${ctx.tr('Bereitstellung')}</span><strong>${ctx.duration(q.duration || 0)}</strong></div><div class="status-row"><span>${ctx.tr('Einrichtungskosten')}</span><strong>${ctx.fmt(q.setupCost || 0)} CR</strong></div><div class="status-row"><span>${ctx.tr('Budgetobergrenze')}</span><strong>${ctx.fmt(extra.payload.budgetCeiling)} CR</strong></div><p>${ctx.tr('Ressourcenbedarf')}: ${ctx.esc(resources(q.resources))}</p><p>${ctx.tr('Bei der Zusage werden Einrichtungskosten fällig und die zusätzlichen Ressourcen reserviert. Ein Agent richtet die Erweiterung ein. Ein verpasster Liefertermin kostet Ansehen und Zufriedenheit.')}</p>${q.reason ? `<p class="modal-alert">${ctx.esc(ctx.tr(q.reason))}</p>` : ''}<button class="button primary block" data-growth-confirm ${q.enabled ? '' : 'disabled'}>${ctx.tr('Liefertermin verbindlich zusagen')}</button>`;
  }
  function growthSignature() {
    const g = ctx.state.customerGrowth;
    return JSON.stringify(
      g.requests.map((r) => {
        const c = r.contractId && ctx.state.customers.contracts.find((x) => x.id === r.contractId);
        return [r.id, r.status, r.contractId, r.escrow, c?.stage, c?.agentId, c?.workTotal];
      }),
    );
  }
  function updateGrowth() {
    if (ctx.view !== 'business') return;
    const g = growth();
    ctx
      .$$('.view-content [data-growth-reserved]')
      .forEach((el) => (el.textContent = `${ctx.fmt(g.reservedBudget)} CR`));
    g.requests.forEach((r) => {
      if (r.status === 'offered') {
        const q = formValues.has(r.id) ? requestQuote(r) : r.quote;
        const reason = ctx.$(`[data-growth-reason="${CSS.escape(r.id)}"]`);
        const button = ctx.$(`[data-growth="promise"][data-id="${CSS.escape(r.id)}"]`);
        if (reason)
          reason.textContent = ctx.tr(
            q.reason || 'Kapazität und Einrichtung werden bei der Zusage gebucht.',
          );
        if (button) button.disabled = !q.enabled;
      }
      const expiry = ctx.$(`[data-growth-expiry="${CSS.escape(r.id)}"]`);
      if (expiry) expiry.textContent = ctx.duration(Math.max(0, r.expiresAt - ctx.state.time));
      const deadline = ctx.$(`[data-growth-deadline="${CSS.escape(r.id)}"]`);
      if (deadline) deadline.textContent = ctx.duration(Math.max(0, r.deadlineAt - ctx.state.time));
      const escrow = ctx.$(`[data-growth-escrow="${CSS.escape(r.id)}"]`);
      if (escrow) escrow.textContent = `${ctx.fmt(r.escrow)} CR`;
      const c = r.contractId && ctx.state.customers.contracts.find((x) => x.id === r.contractId);
      if (c?.work) {
        const progress = Math.max(0, Math.min(1, 1 - c.workRemaining / Math.max(1, c.workTotal)));
        const bar = ctx.$(`[data-growth-progress="${CSS.escape(r.id)}"]`);
        if (bar) bar.style.width = `${progress * 100}%`;
        const work = ctx.$(`[data-growth-work="${CSS.escape(r.id)}"]`);
        if (work) work.textContent = `${ctx.tr('Einrichtung')}: ${ctx.duration(c.workRemaining)}`;
      }
    });
  }
  return { growthMarkup, growthClick, growthChange, growthConfirm, growthSignature, updateGrowth };
}
