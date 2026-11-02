import { attentionEntries } from './attention-model.js';

/** Categories stay compact; the selected pane contains the actual pending work. */
export function createDashboardAttention(ctx) {
  let selected = null,
    expanded = false,
    itemLimit = 5;
  function attentionMarkup(model) {
    const category = model.actions.find((entry) => entry.id === selected) || model.actions[0];
    selected = category?.id || null;
    const shown = expanded ? model.actions : model.actions.slice(0, 4);
    const entries = attentionEntries(ctx.E, ctx.state, model).filter(
      (entry) => entry.group === selected,
    );
    return `<div class="command-attention"><section class="panel command-inbox">${ctx.panelHeader('Jetzt wichtig', `<span class="count">${model.actions.length}</span>`)}<div class="command-action-list">${shown.map((a) => `<button class="command-action ${a.severity}" data-dashboard-select="${a.id}" aria-pressed="${a.id === selected}"><span class="command-action-icon">${ctx.icon(a.severity === 'urgent' ? 'shield' : a.severity === 'warning' ? 'pulse' : 'arrow')}</span><span><strong>${ctx.esc(ctx.tr(a.label))}</strong>${a.detail ? `<small>${ctx.esc(ctx.tr(a.detail))}</small>` : ''}</span>${a.count ? `<b>${ctx.fmt(a.count)}</b>` : ctx.icon('chevron')}</button>`).join('') || `<p class="panel-body">${ctx.tr('Keine offenen Vorgänge')}</p>`}</div>${model.actions.length > 4 ? `<div class="panel-footer"><span>${shown.length} / ${model.actions.length} ${ctx.tr('Hinweise')}</span><button class="text-button" data-dashboard-more aria-expanded="${expanded}">${ctx.tr(expanded ? 'Weniger anzeigen' : 'Alle anzeigen')}</button></div>` : ''}</section>
      <section class="panel command-detail" aria-label="${ctx.tr('Ausgewählter Vorgang')}"><div class="command-detail-heading"><h3>${ctx.esc(ctx.tr(category?.label || 'Betrieb im Blick'))}</h3><span class="count">${entries.length}</span></div><div class="command-detail-items" tabindex="0" aria-label="${ctx.tr('Offene Vorgänge')}">${entries.slice(0, itemLimit).map(ctx.attentionCard).join('') || `<p>${ctx.tr('Neue Vorgänge erscheinen hier automatisch. Deine Regeln arbeiten im Hintergrund weiter.')}</p>`}${entries.length > itemLimit ? `<button class="button block" data-dashboard-items-more>${ctx.tr('Weitere Vorgänge laden')} · ${entries.length - itemLimit}</button>` : ''}</div></section></div>`;
  }
  function updateAttention(model, force = false) {
    const entries = attentionEntries(ctx.E, ctx.state, model);
    const signature = JSON.stringify([
      selected,
      expanded,
      itemLimit,
      model.actions,
      entries.map((e) => [
        e.id,
        e.detail,
        e.data.issue,
        e.data.work,
        e.data.agentId,
        e.data.retentionUsed,
        e.data.notice > 0,
      ]),
      ctx.state.lab.owned,
      ctx.state.lab.project?.id,
    ]);
    ctx.$$('[data-dashboard-attention]').forEach((root) => {
      if (!force && root.dataset.signature === signature) return;
      if (!force && root.querySelector('select:focus,input:focus')) return;
      const focus = document.activeElement;
      const focusId = focus?.getAttribute('data-dashboard-select');
      const scroll = root.querySelector('.command-detail-items')?.scrollTop || 0;
      root.innerHTML = attentionMarkup(model);
      root.dataset.signature = signature;
      const list = root.querySelector('.command-detail-items');
      if (list) list.scrollTop = scroll;
      if (focusId)
        root.querySelector(`[data-dashboard-select="${focusId}"]`)?.focus({ preventScroll: true });
      else if (focus && !focus.isConnected)
        root.querySelector('.command-action[aria-pressed="true"]')?.focus({ preventScroll: true });
    });
  }
  function dashboardClick(target) {
    if (target.hasAttribute('data-dashboard-select')) {
      selected = target.dataset.dashboardSelect;
      itemLimit = 5;
    } else if (target.hasAttribute('data-dashboard-more')) expanded = !expanded;
    else if (target.hasAttribute('data-dashboard-items-more')) itemLimit += 5;
    else return false;
    updateAttention(ctx.getDashboardModel(), true);
    ctx.updateAttentionCards();
    return true;
  }
  return { attentionMarkup, updateAttention, dashboardClick };
}
