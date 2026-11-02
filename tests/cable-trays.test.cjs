const test = require('node:test'),
  assert = require('node:assert/strict');

test('power trays have open gaps, visible round cables and one batched metal draw call', async () => {
  const THREE = await import('../vendor/three.module.js'),
    { createUtilityKit } = await import('../room/utility-kit.js'),
    { buildCableTray } = await import('../room/cable-tray.js');
  const kit = createUtilityKit(),
    parent = new THREE.Group();
  const tray = buildCableTray(
    kit,
    parent,
    [
      [0, 2.4, 2],
      [0, 2.4, -2],
    ],
    'test-tray',
  );
  parent.updateMatrixWorld(true);
  const metal = tray.getObjectByName('open-tray-metal');
  assert.equal(metal.children.length, 1, 'rails and all rungs form one draw call');
  const cables = tray.children.filter((node) => node.name === 'tray-power-cable');
  assert.equal(cables.length, 3);
  assert.ok(cables.every((node) => node.geometry.type === 'TubeGeometry'));
  const down = (x, z, objects) =>
    new THREE.Raycaster(new THREE.Vector3(x, 3, z), new THREE.Vector3(0, -1, 0)).intersectObjects(
      objects,
      true,
    );
  assert.equal(down(0.085, 0.34, [tray]).length, 0, 'gap between cables and rungs remains open');
  assert.ok(down(0.085, 0.2, [metal]).length > 0, 'open tray still has actual supporting rungs');
  assert.ok(down(0, 0.34, cables).length > 0, 'bundle is visible through the open top');
  let released = 0,
    count = 0;
  tray.traverse((node) => {
    if (node.isMesh) {
      count++;
      node.geometry.addEventListener('dispose', () => released++);
    }
  });
  kit.dispose();
  assert.equal(released, count);
});
