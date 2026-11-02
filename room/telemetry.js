import { STATUS_TEXT } from './status.js';
/** 3D telemetry. The per-view context owns scene resources and mutable interaction state. */
export function createRoomTelemetry(sceneContext) {
  function updateAccessibleNavigation(racks) {
    if (!sceneContext.nav) return;
    const html = racks
      .map((rack) => {
        const color =
          rack.status === 'online' ? 'ok' : rack.status === 'limited' ? 'warn' : 'fault';
        const serverButtons = rack.servers
          .map(
            (server) =>
              '<button type="button" class="root-room-device-link" data-room-open-server="' +
              sceneContext.escapeHtml(server.id) +
              '" data-room-rack="' +
              sceneContext.escapeHtml(rack.id) +
              '"><span class="root-room-device-light ' +
              sceneContext.escapeHtml(server.status) +
              '" data-room-server-light="' +
              sceneContext.escapeHtml(server.id) +
              '"></span><span>' +
              sceneContext.escapeHtml(sceneContext.serverName(server)) +
              '</span><small data-room-server-status="' +
              sceneContext.escapeHtml(server.id) +
              '">' +
              sceneContext.escapeHtml(STATUS_TEXT[server.status] || server.status) +
              '</small></button>',
          )
          .join('');
        return (
          '<article class="root-room-rack-links"><button type="button" class="root-room-rack-link" data-room-open-rack="' +
          sceneContext.escapeHtml(rack.id) +
          '"><span class="root-room-device-light ' +
          color +
          '" data-room-rack-light="' +
          sceneContext.escapeHtml(rack.id) +
          '"></span><strong>' +
          sceneContext.escapeHtml(rack.name) +
          '</strong><span data-room-rack-temp="' +
          sceneContext.escapeHtml(rack.id) +
          '">' +
          rack.servers.length +
          ' Server · ' +
          sceneContext.decimal(rack.temperature) +
          ' °C</span><small data-room-rack-status="' +
          sceneContext.escapeHtml(rack.id) +
          '">' +
          sceneContext.escapeHtml(STATUS_TEXT[rack.status] || rack.status) +
          '</small></button><div class="room-rack-card-actions"><span>' +
          rack.usedUnits +
          ' / 16 HE</span></div><details><summary>Rackdetails · ' +
          rack.servers.length +
          ' Server</summary><div class="root-room-server-links">' +
          (serverButtons || '<p>Keine Server eingebaut</p>') +
          '</div></details></article>'
        );
      })
      .join('');
    const description =
      sceneContext.locationId === 'control'
        ? 'Die Leitstelle bündelt alle Systeme. Der Ausgang führt zurück in den Verbindungsflur.'
        : sceneContext.locationId === 'hall'
          ? 'Öffne eine Tür mit E oder einem Klick und gehe hindurch. Die Treppen verbinden vorhandene Untergeschosse.'
          : 'Kapazität, laufende Kosten und Ausbau steuerst du am Terminal.';
    sceneContext.nav.innerHTML =
      html ||
      '<div class="room-location-info"><strong>' +
        sceneContext.escapeHtml(sceneContext.tr(sceneContext.currentLocation().name)) +
        '</strong><p>' +
        sceneContext.escapeHtml(sceneContext.tr(description)) +
        '</p><button type="button" data-nav="facility">Gebäudetechnik verwalten</button></div>';
    sceneContext.nav
      .querySelectorAll('[data-room-open-rack]')
      .forEach((button) =>
        button.addEventListener(
          'click',
          () => sceneContext.openRack && sceneContext.openRack(button.dataset.roomOpenRack),
        ),
      );
    sceneContext.nav
      .querySelectorAll('[data-room-open-server]')
      .forEach((button) =>
        button.addEventListener(
          'click',
          () =>
            sceneContext.openServer &&
            sceneContext.openServer(button.dataset.roomRack, button.dataset.roomOpenServer),
        ),
      );
    window.ROOTI18N?.localize?.(sceneContext.nav);
  }

  function updateNavigationTelemetry(racks) {
    if (!sceneContext.nav) return;
    for (const rack of racks) {
      const light = sceneContext.nav.querySelector(
        '[data-room-rack-light="' + CSS.escape(rack.id) + '"]',
      );
      const temp = sceneContext.nav.querySelector(
        '[data-room-rack-temp="' + CSS.escape(rack.id) + '"]',
      );
      const label = sceneContext.nav.querySelector(
        '[data-room-rack-status="' + CSS.escape(rack.id) + '"]',
      );
      if (light)
        light.className =
          'root-room-device-light ' +
          (rack.status === 'online' ? 'ok' : rack.status === 'limited' ? 'warn' : 'fault');
      if (temp)
        temp.textContent = sceneContext.tr(
          rack.servers.length + ' Server · ' + sceneContext.decimal(rack.temperature) + ' °C',
        );
      if (label) label.textContent = sceneContext.tr(STATUS_TEXT[rack.status] || rack.status);
      for (const server of rack.servers) {
        const status = sceneContext.nav.querySelector(
          '[data-room-server-status="' + CSS.escape(server.id) + '"]',
        );
        const serverLight = sceneContext.nav.querySelector(
          '[data-room-server-light="' + CSS.escape(server.id) + '"]',
        );
        if (status)
          status.textContent = sceneContext.tr(STATUS_TEXT[server.status] || server.status);
        if (serverLight) serverLight.className = 'root-room-device-light ' + server.status;
      }
    }
  }

  function update(snapshot = null) {
    if (!sceneContext.getState || !sceneContext.E) return;
    const state = sceneContext.getState();
    if (!state || !state.facility) return;
    const shared = snapshot?.state === state ? snapshot : null;
    const metrics = shared?.metrics || sceneContext.E.getMetrics(state),
      model = shared?.model || sceneContext.E.getRackModel(state, metrics),
      resilience = shared?.resilience || sceneContext.E.getResilience(state, model, metrics),
      operations = shared?.operations || sceneContext.E.getAgentOperations(state);
    const layout = shared?.layout || sceneContext.E.getFacilityLayout(state),
      central = shared?.central || sceneContext.E.getCentralInfrastructure(state, metrics),
      construction = shared?.construction || sceneContext.E.getConstructionProject(state);
    // Rebuilds and navigation read the same models during this update. Clear the
    // scope in finally: actions mutate this same state object between updates.
    const previous = {
      readingSnapshot: sceneContext.readingSnapshot,
      snapshot: sceneContext.snapshot,
    };
    sceneContext.snapshot = {
      state,
      metrics,
      model,
      resilience,
      operations,
      layout,
      central,
      construction,
    };
    sceneContext.readingSnapshot = true;
    try {
      sceneContext.stationSystem?.update(0, sceneContext.snapshot);
      const location = sceneContext.roomLocation(
        layout,
        sceneContext.locationId,
        sceneContext.selectedFloor,
      );
      if (
        location.id !== sceneContext.locationId ||
        location.floor !== sceneContext.selectedFloor
      ) {
        sceneContext.locationId = location.id;
        sceneContext.selectedFloor = location.floor;
        sceneContext.structuralSignature = '';
        sceneContext.placeSignature = '';
        sceneContext.keys.clear();
        sceneContext.camera?.position.set(0, sceneContext.eyeHeight, 3.9);
      }
      sceneContext.updatePlaceNavigation();
      const racks = sceneContext.visibleRacks(model.racks),
        signature = sceneContext.getStructureSignature(racks);
      sceneContext.currentRacks = racks;
      if (sceneContext.scene && signature !== sceneContext.structuralSignature)
        sceneContext.rebuildRacks(racks);
      if (sceneContext.scene) sceneContext.refreshRoomLanguage(racks);
      sceneContext.facilityInterior?.update({
        model,
        metrics,
        resilience,
        central,
        construction,
        preventiveMaintenance: state.preventiveMaintenance,
      });
      if (sceneContext.canvas)
        sceneContext.canvas.setAttribute(
          'aria-label',
          sceneContext.tr(
            `Begehbarer Serverraum: ${sceneContext.rackGroups.size} Racks und ${sceneContext.serverGroups.size} eingebaute Server. WASD bewegen, Shift sprinten, Maus oder Pfeiltasten drehen, E Gerät öffnen, Escape zurück.`,
          ),
        );
      const status = resilience.safetyMode
        ? 'SCHUTZMODUS'
        : !resilience.online
          ? 'NETZWERK OFFLINE'
          : resilience.failed
            ? 'BETRIEB EINGESCHRÄNKT'
            : resilience.repairing
              ? 'WARTUNG AKTIV'
              : model.racks.some((r) => r.status === 'limited' || r.status === 'maintenance')
                ? 'WARTUNG / LASTBEGRENZUNG'
                : 'SYSTEM ONLINE';
      if (sceneContext.statusLine) {
        sceneContext.statusLine.textContent = sceneContext.tr(status);
        sceneContext.shell.classList.toggle(
          'has-alert',
          /SCHUTZ|EINGESCHRÄNKT|OFFEN|OFFLINE|BEGRENZUNG|WARTUNG/.test(status),
        );
      }
      const totalServers = model.racks.reduce((n, rack) => n + rack.servers.length, 0);
      const hottest = model.racks.reduce((n, rack) => Math.max(n, rack.temperature), 0);
      const failures = model.racks.reduce(
        (n, rack) => n + rack.servers.filter((server) => server.status === 'failed').length,
        0,
      );
      const activeAssignments = operations.agents
        .filter((agent) => agent.assignment || agent.absent)
        .map((agent) => {
          const data = state.agents.find((person) => person.id === agent.id);
          return (
            (data ? data.name + ': ' : '') +
            (agent.absent
              ? sceneContext.tr('Selbstwartung · Rückkehr in') +
                ' ' +
                sceneContext.duration(agent.remaining)
              : sceneContext.tr(agent.assignment.label) +
                ' · ' +
                (operations.paused
                  ? sceneContext.tr('pausiert')
                  : sceneContext.duration(agent.assignment.remaining)))
          );
        });
      const activeEffects = operations.effects.map(
        (effect) => effect.label + ' · ' + sceneContext.duration(effect.remaining),
      );
      const activeOp =
        resilience.operation ||
        model.operation ||
        central.operation ||
        construction ||
        (state.preventiveMaintenance?.operation
          ? { ...state.preventiveMaintenance.operation, label: 'Vorbeugende Rackwartung' }
          : null);
      const backupText =
        resilience.backupAge === null
          ? 'Noch keine Betriebssicherung'
          : 'Letzte Sicherung vor ' + sceneContext.duration(resilience.backupAge);
      const operationText = activeOp
        ? sceneContext.escapeHtml(sceneContext.tr(activeOp.label)) +
          ' · noch ' +
          sceneContext.duration(activeOp.remaining)
        : 'Keine Maßnahme aktiv';
      if (sceneContext.summary)
        sceneContext.summary.innerHTML =
          (resilience.incident
            ? '<span class="root-room-incident"><b>VORFALL · ' +
              sceneContext.escapeHtml(resilience.incident.title) +
              '</b></span>'
            : '') +
          '<span><b>' +
          model.racks.length +
          '</b> Racks gesamt</span><span><b>' +
          totalServers +
          '</b> Server gesamt</span><span><b>' +
          sceneContext.decimal(hottest) +
          ' °C</b> höchste Racktemperatur</span><span><b>' +
          sceneContext.watts(model.totalPowerW) +
          '</b> Leistungsaufnahme</span><span><b>' +
          sceneContext.number(Math.round(model.networkFactor * 100)) +
          ' %</b> Uplink-Leistung</span><span><b>' +
          (failures
            ? failures + ' Störung' + (failures > 1 ? 'en' : '')
            : resilience.repairing
              ? 'Reparatur läuft'
              : model.operation
                ? 'Rack-Wartung'
                : model.racks.some((r) => r.status === 'limited')
                  ? 'Kapazität begrenzt'
                  : 'Betrieb stabil') +
          '</b></span><span>' +
          operationText +
          '</span><span>' +
          sceneContext.escapeHtml(backupText) +
          '</span>' +
          (activeAssignments.length
            ? '<span>Agenten: ' +
              sceneContext.escapeHtml(activeAssignments.join(' · ')) +
              (operations.paused ? ' · pausiert' : '') +
              '</span>'
            : '') +
          (activeEffects.length
            ? '<span>Netzeffekte: ' + sceneContext.escapeHtml(activeEffects.join(' · ')) + '</span>'
            : '');
      if (sceneContext.summary) window.ROOTI18N?.localize?.(sceneContext.summary);
      if (sceneContext.shell) {
        const exitButton = sceneContext.shell.querySelector('[data-room-leave]');
        if (exitButton) exitButton.textContent = sceneContext.tr('Weboberfläche');
        const incidentButton = sceneContext.shell.querySelector('[data-room-incident]');
        if (incidentButton) incidentButton.hidden = !resilience.incident;
      }
      updateNavigationTelemetry(racks);
      if (!sceneContext.scene) return;
      for (const rack of model.racks) {
        const ref = sceneContext.rackRefs.get(rack.id);
        if (!ref) continue;
        if (ref.asset) {
          sceneContext.updateAssetRack(ref, rack, resilience);
          continue;
        }
        const tone =
          rack.status === 'online'
            ? sceneContext.materials.green
            : rack.status === 'limited'
              ? sceneContext.materials.amber
              : rack.status === 'maintenance'
                ? sceneContext.materials.amber
                : sceneContext.materials.red;
        ref.panel.material = tone;
        ref.tempStrip.material =
          rack.temperature > 60
            ? sceneContext.materials.red
            : rack.temperature > 35
              ? sceneContext.materials.amber
              : sceneContext.materials.green;
        ref.leds.slice(0, 3).forEach((led, i) => {
          led.material =
            i === 0
              ? rack.status === 'online'
                ? sceneContext.materials.green
                : sceneContext.materials.amber
              : i === 1
                ? rack.networkDemandMbps > 0
                  ? sceneContext.materials.blue
                  : sceneContext.materials.off
                : rack.warnings.length
                  ? sceneContext.materials.amber
                  : sceneContext.materials.green;
        });
        ref.fans.forEach((fan, i) => {
          fan.userData.speed =
            rack.status === 'maintenance'
              ? 0
              : 1.2 + Math.min(3.6, Math.max(0, rack.temperature - 22) / 14) + i * 0.2;
        });
        ref.pduDisplay.material =
          rack.powerW > rack.powerCapacityW
            ? sceneContext.materials.red
            : sceneContext.materials.green;
        ref.switchPorts.forEach((light) => {
          const port = rack.ports.find((candidate) => candidate.number === light.number);
          light.linked = Boolean(port && port.link);
          light.traffic = Boolean(port && port.trafficMbps > 0);
          ref.switchLinkLights.setColorAt(
            light.number - 1,
            new sceneContext.THREE.Color(
              light.linked ? 0x9ad777 : port && !port.enabled ? 0xe0b36e : 0x172022,
            ),
          );
          ref.switchTrafficLights.setColorAt(
            light.number - 1,
            new sceneContext.THREE.Color(light.traffic ? 0x86d5e9 : 0x172022),
          );
        });
        ref.switchLinkLights.instanceColor.needsUpdate = true;
        ref.switchTrafficLights.instanceColor.needsUpdate = true;
        for (let index = 0; index < 16; index++) {
          const server = rack.servers.find(
            (candidate) => candidate.unit - 1 === index + 1 && candidate.unit === index + 2,
          );
          ref.pduOutletLights.setColorAt(
            index,
            new sceneContext.THREE.Color(server && server.powered ? 0x9ad777 : 0x172022),
          );
        }
        ref.pduOutletLights.instanceColor.needsUpdate = true;
        ref.cables.forEach((cable) => {
          const server = rack.servers.find((candidate) => candidate.id === cable.serverId);
          cable.mesh.material =
            server && server.link
              ? sceneContext.materials.cableLive
              : sceneContext.materials.cableDown;
        });
        for (const server of rack.servers) sceneContext.updateServer(server, resilience.operation);
      }
      updateTarget(racks);
    } finally {
      sceneContext.readingSnapshot = previous.readingSnapshot;
      sceneContext.snapshot = previous.snapshot;
    }
  }

  function updateTarget(racks) {
    if (!sceneContext.camera || !sceneContext.canvas) return;
    sceneContext.raycaster.setFromCamera(new sceneContext.THREE.Vector2(0, 0), sceneContext.camera);
    const hits = sceneContext.exploring
      ? sceneContext.raycaster.intersectObjects(
          [
            ...sceneContext.pickTargets,
            ...(sceneContext.facilityInterior?.picks || []),
            ...(sceneContext.stationSystem?.pickTargets || []),
          ],
          false,
        )
      : [];
    sceneContext.targetRack = null;
    sceneContext.targetServer = null;
    sceneContext.targetStation = null;
    sceneContext.targetDoor = false;
    sceneContext.targetPortal = null;
    for (const hit of hits) {
      if (sceneContext.exploring && hit.distance > 4.5) continue;
      let node = hit.object;
      while (node && !node.userData.roomKind) node = node.parent;
      if (!node) continue;
      if (node.userData.roomKind === 'station') {
        sceneContext.targetStation = node.userData;
        break;
      }
      if (node.userData.roomKind === 'portal') {
        sceneContext.targetPortal = node.userData;
        break;
      }
      sceneContext.targetRack = node.userData.rackId;
      sceneContext.targetDoor = node.userData.roomKind === 'door';
      if (node.userData.roomKind === 'server') sceneContext.targetServer = node.userData.serverId;
      break;
    }
    const rack = racks.find((r) => r.id === sceneContext.targetRack),
      server = rack && rack.servers.find((s) => s.id === sceneContext.targetServer);
    const action = sceneContext.rackInteraction(
      sceneContext.rackRefs.get(sceneContext.targetRack)?.cabinet,
      sceneContext.targetDoor,
    );
    if (action === 'open-door') sceneContext.targetDoor = true;
    const target = sceneContext.shell && sceneContext.shell.querySelector('[data-room-target]');
    if (target) {
      let text;
      if (sceneContext.targetPortal)
        text =
          sceneContext.tr(sceneContext.targetPortal.label) +
          ' · ' +
          sceneContext.tr(
            sceneContext.targetPortal.portal.open
              ? 'Tür offen · Hindurchgehen / E: schließen'
              : 'E / Klick: Tür öffnen',
          );
      else if (sceneContext.targetStation)
        text =
          sceneContext.tr(sceneContext.targetStation.label) +
          ' · ' +
          sceneContext.tr('E / Klick: Terminal öffnen');
      else if (rack && action === 'opening') text = rack.name + ' · Tür öffnet …';
      else if (rack && sceneContext.targetDoor)
        text =
          rack.name +
          ' · E: ' +
          (sceneContext.rackRefs.get(rack.id)?.cabinet?.doorOpen ? 'Tür schließen' : 'Tür öffnen');
      else if (rack && server)
        text =
          sceneContext.serverName(server) +
          ' · ' +
          (STATUS_TEXT[server.status] || server.status) +
          ' · E / Klick: Server verwalten';
      else if (rack)
        text =
          rack.name +
          ' · ' +
          sceneContext.decimal(rack.temperature) +
          ' °C · E / Klick: Rack verwalten';
      else
        text = sceneContext.exploring
          ? sceneContext.locationId === 'hall'
            ? 'Türen öffnen · Räume erkunden · Treppen benutzen'
            : 'Ziele auf einen Server, ein Rack oder ein Terminal.'
          : 'Klicke ein Gerät, um die vorhandene Verwaltung zu öffnen.';
      text = sceneContext.tr(text);
      if (target.textContent !== text) target.textContent = text;
      target.classList.toggle(
        'is-target',
        Boolean(rack || sceneContext.targetStation || sceneContext.targetPortal),
      );
    }
  }
  return { updateAccessibleNavigation, updateNavigationTelemetry, update, updateTarget };
}
