/** Personnel effects and health are shared by online, offline and read models. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {}).personnel = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    const STRENGTHS = {
      throughput: {
        name: 'Prozessprofi',
        description: 'Eigener Beitrag zum Auftragsdurchsatz +18 %.',
        work: 1.18,
      },
      research: {
        name: 'Wissensdurst',
        description: 'Eigener Forschungsbeitrag im Normalbetrieb +18 %.',
        research: 1.18,
      },
      maintenance: {
        name: 'Sorgfältige Pflege',
        description: 'Eigener Wartungsbeitrag +18 %.',
        care: 1.18,
      },
      leadership: {
        name: 'Teamgefühl',
        description: 'Als Teamleitung: Kapazitätsbonus +3 Prozentpunkte.',
        management: 0.03,
      },
      frugal: {
        name: 'Sparsame Hardware',
        description: 'Eigene Betriebskosten −15 %.',
        wage: 0.85,
      },
      steady: {
        name: 'Ausgeglichen',
        description: 'Seltenere Selbstwartung; Teamleitungsbonus +1 Prozentpunkt.',
        management: 0.01,
      },
    };
    const WEAKNESSES = {
      deliberate: {
        name: 'Bedächtiges Tempo',
        description: 'Eigener Beitrag zum Auftragsdurchsatz −10 %.',
        work: 0.9,
      },
      guidance: {
        name: 'Lernbegleitung nötig',
        description: 'Eigener Forschungsbeitrag im Normalbetrieb −10 %.',
        research: 0.9,
      },
      careless: {
        name: 'Pflege ist Nebensache',
        description: 'Eigener Wartungsbeitrag −12 %.',
        care: 0.88,
      },
      expensive: {
        name: 'Hungrige Hardware',
        description: 'Eigene Betriebskosten +20 %.',
        wage: 1.2,
      },
      recovery: {
        name: 'Wartungsanfällig',
        description:
          'Gelegentlich 8–12 Minuten Selbstwartung; Grundintervall etwa 4–6 Betriebsstunden.',
      },
      independent: {
        name: 'Lieber allein',
        description: 'Als Teamleitung: Kapazitätsbonus −4 Prozentpunkte.',
        management: -0.04,
      },
    };
    // Independent salted draws keep appearance unrelated to role, perks or health.
    function personnelHash(seed, key) {
      let h = (seed ^ 0x811c9dc5) >>> 0;
      for (const c of String(key)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
      h ^= h >>> 16;
      h = Math.imul(h, 0x7feb352d) >>> 0;
      h ^= h >>> 15;
      return h >>> 0;
    }
    function personnelDefaults(s) {
      return {
        version: 1,
        seed: personnelHash(s.seed, 'personnel'),
        cycle: Math.floor(s.time / 1800),
        taken: [],
        pinned: null,
      };
    }
    function migratePersonnel(s) {
      s.personnel = personnelDefaults(s);
      const used = new Set();
      for (const a of s.agents) {
        let portrait = personnelHash(s.personnel.seed, 'portrait/' + a.id) % 64;
        while (used.has(portrait)) portrait = (portrait + 1) % 64;
        used.add(portrait);
        a.profile = { strength: null, weakness: null, portrait, joinedAt: s.time };
      }
      ctx.refreshPersonnelMarket(s);
      s.version = 5;
    }
    function agentEffects(a) {
      const plus = STRENGTHS[a.profile?.strength] || {},
        minus = WEAKNESSES[a.profile?.weakness] || {};
      return {
        work: (plus.work || 1) * (minus.work || 1),
        research: (plus.research || 1) * (minus.research || 1),
        care: (plus.care || 1) * (minus.care || 1),
        wage: (plus.wage || 1) * (minus.wage || 1),
        management:
          (plus.management || 0) +
          (minus.management || 0) +
          (!a.profile?.strength && a.trait === 'zuverlässig' ? 0.02 : 0),
      };
    }
    function agentHealth(s, a, at = s.time) {
      const seed = s.personnel?.seed ?? s.seed;
      const draw = personnelHash(seed, 'health/' + a.id);
      const needsRecovery = a.profile?.weakness === 'recovery';
      const period =
        (needsRecovery ? 14400 + (draw % 7200) : 64800 + (draw % 43200)) *
        (a.profile?.strength === 'steady' ? 1.5 : 1);
      const duration = needsRecovery ? 480 + ((draw >>> 12) % 241) : 300 + ((draw >>> 12) % 301);
      const first = (a.profile?.joinedAt || 0) + 7200 + ((draw >>> 4) % period);
      const phase = at < first ? -1 : (at - first) % period;
      const absent = phase >= 0 && phase < duration;
      return { absent, remaining: absent ? duration - phase : 0 };
    }
    function agentAvailable(s, a) {
      return !agentHealth(s, a).absent;
    }
    function agentProductive(s, a, customerAssignments = null) {
      return (
        agentAvailable(s, a) &&
        !ctx.preventiveAgentBusy(s, a.id) &&
        !a.assignment &&
        !(customerAssignments ? customerAssignments.has(a.id) : ctx.customerAssignment(s, a.id)) &&
        !s.operations?.projects?.some((p) => p.agentId === a.id)
      );
    }
    function agentWage(a) {
      return 0.007 * Math.pow(a.level, 0.65) * agentEffects(a).wage;
    }
    function advancePersonnel(s, previousTime) {
      ctx.refreshPersonnelMarket(s);
      for (const a of s.agents) {
        const was = agentHealth(s, a, previousTime).absent,
          now = agentHealth(s, a).absent;
        if (was !== now)
          ctx.addLog(
            s,
            now ? 'system' : 'success',
            now
              ? `${a.name} benötigt Selbstwartung. Einsätze pausieren; Rückkehr erfolgt automatisch.`
              : `${a.name} ist wieder im Dienst.`,
          );
      }
    }
    function personnelProfile(s, a) {
      return {
        ...agentHealth(s, a),
        effects: agentEffects(a),
        strength: STRENGTHS[a.profile?.strength] || null,
        weakness: WEAKNESSES[a.profile?.weakness] || null,
        wage: agentWage(a),
      };
    }
    return {
      STRENGTHS,
      WEAKNESSES,
      personnelHash,
      personnelDefaults,
      migratePersonnel,
      agentEffects,
      agentHealth,
      agentAvailable,
      agentProductive,
      agentWage,
      advancePersonnel,
      personnelProfile,
    };
  };
});
