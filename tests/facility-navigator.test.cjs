'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

let createFacilityNavigator, searchFacility;
test.before(async () => {
  ({ createFacilityNavigator, searchFacility } = await import('../ui/facility-navigator.js'));
});

function fixture(roomCount = 1, racksPerRoom = 1, serversPerRack = 1) {
  const rooms = [],
    racks = [];
  for (let r = 0; r < roomCount; r++) {
    const rackIds = [];
    for (let k = 0; k < racksPerRoom; k++) {
      const id = `rack-${r}-${k}`;
      rackIds.push(id);
      racks.push({
        id,
        name: `Rack ${r}-${k}`,
        servers: Array.from({ length: serversPerRack }, (_, s) => ({
          id: `server-${r}-${k}-${s}`,
          name: `Node ${r}-${k}-${s}`,
          type: 'edge',
        })),
      });
    }
    rooms.push({ id: `room-${r}`, floor: Math.floor(r / 4) + 1, number: (r % 4) + 1, rackIds });
  }
  return { layout: { rooms }, rackModel: { racks } };
}

test('facility search matches localized automatic names and retains stable entity ids', () => {
  const { layout, rackModel } = fixture();
  const translate = (value) => (value === 'Edge-Knoten' ? 'Edge Node' : value);
  translate.serverName = (server) => server.name.replace('Node', 'Gerät');
  const byLocalized = searchFacility(layout, rackModel, 'Gerät 0-0-0', translate);
  assert.equal(byLocalized.length, 1);
  assert.equal(byLocalized[0].id, 'server:server-0-0-0');
  assert.equal(byLocalized[0].roomId, 'room-0');
  assert.equal(byLocalized[0].rackId, 'rack-0-0');
  assert.equal(searchFacility(layout, rackModel, 'rack-0-0')[0].id, 'rack:rack-0-0');
});

test('facility search safely caps broad queries at 20 across large facilities', () => {
  const { layout, rackModel } = fixture(40, 6, 18);
  assert.equal(searchFacility(layout, rackModel, 'rack').length, 20);
  assert.equal(searchFacility(layout, rackModel, 'server').length, 20);
  assert.deepEqual(searchFacility(layout, rackModel, ''), []);
});

test('navigator selects room/rack/server through rack APIs and bounds persisted favorites', () => {
  const { layout, rackModel } = fixture(1, 1, 1),
    actions = [],
    store = new Map();
  const ctx = {
    state: {},
    E: {
      getRackModel: () => rackModel,
      getFacilityLayout: () => layout,
      getBuildingModel: () => ({ floors: 1 }),
    },
    R: {
      selectRoom: (id) => (actions.push(['room', id]), true),
      select: (rackId, serverId) => (actions.push(['select', rackId, serverId]), true),
    },
    selectRoomOperations: (id) => actions.push(['ops', id]),
    selectCustomerRoom: (id) => actions.push(['customer', id]),
    storageGet: (key) => store.get(key) ?? null,
    storageSet: (key, value) => store.set(key, value),
    esc: (value) => String(value),
    tr: (value) => value,
    I18N: { serverName: (server) => server.name },
    render: () => actions.push(['render']),
    navigate: (route) => actions.push(['navigate', route]),
  };
  const navigator = createFacilityNavigator(ctx, {
    selectFloor: (floor) => (actions.push(['floor', floor]), true),
  });
  navigator.markup(layout, {}, 1);
  assert.equal(navigator.click({ dataset: { facilityNode: 'room:room-0' } }), true);
  assert.ok(actions.some((item) => item[0] === 'customer' && item[1] === 'room-0'));
  navigator.markup(layout, {}, 1);
  assert.equal(navigator.click({ dataset: { facilityNode: 'server:server-0-0-0' } }), true);
  assert.ok(
    actions.some(
      (item) => item[0] === 'select' && item[1] === 'rack-0-0' && item[2] === 'server-0-0-0',
    ),
  );
  navigator.click({ dataset: { facilityFavorite: 'room:room-0' } });
  const saved = JSON.parse([...store.values()][0]);
  assert.deepEqual(saved, ['room:room-0']);
});
