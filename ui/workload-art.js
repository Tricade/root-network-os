import { illustration } from './illustrations.js';
/** Real local illustrations; job categories share an appropriate visual domain. */
export const JOB_ART = {
  monitoring: 'business',
  migration: 'storage',
  audit: 'reliability',
  optimization: 'network',
  recovery: 'automation',
  research: 'science',
  ai: 'science',
  database: 'storage',
  backup: 'reliability',
  loadtest: 'power',
  archive: 'storage',
  containers: 'network',
  security: 'reliability',
  replication: 'storage',
  rendering: 'science',
};
export const RESEARCH_ART = {
  routing: 'network',
  cooling: 'cooling',
  market: 'business',
  automation: 'automation',
  synthesis: 'science',
};
export function workloadArt(key, research = false) {
  return illustration((research ? RESEARCH_ART : JOB_ART)[key] || 'network', 'workload-art');
}
