import * as THREE from '../vendor/three.module.js';
import { createUtilityKit } from './utility-kit.js';
import { buildCableTray } from './cable-tray.js';

/** Original room-side services. Routes connect firestopped entries to the room
 * coil and only the racks that exist. Local equipment remains the fallback. */
export function buildSupplyFixtures(materials, bank = null) {
  const group = new THREE.Group();
  group.name = 'central-room-connections';
  const cooling = new THREE.Group(),
    power = new THREE.Group();
  cooling.name = 'chilled-water-headers';
  power.name = 'central-power-trays';
  group.add(cooling, power);
  const kit = createUtilityKit(materials),
    feeds = [],
    fans = [];
  // Separate depth planes keep the return riser clear of the supply cross-run.
  for (const [i, x, y, end] of [
    [0, 3.58, 2.42, -0.32],
    [1, 3.83, 2.65, 0.32],
  ]) {
    const endZ = i ? -5.12 : -4.93;
    kit.pipe(
      cooling,
      [
        [x, y, 5.43],
        [x, y, endZ],
        [end, y, endZ],
        [end, 1.48, endZ],
      ],
      'room-water-circuit',
    );
    kit.wallPort(cooling, x, y, 5.29);
    kit.valve(cooling, end, 1.89, endZ, i ? kit.returning : kit.supply);
    for (const z of [-3.1, 0.2, 3.2]) {
      kit.rod(
        cooling,
        [x, y, z - 0.04],
        [x, y, z + 0.04],
        0.066,
        i ? kit.returning : kit.supply,
        'water-identification-band',
      );
    }
  }
  for (const z of [-3.1, 0.2, 3.2]) {
    kit.support(cooling, 1, 2.42, z, 3.58);
    kit.support(cooling, 1, 2.65, z, 3.83);
  }
  // Chilled water exchanges heat with room air here. The rectangular outlets
  // enter the raised-floor plenum, rather than pretending a water pipe is a duct.
  const airHandler = bank?.make('airHandler');
  if (airHandler) {
    airHandler.position.set(0, 0, -5.02);
    cooling.add(airHandler);
    airHandler.traverse((node) => {
      if (/^room_air_fan_\d+$/.test(node.name)) fans.push(node);
    });
  } else {
    kit.box(cooling, [1.7, 0.86, 0.44], [0, 1.02, -5.02], 'room-fan-coil');
  }
  // Name the actual function: this cabinet circulates air through a water coil.
  // The compressors and refrigeration plant live in the central cooling room.
  kit.label(cooling, 'AIR HANDLER / CHW', [0.12, 1.385, -4.776], 0.99, 0.075);
  for (const x of [-0.49, 0.49]) {
    kit.box(cooling, [0.34, 0.61, 0.3], [x, 0.3, -5.02], 'floor-plenum-outlet');
    kit.box(cooling, [0.44, 0.055, 0.4], [x, 0.0275, -5.02], 'sealed-floor-boot', kit.gasket);
  }
  const busY = 2.28,
    wallX = 3.79;
  buildCableTray(
    kit,
    power,
    [
      [-wallX, busY, 5.43],
      [-wallX, busY, -3.15],
      [wallX, busY, -3.15],
      [wallX, busY, 0.65],
    ],
    'room-power-tray',
  );
  kit.wallPort(power, -wallX, busY, 5.29, true);
  kit.box(power, [0.24, 0.36, 0.48], [-wallX, busY - 0.04, 3.8], 'room-bus-isolator');
  kit.box(
    power,
    [0.05, 0.18, 0.09],
    [-wallX + 0.15, busY - 0.09, 3.8],
    'isolator-handle',
    kit.gasket,
  );
  kit.label(power, 'ATS / ROOM FEED', [-wallX + 0.126, busY + 0.09, 3.8], 0.34, 0.075, Math.PI / 2);
  for (const side of [-1, 1])
    for (const z of [-2.6, 0.4, 3.7]) {
      if (side > 0 && z > 0.65) continue;
      kit.support(power, side, busY, z, wallX, 0.03);
    }
  // The cross-room span needs its own ceiling hangers; side-wall brackets
  // cannot support a tray spanning the entire aisle.
  for (const x of [-2.1, 2.1]) {
    for (const z of [-3.31, -2.99])
      kit.rod(power, [x, 2.215, z], [x, 3.035, z], 0.007, kit.steel, 'tray-hanger-rod');
    kit.box(
      power,
      [0.07, 0.035, 0.4],
      [x, busY - 0.0475, -3.15],
      'tray-hanger-crossbar',
      kit.steel,
    );
    kit.box(power, [0.12, 0.025, 0.44], [x, 3.025, -3.15], 'tray-ceiling-anchor', kit.steel);
  }
  for (let index = 0; index < 6; index++) {
    const feed = new THREE.Group(),
      side = index % 2 === 0 ? -1 : 1,
      z = -Math.floor(index / 2) * 0.84 - 0.25,
      x = side * 1.99;
    feed.name = `rack-feed-${index + 1}`;
    power.add(feed);
    // This roof position is on the rear half of the rotated rack42 model.
    // A protected tray tap feeds a removable rack through a flexible cable, not a
    // rigid duct. A small sag and roof gland keep its route easy to read.
    const cable = kit.pipe(
      feed,
      [
        [side * (wallX - 0.08), busY - 0.055, z],
        [side * 3.3, 2.16, z],
        [side * 2.45, 2.16, z],
        [x, 2.18, z],
        [x, 2.07, z],
      ],
      'rack-feed-branch',
      0.018,
    );
    cable.material = kit.gasket;
    kit.rod(
      feed,
      [side * (wallX - 0.1), busY - 0.055, z],
      [side * (wallX - 0.16), busY - 0.055, z],
      0.034,
      kit.gasket,
      'tap-cable-gland',
    );
    kit.box(feed, [0.15, 0.04, 0.15], [x, 2.075, z], 'rack-roof-gland', kit.gasket);
    kit.box(feed, [0.22, 0.25, 0.24], [side * wallX, busY - 0.025, z], 'bus-tap');
    feeds.push(feed);
  }
  return {
    group,
    cooling,
    power,
    fans,
    set(supply = { cooling: 'local', power: 'local' }, rackCount = 0) {
      cooling.visible = supply.cooling !== 'local';
      power.visible = supply.power !== 'local';
      feeds.forEach((feed, i) => {
        feed.visible = i < rackCount;
      });
    },
    dispose: kit.dispose,
  };
}
