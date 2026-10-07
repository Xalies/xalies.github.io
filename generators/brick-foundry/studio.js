import {definition,bounds,studs,placementTransform} from './engine.js';
import {readSTL,read3MF} from './importers.js';
import {colours,label,filename,plateSTL,create3MF,assembled3MF,exportSet,guideHTML} from './exports.js';
import {saveFile,canvasThumbnail,createPackage} from '../shared/mvpack.js';
const $=id=>document.getElementById(id),T=window.THREE;
let mode='piece',type='brick',w=2,l=4,colour=colours.brick,mesh=null,set=null,original=null,sourceName='Little lighthouse',turn=0,shell=false,worker,job=0,pending=new Map(),revision=0,debounce,palette={};
let pieceReady=false,setReady=false,modelGroup=new T.Group(),ghostGroup=new T.Group(),variants=new Map(),dimensions=[16,32,11.4],inverted=false;
const scene=new T.Scene();scene.background=new T.Color('#eae7de');scene.add(modelGroup,ghostGroup);
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputEncoding=T.sRGBEncoding;$('viewport').append(renderer.domElement);
const camera=new T.PerspectiveCamera(36,1,.1,3000);camera.up.set(0,0,1);
const orbit=new T.OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.dampingFactor=.08;orbit.maxDistance=1400;orbit.minDistance=10;orbit.maxPolarAngle=Math.PI*.95;
scene.add(new T.HemisphereLight('#ffffff','#958c78',.8));
const light=new T.DirectionalLight('#fff9ee',1.05);light.position.set(-70,-100,200);light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-250,right:250,top:250,bottom:-250,near:1,far:600});light.shadow.bias=-.0005;scene.add(light);
const fill=new T.DirectionalLight('#e1e9ff',.3);fill.position.set(80,120,60);scene.add(fill);
const floor=new T.Mesh(new T.PlaneBufferGeometry(1200,1200),new T.ShadowMaterial({color:'#55462b',opacity:.2}));floor.position.z=-.21;floor.receiveShadow=true;scene.add(floor);
const grid=new T.GridHelper(480,60,'#d0cbbd','#ded9cd');grid.rotation.x=Math.PI/2;grid.position.z=-.19;scene.add(grid);
function geometry(data){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(data.positions),3));g.setIndex(new T.BufferAttribute(new Uint32Array(data.indices),1));g.computeVertexNormals();return g;}
function clear(group){const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});while(group.children.length)group.remove(group.children[0]);for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}
function fitView(){const d=Math.max(...dimensions),z=dimensions[2]*.38;orbit.target.set(0,0,z);camera.position.set(d*1.4,-d*1.9,z+d*1.35);camera.near=.1;camera.far=Math.max(1500,d*15);camera.updateProjectionMatrix();orbit.update();inverted=false;$('underside').setAttribute('aria-pressed','false');}
function showPiece(){
  if(!mesh)return;clear(modelGroup);clear(ghostGroup);variants.clear();const box=bounds(mesh);dimensions=box.size;modelGroup.position.set(-w*4,-l*4,0);
  const g=geometry(mesh),body=new T.Mesh(g,new T.MeshStandardMaterial({color:new T.Color(colour).convertSRGBToLinear(),roughness:.4,metalness:.03,flatShading:true}));body.castShadow=true;body.receiveShadow=true;modelGroup.add(body);
  const edges=new T.LineSegments(new T.EdgesGeometry(g,35),new T.LineBasicMaterial({color:'#1a2d54',transparent:true,opacity:.22}));modelGroup.add(edges);floor.visible=grid.visible=true;fitView();
}
function showSet(){
  if(!set){clear(modelGroup);clear(ghostGroup);floor.visible=grid.visible=true;$('preview-title').textContent='MODEL / WAITING FOR A SHAPE';return;}
  clear(modelGroup);clear(ghostGroup);variants.clear();dimensions=set.dimensions.map((n,i)=>n*(i===2?3.2:8));modelGroup.position.set(-dimensions[0]/2,-dimensions[1]/2,0);ghostGroup.position.copy(modelGroup.position);
  for(const v of set.variants){const placements=set.pieces.filter(p=>p.part.id===v.id),body=new T.InstancedMesh(geometry(v.mesh),new T.MeshStandardMaterial({color:new T.Color(palette[v.id]||colours[v.type]).convertSRGBToLinear(),roughness:.4,metalness:.02,flatShading:true}),placements.length);body.castShadow=true;body.receiveShadow=true;body.frustumCulled=false;variants.set(v.id,{body,placements});modelGroup.add(body);}
  for(const m of set.source){const ghost=new T.Mesh(geometry(m),new T.MeshBasicMaterial({color:'#6a7890',wireframe:true,transparent:true,opacity:.08,depthWrite:false}));ghostGroup.add(ghost);}
  $('layer').max=set.dimensions[2];$('layer').value=set.dimensions[2];$('explode').value=0;updateAssembly();floor.visible=grid.visible=true;fitView();
}
function updateAssembly(){
  if(!set||mode!=='set')return;const explode=+$('explode').value,limit=+$('layer').value,dummy=new T.Object3D();
  for(const {body,placements}of variants.values()){placements.forEach((p,i)=>{
    const m=placementTransform(p);dummy.position.set(m[9]+explode*(p.x*8-dimensions[0]/2)*.25,m[10]+explode*(p.y*8-dimensions[1]/2)*.25,m[11]+explode*(p.z*4+10));dummy.rotation.set(0,0,p.r*Math.PI/2);dummy.scale.setScalar(p.z<limit?1:0);dummy.updateMatrix();body.setMatrixAt(i,dummy.matrix);
  });body.instanceMatrix.needsUpdate=true;}
  ghostGroup.visible=$('ghost').checked;$('layer-value').textContent=limit>=set.dimensions[2]?'All':`${limit}/${set.dimensions[2]}`;
}
function resize(){const box=$('viewport').getBoundingClientRect();renderer.setSize(box.width,box.height);camera.aspect=box.width/box.height;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe($('viewport'));
function frame(){requestAnimationFrame(frame);orbit.update();renderer.render(scene,camera);}frame();
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function exportsEnabled(){document.querySelectorAll('[data-export]').forEach(b=>b.disabled=$('busy').hidden===false||(mode==='piece'?!pieceReady:!setReady));}
function startWorker(){worker=new Worker('worker.js');worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;if(data.status){if(p.revision===revision)$('busy-text').textContent=data.status;return;}pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result);};worker.onerror=()=>{for(const p of pending.values())p.reject(Error('The geometry worker stopped. Reload the page and try again.'));pending.clear();$('busy').hidden=true;exportsEnabled();};}startWorker();
function task(command,params){return new Promise((resolve,reject)=>{const id=++job;pending.set(id,{resolve,reject,revision});worker.postMessage({id,command,params});});}
function stopJobs(){revision++;worker.terminate();for(const p of pending.values())p.reject(Error('Cancelled'));pending.clear();startWorker();$('busy').hidden=true;exportsEnabled();}
function options(){return {size:+$('size').value,up:$('up').value,turn,shell,shaped:$('shaped').checked,clearance:+$('fit').value};}
async function buildPiece(){
  if(mode!=='piece')return;const rev=++revision;pieceReady=false;$('busy').hidden=false;exportsEnabled();
  try{const part=definition(type,w,l);w=part.w;l=part.l;updatePad();const result=await task('piece',{part,clearance:+$('fit').value});if(rev!==revision)return;mesh=result;pieceReady=true;showPiece();const size=bounds(mesh).size;
    $('part-name').replaceChildren(document.createTextNode(part.type[0].toUpperCase()+part.type.slice(1)),document.createElement('br'),document.createTextNode(`${w} × ${l}`));$('mm-size').textContent=size.slice(0,2).map(n=>n.toFixed(1)).join(' × ');$('mm-height').textContent=(part.h*3.2).toFixed(1);$('stud-count').textContent=studs(part).length;$('preview-title').textContent=`${type.toUpperCase()} / ${w} × ${l}`;
    $('detail-copy').textContent={brick:'A hollow body, top studs and underside tubes. A familiar starting point for your next idea.',plate:'One plate high. Use thin layers to add detail and tie neighbouring bricks together.',tile:'A smooth top for finishing surfaces, with a hollow underside for connecting to studs.',slope:'A sloping roof with a flat, studded rear row. Make roofs, wedges and softer silhouettes.',corner:'A three-stud L shape. Wrap around corners without filling the whole square.',round:'A single round stud and hollow cylindrical body. A little accent for towers and details.'}[type];status('Ready. Your piece is generated in millimetres.');
  }catch(error){if(rev===revision&&error.message!=='Cancelled')status(error.message,true);}finally{if(rev===revision){$('busy').hidden=true;exportsEnabled();}}
}
function schedulePiece(){revision++;pieceReady=false;exportsEnabled();clearTimeout(debounce);debounce=setTimeout(buildPiece,180);}
function markSetDirty(){if(pending.size)stopJobs();setReady=false;$('rebuild').disabled=!original;exportsEnabled();status('Settings changed. Build the set to update it.');}
async function buildSet(command='convert',extra={}){
  if(command==='convert'&&!original)return;const rev=++revision;setReady=false;$('busy').hidden=false;exportsEnabled();$('rebuild').disabled=true;
  try{const result=await task(command,{meshes:original,options:options(),...extra});if(rev!==revision)return;set=result;original=result.original;delete set.original;setReady=true;for(const v of set.variants)palette[v.id]??=colours[v.type];showSet();updateInventory();$('set-name').replaceChildren(document.createTextNode(filename(sourceName).replaceAll('-',' ')));$('preview-title').textContent=`${sourceName.toUpperCase()} / ${set.dimensions[0]} × ${set.dimensions[1]} STUDS`;
    const caveat=set.openColumns?` ${set.openColumns} open surface columns were sampled; use a closed model for best results.`:'';status(`${set.pieces.length} whole pieces, ready to explore.${caveat}`);
  }catch(error){if(rev===revision&&error.message!=='Cancelled')status(error.message,true);}finally{if(rev===revision){$('busy').hidden=true;$('rebuild').disabled=!original;exportsEnabled();}}
}
function updateInventory(){
  $('piece-count').textContent=set.pieces.length;$('variant-count').textContent=set.variants.length;$('inventory-label').textContent=`${set.variants.length} shapes`;$('connections').textContent=set.connections.groups===1?'One stud-connected group. Build from the bottom up.':`${set.connections.groups} separate stud-connected groups. Some details may need positioning or reinforcement.`;
  $('inventory').replaceChildren();for(const [i,v]of set.variants.entries()){
    const row=document.createElement('div');row.className='inventory-row';const input=document.createElement('input');input.type='color';input.value=palette[v.id];input.setAttribute('aria-label',`Colour for ${label(v)}`);input.oninput=()=>{palette[v.id]=input.value;variants.get(v.id)?.body.material.color.set(input.value).convertSRGBToLinear();};const text=document.createElement('span');text.textContent=label(v);const small=document.createElement('small');small.textContent=`PART ${String(i+1).padStart(2,'0')}`;text.append(small);const count=document.createElement('b');count.textContent=`×${v.quantity}`;row.append(input,text,count);$('inventory').append(row);
  }
}
function updatePad(){
  $('width').value=w;$('length').value=l;$('footprint').textContent=`${w} × ${l}`;const locked=['round','corner'].includes(type);$('width').disabled=locked;$('length').disabled=locked||type==='slope';
  document.querySelectorAll('#stud-pad button').forEach(b=>{const x=+b.dataset.x,y=+b.dataset.y,on=x<w&&y<l&&!(type==='corner'&&x===1&&y===1);b.classList.toggle('on',on);b.disabled=locked;b.setAttribute('aria-pressed',String(on));});
  $('shape-note').textContent=locked?'This familiar shape has a fixed footprint.':type==='slope'?'Slopes are two studs long. Choose the width.':'Tap a stud to size the whole rectangle.';
}
for(let y=0;y<8;y++)for(let x=0;x<8;x++){const b=document.createElement('button');b.dataset.x=x;b.dataset.y=y;b.setAttribute('aria-label',`${x+1} across, ${y+1} along`);b.onclick=()=>{w=x+1;l=type==='slope'?2:y+1;updatePad();schedulePiece();};b.onkeydown=e=>{const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(delta){e.preventDefault();document.querySelector(`#stud-pad [data-x="${Math.max(0,Math.min(7,x+delta[0]))}"][data-y="${Math.max(0,Math.min(7,y+delta[1]))}"]`)?.focus();}};$('stud-pad').append(b);}updatePad();
for(const hex of ['#275bd7','#e76640','#efb937','#6e9a7e','#e8e3d8','#7c68a8']){const b=document.createElement('button');b.style.background=hex;b.classList.toggle('selected',hex===colour);b.setAttribute('aria-label',`${hex} preview colour`);b.setAttribute('aria-pressed',String(hex===colour));b.onclick=()=>{colour=hex;document.querySelectorAll('#swatches button').forEach(n=>{n.classList.toggle('selected',n===b);n.setAttribute('aria-pressed',String(n===b));});modelGroup.children.find(o=>o.isMesh)?.material.color.set(hex).convertSRGBToLinear();};$('swatches').append(b);}
document.querySelectorAll('[data-shape]').forEach(b=>b.onclick=()=>{type=b.dataset.shape;document.querySelectorAll('[data-shape]').forEach(n=>{n.classList.toggle('selected',n===b);n.setAttribute('aria-pressed',String(n===b));});const d=definition(type,w,l);w=d.w;l=d.l;updatePad();schedulePiece();});
for(const id of ['width','length'])$(id).onchange=()=>{const n=+$(id).value;if(!Number.isInteger(n)||n<1||n>8){status('Choose 1–8 studs.',true);updatePad();return;}id==='width'?w=n:l=n;updatePad();schedulePiece();};
function setMode(next){
  if(next===mode)return;stopJobs();clearTimeout(debounce);mode=next;document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});document.querySelectorAll('.piece-only').forEach(e=>e.hidden=mode!=='piece');document.querySelectorAll('.set-only').forEach(e=>e.hidden=mode!=='set');
  $('headline').innerHTML=mode==='piece'?'A little building block,<br>a lot of potential.':'Your model.<br>A whole new way to build.';$('intro-copy').innerHTML=mode==='piece'?'Pick a shape. Tap a footprint.<br>Make something you can hold.':'From smooth surfaces to familiar pieces.<br>Keep the character. Build the rest.';
  if(mode==='piece'){pieceReady?showPiece():buildPiece();status('Piece studio. Choose a shape and footprint.');}else{showSet();status(set?'Your set is ready.':'Choose a model or try the lighthouse.');}exportsEnabled();resize();
}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('fit').oninput=()=>{$('fit-value').textContent=(+$('fit').value>=0?'+':'')+(+$('fit').value).toFixed(2);pieceReady=setReady=false;if(mode==='piece')schedulePiece();else markSetDirty();};
$('size').oninput=()=>{$('size-value').textContent=$('size').value;markSetDirty();};
for(const id of ['up','shaped'])$(id).onchange=markSetDirty;
$('turn').onclick=()=>{turn=(turn+1)%4;$('turn-value').textContent=`${turn*90}°`;markSetDirty();};
document.querySelectorAll('[data-fill]').forEach(b=>b.onclick=()=>{shell=b.dataset.fill==='shell';document.querySelectorAll('[data-fill]').forEach(n=>{n.classList.toggle('selected',n===b);n.setAttribute('aria-pressed',String(n===b));});markSetDirty();});
$('rebuild').onclick=()=>buildSet();$('demo').onclick=()=>{stopJobs();sourceName='Little lighthouse';$('source-name').textContent='Built-in closed lighthouse model';palette={};original=null;buildSet('demo');};
async function importFile(file){
  if(!file)return;if(file.size>25*1024*1024){status('Use a model smaller than 25 MB.',true);return;}const ext=file.name.split('.').pop().toLowerCase();if(!['stl','3mf','step','stp'].includes(ext)){status('Choose an STL, 3MF or STEP / STP file.',true);return;}
  stopJobs();setReady=false;original=null;exportsEnabled();$('rebuild').disabled=true;const rev=revision;status(`Reading ${file.name}…`);
  try{const bytes=new Uint8Array(await file.arrayBuffer());if(rev!==revision)return;sourceName=file.name;$('source-name').textContent=file.name;palette={};if(ext==='step'||ext==='stp')await buildSet('step',{bytes});else{original=ext==='stl'?readSTL(bytes):read3MF(bytes);await buildSet();}}catch(error){status(error.message,true);}
}
$('file').onchange=()=>{const file=$('file').files[0];$('file').value='';importFile(file);};for(const event of ['dragenter','dragover'])$('drop-zone').addEventListener(event,e=>{e.preventDefault();$('drop-zone').classList.add('dragging');});for(const event of ['dragleave','drop'])$('drop-zone').addEventListener(event,e=>{e.preventDefault();$('drop-zone').classList.remove('dragging');if(event==='drop')importFile(e.dataTransfer.files[0]);});
$('cancel').onclick=()=>{stopJobs();$('rebuild').disabled=!original;status('Cancelled. Choose another model or try again.');};$('reset-view').onclick=()=>{floor.visible=grid.visible=true;fitView();};
$('underside').onclick=()=>{inverted=!inverted;$('underside').setAttribute('aria-pressed',String(inverted));floor.visible=grid.visible=!inverted;const d=Math.max(...dimensions);camera.position.set(d*.8,-d*1.2,inverted?-d*1.5:d*1.5);orbit.target.set(0,0,dimensions[2]*.45);orbit.update();};
for(const id of ['explode','layer','ghost'])$(id).oninput=updateAssembly;
async function thumbnail(){
  const snapshot={explode:$('explode').value,layer:$('layer').value,ghost:$('ghost').checked,grid:grid.visible,floor:floor.visible,position:camera.position.clone(),target:orbit.target.clone(),inverted};
  if(mode==='set'){$('explode').value=0;$('layer').value=$('layer').max;$('ghost').checked=false;updateAssembly();}grid.visible=false;floor.visible=true;fitView();renderer.render(scene,camera);
  try{return await canvasThumbnail(renderer.domElement,'#eae7de');}finally{$('explode').value=snapshot.explode;$('layer').value=snapshot.layer;$('ghost').checked=snapshot.ghost;if(mode==='set')updateAssembly();grid.visible=snapshot.grid;floor.visible=snapshot.floor;camera.position.copy(snapshot.position);orbit.target.copy(snapshot.target);inverted=snapshot.inverted;$('underside').setAttribute('aria-pressed',String(inverted));orbit.update();renderer.render(scene,camera);}
}
document.querySelectorAll('[data-export]').forEach(b=>b.onclick=async()=>{
  const format=b.dataset.export;if(mode==='piece'?!pieceReady:!setReady)return;b.disabled=true;status('Preparing your download…');
  try{let blob,name;if(mode==='piece'){
    const part=definition(type,w,l);name=part.id+'.'+format;
    if(format==='stl')blob=new Blob([plateSTL(mesh)],{type:'model/stl'});else if(format==='3mf')blob=create3MF(mesh);else{blob=await createPackage({file:new File([create3MF(mesh)],part.id+'.3mf',{type:'model/3mf'}),title:label(part),author:'Xalies',generatorName:'Brick Foundry',sourceUrl:location.href.split('?')[0],summary:'Printable construction piece with a nominal 8 mm pitch.',settings:{part,clearance:+$('fit').value,colour},tags:['bricks','construction'],thumbnail:await thumbnail(),printNotes:{orientation:'Open underside on bed',fitAdjustmentMm:+$('fit').value}});}
  }else{
    name=filename(sourceName);if(format==='guide'){blob=new Blob([guideHTML(set,sourceName,options(),palette)],{type:'text/html'});name+='-assembly-guide.html';}
    else if(format==='assembly'){blob=assembled3MF(set,palette);name+='-assembled-reference.3mf';}
    else{blob=await exportSet(set,{name:sourceName,settings:options(),thumbnail:await thumbnail(),palette,meshvault:format==='mvpack'});name+=format==='mvpack'?'.mvpack':'-print-kit.zip';}
  }saveFile(blob,name);status(`${name} is ready. ${mode==='set'?'The print kit has individual pieces and their copy counts.':'Test a pair and tune the connection for your printer.'}`);
  }catch(error){status(error.message,true);}finally{exportsEnabled();}
});
buildPiece();
