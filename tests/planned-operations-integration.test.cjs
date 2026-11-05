'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const { grantSpace } = require('./helpers/facility.cjs');

const roundTrip = (state) => E.normalizeState(JSON.parse(JSON.stringify(state)));
const newCustomer = (source, changes = {}) => ({
  ...structuredClone(source),
  id: 'customer-2',
  client: 'Fixture Archive',
  kind: 'archive',
  units: 1,
  ...changes,
});

function serviceResourceUse(state, roomId) {
  const row = E.getBusinessModel(state, E.getMetrics(state)).rooms.find(
    (room) => room.roomId === roomId,
  );
  const efficiency = E.getResearchEffects(state).serviceEfficiency;
  const used = Object.fromEntries(
    ['cpu', 'ram', 'storage', 'network', 'gpu', 'vram'].map((key) => [key, 0]),
  );
  for (const group of row.groups) {
    const service = E.getBusinessModel(state).services[group.kind];
    const profile = row.profile === service.profile ? 0.9 : 1;
    for (const key of Object.keys(used))
      used[key] += (service.needs[key] || 0) * group.units * efficiency * profile * group.supplied;
  }
  return { row, used };
}

test('customer growth reserves capacity on the existing contract and survives a paid save roundtrip', () => {
  const s = E.createState(34);
  const source = s.customers.contracts[0];
  source.units = 1;
  source.satisfaction = 100;
  source.issue = '';
  s.business.rooms[0].groups.find((group) => group.kind === source.kind).units = 1;
  s.customerGrowth.nextCheckAt = 0;
  E.advance(s, 1);
  const offer = E.getGrowth(s).requests.find((request) => request.status === 'offered');
  assert.ok(offer, 'seed 34 produces the first bounded growth offer at review 0');

  const setup = E.quoteService(s, 'contractService', {
    roomId: offer.roomId,
    kind: offer.kind,
    units: offer.units,
  });
  assert.equal(setup.enabled, true, setup.reason);
  const quote = E.quoteGrowth(s, 'promiseCustomerGrowth', {
    id: offer.id,
    windowSeconds: 3600,
    budgetCeiling: setup.cost,
  });
  assert.equal(quote.enabled, true, quote.reason);
  const beforeCredits = s.credits;
  assert.equal(
    E.act(s, 'promiseCustomerGrowth', {
      id: offer.id,
      windowSeconds: 3600,
      budgetCeiling: setup.cost,
    }).ok,
    true,
  );
  assert.equal(s.credits, beforeCredits - setup.cost);
  assert.equal(E.getGrowth(s).reservedBudget, 0);

  E.advance(s, 1);
  const provisioning = s.customerGrowth.requests.find((request) => request.id === offer.id);
  assert.equal(provisioning.status, 'provisioning');
  assert.equal(provisioning.escrow, 0, 'escrow is reconciled with the ordinary setup quote');
  assert.equal(provisioning.contractId, source.id);
  assert.equal(source.stage, 'active');
  assert.equal(source.work, 'growth');
  assert.equal(source.units, 1);
  assert.equal(s.business.rooms[0].groups.find((group) => group.kind === offer.kind).pending, 1);

  const loaded = roundTrip(s);
  assert.deepEqual(loaded.customerGrowth, s.customerGrowth);
  assert.deepEqual(loaded.customers.contracts, s.customers.contracts);
  assert.equal(
    loaded.business.rooms[0].groups.find((group) => group.kind === offer.kind).pending,
    1,
  );
  loaded.resilience.graceUntil = 1e9;
  E.advance(loaded, 600);
  assert.equal(loaded.customers.contracts.length, 1);
  assert.equal(loaded.customers.contracts[0].units, 2);
  assert.equal(loaded.customers.contracts[0].work, '');
  assert.equal(loaded.customerGrowth.requests.length, 0);
  assert.equal(loaded.business.rooms[0].groups[0].pending, 0);
});

test('a full room with free resources can expand a contract while an unstaffed expansion stays queued', () => {
  let s = require('../tools/balance/scenarios.cjs').fleet(18, 34);
  const original = s.customers.contracts[0];
  s.customers.contracts = Array.from({ length: 16 }, () => ({
    ...original,
    id: 'customer-' + s.nextId++,
    units: 1,
  }));
  const source = s.customers.contracts[0];
  for (const group of s.business.rooms[0].groups) group.units = group.kind === source.kind ? 16 : 0;
  s.customers.autoAssign = false;
  s.resilience.graceUntil = 1e9;
  s.customerGrowth.usedOrigins.push(source.id);
  s.customerGrowth.requests.push({
    id: 'growth-' + s.nextId++,
    sourceId: source.id,
    client: source.client,
    roomId: source.roomId,
    kind: source.kind,
    units: 1,
    term: source.term,
    createdAt: s.time,
    expiresAt: s.time + 86400,
    status: 'offered',
    promisedAt: 0,
    windowSeconds: 0,
    deadlineAt: 0,
    budgetCeiling: 0,
    escrow: 0,
    nextAttemptAt: 0,
    contractId: null,
    latePenaltyApplied: false,
  });
  const offer = E.getGrowth(s).requests[0];
  assert.ok(offer);
  const payload = { id: offer.id, windowSeconds: 3600, budgetCeiling: offer.quote.setupCost };
  assert.ok(E.act(s, 'promiseCustomerGrowth', payload).ok);
  s = roundTrip(s);
  E.advance(s, 60);
  const contract = s.customers.contracts.find((c) => c.id === offer.sourceId);
  assert.equal(contract.agentId, null);
  assert.equal(contract.units, 1);
  assert.equal(contract.workRemaining, 600);
  assert.ok(E.act(s, 'assignCustomerAgent', { id: contract.id, agentId: s.agents[0].id }).ok);
  const originalTerm = contract.remaining;
  E.advance(s, 600);
  assert.equal(s.customers.contracts.length, 16);
  assert.equal(contract.units, 2);
  assert.equal(contract.remaining, originalTerm - 600);
  assert.equal(
    s.customerGrowth.requests.some((r) => r.id === offer.id),
    false,
  );
  assert.equal(s.business.rooms[0].groups[0].pending, 0);
});

test('a previously paid split expansion finishes as booked when loading schema 10', () => {
  const s = E.createState(34);
  const source = s.customers.contracts[0];
  source.units = s.business.rooms[0].groups[0].units = 1;
  s.resilience.graceUntil = 1e9;
  s.customerGrowth.nextCheckAt = 0;
  E.advance(s, 1);
  const request = s.customerGrowth.requests[0];
  assert.ok(request);
  const child = {
    ...source,
    id: 'customer-' + s.nextId++,
    stage: 'setup',
    work: 'setup',
    workTotal: 600,
    workRemaining: 50,
    agentId: s.agents[0].id,
  };
  s.customers.contracts.push(child);
  s.business.rooms[0].groups[0].pending = 1;
  s.business.rooms[0].groups[0].onboarding = 50;
  s.customerGrowth.linkedContracts.push(child.id);
  Object.assign(request, {
    status: 'provisioning',
    contractId: child.id,
    promisedAt: s.time,
    windowSeconds: 3600,
    deadlineAt: s.time + 3600,
    budgetCeiling: 300,
  });
  s.version = 10;
  delete s.policies.autoReroute;
  const loaded = roundTrip(s);
  assert.equal(loaded.version, 11);
  assert.equal(loaded.policies.autoReroute, false);
  assert.equal(loaded.credits, s.credits);
  E.advance(loaded, 50);
  assert.equal(loaded.customers.contracts.length, 2);
  assert.equal(loaded.customers.contracts[1].id, child.id);
  assert.equal(loaded.customers.contracts[1].stage, 'active');
  assert.equal(loaded.customerGrowth.requests.length, 0);
});

test('service priority is neutral without a shortage and preserves resource limits during an actual node failure', () => {
  const neutral = E.createState(311);
  const original = neutral.customers.contracts[0];
  original.units = 1;
  neutral.business.rooms[0].groups.find((group) => group.kind === 'hosting').units = 1;
  neutral.business.rooms[0].groups.find((group) => group.kind === 'archive').units = 1;
  neutral.customers.contracts.push(newCustomer(original));
  const node = neutral.servers[0];
  neutral.servers.push({
    ...structuredClone(node),
    id: 'server-2',
    name: 'Second node',
    unit: 3,
    port: 2,
  });
  assert.ok(E.act(neutral, 'setServicePriority', { roomId: 'room-1', kind: 'archive' }).ok);
  const neutralModel = E.getBusinessModel(neutral, E.getMetrics(neutral)).rooms[0];
  assert.equal(neutralModel.priority, 'archive');
  assert.ok(neutralModel.groups.every((group) => group.supplied > 0.999999));

  const failed = roundTrip(neutral);
  failed.business.rooms[0].groups.find((group) => group.kind === 'hosting').units = 8;
  failed.business.rooms[0].groups.find((group) => group.kind === 'archive').units = 8;
  failed.customers.contracts.find((contract) => contract.kind === 'hosting').units = 8;
  failed.customers.contracts.find((contract) => contract.kind === 'archive').units = 8;
  failed.servers[0].status = 'failed';
  failed.servers[0].condition = 42;
  failed.servers[0].fault = 'Hardwarefehler';
  const { row, used } = serviceResourceUse(failed, 'room-1');
  assert.equal(E.getMetrics(failed).failedServers, 1);
  for (const key of Object.keys(used))
    assert.ok(
      used[key] <= row.available[key] + 1e-9,
      `${key} use ${used[key]} exceeds ${row.available[key]}`,
    );
  assert.ok(row.groups.every((group) => group.supplied >= 0 && group.supplied <= 1));
});

test('preventive work isolates its actual rack, blocks conflicting assignments, and preserves fractional progress', () => {
  const s = E.createState(818);
  const originalCustomer = structuredClone(s.customers.contracts[0]);
  grantSpace(s, { rooms: 2 });
  const first = s.facility.racks[0];
  s.facility.racks.push({
    ...structuredClone(first),
    id: 'rack-2',
    name: 'Rack B',
    roomId: 'room-2',
  });
  const node = s.servers[0];
  node.condition = 55;
  s.servers.push({
    ...structuredClone(node),
    id: 'server-2',
    name: 'Room 2 node',
    rackId: 'rack-2',
    condition: 100,
    unit: 2,
    port: 1,
  });
  s.agents[0].role = 'engineer';
  s.customers.contracts.length = 0;
  for (const room of s.business.rooms)
    room.groups.find((group) => group.kind === 'hosting').units = 0;
  s.business.rooms[1].groups.find((group) => group.kind === 'hosting').units = 1;
  const customer = newCustomer(originalCustomer, {
    kind: 'hosting',
    roomId: 'room-2',
    client: 'Room 2 Client',
  });
  Object.assign(customer, {
    term: 259200,
    remaining: 259200,
    stage: 'active',
    work: '',
    workRemaining: 0,
    workTotal: 0,
    agentId: null,
    issue: '',
    notice: 0,
    departure: '',
  });
  s.customers.contracts.push(customer);
  s.preventiveMaintenance.policy.minimumSupply = 0.95;
  s.preventiveMaintenance.policy.threshold = 70;
  const quote = E.quotePreventiveMaintenance(s, { rackId: 'rack-1', agentId: 'agent-1' });
  assert.equal(quote.enabled, true, quote.reason);
  assert.equal(quote.wornCount, 1);
  assert.ok(
    E.act(s, 'schedulePreventiveMaintenance', {
      rackId: 'rack-1',
      agentId: 'agent-1',
      threshold: 70,
      earliestAt: s.time,
      windowStart: 0,
      windowEnd: 86399,
      ceiling: quote.cost,
    }).ok,
  );
  E.advance(s, 1);
  assert.ok(s.preventiveMaintenance.operation);
  assert.equal(E.getMetrics(s).onlineServers, 1, 'rack 2 remains online while rack 1 is serviced');
  assert.ok(
    E.getMetrics(s).serviceIncome > 0,
    'the customer on the unaffected rack continues to earn',
  );
  assert.equal(
    E.quoteHardware(s, 'upgradeRack', { rackId: 'rack-2', component: 'switch' }).enabled,
    false,
  );
  assert.equal(E.quoteProject(s, { id: 'agent-1', kind: 'audit' }).enabled, false);

  const roomTwoContract = s.customers.contracts[0];
  Object.assign(roomTwoContract, {
    work: 'support',
    workRemaining: 600,
    workTotal: 600,
    issue: 'question',
    agentId: null,
  });
  assert.equal(
    E.quoteCustomer(s, 'assignCustomerAgent', { id: roomTwoContract.id, agentId: 'agent-1' })
      .enabled,
    false,
  );
  E.advance(s, 0.25);
  const saved = roundTrip(s);
  assert.equal(
    saved.preventiveMaintenance.operation.remaining,
    s.preventiveMaintenance.operation.remaining,
  );
  assert.equal(
    saved.preventiveMaintenance.operation.downtimeRemaining,
    s.preventiveMaintenance.operation.downtimeRemaining,
  );
});

test('capital plan prices future floors and rooms, protects reserves, honors not-before gates, and rejects invalid reordering', () => {
  const s = E.createState(777);
  s.credits = 1e9;
  s.operations.limits.plan = 1e9;
  s.operations.limits.reserve = 100;
  const floorQuote = E.quoteHardware(s, 'buildFloor');
  assert.equal(floorQuote.enabled, true, floorQuote.reason);
  assert.equal(floorQuote.cost, 500000000);
  assert.equal(E.quoteHardware(s, 'buildRoom', { floor: 2 }).enabled, false);

  assert.ok(
    E.act(s, 'queueOperation', {
      action: 'buildFloor',
      payload: {},
      ceiling: floorQuote.cost,
      notBefore: 3600,
    }).ok,
  );
  assert.ok(
    E.act(s, 'queueOperation', {
      action: 'buildRoom',
      payload: { floor: 2 },
      ceiling: 30000000,
    }).ok,
  );
  const [floor, room] = s.operations.queue;
  const plannedRoom = E.quotePlannedOperation(s, room, [floor]);
  assert.equal(plannedRoom.enabled, true, plannedRoom.reason);
  assert.equal(
    plannedRoom.cost,
    23000000,
    'room 2 depth multiplier is applied to one existing room',
  );
  const reorder = E.act(s, 'movePlannedOperation', { id: floor.id, direction: 1 });
  assert.equal(reorder.ok, false);
  assert.equal(s.operations.queue[0].id, floor.id);

  s.operations.limits.reserve = 600000000;
  E.advance(s, 3600);
  assert.equal(
    s.facility.building.project,
    null,
    'the floor waits at its not-before time and protected reserve',
  );
  assert.equal(s.operations.queue[0].id, floor.id);
  s.operations.limits.reserve = 100;
  s.operations.nextCheck = s.time;
  E.advance(s, 1);
  assert.equal(s.facility.building.project.kind, 'floor');
});

test('schema 7 migration opts into schema 8 defaults; two idle days remain finite and chunk stepping is reproducible', () => {
  const old = E.createState(902);
  old.version = 7;
  delete old.customerGrowth;
  delete old.preventiveMaintenance;
  delete old.servicePriorities;
  const migrated = roundTrip(old);
  assert.equal(migrated.version, 11);
  assert.equal(migrated.preventiveMaintenance.policy.automatic, false);
  assert.deepEqual(migrated.servicePriorities, {});

  const large = E.createState(20261031);
  for (let i = 0; i < 4; i++) E.advance(large, 43200);
  const chunkedHour = roundTrip(large);
  const stepHour = roundTrip(large);
  E.advance(chunkedHour, 3600);
  for (let i = 0; i < 3600; i++) E.advance(stepHour, 1);
  assert.deepEqual(stepHour, chunkedHour);
  assert.equal(large.preventiveMaintenance.policy.automatic, false);
  assert.equal(large.preventiveMaintenance.dailySpent, 0);
  for (const value of [
    large.credits,
    large.research,
    E.getMetrics(large).incomePerSecond,
    E.getMetrics(large).researchPerSecond,
  ])
    assert.ok(Number.isFinite(value) && value >= 0);
  assert.ok(large.credits < 1e15 && large.research < 1e15);
});

test('confirmations tolerate elapsed dialog time and plans reject exhausted upgrade chains', () => {
  const s = E.createState(8);
  const shownAt = s.time;
  E.advance(s, 3.5);
  assert.equal(
    E.act(s, 'queueOperation', {
      action: 'createBackup',
      payload: {},
      ceiling: 1000,
      notBefore: shownAt,
    }).ok,
    true,
  );
  assert.equal(s.operations.queue[0].notBefore, s.time);
  s.facility.racks[0].switchLevel = 2;
  const upgrade = {
    action: 'upgradeRack',
    payload: { rackId: 'rack-1', component: 'switch' },
    ceiling: 10000,
  };
  assert.equal(E.act(s, 'queueOperation', upgrade).ok, true);
  assert.equal(
    E.act(s, 'queueOperation', upgrade).ok,
    false,
    'a second switch upgrade would exceed level 3',
  );
  s.agents[0].role = 'engineer';
  s.servers[0].condition = 55;
  assert.equal(
    E.act(s, 'schedulePreventiveMaintenance', {
      rackId: 'rack-1',
      agentId: 'agent-1',
      threshold: 70,
      ceiling: 1000,
      earliestAt: shownAt,
    }).ok,
    true,
  );
  assert.equal(s.preventiveMaintenance.schedule.earliestAt, s.time);
  assert.ok(roundTrip(s));
});
