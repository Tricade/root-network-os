const { grantSpace } = require('./helpers/facility.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createServer } = require('../server.cjs');

test('asset GLBs and their external textures are served locally; source and saves remain private', async (t) => {
  const server = createServer({ port: 0 });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const root = path.join(__dirname, '..', 'asset-pack', 'assets');
  const files = await fs.readdir(root, { recursive: true });
  let models = 0;
  const textures = new Set();
  for (const file of files.filter((f) => f.endsWith('.glb'))) {
    const url = '/asset-pack/assets/' + file.replaceAll('\\', '/');
    const response = await fetch(base + url);
    assert.equal(response.status, 200, url);
    assert.match(response.headers.get('content-type'), /model\/gltf-binary/);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.readUInt32LE(0), 0x46546c67);
    assert.equal(bytes.readUInt32LE(4), 2);
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.equal(json.asset.version, '2.0');
    models++;
    for (const image of json.images || [])
      if (image.uri) textures.add(new URL(image.uri, base + url).href);
  }
  assert.equal(models, 47);
  for (const url of textures) {
    const response = await fetch(url);
    assert.equal(response.status, 200, url);
    assert.match(response.headers.get('content-type'), /^image\//);
  }
  for (const url of [
    '/i18n.js',
    '/room-facility.js',
    '/room-instruments.js',
    '/room-assets.js',
    '/room-lounge.js',
    '/vendor/GLTFLoader.js',
    '/vendor/BufferGeometryUtils.js',
    '/vendor/SkeletonUtils.js',
  ])
    assert.equal((await fetch(base + url)).status, 200, url);
  for (const url of [
    '/asset-pack/docs/asset_manifest.json',
    '/asset-pack/../../data/save.json',
    '/asset-pack/source/gltf/rack_42u.gltf',
  ])
    assert.equal((await fetch(base + url)).status, 404, url);
});

test('hollow rack-status frames keep their actual strips instead of an opaque bounding box', async () => {
  const bytes = await fs.readFile(path.join(__dirname, '../asset-pack/assets/racks/rack_42u.glb'));
  const jsonLength = bytes.readUInt32LE(12),
    doc = JSON.parse(bytes.subarray(20, 20 + jsonLength));
  const bin = bytes.subarray(28 + jsonLength),
    node = doc.nodes.find((n) => n.name === 'led_rack_status_frame');
  const {
    Group,
    Mesh,
    MeshStandardMaterial,
    BufferGeometry,
    Float32BufferAttribute,
    DoubleSide,
    Raycaster,
    Vector3,
  } = await import('../vendor/three.module.js');
  const { indexInstance } = await import('../room-assets.js');
  const root = new Group(),
    frame = new Group();
  frame.name = node.name;
  root.add(frame);
  function accessor(index) {
    const a = doc.accessors[index],
      view = doc.bufferViews[a.bufferView],
      count = a.count * (a.type === 'VEC3' ? 3 : 1),
      offset = (view.byteOffset || 0) + (a.byteOffset || 0);
    const read =
        a.componentType === 5126
          ? 'readFloatLE'
          : a.componentType === 5125
            ? 'readUInt32LE'
            : 'readUInt16LE',
      stride = a.componentType === 5123 ? 2 : 4;
    return Array.from({ length: count }, (_, i) => bin[read](offset + i * stride));
  }
  for (const primitive of doc.meshes[node.mesh].primitives) {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(accessor(primitive.attributes.POSITION), 3),
    );
    geometry.setIndex(accessor(primitive.indices));
    frame.add(new Mesh(geometry, new MeshStandardMaterial({ side: DoubleSide })));
  }
  const owned = [],
    instance = indexInstance(root, owned);
  root.updateMatrixWorld(true);
  assert.equal(instance.ledBatch.count, 0, 'status frame is never replaced with a solid cube');
  frame.traverse((n) => {
    if (n.isMesh) assert.equal(n.visible, true);
  });
  const geometry = frame.children[0].geometry;
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new Vector3());
  const ray = new Raycaster(center.clone().add(new Vector3(0, 0, 2)), new Vector3(0, 0, -1));
  assert.equal(ray.intersectObjects(frame.children, true).length, 0, 'the center remains open');
});

test('room navigation maps only owned racks and clamps floor destinations', async () => {
  const E = require('../engine.js'),
    { roomLocation } = await import('../room-facility.js');
  const s = E.createState();
  s.sector = 30;
  s.facility.racks = Array.from({ length: 25 }, (_, i) => ({
    ...s.facility.racks[0],
    id: 'rack-' + (i + 1),
  }));
  grantSpace(s, { specialRooms: ['control', 'ups'] });
  const layout = E.getFacilityLayout(s);
  assert.deepEqual(roomLocation(layout, 'room-5').rackIds, ['rack-25']);
  assert.equal(roomLocation(layout, 'room-5').floor, 2);
  assert.equal(roomLocation(layout, 'hall', 100).floor, 2);
  assert.equal(roomLocation(layout, 'control', 100).floor, 1, 'one central control room');
  assert.deepEqual(roomLocation(layout, 'ups').rackIds, []);
  assert.equal(roomLocation(layout, 'room-9').id, 'hall');
});

test('all server sizes route network and power cables within the physical rack envelope', async () => {
  const { makeRackCableCurve } = await import('../room-assets.js');
  const { Vector3 } = await import('../vendor/three.module.js');
  for (const depth of [0.65, 0.72, 0.76, 0.8])
    for (let logicalUnit = 2; logicalUnit <= 17; logicalUnit++)
      for (const power of [false, true]) {
        const y = 0.1 + (logicalUnit + 16 - 1) * 0.04445 + 0.018;
        const start = new Vector3(power ? 0.163 : -0.178, y, 0.47 - depth - 0.002);
        const end = new Vector3(
          -0.105 + (logicalUnit - 2) * 0.014,
          power ? 0.1 + 16 * 0.04445 + 0.018898 : 0.1 + 33 * 0.04445 + 0.01718,
          0.486,
        );
        const curve = makeRackCableCurve(
          start,
          end,
          (power ? 1 : -1) * (0.261 + logicalUnit * 0.0006),
        );
        assert.ok(curve.getPoint(0).distanceTo(start) < 1e-8);
        assert.ok(curve.getPoint(1).distanceTo(end) < 1e-8);
        for (const point of curve.getPoints(256)) {
          assert.ok(Math.abs(point.x) + 0.0035 < 0.29, 'side panel clearance');
          assert.ok(
            point.z + 0.0035 < 0.535 && point.z - 0.0035 > -0.535,
            'front and rear door clearance',
          );
          assert.ok(point.y > 0 && point.y < 2.067, 'vertical cabinet clearance');
        }
      }
});

test('movement stops on keyup, lost release, focus reset and stale repeats', async () => {
  const { createMovementKeys } = await import('../room.js');
  let time = 0;
  const keys = createMovementKeys(() => time);
  keys.press('KeyW');
  keys.delete('KeyW');
  assert.equal(keys.size, 0, 'normal release stops immediately');
  keys.press('KeyW');
  time = 1600;
  keys.expire();
  assert.equal(keys.size, 0, 'missing first release cannot latch forever');
  keys.press('KeyW');
  time += 500;
  keys.press('KeyW', true);
  time += 451;
  keys.expire();
  assert.equal(keys.size, 0, 'lost release after repeat stops');
  keys.press('KeyW');
  keys.press('KeyD');
  for (let i = 0; i < 100; i++) {
    time += 100;
    keys.press('KeyD', true);
    keys.expire();
    assert.ok(keys.has('KeyW') && keys.has('KeyD'), 'diagonal hold remains stable');
  }
  keys.clear();
  keys.press('KeyD', true);
  assert.equal(keys.size, 0, 'late repeat cannot revive focus-reset movement');
  keys.press('KeyD');
  assert.equal(keys.size, 1, 'a fresh key press still works');
});
