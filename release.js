/** UI release metadata. Tests require the version to match package.json before publication. */
(function (root, factory) {
  const release = factory();
  if (typeof module === 'object' && module.exports) module.exports = release;
  if (root) root.ROOTRelease = release;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return Object.freeze({
    version: '1.7.0',
    notes: [
      [
        'Plane Strom, Kühlung und Switch gemeinsam in einem Rack-Wartungsfenster. Eine optionale Kundenankündigung gegen Credits hält das Rack im Vorlauf online und halbiert den wartungsbedingten Zufriedenheitsverlust.',
        'Plan power, cooling and switch upgrades in one rack maintenance window. An optional paid customer notice keeps the rack online during the lead time and halves maintenance-related satisfaction loss.',
      ],
      [
        'Die neue Forschung „Wartungsankündigungen“ senkt die Zusatzkosten um 25 % und verkürzt den Vorlauf auf 60 Sekunden. Normale Ausbauten bleiben ohne Ankündigung verfügbar.',
        'The new Maintenance communications research cuts notice fees by 25% and reduces the lead time to 60 seconds. Normal upgrades remain available without announcements.',
      ],
      [
        'Meldungstypen haben eigene Symbole sowie getrennte Einstellungen für Anzeige, Glockenzähler und automatische Pop-ups. Forschungs- und Ausbauabschlüsse erscheinen unten rechts; Routineaufträge bleiben standardmäßig ruhig.',
        'Notification types have their own icons and separate display, bell counter and automatic pop-up settings. Research and upgrade completions appear at the bottom right; routine jobs stay quiet by default.',
      ],
      [
        'Die 3D-Ansicht bietet eine ausdrückliche Mausbindung. Escape gibt die Maus frei; Ziehen bleibt als Alternative verfügbar. Wechsel zwischen beiden Verfahren setzen alte Bewegungsdaten zurück.',
        'The 3D view offers explicit mouse capture. Escape releases the pointer, and drag-to-look remains available. Switching modes clears stale movement data.',
      ],
    ],
  });
});
