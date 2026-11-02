import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { metricBox } from './room-surfaces.js';
import { buildSupplyFixtures } from './room/supply-fixtures.js';

// ROOT asset pack 1.0.0. All positions below are meters, +Y up, +Z front.
const U = 0.04445;
const BAY_OFFSET = 16; // The existing 18U operating module sits inside a 42U enclosure.
const FILES = {
  rack: 'racks/rack_42u',
  blank: 'racks/rack_blank_panel_1u',
  edge: 'servers/server_1u_edge',
  compute: 'servers/server_2u_compute',
  storage: 'servers/server_3u_storage',
  ai: 'servers/server_4u_ai',
  switch8: 'network_power/switch_8port',
  switch16: 'network_power/switch_16port',
  patch: 'network_power/patch_panel_24port',
  pdu: 'network_power/rack_pdu',
  duct: 'network_power/cable_management_1u',
  rj45: 'network_power/connector_rj45',
  iec: 'network_power/connector_power_iec',
  floor: 'architecture/floor_tile_standard',
  vent: 'architecture/floor_tile_vent',
  light: 'architecture/ceiling_light_linear',
  tray: 'architecture/cable_tray_overhead',
  cooling: 'architecture/crac_cooling_unit',
  door: 'architecture/fire_door_module',
  desk: 'stations/operator_console_desk',
  terminal: 'stations/wall_terminal_maintenance',
  ups: 'facility/ups_battery_cabinet',
  distribution: 'facility/power_distribution_ats',
  lift: 'facility/elevator_module',
  airlock: 'facility/cyber_bunker_airlock',
  stairs: 'facility/stairs_flight',
  sofa: 'interiors/sofa',
  chair: 'interiors/chair',
  coffee: 'interiors/coffee',
  plant: 'interiors/plant',
  pumpSkid: 'operations/pump_heat_exchanger_skid',
  enclosedPump: 'operations/enclosed_pump_skid',
  airHandler: 'operations/room_air_handler',
  centralChiller: 'operations/central_chiller_module',
  siteBarrier: 'operations/site_barrier_segment',
  siteBoard: 'operations/site_information_board',
  materialPallet: 'operations/construction_material_pallet',
};
const controlled = (node) =>
  /^(led_|label_|monitor_screen|rack_nameplate|rack_door_|fire_door_leaf|bunker_door_|lift_door_|ups_door_|distribution_door_|ups_telemetry_display|pdu_telemetry_display|crac_cooling_unit_cabinet_LOD0_5$)/.test(
    node.name,
  ) || /_fan_/.test(node.name);
const ledGeometry = new THREE.BoxGeometry(1, 1, 1);

// The supplied fire-door frame has four repeated bevel-cap triangles. Retain
// opposite windings and separate surfaces; remove only exact same-winding faces.
export function removeDuplicateTriangles(root) {
  let removed = 0;
  root.traverse((mesh) => {
    if (!mesh.isMesh || Array.isArray(mesh.material) || mesh.geometry.groups.length) return;
    const geometry = mesh.geometry,
      position = geometry.attributes.position,
      index = geometry.index;
    const count = index?.count || position.count,
      seen = new Set(),
      keep = [];
    let duplicates = 0;
    for (let i = 0; i < count; i += 3) {
      const ids = [0, 1, 2].map((j) => (index ? index.getX(i + j) : i + j));
      const points = ids.map((id) =>
        [position.getX(id), position.getY(id), position.getZ(id)]
          .map((v) => Math.round(v * 1e6))
          .join(','),
      );
      const key = [
        points.join('|'),
        [points[1], points[2], points[0]].join('|'),
        [points[2], points[0], points[1]].join('|'),
      ].sort()[0];
      if (seen.has(key)) {
        duplicates++;
        continue;
      }
      seen.add(key);
      keep.push(...ids);
    }
    if (duplicates) {
      geometry.setIndex(keep);
      removed += duplicates;
    }
  });
  return removed;
}

export function prepareAssetGeometry(root, key) {
  if (root.userData.geometryPrepared) return root.userData.surfaceRepairs;
  const report = { removedNodes: 0, removedTriangles: 0, movedVertices: 0 },
    remove = [];
  root.traverse((node) => {
    if (
      node.name === 'LOD1' ||
      node.name.startsWith('collider_') ||
      node.name.startsWith('rack_blank_panel_u') ||
      /^rack_(?:18|42)u_blank_u\d+$/.test(node.name)
    )
      remove.push(node);
    if (!node.isMesh || Array.isArray(node.material)) return;
    if (
      (key === 'switch8' || key === 'switch16') &&
      /chassis_LOD0/.test(node.name) &&
      node.material.name === 'mat_brushed_metal'
    ) {
      node.position.z += 0.0015;
      report.movedVertices += node.geometry.attributes.position.count;
    }
    const depth = { edge: 0.65, compute: 0.72, storage: 0.76, ai: 0.8 }[key];
    if (depth && /chassis_LOD0/.test(node.name) && node.material.name === 'mat_vent_grille') {
      // This primitive also contains front and side vents. Move only the flat
      // rear grille, retaining front details and rear connector anchors.
      const p = node.geometry.attributes.position,
        n = node.geometry.attributes.normal;
      for (let i = 0; i < p.count; i++)
        if (Math.abs(p.getZ(i) + depth) < 1e-5 && n.getZ(i) < -0.99) {
          p.setZ(i, p.getZ(i) - 0.0015);
          report.movedVertices++;
        }
      p.needsUpdate = true;
      node.geometry.computeBoundingBox();
      node.geometry.computeBoundingSphere();
    }
  });
  remove.forEach((node) => node.removeFromParent());
  report.removedNodes = remove.length;
  if (key === 'door') report.removedTriangles = removeDuplicateTriangles(root);
  root.userData.geometryPrepared = true;
  root.userData.surfaceRepairs = report;
  return report;
}

// Merge stationary primitives by material, but retain pivots, LEDs, screens and ports.
function compact(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map(),
    remove = [];
  root.traverse((node) => {
    if (!node.isMesh || Array.isArray(node.material)) return;
    let anchor = root,
      cursor = node;
    while (cursor && cursor !== root) {
      if (controlled(cursor)) {
        anchor = cursor;
        break;
      }
      cursor = cursor.parent;
    }
    if (anchor === node) return;
    const key = anchor.uuid + ':' + node.material.uuid;
    if (!buckets.has(key)) buckets.set(key, { anchor, material: node.material, items: [] });
    const local = new THREE.Matrix4().copy(anchor.matrixWorld).invert().multiply(node.matrixWorld);
    buckets.get(key).items.push(node.geometry.clone().applyMatrix4(local));
    remove.push(node);
  });
  for (const node of remove) node.removeFromParent();
  for (const { anchor, material, items } of buckets.values()) {
    const geometry = items.length === 1 ? items[0] : mergeGeometries(items);
    if (!geometry) throw new Error('Asset-Geometrie konnte nicht zusammengeführt werden.');
    if (items.length > 1) items.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'surface_' + material.name;
    mesh.castShadow = !material.transparent;
    mesh.receiveShadow = true;
    anchor.add(mesh);
  }
}

export async function loadRootAssets(onProgress = () => {}) {
  const manager = new THREE.LoadingManager();
  const loader = new GLTFLoader(manager),
    templates = new Map(),
    shared = new Map();
  const failures = [],
    wood = {};
  manager.onError = (url) => failures.push(url);
  THREE.Cache.enabled = true;
  let done = 0;
  const total = Object.keys(FILES).length + 3;
  // GLTFLoader resolves the pack's ../../textures paths; files are served locally.
  await Promise.all(
    Object.entries(FILES).map(async ([key, path]) => {
      const gltf = await loader.loadAsync('./asset-pack/assets/' + path + '.glb');
      const interior = path.startsWith('interiors/');
      let root = interior ? gltf.scene : gltf.scene.children[0];
      prepareAssetGeometry(root, key);
      root.traverse((node) => {
        if (node.isMesh && !Array.isArray(node.material)) {
          const name = interior ? key + ':' + node.material.name : node.material.name;
          if (!shared.has(name)) {
            // The supplied normal atlas is very strong at real scale; retain grain without sparkle.
            if (!interior) node.material.normalScale?.multiplyScalar(0.16);
            if (name === 'mat_perforated_door') node.material.alphaToCoverage = true;
            shared.set(name, node.material);
          }
          node.material = shared.get(name);
          for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) {
            if (node.material[key]) node.material[key].anisotropy = 4;
          }
        }
      });
      compact(root);
      if (interior) {
        const bounds = new THREE.Box3().setFromObject(root),
          center = bounds.getCenter(new THREE.Vector3());
        root.position.add(new THREE.Vector3(-center.x, -bounds.min.y, -center.z));
        const normalized = new THREE.Group();
        normalized.name = 'interior_' + key;
        normalized.add(root);
        root = normalized;
      }
      templates.set(key, root);
      onProgress(++done, total);
    }),
  );
  await Promise.all(
    ['color', 'normal', 'roughness'].map(async (key) => {
      const texture = await new THREE.TextureLoader(manager).loadAsync(
        './asset-pack/textures/interiors/walnut-' + key + '.jpg',
      );
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 4;
      if (key === 'color') texture.colorSpace = THREE.SRGBColorSpace;
      wood[key] = texture;
      onProgress(++done, total);
    }),
  );
  if (failures.length) throw new Error('Asset-Dateien fehlen: ' + failures.join(', '));
  return {
    count: templates.size,
    wood,
    make(key) {
      const root = templates.get(key)?.clone(true);
      if (!root) throw new Error('Unbekanntes ROOT-Asset: ' + key);
      root.userData.assetKey = key;
      return root;
    },
  };
}

export function indexInstance(root, owned) {
  const leds = new Map(),
    fans = [],
    doors = [],
    points = [];
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  root.traverse((node) => {
    if (node.name.startsWith('led_')) {
      const slots = [],
        direct = [];
      leds.set(node.name, { node, slots, direct, state: null });
      node.traverse((child) => {
        if (!child.isMesh) return;
        // A rack LED is a hollow multi-strip frame, never its solid bounding box.
        if (node.name === 'led_rack_status_frame') {
          child.material = child.material.clone();
          owned.push(child.material);
          child.castShadow = false;
          direct.push(child);
          return;
        }
        child.geometry.computeBoundingBox();
        const box = child.geometry.boundingBox,
          size = box.getSize(new THREE.Vector3()),
          center = box.getCenter(new THREE.Vector3());
        const matrix = new THREE.Matrix4().compose(center, new THREE.Quaternion(), size);
        matrix.premultiply(child.matrixWorld).premultiply(inverse);
        slots.push(points.length);
        points.push({ matrix, height: size.y });
        child.visible = false;
      });
    }
    if (/_fan_\d+$/.test(node.name)) fans.push(node);
    if (node.name === 'rack_door_front') doors.push(node);
  });
  const ledMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  owned.push(ledMaterial);
  const ledBatch = new THREE.InstancedMesh(ledGeometry, ledMaterial, points.length);
  ledBatch.name = 'live_status_leds';
  points.forEach((point, i) => {
    ledBatch.setMatrixAt(i, point.matrix);
    ledBatch.setColorAt(i, new THREE.Color(0x0c1316));
  });
  root.add(ledBatch);
  const instance = {
    root,
    leds,
    ledBatch,
    points,
    fans,
    doors,
    speed: 0,
    activity: 0,
    powered: false,
    doorOpen: false,
  };
  for (const name of leds.keys()) led(instance, name, 'off');
  return instance;
}

// Bake rigid surfaces across an assembled rack, retaining live LEDs, fans,
// door pivots, screen labels, cable state and the original interaction targets.
export function batchRackSurfaces(root, excluded, ownedGeometries) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(),
    buckets = new Map();
  root.traverse((node) => {
    if (
      !node.isMesh ||
      node.isInstancedMesh ||
      Array.isArray(node.material) ||
      excluded.has(node) ||
      node.material.transparent ||
      node.material.isMeshBasicMaterial
    )
      return;
    let cursor = node;
    while (cursor && cursor !== root) {
      if (!cursor.visible || controlled(cursor)) return;
      cursor = cursor.parent;
    }
    const attributes = Object.keys(node.geometry.attributes)
      .sort()
      .map((key) => key + ':' + node.geometry.attributes[key].itemSize)
      .join(',');
    const key =
      node.material.uuid +
      ':' +
      Boolean(node.geometry.index) +
      ':' +
      node.castShadow +
      ':' +
      node.receiveShadow +
      ':' +
      attributes;
    if (!buckets.has(key)) buckets.set(key, { material: node.material, items: [] });
    buckets.get(key).items.push(node);
  });
  for (const { material, items } of buckets.values()) {
    if (items.length < 2) continue;
    const copies = items.map((mesh) =>
      mesh.geometry.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)),
    );
    const geometry = mergeGeometries(copies);
    copies.forEach((copy) => copy.dispose());
    if (!geometry) throw new Error('Rack-Oberflächen konnten nicht zusammengeführt werden.');
    ownedGeometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'rack_surface_' + material.name;
    // The cabinet and door supply the large shadow silhouettes; static internals
    // need no separate shadow pass for screws, connectors and blank panels.
    mesh.castShadow = items[0].castShadow;
    mesh.receiveShadow = items[0].receiveShadow;
    root.add(mesh);
    items.forEach((item) => item.removeFromParent());
  }
}

const palette = {
  off: [0x172023, 0x000000, 0],
  green: [0x9ad86a, 0x76c83e, 1.1],
  blue: [0x88d9eb, 0x38a5c0, 1.4],
  amber: [0xe9b96e, 0xc47724, 1.15],
  red: [0xfb6f61, 0xef3728, 1.35],
};
function led(instance, name, state) {
  const entry = instance.leds.get(name);
  if (!entry || entry.state === state) return;
  entry.state = state;
  const color = new THREE.Color((palette[state] || palette.off)[0]);
  for (const mesh of entry.direct) {
    const preset = palette[state] || palette.off;
    mesh.material.color.copy(color);
    mesh.material.emissive?.setHex(preset[1]);
    mesh.material.emissiveIntensity = preset[2];
  }
  for (const slot of entry.slots) instance.ledBatch.setColorAt(slot, color);
  if (instance.ledBatch.instanceColor) instance.ledBatch.instanceColor.needsUpdate = true;
}

function plate(
  parent,
  text,
  subtitle,
  width,
  height,
  position,
  owned,
  textures,
  localizeTitle = false,
) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textures.push(texture);
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  owned.push(material);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.set(...position);
  parent.add(mesh);
  mesh.userData.refreshLabel = () => {
    const tr = (value) => globalThis.ROOTI18N?.translate(String(value)) || String(value);
    ctx.fillStyle = '#10181b';
    ctx.fillRect(0, 0, 1024, 192);
    ctx.fillStyle = '#a8d86d';
    ctx.fillRect(0, 0, 8, 192);
    ctx.fillStyle = '#e2e8e8';
    ctx.font = '600 64px Segoe UI';
    ctx.fillText(localizeTitle ? tr(text) : text, 32, 83, 960);
    ctx.fillStyle = '#91a2a6';
    ctx.font = '34px Consolas';
    ctx.fillText(tr(subtitle), 34, 146, 950);
    texture.needsUpdate = true;
  };
  mesh.userData.refreshLabel();
  return mesh;
}

export function buildAssetRack({ bank, rack, index, scene, hitMaterial }) {
  const root = bank.make('rack'),
    owned = [],
    textures = [],
    geometries = [],
    picks = [],
    servers = new Map();
  const side = index % 2 ? 1 : -1;
  root.position.set(side * 1.65, 0, -Math.floor(index / 2) * 0.84 - 0.25);
  root.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  root.userData.roomKind = 'rack';
  root.userData.rackId = rack.id;
  scene.add(root);
  const cabinet = indexInstance(root, owned),
    occupied = new Set();
  for (const door of cabinet.doors)
    door.traverse((mesh) => {
      if (mesh.isMesh) {
        mesh.userData = { ...mesh.userData, roomKind: 'door', rackId: rack.id };
        picks.push(mesh);
      }
    });
  const instances = [cabinet];
  function mount(device, physicalUnit, units = 1) {
    const slot = root.getObjectByName('slot_u' + String(physicalUnit).padStart(2, '0'));
    if (!slot) throw new Error('Rack-Slot fehlt: ' + physicalUnit);
    root.add(device);
    device.position.copy(slot.position);
    for (let u = physicalUnit; u < physicalUnit + units; u++) occupied.add(u);
    return device;
  }
  function pick(parent, size, pos, data) {
    const geometry = new THREE.BoxGeometry(...size);
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, hitMaterial);
    mesh.position.set(...pos);
    mesh.userData = data;
    parent.add(mesh);
    picks.push(mesh);
  }
  root.getObjectByName('rack_nameplate')?.removeFromParent();
  geometries.push(
    plate(
      root,
      rack.name.toUpperCase(),
      '16 HE BETRIEBSMODUL / ROOT',
      0.46,
      0.065,
      [0, 1.983, 0.544],
      owned,
      textures,
    ).geometry,
  );
  const sw = mount(bank.make(rack.ports.length > 8 ? 'switch16' : 'switch8'), 34);
  const pdu = mount(bank.make('pdu'), 17);
  mount(bank.make('patch'), 35);
  mount(bank.make('duct'), 36);
  const switchRef = indexInstance(sw, owned),
    pduRef = indexInstance(pdu, owned);
  instances.push(switchRef, pduRef);
  for (const server of rack.servers) {
    const type =
      server.type === 'ai'
        ? 'ai'
        : server.units >= 3
          ? 'storage'
          : server.units === 2
            ? 'compute'
            : 'edge';
    const device = mount(bank.make(type), server.unit + BAY_OFFSET, server.units);
    device.traverse((mesh) => {
      if (mesh.isMesh) mesh.castShadow = false;
    });
    const ref = indexInstance(device, owned);
    instances.push(ref);
    servers.set(server.id, ref);
    device.userData.roomKind = 'server';
    device.userData.rackId = rack.id;
    device.userData.serverId = server.id;
    device.traverse((node) => {
      if (node.name.startsWith('label_')) node.visible = false;
    });
    const labelY = server.units * U - 0.009;
    geometries.push(
      plate(
        device,
        server.name,
        server.model + ' / U' + server.unit,
        0.15,
        0.015,
        [-0.115, labelY, 0.024],
        owned,
        textures,
      ).geometry,
    );
    pick(device, [0.482, server.units * U - 0.002, 0.012], [0, (server.units * U) / 2, 0.027], {
      roomKind: 'server',
      rackId: rack.id,
      serverId: server.id,
    });
  }
  const blanks = new THREE.Group();
  root.add(blanks);
  for (let u = 1; u <= 42; u++)
    if (!occupied.has(u)) {
      const blank = bank.make('blank');
      blank.position.copy(root.getObjectByName('slot_u' + String(u).padStart(2, '0')).position);
      blanks.add(blank);
    }
  compact(blanks);
  blanks.traverse((mesh) => {
    if (mesh.isMesh) {
      geometries.push(mesh.geometry);
      mesh.castShadow = false;
    }
  });
  geometries.push(
    plate(root, 'RESERVE', 'NICHT BESTÜCKT', 0.3, 0.05, [0, 0.39, 0.495], owned, textures, true)
      .geometry,
  );
  pick(root, [0.56, 2, 0.01], [0, 1.02, 0.44], { roomKind: 'rack', rackId: rack.id });
  // Network and power terminate on the imported sockets, including rear server IO.
  root.updateMatrixWorld(true);
  const cables = [];
  const cableMat = new THREE.MeshStandardMaterial({
    color: 0x83ad45,
    roughness: 0.53,
    metalness: 0.06,
  });
  owned.push(cableMat);
  const downMat = new THREE.MeshStandardMaterial({ color: 0x665a3d, roughness: 0.64 });
  owned.push(downMat);
  const powerMat = new THREE.MeshStandardMaterial({ color: 0x1b2025, roughness: 0.56 });
  owned.push(powerMat);
  function cable(from, fromName, to, toName, lane, powered, serverId) {
    const a = from.getObjectByName(fromName),
      b = to.getObjectByName(toName);
    if (!a || !b) return;
    const start = root.worldToLocal(a.getWorldPosition(new THREE.Vector3())),
      end = root.worldToLocal(b.getWorldPosition(new THREE.Vector3()));
    const geometry = new THREE.TubeGeometry(
      makeRackCableCurve(start, end, lane),
      64,
      powered ? 0.0035 : 0.0025,
      5,
      false,
    );
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, powered ? powerMat : cableMat);
    root.add(mesh);
    if (!powered) cables.push({ mesh, serverId });
    for (const [port, device, connector] of [
      [a, from, powered ? 'iec' : 'rj45'],
      [b, to, powered ? 'iec' : 'rj45'],
    ]) {
      const plug = bank.make(connector);
      device.add(plug);
      plug.position.copy(device.worldToLocal(port.getWorldPosition(new THREE.Vector3())));
      const normal = port.userData.normal || [0, 0, 1];
      if (normal[2] < 0) plug.rotation.y = Math.PI;
    }
  }
  for (const server of rack.servers) {
    const device = servers.get(server.id).root;
    cable(
      device,
      'port_network_01',
      sw,
      'port_network_' + String(server.port).padStart(2, '0'),
      -0.261 - server.port * 0.0006,
      false,
      server.id,
    );
    cable(
      device,
      'port_power_01',
      pdu,
      'port_power_out_' + String(server.unit - 1).padStart(2, '0'),
      0.261 + (server.unit - 2) * 0.0006,
      true,
      server.id,
    );
  }
  batchRackSurfaces(root, new Set([...picks, ...cables.map((cable) => cable.mesh)]), geometries);
  return {
    asset: true,
    group: root,
    cabinet,
    switchRef,
    pduRef,
    servers,
    picks,
    instances,
    cables,
    cableMat,
    downMat,
    owned,
    textures,
    geometries,
    dispose() {
      instances.forEach((i) => i.ledBatch.dispose());
      owned.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      geometries.forEach((g) => g.dispose());
      root.removeFromParent();
    },
  };
}

// Quadratic corner arcs stay in the convex hull of the cable guide. An unconstrained
// Catmull-Rom spline overshoots those corners and protrudes through rack side panels.
export function makeRackCableCurve(start, end, lane) {
  const rearZ = start.z - 0.035,
    frontZ = 0.521;
  const points = [
    start.clone(),
    new THREE.Vector3(start.x, start.y, rearZ),
    new THREE.Vector3(lane, start.y, rearZ),
    new THREE.Vector3(lane, start.y, frontZ),
    new THREE.Vector3(lane, end.y, frontZ),
    new THREE.Vector3(end.x, end.y, frontZ),
    end.clone(),
  ];
  const clean = points.filter((point, i) => !i || point.distanceTo(points[i - 1]) > 0.00001);
  const curve = new THREE.CurvePath();
  let previous = clean[0];
  for (let i = 1; i < clean.length - 1; i++) {
    const before = clean[i - 1],
      corner = clean[i],
      after = clean[i + 1];
    const radius = Math.min(
      0.018,
      corner.distanceTo(before) * 0.35,
      corner.distanceTo(after) * 0.35,
    );
    const enter = corner.clone().addScaledVector(before.clone().sub(corner).normalize(), radius);
    const leave = corner.clone().addScaledVector(after.clone().sub(corner).normalize(), radius);
    curve.add(new THREE.LineCurve3(previous, enter));
    curve.add(new THREE.QuadraticBezierCurve3(enter, corner, leave));
    previous = leave;
  }
  curve.add(new THREE.LineCurve3(previous, clean.at(-1)));
  return curve;
}

export function updateAssetRack(ref, rack, resilience = {}) {
  const failing = rack.servers.some((s) => s.status === 'failed');
  led(
    ref.cabinet,
    'led_rack_status_frame',
    failing
      ? 'red'
      : resilience.safetyMode || !resilience.online
        ? 'amber'
        : rack.status === 'online'
          ? 'green'
          : 'amber',
  );
  ref.cabinet.speed =
    rack.status === 'maintenance' ? 0 : 1 + Math.max(0, rack.temperature - 22) / 20;
  const switchOn = rack.status !== 'maintenance';
  led(ref.switchRef, 'led_power', switchOn ? 'green' : 'off');
  led(ref.switchRef, 'led_fault', rack.status === 'limited' ? 'amber' : 'off');
  for (const port of rack.ports) {
    led(
      ref.switchRef,
      'led_link_' + String(port.number).padStart(2, '0'),
      port.link ? 'green' : 'off',
    );
    led(
      ref.switchRef,
      'led_act_' + String(port.number).padStart(2, '0'),
      port.trafficMbps > 0 ? 'blue' : 'off',
    );
  }
  for (let p = 1; p <= 16; p++)
    led(
      ref.pduRef,
      'led_pdu_' + String(p).padStart(2, '0'),
      rack.servers.some((s) => s.unit - 1 === p && s.powered) ? 'green' : 'off',
    );
  for (const server of rack.servers) {
    const item = ref.servers.get(server.id);
    if (!item) continue;
    item.powered = server.powered && server.status !== 'maintenance';
    item.activity = server.link && server.status === 'online' ? server.activity : 0;
    item.speed = item.powered ? 0.5 + Math.max(0, server.activity) * 1.5 : 0;
    const fault = server.status === 'failed',
      repair = server.status === 'repairing';
    led(item, 'led_power', item.powered ? 'green' : 'off');
    led(item, 'led_fault', fault ? 'red' : repair || server.warnings.length ? 'amber' : 'off');
    led(item, 'led_boot', server.bootRemaining > 0 ? 'blue' : repair ? 'amber' : 'off');
    for (const name of item.leds.keys()) {
      if (name.startsWith('led_drive_'))
        led(item, name, item.powered ? (fault ? 'red' : repair ? 'amber' : 'green') : 'off');
      if (name.startsWith('led_gpu_load_')) {
        led(
          item,
          name,
          item.powered ? (fault ? 'red' : server.gpuLoad > 0.85 ? 'amber' : 'green') : 'off',
        );
        const load = Math.max(0.04, Math.min(1, server.gpuLoad || 0));
        for (const slot of item.leds.get(name).slots) {
          const source = item.points[slot],
            matrix = source.matrix.clone().multiply(new THREE.Matrix4().makeScale(1, load, 1));
          matrix.elements[13] -= (source.height * (1 - load)) / 2;
          item.ledBatch.setMatrixAt(slot, matrix);
        }
        item.ledBatch.instanceMatrix.needsUpdate = true;
      }
    }
  }
  for (const cable of ref.cables)
    cable.mesh.material = rack.servers.find((s) => s.id === cable.serverId)?.link
      ? ref.cableMat
      : ref.downMat;
}

export function animateAssetRack(ref, delta, elapsed, reduced) {
  for (const item of ref.instances) {
    if (!reduced) for (const fan of item.fans) fan.rotation.z += delta * item.speed * 12;
    led(
      item,
      'led_activity',
      item.activity > 0 && (reduced || Math.sin(elapsed * 13 + item.root.id) > -0.2)
        ? 'blue'
        : 'off',
    );
  }
  for (const door of ref.cabinet.doors) {
    const target = ref.cabinet.doorOpen ? door.userData.maxAngleRad || -2.15 : 0;
    door.rotation.y += (target - door.rotation.y) * (reduced ? 1 : Math.min(1, delta * 6));
  }
}

export function buildAssetHall({ bank, scene, materials }) {
  const group = new THREE.Group();
  group.name = 'asset-hall';
  scene.add(group);
  const serverFixtures = new THREE.Group();
  serverFixtures.name = 'server-services';
  group.add(serverFixtures);
  const closedFloor = new THREE.Group();
  closedFloor.name = 'closed-floor';
  group.add(closedFloor);
  const roomLighting = new THREE.Group();
  roomLighting.name = 'room-lighting';
  group.add(roomLighting);
  function block(size, pos, mat, parent = group) {
    const mesh = metricBox(size, mat);
    mesh.position.set(...pos);
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  block([8.4, 0.15, 10.8], [0, -0.26, 0], materials.floor);
  block([8.4, 0.16, 10.8], [0, 3.12, 0], materials.ceiling);
  const concrete = materials.bunkerConcrete || materials.wall;
  block([0.22, 3.2, 10.8], [-4.2, 1.5, 0], concrete);
  block([0.22, 3.2, 10.8], [4.2, 1.5, 0], concrete);
  block([8.4, 3.2, 0.22], [0, 1.5, -5.4], concrete);
  // The single room exit has a real opening, shared with the corridor portal.
  for (const side of [-1, 1]) block([3.5, 3.2, 0.22], [side * 2.45, 1.5, 5.4], concrete);
  block([1.4, 0.8, 0.22], [0, 2.8, 5.4], concrete);
  // Structural ribs and exposed service runs establish an underground facility.
  for (const z of [-3.6, 0, 3.6]) {
    for (const side of [-1, 1]) {
      const column = block([0.22, 3.05, 0.24], [side * 4.04, 1.5, z], materials.brushed);
      column.name = 'structural-column';
    }
    // 2 mm assembly clearance at each end avoids Float32 edge overlap too.
    const beam = block([7.856, 0.24, 0.24], [0, 2.98, z], materials.shellDark);
    beam.name = 'structural-beam';
  }
  for (const y of [2.42, 2.55])
    for (const side of [-1, 1]) block([0.055, 0.055, 10.6], [side * 3.97, y, 0], materials.trim);
  // Tile hardware is instanced: one shared geometry per surface across the raised floor.
  function tiles(key, points, parent = group) {
    const source = bank.make(key);
    source.updateMatrixWorld(true);
    source.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, points.length);
      const offset = new THREE.Matrix4();
      points.forEach((p, i) => {
        offset.makeTranslation(...p);
        inst.setMatrixAt(i, offset.clone().multiply(mesh.matrixWorld));
      });
      inst.receiveShadow = true;
      parent.add(inst);
    });
  }
  const solid = [],
    vents = [];
  // Floor assets have their walking surface at local Y=0. Keep them above
  // the support slab and on the same datum as the racks and corridor floor.
  for (let x = -3.9; x < 4; x += 0.6)
    for (let z = -5.1; z < 5.2; z += 0.6)
      (Math.abs(Math.abs(x) - 0.9) < 0.01 && z < 1.6 ? vents : solid).push([x, 0, z]);
  tiles('floor', solid);
  tiles('vent', vents, serverFixtures);
  tiles('floor', vents, closedFloor);
  for (const x of [-1.04, 1.04])
    block([0.035, 0.002, 4.8], [x, 0.003, -0.6], materials.green, serverFixtures);
  for (const z of [-3.6, 0, 3.6]) {
    const lamp = bank.make('light');
    lamp.position.set(0, 2.72, z);
    serverFixtures.add(lamp);
    const light = new THREE.PointLight(0xdfeaf0, 8.0, 7.0, 2);
    light.position.set(0, 2.6, z);
    serverFixtures.add(light);
    for (const x of [-1.65, 1.65]) {
      const tray = bank.make('tray');
      tray.position.set(x, 2.69, z);
      serverFixtures.add(tray);
    }
  }
  // Utility/control lighting stays beside the walls, above and clear of the display wall.
  for (const side of [-1, 1])
    for (const z of [-2.4, 2.4]) {
      const lamp = bank.make('light');
      lamp.position.set(side * 3.55, 2.72, z);
      roomLighting.add(lamp);
      const light = new THREE.PointLight(0xffe3bf, 10, 6, 2);
      light.position.set(side * 2.8, 2.7, z);
      roomLighting.add(light);
    }
  const coolingFans = [];
  const localCooling = new THREE.Group();
  localCooling.name = 'local-cooling-units';
  serverFixtures.add(localCooling);
  const connections = buildSupplyFixtures(materials, bank);
  serverFixtures.add(connections.group);
  connections.set();
  for (const x of [-3.25, 3.25]) {
    const cooling = bank.make('cooling');
    cooling.position.set(x, 0, -4.45);
    localCooling.add(cooling);
    cooling.traverse((node) => {
      if (/^cooling_fan_\d+$/.test(node.name)) coolingFans.push(node);
    });
  }
  return {
    group,
    get coolingFans() {
      if (!serverFixtures.visible) return [];
      return [
        ...(localCooling.visible ? coolingFans : []),
        ...(connections.cooling.visible ? connections.fans : []),
      ];
    },
    setServerRoom(value, supply = { cooling: 'local', power: 'local' }, rackCount = 0) {
      serverFixtures.visible = value;
      localCooling.visible = supply.cooling !== 'central';
      connections.set(supply, rackCount);
      closedFloor.visible = !value;
      roomLighting.visible = !value;
    },
  };
}
