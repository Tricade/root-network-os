import { workloadArt } from './workload-art.js';
import { technologyArt } from './research-art.js';
import { createResearchMap } from './research-map.js';
import { researchEffectTable } from './research-effects.js';

/** A branch shows a root, parallel paths and their join; cross-tree prerequisites remain links. */
export function createResearchCards(ctx) {
  const icons = {
    work: 'globe',
    risk: 'pulse',
    wear: 'shield',
    onboarding: 'agents',
    patience: 'timer',
    serviceEfficiency: 'cpu',
    retentionBonus: 'jobs',
    energy: 'heat',
    research: 'research',
    aiReward: 'cpu',
    inferenceIncome: 'server',
  };
  function researchCard(def, model, position = '') {
    const q = def.quote,
      active = model.project?.id === def.id,
      owned = q.unique && q.level > 0;
    const requirements = q.requires.map((id) => model.technologies.find((n) => n.id === id));
    const icon = q.unique
      ? icons[Object.keys(def.effects)[0]]
      : {
          routing: 'globe',
          cooling: 'heat',
          market: 'jobs',
          automation: 'automation',
          synthesis: 'research',
        }[def.id];
    return `<article class="research-card research-node ${owned ? 'completed' : q.missing?.length ? 'locked' : ''}" ${position ? `style="grid-area:${position}"` : ''} data-research-node="${def.id}">${!q.unique ? workloadArt(def.id, true) : ''}<div class="research-top"><div class="research-icon">${ctx.icon(icon)}</div><span class="tag ${owned ? 'green' : active ? 'blue' : ''}">${ctx.tr(owned ? 'Erforscht' : active ? 'In Arbeit' : q.unique ? 'Technologie' : 'Stufe')} ${q.unique ? '' : q.level}</span></div><h3>${ctx.esc(ctx.tr(def.name))}</h3><p>${ctx.esc(ctx.tr(def.description))}</p>${researchEffectTable(ctx, def)}<div class="research-prerequisites"><span>Voraussetzungen</span>${requirements.map((node) => `<button class="text-button ${ctx.state.lab.owned.includes(node.id) ? 'positive' : ''}" data-research-focus="${node.id}">${ctx.icon(ctx.state.lab.owned.includes(node.id) ? 'check' : 'layers')}${ctx.esc(ctx.tr(node.name))}</button>`).join('') || `<span>${ctx.tr('Keine Vorforschung erforderlich')}</span>`}${def.sector > 1 ? `<span>${ctx.tr('Ab Sektor')} ${def.sector}</span>` : ''}</div><div class="research-commitment"><strong>${ctx.fmt(q.cost)} ${ctx.tr('FP')}</strong><span>${ctx.duration(q.duration)} ${ctx.tr('Laborzeit')}</span></div><p class="protection-reason" data-research-reason="${def.id}">${owned ? '' : ctx.esc(ctx.tr(q.reason))}</p><button class="button block" data-research-start="${def.id}" ${q.enabled ? '' : 'disabled'}>${ctx.icon(owned ? 'check' : 'research')}${ctx.tr(owned ? 'Dauerhaft aktiv' : 'Forschung prüfen')}</button></article>`;
  }
  function researchBranch(model, selectedId) {
    const selected =
      model.technologies.find((n) => n.id === selectedId) ||
      model.technologies.find((n) => model.project?.id === n.id) ||
      model.technologies[0];
    return `<div class="research-workspace">${createResearchMap(ctx, model, selected.id)}</div>`;
  }
  function researchDecision(id) {
    const model = ctx.E.getResearch(ctx.state),
      def = [...model.technologies, ...model.repeatables].find((n) => n.id === id);
    if (!def) return `<p>${ctx.tr('Diese Forschung ist unbekannt.')}</p>`;
    const q = def.quote,
      requirements = q.requires.map((key) => model.technologies.find((n) => n.id === key)),
      active = model.project?.id === id,
      owned = q.unique && q.level > 0;
    return `<div class="research-decision-heading">${q.unique ? technologyArt(id) : workloadArt(id, true)}<div><span class="tag ${owned ? 'green' : active ? 'blue' : ''}">${ctx.tr(owned ? 'Erforscht' : active ? 'In Arbeit' : q.unique ? 'Technologie' : 'Stufe')} ${q.unique ? '' : q.level}</span><h3>${ctx.esc(ctx.tr(def.name))}</h3></div></div>
      <p class="research-decision-description">${ctx.esc(ctx.tr(def.description))}</p>
      ${researchEffectTable(ctx, def)}
      <div class="research-prerequisites"><span>${ctx.tr('Voraussetzungen')}</span>${requirements.map((node) => `<button class="text-button ${ctx.state.lab.owned.includes(node.id) ? 'positive' : ''}" data-research-focus="${node.id}">${ctx.icon(ctx.state.lab.owned.includes(node.id) ? 'check' : 'layers')}${ctx.esc(ctx.tr(node.name))}</button>`).join('') || `<span>${ctx.tr('Keine Vorforschung erforderlich')}</span>`}${def.sector > 1 ? `<span>${ctx.tr('Ab Sektor')} ${def.sector}</span>` : ''}</div>
      ${q.replaces?.length ? `<p class="modal-alert">${ctx.tr('Ersetzt bei Abschluss')}: ${q.replaces.map((key) => ctx.esc(ctx.tr(model.technologies.find((n) => n.id === key).name))).join(', ')}</p>` : ''}
      ${def.doctrine ? `<p class="research-doctrine-note">${ctx.tr('Eine Spezialisierung pro Zweig. Die bisherige bleibt während eines Wechsels aktiv; erst beim Abschluss wird sie ersetzt. Abbruch erstattet keine Punkte.')}</p>` : ''}
      <p class="research-decision-policy">${ctx.tr('Das Labor bearbeitet ein Projekt gleichzeitig. Währenddessen sinkt der Projektdurchsatz um 10 %. Ohne erreichbare Server pausiert die Laborarbeit. Ein Abbruch erstattet keine Forschungspunkte.')}</p>
      <div class="research-decision-footer"><div class="research-commitment"><strong>${ctx.fmt(q.cost)} ${ctx.tr('FP')}</strong><span>${ctx.duration(q.duration)} ${ctx.tr('Laborzeit')}</span></div><p class="modal-alert" data-research-decision-reason aria-live="polite">${ctx.esc(ctx.tr(q.reason || ''))}</p><button class="button primary block" data-research-confirm="start" data-id="${ctx.esc(id)}" ${q.enabled ? '' : 'disabled'}>${ctx.tr('Forschungsprojekt starten')}</button></div>`;
  }
  return { researchCard, researchBranch, researchDecision };
}
