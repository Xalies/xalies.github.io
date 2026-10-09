const smooth = t => t * t * (3 - 2 * t);
export function profileNodes(s) {
  return [{t:0,diameter:s.base},{t:s.bellyPosition??.55,diameter:s.belly},{t:1,diameter:s.mouth},...(s.profilePoints||[])].sort((a,b)=>a.t-b.t);
}
export function profileRadius(s, t, points=profileNodes(s)) {
  const i=Math.max(1,points.findIndex(p=>p.t>=t)), a=points[i-1], b=points[i];
  if(s.topOffset!==undefined&&b.t===1) {
    const u=Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t))),r=a.diameter/2,end=b.diameter/2;
    const bulge=(s.topOffset<0&&Math.abs(end-r)<s.wall*2)?Math.min(s.wall*2,r-s.wall-1):0;
    return (1-u)*(1-u)*r+2*(1-u)*u*(r-bulge)+u*u*end;
  }
  return (a.diameter+(b.diameter-a.diameter)*smooth(Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t)))))/2;
}
// Height remains the upper curve reference; the opening can finish above or below it.
export function profilePoint(s,t,points=profileNodes(s)) {
  const start=points.at(-2).t, u=Math.max(0,Math.min(1,(t-start)/(1-start)));
  const offset=s.topOffset??0;
  const control=s.height+(offset<0?Math.sqrt(s.height*(1-start)*-offset):0);
  const y=t<=start||s.topOffset===undefined?s.height*t:
    (1-u)*(1-u)*s.height*start+2*(1-u)*u*control+u*u*(s.height+offset);
  return {radius:profileRadius(s,t,points),y};
}
// A closed, hollow mesh: underside → outer wall → rim → inner wall → floor.
export function vesselMesh(s) {
  const segments = s.quality === 'fine' ? 384 : 192;
  const levels = s.quality === 'fine' ? 128 : 64;
  const positions = [], indices = [], rings = [], profile=profileNodes(s);
  function radius(t, angle) {
    const r = profileRadius(s, t, profile);
    return r + (s.flutes ? s.amplitude * Math.cos(s.flutes * (angle - t * s.twist * Math.PI / 180)) * smooth(Math.min(1, t * 8)) : 0);
  }
  function ring(t, inner = false) {
    const start = positions.length / 3, point=profilePoint(s,t,profile);
    let radialOffset=inner?-s.wall:0, y=point.y;
    if(inner&&s.topOffset!==undefined&&t>profile.at(-2).t) {
      const a=profilePoint(s,Math.max(0,t-.0001),profile),b=profilePoint(s,Math.min(1,t+.0001),profile);
      const dr=b.radius-a.radius,dy=b.y-a.y,length=Math.hypot(dr,dy);
      radialOffset=-s.wall*dy/length;y+=s.wall*dr/length;
    }
    for (let j = 0; j < segments; j++) {
      const angle = j * Math.PI * 2 / segments;
      const r = radius(t, angle) + radialOffset;
      positions.push(r * Math.cos(angle), y, r * Math.sin(angle));
    }
    rings.push(start);
  }
  for (let i = 0; i <= levels; i++) ring(i / levels);
  for (let i = 0; i <= levels; i++) ring(1 - (1-s.floor/s.height) * i / levels, true);
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
  if(s.topOffset!==undefined) {
    const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    for(let angle=0;angle<segments;angle++) {
      const a=angle*Math.PI*2/segments;
      const section=rings.map(start=>{const i=(start+angle)*3;return [positions[i]*Math.cos(a)+positions[i+2]*Math.sin(a),positions[i+1]];});
      for(let i=0;i<section.length-1;i++)for(let j=i+2;j<section.length-1;j++) {
        const a=section[i],b=section[i+1],c=section[j],d=section[j+1];
        if(Math.max(a[1],b[1])<Math.min(c[1],d[1])||Math.max(c[1],d[1])<Math.min(a[1],b[1]))continue;
        if(cross(a,b,c)*cross(a,b,d)<-1e-9&&cross(c,d,a)*cross(c,d,b)<-1e-9)throw new Error('The top curve is too tight for this wall or texture. Raise the top point, reduce the flute depth, or use a thinner wall.');
      }
    }
  }
  return { positions, indices };
}

export function binarySTL({ positions, indices }, up = 'y') {
  const bytes = new Uint8Array(84 + indices.length / 3 * 50);
  const view = new DataView(bytes.buffer);
  view.setUint32(80, indices.length / 3, true);
  for (let i = 0; i < indices.length; i += 3) {
    const vertices = Array.from(indices.slice(i, i + 3), index => up === 'z'
      ? [positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]]
      : [positions[index * 3], -positions[index * 3 + 2], positions[index * 3 + 1]]);
    const u = vertices[1].map((v, a) => v - vertices[0][a]), v = vertices[2].map((v, a) => v - vertices[0][a]);
    const n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
    const length = Math.hypot(...n);
    [...n.map(x => x / length), ...vertices.flat()].forEach((value, j) => view.setFloat32(84 + i / 3 * 50 + j * 4, value, true));
  }
  return bytes;
}
