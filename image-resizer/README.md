# Image Resizer

A static page for resizing PNG, JPEG, and WebP images in the browser. Nothing is uploaded.

- **Scale** fits an image inside the requested width and height.
- **Fill** crops the centre to the exact width and height.
- Export as WebP, JPEG, or PNG. An optional size limit adjusts WebP or JPEG quality; lossless PNG must fit at the selected dimensions when a limit is set.

Open `/image-resizer/` on the site, or open `index.html` directly for local use.

Run the small logic check with `node test.mjs` from this directory.

MIT licensed; see [LICENSE](./LICENSE).
