const encoder = new TextEncoder();

export const PRESETS = {
  classic: [[24, 0], [30, 5], [35, 22], [28, 48], [39, 76], [31, 104], [36, 120]],
  bud: [[22, 0], [29, 6], [38, 30], [42, 62], [35, 92], [19, 116], [17, 128]],
  urn: [[25, 0], [34, 5], [42, 25], [44, 62], [32, 94], [27, 112], [35, 120]]
};

function point(radius, z) { return { x: radius, y: 0, z }; }

function interpolateRadius(profile, z) {
  for (let index = 1; index < profile.length; index += 1) {
    const low = profile[index - 1];
    const high = profile[index];
    if (z <= high.z) {
      const span = high.z - low.z || 1;
      const amount = (z - low.z) / span;
      return low.radius + (high.radius - low.radius) * amount;
    }
  }
  return profile.at(-1).radius;
}

function ringPoint(radius, z, segment, segments) {
  const angle = segment / segments * Math.PI * 2;
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle), z };
}

function addQuad(triangles, a, b, c, d, reverse = false) {
  if (reverse) triangles.push([a, c, b], [a, d, c]);
  else triangles.push([a, b, c], [a, c, d]);
}

export function buildVaseMesh(profileInput, segments = 96, wallThickness = 1.6, bottomThickness = 2.4, textureSampler = null) {
  const profile = profileInput
    .map(([radius, z]) => ({ radius: Number(radius), z: Number(z) }))
    .sort((a, b) => a.z - b.z);
  if (profile.length < 3 || segments < 12) throw new Error("The vase needs at least three profile points.");
  if (profile.some(item => !Number.isFinite(item.radius) || !Number.isFinite(item.z))) throw new Error("Profile points must be valid numbers.");
  if (profile[0].z !== 0 || profile.some((item, index) => index && item.z <= profile[index - 1].z)) throw new Error("Profile heights must increase from zero.");
  const minimumRadius = Math.min(...profile.map(item => item.radius));
  if (wallThickness <= 0 || wallThickness >= minimumRadius - .4) throw new Error("Wall thickness is too large for this profile.");
  const height = profile.at(-1).z;
  if (bottomThickness <= 0 || bottomThickness >= height) throw new Error("Bottom thickness must be smaller than the vase height.");

  const outerProfile = textureSampler
    ? [...new Set([
        ...profile.map(item => item.z),
        ...Array.from({ length: 41 }, (_, index) => height * index / 40)
      ])].sort((a, b) => a - b).map(z => ({ radius: interpolateRadius(profile, z), z }))
    : profile;

  const innerProfile = [{ radius: interpolateRadius(profile, bottomThickness) - wallThickness, z: bottomThickness }];
  for (const item of profile) {
    if (item.z > bottomThickness) innerProfile.push({ radius: item.radius - wallThickness, z: item.z });
  }

  const triangles = [];
  const outerPoint = (item, segment) => {
    if (!textureSampler) return ringPoint(item.radius, item.z, segment, segments);
    const v = item.z / height;
    const fade = Math.sin(Math.PI * v);
    const displacement = Number(textureSampler(segment / segments, v)) * fade || 0;
    const radius = Math.max(item.radius - wallThickness + .6, item.radius + displacement);
    return ringPoint(radius, item.z, segment, segments);
  };

  for (let ring = 1; ring < outerProfile.length; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      addQuad(
        triangles,
        outerPoint(outerProfile[ring - 1], segment),
        outerPoint(outerProfile[ring - 1], next),
        outerPoint(outerProfile[ring], next),
        outerPoint(outerProfile[ring], segment)
      );
    }
  }

  for (let ring = 1; ring < innerProfile.length; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      addQuad(
        triangles,
        ringPoint(innerProfile[ring - 1].radius, innerProfile[ring - 1].z, segment, segments),
        ringPoint(innerProfile[ring - 1].radius, innerProfile[ring - 1].z, next, segments),
        ringPoint(innerProfile[ring].radius, innerProfile[ring].z, next, segments),
        ringPoint(innerProfile[ring].radius, innerProfile[ring].z, segment, segments),
        true
      );
    }
  }

  const bottomCentre = point(0, 0);
  const floorCentre = point(0, bottomThickness);
  const outerBottom = profile[0];
  const innerBottom = innerProfile[0];
  const outerTop = profile.at(-1);
  const innerTop = innerProfile.at(-1);
  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    triangles.push([
      bottomCentre,
      ringPoint(outerBottom.radius, 0, next, segments),
      ringPoint(outerBottom.radius, 0, segment, segments)
    ]);
    triangles.push([
      floorCentre,
      ringPoint(innerBottom.radius, bottomThickness, segment, segments),
      ringPoint(innerBottom.radius, bottomThickness, next, segments)
    ]);
    addQuad(
      triangles,
      ringPoint(innerTop.radius, height, segment, segments),
      ringPoint(outerTop.radius, height, segment, segments),
      ringPoint(outerTop.radius, height, next, segments),
      ringPoint(innerTop.radius, height, next, segments)
    );
  }

  return {
    triangles,
    height,
    maxRadius: Math.max(...triangles.flat().map(item => Math.hypot(item.x, item.y))),
    wallThickness,
    bottomThickness,
    segments
  };
}

function triangleNormal([a, b, c]) {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  const normal = {
    x: ab.y * ac.z - ab.z * ac.y,
    y: ab.z * ac.x - ab.x * ac.z,
    z: ab.x * ac.y - ab.y * ac.x
  };
  const length = Math.hypot(normal.x, normal.y, normal.z) || 1;
  return { x: normal.x / length, y: normal.y / length, z: normal.z / length };
}

const cleanNumber = value => Math.abs(value) < 1e-8 ? 0 : Number(value.toFixed(6));

export function asciiStl(mesh, name = "meshvault_vase") {
  const lines = [`solid ${name}`];
  for (const triangle of mesh.triangles) {
    const normal = triangleNormal(triangle);
    lines.push(`  facet normal ${cleanNumber(normal.x)} ${cleanNumber(normal.y)} ${cleanNumber(normal.z)}`, "    outer loop");
    for (const vertex of triangle) lines.push(`      vertex ${cleanNumber(vertex.x)} ${cleanNumber(vertex.y)} ${cleanNumber(vertex.z)}`);
    lines.push("    endloop", "  endfacet");
  }
  lines.push(`endsolid ${name}`);
  return lines.join("\n");
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let current = value;
  for (let bit = 0; bit < 8; bit += 1) current = (current & 1) ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
  return current >>> 0;
});

export function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

function write16(view, offset, value) { view.setUint16(offset, value, true); }
function write32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }

export function buildStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name.replaceAll("\\", "/").replace(/^\/+/, ""));
    const data = entry.data instanceof Uint8Array ? entry.data : encoder.encode(entry.data);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    write32(localView, 0, 0x04034b50); write16(localView, 4, 20); write16(localView, 6, 0x0800);
    write32(localView, 14, crc); write32(localView, 18, data.length); write32(localView, 22, data.length);
    write16(localView, 26, name.length); local.set(name, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    write32(centralView, 0, 0x02014b50); write16(centralView, 4, 20); write16(centralView, 6, 20); write16(centralView, 8, 0x0800);
    write32(centralView, 16, crc); write32(centralView, 20, data.length); write32(centralView, 24, data.length);
    write16(centralView, 28, name.length); write32(centralView, 42, localOffset); central.set(name, 46);
    centralParts.push(central);
    localOffset += local.length + data.length;
  }

  const central = concatBytes(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  write32(endView, 0, 0x06054b50); write16(endView, 8, entries.length); write16(endView, 10, entries.length);
  write32(endView, 12, central.length); write32(endView, 16, localOffset);
  return concatBytes([...localParts, central, end]);
}

export function normaliseRelativePath(raw) {
  const parts = String(raw || "")
    .replaceAll("\\", "/")
    .split("/")
    .map(part => part.trim())
    .filter(part => part && part !== "." && part !== "..");
  return parts.join("/");
}

function safeName(raw, fallback = "Generated-Vase") {
  return String(raw || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "") || fallback;
}

async function sha256Hex(bytes) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function packMetadata(metadata) {
  const stream = new Blob([JSON.stringify(metadata, null, 2)])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return concatBytes([encoder.encode("MVMD1\n"), compressed]);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: value >> 16, g: (value >> 8) & 255, b: value & 255 };
}

function shade(hex, amount) {
  const rgb = hexToRgb(hex);
  const mix = Math.max(.14, Math.min(1.15, amount));
  return `rgb(${Math.min(255, rgb.r * mix)}, ${Math.min(255, rgb.g * mix)}, ${Math.min(255, rgb.b * mix)})`;
}

function fitCanvas(canvas) {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  return { width, height, ratio };
}

function renderVase(canvas, mesh, options = {}) {
  const { width, height } = options.fixedSize
    ? { width: options.fixedSize, height: options.fixedSize }
    : fitCanvas(canvas);
  if (options.fixedSize && (canvas.width !== width || canvas.height !== height)) { canvas.width = width; canvas.height = height; }
  const context = canvas.getContext("2d");
  const background = context.createRadialGradient(width * .44, height * .32, 10, width * .5, height * .5, width * .72);
  background.addColorStop(0, "#332442"); background.addColorStop(.5, "#19131f"); background.addColorStop(1, "#0d0a10");
  context.fillStyle = background; context.fillRect(0, 0, width, height);

  const yaw = options.yaw ?? state.yaw;
  const elevation = options.elevation ?? state.elevation;
  const zoom = options.zoom ?? state.zoom;
  const colour = options.colour ?? state.colour;
  const scale = Math.min(width / (mesh.maxRadius * 3.1), height / (mesh.height * 1.34)) * zoom;
  const centreX = width * .5;
  const centreY = height * .52;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), ce = Math.cos(elevation), se = Math.sin(elevation);
  const transform = vertex => {
    const rotatedX = vertex.x * cy - vertex.y * sy;
    const rotatedY = vertex.x * sy + vertex.y * cy;
    const centredZ = vertex.z - mesh.height / 2;
    return {
      x: centreX + rotatedX * scale,
      y: centreY - (centredZ * ce - rotatedY * se) * scale,
      depth: rotatedY * ce + centredZ * se
    };
  };

  context.save();
  context.translate(centreX, centreY + mesh.height * scale * .47);
  context.scale(1, .22);
  const shadow = context.createRadialGradient(0, 0, 0, 0, 0, mesh.maxRadius * scale * 1.45);
  shadow.addColorStop(0, "rgba(0,0,0,.52)"); shadow.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = shadow; context.beginPath(); context.arc(0, 0, mesh.maxRadius * scale * 1.45, 0, Math.PI * 2); context.fill(); context.restore();

  const faces = mesh.triangles.map(triangle => {
    const projected = triangle.map(transform);
    const normal = triangleNormal(triangle);
    const nx = normal.x * cy - normal.y * sy;
    const ny = normal.x * sy + normal.y * cy;
    const screenZ = normal.z * ce - ny * se;
    const depthNormal = ny * ce + normal.z * se;
    const light = Math.max(0, nx * -.42 + depthNormal * .58 + screenZ * .68);
    return { projected, depth: projected.reduce((sum, item) => sum + item.depth, 0) / 3, light };
  }).sort((a, b) => a.depth - b.depth);

  context.lineWidth = Math.max(0.35, width / 1500);
  for (const face of faces) {
    context.beginPath(); context.moveTo(face.projected[0].x, face.projected[0].y);
    context.lineTo(face.projected[1].x, face.projected[1].y); context.lineTo(face.projected[2].x, face.projected[2].y); context.closePath();
    context.fillStyle = shade(colour, .42 + face.light * .72); context.fill();
    context.strokeStyle = "rgba(255,255,255,.025)"; context.stroke();
  }

  const vignette = context.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .3, width / 2, height / 2, Math.max(width, height) * .72);
  vignette.addColorStop(0, "rgba(0,0,0,0)"); vignette.addColorStop(1, "rgba(0,0,0,.38)");
  context.fillStyle = vignette; context.fillRect(0, 0, width, height);
}

const state = {
  profile: PRESETS.classic.map(([radius, z]) => [radius, z]),
  selected: 3,
  yaw: -.55,
  elevation: .13,
  zoom: 1,
  colour: "#b483ff",
  brush: "raise",
  textureWidth: 96,
  textureHeight: 48,
  textureMap: new Float32Array(96 * 48),
  mesh: null
};

function presetTexture(name, u, v) {
  if (name === "ribs") return .5 + .5 * Math.cos(u * Math.PI * 24);
  if (name === "waves") return Math.sin((u * 8 + v * 3) * Math.PI * 2) * .7;
  if (name === "hammered") return (Math.sin((u * 17 + v * 7) * Math.PI * 2) + Math.sin((u * 31 - v * 11) * Math.PI * 2)) * .3;
  return 0;
}

function samplePaint(u, v) {
  const x = ((u % 1 + 1) % 1) * state.textureWidth;
  const y = (1 - Math.max(0, Math.min(1, v))) * (state.textureHeight - 1);
  const x0 = Math.floor(x) % state.textureWidth, x1 = (x0 + 1) % state.textureWidth;
  const y0 = Math.floor(y), y1 = Math.min(state.textureHeight - 1, y0 + 1);
  const tx = x - Math.floor(x), ty = y - y0;
  const at = (column, row) => state.textureMap[row * state.textureWidth + column];
  return (at(x0, y0) * (1 - tx) + at(x1, y0) * tx) * (1 - ty) + (at(x0, y1) * (1 - tx) + at(x1, y1) * tx) * ty;
}

function textureValue(u, v) {
  const preset = typeof document === "undefined" ? "smooth" : document.querySelector("#texturePreset").value;
  return Math.max(-1, Math.min(1, presetTexture(preset, u, v) + samplePaint(u, v)));
}

function currentTextureSampler() {
  const preset = document.querySelector("#texturePreset").value;
  if (preset === "smooth" && !state.textureMap.some(value => value)) return null;
  const depth = Number(document.querySelector("#textureDepth").value);
  return (u, v) => textureValue(u, v) * depth;
}

function currentSettings() {
  return {
    segments: Number(document.querySelector("#segments").value),
    wall: Number(document.querySelector("#wallThickness").value),
    bottom: Number(document.querySelector("#bottomThickness").value)
  };
}

function rebuild() {
  try {
    const settings = currentSettings();
    state.mesh = buildVaseMesh(state.profile, settings.segments, settings.wall, settings.bottom, currentTextureSampler());
    const diameter = state.mesh.maxRadius * 2;
    document.querySelector("#modelStats").textContent = `${diameter.toFixed(1)} mm Ø × ${state.mesh.height.toFixed(1)} mm · ${state.mesh.triangles.length.toLocaleString()} triangles`;
    document.querySelector("#status").classList.remove("error");
    renderAll();
  } catch (error) {
    document.querySelector("#status").textContent = error.message;
    document.querySelector("#status").classList.add("error");
  }
}

function profileCoordinates(canvas, radius, z) {
  const width = canvas.width, height = canvas.height;
  const maxRadius = Math.max(55, ...state.profile.map(item => item[0] * 1.18));
  const maxHeight = state.profile.at(-1)[1] * 1.08;
  const left = width * .12, right = width * .9, top = height * .06, bottom = height * .9;
  return { x: left + radius / maxRadius * (right - left), y: bottom - z / maxHeight * (bottom - top), left, right, top, bottom, maxRadius, maxHeight };
}

function renderProfile() {
  const canvas = document.querySelector("#profileCanvas");
  const { width, height, ratio } = fitCanvas(canvas);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);
  const frame = profileCoordinates(canvas, 0, 0);
  context.strokeStyle = "rgba(255,255,255,.055)"; context.lineWidth = 1;
  for (let x = frame.left; x <= frame.right; x += (frame.right - frame.left) / 5) { context.beginPath(); context.moveTo(x, frame.top); context.lineTo(x, frame.bottom); context.stroke(); }
  for (let y = frame.top; y <= frame.bottom; y += (frame.bottom - frame.top) / 6) { context.beginPath(); context.moveTo(frame.left, y); context.lineTo(frame.right, y); context.stroke(); }
  context.strokeStyle = "rgba(180,131,255,.48)"; context.lineWidth = 1.5 * ratio;
  context.beginPath(); context.moveTo(frame.left, frame.top); context.lineTo(frame.left, frame.bottom); context.stroke();

  const projected = state.profile.map(([radius, z]) => profileCoordinates(canvas, radius, z));
  const fill = context.createLinearGradient(frame.left, 0, frame.right, 0); fill.addColorStop(0, "rgba(180,131,255,.05)"); fill.addColorStop(1, "rgba(180,131,255,.24)");
  context.beginPath(); context.moveTo(frame.left, projected[0].y);
  for (const item of projected) context.lineTo(item.x, item.y);
  context.lineTo(frame.left, projected.at(-1).y); context.closePath(); context.fillStyle = fill; context.fill();
  context.beginPath(); context.moveTo(projected[0].x, projected[0].y);
  for (const item of projected.slice(1)) context.lineTo(item.x, item.y);
  context.strokeStyle = "#b483ff"; context.lineWidth = 2.5 * ratio; context.lineJoin = "round"; context.stroke();
  projected.forEach((item, index) => {
    context.beginPath(); context.arc(item.x, item.y, (index === state.selected ? 6 : 4.5) * ratio, 0, Math.PI * 2);
    context.fillStyle = index === state.selected ? "#f5eaff" : "#b483ff"; context.fill();
    context.strokeStyle = "#5b3b73"; context.lineWidth = 2 * ratio; context.stroke();
  });
  context.fillStyle = "#807486"; context.font = `${10 * ratio}px system-ui`; context.fillText("CENTRE", frame.left + 7 * ratio, frame.top + 14 * ratio);
}

function renderAll() {
  renderProfile();
  if (state.mesh) renderVase(document.querySelector("#previewCanvas"), state.mesh);
  renderTextureMap();
  syncPointEditor();
}

function renderTextureMap() {
  const canvas = document.querySelector("#textureCanvas");
  const { width, height, ratio } = fitCanvas(canvas);
  const context = canvas.getContext("2d");
  const pixels = context.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = textureValue(x / width, 1 - y / Math.max(1, height - 1));
      const light = Math.round(72 + (value + 1) * 56);
      const offset = (y * width + x) * 4;
      pixels.data[offset] = Math.min(216, light + 22);
      pixels.data[offset + 1] = Math.max(35, light - 38);
      pixels.data[offset + 2] = Math.min(255, light + 62);
      pixels.data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  context.strokeStyle = "rgba(255,255,255,.12)"; context.lineWidth = ratio;
  for (let x = width / 8; x < width; x += width / 8) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
  context.strokeRect(.5, .5, width - 1, height - 1);
}

function configureTextureEditor() {
  const canvas = document.querySelector("#textureCanvas");
  let painting = false, frame = 0;
  const queueRebuild = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; rebuild(); });
  };
  const paint = event => {
    const bounds = canvas.getBoundingClientRect();
    const centreU = (event.clientX - bounds.left) / bounds.width;
    const centreV = (event.clientY - bounds.top) / bounds.height;
    const radius = Number(document.querySelector("#brushSize").value) / 100;
    const before = state.brush === "smooth" ? state.textureMap.slice() : state.textureMap;
    const at = (column, row) => before[row * state.textureWidth + (column + state.textureWidth) % state.textureWidth];
    for (let y = 0; y < state.textureHeight; y += 1) {
      for (let x = 0; x < state.textureWidth; x += 1) {
        const u = (x + .5) / state.textureWidth;
        const v = (y + .5) / state.textureHeight;
        const dx = Math.min(Math.abs(u - centreU), 1 - Math.abs(u - centreU));
        const distance = Math.hypot(dx, (v - centreV) * .75);
        if (distance >= radius) continue;
        const index = y * state.textureWidth + x;
        const strength = (1 - distance / radius) * .16;
        if (state.brush === "smooth") {
          let total = 0;
          for (let oy = -1; oy <= 1; oy += 1) for (let ox = -1; ox <= 1; ox += 1) total += at(x + ox, Math.max(0, Math.min(state.textureHeight - 1, y + oy)));
          state.textureMap[index] += (total / 9 - state.textureMap[index]) * strength * 2;
        } else {
          state.textureMap[index] = Math.max(-1, Math.min(1, state.textureMap[index] + strength * (state.brush === "raise" ? 1 : -1)));
        }
      }
    }
    renderTextureMap(); queueRebuild();
  };
  canvas.addEventListener("pointerdown", event => { painting = true; canvas.setPointerCapture(event.pointerId); paint(event); });
  canvas.addEventListener("pointermove", event => { if (painting) paint(event); });
  canvas.addEventListener("pointerup", () => { painting = false; });
  canvas.addEventListener("pointercancel", () => { painting = false; });
  document.querySelectorAll("[data-brush]").forEach(button => button.addEventListener("click", () => {
    state.brush = button.dataset.brush;
    document.querySelectorAll("[data-brush]").forEach(item => item.classList.toggle("active", item === button));
  }));
  document.querySelector("#clearTexture").addEventListener("click", () => { state.textureMap.fill(0); rebuild(); });
  document.querySelector("#texturePreset").addEventListener("change", rebuild);
  document.querySelector("#textureDepth").addEventListener("change", rebuild);
}

function syncPointEditor() {
  const select = document.querySelector("#pointSelect");
  if (select.options.length !== state.profile.length) {
    select.replaceChildren(...state.profile.map((_, index) => new Option(`Point ${index + 1}`, String(index))));
  }
  select.value = String(state.selected);
  document.querySelector("#pointRadius").value = state.profile[state.selected][0];
  const height = document.querySelector("#pointHeight");
  height.value = state.profile[state.selected][1];
  height.disabled = state.selected === 0;
  document.querySelector("#removePoint").disabled = state.profile.length <= 3 || state.selected === 0 || state.selected === state.profile.length - 1;
}

function applyPreset(name) {
  state.profile = PRESETS[name].map(item => [...item]);
  state.selected = Math.floor(state.profile.length / 2);
  document.querySelectorAll("[data-preset]").forEach(button => button.classList.toggle("active", button.dataset.preset === name));
  rebuild();
}

function updatePackageName() {
  document.querySelector("#packageName").textContent = `${safeName(document.querySelector("#title").value)}.mvpack`;
}

function configureProfileEditor() {
  const canvas = document.querySelector("#profileCanvas");
  let dragging = false;
  const eventPosition = event => {
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width * canvas.width;
    const y = (event.clientY - bounds.top) / bounds.height * canvas.height;
    const frame = profileCoordinates(canvas, 0, 0);
    return {
      radius: Math.max(4, Math.min(80, (x - frame.left) / (frame.right - frame.left) * frame.maxRadius)),
      z: Math.max(0, Math.min(frame.maxHeight, (frame.bottom - y) / (frame.bottom - frame.top) * frame.maxHeight)),
      x, y
    };
  };
  const nearest = position => {
    let best = -1, distance = 18 * (devicePixelRatio || 1);
    state.profile.forEach(([radius, z], index) => {
      const projected = profileCoordinates(canvas, radius, z);
      const candidate = Math.hypot(projected.x - position.x, projected.y - position.y);
      if (candidate < distance) { best = index; distance = candidate; }
    });
    return best;
  };
  const moveSelected = position => {
    const index = state.selected;
    const minimumZ = index === 0 ? 0 : state.profile[index - 1][1] + 1;
    const maximumZ = index === state.profile.length - 1 ? 240 : state.profile[index + 1][1] - 1;
    state.profile[index] = [Number(position.radius.toFixed(1)), index === 0 ? 0 : Number(Math.max(minimumZ, Math.min(maximumZ, position.z)).toFixed(1))];
    rebuild();
  };
  canvas.addEventListener("pointerdown", event => {
    const found = nearest(eventPosition(event));
    if (found < 0) return;
    state.selected = found; dragging = true; canvas.setPointerCapture(event.pointerId); syncPointEditor();
  });
  canvas.addEventListener("pointermove", event => { if (dragging) moveSelected(eventPosition(event)); });
  canvas.addEventListener("pointerup", () => { dragging = false; });
  canvas.addEventListener("dblclick", event => {
    const position = eventPosition(event);
    const insertAt = state.profile.findIndex(item => item[1] > position.z);
    if (insertAt <= 0) return;
    state.profile.splice(insertAt, 0, [Number(position.radius.toFixed(1)), Number(position.z.toFixed(1))]);
    state.selected = insertAt; rebuild();
  });
  canvas.addEventListener("contextmenu", event => {
    event.preventDefault(); const found = nearest(eventPosition(event));
    if (found <= 0 || found >= state.profile.length - 1 || state.profile.length <= 3) return;
    state.profile.splice(found, 1); state.selected = Math.min(found, state.profile.length - 1); rebuild();
  });
}

function configurePreview() {
  const canvas = document.querySelector("#previewCanvas");
  let dragging = false, previousX = 0, previousY = 0;
  canvas.addEventListener("pointerdown", event => { dragging = true; previousX = event.clientX; previousY = event.clientY; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener("pointermove", event => {
    if (!dragging) return;
    state.yaw += (event.clientX - previousX) * .012;
    state.elevation = Math.max(-.45, Math.min(.45, state.elevation + (event.clientY - previousY) * .005));
    previousX = event.clientX; previousY = event.clientY; renderVase(canvas, state.mesh);
  });
  canvas.addEventListener("pointerup", () => { dragging = false; });
  canvas.addEventListener("wheel", event => {
    event.preventDefault(); state.zoom = Math.max(.62, Math.min(1.45, state.zoom * (event.deltaY > 0 ? .94 : 1.06))); renderVase(canvas, state.mesh);
  }, { passive: false });
}

async function canvasPngBase64() {
  const canvas = document.createElement("canvas");
  renderVase(canvas, state.mesh, { fixedSize: 900, yaw: -.55, elevation: .12, zoom: .92, colour: state.colour });
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function downloadBytes(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setExporting(exporting, message) {
  document.querySelectorAll("#exportPack, #exportPackBottom, #downloadStl").forEach(button => { button.disabled = exporting; });
  const status = document.querySelector("#status"); status.textContent = message; status.classList.remove("error");
}

async function exportMvpack() {
  setExporting(true, "Rendering thumbnail and building package…");
  try {
    const title = document.querySelector("#title").value.trim() || "Generated Vase";
    const baseName = safeName(title);
    const stl = asciiStl(state.mesh, baseName.replaceAll("-", "_"));
    const stlBytes = encoder.encode(stl);
    const folder = normaliseRelativePath(document.querySelector("#folder").value);
    const fileName = `${baseName}.stl`;
    const relativePath = folder ? `${folder}/${fileName}` : fileName;
    const description = document.querySelector("#description").value.trim();
    const settings = currentSettings();
    const metadata = {
      schema: "meshvault.model",
      version: 1,
      exportedUtc: new Date().toISOString(),
      title,
      author: document.querySelector("#author").value.trim(),
      authorUrl: document.querySelector("#authorUrl").value.trim(),
      sourceUrl: document.querySelector("#sourceUrl").value.trim() || location.href.split("#")[0],
      summary: `A ${state.mesh.height.toFixed(1)} mm revolved vase generated in MeshVault Vase Lab.`,
      tags: document.querySelector("#tags").value.split(/[,;\n]/).map(item => item.trim()).filter(Boolean),
      descriptionHtml: description ? `<p>${escapeHtml(description).replaceAll("\n", "<br>")}</p>` : "",
      printSettingsJson: JSON.stringify({
        layerHeightMm: Number(document.querySelector("#layerHeight").value),
        material: document.querySelector("#material").value,
        wallThicknessMm: settings.wall,
        bottomThicknessMm: settings.bottom,
        surfaceTexture: document.querySelector("#texturePreset").selectedOptions[0].textContent,
        reliefDepthMm: Number(document.querySelector("#textureDepth").value),
        handPaintedRelief: state.textureMap.some(value => value !== 0),
        generator: "MeshVault Vase Lab"
      }),
      packageInfo: `Revolved ${settings.segments}-segment vase profile with ${document.querySelector("#texturePreset").value} surface texture`,
      thumbnailDataBase64: await canvasPngBase64(),
      extraImageDataBase64: [],
      fileName,
      relativePath,
      fileType: "STL",
      fileSizeBytes: stlBytes.length,
      sha256: await sha256Hex(stlBytes),
      printedStatus: 0
    };
    const packed = await packMetadata(metadata);
    const packageBytes = buildStoredZip([
      { name: relativePath, data: stlBytes },
      { name: "meshvault.model.mvdata", data: packed }
    ]);
    downloadBytes(packageBytes, `${baseName}.mvpack`, "application/vnd.meshvault.package+zip");
    setExporting(false, `Saved ${baseName}.mvpack with model, details and thumbnail.`);
  } catch (error) {
    setExporting(false, "Export failed.");
    const status = document.querySelector("#status"); status.textContent = error.message; status.classList.add("error");
  }
}

function downloadStl() {
  const title = document.querySelector("#title").value.trim() || "Generated Vase";
  const baseName = safeName(title);
  downloadBytes(encoder.encode(asciiStl(state.mesh, baseName)), `${baseName}.stl`, "model/stl");
  document.querySelector("#status").textContent = `Saved ${baseName}.stl.`;
}

function init() {
  configureProfileEditor(); configurePreview(); configureTextureEditor();
  document.querySelectorAll("[data-preset]").forEach(button => button.addEventListener("click", () => applyPreset(button.dataset.preset)));
  document.querySelector("#resetProfile").addEventListener("click", () => applyPreset("classic"));
  document.querySelector("#pointSelect").addEventListener("change", event => { state.selected = Number(event.target.value); syncPointEditor(); renderProfile(); });
  document.querySelector("#pointRadius").addEventListener("change", event => { state.profile[state.selected][0] = Number(event.target.value); rebuild(); });
  document.querySelector("#pointHeight").addEventListener("change", event => {
    const index = state.selected;
    const minimum = state.profile[index - 1]?.[1] + 1 || 0;
    const maximum = state.profile[index + 1]?.[1] - 1 || 240;
    state.profile[index][1] = Math.max(minimum, Math.min(maximum, Number(event.target.value))); rebuild();
  });
  document.querySelector("#removePoint").addEventListener("click", () => {
    if (state.selected <= 0 || state.selected >= state.profile.length - 1 || state.profile.length <= 3) return;
    state.profile.splice(state.selected, 1); state.selected = Math.min(state.selected, state.profile.length - 1); rebuild();
  });
  ["wallThickness", "bottomThickness", "segments"].forEach(id => document.querySelector(`#${id}`).addEventListener("change", rebuild));
  document.querySelector("#modelColour").addEventListener("input", event => { state.colour = event.target.value; renderVase(document.querySelector("#previewCanvas"), state.mesh); });
  document.querySelector("#title").addEventListener("input", updatePackageName);
  document.querySelector("#downloadStl").addEventListener("click", downloadStl);
  document.querySelector("#exportPack").addEventListener("click", exportMvpack);
  document.querySelector("#exportPackBottom").addEventListener("click", exportMvpack);
  new ResizeObserver(renderAll).observe(document.querySelector(".workspace"));
  rebuild(); updatePackageName();
}

if (typeof document !== "undefined") init();
