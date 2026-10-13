import { newCabinet, validateCabinet, insertNames } from './cabinet.js?v=20261009-storage-6';
export function initCabinet(form,changed) {
  let plan=newCabinet(),selected=0;
  const grid=document.querySelector('#bay-plan'),options=document.querySelector('#cabinet-options');
  const controls={type:document.querySelector('#bay-type'),label:document.querySelector('#bay-label'),across:document.querySelector('#bay-across'),deep:document.querySelector('#bay-deep'),handle:document.querySelector('#bay-handle'),labelHolder:document.querySelector('#bay-label-holder')};
  function select(i){selected=i;const b=plan.bays[i];for(const [key,input] of Object.entries(controls))key==='labelHolder'?input.checked=b[key]:input.value=b[key];form.elements.height.value=plan.heights[Math.floor(i/plan.columns)];draw();}
  function draw(){
    const enabled=form.elements.assembly.value==='cabinet';options.hidden=!enabled;document.querySelector('#cabinet-planner').hidden=!enabled;
    document.querySelector('#selected-bay').textContent=`Bay ${selected+1} · row ${Math.floor(selected/plan.columns)+1}`;
    for(const key of ['across','deep'])controls[key].disabled=plan.bays[selected].type!=='divided';
    controls.handle.disabled=controls.labelHolder.disabled=plan.bays[selected].type==='shelf';
    document.querySelector('#grid-top').disabled=document.querySelector('#cabinet-output').value==='insert';
    document.querySelector('#grid-base').disabled=document.querySelector('#cabinet-output').value!=='insert';
    grid.replaceChildren();grid.style.gridTemplateColumns=`repeat(${plan.columns},1fr)`;grid.style.gridTemplateRows=[...plan.heights].reverse().map(h=>h+'fr').join(' ');
    for(let row=plan.heights.length-1;row>=0;row--)for(let col=0;col<plan.columns;col++){
      const i=row*plan.columns+col,b=plan.bays[i],button=document.createElement('button'),name=document.createElement('strong'),kind=document.createElement('span'),face=document.createElement('span');
      button.type='button';button.className='bay '+b.type;button.dataset.bay=i;button.setAttribute('aria-pressed',String(i===selected));button.setAttribute('aria-label',`Select bay ${i+1}: ${b.label}, ${insertNames[b.type]}`);name.textContent=b.label||'Bay '+(i+1);kind.textContent=`${insertNames[b.type]} · ${plan.heights[row]} mm`;
      face.className='bay-face';face.style.gridTemplateColumns=`repeat(${b.type==='divided'?b.across:b.type==='gridfinity'?3:1},1fr)`;
      for(let n=0;n<(b.type==='divided'?b.across*b.deep:b.type==='gridfinity'?6:1);n++)face.append(document.createElement('i'));
      button.append(face,name,kind);button.addEventListener('click',()=>{select(i);if(document.querySelector('#cabinet-output').value==='insert')changed();grid.querySelector(`[data-bay="${i}"]`).focus({preventScroll:true});});grid.append(button);
    }
    document.querySelector('#cabinet-size').textContent=`${plan.columns} column${plan.columns===1?'':'s'} · ${plan.heights.length} row${plan.heights.length===1?'':'s'} · ${plan.bays.length} bays`;
    for(const [id,disabled] of [['add-column',plan.columns===3],['remove-column',plan.columns===1],['add-row',plan.heights.length===4],['remove-row',plan.heights.length===1]])document.getElementById(id).disabled=disabled;
  }
  for(const [key,input] of Object.entries(controls))input.addEventListener('input',()=>{plan.bays[selected][key]=key==='labelHolder'?input.checked:['across','deep'].includes(key)?Number(input.value):input.value;draw();changed();});
  form.elements.height.addEventListener('input',()=>{if(form.elements.assembly.value==='cabinet'){plan.heights[Math.floor(selected/plan.columns)]=Number(form.elements.height.value);draw();}});
  for(const id of ['add-column','remove-column','add-row','remove-row'])document.getElementById(id).addEventListener('click',()=>{
    const old=plan,cols=old.columns+(id==='add-column'?1:id==='remove-column'?-1:0),rows=old.heights.length+(id==='add-row'?1:id==='remove-row'?-1:0);
    if(cols<1||cols>3||rows<1||rows>4)return;
    plan={columns:cols,heights:Array.from({length:rows},(_,r)=>old.heights[r]??65),bays:Array.from({length:cols*rows},(_,i)=>{const r=Math.floor(i/cols),c=i%cols;return r<old.heights.length&&c<old.columns?old.bays[r*old.columns+c]:{...newCabinet().bays[0],label:'Bay '+(i+1)};})};select(Math.min(selected,plan.bays.length-1));changed();
  });
  document.querySelectorAll('[data-cabinet-preset]').forEach(button=>button.addEventListener('click',()=>{plan=newCabinet(button.dataset.cabinetPreset);select(0);changed();}));
  document.querySelector('#cabinet-output').addEventListener('input',draw);
  select(0);
  return {snapshot:()=>{const s={...plan,output:document.querySelector('#cabinet-output').value,selectedBay:selected,gridTop:document.querySelector('#grid-top').checked,gridBase:document.querySelector('#grid-base').checked,heights:[...plan.heights],bays:plan.bays.map(b=>({...b}))};validateCabinet({...s,width:Number(form.elements.width.value),depth:Number(form.elements.depth.value),thickness:Number(form.elements.thickness.value),clearance:Number(form.elements.clearance.value)});return s;},draw,activate:()=>select(selected)};
}
