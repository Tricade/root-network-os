/** Ordered capital/maintenance commitments use quotes from the same engine as immediate work. */
export function createCapitalPlanUI(ctx) {
  const names = {
    buildRoom: 'Serverraum bauen',
    buildFloor: 'Untergeschoss bauen',
    buildServiceRoom: 'Technikraum bauen',
    upgradeCentral: 'Zentralanlage ausbauen',
    upgradeRack: 'Rack ausbauen',
    convertRoomSupply: 'Raumversorgung umbauen',
    createBackup: 'Betriebssicherung',
  };
  const draft = {
    action: 'buildRoom',
    floor: 0,
    roomType: 'cooling',
    system: 'cooling',
    rackId: '',
    component: 'cooling',
    roomId: 'room-1',
    supplySystem: 'cooling',
    mode: 'central',
    delay: 0,
    ceiling: 0,
  };
  let manualCeiling = false;
  const field = (key, label, rows) =>
    `<label class="field-label">${ctx.tr(label)}<select class="select" data-capital-field="${key}">${rows.map(([v, t]) => `<option value="${ctx.esc(v)}" ${String(v) === String(draft[key]) ? 'selected' : ''}>${ctx.esc(ctx.tr(t))}</option>`).join('')}</select></label>`;
  function item() {
    const payload = {};
    if (draft.action === 'buildRoom') payload.floor = Number(draft.floor);
    if (draft.action === 'buildServiceRoom') payload.roomType = draft.roomType;
    if (draft.action === 'upgradeCentral') payload.system = draft.system;
    if (draft.action === 'upgradeRack')
      Object.assign(payload, { rackId: draft.rackId, component: draft.component });
    if (draft.action === 'convertRoomSupply')
      Object.assign(payload, {
        roomId: draft.roomId,
        system: draft.supplySystem,
        mode: draft.mode,
      });
    return {
      action: draft.action,
      payload,
      ceiling: Number(draft.ceiling),
      notBefore: ctx.state.time + Number(draft.delay),
    };
  }
  function estimate(q) {
    return `<strong>${ctx.fmt(q.cost)} CR · ${ctx.duration(q.duration || 0)}</strong><p>${ctx.esc(ctx.tr(q.description || q.label))}</p>${q.reason ? `<p class="modal-alert">${ctx.esc(ctx.tr(q.reason))}</p>` : ''}`;
  }
  function capitalMarkup() {
    const o = ctx.E.getOperations(ctx.state),
      building = ctx.state.facility.building;
    draft.rackId ||= ctx.state.facility.racks[0]?.id || '';
    draft.floor ||=
      Array.from({ length: building.floors }, (_, i) => i + 1).find(
        (floor) => building.rooms.filter((room) => room.floor === floor).length < 4,
      ) || building.floors;
    const futureFloors =
      building.floors +
      Number(building.project?.kind === 'floor') +
      o.queue.filter((i) => i.action === 'buildFloor').length;
    const q = ctx.E.quotePlannedOperation(ctx.state, item());
    if (!manualCeiling) draft.ceiling = q.cost;
    const section = (action, content) =>
      `<div data-capital-for="${action}" ${action === draft.action ? '' : 'hidden'}>${content}</div>`;
    return `<section class="panel section-spacer" data-capital-plan>${ctx.panelHeader('Ausbau- & Ablaufplan', `<button class="button small" data-capital-pause>${ctx.tr(o.paused ? 'Fortsetzen' : 'Pausieren')}</button>`)}<div class="panel-body"><p>${ctx.tr('Bau, Anlagen und Wartung laufen in deiner Reihenfolge. Bezahlt wird erst beim Start; Reserven und Freigaben bleiben verbindlich.')}</p>${o.limits.plan === 0 ? `<p class="modal-alert">${ctx.tr('Das Stundenbudget des Ablaufplans ist 0. Lege oben ein Budget fest, damit Maßnahmen starten können.')}</p>` : ''}<div class="business-controls">${field('action', 'Maßnahme', Object.entries(names))}${section(
      'buildRoom',
      field(
        'floor',
        'Untergeschoss',
        Array.from({ length: Math.min(1000, futureFloors) }, (_, i) => [
          i + 1,
          `Untergeschoss ${i + 1}`,
        ]),
      ),
    )}${section(
      'buildServiceRoom',
      field('roomType', 'Technikraum', [
        ['control', 'Kontrollraum'],
        ['cooling', 'Zentrale Kühlung'],
        ['ups', 'USV'],
        ['distribution', 'Stromverteilung'],
      ]),
    )}${section(
      'upgradeCentral',
      field('system', 'Zentralanlage', [
        ['cooling', 'Zentrale Kühlung'],
        ['ups', 'USV'],
        ['distribution', 'Stromverteilung'],
      ]),
    )}${section(
      'upgradeRack',
      field(
        'rackId',
        'Rack',
        ctx.state.facility.racks.map((r) => [r.id, r.name]),
      ) +
        field('component', 'Komponente', [
          ['power', 'Strom'],
          ['cooling', 'Kühlung'],
          ['switch', 'Switch'],
        ]),
    )}${section(
      'convertRoomSupply',
      field(
        'roomId',
        'Raum',
        building.rooms.map((r) => [r.id, `Raum ${r.id.slice(5)}`]),
      ) +
        field('supplySystem', 'System', [
          ['cooling', 'Kühlung'],
          ['power', 'Strom'],
        ]) +
        field('mode', 'Zielversorgung', [
          ['local', 'Lokal'],
          ['central', 'Zentral'],
          ['hybrid', 'Zentral mit lokaler Reserve'],
          ...(draft.supplySystem === 'power' ? [['ups', 'Lokaler Strom mit zentraler USV']] : []),
        ]),
    )}${field('delay', 'Frühester Start', [
      [0, 'Sobald Voraussetzungen erfüllt sind'],
      [3600, 'In 1 Stunde'],
      [14400, 'In 4 Stunden'],
      [43200, 'In 12 Stunden'],
      [86400, 'In 1 Tag'],
    ])}<label class="field-label">${ctx.tr('Maximalpreis beim Start')}<input class="input" data-capital-field="ceiling" type="number" min="0" max="200000000000000" step="1" value="${draft.ceiling}"></label></div><div class="capital-estimate" data-capital-estimate>${estimate(q)}</div><button class="button primary" data-capital-add ${o.queue.length >= 12 ? 'disabled' : ''}>${ctx.tr('Maßnahme einplanen')}</button><ol class="operations-queue">${o.queue.map((entry, index) => `<li><div><strong>${ctx.esc(ctx.tr(entry.quote.label || names[entry.action]))}</strong><p>${ctx.tr('Preisfreigabe')}: ${ctx.fmt(entry.ceiling)} CR · ${ctx.tr('Schätzung')}: ${ctx.fmt(entry.quote.cost)} CR</p><p>${ctx.esc(ctx.tr(entry.reason || 'Wartet auf Ausführung.'))}${entry.notBefore > ctx.state.time ? ' · ' + ctx.duration(entry.notBefore - ctx.state.time) : ''}</p></div><div class="card-actions"><button class="button small" data-capital-move="-1" data-id="${entry.id}" aria-label="${ctx.tr('Nach oben')}" ${index === 0 ? 'disabled' : ''}>↑</button><button class="button small" data-capital-move="1" data-id="${entry.id}" aria-label="${ctx.tr('Nach unten')}" ${index === o.queue.length - 1 ? 'disabled' : ''}>↓</button><button class="button small" data-capital-remove="${entry.id}">${ctx.tr('Entfernen')}</button></div></li>`).join('') || `<li>${ctx.tr('Keine Maßnahmen eingeplant.')}</li>`}</ol></div></section>`;
  }
  function capitalClick(target) {
    if (target.hasAttribute('data-capital-add')) {
      ctx.openModal('operations-confirm', { action: 'queueOperation', payload: item() });
      return true;
    }
    if (target.hasAttribute('data-capital-pause')) {
      ctx.execute('pauseOperations', { value: !ctx.state.operations.paused });
      return true;
    }
    if (target.hasAttribute('data-capital-move')) {
      ctx.execute('movePlannedOperation', {
        id: target.dataset.id,
        direction: Number(target.dataset.capitalMove),
      });
      return true;
    }
    if (target.hasAttribute('data-capital-remove')) {
      ctx.execute('cancelPlannedOperation', { id: target.dataset.capitalRemove });
      return true;
    }
    return false;
  }
  function capitalChange(target) {
    if (!target.hasAttribute('data-capital-field')) return false;
    draft[target.dataset.capitalField] = target.value;
    if (target.dataset.capitalField === 'ceiling') manualCeiling = true;
    else if (target.dataset.capitalField !== 'delay') manualCeiling = false;
    if (draft.supplySystem === 'cooling' && draft.mode === 'ups') draft.mode = 'local';
    target.blur();
    ctx.render();
    return true;
  }
  return { capitalMarkup, capitalClick, capitalChange };
}
