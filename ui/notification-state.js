/** Local presentation state; reading a message never changes simulation or money. */
export function loadNotificationState(raw) {
  let value;
  try {
    value = JSON.parse(raw || '{}');
  } catch {
    value = {};
  }
  return {
    read: [
      ...new Set(
        Array.isArray(value?.read)
          ? value.read.filter((id) => typeof id === 'string' && id.length < 400)
          : [],
      ),
    ].slice(-4096),
    messages: (Array.isArray(value?.messages) ? value.messages : [])
      .filter(
        (m) =>
          typeof m?.id === 'string' && typeof m.message === 'string' && Number.isFinite(m.time),
      )
      .slice(0, 30)
      .map((m) => ({
        id: m.id.slice(0, 100),
        message: m.message.slice(0, 500),
        error: Boolean(m.error),
        target: typeof m.target === 'string' ? m.target.slice(0, 40) : '',
        time: m.time,
      })),
  };
}

export function reconcileNotificationReads(read, entries) {
  const active = new Set(entries.map((entry) => entry.id));
  return [...new Set(read)].filter((id) => active.has(id)).slice(-4096);
}

export function notificationHistory(state, messages) {
  // Engine actions often also emit a toast. Display that event once, using its durable log ID.
  const logs = state.log.map((entry) => ({ ...entry, id: `log:${entry.id}`, source: 'log' }));
  const seenMessages = new Set(logs.map((entry) => entry.message));
  return [
    ...messages
      .filter((entry) => !seenMessages.has(entry.message))
      .map((entry) => ({ ...entry, source: 'message' })),
    ...logs,
  ]
    .sort((a, b) => b.time - a.time)
    .slice(0, 80);
}
