// SPDX-License-Identifier: GPL-2.0-only
import { createSetPackage, create3MF, asciiSTLMesh, saveFile, canvasThumbnail } from '../shared/mvpack.js';
import { arrangePlates, meshBounds, plateMesh, plateSTL } from './plates.js';
const parts = [], bedForm = document.querySelector('#bed-settings'), setStatus = document.querySelector('#set-status');
const setExport = document.querySelector('#export-set'), zipExport = document.querySelector('#export-set-zip');
const plateLayouts = document.querySelector('#plate-layouts');
const author=document.querySelector('#author'), authorUrl=document.querySelector('#author-url'), donation=document.querySelector('#donation');
let exportingSet=false, building=false, dirty=false, platePlan=[], drawerProject=null;
export function bedSettings() {
  return { width: Number(bedForm.elements.bedWidth.value), depth: Number(bedForm.elements.bedDepth.value), gap: Number(bedForm.elements.spacing.value), rotate: bedForm.elements.rotate.checked };
}
function updatePlates() {
  platePlan = []; plateLayouts.replaceChildren(); setExport.disabled = zipExport.disabled = true;
  if (!parts.length) { renderPlates([],bedSettings());setStatus.textContent = 'No generated plates yet.'; return; }
  if (!bedForm.checkValidity()) { setStatus.textContent = 'Enter valid bed dimensions, spacing and quantities.'; return; }
  try {
    const bed = bedSettings(); platePlan = arrangePlates(parts, bed);
    renderPlates(platePlan,bed);
    const count = platePlan.reduce((n, plate) => n + plate.placements.length, 0);
    setStatus.textContent = `${dirty?'Layout changed · regenerate to update these plates. ':''}${count} parts across ${platePlan.length} ${platePlan.length === 1 ? 'plate' : 'plates'} · ${bed.width} × ${bed.depth} mm bed`;
    setExport.disabled = zipExport.disabled = exportingSet || building || dirty;
  } catch (error) { setStatus.textContent = error.message; }
}
function showSet() {
  const list = document.querySelector('#set-items'); list.replaceChildren();

  for (const part of parts) {
    const row = document.createElement('li'), label = document.createElement('span'), quantity = document.createElement('input'), remove = document.createElement('button');
    label.textContent = `${part.id}. ${part.title}`;
    quantity.type = 'number'; quantity.min = '1'; quantity.max = '20'; quantity.step = '1'; quantity.value = part.quantity;
    quantity.setAttribute('aria-label', `Quantity of design ${part.id}`);
    quantity.addEventListener('input', () => { part.quantity = Number(quantity.value); updatePlates(); });
    remove.type = 'button'; remove.className = 'secondary'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove design ${part.id}`);
    remove.addEventListener('click', () => { parts.splice(parts.indexOf(part), 1); showSet(); });
    row.append(label, quantity, remove); list.append(row);
  }
  updatePlates();
}
bedForm.addEventListener('input',()=>{if(!building)updatePlates();});
bedForm.addEventListener('submit',event=>event.preventDefault());
async function exportSet(meshvault) {
  if (building || dirty || exportingSet || !platePlan.length || setExport.disabled || !document.querySelector('#export-details').reportValidity()) return;
  const plan = platePlan, bed = bedSettings(), format = document.querySelector('#set-format').value;
  const canvases = [...plateLayouts.querySelectorAll('canvas')];
  const escape=value=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const credit={author:author.value.trim()||'Anonymous',authorUrl:authorUrl.value.trim()||undefined};
  credit.descriptionHtml=`<p>Gridfinity drawer designed by <strong>${escape(credit.author)}</strong>.</p>${donation.value.trim()?`<p><a href="${escape(donation.value.trim())}">Support ${escape(credit.author)}</a></p>`:''}`;
  const layout={...drawerProject,author:author.value.trim(),authorUrl:authorUrl.value.trim(),donation:donation.value.trim()};
  exportingSet = true;document.querySelector('#retry-layout').disabled=document.querySelector('#build-layout').disabled=true; setExport.disabled = zipExport.disabled = true; setStatus.textContent = 'Packaging your print plates…';
  try {
    const models = [];
    for (let i = 0; i < plan.length; i++) {
      const mesh = plateMesh(plan[i].placements), content = format === '3mf' ? create3MF(mesh) : new Blob([plateSTL(mesh)], { type: 'model/stl' });
      const file = new File([content], `gridfinity-plate-${String(i+1).padStart(2,'0')}.${format}`, { type: content.type });
      models.push({ file, title: `Gridfinity set · Plate ${i+1}`, generatorName: 'MeshVault Gridfinity Generator', ...credit, sourceUrl: 'https://www.meshvault.app/generators/gridfinity/', summary: `${plan[i].placements.length} arranged parts for a ${bed.width} × ${bed.depth} mm bed.`, tags: ['gridfinity', 'print-plate', 'generated'], printNotes: 'Print all parts flat on their bases. Verify bed size, clearances and supports in your slicer. This is an arranged model, not a printer-specific sliced project.', settings: { bed, plate: i+1, parts: plan[i].placements.map(item => ({ design: item.part.id, title: item.part.title, copy: item.copy, xMm: item.x, yMm: item.y, rotationDegrees: item.rotated ? 90 : 0, settings: item.part.settings })) }, thumbnail: meshvault ? await canvasThumbnail(canvases[i],'#100d16') : undefined });
    }
    const project = {
      title: drawerProject.title, ...credit, generatorName:'MeshVault Gridfinity Planner', sourceUrl:'https://www.meshvault.app/generators/gridfinity/', summary:'A planned drawer with its arranged print plates and editable layout.', settings:layout, tags:['gridfinity','drawer-layout'], documents:[{name:'drawer-layout.json',blob:new Blob([JSON.stringify(layout,null,2)],{type:'application/json'})}], thumbnail: meshvault ? await canvasThumbnail(canvases[0],'#100d16') : undefined
    };
    const blob = await createSetPackage(models, meshvault, project);
    saveFile(blob, `gridfinity-set.${meshvault ? 'mvpack' : 'zip'}`);
    setStatus.textContent = `Exported ${plan.length} print ${plan.length === 1 ? 'plate' : 'plates'} in one ${meshvault ? 'MeshVault package' : 'ZIP'}.`;
  } catch (error) { setStatus.textContent = `Set export failed: ${error.message}`; }
  finally { exportingSet = false;document.querySelector('#retry-layout').disabled=document.querySelector('#build-layout').disabled=false; setExport.disabled = zipExport.disabled = building || dirty || !platePlan.length; }
}
setExport.addEventListener('click', () => exportSet(true));
zipExport.addEventListener('click', () => exportSet(false));

async function readParts(snapshots) {
  return Promise.all(snapshots.map(async(snapshot,i)=>{
    const mesh=snapshot.mesh || asciiSTLMesh(await snapshot.stl.text());
    snapshot.mesh=mesh;
    return {...snapshot,mesh,bounds:meshBounds(mesh),id:i+1};
  }));
}
export async function setDrawerParts(snapshots, project, bed) {
  const ready=await readParts(snapshots);
  arrangePlates(ready,bed);
  parts.splice(0,parts.length,...ready);drawerProject=structuredClone(project);dirty=false;showSet();
}
function renderPlates(plan,bed) {
  plateLayouts.replaceChildren();
  document.querySelector('#plates-empty').hidden=!!plan.length;
  plan.forEach((plate, i) => {
      const figure = document.createElement('figure'), canvas = document.createElement('canvas'), caption = document.createElement('figcaption');
      const scale = 960 / Math.max(bed.width, bed.depth);
      canvas.width = Math.round(bed.width * scale); canvas.height = Math.round(bed.depth * scale);
      canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `Plate ${i+1}: ${plate.placements.length} parts on a ${bed.width} by ${bed.depth} mm bed`);
      const context = canvas.getContext('2d');
      context.fillStyle = '#181522'; context.fillRect(0,0,canvas.width,canvas.height);
      context.strokeStyle='#302839';context.lineWidth=1;context.beginPath();
      for(let x=0;x<bed.width;x+=42){context.moveTo(x*scale,0);context.lineTo(x*scale,canvas.height);}
      for(let y=0;y<bed.depth;y+=42){context.moveTo(0,canvas.height-y*scale);context.lineTo(canvas.width,canvas.height-y*scale);}
      context.stroke();
      for (const item of plate.placements) {
        context.fillStyle = item.part.settings.part === 'baseplate' ? '#6d54ae' : '#267b86';
        for (const rect of item.footprint) context.fillRect((item.x+rect.x)*scale, canvas.height-(item.y+rect.y+rect.depth)*scale, rect.width*scale, rect.depth*scale);
        context.fillStyle = '#fff'; context.font = '32px system-ui'; context.textAlign = 'center';
        const label = item.footprint[0];
        context.fillText(String(item.part.id), (item.x+label.x+label.width/2)*scale, canvas.height-(item.y+label.y+label.depth/2)*scale+5);
      }
      caption.textContent = `Plate ${i+1} · ${plate.placements.length} ${plate.placements.length === 1 ? 'part' : 'parts'} · ${bed.width} × ${bed.depth} mm`;
      figure.append(canvas, caption); plateLayouts.append(figure);
    });
}
export function markDrawerChanged(layout) {
  if(!drawerProject)return;
  const design=value=>JSON.stringify({...value,author:'',authorUrl:'',donation:''});
  dirty=design(layout)!==design(drawerProject);
  if(!building)updatePlates();
}
export function beginDrawerBuild(total) {
  building=true;setExport.disabled=zipExport.disabled=true;
  document.querySelector('#retry-layout').disabled=true;
  bedForm.querySelectorAll('input,select').forEach(input=>input.disabled=true);
  document.querySelector('#generation-panel').dataset.state='building';
  document.querySelector('#generation-panel').setAttribute('aria-busy','true');
  document.querySelector('#generation-title').textContent='Generating your designs';
  const progress=document.querySelector('#build-progress');progress.hidden=false;progress.max=total;progress.value=0;
  document.querySelector('#set-items').replaceChildren();
  renderPlates([],bedSettings());
  document.querySelector('#set-status').textContent='Building models locally. Completed designs will appear on the plates.';
  showWorkspace('parts');
}
export async function previewDrawerParts(snapshots,bed) {
  const ready=await readParts(snapshots),plan=arrangePlates(ready,bed);
  renderPlates(plan,bed);
  document.querySelector('#build-progress').value=snapshots.length;
  document.querySelector('#set-status').textContent=`Building · ${snapshots.length} designs ready · ${plan.length} print ${plan.length===1?'plate':'plates'} so far`;
}
export function finishDrawerBuild(message,success=false) {
  building=false;document.querySelector('#retry-layout').disabled=false;
  bedForm.querySelectorAll('input,select').forEach(input=>input.disabled=false);
  const panel=document.querySelector('#generation-panel');panel.dataset.state=success?'ready':'stopped';panel.setAttribute('aria-busy','false');
  document.querySelector('#generation-title').textContent=success?'Your print set is ready':'Generation stopped';
  document.querySelector('#build-status').textContent=message;
  showSet();
}
export function showWorkspace(mode) {
  document.querySelector('#drawer-planner').hidden=mode!=='planner';
  document.querySelector('#workspace').hidden=mode!=='parts';
  document.querySelector('#mode-planner').setAttribute('aria-pressed',String(mode==='planner'));
  document.querySelector('#mode-parts').setAttribute('aria-pressed',String(mode==='parts'));
  if(mode==='parts')document.querySelector('#workspace').focus({preventScroll:true});
}
document.querySelector('#mode-planner').addEventListener('click',()=>showWorkspace('planner'));
document.querySelector('#mode-parts').addEventListener('click',()=>showWorkspace('parts'));
