/** One funded laboratory project trades time and project throughput for permanent progress. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['research'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    const RESEARCH_TERMS = 2;

    function readResearchTerms(value) {
      // Older paid work has no marker and keeps its original quote.
      const terms = value === undefined ? 1 : value;
      if (terms !== 1 && terms !== RESEARCH_TERMS)
        throw new Error('Ungültige Forschungsbedingungen.');
      return terms;
    }

    function researchExpertise(level, role, focus) {
      return level * ((role === 'analyst' ? 0.7 : 0) + (focus === 'research' ? 0.3 : 0));
    }

    function researchStaffShare(expertise) {
      return expertise / (expertise + 5);
    }

    function synthesisFactor(level) {
      return 1 + (0.6 * level) / (level + 12);
    }

    function passiveResearchRate(s, activeAgents, hardwareFactor, researchFactor) {
      if (!hardwareFactor || ctx.globalIncident(s)) return 0;
      const expertise = activeAgents.reduce(
        (sum, a) =>
          sum + researchExpertise(a.level, a.role, a.focus) * ctx.agentEffects(a).research,
        0,
      );
      // The starter analyst is useful immediately. More levels or specialists
      // share the same lab, so they add less output as the team grows.
      const base = 0.004 + 0.048 * researchStaffShare(expertise);
      return base * synthesisFactor(s.upgrades.synthesis || 0) * researchFactor * hardwareFactor;
    }

    function researchDefinition(id) {
      return (
        ctx.TECHNOLOGIES.find((n) => n.id === id) ||
        ctx.catalog.research.find((n) => n.id === id) ||
        null
      );
    }
    function researchPrice(
      s,
      id,
      level = s.upgrades[id] || 0,
      sector = s.sector,
      terms = RESEARCH_TERMS,
    ) {
      const unique = ctx.TECHNOLOGIES.find((n) => n.id === id);
      if (unique) return terms === 1 ? unique.legacyCost : unique.cost;
      const def = ctx.catalog.research.find((n) => n.id === id);
      if (!def) return Infinity;
      const raw =
        terms === 1
          ? def.legacyBaseCost * Math.pow(1.48, level) * (1 + (sector - 1) * 0.12)
          : def.baseCost * Math.pow(1.62, level);
      return Math.ceil(Math.min(1e300, raw));
    }
    function quoteResearch(s, id) {
      const def = researchDefinition(id);
      if (!def)
        return {
          enabled: false,
          reason: 'Diese Forschung ist unbekannt.',
          cost: 0,
          duration: 0,
          requires: [],
        };
      const unique = Boolean(def.tree),
        level = unique ? Number(s.lab.owned.includes(id)) : s.upgrades[id] || 0;
      const requires = unique ? def.requires : [ctx.REPEATABLE_GATES[id]];
      const missing = requires.filter((key) => !s.lab.owned.includes(key));
      const cost = researchPrice(s, id),
        duration = unique ? def.duration : Math.min(14400, 300 + 120 * level);
      const replaces = def.doctrine
        ? ctx.TECHNOLOGIES.filter(
            (n) => n.id !== id && n.doctrine === def.doctrine && s.lab.owned.includes(n.id),
          ).map((n) => n.id)
        : [];
      const reason =
        unique && level
          ? 'Diese Technologie ist bereits erforscht.'
          : !unique && level >= ctx.MAX_RESEARCH_LEVEL
            ? 'Diese Forschungsreihe hat ihre höchste Stufe erreicht.'
            : s.lab.project
              ? 'Das Labor ist durch ein Forschungsprojekt belegt.'
              : s.sector < (def.sector || 1)
                ? 'Der benötigte Sektor ist noch nicht erschlossen.'
                : missing.length
                  ? 'Die Voraussetzungen dieses Forschungszweigs fehlen noch.'
                  : ctx.globalIncident(s)
                    ? 'Forschung bleibt während der offenen Daten- oder Versorgungskrise gesperrt.'
                    : s.research < cost
                      ? `Es fehlen ${Math.ceil(cost - s.research)} Forschungspunkte.`
                      : '';
      return {
        enabled: !reason,
        reason,
        cost,
        duration,
        requires,
        missing,
        level,
        unique,
        targetLevel: level + 1,
        replaces,
      };
    }
    function applyResearch(s, action, p) {
      if (action === 'cancelResearch') {
        if (!s.lab.project) return { ok: false, message: 'Im Labor läuft kein Forschungsprojekt.' };
        const name = researchDefinition(s.lab.project.id).name;
        s.lab.project = null;
        ctx.addLog(
          s,
          'system',
          `Forschungsprojekt abgebrochen: ${name}. Bezahlte Forschungspunkte werden nicht erstattet.`,
        );
        return { ok: true, message: 'Forschungsprojekt abgebrochen. Keine Erstattung.' };
      }
      if (action !== 'buyResearch') return null;
      const q = quoteResearch(s, p.id);
      if (!q.enabled) return { ok: false, message: q.reason };
      s.research -= q.cost;
      if (s.resilience.backup)
        s.resilience.backup.protectedResearch = Math.max(
          0,
          s.resilience.backup.protectedResearch - q.cost,
        );
      s.lab.project = {
        id: p.id,
        unique: q.unique,
        targetLevel: q.targetLevel,
        total: q.duration,
        remaining: q.duration,
        cost: q.cost,
        sector: s.sector,
        terms: RESEARCH_TERMS,
      };
      ctx.addLog(s, 'system', `Forschungsprojekt gestartet: ${researchDefinition(p.id).name}.`);
      return { ok: true, message: 'Forschungsprojekt gestartet. Wirkung folgt nach Abschluss.' };
    }
    function advanceResearch(s, dt, m) {
      const p = s.lab?.project;
      if (!p || !m.onlineServers || ctx.globalIncident(s)) return;
      p.remaining = Math.max(0, p.remaining - dt);
      if (p.remaining) return;
      if (p.unique) {
        const def = researchDefinition(p.id);
        if (def.doctrine)
          s.lab.owned = s.lab.owned.filter(
            (id) => researchDefinition(id)?.doctrine !== def.doctrine,
          );
        s.lab.owned.push(p.id);
      } else s.upgrades[p.id] = p.targetLevel;
      s.lab.project = null;
      ctx.addLog(
        s,
        'success',
        `Forschung abgeschlossen: ${researchDefinition(p.id).name}, Stufe ${p.targetLevel}.`,
        'research',
      );
      return `Forschung abgeschlossen: ${researchDefinition(p.id).name}, Stufe ${p.targetLevel}.`;
    }
    function getResearch(s, metrics = null) {
      const m = metrics || ctx.getMetrics(s);
      return {
        trees: ctx.RESEARCH_TREES,
        technologies: ctx.TECHNOLOGIES.map((n) => ({ ...n, quote: quoteResearch(s, n.id) })),
        repeatables: ctx.catalog.research.map((n) => ({ ...n, quote: quoteResearch(s, n.id) })),
        project: s.lab.project
          ? { ...s.lab.project, name: researchDefinition(s.lab.project.id).name }
          : null,
        paused: Boolean(s.lab.project && (!m.onlineServers || ctx.globalIncident(s))),
      };
    }
    return {
      RESEARCH_TERMS,
      readResearchTerms,
      researchExpertise,
      researchStaffShare,
      synthesisFactor,
      passiveResearchRate,
      researchDefinition,
      researchPrice,
      quoteResearch,
      applyResearch,
      advanceResearch,
      getResearch,
    };
  };
});
