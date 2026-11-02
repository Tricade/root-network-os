import { NOTIFICATION_TYPES, notificationType } from './notification-preferences.js';
import { notificationBody } from './notification-view.js';
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
  let seenLogs = null;
  const persist = () => ctx.storageSet(key, JSON.stringify(saved));
  const notificationPreference = (category) =>
    saved.preferences[category] || saved.preferences.activity;

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
    const logs = history.filter((entry) => entry.source === 'log');
    const fresh = seenLogs ? logs.filter((entry) => !seenLogs.has(entry.id)) : [];
    seenLogs = new Set(logs.map((entry) => entry.id));
    for (const entry of fresh.reverse()) {
      const type = notificationType(entry);
      if (notificationPreference(type).toast)
        ctx.toast?.(
          entry.message,
          entry.type === 'error',
          NOTIFICATION_TYPES[type].target,
          false,
          type,
          true,
        );
    }
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
    const unread = current.filter((entry) => !read.has(entry.id));
    return {
      unread: unread.filter((entry) => notificationPreference(notificationType(entry)).badge)
        .length,
      unreadAll: unread.length,
      read,
    };
  }
  function centerBody() {
    return notificationBody(ctx, {
      tab,
      group,
      expanded,
      limit,
      pending,
      history,
      preferences: saved.preferences,
      ...counts(),
    });
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
      saved.preferences,
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
      tab = ['pending', 'history', 'settings'].includes(target.dataset.notificationTab)
        ? target.dataset.notificationTab
        : 'pending';
      group = 'all';
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
    if (el.hasAttribute('data-notification-preference')) {
      const [type, option] = el.dataset.notificationPreference.split(':');
      if (
        !Object.hasOwn(saved.preferences, type) ||
        !Object.hasOwn(saved.preferences[type], option)
      )
        return false;
      saved.preferences[type][option] = Boolean(el.checked);
      persist();
      // Updating the badge does not rebuild focused controls while toggling options.
      signature = '';
      updateNotificationCenter();
      return true;
    }
    if (!el.hasAttribute('data-notification-group')) return false;
    group = el.value;
    limit = 12;
    updateNotificationCenter(undefined, undefined, undefined, true);
    ctx.updateAttentionCards();
    return true;
  }
  function recordNotification(message, error, target, category) {
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
      category: notificationType({ category, error, target, message }),
      time: ctx.state.time,
    });
    saved.messages = saved.messages.slice(0, 30);
    persist();
    updateNotificationCenter();
  }
  function resetNotifications() {
    saved = loadNotificationState(JSON.stringify({ preferences: saved.preferences }));
    seenLogs = null;
    firstSync = true;
    expanded = null;
    tab = 'pending';
    group = 'all';
    limit = 12;
    persist();
  }
  // An explicit action already has a direct acknowledgement. Keep its durable
  // history and badge entry, but do not also announce the same log automatically.
  function acknowledgeLogToast(id) {
    seenLogs?.add(`log:${id}`);
  }
  return {
    acknowledgeLogToast,
    notificationPreference,
    notificationModal,
    updateNotificationCenter,
    notificationClick,
    notificationChange,
    recordNotification,
    resetNotifications,
  };
}
