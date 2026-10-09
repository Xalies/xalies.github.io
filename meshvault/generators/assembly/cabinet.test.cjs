const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const server=http.createServer((req,res)=>{let f=path.join(root,new URL(req.url,'http://localhost').pathname);if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');fs.readFile(f,(e,d)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':'application/octet-stream'}).end(d);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto(`http://127.0.0.1:${server.address().port}/generators/assembly/`);
 const ready=async()=>{await page.waitForFunction(()=>!document.querySelector('#mvpack').disabled||document.querySelector('#status').textContent.startsWith('Could not'),{},{timeout:180000});assert(await page.locator('#mvpack').isEnabled(),await page.locator('#status').textContent());};await ready();
 assert.equal(await page.locator('#bay-plan button').count(),4);assert.match(await page.locator('#dimensions').textContent(),/300 × 156.4 × 145/);
 assert.match(await page.locator('#assembly-fit').textContent(),/8 M3 × 8 mm/);
 assert(await page.evaluate(async()=>{
   const {newCabinet,cabinetParts,cabinetHardware}=await import('./cabinet.js');
   const s={...newCabinet(),width:150,depth:150,thickness:4,clearance:.6},parts=cabinetParts(s);
   if(parts.length!==7||cabinetHardware(s).screws!==8)return false;
   // Joint axes coincide at each shared wall in assembled coordinates.
   const a=parts.find(p=>p.id==='bay-1-drawer-frame'),b=parts.find(p=>p.id==='bay-2-drawer-frame'),c=parts.find(p=>p.id==='bay-3-drawer-frame');
   if(JSON.stringify(a.assembled([150,32.5,52.5]))!==JSON.stringify(b.assembled([0,32.5,52.5])))return false;
   if(JSON.stringify(a.assembled([75,65,52.5]))!==JSON.stringify(c.assembled([75,0,52.5])))return false;
   for(const invalid of [{columns:4},{heights:[NaN]},{thickness:3},{bays:[]},{bays:s.bays.map(b=>({...b,type:'<script>'}))}]){try{cabinetParts({...s,...invalid});return false;}catch{}}
   return true;
 }),'Layout validation and joint axes');
 const download=async selector=>{const event=page.waitForEvent('download');await page.locator(selector).click();return [...fs.readFileSync(await (await event).path())];};
 async function inspect(bytes,packed,grid=false){return page.evaluate(async({bytes,packed,grid})=>{
   const {unzipSync,strFromU8}=await import('../shared/vendor/fflate.js');const files=unzipSync(new Uint8Array(bytes)),meta=JSON.parse(strFromU8(files['meshvault.models.json']));
   if(meta.packType!=='project'||meta.project.settings===null)return false;
   const settings=JSON.parse(strFromU8(files[meta.project.documentFiles.find(n=>n.endsWith('generator-settings.json'))]));if(settings.assembly!=='cabinet'||settings.moduleInterface!=='cabinet-bay-v1'||settings.bays.length!==4)return false;
   const layout=JSON.parse(strFromU8(files[meta.project.documentFiles.find(n=>n.endsWith('printer-layout.json'))]));
   const ids=layout.plates.flatMap(p=>p.placements.map(p=>p.part));if(ids.length!==(grid?8:7)||new Set(ids).size!==ids.length)return false;
   if(meta.models.length!==(packed?layout.plates.length:grid?8:7))return false;
   for(const m of meta.models){
     const doc=new DOMParser().parseFromString(strFromU8(unzipSync(files[m.relativePath])['3D/3dmodel.model']),'application/xml');
     const p=Array.from(doc.getElementsByTagName('vertex'),v=>['x','y','z'].map(a=>Number(v.getAttribute(a)))),edges=new Map(),parent=p.map((_,i)=>i),root=i=>parent[i]===i?i:(parent[i]=root(parent[i]));let volume=0;
     for(const tri of doc.getElementsByTagName('triangle')){const t=['v1','v2','v3'].map(a=>Number(tri.getAttribute(a))),[a,b,c]=t.map(i=>p[i]);volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3],key=[a,b].sort((a,b)=>a-b).join(','),e=edges.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);parent[root(a)]=root(b);}}
     if(volume<=0||p.some(v=>v.some(n=>!Number.isFinite(n))||v[2]<-1e-5)||[...edges.values()].some(([n,b])=>n!==2||b!==0))return false;
     if(!packed&&new Set(parent.map((_,i)=>root(i))).size!==1)return false;
     if(packed&&p.some(v=>v[0]<5-1e-4||v[1]<5-1e-4||v[0]>layout.bed.width-5+1e-4||v[1]>layout.bed.depth-5+1e-4))return false;
     if(!packed&&m.fileName.endsWith('bay-1-insert.3mf')){
       // Dividers, handle and label rails add vertices away from the simple box shell.
       if(settings.bays[0].handle==='bar'&&!p.some(v=>v[1]<-6.9))return false;
       if(settings.bays[0].handle==='notch'&&!settings.bays[0].labelHolder&&(p.some(v=>v[1]<-1e-5)||!p.some(v=>Math.abs(v[0]-70.7)<.001&&Math.abs(v[1])<.001&&Math.abs(v[2]-46.4)<.001)))return false;
     }
   }
   const csv=strFromU8(files[meta.project.documentFiles.find(n=>n.endsWith('.csv'))]);if(!csv.includes('M3 x 8 mm countersunk screw,8')||!csv.includes('M3 hex nut,8'))return false;
   return true;
 },{bytes,packed,grid});}
 await page.locator('#arranged-export').uncheck();await ready();assert(await inspect(await download('#mvpack'),false),'Closed connected individual parts with hardware BOM');
 await page.locator('#arranged-export').check();await ready();assert(await inspect(await download('#mvpack'),true),'Packed plates inside bed with complete unique inventory');
 await page.locator('#bay-plan button[data-bay="3"]').click();await page.locator('#bay-type').selectOption('gridfinity');await ready();
 assert(await inspect(await download('#mvpack'),true,true),'Gridfinity tray export');
 await page.locator('#arranged-export').uncheck();await ready();assert(await inspect(await download('#mvpack'),false,true),'Connected Gridfinity socket tray');
 await page.locator('#bay-plan button[data-bay="0"]').click();await page.locator('#bay-across').selectOption('4');await page.locator('#bay-deep').selectOption('3');await page.locator('#bay-handle').selectOption('notch');await page.locator('#bay-label-holder').uncheck();await ready();assert(await inspect(await download('#mvpack'),false,true),'Custom divider counts, finger notch and disabled label holder');
 await page.locator('#format').selectOption('stl');const stl=await download('#download-kit');assert(await page.evaluate(async bytes=>{const {unzipSync}=await import('../shared/vendor/fflate.js');return Object.values(unzipSync(new Uint8Array(bytes))).every(b=>{const v=new DataView(b.buffer,b.byteOffset,b.byteLength);return b.length===84+v.getUint32(80,true)*50;});},stl),'Binary STL exports');await page.locator('#format').selectOption('3mf');
 await page.locator('#bay-plan button[data-bay="3"]').click();await page.locator('#bay-label').fill('<svg onload=alert(1)>');await ready();assert.equal(await page.locator('#bay-plan svg,#description svg').count(),0);assert.match(await page.locator('#bay-plan button[data-bay="3"] strong').textContent(),/<svg/);
 await page.locator('#bay-plan button[data-bay="0"]').click();await page.locator('[name=height]').fill('72');await ready();assert.match(await page.locator('#bay-plan button[data-bay="1"]').textContent(),/72 mm/);
 await page.locator('#add-column').click();await ready();assert.equal(await page.locator('#bay-plan button').count(),6);await page.locator('#remove-column').click();await ready();
 await page.locator('#add-row').click();await ready();assert.equal(await page.locator('#bay-plan button').count(),6);await page.locator('#remove-row').click();await ready();
 await page.locator('#bed-width').fill('60');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('does not fit'));assert(await page.locator('#mvpack').isDisabled());await page.locator('#bed-width').fill('220');await ready();
 for(const mode of ['print','exploded','assembled']){await page.locator('#view').selectOption(mode);assert(await page.locator('#viewer canvas').evaluate(c=>c.width>0));}
 for(const preset of ['desk','tools','parts']){await page.locator(`[data-cabinet-preset=${preset}]`).click();await ready();assert.equal(await page.locator('#bay-plan button').count(),preset==='desk'?3:4);}
 if(process.env.CABINET_PROOF){await page.locator('#arranged-export').check();await ready();await page.screenshot({path:process.env.CABINET_PROOF});await page.locator('#viewer').screenshot({path:path.join(root,'images/assembly-studio.png')});}
 for(const viewport of [{width:1920,height:1080},{width:1366,height:768},{width:390,height:844}]){await page.setViewportSize(viewport);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');}
 assert.equal(errors.length,0,errors.join('\n'));assert(requests.every(u=>/^(http:\/\/127\.0\.0\.1:|blob:|data:)/.test(u)),'No external requests');console.log('PASS: visual bay planner, joint alignment, closed connected printable meshes, Gridfinity tray, plate bounds/inventory, STL/3MF/project exports, hardware BOM, presets, invalid bed handling, escaped labels and responsive layout.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
