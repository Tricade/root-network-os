# README media

The interface gallery was refreshed on **2026-11-02** for the customer, research and dashboard integration. It uses an isolated fictional `ROOT / OPERATIONS` fixture with 18 servers, six racks, six robot agents, four named customer contracts and a funded research project. The preset and capture workflow are maintained in `desktop/docs-capture.cjs`; no player network is read or changed. Normal interface and room captures use English.

The native Electron 45.2.1 run verifies the requested route, decoded images and actual presented frames before recording. The control-room capture additionally waits for that physical room to render. Transient toast notifications are hidden only for the documentation capture; milestones, pending work, costs and normal controls remain visible. The gallery shows the grouped menus, dedicated achievements, resource-backed customer business, the research graph, actual upgrade comparisons and the shared room console. These captures were visually reviewed; they do not establish appearance on every platform or GPU.

The planned-operations update replaces `research-tree.jpg`, `jobs.jpg` and `achievements.jpg` with actual embedded-browser captures of the 96-technology map and generated raster illustrations. `operations-cooling.jpg` and `room-air-handler.jpg` show the upgraded central plant and a server room after its paid central-cooling conversion. These five images use a separate synthetic fixture with 18 servers, six racks and two agents; the earlier gallery images retain their original fixture. No screenshot edits substitute for runtime geometry. See the [verification scope](../../docs/verification-planning.md).

The attention-center update adds `dashboard-attention.png`, `notifications.png` and `research-details.png` from the running embedded browser with the same isolated 18-server, six-rack, two-agent fixture. They show actionable dashboard entries, filtered notifications and an already-completed technology. This fixture has deliberately elevated credits to exercise late-game interfaces; it is not an example of normal earning rates. These are unedited runtime captures, with no player save or private account data.

To reproduce the native gallery on PowerShell:

```powershell
$env:ROOT_CAPTURE_DOCS = '1'
node tools/desktop/launch.cjs --smoke --output=.desktop-build/docs-capture
Remove-Item Env:ROOT_CAPTURE_DOCS
```

On a POSIX shell, prefix the same Node command with `ROOT_CAPTURE_DOCS=1`. The resulting JPEGs are in the output's `documentation` directory. Keep the native result report separate from public media because it contains runtime and hardware diagnostics. Copy only reviewed images into this directory.

`arrival.webp` was refreshed on 2026-11-01 for version 1.5.1. It contains 51 actual Electron presentation frames of the English bunker arrival with the **root. / NETWORK OS** wordmark. Frame durations follow the capture timestamps, with a short first/last hold for readability. The isolated capture hides achievement toasts only while recording. `arrival-poster.jpg` is a frame from the entrance approach. The README uses the poster when reduced motion is requested and also links it directly. No generated scene has been substituted for a runtime capture.

`wordmark.svg`, `facts.svg` and `support.svg` are original, editable SVG documentation graphics. They have no remote fonts, scripts or external image references. The application captures retain the component provenance described in [NOTICE.md](../../NOTICE.md).

To refresh this gallery, start a separate local instance with its own `ROOT_PORT` and `ROOT_DATA_DIR`, use synthetic data, and capture the actual affected view after it has rendered. Keep small previews readable, give images descriptive alternative text, and check the rendered README on its current Git host. Avoid capture metadata containing local paths or credentials. The documentation graphics and media are not runtime dependencies.

Rendering compatibility was checked against the deployed Gitea 28.2.0 Markdown API. GitHub supports relative image paths and [inline WebP images](https://github.blog/changelog/2025-08-28-added-support-for-webp-images/). Encoding used ImageMagick 7.1.2-27; see its [matching animation-options documentation](https://raw.githubusercontent.com/ImageMagick/ImageMagick/7.1.2-27/www/command-line-options.html).
