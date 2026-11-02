import { illustration } from './illustrations.js';
/** Each research district has commissioned bitmap key art; labels stay accessible HTML. */
export function technologyArt(id) {
  return illustration(String(id).split('-')[0], 'technology-art');
}
