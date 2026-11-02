/** 3D servers. The per-view context owns scene resources and mutable interaction state. */
export function createRoomServers(sceneContext) {
  function buildServer(rackGroup, rack, server, unitBase, unitH, rackH, halfD) {
    const group = new sceneContext.THREE.Group();
    group.userData.roomKind = 'server';
    group.userData.rackId = rack.id;
    group.userData.serverId = server.id;
    const y = unitBase + (server.unit - 2 + server.units / 2) * unitH;
    const h = server.units * unitH - 0.018,
      w = 1.29;
    group.position.set(0, y, halfD - 0.33);
    rackGroup.add(group);
    sceneContext.serverGroups.set(server.id, group);
    sceneContext.addBox(group, w, h, 0.66, sceneContext.materials.shellDark, 0, 0, 0, {
      castShadow: false,
      radius: 0.035,
    });
    // Thin stamped front plate, rolled perimeter, rack ears and flush fasteners.
    const face = sceneContext.addBox(
      group,
      w - 0.08,
      h - 0.025,
      0.045,
      sceneContext.materials.face,
      0,
      0,
      0.35,
      {
        castShadow: false,
        radius: 0.018,
      },
    );
    sceneContext.addBox(
      group,
      0.065,
      h - 0.055,
      0.024,
      sceneContext.materials.brushed,
      -w / 2 + 0.055,
      0,
      0.38,
      {
        castShadow: false,
        radius: 0.01,
      },
    );
    sceneContext.addBox(
      group,
      0.065,
      h - 0.055,
      0.024,
      sceneContext.materials.brushed,
      w / 2 - 0.055,
      0,
      0.38,
      {
        castShadow: false,
        radius: 0.01,
      },
    );
    const earScrews = [];
    for (const x of [-w / 2 + 0.055, w / 2 - 0.055])
      for (const y of [-h * 0.34, h * 0.34]) earScrews.push([x, y, 0.395]);
    sceneContext.addBoxInstances(
      group,
      0.018,
      0.018,
      0.006,
      sceneContext.materials.rail,
      earScrews,
      false,
      0.004,
    );
    const isAi = server.type === 'ai' && (server.gpuCount || 0) > 0;
    const grilleW = isAi ? 0.22 : server.units > 1 ? 0.32 : 0.24;
    const grilleX = isAi ? -0.43 : -0.39;
    const grille = sceneContext.addBox(
      group,
      grilleW,
      Math.max(0.055, h - 0.055),
      0.016,
      sceneContext.materials.grille,
      grilleX,
      0,
      0.382,
      { castShadow: false, radius: 0.008 },
    );
    const drives = Math.max(1, Math.min(8, server.driveBays));
    const bayW = 0.42 / drives,
      bayCenters = [],
      bayInner = [],
      driveLEDs = [];
    for (let i = 0; i < drives; i++) {
      const x = 0.015 + bayW * (i + 0.5);
      bayCenters.push([x, 0, 0.39]);
      bayInner.push([x, 0.004, 0.412]);
      // Carrier release tab and latch seam are modeled as small, repeatable pieces.
      const led = sceneContext.addDot(
        group,
        x + bayW * 0.34,
        -Math.max(0.014, h / 2 - 0.024),
        0.416,
        sceneContext.materials.off,
        0.011,
      );
      driveLEDs.push(led);
    }
    sceneContext.addBoxInstances(
      group,
      bayW - 0.008,
      Math.max(0.052, Math.min(0.12, h - 0.035)),
      0.035,
      sceneContext.materials.panel,
      bayCenters,
      false,
      0.008,
    );
    sceneContext.addBoxInstances(
      group,
      bayW - 0.028,
      Math.max(0.025, Math.min(0.065, h - 0.07)),
      0.008,
      sceneContext.materials.black,
      bayInner,
      false,
      0.004,
    );
    const latchPoints = bayCenters.map(([x]) => [x - bayW * 0.31, 0, 0.414]);
    sceneContext.addBoxInstances(
      group,
      0.009,
      Math.max(0.035, Math.min(0.06, h - 0.04)),
      0.009,
      sceneContext.materials.brushed,
      latchPoints,
      false,
      0.003,
    );
    // Louvered exhaust zone doubles as a tactile grip and visible airflow path.
    sceneContext.addBox(
      group,
      0.13,
      Math.max(0.05, Math.min(0.12, h - 0.04)),
      0.018,
      sceneContext.materials.rubber,
      0.52,
      0,
      0.39,
      { castShadow: false, radius: 0.01 },
    );
    const louvers = [];
    for (let i = 0; i < 4; i++) louvers.push([0.52, (i - 1.5) * Math.min(0.018, h / 7), 0.404]);
    sceneContext.addBoxInstances(group, 0.105, 0.004, 0.008, sceneContext.materials.rail, louvers);
    sceneContext.addBox(
      group,
      0.025,
      Math.max(0.042, Math.min(0.08, h - 0.045)),
      0.012,
      sceneContext.materials.black,
      0.635,
      0,
      0.399,
      { castShadow: false, radius: 0.01 },
    );
    const ledRefs = {
      power: sceneContext.addDot(group, 0.49, 0.02, 0.417, sceneContext.materials.off, 0.013),
      activity: sceneContext.addDot(group, 0.54, 0.02, 0.417, sceneContext.materials.off, 0.013),
      fault: sceneContext.addDot(group, 0.59, 0.02, 0.417, sceneContext.materials.off, 0.013),
      boot: sceneContext.addDot(group, 0.635, 0.02, 0.417, sceneContext.materials.off, 0.013),
    };
    const modelLine = isAi
      ? `${server.gpuCount} × GPU · ${server.vramGB} GB VRAM`
      : server.model + '  ·  L' + server.level;
    const nameTexture = sceneContext.labelMaterial([sceneContext.serverName(server), modelLine], {
      accent: isAi ? '#be91ff' : '#9bd76d',
    });
    const label = new sceneContext.THREE.Mesh(
      sceneContext.planeGeometry(0.4, Math.min(0.065, h - 0.035)),
      nameTexture,
    );
    label.position.set(isAi ? 0.2 : -0.34, isAi ? h * 0.31 : 0, 0.414);
    group.add(label);
    const gpuLoadBars = [];
    if (isAi) {
      const gpuCount = Math.min(8, Math.max(1, Math.round(server.gpuCount))),
        carrierPoints = [],
        carrierFaces = [],
        carrierRibs = [];
      for (let i = 0; i < gpuCount; i++) {
        const x = -0.55 + i * 0.065;
        carrierPoints.push([x, -0.055, 0.397]);
        carrierFaces.push([x, -0.055, 0.417]);
        carrierRibs.push(
          [x, -0.055 + 0.091, 0.424],
          [x, -0.055, 0.424],
          [x, -0.055 - 0.091, 0.424],
        );
        const baseY = -0.055,
          barHeight = 0.17;
        const baseBar = sceneContext.addBox(
          group,
          0.018,
          barHeight,
          0.008,
          sceneContext.materials.black,
          x + 0.023,
          baseY,
          0.42,
          { castShadow: false, radius: 0.004 },
        );
        const loadBar = sceneContext.addBox(
          group,
          0.011,
          barHeight,
          0.009,
          sceneContext.materials.blue,
          x + 0.023,
          baseY - barHeight / 2,
          0.428,
          { castShadow: false, radius: 0.003 },
        );
        gpuLoadBars.push({ mesh: loadBar, base: baseBar, baseY, height: barHeight });
      }
      sceneContext.addBoxInstances(
        group,
        0.052,
        0.24,
        0.034,
        sceneContext.materials.black,
        carrierPoints,
        false,
        0.008,
      );
      sceneContext.addBoxInstances(
        group,
        0.041,
        0.225,
        0.008,
        sceneContext.materials.panel,
        carrierFaces,
        false,
        0.005,
      );
      sceneContext.addBoxInstances(
        group,
        0.034,
        0.009,
        0.008,
        sceneContext.materials.brushed,
        carrierRibs,
        false,
        0.003,
      );
      const gpuLeds = carrierPoints.map(([x]) =>
        sceneContext.addDot(group, x, -0.18, 0.429, sceneContext.materials.off, 0.009),
      );
      sceneContext.serverRefs.set(server.id, { gpuLoadBars, gpuLeds });
    }
    sceneContext.addBox(
      group,
      0.028,
      0.035,
      0.025,
      sceneContext.materials.black,
      0.57,
      -0.015,
      0.424,
      {
        castShadow: false,
        radius: 0.008,
      },
    );
    const progressBase = sceneContext.addBox(
      group,
      0.88,
      0.018,
      0.012,
      sceneContext.materials.black,
      0,
      -h / 2 + 0.025,
      0.418,
      { castShadow: false },
    );
    const progress = sceneContext.addBox(
      group,
      0.88,
      0.012,
      0.014,
      sceneContext.materials.blue,
      -0.435,
      -h / 2 + 0.025,
      0.428,
      { castShadow: false },
    );
    progressBase.userData.roomServerId = server.id;
    const pickMaterial = new sceneContext.THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.001,
      depthWrite: false,
      color: 0xffffff,
    });
    sceneContext.dynamicMaterials.push(pickMaterial);
    const pick = new sceneContext.THREE.Mesh(sceneContext.boxGeometry(w, h, 0.018), pickMaterial);
    pick.position.set(0, 0, 0.44);
    pick.userData.roomKind = 'server';
    pick.userData.rackId = rack.id;
    pick.userData.serverId = server.id;
    sceneContext.pickTargets.push(pick);
    group.add(pick);
    const rackId = rackGroup.userData.rackId;
    const parentRack = sceneContext.rackRefs.get(rackId);
    const portX = -0.58 + (server.port - 1) * 0.075;
    const portY = rackH - 0.48;
    const serverY = unitBase + (server.unit - 2 + server.units / 2) * unitH;
    const curve = new sceneContext.THREE.CatmullRomCurve3([
      new sceneContext.THREE.Vector3(portX, portY, halfD + 0.29),
      new sceneContext.THREE.Vector3(0.74, portY - 0.14, halfD + 0.2),
      new sceneContext.THREE.Vector3(0.74, serverY + 0.06, halfD + 0.12),
      new sceneContext.THREE.Vector3(0.57, serverY - 0.015, halfD + 0.1),
    ]);
    const cableGeometry = new sceneContext.THREE.TubeGeometry(curve, 12, 0.012, 5, false);
    sceneContext.dynamicGeometries.push(cableGeometry);
    const cable = new sceneContext.THREE.Mesh(cableGeometry, sceneContext.materials.cableLive);
    cable.castShadow = false;
    rackGroup.add(cable);
    if (parentRack) parentRack.cables.push({ mesh: cable, serverId: server.id });
    sceneContext.serverRefs.set(server.id, {
      ...sceneContext.serverRefs.get(server.id),
      group,
      leds: ledRefs,
      driveLEDs,
      progress,
      progressBase,
      cable,
      face,
      grille,
      unit: server.unit,
      units: server.units,
    });
  }

  function updateServer(server, operation) {
    const ref = sceneContext.serverRefs.get(server.id);
    if (!ref) return;
    const online = server.status === 'online' && server.link;
    ref.leds.power.material =
      server.powered && server.status !== 'maintenance'
        ? server.status === 'failed'
          ? sceneContext.materials.red
          : sceneContext.materials.green
        : sceneContext.materials.off;
    ref.leds.activity.material =
      online && server.activity > 0 ? sceneContext.materials.blue : sceneContext.materials.off;
    ref.leds.fault.material =
      server.status === 'failed' || server.status === 'repairing'
        ? sceneContext.materials.red
        : server.warnings.length
          ? sceneContext.materials.amber
          : sceneContext.materials.off;
    ref.leds.boot.material =
      server.bootRemaining > 0
        ? sceneContext.materials.blue
        : server.status === 'repairing'
          ? sceneContext.materials.amber
          : sceneContext.materials.off;
    ref.driveLEDs.forEach((led, i) => {
      led.material =
        online && server.activity > 0 && i % 2 === Math.floor(Date.now() / 330) % 2
          ? sceneContext.materials.blue
          : sceneContext.materials.off;
    });
    const progress =
      server.bootRemaining > 0
        ? 1 - server.bootRemaining / 30
        : server.status === 'repairing' && operation?.serverId === server.id
          ? 1 - operation.remaining / operation.total
          : server.condition / 100;
    ref.progress.scale.x = Math.max(0.01, progress);
    ref.progress.position.x = -0.435 + 0.44 * Math.max(0.01, progress);
    ref.progress.material =
      server.bootRemaining > 0
        ? sceneContext.materials.blue
        : server.status === 'failed' || server.condition < 40
          ? sceneContext.materials.red
          : server.status === 'repairing' || server.condition < 75
            ? sceneContext.materials.amber
            : sceneContext.materials.green;
    for (const bar of ref.gpuLoadBars || []) {
      const load = Math.max(0.025, Math.min(1, server.gpuLoad || 0));
      bar.mesh.scale.y = load;
      bar.mesh.position.y = bar.baseY - bar.height / 2 + (bar.height * load) / 2;
      bar.mesh.material = online ? sceneContext.materials.blue : sceneContext.materials.off;
    }
    for (const led of ref.gpuLeds || [])
      led.material = online ? sceneContext.materials.green : sceneContext.materials.off;
  }
  return { buildServer, updateServer };
}
