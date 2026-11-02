'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const createPriorityAllocation = require('../engine/priority-allocation');

const RESOURCES = ['cpu', 'ram', 'storage', 'network', 'gpu', 'vram'];
const { allocateServiceResources } = createPriorityAllocation({ RESOURCES });
const resources = (values = {}) =>
  Object.fromEntries(RESOURCES.map((key) => [key, values[key] || 0]));
const demand = (kind, values) => ({ kind, resources: resources(values) });

function assertWithinCapacity(available, demands, fractions) {
  for (const key of RESOURCES) {
    const used = demands.reduce(
      (sum, row) => sum + row.resources[key] * fractions.get(row.kind),
      0,
    );
    assert.ok(used <= available[key] + 1e-12, `${key} usage ${used} exceeds ${available[key]}`);
  }
}

test('balanced mode exactly preserves the shared proportional fraction per used resource', () => {
  const available = resources({ cpu: 3, ram: 6, storage: 3, network: 10, gpu: 1, vram: 8 });
  const demands = [
    demand('hosting', { cpu: 2, ram: 4, network: 5 }),
    demand('archive', { storage: 6, network: 5 }),
    demand('database', { cpu: 4, ram: 8, network: 10 }),
    demand('inference', { gpu: 2, vram: 8, network: 4 }),
  ];

  const fractions = allocateServiceResources(available, demands, 'balanced');

  assert.deepEqual(
    [...fractions],
    [
      ['hosting', 10 / 24],
      ['archive', 10 / 24],
      ['database', 10 / 24],
      ['inference', 10 / 24],
    ],
  );
  assertWithinCapacity(available, demands, fractions);
});

test('a preferred group gets first claim and the remaining groups still share shortages proportionally', () => {
  const available = resources({ cpu: 1, storage: 3, network: 10, gpu: 2, vram: 8 });
  const demands = [
    demand('hosting', { cpu: 2, network: 4 }),
    demand('archive', { storage: 6, network: 8 }),
    demand('inference', { gpu: 2, vram: 16, network: 2 }),
  ];

  const fractions = allocateServiceResources(available, demands, 'inference');

  assert.equal(fractions.get('inference'), 0.5);
  assert.equal(fractions.get('hosting'), 0.5);
  assert.equal(fractions.get('archive'), 0.5);
  assertWithinCapacity(available, demands, fractions);
});

test('preference uses every constrained resource, including VRAM, without blocking unrelated work', () => {
  const available = resources({ cpu: 3, gpu: 2, vram: 8 });
  const demands = [demand('hosting', { cpu: 6 }), demand('inference', { gpu: 2, vram: 16 })];

  const fractions = allocateServiceResources(available, demands, 'inference');

  assert.equal(fractions.get('inference'), 0.5);
  assert.equal(fractions.get('hosting'), 0.5);
  assertWithinCapacity(available, demands, fractions);
});

test('noncontended groups receive full service; no-demand groups receive fraction one', () => {
  const available = resources({
    cpu: 100,
    ram: 100,
    storage: 100,
    network: 100,
    gpu: 100,
    vram: 100,
  });
  const demands = [
    demand('hosting', { cpu: 2 }),
    demand('archive', { storage: 4 }),
    demand('inference', {}),
  ];

  const fractions = allocateServiceResources(available, demands, 'archive');

  assert.deepEqual([...fractions.values()], [1, 1, 1]);
  assertWithinCapacity(available, demands, fractions);
  assert.deepEqual([...allocateServiceResources(available, [], 'balanced')], []);

  const zeroSupply = allocateServiceResources(resources(), [demand('hosting', { cpu: 2 })]);
  assert.equal(zeroSupply.get('hosting'), 0);
});

test('a preference absent from the demand rows falls back to balanced allocation', () => {
  const available = resources({ cpu: 3, ram: 3 });
  const demands = [demand('hosting', { cpu: 2 }), demand('database', { cpu: 4, ram: 4 })];

  const fractions = allocateServiceResources(available, demands, 'inference');

  assert.deepEqual(
    [...fractions],
    [
      ['hosting', 0.5],
      ['database', 0.5],
    ],
  );
  assertWithinCapacity(available, demands, fractions);
});

test('invalid priority is rejected', () => {
  assert.throws(
    () => allocateServiceResources(resources(), [], 'free-capacity'),
    /Dienstpriorität/,
  );
});
