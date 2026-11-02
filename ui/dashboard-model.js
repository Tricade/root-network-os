/** One read model feeds both the web dashboard and physical control-room instruments. */
export function dashboardModel(
  E,
  state,
  metrics = E.getMetrics(state),
  resilience = null,
  agents = null,
) {
  const customers = E.getCustomers(state, { summaryOnly: true });
  const protection = resilience || E.getResilience(state, null, metrics);
  const personnel = agents || E.getAgentOperations(state);
  const project = state.lab.project ? E.getResearch(state, metrics).project : null;
  const supply = metrics.serviceUnits ? metrics.serviceDelivered / metrics.serviceUnits : null;
  const activeAgents = personnel.agents.filter((a) => !a.assignment && !a.absent).length;
  const workingAgents = personnel.agents.filter((a) => a.assignment && !a.absent).length;
  const absentAgents = personnel.agents.filter((a) => a.absent).length;
  const growth = state.customerGrowth?.requests || [];
  const preventive = state.preventiveMaintenance;
  const actions = [];
  if (protection.incident)
    actions.push({
      id: 'incident',
      route: 'resilience',
      label: 'Vorfall braucht eine Entscheidung',
      detail: protection.incident.title,
      severity: 'urgent',
    });
  if (protection.failed)
    actions.push({
      id: 'repairs',
      route: 'resilience',
      label: 'Defekte Server reparieren',
      count: protection.failed,
      severity: 'warning',
    });
  if (customers.notices)
    actions.push({
      id: 'notices',
      route: 'business',
      label: 'Kündigungsfristen beachten',
      count: customers.notices,
      severity: 'warning',
    });
  const supportCases = state.customers.contracts.filter((c) => c.issue).length;
  if (supportCases)
    actions.push({
      id: 'support',
      route: 'business',
      label: 'Kundenfälle bearbeiten',
      count: supportCases,
      severity: 'warning',
    });
  if (supply !== null && supply < 0.95)
    actions.push({
      id: 'supply',
      route: 'facility',
      label: 'Versorgungsdefizit prüfen',
      severity: 'warning',
    });
  if (metrics.incomePerSecond < 0)
    actions.push({
      id: 'margin',
      route: 'business',
      label: 'Laufender Saldo ist negativ',
      severity: 'warning',
    });
  if (customers.waitingAgents)
    actions.push({
      id: 'staff',
      route: 'business',
      label: 'Kundeneinsätze warten auf Agenten',
      count: customers.waitingAgents,
      severity: 'normal',
    });
  if (customers.leads.length)
    actions.push({
      id: 'enquiries',
      route: 'business',
      label: 'Kundenanfragen prüfen',
      count: customers.leads.length,
      severity: 'normal',
    });
  const rewards = E.catalog.achievements.filter(
    (a) => !state.achievements[a.id] && (state.achievementUnlocks?.[a.id] || a.check(state)),
  );
  if (rewards.length)
    actions.push({
      id: 'rewards',
      route: 'achievements',
      label: 'Belohnungen abholen',
      count: rewards.length,
      severity: 'normal',
    });
  if (state.events.length)
    actions.push({
      id: 'decisions',
      route: 'inbox',
      label: 'Entscheidungen stehen an',
      count: state.events.length,
      severity: 'warning',
    });
  if (!project)
    actions.push({
      id: 'research',
      route: 'research',
      label: 'Nächstes Forschungsprojekt planen',
      severity: 'normal',
    });
  const expansionOffers = growth.filter((r) => r.status === 'offered');
  const duePromises = growth.filter(
    (r) => r.status !== 'offered' && r.deadlineAt - state.time < 3600,
  );
  if (expansionOffers.length)
    actions.push({
      id: 'growth',
      route: 'business',
      label: 'Erweiterungsanfragen prüfen',
      count: expansionOffers.length,
      severity: 'normal',
    });
  if (duePromises.length)
    actions.push({
      id: 'growth-due',
      route: 'business',
      label: 'Zugesagte Liefertermine werden fällig',
      count: duePromises.length,
      severity: 'warning',
    });
  if (state.operations.queue[0]?.reason && !state.operations.paused)
    actions.push({
      id: 'plan',
      route: 'operations',
      label: 'Bau- und Ablaufplan wartet',
      detail: state.operations.queue[0].reason,
      severity: 'normal',
    });
  if (preventive?.schedule?.reason)
    actions.push({
      id: 'maintenance',
      route: 'operations',
      label: 'Geplante Wartung wartet',
      detail: preventive.schedule.reason,
      severity: 'normal',
    });
  const upcoming = [];
  if (project)
    upcoming.push({ label: project.name, remaining: project.remaining, route: 'research' });
  for (const order of state.operations.orders)
    upcoming.push({
      label: 'Ersatzteillieferung',
      count: order.quantity,
      remaining: Math.max(0, order.arrivalAt - state.time),
      route: 'operations',
      section: 'budget',
    });
  const build = E.getConstructionProject(state);
  if (build) upcoming.push({ label: build.label, remaining: build.remaining, route: 'facility' });
  for (const c of state.customers.contracts)
    if (c.stage === 'active' && (c.notice || c.remaining) < 86400)
      upcoming.push({ label: c.client, remaining: c.notice || c.remaining, route: 'business' });
  for (const r of growth)
    if (r.status !== 'offered')
      upcoming.push({
        label: r.client,
        remaining: Math.max(0, r.deadlineAt - state.time),
        route: 'business',
      });
  if (preventive?.operation)
    upcoming.push({
      label: 'Vorbeugende Rackwartung',
      remaining: preventive.operation.remaining,
      route: 'operations',
      section: 'maintenance',
    });
  else if (preventive?.schedule)
    upcoming.push({
      label: 'Frühester Wartungsstart',
      remaining: Math.max(0, preventive.schedule.earliestAt - state.time),
      route: 'operations',
      section: 'maintenance',
    });
  const rank = { urgent: 0, warning: 1, normal: 2 };
  actions.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return {
    customers,
    protection,
    project,
    supply,
    activeAgents,
    workingAgents,
    absentAgents,
    gross: metrics.serviceIncome * 60,
    upkeep: metrics.upkeep * 60,
    net: metrics.incomePerSecond * 60,
    queue: state.operations.queue.length,
    deliveries: state.operations.orders.length,
    expansionOffers: expansionOffers.length,
    expansionPromises: growth.length - expansionOffers.length,
    preventive,
    upcoming: upcoming.sort((a, b) => a.remaining - b.remaining),
    // Presentation may collapse this list, but it must never lose lower-priority work.
    actions,
  };
}
