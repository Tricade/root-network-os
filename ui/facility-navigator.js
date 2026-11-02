const MAX_RESULTS = 20;
const MAX_FAVORITES = 20;
const FAVORITES_KEY = 'root.facility.navigator.favorites.v1';

const text = (value) => String(value ?? '');
const folded = (value) =>
  text(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();

/** Search current facility entities by stable id and localized display name. */
export function searchFacility(
  layout,
  rackModel,
  query,
  translate = (value) => value,
  limit = MAX_RESULTS,
) {
  const needle = folded(query);
  if (!needle) return [];
  const racks = new Map((rackModel?.racks || []).map((rack) => [rack.id, rack])),
    results = [];
  for (const room of layout?.rooms || []) {
    const roomName = `${translate('Untergeschoss')} ${room.floor} · ${translate('Raum')} ${room.number}`;
    results.push({
      id: `room:${room.id}`,
      kind: 'room',
      roomId: room.id,
      floor: room.floor,
      label: roomName,
      search: `${roomName} ${room.id}`,
    });
    for (const rackId of room.rackIds || []) {
      const rack = racks.get(rackId);
      if (!rack) continue;
      const rackName = `${translate('Rack')} ${rack.name}`;
      results.push({
        id: `rack:${rack.id}`,
        kind: 'rack',
        roomId: room.id,
        rackId: rack.id,
        floor: room.floor,
        label: rackName,
        search: `${rackName} ${rack.id} ${roomName}`,
      });
      for (const server of rack.servers || []) {
        const serverName = translate.serverName?.(server) || translate(server.name);
        results.push({
          id: `server:${server.id}`,
          kind: 'server',
          roomId: room.id,
          rackId: rack.id,
          serverId: server.id,
          floor: room.floor,
          label: serverName,
          search: `${serverName} ${server.id} ${rackName} ${roomName}`,
        });
      }
    }
  }
  return results
    .filter((item) => folded(item.search).includes(needle))
    .slice(0, Math.max(0, Math.min(MAX_RESULTS, limit)));
}

/** UI-only location, rack and device navigator for the facility view. */
export function createFacilityNavigator(ctx, { selectFloor } = {}) {
  let query = '',
    selectedId = null,
    visibleFloor = 1;
  const esc = (value) => ctx.esc(value),
    tr = (value) => ctx.tr(value),
    getFavorites = () => {
      try {
        const parsed = JSON.parse(ctx.storageGet(FAVORITES_KEY) || '[]');
        return Array.isArray(parsed)
          ? [
              ...new Set(
                parsed.filter(
                  (id) => typeof id === 'string' && /^(room|rack|server):[^:]+$/.test(id),
                ),
              ),
            ].slice(0, MAX_FAVORITES)
          : [];
      } catch {
        return [];
      }
    },
    setFavorites = (ids) => {
      try {
        ctx.storageSet(FAVORITES_KEY, JSON.stringify([...new Set(ids)].slice(0, MAX_FAVORITES)));
      } catch {
        // Favorites are optional UI state; storage failures do not affect navigation.
      }
    },
    currentEntities = (layout, rackModel) => {
      const map = new Map(),
        racksById = new Map(rackModel.racks.map((rack) => [rack.id, rack]));
      for (const room of layout.rooms || []) {
        map.set(`room:${room.id}`, {
          id: `room:${room.id}`,
          kind: 'room',
          roomId: room.id,
          floor: room.floor,
          label: `${tr('Untergeschoss')} ${room.floor} · ${tr('Raum')} ${room.number}`,
          room,
        });
        for (const rackId of room.rackIds || []) {
          const rack = racksById.get(rackId);
          if (!rack) continue;
          map.set(`rack:${rack.id}`, {
            id: `rack:${rack.id}`,
            kind: 'rack',
            roomId: room.id,
            rackId: rack.id,
            floor: room.floor,
            label: rack.name,
            room,
            rack,
          });
          for (const server of rack.servers || [])
            map.set(`server:${server.id}`, {
              id: `server:${server.id}`,
              kind: 'server',
              roomId: room.id,
              rackId: rack.id,
              serverId: server.id,
              floor: room.floor,
              label: ctx.I18N?.serverName?.(server) || server.name,
              room,
              rack,
              server,
            });
        }
      }
      return map;
    };

  function markup(layout, building, selectedFloor) {
    visibleFloor = selectedFloor;
    const rackModel = ctx.E.getRackModel(ctx.state),
      entities = currentEntities(layout, rackModel),
      translator = (value) => tr(value);
    translator.serverName = (server) => ctx.I18N?.serverName?.(server) || server.name;
    const searchResults = searchFacility(layout, rackModel, query, translator),
      favorites = getFavorites()
        .map((id) => entities.get(id))
        .filter(Boolean),
      selected = entities.get(selectedId) || null,
      room = selected && entities.get(`room:${selected.roomId}`)?.room,
      racks = room
        ? (room.rackIds || [])
            .map((id) => rackModel.racks.find((item) => item.id === id))
            .filter(Boolean)
        : [],
      selectedRack = selected?.rack || (selected?.kind === 'room' ? racks[0] : null),
      devices = selectedRack?.servers || [];
    const row = (item) =>
      `<li class="facility-nav-result"><button class="text-button" data-facility-node="${esc(item.id)}"><span>${esc(tr({ room: 'Raum', rack: 'Rack', server: 'Server' }[item.kind]))}</span><strong>${esc(item.label)}</strong></button><button class="text-button facility-favorite ${getFavorites().includes(item.id) ? 'active' : ''}" data-facility-favorite="${esc(item.id)}" aria-label="${esc(tr(getFavorites().includes(item.id) ? 'Favorit entfernen' : 'Als Favorit speichern'))}" aria-pressed="${getFavorites().includes(item.id)}">${getFavorites().includes(item.id) ? '★' : '☆'}</button></li>`;
    const selectedMarkup = selected
      ? `<section class="facility-nav-selection" aria-live="polite"><div class="facility-nav-path"><span>${esc(tr('Standort'))}</span> › <span>${esc(tr('Untergeschoss'))} ${selected.floor}</span> › <strong>${esc(tr('Raum'))} ${room?.number ?? ''}</strong>${selectedRack ? ` › <span>${esc(selectedRack.name)}</span>` : ''}${selected.server ? ` › <strong>${esc(ctx.I18N?.serverName?.(selected.server) || selected.server.name)}</strong>` : ''}</div><h3>${esc(selected.kind === 'room' ? `${tr('Raum')} ${room?.number ?? ''}` : selected.kind === 'rack' ? selectedRack?.name : ctx.I18N?.serverName?.(selected.server) || selected.server?.name || '')}</h3><p>${room ? `${room.rackCount} ${esc(tr('Racks'))} · ${room.serverCount} ${esc(tr('Server'))}` : ''}</p><div class="facility-nav-racks">${racks.map((rack) => `<button class="button small ${rack.id === selectedRack?.id ? 'selected' : ''}" data-facility-node="rack:${esc(rack.id)}" aria-pressed="${rack.id === selectedRack?.id}">${esc(rack.name)} · ${rack.servers.length} ${esc(tr('Server'))}</button>`).join('') || `<span>${esc(tr('Keine Racks installiert'))}</span>`}</div>${
          selectedRack
            ? `<ul class="facility-nav-devices">${devices
                .slice(0, MAX_RESULTS)
                .map(
                  (server) =>
                    `<li><button class="text-button" data-facility-node="server:${esc(server.id)}"><strong>${esc(ctx.I18N?.serverName?.(server) || server.name)}</strong><span>${esc(tr({ online: 'Online', failed: 'Defekt', maintenance: 'Wartung', repairing: 'Reparatur', standby: 'Standby', disconnected: 'Getrennt', booting: 'Startet' }[server.status] || 'Unbekannt'))}</span></button></li>`,
                )
                .join(
                  '',
                )}${devices.length > MAX_RESULTS ? `<li>${esc(tr('Weitere Geräte'))}: ${devices.length - MAX_RESULTS}</li>` : ''}</ul>`
            : ''
        }<button class="button primary" data-facility-open="${esc(selected.id)}">${esc(tr('Hardware verwalten'))}</button><button class="text-button" data-facility-favorite="${esc(selected.id)}">${esc(tr(getFavorites().includes(selected.id) ? 'Favorit entfernen' : 'Als Favorit speichern'))}</button></section>`
      : `<p class="facility-nav-empty">${esc(tr('Wähle eine Etage, einen Raum, ein Rack oder ein Gerät aus.'))}</p>`;
    return `<section class="panel facility-navigator" data-facility-navigator><div class="panel-body"><div class="section-heading"><div><h2>${esc(tr('Standortnavigator'))}</h2><p>${esc(tr('Suche Räume, Racks und Geräte oder öffne einen gespeicherten Favoriten.'))}</p></div></div><label class="field-label">${esc(tr('Raum, Rack oder Server suchen'))}<input class="input" type="search" data-facility-search value="${esc(query)}" autocomplete="off" maxlength="100"></label>${query ? `<ul class="facility-nav-results">${searchResults.map(row).join('') || `<li>${esc(tr('Keine Treffer'))}</li>`}</ul><small>${searchResults.length} / ${MAX_RESULTS} ${esc(tr('Treffer höchstens'))}</small>` : ''}${favorites.length ? `<div class="facility-nav-favorites"><h3>${esc(tr('Favoriten'))}</h3><ul>${favorites.map(row).join('')}</ul></div>` : ''}${selectedMarkup}</div></section>`;
  }

  function choose(id, layout, rackModel) {
    const entity = currentEntities(layout, rackModel).get(id);
    if (!entity) return false;
    if (selectFloor && !selectFloor(entity.floor)) return false;
    if (entity.kind === 'room') {
      if (!ctx.R.selectRoom(entity.roomId)) return false;
    } else if (!ctx.R.select(entity.rackId, entity.serverId)) return false;
    selectedId = entity.id;
    ctx.selectRoomOperations?.(entity.roomId);
    ctx.selectCustomerRoom?.(entity.roomId);
    return true;
  }

  function click(target) {
    if (
      !target.dataset.facilityFavorite &&
      !target.dataset.facilityOpen &&
      !target.dataset.facilityNode
    )
      return false;
    const layout = ctx.E.getFacilityLayout(ctx.state),
      rackModel = ctx.E.getRackModel(ctx.state);
    if (target.dataset.facilityFavorite) {
      const id = target.dataset.facilityFavorite,
        favorites = getFavorites();
      setFavorites(
        favorites.includes(id)
          ? favorites.filter((value) => value !== id)
          : [id, ...favorites].slice(0, MAX_FAVORITES),
      );
      ctx.render();
      return true;
    }
    if (target.dataset.facilityOpen) {
      if (choose(target.dataset.facilityOpen, layout, rackModel)) ctx.navigate('network');
      return true;
    }
    if (target.dataset.facilityNode) {
      if (choose(target.dataset.facilityNode, layout, rackModel)) ctx.render();
      return true;
    }
    return false;
  }

  function change(target) {
    if (target.hasAttribute?.('data-facility-search')) {
      query = target.value.slice(0, 100);
      return true;
    }
    return false;
  }

  function input(target) {
    if (!target.hasAttribute?.('data-facility-search')) return false;
    query = target.value.slice(0, 100);
    const root = target.closest('[data-facility-navigator]');
    if (root) {
      const replacement = document.createElement('div');
      replacement.innerHTML = markup(
        ctx.E.getFacilityLayout(ctx.state),
        ctx.E.getBuildingModel(ctx.state),
        visibleFloor,
      );
      const next = replacement.firstElementChild;
      root.replaceWith(next);
      const input = next.querySelector('[data-facility-search]');
      input?.focus();
      input?.setSelectionRange(query.length, query.length);
    }
    return true;
  }

  return { markup, click, change, input };
}
