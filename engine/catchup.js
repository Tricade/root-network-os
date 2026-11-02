/** A bounded cursor over the same deterministic simulation used by live ticks. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {}).catchup = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    function createCatchup(input, seconds) {
      if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Ungültige Nachberechnung.');
      const state = ctx.normalizeState(input),
        total = Math.min(43200, seconds),
        initialCredits = state.credits,
        initialResearch = state.research;
      let elapsed = 0,
        jobsCompleted = 0,
        eventCount = 0;
      const constructionCompleted = [];
      const researchCompleted = [];
      return {
        state,
        get progress() {
          return total ? elapsed / total : 1;
        },
        step(chunk = 30) {
          if (elapsed >= total) return false;
          const report = ctx.advance(state, Math.min(Math.max(0.01, chunk), 30, total - elapsed));
          elapsed += report.seconds;
          jobsCompleted += report.jobsCompleted;
          eventCount += report.eventCount;
          constructionCompleted.push(...report.constructionCompleted);
          researchCompleted.push(...report.researchCompleted);
          return elapsed < total;
        },
        report() {
          return {
            seconds: elapsed,
            credits: state.credits - initialCredits,
            research: state.research - initialResearch,
            jobsCompleted,
            eventCount,
            constructionCompleted,
            researchCompleted,
            capped: seconds > 43200,
          };
        },
      };
    }
    return { createCatchup };
  };
});
