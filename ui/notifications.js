/** notifications UI: reads current state through the controller context. */
export function createNotificationsUI(ctx, platform = globalThis) {
  const notices = [];

  function renderNotices() {
    const root = ctx.$('#toast-root');
    root.innerHTML = notices
      .map(
        ({ message, error, target }) =>
          `<div class="toast ${error ? 'error' : ''}">${ctx.icon(error ? 'help' : target ? 'trophy' : 'check')}<span>${ctx.esc(message)}</span>${target ? `<button class="button small" data-nav="${target}">Details öffnen${ctx.icon('arrow')}</button>` : ''}</div>`,
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
      );
  }

  function toast(message, error = false, target = '', record = true) {
    if (notices.some((notice) => notice.message === message && notice.target === target)) return;
    // A completion and an achievement may arrive together after offline progress.
    // Keep both visible, with independently bounded lifetimes and a three-item cap.
    if (notices.length === 3) platform.clearTimeout(notices.shift().timer);
    if (record) ctx.recordNotification?.(message, error, target);
    const notice = { message, error, target, timer: null };
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
  return { announceAchievements, toast };
}
