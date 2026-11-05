# Planned operations

The dashboard's attention list and upcoming work summarize the same simulation used by the room displays. Customer filters, facility search, favorites and compact staff views organize the current network; they do not create a separate 3D economy.

## Finding a plan

The operations page has four sections: **Budgets & procurement**, **Expansion plan**, **Maintenance planning** and **Agent projects**. Counts summarize active deliveries, queued steps, scheduled maintenance and projects. Section switches retain unsaved form values; importing another save or starting a new network discards those old drafts. The same sections are available in the 3D console.

The dashboard shows one actionable pending item at a time, with previous/next controls when more remain. It does not put a second vertical scroll region inside the page or room console. Wide screens retain a compact category column and place decision choices side by side.

## Customer expansion promises

Established active customers can request more capacity. Eligibility is reviewed every six simulated hours with a bounded chance, and at most twelve requests are retained. A request grows the source service by roughly 15%, bounded to one through ten units, and expires after 24 hours.

Accept with a **1, 4 or 12 hour** delivery promise and a budget ceiling. The quote checks room team capacity, hardware, and the protected reserve. The actual setup fee is charged and resources are reserved at acceptance. A staffed provisioning job adds the units to the existing contract when it completes, preserving its remaining term and using the same contract slot. The added units start earning at completion. A missed deadline lowers reputation and satisfaction once. Previously paid split setups finish under their original terms. Earlier promises waiting for capacity can still use their escrow or receive the original refund at expiry.

## Priorities during shortages

Each server room defaults to equal sharing. A declared hosting, archive, database or inference priority allocates available resources to that class first and shares the remainder among other classes. It cannot exceed physical CPU, RAM, storage, network, GPU or VRAM capacity.

A change is a **one-hour commitment**, selected while the room is fully supplied and before an incident, conversion or maintenance. This prevents repeatedly switching priorities after an outage to evade its consequences. The ordinary room-operation quote and confirmation are also used in the 3D console.

## Preventive rack maintenance

Preventive work targets worn but working servers; it does not resurrect failed hardware. It needs a technician, spare parts, money and a sufficiently supplied customer portfolio. The rack is interrupted only for the short service phase; other racks continue.

The default automatic policy is **off**, threshold 70% condition, minimum delivery 100% and daily spending limit 2,500 CR. Thresholds can range from 50–80%, and the delivery floor can be relaxed to 95%. An earliest time and daily maintenance window allow scheduling around other commitments. A zero budget blocks spending. Automatic work retains a technician for other duties and rechecks constraints at execution time. Completed maintenance restores eligible condition up to 85%; continuous free full restoration is not available.

## Capital plans

Queue up to twelve ordered construction or utility steps, including prerequisite floors and rooms. Each entry has an earliest start and maximum price. Estimates project preceding steps without charging money or granting ownership. At execution, normal quotes recheck funds, prerequisites and conflicts, and respect the protected reserve and plan budget.

The head waits when a temporary constraint is unmet. Reordering or removing unpaid steps is possible; impossible chains and upgrades beyond their cap are rejected. A started construction job follows the normal paid-building rules and cannot be cancelled for a refund. Planning does not give free rooms or instant upgrades.

## Physical representation and prepared assets

Central cooling level 1 uses the inexpensive open pump skid. Higher levels replace it with enclosed equipment; levels 3 and 5 add bounded parallel modules. Live capacity comes from the engine, not the visible cabinet count. Connected server rooms use fan-coil air handlers; hybrid supply deliberately retains local fallback equipment.

Construction barriers, boards and pallets represent actual building work. Environmental displays and a maintenance robot, dock and cart remain **prepared assets only**. They are not automatically scattered through occupied rooms. All eleven operations models are original procedural ROOT geometry with editable source and an offline generator.

Twenty original raster illustrations supply project, research, achievement, decision and building-card artwork. All six decision types have their own image; built server rooms and vacant excavation plots use different subjects. Prompts, dimensions and hashes are in the asset pack. Small functional icons and graph edges remain vector UI.

## State and verification

The save stores priorities, customer growth, maintenance and capital plans. Old saves migrate with conservative defaults. Tests cover payment, resource conservation, constrained execution, failure and cancellation paths, offline equivalence and save validation. See [research rules](research.md), [development boundaries](development.md) and [verification scope](verification-planning.md).

## Shared rack maintenance

Select power, cooling and/or switch when reviewing a rack upgrade. One to three components gain one level in one shared outage; prices and labor time add up (45–195 seconds). No extra capacity is delivered until the whole window finishes. Existing faults are not repaired. The same batch can be placed in the capital plan with a price ceiling, earliest start, hourly budget and protected reserve.

Customer notice is **optional and off by default**. A simulated mail to active customers in the rack’s room costs `ceil(20 + 5 × notified contracts + 8% × upgrade cost)`. The rack stays online for 120 seconds before work. Only the satisfaction loss caused by that planned outage is reduced by 50%; unrelated shortages, actual delivery, SLA deficits and cancellation rules are unchanged. Notice cannot be bought without an active customer. The paid price, recipients and timing survive reload and offline progression.

The Maintenance communications research (sector 4, 2,250 RP, two hours) reduces the extra fee by 25% and the notice period to 60 seconds. Normal maintenance stays available without research or notice. Older saves migrate to schema 11. Reload a cached older client before making changes.

## Power outage response plan

The optional switch under Operations & Resilience authorizes the normal safe power reroute. It starts when the quote can be covered by the current hourly repair budget and the protected reserve. The fee counts once against that budget. Cooling and data incidents still use the player's recovery choice. Budget rows show current spending and when the next automatic action is blocked. Server and sector quotes warn when the planned expansion would make an automatic backup unaffordable.
