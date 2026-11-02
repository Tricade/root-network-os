/** Customer expansion requests and delivery promises, separate from ordinary lead intake. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['customer-growth'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(ctx) {
    const WINDOWS = [3600, 14400, 43200];
    const CHECK_INTERVAL = 21600;
    const REQUEST_EXPIRY = 86400;
    const MAX_REQUESTS = 12;
    const MAX_UNITS = 10;
    const MAX_BUDGET = 1e12;

    function growthDefaults(s) {
      return {
        version: 1,
        nextCheckAt: s.time + CHECK_INTERVAL,
        requests: [],
        usedOrigins: [],
        linkedContracts: [],
      };
    }

    function sourceFor(s, request) {
      return s.customers.contracts.find((c) => c.id === request.sourceId) || null;
    }

    function requestFor(s, id) {
      return s.customerGrowth?.requests.find((r) => r.id === id) || null;
    }

    function sourceDeadlineRemaining(source) {
      if (source.notice > 0) return source.notice;
      if (!source.renew) return source.remaining;
      return Infinity;
    }

    function quoteGrowth(s, action, payload = {}) {
      const request = requestFor(s, payload.id);
      let reason = '',
        cost = 0,
        setupCost = 0,
        duration = 0,
        resources = {};
      if (action === 'declineCustomerGrowth') {
        if (!request || request.status !== 'offered' || request.expiresAt <= s.time)
          reason = 'Diese Erweiterungsanfrage ist nicht mehr verfügbar.';
      } else if (action === 'promiseCustomerGrowth') {
        if (!request || request.status !== 'offered' || request.expiresAt <= s.time)
          reason = 'Diese Erweiterungsanfrage ist nicht mehr verfügbar.';
        else {
          const source = sourceFor(s, request);
          if (!source || source.stage !== 'active' || source.notice > 0)
            reason = 'Der Ursprungskunde kann diese Erweiterung nicht mehr zusagen.';
          else if (!WINDOWS.includes(payload.windowSeconds))
            reason = 'Wähle ein Lieferfenster von 1, 4 oder 12 Stunden.';
          else if (payload.windowSeconds >= sourceDeadlineRemaining(source))
            reason = 'Das Lieferfenster endet nicht vor dem bestehenden Vertragsende.';
          else {
            const q = ctx.serviceQuote(s, 'contractService', {
              roomId: request.roomId,
              kind: request.kind,
              units: request.units,
            });
            setupCost = q.cost;
            resources = q.resources || {};
            if (!Number.isSafeInteger(setupCost) || setupCost <= 0)
              reason = 'Der Einrichtungspreis konnte nicht berechnet werden.';
            else if (
              !Number.isSafeInteger(payload.budgetCeiling) ||
              payload.budgetCeiling < setupCost ||
              payload.budgetCeiling > MAX_BUDGET
            )
              reason = 'Die Budgetfreigabe muss mindestens den Einrichtungspreis abdecken.';
            else if (s.credits - payload.budgetCeiling < (ctx.maintenancePolicy(s).reserve || 0))
              reason = 'Die Budgetfreigabe würde die geschützte Geldreserve unterschreiten.';
            else {
              cost = payload.budgetCeiling;
              duration = payload.windowSeconds;
            }
          }
        }
      } else reason = 'Unbekannter Wachstumsauftrag.';
      return {
        enabled: !reason,
        reason,
        cost,
        setupCost,
        duration,
        resources,
        reservedBudget: action === 'promiseCustomerGrowth' ? cost : 0,
      };
    }

    function applyGrowth(s, action, payload = {}) {
      if (!['promiseCustomerGrowth', 'declineCustomerGrowth'].includes(action)) return null;
      const q = quoteGrowth(s, action, payload);
      if (!q.enabled) return { ok: false, message: q.reason };
      const request = requestFor(s, payload.id);
      if (action === 'declineCustomerGrowth') {
        s.customerGrowth.requests = s.customerGrowth.requests.filter((r) => r.id !== request.id);
        ctx.addLog(s, 'system', `${request.client}: Erweiterungsanfrage abgelehnt.`);
        return { ok: true, message: 'Erweiterungsanfrage abgelehnt.' };
      }
      s.credits -= q.cost;
      Object.assign(request, {
        status: 'promised',
        promisedAt: s.time,
        windowSeconds: payload.windowSeconds,
        deadlineAt: s.time + payload.windowSeconds,
        budgetCeiling: payload.budgetCeiling,
        escrow: payload.budgetCeiling,
        nextAttemptAt: s.time,
        contractId: null,
        latePenaltyApplied: false,
      });
      ctx.addLog(
        s,
        'system',
        `${request.client}: Erweiterung bis zum vereinbarten Liefertermin zugesagt; ${q.cost} Credits sind reserviert.`,
      );
      return { ok: true, message: 'Liefertermin und Budgetfreigabe zugesagt.' };
    }

    function addRequest(s, source) {
      const g = s.customerGrowth;
      if (
        g.requests.length >= MAX_REQUESTS ||
        g.usedOrigins.includes(source.id) ||
        g.linkedContracts.includes(source.id)
      )
        return false;
      const units = Math.max(1, Math.min(MAX_UNITS, Math.ceil(source.units * 0.15)));
      let expiresAt = s.time + REQUEST_EXPIRY;
      const sourceEnd = sourceDeadlineRemaining(source);
      if (Number.isFinite(sourceEnd)) expiresAt = Math.min(expiresAt, s.time + sourceEnd);
      if (expiresAt <= s.time) return false;
      const id = ctx.uid(s, 'growth');
      g.requests.push({
        id,
        sourceId: source.id,
        client: source.client,
        roomId: source.roomId,
        kind: source.kind,
        units,
        term: source.term,
        createdAt: s.time,
        expiresAt,
        status: 'offered',
        promisedAt: 0,
        windowSeconds: 0,
        deadlineAt: 0,
        budgetCeiling: 0,
        escrow: 0,
        nextAttemptAt: 0,
        contractId: null,
        latePenaltyApplied: false,
      });
      g.usedOrigins.push(source.id);
      ctx.addLog(s, 'system', `${source.client}: Fragt eine begrenzte Diensterweiterung an.`);
      return true;
    }

    function applyLatePenalty(s, request) {
      if (request.latePenaltyApplied) return;
      const source = sourceFor(s, request);
      s.reputation = Math.max(0, s.reputation - 5);
      if (source) source.satisfaction = Math.max(0, source.satisfaction - 10);
      request.latePenaltyApplied = true;
      ctx.addLog(
        s,
        'system',
        `${request.client}: Lieferfenster für die Erweiterung verpasst; Ansehen und Kundenbindung sinken.`,
      );
    }

    function removeRequest(s, request, refundEscrow = false) {
      if (refundEscrow && request.escrow) s.credits += request.escrow;
      s.customerGrowth.requests = s.customerGrowth.requests.filter((r) => r.id !== request.id);
    }

    function tryStartProvisioning(s, request) {
      const source = sourceFor(s, request);
      if (!source || source.stage !== 'active' || source.notice > 0) {
        removeRequest(s, request, true);
        return;
      }
      const quoteState = { ...s, credits: s.credits + request.escrow };
      const q = ctx.serviceQuote(quoteState, 'contractService', {
        roomId: request.roomId,
        kind: request.kind,
        units: request.units,
      });
      const roomContracts = s.customers.contracts.filter((c) => c.roomId === request.roomId).length;
      if (
        !q.enabled ||
        q.cost > request.budgetCeiling ||
        roomContracts >= ctx.CUSTOMER_ROOM_LIMIT
      ) {
        request.nextAttemptAt = s.time + 60;
        return;
      }
      const contract = ctx.makeCustomer(s, request.roomId, request.kind, request.units, true),
        group = s.business.rooms
          .find((r) => r.roomId === request.roomId)
          ?.groups.find((g) => g.kind === request.kind);
      if (!group) {
        request.nextAttemptAt = s.time + 60;
        return;
      }
      Object.assign(contract, {
        client: request.client,
        term: request.term,
        remaining: request.term,
        premium: group.nextPremium,
        renew: group.renew,
      });
      s.credits += request.escrow - q.cost;
      request.escrow = 0;
      request.status = 'provisioning';
      request.contractId = contract.id;
      request.nextAttemptAt = 0;
      s.customers.contracts.push(contract);
      s.customers.won = Math.min(1e9, s.customers.won + 1);
      s.customerGrowth.linkedContracts.push(contract.id);
      ctx.syncCustomerGroups(s);
      ctx.assignCustomerWork(s);
      ctx.addLog(
        s,
        'system',
        `${request.client}: Erweiterung wird mit der normalen Kundenprovisionierung eingerichtet.`,
      );
    }

    function advanceGrowth(s, dt) {
      const g = s.customerGrowth;
      if (!g) return;
      const contracts = s.customers.contracts,
        contractIds = new Set(contracts.map((c) => c.id));
      g.usedOrigins = g.usedOrigins.filter((id) => contractIds.has(id));
      g.linkedContracts = g.linkedContracts.filter((id) => contractIds.has(id));
      for (const request of [...g.requests])
        if (request.status === 'offered' && request.expiresAt <= s.time) {
          ctx.addLog(
            s,
            'system',
            `${request.client}: Ungenutzte Erweiterungsanfrage ist abgelaufen.`,
          );
          removeRequest(s, request);
        }

      let checkCount = 0;
      const maxChecks = Math.min(3, Math.max(1, Math.ceil((dt || 1) / CHECK_INTERVAL) + 1));
      while (g.nextCheckAt <= s.time && checkCount < maxChecks) {
        checkCount++;
        const checkedAt = g.nextCheckAt,
          review = Math.floor(checkedAt / CHECK_INTERVAL);
        g.nextCheckAt += CHECK_INTERVAL;
        for (const source of contracts) {
          if (
            source.stage !== 'active' ||
            source.notice > 0 ||
            source.issue ||
            source.satisfaction < 80 ||
            g.usedOrigins.includes(source.id) ||
            g.linkedContracts.includes(source.id) ||
            g.requests.length >= MAX_REQUESTS
          )
            continue;
          const draw = ctx.personnelHash(s.seed, `growth/${source.id}/${review}`) % 10000;
          if (draw < 500) addRequest(s, source);
        }
      }

      const live = new Map(contracts.map((c) => [c.id, c]));
      for (const request of [...g.requests]) {
        const source = live.get(request.sourceId);
        if (!source && request.status !== 'provisioning') {
          removeRequest(s, request, true);
          continue;
        }
        if (request.status === 'offered') {
          continue;
        }
        if (request.status === 'provisioning') {
          const contract = live.get(request.contractId);
          if (!contract) {
            g.linkedContracts = g.linkedContracts.filter((id) => id !== request.contractId);
            removeRequest(s, request);
            continue;
          }
          if (contract.stage === 'active') {
            if (s.time > request.deadlineAt) applyLatePenalty(s, request);
            else
              ctx.addLog(
                s,
                'success',
                `${request.client}: Erweiterung rechtzeitig bereitgestellt.`,
              );
            removeRequest(s, request);
            continue;
          }
          if (s.time >= request.deadlineAt) applyLatePenalty(s, request);
          continue;
        }
        if (s.time >= request.deadlineAt) {
          applyLatePenalty(s, request);
          removeRequest(s, request, true);
          continue;
        }
        if (s.time >= request.nextAttemptAt) tryStartProvisioning(s, request);
      }
    }

    function normalizeGrowth(s, input) {
      const bad = () => {
        throw new Error('Ungültige Kundenwachstumspläne.');
      };
      if (!input || typeof input !== 'object' || Array.isArray(input) || input.version !== 1) bad();
      if (
        !Number.isFinite(input.nextCheckAt) ||
        input.nextCheckAt < s.time ||
        input.nextCheckAt > s.time + CHECK_INTERVAL ||
        !Array.isArray(input.requests) ||
        input.requests.length > MAX_REQUESTS ||
        !Array.isArray(input.usedOrigins) ||
        !Array.isArray(input.linkedContracts)
      )
        bad();
      const contracts = new Map(s.customers.contracts.map((c) => [c.id, c])),
        requestIds = new Set(),
        usedOrigins = new Set(),
        linkedContracts = new Set();
      const id = (value, prefix, seen) => {
        if (
          typeof value !== 'string' ||
          !new RegExp('^' + prefix + '-[1-9][0-9]*$').test(value) ||
          seen.has(value) ||
          Number(value.split('-').at(-1)) >= s.nextId
        )
          bad();
        seen.add(value);
        return value;
      };
      for (const value of input.usedOrigins) {
        if (typeof value !== 'string' || !contracts.has(value) || usedOrigins.has(value)) bad();
        usedOrigins.add(value);
      }
      for (const value of input.linkedContracts) {
        const contract = contracts.get(value);
        if (
          !contract ||
          linkedContracts.has(value) ||
          !['active', 'setup'].includes(contract.stage)
        )
          bad();
        linkedContracts.add(value);
      }
      for (const value of usedOrigins) if (linkedContracts.has(value)) bad();
      const requestSources = new Set(),
        provisioningContracts = new Set();
      const requests = input.requests.map((value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) bad();
        const requestId = id(value.id, 'growth', requestIds),
          source = contracts.get(value.sourceId);
        if (
          typeof value.sourceId !== 'string' ||
          !/^customer-[1-9][0-9]*$/.test(value.sourceId) ||
          typeof value.roomId !== 'string' ||
          !/^room-[1-9][0-9]*$/.test(value.roomId) ||
          !Object.hasOwn(ctx.SERVICES, value.kind) ||
          (value.status !== 'provisioning' &&
            (!source || source.stage !== 'active' || !usedOrigins.has(value.sourceId))) ||
          (source && !usedOrigins.has(value.sourceId)) ||
          linkedContracts.has(value.sourceId) ||
          requestSources.has(value.sourceId) ||
          (source &&
            (value.units !== Math.max(1, Math.min(MAX_UNITS, Math.ceil(source.units * 0.15))) ||
              source.client !== value.client ||
              source.roomId !== value.roomId ||
              source.kind !== value.kind ||
              source.term !== value.term)) ||
          typeof value.client !== 'string' ||
          !value.client.trim() ||
          value.client.length > 120 ||
          !Number.isInteger(value.units) ||
          value.units < 1 ||
          value.units > MAX_UNITS ||
          !ctx.CUSTOMER_TERMS.includes(value.term) ||
          !Number.isFinite(value.createdAt) ||
          value.createdAt < 0 ||
          value.createdAt > s.time ||
          !Number.isFinite(value.expiresAt) ||
          value.expiresAt <= value.createdAt ||
          value.expiresAt > value.createdAt + REQUEST_EXPIRY ||
          !['offered', 'promised', 'provisioning'].includes(value.status)
        )
          bad();
        requestSources.add(value.sourceId);
        const common = {
          id: requestId,
          sourceId: value.sourceId,
          client: value.client,
          roomId: value.roomId,
          kind: value.kind,
          units: value.units,
          term: value.term,
          createdAt: value.createdAt,
          expiresAt: value.expiresAt,
          status: value.status,
        };
        if (value.status === 'offered') {
          if (
            value.expiresAt <= s.time ||
            value.promisedAt !== 0 ||
            value.windowSeconds !== 0 ||
            value.deadlineAt !== 0 ||
            value.budgetCeiling !== 0 ||
            value.escrow !== 0 ||
            value.nextAttemptAt !== 0 ||
            value.contractId !== null ||
            value.latePenaltyApplied !== false
          )
            bad();
          return {
            ...common,
            promisedAt: 0,
            windowSeconds: 0,
            deadlineAt: 0,
            budgetCeiling: 0,
            escrow: 0,
            nextAttemptAt: 0,
            contractId: null,
            latePenaltyApplied: false,
          };
        }
        const promisedAt = value.promisedAt,
          windowSeconds = value.windowSeconds,
          budgetCeiling = value.budgetCeiling,
          escrow = value.escrow,
          latePenaltyApplied = value.latePenaltyApplied;
        if (
          !Number.isFinite(promisedAt) ||
          promisedAt < value.createdAt ||
          promisedAt > s.time ||
          !WINDOWS.includes(windowSeconds) ||
          value.deadlineAt !== promisedAt + windowSeconds ||
          !Number.isSafeInteger(budgetCeiling) ||
          budgetCeiling <= 0 ||
          budgetCeiling > MAX_BUDGET ||
          !Number.isFinite(escrow) ||
          typeof latePenaltyApplied !== 'boolean'
        )
          bad();
        const setupCost = Math.round(ctx.SERVICES[value.kind].fee * 1800) * value.units;
        if (budgetCeiling < setupCost) bad();
        let contractId = null,
          nextAttemptAt = 0;
        if (value.status === 'promised') {
          if (
            value.contractId !== null ||
            escrow !== budgetCeiling ||
            latePenaltyApplied ||
            !Number.isFinite(value.nextAttemptAt) ||
            value.nextAttemptAt < promisedAt ||
            value.nextAttemptAt > s.time + 60
          )
            bad();
          nextAttemptAt = value.nextAttemptAt;
        } else {
          contractId = id(value.contractId, 'customer', new Set());
          const contract = contracts.get(contractId);
          if (
            value.sourceId === contractId ||
            provisioningContracts.has(contractId) ||
            escrow !== 0 ||
            !linkedContracts.has(contractId) ||
            !contract ||
            contract.roomId !== value.roomId ||
            contract.kind !== value.kind ||
            contract.units !== value.units ||
            contract.client !== value.client ||
            contract.term !== value.term ||
            !['active', 'setup'].includes(contract.stage)
          )
            bad();
          provisioningContracts.add(contractId);
        }
        return {
          ...common,
          promisedAt,
          windowSeconds,
          deadlineAt: value.deadlineAt,
          budgetCeiling,
          escrow,
          nextAttemptAt,
          contractId,
          latePenaltyApplied,
        };
      });
      if (requests.some((r) => r.status !== 'provisioning' && !usedOrigins.has(r.sourceId))) bad();
      return {
        version: 1,
        nextCheckAt: input.nextCheckAt,
        requests,
        usedOrigins: [...usedOrigins],
        linkedContracts: [...linkedContracts],
      };
    }

    function getGrowth(s) {
      const state = s.customerGrowth;
      const requests = state.requests.map((request) => {
        const price = ctx.serviceQuote(s, 'contractService', {
          roomId: request.roomId,
          kind: request.kind,
          units: request.units,
        });
        return {
          ...request,
          quote: quoteGrowth(s, 'promiseCustomerGrowth', {
            id: request.id,
            windowSeconds: 3600,
            budgetCeiling: request.status === 'offered' ? price.cost : request.budgetCeiling,
          }),
        };
      });
      return {
        ...state,
        requests,
        usedOrigins: [...state.usedOrigins],
        linkedContracts: [...state.linkedContracts],
        reservedBudget: state.requests.reduce((sum, request) => sum + request.escrow, 0),
        offered: state.requests.filter((r) => r.status === 'offered').length,
        promised: state.requests.filter((r) => r.status === 'promised').length,
        provisioning: state.requests.filter((r) => r.status === 'provisioning').length,
      };
    }

    return {
      growthDefaults,
      quoteGrowth,
      growthQuote: quoteGrowth,
      applyGrowth,
      advanceGrowth,
      normalizeGrowth,
      getGrowth,
    };
  };
});
