/** A paid development decision shows measured network effects, including capped benefits. */
export function createAgentDevelopmentUI(ctx) {
  const effects = {
    service: 'Schnellere Einrichtung, Betreuung und Rückgewinnung von Kunden.',
    maintenance: 'Schnellere Vorbereitung bei vorbeugender Rackwartung.',
    projects: 'Mehr Auftragsdurchsatz im Normalbetrieb. Der Teambonus ist auf 15 % begrenzt.',
  };

  function agentSpecialtyModal(id) {
    const agent = ctx.state.agents.find((a) => a.id === id);
    if (!agent) return '<p>Agent nicht gefunden.</p>';
    return `<p class="modal-intro">${ctx.esc(agent.name)} · ${ctx.tr('Stufe')} ${agent.level}</p>
      <p>${ctx.tr('Wähle eine Spezialisierung. Weitere Stufen steigern den Bonus mit abnehmendem Zuwachs. Ein Wechsel kostet erneut Credits.')}</p>
      <div class="protection-choices">${Object.entries(ctx.E.agentSpecialties)
        .map(([key, def]) => {
          const q = ctx.E.quoteAgentSpecialty(ctx.state, id, key);
          return `<article class="protection-option"><h3>${ctx.esc(ctx.tr(def.name))}</h3>
          <p>${ctx.esc(ctx.tr(effects[key]))}</p><div class="protection-cost">+${ctx.dec(q.bonus * 100)} % · ${ctx.fmt(q.cost)} CR</div>
          <p class="protection-reason" data-specialty-reason="${key}">${ctx.esc(ctx.tr(q.reason))}</p>
          <button class="button block" data-agent-specialty="${key}" data-id="${ctx.esc(id)}" ${q.enabled ? '' : 'disabled'}>${ctx.tr('Spezialisierung bestätigen')}</button></article>`;
        })
        .join('')}</div>`;
  }

  function agentUpgradeModal(id) {
    const a = ctx.state.agents.find((a) => a.id === id),
      q = ctx.E.getAgentDevelopment(ctx.state, id);
    if (!a || !q) return '<p>Agent nicht gefunden.</p>';
    const row = (label, key, unit = '', lower = false, digits = 2) => {
      const before = q.before[key],
        after = q.after[key],
        delta = after - before;
      const number = (n) =>
        new Intl.NumberFormat(ctx.I18N.getLanguage(), { maximumFractionDigits: digits }).format(n);
      return `<div class="development-row"><span>${ctx.esc(ctx.tr(label))}</span><strong>${number(before)}${unit} <span aria-hidden="true">→</span> ${number(after)}${unit}</strong><small class="${Math.abs(delta) < 1e-8 ? 'muted' : (lower ? delta < 0 : delta > 0) ? 'positive' : 'negative'}">${Math.abs(delta) < 1e-8 ? ctx.tr('Aktuell keine Änderung') : (delta > 0 ? '+' : '') + number(delta) + unit}</small></div>`;
    };
    return `<p class="modal-intro"><strong>${ctx.esc(a.name)}</strong> · ${ctx.tr('Stufe')} ${q.level} → ${q.nextLevel}</p><div class="development-comparison"><h3>Aktuelle Wirkung im gesamten Netzwerk</h3>${row('Projektdurchsatz / min', 'work')}${row('Forschung / min', 'research')}${row('Störungsrisiko / Stunde', 'risk', ' %', true)}${row('Serververschleiß / Stunde', 'wear', ' %', true, 4)}</div><div class="development-comparison"><h3>Eigene Kosten und Fähigkeiten</h3>${row('Betriebskosten / Stunde', 'wage', ' CR', true)}${row('Standard-Kundeneinsatz', 'customerSeconds', ' s', true, 0)}${a.role === 'engineer' ? row('Wartungsvorbereitung für einen Server', 'maintenanceSeconds', ' s', true, 0) : ''}${row('Kapazitätsbonus als Teamleitung', 'management', ' %')}${row('Punkte aus einem Forschungseinsatz', 'missionResearch', ' FP', false, 0)}</div><p class="policy-explainer">Berechnung beim Öffnen mit aktuellen Servern, Auslastung und Schwerpunkt. Bereits erreichte Grenzen können den zusätzlichen Nutzen reduzieren. Teamleitung und Kundeneinsätze wirken nur bei passender Zuweisung. Einsätze dauern je nach Aufgabe länger; der Vergleich zeigt 600 Arbeitseinheiten.</p>${!q.productive ? '<div class="modal-alert">Der Agent liefert gerade keinen normalen Betriebsbeitrag. Passive Vorteile gelten nach seiner Rückkehr.</div>' : ''}<p class="policy-explainer">Das Upgrade ist dauerhaft und wird sofort bezahlt. Die höheren Betriebskosten fallen auch während Einsätzen und Selbstwartung an.</p><div class="protection-cost">${ctx.fmt(q.cost)} CR</div><p class="protection-reason" data-agent-upgrade-reason>${ctx.esc(ctx.tr(q.reason))}</p><button class="button primary block" data-agent-upgrade="${id}" ${q.enabled ? '' : 'disabled'}>${ctx.icon('plus')}Upgrade bestätigen</button>`;
  }
  function updateAgentDevelopment() {
    if (ctx.modal?.type === 'agent-specialty') {
      ctx.$$('[data-agent-specialty]').forEach((button) => {
        const key = button.dataset.agentSpecialty;
        const q = ctx.E.quoteAgentSpecialty(ctx.state, button.dataset.id, key);
        button.disabled = !q.enabled;
        const reason = ctx.$(`[data-specialty-reason="${key}"]`);
        if (reason) reason.textContent = ctx.tr(q.reason);
      });
      return;
    }
    if (ctx.modal?.type !== 'agent-upgrade') return;
    const q = ctx.E.quoteAgentUpgrade(ctx.state, ctx.modal.extra),
      button = ctx.$('[data-agent-upgrade]'),
      reason = ctx.$('[data-agent-upgrade-reason]');
    if (button) button.disabled = !q.enabled;
    if (reason) reason.textContent = ctx.tr(q.reason);
  }
  function agentDevelopmentClick(el) {
    if (el.hasAttribute('data-agent-specialty')) {
      ctx.execute('specializeAgent', { id: el.dataset.id, specialty: el.dataset.agentSpecialty });
      return true;
    }
    if (!el.hasAttribute('data-agent-upgrade')) return false;
    ctx.execute('upgradeAgent', { id: el.dataset.agentUpgrade });
    return true;
  }
  return { agentUpgradeModal, agentSpecialtyModal, updateAgentDevelopment, agentDevelopmentClick };
}
