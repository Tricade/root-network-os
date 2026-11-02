import '../brand.js';
const BRAND = globalThis.ROOTBrand;

/** dialogs UI: reads current state through the controller context. */
export function createDialogsUI(ctx) {
  function shop(type) {
    if (type === 'servers') return ctx.R.shop();
    return ctx.marketModal();
  }

  function sectorModal() {
    const m = ctx.E.getMetrics(ctx.state),
      goal = Math.min(m.serverLimit, 2 + ctx.state.sector),
      goalJobs = ctx.state.sector * 3;
    return `<p class="modal-intro">Erschließe Sektor ${ctx.state.sector + 1}. Dein bestehendes Netzwerk bleibt vollständig erhalten. Neue Verträge wachsen mit deinem Sektor; die nächsten Ausbauschritte werden anspruchsvoller.</p><div class="breakdown"><div class="status-row"><span>Server im Betrieb</span><strong class="${ctx.state.servers.length >= goal ? 'positive' : ''}">${ctx.state.servers.length} / ${goal}</strong></div><div class="status-row"><span>Aufträge insgesamt abgeschlossen</span><strong class="${ctx.state.counters.jobs >= goalJobs ? 'positive' : ''}">${ctx.state.counters.jobs} / ${goalJobs}</strong></div><div class="status-row"><span>Erschließungskosten</span><strong>${ctx.fmt(m.sectorCost)} CR</strong></div><div class="status-row"><span>Danach: Server / Agenten</span><strong>${ctx.E.getFacilityLayout({ ...ctx.state, sector: ctx.state.sector + 1 }).serverLimit} / ${Math.min(12, 3 + (ctx.state.sector + 1) * 2)} Plätze</strong></div></div>${ctx.actionButton('expandSector', `${ctx.icon('expand')}Sektor ${ctx.state.sector + 1} erschließen · ${ctx.fmt(m.sectorCost)} CR`, {}, 'primary block')}<p class="policy-explainer">Auch nach dem Ausbau aller Plätze kannst du dein Netzwerk über Stufen, Forschung und weitere Sektoren weiterentwickeln.</p>`;
  }

  function helpModal() {
    const help = [
      [
        'globe',
        'Begehe deinen Serverraum',
        'Raum betreten öffnet die Ego-Ansicht. WASD bewegt dich, Shift lässt dich sprinten, Maus oder Pfeiltasten links/rechts drehen den Blick. Am Rack öffnet E zuerst die Tür und danach die freiliegende Hardware. E an der Tür schließt sie. Raumtüren lassen sich von beiden Seiten bedienen und schließen nach dem Durchgehen. Escape führt zurück. Ohne Mausbindung halte die Maustaste zum Umsehen gedrückt. Die Geräte-Liste führt auch direkt zu jedem Server. Die Monitore an den Leitständen und die Konsole öffnen alle Verwaltungsbereiche direkt im Raum. Escape schließt zuerst den Dialog, dann die Konsole; Weboberfläche beendet den Rundgang.',
      ],
      [
        'server',
        '1. Plane dein Rechenzentrum',
        'Räume, Untergeschosse und Technikräume baust du einzeln gegen Credits. Ein Bautrupp bearbeitet jeweils ein Projekt; neue Flächen werden erst nach Abschluss verfügbar. Racks und Anlagen kaufst du anschließend separat.',
      ],
      [
        'server',
        '2. Richte deine Hardware ein',
        'Server belegen echte Höheneinheiten in deinen Racks. Wähle Geräte, Ports, Kühlung und Stromversorgung direkt im Rechenzentrum aus. Ein freier Einbauplatz öffnet die passende Hardwareauswahl.',
      ],
      [
        'agents',
        '3. Gib Agenten einen Schwerpunkt',
        'Agenten unterstützen Projekte, Forschung, Wartung und Teamleitung. Rolle, Stufe und Schwerpunkt bestimmen den Beitrag. Prüfe vor einem Upgrade die tatsächliche Wirkung und laufenden Kosten.',
      ],
      [
        'jobs',
        '4. Wähle passende Aufträge',
        'Aktive Dienste finanzieren den laufenden Betrieb. Projekte bringen bei Abschluss Credits, Forschung und Ansehen. Nicht belegte Hardware und Agenten verursachen weiterhin Kosten.',
      ],
      [
        'jobs',
        'Kundenbetrieb planen',
        'Kundenanfragen kommen automatisch. Zusagen reservieren Ressourcen und kosten Einrichtung. Ein Agent muss den Dienst erst bereitstellen. Vertragslaufzeiten beginnen danach; Versorgung, Betreuung und geschäftliche Gründe beeinflussen Verlängerung oder Kündigung.',
      ],
      [
        'automation',
        '5. Lass die Routine laufen',
        'Aktiviere die automatische Vergabe. Sie nimmt passende Angebote an und beachtet deine Priorität. So arbeitet das Netzwerk auch während deiner Abwesenheit.',
      ],
      [
        'research',
        '6. Investiere in Entwicklung',
        'Ein bezahltes Laborprojekt läuft jeweils über Zeit und bindet zehn Prozent des Projektdurchsatzes. Forschungszweige haben Voraussetzungen. Die Wirkung beginnt bei Abschluss; Abbruch erstattet keine Punkte. Bisherige Forschungsstufen bleiben erhalten. Erfolge haben eine eigene Seite.',
      ],
      [
        'shield',
        '7. Schütze deinen Betrieb',
        'Verschleiß und Hitze können Server ausfallen lassen. Reparaturen kosten Zeit und Ressourcen. Betriebsbackups sichern Forschung und laufende Arbeit; große Krisen warten im Schutzmodus auf dich.',
      ],
      [
        'agents',
        '8. Plane gezielte Einsätze',
        'Diagnose und Optimierung helfen dem ganzen Netz. Forschung liefert Punkte nach Abschluss. Währenddessen fehlt der Agent im Normalbetrieb; anschließend gilt eine Erholungszeit.',
      ],
      [
        'globe',
        '9. Beachte die Verbindungen',
        'Abgeschaltete Server und getrennte Switch-Ports liefern keine Kapazität. Ein Neustart oder Umsetzen dauert 30 Sekunden. Rack-Umbauten legen das betroffene Rack für 45–90 Sekunden still. Strom, Kühlung und Uplink begrenzen den Durchsatz; die Anzeigen zeigen dir die Engpässe.',
      ],
      [
        'cpu',
        'KI braucht eigene Hardware',
        'Der A480 belegt 4 HE und liefert vier GPUs mit 320 GB VRAM. Inferenz- und Trainingsaufträge brauchen freie GPU-Kapazität zusätzlich zu CU. Ausfälle, Porttrennung, Strom-, Kühlungs- und Uplink-Engpässe begrenzen diese Leistung. Ein stärkerer KI-Auftrag bindet mehr GPUs und bringt entsprechend mehr Arbeit, Vergütung und Forschung.',
      ],
      [
        'inbox',
        '10. Komm in deinem Tempo zurück',
        'Ereignisse warten ohne Zeitlimit. Bis zu 12 Stunden Fortschritt werden nachgeholt. ROOT speichert regelmäßig lokal; Export sichert einen Stand zusätzlich.',
      ],
    ];
    return `<p class="modal-intro">ROOT ist deine eigene Netzwerk-Leitstelle. Es gibt keinen Zeitdruck: Gute Entscheidungen, ein durchdachter Ausbau und passende Regeln bringen dich weiter.</p><div class="help-grid">${help.map(([i, t, d]) => `<div class="help-item">${ctx.icon(i)}<h3>${t}</h3><p>${d}</p></div>`).join('')}</div><p class="keyboard-hint">TASTATUR · 1–9: Bereiche wechseln · ?: Hilfe · Escape: Schließen</p>`;
  }

  function settingsModal() {
    const desktop = ctx.desktopSettings?.() || '';
    return `<div class="settings-row"><h3>Sprache / Language</h3><p>Weboberfläche und Raumkonsole</p><label class="field-label" for="root-language">Sprache / Language</label><select class="select" id="root-language" data-change="language"><option value="de" ${ctx.I18N.getLanguage() === 'de' ? 'selected' : ''}>Deutsch</option><option value="en" ${ctx.I18N.getLanguage() === 'en' ? 'selected' : ''}>English</option></select></div>${desktop}<div class="settings-row"><h3>Dein Netzwerk</h3><p>Ein eigener Name für deine Leitstelle.</p><form id="rename-form" class="input-row"><input class="input" id="network-name" aria-label="Netzwerkname" maxlength="36" minlength="2" required value="${ctx.esc(ctx.state.networkName)}"><button class="button" type="submit">Speichern</button></form></div><div class="settings-row"><h3>Netzwerkstand & Sicherung</h3><p>${desktop ? ctx.desktopSaveNote() : 'Automatisches Speichern alle 15 Sekunden und nach jeder Entscheidung. Die lokale Datei liegt im ROOT-Ordner unter data/save.json. Ein Export enthält deinen vollständigen Fortschritt. Das Betriebsbackup unter „Betrieb & Schutz“ schützt dagegen gezielt vor Datenkorruption im Netzwerk.'}</p><div class="settings-actions"><button class="button" data-command="export">${ctx.icon('download')}Sicherung exportieren</button><button class="button ghost" data-command="import">${ctx.icon('upload')}Sicherung importieren</button><button class="button ghost" data-command="save">${ctx.icon('check')}Jetzt speichern</button></div></div><div class="settings-row"><h3>Zugang zum Cyberbunker</h3><p>Eine kurze Kamerafahrt führt von außen durch die Sicherheitsschleusen. Danach öffnet sich die Netzwerkübersicht. Den Rundgang startest du mit „Raum betreten“. Die Einfahrt läuft beim ersten Start pro Browser-Tab. Nach F5 bleibt dein letzter Standort erhalten. Reduzierte Animationen werden berücksichtigt.</p><label class="field-label"><input type="checkbox" data-change="arrival" ${ctx.storageGet('root.arrival.enabled') !== '0' ? 'checked' : ''}> Einfahrt beim Start anzeigen</label><button class="button ghost" data-command="replay-arrival">Einfahrt ansehen</button></div><div class="settings-row"><h3>Neues Netzwerk</h3>${ctx.storageGet('root.conflict.save') ? '<button class="button ghost" data-command="export-conflict">Abweichende Browserkopie exportieren</button>' : ''}<p>Beginne mit einer neuen Ausgangslage. Dein bisheriger Stand wird vorher automatisch als Datei exportiert.</p><button class="button danger" data-modal="reset">${ctx.icon('refresh')}Neu anfangen</button></div><div class="settings-row"><h3>${ctx.esc(BRAND.title)} · Version 1.5.1</h3><p>${desktop ? ctx.desktopAppNote() : 'Deine lokale Netzwerk-Leitstelle. Alle Server und Agenten sind Teil der Simulation. Fortschritt während der Abwesenheit: maximal 12 Stunden. Beende zum Schließen einfach den Browser-Tab.'}</p></div>`;
  }

  function openModal(type, extra) {
    if (!ctx.modal) ctx.lastFocus = document.activeElement;
    ctx.modal = { type, extra };
    const titles = {
      servers: 'Dein Netzwerk erweitern',
      agents: 'Arbeitsamt',
      notifications: 'Benachrichtigungen',
      sector: 'Nächsten Sektor erschließen',
      help: 'Willkommen bei ROOT',
      settings: 'Einstellungen',
      offline: 'Abwesenheitsbericht',
      reset: 'Ein neues Netzwerk beginnen',
      import: 'Sicherung wiederherstellen',
      repair: 'Reparatur planen',
      'incident-confirm': 'Folgen deiner Entscheidung',
      'agent-task': 'Agent gezielt einsetzen',
      'agent-upgrade': 'Agent-Upgrade prüfen',
      'personnel-confirm': 'Personalentscheidung prüfen',
      'hardware-shop': 'Hardware einbauen',
      'hardware-move': 'Umsetzen / Umpatchen',
      'hardware-confirm': 'Infrastruktur ändern',
      'business-confirm': 'Betriebsauftrag prüfen',
      'research-confirm': extra?.cancel ? 'Forschungsentscheidung prüfen' : 'Forschungsdetails',
      'operations-confirm': 'Betriebsauftrag prüfen',
      'growth-confirm': 'Kundenerweiterung prüfen',
      'preventive-confirm': 'Rackwartung prüfen',
    };
    let content = '';
    if (type === 'notifications') content = ctx.notificationModal();
    else if (type === 'agent-upgrade') content = ctx.agentUpgradeModal(extra);
    else if (type === 'research-confirm') content = ctx.researchConfirm(extra);
    else if (type === 'business-confirm') content = ctx.businessConfirm(extra);
    else if (type === 'operations-confirm') content = ctx.operationsConfirm(extra);
    else if (type === 'growth-confirm') content = ctx.growthConfirm(extra);
    else if (type === 'preventive-confirm') content = ctx.preventiveConfirm(extra);
    else if (type === 'personnel-confirm') content = ctx.personnelConfirm(extra);
    else if (type === 'servers' || type === 'agents') content = shop(type);
    else if (type.startsWith('hardware-')) content = ctx.R.modal(type, extra);
    else if (type === 'sector') content = sectorModal();
    else if (type === 'repair') content = ctx.repairModal(extra);
    else if (type === 'incident-confirm') content = ctx.incidentConfirm(extra);
    else if (type === 'agent-task') content = ctx.agentTaskModal(extra);
    else if (type === 'help') content = helpModal();
    else if (type === 'settings') content = settingsModal();
    else if (type === 'offline') {
      const r = extra;
      content = `<span class="tag green">${ctx.icon('automation')}AUTONOMER BETRIEB</span><div class="offline-title">Willkommen zurück.</div><p class="modal-intro">Während deiner Abwesenheit hat ROOT ${ctx.duration(r.seconds)} weitergearbeitet.${r.capped ? ' Berücksichtigt wurden maximal 12 Stunden.' : ''}</p><div class="offline-grid"><div class="offline-stat${r.credits < 0 ? ' negative' : ''}"><strong>${r.credits > 0 ? '+' : ''}${ctx.compact(r.credits)}</strong><span>Änderung des Guthabens</span></div><div class="offline-stat"><strong>${r.research > 0 ? '+' : ''}${ctx.compact(r.research)}</strong><span>Forschungspunkte</span></div><div class="offline-stat"><strong>${ctx.fmt(r.jobsCompleted)}</strong><span>Aufträge abgeschlossen</span></div></div><p class="policy-explainer">Der Saldo enthält Einnahmen, Betriebskosten und automatische Ausgaben während deiner Abwesenheit.</p>${ctx.E.getResilience(ctx.state).incident ? `<div class="modal-alert">${ctx.esc(ctx.E.getResilience(ctx.state).incident.title)}: Betroffene Geräte und Versorgung stehen im Vorfallbericht.</div><button class="button primary block" data-nav="resilience">Vorfall ansehen${ctx.icon('arrow')}</button>` : ''}<button class="button ${ctx.E.getResilience(ctx.state).incident ? 'ghost' : 'primary'} block" data-command="close">Zur Leitstelle${ctx.icon('arrow')}</button>`;
    } else if (type === 'reset')
      content = `<p class="modal-intro">Du startest mit 800 Credits, einem Server und zwei Agenten. Vorher wird dein bisheriger Netzwerkstand als JSON-Datei exportiert. Über „Importieren“ kannst du jederzeit zu ihm zurückkehren.</p><button class="button danger block" data-command="reset-confirm">${ctx.icon('refresh')}Stand exportieren & neu beginnen</button>`;
    else if (type === 'import')
      content = `<p class="modal-intro">Der Netzwerkstand wurde geprüft. Wiederherstellen ersetzt den aktuellen Fortschritt. Dieser wird zuvor als Datei exportiert.</p><div class="breakdown"><div class="status-row"><span>Netzwerk</span><strong>${ctx.esc(ctx.importing.networkName)}</strong></div><div class="status-row"><span>Sektor / Server / Agenten</span><strong>${ctx.importing.sector} / ${ctx.importing.servers.length} / ${ctx.importing.agents.length}</strong></div><div class="status-row"><span>Credits</span><strong>${ctx.fmt(ctx.importing.credits)} CR</strong></div></div><button class="button primary block" data-command="import-confirm">${ctx.icon('upload')}Sicherung wiederherstellen</button>`;
    ctx.$('#modal-root').innerHTML =
      `<div class="modal-backdrop" data-backdrop="true"><section class="modal ${['servers', 'agents', 'repair', 'agent-task', 'hardware-shop', 'hardware-move'].includes(type) ? 'wide' : ''} ${type === 'research-confirm' && !extra?.cancel ? 'research-dialog' : type === 'notifications' ? 'notification-dialog' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><div class="modal-header"><h2 id="modal-title">${titles[type] || 'ROOT'}</h2><button class="icon-button" data-command="close" aria-label="Dialog schließen">${ctx.icon('cross')}</button></div><div class="modal-body">${content}</div></section></div>`;
    window.ROOTI18N?.localize?.(ctx.$('#modal-root'));
    ctx.updateDesktopControls?.();
    ctx.$('#app').inert = true;
    document.body.style.overflow = 'hidden';
    ctx.updateLive();
    ctx.$('.modal').focus();
  }

  function closeModal() {
    if (!ctx.modal) return;
    const returnNode = ctx.modal.type === 'research-confirm' && ctx.modal.extra?.returnNode;
    ctx.modal = null;
    ctx.$('#modal-root').innerHTML = '';
    ctx.$('#app').inert = false;
    document.body.style.overflow = '';
    // The map can rerender while a lab project completes behind the dialog.
    const restored = returnNode && ctx.restoreResearchFocus?.(returnNode);
    if (!restored && ctx.lastFocus?.isConnected) ctx.lastFocus.focus();
    if (ctx.view === 'overview' && !ctx.Room.isInRoom()) ctx.Room.startArrival();
  }
  return { shop, sectorModal, helpModal, settingsModal, openModal, closeModal };
}
