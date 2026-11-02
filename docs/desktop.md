# ROOT · Network OS desktop

The desktop application runs the same simulation and both interfaces as the browser edition. Download packages from [GitHub Releases](https://github.com/Tricade/root-network-os/releases). No separately installed Node.js or account is required.

| Package                        | Installation                                 | Updates                                         | Progress                                 |
| ------------------------------ | -------------------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| Windows x64 `-setup.exe`       | Per-user NSIS wizard; changeable destination | Built-in check, explicit download and restart   | Electron user-data folder, `network/`    |
| Windows x64 `-portable.exe`    | Run from a writable folder                   | Manual replacement                              | `ROOT-data/network/` beside the EXE      |
| Linux x64 `.deb`               | System package manager                       | Built-in DEB updater; may need OS authorization | Electron user-data folder, `network/`    |
| Linux x64 `-portable.AppImage` | Make executable; run from a writable folder  | Manual replacement                              | `ROOT-data/network/` beside the AppImage |

**Portable editions never instantiate the updater during ordinary use.** Close ROOT, replace the application with a new download and keep `ROOT-data`. The folder must remain writable; keep removable drives connected until ROOT closes. AppImage requires FUSE and permitted Chromium sandbox/user namespaces. Some distributions restrict these for portable apps. The DEB integrates the builder's system sandbox/AppArmor support. Do not work around restrictions with `--no-sandbox`.

## Saves and migration

**Settings → Desktop & updates → Open data folder** locates `network/save.json` and the previous valid `network/save.backup.json`. Installed Windows profiles normally live under `%APPDATA%/ROOT Cyberbunker`; Linux uses `$XDG_CONFIG_HOME/ROOT Cyberbunker` or `~/.config/ROOT Cyberbunker`. These are the original 1.5.0 profile locations, deliberately retained after the Network OS rename. The folder button is authoritative. Desktop preferences sit alongside `network/`; Chromium UI storage is isolated in `chromium/`, selected synchronously before Electron is ready.

Browser installations retain their existing `data/` files and browser storage. Desktop uses its own profile. Transfer progress by exporting a JSON backup in the browser and importing it in desktop Settings. Import exports the previous desktop state first. Keep a backup when trying older versions: file retention does not establish backwards compatibility with older code.

A fresh session introduces ROOT · Network OS with the skippable fly-in, then opens the web dashboard. “Enter room” deliberately starts first person. Reloading a walkthrough keeps its saved location and orientation.

Closing, F5/Ctrl+R and installing an update first pause decisions and drain the revision-safe save queue. Installation is cancelled without confirmed disk persistence. An ordinary close offers a return path to export a backup and an explicit quit-anyway choice. Only one instance uses a desktop profile at a time.

## Installed updates

Installed editions check GitHub's stable feed after startup and on focus, at most once per day automatically. Automatic checks can be disabled. A check does not download an installer. **Download update** validates the download against release SHA-512 metadata; **Install & restart** saves progress before handing control to NSIS/the DEB installer. The OS may refuse or cancel installation; successful downloading does not prove installation succeeded.

The first preview packages are **unsigned**. SHA-512 establishes integrity relative to published metadata, not an independently verified publisher identity. Windows may display an unknown-publisher/SmartScreen prompt. Signed Windows releases need a maintainer-supplied certificate and CI signing secrets. Signature verification has not been disabled. Native installers and profile compatibility are checked separately from updater discovery/download. Download and checksum verification alone are not an operating-system upgrade test.

Update requests contact GitHub and its asset hosts. Simulation, browser mode and portable mode need no network. Support/release links open in the system browser. There is no telemetry or online AI inference.

## Build and verify

Use Node.js **24.22.1** and the lockfile:

```sh
npm ci --ignore-scripts
node node_modules/electron/install.js
npm run check
npm run desktop
npm run desktop:smoke
npm run desktop:build
```

The explicit install step downloads pinned Electron. Native packages go to ignored `dist/`: Windows builds NSIS + portable EXE; Linux builds DEB + AppImage. Development launches have updates disabled. Smoke tests use fresh synthetic profiles and diagnostic images in ignored `.desktop-build/`, without importing real saves.

`electron-builder.config.cjs` explicitly lists runtime files. `tools/desktop/verify-package.cjs` checks the ASAR's runtime entries, public project identity, excluded saves/build sources and Electron/Chromium notices. This does not establish vulnerability-free dependencies.

Main-process modules separate the local service/protocol, profile, window policy, IPC, save-close coordination and updater. The sandboxed renderer gets a narrow isolated bridge, without Node, generic IPC, arbitrary paths or arbitrary external URLs. A privileged `root://app/` scheme keeps a stable storage origin while the private HTTP service binds an ephemeral loopback port. Browser mode retains its HTTP API and static allowlist.

## First-run introduction and version notes

The browser and desktop editions share `ui/startup.js`. A new profile without a save sees the welcome dialog once; existing installations are quietly baselined when no version marker exists. A later version change shows the bilingual notes from `release.js` once. An offline report is presented first, and the arrival sequence waits until startup dialogs are dismissed. The guide can reopen either dialog. Markers are local to the profile and do not change the network save.

When preparing a release, update `release.js` with the matching `package.json` version and concise German/English notes for that published version. The version-match test deliberately fails if these drift apart. Development branches keep the current release version until the maintainer prepares the next release.

## Release workflow

Pull requests build and launch native packages in disposable Windows/Linux runners alongside existing checks. The Linux runner relaxes its own user-namespace restriction for portable AppImages; renderer sandboxing stays enabled. CI additionally opts into Chromium's documented SwiftShader WebGL mode for trusted synthetic tests on GPU-less Linux runners. This changes no production flags. These checks do not prove hardware performance or compatibility with every distribution's default policy.

After a reviewed merge, push a matching `v<package.json version>` tag already contained in `main`. The release workflow checks version/main ancestry, runs checks, builds/tests both platforms and then publishes installers, portable files, updater metadata and `SHA256SUMS.txt`. Uploads are staged in a draft after both builds succeed. A failed draft needs review and is not overwritten automatically. Never publish `builder-debug.yml`, profiles or entire local output directories.

## Version-specific sources

- Electron **45.2.1**: [security](https://github.com/electron/electron/blob/v45.2.1/docs/tutorial/security.md), [protocol](https://github.com/electron/electron/blob/v45.2.1/docs/api/protocol.md), [sandbox](https://github.com/electron/electron/blob/v45.2.1/docs/tutorial/sandbox.md), [development entry import](https://github.com/electron/electron/blob/v45.2.1/default_app/main.ts).
- electron-builder **26.18.0**: [auto-update support](https://github.com/electron-userland/electron-builder/blob/electron-builder%4026.18.0/website/docs/features/auto-update.md), [configuration schema](https://github.com/electron-userland/electron-builder/blob/electron-builder%4026.18.0/packages/app-builder-lib/scheme.json).
- electron-updater **6.8.11**: [NSIS](https://github.com/electron-userland/electron-builder/blob/electron-updater%406.8.11/packages/electron-updater/src/NsisUpdater.ts), [DEB](https://github.com/electron-userland/electron-builder/blob/electron-updater%406.8.11/packages/electron-updater/src/DebUpdater.ts), [quit/install semantics](https://github.com/electron-userland/electron-builder/blob/electron-updater%406.8.11/packages/electron-updater/src/BaseUpdater.ts).
- [upload-artifact 7.0.2](https://github.com/actions/upload-artifact/blob/v7.0.2/action.yml), [download-artifact 8.0.2](https://github.com/actions/download-artifact/blob/v8.0.2/action.yml): Node 24 runtimes, full commit pins in workflows. [GitHub CLI release creation](https://cli.github.com/manual/gh_release_create) documents draft/upload/publication behavior.

The Linux CI renderer follows the [SwiftShader documentation for Chromium 156.0.8078.75](https://chromium.googlesource.com/chromium/src/+/156.0.8078.75/docs/gpu/swiftshader.md), including its explicit trusted-test opt-in. The smoke checks real draw calls and the reported renderer; it also confirms that desktop settings are visible above the 3D view. The real updater download smoke uses inert loopback fixtures and an isolated cache; it never installs them.
