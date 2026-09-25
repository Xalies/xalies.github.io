function geometry(sourceWidth, sourceHeight, boxWidth, boxHeight, mode) {
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

function limitBytes(value, unit) {
  return Math.round(value * (unit === 'MB' ? 1048576 : 1024));
}

async function encode(canvas, type, quality) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new Error('The browser could not export this image. Try smaller dimensions.');
  if (blob.type !== type) throw new Error('This browser does not support the selected output format.');
  return blob;
}

async function encodeToLimit(canvas, type, maxBytes) {
  let blob = await encode(canvas, type, .95);
  if (blob.size <= maxBytes) return { blob, quality: type === 'image/png' ? null : .95 };
  if (type === 'image/png') return null;

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
  const status = $('result-meta');
  const limitInput = $('limit');
  const useLimit = $('use-limit');
  let currentLimitUnit = form.elements.limitUnit.value;
  if (currentLimitUnit === 'MB') {
    limitInput.min = '0.000001';
    limitInput.max = '50';
  }
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
    status.textContent = 'Your download will appear here.';
    status.classList.remove('error');
    $('download').hidden = true;
    $('download').removeAttribute('href');
  }

  function updateDimensions() {
    const mode = form.elements.mode.value;
    $('width-label').textContent = mode === 'scale' ? 'Max width / px' : 'Output width / px';
    $('height-label').textContent = mode === 'scale' ? 'Max height / px' : 'Output height / px';
    $('mode-hint').textContent = mode === 'scale'
      ? 'Keep the whole image. The result fits within the width and height below.'
      : 'Fill the width and height below exactly. The centre is cropped if needed.';
    const result = $('dimension-result');
    const width = Number($('width').value);
    const height = Number($('height').value);
    if (!bitmap) {
      result.textContent = 'Choose an image to see the output size.';
    } else if (![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 12000)) {
      result.textContent = 'Enter a width and height from 1 to 12,000 px.';
    } else {
      const output = geometry(bitmap.width, bitmap.height, width, height, mode);
      result.textContent = `Output: ${output.width} × ${output.height} px`;
    }
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
    updateDimensions();
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    originalUrl = null;
    $('before').hidden = true;
    $('before').removeAttribute('src');
    $('before-placeholder').hidden = false;
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
    $('file-meta').textContent = `${file.name} · ${bitmap.width} × ${bitmap.height} px · ${sizeText(file.size)}`;
    const fit = Math.min(1, 12000 / Math.max(bitmap.width, bitmap.height));
    $('width').value = Math.max(1, Math.round(bitmap.width * fit));
    $('height').value = Math.max(1, Math.round(bitmap.height * fit));
    updateDimensions();
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
    if (['width', 'height', 'mode'].includes(event.target.name)) updateDimensions();
  });
  $('format').addEventListener('input', () => { if (!processing) clearOutput(); });
  form.addEventListener('change', event => {
    if (event.target === useLimit) {
      $('limit-fields').disabled = !useLimit.checked;
      return;
    }
    if (event.target.name !== 'limitUnit') return;
    const nextUnit = event.target.value;
    if (limitInput.value !== '') {
      const divisor = nextUnit === 'MB' ? 1048576 : 1024;
      limitInput.value = Number((limitBytes(Number(limitInput.value), currentLimitUnit) / divisor).toFixed(8));
    }
    currentLimitUnit = nextUnit;
    limitInput.min = nextUnit === 'MB' ? '0.000001' : '1';
    limitInput.max = nextUnit === 'MB' ? '50' : '51200';
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
    const limit = useLimit.checked ? limitBytes(Number(limitInput.value), form.elements.limitUnit.value) : Infinity;
    processing = true;
    const disabledControls = [...form.elements].map(control => [control, control.disabled]);
    for (const control of form.elements) control.disabled = true;
    clearOutput();
    setStatus('Processing image…');
    try {
      const width = Number($('width').value);
      const height = Number($('height').value);
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
      if (!result) throw new Error(type === 'image/png'
        ? `PNG cannot fit under ${sizeText(limit)} at ${g.width} × ${g.height} px. Reduce the dimensions, choose WebP or JPEG, or raise the limit.`
        : `Cannot get under ${sizeText(limit)} at ${g.width} × ${g.height} px. Reduce the dimensions or raise the limit.`);

      outputUrl = URL.createObjectURL(result.blob);
      $('after').src = outputUrl;
      $('after').hidden = false;
      $('after-placeholder').hidden = true;
      const saved = Math.round((1 - result.blob.size / selectedFile.size) * 100);
      status.textContent = `${sizeText(result.blob.size)} · ${saved >= 0 ? `${saved}% smaller` : `${Math.abs(saved)}% larger`}${result.quality === null ? '' : ` · quality ${Math.round(result.quality * 100)}%`}`;
      const download = $('download');
      download.href = outputUrl;
      download.download = `${selectedFile.name.replace(/\.[^.]+$/, '')}-resized.${type === 'image/webp' ? 'webp' : type === 'image/png' ? 'png' : 'jpg'}`;
      download.hidden = false;
    } catch (error) {
      setStatus(error.message || 'The image could not be processed.', true);
    } finally {
      processing = false;
      for (const [control, disabled] of disabledControls) control.disabled = disabled;
    }
  });

  addEventListener('pagehide', () => {
    if (bitmap) bitmap.close();
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
  });
}

if (typeof module !== 'undefined') module.exports = { geometry, limitBytes, encodeToLimit };
