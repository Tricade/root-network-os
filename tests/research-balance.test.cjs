'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const { fleet } = require('../tools/balance/scenarios.cjs');

test('a fresh network can fund its first lab project during the first 15 minutes', () => {
  const s = E.createState(8701);
  assert.equal(E.quoteResearch(s, 'business-desk').enabled, false);
  E.advance(s, 15 * 60);
  assert.ok(E.act(s, 'buyResearch', { id: 'business-desk' }).ok);
  E.advance(s, 10 * 60);
  assert.ok(s.lab.owned.includes('business-desk'));
  assert.ok(s.research < E.quoteResearch(s, 'market').cost);
});

test('agent training raises passive research with smaller gains and a finite upper bound', () => {
  const s = E.createState(83);
  const analyst = s.agents.find((a) => a.role === 'analyst');
  const rate = () => E.getMetrics(s).researchPerSecond;
  const entry = rate();
  analyst.level = 10;
  const trained = rate();
  analyst.level = 19;
  const experienced = rate();
  assert.ok(trained > entry);
  assert.ok(experienced > trained && experienced - trained < trained - entry);
  analyst.level = 10000;
  s.upgrades.synthesis = 1000;
  assert.ok(
    rate() < 0.09,
    'synthesis and a very strong specialist cannot inflate points without bound',
  );
  s.servers[0].powered = false;
  assert.equal(rate(), 0);
});

test('an active 24-server fleet earns less than a tier-two project in one hour', () => {
  const s = fleet(24, 1141);
  s.agents.find((a) => a.role === 'analyst').level = 10;
  const initialResearch = s.research;
  const initialJobs = s.counters.jobs;
  E.advance(s, 3600);
  assert.ok(s.counters.jobs - initialJobs >= 20, 'the fixture actually delivers routine work');
  assert.ok(s.research - initialResearch >= 200, 'a working fleet can fund lower-tier research');
  assert.ok(s.research - initialResearch < 1300, 'tier two costs more than one hour of earnings');
});

test('schema 9 retains its balance and pays each already booked research commitment at its old terms', () => {
  const legacy = E.createState(83);
  legacy.version = 9;
  legacy.sector = 4;
  legacy.research = 50000;
  legacy.jobs = [];
  legacy.resilience.graceUntil = 1e9;
  const analyst = legacy.agents.find((a) => a.role === 'analyst');
  const operator = legacy.agents.find((a) => a.role === 'operator');
  legacy.lab.owned = ['network-fabric'];
  legacy.lab.project = {
    id: 'routing',
    unique: false,
    targetLevel: 1,
    cost: 11,
    remaining: 20,
    total: 300,
    sector: 4,
  };
  legacy.operations.projects = [
    {
      agentId: analyst.id,
      kind: 'research',
      remaining: 20,
      total: 3600,
      cost: 360,
      level: 1,
      role: 'analyst',
      focus: 'research',
      synthesis: 0,
      research: 368,
      reputation: 0,
    },
  ];
  operator.assignment = {
    kind: 'research',
    label: 'Forschungsauftrag',
    remaining: 20,
    total: 300,
  };
  const loaded = E.normalizeState(legacy);
  assert.equal(loaded.version, 11);
  assert.equal(loaded.research, legacy.research);
  assert.deepEqual(loaded.lab, legacy.lab);
  assert.deepEqual(loaded.operations.projects, legacy.operations.projects);
  const forged = structuredClone(legacy);
  forged.operations.projects[0].research += 1;
  assert.throws(() => E.normalizeState(forged), /Veränderte Projektzusage/);
  const expected = legacy.research + 368 + 17 + 20 * E.getMetrics(loaded).researchPerSecond;
  E.advance(loaded, 20);
  assert.ok(Math.abs(loaded.research - expected) < 1e-6);
  assert.equal(loaded.upgrades.routing, 1);
  assert.equal(loaded.lab.project, null);
  assert.deepEqual(loaded.operations.projects, []);
  assert.equal(loaded.agents.find((a) => a.id === operator.id).assignment, null);
  assert.ok(E.quoteResearch(loaded, 'routing').cost > 100);
});
