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
    async function choosePreset(name) {
      const details=page.locator('.starting-shape');if(await details.getAttribute('open')===null)await details.locator('summary').click();
      await page.locator(`[data-preset=${name}]`).click();await details.locator('summary').click();
    }
    async function profilePosition(radius,y) {
      return page.evaluate(({radius,y})=>{const svg=document.querySelector('#profile-editor'),d=svg.dataset;const p=new DOMPoint(Number(d.centre)+radius*Number(d.scale),Number(d.floor)-y*Number(d.scale)).matrixTransform(svg.getScreenCTM());return {x:p.x,y:p.y};},{radius,y});
    }
    async function downloaded(button) {
      const waiting = page.waitForEvent('download');
      await page.locator(button).click();
      const download = await waiting;
      return { name: download.suggestedFilename(), bytes: [...fs.readFileSync(await download.path())] };
    }
    async function visiblePreview() {
      assert(await page.locator('#viewer canvas').evaluate(canvas => {
        const sample = document.createElement('canvas'); sample.width = sample.height = 64;
        const context = sample.getContext('2d'); context.drawImage(canvas, 0, 0, 64, 64);
        const data = context.getImageData(0, 0, 64, 64).data, colours = new Set();
        for (let i = 0; i < data.length; i += 4) colours.add(`${data[i]},${data[i+1]},${data[i+2]}`);
        return colours.size > 20;
      }), 'Preview must render visible geometry, including after resizing');
    }
    async function inspectPackage(bytes, modelBytes, extension) {
      const expectedAuthor = await page.evaluate(() => document.querySelector('#author') ? document.querySelector('#author').value.trim() || 'Anonymous' : 'Xalies');
      const result = await page.evaluate(async ({ bytes, modelBytes, extension, expectedAuthor }) => {
        const { unzipSync, strFromU8 } = await import('/generators/shared/vendor/fflate.js');
        const entries = unzipSync(new Uint8Array(bytes));
        const meta = JSON.parse(strFromU8(entries['meshvault.model.json']));
        const model = entries[meta.relativePath];
        const png = entries[meta.thumbnailFile];
        if (meta.author !== expectedAuthor) throw new Error('Export author does not match');
        if (png) { const size = new DataView(png.buffer, png.byteOffset, png.byteLength); if (size.getUint32(16) !== 1280 || size.getUint32(20) !== 720) throw new Error('Thumbnail must be 1280 × 720'); }
        const settings = JSON.parse(strFromU8(entries[meta.documentFiles[0]]));
        let valid3mf = true;
        if (extension === '3mf') {
          const inner = unzipSync(model);
          const xml = new DOMParser().parseFromString(strFromU8(inner['3D/3dmodel.model']), 'application/xml');
          valid3mf = !xml.querySelector('parsererror') && xml.documentElement.getAttribute('unit') === 'millimeter' && xml.getElementsByTagName('triangle').length > 10 && !!inner['_rels/.rels'] && !!inner['[Content_Types].xml'];
        }
        return {
          valid3mf, title: meta.title, schema: meta.schema, version: meta.version,
          sameBytes: model.length === modelBytes.length && model.every((b, i) => b === modelBytes[i]),
          thumbnail: png && [...png.slice(0, 8)].join(',') === '137,80,78,71,13,10,26,10',
          settings: !!settings, parameters: settings, printedStatus: 'printedStatus' in meta,
          count: Object.keys(entries).filter(name => /\.(stl|3mf)$/i.test(name)).length,
          safePaths: Object.keys(entries).every(name => !name.startsWith('/') && !name.split('/').some(p => p === '.' || p === '..')),
          format: meta.fileType, printNotes: meta.printSettingsJson, supportUrl: meta.exportDonationUrl, authorUrl: meta.authorUrl, descriptionHtml: meta.descriptionHtml
        };
      }, { bytes, modelBytes, extension, expectedAuthor });
      assert.equal(result.schema, 'meshvault.model'); assert.equal(result.version, 1);
      assert(result.title && result.sameBytes && result.thumbnail && result.settings && result.valid3mf && result.safePaths);
      assert.equal(result.printedStatus, false); assert.equal(result.count, 1); assert.equal(result.format, extension.toUpperCase());
      if (result.parameters.part === 'bin') assert.equal(result.parameters.screw_depth, 0, 'Bin screw holes must be disabled in generated geometry and settings');
      return result;
    }
    await page.goto(`http://127.0.0.1:${server.address().port}/generators/vessels/`);
    await page.waitForFunction(() => document.querySelector('#viewer').dataset.loaded === 'true');
    assert.equal(await page.locator('.demo-account').count(),0);
    assert.equal(await page.locator('#author').inputValue(),'');
    await page.locator('.author-details summary').click();
    await page.locator('#author').fill('Avery <Maker>');
    await page.locator('#author-url').fill('http://example.org/avery');assert.equal(await page.locator('#author-url').evaluate(n=>n.checkValidity()),false);
    await page.locator('#author-url').fill('https://example.org/avery');
    await page.locator('#donation').fill('https://user:pass@example.org');assert.equal(await page.locator('#donation').evaluate(n=>n.checkValidity()),false);
    await page.locator('#donation').fill('https://example.org/support?via=vessels&author=avery');
    await page.reload();await page.waitForFunction(()=>document.querySelector('#viewer').dataset.loaded==='true');
    assert.equal(await page.locator('#author').inputValue(),'Avery <Maker>');assert.equal(await page.locator('#author-url').inputValue(),'https://example.org/avery');
    const handle=page.locator('#profile-editor [data-size=belly]');
    assert(await page.locator('#profile-shape').evaluate(n=>n.getBBox().height>document.querySelector('#profile-editor').viewBox.baseVal.height*.75),'Default profile fills the editor height');
    await handle.focus();await handle.press('ArrowRight');assert.equal(await page.locator('[name=belly]').inputValue(),'101');
    await handle.press('Shift+ArrowLeft');assert.equal(await page.locator('[name=belly]').inputValue(),'91');
    await handle.press('Home');assert.equal(await page.locator('[name=belly]').inputValue(),'25');
    await handle.press('End');assert.equal(await page.locator('[name=belly]').inputValue(),'260');

    const mouth=await page.locator('#profile-editor [data-size=mouth] circle').boundingBox();
    await page.mouse.move(mouth.x+mouth.width/2,mouth.y+mouth.height/2);await page.mouse.down();
    const dragScale=await page.locator('#profile-editor').getAttribute('data-scale'),mouthTarget=await profilePosition(60,210);
    await page.mouse.move(mouthTarget.x,mouthTarget.y,{steps:4});assert.equal(await page.locator('#profile-editor').getAttribute('data-scale'),dragScale,'Auto-fit freezes during dragging');await page.mouse.up();
    assert(Math.abs(Number(await page.locator('[name=mouth]').inputValue())-120)<=2,'Dragging changes the exported mouth diameter');
    const mouthHeight=Number(await page.locator('[name=height]').inputValue());
    await page.locator('[data-size=mouth]').press('ArrowDown');assert.equal(Number(await page.locator('[name=height]').inputValue()),mouthHeight,'Top point leaves the height reference unchanged');
    const topBeforeHeight=await page.locator('[data-size=mouth]').getAttribute('aria-valuetext');
    const height=await page.locator('#profile-editor [data-size=height] circle').boundingBox();
    await page.mouse.move(height.x+height.width/2,height.y+height.height/2);await page.mouse.down();
    const heightTarget=await profilePosition(0,200);await page.mouse.move(height.x+height.width/2,heightTarget.y,{steps:4});await page.mouse.up();
    assert(Math.abs(Number(await page.locator('[name=height]').inputValue())-200)<=2,'Height handle adjusts vessel height');
    assert.equal(await page.locator('[data-size=mouth]').getAttribute('aria-valuetext'),topBeforeHeight,'Height reference leaves the top point in place');
    await handle.press('Shift+ArrowUp');assert.match(await handle.getAttribute('aria-valuetext'),/120 millimetres high/);
    const bellyCircle=await handle.locator('circle').boundingBox();
    await page.mouse.move(bellyCircle.x+bellyCircle.width/2,bellyCircle.y+bellyCircle.height/2);await page.mouse.down();
    const bellyTarget=await profilePosition(130,140);await page.mouse.move(bellyCircle.x+bellyCircle.width/2,bellyTarget.y,{steps:4});await page.mouse.up();
    assert.match(await handle.getAttribute('aria-valuetext'),/140 millimetres high/,'Original belly point moves vertically');
    const baseHandle=page.locator('[data-size=base]'),baseBefore=await baseHandle.getAttribute('transform');await baseHandle.press('ArrowUp');assert.equal(await baseHandle.getAttribute('transform'),baseBefore,'Bottom stays fixed vertically');
    const linePoint=await page.evaluate(async()=>{
      const {profileRadius}=await import('/generators/vessels/geometry.js?v=20261009-recess-2'),svg=document.querySelector('#profile-editor'),form=document.querySelector('#settings');
      const s=Object.fromEntries(['height','base','belly','mouth'].map(n=>[n,Number(form.elements[n].value)]));
      s.bellyPosition=.7;const d=svg.dataset,p=new DOMPoint(Number(d.centre)+profileRadius(s,.25)*Number(d.scale),Number(d.floor)-s.height*.25*Number(d.scale)).matrixTransform(svg.getScreenCTM());return {x:p.x,y:p.y};
    });
    await page.mouse.click(linePoint.x,linePoint.y);assert.equal(await page.locator('[data-point]').count(),1,'Clicking the profile adds a point');
    const extra=page.locator('[data-point]');await extra.press('Shift+ArrowRight');
    const extraDiameter=Number(await extra.getAttribute('aria-valuenow'));await extra.press('ArrowUp');
    const extraCircle=await extra.locator('circle').boundingBox();
    await page.mouse.move(extraCircle.x+extraCircle.width/2,extraCircle.y+extraCircle.height/2);await page.mouse.down();
    await page.mouse.move(extraCircle.x+extraCircle.width/2+12,extraCircle.y+extraCircle.height/2-6,{steps:3});await page.mouse.up();
    assert(Number(await extra.getAttribute('aria-valuenow'))>extraDiameter,'Extra point can be dragged');
    await page.waitForFunction(()=>!document.querySelector('#stl').disabled);
    const editedModel=await downloaded('#stl'),editedPack=await inspectPackage((await downloaded('#mvpack')).bytes,editedModel.bytes,'3mf');
    assert(Math.abs(editedPack.parameters.mouth-120)<=2);assert(Math.abs(editedPack.parameters.height-200)<=2,'Dragged dimensions reach the exported package');
    assert(Math.abs(editedPack.parameters.bellyPosition-.7)<.01,'Belly height reaches the exported mesh settings');
    assert.equal(editedPack.parameters.baseRecessMm,2,'Recess depth reaches the exported package');
    assert(editedPack.parameters.topOffset>0,'Top point above the reference exports its offset');
    const topHandle=page.locator('[data-size=mouth]');for(let i=0;i<6;i++)await topHandle.press('Shift+ArrowDown');
    await page.waitForFunction(()=>!document.querySelector('#stl').disabled);
    const lowerModel=await downloaded('#stl'),lowerPack=await inspectPackage((await downloaded('#mvpack')).bytes,lowerModel.bytes,'3mf');
    assert(lowerPack.parameters.topOffset<0,'Top point below the reference exports its offset');assert.equal(lowerPack.parameters.height,200);
    assert.equal(editedPack.parameters.profilePoints.length,1);assert.equal(editedPack.parameters.profilePoints[0].diameter,Number(await extra.getAttribute('aria-valuenow')));
    await extra.press('Delete');assert.equal(await page.locator('[data-point]').count(),0);
    await page.locator('#add-profile-point').click();assert.equal(await page.locator('[data-point]').count(),1);
    await page.locator('#remove-profile-point').click();assert.equal(await page.locator('[data-point]').count(),0);
    await page.locator('#add-profile-point').click();
    await choosePreset('vase');await page.waitForFunction(()=>!document.querySelector('#stl').disabled);
    assert.equal(await handle.getAttribute('aria-valuenow'),'100','Presets refresh the profile');assert.equal(await page.locator('[data-point]').count(),0,'Presets clear extra points');
    const vessel3mf = await downloaded('#stl');
    const generalVessel = await inspectPackage((await downloaded('#mvpack')).bytes, vessel3mf.bytes, '3mf');
    assert.equal(generalVessel.supportUrl, 'https://buymeacoffee.com/xalies');
    assert.equal(generalVessel.authorUrl,'https://example.org/avery');assert.match(generalVessel.descriptionHtml,/Support Avery &lt;Maker&gt;/);assert.match(generalVessel.descriptionHtml,/via=vessels&amp;author=avery/);
    assert.equal(typeof generalVessel.printNotes, 'string');
    assert.equal(JSON.parse(generalVessel.printNotes).perimeters, 3);
    assert.equal(JSON.parse(generalVessel.printNotes).layerHeightMm, 0.2);
    await page.locator('#print-profile').selectOption('watertight');
    assert.match(await page.locator('#print-fit').textContent(), /below the suggested/);
    const watertightVessel = await inspectPackage((await downloaded('#mvpack')).bytes, vessel3mf.bytes, '3mf');
    const advice = JSON.parse(watertightVessel.printNotes);
    assert.equal(advice.layerHeightMm, 0.15); assert.equal(advice.perimeters, 5);
    assert.equal(advice.flowPercent, 105); assert.equal(advice.extrusionMultiplier, 1.05); assert.equal(advice.flowAdjustmentOptional, true);
    assert.match(await page.locator('#print-settings').textContent(), /105% \/ 1.05/);
    assert.equal(advice.watertightGuaranteed, false); assert.equal(advice.spiralVaseMode, false);
    assert.equal(watertightVessel.supportUrl, 'https://buymeacoffee.com/xalies');
    assert.equal('perimeters' in watertightVessel.parameters, false, 'Printing advice stays separate from design parameters');
    await page.locator('#apply-print-dimensions').click();
    await page.waitForFunction(() => !document.querySelector('#stl').disabled);
    assert.equal(await page.locator('[name=wall]').inputValue(), '2.4');
    assert.equal(await page.locator('[name=floor]').inputValue(), '2');
    assert.match(await page.locator('#print-fit').textContent(), /meets/);
    await page.locator('#format').selectOption('stl');
    await page.waitForFunction(() => document.querySelector('#stl').textContent.includes('STL') && !document.querySelector('#stl').disabled);
    const vesselSTL = await downloaded('#stl');
    const buffer = Buffer.from(vesselSTL.bytes);
    assert.equal(buffer.length, 84 + buffer.readUInt32LE(80) * 50, 'Complete binary STL');
    await inspectPackage((await downloaded('#mvpack')).bytes, vesselSTL.bytes, 'stl');
    for (const preset of ['vase', 'bowl', 'urn', 'cup']) {
      await choosePreset(preset);
      await page.waitForFunction(() => !document.querySelector('#stl').disabled);
      assert(await page.locator('#profile-editor').evaluate(svg=>{return [...svg.querySelectorAll('.profile-handle circle')].every(n=>{const r=n.getBoundingClientRect(),s=svg.getBoundingClientRect();return r.left>=s.left&&r.right<=s.right&&r.top>=s.top&&r.bottom<=s.bottom;});}),'Auto-fit keeps preset handles in view');
    }
    const topology = await page.evaluate(async () => {
      const { vesselMesh } = await import('/generators/vessels/geometry.js');
      for (const settings of [
        ...[undefined,0,-30,30].map(topOffset=>({ height:160,base:65,belly:100,mouth:topOffset<0?40:60,wall:1.6,floor:2,flutes:topOffset<0?0:24,amplitude:2,twist:60,topOffset })),
        { height: 25, base: 25, belly: 25, mouth: 25, wall: 5, floor: 6, flutes: 48, amplitude: 5, twist: -180, quality: 'fine', bellyPosition:.65, profilePoints:[{t:.25,diameter:50},{t:.8,diameter:35}] }
      ]) {
        const { positions, indices } = vesselMesh(settings), edges = new Map();
        const vertices = Array.from({length:positions.length/3},(_,i)=>positions.slice(i*3,i*3+3));
        const contact = vertices.filter(p=>Math.abs(p[1])<1e-8);
        const footRadius = settings.base/2-Math.min(3,settings.base/10);
        if (contact.length !== (settings.quality==='fine'?384:192)*2 || contact.some(p=>Math.hypot(p[0],p[2])<footRadius-1e-8)) return false;
        const [underside,inside] = vertices.slice(-2);
        if (Math.abs(underside[1]-2)>1e-8 || Math.abs(inside[1]-underside[1]-settings.floor)>1e-8 || vertices.some(p=>p[1]<-1e-8)) return false;
        let volume = 0;
        for (let i = 0; i < indices.length; i += 3) {
          const tri = indices.slice(i, i + 3);
          for (let j = 0; j < 3; j++) {
            const a = tri[j], b = tri[(j + 1) % 3], key = `${Math.min(a,b)},${Math.max(a,b)}`;
            const edge = edges.get(key) || [0, 0]; edge[0]++; edge[1] += a < b ? 1 : -1; edges.set(key, edge);
          }
          const [a,b,c] = tri.map(v => positions.slice(v * 3, v * 3 + 3));
          volume += (a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
        }
        if (![...edges.values()].every(([count, direction]) => count === 2 && direction === 0) || volume <= 0) return false;
      }
      return true;
    });
    assert(topology, 'Closed outward mesh, flat contact ring, recessed centre and preserved base thickness, including extreme controls');
    const arcHeights=await page.evaluate(async()=>{const {profilePoint}=await import('/generators/vessels/geometry.js');return [-30,30].map(topOffset=>{const s={height:160,base:65,belly:100,mouth:40,wall:1.6,topOffset};return {end:profilePoint(s,1).y,max:Math.max(...Array.from({length:1025},(_,i)=>profilePoint(s,i/1024).y))};});});
    assert.equal(arcHeights[0].end,130);assert(Math.abs(arcHeights[0].max-160)<.01,'Lower opening arcs over the fixed height');assert.equal(arcHeights[1].end,190);
    const tightCurve=await page.evaluate(async()=>{const {vesselMesh}=await import('/generators/vessels/geometry.js');try{vesselMesh({height:160,base:65,belly:100,mouth:60,wall:5,floor:2,flutes:0,amplitude:0,twist:0,topOffset:-30});return '';}catch(e){return e.message;}});assert.match(tightCurve,/top curve is too tight/);
    await page.locator('#exact-dimensions summary').click();
    await page.locator('#settings [name=height]').fill('0');
    assert(await page.locator('#stl').isDisabled());
    await page.locator('#settings [name=height]').fill('80');
    await page.waitForFunction(() => !document.querySelector('#stl').disabled);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await choosePreset('vase');
    await page.locator('#exact-dimensions summary').click();
    await page.locator('#format').selectOption('3mf');
    await page.waitForTimeout(300);
    await visiblePreview();
    await page.evaluate(() => document.activeElement.blur());
    if(process.env.VESSEL_PROOF_DIR){for(const [width,height] of [[1920,1080],[1440,900],[1280,800]]){await page.setViewportSize({width,height});await page.waitForTimeout(150);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const box=await page.locator('#mvpack').boundingBox();assert(box.y+box.height<=height,'Downloads visible in desktop workspace');await visiblePreview();await page.screenshot({path:path.join(process.env.VESSEL_PROOF_DIR,`vessel-${width}.png`)});}}
    if (process.env.UPDATE_THUMBNAIL) await page.locator('.workspace').screenshot({ path: path.join(root, 'images/vessel-studio.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await visiblePreview();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Vessel mobile layout must not overflow');
    assert(requests.every(url=>/^(http:\/\/127\.0\.0\.1:|blob:|data:)/.test(url)),'Runtime stays local');
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('PASS: vessel print profiles, geometry minimums, donation URL, STL/3MF packages, preview and mobile.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
