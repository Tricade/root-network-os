import { createCustomerGrowthUI } from './ui/customer-growth.js';
import { createPreventiveMaintenanceUI } from './ui/preventive-maintenance.js';
import { NAVIGATION_ITEMS } from './ui/navigation.js';
import { createNavigationState } from './ui/navigation-state.js';
import { createAchievementsUI } from './ui/achievements.js';
import { createRacks } from './rack-ui.js';
import { createUIFoundation } from './ui/foundation.js';
import { createChromeUI } from './ui/chrome.js';
import { createOverviewUI } from './ui/overview.js';
import { createDashboardUI } from './ui/dashboard.js';
import { createAgentDevelopmentUI } from './ui/agent-development.js';
import { createWorkforceUI } from './ui/workforce.js';
import { createPersonnelUI } from './ui/personnel.js';
import { createWorkloadsUI } from './ui/workloads.js';
import { createResearchUI } from './ui/research.js';
import { createBusinessUI } from './ui/business.js';
import { createRoomOperationsUI } from './ui/room-operations.js';
import { selectWorkspaceRoom } from './ui/room-context.js';
import { createOperationsUI } from './ui/operations.js';
import { createOfflineUI } from './ui/offline.js';
import { createProtectionUI } from './ui/protection.js';
import { createDialogsUI } from './ui/dialogs.js';
import { createTelemetryUI } from './ui/telemetry.js';
import { createPersistenceUI } from './ui/persistence.js';
import { createNotificationsUI } from './ui/notifications.js';
import { createFacilityUI } from './ui/facility.js';
import { createEventsUI } from './ui/events.js';
import { createDesktopUI } from './ui/desktop.js';
import { createRoom } from './room.js';
/* ROOT · Local network simulation · no external services */
(() => {
  'use strict';
  const E = window.RootEngine;
  const I18N = window.ROOTI18N;
  const {
    tr,
    $,
    $$,
    esc,
    fmt,
    dec,
    compact,
    duration,
    clock,
    icon,
    navs,
    focusNames,
    modeNames,
    kindNames,
    kindIcons,
    roleClass,
  } = createUIFoundation(I18N);
  const STORAGE = 'root.network.save.v1';
  const navigationState = createNavigationState();
  let state,
    view = 'overview',
    modal = null,
    lastFocus = null,
    lastTick = Date.now(),
    lastSave = 0;
  let saveBusy = false,
    savePending = null,
    saveDrainPromise = null,
    saveMode = 'ready',
    saveError = '',
    diskAvailable = true,
    initialized = false,
    importing = null,
    logFilter = 'all',
    hideGuide = false;
  let remoteRevision = null,
    saveConflict = false;
  let signature = '',
    renderPending = false,
    lastChartTime = -1;
  const pendingAchievements = () =>
    E.catalog.achievements.filter(
      (a) => !state.achievements[a.id] && (state.achievementUnlocks?.[a.id] || a.check(state)),
    );
  const R = createRacks({ E, icon, esc, fmt, dec, duration, tr, getState: () => state });
  const Room = createRoom({
    E,
    esc,
    fmt,
    dec,
    getState: () => state,
    openRack: (id) => {
      R.select(id);
      navigate('network');
    },
    openServer: (rackId, id) => {
      R.select(rackId, id);
      navigate('network');
    },
    openProtection: () => navigate('resilience'),
    openView: (id, roomId) => {
      selectWorkspaceRoom(ctx, roomId);
      navigate(id);
    },
    onExit: () => {
      view = 'overview';
      requestAnimationFrame(() => render());
    },
    onArrivalComplete: () => {
      view = 'overview';
      requestAnimationFrame(() => {
        render();
        window.scrollTo(0, 0);
        $('#main').focus({ preventScroll: true });
      });
    },
  });
  let seenAchievements = new Set();

  const agentOperations = () => E.getAgentOperations(state);
  const agentSignature = () => {
    const a = agentOperations();
    return (
      a.agents
        .map(
          (x) => x.id + ':' + (x.assignment?.kind || '') + ':' + (x.cooldown > 0) + ':' + x.absent,
        )
        .join('|') +
      '|' +
      a.effects.map((x) => x.kind).join(',')
    );
  };

  const newServer = () =>
    `<button class="button primary" data-modal="servers">${icon('plus')}Server hinzufügen</button>`;

  const serverStatusNames = { ...R.statusNames, failed: 'Ausgefallen' };

  // The controller owns shared UI state. Getters keep async callbacks and mounted
  // feature modules on the same current save rather than capturing an old object.
  const ctx = {
    get $$() {
      return $$;
    },
    get $() {
      return $;
    },
    get E() {
      return E;
    },
    get I18N() {
      return I18N;
    },
    get R() {
      return R;
    },
    get Room() {
      return Room;
    },
    get STORAGE() {
      return STORAGE;
    },
    get agentOperations() {
      return agentOperations;
    },
    get agentSignature() {
      return agentSignature;
    },
    get clock() {
      return clock;
    },
    get compact() {
      return compact;
    },
    get dec() {
      return dec;
    },
    get diskAvailable() {
      return diskAvailable;
    },
    set diskAvailable(value) {
      diskAvailable = value;
    },
    get duration() {
      return duration;
    },
    get esc() {
      return esc;
    },
    get execute() {
      return execute;
    },
    get fmt() {
      return fmt;
    },
    get focusNames() {
      return focusNames;
    },
    get hideGuide() {
      return hideGuide;
    },
    set hideGuide(value) {
      hideGuide = value;
    },
    get hideMobile() {
      return hideMobile;
    },
    get icon() {
      return icon;
    },
    get importing() {
      return importing;
    },
    set importing(value) {
      importing = value;
    },
    get initialized() {
      return initialized;
    },
    set initialized(value) {
      initialized = value;
    },
    get kindIcons() {
      return kindIcons;
    },
    get kindNames() {
      return kindNames;
    },
    get lastChartTime() {
      return lastChartTime;
    },
    set lastChartTime(value) {
      lastChartTime = value;
    },
    get lastFocus() {
      return lastFocus;
    },
    set lastFocus(value) {
      lastFocus = value;
    },
    get lastSave() {
      return lastSave;
    },
    set lastSave(value) {
      lastSave = value;
    },
    get lastTick() {
      return lastTick;
    },
    set lastTick(value) {
      lastTick = value;
    },
    get logFilter() {
      return logFilter;
    },
    set logFilter(value) {
      logFilter = value;
    },
    get modal() {
      return modal;
    },
    set modal(value) {
      modal = value;
    },
    get modeNames() {
      return modeNames;
    },
    get navigate() {
      return navigate;
    },
    get navs() {
      return navs;
    },
    get newServer() {
      return newServer;
    },
    get pendingAchievements() {
      return pendingAchievements;
    },
    get remoteRevision() {
      return remoteRevision;
    },
    set remoteRevision(value) {
      remoteRevision = value;
    },
    get render() {
      return render;
    },
    get renderPending() {
      return renderPending;
    },
    set renderPending(value) {
      renderPending = value;
    },
    get roleClass() {
      return roleClass;
    },
    get saveBusy() {
      return saveBusy;
    },
    set saveBusy(value) {
      saveBusy = value;
    },
    get saveConflict() {
      return saveConflict;
    },
    set saveConflict(value) {
      saveConflict = value;
    },
    get saveDrainPromise() {
      return saveDrainPromise;
    },
    set saveDrainPromise(value) {
      saveDrainPromise = value;
    },
    get saveError() {
      return saveError;
    },
    set saveError(value) {
      saveError = value;
    },
    get saveMode() {
      return saveMode;
    },
    set saveMode(value) {
      saveMode = value;
    },
    get savePending() {
      return savePending;
    },
    set savePending(value) {
      savePending = value;
    },
    get seenAchievements() {
      return seenAchievements;
    },
    set seenAchievements(value) {
      seenAchievements = value;
    },
    get serverStatusNames() {
      return serverStatusNames;
    },
    get signature() {
      return signature;
    },
    set signature(value) {
      signature = value;
    },
    get state() {
      return state;
    },
    set state(value) {
      state = value;
    },
    get tr() {
      return tr;
    },
    get view() {
      return view;
    },
    set view(value) {
      view = value;
    },
  };
  Object.assign(ctx, createChromeUI(ctx));
  Object.assign(ctx, createOverviewUI(ctx));
  Object.assign(ctx, createDashboardUI(ctx));
  Object.assign(ctx, createAgentDevelopmentUI(ctx));
  Object.assign(ctx, createPersonnelUI(ctx));
  Object.assign(ctx, createWorkforceUI(ctx));
  Object.assign(ctx, createWorkloadsUI(ctx));
  Object.assign(ctx, createResearchUI(ctx));
  Object.assign(ctx, createCustomerGrowthUI(ctx));
  Object.assign(ctx, createPreventiveMaintenanceUI(ctx));
  Object.assign(ctx, createBusinessUI(ctx));
  Object.assign(ctx, createRoomOperationsUI(ctx));
  Object.assign(ctx, createOperationsUI(ctx));
  Object.assign(ctx, createOfflineUI(ctx));
  Object.assign(ctx, createProtectionUI(ctx));
  Object.assign(ctx, createDialogsUI(ctx));
  Object.assign(ctx, createTelemetryUI(ctx));
  Object.assign(ctx, createPersistenceUI(ctx));
  Object.assign(ctx, createNotificationsUI(ctx));
  Object.assign(ctx, createFacilityUI(ctx));
  Object.assign(ctx, createEventsUI(ctx));
  Object.assign(ctx, createDesktopUI(ctx));
  Object.assign(ctx, createAchievementsUI(ctx));
  const viewFunctions = Object.fromEntries(
    NAVIGATION_ITEMS.map(([id, , , renderer]) => [id, ctx[renderer]]),
  );

  function render() {
    if (!state) return;
    if (Room.isInRoom() && !Room.isConsoleOpen()) {
      renderPending = true;
      ctx.updateLive();
      return;
    }
    if (
      document.activeElement &&
      /^(SELECT|INPUT)$/.test(document.activeElement.tagName) &&
      !modal
    ) {
      renderPending = true;
      ctx.updateLive();
      return;
    }
    const roomMode = Room.isInRoom(),
      container = roomMode ? Room.consoleBody() : $('#main');
    const scrollPosition = roomMode ? container.scrollTop : window.scrollY;
    const openDetails = new Set(
      [...container.querySelectorAll('[data-persist-details][open]')].map(
        (el) => el.dataset.persistDetails,
      ),
    );
    const protection = E.getResilience(state);
    const alert =
      protection.incident && !['overview', 'resilience'].includes(view)
        ? `<aside class="protection-banner" role="status"><span class="signal-icon">${icon('shield')}</span><div><strong>${esc(protection.incident.title)}</strong><span>Schutzmodus aktiv. Weitere Schäden sind gestoppt; eine Entscheidung wartet auf dich.</span></div><button class="button small" data-nav="resilience">Vorfall öffnen${icon('arrow')}</button></aside>`
        : protection.failed > 0 && !['overview', 'resilience'].includes(view)
          ? `<aside class="protection-banner warning" role="status"><span class="signal-icon">${icon('server')}</span><div><strong>${protection.failed} Server ausgefallen</strong><span>Kapazität und Einnahmen sind reduziert. Prüfe die verfügbaren Reparaturen.</span></div><button class="button small" data-nav="resilience">Betrieb & Schutz${icon('arrow')}</button></aside>`
          : '';
    const rewards = pendingAchievements();
    const rewardAlert =
      rewards.length && !['overview', 'achievements'].includes(view)
        ? `<aside class="reward-banner" role="status">${icon('trophy')}<div><strong>${rewards.length === 1 ? 'Ein Erfolg wartet auf dich' : rewards.length + ' Erfolge warten auf dich'}</strong><span>${rewards.map((a) => '<span>' + esc(a.name) + '</span>').join(' · ')} · ${ctx.stat('achievementReward')} <span>CR abholbereit</span></span></div><button class="button small" data-nav="achievements">Belohnung abholen${icon('arrow')}</button></aside>`
        : '';
    container.innerHTML = `${saveError ? `<div class="save-warning" role="status">${esc(saveError)}${saveConflict ? '<button class="button small" data-command="reload">Aktuellen Stand laden</button>' : ''}</div>` : ''}${alert}${rewardAlert}<div class="view-content">${roomMode && view === 'overview' ? ctx.consoleOverviewView() : viewFunctions[view]()}</div><footer class="bottom-caption"><span><i class="live-dot"></i>${ctx.stat('systemStatus')} · ${ctx.stat('runtime')}</span><span>DEIN NETZWERK. DEINE REGELN.</span></footer>`;
    $$('.nav-item[data-nav]').forEach((el) => {
      el.classList.toggle('active', el.dataset.nav === view);
      if (el.dataset.nav === view) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
    $('#breadcrumb').textContent = tr(navs.find((n) => n[0] === view)[2]);
    window.ROOTI18N?.localize?.($('#app'));
    if (roomMode) Room.setConsoleTitle(navs.find((n) => n[0] === view)[2], view);
    else if (view === 'overview') Room.mount();
    else Room.hide();
    container.querySelectorAll('[data-persist-details]').forEach((el) => {
      el.open = openDetails.has(el.dataset.persistDetails);
    });
    ctx.mountResearch?.(container);
    signature = ctx.stateSignature();
    renderPending = false;
    ctx.updateLive();
    if (roomMode) container.scrollTop = scrollPosition;
    else window.scrollTo(0, scrollPosition);
  }

  function navigate(next) {
    if (!viewFunctions[next]) return;
    const mode = Room.isInRoom() ? 'console' : 'web';
    navigationState.remember(
      view,
      mode,
      mode === 'console' ? Room.consoleBody()?.scrollTop : window.scrollY,
    );
    if (Room.isInRoom()) {
      view = next;
      ctx.closeModal();
      document.activeElement?.blur();
      Room.openConsole(navs.find((n) => n[0] === view)[2]);
      render();
      Room.consoleBody().scrollTop = navigationState.restore(next, mode);
      return;
    }
    Room.hide();
    view = next;
    hideMobile();
    ctx.closeModal();
    document.activeElement?.blur();
    render();
    window.scrollTo(0, navigationState.restore(next, mode));
  }
  function hideMobile() {
    $('.sidebar')?.classList.remove('open');
    $('.mobile-overlay')?.classList.remove('open');
  }

  function execute(action, payload) {
    if (ctx.desktopClosing()) return;
    if (saveConflict) {
      ctx.toast('Diese Sitzung pausiert. Bitte Seite neu laden.', true);
      return;
    }
    const simulation = ctx.simulate();
    if (simulation?.then || ctx.catchUpBusy() || ctx.catchUpFailed()) {
      ctx.toast('Bitte warte, bis die Abwesenheit nachberechnet wurde.', true);
      return;
    }
    const result = E.act(state, action, payload);
    if (!result.ok) {
      ctx.toast(result.message, true);
      ctx.updateLive();
      return;
    }
    render();
    if (modal) {
      if (modal.type.startsWith('hardware-')) ctx.closeModal();
      else if (action === 'buyServer' || action === 'recruitAgent' || action === 'pinCandidate')
        ctx.openModal(modal.type, modal.extra);
      else if (
        [
          'expandSector',
          'renameNetwork',
          'repairServer',
          'resolveIncident',
          'dispatchAgent',
          'upgradeAgent',
          'hireCandidate',
          'dismissAgent',
        ].includes(action)
      )
        ctx.closeModal();
    }
    ctx.save();
    ctx.toast(result.message);
    ctx.announceAchievements();
  }

  ctx.bindEvents();

  async function start() {
    try {
      if (navigator.locks && location.protocol !== 'file:') {
        await navigator.locks.request(
          'root-active-session',
          { ifAvailable: true },
          async (lock) => {
            if (!lock) {
              $('#app').innerHTML =
                `<div class="boot"><div class="boot-logo">root<span class="brand-dot">.</span></div><p>Dein Netzwerk ist bereits in einem anderen Tab geöffnet.</p><p>Schließe den anderen ROOT-Tab und lade diese Seite neu.</p><button class="button" id="retry-boot">Erneut verbinden</button></div>`;
              $('#retry-boot').addEventListener('click', () => location.reload());
              return;
            }
            await ctx.boot();
            await new Promise(() => {});
          },
        );
      } else await ctx.boot();
    } catch (error) {
      $('#app').innerHTML =
        `<div class="boot"><div class="boot-logo">root<span class="brand-dot">.</span></div><p>${esc(error.message)}</p><p>Starte ROOT über „ROOT starten“ im Desktop-Ordner ROOT.</p></div>`;
    }
  }
  I18N?.installLocalization({
    getProtectedText: () =>
      state
        ? [
            state.networkName,
            ...state.servers.filter((s) => !I18N.isGeneratedServerName(s)).map((s) => s.name),
            ...state.agents.map((a) => a.name),
            ...state.facility.racks.map((r) => r.name),
          ]
        : [],
  });
  start();
})();
