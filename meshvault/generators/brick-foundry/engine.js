// MIT · Copyright 2026 Xalies. Millimetres, Z up; one cell = 8 × 8 × 3.2 mm.
import factory from './vendor/manifold.js';
export const PITCH=8, LAYER=3.2;
let kernelPromise;
export async function initKernel(wasmBinary){
  kernelPromise??=factory({locateFile:file=>new URL('vendor/'+file,import.meta.url).href,...(wasmBinary?{wasmBinary}:{})}).then(m=>{m.setup();return m;});
  return kernelPromise;
}
export function definition(type,w=2,l=4){
  if(!['brick','plate','tile','slope','corner','round'].includes(type))throw Error('Choose a supported piece.');
  if(!Number.isInteger(w)||!Number.isInteger(l)||w<1||w>8||l<1||l>12)throw Error('Use 1–8 studs across and 1–12 studs long.');
  if(type==='round')w=l=1;
  if(type==='corner')w=l=2;
  if(type==='slope')l=2;
  return {type,w,l,h:['plate','tile'].includes(type)?1:3,id:`${type}-${w}x${l}`};
}
export function cells(d){
  const result=[];for(let y=0;y<d.l;y++)for(let x=0;x<d.w;x++)for(let z=0;z<d.h;z++){
    if(d.type==='corner'&&x===1&&y===1)continue;
    if(d.type==='slope'&&y===0&&z===2)continue;
    result.push([x,y,z]);
  }return result;
}
export function studs(d){
  if(d.type==='tile')return [];
  const result=[];for(let y=0;y<d.l;y++)for(let x=0;x<d.w;x++){
    if(d.type==='corner'&&x===1&&y===1||d.type==='slope'&&y!==d.l-1)continue;
    result.push([x,y]);
  }return result;
}
export function rotateCell(x,y,d,r){return [[x,y],[d.l-1-y,x],[d.w-1-x,d.l-1-y],[y,d.w-1-x]][r];}
export function placementTransform(p){
  const {w,l}=p.part,r=p.r||0,cs=[1,0,-1,0][r],sn=[0,1,0,-1][r],offset=[[0,0],[l*8,0],[w*8,l*8],[0,w*8]][r];
  return [cs,sn,0,-sn,cs,0,0,0,1,p.x*8+offset[0],p.y*8+offset[1],p.z*LAYER];
}
export function transformPoint(v,m){return [m[0]*v[0]+m[3]*v[1]+m[6]*v[2]+m[9],m[1]*v[0]+m[4]*v[1]+m[7]*v[2]+m[10],m[2]*v[0]+m[5]*v[1]+m[8]*v[2]+m[11]];}
export function bounds(mesh){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<mesh.positions.length;i++) {const n=mesh.positions[i];if(!Number.isFinite(n))throw Error('The model contains invalid coordinates.');min[i%3]=Math.min(min[i%3],n);max[i%3]=Math.max(max[i%3],n);}
  return {min,max,size:max.map((n,i)=>n-min[i])};
}
function unpack(solid){
  const raw=solid.getMesh(),positions=new Float32Array(raw.numVert*3);
  for(let i=0;i<raw.numVert;i++)positions.set(raw.vertProperties.slice(i*raw.numProp,i*raw.numProp+3),i*3);
  return {positions,indices:new Uint32Array(raw.triVerts)};
}
export async function brickMesh(d,clearance=.1){
  d=definition(d.type,d.w,d.l);
  if(!Number.isFinite(clearance)||clearance<-.1||clearance>.3)throw Error('Fit adjustment must be between −0.10 and 0.30 mm.');
  const {Manifold:M,CrossSection:C}=await initKernel(),allocated=[],own=o=>(allocated.push(o),o);
  const move=(s,v)=>own(s.translate(v)),box=(size,v=[0,0,0])=>move(own(M.cube(size)),v),cylinder=(h,r,v)=>move(own(M.cylinder(h,r,r,40)),v);
  const W=d.w*8-.2,D=d.l*8-.2,H=d.h*LAYER,wall=1.5-clearance,roof=1.2,pieces=[];
  try{
    let outer,cavity;
    if(d.type==='round'){
      outer=cylinder(H,3.9,[4,4,0]);cavity=cylinder(H-roof+.2,2.4+clearance,[4,4,-.2]);
    }else if(d.type==='slope'){
      // Extrude the Y/Z roof profile along X. Its inner profile keeps a real roof.
      const profile=(margin,low,high)=>own(new C([[[margin,-.2],[D+.1-margin,-.2],[D+.1-margin,high],[8,high],[margin,low]]]));
      const outside=own(new C([[[.1,0],[D+.1,0],[D+.1,H],[8,H],[.1,LAYER]]]));
      outer=move(own(own(M.extrude(outside,W)).rotate([90,0,90])),[.1,0,0]);
      const inner=profile(.1+wall,LAYER-roof+wall*(H-LAYER)/7.9,H-roof);
      cavity=move(own(own(M.extrude(inner,W-2*wall)).rotate([90,0,90])),[.1+wall,0,0]);
    }else if(d.type==='corner'){
      const outline=own(new C([[[.1,.1],[15.9,.1],[15.9,7.9],[7.9,7.9],[7.9,15.9],[.1,15.9]]]));
      outer=own(M.extrude(outline,H));const inset=own(outline.offset(-wall));cavity=move(own(M.extrude(inset,H-roof+.2)),[0,0,-.2]);
    }else{
      outer=box([W,D,H],[.1,.1,0]);cavity=box([W-2*wall,D-2*wall,H-roof+.2],[.1+wall,.1+wall,-.2]);
    }
    pieces.push(own(outer.subtract(cavity)));
    const supports=[];
    if(d.w>1&&d.l>1)for(let x=1;x<d.w;x++)for(let y=1;y<d.l;y++){
      const tube=cylinder(H-roof+.12,3.256-clearance,[x*8,y*8,0]),hole=cylinder(H-roof+.32,2.4,[x*8,y*8,-.1]);supports.push(own(tube.subtract(hole)));
    }
    else if(d.type!=='round')for(let i=1;i<Math.max(d.w,d.l);i++)supports.push(cylinder(H-roof+.12,1.6-clearance,d.w===1?[4,i*8,0]:[i*8,4,0]));
    if(supports.length)pieces.push(own(own(M.union(supports)).intersect(outer)));
    for(const [x,y]of studs(d))pieces.push(cylinder(1.9,2.4-clearance,[4+x*8,4+y*8,H-.1]));
    const result=own(M.union(pieces));if(result.isEmpty())throw Error('This piece could not be built.');return unpack(result);
  }finally{for(const o of allocated.reverse())o.delete();}
}
export async function demoMesh(){
  const {Manifold:M}=await initKernel(),all=[],own=o=>(all.push(o),o),at=(o,p)=>own(o.translate(p));
  try{
    const base=at(own(M.cube([72,56,8])),[-36,-28,0]),tower=at(own(M.cylinder(46,18,13,32)),[0,0,7]),lamp=at(own(M.cylinder(10,16,16,32)),[0,0,52]),roof=at(own(M.cylinder(16,23,0,24)),[0,0,61]);
    return unpack(own(M.union([base,tower,lamp,roof])));
  }finally{for(const o of all.reverse())o.delete();}
}
export function normalise(meshes,size=16,up='z',turn=0){
  if(!Number.isInteger(size)||size<6||size>40||!['x','y','z'].includes(up)||!Number.isInteger(turn)||turn<0||turn>3)throw Error('Choose a size of 6–40 studs and a supported orientation.');
  let triangles=0;const oriented=meshes.map(mesh=>{
    if(!mesh.positions?.length||mesh.positions.length%3||!mesh.indices?.length||mesh.indices.length%3)throw Error('The file contains incomplete triangles.');
    triangles+=mesh.indices.length/3;if(triangles>150000)throw Error('Use a model with at most 150,000 triangles.');
    const p=new Float32Array(mesh.positions.length);for(let i=0;i<p.length;i+=3){let v=Array.from(mesh.positions.slice(i,i+3));if(up==='y')v=[v[0],-v[2],v[1]];if(up==='x')v=[v[1],v[2],v[0]];for(let r=0;r<turn;r++)v=[-v[1],v[0],v[2]];p.set(v,i);}
    if(Array.from(mesh.indices).some(n=>!Number.isInteger(n)||n<0||n>=p.length/3))throw Error('The file has invalid triangle references.');const indices=new Uint32Array(mesh.indices);return {positions:p,indices};
  });
  const boxes=oriented.map(bounds),min=[0,1,2].map(i=>Math.min(...boxes.map(b=>b.min[i]))),max=[0,1,2].map(i=>Math.max(...boxes.map(b=>b.max[i]))),extent=max.map((n,i)=>n-min[i]),scale=size*8/Math.max(...extent);
  if(!Number.isFinite(scale)||Math.max(...extent)<=1e-8)throw Error('The model has no usable size.');
  const dimensions=extent.map((n,i)=>Math.max(1,Math.ceil(n*scale/(i===2?LAYER:8)-1e-6)));
  return {meshes:oriented.map(mesh=>({positions:mesh.positions.map((n,i)=>(n-min[i%3])*scale),indices:mesh.indices})),dimensions,scale};
}
export function voxelise(source,shell=false){
  const [nx,ny,nz]=source.dimensions,index=(x,y,z)=>(z*ny+y)*nx+x,occupied=new Uint8Array(nx*ny*nz);let openColumns=0;
  // At most 40×40 columns and 100 plate layers; rasterise projected triangles.
  for(const mesh of source.meshes){
    const hits=Array.from({length:nx*ny},()=>[]),p=mesh.positions,ix=mesh.indices;
    for(let f=0;f<ix.length;f+=3){const a=ix[f]*3,b=ix[f+1]*3,c=ix[f+2]*3,den=(p[b+1]-p[c+1])*(p[a]-p[c])+(p[c]-p[b])*(p[a+1]-p[c+1]);if(Math.abs(den)<1e-9)continue;
      const x0=Math.max(0,Math.ceil((Math.min(p[a],p[b],p[c])-4)/8-1e-7)),x1=Math.min(nx-1,Math.floor((Math.max(p[a],p[b],p[c])-4)/8+1e-7)),y0=Math.max(0,Math.ceil((Math.min(p[a+1],p[b+1],p[c+1])-4)/8-1e-7)),y1=Math.min(ny-1,Math.floor((Math.max(p[a+1],p[b+1],p[c+1])-4)/8+1e-7));
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const X=x*8+4,Y=y*8+4,u=((p[b+1]-p[c+1])*(X-p[c])+(p[c]-p[b])*(Y-p[c+1]))/den,v=((p[c+1]-p[a+1])*(X-p[c])+(p[a]-p[c])*(Y-p[c+1]))/den;if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)hits[y*nx+x].push(u*p[a+2]+v*p[b+2]+(1-u-v)*p[c+2]);}
    }
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
      const crossings=hits[y*nx+x].sort((a,b)=>a-b).filter((n,i,arr)=>!i||Math.abs(n-arr[i-1])>1e-4);
      if(crossings.length%2){openColumns++;for(const h of crossings)occupied[index(x,y,Math.min(nz-1,Math.max(0,Math.floor(h/LAYER))))]=1;continue;}
      for(let i=0;i<crossings.length;i+=2)for(let z=Math.max(0,Math.ceil(crossings[i]/LAYER-.5));z<nz&&(z+.5)*LAYER<=crossings[i+1]+1e-5;z++)occupied[index(x,y,z)]=1;
    }
  }
  if(shell){const full=occupied.slice();for(let z=1;z<nz-1;z++)for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++)if([[x-1,y,z],[x+1,y,z],[x,y-1,z],[x,y+1,z],[x,y,z-1],[x,y,z+1]].every(q=>full[index(...q)]))occupied[index(x,y,z)]=0;}
  if(!occupied.some(Boolean))throw Error('No blocks fit at this size. Try a larger size or another orientation.');
  return {occupied,dimensions:source.dimensions,openColumns};
}
export function pack(grid,shaped=true){
  const [nx,ny,nz]=grid.dimensions,remaining=grid.occupied.slice(),index=(x,y,z)=>(z*ny+y)*nx+x,pieces=[],catalog=[];
  for(const type of ['brick','plate'])for(const [w,l]of [[2,8],[2,6],[2,4],[2,3],[2,2],[1,8],[1,6],[1,4],[1,3],[1,2],[1,1]])catalog.push(definition(type,w,l));
  if(shaped)catalog.push(definition('slope',2,2),definition('slope',1,2),definition('corner',2,2));
  const candidates=catalog.flatMap(part=>[0,1,2,3].map(r=>({part,r,cells:cells(part).map(([x,y,z])=>[...rotateCell(x,y,part,r),z])}))).sort((a,b)=>b.cells.length-a.cells.length||(['slope','corner'].includes(b.part.type)?1:0)-(['slope','corner'].includes(a.part.type)?1:0));
  const courses=[candidates,candidates.slice().sort((a,b)=>b.cells.length-a.cells.length||(['slope','corner'].includes(b.part.type)?1:0)-(['slope','corner'].includes(a.part.type)?1:0)||(b.r%2)-(a.r%2))];
  // ponytail: greedy whole-piece coverage, capped at 4,000 pieces; a structural optimiser can replace it if required.
  for(let z=0;z<nz;z++)for(let row=0;row<ny;row++)for(let col=0;col<nx;col++){
    const reverse=Math.floor(z/3)%2===1,x=reverse?nx-1-col:col,y=reverse?ny-1-row:row;if(!remaining[index(x,y,z)])continue;
    let best=null;
    for(const c of courses[Math.floor(z/3)%2]){const dx=reverse?Math.max(...c.cells.map(q=>q[0])):0,dy=reverse?Math.max(...c.cells.map(q=>q[1])):0,X=x-dx,Y=y-dy;
      // A one-stud edge course offsets seams and lets the next course bridge them.
      if(reverse&&(x===nx-1&&dx>0||y===ny-1&&dy>0))continue;
      if(!c.cells.some(q=>q[0]===dx&&q[1]===dy&&q[2]===0)||!c.cells.every(([u,v,k])=>X+u>=0&&X+u<nx&&Y+v>=0&&Y+v<ny&&z+k<nz&&remaining[index(X+u,Y+v,z+k)]))continue;
      if(c.part.type==='slope'||c.part.type==='corner'){
        const used=new Set(c.cells.map(q=>q.join(','))),W=c.r%2?c.part.l:c.part.w,D=c.r%2?c.part.w:c.part.l;
        let clean=true;for(let v=0;v<D;v++)for(let u=0;u<W;u++)for(let k=0;k<c.part.h;k++)if(!used.has([u,v,k].join(','))&&X+u<nx&&Y+v<ny&&z+k<nz&&grid.occupied[index(X+u,Y+v,z+k)])clean=false;
        if(!clean)continue;
      }
      best={...c,x:X,y:Y,z};break;
    }
    if(!best)throw Error('Could not cover a grid cell.');for(const [u,v,k]of best.cells)remaining[index(best.x+u,best.y+v,z+k)]=0;
    pieces.push({part:best.part,r:best.r,x:best.x,y:best.y,z});if(pieces.length>4000)throw Error('This set needs over 4,000 pieces. Reduce the size or use solid filling.');
  }
  if(remaining.some(Boolean))throw Error('Some model cells could not be covered.');return pieces;
}
export function connections(pieces){
  const roots=pieces.map((_,i)=>i),find=i=>{while(roots[i]!==i){roots[i]=roots[roots[i]];i=roots[i];}return i;},tops=new Map();let joined=0;
  pieces.forEach((p,i)=>{for(const [x,y]of studs(p.part)){const [u,v]=rotateCell(x,y,p.part,p.r),key=[p.x+u,p.y+v,p.z+p.part.h].join(',');tops.set(key,i);}});
  pieces.forEach((p,i)=>{const bottom=new Set(cells(p.part).filter(q=>q[2]===0).map(([x,y])=>rotateCell(x,y,p.part,p.r).join(',')));for(const q of bottom){const [u,v]=q.split(',').map(Number),other=tops.get([p.x+u,p.y+v,p.z].join(','));if(other!==undefined&&find(i)!==find(other)){roots[find(i)]=find(other);joined++;}}});
  return {groups:new Set(roots.map((_,i)=>find(i))).size,joined};
}
export async function makeSet(meshes,options={}){
  const source=normalise(meshes,options.size??16,options.up??'z',options.turn??0),grid=voxelise(source,!!options.shell),pieces=pack(grid,options.shaped!==false),variants=[];
  for(const part of new Map(pieces.map(p=>[p.part.id,p.part])).values())variants.push({...part,mesh:await brickMesh(part,options.clearance??.1),quantity:pieces.filter(p=>p.part.id===part.id).length});
  return {pieces,variants,dimensions:grid.dimensions,occupied:grid.occupied,openColumns:grid.openColumns,connections:connections(pieces),source:source.meshes,scale:source.scale};
}
