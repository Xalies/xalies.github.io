const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
// Simulate an old cached geometry module at the unversioned URL.
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname.endsWith('/assembly/geometry.js')&&!url.search){res.writeHead(200,{'Content-Type':'text/javascript'}).end('export const stale = true;');return;}let f=path.join(root,url.pathname);if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');fs.readFile(f,(e,d)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':'application/octet-stream'}).end(d);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],requests=[],workers=[];page.on('worker',w=>workers.push(w.url()));page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto(`http://127.0.0.1:${server.address().port}/generators/assembly/`);


 assert.equal(await page.locator('#module-support').count(),0,'Redundant placement dropdown removed');
 await page.waitForFunction(()=>document.querySelectorAll('#system-plan button').length===3);
 const x=async id=>{await page.locator(`#system-plan [data-module="${id}"]`).click();return Number(await page.locator('#module-x').inputValue());};
 const drag=async(id,cells,cancel=false)=>{
   const box=await page.locator(`#system-plan [data-module="${id}"]`).boundingBox(),pitch=await page.locator('#system-plan').evaluate(n=>parseFloat(n.style.getPropertyValue('--grid-pitch')));
   await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+cells*pitch,box.y+box.height/2,{steps:8});if(cancel)await page.keyboard.press('Escape');await page.mouse.up();
 };
 assert((await page.locator('#system-plan').boundingBox()).height>=340,'Main layout viewport');
 assert(await page.locator('#viewer').evaluate(n=>getComputedStyle(n).visibility==='hidden'));
 await drag(3,2);assert.equal(await x(3),6,'Drag snaps two cells');
 await page.keyboard.press('ArrowLeft');assert.equal(await x(3),5,'Keyboard moves one cell');
 await page.locator('[data-module-tool=select]').click();await drag(3,2);assert.equal(await x(3),5,'Select only does not move');await page.keyboard.press('ArrowRight');assert.equal(await x(3),5,'Select only blocks keyboard movement');
 await page.locator('[data-module-tool=move]').click();await drag(3,2,true);assert.equal(await x(3),5,'Escape cancels drag');
 await drag(3,-3);assert.match(await page.locator('#system-help').textContent(),/Move cancelled.*overlap/);assert.equal(await x(3),5,'Collision leaves original position');
 await drag(1,1);assert.equal(await x(1),1);assert.equal(await x(2),1,'Moving housing moves its stack');
 await drag(2,1);assert.match(await page.locator('#system-help').textContent(),/Move cancelled.*supporting/);assert.equal(await x(2),1,'Stack stays within support');
 await drag(1,-2);assert.equal(await x(1),1,'Negative desk position rejected');

 assert(await page.locator('.build-notes').isHidden(),'Build notes absent from Design');
 const stackDrag=async(id,target,deskX)=>{
   const box=await page.locator(`#system-plan [data-module="${id}"]`).boundingBox(),pitch=await page.locator('#system-plan').evaluate(n=>parseFloat(n.style.getPropertyValue('--grid-pitch'))),bounds=await page.locator('#system-plan').boundingBox();
   const w=Number(await page.locator(`#system-plan [data-module="${id}"]`).evaluate(n=>n.style.width.replace('px','')));
   let toX,toY;
   if(target){const t=await page.locator(`#system-plan [data-module="${target}"]`).boundingBox();toX=t.x+w/2;toY=t.y-box.height/2;}
   else{toX=bounds.x+32+deskX*pitch+w/2;toY=bounds.y+bounds.height-32-box.height/2;}
   await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(toX,toY,{steps:12});
   if(target)assert(await page.locator(`#system-plan [data-module="${target}"]`).evaluate(n=>n.classList.contains('drop-target')),'Highlighted stack target');
   await page.mouse.up();
 };
 await x(3);await page.locator('#module-depthUnits').fill('5');await stackDrag(3,2);assert.match(await page.locator('#system-help').textContent(),/Move cancelled.*supporting/);assert.equal(await x(3),5);assert.equal(await page.locator('#system-plan [data-module="3"]').evaluate(n=>parseFloat(n.style.bottom)),32,'Invalid drop remains on desk');await page.locator('#module-depthUnits').fill('3');
 await stackDrag(3,2);assert.equal(await x(3),1);assert(await page.locator('#system-plan [data-module="3"]').evaluate(n=>parseFloat(n.style.bottom)>32),'Drag onto housing stacks module');
 await stackDrag(3,0,5);assert.equal(await x(3),5);assert.equal(await page.locator('#system-plan [data-module="3"]').evaluate(n=>parseFloat(n.style.bottom)),32,'Drag down un-stacks to desk');
 await stackDrag(3,2);assert(await page.locator('#system-plan [data-module="3"]').evaluate(n=>parseFloat(n.style.bottom)>32));
 await page.locator('#toggle-system-view').click();assert.equal(await page.locator('#toggle-system-view').getAttribute('aria-pressed'),'true');assert(await page.locator('#system-plan').evaluate(n=>getComputedStyle(n).visibility==='hidden'));assert(await page.locator('#viewer').evaluate(n=>getComputedStyle(n).visibility==='visible'));
 await page.waitForFunction(()=>['preview','ready'].includes(document.querySelector('#viewer').dataset.state)||document.querySelector('#status').textContent.startsWith('Could not'),{},{timeout:180000});assert(await page.evaluate(()=>document.querySelector('#viewer').dataset.state==='preview'||!document.querySelector('#mvpack').disabled),await page.locator('#status').textContent());
 assert.equal(workers.length,0,'No geometry workers during design edits, drag stacking or 3D preview');assert(await page.locator('#mvpack').isDisabled());assert.equal(await page.locator('#description img').count(),0);
 if(process.env.WORKSPACE_PROOF){await page.locator('#toggle-system-view').click();await page.screenshot({path:process.env.WORKSPACE_PROOF});await page.locator('#toggle-system-view').click();await page.screenshot({path:process.env.WORKSPACE_PROOF.replace('.png','-3d.png')});}
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#generate-plates').click();assert.equal(await page.locator('#generation-panel').getAttribute('data-state'),'building');assert.equal(await page.locator('#generation-panel').getAttribute('aria-busy'),'true');assert(await page.locator('.generation-icon').isVisible());assert(await page.locator('#build-progress').isVisible());assert.equal(await page.locator('.generation-icon').evaluate(n=>getComputedStyle(n,'::before').animationName),'none');await page.waitForFunction(()=>['preview','ready'].includes(document.querySelector('#viewer').dataset.state),{},{timeout:180000});assert.equal(await page.locator('#viewer').evaluate(n=>n.parentElement.id),'preview-3d-slot');assert.equal(await page.locator('#view').inputValue(),'print');
 assert(workers.length>0,'Generation starts geometry workers only after Generate');assert.equal(await page.locator('#generation-panel').getAttribute('data-state'),'ready');assert.equal(await page.locator('#generation-panel').getAttribute('aria-busy'),'false');
 if(process.env.WORKSPACE_PROOF)await page.screenshot({path:process.env.WORKSPACE_PROOF.replace('.png','-plates.png')});
 const event=page.waitForEvent('download');await page.locator('#mvpack').click();const bytes=[...fs.readFileSync(await(await event).path())];
 assert(await page.evaluate(async bytes=>{const {unzipSync,strFromU8}=await import('../shared/vendor/fflate.js');const files=unzipSync(new Uint8Array(bytes)),meta=JSON.parse(strFromU8(files['meshvault.models.json'])),settings=JSON.parse(strFromU8(files[meta.project.documentFiles.find(n=>n.endsWith('generator-settings.json'))]));return settings.modules.map(m=>m.x).join(',')==='1,1,1'&&settings.modules[2].support===2&&meta.packType==='project';},bytes),'Moved positions preserved in real project export');
 await page.locator('#bed-width').fill('60');await page.waitForFunction(()=>document.querySelector('#generation-panel').dataset.state==='error');assert.equal(await page.locator('#generation-panel').getAttribute('aria-busy'),'false');assert(await page.locator('#mvpack').isDisabled());await page.locator('#bed-width').fill('220');await page.waitForFunction(()=>document.querySelector('#generation-panel').dataset.state==='ready');
 await page.locator('#back-design').click();assert.equal(await page.locator('#viewer').evaluate(n=>n.parentElement.id),'system-viewport');assert.equal(await x(1),1);assert.equal(await page.locator('#toggle-system-view').getAttribute('aria-pressed'),'false');
 for(const width of [1920,1280,768,390]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Viewport overflow '+width);}
 assert.deepEqual(errors,[]);assert(requests.every(url=>url.startsWith('http://127.0.0.1:')||url.startsWith('data:')),'No external requests');
 console.log('PASS: large workspace, drag/select, grid snapping, keyboard moves, drag stacking/unstacking, animated generation states, stack movement, collision and boundary rollback, Escape, 3D toggle, print navigation, real moved-project export, responsive layout and local-only requests');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
