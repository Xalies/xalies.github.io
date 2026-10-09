# Assembly Studio

Browser-only MeshVault creator tool at `/meshvault/generators/assembly/` in this
repository and `/generators/assembly/` on the MeshVault site. Serve over HTTP;
no backend, account, build step or remote modelling service is required.

## Assemblies

- **Display riser:** two slotted trapezoidal frames, two cross rails and a 4 mm
  deck. Rails are 12 × 16 mm and protrude approximately 2 mm beyond each frame.
  Slot clearance is extra total width and height, not clearance per side.
- **Desk organiser:** one closed-bottom carrier and two to four removable,
  closed-bottom trays. Tray rims extend 3 mm above the carrier for lifting.
  Wall and floor thickness are shared. Clearance is extra total width and depth
  for each tray within its bay, not clearance per side. Trays remain removable;
  no adhesive is required.
- **Optional organiser Gridfinity base:** built into the carrier, adding 5 mm
  beneath its floor. Choose 3–5 grid units wide and 2–4 deep. Carrier dimensions
  are `units × 42 − 0.5 mm`. The existing local OpenSCAD worker unions the
  upstream Gridfinity pads with the carrier, producing one connected printable
  part. It has no magnet pockets, screw holes or stacking lip. Removable trays
  remain ordinary inserts. The riser does not offer this option.

Print coordinates are Z-up millimetres. Assembled, exploded and print-orientation
views are separate transforms; the print preview is not a packed bed layout.
Neither physical fit nor load capacity has been tested. Test one tray or joint,
and test the Gridfinity underside on your own baseplate before a full print.

## Downloads and author credit

Download a ZIP of named STL or 3MF files, or a `.mvpack` using
`meshvault.models.json` with `packType: "project"`. Every assembly stays one
MeshVault project with its individual parts inside. Root-level projects enter
Imports to Review. Older MeshVault builds without project-package support may
split the parts.

Optional author, HTTPS author URL and HTTPS author donation URL are saved on the
current device. Blank names become Anonymous. Author links appear in the
illustrated description; the generator support link credits Assembly Studio.
Names and design titles are HTML-escaped. Credentials in URLs are rejected.

Shared project metadata contains:

- Rich HTML with a parts table, four assembly steps, links and three actual
  generated pictures embedded as data URLs.
- A 1280 × 720 thumbnail and three PNG gallery files.
- An offline `assembly-guide.html`, a per-part `parts-list.csv` and generation
  settings, including assembly type, tray count and Gridfinity selection.
- Printing and assembly notes, generator credit and source links.

Each part keeps its own title, print notes and parameters. Generation, preview
pictures and packaging happen on the user's device. Rich HTML rendering varies
between MeshVault clients; the gallery and offline guide preserve the pictures.

## Sources and checks

New Assembly Studio source is MIT, copyright 2026 Xalies; see LICENSE.
Three.js / OrbitControls are existing local MIT assets; see
`../gridfinity/vendor/three-MIT.txt`. Gridfinity pad geometry comes from the
existing vector76/gridfinity_openscad archive, MIT (Jamie, 2022), in
`../gridfinity/vendor/gridfinity_bins.zip`; see `gridfinity-MIT.txt` there.
The local OpenSCAD runtime and shared worker/export helpers come from the
Gridfinity generator, GPL-2.0; see its README and `vendor/LICENSE`.
The optional base reuses that runtime and does not download a new dependency.

Run `node meshvault/generators/assembly/test.cjs` with Playwright in NODE_PATH.
Checks cover closed meshes, volumes, joints and tray clearances, dimension
ranges, both assemblies and the optional Gridfinity base, STL/3MF ZIP and
project exports, author credit, rich HTML, gallery/attachments, escaping and
responsive previews. Geometry checks do not replace a physical fit test.
