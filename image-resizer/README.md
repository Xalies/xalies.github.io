# Image Resizer

A static page for resizing PNG, JPEG, and WebP images in the browser. Nothing is uploaded.

- **Scale** fits an image inside the requested width and height.
- **Fill** crops the centre to the exact width and height.
- The file size field is a maximum. The page adjusts WebP or JPEG quality to stay under it, or reports when the limit cannot be reached at the selected dimensions.

Open `/image-resizer/` on the site, or serve this directory with any static web server for local use. The JavaScript module needs an HTTP server; opening the HTML file directly may block it.

Run the small logic check with `node test.mjs` from this directory.

MIT licensed; see [LICENSE](./LICENSE).
