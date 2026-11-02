import { corridorPlan } from './room-navigation.js';
export { roomLocation, corridorPlan, stairHeight } from './room-navigation.js';
import * as THREE from './vendor/three.module.js';
import { metricBox } from './room-surfaces.js';
import { facilityReadout, drawInstrument } from './room-instruments.js';
import { buildPlantConnections } from './room/plant-connections.js';
import { decoratePlantUnit } from './room/plant-fascia.js';
import { createOperationsAssets } from './room/operations-assets.js';

const tr = (text) => globalThis.ROOTI18N?.translate(String(text)) || String(text);

// Central equipment exists once, on UG 1. Only owned rooms and floors get links.

export function buildFacilityInterior({ bank, scene, materials, location, layout, central }) {
  const group = new THREE.Group();
  group.name = 'facility-interior';
  scene.add(group);
  const picks = [],
    portals = [],
    colliders = [],
    fans = [],
    geometries = [],
    textures = [],
    ownedMaterials = [],
    instruments = [],
    serviceKits = [];
  let lastInstrumentUpdate = -Infinity,
    lastInstrumentLanguage = '';
  const concrete = materials.bunkerConcrete || materials.wall;
  const steel = materials.bunkerSteel || materials.brushed;
  const plan = corridorPlan(layout, central, location.floor),
    isHall = location.id === 'hall';
  function box(parent, size, position, material) {
    const mesh = metricBox(size, material);
    geometries.push(mesh.geometry);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function sign(parent, title, subtitle, position, width = 1.05, height = 0.24, turn = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = Math.round((768 * height) / width);
    const h = canvas.height,
      ctx = canvas.getContext('2d');
    ctx.fillStyle = '#101c20';
    ctx.fillRect(0, 0, 768, h);
    ctx.fillStyle = '#a7d487';
    ctx.fillRect(0, 0, 9, h);
    ctx.fillStyle = '#e5ede8';
    ctx.font = `600 ${Math.min(64, Math.round(h * 0.36))}px Segoe UI`;
    ctx.fillText(tr(title), 30, h * 0.45, 708);
    ctx.fillStyle = '#a4b9b8';
    ctx.font = `${Math.min(44, Math.round(h * 0.23))}px Segoe UI`;
    ctx.fillText(tr(subtitle), 30, h * 0.82, 708);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    ownedMaterials.push(material);
    const geometry = new THREE.PlaneGeometry(width, height);
    geometries.push(geometry);
    const backing = box(
      parent,
      [width + 0.018, height + 0.018, 0.012],
      [position[0] - Math.sin(turn) * 0.008, position[1], position[2] - Math.cos(turn) * 0.008],
      materials.shellDark,
    );
    backing.name = 'mounted-sign-backing';
    backing.rotation.y = turn;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.y = turn;
    parent.add(mesh);
    return mesh;
  }
  function portal(title, subtitle, destination, x, z, turn = 0) {
    const holder = new THREE.Group();
    holder.position.set(x, 0, z);
    holder.rotation.y = turn;
    group.add(holder);
    const door = bank.make('airlock');
    holder.add(door);
    sign(holder, title, subtitle, [0, isHall ? 2.515 : 2.61, 0.084], 1.2, 0.18);
    const p = {
      id: destination,
      x,
      z,
      turn,
      destination,
      label: title,
      hinge: door.getObjectByName('bunker_door_hinge'),
      open: false,
      progress: 0,
      autoClose: false,
      closeDelay: 0,
    };
    const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
    ownedMaterials.push(hitMaterial);
    // Follow the leaf instead of leaving the interaction target in the empty
    // doorway. A closed box is reachable from either side of the open door.
    const hit = p.hinge
      ? box(p.hinge, [1.06, 2.16, 0.15], [0.53, 1.08, 0.015], hitMaterial)
      : box(holder, [1.1, 2.24, 0.15], [0, 1.12, 0.015], hitMaterial);
    hit.name = 'portal-leaf-hit';
    hit.userData = { roomKind: 'portal', portal: p, destination, label: title, enabled: true };
    picks.push(hit);
    portals.push(p);
    // The aperture reveals a short vestibule; crossing streams the detailed room.
    box(holder, [1.4, 0.12, 1.1], [0, -0.06, -0.64], materials.bunkerFloor || materials.floor);
    for (const side of [-1, 1]) box(holder, [0.14, 2.4, 1.1], [side * 0.69, 1.2, -0.64], concrete);
    box(holder, [1.5, 0.16, 1.1], [0, 2.4, -0.64], concrete);
    box(holder, [1.4, 2.4, 0.1], [0, 1.2, -1.18], materials.shellDark);
    box(holder, [0.75, 0.025, 0.12], [0, 2.28, -0.7], materials.lightWhite);
    return p;
  }
  function terminal(title, subtitle, position, turn = 0, view = 'facility', rackId = null) {
    const holder = new THREE.Group();
    holder.name = 'local-operations-terminal';
    holder.position.set(...position);
    holder.rotation.y = turn;
    group.add(holder);
    const model = bank.make('terminal');
    holder.add(model);
    const originalScreen = model.getObjectByName('monitor_screen');
    if (originalScreen) originalScreen.visible = false;
    const oldLabel = model.getObjectByName('label_hostname');
    if (oldLabel) oldLabel.visible = false;
    sign(
      holder,
      'ROOT / LOCAL',
      `Untergeschoss ${location.floor}`,
      [0.14, -0.29, 0.188],
      0.38,
      0.055,
    );
    const panel = instrument(holder, [0, 0.08, 0.188], 0.84, 0.52);
    panel.userData = {
      roomKind: 'station',
      view,
      label: title,
      rackId,
      roomId: location.id.startsWith('room-') ? location.id : null,
    };
    picks.push(panel);
    sign(holder, title, 'E / Klick: Terminal öffnen', [0, 0.64, 0.012], 1.05, 0.2);
  }
  function instrument(parent, position, width, height, compact = false) {
    const canvas = document.createElement('canvas');
    canvas.width = compact ? 720 : 840;
    canvas.height = compact ? Math.round((720 * height) / width) : 520;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    textures.push(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    ownedMaterials.push(material);
    const geometry = new THREE.PlaneGeometry(width, height);
    geometries.push(geometry);
    const face = new THREE.Mesh(geometry, material);
    face.name = compact ? 'live-plant-display' : 'live-room-terminal';
    face.position.set(...position);
    parent.add(face);
    instruments.push({ canvas, texture, compact, lastKey: '' });
    return face;
  }
  if (isHall) {
    const length = plan.frontZ - plan.endZ,
      middle = (plan.frontZ + plan.endZ) / 2;
    box(group, [4.4, 0.18, length], [0, -0.09, middle], materials.bunkerFloor || materials.floor);
    box(group, [4.4, 0.22, length], [0, 3.12, middle], concrete);
    box(group, [4.4, 3.2, 0.3], [0, 1.6, plan.frontZ + 0.15], concrete);
    box(group, [4.4, 0.36, 0.28], [0, 2.92, plan.endZ - 0.05], steel);
    for (const side of [-1, 1]) {
      const doors = plan.doors.filter((d) => Math.sign(d.x) === side).sort((a, b) => a.z - b.z);
      let cursor = plan.endZ;
      for (const d of doors) {
        const start = d.z - 0.72;
        if (start > cursor)
          box(
            group,
            [0.3, 3.2, start - cursor],
            [side * 2.18, 1.6, (cursor + start) / 2],
            concrete,
          );
        box(group, [0.3, 0.8, 1.44], [side * 2.18, 2.8, d.z], concrete);
        portal(d.name, d.subtitle, d.id, d.x, d.z, d.turn);
        cursor = d.z + 0.72;
      }
      if (cursor < plan.frontZ)
        box(
          group,
          [0.3, 3.2, plan.frontZ - cursor],
          [side * 2.18, 1.6, (cursor + plan.frontZ) / 2],
          concrete,
        );
      for (const y of [2.73, 2.86])
        box(group, [0.055, 0.055, length - 0.15], [side * 1.94, y, middle], steel);
      box(group, [0.025, 0.012, length - 0.2], [side * 1.78, 0.015, middle], materials.lightWhite);
    }
    for (let z = 3.3; z > plan.endZ + 1.55; z -= 3.4) {
      const lamp = bank.make('light');
      lamp.position.set(0, 2.74, z);
      group.add(lamp);
      const light = new THREE.PointLight(0xd6e5e4, 9, 6, 2);
      light.position.set(0, 2.62, z);
      group.add(light);
      for (const side of [-1, 1]) box(group, [0.11, 3.0, 0.14], [side * 2.0, 1.5, z + 0.6], steel);
      box(group, [4.05, 0.15, 0.16], [0, 2.99, z + 0.6], steel);
    }
    if (!plan.stairs.length) box(group, [4.4, 3.2, 0.3], [0, 1.6, plan.endZ - 0.15], concrete);
    else {
      const dividerWidth = 0.14;
      box(group, [dividerWidth, 8.4, 4.7], [0, 1.5, plan.endZ - 2.25], concrete);
      for (const side of [-1, 1]) {
        const stair = plan.stairs.find((s) => Math.sign(s.x) === side);
        if (!stair) {
          box(group, [2.05, 3.2, 0.3], [side * 1.04, 1.6, plan.endZ - 0.15], concrete);
          continue;
        }
        const flight = bank.make('stairs');
        flight.position.set(stair.x, stair.rise > 0 ? 0 : -2.6, plan.endZ - 1.6);
        flight.rotation.y = stair.rise > 0 ? Math.PI : 0;
        group.add(flight);
        box(group, [0.28, 8.4, 4.8], [side * 2.18, 1.5, plan.endZ - 2.25], concrete);
        box(
          group,
          [2.0, 0.16, 1.25],
          [stair.x, stair.rise - 0.08, plan.endZ - 3.825],
          materials.bunkerFloor || materials.floor,
        );
        box(group, [2.0, 8.4, 0.2], [stair.x, 1.5, plan.endZ - 4.4], concrete);
        box(
          group,
          [2.0, 0.2, 4.8],
          [stair.x, stair.rise > 0 ? 5.55 : 3.12, plan.endZ - 2.25],
          concrete,
        );
        // Keep a 2 mm assembly seam beside the divider. Both front faces
        // share Z, so the old 1.96 m beam overlapped its concrete by 1 cm.
        const headerWidth = 2 * (Math.abs(stair.x) - dividerWidth / 2 - 0.002);
        const header = box(
          group,
          [headerWidth, 0.23, 0.12],
          [stair.x, 2.705, plan.endZ + 0.04],
          steel,
        );
        header.name = 'stair-sign-header';
        sign(
          group,
          stair.direction === 'up' ? '↑ Treppe nach oben' : '↓ Treppe nach unten',
          `Untergeschoss ${stair.floor}`,
          [stair.x, 2.705, plan.endZ + 0.103],
          1.55,
          0.2,
        );
        const lamp = new THREE.PointLight(0xd8e3df, 12, 7, 2);
        lamp.position.set(stair.x, stair.rise > 0 ? 3.8 : 1.8, plan.endZ - 2.2);
        group.add(lamp);
      }
    }
    terminal(
      'Gebäudeplan',
      'Räume bauen & Etagen erweitern',
      [1.1, 1.25, 4.785],
      Math.PI,
      'facility',
    );
    colliders.push({ x: 1.1, z: 4.63, hx: 0.74, hz: 0.31 });
  } else {
    portal('Verbindungsflur', `Untergeschoss ${location.floor}`, 'hall', 0, 5.35, Math.PI);
    if (location.id === 'control') {
      for (const side of [-1, 1]) colliders.push({ x: side * 1.65, z: -2.4, hx: 1.28, hz: 0.66 });
    } else if (location.id.startsWith('room-')) {
      terminal(
        'Hardware & Wartung',
        'Racks · Server · Anschlüsse',
        [-1.55, 1.25, 5.275],
        Math.PI,
        'network',
        location.rackIds[0],
      );
    } else terminal(location.name, 'Kapazität & Ausbau', [-1.55, 1.25, 5.275], Math.PI);
    if (location.id !== 'control') colliders.push({ x: -1.55, z: 5.12, hx: 0.74, hz: 0.31 });
    const system = central.systems.find((item) => item.id === location.id);
    if (system) {
      // Cooling upgrades replace the starter cabinet, then add parallel modules.
      // Visible modules are bounded; instruments show the real uncapped capacity.
      const count = system.level
          ? Math.min(3, system.id === 'cooling' ? Math.ceil(system.level / 2) : system.level + 1)
          : 0,
        units = [];
      for (let i = 0; i < count; i++)
        for (const side of [-1, 1]) {
          const x = side * 2.35,
            z = 0.2 - i * 1.45;
          const upgradedChiller = system.id === 'cooling' && system.level >= 2;
          const unit = bank.make(
            system.id === 'cooling' ? (upgradedChiller ? 'centralChiller' : 'cooling') : system.id,
          );
          unit.userData.centralChiller = upgradedChiller;
          unit.position.set(x, 0, z);
          unit.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
          group.add(unit);
          units.push({
            x,
            z,
            roof: system.id === 'cooling' ? 2.1 : system.id === 'ups' ? 2.0225 : 2.0625,
          });
          decoratePlantUnit(unit, system.id, i, side, location.floor, {
            box,
            sign,
            instrument,
            tr,
            materials,
          });
          unit.traverse((node) => {
            if (/^cooling_fan_\d+$/.test(node.name)) fans.push(node);
          });
          const bounds = new THREE.Box3().setFromObject(unit),
            size = bounds.getSize(new THREE.Vector3()),
            center = bounds.getCenter(new THREE.Vector3());
          colliders.push(
            bounds.isEmpty()
              ? { x, z, hx: 0.63, hz: 0.64 }
              : { x: center.x, z: center.z, hx: size.x / 2 + 0.17, hz: size.z / 2 + 0.17 },
          );
        }
      const services = buildPlantConnections(
        materials,
        system.id,
        units,
        central.systems.some((item) => item.id === 'ups' && item.level > 0),
      );
      group.add(services.group);
      serviceKits.push(services);
    }
  }
  const operationalAssets = createOperationsAssets({
    THREE,
    scene: group,
    bank,
    location,
    layout,
    central,
    colliders,
    pickTargets: picks,
  });
  const local = (p, x, z) => ({
    x: Math.cos(p.turn) * (x - p.x) - Math.sin(p.turn) * (z - p.z),
    z: Math.sin(p.turn) * (x - p.x) + Math.cos(p.turn) * (z - p.z),
  });
  return {
    group,
    picks,
    portals,
    colliders,
    fans,
    plan,
    update(snapshot, now = performance.now()) {
      operationalAssets.update(snapshot);
      const language = globalThis.ROOTI18N?.getLanguage() || 'de';
      if (now - lastInstrumentUpdate < 900 && language === lastInstrumentLanguage) return;
      lastInstrumentUpdate = now;
      lastInstrumentLanguage = language;
      const data = facilityReadout(
        { ...snapshot, location, layout, central: snapshot.central || central },
        language,
      );
      const key = JSON.stringify([language, data]);
      for (const face of instruments) {
        if (face.lastKey === key) continue;
        drawInstrument(face.canvas, data, language, face.compact);
        face.texture.needsUpdate = true;
        face.lastKey = key;
      }
    },
    togglePortal(p) {
      if (portals.includes(p)) {
        p.open = !p.open;
        p.autoClose = false;
      }
    },
    openPortal(id, autoClose = false) {
      const p = portals.find((p) => p.id === id);
      if (p) {
        p.open = true;
        p.progress = 1;
        p.autoClose = autoClose;
        p.closeDelay = 1.2;
        if (p.hinge) p.hinge.rotation.y = -1.72;
      }
    },
    animate(delta, reduced, player = null) {
      operationalAssets.animate(delta, reduced);
      for (const p of portals) {
        if (p.autoClose && p.open) {
          p.closeDelay = Math.max(0, p.closeDelay - delta);
          const at = player ? local(p, player.x, player.z) : null;
          // Keep the leaf open while the player occupies its swing/threshold area.
          const inSweep = at && at.z > -0.3 && Math.hypot(at.x + 0.53, at.z) < 1.3;
          if (p.closeDelay === 0 && !inSweep) {
            p.open = false;
            p.autoClose = false;
          }
        }
        p.progress += ((p.open ? 1 : 0) - p.progress) * (reduced ? 1 : Math.min(1, delta * 5));
        if (p.hinge) p.hinge.rotation.y = -p.progress * 1.72;
      }
    },
    canWalk(x, z) {
      const inMain = isHall
        ? Math.abs(x) < 1.8 && z > plan.endZ && z < 4.55
        : Math.abs(x) < 3.85 && z > -4.85 && z < 5.05;
      if (inMain) return true;
      if (
        isHall &&
        plan.stairs.some((s) => Math.abs(x - s.x) < 0.47 && z <= s.startZ && z >= s.endZ - 0.25)
      )
        return true;
      return portals.some((p) => {
        const at = local(p, x, z);
        return p.progress > 0.8 && Math.abs(at.x) < 0.45 && at.z < 0.65 && at.z > -0.5;
      });
    },
    crossing(x, z) {
      return portals.find((p) => {
        const at = local(p, x, z);
        return p.progress > 0.8 && Math.abs(at.x) < 0.45 && at.z < -0.23 && at.z > -0.5;
      });
    },
    stairAt(x, z) {
      return isHall
        ? plan.stairs.find((s) => Math.abs(x - s.x) < 0.48 && z < s.startZ && z >= s.endZ - 0.25)
        : null;
    },
    dispose() {
      operationalAssets.dispose();
      scene.remove(group);
      serviceKits.forEach((kit) => kit.dispose());
      geometries.forEach((item) => item.dispose());
      textures.forEach((item) => item.dispose());
      ownedMaterials.forEach((item) => item.dispose());
    },
  };
}
