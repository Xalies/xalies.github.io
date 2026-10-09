# MeshVault Gridfinity planner

Static, browser-only drawer planning at `/generators/gridfinity/`. Serve over
HTTP(S); there is no build step, backend or account. All runtime assets are local
and the tool works on GitHub Pages. The UI uses MeshVault plum branding with cyan
workshop accents.

## 1. Plan your drawer

Set inside width, depth, height and edge clearance on a 42 mm grid. Add named,
coloured bins and drag them between cells. Arrow keys move a selected bin, R
rotates its footprint, Delete removes it, and Undo restores edits. Bins cannot
overlap, leave selected baseplate cells or exceed drawer height. Compartments
run across width. The 3D assembled layout is approximate.

Edit baseplate cells or choose centre screw positions independently. Screws
fasten the baseplate to the drawer floor; bins have no screw holes. Magnets
retain removable bins. Pocket diameter defaults to 6.5 mm and depth to 2.4 mm;
users can set 3-10 mm diameter and 1-5 mm depth. These are pocket dimensions:
allow clearance for magnet fit and printer tolerances. The same sizes apply to
bins and baseplates and are preserved in saved layouts and export settings.

Baseplates stay open beneath each socket. Four corner bosses support blind
pockets with 1.2 mm of material below them. The mounting layer increases with
pocket depth. Large diameters move corner centres inward to match bin geometry.
Selected cells receive a 3.5 mm centre through-hole, 7 mm top countersink and
cross ribs for drawer screws. No full solid mounting slab is added. Check screw
length against drawer-floor thickness and magnet polarity before fitting.

Layouts autosave in localStorage and can be saved/reopened as validated JSON.
Older version-1 layouts without magnet sizes load with the defaults; absent
author profile and donation links remain blank. Invalid imports preserve the existing layout.

## 2. Generate and print

Generate opens the print page immediately. An animated indicator, completed-design
progress bar and elapsed time show local WASM work. Real plate previews appear
as each design finishes. Downloads stay disabled until the entire build succeeds.
Smaller footprints generate first so previews can appear promptly.
Cancel or failure restores the previous complete print set. No partial set is
exported. A changed drawer must be regenerated before export.

Set bed dimensions, spacing and rotation on this page, then regenerate when
needed. Baseplates split into connected sections of at most 6 by 6 cells within
the bed edges; sections have no joining hardware. Matching bin designs generate
once with quantities preserved. Individual bins are not split. The first-fit
plate layout respects custom cell footprints and spacing but does not guarantee
the fewest plates.

Author, optional author URL and author donation URL live on this page and save
with the layout. Name and profile become `author` and `authorUrl` in MeshVault
metadata; the author donation link appears in `descriptionHtml`, separately from
generator support (`exportDonationUrl`). Unknown authors export as Anonymous;
blank URL fields omit their links. Credit changes do not require regeneration.
URLs with credentials or non-HTTPS schemes are rejected.

Choose STL or 3MF and download numbered print plates in a ZIP, or export one
`.mvpack` project containing all plates, 1280 x 720 previews, part settings and
`documents/project-drawer-layout.json`. Open that JSON in the planner to edit the
original design. Quantity/removal edits in the print list do not change the
original drawer plan. Files are unsliced models; check them in your slicer.
Generated meshes remain in memory and clear on refresh. Layout JSON persists.

The original standalone part editor has been removed. This is an original
implementation; the public andymai/gridfinity-layout-tool overview was a product
reference and its source/assets were not used.

## Checks

With Node, Playwright on `NODE_PATH` and Chrome (or `BROWSER_CHANNEL`) available:

- `node meshvault/generators/gridfinity/drawer.test.mjs`: validation, migration,
  overlap/height checks, mounting dimensions and exact split coverage.
- `node meshvault/generators/gridfinity/planner.test.cjs`: interaction, saving,
  immediate page transition, progressive previews, cancellation, real local
  geometry, custom magnet settings, multiple plates, author/donation, STL/3MF
  project exports, local-only requests and responsive layouts.
- `node meshvault/generators/gridfinity/mounting.test.cjs`: actual closed connected
  baseplate geometry, open centres, default and custom pockets, floors, screws
  and custom-depth bin pockets.
- `node meshvault/generators/vessels/test.cjs --vessels-only`: vessel checks.

`test.cjs` forwards the previous entry points to these current checks.

## Source and licenses

- Model archive: [vector76/gridfinity_openscad](https://github.com/vector76/gridfinity_openscad),
  MIT, copyright 2022 Jamie. The SCAD source files are included in
  `vendor/gridfinity_bins.zip`; license in `vendor/gridfinity-MIT.txt`.
  The archive also includes upstream `gridfinity_baseplate.scad`. MeshVault adds a named `magnet_thickness` parameter through the bin modules and cavity-floor calculations; its default remains 2.4 mm.
- Runtime and model archive copied from
  [Web_OpenSCAD_Customizer at fc5835d3bc4bacd9ef058e2c1efbffefef86b209](https://github.com/vector76/Web_OpenSCAD_Customizer/tree/fc5835d3bc4bacd9ef058e2c1efbffefef86b209).
  GPL-2.0; full license in `vendor/LICENSE`. Derived from
  [ochafik/openscad-wasm](https://github.com/ochafik/openscad-wasm).
  The vendored worker uses its own URL to load the local WASM rather than the
  upstream host. Filesystem loading reports network failures explicitly.
- New generator UI: GPL-2.0-only, under `vendor/LICENSE`.
- Retained STL Viewer vendor files: [omrips/viewstl](https://github.com/omrips/viewstl), MIT; `vendor/viewstl-MIT.txt`. The current planner does not load them.
- Three.js and controls: MIT; `vendor/three-MIT.txt`.
- BrowserFS: MIT; `vendor/browserfs-MIT.txt`.

All runtime assets are served locally. The vendored model ZIP and worker helpers
are versioned together so cached pages cannot silently use the old fixed-depth
model. Attribution links lead to their respective projects. Physical tolerances
still require a small test print.
