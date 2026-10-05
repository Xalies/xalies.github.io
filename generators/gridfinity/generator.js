// SPDX-License-Identifier: GPL-2.0-only
import { demoAccount, createPackage, createSetPackage, create3MF, asciiSTLMesh, saveFile, canvasThumbnail } from '../shared/mvpack.js';
import { layoutCells, connectedCells, baseplateSource } from './layout.js';
import { arrangePlates, meshBounds, plateMesh, plateSTL } from './plates.js';
const form = document.querySelector('#settings');
const status = document.querySelector('#status');
const download = document.querySelector('#download');
const cancel = document.querySelector('#cancel');
const generate = document.querySelector('#generate');
const log = document.querySelector('#log');
const part = document.querySelector('#part');
const shape = document.querySelector('#base-shape'), layout = document.querySelector('#cell-layout');
let cells = [];
function updateLayout() {
  const width = Number(form.elements.width.value), depth = Number(form.elements.depth.value);
  shape.setCustomValidity('');
  layout.replaceChildren();
  if (![width, depth].every(n => Number.isInteger(n) && n >= 1 && n <= 6)) {
    document.querySelector('#layout-status').textContent = 'Set width and depth between 1 and 6.';
    return;
  }
  cells = shape.value === 'custom' ? cells.filter(([x, y]) => x < width && y < depth) : layoutCells(width, depth, shape.value);
  const selected = new Set(cells.map(cell => cell.join(',')));
  layout.style.gridTemplateColumns = `repeat(${width}, 1fr)`;
  layout.style.maxWidth = `${width * 40 + (width - 1) * 5}px`;
  for (let y = 0; y < depth; y++) for (let x = 0; x < width; x++) {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.cell = `${x},${y}`;
    button.setAttribute('aria-label', `Column ${x + 1}, row ${y + 1}`);
    button.setAttribute('aria-pressed', String(selected.has(`${x},${y}`)));
    button.textContent = selected.has(`${x},${y}`) ? '●' : '+';
    layout.append(button);
  }
  const error = !cells.length ? 'Select at least one cell.' : !connectedCells(cells) ? 'Connect all selected cells along their edges to make one piece.' : '';
  if (part.value === 'baseplate') shape.setCustomValidity(error);
  document.querySelector('#layout-status').textContent = error || `${cells.length} connected ${cells.length === 1 ? 'cell' : 'cells'} · one baseplate`;
}
shape.addEventListener('change', updateLayout);
for (const key of ['width', 'depth']) form.elements[key].addEventListener('input', updateLayout);
layout.addEventListener('click', event => {
  const button = event.target.closest('[data-cell]'); if (!button) return;
  const [x, y] = button.dataset.cell.split(',').map(Number);
  shape.value = 'custom';
  cells = button.getAttribute('aria-pressed') === 'true' ? cells.filter(cell => cell[0] !== x || cell[1] !== y) : [...cells, [x, y]];
  updateLayout(); form.dispatchEvent(new Event('input'));
});
let worker, url, viewer, current, generationTimer;
const pack = document.querySelector('#mvpack'), download3mf = document.querySelector('#download-3mf');
const addToSet = document.querySelector('#add-to-set');
function packageContents() {
  const format = document.querySelector('#format').value;
  const name = current?.stl.name.replace(/\.stl$/, `.${format}`);
  document.querySelector('#package-contents').textContent = name ? `${name.replace(/\.(stl|3mf)$/, '.mvpack')}\n├── ${name}\n├── meshvault.model.json\n${document.querySelector('#viewer').dataset.loaded ? '├── images/thumbnail.png\n' : ''}└── documents/generator-settings.json` : 'Generate a model to see your package contents.';
}

function mountingControls() {
  const base = part.value === 'baseplate';
  form.elements.magnet_diameter.disabled = base || !document.querySelector('#magnets').checked;
  form.elements.screw_depth.disabled = base || !document.querySelector('#screws').checked;
}
document.querySelector('#magnets').addEventListener('change', mountingControls);
document.querySelector('#screws').addEventListener('change', mountingControls);
part.addEventListener('change', () => {
  const base = part.value === 'baseplate';
  form.querySelectorAll('[data-bin]').forEach(section => {
    section.hidden = base;
    section.querySelectorAll('input, select').forEach(input => { input.disabled = base; });
  });
  form.querySelectorAll('[data-base]').forEach(section => {
    section.hidden = !base;
    section.querySelectorAll('input, select').forEach(input => { input.disabled = !base; });
  });
  mountingControls();
  document.querySelector('#base-note').hidden = !base;
  form.elements.chambers.setCustomValidity('');
  updateLayout();
});

try {
  viewer = new StlViewer(document.querySelector('#viewer'), {
    auto_rotate: false, auto_resize: true, bg_color: '#19231f',
    model_loaded_callback: id => {
      viewer.set_color(id, '#639783');
      const { dims } = viewer.get_model_info(id);
      const distance = Math.max(dims.x, dims.y, dims.z) * 1.8 / Math.min(1, viewer.camera.aspect);
      viewer.set_camera_state({ position: { x: distance, y: distance * .8, z: distance }, target: { x: 0, y: 0, z: 0 } });
      viewer.stop_auto_zoom();
      document.querySelector('#viewer').dataset.loaded = 'true';
      packageContents();
    },
    load_error_callback: () => { status.textContent = 'Preview unavailable. You can still download the STL.'; }
  });
} catch { status.textContent = '3D preview unavailable. STL generation is still available.'; }

function finish(message) {
  clearInterval(generationTimer);
  worker?.terminate();
  worker = null;
  generate.disabled = false;
  cancel.disabled = true;
  status.textContent = message;
}

// A changed form must never offer a download of the previous settings.
form.addEventListener('input', () => {
  if (worker) finish('Settings changed. Generate again.');
  download.hidden = true;
  current = null; pack.disabled = download3mf.disabled = addToSet.disabled = true; packageContents();
  if (url) URL.revokeObjectURL(url);
  url = null;
  status.textContent = 'Settings changed. Generate to update the preview.';
});
cancel.addEventListener('click', () => finish('Generation cancelled.'));

form.addEventListener('submit', event => {
  event.preventDefault();
  if (worker || !form.reportValidity()) return;
  const values = Object.fromEntries(new FormData(form));
  const chamberInput = form.elements.chambers;
  const base = part.value === 'baseplate';
  if (!base) {
    values.magnet_diameter = document.querySelector('#magnets').checked ? Number(form.elements.magnet_diameter.value) : 0;
    values.screw_depth = document.querySelector('#screws').checked ? Number(form.elements.screw_depth.value) : 0;
  } else {
    values.weighted = form.elements.weighted.value === 'true';
    values.cells = cells.map(cell => [...cell]);
  }
  chamberInput.setCustomValidity(!base && Number(values.chambers) > Number(values.width) * 3 ? 'Use at most 3 compartments per width unit.' : '');
  if (!form.reportValidity()) return;
  const args = ['input.scad', '-o', 'bin.stl'];
  for (const input of form.querySelectorAll('[name]')) {
    if (input.disabled || input.name === 'base_shape') continue;
    const value = input.name === 'weighted' ? values.weighted : input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value;
    args.push('-D', `${input.name}=${JSON.stringify(value)}`);
  }
  args.push('-D', 'hole_overhang_remedy=true');
  if (!base) args.push('-D', `magnet_diameter=${values.magnet_diameter}`, '-D', `screw_depth=${values.screw_depth}`);
  if (base) args.push('-D', `xsize=${values.width}`, '-D', `ysize=${values.depth}`);
  download.hidden = true;
  current = null; pack.disabled = download3mf.disabled = addToSet.disabled = true; packageContents();
  if (url) URL.revokeObjectURL(url);
  url = null;
  generate.disabled = true;
  cancel.disabled = false;
  log.textContent = '';
  status.textContent = 'Generating… You can keep using this page or cancel.';
  const started = performance.now();
  generationTimer = setInterval(() => {
    const seconds = Math.floor((performance.now() - started) / 1000);
    status.textContent = `Generating${base ? ` ${values.cells.length}-cell baseplate` : ' bin'} · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} elapsed. You can cancel.`;
  }, 1000);
  try {
    worker = new Worker(new URL('./vendor/openscad-worker-inlined.js', import.meta.url));
    worker.onerror = event => {
      log.textContent = event.message || 'The browser could not load the generation worker.';
      finish('Could not load the generator. See the generation log for details.');
    };
    worker.onmessage = ({ data }) => {
      log.textContent = (data.mergedOutputs || []).map(line => line.stderr || line.stdout || line.error).join('\n');
      const content = data.outputs?.[0]?.[1];
      if (data.error || data.exitCode !== 0 || !content?.length) {
        finish('Generation failed. Check the log and try smaller dimensions.');
        return;
      }
      const footprint = base && values.base_shape !== 'rectangle' ? `-${values.base_shape}-${values.cells.length}cells` : '';
      const name = base ? `gridfinity-baseplate-${values.width}x${values.depth}${footprint}.stl` : `gridfinity-${values.width}x${values.depth}x${values.height}.stl`;
      const file = new File([content], name, { type: 'model/stl' });
      const settings = { part: part.value, ...values, ...(!base ? { fingerslide: form.elements.fingerslide.checked } : {}) };
      current = { stl: file, settings, title: base ? `Gridfinity baseplate ${values.width} × ${values.depth}` : `Gridfinity bin ${values.width} × ${values.depth} × ${values.height}` };
      pack.disabled = download3mf.disabled = addToSet.disabled = false;
      packageContents();
      url = URL.createObjectURL(file);
      download.href = url;
      download.download = name;
      download.hidden = false;
      finish(`Ready · ${(file.size / 1024).toFixed(0)} KB STL`);
      if (viewer) {
        delete document.querySelector('#viewer').dataset.loaded;
        if (viewer.models_count) viewer.remove_model(1);
        try { viewer.add_model({ id: 1, local_file: file, rotationx: -Math.PI / 2 }); }
        catch { status.textContent = 'Preview unavailable. You can still download the STL.'; }
      }
    };
    worker.postMessage({
      inputs: [['input.scad', base && values.base_shape !== 'rectangle' ? baseplateSource(values.cells) : `include <gridfinity_bins/${base ? 'gridfinity_baseplate' : 'gridfinity_basic_cup'}.scad>`]],
      args, outputPaths: ['bin.stl'], zipArchives: ['gridfinity_bins']
    });
  } catch (error) {
    log.textContent = `${error.name}: ${error.message}`;
    log.closest('details').open = true;
    finish(location.protocol === 'file:'
      ? 'Open this generator through a local web server. Browsers block generation from a file URL.'
      : `Could not start the generator: ${error.message}`);
  }
});
form.addEventListener('input', () => form.elements.chambers.setCustomValidity(''));

async function modelFile(snapshot, format) {
  if (format === '3mf' && !snapshot['3mf']) {
    const blob = create3MF(asciiSTLMesh(await snapshot.stl.text()));
    snapshot['3mf'] = new File([blob], snapshot.stl.name.replace(/\.stl$/, '.3mf'), { type: 'model/3mf' });
  }
  return snapshot[format];
}
document.querySelector('#format').addEventListener('change', async () => {
  const snapshot = current;
  if (!snapshot) return;
  try { await modelFile(snapshot, document.querySelector('#format').value); if (current === snapshot) packageContents(); }
  catch (error) { status.textContent = `3MF conversion failed: ${error.message}`; }
});
download3mf.addEventListener('click', async () => {
  const snapshot = current; if (!snapshot) return;
  try { const file = await modelFile(snapshot, '3mf'); saveFile(file, file.name); }
  catch (error) { status.textContent = `3MF export failed: ${error.message}`; }
});
pack.addEventListener('click', async () => {
  const snapshot = current; if (!snapshot) return;
  const format = document.querySelector('#format').value;
  pack.disabled = true;
  try {
    let thumbnail;
    if (viewer && document.querySelector('#viewer').dataset.loaded) {
      viewer.renderer.render(viewer.scene, viewer.camera);
      thumbnail = await canvasThumbnail(viewer.renderer.domElement);
    }
    const file = await modelFile(snapshot, format);
    const blob = await createPackage({ file, title: snapshot.title, author: demoAccount.name, settings: snapshot.settings, generatorName: 'Xalies Gridfinity Studio', sourceUrl: 'https://xalies.github.io/generators/gridfinity/', summary: 'Custom Gridfinity storage on a 42 mm grid.', tags: ['gridfinity', snapshot.settings.part, 'generated'], printNotes: 'Print flat on the base. Check clearances and your material profile in the slicer; no printer-specific settings are supplied.', thumbnail });
    saveFile(blob, file.name.replace(/\.(stl|3mf)$/, '.mvpack'));
    status.textContent = 'MeshVault package exported.';
    if (current === snapshot) packageContents();
  } catch (error) { status.textContent = `Package export failed: ${error.message}`; }
  finally { pack.disabled = !current; }
});
document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
  const presets = { small: [1, 1, 6, 1], tools: [3, 1, 4, 3], base: [3, 2, 6, 1] };
  ['width', 'depth', 'height', 'chambers'].forEach((key, i) => form.elements[key].value = presets[button.dataset.preset][i]);
  part.value = button.dataset.preset === 'base' ? 'baseplate' : 'bin';
  part.dispatchEvent(new Event('change')); form.dispatchEvent(new Event('input'));
}));
updateLayout();

const parts = [], bedForm = document.querySelector('#bed-settings'), setStatus = document.querySelector('#set-status');
const setExport = document.querySelector('#export-set'), zipExport = document.querySelector('#export-set-zip');
const plateLayouts = document.querySelector('#plate-layouts');
let nextPart = 1, exportingSet = false, platePlan = [];
function bedSettings() {
  return { width: Number(bedForm.elements.bedWidth.value), depth: Number(bedForm.elements.bedDepth.value), gap: Number(bedForm.elements.spacing.value), rotate: bedForm.elements.rotate.checked };
}
function updatePlates() {
  platePlan = []; plateLayouts.replaceChildren(); setExport.disabled = zipExport.disabled = true;
  if (!parts.length) { setStatus.textContent = 'Your set is empty.'; return; }
  if (!bedForm.checkValidity()) { setStatus.textContent = 'Enter valid bed dimensions, spacing and quantities.'; return; }
  try {
    const bed = bedSettings(); platePlan = arrangePlates(parts, bed);
    platePlan.forEach((plate, i) => {
      const figure = document.createElement('figure'), canvas = document.createElement('canvas'), caption = document.createElement('figcaption');
      const scale = 960 / Math.max(bed.width, bed.depth);
      canvas.width = Math.round(bed.width * scale); canvas.height = Math.round(bed.depth * scale);
      canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `Plate ${i+1}: ${plate.placements.length} parts on a ${bed.width} by ${bed.depth} mm bed`);
      const context = canvas.getContext('2d');
      context.fillStyle = '#19231f'; context.fillRect(0,0,canvas.width,canvas.height);
      for (const item of plate.placements) {
        context.fillStyle = item.part.settings.part === 'baseplate' ? '#285e4b' : '#bf785b';
        for (const rect of item.footprint) context.fillRect((item.x+rect.x)*scale, canvas.height-(item.y+rect.y+rect.depth)*scale, rect.width*scale, rect.depth*scale);
        context.fillStyle = '#fff'; context.font = '32px system-ui'; context.textAlign = 'center';
        const label = item.footprint[0];
        context.fillText(String(item.part.id), (item.x+label.x+label.width/2)*scale, canvas.height-(item.y+label.y+label.depth/2)*scale+5);
      }
      caption.textContent = `Plate ${i+1} · ${plate.placements.length} ${plate.placements.length === 1 ? 'part' : 'parts'}`;
      figure.append(canvas, caption); plateLayouts.append(figure);
    });
    const count = platePlan.reduce((n, plate) => n + plate.placements.length, 0);
    setStatus.textContent = `${count} parts across ${platePlan.length} ${platePlan.length === 1 ? 'plate' : 'plates'} · ${bed.width} × ${bed.depth} mm bed`;
    setExport.disabled = zipExport.disabled = exportingSet;
  } catch (error) { setStatus.textContent = error.message; }
}
function showSet() {
  const list = document.querySelector('#set-items'); list.replaceChildren();
  document.querySelector('#set-empty').hidden = !!parts.length;
  document.querySelector('#clear-set').disabled = !parts.length;
  for (const part of parts) {
    const row = document.createElement('li'), label = document.createElement('span'), quantity = document.createElement('input'), remove = document.createElement('button');
    label.textContent = `${part.id}. ${part.title}`;
    quantity.type = 'number'; quantity.min = '1'; quantity.max = '20'; quantity.step = '1'; quantity.value = part.quantity;
    quantity.setAttribute('aria-label', `Quantity of design ${part.id}`);
    quantity.addEventListener('input', () => { part.quantity = Number(quantity.value); updatePlates(); });
    remove.type = 'button'; remove.className = 'secondary'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove design ${part.id}`);
    remove.addEventListener('click', () => { parts.splice(parts.indexOf(part), 1); showSet(); });
    row.append(label, quantity, remove); list.append(row);
  }
  updatePlates();
}
addToSet.addEventListener('click', async () => {
  const snapshot = current; if (!snapshot) return;
  addToSet.disabled = true;
  try {
    const mesh = asciiSTLMesh(await snapshot.stl.text());
    parts.push({ ...snapshot, mesh, bounds: meshBounds(mesh), quantity: 1, id: nextPart++ }); showSet();
  } catch (error) { setStatus.textContent = `Could not add the model: ${error.message}`; }
  finally { addToSet.disabled = !current; }
});
bedForm.addEventListener('input', updatePlates);
bedForm.addEventListener('submit', event => event.preventDefault());
document.querySelector('#clear-set').addEventListener('click', () => { parts.length = 0; showSet(); });
async function exportSet(meshvault) {
  if (exportingSet || !platePlan.length || setExport.disabled) return;
  const plan = platePlan, bed = bedSettings(), format = document.querySelector('#set-format').value;
  const canvases = [...plateLayouts.querySelectorAll('canvas')];
  exportingSet = true; setExport.disabled = zipExport.disabled = true; setStatus.textContent = 'Packaging your print plates…';
  try {
    const models = [];
    for (let i = 0; i < plan.length; i++) {
      const mesh = plateMesh(plan[i].placements), content = format === '3mf' ? create3MF(mesh) : new Blob([plateSTL(mesh)], { type: 'model/stl' });
      const file = new File([content], `gridfinity-plate-${String(i+1).padStart(2,'0')}.${format}`, { type: content.type });
      models.push({ file, title: `Gridfinity set · Plate ${i+1}`, generatorName: 'Xalies Gridfinity Studio', author: demoAccount.name, sourceUrl: 'https://xalies.github.io/generators/gridfinity/', summary: `${plan[i].placements.length} arranged parts for a ${bed.width} × ${bed.depth} mm bed.`, tags: ['gridfinity', 'print-plate', 'generated'], printNotes: 'Print all parts flat on their bases. Verify bed size, clearances and supports in your slicer. This is an arranged model, not a printer-specific sliced project.', settings: { bed, plate: i+1, parts: plan[i].placements.map(item => ({ design: item.part.id, title: item.part.title, copy: item.copy, xMm: item.x, yMm: item.y, rotationDegrees: item.rotated ? 90 : 0, settings: item.part.settings })) }, thumbnail: meshvault ? await canvasThumbnail(canvases[i]) : undefined });
    }
    const blob = await createSetPackage(models, meshvault);
    saveFile(blob, `gridfinity-set.${meshvault ? 'mvpack' : 'zip'}`);
    setStatus.textContent = `Exported ${plan.length} print ${plan.length === 1 ? 'plate' : 'plates'} in one ${meshvault ? 'MeshVault package' : 'ZIP'}.`;
  } catch (error) { setStatus.textContent = `Set export failed: ${error.message}`; }
  finally { exportingSet = false; setExport.disabled = zipExport.disabled = !platePlan.length; }
}
setExport.addEventListener('click', () => exportSet(true));
zipExport.addEventListener('click', () => exportSet(false));
