'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../engine.js');
const profile = (s, id) => E.getPersonnel(s).agents.find((a) => a.id === id);
function hire(s, role) {
  const c = E.getPersonnel(s).candidates.find((a) => !role || a.role === role);
  assert.equal(E.act(s, 'hireCandidate', { id: c.id }).ok, true);
  return s.agents.at(-1);
}
function illnessStart(s, a) {
  // Locate the first deterministic health boundary without relying on its hash.
  for (let time = s.time + 1; time < 150000; time += 60) {
    const x = { ...s, time };
    if (profile(x, a.id).absent) {
      while (profile({ ...s, time: time - 1 }, a.id).absent) time--;
      return time;
    }
  }
  throw new Error('No health boundary found');
}
test('read-only applicants survive reload; consuming one keeps remaining identities stable', () => {
  const s = E.createState(98);
  s.credits = 1e5;
  const before = structuredClone(s),
    board = E.getPersonnel(s);
  assert.deepEqual(s, before);
  const restored = E.normalizeState(s);
  assert.deepEqual(E.getPersonnel(restored), board);
  const c = board.candidates[0],
    cash = s.credits;
  assert.equal(E.act(s, 'hireCandidate', { id: c.id }).ok, true);
  assert.equal(s.credits, cash - c.price);
  const next = E.getPersonnel(s).candidates;
  for (const other of next) {
    const old = board.candidates.find((a) => a.id === other.id);
    assert.equal(other.name, old.name);
    assert.deepEqual(other.profile, old.profile);
  }
  const after = structuredClone(s);
  assert.equal(E.act(s, 'hireCandidate', { id: c.id }).ok, false);
  assert.deepEqual(s, after);
  assert.equal(
    new Set([...s.agents.map((a) => a.profile.portrait), ...next.map((a) => a.profile.portrait)])
      .size,
    s.agents.length + next.length,
  );
});
test('board rotates in simulation time, one pinned person survives and expired quotes do not charge', () => {
  const s = E.createState(61);
  s.credits = 1e6;
  const old = E.getPersonnel(s).candidates;
  assert.ok(E.act(s, 'pinCandidate', { id: old[0].id }).ok);
  E.advance(s, 1800);
  assert.equal(E.getPersonnel(s).candidates.length, 7);
  const pin = E.getPersonnel(s).candidates.find((a) => a.pinned);
  assert.equal(pin.id, old[0].id);
  assert.deepEqual(pin.profile, old[0].profile);
  const before = structuredClone(s);
  assert.equal(E.act(s, 'hireCandidate', { id: old[1].id }).ok, false);
  assert.deepEqual(s, before);
  assert.equal(E.act(s, 'hireCandidate', { id: pin.id }).ok, true);
  assert.equal(s.personnel.pinned, null);
  assert.equal(E.getPersonnel(E.normalizeState(s)).candidates.length, 6);
});
test('all sixty-four portrait slots are reachable, perks and appearance are not coupled', () => {
  const portraits = new Set(),
    pairs = new Map();
  for (let seed = 1; seed <= 100; seed++) {
    const s = E.createState(seed);
    for (const a of E.getPersonnel(s).candidates) {
      portraits.add(a.profile.portrait);
      const set = pairs.get(a.profile.portrait) || new Set();
      set.add(a.profile.strength + '/' + a.profile.weakness);
      pairs.set(a.profile.portrait, set);
    }
  }
  assert.equal(portraits.size, 64);
  assert.ok([...pairs.values()].every((set) => set.size > 1));
});
test('each perk changes only its stated contribution and wages remain payable when absent', () => {
  const s = E.createState(22);
  s.credits = 1e6;
  const a = hire(s, 'analyst');
  a.profile.strength = null;
  a.profile.weakness = null;
  const neutral = E.getMetrics(s);
  a.profile.strength = 'research';
  a.profile.weakness = 'expensive';
  const skilled = E.getMetrics(s);
  assert.ok(skilled.researchPerSecond > neutral.researchPerSecond);
  assert.ok(skilled.personnelCost > neutral.personnelCost);
  assert.equal(skilled.workPerSecond, neutral.workPerSecond);
  a.profile.weakness = 'recovery';
  s.time = illnessStart(s, a);
  const absent = E.getMetrics(s),
    wages = profile(s, a.id).wage;
  assert.equal(profile(s, a.id).absent, true);
  assert.equal(profile(s, a.id).wage, wages);
  assert.ok(absent.researchPerSecond < neutral.researchPerSecond);
  assert.equal(absent.onlineServers, neutral.onlineServers);
  assert.equal(E.getPersonnel(s).agents.filter((a) => a.absent).length, 1);
});
test('illness pauses paid missions and projects, auto-recovers and preserves rewards across save/load', () => {
  for (const action of ['dispatchAgent', 'startProject']) {
    const s = E.createState(12);
    s.credits = 1e6;
    const a = hire(s, 'analyst');
    a.profile.weakness = 'recovery';
    const start = illnessStart(s, a);
    s.time = start - 1;
    s.resilience.graceUntil = start + 10000;
    s.resilience.budgetWindowStart = Math.floor(s.time / 3600) * 3600;
    assert.ok(E.act(s, action, { id: a.id, mission: 'research', kind: 'research' }).ok);
    const assignment = () => (action === 'dispatchAgent' ? a.assignment : s.operations.projects[0]);
    const total = assignment().remaining;
    E.advance(s, 10);
    assert.equal(assignment().remaining, total);
    const loaded = E.normalizeState(s);
    assert.equal(profile(loaded, a.id).absent, true);
    const remaining = Math.ceil(profile(s, a.id).remaining);
    E.advance(s, remaining + total + 1);
    assert.equal(a.assignment, null);
    assert.equal(s.operations.projects.length, 0);
    assert.equal(profile(s, a.id).absent, false);
    assert.ok(a.cooldownUntil > 0);
  }
});
test('an absent manager loses only their bonus; crew and hardware continue and dismissal releases the post', () => {
  const s = E.createState(1);
  s.credits = 1e6;
  const a = hire(s, 'operator');
  a.profile.strength = 'leadership';
  a.profile.weakness = 'recovery';
  s.business.rooms[0].managerId = a.id;
  const active = E.getBusinessModel(s).rooms[0].crewCapacity;
  s.time = illnessStart(s, a);
  s.resilience.budgetWindowStart = Math.floor(s.time / 3600) * 3600;
  assert.ok(E.getBusinessModel(s).rooms[0].crewCapacity < active);
  assert.ok(E.getMetrics(s).serviceIncome > 0);
  assert.equal(E.act(s, 'dismissAgent', { id: a.id }).ok, true);
  assert.equal(s.business.rooms[0].managerId, null);
  assert.equal(E.normalizeState(s).agents.length, 2);
});
test('legacy migration preserves skills, names, prices and has no immediate sickness or new weaknesses', () => {
  for (const name of ['v1-save.json', 'v2-save.json', 'v3-save.json']) {
    const file = path.join(__dirname, 'fixtures', name);
    if (!fs.existsSync(file)) continue;
    const old = JSON.parse(fs.readFileSync(file, 'utf8')),
      copy = structuredClone(old),
      s = E.normalizeState(old);
    assert.deepEqual(old, copy);
    assert.deepEqual(
      s.agents.map((a) => [a.id, a.name, a.role, a.level, a.focus]),
      old.agents.map((a) => [a.id, a.name, a.role, a.level, a.focus]),
    );
    for (const a of s.agents) {
      assert.equal(a.profile.weakness, null);
      assert.equal(profile(s, a.id).absent, false);
    }
    assert.equal(s.version, 9);
    assert.deepEqual(E.normalizeState(s), s);
  }
});
test('current personnel validation rejects unbounded boards, forged perks and invalid references', () => {
  const s = E.createState(1);
  for (const mutate of [
    (x) => x.personnel.taken.push(7),
    (x) => x.personnel.portraits.fill(1),
    (x) => (x.agents[0].profile.strength = 'infinite-output'),
    (x) => (x.agents[0].profile.joinedAt = 1e12),
    (x) => (x.agents[1].profile.portrait = x.agents[0].profile.portrait),
  ]) {
    const x = structuredClone(s);
    mutate(x);
    assert.throws(() => E.normalizeState(x));
  }
});
test('recruitment and health boundaries match stepped, direct and worker catch-up', async (t) => {
  const { Worker } = require('node:worker_threads');
  const s = E.createState(6);
  s.credits = 1e6;
  const a = hire(s);
  a.profile.weakness = 'recovery';
  const start = illnessStart(s, a);
  s.time = start - 25;
  s.resilience.budgetWindowStart = Math.floor(s.time / 3600) * 3600;
  s.resilience.graceUntil = start + 5000;
  const direct = structuredClone(s),
    stepped = structuredClone(s);
  E.advance(direct, 1800);
  for (let n = 0; n < 60; n++) E.advance(stepped, 30);
  assert.deepEqual(stepped, direct);
  const worker = new Worker(path.join(__dirname, 'helpers/worker-adapter.cjs'));
  t.after(() => worker.terminate());
  const result = await new Promise((resolve, reject) => {
    worker.on('error', reject);
    worker.on('message', (data) => {
      if (data.type === 'complete') resolve(data);
      if (data.type === 'error') reject(new Error(data.message));
    });
    worker.postMessage({ state: s, seconds: 1800 });
  });
  assert.deepEqual(result.state, E.normalizeState(direct));
});
