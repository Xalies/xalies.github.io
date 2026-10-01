import assert from "node:assert/strict";
import { asciiStl, buildStoredZip, buildVaseMesh, crc32, normaliseRelativePath, PRESETS } from "./generator.mjs";

const mesh = buildVaseMesh(PRESETS.classic, 32, 1.6, 2.4);
assert.equal(mesh.triangles.length, 896);
assert.match(asciiStl(mesh), /^solid meshvault_vase\n/);
const textured = buildVaseMesh(PRESETS.classic, 32, 1.6, 2.4, (u, v) => Math.sin(u * Math.PI * 2) * v * 2);
assert.ok(textured.triangles.length > mesh.triangles.length);
assert.ok(textured.maxRadius > mesh.maxRadius);
assert.equal(normaliseRelativePath("../Generated\\Vases//"), "Generated/Vases");
assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);

const zip = buildStoredZip([
  { name: "Generated/Vases/test.stl", data: "solid test\nendsolid test" },
  { name: "meshvault.model.mvdata", data: new Uint8Array([77, 86, 77, 68, 49, 10]) }
]);
assert.deepEqual(Array.from(zip.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04]);
assert.ok(new TextDecoder().decode(zip).includes("Generated/Vases/test.stl"));
assert.ok(new TextDecoder().decode(zip).includes("meshvault.model.mvdata"));

console.log("Vase generator checks passed.");
