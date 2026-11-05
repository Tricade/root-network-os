/** Definitions: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['definitions'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDefinitions() {
    const catalog = {
      servers: {
        edge: {
          name: 'Edge-Knoten',
          model: 'ROOT R120',
          units: 1,
          cores: 8,
          ramGB: 32,
          storageTB: 4,
          driveBays: 2,
          description: 'Liefert schnelle, verlässliche Grundlast und verbindet neue Standorte.',
          baseCost: 420,
          capacity: 18,
          power: 2.2,
          color: '#65d6c4',
        },
        compute: {
          name: 'Rechenknoten',
          model: 'ROOT C240',
          units: 2,
          cores: 24,
          ramGB: 128,
          storageTB: 8,
          driveBays: 4,
          description: 'Viel Durchsatz für anspruchsvolle Aufträge und Forschung.',
          baseCost: 760,
          capacity: 34,
          power: 5.2,
          color: '#8b9cff',
        },
        storage: {
          name: 'Speicherknoten',
          model: 'ROOT S360',
          units: 3,
          cores: 12,
          ramGB: 64,
          storageTB: 24,
          driveBays: 8,
          description: 'Günstige Kapazität mit niedriger Last und stabiler Grundversorgung.',
          baseCost: 610,
          capacity: 28,
          power: 2.8,
          color: '#f1bd72',
        },
        ai: {
          name: 'KI-Beschleuniger',
          model: 'ROOT A480',
          units: 4,
          cores: 32,
          ramGB: 256,
          storageTB: 8,
          driveBays: 4,
          gpuCount: 4,
          vramGB: 320,
          description:
            'Vier simulierte Beschleuniger mit je 80 GB VRAM für begrenzte KI-Inferenz und Training; hoher Strom- und Uplinkbedarf.',
          baseCost: 2450,
          capacity: 19,
          power: 15,
          color: '#be91ff',
        },
      },
      roles: {
        operator: {
          name: 'Operator',
          description: 'Beschleunigt Projektarbeit und kann ein Raumteam leiten.',
          baseCost: 260,
          color: '#65d6c4',
        },
        analyst: {
          name: 'Analyst',
          description: 'Verwandelt laufende Arbeit in zusätzliche Forschungspunkte.',
          baseCost: 320,
          color: '#8b9cff',
        },
        engineer: {
          name: 'Techniker',
          description: 'Senkt Wartungslast und verbessert Zuverlässigkeit.',
          baseCost: 380,
          color: '#f1bd72',
        },
      },
      research: [
        {
          id: 'routing',
          name: 'Adaptives Routing',
          description:
            'Mehr Tempo für Projektarbeit. Wiederholbar: +12 Prozentpunkte Arbeitstempo je Stufe.',
          baseCost: 120,
          legacyBaseCost: 8,
          currency: 'research',
          effect: 'work',
        },
        {
          id: 'cooling',
          name: 'Flüssigkühlung',
          description:
            'Senkt thermischen Stress und Ausfallrisiko mit abnehmendem Zusatznutzen. Ersetzt keine reale Kühlleistung.',
          baseCost: 140,
          legacyBaseCost: 10,
          currency: 'research',
          effect: 'heat',
        },
        {
          id: 'market',
          name: 'Vertragsanalyse',
          description: 'Bessere Vergütung für Aufträge. Wiederholbar: +10 % Auftragswert je Stufe.',
          baseCost: 160,
          legacyBaseCost: 12,
          currency: 'research',
          effect: 'reward',
        },
        {
          id: 'automation',
          name: 'Selbstheilende Abläufe',
          description:
            'Senkt Energie- und Hardwarepflegekosten mit abnehmendem Zusatznutzen um bis zu 25 %. Personal und Zentralanlagen bleiben kostenpflichtig.',
          baseCost: 200,
          legacyBaseCost: 15,
          currency: 'research',
          effect: 'income',
        },
        {
          id: 'synthesis',
          name: 'Wissenssynthese',
          description:
            'Steigert passive Forschung und Agentenprojekte mit abnehmendem Zusatznutzen um bis zu 60 %.',
          baseCost: 240,
          legacyBaseCost: 18,
          currency: 'research',
          effect: 'research',
        },
      ],
      achievements: [],
    };

    const SERVER_TYPES = Object.keys(catalog.servers);
    const HARDWARE = {
      edge: { model: 'ROOT R120', units: 1, cores: 8, ramGB: 32, driveBays: 2, storageTB: 4 },
      compute: { model: 'ROOT C240', units: 2, cores: 24, ramGB: 128, driveBays: 4, storageTB: 8 },
      storage: { model: 'ROOT S360', units: 3, cores: 12, ramGB: 64, driveBays: 8, storageTB: 24 },
      ai: {
        model: 'ROOT A480',
        units: 4,
        cores: 32,
        ramGB: 256,
        driveBays: 4,
        storageTB: 8,
        gpuCount: 4,
        vramGB: 320,
      },
    };
    // These are implementation ceilings, separate from sector unlocks. The
    // sector progression itself does not stop at the old six-rack / 32-server cap.
    const RACK_UNITS = 18,
      FIRST_DEVICE_UNIT = 2,
      LAST_DEVICE_UNIT = 17,
      MAX_RACKS = 10000,
      MAX_RACK_LEVEL = 100;
    const RACKS_PER_ROOM = 6,
      ROOMS_PER_FLOOR = 4;
    const MAX_ROOMS = Math.ceil(MAX_RACKS / RACKS_PER_ROOM),
      MAX_FLOORS = Math.ceil(MAX_ROOMS / ROOMS_PER_FLOOR);
    const ROLES = Object.keys(catalog.roles);
    const FOCI = ['income', 'research', 'maintenance'];
    const MODES = ['balanced', 'performance', 'eco'];
    const JOB_KINDS = [
      'monitoring',
      'migration',
      'audit',
      'optimization',
      'recovery',
      'research',
      'ai',
      'database',
      'backup',
      'loadtest',
      'archive',
      'containers',
      'security',
      'replication',
      'rendering',
    ];
    const MAX = { servers: 10000, agents: 12, jobs: 8, offers: 6, events: 3, log: 80, history: 60 };
    const MAX_RESEARCH_LEVEL = 1000;
    const MAX_CONDITION = 100;
    const RESILIENCE_MAX = { parts: 20, incidentAffected: 2, backupJobs: MAX.jobs };
    const CENTRAL_SYSTEMS = [
      {
        id: 'cooling',
        name: 'Zentrale Klimaanlage',
        unlockSector: 4,
        baseCost: 4800,
        duration: 120,
        maxLevel: 10000,
      },
      {
        id: 'ups',
        name: 'Unterbrechungsfreie Stromversorgung',
        unlockSector: 6,
        baseCost: 6200,
        duration: 150,
        maxLevel: 10000,
      },
      {
        id: 'distribution',
        name: 'Zentrale Stromverteilung',
        unlockSector: 8,
        baseCost: 8400,
        duration: 180,
        maxLevel: 10000,
      },
    ];
    const CENTRAL_DEFAULTS = { cooling: 0, ups: 0, distribution: 0 };
    const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
    const finite = (n) => typeof n === 'number' && Number.isFinite(n);
    const safeNum = (n, fallback, lo = 0, hi = 1e12) => (finite(n) ? clamp(n, lo, hi) : fallback);
    const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    return {
      catalog,
      SERVER_TYPES,
      HARDWARE,
      RACK_UNITS,
      FIRST_DEVICE_UNIT,
      LAST_DEVICE_UNIT,
      MAX_RACKS,
      MAX_RACK_LEVEL,
      RACKS_PER_ROOM,
      ROOMS_PER_FLOOR,
      MAX_ROOMS,
      MAX_FLOORS,
      ROLES,
      FOCI,
      MODES,
      JOB_KINDS,
      MAX,
      MAX_RESEARCH_LEVEL,
      MAX_CONDITION,
      RESILIENCE_MAX,
      CENTRAL_SYSTEMS,
      CENTRAL_DEFAULTS,
      clamp,
      finite,
      safeNum,
      own,
    };
  };
});
