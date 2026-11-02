import { createResearchCards } from './research-cards.js';
import { createResearchMapInput } from './research-map-input.js';

/** Research routing, funded-project feedback and laboratory decisions. */
export function createResearchUI(ctx) {
  let selectedTree = 'network',
    selectedNode = null;
  const cards = createResearchCards(ctx);
  const atlas = createResearchMapInput(ctx);
  function researchView() {
    const model = ctx.E.getResearch(ctx.state),
      tree = model.trees.find((t) => t.id === selectedTree) || model.trees[0];
    return (
      ctx.head(
        'Forschung & Entwicklung',
        'Plane Voraussetzungen und Laborzeit. Wirkungen werden erst nach Abschluss aktiv.',
        `<span class="tag blue">${ctx.stat('research')} FORSCHUNGSPUNKTE</span>`,
      ) +
      `<section class="panel research-project">${ctx.panelHeader('Labor', `<span class="tag ${model.project ? 'blue' : 'green'}" data-research-status>${ctx.tr(model.project ? (model.paused ? 'Pausiert' : 'Forschung läuft') : 'Bereit')}</span>`)}<div class="panel-body"><h3 data-research-project-name>${ctx.esc(ctx.tr(model.project?.name || 'Kein aktives Forschungsprojekt'))}</h3>${model.project ? `<p><span>Verbleibende Laborzeit</span>: <strong data-research-remaining>${ctx.duration(model.project.remaining)}</strong></p><div class="progress-track"><div class="progress-fill blue" data-research-progress></div></div><button class="button small ghost" data-research-cancel>Abbruch prüfen</button>` : '<p>Wähle einen Forschungszweig. Ein Projekt belegt das Labor und bindet 10 % des Projektdurchsatzes. Punktkosten werden beim Start bezahlt; ein Abbruch erstattet sie nicht.</p>'}</div></section>
      <nav class="research-tree-tabs" aria-label="Forschungszweige">${model.trees.map((t) => `<button class="button ${t.id === tree.id ? 'selected' : ''}" data-research-tree="${t.id}" aria-pressed="${t.id === tree.id}">${ctx.esc(ctx.tr(t.name))}<span>${ctx.state.lab.owned.filter((id) => model.technologies.find((n) => n.id === id)?.tree === t.id).length} / ${model.technologies.filter((n) => n.tree === t.id).length}</span></button>`).join('')}</nav>
      ${cards.researchBranch(model, selectedNode)}<div class="section-heading"><h2>Fortlaufende Forschungsreihen</h2><p>Vorhandene Stufen bleiben aktiv. Neue Stufen benötigen ihre Grundlagen und Laborzeit.</p></div><div class="card-grid">${model.repeatables.map((n) => cards.researchCard(n, model)).join('')}</div>`
    );
  }
  function researchConfirm(extra) {
    if (extra.cancel) {
      const p = ctx.state.lab.project;
      return `<p class="modal-intro">${ctx.esc(ctx.tr(p ? ctx.E.getResearch(ctx.state).project.name : 'Kein aktives Forschungsprojekt'))}</p><p>Ein Abbruch gibt das Labor frei. Bezahlte Forschungspunkte und bisherige Laborzeit gehen verloren.</p><button class="button danger block" data-research-confirm="cancel" ${p ? '' : 'disabled'}>Ohne Erstattung abbrechen</button>`;
    }
    return cards.researchDecision(extra.id);
  }
  function researchClick(target) {
    if (target.hasAttribute('data-atlas-control')) {
      atlas.control(target.dataset.atlasControl);
      return true;
    }
    if (target.hasAttribute('data-research-tree')) {
      selectedTree = target.dataset.researchTree;
      selectedNode = ctx.E.getResearch(ctx.state).technologies.find(
        (n) => n.tree === selectedTree,
      )?.id;
      ctx.render();
      atlas.focusTree(selectedTree);
      return true;
    }
    if (target.hasAttribute('data-research-focus')) {
      const n = ctx.E.getResearch(ctx.state).technologies.find(
        (n) => n.id === target.dataset.researchFocus,
      );
      if (n) {
        selectedTree = n.tree;
        selectedNode = n.id;
        const inMap = Boolean(target.closest('[data-atlas-world]'));
        ctx.render();
        if (!inMap) atlas.focus(selectedNode);
        // Reuse the funded-project decision dialog, including its prerequisite links.
        // Replacing it never stacks dialogs or starts research just by selecting a node.
        ctx.openModal('research-confirm', { id: selectedNode, returnNode: selectedNode });
      }
      return true;
    }
    if (target.hasAttribute('data-research-start')) {
      ctx.openModal('research-confirm', { id: target.dataset.researchStart });
      return true;
    }
    if (target.hasAttribute('data-research-cancel')) {
      ctx.openModal('research-confirm', { cancel: true });
      return true;
    }
    if (target.hasAttribute('data-research-confirm')) {
      const action = target.dataset.researchConfirm === 'cancel' ? 'cancelResearch' : 'buyResearch',
        id = ctx.modal?.extra?.id;
      ctx.closeModal();
      ctx.execute(action, { id });
      return true;
    }
    return false;
  }
  function researchSignature() {
    return JSON.stringify([
      ctx.state.lab.owned,
      ctx.state.lab.project?.id,
      ctx.state.lab.project?.targetLevel,
      ctx.state.upgrades,
    ]);
  }
  function updateResearch(metrics = null) {
    if (ctx.modal?.type === 'research-confirm' && !ctx.modal.extra.cancel) {
      const q = ctx.E.quoteResearch(ctx.state, ctx.modal.extra.id);
      const start = ctx.$('[data-research-confirm="start"]'),
        reason = ctx.$('[data-research-decision-reason]');
      if (q.unique && q.level > 0 && start) {
        ctx.$('#modal-root .modal-body').innerHTML = cards.researchDecision(ctx.modal.extra.id);
        ctx.$('#modal-root .modal').focus({ preventScroll: true });
        return;
      }
      if (start) start.disabled = !q.enabled;
      if (reason) reason.textContent = ctx.tr(q.reason || '');
    }
    if (ctx.view !== 'research') return;
    const model = ctx.E.getResearch(ctx.state, metrics);
    const time = ctx.$('[data-research-remaining]'),
      status = ctx.$('[data-research-status]'),
      progress = ctx.$('[data-research-progress]');
    if (time && model.project) time.textContent = ctx.duration(model.project.remaining);
    if (status)
      status.textContent = ctx.tr(
        model.project ? (model.paused ? 'Pausiert' : 'Forschung läuft') : 'Bereit',
      );
    if (progress && model.project)
      progress.style.width = 100 * (1 - model.project.remaining / model.project.total) + '%';
    for (const node of [...model.technologies, ...model.repeatables]) {
      const button = ctx.$(`[data-research-start="${node.id}"]`),
        reason = ctx.$(`[data-research-reason="${node.id}"]`);
      if (button) {
        button.disabled = !node.quote.enabled;
        button.title = ctx.tr(node.quote.reason);
      }
      if (reason)
        reason.textContent = node.quote.unique && node.quote.level ? '' : ctx.tr(node.quote.reason);
    }
  }
  function mountResearch(container) {
    const model = ctx.E.getResearch(ctx.state);
    atlas.mount(container, model, selectedNode || model.project?.id || model.technologies[0].id);
  }
  return {
    researchView,
    researchConfirm,
    researchClick,
    researchSignature,
    updateResearch,
    mountResearch,
    restoreResearchFocus: atlas.restoreFocus,
  };
}
