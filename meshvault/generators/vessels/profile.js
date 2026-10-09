// The same smooth radius function drives the outline and exported mesh.
export function initProfileEditor(form, radius, update) {
  const svg=document.querySelector('#profile-editor'), handles=[...svg.querySelectorAll('[data-size]')], layer=svg.querySelector('#profile-points');
  const scale=.65, centre=54, floor=236, points=[];
  const remove=document.querySelector('#remove-profile-point');
  let drag=null, selected=null, nextId=0;
  const height=()=>Number(form.elements.height.value);
  const settings=()=>({...Object.fromEntries(['height','base','belly','mouth'].map(name=>[name,Number(form.elements[name].value)])),profilePoints:points});
  function select(id) {
    selected=id;remove.disabled=id===null;
    for(const node of layer.children)node.dataset.selected=String(Number(node.dataset.point)===id);
  }
  function setSize(name,value) {
    const input=form.elements[name];
    input.value=Math.max(Number(input.min),Math.min(Number(input.max),Math.round(value)));
    update();
  }
  function movePoint(id,t,diameter) {
    const point=points.find(p=>p.id===id), neighbours=[0,.55,1,...points.filter(p=>p.id!==id).map(p=>p.t)].sort((a,b)=>a-b);
    const lower=neighbours.filter(n=>n<point.t).at(-1),upper=neighbours.find(n=>n>point.t);
    point.t=Math.max(lower+.02,Math.min(upper-.02,t));
    point.diameter=Math.max(25,Math.min(260,Math.round(diameter)));
    update();
  }
  function deletePoint() {
    if(selected===null)return;
    const index=points.findIndex(p=>p.id===selected);points.splice(index,1);
    layer.querySelector(`[data-point="${selected}"]`).remove();select(null);update();
    document.querySelector('#add-profile-point').focus();
  }
  function addPoint(t) {
    if(!Number.isFinite(t)||![0,.55,1,...points.map(p=>p.t)].every(n=>Math.abs(n-t)>=.04))return;
    const point={id:++nextId,t,diameter:Math.round(radius(settings(),t)*2)};
    points.push(point);
    const node=document.createElementNS(svg.namespaceURI,'g');
    node.classList.add('profile-handle');node.dataset.point=point.id;node.setAttribute('role','slider');node.setAttribute('tabindex','0');node.setAttribute('aria-label',`Profile point ${point.id} diameter; up and down adjust height`);
    const circle=document.createElementNS(svg.namespaceURI,'circle');circle.setAttribute('r','9');
    const label=document.createElementNS(svg.namespaceURI,'text');label.setAttribute('x','14');label.setAttribute('y','4');node.append(circle,label);layer.append(node);
    node.addEventListener('focus',()=>select(point.id));
    node.addEventListener('keydown',event=>{
      if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();select(point.id);deletePoint();return;}
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
      event.preventDefault();const step=event.shiftKey?10:1;
      movePoint(point.id,point.t+(event.key==='ArrowUp'?step: event.key==='ArrowDown'?-step:0)/height(),event.key==='Home'?25:event.key==='End'?260:point.diameter+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0));
    });
    select(point.id);update();node.focus();return point;
  }
  document.querySelector('#add-profile-point').addEventListener('click',()=>{
    const stops=[0,.55,1,...points.map(p=>p.t)].sort((a,b)=>a-b);
    const gaps=stops.slice(1).map((end,i)=>({t:(stops[i]+end)/2,size:end-stops[i]}));
    addPoint(gaps.sort((a,b)=>b.size-a.size)[0].t);
  });
  remove.addEventListener('click',deletePoint);
  const coordinates=event=>new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());
  svg.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    let handle=event.target.closest('[data-size],[data-point]');
    if(!handle&&event.target.id==='profile-line') {
      const point=addPoint((floor-coordinates(event).y)/(height()*scale));
      if(point)handle=layer.querySelector(`[data-point="${point.id}"]`);
    }
    if(!handle)return;
    event.preventDefault();handle.focus();
    drag=handle.dataset.size?{size:handle.dataset.size}:{id:Number(handle.dataset.point)};
    if(drag.size)select(null);else select(drag.id);
    svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('pointermove',event=>{
    if(!drag)return;
    const point=coordinates(event);
    if(drag.size)setSize(drag.size,drag.size==='height'?(floor-point.y)/scale:(point.x-centre)*2/scale);
    else movePoint(drag.id,(floor-point.y)/(height()*scale),(point.x-centre)*2/scale);
  });
  for(const event of ['pointerup','lostpointercapture','pointercancel'])svg.addEventListener(event,()=>{drag=null;});
  for(const handle of handles) {
    handle.addEventListener('focus',()=>select(null));
    handle.addEventListener('keydown',event=>{
      const input=form.elements[handle.dataset.size];
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
      event.preventDefault();
      const value=event.key==='Home'?Number(input.min):event.key==='End'?Number(input.max):Number(input.value)+(['ArrowRight','ArrowUp'].includes(event.key)?1:-1)*(event.shiftKey?10:1);
      setSize(handle.dataset.size,value);
    });
  }
  function position(node,x,y,value,min,max,text) {
    node.setAttribute('transform',`translate(${x},${y})`);
    for(const [key,val] of Object.entries({min,max,now:value,text}))node.setAttribute(`aria-value${key}`,val);
  }
  function render() {
    const s=settings();
    if(!['height','base','belly','mouth'].every(name=>form.elements[name].validity.valid))return;
    const right=Array.from({length:65},(_,i)=>{const t=i/64;return [centre+radius(s,t)*scale,floor-s.height*t*scale];});
    const line=`M${right.map(p=>p.join(',')).join('L')}`;
    svg.querySelector('#profile-line').setAttribute('d',line);
    svg.querySelector('#profile-shape').setAttribute('d',`${line}L${centre},${floor-s.height*scale}L${centre},${floor}Z`);
    svg.querySelector('#profile-height-line').setAttribute('d',`M18 ${floor}V${floor-s.height*scale}H${centre}`);
    for(const handle of handles) {
      const name=handle.dataset.size,input=form.elements[name],t=name==='base'?0:name==='belly'?.55:1;
      position(handle,name==='height'?18:centre+s[name]/2*scale,floor-s.height*t*scale,input.value,input.min,input.max,`${input.value} millimetres`);
      handle.querySelector('text').textContent=`${input.value}${name==='height'?' h':' Ø'}`;
    }
    for(const point of points) {
      const node=layer.querySelector(`[data-point="${point.id}"]`);
      position(node,centre+point.diameter/2*scale,floor-s.height*point.t*scale,point.diameter,25,260,`${point.diameter} millimetres diameter at ${Math.round(s.height*point.t)} millimetres high`);
      node.querySelector('text').textContent=`${point.diameter} Ø`;
    }
  }
  return {render,points:()=>points.map(({t,diameter})=>({t,diameter})),reset:()=>{drag=null;points.length=0;layer.replaceChildren();select(null);}};
}
