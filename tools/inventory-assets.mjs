// Rebuild the current on-disk inventory; the supplied v1 manifest is historical.
import { audit } from './audit-assets.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  pack = path.join(root, 'asset-pack');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const relative = (file) => path.relative(root, file).replaceAll('\\', '/');
const suppliedClaim =
  'CC0-1.0 according to the user-supplied Root_Assets 1.0 notices; authorship not independently verified';
const reports = await audit(),
  assets = [];
for (const report of reports) {
  const file = path.join(pack, report.file),
    bytes = await fs.readFile(file),
    doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  const kind = report.file.startsWith('assets/interiors/')
    ? 'root-original'
    : report.file.startsWith('assets/facility/')
      ? 'root-generated-facility'
      : report.file.startsWith('assets/operations/')
        ? 'root-generated-operations'
        : 'supplied-copy';
  const generator =
    kind === 'root-original'
      ? 'tools/asset-generator/build_interiors.mjs'
      : kind === 'root-generated-facility'
        ? 'tools/asset-generator/build_facility_assets.py'
        : kind === 'root-generated-operations'
          ? 'tools/asset-generator/build_operations_assets.py'
          : null;
  assets.push({
    path: relative(file),
    sha256: report.sha256,
    bytes: report.bytes,
    provenanceKind: kind,
    licenseSPDX: 'CC0-1.0',
    licenseEvidence:
      kind === 'supplied-copy'
        ? suppliedClaim
        : kind === 'root-generated-facility'
          ? 'ROOT procedural model; helper copied from the supplied package, see tools/asset-generator/README.md'
          : 'Original ROOT geometry and procedural material maps; see NOTICE.md',
    source: generator || 'User-supplied Root_Assets 1.0',
    generatorSHA256: generator ? hash(await fs.readFile(path.join(root, generator))) : null,
    ...(kind === 'root-generated-operations'
      ? {
          generatorInputs: [
            {
              path: 'tools/asset-generator/operations_cooling.py',
              sha256: hash(
                await fs.readFile(path.join(root, 'tools/asset-generator/operations_cooling.py')),
              ),
            },
          ],
        }
      : {}),
    activeRuntimeBoundsM: { min: report.boundsMinM, max: report.boundsMaxM },
    activeRuntimeTriangles: report.runtime.triangles,
    requiredExtensions: doc.extensionsRequired || [],
    textures: [
      ...new Set(
        (doc.images || [])
          .filter((image) => image.uri)
          .map((image) => relative(path.resolve(path.dirname(file), image.uri))),
      ),
    ].sort(),
  });
}
const textures = [];
for (const entry of (await fs.readdir(path.join(pack, 'textures'), { recursive: true }))
  .filter((entry) => /\.(png|jpg)$/.test(entry))
  .sort()) {
  const file = path.join(pack, 'textures', entry),
    bytes = await fs.readFile(file),
    name = path.basename(file),
    walnut = name.startsWith('walnut-'),
    own = name.startsWith('root-'),
    robot = /^personnel-[1-4]\.png$/.test(name),
    illustration = entry.replaceAll('\\', '/').startsWith('illustrations/');
  textures.push({
    path: relative(file),
    sha256: hash(bytes),
    bytes: bytes.length,
    provenanceKind: walnut
      ? 'external-cc0-material-texture'
      : robot || illustration
        ? 'root-generated-ui'
        : own
          ? 'root-original'
          : 'supplied-copy',
    licenseSPDX: 'CC0-1.0',
    source: walnut
      ? 'https://polyhaven.com/a/american_walnut_veneer'
      : illustration
        ? 'asset-pack/docs/illustration-prompts.json'
        : robot
          ? 'asset-pack/docs/personnel-prompts.json'
          : own
            ? 'tools/asset-generator/build_interiors.mjs'
            : 'User-supplied Root_Assets 1.0',
  });
}
const inventory = {
  schemaVersion: 1,
  status: 'current bundled files',
  units: 'meters',
  coordinates: { up: '+Y', front: '+Z' },
  assetCount: assets.length,
  textureCount: textures.length,
  counts: {
    supplied: assets.filter((asset) => asset.provenanceKind === 'supplied-copy').length,
    facility: assets.filter((asset) => asset.provenanceKind === 'root-generated-facility').length,
    operations: assets.filter((asset) => asset.provenanceKind === 'root-generated-operations')
      .length,
    originalFurniture: assets.filter((asset) => asset.provenanceKind === 'root-original').length,
  },
  historicalManifest: 'asset-pack/docs/asset_manifest.json',
  notSupplied: [
    {
      path: 'scenes/root_datacenter_scene.glb',
      reason:
        'Listed in the supplied v1 manifest but absent from the supplied files. The application constructs rooms at runtime and does not request this file.',
    },
  ],
  assets,
  textures,
};
const output = path.join(pack, 'docs/runtime_inventory.json');
await fs.writeFile(output, JSON.stringify(inventory, null, 2) + '\n');
console.log(
  `${assets.length} GLBs and ${textures.length} textures inventoried in ${relative(output)}.`,
);
