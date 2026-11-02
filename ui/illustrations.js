/** Bundled original bitmap art. Fixed keys keep saved/user text out of asset URLs. */
export const ILLUSTRATION_KEYS = [
  'network',
  'event-signal',
  'event-grant',
  'event-maintenance',
  'event-client',
  'event-discovery',
  'event-procurement',
  'room-server',
  'room-vacant',

  'cooling',
  'power',
  'storage',
  'automation',
  'business',
  'science',
  'reliability',
  'construction',
  'award-contract',
  'award-resilience',
  'award-growth',
];
export function illustrationPath(key) {
  return `asset-pack/textures/illustrations/${ILLUSTRATION_KEYS.includes(key) ? key : 'network'}.png`;
}
export function illustration(key, classes = '') {
  return `<div class="raster-art ${classes}" aria-hidden="true"><img src="${illustrationPath(key)}" alt="" loading="lazy" decoding="async" width="1536" height="1024" draggable="false"></div>`;
}
