// SPDX-License-Identifier: GPL-2.0-only
const form = document.querySelector('#settings');
const status = document.querySelector('#status');
const download = document.querySelector('#download');
const cancel = document.querySelector('#cancel');
const generate = document.querySelector('#generate');
const log = document.querySelector('#log');
const part = document.querySelector('#part');
let worker, url, viewer;

part.addEventListener('change', () => {
  const base = part.value === 'baseplate';
  form.querySelectorAll('[data-bin]').forEach(section => {
    section.hidden = base;
    section.querySelectorAll('input, select').forEach(input => { input.disabled = base; });
  });
  document.querySelector('#base-note').hidden = !base;
  form.elements.chambers.setCustomValidity('');
});

try {
  viewer = new StlViewer(document.querySelector('#viewer'), {
    auto_rotate: false, auto_resize: true, bg_color: '#0e1417',
    model_loaded_callback: id => {
      viewer.set_color(id, '#92e4b1');
      const { dims } = viewer.get_model_info(id);
      const distance = Math.max(dims.x, dims.y, dims.z) * 1.8 / Math.min(1, viewer.camera.aspect);
      viewer.set_camera_state({ position: { x: distance, y: distance * .8, z: distance }, target: { x: 0, y: 0, z: 0 } });
      viewer.stop_auto_zoom();
      document.querySelector('#viewer').dataset.loaded = 'true';
    },
    load_error_callback: () => { status.textContent = 'Preview unavailable. You can still download the STL.'; }
  });
} catch { status.textContent = '3D preview unavailable. STL generation is still available.'; }

function finish(message) {
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
  chamberInput.setCustomValidity(!base && Number(values.chambers) > Number(values.width) * 3 ? 'Use at most 3 compartments per width unit.' : '');
  if (!form.reportValidity()) return;
  const args = ['input.scad', '-o', 'bin.stl'];
  for (const input of form.querySelectorAll('[name]')) {
    if (input.disabled) continue;
    const value = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value;
    args.push('-D', `${input.name}=${JSON.stringify(value)}`);
  }
  args.push('-D', 'hole_overhang_remedy=true');
  if (base) args.push('-D', `xsize=${values.width}`, '-D', `ysize=${values.depth}`);
  download.hidden = true;
  if (url) URL.revokeObjectURL(url);
  url = null;
  generate.disabled = true;
  cancel.disabled = false;
  log.textContent = '';
  status.textContent = 'Generating… You can keep using this page or cancel.';
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
      const name = base ? `gridfinity-baseplate-${values.width}x${values.depth}.stl` : `gridfinity-${values.width}x${values.depth}x${values.height}.stl`;
      const file = new File([content], name, { type: 'model/stl' });
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
      inputs: [['input.scad', `include <gridfinity_bins/${base ? 'gridfinity_baseplate' : 'gridfinity_basic_cup'}.scad>`]],
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
