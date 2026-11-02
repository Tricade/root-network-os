/** 3D input. The per-view context owns scene resources and mutable interaction state. */
export function createMovementKeys(now = () => performance.now()) {
  const held = new Set();
  let lastSignal = 0,
    repeating = false;
  return {
    press(code, repeat = false) {
      if (repeat && !held.has(code)) return;
      held.add(code);
      lastSignal = now();
      repeating = repeat;
    },
    delete(code) {
      held.delete(code);
    },
    has(code) {
      return held.has(code);
    },
    get size() {
      return held.size;
    },
    clear() {
      held.clear();
      repeating = false;
    },
    expire() {
      if (held.size && now() - lastSignal > (repeating ? 450 : 1500)) this.clear();
    },
  };
}

export function rackInteraction(cabinet, hitDoor = false) {
  if (!cabinet) return 'hardware';
  if (!cabinet.doorOpen) return 'open-door';
  if (hitDoor) return 'close-door';
  if (cabinet.doors.some((door) => Math.abs(door.rotation.y) < 1.1)) return 'opening';
  return 'hardware';
}
export function createRoomInput(sceneContext) {
  function bindCanvas() {
    sceneContext.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      sceneContext.stopAnimation();
      sceneContext.leave();
      sceneContext.showFallback(new Error('Grafikkontext unterbrochen'));
    });
    sceneContext.canvas.addEventListener('webglcontextrestored', () => {
      sceneContext.fallback.hidden = true;
      sceneContext.stage.classList.remove('root-room-no-webgl');
      sceneContext.syncAnimation();
    });
    sceneContext.canvas.addEventListener('click', onCanvasClick);
    sceneContext.canvas.addEventListener('pointerdown', onPointerDown);
    sceneContext.canvas.addEventListener('pointermove', onPointerMove);
    sceneContext.canvas.addEventListener('pointerup', onPointerUp);
    sceneContext.canvas.addEventListener('pointercancel', () => {
      sceneContext.keys.clear();
      onPointerUp();
    });
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mousemove', onLockedMouseMove);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('pagehide', () => {
      sceneContext.saveRoomSession();
      onWindowBlur();
    });
    window.addEventListener('focus', () => sceneContext.keys.clear());
    document.addEventListener('focusin', (event) => {
      if (event.target !== sceneContext.canvas) sceneContext.keys.clear();
    });
    document.addEventListener(
      'pointerdown',
      (event) => {
        if (event.target !== sceneContext.canvas) sceneContext.keys.clear();
      },
      true,
    );
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('resize', sceneContext.sizeRenderer);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    motion.addEventListener?.('change', (event) => {
      sceneContext.isReducedMotion = event.matches;
    });
    sceneContext.resizeObserver = new ResizeObserver(sceneContext.sizeRenderer);
    sceneContext.visibilityObserver = new IntersectionObserver((entries) => {
      sceneContext.inViewport = entries[0]?.isIntersecting !== false;
      if (sceneContext.inViewport || sceneContext.exploring || sceneContext.arrival)
        sceneContext.syncAnimation();
      else sceneContext.stopAnimation();
    });
    sceneContext.visibilityObserver.observe(sceneContext.stage);
  }

  function onCanvasClick(event) {
    if (sceneContext.consoleOpen) return;
    if (sceneContext.dragMoved) {
      sceneContext.dragMoved = false;
      return;
    }
    if (!sceneContext.canvas) return;
    if (sceneContext.pointerLocked) sceneContext.mouse.set(0, 0);
    else {
      const rect = sceneContext.canvas.getBoundingClientRect();
      sceneContext.mouse.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
    }
    sceneContext.raycaster.setFromCamera(sceneContext.mouse, sceneContext.camera);
    const hit = sceneContext.raycaster
      .intersectObjects(
        [
          ...sceneContext.pickTargets,
          ...(sceneContext.facilityInterior?.picks || []),
          ...(sceneContext.stationSystem?.pickTargets || []),
        ],
        false,
      )
      .find((item) => {
        if (sceneContext.exploring && item.distance > 4.5) return false;
        let n = item.object;
        while (n && !n.userData.roomKind) n = n.parent;
        return Boolean(n);
      });
    if (!hit) return;
    let node = hit.object;
    while (node && !node.userData.roomKind) node = node.parent;
    if (node.userData.roomKind === 'station') {
      sceneContext.activateStation(node.userData);
      return;
    }
    if (node.userData.roomKind === 'portal') {
      sceneContext.facilityInterior?.togglePortal(node.userData.portal);
      return;
    }
    if (node.userData.roomKind === 'door') {
      toggleRackDoor(node.userData.rackId);
      return;
    }
    activateTarget(
      node.userData.rackId,
      node.userData.roomKind === 'server' ? node.userData.serverId : null,
    );
  }

  function activateTarget(rackId, serverId) {
    if (!rackId) return;
    const action = sceneContext.rackInteraction(sceneContext.rackRefs.get(rackId)?.cabinet);
    if (action === 'open-door') {
      toggleRackDoor(rackId);
      return;
    }
    if (action === 'opening') return;
    if (serverId && sceneContext.openServer) sceneContext.openServer(rackId, serverId);
    else if (sceneContext.openRack) sceneContext.openRack(rackId);
  }

  function toggleRackDoor(rackId) {
    const ref = sceneContext.rackRefs.get(
      typeof rackId === 'string' ? rackId : sceneContext.targetRack,
    );
    if (!ref?.asset) return;
    ref.cabinet.doorOpen = !ref.cabinet.doorOpen;
    sceneContext.updateNavigationTelemetry(sceneContext.currentRacks);
  }

  function onPointerDown(event) {
    if (!sceneContext.exploring || sceneContext.consoleOpen || sceneContext.pointerLocked) return;
    sceneContext.dragPoint = { x: event.clientX, y: event.clientY };
    sceneContext.dragMoved = false;
    sceneContext.canvas.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!sceneContext.exploring || sceneContext.pointerLocked || !sceneContext.dragPoint) return;
    const dx = event.clientX - sceneContext.dragPoint.x,
      dy = event.clientY - sceneContext.dragPoint.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) sceneContext.dragMoved = true;
    sceneContext.dragPoint = { x: event.clientX, y: event.clientY };
    rotateCamera(dx * 0.004, dy * 0.004);
  }

  function onLockedMouseMove(event) {
    if (sceneContext.exploring && !sceneContext.consoleOpen && sceneContext.pointerLocked)
      rotateCamera((event.movementX || 0) * 0.0024, (event.movementY || 0) * 0.0024);
  }

  function onPointerUp() {
    sceneContext.dragPoint = null;
    setTimeout(() => {
      sceneContext.dragMoved = false;
    }, 40);
  }

  function onPointerLockChange() {
    const locked = document.pointerLockElement === sceneContext.canvas;
    if (
      locked &&
      (!sceneContext.exploring ||
        sceneContext.consoleOpen ||
        sceneContext.hidden ||
        !sceneContext.mounted)
    ) {
      document.exitPointerLock();
      sceneContext.pointerLocked = false;
      return;
    }
    if (locked === sceneContext.pointerLocked) return;
    sceneContext.pointerLocked = locked;
    if (sceneContext.shell) {
      sceneContext.shell.classList.toggle('pointer-locked', sceneContext.pointerLocked);
      sceneContext.shell.querySelector('[data-room-mouse-help]').innerHTML =
        sceneContext.pointerLocked
          ? '<kbd>Maus</kbd> Umsehen · Esc zurück'
          : '<kbd>Maus</kbd> Ziehen / ← → drehen';
    }
    // Pointer Lock 2.0 also releases on focus loss. Keep DOM controls reachable.
    if (!locked) {
      sceneContext.keys.clear();
      sceneContext.dragPoint = null;
    }
  }

  function rotateCamera(dx, dy) {
    sceneContext.yaw -= dx;
    sceneContext.pitch = sceneContext.THREE.MathUtils.clamp(sceneContext.pitch - dy, -1.15, 1.15);
    applyCameraRotation();
  }

  function applyCameraRotation() {
    if (sceneContext.camera)
      sceneContext.camera.rotation.set(sceneContext.pitch, sceneContext.yaw, 0, 'YXZ');
  }

  function onKeyDown(event) {
    if (sceneContext.arrival) {
      if (event.code === 'Escape') {
        event.preventDefault();
        sceneContext.finishArrival();
      }
      return;
    }
    if (document.querySelector('#modal-root .modal')) return;
    if (sceneContext.exploring && sceneContext.consoleOpen) {
      if (event.code === 'Escape') {
        event.preventDefault();
        sceneContext.closeConsole();
      }
      if (event.code === 'Tab') {
        const controls = [
          ...sceneContext.consolePanel.querySelectorAll(
            'button:not(:disabled),input,select,[tabindex="0"]',
          ),
        ].filter((el) => el.getClientRects().length);
        const first = controls[0],
          last = controls.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === sceneContext.consoleContent)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !sceneContext.consolePanel.contains(document.activeElement))
        ) {
          event.preventDefault();
          first?.focus();
        }
      }
      return;
    }
    if (!sceneContext.exploring || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
    if (
      [
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'ArrowUp',
        'ArrowLeft',
        'ArrowDown',
        'ArrowRight',
        'KeyE',
        'Escape',
      ].includes(event.code)
    )
      event.preventDefault();
    sceneContext.keys.press(event.code, event.repeat);
    if (event.code === 'Escape') sceneContext.leave();
    if (event.code === 'KeyE' && !event.repeat) {
      if (sceneContext.targetStation) sceneContext.activateStation(sceneContext.targetStation);
      else if (sceneContext.targetPortal)
        sceneContext.facilityInterior?.togglePortal(sceneContext.targetPortal.portal);
      else if (sceneContext.targetDoor) toggleRackDoor();
      else activateTarget(sceneContext.targetRack, sceneContext.targetServer);
    }
  }

  function onKeyUp(event) {
    sceneContext.keys.delete(event.code);
  }

  function onVisibilityChange() {
    if (document.hidden) {
      sceneContext.saveRoomSession();
      sceneContext.stopAnimation();
      sceneContext.keys.clear();
      sceneContext.dragPoint = null;
    } else if (sceneContext.mounted && !sceneContext.hidden) sceneContext.syncAnimation();
  }

  function onWindowBlur() {
    sceneContext.keys.clear();
    sceneContext.dragPoint = null;
    if (document.pointerLockElement === sceneContext.canvas) document.exitPointerLock();
  }
  return {
    bindCanvas,
    onCanvasClick,
    activateTarget,
    toggleRackDoor,
    onPointerDown,
    onPointerMove,
    onLockedMouseMove,
    onPointerUp,
    onPointerLockChange,
    rotateCamera,
    applyCameraRotation,
    onKeyDown,
    onKeyUp,
    onVisibilityChange,
    onWindowBlur,
  };
}
