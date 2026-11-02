/** UI release metadata. Tests require the version to match package.json before publication. */
(function (root, factory) {
  const release = factory();
  if (typeof module === 'object' && module.exports) module.exports = release;
  if (root) root.ROOTRelease = release;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return Object.freeze({
    version: '1.6.1',
    notes: [
      [
        'ROOT ist jetzt auch als Docker-Version für x86-64 und ARM64 verfügbar. Weboberfläche und 3D laufen im Browser; ein eigenes Volume bewahrt den Fortschritt bei Updates.',
        'ROOT is now available as a Docker edition for x86-64 and ARM64. The web UI and 3D view run in the browser; a dedicated volume preserves progress across updates.',
      ],
      [
        'Compose, Gesundheitsprüfung, konfigurierbare Ports und explizite Browser-Adressen erleichtern den Betrieb auf dem eigenen Rechner oder NAS. Laufende Speicherungen werden beim Stoppen beendet.',
        'Compose, health checks, configurable ports and explicit browser origins support local or NAS deployment. In-flight saves finish during shutdown.',
      ],
      [
        'Die Docker-Ausgabe nutzt denselben Fortschritt und dieselben Regeln wie die Browser-Version. Bestehende Stände können über die Einstellungen exportiert und importiert werden.',
        'The Docker edition uses the same progress and rules as browser mode. Existing saves can be exported and imported through Settings.',
      ],
    ],
  });
});
