// SPDX-License-Identifier: GPL-2.0-only
export function meshBounds({ positions }) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) { const axis = i % 3; min[axis] = Math.min(min[axis], positions[i]); max[axis] = Math.max(max[axis], positions[i]); }
  return { min, width: max[0] - min[0], depth: max[1] - min[1] };
}

function footprint(part) {
  const { settings, bounds } = part;
  if (settings?.part === 'baseplate' && settings.base_shape !== 'rectangle' && settings.cells?.length) {
    return settings.cells.map(([x, y]) => ({ x: x * 42 - 21 - bounds.min[0], y: y * 42 - 21 - bounds.min[1], width: 42, depth: 42 }));
  }
  return [{ x: 0, y: 0, width: bounds.width, depth: bounds.depth }];
}

export function arrangePlates(parts, bed) {
  if (![bed.width, bed.depth, bed.gap].every(Number.isFinite) || bed.width <= 0 || bed.depth <= 0 || bed.gap < 0) throw new Error('Enter valid bed dimensions and spacing.');
  const copies = parts.flatMap(part => {
    if (!Number.isInteger(part.quantity) || part.quantity < 1 || part.quantity > 20) throw new Error('Use 1–20 copies per saved design.');
    const shape = footprint(part);
    return Array.from({ length: part.quantity }, (_, i) => ({ part, copy: i + 1, shape }));
  }).sort((a, b) => b.shape.reduce((n,r) => n+r.width*r.depth,0) - a.shape.reduce((n,r) => n+r.width*r.depth,0));
  const plates = [], epsilon = 1e-5;
  // ponytail: first-fit edge candidates nest cell footprints conservatively; polygon packing can use rounded corner space if needed.
  for (const item of copies) {
    const { width, depth } = item.part.bounds;
    const options = [{ width, depth, rotated: false, footprint: item.shape }, ...(bed.rotate ? [{ width: depth, depth: width, rotated: true, footprint: item.shape.map(r => ({ x: depth-r.y-r.depth, y: r.x, width: r.depth, depth: r.width })) }] : [])].filter(o => o.width+2*bed.gap <= bed.width+epsilon && o.depth+2*bed.gap <= bed.depth+epsilon).sort((a,b) => a.depth-b.depth);
    if (!options.length) throw new Error(`${item.part.title} (${width.toFixed(1)} × ${depth.toFixed(1)} mm) does not fit this bed with ${bed.gap} mm clearance.`);
    let placed = false;
    for (const plate of [...plates, { placements: [] }]) {
      const occupied = plate.placements.flatMap(p => p.footprint.map(r => ({ ...r, x: p.x+r.x, y: p.y+r.y })));
      for (const option of options) {
        const xs = [bed.gap], ys = [bed.gap];
        for (const a of occupied) for (const b of option.footprint) {
          xs.push(a.x+a.width+bed.gap-b.x, a.x-bed.gap-b.x-b.width);
          ys.push(a.y+a.depth+bed.gap-b.y, a.y-bed.gap-b.y-b.depth);
        }
        const candidates = (values, limit) => [...new Set(values.map(v => Math.round(v*1e5)/1e5))].filter(v => v >= bed.gap-epsilon && v <= limit-bed.gap+epsilon).sort((a,b) => a-b);
        for (const y of candidates(ys,bed.depth-option.depth)) {
          for (const x of candidates(xs,bed.width-option.width)) {
            if (option.footprint.some(b => occupied.some(a => !(x+b.x+b.width+bed.gap <= a.x+epsilon || a.x+a.width+bed.gap <= x+b.x+epsilon || y+b.y+b.depth+bed.gap <= a.y+epsilon || a.y+a.depth+bed.gap <= y+b.y+epsilon)))) continue;
            if (!plates.includes(plate)) plates.push(plate);
            plate.placements.push({ part: item.part, copy: item.copy, ...option, x, y }); placed = true; break;
          }
          if (placed) break;
        }
        if (placed) break;
      }
      if (placed) break;
    }
  }
  return plates;
}

export function plateMesh(placements) {
  const positions = [], indices = [];
  for (const item of placements) {
    const { part, x, y, rotated } = item, offset = positions.length / 3;
    const { positions: vertices, indices: triangles } = part.mesh;
    const rotatedMinX = rotated ? -(part.bounds.min[1] + part.bounds.depth) : part.bounds.min[0];
    const rotatedMinY = rotated ? part.bounds.min[0] : part.bounds.min[1];
    for (let i = 0; i < vertices.length; i += 3) positions.push((rotated ? -vertices[i+1] : vertices[i]) - rotatedMinX + x, (rotated ? vertices[i] : vertices[i+1]) - rotatedMinY + y, vertices[i+2] - part.bounds.min[2]);
    for (const index of triangles) indices.push(index + offset);
  }
  return { positions, indices };
}

export function plateSTL({ positions, indices }) {
  const bytes = new Uint8Array(84 + indices.length / 3 * 50), view = new DataView(bytes.buffer);
  view.setUint32(80, indices.length / 3, true);
  for (let i = 0; i < indices.length; i += 3) {
    const [a,b,c] = indices.slice(i,i+3).map(index => positions.slice(index*3,index*3+3));
    const u = b.map((v,j) => v-a[j]), v = c.map((v,j) => v-a[j]);
    const n = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]], length = Math.hypot(...n);
    [...n.map(v => length ? v/length : 0), ...a,...b,...c].forEach((value,j) => view.setFloat32(84 + i/3*50 + j*4, value, true));
  }
  return bytes;
}
