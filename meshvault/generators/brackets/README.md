# Bracket Works

Browser-only custom L bracket generator. Serve the repository over HTTP.
Uses the existing Three.js and shared STL/3MF and mvpack exporters; no new dependency.
Legs, width, thickness, hole diameter, hole count and hole end distance are editable.
A single closed boundary mesh joins both legs without overlapping solids. Export
coordinates lay the L-shaped side on Z=0; inspect the hole bridges in your slicer.
This prototype has no physically tested load rating or fastening specification.

Custom author name and profile use `author` and `authorUrl`. The optional author
support URL is a link in escaped `descriptionHtml`; it is not an unsupported
metadata field. The generator donation URL uses `exportDonationUrl`, separately.
Empty optional links are omitted; non-HTTPS and credential-bearing links fail
visibly. Attribution is read at export time so edits do not require regeneration.

Normal STL/3MF and mvpack exports contain the same geometry. Packages add a 16:9
thumbnail, description, print notes and attached design settings. Root-level
single models enter Imports to Review. See the [format guide](../../generator/).

Run `node meshvault/generators/brackets/test.cjs` with Playwright available via NODE_PATH.
New code is MIT, copyright 2026 Xalies. See LICENSE and
`../gridfinity/vendor/three-MIT.txt` for Three.js / OrbitControls licensing.

Optional related-page and YouTube URLs become description links and a privacy-
enhanced iframe with a watch-link fallback. Only supported YouTube hosts and
11-character video IDs are accepted. Playback requires an online client and
an embeddable video; a packaged iframe is not an offline video download.

Optional 45° chamfers have independent outer-edge and hole-opening sizes; zero
keeps square edges. Outer bevels cover convex corners across the width and the
side-cap perimeter, preserving the internal right-angle joint. Size is capped
at a quarter of thickness and 3 mm. Both hole mouths receive a bevel smaller
than half the thickness, with 3 mm maximum and a straight bore in between.
Extra hole clearance is validated after chamfering. This is an edge break, not
a screw-head countersink. Chamfer sizes travel in settings and description.
