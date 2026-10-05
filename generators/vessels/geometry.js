// A closed, hollow mesh: underside → outer wall → rim → inner wall → floor.
export function vesselMesh(s) {
  const segments = s.quality === 'fine' ? 384 : 192;
  const levels = s.quality === 'fine' ? 128 : 64;
  const positions = [], indices = [], rings = [];
  const smooth = t => t * t * (3 - 2 * t);
  function radius(y, angle) {
    const t = y / s.height;
    const r = t < .55 ? s.base / 2 + (s.belly - s.base) / 2 * smooth(t / .55)
      : s.belly / 2 + (s.mouth - s.belly) / 2 * smooth((t - .55) / .45);
    return r + (s.flutes ? s.amplitude * Math.cos(s.flutes * (angle - t * s.twist * Math.PI / 180)) * smooth(Math.min(1, t * 8)) : 0);
  }
  function ring(y, inner = false) {
    const start = positions.length / 3;
    for (let j = 0; j < segments; j++) {
      const angle = j * Math.PI * 2 / segments;
      const r = radius(y, angle) - (inner ? s.wall : 0);
      positions.push(r * Math.cos(angle), y, r * Math.sin(angle));
    }
    rings.push(start);
  }
  for (let i = 0; i <= levels; i++) ring(s.height * i / levels);
  for (let i = 0; i <= levels; i++) ring(s.height - (s.height - s.floor) * i / levels, true);
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const k = (j + 1) % segments, a = rings[i] + j, b = rings[i + 1] + j, c = rings[i] + k, d = rings[i + 1] + k;
      indices.push(a, b, c, c, b, d);
    }
  }
  const bottom = positions.length / 3; positions.push(0, 0, 0);
  const floor = positions.length / 3; positions.push(0, s.floor, 0);
  for (let j = 0; j < segments; j++) {
    const k = (j + 1) % segments;
    indices.push(bottom, rings[0] + j, rings[0] + k);
    indices.push(floor, rings.at(-1) + k, rings.at(-1) + j);
  }
  return { positions, indices };
}

export function binarySTL({ positions, indices }) {
  const bytes = new Uint8Array(84 + indices.length / 3 * 50);
  const view = new DataView(bytes.buffer);
  view.setUint32(80, indices.length / 3, true);
  for (let i = 0; i < indices.length; i += 3) {
    const vertices = indices.slice(i, i + 3).map(index => [positions[index * 3], -positions[index * 3 + 2], positions[index * 3 + 1]]);
    const u = vertices[1].map((v, a) => v - vertices[0][a]), v = vertices[2].map((v, a) => v - vertices[0][a]);
    const n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
    const length = Math.hypot(...n);
    [...n.map(x => x / length), ...vertices.flat()].forEach((value, j) => view.setFloat32(84 + i / 3 * 50 + j * 4, value, true));
  }
  return bytes;
}
