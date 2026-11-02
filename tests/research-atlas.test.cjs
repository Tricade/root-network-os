'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const I18N = require('../i18n.js');
const model = E.getResearch(E.createState(7));
function prerequisites(id, target = new Set()) {
  for (const key of model.technologies.find((n) => n.id === id).requires) {
    prerequisites(key, target);
    target.add(key);
  }
  return [...target];
}
function fixture(id) {
  const s = E.createState(14);
  s.sector = 10;
  s.research = 1e6;
  s.credits = 1e7;
  s.jobs = [];
  s.resilience.graceUntil = 1e9;
  s.lab.owned = prerequisites(id);
  return E.normalizeState(s);
}

test('all 80 expansion nodes are fundable, saveable and apply exactly once after their paid time', () => {
  for (const n of model.technologies.filter((n) => n.expansion)) {
    const s = fixture(n.id),
      before = E.getResearchEffects(s),
      budget = s.research;
    const q = E.quoteResearch(s, n.id);
    assert.ok(q.enabled, n.id + ': ' + q.reason);
    assert.ok(E.act(s, 'buyResearch', { id: n.id }).ok);
    assert.equal(s.research, budget - q.cost);
    assert.deepEqual(E.getResearchEffects(s), before, 'no early benefit');
    // A legitimate saved project one second before completion exercises the same engine boundary.
    s.lab.project.remaining = 1;
    const loaded = E.normalizeState(s);
    E.advance(loaded, 1);
    assert.ok(loaded.lab.owned.includes(n.id), n.id);
    assert.equal(loaded.lab.project, null);
    assert.notDeepEqual(E.getResearchEffects(loaded), before, n.id);
    assert.deepEqual(E.normalizeState(loaded).lab, loaded.lab);
    assert.equal(E.act(loaded, 'buyResearch', { id: n.id }).ok, false);
  }
});

test('terminal doctrine switches keep the current trade-off until completion, cancel without refund and reject dual imports', () => {
  for (const tree of model.trees) {
    const choices = model.technologies.filter((n) => n.doctrine === tree.id);
    assert.equal(choices.length, 2);
    for (const n of choices)
      assert.ok(!model.technologies.some((p) => p.requires.includes(n.id)), 'terminal only');
    const [a, b] = choices,
      s = fixture(b.id);
    s.lab.owned.push(a.id);
    const active = E.getResearchEffects(s),
      q = E.quoteResearch(s, b.id);
    assert.deepEqual(q.replaces, [a.id]);
    assert.equal(q.duration, 86400);
    assert.ok(E.act(s, 'buyResearch', { id: b.id }).ok);
    const paid = s.research;
    assert.deepEqual(E.getResearchEffects(s), active);
    assert.ok(E.act(s, 'cancelResearch').ok);
    assert.equal(s.research, paid);
    assert.ok(s.lab.owned.includes(a.id));
    assert.ok(!s.lab.owned.includes(b.id));
    assert.ok(E.act(s, 'buyResearch', { id: b.id }).ok);
    s.lab.project.remaining = 1;
    const loaded = E.normalizeState(s);
    E.advance(loaded, 1);
    assert.ok(!loaded.lab.owned.includes(a.id));
    assert.ok(loaded.lab.owned.includes(b.id));
    assert.notDeepEqual(E.getResearchEffects(loaded), active);
    const bad = structuredClone(loaded);
    bad.lab.owned.push(a.id);
    assert.throws(() => E.normalizeState(bad), /Forschungsplan/);
  }
});

test('all 256 full-tree doctrine builds remain bounded and smaller nodes have diminishing marginal benefits', () => {
  const ordinary = model.technologies.filter((n) => !n.doctrine).map((n) => n.id);
  const choices = model.trees.map((t) => model.technologies.filter((n) => n.doctrine === t.id));
  const s = E.createState(16);
  s.sector = 10;
  for (let mask = 0; mask < 256; mask++) {
    s.lab.owned = [...ordinary, ...choices.map((list, i) => list[(mask >> i) & 1].id)];
    const f = E.getResearchEffects(s);
    for (const [key, value] of Object.entries(f)) {
      assert.ok(Number.isFinite(value), key);
      assert.ok(
        value >= (key === 'retentionBonus' ? 0 : key === 'noticeLead' ? 0.5 : 0.55) && value < 1.8,
        `${key}: ${value}`,
      );
    }
    assert.ok(f.retentionBonus < 0.25);
    assert.ok(0.65 + f.retentionBonus < 1, 'customer retention never certain');
    assert.ok(f.research < 1.4, 'no runaway research multiplier');
    assert.ok(f.serviceEfficiency > 0.7, 'no free service capacity');
  }
  const plain = fixture('network-queues');
  const base = E.getResearchEffects(plain).work;
  plain.lab.owned.push('network-queues');
  const early = E.getResearchEffects(plain).work / base;
  plain.lab.owned = ordinary.filter((id) => id !== 'network-queues');
  const lateBase = E.getResearchEffects(plain).work;
  plain.lab.owned.push('network-queues');
  const late = E.getResearchEffects(plain).work / lateBase;
  assert.ok(early > late && late > 1);
  const mutable = E.getResearchEffects(plain);
  mutable.work = 1e9;
  assert.notEqual(
    E.getResearchEffects(plain).work,
    1e9,
    'public callers cannot corrupt cached effects',
  );
});

test('research districts and nodes have English copy and a collision-free stable pan/zoom layout', async () => {
  const { researchLayout, researchAncestors, MAP_SIZE } = await import('../ui/research-map.js');
  const { zoomResearchCamera } = await import('../ui/research-map-input.js');
  const layout = researchLayout(model);
  assert.equal(layout.size, 97);
  const points = [...layout.values()];
  for (const p of points) {
    assert.ok(p.x > 100 && p.y > 100 && p.x < MAP_SIZE - 100 && p.y < MAP_SIZE - 100);
    for (const q of points)
      if (q !== p) assert.ok(Math.hypot(p.x - q.x, p.y - q.y) > 95, 'no overlapping nodes');
  }
  for (const def of [...model.trees, ...model.technologies]) {
    assert.ok(I18N.translate(def.name, 'en').length);
    if (/[äöüß]|ung|verfahren|Doktrin|Betrieb|Kühl|Netz|Kunden|Wissen/.test(def.name))
      assert.notEqual(I18N.translate(def.name, 'en'), def.name, def.name);
    assert.notEqual(
      I18N.translate(def.description, 'en'),
      def.description,
      def.name + ' description',
    );
  }
  assert.ok(researchAncestors(model, 'science-production').has('business-planning'));
  const before = { x: -70, y: 12, scale: 0.3 },
    point = { x: 200, y: 300 };
  const after = zoomResearchCamera(before, 1.4, point);
  assert.ok(
    Math.abs((point.x - before.x) / before.scale - (point.x - after.x) / after.scale) < 1e-8,
  );
  assert.equal(zoomResearchCamera(before, 100, point).scale, 1.4);
  assert.equal(zoomResearchCamera(before, 0.0001, point).scale, 0.12);
});
