const { grantSpace, serviceRoomsAt } = require('./helpers/facility.cjs');
('use strict');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createServer, maxBody } = require('../server.cjs');
const { createState } = require('../engine.js');

async function withServer(t, fn) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'root-expansion-save-'));
  const server = createServer({ port: 0, dataDir });
  t.after(async () => {
    if (server.listening) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  await fn({ base, dataDir });
}

function maximumPackedFleet() {
  const state = createState(20261030);
  const rackCount = 625;
  state.sector = 5000;
  state.counters.sectors = 5000;
  state.servers = Array.from({ length: 10000 }, (_, index) => ({
    id: `server-${index + 1}`,
    type: 'edge',
    name: `Knoten ${String(index + 1).padStart(5, '0')}`,
    level: 1,
    mode: 'balanced',
    condition: 100,
    status: 'online',
    fault: null,
    rackId: `rack-${Math.floor(index / 16) + 1}`,
    unit: 2 + (index % 16),
    port: 1 + (index % 16),
    powered: true,
    bootRemaining: 0,
  }));
  state.counters.serversBought = 9999;
  state.facility.racks = Array.from({ length: rackCount }, (_, index) => ({
    id: `rack-${index + 1}`,
    name: `Rack ${String(index + 1).padStart(3, '0')}`,
    switchLevel: 2,
    powerLevel: 1,
    coolingLevel: 1,
    disabledPorts: [],
  }));
  state.facility.operation = null;
  state.facility.central = { cooling: 0, ups: 0, distribution: 0 };
  state.facility.centralOperation = null;
  grantSpace(state);
  return state;
}

test(
  'maximum supported packed fleet stays under 16 MiB and survives HTTP POST/GET',
  { timeout: 30000 },
  async (t) => {
    await withServer(t, async ({ base }) => {
      const save = maximumPackedFleet();
      const body = JSON.stringify(save);
      const bytes = Buffer.byteLength(body, 'utf8');
      assert.equal(maxBody, 16 * 1024 * 1024);
      assert.ok(bytes < maxBody, `save is ${bytes} bytes, below ${maxBody}`);
      assert.equal(save.servers.length, 10000);
      assert.equal(save.facility.racks.length, 625);

      const signal = AbortSignal.timeout(25000);
      const post = await fetch(`${base}/api/save`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: base },
        body,
        signal,
      });
      const postBody = await post.json();
      assert.equal(post.status, 200, JSON.stringify(postBody));
      assert.deepEqual(postBody, { ok: true });

      const get = await fetch(`${base}/api/save`, { signal: AbortSignal.timeout(25000) });
      assert.equal(get.status, 200);
      const loaded = (await get.json()).save;
      assert.equal(loaded.version, 8);
      assert.equal(loaded.sector, 5000);
      assert.equal(loaded.servers.length, 10000);
      assert.equal(loaded.facility.racks.length, 625);
      assert.equal(loaded.facility.racks[0].id, 'rack-1');
      assert.equal(loaded.facility.racks.at(-1).id, 'rack-625');
      assert.equal(loaded.servers[0].id, 'server-1');
      assert.equal(loaded.servers.at(-1).id, 'server-10000');
      assert.equal(loaded.servers[9999].rackId, 'rack-625');
      assert.equal(loaded.servers[9999].unit, 17);
      assert.equal(loaded.servers[9999].port, 16);
    });
  },
);

test(
  'rejects v3 clients without central-facility capability without changing either save copy',
  { timeout: 30000 },
  async (t) => {
    await withServer(t, async ({ base, dataDir }) => {
      const current = createState(801);
      current.sector = 8;
      grantSpace(current, { specialRooms: serviceRoomsAt(8) });
      current.facility.central.ups = 1;
      const secondCurrent = structuredClone(current);
      secondCurrent.facility.central.cooling = 1;
      for (const save of [current, secondCurrent]) {
        const response = await fetch(`${base}/api/save`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: base },
          body: JSON.stringify(save),
          signal: AbortSignal.timeout(10000),
        });
        assert.equal(response.status, 200);
      }
      const staleWithNeither = createState(802);
      delete staleWithNeither.facility.central;
      delete staleWithNeither.facility.centralOperation;
      const staleWithoutCentral = createState(803);
      delete staleWithoutCentral.facility.central;
      const staleWithoutOperation = createState(804);
      delete staleWithoutOperation.facility.centralOperation;

      const staleWithoutBuilding = createState(806);
      delete staleWithoutBuilding.facility.building;

      const primaryPath = path.join(dataDir, 'save.json');
      const backupPath = path.join(dataDir, 'save.backup.json');
      const primaryBefore = await fs.readFile(primaryPath);
      const backupBefore = await fs.readFile(backupPath);
      for (const stale of [
        staleWithNeither,
        staleWithoutCentral,
        staleWithoutOperation,
        staleWithoutBuilding,
      ]) {
        const response = await fetch(`${base}/api/save`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: base },
          body: JSON.stringify(stale),
          signal: AbortSignal.timeout(10000),
        });
        assert.equal(response.status, 409);
        assert.deepEqual(await response.json(), {
          ok: false,
          updateRequired: true,
          error:
            'Diese Oberfläche stammt aus einer älteren Version. Lade sie neu, bevor du fortfährst.',
        });
        assert.deepEqual(
          await fs.readFile(primaryPath),
          primaryBefore,
          'primary bytes remain unchanged',
        );
        assert.deepEqual(
          await fs.readFile(backupPath),
          backupBefore,
          'backup bytes remain unchanged',
        );
      }
    });
  },
);

test(
  'legacy v3 GET still normalizes in memory and the normalized client save is accepted',
  { timeout: 30000 },
  async (t) => {
    await withServer(t, async ({ base, dataDir }) => {
      const legacyV3 = createState(805);
      delete legacyV3.facility.central;
      delete legacyV3.facility.centralOperation;
      const originalBytes = Buffer.from(`${JSON.stringify(legacyV3)}\n`);
      const primaryPath = path.join(dataDir, 'save.json');
      await fs.writeFile(primaryPath, originalBytes);

      const response = await fetch(`${base}/api/save`, { signal: AbortSignal.timeout(10000) });
      assert.equal(response.status, 200);
      const migrated = (await response.json()).save;
      assert.deepEqual(migrated.facility.central, { cooling: 0, ups: 0, distribution: 0 });
      assert.equal(migrated.facility.centralOperation, null);
      assert.deepEqual(
        await fs.readFile(primaryPath),
        originalBytes,
        'GET migration leaves the source bytes untouched',
      );

      const normalizedWrite = await fetch(`${base}/api/save`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: base },
        body: JSON.stringify(migrated),
        signal: AbortSignal.timeout(10000),
      });
      assert.equal(normalizedWrite.status, 200);
      const stored = JSON.parse(await fs.readFile(primaryPath, 'utf8'));
      assert.deepEqual(stored.facility.central, { cooling: 0, ups: 0, distribution: 0 });
      assert.equal(stored.facility.centralOperation, null);
    });
  },
);
