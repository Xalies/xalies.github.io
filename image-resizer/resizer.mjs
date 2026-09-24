export function geometry(sourceWidth, sourceHeight, boxWidth, boxHeight, mode) {
  if (![sourceWidth, sourceHeight, boxWidth, boxHeight].every(n => Number.isInteger(n) && n > 0)) {
    throw new Error('Dimensions must be positive whole numbers.');
  }
  if (mode === 'scale') {
    const ratio = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
    return {
      sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight,
      width: Math.min(boxWidth, Math.max(1, Math.round(sourceWidth * ratio))),
      height: Math.min(boxHeight, Math.max(1, Math.round(sourceHeight * ratio)))
    };
  }
  if (mode === 'fill') {
    const cropRatio = Math.min(sourceWidth / boxWidth, sourceHeight / boxHeight);
    const sw = boxWidth * cropRatio;
    const sh = boxHeight * cropRatio;
    return { sx: (sourceWidth - sw) / 2, sy: (sourceHeight - sh) / 2, sw, sh, width: boxWidth, height: boxHeight };
  }
  throw new Error('Choose Scale or Fill.');
}

async function encode(canvas, type, quality) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new Error('The browser could not export this image. Try smaller dimensions.');
  if (blob.type !== type) throw new Error('This browser does not support the selected output format.');
  return blob;
}

export async function encodeToLimit(canvas, type, maxBytes) {
  let blob = await encode(canvas, type, .95);
  if (blob.size <= maxBytes) return { blob, quality: .95 };

  const smallest = await encode(canvas, type, .05);
  if (smallest.size > maxBytes) return null;
  let best = { blob: smallest, quality: .05 };
  let low = .05;
  let high = .95;
  for (let i = 0; i < 9; i++) {
    const quality = (low + high) / 2;
    blob = await encode(canvas, type, quality);
    if (blob.size <= maxBytes) {
      best = { blob, quality };
      low = quality;
    } else {
      high = quality;
    }
  }
  return best;
}

if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  const form = $('form');
  const fileInput = $('file');
  const dropzone = $('dropzone');
  const status = $('status');
  let selectedFile = null;
  let bitmap = null;
  let originalUrl = null;
  let outputUrl = null;
  let processing = false;
  let loadVersion = 0;

  const sizeText = bytes => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(2)} MB` : bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle('error', error);
  }
  function clearOutput() {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = null;
    $('after').hidden = true;
    $('after').removeAttribute('src');
    $('after-placeholder').hidden = false;
    $('after-info').textContent = 'Waiting to process';
    $('result-meta').textContent = 'Your download will appear here.';
    $('download').hidden = true;
    $('download').removeAttribute('href');
  }

  async function loadFile(file) {
    if (processing || !file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setStatus('Choose a PNG, JPEG, or WebP image.', true);
      return;
    }
    const version = ++loadVersion;
    $('process').disabled = true;
    selectedFile = null;
    if (bitmap) bitmap.close();
    bitmap = null;
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    originalUrl = null;
    $('before').hidden = true;
    $('before').removeAttribute('src');
    $('before-placeholder').hidden = false;
    $('before-info').textContent = 'Opening image';
    $('file-meta').textContent = file.name;
    clearOutput();
    setStatus('Opening image…');
    let nextBitmap;
    try {
      nextBitmap = await createImageBitmap(file);
    } catch {
      if (version === loadVersion) setStatus('This image could not be opened.', true);
      return;
    } finally {
      if (version === loadVersion) $('process').disabled = false;
    }
    if (version !== loadVersion) {
      nextBitmap.close();
      return;
    }
    bitmap = nextBitmap;
    selectedFile = file;
    originalUrl = URL.createObjectURL(file);
    const preview = $('before');
    preview.src = originalUrl;
    preview.hidden = false;
    $('before-placeholder').hidden = true;
    $('before-info').textContent = `${bitmap.width} × ${bitmap.height} px · ${sizeText(file.size)}`;
    $('file-meta').textContent = file.name;
    const fit = Math.min(1, 12000 / Math.max(bitmap.width, bitmap.height));
    $('width').value = Math.max(1, Math.round(bitmap.width * fit));
    $('height').value = Math.max(1, Math.round(bitmap.height * fit));
    clearOutput();
    setStatus('Image loaded. Set the output and process it.');
  }

  fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));
  for (const eventName of ['dragenter', 'dragover']) {
    dropzone.addEventListener(eventName, event => {
      event.preventDefault();
      dropzone.classList.add('dragging');
    });
  }
  for (const eventName of ['dragleave', 'drop']) {
    dropzone.addEventListener(eventName, event => {
      event.preventDefault();
      dropzone.classList.remove('dragging');
    });
  }
  dropzone.addEventListener('drop', event => loadFile(event.dataTransfer.files[0]));
  addEventListener('dragover', event => event.preventDefault());
  addEventListener('drop', event => event.preventDefault());
  form.addEventListener('input', event => {
    if (event.target !== fileInput && !processing) clearOutput();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (processing) return;
    if (!bitmap || !selectedFile) {
      setStatus('Choose an image first.', true);
      fileInput.focus();
      return;
    }
    if (!form.reportValidity()) return;
    processing = true;
    for (const control of form.elements) control.disabled = true;
    clearOutput();
    setStatus('Processing image…');
    try {
      const width = Number($('width').value);
      const height = Number($('height').value);
      const limit = Number($('limit').value) * 1024;
      const type = $('format').value;
      const mode = form.elements.mode.value;
      const g = geometry(bitmap.width, bitmap.height, width, height, mode);
      const canvas = document.createElement('canvas');
      canvas.width = g.width;
      canvas.height = g.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('The browser could not create an image canvas.');
      if (type === 'image/jpeg') {
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      context.drawImage(bitmap, g.sx, g.sy, g.sw, g.sh, 0, 0, g.width, g.height);
      const result = await encodeToLimit(canvas, type, limit);
      if (!result) throw new Error(`Cannot get under ${sizeText(limit)} at ${g.width} × ${g.height} px. Reduce the dimensions or raise the limit.`);

      outputUrl = URL.createObjectURL(result.blob);
      $('after').src = outputUrl;
      $('after').hidden = false;
      $('after-placeholder').hidden = true;
      $('after-info').textContent = `${g.width} × ${g.height} px · ${sizeText(result.blob.size)}`;
      const saved = Math.round((1 - result.blob.size / selectedFile.size) * 100);
      $('result-meta').textContent = `${sizeText(result.blob.size)} · ${saved >= 0 ? `${saved}% smaller` : `${Math.abs(saved)}% larger`} · quality ${Math.round(result.quality * 100)}%`;
      const download = $('download');
      download.href = outputUrl;
      download.download = `${selectedFile.name.replace(/\.[^.]+$/, '')}-resized.${type === 'image/webp' ? 'webp' : 'jpg'}`;
      download.hidden = false;
      setStatus('Finished. Your image is ready to download.');
    } catch (error) {
      setStatus(error.message || 'The image could not be processed.', true);
    } finally {
      processing = false;
      for (const control of form.elements) control.disabled = false;
    }
  });

  addEventListener('pagehide', () => {
    if (bitmap) bitmap.close();
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
  });
}
