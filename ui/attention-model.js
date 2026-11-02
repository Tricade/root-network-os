/** Individual pending work, shared by the dashboard and notification center.
 * Category counts are navigation only: read markers always identify the underlying item.
 */
export function attentionEntries(E, state, model) {
  const rows = [];
  for (const category of model.actions) {
    const add = (id, title, data = {}, detail = '') =>
      rows.push({
        id,
        title,
        data,
        detail,
        group: category.id,
        route: category.route,
        severity: category.severity,
        category: category.label,
      });
    switch (category.id) {
      case 'incident': {
        const incident = model.protection.incident;
        add(`incident:${incident.id}`, incident.title, incident, incident.description);
        break;
      }
      case 'repairs':
        for (const server of model.protection.servers.filter((s) => s.status === 'failed'))
          add(
            `repair:${server.id}`,
            state.servers.find((s) => s.id === server.id)?.name || server.id,
            server,
            server.fault || 'Gerät ausgefallen',
          );
        break;
      case 'decisions':
        for (const event of state.events)
          add(`event:${event.id}`, event.title, event, event.description);
        break;
      case 'enquiries':
        for (const lead of state.customers.leads) add(`lead:${lead.id}`, lead.client, lead);
        break;
      case 'rewards':
        for (const achievement of E.catalog.achievements.filter(
          (a) => !state.achievements[a.id] && (state.achievementUnlocks?.[a.id] || a.check(state)),
        ))
          add(`reward:${achievement.id}`, achievement.name, achievement, achievement.description);
        break;
      case 'notices':
      case 'support':
      case 'staff':
        for (const contract of state.customers.contracts.filter((c) =>
          category.id === 'notices'
            ? c.notice > 0
            : category.id === 'support'
              ? Boolean(c.issue)
              : c.work && !c.agentId,
        ))
          add(
            `customer:${contract.id}:${contract.notice ? 'notice' : contract.issue || contract.work}`,
            contract.client,
            contract,
          );
        break;
      case 'growth':
      case 'growth-due':
        for (const request of (state.customerGrowth?.requests || []).filter((r) =>
          category.id === 'growth'
            ? r.status === 'offered'
            : r.status !== 'offered' && r.deadlineAt - state.time < 3600,
        ))
          add(`growth:${request.id}:${request.status}`, request.client, request);
        break;
      case 'plan': {
        const step = state.operations.queue[0];
        add(`plan:${step.id}:${step.reason}`, category.label, step, step.reason);
        break;
      }
      case 'maintenance': {
        const schedule = state.preventiveMaintenance.schedule;
        add(
          `maintenance:${schedule.id || schedule.rackId}:${schedule.reason}`,
          category.label,
          schedule,
          schedule.reason,
        );
        break;
      }
      default:
        add(category.id, category.label, {}, category.detail || '');
    }
  }
  return rows;
}

/** A customer waiting for staff and retention is one notification, not two. */
export function uniqueAttentionEntries(entries) {
  return [...new Map(entries.map((entry) => [entry.id, entry])).values()];
}
