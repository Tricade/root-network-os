# Planned operations verification

This records the scope of the `feat/planned-operations` verification on 2026-11-02. It is not a claim that every platform, GPU or long-running network has been tested.

## Simulation and save coverage

The final local `npm run check` passed lint, formatting and **323 tests**, with no skipped, cancelled or pending tests.

The Node suite covers schema-8 migration, resource conservation under room priorities, customer expansion provisioning and escrow, preventive maintenance constraints, and ordered capital plans. Existing incident isolation, worker/offline equivalence, and progression tests remain in the suite.

Research tests exercise all 80 added technologies alongside the original 16: prerequisites, sector requirements, payment, pre-completion state, save/restore and completion. All eight opposing doctrine pairs are tested for cancellation and switching; all 256 complete doctrine combinations are checked for bounded, positive effects. The catalog is checked as an acyclic graph. These checks establish those rules, not a playtest of every possible economy.

Asset checks load the generated geometry with the vendored Three r186 loader, check bounds and connection points, and verify ownership/disposal. Illustration checks verify all twelve local PNGs, dimensions, hashes, HTTP delivery and the artwork mapping for jobs, technologies, achievements and building states.

## Actual interface checks

An isolated synthetic network was used in the browser; no player save was edited. Checked through normal controls:

- Research overview, search, branch selection, prerequisite highlighting, drag, wheel zoom and expanded view. Packet Switching was purchased at its normal price and completed after its simulated duration.
- Research confirmation above the expanded map in both the web interface and room console. Escape closes the confirmation before the map; the room console remains available.
- English project, research and achievement artwork. Built-in client names and mixed completion logs translate while custom names remain unchanged.
- Customer filtering, facility search/favorites, preventive maintenance purchase and completion, a queued room construction, and a customer expansion promise with real provisioning.
- Room service priority confirmation and its one-hour commitment. A subsequent change is blocked with a reason.
- Conversion of an empty server room to central cooling. After the paid conversion completed, the room displayed its fan-coil air handler, paired pipes and floor plenums. The central plant showed enclosed upgraded equipment; the control room contained no stray maintenance cart, robot or duplicate environmental sensor.

The reviewed screenshots in the media directory are captures of these running interfaces, not concept renders. Automated geometry checks supplement the visual review; they do not prove that all possible overlaps or flicker are absent.

## Desktop and limits

The native Windows Electron 45.2.1 smoke run passed. It exercised the ordinary workspace routes, modal padding and blur checks, worker/save behavior, and updater download/corruption rejection. It did not install an update or produce a new release.

A requested narrow browser viewport did not take effect in the embedded browser, so it is **not** counted as a responsive-layout pass. Linux desktop execution and a new installer run were not performed locally. No maximum-scale frame-rate or multi-week real-time stability claim is made.

Run `npm run check` for lint, formatting and the Node suite; run `npm run desktop:smoke` on the target desktop platform. See [development](development.md), [research rules](research.md), and [operations planning](operations-planning.md).
