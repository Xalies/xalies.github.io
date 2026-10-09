# Vessel Studio

Browser-only vase and bowl generator at `/generators/vessels/`. Serve the repository
over HTTP; no build or backend is required. Live controls create a closed hollow
mesh with an open mouth, radial walls and a flat base. STL and 3MF contain the same
geometry; 3MF uses explicit millimetre units and has no slicer-specific settings.

The separate **Export for MeshVault** action reuses the selected model bytes and
adds a small, relevant metadata subset, a preview PNG when available, and design
parameters in `documents/generator-settings.json`. It does not regenerate designs
on import. No account is needed. Optional author name, author profile URL and
author donation URL are saved on this device. Blank names export as Anonymous;
links must use HTTPS without credentials. The profile uses `authorUrl` and the
author support link appears in the escaped HTML description. Generator support
remains separate in `exportDonationUrl`.
Preview PNGs are 1280 x 720 (16:9), fitted without cropping. Colour is preview-only.

`../shared/mvpack.js` contains the packaging example used by the creator tools. Read the
[integration guide](../../generator/mvpack-integration.md) for the format contract.
The vendored ZIP implementation is [fflate 0.8.3](https://github.com/101arrowz/fflate),
MIT, with its licence in `../shared/vendor/fflate-LICENSE.txt`. Three.js and orbit
controls reuse Gridfinity's local MIT assets and `../gridfinity/vendor/three-MIT.txt`.
New Vessel Studio and shared code: MIT, copyright 2026 Xalies; see `LICENSE`.
Generated designs are yours to use.

The print-goal selector offers general and watertight-focused starting settings
for a 0.4 mm nozzle. Applying suggested wall/base minimums explicitly updates the
geometry; changing the advice alone does not. Advice follows
[Prusa's open-vessel guide](https://blog.prusa3d.com/watertight-3d-printing-pt1-vases-cups-and-other-open-models_48949/)
and requires calibrated profiles, slicer inspection and leak testing. Radial wall
thickness does not guarantee normal wall thickness on sloping parts. Selected
advice is serialised into the metadata's `printSettingsJson` string; it is not a
slicer preset embedded in the 3MF. Packages also include
`exportDonationUrl: https://buymeacoffee.com/xalies` for generator support.

Run `node meshvault/generators/vessels/test.cjs --vessels-only` with Playwright in `NODE_PATH` and Chrome
installed. This checks actual vessel downloads, ZIP metadata, thumbnails,
byte-identical model entries, STL/3MF structure, vessel mesh topology, mobile
layout and author metadata validation. Physical printing and import into the
MeshVault desktop application still need manual verification.

The watertight profile includes an optional 105% flow / 1.05 extrusion multiplier
test after filament calibration. Use one equivalent slicer setting; added flow
can affect dimensions and surface quality. The suggestion is retained in exported
printing advice, without changing the mesh.

The desktop workspace keeps shape controls, a large live preview and print/export
controls side by side. MeshVault plum branding and navigation are shared with the
ecosystem; serif headings, clay accents and the curved preview retain the studio
identity. Printing guidance scrolls independently of the download area, with
author details in an expandable section directly above the downloads.

Shape dimensions can be edited on the SVG profile: drag base, belly and mouth
diameter handles horizontally, and height vertically. The silhouette shares the
mesh radius function (belly at 55% height); flutes are shown in the 3D preview.
Arrow keys change a focused handle by 1 mm, Shift by 10 mm, Home/End select its
limits. Exact dimensions remain available in an expandable section; wall and
base thickness stay separate. All dimensions retain their existing bounds.

The profile editor shows one half of the vessel, measured from its centreline.
Click the outline or use Add point to insert extra control points; drag them
horizontally for diameter and vertically for height. Added points cannot cross
their neighbours. Delete/Backspace or Remove point removes the selected extra
point. Presets clear extra points. Exported parameters include `profilePoints`
(normalised height `t` and diameter in mm), shared by the preview and mesh.
