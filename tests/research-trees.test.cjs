'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict');
const E = require('../engine.js');
const { TECHNOLOGIES, RESEARCH_TREES, researchEffects } = require('../engine/research-catalog.js')(
  require('../engine/research-expansion.js')({
    ...require('../engine/research-infrastructure-catalog.js')({}),
    ...require('../engine/research-business-catalog.js')({}),
    ...require('../engine/research-compute-catalog.js')({}),
  }),
);
function lab(seed = 9101) {
  const s = E.createState(seed);
  s.jobs = [];
  s.research = 100000;
  s.credits = 1e6;
  s.resilience.graceUntil = 1e9;
  return s;
}
function complete(s, id) {
  const q = E.quoteResearch(s, id);
  assert.ok(q.enabled, q.reason);
  assert.ok(E.act(s, 'buyResearch', { id }).ok);
  E.advance(s, q.duration);
}

test('research is funded once, binds the lab and project throughput, and applies effects only on completion', () => {
  const s = lab(),
    baseline = E.getMetrics(s),
    budget = s.research;
  const q = E.quoteResearch(s, 'network-fabric');
  assert.ok(E.act(s, 'buyResearch', { id: 'network-fabric' }).ok);
  assert.equal(s.research, budget - q.cost);
  assert.equal(s.lab.owned.length, 0);
  assert.ok(
    E.getMetrics(s).workPerSecond < baseline.workPerSecond,
    'funded lab occupies 10% of project throughput',
  );
  const locked = structuredClone(s);
  assert.equal(E.act(s, 'buyResearch', { id: 'science-methods' }).ok, false);
  assert.deepEqual(s, locked);
  E.advance(s, q.duration - 1);
  assert.equal(s.lab.owned.length, 0);
  E.advance(s, 1);
  assert.deepEqual(s.lab.owned, ['network-fabric']);
  assert.equal(s.lab.project, null);
  assert.ok(Math.abs(E.getMetrics(s).workPerSecond / baseline.workPerSecond - 1.04) < 1e-8);
  const after = structuredClone(s);
  assert.equal(E.act(s, 'buyResearch', { id: 'network-fabric' }).ok, false);
  assert.deepEqual(s, after);
});

test('tree prerequisites, sector gates and all 97 technologies are finite and form an acyclic extensible graph', () => {
  assert.equal(RESEARCH_TREES.length, 8);
  assert.equal(TECHNOLOGIES.length, 97);
  const ids = new Set(TECHNOLOGIES.map((n) => n.id));
  assert.equal(ids.size, 97);
  const visited = new Set(),
    visiting = new Set();
  function visit(id) {
    assert.ok(ids.has(id));
    assert.equal(visiting.has(id), false, 'no research dependency cycle');
    if (visited.has(id)) return;
    visiting.add(id);
    TECHNOLOGIES.find((n) => n.id === id).requires.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  }
  TECHNOLOGIES.forEach((n) => {
    visit(n.id);
    assert.ok(n.cost > 0 && n.duration >= 600);
    assert.ok(RESEARCH_TREES.some((t) => t.id === n.tree));
  });
  const s = lab();
  assert.equal(E.quoteResearch(s, 'science-serving').enabled, false);
  assert.equal(E.quoteResearch(s, 'routing').enabled, false);
  s.sector = 10;
  for (const n of TECHNOLOGIES.filter((n) => !n.expansion)) {
    complete(s, n.id);
    assert.equal(s.lab.owned.includes(n.id), true);
    assert.deepEqual(E.normalizeState(s).lab, s.lab);
  }
  for (const value of Object.values(researchEffects(s)))
    assert.ok(Number.isFinite(value) && value >= 0 && value < 2);
  complete(s, 'routing');
  assert.equal(s.upgrades.routing, 1, 'existing repeatables also require laboratory time');
});

test('power loss pauses research; reload resumes the exact paid project without restarting or charging again', () => {
  const s = lab(9103);
  complete(s, 'science-methods');
  assert.ok(E.act(s, 'buyResearch', { id: 'synthesis' }).ok);
  E.advance(s, 60);
  s.servers[0].powered = false;
  const remaining = s.lab.project.remaining;
  E.advance(s, 120);
  assert.equal(s.lab.project.remaining, remaining);
  assert.equal(E.getResearch(s).paused, true);
  const loaded = E.normalizeState(s);
  assert.deepEqual(loaded.lab, s.lab);
  loaded.servers[0].powered = true;
  E.advance(loaded, remaining);
  assert.equal(loaded.upgrades.synthesis, 1);
  assert.equal(loaded.lab.project, null);
});

test('committed research reduces protected points and abandonment never refunds them', () => {
  const s = lab(9104);
  s.resilience.backup = {
    createdAt: s.time,
    research: 100000,
    protectedResearch: 100000,
    jobs: [],
  };
  const q = E.quoteResearch(s, 'business-desk');
  assert.ok(E.act(s, 'buyResearch', { id: 'business-desk' }).ok);
  assert.equal(s.resilience.backup.protectedResearch, 100000 - q.cost);
  const points = s.research;
  assert.ok(E.act(s, 'cancelResearch').ok);
  assert.equal(s.research, points);
  assert.equal(s.lab.owned.length, 0);
  assert.equal(s.resilience.backup.protectedResearch, 100000 - q.cost);
});

test('schema 6 upgrades and balances survive research migration; crafted paid projects and missing prerequisites fail', () => {
  const prior = lab(9105);
  prior.version = 6;
  delete prior.lab;
  prior.upgrades.routing = 50;
  prior.upgrades.cooling = 30;
  const source = structuredClone(prior),
    s = E.normalizeState(prior);
  assert.deepEqual(prior, source);
  assert.deepEqual(s.upgrades, prior.upgrades);
  assert.equal(s.research, prior.research);
  assert.equal(s.version, 11);
  assert.deepEqual(s.lab, { version: 1, owned: [], project: null });
  assert.ok(E.act(s, 'buyResearch', { id: 'network-fabric' }).ok);
  for (const mutate of [
    (p) => (p.cost = 0),
    (p) => (p.total = 1),
    (p) => (p.targetLevel = 50),
    (p) => (p.id = 'unknown'),
    (p) => (p.remaining = -1),
  ]) {
    const bad = structuredClone(s);
    mutate(bad.lab.project);
    assert.throws(() => E.normalizeState(bad));
  }
  const bad = structuredClone(s);
  bad.lab.project = null;
  bad.lab.owned = ['science-serving'];
  assert.throws(() => E.normalizeState(bad), /Forschungsplan/);
  const before = structuredClone(s);
  E.getResearch(s);
  E.quoteResearch(s, 'network-telemetry');
  assert.deepEqual(s, before, 'research read models are pure');
});
