// Run with Node and Playwright available through NODE_PATH.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  let file = path.join(root, new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await page.goto(`http://127.0.0.1:${server.address().port}/generators/gridfinity/`);
    for(const [magnets,screws,diameter,depth] of [[false,false,6.5,2.4],[true,false,6.5,2.4],[false,true,6.5,2.4],[true,true,6.5,2.4],[true,true,10,4]]) {
      const stl=await page.evaluate(async({magnets,screws,diameter,depth})=>{
        const {buildPart}=await import('./build-part.js?v=20261009-plates');
        const result=await buildPart({part:'baseplate',width:2,depth:2,cells:[[0,0],[1,0],[0,1]],base_magnets:magnets,screw_cells:screws?[[0,0]]:[],magnet_diameter:diameter,magnet_thickness:depth});
        return result.stl.text();
      },{magnets,screws,diameter,depth});
        const check = await page.evaluate(async ({stl,magnets,screws,diameter,depth}) => {
          const {asciiSTLMesh} = await import('/generators/shared/mvpack.js');
          const {positions:p,indices:t} = asciiSTLMesh(stl), edges=new Map(), neighbours=new Map();
          const v=i=>p.slice(i*3,i*3+3), sub=(a,b)=>a.map((n,i)=>n-b[i]);
          const dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0), cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
          function inside(point) {
            const ray=[1,.173,.291],hits=[];
            for(let i=0;i<t.length;i+=3){const a=v(t[i]),e1=sub(v(t[i+1]),a),e2=sub(v(t[i+2]),a),h=cross(ray,e2),det=dot(e1,h);if(Math.abs(det)<1e-8)continue;
              const f=1/det,s=sub(point,a),u=f*dot(s,h);if(u<0||u>1)continue;const q=cross(s,e1),w=f*dot(ray,q);if(w<0||u+w>1)continue;const d=f*dot(e2,q);if(d>1e-7&&!hits.some(x=>Math.abs(x-d)<1e-5))hits.push(d);
            } return hits.length%2===1;
          }
          for(let i=0;i<t.length;i+=3)for(const [a,b] of [[t[i],t[i+1]],[t[i+1],t[i+2]],[t[i+2],t[i]]]){
            const k=[a,b].sort((a,b)=>a-b).join(',');edges.set(k,(edges.get(k)||0)+1);
            if(!neighbours.has(a))neighbours.set(a,new Set());if(!neighbours.has(b))neighbours.set(b,new Set());neighbours.get(a).add(b);neighbours.get(b).add(a);
          }
          const seen=new Set([t[0]]),queue=[t[0]];for(let i=0;i<queue.length;i++)for(const n of neighbours.get(queue[i]))if(!seen.has(n)){seen.add(n);queue.push(n);}
          const extra=Math.max(magnets?depth+1.2:0,screws?3.6:0),position=Math.min(13,17-diameter/2);
          const zs=p.filter((_,i)=>i%3===2);
          return {closed:[...edges.values()].every(n=>n===2),connected:seen.size===p.length/3,minZ:Math.min(...zs),height:Math.max(...zs),open:!inside([8,4,1]),centreHole:!inside([0,0,1]),screwBoss:inside([3,0,1]),countersink:!inside([2.8,.2,extra-.1]),unselectedOpen:!inside([45,0,1]),missingEmpty:!inside([42,42,1]),magnetFloors:[-position,position].every(x=>[-position,position].every(y=>inside([x,y,.6])===magnets)),magnetPockets:[-position,position].every(x=>[-position,position].every(y=>!inside([x,y,1.2+depth/2])))};
        },{stl,magnets,screws,diameter,depth});
        assert(check.closed && check.connected, JSON.stringify(check));
        assert(Math.abs(check.minZ)<.001 && Math.abs(check.height-(5+Math.max(magnets?depth+1.2:0,screws?3.6:0)))<.01);
        assert(check.open && check.centreHole && check.countersink && check.unselectedOpen && check.missingEmpty && check.magnetFloors && check.magnetPockets, JSON.stringify(check));
        assert.equal(check.screwBoss,screws);
    }
    // Check an actual bin pocket ceiling at the non-default depth.
    const pocket=await page.evaluate(async()=>{
      const {buildPart}=await import('./build-part.js?v=20261009-plates');
      const {asciiSTLMesh}=await import('../shared/mvpack.js');
      const result=await buildPart({part:'bin',width:1,depth:1,height:3,chambers:1,withLabel:'disabled',fingerslide:false,wall_thickness:.95,floor_thickness:.7,magnet_diameter:10,magnet_thickness:4,screw_depth:0});
      const {positions:p,indices:t}=asciiSTLMesh(await result.stl.text());
      const ceiling=[];
      for(let i=0;i<t.length;i+=3){const points=t.slice(i,i+3).map(v=>p.slice(v*3,v*3+3));if(points.every(v=>Math.abs(v[2]-4)<.001)&&points.some(v=>Math.abs(v[0]-12)<5.1&&Math.abs(v[1]-12)<5.1))ceiling.push(...points);}
      return {ceiling:ceiling.length,triangles:t.length/3};
    });
    assert(pocket.ceiling>0&&pocket.triangles>100,'Custom bin pockets must have a real ceiling at 4 mm');
    assert.deepEqual(errors,[]);console.log('PASS: real closed connected baseplates, open centres, default/custom magnet pockets and floors, screws, custom bin depth.');
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
