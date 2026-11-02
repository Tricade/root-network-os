// Read models and reusable canvas faces for the physical facility instruments.
// No state mutation, timers, model rebuilding or remote resources.
const clamp = (value) => Math.max(0, Math.min(1, value));
export function operationReadout(
  operation,
  language = globalThis.ROOTI18N?.getLanguage?.() || 'de',
) {
  if (!operation) return null;
  const remaining = Math.max(0, Number(operation.remaining) || 0),
    total = Math.max(0, Number(operation.total) || 0);
  return {
    label:
      globalThis.ROOTI18N?.translate(operation.label || operation.name || '', language) ||
      operation.label ||
      operation.name ||
      '',
    remaining: Math.ceil(remaining),
    progress: total ? clamp(1 - remaining / total) : 0,
  };
}

export function facilityReadout(
  { location, layout, central, model, metrics, resilience, construction = null },
  language = 'de',
) {
  const en = language === 'en',
    text = (de, english) => (en ? english : de);
  const number = (value, digits = 0) =>
    Number(value || 0).toLocaleString(en ? 'en-US' : 'de-DE', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  const kw = (value) => `${number(value / 1000, 1)} kW`,
    percent = (value) => `${number(value * 100)} %`;
  const room = layout.rooms.find((room) => room.id === location.id),
    rackIds = new Set(room?.rackIds || []);
  const racks = room ? model.racks.filter((rack) => rackIds.has(rack.id)) : model.racks;
  const servers = racks.flatMap((rack) => rack.servers),
    hottest = racks.reduce((max, rack) => Math.max(max, rack.temperature), 22);
  const power = racks.reduce((sum, rack) => sum + rack.powerW, 0),
    online = servers.filter((server) => server.status === 'online').length;
  const system = central.systems.find((system) => system.id === location.id);
  let operation = system
    ? central.operation?.system === system.id
      ? central.operation
      : null
    : room
      ? rackIds.has(model.operation?.rackId)
        ? model.operation
        : servers.some((server) => server.id === resilience.operation?.serverId)
          ? resilience.operation
          : null
      : central.operation || model.operation || resilience.operation;
  if (!operation && construction) operation = construction;
  const base = {
    status: resilience.incident
      ? text('VORFALL', 'INCIDENT')
      : construction
        ? text('BAUSTELLE', 'CONSTRUCTION')
        : 'LIVE',
    accent: resilience.incident ? '#ed927b' : construction ? '#e5bc78' : '#a7d487',
    operation: operationReadout(operation, language),
  };
  if (system) {
    const level = [text('Stufe', 'Level'), `${system.level} / ${system.maxLevel}`];
    if (system.id === 'cooling')
      return {
        ...base,
        title: text('Zentrale Kühlung', 'Central cooling'),
        reading: kw(system.totalCoolingW),
        caption: text('Zentrale Kühlleistung', 'Central cooling capacity'),
        rows: [
          level,
          [text('Wärmstes Rack', 'Hottest rack'), `${number(hottest, 1)} °C`],
          [text('Verteilt', 'Allocated'), kw(system.allocatedCoolingW)],
          [text('Angeschlossene Racks', 'Connected racks'), number(system.activeRackCount)],
        ],
      };
    if (system.id === 'ups')
      return {
        ...base,
        title: text('USV', 'UPS'),
        reading: kw(system.upsCapacityW),
        caption: text('Gesamte USV-Leistung', 'Total UPS capacity'),
        rows: [
          level,
          [text('Lastabdeckung', 'Load coverage'), percent(system.coverage)],
          [text('Leistungsaufnahme', 'Power draw'), kw(metrics.powerW)],
          [text('Risikoreduktion', 'Risk reduction'), `${number(system.powerRiskReductionPct)} %`],
        ],
      };
    return {
      ...base,
      title: text('Stromverteilung', 'Power distribution'),
      reading: kw(system.distributionCapacityW),
      caption: text('Zentrale Gesamtleistung', 'Total plant capacity'),
      rows: [
        level,
        [text('Reserve / Rack', 'Capacity / rack'), kw(system.additionalPowerWPerRack)],
        [text('Leistungsaufnahme', 'Power draw'), kw(metrics.powerW)],
        [text('Angeschlossene Racks', 'Connected racks'), number(system.activeRackCount)],
      ],
    };
  }
  if (room)
    return {
      ...base,
      title: text(`Raum ${room.number} · Hardware`, `Room ${room.number} · Hardware`),
      reading: `${online} / ${servers.length}`,
      caption: text('Server online', 'Servers online'),
      rows: [
        [text('Leistungsaufnahme', 'Power draw'), kw(power)],
        [text('Wärmstes Rack', 'Hottest rack'), `${number(hottest, 1)} °C`],
        [text('Racks', 'Racks'), number(racks.length)],
        [
          text('Uplink-Bedarf', 'Uplink demand'),
          `${number(racks.reduce((sum, rack) => sum + rack.networkDemandMbps, 0))} Mbit/s`,
        ],
      ],
    };
  return {
    ...base,
    title: text('Gebäudeplan', 'Building plan'),
    reading: text(`UG ${location.floor}`, `B${location.floor}`),
    caption: text('Aktuelles Untergeschoss', 'Current basement'),
    rows: [
      [
        text('Räume auf dieser Etage', 'Rooms on this floor'),
        number(layout.rooms.filter((room) => room.floor === location.floor).length),
      ],
      [text('Untergeschosse', 'Basements'), number(layout.floorCount)],
      [text('Racks gesamt', 'Total racks'), number(model.racks.length)],
      [text('Server online', 'Servers online'), `${online} / ${servers.length}`],
    ],
  };
}

export function drawInstrument(canvas, data, language = 'de', compact = false) {
  const ctx = canvas.getContext('2d'),
    w = canvas.width,
    h = canvas.height,
    en = language === 'en';
  ctx.fillStyle = '#0a171c';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = data.accent;
  ctx.fillRect(0, 0, compact ? 6 : 8, h);
  const fit = (text, x, y, size, color, maxWidth = w - x - 26, weight = '400') => {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px Segoe UI, Arial`;
    let line = String(text);
    while (ctx.measureText(line).width > maxWidth && line.length > 3) line = line.slice(0, -2);
    ctx.fillText(line, x, y, maxWidth);
  };
  if (compact) {
    fit(
      en ? 'PLANT TOTAL' : 'ANLAGE GESAMT',
      20,
      h * 0.21,
      Math.round(h * 0.13),
      '#a9c0bc',
      w - 40,
      '600',
    );
    fit(data.reading, 20, h * 0.59, Math.round(h * 0.28), '#eef5e9', w - 40, '600');
    const detail = data.operation
      ? `${Math.round(data.operation.progress * 100)} % · ${data.operation.remaining} s`
      : data.caption;
    fit(detail, 20, h * 0.86, Math.round(h * 0.105), data.operation ? '#e5bc78' : '#90aaa6');
    if (data.operation) {
      ctx.fillStyle = '#e5bc78';
      ctx.fillRect(20, h - 8, (w - 40) * data.operation.progress, 3);
    }
    return;
  }
  fit(data.title, 28, 46, 31, '#e5efea', w - 150, '600');
  fit(data.status, w - 118, 44, 20, data.accent, 96, '600');
  ctx.fillStyle = '#1b3237';
  ctx.fillRect(28, 66, w - 56, 2);
  fit(data.reading, 28, 140, 59, '#f0f5ec', w - 56, '600');
  fit(data.caption, 30, 175, 24, '#9fb4b1');
  data.rows.forEach(([label, value], i) => {
    const x = 28 + (i % 2) * (w / 2),
      y = 211 + Math.floor(i / 2) * 84;
    fit(label, x, y, 21, '#88a3a2', w / 2 - 56);
    fit(value, x, y + 35, 30, '#e7eee7', w / 2 - 56, '600');
  });
  const operation = data.operation;
  ctx.fillStyle = operation ? '#253127' : '#14292d';
  ctx.fillRect(28, h - 116, w - 56, 82);
  if (operation) {
    const label = globalThis.ROOTI18N?.translate(operation.label, language) || operation.label;
    fit(
      label || (en ? 'Upgrade in progress' : 'Ausbau läuft'),
      42,
      h - 86,
      22,
      '#e4bd7a',
      w - 84,
      '600',
    );
    fit(
      `${Math.round(operation.progress * 100)} % · ${en ? 'Time remaining' : 'Restzeit'} ${operation.remaining} s`,
      42,
      h - 54,
      23,
      '#ecede0',
    );
    ctx.fillStyle = '#e4bd7a';
    ctx.fillRect(42, h - 43, (w - 84) * operation.progress, 4);
  } else
    fit(
      en ? 'E / click: open controls' : 'E / Klick: Verwaltung öffnen',
      42,
      h - 65,
      24,
      '#a5c5b5',
    );
}
