#!/usr/bin/env python3
"""Plan selectable outer-wall colours; rewrite using a printer's tool-change template."""
import argparse
from collections import deque
from dataclasses import dataclass
from functools import cached_property
import json
import math
from pathlib import Path
import re
import string
import sys


ROLES = {"Outer wall": "outer", "External perimeter": "outer",
         "Inner wall": "inner", "Perimeter": "inner"}
FEATURE = re.compile(r"^;\s*(?:FEATURE|TYPE)\s*:\s*(.*?)\s*$")
WIDTH = re.compile(r"^;\s*(?:LINE_WIDTH|WIDTH)\s*:\s*([\d.]+)\s*$")
LAYER = re.compile(r"^;\s*(?:LAYER_CHANGE|CHANGE_LAYER|LAYER\s*:\s*-?\d+)\s*$")
WORD = re.compile(r"([XYZEF])\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+))", re.I)
STAMP = "; inner-wall-colour: processed"


@dataclass
class Wall:
    layer: int
    role: str
    start: int
    end: int
    points: list
    extrusion: float
    state: dict
    end_state: dict
    spacing: float
    rank: int = 0

    @cached_property
    def area(self):
        return abs(sum(a[0] * b[1] - b[0] * a[1]
                       for a, b in zip(self.points, self.points[1:]))) / 2


def inside(point, polygon):
    x, y = point
    result = False
    for (ax, ay), (bx, by) in zip(polygon, polygon[1:]):
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            result = not result
    return result


def distance_to_path(point, polygon):
    result = math.inf
    for a, b in zip(polygon, polygon[1:]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        length2 = dx * dx + dy * dy
        t = max(0, min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length2)) if length2 else 0
        result = min(result, math.dist(point, (a[0] + t * dx, a[1] + t * dy)))
    return result


def samples(wall):
    return wall.points[:-1] + [((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
                               for a, b in zip(wall.points, wall.points[1:])]


def parse(lines, closure=0.05, spacing=None):
    if any(STAMP in line for line in lines):
        raise ValueError("This file has already been processed; use the original export.")
    walls, moves, active = [], [], None
    layer, role, body = -1, "", False
    width = spacing
    state = dict(x=None, y=None, z=None, e=0.0, feedrate=None,
                 relative_e=False, absolute_xyz=True, tool=None)

    def finish():
        nonlocal active
        if active is None:
            return
        if len(active.points) < 4 or math.dist(active.points[0], active.points[-1]) > closure:
            raise ValueError(f"Open wall at line {active.start + 1}. Use Classic walls, "
                             "disable scarf seams/seam gaps, and export complete loops.")
        active.points[-1] = active.points[0]
        if active.area < 1e-6:
            raise ValueError(f"Degenerate wall at line {active.start + 1}.")
        walls.append(active)
        active = None

    for i, raw in enumerate(lines):
        line = raw.strip()
        if LAYER.match(line):
            finish()
            layer += 1
            body, role = True, ""
        match = FEATURE.match(line)
        if match:
            finish()
            role = ROLES.get(match[1], "")
        match = WIDTH.match(line)
        if match and spacing is None:
            width = float(match[1])
        code = line.split(";", 1)[0].strip()
        if not code:
            continue
        command = code.split()[0].upper()
        if command in ("PRINT_END", "END_PRINT", "M2", "M30"):
            finish()
            body, role = False, ""
        if re.fullmatch(r"T\d+", command):
            finish()
            if body:
                raise ValueError(f"Existing tool change at line {i + 1}. Start with a single-tool model.")
            state["tool"] = int(command[1:])
        elif command == "G90":
            state["absolute_xyz"] = True
        elif command == "G91":
            if body:
                raise ValueError("Relative XYZ in the print body is unsupported.")
            state["absolute_xyz"] = False
        elif command in ("M82", "M83"):
            state["relative_e"] = command == "M83"
        elif command == "G92":
            values = dict((k.lower(), float(v)) for k, v in WORD.findall(code))
            if body and any(k in values for k in ("x", "y", "z")):
                raise ValueError("XYZ coordinate resets in the print body are unsupported.")
            state.update(values)
        elif command in ("G0", "G1", "G2", "G3"):
            values = dict((k.lower(), float(v)) for k, v in WORD.findall(code))
            old = state.copy()
            extrusion = values.get("e", 0) if state["relative_e"] else values.get("e", state["e"]) - state["e"]
            for axis in ("x", "y", "z"):
                if axis in values:
                    state[axis] = values[axis] if state["absolute_xyz"] else (state[axis] or 0) + values[axis]
            if "e" in values:
                state["e"] = state["e"] + values["e"] if state["relative_e"] else values["e"]
            if "f" in values:
                state["feedrate"] = values["f"]
            printing = body and extrusion > 0 and ("x" in values or "y" in values)
            if printing:
                if command in ("G2", "G3"):
                    raise ValueError("Arc extrusion is unsupported; disable arc fitting before export.")
                if any(old[k] is None for k in ("x", "y", "z", "feedrate", "tool")):
                    raise ValueError(f"Unknown position/feed/tool at line {i + 1}.")
                moves.append((i, old))
            if printing and role:
                if abs(state["z"] - old["z"]) > 1e-6:
                    raise ValueError("Non-planar walls/scarf seams are unsupported.")
                if active is None:
                    if width is None or width <= 0:
                        raise ValueError("Wall widths are missing; enable width comments or supply --wall-spacing in mm.")
                    active = Wall(layer, role, i, i, [(old["x"], old["y"])], 0.0, old, state.copy(), width)
                elif abs(active.state["z"] - old["z"]) > 1e-6:
                    raise ValueError("A wall changes height; disable scarf seams/vase mode.")
                active.points.append((state["x"], state["y"]))
                active.end = i
                active.extrusion += extrusion
                active.end_state = state.copy()
            else:
                finish()
    finish()
    if not walls or not any(w.role == "inner" for w in walls):
        raise ValueError("No complete inner walls found. Enable feature comments and layer markers.")
    return walls, moves


def rank_walls(walls):
    layers = {}
    for wall in walls:
        wall.rank = 0
        layers.setdefault(wall.layer, []).append(wall)
    for group in layers.values():
        # ponytail: quadratic contour comparisons per layer; use a spatial index for dense plates.
        parents = {}
        for i, wall in enumerate(group):
            containers = []
            for j, other in enumerate(group):
                if i == j or other.area <= wall.area:
                    continue
                contained = [inside(p, other.points) for p in samples(wall)]
                if any(contained) and not all(contained):
                    raise ValueError(f"Overlapping/ambiguous wall contours near line {wall.start + 1}.")
                if all(contained):
                    containers.append(j)
            if containers:
                parents[i] = min(containers, key=lambda j: group[j].area)
        graph = [[] for _ in group]
        for child, parent in parents.items():
            a, b = group[child], group[parent]
            # Don't count contours across an infill region as adjacent walls.
            # The allowance includes diagonal distances at square corners.
            limit = 1.5 * max(a.spacing, b.spacing)
            if (all(distance_to_path(p, b.points) <= limit for p in samples(a))
                    and all(distance_to_path(p, a.points) <= limit for p in samples(b))):
                graph[child].append(parent)
                graph[parent].append(child)
        queue = deque()
        for i, wall in enumerate(group):
            if wall.role == "outer":
                wall.rank = 1
                queue.append(i)
        while queue:
            i = queue.popleft()
            for j in graph[i]:
                if group[j].rank == 0:
                    group[j].rank = group[i].rank + 1
                    queue.append(j)
        if any(w.rank == 0 for w in group):
            raise ValueError("An inner-wall group has no adjacent outer-wall chain. Check wall spacing and contour geometry.")


def plan(walls, moves, colour_walls, colour_tool, inner_tool):
    rank_walls(walls)
    spans = iter(walls)
    wall = next(spans, None)
    current, changes = colour_tool, []
    for line, state in moves:
        if state["tool"] != colour_tool:
            raise ValueError("The original model must use only the selected surface-colour tool.")
        while wall is not None and wall.end < line:
            wall = next(spans, None)
        desired = inner_tool if wall is not None and wall.start <= line <= wall.end and wall.rank > colour_walls else colour_tool
        if desired != current:
            changes.append(dict(line=line, from_tool=current, to_tool=desired, **state))
            current = desired
    # Restore the original tool before retractions, layer/end macros, or shutdown after the last wall.
    if current != colour_tool:
        last = walls[-1]
        changes.append(dict(line=last.end + 1, from_tool=current, to_tool=colour_tool,
                            **last.end_state))
    return changes


def render(lines, changes, template):
    allowed = {"from_tool", "to_tool", "x", "y", "z", "e", "feedrate", "e_mode"}
    fields = {name for _, name, _, _ in string.Formatter().parse(template) if name is not None}
    if fields - allowed or "to_tool" not in fields:
        raise ValueError("Template must contain {to_tool}; supported fields: " + ", ".join(sorted(allowed)))
    if not template.strip():
        raise ValueError("The tool-change template is empty.")
    events = {change["line"]: change for change in changes}
    newline = "\r\n" if any(line.endswith("\r\n") for line in lines) else "\n"
    output = [STAMP + newline]
    for i in range(len(lines) + 1):
        if i in events:
            if output and not output[-1].endswith(("\n", "\r")):
                output.append(newline)
            change = events[i]
            params = {k: change[k] for k in allowed - {"e_mode"}}
            params["e_mode"] = "M83" if change["relative_e"] else "M82"
            snippet = template.format(**params).replace("\r\n", "\n").rstrip("\n")
            output.append(f"; wall colour: T{change['from_tool']} -> T{change['to_tool']}" + newline)
            output.append(snippet.replace("\n", newline) + newline)
        if i < len(lines):
            output.append(lines[i])
    return "".join(output)


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("gcode", type=Path)
    cli.add_argument("--colour-walls", type=int, default=1, help="Outer wall count to retain in surface colour (default 1)")
    cli.add_argument("--colour-tool", type=int, default=0, help="Zero-based source/surface tool (default T0)")
    cli.add_argument("--inner-tool", type=int, default=1, help="Zero-based buried-wall tool (default T1)")
    cli.add_argument("--wall-spacing", type=float, help="Wall pitch in mm if width comments are absent (overrides comments)")
    cli.add_argument("--report", type=Path, help="Save the dry-run plan as JSON")
    cli.add_argument("--output", type=Path, help="Write a new G-code file using the supplied template")
    cli.add_argument("--in-place", action="store_true", help="For slicer post-processing: replace input and keep .wall-colour.bak")
    cli.add_argument("--toolchange-template", type=Path, help="Printer-specific, state-preserving G-code template")
    args = cli.parse_args()
    try:
        if args.colour_walls < 1 or min(args.colour_tool, args.inner_tool) < 0 or args.colour_tool == args.inner_tool:
            raise ValueError("Choose at least one coloured outer wall and two distinct non-negative tool IDs.")
        if args.wall_spacing is not None and (not math.isfinite(args.wall_spacing) or args.wall_spacing <= 0):
            raise ValueError("Wall spacing must be a positive finite number in mm.")
        if args.output and args.in_place:
            raise ValueError("Choose --output or --in-place, not both.")
        raw = args.gcode.read_bytes()
        if b"\0" in raw or raw.startswith(b"GCDE"):
            raise ValueError("Use plain-text .gcode; binary G-code and packaged 3MF are unsupported.")
        lines = raw.decode("utf-8-sig").splitlines(keepends=True)
        walls, moves = parse(lines, spacing=args.wall_spacing)
        changes = plan(walls, moves, args.colour_walls, args.colour_tool, args.inner_tool)
        report = dict(colour_walls=args.colour_walls, colour_tool=args.colour_tool,
                      inner_tool=args.inner_tool, wall_loops=len(walls), tool_changes=len(changes),
                      walls=[dict(layer=w.layer, line=w.start + 1, rank=w.rank,
                                  tool=args.inner_tool if w.rank > args.colour_walls else args.colour_tool,
                                  extrusion_mm=round(w.extrusion, 5)) for w in walls],
                      changes=[dict(line=c["line"] + 1, from_tool=c["from_tool"], to_tool=c["to_tool"]) for c in changes])
        target = args.gcode if args.in_place else args.output
        if args.report and (args.report.exists() or args.report.resolve() == args.gcode.resolve()
                            or (target and args.report.resolve() == target.resolve())):
            raise ValueError("Choose a new report path, separate from the input and output.")
        if target:
            if not args.toolchange_template:
                raise ValueError("Output needs --toolchange-template from your printer profile; dry runs need no template.")
            if not args.in_place and target.resolve() == args.gcode.resolve():
                raise ValueError("Use --in-place to replace the input with a backup.")
            result = render(lines, changes, args.toolchange_template.read_text(encoding="utf-8"))
            if args.in_place:
                backup = args.gcode.with_name(args.gcode.name + ".wall-colour.bak")
                with backup.open("xb") as f:
                    f.write(raw)
                temporary = args.gcode.with_name(args.gcode.name + ".wall-colour.tmp")
                with temporary.open("xb") as f:
                    f.write(result.encode("utf-8"))
                temporary.replace(args.gcode)
            else:
                with target.open("xb") as f:
                    f.write(result.encode("utf-8"))
        if args.report:
            with args.report.open("x", encoding="utf-8") as f:
                json.dump(report, f, indent=2)
                f.write("\n")
        print(f"{len(walls)} wall loops; {sum(w.rank > args.colour_walls for w in walls)} assigned to T{args.inner_tool}; "
              f"{len(changes)} tool changes. " + (f"Written: {target}" if target else "Dry run; input unchanged."))
    except (OSError, UnicodeError, ValueError, KeyError) as error:
        cli.exit(2, f"Error: {error}\n")


if __name__ == "__main__":
    main()
