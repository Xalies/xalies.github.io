import {newModule,newSystem,moduleNames,systemLayout,systemInfo} from './system.js?v=20261010-latch';
export function initSystem(form,changed){
  let plan=newSystem(),selected=1,nextId=4,scale=1,tool='move',drag;
  const panel=document.querySelector('#system-options'),canvas=document.querySelector('#system-plan'),fields={};
  for(const key of ['label','kind','widthUnits','depthUnits','heightUnits','x','gridBase','gridTop','pattern','across','deep','insert','holeDiameter','rightInsert','rightHoleDiameter','sidePanels','drawerLatch','labelHolder','leftAccessory','rightAccessory'])fields[key]=document.getElementById('module-'+key);
  const current=()=>plan.modules.find(m=>m.id===selected);
  const viewport=document.querySelector('#system-viewport'),host=document.querySelector('#viewer'),toggle=document.querySelector('#toggle-system-view');
  function showLayout(){document.body.dataset.systemView='layout';toggle.textContent='3D preview';toggle.setAttribute('aria-pressed','false');}
  showLayout();
  toggle.addEventListener('click',()=>{const three=document.body.dataset.systemView!=='three';document.body.dataset.systemView=three?'three':'layout';toggle.textContent=three?'Module layout':'3D preview';toggle.setAttribute('aria-pressed',String(three));});
  for(const button of document.querySelectorAll('[data-module-tool]'))button.addEventListener('click',()=>{tool=button.dataset.moduleTool;showLayout();canvas.dataset.tool=tool;for(const b of document.querySelectorAll('[data-module-tool]'))b.setAttribute('aria-pressed',String(b===button));});
  canvas.dataset.tool=tool;
  function movingIds(id){const ids=new Set([id]);for(let i=0;i<plan.modules.length;i++)for(const m of plan.modules)if(ids.has(m.support))ids.add(m.id);return ids;}
  function move(id,delta,support){
    if(!delta&&support===undefined)return;
    const ids=movingIds(id),candidate={modules:plan.modules.map(m=>({...m,x:m.x+(ids.has(m.id)?delta:0),support:m.id===id&&support!==undefined?support:m.support}))};
    try{systemLayout({...candidate,clearance:Number(form.elements.clearance.value)});plan=candidate;draw();changed();}
    catch(error){draw();document.querySelector('#system-help').textContent='Move cancelled: '+error.message;}
    canvas.querySelector(`[data-module="${id}"]`)?.focus({preventScroll:true});
  }
  canvas.addEventListener('pointerdown',e=>{
    const button=e.target.closest('[data-module]');if(!button||e.button!==0||!e.isPrimary||drag)return;
    selected=Number(button.dataset.module);draw();canvas.querySelector(`[data-module="${selected}"]`).focus({preventScroll:true});
    if(tool!=='move')return;
    let layout;try{layout=systemLayout({...plan,clearance:Number(form.elements.clearance.value)});}catch{return;}
    e.preventDefault();drag={id:selected,start:e.clientX,startY:e.clientY,delta:0,scale,ids:movingIds(selected),layout};canvas.setPointerCapture(e.pointerId);
  });
  function clearGhost(){for(const b of canvas.querySelectorAll('[data-module]')){b.style.transform='';b.classList.remove('drop-target');}}
  canvas.addEventListener('pointermove',e=>{
    if(!drag)return;drag.delta=Math.round((e.clientX-drag.start)/(42*drag.scale));const dy=e.clientY-drag.startY,m=drag.layout.find(m=>m.id===drag.id);
    drag.support=undefined;clearGhost();
    if(Math.abs(dy)>20){
      const bottom=m.bottom-dy/drag.scale,x=m.x+drag.delta;
      const targets=drag.layout.filter(p=>!drag.ids.has(p.id)&&p.kind==='drawer'&&p.gridTop&&x<p.x+p.widthUnits&&x+m.widthUnits>p.x&&Math.abs(bottom-(p.bottom+p.height+5))<=Math.max(18,24/drag.scale));
      targets.sort((a,b)=>Math.abs(bottom-a.bottom-a.height-5)-Math.abs(bottom-b.bottom-b.height-5));
      drag.support=targets[0]?.id??0;
      if(targets.length)canvas.querySelector(`[data-module="${targets[0].id}"]`).classList.add('drop-target');
      document.querySelector('#system-help').textContent=targets.length?`Release to stack on ${targets[0].label||'module '+targets[0].id}.`:'Release to place on the desk.';
    }
    for(const button of canvas.querySelectorAll('[data-module]'))if(drag.ids.has(Number(button.dataset.module)))button.style.transform=`translate(${drag.delta*42*drag.scale}px,${Math.abs(dy)>20?dy:0}px)`;
  });
  function finish(e,cancel=false){if(!drag)return;const pending=drag;drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);clearGhost();if(!cancel)move(pending.id,pending.delta,pending.support);else draw();}
  canvas.addEventListener('pointerup',e=>finish(e));canvas.addEventListener('pointercancel',e=>finish(e,true));canvas.addEventListener('lostpointercapture',e=>finish(e,true));
  canvas.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&drag){drag=null;clearGhost();draw();return;}
    if(tool!=='move'||!['ArrowLeft','ArrowRight'].includes(e.key)||!e.target.closest('[data-module]'))return;e.preventDefault();move(Number(e.target.closest('[data-module]').dataset.module),e.key==='ArrowLeft'?-1:1);
  });
  new ResizeObserver(()=>{if(canvas.clientWidth&&canvas.clientHeight&&!drag)draw();}).observe(canvas);
  function draw(){
    const enabled=form.elements.assembly.value==='system';
    const destination=enabled&&document.body.dataset.step!=='print'?viewport:document.querySelector('#preview-3d-slot');if(host.parentElement!==destination)destination.append(host);panel.hidden=!enabled;panel.querySelector('fieldset').disabled=!enabled;document.querySelector('#system-planner').hidden=!enabled;
    const m=current();
    document.querySelector('#module-heading').textContent=`Module ${m.id} · ${moduleNames[m.kind]}`;
    for(const [key,input] of Object.entries(fields))input.type==='checkbox'?input.checked=m[key]:input.value=m[key];
    fields.gridTop.disabled=m.kind!=='drawer';
    for(const key of ['across','deep'])fields[key].disabled=m.kind!=='drawer';
    for(const [type,diameter] of [['insert','holeDiameter'],['rightInsert','rightHoleDiameter']]){fields[type].disabled=m.kind!=='station';fields[diameter].disabled=m.kind!=='station'||m[type]!=='holes';}
    fields.drawerLatch.disabled=fields.sidePanels.disabled=fields.labelHolder.disabled=m.kind!=='drawer';
    for(const side of ['left','right'])fields[side+'Accessory'].disabled=m.kind!=='drawer'||!['both',side].includes(m.sidePanels);
    for(const key of ['gridTop','across','deep','insert','holeDiameter','rightInsert','rightHoleDiameter','sidePanels','drawerLatch','labelHolder','leftAccessory','rightAccessory'])fields[key].closest('label').hidden=fields[key].disabled;
    fields.across.closest('.fields').hidden=m.kind!=='drawer';
    document.querySelector('#accessory-help').hidden=m.kind!=='drawer'||m.sidePanels==='none';
    fields.leftAccessory.closest('.fields').hidden=m.kind!=='drawer'||m.sidePanels==='none';
    document.querySelector('#station-help').hidden=m.kind!=='station';
    document.querySelector('#remove-module').disabled=plan.modules.length===1||plan.modules.some(p=>p.support===m.id);
    document.querySelector('#add-module').disabled=plan.modules.length===12;
    let layout,overallWidth;
    try{const settings={...plan,clearance:Number(form.elements.clearance.value)};layout=systemLayout(settings);overallWidth=systemInfo(settings).dimensions[0];document.querySelector('#system-help').textContent='Drag sideways to move, upwards onto a housing to stack, or down to the desk to unstack. Stacks move together. ← / → moves one cell.';}catch(e){document.querySelector('#system-help').textContent=e.message;layout=plan.modules.map(p=>({...p,width:p.widthUnits*42-.5,height:p.heightUnits*7,bottom:0}));}
    const width=Math.max(...layout.map(p=>p.x*42+p.width)),height=Math.max(...layout.map(p=>p.bottom+p.height+10));
    scale=Math.min(Math.max(1,canvas.clientWidth-64)/(width+84),Math.max(1,canvas.clientHeight-64)/(height+14));
    canvas.style.setProperty('--grid-pitch',`${42*scale}px`);
    canvas.replaceChildren();
    for(const p of layout){
      const button=document.createElement('button'),name=document.createElement('strong'),kind=document.createElement('span');
      button.type='button';button.dataset.module=p.id;button.className='system-module '+p.kind;button.setAttribute('aria-pressed',String(p.id===selected));button.setAttribute('aria-label',`Select module ${p.id}: ${p.label}`);
      Object.assign(button.style,{left:`${32+p.x*42*scale}px`,bottom:`${32+p.bottom*scale}px`,width:`${p.width*scale}px`,height:`${(p.height+5)*scale}px`});
      name.textContent=p.label||`Module ${p.id}`;kind.textContent=`${moduleNames[p.kind]} · ${p.widthUnits} × ${p.depthUnits}${p.sidePanels!=='none'?' · HSW '+p.sidePanels:''}${p.drawerLatch?' · latch':''}`;button.append(name,kind);const select=()=>{selected=p.id;draw();canvas.querySelector(`[data-module="${p.id}"]`).focus({preventScroll:true});};
      button.addEventListener('click',select);canvas.append(button);
    }
    document.querySelector('#system-size').textContent=`${plan.modules.length} modules · ${(overallWidth??width).toFixed(1)} mm overall`;
  }
  for(const [key,input] of Object.entries(fields))input.addEventListener('input',()=>{
    const m=current();m[key]=input.type==='checkbox'?input.checked:['label','kind','pattern','insert','rightInsert','sidePanels','leftAccessory','rightAccessory'].includes(key)?input.value:Number(input.value);
    if(key==='kind'){m.gridTop=m.kind==='drawer';m.support=0;if(m.kind!=='drawer'){m.sidePanels='none';m.drawerLatch=false;}}
    // Keep the focused numeric input intact while typing; redraw on change.
    if(input.type!=='number'&&key!=='label')draw();changed();
  });
  // Keep the target button intact when an edit moves focus into the planner.
  const redraw=e=>{if(!canvas.contains(e.relatedTarget))draw();};
  for(const input of Object.values(fields))input.addEventListener('blur',redraw);
  form.elements.clearance.addEventListener('blur',redraw);
  document.querySelector('#add-module').addEventListener('click',()=>{const x=Math.max(...plan.modules.map(p=>p.x+p.widthUnits));const m=newModule(nextId++,document.querySelector('#new-module-kind').value,x);plan.modules.push(m);selected=m.id;draw();changed();});
  document.querySelector('#remove-module').addEventListener('click',()=>{if(plan.modules.length<2||plan.modules.some(p=>p.support===selected))return;plan.modules=plan.modules.filter(p=>p.id!==selected);selected=plan.modules[0].id;draw();changed();});
  return {draw,showLayout,snapshot:()=>{const s={modules:plan.modules.map(m=>({...m}))};systemLayout({...s,clearance:Number(form.elements.clearance.value)});return s;}};
}
