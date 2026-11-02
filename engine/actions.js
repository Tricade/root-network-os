/** Actions: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['actions'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    const { finite } = context;
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const applyInfrastructure = (...args) => context.applyInfrastructure(...args);
    const applyProgression = (...args) => context.applyProgression(...args);
    const applyRecovery = (...args) => context.applyRecovery(...args);
    const applyWorkforce = (...args) => context.applyWorkforce(...args);
    const getMetrics = (...args) => context.getMetrics(...args);
    const hardwareSnapshot = (...args) => context.hardwareSnapshot(...args);
    const updateAchievementUnlocks = (...args) => context.updateAchievementUnlocks(...args);

    function actInternal(s, action, payload = {}) {
      const fail = (message) => ({ ok: false, message });
      if (!action || typeof action !== 'string' || !payload || typeof payload !== 'object')
        return fail('Diese Aktion ist ungültig.');
      const m = getMetrics(s);
      for (const apply of [
        context.applyPersonnel,
        context.applyGrowth,
        context.applyPreventiveMaintenance,
        context.applyServicePriority,
        context.applyOperations,
        context.applySupply,
        context.applyResearch,
        context.applyCustomers,
        context.applyServices,
        applyInfrastructure,
        applyWorkforce,
        applyProgression,
        applyRecovery,
      ]) {
        const result = apply(s, action, payload, m);
        if (result) return result;
      }
      return fail('Diese Aktion wird nicht unterstützt.');
    }

    function act(s, action, payload = {}) {
      // Capture the temperature before an action changes power or cooling. Failed
      // actions and all read models remain free of state mutations.
      const temperatures = hardwareSnapshot(s);
      const result = actInternal(s, action, payload);
      if (result.ok) {
        context.syncServiceRooms(s);
        for (const row of temperatures.values())
          if (!finite(row.rack.temperature)) row.rack.temperature = row.temperature;
        updateAchievementUnlocks(s);
      }
      return result;
    }
    return { actInternal, act };
  };
});
