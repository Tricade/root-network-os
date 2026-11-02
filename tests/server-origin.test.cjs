'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server.cjs');
const { createState } = require('../engine.js');

async function start(t, publicOrigin) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'root-origin-'));
  const server = createServer({ port: 0, dataDir, publicOrigin });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  return server.address().port;
}

function post(port, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/save',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
      },
    );
    req.on('error', reject);
    req.end(JSON.stringify(createState(42)));
  });
}

test('mapped ports and HTTPS proxies accept only explicitly configured browser origins', async (t) => {
  for (const origin of ['http://192.0.2.5:8080', 'https://root.example.test']) {
    const port = await start(t, origin);
    const headers = { Host: new URL(origin).host, Origin: origin, 'Sec-Fetch-Site': 'same-origin' };
    assert.equal(await post(port, headers), 200);
    assert.equal(await post(port, { ...headers, Origin: 'https://attacker.example' }), 403);
    assert.equal(await post(port, { ...headers, Host: 'attacker.example' }), 403);
    assert.equal(await post(port, { ...headers, 'Sec-Fetch-Site': 'cross-site' }), 403);
    assert.equal(await post(port, { ...headers, Origin: origin + '/path' }), 403);
    assert.equal(await post(port, { ...headers, Origin: 'null' }), 403);
    assert.equal(
      await post(port, {
        ...headers,
        Origin: 'https://attacker.example',
        'X-Forwarded-Host': new URL(origin).host,
        'X-Forwarded-Proto': 'https',
      }),
      403,
    );
    assert.equal(await post(port, { Host: new URL(origin).host }), 200, 'CLI clients still work');
  }
});

test('embedded and unconfigured servers retain loopback-only write origins', async (t) => {
  const port = await start(t);
  assert.equal(await post(port, { Origin: `http://127.0.0.1:${port}` }), 200);
  assert.equal(await post(port, { Origin: `http://localhost:${port}` }), 200);
  assert.equal(await post(port, { Origin: 'http://192.0.2.5:8080', Host: '192.0.2.5:8080' }), 403);
  assert.equal(await post(port, { Origin: `https://localhost:${port}` }), 403);
});

test('misconfigured origins fail before listening instead of disabling origin protection', () => {
  for (const publicOrigin of [
    '*',
    'null',
    'file:///data',
    'https://*.example.test',
    'https://user:password@example.test',
    'https://example.test/app',
    'https://example.test/?a=b',
    'https://example.test/#x',
  ])
    assert.throws(() => createServer({ publicOrigin }), /ROOT_PUBLIC_ORIGIN/);
});
