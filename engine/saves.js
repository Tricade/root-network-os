/** Saves: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['saves'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const migrateV1 = (...args) => context.migrateV1(...args);
    const normalizeV2 = (...args) => context.normalizeV2(...args);
    const normalizeV3 = (...args) => context.normalizeV3(...args);
    const packLegacyHardware = (...args) => context.packLegacyHardware(...args);
    const updateAchievementUnlocks = (...args) => context.updateAchievementUnlocks(...args);

    function normalizeState(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new Error('Ungültiger Netzwerkstand.');
      let state;
      if (input.version === 1) state = packLegacyHardware(normalizeV2(migrateV1(input)));
      else if (input.version === 2) state = packLegacyHardware(normalizeV2(input));
      else if (input.version === 3) state = normalizeV3(input);
      else if (input.version === 4) state = context.normalizeV4(input);
      else if (input.version === 5) state = context.normalizeV5(input);
      else if (input.version === 6) state = context.normalizeV6(input);
      else if (input.version === 7) state = context.normalizeV7(input);
      else if (input.version === 8) state = context.normalizeV8(input);
      else throw new Error('Diese Netzwerkstand-Version wird nicht unterstützt.');
      if (input.version < 4) {
        context.migrateBusiness(state);
        state.operations = context.operationsDefaults();
        state.version = 4;
      }
      if (input.version < 5) context.migratePersonnel(state);
      if (input.version < 6) context.migrateCustomers(state);
      if (input.version < 7) context.migrateResearch(state);
      if (input.version < 8) context.migratePlanning(state);
      updateAchievementUnlocks(state);
      return state;
    }
    return { normalizeState };
  };
});
