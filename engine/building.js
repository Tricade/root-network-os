/** Owned space and paid construction. A contractor queue never locks emergency maintenance. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {}).building = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createBuilding(context) {
    const { MAX_RACKS, RACKS_PER_ROOM, ROOMS_PER_FLOOR, MAX_ROOMS, MAX_FLOORS, finite } = context;
    const constructionKinds = {
      buildFloor: 'floor',
      buildRoom: 'room',
      buildServiceRoom: 'service',
      buildRoomStage: 'room-stage',
      fitOutRoom: 'fit-out',
    };
    const constructionTypes = new Set(Object.values(constructionKinds));
    const STAGE_SLOTS = 2;
    const roomRackSlots = (room) => room.rackSlots ?? RACKS_PER_ROOM;
    const services = [
      { id: 'control', name: 'Kontrollraum', unlockSector: 2, cost: 20000000 },
      { id: 'cooling', name: 'Klimaraum', unlockSector: 4, cost: 25000000 },
      { id: 'ups', name: 'USV-Raum', unlockSector: 6, cost: 30000000 },
      { id: 'distribution', name: 'Stromverteilungsraum', unlockSector: 8, cost: 35000000 },
    ];

    function rackLimit(s) {
      return Math.min(MAX_RACKS, Math.max(1, s.sector + 1));
    }

    // Old saves already owned every visible room. Migration grants that exact space once,
    // without charging again or inferring future ownership from later sector upgrades.
    function legacyBuilding(racks, sector = 1) {
      const count = Math.max(1, Math.ceil(racks.length / RACKS_PER_ROOM));
      return {
        version: 1,
        floors: Math.ceil(count / ROOMS_PER_FLOOR),
        rooms: Array.from({ length: count }, (_, i) => ({
          id: `room-${i + 1}`,
          floor: Math.floor(i / ROOMS_PER_FLOOR) + 1,
        })),
        specialRooms: services
          .filter((item) => item.id === 'control' || sector >= item.unlockSector)
          .map((item) => item.id),
        project: null,
      };
    }

    function buildingState(s) {
      return s.facility.building || legacyBuilding(s.facility.racks, s.sector);
    }

    function serviceRoomOwned(s, id) {
      return buildingState(s).specialRooms.includes(id);
    }

    function constructionQuote(s, kind, floor, targetId = null, floorRoomCount = null) {
      const b = buildingState(s),
        staged = kind === 'room-stage',
        isRoom = kind === 'room' || staged,
        fitOut = kind === 'fit-out',
        isService = kind === 'service';
      const service = services.find((item) => item.id === targetId);
      const targetRoom = fitOut ? b.rooms.find((room) => room.id === targetId) : null;
      const targetFloor = fitOut
        ? (targetRoom?.floor ?? null)
        : isRoom
          ? floor
          : isService
            ? 1
            : b.floors + 1;
      const validFloor =
        Number.isInteger(targetFloor) && targetFloor >= 1 && targetFloor <= b.floors;
      const depth = Number.isInteger(targetFloor) && targetFloor > 0 ? targetFloor : 1;
      const countOnFloor = floorRoomCount ?? b.rooms.filter((room) => room.floor === floor).length;
      const cost = fitOut
        ? 14e6
        : staged
          ? 6e6
          : isService
            ? service?.cost || 0
            : isRoom
              ? Math.ceil(Math.min(5e13, 2e7 * b.rooms.length ** 1.35 * (1 + (depth - 1) * 0.15)))
              : Math.ceil(Math.min(2e14, 5e8 * b.floors ** 2.6));
      const duration =
        staged || fitOut
          ? 900
          : isService
            ? 1800
            : isRoom
              ? Math.min(
                  7200,
                  Math.ceil(1800 * (1 + (b.rooms.length - 1) * 0.1 + (depth - 1) * 0.15)),
                )
              : Math.min(21600, Math.ceil(7200 * (1 + (b.floors - 1) * 0.25)));
      let reason;
      if (!constructionTypes.has(kind) || (isService && !service))
        reason = 'Dieser Raumtyp ist unbekannt.';
      else if (b.project) reason = 'Ein Bauprojekt läuft bereits.';
      else if (context.globalIncident(s))
        reason = 'Während einer offenen Krise kann kein Bauprojekt beginnen.';
      else if (isService && serviceRoomOwned(s, targetId))
        reason = 'Dieser Raum wurde bereits gebaut.';
      else if (isService && s.sector < service.unlockSector)
        reason = `Dieser Raum wird ab Sektor ${service.unlockSector} freigeschaltet.`;
      else if (isRoom && !validFloor) reason = 'Dieses Untergeschoss wurde noch nicht gebaut.';
      else if (isRoom && countOnFloor >= ROOMS_PER_FLOOR)
        reason = 'Dieses Untergeschoss hat bereits vier Serverräume.';
      else if (isRoom && b.rooms.length >= MAX_ROOMS)
        reason = 'Die maximale Gebäudekapazität ist erreicht.';
      else if (staged && (b.rooms.length !== 1 || floor !== 1))
        reason =
          'Der Teilausbau ist für den ersten zusätzlichen Serverraum auf Untergeschoss 1 verfügbar.';
      else if (fitOut && targetRoom?.rackSlots !== STAGE_SLOTS)
        reason = 'Dieser Serverraum hat keinen offenen Bauabschnitt.';
      else if (kind === 'floor' && b.floors >= MAX_FLOORS)
        reason = 'Die maximale Zahl der Untergeschosse ist erreicht.';
      else reason = context.cashReason(s, cost);
      return {
        kind,
        label: staged
          ? 'Serverraum mit zwei Rackplätzen bauen'
          : fitOut
            ? 'Serverraum fertig ausbauen'
            : isService
              ? `${service?.name || 'Technikraum'} bauen`
              : isRoom
                ? 'Unterirdischen Serverraum bauen'
                : 'Neues Untergeschoss bauen',
        description: staged
          ? 'Erschließt zwei nutzbare Rackplätze. Die übrigen vier können später ausgebaut werden.'
          : fitOut
            ? 'Schaltet vier weitere Rackplätze frei. Bestehende Racks arbeiten während des Baus weiter.'
            : isService
              ? 'Aushub, Stahlbeton, Abdichtung und Anschlüsse im Technikflügel von Untergeschoss 1. Geräte werden anschließend separat installiert.'
              : isRoom
                ? `Aushub, Stahlbeton, Abdichtung und Anschlüsse für Raum ${b.rooms.length + 1} auf Untergeschoss ${depth}. Nach Fertigstellung Platz für sechs Racks.`
                : `Aushub, Tragwerk, Treppenzugang und Erschließung für Untergeschoss ${targetFloor}. Vier Bauplätze für separat zu kaufende Serverräume.`,
        cost,
        duration,
        enabled: !reason,
        reason,
        floor: targetFloor,
        roomId: isService
          ? targetId
          : fitOut
            ? (targetRoom?.id ?? null)
            : isRoom
              ? `room-${b.rooms.length + 1}`
              : null,
        roomType: isService ? targetId : null,
        warnings: [
          'Der volle Betrag wird beim Baustart bezahlt. Die Fläche ist erst nach Fertigstellung verfügbar.',
          'Der vorhandene Betrieb und Reparaturen laufen während des Baus weiter.',
        ],
      };
    }

    function quoteConstructionAction(s, action, payload) {
      if (!Object.hasOwn(constructionKinds, action)) return null;
      const kind = constructionKinds[action];
      return constructionQuote(
        s,
        kind,
        payload.floor,
        kind === 'fit-out' ? payload.roomId : payload.roomType,
      );
    }

    function getConstructionProject(s) {
      const b = buildingState(s),
        project = b.project;
      if (!project) return null;
      const label =
        project.kind === 'service'
          ? `${services.find((item) => item.id === project.roomType).name} bauen`
          : project.kind === 'floor'
            ? `Untergeschoss ${project.floor} bauen`
            : project.kind === 'fit-out'
              ? 'Serverraum fertig ausbauen'
              : project.kind === 'room-stage'
                ? 'Serverraum mit zwei Rackplätzen bauen'
                : `Raum ${b.rooms.length + 1} bauen`;
      return {
        ...project,
        label,
        progress: Math.max(0, Math.min(1, 1 - project.remaining / project.total)),
      };
    }

    function getBuildingModel(s) {
      const b = buildingState(s),
        counts = new Map();
      for (const room of b.rooms) counts.set(room.floor, (counts.get(room.floor) || 0) + 1);
      const rackCapacity = Math.min(
        MAX_RACKS,
        b.rooms.reduce((sum, room) => sum + roomRackSlots(room), 0),
      );
      const partial = b.rooms.find((room) => room.rackSlots === STAGE_SLOTS);
      return {
        floorCount: b.floors,
        roomCount: b.rooms.length,
        rackCapacity,
        freeRackSlots: Math.max(0, rackCapacity - s.facility.racks.length),
        project: getConstructionProject(s),
        buyFloor: constructionQuote(s, 'floor'),
        fitOutRoom: partial ? constructionQuote(s, 'fit-out', partial.floor, partial.id) : null,
        serviceRooms: services.map((item) => ({
          ...item,
          owned: serviceRoomOwned(s, item.id),
          quote: constructionQuote(s, 'service', 1, item.id),
        })),
        floors: Array.from({ length: b.floors }, (_, i) => ({
          number: i + 1,
          roomCount: counts.get(i + 1) || 0,
          buyRoom: constructionQuote(s, 'room', i + 1, null, counts.get(i + 1) || 0),
          stageRoom: i === 0 && b.rooms.length === 1 ? constructionQuote(s, 'room-stage', 1) : null,
        })),
      };
    }

    function startConstruction(s, action, payload) {
      const q = quoteConstructionAction(s, action, payload);
      if (!q) return null;
      if (!q.enabled) return { ok: false, message: q.reason };
      const plan = s.operations?.queue;
      if (plan?.length) {
        const plannedState = {
          ...s,
          facility: { ...s.facility, building: { ...buildingState(s), project: q } },
        };
        if (!context.planTargetsValid(plannedState, plan))
          return { ok: false, message: 'Der Bau kollidiert mit einem eingeplanten Bauabschnitt.' };
      }
      if (!s.facility.building) {
        s.facility.building = legacyBuilding(s.facility.racks, s.sector);
        s.facility.racks.forEach((rack, index) => {
          rack.roomId = s.facility.building.rooms[Math.floor(index / RACKS_PER_ROOM)].id;
        });
      }
      s.credits -= q.cost;
      s.facility.building.project = {
        kind: q.kind,
        floor: q.floor,
        roomId: q.roomId,
        roomType: q.roomType,
        remaining: q.duration,
        total: q.duration,
        cost: q.cost,
      };
      context.addLog(
        s,
        'system',
        `${q.label} begonnen: ${q.cost} Credits; ${q.duration} Sekunden Bauzeit.`,
      );
      return { ok: true, message: 'Bauauftrag vergeben. Der vorhandene Betrieb läuft weiter.' };
    }

    function addBuiltSpace(building, project) {
      if (project.kind === 'floor') building.floors = project.floor;
      else if (project.kind === 'service') building.specialRooms.push(project.roomType);
      else if (project.kind === 'fit-out') {
        const room = building.rooms.find((r) => r.id === project.roomId);
        if (room) delete room.rackSlots;
      } else
        building.rooms.push({
          id: project.roomId,
          floor: project.floor,
          ...(project.kind === 'room-stage' ? { rackSlots: STAGE_SLOTS } : {}),
        });
    }

    function advanceConstruction(s, dt) {
      const b = s.facility.building,
        p = b?.project;
      if (!p) return;
      p.remaining = Math.max(0, p.remaining - dt);
      if (p.remaining > 0) return;
      addBuiltSpace(b, p);
      let message;
      if (p.kind === 'floor') {
        message = `Untergeschoss ${p.floor} fertiggestellt. Vier Raumbauplätze sind verfügbar.`;
      } else if (p.kind === 'service') {
        message = `${services.find((item) => item.id === p.roomType).name} fertiggestellt.`;
      } else if (p.kind === 'fit-out')
        message = 'Serverraum fertig ausgebaut. Vier weitere Rackplätze sind verfügbar.';
      else if (p.kind === 'room-stage')
        message = 'Erster Bauabschnitt fertig. Zwei Rackplätze sind verfügbar.';
      else {
        message = `Raum ${b.rooms.length} auf Untergeschoss ${p.floor} fertiggestellt. Sechs Rackplätze sind verfügbar.`;
      }
      b.project = null;
      context.addLog(s, 'success', message, 'construction');
      return message;
    }

    function normalizeBuildingSpace(facility, sector) {
      if (facility.building === undefined) return legacyBuilding(facility.racks, sector);
      const b = facility.building;
      if (
        !b ||
        typeof b !== 'object' ||
        Array.isArray(b) ||
        b.version !== 1 ||
        !Number.isInteger(b.floors) ||
        b.floors < 1 ||
        b.floors > MAX_FLOORS ||
        !Array.isArray(b.rooms) ||
        !b.rooms.length ||
        b.rooms.length > MAX_ROOMS ||
        !Array.isArray(b.specialRooms) ||
        b.specialRooms.length > services.length
      )
        throw new Error('Ungültiger Gebäudebestand.');
      const counts = new Map();
      const rooms = b.rooms.map((room, index) => {
        if (
          !room ||
          room.id !== `room-${index + 1}` ||
          !Number.isInteger(room.floor) ||
          room.floor < 1 ||
          room.floor > b.floors
        )
          throw new Error('Ungültige oder instabile Raum-ID.');
        counts.set(room.floor, (counts.get(room.floor) || 0) + 1);
        if (counts.get(room.floor) > ROOMS_PER_FLOOR || (index === 0 && room.floor !== 1))
          throw new Error('Ungültige Raumverteilung.');
        if (
          room.rackSlots !== undefined &&
          (index !== 1 || room.floor !== 1 || room.rackSlots !== STAGE_SLOTS)
        )
          throw new Error('Ungültiger Bauabschnitt des Serverraums.');
        return {
          id: room.id,
          floor: room.floor,
          ...(room.rackSlots ? { rackSlots: room.rackSlots } : {}),
        };
      });
      const specialRooms = b.specialRooms.map((id) => {
        if (!services.some((item) => item.id === id)) throw new Error('Ungültiger Technikraum.');
        return id;
      });
      if (new Set(specialRooms).size !== specialRooms.length)
        throw new Error('Doppelter Technikraum.');
      return { version: 1, floors: b.floors, rooms, specialRooms, project: null };
    }

    function normalizeConstruction(s, input) {
      if (input === null) return null;
      if (!input || !constructionTypes.has(input.kind)) throw new Error('Ungültiges Bauprojekt.');
      const b = buildingState(s),
        p = input;
      const validFloor = Number.isInteger(p.floor) && p.floor >= 1 && p.floor <= MAX_FLOORS;
      if (
        !validFloor ||
        (p.kind === 'floor' && (p.floor !== b.floors + 1 || b.floors >= MAX_FLOORS)) ||
        (['room', 'room-stage'].includes(p.kind) &&
          (p.floor > b.floors ||
            b.rooms.length >= MAX_ROOMS ||
            b.rooms.filter((room) => room.floor === p.floor).length >= ROOMS_PER_FLOOR)) ||
        (p.kind === 'room-stage' && (b.rooms.length !== 1 || p.floor !== 1)) ||
        (p.kind === 'fit-out' &&
          !b.rooms.some((r) => r.id === p.roomId && r.rackSlots === STAGE_SLOTS)) ||
        (p.kind === 'service' &&
          (p.floor !== 1 ||
            !services.some((item) => item.id === p.roomType && s.sector >= item.unlockSector) ||
            b.specialRooms.includes(p.roomType)))
      )
        throw new Error('Ungültiges Bauziel.');
      // Cash and operational locks may change after payment. Validate the immutable quote
      // terms, not today's affordability/enabled flag, so a crisis cannot destroy a build.
      const q = constructionQuote(s, p.kind, p.floor, p.kind === 'fit-out' ? p.roomId : p.roomType);
      if (
        p.floor !== q.floor ||
        p.roomId !== q.roomId ||
        (p.roomType ?? null) !== q.roomType ||
        p.total !== q.duration ||
        p.cost !== q.cost ||
        !finite(p.remaining) ||
        p.remaining < 0 ||
        p.remaining > p.total
      )
        throw new Error('Baukosten, Bauzeit oder Bauziel stimmen nicht mit dem Auftrag überein.');
      return {
        kind: p.kind,
        floor: p.floor,
        roomId: q.roomId,
        roomType: q.roomType,
        remaining: p.remaining,
        total: p.total,
        cost: p.cost,
      };
    }

    function getFacilityLayout(s) {
      const building = buildingState(s),
        legacy = !s.facility.building;
      const serverCounts = new Map(),
        assigned = new Map(building.rooms.map((room) => [room.id, []])),
        limits = new Map(building.rooms.map((room) => [room.id, roomRackSlots(room)]));
      for (const server of s.servers)
        serverCounts.set(server.rackId, (serverCounts.get(server.rackId) || 0) + 1);
      s.facility.racks.forEach((rack, index) => {
        const roomId = legacy
          ? building.rooms[Math.floor(index / RACKS_PER_ROOM)]?.id
          : rack.roomId;
        const racks = assigned.get(roomId);
        if (!racks || racks.length >= limits.get(roomId))
          throw new Error('Ungültige Raumzuordnung eines Racks.');
        racks.push(rack.id);
      });
      const rooms = building.rooms.map((room, index) => ({
        ...room,
        supply: { ...context.roomSupply(s, room.id) },
        index,
        number: index + 1,
        rackIds: assigned.get(room.id),
        rackCount: assigned.get(room.id).length,
        rackCapacity: limits.get(room.id),
        serverCount: assigned
          .get(room.id)
          .reduce((sum, id) => sum + (serverCounts.get(id) || 0), 0),
      }));
      const rackCapacity = Math.min(
        MAX_RACKS,
        rooms.reduce((sum, room) => sum + room.rackCapacity, 0),
      );
      return {
        racksPerRoom: RACKS_PER_ROOM,
        roomsPerFloor: ROOMS_PER_FLOOR,
        roomCount: rooms.length,
        floorCount: building.floors,
        rooms,
        specialRooms: [...building.specialRooms],
        rackCapacity,
        sectorRackLimit: rackLimit(s),
        rackLimit: Math.min(rackLimit(s), rackCapacity),
        serverLimit: context.getServerLimit(s),
      };
    }
    return {
      rackLimit,
      roomRackSlots,
      legacyBuilding,
      buildingState,
      serviceRoomOwned,
      constructionQuote,
      quoteConstructionAction,
      addBuiltSpace,
      getBuildingModel,
      getConstructionProject,
      startConstruction,
      advanceConstruction,
      normalizeBuildingSpace,
      normalizeConstruction,
      getFacilityLayout,
    };
  };
});
