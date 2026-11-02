'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createStaticFiles } = require('../server/static-files.cjs');
const root = path.resolve(__dirname, '..');

test('all 64 original robot portraits are present, hash-pinned and served from the packaged local texture directory', () => {
  const manifest = require('../asset-pack/docs/personnel-manifest.json');
  const files = createStaticFiles(root);
  assert.equal(manifest.portraits, 64);
  assert.equal(manifest.sheets.length, 4);
  assert.ok(require('../electron-builder.config.cjs').files.includes('asset-pack/textures/**'));
  for (const sheet of manifest.sheets) {
    const file = path.join(root, 'asset-pack', sheet.file),
      data = fs.readFileSync(file);
    assert.equal(createHash('sha256').update(data).digest('hex'), sheet.sha256);
    assert.equal(data.subarray(1, 4).toString(), 'PNG');
    assert.equal(data.readUInt32BE(16), sheet.width);
    assert.equal(data.readUInt32BE(20), sheet.height);
    assert.equal(sheet.rows * sheet.columns, 16);
    const url = '/asset-pack/' + sheet.file;
    assert.ok(files.has(url), url);
    assert.equal(files.get(url)[1], 'image/png');
    assert.equal(path.resolve(root, files.get(url)[0]), file);
  }
});

test('every illustration category resolves to a hash-pinned local raster bundled in HTTP and desktop', async () => {
  const { JOB_ART, RESEARCH_ART, workloadArt } = await import('../ui/workload-art.js');
  const { technologyArt } = await import('../ui/research-art.js');
  const { achievementArt } = await import('../ui/business-art.js');
  const { roomArt } = await import('../ui/facility-art.js');
  const E = require('../engine.js'),
    manifest = require('../asset-pack/docs/illustration-manifest.json');
  assert.deepEqual(Object.keys(JOB_ART).sort(), Object.keys(E.jobProfiles).sort());
  assert.deepEqual(Object.keys(RESEARCH_ART).sort(), E.catalog.research.map((r) => r.id).sort());
  const files = createStaticFiles(root),
    urls = new Set();
  assert.equal(manifest.images.length, 12);
  for (const img of manifest.images) {
    const bytes = fs.readFileSync(path.join(root, 'asset-pack', img.file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), img.sha256);
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(bytes.readUInt32BE(16), img.width);
    assert.equal(bytes.readUInt32BE(20), img.height);
    assert.ok(img.width >= 1024 && img.height >= 512);
    assert.ok(files.has('/asset-pack/' + img.file));
    urls.add('asset-pack/' + img.file);
  }
  const html = [
    ...Object.keys(JOB_ART).map((k) => workloadArt(k)),
    ...Object.keys(RESEARCH_ART).map((k) => workloadArt(k, true)),
    ...E.getResearch(E.createState(5)).technologies.map((n) => technologyArt(n.id)),
    ...E.catalog.achievements.map((a) => achievementArt(a.id, false, false)),
    ...['server', 'control', 'cooling', 'ups', 'distribution', 'floor'].flatMap((k) =>
      ['planned', 'building', 'ready'].map((p) => roomArt(k, p)),
    ),
  ];
  for (const art of html) {
    assert.match(art, /<img /);
    assert.match(art, /aria-hidden="true"/);
    assert.doesNotMatch(art, /<svg|https?:|<script|<animate/);
    assert.ok(urls.has(art.match(/src="([^"]+)"/)[1]));
  }
});
