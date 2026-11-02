const test = require('node:test'),
  assert = require('node:assert/strict'),
  path = require('node:path');
const root = path.resolve(__dirname, '..');
async function modules() {
  return {
    T: await import('../vendor/three.module.js'),
    A: await import('../room-assets.js'),
    Q: await import('../tools/audit-assets.mjs'),
  };
}
async function model(Q, file) {
  return Q.loadGeometry(path.join(root, 'asset-pack/assets', file + '.glb'));
}

test('every bundled GLB has finite active geometry, no degenerate/duplicate runtime faces and valid local textures', async () => {
  const { Q } = await modules(),
    report = await Q.audit();
  assert.equal(report.length, 47);
  for (const r of report) {
    assert.equal(r.runtime.nonfinite, 0, r.file);
    assert.equal(r.runtime.degenerate, 0, r.file);
    assert.equal(r.runtime.duplicates, 0, r.file);
    assert.deepEqual(r.missingTextures, [], r.file);
  }
});

test('imported rack blanks are removed before real devices and empty-slot blanks are installed', async () => {
  const { A, Q } = await modules();
  for (const type of ['18', '42']) {
    const scene = await model(Q, 'racks/rack_' + type + 'u');
    let count = 0;
    scene.traverse((n) => {
      if (new RegExp('rack_' + type + 'u_blank_u').test(n.name)) count++;
    });
    assert.ok(count > 0);
    A.prepareAssetGeometry(scene, 'rack');
    scene.traverse((n) => assert.doesNotMatch(n.name, /rack_(?:18|42)u_blank_u\d+/));
    assert.ok(scene.getObjectByName('slot_u01'), 'hardware anchors remain intact');
  }
});

test('rear server grille separation preserves the front faces and cable connector anchors', async () => {
  const { A, Q } = await modules();
  for (const [key, file, depth] of [
    ['edge', 'server_1u_edge', 0.65],
    ['compute', 'server_2u_compute', 0.72],
    ['storage', 'server_3u_storage', 0.76],
    ['ai', 'server_4u_ai', 0.8],
  ]) {
    const scene = Q.visibleLod(await model(Q, 'servers/' + file)),
      rear = [],
      front = [];
    const anchor = scene.getObjectByName('port_network_01'),
      at = anchor.position.clone();
    scene.traverse((n) => {
      if (!n.isMesh || n.material.name !== 'mat_vent_grille' || !/chassis_LOD0/.test(n.name))
        return;
      const p = n.geometry.attributes.position,
        norm = n.geometry.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        if (Math.abs(p.getZ(i) + depth) < 1e-5 && norm.getZ(i) < -0.99)
          rear.push({ p, i, z: p.getZ(i) });
        if (p.getZ(i) >= 0) front.push({ p, i, z: p.getZ(i) });
      }
    });
    assert.ok(rear.length > 0);
    A.prepareAssetGeometry(scene, key);
    for (const v of rear) assert.ok(Math.abs(v.p.getZ(v.i) - v.z + 0.0015) < 1e-6);
    for (const v of front) assert.equal(v.p.getZ(v.i), v.z);
    assert.ok(anchor.position.equals(at));
    assert.equal(
      A.prepareAssetGeometry(scene, key),
      scene.userData.surfaceRepairs,
      'repairs are idempotent',
    );
  }
});

test('switch metal trim no longer shares the powder-coated front plane', async () => {
  const { A, Q } = await modules();
  for (const [key, file] of [
    ['switch8', 'switch_8port'],
    ['switch16', 'switch_16port'],
  ]) {
    const scene = Q.visibleLod(await model(Q, 'network_power/' + file));
    const clash = (r) =>
      [r.a.node, r.b.node].some((n) => n === file + '_chassis_LOD0_1') &&
      [r.a.node, r.b.node].some((n) => n === file + '_chassis_LOD0_2');
    assert.ok(Q.coplanarOverlaps(scene).some(clash));
    A.prepareAssetGeometry(scene, key);
    assert.equal(Q.coplanarOverlaps(scene).some(clash), false);
  }
});

test('door frame and grip surfaces are separated and the sight window has a real aperture', async () => {
  const { T, A, Q } = await modules(),
    scene = await model(Q, 'facility/cyber_bunker_airlock');
  A.prepareAssetGeometry(scene, 'airlock');
  scene.updateMatrixWorld(true);
  const overlaps = Q.coplanarOverlaps(scene);
  assert.equal(
    overlaps.some(
      (r) =>
        r.a.node.startsWith('bunker_portal_frame_mesh') &&
        r.b.node.startsWith('bunker_portal_frame_mesh'),
    ),
    false,
    'jambs, lintel and inner stops do not overlap at the visible front',
  );
  assert.equal(
    overlaps.some(
      (r) =>
        r.a.node.startsWith('bunker_door_handwheel_mesh') &&
        r.b.node.startsWith('bunker_door_handwheel_mesh'),
    ),
    false,
  );
  const opaque = [];
  scene.traverse((n) => {
    if (n.isMesh && !n.material.transparent) opaque.push(n);
  });
  assert.equal(
    new T.Raycaster(new T.Vector3(0, 1.685, 0.5), new T.Vector3(0, 0, -1), 0, 1).intersectObjects(
      opaque,
      false,
    ).length,
    0,
    'rubber surrounds the glass instead of blocking it',
  );
});

test('UPS and ATS have opaque instrument fascias and closed centre seams', async () => {
  const { T, A, Q } = await modules();
  for (const [key, file] of [
    ['ups', 'ups_battery_cabinet'],
    ['distribution', 'power_distribution_ats'],
  ]) {
    const scene = await model(Q, 'facility/' + file);
    A.prepareAssetGeometry(scene, key);
    scene.updateMatrixWorld(true);
    const meshes = [];
    scene.traverse((n) => {
      if (n.isMesh && !n.material.transparent) meshes.push(n);
    });
    for (const [x, y] of [
      [0, 1.82],
      [-0.15, 1.95],
      [0.15, 1.95],
      [0, 0.3],
      [0, 0.9],
      [0, 1.55],
    ]) {
      const hit = new T.Raycaster(
        new T.Vector3(x, y, 1),
        new T.Vector3(0, 0, -1),
        0,
        2,
      ).intersectObjects(meshes, false)[0];
      assert.ok(hit && hit.point.z > 0.2, `${key} front is closed at ${x},${y}`);
    }
  }
});

test('ceiling beams meet columns without a shared exposed front patch', async () => {
  const { T, A, Q } = await modules(),
    scene = new T.Scene(),
    material = new T.MeshStandardMaterial();
  const hall = A.buildAssetHall({
    bank: { make: () => new T.Group() },
    scene,
    materials: new Proxy({}, { get: () => material }),
  });
  const members = new T.Group();
  hall.group.traverse((n) => {
    if (['structural-beam', 'structural-column'].includes(n.name)) members.add(n.clone());
  });
  assert.equal(Q.coplanarOverlaps(members, { differentMaterials: false }).length, 0);
});

test('stair risers stop below their metal nosings and cabinet side skins clear the plinth', async () => {
  const { A, Q } = await modules(),
    stairs = await model(Q, 'facility/stairs_flight');
  A.prepareAssetGeometry(stairs, 'stairs');
  assert.equal(
    Q.coplanarOverlaps(stairs).filter((r) =>
      [r.a.node, r.b.node].every((n) => n.startsWith('stairs_treads_risers_mesh')),
    ).length,
    0,
    'all tread/riser material joins have no exposed shared patch',
  );
  for (const [key, file, width] of [
    ['ups', 'ups_battery_cabinet', 0.86],
    ['distribution', 'power_distribution_ats', 1.16],
  ]) {
    const scene = await model(Q, 'facility/' + file);
    A.prepareAssetGeometry(scene, key);
    const outerSide = (r) =>
      Math.abs(Number(r.plane.split(':')[0])) === 1000000 &&
      Number(r.plane.split(':')[3]) === Math.round((width / 2) * 1e6);
    assert.equal(
      Q.coplanarOverlaps(scene).filter(outerSide).length,
      0,
      key + ' has no overlapping side/plinth materials',
    );
  }
});
