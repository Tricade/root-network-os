import { MAP_SIZE, researchLayout } from './research-map.js';

export function zoomResearchCamera(camera, factor, point, min = 0.12, max = 1.4) {
  const scale = Math.min(max, Math.max(min, camera.scale * factor));
  const ratio = scale / camera.scale;
  return {
    scale,
    x: point.x - (point.x - camera.x) * ratio,
    y: point.y - (point.y - camera.y) * ratio,
  };
}

/** UI-only camera. Remounts cancel listeners; pointer cancellation never leaves a drag active. */
export function createResearchMapInput(ctx) {
  let expanded = false,
    restoringFocus = false;
  let camera = null,
    controller = null,
    search = '',
    model = null,
    selected = null;
  let viewport = null,
    world = null,
    layout = null;
  function apply() {
    if (!world || !camera) return;
    // Keep some part of the tree reachable even after a long drag.
    camera.x = Math.max(
      -MAP_SIZE * camera.scale + 60,
      Math.min(viewport.clientWidth - 60, camera.x),
    );
    camera.y = Math.max(
      -MAP_SIZE * camera.scale + 60,
      Math.min(viewport.clientHeight - 60, camera.y),
    );
    world.style.transform = `translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`;
    viewport.classList.toggle('atlas-close', camera.scale >= 0.55);
    viewport.closest('[data-research-atlas]').querySelector('[data-atlas-zoom]').textContent =
      Math.round(camera.scale * 100) + '%';
  }
  function center(x, y, scale) {
    if (!viewport) return;
    camera = {
      scale,
      x: viewport.clientWidth / 2 - x * scale,
      y: viewport.clientHeight / 2 - y * scale,
    };
    apply();
  }
  function fit() {
    if (viewport)
      center(
        MAP_SIZE / 2,
        MAP_SIZE / 2,
        Math.max(0.12, (Math.min(viewport.clientWidth, viewport.clientHeight) / MAP_SIZE) * 0.84),
      );
  }
  function focus(id, scale = 0.72) {
    const p = layout?.get(id);
    if (p) center(p.x, p.y, scale);
  }
  function filter() {
    const query = search.trim().toLocaleLowerCase();
    const hits = model.technologies.filter((n) =>
      [
        n.name,
        ctx.tr(n.name),
        ctx.tr(n.description),
        ctx.tr(model.trees.find((t) => t.id === n.tree).name),
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query),
    );
    const ids = new Set(hits.map((n) => n.id));
    world
      .querySelectorAll('[data-research-focus]')
      .forEach((el) =>
        el.classList.toggle('search-muted', Boolean(query) && !ids.has(el.dataset.researchFocus)),
      );
    const results = viewport.closest('[data-research-atlas]').querySelector('[data-atlas-results]');
    results.innerHTML = query
      ? `<span role="status">${hits.length} ${ctx.tr('Treffer')}</span>${hits
          .slice(0, 12)
          .map(
            (n) =>
              `<button class="text-button" data-research-focus="${n.id}">${ctx.esc(ctx.tr(n.name))}</button>`,
          )
          .join('')}`
      : '';
  }
  function mount(container, nextModel, selectedId) {
    controller?.abort();
    controller = null;
    model = nextModel;
    selected = selectedId;
    viewport = container?.querySelector('[data-atlas-viewport]');
    world = container?.querySelector('[data-atlas-world]');
    if (!viewport || !world) return;
    layout = researchLayout(model);
    controller = new AbortController();
    const signal = controller.signal;
    const atlas = viewport.closest('[data-research-atlas]');
    const workspace = atlas.closest('.research-workspace');
    workspace.classList.toggle('atlas-expanded', expanded);
    atlas.querySelector('[data-atlas-control=expand]').textContent = ctx.tr(
      expanded ? 'Fokusansicht schließen' : 'Fokusansicht',
    );
    document.addEventListener(
      'keydown',
      (event) => {
        // A research confirmation has its own focus trap and Escape handling above the map.
        if (!expanded || ctx.modal) return;
        if (event.key === 'Escape') {
          control('expand');
          atlas.querySelector('[data-atlas-control=expand]').focus();
          event.preventDefault();
          event.stopImmediatePropagation();
        } else if (event.key === 'Tab') {
          const controls = [
            ...workspace.querySelectorAll('button:not(:disabled), input, [tabindex="0"]'),
          ].filter((element) => element.getClientRects().length);
          const first = controls[0],
            last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            last?.focus();
            event.preventDefault();
          } else if (!event.shiftKey && document.activeElement === last) {
            first?.focus();
            event.preventDefault();
          }
        }
      },
      { signal, capture: true },
    );
    const input = atlas.querySelector('[data-research-search]');
    input.value = search;
    input.addEventListener(
      'input',
      () => {
        search = input.value;
        filter();
      },
      { signal },
    );
    if (!camera) fit();
    else apply();
    filter();
    let drag = null,
      suppressClick = false;
    const stop = () => {
      drag = null;
      viewport.classList.remove('dragging');
    };
    viewport.addEventListener(
      'pointerdown',
      (event) => {
        if (event.button !== 0) return;
        drag = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          startX: event.clientX,
          startY: event.clientY,
        };
        suppressClick = false;
        (event.target.closest('button') || viewport).setPointerCapture(event.pointerId);
      },
      { signal },
    );
    viewport.addEventListener(
      'pointermove',
      (event) => {
        if (!drag || drag.id !== event.pointerId) return;
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5)
          suppressClick = true;
        if (suppressClick) {
          camera.x += event.clientX - drag.x;
          camera.y += event.clientY - drag.y;
          viewport.classList.add('dragging');
          apply();
          event.preventDefault();
        }
        drag.x = event.clientX;
        drag.y = event.clientY;
      },
      { signal },
    );
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
      viewport.addEventListener(name, stop, { signal });
    viewport.addEventListener(
      'click',
      (event) => {
        if (suppressClick) {
          event.preventDefault();
          event.stopPropagation();
          suppressClick = false;
        }
      },
      { signal, capture: true },
    );
    viewport.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        const rect = viewport.getBoundingClientRect();
        camera = zoomResearchCamera(
          camera,
          Math.exp(-Math.max(-160, Math.min(160, event.deltaY)) * 0.002),
          { x: event.clientX - rect.left, y: event.clientY - rect.top },
        );
        apply();
      },
      { signal, passive: false },
    );
    viewport.addEventListener(
      'keydown',
      (event) => {
        if (event.target !== viewport) return;
        const moves = {
          ArrowLeft: [70, 0],
          ArrowRight: [-70, 0],
          ArrowUp: [0, 70],
          ArrowDown: [0, -70],
        };
        if (moves[event.key]) {
          camera.x += moves[event.key][0];
          camera.y += moves[event.key][1];
          apply();
        } else if (event.key === 'Home') fit();
        else if (event.key === '+' || event.key === '=') control('in');
        else if (event.key === '-') control('out');
        else return;
        event.preventDefault();
        event.stopPropagation();
      },
      { signal },
    );
    // Keyboard users can tab to any node; keep that node in the viewport.
    world.addEventListener(
      'focusin',
      (event) => {
        const id = event.target.dataset.researchFocus;
        if (id && !drag && !restoringFocus) focus(id);
      },
      { signal },
    );
    window.addEventListener('blur', stop, { signal });
  }
  function control(action) {
    if (!viewport) return;
    if (action === 'expand') {
      expanded = !expanded;
      viewport.closest('.research-workspace').classList.toggle('atlas-expanded', expanded);
      viewport
        .closest('[data-research-atlas]')
        .querySelector('[data-atlas-control=expand]').textContent = ctx.tr(
        expanded ? 'Fokusansicht schließen' : 'Fokusansicht',
      );
      fit();
      return;
    }
    if (action === 'fit') return fit();
    if (action === 'selected') return focus(selected);
    camera = zoomResearchCamera(camera, action === 'in' ? 1.3 : 1 / 1.3, {
      x: viewport.clientWidth / 2,
      y: viewport.clientHeight / 2,
    });
    apply();
  }
  function focusTree(id) {
    if (!layout || !viewport) return;
    const points = model.technologies.filter((n) => n.tree === id).map((n) => layout.get(n.id));
    if (!points.length) return;
    const xs = points.map((p) => p.x),
      ys = points.map((p) => p.y);
    const minX = Math.min(...xs) - 100,
      maxX = Math.max(...xs) + 100,
      minY = Math.min(...ys) - 100,
      maxY = Math.max(...ys) + 100;
    center(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      Math.min(0.85, viewport.clientWidth / (maxX - minX), viewport.clientHeight / (maxY - minY)) *
        0.88,
    );
  }
  function restoreFocus(id) {
    const button = world?.querySelector(`[data-research-focus="${id}"]`);
    if (!button?.isConnected) return false;
    // Returning from details must not zoom the map or scroll the page.
    restoringFocus = true;
    button.focus({ preventScroll: true });
    restoringFocus = false;
    return true;
  }
  return { mount, control, focus, fit, focusTree, restoreFocus };
}
