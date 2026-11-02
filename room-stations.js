import { STATION_CONFIGS, stationRows } from './room/station-content.js';
import { dashboardModel } from './ui/dashboard-model.js';
import { createControlLounge } from './room-lounge.js';
import { operationReadout } from './room-instruments.js';

// Console furniture and live, readable operator displays for the walkable room.
// Three.js 0.186.1 is supplied by the caller so this module shares the room renderer.
export function createStations({ THREE, scene, E, getState, assetBank = null }) {
  const group = new THREE.Group();
  group.name = 'room-stations';
  scene.add(group);

  const pickTargets = [];
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const screens = [];
  const colliders = [];
  let elapsed = 0;
  let visible = true;
  let lastUpdate = -Infinity;
  let lastLanguage = '';

  function language() {
    return globalThis.ROOTI18N?.getLanguage?.() === 'en' ? 'en' : 'de';
  }
  function translateCanvas(value, state) {
    const source = String(value ?? '');
    if (!globalThis.ROOTI18N?.translate) return source;
    const protectedNames = [
      state?.networkName,
      ...(state?.agents || []).map((agent) => agent.name),
      ...(state?.servers || []).map((server) => server.name),
      ...(state?.facility?.racks || []).map((rack) => rack.name),
    ].filter((name) => typeof name === 'string' && name.length > 0);
    if (protectedNames.some((name) => source.includes(name))) return source;
    const translated = globalThis.ROOTI18N.translate(source, language());
    if (translated !== source || !source.includes(' · ')) return translated;
    return source
      .split(' · ')
      .map((part) => globalThis.ROOTI18N.translate(part, language()))
      .join(' · ');
  }

  const mat = (color, metalness = 0, roughness = 0.5, extra = {}) => {
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
    materials.add(material);
    return material;
  };
  const metal = mat(0x69777a, 0.82, 0.28);
  const graphite = mat(0x20292c, 0.63, 0.34);
  const dark = mat(0x101719, 0.42, 0.4);
  const trim = mat(0x9aa7a8, 0.78, 0.23);
  const rubber = mat(0x111719, 0.12, 0.78);
  const keyCap = mat(0x4b5759, 0.34, 0.43);
  const green = mat(0xa0d878, 0.2, 0.24, { emissive: 0x315a20, emissiveIntensity: 0.85 });
  const blue = mat(0x85d4ed, 0.18, 0.2, { emissive: 0x17485a, emissiveIntensity: 0.75 });

  function box(parent, size, position, material, options = {}) {
    const geometry = new THREE.BoxGeometry(...size);
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    if (options.rotation) mesh.rotation.set(...options.rotation);
    mesh.castShadow = options.castShadow !== false;
    mesh.receiveShadow = options.receiveShadow !== false;
    parent.add(mesh);
    return mesh;
  }

  function canvasTexture(canvas) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    textures.add(texture);
    return texture;
  }

  function textPlate(parent, width, height, position, title, subtitle, accent = '#9fda72') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#101719';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 8, 128);
    ctx.font = '700 34px Segoe UI, Arial';
    ctx.fillStyle = '#edf2ed';
    ctx.fillText(
      translateCanvas(title)
        .toLocaleUpperCase(language() === 'en' ? 'en-US' : 'de-DE')
        .slice(0, 26),
      25,
      57,
    );
    ctx.font = '21px Segoe UI, Arial';
    ctx.fillStyle = '#aebbbb';
    ctx.fillText(translateCanvas(subtitle).slice(0, 40), 25, 96);
    const texture = canvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    materials.add(material);
    const geometry = new THREE.PlaneGeometry(width, height);
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  }

  const configs = STATION_CONFIGS;

  function makeScreen(parent, view, x, y, z, width, height, turn = 0, wall = false) {
    const cfg = configs[view];
    const canvas = document.createElement('canvas');
    canvas.width = wall ? 1024 : 512;
    canvas.height = wall ? 576 : 320;
    const texture = canvasTexture(canvas);
    const screenMaterial = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    materials.add(screenMaterial);
    // Recessed bezel and luminous panel face point toward the operator (local +Z).
    box(parent, [width + 0.09, height + 0.09, 0.09], [x, y, z], dark, { rotation: [0, 0, turn] });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), screenMaterial);
    geometries.add(face.geometry);
    face.position.set(x, y, z + 0.049);
    face.rotation.z = turn;
    parent.add(face);
    if (!wall) {
      box(parent, [0.065, 0.26, 0.065], [x, y - height / 2 - 0.16, z - 0.005], metal);
      box(parent, [0.28, 0.04, 0.22], [x, y - height - 0.27, z + 0.015], graphite);
    }

    const target = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide }),
    );
    geometries.add(target.geometry);
    materials.add(target.material);
    target.position.copy(face.position);
    target.rotation.copy(face.rotation);
    target.userData = {
      roomKind: 'station',
      view,
      label: cfg.title,
      stationId: `station-${view}`,
    };
    parent.add(target);
    pickTargets.push(target);
    screens.push({ view, canvas, texture, cfg, wall, lastKey: '' });
  }

  function keyboard(parent, x, z) {
    box(parent, [0.76, 0.035, 0.27], [x, 0.858, z], rubber);
    for (let row = 0; row < 4; row++) {
      const cols = row === 3 ? 10 : 13;
      for (let col = 0; col < cols; col++) {
        const kw = row === 3 ? 0.052 : 0.048;
        box(
          parent,
          [kw, 0.018, 0.036],
          [x - 0.32 + col * (0.64 / (cols - 1)), 0.882, z - 0.085 + row * 0.055],
          col === 3 && row === 1 ? blue : keyCap,
          { castShadow: false },
        );
      }
    }
  }

  function buildWorkstation(x, name, views) {
    if (assetBank) {
      const station = assetBank.make('desk');
      station.position.set(x < 0 ? -1.65 : 1.65, 0, -2.4);
      group.add(station);
      ['monitor_screen_01', 'monitor_screen', 'monitor_screen_03'].forEach((screenName, i) =>
        attachAssetScreen(station, screenName, views[i]),
      );
      return;
    }
    const station = new THREE.Group();
    station.position.set(x, 0, 3.25);
    group.add(station);
    // Weighted, powder-coated steel legs, cross brace, and a layered work surface.
    box(station, [2.22, 0.13, 0.82], [0, 0.78, 0], graphite);
    box(station, [2.25, 0.035, 0.84], [0, 0.858, 0], trim);
    box(station, [2.16, 0.025, 0.75], [0, 0.88, -0.015], rubber);
    for (const lx of [-0.89, 0.89]) {
      box(station, [0.075, 0.72, 0.085], [lx, 0.39, -0.21], metal);
      box(station, [0.12, 0.06, 0.68], [lx, 0.035, -0.16], graphite);
      box(station, [0.13, 0.035, 0.74], [lx, 0.016, -0.16], rubber);
    }
    box(station, [1.7, 0.07, 0.06], [0, 0.34, -0.2], metal);
    // Cable trough and neat braided service leads under the top.
    box(station, [1.46, 0.11, 0.18], [0, 0.68, -0.23], dark);
    for (let i = 0; i < 3; i++)
      box(station, [0.025, 0.34, 0.025], [-0.52 + i * 0.52, 0.49, -0.31], rubber);
    // Three independent displays on articulated, two-joint monitor arms.
    for (let i = 0; i < 3; i++) {
      const sx = -0.7 + i * 0.7;
      box(station, [0.12, 0.035, 0.12], [sx, 0.93, -0.16], metal);
      box(station, [0.035, 0.18, 0.035], [sx, 1.04, -0.16], metal);
      box(station, [0.24, 0.025, 0.035], [sx, 1.13, -0.16], metal);
      makeScreen(station, views[i], sx, 1.34, -0.13, 0.64, 0.4);
    }
    keyboard(station, 0, 0.21);
    // Precision mouse and docked operator handset.
    const mouseGeometry = new THREE.SphereGeometry(0.085, 12, 9);
    geometries.add(mouseGeometry);
    const mouse = new THREE.Mesh(mouseGeometry, rubber);
    mouse.scale.set(0.8, 0.34, 1.2);
    mouse.position.set(0.79, 0.91, 0.19);
    station.add(mouse);
    box(station, [0.17, 0.025, 0.22], [-0.88, 0.9, 0.22], dark);
    box(station, [0.035, 0.012, 0.11], [-0.88, 0.92, 0.22], green, { castShadow: false });
    // Front apron, service ports, illuminated brand strip, and operator identity plate.
    box(station, [1.98, 0.18, 0.075], [0, 0.65, 0.37], graphite);
    box(station, [0.82, 0.025, 0.018], [0, 0.68, 0.414], green, { castShadow: false });
    for (let i = 0; i < 4; i++) {
      const port = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.014, 10),
        i < 2 ? blue : green,
      );
      geometries.add(port.geometry);
      materials.add(port.material);
      port.rotation.x = Math.PI / 2;
      port.position.set(-0.68 + i * 0.1, 0.61, 0.416);
      station.add(port);
    }
    textPlate(station, 0.7, 0.12, [0, 0.57, 0.417], name, 'OPERATIONS DESK', '#a5d87a');
    const lamp = new THREE.PointLight(0x83cf9a, 0.42, 2.5, 2.2);
    lamp.position.set(0, 1.62, 0.04);
    station.add(lamp);
  }

  buildWorkstation(-2.82, 'Leitstand 01', ['overview', 'business', 'jobs']);
  buildWorkstation(2.82, 'Leitstand 02', ['agents', 'research', 'operations']);

  if (assetBank) buildControlLounge();

  function buildControlLounge() {
    const lounge = createControlLounge({
      THREE,
      parent: group,
      bank: assetBank,
      geometries,
      materials,
    });
    colliders.push(...lounge.colliders);
    makeScreen(group, 'facility', -2.67, 2.12, -5.1, 2.33, 1.31, 0, true);
    makeScreen(group, 'network', 0, 2.12, -5.1, 2.55, 1.43, 0, true);
    makeScreen(group, 'resilience', 2.67, 2.12, -5.1, 2.33, 1.31, 0, true);
  }

  // A slim wall-mounted rear operations terminal completes the seven-area set
  // without occupying the narrow rear aisle or overlapping the server racks.
  if (!assetBank) {
    const rear = new THREE.Group();
    rear.position.set(0, 0, -15.43);
    group.add(rear);
    box(rear, [1.85, 1.28, 0.2], [0, 2.05, 0], graphite);
    box(rear, [1.75, 0.08, 0.23], [0, 1.38, 0.035], metal);
    box(rear, [0.1, 0.66, 0.14], [-0.52, 1.73, 0.13], metal);
    box(rear, [0.1, 0.66, 0.14], [0.52, 1.73, 0.13], metal);
    makeScreen(rear, 'resilience', 0, 2.15, 0.18, 1.42, 0.84);
    textPlate(
      rear,
      0.8,
      0.17,
      [0, 1.61, 0.116],
      'VORFALL · BACKUP',
      'RESILIENCE CONTROL',
      '#ee927d',
    );
    for (const x of [-0.67, -0.48, 0.48, 0.67]) {
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), x < 0 ? green : blue);
      geometries.add(led.geometry);
      materials.add(led.material);
      led.position.set(x, 1.39, 0.17);
      rear.add(led);
    }
  }

  function attachAssetScreen(root, name, view) {
    const surface = root.getObjectByName(name);
    if (!surface) throw new Error('Monitorfläche fehlt: ' + name);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 320;
    const texture = canvasTexture(canvas);
    texture.flipY = false;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    materials.add(material);
    surface.traverse((mesh) => {
      if (mesh.isMesh) {
        mesh.material = material;
        mesh.castShadow = false;
        mesh.userData = {
          ...mesh.userData,
          roomKind: 'station',
          view,
          label: configs[view].title,
          stationId: 'station-' + view,
        };
        pickTargets.push(mesh);
      }
    });
    screens.push({ view, canvas, texture, cfg: configs[view], lastKey: '' });
  }

  const numberLocale = () => (language() === 'en' ? 'en-US' : 'de-DE');
  const fmt = (value) => Math.round(Number(value) || 0).toLocaleString(numberLocale());
  const pct = (value) =>
    `${Math.round((Number(value) || 0) * 100)}${language() === 'en' ? '%' : ' %'}`;
  const one = (value) =>
    (Number(value) || 0).toLocaleString(numberLocale(), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  const clip = (value, max = 48) =>
    String(value ?? '')
      .replace(/\s+/g, ' ')
      .slice(0, max);
  function renderScreen(screen, state, m, resilience, ops, statusColor, facility) {
    if (screen.wall) return renderWallScreen(screen, state, m, resilience, statusColor, facility);
    const rows = stationRows(screen.view, state, m, resilience, ops, facility.dashboard, {
      one,
      fmt,
      pct,
      duration: (seconds) => Math.ceil(seconds / 60) + ' min',
    });
    const lang = language();
    const localizedRows = rows.map(([label, value]) => [
      translateCanvas(label, state),
      translateCanvas(value, state),
    ]);
    const key = JSON.stringify([lang, Math.floor(state.time / 60), localizedRows, statusColor]);
    if (key === screen.lastKey) return;
    screen.lastKey = key;
    const ctx = screen.canvas.getContext('2d');
    const { width: w, height: h } = screen.canvas;
    ctx.fillStyle = '#071117';
    ctx.fillRect(0, 0, w, h);
    // Subtle instrument-grid makes the console feel emissive without obscuring values.
    ctx.strokeStyle = '#14252a';
    ctx.lineWidth = 1;
    for (let y = 48; y < h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#111f25';
    ctx.fillRect(0, 0, w, 48);
    ctx.fillStyle = screen.cfg.color;
    ctx.fillRect(0, 0, 6, h);
    ctx.font = '700 13px Segoe UI, Arial';
    ctx.fillStyle = '#8fa3a9';
    ctx.fillText(translateCanvas(screen.cfg.eyebrow, state), 19, 19);
    ctx.font = '700 21px Segoe UI, Arial';
    ctx.fillStyle = '#f0f5f0';
    ctx.fillText(translateCanvas(screen.cfg.title, state), 19, 41);
    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(w - 25, 24, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '12px Consolas, monospace';
    ctx.fillStyle = '#74878d';
    ctx.textAlign = 'right';
    ctx.fillText(
      `LIVE  ${new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'de-DE', { hour: '2-digit', minute: '2-digit' })}`,
      w - 18,
      42,
    );
    ctx.textAlign = 'left';
    const rowHeight = rows.length > 4 ? 39 : 46;
    localizedRows.forEach(([label, value], index) => {
      const y = 67 + index * rowHeight;
      ctx.fillStyle = index % 2 ? '#0b171d' : '#0d1a20';
      ctx.fillRect(13, y - 4, w - 26, rowHeight - 2);
      ctx.font = '700 12px Segoe UI, Arial';
      ctx.fillStyle = '#91a5aa';
      ctx.fillText(clip(label, 25).toLocaleUpperCase(lang === 'en' ? 'en-US' : 'de-DE'), 23, y + 9);
      ctx.font = '15px Segoe UI, Arial';
      ctx.fillStyle = '#e4ece8';
      let valueText = clip(value, 46);
      while (ctx.measureText(valueText).width > w - 46 && valueText.length > 5)
        valueText = `${valueText.slice(0, -4)}…`;
      ctx.fillText(valueText, 23, y + 27);
    });
    ctx.fillStyle = '#628078';
    ctx.fillRect(18, h - 13, w - 36, 2);
    ctx.fillStyle = screen.cfg.color;
    ctx.fillRect(18, h - 13, 54, 2);
    screen.texture.needsUpdate = true;
  }

  function renderWallScreen(screen, state, m, resilience, statusColor, facility) {
    const en = language() === 'en',
      text = (de, english) => (en ? english : de);
    const { central, layout, construction } = facility;
    const headline = translateCanvas(screen.cfg.title, state).toLocaleUpperCase(
      en ? 'en-US' : 'de-DE',
    );
    let value, detail, rows;
    if (screen.view === 'facility') {
      value = `${one(m.powerW / 1000)} kW`;
      detail = text('Gesamte elektrische Last', 'Total electrical demand');
      rows = central.systems.map((system) => ({
        label: text(
          system.id === 'ups'
            ? 'USV'
            : system.id === 'cooling'
              ? 'Zentrale Kühlung'
              : 'Stromverteilung',
          system.id === 'ups'
            ? 'UPS'
            : system.id === 'cooling'
              ? 'Central cooling'
              : 'Power distribution',
        ),
        value:
          central.operation?.system === system.id
            ? `${text('Ausbau', 'Upgrade')} ${Math.round(operationReadout(central.operation).progress * 100)} % · ${Math.ceil(central.operation.remaining)} s`
            : system.level
              ? text(`Stufe ${system.level}`, `Level ${system.level}`)
              : system.available
                ? text('Bereit zum Ausbau', 'Ready to install')
                : system.unlocked
                  ? text('Technikraum bauen', 'Build plant room')
                  : text(
                      `Ab Sektor ${system.unlockSector}`,
                      `Unlocks in sector ${system.unlockSector}`,
                    ),
        ratio:
          central.operation?.system === system.id
            ? operationReadout(central.operation).progress
            : system.id === 'ups'
              ? central.upsCoverage
              : system.level / system.maxLevel,
      }));
      if (construction)
        rows.push({
          label: text('Baustelle', 'Construction'),
          value:
            translateCanvas(construction.label, state) +
            ' · ' +
            Math.round(construction.progress * 100) +
            ' % · ' +
            Math.ceil(construction.remaining) +
            ' s',
          ratio: construction.progress,
        });
      else
        rows.push({
          label: text('USV-Abdeckung', 'UPS coverage'),
          value: pct(central.upsCoverage),
          ratio: central.upsCoverage,
        });
    } else if (screen.view === 'resilience') {
      value = `${fmt(resilience.integrity)} %`;
      detail = text('Datenintegrität', 'Data integrity');
      rows = [
        {
          label: text('Server ausgefallen', 'Failed servers'),
          value: String(resilience.failed),
          ratio: resilience.failed / Math.max(1, state.servers.length),
        },
        {
          label: text('Sicherung', 'Backup'),
          value:
            resilience.backupAge === null
              ? text('Noch keine Sicherung', 'No backup yet')
              : text(
                  `Vor ${fmt(resilience.backupAge / 60)} min`,
                  `${fmt(resilience.backupAge / 60)} min ago`,
                ),
          ratio: resilience.backupAge === null ? 0 : Math.max(0, 1 - resilience.backupAge / 3600),
        },
        {
          label: text('Vorfall', 'Incident'),
          value: translateCanvas(
            resilience.incident?.title || text('Kein offener Vorfall', 'No open incident'),
            state,
          ),
        },
        {
          label: text('Laufende Maßnahme', 'Current operation'),
          value: translateCanvas(
            resilience.operation?.label ||
              state.facility.operation?.label ||
              central.operation?.label ||
              text('Keine Maßnahme', 'No active operation'),
            state,
          ),
        },
      ];
      const operation = operationReadout(
        resilience.operation || state.facility.operation || central.operation,
      );
      if (operation) {
        rows[3].value += ` · ${Math.round(operation.progress * 100)} % · ${operation.remaining} s`;
        rows[3].ratio = operation.progress;
      }
    } else {
      value = `${m.onlineServers} / ${state.servers.length}`;
      detail = text('Server online', 'Servers online');
      rows = [
        { label: text('Rechenlast', 'Compute load'), value: pct(m.load), ratio: m.load },
        {
          label: text('GPU-Auslastung', 'GPU utilization'),
          value: `${one(m.gpuUsed)} / ${one(m.gpuCapacity)}`,
          ratio: m.gpuLoad,
        },
        {
          label: text('Wärmstes Rack', 'Hottest rack'),
          value: `${one(m.maxRackTemperature)} °C`,
          ratio: Math.max(0, (m.maxRackTemperature - 22) / 58),
        },
        {
          label: text('Ausbau', 'Facility'),
          value: text(
            `${state.facility.racks.length} Racks · ${layout.roomCount} Räume · ${layout.floorCount} UG`,
            `${state.facility.racks.length} ${state.facility.racks.length === 1 ? 'rack' : 'racks'} · ${layout.roomCount} ${layout.roomCount === 1 ? 'room' : 'rooms'} · ${layout.floorCount} ${layout.floorCount === 1 ? 'basement' : 'basements'}`,
          ),
        },
      ];
    }
    const key = JSON.stringify([language(), headline, value, detail, rows, statusColor]);
    if (key === screen.lastKey) return;
    screen.lastKey = key;
    const ctx = screen.canvas.getContext('2d'),
      w = screen.canvas.width,
      h = screen.canvas.height;
    ctx.fillStyle = '#0b171d';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = screen.cfg.color;
    ctx.fillRect(0, 0, w, 5);
    ctx.font = '600 24px Segoe UI';
    ctx.fillStyle = '#bac9c9';
    ctx.fillText(headline, 36, 49);
    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(w - 43, 40, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '600 75px Segoe UI';
    ctx.fillStyle = '#edf4e9';
    ctx.fillText(value, 36, 140);
    ctx.font = '23px Segoe UI';
    ctx.fillStyle = '#96adaa';
    ctx.fillText(detail, 39, 178);
    rows.forEach((row, i) => {
      const y = 221 + i * 75;
      ctx.fillStyle = '#13262c';
      ctx.fillRect(25, y, w - 50, 65);
      ctx.font = '20px Segoe UI';
      ctx.fillStyle = '#9ab4b4';
      ctx.fillText(row.label, 41, y + 25);
      ctx.font = '600 24px Segoe UI';
      ctx.fillStyle = '#e6eee9';
      let line = String(row.value);
      while (ctx.measureText(line).width > w - 85 && line.length > 5) line = line.slice(0, -2);
      ctx.fillText(line, 41, y + 53);
      if (Number.isFinite(row.ratio)) {
        ctx.fillStyle = screen.cfg.color;
        ctx.fillRect(41, y + 61, (w - 82) * Math.min(1, Math.max(0, row.ratio)), 3);
      }
    });
    ctx.font = '18px Consolas';
    ctx.fillStyle = '#668680';
    ctx.fillText(
      text('LIVE · E / KLICK: KONSOLE ÖFFNEN', 'LIVE · E / CLICK: OPEN CONSOLE'),
      36,
      h - 18,
    );
    screen.texture.needsUpdate = true;
  }

  function update(delta = 0, snapshot = null) {
    if (!visible) return;
    const now = performance.now();
    if (now - lastUpdate < 900 && lastLanguage === language()) return;
    lastUpdate = now;
    lastLanguage = language();
    elapsed += Math.max(0, delta || 0);
    if (!E || !getState) return;
    const state = getState();
    if (!state) return;
    const shared = snapshot?.state === state ? snapshot : null;
    const m = shared?.metrics || E.getMetrics(state);
    const resilience = shared?.resilience || E.getResilience(state, null, m);
    const ops = shared?.operations || E.getAgentOperations(state);
    const facility = {
      dashboard: dashboardModel(E, state, m, resilience, ops),
      central: shared?.central || E.getCentralInfrastructure(state, m),
      layout: shared?.layout || E.getFacilityLayout(state),
      construction: shared?.construction || E.getConstructionProject?.(state) || null,
    };
    const statusColor =
      resilience.incident || resilience.safetyMode
        ? '#fa826d'
        : resilience.failed
          ? '#edbc68'
          : '#8fd477';
    // Smoothly pulse a small operator-ready beacon, keeping other room lighting intact.
    for (const child of group.children) {
      if (child.isGroup && child.children.length) {
        const beacon = child.children.find((node) => node.isPointLight);
        if (beacon) beacon.intensity = 0.3 + 0.12 * (Math.sin(elapsed * 2.3) * 0.5 + 0.5);
      }
    }
    for (const screen of screens)
      renderScreen(screen, state, m, resilience, ops, statusColor, facility);
  }

  function dispose() {
    scene.remove(group);
    for (const texture of textures) texture.dispose();
    for (const material of materials) material.dispose();
    for (const geometry of geometries) geometry.dispose();
    pickTargets.length = 0;
    screens.length = 0;
  }

  update();
  function setVisible(value) {
    if (Boolean(value) && !visible) {
      lastUpdate = -Infinity;
      screens.forEach((screen) => (screen.lastKey = ''));
    }
    visible = Boolean(value);
    group.visible = visible;
  }
  return {
    get pickTargets() {
      return visible ? pickTargets : [];
    },
    get colliders() {
      return visible ? colliders : [];
    },
    setVisible,
    update,
    dispose,
  };
}
