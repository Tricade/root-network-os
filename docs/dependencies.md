# Runtime and tooling versions

The application uses Node.js built-ins and vendored browser modules. Browser mode needs no package installation. Tests and desktop development require the pinned npm dependencies; packaged desktop users do not need npm or a separate Node.js.

| Component           | Checked version  | Scope                                             |
| ------------------- | ---------------- | ------------------------------------------------- |
| Node.js             | 24.22.1, 26.13.0 | Server and tests on Windows/Linux; Docker uses 26 |
| Three.js            | 0.186.1          | Local browser rendering and geometry tools        |
| CPython             | 3.12.14          | Optional base/facility generation                 |
| NumPy               | 2.5.4            | Optional procedural geometry/textures             |
| Pillow              | 13.0.0           | Optional base texture generation                  |
| ESLint / @eslint/js | 10.14.0 / 10.0.1 | Development-only static checks                    |
| globals             | 17.13.0          | Development-only browser/Node global declarations |
| Prettier            | 3.9.10           | Development-only formatting                       |

Development dependencies are pinned in `package-lock.json` and installed with `npm ci --ignore-scripts`. Build/lint tools are not loaded by browser mode. Packaged desktop mode loads the separately declared updater runtime dependencies. Node 24.22.1 meets ESLint 10.14.0's `^20.19.0 || ^22.13.0 || >=24` requirement. Flat configuration follows the [exact ESLint 10.14.0 documentation](https://github.com/eslint/eslint/blob/v10.14.0/docs/src/use/configure/configuration-files.md); formatting follows the [Prettier 3.9.10 configuration documentation](https://github.com/prettier/prettier/blob/3.9.10/docs/configuration.md). CommonJS/native-module compatibility is checked against [Node 24.22.1 modules](https://github.com/nodejs/node/blob/v24.22.1/doc/api/modules.md). Lint and parser success alone are not browser compatibility evidence.

The Docker image pins [Node 26.13.0 LTS](https://nodejs.org/en/blog/release/v26.13.0) by digest. The source server and test suite support both major versions. Desktop packaging uses [Node 24.22.1](https://nodejs.org/en/blog/release/v24.22.1) alongside Electron’s embedded runtime.

## Three.js source

The vendored files are from the official npm package [three-0.186.1.tgz](https://registry.npmjs.org/three/-/three-0.186.1.tgz), source revision [`9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8`](https://github.com/mrdoob/three.js/tree/9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8).

Package integrity:

```text
sha512-blFeqb49wRCSGUGj7gtpfnSGHy2lwDk94RhUmS1c/hTby70kvChbWpkJ4Pm1390LqzzvTmzgXKHPEafJwCb8jA==
```

Core builds are unchanged. Example-module imports are redirected to the same local core. `vendor/LICENSE` retains the Three.js MIT notice. The renderer requires WebGL 2; a device that cannot create the renderer can still use the web hardware interface.

## Generator compatibility

The asset wrapper uses the argument-array subprocess API documented in the [exact Node 24.22.1 source](https://github.com/nodejs/node/blob/v24.22.1/doc/api/child_process.md), with `shell: false`. The [Pillow 13.0.0 release notes](https://github.com/python-pillow/Pillow/blob/13.0.0/docs/releasenotes/13.0.0.rst) remove `Image.fromarray` mode use when it changes data type; the base generator supplies uint8 RGB/L arrays without such a type change. All three generator targets were exercised in the checked environment. See the [asset guide](../tools/asset-generator/README.md) for isolated commands and scope.

## GitHub checks

The optional GitHub workflow pins `actions/checkout` 7.0.1, `actions/setup-node` 7.1.0 and `actions/setup-python` 7.1.0 to complete commit IDs. Their versioned `action.yml` files still declare Node 24 action runtimes, independently of the project interpreter versions installed by those actions. The workflow requests read-only repository access and checks application tests on Windows/Linux plus Python generation on Linux. It uses `push` and `pull_request`, with persisted checkout credentials and automatic package-manager caching disabled. No Gitea runner is configured by this repository.

## Dependabot

The version 2 configuration in `.github/dependabot.yml` checks npm development dependencies, the optional Python asset requirements and GitHub Actions every Monday at 08:00 Europe/Berlin. Each ecosystem permits up to five open version-update pull requests. Updates are proposed for review; automatic merging is not configured. Dependency alerts and automated security fixes are separate GitHub repository settings. The supported fields and ecosystems follow the [official Dependabot options reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference).

The vendored Three.js files and interpreter versions embedded in scripts or workflows still need deliberate maintenance. An npm update does not replace vendored renderer bytes, and a successful dependency pull request does not replace the browser and asset compatibility checks described above.

## Desktop versions and audit scope

The lockfile pins Electron **45.2.1**, electron-builder **26.18.0**, electron-updater **6.8.11** and semver **7.8.5**. Electron 45.2.1 actually reports Node 24.22.1 / Chromium 156.0.8078.75 in the desktop smoke test. Packaging inspection explicitly depends on `@electron/asar` **4.3.1**, shared with the builder through the overrides below. See [desktop architecture, exact-version sources and build commands](desktop.md).

The release/build workflows additionally pin official upload-artifact **7.0.2** and download-artifact **8.0.2** to full commits, both using Node 24 action runtimes. Repository checks remain read-only; only the final tag-triggered release job has `contents: write`. Dependabot covers runtime and development npm dependencies.

Both runtime and full development dependency audits are checked. CI and the release verification job reject moderate-or-higher advisories with `npm audit --audit-level=moderate`. This is a check against the current advisory database, not proof that every dependency is vulnerability-free.

## Matcher migration for GHSA-g3hv-75wg-m249

The [advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249) affects minimatch versions below 11.0.1: attacker-controlled patterns at optimization level 2 can amplify CPU and memory use. The original lockfile had six affected matcher installations and 19 propagated audit findings. They are removed by a coordinated migration, rather than replacing the callable minimatch 3/5 API with an incompatible module.

The npm `overrides` in `package.json` deliberately cross the parent packages' declared major ranges. Treat them as project-maintained compatibility choices, not upstream support claims:

| Dependency                                               | Pin                                       | Compatibility boundary                                                                                                                  |
| -------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `@electron/asar`                                         | 4.3.1                                     | Builder's named stream/stat API remains; the verifier supplies the explicit list options. Node >=22.12 is required.                     |
| `glob` under ASAR                                        | 14.0.3                                    | Migrates the internal matcher representation together with minimatch 11; retains the named Promise `glob()` API used by ASAR.           |
| `minimatch` under ASAR, builder, ESLint and config-array | 11.0.3                                    | Reviewed consumers use named `Minimatch`, `match()` and non-string pattern detection, not the removed regular-expression API.           |
| `@electron/universal` under builder                      | 3.0.6                                     | Removes the old dir-compare/matcher subtree and uses ASAR 4.                                                                            |
| `ejs` under builder                                      | 7.0.2                                     | Retains the CommonJS `compile()` surface and removes its runtime Jake/filelist dependencies.                                            |
| `temp`                                                   | Local `@root-network-os/build-temp` 1.0.0 | Replaces the only consumer's `track()`/callback `mkdir('si-')` contract using Node built-ins. No legacy rimraf/glob dependency remains. |

The local provider has its own honest package identity and source in [tools/desktop/build-temp](../tools/desktop/build-temp/README.md). Its top-level `file:` override is intentional: npm 11.19.1 and 12.2.1 resolve that form against the repository root. Their reifiers do not apply the same root-path correction to a nested file override. The lockfile records a relative source path, without a machine-specific directory. Tests guard against an additional consumer silently acquiring this limited API.

Integration tests exercise ESLint glob discovery/ignores, builder include/exclude traversal, ASAR archive contents and unpacking, EJS compile/render, and the real Squirrel helper's temporary-directory call. Temp tests also check creation failures, process-exit cleanup and a substituted directory link without deleting its destination. Windows/Linux package jobs build and launch the supported NSIS, portable EXE, DEB and AppImage editions. macOS universal, MSI and Squirrel installer generation are not release targets and are not validated by those native jobs; an API/template/helper check is not a platform build.

Version-specific sources: [minimatch 11.0.3 changes](https://github.com/isaacs/minimatch/blob/v11.0.3/changelog.md), [glob 14.0.3 changes](https://github.com/isaacs/node-glob/blob/v14.0.3/changelog.md), [ASAR 4.3.1 API](https://github.com/electron/asar/blob/v4.3.1/src/asar.ts), [universal 3.0.6 metadata](https://github.com/electron/universal/blob/v3.0.6/package.json), [EJS 7.0.2 API](https://github.com/mde/ejs/blob/v7.0.2/README.md), and npm's root-file resolution in [11.19.1](https://github.com/npm/cli/blob/v11.19.1/workspaces/arborist/lib/arborist/reify.js) / [12.2.1](https://github.com/npm/cli/blob/v12.2.1/workspaces/arborist/lib/arborist/reify.js). Reassess the overrides when the parent packages migrate; do not widen them or force audit-driven downgrades without checking actual APIs and native packages.
