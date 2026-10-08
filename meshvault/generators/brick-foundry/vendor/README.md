# Third-party geometry libraries

Files are unmodified upstream distribution files. The independent application source
is available in the parent directory and may be rebuilt or used with replacement
versions of these separately loaded libraries.
[Application source](https://github.com/Xalies/xalies.github.io/tree/main/generators/brick-foundry).

- **Manifold 3.5.4**: `manifold.js`, `manifold.wasm`;
  Apache-2.0, [retained licence](manifold-LICENSE.txt).
  [Exact source commit](https://github.com/elalish/manifold/tree/ce50d78021d64507f89e8c9fc2c2e51018117857),
  [npm distribution](https://registry.npmjs.org/manifold-3d/-/manifold-3d-3.5.4.tgz).
- **occt-import-js 0.0.23**: `occt-import-js.js`, `occt-import-js.wasm`;
  LGPL-2.1, [retained licence](occt-import-LICENSE.txt).
  [Source, scripts and distribution archive](source/occt-import-js-0.0.23.tgz),
  [exact source commit](https://github.com/kovacsv/occt-import-js/tree/c2148e54b456b571238d35cac037d304053d64b2).
- The OCCT source submodule used by that release is
  `d2abb6d844231cb8f29be6894440874a4700e4a5`:
  [complete source archive](source/occt-d2abb6d.tar.gz),
  [LGPL-2.1 text](occt-LICENSE.txt), [OCCT exception](occt-EXCEPTION.txt).
  Upstream build scripts and CMake configuration are in the occt-import-js
  archive. No changes have been made to either compiled library.
- Three.js r122 and OrbitControls are reused from
  `../../gridfinity/vendor/deps/`; MIT notice `../../gridfinity/vendor/three-MIT.txt`.
- fflate and MeshVault packaging are reused from `../../shared/`;
  fflate MIT notice `../../shared/vendor/fflate-LICENSE.txt`.

Models stay on the user's device. No model data is sent to these upstream projects.
