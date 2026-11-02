'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  path = require('node:path');
const { Worker } = require('node:worker_threads');
const E = require('../engine');

test('worker preserves paid research and staffed customer setup, completing both exactly once', async (t) => {
  const source = E.createState(929);
  source.credits = 1e7;
  source.research = 100;
  source.resilience.graceUntil = 1e9;
  source.policies.autobackup = false;
  assert.ok(E.act(source, 'upgradeServer', { id: source.servers[0].id }).ok);
  const roomId = source.business.rooms[0].roomId;
  const lead = source.customers.leads.find(
    (l) => E.quoteCustomer(source, 'acceptCustomerLead', { id: l.id, roomId }).enabled,
  );
  assert.ok(lead, 'Real request must fit the upgraded start server');
  assert.ok(E.act(source, 'acceptCustomerLead', { id: lead.id, roomId }).ok);
  assert.ok(source.customers.contracts.some((c) => c.stage === 'setup' && c.agentId));
  assert.ok(E.act(source, 'buyResearch', { id: 'network-fabric' }).ok);
  const expected = E.normalizeState(source),
    report = E.advance(expected, 1200);
  const worker = new Worker(path.join(__dirname, 'helpers/worker-adapter.cjs'));
  t.after(() => worker.terminate());
  const actual = await new Promise((resolve, reject) => {
    worker.on('error', reject);
    worker.on('message', (data) => {
      if (data.type === 'complete') resolve(data);
      else if (data.type === 'error') reject(new Error(data.message));
    });
    worker.postMessage({ state: source, seconds: 1200 });
  });
  assert.deepEqual(actual.state, expected);
  assert.deepEqual(actual.report, { ...report, capped: false });
  assert.equal(actual.state.lab.project, null);
  assert.ok(actual.state.lab.owned.includes('network-fabric'));
  assert.equal(actual.state.customers.contracts.filter((c) => c.stage === 'setup').length, 0);
  assert.equal(actual.report.researchCompleted.length, 1);
});
test('worker uses the production script order and matches deterministic direct progression', async (t) => {
  const source = E.createState(826);
  source.credits = 1e6;
  source.resilience.graceUntil = 1e9;
  source.operations.limits.plan = 10000;
  E.act(source, 'queueOperation', { action: 'createBackup', payload: {}, ceiling: 1000 });
  E.act(source, 'orderParts', { quantity: 4, method: 'express' });
  const original = structuredClone(source),
    expected = E.normalizeState(source);
  const report = E.advance(expected, 1200);
  const worker = new Worker(path.join(__dirname, 'helpers/worker-adapter.cjs'));
  t.after(() => worker.terminate());
  let progress = 0;
  const result = await new Promise((resolve, reject) => {
    worker.on('error', reject);
    worker.on('message', (data) => {
      if (data.type === 'progress') progress++;
      else if (data.type === 'complete') resolve(data);
      else if (data.type === 'error') reject(new Error(data.message));
    });
    worker.postMessage({ state: source, seconds: 1200 });
  });
  assert.deepEqual(result.state, expected);
  assert.deepEqual(result.report, { ...report, capped: false });
  assert.ok(progress > 1);
  assert.deepEqual(source, original);
});
test('catch-up rejects invalid time and caps unattended progression without mutating its input', () => {
  const source = E.createState(827),
    original = structuredClone(source);
  assert.throws(() => E.createCatchup(source, Infinity));
  assert.throws(() => E.createCatchup(source, -1));
  const task = E.createCatchup(source, 60000);
  assert.equal(task.report().capped, true);
  task.step();
  assert.equal(task.report().seconds, 30);
  assert.deepEqual(source, original);
});
test('fallback catch-up yields, ignores stale state replacements and preserves the original on errors', async () => {
  const { createOfflineUI } = await import('../ui/offline.js');
  const source = E.createState(828);
  source.resilience.graceUntil = 1e9;
  const el = () => ({ setAttribute() {}, append() {}, remove() {} }),
    ctx = { state: source, E, tr: (x) => x, toast() {}, lastTick: 0 };
  let yields = 0;
  const platform = {
    document: { createElement: el, body: el() },
    performance,
    setTimeout: (callback) => {
      yields++;
      return setTimeout(callback, 0);
    },
    Worker: undefined,
  };
  const offline = createOfflineUI(ctx, platform),
    pending = offline.catchUp(600000, 600);
  assert.ok(offline.catchUpBusy());
  const replacement = E.createState(829);
  ctx.state = replacement;
  assert.equal(await pending, null);
  assert.equal(ctx.state, replacement);
  assert.equal(ctx.lastTick, 0);
  assert.ok(yields > 0);
  assert.equal(offline.catchUpBusy(), false);
});
