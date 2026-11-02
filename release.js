/** UI release metadata. Tests require the version to match package.json before publication. */
(function (root, factory) {
  const release = factory();
  if (typeof module === 'object' && module.exports) module.exports = release;
  if (root) root.ROOTRelease = release;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return Object.freeze({
    version: '1.6.0',
    notes: [
      [
        'Kunden fragen Leistungen an; Agenten richten Verträge ein. Laufzeiten, Kündigungen und Vorfälle machen aus Kapazität einen Geschäftsbetrieb.',
        'Customers request services and agents provision contracts. Terms, cancellations and incidents turn capacity into a working business.',
      ],
      [
        '96 Technologien in acht Forschungszweigen, fünf wiederholbare Reihen und 25 Erfolge. Forschung dauert und Spezialisierungen haben langfristige Folgen.',
        '96 technologies in eight research branches, five repeatable tracks and 25 achievements. Research takes time and specializations have lasting consequences.',
      ],
      [
        'Roboter aus einem wechselnden Bewerberpool einstellen, Stärken und Nachteile abwägen und Verbesserungen vor dem Kauf vergleichen.',
        'Recruit robots from a rotating roster, weigh strengths and drawbacks, and compare upgrade effects before buying.',
      ],
      [
        'Betriebspläne, Ersatzteile, kostenpflichtiger Ausbau und zentrale Versorgung sind aufeinander abgestimmt. Einnahmen folgen der erbrachten Leistung; Ausfälle den betroffenen Abhängigkeiten.',
        'Operating plans, spare parts, paid expansion and central utilities work together. Income follows delivered service; outages follow affected dependencies.',
      ],
      [
        'Das Dashboard zeigt konkrete Aufgaben. Die Glocke bündelt Meldungen; neue Originalbilder, klare Dialoge und gruppierte Menüs erleichtern die Bedienung.',
        'The dashboard shows actionable tasks. The bell collects notifications; original artwork, clearer dialogs and grouped menus improve navigation.',
      ],
      [
        'Schnelleres Laufen und überarbeitete Versorgung im 3D-Bunker. Das Logo bleibt auch im kleinen Desktop-Fenster sichtbar.',
        'Faster walking and refined utility connections in the 3D bunker. The logo stays visible in smaller desktop windows.',
      ],
      [
        'Bestehende Stände werden übernommen. Für eine spätere Rückkehr zu 1.5.1 benötigst du eine Sicherung von vor diesem Update; die alte Version kann das neue Speicherformat nicht lesen.',
        'Existing saves are migrated. Returning to 1.5.1 requires a backup made before this update; the old version cannot read the new save format.',
      ],
    ],
  });
});
