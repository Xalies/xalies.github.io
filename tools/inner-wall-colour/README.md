# Inner-wall colour post-processor (experimental)

Keep a selectable number of outer wall loops in the surface colour; assign the
remaining buried walls to another tool. Python 3.10+ and its standard library
are sufficient. Nothing is installed on the printer.

For four nested wall loops:

| `--colour-walls` | Surface colour | Inner colour |
| --- | --- | --- |
| 1 | Outermost loop | Three buried loops |
| 2 | Outermost two loops | Two buried loops |
| 3 | Outermost three loops | Innermost loop |
| 4 | All four loops | None |

The number is measured inward from **every exposed surface**, including holes
and hollow interiors. Sections with fewer walls retain their available surface
walls. Infill, top/bottom surfaces, supports and other non-wall features keep the
original tool.

## Preview first

Export a **single-tool, plain-text G-code** file with feature comments enabled.
Use Classic walls, complete closed loops, zero seam gap, no scarf seams, no vase
mode, and no arc fitting. Use the same nozzle diameter, compatible filament,
flow and extrusion settings on both tools: this script preserves the original
extrusion amounts, widths, speeds and other filament settings.

```powershell
python "inner_wall_colour.py" "model.gcode" --colour-walls 2 --colour-tool 0 --inner-tool 1 --report "plan.json"
```

Without `--output` or `--in-place`, the script only reports planned assignments.
`plan.json` lists each wall's original line number, layer index, inward rank and
assigned tool, plus tool-change locations. Tools are **zero-based G-code IDs**:
T0 and T1, not necessarily the numbered filament slots shown in a slicer.

The parser accepts Orca/Snapmaker Orca `; FEATURE: Outer wall` / `Inner wall`
and PrusaSlicer `;TYPE:External perimeter` / `Perimeter` comments. Both relative
and absolute E extrusion are supported; print-body XYZ must be absolute.

Wall ranks come from nested closed contours, not their print order. This handles
inner-first, outer-first, holes, and multiple disjoint objects. Adjacency is
checked against width comments so contours across an infill gap are not counted
as successive walls. If width comments are absent, provide `--wall-spacing`
with the actual wall pitch in mm (for example `--wall-spacing 0.42`). Open paths, arc
extrusion, non-planar walls, missing outer-wall groups and detected overlapping
contours cause an error instead of silently guessing. This is a prototype for
regular nested walls, not a general geometry engine: pathological intersecting
contours and Arachne's open/merged paths are outside its validated scope.

## Printer-specific tool changes

The wall planner is shared by the **Snapmaker U1**, **Prusa XL**, **Prusa CORE One
with INDX**, and **Klipper toolchangers**. Their tool-change commands are not
interchangeable. No print-ready adapter for these machines is included yet;
an exported G-code sample from each intended printer/profile is needed to
prepare and validate its template. Synthetic tests do not validate firmware.

Supply `--toolchange-template "change-tool.gcode"` to write output. This is a
plain, already-expanded G-code snippet, not the slicer's conditional/macro
source. It is inserted immediately before extrusion when the selected tool
changes, and restores the source tool before the ending sequence if necessary.

Supported Python-format placeholders:

| Placeholder | Meaning |
| --- | --- |
| `{from_tool}`, `{to_tool}` | Previous and next zero-based tool IDs |
| `{x}`, `{y}`, `{z}` | Original position at the insertion point |
| `{e}` | Original E coordinate |
| `{e_mode}` | Original extrusion mode, `M82` or `M83` |
| `{feedrate}` | Original feedrate in mm/min |

The template must select `{to_tool}`, handle heating/standby, parking,
priming/retractions and cooling for that printer, and return to the original
XYZ position, E coordinate, E mode, absolute XYZ mode and feedrate. It must leave
the new nozzle ready to extrude. It must also restore any acceleration, flow or
other modal setting it changes. Each direction must work, including the final
return to the surface tool. Do not use a bare `T{to_tool}` as a printing template.

There are no temperature defaults or assumed priming amounts: they belong to
the printer/material template. An INDX system's initialization and an XL's or
U1's initialization must already include both tools. The template must work even
when the slicer did not plan a prime-tower visit. Time estimates, thumbnails and
filament-use metadata remain those of the original export and are not updated;
do not rely on them for tool assignment or consumption after processing. Printer
interfaces that use tool metadata rather than actual commands need an adapter
that updates that metadata before this can be considered print-ready.

```powershell
python "inner_wall_colour.py" "model.gcode" --colour-walls 2 --colour-tool 0 --inner-tool 1 --toolchange-template "change-tool.gcode" --output "model-coloured.gcode"
```

For automatic processing, add a command like this to your slicer's
post-processing script setting (the slicer appends its temporary G-code path):

```text
"C:\Path\To\python.exe" "C:\Path\To\inner_wall_colour.py" --colour-walls 2 --colour-tool 0 --inner-tool 1 --toolchange-template "C:\Path\To\change-tool.gcode" --in-place
```

`--in-place` keeps an exclusive `.wall-colour.bak` backup and replaces the input
only after successful processing. Existing output/report/backup files are not
overwritten. Reprocessing a stamped file is refused. Use `--output` while
developing a printer template, reopen the result in a G-code viewer, and inspect
the assignments and tool-change movements before a small test print.

## Existing Orca alternative

OrcaSlicer 2.4's native [Filament for Features](https://github.com/OrcaSlicer/OrcaSlicer/wiki/multimaterial_settings_filament_for_features)
can separately assign outer walls and all inner walls. That covers a single
surface-colour loop with slicer-managed tool changes. This prototype addresses
the selectable number of retained surface loops across supported G-code exports.

## Check

```powershell
python -m unittest discover -s tools/inner-wall-colour -v
```

Run from the repository root. The checks use synthetic G-code for wall counts,
print order, holes, multiple objects/layers, absolute E, source-motion
preservation, restoration for infill/end, and rejection of unsupported input.
