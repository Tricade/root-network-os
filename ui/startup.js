import '../release.js';
import { illustration } from './illustrations.js';

/** Onboarding belongs to this installation/profile, never to a save's money or sector. */
export function createStartupUI(ctx, release = globalThis.ROOTRelease) {
  let pending = [];
  const text = (value) => ctx.esc(ctx.tr(value));
  function prepareStartup({ hasSave, offline }) {
    pending = [];
    if (offline?.seconds >= 60) pending.push({ type: 'offline', extra: offline });
    const seen = ctx.storageGet('root.release.seen');
    if (!hasSave && ctx.storageGet('root.welcome.seen') !== '1') pending.push({ type: 'welcome' });
    else if (seen && seen !== release.version) pending.push({ type: 'changelog' });
    else if (!seen) {
      // Existing saves predate this feature. Establish a baseline without inventing an update.
      ctx.storageSet('root.release.seen', release.version);
    }
  }
  function showNextStartup() {
    if (ctx.modal || !pending.length) return false;
    const next = pending.shift();
    if (next.type === 'welcome') ctx.storageSet('root.welcome.seen', '1');
    if (next.type === 'welcome' || next.type === 'changelog')
      ctx.storageSet('root.release.seen', release.version);
    ctx.openModal(next.type, next.extra);
    return true;
  }
  function welcomeModal() {
    return `${illustration('room-server', 'welcome-art')}<p class="modal-intro">${text('Dein unterirdisches Rechenzentrum beginnt mit einem Rack. Das Dashboard zeigt dir, was gerade Aufmerksamkeit braucht.')}</p><ol class="welcome-steps"><li><strong>${text('Kapazität aufbauen')}</strong><p>${text('Prüfe Strom, Kühlung und freie Ressourcen, bevor du Hardware oder Kunden hinzufügst.')}</p></li><li><strong>${text('Arbeit passend verteilen')}</strong><p>${text('Aufträge liefern einmalige Belohnungen. Kundenverträge bringen laufende Einnahmen; Agenten richten sie ein.')}</p></li><li><strong>${text('In deinem Tempo zurückkommen')}</strong><p>${text('Automatisierung und Betriebspläne übernehmen Routinen. Du kannst im Dashboard verwalten oder den Bunker in 3D erkunden.')}</p></li></ol><div class="card-actions"><button class="button primary" data-command="close">${text('Zur Leitstelle')}</button><button class="button" data-modal="help">${text('Handbuch öffnen')}</button></div>`;
  }
  function changelogModal() {
    const language = ctx.I18N.getLanguage() === 'en' ? 1 : 0;
    return `<p class="tag">ROOT · Network OS ${ctx.esc(release.version)}</p><ul class="release-notes">${release.notes.map((pair) => `<li>${ctx.esc(pair[language])}</li>`).join('')}</ul><p class="policy-explainer">${text('Dieser Hinweis erscheint einmal nach einem Versionswechsel. Du findest ihn jederzeit im Handbuch wieder.')}</p><button class="button primary block" data-command="close">${text('Zur Leitstelle')}</button>`;
  }
  return { prepareStartup, showNextStartup, welcomeModal, changelogModal };
}
