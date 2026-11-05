/** Actions infrastructure: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['actions-infrastructure'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    const { catalog, MODES, CENTRAL_SYSTEMS } = context;
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const addLog = (...args) => context.addLog(...args);
    const centralLevels = (...args) => context.centralLevels(...args);
    const cost = (...args) => context.cost(...args);
    const fitServer = (...args) => context.fitServer(...args);
    const quoteHardware = (...args) => context.quoteHardware(...args);
    const serverLinkState = (...args) => context.serverLinkState(...args);
    const uid = (...args) => context.uid(...args);

    function applyInfrastructure(s, action, payload, m) {
      const fail = (message) => ({ ok: false, message });
      const construction = context.startConstruction(s, action, payload);
      if (construction) return construction;
      if (action === 'upgradeCentral') {
        const q = quoteHardware(s, 'upgradeCentral', payload);
        if (!q.enabled) return fail(q.reason || 'Der zentrale Ausbau ist derzeit nicht verfügbar.');
        const system = CENTRAL_SYSTEMS.find((item) => item.id === payload.system),
          targetLevel = centralLevels(s)[system.id] + 1;
        s.credits -= q.cost;
        s.facility.centralOperation = {
          system: system.id,
          targetLevel,
          remaining: q.duration,
          total: q.duration,
          cost: q.cost,
        };
        addLog(
          s,
          'system',
          `${q.label} begonnen: ${q.cost} Credits und ${q.duration} Sekunden Wartung.`,
        );
        return { ok: true, message: `${q.label} begonnen.` };
      }
      if (
        [
          'buyRack',
          'upgradeRack',
          'upgradeRackBatch',
          'setServerPower',
          'setSwitchPort',
          'moveServer',
        ].includes(action)
      ) {
        const q = quoteHardware(s, action, payload);
        if (!q.enabled)
          return fail(q.reason || 'Diese Hardwareaktion ist derzeit nicht verfügbar.');
        if (action === 'buyRack') {
          s.credits -= q.cost;
          const id = uid(s, 'rack'),
            number = s.facility.racks.length + 1;
          s.facility.racks.push({
            id,
            name: `Rack ${String(number).padStart(2, '0')}`,
            roomId: q.roomId,
            switchLevel: 1,
            powerLevel: 1,
            coolingLevel: 1,
            disabledPorts: [],
          });
          addLog(
            s,
            'success',
            `${s.facility.racks[s.facility.racks.length - 1].name} mit Switch, Stromversorgung und Kühlung installiert.`,
          );
          return { ok: true, message: 'Rack installiert.' };
        }
        if (action === 'upgradeRackBatch') return context.startRackMaintenance(s, payload);
        if (action === 'upgradeRack') {
          const rack = s.facility.racks.find((x) => x.id === payload.rackId),
            component = payload.component,
            current = rack[component + 'Level'];
          s.credits -= q.cost;
          s.facility.operation = {
            kind: component,
            label: q.label,
            rackId: rack.id,
            remaining: q.duration,
            total: q.duration,
            targetLevel: current + 1,
            cost: q.cost,
          };
          addLog(
            s,
            'system',
            `${q.label} begonnen: ${rack.name}; ${q.cost} Credits und ${q.duration} Sekunden Wartung.`,
          );
          return { ok: true, message: `${q.label} begonnen.` };
        }
        if (action === 'setServerPower') {
          const server = s.servers.find((x) => x.id === payload.id);
          server.powered = payload.on;
          server.bootRemaining = payload.on ? 30 : 0;
          addLog(
            s,
            'system',
            `${server.name} ${payload.on ? 'startet; Bootzeit 30 Sekunden.' : 'wurde ausgeschaltet.'}`,
          );
          return { ok: true, message: payload.on ? 'Server startet.' : 'Server ausgeschaltet.' };
        }
        if (action === 'setSwitchPort') {
          const rack = s.facility.racks.find((x) => x.id === payload.rackId);
          if (payload.enabled)
            rack.disabledPorts = rack.disabledPorts.filter((port) => port !== payload.port);
          else if (!rack.disabledPorts.includes(payload.port))
            rack.disabledPorts.push(payload.port);
          addLog(
            s,
            'system',
            `${rack.name}, Port ${payload.port}: ${payload.enabled ? 'Verbindung aktiviert.' : 'Verbindung getrennt.'}`,
          );
          return {
            ok: true,
            message: payload.enabled ? 'Switch-Port aktiviert.' : 'Switch-Port getrennt.',
          };
        }
        if (action === 'moveServer') {
          const server = s.servers.find((x) => x.id === payload.id),
            rack = s.facility.racks.find((x) => x.id === payload.rackId),
            place = fitServer(s, rack, server.type, payload.unit, payload.port, server.id);
          s.credits -= q.cost;
          server.rackId = rack.id;
          server.unit = place.unit;
          server.port = place.port;
          server.bootRemaining = 30;
          addLog(
            s,
            'system',
            `${server.name} nach ${rack.name}, U${place.unit}, Port ${place.port} umgesetzt; Bootzeit 30 Sekunden.`,
          );
          return { ok: true, message: 'Server umgesetzt und startet neu.' };
        }
      }
      if (action === 'buyServer') {
        const q = quoteHardware(s, 'buyServer', payload);
        if (!q.enabled) return fail(q.reason || 'Server kann derzeit nicht eingesetzt werden.');
        const type = payload.type,
          rack = payload.rackId
            ? s.facility.racks.find((r) => r.id === payload.rackId)
            : s.facility.racks.find((r) => fitServer(s, r, type).ok),
          place = fitServer(s, rack, type, payload.unit, payload.port);
        s.credits -= q.cost;
        const id = uid(s, 'server');
        s.servers.push({
          id,
          type,
          name:
            catalog.servers[type].name +
            ' ' +
            String(s.counters.serversBought + 2).padStart(2, '0'),
          level: 1,
          mode: 'balanced',
          condition: 100,
          status: 'online',
          fault: null,
          rackId: rack.id,
          unit: place.unit,
          port: place.port,
          powered: true,
          bootRemaining: 0,
        });
        s.counters.serversBought++;
        addLog(
          s,
          'success',
          `${catalog.servers[type].name} in ${rack.name}, U${place.unit}, Port ${place.port} eingesetzt.`,
        );
        return { ok: true, message: 'Server in Betrieb genommen.' };
      }
      if (action === 'upgradeServer') {
        const x = s.servers.find((v) => v.id === payload.id);
        if (!x) return fail('Server nicht gefunden.');
        if (x.status !== 'online')
          return fail(
            'Ein ausgefallener oder in Wartung befindlicher Server kann nicht ausgebaut werden.',
          );
        if (!serverLinkState(s, x))
          return fail(
            'Der Server muss eingeschaltet, hochgefahren und mit dem Switch verbunden sein.',
          );
        if (x.level >= 10000) return fail('Dieser Server hat die höchste Ausbaustufe erreicht.');
        const price = cost(s, 'serverUpgrade', x.id);
        if (s.credits < price) return fail(`Es fehlen ${Math.ceil(price - s.credits)} Credits.`);
        s.credits -= price;
        x.level++;
        addLog(s, 'success', `${x.name} auf Stufe ${x.level} ausgebaut.`, 'upgrades');
        return { ok: true, message: 'Server ausgebaut.' };
      }
      if (action === 'setServerMode') {
        const x = s.servers.find((v) => v.id === payload.id);
        if (!x) return fail('Server nicht gefunden.');
        if (!MODES.includes(payload.mode)) return fail('Dieser Betriebsmodus ist ungültig.');
        if (!serverLinkState(s, x))
          return fail(
            'Der Server muss eingeschaltet, hochgefahren und mit dem Switch verbunden sein.',
          );
        x.mode = payload.mode;
        addLog(
          s,
          'system',
          `${x.name}: Modus ${payload.mode === 'eco' ? 'Öko' : payload.mode === 'performance' ? 'Leistung' : 'Ausgewogen'}.`,
        );
        return { ok: true, message: 'Betriebsmodus angepasst.' };
      }
      return null;
    }
    return { applyInfrastructure };
  };
});
