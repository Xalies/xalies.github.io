const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const {chromium} = require('playwright');
const root = path.resolve(__dirname,'../..');
const server = http.createServer((req,res)=>{
  let file=path.join(root,new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream'}).end(data);});
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1920,height:1080}}), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/generators/assembly/`);
    await page.waitForFunction(()=>!document.querySelector('#mvpack').disabled);
    assert.equal(await page.locator('#description img').count(),3);
    assert(await page.locator('#description img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth===1280&&i.naturalHeight===720)));
    const geometry = await page.evaluate(async()=>{
      const {riserParts}=await import('./geometry.js');
      for(const s of [{width:120,depth:100,height:65,thickness:6,clearance:.3},{width:80,depth:70,height:40,thickness:4,clearance:.1},{width:200,depth:160,height:100,thickness:10,clearance:.8}]){
        const parts=riserParts(s);if(parts.length!==5)return false;
        for(let n=0;n<parts.length;n++){
          const {positions:p,indices:i}=parts[n].mesh, edges=new Map();let volume=0;
          for(let j=0;j<i.length;j+=3){
            const vertices=i.slice(j,j+3).map(k=>p.slice(k*3,k*3+3)),[a,b,c]=vertices;
            volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
            for(const [a,b] of [[i[j],i[j+1]],[i[j+1],i[j+2]],[i[j+2],i[j]]]){const key=[a,b].sort((a,b)=>a-b).join(',');const e=edges.get(key)||{count:0,balance:0};e.count++;e.balance+=a<b?1:-1;edges.set(key,e);}
          }
          if([...edges.values()].some(e=>e.count!==2||e.balance!==0))return false;
          const expected=n<2?((s.depth-14)*s.height-2*(12+s.clearance)*(16+s.clearance))*s.thickness:n<4?(s.width+2*s.thickness+4)*12*16:(s.width+2*s.thickness)*s.depth*4;
          if(Math.abs(volume-expected)>expected*1e-5||Math.min(...p.filter((_,j)=>j%3===2))<0)return false;
        }
        const railPoint=parts[2].assembled([(s.width+2*s.thickness+4)/2,6,8]);
        if(railPoint[1]!==24-s.depth/2||Math.abs(railPoint[2]-s.height*.45)>1e-5)return false;
        const frameCentre=parts[0].assembled([24,s.height*.45,s.thickness/2]);
        if(frameCentre[1]!==railPoint[1]||frameCentre[2]!==railPoint[2])return false;
      }
      try{riserParts({width:0,depth:100,height:65,thickness:6,clearance:.3});return false;}catch{}
      return true;
    });assert(geometry,'Closed, consistently wound meshes with correct volumes and aligned joints at default / min / max dimensions');
    async function downloaded(selector){const event=page.waitForEvent('download');await page.locator(selector).click();return fs.readFileSync(await (await event).path());}
    for(const format of ['3mf','stl']){
      await page.locator('#format').selectOption(format);
      const zip=await downloaded('#download-kit'),pack=await downloaded('#mvpack');
      const result=await page.evaluate(async({zip,pack,format})=>{
        const {unzipSync,strFromU8}=await import('../shared/vendor/fflate.js');
        const normal=unzipSync(new Uint8Array(zip)),entries=unzipSync(new Uint8Array(pack)),meta=JSON.parse(strFromU8(entries['meshvault.models.json']));
        if(Object.keys(normal).length!==5||meta.schema!=='meshvault.models'||meta.models.length!==5||entries['meshvault.model.json'])return false;
        for(const m of meta.models){
          if(m.author!=='Xalies'||m.extraImageFiles.length!==3||m.documentFiles.length!==3||JSON.parse(m.printSettingsJson).quantity!==1)return false;
          const name=m.fileName.replace(/^\d+-/,''),bytes=entries[m.relativePath];
          if(!normal[m.relativePath]||!bytes.every((v,i)=>v===normal[m.relativePath][i]))return false;
          if(format==='3mf'){const xml=strFromU8(unzipSync(bytes)['3D/3dmodel.model']);if(!xml.includes('unit="millimeter"')||!xml.includes('<triangle'))return false;}
          else {const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(bytes.length!==84+50*d.getUint32(80,true))return false;}
          for(const file of [m.thumbnailFile,...m.extraImageFiles]){const png=entries[file];if(!png)return false;const d=new DataView(png.buffer,png.byteOffset,png.byteLength);if(d.getUint32(16)!==1280||d.getUint32(20)!==720)return false;}
          for(const file of m.documentFiles)if(!entries[file])return false;
          const guide=strFromU8(entries[m.documentFiles.find(f=>f.endsWith('assembly-guide.html'))]);
          if(!guide.startsWith('<!doctype html>')||!guide.includes('data:image/png;base64,')||guide.includes('src="http'))return false;
          const doc=new DOMParser().parseFromString(m.descriptionHtml,'text/html');
          if(doc.querySelectorAll('img').length!==3||!doc.querySelector('table')||doc.querySelectorAll('ol li').length!==4||doc.querySelectorAll('a[href^="https://"]').length<3)return false;
        }return true;
      },{zip:[...zip],pack:[...pack],format});assert(result,'Model bytes, rich HTML, embedded pictures, gallery and document references');
    }
    for(const mode of ['exploded','print','assembled']){await page.locator('#view').selectOption(mode);assert(await page.locator('#viewer canvas').evaluate(canvas=>{const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');ctx.drawImage(canvas,0,0,64,64);const d=ctx.getImageData(0,0,64,64).data,colours=new Set();for(let i=0;i<d.length;i+=4)colours.add(d.slice(i,i+3).join(','));return colours.size>20;}));}
    await page.locator('[name=title]').fill('<img src=x onerror="alert(1)">');await page.waitForFunction(()=>!document.querySelector('#mvpack').disabled);
    assert.equal(await page.locator('#description img').count(),3);assert.match(await page.locator('#description h2').textContent(),/<img/);
    await page.locator('[name=clearance]').fill('0');assert(await page.locator('#mvpack').isDisabled());
    await page.locator('[name=clearance]').fill('0.3');await page.locator('[name=title]').fill('My display riser');await page.waitForFunction(()=>!document.querySelector('#mvpack').disabled);
    await page.locator('[data-preset=wide]').click();await page.waitForFunction(()=>!document.querySelector('#mvpack').disabled);assert.match(await page.locator('#dimensions').textContent(),/192 × 140 × 84/);
    await page.locator('[data-preset=small]').click();await page.waitForFunction(()=>!document.querySelector('#mvpack').disabled);
    if(process.env.UPDATE_THUMBNAIL)await page.locator('#viewer').screenshot({path:path.join(root,'images/assembly-studio.png')});
    for(const viewport of [{width:1920,height:1200},{width:1366,height:768},{width:390,height:844}]){await page.setViewportSize(viewport);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');}
    assert.equal(errors.length,0,errors.join('\n'));console.log('PASS: five closed meshes, joint fit, dimension bounds, STL/3MF ZIP and mvpack, rich HTML, offline guide, gallery, escaping and desktop/mobile previews.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
