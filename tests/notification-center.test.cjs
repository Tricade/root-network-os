const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const modules = Promise.all([
  import('../ui/attention-model.js'),
  import('../ui/dashboard-model.js'),
  import('../ui/notification-state.js'),
  import('../ui/notification-center.js'),
  import('../ui/attention-cards.js'),
]);
const esc = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('"', '&quot;');
function context(state) {
  return {
    E,
    state,
    esc,
    tr: (v) => v,
    fmt: String,
    dec: String,
    duration: String,
    clock: String,
    icon: () => '',
    $: () => null,
    $$: () => [],
    agentOperations: () => E.getAgentOperations(state),
    updateAttentionCards() {},
  };
}

test('pending categories resolve to actual stable entities without mutating the simulation', async () => {
  const [{ attentionEntries, uniqueAttentionEntries }, { dashboardModel }] = await modules;
  const s = E.createState(401);
  s.counters.jobs = 1;
  s.events = [
    {
      id: 'event-review',
      title: 'Review',
      description: 'Options',
      choices: [{ label: 'Yes', description: 'Consequences' }],
    },
  ];
  const c = s.customers.contracts[0];
  c.notice = 600;
  c.issue = 'outage';
  c.work = 'support';
  c.agentId = null;
  const before = JSON.stringify(s),
    model = dashboardModel(E, s),
    entries = attentionEntries(E, s, model);
  assert.ok(entries.some((e) => e.id === 'event:event-review' && e.data.choices.length === 1));
  assert.ok(entries.some((e) => e.group === 'rewards' && e.data.reward > 0));
  for (const lead of s.customers.leads)
    assert.ok(entries.some((e) => e.id === `lead:${lead.id}` && e.data === lead));
  const customerRows = entries.filter((e) => e.data.id === c.id);
  assert.equal(customerRows.length, 3);
  assert.equal(uniqueAttentionEntries(customerRows).length, 1);
  assert.equal(JSON.stringify(s), before);
});

test('reading pending work persists across reloads, not across replacement, and does not resolve it', async () => {
  const [, , , { createNotificationCenter }] = await modules;
  const s = E.createState(402),
    memory = new Map(),
    ctx = context(s);
  const badge = { hidden: false, textContent: '' },
    bell = {
      setAttribute(_key, value) {
        this.label = value;
      },
      querySelector: () => badge,
    };
  Object.assign(ctx, {
    storageGet: (key) => memory.get(key),
    storageSet: (key, value) => memory.set(key, value),
    $$: () => [bell],
  });
  let ui = createNotificationCenter(ctx);
  ui.updateNotificationCenter();
  assert.equal(badge.hidden, false);
  const before = JSON.stringify(s);
  ui.notificationClick({
    closest: () => null,
    hasAttribute: (name) => name === 'data-notification-read-all',
  });
  assert.equal(badge.hidden, true);
  assert.equal(JSON.stringify(s), before);
  ui = createNotificationCenter(ctx);
  ui.updateNotificationCenter();
  assert.equal(badge.hidden, true, 'reload keeps the read state');
  s.log.unshift({ id: 'new-log', message: 'New completion', time: s.time + 1, type: 'success' });
  ui.updateNotificationCenter();
  assert.equal(
    badge.textContent,
    '1',
    'new event is unread even when pending counts do not change',
  );
  ui.resetNotifications();
  ui.updateNotificationCenter();
  assert.equal(badge.hidden, false);
});

test('bounded notification history deduplicates action toasts and rejects corrupt local state', async () => {
  const [, , { notificationHistory, loadNotificationState, reconcileNotificationReads }] =
    await modules;
  const defaults = loadNotificationState();
  assert.deepEqual(loadNotificationState('invalid'), defaults);
  assert.deepEqual(loadNotificationState('null'), defaults);
  assert.deepEqual(defaults.read, []);
  assert.deepEqual(defaults.messages, []);
  assert.equal(defaults.preferences.jobs.badge, false);
  assert.equal(defaults.preferences.research.toast, true);
  const stored = loadNotificationState(
    JSON.stringify({
      read: ['event:one', 7, 'event:one'],
      messages: Array.from({ length: 70 }, (_, i) => ({
        id: String(i),
        message: 'UI error',
        time: i,
      })),
    }),
  );
  assert.equal(stored.messages.length, 30);
  assert.deepEqual(stored.read, ['event:one']);
  const history = notificationHistory({ log: [{ id: 'log-1', message: 'Completed', time: 1 }] }, [
    { id: 'toast-1', message: 'Completed', time: 1 },
    { id: 'toast-2', message: 'Save failed', time: 2 },
  ]);
  assert.deepEqual(
    history.map((e) => e.id),
    ['toast-2', 'log:log-1'],
  );
  assert.deepEqual(reconcileNotificationReads(['lead:old'], [{ id: 'lead:new' }]), []);
});

test('customer attention cards expose real quotes and confirmation actions with escaped identities', async () => {
  const [, , , , { createAttentionCards }] = await modules;
  const s = E.createState(403),
    ctx = context(s);
  const lead = s.customers.leads[0];
  assert.ok(lead);
  lead.client = '<script>customer</script>';
  const quote = E.quoteCustomer(s, 'acceptCustomerLead', {
    id: lead.id,
    roomId: s.business.rooms[0].roomId,
  });
  const markup = createAttentionCards(ctx).attentionCard({
    id: `lead:${lead.id}`,
    group: 'enquiries',
    title: lead.client,
    data: lead,
    severity: 'normal',
  });
  assert.ok(markup.includes(`${quote.cost} CR`));
  assert.match(markup, /data-customer="acceptCustomerLead"/);
  assert.match(markup, /data-attention-room/);
  assert.match(markup, /&lt;script>/);
  assert.doesNotMatch(markup, /<script>|data-action="acceptCustomerLead"/);
});

test('completed technology dialog shows its active factor without an obsolete purchase form', async () => {
  const { createResearchCards } = await import('../ui/research-cards.js');
  const s = E.createState(404);
  const node = E.getResearch(s).technologies[0];
  s.lab.owned.push(node.id);
  const markup = createResearchCards(context(s)).researchDecision(node.id);
  assert.match(markup, /Aktive Wirkung/);
  assert.match(markup, /Forschung abgeschlossen/);
  assert.doesNotMatch(
    markup,
    /data-research-confirm|Laborzeit|research-decision-policy|Heute → nach Abschluss/,
  );
});
