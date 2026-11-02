/** Scheduled preventive rack maintenance; this domain owns no global state. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['preventive-maintenance'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createPreventiveMaintenance(context) {
    const DAY = 86400,
      MINUTE = 60,
      DEFAULT_THRESHOLD = 70,
      DEFAULT_MINIMUM_SUPPLY = 1,
      DEFAULT_DAILY_LIMIT = 2500;
    const addLog = (...args) => context.addLog(...args);
    const getMetrics = (...args) => context.getMetrics(...args);
    const agentProductive = (...args) => context.agentProductive(...args);
    const agentAvailable = (...args) => context.agentAvailable(...args);
    const globalIncident = (...args) => context.globalIncident(...args);
    const serverLinkState = (...args) => context.serverLinkState(...args);

    function preventiveMaintenanceDefaults(time = 0) {
      const dayStart = Math.floor(time / DAY) * DAY;
      return {
        version: 1,
        policy: {
          automatic: false,
          threshold: DEFAULT_THRESHOLD,
          earliestAt: 0,
          windowStart: 0,
          windowEnd: DAY - 1,
          minimumSupply: DEFAULT_MINIMUM_SUPPLY,
          dailyLimit: DEFAULT_DAILY_LIMIT,
        },
        dayStart,
        dailySpent: 0,
        nextCheck: Math.max(0, time),
        schedule: null,
        operation: null,
      };
    }

    function state(s) {
      return s.preventiveMaintenance || preventiveMaintenanceDefaults(s.time);
    }

    function currentRack(s, rackId) {
      return s.facility.racks.find((rack) => rack.id === rackId) || null;
    }

    function liveServers(s, rackId, threshold = DEFAULT_THRESHOLD) {
      const rack = currentRack(s, rackId);
      if (!rack) return [];
      return s.servers.filter(
        (server) =>
          server.rackId === rackId &&
          server.status === 'online' &&
          server.powered !== false &&
          server.condition < threshold &&
          (!serverLinkState || serverLinkState(s, server, rack)),
      );
    }

    function availableEngineer(s, agentId) {
      const agent = s.agents.find((item) => item.id === agentId),
        p = state(s);
      if (!agent || agent.role !== 'engineer') return null;
      if (p.operation?.agentId === agent.id) return null;
      if (agentAvailable && !agentAvailable(s, agent)) return null;
      if (agentProductive && !agentProductive(s, agent)) return null;
      return agent;
    }

    function conflictReason(s, agent) {
      const p = state(s);
      if (p.operation) return 'Eine vorbeugende Rackwartung läuft bereits.';
      if (s.resilience.operation || s.resilience.incident || globalIncident?.(s))
        return 'Eine Reparatur oder globale Krise blockiert die Wartung.';
      if (s.facility.operation || s.facility.centralOperation)
        return 'Ein anderer Anlagenauftrag blockiert die Wartung.';
      if (s.business.rooms.some((r) => r.conversion))
        return 'Ein anderer Anlagenauftrag blockiert die Wartung.';
      if (
        s.servers.some((server) => server.status === 'repairing') ||
        s.operations?.projects?.some((project) => project.agentId === agent?.id)
      )
        return 'Eine Reparatur oder ein Agentenprojekt blockiert die Wartung.';
      if (agent && (!availableEngineer(s, agent.id) || agent.assignment))
        return 'Der gewählte Techniker ist bereits anderweitig gebunden.';
      return '';
    }

    function projectedSupply(s, rackId, agent) {
      const metrics = getMetrics(s),
        testState = {
          ...s,
          agents: s.agents.map((item) =>
            item.id === agent.id
              ? { ...item, assignment: { kind: 'preventive-maintenance', label: 'Rackwartung' } }
              : item,
          ),
          facility: {
            ...s.facility,
            operation: { kind: 'preventive-maintenance', rackId },
          },
        },
        after = getMetrics(testState),
        denominator = Math.max(0, after.serviceUnits || 0);
      const worst = (m) =>
        Math.min(
          1,
          ...(m.serviceModel?.rooms || []).flatMap((r) =>
            r.groups.filter((g) => g.units > 0).map((g) => g.supplied),
          ),
        );
      return {
        before: Math.min(
          worst(metrics),
          metrics.serviceUnits > 0 ? metrics.serviceDelivered / metrics.serviceUnits : 1,
        ),
        after: Math.min(
          worst(after),
          denominator > 0 ? (after.serviceDelivered || 0) / denominator : 1,
        ),
      };
    }

    function quotePreventiveMaintenance(s, payload = {}) {
      const p = state(s),
        rack = currentRack(s, payload.rackId),
        threshold = payload.threshold ?? p.policy.threshold,
        servers = rack ? liveServers(s, rack.id, threshold) : [],
        agent = payload.deferred
          ? s.agents.find((item) => item.id === payload.agentId && item.role === 'engineer')
          : availableEngineer(s, payload.agentId),
        reason = !rack
          ? 'Serverrack nicht gefunden.'
          : !Number.isInteger(threshold) || threshold < 50 || threshold > 80
            ? 'Der Zustandsgrenzwert muss zwischen 50 und 80 Prozent liegen.'
            : !servers.length
              ? 'Dieses Rack enthält keine live geschalteten, wartungsbedürftigen Server.'
              : !agent
                ? 'Wähle einen verfügbaren Techniker für die Wartung.'
                : payload.deferred
                  ? p.operation || p.schedule
                    ? 'Eine Rackwartung läuft oder ist bereits terminiert.'
                    : ''
                  : conflictReason(s, agent);
      const scale = 1 + Math.max(0, s.sector - 1) * 0.18 + Math.max(0, s.servers.length - 1) * 0.03,
        cost = servers.reduce(
          (sum, server) =>
            sum + Math.ceil((38 + Math.max(0, 85 - server.condition) * 1.05) * scale),
          0,
        ),
        parts = Math.ceil(servers.length / 3),
        effort = 180 + servers.length * 90,
        speed = agent ? 1 + Math.min(1.5, Math.sqrt(Math.max(0, agent.level - 1)) * 0.2) : 1,
        duration = Math.ceil(effort / speed),
        downtime = Math.min(180, 30 + servers.length * 10),
        reserve = context.maintenancePolicy(s).reserve,
        service =
          !payload.deferred && rack && agent && servers.length
            ? projectedSupply(s, rack.id, agent)
            : null;
      let blocked = reason;
      if (!blocked && p.schedule && !payload.allowScheduled)
        blocked = 'Eine Rackwartung ist bereits terminiert.';
      if (!blocked && !payload.deferred && s.resilience.parts < parts)
        blocked = `Benötigt ${parts} Ersatzteile; vorhanden sind ${s.resilience.parts}.`;
      if (!blocked && !payload.deferred && s.credits - cost < reserve)
        blocked = 'Der Auftrag würde die geschützte Kreditreserve unterschreiten.';
      if (!blocked && !payload.deferred && p.dailySpent + cost > p.policy.dailyLimit)
        blocked = 'Das Tagesbudget für vorbeugende Wartung reicht nicht aus.';
      if (
        !blocked &&
        !payload.deferred &&
        service &&
        (service.before < p.policy.minimumSupply || service.after < p.policy.minimumSupply)
      )
        blocked = 'Die verbleibende Kundenversorgung läge unter der festgelegten Reserve.';
      return {
        enabled: !blocked,
        reason: blocked,
        rackId: rack?.id || payload.rackId || null,
        agentId: agent?.id || payload.agentId || null,
        threshold,
        servers: servers.map((server) => server.id),
        wornCount: servers.length,
        cost,
        parts,
        effort,
        duration,
        downtime,
        targetCondition: 85,
        supplyBefore: service?.before ?? null,
        supplyAfter: service?.after ?? null,
      };
    }

    function inWindow(time, start, end) {
      const clock = ((Math.floor(time) % DAY) + DAY) % DAY;
      return start <= end ? clock >= start && clock <= end : clock >= start || clock <= end;
    }

    function chooseAutomaticAgent(s) {
      const productive = s.agents
        .filter(
          (agent) =>
            agent.role === 'engineer' &&
            (!agentAvailable || agentAvailable(s, agent)) &&
            (!agentProductive || agentProductive(s, agent)) &&
            state(s).operation?.agentId !== agent.id,
        )
        .sort((a, b) => b.level - a.level || a.id.localeCompare(b.id));
      // Retain one active engineer for ordinary repairs, care and customer support.
      return productive.length > 1 ? productive[0] : null;
    }

    function begin(s, q, threshold, automatic) {
      const p = state(s);
      if (!q.enabled) return false;
      s.credits -= q.cost;
      s.resilience.parts -= q.parts;
      p.dailySpent += q.cost;
      p.operation = {
        rackId: q.rackId,
        agentId: q.agentId,
        startedAt: s.time,
        threshold,
        total: q.duration,
        remaining: q.duration,
        effort: q.effort,
        cost: q.cost,
        parts: q.parts,
        downtimeTotal: q.downtime,
        downtimeRemaining: q.downtime,
        targetCondition: q.targetCondition,
        serverIds: [...q.servers],
      };
      if (!automatic) p.schedule = null;
      addLog(
        s,
        'system',
        `Vorbeugende Rackwartung gestartet: ${q.rackId}; ${q.cost} Credits, ${q.parts} Ersatzteile, ${q.effort} Technikerarbeit.`,
      );
      return true;
    }

    function schedulePreventiveMaintenance(s, payload) {
      const p = state(s),
        q = quotePreventiveMaintenance(s, { ...payload, deferred: true });
      if (!q.enabled) return { ok: false, message: q.reason };
      const earliestAt = payload.earliestAt ?? s.time,
        windowStart = payload.windowStart ?? p.policy.windowStart,
        windowEnd = payload.windowEnd ?? p.policy.windowEnd,
        threshold = payload.threshold ?? p.policy.threshold;
      if (
        !Number.isSafeInteger(payload.ceiling ?? q.cost) ||
        (payload.ceiling ?? q.cost) < q.cost ||
        (payload.ceiling ?? q.cost) > 1e12 ||
        !Number.isFinite(earliestAt) ||
        earliestAt < 0 ||
        earliestAt > s.time + 30 * DAY ||
        !Number.isSafeInteger(windowStart) ||
        windowStart < 0 ||
        windowStart >= DAY ||
        !Number.isSafeInteger(windowEnd) ||
        windowEnd < 0 ||
        windowEnd >= DAY
      )
        return { ok: false, message: 'Zeitpunkt oder Wartungsfenster ist ungültig.' };
      p.schedule = {
        rackId: q.rackId,
        agentId: q.agentId,
        threshold,
        ceiling: payload.ceiling ?? q.cost,
        earliestAt: Math.max(s.time, earliestAt),
        windowStart,
        windowEnd,
        reason: '',
      };
      s.preventiveMaintenance = p;
      addLog(s, 'system', `Rackwartung für ${q.rackId} eingeplant.`);
      return { ok: true, message: 'Rackwartung wurde eingeplant.' };
    }

    function setPolicy(s, payload) {
      const p = state(s),
        policy = payload;
      if (
        typeof policy.automatic !== 'boolean' ||
        !Number.isInteger(policy.threshold) ||
        policy.threshold < 50 ||
        policy.threshold > 80 ||
        !Number.isFinite(policy.earliestAt) ||
        policy.earliestAt < 0 ||
        !Number.isSafeInteger(policy.windowStart) ||
        policy.windowStart < 0 ||
        policy.windowStart >= DAY ||
        !Number.isSafeInteger(policy.windowEnd) ||
        policy.windowEnd < 0 ||
        policy.windowEnd >= DAY ||
        !Number.isFinite(policy.minimumSupply) ||
        ![0.95, 1].includes(policy.minimumSupply) ||
        !Number.isSafeInteger(policy.dailyLimit) ||
        policy.dailyLimit < 0 ||
        policy.dailyLimit > 1e12
      )
        return { ok: false, message: 'Ungültige Richtlinie für vorbeugende Wartung.' };
      p.policy = {
        automatic: policy.automatic,
        threshold: policy.threshold,
        earliestAt: policy.earliestAt,
        windowStart: policy.windowStart,
        windowEnd: policy.windowEnd,
        minimumSupply: policy.minimumSupply,
        dailyLimit: policy.dailyLimit,
      };
      s.preventiveMaintenance = p;
      return { ok: true, message: 'Wartungsrichtlinie gespeichert.' };
    }

    function applyPreventiveMaintenance(s, action, payload = {}) {
      if (
        ![
          'schedulePreventiveMaintenance',
          'cancelPreventiveMaintenance',
          'setPreventiveMaintenancePolicy',
        ].includes(action)
      )
        return null;
      const p = state(s);
      if (action === 'schedulePreventiveMaintenance')
        return schedulePreventiveMaintenance(s, payload);
      if (action === 'cancelPreventiveMaintenance') {
        if (!p.schedule) return { ok: false, message: 'Es ist keine Wartung eingeplant.' };
        p.schedule = null;
        s.preventiveMaintenance = p;
        return { ok: true, message: 'Geplante Rackwartung entfernt.' };
      }
      if (action === 'setPreventiveMaintenancePolicy') return setPolicy(s, payload);
      return null;
    }

    function selectedAutoRack(s, threshold) {
      const racks = new Map(s.facility.racks.map((r) => [r.id, r]));
      let selected = null,
        condition = Infinity;
      for (const server of s.servers) {
        const rack = racks.get(server.rackId);
        if (
          rack &&
          server.status === 'online' &&
          server.powered &&
          server.condition < threshold &&
          serverLinkState(s, server, rack) &&
          (server.condition < condition ||
            (server.condition === condition && rack.id < selected.id))
        ) {
          selected = rack;
          condition = server.condition;
        }
      }
      return selected;
    }

    function complete(s) {
      const p = state(s),
        op = p.operation;
      if (!op) return;
      for (const id of op.serverIds) {
        const server = s.servers.find((item) => item.id === id),
          rack = currentRack(s, op.rackId);
        // Only live hardware receives care; a concurrent failure is never resurrected.
        if (
          server?.status === 'online' &&
          server.powered !== false &&
          (!serverLinkState || serverLinkState(s, server, rack))
        )
          server.condition = Math.min(100, Math.max(server.condition, op.targetCondition));
      }
      addLog(s, 'success', `Vorbeugende Rackwartung abgeschlossen: ${op.rackId}.`);
      p.operation = null;
    }

    function advancePreventiveMaintenance(s, dt = 1) {
      const p = state(s),
        step = Math.max(0, Math.min(1, Number.isFinite(dt) ? dt : 1));
      s.preventiveMaintenance ||= p;
      const dayStart = Math.floor(s.time / DAY) * DAY;
      if (dayStart > p.dayStart) {
        p.dayStart = dayStart;
        p.dailySpent = 0;
      }
      if (p.operation) {
        if (
          !globalIncident?.(s) &&
          agentAvailable(
            s,
            s.agents.find((a) => a.id === p.operation.agentId),
          )
        ) {
          p.operation.remaining = Math.max(0, p.operation.remaining - step);
          p.operation.downtimeRemaining = Math.max(0, p.operation.downtimeRemaining - step);
          if (p.operation.remaining <= 0) complete(s);
        }
      }
      if (s.time < p.nextCheck) return;
      p.nextCheck = s.time + MINUTE;
      if (
        p.operation ||
        s.resilience.operation ||
        s.resilience.incident ||
        s.facility.operation ||
        s.facility.centralOperation
      )
        return;
      const schedule = p.schedule,
        automatic = !schedule && p.policy.automatic;
      if (!schedule && !automatic) return;
      const earliestAt = schedule?.earliestAt ?? p.policy.earliestAt,
        windowStart = schedule?.windowStart ?? p.policy.windowStart,
        windowEnd = schedule?.windowEnd ?? p.policy.windowEnd,
        threshold = schedule?.threshold ?? p.policy.threshold;
      if (s.time < earliestAt || !inWindow(s.time, windowStart, windowEnd)) return;
      const agent = schedule ? availableEngineer(s, schedule.agentId) : chooseAutomaticAgent(s);
      if (!agent) {
        if (schedule) schedule.reason = 'Kein verfügbarer Techniker; der Termin wartet.';
        return;
      }
      const rack = schedule ? currentRack(s, schedule.rackId) : selectedAutoRack(s, threshold);
      if (!rack) {
        if (schedule) schedule.reason = 'Das Rack ist nicht mehr vorhanden.';
        return;
      }
      const q = quotePreventiveMaintenance(s, {
        rackId: rack.id,
        agentId: agent.id,
        threshold,
        allowScheduled: Boolean(schedule),
      });
      if (!q.enabled) {
        if (schedule) schedule.reason = q.reason;
        return;
      }
      if (schedule && q.cost > schedule.ceiling) {
        schedule.reason = 'Der aktuelle Preis überschreitet deine Freigabe.';
        return;
      }
      begin(s, q, threshold, automatic);
    }

    function preventiveRackOffline(s, rackId) {
      const op = state(s).operation;
      return Boolean(op && op.rackId === rackId && op.downtimeRemaining > 0);
    }

    function preventiveAgentBusy(s, agentId) {
      return Boolean(state(s).operation?.agentId === agentId);
    }

    return {
      preventiveMaintenanceDefaults,
      quotePreventiveMaintenance,
      applyPreventiveMaintenance,
      advancePreventiveMaintenance,
      preventiveRackOffline,
      preventiveAgentBusy,
      normalizePreventiveMaintenance: (...args) => context.readPreventiveMaintenance(...args),
    };
  };
});
