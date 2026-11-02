# Balance and scaling verification

Recorded on 2026-11-02 with Node 24.22.1, schema 7. The measurements use fictional fixed seeds and separate saves. They are observations of the stated scenarios, not guarantees about every play style or incident draw.

| Scenario                      | Simulated interval | Change in credits | Customer revenue | Conditions                                                                           |
| ----------------------------- | -----------------: | ----------------: | ---------------: | ------------------------------------------------------------------------------------ |
| Normal fresh start, seed 8701 |             1 hour |              +950 |            1,515 | Default policies, two agents, one contract with three units; no manual purchases.    |
| Same fresh start              |            8 hours |            +6,132 |           12,123 | Normal automatic backups; no incident drawn in this seed and interval.               |
| Constructed 24-server fleet   |             1 hour |          +103,309 |          160,413 | Eight migrated named contracts, controlled full delivery, fixed installed hardware.  |
| Constructed 240-server fleet  |             1 hour |        +1,056,394 |        1,604,128 | 56 migrated contracts; this is a scaling fixture, not natural first-day progression. |

The measured large-fleet income scales with delivered capacity rather than a free global income multiplier. These controlled fleets do not establish how quickly a player can afford their equipment. Excavation remains expensive: a server room starts at 20 million CR and another basement at 500 million, with rising prices. Existing ownership and completed upgrades survive migration.

Packet switching charges 35 RP and occupies the lab for 600 seconds. In the measured start fixture, project work changed from 0.3045 to 0.27405 units/s during research, then to 0.31668 after completion. Experimental methods changed passive research from 0.046 to 0.04784 RP/s. Agent upgrades compare actual before/after metrics and running costs, including cases where capped bonuses provide no additional current throughput.

## Failure and unattended behavior

In the controlled all-server-off probe, service revenue was zero and raw operating costs exceeded revenue. The recovery allowance restored a booked rate of 0.08 CR/s; paid automatic work can still reduce the resulting cash gain. This is restart assistance, not customer profit. Underused online hardware can still lose money.

An eight-hour supply-loss scenario produced a complaint, an SLA notice and eventual cancellation; loading its save succeeded. Dependency tests separately cover isolated server faults, switch/room/central failures and local fallback. A single broken server removes its own contribution, rather than globally stopping unaffected services.

A 600-second worker run matched direct simulation in both state and report. Automated tests also compare worker completion of paid research and staffed provisioning, old-save migration, rejected stale writes and exact raw-backup preservation. A successful parser or save validation alone is not a rendering or throughput benchmark.

One simulated minute in the bounded performance probe took 13 ms with 24 servers/eight contracts, and 87 ms with 240 servers/56 contracts; equivalent empty-customer probes took 12 and 64 ms. These measurements are hardware-dependent and do not prove acceptable performance at the maximum save limits. Only the selected physical room is rendered. Customer summaries reuse shared resource and assignment reads, rather than copying the entire portfolio for each display.

Run `node tools/balance/bench.cjs` for the broader reproducible fixture suite. It can take substantially longer than the bounded probes above. Run `npm run check` and the native Electron smoke test for the maintained regression checks. Tests that are skipped, timed out or not executed are not passing evidence.
