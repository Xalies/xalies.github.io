import { create3MF, createSetPackage, canvasThumbnail, saveFile, asciiSTLMesh } from '../shared/mvpack.js';
import { plateSTL, arrangePlates, meshBounds, plateMesh } from '../gridfinity/plates.js';
import { buildPart } from '../gridfinity/build-part.js?v=20261009-custom-source';
import { drawerParts, drawerFit, organiserParts, organiserBaseSource } from './geometry.js?v=20261009-drawer-bay-1';
import { cabinetParts, cabinetHardware, insertNames } from './cabinet.js?v=20261009-cabinet-3';
import { initCabinet } from './cabinet-ui.js?v=20261009-cabinet-3';
const form=document.querySelector('#settings'),creator=document.querySelector('#creator'),host=document.querySelector('#viewer'),status=document.querySelector('#status');
const view=document.querySelector('#view'),format=document.querySelector('#format'),pack=document.querySelector('#mvpack'),download=document.querySelector('#download-kit');
const sourceUrl='https://www.meshvault.app/generators/assembly/';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let renderer,scene,camera,controls,group,current,revision=0,timer,exporting=false,controller;
const cachedParts=new Map();
const cabinetUI=initCabinet(form,scheduleUpdate);
const printer=document.querySelector('#printer');
printer.addEventListener('submit',e=>e.preventDefault());printer.addEventListener('input',scheduleUpdate);
function linkError(value) {
  if(!value)return '';
  try {const u=new URL(value);if(value.length<=2048&&/^https:\/\//i.test(value)&&u.protocol==='https:'&&!u.username&&!u.password)return '';}catch{}
  return 'Use an HTTPS URL without a username or password, or leave it blank.';
}
try {const saved=JSON.parse(localStorage.getItem('meshvault-assembly-author')||'{}');for(const name of ['author','authorUrl','donation'])if(typeof saved[name]==='string'&&saved[name].length<=(name==='author'?100:2048)&&(name==='author'||!linkError(saved[name])))creator.elements[name].value=saved[name];}catch{}
const authorDetails=()=>({author:creator.elements.author.value.trim()||'Anonymous',authorUrl:creator.elements.authorUrl.value.trim()||undefined,donation:creator.elements.donation.value.trim()});
function kitInfo(s) {
  if(s.assembly==='cabinet') {
    const hardware=cabinetHardware(s);
    return {id:'modular-cabinet',name:'modular cabinet',dimensions:[s.columns*s.width,s.depth+Math.max(0,...s.bays.filter(b=>b.type!=='shelf').map(b=>(b.handle==='bar'?7:b.labelHolder?1.8:0)-s.clearance)),s.heights.reduce((a,b)=>a+b,0)],
      summary:`A ${s.columns}-column, ${s.heights.length}-row cabinet with individually configured drawers, organisers and open bays. Each bay prints separately and joins through recessed fasteners.`,
      before:'Print each frame on its rear panel, front opening upwards. Print each insert upright on its floor. Handles and label rails may need local supports; inspect the sliced preview. Frames are labelled by bay number in the files.',
      fit:`${hardware.joints} bay connections need ${hardware.screws} M3 × ${hardware.screwLength} mm countersunk screws and ${hardware.nuts} M3 hex nuts (hardware not printed or included). Each seam has two aligned 3.4 mm bores, countersinks and recessed nut pockets. Walls are ${s.thickness} mm thick; insert side clearance is ${(s.clearance/2).toFixed(2)} mm per side. Hardware pockets, sliding fit and stack strength have not been physically tested. This is a freestanding, light-duty organiser, with no load rating.`,
      steps:[
        '<strong>Print and identify.</strong> Bay numbers match the front elevation. Individual-part files use these numbers; arranged plates are mapped in printer-layout.json. Frames print rear-down; inserts print upright. Check supports for handles and label holders.',
        `<strong>Join the empty frames.</strong> Row 1 is the bottom row, bays run left to right. Recess M3 nuts in the left and bottom walls; insert countersunk screws through the adjoining right and top walls. Use ${hardware.screwLength} mm screws. Work upwards and tighten gently until heads and nuts are flush.`,
        '<strong>Fit the inserts.</strong> Remove burrs, check the fasteners are flush, and slide each insert along its guides. For a tight fit, increase clearance and regenerate the insert. A Gridfinity tray accepts bins on its socket grid; check their height against the opening.',
        '<strong>Finish your station.</strong> Slide a 36 × 9 mm paper label into each holder from the top. Swap inserts only between matching bay sizes. Keep tall units stable and away from edges; these frames are not wall mounts or tested monitor supports.'
      ]};
  }
  if(s.assembly==='drawer') {
    const f=drawerFit(s),tray=s.insert==='tray';
    return {
      id:tray?'drawer-bay-open-tray':'drawer-bay',name:tray?'drawer bay with an open tray':'drawer bay',dimensions:[s.width,s.depth,s.height],
      summary:tray?'A storage bay with a shallow, removable open tray. It shares the same side guides and rear stop as the full-height drawer.':'A practical storage bay with a removable finger-pull drawer. Integrated side guides leave the middle of the storage space clear; there are no cross-beams through the drawer.',
      before:'Print the frame with its closed rear panel flat on the bed and its front opening pointing up. Print the insert upright on its closed base. These are the supplied print orientations; inspect the sliced models before printing.',
      fit:`Drawer Bay v1 interface for this ${s.width} × ${s.depth} × ${s.height} mm frame: insert footprint ${f.width.toFixed(2)} × ${f.depth.toFixed(2)} mm, ${s.thickness} mm walls and floor. Total width clearance is ${s.clearance} mm (${(s.clearance/2).toFixed(2)} mm per side). The full-height drawer has ${s.clearance} mm clearance beneath the roof. Both inserts rest on the same 2 mm-high side guides and stop at the rear wall. Choose the same frame dimensions and wall thickness when making another insert; tune clearance for your printer. This fit has not been physically tested.`,
      steps:[
        '<strong>Print in the shown orientations.</strong> Put the frame’s rear panel on the bed and the insert’s floor on the bed. Start with 0.2 mm layers and 3 perimeters.',
        '<strong>Prepare the sliding surfaces.</strong> Remove brim and first-layer burrs. Check the guides and insert edges before assembly; do not force a tight fit.',
        '<strong>Slide in the insert.</strong> Feed the insert through the front opening so its bottom rests on both side guides. Slide gently until it meets the rear wall.',
        '<strong>Use or swap.</strong> Pull the drawer out by its finger notch, or lift and pull the shallow tray. Both are intentionally removable. If tight, increase clearance and reprint only the insert using the same frame size.'
      ]
    };
  }
  return {
    id:'desk-organiser',name:'desk organiser',dimensions:[s.width,s.depth,s.height+3+(s.gridfinity?5:0)],
    summary:'A desk organiser with a carrier and individually removable, open-top trays. The exposed tray rims sit 3 mm above the carrier for lifting.',
    before:'Print the carrier and every tray upright on their closed bases, with the openings facing up. The print preview shows orientations only; arrange parts on your printer bed.',
    fit:`Total clearance is ${s.clearance} mm across each tray’s width and depth (${s.clearance/2} mm per side within its bay). Tray wall and floor thickness: ${s.thickness} mm. Dry-fit a tray before printing the full set. Increase clearance if tight; do not glue removable trays.${s.gridfinity?' The carrier has a built-in '+((s.width+.5)/42)+' × '+((s.depth+.5)/42)+' Gridfinity underside on a 42 mm pitch. Test its fit on your baseplate; this does not include a stacking lip.':''}`,
    steps:[
      '<strong>Print upright.</strong> Print one carrier and one of every tray. Start with 0.2 mm layers and 3 perimeters; check the sliced walls and floors.',
      '<strong>Check the fit.</strong> Remove any brim and first-layer burrs. Dry-fit one tray in the carrier without forcing it.',
      '<strong>Place the trays.</strong> Lower the trays side by side into the carrier, with their openings facing up. Their rims remain exposed for lifting.',
      '<strong>Make it yours.</strong> Lift trays out to sort or carry small parts. Keep the trays removable; do not glue them into the carrier.'
    ]
  };
}
function render(){renderer.render(scene,camera);}
function resetView(){
  const bounds=new THREE.Box3().setFromObject(group),centre=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  const distance=Math.max(size.x,size.y,size.z)*(form.elements.assembly.value==='cabinet'?1.2:1.6)/Math.min(1,camera.aspect);
  camera.position.set(centre.x+distance,centre.y+distance*.65,centre.z+distance);controls.target.copy(centre);controls.update();render();
}
function showView(mode,design,reset=true){
  if(group){scene.remove(group);group.children.forEach(m=>{m.geometry.dispose();m.material.dispose();});}
  group=new THREE.Group();scene.add(group);
  let cursor=0;
  const packed=mode==='print'&&design.plates;
  (packed||design.items).forEach((part,partIndex)=>{
    const plateColumns=packed?Math.ceil(Math.sqrt(packed.length)):1,offsetY=packed?Math.floor(partIndex/plateColumns)*(design.bed.depth+24):0;
    if(packed)cursor=(partIndex%plateColumns)*(design.bed.width+24);
    const vertices=[];let minX=Infinity,minY=Infinity,maxX=-Infinity;
    for(let j=0;j<part.mesh.positions.length;j+=3){minX=Math.min(minX,part.mesh.positions[j]);maxX=Math.max(maxX,part.mesh.positions[j]);minY=Math.min(minY,part.mesh.positions[j+1]);}
    for(let j=0;j<part.mesh.positions.length;j+=3){
      const p=part.mesh.positions.slice(j,j+3);
      let xyz=packed?[p[0]+cursor,p[1]+offsetY,p[2]]:mode==='print'?[p[0]-minX+cursor,p[1]-minY,p[2]]:part.assembled(p);
      if(mode==='exploded')xyz=xyz.map((v,a)=>v+part.explode[a]);
      vertices.push(xyz[0],xyz[2],-xyz[1]);
    }
    if(packed){const w=design.bed.width,d=design.bed.depth,g=new THREE.BufferGeometry().setFromPoints([[cursor,0,-offsetY],[cursor+w,0,-offsetY],[cursor+w,0,-offsetY-d],[cursor,0,-offsetY-d],[cursor,0,-offsetY]].map(p=>new THREE.Vector3(...p)));group.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:0x8b7a9d})));}
    cursor+=packed?design.bed.width+24:maxX-minX+12;
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(part.mesh.indices);geometry.computeVertexNormals();
    group.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:part.colour,roughness:.72,metalness:0,flatShading:true})));
  });
  if(reset)resetView();else render();
}
const dataURL=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not prepare guide pictures.'));reader.readAsDataURL(blob);});
function guide(design,pictures){
  const {settings:s,items,credit}=design,k=kitInfo(s);
  return `<h2>${escape(s.title)} · Assembly guide</h2><p>${escape(k.summary)} Designed by <strong>${escape(credit.author)}</strong> using <a href="${sourceUrl}">Modular Storage Designer</a>.</p>
<figure><img src="${pictures.assembled}" alt="Assembled ${k.name}" width="1280" height="720"><figcaption>Finished arrangement · ${k.dimensions.join(' × ')} mm overall.</figcaption></figure>
${s.assembly==='cabinet'?`<h3>Bay layout</h3><table><thead><tr><th>Bay</th><th>Name</th><th>Contents</th><th>Row height</th></tr></thead><tbody>${s.bays.map((b,i)=>`<tr><td>${i+1}</td><td>${escape(b.label)}</td><td>${insertNames[b.type]}${b.type==='divided'?` · ${b.across} × ${b.deep} compartments`:''}</td><td>${s.heights[Math.floor(i/s.columns)]} mm</td></tr>`).join('')}</tbody></table>`:''}
<h3>Your customised kit</h3><p>${escape(k.fit)}</p><table><thead><tr><th>Part</th><th>Quantity</th><th>Print orientation</th></tr></thead><tbody>${items.map(p=>`<tr><td>${escape(p.label)}</td><td>1</td><td>${p.id.endsWith('drawer-frame')?'Rear panel on bed, front opening up':'Upright, open side up'}</td></tr>`).join('')}</tbody></table>
<h3>Before assembly</h3><p>${escape(k.before)} Start with <strong>0.2 mm layers, 3 perimeters and 20% infill</strong>, using a calibrated filament profile. Check every part in your slicer. These files are models, not sliced printer projects.</p>
<figure><img src="${pictures.print}" alt="Separate pieces in their print orientations" width="1280" height="720"><figcaption>${design.plates?`Arranged on ${design.bed.width} × ${design.bed.depth} mm beds with 5 mm spacing. Check printer Z clearance: rear-down frames are ${s.depth} mm tall.`:'Print orientations only, not a packed printer-bed layout. Arrange pieces on your own printer’s bed.'}</figcaption></figure>
<h3>Put it together</h3><ol>${k.steps.map(step=>`<li>${step}</li>`).join('')}</ol>
<figure><img src="${pictures.exploded}" alt="Exploded ${k.name} showing the separate parts" width="1280" height="720"><figcaption>Exploded view · coloured parts show how the kit fits together.</figcaption></figure>
<h3>Fit and use</h3><p>${escape(k.fit)} This is an untested light-duty design without a rated load. Verify the printed assembly before placing anything heavy, hot or valuable on it.</p>
<h3>Keep the context</h3><p>Your <a href="https://www.meshvault.app/generator/">MeshVault .mvpack</a> keeps all ${items.length} parts in one project with this illustrated description, a three-image gallery, an offline guide, a parts list and the generation settings.</p><p>${credit.authorUrl?`<a href="${escape(credit.authorUrl)}">About ${escape(credit.author)}</a> · `:''}${credit.donation?`<a href="${escape(credit.donation)}">Support ${escape(credit.author)}</a> · `:''}<a href="https://www.meshvault.app/">Learn about MeshVault</a> · <a href="https://buymeacoffee.com/xalies">Support this designer</a></p>`;
}
function printNotes(s){const k=kitInfo(s);return {material:'Use a calibrated PLA or PETG profile',layerHeightMm:.2,perimeters:3,infillPercent:20,supports:k.before,assembly:k.steps.map(step=>step.replace(/<[^>]*>/g,'')).join(' '),loadRating:'Untested light-duty design; no rated load.'};}
function packageContents(design){if(design.plates&&document.querySelector('#arranged-export').checked)return `modular-cabinet.mvpack\n${design.plates.map(p=>'├── '+p.id+'.'+format.value).join('\n')}\n├── meshvault.models.json\n├── images/ (16:9 PNGs)\n└── documents/ (guide, parts, settings, plate layout)`;return `${kitInfo(design.settings).id}.mvpack\n${design.items.map(p=>'├── '+p.id+'.'+format.value).join('\n')}\n├── meshvault.models.json\n├── images/ (16:9 PNGs)\n└── documents/ (guide, parts, settings)`;}
async function update(){
  const version=++revision;controller?.abort();controller=new AbortController();const signal=controller.signal;current=null;pack.disabled=download.disabled=true;
  if(!form.checkValidity()||(form.elements.assembly.value==='cabinet'&&!printer.checkValidity())||!creator.checkValidity()||!form.elements.title.value.trim()){status.textContent='Enter valid dimensions, a design name and optional HTTPS author links.';document.querySelector('#description').replaceChildren();return;}
  try {
    let settings=Object.fromEntries([...new FormData(form)].map(([k,v])=>[k,['title','assembly','insert'].includes(k)?v.trim():Number(v)]));
    if(settings.assembly==='cabinet')settings={...settings,...cabinetUI.snapshot(),moduleInterface:'cabinet-bay-v1'};
    settings.gridfinity=settings.assembly==='organiser'&&form.elements.gridfinity.checked;
    if(settings.assembly==='drawer')settings.moduleInterface=drawerFit(settings).interface;
    const design={settings,items:settings.assembly==='cabinet'?cabinetParts(settings):settings.assembly==='organiser'?organiserParts(settings):drawerParts(settings),credit:authorDetails()};
    if(settings.gridfinity)design.items[0].source=organiserBaseSource(settings);
    for(const part of design.items.filter(p=>p.source)) {
      status.textContent=`Building ${part.label.toLowerCase()} in your browser…`;
      if(cachedParts.get(part.id)?.source!==part.source) {
        const result=await buildPart({part:'assembly'},signal,part.source);if(version!==revision)return;
        const mesh=asciiSTLMesh(await result.stl.text());if(version!==revision)return;
        cachedParts.set(part.id,{source:part.source,mesh});
      }
      part.mesh=cachedParts.get(part.id).mesh;
    }
    if(settings.assembly==='cabinet'){
      design.bed={width:Number(document.querySelector('#bed-width').value),depth:Number(document.querySelector('#bed-depth').value),gap:5,rotate:true};
      const plan=arrangePlates(design.items.map(p=>({...p,title:p.label,quantity:1,bounds:meshBounds(p.mesh)})),design.bed);
      design.plates=plan.map((plate,i)=>({id:`plate-${i+1}`,label:`Print plate ${i+1}`,colour:['#b7a0e5','#f4cc68','#8cd6b6','#9ab9e6'][i%4],mesh:plateMesh(plate.placements),placements:plate.placements.map(p=>({part:p.part.id,x:p.x,y:p.y,rotated:p.rotated}))}));
      settings.printer=design.bed;document.querySelector('#plate-summary').textContent=`${design.items.length} parts · ${plan.length} plates · frames print ${settings.depth} mm tall`;
    }
    showView(view.value,design);
    const position=camera.position.clone(),target=controls.target.clone(),pictures={},gallery=[];
    for(const mode of ['assembled','exploded','print']){
      showView(mode,design);const blob=await canvasThumbnail(renderer.domElement);if(version!==revision)return;
      pictures[mode]=await dataURL(blob);gallery.push({name:`${mode}.png`,blob});if(version!==revision)return;
    }
    showView(view.value,design,false);camera.position.copy(position);controls.target.copy(target);controls.update();render();
    const descriptionHtml=guide(design,pictures),k=kitInfo(settings);
    current={...design,gallery,descriptionHtml};document.querySelector('#description').innerHTML=descriptionHtml;
    document.querySelector('#dimensions').textContent=`${k.dimensions.join(' × ')} mm assembled · ${design.items.length} parts${settings.gridfinity?' · Gridfinity base':''}`;
    document.querySelector('#assembly-steps').innerHTML=k.steps.map(step=>`<li>${step}</li>`).join('');document.querySelector('#assembly-fit').textContent=k.fit;
    document.querySelector('#package-contents').textContent=packageContents(design);
    download.textContent=design.plates&&document.querySelector('#arranged-export').checked?'Plates ZIP ↓':'Parts ZIP ↓';
    host.dataset.loaded='true';status.textContent=`Your ${design.items.length}-part kit and illustrated guide are ready.`;pack.disabled=download.disabled=exporting;
  }catch(error){if(version===revision)status.textContent=`Could not prepare the kit: ${error.message}`;}
}
function syncGrid(){
  const enabled=form.elements.assembly.value==='organiser'&&form.elements.gridfinity.checked;
  document.querySelector('#grid-size').hidden=!enabled;
  for(const [name,id] of [['width','grid-width'],['depth','grid-depth']]){form.elements[name].readOnly=enabled;if(enabled)form.elements[name].value=Number(document.getElementById(id).value)*42-.5;}
}
function configureAssembly(){
  const organiser=form.elements.assembly.value==='organiser',cabinet=form.elements.assembly.value==='cabinet';
  const ranges=organiser?{width:[120,240,.5,180],depth:[70,180,.5,120],height:[25,70,1,35],thickness:[1.6,4,.1,2.4],clearance:[.2,1.2,.05,.4]}:{width:[100,240,1,150],depth:[80,220,1,140],height:[40,100,1,65],thickness:[2,5,.1,3],clearance:[.2,1.2,.05,.6]};
  for(const [name,values] of Object.entries(ranges))['min','max','step','value'].forEach((key,i)=>form.elements[name][key]=values[i]);
  form.elements.title.value=organiser?'My desk organiser':cabinet?'My parts cabinet':'My drawer bay';
  if(cabinet){form.elements.thickness.min=4;form.elements.thickness.step=1;form.elements.thickness.value=4;form.elements.depth.value=150;}
  document.querySelector('#legacy-presets').hidden=cabinet;if(cabinet)cabinetUI.activate();else cabinetUI.draw();printer.hidden=!cabinet;view.querySelector('option[value=print]').textContent=cabinet?'Print plates':'Print orientations';
  form.elements.insert.disabled=organiser||cabinet;document.querySelector('#drawer-options').hidden=organiser||cabinet;
  form.elements.trays.disabled=form.elements.gridfinity.disabled=!organiser;form.elements.gridfinity.checked=false;
  document.querySelector('#organiser-options').hidden=!organiser;
  document.querySelector('#width-label').textContent=cabinet?'Column width':'Overall width';document.querySelector('#height-label').textContent=organiser?'Carrier height':cabinet?'Selected row height':'Bay height';document.querySelector('#thickness-label').textContent='Wall & floor';
  document.querySelector('#clearance-help').textContent=organiser?'Extra space across each tray’s width and depth, not per side.':'Extra space across the insert width and above a full-height drawer, not per side.';
  document.querySelector('#fit-help').textContent=cabinet?'Empty bays join with recessed M3 fasteners. Fit inserts after joining. Select a bay in the front elevation to customise it.':organiser?'Rims sit 3 mm above the carrier so each tray can be lifted out. Test one tray before printing a full kit.':'Guides run along the side walls, leaving the storage space clear. The rear wall stops the insert. Dry-fit before printing a full set.';
  document.querySelector('[data-preset=small]').textContent=organiser?'Compact':'Desk drawer';document.querySelector('[data-preset=wide]').textContent=organiser?'Wide':'Wide parts tray';
  syncGrid();clearTimeout(timer);update();
}
function scheduleUpdate(){status.textContent='Preparing your kit…';revision++;controller?.abort();current=null;pack.disabled=download.disabled=true;clearTimeout(timer);timer=setTimeout(update,180);}
try {
  renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#191420');host.append(renderer.domElement);
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(35,1,.1,5000);controls=new THREE.OrbitControls(camera,renderer.domElement);
  renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();
  scene.add(new THREE.HemisphereLight(0xffffff,0x655372,.9));const key=new THREE.DirectionalLight(0xfff1e3,.8);key.position.set(150,300,200);scene.add(key);const fill=new THREE.DirectionalLight(0xffffff,.35);fill.position.set(-200,150,-100);scene.add(fill);
  new ResizeObserver(()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();if(group)resetView();}).observe(host);controls.addEventListener('change',render);configureAssembly();
}catch(error){status.textContent=`3D studio unavailable: ${error.message}. Try a browser with WebGL enabled.`;}
form.addEventListener('submit',e=>e.preventDefault());creator.addEventListener('submit',e=>e.preventDefault());
form.addEventListener('input',()=>{syncGrid();scheduleUpdate();});form.elements.assembly.addEventListener('change',configureAssembly);
creator.addEventListener('input',()=>{for(const name of ['authorUrl','donation'])creator.elements[name].setCustomValidity(linkError(creator.elements[name].value.trim()));if(creator.checkValidity())try{localStorage.setItem('meshvault-assembly-author',JSON.stringify(Object.fromEntries(new FormData(creator))));}catch{}scheduleUpdate();});
view.addEventListener('change',()=>{if(current)showView(view.value,current);});document.querySelector('#reset-view').addEventListener('click',()=>{if(current)resetView();});format.addEventListener('change',()=>{if(current)document.querySelector('#package-contents').textContent=packageContents(current);});
document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{
  const wide=button.dataset.preset==='wide',organiser=form.elements.assembly.value==='organiser',values=organiser?(wide?[220,150,45]:[180,120,35]):(wide?[210,160,50]:[150,140,65]);
  if(!organiser)form.elements.insert.value=wide?'tray':'drawer';
  ['width','depth','height'].forEach((name,i)=>form.elements[name].value=values[i]);document.querySelector('#grid-width').value=wide?'5':'4';document.querySelector('#grid-depth').value=wide?'4':'3';syncGrid();clearTimeout(timer);update();
}));
async function exportKit(meshvault){
  const snapshot=current;if(!snapshot||exporting)return;exporting=true;pack.disabled=download.disabled=true;
  try {
    const k=kitInfo(snapshot.settings),credit=snapshot.credit,notes=printNotes(snapshot.settings);
    const offline=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(snapshot.settings.title)} · Assembly guide</title><style>body{font:16px/1.6 system-ui;max-width:1000px;margin:32px auto;padding:0 20px}img{max-width:100%;height:auto}figure{margin:24px 0}table{border-collapse:collapse;width:100%}th,td{padding:10px;border:1px solid #ccc;text-align:left}</style><body>${snapshot.descriptionHtml}</body></html>`;
    const documents=[{name:'assembly-guide.html',blob:new Blob([offline],{type:'text/html'})},{name:'parts-list.csv',blob:new Blob(['Part,Quantity\n'+snapshot.items.map(p=>`${p.label},1\n`).join('')],{type:'text/csv'})}];
    if(snapshot.plates){documents.push({name:'printer-layout.json',blob:new Blob([JSON.stringify({bed:snapshot.bed,plates:snapshot.plates.map(p=>({id:p.id,placements:p.placements}))},null,2)],{type:'application/json'})});const hardware=cabinetHardware(snapshot.settings);documents[1].blob=new Blob(['Part,Quantity\n'+snapshot.items.map(p=>`${p.label},1\n`).join('')+`M3 x ${hardware.screwLength} mm countersunk screw,${hardware.screws}\nM3 hex nut,${hardware.nuts}\n`],{type:'text/csv'});}
    const arranged=!!snapshot.plates&&document.querySelector('#arranged-export').checked,exportItems=arranged?snapshot.plates:snapshot.items;
    const selectedFormat=format.value,cacheKey=selectedFormat+(arranged?'-plates':'-parts');snapshot.files??={};snapshot.files[cacheKey]??=exportItems.map(part=>{const content=selectedFormat==='3mf'?create3MF(part.mesh):new Blob([plateSTL(part.mesh)],{type:'model/stl'});return new File([content],`${part.id}.${selectedFormat}`,{type:content.type});});
    const shared={author:credit.author,authorUrl:credit.authorUrl,generatorName:'MeshVault Modular Storage Designer',exportDonationUrl:'https://buymeacoffee.com/xalies',sourceUrl,tags:['assembly',k.id,'generated'],packageInfo:`One ${k.name} project containing ${snapshot.items.length} parts. Print one of each included file.`};
    const models=exportItems.map((part,i)=>({...shared,file:snapshot.files[cacheKey][i],title:`${snapshot.settings.title} · ${part.label}`,summary:`${part.label} from a ${k.name} kit.`,printNotes:JSON.stringify({...notes,part:part.label,quantity:1}),settings:{...snapshot.settings,part:part.id,...(part.placements?{placements:part.placements}:{})}}));
    const project={...shared,title:snapshot.settings.title,summary:k.summary,descriptionHtml:snapshot.descriptionHtml,printNotes:JSON.stringify(notes),settings:snapshot.settings,thumbnail:snapshot.gallery[0].blob,gallery:snapshot.gallery,documents};
    saveFile(await createSetPackage(models,meshvault,project),`${k.id}.${meshvault?'mvpack':'zip'}`);status.textContent=meshvault?`One assembly project exported with ${exportItems.length} ${arranged?'print plates':'parts'}, an illustrated guide and a gallery.`:`${exportItems.length} ${arranged?'arranged print plates':'print-ready parts'} exported.`;
  }catch(error){status.textContent=`Export failed: ${error.message}`;}finally{exporting=false;pack.disabled=download.disabled=!current;}
}
pack.addEventListener('click',()=>exportKit(true));download.addEventListener('click',()=>exportKit(false));
