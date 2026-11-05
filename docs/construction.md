# Construction and economy

A new installation owns one basement, one server room and its access corridor. Control and plant rooms are built separately. Increasing the sector unlocks equipment and the fleet ceiling; it does not create space. Each server room holds six racks of sixteen usable rack units. A basement offers four server-room plots. Server-room numbers stay stable when building on different floors.

## Paid expansion

| Project                 |  Initial price | Initial duration | Result                                                 |
| ----------------------- | -------------: | ---------------: | ------------------------------------------------------ |
| Next server room        |  20,000,000 CR |       30 minutes | Six empty rack slots on the selected owned floor       |
| Next basement           | 500,000,000 CR |          2 hours | Corridor, stair access and four vacant room plots      |
| Control room            |  20,000,000 CR |       30 minutes | Operations room on Basement 1, available from Sector 2 |
| Cooling plant room      |  25,000,000 CR |       30 minutes | Plant space on Basement 1, available from Sector 4     |
| UPS room                |  30,000,000 CR |       30 minutes | Plant space on Basement 1, available from Sector 6     |
| Power distribution room |  35,000,000 CR |       30 minutes | Plant space on Basement 1, available from Sector 8     |

The first additional server room on Basement 1 can be built in two phases. The first costs 6 million CR and takes 15 minutes. On completion the room can be entered and fitted with two racks. A second 15-minute project costs 14 million CR and opens four more slots while existing racks run. The full 20-million-CR build remains available, and either phase can be scheduled in the capital plan. Sector upgrades require reachable servers for their server count.

The control room includes its operations furnishings. Utility rooms provide space; install and upgrade the central systems separately. Racks and servers are also purchased separately. Building a basement does not grant its four server rooms.

With `n` existing server rooms and target floor `d`, the next room costs `ceil(20e6 * n^1.35 * (1 + 0.15*(d-1)))`, capped at 50 trillion credits. With `f` existing floors, the next floor costs `ceil(500e6 * f^2.6)`, capped at 200 trillion. Room durations grow to at most two hours; floors to six hours. These amounts represent excavation, structure, waterproofing and utilities, rather than a hardware purchase.

One external contractor handles one project at a time. The confirmation states the full price and delay. Starting a project charges the full amount exactly once. Only completion adds ownership/capacity; it also adds the room door or adjacent-floor stairs and a notification. There is no cancellation/refund action. A crisis blocks new construction, but an already paid project keeps progressing. Existing services, repairs, backups and agent work remain available during construction; the separate restrictions for hardware maintenance still apply.

Construction uses simulation time, including the existing twelve-hour offline cap. Leaving for longer does not simulate unlimited elapsed time. Save/reload retains cost, target and remaining duration. The web plan, 3D location selectors, hall building terminal and physical status instruments read the same ownership and progress. An empty built room can be visited and selected for its first rack without falling back to a different room's hardware.

## Economy changes

Automation research adds nine percentage points to its base income multiplier per level (`1 + 0.09*level`). It no longer compounds by 1.09 at every level. Reputation income remains `0.002*reputation` for the first 1,000 points; above that, its contribution is `2 + 0.025*sqrt(reputation-1000)`. This keeps early progression close to its previous rate while reducing runaway late passive income. Existing credits, research, levels and equipment are retained.

A bounded comparison with a synthetic high-progress fleet (20 servers, 6 racks, automation level 14, reputation 41,087) reduced the modeled starting net income from about 358 to 66 CR/s. A 24-hour economic study with automatic research and cash-favoring decisions produced about 35 million credits instead of 120 million before construction purchases. The study disabled random incidents to isolate the income formulas; it is not a claim about every playthrough or long-term balance. Room and floor expansion are intended to be capital milestones. Early progress does not require a second room: the first has up to 96 usable rack units.

## Existing saves and boundaries

Schema v3 gains additive `facility.building` ownership and construction fields, plus `roomId` on each rack. A v3 save without building data is migrated once: rack groups retain their previously allocated rooms/floors, and previously accessible control/service rooms are retained without a charge. Subsequent sector upgrades grant no further rooms. Import validation rejects invalid ownership, duplicate rooms, overfilled rooms and changed construction quote terms instead of silently dropping hardware.

Old cached clients lacking the building capability receive HTTP 409 on save and must reload. GET/import migration remains supported. Keep an export before trying an older release; the previous release cannot represent paid empty rooms or an in-progress construction order.

The supported validation ceilings remain 10,000 racks and 10,000 servers, with up to 1,667 rooms and 417 basements. There is no six-rack progression cap. These are finite implementation bounds, not a promise of unlimited real-time simulation performance. Only the current room is drawn; large-fleet simulation performance remains a separate constraint.
