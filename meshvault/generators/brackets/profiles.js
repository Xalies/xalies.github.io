// Closed extruded profiles with through-holes and optional edge breaks.
export const bracketNames={l:'L bracket',u:'U bracket',z:'Z offset bracket',flat:'Flat joining plate',saddle:'Saddle bracket',halfSaddle:'Half-saddle bracket'};
export function saddleProfile(s){
  const R=s.saddleDiameter/2,T=s.thickness,F=s.footLength,A=F+R+T;
  const arc=(radius,reverse)=>Array.from({length:49},(_,i)=>{const theta=(reverse?48-i:i)*Math.PI/48;return [A+radius*Math.cos(theta),i===0||i===48?T:T+radius*Math.sin(theta)];});
  const inner=arc(R,true),outer=arc(R+T,false);
  return s.type==='halfSaddle'?[[0,0],[F+T,0],...inner,...outer,[0,T]]:
    [[0,0],[F+T,0],...inner,[A+R,0],[2*A,0],[2*A,T],...outer,[0,T]];
}
export function mountingFaces(s){
  const {length:L,height:H,thickness:T}=s;
  const face=(id,label,axis,lo,hi,start,end)=>({id,label,axis,lo,hi,start,end});
  if(s.type==='saddle'||s.type==='halfSaddle'){
    const F=s.footLength,end=2*(F+s.saddleDiameter/2+T);
    return [face('leftFoot','Left mounting foot',1,0,F,0,T),...(s.type==='saddle'?[face('rightFoot','Right mounting foot',1,end-F,end,0,T)]:[])];
  }
  if(s.type==='flat')return [face('plate','Plate',1,0,L,0,T)];
  if(s.type==='u')return [face('base','Base',1,T,L-T,0,T),face('left','Left upright',0,T,H,0,T),face('right','Right upright',0,T,H,L-T,L)];
  if(s.type==='z')return [face('lower','Lower flange',1,T,L,0,T),face('upper','Upper flange',1,T-L,0,H-T,H)];
  return [face('base','Base leg',1,T,L,0,T),face('upright','Upright leg',0,T,H,0,T)];
}
export function profileMesh(s) {
  const {length:L,height:H,width:W,thickness:T,diameter:D,edge:E,holes:N}=s;
  const C=s.edgeChamfer??0,B=s.holeChamfer??0,type=s.type;
  if(!Object.hasOwn(bracketNames,type))throw new Error('Choose a supported bracket shape.');
  if(![L,H,W,T,D,E,N,C,B].every(Number.isFinite)||L<30||L>180||H<30||H>160||W<18||W>80||T<3||T>12||D<3||D>10||![1,2].includes(N)||E<5||E>40)
    throw new Error('Check the bracket dimensions and hole sizes.');
  if(C<0||C>Math.min(3,T/4)||B<0||B>3||B>=T/2)
    throw new Error('Outer chamfers must be no more than a quarter of the thickness (up to 3 mm); hole chamfers must be smaller than half the thickness (up to 3 mm).');
  if(type==='z'&&H<2*T+6)throw new Error('Increase the offset height to leave space between the flanges.');
  const saddle=type==='saddle'||type==='halfSaddle';
  if(saddle&&(![s.saddleDiameter,s.footLength].every(Number.isFinite)||s.saddleDiameter<6||s.saddleDiameter>120||s.footLength<12||s.footLength>60))throw new Error('Use a saddle inside diameter of 6–120 mm and mounting feet of 12–60 mm.');
  const rect=(a,b,c,d)=>[[a,b],[c,b],[c,d],[a,d]];
  const profile=saddle?saddleProfile(s):type==='flat'?rect(0,0,L,T):type==='l'?[[0,0],[L,0],[L,T],[T,T],[T,H],[0,H]]:type==='u'?[[0,0],[L,0],[L,H],[L-T,H],[L-T,T],[T,T],[T,H],[0,H]]:
    [[0,0],[L,0],[L,T],[T,T],[T,H],[T-L,H],[T-L,H-T],[0,H-T]];
  // Each bore crosses a single flange: axis 0 is y, axis 1 is z.
  const bores=[];
  for(const face of mountingFaces(s)){
    const config=s.faceHoles?.[face.id]??{holes:N,diameter:D,edge:E,offset:0};
    const {holes,diameter,edge,offset}=config,along=config.along??0,radius=diameter/2,margin=radius+B+C+3,span=face.hi-face.lo;
    if(![holes,diameter,edge,offset,along].every(Number.isFinite)||![0,1,2].includes(holes)||diameter<3||diameter>10||edge<5||edge>40)
      throw new Error(`${face.label}: check the hole settings.`);
    if(holes&&(W/2-Math.abs(offset)<margin||(holes===2&&(edge<margin||span<2*edge+diameter+2*B+3))||(holes===1&&span<2*margin)))
      throw new Error(`${face.label}: leave at least 3 mm around each hole and between holes. Increase the face size or reduce the hole size / offset.`);
    const centres=(holes===0?[]:holes===1?[(face.lo+face.hi)/2]:[face.lo+edge,face.hi-edge]).map(at=>at+along);
    if(centres.some(at=>at-face.lo<margin||face.hi-at<margin))throw new Error(`${face.label}: leave at least 3 mm around each hole. Reduce the along-face offset.`);
    centres.forEach(at=>bores.push({...face,at,radius,across:W/2+offset}));
  }
  const f=Math.fround,positions=[],indices=[],lookup=new Map();
  const point=p=>{const key=p.map(f).join(',');if(!lookup.has(key)){lookup.set(key,positions.length/3);positions.push(...p.map(f));}return lookup.get(key);};
  const triangle=(a,b,c,n)=>{const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];if(cross.reduce((sum,v,i)=>sum+v*n[i],0)<0)[b,c]=[c,b];indices.push(point(a),point(b),point(c));};
  const quad=(a,b,c,d,n)=>{triangle(a,b,c,n);triangle(a,c,d,n);};
  function face(outline,holes,map,n){const shape=new THREE.Shape();const trace=(path,points)=>{path.moveTo(...points[0]);points.slice(1).forEach(p=>path.lineTo(...p));path.closePath();};trace(shape,outline);holes.forEach(points=>{const path=new THREE.Path();trace(path,points);shape.holes.push(path);});const g=new THREE.ShapeBufferGeometry(shape),p=g.attributes.position.array,ix=g.index.array;for(let i=0;i<ix.length;i+=3)triangle(...Array.from(ix.slice(i,i+3)).map(k=>map(p[k*3],p[k*3+1])),n);g.dispose();}
  const side=[];
  profile.forEach((p,i)=>{const a=profile[(i+profile.length-1)%profile.length],b=profile[(i+1)%profile.length],u=p.map((v,j)=>v-a[j]),v=b.map((v,j)=>v-p[j]);if(C&&!saddle&&u[0]*v[1]-u[1]*v[0]>0){const before=p.map((v,j)=>f(v-C*u[j]/Math.hypot(...u))),after=p.map((value,j)=>f(value+C*(b[j]-p[j])/Math.hypot(...v)));side.push(before,after);}else side.push(p.map(f));});
  const inset=C?side.map((p,i)=>{const before=side[(i+side.length-1)%side.length],after=side[(i+1)%side.length];const normal=(a,b)=>{const dy=b[0]-a[0],dz=b[1]-a[1],d=Math.hypot(dy,dz);return [-dz/d,dy/d];};const a=normal(before,p),b=normal(p,after),u=a[0]*p[0]+a[1]*p[1]+C,v=b[0]*p[0]+b[1]*p[1]+C,det=a[0]*b[1]-a[1]*b[0];return [f((u*b[1]-a[1]*v)/det),f((a[0]*v-u*b[0])/det)];}):side;
  // Trim the curved free end analytically: a miter offset would fold its tiny arc segments.
  if(C&&type==='halfSaddle'){
    const R=s.saddleDiameter/2,A=s.footLength+R+T,inner=R+C,outer=R+T-C;
    const a=Math.asin(C/inner),b=Math.asin(C/outer);
    for(let i=1;i<=48;i++){const theta=Math.PI-i*(Math.PI-a)/48;inset[2+i]=[f(A+inner*Math.cos(theta)),f(T+inner*Math.sin(theta))];}
    for(let i=0;i<48;i++){const theta=b+i*(Math.PI-b)/48;inset[51+i]=[f(A+outer*Math.cos(theta)),f(T+outer*Math.sin(theta))];}
  }
  face(inset,[],(y,z)=>[0,y,z],[-1,0,0]);face(inset,[],(y,z)=>[W,y,z],[1,0,0]);
  const ring=(at,radius,across)=>Array.from({length:32},(_,i)=>[f(across+radius*Math.cos(i*Math.PI/16)),f(at+radius*Math.sin(i*Math.PI/16))]);
  for(let i=0;i<side.length;i++){
    const j=(i+1)%side.length,a=side[i],b=side[j],dy=b[0]-a[0],dz=b[1]-a[1],n=[0,dz,-dy];
    if(!dy||!dz){const axis=dy?1:0,constant=a[axis],other=1-axis,holes=bores.filter(h=>h.axis===axis&&(constant===h.start||constant===h.end)&&h.at>Math.min(a[other],b[other])&&h.at<Math.max(a[other],b[other])).map(h=>ring(h.at,h.radius+B,h.across));face(rect(C,Math.min(a[other],b[other]),W-C,Math.max(a[other],b[other])),holes,(x,v)=>axis===1?[x,v,constant]:[x,constant,v],n);}
    else quad([C,...a],[W-C,...a],[W-C,...b],[C,...b],n);
    if(C)for(const [outer,inner,direction] of [[0,C,-1],[W,W-C,1]])quad([outer,...inset[i]],[inner,...a],[inner,...b],[outer,...inset[j]],[direction*Math.hypot(dy,dz),dz,-dy]);
  }
  for(const h of bores){const map=(x,v,t)=>h.axis===1?[x,v,t]:[x,t,v],r=h.radius;const layers=B?[[h.start,r+B],[h.start+B,r],[h.end-B,r],[h.end,r+B]]:[[h.start,r],[h.end,r]];for(let k=0;k<layers.length-1;k++){const [t0,r0]=layers[k],[t1,r1]=layers[k+1],a=ring(h.at,r0,h.across),b=ring(h.at,r1,h.across);for(let i=0;i<32;i++){const j=(i+1)%32,n=map(h.across-(a[i][0]+a[j][0])/2,h.at-(a[i][1]+a[j][1])/2,0);quad(map(...a[i],t0),map(...a[j],t0),map(...b[j],t1),map(...b[i],t1),n);}}}
  const minY=Math.min(...side.map(p=>p[0]));
  // Lay the profile on the bed, preserving winding with a cyclic permutation.
  return {positions:positions.flatMap((_,i)=>i%3===0?[f(positions[i+1]-minY),positions[i+2],positions[i]]:[]),indices};
}
