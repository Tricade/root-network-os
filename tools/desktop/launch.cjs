'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const flags = process.argv.slice(2);
const smoke = flags.includes('--smoke');
const executableFlag = flags.find((value) => value.startsWith('--executable='));
const executable = executableFlag
  ? path.resolve(executableFlag.slice('--executable='.length))
  : require('electron');
const outputFlag = flags.find((value) => value.startsWith('--output='));
const output = outputFlag
  ? path.resolve(outputFlag.slice('--output='.length))
  : path.join(root, '.desktop-build', 'smoke-' + Date.now());
const args = executableFlag ? [] : [root];
if (
  smoke &&
  process.platform === 'linux' &&
  process.env.CI === 'true' &&
  process.env.ROOT_DESKTOP_SOFTWARE_RENDERING === '1'
) {
  // Chromium 156's documented opt-in for trusted software-WebGL tests.
  // This launcher-only CI path never changes normal application defaults.
  args.push('--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader');
}
if (smoke) {
  fs.mkdirSync(output, { recursive: true });
  // A reused diagnostics directory must never supply a previous passing result.
  fs.rmSync(path.join(output, 'result.json'), { force: true });
  args.push('--self-test', '--test-output=' + output);
}
// Codex and other Electron hosts may export this for their own helpers.
// Child applications must run as Electron, without changing the parent's env.
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
if (smoke) {
  const cache = path.join(output, 'os-cache');
  fs.mkdirSync(cache, { recursive: true });
  env.LOCALAPPDATA = cache;
  env.XDG_CACHE_HOME = cache;
}
const child = spawn(executable, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
let timeout;
let timedOut = false;
// NSIS portable extracts before launching Electron and cleans up after it exits.
// Keep the app's own 60s test deadline; allow that separate bootstrap/cleanup here.
const deadlineMs =
  process.platform === 'win32' && process.env.ROOT_EXPECT_INSTALLATION === 'portable'
    ? 180000
    : 90000;
if (smoke)
  timeout = setTimeout(() => {
    timedOut = true;
    console.error(
      `Desktop launcher exceeded ${deadlineMs / 1000}s including bootstrap and cleanup.`,
    );
    if (process.platform === 'win32' && child.pid) {
      // Killing only the portable wrapper leaves its Electron child running.
      const killed = spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        windowsHide: true,
        stdio: 'ignore',
        timeout: 10000,
      });
      if (killed.status !== 0) child.kill();
    } else child.kill();
    process.exitCode = 1;
  }, deadlineMs);
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
  clearTimeout(timeout);
});
child.on('exit', (code, signal) => {
  clearTimeout(timeout);
  process.exitCode = code === 0 && !signal && !timedOut ? 0 : 1;
  if (smoke) {
    try {
      const report = JSON.parse(fs.readFileSync(path.join(output, 'result.json'), 'utf8'));
      console.log(JSON.stringify(report, null, 2));
      if (!report.ok) process.exitCode = 1;
    } catch {
      console.error('Desktop smoke test produced no completion report.');
      process.exitCode = 1;
    }
  }
});
