'use strict';

const path = require('node:path');
const BRAND = require('../brand.js');
const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  session,
  shell,
} = require('electron');
const { startLocalService } = require('./service.cjs');
const {
  detectInstallation,
  profilePath,
  installedProfilePath,
  prepareProfile,
  createPreferences,
} = require('./profile.cjs');
const { createCloseSession } = require('./close-session.cjs');
const { createUpdateController } = require('./updater.cjs');
const { createWindow } = require('./window.cjs');
const { installBridge } = require('./ipc.cjs');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'root',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

async function startDesktop(options = {}) {
  app.setName(BRAND.title);
  app.setAppUserModelId('io.github.tricade.root');
  const installation = detectInstallation({
    packaged: app.isPackaged,
    platform: process.platform,
    env: process.env,
    resourcesPath: process.resourcesPath,
  });
  const profile =
    options.profile || profilePath(installation, installedProfilePath(app.getPath('appData')));
  prepareProfile(app, profile);
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return null;
  }
  await app.whenReady();
  Menu.setApplicationMenu(null);
  const dataDir = path.join(profile, 'network');
  const service = await startLocalService(dataDir);
  protocol.handle('root', (request) =>
    service.forward(request, (url, init) => net.fetch(url, init)),
  );
  const preferences = createPreferences(profile);
  const { window, load } = createWindow({ BrowserWindow, session, shell, hidden: options.hidden });
  let ready = false;
  let allowClose = false;
  let closing = null;
  let installing = false;
  let reloading = null;
  let announced = false;
  const send = (channel, data) => {
    if (!window.isDestroyed()) window.webContents.send(channel, data);
  };
  const updates = createUpdateController({
    installation,
    version: app.getVersion(),
    preferences,
    createUpdater(kind) {
      const { NsisUpdater, DebUpdater } = require('electron-updater');
      const Constructor = kind === 'nsis' ? NsisUpdater : DebUpdater;
      const updater = new Constructor({
        provider: 'github',
        owner: 'Tricade',
        repo: BRAND.repository,
        channel: 'latest',
      });
      updater.logger = { info() {}, warn() {}, error() {} };
      return updater;
    },
    publish: (state) => {
      if (installing && state.status === 'error') {
        installing = false;
        allowClose = false;
        send('desktop:resume');
      }
      send('desktop:status', state);
    },
  });
  const closeSession = createCloseSession({ send });
  const language = (de, en) => (preferences.read().language === 'en' ? en : de);
  async function close(install = false) {
    if (reloading) await reloading;
    if (closing) return closing;
    if (install && !updates.canInstall()) return false;
    closing = (async () => {
      const saved = !ready || (await closeSession.request());
      if (!saved) {
        if (install) {
          await dialog.showMessageBox(window, {
            type: 'warning',
            message: language(
              'Update pausiert: Der Fortschritt wurde noch nicht sicher gespeichert.',
              'Update paused: progress has not been safely saved yet.',
            ),
            buttons: [language('Zurück', 'Return')],
          });
          return false;
        }
        const choice = await dialog.showMessageBox(window, {
          type: 'warning',
          message: language(
            'Speichern konnte nicht bestätigt werden.',
            'Saving could not be confirmed.',
          ),
          detail: language(
            'Du kannst zurückkehren und eine Sicherung exportieren.',
            'You can return and export a backup.',
          ),
          buttons: [language('Zurück', 'Return'), language('Trotzdem beenden', 'Quit anyway')],
          defaultId: 0,
          cancelId: 0,
        });
        if (choice.response !== 1) return false;
      }
      await preferences.drain();
      if (install) {
        // Keep the service available if the OS refuses the installer. The
        // renderer has already drained its save queue and paused mutations.
        installing = true;
        allowClose = true;
        try {
          if (!updates.install()) {
            installing = false;
            allowClose = false;
            return false;
          }
        } catch {
          installing = false;
          allowClose = false;
          return false;
        }
      } else {
        await service.stop();
        await options.beforeQuit?.({ saved });
        allowClose = true;
        updates.dispose();
        app.quit();
      }
      return true;
    })().finally(() => {
      closing = null;
      if (!allowClose) send('desktop:resume');
    });
    return closing;
  }
  async function reload() {
    if (closing || installing) return false;
    if (reloading) return reloading;
    reloading = (async () => {
      if (!ready || !(await closeSession.request())) {
        send('desktop:resume');
        return false;
      }
      ready = false;
      await load();
      return true;
    })().finally(() => {
      reloading = null;
    });
    return reloading;
  }
  const removeBridge = installBridge({
    ipcMain,
    window,
    updates,
    preferences,
    closeSession,
    close,
    shell,
    dataDir,
    onReady() {
      if (ready) return;
      ready = true;
      if (!announced) {
        announced = true;
        options.onReady?.({
          window,
          service,
          updates,
          profile,
          dataDir,
          close,
          reload,
          installation,
        });
      }
      if (!options.smoke) updates.check(true).catch(() => {});
    },
  });
  window.on('close', (event) => {
    if (!allowClose) {
      event.preventDefault();
      close().catch(() => {
        send('desktop:resume');
      });
    }
  });
  app.on('before-quit', (event) => {
    if (!allowClose) {
      event.preventDefault();
      close().catch(() => {
        send('desktop:resume');
      });
    }
  });
  app.on('second-instance', () => {
    if (window.isMinimized()) window.restore();
    window.focus();
  });
  window.on('focus', () => {
    if (ready && !options.smoke) updates.check(true).catch(() => {});
  });
  window.webContents.on('before-input-event', (event, input) => {
    if (
      input.type === 'keyDown' &&
      (input.key === 'F5' || ((input.control || input.meta) && input.key.toLowerCase() === 'r'))
    ) {
      event.preventDefault();
      reload().catch(() => send('desktop:resume'));
    }
  });
  app.on('web-contents-created', (_event, contents) =>
    contents.on('will-attach-webview', (event) => event.preventDefault()),
  );
  app.on('quit', () => {
    updates.dispose();
    closeSession.cancel();
    removeBridge();
  });
  app.on('will-quit', () => {
    service.stop().catch(() => {});
  });
  await load();
  return { window, service, updates, profile, dataDir, close, installation };
}

// Electron's development launcher imports this entry point. require.main is
// not this module there (45.2.3 default_app/main.ts). Packaged CJS uses _load.
const testOutput = process.argv.find((value) => value.startsWith('--test-output='));
const start =
  process.argv.includes('--self-test') && testOutput
    ? require('./self-test.cjs').runSelfTest({
        app,
        startDesktop,
        output: path.resolve(testOutput.slice('--test-output='.length)),
      })
    : startDesktop();
start.catch((error) => {
  dialog.showErrorBox(BRAND.title, error.message);
  app.exit(1);
});
