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

// Preserve the standard socket; mounting features sit below its seating plane.
export function baseplateSource(cells, { magnets = false, screwCells = [] } = {}) {
  return `include <gridfinity_bins/gridfinity_modules.scad>
cells = ${JSON.stringify(cells)};
screw_cells = ${JSON.stringify(screwCells)};
base_magnets = ${magnets};
extra = (base_magnets || len(screw_cells)>0) ? 3.6 : 0;
translate([0,0,extra]) difference() {
  union() {
    difference() {
      translate([0,0,-extra]) linear_extrude(height=5+extra)
        offset(r=3.75, $fn=44) offset(delta=-3.75)
          union() for (cell=cells)
            translate([cell[0]*42-21,cell[1]*42-21]) square([42,42]);
      for (cell=cells) translate([cell[0]*42-17,cell[1]*42-17,-extra-0.01])
        cube([34,34,extra+0.02]);
    }
    if (base_magnets) for (cell=cells) translate([cell[0]*42,cell[1]*42,0])
      for (x=[-1,1], y=[-1,1]) hull() {
        translate([x*13,y*13,-extra]) cylinder(d=10,h=extra,$fn=48);
        translate([x*18,y*18,-extra]) cylinder(d=4,h=extra,$fn=32);
      }
    for (cell=screw_cells) translate([cell[0]*42,cell[1]*42,-extra]) {
      cylinder(d=10,h=extra,$fn=48);
      translate([-19,-1.5,0]) cube([38,3,extra]);
      translate([-1.5,-19,0]) cube([3,38,extra]);
    }
  }
  translate([0,0,-0.01]) render() union() for (cell=cells)
    translate([cell[0]*42,cell[1]*42,0]) pad_oversize(margins=1);
  if (base_magnets) for (cell=cells) translate([cell[0]*42,cell[1]*42,0])
    cornercopy(13) translate([0,0,-2.4]) cylinder(d=6.5,h=2.5,$fn=48);
  for (cell=screw_cells) translate([cell[0]*42,cell[1]*42,0]) {
    translate([0,0,-extra-0.01]) cylinder(d=3.5,h=extra+0.02,$fn=32);
    translate([0,0,-1.75]) cylinder(d1=3.5,d2=7,h=1.75,$fn=48);
  }
}`;
}
