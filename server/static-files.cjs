'use strict';
const fs = require('node:fs');
const path = require('node:path');

// A closed allowlist keeps local saves and build sources outside the HTTP surface.
function createStaticFiles(root) {
  const FILES = new Map([
    ['/ui/attention-model.js', ['ui/attention-model.js', 'text/javascript; charset=utf-8']],
    ['/ui/attention-cards.js', ['ui/attention-cards.js', 'text/javascript; charset=utf-8']],
    ['/ui/notification-state.js', ['ui/notification-state.js', 'text/javascript; charset=utf-8']],
    ['/ui/notification-center.js', ['ui/notification-center.js', 'text/javascript; charset=utf-8']],
    [
      '/engine/research-infrastructure-catalog.js',
      ['engine/research-infrastructure-catalog.js', 'text/javascript; charset=utf-8'],
    ],
    [
      '/engine/research-business-catalog.js',
      ['engine/research-business-catalog.js', 'text/javascript; charset=utf-8'],
    ],
    [
      '/engine/research-compute-catalog.js',
      ['engine/research-compute-catalog.js', 'text/javascript; charset=utf-8'],
    ],

    [
      '/engine/research-expansion.js',
      ['engine/research-expansion.js', 'text/javascript; charset=utf-8'],
    ],
    ['/ui/illustrations.js', ['ui/illustrations.js', 'text/javascript; charset=utf-8']],
    ['/ui/research-map.js', ['ui/research-map.js', 'text/javascript; charset=utf-8']],
    ['/ui/research-map-input.js', ['ui/research-map-input.js', 'text/javascript; charset=utf-8']],
    ['/ui/research-effects.js', ['ui/research-effects.js', 'text/javascript; charset=utf-8']],

    ['/room/operations-assets.js', ['room/operations-assets.js', 'text/javascript; charset=utf-8']],
    [
      '/room/operations-asset-kit.js',
      ['room/operations-asset-kit.js', 'text/javascript; charset=utf-8'],
    ],
    ['/room/operations-plant.js', ['room/operations-plant.js', 'text/javascript; charset=utf-8']],
    [
      '/room/construction-assets.js',
      ['room/construction-assets.js', 'text/javascript; charset=utf-8'],
    ],
    ['/ui/capital-plan.js', ['ui/capital-plan.js', 'text/javascript; charset=utf-8']],
    ['/ui/customer-growth.js', ['ui/customer-growth.js', 'text/javascript; charset=utf-8']],
    [
      '/ui/preventive-maintenance.js',
      ['ui/preventive-maintenance.js', 'text/javascript; charset=utf-8'],
    ],
    ['/ui/customer-portfolio.js', ['ui/customer-portfolio.js', 'text/javascript; charset=utf-8']],
    ['/ui/dashboard-attention.js', ['ui/dashboard-attention.js', 'text/javascript; charset=utf-8']],
    ['/ui/facility-navigator.js', ['ui/facility-navigator.js', 'text/javascript; charset=utf-8']],
    ['/ui/facility-art.js', ['ui/facility-art.js', 'text/javascript; charset=utf-8']],
    ['/ui/research-art.js', ['ui/research-art.js', 'text/javascript; charset=utf-8']],
    ['/ui/business-art.js', ['ui/business-art.js', 'text/javascript; charset=utf-8']],
    ['/ui/navigation-state.js', ['ui/navigation-state.js', 'text/javascript; charset=utf-8']],
    ['/engine/capital-plans.js', ['engine/capital-plans.js', 'text/javascript; charset=utf-8']],
    [
      '/engine/priority-allocation.js',
      ['engine/priority-allocation.js', 'text/javascript; charset=utf-8'],
    ],
    [
      '/engine/service-priorities.js',
      ['engine/service-priorities.js', 'text/javascript; charset=utf-8'],
    ],
    ['/engine/customer-growth.js', ['engine/customer-growth.js', 'text/javascript; charset=utf-8']],
    ['/engine/preventive-save.js', ['engine/preventive-save.js', 'text/javascript; charset=utf-8']],
    [
      '/engine/preventive-maintenance.js',
      ['engine/preventive-maintenance.js', 'text/javascript; charset=utf-8'],
    ],
    ['/engine/save-planning.js', ['engine/save-planning.js', 'text/javascript; charset=utf-8']],
    ['/locales/planning-en.js', ['locales/planning-en.js', 'text/javascript; charset=utf-8']],

    ['/', ['index.html', 'text/html; charset=utf-8']],
    ['/index.html', ['index.html', 'text/html; charset=utf-8']],
    ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
    ['/controls.css', ['controls.css', 'text/css; charset=utf-8']],
    ['/racks.css', ['racks.css', 'text/css; charset=utf-8']],
    ['/ui/chrome.js', ['ui/chrome.js', 'text/javascript; charset=utf-8']],
    ['/ui/overview.js', ['ui/overview.js', 'text/javascript; charset=utf-8']],
    ['/ui/personnel.js', ['ui/personnel.js', 'text/javascript; charset=utf-8']],
    ['/ui/personnel-art.js', ['ui/personnel-art.js', 'text/javascript; charset=utf-8']],
    ['/personnel.css', ['personnel.css', 'text/css; charset=utf-8']],
    ['/ui/workforce.js', ['ui/workforce.js', 'text/javascript; charset=utf-8']],
    ['/ui/workload-art.js', ['ui/workload-art.js', 'text/javascript; charset=utf-8']],
    ['/ui/workloads.js', ['ui/workloads.js', 'text/javascript; charset=utf-8']],
    ['/ui/protection.js', ['ui/protection.js', 'text/javascript; charset=utf-8']],
    ['/ui/dialogs.js', ['ui/dialogs.js', 'text/javascript; charset=utf-8']],
    ['/ui/telemetry.js', ['ui/telemetry.js', 'text/javascript; charset=utf-8']],
    ['/ui/persistence.js', ['ui/persistence.js', 'text/javascript; charset=utf-8']],
    ['/ui/notifications.js', ['ui/notifications.js', 'text/javascript; charset=utf-8']],
    ['/ui/facility.js', ['ui/facility.js', 'text/javascript; charset=utf-8']],
    ['/ui/events.js', ['ui/events.js', 'text/javascript; charset=utf-8']],
    ['/ui/foundation.js', ['ui/foundation.js', 'text/javascript; charset=utf-8']],
    ['/ui/navigation.js', ['ui/navigation.js', 'text/javascript; charset=utf-8']],
    ['/ui/achievements.js', ['ui/achievements.js', 'text/javascript; charset=utf-8']],
    ['/ui/business.js', ['ui/business.js', 'text/javascript; charset=utf-8']],
    ['/ui/customer-cards.js', ['ui/customer-cards.js', 'text/javascript; charset=utf-8']],
    ['/ui/customer-controls.js', ['ui/customer-controls.js', 'text/javascript; charset=utf-8']],
    ['/ui/room-operations.js', ['ui/room-operations.js', 'text/javascript; charset=utf-8']],
    ['/ui/room-context.js', ['ui/room-context.js', 'text/javascript; charset=utf-8']],
    ['/locales/customers-en.js', ['locales/customers-en.js', 'text/javascript; charset=utf-8']],
    ['/customers.css', ['customers.css', 'text/css; charset=utf-8']],
    ['/locales/research-en.js', ['locales/research-en.js', 'text/javascript; charset=utf-8']],
    ['/locales/workspace-en.js', ['locales/workspace-en.js', 'text/javascript; charset=utf-8']],
    ['/research.css', ['research.css', 'text/css; charset=utf-8']],
    ['/dashboard.css', ['dashboard.css', 'text/css; charset=utf-8']],
    ['/ui/dashboard.js', ['ui/dashboard.js', 'text/javascript; charset=utf-8']],
    ['/ui/dashboard-model.js', ['ui/dashboard-model.js', 'text/javascript; charset=utf-8']],
    ['/ui/agent-development.js', ['ui/agent-development.js', 'text/javascript; charset=utf-8']],
    [
      '/engine/agent-development.js',
      ['engine/agent-development.js', 'text/javascript; charset=utf-8'],
    ],
    ['/ui/research.js', ['ui/research.js', 'text/javascript; charset=utf-8']],
    ['/ui/research-cards.js', ['ui/research-cards.js', 'text/javascript; charset=utf-8']],
    ['/ui/operations.js', ['ui/operations.js', 'text/javascript; charset=utf-8']],
    ['/ui/offline.js', ['ui/offline.js', 'text/javascript; charset=utf-8']],
    ['/advance-worker.js', ['advance-worker.js', 'text/javascript; charset=utf-8']],
    ['/engine/catchup.js', ['engine/catchup.js', 'text/javascript; charset=utf-8']],
    ['/business.css', ['business.css', 'text/css; charset=utf-8']],
    ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
    ['/brand.js', ['brand.js', 'text/javascript; charset=utf-8']],
    ['/locales/building-en.js', ['locales/building-en.js', 'text/javascript; charset=utf-8']],
    ['/locales/business-en.js', ['locales/business-en.js', 'text/javascript; charset=utf-8']],
    ['/locales/personnel-en.js', ['locales/personnel-en.js', 'text/javascript; charset=utf-8']],
    ['/locales/en.js', ['locales/en.js', 'text/javascript; charset=utf-8']],
    ['/i18n.js', ['i18n.js', 'text/javascript; charset=utf-8']],
    ['/ui/racks/faces.js', ['ui/racks/faces.js', 'text/javascript; charset=utf-8']],
    ['/ui/racks/wiring.js', ['ui/racks/wiring.js', 'text/javascript; charset=utf-8']],
    ['/ui/racks/inspector.js', ['ui/racks/inspector.js', 'text/javascript; charset=utf-8']],
    ['/ui/racks/view.js', ['ui/racks/view.js', 'text/javascript; charset=utf-8']],
    ['/ui/racks/telemetry.js', ['ui/racks/telemetry.js', 'text/javascript; charset=utf-8']],
    ['/rack-ui.js', ['rack-ui.js', 'text/javascript; charset=utf-8']],
    ['/room/materials.js', ['room/materials.js', 'text/javascript; charset=utf-8']],
    ['/room/primitives.js', ['room/primitives.js', 'text/javascript; charset=utf-8']],
    ['/room/world.js', ['room/world.js', 'text/javascript; charset=utf-8']],
    ['/room/racks.js', ['room/racks.js', 'text/javascript; charset=utf-8']],
    ['/room/servers.js', ['room/servers.js', 'text/javascript; charset=utf-8']],
    ['/room/location.js', ['room/location.js', 'text/javascript; charset=utf-8']],
    ['/room/station-content.js', ['room/station-content.js', 'text/javascript; charset=utf-8']],
    ['/room/telemetry.js', ['room/telemetry.js', 'text/javascript; charset=utf-8']],
    ['/room/input.js', ['room/input.js', 'text/javascript; charset=utf-8']],
    ['/room/exploration.js', ['room/exploration.js', 'text/javascript; charset=utf-8']],
    ['/room/renderer.js', ['room/renderer.js', 'text/javascript; charset=utf-8']],
    ['/room-navigation.js', ['room-navigation.js', 'text/javascript; charset=utf-8']],
    ['/room/status.js', ['room/status.js', 'text/javascript; charset=utf-8']],
    ['/room.js', ['room.js', 'text/javascript; charset=utf-8']],
    ['/room-stations.js', ['room-stations.js', 'text/javascript; charset=utf-8']],
    ['/room-lounge.js', ['room-lounge.js', 'text/javascript; charset=utf-8']],
    ['/room-assets.js', ['room-assets.js', 'text/javascript; charset=utf-8']],
    ['/room-facility.js', ['room-facility.js', 'text/javascript; charset=utf-8']],
    ['/room-instruments.js', ['room-instruments.js', 'text/javascript; charset=utf-8']],
    ['/room-arrival.js', ['room-arrival.js', 'text/javascript; charset=utf-8']],
    ['/room-surfaces.js', ['room-surfaces.js', 'text/javascript; charset=utf-8']],
    ['/room.css', ['room.css', 'text/css; charset=utf-8']],
    ['/facility.css', ['facility.css', 'text/css; charset=utf-8']],
    ['/building.css', ['building.css', 'text/css; charset=utf-8']],
    ['/desktop.css', ['desktop.css', 'text/css; charset=utf-8']],
    ['/ui/desktop.js', ['ui/desktop.js', 'text/javascript; charset=utf-8']],
    ['/vendor/three.module.js', ['vendor/three.module.js', 'text/javascript; charset=utf-8']],
    ['/vendor/three.core.js', ['vendor/three.core.js', 'text/javascript; charset=utf-8']],
    ['/vendor/RoomEnvironment.js', ['vendor/RoomEnvironment.js', 'text/javascript; charset=utf-8']],
    [
      '/vendor/RoundedBoxGeometry.js',
      ['vendor/RoundedBoxGeometry.js', 'text/javascript; charset=utf-8'],
    ],
    ['/vendor/GLTFLoader.js', ['vendor/GLTFLoader.js', 'text/javascript; charset=utf-8']],
    [
      '/vendor/BufferGeometryUtils.js',
      ['vendor/BufferGeometryUtils.js', 'text/javascript; charset=utf-8'],
    ],
    ['/vendor/SkeletonUtils.js', ['vendor/SkeletonUtils.js', 'text/javascript; charset=utf-8']],
    [
      '/engine/customer-catalog.js',
      ['engine/customer-catalog.js', 'text/javascript; charset=utf-8'],
    ],
    [
      '/engine/customer-actions.js',
      ['engine/customer-actions.js', 'text/javascript; charset=utf-8'],
    ],
    [
      '/engine/customer-lifecycle.js',
      ['engine/customer-lifecycle.js', 'text/javascript; charset=utf-8'],
    ],
    ['/engine/save-customers.js', ['engine/save-customers.js', 'text/javascript; charset=utf-8']],
    [
      '/engine/research-catalog.js',
      ['engine/research-catalog.js', 'text/javascript; charset=utf-8'],
    ],
    ['/engine/research.js', ['engine/research.js', 'text/javascript; charset=utf-8']],
    ['/engine/save-research.js', ['engine/save-research.js', 'text/javascript; charset=utf-8']],
    ['/engine/definitions.js', ['engine/definitions.js', 'text/javascript; charset=utf-8']],
    ['/engine/personnel.js', ['engine/personnel.js', 'text/javascript; charset=utf-8']],
    [
      '/engine/personnel-market.js',
      ['engine/personnel-market.js', 'text/javascript; charset=utf-8'],
    ],
    ['/engine/save-personnel.js', ['engine/save-personnel.js', 'text/javascript; charset=utf-8']],
    ['/engine/state.js', ['engine/state.js', 'text/javascript; charset=utf-8']],
    ['/engine/economy.js', ['engine/economy.js', 'text/javascript; charset=utf-8']],
    ['/engine/building.js', ['engine/building.js', 'text/javascript; charset=utf-8']],
    ['/engine/central.js', ['engine/central.js', 'text/javascript; charset=utf-8']],
    ['/engine/hardware.js', ['engine/hardware.js', 'text/javascript; charset=utf-8']],
    ['/engine/gpu.js', ['engine/gpu.js', 'text/javascript; charset=utf-8']],
    ['/engine/metrics.js', ['engine/metrics.js', 'text/javascript; charset=utf-8']],
    ['/engine/hardware-quotes.js', ['engine/hardware-quotes.js', 'text/javascript; charset=utf-8']],
    ['/engine/racks.js', ['engine/racks.js', 'text/javascript; charset=utf-8']],
    ['/engine/recovery-quotes.js', ['engine/recovery-quotes.js', 'text/javascript; charset=utf-8']],
    ['/engine/resilience.js', ['engine/resilience.js', 'text/javascript; charset=utf-8']],
    ['/engine/agents.js', ['engine/agents.js', 'text/javascript; charset=utf-8']],
    ['/engine/contracts.js', ['engine/contracts.js', 'text/javascript; charset=utf-8']],
    ['/engine/incidents.js', ['engine/incidents.js', 'text/javascript; charset=utf-8']],
    ['/engine/maintenance.js', ['engine/maintenance.js', 'text/javascript; charset=utf-8']],
    ['/engine/simulation.js', ['engine/simulation.js', 'text/javascript; charset=utf-8']],
    [
      '/engine/actions-infrastructure.js',
      ['engine/actions-infrastructure.js', 'text/javascript; charset=utf-8'],
    ],
    [
      '/engine/actions-workforce.js',
      ['engine/actions-workforce.js', 'text/javascript; charset=utf-8'],
    ],
    [
      '/engine/actions-progression.js',
      ['engine/actions-progression.js', 'text/javascript; charset=utf-8'],
    ],
    [
      '/engine/actions-recovery.js',
      ['engine/actions-recovery.js', 'text/javascript; charset=utf-8'],
    ],
    ['/engine/actions.js', ['engine/actions.js', 'text/javascript; charset=utf-8']],
    ['/engine/save-legacy.js', ['engine/save-legacy.js', 'text/javascript; charset=utf-8']],
    ['/engine/save-v2.js', ['engine/save-v2.js', 'text/javascript; charset=utf-8']],
    ['/engine/save-v3.js', ['engine/save-v3.js', 'text/javascript; charset=utf-8']],
    ['/engine/saves.js', ['engine/saves.js', 'text/javascript; charset=utf-8']],
    ['/engine/job-catalog.js', ['engine/job-catalog.js', 'text/javascript; charset=utf-8']],
    ['/engine/service-catalog.js', ['engine/service-catalog.js', 'text/javascript; charset=utf-8']],
    [
      '/engine/service-resources.js',
      ['engine/service-resources.js', 'text/javascript; charset=utf-8'],
    ],
    ['/engine/service-metrics.js', ['engine/service-metrics.js', 'text/javascript; charset=utf-8']],
    ['/engine/services.js', ['engine/services.js', 'text/javascript; charset=utf-8']],
    ['/engine/save-business.js', ['engine/save-business.js', 'text/javascript; charset=utf-8']],
    ['/engine/save-v4.js', ['engine/save-v4.js', 'text/javascript; charset=utf-8']],
    ['/engine/dependencies.js', ['engine/dependencies.js', 'text/javascript; charset=utf-8']],
    ['/engine/room-supply.js', ['engine/room-supply.js', 'text/javascript; charset=utf-8']],
    ['/engine/operations.js', ['engine/operations.js', 'text/javascript; charset=utf-8']],
    ['/engine/operation-plans.js', ['engine/operation-plans.js', 'text/javascript; charset=utf-8']],
    ['/engine/projects.js', ['engine/projects.js', 'text/javascript; charset=utf-8']],
    ['/engine/save-operations.js', ['engine/save-operations.js', 'text/javascript; charset=utf-8']],
    ['/room/supply-fixtures.js', ['room/supply-fixtures.js', 'text/javascript; charset=utf-8']],
    ['/room/utility-kit.js', ['room/utility-kit.js', 'text/javascript; charset=utf-8']],
    ['/room/plant-connections.js', ['room/plant-connections.js', 'text/javascript; charset=utf-8']],
    ['/room/plant-fascia.js', ['room/plant-fascia.js', 'text/javascript; charset=utf-8']],
    ['/room/cable-tray.js', ['room/cable-tray.js', 'text/javascript; charset=utf-8']],
    ['/engine.js', ['engine.js', 'text/javascript; charset=utf-8']],
    ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
  ]);

  // Only bundled model/image files are public. Saves, source, scripts and licences stay private.
  function registerAssetFiles(relative) {
    const folder = path.join(root, relative);
    if (!fs.existsSync(folder)) return;
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const name = relative + '/' + entry.name;
      if (entry.isDirectory()) registerAssetFiles(name);
      else if (entry.isFile() && /\.(glb|png|jpg)$/.test(entry.name)) {
        const type = entry.name.endsWith('.glb')
          ? 'model/gltf-binary'
          : entry.name.endsWith('.png')
            ? 'image/png'
            : 'image/jpeg';
        FILES.set('/' + name, [name, type]);
      }
    }
  }
  registerAssetFiles('asset-pack/assets');
  registerAssetFiles('asset-pack/textures');

  return FILES;
}
module.exports = { createStaticFiles };
