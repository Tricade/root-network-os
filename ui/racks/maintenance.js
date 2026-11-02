/** A small explicit draft: no debit or downtime until the final action succeeds. */
export function createRackMaintenanceUI(ctx) {
  let draft = null;
  const t = (value) => ctx.esc(ctx.tr(value));
  function maintenanceModal(payload) {
    draft = { rackId: payload.rackId, components: [payload.component || 'power'], announce: false };
    const rack = ctx.state().facility.racks.find((r) => r.id === draft.rackId);
    if (!rack) return '';
    return `<div class="maintenance-planner" data-maintenance-planner><p>${t('Bis zu drei Komponenten, ein gemeinsamer Stillstand. Jede Komponente steigt um eine Stufe; Kosten und Arbeitszeiten werden addiert.')}</p><fieldset><legend>${t('Komponenten')}</legend>${Object.entries(
      ctx.componentNames,
    )
      .map(([key, name]) => {
        const q = ctx.E.quoteHardware(ctx.state(), 'upgradeRack', {
          rackId: rack.id,
          component: key,
        });
        return `<label class="maintenance-choice"><input type="checkbox" data-rack-change="maintenance-component" value="${key}" ${draft.components.includes(key) ? 'checked' : ''}><span><strong>${t(name)}</strong><small>${t('Stufe')} ${rack[key + 'Level']} → ${rack[key + 'Level'] + 1} · ${ctx.fmt(q.cost)} CR · ${ctx.duration(q.duration)}</small>${q.reason ? `<small>${t(q.reason)}</small>` : ''}</span></label>`;
      })
      .join(
        '',
      )}</fieldset><label class="maintenance-choice"><input type="checkbox" data-rack-change="maintenance-notice"><span><strong>${t('Kunden vorab informieren (optional)')}</strong><small>${t('Simulierte Kundenmail gegen Credits. Das Rack bleibt während des Vorlaufs online. Anschließend sinkt die Zufriedenheit durch diese Wartung 50 % langsamer. SLA und Lieferausfälle zählen weiterhin.')}</small></span></label><div data-maintenance-summary></div></div>`;
  }
  function maintenanceSummary() {
    if (!draft) return '';
    const q = ctx.E.quoteHardware(ctx.state(), 'upgradeRackBatch', draft);
    return `<dl class="maintenance-costs"><div><dt>${t('Ausbauten')}</dt><dd>${ctx.fmt(q.upgradeCost || 0)} CR</dd></div><div><dt>${t('Kundenankündigung')}</dt><dd>${ctx.fmt(q.noticeFee)} CR${draft.announce ? ` · ${q.affected.length} ${t(q.affected.length === 1 ? 'Kunde' : 'Kunden')}` : ''}</dd></div><div><dt>${t('Vorlauf / Stillstand')}</dt><dd>${ctx.duration(q.noticeLead)} / ${ctx.duration(q.duration)}</dd></div><div><dt>${t('Gesamt')}</dt><dd>${ctx.fmt(q.cost)} CR</dd></div></dl>${(q.warnings || []).map((w) => `<p class="modal-alert">${t(w)}</p>`).join('')}<p class="hardware-confirm-reason" role="status">${t(q.reason || '')}</p>${ctx.button('upgradeRackBatch', draft, ctx.tr('Wartungsfenster starten'), 'primary')}`;
  }
  function updateMaintenance() {
    const node = document.querySelector('[data-maintenance-summary]');
    if (!node) return;
    const markup = maintenanceSummary();
    if (node._maintenanceMarkup !== markup) {
      node.innerHTML = markup;
      node._maintenanceMarkup = markup;
    }
  }
  function maintenanceChange(el) {
    if (!draft || !['maintenance-component', 'maintenance-notice'].includes(el.dataset.rackChange))
      return false;
    if (el.dataset.rackChange === 'maintenance-notice') draft.announce = el.checked;
    else
      draft.components = [
        ...el
          .closest('[data-maintenance-planner]')
          .querySelectorAll('[data-rack-change="maintenance-component"]:checked'),
      ].map((input) => input.value);
    updateMaintenance();
    return true;
  }
  return { maintenanceModal, maintenanceChange, updateMaintenance };
}
