import { createCustomerPortfolio } from './customer-portfolio.js';
import { createCustomerCards } from './customer-cards.js';
import { createCustomerControls } from './customer-controls.js';

/** Customer sales, contracts and service quality. Room engineering lives in Facility. */
export function createBusinessUI(ctx) {
  let selectedRoom = null;
  function selectCustomerRoom(id) {
    if (!ctx.state.business.rooms.some((r) => r.roomId === id)) return false;
    selectedRoom = id;
    portfolio.selectRoom(id);
    return true;
  }
  const cards = createCustomerCards(ctx),
    controls = createCustomerControls(ctx);
  const portfolio = createCustomerPortfolio(ctx, cards, {
    getRoom: () => selectedRoom,
    setRoom: (id) => {
      selectedRoom = id;
    },
  });
  const businessView = () => portfolio.view();
  function businessClick(target) {
    if (portfolio.click(target)) return true;
    if (target.hasAttribute('data-service-confirm')) {
      const extra = ctx.modal?.extra;
      if (ctx.modal?.type !== 'business-confirm' || !extra) return true;
      ctx.closeModal();
      ctx.execute(extra.action, extra.payload);
      return true;
    }
    if (controls.customerClick(target)) return true;
    const action = target.dataset.service;
    if (!action) return false;
    const card = target.closest('[data-business-room]'),
      read = (key) => card.querySelector(`[data-field="${key}"]`)?.value;
    const payload = { roomId: card.dataset.businessRoom, kind: card.dataset.serviceKind };
    if (action === 'convertRoomSupply') {
      payload.system = read('system');
      payload.mode = read('mode');
    }
    if (action === 'configureServiceRoom') {
      payload.profile = read('profile');
      payload.reserve = Number(read('reserve'));
    }
    if (action === 'assignManager') payload.id = read('manager') || null;
    if (action.startsWith('setService')) payload.value = target.dataset.value === 'true';
    if (action === 'setServicePriority') payload.kind = read('priority');
    ctx.openModal('business-confirm', { action, payload });
    return true;
  }
  function businessConfirm(extra) {
    if (extra.action.includes('Customer')) return controls.customerConfirm(extra);
    const q =
      extra.action === 'setServicePriority'
        ? ctx.E.quoteServicePriority(ctx.state, extra.payload)
        : extra.action === 'convertRoomSupply'
          ? ctx.E.quoteSupply(ctx.state, extra.payload)
          : ctx.E.quoteService(ctx.state, extra.action, extra.payload);
    return `<p class="modal-intro">${ctx.esc(ctx.tr(q.label || 'Betriebsplan ändern'))}</p><div class="status-row"><span>Kosten</span><strong>${ctx.fmt(q.cost)} CR</strong></div><div class="status-row"><span>Dauer</span><strong>${ctx.duration(q.duration || 0)}</strong></div><p>${extra.action === 'setServicePriority' ? 'Die gewählte Dienstklasse erhält bei Engpässen zuerst Ressourcen. Andere Verträge teilen sich die verbleibende Kapazität. Die Richtlinie bleibt eine Simulationsstunde bindend; vorhandene Ressourcen und Stromreserven werden dadurch nicht größer.' : extra.action === 'convertRoomSupply' ? 'Dieser Raum ist beim Umbau drei Minuten offline. Zentrale Versorgung betrifft nur angeschlossene Räume; lokale Reserve kann weiterhin Leistung liefern.' : 'Raumprofile, Reserve und Teams beeinflussen die zugesagte Kundenversorgung. Teams verursachen laufende Kosten; bestehende Premiumzusagen bleiben bis zur Verlängerung bindend.'}</p>${q.reason ? `<div class="modal-alert">${ctx.esc(ctx.tr(q.reason))}</div>` : ''}<button class="button primary block" data-service-confirm ${q.enabled ? '' : 'disabled'}>Bestätigen</button>`;
  }
  function businessChange(el) {
    if (portfolio.change(el)) return true;
    if (ctx.roomOperationsChange?.(el)) return true;
    if (!el.hasAttribute('data-business-select')) return false;
    selectedRoom = el.value;
    el.blur();
    ctx.render();
    return true;
  }
  function businessSignature() {
    if (!['business', 'facility', 'overview', 'agents', 'operations'].includes(ctx.view)) return '';
    return JSON.stringify([
      ctx.state.servicePriorities,
      ctx.state.business.rooms.map((r) => [
        r.roomId,
        r.profile,
        r.reserve,
        r.crew,
        r.managerId,
        r.changeRemaining > 0,
        r.supply,
        r.conversion?.system,
        r.groups.map((g) => [g.kind, g.units, g.pending, g.renew, g.nextPremium]),
      ]),
      ctx.state.customers.leads.map((l) => l.id),
      ctx.state.customers.contracts.map((c) => [
        c.id,
        c.stage,
        c.work,
        c.agentId,
        c.issue,
        c.notice > 0,
        c.renew,
        c.retentionUsed,
      ]),
      ctx.state.customers.history[0]?.id,
      ctx.state.jobs.map((j) => j.id),
    ]);
  }
  function updateBusiness(metrics = null) {
    if (!['overview', 'business', 'automation'].includes(ctx.view)) return;
    const m = metrics || ctx.E.getMetrics(ctx.state),
      model = ctx.E.getBusinessModel(ctx.state, m),
      book = ctx.E.getCustomers(ctx.state, {
        summaryOnly: ctx.view !== 'business',
      });
    const room = model.rooms.find((r) => r.roomId === selectedRoom);
    const values = {
      gross: ctx.dec(model.gross * 60) + ' CR',
      cost: ctx.dec(m.upkeep * 60) + ' CR',
      net: ctx.dec(m.incomePerSecond * 60) + ' CR',
      allowance: ctx.dec(m.recoveryAllowance * 60) + ' CR',
    };
    ctx.$$('[data-business-stat]').forEach((el) => {
      el.textContent = values[el.dataset.businessStat];
      if (el.dataset.businessStat === 'net') el.classList.toggle('negative', m.incomePerSecond < 0);
    });
    ctx.$$('[data-customer-stat]').forEach((el) => {
      const key = el.dataset.customerStat;
      el.textContent = ctx.fmt(key === 'leads' ? book.leads.length : book[key] || 0);
    });
    if (room)
      ctx.$$('[data-room-resource]').forEach((el) => {
        const key = el.dataset.roomResource;
        el.textContent = ctx.dec(room.reserved[key]) + ' / ' + ctx.dec(room.available[key]);
      });
    const spent = ctx.$('[data-customer-spent]');
    if (spent) spent.textContent = ctx.fmt(book.spent) + ' CR';
    if (ctx.view !== 'business') return;
    const visibleIds = new Set(ctx.$$('[data-customer-id]').map((el) => el.dataset.customerId));
    for (const c of book.contracts.filter((c) => visibleIds.has(c.id))) {
      const supplied =
        model.rooms.find((r) => r.roomId === c.roomId)?.groups.find((g) => g.kind === c.kind)
          ?.supplied || 0;
      const write = (key, value) => {
        const el = ctx.$(`[data-customer-${key}="${c.id}"]`);
        if (el) el.textContent = value;
      };
      write('time', ctx.duration(c.stage === 'setup' ? c.term : c.remaining));
      write('notice', ctx.duration(c.notice));
      write('satisfaction', ctx.dec(c.satisfaction) + ' %');
      write(
        'supply',
        c.stage === 'setup' ? ctx.tr('Noch nicht eingerichtet') : ctx.dec(supplied * 100) + ' %',
      );
      const agent = ctx.state.agents.find((a) => a.id === c.agentId);
      write(
        'work',
        (agent ? agent.name : ctx.tr('Wartet auf Agent')) + ' · ' + ctx.duration(c.workRemaining),
      );
      const progress = ctx.$(`[data-customer-progress="${c.id}"]`);
      if (progress)
        progress.style.width = (c.workTotal ? 100 * (1 - c.workRemaining / c.workTotal) : 0) + '%';
    }
    ctx.$$('[data-customer-ready]').forEach((card) => {
      if (card.dataset.customerReady !== 'true') return;
      const affordable = ctx.state.credits >= Number(card.dataset.customerCost);
      card.querySelector('[data-customer="acceptCustomerLead"]').disabled = !affordable;
      card.querySelector('[data-customer-reason]').textContent = affordable
        ? ''
        : ctx.tr('Das verfügbare Budget reicht nicht aus.');
    });
  }
  return {
    ...controls,
    selectCustomerFilter: portfolio.selectFilter,
    businessInput: portfolio.input,
    selectCustomerRoom,
    businessView,
    businessClick,
    businessChange,
    businessConfirm,
    businessSignature,
    updateBusiness,
  };
}
