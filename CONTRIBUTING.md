# Contributing to ROOT

Bug reports, balancing ideas, translations, accessibility improvements, original assets and code contributions are welcome. Use the Issues and Pull Requests tabs on the repository's current host; the workflow works on Gitea and GitHub.

## Ways to help

- [Report a bug](https://github.com/Tricade/root-network-os/issues/new?template=bug_report.yml): include the ROOT version or commit, browser/OS, affected interface, steps, expected result and actual result. A small synthetic example is more useful than your personal save.
- [Suggest a feature](https://github.com/Tricade/root-network-os/issues/new?template=feature_request.yml): describe the problem, proposed behavior and tradeoffs. For balancing, include fleet size, elapsed simulation time, income and upkeep.
- Improve German/English translations, documentation, keyboard access or readability. Explain the affected view and include synthetic before/after screenshots for visible changes.
- Build original models or improve the local generators, retaining editable sources and component licenses. See the [asset-tool guide](tools/asset-generator/README.md).
- Fix a focused issue or help test a proposed change. Describe what you actually checked; no programming is required to report a useful reproduction.

For a substantial mechanic, migration or architecture change, discuss the intended behavior in an issue before building it. Search existing issues to keep related discussion together. Read [SECURITY.md](SECURITY.md) before reporting a vulnerability.

## Start a development instance

Use Node.js 24.22.1 or 26.13.0 for the test suite. Desktop packaging uses 24.22.1. Browser mode needs no package installation or compilation. Install the pinned dependencies for tests, formatting, lint and desktop development.

Fork `Tricade/root-network-os` on GitHub, then clone your fork. Replace `YOUR_ACCOUNT` below with your public GitHub handle. Existing contributors can use their current checkout after updating it without discarding local work.

```sh
git clone https://github.com/YOUR_ACCOUNT/root-network-os.git
cd root-network-os
git remote add upstream https://github.com/Tricade/root-network-os.git
git switch -c fix/describe-the-change
npm ci --ignore-scripts
npm run check
```

Keep development saves separate from a real installation. In PowerShell:

```powershell
$env:ROOT_PORT = '18490'
$env:ROOT_DATA_DIR = Join-Path $PWD '.local-data/dev'
node server.cjs
```

On Linux/macOS:

```sh
ROOT_PORT=18490 ROOT_DATA_DIR="$PWD/.local-data/dev" node server.cjs
```

Open `http://127.0.0.1:18490/`. Test servers use temporary data directories. Never point a test at your normal save or share a writable data directory between servers.

## Desktop development

The Electron wrapper, package configuration and updater are included. Use `node node_modules/electron/install.js` after `npm ci --ignore-scripts`, then `npm run desktop`, `npm run desktop:smoke` or `npm run desktop:build`. [Desktop architecture, synthetic tests, storage and release workflow →](docs/desktop.md). Portable editions always use manual updates; do not introduce a portable replacement service. Check both native platforms for changes to packaging, IPC or persistence.

## Before a pull request

1. Keep one topic per branch: `feat/...`, `fix/...`, `docs/...` or `assets/...`.
2. Explain the problem and resulting behavior. Record the checks you actually ran and any remaining limits.
3. Run `npm run check` (ESLint, Prettier and Node tests). `npm run format` applies the agreed formatting. Add focused regression coverage for behavior changes; do not replace runtime checks with string matching alone.
4. Exercise affected controls in both the web UI and 3D terminals. Check German and English, reload recovery and an older synthetic save when persistence changes.
5. Update the relevant documentation. Use synthetic examples and screenshots, with no personal saves, machine paths or credentials.
6. Commit with your chosen public identity and GitHub noreply address, push your branch to your fork, and open a pull request against `Tricade/root-network-os:main`. Link the related issue, explain the resulting behavior and fill in the PR template. Maintainers review before merging; a branch or suggested change is not a release. All required CI checks must pass before a protected-branch merge.

Offline progression, crisis decisions, save conflict handling, repair availability and the original mouse-drag movement path must remain usable. Preserve old save compatibility explicitly; do not discard unknown or invalid data silently to make a test pass. Avoid rebuilding the scene or replacing DOM sections on every simulation tick.

## Assets and translations

See the [asset tool](tools/asset-generator/README.md) for source files, isolated builds and asset acceptance checks. Contribute original geometry and retain editable sources. Do not add downloaded furniture or other third-party models. Material textures need a redistribution-compatible license and a recorded source. Preserve all existing notices; do not label a supplied provenance statement as independently verified.

The interface uses `i18n.js`. Preserve user-entered names and values, placeholders, units and keyboard hints. Check long English/German text in both a dialog and a 3D terminal.

## Reporting a problem

Include the release/commit, browser and OS versions, reproduction steps and expected/actual behavior. For rendering issues, give the room, viewing direction and a synthetic screenshot. For economy changes, state fleet size, elapsed simulation time, income, upkeep and relevant upgrades. Share only the smallest synthetic fixture needed to reproduce a bug.

If AI tools helped, say what they did and how you checked the result. Contributors remain responsible for correctness and asset provenance; see [AI-DISCLOSURE.md](AI-DISCLOSURE.md).

## License

Code contributions use the project's [MIT license](LICENSE). Original asset submissions must state their license and source; ROOT's own generated models/maps use CC0-1.0 as described in [NOTICE.md](NOTICE.md). Contribute only material you are authorized to redistribute.

## Container changes

See [Docker development and deployment](docs/docker.md). Build the runtime image and run `npm run docker:test -- root-network-os:docker-test` in addition to `npm run check`. The test deliberately fails if Docker is unavailable; it must not be reported as a skipped green check. Preserve the default loopback port, explicit origin validation, non-root runtime and volume ownership. CI runs actual containers on both x86-64 and ARM64. Container publication belongs to release CI; PRs must never push images or receive registry write credentials.
