import { illustrationPath } from './illustrations.js';

export const MAP_SIZE = 2600;
const CENTER = MAP_SIZE / 2;
const colors = [
  '#a9cc9b',
  '#deb980',
  '#93c8b1',
  '#bda7dc',
  '#89c9df',
  '#ddae7c',
  '#95b8dc',
  '#c3c594',
];

/** Stable district positions, independent of progress, locale and viewport size. */
export function researchLayout(model) {
  const positions = new Map();
  model.trees.forEach((tree, branch) => {
    const nodes = model.technologies.filter((n) => n.tree === tree.id);
    const angle = -Math.PI / 2 + (branch * Math.PI * 2) / model.trees.length;
    const old = nodes.some((n) => !n.expansion);
    const slots = old
      ? [
          [300, 0],
          [440, -90],
          [440, 90],
          [585, 0],
          [680, -145],
          [680, 145],
          [815, -175],
          [815, 175],
          [950, -160],
          [950, 160],
          [1110, -135],
          [1110, 135],
        ]
      : [
          [300, 0],
          [440, -90],
          [440, 90],
          [585, -120],
          [585, 120],
          [730, -155],
          [730, 155],
          [875, -180],
          [875, 180],
          [990, 0],
          [1110, -135],
          [1110, 135],
        ];
    nodes.forEach((node, i) => {
      const [radial, tangent] = slots[i] || [
        1110 + 130 * (1 + Math.floor((i - 12) / 2)),
        (i % 2 ? 1 : -1) * 135,
      ];
      positions.set(node.id, {
        x: CENTER + Math.cos(angle) * radial - Math.sin(angle) * tangent,
        y: CENTER + Math.sin(angle) * radial + Math.cos(angle) * tangent,
        color: colors[branch % colors.length],
      });
    });
  });
  return positions;
}

export function researchAncestors(model, id) {
  const ids = new Set();
  const nodes = new Map(model.technologies.map((n) => [n.id, n]));
  function visit(key) {
    if (ids.has(key)) return;
    ids.add(key);
    nodes.get(key)?.requires.forEach(visit);
  }
  if (id) visit(id);
  return ids;
}

export function createResearchMap(ctx, model, selectedId) {
  const layout = researchLayout(model),
    path = researchAncestors(model, selectedId);
  const owned = new Set(ctx.state.lab.owned);
  const links = model.technologies
    .flatMap((n) =>
      n.requires.map((id) => {
        const a = layout.get(id),
          b = layout.get(n.id);
        if (!a || !b) return '';
        const cross = model.technologies.find((p) => p.id === id).tree !== n.tree;
        return `<path class="${owned.has(n.id) && owned.has(id) ? 'completed' : ''} ${path.has(n.id) && path.has(id) ? 'route' : ''} ${cross ? 'cross-branch' : ''}" d="M${a.x},${a.y} L${b.x},${b.y}"/>`;
      }),
    )
    .join('');
  const districts = model.trees
    .map((t, i) => {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / model.trees.length;
      return `<div class="research-district" style="left:${CENTER + Math.cos(angle) * 1215}px;top:${CENTER + Math.sin(angle) * 1215}px;color:${colors[i % colors.length]}">${ctx.esc(ctx.tr(t.name))}</div>`;
    })
    .join('');
  const nodes = model.technologies
    .map((n) => {
      const p = layout.get(n.id),
        complete = owned.has(n.id),
        active = model.project?.id === n.id;
      const status = complete
        ? 'Erforscht'
        : active
          ? 'In Arbeit'
          : n.quote.missing.length
            ? 'Grundlagen fehlen'
            : n.sector > ctx.state.sector
              ? 'Sektor fehlt'
              : 'Technologie ansehen';
      return `<button type="button" class="atlas-node ${n.doctrine ? 'doctrine' : ''} ${complete ? 'completed' : ''} ${active ? 'current' : ''} ${path.has(n.id) ? 'on-route' : ''}" style="left:${p.x}px;top:${p.y}px;--district:${p.color}" data-research-focus="${n.id}" aria-pressed="${n.id === selectedId}" aria-label="${ctx.esc(ctx.tr(n.name) + ' · ' + ctx.tr(status))}" title="${ctx.esc(ctx.tr(n.name) + ' · ' + ctx.tr(status))}"><img src="${illustrationPath(n.tree)}" alt="" decoding="async" draggable="false" width="64" height="64"><span class="atlas-marker" aria-hidden="true">${complete ? '✓' : active ? '◷' : n.doctrine ? '◆' : n.quote.missing.length ? '·' : '+'}</span><strong>${ctx.esc(ctx.tr(n.name))}</strong></button>`;
    })
    .join('');
  return `<section class="research-atlas" data-research-atlas><div class="atlas-toolbar"><label class="atlas-search"><span>${ctx.tr('Technologie suchen')}</span><input class="input" type="search" data-research-search autocomplete="off" placeholder="${ctx.tr('Name oder Wirkung …')}"></label><div class="atlas-controls"><button class="button small" data-atlas-control="out" aria-label="${ctx.tr('Verkleinern')}">−</button><output data-atlas-zoom>100%</output><button class="button small" data-atlas-control="in" aria-label="${ctx.tr('Vergrößern')}">+</button><button class="button small" data-atlas-control="fit">${ctx.tr('Gesamter Baum')}</button><button class="button small" data-atlas-control="selected">${ctx.tr('Auswahl zentrieren')}</button><button class="button small" data-atlas-control="expand">${ctx.tr('Fokusansicht')}</button></div></div><div class="atlas-results" data-atlas-results></div><div class="atlas-viewport" data-atlas-viewport tabindex="0" role="region" aria-label="${ctx.tr('Forschungskarte. Ziehen zum Verschieben, Mausrad zum Zoomen, Pfeiltasten zum Bewegen.')}"><div class="atlas-world" data-atlas-world style="width:${MAP_SIZE}px;height:${MAP_SIZE}px"><svg class="atlas-links" viewBox="0 0 ${MAP_SIZE} ${MAP_SIZE}" aria-hidden="true">${links}</svg><div class="atlas-core"><strong>ROOT</strong><span>${model.technologies.length} ${ctx.tr('Technologien')}</span></div>${districts}${nodes}</div></div><div class="atlas-legend"><span class="positive">● ${ctx.tr('Erforscht')}</span><span>◆ ${ctx.tr('Spezialisierung')}</span><span>─ ${ctx.tr('Voraussetzungen')}</span><span>${ctx.tr('Ziehen · Mausrad: Zoom · Pfeiltasten: Bewegen')}</span></div></section>`;
}
