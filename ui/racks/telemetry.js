/** Rack telemetry: shared selection is owned by rack-ui.js. */
export function createRackTelemetry(ctx) {
  const tr = ctx.tr || ((value) => String(value));
  function setText(node, value) {
    const translated = tr(String(value ?? ''));
    if (node.textContent !== translated) node.textContent = translated;
  }

  function updateLive(snapshot) {
    // Index each attribute once per tick instead of searching the whole DOM per device.
    const attributeIndexes = new Map();
    function liveQuery(selector) {
      const match = /^\[([\w-]+)(?:="([^"]*)")?\]/.exec(selector);
      if (!match) return document.querySelectorAll(selector);
      const [, attribute, value] = match;
      if (!attributeIndexes.has(attribute)) {
        const all = [...document.querySelectorAll('[' + attribute + ']')],
          values = new Map();
        for (const node of all) {
          const key = node.getAttribute(attribute);
          if (!values.has(key)) values.set(key, []);
          values.get(key).push(node);
        }
        attributeIndexes.set(attribute, { all, values });
      }
      const index = attributeIndexes.get(attribute),
        nodes = value === undefined ? index.all : index.values.get(value) || [];
      return nodes.filter((node) => node.matches(selector));
    }
    const liveOne = (selector) => liveQuery(selector)[0] || null;

    const m = snapshot || ctx.model(),
      values = {
        usedUnits: ctx.fmt(m.usedUnits),
        totalPower: ctx.watts(m.totalPowerW),
        networkFactor: ctx.fmt(m.networkFactor * 100) + ' %',
        operationEta: m.operation
          ? ctx.duration(m.operation.noticeRemaining || m.operation.remaining)
          : '',
      },
      meters = {};
    const setLed = (selector, on, blink = false) =>
      liveQuery(selector).forEach((el) => {
        el.classList.toggle('lit', !!on);
        el.classList.toggle('blinking', !!on && blink);
      });
    m.racks.forEach((r) => {
      const rk = (k) => ctx.rackKey(r.id, k);
      Object.assign(values, {
        [rk('power')]: ctx.watts(r.powerW),
        [rk('temperature')]: ctx.dec(r.temperature) + ' °C',
        [rk('thermalTrend')]:
          r.temperature - r.targetTemperature > 0.2
            ? 'Kühlt ab'
            : r.targetTemperature - r.temperature > 0.2
              ? 'Wärmt sich auf'
              : 'Temperatur stabil',
        [rk('occupancy')]: r.usedUnits + ' / 16 HE belegt',
        [rk('uplink')]: ctx.speed(r.uplinkMbps),
        [rk('networkDemand')]: ctx.speed(r.networkDemandMbps),
        [rk('powerMeterText')]: ctx.watts(r.powerW) + ' / ' + ctx.watts(r.powerCapacityW),
        [rk('coolingMeterText')]: ctx.watts(r.powerW) + ' / ' + ctx.watts(r.coolingW),
        [rk('networkMeterText')]: ctx.speed(r.networkDemandMbps) + ' / ' + ctx.speed(r.uplinkMbps),
      });
      meters[rk('powerMeter')] = (r.powerW / r.powerCapacityW) * 100;
      meters[rk('coolingMeter')] = (r.powerW / r.coolingW) * 100;
      meters[rk('networkMeter')] = (r.networkDemandMbps / r.uplinkMbps) * 100;
      liveQuery(`[data-rack-status="${r.id}"]`).forEach((el) => {
        setText(el, ctx.names[r.status]);
        el.classList.toggle('amber', r.status !== 'online');
      });
      liveQuery(`[data-rack-health="${r.id}"]`).forEach((el) =>
        el.classList.toggle('warning', r.status !== 'online'),
      );
      liveQuery(`[data-rack-warnings="${r.id}"]`).forEach((el) =>
        setText(el, r.warnings.join(' · ')),
      );
      r.ports.forEach((p) => {
        values['port:' + r.id + ':' + p.number + ':traffic'] = ctx.speed(p.trafficMbps);
        const el = liveOne(`[data-switch-port="${r.id}:${p.number}"]`);
        if (el) {
          el.classList.toggle('linked', p.link);
          el.classList.toggle('disabled-port', !p.enabled);
          el.querySelector('.rack-led.power')?.classList.toggle('lit', p.link);
          const traffic = el.querySelector('.rack-led.traffic');
          traffic?.classList.toggle('lit', p.link && p.trafficMbps > 0);
          traffic?.classList.toggle('blinking', p.link && p.trafficMbps > 0);
        }
        liveQuery(`[data-port-status="${r.id}:${p.number}"]`).forEach((el) => {
          setText(el, p.link ? 'LINK AKTIV' : p.enabled ? 'KEIN LINK' : 'DEAKTIVIERT');
        });
      });
      r.servers.forEach((s) => {
        const nk = (k) => ctx.nodeKey(s.id, k);
        liveQuery(`[data-wire-status="${s.id}"]`).forEach((el) => {
          const p = r.ports.find((p) => p.number === s.port);
          setText(
            el,
            ctx.wireLayer === 'power'
              ? ctx.watts(s.powerW)
              : !p.enabled
                ? 'Port deaktiviert'
                : s.link
                  ? ctx.speed(p.trafficMbps)
                  : ctx.names[s.status],
          );
        });
        Object.assign(values, {
          [nk('gpu')]: ctx.dec(s.gpuUsed || 0) + ' / ' + ctx.dec(s.gpuCapacity || 0),
          [nk('capacity')]: ctx.dec(s.capacity) + ' CU',
          [nk('power')]: ctx.watts(s.powerW),
          [nk('temperature')]: ctx.dec(s.temperature) + ' °C',
          [nk('condition')]: ctx.dec(s.condition) + ' %',
        });
        setLed(`[data-power-led="${s.id}"]`, s.powered && r.status !== 'maintenance');
        setLed(`[data-activity-led="${s.id}"]`, s.link && s.activity > 0, s.activity > 0);
        setLed(
          `[data-drive-led="${s.id}"]`,
          s.status === 'online' && s.activity > 0,
          s.activity > 0,
        );
        setLed(`[data-fault-led="${s.id}"]`, ['failed', 'repairing'].includes(s.status));
        liveQuery(`[data-device-status="${s.id}"]`).forEach((el) => {
          setText(el, ctx.names[s.status]);
          el.classList.toggle('green', s.status === 'online');
          el.classList.toggle('amber', s.status !== 'online' && s.status !== 'failed');
          el.classList.toggle('red', s.status === 'failed');
        });
        liveQuery(`[data-change="server-mode"][data-id="${s.id}"]`).forEach((el) => {
          el.disabled = s.status !== 'online';
        });
        liveQuery(`[data-device-note="${s.id}"]`).forEach((el) => {
          setText(
            el,
            s.bootRemaining > 0
              ? 'Systemstart · noch ' + ctx.duration(s.bootRemaining)
              : s.warnings.join(' · '),
          );
        });
        liveQuery(`[data-rack-device="${s.id}"]`).forEach((el) => {
          el.classList.toggle('offline-device', !s.powered || r.status === 'maintenance');
          el.classList.toggle('faulted-device', s.status === 'failed');
          el.setAttribute(
            'aria-label',
            `${s.name}, ${s.model}, ${s.units} ${tr('Höheneinheiten')}, ${tr(ctx.names[s.status])}`,
          );
        });
        liveQuery(`[data-cable="${s.id}"]`).forEach((el) => el.classList.toggle('linked', s.link));
      });
    });
    liveQuery('[data-hw-stat]').forEach((el) => {
      const v = String(values[el.dataset.hwStat] ?? '');
      if (el.textContent !== v) setText(el, v);
    });
    liveQuery('[data-hw-meter]').forEach((el) => {
      const n = meters[el.dataset.hwMeter] || 0;
      el.style.width = Math.min(100, n) + '%';
      el.classList.toggle('over-budget', n > 100);
    });
    liveQuery('[data-hw-operation-progress]').forEach((el) => {
      if (m.operation)
        el.style.width =
          (m.operation.noticeRemaining
            ? 1 - m.operation.noticeRemaining / m.operation.noticeLead
            : 1 - m.operation.remaining / m.operation.total) *
            100 +
          '%';
    });
    liveQuery('[data-hw-action]').forEach((b) => {
      let p;
      try {
        p = JSON.parse(b.dataset.hwPayload || '{}');
      } catch {
        return;
      }
      const q = ctx.E.quoteHardware(ctx.state(), b.dataset.hwAction, p);
      b.disabled = !q.enabled;
      const title = tr(q.reason || '');
      if (b.title !== title) b.title = title;
      const card = b.closest('.hardware-confirm,.hardware-quote,.rack-shop-card');
      if (card) {
        const reason = card.querySelector('[data-hw-reason],[data-hw-quote-reason]');
        if (reason) setText(reason, q.reason || '');
        const desc = card.querySelector('[data-hw-quote-description]');
        if (desc) setText(desc, q.description);
        const cost = card.querySelector('[data-hw-quote-cost]');
        if (cost)
          setText(
            cost,
            (q.cost ? ctx.fmt(q.cost) + ' CR' : 'Keine Credits') +
              (q.duration ? ' · ' + ctx.duration(q.duration) : ''),
          );
      }
    });
    ctx.updateMaintenance?.();
    ctx.drawCables(m);
  }
  return { updateLive };
}
