# MeshVault Creator Tools

The six generators live in `meshvault/generators/`; the integration guide lives in `meshvault/generator/`. This page links them from the MeshVault site.

The existing `publish-meshvault-site.yml` workflow copies the complete `meshvault/` tree to the MeshVault publishing repository after a push to main. Canonical URLs use `https://www.meshvault.app/`.

The original portfolio generator pages redirect to those URLs. Legacy guide/sample downloads remain available at their original paths.

Preview from the repository root with `python -m http.server 4173`, then open `http://127.0.0.1:4173/meshvault/creator-tools/`.

Run the migration link check with `python meshvault/creator-tools/test.py`. Generator export checks are documented in each generator directory.
