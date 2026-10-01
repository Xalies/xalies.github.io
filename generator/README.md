# MeshVault Vase Lab

A dependency-free browser example showing how a model generator can export a
MeshVault package. It creates a closed hollow STL from a revolved profile,
supports procedural and hand-painted surface relief, and stores the model,
metadata and rendered PNG thumbnail in a ZIP-backed
`.mvpack` file.

Serve this folder over HTTP to test it locally. The generated package uses the
`application/vnd.meshvault.package+zip` MIME type and contains:

- `Generated/Vases/<title>.stl`
- `meshvault.model.mvdata` (`MVMD1` header followed by gzip-compressed JSON)

Run `node test.mjs` for the geometry and package checks.
