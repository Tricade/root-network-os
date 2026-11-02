'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

test('faster room movement preserves sprint, diagonal normalization and collision clearance', async (t) => {
  const { createRoomExploration } = await import('../room/exploration.js');
  const { createMovementKeys } = await import('../room/input.js');
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let focused = true;
  globalThis.document = { hasFocus: () => focused };
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'document', descriptor);
    else delete globalThis.document;
  });
  function scene(codes) {
    const keys = createMovementKeys(() => 0);
    codes.forEach((code) => keys.press(code));
    return {
      keys,
      exploring: true,
      consoleOpen: false,
      yaw: 0,
      eyeHeight: 1.7,
      camera: { position: { x: 0, y: 1.7, z: 0 }, userData: {} },
      assetBank: true,
      rackGroups: new Map(),
      locationId: 'hall',
      roomTransitionUntil: Infinity,
      facilityInterior: { canWalk: () => true, stairAt: () => null },
    };
  }
  const walk = scene(['KeyW']);
  createRoomExploration(walk).movePlayer(0.04);
  assert.ok(Math.abs(walk.camera.position.z + 3.7125 * 0.04) < 1e-10);
  for (const shift of ['ShiftLeft', 'ShiftRight']) {
    const sprint = scene(['KeyW', shift]);
    createRoomExploration(sprint).movePlayer(0.04);
    assert.ok(Math.abs(sprint.camera.position.z + 5.85 * 0.04) < 1e-10);
  }
  const diagonal = scene(['KeyW', 'KeyD']);
  createRoomExploration(diagonal).movePlayer(0.04);
  assert.ok(
    Math.abs(Math.hypot(diagonal.camera.position.x, diagonal.camera.position.z) - 0.1485) < 1e-10,
    'diagonal walking does not gain speed',
  );
  const stalled = scene(['KeyW', 'ShiftLeft']);
  createRoomExploration(stalled).movePlayer(10);
  assert.ok(Math.abs(stalled.camera.position.z + 0.2925) < 1e-10, 'long frame stays capped');
  const blocked = scene(['KeyW', 'ShiftRight']);
  blocked.facilityInterior.colliders = [{ x: 0, z: -0.3, hx: 0.5, hz: 0.25 }];
  createRoomExploration(blocked).movePlayer(0.05);
  assert.ok(blocked.camera.position.z >= -0.05, 'sprint stops in front of the collider');
  for (const direction of [-1, 1]) {
    const narrow = scene([direction < 0 ? 'KeyW' : 'KeyS', 'ShiftLeft']);
    narrow.facilityInterior.colliders = [{ x: 0, z: direction * 0.15, hx: 0.5, hz: 0.04 }];
    createRoomExploration(narrow).movePlayer(10);
    assert.ok(
      Math.abs(narrow.camera.position.z) < 0.11,
      'a thin obstacle cannot be skipped by a sprint frame',
    );
  }
  const doorway = scene(['KeyW', 'ShiftLeft']);
  let crossed = 0;
  doorway.roomTransitionUntil = 0;
  doorway.facilityInterior.crossing = (_x, z) =>
    z < -0.1 && z > -0.19 ? { destination: 'room-1' } : null;
  doorway.changeLocation = (destination) => {
    assert.equal(destination, 'room-1');
    crossed++;
  };
  createRoomExploration(doorway).movePlayer(10);
  assert.equal(crossed, 1, 'a narrow doorway threshold is processed exactly once');
  const consoleScene = scene(['KeyW']);
  consoleScene.consoleOpen = true;
  createRoomExploration(consoleScene).movePlayer(0.04);
  assert.equal(consoleScene.camera.position.z, 0, 'console pauses movement');
  const lostFocus = scene(['KeyW', 'ShiftLeft']);
  focused = false;
  createRoomExploration(lostFocus).movePlayer(0.04);
  assert.equal(lostFocus.camera.position.z, 0);
  assert.equal(lostFocus.keys.size, 0, 'focus loss clears sprint and walking');
});
