import * as THREE_DEFAULT from '../vendor/three.module.js';

const SYSTEM_KEYS = {
  pump: 'pumpSkid',
};

/** Cooling-only assembly. Prepared sensor/robot props are not placed as redundant room decoration. */
export function createOperationsPlant({
  THREE = THREE_DEFAULT,
  bank,
  group,
  kit,
  location,
  central,
}) {
  const devices = new Map();
  const text = (de, en) => (globalThis.ROOTI18N?.getLanguage?.() === 'en' ? en : de);
  let pumpRunning = false;

  function buildPump() {
    if (location?.id !== 'cooling' || !bank) return;
    const system = central?.systems?.find((item) => item.id === 'cooling');
    if (!system?.available || system.level <= 0) return;
    const enclosed = system.level >= 2;
    const pump = kit.make(
      enclosed ? 'enclosedPump' : SYSTEM_KEYS.pump,
      'cooling-pump-heat-exchanger',
      [0, 0, -3.55],
    );
    if (!pump) return;
    devices.set('pump', pump);
    kit.addObstacle(pump, 0.14);
    const display = kit.screen(pump, 'cooling', 'facility', 0.22, 0.075, [
      0.3,
      1.08,
      enclosed ? 0.49 : 0.221,
    ]);
    const portY = enclosed ? 1.58 : 1.42;
    const supplyMaterial = 0x50aabd,
      returnMaterial = 0x8396ba;
    // Join the skid's paired top ports to the side-wall headers on the rear service run.
    const manifold = new THREE.Group();
    manifold.name = 'cooling-pump-manifold-links';
    group.add(manifold);
    kit.addPipe(
      manifold,
      'pump_chw_supply_to_header',
      [
        [-0.3, portY, -3.21],
        [-0.3, 2.2, -3.21],
        [-0.3, 2.34, -3.65],
        [1.2, 2.34, -3.78],
        [3.2, 2.34, -3.92],
        [3.55, 2.48, -4.15],
      ],
      supplyMaterial,
      0.026,
    );
    kit.addPipe(
      manifold,
      'pump_chw_return_to_header',
      [
        [0.58, portY, -3.545],
        [0.58, 2.16, -3.545],
        [0.5, 2.5, -3.65],
        [2.05, 2.5, -3.78],
        [3.5, 2.5, -3.92],
        [3.82, 2.65, -4.15],
      ],
      returnMaterial,
      0.026,
    );
    // Short ceiling hangers carry the rear crossover instead of leaving long
    // water lines apparently suspended from the cabinet fittings alone.
    for (const [x, y, z] of [
      [1.2, 2.34, -3.78],
      [3.2, 2.34, -3.92],
      [2.05, 2.5, -3.78],
    ]) {
      kit.addPipe(
        manifold,
        'pump-header-hanger',
        [
          [x, y + 0.026, z],
          [x, 3.04, z],
        ],
        0x718085,
        0.009,
      );
    }
    if (display) display.face.userData.plantTier = enclosed ? 'enclosed' : 'starter';
  }

  function updateCooling(snapshot) {
    const pump = devices.get('pump');
    if (!pump) return;
    const system =
        snapshot.central?.systems?.find((item) => item.id === 'cooling') ||
        central?.systems?.find((item) => item.id === 'cooling'),
      active = Boolean(system?.available && system.level > 0),
      operation = snapshot.central?.operation?.system === 'cooling',
      fault =
        snapshot.resilience?.incident?.scope === 'central' &&
        snapshot.resilience?.incident?.system === 'cooling';
    pumpRunning = active && !operation && !fault;
    kit.setLed(pump, 'led_pump_run', pumpRunning ? 0x9bd473 : 0x182426);
    kit.setLed(pump, 'led_pump_fault', fault ? 0xe46f61 : 0x182426);
    kit.setLed(pump, 'led_hx_flow', pumpRunning ? 0x55bdd0 : 0x182426);
    const cooling = Number(system?.totalCoolingW || 0),
      used = Number(system?.allocatedCoolingW || 0),
      ratio = cooling > 0 ? used / cooling : 0,
      status = fault ? 'FAULT' : operation ? 'SERVICE' : active ? 'ONLINE' : 'OFFLINE';
    kit.draw(
      kit.screens.get('cooling'),
      text('KÄLTE / PUMPENGRUPPE', 'CHW / PUMP SKID'),
      `${Math.round(cooling)} W`,
      `${status} · ${Math.round(ratio * 100)}% ${text('ZUGEWIESEN', 'ALLOCATED')}`,
      ratio,
      fault ? 0xe46f61 : 0x80c6d0,
    );
  }

  buildPump();

  return {
    update(snapshot) {
      updateCooling(snapshot);
    },
    animate(delta, reduced) {
      if (reduced) return;
      const fan = devices.get('pump')?.getObjectByName('pump_fan_01');
      if (fan && pumpRunning) fan.rotation.z += Math.max(0, delta) * 8;
    },
    dispose() {
      devices.clear();
    },
  };
}
