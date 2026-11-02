/** Save v2: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['save-v2'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    const {
      catalog,
      ROLES,
      FOCI,
      MODES,
      JOB_KINDS,
      MAX,
      MAX_RESEARCH_LEVEL,
      MAX_CONDITION,
      RESILIENCE_MAX,
      clamp,
      finite,
      own,
    } = context;
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const createState = (...args) => context.createState(...args);
    const getServerLimit = (...args) => context.getServerLimit(...args);

    function normalizeV2(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new Error('Ungültiger Netzwerkstand.');
      if (input.version !== 2)
        throw new Error('Diese Netzwerkstand-Version wird nicht unterstützt.');
      const s = createState(12345);
      const num = (v, k, lo = 0, hi = 1e15) => {
        if (!finite(v)) throw new Error('Ungültiger Zahlenwert: ' + k);
        return clamp(v, lo, hi);
      };
      const str = (v, k, max = 180) => {
        if (typeof v !== 'string' || v.length > max) throw new Error('Ungültiger Textwert: ' + k);
        return v;
      };
      const arr = (v, k, max) => {
        if (!Array.isArray(v) || v.length > max) throw new Error('Ungültige Liste: ' + k);
        return v;
      };
      const idCheck = (v, k, seen) => {
        str(v, k, 64);
        if (!/^[a-z][a-z0-9-]{0,63}$/i.test(v) || seen.has(v))
          throw new Error('Ungültige oder doppelte ID: ' + k);
        seen.add(v);
        return v;
      };
      s.seed = Number.isInteger(input.seed) ? input.seed >>> 0 : 12345;
      s.rng = Number.isInteger(input.rng) ? input.rng >>> 0 : s.seed || 0x6d2b79f5;
      s.networkName = str(input.networkName ?? s.networkName, 'networkName', 36);
      if (s.networkName.trim().length < 2) throw new Error('Ungültiger Netzwerkname.');
      s.savedAt = num(input.savedAt ?? Date.now(), 'savedAt', 0, 8.64e15);
      s.time = num(input.time ?? 0, 'time');
      s.credits = num(input.credits, 'credits');
      s.research = num(input.research, 'research');
      s.reputation = num(input.reputation ?? 0, 'reputation', 0, 1e6);
      s.lifetimeCredits = num(input.lifetimeCredits ?? 0, 'lifetimeCredits');
      s.sector = Math.floor(num(input.sector ?? 1, 'sector', 1, 1e6));
      const seen = new Set();
      s.servers = arr(input.servers, 'servers', MAX.servers).map((x) => {
        if (!x || !own(catalog.servers, x.type)) throw new Error('Ungültiger Servertyp.');
        if (!MODES.includes(x.mode)) throw new Error('Ungültiger Servermodus.');
        if (
          !['online', 'failed', 'repairing'].includes(x.status) ||
          (x.fault !== null && typeof x.fault !== 'string')
        )
          throw new Error('Ungültiger Serverzustand.');
        const condition = num(x.condition, 'server.condition', 0, MAX_CONDITION);
        if (x.status === 'online' && condition <= 0)
          throw new Error('Ein aktiver Server braucht positiven Zustand.');
        return {
          id: idCheck(x.id, 'server.id', seen),
          type: x.type,
          name: str(x.name, 'server.name', 36),
          level: Math.floor(num(x.level, 'server.level', 1, 10000)),
          mode: x.mode,
          condition,
          status: x.status,
          fault: x.fault === null ? null : str(x.fault, 'server.fault', 64),
        };
      });
      s.agents = arr(input.agents, 'agents', MAX.agents).map((x) => {
        if (!x || !ROLES.includes(x.role) || !FOCI.includes(x.focus))
          throw new Error('Ungültige Agentenrolle oder Schwerpunkt.');
        let assignment = null;
        if (x.assignment !== null) {
          const a = x.assignment;
          if (!a || typeof a !== 'object' || !['diagnose', 'optimize', 'research'].includes(a.kind))
            throw new Error('Ungültiger Agenteneinsatz.');
          const expected =
            a.kind === 'diagnose'
              ? x.role === 'engineer'
                ? 90
                : 120
              : a.kind === 'optimize'
                ? x.role === 'operator'
                  ? 120
                  : 180
                : x.role === 'analyst'
                  ? 240
                  : 300;
          const total = Math.floor(num(a.total, 'agent.assignment.total', 1, 3600));
          if (total !== expected) throw new Error('Unplausible Einsatzdauer.');
          if (num(x.cooldownUntil, 'agent.cooldownUntil', 0, 1e15) > s.time)
            throw new Error('Agent kann während einer Abklingzeit nicht im Einsatz sein.');
          assignment = {
            kind: a.kind,
            label: str(a.label, 'agent.assignment.label', 48),
            remaining: num(a.remaining, 'agent.assignment.remaining', 0, total),
            total,
          };
        }
        return {
          id: idCheck(x.id, 'agent.id', seen),
          name: str(x.name, 'agent.name', 24),
          role: x.role,
          level: Math.floor(num(x.level, 'agent.level', 1, 10000)),
          focus: x.focus,
          trait: str(x.trait || '', 'agent.trait', 40),
          assignment,
          cooldownUntil: num(x.cooldownUntil, 'agent.cooldownUntil', 0, 1e15),
        };
      });
      const readJobs = (arrInput, key, max) =>
        arr(arrInput, key, max).map((x) => {
          if (!x || !JOB_KINDS.includes(x.kind)) throw new Error('Ungültige Auftragsart.');
          const totalWork = num(x.totalWork, 'job.totalWork', 0.001, 1e12),
            work = num(x.work, 'job.work', 0, totalWork);
          const gpuDemand = x.kind === 'ai' ? (x.gpuDemand ?? 1) : undefined;
          if (
            gpuDemand !== undefined &&
            (!Number.isInteger(gpuDemand) || gpuDemand < 1 || gpuDemand > 4)
          )
            throw new Error('Ungültiger GPU-Bedarf.');
          return {
            id: idCheck(x.id, key + '.id', seen),
            title: str(x.title, 'job.title', 64),
            client: str(x.client, 'job.client', 64),
            kind: x.kind,
            ...(gpuDemand === undefined ? {} : { gpuDemand }),
            totalWork,
            work,
            reward: num(x.reward, 'job.reward'),
            science: num(x.science, 'job.science', 0, 1e9),
            rep: num(x.rep, 'job.rep', 0, 1e9),
            load: num(x.load, 'job.load', 0, 1e9),
          };
        });
      s.jobs = readJobs(input.jobs, 'jobs', MAX.jobs);
      s.offers = readJobs(input.offers, 'offers', MAX.offers);
      s.events = arr(input.events, 'events', MAX.events).map((e) => {
        const eventKeys = {
          signal: ['signal_analyze', 'signal_license'],
          grant: ['grant_funds', 'grant_research'],
          maintenance: ['maintenance_care', 'maintenance_study'],
          client: ['client_help', 'client_knowledge'],
          discovery: ['discovery_research', 'discovery_publish'],
          procurement: ['procurement_funds', 'procurement_evaluate'],
        };
        if (!e || !own(eventKeys, e.kind)) throw new Error('Ungültiges Ereignis.');
        const choices = arr(e.choices, 'event.choices', 4).map((c) => {
          if (!c || !eventKeys[e.kind].includes(c.key))
            throw new Error('Ungültige Ereignisauswahl.');
          return {
            label: str(c.label, 'choice.label', 48),
            description: str(c.description, 'choice.description', 120),
            key: c.key,
          };
        });
        if (choices.length < 2) throw new Error('Ereignis ohne Auswahl.');
        return {
          id: idCheck(e.id, 'event.id', seen),
          title: str(e.title, 'event.title', 64),
          description: str(e.description, 'event.description', 180),
          kind: e.kind,
          choices,
        };
      });
      s.log = arr(input.log ?? [], 'log', MAX.log).map((l) => ({
        id: idCheck(l.id, 'log.id', seen),
        time: num(l.time, 'log.time'),
        type: str(l.type, 'log.type', 24),
        message: str(l.message, 'log.message', 180),
      }));
      const upgradeInput = input.upgrades ?? {};
      if (!upgradeInput || typeof upgradeInput !== 'object' || Array.isArray(upgradeInput))
        throw new Error('Ungültige Forschung.');
      for (const u of catalog.research)
        if (own(upgradeInput, u.id))
          s.upgrades[u.id] = Math.floor(num(upgradeInput[u.id], 'upgrade', 0, MAX_RESEARCH_LEVEL));
      const p = input.policies || {};
      if (
        !['balanced', 'performance', 'eco'].includes(p.power) ||
        !['balanced', 'income', 'research'].includes(p.priority) ||
        typeof p.autocontract !== 'boolean' ||
        typeof p.autorepair !== 'boolean' ||
        typeof p.autobackup !== 'boolean' ||
        ![0, 100, 300, 1000].includes(p.repairBudget) ||
        ![0, 250, 1000, 5000].includes(p.reserve)
      )
        throw new Error('Ungültige Richtlinien.');
      s.policies = {
        power: p.power,
        priority: p.priority,
        autocontract: p.autocontract,
        autorepair: p.autorepair,
        autobackup: p.autobackup,
        repairBudget: p.repairBudget,
        reserve: p.reserve,
      };
      s.history = arr(input.history ?? [], 'history', MAX.history).map((h) => ({
        time: num(h.time, 'history.time'),
        credits: num(h.credits, 'history.credits'),
        income: num(h.income, 'history.income', -1e9, 1e9),
        load: num(h.load, 'history.load', 0, 1e6),
      }));
      const ach = input.achievements || {};
      if (!ach || typeof ach !== 'object' || Array.isArray(ach))
        throw new Error('Ungültige Meilensteine.');
      for (const a of catalog.achievements) s.achievements[a.id] = ach[a.id] === true;
      const unlocks = input.achievementUnlocks;
      if (!unlocks || typeof unlocks !== 'object' || Array.isArray(unlocks))
        throw new Error('Ungültige Meilensteinfreigaben.');
      s.achievementUnlocks = {};
      for (const a of catalog.achievements) {
        // Added milestones are absent in older saves. Original keys and present values stay strict.
        if (
          (!Object.hasOwn(unlocks, a.id) && a.legacy) ||
          (Object.hasOwn(unlocks, a.id) && typeof unlocks[a.id] !== 'boolean')
        )
          throw new Error('Ungültige Meilensteinfreigabe: ' + a.id);
        s.achievementUnlocks[a.id] = unlocks[a.id] === true || s.achievements[a.id];
      }
      const c = input.counters || {};
      s.counters = {
        jobs: Math.floor(num(c.jobs ?? 0, 'counters.jobs')),
        events: Math.floor(num(c.events ?? 0, 'counters.events')),
        serversBought: Math.floor(num(c.serversBought ?? 0, 'counters.serversBought')),
        agentsHired: Math.floor(num(c.agentsHired ?? 0, 'counters.agentsHired')),
        sectors: Math.floor(num(c.sectors ?? s.sector, 'counters.sectors')),
      };
      const t = input.timers || {};
      s.timers = {
        offer: num(t.offer ?? 20, 'timers.offer', 0, 1e6),
        event: num(t.event ?? 90, 'timers.event', 0, 1e6),
        history: num(t.history ?? 30, 'timers.history', 0, 30),
      };
      const r = input.resilience;
      if (!r || typeof r !== 'object' || Array.isArray(r))
        throw new Error('Ungültige Betriebsabsicherung.');
      const snap = r.backup;
      let backup = null;
      if (snap !== null) {
        if (!snap || typeof snap !== 'object' || Array.isArray(snap))
          throw new Error('Ungültige Betriebssicherung.');
        const backupIds = new Set();
        const backupJobs = arr(snap.jobs, 'backup.jobs', RESILIENCE_MAX.backupJobs).map((j) => {
          if (
            !j ||
            typeof j.id !== 'string' ||
            !/^[a-z][a-z0-9-]{0,63}$/i.test(j.id) ||
            backupIds.has(j.id)
          )
            throw new Error('Ungültiger gesicherter Auftragsverweis.');
          backupIds.add(j.id);
          return { id: j.id, work: num(j.work, 'backup.job.work', 0, 1e12) };
        });
        const research = num(snap.research, 'backup.research');
        const protectedResearch = num(
          snap.protectedResearch,
          'backup.protectedResearch',
          0,
          research,
        );
        backup = {
          createdAt: num(snap.createdAt, 'backup.createdAt', 0, s.time),
          research,
          protectedResearch,
          jobs: backupJobs,
        };
      }
      const readWorkLosses = (rows) =>
        arr(rows || [], 'operation.workLosses', MAX.jobs).map((row) => {
          if (!row || typeof row.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/i.test(row.id))
            throw new Error('Ungültiger Auftragsverlust.');
          return { id: row.id, amount: num(row.amount, 'operation.workLoss', 0, 1e12) };
        });
      const readConditions = (rows) =>
        arr(rows || [], 'operation.conditions', RESILIENCE_MAX.incidentAffected).map((row) => {
          if (
            !row ||
            typeof row.id !== 'string' ||
            !s.servers.some((server) => server.id === row.id)
          )
            throw new Error('Ungültiger Wiederherstellungsknoten.');
          return {
            id: row.id,
            condition: num(row.condition, 'operation.condition', 0, MAX_CONDITION),
          };
        });
      let incident = null;
      if (r.incident !== null) {
        const e = r.incident;
        const kinds = ['power', 'cooling', 'corruption'];
        if (!e || typeof e !== 'object' || !kinds.includes(e.kind))
          throw new Error('Ungültiger Krisenfall.');
        const affected = arr(e.affected, 'incident.affected', RESILIENCE_MAX.incidentAffected).map(
          (id) => {
            if (typeof id !== 'string' || !s.servers.some((server) => server.id === id))
              throw new Error('Ungültiger Krisenknoten.');
            return id;
          },
        );
        if (!affected.length || new Set(affected).size !== affected.length)
          throw new Error('Krise ohne eindeutige betroffene Knoten.');
        const resolutions = {
          power: ['reroute', 'replace', 'manual'],
          cooling: ['shed_load', 'cooling_unit', 'manual'],
          corruption: ['restore_backup', 'rebuild', 'manual'],
        };
        const resolution =
          e.resolution === null ? null : str(e.resolution, 'incident.resolution', 32);
        if (resolution !== null && !resolutions[e.kind].includes(resolution))
          throw new Error('Ungültige Krisenmaßnahme.');
        incident = {
          id: idCheck(e.id, 'incident.id', seen),
          kind: e.kind,
          title: str(e.title, 'incident.title', 64),
          description: str(e.description, 'incident.description', 240),
          consequence: str(e.consequence, 'incident.consequence', 240),
          affected,
          resolution,
        };
      }
      let operation = null;
      if (r.operation !== null) {
        const op = r.operation;
        if (
          !op ||
          typeof op !== 'object' ||
          !['backup', 'repair', 'power', 'cooling', 'corruption'].includes(op.kind) ||
          !op.effect ||
          typeof op.effect !== 'object' ||
          Array.isArray(op.effect)
        )
          throw new Error('Ungültiger Betriebsablauf.');
        const total = num(op.total, 'operation.total', 0.001, 1e9),
          remaining = num(op.remaining, 'operation.remaining', 0, total);
        const serverId = op.serverId === null ? null : str(op.serverId, 'operation.serverId', 64);
        if (serverId !== null && !s.servers.some((server) => server.id === serverId))
          throw new Error('Unbekannter Wartungsknoten.');
        let effect;
        if (op.kind === 'backup') {
          if (op.effect.snapshot !== true || serverId !== null)
            throw new Error('Ungültiger Sicherungsablauf.');
          effect = { snapshot: true };
        } else if (op.kind === 'repair') {
          if (!serverId) throw new Error('Reparatur ohne Zielknoten.');
          effect = {
            condition: num(op.effect.condition, 'operation.condition', 0, MAX_CONDITION),
            workLosses: readWorkLosses(op.effect.workLosses),
            reputationLoss: num(op.effect.reputationLoss, 'operation.reputationLoss', 0, 1e6),
          };
        } else {
          if (
            !incident ||
            incident.kind !== op.kind ||
            incident.resolution === null ||
            serverId !== null
          )
            throw new Error('Krisenablauf ohne passende offene Krise.');
          effect = {
            conditions: readConditions(op.effect.conditions),
            integrity: num(op.effect.integrity, 'operation.integrity', 0, 100),
            reputationLoss: num(op.effect.reputationLoss, 'operation.reputationLoss', 0, 1e6),
            clearCorruption: op.effect.clearCorruption === true,
            workLosses: readWorkLosses(op.effect.workLosses),
            restoreSnapshot: op.effect.restoreSnapshot === true,
          };
          if (own(op.effect, 'research'))
            effect.research = num(op.effect.research, 'operation.research');
          if (op.effect.restoreSnapshot && (!backup || op.kind !== 'corruption'))
            throw new Error('Wiederherstellung ohne gültige Sicherung.');
        }
        operation = {
          kind: op.kind,
          label: str(op.label, 'operation.label', 64),
          remaining,
          total,
          serverId,
          cost: num(op.cost ?? 0, 'operation.cost'),
          effect,
        };
      }
      if (
        incident &&
        (incident.resolution !== null) !== Boolean(operation && operation.kind === incident.kind)
      )
        throw new Error('Krisenstatus und laufende Maßnahme stimmen nicht überein.');
      if (!incident && operation && !['backup', 'repair'].includes(operation.kind))
        throw new Error('Krisenmaßnahme ohne offenen Krisenfall.');
      const repairingServers = s.servers.filter((server) => server.status === 'repairing');
      if (
        repairingServers.length > 1 ||
        (repairingServers.length &&
          (!operation ||
            operation.kind !== 'repair' ||
            operation.serverId !== repairingServers[0].id))
      )
        throw new Error('Wartungsstatus und laufender Ablauf stimmen nicht überein.');
      if (
        operation &&
        operation.kind === 'repair' &&
        !repairingServers.some((server) => server.id === operation.serverId)
      )
        throw new Error('Reparaturziel ist nicht in Wartung.');
      if (
        incident &&
        incident.affected.some(
          (id) => !s.servers.some((server) => server.id === id && server.status === 'failed'),
        )
      )
        throw new Error('Betroffener Krisenknoten ist nicht ausgefallen.');
      const budgetWindowStart = num(r.budgetWindowStart, 'resilience.budgetWindowStart', 0, s.time);
      if (s.time - budgetWindowStart >= 3600) throw new Error('Ungültiges Wartungsbudget-Fenster.');
      const agentEffects = r.agentEffects;
      if (!agentEffects || typeof agentEffects !== 'object' || Array.isArray(agentEffects))
        throw new Error('Ungültige Agentenwirkungen.');
      s.resilience = {
        graceUntil: num(r.graceUntil, 'resilience.graceUntil', 0, 1e15),
        budgetWindowStart,
        budgetSpent: num(r.budgetSpent, 'resilience.budgetSpent', 0, 1000),
        parts: Math.floor(num(r.parts, 'resilience.parts', 0, RESILIENCE_MAX.parts)),
        backupCooldownUntil: num(r.backupCooldownUntil, 'resilience.backupCooldownUntil', 0, 1e15),
        autoBackupNextAt: num(r.autoBackupNextAt, 'resilience.autoBackupNextAt', 0, 1e15),
        backup,
        operation,
        incident,
        corrupted: r.corrupted === true,
        integrity: num(r.integrity, 'resilience.integrity', 0, 100),
        agentEffects: {
          diagnoseRemaining: num(
            agentEffects.diagnoseRemaining,
            'agentEffects.diagnoseRemaining',
            0,
            1200,
          ),
          optimizeRemaining: num(
            agentEffects.optimizeRemaining,
            'agentEffects.optimizeRemaining',
            0,
            900,
          ),
        },
      };
      if (
        typeof r.corrupted !== 'boolean' ||
        s.resilience.corrupted !== Boolean(incident && incident.kind === 'corruption')
      )
        throw new Error('Datenintegrität passt nicht zum Krisenstatus.');
      for (const kind of ['diagnose', 'optimize', 'research']) {
        const assignments = s.agents.filter(
          (agent) => agent.assignment && agent.assignment.kind === kind,
        ).length;
        const active =
          kind === 'diagnose'
            ? s.resilience.agentEffects.diagnoseRemaining > 0
            : kind === 'optimize'
              ? s.resilience.agentEffects.optimizeRemaining > 0
              : false;
        if (assignments > 1 || (assignments && active))
          throw new Error('Agenteneffekte dürfen nicht parallel gestapelt werden.');
      }
      if (
        s.servers.filter((server) => server.status === 'failed').length >
        RESILIENCE_MAX.incidentAffected
      )
        throw new Error('Zu viele ausgefallene Server.');
      s.nextId = Math.floor(num(input.nextId ?? 1, 'nextId', 1, 1e9));
      if (!s.servers.length || !s.agents.length)
        throw new Error('Ein Netzwerkstand braucht mindestens einen Server und einen Agenten.');
      if (
        s.servers.length > getServerLimit(s) ||
        s.agents.length > Math.min(MAX.agents, 3 + s.sector * 2)
      )
        throw new Error('Netzwerkstand überschreitet Sektorgrenzen.');
      const maxNumericId = [...seen].reduce((max, id) => {
        const match = /-(\d+)$/.exec(id);
        return match ? Math.max(max, Number(match[1])) : max;
      }, 0);
      s.nextId = Math.max(s.nextId, maxNumericId + 1);
      if (s.nextId > 1e9) throw new Error('nextId liegt außerhalb des unterstützten Bereichs.');
      // Only schema fields are copied; unknown outer and nested properties are ignored.
      return s;
    }
    return { normalizeV2 };
  };
});
