import { createFacilityNavigator } from './facility-navigator.js';
import { roomArt } from './facility-art.js';

/** Building ownership and utility controls. Timers update existing elements, never whole cards. */
export function createFacilityUI(ctx) {
  let selectedFloor = 1;
  const { E, esc, fmt, dec, duration, icon, tr } = ctx;
  const navigator = createFacilityNavigator(ctx, { selectFloor: selectFacilityFloor });
  const details = {
    cooling:
      'Zentrale Kühlleistung wird nur auf angeschlossene aktive Racks verteilt. Die Anlage benötigt selbst Strom; Temperaturen sinken allmählich.',
    ups: 'Die USV schützt nur die Last innerhalb ihrer Leistungskapazität. Sie senkt Wahrscheinlichkeit und Schwere von Stromausfällen.',
    distribution:
      'Das zentrale Strombudget wird nur auf angeschlossene aktive Racks verteilt. Lokale Reserve bleibt nur bei Hybridversorgung verfügbar.',
  };

  function quoteButton(action, payload, quote, label = 'Bau prüfen') {
    return `<div class="hardware-quote building-quote">
      <strong>${fmt(quote.cost)} CR <span>· ${duration(quote.duration)}</span></strong>
      <p>${esc(quote.description)}</p>
      <button class="button primary" data-hw-action="${action}" data-hw-payload="${esc(JSON.stringify(payload))}" data-hw-confirm="true" ${quote.enabled ? '' : 'disabled'}>${esc(label)}</button>
      <small data-hw-reason>${esc(quote.reason || '')}</small>
    </div>`;
  }

  function projectPanel(project) {
    return `<section class="panel building-project" data-building-project ${project ? '' : 'hidden'}>
      <div><span class="eyebrow">BAUSTELLE / VERGEBENER AUFTRAG</span><h2 data-building-title>${esc(project?.label || '')}</h2>
      <p>Bestehender Betrieb, Backups und Reparaturen bleiben verfügbar.</p></div>
      <div class="building-project-time"><strong data-building-time>${project ? duration(project.remaining) : ''}</strong><span>Verbleibende Bauzeit</span></div>
      <div class="progress-track"><div class="progress-fill" data-building-progress style="width:${project ? project.progress * 100 : 0}%"></div></div>
    </section>`;
  }

  function roomPlan(layout, building) {
    selectedFloor = Math.max(1, Math.min(selectedFloor, layout.floorCount));
    const floor = building.floors[selectedFloor - 1];
    const rooms = layout.rooms.filter((room) => room.floor === selectedFloor);
    const plots = Array.from({ length: layout.roomsPerFloor }, (_, i) => {
      const room = rooms[i];
      if (room)
        return `<article class="building-plot owned">${roomArt('server', 'ready')}<span class="tag">Gebaut</span><h3>Raum ${room.number}</h3><p>${room.rackCount} / 6 Racks · ${room.serverCount} Server</p>
        <div class="building-rack-slots" aria-hidden="true">${Array.from({ length: 6 }, (_, n) => `<i class="${n < room.rackCount ? 'filled' : ''}"></i>`).join('')}</div>
        <button class="button small" data-facility-visit="${room.id}" data-facility-floor="${room.floor}">Raum betreten${icon('arrow')}</button>
        <button class="text-button" data-facility-node="room:${room.id}">Raum auswählen</button><button class="text-button" data-building-hardware="${room.id}">Hardware verwalten</button></article>`;
      const inBuild =
        i === rooms.length &&
        building.project?.kind === 'room' &&
        building.project.floor === selectedFloor;
      return `<article class="building-plot ${inBuild ? 'under-construction' : 'vacant'}">${roomArt('server', inBuild ? 'building' : 'planned')}<span class="tag">${inBuild ? 'Im Bau' : 'Unbebaut'}</span><h3>Bauplatz ${i + 1}</h3><p>${inBuild ? 'Der neue Serverraum wird erschlossen.' : 'Unterirdische Fläche für einen weiteren Serverraum.'}</p></article>`;
    }).join('');
    return `<section class="panel section-spacer building-plan"><div class="panel-body">
      <div class="building-section-heading"><div><h2>Raumplan</h2><p>Räume und Untergeschosse werden separat gebaut. Ein leerer Raum bietet sechs Rackplätze.</p></div>
      <label>Untergeschoss<select class="select" data-building-floor>${building.floors.map((item) => `<option value="${item.number}" ${item.number === selectedFloor ? 'selected' : ''}>${item.number} · ${item.roomCount} / 4 Räume</option>`).join('')}</select></label>
      <button class="button small" data-facility-visit="hall" data-facility-floor="${selectedFloor}">Flur betreten${icon('arrow')}</button></div>
      <div class="building-plots">${plots}</div>
      ${floor.roomCount < 4 ? quoteButton('buildRoom', { floor: selectedFloor }, floor.buyRoom, 'Serverraum planen') : '<p class="building-capacity-note">Vier Serverräume auf dieser Etage gebaut. Weitere Flächen benötigen ein neues Untergeschoss.</p>'}
    </div></section>`;
  }

  function serviceRooms(building) {
    return `<section class="panel section-spacer"><div class="panel-body"><h2>Kontrollraum & Technikflügel</h2><p>Diese Räume liegen einmalig auf Untergeschoss 1. Anlagen und Geräte werden danach separat installiert.</p>
      <div class="building-service-grid">${building.serviceRooms
        .map(
          (room) =>
            `<article class="building-service">${roomArt(room.id, room.owned ? 'ready' : building.project?.roomType === room.id ? 'building' : 'planned')}<span class="tag">${room.owned ? 'Gebaut' : 'Ab Sektor ' + room.unlockSector}</span><h3>${esc(room.name)}</h3>${
              room.owned
                ? `<button class="button" data-facility-visit="${room.id}">Raum betreten${icon('arrow')}</button>`
                : quoteButton('buildServiceRoom', { roomType: room.id }, room.quote)
            }</article>`,
        )
        .join('')}</div>
    </div></section>`;
  }

  function centralSystems(central) {
    return `<section class="section-spacer"><div class="building-section-heading"><div><h2>Zentrale Versorgung</h2><p>Gebauter Technikraum, passende Leistungsreserven und laufende Betriebskosten sind erforderlich.</p></div></div>
    <div class="facility-system-grid">${central.systems
      .map(
        (system) => `<section class="panel facility-system">
      <div class="facility-system-heading">${icon(system.id === 'cooling' ? 'heat' : system.id === 'ups' ? 'shield' : 'automation')}<span class="tag">${system.available ? 'Stufe ' + system.level + ' / ' + system.maxLevel : system.unlocked ? 'Technikraum fehlt' : 'Ab Sektor ' + system.unlockSector}</span></div>
      <h3>${esc(system.name)}</h3><p>${details[system.id]}</p><div class="facility-output" data-central-output="${system.id}"></div>
      ${quoteButton('upgradeCentral', { system: system.id }, system.quote, 'Ausbau prüfen')}
      <button class="text-button" data-facility-visit="${system.id}" ${system.available ? '' : 'disabled'}>Technikraum betreten${icon('arrow')}</button>
    </section>`,
      )
      .join('')}</div>
    <section class="panel facility-operation" data-central-operation ${central.operation ? '' : 'hidden'}><strong data-central-operation-title></strong><span data-central-operation-time></span><div class="progress-track"><div class="progress-fill" data-central-operation-progress></div></div></section></section>`;
  }

  function facilityView() {
    const layout = E.getFacilityLayout(ctx.state),
      building = E.getBuildingModel(ctx.state),
      central = E.getCentralInfrastructure(ctx.state);
    return (
      ctx.head('Gebäude & Technik', 'Dein Cyberbunker wächst mit jedem bezahlten Bauauftrag.') +
      `<div class="rack-summary"><div><span>Serverräume</span><strong>${building.roomCount}</strong></div><div><span>Untergeschosse</span><strong>${building.floorCount}</strong></div><div><span>Freie Rackplätze</span><strong>${building.freeRackSlots}</strong></div><div><span>Technikkosten</span><strong data-central-stat="upkeep">${dec(central.upkeep * 60)} CR / min</strong></div></div>` +
      projectPanel(building.project) +
      navigator.markup(layout, building, selectedFloor) +
      roomPlan(layout, building) +
      ctx.roomOperationsView() +
      `<section class="panel section-spacer building-excavation"><div class="panel-body"><span class="eyebrow">TIEFBAU / NÄCHSTE EBENE</span><h2>Untergeschoss ${building.floorCount + 1} erschließen</h2><p>Eine neue Ebene umfasst Flur, Treppe und vier unbebaute Raumplätze. Sie enthält noch keine Serverräume oder Hardware.</p>${quoteButton('buildFloor', {}, building.buyFloor, 'Untergeschoss planen')}</div></section>` +
      serviceRooms(building) +
      centralSystems(central) +
      `<div class="helper-card"><h3>Bauen und Betrieb bleiben getrennte Aufgaben.</h3><p>Ein externer Bautrupp bearbeitet einen Bauauftrag gleichzeitig. Bestehende Anlagen arbeiten weiter, und Reparaturen bleiben möglich. Bei zentraler oder Rack-Wartung bleibt die bisherige Wartungsbegrenzung bestehen.</p></div>`
    );
  }

  // Structural changes rerender the page once. Remaining seconds, money and chart samples do not.
  function facilitySignature() {
    const b = ctx.state.facility.building,
      p = b?.project;
    return JSON.stringify([
      b?.floors,
      b?.rooms,
      b?.specialRooms,
      p && [p.kind, p.floor, p.roomId, p.roomType],
    ]);
  }

  function selectFacilityFloor(value) {
    const floor = Number(value),
      count = E.getFacilityLayout(ctx.state).floorCount;
    if (!Number.isInteger(floor) || floor < 1 || floor > count) return false;
    selectedFloor = floor;
    return true;
  }

  function updateCentralTelemetry() {
    const central = E.getCentralInfrastructure(ctx.state),
      project = E.getConstructionProject(ctx.state);
    const output = {
      cooling:
        dec(central.coolingCapacityW / 1000) +
        ' kW · ' +
        central.activeRackCount +
        ' ' +
        tr('aktive Racks'),
      ups:
        dec(central.upsCapacityW / 1000) +
        ' kW · ' +
        fmt(central.upsCoverage * 100) +
        ' % ' +
        tr('Last abgedeckt'),
      distribution:
        dec(central.distributionCapacityW / 1000) +
        ' kW ' +
        tr('gesamt') +
        ' · ' +
        dec(central.distributionCapacityWPerRack / 1000) +
        ' kW / ' +
        tr('aktives Rack'),
    };
    ctx.$$('[data-central-output]').forEach((el) => {
      el.textContent = output[el.dataset.centralOutput];
    });
    ctx.$$('[data-central-stat="upkeep"]').forEach((el) => {
      el.textContent = dec(central.upkeep * 60) + ' CR / min';
    });
    ctx.$$('[data-central-operation]').forEach((el) => {
      const op = central.operation;
      el.hidden = !op;
      if (!op) return;
      el.querySelector('[data-central-operation-title]').textContent = tr(op.label || op.name);
      el.querySelector('[data-central-operation-time]').textContent = duration(op.remaining);
      el.querySelector('[data-central-operation-progress]').style.width =
        (1 - op.remaining / op.total) * 100 + '%';
    });
    ctx.$$('[data-building-project]').forEach((el) => {
      el.hidden = !project;
      if (!project) return;
      el.querySelector('[data-building-title]').textContent = tr(project.label);
      el.querySelector('[data-building-time]').textContent = duration(project.remaining);
      el.querySelector('[data-building-progress]').style.width = project.progress * 100 + '%';
    });
  }
  return {
    facilityView,
    facilitySignature,
    selectFacilityFloor,
    updateCentralTelemetry,
    facilityClick: navigator.click,
    facilityChange: navigator.change,
    facilityInput: navigator.input,
  };
}
