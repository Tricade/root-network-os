/** Rack wiring: shared selection is owned by rack-ui.js. */
export function createRackWiring(ctx) {
  function activeWire(r) {
    return ctx.selected.kind === 'server'
      ? ctx.selected.id
      : ctx.selected.kind === 'port'
        ? r.ports.find((p) => p.number === Number(ctx.selected.id))?.serverId
        : null;
  }

  function cables(r) {
    return `<svg class="rack-cables measured-cables" data-cable-rack="${r.id}" preserveAspectRatio="none" aria-hidden="true">${r.servers.map((s) => `<g data-wire="${s.id}"><path class="network-cable" data-cable="${s.id}" data-rack-command="server" data-id="${s.id}"/><path class="cable-flow" data-flow="${s.id}"/><circle class="wire-end network-end" data-wire-end="${s.id}:network:from" r="3"/><circle class="wire-end network-end" data-wire-end="${s.id}:network:to" r="3"/><path class="power-cable" data-power-cable="${s.id}" data-rack-command="server" data-id="${s.id}"/><circle class="wire-end power-end" data-wire-end="${s.id}:power:from" r="3"/><circle class="wire-end power-end" data-wire-end="${s.id}:power:to" r="3"/></g>`).join('')}</svg>`;
  }

  function wiringTools(r) {
    return `<div class="wiring-tools"><div><strong>Verbindung verfolgen</strong><p>Wähle einen Server, Port oder Eintrag im Patchplan. Beide Anschlüsse und das zugehörige Kabel werden markiert.</p></div><div class="rack-view-tabs" role="group" aria-label="Kabeltyp"><button data-rack-command="wire-network" class="${ctx.wireLayer === 'network' ? 'active' : ''}" aria-pressed="${ctx.wireLayer === 'network'}">Netzwerk</button><button data-rack-command="wire-power" class="${ctx.wireLayer === 'power' ? 'active' : ''}" aria-pressed="${ctx.wireLayer === 'power'}">Strom</button></div></div>`;
  }

  function patchPlan(r) {
    const active = activeWire(r);
    return `<section class="patch-plan" aria-label="Patchplan"><header><h3>${ctx.wireLayer === 'network' ? 'Netzwerkverbindungen' : 'Stromanschlüsse'}</h3><span>${r.servers.length} VERBINDUNGEN</span></header>${r.servers.map((s, i) => `<button class="patch-row ${s.id === active ? 'selected' : ''}" data-rack-command="server" data-id="${s.id}" aria-pressed="${s.id === active}"><span class="patch-dot"></span><strong>${ctx.esc(ctx.serverName(s))}</strong><span class="patch-destination">${ctx.wireLayer === 'network' ? 'ETH → SW / Port ' + s.port : 'PSU → PDU / Abgang ' + (s.unit - 1)}</span><small data-wire-status="${s.id}"></small>${ctx.icon('arrow')}</button>`).join('')}<p>${ctx.wireLayer === 'network' ? 'Port anklicken: Verbindung prüfen oder trennen. Über „Umsetzen / Umpatchen“ kannst du einen anderen freien Port wählen.' : 'Die PDU versorgt die Server dieses Racks. Die Abgänge folgen dem Einbauplatz (U02 → 1). Abschalten trennt die Stromaufnahme; für mehr Reserven kannst du die Stromversorgung ausbauen.'}</p></section>`;
  }

  function drawCables(m) {
    if (ctx.mode !== 'wiring') return;
    const svg = document.querySelector('[data-cable-rack]');
    if (!svg) return;
    const r = m.racks.find((x) => x.id === svg.dataset.cableRack);
    if (!r) return;
    const box = svg.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const active = activeWire(r),
      cab = svg.closest('.rack-cabinet');
    const point = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.left - box.left + b.width / 2, y: b.top - box.top + b.height / 2 };
    };
    const positions = r.servers.map((s, i) => {
      const device = cab.querySelector(`[data-rack-device="${s.id}"]`);
      return {
        s,
        i,
        from: point(cab.querySelector(`[data-switch-port="${r.id}:${s.port}"] .port-socket`)),
        to: point(device?.querySelector('.rear-nic>span')),
        powerFrom: point(cab.querySelector(`[data-pdu-socket="${r.id}:${s.unit - 1}"]`)),
        powerTo: point(device?.querySelector('.rear-psu>span')),
      };
    });
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    svg.classList.toggle('show-power', ctx.wireLayer === 'power');
    svg.classList.toggle('has-trace', !!active);
    cab
      .querySelectorAll('.traced-connector')
      .forEach((el) => el.classList.remove('traced-connector'));
    for (const { s, i, from, to, powerFrom, powerTo } of positions) {
      const g = svg.querySelector(`[data-wire="${s.id}"]`),
        chosen = s.id === active,
        p = r.ports.find((x) => x.number === s.port);
      g.classList.toggle('traced', chosen);
      g.classList.toggle('linked', s.link);
      g.classList.toggle('has-traffic', s.link && p.trafficMbps > 0);
      g.classList.toggle('powered', s.powerW > 0);
      const route = (a, b, lane, up) => {
        const bend = 7,
          dy = up ? -bend : bend;
        return `M${a.x} ${a.y} L${a.x} ${a.y + dy} Q${a.x} ${a.y + dy * 2} ${a.x + bend} ${a.y + dy * 2} L${lane - bend} ${a.y + dy * 2} Q${lane} ${a.y + dy * 2} ${lane} ${a.y + dy * 3} L${lane} ${b.y - bend} Q${lane} ${b.y} ${lane - bend} ${b.y} L${b.x} ${b.y}`;
      };
      for (const [kind, a, b] of [
        ['network', from, to],
        ['power', powerFrom, powerTo],
      ]) {
        if (!a || !b) continue;
        const lane = box.width - 5 - (i % 16) * 1.8,
          d = route(a, b, lane, kind === 'power');
        g.querySelector(kind === 'network' ? '[data-cable]' : '[data-power-cable]').setAttribute(
          'd',
          d,
        );
        if (kind === 'network') g.querySelector('[data-flow]').setAttribute('d', d);
        for (const [end, pt] of [
          ['from', a],
          ['to', b],
        ]) {
          const dot = g.querySelector(`[data-wire-end="${s.id}:${kind}:${end}"]`);
          dot.setAttribute('cx', pt.x);
          dot.setAttribute('cy', pt.y);
        }
      }
      if (chosen) {
        const a =
          ctx.wireLayer === 'network'
            ? cab.querySelector(`[data-switch-port="${r.id}:${s.port}"] .port-socket`)
            : cab.querySelector(`[data-pdu-socket="${r.id}:${s.unit - 1}"]`);
        const b = cab.querySelector(
          `[data-rack-device="${s.id}"] ${ctx.wireLayer === 'network' ? '.rear-nic>span' : '.rear-psu>span'}`,
        );
        a?.classList.add('traced-connector');
        b?.classList.add('traced-connector');
      }
    }
  }
  return { activeWire, cables, wiringTools, patchPlan, drawCables };
}
