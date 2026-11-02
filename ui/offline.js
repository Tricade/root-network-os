/** Isolated catch-up: live actions cannot race a background state replacement. */
export function createOfflineUI(ctx, platform = globalThis) {
  let pending = null,
    failed = false;
  function progressPanel() {
    const el = platform.document.createElement('aside');
    el.className = 'catchup-panel';
    el.setAttribute('role', 'status');
    const label = platform.document.createElement('p'),
      bar = platform.document.createElement('progress');
    bar.max = 1;
    bar.value = 0;
    label.textContent = ctx.tr(
      'Abwesenheit wird nachberechnet. Dein bisheriger Stand bleibt gesichert.',
    );
    el.append(label, bar);
    platform.document.body.append(el);
    return {
      update: (value) => {
        bar.value = value;
        label.textContent = ctx.tr('Fortschritt') + ': ' + Math.floor(value * 100) + ' %';
      },
      remove: () => el.remove(),
      error: () => {
        label.textContent = ctx.tr(
          'Nachberechnung fehlgeschlagen. Dein bisheriger Stand bleibt erhalten. Bitte neu laden.',
        );
      },
    };
  }
  async function fallback(state, seconds, onProgress) {
    const task = ctx.E.createCatchup(state, seconds);
    do {
      const started = platform.performance.now();
      do {
        task.step(1);
      } while (task.progress < 1 && platform.performance.now() - started < 8);
      onProgress(task.progress);
      await new Promise((resolve) => platform.setTimeout(resolve, 0));
    } while (task.progress < 1);
    return { state: task.state, report: task.report() };
  }
  function workerRun(state, seconds, onProgress) {
    return new Promise((resolve, reject) => {
      let worker;
      try {
        worker = new platform.Worker(new URL('../advance-worker.js', import.meta.url));
      } catch (error) {
        reject(error);
        return;
      }
      let deadline;
      const stop = () => {
        platform.clearTimeout(deadline);
        worker.terminate();
      };
      const watchdog = () => {
        platform.clearTimeout(deadline);
        deadline = platform.setTimeout(() => {
          stop();
          reject(new Error('Worker timeout'));
        }, 30000);
      };
      watchdog();
      worker.onmessage = ({ data }) => {
        watchdog();
        if (data.type === 'progress') onProgress(data.value);
        else if (data.type === 'complete') {
          stop();
          resolve(data);
        } else if (data.type === 'error') {
          stop();
          reject(new Error(data.message));
        }
      };
      worker.onerror = (error) => {
        stop();
        reject(new Error(error.message || 'Worker unavailable'));
      };
      worker.postMessage({ state, seconds });
    });
  }
  function catchUp(now, seconds) {
    if (pending) return pending;
    if (failed) return Promise.resolve(null);
    const source = ctx.state,
      panel = progressPanel();
    pending = (async () => {
      let result;
      try {
        if (typeof platform.Worker === 'function') {
          try {
            result = await workerRun(source, seconds, panel.update);
          } catch {
            result = await fallback(source, seconds, panel.update);
          }
        } else result = await fallback(source, seconds, panel.update);
        if (ctx.saveConflict || ctx.state !== source) return null;
        ctx.state = result.state;
        ctx.lastTick = now;
        ctx.state.savedAt = now;
        for (const message of result.report.constructionCompleted)
          ctx.toast(message, false, 'facility');
        for (const message of result.report.researchCompleted || [])
          ctx.toast(message, false, 'research');
        return result.report;
      } catch {
        failed = true;
        panel.error();
        ctx.toast('Nachberechnung fehlgeschlagen. Bitte neu laden.', true);
        return null;
      } finally {
        if (!failed) panel.remove();
        pending = null;
      }
    })();
    return pending;
  }
  return {
    catchUp,
    catchUpBusy: () => Boolean(pending),
    catchUpFailed: () => failed,
    waitForCatchup: () => pending || Promise.resolve(null),
  };
}
