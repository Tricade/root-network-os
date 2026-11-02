/** Compact actionable cards. Paid actions use the existing domain confirmation dialogs. */
export function createAttentionCards(ctx) {
  const rooms = new Map();
  const live = (key, value) => `<span data-attention-value="${key}">${value}</span>`;
  const text = (value) => ctx.esc(ctx.tr(value || ''));
  const button = (label, attrs, primary = false) =>
    `<button class="button small ${primary ? 'primary' : ''}" ${attrs}>${text(label)}</button>`;
  const facts = (pairs) =>
    `<dl class="attention-facts">${pairs
      .map(([key, value]) => `<div><dt>${text(key)}</dt><dd>${value}</dd></div>`)
      .join('')}</dl>`;
  const resourceText = (values = {}) =>
    Object.entries({
      cpu: 'CPU',
      ram: 'GB RAM',
      storage: 'TB',
      network: 'Mbit/s',
      gpu: 'GPU',
      vram: 'GB VRAM',
    })
      .filter(([key]) => values[key] > 0)
      .map(([key, label]) => `${ctx.dec(values[key])} ${label}`)
      .join(' · ');

  function leadContent(lead) {
    const availableRooms = ctx.state.business.rooms;
    let roomId = rooms.get(lead.id);
    if (!availableRooms.some((r) => r.roomId === roomId)) {
      roomId =
        availableRooms.find(
          (r) =>
            ctx.E.quoteCustomer(ctx.state, 'acceptCustomerLead', { id: lead.id, roomId: r.roomId })
              .enabled,
        )?.roomId || availableRooms[0]?.roomId;
      rooms.set(lead.id, roomId);
    }
    const q = ctx.E.quoteCustomer(ctx.state, 'acceptCustomerLead', { id: lead.id, roomId });
    return `<p>${text(ctx.E.getBusinessModel(ctx.state).services[lead.kind].name)} · ${ctx.fmt(lead.units)} ${text('Diensteinheiten')}</p>
      <p class="attention-resources">${live('resources', text(resourceText(q.resources)))}</p>
      ${facts([
        ['Einrichtungskosten', live('cost', `${ctx.fmt(q.cost)} CR`)],
        ['Agentenzeit', live('duration', ctx.duration(q.duration))],
        ['Laufzeit', ctx.duration(lead.term)],
      ])}
      <label class="field-label">${text('Raum für die Einrichtung')}<select class="select" data-attention-room="${ctx.esc(lead.id)}">${availableRooms.map((r) => `<option value="${ctx.esc(r.roomId)}" ${r.roomId === roomId ? 'selected' : ''}>${text(`Raum ${Number(r.roomId.replace('room-', ''))}`)}</option>`).join('')}</select></label>
      <p class="protection-reason" data-attention-lead-reason="${ctx.esc(lead.id)}">${text(q.reason)}</p>
      <div class="card-actions">${button('Vertrag prüfen', `data-customer="acceptCustomerLead" data-id="${ctx.esc(lead.id)}" data-room-id="${ctx.esc(roomId)}" data-attention-lead ${q.enabled ? '' : 'disabled'}`, true)}${button('Anfrage ablehnen', `data-customer="declineCustomerLead" data-id="${ctx.esc(lead.id)}"`)}</div>`;
  }

  function contractContent(c, category) {
    const agent = c.agentId && ctx.state.agents.find((a) => a.id === c.agentId);
    const issue = c.notice
      ? 'Kündigung angekündigt'
      : c.issue === 'question'
        ? 'Rückfrage zum Vertrag'
        : c.issue
          ? 'Beschwerde zur Dienstversorgung'
          : 'Einrichtung';
    const actions = [];
    if (c.work && !c.agentId)
      actions.push(
        button(
          'Agent zuweisen',
          `data-customer="assignCustomerAgent" data-id="${ctx.esc(c.id)}" data-attention-assign disabled`,
          true,
        ),
      );
    if (['outage', 'question'].includes(c.issue) && !c.work)
      actions.push(
        button(
          'Betreuung prüfen',
          `data-customer="supportCustomer" data-id="${ctx.esc(c.id)}"`,
          true,
        ),
      );
    if (c.notice && !c.retentionUsed && !c.work)
      actions.push(
        button(
          'Rückgewinnung prüfen',
          `data-customer="retainCustomer" data-id="${ctx.esc(c.id)}"`,
          true,
        ),
      );
    return `<p>${text(issue)} · ${text(`Raum ${Number(c.roomId.replace('room-', ''))}`)}</p>
      ${facts([
        ['Diensteinheiten', ctx.fmt(c.units)],
        ['Zufriedenheit', live('satisfaction', `${ctx.dec(c.satisfaction)} %`)],
        [
          'Verbleibende Laufzeit',
          `<span data-attention-contract-time="${ctx.esc(c.id)}">${ctx.duration(c.notice || c.remaining || c.term)}</span>`,
        ],
      ])}
      ${c.work ? `<p>${text(c.work === 'setup' ? 'Einrichtung' : 'Betreuung')} · ${agent ? ctx.esc(agent.name) : text('Wartet auf einen freien Agenten')}</p>` : ''}
      ${
        c.work && !c.agentId
          ? `<label class="field-label">${text('Agent auswählen')}<select class="select" data-customer-agent="${ctx.esc(c.id)}"><option value="">${text('Verfügbarer Agent')}</option>${ctx
              .agentOperations()
              .agents.filter((a) => !a.assignment && !a.absent)
              .map(
                (a) =>
                  `<option value="${ctx.esc(a.id)}">${ctx.esc(ctx.state.agents.find((agent) => agent.id === a.id)?.name || a.id)}</option>`,
              )
              .join('')}</select></label>`
          : ''
      }
      <div class="card-actions">${actions.join('')}${button('Vertrag öffnen', `data-attention-route="business" data-attention-filter="${category === 'notices' ? 'notice' : 'attention'}"`)}</div>`;
  }

  function content(entry) {
    const d = entry.data;
    switch (entry.group) {
      case 'enquiries':
        return leadContent(d);
      case 'notices':
      case 'support':
      case 'staff':
        return contractContent(d, entry.group);
      case 'rewards':
        return `<div class="card-actions"><strong class="positive">+${ctx.fmt(d.reward)} CR</strong>${button('Belohnung abholen', `data-action="claimAchievement" data-id="${d.id}"`, true)}</div>`;
      case 'decisions':
        return `<div class="attention-choices">${d.choices.map((choice, index) => `<button class="event-choice" data-action="resolveEvent" data-id="${d.id}" data-choice="${index}"><strong>${text(choice.label)}${ctx.icon('arrow')}</strong><span>${text(choice.description)}</span></button>`).join('')}</div>`;
      case 'incident':
        return `<p>${text(d.consequence)}</p><div class="attention-choices">${d.choices.map((option) => ctx.protectionOption(option, 'resolveIncident', { id: d.id, choice: option.key }, true)).join('')}</div>`;
      case 'repairs':
        return `${facts([
          ['Zustand', live('condition', `${ctx.dec(d.condition)} %`)],
          ['Ersatzteile auf Lager', live('parts', ctx.fmt(ctx.state.resilience.parts))],
        ])}${button('Maßnahmen prüfen', `data-modal="repair" data-id="${d.id}"`, true)}`;
      case 'growth':
      case 'growth-due':
        return `${facts([
          ['Zusätzlicher Bedarf', `${ctx.fmt(d.units)} ${text('Diensteinheiten')}`],
          ['Raum', text(`Raum ${Number(d.roomId.replace('room-', ''))}`)],
          [
            d.status === 'offered' ? 'Angebot verfällt in' : 'Liefertermin',
            `<span data-attention-growth-time="${ctx.esc(d.id)}">${ctx.duration(Math.max(0, (d.status === 'offered' ? d.expiresAt : d.deadlineAt) - ctx.state.time))}</span>`,
          ],
        ])}<div class="card-actions">${button('Erweiterung prüfen', 'data-attention-route="business"')}${d.status === 'offered' ? button('Ablehnen', `data-growth="decline" data-id="${d.id}"`) : ''}</div>`;
      case 'margin': {
        const m = ctx.E.getMetrics(ctx.state);
        return `${facts([
          ['Kundenumsatz / min', live('gross', `${ctx.dec(m.serviceIncome * 60)} CR`)],
          ['Betriebskosten / min', live('upkeep', `${ctx.dec(m.upkeep * 60)} CR`)],
          ['Laufender Saldo / min', live('net', `${ctx.dec(m.incomePerSecond * 60)} CR`)],
        ])}${button('Bilanz öffnen', 'data-attention-route="business"')}`;
      }
      case 'supply': {
        const model = ctx.E.getBusinessModel(ctx.state);
        return `<div class="attention-choices">${model.rooms
          .filter((r) => r.groups.some((g) => g.units && g.supplied < 0.95))
          .map(
            (r) =>
              `<div><strong>${text(`Raum ${Number(r.roomId.replace('room-', ''))}`)}</strong>${r.groups
                .filter((g) => g.units && g.supplied < 0.95)
                .map(
                  (g) =>
                    `<p>${text(model.services[g.kind].name)} · <span data-attention-supply-room="${r.roomId}" data-attention-supply-kind="${g.kind}">${ctx.dec(g.supplied * 100)} %</span> ${text('Versorgung')}</p>`,
                )
                .join(
                  '',
                )}${button('Versorgung prüfen', `data-building-hardware="${r.roomId}"`)}</div>`,
          )
          .join('')}</div>`;
      }
      case 'research':
        return `<div data-attention-research-options></div>${button('Forschungsbaum öffnen', 'data-attention-route="research"')}`;
      default:
        return button('Plan prüfen', `data-attention-route="${entry.route}"`);
    }
  }
  function attentionCard(entry) {
    return `<article class="attention-item ${entry.severity}" data-attention-item="${ctx.esc(entry.id)}" data-attention-group="${entry.group}" data-attention-entity="${ctx.esc(entry.data.id || '')}"><h4>${text(entry.title)}</h4>${entry.detail ? `<p>${text(entry.detail)}</p>` : ''}${content(entry)}</article>`;
  }
  function updateAttentionCards(metrics = null) {
    const put = (card, key, value) => {
      const el = card?.querySelector(`[data-attention-value="${key}"]`);
      if (el && el.textContent !== value) el.textContent = value;
    };
    const researchPanels = ctx.$$('[data-attention-research-options]');
    if (researchPanels.length) {
      const nodes = ctx.E.getResearch(ctx.state, metrics)
        .technologies.filter((n) => n.quote.enabled)
        .slice(0, 3);
      const signature = JSON.stringify(nodes.map((n) => [n.id, n.quote.cost, n.quote.duration]));
      researchPanels.forEach((panel) => {
        if (panel.dataset.signature === signature) return;
        const focused = panel.contains(document.activeElement);
        panel.innerHTML = nodes.length
          ? `<div class="attention-choices">${nodes.map((n) => `<div><strong>${text(n.name)}</strong><p>${ctx.fmt(n.quote.cost)} ${text('FP')} · ${ctx.duration(n.quote.duration)}</p>${button('Forschung prüfen', `data-research-start="${n.id}"`)}</div>`).join('')}</div>`
          : `<p>${text('Noch kein weiteres Projekt verfügbar.')}</p>`;
        panel.dataset.signature = signature;
        if (focused)
          panel
            .closest('.attention-item')
            .querySelector('[data-attention-route]')
            .focus({ preventScroll: true });
      });
    }
    ctx.$$('[data-attention-assign]').forEach((el) => {
      const agentId = el.closest('.attention-item').querySelector('[data-customer-agent]')?.value;
      const q = ctx.E.quoteCustomer(ctx.state, 'assignCustomerAgent', {
        id: el.dataset.id,
        agentId,
      });
      el.disabled = !q.enabled;
      el.title = ctx.tr(q.reason || '');
    });
    ctx.$$('[data-attention-group="repairs"]').forEach((card) => {
      const s = ctx.state.servers.find((s) => s.id === card.dataset.attentionEntity);
      if (s) put(card, 'condition', ctx.dec(s.condition) + ' %');
      put(card, 'parts', ctx.fmt(ctx.state.resilience.parts));
    });
    const supplies = ctx.$$('[data-attention-supply-room]');
    if (supplies.length) {
      const model = ctx.E.getBusinessModel(ctx.state, metrics);
      supplies.forEach((el) => {
        const group = model.rooms
          .find((r) => r.roomId === el.dataset.attentionSupplyRoom)
          ?.groups.find((g) => g.kind === el.dataset.attentionSupplyKind);
        if (group) el.textContent = ctx.dec(group.supplied * 100) + ' %';
      });
    }
    const margins = ctx.$$('[data-attention-group="margin"]');
    if (margins.length) {
      const m = metrics || ctx.E.getMetrics(ctx.state);
      margins.forEach((card) => {
        put(card, 'gross', ctx.dec(m.serviceIncome * 60) + ' CR');
        put(card, 'upkeep', ctx.dec(m.upkeep * 60) + ' CR');
        put(card, 'net', ctx.dec(m.incomePerSecond * 60) + ' CR');
      });
    }

    ctx.$$('[data-attention-lead]').forEach((el) => {
      const q = ctx.E.quoteCustomer(ctx.state, 'acceptCustomerLead', {
        id: el.dataset.id,
        roomId: el.dataset.roomId,
      });
      el.disabled = !q.enabled;
      const card = el.closest('.attention-item');
      put(card, 'resources', resourceText(q.resources));
      put(card, 'cost', ctx.fmt(q.cost) + ' CR');
      put(card, 'duration', ctx.duration(q.duration));
      const reason = el.closest('.attention-item')?.querySelector('[data-attention-lead-reason]');
      if (reason) reason.textContent = ctx.tr(q.reason || '');
    });
    ctx.$$('[data-attention-contract-time]').forEach((el) => {
      const c = ctx.state.customers.contracts.find(
        (c) => c.id === el.dataset.attentionContractTime,
      );
      if (c) {
        el.textContent = ctx.duration(c.notice || c.remaining || c.term);
        put(el.closest('.attention-item'), 'satisfaction', ctx.dec(c.satisfaction) + ' %');
      }
    });
    ctx.$$('[data-attention-growth-time]').forEach((el) => {
      const r = ctx.state.customerGrowth.requests.find(
        (r) => r.id === el.dataset.attentionGrowthTime,
      );
      if (r)
        el.textContent = ctx.duration(
          Math.max(0, (r.status === 'offered' ? r.expiresAt : r.deadlineAt) - ctx.state.time),
        );
    });
    for (const id of rooms.keys())
      if (!ctx.state.customers.leads.some((l) => l.id === id)) rooms.delete(id);
  }
  function attentionClick(target) {
    if (!target.hasAttribute('data-attention-route')) return false;
    if (target.dataset.attentionFilter) ctx.selectCustomerFilter(target.dataset.attentionFilter);
    ctx.navigate(target.dataset.attentionRoute);
    return true;
  }
  function attentionChange(el) {
    if (el.matches('.attention-item [data-customer-agent]')) {
      updateAttentionCards();
      return true;
    }
    if (!el.hasAttribute('data-attention-room')) return false;
    rooms.set(el.dataset.attentionRoom, el.value);
    const button = el.closest('.attention-item').querySelector('[data-attention-lead]');
    if (button) button.dataset.roomId = el.value;
    updateAttentionCards();
    return true;
  }
  return { attentionCard, updateAttentionCards, attentionClick, attentionChange };
}
