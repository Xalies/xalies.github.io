// SPDX-License-Identifier: GPL-2.0-only
export function layoutCells(width, depth, shape) {
  const cells = [];
  for (let y = 0; y < depth; y++) for (let x = 0; x < width; x++) {
    if (shape === 'l' && x !== 0 && y !== 0) continue;
    if (shape === 't' && y !== 0 && x !== Math.floor(width / 2)) continue;
    if (shape === 'steps' && x + y >= Math.max(width, depth)) continue;
    cells.push([x, y]);
  }
  return cells;
}

export function connectedCells(cells) {
  if (!cells.length) return false;
  const remaining = new Set(cells.map(([x, y]) => `${x},${y}`));
  const queue = [cells[0]];
  remaining.delete(cells[0].join(','));
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const next of [[x-1,y], [x+1,y], [x,y-1], [x,y+1]]) {
      if (remaining.delete(next.join(','))) queue.push(next);
    }
  }
  return remaining.size === 0;
}

// Build only selected cells, using the upstream socket and reinforced mounting dimensions.
export function baseplateSource(cells) {
  return `include <gridfinity_bins/gridfinity_modules.scad>
cells = ${JSON.stringify(cells)};
difference() {
  translate([0, 0, weighted ? -6.4 : 0])
    linear_extrude(height=weighted ? 10.8 : 5)
      offset(r=3.75, $fn=44) offset(delta=-3.75)
        union() for (cell = cells)
          translate([cell[0]*42-21, cell[1]*42-21]) square([42,42]);
  translate([0, 0, -0.01]) render()
    union() for (cell = cells)
      translate([cell[0]*42, cell[1]*42, 0]) pad_oversize(margins=1);
  if (weighted) for (cell = cells) translate([cell[0]*42, cell[1]*42, 0]) {
    cornercopy(13) {
      translate([0, 0, -2.4]) cylinder(d=6.5, h=2.5, $fn=48);
      translate([0, 0, -6.4]) cylinder(d=3.5, h=6.4, $fn=24);
      translate([0, 0, -6.41]) cylinder(d1=8.5, d2=3.5, h=2.5, $fn=24);
    }
    translate([-10.7, -10.7, -6.41]) cube([21.4,21.4,4.01]);
    for (a2=[0,90]) rotate([0,0,a2]) hull()
      for (a=[0,180]) rotate([0,0,a])
        translate([-14.9519,0,-6.41]) cylinder(d=8.5, h=2.01, $fn=24);
  }
}`;
}
