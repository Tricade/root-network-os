/** Robot recruitment, traits and automatic self-maintenance. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root) root.RootPersonnelEnglish = factory;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (translate) {
  return {
    pairs: [
      ['Automatik aktivieren', 'Enable automation'],
      ['Automatik an', 'Automation on'],
      [
        'Angebote bleiben verfügbar · Aktualisierung in',
        'Offers remain available · Next update in',
      ],
      [
        'Aufträge teilen sich freie CPU, RAM, Speicher, Netz und gegebenenfalls GPU/VRAM nach Versorgung deiner Kunden. Mehr parallele Arbeit belegt mehr Ressourcen. Mit einer Priorität unter Automatisierung kannst du lukrative oder forschungsintensive Aufträge vorziehen.',
        'Jobs share the CPU, RAM, storage, network and any GPU/VRAM left after serving your customers. More parallel work reserves more resources. Use Automation priorities to favor profitable jobs or research.',
      ],
      ['Selbstwartung', 'Self-maintenance'],
      ['Im Einsatz', 'On assignment'],
      [
        'Ein Team betreut 24 Einheiten. Erfahrene Teamleitungen erhöhen die Betreuung; sie können jeweils nur einen Raum leiten. Personal verursacht laufende Kosten. Während eines Einsatzes oder einer Selbstwartung pausiert der Teamleitungsbonus.',
        'Each crew supports 24 units. Experienced team leaders increase coverage and can lead one room each. Staff have running costs. The leadership bonus pauses during assignments or self-maintenance.',
      ],
      ['Arbeitsamt', 'Recruitment agency'],
      ['Zum Arbeitsamt', 'Visit recruitment agency'],
      ['Personalentscheidung prüfen', 'Review agent decision'],
      [
        'Stärken nutzen, Eigenheiten einplanen und dein Team gezielt einsetzen.',
        'Use strengths, plan around quirks and deploy your team with purpose.',
      ],
      [
        'Wähle die passende Einheit. Stärken, Eigenheiten und Betriebskosten stehen vor der Aktivierung fest.',
        'Choose the right unit. Strengths, quirks and running costs are visible before activation.',
      ],
      ['Neue Bewerbungen in', 'New applicants in'],
      ['6 Bewerbungen · alle 30 Minuten', '6 applicants · every 30 minutes'],
      ['Eine Einheit dauerhaft vormerken', 'Keep one unit on your shortlist'],
      ['Teamplätze', 'team slots'],
      ['Bewerbung vormerken', 'Shortlist applicant'],
      ['Vormerkung entfernen', 'Remove from shortlist'],
      ['Profil prüfen', 'Review profile'],
      ['Einstellung einmalig', 'One-time activation'],
      ['Betriebskosten / Stunde', 'Running costs / hour'],
      ['Stufe 1', 'Level 1'],
      ['Bestandsteam', 'Existing team'],
      [
        'Bisherige Fähigkeiten bleiben erhalten. Keine zusätzlichen Nachteile.',
        'Existing abilities are preserved. No additional drawbacks.',
      ],
      [
        'Selbstwartung endet automatisch. Betriebskosten laufen weiter; bezahlte Einsätze pausieren ohne Verlust der Belohnung. Die ersten zwei Stunden sind geschützt.',
        'Self-maintenance ends automatically. Running costs continue; paid assignments pause without losing their rewards. The first two hours are protected.',
      ],
      [
        'Die Aktivierung kostet einmalig Credits. Danach fallen laufende Betriebskosten an, auch bei Selbstwartung. Fähigkeiten wirken auf den eigenen Beitrag und skalieren mit der Stufe.',
        'Activation has a one-time credit cost. Running costs then continue, including during self-maintenance. Abilities affect this unit’s own contribution and scale with its level.',
      ],
      [
        'Einstellungskosten werden nicht erstattet. Ein Teamleitungsplatz wird frei. Laufende Einsätze müssen zuerst abgeschlossen werden.',
        'Activation costs are not refunded. Any team leadership post is vacated. Active assignments must finish first.',
      ],
      ['Verbindlich einstellen', 'Confirm activation'],
      ['Agent ausmustern', 'Retire agent'],
      ['Prozessprofi', 'Process expert'],
      ['Eigener Beitrag zum Auftragsdurchsatz +18 %.', 'Own contribution to job throughput +18%.'],
      ['Wissensdurst', 'Knowledge seeker'],
      [
        'Eigener Forschungsbeitrag im Normalbetrieb +18 %.',
        'Own research contribution during normal operations +18%.',
      ],
      ['Sorgfältige Pflege', 'Careful maintenance'],
      ['Eigener Wartungsbeitrag +18 %.', 'Own maintenance contribution +18%.'],
      ['Teamgefühl', 'Team spirit'],
      [
        'Als Teamleitung: Kapazitätsbonus +3 Prozentpunkte.',
        'As team leader: capacity bonus +3 percentage points.',
      ],
      ['Sparsame Hardware', 'Efficient hardware'],
      ['Eigene Betriebskosten −15 %.', 'Own running costs −15%.'],
      ['Ausgeglichen', 'Well balanced'],
      [
        'Seltenere Selbstwartung; Teamleitungsbonus +1 Prozentpunkt.',
        'Less frequent self-maintenance; team leader bonus +1 percentage point.',
      ],
      ['Bedächtiges Tempo', 'Deliberate pace'],
      ['Eigener Beitrag zum Auftragsdurchsatz −10 %.', 'Own contribution to job throughput −10%.'],
      ['Lernbegleitung nötig', 'Needs learning support'],
      [
        'Eigener Forschungsbeitrag im Normalbetrieb −10 %.',
        'Own research contribution during normal operations −10%.',
      ],
      ['Pflege ist Nebensache', 'Maintenance is secondary'],
      ['Eigener Wartungsbeitrag −12 %.', 'Own maintenance contribution −12%.'],
      ['Hungrige Hardware', 'Power-hungry hardware'],
      ['Eigene Betriebskosten +20 %.', 'Own running costs +20%.'],
      ['Wartungsanfällig', 'Maintenance prone'],
      [
        'Gelegentlich 8–12 Minuten Selbstwartung; Grundintervall etwa 4–6 Betriebsstunden.',
        'Occasional 8–12 minute self-maintenance; base interval roughly 4–6 operating hours.',
      ],
      ['Lieber allein', 'Independent operator'],
      [
        'Als Teamleitung: Kapazitätsbonus −4 Prozentpunkte.',
        'As team leader: capacity bonus −4 percentage points.',
      ],
      ['Alle Teamplätze sind belegt.', 'All team slots are occupied.'],
      ['Diese Bewerbung ist nicht mehr verfügbar.', 'This applicant is no longer available.'],
      [
        'Diese Bewerbung ist nicht mehr verfügbar. Die nächste Liste kommt automatisch.',
        'This applicant is no longer available. The next list arrives automatically.',
      ],
      [
        'Bewerbung vorgemerkt. Sie bleibt beim nächsten Wechsel erhalten.',
        'Applicant shortlisted. They will remain available after the next refresh.',
      ],
      ['Vormerkung entfernt.', 'Removed from shortlist.'],
      ['Mindestens ein Agent muss im Team bleiben.', 'At least one agent must remain on the team.'],
      [
        'Laufende Einsätze müssen zuerst abgeschlossen werden.',
        'Active assignments must finish first.',
      ],
      [
        'Agent ausgemustert. Einstellungskosten werden nicht erstattet.',
        'Agent retired. Activation costs are not refunded.',
      ],
      [
        'Dieser Agent wartet sich selbst und kehrt automatisch zurück.',
        'This agent is undergoing self-maintenance and returns automatically.',
      ],
      ['Selbstwartung · Rückkehr in', 'Self-maintenance · Returns in'],
      [
        'Im Sondereinsatz fehlt ein Agent bei Aufträgen, Forschung und Pflege. Techniker diagnostizieren schneller, Operatoren optimieren schneller, Analysten liefern mehr Forschung. Die Wirkung beginnt erst nach Abschluss. Danach ist der Agent wieder im Normalbetrieb; ein weiterer Sondereinsatz muss bis zum Ende der Erholungszeit warten. Große Krisen und Selbstwartung pausieren laufende Einsätze. Selbstwartung endet automatisch; Betriebskosten laufen weiter. Stärken und Nachteile verändern jeweils den eigenen Beitrag, nicht pauschal das gesamte Netzwerk.',
        'On special assignment, an agent cannot contribute to jobs, research or maintenance. Engineers diagnose faster, operators optimize faster and analysts produce more research. Effects begin after completion. The agent then returns to normal duties; another assignment must wait until cooldown ends. Major crises and self-maintenance pause active assignments. Self-maintenance ends automatically; running costs continue. Strengths and drawbacks affect the unit’s own contribution rather than the whole network.',
      ],
    ],
    patterns: [
      [/^im Normalbetrieb \/ (\d+) Plätze$/, 'on regular duties / $1 slots'],
      [/^(\d+) Belohnungen verfügbar$/, '$1 rewards available'],
      [/^(.+) ablehnen$/, (whole, title) => translate(title) + ' · Decline'],
      [
        /^(.+) benötigt Selbstwartung\. Einsätze pausieren; Rückkehr erfolgt automatisch\.$/,
        '$1 needs self-maintenance. Assignments pause; return is automatic.',
      ],
      [/^(.+) ist wieder im Dienst\.$/, '$1 is back on duty.'],
      [/^(.+) dem Team beigetreten\.$/, '$1 joined the team.'],
      [
        /^(.+) verlässt das Team\. Teamleitungsplätze sind gegebenenfalls frei\.$/,
        '$1 leaves the team. Any team leadership posts are now vacant.',
      ],
    ],
  };
});
