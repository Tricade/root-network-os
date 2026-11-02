# Laboratory and research atlas

The atlas contains **97 technologies in eight connected branches**, plus five repeatable research tracks. Drag to explore, use the wheel or buttons to zoom, search by name/effect, or focus a branch. Selecting a technology highlights its prerequisite path and shows its actual before/after effects. The focus view expands the map; Escape returns to the ordinary console. Keyboard users can tab to nodes, pan with arrow keys and fit the map with Home.

Research is paid work over time. The lab runs **one project at a time**, reserves **10% of project throughput**, and charges research points when it starts. Its effect activates once, on completion. Cancelling frees the lab but refunds neither points nor elapsed time. Losing all reachable servers, or entering a global data/utility crisis, pauses the lab. It resumes after recovery, including during offline catch-up.

| Branch                | Focus                                          | Alternative terminal specializations         |
| --------------------- | ---------------------------------------------- | -------------------------------------------- |
| Network architecture  | Packet handling, congestion and failover       | Throughput / deterministic networks          |
| Customer operations   | Setup, support, demand and retention           | Concierge service / volume operations        |
| Operations automation | Inventory, maintenance and dispatch            | Agile provisioning / conservative operations |
| Research & AI         | Experiments, model validation and inference    | Fundamental research / production lab        |
| Thermodynamics        | Airflow, hydraulic balancing and plant control | Economical / stable cooling                  |
| Power engineering     | Metering, load profiles and power quality      | Lean / conservative supply                   |
| Data architecture     | Indexing, locality, replicas and consistency   | High density / low latency                   |
| Resilience            | Inspection, fault isolation and recovery       | Safety / availability focus                  |

Each branch has twelve nodes and dependencies can cross into another branch. A prerequisite is an actual completed technology; buying points alone does not bypass it. All original sixteen technologies retain their IDs, prices, durations, dependencies and effects, including paid projects loaded from an older save.

## Time, cost and commitment

The original foundations cost 25–40 RP and take 10–15 minutes. Original advanced nodes reach three hours. The eighty new technologies use these tiers:

| Tier | Required sector | RP charged | Lab time |
| ---- | --------------: | ---------: | -------: |
| 1    |               2 |        200 |   30 min |
| 2    |               3 |        500 |      2 h |
| 3    |               4 |      1,200 |      4 h |
| 4    |               6 |      2,600 |      8 h |
| 5    |               8 |      5,000 |     12 h |
| 6    |              10 |     10,000 |     24 h |

The two tier-six nodes in each branch are alternatives. **Only one specialization per branch can be active.** Each improves one channel while imposing a downside elsewhere. Switching requires the other node's full price and lab time again. The previous specialization stays active until completion; cancellation keeps it but refunds no points. No later node depends on a terminal specialization, so switching cannot strand a prerequisite chain.

The five repeatable tracks remain routing, cooling, contract analysis, automation and synthesis. Each requires its foundation and takes `min(4 hours, 5 minutes + 2 minutes × current level)`. Their existing cost curves and effects remain separate. Older saves keep every completed repeatable level.

## Bounded benefits

The new nodes do not compound dozens of percentage bonuses exponentially. For each effect channel, their positive contributions use `delta = limit × (1 − exp(−sum / limit))`. This additional benefit is applied to the unchanged original sixteen-node factor. Specialization penalties multiply afterwards and cannot be erased by a cap.

| Additional benefit channel                                   | Asymptotic limit |
| ------------------------------------------------------------ | ---------------: |
| Project work, onboarding, energy saving, inference income    |         20% each |
| Risk reduction, service-resource saving, research production |         18% each |
| Wear reduction                                               |              15% |
| Customer patience                                            |              25% |
| AI job reward                                                |              24% |
| Retention probability bonus                                  |            +0.10 |

These are limits for the new atlas nodes, not final network-wide percentages. Staff, hardware, supply and repeatable research apply separately. Selecting a node opens a compact dialog over the map with its actual effect changes, prerequisites, cost and lab time. Prerequisite links replace that same dialog; only the explicit start button pays for research. Closing returns focus to the selected node without changing the map's zoom or page scroll. This works in the web interface, expanded atlas and 3D console. Research cannot create cooling capacity, replace a disconnected server or guarantee customer retention.

## Save and extension boundary

Schema 7 introduced the paid research ledger; current schema 9 retains its structure. Completed IDs and the active project's paid cost, target level and remaining time are validated. Duplicate specializations, invalid IDs, unmet dependencies and fabricated project payments are rejected. The current catalog is loaded in the same order by Node, browser and worker.

`research-catalog.js` preserves the original definitions; three domain catalog modules supply the expansion, and `research-expansion.js` owns its tier rules and bounded aggregation. UI layout and camera controls live in separate modules. Add translations, reachable dependency paths, effect-bound tests and save round-trips when extending the atlas. The current eight-district layout must also be reconsidered if adding further branches.

Achievements remain a separate menu page and do not occupy the laboratory.

For a completed, non-repeatable technology, the detail dialog shows its active effect and completion state. Lab restrictions, purchase cost and the disabled start button are omitted. If the project completes while its dialog is open, that view updates to the completed state. Repeatable tracks continue to show the quote for their next level.

Maintenance communications is an optional business-branch project (sector 4, 450 RP, two hours). With Customer desk and Preventive maintenance prerequisites, it reduces the extra customer-notice fee by 25% and notice lead time from 120 to 60 seconds. It does not waive SLA shortfalls or increase the 50% satisfaction protection.
