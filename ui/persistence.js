/** persistence UI: reads current state through the controller context. */
export function createPersistenceUI(ctx, platform = globalThis) {
  function storageGet(key) {
    try {
      return platform.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      platform.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function simulate(now = Date.now()) {
    if (ctx.saveConflict) return null;
    if (ctx.catchUpFailed?.()) return null;
    if (ctx.catchUpBusy?.()) return ctx.waitForCatchup();
    const elapsed = Math.max(0, (now - ctx.lastTick) / 1000);
    if (elapsed > 30 && ctx.catchUp) return ctx.catchUp(now, elapsed);
    ctx.lastTick = now;
    if (elapsed <= 0) return null;
    const report = ctx.E.advance(ctx.state, elapsed);
    ctx.state.savedAt = now;
    for (const message of report?.constructionCompleted || [])
      ctx.toast(message, false, 'facility');
    for (const message of report?.researchCompleted || []) ctx.toast(message, false, 'research');
    return { ...report, capped: elapsed > 43200 };
  }

  let tickBusy = false;
  async function tick() {
    if (!ctx.initialized || platform.document.hidden || ctx.desktopClosing?.()) return;
    if (tickBusy || ctx.catchUpFailed?.()) return;
    tickBusy = true;
    let report;
    try {
      report = await simulate();
    } finally {
      tickBusy = false;
    }
    if (ctx.stateSignature() !== ctx.signature || ctx.renderPending) ctx.render();
    else ctx.updateLive();
    ctx.announceAchievements();
    if (Date.now() - ctx.lastSave > 15000) save();
    if (report?.seconds > 90 && !ctx.modal) ctx.openModal('offline', report);
  }

  async function save(exit = false) {
    if (ctx.catchUpBusy?.()) await ctx.waitForCatchup();
    if (!ctx.state || !ctx.initialized) return { status: 'idle', persisted: false };
    if (ctx.saveConflict) return { status: 'conflict', persisted: false };
    ctx.state.savedAt = ctx.lastTick;
    ctx.lastSave = Date.now();
    const snapshot = JSON.stringify(ctx.state),
      localOkay = storageSet(ctx.STORAGE, snapshot);
    if (platform.location.protocol === 'file:') {
      ctx.saveMode = localOkay ? 'fallback' : 'error';
      ctx.updateLive();
      return { status: ctx.saveMode, persisted: false };
    }
    if (ctx.remoteRevision === null) {
      storageSet('root.server.unverified', '1');
      ctx.saveMode = localOkay ? 'fallback' : 'error';
      ctx.diskAvailable = false;
      const warning = localOkay
        ? 'Der lokale Dienst wurde noch nicht bestätigt. Dein Stand liegt nur im Browser; ROOT sendet ihn erst nach einem erfolgreichen Laden des Serverstands.'
        : 'Der Netzwerkstand konnte nicht bestätigt oder lokal gespeichert werden. Exportiere ihn aus den Einstellungen.';
      if (ctx.saveError !== warning) {
        ctx.saveError = warning;
        ctx.render();
      }
      ctx.updateLive();
      return { status: 'unverified', persisted: false };
    }
    ctx.savePending = { body: snapshot, localOkay, exit };
    if (ctx.saveBusy) return ctx.saveDrainPromise;
    ctx.saveBusy = true;
    ctx.saveDrainPromise = (async () => {
      let result = { status: 'idle', persisted: false };
      while (ctx.savePending) {
        const pending = ctx.savePending;
        ctx.savePending = null;
        ctx.saveMode = 'saving';
        ctx.updateLive();
        try {
          const headers = {
            'Content-Type': 'application/json',
            'X-Root-Revision': ctx.remoteRevision,
          };
          const response = await platform.fetch('/api/save', {
            method: 'POST',
            headers,
            body: pending.body,
            keepalive: pending.exit && new platform.Blob([pending.body]).size < 60000,
            signal: platform.AbortSignal.timeout(8000),
          });
          if (response.status === 409) {
            const rejected = await response.json();
            if (rejected.conflict || rejected.updateRequired) {
              ctx.state.savedAt = ctx.lastTick;
              const latest = JSON.stringify(ctx.state);
              ctx.saveConflict = true;
              ctx.saveMode = 'error';
              ctx.savePending = null;
              storageSet(ctx.STORAGE, latest);
              storageSet('root.conflict.save', latest);
              storageSet('root.save.conflict', '1');
              ctx.saveError = rejected.conflict
                ? 'Eine andere Browser-Sitzung hat einen neueren Stand gespeichert. Diese Sitzung pausiert. Lade die Seite neu; deine abweichende Kopie bleibt in den Einstellungen exportierbar.'
                : 'Diese Oberfläche ist veraltet. Lade die Seite neu, bevor du fortfährst.';
              if (ctx.Room.isInRoom()) ctx.navigate('overview');
              else ctx.render();
              result = { status: 'conflict', persisted: false };
              break;
            }
          }
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const saved = await response.json();
          if (!saved.ok) throw new Error('Speichern abgelehnt');
          ctx.remoteRevision =
            saved.revision || response.headers.get('X-Root-Revision') || ctx.remoteRevision;
          if (ctx.remoteRevision) storageSet('root.server.revision', ctx.remoteRevision);
          storageSet('root.server.unverified', '0');
          storageSet('root.save.conflict', '0');
          ctx.saveMode = 'ready';
          ctx.diskAvailable = true;
          if (ctx.saveError) {
            ctx.saveError = '';
            ctx.render();
          }
          result = { status: 'ready', persisted: true };
        } catch (error) {
          ctx.saveMode = pending.localOkay ? 'fallback' : 'error';
          ctx.diskAvailable = false;
          const warning = pending.localOkay
            ? 'Der lokale Dienst ist nicht erreichbar. Dein aktueller Stand ist im Browser gesichert. Starte ROOT über den Desktop-Starter, um wieder in die lokale Sicherungsdatei zu speichern.'
            : 'Der Netzwerkstand konnte nicht gespeichert werden. Exportiere ihn in den Einstellungen und starte ROOT über den Desktop-Starter.';
          if (ctx.saveError !== warning) {
            ctx.saveError = warning;
            ctx.render();
          }
          // Keep a newer snapshot queued while this request was in flight. The
          // loop gives that snapshot its own attempt with the still-current
          // revision; with no newer save, this failure ends the drain.
          result = { status: ctx.saveMode, persisted: false };
        }
      }
      ctx.saveBusy = false;
      ctx.updateLive();
      return result;
    })();
    return ctx.saveDrainPromise;
  }

  async function exportSave() {
    await simulate();
    const blob = new platform.Blob([JSON.stringify(ctx.state, null, 2)], {
        type: 'application/json',
      }),
      url = platform.URL.createObjectURL(blob),
      a = platform.document.createElement('a');
    a.href = url;
    a.download = `ROOT-Sektor-${ctx.state.sector}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    platform.setTimeout(() => platform.URL.revokeObjectURL(url), 1500);
  }

  async function replaceState(next) {
    if (ctx.saveConflict) {
      ctx.toast('Diese Sitzung pausiert. Lade zuerst den aktuellen Serverstand neu.', true);
      return false;
    }
    await exportSave();
    if (ctx.saveConflict) return false;
    ctx.state = next;
    ctx.resetNotifications?.();
    ctx.seenAchievements = new Set();
    ctx.state.savedAt = Date.now();
    ctx.lastTick = ctx.state.savedAt;
    ctx.hideGuide = false;
    storageSet('root.guide.hidden', '0');
    ctx.signature = '';
    ctx.closeModal();
    ctx.view = 'overview';
    ctx.render();
    const outcome = await save();
    if (outcome?.persisted) {
      ctx.toast('Dein Netzwerk ist bereit.');
      ctx.announceAchievements();
      return true;
    }
    if (outcome?.status === 'conflict') return false;
    ctx.toast(
      'Der Stand ist nur im Browser gesichert. Der Server hat die Änderung noch nicht bestätigt.',
      true,
    );
    return false;
  }

  async function boot() {
    if (!ctx.E)
      throw new Error(
        'Der Simulationskern fehlt. Bitte starte ROOT aus dem vollständigen ROOT-Ordner.',
      );
    let localState = null,
      remoteState = null,
      remoteInvalid = false,
      localVersion = null,
      remoteRead = false;
    const stored = storageGet(ctx.STORAGE);
    const priorRevision = storageGet('root.server.revision');
    if (stored) {
      try {
        const raw = JSON.parse(stored);
        localVersion = raw.version;
        localState = ctx.E.normalizeState(raw);
      } catch {
        ctx.saveError =
          'Die Browserkopie war beschädigt. ROOT versucht, deinen lokalen Netzwerkstand zu laden.';
      }
    }
    if (platform.location.protocol !== 'file:') {
      try {
        const response = await platform.fetch('/api/save', {
          cache: 'no-store',
          signal: platform.AbortSignal.timeout(6000),
        });
        if (!response.ok) {
          remoteInvalid = response.status === 500;
          throw new Error('Netzwerkstanddienst nicht verfügbar');
        }
        ctx.remoteRevision = response.headers.get('X-Root-Revision');
        const result = await response.json();
        if (result.save) remoteState = ctx.E.normalizeState(result.save);
        remoteRead = ctx.remoteRevision !== null;
        ctx.diskAvailable = remoteRead;
        if (remoteRead) storageSet('root.server.revision', ctx.remoteRevision);
        else storageSet('root.server.unverified', '1');
      } catch {
        ctx.diskAvailable = false;
        ctx.remoteRevision = null;
        storageSet('root.server.unverified', '1');
      }
    } else ctx.diskAvailable = false;
    if (remoteInvalid && !localState) {
      ctx.$('#app').innerHTML =
        `<div class="boot"><div class="boot-logo">root<span class="brand-dot">.</span></div><p>Die lokale Sicherungsdatei und ihre Sicherung konnten nicht gelesen werden.</p><p>Deine Dateien bleiben erhalten. Prüfe data/save.json und data/save.backup.json im ROOT-Ordner.</p><p>Nach dem Wiederherstellen einer Sicherung kannst du diese Seite neu laden.</p><button class="button">Neu laden</button></div>`;
      ctx.$('button').addEventListener('click', () => platform.location.reload());
      return;
    }
    const unverifiedLocal =
      platform.location.protocol !== 'file:' && storageGet('root.server.unverified') === '1';
    const conflicting = Boolean(
      stored &&
      (unverifiedLocal ||
        storageGet('root.save.conflict') === '1' ||
        (remoteRead && (!priorRevision || priorRevision !== ctx.remoteRevision))),
    );
    if (conflicting) storageSet('root.conflict.save', stored);
    const emptyServerAfterConflict =
      remoteRead && ctx.remoteRevision === 'empty' && conflicting && Boolean(stored);
    ctx.state =
      remoteState && (Number(localVersion) < 4 || conflicting)
        ? remoteState
        : emptyServerAfterConflict
          ? ctx.E.createState(Math.floor(Math.random() * 0xffffffff))
          : localState && (!remoteState || localState.savedAt > remoteState.savedAt)
            ? localState
            : remoteState || ctx.E.createState(Math.floor(Math.random() * 0xffffffff));
    if (!ctx.diskAvailable)
      ctx.saveError =
        'ROOT verwendet die Browserkopie. Öffne ROOT über „ROOT starten“, damit dein Fortschritt zusätzlich in der lokalen Sicherungsdatei gespeichert wird.';
    else ctx.saveError = '';
    ctx.lastTick = Math.min(Date.now(), ctx.state.savedAt);
    const report = await simulate();
    ctx.initialized = true;
    ctx.hideGuide = storageGet('root.guide.hidden') === '1';
    ctx.shell();
    if (emptyServerAfterConflict)
      ctx.toast(
        'Der Server ist leer. Die abweichende Browserkopie wurde separat gesichert und kann aus den Einstellungen exportiert oder importiert werden.',
        true,
      );
    else if (conflicting && remoteState)
      ctx.toast(
        'Der aktuelle Serverstand wurde geladen. Deine abweichende Browserkopie kann aus den Einstellungen exportiert werden.',
        true,
      );
    save();
    if (report && report.seconds >= 60) ctx.openModal('offline', report);
    ctx.announceAchievements();
    platform.setInterval(tick, 1000);
    ctx.desktopReady?.().catch(() => {});
  }
  return { storageGet, storageSet, simulate, tick, save, exportSave, replaceState, boot };
}
