import * as THREE from '../vendor/three.module.js';

// Offset a horizontal route with proper mitered corners. Rails and cables use
// the same centreline so neither cuts across the inside of a tray bend.
function offsetRoute(points, offset) {
  const up = new THREE.Vector3(0, 1, 0),
    vertices = points.map((p) => new THREE.Vector3(...p));
  const directions = vertices.slice(1).map((p, i) => p.clone().sub(vertices[i]).normalize());
  return vertices.map((point, i) => {
    const before = directions[Math.max(0, i - 1)],
      after = directions[Math.min(i, directions.length - 1)],
      a = up.clone().cross(before),
      b = up.clone().cross(after),
      bisector = a.add(b).normalize();
    return point
      .clone()
      .addScaledVector(bisector, offset / bisector.dot(b))
      .toArray();
  });
}

function railGeometry(points, offset, thickness) {
  const inside = offsetRoute(points, offset - thickness / 2),
    outside = offsetRoute(points, offset + thickness / 2),
    positions = [],
    indices = [];
  for (let i = 0; i < points.length; i++) {
    for (const [p, dy] of [
      [inside[i], -0.03],
      [outside[i], -0.03],
      [inside[i], 0.055],
      [outside[i], 0.055],
    ])
      positions.push(p[0], p[1] + dy, p[2]);
  }
  const quad = (a, b, c, d) => indices.push(a, b, c, a, c, d);
  for (let i = 1; i < points.length; i++) {
    const a = (i - 1) * 4,
      b = i * 4;
    quad(a, b, b + 2, a + 2);
    quad(a + 1, a + 3, b + 3, b + 1);
    quad(a + 2, b + 2, b + 3, a + 3);
    quad(a, a + 1, b + 1, b);
  }
  quad(0, 2, 3, 1);
  const end = (points.length - 1) * 4;
  quad(end, end + 1, end + 3, end + 2);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(new Array((positions.length / 3) * 2).fill(0), 2),
  );
  geometry.setIndex(indices);
  const flat = geometry.toNonIndexed();
  geometry.dispose();
  flat.computeVertexNormals();
  return flat;
}

/** Original open ladder tray with continuous round cable bundles. Structural
 * metal is batched once per tray; no rung adds a permanent draw call. */
export function buildCableTray(kit, parent, points, name, width = 0.22) {
  const group = new THREE.Group(),
    metal = new THREE.Group();
  group.name = name;
  group.userData.route = points;
  metal.name = 'open-tray-metal';
  group.add(metal);
  parent.add(group);
  // Only the cables enter the sealed wall sleeve, not the wider tray rails.
  const structure = points.map((p) => [
    p[0],
    p[1],
    Math.abs(p[2]) > 5.29 ? Math.sign(p[2]) * 5.17 : p[2],
  ]);
  for (const side of [-1, 1])
    kit.mesh(
      metal,
      railGeometry(structure, (side * width) / 2, 0.012),
      kit.steel,
      [0, 0, 0],
      'tray-side-rail',
    );
  for (let i = 1; i < structure.length; i++) {
    const a = new THREE.Vector3(...structure[i - 1]),
      b = new THREE.Vector3(...structure[i]),
      direction = b.clone().sub(a),
      length = direction.length();
    direction.normalize();
    for (let distance = 0.12; distance < length - 0.08; distance += 0.28) {
      const position = a.clone().addScaledVector(direction, distance);
      position.y -= 0.022;
      const rung = kit.box(
        metal,
        [width - 0.01, 0.016, 0.028],
        position.toArray(),
        'tray-rung',
        kit.steel,
      );
      rung.rotation.y = Math.atan2(direction.x, direction.z);
    }
  }
  kit.batch(metal);
  for (const offset of [-0.055, 0, 0.055]) {
    const cable = kit.pipe(group, offsetRoute(points, offset), 'tray-power-cable', 0.014, 8);
    cable.material = kit.gasket;
  }
  return group;
}

/** Cabinet tails remain flexible and terminate in the roof glands. */
export function buildCableTail(kit, parent, points, name) {
  const group = new THREE.Group();
  group.name = name;
  group.userData.route = points;
  parent.add(group);
  for (const offset of [-0.034, 0, 0.034]) {
    const cable = kit.pipe(
      group,
      points.map((p) => [p[0], p[1], p[2] + offset]),
      'plant-feeder-cable',
      0.012,
      8,
    );
    cable.material = kit.gasket;
  }
  return group;
}
