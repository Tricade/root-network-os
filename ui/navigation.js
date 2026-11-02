/** One registry defines web routes, grouped menus and the in-room terminal. */
export const NAVIGATION_GROUPS = [
  {
    id: 'control',
    label: 'Leitstelle',
    items: [
      ['overview', 'grid', 'Dashboard', 'overviewView'],
      ['inbox', 'inbox', 'Entscheidungen', 'inboxView', 'eventCount'],
    ],
  },
  {
    id: 'business',
    label: 'Geschäft',
    items: [
      ['business', 'jobs', 'Kunden & Verträge', 'businessView'],
      ['jobs', 'jobs', 'Projektaufträge', 'jobsView', 'jobCount'],
    ],
  },
  {
    id: 'infrastructure',
    label: 'Rechenzentrum',
    items: [
      ['network', 'server', 'Racks & Server', 'networkView'],
      ['facility', 'layers', 'Gebäude & Versorgung', 'facilityView'],
    ],
  },
  {
    id: 'development',
    label: 'Team & Entwicklung',
    items: [
      ['agents', 'agents', 'Agenten', 'agentsView'],
      ['research', 'research', 'Forschung', 'researchView'],
      ['achievements', 'trophy', 'Erfolge', 'achievementsView', 'achievementCount'],
    ],
  },
  {
    id: 'operations',
    label: 'Betrieb',
    items: [
      ['resilience', 'shield', 'Störungen & Backups', 'resilienceView'],
      ['operations', 'automation', 'Betriebspläne', 'operationsView'],
      ['automation', 'automation', 'Automatisierung', 'automationView'],
      ['log', 'log', 'Ereignisprotokoll', 'logView'],
    ],
  },
];
for (const group of NAVIGATION_GROUPS) {
  group.items.forEach(Object.freeze);
  Object.freeze(group.items);
  Object.freeze(group);
}
Object.freeze(NAVIGATION_GROUPS);
export const NAVIGATION_ITEMS = Object.freeze(NAVIGATION_GROUPS.flatMap((g) => g.items));
export function navigationGroup(view) {
  return NAVIGATION_GROUPS.find((g) => g.items.some(([id]) => id === view)) || NAVIGATION_GROUPS[0];
}
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function sidebarNavigation(view, icon) {
  return NAVIGATION_GROUPS.map(
    (group) =>
      `<div class="nav-heading">${esc(group.label)}</div>${group.items.map(([id, symbol, label, , badge]) => `<button class="nav-item ${view === id ? 'active' : ''}" data-nav="${id}" ${view === id ? 'aria-current="page"' : ''}>${icon(symbol)}${esc(label)}${badge ? `<span class="nav-count ${badge === 'achievementCount' ? 'reward-count' : ''}" data-stat="${badge}"></span>` : ''}</button>`).join('')}`,
  ).join('');
}
export function consoleNavigation(view, tr = (text) => text) {
  const current = navigationGroup(view);
  return `<div class="room-console-groups">${NAVIGATION_GROUPS.map((g) => `<button type="button" data-nav="${g.items[0][0]}" class="${g.id === current.id ? 'active' : ''}" aria-pressed="${g.id === current.id}">${esc(tr(g.label))}</button>`).join('')}</div><div class="room-console-sections">${current.items.map(([id, , label]) => `<button type="button" data-nav="${id}" class="${id === view ? 'active' : ''}" ${id === view ? 'aria-current="page"' : ''}>${esc(tr(label))}</button>`).join('')}<span class="room-console-tools"><button type="button" data-modal="settings">${esc(tr('Einstellungen'))}</button><button type="button" data-modal="help">${esc(tr('Handbuch'))}</button></span></div>`;
}
