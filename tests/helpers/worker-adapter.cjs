'use strict';
// Node 24 worker_threads drives the actual classic browser-worker scripts in a
// VM realm. This checks deterministic messages, not Chromium/protocol support.
const { parentPort } = require('node:worker_threads'),
  vm = require('node:vm'),
  fs = require('node:fs'),
  path = require('node:path');
const root = path.resolve(__dirname, '../..');
const realm = vm.createContext({ postMessage: (value) => parentPort.postMessage(value) });
realm.importScripts = (...names) => {
  for (const name of names) {
    const target = path.resolve(root, name);
    if (!target.startsWith(root + path.sep)) throw new Error('Invalid test import');
    vm.runInContext(fs.readFileSync(target, 'utf8'), realm, { filename: name });
  }
};
realm.importScripts('advance-worker.js');
parentPort.on('message', (data) => realm.onmessage({ data }));
