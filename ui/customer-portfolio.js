/** Bounded global portfolio: filters are UI state, never simulation commitments. */
export function filterContracts(contracts, { filter = 'all', room = 'all', query = '' } = {}) {
  const search = query.trim().toLocaleLowerCase();
  return contracts.filter(
    (c) =>
      (room === 'all' || c.roomId === room) &&
      (!search || `${c.client} ${c.id}`.toLocaleLowerCase().includes(search)) &&
      (filter === 'all' ||
        (filter === 'active' && c.stage === 'active') ||
        (filter === 'setup' && c.stage === 'setup') ||
        (filter === 'notice' && c.notice > 0) ||
        (filter === 'attention' && (c.issue || c.notice > 0 || (c.work && !c.agentId)))),
  );
}
export function createCustomerPortfolio(ctx, cards, selection) {
  let filter = 'all',
    scope = 'all',
    query = '',
    page = 0;
  const pageSize = 12;
  const filters = {
    all: 'Alle Verträge',
    leads: 'Anfragen',
    active: 'Aktiv',
    setup: 'Einrichtung',
    attention: 'Handlungsbedarf',
    notice: 'Kündigungen',
  };
  function selectFilter(value) {
    if (Object.hasOwn(filters, value)) {
      filter = value;
      scope = 'all';
      page = 0;
    }
  }
  function selectRoom(value) {
    scope = value;
    filter = 'all';
    page = 0;
  }
  function portfolioRows(model, book) {
    const rows = filterContracts(book.contracts, { filter, room: scope, query });
    page = Math.max(0, Math.min(page, Math.ceil(rows.length / pageSize) - 1));
    return `<div class="section-heading"><h2>${ctx.tr('Kundenbestand')}</h2><span>${ctx.fmt(rows.length)} ${ctx.tr('Verträge')}</span></div><div class="customer-contracts">${
      rows
        .slice(page * pageSize, (page + 1) * pageSize)
        .map((c) => cards.contractCard(c, model))
        .join('') ||
      ctx.empty(
        'Keine passenden Verträge',
        'Ändere den Filter oder prüfe neue Kundenanfragen.',
        '',
        '',
        'jobs',
      )
    }</div>${rows.length > pageSize ? `<div class="portfolio-pages"><button class="button small" data-customer-page="-1" ${page === 0 ? 'disabled' : ''}>${ctx.tr('Zurück')}</button><span>${page + 1} / ${Math.ceil(rows.length / pageSize)}</span><button class="button small" data-customer-page="1" ${(page + 1) * pageSize >= rows.length ? 'disabled' : ''}>${ctx.tr('Weiter')}</button></div>` : ''}`;
  }
  function view() {
    const model = ctx.E.getBusinessModel(ctx.state),
      book = ctx.E.getCustomers(ctx.state),
      layout = ctx.E.getFacilityLayout(ctx.state);
    let roomId = selection.getRoom();
    if (!model.rooms.some((r) => r.roomId === roomId)) {
      roomId = model.rooms[0].roomId;
      selection.setRoom(roomId);
    }
    if (scope !== 'all' && !model.rooms.some((r) => r.roomId === scope)) scope = 'all';
    const room = model.rooms.find((r) => r.roomId === roomId);
    return (
      ctx.head(
        'Kunden & Verträge',
        'Anfragen, Einrichtung und laufende Verträge über alle Räume hinweg.',
      ) +
      `<div class="business-layout"><section class="panel business-summary">${ctx.panelHeader('Geschäftsbilanz', ctx.navLink('automation', 'Kundenautomatik'))}<div class="stats-strip"><div><span>Aktive Verträge</span><strong data-customer-stat="active">${book.active}</strong></div><div><span>Kundenumsatz / min</span><strong data-business-stat="gross"></strong></div><div><span>Alle Kosten / min</span><strong data-business-stat="cost"></strong></div><div><span>Netto / min</span><strong data-business-stat="net"></strong></div></div></section>
      ${ctx.growthMarkup()}<nav class="portfolio-tabs" aria-label="${ctx.tr('Vertragsfilter')}">${Object.entries(
        filters,
      )
        .map(
          ([key, label]) =>
            `<button class="button small ${key === filter ? 'selected' : ''}" data-customer-filter="${key}" aria-pressed="${key === filter}">${ctx.tr(label)}${key === 'leads' ? ` · ${book.leads.length}` : ''}</button>`,
        )
        .join('')}</nav>
      ${['all', 'leads'].includes(filter) ? `<section class="portfolio-enquiries"><div class="section-heading"><h2>Anfrageeingang</h2><span>${book.leads.length} / 12</span></div><div class="business-room-selector"><label class="field-label">Zielraum für neue Verträge<select class="select" data-business-select>${layout.rooms.map((r) => `<option value="${r.id}" ${r.id === roomId ? 'selected' : ''}>${ctx.tr(`Untergeschoss ${r.floor}`)} · ${ctx.tr(`Raum ${r.number}`)}</option>`).join('')}</select></label><p class="policy-explainer">Erst eine Zusage reserviert Ressourcen. Unbeantwortete Anfragen verfallen ohne Strafe.</p></div><div class="card-grid customer-leads">${book.leads.map((lead) => cards.leadCard(lead, roomId, model)).join('') || ctx.empty('Neue Kundenanfragen sind unterwegs', 'Dein Anfrageeingang füllt sich automatisch, während dein Betrieb weiterläuft.', '', '', 'inbox')}</div></section>` : ''}
      ${filter !== 'leads' ? `<div class="portfolio-filters"><label class="field-label">Kunden suchen<input class="input" type="search" data-customer-search value="${ctx.esc(query)}" placeholder="${ctx.tr('Name oder Vertrags-ID')}"></label><label class="field-label">Standortfilter<select class="select" data-customer-scope><option value="all">${ctx.tr('Alle Räume')}</option>${layout.rooms.map((r) => `<option value="${r.id}" ${r.id === scope ? 'selected' : ''}>${ctx.tr(`Raum ${r.number}`)} · ${ctx.tr(`Untergeschoss ${r.floor}`)}</option>`).join('')}</select></label></div><div data-customer-portfolio>${portfolioRows(model, book)}</div>` : ''}
      <details class="panel portfolio-standards" data-persist-details="customer-standards"><summary>Ressourcen und Vertragsstandards im Zielraum</summary><div class="panel-body"><h3>${ctx.tr(`Raum ${layout.rooms.find((r) => r.id === roomId)?.number || 1}`)}</h3><p class="policy-explainer">Reserviert / verfügbar</p><div class="business-resources">${Object.keys(
        room.available,
      )
        .map(
          (key) =>
            `<div><span>${ctx.tr({ cpu: 'CPU', ram: 'RAM / GB', storage: 'Speicher / TB', network: 'Netz / Mbit/s', gpu: 'GPU', vram: 'VRAM / GB' }[key] || key)}</span><strong data-room-resource="${key}">${ctx.dec(room.reserved[key])} / ${ctx.dec(room.available[key])}</strong></div>`,
        )
        .join(
          '',
        )}</div><div class="business-service-grid">${room.groups.map((g) => `<div data-business-room="${roomId}" data-service-kind="${g.kind}"><strong>${ctx.tr(model.services[g.kind].name)}</strong><p>${ctx.dec(model.services[g.kind].fee * 60)} CR / min</p><button class="button small" data-service="setServicePremium" data-value="${!g.nextPremium}">${ctx.tr(g.nextPremium ? 'Premium bei Verlängerung: an' : 'Premium bei Verlängerung: aus')}</button></div>`).join('')}</div><button class="button small" data-nav="facility">Raumbetrieb & Versorgung</button></div></details>
      ${book.history.length ? `<details class="panel portfolio-standards" data-persist-details="customer-history"><summary>${ctx.tr('Vertragshistorie')} · ${book.history.length}</summary><div class="panel-body">${book.history.map((h) => `<div class="status-row"><span>${ctx.esc(h.client)}<small>${ctx.tr({ sla: 'Versorgungsprobleme', budget: 'Kundenbudget', consolidation: 'Konsolidierung', competitor: 'Anbieterwechsel', term: 'Vertragsende' }[h.reason] || h.reason)}</small></span><time>${ctx.clock(h.time)}</time></div>`).join('')}</div></details>` : ''}</div>`
    );
  }
  function click(target) {
    if (target.hasAttribute('data-customer-filter')) {
      selectFilter(target.dataset.customerFilter);
      ctx.render();
      return true;
    }
    if (target.hasAttribute('data-customer-page')) {
      page += Number(target.dataset.customerPage);
      ctx.render();
      return true;
    }
    return false;
  }
  function change(target) {
    if (!target.hasAttribute('data-customer-scope')) return false;
    scope = target.value;
    page = 0;
    target.blur();
    ctx.render();
    return true;
  }
  function input(target) {
    if (!target.hasAttribute('data-customer-search')) return false;
    query = target.value;
    page = 0;
    const container = ctx.$('[data-customer-portfolio]');
    if (container) {
      container.innerHTML = portfolioRows(
        ctx.E.getBusinessModel(ctx.state),
        ctx.E.getCustomers(ctx.state),
      );
      ctx.I18N?.localize(container);
      ctx.updateBusiness();
    }
    return true;
  }
  return { view, click, change, input, selectFilter, selectRoom };
}
