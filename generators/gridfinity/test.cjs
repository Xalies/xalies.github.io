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
      const result = await page.evaluate(async ({ bytes, modelBytes, extension }) => {
        const { unzipSync, strFromU8 } = await import('/generators/shared/vendor/fflate.js');
        const entries = unzipSync(new Uint8Array(bytes));
        const meta = JSON.parse(strFromU8(entries['meshvault.model.json']));
        const model = entries[meta.relativePath];
        const png = entries[meta.thumbnailFile];
        if (meta.author !== 'Xalies') throw new Error('Demo account author missing');
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
          format: meta.fileType, printNotes: meta.printSettingsJson, supportUrl: meta.exportDonationUrl
        };
      }, { bytes, modelBytes, extension });
      assert.equal(result.schema, 'meshvault.model'); assert.equal(result.version, 1);
      assert(result.title && result.sameBytes && result.thumbnail && result.settings && result.valid3mf && result.safePaths);
      assert.equal(result.printedStatus, false); assert.equal(result.count, 1); assert.equal(result.format, extension.toUpperCase());
      return result;
    }
    if (process.argv.includes('--set-only')) {
      await page.goto(`http://127.0.0.1:${server.address().port}/generators/gridfinity/`);
      await page.locator('#generate').click();
      await page.locator('#download').waitFor({ state: 'visible', timeout: 180000 });
      await page.waitForFunction(() => document.querySelector('#viewer').dataset.loaded === 'true');
      const bin = await page.locator('#download').evaluate(async link => (await fetch(link.href)).text());
      const binTriangles = [...bin.matchAll(/facet normal/g)].length;
      await page.locator('#add-to-set').click();
      await page.locator('#set-items li').waitFor();
      await page.locator('[aria-label="Quantity of design 1"]').fill('6');
      await page.locator('#part').selectOption('baseplate'); await page.locator('[name=width]').fill('2');
      assert(await page.locator('#add-to-set').isDisabled(), 'Stale models cannot enter the set');
      assert.equal(await page.locator('#set-items li').count(), 1, 'Changing generation settings preserves saved models');
      await page.locator('#generate').click();
      await page.locator('#download').waitFor({ state: 'visible', timeout: 180000 });
      const base = await page.locator('#download').evaluate(async link => (await fetch(link.href)).text());
      const baseTriangles = [...base.matchAll(/facet normal/g)].length;
      await page.locator('#add-to-set').click();
      await page.waitForFunction(() => document.querySelectorAll('#set-items li').length === 2);
      await page.locator('[name=bedWidth]').fill('100'); await page.locator('[name=bedDepth]').fill('100');
      assert.match(await page.locator('#set-status').textContent(), /7 parts across 2 plates/);
      assert.equal(await page.locator('#plate-layouts canvas').count(), 2);
      const quantity = page.locator('[aria-label="Quantity of design 1"]');
      await quantity.fill('0'); assert(await page.locator('#export-set').isDisabled()); await quantity.fill('6');
      await page.locator('[name=bedWidth]').fill('70'); await page.locator('[name=bedDepth]').fill('110');
      await page.locator('[name=rotate]').uncheck(); assert(await page.locator('#export-set').isDisabled());
      assert.match(await page.locator('#set-status').textContent(), /does not fit/);
      await page.locator('[name=rotate]').check(); assert(await page.locator('#export-set').isEnabled());
      await page.locator('[name=bedWidth]').fill('100'); await page.locator('[name=bedDepth]').fill('100');
      for (const format of ['3mf', 'stl']) {
        await page.locator('#set-format').selectOption(format);
        const result = await downloaded('#export-set'); assert.equal(result.name, 'gridfinity-set.mvpack');
        const check = await page.evaluate(async ({bytes, format}) => {
          const {unzipSync, strFromU8} = await import('/generators/shared/vendor/fflate.js');
          const entries = unzipSync(new Uint8Array(bytes)), manifest = JSON.parse(strFromU8(entries['meshvault.models.json']));
          let triangles = 0, copies = 0, valid = !entries['meshvault.model.json'];
          for (const model of manifest.models) {
            valid &&= model.schema === 'meshvault.model' && model.version === 1 && model.fileType === format.toUpperCase() && !('printedStatus' in model) && !!entries[model.relativePath] && !!entries[model.thumbnailFile];
            const settings = JSON.parse(strFromU8(entries[model.documentFiles[0]]));
            const png = entries[model.thumbnailFile], size = new DataView(png.buffer, png.byteOffset, png.byteLength);
            valid &&= model.author === 'Xalies' && size.getUint32(16) === 1280 && size.getUint32(20) === 720;
            valid &&= settings.bed.width === 100 && settings.bed.depth === 100 && settings.parts.every(p => p.settings.part === 'bin' || p.settings.part === 'baseplate');
            copies += settings.parts.length;
            const file = entries[model.relativePath], points = [];
            if (format === '3mf') {
              const inner = unzipSync(file), xml = new DOMParser().parseFromString(strFromU8(inner['3D/3dmodel.model']), 'application/xml');
              valid &&= !xml.querySelector('parsererror') && xml.documentElement.getAttribute('unit') === 'millimeter';
              triangles += xml.getElementsByTagName('triangle').length;
              for (const v of xml.getElementsByTagName('vertex')) points.push(['x','y','z'].map(a => Number(v.getAttribute(a))));
            } else {
              const view = new DataView(file.buffer, file.byteOffset, file.byteLength), count = view.getUint32(80,true); triangles += count;
              valid &&= file.length === 84+count*50;
              for (let i=0;i<count;i++) for(let v=0;v<3;v++) points.push([0,1,2].map(a => view.getFloat32(84+i*50+12+v*12+a*4,true)));
            }
            valid &&= points.every(([x,y,z]) => x>=4.999 && y>=4.999 && x<=95.001 && y<=95.001 && z>=-.001);
            valid &&= new Set(manifest.models.map(m=>m.relativePath)).size === manifest.models.length;
          }
          return { valid, schema: manifest.schema, version: manifest.version, plates: manifest.models.length, triangles, copies };
        }, {bytes:result.bytes,format});
        assert(check.valid); assert.equal(check.schema,'meshvault.models'); assert.equal(check.version,1); assert.equal(check.plates,2); assert.equal(check.copies,7);
        assert.equal(check.triangles,binTriangles*6+baseTriangles,'Every requested part must appear, without changing its triangles');
        const zip = await downloaded('#export-set-zip'); assert.equal(zip.name,'gridfinity-set.zip');
        assert(await page.evaluate(async ({bytes,format}) => { const {unzipSync}=await import('/generators/shared/vendor/fflate.js'); const keys=Object.keys(unzipSync(new Uint8Array(bytes))); return keys.length===2 && keys.every(k=>k.endsWith(`.${format}`)); },{bytes:zip.bytes,format}));
      }
      assert(await page.evaluate(async () => {
        const {arrangePlates,plateMesh,meshBounds}=await import('/generators/gridfinity/plates.js');
        const mesh={positions:[-10,-20,-6.4,74,-20,4.4,-10,22,4.4],indices:[0,1,2]};
        const part={title:'Rotation check',mesh,bounds:meshBounds(mesh),quantity:1};
        const bed={width:70,depth:110,gap:5,rotate:true}, plates=arrangePlates([part],bed);
        const combined=plateMesh(plates[0].placements), b=meshBounds(combined);
        if (!plates[0].placements[0].rotated || b.width!==42 || b.depth!==84 || b.min[2]!==0) return false;
        try {arrangePlates([part],{...bed,rotate:false});return false;}catch{}
        const square={...part,bounds:{min:[0,0,0],width:41.5,depth:41.5},quantity:20};
        for(const plate of arrangePlates([square],{width:100,depth:100,gap:5,rotate:true})) for(let i=0;i<plate.placements.length;i++) for(let j=i+1;j<plate.placements.length;j++) {
          const a=plate.placements[i],b=plate.placements[j];
          if (!(a.x+a.width+5<=b.x+1e-6||b.x+b.width+5<=a.x+1e-6||a.y+a.depth+5<=b.y+1e-6||b.y+b.depth+5<=a.y+1e-6)) return false;
        }
        const lShape = {...part, title:'L-shaped base', bounds:{min:[-21,-21,0],width:84,depth:84}, settings:{part:'baseplate',base_shape:'l',cells:[[0,0],[1,0],[0,1]]}};
        const bin = {...square,quantity:1};
        const nested = arrangePlates([lShape,bin],{width:100,depth:100,gap:5,rotate:true});
        if(nested.length!==1 || nested[0].placements.length!==2 || nested[0].placements[0].footprint.length!==3) return false;
        const [nestedBase,nestedBin] = nested[0].placements;
        if(!(nestedBin.x<nestedBase.x+nestedBase.width && nestedBin.y<nestedBase.y+nestedBase.depth)) return false; // Nest inside the empty cell, rather than outside the bounding box.
        for(const r of nestedBase.footprint) for(const q of nestedBin.footprint) if(!(nestedBase.x+r.x+r.width+5<=nestedBin.x+q.x+1e-5||nestedBin.x+q.x+q.width+5<=nestedBase.x+r.x+1e-5||nestedBase.y+r.y+r.depth+5<=nestedBin.y+q.y+1e-5||nestedBin.y+q.y+q.depth+5<=nestedBase.y+r.y+1e-5)) return false;
        const rotated = arrangePlates([{...lShape,bounds:{min:[-21,-21,0],width:84,depth:126},settings:{...lShape.settings,cells:[[0,0],[1,0],[0,1],[0,2]]}}],{width:140,depth:100,gap:5,rotate:true})[0].placements[0];
        if(!rotated.rotated || rotated.footprint.some(r=>r.x<0||r.y<0||r.x+r.width>rotated.width||r.y+r.depth>rotated.depth)) return false;
        const shifted = arrangePlates([{...lShape,bounds:{...lShape.bounds,min:[21,-21,0]},settings:{...lShape.settings,cells:[[1,0],[2,0],[1,1]]}}],{width:100,depth:100,gap:5,rotate:false})[0].placements[0];
        if(shifted.footprint[0].x!==0) return false;
        return true;
      }),'Shape nesting, rotated and offset cells, height normalization, spacing and overflow plates');
      await page.locator('[aria-label="Remove design 2"]').click(); assert.equal(await page.locator('#set-items li').count(),1);
      await page.setViewportSize({width:390,height:844}); assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      if(process.env.SET_SCREENSHOT) await page.locator('[aria-label="Your Gridfinity set"]').screenshot({path:process.env.SET_SCREENSHOT});
      await page.locator('#clear-set').click(); assert(await page.locator('#export-set').isDisabled()); assert.equal(await page.locator('#set-items li').count(),0);
      assert.equal(errors.length,0,errors.join('\n')); console.log('PASS: saved bins and baseplate, quantities, bed bounds, rotation, multiple plates, STL/3MF set ZIPs and multi-model mvpack, removal, clear and mobile.');
      return;
    }
    if (!process.argv.includes('--vessels-only')) {
    await page.goto(`http://127.0.0.1:${server.address().port}/generators/gridfinity/`);
    // Regression: a sparse reinforced custom layout must not render the full editing area.
    await page.locator('#part').selectOption('baseplate');
    await page.locator('[name=width]').fill('6'); await page.locator('[name=depth]').fill('6');
    await page.locator('[name=weighted]').selectOption('true');
    const customCells = ['0,0','1,0','2,0','0,1','1,1','2,1','0,2','1,2','0,3','1,3','2,3','3,3','4,3'];
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) if (!customCells.includes(`${x},${y}`)) await page.locator(`#cell-layout [data-cell="${x},${y}"]`).click();
    const customStarted = Date.now();
    await page.locator('#generate').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('elapsed'));
    await page.locator('#download').waitFor({ state: 'visible', timeout: 180000 });
    const customSeconds = (Date.now() - customStarted) / 1000;
    await page.waitForFunction(() => document.querySelector('#viewer').dataset.loaded === 'true');
    assert.equal(await page.locator('#download').getAttribute('download'), 'gridfinity-baseplate-6x6-custom-13cells.stl');
    const customSTL = await page.locator('#download').evaluate(async link => (await fetch(link.href)).text());
    assert(customSTL.includes('facet normal') && customSTL.includes('endsolid'));
    assert.equal(await page.locator('#cell-layout [aria-pressed=true]').count(), 13);
    const custom3mf = await downloaded('#download-3mf');
    const customPackage = await inspectPackage((await downloaded('#mvpack')).bytes, custom3mf.bytes, '3mf');
    assert.equal(customPackage.parameters.cells.length, 13);
    if (process.env.LAYOUT_SCREENSHOT) await page.locator('.workspace').screenshot({ path: process.env.LAYOUT_SCREENSHOT });
    console.log(`Sparse custom reinforced baseplate: ${customSeconds.toFixed(1)} seconds, 13 cells, STL/3MF/package verified.`);
    await page.goto(`http://127.0.0.1:${server.address().port}/generators/gridfinity/`);
    await page.locator('[name=chambers]').fill('4');
    await page.locator('#generate').click();
    assert.equal(await page.locator('#cancel').isDisabled(), true, 'Invalid chamber count must not render');
    await page.locator('[name=chambers]').fill('1');
    await page.locator('#generate').click();
    await page.locator('#download').waitFor({ state: 'visible', timeout: 180000 });
    const bytes = await page.locator('#download').evaluate(async link => [...new Uint8Array(await (await fetch(link.href)).arrayBuffer())]);
    assert(bytes.length > 1000, 'STL must contain geometry');
    const stl = Buffer.from(bytes).toString();
    assert(stl.startsWith('solid ') && stl.includes('facet normal') && stl.includes('endsolid'), 'Expected a complete ASCII STL');
    await page.waitForFunction(() => document.querySelector('#viewer').dataset.loaded === 'true');
    await page.waitForTimeout(200);
    const grid3mf = await downloaded('#download-3mf');
    assert(grid3mf.name.endsWith('.3mf'));
    const gridPack = await downloaded('#mvpack');
    assert(gridPack.name.endsWith('.mvpack'));
    await inspectPackage(gridPack.bytes, grid3mf.bytes, '3mf');
    await page.locator('#format').selectOption('stl');
    await inspectPackage((await downloaded('#mvpack')).bytes, bytes, 'stl');
    assert.equal(errors.length, 0, errors.join('\n'));
    assert(requests.every(url => url.startsWith('http://127.0.0.1:') || url.startsWith('blob:')), 'Runtime must stay local');
    if (process.env.UPDATE_THUMBNAIL) await page.locator('.workspace').screenshot({ path: path.join(root, 'images/gridfinity-generator.png') });
    for (const [magnets, screws] of [[true, false], [false, true], [true, true]]) {
      await page.locator('#magnets').setChecked(magnets);
      await page.locator('#screws').setChecked(screws);
      assert.equal(await page.locator('[name=magnet_diameter]').isDisabled(), !magnets);
      assert.equal(await page.locator('[name=screw_depth]').isDisabled(), !screws);
      await page.locator('#generate').click();
      await page.locator('#download').waitFor({ state: 'visible', timeout: 180000 });
      const mounted = await page.locator('#download').evaluate(async link => (await fetch(link.href)).text());
      const points = [...mounted.matchAll(/vertex\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)/g)].map(m => m.slice(1).map(Number));
      const hasPoint = target => points.some(p => p.every((v, i) => Math.abs(v - target[i]) < .001));
      assert.equal(hasPoint([16.25, 13, 2.4]), magnets, 'Magnet cavity must appear only when enabled');
      assert.equal(hasPoint([14.5, 13, 6]), screws, 'Screw cavity must appear only when enabled');
      await page.waitForFunction(() => document.querySelector('#viewer').dataset.loaded === 'true');
      const result = await inspectPackage((await downloaded('#mvpack')).bytes, [...Buffer.from(mounted)], 'stl');
      assert.equal(result.parameters.magnet_diameter, magnets ? 6.5 : 0);
      assert.equal(result.parameters.screw_depth, screws ? 6 : 0);
    }
    await page.locator('#magnets').uncheck(); await page.locator('#screws').uncheck();
    await page.locator('[name=width]').fill('2');
    assert(await page.locator('#download').isHidden(), 'Changing settings hides stale downloads');
    assert(await page.locator('#mvpack').isDisabled(), 'Changing settings disables stale packages');
    await page.locator('#generate').click();
    await page.locator('#cancel').click();
    assert.match(await page.locator('#status').textContent(), /cancelled/);
    assert(await page.locator('#generate').isEnabled());
    await page.locator('#part').selectOption('baseplate');
    assert.equal(await page.locator('[name=width]').inputValue(), '2');
    assert(await page.locator('[name=height]').isDisabled());
    await page.locator('#generate').click();
    await page.locator('#download').waitFor({ state: 'visible', timeout: 180000 });
    assert.equal(await page.locator('#download').getAttribute('download'), 'gridfinity-baseplate-2x1.stl');
    const baseStl = await page.locator('#download').evaluate(async link => (await fetch(link.href)).text());
    const vertices = [...baseStl.matchAll(/vertex\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)/g)].map(match => match.slice(1).map(Number));
    assert(vertices.length > 30, 'Baseplate must contain geometry');
    const spans = [0, 1, 2].map(axis => Math.max(...vertices.map(v => v[axis])) - Math.min(...vertices.map(v => v[axis])));
    assert(Math.abs(spans[0] - 84) < .1 && Math.abs(spans[1] - 42) < .1 && Math.abs(spans[2] - 5) < .1, 'Baseplate must match the 42 mm bin grid');
    await page.waitForFunction(() => document.querySelector('#viewer').dataset.loaded === 'true');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[name=weighted]').selectOption('true');
    await page.locator('#generate').click();
    await page.locator('#download').waitFor({ state: 'visible', timeout: 180000 });
    const reinforced = await page.locator('#download').evaluate(async link => (await fetch(link.href)).text());
    const zs = [...reinforced.matchAll(/vertex\s+[\d.e+-]+\s+[\d.e+-]+\s+([\d.e+-]+)/g)].map(m => Number(m[1]));
    assert(Math.abs(Math.max(...zs) - Math.min(...zs) - 10.8) < .01, 'Mounted baseplate must use reinforced geometry');
    await page.waitForFunction(() => document.querySelector('#viewer').dataset.loaded === 'true');
    const reinforcedPack = await inspectPackage((await downloaded('#mvpack')).bytes, [...Buffer.from(reinforced)], 'stl');
    assert.equal(reinforcedPack.parameters.weighted, true, 'Export must preserve the baseplate mounting choice');
    await page.locator('[name=depth]').fill('2');
    await page.locator('#base-shape').selectOption('l');
    assert.equal(await page.locator('#cell-layout [aria-pressed=true]').count(), 3);
    for (const weighted of ['false', 'true']) {
      await page.locator('[name=weighted]').selectOption(weighted);
      await page.locator('#generate').click();
      await page.locator('#download').waitFor({ state: 'visible', timeout: 180000 });
      assert.equal(await page.locator('#download').getAttribute('download'), 'gridfinity-baseplate-2x2-l-3cells.stl');
      const shaped = await page.locator('#download').evaluate(async link => (await fetch(link.href)).text());
      const geometry = await page.evaluate(async text => {
        const { asciiSTLMesh } = await import('/generators/shared/mvpack.js');
        const { positions, indices } = asciiSTLMesh(text), neighbours = new Map();
        for (let i = 0; i < indices.length; i += 3) {
          const [a,b,c] = indices.slice(i, i + 3);
          for (const [v, other] of [[a,b], [b,c], [c,a]]) {
            if (!neighbours.has(v)) neighbours.set(v, new Set());
            if (!neighbours.has(other)) neighbours.set(other, new Set());
            neighbours.get(v).add(other); neighbours.get(other).add(v);
          }
        }
        const seen = new Set([indices[0]]), queue = [indices[0]];
        for (let i = 0; i < queue.length; i++) for (const next of neighbours.get(queue[i])) if (!seen.has(next)) { seen.add(next); queue.push(next); }
        let missingCellEmpty = true;
        for (let i = 0; i < positions.length; i += 3) if (positions[i] > 21.001 && positions[i+1] > 21.001) missingCellEmpty = false;
        return { connected: seen.size === positions.length / 3, missingCellEmpty };
      }, shaped);
      assert(geometry.connected, 'Selected cells must become one connected mesh');
      assert(geometry.missingCellEmpty, 'The removed cell must contain no geometry');
      await page.waitForFunction(() => document.querySelector('#viewer').dataset.loaded === 'true');
      const shape3mf = await downloaded('#download-3mf');
      await page.locator('#format').selectOption('3mf');
      const shapePack = await inspectPackage((await downloaded('#mvpack')).bytes, shape3mf.bytes, '3mf');
      assert.equal(shapePack.parameters.cells.length, 3);
      assert.equal(shapePack.parameters.base_shape, 'l');
      assert.equal(shapePack.parameters.weighted, weighted === 'true');
      if (process.env.LAYOUT_SCREENSHOT) await page.locator('.workspace').screenshot({ path: process.env.LAYOUT_SCREENSHOT });
    }
    await page.locator('#cell-layout [data-cell="0,0"]').click();
    await page.locator('#generate').click();
    assert.equal(await page.locator('#cancel').isDisabled(), true, 'Corner-only contact must not generate disconnected pieces');
    assert.match(await page.locator('#layout-status').textContent(), /Connect all/);
    assert(await page.locator('#download').isHidden(), 'Editing cells invalidates all old downloads');
    await page.locator('#cell-layout [data-cell="1,0"]').click();
    await page.locator('#cell-layout [data-cell="0,1"]').click();
    await page.locator('#generate').click();
    assert.equal(await page.locator('#cancel').isDisabled(), true, 'Empty footprints cannot generate');
    assert.match(await page.locator('#layout-status').textContent(), /at least one/);
    assert(await page.evaluate(async () => {
      const { layoutCells, connectedCells } = await import('/generators/gridfinity/layout.js');
      for (let w = 1; w <= 6; w++) for (let d = 1; d <= 6; d++) for (const s of ['rectangle', 'l', 't', 'steps']) if (!connectedCells(layoutCells(w, d, s))) return false;
      return !connectedCells([]) && !connectedCells([[0,0],[1,1]]) && connectedCells([[0,0],[1,0],[1,1]]);
    }), 'All preset sizes must be connected; diagonal-only layouts must fail');
    await page.locator('#base-shape').selectOption('rectangle');
    await page.locator('[name=depth]').fill('1');
    await page.locator('#part').selectOption('bin');
    assert(await page.locator('[name=magnet_diameter]').isDisabled(), 'Switching back preserves disabled magnet choice');
    await page.locator('#part').selectOption('baseplate');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile layout must not overflow');
    // Missing model assets must finish with an error rather than hang.
    await page.route('**/gridfinity_bins.zip', route => route.fulfill({ status: 404, body: 'Missing' }));
    await page.locator('#generate').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('failed'));
    assert(await page.locator('#generate').isEnabled());
    assert(await page.locator('#download').isHidden());
    await page.unroute('**/gridfinity_bins.zip');
    await page.evaluate(() => { window.Worker = class { constructor() { throw new DOMException('Worker blocked by browser', 'SecurityError'); } }; });
    await page.locator('#generate').click();
    assert.match(await page.locator('#status').textContent(), /Worker blocked by browser/);
    assert.match(await page.locator('#log').textContent(), /SecurityError/);
    assert(await page.locator('#generate').isEnabled());
    }
    await page.goto(`http://127.0.0.1:${server.address().port}/generators/vessels/`);
    await page.waitForFunction(() => document.querySelector('#viewer').dataset.loaded === 'true');
    const vessel3mf = await downloaded('#stl');
    const generalVessel = await inspectPackage((await downloaded('#mvpack')).bytes, vessel3mf.bytes, '3mf');
    assert.equal(generalVessel.supportUrl, 'https://buymeacoffee.com/xalies');
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
      await page.locator(`[data-preset=${preset}]`).click();
      await page.waitForFunction(() => !document.querySelector('#stl').disabled);
    }
    const topology = await page.evaluate(async () => {
      const { vesselMesh } = await import('/generators/vessels/geometry.js');
      for (const settings of [
        { height: 160, base: 65, belly: 100, mouth: 60, wall: 1.6, floor: 2, flutes: 24, amplitude: 2, twist: 60 },
        { height: 25, base: 25, belly: 25, mouth: 25, wall: 5, floor: 6, flutes: 48, amplitude: 5, twist: -180, quality: 'fine' }
      ]) {
        const { positions, indices } = vesselMesh(settings), edges = new Map();
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
    assert(topology, 'Watertight mesh edges and outward winding, including extreme controls');
    await page.locator('[name=height]').fill('0');
    assert(await page.locator('#stl').isDisabled());
    await page.locator('[name=height]').fill('80');
    await page.waitForFunction(() => !document.querySelector('#stl').disabled);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('[data-preset=vase]').click();
    await page.locator('#format').selectOption('3mf');
    await page.waitForTimeout(300);
    await visiblePreview();
    await page.evaluate(() => document.activeElement.blur());
    if (process.env.UPDATE_THUMBNAIL) await page.locator('.workspace').screenshot({ path: path.join(root, 'images/vessel-studio.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await visiblePreview();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Vessel mobile layout must not overflow');
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(process.argv.includes('--vessels-only') ? 'PASS: vessel print profiles, geometry minimums, donation URL, STL/3MF packages, preview and mobile.' : 'PASS: Gridfinity mounting/layouts and vessel print profiles; STL/3MF packages, preview, mobile and failure recovery.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
