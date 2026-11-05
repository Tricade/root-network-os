/** UI release metadata. Tests require the version to match package.json before publication. */
(function (root, factory) {
  const release = factory();
  if (typeof module === 'object' && module.exports) module.exports = release;
  if (root) root.ROOTRelease = release;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return Object.freeze({
    version: '1.8.0',
    notes: [
      [
        'Forschungspunkte wachsen langsamer. Einstiegsprojekte bleiben günstig, höhere Stufen brauchen mehr Planung. Guthaben und bezahlte Vorhaben werden übernommen.',
        'Research points grow more slowly. Starter projects stay affordable, while later tiers take more planning. Existing balances and paid commitments carry over.',
      ],
      [
        'Kunden können bestehende Verträge erweitern. Freie Agenten übernehmen zuerst bezahlte Einsätze mit drohender SLA-Frist. Ab Stufe 14 stehen Spezialisierungen zur Wahl.',
        'Customers can expand existing contracts. Available agents prioritize paid work with approaching SLA deadlines. Specializations unlock at level 14.',
      ],
      [
        'Unter Betrieb & Schutz kannst du eine automatische Stromumschaltung innerhalb deines Reparaturbudgets erlauben. Der erste zusätzliche Serverraum lässt sich in zwei Abschnitten ausbauen.',
        'Enable automatic power rerouting within your repair budget in Operations & Resilience. The first additional server room can be built in two phases.',
      ],
      [
        'Beim Sektorausbau zählen erreichbare Server. Die Kundenautomatik überspringt im Offline-Nachlauf Anfragen, die außerhalb des Budgets liegen.',
        'Sector expansion counts reachable servers. During offline catch-up, automatic sales skip enquiries outside the available budget.',
      ],
    ],
  });
});
