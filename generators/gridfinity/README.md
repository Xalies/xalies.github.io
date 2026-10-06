# Gridfinity Generator

Static, browser-only Gridfinity bin and baseplate generator at `/generators/gridfinity/`.
Switch Part to Baseplate to generate an open-frame base using the same width
and depth as the bin. Both models use the original 42 mm grid and pad profile.
Serve the repository over HTTP; no build or backend is required. Open the page,
choose settings, generate, and download an STL.
The studio also downloads 3MF and packages either format as `.mvpack`, with model
credit, source, tags, print notes, a preview when available, and design parameters
as an attached JSON file. Existing STL generation is unchanged. 3MF contains the
same mesh with explicit millimetre units, without slicer-specific settings.
The shared packaging code uses local fflate 0.8.3 (MIT); licence in
`../shared/vendor/fflate-LICENSE.txt`.

OpenSCAD runs in a cancellable
worker. Dimensions are limited to 6 × 6 grid units and 12 height units to keep
browser rendering practical. Dividers run across the width only.

Bins expose independent magnet and screw toggles. Magnet diameter is adjustable
(default 6.5 mm); pocket depth is fixed at 2.4 mm by the upstream model. Screw
holes are 3 mm diameter with adjustable depth (default 6 mm). Disabling either
toggle passes zero to the model and records zero in the exported parameters.
Baseplates offer the upstream reinforced/weighted design with both 6.5 × 2.4 mm
magnet pockets and 3.5 mm screw holes with 8.5 mm countersinks. Its height is
10.8 mm; the unmounted open frame remains 5 mm. Reinforced baseplate hardware
dimensions are fixed by the upstream model.

Baseplate footprints can be rectangles, L-shapes, T-shapes, staircases or custom
cell selections. Click the cell grid to add or remove cells. At least one cell
is required, and all selected cells must connect along an edge to create one
piece. Width/depth set the editing area, up to 6 × 6 cells. Custom shapes build
only the selected footprint and sockets, using the upstream reinforced mounting
dimensions. Outer footprint corners are rounded. An elapsed-time indicator stays
visible during generation. The selected
cell coordinates are saved with the parameters in `.mvpack`; STL and 3MF both
contain the single combined model.

## Sets and print plates

Generate a part and choose **Add this model to set**. Repeat for other bins and
baseplates, then set quantities (1–20 copies per design), bed width/depth and
spacing. Saved designs keep their generated settings when the main controls
change. The set is kept in memory on the page; refresh or close clears it.

A first-fit shelf layout uses actual model bounding rectangles, optionally
rotating parts 90°. Spacing also applies at the bed edges. Oversized parts and
invalid quantities block export. Custom baseplates use their bounding footprint;
this planner does not nest parts inside irregular cutouts or guarantee the fewest
possible plates. Check the actual printable region in the slicer.

**Download plate ZIP** contains numbered STL or 3MF plates. Each plate contains
the requested copies, placed on the bed with their bases at Z=0. These are model
layouts, not sliced printer projects. **Export set for MeshVault** packages the
same plate geometry with `meshvault.models.json` and `packType: "collection"`;
each plate becomes one library
item with its layout preview and an attached JSON containing bed dimensions,
placements, quantities (as individual copy entries), and original design settings.
The normal single-part STL/3MF and `.mvpack` exports remain available.

Run `node generators/gridfinity/test.cjs --set-only` to check real bin/baseplate
generation, saved snapshots, quantities, rotation, bed bounds, spacing, multi-plate
STL/3MF exports, the multi-model manifest and attachments, removal and mobile.
Run `node generators/gridfinity/test.cjs --vessels-only` for the vessel demo.

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

Run the browser check with `node generators/gridfinity/test.cjs` with Playwright
available through `NODE_PATH` and Chrome installed (or set `BROWSER_CHANNEL`).
It serves the repository temporarily and checks
real STL generation, preview loading, settings changes, cancellation and mobile layout.

Both demos show a simulated signed-in Xalies account; `.mvpack` author metadata
uses that demo name. Upstream model credits remain in the footer. All exported
preview PNGs are 1280 � 720 (16:9), fitted without cropping.
