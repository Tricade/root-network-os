import { NOTIFICATION_TYPES, notificationType } from './notification-preferences.js';
/** notifications UI: reads current state through the controller context. */
export function createNotificationsUI(ctx, platform = globalThis) {
  const notices = [];
  let sequence = 0;

  function renderNotices() {
    const root = ctx.$('#toast-root');
    root.innerHTML = notices
      .map(
        ({ id, message, error, target, category }) =>
          `<div class="toast ${error ? 'error' : ''}">${ctx.icon(error ? 'help' : NOTIFICATION_TYPES[category].icon)}<span>${ctx.esc(message)}</span>${target ? `<button class="button small" data-nav="${target}">Details öffnen${ctx.icon('arrow')}</button>` : ''}<button class="icon-button toast-dismiss" data-toast-dismiss="${id}" aria-label="Meldung schließen">${ctx.icon('cross')}</button></div>`,
      )
      .join('');
    globalThis.ROOTI18N?.localize?.(root);
  }

  function announceAchievements() {
    const fresh = ctx.pendingAchievements().filter((a) => !ctx.seenAchievements.has(a.id));
    ctx.pendingAchievements().forEach((a) => ctx.seenAchievements.add(a.id));
    if (fresh.length)
      toast(
        fresh.length === 1
          ? 'Erfolg freigeschaltet: ' + fresh[0].name
          : fresh.length + ' Erfolge freigeschaltet. Belohnungen warten unter Erfolge.',
        false,
        'achievements',
        true,
        'rewards',
        true,
      );
  }

  function toast(message, error = false, target = '', record = true, category, automatic = false) {
    category = notificationType({ category, error, target, message });
    if (record) ctx.recordNotification?.(message, error, target, category);
    // User-triggered acknowledgements and validation errors remain immediate.
    // Only background event pop-ups are governed by the notification preferences.
    if (automatic && ctx.notificationPreference?.(category).toast === false) return;
    if (notices.some((notice) => notice.message === message && notice.target === target)) return;
    // A completion and an achievement may arrive together after offline progress.
    // Keep both visible, with independently bounded lifetimes and a three-item cap.
    if (notices.length === 3) platform.clearTimeout(notices.shift().timer);
    const notice = { id: ++sequence, message, error, target, category, timer: null };
    notices.push(notice);
    renderNotices();
    notice.timer = platform.setTimeout(
      () => {
        const index = notices.indexOf(notice);
        if (index >= 0) notices.splice(index, 1);
        renderNotices();
      },
      target ? 8000 : 4200,
    );
  }
  function dismissToast(target) {
    if (!target.hasAttribute('data-toast-dismiss')) return false;
    const index = notices.findIndex((n) => n.id === Number(target.dataset.toastDismiss));
    if (index >= 0) {
      platform.clearTimeout(notices[index].timer);
      notices.splice(index, 1);
      renderNotices();
    }
    return true;
  }
  return { announceAchievements, toast, dismissToast };
}
