import { zipSync, strToU8 } from './vendor/fflate.js';
export const demoAccount = { name: 'Xalies' };

// Both demos package the same bytes as their normal STL downloads.
async function packageModel({ file, title, author, generatorName, exportDonationUrl, sourceUrl, summary, tags, settings, printNotes, thumbnail }, prefix = '') {
  const name = prefix + file.name, documentPath = `documents/${prefix}generator-settings.json`, thumbnailPath = `images/${prefix}thumbnail.png`;
  const metadata = {
    schema: 'meshvault.model', version: 1, title,
    exportedUtc: new Date().toISOString(), generatorName, sourceUrl, summary, tags,
    ...(author ? { author } : {}),
    ...(exportDonationUrl ? { exportDonationUrl } : {}),
    fileName: name, relativePath: name, fileType: file.name.split('.').pop().toUpperCase(), fileSizeBytes: file.size,
    documentFiles: [documentPath],
    ...(printNotes ? { printSettingsJson: printNotes } : {}),
    ...(thumbnail ? { thumbnailFile: thumbnailPath } : {})
  };
  const entries = {
    [name]: new Uint8Array(await file.arrayBuffer()),
    [documentPath]: strToU8(JSON.stringify(settings, null, 2))
  };
  if (thumbnail) entries[thumbnailPath] = new Uint8Array(await thumbnail.arrayBuffer());
  return { metadata, entries };
}

export async function createPackage(model) {
  const { metadata, entries } = await packageModel(model);
  entries['meshvault.model.json'] = strToU8(JSON.stringify(metadata, null, 2));
  return new Blob([zipSync(entries, { level: 1 })], { type: 'application/vnd.meshvault.package+zip' });
}

export async function createSetPackage(models, meshvault) {
  if (!models.length) throw new Error('Add at least one model to the set.');
  const entries = {}, manifest = { schema: 'meshvault.models', version: 1, exportedUtc: new Date().toISOString(), models: [] };
  for (let i = 0; i < models.length; i++) {
    const { metadata, entries: files } = await packageModel(models[i], `${String(i + 1).padStart(2, '0')}-`);
    if (meshvault) { Object.assign(entries, files); manifest.models.push(metadata); }
    else entries[metadata.relativePath] = files[metadata.relativePath];
  }
  if (meshvault) entries['meshvault.models.json'] = strToU8(JSON.stringify(manifest, null, 2));
  return new Blob([zipSync(entries, { level: 1 })], { type: meshvault ? 'application/vnd.meshvault.package+zip' : 'application/zip' });
}

// 3MF Core: millimetres, one mesh object, one build item. No slicer-specific settings.
export function create3MF({ positions, indices }) {
  const vertices = [];
  for (let i = 0; i < positions.length; i += 3) vertices.push(`<vertex x="${positions[i]}" y="${positions[i + 1]}" z="${positions[i + 2]}"/>`);
  const triangles = [];
  for (let i = 0; i < indices.length; i += 3) triangles.push(`<triangle v1="${indices[i]}" v2="${indices[i + 1]}" v3="${indices[i + 2]}"/>`);
  const entries = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),
    '3D/3dmodel.model': strToU8(`<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model"><mesh><vertices>${vertices.join('')}</vertices><triangles>${triangles.join('')}</triangles></mesh></object></resources><build><item objectid="1"/></build></model>`)
  };
  return new Blob([zipSync(entries, { level: 1 })], { type: 'model/3mf' });
}

export function asciiSTLMesh(text) {
  const positions = [], indices = [], lookup = new Map();
  for (const match of text.matchAll(/vertex\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)/g)) {
    const point = match.slice(1).map(Number);
    if (!point.every(Number.isFinite)) throw new Error('Invalid STL vertex.');
    const key = point.join(',');
    if (!lookup.has(key)) { lookup.set(key, positions.length / 3); positions.push(...point); }
    indices.push(lookup.get(key));
  }
  if (!indices.length || indices.length % 3) throw new Error('Incomplete STL mesh.');
  return { positions, indices };
}

export function saveFile(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function canvasThumbnail(canvas) {
  const image = document.createElement('canvas'); image.width = 1280; image.height = 720;
  const context = image.getContext('2d'), scale = Math.min(image.width / canvas.width, image.height / canvas.height);
  context.fillStyle = '#19231f'; context.fillRect(0, 0, image.width, image.height);
  const width = canvas.width * scale, height = canvas.height * scale;
  context.drawImage(canvas, (image.width - width) / 2, (image.height - height) / 2, width, height);
  return new Promise((resolve, reject) => image.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not capture the preview.')), 'image/png'));
}
