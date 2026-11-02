import * as THREE from './vendor/three.module.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { createStations } from './room-stations.js';
import {
  loadRootAssets,
  buildAssetRack,
  updateAssetRack,
  animateAssetRack,
  buildAssetHall,
} from './room-assets.js';
import { roomLocation, corridorPlan, stairHeight, buildFacilityInterior } from './room-facility.js';
import { createBunkerSurfaces } from './room-surfaces.js';
import { createArrival } from './room-arrival.js';

// Keyup stops immediately; the lease also clears a release lost by an embedded browser.
// Repeats from any held key preserve diagonals, while stale repeats cannot revive a reset.
import { createRoomMaterials } from './room/materials.js';
import { createRoomPrimitives } from './room/primitives.js';
import { createRoomWorld } from './room/world.js';
import { createRoomRacks } from './room/racks.js';
import { createRoomServers } from './room/servers.js';
import { createRoomLocation } from './room/location.js';
import { createRoomTelemetry } from './room/telemetry.js';
import { createRoomInput } from './room/input.js';
import { createRoomExploration } from './room/exploration.js';
import { createRoomRenderer } from './room/renderer.js';
import { createMovementKeys, rackInteraction } from './room/input.js';
import { readRoomSession, roomStructureKey, roomNavigationKey } from './room-navigation.js';
export { createMovementKeys, rackInteraction } from './room/input.js';
export { readRoomSession } from './room-navigation.js';

/** Per-view composition root. Feature modules share this view, never global camera/input state. */
export function createRoom({
  E,
  getState,
  openRack,
  openServer,
  openProtection,
  openView,
  onExit,
  onArrivalComplete,
  esc,
  fmt,
  dec,
}) {
  const ctx = {
    E,
    getState,
    openRack,
    openServer,
    openProtection,
    openView,
    onExit,
    onArrivalComplete,
    esc,
    fmt,
    dec,
    THREE,
    RoomEnvironment,
    RoundedBoxGeometry,
    createStations,
    loadRootAssets,
    buildAssetRack,
    updateAssetRack,
    animateAssetRack,
    buildAssetHall,
    roomLocation,
    corridorPlan,
    stairHeight,
    buildFacilityInterior,
    createBunkerSurfaces,
    createArrival,
    createMovementKeys,
    rackInteraction,
    readRoomSession,
    roomStructureKey,
    roomNavigationKey,
    scene: undefined,
    camera: undefined,
    renderer: undefined,
    shell: undefined,
    canvas: undefined,
    stage: undefined,
    nav: undefined,
    summary: undefined,
    statusLine: undefined,
    fallback: undefined,
    resizeObserver: undefined,
    mounted: false,
    hidden: true,
    exploring: false,
    pointerLocked: false,
    inViewport: true,
    visibilityObserver: undefined,
    assetBank: null,
    worldLoading: null,
    assetHitMaterial: undefined,
    assetHall: undefined,
    consoleOpen: false,
    consolePanel: undefined,
    consoleContent: undefined,
    stationSystem: undefined,
    targetStation: null,
    animationFrame: 0,
    lastFrame: 0,
    lastFrameTime: 0,
    lastTargetAt: 0,
    yaw: 0,
    pitch: -0.02,
    dragPoint: null,
    dragMoved: false,
    eyeHeight: 1.62,
    targetRack: null,
    targetServer: null,
    targetDoor: false,
    locationId: 'hall',
    selectedFloor: 1,
    facilityInterior: undefined,
    targetPortal: null,
    placeNav: undefined,
    placeSignature: '',
    roomTransitionUntil: 0,
    arrival: null,
    arrivalOverlay: undefined,
    arrivalRequested: false,
    sessionRestored: false,
    explicitDestination: false,
    pendingSession: null,
    lastSessionWrite: 0,
    lastSessionValue: '',
    tr: (text) => window.ROOTI18N?.translate(String(text)) || String(text),
    serverName: (server) => window.ROOTI18N?.serverName(server) || server.name,
    readingSnapshot: false,
    snapshot: null,
    facilityLayout: () =>
      ctx.readingSnapshot ? ctx.snapshot.layout : ctx.E.getFacilityLayout(ctx.getState()),
    centralModel: () =>
      ctx.readingSnapshot ? ctx.snapshot.central : ctx.E.getCentralInfrastructure(ctx.getState()),
    currentLocation: () =>
      ctx.roomLocation(ctx.facilityLayout(), ctx.locationId, ctx.selectedFloor),
    visibleRacks: (racks) => {
      const ids = new Set(ctx.currentLocation().rackIds);
      return racks.filter((rack) => ids.has(rack.id));
    },
    structuralSignature: '',
    lastRoomLanguage: '',
    rackGeneration: 0,
    rackGroups: new Map(),
    serverGroups: new Map(),
    rackRefs: new Map(),
    serverRefs: new Map(),
    currentRacks: [],
    pickTargets: [],
    dynamicTextures: [],
    dynamicMaterials: [],
    dynamicGeometries: [],
    dynamicInstances: [],
    staticInstances: [],
    sharedGeometries: new Map(),
    materials: {},
    isReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    keys: createMovementKeys(),
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    escapeHtml: (value) =>
      ctx.esc
        ? ctx.esc(String(value ?? ''))
        : String(value ?? '').replace(
            /[&<>"']/g,
            (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
          ),
    duration: (seconds) => {
      const n = Math.max(0, Math.ceil(seconds || 0));
      return n >= 3600
        ? Math.floor(n / 3600) + ' h ' + Math.floor((n % 3600) / 60) + ' min'
        : n >= 60
          ? Math.floor(n / 60) + ' min ' + (n % 60) + ' s'
          : n + ' s';
    },
    number: (value) => (ctx.fmt ? ctx.fmt(value) : Math.round(value || 0).toLocaleString('de-DE')),
    decimal: (value) =>
      ctx.dec
        ? ctx.dec(value)
        : Number(value || 0)
            .toFixed(1)
            .replace('.', ','),
    watts: (value) =>
      value >= 1000 ? ctx.decimal(value / 1000) + ' kW' : ctx.number(value) + ' W',
    allRacks: () => ctx.E.getRackModel(ctx.getState()).racks,
  };
  Object.assign(ctx, createRoomMaterials(ctx));
  Object.assign(ctx, createRoomPrimitives(ctx));
  Object.assign(ctx, createRoomWorld(ctx));
  Object.assign(ctx, createRoomRacks(ctx));
  Object.assign(ctx, createRoomServers(ctx));
  Object.assign(ctx, createRoomLocation(ctx));
  Object.assign(ctx, createRoomTelemetry(ctx));
  Object.assign(ctx, createRoomInput(ctx));
  Object.assign(ctx, createRoomExploration(ctx));
  Object.assign(ctx, createRoomRenderer(ctx));

  return {
    markup: ctx.markup,
    enter: ctx.startExploration,
    mount: ctx.mount,
    update: ctx.update,
    hide: ctx.hide,
    changeLocation: ctx.changeLocation,
    startArrival: ctx.startArrival,
    isArriving: () => Boolean(ctx.arrival),
    isExploring: ctx.isExploring,
    isInRoom: () => ctx.exploring,
    isConsoleOpen: () => ctx.consoleOpen,
    consoleBody: () => ctx.consoleContent,
    openConsole: ctx.openConsole,
    closeConsole: ctx.closeConsole,
    setConsoleTitle: ctx.setConsoleTitle,
    leave: ctx.leave,
    leaveExploration: ctx.leave,
  };
}
