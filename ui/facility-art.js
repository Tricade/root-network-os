import { illustration } from './illustrations.js';
const rooms = {
  server: 'network',
  control: 'business',
  cooling: 'cooling',
  ups: 'power',
  distribution: 'power',
  floor: 'construction',
};
export function roomArt(kind, phase) {
  const state = ['planned', 'building', 'ready'].includes(phase) ? phase : 'planned';
  return illustration(
    state === 'building' ? 'construction' : rooms[kind] || 'network',
    `facility-room-art facility-room-art--${state}`,
  );
}
