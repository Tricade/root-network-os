const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const I18N = require('../i18n.js');
const achievement = (id) => E.catalog.achievements.find((a) => a.id === id);

test('25 distinct milestones retain the original five IDs and bounded rewards', () => {
  const all = E.catalog.achievements;
  assert.equal(all.length, 25);
  assert.equal(new Set(all.map((a) => a.id)).size, 25);
  assert.deepEqual(
    all.filter((a) => a.legacy).map((a) => a.id),
    ['first_job', 'steady_network', 'three_servers', 'sector_two', 'million'],
  );
  assert.equal(
    all.filter((a) => !a.legacy).reduce((sum, a) => sum + a.reward, 0),
    2020,
  );
  assert.ok(all.filter((a) => a.tier === 'Herausforderung').length >= 6);
});

test('balance, cumulative earnings and recurring net profit are separate achievements', () => {
  const s = E.createState(701);
  s.credits = 21000;
  s.lifetimeCredits = 2200;
  assert.equal(achievement('million').check(s), false);
  assert.equal(E.act(s, 'claimAchievement', { id: 'million' }).ok, false);
  s.credits = 0;
  s.lifetimeCredits = 10000;
  assert.equal(achievement('million').check(s), true);
  assert.equal(achievement('profit_10000').check(s), false);
  assert.equal(achievement('profit_10000').check(s, { incomePerSecond: 9999 / 60 }), false);
  assert.equal(achievement('profit_10000').check(s, { incomePerSecond: 10000 / 60 }), true);
  assert.match(I18N.translate(achievement('million').name, 'en'), /total/i);
  assert.match(I18N.translate(achievement('profit_10000').description, 'en'), /operating costs/i);
});

test('old saves backfill new milestones without paying them or losing existing claims', () => {
  const old = E.createState(702);
  old.counters.jobs = 120;
  old.achievements.first_job = true;
  old.achievementUnlocks.first_job = true;
  for (const a of E.catalog.achievements.filter((a) => !a.legacy)) {
    delete old.achievementUnlocks[a.id];
    delete old.achievements[a.id];
  }
  const migrated = E.normalizeState(old);
  assert.equal(migrated.credits, old.credits);
  assert.equal(migrated.achievements.first_job, true);
  assert.equal(migrated.achievementUnlocks.jobs_100, true);
  assert.equal(migrated.achievementUnlocks.jobs_1000, false);
  assert.equal(E.act(migrated, 'claimAchievement', { id: 'jobs_100' }).ok, true);
  const reward = achievement('jobs_100').reward;
  assert.equal(migrated.credits, old.credits + reward);
  const loaded = E.normalizeState(migrated);
  assert.equal(E.act(loaded, 'claimAchievement', { id: 'jobs_100' }).ok, false);
  assert.equal(loaded.credits, migrated.credits);
});

test('an unlocked fleet milestone remains claimable after shrinking the fleet', () => {
  const s = E.createState(703);
  s.achievementUnlocks.servers_20 = true;
  const loaded = E.normalizeState(s);
  assert.equal(loaded.servers.length, 1);
  assert.equal(E.act(loaded, 'claimAchievement', { id: 'servers_20' }).ok, true);
  assert.equal(E.act(loaded, 'claimAchievement', { id: 'servers_20' }).ok, false);
});

test('migration still rejects invalid milestone flags rather than granting progress', () => {
  const invalid = E.createState(704);
  invalid.achievementUnlocks.jobs_100 = 'true';
  assert.throws(() => E.normalizeState(invalid), /Meilenstein/);
  invalid.achievementUnlocks.jobs_100 = false;
  delete invalid.achievementUnlocks.first_job;
  assert.throws(() => E.normalizeState(invalid), /Meilenstein/);
});
