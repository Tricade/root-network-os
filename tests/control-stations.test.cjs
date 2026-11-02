'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

test('all three wall monitors are reachable ray targets and open existing console views', async (t) => {
  const THREE = await import('../vendor/three.module.js');
  const { createStations } = await import('../room-stations.js');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  });
  const ctx = new Proxy(
    { measureText: (text) => ({ width: String(text).length * 9 }) },
    { get: (object, key) => (key in object ? object[key] : () => {}) },
  );
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  const bank = {
    make(key) {
      const group = new THREE.Group();
      if (key !== 'desk') {
        group.add(
          new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.6), new THREE.MeshStandardMaterial()),
        );
        return group;
      }
      for (const name of ['monitor_screen_01', 'monitor_screen', 'monitor_screen_03']) {
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(0.3, 0.2),
          new THREE.MeshBasicMaterial(),
        );
        mesh.name = name;
        group.add(mesh);
      }
      return group;
    },
  };
  const scene = new THREE.Scene(),
    state = E.createState(41);
  const station = createStations({ THREE, scene, E, getState: () => state, assetBank: bank });
  t.after(() => station.dispose());
  scene.updateMatrixWorld(true);
  const { NAVIGATION_ITEMS } = await import('../ui/navigation.js');
  const views = new Set(NAVIGATION_ITEMS.map(([id]) => id));
  for (const target of station.pickTargets) {
    assert.ok(views.has(target.userData.view));
    assert.equal(
      target.userData.label,
      NAVIGATION_ITEMS.find(([id]) => id === target.userData.view)[2],
    );
  }
  const origin = new THREE.Vector3(0, 1.62, -2.4);
  for (const [x, view] of [
    [-2.67, 'facility'],
    [0, 'network'],
    [2.67, 'resilience'],
  ]) {
    const direction = new THREE.Vector3(x, 2.12, -5.051).sub(origin).normalize();
    const hit = new THREE.Raycaster(origin, direction, 0, 4.5).intersectObjects(
      station.pickTargets,
      false,
    )[0];
    assert.ok(hit, `${view} monitor must be usable from the clear central aisle`);
    assert.equal(hit.object.userData.view, view);
  }
  station.setVisible(false);
  assert.equal(
    station.pickTargets.length,
    0,
    'hidden control room must not intercept interactions elsewhere',
  );
});
