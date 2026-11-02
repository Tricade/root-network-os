/** 3D location. The per-view context owns scene resources and mutable interaction state. */
export function createRoomLocation(sceneContext, platform = globalThis) {
  function clearDynamicRacks() {
    sceneContext.facilityInterior?.dispose();
    sceneContext.facilityInterior = null;
    for (const ref of sceneContext.rackRefs.values()) if (ref.asset) ref.dispose();
    for (const material of sceneContext.dynamicMaterials) material.dispose();
    sceneContext.dynamicMaterials = [];
    for (const mesh of sceneContext.dynamicInstances) mesh.dispose();
    sceneContext.dynamicInstances = [];
    for (const geometry of sceneContext.dynamicGeometries) geometry.dispose();
    sceneContext.dynamicGeometries = [];
    for (const texture of sceneContext.dynamicTextures) texture.dispose();
    sceneContext.dynamicTextures = [];
    for (const group of sceneContext.rackGroups.values()) sceneContext.scene.remove(group);
    sceneContext.rackGroups.clear();
    sceneContext.serverGroups.clear();
    sceneContext.rackRefs.clear();
    sceneContext.serverRefs.clear();
    sceneContext.pickTargets = [];
  }

  function rebuildRacks(racks) {
    sceneContext.rackGeneration++;
    clearDynamicRacks();
    const rows = Math.max(1, Math.ceil(racks.length / 2));
    racks.forEach((rack, index) => sceneContext.buildRack(rack, index, racks.length));
    if (sceneContext.assetBank) {
      sceneContext.facilityInterior = sceneContext.buildFacilityInterior({
        bank: sceneContext.assetBank,
        scene: sceneContext.scene,
        materials: sceneContext.materials,
        location: sceneContext.currentLocation(),
        layout: sceneContext.facilityLayout(),
        central: sceneContext.centralModel(),
      });
      sceneContext.assetHall.group.visible = sceneContext.locationId !== 'hall';
      sceneContext.assetHall.setServerRoom(
        sceneContext.locationId.startsWith('room-'),
        sceneContext.currentLocation().supply,
        racks.length,
      );
    }
    sceneContext.stationSystem?.setVisible(sceneContext.locationId === 'control');
    if (sceneContext.fallbackCooling)
      sceneContext.fallbackCooling.visible =
        sceneContext.locationId.startsWith('room-') &&
        sceneContext.currentLocation().supply?.cooling !== 'central';
    const rear = Math.max(5.4, (rows - 1) * 4.2 + 1.5);
    sceneContext.scene.fog = new sceneContext.THREE.Fog(
      0x101516,
      Math.max(15, rear * 0.44),
      Math.max(30, rear + 14),
    );
    const bounds = rear + 5;
    sceneContext.camera.userData.backLimit = sceneContext.assetBank
      ? -4.85
      : -Math.max(bounds, 14.5);
    sceneContext.structuralSignature = getStructureSignature(racks);
    sceneContext.lastRoomLanguage = platform.window.ROOTI18N?.getLanguage();
    sceneContext.updateAccessibleNavigation(racks);
  }

  function getStructureSignature(racks) {
    return [
      sceneContext.locationId,
      JSON.stringify(sceneContext.currentLocation().supply),
      sceneContext.selectedFloor,
      sceneContext.roomStructureKey(sceneContext.facilityLayout()),
      sceneContext
        .centralModel()
        .systems.map((s) => [s.id, s.level, s.available])
        .join('|'),
      racks
        .map(
          (rack) =>
            rack.id +
            ':' +
            rack.switchLevel +
            ':' +
            rack.powerLevel +
            ':' +
            rack.coolingLevel +
            ':' +
            rack.ports.length +
            '[' +
            rack.servers
              .map((server) =>
                [
                  server.id,
                  server.type,
                  server.unit,
                  server.units,
                  server.port,
                  server.level,
                  server.name,
                  server.model,
                  server.driveBays,
                ].join(':'),
              )
              .join(',') +
            ']',
        )
        .join('|'),
    ].join('/');
  }

  function refreshRoomLanguage(racks) {
    const language = platform.window.ROOTI18N?.getLanguage();
    if (language === sceneContext.lastRoomLanguage) return;
    sceneContext.lastRoomLanguage = language;
    if (sceneContext.facilityInterior) {
      const open = sceneContext.facilityInterior.portals
        .filter((portal) => portal.open)
        .map((portal) => ({
          id: portal.destination,
          autoClose: portal.autoClose,
          delay: portal.closeDelay,
        }));
      const oldPicks = new Set(sceneContext.facilityInterior.picks);
      sceneContext.pickTargets = sceneContext.pickTargets.filter((target) => !oldPicks.has(target));
      sceneContext.facilityInterior.dispose();
      sceneContext.facilityInterior = sceneContext.buildFacilityInterior({
        bank: sceneContext.assetBank,
        scene: sceneContext.scene,
        materials: sceneContext.materials,
        location: sceneContext.currentLocation(),
        layout: sceneContext.facilityLayout(),
        central: sceneContext.centralModel(),
      });
      open.forEach((saved) => {
        sceneContext.facilityInterior.openPortal(saved.id, saved.autoClose);
        sceneContext.facilityInterior.portals.find((portal) => portal.id === saved.id).closeDelay =
          saved.delay;
      });
    }
    for (const ref of sceneContext.rackRefs.values())
      ref.group?.traverse((node) => node.userData.refreshLabel?.());
    sceneContext.updateAccessibleNavigation(racks);
  }

  function changeLocation(id, floor = sceneContext.selectedFloor, entry = null) {
    sceneContext.arrivalRequested = false;
    sceneContext.explicitDestination = true;
    sceneContext.pendingSession = null;
    finishArrival(false);
    const previous = sceneContext.locationId;
    const next = sceneContext.roomLocation(sceneContext.facilityLayout(), id, floor),
      system = sceneContext.centralModel().systems.find((s) => s.id === id);
    if (system && !system.available) return;
    sceneContext.locationId = next.id;
    sceneContext.selectedFloor = next.floor;
    sceneContext.keys.clear();
    sceneContext.dragPoint = null;
    sceneContext.targetRack = null;
    sceneContext.targetServer = null;
    sceneContext.targetPortal = null;
    sceneContext.roomTransitionUntil = platform.performance.now() + 800;
    sceneContext.structuralSignature = '';
    sceneContext.placeSignature = '';
    if (sceneContext.camera) {
      sceneContext.camera.position.set(0, sceneContext.eyeHeight, next.id === 'hall' ? 3.9 : 4.6);
      sceneContext.yaw = 0;
      sceneContext.pitch = -0.02;
      if (entry === 'threshold' && next.id === 'hall') {
        const door = sceneContext
          .corridorPlan(sceneContext.facilityLayout(), sceneContext.centralModel(), next.floor)
          .doors.find((d) => d.id === previous);
        if (door) {
          sceneContext.camera.position.set(
            door.x + Math.sin(door.turn) * 0.75,
            sceneContext.eyeHeight,
            door.z + Math.cos(door.turn) * 0.75,
          );
          sceneContext.yaw = door.turn + Math.PI;
        }
      } else if (entry === 'stairs') {
        const plan = sceneContext.corridorPlan(
          sceneContext.facilityLayout(),
          sceneContext.centralModel(),
          next.floor,
        );
        sceneContext.camera.position.set(0, sceneContext.eyeHeight, plan.endZ + 0.85);
        sceneContext.yaw = Math.PI;
      }
      sceneContext.applyCameraRotation();
    }
    sceneContext.shell?.classList.remove('show-nav');
    sceneContext.shell
      ?.querySelector('[data-room-navigation]')
      .setAttribute('aria-expanded', 'false');
    sceneContext.update();
    if (entry === 'threshold')
      sceneContext.facilityInterior?.openPortal(next.id === 'hall' ? previous : 'hall', true);
    if (entry) {
      sceneContext.shell?.classList.add('room-crossing');
      setTimeout(() => sceneContext.shell?.classList.remove('room-crossing'), 160);
    }
    if (sceneContext.exploring) sceneContext.canvas?.focus({ preventScroll: true });
    saveRoomSession();
  }

  function saveRoomSession() {
    if (
      !sceneContext.camera ||
      !sceneContext.mounted ||
      sceneContext.hidden ||
      sceneContext.arrival ||
      sceneContext.pendingSession
    )
      return;
    try {
      const value = JSON.stringify({
        version: 1,
        id: sceneContext.locationId,
        floor: sceneContext.selectedFloor,
        exploring: sceneContext.exploring,
        position: sceneContext.camera.position.toArray(),
        yaw: sceneContext.yaw,
        pitch: sceneContext.pitch,
      });
      if (value !== sceneContext.lastSessionValue) {
        platform.sessionStorage.setItem('root.room.view', value);
        sceneContext.lastSessionValue = value;
      }
    } catch {
      /* Storage can be disabled. */
    }
    sceneContext.lastSessionWrite = platform.performance.now();
  }

  function applyRoomSession() {
    if (!sceneContext.pendingSession || !sceneContext.mounted || sceneContext.hidden) return;
    const view = sceneContext.pendingSession;
    sceneContext.pendingSession = null;
    if (view.exploring) {
      const [x, , z] = view.position;
      if (!sceneContext.canStand(x, z))
        view.position = [0, sceneContext.eyeHeight, sceneContext.locationId === 'hall' ? 3.9 : 4.6];
      const stair = sceneContext.facilityInterior?.stairAt(view.position[0], view.position[2]);
      view.position[1] =
        sceneContext.eyeHeight + (stair ? sceneContext.stairHeight(stair, view.position[2]) : 0);
      sceneContext.startExploration(false, view);
    } else {
      sceneContext.camera.position.set(
        0,
        sceneContext.assetBank ? 2.25 : 3.25,
        sceneContext.assetBank ? (sceneContext.locationId === 'hall' ? 3.9 : 3) : 5.3,
      );
      sceneContext.camera.lookAt(0, 1.3, sceneContext.assetBank ? -0.8 : -3);
    }
  }

  function finishArrival(showDashboard = true) {
    if (!sceneContext.arrival) return;
    sceneContext.arrival.dispose();
    sceneContext.arrival = null;
    sceneContext.arrivalOverlay.hidden = true;
    sceneContext.shell.classList.remove('arriving');
    if (!sceneContext.exploring) platform.document.body.classList.remove('root-room-open');
    sceneContext.sizeRenderer();
    if (showDashboard) {
      // A fly-in introduces the facility; first person starts deliberately
      // from the dashboard. Restoring a reload remains a separate operation.
      saveRoomSession();
      sceneContext.onArrivalComplete?.();
      sceneContext.syncAnimation();
    }
  }

  function startArrival(force = false) {
    if (force) sceneContext.arrivalRequested = true;
    const replay = force || sceneContext.arrivalRequested;
    // An explicit destination selected while assets load takes priority over the automatic intro.
    if (!replay && (sceneContext.sessionRestored || sceneContext.locationId !== 'hall')) return;
    if (
      !sceneContext.mounted ||
      sceneContext.hidden ||
      !sceneContext.assetBank ||
      !sceneContext.renderer ||
      sceneContext.isReducedMotion ||
      sceneContext.arrival ||
      platform.document.querySelector('#modal-root .modal')
    )
      return;
    try {
      if (
        !replay &&
        (platform.localStorage.getItem('root.arrival.enabled') === '0' ||
          platform.sessionStorage.getItem('root.arrival.shown') === '1')
      )
        return;
      platform.sessionStorage.setItem('root.arrival.shown', '1');
    } catch {}
    sceneContext.arrivalRequested = false;
    if (sceneContext.exploring) sceneContext.leave();
    sceneContext.arrival = sceneContext.createArrival({
      bank: sceneContext.assetBank,
      environment: sceneContext.scene.environment,
    });
    sceneContext.arrivalOverlay.hidden = false;
    sceneContext.shell.classList.add('arriving');
    platform.document.body.classList.add('root-room-open');
    sceneContext.sizeRenderer();
    sceneContext.syncAnimation();
  }

  function updatePlaceNavigation() {
    if (!sceneContext.placeNav) return;
    const layout = sceneContext.facilityLayout(),
      location = sceneContext.currentLocation(),
      systems = sceneContext.centralModel().systems;
    const key = sceneContext.roomNavigationKey(
      layout,
      { systems },
      location,
      platform.window.ROOTI18N?.getLanguage(),
    );
    if (key === sceneContext.placeSignature) return;
    sceneContext.placeSignature = key;
    const roomTitle = sceneContext.shell?.querySelector('[data-room-place-label]');
    if (roomTitle) roomTitle.textContent = sceneContext.tr(location.name);
    const floors = Array.from(
      { length: layout.floorCount },
      (_, i) =>
        `<option value="${i + 1}" ${i + 1 === location.floor ? 'selected' : ''}>${sceneContext.tr('Untergeschoss')} ${i + 1}</option>`,
    ).join('');
    const destinations = [
      { id: 'hall', name: 'Verbindungsflur' },
      ...(location.floor === 1 && layout.specialRooms.includes('control')
        ? [{ id: 'control', name: 'Kontrollraum' }]
        : []),
      ...layout.rooms
        .filter((r) => r.floor === location.floor)
        .map((r) => ({ id: r.id, name: `Raum ${r.number}` })),
      ...(location.floor === 1 ? systems.filter((s) => s.available) : []),
    ];
    sceneContext.placeNav.innerHTML = `<div class="room-location-title"><span>${sceneContext.tr('Standort')}</span><strong>${sceneContext.escapeHtml(sceneContext.tr(location.name))}</strong><small>${location.rackIds.length} ${sceneContext.tr(location.rackIds.length === 1 ? 'Rack in diesem Raum' : 'Racks in diesem Raum')}</small></div><label>${sceneContext.tr('Untergeschoss')}<select data-room-floor aria-label="${sceneContext.tr('Untergeschoss')}">${floors}</select></label><label>${sceneContext.tr('Raum wechseln')}<select data-room-location aria-label="${sceneContext.tr('Raum wechseln')}">${destinations.map((d) => `<option value="${d.id}" ${d.id === location.id ? 'selected' : ''}>${sceneContext.escapeHtml(sceneContext.tr(d.name))}</option>`).join('')}</select></label><button type="button" data-room-control>${sceneContext.tr(layout.specialRooms.includes('control') ? 'Zum Kontrollraum' : 'Gebäudeplan')}</button>`;
    sceneContext.placeNav
      .querySelector('[data-room-floor]')
      .addEventListener('change', (event) => changeLocation('hall', Number(event.target.value)));
    sceneContext.placeNav
      .querySelector('[data-room-location]')
      .addEventListener('change', (event) => changeLocation(event.target.value));
    sceneContext.placeNav
      .querySelector('[data-room-control]')
      .addEventListener('click', () =>
        layout.specialRooms.includes('control')
          ? changeLocation('control', 1)
          : sceneContext.openView?.('facility'),
      );
  }

  function activateStation(station) {
    if (station.view === 'lift' || station.view === 'map') {
      sceneContext.keys.clear();
      sceneContext.shell.classList.add('show-map');
      sceneContext.placeNav
        .querySelector(station.view === 'map' ? '[data-room-location]' : '[data-room-floor]')
        ?.focus();
    } else if (station.rackId) sceneContext.openRack?.(station.rackId);
    else sceneContext.openView?.(station.view, station.roomId);
  }
  return {
    clearDynamicRacks,
    rebuildRacks,
    getStructureSignature,
    refreshRoomLanguage,
    changeLocation,
    saveRoomSession,
    applyRoomSession,
    finishArrival,
    startArrival,
    updatePlaceNavigation,
    activateStation,
  };
}
