// MIT · Copyright 2026 Xalies
// Print coordinates are XYZ, Z upwards. Three.js supplies the polygon extrusion.
function slab(points, holes, thickness) {
  const shape = new THREE.Shape();
  const trace = (path, polygon) => { path.moveTo(...polygon[0]); for (const point of polygon.slice(1)) path.lineTo(...point); path.closePath(); };
  trace(shape, points);
  for (const polygon of holes) { const hole = new THREE.Path(); trace(hole, polygon); shape.holes.push(hole); }
  const geometry = new THREE.ExtrudeBufferGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1, curveSegments: 1 });
  const positions = [], indices = [], lookup = new Map();
  // Weld the extrusion's duplicated triangle vertices for a compact indexed export.
  const source = geometry.attributes.position.array;
  for (let i = 0; i < source.length; i += 3) {
    const point = Array.from(source.slice(i, i + 3)), key = point.join(',');
    if (!lookup.has(key)) { lookup.set(key, positions.length / 3); positions.push(...point); }
    indices.push(lookup.get(key));
  }
  geometry.dispose();
  // Extrusion caps can skip collinear hole corners. Split those edges so caps
  // and slot walls share the same edges, rather than leaving T-junctions.
  const pending = [], closed = [];
  for (let i = 0; i < indices.length; i += 3) pending.push(indices.slice(i,i+3));
  triangles: while (pending.length) {
    const triangle = pending.pop();
    for (let edge = 0; edge < 3; edge++) {
      const a = triangle[edge], b = triangle[(edge+1)%3], c = triangle[(edge+2)%3];
      const start = positions.slice(a*3,a*3+3), delta = positions.slice(b*3,b*3+3).map((v,j)=>v-start[j]), length = delta.reduce((n,v)=>n+v*v,0);
      for (let vertex = 0; vertex < positions.length/3; vertex++) {
        if (triangle.includes(vertex)) continue;
        const point = positions.slice(vertex*3,vertex*3+3), t = delta.reduce((n,v,j)=>n+v*(point[j]-start[j]),0)/length;
        if (t > 1e-6 && t < 1-1e-6 && Math.hypot(...point.map((v,j)=>v-start[j]-t*delta[j])) < 1e-5) {
          pending.push([a,vertex,c],[vertex,b,c]); continue triangles;
        }
      }
    }
    closed.push(...triangle);
  }
  return { positions, indices: closed };
}
const rectangle = (x,y,width,height) => [[x,y],[x+width,y],[x+width,y+height],[x,y+height]];
export function riserParts(s) {
  if (![s.width,s.depth,s.height,s.thickness,s.clearance].every(Number.isFinite) || s.width < 80 || s.width > 200 || s.depth < 70 || s.depth > 160 || s.height < 40 || s.height > 100 || s.thickness < 4 || s.thickness > 10 || s.clearance < .1 || s.clearance > .8) throw new Error('Choose dimensions within the supported ranges.');
  const railDepth = 12, railHeight = 16, railZ = s.height * .45, railLength = s.width + 2*s.thickness + 4;
  const railCentres = [24,s.depth-24];
  const holes = railCentres.map(y => rectangle(y-(railDepth+s.clearance)/2, railZ-(railHeight+s.clearance)/2, railDepth+s.clearance, railHeight+s.clearance));
  const frame = slab([[0,0],[s.depth,0],[s.depth-14,s.height],[14,s.height]],holes,s.thickness);
  const rail = slab(rectangle(0,0,railLength,railDepth),[],railHeight);
  const deck = slab(rectangle(0,0,s.width+2*s.thickness,s.depth),[],4);
  return [
    { id:'left-frame', label:'Left side frame', mesh:frame, colour:'#8cd6b6', assembled:p=>[-s.width/2-s.thickness+p[2],p[0]-s.depth/2,p[1]], explode:[-24,0,0] },
    { id:'right-frame', label:'Right side frame', mesh:frame, colour:'#8cd6b6', assembled:p=>[s.width/2+p[2],p[0]-s.depth/2,p[1]], explode:[24,0,0] },
    ...railCentres.map((y,i)=>({id:i?'rear-rail':'front-rail',label:i?'Rear cross rail':'Front cross rail',mesh:rail,colour:'#bf785b',assembled:p=>[p[0]-railLength/2,p[1]+y-s.depth/2-railDepth/2,p[2]+railZ-railHeight/2],explode:[0,i?24:-24,0]})),
    { id:'top-deck', label:'Top deck', mesh:deck, colour:'#d6c9a3', assembled:p=>[p[0]-(s.width+2*s.thickness)/2,p[1]-s.depth/2,p[2]+s.height], explode:[0,0,35] }
  ];
}
