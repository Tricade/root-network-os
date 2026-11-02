# Robot agents and recruitment

The recruitment agency offers six applicants every **30 minutes of simulation time**, two per role. One applicant can be shortlisted indefinitely. Reloading, opening the agency or pinning a different applicant does not generate another cohort. Hiring consumes the applicant; expired or already consumed IDs cannot charge credits. The board also advances during offline catch-up.

Appearance, name, strength and drawback use separate seeded draws. There are **64 original robot portraits** across four atlases. A cohort avoids portraits already used by the team, the shortlist and other applicants. Portraits are stored, so hiring, renaming or reloading does not change a unit's face. The existing team limit remains five slots in sector 1, increasing by two per sector to a maximum of twelve; the portrait library is not the team cap.

Every new unit starts at level 1 with one strength and one drawback. Activation costs retain the existing role/sector/same-role cost curve, with a bounded 0.92–1.12 profile factor. A unit costs `0.007 × level^0.65 CR/s`, modified by its cost traits. There is no free instant refresh or refund when retiring a unit. Active assignments must finish before retirement, and at least one unit must remain. Retiring a manager vacates its leadership post.

| Strength            | Effect on this unit                                                   |
| ------------------- | --------------------------------------------------------------------- |
| Process expert      | +18% contribution to job throughput                                   |
| Knowledge seeker    | +18% passive research contribution                                    |
| Careful maintenance | +18% maintenance contribution                                         |
| Team spirit         | +3 percentage points to the room management bonus                     |
| Efficient hardware  | −15% running costs                                                    |
| Well balanced       | Self-maintenance intervals ×1.5; management bonus +1 percentage point |

| Drawback                 | Effect on this unit                                                        |
| ------------------------ | -------------------------------------------------------------------------- |
| Deliberate pace          | −10% contribution to job throughput                                        |
| Needs learning support   | −10% passive research contribution                                         |
| Maintenance is secondary | −12% maintenance contribution                                              |
| Power-hungry hardware    | +20% running costs                                                         |
| Maintenance prone        | 8–12 minutes of self-maintenance at a base interval of 4–6 operating hours |
| Independent operator     | −4 percentage points to the room management bonus                          |

Traits change the unit's contribution inside the existing bounded workforce formulas. They do not multiply the entire network's income. Paid assignment rewards and durations retain their existing snapshots. Combined cost traits multiply; the quote shows the resulting cost. Management remains subject to its existing cap.

Normal units need 5–10 minutes of self-maintenance at a base interval of 18–30 operating hours. Every newly activated or migrated unit has at least two hours before its first absence. Self-maintenance finishes automatically. The unit's ordinary contributions and room management bonus pause, and paid missions/projects stop counting down. Their paid rewards remain intact. Other units, crew and unaffected hardware keep working, while running costs continue. The same deterministic health timeline drives browser ticks and offline catch-up without consuming the simulation's event RNG.

## Save compatibility

Schema/API **5** validates bounded recruitment state, portrait indices, trait keys and timestamps. Versions 1–4 migrate explicitly. Existing units retain names, levels, focus and the reliable-manager bonus; migration does not invent new drawbacks or immediate absences. GET/import accepts legacy saves, but POST rejects cached versions 1–4 with `409 updateRequired`. The previous valid v4 file is retained byte for byte as the backup on the first v5 write.

## Implementation and evidence

`engine/personnel.js` owns effects and availability; `personnel-market.js` owns recruitment and retirement; `save-personnel.js` owns schema validation. Existing metrics, crew management, missions, projects and simulation call the common helpers. UI is separated into `ui/personnel.js`, `personnel-art.js` and `workload-art.js`; layout is in `personnel.css`. Web and in-room console use the same views and actions.

Runtime baseline: Node **24.22.1**, Electron **45.2.1** with Chromium **156.0.8078.75**. No dependency or protocol permission changes. The same-version [Node worker source documentation](https://github.com/nodejs/node/blob/v24.22.1/doc/api/worker_threads.md) covers the existing worker test boundary. Portrait atlas positioning follows the [CSS background-position specification](https://www.w3.org/TR/css-backgrounds-3/#background-position); [reduced-motion preferences](https://www.w3.org/TR/mediaqueries-5/#prefers-reduced-motion) disable decorative transitions. Static CSS and SVG add no timers or render loops. These specification facts do not substitute for browser/runtime checks.

`tests/personnel.test.cjs` covers finite hiring, persisted identity, rotation/shortlisting, costs and perks, individual absences, paused paid assignments, management, migration and worker parity. Server tests cover v4 migration/backup bytes/stale-client rejection. The robot art's prompts, checksums and provenance are in `asset-pack/docs/personnel-manifest.json` and `personnel-prompts.json`. Portraits were generated with the built-in image tool; diagrams are original inline SVG code. No external character or furniture assets are included.

Illustration hover changes only the frame color; SVGs do not receive pointer events or scale. UI backdrop blur is disabled in the room HUD, lower controls, room console, building overlay and modal backdrop. Existing surface colors and the lower bar's original transparency are retained; control hints are not faded when the console opens. The console has no broad drop shadow and the shared room stage has no color filter. The [CSS Transforms rendering model](https://www.w3.org/TR/css-transforms-1/#transform-rendering) and [Filter Effects backdrop model](https://drafts.csswg.org/filter-effects-2/#BackdropFilterProperty) describe these rendering boundaries. Browser QA checks active hover, stable console geometry, working research purchases and the lower bar's actual computed filters/opacity. These checks supplement the automated suite; they do not prove every driver-specific compositor behavior.

## Development decisions

**Review upgrade** opens a measured before/after comparison before any payment. It shows actual project and research rates, incident risk, server wear, the unit's hourly cost, standard customer-work time, management potential and research-assignment reward. The current environment and all caps are included; a maxed workforce bonus can mean higher wages without more current project work. The comparison is a snapshot at opening, not a promise of future utilization.

Wages grow with level to the power of 0.65. Customer work reaches its level-based speed cap at 1.5×; room leadership remains capped at 20%, and the fleet's ordinary workforce multiplier at 25%. Roles, focus and traits affect the result. Current paid customer work, missions and long projects lock development and focus changes. A completed purchase closes the old quote before another purchase is possible.
