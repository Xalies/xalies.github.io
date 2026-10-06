import { demoAccount, create3MF, createSetPackage, canvasThumbnail, saveFile } from '../shared/mvpack.js';
import { plateSTL } from '../gridfinity/plates.js';
import { riserParts } from './geometry.js';
const form = document.querySelector('#settings'), host = document.querySelector('#viewer'), status = document.querySelector('#status');
const view = document.querySelector('#view'), format = document.querySelector('#format');
const pack = document.querySelector('#mvpack'), download = document.querySelector('#download-kit');
let renderer, scene, camera, controls, group, current, revision = 0, timer, exporting = false;
const sourceUrl = 'https://xalies.github.io/generators/assembly/';
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const printNotes = { material:'Use a calibrated PLA or PETG profile', layerHeightMm:.2, perimeters:3, infillPercent:20, supports:'All five pieces print flat; inspect your slicer preview.', assembly:'Dry-fit the rails, square the frames, place the deck, optionally bond joints with a suitable adhesive.', loadRating:'Untested light-duty prototype; no rated load.' };
function render() { renderer.render(scene,camera); }
function resetView() {
  const bounds = new THREE.Box3().setFromObject(group), centre = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
  const distance = Math.max(size.x,size.y,size.z) * 1.6 / Math.min(1,camera.aspect);
  camera.position.set(centre.x+distance,centre.y+distance*.65,centre.z+distance); controls.target.copy(centre); controls.update(); render();
}
function showView(mode, parts, reset = true) {
  if (group) { scene.remove(group); group.children.forEach(m=>{m.geometry.dispose();m.material.dispose();}); }
  group = new THREE.Group(); scene.add(group);
  const s = parts.settings, row = s.height+16;
  const positions = [[0,0],[s.depth+12,0],[0,row],[0,row+28],[0,row+56]];
  parts.items.forEach((part,i) => {
    const vertices = [];
    for(let j=0;j<part.mesh.positions.length;j+=3) {
      const p = part.mesh.positions.slice(j,j+3);
      let xyz = mode === 'print' ? [p[0]+positions[i][0],p[1]+positions[i][1],p[2]] : part.assembled(p);
      if(mode === 'exploded') xyz = xyz.map((n,a)=>n+part.explode[a]);
      vertices.push(xyz[0],xyz[2],-xyz[1]);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)); geometry.setIndex(part.mesh.indices); geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:part.colour,roughness:.72,metalness:0,flatShading:true})); group.add(mesh);
  });
  if(reset) resetView(); else render();
}
const dataURL = blob => new Promise((resolve,reject)=>{ const reader = new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error('Could not prepare guide pictures.')); reader.readAsDataURL(blob); });
function guide(s,pictures) {
  return `<h2>${escape(s.title)} · Assembly guide</h2>
<p>A five-piece, flat-printing <strong>display riser</strong> for a small desk display. The two cross rails locate the side frames; the removable top deck sits on their flat upper edges. Designed by <strong>${demoAccount.name}</strong> using <a href="${sourceUrl}">Assembly Studio</a>.</p>
<figure><img src="${pictures.assembled}" alt="Assembled display riser with mint side frames, copper rails and a pale top deck" width="1280" height="720"><figcaption>Finished arrangement · ${s.width+2*s.thickness} × ${s.depth} × ${s.height+4} mm overall.</figcaption></figure>
<h3>Your customised kit</h3><p>Clear inner width: <strong>${s.width} mm</strong>; frame thickness: <strong>${s.thickness} mm</strong>; total clearance across each rail slot: <strong>${s.clearance} mm</strong>. Rail section: 12 × 16 mm; deck thickness: 4 mm.</p>
<table><thead><tr><th>Part</th><th>Quantity</th><th>Role</th></tr></thead><tbody><tr><td>Side frame</td><td>2</td><td>Flat-printing trapezoidal sides with two through-slots each.</td></tr><tr><td>Cross rail</td><td>2</td><td>Slide through matching slots to space and align the frames.</td></tr><tr><td>Top deck</td><td>1</td><td>Rests level across the two frame tops.</td></tr></tbody></table>
<h3>Before assembly</h3><p>Print both frames lying on their broad faces, rails on their 12 mm-wide bases, and the deck flat. Start with <strong>0.2 mm layers, 3 perimeters and 20% infill</strong> using a calibrated filament profile. Check all five files in your slicer. These files contain models, not sliced printer projects.</p>
<figure><img src="${pictures.print}" alt="Five separated pieces laid flat in their print orientations" width="1280" height="720"><figcaption>Print orientations only, not a packed printer-bed layout. Arrange pieces on your own printer’s bed.</figcaption></figure>
<h3>Put it together</h3><ol><li><strong>Clean and test the fit.</strong> Remove burrs from the slot edges. Try one rail through one slot before applying adhesive; do not force it.</li><li><strong>Start with the left frame.</strong> Slide the front and rear rails through its two slots.</li><li><strong>Add the right frame.</strong> Slide it onto both rails with both frame bases on a flat surface. Centre the rails: approximately 2 mm should protrude beyond each outer frame face.</li><li><strong>Square and finish.</strong> Check that the frames are parallel, then centre the deck on top. For a permanent riser, bond the rail joints and the deck using an adhesive suitable for your filament, following its instructions.</li></ol>
<figure><img src="${pictures.exploded}" alt="Exploded view showing the two frames, two cross rails and the deck lifted above them" width="1280" height="720"><figcaption>Exploded view · mint = frames; copper = rails; pale = deck.</figcaption></figure>
<h3>Fit and use</h3><p>If rails bind, remove surface burrs or increase slot clearance and reprint the frames. If loose, reduce clearance or bond the joints after alignment. This is an <strong>untested light-duty prototype</strong>, without a rated load. Verify the printed assembly before placing anything heavy, hot or valuable on it.</p>
<h3>Keep the context</h3><p>Your <a href="https://xalies.github.io/generator/">MeshVault .mvpack</a> includes all five model files, this HTML description, a three-image gallery, an offline assembly guide, a parts list and the generation settings. The package declares a project and imports as one library item; its five parts remain inside with these shared instructions.</p><p><a href="https://xalies.github.io/meshvault/">Learn about MeshVault</a> · <a href="https://buymeacoffee.com/xalies">Support Assembly Studio</a></p>`;
}
async function update() {
  const version = ++revision; current = null; pack.disabled = download.disabled = true;
  if(!form.checkValidity() || !form.elements.title.value.trim()) { status.textContent='Enter a name and valid dimensions to continue.'; document.querySelector('#description').replaceChildren(); return; }
  try {
    const settings = Object.fromEntries([...new FormData(form)].map(([k,v])=>[k,k==='title'?v.trim():Number(v)]));
    const design = {settings,items:riserParts(settings)};
    showView(view.value,design);
    const position = camera.position.clone(), target = controls.target.clone(), pictures = {}, gallery = [];
    status.textContent='Preparing the illustrated guide…';
    for(const mode of ['assembled','exploded','print']) {
      showView(mode,design); const blob = await canvasThumbnail(renderer.domElement);
      if(version!==revision) return;
      pictures[mode] = await dataURL(blob); gallery.push({name:`${mode}.png`,blob});
      if(version!==revision) return;
    }
    showView(view.value,design,false); camera.position.copy(position); controls.target.copy(target); controls.update(); render();
    const descriptionHtml = guide(settings,pictures);
    current = {...design,gallery,descriptionHtml};
    document.querySelector('#description').innerHTML=descriptionHtml;
    document.querySelector('#dimensions').textContent=`${settings.width+2*settings.thickness} × ${settings.depth} × ${settings.height+4} mm assembled · 5 parts`;
    document.querySelector('#package-contents').textContent='display-riser.mvpack\n├── 01-left-frame.'+format.value+'\n├── 02-right-frame.'+format.value+'\n├── 03-front-rail.'+format.value+'\n├── 04-rear-rail.'+format.value+'\n├── 05-top-deck.'+format.value+'\n├── meshvault.models.json\n├── images/ (16:9 PNGs)\n└── documents/ (guide, parts, settings)';
    host.dataset.loaded='true'; status.textContent='Your five-piece kit and guide are ready.'; pack.disabled=download.disabled=exporting;
  } catch(error) { status.textContent=`Could not prepare the kit: ${error.message}`; }
}
try {
  renderer = new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setClearColor('#19231f'); host.append(renderer.domElement);
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(35,1,.1,5000); controls = new THREE.OrbitControls(camera,renderer.domElement);
  renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();
  scene.add(new THREE.HemisphereLight(0xffffff,0x566c5d,.9));
  const key = new THREE.DirectionalLight(0xfff1e3,.8); key.position.set(150,300,200); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff,.35); fill.position.set(-200,150,-100);scene.add(fill);
  new ResizeObserver(()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();if(group)resetView();}).observe(host);
  controls.addEventListener('change',render);
  update();
} catch(error) { status.textContent=`3D studio unavailable: ${error.message}. Try a browser with WebGL enabled.`; }
form.addEventListener('submit',e=>e.preventDefault());
form.addEventListener('input',()=>{revision++;current=null;pack.disabled=download.disabled=true;clearTimeout(timer);timer=setTimeout(update,180);});
view.addEventListener('change',()=>{if(current)showView(view.value,current);});
document.querySelector('#reset-view').addEventListener('click',()=>{if(current)resetView();});
format.addEventListener('change',()=>{if(current)document.querySelector('#package-contents').textContent=document.querySelector('#package-contents').textContent.replace(/\.(stl|3mf)/g,`.${format.value}`);});
document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{
  const values = button.dataset.preset==='wide' ? [180,140,80] : [120,100,65];
  ['width','depth','height'].forEach((name,i)=>form.elements[name].value=values[i]);clearTimeout(timer);update();
}));
async function exportKit(meshvault) {
  const snapshot=current;if(!snapshot||exporting)return;
  exporting=true;pack.disabled=download.disabled=true;
  try {
    const offline = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(snapshot.settings.title)} · Assembly guide</title><style>body{font:16px/1.6 system-ui;max-width:1000px;margin:32px auto;padding:0 20px}img{max-width:100%;height:auto}figure{margin:24px 0}table{border-collapse:collapse;width:100%}th,td{padding:10px;border:1px solid #ccc;text-align:left}</style><body>${snapshot.descriptionHtml}</body></html>`;
    const documents=[{name:'assembly-guide.html',blob:new Blob([offline],{type:'text/html'})},{name:'parts-list.csv',blob:new Blob(['Part,Quantity\nSide frame,2\nCross rail,2\nTop deck,1\n'],{type:'text/csv'})}];
    const selectedFormat=format.value;
    snapshot.files ??= {};
    snapshot.files[selectedFormat] ??= snapshot.items.map(part=>{
      const content=selectedFormat==='3mf'?create3MF(part.mesh):new Blob([plateSTL(part.mesh)],{type:'model/stl'});
      return new File([content],`${part.id}.${selectedFormat}`,{type:content.type});
    });
    const models=snapshot.items.map((part,i)=>{
      return {file:snapshot.files[selectedFormat][i],title:`${snapshot.settings.title} · ${part.label}`,author:demoAccount.name,authorUrl:'https://xalies.github.io/',generatorName:'Xalies Assembly Studio',exportDonationUrl:'https://buymeacoffee.com/xalies',sourceUrl,summary:`${part.label} from a five-piece display riser kit.`,tags:['assembly','display-riser','generated'],packageInfo:'Five-piece kit. Print one of each included file; duplicate frame and rail designs are intentionally supplied as separate named parts.',printNotes:JSON.stringify({...printNotes,part:part.label,quantity:1}),settings:{...snapshot.settings,part:part.id}};
    });
    const project={title:snapshot.settings.title,author:demoAccount.name,authorUrl:'https://xalies.github.io/',generatorName:'Xalies Assembly Studio',exportDonationUrl:'https://buymeacoffee.com/xalies',sourceUrl,summary:'A five-piece display riser, kept together as one assembly project.',tags:['assembly','display-riser','generated'],descriptionHtml:snapshot.descriptionHtml,packageInfo:'One project containing two frames, two rails and one deck. Print one of each included file.',printNotes:JSON.stringify(printNotes),settings:snapshot.settings,thumbnail:snapshot.gallery[0].blob,gallery:snapshot.gallery,documents};
    saveFile(await createSetPackage(models,meshvault,project),`display-riser.${meshvault?'mvpack':'zip'}`);
    status.textContent=meshvault?'One assembly project exported with five parts, an illustrated guide and a gallery.':'Five print-ready model files exported.';
  } catch(error) { status.textContent=`Export failed: ${error.message}`; }
  finally {exporting=false;pack.disabled=download.disabled=!current;}
}
pack.addEventListener('click',()=>exportKit(true));download.addEventListener('click',()=>exportKit(false));
