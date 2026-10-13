// MIT · Copyright 2026 Xalies
// Print coordinates are XYZ, Z upwards.
const rectangle = (x,y,width,height) => [[x,y],[x+width,y],[x+width,y+height],[x,y+height]];
function openTray(width, depth, height, wall) {
  const outer=rectangle(0,0,width,depth),inner=rectangle(wall,wall,width-2*wall,depth-2*wall);
  const positions=[...outer.map(p=>[...p,0]),...outer.map(p=>[...p,height]),...inner.map(p=>[...p,height]),...inner.map(p=>[...p,wall])].flat();
  const indices=[0,2,1,0,3,2,12,13,14,12,14,15];
  for(let ring=0;ring<3;ring++)for(let j=0;j<4;j++) {
    const k=(j+1)%4,a=ring*4+j,b=a+4,c=ring*4+k,d=c+4;
    indices.push(a,c,b,b,c,d);
  }
  return {positions,indices};
}

export function organiserParts(s) {
  if (![s.width,s.depth,s.height,s.thickness,s.clearance,s.trays].every(Number.isFinite) || s.width<120 || s.width>240 || s.depth<70 || s.depth>180 || s.height<25 || s.height>70 || s.thickness<1.6 || s.thickness>4 || s.clearance<.2 || s.clearance>1.2 || !Number.isInteger(s.trays) || s.trays<2 || s.trays>4) throw new Error('Choose organiser dimensions within the supported ranges.');
  const bay=(s.width-2*s.thickness)/s.trays, trayWidth=bay-s.clearance, trayDepth=s.depth-2*s.thickness-s.clearance;
  if(s.gridfinity && (!Number.isInteger((s.width+.5)/42)||!Number.isInteger((s.depth+.5)/42))) throw new Error('Gridfinity dimensions must follow the 42 mm grid, minus 0.5 mm overall clearance.');
  const tray=openTray(trayWidth,trayDepth,s.height-s.thickness+3,s.thickness);
  return [
    {id:'carrier',label:'Tray carrier',mesh:openTray(s.width,s.depth,s.height,s.thickness),colour:'#50565e',assembled:p=>[p[0]-s.width/2,p[1]-s.depth/2,p[2]],explode:[0,0,0]},
    ...Array.from({length:s.trays},(_,i)=>({id:`tray-${i+1}`,label:`Removable tray ${i+1}`,mesh:tray,colour:['#c5c1b8','#a9adae','#8b9297','#b0a79b'][i],assembled:p=>[p[0]-s.width/2+s.thickness+i*bay+s.clearance/2,p[1]-s.depth/2+s.thickness+s.clearance/2,p[2]+s.thickness+(s.gridfinity?5:0)],explode:[0,0,35+i*14]}))
  ];
}

export function organiserBaseSource(s) {
  organiserParts(s);
  return `include <gridfinity_bins/gridfinity_modules.scad>
union() {
  intersection() {
    translate([20.75,20.75,0]) pad_grid(${(s.width+.5)/42},${(s.depth+.5)/42});
    linear_extrude(height=5.1) offset(r=3.75,$fn=32) offset(delta=-3.75)
      square([${s.width},${s.depth}]);
  }
  translate([0,0,5]) difference() {
    cube([${s.width},${s.depth},${s.height}]);
    translate([${s.thickness},${s.thickness},${s.thickness}])
      cube([${s.width-2*s.thickness},${s.depth-2*s.thickness},${s.height}]);
  }
}`;
}


// Drawer Bay v1: both inserts share width, depth, rail height and rear stop.
export function drawerFit(s) {
  if (![s.width,s.depth,s.height,s.thickness,s.clearance].every(Number.isFinite) || s.width<100 || s.width>240 || s.depth<80 || s.depth>220 || s.height<40 || s.height>100 || s.thickness<2 || s.thickness>5 || s.clearance<.2 || s.clearance>1.2 || !['drawer','tray'].includes(s.insert)) throw new Error('Choose drawer-bay dimensions within the supported ranges.');
  return {interface:'drawer-bay-v1',width:s.width-2*s.thickness-s.clearance,depth:s.depth-s.thickness-s.clearance,bottom:s.thickness+2,height:s.height-2*s.thickness-2-s.clearance,railProjection:3,railThickness:2};
}

export function drawerParts(s) {
  const f=drawerFit(s),t=s.thickness,h=s.insert==='tray'?Math.min(18,f.height):f.height;
  const frame=`union() {
    difference() {
      cube([${s.width},${s.height},${s.depth}]);
      translate([${t},${t},${t}]) cube([${s.width-2*t},${s.height-2*t},${s.depth}]);
    }
    for (x=[${t},${s.width-t-f.railProjection}])
      translate([x,${t},${t}]) cube([${f.railProjection},${f.railThickness},${s.depth-t}]);
  }`;
  const insert=`difference() {
    cube([${f.width},${f.depth},${h}]);
    translate([${t},${t},${t}]) cube([${f.width-2*t},${f.depth-2*t},${h}]);
    ${s.insert==='drawer'?`translate([${f.width/2},-0.1,${h}]) rotate([-90,0,0]) cylinder(r=8,h=${t+.2},$fn=32);`:''}
  }`;
  return [
    {id:'drawer-frame',label:'Drawer bay frame',source:frame,colour:'#50565e',assembled:p=>[p[0]-s.width/2,s.depth/2-p[2],p[1]],explode:[0,0,0]},
    {id:s.insert==='tray'?'open-tray':'drawer',label:s.insert==='tray'?'Interchangeable open tray':'Finger-pull drawer',source:insert,colour:'#c5c1b8',assembled:p=>[p[0]-s.width/2+t+s.clearance/2,p[1]-s.depth/2+s.clearance,p[2]+f.bottom],explode:[0,-s.depth*.65,0]}
  ];
}
