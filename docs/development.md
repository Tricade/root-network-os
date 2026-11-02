# Development map

ROOT runs directly from source with Node.js 24. The server has no third-party npm dependencies; Three.js 0.186.1 and glTF assets are bundled for the browser. See [CONTRIBUTING.md](../CONTRIBUTING.md) for an isolated instance and the test command.

| Area                   | Files                                                                | Responsibility                                                                                       |
| ---------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Simulation composition | `engine.js`                                                          | Compose per-instance domains and preserve the browser/CommonJS public API                            |
| Simulation domains     | `engine/`                                                            | Building ownership, economy, hardware, agents, contracts, recovery, simulation and save migration    |
| Local service          | `server.cjs`, `server/static-files.cjs`                              | Loopback HTTP API, closed static allowlist, atomic persistence, backup and optimistic revisions      |
| Web composition        | `app.js`, `rack-ui.js`                                               | State ownership, navigation and composition of interface factories                                   |
| Web features           | `ui/`, `ui/racks/`, CSS                                              | Facility plan, hardware selection, confirmations, live updates, persistence and feedback             |
| Desktop                | `desktop/`, `ui/desktop.js`, `tools/desktop/`, package config        | Isolated Electron shell, profiles, confirmed save handoff, updater and native release verification   |
| Localization           | `i18n.js`, `locales/`                                                | DOM localization lifecycle and separate English catalogs, preserving custom names                    |
| 3D composition         | `room.js`                                                            | Per-view resources, shared context and public controls                                               |
| 3D features            | `room/`, `room-navigation.js`, `room-facility.js`, `room-arrival.js` | Input, rendering, rack/server geometry, owned-space navigation, sessions, room interiors and arrival |
| Scene details          | Other `room-*.js` modules                                            | Loading/batching, surfaces, furniture, stations and throttled live instruments                       |
| Models                 | `asset-pack/`, `tools/asset-generator/`                              | Runtime files, editable sources, generators and component provenance                                 |

Simulation state is shared by the web UI and 3D controls. Route operations through the same quotes, confirmation and engine actions; do not create a second economy inside scene callbacks. Browser view state is separate from save exports. The server's optimistic revision check prevents stale tabs overwriting newer writes.

Domain factories receive a context containing functions and constants. They do not own a global save. The engine's public calls receive the save explicitly; UI controller accessors resolve the current save after import/reset. Browser engine scripts load in the order declared by `index.html`; a parity test executes that order and compares it with the CommonJS engine. UI and scene features use native ES modules. Do not add `type: module` at the project root: `engine.js` deliberately supports CommonJS consumers.

Paid construction lives in `engine/building.js`; its quotes and actions are shared by the site plan and physical terminals. `ui/facility.js` owns the web plan. `room-navigation.js` contains pure location, corridor and stair calculations. `room/telemetry.js` shares one synchronous model snapshot across navigation, instruments and rebuilds, then releases it in `finally` so in-place actions cannot read stale values. See [construction](construction.md) for ownership and migration rules.

Only the active room is rendered. Preserve static batching and bounded live-display updates; avoid rebuilding the scene or large DOM sections on each tick. Test loss of focus and pointer lock as well as ordinary mouse dragging.

## Verification scope

Run `npm ci --ignore-scripts` once for pinned development tools, then `npm run check`. This runs lint, formatting checks and the Node tests. Tests include construction cost/payment/completion, empty-room selection, migration, offline completion notices, API stale-client protection, engine parity, scene input/navigation, localization, bounded DOM updates, asset geometry and deterministic original-furniture regeneration. `node tools/audit-assets.mjs` separately examines loaded model geometry and texture references; `node tools/inventory-assets.mjs` writes the current hash inventory. Supplied/vendored assets and hash-tracked generator inputs are excluded from automatic formatting.

Manual browser checks are still needed for visual artifacts, legibility, interaction from both sides of a door and fullscreen modal layering. Test data is synthetic. Accepting the maximum save size does not prove an acceptable rendering or simulation frame rate at that size.

## Release branches and saves

The published `main` branch contains the checked baseline. Keep unfinished features on separate branches, and tag only reviewed snapshots. Local development history and personal save backups are not part of this clean publication history.

Export progress before changing versions, and use separate folders/ports/data directories when comparing them. Old single-room releases cannot represent every expanded-fleet save. Schema changes must preserve the explicit import/migration route and the stale-client capability guard.

## Service economy and worker boundary

Schema 4 adds resource-backed customers (`service-catalog`, `service-resources`, `service-metrics`, `services`), explicit supply routing (`room-supply`, `dependencies`), bounded plans and deliveries (`operations`, `operation-plans`), and long assignments (`projects`). Each has validation at the save boundary. User controls live in `ui/business.js` and `ui/operations.js`; both also run inside the 3D console. See [rules and reproducible balance checks](service-economy.md).

`engine.js` owns the ordered module manifest for Node, the browser and the classic dedicated worker. `advance-worker.js` uses `importScripts`; it is not a module worker. `ui/offline.js` retains the source state until a complete worker result passes state-identity and save-conflict guards. Worker startup failures fall back once to yielding main-thread chunks. An import waits for pending catch-up rather than mutating it in place.

Runtime facts checked before implementation: Node **24.22.1**, Electron **45.2.1**, Chromium **156.0.8078.75**, vendored Three.js **0.186.1**. No package or protocol permissions changed. Compatibility references are the [HTML dedicated-worker/importScripts specification](https://html.spec.whatwg.org/multipage/workers.html) (reviewed 2026-11-01), [Node 24.22.1 worker_threads source documentation](https://github.com/nodejs/node/blob/v24.22.1/doc/api/worker_threads.md) and [Electron 45.2.1 protocol documentation](https://github.com/electron/electron/blob/v45.2.1/docs/api/protocol.md). The existing standard, secure `root://app` protocol supports the classic worker in the same configured session.

The Node worker test proves script ordering, serialization and deterministic results. Separately, `desktop/catchup-smoke.cjs` runs an actual Chromium worker under `root://app`, compares a full simulated hour to the direct engine result, and verifies renderer timer heartbeats continue during computation. The exercised Windows runtime passed; this does not claim Linux execution or long-run performance at the maximum save size.

## Connected utility geometry

`room/utility-kit.js` owns original fittings and their GPU resources. `room/cable-tray.js` builds open ladder trays with visible round power cables and flexible cabinet tails; rails and rungs merge into one metal draw call per tray. Only the cables pass through the sealed wall sleeves. `room/plant-connections.js` joins the bounded visible plant modules to sealed wall penetrations; `room/supply-fixtures.js` represents the corresponding room circuit, fan coil and actual rack roof feeds. `room/plant-fascia.js` keeps identifiers, aggregate plant readings and indicator lights in separate rows. These are runtime assemblies, so ownership and room-conversion state control their visibility without generating one asset per upgrade level.

The geometry uses the bundled Three.js 0.186.1 revision documented in [dependencies](dependencies.md). Its official [TubeGeometry implementation](https://github.com/mrdoob/three.js/blob/9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8/src/geometries/TubeGeometry.js) samples curves by arc length; pipe tessellation therefore scales with route length so small bends on long straight runs remain rounded. [RoundedBoxGeometry](https://github.com/mrdoob/three.js/blob/9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8/examples/jsm/geometries/RoundedBoxGeometry.js) is used only for exposed enclosures. The same-revision [BufferGeometryUtils](https://github.com/mrdoob/three.js/blob/9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8/examples/jsm/utils/BufferGeometryUtils.js) merges compatible geometry attributes for the tray structure. Straight routes use one axial segment; bent routes retain length-scaled tessellation. No new package or downloaded models are required.

`tests/utility-geometry.test.cjs` checks feeds against the real rack and plant model bounds, separate water circuits, proud wall flanges, front-elevation label/LED clearance, bounded geometry and disposal on room transitions. `tests/cable-trays.test.cjs` additionally raycasts through the open gaps and checks cable visibility and batched geometry disposal. These geometric checks supplement visual inspection; they do not prove appearance or absence of flicker at every camera angle.

Schema 5 adds the finite robot recruitment board, persisted profiles and common self-maintenance availability. See [personnel rules, migration and tests](personnel.md). This feature has no new dependency, background timer or external asset source.

## Shared navigation, commercial work and research

`ui/navigation.js` defines the grouped web and room routes. `ui/dashboard-model.js` feeds both Dashboard and `room/station-content.js`; actual customer delivery and recurring margin share engine metrics. Engineering controls live in Buildings & utilities; named enquiries and contracts live in Customers & contracts. Achievements have their own renderer and notification destination.

Schema 6 introduced customer cohorts; schema 7 adds the paid research ledger. Separate engine domains own catalogs, actions, progression and strict validation. Customer assignments use the common availability rules. Research effects are declarative, and upgrading an agent previews the actual metrics through a pure copied-agent comparison. Old write clients receive 409 instead of erasing new fields. Tests exercise raw-backup preservation, failed quotes, delayed completion and worker parity.

The native Electron 45.2.1 workspace smoke checks web routes, upgrade confirmation and actual modal scroll geometry. Optional `ROOT_CAPTURE_DOCS=1` captures fictional demonstration data through the real application. Its renderer checks and native frame presentation checks supplement unit tests. The capture API and presentation subscription follow the [45.2.1 webContents documentation](https://github.com/electron/electron/blob/v45.2.1/docs/api/web-contents.md). No private profile, external asset download or additional package is required.

## Attention center and native controls

`ui/attention-model.js` derives individual pending tasks from the shared dashboard model. `ui/attention-cards.js` renders their actions for both Dashboard and the bell; quotes and mutations still pass through the existing engine and confirmation dialogs. `ui/notification-center.js` owns filters and presentation. Its bounded read/history state (`ui/notification-state.js`) lives in browser storage, separately from exported simulation progress, and resets when a network is imported or replaced. Reading a message never completes its underlying task. Existing activity is initially marked read; current pending work and subsequent events remain discoverable.

`controls.css` styles native single-select pickers centrally, including room navigation. The pinned Electron 45.2.1 uses Chromium 156.0.8078.75; Chromium supports this [customizable select appearance from version 135](https://developer.chrome.com/blog/a-customizable-select). The [vendor guidance](https://developer.chrome.com/docs/modern-web-guidance/guides/forms/branded-select-styling) specifies `appearance: base-select` for the control and its top-layer picker. An `@supports` guard leaves standard native selects in browsers without support. Labels, option values and change events are unchanged. Dialog and room keyboard handlers defer to an open picker so Escape closes that list before its parent interface. No JavaScript replacement widget or dependency is introduced.

## Planning, research atlas and illustration ownership

Schema 8 adds `customer-growth`, `service-priorities` / `priority-allocation`, `preventive-maintenance` / `preventive-save`, and `capital-plans` / `save-planning`. Each domain owns its quotes and validation. UI factories consume those quotes, and the 3D console routes to the same actions. Dashboard attention uses shared metrics; it does not advance simulation or allocate new hardware.

The research expansion is split across infrastructure, business and compute catalogs. `research-expansion` applies bounded benefits and specialization alternatives; `research-catalog` retains the original definitions. `ui/research-map.js` derives positions and prerequisite paths, while `ui/research-map-input.js` owns the local camera and abortable input listeners. `ui/research-effects.js` computes actual comparisons. No rendering dependency or background animation timer was added for the atlas.

Pointer input uses capture and cancels on pointer-up, cancellation, lost capture or focus loss. The wheel listener is non-passive only inside the map. Compatibility was checked against the W3C [Pointer Events 3 Recommendation of 2026-06-30](https://www.w3.org/TR/2026/REC-pointerevents3-20260630/) and [UI Events draft of 2026-02-21](https://www.w3.org/TR/2026/WD-uievents-20260221/) for the installed Chromium 156 runtime.

`ui/illustrations.js` allowlists the twelve local PNGs. Domain wrappers map project, research, facility and achievement categories to those images. `ui-art.test.cjs` verifies the complete mappings, dimensions, checksums and HTTP delivery. `research-atlas.test.cjs` exercises all eighty new nodes and every combination of the eight specialization pairs. See [planning rules](operations-planning.md) and [research balance](research.md).
