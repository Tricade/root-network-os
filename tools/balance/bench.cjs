'use strict';
// Run with `node tools/balance/bench.cjs`. Timings are evidence, never CI pass thresholds.
const assert = require('node:assert/strict');
const E = require('../../engine.js');
const { fresh, fleet } = require('./scenarios.cjs');
const rows = [];
function run(label, s, hours) {
  const initial = s.credits,
    initialJobs = s.counters.jobs,
    start = performance.now();
  for (let elapsed = 0; elapsed < hours; elapsed += 12)
    E.advance(s, Math.min(12, hours - elapsed) * 3600);
  const m = E.getMetrics(s);
  assert.ok(Number.isFinite(s.credits) && s.credits >= 0);
  assert.ok(m.workPerSecond >= 0 && Number.isFinite(m.incomePerSecond));
  E.normalizeState(s);
  rows.push({
    label,
    hours,
    seed: s.seed,
    servers: s.servers.length,
    creditsDelta: Math.round(s.credits - initial),
    jobs: s.counters.jobs - initialJobs,
    grossPerSecond: +m.serviceIncome.toFixed(3),
    netPerSecond: +m.incomePerSecond.toFixed(3),
    failed: s.servers.filter((n) => n.status === 'failed').length,
    incident: s.resilience.incident?.kind || null,
    wallMs: Math.round(performance.now() - start),
  });
}
for (const seed of [101, 102, 103]) run(`fresh-${seed}`, fresh(seed), 24);
run('mixed-24', fleet(24), 24);
// One minute is enough to measure work per tick without extrapolating a full large-fleet catch-up.
for (const count of [60, 240, 960]) run(`scale-${count}`, fleet(count), 1 / 60);
const offline = fleet(24, 104),
  online = structuredClone(offline);
E.advance(offline, 3600);
for (let i = 0; i < 3600; i++) E.advance(online, 1);
assert.deepEqual(offline, online, 'Identical policy decisions must have online/offline parity.');
process.stdout.write(
  JSON.stringify({ node: process.version, onlineOfflineParity: true, rows }, null, 2) + '\n',
);
