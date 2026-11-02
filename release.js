/** UI release metadata. Tests require the version to match package.json before publication. */
(function (root, factory) {
  const release = factory();
  if (typeof module === 'object' && module.exports) module.exports = release;
  if (root) root.ROOTRelease = release;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return Object.freeze({
    version: '1.5.1',
    notes: [
      [
        'Ein einheitlicher Name: ROOT · Network OS in Intro, Weboberfläche und Desktop-App.',
        'One consistent name: ROOT · Network OS in the intro, web interface and desktop app.',
      ],
      [
        'Nach der Einfahrt öffnet sich das Dashboard. Den Rundgang startest du selbst; F5 erhält deinen Standort.',
        'The arrival sequence opens the dashboard. Start a walkthrough when you want; reloading preserves your location.',
      ],
      [
        'Schmale, farblich passende Scrollleisten. Bestehende Netzwerkstände und Einstellungen bleiben erhalten.',
        'Slim, matching scrollbars. Existing networks and preferences are preserved.',
      ],
    ],
  });
});
