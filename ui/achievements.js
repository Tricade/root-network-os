import { achievementArt } from './business-art.js';
/** The visible metric and unlock predicate share the same catalog definition. */
export function createAchievementsUI(ctx) {
  let category = 'all',
    status = 'all';
  const categories = {
    all: 'Alle Erfolge',
    business: 'Wirtschaft',
    infrastructure: 'Infrastruktur',
    research: 'Forschung',
    team: 'Agenten',
    decisions: 'Entscheidungen',
  };
  const statuses = {
    all: 'Alle',
    available: 'Abholbereit',
    locked: 'Noch offen',
    claimed: 'Abgeholt',
  };
  const text = (s) => ctx.esc(ctx.tr(s));
  const unlocked = (a) =>
    Boolean(ctx.state.achievementUnlocks?.[a.id] || ctx.state.achievements[a.id]);
  const statusOf = (a) =>
    ctx.state.achievements[a.id] ? 'claimed' : unlocked(a) ? 'available' : 'locked';
  function progress(a, metrics) {
    const value = a.progress(ctx.state, metrics),
      attained = unlocked(a);
    // An earned milestone remains earned if the current hardware count or profit later drops.
    return {
      value: attained ? a.target : Math.max(0, Math.min(value, a.target)),
      label: attained
        ? ctx.tr('Ziel erreicht')
        : `${ctx.dec(value)} / ${ctx.fmt(a.target)} ${ctx.tr(a.unit)}`,
      detail:
        attained && value < a.target
          ? `${ctx.tr('Aktueller Wert')}: ${ctx.dec(value)} ${ctx.tr(a.unit)}`
          : '',
    };
  }
  function achievementsView() {
    const all = ctx.E.catalog.achievements,
      metrics = ctx.E.getMetrics(ctx.state);
    const selected = all.filter(
      (a) =>
        (category === 'all' || a.category === category) &&
        (status === 'all' || statusOf(a) === status),
    );
    const claimed = all.filter((a) => ctx.state.achievements[a.id]).length;
    const filter = (key, label, options, value) =>
      `<label class="field-label">${text(label)}<select class="select" data-achievement-filter="${key}">${Object.entries(
        options,
      )
        .map(
          ([id, name]) =>
            `<option value="${id}" ${id === value ? 'selected' : ''}>${text(name)}</option>`,
        )
        .join('')}</select></label>`;
    return (
      ctx.head(
        'Erfolge & Meilensteine',
        'Ziele, Fortschritte und abholbereite Belohnungen an einem Ort.',
        `<span class="tag green">${claimed} / ${all.length} ${text('Abgeholt')}</span>`,
      ) +
      `<div class="achievement-filters">${filter('category', 'Erfolgskategorie', categories, category)}${filter('status', 'Status', statuses, status)}<span class="muted">${selected.length} / ${all.length}</span></div><div class="achievement-grid">${selected
        .map((a) => {
          const p = progress(a, metrics);
          return `<section class="achievement ${statusOf(a)}" data-achievement="${a.id}">${achievementArt(a.id, ctx.state.achievements[a.id], unlocked(a), a.art)}<div class="achievement-copy"><span class="tag ${a.tier === 'Herausforderung' ? 'amber' : ''}">${text(a.tier)}</span><h3>${text(a.name)}</h3><p>${text(a.description)}</p><div class="achievement-progress"><span data-achievement-progress-text>${ctx.esc(p.label)}</span><progress max="${a.target}" value="${p.value}" aria-label="${text(a.name)}"></progress><small data-achievement-current>${ctx.esc(p.detail)}</small></div></div><div class="achievement-action">${ctx.state.achievements[a.id] ? `<span class="tag">${text('Abgeholt')}</span>` : ctx.actionButton('claimAchievement', `${ctx.icon('coins')}+${ctx.fmt(a.reward)} CR`, { id: a.id }, 'small')}</div></section>`;
        })
        .join(
          '',
        )}</div>${!selected.length ? `<p class="helper-card">${text('Keine Erfolge für diesen Filter')}</p>` : ''}`
    );
  }
  function achievementChange(el) {
    if (!el.hasAttribute('data-achievement-filter')) return false;
    if (el.dataset.achievementFilter === 'category' && Object.hasOwn(categories, el.value))
      category = el.value;
    else if (el.dataset.achievementFilter === 'status' && Object.hasOwn(statuses, el.value))
      status = el.value;
    ctx.render();
    return true;
  }
  function updateAchievements(metrics) {
    if (ctx.view !== 'achievements') return;
    ctx.$$('[data-achievement]').forEach((card) => {
      const a = ctx.E.catalog.achievements.find((a) => a.id === card.dataset.achievement);
      if (!a) return;
      const p = progress(a, metrics);
      card.querySelector('progress').value = p.value;
      card.querySelector('[data-achievement-progress-text]').textContent = p.label;
      card.querySelector('[data-achievement-current]').textContent = p.detail;
    });
  }
  return { achievementsView, achievementChange, updateAchievements };
}
