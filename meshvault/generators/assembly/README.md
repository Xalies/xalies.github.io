# Modular Storage Designer

A browser-only MeshVault creator tool. The existing `/generators/assembly/`
address is retained so links keep working. In this repository it is served at
`/meshvault/generators/assembly/`. No backend, account or remote modelling
service is required.

## Implementation plan

The direction is a compatible storage system rather than a collection of
unrelated demonstration assemblies. Use one internal frame/insert interface,
with specific adapters for external systems. Do not force all designs onto a
Gridfinity or Honeycomb pitch.

1. **First drawer bay — implemented in this revision.** Replace the cross-beam
   riser with a single frame, integrated side guides and a rear stop. Provide
   interchangeable full-height finger-pull drawers and shallow open trays,
   desk-drawer and wide-parts-tray presets, illustrated guides and project
   exports. Preserve the removable-tray organiser. Software checks are required;
   physical fit remains untested.
2. **Visual cabinet planner — implemented in this revision.** Add/remove columns
   and rows, select each bay, configure inserts, dividers, handles and label
   holders, and set row heights. Recessed M3 fasteners join separately printed
   frames. Bed-aware packing exports either complete print plates or individual
   parts. Software validation is required; physical fit remains untested.
3. **External-system interfaces — planned.** The cabinet now has a Gridfinity socket tray.
   More Gridfinity bases and Honeycomb Storage Wall mounting adapters remain planned. Verify each mating
   geometry against its source specification and a physical sample before
   presenting it as a proven interface. Keep unsupported mounts out of the UI.
4. **Sharing and print refinement — planned.** Add small fit coupons for the
   established connectors, curated examples
   and any print-verified tolerances. Keep part quantities, print orientations,
   instructions and pictures consistent with the selected build.

The drawer foundation and visual cabinet planner are implemented, not the whole roadmap.
There is no tested load rating and no physical fit validation yet.

## Visual cabinet planner

The default two-column parts cabinet has two rows (65 and 80 mm). Presets also
include a one-row desk station and a two-row tool cabinet. Use the front elevation
to select bays, add/remove columns (1–3) or rows (1–4), and configure each bay as a
plain drawer, divided drawer, shallow tray, open shelf or Gridfinity socket tray.
Row 1 is the bottom row; bay numbers increase left to right, then upwards.

Column width, depth, wall thickness and fit clearance apply to the whole build.
Row height applies to every bay in the selected row, keeping seam holes aligned.
Each drawer supports 1–4 compartments across and deep, a bar pull or finger notch,
rounded vertical corners and an optional holder for a 36 × 9 mm paper label.
Bay names appear in the planner and illustrated guide; they are not embossed.
The shelf uses the frame's floor without an insert. Tray heights are at most
18 mm. Gridfinity socket trays use whole 42 mm cells centred inside the tray;
there are no magnets, screw mounts or stacking lips. Verify that the intended
Gridfinity bins fit below the bay roof.

Adjacent frames have two aligned M3 bores per seam, located at 35% and 75% of
the depth. Right/top walls have countersinks; left/bottom walls have recessed
hex-nut pockets. Join empty frames before inserting drawers. Walls are 4 or
5 mm to preserve material around the pockets; use M3 countersunk screws of
length `2 × wall thickness` (8 or 10 mm) and M3 hex nuts. Hardware is purchased
separately, counted in the BOM and not represented by printable dummy parts.
This is a light-duty freestanding storage design, not a tested monitor riser,
wall mount or load-rated cabinet. Test a seam and an insert before printing a
large cabinet. Tall layouts require care against tipping.

Printer bed width/depth default to 220 mm. Packing reuses the Gridfinity plate
arranger with 5 mm spacing, 90-degree rotation and one copy of every part. A
part too large for the bed blocks export with its name and dimensions. Frames
print rear-down, making their print height equal to the cabinet depth: verify
printer Z clearance separately. Handles/label holders may need local supports.
The print view shows the actual packed plates with bed outlines. These are
unsliced models, not printer-specific slicer projects.

By default, cabinet exports contain one STL/3MF per arranged plate. Uncheck
"Export arranged print plates" for one file per named part. Both modes use one
`.mvpack` project and include the same illustrated guide, hardware/part BOM and
`printer-layout.json` mapping bay-part IDs to positions on each plate. The saved
settings include all bay choices and heights; they are reference data, not an
editable project importer.

## Drawer Bay v1

The frame has a closed rear panel, top, bottom and two side walls. Two integral
side guides carry the insert without cross-beams occupying its storage space.
The rear panel stops the insert; there is no captive stop preventing deliberate
removal. A full-height drawer has an 8 mm-radius finger notch in its front wall.
The shallow tray is at most 18 mm high and uses the same frame and bearing
surfaces.

Settings use outer frame width `W`, depth `D`, height `H`, wall/floor thickness
`t`, and total fit clearance `c`. The exported `moduleInterface` is
`drawer-bay-v1` for both insert types. This describes the connection family;
matching sizes are still required.

- Insert outer width: `W - 2t - c` (clearance `c/2` at each side).
- Insert depth: `D - t - c`. Its rear face meets the frame's rear wall and its
  front sits `c` inside the frame opening.
- Insert underside: `t + 2` above the frame bottom.
- Full-height insert height: `H - 2t - 2 - c`, leaving `c` below the roof.
- Side guides project 3 mm from each inner side wall and are 2 mm high. At the
  maximum supported clearance, each guide still overlaps the insert by 2.4 mm.
- Both inserts use `t` for wall and floor thickness.

Use the same `W`, `D`, `H` and `t` for another insert. Clearance can be adjusted
for the printer; changing it does not change the generated frame geometry.
The drawer and tray presets deliberately have different sizes; they are not
interchangeable across sizes.

Print the frame on its closed rear panel with the front opening facing upwards.
Its bed footprint is `W × H` and its print height is `D`. Print inserts upright
on their floors. Exported meshes are already in those orientations, Z-up in
millimetres. The print preview shows orientations, not packed printer plates.
Check bed dimensions, print height, sliced walls and fit before a full set.

## Existing organiser

The desk organiser contains one closed-bottom carrier and two to four removable
trays. Tray rims extend 3 mm above the carrier. Clearance is extra total width
and depth within each tray's bay, not clearance per side.

Its optional Gridfinity underside adds 5 mm beneath the carrier. Choose 3–5 grid
units wide and 2–4 deep, with outer dimensions `units × 42 - 0.5 mm`. The existing
local OpenSCAD runtime unions the upstream pads into the carrier. There are no
magnet pockets, screw holes or stacking lip. This option belongs to the
organiser; the cabinet has a separate Gridfinity socket tray option.

## Downloads and authors

Download a ZIP of named STL or 3MF files, or one `.mvpack` project using
`meshvault.models.json` and `packType: "project"`. The project includes every
part, three generated 1280 × 720 gallery pictures, printing/assembly notes,
reference generation settings, an offline illustrated HTML guide and a parts
list. Root-level projects enter MeshVault's Imports to Review. Older MeshVault
builds without project-package support may split the parts.

Optional author, HTTPS author URL and author donation URL are saved on the
current device. Blank names become Anonymous. Author links travel in the rich
HTML guide; the generator support link credits this tool. User text is escaped
and credentials in URLs are rejected. Pictures are embedded as data URLs in the
guide, so it remains usable offline. Rich HTML rendering varies across clients;
the gallery and attached guide preserve the pictures independently.

Generation, geometry workers, pictures and packaging run on the user's device.
Settings are reference data; MeshVault does not regenerate these models.

## Sources and checks

Original designer source is MIT, copyright 2026 Xalies; see LICENSE.
`cabinet.js` reuses the GPL-2.0 Gridfinity baseplate source and is marked GPL-2.0-only. Three.js and
OrbitControls use the existing local MIT assets in `../gridfinity/vendor/`.
The local OpenSCAD runtime and shared worker/export helpers come from the
Gridfinity generator, GPL-2.0; see its README and `vendor/LICENSE`. The organiser's
pad geometry is from vector76/gridfinity_openscad, MIT (Jamie, 2022), in the
existing `gridfinity_bins.zip` with `gridfinity-MIT.txt`. No new dependency is
needed. New drawer geometry is defined here and generated by the same worker.

Run `node meshvault/generators/assembly/test.cjs` and
`node meshvault/generators/assembly/cabinet.test.cjs` with Playwright in NODE_PATH.
Cabinet checks cover planner edits, seam-axis alignment, closed connected part
meshes, packed-bed bounds and unique inventory, Gridfinity trays, hardware BOM,
STL/3MF/project export modes, invalid bed handling, presets and escaped bay labels.
Checks cover the shared drawer/tray interface, min/default/max fit dimensions,
closed connected meshes with outward winding, actual finger-notch geometry,
identical frame geometry across insert swaps, preserved organiser/Gridfinity
exports, STL/3MF ZIP and project contents, author credit, offline guides,
escaping, previews and desktop/mobile layout. These are software checks, not a
physical fit or load test.
