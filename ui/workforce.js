/** workforce UI: reads current state through the controller context. */
export function createWorkforceUI(ctx) {
  let selected = null,
    filter = 'all';
  function workforceClick(target) {
    if (!target.hasAttribute('data-agent-select')) return false;
    selected = target.dataset.agentSelect;
    ctx.render();
    return true;
  }
  function workforceChange(target) {
    if (!target.hasAttribute('data-agent-filter')) return false;
    filter = target.value;
    target.blur();
    ctx.render();
    return true;
  }
  function agentsView() {
    const m = ctx.E.getMetrics(ctx.state),
      ops = ctx.agentOperations();
    const visible = ctx.state.agents.filter((a) => {
      const op = ops.agents.find((o) => o.id === a.id);
      return (
        filter === 'all' ||
        (filter === 'available' && !op.assignment && !op.absent) ||
        (filter === 'working' && op.assignment) ||
        (filter === 'maintenance' && op.absent)
      );
    });
    if (!visible.some((a) => a.id === selected)) selected = visible[0]?.id || null;
    const roster = `<aside class="panel agent-roster"><div class="panel-body"><label class="field-label">Team filtern<select class="select" data-agent-filter>${Object.entries(
      {
        all: 'Alle Agenten',
        available: 'Verfügbar',
        working: 'Im Einsatz',
        maintenance: 'Selbstwartung',
      },
    )
      .map(
        ([key, label]) =>
          `<option value="${key}" ${filter === key ? 'selected' : ''}>${ctx.tr(label)}</option>`,
      )
      .join('')}</select></label></div>${
      visible
        .map((a) => {
          const op = ops.agents.find((o) => o.id === a.id);
          return `<button class="agent-roster-row" data-agent-select="${a.id}" aria-pressed="${a.id === selected}">${ctx.avatar(a)}<span><strong>${ctx.esc(a.name)}</strong><small>${ctx.tr(ctx.E.catalog.roles[a.role].name)} · ${ctx.tr('Stufe')} ${a.level}</small><small class="robot-state ${op.absent ? 'maintenance' : op.assignment ? 'working' : 'ready'}">${ctx.icon(op.absent ? 'settings' : op.assignment ? 'timer' : 'check')}${ctx.tr(op.absent ? 'Selbstwartung' : op.assignment ? 'Im Einsatz' : 'Verfügbar')}</small></span></button>`;
        })
        .join('') || `<p class="panel-body">${ctx.tr('Keine Agenten für diesen Filter')}</p>`
    }</aside>`;
    return (
      ctx.head(
        'Agenten',
        'Stärken nutzen, Eigenheiten einplanen und dein Team gezielt einsetzen.',
        `<span class="budget-info">${ctx.stat('activeAgentCount')} im Normalbetrieb / ${m.agentLimit} Plätze</span><button class="button primary" data-modal="agents">${ctx.icon('agents')}Arbeitsamt</button>`,
      ) +
      (ops.effects.length
        ? `<div class="effect-strip">${ops.effects.map((e) => `<span>${ctx.icon('spark')}${ctx.esc(e.label)} <strong data-effect="${e.kind}"></strong></span>`).join('')}</div>`
        : '') +
      `<div class="agent-workspace">${roster}<div class="agent-selected">${ctx.state.agents
        .filter((a) => a.id === selected)
        .map((a) => {
          const op = ops.agents.find((x) => x.id === a.id);
          const specialty = ctx.E.agentSpecialties[a.specialty];
          const training =
            a.level >= ctx.E.agentSpecialtyLevel
              ? `<button class="button block" data-modal="agent-specialty" data-id="${a.id}">${ctx.tr('Spezialisierung prüfen')}${specialty ? ' · ' + ctx.esc(ctx.tr(specialty.name)) : ''}</button>`
              : `<small>${ctx.tr('Spezialisierungen sind ab Stufe 14 verfügbar.')}</small>`;
          return `<section class="agent-card ${op.assignment ? 'on-assignment' : ''}"><div class="agent-card-top">${ctx.avatar(a)}<span class="tag ${a.role === 'analyst' ? 'blue' : a.role === 'engineer' ? 'amber' : 'green'}">STUFE ${a.level}</span></div><h3>${ctx.esc(a.name)}</h3><p class="role-desc">${ctx.E.catalog.roles[a.role].name} · ${ctx.E.catalog.roles[a.role].description}</p>${ctx.personnelPerks(a)}<div class="candidate-wage"><span>Betriebskosten / Stunde</span><strong data-personnel-wage="${a.id}"></strong></div><div class="agent-assignment"><span class="assignment-label">${ctx.icon(op.assignment ? 'timer' : 'pulse')}${op.assignment ? 'SONDEREINSATZ' : 'EINSATZSTATUS'}</span><strong data-agent-status="${a.id}"></strong>${op.assignment ? `<div class="progress-track"><div class="progress-fill blue" data-agent-progress="${a.id}"></div></div>` : ''}<button class="button block ${op.assignment ? 'ghost' : 'primary'}" data-modal="agent-task" data-id="${a.id}">${ctx.icon('jobs')}${op.assignment ? 'Einsatz ansehen' : 'Einsatz planen'}</button></div><div class="agent-controls"><label class="field-label" for="focus-${a.id}">Schwerpunkt im Normalbetrieb</label><select id="focus-${a.id}" class="select" data-change="agent-focus" data-id="${a.id}">${Object.entries(
            ctx.focusNames,
          )
            .map(
              ([k, v]) => `<option value="${k}" ${a.focus === k ? 'selected' : ''}>${v}</option>`,
            )
            .join(
              '',
            )}</select><button class="button block" data-modal="agent-upgrade" data-id="${a.id}">${ctx.icon('plus')}Upgrade prüfen · ${ctx.fmt(ctx.E.cost(ctx.state, 'agentUpgrade', a.id))} CR</button>${training}<button class="text-button personnel-dismiss" data-personnel="dismiss" data-id="${a.id}">Agent ausmustern</button></div></section>`;
        })
        .join(
          '',
        )}</div></div><div class="helper-card"><h3>Wen kannst du gerade entbehren?</h3><p>Im Sondereinsatz fehlt ein Agent bei Aufträgen, Forschung und Pflege. Techniker diagnostizieren schneller, Operatoren optimieren schneller, Analysten liefern mehr Forschung. Die Wirkung beginnt erst nach Abschluss. Danach ist der Agent wieder im Normalbetrieb; ein weiterer Sondereinsatz muss bis zum Ende der Erholungszeit warten. Große Krisen und Selbstwartung pausieren laufende Einsätze. Selbstwartung endet automatisch; Betriebskosten laufen weiter. Stärken und Nachteile verändern jeweils den eigenen Beitrag, nicht pauschal das gesamte Netzwerk.</p></div>`
    );
  }

  function agentTaskModal(id) {
    const agent = ctx.state.agents.find((x) => x.id === id),
      op = ctx.agentOperations().agents.find((x) => x.id === id);
    if (!agent || !op) return '<p class="modal-intro">Dieser Agent ist nicht mehr vorhanden.</p>';
    return `<p class="modal-intro"><strong>${ctx.esc(agent.name)}</strong> · ${ctx.E.catalog.roles[agent.role].name} · Stufe ${agent.level}. Im Sondereinsatz entfallen alle normalen Beiträge dieses Agenten. Kosten werden beim Start verbraucht; die Wirkung folgt nach Abschluss.</p><div class="assignment-summary" data-agent-status="${id}"></div><div class="protection-choices">${op.options.map((o) => `<article class="protection-option mission-option"><h3>${ctx.esc(o.label)}</h3><p>${ctx.esc(o.description)}</p><div class="protection-cost">${ctx.fmt(o.cost)} CR · ${ctx.duration(o.duration)} Einsatz<br>${ctx.duration(o.cooldown)} Erholungszeit danach</div><div class="protection-reason" data-mission-reason>${ctx.esc(o.reason || '')}</div>${ctx.actionButton('dispatchAgent', `${ctx.icon('arrow')}Einsatz starten`, { id, mission: o.key }, 'block')}</article>`).join('')}</div>`;
  }
  return { agentsView, agentTaskModal, workforceClick, workforceChange };
}
