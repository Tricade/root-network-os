const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

test('specialization unlocks at level 14, charges once and changes the corresponding actual work', () => {
  let s = E.createState(101);
  s.credits = 1e8;
  const id = s.agents[0].id;
  s.agents[0].level = 13;
  const service = { id, specialty: 'service' };
  assert.equal(E.act(s, 'specializeAgent', service).ok, false);
  s.agents[0].level = 14;
  const before = E.getAgentDevelopment(s, id).before;
  const price = E.quoteAgentSpecialty(s, id, 'service').cost,
    cash = s.credits;
  assert.ok(E.act(s, 'specializeAgent', service).ok);
  assert.equal(s.credits, cash - price);
  assert.equal(E.act(s, 'specializeAgent', service).ok, false);
  s = E.normalizeState(s);
  assert.equal(s.agents[0].specialty, 'service');
  const trained = E.getAgentDevelopment(s, id);
  assert.ok(trained.before.customerSeconds < before.customerSeconds);
  assert.ok(trained.after.customerSeconds < trained.before.customerSeconds);
  assert.ok(E.act(s, 'specializeAgent', { id, specialty: 'projects' }).ok);
  assert.ok(E.getAgentDevelopment(s, id).before.work > trained.before.work);
  assert.equal(E.getAgentDevelopment(s, id).before.customerSeconds, before.customerSeconds);
  assert.equal(E.act(s, 'specializeAgent', { id, specialty: 'maintenance' }).ok, false);
});

test('specialized rack maintenance keeps its booked duration across reload', () => {
  const s = E.createState(103);
  const engineer = s.agents[0];
  engineer.role = 'engineer';
  engineer.level = 14;
  s.credits = 1e6;
  s.customers.contracts = [];
  s.business.rooms[0].groups[0].units = 0;
  s.servers[0].condition = 60;
  const payload = { rackId: 'rack-1', agentId: engineer.id };
  const regular = E.quotePreventiveMaintenance(s, payload);
  assert.ok(E.act(s, 'specializeAgent', { id: engineer.id, specialty: 'maintenance' }).ok);
  const trained = E.quotePreventiveMaintenance(s, payload);
  assert.equal(trained.enabled, true, trained.reason);
  assert.ok(trained.duration < regular.duration);
  assert.ok(E.act(s, 'schedulePreventiveMaintenance', payload).ok);
  E.advance(s, 1);
  const loaded = E.normalizeState(s);
  assert.equal(loaded.preventiveMaintenance.operation.total, trained.duration);
  assert.equal(
    E.act(loaded, 'specializeAgent', { id: engineer.id, specialty: 'projects' }).ok,
    false,
  );
});
test('agent development preview is pure and agrees with purchased network rates and wages', () => {
  const s = E.createState(101);
  s.credits = 1e9;
  const a = s.agents[0],
    saved = JSON.stringify(s),
    q = E.getAgentDevelopment(s, a.id);
  assert.equal(JSON.stringify(s), saved);
  assert.equal(q.level, a.level);
  assert.equal(q.nextLevel, a.level + 1);
  assert.ok(q.after.wage > q.before.wage);
  const cash = s.credits;
  assert.ok(E.act(s, 'upgradeAgent', { id: a.id }).ok);
  const m = E.getMetrics(s);
  assert.equal(cash - s.credits, q.cost);
  assert.equal(m.workPerSecond * 60, q.after.work);
  assert.equal(m.researchPerSecond * 60, q.after.research);
  assert.equal(m.riskPerHour, q.after.risk);
  assert.equal(E.getPersonnel(s).agents.find((x) => x.id === a.id).wage * 3600, q.after.wage);
});
test('capped workforce improvements remain flat while development raises running costs', () => {
  const s = E.createState(102);
  s.credits = 1e12;
  s.agents.forEach((a) => {
    a.level = 1000;
    a.focus = 'income';
  });
  const q = E.getAgentDevelopment(s, s.agents[0].id);
  assert.equal(q.before.work, q.after.work);
  assert.equal(q.before.customerSeconds, q.after.customerSeconds);
  assert.ok(q.after.wage > q.before.wage);
});
test('customer work locks agent development and focus in both quote and action paths', () => {
  const s = E.createState(103);
  s.credits = 1e8;
  const a = s.agents[0];
  s.customers.contracts[0].work = 'support';
  s.customers.contracts[0].workRemaining = 600;
  s.customers.contracts[0].workTotal = 600;
  s.customers.contracts[0].agentId = a.id;
  assert.equal(E.quoteAgentUpgrade(s, a.id).enabled, false);
  const before = JSON.stringify(s);
  assert.equal(E.act(s, 'upgradeAgent', { id: a.id }).ok, false);
  assert.equal(E.act(s, 'setAgentFocus', { id: a.id, focus: 'research' }).ok, false);
  assert.equal(JSON.stringify(s), before);
});
