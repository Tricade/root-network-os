import { attentionEntries, uniqueAttentionEntries } from './attention-model.js';
import { dashboardModel } from './dashboard-model.js';
import {
  loadNotificationState,
  reconcileNotificationReads,
  notificationHistory,
} from './notification-state.js';

/** The bell combines unresolved work and the bounded activity stream in every workspace. */
export function createNotificationCenter(ctx) {
  const key = 'root.notifications.v1';
  const stored = ctx.storageGet(key);
  let firstSync = !stored;
  let saved = loadNotificationState(stored),
    tab = 'pending',
    group = 'all',
    expanded = null,
    limit = 12,
    sequence = 0;
  let pending = [],
    history = [],
    current = [],
    signature = '';
  const persist = () => ctx.storageSet(key, JSON.stringify(saved));
  const text = (value) => ctx.esc(ctx.tr(value || ''));

  function sync(metrics, resilience, agents) {
    if (!ctx.state) return;
    pending = uniqueAttentionEntries(
      attentionEntries(
        ctx.E,
        ctx.state,
        dashboardModel(ctx.E, ctx.state, metrics, resilience, agents),
      ),
    );
    history = notificationHistory(ctx.state, saved.messages);
    current = [...pending, ...history];
    // Existing saves may carry months of history. Only pending work starts unread;
    // log events created after enabling the center are new notifications.
    if (firstSync) {
      saved.read.push(...history.filter((e) => e.source === 'log').map((e) => e.id));
      firstSync = false;
      persist();
    }
    const read = reconcileNotificationReads(saved.read, current);
    if (JSON.stringify(read) !== JSON.stringify(saved.read)) {
      saved.read = read;
      persist();
    }
  }
  function counts() {
    const read = new Set(saved.read);
    return { unread: current.filter((entry) => !read.has(entry.id)).length, read };
  }
  function centerBody() {
    const { unread, read } = counts(),
      entries = tab === 'pending' ? pending : history;
    const groups = [...new Map(pending.map((e) => [e.group, e.category])).entries()];
    if (group !== 'all' && !groups.some(([id]) => id === group)) group = 'all';
    const filtered =
      tab === 'pending' && group !== 'all' ? entries.filter((e) => e.group === group) : entries;
    const visible = filtered.slice(0, limit);
    return `<div class="notification-toolbar"><div class="notification-tabs" role="group" aria-label="${text('Meldungen filtern')}"><button class="button small ${tab === 'pending' ? 'selected' : ''}" data-notification-tab="pending" aria-pressed="${tab === 'pending'}">${text('Offene Vorgänge')} <span>${pending.length}</span></button><button class="button small ${tab === 'history' ? 'selected' : ''}" data-notification-tab="history" aria-pressed="${tab === 'history'}">${text('Verlauf')} <span>${history.length}</span></button></div><button class="text-button" data-notification-read-all ${unread ? '' : 'disabled'}>${text('Alle als gelesen markieren')}</button></div>
      ${tab === 'pending' ? `<label class="notification-filter">${text('Meldungstyp')}<select class="select" data-notification-group><option value="all">${text('Alle Bereiche')} (${pending.length})</option>${groups.map(([id, label]) => `<option value="${id}" ${id === group ? 'selected' : ''}>${text(label)} (${pending.filter((e) => e.group === id).length})</option>`).join('')}</select></label>` : ''}
      <p class="notification-note">${text('Gelesene Meldungen bleiben offen, bis der Vorgang erledigt ist.')}</p>
      <div class="notification-list">${visible.map((entry) => `<section class="notification-row ${read.has(entry.id) ? '' : 'unread'}" data-notification-id="${ctx.esc(entry.id)}"><div class="notification-summary"><div>${tab === 'pending' ? `<small>${text(entry.category)}</small><button class="text-button notification-title" data-notification-expand="${ctx.esc(entry.id)}" aria-expanded="${expanded === entry.id}">${text(entry.title)}${ctx.icon('chevron')}</button>` : `<p>${text(entry.message)}</p><small>${text('Betriebszeit')} ${ctx.clock(entry.time)}</small>`}</div>${read.has(entry.id) ? `<span class="notification-read">${ctx.icon('check')}<span class="sr-only">${text('Gelesen')}</span></span>` : `<button class="icon-button" data-notification-read="${ctx.esc(entry.id)}" aria-label="${text('Als gelesen markieren')}">${ctx.icon('check')}</button>`}</div>${tab === 'pending' && expanded === entry.id ? ctx.attentionCard(entry) : ''}${tab === 'history' && entry.target ? `<button class="text-button" data-nav="${ctx.esc(entry.target)}">${text('Details öffnen')}${ctx.icon('arrow')}</button>` : ''}</section>`).join('') || `<div class="empty-state">${ctx.icon('bell')}<strong>${text(tab === 'pending' ? 'Keine offenen Vorgänge' : 'Noch keine Einträge')}</strong></div>`}</div>
      ${filtered.length > limit ? `<button class="button block" data-notification-more>${text('Weitere Meldungen laden')} · ${filtered.length - limit}</button>` : ''}`;
  }
  function notificationModal() {
    sync();
    return `<div data-notification-center>${centerBody()}</div>`;
  }
  function updateNotificationCenter(metrics, resilience, agents, force = false) {
    sync(metrics, resilience, agents);
    const { unread } = counts();
    ctx.$$('[data-notification-bell]').forEach((button) => {
      button.setAttribute(
        'aria-label',
        `${ctx.tr('Benachrichtigungen')} · ${unread} ${ctx.tr('ungelesen')}`,
      );
      const badge = button.querySelector('[data-notification-count]');
      if (badge) {
        badge.hidden = !unread;
        badge.textContent = unread > 99 ? '99+' : String(unread);
      }
    });
    const root = ctx.$('[data-notification-center]');
    if (!root) {
      signature = '';
      return;
    }
    // Timers and quotes update in place. Rebuild only when item identity/status/read state changes.
    const next = JSON.stringify([
      tab,
      group,
      expanded,
      limit,
      saved.read,
      pending.map((e) => [
        e.id,
        e.detail,
        e.data.issue,
        e.data.work,
        e.data.agentId,
        e.data.status,
      ]),
      history.map((e) => e.id),
    ]);
    if (next === signature && !force) return;
    if (!force && root.querySelector('select:focus,input:focus')) return;
    const active = document.activeElement;
    const focusAttribute = [
      'data-notification-tab',
      'data-notification-group',
      'data-notification-more',
      'data-notification-read-all',
      'data-notification-expand',
      'data-notification-read',
    ].find((attribute) => active?.hasAttribute(attribute));
    const focusKey = focusAttribute && active.getAttribute(focusAttribute);
    const scroll = root.closest('.modal-body')?.scrollTop || 0;
    root.innerHTML = centerBody();
    signature = next;
    const replacement =
      focusAttribute &&
      [...root.querySelectorAll(`[${focusAttribute}]`)].find(
        (el) => el.getAttribute(focusAttribute) === focusKey && !el.disabled,
      );
    if (replacement) replacement.focus({ preventScroll: true });
    else if (active && !active.isConnected)
      ctx.$('#modal-root .modal')?.focus({ preventScroll: true });
    if (root.closest('.modal-body')) root.closest('.modal-body').scrollTop = scroll;
  }
  function notificationClick(target) {
    const row = target.closest('[data-notification-id]');
    if (row && !saved.read.includes(row.dataset.notificationId)) {
      saved.read.push(row.dataset.notificationId);
      persist();
    }
    let handled = true;
    if (target.hasAttribute('data-notification-tab')) {
      tab = target.dataset.notificationTab;
      limit = 12;
    } else if (target.hasAttribute('data-notification-expand'))
      expanded =
        expanded === target.dataset.notificationExpand ? null : target.dataset.notificationExpand;
    else if (target.hasAttribute('data-notification-read')) {
      if (!saved.read.includes(target.dataset.notificationRead))
        saved.read.push(target.dataset.notificationRead);
    } else if (target.hasAttribute('data-notification-read-all'))
      saved.read = current.map((entry) => entry.id);
    else if (target.hasAttribute('data-notification-more')) limit += 12;
    else handled = false;
    if (handled) {
      persist();
      updateNotificationCenter(undefined, undefined, undefined, true);
      ctx.updateAttentionCards();
    }
    // Do not consume the normal domain buttons inside a notification card.
    return handled;
  }
  function notificationChange(el) {
    if (!el.hasAttribute('data-notification-group')) return false;
    group = el.value;
    limit = 12;
    updateNotificationCenter(undefined, undefined, undefined, true);
    ctx.updateAttentionCards();
    return true;
  }
  function recordNotification(message, error, target) {
    if (
      !ctx.state ||
      target === 'achievements' ||
      ctx.state.log.some((entry) => entry.message === message)
    )
      return;
    if (
      saved.messages.some(
        (entry) => entry.message === message && entry.target === target && entry.error === error,
      )
    )
      return;
    saved.messages.unshift({
      id: `message:${Date.now()}:${++sequence}`,
      message,
      error,
      target,
      time: ctx.state.time,
    });
    saved.messages = saved.messages.slice(0, 30);
    persist();
    updateNotificationCenter();
  }
  function resetNotifications() {
    saved = loadNotificationState();
    firstSync = true;
    expanded = null;
    tab = 'pending';
    group = 'all';
    limit = 12;
    persist();
  }
  return {
    notificationModal,
    updateNotificationCenter,
    notificationClick,
    notificationChange,
    recordNotification,
    resetNotifications,
  };
}
