# Assembly Studio

Browser-only five-piece display riser generator at `/generators/assembly/`.
Serve the repository over HTTP. No build, backend or new dependency is required.
Three.js supplies polygon extrusion and rendering through the existing local
Gridfinity assets. New generator code is MIT, copyright 2026 Xalies. See LICENSE
and `../gridfinity/vendor/three-MIT.txt` for Three.js / OrbitControls licensing.

The kit consists of two slotted trapezoidal side frames, two rectangular cross
rails and a 4 mm top deck. Rail section: 12 × 16 mm. Slot clearance is extra total
width and height, not clearance per side. Rails protrude 2 mm beyond each outer
frame face. Files use Z-up millimetre print coordinates; assembled, exploded and
print-orientation previews are separate display transforms. The print preview
is not a packed bed layout. No physically tested load rating is claimed. Dry-fit
before gluing and verify printer-specific tolerances.

Normal export is a ZIP of five named STL or 3MF files. `.mvpack` uses
`meshvault.models.json` with `packType: "project"`: the archive remains one
MeshVault library item, with five accessible parts. A root-level project enters
Imports to Review. This requires a MeshVault build with project-package support;
older builds may split the parts. The demo account supplies Xalies as author.
The shared `project` metadata includes:

- Rich `descriptionHtml`: headings, parts table, numbered steps, links and actual
  generated pictures. PNG pictures are embedded as data URLs so HTML does not
  rely on a description renderer resolving archive paths.
- A 1280 × 720 thumbnail and three PNG gallery files through `extraImageFiles`.
- Offline `assembly-guide.html`, `parts-list.csv` and generation parameters
  through `documentFiles`. The HTML guide embeds its pictures.
- Shared print notes, generator / source credit and a support link.

Each part keeps its title, print settings and generation parameters.

The standalone guide is a complete HTML document; description metadata is an
HTML fragment. Rich rendering varies by MeshVault client. Gallery files and the
attached guide preserve pictures independently of the description renderer.
Design names are HTML-escaped. All generation and packaging happens locally.

Run `node generators/assembly/test.cjs` with Playwright available through NODE_PATH.
Checks cover topology, volumes, joints, dimension ranges, STL / 3MF files,
metadata, gallery / attachments, offline HTML, escaping, previews and mobile.
