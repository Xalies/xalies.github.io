// Run with Node and Playwright available through NODE_PATH.
const assert=require('node:assert/strict'), http=require('node:http'), fs=require('node:fs'), path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const server=http.createServer((req,res)=>{
  let file=path.join(root,new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'}[path.extname(file)]||'application/octet-stream'}).end(data);});
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:1920,height:1080}}), errors=[], requests=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
    await page.goto(`http://127.0.0.1:${server.address().port}/generators/gridfinity/`);
    const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('meshvault-gridfinity-drawer-v1')));
    const change=async(selector,value)=>{await page.locator(selector).fill(String(value));await page.locator(selector).dispatchEvent('change');};
    async function cell(x,y){const point=await page.locator(`#drawer-grid [data-cell="${x},${y}"] rect`).boundingBox();return {x:point.x+point.width/2,y:point.y+point.height/2};}
    async function open(plan){await page.locator('#layout-file').setInputFiles({name:'layout.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(plan))});}
    async function download(selector){const pending=page.waitForEvent('download');await page.locator(selector).click();return [...fs.readFileSync(await(await pending).path())];}
    assert(await page.locator('#drawer-planner').isVisible());assert(await page.locator('#workspace').isHidden());
    await change('#bin-settings [name=name]','Bolts');await page.locator('#add-layout-bin').click();
    assert.equal((await state()).bins[0].name,'Bolts');
    const from=await cell(0,0), to=await cell(2,1);
    await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});await page.mouse.up();
    assert.deepEqual([(await state()).bins[0].x,(await state()).bins[0].y],[2,1]);
    await page.locator('#drawer-grid').press('ArrowLeft');assert.equal((await state()).bins[0].x,1);
    await page.locator('#undo-layout').click();assert.equal((await state()).bins[0].x,2);
    await page.reload();assert.equal((await state()).bins[0].x,2);assert.equal(await page.locator('#layout-bins li').count(),1);
    const saved=JSON.parse(Buffer.from(await download('#save-layout')).toString());assert.deepEqual(saved,await state());
    await open({...saved,bins:[saved.bins[0],{...saved.bins[0],id:2}]});
    await page.waitForFunction(()=>document.querySelector('#planner-status').textContent.includes('Could not open'));
    assert.deepEqual(await state(),saved,'A rejected import must preserve the layout');
    await change('#drawer-settings [name=height]',30);
    assert.match(await page.locator('#planner-status').textContent(),/too tall/);assert.equal((await state()).drawer.height,70);
    const plan={...saved,title:'Fastener drawer',author:'Workshop Maker',drawer:{width:126,depth:84,height:60,clearance:0},magnets:true,cells:[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]],screws:[],bins:[{...saved.bins[0],x:0,y:0,h:3},{...saved.bins[0],id:2,name:'Washers',x:2,y:1,h:3}]};
    await open(plan);await page.waitForFunction(()=>document.querySelector('#drawer-settings [name=title]').value==='Fastener drawer');
    await page.locator('[data-tool=footprint]').click();let p=await cell(0,0);await page.mouse.click(p.x,p.y);
    assert.match(await page.locator('#planner-status').textContent(),/underneath/);assert.equal((await state()).cells.length,6);
    p=await cell(1,1);await page.mouse.click(p.x,p.y);assert.equal((await state()).cells.length,5);
    await page.locator('[data-tool=screws]').click();p=await cell(0,1);await page.mouse.click(p.x,p.y);assert.deepEqual((await state()).screws,[[0,1]]);
    await page.locator('#toggle-layout-view').click();assert(await page.locator('#drawer-grid').isHidden());assert(await page.locator('#drawer-3d canvas').isVisible());
    assert(await page.locator('#drawer-3d canvas').evaluate(canvas=>{const copy=document.createElement('canvas');copy.width=copy.height=64;const ctx=copy.getContext('2d');ctx.drawImage(canvas,0,0,64,64);const data=ctx.getImageData(0,0,64,64).data,colours=new Set();for(let i=0;i<data.length;i+=4)colours.add(`${data[i]},${data[i+1]},${data[i+2]}`);return colours.size>20;}));
    await page.locator('#toggle-layout-view').click();
    await page.locator('#build-layout').click();await page.locator('#cancel-layout').click();
    await page.waitForFunction(()=>document.querySelector('#build-status').textContent.includes('cancelled'));
    assert.equal(await page.locator('#set-items li').count(),0);
    await change('#planner-bed [name=width]',50);await page.locator('#build-layout').click();assert.match(await page.locator('#build-status').textContent(),/does not fit/);
    await change('#planner-bed [name=width]',100);await change('#planner-bed [name=depth]',100);
    const validPlan=await state();
    await open({...validPlan,bins:[{...validPlan.bins[0],w:3}]});
    await page.locator('#build-layout').click();assert.match(await page.locator('#build-status').textContent(),/does not fit/);
    await open(validPlan);
    await page.locator('[data-tool=screws]').click();await page.locator('#drawer-grid [data-cell=\"0,1\"]').press('Enter');assert.equal((await state()).screws.length,0);
    await page.locator('#drawer-grid [data-cell=\"0,1\"]').press('Enter');assert.equal((await state()).screws.length,1);
    console.log('PASS: drag, keyboard move, undo, reload, portable JSON, invalid import, height/footprint checks, screws, visible 3D and cancellation. Generating real models…');
    await page.locator('#build-layout').click();
    await page.waitForFunction(()=>!document.querySelector('#workspace').hidden,{},{timeout:240000});
    assert.equal(await page.locator('#set-items li').count(),3,'Two baseplate sections and one shared bin design');
    assert.equal(await page.locator('[name=bedWidth]').inputValue(),'100');
    const pack=await download('#export-set');
    const result=await page.evaluate(async bytes=>{
      const {unzipSync,strFromU8}=await import('/generators/shared/vendor/fflate.js');const files=unzipSync(new Uint8Array(bytes)),manifest=JSON.parse(strFromU8(files['meshvault.models.json']));
      const layout=JSON.parse(strFromU8(files[manifest.project.documentFiles.find(f=>f.endsWith('drawer-layout.json'))]));
      const settings=manifest.models.map(m=>JSON.parse(strFromU8(files[m.documentFiles[0]])));
      const parts=settings.flatMap(s=>s.parts);
      const models=manifest.models.map(m=>{const xml=new DOMParser().parseFromString(strFromU8(unzipSync(files[m.relativePath])['3D/3dmodel.model']),'application/xml');return {valid:!xml.querySelector('parsererror')&&xml.documentElement.getAttribute('unit')==='millimeter',triangles:xml.getElementsByTagName('triangle').length};});
      return {packType:manifest.packType,author:manifest.project.author,layout,parts,models,thumbnail:[...files[manifest.project.thumbnailFile].slice(0,8)]};
    },pack);
    assert.equal(result.packType,'project');assert.equal(result.author,'Workshop Maker');assert.deepEqual(result.layout,await state());
    assert(result.models.length>=2&&result.models.every(m=>m.valid&&m.triangles>100));
    assert.deepEqual(result.thumbnail,[137,80,78,71,13,10,26,10]);
    const base=result.parts.filter(p=>p.settings.part==='baseplate'),bins=result.parts.filter(p=>p.settings.part==='bin');
    assert.equal(base.reduce((n,p)=>n+p.settings.cells.length,0),5);assert.equal(base.reduce((n,p)=>n+p.settings.screw_cells.length,0),1);assert(base.every(p=>p.settings.base_magnets));
    assert.equal(bins.length,2);assert(bins.every(p=>p.settings.screw_depth===0&&p.settings.magnet_diameter===6.5));
    await page.locator('#set-format').selectOption('stl');const zip=await download('#export-set-zip');
    const stls=await page.evaluate(async bytes=>{const {unzipSync,strFromU8}=await import('/generators/shared/vendor/fflate.js');return Object.entries(unzipSync(new Uint8Array(bytes))).map(([name,bytes])=>({name,triangles:new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(80,true),valid:bytes.length===84+new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(80,true)*50}));},zip);
    assert.equal(stls.length,result.models.length);assert(stls.every(s=>s.name.endsWith('.stl')&&s.valid&&s.triangles>100));
    await page.locator('#mode-planner').click();await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);assert(requests.every(url=>/^(http:\/\/127\.0\.0\.1:|blob:|data:)/.test(url)),requests.filter(url=>!url.startsWith('http://127.0.0.1:')).join('\n'));
    console.log(`PASS: real local WASM generation, shaped baseplate splitting, magnet/screw settings, quantities, ${result.models.length} bed-sized plates, project/layout/author/thumbnail, valid 3MF, STL ZIP, no remote requests and mobile.`);
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
