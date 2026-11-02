/** Commercial time advances in the same deterministic slices online and offline. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['customer-lifecycle'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    function assignCustomerWork(s) {
      if (!s.customers.autoAssign) return;
      const assignments = ctx.customerReadModel(s).assignments;
      const free = s.agents.filter((a) => ctx.agentProductive(s, a, assignments));
      // Queued paid setups take priority. Each agent can own just one assignment.
      for (const c of s.customers.contracts
        .filter((c) => c.work && !c.agentId)
        .sort((a, b) => (a.stage === 'setup' ? -1 : 0) - (b.stage === 'setup' ? -1 : 0))) {
        if (!free.length) break;
        if (c.work && !c.agentId) c.agentId = free.shift().id;
      }
    }
    function finishCustomerWork(s, c, supplied) {
      if (c.work === 'setup') {
        c.stage = 'active';
        c.reviewAt = s.time + 21600;
        ctx.addLog(s, 'success', `${c.client}: Dienst eingerichtet. Der Vertrag läuft jetzt.`);
      } else if (c.work === 'support') {
        c.issue = supplied < 0.95 ? 'observing' : '';
        c.satisfaction = Math.min(100, c.satisfaction + 5);
        ctx.addLog(
          s,
          'success',
          `${c.client}: Kundenanfrage bearbeitet. Die technische Versorgung bleibt entscheidend.`,
        );
      } else {
        const accepted =
          supplied >= 0.95 &&
          ctx.personnelHash(s.seed, c.id + '/retention/' + Math.floor(s.time / 86400)) % 100 <
            100 * (0.65 + ctx.researchEffects(s).retentionBonus);
        if (accepted) {
          c.notice = 0;
          c.departure = '';
          c.renew = true;
          c.deficit = 0;
          c.satisfaction = Math.max(75, c.satisfaction);
        }
        ctx.addLog(
          s,
          accepted ? 'success' : 'system',
          `${c.client}: Rückgewinnung ${accepted ? 'erfolgreich' : 'abgelehnt'}.`,
        );
      }
      c.work = '';
      c.workRemaining = c.workTotal = 0;
      c.agentId = null;
    }
    function endCustomer(s, c, reason) {
      s.customers.history.unshift({
        id: c.id,
        client: c.client,
        kind: c.kind,
        units: c.units,
        reason,
        time: s.time,
      });
      s.customers.history.length = Math.min(20, s.customers.history.length);
      s.customers.lost = Math.min(1e9, s.customers.lost + 1);
      ctx.addLog(s, 'system', `${c.client}: Kundenvertrag beendet (${reason}).`);
    }
    function advanceCustomers(s, dt, supply) {
      const book = s.customers;
      if (!book) return;
      const window = Math.floor(s.time / 3600) * 3600;
      if (window > book.budgetWindow) {
        book.budgetWindow = window;
        book.spent = 0;
      }
      book.leads = book.leads.filter((l) => l.expiresAt > s.time);
      if (s.time >= book.nextLeadAt) {
        const count = Math.min(3, 1 + Math.floor(Math.log2(1 + s.business.rooms.length) / 2));
        for (let i = 0; i < count && book.leads.length < 12; i++)
          book.leads.push(ctx.makeCustomerLead(s));
        book.nextLeadAt = s.time + 900;
      }
      if (s.time >= book.nextCheck) {
        book.nextCheck = s.time + 60;
        if (book.autoAccept) {
          outer: for (const lead of book.leads)
            for (const room of s.business.rooms) {
              const p = { id: lead.id, roomId: room.roomId },
                q = ctx.customerQuote(s, 'acceptCustomerLead', p);
              if (
                q.enabled &&
                book.spent + q.cost <= book.budget &&
                s.credits - q.cost >= ctx.maintenancePolicy(s).reserve
              ) {
                ctx.applyCustomers(s, 'acceptCustomerLead', p);
                book.spent += q.cost;
                break outer;
              }
            }
        }
        assignCustomerWork(s);
      }
      const ended = new Set();
      let ledgerChanged = false;
      for (const c of book.contracts) {
        const hadNotice = c.notice > 0;
        const room = supply?.[c.roomId],
          supplied = room?.[c.kind] ?? 0;
        if (c.work && c.agentId) {
          const agent = s.agents.find((a) => a.id === c.agentId);
          const needs = ctx.SERVICES[c.kind].needs;
          const ready =
            room &&
            !room.changing &&
            (c.stage !== 'setup' ||
              Object.keys(needs).every((key) => room.available[key] >= room.reserved[key]));
          if (agent && ctx.agentAvailable(s, agent) && ready) {
            if (c.stage === 'setup') ledgerChanged = true;
            const speed = ctx.customerWorkSpeed(s, agent);
            c.workRemaining = Math.max(0, c.workRemaining - dt * speed);
            if (!c.workRemaining) finishCustomerWork(s, c, supplied);
          }
        }
        if (c.stage !== 'active') continue;
        c.remaining = Math.max(0, c.remaining - dt);
        if (s.time >= s.business.transitionUntil) {
          c.deficit = Math.min(
            86400,
            Math.max(0, c.deficit + (supplied < 0.95 ? (1 - supplied) * dt : -dt / 2)),
          );
          c.satisfaction = ctx.clamp(
            c.satisfaction + (supplied < 0.95 ? (-(1 - supplied) * dt) / 180 : dt / 900),
            0,
            100,
          );
          if (c.issue === 'observing' && supplied >= 0.95) c.issue = '';
          if (c.deficit >= 900 && !c.issue) {
            c.issue = 'outage';
            ctx.addLog(s, 'system', `${c.client}: Beschwerde wegen unzureichender Versorgung.`);
          }
          if (c.deficit >= 7200 * (ctx.researchEffects?.(s).patience || 1) && !c.notice) {
            c.departure = 'sla';
            c.notice = Math.max(1, Math.min(21600, c.remaining));
            ctx.addLog(
              s,
              'system',
              `${c.client}: Kündigung wegen anhaltender Versorgungsprobleme angekündigt.`,
            );
          }
        }
        if (s.time >= c.reviewAt) {
          const draw = ctx.personnelHash(
            s.seed,
            c.id + '/review/' + Math.floor(c.reviewAt / 21600),
          );
          c.reviewAt = s.time + 21600;
          if (!c.notice && draw % 10000 < 125) {
            c.departure = ['budget', 'consolidation', 'competitor'][(draw >>> 16) % 3];
            c.notice = Math.max(1, c.remaining);
            ctx.addLog(
              s,
              'system',
              `${c.client}: Kündigung zum Vertragsende angekündigt (${c.departure}).`,
            );
          } else if (!c.issue && draw % 10000 > 9700) c.issue = 'question';
        }
        if (c.notice) {
          if (hadNotice) c.notice = Math.max(0, c.notice - dt);
          if (!c.notice) {
            ended.add(c.id);
            endCustomer(s, c, c.departure);
          }
        } else if (!c.remaining) {
          if (c.renew) {
            c.remaining = c.term;
            c.retentionUsed = false;
            c.premium = s.business.rooms
              .find((r) => r.roomId === c.roomId)
              .groups.find((g) => g.kind === c.kind).nextPremium;
            ctx.addLog(s, 'system', `${c.client}: Kundenvertrag verlängert.`);
          } else {
            ended.add(c.id);
            endCustomer(s, c, 'term');
          }
        }
      }
      if (ended.size) book.contracts = book.contracts.filter((c) => !ended.has(c.id));
      if (ended.size || ledgerChanged) ctx.syncCustomerGroups(s);
    }
    return { assignCustomerWork, advanceCustomers };
  };
});
