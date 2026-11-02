/** Rack inspector: shared selection is owned by rack-ui.js. */
export function createRackInspector(ctx) {
  function componentInspector(r, kind) {
    const q = r.upgrades[kind];
    return `<div class="hardware-inspector-icon">${ctx.icon(kind === 'switch' ? 'globe' : kind === 'power' ? 'automation' : 'heat')}</div><div class="eyebrow">${ctx.esc(r.name)} / AUSSTATTUNG</div><h2>${ctx.componentNames[kind]}</h2><p class="hardware-description">${kind === 'switch' ? 'Alle Server dieses Racks teilen sich den Uplink. Ein abgeschalteter Port trennt den zugeordneten Server vom Netz.' : kind === 'power' ? 'Die Stromversorgung begrenzt die gemeinsame Leistung im Rack. Zusätzliche Reserve hilft bei Ausbau und Leistungsprofilen.' : 'Die Kühlleistung bestimmt, wie viel Wärme das Rack abführen kann. Zu hohe Temperaturen drosseln die Leistung und erhöhen den Verschleiß.'}</p><div class="hardware-specs">${kind === 'switch' ? ctx.specRow('Switch-Stufe', r.switchLevel) + ctx.specRow('Anschlüsse', r.ports.length + ' Ports') + ctx.specRow('Uplink', ctx.live(ctx.rackKey(r.id, 'uplink'))) + ctx.specRow('Angeforderter Verkehr', ctx.live(ctx.rackKey(r.id, 'networkDemand'))) : kind === 'power' ? ctx.specRow('Versorgungsstufe', r.powerLevel) + ctx.specRow('Leistungsbudget', ctx.watts(r.powerCapacityW)) + ctx.specRow('Aktuelle Aufnahme', ctx.live(ctx.rackKey(r.id, 'power'))) : ctx.specRow('Kühlstufe', r.coolingLevel) + ctx.specRow('Kühlleistung', ctx.watts(r.coolingW)) + ctx.specRow('Rack-Luft', ctx.live(ctx.rackKey(r.id, 'temperature'))) + ctx.specRow('Verlauf', ctx.live(ctx.rackKey(r.id, 'thermalTrend')))}</div><div class="hardware-quote"><p>${ctx.esc(q.description)}</p><div class="hardware-price">${ctx.fmt(q.cost)} CR · ${ctx.duration(q.duration)}</div>${ctx.button('upgradeRack', { rackId: r.id, component: kind }, `${ctx.icon('plus')}Ausbau prüfen`, 'primary block', true)}<small data-hw-reason>${ctx.esc(q.reason)}</small></div><p class="hardware-note">Während des Umbaus ist das gesamte Rack vorübergehend nicht verfügbar. Bestehende Defekte bleiben erhalten.${kind === 'cooling' ? ' Die Luft im Rack kühlt allmählich ab; Restwärme bleibt auch bei abgeschalteten Servern erhalten.' : ''}</p>`;
  }

  function portInspector(r) {
    const p = r.ports.find((x) => x.number === Number(ctx.selected.id));
    if (!p) return componentInspector(r, 'switch');
    const s = r.servers.find((x) => x.id === p.serverId);
    return `<div class="hardware-inspector-icon">${ctx.icon('globe')}</div><div class="eyebrow">${ctx.esc(r.name)} / SWITCH</div><h2>Port ${String(p.number).padStart(2, '0')}</h2><span class="tag ${p.link ? 'green' : 'amber'}" data-port-status="${r.id}:${p.number}">${p.link ? 'LINK AKTIV' : p.enabled ? 'KEIN LINK' : 'DEAKTIVIERT'}</span><div class="hardware-specs">${ctx.specRow('Verbundenes Gerät', s ? ctx.esc(ctx.serverName(s)) : 'Nicht belegt')}${ctx.specRow('Portgeschwindigkeit', ctx.speed(p.speedMbps))}${ctx.specRow('Verkehr', ctx.live('port:' + r.id + ':' + p.number + ':traffic'))}</div><p class="hardware-description">${s ? 'Das Trennen dieses Anschlusses nimmt ' + ctx.esc(ctx.serverName(s)) + ' aus dem Netzwerk. Der Server bleibt eingeschaltet und benötigt weiterhin Strom.' : 'Dieser Anschluss ist frei. Beim Einbau oder Umsetzen kannst du ihm einen Server zuordnen.'}</p>${ctx.button('setSwitchPort', { rackId: r.id, port: p.number, enabled: !p.enabled }, ctx.icon(p.enabled ? 'cross' : 'check') + (p.enabled ? 'Port deaktivieren' : 'Port aktivieren'), (p.enabled ? 'ghost' : 'primary') + ' block', true)}${s ? `<button class="button block section-spacer" data-rack-command="server" data-id="${s.id}">${ctx.icon('server')}Server ansehen</button>` : ''}<button class="text-button section-spacer" data-rack-command="component" data-component="switch" data-rack-id="${r.id}">Switch verwalten${ctx.icon('arrow')}</button>`;
  }

  function serverInspector(r, s) {
    return `<div class="hardware-inspector-top"><div class="hardware-inspector-icon">${ctx.icon(s.type === 'storage' ? 'storage' : s.type === 'compute' ? 'cpu' : 'server')}</div><button class="button small ${ctx.identify ? 'active' : ''}" data-rack-command="identify" aria-pressed="${ctx.identify}" title="Blaue Positions-LED markieren">${ctx.icon('spark')}UID</button></div><div class="eyebrow">${ctx.esc(r.name)} / U${String(s.unit).padStart(2, '0')}${s.units > 1 ? '–U' + String(s.unit + s.units - 1).padStart(2, '0') : ''}</div><h2>${ctx.esc(ctx.serverName(s))}</h2><p class="hardware-model">${ctx.esc(s.model)} · ${s.units} HE · Stufe ${s.level}</p><span class="tag" data-device-status="${s.id}">${ctx.names[s.status]}</span><div class="hardware-specs">${ctx.specRow('Prozessor', s.cores + ' Kerne')}${ctx.specRow('Arbeitsspeicher', ctx.fmt(s.ramGB) + ' GB ECC') + (s.gpuCount ? ctx.specRow('Beschleuniger', s.gpuCount + ' GPUs · ' + s.vramGB + ' GB VRAM') + ctx.specRow('GPU belegt / nutzbar', ctx.live(ctx.nodeKey(s.id, 'gpu'))) : '')}${ctx.specRow('Speicher', ctx.dec(s.storageTB) + ' TB · ' + s.driveBays + ' Einschübe')}${ctx.specRow('Kapazität', ctx.live(ctx.nodeKey(s.id, 'capacity')))}${ctx.specRow('Stromaufnahme', ctx.live(ctx.nodeKey(s.id, 'power')))}${ctx.specRow('Rack-Luft', ctx.live(ctx.nodeKey(s.id, 'temperature')))}${ctx.specRow('Zustand', ctx.live(ctx.nodeKey(s.id, 'condition')))}${ctx.specRow('Verbindung', `<button class="text-button" data-rack-command="port" data-rack-id="${r.id}" data-port="${s.port}">Port ${s.port}${ctx.icon('arrow')}</button>`)}</div><div class="device-live-note" data-device-note="${s.id}"></div><label class="field-label hardware-mode">Betriebsmodus<select class="select" data-change="server-mode" data-id="${s.id}" aria-label="Betriebsmodus ${ctx.esc(ctx.serverName(s))}">${Object.entries(
      { balanced: 'Ausgewogen', performance: 'Leistung', eco: 'Öko' },
    )
      .map(
        ([value, label]) =>
          `<option value="${value}" ${ctx.state().servers.find((x) => x.id === s.id)?.mode === value ? 'selected' : ''}>${label}</option>`,
      )
      .join(
        '',
      )}</select></label><div class="hardware-actions">${ctx.button('setServerPower', { id: s.id, on: !s.powered }, ctx.icon('pulse') + (s.powered ? 'Ausschalten' : 'Hochfahren'), s.powered ? 'ghost' : 'primary', true)}<button class="button ghost" data-rack-command="move" data-id="${s.id}">${ctx.icon('layers')}Umsetzen / Umpatchen</button><button class="button" data-action="upgradeServer" data-id="${s.id}" data-cost-kind="serverUpgrade" data-cost-id="${s.id}">${ctx.icon('plus')}Ausbauen · ${ctx.fmt(ctx.E.cost(ctx.state(), 'serverUpgrade', s.id))} CR</button><button class="button ghost" data-modal="repair" data-id="${s.id}">${ctx.icon('settings')}Reparatur prüfen</button></div><p class="hardware-note">Ein Neustart dauert 30 Sekunden. Ausschalten, Umsetzen oder ein Portwechsel beheben keinen Defekt.</p>`;
  }

  function inspector(r) {
    let body;
    if (ctx.selected.kind === 'server') {
      const s = r.servers.find((x) => x.id === ctx.selected.id);
      body = s ? serverInspector(r, s) : componentInspector(r, 'switch');
    } else if (ctx.selected.kind === 'port') body = portInspector(r);
    else if (ctx.componentNames[ctx.selected.kind]) body = componentInspector(r, ctx.selected.kind);
    else
      body = `<div class="hardware-inspector-icon">${ctx.icon('server')}</div><div class="eyebrow">RECHENZENTRUM / RACK</div><h2>${ctx.esc(r.name)}</h2><p class="hardware-description">Wähle einen Server, einen Switch-Port oder die Versorgung direkt am Rack. Freie Höheneinheiten lassen sich mit neuer Hardware belegen.</p><div class="hardware-specs">${ctx.specRow('Einbauformat', '19 Zoll · 18 HE')}${ctx.specRow('Nutzbare Höheneinheiten', '16 HE')}${ctx.specRow('Freier Einbauplatz', r.freeUnits + ' HE')}${ctx.specRow('Verbundene Server', r.servers.length)}</div><div class="hardware-actions">${Object.entries(
        ctx.componentNames,
      )
        .map(
          ([k, v]) =>
            `<button class="button" data-rack-command="component" data-component="${k}" data-rack-id="${r.id}">${ctx.esc(v)}${ctx.icon('arrow')}</button>`,
        )
        .join(
          '',
        )}<button class="button primary" data-rack-command="add-server" data-rack-id="${r.id}">${ctx.icon('plus')}Server einbauen</button></div>`;
    return `<aside class="hardware-inspector" aria-label="Gerätedetails">${body}</aside>`;
  }

  function operation(m) {
    if (!m.operation) return '';
    const op = m.operation;
    return `<div class="rack-operation"><div>${ctx.icon('settings')}<strong>${ctx.esc(op.label)}</strong><span>${ctx.esc(m.racks.find((r) => r.id === op.rackId)?.name || 'Rack')} ist während des Umbaus nicht verfügbar.</span></div><strong data-hw-stat="operationEta"></strong><div class="rack-operation-track"><i data-hw-operation-progress></i></div></div>`;
  }
  return { componentInspector, portInspector, serverInspector, inspector, operation };
}
