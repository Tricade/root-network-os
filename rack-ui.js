import { createRackFaces } from './ui/racks/faces.js';
import { createRackWiring } from './ui/racks/wiring.js';
import { createRackInspector } from './ui/racks/inspector.js';
import { createRackView } from './ui/racks/view.js';
import { createRackTelemetry } from './ui/racks/telemetry.js';
const names = {
  online: 'Online',
  failed: 'Defekt',
  repairing: 'In Reparatur',
  standby: 'Ausgeschaltet',
  booting: 'Startet',
  disconnected: 'Kein Link',
  maintenance: 'Wartungsfenster',
  limited: 'Begrenzt',
};
const componentNames = {
  switch: 'Switch & Uplink',
  power: 'Stromversorgung',
  cooling: 'Kühlung',
};

/** Rack selection and commands. Empty rooms deliberately keep their own selection. */
export function createRacks(services) {
  const {
    E,
    icon,
    esc,
    fmt,
    dec,
    duration,
    getState,
    tr = (value) => globalThis.ROOTI18N?.translate(String(value)) || String(value),
  } = services;
  let selectedRoom = null,
    selectedRack = null,
    selected = { kind: 'server', id: null },
    mode = 'front',
    wireLayer = 'network',
    identify = false,
    moveDraft = null;
  const state = () => getState(),
    model = () => E.getRackModel(state());
  const watts = (n) => (n >= 1000 ? dec(n / 1000) + ' kW' : fmt(n) + ' W');
  const speed = (n) => (n >= 1000 ? dec(n / 1000) + ' Gb/s' : fmt(n) + ' Mb/s');
  const live = (key, value = '', cls = '') =>
    `<span class="${cls}" data-hw-stat="${esc(key)}">${esc(value)}</span>`;
  const rackKey = (id, key) => 'rack:' + id + ':' + key;
  const nodeKey = (id, key) => 'node:' + id + ':' + key;
  const getRoom = (layout = E.getFacilityLayout(state())) =>
    layout.rooms.find((room) => room.id === selectedRoom) ||
    layout.rooms.find((room) => room.rackIds.includes(selectedRack)) ||
    layout.rooms[0];
  const getRack = (m, room = getRoom()) =>
    m.racks.find((rack) => rack.id === selectedRack && room.rackIds.includes(rack.id)) ||
    m.racks.find((rack) => room.rackIds.includes(rack.id));
  const allServers = (m) => m.racks.flatMap((r) => r.servers);

  const ctx = {
    serverName: (server) => globalThis.ROOTI18N?.serverName(server) || server.name,
    tr,
    get E() {
      return E;
    },
    get allServers() {
      return allServers;
    },
    get componentNames() {
      return componentNames;
    },
    get current() {
      return current;
    },
    get dec() {
      return dec;
    },
    get duration() {
      return duration;
    },
    get esc() {
      return esc;
    },
    get fmt() {
      return fmt;
    },
    get getRack() {
      return getRack;
    },
    get icon() {
      return icon;
    },
    get identify() {
      return identify;
    },
    set identify(value) {
      identify = value;
    },
    get live() {
      return live;
    },
    get mode() {
      return mode;
    },
    set mode(value) {
      mode = value;
    },
    get model() {
      return model;
    },
    get moveDraft() {
      return moveDraft;
    },
    set moveDraft(value) {
      moveDraft = value;
    },
    get names() {
      return names;
    },
    get nodeKey() {
      return nodeKey;
    },
    get rackKey() {
      return rackKey;
    },
    get selected() {
      return selected;
    },
    set selected(value) {
      selected = value;
    },
    get speed() {
      return speed;
    },
    get state() {
      return state;
    },
    get watts() {
      return watts;
    },
    get wireLayer() {
      return wireLayer;
    },
    set wireLayer(value) {
      wireLayer = value;
    },
  };
  Object.assign(ctx, createRackFaces(ctx));
  Object.assign(ctx, createRackWiring(ctx));
  Object.assign(ctx, createRackInspector(ctx));
  Object.assign(ctx, createRackView(ctx));
  Object.assign(ctx, createRackTelemetry(ctx));
  function current() {
    const m = model(),
      layout = E.getFacilityLayout(state()),
      room = getRoom(layout),
      rack = getRack(m, room);
    selectedRoom = room.id;
    selectedRack = rack?.id || null;
    if (selected.kind === 'server' && !rack?.servers.some((server) => server.id === selected.id))
      selected = { kind: 'rack', id: selectedRack };
    return { m, rack, room, layout };
  }

  function click(t) {
    if (t.dataset.hwAction) {
      let payload;
      try {
        payload = JSON.parse(t.dataset.hwPayload || '{}');
      } catch {
        return {};
      }
      return t.dataset.hwConfirm
        ? { modal: 'hardware-confirm', extra: { action: t.dataset.hwAction, payload } }
        : { action: t.dataset.hwAction, payload };
    }
    const cmd = t.dataset.rackCommand;
    if (!cmd) return null;
    if (cmd === 'front' || cmd === 'wiring') {
      mode = cmd;
      return { render: true };
    }
    if (cmd === 'wire-network' || cmd === 'wire-power') {
      wireLayer = cmd === 'wire-power' ? 'power' : 'network';
      return { render: true };
    }
    if (cmd === 'identify') {
      identify = !identify;
      return { render: true };
    }
    if (cmd === 'server') {
      const m = model(),
        r = m.racks.find((x) => x.servers.some((s) => s.id === t.dataset.id));
      if (r) select(r.id, t.dataset.id);
      selected = { kind: 'server', id: t.dataset.id };
      identify = false;
      return { render: true };
    }
    if (cmd === 'rack-select' || cmd === 'rack') {
      select(t.dataset.rackId);
      identify = false;
      return { render: true };
    }
    if (cmd === 'port') {
      select(t.dataset.rackId);
      selected = { kind: 'port', id: t.dataset.port };
      return { render: true };
    }
    if (cmd === 'component') {
      select(t.dataset.rackId);
      selected = { kind: t.dataset.component, id: selectedRack };
      return { render: true };
    }
    if (cmd === 'add-server')
      return {
        modal: 'hardware-shop',
        extra: {
          rackId: t.dataset.rackId || selectedRack,
          unit: t.dataset.unit ? Number(t.dataset.unit) : undefined,
        },
      };
    if (cmd === 'move') {
      moveDraft = null;
      return { modal: 'hardware-move', extra: { id: t.dataset.id } };
    }
    return null;
  }
  function change(el) {
    if (el.dataset.rackChange === 'room') {
      const room = E.getFacilityLayout(state()).rooms.find((r) => r.id === el.value);
      if (room) {
        selectRoom(room.id);
        return { render: true };
      }
    }
    if (!el.dataset.rackChange || !moveDraft) return null;
    const kind = el.dataset.rackChange;
    if (kind === 'move-rack') {
      moveDraft.rackId = el.value;
      const r = model().racks.find((x) => x.id === el.value);
      moveDraft.port = r.ports.find((p) => !p.serverId || p.serverId === moveDraft.id)?.number || 1;
      return { refreshModal: true };
    }
    if (kind === 'move-unit') moveDraft.unit = Number(el.value);
    if (kind === 'move-port') moveDraft.port = Number(el.value);
    document
      .querySelectorAll('[data-hw-action="moveServer"]')
      .forEach((b) => (b.dataset.hwPayload = JSON.stringify(moveDraft)));
    ctx.updateLive();
    return {};
  }
  function signature() {
    const m = model();
    return [
      m.operation?.kind,
      m.operation?.rackId,
      ...m.racks.map((r) =>
        [
          r.id,
          r.switchLevel,
          r.powerLevel,
          r.coolingLevel,
          r.status === 'maintenance',
          r.ports.map((p) => p.enabled),
          r.servers.map((s) => [s.id, s.level, s.unit, s.port, s.status, s.powered]),
        ].join(':'),
      ),
    ].join('|');
  }

  globalThis.addEventListener?.('resize', () => {
    if (mode === 'wiring') requestAnimationFrame(() => ctx.drawCables(model()));
  });
  function serverStatus(id, fallback) {
    return allServers(model()).find((s) => s.id === id)?.status || fallback;
  }
  function select(rackId, serverId) {
    const layout = E.getFacilityLayout(state()),
      room = layout.rooms.find((item) => item.rackIds.includes(rackId));
    if (
      !room ||
      (serverId &&
        !state().servers.some((server) => server.id === serverId && server.rackId === rackId))
    )
      return false;
    selectedRoom = room.id;
    selectedRack = rackId;
    selected = { kind: serverId ? 'server' : 'rack', id: serverId || rackId };
    identify = false;
    return true;
  }
  function selectRoom(roomId) {
    const room = E.getFacilityLayout(state()).rooms.find((item) => item.id === roomId);
    if (!room) return false;
    selectedRoom = room.id;
    selectedRack = room.rackIds[0] || null;
    selected = { kind: 'rack', id: selectedRack };
    identify = false;
    return true;
  }
  return {
    view: ctx.view,
    modal: ctx.modal,
    shop: ctx.shop,
    click,
    change,
    signature,
    updateLive: ctx.updateLive,
    serverStatus,
    select,
    selectRoom,
    statusNames: names,
  };
}
if (typeof window !== 'undefined') window.RootRacks = { create: createRacks };
