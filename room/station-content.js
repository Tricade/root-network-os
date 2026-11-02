import { NAVIGATION_ITEMS } from '../ui/navigation.js';

const accents = {
  overview: '#a6d876',
  business: '#e7bb70',
  jobs: '#a8db78',
  agents: '#90d6e8',
  research: '#b9a0fa',
  operations: '#e7bb70',
  network: '#a6d876',
  facility: '#edbe7c',
  resilience: '#ee927d',
};
/** Physical desks use the same route titles and business read model as the web dashboard. */
export const STATION_CONFIGS = Object.fromEntries(
  NAVIGATION_ITEMS.map(([id, , title]) => [
    id,
    { title, color: accents[id] || '#a6d876', eyebrow: 'ROOT · NETWORK OS' },
  ]),
);
export function stationRows(view, state, m, resilience, agents, dashboard, format) {
  const { one, fmt, pct, duration } = format,
    customers = dashboard.customers;
  const total = state.servers.length,
    active = dashboard.activeAgents,
    working = dashboard.workingAgents;
  if (view === 'overview')
    return [
      ['AKTIVE VERTRÄGE', fmt(customers.active)],
      ['ANFRAGEN / EINRICHTUNGEN', `${customers.leads.length} / ${customers.settingUp}`],
      [
        'KUNDENVERSORGUNG',
        dashboard.supply === null ? 'Noch keine aktiven Dienste' : pct(dashboard.supply),
      ],
      ['LAUFENDER SALDO / MIN', `${one(dashboard.net)} CR`],
      ['AGENTEN FREI / IM EINSATZ', `${active} / ${working}`],
      ['LABOR', dashboard.project ? dashboard.project.name : 'Labor ist frei'],
    ];
  if (view === 'business')
    return [
      ['AKTIVE VERTRÄGE', fmt(customers.active)],
      ['OFFENE ANFRAGEN', fmt(customers.leads.length)],
      ['EINRICHTUNG / ERWEITERUNG', `${customers.settingUp} / ${dashboard.expansionPromises}`],
      ['KUNDENFÄLLE', fmt(customers.attention)],
      ['KUNDENUMSATZ / MIN', `${one(dashboard.gross)} CR`],
      [
        'KUNDENVERSORGUNG',
        dashboard.supply === null ? 'Noch keine aktiven Dienste' : pct(dashboard.supply),
      ],
    ];
  if (view === 'agents')
    return [
      ['FREI / EINSATZ / WARTUNG', `${active} / ${working} / ${dashboard.absentAgents}`],
      ...state.agents.slice(0, 4).map((a) => {
        const op = agents.agents.find((op) => op.id === a.id);
        return [a.name, op.absent ? 'Selbstwartung' : op.assignment?.label || 'Im Normalbetrieb'];
      }),
      ['NETZWERKEFFEKTE', fmt(agents.effects.length)],
    ];
  if (view === 'research')
    return [
      ['FORSCHUNGSPUNKTE', `${one(state.research)} FP`],
      ['ZUWACHS / MIN', `${one(m.researchPerSecond * 60)} FP`],
      ['LABOR', dashboard.project ? dashboard.project.name : 'Labor ist frei'],
      [
        'VERBLEIBENDE LABORZEIT',
        dashboard.project
          ? duration(dashboard.project.remaining)
          : 'Nächsten Forschungszweig wählen',
      ],
      ['TECHNOLOGIEN ABGESCHLOSSEN', fmt(state.lab.owned.length)],
      [
        'LABORSTATUS',
        !dashboard.project
          ? 'Bereit'
          : !m.onlineServers || resilience.safetyMode
            ? 'Pausiert'
            : 'Forschung läuft',
      ],
    ];
  if (view === 'operations')
    return [
      ['BETRIEBSPLÄNE', state.operations.paused ? 'Pausiert' : 'Aktiv'],
      ['GEPLANTE MASSNAHMEN', fmt(dashboard.queue)],
      ['ERSATZTEILE IM LAGER', fmt(resilience.parts)],
      ['LIEFERUNGEN UNTERWEGS', fmt(dashboard.deliveries)],
      [
        'RACKWARTUNG',
        dashboard.preventive?.operation
          ? duration(dashboard.preventive.operation.remaining)
          : dashboard.preventive?.schedule
            ? 'Terminiert'
            : 'Keine geplant',
      ],
      ['AGENTEN FREI / IM EINSATZ', `${active} / ${working}`],
    ];
  if (view === 'jobs')
    return [
      ['PROJEKTE / ANGEBOTE', `${state.jobs.length} / ${state.offers.length}`],
      ['PROJEKTDURCHSATZ / MIN', one(m.workPerSecond * 60)],
      ['GPU BELEGT / VERFÜGBAR', `${one(m.gpuUsed)} / ${one(m.gpuCapacity)}`],
      ...state.jobs.slice(0, 3).map((j) => [j.title, pct(j.work / Math.max(1, j.totalWork))]),
    ];
  if (view === 'resilience')
    return [
      ['INTEGRITÄT', pct(resilience.integrity / 100)],
      ['STÖRUNGSRISIKO', `${one(m.riskPerHour)} % / h`],
      ['SERVER ONLINE / AUSGEFALLEN', `${resilience.online} / ${resilience.failed}`],
      ['ERSATZTEILE', fmt(resilience.parts)],
      ['VORFALL', resilience.incident?.title || 'Kein offener Vorfall'],
    ];
  return [
    ['SERVER ONLINE / GESAMT', `${m.onlineServers} / ${total}`],
    ['LAST / KAPAZITÄT', `${pct(m.load)} / ${one(m.capacity)}`],
    ['LEISTUNGSAUFNAHME', `${one(m.powerW / 1000)} kW`],
    ['WÄRMSTES RACK', `${one(m.maxRackTemperature)} °C`],
    ['GPU BELEGT / VERFÜGBAR', `${one(m.gpuUsed)} / ${one(m.gpuCapacity)}`],
    ['SEKTOR', fmt(state.sector)],
  ];
}
