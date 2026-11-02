# ROOT asset tool

Local procedural generators, editable glTF sources and a safe build entry point are included with the application. No hosted AI service, asset download, Blender installation or API key is required by these generators. Normal ROOT use needs none of the Python tooling.

## What is included

| Target       | Source                                                | Output                                                                             |
| ------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `base`       | `base/*.py`, supplied package 1.0 sources             | Racks, servers, switches, architecture, stations, PBR atlases and an example scene |
| `facility`   | `build_facility_assets.py`, `gltf_builder.py`         | Five maintained facility models: UPS, distribution, lift, airlock and stairs       |
| `operations` | `build_operations_assets.py`, `operations_cooling.py` | 11 original cooling, maintenance and construction models with editable glTF/bin    |
| `interiors`  | `build_interiors.mjs`                                 | Original ROOT chair, sofa, coffee station, plant and weave/leaf material maps      |

The base sources are a **historical generator**, not a byte-for-byte regeneration of every currently maintained runtime model. Geometry fixes and scene layout are also applied by the application. The generated example scene is a reference, not the live bunker. Do not replace the complete runtime pack with a base build.

Committed runtime models live in `asset-pack/assets/`; their editable `.gltf`/`.bin` files are in `asset-pack/source/`. The [runtime inventory](../../asset-pack/docs/runtime_inventory.json) identifies the active files. The supplied v1 manifest is historical and lists an example GLB that was not originally supplied to the application.

## Build environment

Verified locally: **Node.js 24.22.1**, **Python 3.12.14**, **NumPy 2.5.4** and **Pillow 13.0.0**. Three.js **0.186.1** is vendored. The Python requirements pin NumPy and Pillow; the wrapper requires Python 3.12 for the checked Python targets.

Version references: [Node 24.22.1 process API](https://github.com/nodejs/node/blob/v24.22.1/doc/api/child_process.md), [Python 3.12.14](https://www.python.org/downloads/release/python-31214/), [NumPy 2.5.4](https://github.com/numpy/numpy/releases/tag/v2.5.4), [Pillow 13.0.0](https://github.com/python-pillow/Pillow/releases/tag/13.0.0). Subprocesses are launched with argument arrays, without a shell. Generator output is resolved before containment checks; a nonempty destination is refused.

For Python targets, create an optional virtual environment from the repository root:

```sh
python -m venv .venv
```

On Windows:

```powershell
.venv\Scripts\python.exe -m pip install -r tools/asset-generator/requirements.txt
node tools/asset-generator/generate.mjs facility --python .venv\Scripts\python.exe
node tools/asset-generator/generate.mjs base --python .venv\Scripts\python.exe
node tools/asset-generator/generate.mjs operations --python .venv\Scripts\python.exe
```

On Linux/macOS, use `python3` to create the environment and `.venv/bin/python` for the Python commands. Installing dependencies contacts the package index; **generation itself is offline**. The furniture target only needs Node:

```sh
node tools/asset-generator/generate.mjs interiors
```

## Output and iteration

The wrapper defaults to `.asset-build/<target>/`. It also accepts `--out PATH` for a fresh destination, either outside the checkout or under `.asset-build/`. It refuses nonempty directories, the source checkout, parent directories and the runtime `asset-pack`. Choose another output directory for the next build, for example `--out .asset-build/interiors-v2`.

Base builds use the original package layout: `assets/`, `textures/`, `source/gltf/`, `scenes/` and `docs/`. Facility/interior/operations builds use an `asset-pack/` subdirectory and copy the existing local texture maps so exported relative image links resolve. Facility builds also stage their Python source. Each build carries a notice and the supplied license; distribution of individual assets must retain their applicable terms.

The original Blender assembly script is included under `blender/` and copied into base outputs. It is optional and was not runtime-verified with Blender as part of this publication. Its presence is not a Blender compatibility claim.

Low-level builders remain available for maintainers. Running `build_facility_assets.py` directly writes into the runtime pack, and `build_interiors.mjs` without `--output-root` does the same. Use the wrapper when experimenting.

## Add or change an asset

1. Work on an `assets/...` branch. Edit source geometry rather than an opaque GLB alone.
2. Use meters, +Y up and +Z front. Preserve named LOD, collider, door-pivot, attachment and dynamic-display nodes expected by `room-assets.js`.
3. Build into a fresh output and inspect it. Promote only the intended model, editable source and required material files.
4. Run `npm test`, then `node tools/audit-assets.mjs` and `node tools/inventory-assets.mjs`. Review inventory changes, geometry results, relative texture links and licensing.
5. Walk around the model in 3D: front/back, near/far, open doors, lights, collision and nearby terminals. Geometry checks cannot establish every camera angle is free from flicker.

Do not add external furniture or downloaded model meshes. Compatible material textures may be used with their source, license and file hash recorded. Keep UV/material alignment and legible displays; avoid overlapping coplanar surfaces.

Runtime utility assemblies live in `room/utility-kit.js`, `room/plant-connections.js` and `room/supply-fixtures.js`. They are original metric code geometry linked to installed plant and rack counts, rather than additional downloaded models or prebuilt GLBs. Their ownership, measured attachment points and regression checks are described in the [development guide](../../docs/development.md#connected-utility-geometry).

## Provenance and licenses

The base generator, helper and base models were supplied with ROOT under the notices retained in [UPSTREAM_LICENSE.md](UPSTREAM_LICENSE.md) and [asset-pack/LICENSE.md](../../asset-pack/LICENSE.md). These documents assert MIT for code and CC0 for assets; their authorship claims are supplied evidence, not independently verified ownership.

The additional facility builder and original furniture generator are ROOT MIT code; their generated geometry and own weave/leaf maps are dedicated under CC0-1.0. The separately recorded walnut material textures are permitted external CC0 maps, not imported furniture. Preserve the component-specific [NOTICE.md](../../NOTICE.md) and [AI disclosure](../../AI-DISCLOSURE.md).

## Operations pack

The operations target contains a starter pump skid, its enclosed upgrade, a central chiller module, a room air handler, an environmental display, a maintenance robot with dock and cart, and a construction barrier, information board and material pallet. Each has metric bounds, LOD0/LOD1 and a named collider. The environmental display and robot service kit are **prepared assets only**, not automatically placed in rooms. They need a real gameplay purpose and appropriate space before integration.

Central cooling level 1 uses the open starter skid; level 2 replaces it and the starter cabinets with enclosed equipment. Levels 3 and 5 add bounded parallel modules. The real capacity always comes from the engine, not model count. A centrally supplied server room uses the air handler and chilled-water connections; a hybrid room deliberately retains local backup cooling. No duplicate wall status devices are placed in utility or control rooms.
