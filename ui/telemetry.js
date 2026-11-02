/** telemetry UI: reads current state through the controller context. */
export function createTelemetryUI(ctx) {
  function stateSignature() {
    // Only changed lists on the visible page require new markup. Timers,
    // counters, affordability and chart samples are updated in place.
    const protection = [
      ctx.protectionSignature(),
      ctx.agentSignature(),
      ctx.pendingAchievements().map((a) => a.id),
      ctx.R.signature(),
      JSON.stringify(ctx.state.facility.central),
      ctx.state.facility.centralOperation?.system,
      ctx.facilitySignature(),
      ctx.businessSignature?.(),
      ctx.operationsSignature?.(),
      ctx.growthSignature?.(),
      ctx.preventiveSignature?.(),
      ctx.researchSignature?.(),
    ].join('|');
    if (ctx.view === 'overview')
      return [
        protection,
        ctx.state.jobs.map((x) => x.id),
        ctx.state.events.map((x) => x.id),
        ctx.state.log[0]?.id,
      ].join('|');
    if (ctx.view === 'jobs')
      return [
        protection,
        ctx.state.jobs.map((x) => x.id),
        ctx.state.offers.map((x) => x.id),
        ctx.state.counters.jobs,
      ].join('|');
    if (ctx.view === 'inbox') return protection + '|' + ctx.state.events.map((x) => x.id).join('|');
    if (ctx.view === 'log') return protection + '|' + (ctx.state.log[0]?.id || '');
    return protection;
  }

  function updateLive() {
    if (!ctx.state) return;
    ctx.updatePersonnel?.();
    ctx.updateRoomOperations?.();
    ctx.updateOperations?.();
    ctx.updateGrowth?.();
    ctx.updatePreventive?.();
    if (ctx.view === 'facility') ctx.updateCentralTelemetry();
    const m = ctx.E.getMetrics(ctx.state),
      facility = ctx.E.getRackModel(ctx.state, m),
      r = ctx.E.getResilience(ctx.state, facility, m),
      a = ctx.agentOperations(),
      achievements = ctx.pendingAchievements(),
      limited = facility.racks.some((x) => x.status !== 'online');
    ctx.updateBusiness?.(m);
    ctx.updateResearch?.(m);
    ctx.updateDashboard?.(m, r, a);
    ctx.updateAgentDevelopment?.();
    const serverRows = new Map(
      facility.racks.flatMap((rack) => rack.servers.map((server) => [server.id, server])),
    );
    const values = {
      gpuCapacity: ctx.dec(m.gpuCapacity || 0),
      gpuInstalled: ctx.fmt(m.gpuInstalled || 0),
      gpuUsed: ctx.dec(m.gpuUsed || 0),
      gpuLoad: ctx.dec((m.gpuLoad || 0) * 100),
      name: ctx.state.networkName,
      sector: ctx.state.sector,
      nextSector: ctx.state.sector + 1,
      credits: ctx.compact(ctx.state.credits),
      capacity: ctx.dec(m.capacity),
      research: ctx.compact(ctx.state.research),
      incomeMinute: (m.incomePerSecond >= 0 ? '+' : '') + ctx.dec(m.incomePerSecond * 60),
      researchMinute: ctx.dec(m.researchPerSecond * 60),
      reliability: ctx.dec(m.reliability),
      load: ctx.dec(m.load * 100),
      power: ctx.dec(m.power),
      heat: ctx.dec(m.heat),
      rackTemperature: ctx.dec(m.maxRackTemperature),
      work: ctx.dec(m.workPerSecond),
      upkeepMinute: ctx.dec(m.upkeep * 60),
      freeCapacity: ctx.dec(Math.max(0, m.capacity - m.usedCapacity)),
      eventCount: ctx.state.events.length,
      jobCount: ctx.state.jobs.length,
      runtime: ctx.clock(ctx.state.time),
      offerEta: ctx.duration(ctx.state.timers.offer),
      healthLabel: r.safetyMode
        ? 'Schutzmodus'
        : r.failed
          ? 'Reparatur erforderlich'
          : m.reliability > 90
            ? 'Stabiler Betrieb'
            : m.reliability > 65
              ? 'Wartung empfohlen'
              : 'Kühlung empfohlen',
      save:
        ctx.saveMode === 'saving'
          ? 'Wird gespeichert …'
          : ctx.saveMode === 'fallback'
            ? 'Im Browser gespeichert'
            : ctx.saveMode === 'error'
              ? 'Speichern fehlgeschlagen'
              : 'Netzwerkstand gespeichert',
    };
    Object.assign(values, {
      onlineServers: ctx.fmt(r.online),
      failedServers: ctx.fmt(r.failed),
      repairingServers: ctx.fmt(r.repairing),
      condition: ctx.dec(r.condition),
      integrity: ctx.dec(r.integrity),
      riskRate: ctx.dec(r.riskPerHour) + ' %',
      riskLabel: r.safetyMode
        ? 'Im Schutzmodus ausgesetzt'
        : r.graceRemaining > 0
          ? 'Anlaufschutz: ' + ctx.duration(r.graceRemaining)
          : 'Risiko ' + r.riskLabel,
      backupAge: r.backupAge === null ? 'Noch keines' : ctx.duration(r.backupAge),
      protectedResearch: ctx.dec(r.backupProtectedResearch),
      backupJobs: ctx.fmt(r.backupJobCount),
      backupCooldown: r.backupCooldown > 0 ? ctx.duration(r.backupCooldown) : 'Jetzt möglich',
      parts: ctx.fmt(r.parts),
      repairSpent: ctx.fmt(r.spent),
      repairBudget: ctx.fmt(r.budget),
      reserve: ctx.fmt(r.reserve),
      operationEta: r.operation ? ctx.duration(r.operation.remaining) : '',
      operationPercent: r.operation
        ? ctx.fmt((1 - r.operation.remaining / r.operation.total) * 100) + ' %'
        : '',
      systemStatus: r.safetyMode
        ? 'SCHUTZMODUS'
        : !r.online
          ? 'NETZWERK OFFLINE'
          : r.failed
            ? 'BETRIEB EINGESCHRÄNKT'
            : r.repairing || facility.operation
              ? 'WARTUNG AKTIV'
              : limited
                ? 'KAPAZITÄT BEGRENZT'
                : 'SYSTEM ONLINE',
      achievementCount: achievements.length,
      achievementReward: ctx.fmt(achievements.reduce((sum, x) => sum + x.reward, 0)),
      activeAgentCount:
        ctx.state.agents.length - a.agents.filter((x) => x.assignment || x.absent).length,
    });
    ctx.$$('[data-stat]').forEach((el) => {
      const raw = String(values[el.dataset.stat] ?? ''),
        v = el.dataset.stat === 'name' ? raw : ctx.tr(raw);
      if (el.textContent !== v) el.textContent = v;
      if (el.classList.contains('nav-count')) el.hidden = v === '0';
      if (el.dataset.stat === 'incomeMinute')
        el.style.color = m.incomePerSecond < 0 ? 'var(--red)' : 'var(--accent)';
    });
    ctx.$$('[data-system-tag]').forEach((el) => {
      el.classList.toggle('red', r.safetyMode || !r.online);
      el.classList.toggle(
        'amber',
        !r.safetyMode && r.online > 0 && (r.failed > 0 || r.repairing > 0 || limited),
      );
    });
    ctx.$$('[data-operation-progress]').forEach((el) => {
      if (r.operation)
        el.style.width = Math.min(100, (1 - r.operation.remaining / r.operation.total) * 100) + '%';
    });
    const conditionRows = new Map(r.servers.map((server) => [server.id, server]));
    ctx.$$('[data-condition-label]').forEach((el) => {
      const server = conditionRows.get(el.dataset.conditionLabel);
      if (server) el.textContent = ctx.dec(server.condition) + ' %';
    });
    ctx.$$('[data-condition-bar]').forEach((el) => {
      const server = conditionRows.get(el.dataset.conditionBar);
      if (!server) return;
      el.style.width = server.condition + '%';
      el.classList.toggle('danger', server.condition < 50);
      el.classList.toggle('amber', server.condition >= 50 && server.condition < 80);
    });
    ctx.$$('[data-safety]').forEach((b) => {
      const action = b.dataset.action || b.dataset.actionQuote;
      const o =
        action === 'createBackup'
          ? r.backup
          : action === 'buyParts'
            ? r.partsPurchase
            : action === 'resolveIncident'
              ? r.incident?.choices.find((x) => x.key === b.dataset.choice)
              : r.servers
                  .find((x) => x.id === b.dataset.id)
                  ?.repairs.find((x) => x.key === b.dataset.method);
      b.disabled = !o?.enabled;
      b.title = ctx.tr(o?.reason || '');
      const card = b.closest('.protection-option');
      if (o && card) {
        const description = ctx.$('[data-option-description]', card),
          cost = ctx.$('[data-option-cost]', card),
          reason = ctx.$('[data-option-reason]', card);
        if (description) description.textContent = ctx.tr(o.description);
        if (cost) cost.textContent = ctx.tr(ctx.optionSummary(o));
        if (reason) reason.textContent = ctx.tr(o.reason);
      }
    });
    a.agents.forEach((agent) => {
      ctx.$$(`[data-agent-status="${agent.id}"]`).forEach((el) => {
        el.textContent = agent.absent
          ? ctx.tr('Selbstwartung · Rückkehr in') +
            ' ' +
            ctx.duration(agent.remaining) +
            (agent.assignment
              ? ' · ' + ctx.tr(agent.assignment.label) + ' · ' + ctx.tr('pausiert')
              : '')
          : agent.assignment
            ? agent.assignment.label +
              ' · ' +
              (r.safetyMode || agent.absent ? 'pausiert' : ctx.duration(agent.assignment.remaining))
            : agent.cooldown > 0
              ? 'Nächster Sondereinsatz in ' + ctx.duration(agent.cooldown)
              : 'Für Sondereinsatz verfügbar';
      });
      ctx.$$(`[data-agent-progress="${agent.id}"]`).forEach((el) => {
        if (agent.assignment)
          el.style.width = (1 - agent.assignment.remaining / agent.assignment.total) * 100 + '%';
      });
      ctx.$$(`[data-change="agent-focus"][data-id="${agent.id}"]`).forEach((el) => {
        el.disabled = !!agent.assignment;
      });
    });
    ctx.$$('[data-mission]').forEach((b) => {
      const o = a.agents
        .find((x) => x.id === b.dataset.id)
        ?.options.find((x) => x.key === b.dataset.mission);
      b.disabled = !o?.enabled;
      b.title = o?.reason || '';
      const reason = b.closest('.mission-option')?.querySelector('[data-mission-reason]');
      if (reason) reason.textContent = o?.reason || '';
    });
    ctx.$$('[data-effect]').forEach((el) => {
      const effect = a.effects.find((x) => x.kind === el.dataset.effect);
      el.textContent = effect ? ctx.duration(effect.remaining) : '';
    });
    const chartTime = ctx.state.history.at(-1)?.time ?? -1;
    if (chartTime !== ctx.lastChartTime) {
      ctx
        .$$('[data-sparkline]')
        .forEach((el) =>
          ctx.$('polyline', el)?.setAttribute('points', ctx.sparklinePoints(el.dataset.sparkline)),
        );
      ctx.lastChartTime = chartTime;
    }
    ctx.state.jobs.forEach((j) => {
      const p = Math.min(100, (j.work / j.totalWork) * 100);
      ctx.$$(`[data-job-progress="${j.id}"]`).forEach((bar) => (bar.style.width = p + '%'));
      ctx
        .$$(`[data-job-percent="${j.id}"]`)
        .forEach((percent) => (percent.textContent = ctx.tr(ctx.fmt(p) + ' % erledigt')));
      const text =
        m.jobRates?.[j.id] > 0
          ? 'Noch ' +
            ctx.duration((j.totalWork - j.work) / m.jobRates[j.id]) +
            (m.jobBlockedReasons?.[j.id] ? ' · ' + m.jobBlockedReasons[j.id] : '')
          : r.safetyMode
            ? 'Schutzmodus · pausiert'
            : m.jobBlockedReasons?.[j.id] ||
              (!r.online ? 'Keine Server verfügbar' : 'Wartet auf Agenten');
      ctx.$$(`[data-job-eta="${j.id}"]`).forEach((eta) => (eta.textContent = ctx.tr(text)));
    });
    ctx.$$('[data-cost-kind]').forEach((b) => {
      const price = ctx.E.cost(ctx.state, b.dataset.costKind, b.dataset.costId);
      const balance = b.dataset.costKind === 'research' ? ctx.state.research : ctx.state.credits;
      const limit =
        b.dataset.costKind === 'server'
          ? ctx.state.servers.length >= m.serverLimit
          : b.dataset.costKind === 'agent'
            ? ctx.state.agents.length >= m.agentLimit
            : false;
      b.disabled = balance < price || limit || !Number.isFinite(price);
      const budgetReason = limit
        ? 'Alle Plätze belegt – erschließe einen neuen Sektor.'
        : balance < price
          ? `Noch ${ctx.fmt(Math.ceil(price - balance))} ${b.dataset.costKind === 'research' ? 'FP' : 'CR'} nötig`
          : '';
      b.title = ctx.tr(budgetReason);
    });
    ctx.$$('[data-action="upgradeServer"]').forEach((b) => {
      if (serverRows.get(b.dataset.id)?.status !== 'online') {
        b.disabled = true;
        b.title = 'Dieser Knoten muss zuerst wieder verfügbar sein.';
      }
    });
    ctx.$$('[data-action="upgradeAgent"]').forEach((b) => {
      if (a.agents.find((x) => x.id === b.dataset.id)?.assignment) {
        b.disabled = true;
        b.title = 'Der Agent ist im Sondereinsatz.';
      }
    });
    ctx.$$('[data-action="acceptJob"]').forEach((b) => {
      const j = ctx.state.offers.find((j) => j.id === b.dataset.id);
      b.disabled =
        !j ||
        ctx.state.jobs.length >= m.jobLimit ||
        Boolean(j && !ctx.E.jobsFit(ctx.state, j, m.admissionResources));
      b.title = b.disabled
        ? j?.kind === 'ai' && (j.gpuDemand || 1) > (m.gpuCapacity || 0) - (m.gpuUsed || 0) + 1e-9
          ? 'Nicht genügend freie GPU-Kapazität. Prüfe KI-Server, Uplink, Strom und Kühlung.'
          : 'Mehr freie Auftragsplätze oder Serverkapazität nötig.'
        : '';
    });
    ctx.$$('[data-action="claimAchievement"]').forEach((b) => {
      const a = ctx.E.catalog.achievements.find((a) => a.id === b.dataset.id);
      b.disabled =
        !a ||
        !!ctx.state.achievements[b.dataset.id] ||
        !(ctx.state.achievementUnlocks?.[a.id] || a.check(ctx.state));
    });
    ctx.$$('[data-action="expandSector"]').forEach((b) => {
      b.disabled = !m.expansionReady;
    });
    ctx.R.updateLive(facility);
    if (ctx.view === 'overview' || ctx.Room.isInRoom())
      ctx.Room.update({
        state: ctx.state,
        metrics: m,
        model: facility,
        resilience: r,
        operations: a,
      });
  }
  return { stateSignature, updateLive };
}
