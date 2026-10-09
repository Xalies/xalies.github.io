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
    const page=await browser.newPage({viewport:{width:1920,height:1080}}), errors=[],requests=[];
    page.on('request',r=>requests.push(r.url()));
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/generators/assembly/`);
    await page.waitForFunction(()=>!document.querySelector('#mvpack').disabled);
    assert.equal(await page.locator('.demo-account').count(),0);
    assert.equal(await page.locator('#author').inputValue(),'');
    await page.locator('.author-details summary').click();
    await page.locator('#author').fill('Casey <Builder>');
    await page.locator('#author-url').fill('http://example.org');assert.equal(await page.locator('#author-url').evaluate(n=>n.checkValidity()),false);
    await page.locator('#author-url').fill('https://example.org/casey');
    await page.locator('#donation').fill('https://example.org/support?name=casey&via=assembly');
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
    assert(await page.evaluate(async()=>{
      const {organiserParts}=await import('./geometry.js');
      for(const s of [{width:180,depth:120,height:35,thickness:2.4,clearance:.4,trays:3},{width:120,depth:70,height:25,thickness:1.6,clearance:.2,trays:4},{width:240,depth:180,height:70,thickness:4,clearance:1.2,trays:2}]){
        const parts=organiserParts(s);if(parts.length!==s.trays+1)return false;
        for(const part of parts){
          const {positions:p,indices}=part.mesh,edges=new Map();let volume=0;
          for(let i=0;i<indices.length;i+=3){
            const [a,b,c]=indices.slice(i,i+3).map(j=>p.slice(j*3,j*3+3));volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
            for(let j=0;j<3;j++){const a=indices[i+j],b=indices[i+(j+1)%3],key=[a,b].sort((a,b)=>a-b).join(','),e=edges.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);}
          }
          const w=Math.max(...p.filter((_,i)=>i%3===0)),d=Math.max(...p.filter((_,i)=>i%3===1)),h=Math.max(...p.filter((_,i)=>i%3===2)),t=s.thickness;
          const expected=w*d*h-(w-2*t)*(d-2*t)*(h-t);
          if(Math.abs(volume-expected)>1e-5||[...edges.values()].some(([n,b])=>n!==2||b!==0))return false;
        }
        const trayWidth=(s.width-2*s.thickness)/s.trays-s.clearance;
        for(let i=1;i<parts.length;i++){
          const a=parts[i].assembled([0,0,0]),b=parts[i].assembled([trayWidth,s.depth-2*s.thickness-s.clearance,s.height-s.thickness+3]);
          if(Math.abs(a[2]-s.thickness)>1e-8||Math.abs(b[2]-s.height-3)>1e-8||a[0]<-s.width/2+s.thickness||b[0]>s.width/2-s.thickness||a[1]<-s.depth/2+s.thickness||b[1]>s.depth/2-s.thickness)return false;
          if(i>1&&Math.abs(a[0]-parts[i-1].assembled([trayWidth,0,0])[0]-s.clearance)>1e-8)return false;
        }
      }
      for(const invalid of [{trays:1},{trays:2.5},{thickness:0},{clearance:0},{gridfinity:true}]){try{organiserParts({width:180,depth:120,height:35,thickness:2.4,clearance:.4,trays:3,...invalid});return false;}catch{}}
      return true;
    }),'Organiser meshes are closed, have the expected material volume and fit side by side with the selected clearance');
    async function downloaded(selector){const event=page.waitForEvent('download');await page.locator(selector).click();return fs.readFileSync(await (await event).path());}
    for(const assembly of ['riser','organiser','gridfinity']){
      if(assembly==='organiser') {await page.locator('[name=assembly]').selectOption('organiser');await page.waitForFunction(()=>!document.querySelector('#mvpack').disabled);}
      if(assembly==='gridfinity') {await page.locator('[name=gridfinity]').check();await page.waitForFunction(()=>!document.querySelector('#mvpack').disabled,{},{timeout:180000});}
      const count=assembly==='riser'?5:4;
    for(const format of ['3mf','stl']){
      await page.locator('#format').selectOption(format);
      const zip=await downloaded('#download-kit'),pack=await downloaded('#mvpack');
      if(assembly==='riser'&&format==='3mf'&&process.env.PROJECT_FIXTURE)fs.writeFileSync(process.env.PROJECT_FIXTURE,pack);
      const result=await page.evaluate(async({zip,pack,format,count,assembly})=>{
        const {unzipSync,strFromU8}=await import('../shared/vendor/fflate.js');
        const normal=unzipSync(new Uint8Array(zip)),entries=unzipSync(new Uint8Array(pack)),meta=JSON.parse(strFromU8(entries['meshvault.models.json']));
        if(Object.keys(normal).length!==count||meta.schema!=='meshvault.models'||meta.models.length!==count||meta.packType!=='project'||entries['meshvault.model.json'])return false;
        if(meta.project.author!=='Casey <Builder>'||meta.project.authorUrl!=='https://example.org/casey'||meta.project.extraImageFiles.length!==3||meta.project.documentFiles.length!==3)return false;
        const settings=JSON.parse(strFromU8(entries[meta.project.documentFiles.find(f=>f.endsWith('.json'))]));
        if(settings.assembly!==(assembly==='riser'?'riser':'organiser')||settings.gridfinity!==(assembly==='gridfinity'))return false;
        const csv=strFromU8(entries[meta.project.documentFiles.find(f=>f.endsWith('.csv'))]);
        if(csv.trim().split('\n').length!==count+1||!meta.project.descriptionHtml.includes('Support Casey &lt;Builder&gt;'))return false;
        for(const m of meta.models){
          if(m.author!=='Casey <Builder>'||m.extraImageFiles||m.documentFiles.length!==1||JSON.parse(m.printSettingsJson).quantity!==1)return false;
          const name=m.fileName.replace(/^\d+-/,''),bytes=entries[m.relativePath];
          if(!normal[m.relativePath]||!bytes.every((v,i)=>v===normal[m.relativePath][i]))return false;
          if(format==='3mf'){
            const xml=strFromU8(unzipSync(bytes)['3D/3dmodel.model']);if(!xml.includes('unit="millimeter"')||!xml.includes('<triangle'))return false;
            if(assembly==='gridfinity'&&m.title.endsWith('Tray carrier')){
              const doc=new DOMParser().parseFromString(xml,'application/xml'),vertices=[...doc.getElementsByTagName('vertex')].map(v=>['x','y','z'].map(a=>Number(v.getAttribute(a))));
              const bottom=vertices.filter(v=>Math.abs(v[2])<1e-6),cells=new Set(bottom.map(v=>`${Math.floor((v[0]+.25)/42)},${Math.floor((v[1]+.25)/42)}`));
              if(cells.size!==12||Math.abs(Math.max(...vertices.map(v=>v[2]))-40)>1e-5||Math.abs(Math.max(...vertices.map(v=>v[0]))-167.5)>1e-5||!vertices.some(v=>Math.abs(v[2]-7.4)<1e-5))return false;
              const edges=new Map(),parent=vertices.map((_,i)=>i),root=i=>parent[i]===i?i:(parent[i]=root(parent[i]));
              for(const tri of doc.getElementsByTagName('triangle')){const t=['v1','v2','v3'].map(a=>Number(tri.getAttribute(a)));for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3],key=[a,b].sort((a,b)=>a-b).join(','),e=edges.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);parent[root(a)]=root(b);}}
              if([...edges.values()].some(([n,b])=>n!==2||b!==0)||new Set(parent.map((_,i)=>root(i))).size!==1)return false;
            }
          }
          else {const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(bytes.length!==84+50*d.getUint32(80,true))return false;}
          for(const file of [meta.project.thumbnailFile,...meta.project.extraImageFiles]){const png=entries[file];if(!png)return false;const d=new DataView(png.buffer,png.byteOffset,png.byteLength);if(d.getUint32(16)!==1280||d.getUint32(20)!==720)return false;}
          for(const file of [...m.documentFiles,...meta.project.documentFiles])if(!entries[file])return false;
          const guide=strFromU8(entries[meta.project.documentFiles.find(f=>f.endsWith('assembly-guide.html'))]);
          if(!guide.startsWith('<!doctype html>')||!guide.includes('data:image/png;base64,')||guide.includes('src="http'))return false;
          const doc=new DOMParser().parseFromString(meta.project.descriptionHtml,'text/html');
          if(doc.querySelectorAll('img').length!==3||!doc.querySelector('table')||doc.querySelectorAll('ol li').length!==4||doc.querySelectorAll('a[href^="https://"]').length<3)return false;
        }return true;
      },{zip:[...zip],pack:[...pack],format,count,assembly});assert(result,`${assembly}: model bytes, author, rich HTML, pictures, parts list, settings and document references`);
    }
    }
    await page.locator('[name=assembly]').selectOption('riser');await page.waitForFunction(()=>!document.querySelector('#mvpack').disabled);
    for(const mode of ['exploded','print','assembled']){await page.locator('#view').selectOption(mode);assert(await page.locator('#viewer canvas').evaluate(canvas=>{const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');ctx.drawImage(canvas,0,0,64,64);const d=ctx.getImageData(0,0,64,64).data,colours=new Set();for(let i=0;i<d.length;i+=4)colours.add(d.slice(i,i+3).join(','));return colours.size>20;}));}
    await page.locator('[name=title]').fill('<img src=x onerror="alert(1)">');await page.waitForFunction(()=>!document.querySelector('#mvpack').disabled);
    assert.equal(await page.locator('#description img').count(),3);assert.match(await page.locator('#description h2').textContent(),/<img/);
    await page.locator('[name=clearance]').fill('0');assert(await page.locator('#mvpack').isDisabled());
    await page.locator('[name=clearance]').fill('0.3');await page.locator('[name=title]').fill('My display riser');await page.waitForFunction(()=>!document.querySelector('#mvpack').disabled);
    await page.locator('[data-preset=wide]').click();await page.waitForFunction(()=>!document.querySelector('#mvpack').disabled);assert.match(await page.locator('#dimensions').textContent(),/192 × 140 × 84/);
    await page.locator('[data-preset=small]').click();await page.waitForFunction(()=>!document.querySelector('#mvpack').disabled);
    if(process.env.UPDATE_THUMBNAIL)await page.locator('#viewer').screenshot({path:path.join(root,'images/assembly-studio.png')});
    for(const viewport of [{width:1920,height:1200},{width:1366,height:768},{width:390,height:844}]){await page.setViewportSize(viewport);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');}
    assert(requests.every(url=>/^(http:\/\/127\.0\.0\.1:|blob:|data:)/.test(url)),'Generation and exports stay local');
    assert.equal(errors.length,0,errors.join('\n'));console.log('PASS: riser and organiser geometry, tray clearances, integrated Gridfinity carrier, STL/3MF ZIP and project exports, author links, rich HTML, offline guides and responsive previews.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
