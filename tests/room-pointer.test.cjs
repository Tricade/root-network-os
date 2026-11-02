const test = require('node:test');
const assert = require('node:assert/strict');

async function setup() {
  const { createRoomPointer } = await import('../room/pointer.js');
  const capture = new Set(),
    rotations = [];
  const help = {},
    button = { setAttribute() {} };
  const doc = {
    pointerLockElement: null,
    exitPointerLock() {
      this.pointerLockElement = null;
    },
  };
  const ctx = {
    exploring: true,
    mounted: true,
    hidden: false,
    consoleOpen: false,
    keys: new Set(['KeyW']),
    tr: (s) => s,
    rotateCamera: (x, y) => rotations.push([x, y]),
    shell: {
      classList: { toggle() {} },
      querySelector: (s) => (s === '[data-room-pointer]' ? button : help),
    },
    canvas: {
      focus() {},
      setPointerCapture: (id) => capture.add(id),
      hasPointerCapture: (id) => capture.has(id),
      releasePointerCapture: (id) => capture.delete(id),
      requestPointerLock: () => {
        doc.pointerLockElement = ctx.canvas;
        return Promise.resolve();
      },
    },
  };
  return { ctx, doc, rotations, capture, help, button, ...createRoomPointer(ctx, doc) };
}
const down = { button: 0, pointerId: 1, clientX: 100, clientY: 100 };

test('lost release and unrelated pointers cannot move the camera', async () => {
  const s = await setup();
  s.onPointerDown(down);
  s.onPointerMove({ ...down, pointerId: 2, buttons: 1, clientX: 900 });
  assert.deepEqual(s.rotations, []);
  s.onPointerMove({ ...down, buttons: 1, clientX: 110 });
  assert.deepEqual(s.rotations, [[0.04, 0]]);
  s.onPointerMove({ ...down, buttons: 0, clientX: 800 });
  s.onPointerMove({ ...down, buttons: 1, clientX: 900 });
  assert.equal(s.rotations.length, 1);
  assert.equal(s.capture.size, 0);
  s.onPointerDown({ ...down, button: 2 });
  assert.equal(s.ctx.dragPoint, null);
});

test('lock transitions discard absolute coordinates and use only actual relative movement', async () => {
  const s = await setup();
  s.onPointerDown(down);
  s.doc.pointerLockElement = s.ctx.canvas;
  // DOM can already be locked before pointerlockchange updates our visual flag.
  s.onPointerMove({ ...down, buttons: 1, clientX: 4000 });
  s.onLockedMouseMove({ movementX: 10, movementY: -5 });
  s.onPointerLockChange();
  assert.equal(s.ctx.dragPoint, null);
  assert.equal(s.ctx.keys.size, 0);
  assert.equal(s.rotations.length, 1);
  assert.ok(Math.abs(s.rotations[0][0] - 0.024) < 1e-12);
  assert.ok(Math.abs(s.rotations[0][1] + 0.012) < 1e-12);
  s.doc.pointerLockElement = null;
  s.onLockedMouseMove({ movementX: 4000, movementY: 0 });
  s.onPointerLockChange();
  s.onPointerMove({ ...down, buttons: 1, clientX: 800 });
  assert.equal(s.rotations.length, 1);
  s.onPointerDown(down);
  s.onPointerMove({ ...down, buttons: 1, clientX: 110 });
  assert.equal(s.rotations.length, 2, 'fresh drag works after unlocking');
});

test('capture failure leaves usable drag controls and a visible explanation', async () => {
  const s = await setup();
  s.ctx.canvas.requestPointerLock = () => Promise.reject(new Error('denied'));
  s.capturePointer();
  await Promise.resolve();
  assert.match(s.help.textContent, /konnte nicht/);
  assert.equal(s.ctx.pointerLocked, false);
  assert.equal(s.button.textContent, 'Maus fangen');
  s.onPointerDown(down);
  s.onPointerMove({ ...down, buttons: 1, clientX: 110 });
  assert.equal(s.rotations.length, 1);
});

test('late lock after leaving, opening a console or cancelling cannot trap the mouse', async () => {
  for (const reason of ['consoleOpen', 'hidden', 'cancel']) {
    const s = await setup();
    let acquired;
    s.ctx.canvas.requestPointerLock = () =>
      new Promise((resolve) => {
        acquired = resolve;
      });
    s.capturePointer();
    if (reason === 'cancel') s.releasePointer();
    else s.ctx[reason] = true;
    s.doc.pointerLockElement = s.ctx.canvas;
    s.onPointerLockChange();
    acquired();
    await Promise.resolve();
    assert.equal(s.doc.pointerLockElement, null, reason);
  }
});

test('drag release retains click suppression until next gesture without a timer race', async () => {
  const s = await setup();
  s.onPointerDown(down);
  s.onPointerMove({ ...down, buttons: 1, clientX: 120 });
  s.onPointerUp(down);
  assert.equal(s.ctx.dragMoved, true);
  s.onPointerDown(down);
  assert.equal(s.ctx.dragMoved, false);
  s.releasePointer();
  assert.equal(s.ctx.exploring, true, 'release keeps the user at their location');
});
