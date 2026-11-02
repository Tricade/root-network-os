/** Pointer Lock 2.0: relative movement and drag movement never share a gesture.
 * The document is authoritative: lock events can arrive after a console opens.
 */
export function createRoomPointer(ctx, doc = globalThis.document) {
  let requestId = 0;
  const locked = () => Boolean(ctx.canvas && doc.pointerLockElement === ctx.canvas);
  const active = () =>
    ctx.exploring &&
    !ctx.consoleOpen &&
    !ctx.hidden &&
    ctx.mounted &&
    !doc.querySelector?.('#modal-root .modal');

  function resetDrag() {
    const id = ctx.dragPoint?.id;
    ctx.dragPoint = null;
    if (id !== undefined && ctx.canvas?.hasPointerCapture?.(id))
      ctx.canvas.releasePointerCapture(id);
  }

  function updatePointerUI(error = false) {
    ctx.pointerLocked = locked();
    ctx.shell?.classList.toggle('pointer-locked', ctx.pointerLocked);
    const button = ctx.shell?.querySelector('[data-room-pointer]');
    if (button) {
      button.hidden = !ctx.exploring || ctx.consoleOpen;
      button.textContent = ctx.tr(ctx.pointerLocked ? 'Maus freigeben · Esc' : 'Maus fangen');
      button.setAttribute('aria-pressed', String(ctx.pointerLocked));
    }
    const help = ctx.shell?.querySelector('[data-room-mouse-help]');
    if (help) {
      help.textContent = ctx.tr(
        error
          ? 'Maus konnte nicht gefangen werden. Ziehen zum Umsehen.'
          : ctx.pointerLocked
            ? 'Maus: Umsehen · Esc: Maus freigeben'
            : 'Maus ziehen / ← → drehen',
      );
    }
  }

  function releasePointer() {
    requestId++;
    ctx.keys.clear();
    resetDrag();
    ctx.dragMoved = false;
    if (locked()) doc.exitPointerLock();
    updatePointerUI();
  }

  function onPointerLockChange() {
    // Always discard the absolute coordinates, including when acquiring a lock.
    resetDrag();
    ctx.dragMoved = false;
    ctx.keys.clear();
    if (locked() && !active()) {
      releasePointer();
      return;
    }
    updatePointerUI();
  }

  function onPointerLockError() {
    resetDrag();
    if (active() && !locked()) updatePointerUI(true);
  }

  function capturePointer() {
    if (!active() || locked()) return;
    resetDrag();
    ctx.dragMoved = false;
    ctx.keys.clear();
    const id = ++requestId;
    const failed = () => {
      if (id === requestId) onPointerLockError();
    };
    try {
      ctx.canvas.focus({ preventScroll: true });
      if (!ctx.canvas.requestPointerLock) return failed();
      const request = ctx.canvas.requestPointerLock();
      request?.then?.(() => {
        if (id !== requestId && locked()) doc.exitPointerLock();
      }, failed);
    } catch {
      failed();
    }
  }

  function onPointerDown(event) {
    if (!active() || locked() || event.button !== 0 || event.isPrimary === false) return;
    ctx.dragPoint = { id: event.pointerId, x: event.clientX, y: event.clientY };
    ctx.dragMoved = false;
    ctx.canvas.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!active() || locked()) return resetDrag();
    const previous = ctx.dragPoint;
    if (!previous || previous.id !== event.pointerId) return;
    // Some embedded browsers lose pointerup on focus/capture changes.
    if (!(event.buttons & 1)) return resetDrag();
    const dx = event.clientX - previous.x,
      dy = event.clientY - previous.y;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return resetDrag();
    if (Math.abs(dx) + Math.abs(dy) > 2) ctx.dragMoved = true;
    ctx.dragPoint = { id: event.pointerId, x: event.clientX, y: event.clientY };
    ctx.rotateCamera(dx * 0.004, dy * 0.004);
  }

  function onLockedMouseMove(event) {
    if (!active() || !locked()) return;
    const dx = event.movementX,
      dy = event.movementY;
    if (Number.isFinite(dx) && Number.isFinite(dy)) ctx.rotateCamera(dx * 0.0024, dy * 0.0024);
  }

  function onPointerUp(event) {
    if (!event || event.pointerId === ctx.dragPoint?.id) resetDrag();
    // Keep dragMoved until the resulting click, or the next pointerdown. A timer
    // could clear a newer gesture and accidentally activate hardware after drag.
  }

  return {
    capturePointer,
    releasePointer,
    updatePointerUI,
    onPointerLockChange,
    onPointerLockError,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onLockedMouseMove,
  };
}
