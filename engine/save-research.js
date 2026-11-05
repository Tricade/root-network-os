/** Schema 7 adds paid, resumable research without changing the meaning of old upgrades. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['save-research'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    function normalizeV7(input) {
      const s = ctx.normalizeV6({ ...input, version: 6 }),
        lab = ctx.checkedRecord(input.lab);
      const bad = () => {
        throw new Error('Ungültiger Forschungsplan.');
      };
      if (
        lab.version !== 1 ||
        !Array.isArray(lab.owned) ||
        lab.owned.length > ctx.TECHNOLOGIES.length ||
        new Set(lab.owned).size !== lab.owned.length
      )
        bad();
      for (const id of lab.owned) {
        const def = ctx.TECHNOLOGIES.find((n) => n.id === id);
        if (!def || def.sector > s.sector || def.requires.some((key) => !lab.owned.includes(key)))
          bad();
      }
      // Terminal alternatives never have dependants. A paid replacement leaves the old
      // doctrine active until completion, but two active doctrines cannot be imported.
      const doctrines = lab.owned.map((id) => ctx.researchDefinition(id).doctrine).filter(Boolean);
      if (new Set(doctrines).size !== doctrines.length) bad();
      s.lab = { version: 1, owned: [...lab.owned], project: null };
      if (lab.project !== null) {
        const p = ctx.checkedRecord(lab.project),
          def = ctx.researchDefinition(p.id);
        if (!def || typeof p.unique !== 'boolean' || p.unique !== Boolean(def.tree)) bad();
        const level = p.unique ? Number(s.lab.owned.includes(p.id)) : s.upgrades[p.id] || 0;
        const requires = p.unique ? def.requires : [ctx.REPEATABLE_GATES[p.id]];
        const total = p.unique ? def.duration : Math.min(14400, 300 + 120 * level);
        if (
          (p.unique && level) ||
          (!p.unique && level >= ctx.MAX_RESEARCH_LEVEL) ||
          p.targetLevel !== level + 1 ||
          p.total !== total ||
          requires.some((id) => !s.lab.owned.includes(id))
        )
          bad();
        const sector = ctx.checkedNumber(p.sector, def.sector || 1, s.sector, true);
        const terms = ctx.readResearchTerms(p.terms);
        const cost = ctx.researchPrice(s, p.id, level, sector, terms);
        if (p.cost !== cost) bad();
        s.lab.project = {
          id: p.id,
          unique: p.unique,
          targetLevel: p.targetLevel,
          total,
          remaining: ctx.checkedNumber(p.remaining, Number.MIN_VALUE, total),
          cost,
          sector,
          ...(p.terms === undefined ? {} : { terms }),
        };
      }
      s.version = 7;
      return s;
    }
    function migrateResearch(s) {
      s.lab = ctx.researchDefaults();
      s.version = 7;
    }
    return { normalizeV7, migrateResearch };
  };
});
