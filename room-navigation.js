const names = {
  hall: 'Verbindungsflur',
  control: 'Kontrollraum',
  cooling: 'Zentrale Kühlung',
  ups: 'USV',
  distribution: 'Stromverteilung',
};
export function roomLocation(layout, id, floor = 1) {
  const room = layout.rooms.find((item) => item.id === id);
  if (room)
    return {
      id,
      floor: room.floor,
      name: `Raum ${room.number}`,
      rackIds: room.rackIds,
      ...(room.supply ? { supply: room.supply } : {}),
    };
  const owned = id === 'hall' || !layout.specialRooms || layout.specialRooms.includes(id);
  const safeId = names[id] && owned ? id : 'hall';
  return {
    id: safeId,
    floor: safeId === 'hall' ? Math.max(1, Math.min(layout.floorCount, floor)) : 1,
    name: names[safeId],
    rackIds: [],
  };
}

export function corridorPlan(layout, central, floor) {
  floor = Math.max(1, Math.min(layout.floorCount, floor));
  const destinations = [
    ...(floor === 1 && (!layout.specialRooms || layout.specialRooms.includes('control'))
      ? [{ id: 'control', name: names.control, subtitle: 'Leitstelle / Betrieb' }]
      : []),
    ...layout.rooms
      .filter((room) => room.floor === floor)
      .map((room) => ({
        id: room.id,
        name: `Raum ${room.number}`,
        subtitle: `${room.rackCount} Racks · ${room.serverCount} Server`,
      })),
    ...(floor === 1
      ? central.systems
          .filter((s) => s.available)
          .map((s) => ({ id: s.id, name: s.name, subtitle: `Stufe ${s.level}` }))
      : []),
  ];
  const doors = destinations.map((d, i) => ({
    ...d,
    x: i % 2 ? 2.1 : -2.1,
    z: 2.1 - Math.floor(i / 2) * 3.4,
    turn: i % 2 ? -Math.PI / 2 : Math.PI / 2,
  }));
  const endZ = Math.min(-2.4, 2.1 - Math.ceil(destinations.length / 2) * 3.4);
  const stairs = [
    ...(floor > 1
      ? [{ direction: 'up', floor: floor - 1, x: -1.04, startZ: endZ, endZ: endZ - 3.2, rise: 2.6 }]
      : []),
    ...(floor < layout.floorCount
      ? [
          {
            direction: 'down',
            floor: floor + 1,
            x: 1.04,
            startZ: endZ,
            endZ: endZ - 3.2,
            rise: -2.6,
          },
        ]
      : []),
  ];
  return { floor, doors, stairs, endZ, frontZ: 4.8 };
}

export function stairHeight(stair, z) {
  const fraction = Math.max(0, Math.min(1, (stair.startZ - z) / 3.2));
  // Follow the walkable pitch instead of fourteen abrupt head jolts.
  return fraction * stair.rise;
}
export function readRoomSession(storage, layout, central) {
  try {
    const view = JSON.parse(storage.getItem('root.room.view'));
    if (!view || view.version !== 1 || typeof view.id !== 'string' || !Number.isInteger(view.floor))
      return null;
    const destination = roomLocation(layout, view.id, view.floor);
    if (destination.id !== view.id || destination.floor !== view.floor) return null;
    const system = central.systems.find((item) => item.id === view.id);
    if (system && !system.available) return null;
    if (
      typeof view.exploring !== 'boolean' ||
      !Array.isArray(view.position) ||
      view.position.length !== 3 ||
      !view.position.every(Number.isFinite) ||
      !Number.isFinite(view.yaw) ||
      !Number.isFinite(view.pitch)
    )
      return null;
    return {
      id: view.id,
      floor: view.floor,
      exploring: view.exploring,
      position: view.position,
      yaw: view.yaw % (Math.PI * 2),
      pitch: Math.max(-1.15, Math.min(1.15, view.pitch)),
    };
  } catch {
    return null;
  }
}

// A floor can exist without a server room. Its stairs/selectors still need invalidation.
export function roomStructureKey(layout) {
  return JSON.stringify([
    layout.floorCount,
    layout.rooms.map((room) => [room.id, room.floor, room.rackIds]),
    layout.specialRooms,
  ]);
}
export function roomNavigationKey(layout, central, location, language) {
  return JSON.stringify([
    location.id,
    location.floor,
    layout.floorCount,
    layout.rooms,
    layout.specialRooms,
    central.systems.map((system) => [system.id, system.available]),
    language,
  ]);
}
