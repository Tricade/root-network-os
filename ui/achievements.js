import { achievementArt } from './business-art.js';
/** Rewards have a dedicated, discoverable route and retain their existing unlock rules. */
export function createAchievementsUI(ctx) {
  function achievementsView() {
    const claimed = Object.keys(ctx.state.achievements).filter(
      (id) => ctx.state.achievements[id],
    ).length;
    return (
      ctx.head(
        'Erfolge & Meilensteine',
        'Ziele, Fortschritte und abholbereite Belohnungen an einem Ort.',
        `<span class="tag green">${claimed} / ${ctx.E.catalog.achievements.length}</span>`,
      ) +
      `<div class="achievement-grid">${ctx.E.catalog.achievements.map((a) => `<section class="achievement ${ctx.state.achievements[a.id] ? 'claimed' : ctx.state.achievementUnlocks?.[a.id] || a.check(ctx.state) ? 'available' : ''}">${achievementArt(a.id, ctx.state.achievements[a.id], ctx.state.achievementUnlocks?.[a.id] || a.check(ctx.state))}<div class="achievement-copy"><h3>${ctx.esc(ctx.tr(a.name))}</h3><p>${ctx.esc(ctx.tr(a.description))}</p></div>${ctx.state.achievements[a.id] ? '<span class="tag">ERREICHT</span>' : ctx.actionButton('claimAchievement', `${ctx.icon('coins')}+${ctx.fmt(a.reward)} CR`, { id: a.id }, 'small')}</section>`).join('')}</div>`
    );
  }
  return { achievementsView };
}
