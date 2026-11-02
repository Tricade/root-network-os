# Maintenance windows and notification controls

Verified with Node 24.22.1, Electron 45.2.1 and its Chromium 156.0.8078.75 runtime.

- `npm run check`: lint, formatting and all 367 tests passed; none skipped. The maintenance cases cover single payment, grouped completion, exact notice/outage boundaries, frozen pricing, research discounts, invalid imports, capital-plan budgets and isolation of unrelated service failures.
- Notification tests cover independent visibility/badge/pop-up choices, local preference migration, reload behavior, typed log persistence, direct-action deduplication, dismissible bounded toasts and offline upgrade completion without replay.
- The actual browser interface was checked in German and English. Preferences persisted through a page reload, and the customer counter could be disabled without hiding customer tasks. The settings dialog fit both 1280 × 720 and 520 × 840 viewports. The browser reported no JavaScript errors during these checks.
- A synthetic rack with an active customer was used to select all three components and optional notice through the interface. The quote showed 940 CR of upgrades plus 101 CR notice, a two-minute lead and 3 min 15 s of shared downtime. After confirmation the rack remained online during the announcement period.
- `node tools/desktop/launch.cjs --smoke` passed with the native Electron runtime and real WebGL rendering. It checked saves/reload, English workspaces, modal layout, desktop branding and update transport. The update transport test downloaded a controlled local fixture and rejected a corrupt payload; it did not install an update.
- Pointer-controller tests cover relative/drag separation, input reset and late acquisition cancellation. The embedded browser exercised the unsupported-capture fallback. Native pointer-lock acquisition was not manually exercised; the Electron smoke result is not a claim that it was.

The first Windows portable CI run did not complete: its outer launcher limit included NSIS extraction and expired after the application had rendered. The portable wrapper now has a separate 180-second outer envelope; the app self-test still has its own 60-second runtime deadline. Diagnostic start/elapsed timestamps and process-tree cleanup make future failures explicit. Launcher regression tests reject stale reports, failed exits and timeouts even when a passing report exists.

Only disposable synthetic profiles were used. Existing player saves were not replaced.
