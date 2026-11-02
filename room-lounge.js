import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

// Furniture is authored locally by tools/asset-generator/build_interiors.mjs,
// metric and floor-normalized by the asset bank. Keep the
// operator aisle and entrance empty; collider footprints come from the models.
export function createControlLounge({ THREE, parent, bank, geometries, materials }) {
  const group = new THREE.Group();
  group.name = 'control-lounge';
  parent.add(group);
  const lining = new THREE.Group();
  lining.name = 'control-wall-lining';
  group.add(lining);
  const colliders = [];
  const material = (options) => {
    const result = new THREE.MeshStandardMaterial(options);
    materials.add(result);
    return result;
  };
  const acoustic = material({ color: 0x253335, roughness: 0.96 });
  const steel = material({ color: 0x1b2225, metalness: 0.72, roughness: 0.36 });
  const walnut = material({
    color: 0xd9c6b0,
    roughness: 0.88,
    map: bank.wood?.color || null,
    normalMap: bank.wood?.normal || null,
    roughnessMap: bank.wood?.roughness || null,
    normalScale: new THREE.Vector2(0.3, 0.3),
  });
  const warm = new THREE.MeshBasicMaterial({ color: 0xffd5a0 });
  materials.add(warm);
  function block(size, position, mat, radius = 0) {
    const geometry = radius
      ? new RoundedBoxGeometry(...size, 2, radius)
      : new THREE.BoxGeometry(...size);
    // Each visible slat is a cut of the same veneer, with vertical grain at
    // real scale, rather than a stretched texture over the complete wall.
    if (mat === walnut) {
      const uv = geometry.attributes.uv,
        p = geometry.attributes.position,
        n = geometry.attributes.normal;
      for (let i = 0; i < uv.count; i++) {
        if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, p.getZ(i) / 1.5, p.getX(i) / 0.3);
        else
          uv.setXY(
            i,
            p.getY(i) / 1.5,
            (Math.abs(n.getX(i)) > 0.5 ? p.getZ(i) : p.getX(i)) / 0.3 + position[2] * 0.27,
          );
      }
    }
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(...position);
    mesh.castShadow = mat !== warm;
    mesh.receiveShadow = true;
    lining.add(mesh);
    return mesh;
  }
  function furniture(key, x, z, turn = 0, y = 0) {
    const model = bank.make(key);
    model.name = 'control-' + key;
    model.position.set(x, y, z);
    model.rotation.y = turn;
    group.add(model);
    const bounds = new THREE.Box3().setFromObject(model),
      center = bounds.getCenter(new THREE.Vector3()),
      size = bounds.getSize(new THREE.Vector3());
    colliders.push({ x: center.x, z: center.z, hx: size.x / 2 + 0.15, hz: size.z / 2 + 0.15 });
    return model;
  }
  // The display wall is acoustic fabric; warm timber is confined to the lounge.
  block([7.85, 2.65, 0.075], [0, 1.56, -5.22], acoustic);
  block([0.06, 2.14, 3.4], [4.015, 1.36, 2.15], steel);
  for (let z = 0.52; z <= 3.8; z += 0.11)
    block([0.055, 2.08, 0.074], [3.966, 1.36, z], walnut, 0.012);
  block([0.026, 0.018, 3.28], [3.925, 2.43, 2.15], warm);
  // Low skirting conceals power/data runs instead of running trays over displays.
  for (const side of [-1, 1]) block([0.08, 0.14, 10.68], [side * 3.985, 0.07, 0], steel);
  const rug = material({ color: 0x263536, roughness: 1 });
  block([2.85, 0.014, 3.42], [2.4, 0.012, 2.05], rug, 0.006);
  furniture('sofa', 3.28, 2.05, -Math.PI / 2, 0.019);
  for (const x of [-1.65, 1.65]) furniture('chair', x, -0.98, Math.PI);
  furniture('coffee', -3.4, 2.55, Math.PI / 2);
  // Original floor-standing plant, with a grounded pot and connected stems.
  furniture('plant', -3.45, 0.6);
  // Rounded coffee table with two joined, floor-supported steel sleds.
  block([0.68, 0.055, 1.22], [2.14, 0.47, 2.05], walnut, 0.025);
  // Use the same veneer in its natural table orientation.
  for (const z of [1.61, 2.49]) {
    for (const x of [1.92, 2.36]) block([0.035, 0.42, 0.035], [x, 0.223, z], steel, 0.006);
    block([0.475, 0.028, 0.04], [2.14, 0.028, z], steel, 0.006);
  }
  colliders.push({ x: 2.14, z: 2.05, hx: 0.49, hz: 0.76 });
  const lamp = new THREE.PointLight(0xffd2a3, 7, 6, 2);
  lamp.position.set(2.8, 2.6, 2.1);
  group.add(lamp);
  // Merge only locally owned lining. Generated furniture assets stay shared and
  // retain their indexed geometry, avoiding one copy per chair or per refresh.
  lining.updateMatrixWorld(true);
  const inverse = lining.matrixWorld.clone().invert(),
    buckets = new Map(),
    old = [];
  lining.traverse((mesh) => {
    if (!mesh.isMesh) return;
    if (!buckets.has(mesh.material)) buckets.set(mesh.material, []);
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    geometry.applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
    buckets.get(mesh.material).push(geometry);
    old.push(mesh);
  });
  old.forEach((mesh) => {
    mesh.removeFromParent();
    mesh.geometry.dispose();
    geometries.delete(mesh.geometry);
  });
  for (const [mat, items] of buckets) {
    const geometry = mergeGeometries(items);
    items.forEach((item) => item.dispose());
    if (!geometry) throw new Error('Control-room lining has incompatible geometry');
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = mat !== warm;
    mesh.receiveShadow = true;
    lining.add(mesh);
  }
  return { group, colliders };
}
