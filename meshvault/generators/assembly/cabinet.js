// SPDX-License-Identifier: GPL-2.0-only
// Cabinet layout and printable parts; all dimensions are millimetres.
import { drawerParts, drawerFit } from './geometry.js';
import { baseplateSource } from '../gridfinity/layout.js?v=20261009-plates';
export const insertNames={drawer:'Drawer',divided:'Divided drawer',tray:'Open tray',shelf:'Open shelf',gridfinity:'Gridfinity tray'};
export function newCabinet(preset='parts') {
  const columns=preset==='desk'?3:2,heights=preset==='desk'?[55]:preset==='tools'?[90,90]:[65,80];
  return {columns,heights,bays:Array.from({length:columns*heights.length},(_,i)=>({type:preset==='desk'?['tray','divided','shelf'][i]:preset==='tools'?'drawer':['divided','drawer','tray','shelf'][i],label:'Bay '+(i+1),across:2,deep:2,handle:'bar',labelHolder:true}))};
}
export function validateCabinet(s) {
  if(!Number.isInteger(s.columns)||s.columns<1||s.columns>3||!Array.isArray(s.heights)||s.heights.length<1||s.heights.length>4||s.heights.some(h=>!Number.isFinite(h)||h<40||h>100)||!Array.isArray(s.bays)||s.bays.length!==s.columns*s.heights.length)throw Error('Use 1–3 columns and 1–4 rows, each 40–100 mm high.');
  if(!Number.isInteger(s.thickness)||s.thickness<4||s.thickness>5)throw Error('Joined cabinet walls must be 4 or 5 mm thick.');
  for(const b of s.bays) {
    if(!b||!Object.hasOwn(insertNames,b.type)||typeof b.label!=='string'||b.label.length>40||!['bar','notch'].includes(b.handle)||typeof b.labelHolder!=='boolean'||![b.across,b.deep].every(n=>Number.isInteger(n)&&n>=1&&n<=4))throw Error('Choose valid bay contents, labels and dividers.');
  }
  drawerFit({...s,height:s.heights[0],insert:'drawer'});
  return s;
}
export function cabinetParts(s) {
  validateCabinet(s);const parts=[],t=s.thickness,W=s.width,D=s.depth,total=s.columns*W;
  // Recess hardware flush with the inner walls so it cannot foul the insert.
  const bore=(p,rot,len)=>`translate(${JSON.stringify(p)}) rotate(${JSON.stringify(rot)}) cylinder(d=3.4,h=${len},$fn=24);`;
  const pocket=(p,rot,nut)=>`translate(${JSON.stringify(p)}) rotate(${JSON.stringify(rot)}) ${nut?'cylinder(d=6.8,h=2.6,$fn=6);':'cylinder(d1=6.4,d2=3.4,h=1.5,$fn=32);'}`;
  let z=0;
  for(let row=0;row<s.heights.length;row++) {
    const H=s.heights[row];
    for(let col=0;col<s.columns;col++) {
      const i=row*s.columns+col,b=s.bays[i],f=drawerFit({...s,height:H,insert:'drawer'}),base=drawerParts({...s,height:H,insert:b.type==='tray'||b.type==='gridfinity'?'tray':'drawer'}),holes=[];
      for(const d of [D*.35,D*.75]) {
        if(col>0){holes.push(bore([-.1,H/2,d],[0,90,0],t+.2),pocket([t+.01,H/2,d],[0,-90,0],true));}
        if(col<s.columns-1){holes.push(bore([W-t-.1,H/2,d],[0,90,0],t+.2),pocket([W-t-.01,H/2,d],[0,90,0],false));}
        if(row>0){holes.push(bore([W/2,-.1,d],[-90,0,0],t+.2),pocket([W/2,t+.01,d],[90,0,0],true));}
        if(row<s.heights.length-1){holes.push(bore([W/2,H-t-.1,d],[-90,0,0],t+.2),pocket([W/2,H-t-.01,d],[-90,0,0],false));}
      }
      const offset=[col*W-(total-W)/2,0,z],place=part=>{const assembled=part.assembled;return {...part,bay:i,id:`bay-${i+1}-${part.id}`,label:`Bay ${i+1} ${part.label}`,assembled:p=>assembled(p).map((v,a)=>v+offset[a]),explode:part.id==='drawer-frame'?[(col-(s.columns-1)/2)*18,0,row*14]:[(col-(s.columns-1)/2)*18,-D*.5,row*14]};};
      parts.push(place({...base[0],source:`difference(){ ${base[0].source} ${holes.join('\n')} }`}));
      if(b.type!=='shelf') {
        const h=b.type==='tray'||b.type==='gridfinity'?Math.min(18,f.height):f.height;
        const rounded=(w,d,h,r)=>`linear_extrude(height=${h}) translate([${r},${r}]) offset(r=${r},$fn=16) square([${w-2*r},${d-2*r}]);`;
        let shell=`difference(){ ${rounded(f.width,f.depth,h,2)} translate([${t},${t},${t}]) ${rounded(f.width-2*t,f.depth-2*t,h,1)} ${b.handle==='notch'?`translate([${f.width/2},-.1,${h}]) rotate([-90,0,0]) cylinder(r=8,h=${t+.2},$fn=32);`:''} }`;
        const extras=[];
        if(b.type==='divided') {
          for(let n=1;n<b.across;n++)extras.push(`translate([${t+(f.width-2*t)*n/b.across-t/2},${t-.1},${t-.1}]) cube([${t},${f.depth-2*t+.2},${h-t-2}]);`);
          for(let n=1;n<b.deep;n++)extras.push(`translate([${t-.1},${t+(f.depth-2*t)*n/b.deep-t/2},${t-.1}]) cube([${f.width-2*t+.2},${t},${h-t-2}]);`);
        }
        if(b.type==='gridfinity') {
          const nx=Math.floor((f.width-2*t)/42),ny=Math.floor((f.depth-2*t)/42);if(nx<1||ny<1)throw Error('This bay is too small for a Gridfinity tray.');
          const cells=Array.from({length:nx*ny},(_,j)=>[j%nx,Math.floor(j/nx)]);
          extras.push(`translate([${(f.width-nx*42)/2+21},${(f.depth-ny*42)/2+21},${t-.1}]) { ${baseplateSource(cells).replace(/^include[^\n]+\n/,'')} }`);
        }
        if(b.handle==='bar')extras.push(`translate([${f.width/2-22},-7,${h-9}]) cube([44,3,5]); for(x=[${f.width/2-22},${f.width/2+18}]) translate([x,-7,${h-9}]) cube([4,7.2,5]);`);
        if(b.labelHolder)extras.push(`translate([${f.width/2-20},-1.8,3]) cube([40,2,1.2]); for(x=[${f.width/2-20},${f.width/2+18}]) translate([x,-1.8,3]) cube([2,2,11]); translate([${f.width/2-20},-1.8,3]) cube([40,.6,11]);`);
        parts.push(place({...base[1],id:'insert',label:insertNames[b.type],source:`${b.type==='gridfinity'?'include <gridfinity_bins/gridfinity_modules.scad>\n':''}union(){ ${shell} ${extras.join('\n')} }`,colour:['#f4cc68','#8cd6b6','#9ab9e6','#e5a5a0'][i%4]}));
      }
    }
    z+=H;
  }
  return parts;
}
export function cabinetHardware(s){validateCabinet(s);const joints=(s.columns-1)*s.heights.length+s.columns*(s.heights.length-1);return {joints,screws:joints*2,nuts:joints*2,screwLength:2*s.thickness};}
