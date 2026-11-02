'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { docker, freePort, healthy } = require('./runtime.cjs');
const { createState } = require('../../engine.js');
const { createStaticFiles } = require('../../server/static-files.cjs');

async function smoke() {
  const image = process.argv[2] || 'root-network-os:docker-test';
  const name = `root-smoke-${randomUUID()}`;
  const volume = `${name}-data`;
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const headers = {
    'Content-Type': 'application/json',
    Origin: base,
    'Sec-Fetch-Site': 'same-origin',
  };
  const save = createState(24680);
  save.credits = 12345;
  let created = false;
  await docker('volume', 'create', volume);
  const launch = async () => {
    await docker(
      'run',
      '-d',
      '--name',
      name,
      '--init',
      '--read-only',
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges:true',
      '--health-interval=1s',
      '-e',
      `ROOT_PUBLIC_ORIGIN=${base}`,
      '-p',
      `127.0.0.1:${port}:18473`,
      '--mount',
      `type=volume,source=${volume},target=/data`,
      image,
    );
    created = true;
    return healthy(name);
  };
  const write = (state, revision, extra = {}) =>
    fetch(`${base}/api/save`, {
      method: 'POST',
      headers: { ...headers, 'X-Root-Revision': revision, ...extra },
      body: JSON.stringify(state),
      signal: AbortSignal.timeout(10_000),
    });
  try {
    const container = await launch();
    assert.equal(container.Config.User, 'node');
    assert.equal(container.HostConfig.ReadonlyRootfs, true);
    assert.equal(await docker('exec', name, 'id', '-u'), '1000');
    await docker(
      'exec',
      name,
      'node',
      '-e',
      'const f=require("node:fs"); for(const p of [".git","node_modules","tests",".env",".local-data","desktop"]) if(f.existsSync("/app/"+p)) process.exit(1)',
    );
    const health = await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.release, require('../../package.json').version);
    const entries = [...createStaticFiles(path.resolve(__dirname, '../..')).keys()];
    for (let offset = 0; offset < entries.length; offset += 8) {
      await Promise.all(
        entries.slice(offset, offset + 8).map(async (file) => {
          const response = await fetch(base + file, { signal: AbortSignal.timeout(15_000) });
          assert.equal(response.status, 200, file);
          assert.ok((await response.arrayBuffer()).byteLength > 0, file);
        }),
      );
    }
    for (const file of ['/data/save.json', '/server.cjs', '/package.json', '/.env']) {
      assert.equal((await fetch(base + file)).status, 404, file);
    }
    const empty = await fetch(`${base}/api/save`);
    assert.equal((await empty.json()).save, null);
    const first = await write(save, empty.headers.get('x-root-revision'));
    assert.equal(first.status, 200);
    const revision = first.headers.get('x-root-revision');
    assert.equal((await write(save, 'empty')).status, 409, 'stale writer rejected');
    assert.equal((await write(save, revision, { Origin: 'https://attacker.example' })).status, 403);

    // Stop during a real, partially uploaded save. The response and fsync must complete
    // before process exit, and the previous revision must remain as the backup.
    save.credits = 23456;
    const body = JSON.stringify(save);
    const response = new Promise((resolve, reject) => {
      const req = http.request(
        `${base}/api/save`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'X-Root-Revision': revision,
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          res.resume();
          res.on('end', () => resolve(res.statusCode));
        },
      );
      req.on('error', reject);
      req.write(body.slice(0, 100));
      // Allow the HTTP handler to receive the first chunk before sending SIGTERM.
      setTimeout(async () => {
        try {
          await docker('kill', '--signal=SIGTERM', name);
          req.end(body.slice(100));
        } catch (error) {
          req.destroy(error);
        }
      }, 300);
    });
    assert.equal(await response, 200, 'in-flight save finishes during shutdown');
    assert.equal(await docker('wait', name), '0', 'graceful exit');
    await docker('rm', name);
    created = false;
    await launch();
    const restored = await (await fetch(`${base}/api/save`)).json();
    assert.equal(restored.save.credits, 23456, 'new container retains primary save');
    const backup = JSON.parse(await docker('exec', name, 'cat', '/data/save.backup.json'));
    assert.equal(backup.credits, 12345, 'previous valid save survives replacement');
    await docker('stop', '--time=25', name);
    const [stopped] = JSON.parse(await docker('inspect', name));
    assert.equal(stopped.State.ExitCode, 0);
    console.log(
      JSON.stringify({
        image,
        staticFiles: entries.length,
        health: true,
        nonRoot: true,
        readOnly: true,
        save: true,
        conflict: true,
        originProtection: true,
        gracefulSave: true,
        replacementPersistence: true,
        backup: true,
      }),
    );
  } catch (error) {
    if (created) console.error(await docker('logs', name));
    throw error;
  } finally {
    // Exact, random test resources only; never prune the user's containers or volumes.
    if (created) await docker('rm', '-f', name);
    await docker('volume', 'rm', volume);
  }
}

smoke().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
