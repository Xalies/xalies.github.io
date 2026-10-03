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
    assert.equal(errors.length, 0, errors.join('\n'));
    assert(requests.every(url => url.startsWith('http://127.0.0.1:') || url.startsWith('blob:')), 'Runtime must stay local');
    if (process.env.UPDATE_THUMBNAIL) await page.locator('.workspace').screenshot({ path: path.join(root, 'images/gridfinity-generator.png') });
    await page.locator('[name=width]').fill('2');
    assert(await page.locator('#download').isHidden(), 'Changing settings hides stale downloads');
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
    console.log(`PASS: generated ${bytes.length} STL bytes; validation, preview, local assets, stale download, cancellation, mobile, failure recovery.`);
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
