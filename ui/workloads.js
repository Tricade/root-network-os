import { eventArt } from './event-art.js';
import { workloadArt } from './workload-art.js';

/** workloads UI: reads current state through the controller context. */
export function createWorkloadsUI(ctx) {
  function jobReward(job) {
    return (
      job.reward *
      (1 + (ctx.state.upgrades.market || 0) * 0.1) *
      (job.kind === 'ai' ? ctx.E.getResearchEffects(ctx.state).aiReward : 1)
    );
  }
  function jobsView() {
    const m = ctx.E.getMetrics(ctx.state);
    return (
      ctx.head(
        'Auftragsboard',
        'Wähle Arbeit, die zu deinem Netzwerk passt. Neue Angebote entstehen laufend.',
        `<button class="button ${ctx.state.policies.autocontract ? '' : 'primary'}" data-action="setPolicy" data-key="autocontract" data-value="${!ctx.state.policies.autocontract}">${ctx.icon('automation')}Automatik ${ctx.state.policies.autocontract ? 'an' : 'aktivieren'}</button>`,
      ) +
      `<section class="panel">${ctx.panelHeader('In Bearbeitung', `<span class="tag">${ctx.state.jobs.length} / ${m.jobLimit} AUFTRÄGE</span>`)}<div class="stats-strip"><div><span>GPU belegt / nutzbar</span><strong>${ctx.stat('gpuUsed')} / ${ctx.stat('gpuCapacity')}</strong></div><div><span>Freie Kapazität</span><strong>${ctx.stat('freeCapacity')} CU</strong></div><div><span>Gemeinsamer Durchsatz</span><strong>${ctx.stat('work')} / s</strong></div><div><span>Abgeschlossen</span><strong>${ctx.fmt(ctx.state.counters.jobs)}</strong></div></div>${ctx.jobRows()}</section><div class="section-heading"><h2>Verfügbare Aufträge <span class="muted">/ ${ctx.state.offers.length}</span></h2><p>Angebote bleiben verfügbar · Aktualisierung in ${ctx.stat('offerEta')}</p></div><div class="card-grid">${ctx.state.offers
        .map(
          (j) =>
            `<section class="offer-card">${workloadArt(j.kind)}<div class="offer-card-top"><span class="job-title-icon">${ctx.icon(ctx.kindIcons[j.kind])}</span><span class="tag">${ctx.kindNames[j.kind]}</span></div><h3>${ctx.esc(j.title)}</h3><p>${ctx.esc(ctx.tr(j.client))}</p><p class="policy-explainer">${Object.entries(
              ctx.E.jobResources(j),
            )
              .filter(([, v]) => v > 0)
              .map(([k, v]) => `${ctx.dec(v)} ${k.toUpperCase()}`)
              .join(
                ' · ',
              )}</p><div class="offer-stats"><div><small>Vergütung</small><strong>${ctx.fmt(jobReward(j))} CR</strong></div><div><small>Forschung</small><strong>${ctx.fmt(j.science)} FP</strong></div><div><small>Kapazität</small><strong>${ctx.dec(j.load)} CU${j.kind === 'ai' ? ` · ${j.gpuDemand} GPU` : ''}</strong></div></div><div class="card-actions">${ctx.actionButton('acceptJob', `${ctx.icon('plus')}Annehmen`, { id: j.id }, 'primary')}<button class="icon-button" data-action="declineJob" data-id="${j.id}" aria-label="${ctx.esc(j.title)} ablehnen" title="Angebot ablehnen">${ctx.icon('cross')}</button></div></section>`,
        )
        .join(
          '',
        )}</div>${!ctx.state.offers.length ? `<section class="panel">${ctx.empty('Neue Angebote sind unterwegs', 'Dein Netzwerk wird in Kürze wieder angefragt. Die automatische Vergabe übernimmt auf Wunsch neue passende Aufträge.', '', '', 'timer')}</section>` : ''}<div class="helper-card"><h3>Teile die Arbeit bewusst auf.</h3><p>Aufträge teilen sich freie CPU, RAM, Speicher, Netz und gegebenenfalls GPU/VRAM nach Versorgung deiner Kunden. Mehr parallele Arbeit belegt mehr Ressourcen. Mit einer Priorität unter Automatisierung kannst du lukrative oder forschungsintensive Aufträge vorziehen.</p></div>`
    );
  }

  function automationView() {
    const choice = (key, options) =>
      `<div class="choice-buttons">${Object.entries(options)
        .map(
          ([v, label]) =>
            `<button class="choice-button ${ctx.state.policies[key] === v ? 'active' : ''}" data-action="setPolicy" data-key="${key}" data-value="${v}" aria-pressed="${ctx.state.policies[key] === v}">${label}</button>`,
        )
        .join('')}</div>`;
    return (
      ctx.head(
        'Automatisierung',
        'Lege die Regeln fest. Dein Netzwerk kümmert sich um die Routine.',
        `<span class="tag green">${ctx.icon('automation')}AUTONOMER BETRIEB</span>`,
      ) +
      ctx.customerAutomationView() +
      `<div class="policy-grid"><section class="panel">${ctx.panelHeader('Betriebsregeln', ctx.icon('settings'))}${[
        [
          'autocontract',
          'Automatische Auftragsvergabe',
          'Freie Kapazitäten werden mit passenden Angeboten belegt. Deine Priorität bestimmt die Auswahl.',
        ],
        [
          'autorepair',
          'Automatische Netzwerkpflege',
          'Pflegt das Netz und repariert kleinere Defekte mit Ersatzteilen innerhalb von Budget und Geldreserve. Laufende Pflege kostet zusätzlich Betriebskosten.',
        ],
      ]
        .map(
          ([key, title, desc]) =>
            `<div class="policy-row"><div class="policy-copy"><strong>${title}</strong><p>${desc}</p></div><button class="toggle" role="switch" aria-label="${title}" aria-checked="${ctx.state.policies[key]}" data-action="setPolicy" data-key="${key}" data-value="${!ctx.state.policies[key]}"></button></div>`,
        )
        .join(
          '',
        )}</section><section class="policy-card"><h3>Aktueller Betrieb</h3><div class="status-row"><span>Netto-Betriebsertrag</span><strong class="positive">${ctx.stat('incomeMinute')} CR / min</strong></div><div class="status-row"><span>Laufende Betriebskosten</span><strong>${ctx.stat('upkeepMinute')} CR / min</strong></div><div class="status-row"><span>Gemeinsamer Arbeitsdurchsatz</span><strong>${ctx.stat('work')} / s</strong></div><div class="status-row"><span>Aktuelle Zuverlässigkeit</span><strong>${ctx.stat('reliability')} %</strong></div></section><section class="policy-card"><h3>Globales Energieprofil</h3>${choice('power', ctx.modeNames)}<p class="policy-explainer">Öko reduziert Stromkosten und Durchsatz. Leistung beschleunigt die Arbeit, erzeugt aber mehr Wärme. Das Profil ergänzt den Betriebsmodus jedes einzelnen Servers.</p></section><section class="policy-card"><h3>Priorität der Auftragsarbeit</h3>${choice('priority', { balanced: 'Ausgewogen', income: 'Vergütung', research: 'Forschung' })}<p class="policy-explainer">Verteile die freie Hardwareleistung gleichmäßig oder bevorzuge Aufträge mit höherer Vergütung beziehungsweise mehr Forschung pro Arbeitseinheit.</p></section></div><div class="helper-card"><h3>Ein Netzwerk, das auch ohne dich weiterkommt.</h3><p>Beim nächsten Öffnen werden bis zu 12 Stunden nachgeholt. Deine Regeln gelten auch dann. Ausfälle betreffen ihre angeschlossenen Bereiche; unabhängige Dienste arbeiten weiter. Backups und Reparaturen legst du unter Betrieb & Schutz fest, Budgets und Lieferungen unter Betriebspläne.</p></div>`
    );
  }

  function inboxView() {
    return (
      ctx.head(
        'Entscheidungs-Inbox',
        'Besondere Situationen. Mehrere Wege. Du bestimmst die Richtung.',
        `<span class="tag amber">${ctx.state.events.length} OFFEN</span>`,
      ) +
      `<div class="events-stack">${ctx.state.events.map((e) => `<section class="event-card"><div class="event-summary">${eventArt(e.kind)}<div><span class="tag amber">${ctx.icon('inbox')}NETZWERKEREIGNIS</span><h3>${ctx.esc(e.title)}</h3><p>${ctx.esc(e.description)}</p></div></div><div class="event-choices">${e.choices.map((c, i) => `<button class="event-choice" data-action="resolveEvent" data-id="${e.id}" data-choice="${i}"><strong>${ctx.esc(c.label)} ${ctx.icon('arrow')}</strong><span>${ctx.esc(c.description)}</span></button>`).join('')}</div></section>`).join('') || `<section class="panel">${ctx.empty('Alles geklärt. Dein Netzwerk arbeitet.', 'Besondere Anfragen und Entdeckungen landen hier. Deine nächste Entscheidung kommt, während das Netzwerk wächst.', 'overview', 'Zur Übersicht', 'inbox')}</section>`}</div><div class="helper-card"><h3>Du gibst den Takt vor.</h3><p>Diese Entscheidungen haben kein Zeitlimit. Bis zu drei Ereignisse warten auf dich; der reguläre Betrieb geht währenddessen weiter.</p></div>`
    );
  }

  function logView() {
    const entries = ctx.state.log.filter(
      (l) => ctx.logFilter === 'all' || l.type === ctx.logFilter,
    );
    return (
      ctx.head(
        'Aktivitätslog',
        'Die Geschichte deines Netzwerks. Ein Ereignis nach dem anderen.',
        `<div class="log-filter">${[
          ['all', 'Alle'],
          ['success', 'Fortschritte'],
          ['system', 'Betrieb'],
        ]
          .map(
            ([k, l]) =>
              `<button class="button small ${ctx.logFilter === k ? 'selected' : ''}" data-filter="${k}">${l}</button>`,
          )
          .join('')}</div>`,
      ) +
      `<section class="panel">${ctx.panelHeader('Netzwerkprotokoll', `<span class="tag">LETZTE ${entries.length} EREIGNISSE</span>`)}${entries.map((l) => `<div class="log-detail"><span class="tag ${l.type === 'success' ? 'green' : ''}">${l.type === 'success' ? 'ERFOLG' : 'SYSTEM'}</span><div><p>${ctx.esc(l.message)}</p><small>Betriebszeit ${ctx.clock(l.time)}</small></div></div>`).join('') || ctx.empty('Noch keine Einträge', 'Neue Ereignisse erscheinen hier automatisch.', '', '', 'log')}</section>`
    );
  }
  return { jobsView, jobReward, automationView, inboxView, logView };
}
