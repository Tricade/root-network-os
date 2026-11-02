/** Rack view: shared selection is owned by rack-ui.js. */
export function createRackView(ctx) {
  function view() {
    const { m, rack, room, layout } = ctx.current();
    const header = `<div class="page-heading"><div><div class="eyebrow">WORKSPACE / PHYSICAL INFRASTRUCTURE</div><h1>Rechenzentrum</h1><p class="page-description">Jede Verbindung zählt. Vom einzelnen Port bis zur Versorgung des ganzen Racks.</p></div><div class="heading-actions">${ctx.button('buyRack', { roomId: room.id }, ctx.icon('plus') + 'Rack hinzufügen', '', true)}${rack ? '<button class="button primary" data-rack-command="add-server" data-rack-id="' + rack.id + '">' + ctx.icon('plus') + 'Server einbauen</button>' : ''}</div></div>`;
    const summary = `<div class="rack-summary"><div><span>Racks / verfügbar</span><strong>${m.racks.length}<small> / ${m.rackLimit}</small></strong></div><div><span>Belegte Höheneinheiten</span><strong>${ctx.live('usedUnits')}<small> / ${m.racks.length * 16} HE</small></strong></div><div><span>Stromaufnahme</span><strong>${ctx.live('totalPower')}<small>gesamt</small></strong></div><div><span>Netzwerkleistung</span><strong>${ctx.live('networkFactor')}<small>der Anforderung</small></strong></div></div>`;
    const selector = `<div class="hardware-room-selector"><label for="hardware-room">Standort</label><select class="select" id="hardware-room" data-rack-change="room">${layout.rooms.map((item) => '<option value="' + item.id + '" ' + (item.id === room.id ? 'selected' : '') + '>Untergeschoss ' + item.floor + ' · Raum ' + item.number + ' · ' + item.rackCount + ' Racks</option>').join('')}</select><button class="button small" data-nav="facility">Gebäude & Technik</button></div>`;
    const intro = header + summary + ctx.operation(m) + selector;
    if (!rack) {
      const quote = ctx.E.quoteHardware(ctx.state(), 'buyRack', { roomId: room.id });
      return (
        intro +
        `<section class="panel hardware-empty-room">${ctx.icon('server')}<h2>Raum ${room.number} ist bereit</h2><p>Dieser gebaute Serverraum ist noch leer. Installiere hier das erste Rack; danach kannst du Server und Verbindungen einrichten.</p>${ctx.button('buyRack', { roomId: room.id }, 'Erstes Rack installieren', 'primary', true)}<p data-hw-reason>${ctx.esc(quote.reason || '')}</p><button class="button" data-nav="facility">Gebäudeplan öffnen</button></section>`
      );
    }
    return (
      intro +
      `<div class="rack-selector">${m.racks
        .filter((r) => room.rackIds.includes(r.id))
        .map(
          (r) =>
            `<button class="rack-tab ${r.id === rack.id ? 'selected' : ''}" data-rack-command="rack-select" data-rack-id="${r.id}" aria-pressed="${r.id === rack.id}"><span class="mini-rack">${Array.from({ length: 5 }, (_, i) => `<i class="${i < r.servers.length ? 'filled' : ''}"></i>`).join('')}</span><span><strong>${ctx.esc(r.name)}</strong><small>${r.servers.length} Server · ${r.usedUnits} / 16 HE</small></span><i class="rack-tab-light" data-rack-health="${r.id}"></i></button>`,
        )
        .join(
          '',
        )}</div><div class="physical-workspace"><div class="rack-stage"><div class="rack-stage-toolbar"><div class="rack-view-tabs" role="group" aria-label="Rackansicht"><button data-rack-command="front" class="${ctx.mode === 'front' ? 'active' : ''}" aria-pressed="${ctx.mode === 'front'}">${ctx.icon('server')}Front</button><button data-rack-command="wiring" class="${ctx.mode === 'wiring' ? 'active' : ''}" aria-pressed="${ctx.mode === 'wiring'}">${ctx.icon('globe')}Verkabelung</button></div><span>${ctx.mode === 'wiring' ? 'Portzuordnung & Stromanschlüsse' : 'Gerät auswählen · Freien Platz belegen'}</span></div>${ctx.mode === 'wiring' ? ctx.wiringTools(rack) : ''}${ctx.cabinet(rack)}${ctx.mode === 'wiring' ? ctx.patchPlan(rack) : ''}<div class="rack-legend"><span>${ctx.led('power', true)}Strom / Link</span><span>${ctx.led('traffic', true)}Aktivität</span><span>${ctx.led('fault', true)}Störung</span><span>${ctx.led('identify', true)}Position</span></div>${ctx.telemetry(rack)}</div>${ctx.inspector(rack)}</div><div class="helper-card"><h3>Ausbau bedeutet mehr als zusätzliche Server.</h3><p>Alle Geräte eines Racks teilen sich Uplink, Strom und Kühlung. Verteile dichte oder leistungsstarke Hardware auf mehrere Racks oder verbessere deren Versorgung. Vor jeder Maßnahme siehst du Kosten und Stillstand. Größere Krisen warten weiterhin im Schutzmodus auf dich.</p></div>`
    );
  }

  function actionQuote(action, payload, label) {
    const q = ctx.E.quoteHardware(ctx.state(), action, payload);
    return `<div class="hardware-confirm"><div class="hardware-inspector-icon">${ctx.icon(action === 'buyRack' ? 'server' : 'settings')}</div><h3>${ctx.esc(q.label)}</h3><p data-hw-quote-description>${ctx.esc(q.description)}</p><div class="hardware-confirm-cost" data-hw-quote-cost>${q.cost ? ctx.fmt(q.cost) + ' CR' : 'Keine Credits'}${q.duration ? ' · ' + ctx.duration(q.duration) : ''}</div>${q.warnings?.length ? '<ul class="hardware-consequences">' + q.warnings.map((message) => '<li>' + ctx.esc(message) + '</li>').join('') + '</ul>' : ''}<p class="hardware-confirm-reason" data-hw-quote-reason>${ctx.esc(q.reason || '')}</p>${ctx.button(action, payload, label || 'Maßnahme starten', 'primary block')}</div>`;
  }

  function shop(extra = {}) {
    const m = ctx.model(),
      r = m.racks.find((x) => x.id === extra.rackId) || ctx.getRack(m);
    if (!r)
      return '<p class="modal-intro">In diesem Raum ist noch kein Rack installiert. Installiere zuerst ein Rack im Rechenzentrum.</p><button class="button" data-nav="network">Zum Rechenzentrum</button>';
    const payload = { rackId: r.id, ...(extra.unit ? { unit: Number(extra.unit) } : {}) };
    return `<p class="modal-intro">Einbau in <strong>${ctx.esc(r.name)}</strong>${extra.unit ? ' ab U' + extra.unit : ''}. Ein Switch-Port wird automatisch zugeordnet. Vorhandene Verkabelung und zusammenhängende freie Höheneinheiten bestimmen, was hier passt.</p><div class="rack-shop-grid">${Object.entries(
      ctx.E.catalog.servers,
    )
      .map(([type, c]) => {
        const p = { type, ...payload },
          q = ctx.E.quoteHardware(ctx.state(), 'buyServer', p);
        return `<article class="rack-shop-card"><div class="mini-server mini-${type}"><i></i><i></i><i></i><i></i></div><span class="eyebrow">${ctx.esc(c.model)}</span><h3>${ctx.esc(c.name)}</h3><p>${c.units} HE · ${c.cores} Kerne<br>${c.ramGB} GB RAM · ${c.storageTB} TB<br>${c.driveBays} Laufwerkseinschübe${c.gpuCount ? `<br><strong class="gpu-label">${c.gpuCount} GPUs · ${c.vramGB} GB VRAM</strong><br>1,5 kW · Inferenz und Training` : ''}</p><p class="hardware-purchase-detail">${ctx.esc(q.description)}${q.warnings?.length ? ' ' + q.warnings.map(ctx.esc).join(' ') : ''}</p><div class="hardware-price">${ctx.fmt(q.cost)} CR</div>${ctx.button('buyServer', p, 'Einbauen', 'primary block')}<small data-hw-reason>${ctx.esc(q.reason || '')}</small></article>`;
      })
      .join('')}</div>`;
  }

  function moveModal(id) {
    const m = ctx.model(),
      s = ctx.allServers(m).find((x) => x.id === id);
    if (!s) return '';
    if (!ctx.moveDraft || ctx.moveDraft.id !== id)
      ctx.moveDraft = {
        id,
        rackId: s.rackId || m.racks.find((r) => r.servers.some((x) => x.id === id)).id,
        unit: s.unit,
        port: s.port,
      };
    const r = m.racks.find((x) => x.id === ctx.moveDraft.rackId),
      q = ctx.E.quoteHardware(ctx.state(), 'moveServer', ctx.moveDraft);
    return `<p class="modal-intro">${ctx.esc(ctx.serverName(s))} belegt ${s.units} zusammenhängende Höheneinheiten. Beim Umsetzen wird der Server kurz abgeschaltet und neu verbunden.</p><div class="rack-move-fields"><label class="field-label">Ziel-Rack<select class="select" data-rack-change="move-rack" aria-label="Ziel-Rack">${m.racks.map((x) => `<option value="${x.id}" ${x.id === r.id ? 'selected' : ''}>${ctx.esc(x.name)} · ${x.freeUnits} HE frei</option>`).join('')}</select></label><label class="field-label">Unterste Höheneinheit<select class="select" data-rack-change="move-unit" aria-label="Unterste Höheneinheit">${Array.from(
      { length: 16 },
      (_, i) => i + 2,
    )
      .map(
        (u) =>
          `<option value="${u}" ${u === ctx.moveDraft.unit ? 'selected' : ''}>U${String(u).padStart(2, '0')}</option>`,
      )
      .join(
        '',
      )}</select></label><label class="field-label">Switch-Port<select class="select" data-rack-change="move-port" aria-label="Switch-Port">${r.ports.map((p) => `<option value="${p.number}" ${p.number === ctx.moveDraft.port ? 'selected' : ''}>${p.number}${p.serverId && p.serverId !== id ? ' · belegt' : ''}</option>`).join('')}</select></label></div><div class="hardware-confirm"><p data-hw-quote-description>${ctx.esc(q.description)}</p><div class="hardware-confirm-cost" data-hw-quote-cost></div><p data-hw-quote-reason></p>${ctx.button('moveServer', ctx.moveDraft, 'Server umsetzen', 'primary block')}</div>`;
  }

  function modal(type, extra) {
    if (type === 'hardware-shop') return shop(extra);
    if (type === 'hardware-move') return moveModal(extra.id);
    if (type === 'hardware-confirm') return actionQuote(extra.action, extra.payload);
    return '';
  }
  return { view, actionQuote, shop, moveModal, modal };
}
