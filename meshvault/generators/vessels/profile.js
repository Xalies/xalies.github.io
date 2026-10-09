// The same smooth radius function drives the silhouette and exported mesh.
export function initProfileEditor(form, radius, update) {
  const svg=document.querySelector('#profile-editor'), handles=[...svg.querySelectorAll('[data-size]')];
  const scale=.65, centre=94, floor=236;
  let drag=null;
  function setSize(name,value) {
    const input=form.elements[name];
    input.value=Math.max(Number(input.min),Math.min(Number(input.max),Math.round(value)));
    update();
  }
  svg.addEventListener('pointerdown',event=>{
    const handle=event.target.closest('[data-size]');
    if(!handle||event.button!==0)return;
    event.preventDefault();handle.focus();drag=handle.dataset.size;svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('pointermove',event=>{
    if(!drag)return;
    const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());
    setSize(drag,drag==='height'?(floor-point.y)/scale:(point.x-centre)*2/scale);
  });
  svg.addEventListener('pointerup',()=>{drag=null;});
  svg.addEventListener('lostpointercapture',()=>{drag=null;});
  svg.addEventListener('pointercancel',()=>{drag=null;});
  for(const handle of handles)handle.addEventListener('keydown',event=>{
    const input=form.elements[handle.dataset.size];
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    event.preventDefault();
    const value=event.key==='Home'?Number(input.min):event.key==='End'?Number(input.max):Number(input.value)+(['ArrowRight','ArrowUp'].includes(event.key)?1:-1)*(event.shiftKey?10:1);
    setSize(handle.dataset.size,value);
  });
  return function render() {
    const s=Object.fromEntries(['height','base','belly','mouth'].map(name=>[name,Number(form.elements[name].value)]));
    if(!['height','base','belly','mouth'].every(name=>form.elements[name].validity.valid))return;
    const right=Array.from({length:65},(_,i)=>{const t=i/64;return [centre+radius(s,t)*scale,floor-s.height*t*scale];});
    const left=[...right].reverse().map(([x,y])=>[2*centre-x,y]);
    svg.querySelector('#profile-shape').setAttribute('d',`M${[...right,...left].map(p=>p.join(',')).join('L')}Z`);
    svg.querySelector('#profile-height-line').setAttribute('d',`M24 ${floor}V${floor-s.height*scale}H${centre}`);
    for(const handle of handles) {
      const name=handle.dataset.size,input=form.elements[name],t=name==='base'?0:name==='belly'?.55:1;
      handle.setAttribute('transform',`translate(${name==='height'?24:centre+s[name]/2*scale},${floor-s.height*t*scale})`);
      for(const [key,value] of Object.entries({min:input.min,max:input.max,now:input.value,text:`${input.value} millimetres`}))handle.setAttribute(`aria-value${key}`,value);
      handle.querySelector('text').textContent=`${input.value}${name==='height'?' h':' Ø'}`;
    }
  };
}
