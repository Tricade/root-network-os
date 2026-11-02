import { workloadArt } from './workload-art.js';
import { customerLogo } from './business-art.js';

/** Commercial cards display named batches; resources still come from the room ledger. */
export function createCustomerCards(ctx) {
  const action = (name, label, id, extra = '') =>
    `<button class="button small" data-customer="${name}" data-id="${ctx.esc(id)}" ${extra}>${label}</button>`;
  const reasons = {
    sla: 'Versorgungsprobleme',
    budget: 'Kundenbudget',
    consolidation: 'Zusammenlegung',
    competitor: 'Anbieterwechsel',
    term: 'Vertragsende',
  };
  function customerStatus(c) {
    return ctx.tr(
      c.stage === 'setup' ? 'Einrichtung' : c.notice ? 'Kündigung angekündigt' : 'Aktiv',
    );
  }
  function leadCard(lead, roomId, model) {
    const q = ctx.E.quoteCustomer(ctx.state, 'acceptCustomerLead', { id: lead.id, roomId });
    const ready = q.enabled || q.reason === 'Das verfügbare Budget reicht nicht aus.';
    const units = {
      cpu: 'CPU',
      ram: 'GB RAM',
      storage: 'TB',
      network: 'Mbit/s',
      gpu: 'GPU',
      vram: 'GB VRAM',
    };
    const resources = Object.entries(q.resources || {})
      .filter(([, n]) => n > 0)
      .map(([k, n]) => ctx.dec(n) + ' ' + units[k])
      .join(' · ');
    return `<article class="offer-card customer-lead" data-customer-cost="${q.cost}" data-customer-ready="${ready}">${workloadArt(lead.kind === 'hosting' ? 'monitoring' : lead.kind === 'inference' ? 'ai' : lead.kind)}<span class="tag blue">KUNDENANFRAGE</span><div class="customer-identity">${customerLogo(lead.client)}<h3>${ctx.esc(lead.client)}</h3></div><p>${ctx.tr(model.services[lead.kind].name)} · ${ctx.fmt(lead.units)} ${ctx.tr(lead.units === 1 ? 'Diensteinheit' : 'Diensteinheiten')}</p><p class="customer-requirements"><strong>${ctx.tr('Ressourcenbedarf')}</strong><span>${ctx.esc(resources)}</span></p><div class="customer-facts"><span>Laufzeit <strong>${ctx.duration(lead.term)}</strong></span><span>Einrichtung <strong>${ctx.duration(q.duration || 600)} ${ctx.tr('Agentenzeit')}</strong></span><span>Einmalige Kosten <strong>${ctx.fmt(q.cost)} CR</strong></span></div><p class="protection-reason" data-customer-reason="${lead.id}">${ctx.esc(ctx.tr(q.reason))}</p><div class="card-actions">${action('acceptCustomerLead', 'Vertrag prüfen', lead.id, `data-room-id="${ctx.esc(roomId)}" ${q.enabled ? '' : 'disabled'}`)}${action('declineCustomerLead', 'Anfrage ablehnen', lead.id)}</div></article>`;
  }
  function contractCard(c, model) {
    const supply =
      model.rooms.find((r) => r.roomId === c.roomId)?.groups.find((g) => g.kind === c.kind)
        ?.supplied || 0;
    return `<article class="panel customer-contract" data-customer-id="${c.id}"><div class="customer-contract-heading"><div><span class="eyebrow">${ctx.tr(model.services[c.kind].name)}</span><div class="customer-identity">${customerLogo(c.client)}<h3>${ctx.esc(c.client)}</h3></div><small>${ctx.tr(`Raum ${Number(c.roomId.replace('room-', ''))}`)}</small></div><span class="tag ${c.notice ? 'amber' : c.stage === 'setup' ? 'blue' : 'green'}">${customerStatus(c)}</span></div><div class="customer-facts"><span>Diensteinheiten <strong>${ctx.fmt(c.units)}</strong></span><span>Versorgung <strong data-customer-supply="${c.id}">${c.stage === 'setup' ? ctx.tr('Noch nicht eingerichtet') : ctx.dec(supply * 100) + ' %'}</strong></span><span>Zufriedenheit <strong data-customer-satisfaction="${c.id}">${ctx.dec(c.satisfaction)} %</strong></span><span>Verbleibende Laufzeit <strong data-customer-time="${c.id}">${ctx.duration(c.stage === 'setup' ? c.term : c.remaining)}</strong></span></div>${c.notice ? `<p class="modal-alert">${ctx.tr('Kündigungsgrund')}: ${ctx.tr(reasons[c.departure])} · <span data-customer-notice="${c.id}">${ctx.duration(c.notice)}</span></p>` : ''}${c.issue ? `<p class="customer-issue">${ctx.tr(c.issue === 'question' ? 'Rückfrage zum Vertrag' : c.issue === 'observing' ? 'Versorgung nach Betreuung beobachten' : 'Beschwerde zur Dienstversorgung')}</p>` : ''}${
      c.work
        ? `<div class="customer-work"><strong data-customer-work="${c.id}"></strong><div class="progress-track"><div class="progress-fill blue" data-customer-progress="${c.id}"></div></div>${
            !c.agentId
              ? `<label class="field-label">Agent auswählen<select class="select" data-customer-agent="${c.id}"><option value="">Verfügbarer Agent</option>${ctx
                  .agentOperations()
                  .agents.filter((a) => !a.assignment && !a.absent)
                  .map(
                    (a) =>
                      `<option value="${a.id}">${ctx.esc(ctx.state.agents.find((x) => x.id === a.id).name)}</option>`,
                  )
                  .join(
                    '',
                  )}</select></label>${action('assignCustomerAgent', 'Agent zuweisen', c.id)}`
              : ''
          }</div>`
        : ''
    }<div class="card-actions">${action('setCustomerRenewal', c.renew ? 'Verlängerung: an' : 'Verlängerung: aus', c.id, `data-value="${!c.renew}"`)}${['outage', 'question'].includes(c.issue) && !c.work ? action('supportCustomer', 'Betreuung prüfen', c.id) : ''}${c.notice && !c.retentionUsed && !c.work ? action('retainCustomer', 'Rückgewinnung prüfen', c.id) : ''}</div></article>`;
  }
  return { leadCard, contractCard, customerStatus };
}
