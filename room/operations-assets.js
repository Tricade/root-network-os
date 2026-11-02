import * as THREE_DEFAULT from '../vendor/three.module.js';
import { createOperationsAssetKit } from './operations-asset-kit.js';
import { createOperationsPlant } from './operations-plant.js';
import { createConstructionAssets } from './construction-assets.js';

/** Attach the operational models appropriate to this streamed room. */
export function createOperationsAssets({
  THREE = THREE_DEFAULT,
  scene,
  bank,
  location,
  central,
  layout,
  colliders: colliderSink = null,
  pickTargets: pickTargetSink = null,
}) {
  const group = new THREE.Group();
  group.name = 'room-operations-assets';
  scene?.add(group);
  const colliders = Array.isArray(colliderSink) ? colliderSink : [],
    pickTargets = Array.isArray(pickTargetSink) ? pickTargetSink : [],
    kit = createOperationsAssetKit({ THREE, group, bank, colliders, pickTargets }),
    plant = createOperationsPlant({ THREE, bank, group, kit, location, central, layout }),
    construction = createConstructionAssets({ THREE, group, kit, bank, location, layout, central });
  let disposed = false,
    lastUpdate = -Infinity;

  return {
    group,
    get colliders() {
      return colliders;
    },
    get pickTargets() {
      return pickTargets;
    },
    update(snapshot = {}) {
      if (disposed || !snapshot) return;
      const now = globalThis.performance?.now?.() ?? Date.now();
      if (now - lastUpdate < 800) return;
      lastUpdate = now;
      plant.update(snapshot);
      construction.update(snapshot.construction || null);
    },
    animate(delta = 0, reduced = false) {
      if (disposed || reduced) return;
      plant.animate(delta, reduced);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      construction.dispose();
      plant.dispose();
      kit.dispose();
      if (group.parent) group.parent.remove(group);
    },
  };
}
