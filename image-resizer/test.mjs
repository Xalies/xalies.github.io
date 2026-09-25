import assert from 'node:assert/strict';
import resizer from './resizer.js';
const { geometry, limitBytes, encodeToLimit } = resizer;

assert.deepEqual(geometry(1600, 900, 800, 800, 'scale'), {
  sx: 0, sy: 0, sw: 1600, sh: 900, width: 800, height: 450
});
assert.deepEqual(geometry(1600, 900, 800, 800, 'fill'), {
  sx: 350, sy: 0, sw: 900, sh: 900, width: 800, height: 800
});
assert.throws(() => geometry(1600, 900, 0, 800, 'scale'));
assert.equal(limitBytes(25, 'MB'), 26214400);
assert.equal(limitBytes(500, 'KB'), limitBytes(500 / 1024, 'MB'));

const canvas = {
  toBlob(callback, type, quality) { callback({ type, size: Math.round(1000 * quality) }); }
};
const result = await encodeToLimit(canvas, 'image/webp', 500);
assert.ok(result.blob.size <= 500 && result.blob.size >= 490);
assert.equal(await encodeToLimit(canvas, 'image/webp', 10), null);

const pngCanvas = { toBlob(callback, type) { callback({ type, size: 900 }); } };
assert.equal(await encodeToLimit(pngCanvas, 'image/png', 500), null);
assert.equal((await encodeToLimit(pngCanvas, 'image/png', 1000)).quality, null);
assert.equal((await encodeToLimit(pngCanvas, 'image/png', Infinity)).blob.size, 900);
