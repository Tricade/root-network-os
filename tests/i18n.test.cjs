'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const I18N = require('../i18n.js');

test('customer workflow, research dialogs and development controls have complete English labels', () => {
  for (const [source, english] of [
    ['Anfrage ablehnen', 'Decline enquiry'],
    ['Forschungszweige', 'Research branches'],
    ['Forschungsentscheidung prüfen', 'Review research decision'],
    ['Agent-Upgrade prüfen', 'Review agent upgrade'],
    [
      'Kundenvertrag angenommen. Einrichtung gestartet.',
      'Customer contract accepted. Provisioning started.',
    ],
    ['Noch nicht eingerichtet', 'Not provisioned yet'],
    ['Agent entwickelt.', 'Agent upgraded.'],
    ['Netzwerkstand gespeichert.', 'Network saved.'],
    ['Schwerpunkt angepasst.', 'Focus updated.'],
    ['19 Zoll · 18 HE', '19 in · 18 RU'],
    ['3 Server · 9 / 16 HE', '3 servers · 9 / 16 RU'],
  ])
    assert.equal(I18N.translate(source, 'en'), english);
});

test('English compound feedback translates only its action label and preserves the agent name', () => {
  const text = 'Tarek ist bereits im Einsatz: Netzdiagnose.';
  assert.equal(I18N.translate(text, 'en'), 'Tarek is already on assignment: Network diagnostics.');
  assert.equal(I18N.translate(text, 'de'), text);
});

test('automatic server labels and live backup/maintenance feedback translate without changing saved names', () => {
  const server = { type: 'edge', name: 'Randknoten 01' };
  assert.equal(I18N.isGeneratedServerName(server), true);
  assert.equal(I18N.serverName(server, 'en'), 'Edge node 01');
  assert.equal(I18N.serverName(server, 'de'), 'Randknoten 01');
  assert.equal(server.name, 'Randknoten 01');
  assert.equal(I18N.serverName({ type: 'edge', name: 'Mein Knoten' }, 'en'), 'Mein Knoten');
  assert.equal(I18N.isGeneratedServerName({ type: 'compute', name: 'Randknoten 01' }), false);
  for (const [source, english] of [
    ['Speicherknoten 32', 'Storage node 32'],
    [
      'Eine Krisen- oder Wartungsmaßnahme verhindert gerade eine neue Sicherung.',
      'A crisis or maintenance operation is currently preventing a new backup.',
    ],
    [
      'Automatische Betriebssicherung gestartet: 185 Credits.',
      'Automatic operations backup started: 185 credits.',
    ],
    [
      'Automatische Wartung gestartet: Rechenknoten 02, 185 Credits und 2 Ersatzteil.',
      'Automatic maintenance started: Compute node 02, 185 credits and 2 spare parts.',
    ],
    [
      'Wartung abgeschlossen: Rechenknoten 02 bei 100% Zustand.',
      'Maintenance complete: Compute node 02 at 100% condition.',
    ],
    ['Rechenknoten 02 auf Stufe 2 ausgebaut.', 'Compute node 02 upgraded to level 2.'],
    ['Mira erreicht Stufe 2.', 'Mira reached level 2.'],
    [
      'Mira hat den Forschungsauftrag abgeschlossen: +12 Forschungspunkte.',
      'Mira completed the research assignment: +12 research points.',
    ],
    [
      'Mira hat den Einsatz „Netzdiagnose“ abgeschlossen. Die Wirkung ist aktiv.',
      'Mira completed the “Network diagnostics” assignment. Its effect is active.',
    ],
  ]) {
    assert.equal(I18N.translate(source, 'en'), english);
    assert.equal(I18N.translate(source, 'de'), source);
  }
});

test('customer and unattended feedback translates built-in clients while preserving unknown names', () => {
  for (const [source, expected] of [
    ['Kunden & Betrieb', 'Customers & operations'],
    ['Betriebspläne', 'Operation plans'],
    ['Strom', 'Power'],
    ['Zentralanlage ausbauen', 'Expand central plant'],
    ['Lokaler Strom mit zentraler USV', 'Local power with central UPS'],
    ['Umbau aktiv', 'Conversion in progress'],
    [
      '3 Ersatzteile bestellt. Lieferung in 300 Sekunden.',
      '3 spare parts ordered. Delivery in 300 seconds.',
    ],
    ['3 Ersatzteile eingetroffen.', '3 spare parts delivered.'],
    ['Nordlicht Mobilität', 'Nordlicht Mobility'],
  ])
    assert.equal(I18N.translate(source, 'en'), expected);
});

test('facility counts use correct singulars and section names without changing standalone names', () => {
  for (const [source, expected] of [
    ['1 Racks · 1 Server', '1 rack · 1 server'],
    ['2 Racks · 0 Server', '2 racks · 0 servers'],
    ['Rackdetails · 1 Server', 'Rack details · 1 server'],
    ['1 Server · 22.0 °C', '1 server · 22.0 °C'],
    ['Backups & Betrieb', 'Operations & Resilience'],
    ['von', 'von'],
    ['KI-Workload', 'AI workload'],
    ['50 % erledigt', '50% complete'],
    [
      'Die laufende Infrastrukturmaßnahme muss zuerst abgeschlossen werden.',
      'The current infrastructure operation must finish first.',
    ],
  ])
    assert.equal(I18N.translate(source, 'en'), expected);
});

test('German remains the default and English translates known phrases while preserving unknown text', () => {
  assert.equal(I18N.getLanguage(), 'de');
  assert.equal(I18N.translate('Einstellungen'), 'Einstellungen');
  assert.equal(I18N.translate('Einstellungen', 'en'), 'Settings');
  assert.equal(I18N.translate('Ari-1'), 'Ari-1');
  assert.equal(I18N.translate('42 % erledigt', 'en'), '42% complete');
  assert.equal(I18N.translate('Etage 3 · Raum 2', 'en'), 'Basement 3 · Room 2');
  assert.equal(
    I18N.translate('While this server is fictional', 'en'),
    'While this server is fictional',
  );
  assert.equal(
    I18N.translate(
      'Die Temperaturgrenze wurde überschritten. Betroffene Knoten wurden zum Schutz vor Folgeschäden abgeschaltet.',
      'en',
    ),
    'The temperature limit was exceeded. Affected nodes were shut down to prevent further damage.',
  );
  assert.equal(
    I18N.translate(
      '17 Credits und 30 Sekunden mit halbiertem Auftragsdurchsatz; speichert 9.0 Forschung und 2 aktive Aufträge. Kein Datenverlust.',
      'en',
    ),
    '17 credits and 30 seconds at half job throughput; saves 9.0 research and 2 active jobs. No data is lost.',
  );
  assert.equal(
    I18N.translate('Rack A mit Switch, Stromversorgung und Kühlung installiert.', 'en'),
    'Rack A installed with a switch, power supply, and cooling.',
  );
  assert.equal(
    I18N.translate(
      'Während deiner Abwesenheit hat ROOT 2 Stunden weitergearbeitet. Berücksichtigt wurden maximal 12 Stunden.',
      'en',
    ),
    'While you were away, ROOT continued working for 2 hours. A maximum of 12 hours was included.',
  );
  assert.equal(
    I18N.translate(
      'Leitet die betroffenen Knoten zurück auf einen sicheren Betriebsmodus. 150 Credits, 0 Ersatzteile und 90 Sekunden Krisenbetrieb. Zustand der betroffenen Knoten danach 64%. Verlust: 1.5 Arbeitseinheiten.',
      'en',
    ),
    'Returns the affected nodes to a safe operating mode. 150 credits, 0 spare parts, and 90 seconds of crisis response. Affected nodes will be at 64% condition afterward. Loss: 1.5 work units.',
  );
  assert.equal(I18N.translate('Gebäudetechnik', 'en'), 'Building systems');
  assert.equal(I18N.translate('2 frei   /   1 im Einsatz', 'en'), '2 free / 1 on assignment');
  assert.equal(I18N.translate('3 Entscheidungen', 'en'), '3 decisions');
  assert.equal(I18N.translate('Unterirdisches Rechenzentrum', 'en'), 'Underground data center');
  assert.equal(I18N.translate('Zugangsschleuse', 'en'), 'Access airlock');
  assert.equal(I18N.translate('Bunker betreten', 'en'), 'Enter bunker');
  assert.equal(I18N.translate('Etage 2 · Raum 3', 'en'), 'Basement 2 · Room 3');
  assert.equal(I18N.translate('Rack 01 · E: Tür öffnen', 'en'), 'Rack 01 · E: Open door');
  for (const [source, expected] of [
    ['9 Server · 16 / 16 RU', '9 servers · 16 / 16 RU'],
    ['1 Server · 1 / 16 RU', '1 server · 1 / 16 RU'],
    ['100% der Anforderung', '100% of required capacity'],
    ['der Anforderung', 'of required capacity'],
    ['Kühlung von Keller-Rack A verwalten', 'Manage cooling for Keller-Rack A'],
    ['Stromversorgung von Rack 01 verwalten', 'Manage power supply for Rack 01'],
    ['Switch in Rack 01 verwalten', 'Manage switch in Rack 01'],
    ['Port 10, frei', 'Port 10, free'],
    ['Rack verwalten', 'Manage rack'],
    ['Versorgung & Verbindung', 'Utilities & connectivity'],
    ['Strombudget', 'Power budget'],
    ['RECHENZENTRUM / RACK', 'DATA CENTER / RACK'],
    ['19 Zoll', '19 in'],
    [
      'Mein Knoten, ROOT R120, 1 Höheneinheiten, Online',
      'Mein Knoten, ROOT R120, 1 rack unit, Online',
    ],
  ])
    assert.equal(I18N.translate(source, 'en'), expected);
  assert.equal(I18N.translate('Server 03', 'en'), 'Server 03');
  assert.equal(
    I18N.translate('Rack 01 · Online · E / Klick: Server verwalten', 'en'),
    'Rack 01 · Online · E / click: manage server',
  );
  assert.equal(
    I18N.translate(
      '3450 Credits; 120 Sekunden Wartung. 3500 W zusätzliche Kühlleistung, auf aktive Racks verteilt.',
      'en',
    ),
    '3450 credits; 120 seconds of maintenance. 3500 W of additional cooling capacity, distributed across active racks.',
  );
  assert.equal(
    I18N.translate(
      'Agenten: Mira: Netzdiagnose · 30 min · Tarek: Forschungsauftrag · 2 h · pausiert',
      'en',
    ),
    'Agents: Mira: Network diagnostics · 30 min · Tarek: Research assignment · 2 h · paused',
  );
  assert.equal(I18N.translate('Etage 2', 'en'), 'Basement 2');
  assert.equal(I18N.translate('Stufe 2 / 5', 'en'), 'Level 2 / 5');
  assert.equal(
    I18N.translate('Rack 01 · 41,2 °C · E / Klick: Rack verwalten', 'en'),
    'Rack 01 · 41.2 °C · E / click: manage rack',
  );
  for (const [source, expected] of [
    ['Sektor 30 · Lokales Netzwerk', 'Sector 30 · Local network'],
    ['Sektor 31 wartet.', 'Sector 31 is waiting.'],
    [' HORIZONT ERWEITERN', ' EXPAND YOUR HORIZONS'],
    ['13.1 % ausgelastet', '13.1% in use'],
    ['99.1 Mio.', '99.1M'],
    ['Noch 15 s', '15 s remaining'],
    ['0 / 8 AUFTRÄGE', '0 / 8 JOBS'],
    ['Verfügbare Aufträge / 0', 'Available jobs / 0'],
    ['Untergeschoss 2 · Raum 5', 'Basement 2 · Room 5'],
    ['KONTROLLRAUM', 'CONTROL ROOM'],
    ['Selbstständig im Hintergrund aktiv', 'Running autonomously in the background'],
    ['Dialog schließen', 'Close dialog'],
    ['Ziehen / ← → drehen', 'Drag / ← → rotate'],
    ['höchste Racktemperatur', 'Highest rack temperature'],
    ['3 OFFEN', '3 OPEN'],
    ['Abweichende Browserkopie exportieren', 'Export alternate browser copy'],
    [
      'Eine andere Browser-Sitzung hat einen neueren Stand gespeichert. Diese Sitzung pausiert. Lade die Seite neu; deine abweichende Kopie bleibt in den Einstellungen exportierbar.',
      'Another browser session saved a newer version. This session is paused. Reload the page; your alternate copy remains available to export in Settings.',
    ],
    [
      'Der Netzwerkstand ist zu groß. Maximal 16 MiB.',
      'The network save is too large. Maximum size: 16 MiB.',
    ],
    ['Einfahrt beim Start anzeigen', 'Show arrival sequence at startup'],
    ['Einfahrt ansehen', 'Replay arrival sequence'],
    ['Racks gesamt', 'Total racks'],
    ['Server gesamt', 'Total servers'],
    ['Racks in diesem Raum', 'Racks in this room'],
    ['Untergeschoss 01 / Kontrollraum', 'Basement 01 / Control Room'],
    ['Verbindungsflur', 'Connecting corridor'],
    ['↑ Treppe nach oben', '↑ Stairs up'],
    ['↓ Treppe nach unten', '↓ Stairs down'],
    ['ZUGANG ZUM FLUR', 'CORRIDOR ACCESS'],
    ['· Lokales Netzwerk', '· Local network'],
    ['% ausgelastet', '% in use'],
    ['Verlauf der letzten Messwerte', 'Recent measurements'],
    ['Simulierter Serverraum', 'Simulated server room'],
    ['Wird gespeichert …', 'Saving …'],
    ['Diese Sitzung pausiert. Bitte Seite neu laden.', 'This session is paused. Reload the page.'],
    ['Raumkonsole', 'Room console'],
    ['Backups & Betrieb', 'Operations & Resilience'],
    ['Protokoll', 'Log'],
    [' ausgefallen · ', ' failed · '],
    [' FP geschützt', ' RP protected'],
    ['Betriebsbackup', 'Operations backup'],
    ['Verbraucht: ', 'Spent: '],
    [' von ', ' von '],
    ['MASSNAHMEN', 'ACTIONS'],
    ['Überspringen · Esc', 'Skip · Esc'],
    [
      'Die Leitstelle bündelt alle Systeme. Der Ausgang führt zurück in den Verbindungsflur.',
      'The control room brings all systems together. The exit leads back to the connecting corridor.',
    ],
    [
      'Öffne eine Tür mit E oder einem Klick und gehe hindurch. Die Treppen verbinden vorhandene Untergeschosse.',
      'Press E or click a door to open it and walk through. The stairs connect existing basements.',
    ],
    ['Ungültiger Netzwerkstand: Unexpected token', 'Invalid network state: Unexpected token'],
    ['Untergeschoss 2 · Raum 5 · 1 Racks', 'Basement 2 · Room 5 · 1 rack'],
    [
      'Kühlung ausbauen in Rack 03 completed. Power and connections are available again.',
      'Upgrade cooling in Rack 03 completed. Power and connections are available again.',
    ],
    [
      'KI-Inferenz auswerten for Institut für angewandte KI completed: 11839 credits.',
      'Evaluate AI inference for Institut für angewandte KI completed: 11839 credits.',
    ],
    ['Hanseatische Werkstätten', 'Hanseatic Workshops'],
    ['Institut für Umweltfunk', 'Environmental Radio Institute'],
    ['Meine eigenen Werkstätten', 'Meine eigenen Werkstätten'],
    [
      'Sensornetz überwachen for Institut für Umweltfunk completed: 108 credits.',
      'Monitor sensor network for Environmental Radio Institute completed: 108 credits.',
    ],
    [
      'Operator · Hält Aufträge am Laufen und steigert die Netzwerkerlöse.',
      'Operator · Keeps jobs running and increases network revenue.',
    ],
    [
      'Kühlung ausbauen in Rack 03 abgeschlossen. Versorgung und Verbindungen sind wieder verfügbar.',
      'Upgrade cooling in Rack 03 completed. Power and connections are available again.',
    ],
    [
      'Kühlung ausbauen begonnen: Rack 03; 4176 Credits und 90 Sekunden Wartung.',
      'Upgrade cooling started: Rack 03; 4176 credits and 90 seconds of maintenance.',
    ],
    ['KI-Beschleuniger 18 wurde ausgeschaltet.', 'KI-Beschleuniger 18 was powered off.'],
  ])
    assert.equal(I18N.translate(source, 'en'), expected, source);
});

test('localization installation is safe without a browser DOM', () => {
  const localization = I18N.installLocalization({ getProtectedText: () => ['Mira'] });
  assert.equal(typeof localization.refresh, 'function');
  assert.equal(typeof localization.dispose, 'function');
  localization.refresh();
  localization.dispose();
});

test('DOM localization restores German source text and attributes across language switches', () => {
  const saved = Object.fromEntries(
    [
      'document',
      'MutationObserver',
      'NodeFilter',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'localStorage',
    ].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const frames = [];
  let observer;
  class TextNode {
    constructor(data, parentElement) {
      this.nodeType = 3;
      this.data = data;
      this.parentElement = parentElement;
    }
  }
  class Element {
    constructor(tagName, attrs = {}) {
      this.nodeType = 1;
      this.tagName = tagName.toUpperCase();
      this.attrs = new Map(Object.entries(attrs));
      this.children = [];
      this.parentElement = null;
      this.value = '';
    }
    append(child) {
      child.parentElement = this;
      this.children.push(child);
    }
    hasAttribute(name) {
      return this.attrs.has(name);
    }
    getAttribute(name) {
      return this.attrs.has(name) ? this.attrs.get(name) : null;
    }
    setAttribute(name, value) {
      this.attrs.set(name, value);
    }
  }
  const rootElement = new Element('html');
  const button = new Element('button', {
    title: 'Einstellungen öffnen',
    'aria-label': 'Navigation öffnen',
  });
  const label = new TextNode('Einstellungen', button);
  button.append(label);
  rootElement.append(button);
  const input = new Element('input', { placeholder: 'Netzwerkname', 'aria-label': 'Netzwerkname' });
  input.value = 'Mein Netzwerk';
  rootElement.append(input);
  const protectedName = new TextNode('Mira', rootElement);
  rootElement.append(protectedName);
  globalThis.document = {
    documentElement: rootElement,
    createTreeWalker(rootNode) {
      const all = [];
      const walk = (node) => {
        for (const child of node.children || []) {
          all.push(child);
          walk(child);
        }
      };
      walk(rootNode);
      let index = 0;
      return { nextNode: () => all[index++] || null };
    },
  };
  globalThis.NodeFilter = { SHOW_ELEMENT: 1, SHOW_TEXT: 4 };
  globalThis.requestAnimationFrame = (callback) => {
    frames.push(callback);
    return frames.length;
  };
  globalThis.cancelAnimationFrame = () => {};
  globalThis.MutationObserver = class {
    constructor(callback) {
      this.callback = callback;
      observer = this;
    }
    observe() {}
    disconnect() {}
  };
  const savedLanguages = new Map();
  globalThis.localStorage = {
    getItem: (key) => savedLanguages.get(key) ?? null,
    setItem: (key, value) => savedLanguages.set(key, value),
  };
  const flush = () => {
    while (frames.length) frames.shift()();
  };
  try {
    const localization = I18N.installLocalization({ getProtectedText: () => new Set(['Mira']) });
    flush();
    assert.equal(label.data, 'Einstellungen');
    I18N.setLanguage('en');
    I18N.localize(rootElement);
    assert.equal(label.data, 'Settings', 'a new view is localized before the next animation frame');
    flush();
    assert.equal(label.data, 'Settings');
    assert.equal(button.getAttribute('title'), 'Open settings');
    assert.equal(button.getAttribute('aria-label'), 'Open navigation');
    assert.equal(input.getAttribute('placeholder'), 'Network name');
    assert.equal(input.value, 'Mein Netzwerk');
    assert.equal(protectedName.data, 'Mira');
    I18N.setLanguage('de');
    flush();
    assert.equal(label.data, 'Einstellungen');
    assert.equal(button.getAttribute('title'), 'Einstellungen öffnen');
    assert.equal(input.getAttribute('placeholder'), 'Netzwerkname');
    localization.dispose();
    assert.equal(typeof observer.disconnect, 'function');
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key]) Object.defineProperty(globalThis, key, saved[key]);
      else delete globalThis[key];
    }
  }
});

test('language choice is stored separately under root.language and normalizes unsupported values', () => {
  const original = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  try {
    assert.equal(I18N.setLanguage('en'), 'en');
    assert.equal(values.get('root.language'), 'en');
    assert.equal(I18N.getLanguage(), 'en');
    assert.equal(I18N.setLanguage('fr'), 'de');
    assert.equal(values.get('root.language'), 'de');
    assert.equal(I18N.getLanguage(), 'de');
  } finally {
    if (original === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = original;
  }
});

test('robot agency, every perk and self-maintenance feedback are localized', () => {
  const pairs = require('../locales/personnel-en.js')().pairs;
  for (const [de, en] of pairs) assert.equal(I18N.translate(de, 'en'), en, de);
  for (const [de, en] of [
    [
      'Mira benötigt Selbstwartung. Einsätze pausieren; Rückkehr erfolgt automatisch.',
      'Mira needs self-maintenance. Assignments pause; return is automatic.',
    ],
    ['Mira ist wieder im Dienst.', 'Mira is back on duty.'],
    ['im Normalbetrieb / 9 Plätze', 'on regular duties / 9 slots'],
    ['3 Belohnungen verfügbar', '3 rewards available'],
  ])
    assert.equal(I18N.translate(de, 'en'), en);
  const { STRENGTHS, WEAKNESSES } = require('../engine/personnel.js')({});
  for (const value of [...Object.values(STRENGTHS), ...Object.values(WEAKNESSES)]) {
    assert.notEqual(I18N.translate(value.name, 'en'), value.name, value.name);
    assert.notEqual(I18N.translate(value.description, 'en'), value.description, value.description);
  }
});
