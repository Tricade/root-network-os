import * as THREE_DEFAULT from '../vendor/three.module.js';

/** Shared ownership and drawing helpers for streamed operational props. */
export function createOperationsAssetKit({
  THREE = THREE_DEFAULT,
  group,
  bank,
  colliders,
  pickTargets,
}) {
  const ownedGeometries = new Set(),
    ownedMaterials = new Set(),
    ownedTextures = new Set(),
    ownedColliders = new Set(),
    ownedPicks = new Set(),
    screens = new Map(),
    ledMaterials = new Map();

  const make = (key, name, position, turn = 0, parent = group, scale = 1) => {
    if (!bank) return null;
    const asset = bank.make(key);
    asset.name = name;
    asset.position.set(...position);
    asset.rotation.y = turn;
    if (scale !== 1) asset.scale.setScalar(scale);
    parent.add(asset);
    registerLeds(asset);
    return asset;
  };

  function registerLeds(root) {
    root.traverse((node) => {
      if (!node.name.startsWith('led_')) return;
      const list = [];
      node.traverse((mesh) => {
        if (!mesh.isMesh) return;
        const originals = Array.isArray(mesh.material) ? mesh.material : [mesh.material],
          copies = originals.map((material) => {
            const cloned = material.clone();
            ownedMaterials.add(cloned);
            return cloned;
          });
        mesh.material = Array.isArray(mesh.material) ? copies : copies[0];
        mesh.castShadow = false;
        list.push(...copies);
      });
      if (list.length) ledMaterials.set(node, list);
    });
  }

  function setLed(root, name, hex) {
    const node = root?.getObjectByName(name),
      list = node && ledMaterials.get(node);
    if (!list) return;
    for (const material of list) {
      material.color?.setHex(hex);
      material.emissive?.setHex(hex);
      if (material.emissiveIntensity !== undefined) material.emissiveIntensity = hex ? 0.75 : 0;
    }
  }

  function addObstacle(root, margin = 0.08) {
    const bounds = new THREE.Box3().setFromObject(root),
      size = bounds.getSize(new THREE.Vector3()),
      center = bounds.getCenter(new THREE.Vector3()),
      rect = { x: center.x, z: center.z, hx: size.x / 2 + margin, hz: size.z / 2 + margin };
    colliders.push(rect);
    ownedColliders.add(rect);
    return rect;
  }

  function removeObstacle(rect) {
    const index = colliders.indexOf(rect);
    if (index >= 0) colliders.splice(index, 1);
    ownedColliders.delete(rect);
  }

  function screen(root, id, view, width, height, position) {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = Math.round((512 * height) / width);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const geometry = new THREE.PlaneGeometry(width, height),
      face = new THREE.Mesh(geometry, material);
    face.name = 'operations-live-screen-' + id;
    face.position.set(...position);
    face.position.add(new THREE.Vector3(0, 0, 0.004));
    face.userData = {
      roomKind: 'station',
      view,
      label: screenLabel(id),
      stationId: 'operations-' + id,
    };
    root.add(face);
    ownedGeometries.add(geometry);
    ownedMaterials.add(material);
    ownedTextures.add(texture);
    pickTargets.push(face);
    ownedPicks.add(face);
    const ref = { id, canvas, texture, face, key: '' };
    screens.set(id, ref);
    return ref;
  }

  const screenLabel = (id) =>
    ({
      cooling: 'Kühlanlage',
      sensorLeft: 'Umweltsensor',
      sensorRight: 'Umweltsensor',
      robotDock: 'Wartungsroboter',
      siteBoard: 'Baustellenstatus',
    })[id] || id;

  function draw(ref, heading, primary, secondary, ratio, accent) {
    if (!ref) return;
    const tr = (value) => globalThis.ROOTI18N?.translate(String(value)) || String(value);
    heading = tr(heading);
    primary = tr(primary);
    secondary = tr(secondary);
    const color = typeof accent === 'number' ? '#' + accent.toString(16).padStart(6, '0') : accent;
    const key = JSON.stringify([heading, primary, secondary, ratio, color]);
    if (key === ref.key) return;
    const ctx = ref.canvas.getContext('2d'),
      w = ref.canvas.width,
      h = ref.canvas.height;
    ctx.fillStyle = '#10191c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1d2c30';
    ctx.fillRect(0, 0, w, h * 0.21);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 7, h);
    ctx.font = `700 ${h * 0.1}px Segoe UI, Arial`;
    ctx.fillStyle = '#edf3ef';
    ctx.fillText(String(heading).slice(0, 30).toLocaleUpperCase(), 24, h * 0.15, 465);
    ctx.font = `600 ${h * 0.14}px Segoe UI, Arial`;
    ctx.fillStyle = color;
    ctx.fillText(String(primary).slice(0, 25), 25, h * 0.47, 460);
    ctx.font = `${h * 0.09}px Segoe UI, Arial`;
    ctx.fillStyle = '#b6c4c0';
    ctx.fillText(String(secondary).slice(0, 42), 25, h * 0.69, 460);
    ctx.fillStyle = '#2b3b3e';
    ctx.fillRect(25, h * 0.86, 455, h * 0.035);
    ctx.fillStyle = color;
    ctx.fillRect(25, h * 0.86, 455 * Math.max(0, Math.min(1, Number(ratio) || 0)), h * 0.035);
    ref.texture.needsUpdate = true;
    ref.key = key;
  }

  function addPipe(parent, name, points, hex, radius = 0.027) {
    const curve = new THREE.CatmullRomCurve3(
        points.map((p) => new THREE.Vector3(...p)),
        false,
        'centripetal',
      ),
      length = Math.max(24, Math.ceil(curve.getLength() * 14)),
      geometry = new THREE.TubeGeometry(curve, length, radius, 10, false),
      material = new THREE.MeshStandardMaterial({ color: hex, metalness: 0.43, roughness: 0.44 }),
      mesh = new THREE.Mesh(geometry, material);
    geometry.computeBoundingBox();
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    ownedGeometries.add(geometry);
    ownedMaterials.add(material);
    return mesh;
  }

  function removeScreen(ref) {
    if (!ref) return;
    ref.face.removeFromParent();
    const i = pickTargets.indexOf(ref.face);
    if (i >= 0) pickTargets.splice(i, 1);
    ownedPicks.delete(ref.face);
    screens.delete(ref.id);
    ownedTextures.delete(ref.texture);
    ownedMaterials.delete(ref.face.material);
    ownedGeometries.delete(ref.face.geometry);
    ref.texture.dispose();
    ref.face.material.dispose();
    ref.face.geometry.dispose();
  }

  function releaseModel(root) {
    root.traverse((node) => {
      for (const material of ledMaterials.get(node) || []) {
        ownedMaterials.delete(material);
        material.dispose();
      }
      ledMaterials.delete(node);
    });
  }

  function dispose() {
    for (const face of ownedPicks) {
      const i = pickTargets.indexOf(face);
      if (i >= 0) pickTargets.splice(i, 1);
    }
    ownedPicks.clear();
    for (const rect of ownedColliders) removeObstacle(rect);
    ownedTextures.forEach((texture) => texture.dispose());
    ownedMaterials.forEach((material) => material.dispose());
    ownedGeometries.forEach((geometry) => geometry.dispose());
    ownedTextures.clear();
    ownedMaterials.clear();
    ownedGeometries.clear();
    screens.clear();
    ledMaterials.clear();
  }

  return {
    make,
    setLed,
    addObstacle,
    removeObstacle,
    screen,
    screenLabel,
    draw,
    addPipe,
    removeScreen,
    releaseModel,
    screens,
    colliders,
    dispose,
  };
}
