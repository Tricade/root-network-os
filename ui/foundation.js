import { NAVIGATION_ITEMS } from './navigation.js';
/** Shared formatting and icon data; no mutable simulation state. */
export function createUIFoundation(I18N) {
  const tr = (text) => I18N?.translate(String(text)) || String(text);
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const numberFormats = Object.fromEntries(
    ['de', 'en'].map((lang) => [
      lang,
      [
        new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }),
        new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      ],
    ]),
  );
  const fmt = (n) =>
    Number.isFinite(n) ? numberFormats[I18N?.getLanguage() || 'de'][0].format(n) : '—';
  const dec = (n) =>
    Number.isFinite(n) ? numberFormats[I18N?.getLanguage() || 'de'][1].format(n) : '—';
  const compact = (n) =>
    n >= 1e9
      ? dec(n / 1e9) + (I18N?.getLanguage() === 'en' ? ' B' : ' Mrd.')
      : n >= 1e6
        ? dec(n / 1e6) + (I18N?.getLanguage() === 'en' ? ' M' : ' Mio.')
        : fmt(n);
  const duration = (seconds) => {
    const s = Math.max(0, Math.ceil(seconds));
    return s >= 3600
      ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`
      : s >= 60
        ? `${Math.floor(s / 60)} min ${s % 60} s`
        : `${s} s`;
  };
  const clock = (seconds) => {
    const n = Math.floor(seconds);
    return [Math.floor(n / 3600), Math.floor(n / 60) % 60, n % 60]
      .map((x) => String(x).padStart(2, '0'))
      .join(':');
  };
  const iconPaths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    server:
      '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.1M7 17.5h.1M12 6.5h5M12 17.5h5"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 1v5m6-5v5M9 18v5m6-5v5M1 9h5m-5 6h5m12-6h5m-5 6h5"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
    agents:
      '<path d="M8 5V3m8 2V3"/><rect x="3" y="5" width="18" height="15" rx="4"/><path d="M8 10h.1M16 10h.1M8 15h8M1 11h2m18 0h2"/>',
    jobs: '<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M8 6V3h8v3M3 12h18M10 12v3h4v-3"/>',
    research:
      '<path d="M9 3h6m-5 0v6l-6 10q-1 2 2 2h12q3 0 2-2L14 9V3M7 15h10"/><path d="M10 18h.1M14 12h.1"/>',
    automation: '<path d="M13 2 4 14h7l-1 8 10-13h-7z"/>',
    log: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1"/>',
    settings:
      '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.3 8.5a3 3 0 0 1 5.4 1.2c0 2-2.7 2-2.7 4M12 17h.1"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    cross: '<path d="m6 6 12 12M6 18 18 6"/>',
    coins:
      '<circle cx="12" cy="12" r="9"/><path d="M14.5 8.5h-3a2 2 0 0 0 0 4h1a2 2 0 0 1 0 4h-3M12 6v2m0 8v2"/>',
    pulse: '<path d="M2 12h5l3-8 4 16 3-8h5"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6z"/><path d="m8 12 3 3 5-6"/>',
    globe:
      '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
    inbox: '<path d="m6 4-4 10v6h20v-6L18 4zM2 14h6l2 3h4l2-3h6"/>',
    layers: '<path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5"/>',
    storage:
      '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
    bell: '<path d="M5 17v-7a7 7 0 0 1 14 0v7l2 2H3zM9 22h6"/>',
    expand: '<path d="M14 3h7v7m0-7-8 8M3 14v7h7m-7 0 8-8"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
    refresh: '<path d="M20 7V2l-3 3a8 8 0 1 0 3 12M20 7h-5"/>',
    trophy: '<path d="M8 3h8v7a4 4 0 0 1-8 0zM8 5H3v3q0 5 5 5m8-8h5v3q0 5-5 5M12 14v7m-5 0h10"/>',
    spark: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v5l3 2M9 2h6m-3 0v3m6 2 2-2"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    home: '<path d="m3 10 9-7 9 7v11h-7v-7h-4v7H3z"/>',
    leaf: '<path d="M20 3q2 13-6 16C4 22 0 9 9 6q5-1 11-3ZM5 21l10-10"/>',
    heat: '<path d="M10 4a2 2 0 0 1 4 0v10a4 4 0 1 1-4 0zM12 9v8"/>',
  };
  const icon = (name, cls = '') =>
    `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.grid}</svg>`;
  const navs = NAVIGATION_ITEMS.map(([id, icon, label]) => [id, icon, label]);
  const focusNames = {
    income: 'Auftragsarbeit',
    research: 'Forschung',
    maintenance: 'Netzwerkpflege',
  };
  const modeNames = { balanced: 'Ausgewogen', performance: 'Leistung', eco: 'Öko' };
  const kindNames = {
    monitoring: 'Monitoring',
    migration: 'Migration',
    audit: 'Audit',
    optimization: 'Optimierung',
    recovery: 'Wiederherstellung',
    research: 'Forschung',
    ai: 'KI-Workload',
    database: 'Datenbanken',
    backup: 'Backup-Prüfung',
    loadtest: 'Lasttest',
    archive: 'Archivierung',
    containers: 'Bereitstellung',
    security: 'Sicherheitsanalyse',
    replication: 'Replikation',
    rendering: 'Rendering',
  };
  const kindIcons = {
    monitoring: 'pulse',
    migration: 'layers',
    audit: 'shield',
    optimization: 'automation',
    recovery: 'storage',
    research: 'research',
    ai: 'cpu',
    database: 'storage',
    backup: 'shield',
    loadtest: 'pulse',
    archive: 'storage',
    containers: 'layers',
    security: 'shield',
    replication: 'globe',
    rendering: 'cpu',
  };
  const roleClass = (role) => (role === 'analyst' ? 'blue' : role === 'engineer' ? 'amber' : '');

  return {
    tr,
    $,
    $$,
    esc,
    fmt,
    dec,
    compact,
    duration,
    clock,
    icon,
    navs,
    focusNames,
    modeNames,
    kindNames,
    kindIcons,
    roleClass,
  };
}
