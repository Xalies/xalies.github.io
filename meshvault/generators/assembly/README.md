# Modular Storage Designer

A browser-only MeshVault creator tool. The existing `/generators/assembly/`
address is retained so links keep working. In this repository it is served at
`/meshvault/generators/assembly/`. No backend, account or remote modelling
service is required.

## Modular workstation — first stage

The default planner now combines independently sized modules instead of imposing
one uniform cabinet. Start with two stacked drawers beside a sloped maker station.
Add up to twelve modules, select one in the front elevation and set its type,
footprint, height and horizontal position. Each module uses a whole 42 mm footprint
(2–5 units wide/deep, minus 0.5 mm overall) and 7 mm body-height units (6–18).

Implemented module types:

- **Drawer housing + drawer:** rounded outer edges, integral side guides, closed
  rear stop, an overlapping front with a rounded finger pull, 1–4 compartments
  across/deep, and optional shallow hex recesses backed by a solid wall.
- **Open bin:** rounded walls, closed floor and optional solid-backed front recesses.
- **Sloped maker station:** a rounded sloped carrier with two removable half-width
  inserts. Choose tool holes (6–25 mm diameter), open trays or blank sloped faces.
  Choose the left/right type and hole diameter independently. The tool-hole inserts are hollow below their sloped face.

Housings and bins have optional Gridfinity feet. Drawer housings can have an
integrated Gridfinity socket top. Place a module on the desk or stack it on a
specified drawer housing. Stacking requires the upper module's feet and the lower
module's socket top, and the upper footprint must fit entirely on its support.
Cycles, overlapping bodies and invalid dimensions block generation. Stacks have
alignment sockets, no positive lock or tested load rating.

Housing walls are 4 mm. Fit clearance is adjustable from 0.2–1.2 mm: total
drawer clearance, and the side/centre gaps around the two maker-station inserts.
Drawer housings print rear-down, opening upward. Sloped inserts print face-down
with their open undersides up, avoiding a bridge across the full top face. Other
parts print upright. Check
printer Z clearance separately: a rear-down housing is as tall as its depth.
Inspect overhangs and pulls in the slicer and add local supports where needed.
Physical fit, tool retention and strength remain untested; print one module first.

The print planner packs all parts across the selected bed size. STL, 3MF and one
`.mvpack` project include either arranged plates or individual named parts, plus
saved settings (`moduleInterface: "workstation-v1"`), an illustrated offline guide,
part inventory and plate placements. Settings are reference data, not an importer.
No magnets are included. Drawer side panels use the separately purchased M3 hardware below.

## Replaceable HSW side panels — experimental fit

Drawer modules offer left, right or both side panels. The panels use complete
Honeycomb Storage Wall sockets, rather than decorative hex holes. Each panel is
8 mm thick with an 8 mm stand-off from the housing. Four integral external bosses
carry the panel. M3 nut recesses sit flush inside the 4 mm housing wall so they do
not occupy the drawer space. Each panel needs four **M3 × 20 mm countersunk screws
and four M3 hex nuts**. Seat nuts before inserting the drawer; tighten gently.
These fixings join a panel to the housing, not the workstation to a wall. Each
panel centres its own socket field: multi-socket accessories must stay within one
panel, because rows are not aligned across module seams.

Only complete sockets are generated, with room around the reinforced mounting
areas. The lattice uses a 23.6 mm pitch, 20 mm throat across flats, 22 mm rear
relief, a 21 mm entry chamfer and 8 mm depth. The rear relief extends 2 mm, tapers
to the throat over 0.9 mm and the entry chamfer occupies the final 0.5 mm. These
dimensions were checked against [the published HSW reference geometry](https://github.com/gbrunow/hsw/blob/main/src/base-plate.scad), based on
[RostaP's Honeycomb Storage Wall](https://www.printables.com/model/152592-honeycomb-storage-wall).
The socket/plate construction here is independently written; no model was copied.

The planner blocks panels that collide with neighbouring modules; leave at least
16 mm beside each housing. A small **HSW socket fit coupon** is included once in
builds with panels. It appears in print plates and exports, not the assembled
preview or overall assembled dimensions. Print it and check an existing HSW
insert before committing to a full panel. Panels/coupon print rear face down. Add supports under the exterior mounting
stand-offs when printing housings rear-down.
Physical insert retention, fastener fit and load capacity remain untested. This
is an experimental interface for lightweight accessories, not a wall mount.

The guide, BOM, dimensions, saved settings and printer plates follow the selected
panel sides. Disabling panels removes their bosses, fixings and the coupon.

## Drawer labels and side accessories

Drawer modules have optional open-front rails for a **36 × 9 mm paper label**.
The rails retain the label edges and leave a visible central window, with an open
top for insertion/removal. Label holders add 2 mm in front of the fascia. The same
open-front construction is used in the legacy cabinet; its old solid front cover
has been removed. Use the module name for the label text. **Label sheet** downloads
an offline HTML sheet; print at 100% / actual size and cut along the borders. It is
also included as `labels.html` in a `.mvpack`, with paper quantities in the BOM.
Label names are escaped; no text is embossed into the model.

Each exposed HSW panel can independently carry a **utility hook** or a **universal
mounting plate**. One accessory is centred on a complete socket with room for its
26 × 44 mm backing. At least 8 height units and a suitable socket are required;
layouts without enough room are rejected. The mounting plate has two 4.5 mm holes
32 mm apart for a user's own attachment. The hook has a rounded 26 mm-wide body,
20 mm opening and raised retaining lip, suitable for trying lightweight cables.
No load capacity has been established.

These accessories use an independently designed **bolt-through socket clamp**.
The 19.6 mm across-flats locating neck fits through the panel's 20 mm throat. A
separate 21.6 mm across-flats, 4 mm-thick rear clamp captures an M3 nut behind the
socket. Each accessory needs **one M3 × 16 mm countersunk screw and one M3 nut**,
in addition to panel hardware. No standard HSW insert is needed for these two
accessories. Test the complete clamp/neck combination in the socket coupon first.
Attach accessories before fixing the panel to the housing, while its rear is
accessible. Do not overtighten the plastic clamp. Hardware for the user's own
attachment to a universal plate is not specified or included.

Mounting plates print front-face down, neck up. Hooks print on their side and need
local supports under the hex neck. Rear clamps print flat-face down, nut recess
up. Files are already oriented accordingly. The assembled/exploded preview,
illustrated guide, hardware list and print plates include the selected accessories.
Their clearance is checked against neighbours: bare panels extend 16 mm outside
the housing, mounting plates 20 mm and hooks 46 mm. Disabling a panel removes its
accessory and hardware while retaining the selection for later use.

Physical clamp retention, sliding labels, screw fit and hook strength remain
untested. Inspect the slice and test the coupon/one accessory before a full set.

## Remaining system work

Next stages are shelves, racks, connectors and more
specialised workstation modules using the shared housing interfaces. Print-fit
calibration remains necessary before describing an interface as physically proven.

The previous cabinet planner and drawer/organiser generators remain available
from the assembly selector while the workstation system develops.

## Visual cabinet planner

The legacy two-column parts cabinet has two rows (65 and 80 mm). Presets also
include a compact one-column stacked drawer unit, a one-row desk station and a two-row tool cabinet. Use the front elevation
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
`cabinet.js` and `system.js` reuse the GPL-2.0 Gridfinity baseplate source and is marked GPL-2.0-only. Three.js and
OrbitControls use the existing local MIT assets in `../gridfinity/vendor/`.
The local OpenSCAD runtime and shared worker/export helpers come from the
Gridfinity generator, GPL-2.0; see its README and `vendor/LICENSE`. The organiser's
pad geometry is from vector76/gridfinity_openscad, MIT (Jamie, 2022), in the
existing `gridfinity_bins.zip` with `gridfinity-MIT.txt`. No new dependency is
needed. New drawer geometry is defined here and generated by the same worker.

Run `node meshvault/generators/assembly/system.test.cjs`,
`node meshvault/generators/assembly/test.cjs` and
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

## Cabinet and standalone output

Choose a complete cabinet or export just the selected drawer/tray as a replacement
insert. An open shelf has no insert and blocks standalone export. Print packing,
STL/3MF, project settings and the guide follow the selected output; standalone
exports have no frame fasteners in their parts list.

Complete cabinets can include a separate lift-off Gridfinity socket top for each
column. These flat-bottomed tops rest on the cabinet without a locking feature;
print upright and use removable tape if needed. They add wall thickness + 4.9 mm
to the build height.

Standalone drawers can instead have a 5 mm Gridfinity underside. Their body
footprint rounds down to whole 42 mm cells minus 0.5 mm overall clearance. This
version changes the drawer dimensions and is not a replacement cabinet insert.
The top and underside options are independent and retained when switching output.
No magnets or screws are added to either Gridfinity interface. Physical fit is
untested. Previews use charcoal frames, warm grey inserts and neutral print plates;
these display colours do not specify filament colours in STL/3MF.

Workstation checks cover actual generated default, bin and all three maker-insert
meshes, closed edges, outward winding, connected components, plate bounds and
inventory, stack cycles/support/overlap validation, independently sized modules,
STL/3MF/project exports, escaped names, invalid bed recovery, responsive layout and
absence of external network requests during the tested flow.

HSW checks additionally cover independent left/right insert choices and hole sizes,
actual coupon socket dimensions at each profile depth, closed connected panel and
reinforced housing meshes, both panel sides, nut/bolt axes, hardware quantities,
plate inventory, and collision blocking/recovery next to neighbouring modules.

Label/accessory checks cover actual open label windows by ray intersection,
actual-size and escaped label-sheet HTML, accessory/clamp axes, complete connected
meshes, neighbour clearance, both screw lengths and nut quantities, packed plate
bounds/inventory, and STL/3MF/project exports.

Planner checks also cover selecting another module immediately after numeric/text
edits and keyboard selection, so field-blur redraws cannot redirect the next edit.


### Design and print workflow

Start in **Design your assembly** to configure modules and inspect the live assembled or exploded preview. Choose **Generate print plates** to open **Print & export**, with generation progress, printer-bed dimensions, arranged plate previews, optional author and support links, STL/3MF downloads and the single-project MeshVault export. **Back to design** keeps the assembly and printer settings. The illustrated guide and package inventory appear in the print step. Bed-fit and author-link errors block export without preventing further design edits.


The modular workstation uses a full-size front-layout viewport with Move / select, Select only and a 3D preview toggle. Drag modules or use Left/Right arrows to move one 42 mm cell. Moving a supporting housing also moves its descendants. Invalid moves (overlaps, side-panel clearance, desk bounds or a stacked module leaving its support) leave the design unchanged. Drag upwards onto a housing to stack (the target is highlighted), or down to place the module on the desk. The Place module field also controls stacking. Descendants follow the dragged module and all placements use the same fit validation.

Build notes appear only in Print & export. Its animated printer-head indicator follows generation progress and switches to ready or error, respecting reduced-motion preferences.

The Design step uses lightweight box primitives for its approximate 3D preview. It does not launch OpenSCAD workers, build printable parts, arrange plates or produce guide pictures. Detailed geometry, plate packing and export documents are prepared only after Generate print plates. Returning to Design cancels an active build; exports remain disabled until a new generation completes.


## Optional drawer latch

Each drawer module can have a rotating turn-button latch. The housing gains a
pivot boss with a captive M3 nut recess, and the drawer gains a clearance notch.
A separate printed turn button and 1 mm spacer washer sit beside the pull.
Fit one M3 x 14 mm pan-head screw and M3 hex nut per latch; tighten just enough
for friction while allowing rotation. Turn the button down to retain the drawer,
then sideways before opening. Recheck friction and screw tightness after use.
The latch is independent of the Gridfinity stacking connection and is not a
transport or safety lock. Fit, wear and strength require physical print testing.

Design uses the existing lightweight preview; printable latch geometry is built
only on Print & export. Both printed parts, hardware quantities, settings and
assembly instructions travel in STL/3MF project exports. Old layouts without a
`drawerLatch` field keep their original geometry. Run `node
meshvault/generators/assembly/latch.test.cjs` with Playwright on NODE_PATH and
the site served on port 4173 for a real geometry and package check.
