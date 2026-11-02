import { sidebarNavigation } from './navigation.js';
import '../brand.js';
import '../release.js';
const RELEASE = globalThis.ROOTRelease;
import { portraitMarkup } from './personnel-art.js';
const BRAND = globalThis.ROOTBrand;

/** chrome UI: reads current state through the controller context. */
export function createChromeUI(ctx) {
  function stat(name, fallback = '') {
    return `<span data-stat="${name}">${fallback}</span>`;
  }

  function actionButton(action, label, payload = {}, cls = '', kind = '', costId = '') {
    const data = Object.entries(payload)
      .map(([k, v]) => `data-${k}="${ctx.esc(v)}"`)
      .join(' ');
    return `<button class="button ${cls}" data-action="${action}" ${data} ${kind ? `data-cost-kind="${kind}" data-cost-id="${ctx.esc(costId)}"` : ''}>${label}</button>`;
  }

  function head(title, description, button = '', eyebrow = 'WORKSPACE / NETWORK OPERATIONS') {
    return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="page-description">${description}</p></div>${button ? `<div class="heading-actions">${button}</div>` : ''}</div>`;
  }

  function panelHeader(title, aside = '', count = '') {
    return `<div class="panel-header"><div class="panel-header-left"><h2>${title}</h2>${count !== '' ? `<span class="count">${count}</span>` : ''}</div>${aside}</div>`;
  }

  function navLink(target, label) {
    return `<button class="text-button" data-nav="${target}">${label}${ctx.icon('arrow')}</button>`;
  }

  function empty(title, description, target = '', label = '', symbol = 'layers') {
    return `<div class="empty-state">${ctx.icon(symbol)}<strong>${title}</strong><p>${description}</p>${target ? `<button class="button small" data-nav="${target}">${label}${ctx.icon('arrow')}</button>` : ''}</div>`;
  }

  function sparklinePoints(type) {
    const data = ctx.state.history.slice(-24).map((h) => h[type]);
    if (data.length < 2)
      data.push(
        type === 'load' ? ctx.E.getMetrics(ctx.state).load : 0,
        type === 'load' ? ctx.E.getMetrics(ctx.state).load : 0,
      );
    const min = Math.min(...data),
      max = Math.max(...data),
      range = Math.max(max - min, 0.001);
    return data
      .map(
        (n, i) =>
          `${((i / (data.length - 1)) * 74).toFixed(1)},${(19 - (max === min ? 0.5 : (n - min) / range) * 16).toFixed(1)}`,
      )
      .join(' ');
  }

  function sparkline(type, color = '#a6cc89') {
    return `<svg class="sparkline" data-sparkline="${type}" viewBox="0 0 74 23" role="img" aria-label="Verlauf der letzten Messwerte"><polyline points="${sparklinePoints(type)}" fill="none" stroke="${color}" stroke-width="1.4"/></svg>`;
  }

  function avatar(agent) {
    return portraitMarkup(agent, ctx.roleClass(agent.role));
  }

  function shell() {
    ctx.$('#app').innerHTML =
      `<div class="app-shell"><div class="mobile-overlay" data-command="menu-close"></div><aside class="sidebar" aria-label="Hauptnavigation"><div class="brand" aria-label="${ctx.esc(BRAND.title)}"><img class="brand-mark" src="favicon.svg" alt=""><div><div class="wordmark">${BRAND.wordmark}<span>.</span></div><div class="brand-label">${BRAND.label}</div></div></div><div class="sidebar-scroll"><div class="workspace"><div class="workspace-symbol">${ctx.icon('globe')}</div><div><div class="workspace-name" data-stat="name"></div><div class="workspace-meta">Sektor <span data-stat="sector"></span> · Lokales Netzwerk</div></div></div><nav class="nav-list">${sidebarNavigation(ctx.view, ctx.icon)}</nav><div class="sidebar-bottom"><div class="sector-tile"><div class="sector-tile-label">${ctx.icon('globe')} &nbsp;Horizont erweitern</div><strong>Sektor <span data-stat="nextSector"></span> wartet.</strong><p>Neue Kapazitäten. Größere Aufträge. Dein nächster Schritt.</p><button class="button small" data-modal="sector">Sektor erschließen${ctx.icon('arrow')}</button></div><button class="nav-item" data-modal="help">${ctx.icon('help')}Handbuch</button><button class="nav-item" data-modal="settings">${ctx.icon('settings')}Einstellungen</button><div class="nav-divider"></div><div class="sidebar-footer"><i class="live-dot"></i>ROOT v${RELEASE.version}<span>LOCAL</span></div></div></div></aside><div class="main-wrap"><header class="topbar"><div class="breadcrumbs"><button class="icon-button menu-button" data-command="menu" aria-label="Navigation öffnen">${ctx.icon('menu')}</button>${ctx.icon('home')}<span>Workspace</span><span>/</span><span class="current" id="breadcrumb">Übersicht</span></div><div class="topbar-right"><span class="save-status">${ctx.icon('check')}<span data-stat="save">Netzwerkstand gespeichert</span></span><span class="tag" data-system-tag><i class="live-dot"></i> ${stat('systemStatus')}</span><button class="icon-button notification-bell" data-modal="notifications" data-notification-bell aria-label="Benachrichtigungen">${ctx.icon('bell')}<span class="notification-count" data-notification-count hidden></span></button><button class="icon-button" data-modal="settings" aria-label="Einstellungen öffnen">${ctx.icon('settings')}</button></div></header><main class="main-content" id="main" tabindex="-1"></main></div></div>`;
    ctx.render();
  }

  function metricsCards() {
    return `<div class="metrics-grid"><div class="metric-card"><div class="metric-label">Verfügbare Credits${ctx.icon('coins')}</div><div class="metric-value">${stat('credits')}<small>CR</small></div><div class="metric-footer"><span data-net-income>${stat('incomeMinute')} CR / min</span>${sparkline('credits')}</div></div><div class="metric-card"><div class="metric-label">Rechenkapazität${ctx.icon('cpu')}</div><div class="metric-value">${stat('capacity')}<small>CU</small></div><div class="metric-footer"><span>${stat('load')} % ausgelastet</span>${sparkline('load', '#9cbce0')}</div></div><div class="metric-card"><div class="metric-label">Forschungspunkte${ctx.icon('research')}</div><div class="metric-value">${stat('research')}<small>FP</small></div><div class="metric-footer"><span class="positive">+${stat('researchMinute')} FP / min</span><span>${ctx.fmt(Object.values(ctx.state.upgrades).reduce((a, b) => a + b, 0))} Upgrades</span></div></div><div class="metric-card"><div class="metric-label">Zuverlässigkeit${ctx.icon('shield')}</div><div class="metric-value">${stat('reliability')}<small>%</small></div><div class="metric-footer"><span><i class="live-dot"></i> ${stat('healthLabel')}</span><span>${stat('power')} kW</span></div></div></div>`;
  }
  return {
    stat,
    actionButton,
    head,
    panelHeader,
    navLink,
    empty,
    sparklinePoints,
    sparkline,
    avatar,
    shell,
    metricsCards,
  };
}
