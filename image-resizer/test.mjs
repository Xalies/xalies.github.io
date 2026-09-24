import assert from 'node:assert/strict';
import { geometry, encodeToLimit } from './resizer.mjs';

assert.deepEqual(geometry(1600, 900, 800, 800, 'scale'), {
  sx: 0, sy: 0, sw: 1600, sh: 900, width: 800, height: 450
});
assert.deepEqual(geometry(1600, 900, 800, 800, 'fill'), {
  sx: 350, sy: 0, sw: 900, sh: 900, width: 800, height: 800
});
assert.throws(() => geometry(1600, 900, 0, 800, 'scale'));

const canvas = {
  toBlob(callback, type, quality) { callback({ type, size: Math.round(1000 * quality) }); }
};
const result = await encodeToLimit(canvas, 'image/webp', 500);
assert.ok(result.blob.size <= 500 && result.blob.size >= 490);
assert.equal(await encodeToLimit(canvas, 'image/webp', 10), null);
