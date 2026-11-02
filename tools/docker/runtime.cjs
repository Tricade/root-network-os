'use strict';
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const net = require('node:net');

const exec = promisify(execFile);
async function docker(...args) {
  const { stdout } = await exec('docker', args, { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
  return stdout.trim();
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function healthy(container) {
  // Bounded startup observation, not repeated restarts on a broken configuration.
  for (let attempt = 0; attempt < 30; attempt++) {
    const [state] = JSON.parse(await docker('inspect', container));
    if (state.State.Health?.Status === 'healthy') return state;
    if (!state.State.Running || state.State.Health?.Status === 'unhealthy') break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Container did not become healthy:\n${await docker('logs', container)}`);
}

module.exports = { docker, freePort, healthy };
