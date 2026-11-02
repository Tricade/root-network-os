# Customers, connected utilities and operating plans

Current development uses save schema **7**: named customer contracts and paid lab projects join the existing personnel, room and operating-plan state. Older saves migrate while preserving progress; cached older clients cannot write over the new state. The first new-format write preserves the previous raw save as a backup. Older releases cannot load schema 7.

## Income follows delivered work

Installed hardware provides CPU, RAM, storage, network throughput, GPU and VRAM. Customers reserve these resources in a particular room. Project jobs use the remaining fleet resources; admission also reserves pending customer commitments. A second server has running costs even if nobody uses it. In the event of a GPU shortage, hosting and CPU projects can continue independently.

| Service unit | Base CR/second | Main requirement                |
| ------------ | -------------: | ------------------------------- |
| Hosting      |           0.14 | 2 CPU, 8 GB RAM, 30 Mbit/s      |
| Archive      |           0.26 | 4 TB storage, 20 Mbit/s         |
| Database     |           0.44 | 4 CPU, 24 GB RAM, 80 Mbit/s     |
| AI inference |           0.72 | 0.5 GPU, 24 GB VRAM, 100 Mbit/s |

Full resource requirements are quoted before accepting an enquiry. New customers require 600 units of agent work and a one-time fee equal to thirty minutes of base revenue. Contracts last one, three or seven simulated days after setup, with optional renewal. See the [customer lifecycle](customer-contracts.md) for support, commercial departures and SLA notices. Premium pays 15% more and imposes outage compensation; a premium change takes effect at renewal, so an outage cannot be escaped by toggling a switch.

Room specialization saves 10% of matching resources; changing it takes two minutes at half delivery. A reserve limits new commitments, leaving capacity for faults and project work. Each paid crew supports 24 customer units. A qualified agent can lead one room, with a bounded management bonus. Staff, hardware care, energy, racks and central plant all incur costs. Automation discounts energy and hardware care by up to 25%; research synthesis approaches a 60% bonus. These bonuses have diminishing returns.

If every server is unavailable, a recovery allowance covers the deficit and leaves 0.08 CR/second for restarting. Underused online hardware can run at a loss. The operating statement shows the allowance separately from customer revenue and costs.

## Central plant requires physical connections

Buy and equip the relevant utility room before connecting server rooms. Cooling, UPS and distribution unlock at sectors 4, 6 and 8. Installed modules do not automatically supply unrelated rooms.

| Room connection              | Normal supply                                        | Central plant failure                          |
| ---------------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| Local                        | Local rack equipment                                 | Remains independent                            |
| Central                      | Shared plant; rack power protection remains required | Connected service is isolated                  |
| Central with local backup    | Central and retained local capacity                  | Local capacity remains; load may need reducing |
| Local power with central UPS | Local power; shared battery protection               | Local distribution remains independent         |

Conversion costs **4,200 CR per rack for cooling** or **3,200 CR per rack for power**, multiplied by 1.35 for the hybrid option. Empty rooms use a one-rack minimum. Conversion takes three simulated minutes and stops only that room. Its hardware cannot be moved or expanded while the quoted conversion is pending. Central capacity must cover the proposed design load, including other pending conversions.

Each cooling module supplies 3.5 kW, each distribution module 6 kW and each UPS module protects 3 kW, shared among connected racks. UPS reduces upstream power-failure risk; it cannot repair a broken downstream cabinet. Central module levels can grow beyond five. Physical cabinet rendering remains bounded; displays represent aggregate installed capacity.

Original runtime geometry in `room/supply-fixtures.js` adds insulated supply/return headers, isolation valves, open cable trays, visible power cables and flexible rack connections. Central-only rooms hide local cooling units; hybrid rooms retain them. The same rule applies to the procedural fallback scene. No external furniture or model downloads were introduced.

## Failures have boundaries

- A failed server removes that server's capacity. Other servers, customers and agents continue.
- A disabled switch port affects its connected server. Rack maintenance and rack utility faults affect that rack.
- A room utility fault or conversion affects its room.
- Central plant faults remove the relevant shared capacity from connected rooms. Local rooms stay independent; hybrid rooms retain local equipment.
- Data-loss recovery is proportional to the affected scope and applies once. Unrelated work completed during recovery is retained.

Previously saved, unscoped legacy crises retain their original recovery semantics until resolved. Damage containment still limits physically failed servers to two; leaving two unrepaired does not grant incident immunity. Major incidents wait for a decision, so returning after a long absence can still require recovery work.

## Varied jobs and meaningful agent assignments

Fifteen job families and 46 titles cover monitoring, web delivery, databases, archives, backups, networking, analytics, rendering, security and several AI workloads. Requirements differ in memory, storage, bandwidth, GPU and VRAM. Some compact jobs remain available to a small installation; automatic offers can replace impossible pending offers without discarding accepted work.

Agents can undertake an operations audit (30 minutes), research project (one hour) or capacity analysis (two hours). Costs and rewards are fixed when assigned. Normal contributions, team leadership and a technician's wear reduction pause during the project. Completion has a cooldown. This makes staffing a trade-off rather than a free additional reward.

## Automation with spending limits

Operation plans expose separate hourly repair, backup, procurement and scheduled-work budgets. Changing a limit does not reset already spent money. Maintenance respects the protected cash reserve; planned expansion also respects the savings target. A visible recommendation shows the budget needed for four backups per hour. Existing budget choices are not silently increased during migration.

Parts have storage limits and delivery delays: standard delivery takes 30 minutes, express takes five minutes at twice the price. At most two orders can be in transit. Each owned server room adds 20 storage places. Automatic restocking obeys its own budget and target inventory.

A plan can contain up to twelve explicit actions: backup, rack upgrade, central upgrade or room conversion. Actions run sequentially and recheck their prerequisites, current price, individual price ceiling, hourly budget and reserves. A blocked action shows why it is waiting. Players can pause or remove entries. Save data cannot insert arbitrary executable actions.

## Reproducing balance checks

Run `node tools/balance/bench.cjs`. It uses fictional fixtures and fixed seeds, performs 24-hour scenarios as two allowed twelve-hour sessions, compares identical online/offline decisions, and measures one minute at 60, 240 and 960 servers. It never reads a player save. Results are observations, not wall-clock CI thresholds or a guarantee that every seed avoids incidents.

The current bounded results and their precise conditions are recorded in [balance verification](balance-verification.md). Natural starts, constructed mature fleets, outage behavior and limited scale probes are identified separately; a constructed fleet is not evidence of first-day player income.

Room excavation starts at 20 million CR; another floor starts at 500 million, with costs increasing for further expansion. See [construction](construction.md). Expanding customer utilization and room capacity is necessary to finance later floors; a fixed small installation is intentionally a slow route.

Long catch-up runs in a dedicated worker and reports progress. The fallback yields between small chunks. Only a complete result replaces live state; import/save conflicts cannot overwrite it halfway through. The original save remains intact if catch-up fails. See [development](development.md) for runtime verification and scope.
