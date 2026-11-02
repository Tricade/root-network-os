/* global importScripts */
'use strict';
// Classic dedicated worker. The engine owns its module order; no second list.
importScripts('engine.js');
globalThis.onmessage = ({ data }) => {
  try {
    const task = globalThis.RootEngine.createCatchup(data.state, data.seconds);
    do {
      task.step();
      globalThis.postMessage({ type: 'progress', value: task.progress });
    } while (task.progress < 1);
    globalThis.postMessage({ type: 'complete', state: task.state, report: task.report() });
  } catch (error) {
    globalThis.postMessage({ type: 'error', message: error.message });
  }
};
