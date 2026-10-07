# Pocket Eden

Browser landscape editor at `/generators/pocket-eden/`, linked from the main
page's 3D generators section. No build or installation is needed. `index.html`
contains the app, its dependencies and their licence notices, and works offline
when downloaded as `Pocket Eden.html`.

Draw paths, gently raise or carve terrain, level clearings, and place trees,
cottages, ruins, arches, tents, rocks or miniature bases. Expand the build
boundary without scaling existing work. Randomise the seed to start fresh
terrain of the same size and shape; save first or use Undo to restore the old
world. Browser storage keeps the current world; Save world creates portable
JSON. Open world also accepts Pocket Eden `.mvpack` projects.

Export includes printer-sized tiles with attached scenery as combined STLs or
named, aligned 3MF parts for colour assignment and painting. Keep each 3MF tile
assembled as one multipart object. Tree undersides slope up to 50 degrees from
vertical. Scenery is clipped at tile seams, with permanent roots for otherwise
floating fragments. Matching underside sockets take removable butterfly keys;
adjust clearance when exporting and test one pair before printing the set.
Full terrain-only STL and an optional loose scenery kit remain available.

`.mvpack` retains the STL/3MF alternatives, key quantity, assembly guide,
placement CSV, scene-only preview and editable world settings. Print one format
per tile. 3MF colours are display hints, without printer profiles or automatic
filament assignments. Inspect the sliced preview and any arches or bridges;
physical printing and connector fit have not been validated.

## Examples

- [Lanternbrook .mvpack](examples/lanternbrook.mvpack): a 300 mm village with
  four terrain tiles, 143 scenery placements, matching 3MFs and removable keys.
- [Lanternbrook 3MF tiles](examples/lanternbrook-3mf-tiles.zip): a ZIP for a slicer.
- [Editable Lanternbrook world](examples/lanternbrook.eden.json).

Run `node generators/pocket-eden/test.cjs` with Node.js 22 or newer. The existing
standalone check exercises closed mesh edges and winding, STL/3MF structures,
scenery crossing seams, connector dimensions, project round-trips, terrain
strength and expansion, input validation, and terminating audio sources.

New app code is MIT, copyright 2026 Xalies; see LICENSE. Three.js and fflate MIT
notices are retained in the HTML. The package writer reuses this site's
`generators/shared/mvpack.js` implementation. Generated worlds stay on the
visitor's device.
