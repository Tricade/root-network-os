const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

async function model(file, THREE) {
  const { GLTFLoader } = await import('../vendor/GLTFLoader.js');
  const { prepareAssetGeometry } = await import('../room-assets.js');
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'geometry_only', loadTexture: async () => new THREE.Texture() }));
  const bytes = await fs.readFile(
    path.join(__dirname, '../asset-pack/assets/operations', file + '.glb'),
  );
  const root = (
    await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    )
  ).scene;
  prepareAssetGeometry(root, file);
  return root;
}

test('central room air handler joins the real water ports and floor plenum, with no compressor prop', async () => {
  const THREE = await import('../vendor/three.module.js');
  const { buildSupplyFixtures } = await import('../room/supply-fixtures.js');
  const air = await model('room_air_handler', THREE);
  const requested = [];
  const fixtures = buildSupplyFixtures(
    {},
    {
      make: (key) => {
        requested.push(key);
        return air.clone(true);
      },
    },
  );
  assert.deepEqual(requested, ['airHandler']);
  assert.equal(fixtures.fans.length, 2, 'actual fan nodes survive batching');
  fixtures.set({ cooling: 'central', power: 'local' }, 6);
  assert.equal(fixtures.cooling.visible, true);
  fixtures.group.updateMatrixWorld(true);
  const ports = fixtures.cooling.getObjectByName('air_handler_chw_in_out');
  const anchor = ports.getWorldPosition(new THREE.Vector3());
  const expected = [ports.userData.supply, ports.userData.return].map((p) =>
    p.map((v, i) => v + anchor.getComponent(i)),
  );
  const ends = [];
  fixtures.cooling.traverse((n) => {
    if (n.name === 'room-water-circuit') ends.push(n.userData.route.at(-1));
  });
  for (const endpoint of ends)
    assert.ok(expected.some((p) => p.every((v, i) => Math.abs(v - endpoint[i]) < 1e-5)));
  const casing = new THREE.Box3().setFromObject(
    fixtures.cooling.getObjectByName('air_handler_closed_casing_and_guards'),
  );
  fixtures.cooling.traverse((n) => {
    if (n.name === 'floor-plenum-outlet') {
      const bounds = new THREE.Box3().setFromObject(n);
      assert.ok(
        bounds.min.y <= 0 && bounds.max.y >= casing.min.y,
        'air path reaches floor and casing',
      );
    }
  });
  fixtures.set({ cooling: 'local', power: 'local' });
  assert.equal(fixtures.cooling.visible, false);
  fixtures.dispose();
});

test('pump upgrades replace the starter; prepared service props are never placed in unrelated rooms', async () => {
  const THREE = await import('../vendor/three.module.js');
  const { createOperationsAssets } = await import('../room/operations-assets.js');
  const starter = await model('pump_heat_exchanger_skid', THREE);
  const enclosed = await model('enclosed_pump_skid', THREE);
  for (const id of ['control', 'ups', 'distribution', 'hall', 'room-1', 'cooling']) {
    for (const level of [0, 1, 2, 10000]) {
      const requested = [],
        scene = new THREE.Scene(),
        colliders = [],
        picks = [];
      const kit = createOperationsAssets({
        THREE,
        scene,
        bank: {
          make: (key) => {
            requested.push(key);
            return (key === 'enclosedPump' ? enclosed : starter).clone(true);
          },
        },
        location: { id, floor: 1 },
        central: { systems: [{ id: 'cooling', available: true, level }] },
        layout: { floorCount: 1, rooms: [] },
        colliders,
        pickTargets: picks,
      });
      if (id === 'cooling' && level > 0) {
        assert.deepEqual(requested, [level === 1 ? 'pumpSkid' : 'enclosedPump']);
        assert.equal(colliders.length, 1);
        const pump = kit.group.getObjectByName('cooling-pump-heat-exchanger');
        const body = new THREE.Box3().setFromObject(pump);
        for (const name of ['pump_chw_supply_to_header', 'pump_chw_return_to_header']) {
          const pipe = kit.group.getObjectByName(name),
            start = pipe.geometry.parameters.path.getPoint(0);
          assert.ok(Math.abs(start.y - body.max.y) < (level === 1 ? 0.03 : 0.001));
          assert.ok(start.x > body.min.x && start.x < body.max.x);
          assert.ok(start.z > body.min.z && start.z < body.max.z);
        }
      } else
        assert.deepEqual(requested, [], 'no redundant room sensors or decorative robot stations');
      kit.dispose();
      assert.equal(colliders.length, 0);
      assert.equal(picks.length, 0);
      assert.equal(scene.children.length, 0);
    }
  }
});
