/** Schema 5 adds bounded personnel data; legacy saves keep their existing skills. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['save-personnel'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    function normalizeV5(input) {
      const s = ctx.normalizeV4({ ...input, version: 4 });
      const bad = () => {
        throw new Error('Ungültige Personaldaten.');
      };
      const integer = (n, max) => Number.isSafeInteger(n) && n >= 0 && n <= max;
      const p = input.personnel,
        cycle = Math.floor(s.time / 1800);
      if (
        !p ||
        p.version !== 1 ||
        !integer(p.seed, 0xffffffff) ||
        !integer(p.cycle, cycle) ||
        !Array.isArray(p.taken) ||
        p.taken.length > 6 ||
        new Set(p.taken).size !== p.taken.length ||
        p.taken.some((x) => !integer(x, 5))
      )
        bad();
      if (
        !Array.isArray(p.portraits) ||
        p.portraits.length !== 6 ||
        new Set(p.portraits).size !== 6 ||
        p.portraits.some((x) => !integer(x, 63))
      )
        bad();
      s.personnel = {
        version: 1,
        seed: p.seed,
        cycle: p.cycle,
        taken: [...p.taken],
        portraits: [...p.portraits],
        pinned: null,
      };
      const profile = (v) => {
        if (
          !v ||
          !integer(v.portrait, 63) ||
          !Number.isFinite(v.joinedAt) ||
          v.joinedAt < 0 ||
          v.joinedAt > s.time ||
          !(
            (v.strength === null && v.weakness === null) ||
            (Object.hasOwn(ctx.STRENGTHS, v.strength) && Object.hasOwn(ctx.WEAKNESSES, v.weakness))
          )
        )
          bad();
        return {
          strength: v.strength,
          weakness: v.weakness,
          portrait: v.portrait,
          joinedAt: v.joinedAt,
        };
      };
      s.agents.forEach((a, i) => {
        a.profile = profile(input.agents[i].profile);
      });
      if (new Set(s.agents.map((a) => a.profile.portrait)).size !== s.agents.length) bad();
      if (p.pinned !== null) {
        const a = p.pinned;
        if (
          !a ||
          !integer(a.cycle, cycle) ||
          !integer(a.slot, 5) ||
          (a.cycle === p.cycle && p.taken.includes(a.slot))
        )
          bad();
        const expected = ctx.candidate(s, a.cycle, a.slot),
          saved = profile(a.profile);
        if (
          a.id !== expected.id ||
          saved.strength !== expected.profile.strength ||
          saved.weakness !== expected.profile.weakness ||
          s.agents.some((x) => x.profile.portrait === saved.portrait)
        )
          bad();
        delete expected.price;
        s.personnel.pinned = { ...expected, profile: saved };
      }
      s.version = 5;
      return s;
    }
    return { normalizeV5 };
  };
});
