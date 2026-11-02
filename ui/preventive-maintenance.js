/** Scheduled preventive maintenance controls and quoted one-off rack work. */
export function createPreventiveMaintenanceUI(ctx) {
  const values = {
    threshold: 70,
    dailyLimit: 0,
    minimumSupply: 0.95,
    windowStartHour: 0,
    windowEndHour: 23,
    delay: 0,
    rackId: '',
    agentId: '',
    ceiling: 1000,
  };
  let policyLoaded = false;
  const pstate = () =>
    ctx.state.preventiveMaintenance || ctx.E.getPreventiveMaintenance?.(ctx.state) || null;
  const readValues = (form) => {
    for (const el of form.querySelectorAll('[data-preventive-field]')) {
      const key = el.dataset.preventiveField;
      values[key] =
        el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
    }
  };
  const policy = () =>
    pstate()?.policy || {
      automatic: false,
      threshold: 70,
      earliestAt: ctx.state.time,
      windowStart: 0,
      windowEnd: 86399,
      minimumSupply: 0.95,
      dailyLimit: 0,
    };
  const qFor = (form) => {
    if (form) readValues(form);
    return ctx.E.quotePreventiveMaintenance(ctx.state, {
      rackId: values.rackId,
      agentId: values.agentId,
      threshold: Number(values.threshold),
      deferred: true,
    });
  };
  function preventiveMarkup() {
    const pm = pstate();
    const pol = policy();
    if (!policyLoaded) {
      values.threshold = pol.threshold ?? values.threshold;
      values.dailyLimit = pol.dailyLimit ?? values.dailyLimit;
      values.minimumSupply = pol.minimumSupply ?? values.minimumSupply;
      values.windowStartHour = Math.floor((pol.windowStart ?? 0) / 3600);
      values.windowEndHour = Math.floor((pol.windowEnd ?? 86399) / 3600);
      policyLoaded = true;
    }
    const racks = ctx.state.facility.racks;
    const engineers = ctx.state.agents.filter((a) => a.role === 'engineer');
    values.rackId ||= racks[0]?.id || '';
    values.agentId ||= engineers[0]?.id || '';
    const quote = qFor();
    const hours = Array.from({ length: 24 }, (_, i) => [i, `${String(i).padStart(2, '0')}:00`]);
    const optionSelect = (key, label, options) =>
      `<label class="field-label">${ctx.tr(label)}<select class="select" data-preventive-field="${key}">${options.map(([v, title]) => `<option value="${ctx.esc(v)}" ${String(values[key]) === String(v) ? 'selected' : ''}>${ctx.esc(ctx.tr(title))}</option>`).join('')}</select></label>`;
    const numberField = (key, label, min, max, step = 1) =>
      `<label class="field-label">${ctx.tr(label)}<input class="input" type="number" min="${min}" max="${max}" step="${step}" value="${ctx.esc(values[key])}" data-preventive-field="${key}"></label>`;
    const policyThreshold = pol.threshold ?? values.threshold;
    const policyLimit = pol.dailyLimit ?? values.dailyLimit;
    const policySupply = pol.minimumSupply ?? values.minimumSupply;
    return `<section class="panel section-spacer preventive-maintenance"><div class="panel-header"><div><h2>${ctx.tr('Vorbeugende Rackwartung')}</h2><p>${ctx.tr('Wartet abgenutzte, aktive Server. Der kurze Rackausfall ist auf den Wartungsabschnitt begrenzt; Kundenversorgung und Ersatzteile werden vor dem Start geprüft.')}</p></div><span class="tag ${pm?.operation ? 'amber' : 'blue'}">${ctx.tr(pm?.operation ? 'Wartung läuft' : pm?.schedule ? 'Termin vorgemerkt' : pol.automatic ? 'Automatik aktiv' : 'Automatik aus')}</span></div><div class="panel-body">
      <div class="policy-row"><div class="policy-copy"><strong>${ctx.tr('Automatisch fällige Racks warten')}</strong><small>${ctx.tr('Automatik bleibt standardmäßig aus; mindestens ein Techniker bleibt für andere Aufgaben verfügbar.')}</small></div><button class="toggle" role="switch" aria-checked="${Boolean(pol.automatic)}" aria-label="${ctx.tr('Automatische Rackwartung')}" data-preventive-policy-toggle data-value="${!pol.automatic}"></button></div>
      <div class="business-controls" data-preventive-policy>${optionSelect(
        'threshold',
        'Wartungsschwelle (%)',
        [
          [50, '50 %'],
          [60, '60 %'],
          [70, '70 %'],
          [80, '80 %'],
        ],
      )}${numberField('dailyLimit', 'Tagesbudget (CR, 0 = keine Wartung)', 0, 1000000000000)}${optionSelect(
        'minimumSupply',
        'Mindestversorgung nach Wartung',
        [
          [0.95, '95 %'],
          [1, '100 %'],
        ],
      )}${optionSelect('windowStartHour', 'Wartungsfenster ab (Simulationsstunde)', hours)}${optionSelect('windowEndHour', 'Wartungsfenster bis (Simulationsstunde)', hours)}</div><p class="policy-explainer">${ctx.tr('Aktuell gespeichert')}: ${ctx.tr('Schwelle')} ${ctx.fmt(policyThreshold)} % · ${ctx.tr('Tagesbudget')} ${ctx.fmt(policyLimit)} CR · ${ctx.tr('Mindestversorgung')} ${ctx.fmt(policySupply * 100)} %. ${ctx.tr('Ein Tagesbudget von 0 verhindert Wartungsstarts.')}</p><button class="button" data-preventive="save-policy">${ctx.tr('Richtlinie speichern')}</button>
      ${pm?.schedule ? `<div class="customer-work" role="status"><strong>${ctx.tr('Vorgemerkte Wartung')} · ${ctx.esc(racks.find((r) => r.id === pm.schedule.rackId)?.name || pm.schedule.rackId)}</strong><p>${ctx.esc(ctx.state.agents.find((a) => a.id === pm.schedule.agentId)?.name || '')} · ${ctx.tr('Preisobergrenze')}: ${ctx.fmt(pm.schedule.ceiling)} CR</p><p>${ctx.tr('Frühestens in')}: ${ctx.duration(Math.max(0, pm.schedule.earliestAt - ctx.state.time))} · ${String(Math.floor(pm.schedule.windowStart / 3600)).padStart(2, '0')}:00–${String(Math.floor(pm.schedule.windowEnd / 3600)).padStart(2, '0')}:59</p><p>${ctx.esc(ctx.tr(pm.schedule.reason || 'Wartet auf Startbedingungen.'))}</p></div>` : ''}
      <hr><h3>${ctx.tr('Einmalige Wartung einplanen')}</h3><p>${ctx.tr('Wähle Rack und Techniker. Der Auftrag reserviert das Budget und Ersatzteile erst beim Start; der Preis wird dann erneut geprüft.')}</p><div class="business-controls" data-preventive-form>${optionSelect(
        'rackId',
        'Serverrack',
        racks.map((rack) => [rack.id, `${rack.name} · ${rack.id}`]),
      )}${optionSelect(
        'agentId',
        'Techniker',
        engineers.map((agent) => [agent.id, agent.name]),
      )}${optionSelect('threshold', 'Wartungsschwelle (%)', [
        [50, '50 %'],
        [60, '60 %'],
        [70, '70 %'],
        [80, '80 %'],
      ])}${optionSelect('delay', 'Frühester Start', [
        [0, 'Sofort'],
        [3600, 'In 1 Stunde'],
        [14400, 'In 4 Stunden'],
        [43200, 'In 12 Stunden'],
      ])}${optionSelect('windowStartHour', 'Fenster ab', hours)}${optionSelect('windowEndHour', 'Fenster bis', hours)}${numberField('ceiling', 'Preisobergrenze (CR)', 1, 1000000000000)}</div><div class="status-row"><span>${ctx.tr('Voraussichtliche Kosten / Ersatzteile')}</span><strong data-preventive-quote-cost>${ctx.fmt(quote.cost)} CR · ${ctx.fmt(quote.parts)} ${ctx.tr('Teile')}</strong></div><div class="status-row"><span>${ctx.tr('Technikerzeit / geplanter Rackausfall')}</span><strong data-preventive-quote-duration>${ctx.duration(quote.duration)} · ${ctx.duration(quote.downtime)}</strong></div><p data-preventive-supply>${ctx.tr('Mindestversorgung nach Wartung')}: ${quote.supplyAfter === null ? '—' : `${ctx.fmt(quote.supplyAfter * 100)} %`}</p><p class="protection-reason" data-preventive-reason>${ctx.esc(ctx.tr(quote.reason || 'Kosten, Teile und Versorgung werden bei der Bestätigung erneut geprüft.'))}</p><div class="card-actions"><button class="button primary" data-preventive="schedule" ${quote.enabled && !pm?.operation && !pm?.schedule ? '' : 'disabled'}>${ctx.tr('Wartung prüfen')}</button>${pm?.schedule ? `<button class="button" data-preventive="cancel">${ctx.tr('Termin entfernen')}</button>` : ''}</div>${pm?.operation ? `<div class="customer-work"><strong>${ctx.tr('Aktive Wartung')}: ${ctx.esc(pm.operation.rackId)} · <span data-preventive-remaining>${ctx.duration(pm.operation.remaining)}</span></strong><div class="progress-track"><div class="progress-fill blue" data-preventive-progress style="width:${100 * (1 - pm.operation.remaining / pm.operation.total)}%"></div></div><p>${ctx.tr('Rack bleibt für Kunden noch außer Betrieb')}: <span data-preventive-downtime>${ctx.duration(pm.operation.downtimeRemaining)}</span></p></div>` : ''}${pm?.schedule ? `<p class="policy-explainer">${ctx.tr('Geplant')}: ${ctx.esc(pm.schedule.rackId)} · ${ctx.tr(pm.schedule.reason || 'Wartet auf Fenster und Voraussetzungen.')}</p>` : ''}</div></section>`;
  }
  function preventiveChange(el) {
    if (!el.matches('[data-preventive-field]')) return false;
    const form = el.closest('[data-preventive-form]');
    if (form) {
      const quote = qFor(form);
      const put = (selector, value) => {
        const node = form.closest('.preventive-maintenance').querySelector(selector);
        if (node) node.textContent = value;
      };
      put(
        '[data-preventive-quote-cost]',
        `${ctx.fmt(quote.cost)} CR · ${ctx.fmt(quote.parts)} ${ctx.tr('Teile')}`,
      );
      put(
        '[data-preventive-quote-duration]',
        `${ctx.duration(quote.duration)} · ${ctx.duration(quote.downtime)}`,
      );
      put(
        '[data-preventive-supply]',
        `${ctx.tr('Mindestversorgung nach Wartung')}: ${quote.supplyAfter === null ? '—' : `${ctx.fmt(quote.supplyAfter * 100)} %`}`,
      );
      put(
        '[data-preventive-reason]',
        ctx.tr(
          quote.reason || 'Kosten, Teile und Versorgung werden bei der Bestätigung erneut geprüft.',
        ),
      );
      const button = form
        .closest('.preventive-maintenance')
        .querySelector('[data-preventive="schedule"]');
      if (button)
        button.disabled = !quote.enabled || Boolean(pstate()?.operation || pstate()?.schedule);
    }
    return true;
  }
  function preventiveClick(target) {
    if (target.hasAttribute('data-preventive-confirm')) {
      const extra = ctx.modal?.extra;
      if (ctx.modal?.type !== 'preventive-confirm' || !extra) return true;
      const q = ctx.E.quotePreventiveMaintenance(ctx.state, { ...extra.payload, deferred: true });
      if (!q.enabled || q.cost > extra.payload.ceiling) return true;
      ctx.closeModal();
      ctx.execute(extra.action, extra.payload);
      return true;
    }
    if (target.hasAttribute('data-preventive-policy-toggle')) {
      const pol = { ...policy(), automatic: target.dataset.value === 'true' };
      ctx.execute('setPreventiveMaintenancePolicy', pol);
      return true;
    }
    const command = target.dataset.preventive;
    if (!command) return false;
    if (command === 'cancel') ctx.execute('cancelPreventiveMaintenance', {});
    if (command === 'save-policy') {
      const form = target
        .closest('.preventive-maintenance')
        .querySelector('[data-preventive-policy]');
      readValues(form);
      const automatic = Boolean(policy().automatic);
      ctx.execute('setPreventiveMaintenancePolicy', {
        automatic,
        threshold: Number(values.threshold),
        earliestAt: Number(policy().earliestAt || ctx.state.time),
        windowStart: Number(values.windowStartHour) * 3600,
        windowEnd: Number(values.windowEndHour) * 3600 + 3599,
        minimumSupply: Number(values.minimumSupply),
        dailyLimit: Number(values.dailyLimit),
      });
    }
    if (command === 'schedule') {
      const form = target
        .closest('.preventive-maintenance')
        .querySelector('[data-preventive-form]');
      readValues(form);
      const payload = {
        rackId: values.rackId,
        agentId: values.agentId,
        threshold: Number(values.threshold),
        earliestAt: ctx.state.time + Number(values.delay),
        windowStart: Number(values.windowStartHour) * 3600,
        windowEnd: Number(values.windowEndHour) * 3600 + 3599,
        ceiling: Number(values.ceiling),
      };
      ctx.openModal('preventive-confirm', { action: 'schedulePreventiveMaintenance', payload });
    }
    return true;
  }
  function preventiveConfirm(extra) {
    const q = ctx.E.quotePreventiveMaintenance(ctx.state, { ...extra.payload, deferred: true });
    const ceiling = Number(extra.payload.ceiling);
    const enabled = q.enabled && q.cost <= ceiling;
    const reason =
      q.reason ||
      (q.cost > ceiling ? 'Der voraussichtliche Preis liegt über der Preisobergrenze.' : '');
    return `<p class="modal-intro">${ctx.tr('Rackwartung prüfen')}: ${ctx.esc(extra.payload.rackId)}</p><div class="status-row"><span>${ctx.tr('Voraussichtliche Kosten')}</span><strong>${ctx.fmt(q.cost)} / ${ctx.fmt(ceiling)} CR</strong></div><div class="status-row"><span>${ctx.tr('Ersatzteile')}</span><strong>${ctx.fmt(q.parts)}</strong></div><div class="status-row"><span>${ctx.tr('Technikerarbeit / Rackausfall')}</span><strong>${ctx.duration(q.duration)} / ${ctx.duration(q.downtime)}</strong></div><p>${ctx.tr('Wartungsziel')}: ${ctx.fmt(q.targetCondition)} %. ${ctx.tr('Mindestversorgung nach Start')}: ${q.supplyAfter === null ? '—' : `${ctx.fmt(q.supplyAfter * 100)} %`}.</p><p>${ctx.tr('Der Termin wartet bis zum frühesten Start und dem gewählten täglichen Zeitfenster. Bei Start werden Preis, Teile, Reserven und Kundenversorgung erneut geprüft. Während des kurzen Rackabschnitts bleibt dieses Rack außer Betrieb.')}</p>${reason ? `<p class="modal-alert">${ctx.esc(ctx.tr(reason))}</p>` : ''}<button class="button primary block" data-preventive-confirm ${enabled ? '' : 'disabled'}>${ctx.tr('Wartung verbindlich einplanen')}</button>`;
  }
  function preventiveSignature() {
    if (!['operations', 'agents', 'overview'].includes(ctx.view)) return '';
    const pm = pstate();
    return JSON.stringify([
      pm?.policy,
      pm?.schedule,
      pm?.operation && [
        pm.operation.rackId,
        pm.operation.agentId,
        pm.operation.total,
        pm.operation.serverIds,
      ],
    ]);
  }
  function updatePreventive() {
    const op = pstate()?.operation;
    if (!op) return;
    const time = ctx.$('[data-preventive-remaining]');
    if (time) time.textContent = ctx.duration(op.remaining);
    const remaining = ctx.$('[data-preventive-downtime]');
    if (remaining) remaining.textContent = ctx.duration(op.downtimeRemaining);
    const bar = ctx.$('[data-preventive-progress]');
    if (bar) bar.style.width = `${100 * (1 - op.remaining / op.total)}%`;
  }
  return {
    preventiveMarkup,
    preventiveClick,
    preventiveChange,
    preventiveConfirm,
    preventiveSignature,
    updatePreventive,
  };
}
