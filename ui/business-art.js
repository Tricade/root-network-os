import { illustration } from './illustrations.js';
/** Small customer initials are an identity aid, not a pretend image or imported company logo. */
export function customerLogo(name) {
  const letters = String(name).match(/[\p{L}\p{N}]+/gu) || ['R'];
  const initials = letters
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toLocaleUpperCase();
  return `<span class="customer-logo" aria-hidden="true">${initials}</span>`;
}
const medals = {
  first_job: 'award-contract',
  steady_network: 'award-resilience',
  three_servers: 'network',
  sector_two: 'construction',
  million: 'award-growth',
};
export function achievementArt(id, claimed, available, art) {
  return illustration(
    art || medals[id] || 'award-contract',
    `achievement-medal ${claimed ? 'claimed' : available ? 'available' : 'locked'}`,
  );
}
