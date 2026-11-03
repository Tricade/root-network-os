/** UI release metadata. Tests require the version to match package.json before publication. */
(function (root, factory) {
  const release = factory();
  if (typeof module === 'object' && module.exports) module.exports = release;
  if (root) root.ROOTRelease = release;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return Object.freeze({
    version: '1.7.1',
    notes: [
      [
        'In der Leitstelle zeigt „Als Nächstes“ das betroffene Rack und die Zeit bis zum Wartungsbeginn oder Wartungsende. Ein Klick öffnet den passenden Schrank auch in der 3D-Konsole.',
        'Coming up shows the affected rack and the time until maintenance starts or ends. Select the entry to open that cabinet from the dashboard or the 3D console.',
      ],
      [
        'Die Docker-Ausgabe verwendet Node.js 26.13.0 LTS. Der lokale Webserver unterstützt Node.js 24 und 26.',
        'The Docker edition uses Node.js 26.13.0 LTS. The local web server supports Node.js 24 and 26.',
      ],
    ],
  });
});
