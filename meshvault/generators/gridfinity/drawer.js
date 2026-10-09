// SPDX-License-Identifier: GPL-2.0-only
export function gridSize(drawer) {
  return { width: Math.floor((drawer.width - drawer.clearance * 2) / 42), depth: Math.floor((drawer.depth - drawer.clearance * 2) / 42) };
}
export function newDrawer() {
  const drawer = { width:336, depth:252, height:70, clearance:0 };
  return { schema:'meshvault.gridfinity-layout', version:1, title:'My workshop drawer', author:'', donation:'https://buymeacoffee.com/xalies', drawer, magnets:false, magnetDiameter:6.5, magnetDepth:2.4, cells:Array.from({length:48},(_,i)=>[i%8,Math.floor(i/8)]), screws:[], bins:[] };
}
export function donationError(value) {
  if(!value)return '';
  try{const url=new URL(value);if(value.length<=2048&&/^https:\/\//i.test(value)&&url.protocol==='https:'&&!url.username&&!url.password)return '';}catch{}
  return 'Use an HTTPS donation URL without a username or password, or leave it blank.';
}
export function mountHeight(plan) {
  return Math.max(plan.magnets?(plan.magnetDepth ?? 2.4)+1.2:0,plan.screws.length?3.6:0);
}
export function binError(plan, bin, ignore = bin.id) {
  const size = gridSize(plan.drawer), cells = new Set(plan.cells.map(c=>c.join(',')));
  if (bin.x < 0 || bin.y < 0 || bin.x+bin.w > size.width || bin.y+bin.d > size.depth) return 'The bin must fit inside the drawer grid.';
  for (let y=bin.y;y<bin.y+bin.d;y++) for(let x=bin.x;x<bin.x+bin.w;x++) if(!cells.has(`${x},${y}`)) return 'The bin needs baseplate cells underneath it.';
  if (bin.h*7+3.75+mountHeight(plan) > plan.drawer.height) return 'The bin is too tall for this drawer, including its base and mounting layer.';
  if (bin.compartments > bin.w*3) return 'Use at most three compartments per width cell.';
  if (plan.bins.some(b=>b.id!==ignore && bin.x<b.x+b.w && bin.x+bin.w>b.x && bin.y<b.y+b.d && bin.y+bin.d>b.y)) return 'Bins cannot overlap.';
  return '';
}
export function validateDrawer(value) {
  const fail = message => { throw new Error(message); };
  const number = (n,min,max) => typeof n==='number' && Number.isFinite(n) && n>=min && n<=max;
  const integer = (n,min,max) => Number.isInteger(n) && number(n,min,max);
  if (!value || value.schema!=='meshvault.gridfinity-layout' || value.version!==1) fail('Choose a MeshVault Gridfinity layout file (version 1).');
  if (typeof value.title!=='string' || !value.title.trim() || value.title.length>100 || typeof value.author!=='string' || value.author.length>100 || typeof value.magnets!=='boolean') fail('Invalid layout details.');
  const donation=value.donation ?? '',magnetDiameter=value.magnetDiameter ?? 6.5,magnetDepth=value.magnetDepth ?? 2.4;
  if(typeof donation!=='string'||donationError(donation))fail('Invalid donation URL. Use HTTPS without credentials.');
  if(!number(magnetDiameter,3,10)||!number(magnetDepth,1,5))fail('Magnet pockets need a diameter of 3-10 mm and depth of 1-5 mm.');
  const d=value.drawer;
  if(!d || !number(d.width,42,1000) || !number(d.depth,42,1000) || !number(d.height,20,200) || !number(d.clearance,0,20)) fail('Invalid drawer dimensions.');
  const size=gridSize(d);
  if(size.width<1 || size.depth<1) fail('The drawer needs room for at least one 42 mm cell after edge clearance.');
  for(const key of ['cells','screws']) {
    if(!Array.isArray(value[key]) || value[key].length>576 || (key==='cells' && !value[key].length)) fail('Select at least one valid baseplate cell.');
    const seen=new Set();
    for(const c of value[key]) {
      if(!Array.isArray(c) || c.length!==2 || !integer(c[0],0,size.width-1) || !integer(c[1],0,size.depth-1) || seen.has(c.join(','))) fail('Invalid or duplicate grid cell.');
      seen.add(c.join(','));
    }
  }
  const cells=new Set(value.cells.map(c=>c.join(',')));
  if(value.screws.some(c=>!cells.has(c.join(',')))) fail('Screws must belong to an included baseplate cell.');
  if(!Array.isArray(value.bins) || value.bins.length>128) fail('Use at most 128 bins in one layout.');
  const ids=new Set();
  for(const b of value.bins) {
    if(!b || !integer(b.id,1,1000000) || ids.has(b.id) || typeof b.name!=='string' || !b.name.trim() || b.name.length>80 || typeof b.colour!=='string' || !/^#[0-9a-f]{6}$/i.test(b.colour) || typeof b.scoop!=='boolean' || typeof b.label!=='boolean' || !integer(b.x,0,23) || !integer(b.y,0,23) || !integer(b.w,1,6) || !integer(b.d,1,6) || !integer(b.h,2,12) || !integer(b.compartments,1,18)) fail('Invalid bin details.');
    ids.add(b.id); const error=binError(value,b); if(error) fail(`${b.name}: ${error}`);
  }
  // Copy only the supported data so imported objects cannot supply extra state.
  return {schema:value.schema,version:1,title:value.title,author:value.author,donation,magnetDiameter,magnetDepth,drawer:{width:d.width,depth:d.depth,height:d.height,clearance:d.clearance},magnets:value.magnets,cells:value.cells.map(c=>[...c]),screws:value.screws.map(c=>[...c]),bins:value.bins.map(b=>Object.fromEntries(['id','name','colour','scoop','label','x','y','w','d','h','compartments'].map(k=>[k,b[k]])))};
}
export function splitBaseplate(plan, bed, gap=5) {
  const width=Math.min(6,Math.floor((bed.width-gap*2)/42)), depth=Math.min(6,Math.floor((bed.depth-gap*2)/42));
  if(width<1 || depth<1) throw new Error('The print bed must fit at least one 42 mm cell plus edge spacing.');
  const buckets=new Map(), output=[];
  for(const c of plan.cells) {const key=`${Math.floor(c[0]/width)},${Math.floor(c[1]/depth)}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(c);}
  for(const bucket of buckets.values()) {
    const remaining=new Set(bucket.map(c=>c.join(',')));
    while(remaining.size) {
      const first=[...remaining][0].split(',').map(Number), group=[first];remaining.delete(first.join(','));
      for(let i=0;i<group.length;i++){const [x,y]=group[i];for(const c of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(remaining.delete(c.join(',')))group.push(c);}
      const x=Math.min(...group.map(c=>c[0])),y=Math.min(...group.map(c=>c[1]));
      output.push({part:'baseplate',width:Math.max(...group.map(c=>c[0]))-x+1,depth:Math.max(...group.map(c=>c[1]))-y+1,base_shape:'custom',base_magnets:plan.magnets,magnet_diameter:plan.magnetDiameter ?? 6.5,magnet_thickness:plan.magnetDepth ?? 2.4,cells:group.map(c=>[c[0]-x,c[1]-y]),screw_cells:plan.screws.filter(c=>group.some(g=>g[0]===c[0]&&g[1]===c[1])).map(c=>[c[0]-x,c[1]-y]),layoutOrigin:[x,y]});
    }
  }
  return output;
}
