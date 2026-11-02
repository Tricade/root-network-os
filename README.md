[![Checks](https://github.com/Tricade/root-network-os/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Tricade/root-network-os/actions/workflows/ci.yml)
[![Preview 1.5.1](https://img.shields.io/badge/Preview-1.5.1-8ab4f8)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![AI transparency](https://img.shields.io/badge/AI-transparency_notice-6f42c1)](AI-DISCLOSURE.md)
[![Support on Ko-fi](https://img.shields.io/badge/Ko--fi-Support-ff5e5b?logo=kofi&logoColor=white)](https://ko-fi.com/tricade)
[![GitHub stars](https://img.shields.io/github/stars/Tricade/root-network-os?style=flat)](https://github.com/Tricade/root-network-os/stargazers)

<p align="center">
  <img src="screenshots/readme/wordmark.svg" alt="ROOT · Network OS — build below the surface, keep your network running" width="1200">
</p>

<p align="center">
  <strong>A persistent infrastructure management simulation inside an expanding underground data center.</strong><br>
  Build the hardware. Give your agents a plan. Make the decisions your automation cannot.
</p>

> [!IMPORTANT]
> **AI transparency:** Generative AI substantially assisted ROOT's code, tests, documentation, translations and procedural assets. Changes still require review, appropriate tests and clear asset provenance. The application and its local asset generators do not call an AI provider. See [AI-DISCLOSURE.md](AI-DISCLOSURE.md) for the scope and verification limits, and [NOTICE.md](NOTICE.md) for component licenses.

Enjoying ROOT? **Give the repository a ⭐ [star on GitHub](https://github.com/Tricade/root-network-os)** to help other people discover it.

<p align="center">
  <a href="README.de.md">Deutsch</a> · <a href="#start">Quick start</a> · <a href="#console">Screenshots</a> · <a href="#features">Features</a> · <a href="CONTRIBUTING.md">Contribute</a> · <a href="https://ko-fi.com/tricade">Ko-fi</a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="screenshots/readme/arrival-poster.jpg">
    <img src="screenshots/readme/arrival.webp" alt="Actual arrival sequence: approach the underground ROOT facility and pass through its security airlocks" width="1200">
  </picture>
  <br><sub>Captured from the running application. <a href="screenshots/readme/arrival-poster.jpg">View a still frame</a> · <a href="screenshots/readme/README.md">About these captures</a></sub>
</p>

<p align="center">
  <a href="AI-DISCLOSURE.md"><img src="screenshots/readme/facts.svg" alt="Local browser runtime · web and first person · English and German · 1.5.1 preview · AI-assisted development" width="1200"></a>
</p>

## From one rack to a cyberbunker

Start with **one rack, an edge server, two agents and a single server room**. Accept contracts, earn credits and research, and decide where the next upgrade matters most. A faster server can expose a cooling problem. An extra GPU job can consume the last available accelerators. Sending your best analyst on a research assignment leaves less capacity for ordinary work.

ROOT is built for **occasional check-ins**. Configure contract priorities, reserve money for maintenance, keep operations backups, then come back to see what finished. Major incidents contain further damage and wait for your decision. On return, up to **12 hours of elapsed time** are simulated; the browser does not have to stay open.

Manage everything through the **web console**, or walk the facility in **first person** and use its racks, terminals and wall displays. Both interfaces operate the same network and the same save. Progression is open-ended, with new sectors, repeatable research and further construction instead of a preset campaign ending.

| Build                                                 | Operate                                                     | Protect                                                        | Expand                                                              |
| :---------------------------------------------------- | :---------------------------------------------------------- | :------------------------------------------------------------- | :------------------------------------------------------------------ |
| Fit servers into rack units; connect ports and power. | Balance client contracts, GPU demand and agent assignments. | Weigh repair costs, downtime, spare parts and backup recovery. | Research improvements and finance new underground rooms and floors. |

<a name="console"></a>

## The web console

The interface is grouped into **Control room, Business, Data center, Team & development, and Operations**. The dashboard summarizes delivered customer services, finances and pending work; room profiles and central connections belong to Buildings & utilities. The physical monitors use the same route names and live readings.

Physical hardware is also fully manageable from the ordinary interface: server specifications, GPU usage, switch ports, wiring, power profiles and upgrade consequences are exposed directly.

The compact attention list shows actual decisions, enquiries, repairs and rewards beside the selected category, with actions and current quotes. The notification bell brings pending work and activity history together; marking a message read does not resolve the underlying task. Research nodes open a compact detail dialog over the map. Completed technologies show their active effect instead of an obsolete purchase form.

[![Dashboard with compact attention categories and actionable customer enquiries](screenshots/readme/dashboard-attention.png)](screenshots/readme/dashboard-attention.png)

<table>
  <tr>
    <td width="50%"><a href="screenshots/readme/dashboard-attention.png"><img src="screenshots/readme/dashboard-attention.png" alt="Dashboard: Customer delivery, recurring margin, staffing and actions needing attention." width="480"></a><br><strong>Dashboard</strong><br>Customer delivery, recurring margin, staffing and actions needing attention.</td>
    <td width="50%"><a href="screenshots/readme/customers.jpg"><img src="screenshots/readme/customers.jpg" alt="Customers & contracts: Incoming enquiries, staffed provisioning, support, contract terms and departures." width="480"></a><br><strong>Customers & contracts</strong><br>Incoming enquiries, staffed provisioning, support, contract terms and departures.</td>
  </tr>
  <tr>
    <td width="50%"><a href="screenshots/readme/agents.jpg"><img src="screenshots/readme/agents.jpg" alt="Robot agents: Compare independently rolled strengths, drawbacks, running costs and assignments." width="480"></a><br><strong>Robot agents</strong><br>Compare independently rolled strengths, drawbacks, running costs and assignments.</td>
    <td width="50%"><a href="screenshots/readme/agent-upgrade.jpg"><img src="screenshots/readme/agent-upgrade.jpg" alt="Upgrade comparisons: See the actual network benefit and extra running cost before paying." width="480"></a><br><strong>Upgrade comparisons</strong><br>See the actual network benefit and extra running cost before paying.</td>
  </tr>
  <tr>
    <td width="50%"><a href="screenshots/readme/research-tree.jpg"><img src="screenshots/readme/research-tree.jpg" alt="Research branches: Follow prerequisites and choose which paid lab project gets the next time slot." width="480"></a><br><strong>Research branches</strong><br>Follow prerequisites and choose which paid lab project gets the next time slot.</td>
    <td width="50%"><a href="screenshots/readme/achievements.jpg"><img src="screenshots/readme/achievements.jpg" alt="Achievements: A dedicated page for milestones, progress and claimable rewards." width="480"></a><br><strong>Achievements</strong><br>A dedicated page for milestones, progress and claimable rewards.</td>
  </tr>
  <tr>
    <td width="50%"><a href="screenshots/readme/jobs.jpg"><img src="screenshots/readme/jobs.jpg" alt="Project jobs: Compare resource demands and rewards alongside ongoing customer commitments." width="480"></a><br><strong>Project jobs</strong><br>Compare resource demands and rewards alongside ongoing customer commitments.</td>
    <td width="50%"><a href="screenshots/readme/resilience.jpg"><img src="screenshots/readme/resilience.jpg" alt="Incidents & backups: Manage defects, repairs, parts, reserves and operations backups." width="480"></a><br><strong>Incidents & backups</strong><br>Manage defects, repairs, parts, reserves and operations backups.</td>
  </tr>
  <tr>
    <td width="50%"><a href="screenshots/readme/construction.jpg"><img src="screenshots/readme/construction.jpg" alt="Buildings & utilities: Buy space and configure room profiles, crews, reserves and central connections." width="480"></a><br><strong>Buildings & utilities</strong><br>Buy space and configure room profiles, crews, reserves and central connections.</td>
    <td width="50%"><a href="screenshots/readme/room-console.jpg"><img src="screenshots/readme/room-console.jpg" alt="The same controls in 3D: Grouped navigation and live business readings inside the room console." width="480"></a><br><strong>The same controls in 3D</strong><br>Grouped navigation and live business readings inside the room console.</td>
  </tr>
  <tr>
    <td width="50%"><a href="screenshots/readme/notifications.png"><img src="screenshots/readme/notifications.png" alt="Notification center with category filtering and a directly claimable achievement" width="480"></a><br><strong>One notification center</strong><br>Filter pending work, act on individual items and review the history.</td>
    <td width="50%"><a href="screenshots/readme/research-details.png"><img src="screenshots/readme/research-details.png" alt="Completed research shown in a compact dialog with its active effect" width="480"></a><br><strong>Research details in place</strong><br>Inspect effects and prerequisites without losing your position on the map.</td>
  </tr>
</table>

_Real application captures using a separate synthetic demonstration save. Click an image for a larger view. The interface can be switched between English and German._

<a name="features"></a>

## Systems you can run

### Hardware, wiring and GPU workloads

- **Four hardware families:** edge, compute, storage and AI servers, each with different rack footprint, capacity, power and networking demand.
- **Physical placement:** each 18U operating rack provides 16 device units plus its switch and power distribution. Choose contiguous slots, repatch servers and distribute dense equipment across racks.
- **Actual operating constraints:** rack power, cooling, switch capacity, uplink and individual port state determine usable output. Disconnecting a network port leaves its server powered but unable to contribute capacity.
- **Simulated AI infrastructure:** the base ROOT A480 occupies 4U and supplies four simulated accelerators with 320 GB VRAM. Inference and training contracts require GPU capacity; ordinary CPU capacity cannot substitute for it.
- **Consequential controls:** balanced, performance and eco profiles trade throughput against power and heat. Reboots and repatching take time; rack upgrades temporarily interrupt the attached hardware. Cooling changes temperature gradually instead of resetting it.

### Customers, room specialization and connected utilities

- **Resource-backed customers:** hosting, archives, databases and AI inference reserve CPU, RAM, storage, network, GPUs and VRAM. Only delivered service earns income; unused hardware still costs money.
- **A real customer lifecycle:** incoming enquiries, one-, three- or seven-day contracts, staffed provisioning, support, renewal, commercial departures and SLA cancellation notices. Quotes reserve real resources; revenue starts after setup. Optional customer automation has its own budget.
- **Commitments and reserves:** premium obligations, room profiles, paid crews and agent team leads give expansion real operating consequences. Customer sales and room engineering have separate pages.
- **Paid room conversion:** connect existing rooms to central cooling, distribution or UPS, or retain local backup capacity. Only the converting room stops. Original pipework and cable trays reflect the connection in 3D.
- **Fifteen project families and 46 titles:** different memory, network, storage and accelerator needs keep contract choices varied. Longer agent projects trade ordinary contributions for fixed research, reputation or optimization rewards.
- **Responsive offline calculation:** up to twelve hours run in a background worker with progress feedback; the same policies and simulation rules apply online and offline.

[Customer contract lifecycle →](docs/customer-contracts.md) · [Service economy and failure boundaries →](docs/service-economy.md) · [Measured balance and scaling →](docs/balance-verification.md)

### Planned operations and overview

- **Growing customers:** existing clients request expansion. Commit to a 1, 4 or 12 hour delivery window and budget; agents must provision the service in time.
- **Capital plans:** up to twelve ordered construction and plant steps with price ceilings, earliest starts and a protected reserve.
- **Preventive rack maintenance:** technicians, parts, service windows and customer delivery constrain execution. Automatic maintenance is off by default.
- **Committed priorities:** choose the service class to receive capacity first before a shortage; one-hour commitment, without creating resources.
- **Finding work and equipment:** dashboard attention and upcoming work, customer filters, facility search, favorites and compact agent rosters.
- **Original illustrated cards:** twelve generated raster images for projects, research, achievements and buildings. [Rules, limits and physical representation →](docs/operations-planning.md)

### Agents, contracts and research

- **Three agent roles:** operators accelerate project work, analysts produce research, and technicians support maintenance and reliability. Each agent has a level, trait and configurable focus.
- **Robot recruitment agency:** six applicants every 30 minutes, one permanent shortlist slot, and 64 original robot portraits. Appearance and abilities are rolled independently and persist across reloads.
- **Strengths with trade-offs:** compare a unit's process, research, maintenance and leadership traits against its running costs and drawbacks before activation. Existing staff retain their abilities when loading an older save.
- **Automatic self-maintenance:** individual units can temporarily go offline. Their normal contributions and paid assignments pause; other systems continue, rewards are preserved, and units return automatically. [Recruitment and balance rules →](docs/personnel.md)
- **Special assignments:** network diagnostics reduce risk, load optimization improves throughput, and research assignments deliver research points. The assigned agent contributes nothing to normal operations until completion, then has a cooldown. Matching roles complete their specialist work more efficiently.
- **Competing contracts:** monitoring, migration, audits, optimization, recovery, research and AI work share finite capacity. Rewards, reputation and research arrive when a contract finishes. Automatic acceptance can favor a balanced mix, income or research.
- **Timed research atlas:** 96 technologies in eight connected branches, a searchable zoomable map and five ongoing research tracks. Sixteen terminal specializations form eight trade-off pairs; switching costs points and 24 hours of lab time again. Additional bonuses have diminishing returns. One paid lab project reserves 10% of project throughput; cancellation gives no refund. Existing research levels survive migration. [Laboratory rules →](docs/research.md)
- **Visible upgrade consequences:** agent development compares actual before/after throughput, research, risk, wear, capabilities and running costs, including capped benefits.
- **Dedicated achievements:** milestones, progress and claimable rewards have their own page, badge and notifications.
- **Decisions and sectors:** optional events offer different benefits and wait without a timer; up to three can remain pending. Sector expansion requires credits and operational milestones; it unlocks further progression without creating free rooms.

### Failures, repairs and backups

- **Wear and defects:** condition, heat and operating risk can take servers offline and reduce contract output.
- **Repair choices:** quick repair, overhaul and slow emergency recovery differ in money, parts, downtime, resulting condition and lost work. A power cycle or a new port does not repair broken hardware. Manual recovery provides a slow route without credits or spare parts, at the cost of lost work and a reduced final condition.
- **Major incidents:** power failures, cooling failures and data corruption require explicit recovery decisions. Protection contains further damage while you are away; the connected failure domain is isolated while independent hardware, customers and agents continue. Local, rack, room and central failures have different consequences.
- **Operations backups:** preserve research and ongoing contract work for corruption recovery. A rollback can lose progress made since the backup. These are distinct from exporting the complete save file.
- **Budgeted automation:** automatic minor repairs require spare parts. Repairs, backups, procurement and scheduled work have separate hourly budgets and a protected cash reserve. Parts arrive by standard or express delivery; explicit plans run sequentially within price ceilings and savings targets. Automation handles routine work; recovery choices still matter. [See the automation console →](screenshots/readme/automation.jpg)

### Paid underground expansion

Excavation is a major investment. A new installation owns **one server room and its corridor**. Every additional server room, basement, control room and plant room must be paid for and built.

| Construction            |       Initial cost | Initial time | What becomes available                        |
| :---------------------- | -----------------: | -----------: | :-------------------------------------------- |
| Next server room        |  **20,000,000 CR** |   **30 min** | Space for six racks on an owned floor         |
| Next basement           | **500,000,000 CR** |      **2 h** | Corridor, stairs and four vacant room plots   |
| Control room            |      20,000,000 CR |       30 min | Operations room, from Sector 2                |
| Cooling plant room      |      25,000,000 CR |       30 min | Space for central cooling, from Sector 4      |
| UPS room                |      30,000,000 CR |       30 min | Space for backup power, from Sector 6         |
| Power distribution room |      35,000,000 CR |       30 min | Space for central distribution, from Sector 8 |

**Pay at the start; use the space after completion.** Room and basement prices and durations grow as the bunker expands. One contractor handles one project at a time while existing services, backups and emergency repairs continue. Racks, servers and central plant equipment are purchased separately; the control room includes its furnishings. Build orders cannot currently be cancelled or refunded.

The control and plant wing is built once on Basement 1. Central equipment supports active racks across the facility. Each server room holds **six racks**, and each basement has **four server-room plots**. Cooling, UPS and distribution have finite, upgradeable capacities and running costs. UPS protection depends on how much load it actually covers. Existing saves retain their previously accessible rooms and hardware. [Construction rules and economy details →](docs/construction.md)

## Walk your infrastructure

The bunker has connecting corridors, adjacent-floor stairs, server rooms, plant rooms and a furnished control room with live wall monitors. Open a rack before interacting with the exposed hardware. Terminals open the same management tools used by the web console, with costs and consequences shown before an operation starts.

<details>
<summary><strong>See the control room and first-person controls</strong></summary>

![The walkable control room with live wall instruments and original workstations](screenshots/control-room.jpg)

| Upgraded central cooling                                                                     | Connected server-room air handler                                                            |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| ![Enclosed cooling plant with connected pipework](screenshots/readme/operations-cooling.jpg) | ![Fan-coil air handler supplied by central cooling](screenshots/readme/room-air-handler.jpg) |

| Control                            | Action                                                      |
| :--------------------------------- | :---------------------------------------------------------- |
| Shift + WASD                       | Sprint                                                      |
| WASD                               | Move                                                        |
| Mouse drag / left and right arrows | Look around                                                 |
| E on a closed rack                 | Open its door                                               |
| E on exposed hardware              | Open its controls                                           |
| E on a door or terminal            | Operate the target                                          |
| Escape                             | Close the active dialog or console, then leave walking mode |
| Room / floor selectors             | Navigate directly without walking                           |

Room doors work from both sides and close after passage. Mouse drag remains available when pointer lock is unavailable. Reloading restores the selected location and saved walking position within that browser tab. The skippable arrival sequence introduces ROOT · Network OS, then returns to the web dashboard. Choose “Enter room” to start a walkthrough. It can be replayed or disabled in Settings; reduced-motion preferences are respected.

</details>

<a name="start"></a>

## Quick start

### Desktop downloads

[**Download ROOT for Windows or Linux →**](https://github.com/Tricade/root-network-os/releases/latest)

| Windows x64                          | Linux x64                             |
| ------------------------------------ | ------------------------------------- |
| NSIS installer with built-in updater | DEB package with built-in updater     |
| Portable EXE with manual updates     | Portable AppImage with manual updates |

No separate Node.js installation is needed. Portable progress stays in `ROOT-data` beside the application; keep it when replacing the executable. Installed editions offer **Settings → Desktop & updates** for checks, explicit downloads and installation after saving. Preview packages are unsigned. AppImage needs FUSE and permitted Chromium sandbox/user namespaces. [Setup, save migration and update details →](docs/desktop.md)

### Local browser mode

**Node.js 24** is required; **24.22.1** is the verified version. Clone or download the repository, then run from its directory:

```sh
node server.cjs
```

Open **[127.0.0.1:18473](http://127.0.0.1:18473/)**. On Windows, double-click **ROOT starten.cmd** after making Node available on `PATH`.

**No package installation, compilation, account or internet connection is needed to run ROOT.** Three.js and runtime assets are bundled. Use **Settings → Language** to switch between English and German. See the [contributor guide](CONTRIBUTING.md) for separate ports and data directories.

### Your first session

1. Inspect your rack and accept contracts that fit your available capacity.
2. Set each agent's focus; compare upgrades with the current bottleneck.
3. Configure automatic contract acceptance, repair spending and the protected reserve.
4. Create an operations backup and keep money and parts available for recovery.
5. Research improvements, meet sector milestones and save for expensive underground expansion.

## Local saves and occasional check-ins

- Automatic saving runs every 15 seconds and after decisions. Browser mode uses `data/save.json` and its previous valid write `data/save.backup.json`. Desktop uses the separate profile described above.
- JSON export/import covers the full network. Supported v1–v3 saves can be imported; export before trying an older release.
- Returning simulates up to **12 hours** of offline progress, including work, income, maintenance and construction. Longer absences are capped. This is catch-up simulation in the client, not a continuously running server-side economy.
- Conflicting sessions cannot silently overwrite newer progress. An outdated session pauses and keeps its differing browser copy exportable.
- The local service binds to loopback. There is **no telemetry, analytics or online AI inference**. Installed editions can optionally contact GitHub for updates; simulation, browser mode and portable mode work offline. Hardware, agents and AI workloads are simulated; ROOT does not train models on your machine. Optional support links lead to external websites. [Security and deployment scope →](SECURITY.md)

<details>
<summary><strong>Preview status, progression limits and verification</strong></summary>

ROOT is an evolving **1.5.1 preview**. Balance, localization, accessibility and 3D presentation remain open to contributions. Progression extends beyond six racks; current validation ceilings are 10,000 racks, 10,000 servers and 1,000,000 sectors, with 100 central-utility levels. Only the selected room is rendered. Maximum-size save validation does not establish acceptable real-time performance at that size.

See the [integration verification](docs/verification-construction.md), [runtime notes](docs/runtime-1.4.md) and [asset checks](docs/asset-audit.md) for tested behavior and limits. Desktop package tests complement the earlier 1.4 integration evidence; see the [desktop verification scope and limits](docs/desktop.md).

</details>

## Build with us

You can help with bug reports, balance experiments, translations, accessibility, original 3D assets or code. You do not need to write code to contribute.

- **Found a problem?** [Report a bug](https://github.com/Tricade/root-network-os/issues/new?template=bug_report.yml) with the version, reproduction steps and a synthetic example.
- **Have an idea?** [Suggest a feature](https://github.com/Tricade/root-network-os/issues/new?template=feature_request.yml), explain the problem it solves and describe the expected behavior.
- **Want to build something?** Follow [CONTRIBUTING.md](CONTRIBUTING.md) to fork the repository, start an isolated development instance and open a focused pull request against `main`. Larger changes are easier to discuss in an issue first.

```sh
npm ci --ignore-scripts
npm run check
```

The checks run lint, formatting and the Node test suite. Use synthetic saves and screenshots when reporting bugs; keep personal progress and credentials out of commits. [Contribution guide →](CONTRIBUTING.md) · [Architecture →](docs/development.md) · [GitHub handoff →](docs/publishing.md)

### The asset tool is included

Editable glTF sources and local generators ship in this repository: supplied base infrastructure, central facility equipment and original control-room furniture. Generate into a fresh `.asset-build/` directory without replacing the maintained runtime pack.

```sh
node tools/asset-generator/generate.mjs --help
node tools/asset-generator/generate.mjs interiors
```

The base and facility generators optionally use Python; normal operation and original-furniture generation require Node alone. [Asset-tool guide, dependencies and provenance →](tools/asset-generator/README.md)

## Support and transparency

<a href="https://ko-fi.com/tricade"><img src="screenshots/readme/support.svg" alt="Support Tricade on Ko-fi" width="256"></a>

If you enjoy ROOT, supporting development or contributing a useful issue helps it grow.

**Generative AI substantially assisted development, documentation and procedural assets.** The included runtime does not contact an AI provider. The [AI disclosure](AI-DISCLOSURE.md) explains scope and verification limits.

Project code is [MIT licensed](LICENSE). Original generated models/maps use CC0-1.0; supplied assets, material textures and vendored Three.js have component-specific notices. See [NOTICE.md](NOTICE.md) and the [asset inventory](asset-pack/docs/runtime_inventory.json) before reusing individual components.
