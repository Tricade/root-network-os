# Achievements and progress

The catalog has **25 milestones**: the five existing achievements plus twenty new goals for projects, decisions, customers, research, staffing, infrastructure and profitability. Category and status filters organize the page. Each card shows the actual metric used by its unlock predicate, and the notification center lists available rewards.

An unlock is permanent, even when staff leave, equipment is removed or profit falls later. Claiming a reward is a separate, one-time action. Existing claimed rewards are retained; older saves initialize new milestone flags conservatively and evaluate their current counters. The server rejects stale write clients that would omit the new flags, while explicit reads/imports remain migration-compatible.

## Money is measured in three different ways

- **Available credits:** current spending balance. Imports, starting capital and past spending make this different from earnings.
- **Earn 10,000 credits in total:** the original milestone tracks cumulative `lifetimeCredits`, including rewards. It is not a balance or a rate.
- **10,000 CR net per minute:** the new challenge uses the same recurring margin as the dashboard: ongoing income minus operating costs. One-off project and milestone rewards do not count toward this rate.

Other difficult goals include 1,000 completed projects, 100 resolved network decisions, 50 won customer contracts, 70 owned technologies, three completed basements and all four special rooms with all three central systems installed. Queued construction and unfinished research do not count as completed infrastructure or technology.

The twenty new rewards total **2,020 CR**, awarded once each. They supply progression goals rather than a repeatable income source. The original five rewards still total 1,400 CR. Repeated claiming and malformed claim flags are covered by regression tests.

The 10,000 CR/min challenge is attainable under validated resource constraints: a synthetic sector-12 configuration with 24 level-2 AI servers, suitable rack supplies and 300 provisioned inference units produces approximately 12,026 CR/min after upkeep. This proves capacity feasibility; it is not a claim that an ordinary player reaches it in a measured number of days. See [balance verification](balance-verification.md) for the separate progression scenarios.
