import { consoleNavigation } from '../ui/navigation.js';
import '../brand.js';
const BRAND = globalThis.ROOTBrand;

/** 3D world. The per-view context owns scene resources and mutable interaction state. */
export function createRoomWorld(sceneContext) {
  function markup() {
    return '<div class="root-room-host"><div class="root-room-slot" data-room-slot></div></div>';
  }

  function buildWorld() {
    sceneContext.scene = new sceneContext.THREE.Scene();
    sceneContext.scene.background = new sceneContext.THREE.Color(0x101516);
    sceneContext.scene.fog = new sceneContext.THREE.Fog(0x101516, 15, 50);
    sceneContext.camera = new sceneContext.THREE.PerspectiveCamera(68, 1, 0.08, 90);
    sceneContext.camera.position.set(0, sceneContext.eyeHeight, 5.4);
    sceneContext.scene.add(new sceneContext.THREE.HemisphereLight(0xe6f1ef, 0x46504b, 2.05));
    // Broad frontal fill keeps dark hardware legible without bleaching the aisle floor.
    sceneContext.scene.add(new sceneContext.THREE.AmbientLight(0xc5d2d0, 0.32));
    const key = new sceneContext.THREE.DirectionalLight(0xe6f0f0, 0.95);
    key.position.set(-3.8, 8.5, 2.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 12;
    key.shadow.camera.bottom = -40;
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.025;
    sceneContext.scene.add(key);
    sceneContext.scene.add(key.target);
    const ambience = new sceneContext.THREE.DirectionalLight(0xc3d4d1, 0.68);
    ambience.position.set(0, 4.0, 2);
    sceneContext.scene.add(ambience);
    sceneContext.makeMaterials();
    if (sceneContext.assetBank) {
      const surfaces = sceneContext.createBunkerSurfaces(sceneContext.assetBank);
      sceneContext.materials.bunkerConcrete = surfaces.concrete;
      sceneContext.materials.bunkerFloor = surfaces.floor;
      sceneContext.materials.bunkerSteel = surfaces.steel;
    }
    const initialRacks = sceneContext.visibleRacks(sceneContext.allRacks());
    if (sceneContext.assetBank)
      sceneContext.assetHall = sceneContext.buildAssetHall({
        bank: sceneContext.assetBank,
        scene: sceneContext.scene,
        materials: sceneContext.materials,
      });
    else buildStaticHall(22);
    sceneContext.rebuildRacks(initialRacks);
    sceneContext.renderer = new sceneContext.THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'low-power',
    });
    sceneContext.renderer.outputColorSpace = sceneContext.THREE.SRGBColorSpace;
    sceneContext.renderer.shadowMap.enabled = true;
    sceneContext.renderer.shadowMap.type = sceneContext.THREE.PCFShadowMap;
    sceneContext.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    sceneContext.renderer.toneMapping = sceneContext.THREE.ACESFilmicToneMapping;
    sceneContext.renderer.toneMappingExposure = 1.15;
    const environment = new sceneContext.RoomEnvironment(),
      pmrem = new sceneContext.THREE.PMREMGenerator(sceneContext.renderer);
    sceneContext.scene.environment = pmrem.fromScene(environment, 0.04).texture;
    sceneContext.scene.environmentIntensity = 0.65;
    environment.dispose();
    pmrem.dispose();
    sceneContext.canvas = sceneContext.renderer.domElement;
    sceneContext.canvas.className = 'root-room-canvas';
    sceneContext.canvas.setAttribute(
      'aria-label',
      'Dreidimensionaler, simulierter Serverraum. Tastatur und Maus zum Erkunden; Server und Racks öffnen die Verwaltung.',
    );
    sceneContext.canvas.setAttribute('role', 'img');
    sceneContext.canvas.tabIndex = 0;
    sceneContext.stage.appendChild(sceneContext.canvas);
    sceneContext.bindCanvas();
    if (sceneContext.resizeObserver) sceneContext.resizeObserver.observe(sceneContext.stage);
    sceneContext.stationSystem = sceneContext.createStations({
      THREE: sceneContext.THREE,
      scene: sceneContext.scene,
      E: sceneContext.E,
      getState: sceneContext.getState,
      assetBank: sceneContext.assetBank,
    });
    sceneContext.stationSystem.setVisible(sceneContext.locationId === 'control');
  }

  function buildStaticHall(minLength) {
    const hallLength = Math.max(22, minLength),
      front = 6.2,
      center = front - hallLength / 2,
      back = front - hallLength;
    sceneContext.addBox(
      sceneContext.scene,
      13.2,
      0.18,
      hallLength,
      sceneContext.materials.floor,
      0,
      -0.14,
      center,
      {
        castShadow: false,
      },
    );
    sceneContext.addBox(
      sceneContext.scene,
      13.2,
      0.22,
      hallLength,
      sceneContext.materials.ceiling,
      0,
      4.35,
      center,
      {
        castShadow: false,
      },
    );
    sceneContext.addBox(
      sceneContext.scene,
      0.22,
      4.55,
      hallLength,
      sceneContext.materials.wall,
      -6.6,
      2.12,
      center,
      {
        castShadow: false,
      },
    );
    sceneContext.addBox(
      sceneContext.scene,
      0.22,
      4.55,
      hallLength,
      sceneContext.materials.wall,
      6.6,
      2.12,
      center,
      {
        castShadow: false,
      },
    );
    sceneContext.addBox(
      sceneContext.scene,
      13.2,
      4.55,
      0.2,
      sceneContext.materials.wall,
      0,
      2.12,
      front,
      {
        castShadow: false,
      },
    );
    sceneContext.addBox(
      sceneContext.scene,
      13.2,
      4.55,
      0.2,
      sceneContext.materials.wall,
      0,
      2.12,
      back,
      {
        castShadow: false,
      },
    );
    // A closed, serviceable fire door makes the corridor read as a room, not an infinite set.
    sceneContext.addBox(
      sceneContext.scene,
      2.25,
      3.35,
      0.08,
      sceneContext.materials.shellDark,
      0,
      1.77,
      back + 0.14,
      {
        castShadow: false,
        radius: 0.035,
      },
    );
    sceneContext.addBox(
      sceneContext.scene,
      2.06,
      3.16,
      0.045,
      sceneContext.materials.face,
      0,
      1.78,
      back + 0.085,
      {
        castShadow: false,
        radius: 0.025,
      },
    );
    sceneContext.addBox(
      sceneContext.scene,
      0.12,
      2.15,
      0.018,
      sceneContext.materials.black,
      -0.68,
      1.83,
      back + 0.055,
      {
        castShadow: false,
        radius: 0.012,
      },
    );
    sceneContext.addBox(
      sceneContext.scene,
      0.16,
      0.045,
      0.045,
      sceneContext.materials.brushed,
      0.71,
      1.35,
      back + 0.045,
      {
        castShadow: false,
        radius: 0.015,
      },
    );
    sceneContext.addBox(
      sceneContext.scene,
      0.48,
      0.12,
      0.025,
      sceneContext.materials.panel,
      0,
      3.55,
      back + 0.07,
      {
        castShadow: false,
        radius: 0.018,
      },
    );
    const roomSign = new sceneContext.THREE.Mesh(
      sceneContext.planeGeometry(0.4, 0.09),
      sceneContext.labelMaterial(['ROOT · DATENHALLE', 'KALTGANG / ZUTRITT'], {
        accent: '#a1d56a',
        bg: '#202a26',
      }),
    );
    roomSign.position.set(0, 3.55, back + 0.05);
    sceneContext.scene.add(roomSign);
    // Recessed green floor guides, a bright reference stripe, and cable lanes.
    for (const x of [-2.85, 2.85]) {
      sceneContext.addBox(
        sceneContext.scene,
        0.07,
        0.018,
        hallLength - 2.6,
        sceneContext.materials.glow,
        x,
        -0.035,
        center,
        {
          castShadow: false,
        },
      );
      sceneContext.addBox(
        sceneContext.scene,
        0.18,
        0.015,
        hallLength - 2.6,
        sceneContext.materials.black,
        x * 1.08,
        -0.038,
        center,
        {
          castShadow: false,
        },
      );
    }
    for (const x of [-5.7, 5.7]) {
      sceneContext.addBox(
        sceneContext.scene,
        0.38,
        0.12,
        hallLength - 1.5,
        sceneContext.materials.shellDark,
        x,
        4.02,
        center,
        {
          castShadow: false,
        },
      );
      sceneContext.addBox(
        sceneContext.scene,
        0.045,
        0.02,
        hallLength - 1.8,
        sceneContext.materials.green,
        x,
        3.94,
        center,
        {
          castShadow: false,
        },
      );
    }
    // Replaceable raised-floor panels and continuous perforated return-air trenches.
    const seams = [],
      ventRows = [];
    for (let z = front - 1.8; z > back + 1.2; z -= 1.8) {
      seams.push(
        [-4.9, -0.044, z],
        [-2.45, -0.044, z],
        [0, -0.044, z],
        [2.45, -0.044, z],
        [4.9, -0.044, z],
      );
      for (const x of [-4.05, 4.05]) ventRows.push([x, -0.018, z]);
    }
    if (seams.length)
      sceneContext.addBoxInstances(
        sceneContext.scene,
        0.012,
        0.008,
        0.075,
        sceneContext.materials.trim,
        seams,
        true,
      );
    if (ventRows.length) {
      sceneContext.addBox(
        sceneContext.scene,
        0.45,
        0.008,
        hallLength - 2.8,
        sceneContext.materials.black,
        -4.05,
        -0.048,
        center,
        {
          castShadow: false,
        },
      );
      sceneContext.addBox(
        sceneContext.scene,
        0.45,
        0.008,
        hallLength - 2.8,
        sceneContext.materials.black,
        4.05,
        -0.048,
        center,
        {
          castShadow: false,
        },
      );
      const slats = [];
      for (const [x, , z] of ventRows)
        for (let i = -8; i <= 8; i++) slats.push([x, -0.04, z + i * 0.08]);
      sceneContext.addBoxInstances(
        sceneContext.scene,
        0.38,
        0.008,
        0.015,
        sceneContext.materials.rail,
        slats,
        true,
      );
    }
    // Ceiling grid and cool white service lights repeat down the hall.
    const rows = Math.max(4, Math.ceil((hallLength - 2.6) / 3.6));
    for (let i = 0; i < rows; i++) {
      const z = front - i * 3.6 - 1.8;
      sceneContext.addBox(
        sceneContext.scene,
        13.0,
        0.07,
        0.07,
        sceneContext.materials.trim,
        0,
        4.18,
        z,
        {
          castShadow: false,
        },
      );
      sceneContext.addBox(
        sceneContext.scene,
        0.7,
        0.045,
        1.55,
        sceneContext.materials.grille,
        0,
        4.18,
        z - 0.8,
        {
          castShadow: false,
        },
      );
      for (const x of [-1.3, 1.3])
        sceneContext.addBox(
          sceneContext.scene,
          0.14,
          0.035,
          2.25,
          sceneContext.materials.lightWhite,
          x,
          4.14,
          z - 0.8,
          {
            castShadow: false,
          },
        );
      if (i < 6) {
        for (const x of [-1.8, 1.8]) {
          const light = new sceneContext.THREE.PointLight(0xe2eff0, 2.4, 7.5, 1.9);
          light.position.set(x, 3.8, z);
          sceneContext.scene.add(light);
        }
      }
    }
    // Paired overhead cable ladders carry recognizable power and data looms.
    for (const x of [-5.0, 5.0]) {
      sceneContext.addBox(
        sceneContext.scene,
        0.16,
        0.08,
        hallLength - 2,
        sceneContext.materials.rail,
        x,
        3.78,
        center,
        {
          castShadow: false,
          radius: 0.018,
        },
      );
      sceneContext.addBox(
        sceneContext.scene,
        0.16,
        0.08,
        hallLength - 2,
        sceneContext.materials.rail,
        x,
        3.52,
        center,
        {
          castShadow: false,
          radius: 0.018,
        },
      );
      for (let i = 0; i < rows; i++)
        sceneContext.addBox(
          sceneContext.scene,
          0.2,
          0.035,
          0.16,
          sceneContext.materials.trim,
          x,
          3.64,
          front - i * 3.6 - 1.8,
          {
            castShadow: false,
            radius: 0.008,
          },
        );
      for (let bundle = 0; bundle < 5; bundle++)
        sceneContext.addBox(
          sceneContext.scene,
          0.028,
          0.028,
          hallLength - 2.5,
          bundle % 2 ? sceneContext.materials.cableLive : sceneContext.materials.black,
          x + (bundle - 2) * 0.035,
          3.68,
          center,
          { castShadow: false, radius: 0.013 },
        );
    }
    for (let i = 0; i < rows; i++) {
      const z = front - i * 3.6 - 1.1;
      sceneContext.addBox(
        sceneContext.scene,
        0.035,
        0.008,
        0.55,
        sceneContext.materials.green,
        -2.86,
        -0.037,
        z,
        {
          castShadow: false,
        },
      );
      sceneContext.addBox(
        sceneContext.scene,
        0.035,
        0.008,
        0.55,
        sceneContext.materials.green,
        2.86,
        -0.037,
        z,
        {
          castShadow: false,
        },
      );
    }
    // In-row precision-cooling cabinets: intake grille, status panel, and paired fan discs.
    sceneContext.fallbackCooling = new sceneContext.THREE.Group();
    sceneContext.scene.add(sceneContext.fallbackCooling);
    for (const x of [-6.12, 6.12]) {
      const unit = new sceneContext.THREE.Group();
      unit.position.set(x, 0, back + 3.2);
      sceneContext.fallbackCooling.add(unit);
      sceneContext.addBox(unit, 0.72, 2.55, 1.0, sceneContext.materials.shell, 0, 1.28, 0, {
        castShadow: false,
        radius: 0.05,
      });
      sceneContext.addBox(unit, 0.61, 2.23, 0.035, sceneContext.materials.grille, 0, 1.27, 0.52, {
        castShadow: false,
        radius: 0.025,
      });
      sceneContext.addBox(unit, 0.24, 0.12, 0.03, sceneContext.materials.green, 0, 2.27, 0.55, {
        castShadow: false,
        radius: 0.02,
      });
      for (const y of [0.68, 1.15, 1.62]) {
        const fan = new sceneContext.THREE.Mesh(
          sceneContext.cylinderGeometry(0.16, 0.16, 0.045, 20),
          sceneContext.materials.black,
        );
        fan.position.set(0, y, 0.56);
        unit.add(fan);
        const ring = new sceneContext.THREE.Mesh(
          new sceneContext.THREE.TorusGeometry(0.155, 0.012, 5, 24),
          sceneContext.materials.rail,
        );
        ring.position.set(0, y, 0.59);
        unit.add(ring);
      }
      sceneContext.addBox(
        unit,
        0.025,
        2.05,
        0.045,
        sceneContext.materials.trim,
        -0.26,
        1.27,
        0.57,
        {
          castShadow: false,
          radius: 0.01,
        },
      );
    }
  }

  function buildShell() {
    sceneContext.shell = document.createElement('section');
    sceneContext.shell.className = 'root-room';
    sceneContext.shell.setAttribute('aria-label', 'Simulierter Serverraum');
    sceneContext.shell.innerHTML =
      '<div class="root-room-stage"><div class="root-room-empty"><span class="root-room-mark">ROOT<span>.</span></span><p>Lokale Infrastruktur · Live-Simulation</p></div><div class="root-room-top"><div class="root-room-brand"><strong>ROOT<span>.</span></strong><i></i><span data-room-place-label>SERVERRAUM</span></div><div class="root-room-live"><i class="root-room-led"></i><span data-room-system>SYSTEM ONLINE</span><span class="root-room-badge">SIMULATION</span></div></div><div class="root-room-reticle" aria-hidden="true"></div><div class="root-room-target" data-room-target></div><div class="root-room-summary" data-room-summary></div><div class="root-room-controls"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Bewegen</span><span><kbd>Shift</kbd> Sprinten</span><span data-room-mouse-help><kbd>Maus</kbd> Ziehen / ← → drehen</span><span><kbd>E</kbd> Öffnen</span><button type="button" data-room-enter>Raum betreten</button><button type="button" data-room-pointer hidden aria-pressed="false">Maus fangen</button><button type="button" data-room-leave hidden>Leitstelle</button><button type="button" data-room-navigation aria-expanded="false">Geräte-Liste</button><button type="button" class="root-room-incident-action" data-room-incident hidden>Vorfall bearbeiten</button></div><div class="root-room-fallback" hidden></div></div><div class="root-room-nav" aria-label="Racks und Server"></div>';
    sceneContext.stage = sceneContext.shell.querySelector('.root-room-stage');
    sceneContext.nav = sceneContext.shell.querySelector('.root-room-nav');
    sceneContext.summary = sceneContext.shell.querySelector('[data-room-summary]');
    sceneContext.statusLine = sceneContext.shell.querySelector('[data-room-system]');
    sceneContext.fallback = sceneContext.shell.querySelector('.root-room-fallback');
    sceneContext.placeNav = document.createElement('div');
    sceneContext.placeNav.className = 'room-location-nav';
    sceneContext.shell.insertBefore(sceneContext.placeNav, sceneContext.stage);
    sceneContext.arrivalOverlay = document.createElement('div');
    sceneContext.arrivalOverlay.className = 'room-arrival-overlay';
    sceneContext.arrivalOverlay.hidden = true;
    sceneContext.arrivalOverlay.innerHTML = `<div class="arrival-brand" aria-label="${BRAND.title}"><span>UNDERGROUND OPERATIONS</span><h2>${BRAND.wordmark}<b>.</b></h2><p class="arrival-brand-label">${BRAND.label}</p><p data-arrival-caption>Zugangsschleuse</p></div><button type="button" data-arrival-skip>Überspringen · Esc</button><div class="arrival-progress"><i></i></div>`;
    sceneContext.shell.appendChild(sceneContext.arrivalOverlay);
    sceneContext.arrivalOverlay
      .querySelector('[data-arrival-skip]')
      .addEventListener('click', () => sceneContext.finishArrival());
    sceneContext.shell
      .querySelector('[data-room-enter]')
      .addEventListener('click', sceneContext.startExploration);
    sceneContext.shell.querySelector('[data-room-pointer]').addEventListener('click', () => {
      if (document.pointerLockElement === sceneContext.canvas) sceneContext.releasePointer();
      else sceneContext.capturePointer();
    });
    const terminalButton = document.createElement('button');
    terminalButton.type = 'button';
    terminalButton.dataset.roomTerminal = '';
    terminalButton.textContent = 'Konsole';
    terminalButton.addEventListener('click', () => {
      if (!sceneContext.exploring) sceneContext.startExploration(false);
      sceneContext.openView?.('overview', sceneContext.locationId);
    });
    sceneContext.shell.querySelector('.root-room-controls').appendChild(terminalButton);
    sceneContext.consolePanel = document.createElement('section');
    sceneContext.consolePanel.className = 'root-room-console';
    sceneContext.consolePanel.hidden = true;
    sceneContext.consolePanel.setAttribute('aria-label', 'Raumkonsole');
    sceneContext.consolePanel.innerHTML =
      '<header class="room-console-header"><div><span>ROOT / OPERATIONS TERMINAL</span><strong data-room-console-title>Leitstelle</strong></div><button type="button" class="notification-bell" data-modal="notifications" data-notification-bell aria-label="Benachrichtigungen">Benachrichtigungen <span class="notification-count" data-notification-count hidden></span></button><button type="button" data-room-console-close>Zurück in den Raum · Esc</button></header><nav class="room-console-nav" aria-label="Bereiche der Raumkonsole">' +
      consoleNavigation('overview', sceneContext.tr) +
      '</nav><div class="room-console-content" tabindex="-1"></div>';
    sceneContext.shell.appendChild(sceneContext.consolePanel);
    sceneContext.consoleContent = sceneContext.consolePanel.querySelector('.room-console-content');
    sceneContext.consolePanel
      .querySelector('[data-room-console-close]')
      .addEventListener('click', sceneContext.closeConsole);
    sceneContext.shell
      .querySelector('[data-room-leave]')
      .addEventListener('click', sceneContext.leave);
    sceneContext.shell
      .querySelector('[data-room-navigation]')
      .addEventListener('click', sceneContext.toggleNavigation);
    sceneContext.shell.querySelector('[data-room-incident]').addEventListener('click', () => {
      if (sceneContext.openProtection) sceneContext.openProtection();
    });
  }
  return { markup, buildWorld, buildStaticHall, buildShell };
}
