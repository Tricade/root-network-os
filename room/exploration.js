import { consoleNavigation } from '../ui/navigation.js';
/** 3D exploration. The per-view context owns scene resources and mutable interaction state. */
export function createRoomExploration(sceneContext) {
  function startExploration(pointer = true, restored = null) {
    if (!sceneContext.camera || !sceneContext.renderer) return;
    sceneContext.exploring = true;
    sceneContext.keys.clear();
    sceneContext.dragPoint = null;
    sceneContext.dragMoved = false;
    if (restored) {
      sceneContext.camera.position.fromArray(restored.position);
      sceneContext.yaw = restored.yaw;
      sceneContext.pitch = restored.pitch;
    } else {
      sceneContext.camera.position.set(
        0,
        sceneContext.eyeHeight,
        sceneContext.assetBank ? (sceneContext.locationId === 'hall' ? 3.9 : 4.6) : 5.2,
      );
      sceneContext.yaw = 0;
      sceneContext.pitch = -0.02;
    }
    sceneContext.applyCameraRotation();
    sceneContext.shell.classList.add('exploring');
    sceneContext.shell.querySelector('[data-room-enter]').hidden = true;
    sceneContext.shell.querySelector('[data-room-leave]').hidden = false;
    sceneContext.shell.classList.remove('show-nav');
    sceneContext.shell
      .querySelector('[data-room-navigation]')
      .setAttribute('aria-expanded', 'false');
    document.body.classList.add('root-room-open');
    try {
      if (pointer && sceneContext.canvas.requestPointerLock) {
        const request = sceneContext.canvas.requestPointerLock();
        if (request && request.catch)
          request.catch(() => {
            sceneContext.pointerLocked = false;
          });
      }
    } catch {
      sceneContext.pointerLocked = false;
    }
    sceneContext.saveRoomSession();
    sceneContext.syncAnimation();
    sceneContext.canvas.focus({ preventScroll: true });
  }

  function leave() {
    if (!sceneContext.exploring && !sceneContext.pointerLocked) return;
    sceneContext.exploring = false;
    sceneContext.pointerLocked = false;
    sceneContext.keys.clear();
    sceneContext.dragPoint = null;
    sceneContext.consoleOpen = false;
    if (sceneContext.consolePanel) sceneContext.consolePanel.hidden = true;
    sceneContext.shell?.classList.remove('console-open');
    if (document.pointerLockElement === sceneContext.canvas) {
      try {
        document.exitPointerLock();
      } catch {
        /* Browser may already have released it. */
      }
    }
    if (sceneContext.shell) {
      sceneContext.shell.classList.remove('exploring', 'pointer-locked', 'show-nav');
      sceneContext.shell.querySelector('[data-room-enter]').hidden = false;
      sceneContext.shell.querySelector('[data-room-leave]').hidden = true;
      sceneContext.shell
        .querySelector('[data-room-navigation]')
        .setAttribute('aria-expanded', 'false');
    }
    document.body.classList.remove('root-room-open');
    sceneContext.saveRoomSession();
    sceneContext.updateTarget(sceneContext.currentRacks);
    if (sceneContext.onExit) sceneContext.onExit();
    sceneContext.syncAnimation();
  }

  function isExploring() {
    return sceneContext.exploring && !sceneContext.consoleOpen;
  }

  function openConsole(title = 'Leitstelle') {
    sceneContext.consoleOpen = true;
    sceneContext.keys.clear();
    sceneContext.dragPoint = null;
    sceneContext.pointerLocked = false;
    sceneContext.shell.classList.remove('pointer-locked');
    sceneContext.shell.querySelector('[data-room-mouse-help]').innerHTML =
      '<kbd>Maus</kbd> Ziehen / ← → drehen';
    if (document.pointerLockElement === sceneContext.canvas) document.exitPointerLock();
    sceneContext.shell.classList.add('console-open');
    sceneContext.consolePanel.hidden = false;
    sceneContext.consolePanel.querySelector('[data-room-console-title]').textContent =
      sceneContext.tr(title);
    sceneContext.consoleContent.scrollTop = 0;
    sceneContext.consoleContent.focus({ preventScroll: true });
  }

  function closeConsole() {
    sceneContext.consoleOpen = false;
    sceneContext.consolePanel.hidden = true;
    sceneContext.shell.classList.remove('console-open');
    sceneContext.keys.clear();
    sceneContext.canvas?.focus({ preventScroll: true });
  }

  function setConsoleTitle(title, view) {
    sceneContext.consolePanel.querySelector('[data-room-console-title]').textContent =
      sceneContext.tr(title);
    sceneContext.consolePanel.querySelector('.room-console-nav').innerHTML = consoleNavigation(
      view,
      sceneContext.tr,
    );
  }

  function hide() {
    sceneContext.saveRoomSession();
    sceneContext.finishArrival(false);
    sceneContext.hidden = true;
    sceneContext.mounted = false;
    sceneContext.stopAnimation();
    sceneContext.consoleOpen = false;
    if (sceneContext.consolePanel) sceneContext.consolePanel.hidden = true;
    sceneContext.shell?.classList.remove('console-open');
    if (sceneContext.pointerLocked && document.pointerLockElement === sceneContext.canvas) {
      try {
        document.exitPointerLock();
      } catch {
        /* no-op */
      }
    }
    sceneContext.pointerLocked = false;
    if (sceneContext.exploring) {
      sceneContext.exploring = false;
      sceneContext.keys.clear();
      sceneContext.dragPoint = null;
      if (sceneContext.shell) {
        sceneContext.shell.classList.remove('exploring', 'pointer-locked', 'show-nav');
        sceneContext.shell.querySelector('[data-room-enter]').hidden = false;
        sceneContext.shell.querySelector('[data-room-leave]').hidden = true;
        sceneContext.shell
          .querySelector('[data-room-navigation]')
          .setAttribute('aria-expanded', 'false');
      }
      document.body.classList.remove('root-room-open');
    }
  }

  function toggleNavigation() {
    if (!sceneContext.shell) return;
    const open = !sceneContext.shell.classList.contains('show-nav');
    sceneContext.shell.classList.toggle('show-nav', open);
    sceneContext.shell
      .querySelector('[data-room-navigation]')
      .setAttribute('aria-expanded', String(open));
  }

  function canStand(x, z) {
    if (!sceneContext.assetBank)
      return (
        Math.abs(x) <= 1.82 && z >= (sceneContext.camera.userData.backLimit || -12) && z <= 5.5
      );
    if (sceneContext.facilityInterior && !sceneContext.facilityInterior.canWalk(x, z)) return false;
    for (const rack of sceneContext.rackGroups.values())
      if (Math.abs(x - rack.position.x) < 0.76 && Math.abs(z - rack.position.z) < 0.51)
        return false;
    for (const obstacle of sceneContext.facilityInterior?.colliders || [])
      if (Math.abs(x - obstacle.x) < obstacle.hx && Math.abs(z - obstacle.z) < obstacle.hz)
        return false;
    for (const obstacle of sceneContext.stationSystem?.colliders || [])
      if (Math.abs(x - obstacle.x) < obstacle.hx && Math.abs(z - obstacle.z) < obstacle.hz)
        return false;
    if (sceneContext.locationId.startsWith('room-'))
      for (const side of [-1, 1]) if (Math.abs(x - side * 3.25) < 0.68 && z < -3.8) return false;
    return true;
  }

  function movePlayer(delta) {
    if (!document.hasFocus()) sceneContext.keys.clear();
    sceneContext.keys.expire();
    if (!sceneContext.exploring || sceneContext.consoleOpen || sceneContext.keys.size === 0) return;
    const forward =
      (sceneContext.keys.has('KeyW') || sceneContext.keys.has('ArrowUp') ? 1 : 0) -
      (sceneContext.keys.has('KeyS') || sceneContext.keys.has('ArrowDown') ? 1 : 0);
    const strafe =
      (sceneContext.keys.has('KeyD') ? 1 : 0) - (sceneContext.keys.has('KeyA') ? 1 : 0);
    if (sceneContext.keys.has('ArrowLeft')) sceneContext.yaw += delta * 1.6;
    if (sceneContext.keys.has('ArrowRight')) sceneContext.yaw -= delta * 1.6;
    if (!forward && !strafe) return;
    const length = Math.hypot(forward, strafe) || 1,
      sprinting = sceneContext.keys.has('ShiftLeft') || sceneContext.keys.has('ShiftRight'),
      // Scale both paces together so Shift remains useful at the faster walking speed.
      speed = (sprinting ? 5.85 : 3.7125) * Math.max(0, Math.min(delta, 0.05));
    const dx =
      ((-Math.sin(sceneContext.yaw) * forward + Math.cos(sceneContext.yaw) * strafe) / length) *
      speed;
    const dz =
      ((-Math.cos(sceneContext.yaw) * forward - Math.sin(sceneContext.yaw) * strafe) / length) *
      speed;
    const back = sceneContext.camera.userData.backLimit || -12;
    // The rack faces form the aisle walls; this keeps the camera inside their actual clearance.
    if (sceneContext.assetBank) {
      // Faster sprinting must still sample narrow doorways and props. At most eight
      // bounded substeps per frame retain wall sliding without jumping through a jamb.
      const steps = Math.max(1, Math.ceil(speed / 0.04));
      for (let step = 0; step < steps; step++) {
        const x = sceneContext.camera.position.x + dx / steps,
          z = sceneContext.camera.position.z + dz / steps;
        if (canStand(x, sceneContext.camera.position.z)) sceneContext.camera.position.x = x;
        if (canStand(sceneContext.camera.position.x, z)) sceneContext.camera.position.z = z;
        const stair = sceneContext.facilityInterior?.stairAt(
          sceneContext.camera.position.x,
          sceneContext.camera.position.z,
        );
        sceneContext.camera.position.y =
          sceneContext.eyeHeight +
          (stair ? sceneContext.stairHeight(stair, sceneContext.camera.position.z) : 0);
        if (performance.now() > sceneContext.roomTransitionUntil) {
          const door = sceneContext.facilityInterior?.crossing(
            sceneContext.camera.position.x,
            sceneContext.camera.position.z,
          );
          if (door) {
            sceneContext.changeLocation(door.destination, sceneContext.selectedFloor, 'threshold');
            return;
          } else if (stair && sceneContext.camera.position.z < stair.endZ + 0.04) {
            sceneContext.changeLocation('hall', stair.floor, 'stairs');
            return;
          }
        }
      }
    } else {
      sceneContext.camera.position.x = sceneContext.THREE.MathUtils.clamp(
        sceneContext.camera.position.x + dx,
        -1.82,
        1.82,
      );
      sceneContext.camera.position.z = sceneContext.THREE.MathUtils.clamp(
        sceneContext.camera.position.z + dz,
        back,
        5.5,
      );
    }
  }
  return {
    startExploration,
    leave,
    isExploring,
    openConsole,
    closeConsole,
    setConsoleTitle,
    hide,
    toggleNavigation,
    canStand,
    movePlayer,
  };
}
