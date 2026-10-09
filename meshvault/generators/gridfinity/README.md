# MeshVault Gridfinity Generator

Static, browser-only Gridfinity drawer planner and part generator at `/generators/gridfinity/`.
Switch Part to Baseplate to generate an open-frame base using the same width
and depth as the bin. Both models use the original 42 mm grid and pad profile.
The interface uses the MeshVault logo, plum palette and system typography, with cyan workshop accents. It is a creator tool without an account requirement; an optional author field credits your name in single-part and set packages, or Anonymous when blank.
Serve the repository over HTTP; no build or backend is required. Open the page,
choose settings, generate, and download an STL.
The studio also downloads 3MF and packages either format as `.mvpack`, with model
credit, source, tags, print notes, a preview when available, and design parameters
as an attached JSON file. Existing STL generation is unchanged. 3MF contains the
same mesh with explicit millimetre units, without slicer-specific settings.
The shared packaging code uses local fflate 0.8.3 (MIT); licence in
`../shared/vendor/fflate-LICENSE.txt`.

OpenSCAD runs in a cancellable
worker. Individual part dimensions are limited to 6 × 6 grid units and 12 height units to keep
browser rendering practical. Dividers run across the width only.

## Drawer planner

The default workspace plans a drawer in millimetres on a 42 mm grid. Set its
inside width, depth, height and edge clearance. Add named, coloured bins, drag
them between cells, edit their dimensions or rotate their footprints. Arrow keys
move the selected bin, R rotates and Delete removes it; Undo restores edits.
Bins cannot overlap, extend beyond selected baseplate cells or exceed the drawer
height. Compartments divide across width, up to three per cell. The 3D layout is
an approximate assembled preview, not the generated CAD geometry.

Baseplate mode includes/excludes cells. Drawer screws mode selects centre
fixings independently of magnet pockets. Magnets apply to both bins and their
baseplates; screws attach baseplates to the drawer floor. Generation splits the
footprint into connected sections of at most 6 by 6 cells, within the selected
bed's 5 mm edge clearance. Split sections are separate pieces, without joining
hardware. Matching bins generate once and retain their quantities. Generation
runs in cancellable local WASM workers; a cancelled or failed build preserves
existing print-set models. A successful build replaces its previous drawer
models and keeps manually added designs.

Layouts autosave in localStorage and can be saved/reopened as validated JSON.
No accounts, backend, remote fonts or generation services are required; static
GitHub Pages hosting is sufficient. Generated meshes remain in memory only.
A drawer `.mvpack` uses `packType: "project"`, with print plates, author credit,
previews, parameters and `documents/project-drawer-layout.json`. Open that JSON
in this planner to edit the original plan. Print-set quantity/removal edits do
not alter the original drawer plan; regenerate after editing the drawer itself.
Manually assembled sets retain `packType: "collection"` behavior.

This is an original implementation of the drawer-planning workflow. The public
[andymai/gridfinity-layout-tool](https://github.com/andymai/gridfinity-layout-tool)
overview was a product reference; its source and assets were not used.

Run `node meshvault/generators/gridfinity/drawer.test.mjs` for planning assertions
and `node meshvault/generators/gridfinity/planner.test.cjs` for browser interaction,
local persistence, real WASM generation, split sections, multi-plate STL/3MF and
project-package checks. Playwright must be available through `NODE_PATH`.

## Individual parts

Bins offer optional magnet pockets with an adjustable diameter (default 6.5 mm)
and fixed 2.4 mm depth. Turning magnets off passes zero to the model. Bin screw
holes are always disabled (`screw_depth: 0`); screws are a baseplate feature.
Baseplates stay open underneath. Their corner magnets retain magnet-equipped
bins; selected centre screws attach only the baseplate to the drawer floor. Optional corner bosses hold four 6.5 x 2.4 mm
blind magnet pockets per cell, with 1.2 mm of material beneath each pocket.
To fasten the baseplate to the inside floor of a drawer, switch the footprint
grid to Centre screw positions and select individual cells. Use countersunk
screws with a length suited to the drawer-floor thickness; bins remain removable.
Only selected cells receive a centre boss and two 3 mm-wide crossing support ribs,
with a 3.5 mm through-hole and a 7 mm top countersink (1.75 mm deep).
These mounts add 3.6 mm below the standard socket, for 8.6 mm total height;
unmounted frames are 5 mm. All baseplates start at Z=0. Removing a footprint cell
also removes its screw mount. Magnet and screw options are independent and are
saved as `base_magnets` and `screw_cells` in exported settings. Check hardware
fit and magnet polarity before assembly; printer tolerances require a test print.
Run `node meshvault/generators/gridfinity/test.cjs --mounting-only` for actual
geometry, open centres, magnet pocket floors, screw selection and package checks.

Baseplate footprints can be rectangles, L-shapes, T-shapes, staircases or custom
cell selections. Click the cell grid to add or remove cells. At least one cell
is required, and all selected cells must connect along an edge to create one
piece. Width/depth set the editing area, up to 6 × 6 cells. Custom shapes build
only the selected footprint and sockets, using the selected mounting
dimensions. Outer footprint corners are rounded. An elapsed-time indicator stays
visible during generation. The selected
cell coordinates are saved with the parameters in `.mvpack`; STL and 3MF both
contain the single combined model.

## Sets and print plates

Generate a part and choose **Add this model to set**. Repeat for other bins and
baseplates, then set quantities (1–20 copies per design), bed width/depth and
spacing. Saved designs keep their generated settings when the main controls
change. The set is kept in memory on the page; refresh or close clears it.

A first-fit layout uses the actual selected cells of custom baseplates and
bounding rectangles for bins, optionally rotating parts 90 degrees. Spacing
applies between parts and at bed edges. Oversized parts and invalid quantities
block export. The layout can nest parts around irregular cell footprints but
does not guarantee the fewest plates. Check printable regions in your slicer.

**Download plate ZIP** contains numbered STL or 3MF plates. Each plate contains
the requested copies, placed on the bed with their bases at Z=0. These are model
layouts, not sliced printer projects. **Export set for MeshVault** packages the
same plate geometry with `meshvault.models.json`. Manual sets use `packType: "collection"`;
each plate becomes one library
item with its layout preview and an attached JSON containing bed dimensions,
placements, quantities (as individual copy entries), and original design settings.
The normal single-part STL/3MF and `.mvpack` exports remain available.

Run `node meshvault/generators/gridfinity/test.cjs --set-only` to check real bin/baseplate
generation, saved snapshots, quantities, rotation, bed bounds, spacing, multi-plate
STL/3MF exports, the multi-model manifest and attachments, removal and mobile.
Run `node meshvault/generators/gridfinity/test.cjs --vessels-only` for the vessel demo.

## Source and licenses

- Model archive: [vector76/gridfinity_openscad](https://github.com/vector76/gridfinity_openscad),
  MIT, copyright 2022 Jamie. The SCAD source files are included in
  `vendor/gridfinity_bins.zip`; license in `vendor/gridfinity-MIT.txt`.
  The archive also includes upstream `gridfinity_baseplate.scad`.
- Runtime and model archive copied from
  [Web_OpenSCAD_Customizer at fc5835d3bc4bacd9ef058e2c1efbffefef86b209](https://github.com/vector76/Web_OpenSCAD_Customizer/tree/fc5835d3bc4bacd9ef058e2c1efbffefef86b209).
  GPL-2.0; full license in `vendor/LICENSE`. Derived from
  [ochafik/openscad-wasm](https://github.com/ochafik/openscad-wasm).
  The vendored worker uses its own URL to load the local WASM rather than the
  upstream host. Filesystem loading reports network failures explicitly.
- New generator UI: GPL-2.0-only, under `vendor/LICENSE`.
- STL Viewer: [omrips/viewstl](https://github.com/omrips/viewstl), MIT;
  `vendor/viewstl-MIT.txt`.
- Three.js and controls: MIT; `vendor/three-MIT.txt`.
- BrowserFS: MIT; `vendor/browserfs-MIT.txt`.

All runtime assets are served locally. The generator makes no requests to a
model-generation service. Attribution links lead to their respective projects.

Run the browser check with `node meshvault/generators/gridfinity/test.cjs` with Playwright
available through `NODE_PATH` and Chrome installed (or set `BROWSER_CHANNEL`).
It serves the repository temporarily and checks
real STL generation, preview loading, settings changes, cancellation and mobile layout.

Gridfinity has no signed-in account. The optional author fields credit the
entered name, or Anonymous when blank. Upstream model credits remain in the
footer. Exported preview PNGs are 1280 x 720 (16:9), fitted without cropping.
