import {
  NOTIFICATION_TYPES,
  notificationType,
  notificationPreferencesMarkup,
} from './notification-preferences.js';

/** Rendering is independent of the read ledger and simulation clock. */
export function notificationBody(ctx, view) {
  const { tab, group, expanded, limit, pending, history, preferences, read, unreadAll } = view;
  const t = (value) => ctx.esc(ctx.tr(value || ''));
  const list = (rows) => rows.filter((entry) => preferences[notificationType(entry)].visible);
  const pendingVisible = list(pending),
    historyVisible = list(history);
  const entries = tab === 'pending' ? pendingVisible : historyVisible;
  const filtered = group === 'all' ? entries : entries.filter((e) => notificationType(e) === group);
  const tabs = [
    ['pending', 'Offene Vorgänge', pendingVisible.length],
    ['history', 'Verlauf', historyVisible.length],
    ['settings', 'Meldungen einstellen', null],
  ];
  const toolbar = `<div class="notification-toolbar"><div class="notification-tabs" role="group" aria-label="${t('Meldungen filtern')}">${tabs.map(([id, label, count]) => `<button class="button small ${tab === id ? 'selected' : ''}" data-notification-tab="${id}" aria-pressed="${tab === id}">${t(label)}${count === null ? '' : ` <span>${count}</span>`}</button>`).join('')}</div>${tab !== 'settings' ? `<button class="text-button" data-notification-read-all ${unreadAll ? '' : 'disabled'}>${t('Alle als gelesen markieren')}</button>` : ''}</div>`;
  if (tab === 'settings') return toolbar + notificationPreferencesMarkup(ctx, preferences);
  return (
    toolbar +
    `<label class="notification-filter">${t('Meldungstyp')}<select class="select" data-notification-group><option value="all">${t('Alle Bereiche')} (${entries.length})</option>${Object.entries(
      NOTIFICATION_TYPES,
    )
      .map(
        ([id, def]) =>
          `<option value="${id}" ${group === id ? 'selected' : ''}>${t(def.label)} (${entries.filter((e) => notificationType(e) === id).length})</option>`,
      )
      .join(
        '',
      )}</select></label><p class="notification-note">${t('Gelesene Meldungen bleiben offen, bis der Vorgang erledigt ist.')}</p><div class="notification-list">${
      filtered
        .slice(0, limit)
        .map((entry) => {
          const type = NOTIFICATION_TYPES[notificationType(entry)];
          return `<section class="notification-row ${read.has(entry.id) ? '' : 'unread'}" data-notification-id="${ctx.esc(entry.id)}"><div class="notification-summary"><span class="notification-type-icon" aria-hidden="true">${ctx.icon(type.icon)}</span><div>${tab === 'pending' ? `<small>${t(entry.category)}</small><button class="text-button notification-title" data-notification-expand="${ctx.esc(entry.id)}" aria-expanded="${expanded === entry.id}">${t(entry.title)}${ctx.icon('chevron')}</button>` : `<small>${t(type.label)}</small><p>${t(entry.message)}</p><small>${t('Betriebszeit')} ${ctx.clock(entry.time)}</small>`}</div>${read.has(entry.id) ? `<span class="notification-read">${ctx.icon('check')}<span class="sr-only">${t('Gelesen')}</span></span>` : `<button class="icon-button" data-notification-read="${ctx.esc(entry.id)}" aria-label="${t('Als gelesen markieren')}">${ctx.icon('check')}</button>`}</div>${tab === 'pending' && expanded === entry.id ? ctx.attentionCard(entry) : ''}${tab === 'history' && entry.target ? `<button class="text-button" data-nav="${ctx.esc(entry.target)}">${t('Details öffnen')}${ctx.icon('arrow')}</button>` : ''}</section>`;
        })
        .join('') ||
      `<div class="empty-state">${ctx.icon('bell')}<strong>${t(tab === 'pending' ? 'Keine offenen Vorgänge' : 'Noch keine Einträge')}</strong></div>`
    }</div>${filtered.length > limit ? `<button class="button" data-notification-more>${t('Weitere Meldungen laden')} · ${filtered.length - limit}</button>` : ''}`
  );
}
