import { vesselMesh, binarySTL } from './geometry.js';
import { demoAccount, createPackage, create3MF, saveFile, canvasThumbnail } from '../shared/mvpack.js';
const form = document.querySelector('#settings'), status = document.querySelector('#status');
const stl = document.querySelector('#stl'), pack = document.querySelector('#mvpack');
const host = document.querySelector('#viewer');
const printProfile = document.querySelector('#print-profile');
const printProfiles = {
  general: { goal: 'Decorative vessel', nozzleMm: 0.4, layerHeightMm: 0.2, perimeters: 3, bottomSolidThicknessMm: 1.2, infillPercent: 15, minimumRadialWallMm: 1.6, minimumBaseMm: 1.2, advice: 'Use 3 perimeters as a starting point. Check the slicer preview: thin and sloping sections may fit fewer extrusion lines. Decorative prints may leak.' },
  watertight: { goal: 'Watertight-focused starting point', flowPercent: 105, extrusionMultiplier: 1.05, flowAdjustmentOptional: true, nozzleMm: 0.4, layerHeightMm: 0.15, perimeters: 5, bottomSolidThicknessMm: 1.8, infillPercent: 15, minimumRadialWallMm: 2.4, minimumBaseMm: 2, advice: 'Start with 5 perimeters and a 0.15 mm layer height. Increase the model’s radial wall to at least 2.4 mm and base to at least 2 mm. Inspect every sliced layer for continuous walls and a solid base; steep walls can be thinner than the radial dimension. After calibrating your filament, optionally test 105% flow (extrusion multiplier 1.05, or the equivalent slicer setting). Use one equivalent setting, not both. Extra flow can affect dimensions and cause rough surfaces, stringing or oozing. Check seams and leak-test before holding water.' }
};
function showPrintSettings() {
  const profile = printProfiles[printProfile.value];
  const rows = [['Nozzle', `${profile.nozzleMm} mm`], ['Layer height', `${profile.layerHeightMm} mm`], ['Perimeters', profile.perimeters], ['Solid bottom', `${profile.bottomSolidThicknessMm} mm`], ['Infill', `${profile.infillPercent}%`], ['Spiral vase mode', 'Off'], ['Flow / extrusion multiplier', profile.flowPercent ? `${profile.flowPercent}% / ${profile.extrusionMultiplier} (optional)` : 'Calibrated filament profile']];
  document.querySelector('#print-settings').replaceChildren(...rows.map(([name, value]) => {
    const row = document.createElement('div'), term = document.createElement('dt'), detail = document.createElement('dd');
    term.textContent = name; detail.textContent = value; detail.style.margin = '0'; row.append(term, detail); return row;
  }));
  document.querySelector('#print-advice').textContent = profile.advice;
  const thin = Number(form.elements.wall.value) < profile.minimumRadialWallMm || Number(form.elements.floor.value) < profile.minimumBaseMm;
  document.querySelector('#print-fit').textContent = thin ? `This design is below the suggested ${profile.minimumRadialWallMm} mm radial wall or ${profile.minimumBaseMm} mm base. Apply the minimums or adjust the shape controls.` : 'The design meets the suggested radial wall and base minimums. Check the actual extrusion paths in your slicer.';
}
printProfile.addEventListener('change', showPrintSettings);
document.querySelector('#apply-print-dimensions').addEventListener('click', () => {
  const profile = printProfiles[printProfile.value];
  form.elements.wall.value = Math.max(Number(form.elements.wall.value), profile.minimumRadialWallMm);
  form.elements.floor.value = Math.max(Number(form.elements.floor.value), profile.minimumBaseMm);
  update();
});
let renderer, scene, camera, controls, mesh, current, frame;
const presets = {
  vase: { title: 'Twisted fluted vase', height: 160, base: 65, belly: 100, mouth: 60, flutes: 24, amplitude: 2, twist: 60 },
  bowl: { title: 'Ripple bowl', height: 65, base: 80, belly: 150, mouth: 170, flutes: 32, amplitude: 1.4, twist: 20 },
  urn: { title: 'Soft urn', height: 140, base: 65, belly: 125, mouth: 50, flutes: 0, amplitude: 0, twist: 0 },
  cup: { title: 'Little fluted pot', height: 80, base: 65, belly: 80, mouth: 85, flutes: 20, amplitude: 1, twist: 0 }
};
function resetView() {
  const s = current?.settings;
  if (!s || !camera) return;
  const size = Math.max(s.height, s.belly, s.mouth, s.base);
  const distance = size * 1.7 / Math.min(1, camera.aspect);
  camera.position.set(distance, s.height * .5 + distance * .55, distance);
  controls.target.set(0, s.height * .45, 0); controls.update();
}
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor('#19231f');
  host.append(renderer.domElement);
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(35, 1, .1, 5000);
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x677562, .85));
  const key = new THREE.DirectionalLight(0xfff1e3, .85); key.position.set(150, 250, 200); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, .35); fill.position.set(-150, 100, -100); scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshLambertMaterial({ color: '#19231f' }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.1; scene.add(ground);
  const grid = new THREE.GridHelper(400, 20, 0x3d5549, 0x2b3c33); grid.position.y = -.05; scene.add(grid);
  new ResizeObserver(() => {
    renderer.setSize(host.clientWidth, host.clientHeight);
    camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix();
    resetView(); renderer.render(scene, camera);
  }).observe(host);
  controls.addEventListener('change', () => renderer.render(scene, camera));
} catch { status.textContent = '3D preview unavailable. You can still export your model.'; }

function update() {
  showPrintSettings();
  cancelAnimationFrame(frame);
  current = null; stl.disabled = pack.disabled = true;
  frame = requestAnimationFrame(() => {
    for (const name of ['flutes', 'amplitude', 'twist']) document.querySelector(`#${name}-value`).textContent = form.elements[name].value;
    if (!form.checkValidity() || !form.elements.title.value.trim()) { status.textContent = 'Enter valid dimensions and a design name to continue.'; return; }
    const settings = Object.fromEntries([...new FormData(form)].map(([name, value]) => [name, ['title', 'quality'].includes(name) ? value : Number(value)]));
    const geometry = vesselMesh(settings);
    const stem = settings.title.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'vessel';
    const format = document.querySelector('#format').value;
    const printGeometry = { indices: geometry.indices, positions: [] };
    for (let i = 0; i < geometry.positions.length; i += 3) printGeometry.positions.push(geometry.positions[i], -geometry.positions[i + 2], geometry.positions[i + 1]);
    const content = format === '3mf' ? create3MF(printGeometry) : new Blob([binarySTL(geometry)], { type: 'model/stl' });
    const file = new File([content], `${stem}.${format}`, { type: content.type });
    stl.textContent = `Download ${format.toUpperCase()} ↓`;
    current = { file, settings };
    if (renderer && scene && controls) {
      if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(geometry.positions, 3)); g.setIndex(geometry.indices); g.computeVertexNormals();
      mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: document.querySelector('#colour').value, roughness: .78, metalness: 0 }));
      scene.add(mesh); resetView(); renderer.render(scene, camera); host.dataset.loaded = 'true';
    }
    document.querySelector('#dimensions').textContent = `${settings.height} mm tall · ${geometry.indices.length / 3} triangles · ${(file.size / 1024).toFixed(0)} KB`;
    document.querySelector('#package-contents').textContent = `${stem}.mvpack\n├── ${file.name}\n├── meshvault.model.json\n${renderer && mesh ? '├── images/thumbnail.png\n' : ''}└── documents/generator-settings.json`;
    status.textContent = renderer && mesh ? 'Your design is ready.' : 'Model ready. 3D preview unavailable.';
    stl.disabled = pack.disabled = false;
  });
}
form.addEventListener('input', update);
document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
  for (const [key, value] of Object.entries(presets[button.dataset.preset])) form.elements[key].value = value;
  update();
}));
form.addEventListener('submit', event => event.preventDefault());
document.querySelector('#reset-view').addEventListener('click', resetView);
stl.addEventListener('click', () => { if (current) saveFile(current.file, current.file.name); });
pack.addEventListener('click', async () => {
  const snapshot = current; if (!snapshot) return;
  const printNotes = JSON.stringify({ ...printProfiles[printProfile.value], orientation: 'Upright, flat base on the bed', spiralVaseMode: false, temperaturesAndFlow: 'Use a calibrated filament profile.', supports: 'Inspect overhangs in the slicer.', watertightGuaranteed: false, safety: 'Leak-test before holding water; not certified food-safe.', guidanceSource: 'https://blog.prusa3d.com/watertight-3d-printing-pt1-vases-cups-and-other-open-models_48949/' });
  pack.disabled = true;
  try {
    if (renderer && mesh) renderer.render(scene, camera);
    const thumbnail = renderer && mesh ? await canvasThumbnail(renderer.domElement) : null;
    const blob = await createPackage({ ...snapshot, author: demoAccount.name, title: snapshot.settings.title.trim(), generatorName: 'Xalies Vessel Studio', exportDonationUrl: 'https://buymeacoffee.com/xalies', sourceUrl: 'https://xalies.github.io/generators/vessels/', summary: 'A custom hollow vessel designed in Vessel Studio.', tags: ['vessel', 'generated'], printNotes, thumbnail });
    saveFile(blob, snapshot.file.name.replace(/\.(stl|3mf)$/, '.mvpack'));
    status.textContent = 'MeshVault package exported.';
  } catch (error) { status.textContent = `Package export failed: ${error.message}`; }
  finally { pack.disabled = !current; }
});
document.querySelector('#format').addEventListener('change', update);
update();
