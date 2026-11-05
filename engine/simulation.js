/** Simulation: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['simulation'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    const { MAX, MAX_CONDITION, CENTRAL_SYSTEMS, clamp, finite } = context;
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const addLog = (...args) => context.addLog(...args);
    const advanceTemperatures = (...args) => context.advanceTemperatures(...args);
    const autoContract = (...args) => context.autoContract(...args);
    const finishAgentMission = (...args) => context.finishAgentMission(...args);
    const finishOperation = (...args) => context.finishOperation(...args);
    const getMetrics = (...args) => context.getMetrics(...args);
    const makeEvent = (...args) => context.makeEvent(...args);
    const makeJob = (...args) => context.makeJob(...args);
    const openMajorIncident = (...args) => context.openMajorIncident(...args);
    const openMinorFailure = (...args) => context.openMinorFailure(...args);
    const rand = (...args) => context.rand(...args);
    const serverLinkState = (...args) => context.serverLinkState(...args);
    const startAutomaticBackup = (...args) => context.startAutomaticBackup(...args);
    const startAutomaticRepair = (...args) => context.startAutomaticRepair(...args);
    const updateAchievementUnlocks = (...args) => context.updateAchievementUnlocks(...args);

    function advance(s, seconds) {
      let remaining = clamp(finite(seconds) ? seconds : 0, 0, 43200),
        completed = 0,
        eventCount = 0;
      const initialCredits = s.credits,
        initialResearch = s.research;
      const constructionCompleted = [];
      const researchCompleted = [];
      const upgradesCompleted = [];
      const rackById = new Map(s.facility.racks.map((rack) => [rack.id, rack]));
      // One-second deterministic slices keep work, rewards, and generated opportunities consistent online/offline.
      while (remaining > 0) {
        const batch = s.facility.operation?.kind === 'rack-batch' ? s.facility.operation : null;
        const dt = Math.min(
          1,
          remaining,
          batch ? batch.noticeRemaining || batch.remaining : Infinity,
        );
        remaining -= dt;
        s.time += dt;
        context.advancePersonnel(s, s.time - dt);
        advanceTemperatures(s, dt);
        const r = s.resilience;
        const incidentAtStart = Boolean(r.incident);
        const budgetWindow = Math.floor(s.time / 3600) * 3600;
        if (budgetWindow > r.budgetWindowStart) {
          r.budgetWindowStart = budgetWindow;
          r.budgetSpent = 0;
          if (s.operations) {
            s.operations.backupSpent = 0;
            s.operations.partsSpent = 0;
            s.operations.planSpent = 0;
          }
        }
        const m = getMetrics(s);
        const earned = m.incomePerSecond * dt;
        s.credits += earned;
        s.lifetimeCredits += Math.max(0, earned);
        if (s.business) {
          s.business.revenue = Math.min(1e15, s.business.revenue + m.serviceIncome * dt);
          s.business.wages = Math.min(1e15, s.business.wages + m.personnelCost * dt);
          s.business.delivered = Math.min(1e15, s.business.delivered + m.serviceDelivered * dt);
          s.business.unserved = Math.min(
            1e15,
            s.business.unserved + (m.serviceUnits - m.serviceDelivered) * dt,
          );
          const announced = context.announcedMaintenanceSupply(s);
          context.advanceServices(s, dt);
          context.advanceCustomers(s, dt, m.customerSupply, announced);
          context.advanceSupply(s, dt);
        }
        const researchNotice = context.advanceResearch(s, dt, m);
        if (researchNotice) researchCompleted.push(researchNotice);
        s.research += m.researchPerSecond * dt;
        if (s.jobs.length) {
          for (const j of s.jobs)
            j.work = clamp(j.work + Math.max(0, m.jobRates[j.id] || 0) * dt, 0, j.totalWork);
          const done = s.jobs.filter((j) => j.work >= j.totalWork);
          if (done.length) {
            for (const j of done) {
              const reward =
                j.reward *
                (1 + (s.upgrades.market || 0) * 0.1) *
                (j.kind === 'ai' ? context.researchEffects(s).aiReward : 1);
              s.credits += reward;
              s.lifetimeCredits += reward;
              s.research += j.science;
              s.reputation = clamp(s.reputation + j.rep, 0, 1e6);
              s.counters.jobs++;
              completed++;
              addLog(
                s,
                'success',
                `${j.title} für ${j.client} abgeschlossen: ${Math.round(reward)} Credits.`,
                'jobs',
              );
            }
            s.jobs = s.jobs.filter((j) => j.work < j.totalWork);
          }
        }
        s.timers.offer -= dt;
        s.timers.event -= dt;
        s.timers.history -= dt;
        if (s.timers.offer <= 0) {
          // Pending offers are not obligations. A full, entirely infeasible
          // automatic queue must not permanently prevent new business.
          if (s.policies.autocontract && !s.jobs.length && s.offers.length === MAX.offers) {
            const fit = s.offers.some((job) =>
              s.business
                ? context.jobsFit(s, job, m.admissionResources)
                : job.load <= m.capacity * 0.98 &&
                  (job.kind !== 'ai' || job.gpuDemand <= m.gpuCapacity),
            );
            if (!fit) s.offers.shift();
          }
          if (s.offers.length < MAX.offers) s.offers.push(makeJob(s));
          s.timers.offer = 38 + rand(s) * 34;
        }
        autoContract(s);
        if (s.timers.event <= 0) {
          if (s.events.length < MAX.events) {
            s.events.push(makeEvent(s));
            eventCount++;
          }
          s.timers.event = 145 + rand(s) * 100;
        }
        if (s.timers.history <= 0) {
          const mm = getMetrics(s);
          s.history.push({
            time: s.time,
            credits: s.credits,
            income: mm.incomePerSecond,
            load: mm.load,
          });
          if (s.history.length > MAX.history) s.history.shift();
          s.timers.history = 30;
        }
        let repairedThisStep = null,
          operationFinished = false;
        if (r.operation) {
          if (r.operation.kind === 'repair' && r.operation.remaining <= dt)
            repairedThisStep = r.operation.serverId;
          r.operation.remaining = Math.max(0, r.operation.remaining - dt);
          if (r.operation.remaining <= 0) {
            finishOperation(s);
            operationFinished = true;
          }
        }
        for (const server of s.servers)
          if (server.bootRemaining > 0)
            server.bootRemaining = Math.max(0, server.bootRemaining - dt);
        const batchResult = context.advanceRackMaintenance(s, dt);
        if (typeof batchResult === 'string') upgradesCompleted.push(batchResult);
        if (!batchResult && s.facility.operation) {
          s.facility.operation.remaining = Math.max(0, s.facility.operation.remaining - dt);
          if (s.facility.operation.remaining <= 0) {
            const op = s.facility.operation,
              rack = s.facility.racks.find((x) => x.id === op.rackId);
            if (rack) rack[op.kind + 'Level'] = op.targetLevel;
            const message = `${op.label} in ${rack ? rack.name : 'Rack'} abgeschlossen. Versorgung und Verbindungen sind wieder verfügbar.`;
            addLog(s, 'success', message, 'upgrades');
            upgradesCompleted.push(message);
            s.facility.operation = null;
          }
        }
        if (s.facility.centralOperation) {
          s.facility.centralOperation.remaining = Math.max(
            0,
            s.facility.centralOperation.remaining - dt,
          );
          if (s.facility.centralOperation.remaining <= 0) {
            const op = s.facility.centralOperation,
              system = CENTRAL_SYSTEMS.find((item) => item.id === op.system);
            s.facility.central[op.system] = op.targetLevel;
            const message = `${system.name} auf Stufe ${op.targetLevel} ausgebaut.`;
            addLog(s, 'success', message, 'upgrades');
            upgradesCompleted.push(message);
            s.facility.centralOperation = null;
          }
        }
        const constructionMessage = context.advanceConstruction(s, dt);
        if (constructionMessage) {
          constructionCompleted.push(constructionMessage);
          context.syncServiceRooms(s);
        }
        if (!context.globalIncident(s)) {
          r.agentEffects.diagnoseRemaining = Math.max(0, r.agentEffects.diagnoseRemaining - dt);
          r.agentEffects.optimizeRemaining = Math.max(0, r.agentEffects.optimizeRemaining - dt);
          for (const agent of s.agents) {
            if (!agent.assignment || !context.agentAvailable(s, agent)) continue;
            agent.assignment.remaining = Math.max(0, agent.assignment.remaining - dt);
            if (agent.assignment.remaining <= 0) finishAgentMission(s, agent);
          }
        }
        if (!incidentAtStart && !r.incident && !operationFinished && s.time >= r.graceUntil) {
          const wearPerHour = context.serverWearPerHour(s, m);
          for (const server of s.servers)
            if (
              serverLinkState(s, server, rackById.get(server.rackId)) &&
              server.id !== repairedThisStep
            )
              server.condition = clamp(
                server.condition - (wearPerHour * dt) / 3600,
                1,
                MAX_CONDITION,
              );
          const probability = 1 - Math.pow(1 - m.riskPerHour / 100, dt / 3600);
          if (
            !r.operation &&
            !s.facility.operation &&
            !s.facility.centralOperation &&
            rand(s) < probability
          ) {
            if (rand(s) < 0.24) openMinorFailure(s);
            else openMajorIncident(s);
          }
        }
        if (r.incident) context.startAutomaticReroute(s);
        else {
          if (!r.operation) startAutomaticRepair(s);
          if (!r.operation) startAutomaticBackup(s);
        }
        context.advanceOperations(s, dt);
        context.advancePreventiveMaintenance(s, dt);
        context.advanceGrowth(s, dt);
        s.credits = clamp(s.credits, 0, 1e15);
        s.research = clamp(s.research, 0, 1e15);
        s.lifetimeCredits = clamp(s.lifetimeCredits, 0, 1e15);
        updateAchievementUnlocks(s);
      }
      updateAchievementUnlocks(s);
      return {
        seconds: clamp(finite(seconds) ? seconds : 0, 0, 43200),
        credits: s.credits - initialCredits,
        research: s.research - initialResearch,
        jobsCompleted: completed,
        eventCount,
        constructionCompleted,
        researchCompleted,
        upgradesCompleted,
      };
    }
    return { advance };
  };
});
