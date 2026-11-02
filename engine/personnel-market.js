/** A finite, deterministic hiring board: no click or reload can reroll applicants. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['personnel-market'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    const INTERVAL = 1800;
    const NAMES = [
      'Alex',
      'Robin',
      'Kim',
      'Sam',
      'Charlie',
      'Noa',
      'Jules',
      'Sascha',
      'Lou',
      'Mika',
      'Toni',
      'Ari',
      'Ren',
      'Dani',
      'Kai',
      'Ashley',
      'Riley',
      'Quinn',
      'Billie',
      'Sky',
      'Morgan',
      'Jamie',
      'Taylor',
      'Casey',
      'Blake',
      'Drew',
      'Eden',
      'Harper',
      'Lee',
      'Rowan',
      'Emery',
      'Finley',
    ];
    const strengthKeys = Object.keys(ctx.STRENGTHS),
      weaknessKeys = Object.keys(ctx.WEAKNESSES);
    function candidate(s, cycle, slot) {
      const key = cycle + '/' + slot,
        seed = s.personnel.seed;
      const draw = (salt) => ctx.personnelHash(seed, salt + '/' + key);
      const strength = strengthKeys[draw('strength') % strengthKeys.length],
        weakness = weaknessKeys[draw('weakness') % weaknessKeys.length];
      const role = ['operator', 'analyst', 'engineer'][slot % 3];
      return {
        id: `candidate-${cycle}-${slot}`,
        cycle,
        slot,
        name: NAMES[draw('name') % NAMES.length],
        role,
        level: 1,
        focus: role === 'analyst' ? 'research' : role === 'engineer' ? 'maintenance' : 'income',
        profile: { strength, weakness, portrait: draw('portrait') % 64, joinedAt: s.time },
        price: Math.ceil(
          ctx.cost(s, 'agent', role) *
            (weakness === 'recovery' || weakness === 'expensive'
              ? 0.92
              : strength === 'leadership'
                ? 1.12
                : 1),
        ),
      };
    }
    function marketPortraits(s, cycle) {
      const used = new Set(s.agents.map((a) => a.profile.portrait));
      if (s.personnel.pinned) used.add(s.personnel.pinned.profile.portrait);
      return Array.from({ length: 6 }, (_, slot) => {
        let portrait = candidate(s, cycle, slot).profile.portrait;
        while (used.has(portrait)) portrait = (portrait + 1) % 64;
        used.add(portrait);
        return portrait;
      });
    }
    function refreshPersonnelMarket(s) {
      const cycle = Math.floor(s.time / INTERVAL);
      if (s.personnel.cycle !== cycle || !s.personnel.portraits) {
        s.personnel.portraits = marketPortraits(s, cycle);
        s.personnel.cycle = cycle;
        s.personnel.taken = [];
      }
    }
    function marketCandidates(s) {
      const cycle = Math.floor(s.time / INTERVAL),
        p = s.personnel;
      const taken = p.cycle === cycle ? p.taken : [];
      const rows = Array.from({ length: 6 }, (_, slot) => candidate(s, cycle, slot)).filter(
        (a) => !taken.includes(a.slot),
      );
      if (p.pinned && p.pinned.cycle < cycle) rows.unshift({ ...p.pinned, pinned: true });
      const portraits = p.cycle === cycle && p.portraits ? p.portraits : marketPortraits(s, cycle);
      for (const a of rows) {
        a.profile = {
          ...a.profile,
          portrait: a.cycle === cycle ? portraits[a.slot] : a.profile.portrait,
        };
        if (p.pinned?.id === a.id) a.pinned = true;
        a.price = Math.ceil(
          ctx.cost(s, 'agent', a.role) *
            (a.profile.weakness === 'recovery' || a.profile.weakness === 'expensive'
              ? 0.92
              : a.profile.strength === 'leadership'
                ? 1.12
                : 1),
        );
      }
      return rows;
    }
    function getPersonnel(s) {
      const limit = Math.min(ctx.MAX.agents, 3 + s.sector * 2);
      return {
        cycle: Math.floor(s.time / INTERVAL),
        refreshIn: INTERVAL - (s.time % INTERVAL),
        interval: INTERVAL,
        limit,
        candidates: marketCandidates(s).map((a) => ({
          ...a,
          ...ctx.personnelProfile(s, a),
          enabled: s.agents.length < limit && s.credits >= a.price,
          reason:
            s.agents.length >= limit
              ? 'Alle Teamplätze sind belegt.'
              : s.credits < a.price
                ? 'Das verfügbare Budget reicht nicht aus.'
                : '',
        })),
        agents: s.agents.map((a) => ({ id: a.id, ...ctx.personnelProfile(s, a) })),
      };
    }
    function applyPersonnel(s, action, p, m) {
      if (action === 'pinCandidate') {
        const a = marketCandidates(s).find((a) => a.id === p.id);
        if (!a) return { ok: false, message: 'Diese Bewerbung ist nicht mehr verfügbar.' };
        s.personnel.pinned =
          s.personnel.pinned?.id === a.id
            ? null
            : {
                id: a.id,
                cycle: a.cycle,
                slot: a.slot,
                name: a.name,
                role: a.role,
                level: 1,
                focus: a.focus,
                profile: { ...a.profile },
              };
        return {
          ok: true,
          message: s.personnel.pinned
            ? 'Bewerbung vorgemerkt. Sie bleibt beim nächsten Wechsel erhalten.'
            : 'Vormerkung entfernt.',
        };
      }
      if (action === 'hireCandidate' || action === 'recruitAgent') {
        const a = marketCandidates(s).find((a) =>
          action === 'recruitAgent' ? a.role === p.role : a.id === p.id,
        );
        if (!a)
          return {
            ok: false,
            message:
              'Diese Bewerbung ist nicht mehr verfügbar. Die nächste Liste kommt automatisch.',
          };
        if (s.agents.length >= m.agentLimit)
          return { ok: false, message: 'Der Sektor hat seine Agentengrenze erreicht.' };
        if (s.credits < a.price)
          return { ok: false, message: 'Das verfügbare Budget reicht nicht aus.' };
        refreshPersonnelMarket(s);
        s.credits -= a.price;
        s.agents.push({
          id: ctx.uid(s, 'agent'),
          name: a.name,
          role: a.role,
          level: 1,
          focus: a.focus,
          trait: '',
          assignment: null,
          cooldownUntil: 0,
          profile: { ...a.profile, joinedAt: s.time },
        });
        const cycle = Math.floor(s.time / INTERVAL);
        if (s.personnel.cycle !== cycle) {
          s.personnel.cycle = cycle;
          s.personnel.taken = [];
        }
        if (a.cycle === cycle) s.personnel.taken.push(a.slot);
        if (s.personnel.pinned?.id === a.id) s.personnel.pinned = null;
        s.counters.agentsHired++;
        ctx.addLog(s, 'success', `${a.name} dem Team beigetreten.`);
        return { ok: true, message: 'Agent eingestellt.' };
      }
      if (action === 'dismissAgent') {
        const a = s.agents.find((a) => a.id === p.id);
        if (!a) return { ok: false, message: 'Agent nicht gefunden.' };
        if (s.agents.length <= 1)
          return { ok: false, message: 'Mindestens ein Agent muss im Team bleiben.' };
        if (
          a.assignment ||
          ctx.preventiveAgentBusy(s, a.id) ||
          s.preventiveMaintenance?.schedule?.agentId === a.id ||
          s.operations.projects.some((x) => x.agentId === a.id) ||
          ctx.customerAssignment(s, a.id)
        )
          return { ok: false, message: 'Laufende Einsätze müssen zuerst abgeschlossen werden.' };
        for (const room of s.business.rooms) if (room.managerId === a.id) room.managerId = null;
        s.agents = s.agents.filter((x) => x.id !== a.id);
        ctx.addLog(
          s,
          'system',
          `${a.name} verlässt das Team. Teamleitungsplätze sind gegebenenfalls frei.`,
        );
        return {
          ok: true,
          message: 'Agent ausgemustert. Einstellungskosten werden nicht erstattet.',
        };
      }
      return null;
    }
    return { candidate, refreshPersonnelMarket, getPersonnel, applyPersonnel };
  };
});
