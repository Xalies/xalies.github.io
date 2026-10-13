// Layout-only primitives: printable geometry is generated on the print step.
import {systemLayout} from './system.js?v=20261010-latch';
export function previewParts(s,dimensions){
  const parts=[];
  function add(label,colour,boxes,origin=[0,0,0],explode=[0,0,0]){
    const positions=[],indices=[];
    for(const [x,y,z,w,d,h,rise=0,shear=false] of boxes){
      const g=new THREE.BoxBufferGeometry(w,d,h),a=g.attributes.position.array,offset=positions.length/3;
      for(let i=0;i<a.length;i+=3)positions.push(a[i]+x+w/2+origin[0],a[i+1]+y+d/2+origin[1],a[i+2]+z+h/2+origin[2]+(shear||a[i+2]>0?rise*(a[i+1]+d/2)/d:0));
      for(const i of g.index.array)indices.push(i+offset);g.dispose();
    }
    parts.push({label,colour,mesh:{positions,indices},assembled:p=>p,explode});
  }
  const tub=(w,d,h,t=4,across=1,deep=1)=>{
    const boxes=[[0,0,0,w,d,t],[0,0,t,t,d,h-t],[w-t,0,t,t,d,h-t],[t,0,t,w-2*t,t,h-t],[t,d-t,t,w-2*t,t,h-t]];
    for(let i=1;i<across;i++)boxes.push([w*i/across-t/2,t,t,t,d-2*t,h-t-2]);
    for(let i=1;i<deep;i++)boxes.push([t,d*i/deep-t/2,t,w-2*t,t,h-t-2]);return boxes;
  };
  function drawer(w,d,h,origin,across=1,deep=1,t=4){
    add('Housing','#50565e',[[0,0,0,w,d,t],[0,0,h-t,w,d,t],[0,0,t,t,d,h-2*t],[w-t,0,t,t,d,h-2*t],[t,d-t,t,w-2*t,t,h-2*t]],origin);
    add('Drawer','#c5c1b8',tub(w-2*t-1,d-t-1,h-2*t-3,t,across,deep),[origin[0]+t+.5,origin[1],origin[2]+t+1],[0,-d*.5,0]);
  }
  if(s.assembly==='system'){
    for(const m of systemLayout(s)){
      const origin=[m.x*42,0,m.bottom],w=m.width,d=m.depth,h=m.height+5;
      if(m.kind==='drawer'){drawer(w,d,h,origin,m.across,m.deep);if(m.drawerLatch)add('Rotating drawer latch','#a58b65',[[w-20,-6.6,m.height-18.2,8,3,22]],origin,[0,-25,0]);}
      else if(m.kind==='bin')add('Open bin','#a9adae',tub(w,d,h),origin);
      else{
        const boxes=[[0,0,0,w,d,5],[0,d-4,5,w,4,h-5],[0,0,5,4,d,17,h-22],[w-4,0,5,4,d,17,h-22]];
        add('Maker station','#50565e',boxes,origin);
        for(let side=0;side<2;side++){
          const insert=side?m.rightInsert:m.insert,iw=(w-12)/2,boxes=[[0,0,18,iw,d-8,4,h-26,true]];
          if(insert==='tray')boxes.push([0,0,18,iw,4,6]);
          add('Station insert','#c5c1b8',boxes,[origin[0]+4+side*(iw+4),4,origin[2]],[0,0,30]);
        }
      }
      if(m.gridTop&&m.kind==='drawer')add('Stacking top','#777f87',[[0,0,h,w,d,4.9]],origin);
      for(const side of m.sidePanels==='both'?['left','right']:m.sidePanels==='none'?[]:[m.sidePanels]){
        const x=side==='left'?-16:w+8;add('Side panel','#646d76',[[x,4,9,8,d-8,m.height-8]],origin);
        if(m[side+'Accessory']!=='none')add('Side accessory','#b1ada5',[[side==='left'?-20:w+16,d/2-13,m.height/2-22,4,26,44]],origin);
      }
    }
  }else if(s.assembly==='cabinet'&&s.output!=='insert'){
    let z=0;for(let row=0;row<s.heights.length;row++){
      for(let col=0;col<s.columns;col++){const b=s.bays[row*s.columns+col],origin=[col*s.width,0,z];
        if(b.type==='shelf')add('Open shelf','#50565e',tub(s.width,s.depth,s.heights[row],s.thickness),origin);
        else drawer(s.width,s.depth,s.heights[row],origin,b.across,b.deep,s.thickness);
      }z+=s.heights[row];
    }
  }else if(s.assembly==='organiser'){
    add('Carrier','#50565e',tub(s.width,s.depth,s.height,s.thickness));
    const w=(s.width-2*s.thickness)/s.trays;for(let i=0;i<s.trays;i++)add('Tray','#c5c1b8',tub(w-1,s.depth-2*s.thickness-1,s.height,s.thickness),[s.thickness+i*w,s.thickness,s.thickness],[0,0,20]);
  }else if(s.assembly==='cabinet')add('Selected insert','#c5c1b8',tub(...dimensions));
  else drawer(s.width,s.depth,s.height,[0,0,0],1,1,s.thickness);
  return parts;
}

