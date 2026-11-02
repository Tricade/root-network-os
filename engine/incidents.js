/** Incidents: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['incidents'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    const { catalog, RESILIENCE_MAX } = context;
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const addLog = (...args) => context.addLog(...args);
    const rand = (...args) => context.rand(...args);
    const serverLinkState = (...args) => context.serverLinkState(...args);
    const uid = (...args) => context.uid(...args);

    function workLosses(s, fraction) {
      return s.jobs.map((j) => ({ id: j.id, amount: j.work * fraction }));
    }

    function chooseAffected(s, count = 1, candidates = s.servers) {
      const online = candidates.filter((x) => serverLinkState(s, x));
      const result = [];
      while (online.length && result.length < count)
        result.push(online.splice(Math.floor(rand(s) * online.length), 1)[0]);
      return result;
    }

    function openMinorFailure(s) {
      const failed = s.servers.filter((x) => x.status === 'failed').length;
      if (failed >= RESILIENCE_MAX.incidentAffected) return false;
      const candidates = s.servers.filter((x) => serverLinkState(s, x));
      if (!candidates.length) return false;
      const server = candidates[Math.floor(rand(s) * candidates.length)];
      server.condition = Math.min(server.condition, 42);
      server.status = 'failed';
      server.fault = 'Hardwarefehler';
      addLog(
        s,
        'warning',
        `${server.name}: Hardwarefehler erkannt. Aufträge laufen auf verbleibenden Knoten weiter.`,
      );
      return true;
    }

    function openMajorIncident(s) {
      let available = s.servers.filter((x) => serverLinkState(s, x));
      const failedCount = s.servers.filter((x) => x.status === 'failed').length;
      if (!available.length) return false;
      const remainingAffected = RESILIENCE_MAX.incidentAffected - failedCount;
      // Independent hazards: UPS protection removes power failures rather than
      // redistributing their probability to cooling or data corruption.
      const draw = rand(s) * 3;
      const kind = draw < 1 ? 'power' : draw < 2 ? 'cooling' : 'corruption';
      const anchor = available[Math.floor(rand(s) * available.length)];
      const anchorRack = s.facility.racks.find((r) => r.id === anchor.rackId);
      const physical = context.hardwareSnapshot(s).get(anchorRack.id);
      const upsCoverage = Math.min(1, (physical.upsCapacityW || 0) / Math.max(1, physical.powerW));
      const system = kind === 'cooling' ? 'cooling' : 'power';
      const supply = context.roomSupply(s, anchorRack.roomId);
      const scope =
        kind === 'corruption'
          ? 'nodes'
          : ['central', 'hybrid'].includes(supply[system]) && rand(s) < 0.2
            ? 'central'
            : supply[system] !== 'local'
              ? 'room'
              : 'rack';
      // Batteries bridge upstream interruptions, not a broken downstream
      // distribution cabinet. Do not turn prevented failures into other hazards.
      if (kind === 'power' && scope !== 'central' && rand(s) < 0.65 * upsCoverage) return false;
      const roomRacks = new Set(
        s.facility.racks.filter((r) => r.roomId === anchorRack.roomId).map((r) => r.id),
      );
      available = available.filter((n) =>
        scope === 'room' ? roomRacks.has(n.rackId) : n.rackId === anchor.rackId,
      );
      let affected;
      if (kind === 'cooling') {
        affected = available
          .slice()
          .sort(
            (a, b) =>
              catalog.servers[b.type].power * b.level - catalog.servers[a.type].power * a.level,
          )
          .slice(0, Math.min(remainingAffected, available.length));
      } else
        affected = chooseAffected(
          s,
          kind === 'power'
            ? Math.min(
                remainingAffected,
                available.length,
                upsCoverage >= 0.95 ? 1 : remainingAffected,
              )
            : Math.min(1, remainingAffected),
          available,
        );
      const content = {
        power: {
          title: 'Stromversorgung ausgefallen',
          description:
            'Eine Schutzschaltung hat mehrere Knoten getrennt. Die betroffenen Server bleiben offline, bis eine sichere Umschaltung abgeschlossen ist.',
          consequence:
            'Aufträge pausieren bis zur Entscheidung; Wiederanlauf braucht eine gewählte Schaltmaßnahme.',
        },
        cooling: {
          title: 'Kühlkreislauf überhitzt',
          description:
            'Die Temperaturgrenze wurde überschritten. Betroffene Knoten wurden zum Schutz vor Folgeschäden abgeschaltet.',
          consequence: 'Aufträge pausieren; ohne Reparatur bleibt die Kapazität reduziert.',
        },
        corruption: {
          title: 'Datenintegrität beschädigt',
          description:
            'Prüfsummenfehler haben den Betriebsbestand beeinträchtigt. Änderungen bleiben angehalten, bis eine Wiederherstellung gewählt ist.',
          consequence:
            'Forschung und Auftragsstände sind gefährdet; ein gespeicherter Betriebsstand kann ungesicherte Fortschritte kosten.',
        },
      }[kind];
      // Damage containment limits additional damaged hardware, not the chance
      // of an incident. Keeping two broken nodes must never buy immunity.
      const reusingDamage = !affected.length;
      if (reusingDamage)
        affected = s.servers.filter((server) => server.status === 'failed').slice(0, 2);
      // Reusing damaged nodes must not move the failure outside its domain.
      const actualRack = s.facility.racks.find((r) => r.id === affected[0]?.rackId);
      const actualScope = reusingDamage ? 'nodes' : scope;
      for (const server of affected) {
        server.condition = Math.min(
          server.condition,
          kind === 'cooling' ? 24 : kind === 'power' ? 35 + 20 * upsCoverage : 35,
        );
        server.status = 'failed';
        server.fault =
          kind === 'power'
            ? 'Stromausfall'
            : kind === 'cooling'
              ? 'Kühlungsstörung'
              : 'Datenfehler';
      }
      if (kind === 'corruption') {
        s.resilience.corrupted = true;
        s.resilience.integrity = Math.min(s.resilience.integrity, 38);
      }
      const id = uid(s, 'incident');
      s.resilience.incident = {
        id,
        kind,
        title: content.title,
        description: content.description,
        consequence: content.consequence,
        affected: affected.map((x) => x.id),
        resolution: null,
        ...(s.business
          ? {
              scope: actualScope,
              rackId: actualRack?.id || anchorRack.id,
              roomId: actualRack?.roomId || anchorRack.roomId,
              ...(actualScope === 'central' ? { system } : {}),
            }
          : {}),
      };
      if (s.business)
        s.resilience.incident.consequence =
          'Nur der betroffene Bereich ist isoliert. Verbleibende Hardware, Kunden und Agenten arbeiten weiter.';
      addLog(
        s,
        'critical',
        `${content.title}: betroffene Knoten ${affected.map((x) => x.name).join(', ')}. Die Maßnahme wartet auf deine Entscheidung.`,
      );
      return true;
    }
    return { workLosses, chooseAffected, openMinorFailure, openMajorIncident };
  };
});
