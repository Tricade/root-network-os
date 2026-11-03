import { dashboardModel } from './dashboard-model.js';
import { createDashboardAttention } from './dashboard-attention.js';

/** Business health comes before the optional room tour in both presentations. */
export function createDashboardUI(ctx) {
  const attention = createDashboardAttention(ctx);
  const timelineLayouts = new WeakMap();
  let upcomingCount = 3;
  const getDashboardModel = () => dashboardModel(ctx.E, ctx.state);
  function commandOverview() {
    const model = getDashboardModel();
    return `<div class="command-kpis"><div><span>Laufender Saldo / min</span><strong data-dashboard="net">${ctx.dec(model.net)} CR</strong></div><div><span>Server online</span><strong>${ctx.stat('onlineServers')} / ${ctx.state.servers.length}</strong></div><div><span>Agenten im Normalbetrieb</span><strong data-dashboard="agents">${model.activeAgents}</strong></div><div><span>Verfügbare Credits</span><strong>${ctx.stat('credits')} CR</strong></div></div><div data-dashboard-attention>${attention.attentionMarkup(model)}</div><div class="command-upcoming" data-dashboard-upcoming>${upcoming(model)}</div>`;
  }
  function upcoming(model) {
    const next = model.upcoming;
    return `<span>${ctx.icon('timer')}${ctx.tr('Als Nächstes')}</span>${
      next
        .slice(0, upcomingCount)
        .map(({ label, remaining: time, route, section, count, rackId, phase }) => {
          const target = rackId
            ? `data-facility-open="rack:${ctx.esc(rackId)}"`
            : section
              ? `data-attention-route="${route}" data-ops-section="${section}"`
              : `data-nav="${route}"`;
          return `<button class="text-button" ${target}><strong>${count ? count + ' · ' : ''}${ctx.esc(rackId ? label : ctx.tr(label))}</strong><span>${phase ? ctx.esc(ctx.tr(phase)) + ' ' : ''}<span data-upcoming-time>${ctx.duration(time)}</span></span></button>`;
        })
        .join('') || `<span>${ctx.tr('Keine terminierten Vorgänge')}</span>`
    }${next.length > upcomingCount ? `<button class="text-button" data-upcoming-more>+${next.length - upcomingCount} ${ctx.tr('weitere Vorgänge')}</button>` : ''}${upcomingCount > 3 ? `<button class="text-button" data-upcoming-less>${ctx.tr('Weniger anzeigen')}</button>` : ''}`;
  }
  function dashboardPanels() {
    const model = dashboardModel(ctx.E, ctx.state);
    return `<div class="dashboard-operations"><section class="panel dashboard-business">${ctx.panelHeader('Kunden & Versorgung', ctx.navLink('business', 'Verträge öffnen'))}<div class="panel-body"><div class="dashboard-big-number"><strong data-dashboard="activeContracts">${ctx.fmt(model.customers.active)}</strong><span>aktive Verträge</span></div><div class="dashboard-kpis"><div><span>Diensteinheiten</span><strong data-dashboard="units">${ctx.fmt(model.customers.units)}</strong></div><div><span>Versorgung erfüllt</span><strong data-dashboard="supply">${model.supply === null ? ctx.tr('Noch keine aktiven Dienste') : ctx.dec(model.supply * 100) + ' %'}</strong></div><div><span>Anfragen offen</span><strong data-dashboard="leads">${model.customers.leads.length}</strong></div><div><span>In Einrichtung</span><strong data-dashboard="setups">${model.customers.settingUp}</strong></div></div></div></section>
      <section class="panel">${ctx.panelHeader('Laufende Wirtschaft', ctx.navLink('business', 'Bilanz öffnen'))}<div class="panel-body"><div class="dashboard-finance"><div><span>Kundenumsatz / min</span><strong data-dashboard="gross">${ctx.dec(model.gross)} CR</strong></div><div><span>Betriebskosten / min</span><strong data-dashboard="upkeep">${ctx.dec(model.upkeep)} CR</strong></div><div class="dashboard-net"><span>Laufender Saldo / min</span><strong data-dashboard="net" class="${model.net < 0 ? 'negative' : 'positive'}">${ctx.dec(model.net)} CR</strong></div></div><p class="policy-explainer">Projektbelohnungen kommen zusätzlich bei Abschluss. Dieser Saldo zeigt den laufenden Betrieb einschließlich Starthilfe.</p></div></section>
      <section class="panel">${ctx.panelHeader('Team & laufende Arbeit', ctx.navLink('operations', 'Abläufe öffnen'))}<div class="panel-body"><div class="dashboard-kpis"><div><span>Agenten im Normalbetrieb</span><strong data-dashboard="agents">${model.activeAgents}</strong></div><div><span>In Einsätzen</span><strong data-dashboard="working">${model.workingAgents}</strong></div><div><span>Selbstwartung</span><strong data-dashboard="absent">${model.absentAgents}</strong></div><div><span>Geplante Maßnahmen</span><strong data-dashboard="queue">${model.queue}</strong></div></div><button class="dashboard-lab" data-nav="research">${ctx.icon('research')}<span><strong data-dashboard="labName">${ctx.esc(ctx.tr(model.project?.name || 'Labor ist frei'))}</strong><small data-dashboard="labTime">${model.project ? ctx.duration(model.project.remaining) : ctx.tr('Nächsten Forschungszweig wählen')}</small></span>${ctx.icon('arrow')}</button></div></section></div>
      `;
  }
  function updateDashboard(metrics, resilience, agents) {
    if (ctx.view !== 'overview') return;
    const model = dashboardModel(ctx.E, ctx.state, metrics, resilience, agents);
    const values = {
      activeContracts: ctx.fmt(model.customers.active),
      units: ctx.fmt(model.customers.units),
      supply:
        model.supply === null
          ? ctx.tr('Noch keine aktiven Dienste')
          : ctx.dec(model.supply * 100) + ' %',
      leads: model.customers.leads.length,
      setups: model.customers.settingUp,
      gross: ctx.dec(model.gross) + ' CR',
      upkeep: ctx.dec(model.upkeep) + ' CR',
      net: ctx.dec(model.net) + ' CR',
      agents: model.activeAgents,
      working: model.workingAgents,
      absent: model.absentAgents,
      queue: model.queue,
      labName: ctx.tr(model.project?.name || 'Labor ist frei'),
      labTime: model.project
        ? ctx.duration(model.project.remaining)
        : ctx.tr('Nächsten Forschungszweig wählen'),
    };
    ctx.$$('[data-dashboard]').forEach((el) => {
      el.textContent = values[el.dataset.dashboard];
      if (el.dataset.dashboard === 'net') {
        el.classList.toggle('negative', model.net < 0);
        el.classList.toggle('positive', model.net >= 0);
      }
    });
    attention.updateAttention(model);
    const rows = model.upcoming.slice(0, upcomingCount);
    // A countdown must tick in both dashboards without replacing a focused button every second.
    const layout = JSON.stringify([
      ctx.tr('Als Nächstes'),
      upcomingCount,
      model.upcoming.length,
      rows.map((row) => [row.label, row.phase, row.route, row.section, row.count, row.rackId]),
    ]);
    ctx.$$('[data-dashboard-upcoming]').forEach((panel) => {
      if (timelineLayouts.get(panel) !== layout) {
        const focusRack = panel.contains(document.activeElement)
          ? document.activeElement?.dataset.facilityOpen
          : null;
        panel.innerHTML = upcoming(model);
        timelineLayouts.set(panel, layout);
        if (focusRack)
          [...panel.querySelectorAll('[data-facility-open]')]
            .find((button) => button.dataset.facilityOpen === focusRack)
            ?.focus({ preventScroll: true });
      } else {
        panel.querySelectorAll('[data-upcoming-time]').forEach((element, i) => {
          const value = ctx.duration(rows[i].remaining);
          if (element.textContent !== value) element.textContent = value;
        });
      }
    });
    ctx.$$('[data-net-income]').forEach((el) => {
      el.classList.toggle('positive', model.net >= 0);
      el.classList.toggle('negative', model.net < 0);
    });
    const tour = ctx.$('[data-dashboard-tour]'),
      enter = ctx.$('[data-room-enter]');
    if (tour) tour.disabled = !enter || enter.disabled;
  }
  return {
    dashboardPanels,
    updateDashboard,
    commandOverview,
    getDashboardModel,
    dashboardClick(target) {
      if (target.hasAttribute('data-upcoming-more') || target.hasAttribute('data-upcoming-less')) {
        upcomingCount = target.hasAttribute('data-upcoming-less') ? 3 : upcomingCount + 6;
        ctx.render();
        return true;
      }
      return attention.dashboardClick(target);
    },
  };
}
