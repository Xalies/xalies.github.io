import {mountingFaces} from './profiles.js?v=20261010-saddles';

export function initFaceEditor({form,host,scene,camera,render,getMesh,onEdit}){
  const buttons=document.querySelector('#face-buttons'),panel=document.querySelector('#face-controls'),title=document.querySelector('#selected-face');
  const inputs=Object.fromEntries(['holes','diameter','edge','offset','along'].map(key=>[key,document.querySelector(`#face-${key}`)]));
  let settings,selected,shape,overrides={},outline,down;
  function removeOutline(){if(!outline)return;scene.remove(outline);outline.children.forEach(line=>{line.geometry.dispose();line.material.dispose();});outline=null;}
  function highlight(){
    removeOutline();const face=mountingFaces(settings).find(f=>f.id===selected);if(!face||!getMesh())return;
    outline=new THREE.Group();const shift=settings.type==='z'?settings.length-settings.thickness:0;
    for(const plane of [face.start,face.end]){const points=[[0,face.lo],[settings.width,face.lo],[settings.width,face.hi],[0,face.hi]].map(([across,along])=>face.axis===1?new THREE.Vector3(along+shift,across,-plane):new THREE.Vector3(plane+shift,across,-along));const g=new THREE.BufferGeometry().setFromPoints(points),material=new THREE.LineBasicMaterial({color:0xffc99e,depthTest:false,transparent:true,opacity:.9});const line=new THREE.LineLoop(g,material);line.renderOrder=2;outline.add(line);}
    scene.add(outline);render();
  }
  function select(id){
    selected=id;const face=mountingFaces(settings).find(f=>f.id===id);panel.hidden=!face;
    buttons.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.face===id)));
    if(face){title.textContent=face.label;const config=overrides[id]??{holes:settings.holes,diameter:settings.diameter,edge:settings.edge,offset:0,along:0};Object.entries(inputs).forEach(([key,input])=>input.value=config[key]);inputs.holes.disabled=false;inputs.edge.disabled=config.holes!==2;inputs.diameter.disabled=inputs.offset.disabled=inputs.along.disabled=config.holes===0;}
    highlight();
  }
  buttons.addEventListener('click',e=>{if(e.target.dataset.face)select(e.target.dataset.face);});
  Object.values(inputs).forEach(input=>input.addEventListener('input',e=>{e.stopPropagation();if(!selected)return;overrides[selected]=Object.fromEntries(Object.entries(inputs).map(([key,input])=>[key,input.value===''?NaN:Number(input.value)]));inputs.edge.disabled=Number(inputs.holes.value)!==2;inputs.diameter.disabled=inputs.offset.disabled=inputs.along.disabled=Number(inputs.holes.value)===0;onEdit();}));
  document.querySelector('#reset-face').addEventListener('click',()=>{delete overrides[selected];select(selected);onEdit();});
  host.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
  host.addEventListener('pointerup',e=>{
    if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5||!getMesh())return;
    const rect=host.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);
    const hit=ray.intersectObject(getMesh())[0];if(!hit)return;
    const shift=settings.type==='z'?settings.length-settings.thickness:0,p=[hit.point.x-shift,-hit.point.z];
    const face=mountingFaces(settings).find(f=>Math.min(Math.abs(p[f.axis]-f.start),Math.abs(p[f.axis]-f.end))<.01&&p[1-f.axis]>=f.lo&&p[1-f.axis]<=f.hi);
    if(face)select(face.id);
  });
  return {
    sync(s){settings=s;if(shape!==s.type){shape=s.type;overrides={};selected=undefined;buttons.replaceChildren(...mountingFaces(s).map(face=>{const button=document.createElement('button');button.type='button';button.dataset.face=face.id;button.textContent=face.label;button.setAttribute('aria-pressed','false');return button;}));panel.hidden=true;Object.values(inputs).forEach(input=>input.disabled=true);}else if(selected&&!overrides[selected])select(selected);},
    get overrides(){return Object.keys(overrides).length?structuredClone(overrides):undefined;},
    clear:removeOutline,
    refresh(){if(settings)highlight();}
  };
}
