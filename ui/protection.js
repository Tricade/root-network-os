/** protection UI: reads current state through the controller context. */
export function createProtectionUI(ctx) {
  function protectionSignature() {
    const r = ctx.E.getResilience(ctx.state);
    return [
      r.incident?.id,
      r.operation?.kind,
      r.operation?.serverId,
      r.backupAt,
      r.servers.map((s) => s.id + ':' + s.status),
      r.parts,
    ].join('|');
  }

  function optionSummary(option) {
    const costs = [
      option.cost ? `${ctx.fmt(option.cost)} CR` : 'Keine Credits',
      option.parts ? `${option.parts} Ersatzteil${option.parts === 1 ? '' : 'e'}` : '',
      option.duration ? ctx.duration(option.duration) : '',
    ];
    const losses = [
      option.researchLoss > 0 ? `${ctx.dec(option.researchLoss)} FP Verlust` : '',
      option.workLoss > 0 ? `${ctx.dec(option.workLoss)} Arbeitseinheiten verloren` : '',
    ].filter(Boolean);
    return costs.filter(Boolean).join(' · ') + (losses.length ? ' · ' + losses.join(' · ') : '');
  }

  function protectionButton(option, action, payload = {}, cls = '') {
    return ctx.actionButton(
      action,
      `${ctx.icon(action === 'createBackup' ? 'storage' : action === 'buyParts' ? 'plus' : 'settings')}${ctx.esc(option.label)}`,
      { ...payload, safety: 'true' },
      cls,
    );
  }

  function protectionOption(option, action, payload = {}, confirm = false) {
    return `<article class="protection-option"><div class="protection-option-heading"><h3>${ctx.esc(option.label)}</h3>${option.key === 'manual' ? '<span class="tag amber">NOTWEG</span>' : ''}</div><p data-option-description>${ctx.esc(option.description)}</p><div class="protection-cost" data-option-cost>${ctx.esc(optionSummary(option))}</div><div class="protection-reason" data-option-reason>${ctx.esc(option.reason || '')}</div>${confirm ? `<button class="button block" data-modal="incident-confirm" data-choice="${ctx.esc(option.key)}" data-safety="true" data-action-quote="resolveIncident" data-id="${ctx.esc(payload.id)}">Folgen prüfen${ctx.icon('arrow')}</button>` : protectionButton(option, action, payload, 'block')}</article>`;
  }

  function incidentPanel(r) {
    if (!r.incident) return '';
    const i = r.incident;
    return `<section class="incident-panel"><div class="incident-heading"><div><span class="tag red">${ctx.icon('shield')}SCHUTZMODUS AKTIV</span><h2>${ctx.esc(i.title)}</h2></div><span class="incident-time">${r.operation ? 'Maßnahme läuft' : 'Entscheidung erforderlich'}</span></div><p>${ctx.esc(i.description)}</p><div class="incident-consequence">${ctx.icon('help')}<span>${ctx.esc(i.consequence)}</span></div><div class="protection-choices">${i.choices.map((o) => protectionOption(o, 'resolveIncident', { id: i.id, choice: o.key }, true)).join('')}</div><p class="containment-note">${r.operation ? 'Weitere Folgeschäden sind gestoppt. Deine gewählte Maßnahme läuft bis zum Abschluss.' : 'Weitere Folgeschäden sind gestoppt. Diese Entscheidung wartet ohne Zeitlimit auf dich.'} Die Folgen deiner Auswahl werden einmalig angewendet.</p></section>`;
  }

  function operationPanel(r) {
    if (!r.operation) return '';
    const op = r.operation;
    return `<section class="panel operation-panel">${ctx.panelHeader(ctx.esc(op.label), '<span class="tag amber">IN ARBEIT</span>')}<div class="panel-body"><div class="operation-status"><span>Verbleibende Zeit: <strong data-stat="operationEta"></strong></span><span data-stat="operationPercent"></span></div><div class="progress-track tall"><div class="progress-fill amber" data-operation-progress style="width:${Math.min(100, (1 - op.remaining / op.total) * 100)}%"></div></div><p class="policy-explainer">Die Maßnahme läuft automatisch bis zum Abschluss. Das Wartungsfenster ist in dieser Zeit belegt.</p></div></section>`;
  }

  function resilienceView() {
    const r = ctx.E.getResilience(ctx.state);
    return (
      ctx.head(
        'Betrieb & Schutz',
        'Gesundheit, Wiederherstellung und Vorsorge für dein Netzwerk.',
        `<span class="tag ${r.incident ? 'red' : 'green'}">${ctx.icon('shield')}${ctx.stat('systemStatus')}</span>`,
      ) +
      incidentPanel(r) +
      operationPanel(r) +
      `<div class="metrics-grid protection-metrics"><div class="metric-card"><div class="metric-label">Server verfügbar${ctx.icon('server')}</div><div class="metric-value">${ctx.stat('onlineServers')}<small>/ ${ctx.state.servers.length}</small></div><div class="metric-footer"><span>${ctx.stat('failedServers')} ausgefallen · ${ctx.stat('repairingServers')} in Reparatur</span></div></div><div class="metric-card"><div class="metric-label">Durchschnittlicher Zustand${ctx.icon('pulse')}</div><div class="metric-value">${ctx.stat('condition')}<small>%</small></div><div class="metric-footer"><span>Datenintegrität ${ctx.stat('integrity')} %</span></div></div><div class="metric-card"><div class="metric-label">Störungsrisiko${ctx.icon('heat')}</div><div class="metric-value">${ctx.stat('riskRate')}<small>/ h</small></div><div class="metric-footer"><span data-stat="riskLabel"></span></div></div><div class="metric-card"><div class="metric-label">Letztes Betriebsbackup${ctx.icon('storage')}</div><div class="metric-value backup-age" data-stat="backupAge"></div><div class="metric-footer"><span>${ctx.stat('protectedResearch')} FP geschützt</span></div></div></div>` +
      `<div class="policy-grid"><section class="panel">${ctx.panelHeader('Betriebsbackup', ctx.icon('storage'))}<div class="panel-body"><p class="policy-explainer" style="margin-top:0">Schützt vorhandene Forschung und laufende Aufträge bis zum Sicherungszeitpunkt. Spätere Änderungen sind erst im nächsten Backup enthalten.</p><div class="status-row"><span>Geschützte Forschung</span><strong>${ctx.stat('protectedResearch')} FP</strong></div><div class="status-row"><span>Gesicherte Aufträge</span><strong data-stat="backupJobs"></strong></div><div class="status-row"><span>Nächste manuelle Sicherung</span><strong data-stat="backupCooldown"></strong></div><div class="protection-option compact"><p data-option-description>${ctx.esc(r.backup.description)}</p><div class="protection-cost" data-option-cost>${ctx.esc(optionSummary(r.backup))}</div><div class="protection-reason" data-option-reason>${ctx.esc(r.backup.reason)}</div>${protectionButton(r.backup, 'createBackup', {}, 'block')}</div></div><div class="policy-row"><div class="policy-copy"><strong>Automatische Betriebsbackups</strong><p>Sicherungen innerhalb deines eigenen Backupbudgets und deiner Geldreserve.</p></div><button class="toggle" role="switch" aria-label="Automatische Betriebsbackups" aria-checked="${ctx.state.policies.autobackup}" data-action="setPolicy" data-key="autobackup" data-value="${!ctx.state.policies.autobackup}"></button></div></section><section class="panel">${ctx.panelHeader('Reserve & Automatik', ctx.icon('settings'))}<div class="panel-body"><div class="status-row"><span>Ersatzteile im Lager</span><strong>${ctx.stat('parts')} / ${ctx.fmt(r.partsCapacity)}</strong></div><div class="protection-option compact"><p data-option-description>${ctx.esc(r.partsPurchase.description)}</p><div class="protection-cost" data-option-cost>${ctx.esc(optionSummary(r.partsPurchase))}</div><div class="protection-reason" data-option-reason>${ctx.esc(r.partsPurchase.reason)}</div>${protectionButton(r.partsPurchase, 'buyParts', {}, 'block')}</div><div class="policy-budget"><p class="policy-explainer">Reparaturen, Backups und Beschaffung haben getrennte Stundenbudgets. Im Betriebsplan kannst du Reserven, Lieferungen und automatische Abläufe einstellen.</p><button class="button block" data-nav="operations">Betriebspläne öffnen</button></div></div><div class="policy-row"><div class="policy-copy"><strong>Automatische Netzwerkpflege</strong><p>Kleinere Reparaturen mit verfügbaren Ersatzteilen. Größere Krisen warten auf dich.</p></div><button class="toggle" role="switch" aria-label="Automatische Netzwerkpflege" aria-checked="${ctx.state.policies.autorepair}" data-action="setPolicy" data-key="autorepair" data-value="${!ctx.state.policies.autorepair}"></button></div></section></div>` +
      `<section class="panel section-spacer">${ctx.panelHeader('Zustand der Server', `<span class="tag">${ctx.state.servers.length} KNOTEN</span>`)}<div class="table-scroll"><table><thead><tr><th>Knoten</th><th>Zustand</th><th>Status</th><th>Maßnahmen</th></tr></thead><tbody>${r.servers
        .map((s) => {
          const server = ctx.state.servers.find((x) => x.id === s.id);
          return `<tr><td><div class="table-name"><span class="server-icon ${s.status !== 'online' ? 'faulted' : ''}">${ctx.icon('server')}</span><div>${ctx.esc(server.name)}<span class="table-secondary">${ctx.esc(s.fault || 'Keine aktive Störung')}</span></div></div></td><td><div class="condition-cell"><span data-condition-label="${s.id}">${ctx.dec(s.condition)} %</span><div class="progress-track"><div data-condition-bar="${s.id}" class="progress-fill ${s.condition < 50 ? 'danger' : s.condition < 80 ? 'amber' : ''}" style="width:${s.condition}%"></div></div></div></td><td><span class="tag ${s.displayStatus === 'failed' ? 'red' : s.displayStatus !== 'online' ? 'amber' : 'green'}">${ctx.serverStatusNames[ctx.R.serverStatus(s.id, s.status)]}</span></td><td><button class="button small" data-modal="repair" data-id="${s.id}">${ctx.icon('settings')}Maßnahmen prüfen</button></td></tr>`;
        })
        .join(
          '',
        )}</tbody></table></div></section><div class="helper-card"><h3>Vorsorge verändert die Folgen.</h3><p>Hohe Leistung, Hitze und Verschleiß erhöhen das Risiko. Eine schnelle Reparatur spart Zeit und hinterlässt mehr Verschleiß. Eine Überholung kostet Ersatzteile und bringt den Zustand vollständig zurück. Backups begrenzen Datenverluste; ihr Alter entscheidet darüber, wie viel erhalten bleibt. Eine zusätzliche JSON-Sicherung deiner gesamten Leitstelle findest du in den Einstellungen.</p></div>`
    );
  }

  function repairModal(id) {
    const r = ctx.E.getResilience(ctx.state),
      s = r.servers.find((x) => x.id === id),
      server = ctx.state.servers.find((x) => x.id === id);
    if (!s || !server) return '<p class="modal-intro">Dieser Server ist nicht mehr vorhanden.</p>';
    return `<p class="modal-intro">${ctx.esc(server.name)} · ${ctx.serverStatusNames[s.status]} · Zustand ${ctx.dec(s.condition)} %. Während der Reparatur liefert dieser Knoten keine Kapazität. Kosten und Ersatzteile werden beim Start verbraucht.</p><div class="protection-choices repair-choices">${s.repairs.map((o) => protectionOption(o, 'repairServer', { id: s.id, method: o.key })).join('')}</div>`;
  }

  function incidentConfirm(choice) {
    const r = ctx.E.getResilience(ctx.state),
      i = r.incident,
      o = i?.choices.find((x) => x.key === choice);
    if (!i || !o) return '<p class="modal-intro">Dieser Vorfall wurde bereits bearbeitet.</p>';
    return `<span class="tag red">${ctx.esc(i.title)}</span><h3 class="resolution-title">${ctx.esc(o.label)}</h3><div class="protection-option compact"><p data-option-description>${ctx.esc(o.description)}</p><div class="protection-cost" data-option-cost>${ctx.esc(optionSummary(o))}</div><div class="resolution-warning">Diese Entscheidung verbraucht die angegebenen Ressourcen und kann ungesicherten Fortschritt dauerhaft verwerfen. Nach dem Start läuft die Maßnahme bis zum Abschluss.</div><div class="protection-reason" data-option-reason>${ctx.esc(o.reason || '')}</div>${protectionButton(o, 'resolveIncident', { id: i.id, choice: o.key }, 'primary block')}</div>`;
  }
  return {
    protectionSignature,
    optionSummary,
    protectionButton,
    protectionOption,
    incidentPanel,
    operationPanel,
    resilienceView,
    repairModal,
    incidentConfirm,
  };
}
