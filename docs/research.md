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

Each branch has twelve nodes and dependencies can cross into another branch. Prerequisites are completed technologies. The rebalanced catalog keeps the existing effects, prerequisites and lab times. Active projects use the terms recorded at purchase.

## Time, cost and commitment

The four starter foundations cost 25–40 RP and take 10–15 minutes. Higher foundations charge more according to the required sector. The eighty atlas technologies use these tiers.

| Tier | Required sector | RP charged | Lab time |
| ---- | --------------: | ---------: | -------: |
| 1    |               2 |        350 |   30 min |
| 2    |               3 |      1,300 |      2 h |
| 3    |               4 |      3,600 |      4 h |
| 4    |               6 |      9,600 |      8 h |
| 5    |               8 |     19,200 |     12 h |
| 6    |              10 |     48,000 |     24 h |

The two tier-six nodes in each branch are alternatives. **Only one specialization per branch can be active.** Each improves one channel while imposing a downside elsewhere. Switching requires the other node's full price and lab time again. The previous specialization stays active until completion; cancellation keeps it but refunds no points. No later node depends on a terminal specialization, so switching cannot strand a prerequisite chain.

The five repeatable tracks remain routing, cooling, contract analysis, automation and synthesis. Each requires its foundation and takes `min(4 hours, 5 minutes + 2 minutes × current level)`. First levels cost 120–240 RP. The next level costs 1.62 times as much before rounding. Sector expansion leaves the price for the same level intact. Older saves carry over all purchased levels.

## Earning research points

An online server provides the base rate. Available specialists add output, with a smaller gain for each additional level or agent. Synthesis and the atlas apply their existing bounded benefits. Routine monitoring and backups pay fewer points than audits, dedicated research or AI work. Agent missions and funded projects offer a separate payout for the time and credits committed. Offline catch-up uses the same rates for up to twelve hours.

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

Schema 10 carries over the research balance and completed technologies. Paid lab projects, agent missions and assignments use their booked terms, including their original price or reward. The validator checks the active project’s cost, target level and remaining time against those terms. Duplicate specializations, invalid IDs, unmet dependencies and fabricated project payments are rejected. The current catalog is loaded in the same order by Node, browser and worker.

Three domain catalogs supply the atlas. `research-expansion.js` defines its tiers and bounds the combined effects. UI layout and camera controls live in separate modules. Add translations, reachable dependency paths, effect-bound tests and save round-trips when extending the atlas. The current eight-district layout must also be reconsidered if adding further branches.

Achievements remain a separate menu page and do not occupy the laboratory.

For a completed, non-repeatable technology, the detail dialog shows its active effect and completion state. Lab restrictions, purchase cost and the disabled start button are omitted. If the project completes while its dialog is open, that view updates to the completed state. Repeatable tracks continue to show the quote for their next level.

Maintenance communications is an optional business-branch project (sector 4, 2,250 RP, two hours). With Customer desk and Preventive maintenance prerequisites, it reduces the extra customer-notice fee by 25% and notice lead time from 120 to 60 seconds. It does not waive SLA shortfalls or increase the 50% satisfaction protection.
