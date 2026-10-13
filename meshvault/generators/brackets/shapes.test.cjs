const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Simulate a browser retaining the original, unversioned L-only module.
  const staleGeometry=fs.readFileSync(path.join(__dirname,'geometry.js'),'utf8').replace(/^import .*\r?\n/,'').replace("  if(s.type&&s.type!=='l')return profileMesh(s);",'');
  await page.route('**/brackets/geometry.js',route=>route.fulfill({contentType:'text/javascript',body:staleGeometry}));
  await page.goto('http://127.0.0.1:4173/meshvault/generators/brackets/');
  await page.waitForFunction(()=>!document.querySelector('#mvpack').disabled);
  const result=await page.evaluate(async()=>{
    const {bracketMesh}=await import('./geometry.js?v=20261010-saddles');let cases=0;
    for(const type of ['u','z','flat'])for(const holes of [1,2])for(const [edgeChamfer,holeChamfer] of [[0,0],[1,0],[0,1],[1,1]])for(const dims of [[65,50,30,5,4.5,12],[180,160,80,12,10,20]]){
      const [length,height,width,thickness,diameter,edge]=dims,s={type,length,height,width,thickness,diameter,edge,holes,edgeChamfer,holeChamfer};
      const {positions:p,indices:ix}=bracketMesh(s),edges=new Map(),adj=new Map();let volume=0;
      for(let i=0;i<ix.length;i+=3){const [a,b,c]=ix.slice(i,i+3).map(k=>p.slice(k*3,k*3+3));volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;for(let j=0;j<3;j++){const a=ix[i+j],b=ix[i+(j+1)%3],key=[a,b].sort((a,b)=>a-b).join(','),e=edges.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);if(!adj.has(a))adj.set(a,new Set());if(!adj.has(b))adj.set(b,new Set());adj.get(a).add(b);adj.get(b).add(a);}}
      const bad=[...edges.entries()].filter(([,e])=>e[0]!==2||e[1]!==0);if(bad.length)return {s,bad:bad.slice(0,5)};
      const seen=new Set([ix[0]]),queue=[ix[0]];for(let i=0;i<queue.length;i++)for(const n of adj.get(queue[i]))if(!seen.has(n)){seen.add(n);queue.push(n);}
      if(seen.size!==p.length/3||volume<=0||Math.min(...p.filter((_,i)=>i%3===2))!==0)return {s,volume,connected:seen.size===p.length/3};
      if(!edgeChamfer){const area=type==='flat'?length*thickness:type==='u'?length*thickness+2*thickness*(height-thickness):2*length*thickness+thickness*(height-2*thickness),count=holes*(type==='u'?3:type==='z'?2:1),r=diameter/2,K=16*Math.sin(Math.PI/16),expected=area*width-count*K*(r*r*thickness+2*(r*holeChamfer**2+holeChamfer**3/3));if(Math.abs(volume-expected)>expected*1e-4)return {s,volume,expected};}
      cases++;
    }
    for(const type of ['u','z','flat','saddle','halfSaddle']){try{bracketMesh({type,length:30,height:30,width:18,thickness:12,diameter:10,edge:20,holes:2});return {acceptedInvalid:type};}catch{}}
    return {cases};
  });assert.deepEqual(result,{cases:48});
  await page.locator('#creator [name=author]').fill('Shape tester');
  const previews=new Set([await page.locator('#viewer canvas').evaluate(canvas=>canvas.toDataURL())]);
  for(const type of ['u','z','flat','saddle','halfSaddle']){
    await page.locator('#settings [name=type]').selectOption(type);await page.waitForFunction(()=>!document.querySelector('#mvpack').disabled);
    assert.equal(await page.locator('#settings [name=height]').isVisible(),!['flat','saddle','halfSaddle'].includes(type));
    const preview=await page.locator('#viewer canvas').evaluate(canvas=>canvas.toDataURL());assert(!previews.has(preview),'Shape selection must change the rendered preview');previews.add(preview);
    for(const format of ['stl','3mf']){await page.locator('#format').selectOption(format);await page.waitForFunction(()=>!document.querySelector('#mvpack').disabled);const event=page.waitForEvent('download');await page.locator('#mvpack').click();const download=await event,bytes=[...fs.readFileSync(await download.path())];const metadata=await page.evaluate(async({bytes,format})=>{const {unzipSync,strFromU8}=await import('../shared/vendor/fflate.js');const zip=unzipSync(new Uint8Array(bytes)),m=JSON.parse(strFromU8(zip['meshvault.model.json'])),s=JSON.parse(strFromU8(zip[m.documentFiles[0]]));if(!zip['custom-bracket.'+format]?.length)throw Error('Missing model');return {type:s.type,description:m.descriptionHtml};},{bytes,format});assert.equal(metadata.type,type);assert.match(metadata.description,/Shape tester/);assert(!metadata.description.includes('undefined'));}
    await page.screenshot({path:path.join(os.tmpdir(),`bracket-${type}.png`)});
  }
  assert.deepEqual(errors,[]);console.log('PASS: 48 closed, connected, consistently wound shape/chamfer meshes, volume checks, invalid clearance, adaptive controls and real STL/3MF mvpack exports for U, Z, flat plates, saddles and half saddles.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
