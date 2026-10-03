# Gridfinity Generator

Static, browser-only Gridfinity bin and baseplate generator at `/generators/gridfinity/`.
Switch Part to Baseplate to generate an open-frame base using the same width
and depth as the bin. Both models use the original 42 mm grid and pad profile.
Serve the repository over HTTP; no build or backend is required. Open the page,
choose settings, generate, and download an STL. OpenSCAD runs in a cancellable
worker. Dimensions are limited to 6 × 6 grid units and 12 height units to keep
browser rendering practical. Dividers run across the width only.

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
