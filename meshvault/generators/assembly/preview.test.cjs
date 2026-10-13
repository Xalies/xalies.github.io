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



 const ready=()=>page.waitForFunction(()=>document.querySelector('#viewer').dataset.state==='preview'||document.querySelector('#viewer').dataset.state==='error');
 await ready();await page.locator('#toggle-system-view').click();
 for(const assembly of ['system','cabinet','drawer','organiser']){
   await page.locator('[name=assembly]').selectOption(assembly);await ready();
   assert.equal(await page.locator('#viewer').getAttribute('data-state'),'preview',await page.locator('#status').textContent());
   assert(await page.locator('#mvpack').isDisabled());assert(await page.locator('#download-kit').isDisabled());assert.equal(await page.locator('#description img').count(),0);
   assert.match(await page.locator('#status').textContent(),/Approximate layout preview/);
   for(const mode of ['assembled','exploded']){await page.locator('#view').selectOption(mode);assert(await page.locator('#viewer canvas').evaluate(canvas=>{const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');ctx.drawImage(canvas,0,0,64,64);const d=ctx.getImageData(0,0,64,64).data,colours=new Set();for(let i=0;i<d.length;i+=4)colours.add(d.slice(i,i+3).join(','));return colours.size>15;}),'Visible approximate '+assembly+' '+mode);}
   await page.locator('[name=clearance]').fill('0.8');await ready();assert.equal(workers.length,0,'No geometry workers for '+assembly);
   if(assembly==='cabinet'){await page.locator('#cabinet-output').selectOption('insert');await ready();assert.equal(await page.locator('#viewer').getAttribute('data-state'),'preview');}
 }
 await page.locator('[name=gridfinity]').check();await ready();assert.equal(workers.length,0,'Gridfinity feature does not compile while designing');
 await page.locator('[name=assembly]').selectOption('system');await ready();if(await page.locator('#toggle-system-view').getAttribute('aria-pressed')==='false')await page.locator('#toggle-system-view').click();
 if(process.env.PREVIEW_PROOF)await page.screenshot({path:process.env.PREVIEW_PROOF});
 assert.deepEqual(errors,[]);assert(!requests.some(u=>/openscad-worker|\.wasm(?:\?|$)/.test(u)),'No geometry engine downloaded in Design');
 console.log('PASS: immediate approximate assembled/exploded previews for every assembly type, standalone insert, Gridfinity option, disabled exports, no guide generation, no workers and no WASM downloads while designing');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
