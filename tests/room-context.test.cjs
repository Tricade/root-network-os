'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const { fleet } = require('../tools/balance/scenarios.cjs');

test('physical terminals scope rack purchases, customer quotes and supply controls to their room', async () => {
  const { selectWorkspaceRoom } = await import('../ui/room-context.js');
  const { createRacks } = await import('../rack-ui.js');
  const { createBusinessUI } = await import('../ui/business.js');
  const { createRoomOperationsUI } = await import('../ui/room-operations.js');
  const state = fleet(24, 910),
    before = JSON.stringify(state),
    quotedRooms = [];
  const ctx = {
    E: {
      ...E,
      quoteCustomer(s, action, payload) {
        quotedRooms.push(payload.roomId);
        return E.quoteCustomer(s, action, payload);
      },
    },
    state,
    getState: () => state,
    tr: String,
    esc: (value) =>
      String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;'),
    fmt: String,
    dec: String,
    duration: String,
    clock: String,
    icon: () => '',
    head: () => '',
    panelHeader: () => '',
    navLink: () => '',
    growthMarkup: () => '',
    empty: () => '',
  };
  ctx.R = createRacks(ctx);
  Object.assign(ctx, createBusinessUI(ctx), createRoomOperationsUI(ctx));

  function assertRoom(roomId) {
    quotedRooms.length = 0;
    const commerce = ctx.businessView(),
      operations = ctx.roomOperationsView(),
      rack = ctx.R.view();
    assert.match(commerce, new RegExp(`<option value="${roomId}" selected>`));
    assert.match(operations, new RegExp(`data-business-room="${roomId}"`));
    assert.match(operations, new RegExp(`<option value="${roomId}" selected>`));
    assert.match(rack, new RegExp(`<option value="${roomId}" selected>`));
    assert.match(
      rack,
      new RegExp(`data-hw-payload="\\{&quot;roomId&quot;:&quot;${roomId}&quot;\\}"`),
    );
    assert.ok(quotedRooms.length > 0, 'the rendered offers use real engine admission quotes');
    assert.ok(quotedRooms.every((id) => id === roomId));
  }

  assert.equal(selectWorkspaceRoom(ctx, 'room-2'), true);
  assertRoom('room-2');
  for (const id of [null, undefined, 'hall', 'control', 'room-missing']) {
    assert.equal(selectWorkspaceRoom(ctx, id), false);
    assertRoom('room-2');
  }
  assert.equal(selectWorkspaceRoom(ctx, 'room-1'), true);
  assertRoom('room-1');
  assert.equal(JSON.stringify(state), before, 'changing terminal context never mutates a save');
});
