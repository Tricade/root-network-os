/** Presentation policy stays local: hiding a notice never dismisses its underlying work. */
export const NOTIFICATION_TYPES = {
  incidents: { label: 'Störungen & Versorgung', icon: 'shield', target: 'resilience' },
  customers: { label: 'Kunden & Verträge', icon: 'jobs', target: 'business' },
  decisions: { label: 'Entscheidungen', icon: 'pulse', target: 'inbox' },
  rewards: { label: 'Erfolge', icon: 'trophy', target: 'achievements' },
  research: { label: 'Forschung', icon: 'research', target: 'research' },
  upgrades: { label: 'Hardware-Ausbau', icon: 'server', target: 'network' },
  construction: { label: 'Baufortschritt', icon: 'layers', target: 'facility' },
  maintenance: { label: 'Wartung & Backups', icon: 'settings', target: 'operations' },
  jobs: { label: 'Auftragsabschlüsse', icon: 'jobs', target: 'jobs' },
  activity: { label: 'Sonstige Aktivität', icon: 'bell', target: 'log' },
};
export function notificationPreferences(input) {
  return Object.fromEntries(
    Object.keys(NOTIFICATION_TYPES).map((key) => {
      const defaults = {
        visible: true,
        badge: !['jobs', 'maintenance'].includes(key),
        toast: !['jobs', 'maintenance', 'customers', 'decisions', 'activity'].includes(key),
      };
      return [
        key,
        Object.fromEntries(
          Object.entries(defaults).map(([option, fallback]) => [
            option,
            typeof input?.[key]?.[option] === 'boolean' ? input[key][option] : fallback,
          ]),
        ),
      ];
    }),
  );
}
export function notificationType(entry) {
  const groups = {
    incident: 'incidents',
    repairs: 'incidents',
    supply: 'incidents',
    margin: 'incidents',
    notices: 'customers',
    support: 'customers',
    staff: 'customers',
    enquiries: 'customers',
    growth: 'customers',
    'growth-due': 'customers',
    plan: 'maintenance',
  };
  const key = groups[entry.group] || entry.group || entry.category;
  if (Object.hasOwn(NOTIFICATION_TYPES, key)) return key;
  if (entry.error) return 'incidents';
  if (entry.target) {
    const found = Object.entries(NOTIFICATION_TYPES).find(
      ([, type]) => type.target === entry.target,
    );
    if (found) return found[0];
  }
  // Only canonical legacy log patterns are inferred. New logs carry an explicit category.
  const message = entry.message || '';
  if (/ für .+ abgeschlossen: \d+ Credits\.$/.test(message)) return 'jobs';
  if (message.startsWith('Forschung abgeschlossen:')) return 'research';
  if (
    /auf Stufe \d+ ausgebaut\.$/.test(message) ||
    message.startsWith('Rack-Wartungsfenster abgeschlossen:')
  )
    return 'upgrades';
  if (
    /^(Automatische Betriebssicherung|Betriebssicherung abgeschlossen|Wartung angekündigt|Angekündigtes Rack-Wartungsfenster)/.test(
      message,
    )
  )
    return 'maintenance';
  return 'activity';
}
export function notificationPreferencesMarkup(ctx, saved) {
  const t = (s) => ctx.esc(ctx.tr(s));
  return `<p class="notification-note">${t('Lege je Typ fest, was in der Glocke erscheint, den Zähler erhöht oder automatisch als Pop-up unten rechts erscheint. Direkte Rückmeldungen auf deine Eingaben bleiben sichtbar, ebenso offene Aufgaben im Dashboard.')}</p><div class="notification-preferences">${Object.entries(
    NOTIFICATION_TYPES,
  )
    .map(
      ([type, def]) =>
        `<fieldset><legend>${ctx.icon(def.icon)}${t(def.label)}</legend><div>${Object.entries({
          visible: 'Anzeigen',
          badge: 'Glockenzähler',
          toast: 'Pop-up',
        })
          .map(
            ([key, label]) =>
              `<label><input type="checkbox" data-notification-preference="${type}:${key}" ${saved[type][key] ? 'checked' : ''}>${t(label)}</label>`,
          )
          .join('')}</div></fieldset>`,
    )
    .join('')}</div>`;
}
