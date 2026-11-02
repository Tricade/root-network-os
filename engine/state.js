/** State: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['state'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    const { catalog, MAX, CENTRAL_DEFAULTS } = context;
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const makeJob = (...args) => context.makeJob(...args);

    function rand(s) {
      let x = s.rng >>> 0 || 0x6d2b79f5;
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      s.rng = x >>> 0;
      return s.rng / 4294967296;
    }

    function hasId(s, id) {
      return (
        s.operations?.queue.some((x) => x.id === id) ||
        s.customers?.contracts.some((x) => x.id === id) ||
        s.customers?.leads.some((x) => x.id === id) ||
        s.customers?.history.some((x) => x.id === id) ||
        s.servers.some((x) => x.id === id) ||
        s.agents.some((x) => x.id === id) ||
        s.jobs.some((x) => x.id === id) ||
        s.offers.some((x) => x.id === id) ||
        s.events.some((x) => x.id === id) ||
        s.log.some((x) => x.id === id) ||
        Boolean(s.resilience && s.resilience.incident && s.resilience.incident.id === id) ||
        Boolean(s.facility && s.facility.racks.some((x) => x.id === id))
      );
    }

    function uid(s, prefix) {
      let id;
      do {
        id = prefix + '-' + s.nextId++;
      } while (hasId(s, id));
      return id;
    }

    function addLog(s, type, message) {
      s.log.unshift({
        id: uid(s, 'log'),
        time: s.time,
        type,
        message: String(message).slice(0, 180),
      });
      if (s.log.length > MAX.log) s.log.length = MAX.log;
    }

    function createState(seed = 12345) {
      const nseed = (Number.isInteger(seed) ? seed : 12345) >>> 0;
      const s = {
        version: 8,
        seed: nseed,
        rng: nseed || 0x6d2b79f5,
        networkName: 'Mein Netzwerk',
        savedAt: Date.now(),
        time: 0,
        credits: 800,
        research: 12,
        reputation: 12,
        lifetimeCredits: 0,
        sector: 1,
        servers: [
          {
            id: 'server-1',
            type: 'edge',
            name: 'Randknoten 01',
            level: 1,
            mode: 'balanced',
            condition: 100,
            status: 'online',
            fault: null,
            rackId: 'rack-1',
            unit: 2,
            port: 1,
            powered: true,
            bootRemaining: 0,
          },
        ],
        agents: [
          {
            id: 'agent-1',
            name: 'Mira',
            role: 'operator',
            level: 1,
            focus: 'income',
            trait: 'zuverlässig',
            assignment: null,
            cooldownUntil: 0,
          },
          {
            id: 'agent-2',
            name: 'Tarek',
            role: 'analyst',
            level: 1,
            focus: 'research',
            trait: 'neugierig',
            assignment: null,
            cooldownUntil: 0,
          },
        ],
        jobs: [
          {
            id: 'job-1',
            title: 'Telemetrie prüfen',
            client: 'Nordlicht Mobilität',
            kind: 'monitoring',
            totalWork: 84,
            work: 0,
            reward: 210,
            science: 5,
            rep: 3,
            load: 3.5,
          },
        ],
        offers: [],
        events: [],
        log: [],
        upgrades: {},
        policies: {
          power: 'balanced',
          autocontract: false,
          autorepair: true,
          priority: 'balanced',
          autobackup: true,
          repairBudget: 300,
          reserve: 250,
        },
        resilience: {
          graceUntil: 600,
          budgetWindowStart: 0,
          budgetSpent: 0,
          parts: 3,
          backupCooldownUntil: 0,
          autoBackupNextAt: 900,
          backup: null,
          operation: null,
          incident: null,
          corrupted: false,
          integrity: 100,
          agentEffects: { diagnoseRemaining: 0, optimizeRemaining: 0 },
        },
        facility: {
          racks: [
            {
              id: 'rack-1',
              name: 'Rack 01',
              roomId: 'room-1',
              switchLevel: 1,
              powerLevel: 1,
              coolingLevel: 1,
              disabledPorts: [],
            },
          ],
          operation: null,
          central: { ...CENTRAL_DEFAULTS },
          centralOperation: null,
          building: {
            version: 1,
            floors: 1,
            rooms: [{ id: 'room-1', floor: 1 }],
            specialRooms: [],
            project: null,
          },
        },
        history: [],
        achievements: {},
        achievementUnlocks: Object.fromEntries(catalog.achievements.map((a) => [a.id, false])),
        counters: { jobs: 0, events: 0, serversBought: 0, agentsHired: 0, sectors: 1 },
        timers: { offer: 22, event: 95, history: 30 },
        nextId: 3,
      };
      s.nextId = 3;
      s.business = context.businessDefaults(s);
      s.operations = context.operationsDefaults();
      context.migratePersonnel(s);
      context.migrateCustomers(s);
      context.migrateResearch(s);
      context.migratePlanning(s);
      s.offers.push(makeJob(s), makeJob(s));
      addLog(s, 'system', 'ROOT ist bereit. Dein erster Überwachungsauftrag läuft.');
      updateAchievementUnlocks(s);
      return s;
    }

    function updateAchievementUnlocks(s) {
      if (!s.achievementUnlocks)
        s.achievementUnlocks = Object.fromEntries(catalog.achievements.map((a) => [a.id, false]));
      for (const achievement of catalog.achievements) {
        if (s.achievementUnlocks[achievement.id]) continue;
        if (s.achievements[achievement.id] || achievement.check(s))
          s.achievementUnlocks[achievement.id] = true;
      }
    }
    return { rand, hasId, uid, addLog, createState, updateAchievementUnlocks };
  };
});
