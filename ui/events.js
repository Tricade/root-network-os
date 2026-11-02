/** Delegated document events; feature actions still pass through the engine. */
export function createEventsUI(ctx, platform = globalThis) {
  function bindEvents() {
    platform.document.addEventListener('click', (event) => {
      const target = event.target.closest(
        'button,[data-nav],[data-modal],[data-command],[data-rack-command]',
      );
      if (!target) {
        if (event.target.dataset.backdrop) ctx.closeModal();
        return;
      }
      if (target.disabled || ctx.desktopClosing?.()) return;
      if (target.dataset.dashboardTour !== undefined) return ctx.Room.enter();
      if (ctx.notificationClick?.(target)) return;
      if (ctx.attentionClick?.(target)) return;
      if (ctx.dashboardClick?.(target)) return;
      if (ctx.workforceClick?.(target)) return;
      if (ctx.facilityClick?.(target)) return;
      if (ctx.agentDevelopmentClick?.(target)) return;
      if (ctx.researchClick?.(target)) return;
      if (ctx.personnelClick?.(target)) return;
      if (ctx.growthClick?.(target)) return;
      if (ctx.preventiveClick?.(target)) return;
      if (ctx.businessClick?.(target)) return;
      if (ctx.operationsClick?.(target)) return;
      if (ctx.handleDesktopCommand?.(target.dataset.desktopCommand)) return;
      const hardware = ctx.R.click(target);
      if (hardware) {
        if (hardware.modal) ctx.openModal(hardware.modal, hardware.extra);
        else if (hardware.action) ctx.execute(hardware.action, hardware.payload);
        else if (hardware.render) ctx.render();
        return;
      }
      if (target.dataset.facilityVisit) {
        const destination = target.dataset.facilityVisit;
        const floor = Number(target.dataset.facilityFloor || 1);
        if (ctx.Room.isInRoom()) {
          ctx.Room.closeConsole();
          ctx.Room.changeLocation(destination, floor);
        } else {
          ctx.navigate('overview');
          ctx.Room.changeLocation(destination, floor);
        }
        return;
      }
      if (target.dataset.buildingHardware) {
        ctx.R.selectRoom(target.dataset.buildingHardware);
        ctx.navigate('network');
        return;
      }
      if (target.dataset.nav) return ctx.navigate(target.dataset.nav);
      if (target.dataset.modal)
        return ctx.openModal(
          target.dataset.modal,
          target.dataset.modal === 'incident-confirm' ? target.dataset.choice : target.dataset.id,
        );
      if (target.dataset.filter) {
        ctx.logFilter = target.dataset.filter;
        ctx.render();
        return;
      }
      if (target.dataset.action) {
        const p = {};
        for (const key of ['id', 'type', 'role', 'key', 'value', 'choice', 'method', 'mission'])
          if (target.dataset[key] !== undefined) p[key] = target.dataset[key];
        if (p.key === 'autocontract' || p.key === 'autorepair' || p.key === 'autobackup')
          p.value = p.value === 'true';
        return ctx.execute(target.dataset.action, p);
      }
      const command = target.dataset.command;
      if (command === 'replay-arrival') {
        ctx.closeModal();
        ctx.navigate('overview');
        ctx.Room.startArrival(true);
        return;
      }
      if (command === 'close') ctx.closeModal();
      if (command === 'menu') {
        ctx.$('.sidebar').classList.toggle('open');
        ctx.$('.mobile-overlay').classList.toggle('open');
      }
      if (command === 'menu-close') ctx.hideMobile();
      if (command === 'hide-guide') {
        ctx.hideGuide = true;
        ctx.storageSet('root.guide.hidden', '1');
        ctx.render();
      }
      if (command === 'export') {
        return Promise.resolve(ctx.exportSave()).then(() =>
          ctx.toast('Netzwerkstand als Datei exportiert.'),
        );
      }
      if (command === 'export-conflict') {
        const body = ctx.storageGet('root.conflict.save');
        if (body) {
          const url = platform.URL.createObjectURL(
              new platform.Blob([body], { type: 'application/json' }),
            ),
            link = platform.document.createElement('a');
          link.href = url;
          link.download = 'ROOT-abweichende-Browserkopie.json';
          link.click();
          setTimeout(() => platform.URL.revokeObjectURL(url), 1500);
        }
        return;
      }
      if (command === 'reload') {
        platform.location.reload();
        return;
      }
      if (command === 'import') ctx.$('#import-file').click();
      if (command === 'save') {
        ctx.simulate();
        ctx.save().then((result) => {
          if (result?.persisted) ctx.toast('Netzwerkstand gespeichert.');
          else if (result?.status === 'conflict')
            ctx.toast('Diese Sitzung pausiert. Bitte lade den Serverstand neu.', true);
          else ctx.toast('Stand nur im Browser gesichert; Serverbestätigung fehlt.', true);
        });
      }
      if (command === 'reset-confirm')
        return ctx.replaceState(ctx.E.createState(Math.floor(Math.random() * 0xffffffff)));
      if (command === 'import-confirm' && ctx.importing) {
        if (ctx.saveConflict) {
          ctx.toast('Diese Sitzung pausiert. Lade zuerst den aktuellen Serverstand neu.', true);
          return;
        }
        const next = ctx.importing;
        ctx.importing = null;
        return ctx.replaceState(next);
      }
    });
    platform.document.addEventListener('input', (event) => {
      if (ctx.desktopClosing?.()) return;
      if (ctx.operationsInput?.(event.target)) return;
      if (ctx.businessInput?.(event.target)) return;
      ctx.facilityInput?.(event.target);
    });
    platform.document.addEventListener('change', (event) => {
      if (ctx.desktopClosing?.()) return;
      if (ctx.achievementChange?.(event.target)) return;
      if (ctx.notificationChange?.(event.target)) return;
      if (ctx.attentionChange?.(event.target)) return;
      if (ctx.businessChange?.(event.target)) return;
      if (ctx.workforceChange?.(event.target)) return;
      if (ctx.facilityChange?.(event.target)) return;
      if (ctx.growthChange?.(event.target)) return;
      if (ctx.preventiveChange?.(event.target)) return;
      if (ctx.operationsChange?.(event.target)) return;
      if (event.target.hasAttribute('data-building-floor')) {
        if (ctx.selectFacilityFloor(event.target.value)) ctx.render();
        return;
      }
      if (event.target.dataset.change === 'arrival') {
        ctx.storageSet('root.arrival.enabled', event.target.checked ? '1' : '0');
        return;
      }
      if (event.target.dataset.change === 'language') {
        ctx.I18N.setLanguage(event.target.value);
        ctx.syncDesktopLanguage?.();
        ctx.Room.update();
        ctx.render();
        if (ctx.modal?.type === 'settings') ctx.openModal('settings');
        return;
      }
      const el = event.target,
        hardware = ctx.R.change(el);
      if (hardware) {
        if (hardware.render) {
          event.target.blur();
          ctx.render();
        }
        if (hardware.refreshModal && ctx.modal) ctx.openModal(ctx.modal.type, ctx.modal.extra);
        return;
      }
      if (el.dataset.change === 'server-mode')
        ctx.execute('setServerMode', { id: el.dataset.id, mode: el.value });
      if (el.dataset.change === 'agent-focus')
        ctx.execute('setAgentFocus', { id: el.dataset.id, focus: el.value });
      if (el.dataset.change === 'protection-policy')
        ctx.execute('setPolicy', { key: el.dataset.key, value: Number(el.value) });
    });
    platform.document.addEventListener('focusout', () => {
      if (ctx.renderPending)
        setTimeout(() => {
          if (ctx.renderPending) ctx.render();
        }, 0);
    });
    platform.document.addEventListener('submit', (event) => {
      if (event.target.id === 'rename-form') {
        event.preventDefault();
        ctx.execute('renameNetwork', { name: ctx.$('#network-name').value });
      }
    });
    platform.document.addEventListener('keydown', (event) => {
      // The native picker owns Escape/Tab until it closes; keep its parent dialog open.
      if (
        event.defaultPrevented ||
        (platform.CSS?.supports('selector(select:open)') &&
          platform.document.querySelector('select:open'))
      )
        return;
      if (
        !ctx.modal &&
        (ctx.Room.isExploring() ||
          ctx.Room.isArriving() ||
          (ctx.Room.isConsoleOpen() && event.key === 'Escape'))
      )
        return;
      if (event.key === 'Escape') {
        ctx.closeModal();
        ctx.hideMobile();
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (ctx.modal && event.key === 'Tab') {
        const focusables = ctx.$$(
          'button:not(:disabled),input,select,[tabindex="0"]',
          ctx.$('.modal'),
        );
        const first = focusables[0],
          last = focusables.at(-1);
        if (
          event.shiftKey &&
          (platform.document.activeElement === first ||
            platform.document.activeElement === ctx.$('.modal'))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (platform.document.activeElement === last ||
            platform.document.activeElement === ctx.$('.modal'))
        ) {
          event.preventDefault();
          first?.focus();
        }
        return;
      }
      if (
        /^(INPUT|SELECT|TEXTAREA)$/.test(platform.document.activeElement?.tagName) ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey
      )
        return;
      if (event.key === '?' && !ctx.modal) ctx.openModal('help');
      if (!ctx.modal && /^[1-9]$/.test(event.key)) ctx.navigate(ctx.navs[Number(event.key) - 1][0]);
      if (
        (event.key === 'Enter' || event.key === ' ') &&
        platform.document.activeElement?.classList.contains('topology-node')
      ) {
        event.preventDefault();
        platform.document.activeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });
    ctx.$('#import-file').addEventListener('change', async (event) => {
      const file = event.target.files[0];
      event.target.value = '';
      if (!file) return;
      if (file.size > 16 * 1024 * 1024) {
        ctx.toast('Der Netzwerkstand ist zu groß. Maximal 16 MiB.', true);
        return;
      }
      try {
        ctx.importing = ctx.E.normalizeState(JSON.parse(await file.text()));
        ctx.openModal('import');
      } catch (error) {
        ctx.toast('Ungültiger Netzwerkstand: ' + error.message, true);
      }
    });
    platform.document.addEventListener('visibilitychange', () => {
      if (!ctx.initialized || ctx.desktopClosing?.()) return;
      const report = ctx.simulate();
      if (platform.document.hidden) ctx.save(true);
      else {
        ctx.render();
        ctx.save();
        if (report?.seconds > 90) ctx.openModal('offline', report);
      }
    });
    platform.window.addEventListener('pagehide', () => {
      if (ctx.initialized && !ctx.desktopClosing?.()) {
        ctx.simulate();
        ctx.save(true);
      }
    });
    platform.window.addEventListener('pageshow', (event) => {
      if (event.persisted && ctx.initialized) {
        ctx.simulate();
        ctx.render();
        ctx.save();
      }
    });
  }
  return { bindEvents };
}
