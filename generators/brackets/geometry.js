// MIT · Copyright 2026 Xalies. A closed boundary mesh, with no overlapping solids.
export function bracketMesh(s) {
  const C=s.edgeChamfer??0, B=s.holeChamfer??0;
  const {length:L,height:H,width:W,thickness:T,diameter:D,edge:E,holes:N}=s;
  if (![L,H,W,T,D,E,N].every(Number.isFinite) || L<30 || L>180 || H<30 || H>160 || W<18 || W>80 || T<3 || T>12 || D<3 || D>10 || (N===2&&(E<D/2+3 || E>40)) || ![1,2].includes(N) || Math.min(L,H)<T+(N===2?2*E+D+3:D+6) || W<D+6)
    throw new Error('Leave at least 3 mm around each hole and between holes. Increase the legs or reduce the hole diameter / edge distance.');
  if (![C,B].every(Number.isFinite) || C<0 || C>Math.min(3,T/4) || B<0 || B>3 || B>=T/2)
    throw new Error('Outer chamfers must be no more than a quarter of the thickness (up to 3 mm); hole chamfers must be smaller than half the thickness (up to 3 mm).');
  if (W<D+2*(B+C)+6 || (N===2&&(E<D/2+B+C+3 || Math.min(L,H)<T+2*E+D+2*B+3)) || (N===1&&Math.min(L,H)<T+D+2*(B+C)+6))
    throw new Error('Chamfers need at least 3 mm of material around the hole openings. Increase the dimensions or reduce the chamfer size.');
  const positions=[],indices=[],lookup=new Map(),r=D/2;
  const point=p=>{const key=p.map(v=>Math.fround(v)).join(',');if(!lookup.has(key)){lookup.set(key,positions.length/3);positions.push(...p);}return lookup.get(key);};
  function triangle(a,b,c,normal) {
    const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    if(cross.reduce((n,v,i)=>n+v*normal[i],0)<0)[b,c]=[c,b];
    indices.push(point(a),point(b),point(c));
  }
  const rect=(a,b,c,d)=>[[a,b],[c,b],[c,d],[a,d]];
  const circles=(extent,radius=r)=>(N===1?[(T+extent)/2]:[T+E,extent-E]).map(p=>Array.from({length:32},(_,i)=>[Math.fround(W/2+radius*Math.cos(i*Math.PI/16)),Math.fround(p+radius*Math.sin(i*Math.PI/16))]));
  function face(polygon,holes,map,normal) {
    const shape=new THREE.Shape();const trace=(path,points)=>{path.moveTo(...points[0]);points.slice(1).forEach(p=>path.lineTo(...p));path.closePath();};trace(shape,polygon);
    holes.forEach(points=>{const hole=new THREE.Path();trace(hole,points);shape.holes.push(hole);});
    const geometry=new THREE.ShapeBufferGeometry(shape),src=geometry.attributes.position.array,ix=geometry.index.array;
    for(let i=0;i<ix.length;i+=3)triangle(...Array.from(ix.slice(i,i+3)).map(k=>map(src[k*3],src[k*3+1])),normal);
    geometry.dispose();
  }
  const f=Math.fround, xmin=f(C),xmax=f(W-C);
  const base=circles(L,r+B),wall=circles(H,r+B);
  face(rect(xmin,C,xmax,L-C),base,(x,y)=>[x,y,0],[0,0,-1]);
  face(rect(xmin,T,xmax,L-C),base,(x,y)=>[x,y,T],[0,0,1]);
  face(rect(xmin,C,xmax,H-C),wall,(x,z)=>[x,0,z],[0,-1,0]);
  face(rect(xmin,T,xmax,H-C),wall,(x,z)=>[x,T,z],[0,1,0]);
  face(rect(xmin,C,xmax,T-C),[],(x,y)=>[x,y,H],[0,0,1]);
  face(rect(xmin,C,xmax,T-C),[],(x,z)=>[x,L,z],[0,1,0]);
  const side=(C?[[C,0],[L-C,0],[L,C],[L,T-C],[L-C,T],[T,T],[T,H-C],[T-C,H],[C,H],[0,H-C],[0,C]]:[[0,0],[L,0],[L,T],[T,T],[T,H],[0,H]]).map(p=>p.map(f));
  // Offset the side-cap outline inward. Lofting to the full profile bevels the
  // width-end edges as well as the five convex corners across the width.
  const inset=C?side.map((p,i)=>{
    const before=side[(i+side.length-1)%side.length],after=side[(i+1)%side.length];
    const normal=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);return [-dy/length,dx/length];};
    const a=normal(before,p),b=normal(p,after),u=a[0]*p[0]+a[1]*p[1]+C,v=b[0]*p[0]+b[1]*p[1]+C,det=a[0]*b[1]-a[1]*b[0];
    return [f((u*b[1]-a[1]*v)/det),f((a[0]*v-u*b[0])/det)];
  }):side;
  face(inset,[],(y,z)=>[0,y,z],[-1,0,0]);face(inset,[],(y,z)=>[W,y,z],[1,0,0]);
  const quad=(a,b,c,d,normal)=>{triangle(a,b,c,normal);triangle(a,c,d,normal);};
  for(let i=0;i<side.length;i++) {
    const j=(i+1)%side.length,a=side[i],b=side[j],dy=b[0]-a[0],dz=b[1]-a[1];
    if(dy&&dz)quad([xmin,...a],[xmax,...a],[xmax,...b],[xmin,...b],[0,dz,-dy]);
    if(C)for(const [outer,inner,direction] of [[0,xmin,-1],[W,xmax,1]])
      quad([outer,...inset[i]],[inner,...a],[inner,...b],[outer,...inset[j]],[direction*Math.hypot(dy,dz),dz,-dy]);
  }
  for(const [extent,map] of [[L,(x,y,t)=>[x,y,t]],[H,(x,z,t)=>[x,t,z]]]) {
    const layers=B?[[0,r+B],[B,r],[T-B,r],[T,r+B]]:[[0,r],[T,r]];
    for(let layer=0;layer<layers.length-1;layer++) {
      const [t0,r0]=layers[layer],[t1,r1]=layers[layer+1],lower=circles(extent,r0),upper=circles(extent,r1);
      for(let hole=0;hole<N;hole++)for(let i=0;i<32;i++) {
        const j=(i+1)%32,a=lower[hole][i],b=lower[hole][j],centre=[W/2,lower[hole].reduce((n,p)=>n+p[1],0)/32],normal=map(centre[0]-(a[0]+b[0])/2,centre[1]-(a[1]+b[1])/2,0);
        quad(map(...a,t0),map(...b,t0),map(...upper[hole][j],t1),map(...upper[hole][i],t1),normal);
      }
    }
  }
  // Lay the L-shaped side on the bed. A cyclic axis permutation preserves winding.
  const print=positions.flatMap((_,i)=>i%3===0?[positions[i+1],positions[i+2],positions[i]]:[]);
  return {positions:print,indices};
}
