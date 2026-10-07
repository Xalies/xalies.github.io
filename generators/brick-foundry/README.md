# Brick Foundry

Static, browser-local construction-piece generator at `/generators/brick-foundry/`.
The light workshop layout, shape cards, clickable stud pad, fit dial, layer controls
and inventory are specific to this generator. No server or account is needed.

Piece studio creates bricks, plates, smooth tiles, two-stud-long slopes, L corners
and round 1×1 pieces. Bodies have open undersides; studs and internal supports share
the same fit adjustment. Dimensions use an 8 mm pitch, 9.6 mm brick height and
3.2 mm plate height. These are nominal compatible dimensions, not physically
validated clutch strength. Test a pair before printing a kit.

Model → set imports binary/ASCII STL, 3MF core meshes/build transforms/components
(including external production component resources), or STEP/STP tessellated by
OCCT. Geometry is oriented and uniformly resized, sampled on a stud/plate grid,
then covered with whole pieces from the brick, plate, corner and slope catalogue.
No piece is cut to the source boundary. Solid and one-cell shell filling are
available. Alternate courses rotate and offset seams. The connection report
counts vertical stud contacts; it is not a physical strength or overhang solver.

Limits: 25 MB uploaded files, 75 MB expanded 3MF XML, 150,000 expanded triangles,
6–40 studs on the longest source dimension, and 4,000 pieces. Open surfaces get a
surface fallback and a warning; closed solids give the most reliable result.
The greedy sampler can omit sub-stud details and leave separate groups. Inspect
the source overlay, layer view and group count before committing to a print.

Downloads:
- A single piece as STL, 3MF or `.mvpack` with clean model thumbnail and settings.
- A print-kit ZIP with each distinct STL/3MF, filenames stating copy counts,
  CSV inventory, JSON placements, HTML layer instructions and assembly reference.
- A `.mvpack` project with distinct models and quantities, clean preview, shared
  instructions, inventory, layout and assembled reference.
- A core 3MF assembly with repeated build items and per-part base colours. It is
  a layout reference; print the individual parts. Slicer colour handling varies.

Run the geometry/parser/export check with `node test.cjs`. An optional absolute
output directory writes generated QA models. The check covers closed meshes,
fit extremes, exact coverage/no overlaps, a seam-bridged box, STL round-trips,
STEP units, 3MF instances, packaging and the existing Vessel Studio export.

Serve the repository root over HTTP with JavaScript MIME types for `.js` and
`application/wasm` for `.wasm`. GitHub Pages serves the deployed app. STEP loads
its additional WASM reader only when needed, inside a cancellable worker.

Original code is MIT (see `LICENSE`). Three.js/OrbitControls, fflate, packaging
and the STL writer are reused from the other generators. Third-party notices,
source and build references are in [vendor/README.md](vendor/README.md).
Independent project, not affiliated with or endorsed by the LEGO Group.
