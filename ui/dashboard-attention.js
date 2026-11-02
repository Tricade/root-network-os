import { attentionEntries } from './attention-model.js';

/** Categories stay compact; the selected pane contains the actual pending work. */
export function createDashboardAttention(ctx) {
  let selected = null,
    expanded = false;
  const cursors = new Map();
  function current(entries) {
    const cursor = cursors.get(selected) || { id: null, index: 0 };
    const found = entries.findIndex((entry) => entry.id === cursor.id);
    const index = found >= 0 ? found : Math.min(cursor.index, Math.max(0, entries.length - 1));
    cursors.set(selected, { id: entries[index]?.id || null, index });
    return index;
  }
  function attentionMarkup(model) {
    const category = model.actions.find((entry) => entry.id === selected) || model.actions[0];
    selected = category?.id || null;
    const shown = expanded ? model.actions : model.actions.slice(0, 4);
    const entries = attentionEntries(ctx.E, ctx.state, model).filter(
      (entry) => entry.group === selected,
    );
    const index = current(entries);
    return `<div class="command-attention"><section class="panel command-inbox">${ctx.panelHeader(ctx.tr('Jetzt wichtig'), `<span class="count">${model.actions.length}</span>`)}<div class="command-action-list">${shown.map((a) => `<button class="command-action ${a.severity}" data-dashboard-select="${a.id}" aria-pressed="${a.id === selected}"><span class="command-action-icon">${ctx.icon(a.severity === 'urgent' ? 'shield' : a.severity === 'warning' ? 'pulse' : 'arrow')}</span><span><strong>${ctx.esc(ctx.tr(a.label))}</strong>${a.detail ? `<small>${ctx.esc(ctx.tr(a.detail))}</small>` : ''}</span>${a.count ? `<b>${ctx.fmt(a.count)}</b>` : ctx.icon('chevron')}</button>`).join('') || `<p class="panel-body">${ctx.tr('Keine offenen Vorgänge')}</p>`}</div>${model.actions.length > 4 ? `<div class="panel-footer"><span>${shown.length} / ${model.actions.length} ${ctx.tr('Hinweise')}</span><button class="text-button" data-dashboard-more aria-expanded="${expanded}">${ctx.tr(expanded ? 'Weniger anzeigen' : 'Alle anzeigen')}</button></div>` : ''}</section>
      <section class="panel command-detail" aria-label="${ctx.tr('Ausgewählter Vorgang')}"><div class="command-detail-heading"><h3>${ctx.esc(ctx.tr(category?.label || 'Betrieb im Blick'))}</h3><span class="count">${entries.length}</span></div><div class="command-detail-items">${entries.length ? ctx.attentionCard(entries[index]) : `<p>${ctx.tr('Neue Vorgänge erscheinen hier automatisch. Deine Regeln arbeiten im Hintergrund weiter.')}</p>`}</div>${entries.length > 1 ? `<nav class="command-detail-pager" aria-label="${ctx.tr('Vorgänge durchsehen')}"><button class="button small" data-dashboard-page="-1" ${index === 0 ? 'disabled' : ''}>${ctx.tr('Vorheriger Vorgang')}</button><span aria-live="polite">${index + 1} / ${entries.length}</span><button class="button small" data-dashboard-page="1" ${index === entries.length - 1 ? 'disabled' : ''}>${ctx.tr('Nächster Vorgang')}</button></nav>` : ''}</section></div>`;
  }
  function updateAttention(model, force = false) {
    const entries = attentionEntries(ctx.E, ctx.state, model);
    // Normalize selection before hashing so the next telemetry tick does not repaint it again.
    selected =
      (model.actions.find((entry) => entry.id === selected) || model.actions[0])?.id || null;
    current(entries.filter((entry) => entry.group === selected));
    const signature = JSON.stringify([
      selected,
      expanded,
      [...cursors],
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
      const pageDirection = focus?.getAttribute('data-dashboard-page');
      const hadFocus = root.contains(focus);
      root.innerHTML = attentionMarkup(model);
      root.dataset.signature = signature;
      if (focusId)
        root.querySelector(`[data-dashboard-select="${focusId}"]`)?.focus({ preventScroll: true });
      else if (hadFocus) {
        const pager =
          pageDirection &&
          root.querySelector(`[data-dashboard-page="${pageDirection}"]:not(:disabled)`);
        (pager || root.querySelector('.command-action[aria-pressed="true"]'))?.focus({
          preventScroll: true,
        });
      }
    });
  }
  function dashboardClick(target) {
    const model = ctx.getDashboardModel();
    if (target.hasAttribute('data-dashboard-select')) {
      selected = target.dataset.dashboardSelect;
    } else if (target.hasAttribute('data-dashboard-more')) expanded = !expanded;
    else if (target.hasAttribute('data-dashboard-page')) {
      const entries = attentionEntries(ctx.E, ctx.state, model).filter(
        (entry) => entry.group === selected,
      );
      const index = Math.max(
        0,
        Math.min(entries.length - 1, current(entries) + Number(target.dataset.dashboardPage)),
      );
      cursors.set(selected, { id: entries[index]?.id, index });
    } else return false;
    updateAttention(model, true);
    ctx.updateAttentionCards();
    return true;
  }
  return { attentionMarkup, updateAttention, dashboardClick };
}
