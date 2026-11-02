import * as THREE_DEFAULT from '../vendor/three.module.js';
import { corridorPlan } from '../room-navigation.js';

const SITE_KEYS = {
  barrier: 'siteBarrier',
  board: 'siteBoard',
  pallet: 'materialPallet',
};

/** Creates temporary props only for the currently active corridor construction. */
export function createConstructionAssets({
  THREE = THREE_DEFAULT,
  group,
  kit,
  bank,
  location,
  layout,
  central,
}) {
  let constructionGroup = null,
    constructionKey = '',
    constructionScreens = [];

  function constructionCandidates(plan) {
    const candidates = [];
    for (let z = plan.frontZ - 0.65; z > plan.endZ + 0.65; z -= 0.2) candidates.push(z);
    return candidates;
  }

  function constructionGapCenters(plan, side) {
    const doors = plan.doors.filter((door) => Math.sign(door.x) === side).sort((a, b) => b.z - a.z),
      centers = [];
    if (doors.length) {
      centers.push((plan.frontZ + doors[0].z) / 2);
      for (let i = 1; i < doors.length; i++) centers.push((doors[i - 1].z + doors[i].z) / 2);
      if (!plan.stairs.length) centers.push((doors.at(-1).z + plan.endZ) / 2);
    }
    return centers;
  }

  function footprintTouchesDoor(x, z, hx, hz, door) {
    // Side portals open along world Z and need a clear approach in front of their frame.
    return Math.abs(x - door.x) < hx + 0.24 && Math.abs(z - door.z) < hz + 0.78;
  }

  function constructionPlacements(plan) {
    if (!plan) return [];
    const placements = [],
      taken = [];
    const entries = [
      {
        kind: 'barrier',
        key: SITE_KEYS.barrier,
        label: 'construction-barrier',
        x: 1.92,
        hz: 0.9,
        hx: 0.12,
        turn: -Math.PI / 2,
        scale: 1,
      },
      {
        kind: 'board',
        key: SITE_KEYS.board,
        label: 'construction-status-board',
        x: 1.89,
        hz: 0.44,
        hx: 0.16,
        turn: -Math.PI / 2,
        scale: 1,
      },
      {
        kind: 'pallet',
        key: SITE_KEYS.pallet,
        label: 'construction-material-pallet',
        x: 1.56,
        hz: 0.38,
        hx: 0.3,
        turn: -Math.PI / 2,
        scale: 0.68,
      },
    ];
    for (const entry of entries) {
      let best = null;
      for (const side of [-1, 1])
        for (const z of [...constructionCandidates(plan), ...constructionGapCenters(plan, side)]) {
          const x = side * entry.x,
            hx = entry.hx,
            hz = entry.hz,
            loZ = plan.endZ + hz + 0.2,
            hiZ = plan.frontZ - hz - 0.3;
          if (z < loZ || z > hiZ) continue;
          if (
            plan.doors.some(
              (door) => Math.sign(door.x) === side && footprintTouchesDoor(x, z, hx, hz, door),
            )
          )
            continue;
          if (
            plan.stairs.some((stair) => {
              const overlapX = Math.abs(x - stair.x) < hx + 0.48;
              return overlapX && z + hz > stair.endZ - 0.25 && z - hz < stair.startZ;
            })
          )
            continue;
          if (
            taken.some(
              (p) => Math.abs(x - p.x) < hx + p.hx + 0.08 && Math.abs(z - p.z) < hz + p.hz + 0.08,
            )
          )
            continue;
          const score =
            Math.min(
              ...plan.doors
                .filter((door) => Math.sign(door.x) === side)
                .map((door) => Math.abs(z - door.z) - hz - 0.78),
              8,
            ) -
            Math.abs(z - (plan.frontZ + plan.endZ) / 2) * 0.035;
          if (!best || score > best.score) best = { ...entry, x, z, score, side };
        }
      if (best) {
        const root = kit.make(
          best.key,
          best.label,
          [best.x, 0, best.z],
          best.side > 0 ? best.turn : Math.PI - best.turn,
          constructionGroup,
          best.scale,
        );
        if (!root) continue;
        if (best.kind === 'barrier') {
          for (const ledName of ['led_barrier_beacon_01', 'led_barrier_beacon_02'])
            kit.setLed(root, ledName, 0xe4a64d);
        }
        if (best.kind === 'pallet') {
          kit.setLed(root, 'led_pallet_inventory_01', 0x9bcf76);
          kit.setLed(root, 'led_pallet_inventory_02', 0x9bcf76);
        }
        const collider = kit.addObstacle(root, 0.04),
          rect = { ...best, root, collider };
        placements.push(rect);
        taken.push({ x: collider.x, z: collider.z, hx: collider.hx, hz: collider.hz });
      }
    }
    const board = placements.find((item) => item.kind === 'board');
    if (board)
      constructionScreens.push(
        kit.screen(board.root, 'siteBoard', 'facility', 0.53, 0.51, [0, 1.04, 0.052]),
      );
    return placements;
  }

  function clear() {
    if (!constructionGroup) return;
    kit.releaseModel(constructionGroup);
    group.remove(constructionGroup);
    for (const rect of constructionGroup.userData.operationsColliders || [])
      kit.removeObstacle(rect);
    for (const ref of constructionScreens) kit.removeScreen(ref);
    constructionScreens = [];
    constructionGroup = null;
    constructionKey = '';
  }

  function targetKey(project) {
    return project ? [project.kind, project.floor, project.roomType, project.roomId].join(':') : '';
  }

  function update(project) {
    if (location?.id !== 'hall') return;
    // A streamed floor only shows its own site; a new floor is reached from the deepest owned one.
    const siteFloor = project?.kind === 'floor' ? layout?.floorCount : project?.floor || 1;
    if (!project || location.floor !== siteFloor) {
      clear();
      return;
    }
    const key = targetKey(project);
    if (key !== constructionKey) {
      clear();
      if (!project || !layout || !bank) return;
      constructionKey = key;
      constructionGroup = new THREE.Group();
      constructionGroup.name = 'active-construction-site';
      constructionGroup.userData.operationsColliders = [];
      group.add(constructionGroup);
      const plan = corridorPlan(layout, central || { systems: [] }, location.floor),
        placementBefore = new Set(kit.colliders);
      constructionPlacements(plan);
      constructionGroup.userData.operationsColliders = kit.colliders.filter(
        (rect) => !placementBefore.has(rect),
      );
    }
    const pct = Math.max(0, Math.min(1, Number(project.progress) || 0)),
      label = project.label || (project.kind === 'floor' ? `ETAGE ${project.floor}` : 'RAUMBAU'),
      detail =
        project.kind === 'floor'
          ? `UNTERGESCHOSS ${project.floor}`
          : project.roomType || project.roomId || 'RAUM';
    kit.draw(
      kit.screens.get('siteBoard'),
      'BAUPROJEKT',
      label,
      `${detail} · ${Math.round(pct * 100)} %`,
      pct,
      0xe5b66c,
    );
  }

  return { update, clear, dispose: clear };
}
