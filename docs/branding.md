# ROOT · Network OS

The product name is **ROOT · Network OS**. Its visual wordmark is **root.** with **NETWORK OS** below it. `brand.js` is the shared runtime definition used by the desktop wrapper, intro and UI. Package metadata, documentation and repository descriptions use the same name.

The project lives at [Tricade/root-network-os](https://github.com/Tricade/root-network-os). Keep the old GitHub repository alias available: recreating the old slug disables GitHub's redirects and can break existing installed updater feeds.

The cyberbunker is the setting, rather than another product name. Physical signs such as “Underground operations”, room names and hardware model names describe the facility.

Some technical identifiers deliberately retain their original values for installed compatibility: `io.github.tricade.root`, `io.github.tricade.root.desktop`, the `root-cyberbunker` executable and the `ROOT Cyberbunker` installed profile directory. Native Linux builds also retain `/opt/ROOT Cyberbunker` so a previous DEB can relaunch the same executable after updating. Electron-builder 26.18.0 derives that directory from the effective build `productName`, so Linux keeps that internal value and explicitly sets the desktop launcher name to **ROOT · Network OS**. Build each distribution on its native platform, as CI does. Do not rename these paths casually. Portable editions always use adjacent `ROOT-data`. Neither a visible rename nor an update may silently start with a different save.

GitHub redirects the original repository name after a rename. The installed profile location follows Electron's app path and name rules. [GitHub's rename guidance](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository) · [Electron 45.2.3 app API](https://github.com/electron/electron/blob/v45.2.3/docs/api/app.md) · [Desktop versions and verification](desktop.md)

The retained Linux directory follows [electron-builder 26.18.0's package mapping](https://github.com/electron-userland/electron-builder/blob/electron-builder%4026.18.0/packages/app-builder-lib/src/targets/FpmTarget.ts) and [desktop-entry override](https://github.com/electron-userland/electron-builder/blob/electron-builder%4026.18.0/packages/app-builder-lib/src/targets/LinuxTargetHelper.ts). This avoids changing the executable targeted by [electron-updater 6.8.11's DEB relaunch](https://github.com/electron-userland/electron-builder/blob/electron-updater%406.8.11/packages/electron-updater/src/DebUpdater.ts).
