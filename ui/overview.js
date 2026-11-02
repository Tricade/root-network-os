/** overview UI: reads current state through the controller context. */
export function createOverviewUI(ctx) {
  function topology() {
    return ctx.Room.markup();
  }

  function jobRows(jobs = ctx.state.jobs) {
    return jobs.length
      ? jobs
          .map(
            (j) =>
              `<div class="workload-row" data-job="${j.id}"><div class="job-top"><div class="job-title"><span class="job-title-icon">${ctx.icon(ctx.kindIcons[j.kind])}</span><div>${ctx.esc(j.title)}<div class="job-client">${ctx.esc(ctx.tr(j.client))} · ${ctx.esc(ctx.kindNames[j.kind])}</div></div></div><span class="job-number">+${ctx.fmt(ctx.jobReward(j))} CR</span></div><div class="progress-track"><div class="progress-fill" data-job-progress="${j.id}" style="width:${Math.min(100, (j.work / j.totalWork) * 100)}%"></div></div><div class="job-meta"><span data-job-percent="${j.id}">${ctx.fmt((j.work / j.totalWork) * 100)} % erledigt</span><span data-job-eta="${j.id}"></span><span>+${ctx.fmt(j.science)} FP</span>${j.kind === 'ai' ? `<span class="gpu-label">${j.gpuDemand} GPU benötigt</span>` : ''}</div></div>`,
          )
          .join('')
      : ctx.empty(
          'Keine aktiven Aufträge',
          ctx.state.policies.autocontract
            ? 'Die automatische Vergabe ist aktiv und prüft passende Angebote.'
            : 'Nimm einen Auftrag an oder aktiviere die automatische Vergabe.',
          'jobs',
          'Aufträge ansehen',
          'jobs',
        );
  }

  function agentRows() {
    const operations = ctx.agentOperations();
    return ctx.state.agents
      .slice(0, 4)
      .map(
        (a) =>
          `<div class="agent-row">${ctx.avatar(a)}<div><div class="agent-name">${ctx.esc(a.name)}<span class="level-pill">LVL ${a.level}</span></div><div class="agent-role">${ctx.E.catalog.roles[a.role].name}</div></div><div class="agent-action"><i class="live-dot"></i>${operations.agents.find((x) => x.id === a.id)?.absent ? ctx.tr('Selbstwartung') : ctx.esc(operations.agents.find((x) => x.id === a.id)?.assignment?.label || ctx.focusNames[a.focus])}</div></div>`,
      )
      .join('');
  }

  function eventPreview() {
    const event = ctx.state.events[0];
    if (event)
      return `<div class="panel-body"><span class="tag amber">ENTSCHEIDUNG OFFEN</span><h3 class="inbox-title" style="margin-top:16px">${ctx.esc(event.title)}</h3><p class="inbox-description">${ctx.esc(event.description)}</p><button class="button block" data-nav="inbox">Optionen ansehen${ctx.icon('arrow')}</button><div class="mission-status">${ctx.icon('timer')}Wartet auf dich. Ohne Zeitlimit.</div></div>`;
    const serverGoal = Math.min(ctx.E.getMetrics(ctx.state).serverLimit, 2 + ctx.state.sector),
      jobsGoal = ctx.state.sector * 3;
    return `<div class="panel-body"><div class="signal-icon">${ctx.icon('expand')}</div><h3 class="inbox-title">Dein nächster Horizont</h3><p class="inbox-description">Mach dein Netzwerk bereit für Sektor ${ctx.state.sector + 1}. Jeder Ausbau eröffnet neue Möglichkeiten.</p><div class="step-label"><span>Server im Betrieb</span><span>${ctx.state.servers.length} / ${serverGoal}</span></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, (ctx.state.servers.length / serverGoal) * 100)}%"></div></div><div class="step-label"><span>Aufträge abgeschlossen</span><span>${Math.min(ctx.state.counters.jobs, jobsGoal)} / ${jobsGoal}</span></div><div class="progress-track"><div class="progress-fill blue" style="width:${Math.min(100, (ctx.state.counters.jobs / jobsGoal) * 100)}%"></div></div><div style="margin-top:18px"><button class="button small block" data-modal="sector">Ausbau planen${ctx.icon('arrow')}</button></div></div>`;
  }

  function overviewView() {
    return (
      ctx.head(
        'Was braucht dich?',
        'Kunden, Wirtschaft, Team und Infrastruktur gemeinsam im Blick.',
        `<button class="button ghost" data-dashboard-tour disabled>${ctx.icon('globe')}Serverraum betreten</button>${ctx.newServer()}`,
      ) +
      ctx.commandOverview() +
      (!ctx.hideGuide && ctx.state.counters.jobs < 5
        ? `<div class="onboarding">${ctx.icon('spark')}<div class="onboarding-copy"><strong>Willkommen in deiner Leitstelle.</strong><p>Baue Kapazität auf, wähle passende Aufträge und gib deinen Agenten einen Schwerpunkt.</p></div><button class="button small" data-modal="help">So funktioniert ROOT${ctx.icon('arrow')}</button><button class="icon-button" data-command="hide-guide" aria-label="Einführung ausblenden">${ctx.icon('cross')}</button></div>`
        : '') +
      ctx.dashboardPanels() +
      `<div class="dashboard-grid"><section class="panel">${ctx.panelHeader('Dein Rechenzentrum', '<span class="tag green"><i class="live-dot"></i>LIVE</span>')}${topology()}<div class="network-stats"><div class="network-stat"><span class="network-stat-label">Server online</span><span class="network-stat-value">${ctx.stat('onlineServers')} <span class="muted">/ ${ctx.state.servers.length}</span></span></div><div class="network-stat"><span class="network-stat-label">Agenten aktiv</span><span class="network-stat-value">${ctx.stat('activeAgentCount')}</span></div><div class="network-stat"><span class="network-stat-label">Wärmstes Rack</span><span class="network-stat-value">${ctx.stat('rackTemperature')} °C</span></div><div class="network-stat"><span class="network-stat-label">Durchsatz</span><span class="network-stat-value">${ctx.stat('work')} / s</span></div></div><div class="panel-footer"><div class="graph-legend"><span class="legend-item"><i></i>Live aus deinem Netzwerk</span></div>${ctx.navLink('network', 'Infrastruktur verwalten')}</div></section><section class="panel inbox-panel">${ctx.panelHeader(ctx.state.events.length ? 'Entscheidungs-Inbox' : 'Nächster Schritt', ctx.state.events.length ? `<span class="count">${ctx.state.events.length}</span>` : ctx.icon('globe'))}${eventPreview()}</section><section class="panel">${ctx.panelHeader('Aktive Aufträge', ctx.navLink('jobs', 'Alle Aufträge'), ctx.state.jobs.length)}${jobRows(ctx.state.jobs.slice(0, 3))}<div class="panel-footer"><span>${ctx.state.policies.autocontract ? 'Automatische Vergabe aktiv' : 'Aufträge werden manuell angenommen'}</span>${ctx.navLink('automation', 'Automatisieren')}</div></section><section class="panel">${ctx.panelHeader('Deine Agenten', ctx.navLink('agents', 'Verwalten'), ctx.state.agents.length)}${agentRows()}<div class="panel-footer"><span>Selbstständig im Hintergrund aktiv</span><span class="tag green">ONLINE</span></div></section></div><section class="panel section-spacer">${ctx.panelHeader('Zuletzt im Netzwerk', ctx.navLink('log', 'Aktivitätslog'))}<div class="activity-list">${ctx.state.log
        .slice(0, 3)
        .map(
          (l) =>
            `<div class="activity-row"><span class="activity-time">${ctx.clock(l.time)}</span><span class="activity-message"><i class="activity-dot"></i>${ctx.esc(l.message)}</span></div>`,
        )
        .join('')}</div></section>`
    );
  }

  function networkView() {
    return ctx.R.view();
  }

  function consoleOverviewView() {
    return (
      ctx.head(
        'Dashboard',
        'Kunden, Wirtschaft, Team und Infrastruktur gemeinsam im Blick.',
        `<button class="button primary" data-modal="sector">${ctx.icon('expand')}Sektor erschließen</button>`,
      ) +
      ctx.commandOverview() +
      ctx.dashboardPanels() +
      `<section class="panel section-spacer">${ctx.panelHeader('Aktive Aufträge', ctx.navLink('jobs', 'Aufträge verwalten'))}${jobRows(ctx.state.jobs)}</section>`
    );
  }
  return {
    topology,
    jobRows,
    agentRows,
    eventPreview,
    overviewView,
    networkView,
    consoleOverviewView,
  };
}
