/** Resource-priced service groups. One group represents many similar customers. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['service-catalog'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function () {
    const RESOURCES = ['cpu', 'ram', 'storage', 'network', 'gpu', 'vram'];
    const SERVICES = {
      hosting: {
        name: 'Hosting',
        profile: 'hosting',
        fee: 0.14,
        sector: 1,
        needs: { cpu: 2, ram: 8, storage: 0.1, network: 30 },
      },
      archive: {
        name: 'Archivierung',
        profile: 'archive',
        fee: 0.26,
        sector: 1,
        needs: { cpu: 1, ram: 4, storage: 4, network: 20 },
      },
      database: {
        name: 'Datenbanken',
        profile: 'database',
        fee: 0.44,
        sector: 2,
        needs: { cpu: 4, ram: 24, storage: 0.5, network: 80 },
      },
      inference: {
        name: 'KI-Inferenz',
        profile: 'ai',
        fee: 0.72,
        sector: 2,
        needs: { cpu: 2, ram: 12, storage: 0.1, network: 100, gpu: 0.5, vram: 24 },
      },
    };
    const PROFILES = {
      mixed: 'Gemischt',
      hosting: 'Hosting',
      archive: 'Archiv',
      database: 'Datenbanken',
      ai: 'KI',
    };
    const zeroResources = () => Object.fromEntries(RESOURCES.map((key) => [key, 0]));
    const fraction = (used, available) =>
      Math.min(
        1,
        ...RESOURCES.filter((key) => used[key] > 0).map(
          (key) => Math.max(0, available[key] || 0) / used[key],
        ),
      );
    const groupDefaults = (kind) => ({
      kind,
      units: 0,
      pending: 0,
      onboarding: 0,
      remaining: 259200,
      renew: true,
      premium: false,
      nextPremium: false,
    });
    const roomDefaults = (roomId) => ({
      roomId,
      profile: 'mixed',
      reserve: 0.2,
      crew: 1,
      managerId: null,
      changeRemaining: 0,
      supply: { cooling: 'local', power: 'local' },
      conversion: null,
      groups: Object.keys(SERVICES).map(groupDefaults),
    });
    function businessDefaults(s, migrated = false) {
      const rooms = s.facility.building.rooms.map((room) => roomDefaults(room.id));
      if (!migrated) rooms[0].groups[0].units = 3;
      return {
        version: 1,
        rooms,
        migrated,
        transitionUntil: migrated ? s.time + 43200 : 0,
        revenue: 0,
        wages: 0,
        delivered: 0,
        unserved: 0,
      };
    }
    return {
      RESOURCES,
      SERVICES,
      PROFILES,
      zeroResources,
      fraction,
      roomDefaults,
      businessDefaults,
    };
  };
});
