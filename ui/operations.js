import { createCapitalPlanUI } from './capital-plan.js';

/** Operations UI keeps planning separate from immediate, explicitly quoted work. */

export function createOperationsUI(ctx) {
  const capital = createCapitalPlanUI(ctx);
  let activeSection = 'budget';
  const drafts = new Map();
  const sections = {
    budget: 'Budgets & Beschaffung',
    capital: 'Ausbauplan',
    maintenance: 'Wartungsplanung',
    projects: 'Agentenprojekte',
  };
  const section = (key, markup) =>
    `<div class="operations-section ${activeSection === key ? '' : 'is-inactive'}" data-ops-panel="${key}">${markup}</div>`;
  function resetOperationsDrafts() {
    drafts.clear();
    activeSection = 'budget';
    capital.resetCapitalDraft();
  }
  function selectOperationsSection(key) {
    if (!Object.hasOwn(sections, key)) return false;
    activeSection = key;
    ctx
      .$$('[data-ops-panel]')
      .forEach((el) => el.classList.toggle('is-inactive', el.dataset.opsPanel !== key));
    ctx
      .$$('[data-ops-section]')
      .forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.opsSection === key)));
    return true;
  }
  function operationsInput(el) {
    if (!el.hasAttribute('data-ops-field')) return false;
    drafts.set(el.dataset.opsField, el.type === 'checkbox' ? el.checked : el.value);
    return true;
  }

  const numeric = (key, label, value) =>
    `<label class="field-label">${ctx.tr(label)}<input class="input" data-ops-field="${key}" type="number" min="0" max="200000000000000" step="1" value="${ctx.esc(String(drafts.get(key) ?? value))}"></label>`;

  const select = (key, label, rows) =>
    `<label class="field-label">${ctx.tr(label)}<select class="select" data-ops-field="${key}">${rows.map(([v, t]) => `<option value="${ctx.esc(v)}" ${key === 'mode' && v === 'ups' ? 'disabled' : ''} ${String(drafts.get(key)) === String(v) ? 'selected' : ''}>${ctx.esc(ctx.tr(t))}</option>`).join('')}</select></label>`;

  const button = (action, label, extra = '') =>
    `<button class="button" data-ops="${action}" ${extra}>${ctx.tr(label)}</button>`;

  function deliveries(orders) {
    if (!orders.length)
      return `<p class="policy-explainer">${ctx.tr('Keine Lieferungen unterwegs.')}</p>`;

    return orders

      .map(
        (order, index) =>
          `<article class="delivery-card" data-delivery="${index}"><header><strong>${ctx.fmt(order.quantity)} ${ctx.tr(order.quantity === 1 ? 'Ersatzteil unterwegs' : 'Ersatzteile unterwegs')}</strong><span class="tag">${ctx.tr(order.method === 'express' ? 'Expresslieferung' : 'Standardlieferung')}</span></header><p>${ctx.tr('Ankunft in')} <strong data-delivery-eta></strong></p><progress max="100" value="0" aria-label="${ctx.tr('Lieferfortschritt')}"></progress></article>`,
      )

      .join('');
  }

  function operationsView() {
    const o = ctx.E.getOperations(ctx.state);

    return (
      ctx.head(
        'Betriebspläne',

        'Budgets, Lieferungen und Projekte laufen auch während deiner Abwesenheit weiter.',
      ) +
      `<nav class="operations-sections" aria-label="${ctx.tr('Bereiche der Betriebsplanung')}">${Object.entries(
        sections,
      )
        .map(
          ([key, label]) =>
            `<button class="button" data-ops-section="${key}" aria-pressed="${activeSection === key}"><strong>${ctx.tr(label)}</strong><small data-ops-summary="${key}"></small></button>`,
        )
        .join('')}</nav>` +
      section(
        'budget',
        `<div class="policy-grid operations-grid"><section class="panel" data-ops-form="limits">${ctx.panelHeader('Budgets & Reserven')}<div class="panel-body"><div class="business-controls">${[
          ['repair', 'Reparaturen / Stunde'],

          ['backup', 'Backups / Stunde'],

          ['parts', 'Beschaffung / Stunde'],

          ['plan', 'Ablaufplan / Stunde'],

          ['reserve', 'Geschützte Geldreserve'],

          ['savings', 'Sparziel für Ausbau'],
        ]

          .map(([key, label]) => numeric(key, label, o.limits[key]))

          .join(
            '',
          )}</div><p data-ops-spent></p><p class="policy-explainer"><span>Budget für vier Sicherungen pro Stunde:</span> <strong data-ops-backup-budget></strong></p><p class="policy-explainer">Wartung nutzt die Geldreserve als Untergrenze. Geplante Ausbauten schützen zusätzlich dein Sparziel. Änderungen setzen verbrauchte Stundenbudgets nicht zurück.</p><div class="operations-policy-footer">${numeric('partsTarget', 'Zielbestand Ersatzteile', o.partsTarget)}<label class="field-label operations-check"><input data-ops-field="autoParts" type="checkbox" ${(drafts.get('autoParts') ?? o.autoParts) ? 'checked' : ''}> ${ctx.tr('Ersatzteile automatisch nachbestellen')}</label>${button('policy', 'Betriebsplan speichern')}</div></div></section>` +
          `<section class="panel" data-ops-form="delivery">${ctx.panelHeader('Ersatzteillogistik')}<div class="panel-body"><p data-ops-stock></p><div class="business-controls">${numeric('quantity', 'Bestellmenge', 3)}${select(
            'method',

            'Lieferung',

            [
              ['standard', 'Standard · 30 Minuten'],

              ['express', 'Express · 5 Minuten · doppelter Preis'],
            ],
          )}</div>${button('delivery', 'Bestellung prüfen')}<div class="deliveries">${deliveries(o.orders)}</div><p class="policy-explainer">Jeder Serverraum erweitert das Lager. Höchstens zwei Lieferungen können gleichzeitig unterwegs sein.</p></div></section></div>`,
      ) +
      section('capital', capital.capitalMarkup()) +
      section('maintenance', ctx.preventiveMarkup()) +
      section(
        'projects',
        `<section class="panel" data-ops-form="project">${ctx.panelHeader('Agentenprojekte')}<div class="panel-body"><p>Während eines Projekts entfallen der normale Beitrag und die Teamleitung dieses Agenten. Die zugesagte Belohnung bleibt bis zum Abschluss fest.</p><div class="business-controls">${select(
          'id',

          'Agent',

          ctx.state.agents.map((a) => [a.id, a.name]),
        )}${select('kind', 'Projekt', [
          ['audit', 'Betriebsaudit'],

          ['research', 'Forschungsprojekt'],

          ['tuning', 'Kapazitätsanalyse'],
        ])}${button('project', 'Projekt prüfen')}</div><div data-ops-projects></div></div></section>`,
      )
    );
  }

  function read(form, key) {
    return form.querySelector(`[data-ops-field="${key}"]`)?.value;
  }

  function operationsClick(target) {
    if (target.hasAttribute('data-ops-section')) {
      if (selectOperationsSection(target.dataset.opsSection) && ctx.view !== 'operations')
        ctx.navigate('operations');
      return true;
    }
    if (target.hasAttribute('data-ops-confirm')) {
      const extra = ctx.modal?.extra;

      if (ctx.modal?.type !== 'operations-confirm' || !extra) return true;

      ctx.closeModal();

      ctx.execute(extra.action, extra.payload);

      return true;
    }

    if (capital.capitalClick(target)) return true;

    const command = target.dataset.ops;

    if (!command) return false;

    const form = target.closest('[data-ops-form]');

    if (command === 'policy') {
      const p = {};

      for (const key of ['repair', 'backup', 'parts', 'plan', 'reserve', 'savings', 'partsTarget'])
        p[key] = Number(read(form, key));

      p.autoParts = form.querySelector('[data-ops-field="autoParts"]').checked;

      ctx.execute('setOperationsPolicy', p);
    }

    if (command === 'pause')
      ctx.execute('pauseOperations', { value: target.dataset.value === 'true' });

    if (command === 'cancel') ctx.execute('cancelPlannedOperation', { id: target.dataset.id });

    if (command === 'delivery')
      ctx.openModal('operations-confirm', {
        action: 'orderParts',

        payload: { quantity: Number(read(form, 'quantity')), method: read(form, 'method') },
      });

    if (command === 'project')
      ctx.openModal('operations-confirm', {
        action: 'startProject',

        payload: { id: read(form, 'id'), kind: read(form, 'kind') },
      });

    if (command === 'queue') {
      const action = read(form, 'action'),
        payload = {};

      if (action === 'upgradeRack') {
        payload.rackId = read(form, 'rackId');

        payload.component = read(form, 'component');
      }

      if (action === 'upgradeCentral') payload.system = read(form, 'system');

      if (action === 'convertRoomSupply') {
        payload.roomId = read(form, 'roomId');

        payload.system = read(form, 'supplySystem');

        payload.mode = read(form, 'mode');
      }

      ctx.openModal('operations-confirm', {
        action: 'queueOperation',

        payload: { action, payload, ceiling: Number(read(form, 'ceiling')) },
      });
    }

    return true;
  }

  function operationsChange(el) {
    operationsInput(el);
    if (capital.capitalChange(el)) return true;

    if (el.matches('[data-ops-field="supplySystem"]')) {
      const mode = el.closest('[data-ops-form]').querySelector('[data-ops-field="mode"]');

      mode.querySelector('[value="ups"]').disabled = el.value !== 'power';

      if (el.value !== 'power' && mode.value === 'ups') mode.value = 'local';

      return true;
    }

    if (!el.matches('[data-ops-field="action"]')) return false;

    for (const section of el.closest('[data-ops-form]').querySelectorAll('[data-plan-for]'))
      section.hidden = section.dataset.planFor !== el.value;

    return true;
  }

  function operationsConfirm(extra) {
    let q;

    if (extra.action === 'orderParts') q = ctx.E.quoteDelivery(ctx.state, extra.payload);
    else if (extra.action === 'startProject') q = ctx.E.quoteProject(ctx.state, extra.payload);
    else {
      const p = extra.payload;

      q = ctx.E.quotePlannedOperation(ctx.state, p);
    }

    const planned = extra.action === 'queueOperation';

    return `<p class="modal-intro">${ctx.esc(ctx.tr(q.label || 'Maßnahme prüfen'))}</p><div class="status-row"><span>${ctx.tr(planned ? 'Preis beim geplanten Start (Schätzung)' : 'Kosten jetzt')}</span><strong>${ctx.fmt(q.cost || 0)} CR</strong></div><div class="status-row"><span>Dauer</span><strong>${ctx.duration(q.duration || 0)}</strong></div>${q.research !== undefined ? `<p>${ctx.fmt(q.research)} ${ctx.tr('FP')} · ${ctx.fmt(q.reputation)} ${ctx.tr('Ansehen')}</p><p>Regulärer Beitrag und Teamleitung pausieren während dieses Projekts.</p>` : ''}${planned ? '<p>Die Aufnahme in den Plan kostet nichts. Bei Ausführung werden Preis, Voraussetzungen, Stundenbudget und Reserven erneut geprüft. Ausbauten und Umbauten unterbrechen den betroffenen Bereich.</p>' : ''}${q.reason ? `<p class="modal-alert">${ctx.esc(ctx.tr(q.reason))}</p>` : ''}<button class="button primary block" data-ops-confirm ${planned ? (q.canSchedule ? '' : 'disabled') : !q.enabled ? 'disabled' : ''}>${ctx.tr('Bestätigen')}</button>`;
  }

  function operationsSignature() {
    if (ctx.view !== 'operations') return '';

    const o = ctx.state.operations;

    return JSON.stringify([
      o.limits,

      o.autoParts,

      o.partsTarget,

      o.paused,

      o.queue,

      o.orders.map((x) => x.arrivalAt),

      o.projects.map((x) => x.agentId),
    ]);
  }

  function updateOperations() {
    if (ctx.view !== 'operations') return;

    const o = ctx.E.getOperations(ctx.state),
      put = (key, value) =>
        ctx.$$('.view-content [data-ops-' + key + ']').forEach((el) => (el.textContent = value));

    put(
      'spent',

      `${ctx.tr('Verbraucht')}: ` +
        [
          ['Reparaturen', o.repairSpent],

          ['Backups', o.backupSpent],

          ['Beschaffung', o.partsSpent],

          ['Ablaufplan', o.planSpent],
        ]

          .map(([label, amount]) => `${ctx.tr(label)} ${ctx.fmt(amount)} CR`)

          .join(' · '),
    );

    const summary = {
      budget: `${o.orders.length} ${ctx.tr('Lieferungen')}`,
      capital: `${o.queue.length} ${ctx.tr('Geplante Maßnahmen')}`,
      maintenance: ctx.tr(
        ctx.state.preventiveMaintenance.operation
          ? 'Wartung läuft'
          : ctx.state.preventiveMaintenance.schedule
            ? 'Wartung geplant'
            : 'Keine Wartung geplant',
      ),
      projects: `${o.projects.length} ${ctx.tr('Aktive Projekte')}`,
    };
    ctx.$$('[data-ops-summary]').forEach((el) => (el.textContent = summary[el.dataset.opsSummary]));
    put('backup-budget', ctx.fmt(ctx.E.getResilience(ctx.state).backup.cost * 4) + ' CR');

    put(
      'stock',

      `${ctx.tr('Ersatzteile im Lager')}: ${ctx.fmt(ctx.state.resilience.parts)} / ${ctx.fmt(o.partsCapacity)}`,
    );

    ctx.$$('.view-content [data-delivery]').forEach((el) => {
      const order = o.orders[Number(el.dataset.delivery)];

      if (!order) return;

      const duration = order.method === 'express' ? 300 : 1800;

      const remaining = Math.max(0, Math.min(duration, order.arrivalAt - ctx.state.time));

      el.querySelector('[data-delivery-eta]').textContent = ctx.duration(remaining);

      el.querySelector('progress').value = 100 * (1 - remaining / duration);
    });

    put(
      'projects',

      o.projects

        .map(
          (x) =>
            `${ctx.state.agents.find((a) => a.id === x.agentId)?.name}: ${ctx.tr({ audit: 'Betriebsaudit', research: 'Forschungsprojekt', tuning: 'Kapazitätsanalyse' }[x.kind])} · ${ctx.duration(x.remaining)}`,
        )

        .join(' | '),
    );
  }

  return {
    operationsView,
    resetOperationsDrafts,
    selectOperationsSection,
    operationsInput,

    operationsClick,

    operationsChange,

    operationsConfirm,

    operationsSignature,

    updateOperations,
  };
}
