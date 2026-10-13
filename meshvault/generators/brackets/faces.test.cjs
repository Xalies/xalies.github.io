const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/meshvault/generators/brackets/');await page.waitForFunction(()=>!document.querySelector('#mvpack').disabled);
  const result=await page.evaluate(async()=>{
    const {bracketMesh}=await import('./geometry.js?v=20261010-saddles'),{mountingFaces,saddleProfile}=await import('./profiles.js?v=20261010-saddles');let cases=0;
    for(const type of ['l','u','z','flat','saddle','halfSaddle'])for(const chamfer of [0,1])for(const count of [0,1,2])for(const variant of ['saddle','halfSaddle'].includes(type)?['default','small','large']:['default']){
      const s={type,saddleDiameter:25,footLength:40,length:65,height:50,width:30,thickness:5,diameter:4.5,edge:12,holes:2,edgeChamfer:chamfer,holeChamfer:chamfer};if(variant==='small')Object.assign(s,{saddleDiameter:6,thickness:3,edgeChamfer:chamfer*.7,holeChamfer:chamfer*.7});if(variant==='large')Object.assign(s,{saddleDiameter:120,thickness:12,width:80,footLength:60,edgeChamfer:chamfer*3,holeChamfer:chamfer*3});const faces=mountingFaces(s);s.faceHoles=Object.fromEntries(faces.map((f,i)=>[f.id,{holes:i?1:count,diameter:i?3:6,edge:12,offset:i?-3:2}]));
      const {positions:p,indices:ix}=bracketMesh(s),edges=new Map(),adj=new Map();let volume=0;
      for(let i=0;i<ix.length;i+=3){const [a,b,c]=ix.slice(i,i+3).map(k=>p.slice(k*3,k*3+3));volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;for(let j=0;j<3;j++){const a=ix[i+j],b=ix[i+(j+1)%3],key=[a,b].sort((a,b)=>a-b).join(','),e=edges.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);if(!adj.has(a))adj.set(a,new Set());if(!adj.has(b))adj.set(b,new Set());adj.get(a).add(b);adj.get(b).add(a);}}
      if([...edges.values()].some(([n,w])=>n!==2||w!==0))return {s,closed:false};const seen=new Set([ix[0]]),queue=[ix[0]];for(let i=0;i<queue.length;i++)for(const n of adj.get(queue[i]))if(!seen.has(n)){seen.add(n);queue.push(n);}if(seen.size!==p.length/3||volume<=0)return {s,volume,connected:false};
      if(!chamfer&&variant==='default'){const profile=saddleProfile(s),saddleArea=Math.abs(profile.reduce((sum,p,i)=>{const q=profile[(i+1)%profile.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;const area=['saddle','halfSaddle'].includes(type)?saddleArea:type==='flat'?65*5:type==='l'?5*(65+50-5):type==='u'?65*5+2*5*(50-5):2*65*5+5*(50-10),removed=Object.values(s.faceHoles).reduce((v,c)=>v+c.holes*16*Math.sin(Math.PI/16)*(c.diameter/2)**2*5,0);if(Math.abs(volume-(area*30-removed))>1)return {s,volume,expected:area*30-removed};}
      cases++;
    }
    try{bracketMesh({type:'l',length:65,height:50,width:30,thickness:5,diameter:4.5,edge:12,holes:2,faceHoles:{base:{holes:1,diameter:6,edge:12,offset:14}}});return {invalidAccepted:true};}catch{}
    return {cases};
  });assert.deepEqual(result,{cases:60});
  const box=await page.locator('#viewer').boundingBox();
  for(let y=.3;y<.8&&await page.locator('#face-controls').isHidden();y+=.08)for(let x=.3;x<.8&&await page.locator('#face-controls').isHidden();x+=.08)await page.mouse.click(box.x+box.width*x,box.y+box.height*y);
  assert(await page.locator('#face-controls').isVisible(),'Clicking a mounting face must select it');
  await page.locator('[data-face=base]').click();await page.locator('#face-holes').selectOption('1');await page.locator('#face-diameter').fill('6');await page.locator('#face-offset').fill('2');await page.locator('#face-along').fill('3');await page.waitForFunction(()=>!document.querySelector('#mvpack').disabled);
  await page.locator('[data-face=upright]').click();assert.equal(await page.locator('#face-holes').inputValue(),'2');assert.equal(await page.locator('#face-diameter').inputValue(),'4.5');
  await page.locator('#face-holes').selectOption('0');await page.waitForFunction(()=>!document.querySelector('#mvpack').disabled);
  await page.locator('[data-face=base]').click();assert.equal(await page.locator('#face-diameter').inputValue(),'6');assert.equal(await page.locator('#face-offset').inputValue(),'2');
  await page.locator('#creator [name=author]').fill('Independent faces');const event=page.waitForEvent('download');await page.locator('#mvpack').click();const d=await event,bytes=[...fs.readFileSync(await d.path())];
  const exported=await page.evaluate(async bytes=>{const {unzipSync,strFromU8}=await import('../shared/vendor/fflate.js'),zip=unzipSync(new Uint8Array(bytes)),m=JSON.parse(strFromU8(zip['meshvault.model.json']));return {settings:JSON.parse(strFromU8(zip[m.documentFiles[0]])),html:m.descriptionHtml};},bytes);
  assert.deepEqual(exported.settings.faceHoles.base,{holes:1,diameter:6,edge:12,offset:2,along:3});assert.equal(exported.settings.faceHoles.upright.holes,0);assert.match(exported.html,/Base leg: 1 holes, 6 mm bore/);assert.match(exported.html,/Upright leg: 0 holes/);
  await page.locator('#face-offset').fill('20');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('leave at least'));assert(await page.locator('#mvpack').isDisabled());await page.locator('#reset-face').click();await page.waitForFunction(()=>!document.querySelector('#mvpack').disabled);assert.equal(await page.locator('#face-holes').inputValue(),'2');
  assert.deepEqual(errors,[]);console.log('PASS: 60 independently perforated closed connected meshes, volume checks, viewport face picking, independent controls, export settings/description and clearance rejection/reset.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
