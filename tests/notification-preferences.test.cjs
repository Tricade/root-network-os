'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const imports = Promise.all([
  import('../ui/notification-preferences.js'),
  import('../ui/notification-center.js'),
  import('../ui/notifications.js'),
]);
test('local preference migration accepts only known booleans and keeps notification routes real', async () => {
  const [{ notificationPreferences, NOTIFICATION_TYPES, notificationType }] = await imports;
  const { NAVIGATION_ITEMS } = await import('../ui/navigation.js');
  const prefs = notificationPreferences({
    jobs: { badge: true, toast: 'true', visible: false },
    exploit: { badge: true },
  });
  assert.deepEqual(prefs.jobs, { badge: true, toast: false, visible: false });
  assert.equal(Object.hasOwn(prefs, 'exploit'), false);
  assert.ok(prefs.research.toast && prefs.upgrades.toast);
  for (const def of Object.values(NOTIFICATION_TYPES))
    assert.ok(NAVIGATION_ITEMS.some(([id]) => id === def.target));
  assert.equal(
    notificationType({ message: 'Archiv prüfen für Orbit abgeschlossen: 20 Credits.' }),
    'jobs',
  );
  assert.equal(
    notificationType({ message: 'Arbitrary success text', type: 'success' }),
    'activity',
  );
});
test('visibility, badge and toast preferences are independent, survive reload and do not replay old completion toasts', async () => {
  const [, { createNotificationCenter }] = await imports;
  const state = E.createState(414),
    memory = new Map(),
    notices = [];
  const badge = {},
    bell = { setAttribute() {}, querySelector: () => badge };
  const ctx = {
    E,
    state,
    esc: String,
    tr: String,
    clock: String,
    icon: (id) => `<svg data-icon="${id}"></svg>`,
    storageGet: (key) => memory.get(key),
    storageSet: (key, value) => memory.set(key, value),
    $$: () => [bell],
    $: () => null,
    updateAttentionCards() {},
    toast: (...args) => notices.push(args),
  };
  let center = createNotificationCenter(ctx);
  center.updateNotificationCenter();
  center.notificationClick({
    closest: () => null,
    hasAttribute: (n) => n === 'data-notification-read-all',
  });
  const initial = JSON.stringify(state);
  const change = (type, option, checked) =>
    center.notificationChange({
      hasAttribute: (n) => n === 'data-notification-preference',
      dataset: { notificationPreference: `${type}:${option}` },
      checked,
    });
  change('research', 'visible', false);
  change('research', 'badge', false);
  assert.equal(JSON.stringify(state), initial);
  state.log.unshift({
    id: 'log-jobs-test',
    category: 'jobs',
    time: 1,
    type: 'success',
    message: 'Job done',
  });
  center.updateNotificationCenter();
  assert.equal(badge.hidden, true);
  assert.equal(notices.length, 0);
  state.log.unshift({
    id: 'log-research-test',
    category: 'research',
    time: 2,
    type: 'success',
    message: 'Lab done',
  });
  center.updateNotificationCenter();
  assert.equal(
    badge.hidden,
    true,
    'research opted out of counter but still shows completion pop-up',
  );
  assert.equal(notices.length, 1);
  assert.equal(notices[0][4], 'research');
  center.notificationClick({
    closest: () => null,
    dataset: { notificationTab: 'history' },
    hasAttribute: (n) => n === 'data-notification-tab',
  });
  assert.match(center.notificationModal(), /Job done/);
  assert.doesNotMatch(center.notificationModal(), /Lab done/);
  change('jobs', 'badge', true);
  assert.equal(badge.textContent, '1');
  change('jobs', 'visible', false);
  assert.doesNotMatch(center.notificationModal(), /Job done/);
  assert.equal(badge.textContent, '1', 'visibility never silently changes badge preference');
  center = createNotificationCenter(ctx);
  center.updateNotificationCenter();
  assert.equal(notices.length, 1, 'reload must not replay a historical completion');
  assert.equal(center.notificationPreference('jobs').visible, false);
  center.resetNotifications();
  assert.equal(
    center.notificationPreference('jobs').badge,
    true,
    'network reset keeps local preferences',
  );
});

test('an explicit action keeps its history entry without a second automatic acknowledgement', async () => {
  const [, { createNotificationCenter }] = await imports;
  const state = E.createState(417),
    notices = [];
  const center = createNotificationCenter({
    E,
    state,
    storageGet: () => null,
    storageSet() {},
    $$: () => [],
    $: () => null,
    toast: (...args) => notices.push(args),
  });
  center.updateNotificationCenter();
  state.log.unshift({
    id: 'manual-upgrade',
    time: 1,
    type: 'success',
    category: 'upgrades',
    message: 'Upgrade done',
  });
  center.acknowledgeLogToast('manual-upgrade');
  center.updateNotificationCenter();
  assert.equal(notices.length, 0);
  assert.equal(state.log[0].message, 'Upgrade done');
});
test('toasts use semantic icons, obey preferences, can be dismissed and remain bounded', async () => {
  const [{ notificationPreferences }, , { createNotificationsUI }] = await imports;
  const prefs = notificationPreferences(),
    root = { innerHTML: '' },
    timers = new Map(),
    records = [];
  let next = 0;
  const ui = createNotificationsUI(
    {
      $: () => root,
      esc: String,
      icon: (id) => `<svg data-icon="${id}"></svg>`,
      recordNotification: (...args) => records.push(args),
      notificationPreference: (id) => prefs[id],
    },
    {
      setTimeout: (fn) => {
        timers.set(++next, fn);
        return next;
      },
      clearTimeout: (id) => timers.delete(id),
    },
  );
  ui.toast('Routine complete', false, 'jobs', true, 'jobs', true);
  assert.equal(root.innerHTML, '');
  assert.equal(records.length, 1, 'disabled pop-ups still enter the durable history');
  ui.toast('Research done', false, 'research', true, 'research');
  assert.match(root.innerHTML, /data-icon="research"/);
  ui.toast('Upgrade done', false, 'network', true, 'upgrades');
  assert.match(root.innerHTML, /data-icon="server"/);
  ui.dismissToast({ hasAttribute: () => true, dataset: { toastDismiss: '1' } });
  assert.doesNotMatch(root.innerHTML, /Research done/);
  assert.equal(timers.size, 1);
  for (let i = 0; i < 5; i++) ui.toast(`More ${i}`, false, '', false, 'activity');
  assert.equal(timers.size, 3);
  assert.equal((root.innerHTML.match(/class="toast /g) || []).length, 3);
  prefs.incidents.toast = false;
  ui.toast('Background incident', true, 'resilience', true, 'incidents', true);
  assert.doesNotMatch(root.innerHTML, /Background incident/);
  ui.toast('Action failed', true, '', false, 'incidents');
  assert.match(root.innerHTML, /Action failed/, 'validation feedback must remain visible');
});
test('completion categories round-trip through saves without confusing severity with event type', () => {
  const s = E.createState(415);
  s.credits = 1e6;
  s.research = 1000;
  s.resilience.graceUntil = 1e9;
  assert.ok(E.act(s, 'buyResearch', { id: 'network-fabric' }).ok);
  E.advance(s, 600);
  assert.ok(s.log.some((e) => e.category === 'research'));
  assert.ok(
    E.act(s, 'upgradeRackBatch', { rackId: 'rack-1', components: ['power'], announce: false }).ok,
  );
  E.advance(s, 60);
  assert.equal(s.log[0].category, 'upgrades');
  assert.deepEqual(E.normalizeState(s).log, s.log);
  const legacy = structuredClone(s);
  for (const entry of legacy.log) delete entry.category;
  assert.equal(E.normalizeState(legacy).log.length, legacy.log.length);
});

test('catch-up reports a finished upgrade once and does not replay it after reload', () => {
  const s = E.createState(416);
  s.credits = 1e6;
  s.resilience.graceUntil = 1e9;
  assert.ok(
    E.act(s, 'upgradeRackBatch', {
      rackId: 'rack-1',
      components: ['power', 'cooling'],
      announce: false,
    }).ok,
  );
  const task = E.createCatchup(s, 180);
  while (task.step(30)) {
    /* same bounded cursor as the offline worker */
  }
  assert.equal(task.report().upgradesCompleted.length, 1);
  assert.match(task.report().upgradesCompleted[0], /2 Ausbauten/);
  assert.equal(task.state.facility.operation, null);
  const resumed = E.createCatchup(task.state, 30);
  resumed.step();
  assert.deepEqual(resumed.report().upgradesCompleted, []);
});
