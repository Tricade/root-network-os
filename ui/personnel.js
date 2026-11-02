/** Recruitment and staff profiles use engine quotes in both dashboard and room console. */
export function createPersonnelUI(ctx) {
  const text = (s) => ctx.esc(ctx.tr(s));
  function perks(a) {
    const model =
      a.strength !== undefined
        ? a
        : ctx.E.getPersonnel(ctx.state).agents.find((p) => p.id === a.id);
    if (!model?.strength)
      return `<div class="personnel-legacy"><span>${text('Bestandsteam')}</span><p>${text('Bisherige Fähigkeiten bleiben erhalten. Keine zusätzlichen Nachteile.')}</p></div>`;
    return `<div class="personnel-perks"><div class="personnel-perk strength">${ctx.icon('spark')}<div><strong>${text(model.strength.name)}</strong><p>${text(model.strength.description)}</p></div></div><div class="personnel-perk weakness">${ctx.icon('pulse')}<div><strong>${text(model.weakness.name)}</strong><p>${text(model.weakness.description)}</p></div></div></div>`;
  }
  function wage(model) {
    return `<span>${text('Betriebskosten / Stunde')}</span><strong>${ctx.dec(model.wage * 3600)} CR</strong>`;
  }
  function marketModal() {
    const p = ctx.E.getPersonnel(ctx.state);
    return `<div class="market-heading" data-market-cycle="${p.cycle}"><div><span class="eyebrow">ROOT / TALENT EXCHANGE</span><p class="modal-intro">${text('Wähle die passende Einheit. Stärken, Eigenheiten und Betriebskosten stehen vor der Aktivierung fest.')}</p></div><div class="market-clock"><span>${text('Neue Bewerbungen in')}</span><strong data-market-eta>${ctx.duration(p.refreshIn)}</strong></div></div><div class="market-rules"><span>${text('6 Bewerbungen · alle 30 Minuten')}</span><span>${text('Eine Einheit dauerhaft vormerken')}</span><span>${ctx.state.agents.length} / ${p.limit} ${text('Teamplätze')}</span></div><div class="personnel-market-grid">${p.candidates.map((a) => `<article class="candidate-card ${a.pinned ? 'pinned' : ''}" data-candidate="${a.id}"><div class="candidate-header">${ctx.avatar(a)}<div><h3>${ctx.esc(a.name)}</h3><span class="role-desc">${text(ctx.E.catalog.roles[a.role].name)} · ${text('Stufe 1')}</span></div><button class="icon-button candidate-pin" data-personnel="pin" data-id="${a.id}" aria-label="${text(a.pinned ? 'Vormerkung entfernen' : 'Bewerbung vormerken')}" aria-pressed="${!!a.pinned}" title="${text(a.pinned ? 'Vormerkung entfernen' : 'Bewerbung vormerken')}">${ctx.icon('spark')}</button></div>${perks(a)}<div class="candidate-wage">${wage(a)}</div><div class="candidate-footer"><div><span>${text('Einstellung einmalig')}</span><strong data-candidate-price>${ctx.fmt(a.price)} CR</strong></div><button class="button primary small" data-personnel="hire" data-id="${a.id}" ${a.enabled ? '' : 'disabled'}>${text('Profil prüfen')}${ctx.icon('arrow')}</button></div><p class="personnel-reason" data-candidate-reason>${text(a.reason)}</p></article>`).join('')}</div><p class="policy-explainer">${text('Selbstwartung endet automatisch. Betriebskosten laufen weiter; bezahlte Einsätze pausieren ohne Verlust der Belohnung. Die ersten zwei Stunden sind geschützt.')}</p>`;
  }
  function personnelConfirm(extra) {
    const p = ctx.E.getPersonnel(ctx.state),
      hiring = extra?.action === 'hireCandidate';
    const a = hiring
      ? p.candidates.find((a) => a.id === extra.id)
      : ctx.state.agents.find((a) => a.id === extra?.id);
    if (!a)
      return `<p class="modal-intro">${text('Diese Bewerbung ist nicht mehr verfügbar. Die nächste Liste kommt automatisch.')}</p><button class="button" data-modal="agents">${text('Zum Arbeitsamt')}</button>`;
    const model = hiring ? a : p.agents.find((x) => x.id === a.id);
    return `<div class="candidate-header profile-review">${ctx.avatar(a)}<div><h3>${ctx.esc(a.name)}</h3><p>${text(ctx.E.catalog.roles[a.role].name)}</p></div></div>${perks(model)}<div class="candidate-wage">${wage(model)}</div><p class="modal-intro">${text(hiring ? 'Die Aktivierung kostet einmalig Credits. Danach fallen laufende Betriebskosten an, auch bei Selbstwartung. Fähigkeiten wirken auf den eigenen Beitrag und skalieren mit der Stufe.' : 'Einstellungskosten werden nicht erstattet. Ein Teamleitungsplatz wird frei. Laufende Einsätze müssen zuerst abgeschlossen werden.')}</p>${hiring ? `<div class="candidate-wage"><span>${text('Einstellung einmalig')}</span><strong data-personnel-confirm-price>${ctx.fmt(a.price)} CR</strong></div>` : ''}<p class="personnel-reason" data-personnel-confirm-reason></p><button class="button ${hiring ? 'primary' : 'danger'} block" data-personnel="confirm">${text(hiring ? 'Verbindlich einstellen' : 'Agent ausmustern')}</button>`;
  }
  function personnelClick(target) {
    const command = target.dataset.personnel;
    if (!command) return false;
    if (command === 'pin') ctx.execute('pinCandidate', { id: target.dataset.id });
    if (command === 'hire' || command === 'dismiss')
      ctx.openModal('personnel-confirm', {
        action: command === 'hire' ? 'hireCandidate' : 'dismissAgent',
        id: target.dataset.id,
      });
    if (command === 'confirm') {
      const p = ctx.modal?.extra;
      if (ctx.modal?.type === 'personnel-confirm' && p) ctx.execute(p.action, { id: p.id });
    }
    return true;
  }
  function updatePersonnel() {
    const market = ctx.$('[data-market-cycle]');
    const p = ctx.E.getPersonnel(ctx.state);
    if (market && ctx.modal?.type === 'agents' && Number(market.dataset.marketCycle) !== p.cycle) {
      ctx.openModal('agents');
      return;
    }
    ctx.$$('[data-market-eta]').forEach((el) => {
      el.textContent = ctx.duration(p.refreshIn);
    });
    for (const c of p.candidates) {
      ctx.$$(`[data-candidate="${c.id}"]`).forEach((card) => {
        card.querySelector('[data-candidate-price]').textContent = ctx.fmt(c.price) + ' CR';
        card.querySelector('[data-candidate-reason]').textContent = ctx.tr(c.reason);
        card.querySelector('[data-personnel="hire"]').disabled = !c.enabled;
      });
    }
    ctx.$$('[data-personnel-wage]').forEach((el) => {
      const model = p.agents.find((a) => a.id === el.dataset.personnelWage);
      if (model) el.textContent = ctx.dec(model.wage * 3600) + ' CR';
    });
    if (ctx.modal?.type === 'personnel-confirm') {
      const extra = ctx.modal.extra;
      const a =
        extra.action === 'hireCandidate'
          ? p.candidates.find((a) => a.id === extra.id)
          : ctx.state.agents.find((a) => a.id === extra.id);
      const reason = !a
        ? 'Diese Bewerbung ist nicht mehr verfügbar.'
        : extra.action === 'hireCandidate'
          ? a.reason
          : ctx.state.agents.length <= 1
            ? 'Mindestens ein Agent muss im Team bleiben.'
            : a.assignment || ctx.state.operations.projects.some((x) => x.agentId === a.id)
              ? 'Laufende Einsätze müssen zuerst abgeschlossen werden.'
              : '';
      const button = ctx.$('[data-personnel="confirm"]');
      if (button) button.disabled = !!reason;
      const label = ctx.$('[data-personnel-confirm-reason]');
      if (label) label.textContent = ctx.tr(reason);
      const price = ctx.$('[data-personnel-confirm-price]');
      if (price && a) price.textContent = ctx.fmt(a.price) + ' CR';
    }
  }
  return { personnelPerks: perks, marketModal, personnelConfirm, personnelClick, updatePersonnel };
}
