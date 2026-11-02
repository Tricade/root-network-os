/** Selected attention item. This is a read model; all mutations use normal domain actions. */
export function attentionDetail(state, model, id) {
  const action = model.actions.find((entry) => entry.id === id) || model.actions[0];
  if (!action) return null;
  const failed = state.servers.filter((server) => server.status === 'failed');
  const contracts = state.customers.contracts;
  const result = { ...action, facts: [], explanation: '', button: 'Vorgang öffnen' };
  switch (action.id) {
    case 'incident':
      result.explanation = model.protection.incident.description;
      result.button = 'Vorfall öffnen';
      break;
    case 'repairs':
      result.explanation =
        'Ein Gerätefehler betrifft seine Kapazität. Andere erreichbare Server arbeiten weiter.';
      result.facts = [
        ['Ausgefallene Geräte', failed.length],
        ['Ersatzteile auf Lager', state.resilience.parts],
      ];
      result.entityId = failed[0]?.id;
      result.button = 'Reparaturen prüfen';
      break;
    case 'notices':
    case 'support':
    case 'staff': {
      const entries = contracts.filter((c) =>
        action.id === 'notices'
          ? c.notice > 0
          : action.id === 'staff'
            ? c.work && !c.agentId
            : c.issue,
      );
      result.explanation =
        action.id === 'staff'
          ? 'Die Einrichtung oder Betreuung wartet auf einen Agenten. Noch nicht eingerichtete Dienste erzeugen keinen Umsatz.'
          : 'Prüfe betroffene Verträge, Versorgung und verbleibende Zeit. Betreuung ersetzt keine fehlende Kapazität.';
      result.filter = action.id === 'notices' ? 'notice' : 'attention';
      result.facts = [
        ['Betroffene Verträge', entries.length],
        ['Kunde', entries[0]?.client || '—'],
      ];
      result.button = 'Betroffene Verträge öffnen';
      break;
    }
    case 'supply':
      result.explanation =
        'Versorgung und Reserven gelten nur für angeschlossene Räume. Prüfe zuerst den begrenzenden Anschluss.';
      result.button = 'Versorgung prüfen';
      break;
    case 'margin':
      result.explanation =
        'Laufende Kosten übersteigen die laufenden Einnahmen. Projektbelohnungen sind zusätzliche Einmalzahlungen.';
      result.facts = [['Aktive Verträge', model.customers.active]];
      result.button = 'Bilanz öffnen';
      break;
    case 'enquiries':
      result.explanation =
        'Anfragen sind unverbindlich. Erst eine Zusage reserviert Kapazität und verursacht Einrichtungskosten.';
      result.filter = 'leads';
      result.button = 'Anfragen prüfen';
      break;
    case 'growth':
    case 'growth-due':
      result.explanation =
        'Eine zugesagte Erweiterung braucht zusätzliche Kapazität und Agentenzeit vor dem Liefertermin. Erlös entsteht erst nach Einrichtung.';
      result.button = 'Erweiterungen öffnen';
      break;
    case 'plan':
    case 'maintenance':
      result.explanation = action.detail;
      result.button = 'Plan prüfen';
      break;
    case 'rewards':
      result.explanation = 'Freigeschaltete Meilensteine warten auf die Abholung ihrer Belohnung.';
      result.button = 'Erfolge öffnen';
      break;
    case 'decisions':
      result.explanation =
        'Offene Betriebsentscheidungen stehen im Posteingang mit Kosten und Folgen zur Auswahl.';
      result.button = 'Posteingang öffnen';
      break;
    case 'research':
      result.explanation =
        'Wähle Voraussetzungen und Nutzen bewusst. Ein Projekt bindet Laborzeit und 10 % des Projektdurchsatzes.';
      result.button = 'Forschungsbaum öffnen';
      break;
  }
  return result;
}

export function createDashboardAttention(ctx) {
  let selected = null,
    expanded = false;
  const detail = (model) => attentionDetail(ctx.state, model, selected);
  function attentionMarkup(model) {
    const item = detail(model);
    selected = item?.id || null;
    const shown = expanded ? model.actions : model.actions.slice(0, 3);
    return `<div class="command-attention"><section class="panel command-inbox">${ctx.panelHeader('Jetzt wichtig', `<span class="count">${model.actions.length}</span>`)}<div class="command-action-list">${shown.map((a) => `<button class="command-action ${a.severity}" data-dashboard-select="${a.id}" aria-pressed="${a.id === selected}"><span class="command-action-icon">${ctx.icon(a.severity === 'urgent' ? 'shield' : a.severity === 'warning' ? 'pulse' : 'arrow')}</span><span><strong>${ctx.esc(ctx.tr(a.label))}</strong>${a.detail ? `<small>${ctx.esc(ctx.tr(a.detail))}</small>` : ''}</span>${a.count ? `<b>${ctx.fmt(a.count)}</b>` : ctx.icon('chevron')}</button>`).join('') || `<p class="panel-body">${ctx.tr('Keine offenen Vorgänge')}</p>`}</div><div class="panel-footer"><span>${shown.length} / ${model.actions.length} ${ctx.tr('Hinweise')}</span>${model.actions.length > 3 ? `<button class="text-button" data-dashboard-more aria-expanded="${expanded}">${ctx.tr(expanded ? 'Weniger anzeigen' : 'Alle anzeigen')}</button>` : ''}</div></section><section class="panel command-detail" aria-label="${ctx.tr('Ausgewählter Vorgang')}">${item ? `<span class="eyebrow">${ctx.tr('NÄCHSTE HANDLUNG')}</span><h3>${ctx.esc(ctx.tr(item.label))}</h3><p>${ctx.esc(ctx.tr(item.explanation || item.detail || ''))}</p>${item.facts.length ? `<dl>${item.facts.map(([key, value]) => `<dt>${ctx.esc(ctx.tr(key))}</dt><dd>${ctx.esc(typeof value === 'number' ? ctx.fmt(value) : ctx.tr(value ?? '—'))}</dd>`).join('')}</dl>` : ''}<button class="button primary block" data-dashboard-open="${item.id}">${ctx.esc(ctx.tr(item.button))}${ctx.icon('arrow')}</button>` : `<h3>${ctx.tr('Betrieb im Blick')}</h3><p>${ctx.tr('Neue Vorgänge erscheinen hier automatisch. Deine Regeln arbeiten im Hintergrund weiter.')}</p>`}</section></div>`;
  }
  function dashboardClick(target) {
    if (target.hasAttribute('data-dashboard-select')) {
      selected = target.dataset.dashboardSelect;
      ctx.render();
      return true;
    }
    if (target.hasAttribute('data-dashboard-more')) {
      expanded = !expanded;
      ctx.render();
      return true;
    }
    if (!target.hasAttribute('data-dashboard-open')) return false;
    const item = detail(ctx.getDashboardModel());
    if (!item) return true;
    if (item.filter) ctx.selectCustomerFilter?.(item.filter);
    ctx.navigate(item.route);
    return true;
  }
  return { attentionMarkup, dashboardClick };
}
