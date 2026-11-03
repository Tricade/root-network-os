#!/usr/bin/env node
// Builds into a fresh directory. It never replaces the maintained runtime pack.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const usage = `ROOT asset generator
Usage: node tools/asset-generator/generate.mjs <base|facility|interiors|operations> [--out DIRECTORY] [--python EXECUTABLE]

base       Supplied rack/server/architecture and texture generators; historical source.
facility   Maintained UPS, distribution, airlock, stairs and lift models.
interiors  Original ROOT chair, sofa, coffee station, plant and procedural maps.
operations Original pump skid, sensors, maintenance rover/dock/cart and construction kit.

Default output: .asset-build/<target>/ (must be empty or absent).
Python targets use the pinned dependencies in requirements.txt.
No network requests or package installation are performed.`;

function run(executable, argv, options = {}) {
  const result = spawnSync(executable, argv, {
    cwd: project,
    encoding: 'utf8',
    shell: false,
    ...options,
  });
  if (result.error)
    throw new Error(`Could not start ${path.basename(executable)}: ${result.error.code}`);
  if (result.status !== 0)
    throw new Error(`${path.basename(executable)} exited with status ${result.status}`);
  return result.stdout;
}
const inside = (directory, candidate) => {
  const relative = path.relative(directory, candidate);
  return (
    relative === '' ||
    (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))
  );
};

async function main() {
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    console.log(usage);
    return;
  }
  const target = args.shift();
  if (!['base', 'facility', 'interiors', 'operations'].includes(target))
    throw new Error('Choose base, facility, interiors or operations. Use --help for details.');
  let out = path.join(project, '.asset-build', target),
    python = process.platform === 'win32' ? 'python' : 'python3';
  while (args.length) {
    const option = args.shift(),
      value = args.shift();
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${option}`);
    if (option === '--out') out = path.resolve(value);
    else if (option === '--python') python = value;
    else throw new Error(`Unknown option ${option}`);
  }
  if (![24, 26].includes(Number(process.versions.node.split('.')[0])))
    throw new Error('Use Node.js 24 or 26 to build ROOT assets.');
  // Resolve symlinked parents before checking containment, including absent output paths.
  let parent = out;
  const suffix = [];
  for (;;) {
    try {
      parent = await fs.realpath(parent);
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      suffix.unshift(path.basename(parent));
      const next = path.dirname(parent);
      if (next === parent) throw error;
      parent = next;
    }
  }
  out = path.join(parent, ...suffix);
  const realProject = await fs.realpath(project),
    allowed = path.join(realProject, '.asset-build');
  if (inside(out, realProject) || (inside(realProject, out) && !inside(allowed, out))) {
    throw new Error(
      'Output must be outside the source checkout, or inside .asset-build/. Runtime assets cannot be a build target.',
    );
  }
  try {
    if ((await fs.readdir(out)).length)
      throw new Error('Output directory is not empty. Choose a fresh --out directory.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  if (target !== 'interiors') {
    const pillow = target === 'base';
    const check = `import sys, numpy${pillow ? ', PIL' : ''}; assert sys.version_info[:2] == (3,12), 'Python 3.12 required'; assert numpy.__version__ == '2.5.4', 'numpy==2.5.4 required'${pillow ? "; assert PIL.__version__ == '13.0.0', 'Pillow==13.0.0 required'" : ''}; print('Python',sys.version.split()[0],'NumPy',numpy.__version__${pillow ? ",'Pillow',PIL.__version__" : ''})`;
    process.stdout.write(run(python, ['-c', check]));
  }
  if (target === 'operations') {
    run(
      python,
      [
        path.join(project, 'tools/asset-generator/build_operations_assets.py'),
        '--output-root',
        out,
      ],
      {
        stdio: 'inherit',
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      },
    );
  }
  await fs.mkdir(out, { recursive: true });
  await fs.mkdir(path.join(out, 'docs'), { recursive: true });
  if (target === 'base') {
    const destination = path.join(out, 'source/generator');
    await fs.mkdir(destination, { recursive: true });
    for (const file of await fs.readdir(path.join(project, 'tools/asset-generator/base'))) {
      if (file.endsWith('.py'))
        await fs.copyFile(
          path.join(project, 'tools/asset-generator/base', file),
          path.join(destination, file),
        );
    }
    await fs.mkdir(path.join(out, 'source/blender'), { recursive: true });
    await fs.copyFile(
      path.join(project, 'tools/asset-generator/blender/build_blender_project.py'),
      path.join(out, 'source/blender/build_blender_project.py'),
    );
    run(python, [path.join(destination, 'build_all.py')], {
      stdio: 'inherit',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
  } else {
    // glTF uses relative image URIs; include the local maps in the portable output.
    await fs.cp(path.join(project, 'asset-pack/textures'), path.join(out, 'asset-pack/textures'), {
      recursive: true,
    });
    if (target === 'facility') {
      const destination = path.join(out, 'tools/asset-generator');
      await fs.mkdir(destination, { recursive: true });
      for (const file of ['build_facility_assets.py', 'gltf_builder.py'])
        await fs.copyFile(
          path.join(project, 'tools/asset-generator', file),
          path.join(destination, file),
        );
      run(python, [path.join(destination, 'build_facility_assets.py')], {
        stdio: 'inherit',
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });
    } else if (target === 'interiors') {
      run(
        process.execPath,
        [path.join(project, 'tools/asset-generator/build_interiors.mjs'), '--output-root', out],
        { stdio: 'inherit' },
      );
    }
  }
  await fs.copyFile(path.join(project, 'NOTICE.md'), path.join(out, 'NOTICE.md'));
  await fs.copyFile(
    path.join(project, 'tools/asset-generator/UPSTREAM_LICENSE.md'),
    path.join(out, 'SUPPLIED-LICENSE.md'),
  );
  await fs.copyFile(path.join(project, 'LICENSE'), path.join(out, 'CODE-LICENSE.txt'));
  await fs.writeFile(
    path.join(out, 'ASSET-LICENSE.txt'),
    `ROOT original generated facility/interior/operations geometry and root-weave/root-leaf maps:
Dedicated to the public domain under CC0 1.0 Universal by ROOT contributors.
https://creativecommons.org/publicdomain/zero/1.0/legalcode

Supplied base models/maps retain their supplied notices in SUPPLIED-LICENSE.md.
The walnut maps are CC0 material textures from https://polyhaven.com/a/american_walnut_veneer
No other component is relicensed by this notice. See the source repository NOTICE.md and inventory.
Generator code retains its applicable MIT notice in CODE-LICENSE.txt / SUPPLIED-LICENSE.md.
`,
  );
  console.log(
    `Built ${target} in ${path.relative(process.cwd(), out) || '.'}. Review the output before promoting individual files.`,
  );
}
main().catch((error) => {
  console.error(`Asset build failed: ${error.message}`);
  process.exitCode = 1;
});
