"""Synthetic geometry and G-code checks; these do not certify printer profiles."""
import unittest
import json
from pathlib import Path
import subprocess
import sys
import tempfile

from inner_wall_colour import parse, plan, render


def rectangle(left, bottom, right, top):
    return [(left, bottom), (right, bottom), (right, top), (left, top), (left, bottom)]


def export(loops, prusa=False, absolute_e=False):
    lines = ["T0\n", "G90\n", "M82\n" if absolute_e else "M83\n", "G1 X0 Y0 Z0.2 F1200\n",
             ";LAYER_CHANGE\n", ";WIDTH:1.0\n"]
    e = 0
    for role, points in loops:
        label = ({"outer": "External perimeter", "inner": "Perimeter"} if prusa
                 else {"outer": "Outer wall", "inner": "Inner wall"})[role]
        lines.append((";TYPE:" if prusa else "; FEATURE: ") + label + "\n")
        lines.append(f"G1 X{points[0][0]} Y{points[0][1]} F9000\n")
        for x, y in points[1:]:
            e += 1
            lines.append(f"G1 X{x} Y{y} E{e if absolute_e else 1} F1200\n")
    return lines


class WallColourCheck(unittest.TestCase):
    def test_wall_count_independent_of_print_order_and_slicer(self):
        loops = [("outer" if n == 0 else "inner", rectangle(n, n, 20 - n, 20 - n)) for n in range(4)]
        for prusa in (False, True):
            for order in (loops, loops[::-1], [loops[2], loops[0], loops[3], loops[1]]):
                lines = export(order, prusa)
                for count in (1, 2, 3, 4, 8):
                    walls, moves = parse(lines)
                    changes = plan(walls, moves, count, 0, 1)
                    self.assertEqual([w.rank for w in walls], [loops.index(item) + 1 for item in order])
                    self.assertEqual(sum(w.rank > count for w in walls), max(0, 4 - count))
                    if changes:
                        self.assertEqual(changes[-1]["to_tool"], 0)

    def test_hole_walls_grow_outward(self):
        loops = [("outer", rectangle(0, 0, 40, 40))]
        loops += [("outer" if n == 0 else "inner", rectangle(15 - n, 15 - n, 25 + n, 25 + n)) for n in range(4)]
        walls, moves = parse(export(loops))
        plan(walls, moves, 2, 0, 1)
        self.assertEqual([w.rank for w in walls], [1, 1, 2, 3, 4])

    def test_separate_objects_and_layers(self):
        loops = [(role, rectangle(x + n, n, x + 20 - n, 20 - n))
                 for x in (0, 50) for n, role in enumerate(("outer", "inner", "inner"))]
        first = export(loops)
        lines = first + ["; CHANGE_LAYER\n", "G1 Z0.4\n"] + export(loops)[6:]
        walls, moves = parse(lines)
        plan(walls, moves, 2, 0, 1)
        self.assertEqual([w.rank for w in walls], [1, 2, 3] * 4)

    def test_absolute_e_tail_restore_and_original_moves(self):
        lines = export([("outer", rectangle(0, 0, 20, 20)),
                        ("inner", rectangle(1, 1, 19, 19))], absolute_e=True)
        walls, moves = parse(lines)
        changes = plan(walls, moves, 1, 0, 1)
        self.assertEqual(changes[-1]["e"], 8)
        self.assertEqual(changes[-1]["feedrate"], 1200)
        # A fake template for testing only, not a printer tool-change recipe.
        output = render(lines, changes, "T{to_tool}\nG92 E{e}\n{e_mode}\nG1 F{feedrate}")
        self.assertIn("G92 E8.0\nM82", output)
        self.assertTrue(all(line in output for line in lines))
        with self.assertRaisesRegex(ValueError, "already been processed"):
            parse(output.splitlines(keepends=True))

    def test_nonwall_extrusion_restores_colour(self):
        lines = export([("outer", rectangle(0, 0, 20, 20)), ("inner", rectangle(1, 1, 19, 19))])
        lines += ["; FEATURE: Sparse infill\n", "G1 X5 Y5 E1\n", "PRINT_END\n"]
        walls, moves = parse(lines)
        changes = plan(walls, moves, 1, 0, 1)
        self.assertEqual(changes[-1]["line"], len(lines) - 2)
        self.assertEqual(changes[-1]["to_tool"], 0)

    def test_refuses_ambiguous_and_unsupported_input(self):
        base = [("outer", rectangle(0, 0, 20, 20)), ("inner", rectangle(1, 1, 19, 19))]
        open_loop = export(base)
        open_loop.pop()
        with self.assertRaisesRegex(ValueError, "Open wall"):
            parse(open_loop)
        for code, message in (("G2 X1 Y1 E1 I1 J0\n", "Arc extrusion"),
                              ("T1\n", "Existing tool change"), ("G91\n", "Relative XYZ")):
            with self.assertRaisesRegex(ValueError, message):
                parse(export(base) + [code])
        walls, moves = parse(export([( "outer", rectangle(0, 0, 20, 20)),
                                    ("inner", rectangle(18, 18, 25, 25))]))
        with self.assertRaisesRegex(ValueError, "Overlapping"):
            plan(walls, moves, 1, 0, 1)
        with self.assertRaisesRegex(ValueError, "Template"):
            render(export(base), [], "T{unknown}")

    def test_cli_dry_run_output_guard_and_backup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, report, target, template = (root / name for name in
                                                 ("model.gcode", "plan.json", "coloured.gcode", "change.gcode"))
            data = "".join(export([("outer" if n == 0 else "inner", rectangle(n, n, 20 - n, 20 - n))
                                   for n in range(4)])).replace("\n", "\r\n").encode()
            source.write_bytes(data)
            command = [sys.executable, "-B", str(Path(__file__).with_name("inner_wall_colour.py")),
                       str(source), "--colour-walls", "2"]
            result = subprocess.run(command + ["--report", str(report)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual([w["tool"] for w in json.loads(report.read_text())["walls"]], [0, 0, 1, 1])
            self.assertEqual(source.read_bytes(), data)
            result = subprocess.run(command + ["--output", str(target)], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(target.exists())
            # Synthetic template only; no thermal/park/prime behavior is tested.
            template.write_text("T{to_tool}\nG92 E{e}\n{e_mode}\nG1 F{feedrate}\n")
            result = subprocess.run(command + ["--in-place", "--toolchange-template", str(template)],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(Path(str(source) + ".wall-colour.bak").read_bytes(), data)
            output = source.read_bytes()
            self.assertIn(b"T1\r\n", output)
            self.assertNotIn(b"\n", output.replace(b"\r\n", b""))
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(source.read_bytes(), output)


if __name__ == "__main__":
    unittest.main()
