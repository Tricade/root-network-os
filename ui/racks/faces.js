/** Rack faces: shared selection is owned by rack-ui.js. */
export function createRackFaces(ctx) {
  function button(action, payload, label, cls = '', confirm = false) {
    const q = ctx.E.quoteHardware(ctx.state(), action, payload);
    return `<button class="button ${cls}" data-hw-action="${action}" data-hw-payload="${ctx.esc(JSON.stringify(payload))}" ${confirm ? 'data-hw-confirm="true"' : ''} ${q.enabled ? '' : 'disabled'} title="${ctx.esc(q.reason || '')}">${label || ctx.esc(q.label)}</button>`;
  }

  function led(type, on = false, phase = 0) {
    return `<i class="rack-led ${type} ${on ? 'lit' : ''}" style="--led-phase:-${phase}s" aria-hidden="true"></i>`;
  }

  function meter(key, value, label, tone = '') {
    return `<div class="rack-meter"><div><span>${label}</span>${ctx.live(key + 'Text')}</div><div class="rack-meter-track"><i class="${tone}" data-hw-meter="${ctx.esc(key)}" style="width:${Math.min(100, value)}%"></i></div></div>`;
  }

  function driveBays(s) {
    return `<div class="drive-bank bays-${s.driveBays}">${Array.from({ length: s.driveBays }, (_, i) => `<span class="drive-bay"><span class="drive-latch"></span><span class="drive-slot"></span><i class="rack-led traffic" data-drive-led="${s.id}" style="--led-phase:-${(i * 0.37 + s.port * 0.23).toFixed(2)}s"></i><small>${String(i + 1).padStart(2, '0')}</small></span>`).join('')}</div>`;
  }

  function serverFace(s) {
    const row = 19 - s.unit - s.units + 1;
    return `<button class="rack-device server-face server-${s.type} height-${s.units} ${ctx.selected.kind === 'server' && ctx.selected.id === s.id ? 'selected' : ''}" style="grid-row:${row}/span ${s.units}" data-rack-command="server" data-id="${s.id}" data-rack-device="${s.id}" aria-label="${ctx.esc(ctx.serverName(s))}, ${ctx.esc(s.model)}, ${s.units} Höheneinheiten, ${ctx.names[s.status]}"><span class="rack-ear left"><i></i><i></i></span><span class="rack-ear right"><i></i><i></i></span><span class="device-front"><span class="server-brand"><b>ROOT</b><span>${ctx.esc(s.model)}</span></span><span class="server-face-label"><strong>${ctx.esc(ctx.serverName(s))}</strong><small>${s.cores}C · ${s.ramGB} GB · ${s.storageTB} TB</small></span><span class="server-grille"></span>${driveBays(s)}<span class="server-lights"><i class="rack-led power" data-power-led="${s.id}"></i><i class="rack-led traffic" data-activity-led="${s.id}" style="--led-phase:-${s.port * 0.31}s"></i><i class="rack-led fault" data-fault-led="${s.id}"></i><i class="rack-led identify ${ctx.identify && ctx.selected.id === s.id ? 'lit' : ''}"></i></span><span class="server-power-symbol">⏻</span></span><span class="device-back"><span class="rear-fans"><i></i><i></i></span><span class="rear-serial">${ctx.esc(s.model)}<small>${ctx.esc(ctx.serverName(s))}</small></span><span class="rear-nic"><span></span><small>ETH ${s.port}</small></span><span class="rear-psu"><span></span><small>PSU</small></span></span></button>`;
  }

  function switchFace(r) {
    return `<div class="rack-device switch-face" style="grid-row:1" data-switch-device="${r.id}"><span class="rack-ear left"><i></i><i></i></span><span class="rack-ear right"><i></i><i></i></span><button class="switch-model" data-rack-command="component" data-component="switch" data-rack-id="${r.id}" aria-label="Switch in ${ctx.esc(r.name)} verwalten"><b>ROOT</b><span>SW-${String(r.ports.length).padStart(2, '0')} / L${r.switchLevel}</span></button><div class="switch-port-bank" style="--port-count:${r.ports.length}">${r.ports.map((p) => `<button class="switch-port ${ctx.selected.kind === 'port' && ctx.selected.id === String(p.number) ? 'selected' : ''}" data-rack-command="port" data-rack-id="${r.id}" data-port="${p.number}" data-switch-port="${r.id}:${p.number}" aria-label="Port ${p.number}${p.serverId ? ', ' + ctx.esc(r.servers.find((s) => s.id === p.serverId)?.name) : ', frei'}"><span class="port-socket"><i></i><i></i><i></i><i></i></span><span class="port-leds">${led('power', p.link)}${led('traffic', p.trafficMbps > 0, p.number * 0.21)}</span><small>${p.number}</small></button>`).join('')}</div><button class="switch-uplink" data-rack-command="component" data-component="switch" data-rack-id="${r.id}" aria-label="Uplink ${ctx.speed(r.uplinkMbps)}"><i></i><span>UPLINK</span></button></div>`;
  }

  function cabinet(r) {
    const occupied = new Set([1, 18]);
    for (const s of r.servers) for (let u = s.unit; u < s.unit + s.units; u++) occupied.add(u);
    return `<section class="rack-cabinet ${ctx.mode === 'wiring' ? 'wiring-mode' : ''} ${r.status === 'maintenance' ? 'under-maintenance' : ''}"><div class="cabinet-crown"><div><span class="cabinet-id">ROOT / 19″ CABINET</span><strong>${ctx.esc(r.name)}</strong></div><button class="cabinet-cooling" data-rack-command="component" data-component="cooling" data-rack-id="${r.id}" aria-label="Kühlung von ${ctx.esc(r.name)} verwalten"><span class="cooling-grille"></span>${ctx.icon('heat')}${ctx.live(ctx.rackKey(r.id, 'temperature'), '', 'mono')}</button></div><div class="rack-rail-area"><div class="rack-unit-ruler">${Array.from({ length: 18 }, (_, i) => `<span>${String(18 - i).padStart(2, '0')}</span>`).join('')}</div><div class="rack-interior">${switchFace(r)}${r.servers.map(serverFace).join('')}${Array.from(
      { length: 16 },
      (_, i) => i + 2,
    )
      .filter((u) => !occupied.has(u))
      .map(
        (u) =>
          `<button class="rack-empty-slot" style="grid-row:${19 - u}" data-rack-command="add-server" data-rack-id="${r.id}" data-unit="${u}" aria-label="Server in ${ctx.esc(r.name)} ab U${u} einbauen"><span>+</span><small>FREIER EINBAUPLATZ</small></button>`,
      )
      .join(
        '',
      )}<button class="rack-device pdu-face" style="grid-row:18" data-rack-command="component" data-component="power" data-rack-id="${r.id}" aria-label="Stromversorgung von ${ctx.esc(r.name)} verwalten"><span class="rack-ear left"><i></i><i></i></span><span class="pdu-brand">ROOT <small>PDU</small></span><span class="pdu-outlets">${Array.from({ length: 16 }, (_, i) => `<i data-pdu-socket="${r.id}:${i + 1}" class="${r.servers.find((s) => s.unit - 1 === i + 1)?.powered ? 'active' : ''}" title="Abgang ${i + 1}"></i>`).join('')}</span><span class="pdu-display">${ctx.live(ctx.rackKey(r.id, 'power'), '', 'mono')}</span>${led('power', true)}</button></div>${ctx.cables(r)}<div class="rack-bolt-rail">${Array.from({ length: 18 }, () => '<i></i>').join('')}</div></div><div class="cabinet-base"><span>19″ · 18 HE</span><span>${ctx.live(ctx.rackKey(r.id, 'occupancy'))}</span><button data-rack-command="rack" data-rack-id="${r.id}">Rack verwalten ${ctx.icon('arrow')}</button></div></section>`;
  }

  function telemetry(r) {
    return `<section class="rack-telemetry"><div class="rack-telemetry-head"><h3>Versorgung & Verbindung</h3><span class="tag" data-rack-status="${r.id}">${ctx.names[r.status]}</span></div>${meter(ctx.rackKey(r.id, 'powerMeter'), (r.powerW / r.powerCapacityW) * 100, 'Strombudget')}${meter(ctx.rackKey(r.id, 'coolingMeter'), (r.powerW / r.coolingW) * 100, 'Kühlbudget', 'blue')}${meter(ctx.rackKey(r.id, 'networkMeter'), (r.networkDemandMbps / r.uplinkMbps) * 100, 'Uplink', 'amber')}<div class="rack-live-warnings" data-rack-warnings="${r.id}">${r.warnings.map(ctx.esc).join(' · ')}</div></section>`;
  }

  function specRow(label, value) {
    return `<div class="hardware-spec"><span>${label}</span><strong>${value}</strong></div>`;
  }
  return { button, led, meter, driveBays, serverFace, switchFace, cabinet, telemetry, specRow };
}
