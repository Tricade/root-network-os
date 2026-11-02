'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run the actual launcher with a disposable fake process. A passing report must
// never override a timeout, failed process, or stale output from an earlier run.
function launch(staleReport) {
  let report = staleReport;
  let deadline;
  let killArguments;
  const child = Object.assign(new EventEmitter(), { pid: 2718, kill() {} });
  const process = {
    argv: ['node', 'launch.cjs', '--smoke', '--executable=portable.exe', '--output=diagnostics'],
    platform: 'win32',
    env: { ROOT_EXPECT_INSTALLATION: 'portable' },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../tools/desktop/launch.cjs'), 'utf8'), {
    __dirname: path.join(__dirname, '../tools/desktop'),
    process,
    console: { log() {}, error() {} },
    setTimeout(callback) {
      deadline = callback;
      return 1;
    },
    clearTimeout() {},
    require(name) {
      if (name === 'node:path') return path;
      if (name === 'node:fs')
        return {
          mkdirSync() {},
          rmSync() {
            report = undefined;
          },
          readFileSync() {
            if (report === undefined) throw new Error('No current report');
            return JSON.stringify(report);
          },
        };
      if (name === 'node:child_process')
        return {
          spawn: () => child,
          spawnSync(command, args) {
            killArguments = { command, args: Array.from(args) };
            return { status: 0 };
          },
        };
      throw new Error('Unexpected module: ' + name);
    },
  });
  return {
    process,
    child,
    write: (value) => (report = value),
    expire: () => deadline(),
    killed: () => killArguments,
  };
}

test('desktop launcher requires a fresh successful report and clean process exit', () => {
  const run = launch({ ok: true });
  run.child.emit('exit', 0, null);
  assert.equal(run.process.exitCode, 1, 'Stale report must not pass a test that never started');
  const passed = launch();
  passed.write({ ok: true });
  passed.child.emit('exit', 0, null);
  assert.equal(passed.process.exitCode, 0);
});

test('desktop launcher retains failed assertions and process exit failures', () => {
  for (const [report, exit] of [
    [{ ok: false }, 0],
    [{ ok: true }, 1],
  ]) {
    const run = launch();
    run.write(report);
    run.child.emit('exit', exit, null);
    assert.equal(run.process.exitCode, 1);
  }
});

test('desktop timeout fails even with a passing report and cleans only its own process tree', () => {
  const run = launch();
  run.write({ ok: true });
  run.expire();
  assert.deepEqual(run.killed(), { command: 'taskkill', args: ['/pid', '2718', '/t', '/f'] });
  run.child.emit('exit', 0, null);
  assert.equal(run.process.exitCode, 1);
});
