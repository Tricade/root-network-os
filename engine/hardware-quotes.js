/** Hardware quotes: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['hardware-quotes'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    const { catalog, RACKS_PER_ROOM, CENTRAL_SYSTEMS, own } = context;
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const cashReason = (...args) => context.cashReason(...args);
    const centralQuote = (...args) => context.centralQuote(...args);
    const constructionQuote = (...args) => context.constructionQuote(...args);
    const cost = (...args) => context.cost(...args);
    const fitServer = (...args) => context.fitServer(...args);
    const getFacilityLayout = (...args) => context.getFacilityLayout(...args);
    const getMetrics = (...args) => context.getMetrics(...args);
    const hardwareSnapshot = (...args) => context.hardwareSnapshot(...args);
    const portCount = (...args) => context.portCount(...args);
    const rackComponentQuote = (...args) => context.rackComponentQuote(...args);
    const rackLimit = (...args) => context.rackLimit(...args);
    const rackPrice = (...args) => context.rackPrice(...args);
    const specPowerW = (...args) => context.specPowerW(...args);

    function quoteHardware(s, action, payload = {}) {
      payload = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
      if (action === 'buildServiceRoom')
        return constructionQuote(s, 'service', 1, payload.roomType);
      if (action === 'buildRoom' || action === 'buildFloor')
        return constructionQuote(s, action === 'buildRoom' ? 'room' : 'floor', payload.floor);
      const quote = (
        label,
        description,
        costValue = 0,
        duration = 0,
        reason = '',
        warnings = [],
      ) => ({
        label,
        description,
        cost: costValue,
        duration,
        enabled: !reason,
        reason,
        ...(warnings.length ? { warnings } : {}),
      });
      const locked = Boolean(
        context.globalIncident(s) ||
        s.resilience.operation ||
        s.facility.operation ||
        s.facility.centralOperation ||
        s.preventiveMaintenance?.operation,
      );
      if (action === 'upgradeCentral') {
        const system = CENTRAL_SYSTEMS.find((item) => item.id === payload.system);
        return system
          ? centralQuote(s, system)
          : quote(
              'Zentralanlage ausbauen',
              'Unbekanntes zentrales System.',
              0,
              0,
              'Dieses zentrale System ist unbekannt.',
            );
      }
      if (action === 'buyRack') {
        const price = rackPrice(s);
        const rooms = getFacilityLayout(s).rooms,
          room = payload.roomId
            ? rooms.find((room) => room.id === payload.roomId)
            : rooms.find((room) => room.rackCount < RACKS_PER_ROOM);
        const reason =
          s.facility.racks.length >= rackLimit(s)
            ? 'Die Standortgrenze für Racks ist erreicht.'
            : !room
              ? 'Kein freier ausgebauter Rackplatz. Baue zuerst einen Serverraum.'
              : room.rackCount >= RACKS_PER_ROOM
                ? 'Dieser Serverraum ist voll. Wähle einen anderen Raum oder baue zusätzliche Fläche.'
                : locked || context.roomState(s, room.id)?.conversion
                  ? 'Während einer Krise oder laufenden Infrastrukturmaßnahme nicht verfügbar.'
                  : cashReason(s, price);
        return {
          ...quote(
            'Rack kaufen',
            `Neues 18-HE-Rack mit 8-Port-Switch, 2-kW-Stromversorgung und 2-kW-Kühlung; ${price} Credits.`,
            price,
            0,
            reason,
          ),
          roomId: room?.id || null,
        };
      }
      if (action === 'buyServer') {
        if (!own(catalog.servers, payload.type))
          return quote(
            'Server einsetzen',
            'Unbekannter Gerätetyp.',
            0,
            0,
            'Dieser Servertyp ist unbekannt.',
          );
        const price = cost(s, 'server', payload.type);
        const rack = payload.rackId
          ? s.facility.racks.find((r) => r.id === payload.rackId)
          : s.facility.racks.find(
              (r) => fitServer(s, r, payload.type, payload.unit, payload.port).ok,
            );
        const placement = rack && fitServer(s, rack, payload.type, payload.unit, payload.port);
        const reason =
          s.servers.length >= getMetrics(s).serverLimit
            ? 'Der Sektor hat seine Servergrenze erreicht.'
            : locked
              ? 'Während einer Krise oder laufenden Infrastrukturmaßnahme nicht verfügbar.'
              : !rack
                ? 'Kein passender freier Rackplatz oder Switch-Port verfügbar.'
                : context.roomState(s, rack.roomId)?.conversion || context.rackIncident(s, rack)
                  ? 'Dieser Bereich ist vorübergehend nicht verfügbar.'
                  : !placement.ok
                    ? placement.reason
                    : cashReason(s, price);
        const warnings = rack
          ? (() => {
              const row = hardwareSnapshot(s).get(rack.id);
              return row &&
                row.powerW +
                  specPowerW({ type: payload.type, level: 1, mode: 'balanced' }, s.policies.power) >
                  row.powerCapacityW
                ? [
                    'Die Rack-Stromlast überschreitet danach die Nennleistung; Knoten werden gedrosselt und wärmer.',
                  ]
                : [];
            })()
          : [];
        return quote(
          'Server einsetzen',
          `${price} Credits; Einbau in ${rack ? rack.name + ' U' + ((placement && placement.unit) || '?') : 'einen freien Rackplatz'} an Port ${(placement && placement.port) || '?'}.`,
          price,
          0,
          reason,
          warnings,
        );
      }
      if (action === 'upgradeRackBatch') return context.quoteRackMaintenance(s, payload);
      if (action === 'upgradeRack') {
        const rack = s.facility.racks.find((r) => r.id === payload.rackId);
        if (!rack || !['switch', 'power', 'cooling'].includes(payload.component))
          return quote(
            'Rack-Ausbau',
            'Rack oder Komponente unbekannt.',
            0,
            0,
            'Rack oder Komponente unbekannt.',
          );
        const q = rackComponentQuote(s, rack, payload.component);
        return {
          ...q,
          enabled: q.enabled && !locked,
          reason: locked
            ? 'Während einer Krise oder laufenden Infrastrukturmaßnahme nicht verfügbar.'
            : q.reason,
        };
      }
      if (action === 'setServerPower') {
        const server = s.servers.find((x) => x.id === payload.id);
        const reason = !server
          ? 'Server nicht gefunden.'
          : locked
            ? 'Während einer Krise oder laufenden Infrastrukturmaßnahme nicht verfügbar.'
            : typeof payload.on !== 'boolean'
              ? 'Schaltzustand ist ungültig.'
              : server.powered === payload.on
                ? 'Der Server hat diesen Schaltzustand bereits.'
                : server.status === 'repairing' || server.status === 'failed'
                  ? 'Ausgefallene oder gewartete Server lassen sich hier nicht schalten.'
                  : '';
        return quote(
          payload.on ? 'Server einschalten' : 'Server ausschalten',
          payload.on
            ? '30 Sekunden Bootzeit; währenddessen keine Produktion.'
            : 'Sofortige Unterbrechung von Produktion und Verbindung.',
          0,
          payload.on ? 30 : 0,
          reason,
        );
      }
      if (action === 'setSwitchPort') {
        const rack = s.facility.racks.find((r) => r.id === payload.rackId);
        const currently = rack && !rack.disabledPorts.includes(payload.port);
        const reason = !rack
          ? 'Rack nicht gefunden.'
          : locked
            ? 'Während einer Krise oder laufenden Infrastrukturmaßnahme nicht verfügbar.'
            : !Number.isInteger(payload.port) || payload.port < 1 || payload.port > portCount(rack)
              ? 'Switch-Port ist ungültig.'
              : currently === payload.enabled
                ? 'Der Port hat diesen Schaltzustand bereits.'
                : typeof payload.enabled !== 'boolean'
                  ? 'Schaltzustand ist ungültig.'
                  : '';
        return quote(
          payload.enabled ? 'Port aktivieren' : 'Port trennen',
          payload.enabled
            ? 'Die Verbindung wird sofort wiederhergestellt.'
            : 'Angeschlossener Knoten wird sofort vom Netz getrennt.',
          0,
          0,
          reason,
        );
      }
      if (action === 'moveServer') {
        const server = s.servers.find((x) => x.id === payload.id),
          rack = s.facility.racks.find((r) => r.id === payload.rackId);
        const placement =
          server && rack && fitServer(s, rack, server.type, payload.unit, payload.port, server.id);
        const price = Math.ceil(60 * (1 + Math.max(0, s.sector - 1) * 0.25));
        const reason = !server
          ? 'Server nicht gefunden.'
          : !rack
            ? 'Ziel-Rack nicht gefunden.'
            : locked ||
                context.roomState(s, s.facility.racks.find((r) => r.id === server.rackId)?.roomId)
                  ?.conversion
              ? 'Während einer Krise oder laufenden Infrastrukturmaßnahme nicht verfügbar.'
              : server.status !== 'online' || !server.powered || server.bootRemaining > 0
                ? 'Nur betriebsbereite Server können umgesetzt werden.'
                : !placement.ok
                  ? placement.reason
                  : server.rackId === rack.id &&
                      server.unit === placement.unit &&
                      server.port === placement.port
                    ? 'Der Server befindet sich bereits an diesem Platz.'
                    : cashReason(s, price);
        return quote(
          'Server umsetzen',
          `${price} Credits; der Server startet am Zielrack mit 30 Sekunden Bootzeit neu.`,
          price,
          30,
          reason,
        );
      }
      return quote(
        'Infrastruktur',
        'Unbekannte Hardwareaktion.',
        0,
        0,
        'Diese Hardwareaktion ist unbekannt.',
      );
    }
    return { quoteHardware };
  };
});
