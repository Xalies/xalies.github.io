// SPDX-License-Identifier: GPL-2.0-only
import { newDrawer, gridSize, binError, validateDrawer, splitBaseplate } from './drawer.js?v=20261009-planner';
import { buildPart } from './build-part.js?v=20261009-planner';
import { setDrawerParts, showWorkspace } from './generator.js?v=20261009-planner';
import { saveFile } from '../shared/mvpack.js';
const $ = id => document.getElementById(id);
const drawerForm=$('drawer-settings'), binForm=$('bin-settings'), svg=$('drawer-grid'), status=$('planner-status');
const storageKey='meshvault-gridfinity-drawer-v1', history=[];
let plan=newDrawer(), selected=null, tool='select', drag=null, three=null, controller=null;
try {const stored=localStorage.getItem(storageKey);if(stored)plan=validateDrawer(JSON.parse(stored));} catch { $('save-status').textContent='The saved layout could not be loaded. Open a saved file or start a new layout.'; }
const clone=value=>structuredClone(value);
function save() {
  try{localStorage.setItem(storageKey,JSON.stringify(plan));$('save-status').textContent='Saved in this browser. Download a layout file for a portable backup.';}
  catch{$('save-status').textContent='Browser storage is unavailable. Use Save layout to keep your work.';}
}
function commit(next, message='Layout updated.') {
  try{const valid=validateDrawer(next);history.push(clone(plan));if(history.length>50)history.shift();plan=valid;save();status.textContent=message;sync();render();return true;}
  catch(error){status.textContent=error.message;sync();render();return false;}
}
function sync() {
  for(const key of ['width','depth','height','clearance'])drawerForm.elements[key].value=plan.drawer[key];
  drawerForm.elements.title.value=plan.title;drawerForm.elements.author.value=plan.author;drawerForm.elements.magnets.checked=plan.magnets;
  const bin=plan.bins.find(b=>b.id===selected);
  if(bin)for(const key of ['name','w','d','h','compartments','colour','scoop','label']){
    const input=binForm.elements[key];if(input.type==='checkbox')input.checked=bin[key];else input.value=bin[key];
  }
  $('delete-layout-bin').disabled=$('rotate-layout-bin').disabled=!bin;
  $('undo-layout').disabled=!history.length;
}
function element(tag,attributes={},text) {
  const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));
  if(text!==undefined)node.textContent=text;return node;
}
function geometry() {
  const size=gridSize(plan.drawer);
  return {...size,x:20+(plan.drawer.width-size.width*42)/2,y:20+(plan.drawer.depth-size.depth*42)/2};
}
function drawGrid() {
  const grid=geometry(),included=new Set(plan.cells.map(c=>c.join(','))),screws=new Set(plan.screws.map(c=>c.join(',')));
  svg.setAttribute('viewBox',`0 0 ${plan.drawer.width+40} ${plan.drawer.depth+40}`);svg.replaceChildren();
  svg.append(element('rect',{x:20,y:20,width:plan.drawer.width,height:plan.drawer.depth,fill:'#100d16',stroke:'#77678d','stroke-width':1}));
  for(let y=0;y<grid.depth;y++)for(let x=0;x<grid.width;x++){
    const key=`${x},${y}`,cell=element('g',{'data-cell':key,...(tool!=='select'?{role:'button',tabindex:0,'aria-label':`Column ${x+1}, row ${y+1}`}:{})});
    cell.append(element('rect',{x:grid.x+x*42+1,y:grid.y+y*42+1,width:40,height:40,rx:2,fill:included.has(key)?'#292235':'#131019',stroke:included.has(key)?'#554761':'#292235','stroke-width':.7}));
    if(screws.has(key))cell.append(element('text',{x:grid.x+x*42+21,y:grid.y+y*42+25,'text-anchor':'middle',fill:'#cdbdff','font-size':11},'⊕'));
    svg.append(cell);
  }
  for(const source of plan.bins){
    const b=drag?.bin.id===source.id?drag.bin:source,invalid=drag?.bin.id===b.id&&binError(plan,b);
    const g=element('g',{'data-bin':b.id,role:'button','aria-label':`${b.name}, ${b.w} by ${b.d} cells`,tabindex:0});
    const x=grid.x+b.x*42+2,y=grid.y+b.y*42+2,w=b.w*42-4,d=b.d*42-4;
    g.append(element('rect',{x,y,width:w,height:d,rx:3,fill:b.colour,'fill-opacity':.23,stroke:invalid?'#ff879d':b.id===selected?'#ffffff':b.colour,'stroke-width':b.id===selected?2:1}));
    for(let i=1;i<b.compartments;i++)g.append(element('line',{x1:x+w*i/b.compartments,x2:x+w*i/b.compartments,y1:y+2,y2:y+d-2,stroke:b.colour,'stroke-width':.7,'stroke-opacity':.5}));
    g.append(element('text',{x:x+4,y:y+12,fill:'#f4f1fa','font-size':Math.min(9,w/(Math.min(b.name.length,18)*.55)),'pointer-events':'none'},b.name.length>18?b.name.slice(0,17)+'…':b.name));
    g.append(element('text',{x:x+4,y:y+23,fill:b.colour,'font-size':6,'pointer-events':'none'},`${b.w} × ${b.d} · ${b.h}u`));svg.append(g);
  }
  svg.append(element('text',{x:20,y:12,fill:'#b8afc5','font-size':8},`${plan.drawer.width} mm`));
  svg.append(element('text',{x:20,y:plan.drawer.depth+33,fill:'#b8afc5','font-size':7},`${plan.drawer.depth} mm deep · 42 mm pitch`));
}
function render() {
  drawGrid();const grid=geometry(),used=plan.bins.reduce((n,b)=>n+b.w*b.d,0);
  $('drawer-size').textContent=`${grid.width} × ${grid.depth} cells · ${(plan.drawer.width-grid.width*42).toFixed(1)} mm / ${(plan.drawer.depth-grid.depth*42).toFixed(1)} mm total edge space`;
  $('drawer-summary').textContent=`${plan.bins.length} bins · ${used} / ${plan.cells.length} cells used · ${plan.screws.length} drawer fixings`;
  $('layout-bin-count').textContent=`(${plan.bins.length})`;
  const list=$('layout-bins');list.replaceChildren();
  for(const bin of plan.bins){const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.className='inventory-bin';button.setAttribute('aria-pressed',String(bin.id===selected));button.style.setProperty('--bin-colour',bin.colour);button.textContent=`${bin.name} · ${bin.w} × ${bin.d} × ${bin.h}u`;button.addEventListener('click',()=>select(bin.id));li.append(button);list.append(li);}
  if(!plan.bins.length){const li=document.createElement('li');li.textContent='Your drawer is empty. Add your first bin.';li.className='small';list.append(li);}
  if(!$('drawer-3d').hidden)render3D();
}
function select(id){selected=id;tool='select';sync();render();toolButtons();}
function toolButtons(){document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));}
function binDraft(){return {id:Math.max(0,...plan.bins.map(b=>b.id))+1,name:binForm.elements.name.value.trim(),w:Number(binForm.elements.w.value),d:Number(binForm.elements.d.value),h:Number(binForm.elements.h.value),compartments:Number(binForm.elements.compartments.value),colour:binForm.elements.colour.value,scoop:binForm.elements.scoop.checked,label:binForm.elements.label.checked};}
function addBin(position) {
  if(!binForm.reportValidity())return;
  const bin=binDraft(),grid=geometry();
  if(position){bin.x=position[0];bin.y=position[1];}
  else {for(let y=0;y<grid.depth;y++)for(let x=0;x<grid.width;x++)if(bin.x===undefined&&!binError(plan,{...bin,x,y})){bin.x=x;bin.y=y;}}
  if(bin.x===undefined){status.textContent='No free position fits this bin. Check its size and drawer height.';return;}
  const next=clone(plan);next.bins.push(bin);if(commit(next,'Bin added. Drag it to move, or edit its details.')){selected=bin.id;sync();render();}
}
drawerForm.addEventListener('submit',e=>e.preventDefault());binForm.addEventListener('submit',e=>e.preventDefault());
drawerForm.addEventListener('change',()=>{
  if(!drawerForm.reportValidity())return;
  const next=clone(plan),old=gridSize(plan.drawer);
  for(const key of ['width','depth','height','clearance'])next.drawer[key]=Number(drawerForm.elements[key].value);
  next.title=drawerForm.elements.title.value.trim();next.author=drawerForm.elements.author.value.trim();next.magnets=drawerForm.elements.magnets.checked;
  const grid=gridSize(next.drawer);next.cells=next.cells.filter(c=>c[0]<grid.width&&c[1]<grid.depth);next.screws=next.screws.filter(c=>c[0]<grid.width&&c[1]<grid.depth);
  for(let y=0;y<grid.depth;y++)for(let x=0;x<grid.width;x++)if(x>=old.width||y>=old.depth)next.cells.push([x,y]);
  commit(next);
});
binForm.addEventListener('change',()=>{if(!selected||!binForm.reportValidity())return;const next=clone(plan),bin=next.bins.find(b=>b.id===selected);Object.assign(bin,{...binDraft(),id:bin.id,x:bin.x,y:bin.y});commit(next);});
$('add-layout-bin').addEventListener('click',()=>addBin());
$('delete-layout-bin').addEventListener('click',()=>{if(!selected)return;const next=clone(plan);next.bins=next.bins.filter(b=>b.id!==selected);selected=null;commit(next,'Bin removed.');});
function rotate(){if(!selected)return;const next=clone(plan),b=next.bins.find(b=>b.id===selected);[b.w,b.d]=[b.d,b.w];commit(next,'Bin footprint rotated.');}
$('rotate-layout-bin').addEventListener('click',rotate);
document.querySelectorAll('[data-tool]').forEach(button=>button.addEventListener('click',()=>{tool=button.dataset.tool;selected=null;sync();render();toolButtons();$('drawer-3d').hidden=true;svg.removeAttribute('hidden');$('toggle-layout-view').setAttribute('aria-pressed','false');status.textContent={select:'Select a bin, then drag or use arrow keys.',place:'Click a grid cell to place the bin shown in the inspector.',footprint:'Toggle baseplate cells. Cells underneath bins cannot be removed.',screws:'Click included cells to toggle centre screws for the drawer floor.'}[tool];}));
function cellAt(event){const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const p=point.matrixTransform(svg.getScreenCTM().inverse()),g=geometry();return [Math.floor((p.x-g.x)/42),Math.floor((p.y-g.y)/42)];}
svg.addEventListener('pointerdown',event=>{
  if(controller||event.button!==0)return;const cell=cellAt(event),g=geometry();if(cell[0]<0||cell[1]<0||cell[0]>=g.width||cell[1]>=g.depth)return;
  if(tool==='place'){addBin(cell);return;}
  if(tool==='footprint'||tool==='screws'){
    const next=clone(plan),key=tool==='screws'?'screws':'cells',index=next[key].findIndex(c=>c[0]===cell[0]&&c[1]===cell[1]);
    if(tool==='screws'&&!next.cells.some(c=>c[0]===cell[0]&&c[1]===cell[1])){status.textContent='Screws need an included baseplate cell.';return;}
    if(index>=0)next[key].splice(index,1);else next[key].push(cell);
    if(tool==='footprint')next.screws=next.screws.filter(c=>next.cells.some(p=>p[0]===c[0]&&p[1]===c[1]));commit(next);return;
  }
  const target=event.target.closest('[data-bin]');if(!target){select(null);return;}
  selected=Number(target.dataset.bin);const bin=plan.bins.find(b=>b.id===selected);drag={bin:clone(bin),original:clone(bin),cell};svg.setPointerCapture(event.pointerId);svg.focus();sync();drawGrid();
});
svg.addEventListener('pointermove',event=>{if(!drag)return;const cell=cellAt(event);drag.bin.x=drag.original.x+cell[0]-drag.cell[0];drag.bin.y=drag.original.y+cell[1]-drag.cell[1];drawGrid();});
svg.addEventListener('pointerup',()=>{if(!drag)return;const candidate=drag.bin,changed=candidate.x!==drag.original.x||candidate.y!==drag.original.y;drag=null;if(changed){const next=clone(plan);Object.assign(next.bins.find(b=>b.id===selected),candidate);commit(next,'Bin moved.');}else render();});
svg.addEventListener('pointercancel',()=>{drag=null;render();});
svg.addEventListener('keydown',event=>{
  if(controller)return;
  if(event.key==='Enter'||event.key===' '){const target=event.target.closest('[data-bin],[data-cell]');if(target){event.preventDefault();if(target.dataset.bin){select(Number(target.dataset.bin));svg.focus();}else{const rect=target.getBoundingClientRect(),key=target.dataset.cell;svg.dispatchEvent(new PointerEvent('pointerdown',{clientX:rect.x+rect.width/2,clientY:rect.y+rect.height/2,button:0}));svg.querySelector(`[data-cell="${key}"]`)?.focus();}return;}}
  if(!selected)return;const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(delta){event.preventDefault();const next=clone(plan),b=next.bins.find(b=>b.id===selected);b.x+=delta[0];b.y+=delta[1];commit(next,'Bin moved.');}else if(event.key==='Delete'){event.preventDefault();$('delete-layout-bin').click();}else if(event.key.toLowerCase()==='r'){event.preventDefault();rotate();}});
$('undo-layout').addEventListener('click',()=>{if(!history.length)return;plan=history.pop();selected=null;save();sync();render();status.textContent='Undone.';});
$('save-layout').addEventListener('click',()=>saveFile(new Blob([JSON.stringify(plan,null,2)],{type:'application/json'}),'drawer-layout.gridfinity.json'));
$('open-layout').addEventListener('click',()=>$('layout-file').click());
$('layout-file').addEventListener('change',async()=>{const file=$('layout-file').files[0];if(!file)return;try{if(file.size>2*1024*1024)throw new Error('Choose a layout file smaller than 2 MB.');const next=validateDrawer(JSON.parse(await file.text()));selected=null;commit(next,'Layout opened.');}catch(error){status.textContent=`Could not open layout: ${error.message}`;}finally{$('layout-file').value='';}});
$('new-layout').addEventListener('click',()=>{selected=null;commit(newDrawer(),'New layout. Use Undo to recover the previous layout.');});
$('toggle-layout-view').addEventListener('click',()=>{const show=$('drawer-3d').hidden;$('drawer-3d').hidden=!show;svg.toggleAttribute('hidden',show);$('toggle-layout-view').setAttribute('aria-pressed',String(show));if(show){try{render3D();status.textContent='Approximate assembled layout. Drag to orbit; generated models contain the detailed geometry.';}catch(error){$('drawer-3d').hidden=true;svg.removeAttribute('hidden');$('toggle-layout-view').setAttribute('aria-pressed','false');status.textContent=`3D preview unavailable: ${error.message}`;}}});
// shortcut: the assembled preview uses simple walls; use generated meshes if precise fit previews are needed.
function render3D(){
  const host=$('drawer-3d');
  if(!three){const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setClearColor('#181522');renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement);const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,1,5000),controls=new THREE.OrbitControls(camera,renderer.domElement);scene.add(new THREE.HemisphereLight(0xffffff,0x48405a,1));const light=new THREE.DirectionalLight(0xffffff,.8);light.position.set(100,500,200);scene.add(light);three={renderer,scene,camera,controls,group:null};controls.addEventListener('change',()=>renderer.render(scene,camera));new ResizeObserver(()=>{if(host.hidden)return;renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.render(scene,camera);}).observe(host);}
  const {scene,camera,controls,renderer}=three;
  if(three.group){scene.remove(three.group);three.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
  const group=new THREE.Object3D();three.group=group;scene.add(group);
  function box(w,h,d,x,y,z,colour,opacity=1){const material=new THREE.MeshLambertMaterial({color:colour,transparent:opacity<1,opacity}),mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);group.add(mesh);}
  const grid=geometry(),ox=-plan.drawer.width/2,oz=-plan.drawer.depth/2;
  box(plan.drawer.width,2,plan.drawer.depth,0,-2,0,'#30283c');
  for(const [x,y] of plan.cells)box(41,2,41,ox+grid.x-20+x*42+21,0,oz+grid.y-20+y*42+21,'#65517f');
  box(plan.drawer.width,plan.drawer.height,2,0,plan.drawer.height/2,oz,'#77678d',.22);box(2,plan.drawer.height,plan.drawer.depth,ox,plan.drawer.height/2,0,'#77678d',.22);
  for(const b of plan.bins){const w=b.w*42-1,d=b.d*42-1,h=b.h*7+3.75,x=ox+grid.x-20+(b.x+b.w/2)*42,z=oz+grid.y-20+(b.y+b.d/2)*42,base=plan.magnets||plan.screws.length?3.6:0;
    box(w,2,d,x,base+1,z,b.colour);box(w,h,1.5,x,base+h/2,z-d/2,b.colour);box(w,h,1.5,x,base+h/2,z+d/2,b.colour);box(1.5,h,d,x-w/2,base+h/2,z,b.colour);box(1.5,h,d,x+w/2,base+h/2,z,b.colour);for(let i=1;i<b.compartments;i++)box(1.5,h,d,x-w/2+w*i/b.compartments,base+h/2,z,b.colour);
  }
  renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();const distance=Math.max(plan.drawer.width,plan.drawer.depth)*1.6;camera.position.set(distance,distance*.9,distance);controls.target.set(0,0,0);controls.update();renderer.render(scene,camera);
}
$('planner-bed').addEventListener('submit',e=>e.preventDefault());
$('cancel-layout').addEventListener('click',()=>controller?.abort());
$('build-layout').addEventListener('click',async()=>{
  if(controller||!$('planner-bed').reportValidity())return;
  const snapshot=clone(plan),bed={width:Number($('planner-bed').elements.width.value),depth:Number($('planner-bed').elements.depth.value)};
  let sections;
  try{
    validateDrawer(snapshot);
    for(const bin of snapshot.bins){
      const w=bin.w*42-0.5,d=bin.d*42-0.5;
      if(!((w+10<=bed.width&&d+10<=bed.depth)||(d+10<=bed.width&&w+10<=bed.depth)))throw new Error(`${bin.name} does not fit this bed with 5 mm edge clearance. Reduce its size or use a larger bed.`);
    }
    sections=splitBaseplate(snapshot,bed);
  }catch(error){$('build-status').textContent=error.message;return;}
  const jobs=sections.map((settings,i)=>({settings,title:`${snapshot.title} · Baseplate ${i+1}`,quantity:1})),groups=new Map();
  for(const bin of snapshot.bins){const settings={part:'bin',width:bin.w,depth:bin.d,height:bin.h,chambers:bin.compartments,withLabel:bin.label?'center':'disabled',lip_style:'normal',fingerslide:bin.scoop,wall_thickness:.95,floor_thickness:.7,magnet_diameter:snapshot.magnets?6.5:0,screw_depth:0},key=JSON.stringify(settings);
    if(!groups.has(key))groups.set(key,{settings,title:bin.name,quantity:0});const item=groups.get(key);item.quantity++;if(item.title!==bin.name&&!item.title.includes(' / '))item.title+=' / '+bin.name;
  }
  for(const item of groups.values()){for(let n=item.quantity;n>0;n-=20)jobs.push({...item,quantity:Math.min(n,20)});}
  if(!jobs.length)return;
  controller=new AbortController();$('cancel-layout').disabled=false;
  const controls=[...$('drawer-planner').querySelectorAll('input,select,button')].filter(n=>n.id!=='cancel-layout'),disabled=controls.map(n=>n.disabled);controls.forEach(n=>n.disabled=true);
  const results=[],cache=new Map(),started=performance.now();let index=0;
  const tick=()=>{$('build-status').textContent=`Generating ${index+1} / ${jobs.length} · ${Math.floor((performance.now()-started)/1000)} seconds · stays on your device`;};
  const timer=setInterval(tick,1000);
  try{for(index=0;index<jobs.length;index++){tick();const job=jobs[index],key=JSON.stringify({...job.settings,layoutOrigin:undefined});if(!cache.has(key))cache.set(key,await buildPart(job.settings,controller.signal));if(controller.signal.aborted)throw new Error('Layout generation cancelled.');results.push({...cache.get(key),settings:job.settings,title:job.title,quantity:job.quantity});}
    await setDrawerParts(results,snapshot,bed);showWorkspace('parts');$('build-status').textContent=`Ready: ${jobs.length} designs. Choose STL or 3MF and export the print plates.`;
  }catch(error){$('build-status').textContent=error.message;}
  finally{clearInterval(timer);controls.forEach((n,i)=>n.disabled=disabled[i]);$('cancel-layout').disabled=true;controller=null;}
});
sync();render();
