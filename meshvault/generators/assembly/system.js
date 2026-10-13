import {drawerLatch} from './latch.js?v=20261010-latch';
// SPDX-License-Identifier: GPL-2.0-only
import { baseplateSource } from '../gridfinity/layout.js?v=20261009-plates';
import {labelHolderSource} from './labels.js?v=20261009-accessories-1';
export const moduleNames={drawer:'Drawer module',bin:'Open bin',station:'Sloped maker station'};
export function newModule(id,kind='drawer',x=0){return {id,kind,label:`Module ${id}`,widthUnits:4,depthUnits:3,heightUnits:8,x,support:0,gridBase:true,gridTop:kind==='drawer',pattern:'hex',across:2,deep:2,insert:'holes',holeDiameter:12,rightInsert:'holes',rightHoleDiameter:12,sidePanels:'none',drawerLatch:false,labelHolder:false,leftAccessory:'none',rightAccessory:'none'};}
export function newSystem(){return {modules:[newModule(1),{...newModule(2),support:1},{...newModule(3,'station',4),widthUnits:3,heightUnits:12,rightInsert:'tray'}]};}
export function systemLayout(s){
  if(!Array.isArray(s.modules)||!s.modules.length||s.modules.length>12||!Number.isFinite(s.clearance)||s.clearance<.2||s.clearance>1.2)throw Error('Use 1–12 modules and 0.2–1.2 mm clearance.');
  const ids=new Set();
  for(const m of s.modules){
    if(!m||!Number.isInteger(m.id)||m.id<1||ids.has(m.id)||!Object.hasOwn(moduleNames,m.kind)||typeof m.label!=='string'||m.label.length>40||![m.widthUnits,m.depthUnits].every(v=>Number.isInteger(v)&&v>=2&&v<=5)||!Number.isInteger(m.heightUnits)||m.heightUnits<6||m.heightUnits>18||!Number.isInteger(m.x)||m.x<0||m.x>30||!Number.isInteger(m.support)||m.support<0||![m.gridBase,m.gridTop,m.labelHolder].every(v=>typeof v==='boolean')||!['solid','hex'].includes(m.pattern)||![m.across,m.deep].every(v=>Number.isInteger(v)&&v>=1&&v<=4)||![m.insert,m.rightInsert].every(v=>['holes','tray','blank'].includes(v))||![m.holeDiameter,m.rightHoleDiameter].every(v=>Number.isFinite(v)&&v>=6&&v<=25)||!['none','left','right','both'].includes(m.sidePanels)||![m.leftAccessory,m.rightAccessory].every(v=>['none','mount','hook'].includes(v)))throw Error('Choose valid module dimensions, inserts and placement.');
    if(m.drawerLatch!==undefined&&typeof m.drawerLatch!=='boolean')throw Error('Choose a valid drawer latch option.');
    if(m.drawerLatch&&m.kind!=='drawer')throw Error('Latches attach to drawer modules only.');
    if(m.kind!=='drawer'&&m.sidePanels!=='none')throw Error('Side panels currently attach to drawer housings.');
    if(m.kind!=='drawer'&&m.gridTop)throw Error('Only drawer housings have a stacking top.');ids.add(m.id);
  }
  const resolved=new Map(),visiting=new Set();
  function place(m){
    if(resolved.has(m.id))return resolved.get(m.id);
    if(visiting.has(m.id))throw Error('A module cannot be stacked on itself or one of its children.');visiting.add(m.id);
    let bottom=0;
    if(m.support){
      const parent=s.modules.find(p=>p.id===m.support);if(!parent||parent.kind!=='drawer'||!parent.gridTop||!m.gridBase)throw Error('Stack on a drawer with a Gridfinity top and enable the upper module’s Gridfinity base.');
      const p=place(parent);
      if(m.x<parent.x||m.x+m.widthUnits>parent.x+parent.widthUnits||m.depthUnits>parent.depthUnits)throw Error('A stacked module must fit fully on its supporting drawer.');
      bottom=p.bottom+parent.heightUnits*7+5;
    }
    const p={...m,bottom,width:m.widthUnits*42-.5,depth:m.depthUnits*42-.5,height:m.heightUnits*7};resolved.set(m.id,p);visiting.delete(m.id);return p;
  }
  const layout=s.modules.map(place);
  for(let i=0;i<layout.length;i++)for(let j=i+1;j<layout.length;j++){
    const a=layout[i],b=layout[j],range=m=>[m.x*42-(panelSides(m).includes('left')?sideReach(m,'left'):0),m.x*42+m.width+(panelSides(m).includes('right')?sideReach(m,'right'):0)],ar=range(a),br=range(b),horizontal=ar[0]<br[1]&&br[0]<ar[1];
    // The five millimetres of mating grid overlap are intentional at a stack seam.
    if(horizontal&&a.bottom<b.bottom+b.height+5-.01&&b.bottom<a.bottom+a.height+5-.01)throw Error('Modules or side panels overlap. Leave room beside panels, move modules sideways or choose a supporting drawer.');
  }
  return layout;
}
const rounded=(w,d,h,r=3)=>`linear_extrude(height=${h}) offset(r=${r},$fn=24) offset(delta=-${r}) square([${w},${d}]);`;
const wedge=(w,d,front,back)=>`rotate([90,0,90]) linear_extrude(height=${w}) polygon([[0,0],[${d},0],[${d},${back}],[0,${front}]]);`;
const grid=(m)=>{
  const cells=Array.from({length:m.widthUnits*m.depthUnits},(_,i)=>[i%m.widthUnits,Math.floor(i/m.widthUnits)]);
  return `intersection(){ cube([${m.width},${m.depth},5.1]); translate([20.75,20.75,0]) { ${baseplateSource(cells).replace(/^include[^\n]+\n/,'')} } }`;
};
const feet=m=>m.gridBase?`intersection(){translate([20.75,20.75,0]) pad_grid(${m.widthUnits},${m.depthUnits}); cube([${m.width},${m.depth},5.1]);}`:`${rounded(m.width,m.depth,5)}`;
// Shallow recesses preserve a solid inner skin so small parts cannot escape.
const texture=(w,h,x=0,y=-3)=>`for(z=[8:6:${h-10}]) for(x=[8:7:${w-8}]) translate([x+${x},${y-.1},z]) rotate([-90,0,0]) cylinder(r=1.8,h=.8,$fn=6);`;
export const panelSides=m=>m.sidePanels==='both'?['left','right']:m.sidePanels==='none'?[]:[m.sidePanels];
// HSW dimensional reference: gbrunow/hsw src/base-plate.scad; own socket construction.
export const hsw={depth:8,front:21,throat:20,rear:22,pitch:23.6};
const socket=()=>`union(){ cylinder(d=${22/Math.cos(Math.PI/6)},h=2.01,$fn=6); translate([0,0,2]) cylinder(d1=${22/Math.cos(Math.PI/6)},d2=${20/Math.cos(Math.PI/6)},h=.9,$fn=6); translate([0,0,2.89]) cylinder(d=${20/Math.cos(Math.PI/6)},h=4.62,$fn=6); translate([0,0,7.5]) cylinder(d1=${20/Math.cos(Math.PI/6)},d2=${21/Math.cos(Math.PI/6)},h=.5,$fn=6); }`;
// shortcut: each panel centres its own lattice; share an origin before supporting accessories across module seams.
export function panelGeometry(m){
  const width=m.depth-8,height=m.height-8,mounts=[[8,8],[width-8,8],[8,height-8],[width-8,height-8]],cells=[],dx=hsw.pitch*Math.sqrt(3)/2;
  for(let col=-Math.ceil(width/dx);col<=Math.ceil(width/dx);col++)for(let row=-Math.ceil(height/hsw.pitch);row<=Math.ceil(height/hsw.pitch);row++){
    const x=width/2+col*dx,y=height/2+(row+(Math.abs(col)%2)/2)*hsw.pitch;
    if(x<14||x>width-14||y<12||y>height-12||mounts.some(([a,b])=>Math.abs(x-a)<18&&Math.abs(y-b)<16))continue;cells.push([x,y]);
  }
  if(!cells.length)throw Error('This side panel is too small for a complete HSW socket. Increase the drawer height or depth.');
  return {width,height,mounts,cells};
}
export const sideReach=(m,side)=>16+({none:0,mount:4,hook:30}[m[side+'Accessory']]);
export function accessoryCell(m){
  const {width,height,cells}=panelGeometry(m),choices=cells.filter(([x,y])=>x>=13&&x<=width-13&&y>=22&&y<=height-22);
  choices.sort((a,b)=>Math.hypot(a[0]-width/2,a[1]-height/2)-Math.hypot(b[0]-width/2,b[1]-height/2));
  if(!choices.length)throw Error('Side accessories need a complete socket with room for a 26 × 44 mm mounting plate. Increase the drawer height (at least 8 units) or depth.');
  return choices[0];
}
export function systemHardware(s){
  const layout=systemLayout(s),panels=layout.reduce((n,m)=>n+panelSides(m).length,0),accessoryScrews=layout.reduce((n,m)=>n+panelSides(m).filter(side=>m[side+'Accessory']!=='none').length,0);
  return {latches:layout.filter(m=>m.kind==='drawer'&&m.drawerLatch).length,panels,screws:panels*4,nuts:panels*4+accessoryScrews,accessoryScrews,screwLength:20,labels:layout.filter(m=>m.kind==='drawer'&&m.labelHolder).length};
}
export function systemParts(s){
  const layout=systemLayout(s),parts=[],t=4,c=s.clearance;
  for(const m of layout){
    const W=m.width,D=m.depth,H=m.height,offset=m.x*42;
    const add=(id,label,source,frame=false,local=[0,0,0],colour='#c5c1b8')=>parts.push({id:`module-${m.id}-${id}`,label:`Module ${m.id} ${label}`,source:'include <gridfinity_bins/gridfinity_modules.scad>\n'+source,colour,orientation:frame?'Rear panel on bed, front opening up':'Upright on base',assembled:p=>{const q=frame?[p[0],D-p[2],p[1]]:p;return [q[0]+offset+local[0],q[1]+local[1],q[2]+m.bottom+local[2]];},explode:frame?[0,0,0]:[0,m.kind==='drawer'?-D*.5:0,m.kind==='drawer'?0:30]});
    if(m.kind==='drawer'){
      const interiorH=H-2*t,iw=W-2*t-c,id=D-t-c,h=interiorH-2-c;
      const sideMounts=panelSides(m).length?panelGeometry(m):null;
      const housingBody=`union(){ ${feet(m)} translate([0,0,5]) difference(){ ${rounded(W,D,H)} translate([${t},-.1,${t}]) cube([${W-2*t},${D-t+.1},${interiorH}]); } for(x=[${t},${W-t-3}]) translate([x,0,${5+t}]) cube([3,${D-t},2]); ${m.gridTop?`translate([0,0,${H+4.9}]) { ${grid(m)} }`:''} }`;
      const latch=m.drawerLatch?drawerLatch(W,H):null;
      const bosses=latch?[latch.boss]:[],bores=latch?[latch.bores]:[];
      for(const side of panelSides(m))for(const [u,v] of sideMounts.mounts){
        const x=side==='left'?0:W,sign=side==='left'?-1:1,y=u+4,z=v+9;
        bosses.push(`translate([${x-sign*.2},${y},${z}]) rotate([0,${sign*90},0]) cylinder(r=5,h=8.2,$fn=32);`);
        bores.push(`translate([${x-sign*4.1},${y},${z}]) rotate([0,${sign*90},0]) cylinder(d=3.4,h=12.3,$fn=24); translate([${x-sign*4.01},${y},${z}]) rotate([0,${sign*90},0]) cylinder(d=${5.7/Math.cos(Math.PI/6)},h=2.71,$fn=6);`);
      }
      const housing=`difference(){ union(){ ${housingBody} ${bosses.join(' ')} } ${bores.join(' ')} }`;
      add('housing','rounded drawer housing',`translate([0,0,${D}]) rotate([-90,0,0]) { ${housing} }`,true,[0,0,0],'#50565e');
      const left=-(t+c/2)+.5,faceW=W-1,dividers=[];
      for(let i=1;i<m.across;i++)dividers.push(`translate([${t+(iw-2*t)*i/m.across-t/2},${t-.1},${t-.1}]) cube([${t},${id-2*t+.2},${h-t-2}]);`);
      for(let i=1;i<m.deep;i++)dividers.push(`translate([${t-.1},${t+(id-2*t)*i/m.deep-t/2},${t-.1}]) cube([${iw-2*t+.2},${t},${h-t-2}]);`);
      const tray=`difference(){ union(){ difference(){ ${rounded(iw,id,h)} translate([${t},${t},${t}]) ${rounded(iw-2*t,id-2*t,h,1)} } ${dividers.join('\n')} translate([${left},.8,0]) rotate([90,0,0]) ${rounded(faceW,h,3.8)} ${m.labelHolder?labelHolderSource(iw/2,-3,.2):''} } translate([${iw/2-16},-4,${h-8}]) rotate([-90,0,0]) linear_extrude(height=${t+5}) offset(r=4,$fn=24) offset(delta=-4) square([32,12]); ${m.pattern==='hex'?texture(faceW,h,left):''} ${latch?`translate([${latch.x-t-c/2},-4,${latch.z-5-t-2}]) rotate([-90,0,0]) cylinder(r=${5+c},h=16,$fn=40);`:''} }`;
      add('drawer','drawer with shaped pull',tray,false,[t+c/2,c/2,5+t+2]);
      if(latch){
        add('latch','rotating drawer latch',latch.arm,false,[0,0,0],'#a58b65');parts.at(-1).assembled=p=>[...latch.assembledArm(p)].map((v,i)=>v+(i===0?offset:i===2?m.bottom:0));parts.at(-1).explode=[0,-25,0];
        add('latch-washer','latch spacer washer',latch.washer);parts.at(-1).assembled=p=>[...latch.assembledWasher(p)].map((v,i)=>v+(i===0?offset:i===2?m.bottom:0));parts.at(-1).explode=[0,-16,0];
      }
      for(const side of panelSides(m)){
        const {width,height,mounts,cells}=sideMounts;
        const source=`difference(){ ${rounded(width,height,8)} ${cells.map(([x,y])=>`translate([${x},${y},0]) { ${socket()} }`).join(' ')} ${mounts.map(([x,y])=>`translate([${x},${y},-.01]) cylinder(d=3.4,h=8.02,$fn=24); translate([${x},${y},6.5]) cylinder(d1=3.4,d2=6.4,h=1.51,$fn=32);`).join(' ')} }`;
        add(`hsw-${side}`,`${side} HSW side panel`,source,false,[0,0,0],'#646d76');
        const part=parts.at(-1);part.orientation='Rear face on bed, socket openings up';
        part.assembled=p=>[offset+(side==='left'?-8-p[2]:W+8+p[2]),side==='left'?D-4-p[0]:p[0]+4,p[1]+m.bottom+9];part.explode=[side==='left'?-25:25,0,0];
        const type=m[side+'Accessory'];
        if(type!=='none'){
          const [u,v]=accessoryCell(m),sign=side==='left'?-1:1,world=q=>[offset+(side==='left'?-16:W+16)+sign*q[2],side==='left'?D-4-u-q[0]+13:u+4+q[0]-13,m.bottom+9+v+q[1]-22];
          const mount=`difference(){ union(){ ${rounded(26,44,4)} translate([13,22,-5.7]) cylinder(d=${19.6/Math.cos(Math.PI/6)},h=5.9,$fn=6); ${type==='hook'?`rotate([90,0,90]) linear_extrude(height=26) offset(r=1.5,$fn=24) offset(delta=-1.5) polygon([[4,2],[4,30],[18,30],[18,24],[10,24],[10,2]]);`:''} } translate([13,22,-5.71]) cylinder(d=3.4,h=9.72,$fn=24); translate([13,22,2.5]) cylinder(d1=3.4,d2=6.4,h=1.51,$fn=32); ${type==='mount'?'for(v=[6,38]) translate([13,v,-.01]) cylinder(d=4.5,h=4.02,$fn=32);':''} }`;
          const printSource=type==='hook'?`translate([0,0,26]) rotate([0,90,0]) { ${mount} }`:`translate([0,0,4]) rotate([180,0,0]) { ${mount} }`;
          add(`hsw-${side}-${type}`,`${side} ${type==='hook'?'utility hook':'universal accessory mount'}`,printSource,false,[0,0,0],'#b1ada5');
          const accessory=parts.at(-1);accessory.orientation=type==='hook'?'On side; support the hex locating neck':'Front face on bed, hex locating neck up';
          accessory.assembled=p=>world(type==='hook'?[26-p[2],p[1],p[0]]:[p[0],-p[1],4-p[2]]);accessory.explode=[sign*40,0,0];
          add(`hsw-${side}-clamp`,`${side} accessory rear clamp`,`difference(){ cylinder(d=${21.6/Math.cos(Math.PI/6)},h=4,$fn=6); translate([0,0,-.01]) cylinder(d=3.4,h=4.02,$fn=24); translate([0,0,1.3]) cylinder(d=${5.7/Math.cos(Math.PI/6)},h=2.71,$fn=6); }`,false,[0,0,0],'#777f87');
          const clamp=parts.at(-1);clamp.orientation='Flat face down, nut recess up';clamp.assembled=p=>[offset+(side==='left'?-8:W+8)+sign*(2.1-p[2]),side==='left'?D-4-u-p[0]:u+4+p[0],m.bottom+9+v-p[1]];clamp.explode=[sign*10,0,0];
        }

      }

    }else if(m.kind==='bin'){
      add('bin','rounded open bin',`difference(){union(){ ${feet(m)} translate([0,0,5]) ${rounded(W,D,H)} } translate([${t},${t},${5+t}]) ${rounded(W-2*t,D-2*t,H,1)} ${m.pattern==='hex'?texture(W,H+5,0,0):''} }`,false,[0,0,0],'#a9adae');
    }else{
      const iw=(W-2*t-3*c)/2,id=D-2*t-c,front=14,back=H-t-6;
      const outer=`intersection(){ ${rounded(W,D,H)} ${wedge(W,D,22,H)} }`;
      add('station','sloped organiser housing',`difference(){union(){ ${feet(m)} translate([0,0,5]) ${outer} } translate([${t},${t},${5+t}]) cube([${W-2*t},${D-2*t},${H}]); ${m.pattern==='hex'?texture(W,24,0,0):''} }`,false,[0,0,0],'#50565e');
      for(let i=0;i<2;i++){
        const type=i?m.rightInsert:m.insert,diameter=i?m.rightHoleDiameter:m.holeDiameter;
        let insert;
        if(type==='tray')insert=`difference(){ ${rounded(iw,id,front)} translate([3,3,3]) ${rounded(iw-6,id-6,front,1)} }`;
        else{
          const slope=(back-front)/id,pitch=diameter+5,holes=type==='holes'?`for(x=[${pitch/2}: ${pitch}: ${iw-pitch/2}]) for(y=[${pitch/2}:${pitch}:${id-pitch/2}]) translate([x,y,-.1]) cylinder(d=${diameter},h=${back+1},$fn=32);`:'';
          insert=`difference(){ ${wedge(iw,id,front,back)} translate([3,3,-.1]) ${wedge(iw-6,id-6,front+slope*3-3,back-slope*3-3)} ${holes} }`;
        }
        const local=[t+c+i*(iw+c),t+c/2,5+t],slope=(back-front)/id,angle=180-Math.atan(slope)*180/Math.PI,lift=front/Math.sqrt(1+slope*slope);
        // Put the sloped face on the bed rather than bridging the whole insert.
        const printSource=type==='tray'?insert:`translate([0,0,${lift}]) rotate([${angle},0,0]) { ${insert} }`;
        add(`insert-${i+1}`,`${type==='holes'?'tool-hole':type==='tray'?'open-tray':'blank sloped'} insert ${i+1}`,printSource,false,local,i?'#a9adae':'#c5c1b8');
        if(type!=='tray'){
          const a=angle*Math.PI/180,part=parts.at(-1);part.orientation='Sloped face down, open underside up';
          part.assembled=p=>[p[0]+offset+local[0],p[1]*Math.cos(a)+(p[2]-lift)*Math.sin(a)+local[1],-p[1]*Math.sin(a)+(p[2]-lift)*Math.cos(a)+m.bottom+local[2]];
        }
      }
    }
  }
  if(layout.some(m=>panelSides(m).length)){
    parts.push({id:'hsw-fit-coupon',label:'HSW socket fit coupon',source:`difference(){ ${rounded(32,30,8)} translate([16,15,0]) { ${socket()} } }`,colour:'#a9adae',orientation:'Rear face on bed, socket opening up',printOnly:true,assembled:p=>p,explode:[0,0,0]});
  }
  return parts;
}
export function systemInfo(s){
  const layout=systemLayout(s),width=Math.max(...layout.map(m=>m.x*42+m.width+(panelSides(m).includes('right')?sideReach(m,'right'):0)))-Math.min(...layout.map(m=>m.x*42-(panelSides(m).includes('left')?sideReach(m,'left'):0))),depth=Math.max(...layout.map(m=>m.depth)),height=Math.max(...layout.map(m=>m.bottom+m.height+(m.kind==='drawer'&&m.gridTop?9.9:5)));
  const hardware=systemHardware(s);
  return {id:'modular-workstation',name:'modular workstation',dimensions:[width,depth+(hardware.latches?6.6:layout.some(m=>m.kind==='drawer')?3-s.clearance/2+(layout.some(m=>m.kind==='drawer'&&m.labelHolder)?2:0):0),height],summary:`A workstation of ${layout.length} independently sized modules: ${layout.map(m=>moduleNames[m.kind].toLowerCase()).join(', ')}. Rounded housings and solid-backed patterned fronts share a 42 mm footprint grid.`,before:`Drawer housings print rear-down, openings facing upwards. Drawers, bins, maker-station housings and open-tray inserts print upright. Sloped inserts print face-down with their open undersides up. Inspect the sliced Gridfinity overhangs and drawer pulls for local supports. Check the Z limit for rear-down housings.${hardware.accessoryScrews?' Utility hooks print on their side with supports under the hex neck; mounting plates print front-face down and rear clamps with nut recesses up.':''}${hardware.latches?' Latches and spacer washers print flat. Support the small latch boss on rear-down housings.':''}${hardware.panels?' Support the exterior mounting stand-offs on rear-down housings. Panels and the socket coupon print rear-face down, openings up.':''}`,fit:`Four millimetre housing walls. ${cText(s.clearance)} total drawer clearance; maker-station inserts have ${cText(s.clearance)} side and centre gaps. Drawer fronts overlap the housing opening and prevent the drawer travelling beyond the rear stop. Maker stations have two independently configured, interchangeable half-width inserts. Gridfinity feet and socket tops provide the stacking interface; they are not locking or load-rated connections. ${hardware.panels?`${hardware.panels} replaceable HSW panels require ${hardware.screws} M3 × 20 mm countersunk screws and ${hardware.nuts} M3 hex nuts${hardware.accessoryScrews?`, plus ${hardware.accessoryScrews} M3 × 16 mm countersunk accessory screws`:''}. Seat nuts flush inside the housing walls before fitting the drawer. Panels stand 8 mm off the housing to leave room behind the sockets. Print the included HSW socket coupon and test your inserts first; compatibility is experimental. Keep multi-socket accessories within one panel; rows are not aligned across module seams. These panels are for light accessories, not mounting the cabinet on a wall.`:hardware.latches?'':'No screws or magnets are required.'} ${hardware.latches?`${hardware.latches} rotating latches need one M3 × 14 mm pan-head screw and one M3 hex nut each, plus the printed spacer washer. A latch holds a drawer closed; it does not lock modules together or provide a transport rating.`:''} ${hardware.labels?'Open-front drawer label rails accept 36 × 9 mm paper labels. Print labels.html at actual size and cut along the borders.':''} Physical fit and strength are untested.`,steps:['<strong>Print and identify.</strong> Part names match the module numbers in the planner. Print one of each part; arranged plate files already contain the full inventory.','<strong>Dry-fit one module.</strong> Remove brim and first-layer burrs. Slide the drawer along its side guides or lower the half-width inserts into the sloped housing. Adjust clearance before printing the full build.',...(hardware.panels?['<strong>Fit the side panels.</strong> Test an existing HSW insert in the socket coupon first. Seat M3 nuts in the housing’s inside recesses, then attach each panel with four M3 × 20 mm countersunk screws. Tighten gently and check that nuts are flush before sliding the drawer in.']:[]),...(hardware.accessoryScrews?['<strong>Attach the accessories.</strong> Test the locating neck and rear clamp in the socket coupon first. Fit an M3 nut into each printed rear clamp, place the clamp behind the chosen socket and tighten an M3 × 16 mm countersunk screw through the accessory. Attach accessories before fixing the panel to the housing. Universal plates have two 4.5 mm mounting holes spaced 32 mm apart; hardware for your own attachment is not supplied.']:[]),...(hardware.latches?['<strong>Fit each drawer latch.</strong> Dry-fit the housing boss and drawer clearance notch. Seat an M3 hex nut in the rear recess of the boss. Place the printed washer between boss and turn button, and fit an M3 × 14 mm pan-head screw from the front. Tighten only enough to hold the button position while allowing rotation. Point it down to retain the drawer; turn it sideways before opening. Check that it clears the pull and stacking interface. Recheck screw friction after use; do not use the latch as a carrying or safety lock.']:[]),...(hardware.labels?['<strong>Label the drawers.</strong> Print the label sheet at 100% scale, cut 36 × 9 mm paper labels and slide them into the open-top rails. Labels are paper, not printed plastic parts.']:[]),'<strong>Arrange your workstation.</strong> Set ground modules on a level surface. Seat upper modules on the supporting drawer’s Gridfinity sockets. Keep heavy contents low and check for rocking.','<strong>Make it useful.</strong> Use the solid-backed patterned drawers for small parts, the open bins for larger items and the removable inserts for tools. Keep tall stacks stable and away from desk edges.']};
}
const cText=c=>`${c.toFixed(2)} mm`;
