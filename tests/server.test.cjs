'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createServer, maxBody } = require('../server.cjs');

async function withServer(t, fn) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'root-server-test-'));
  const server = createServer({ port: 0, dataDir });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  await fn({ base, dataDir });
}

function fixture() {
  const enginePath = path.join(__dirname, '..', 'engine.js');
  const engine = require(enginePath);
  return engine.createState(24680);
}

test('legacy achievement catalogs migrate on read but stale writers cannot erase new claims', async (t) => {
  await withServer(t, async ({ base, dataDir }) => {
    const E = require('../engine.js');
    const old = fixture();
    old.counters.jobs = 100;
    for (const a of E.catalog.achievements.filter((a) => !a.legacy)) {
      delete old.achievementUnlocks[a.id];
      delete old.achievements[a.id];
    }
    const original = JSON.stringify(old);
    await fs.writeFile(path.join(dataDir, 'save.json'), original);
    const current = (await (await fetch(base + '/api/save')).json()).save;
    assert.equal(current.achievementUnlocks.jobs_100, true);
    assert.equal(current.credits, old.credits);
    const post = (save) =>
      fetch(base + '/api/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: base },
        body: JSON.stringify(save),
      });
    const rejected = await post(old);
    assert.equal(rejected.status, 409);
    assert.equal((await rejected.json()).updateRequired, true);
    assert.equal(await fs.readFile(path.join(dataDir, 'save.json'), 'utf8'), original);
    assert.equal(E.act(current, 'claimAchievement', { id: 'jobs_100' }).ok, true);
    assert.equal((await post(current)).status, 200);
    const reload = (await (await fetch(base + '/api/save')).json()).save;
    assert.equal(reload.achievements.jobs_100, true);
    assert.equal(E.act(reload, 'claimAchievement', { id: 'jobs_100' }).ok, false);
    assert.equal(await fs.readFile(path.join(dataDir, 'save.backup.json'), 'utf8'), original);
  });
});

test('schema 5, 6 and 7 load as schema 8 without losing progress; old writers cannot erase customers or paid research', async (t) => {
  const E = require('../engine.js');
  for (const version of [5, 6, 7])
    await withServer(t, async ({ base, dataDir }) => {
      const old = E.createState(700 + version);
      old.version = version;
      if (version < 7) delete old.lab;
      delete old.customerGrowth;
      delete old.preventiveMaintenance;
      delete old.servicePriorities;
      if (version === 5) delete old.customers;
      old.agents[0].level = 7;
      old.upgrades.routing = 9;
      old.credits = 123456;
      const original = JSON.stringify(old, null, 2) + '\n';
      await fs.writeFile(path.join(dataDir, 'save.json'), original);
      const loaded = (await (await fetch(base + '/api/save')).json()).save;
      assert.equal(loaded.version, 8);
      assert.equal(loaded.agents[0].level, 7);
      assert.equal(loaded.upgrades.routing, 9);
      assert.equal(loaded.credits, 123456);
      assert.equal(
        loaded.customers.contracts.reduce((n, c) => n + c.units, 0),
        3,
      );
      const post = (save) =>
        fetch(base + '/api/save', {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: base },
          body: JSON.stringify(save),
        });
      assert.equal((await post(old)).status, 409);
      assert.equal(await fs.readFile(path.join(dataDir, 'save.json'), 'utf8'), original);
      loaded.research = 100;
      assert.ok(E.act(loaded, 'buyResearch', { id: 'network-fabric' }).ok);
      assert.equal((await post(loaded)).status, 200);
      assert.equal(await fs.readFile(path.join(dataDir, 'save.backup.json'), 'utf8'), original);
      const current = (await (await fetch(base + '/api/save')).json()).save;
      assert.equal(current.lab.project.id, 'network-fabric');
      assert.equal(current.lab.project.remaining, 600);
    });
});

async function legacyFixture() {
  return JSON.parse(await fs.readFile(path.join(__dirname, 'fixtures', 'v1-save.json'), 'utf8'));
}

async function v2Fixture() {
  return JSON.parse(await fs.readFile(path.join(__dirname, 'fixtures', 'v2-save.json'), 'utf8'));
}

test('health endpoint, loopback-only static allowlist, and API boundaries', async (t) => {
  await withServer(t, async ({ base }) => {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {
      app: 'ROOT',
      version: 8,
      release: require('../package.json').version,
    });
    for (const file of [
      '/server.cjs',
      '/server/static-files.cjs',
      '/data/save.json',
      '/package.json',
      '/missing',
    ]) {
      assert.equal((await fetch(`${base}${file}`)).status, 404, `${file} is not publicly served`);
    }
    for (const [url, mime] of [
      ['/rack-ui.js', /^text\/javascript/],
      ['/racks.css', /^text\/css/],
      ['/room.js', /^text\/javascript/],
      ['/room.css', /^text\/css/],
      ['/vendor/three.module.js', /^text\/javascript/],
      ['/vendor/three.core.js', /^text\/javascript/],
      ['/vendor/RoomEnvironment.js', /^text\/javascript/],
      ['/vendor/RoundedBoxGeometry.js', /^text\/javascript/],
      ['/room-stations.js', /^text\/javascript/],
    ]) {
      const asset = await fetch(`${base}${url}`);
      assert.equal(asset.status, 200, `${url} is available from the static allowlist`);
      assert.match(asset.headers.get('content-type'), mime);
    }
    const faviconPath = path.join(__dirname, '..', 'favicon.svg');
    try {
      await fs.access(faviconPath);
      const favicon = await fetch(`${base}/favicon.svg`);
      assert.equal(favicon.status, 200);
      assert.match(favicon.headers.get('content-type'), /^image\/svg\+xml/);
      assert.match(
        favicon.headers.get('content-security-policy'),
        /style-src 'self' 'unsafe-inline'/,
      );
      assert.match(favicon.headers.get('content-security-policy'), /script-src 'self'/);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    assert.equal((await fetch(`${base}/api/health`, { method: 'POST' })).status, 405);
    const denied = await fetch(`${base}/api/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://attacker.example' },
      body: JSON.stringify(fixture()),
    });
    assert.equal(denied.status, 403);
  });
});

test('all split browser modules are served locally while build and server sources remain private', async (t) => {
  await withServer(t, async ({ base }) => {
    const project = path.join(__dirname, '..');
    const folders = ['engine', 'ui', 'ui/racks', 'room', 'locales'];
    for (const folder of folders) {
      for (const entry of await fs.readdir(path.join(project, folder), { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
        const url = `/${folder}/${entry.name}`,
          response = await fetch(base + url);
        assert.equal(response.status, 200, url);
        assert.match(response.headers.get('content-type'), /^text\/javascript/);
        assert.equal(
          await response.text(),
          await fs.readFile(path.join(project, folder, entry.name), 'utf8'),
        );
      }
    }
    for (const url of [
      '/tests/construction.test.cjs',
      '/tools/asset-generator/generate.mjs',
      '/.local-data/save.json',
    ]) {
      assert.equal((await fetch(base + url)).status, 404, url);
    }
  });
});

test('paid construction survives HTTP save reload and stale pre-construction clients cannot erase it', async (t) => {
  const E = require('../engine.js');
  await withServer(t, async ({ base, dataDir }) => {
    const state = E.createState(735);
    state.credits = 1e9;
    assert.ok(E.act(state, 'buildFloor').ok);
    state.facility.building.project.remaining = 100;
    const post = (save) =>
      fetch(base + '/api/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: base },
        body: JSON.stringify(save),
      });
    assert.equal((await post(state)).status, 200);
    const bytes = await fs.readFile(path.join(dataDir, 'save.json'), 'utf8');
    const reloaded = (await (await fetch(base + '/api/save')).json()).save;
    assert.deepEqual(reloaded.facility.building.project, state.facility.building.project);
    const stale = structuredClone(reloaded);
    delete stale.facility.building;
    const response = await post(stale);
    assert.equal(response.status, 409);
    assert.equal((await response.json()).updateRequired, true);
    assert.equal(await fs.readFile(path.join(dataDir, 'save.json'), 'utf8'), bytes);
    E.advance(reloaded, 100);
    assert.equal((await post(reloaded)).status, 200);
    const completed = (await (await fetch(base + '/api/save')).json()).save;
    assert.equal(completed.facility.building.floors, 2);
    assert.equal(completed.facility.building.rooms.length, 1);
    assert.equal(completed.facility.building.project, null);
  });
});

test('save round-trip persists data and preserves the previous save as backup', async (t) => {
  await withServer(t, async ({ base, dataDir }) => {
    assert.deepEqual(await (await fetch(`${base}/api/save`)).json(), { save: null });
    const first = fixture();
    const second = fixture();
    second.savedAt = (second.savedAt || 0) + 1;
    for (const save of [first, second]) {
      const response = await fetch(`${base}/api/save`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: base },
        body: JSON.stringify(save),
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true });
    }
    const stored = JSON.parse(await fs.readFile(path.join(dataDir, 'save.json'), 'utf8'));
    const backup = JSON.parse(await fs.readFile(path.join(dataDir, 'save.backup.json'), 'utf8'));
    assert.equal(stored.version, 8);
    assert.equal(backup.version, 8);
    if (second.marker) assert.equal(stored.marker, 'fixture');
    assert.ok(await (await fetch(`${base}/api/save`)).json());
  });
});

test('schema 4 upgrades in memory, survives a v5 write as exact backup and stale v4 clients cannot erase agents', async (t) => {
  const E = require('../engine.js');
  await withServer(t, async ({ base, dataDir }) => {
    const legacy = E.createState(55);
    legacy.version = 4;
    delete legacy.personnel;
    for (const a of legacy.agents) delete a.profile;
    legacy.agents[0].level = 3;
    const original = JSON.stringify(legacy, null, 2) + '\n';
    await fs.writeFile(path.join(dataDir, 'save.json'), original);
    const response = await fetch(base + '/api/save');
    const upgraded = (await response.json()).save;
    assert.equal(upgraded.version, 8);
    assert.equal(upgraded.agents[0].level, 3);
    assert.ok(upgraded.agents.every((a) => a.profile.weakness === null));
    assert.equal(await fs.readFile(path.join(dataDir, 'save.json'), 'utf8'), original);
    const post = (save) =>
      fetch(base + '/api/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: base },
        body: JSON.stringify(save),
      });
    assert.equal((await post(upgraded)).status, 200);
    assert.equal(await fs.readFile(path.join(dataDir, 'save.backup.json'), 'utf8'), original);
    const current = await fs.readFile(path.join(dataDir, 'save.json'), 'utf8');
    const stale = await post(legacy);
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).updateRequired, true);
    assert.equal(await fs.readFile(path.join(dataDir, 'save.json'), 'utf8'), current);
    assert.equal(await fs.readFile(path.join(dataDir, 'save.backup.json'), 'utf8'), original);
  });
});

test('rejects stale v1 and v2 writes with updateRequired without creating or overwriting either copy', async (t) => {
  const staleStates = [await legacyFixture(), await v2Fixture()];
  await withServer(t, async ({ base, dataDir }) => {
    for (const stale of staleStates) {
      const response = await fetch(`${base}/api/save`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: base },
        body: JSON.stringify(stale),
      });
      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), {
        ok: false,
        updateRequired: true,
        error:
          'Diese Oberfläche stammt aus einer älteren Version. Lade sie neu, bevor du fortfährst.',
      });
    }
    await assert.rejects(fs.access(path.join(dataDir, 'save.json')));
    await assert.rejects(fs.access(path.join(dataDir, 'save.backup.json')));

    const current = require('../engine.js').createState(654);
    const currentResponse = await fetch(`${base}/api/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify(current),
    });
    assert.equal(currentResponse.status, 200);
    const currentBytes = await fs.readFile(path.join(dataDir, 'save.json'), 'utf8');
    for (const stale of staleStates) {
      const staleAgain = await fetch(`${base}/api/save`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: base },
        body: JSON.stringify(stale),
      });
      assert.equal(staleAgain.status, 409);
      assert.equal(await fs.readFile(path.join(dataDir, 'save.json'), 'utf8'), currentBytes);
    }
    await assert.rejects(fs.access(path.join(dataDir, 'save.backup.json')));
  });
});

test('GET migrates a v1 source in memory and retains its bytes until the explicit v3 save', async (t) => {
  const engine = require('../engine.js');
  const legacy = await legacyFixture();
  await withServer(t, async ({ base, dataDir }) => {
    legacy.credits = 2345;
    legacy.research = 67;
    legacy.servers[0].level = 4;
    const originalBytes = `${JSON.stringify(legacy)}\n`;
    const source = path.join(dataDir, 'save.json');
    await fs.writeFile(source, originalBytes, 'utf8');

    const response = await fetch(`${base}/api/save`);
    assert.equal(response.status, 200);
    const migrated = (await response.json()).save;
    assert.equal(migrated.version, 8);
    assert.equal(migrated.credits, legacy.credits);
    assert.equal(migrated.research, legacy.research);
    assert.equal(migrated.servers[0].id, legacy.servers[0].id);
    assert.equal(migrated.servers[0].level, legacy.servers[0].level);
    assert.deepEqual(
      migrated.agents.map(({ id, role, level }) => ({ id, role, level })),
      legacy.agents.map(({ id, role, level }) => ({ id, role, level })),
    );
    assert.deepEqual(
      migrated.jobs.map(({ id, title, work, totalWork }) => ({ id, title, work, totalWork })),
      legacy.jobs.map(({ id, title, work, totalWork }) => ({ id, title, work, totalWork })),
    );
    assert.deepEqual(migrated.upgrades, legacy.upgrades);
    for (const key of ['power', 'autocontract', 'autorepair', 'priority'])
      assert.equal(migrated.policies[key], legacy.policies[key]);
    assert.equal(migrated.resilience.parts, 3);
    assert.equal(migrated.resilience.graceUntil, legacy.time + 600);
    assert.equal(migrated.resilience.backup, null);
    assert.equal(migrated.policies.autobackup, true);
    assert.equal(migrated.policies.repairBudget, 300);
    assert.equal(migrated.policies.reserve, 250);
    assert.equal(await fs.readFile(source, 'utf8'), originalBytes);

    const saved = await fetch(`${base}/api/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify(migrated),
    });
    assert.equal(saved.status, 200);
    assert.equal(JSON.parse(await fs.readFile(source, 'utf8')).version, 8);
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(dataDir, 'save.backup.json'), 'utf8')),
      legacy,
    );
    assert.equal((await (await fetch(`${base}/api/save`)).json()).save.version, 8);
    assert.equal(engine.normalizeState(migrated).version, 8);
  });
});

test('GET migrates a v2 source in memory and retains its bytes until the explicit v3 save', async (t) => {
  const engine = require('../engine.js');
  const legacy = await v2Fixture();
  await withServer(t, async ({ base, dataDir }) => {
    legacy.networkName = 'Bestand Rack 02';
    legacy.credits = 3210;
    legacy.servers[0].condition = 61;
    const originalBytes = `${JSON.stringify(legacy)}\n`;
    const source = path.join(dataDir, 'save.json');
    await fs.writeFile(source, originalBytes, 'utf8');

    const response = await fetch(`${base}/api/save`);
    assert.equal(response.status, 200);
    const migrated = (await response.json()).save;
    assert.equal(migrated.version, 8);
    assert.equal(migrated.networkName, legacy.networkName);
    assert.equal(migrated.credits, legacy.credits);
    assert.equal(migrated.servers[0].id, legacy.servers[0].id);
    assert.equal(migrated.servers[0].condition, legacy.servers[0].condition);
    assert.equal(migrated.facility.racks.length > 0, true);
    const rackIds = new Set(migrated.facility.racks.map((rack) => rack.id));
    assert.ok(migrated.servers.every((server) => rackIds.has(server.rackId)));
    assert.equal(await fs.readFile(source, 'utf8'), originalBytes);

    const saved = await fetch(`${base}/api/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify(migrated),
    });
    assert.equal(saved.status, 200);
    assert.equal(JSON.parse(await fs.readFile(source, 'utf8')).version, 8);
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(dataDir, 'save.backup.json'), 'utf8')),
      legacy,
    );
    assert.equal((await (await fetch(`${base}/api/save`)).json()).save.version, 8);
    assert.equal(engine.normalizeState(migrated).version, 8);
  });
});

test('v3 save round-trip preserves resilience settings, condition and protected backup research', async (t) => {
  const engine = require('../engine.js');
  const fixture = engine.createState(2026);
  assert.equal(fixture.version, 8);
  fixture.servers[0].condition = 73;
  fixture.servers[0].status = 'online';
  fixture.servers[0].fault = null;
  fixture.policies.autobackup = false;
  fixture.policies.repairBudget = 100;
  fixture.policies.reserve = 1000;
  fixture.resilience.parts = 9;
  fixture.resilience.integrity = 86;
  fixture.resilience.backup = {
    createdAt: fixture.time,
    research: fixture.research,
    protectedResearch: Math.max(0, fixture.research - 2),
    jobs: [],
  };
  const expected = engine.normalizeState(fixture);
  await withServer(t, async ({ base }) => {
    const saved = await fetch(`${base}/api/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify(expected),
    });
    assert.equal(saved.status, 200);
    const loaded = await (await fetch(`${base}/api/save`)).json();
    assert.deepEqual(loaded.save, expected);
    assert.equal(loaded.save.servers[0].condition, 73);
    assert.equal(loaded.save.policies.autobackup, false);
    assert.equal(loaded.save.resilience.parts, 9);
    assert.equal(loaded.save.resilience.integrity, 86);
    assert.equal(
      loaded.save.resilience.backup.protectedResearch,
      expected.resilience.backup.protectedResearch,
    );
  });
});

test('rejects non-JSON and bodies above the configured size limit without writing a save', async (t) => {
  await withServer(t, async ({ base, dataDir }) => {
    const wrongType = await fetch(`${base}/api/save`, {
      method: 'POST',
      headers: { origin: base, 'content-type': 'text/plain' },
      body: 'hello',
    });
    assert.equal(wrongType.status, 415);
    const tooLarge = await fetch(`${base}/api/save`, {
      method: 'POST',
      headers: { origin: base, 'content-type': 'application/json' },
      body: ' '.repeat(maxBody + 1),
    });
    assert.equal(tooLarge.status, 413);
    await assert.rejects(fs.access(path.join(dataDir, 'save.json')));
  });
});

test('rejects a corrupt or unsupported save through the engine normalizer', async (t) => {
  const enginePath = path.join(__dirname, '..', 'engine.js');
  let engine;
  try {
    engine = require(enginePath);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') return t.skip('engine.js is not present yet');
    throw error;
  }
  await withServer(t, async ({ base, dataDir }) => {
    const bad = await fetch(`${base}/api/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({ ...engine.createState(2), version: 999 }),
    });
    assert.equal(bad.status, 400);
    await assert.rejects(fs.access(path.join(dataDir, 'save.json')));
  });
});

test('corrupt primary recovers from a valid backup and never clobbers it during recovery save', async (t) => {
  const enginePath = path.join(__dirname, '..', 'engine.js');
  let engine;
  try {
    engine = require(enginePath);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') return t.skip('engine.js is not present yet');
    throw error;
  }
  await withServer(t, async ({ base, dataDir }) => {
    const backup = engine.createState(502);
    const backupBytes = `${JSON.stringify(backup)}\n`;
    await fs.writeFile(path.join(dataDir, 'save.json'), '{broken', 'utf8');
    await fs.writeFile(path.join(dataDir, 'save.backup.json'), backupBytes, 'utf8');

    const recovered = await fetch(`${base}/api/save`);
    assert.equal(recovered.status, 200);
    const recoveredBody = await recovered.json();
    assert.equal(recoveredBody.save.version, backup.version);

    const replacement = engine.createState(503);
    replacement.networkName = 'Recovery check';
    const saved = await fetch(`${base}/api/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify(replacement),
    });
    assert.equal(saved.status, 200);
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(dataDir, 'save.backup.json'), 'utf8')),
      backup,
    );

    await fs.writeFile(path.join(dataDir, 'save.json'), '{broken again', 'utf8');
    await fs.rm(path.join(dataDir, 'save.backup.json'));
    const unavailable = await fetch(`${base}/api/save`);
    assert.equal(unavailable.status, 500);
    assert.equal(await fs.readFile(path.join(dataDir, 'save.json'), 'utf8'), '{broken again');
  });
});
