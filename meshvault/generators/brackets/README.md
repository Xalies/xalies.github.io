# Bracket Works

Browser-only custom L, U, Z offset bracket, flat joining plate, saddle and
half-saddle generator.
Serve the repository over HTTP.
Uses the existing Three.js and shared STL/3MF and mvpack exporters; no new dependency.
Legs, width, thickness, hole diameter, hole count and hole end distance are editable.
A single closed boundary mesh joins both legs without overlapping solids. Export
coordinates lay the profile side on Z=0; inspect the hole bridges in your slicer.
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
With the local site running at port 4173, also run `node meshvault/generators/brackets/shapes.test.cjs`
to check the new profiles, chamfers, clearances and actual exports.
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

Choose the bracket shape before setting dimensions. U brackets use the outside
base span and upright height, with holes in the base and both uprights. Z brackets
use flange reach and outside offset height, with holes in both horizontal flanges.
Flat plates use length and width; the height control is hidden. Hole count applies
per mounting face. Dimensions include material thickness; unusable combinations
fail visibly. The shape type travels in the attached settings and HTML description.

Select a mounting face by clicking it in the viewport or using its face button.
An outline marks both sides of the selected flange. Each face can override hole
count (including none), bore diameter, end distance, along-face offset and sideways
centreline offset.
Unmodified faces follow the shared hole settings. Reset restores those shared
settings for the selected face; changing shape clears face overrides. Hole clearance
and chamfers are validated per face. Overrides are exported in `faceHoles` settings
and described per face in the package HTML. Preview outlines are not exported.
Run `node meshvault/generators/brackets/faces.test.cjs` against port 4173 for mesh,
click selection, independent controls, package and invalid-clearance checks.

Saddles have a semicircular pipe/cable seat with two mounting feet; half saddles
have the same curved seat with one mounting foot and a free end. Inside diameter
(6–120 mm) and mounting-foot length (12–60 mm) replace leg length and height.
Width and material thickness remain editable. Each foot has independent hole
settings. The outer chamfer bevels the profile end faces, retaining the circular
seat; hole-opening chamfers remain available. Diameter is nominal: choose clearance
for your pipe and printer, and test fit. These are not rated structural clamps.
Both saddle dimensions travel in STL/3MF package settings and the HTML description.
