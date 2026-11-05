/** English copy for paid construction. Dynamic values and custom names stay intact. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root) root.RootBuildingEnglish = factory;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (translate) {
  const pairs = [
    ['Teilausbau', 'Partially fitted'],
    ['Vollausbau prüfen', 'Review full construction'],
    ['Ersten Bauabschnitt prüfen', 'Review first phase'],
    ['Zweiten Bauabschnitt prüfen', 'Review second phase'],
    ['Serverraum mit zwei Rackplätzen bauen', 'Build server room with two rack slots'],
    ['Serverraum fertig ausbauen', 'Finish fitting out server room'],
    [
      'Erschließt zwei nutzbare Rackplätze. Die übrigen vier können später ausgebaut werden.',
      'Opens two usable rack slots. The other four can be fitted out later.',
    ],
    [
      'Schaltet vier weitere Rackplätze frei. Bestehende Racks arbeiten während des Baus weiter.',
      'Opens four additional rack slots. Existing racks keep running during construction.',
    ],
    [
      'Räume und Untergeschosse werden separat gebaut. Ein voll ausgebauter Raum bietet sechs Rackplätze.',
      'Rooms and basements are built separately. A fully fitted server room has six rack slots.',
    ],
    [
      'Der Teilausbau ist für den ersten zusätzlichen Serverraum auf Untergeschoss 1 verfügbar.',
      'Phased construction is available for the first additional server room on Basement 1.',
    ],
    [
      'Dieser Serverraum hat keinen offenen Bauabschnitt.',
      'This server room has no remaining construction phase.',
    ],
    [
      'Der Bau kollidiert mit einem eingeplanten Bauabschnitt.',
      'This build conflicts with a scheduled construction phase.',
    ],
    [
      'Erster Bauabschnitt fertig. Zwei Rackplätze sind verfügbar.',
      'First phase complete. Two rack slots are available.',
    ],
    [
      'Serverraum fertig ausgebaut. Vier weitere Rackplätze sind verfügbar.',
      'Server room fit-out complete. Four more rack slots are available.',
    ],
    ['Hardware verwalten', 'Manage hardware'],
    ['Details öffnen', 'View details'],
    ['Ein Erfolg wartet auf dich', 'An achievement is waiting for you'],
    ['Belohnung abholen', 'Claim reward'],
    ['CR abholbereit', 'CR ready to claim'],
    ['Erster Auftrag', 'First job'],
    ['Stabiles Netz', 'Stable network'],
    ['Dreifach redundant', 'Triple redundancy'],
    ['Neuer Horizont', 'New horizon'],
    ['2. Richte deine Hardware ein', '2. Configure your hardware'],
    ['3. Gib Agenten einen Schwerpunkt', '3. Give agents a focus'],
    ['4. Wähle passende Aufträge', '4. Choose suitable jobs'],
    ['5. Lass die Routine laufen', '5. Let routine work run'],
    ['6. Investiere in Entwicklung', '6. Invest in development'],
    ['7. Schütze deinen Betrieb', '7. Protect your operations'],
    ['8. Plane gezielte Einsätze', '8. Plan targeted assignments'],
    ['9. Beachte die Verbindungen', '9. Watch the connections'],
    ['10. Komm in deinem Tempo zurück', '10. Return at your own pace'],
    [
      'Räume, Untergeschosse und Technikräume baust du einzeln gegen Credits. Ein Bautrupp bearbeitet jeweils ein Projekt; neue Flächen werden erst nach Abschluss verfügbar. Racks und Anlagen kaufst du anschließend separat.',
      'Build rooms, basements, and plant rooms individually with credits. A construction crew handles one project at a time; new space becomes available when construction is complete. Purchase racks and systems separately afterward.',
    ],
    ['Höheneinheiten', 'rack units'],
    ['Bau prüfen', 'Review construction'],
    ['Im Bau', 'Under construction'],
    ['Unbebaut', 'Vacant'],
    ['Der neue Serverraum wird erschlossen.', 'The new server room is being built.'],
    [
      'Unterirdische Fläche für einen weiteren Serverraum.',
      'Underground space for another server room.',
    ],
    [
      'Räume und Untergeschosse werden separat gebaut. Ein leerer Raum bietet sechs Rackplätze.',
      'Rooms and basements are built separately. An empty room provides six rack slots.',
    ],
    [
      'Vier Serverräume auf dieser Etage gebaut. Weitere Flächen benötigen ein neues Untergeschoss.',
      'Four server rooms have been built on this floor. More space requires a new basement.',
    ],
    ['Kontrollraum & Technikflügel', 'Control room & utilities wing'],
    [
      'Diese Räume liegen einmalig auf Untergeschoss 1. Anlagen und Geräte werden danach separat installiert.',
      'These rooms are each built once on Basement 1. Systems and equipment are installed separately afterward.',
    ],
    ['Gebaut', 'Built'],
    ['Klimaraum', 'Cooling plant room'],
    ['USV-Raum', 'UPS room'],
    ['Stromverteilungsraum', 'Power distribution room'],
    ['Zentrale Versorgung', 'Central utilities'],
    [
      'Gebauter Technikraum, passende Leistungsreserven und laufende Betriebskosten sind erforderlich.',
      'A built plant room, sufficient capacity reserves, and ongoing operating costs are required.',
    ],
    ['Technikraum fehlt', 'Plant room required'],
    ['Gebäude & Technik', 'Building & utilities'],
    [
      'Dein Cyberbunker wächst mit jedem bezahlten Bauauftrag.',
      'Your cyber bunker grows with every paid construction order.',
    ],
    ['Freie Rackplätze', 'Free rack slots'],
    ['BAUSTELLE / VERGEBENER AUFTRAG', 'CONSTRUCTION SITE / ACTIVE PROJECT'],
    ['Verbleibende Bauzeit', 'Construction time remaining'],
    ['TIEFBAU / NÄCHSTE EBENE', 'CIVIL WORKS / NEXT LEVEL'],
    [
      'Eine neue Ebene umfasst Flur, Treppe und vier unbebaute Raumplätze. Sie enthält noch keine Serverräume oder Hardware.',
      'A new level includes a corridor, stairs, and four vacant room plots. It has no server rooms or hardware yet.',
    ],
    ['Untergeschoss planen', 'Plan basement'],
    ['Serverraum planen', 'Plan server room'],
    ['Flur betreten', 'Enter corridor'],
    [
      'Bauen und Betrieb bleiben getrennte Aufgaben.',
      'Construction and operations remain separate.',
    ],
    [
      'Ein externer Bautrupp bearbeitet einen Bauauftrag gleichzeitig. Bestehende Anlagen arbeiten weiter, und Reparaturen bleiben möglich. Bei zentraler oder Rack-Wartung bleibt die bisherige Wartungsbegrenzung bestehen.',
      'An external construction crew handles one project at a time. Existing systems keep running, and repairs remain available. The existing restrictions still apply during central or rack maintenance.',
    ],
    [
      'Dieser gebaute Serverraum ist noch leer. Installiere hier das erste Rack; danach kannst du Server und Verbindungen einrichten.',
      'This built server room is still empty. Install the first rack here, then add servers and connections.',
    ],
    [
      'In diesem Raum ist noch kein Rack installiert. Installiere zuerst ein Rack im Rechenzentrum.',
      'This room has no rack yet. Install a rack in the data center first.',
    ],
    ['Erstes Rack installieren', 'Install first rack'],
    ['Gebäudeplan öffnen', 'Open building plan'],
    ['Räume bauen & Etagen erweitern', 'Build rooms & expand floors'],
    [
      'Baue zuerst den zugehörigen Technikraum unter Gebäude.',
      'Build the associated plant room under Building first.',
    ],
    ['Dieser Raumtyp ist unbekannt.', 'Unknown room type.'],
    ['Ein Bauprojekt läuft bereits.', 'A construction project is already in progress.'],
    [
      'Während einer offenen Krise kann kein Bauprojekt beginnen.',
      'Construction cannot begin during an active incident.',
    ],
    ['Dieser Raum wurde bereits gebaut.', 'This room has already been built.'],
    ['Dieses Untergeschoss wurde noch nicht gebaut.', 'This basement has not been built yet.'],
    [
      'Dieses Untergeschoss hat bereits vier Serverräume.',
      'This basement already has four server rooms.',
    ],
    [
      'Die maximale Gebäudekapazität ist erreicht.',
      'The building has reached its maximum capacity.',
    ],
    [
      'Die maximale Zahl der Untergeschosse ist erreicht.',
      'The maximum number of basements has been reached.',
    ],
    [
      'Der volle Betrag wird beim Baustart bezahlt. Die Fläche ist erst nach Fertigstellung verfügbar.',
      'The full amount is charged when construction starts. The space becomes available only when construction is complete.',
    ],
    [
      'Der vorhandene Betrieb und Reparaturen laufen während des Baus weiter.',
      'Existing operations and repairs continue during construction.',
    ],
    [
      'Bestehender Betrieb, Backups und Reparaturen bleiben verfügbar.',
      'Existing operations, backups and repairs remain available.',
    ],
    [
      'Bauauftrag vergeben. Der vorhandene Betrieb läuft weiter.',
      'Construction project started. Existing operations continue.',
    ],
    [
      'Kein freier ausgebauter Rackplatz. Baue zuerst einen Serverraum.',
      'No free built rack space. Build a server room first.',
    ],
    [
      'Dieser Serverraum ist voll. Wähle einen anderen Raum oder baue zusätzliche Fläche.',
      'This server room is full. Choose another room or build more space.',
    ],
    ['Unterirdischen Serverraum bauen', 'Build underground server room'],
    ['Neues Untergeschoss bauen', 'Build new basement'],
    ['Kontrollraum bauen', 'Build control room'],
    ['Klimaraum bauen', 'Build cooling plant room'],
    ['USV-Raum bauen', 'Build UPS room'],
    ['Stromverteilungsraum bauen', 'Build power distribution room'],
    [
      'Aushub, Stahlbeton, Abdichtung und Anschlüsse im Technikflügel von Untergeschoss 1. Geräte werden anschließend separat installiert.',
      'Excavation, reinforced concrete, waterproofing, and utilities in the Basement 1 utilities wing. Equipment is installed separately afterward.',
    ],
    [
      'Wartung und passive Erlöse werden effizienter. Wiederholbar: +9 Prozentpunkte Netzwerkerlös je Stufe (ohne Zinseszins).',
      'Maintenance and passive income become more efficient. Repeatable: +9 percentage points of network revenue per level (no compounding).',
    ],
    ['Bau abgeschlossen', 'Construction complete'],
    ['Baustelle', 'Construction'],
    ['Keine Baustelle', 'No construction'],
    ['Bauflächen', 'Room plots'],
    ['Freie Bauplätze', 'Vacant plots'],
  ];
  const patterns = [
    [/^(\d+) Erfolge warten auf dich$/, (_, n) => `${n} achievements are waiting for you`],
    [
      /^(\d+) Erfolge freigeschaltet\. Belohnungen warten in der Forschung\.$/,
      (_, n) => `${n} achievements unlocked. Rewards are waiting in Research.`,
    ],
    [
      /^Erfolg freigeschaltet: (.+)$/,
      (_, name) => `Achievement unlocked: ${translate(name, 'en')}`,
    ],
    [
      /^Aushub, Stahlbeton, Abdichtung und Anschlüsse für Raum (\d+) auf Untergeschoss (\d+)\. Nach Fertigstellung Platz für sechs Racks\.$/,
      (_, room, floor) =>
        `Excavation, reinforced concrete, waterproofing, and utilities for Room ${room} on Basement ${floor}. Space for six racks when complete.`,
    ],
    [
      /^Aushub, Tragwerk, Treppenzugang und Erschließung für Untergeschoss (\d+)\. Vier Bauplätze für separat zu kaufende Serverräume\.$/,
      (_, floor) =>
        `Excavation, structural frame, stair access, and utilities for Basement ${floor}. Four plots for server rooms, purchased separately.`,
    ],
    [/^Untergeschoss (\d+) bauen$/, (_, n) => `Build Basement ${n}`],
    [/^Raum (\d+) bauen$/, (_, n) => `Build Room ${n}`],
    [
      /^Untergeschoss (\d+) fertiggestellt\. Vier Raumbauplätze sind verfügbar\.$/,
      (_, n) => `Basement ${n} completed. Four room plots are available.`,
    ],
    [
      /^Raum (\d+) auf Untergeschoss (\d+) fertiggestellt\. Sechs Rackplätze sind verfügbar\.$/,
      (_, room, floor) =>
        `Room ${room} on Basement ${floor} completed. Six rack slots are available.`,
    ],
    [
      /^(Kontrollraum|Klimaraum|USV-Raum|Stromverteilungsraum) fertiggestellt\.$/,
      (_, name) => `${translate(name, 'en')} completed.`,
    ],
    [
      /^(.+?) begonnen: (\d+) Credits; (\d+) Sekunden Bauzeit\.$/,
      (_, label, credits, seconds) => {
        const name = translate(label, 'en').replace(/^Build /, '');
        return `${name.charAt(0).toUpperCase() + name.slice(1)} construction started: ${credits} credits; ${seconds} seconds of construction.`;
      },
    ],
    [
      /^Dieser Raum wird ab Sektor (\d+) freigeschaltet\.$/,
      (_, sector) => `This room unlocks at Sector ${sector}.`,
    ],
    [/^(\d+) · (\d+) \/ 4 Räume$/, (_, floor, rooms) => `${floor} · ${rooms} / 4 rooms`],
    [
      /^Untergeschoss (\d+) · Raum (\d+) · (\d+) Racks$/,
      (_, floor, room, racks) =>
        `Basement ${floor} · Room ${room} · ${racks} rack${racks === '1' ? '' : 's'}`,
    ],
    [
      /^(\d+) \/ (\d+) Racks · (\d+) Server$/,
      (_, racks, slots, servers) =>
        `${racks} / ${slots} racks · ${servers} server${servers === '1' ? '' : 's'}`,
    ],
    [/^Raum (\d+) ist bereit$/, (_, room) => `Room ${room} is ready`],
    [/^Bauplatz (\d+)$/, (_, n) => `Plot ${n}`],
    [/^Untergeschoss (\d+) erschließen$/, (_, n) => `Excavate Basement ${n}`],
  ];
  return { pairs, patterns };
});
