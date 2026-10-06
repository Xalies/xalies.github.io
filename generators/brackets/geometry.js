// MIT · Copyright 2026 Xalies. A closed boundary mesh, with no overlapping solids.
export function bracketMesh(s) {
  const {length:L,height:H,width:W,thickness:T,diameter:D,edge:E,holes:N}=s;
  if (![L,H,W,T,D,E,N].every(Number.isFinite) || L<30 || L>180 || H<30 || H>160 || W<18 || W>80 || T<3 || T>12 || D<3 || D>10 || (N===2&&(E<D/2+3 || E>40)) || ![1,2].includes(N) || Math.min(L,H)<T+(N===2?2*E+D+3:D+6) || W<D+6)
    throw new Error('Leave at least 3 mm around each hole and between holes. Increase the legs or reduce the hole diameter / edge distance.');
  const positions=[],indices=[],lookup=new Map(),r=D/2;
  const point=p=>{const key=p.map(v=>Math.fround(v)).join(',');if(!lookup.has(key)){lookup.set(key,positions.length/3);positions.push(...p);}return lookup.get(key);};
  function triangle(a,b,c,normal) {
    const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    if(cross.reduce((n,v,i)=>n+v*normal[i],0)<0)[b,c]=[c,b];
    indices.push(point(a),point(b),point(c));
  }
  const rect=(a,b,c,d)=>[[a,b],[c,b],[c,d],[a,d]];
  const circles=extent=>(N===1?[(T+extent)/2]:[T+E,extent-E]).map(p=>Array.from({length:32},(_,i)=>[Math.fround(W/2+r*Math.cos(i*Math.PI/16)),Math.fround(p+r*Math.sin(i*Math.PI/16))]));
  function face(polygon,holes,map,normal) {
    const shape=new THREE.Shape();const trace=(path,points)=>{path.moveTo(...points[0]);points.slice(1).forEach(p=>path.lineTo(...p));path.closePath();};trace(shape,polygon);
    holes.forEach(points=>{const hole=new THREE.Path();trace(hole,points);shape.holes.push(hole);});
    const geometry=new THREE.ShapeBufferGeometry(shape),src=geometry.attributes.position.array,ix=geometry.index.array;
    for(let i=0;i<ix.length;i+=3)triangle(...Array.from(ix.slice(i,i+3)).map(k=>map(src[k*3],src[k*3+1])),normal);
    geometry.dispose();
  }
  const base=circles(L),wall=circles(H);
  face(rect(0,0,W,L),base,(x,y)=>[x,y,0],[0,0,-1]);
  face(rect(0,T,W,L),base,(x,y)=>[x,y,T],[0,0,1]);
  face(rect(0,0,W,H),wall,(x,z)=>[x,0,z],[0,-1,0]);
  face(rect(0,T,W,H),wall,(x,z)=>[x,T,z],[0,1,0]);
  face(rect(0,0,W,T),[],(x,y)=>[x,y,H],[0,0,1]);
  face(rect(0,0,W,T),[],(x,z)=>[x,L,z],[0,1,0]);
  const side=[[0,0],[L,0],[L,T],[T,T],[T,H],[0,H]];
  face(side,[],(y,z)=>[0,y,z],[-1,0,0]);face(side,[],(y,z)=>[W,y,z],[1,0,0]);
  for(const [rings,map] of [[base,(x,y,t)=>[x,y,t]],[wall,(x,z,t)=>[x,t,z]]]) for(const ring of rings) for(let i=0;i<ring.length;i++) {
    const a=ring[i],b=ring[(i+1)%ring.length],centre=[W/2,ring.reduce((n,p)=>n+p[1],0)/ring.length],normal=map(centre[0]-(a[0]+b[0])/2,centre[1]-(a[1]+b[1])/2,0);
    const p=map(...a,0),q=map(...b,0),u=map(...b,T),v=map(...a,T);triangle(p,q,u,normal);triangle(p,u,v,normal);
  }
  // Lay the L-shaped side on the bed. A cyclic axis permutation preserves winding.
  const print=positions.flatMap((_,i)=>i%3===0?[positions[i+1],positions[i+2],positions[i]]:[]);
  return {positions:print,indices};
}
