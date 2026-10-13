const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
// Simulate an old cached geometry module at the unversioned URL.
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname.endsWith('/assembly/geometry.js')&&!url.search){res.writeHead(200,{'Content-Type':'text/javascript'}).end('export const stale = true;');return;}let f=path.join(root,url.pathname);if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');fs.readFile(f,(e,d)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':'application/octet-stream'}).end(d);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto(`http://127.0.0.1:${server.address().port}/generators/assembly/`);

 const design=async()=>{if(await page.locator('#back-design').isVisible()){await page.locator('#back-design').click();await ready();}};
 const printing=async()=>{if(await page.locator('#generate-plates').isVisible()){await page.locator('#generate-plates').click();await ready();}};
 const ready=async()=>{await page.waitForFunction(()=>['preview','ready'].includes(document.querySelector('#viewer').dataset.state)||document.querySelector('#status').textContent.startsWith('Could not'),{},{timeout:180000});assert(await page.evaluate(()=>document.querySelector('#viewer').dataset.state==='preview'||!document.querySelector('#mvpack').disabled),await page.locator('#status').textContent());};await ready();
 assert.equal(await page.locator('body').getAttribute('data-step'),'design');
 assert(await page.locator('#settings').isVisible());assert(await page.locator('#printer').isHidden());assert(await page.locator('#mvpack').isHidden());
 const originalTitle=await page.locator('[name=title]').inputValue();
 await page.locator('#generate-plates').click();
 assert.equal(await page.locator('body').getAttribute('data-step'),'print');assert(await page.locator('#settings').isHidden());assert(await page.locator('#system-planner').isHidden());
 await ready();assert(await page.locator('#printer').isVisible());assert(await page.locator('#mvpack').isVisible());assert.equal(await page.locator('#view').inputValue(),'print');assert.match(await page.locator('#plate-summary').textContent(),/7 parts.*plates/);
 await page.locator('#bed-width').fill('60');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('does not fit'));assert(await page.locator('#mvpack').isDisabled());
 await page.locator('#back-design').click();await ready();assert.equal(await page.locator('[name=title]').inputValue(),originalTitle);assert.equal(await page.locator('#view').inputValue(),'assembled');
 await page.locator('#print-step').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('does not fit'));await page.locator('#bed-width').fill('220');await ready();await design();
 console.log('PASS two-step navigation, preserved settings, plate preview and bed-error recovery');
 assert.equal(await page.locator('#system-plan button').count(),3);
 await design();await page.locator('#system-plan [data-module="3"]').click();await design();await page.locator('#module-x').fill('5');await design();await page.locator('#system-plan [data-module="1"]').click();assert.match(await page.locator('#module-heading').textContent(),/Module 1/);
 await design();await page.locator('#module-label').fill('Parts');await design();await page.locator('#system-plan [data-module="3"]').click();assert.match(await page.locator('#module-heading').textContent(),/Module 3/);await design();await page.locator('#module-x').fill('4');await design();await page.locator('#system-plan [data-module="1"]').focus();await page.keyboard.press('Enter');assert.match(await page.locator('#module-heading').textContent(),/Module 1/);await ready();

 assert(await page.evaluate(async()=>{
   const {newSystem,systemLayout,newModule,systemParts,panelGeometry,systemHardware,accessoryCell}=await import('./system.js');const s={...newSystem(),clearance:.6};
   if(systemLayout(s)[1].bottom!==61)return false;
   const single={modules:[{...newModule(1),depthUnits:2,heightUnits:6,sidePanels:'both'}],clearance:.6},layout=systemLayout(single)[0],panel=panelGeometry(layout),hardware=systemHardware(single);if(!panel.cells.length||hardware.screws!==8||hardware.nuts!==8)return false;
   const side=systemParts(single).find(p=>p.id==='module-1-hsw-left'),mount=side.assembled([...panel.mounts[0],8]);if(JSON.stringify(mount)!==JSON.stringify([-16,layout.depth-12,17]))return false;
   for(const patch of [{rightInsert:'<script>'},{rightHoleDiameter:NaN},{sidePanels:'oops'},{labelHolder:'true'},{leftAccessory:'<script>'}]){try{systemParts({...s,modules:s.modules.map(m=>({...m,...patch}))});return false;}catch{}}

   const a={modules:[{...newModule(1),sidePanels:'both',leftAccessory:'mount',rightAccessory:'hook',labelHolder:true}],clearance:.6},h=systemHardware(a),m=systemLayout(a)[0],cell=accessoryCell(m),pieces=systemParts(a);
   if(h.accessoryScrews!==2||h.nuts!==10||h.labels!==1)return false;
   for(const p of pieces){const o=p.assembled([0,0,0]),axes=[[1,0,0],[0,1,0],[0,0,1]].map(v=>p.assembled(v).map((n,i)=>n-o[i])),[a,b,c]=axes,det=a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]);if(Math.abs(det-1)>1e-5)return false;}

   const plate=pieces.find(p=>p.id==='module-1-hsw-left-mount').assembled([13,-22,0]),clamp=pieces.find(p=>p.id==='module-1-hsw-left-clamp').assembled([0,0,4]);
   if(Math.abs(plate[0]+20)>1e-5||Math.abs(clamp[0]+6.1)>1e-5||Math.abs(plate[1]-clamp[1])>1e-5||Math.abs(plate[2]-clamp[2])>1e-5)return false;
   try{accessoryCell({...m,height:42});return false;}catch{}
   const part=systemParts(s).find(p=>p.id==='module-3-insert-1'),slope=60/116.9,angle=(180-Math.atan(slope)*180/Math.PI)*Math.PI/180,lift=14/Math.sqrt(1+slope*slope),point=[10,20,14+slope*20],printed=[point[0],point[1]*Math.cos(angle)-point[2]*Math.sin(angle),point[1]*Math.sin(angle)+point[2]*Math.cos(angle)+lift],assembled=part.assembled(printed);
   if(Math.abs(printed[2])>1e-5||assembled.some((v,i)=>Math.abs(v-([182.6,24.3,point[2]+9][i]))>1e-5))return false;
   const bad=[{modules:[]},{clearance:NaN},{modules:[...s.modules,newModule(1)]},{modules:s.modules.map(m=>({...m,support:m.id===1?2:m.support}))},{modules:s.modules.map(m=>({...m,support:m.id===2?99:m.support}))},{modules:s.modules.map(m=>({...m,widthUnits:m.id===2?5:m.widthUnits}))},{modules:s.modules.map(m=>({...m,x:m.id===3?0:m.x}))},{modules:s.modules.map(m=>({...m,gridBase:m.id===2?false:m.gridBase}))}];
   for(const patch of bad){try{systemLayout({...s,...patch});return false;}catch{}}return true;
 }),'Stack validation, cycle rejection, footprint bounds and overlap');
 const download=async selector=>{await printing();await ready();const event=page.waitForEvent('download');await page.locator(selector).click();return [...fs.readFileSync(await (await event).path())];};
 async function inspect(bytes,packed,count,panels=0,accessories=0,labels=0){return page.evaluate(async({bytes,packed,count,panels,accessories,labels})=>{
   const {unzipSync,strFromU8}=await import('../shared/vendor/fflate.js');const files=unzipSync(new Uint8Array(bytes)),meta=JSON.parse(strFromU8(files['meshvault.models.json']));
   for(const file of [meta.project.thumbnailFile,...meta.project.extraImageFiles]){const png=files[file];if(!png)throw Error('Missing gallery');const d=new DataView(png.buffer,png.byteOffset,png.byteLength);if(d.getUint32(16)!==1280||d.getUint32(20)!==720)throw Error('16:9 gallery');}
   if(meta.packType!=='project')throw Error('Project type');
   const documentFile=suffix=>files[meta.project.documentFiles.find(n=>n.endsWith(suffix))];
   const settings=JSON.parse(strFromU8(documentFile('generator-settings.json'))),layout=JSON.parse(strFromU8(documentFile('printer-layout.json')));
   if(settings.assembly!=='system'||settings.moduleInterface!=='workstation-v1')throw Error('Settings');
   const ids=layout.plates.flatMap(p=>p.placements.map(p=>p.part));if(ids.length!==count||new Set(ids).size!==count)throw Error('Inventory');
   if(meta.models.length!==(packed?layout.plates.length:count))throw Error('Models');
   const guide=strFromU8(documentFile('assembly-guide.html'));if(!guide.includes('Module layout')||!guide.includes('data:image/png;base64,'))throw Error('Guide/BOM');
   const csv=strFromU8(documentFile('parts-list.csv'));if(panels?(!csv.includes(`M3 x 20 mm countersunk screw,${panels*4}`)||!csv.includes(`M3 hex nut,${panels*4+accessories}`)||!guide.includes('socket coupon')):csv.includes('M3'))throw Error('Panel hardware BOM');

   if(accessories&&!csv.includes(`M3 x 16 mm countersunk screw,${accessories}`))throw Error('Accessory screws');
   const labelFile=meta.project.documentFiles.find(n=>n.endsWith('labels.html'));
   if(labels){
     if(!labelFile||!csv.includes(`Paper label 36 x 9 mm,${labels}`))throw Error('Label inventory');
     const sheet=strFromU8(files[labelFile]),iframe=document.createElement('iframe');iframe.style.cssText='position:absolute;left:-10000px;width:800px;height:400px';iframe.srcdoc=sheet;const loaded=new Promise(r=>iframe.onload=r);document.body.append(iframe);await loaded;
     const nodes=iframe.contentDocument.querySelectorAll('.label');if(nodes.length!==labels||iframe.contentDocument.querySelector('svg,img,script'))throw Error('Escaped label sheet');
     for(const node of nodes){const b=node.getBoundingClientRect();if(Math.abs(b.width-36*96/25.4)>.1||Math.abs(b.height-9*96/25.4)>.1)throw Error('Actual-size label sheet');}iframe.remove();
   }else if(labelFile)throw Error('Unexpected label sheet');
   for(const m of meta.models){
     const doc=new DOMParser().parseFromString(strFromU8(unzipSync(files[m.relativePath])['3D/3dmodel.model']),'application/xml');
     const p=Array.from(doc.getElementsByTagName('vertex'),v=>['x','y','z'].map(a=>Number(v.getAttribute(a)))),edges=new Map(),parent=p.map((_,i)=>i),root=i=>parent[i]===i?i:(parent[i]=root(parent[i]));let volume=0,labelHit=Infinity;
     for(const tri of doc.getElementsByTagName('triangle')){const t=['v1','v2','v3'].map(a=>Number(tri.getAttribute(a))),[a,b,c]=t.map(i=>p[i]);if(labels&&!packed&&m.fileName.endsWith('module-1-drawer.3mf')){
       const cx=(settings.modules[0].widthUnits*42-.5-8-settings.clearance)/2,z=6,den=(b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]);
       if(Math.abs(den)>1e-8){const u=((cx-a[0])*(c[2]-a[2])-(c[0]-a[0])*(z-a[2]))/den,v=((b[0]-a[0])*(z-a[2])-(cx-a[0])*(b[2]-a[2]))/den;if(u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8)labelHit=Math.min(labelHit,a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]));}
     }volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3],key=[a,b].sort((a,b)=>a-b).join(','),e=edges.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);parent[root(a)]=root(b);}}
     if(m.fileName.endsWith('hsw-fit-coupon.3mf'))for(const [z,flat] of [[0,22],[2.9,20],[7.5,20],[8,21]])if(!p.some(v=>Math.abs(v[2]-z)<1e-4&&Math.abs(v[1]-(15-flat/2))<1e-4&&v[0]>4&&v[0]<28))throw Error('HSW socket depth profile');
     if(labels&&!packed&&m.fileName.endsWith('module-1-drawer.3mf')&&Math.abs(labelHit+3)>1e-4)throw Error('Label window blocked');
     if(volume<=0||p.some(v=>v.some(n=>!Number.isFinite(n))||v[2]<-1e-5)||[...edges.values()].some(([n,b])=>n!==2||b!==0))throw Error('Mesh topology/bounds: '+m.fileName);
     if(!packed&&new Set(parent.map((_,i)=>root(i))).size!==1)throw Error('Mesh topology/bounds: '+m.fileName);
     if(packed&&p.some(v=>v[0]<5-1e-4||v[1]<5-1e-4||v[0]>layout.bed.width-5+1e-4||v[1]>layout.bed.depth-5+1e-4))throw Error('Mesh topology/bounds: '+m.fileName);

   }
   return true;
 },{bytes,packed,count,panels,accessories,labels});}
 await printing();await page.locator('#arranged-export').uncheck();await ready();assert(await inspect(await download('#mvpack'),false,7),'Closed connected default meshes');console.log('PASS default meshes');
 await printing();await page.locator('#arranged-export').check();await ready();assert(await inspect(await download('#mvpack'),true,7),'Packed plates');console.log('PASS plates');
 await design();await page.locator('#system-plan [data-module="3"]').click();
 for(const insert of ['tray','blank']){await design();await page.locator('#module-insert').selectOption(insert);await ready();await printing();await page.locator('#arranged-export').uncheck();await ready();assert(await inspect(await download('#mvpack'),false,7),insert+' meshes');console.log('PASS '+insert);}
 await design();await page.locator('#module-insert').selectOption('holes');await design();await page.locator('#module-holeDiameter').fill('16');await ready();assert(await inspect(await download('#mvpack'),false,7),'Custom hole meshes');

 await design();await page.locator('#module-rightInsert').selectOption('blank');await ready();assert(await inspect(await download('#mvpack'),false,7),'Mixed tool-hole and blank inserts');
 await design();await page.locator('#module-rightInsert').selectOption('holes');await design();await page.locator('#module-rightHoleDiameter').fill('20');await ready();assert(await inspect(await download('#mvpack'),false,7),'Independent right hole diameter');
 await design();await page.locator('#module-rightInsert').selectOption('tray');await ready();
 await design();await page.locator('#system-plan [data-module="1"]').click();await design();await page.locator('#module-sidePanels').selectOption('left');await ready();assert(await inspect(await download('#mvpack'),false,9,1),'Left panel, reinforced housing, coupon and hardware');console.log('PASS left HSW panel and coupon');
 await design();await page.locator('#module-sidePanels').selectOption('both');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('overlap'));assert(await page.locator('#mvpack').isDisabled());
 await design();await page.locator('#system-plan [data-module="3"]').click();await design();await page.locator('#module-x').fill('5');await ready();assert(await inspect(await download('#mvpack'),false,10,2),'Both side panels');
 await printing();await page.locator('#arranged-export').check();await ready();assert(await inspect(await download('#mvpack'),true,10,2),'Packed HSW panels and complete inventory');console.log('PASS both HSW panels and plate exports');
 await design();await page.locator('#system-plan [data-module="1"]').click();await design();await page.locator('#module-labelHolder').check();await design();await page.locator('#module-label').fill('Fasteners <svg onload=alert(1)>');await design();await page.locator('#module-leftAccessory').selectOption('mount');await ready();
 await design();await page.locator('#module-rightAccessory').selectOption('hook');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('overlap'));assert(await page.locator('#mvpack').isDisabled());
 await design();await page.locator('#system-plan [data-module="3"]').click();assert.match(await page.locator('#module-heading').textContent(),/Module 3/);await design();await page.locator('#module-x').fill('6');await ready();await printing();await page.locator('#arranged-export').uncheck();await ready();assert(await inspect(await download('#mvpack'),false,14,2,2,1),'Connected accessories, clamps, label window and actual-size escaped labels');console.log('PASS labels, mounting plate, utility hook and clamps');const sheet=Buffer.from(await download('#download-labels')).toString('utf8');assert(sheet.includes('width:36mm')&&sheet.includes('Fasteners &lt;svg'),'Standalone label download');
 await printing();await page.locator('#arranged-export').check();await ready();assert(await inspect(await download('#mvpack'),true,14,2,2,1),'Complete accessory plates and hardware');
 await printing();await page.locator('#format').selectOption('stl');const accessorySTL=await download('#download-kit');assert(await page.evaluate(async bytes=>{const {unzipSync}=await import('../shared/vendor/fflate.js');return Object.values(unzipSync(new Uint8Array(bytes))).every(b=>b.length===84+new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(80,true)*50);},accessorySTL),'Accessory STL plates');await printing();await page.locator('#format').selectOption('3mf');
 if(process.env.SYSTEM_PROOF){await design();await page.locator('#toggle-system-view').click();await page.locator('#view').selectOption('assembled');await page.evaluate(()=>{scrollTo(0,0);document.querySelector('#settings').scrollTop=0;});await page.screenshot({path:process.env.SYSTEM_PROOF});await page.locator('#viewer').screenshot({path:path.join(root,'images/assembly-studio.png')});await page.locator('#toggle-system-view').click();}
 await design();await page.locator('#system-plan [data-module="1"]').click();await design();await page.locator('#module-sidePanels').selectOption('none');await ready();await design();await page.locator('#system-plan [data-module="3"]').click();await design();await page.locator('#module-x').fill('4');await ready();await printing();await page.locator('#arranged-export').uncheck();await ready();assert(await inspect(await download('#mvpack'),false,7,0,0,1),'No panels leaves no coupon or hardware');
 await design();await page.locator('#system-plan [data-module="1"]').click();await design();await page.locator('#module-heightUnits').fill('6');await ready();assert(await inspect(await download('#mvpack'),false,7,0,0,1),'Minimum-height label holder and open pull');await design();await page.locator('#module-labelHolder').uncheck();await design();await page.locator('#module-heightUnits').fill('8');await ready();
 await design();await page.locator('#new-module-kind').selectOption('bin');await design();await page.locator('#add-module').click();await ready();assert(await inspect(await download('#mvpack'),false,8),'Open-bin mesh');console.log('PASS bin');
 await design();await page.locator('#module-label').fill('<svg onload=alert(1)>');await design();await page.locator('#module-widthUnits').fill('2');await design();await page.locator('#module-heightUnits').fill('6');await ready();assert.equal(await page.locator('#system-plan svg,#description svg').count(),0);assert(await inspect(await download('#mvpack'),false,8),'Independent module dimensions');
 await design();await page.locator('#remove-module').click();await ready();
 await printing();await page.locator('#format').selectOption('stl');const stl=await download('#download-kit');assert(await page.evaluate(async bytes=>{const {unzipSync}=await import('../shared/vendor/fflate.js');return Object.values(unzipSync(new Uint8Array(bytes))).every(b=>{const v=new DataView(b.buffer,b.byteOffset,b.byteLength);return b.length===84+v.getUint32(80,true)*50;});},stl),'Binary STL exports');await printing();await page.locator('#format').selectOption('3mf');
 await printing();await page.locator('#bed-width').fill('60');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('does not fit'));assert(await page.locator('#mvpack').isDisabled());await printing();await page.locator('#bed-width').fill('220');await ready();
 await design();await page.locator('#system-plan [data-module="1"]').click();assert(await page.locator('#remove-module').isDisabled());
 await design();await page.locator('#toggle-system-view').click();
 for(const mode of ['print','exploded','assembled']){if(mode==='print')await printing();else{await design();if(await page.locator('#toggle-system-view').getAttribute('aria-pressed')==='false')await page.locator('#toggle-system-view').click();}await page.locator('#view').selectOption(mode);assert(await page.locator('#viewer canvas').evaluate(c=>c.width>0));}

 for(const viewport of [{width:1920,height:1080},{width:1366,height:768},{width:390,height:844}]){await page.setViewportSize(viewport);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow at '+viewport.width);}
 assert.equal(errors.length,0,errors.join('\n'));assert(requests.every(u=>/^(http:\/\/127\.0\.0\.1:|blob:|data:)/.test(u)),'No external requests');console.log('PASS: paper labels, open label windows, actual-size safe label sheets, mounting plates, utility hooks, rear clamps, accessory hardware/clearance, mixed maker inserts, HSW socket profile, both panel sides, reinforced mounts, coupon, hardware BOM, panel collision recovery, modular workstation, stack validation, connected closed geometry, all insert types, independent sizes, STL/3MF/project exports, plate inventory and bounds, escaped labels, invalid bed recovery, responsive layout and no external requests.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
