import { illustration } from './illustrations.js';
/** Event kinds are stable domain keys; saved titles never become file paths. */
export const EVENT_ART = Object.freeze({
  signal: 'event-signal',
  grant: 'event-grant',
  maintenance: 'event-maintenance',
  client: 'event-client',
  discovery: 'event-discovery',
  procurement: 'event-procurement',
});
export function eventArt(kind) {
  return illustration(EVENT_ART[kind] || 'event-signal', 'event-art');
}
