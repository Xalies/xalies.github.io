# MeshVault filament guide catalogue

`catalogue.json` is the public, editable feed of reviewed creator colour-guide recommendations. MeshVault fetches it from this repository's `main` branch through `raw.githubusercontent.com`, validates it and retains the last valid copy for offline use. Apps normally check again after 24 hours. Updating this JSON requires no app rebuild.

The version 1 envelope contains `schemaVersion: 1` and a `guides` array. Each guide identifies its source PDF by SHA-256, creator, brand and release, then lists pack sections, model names/aliases and colour-name/hex pairs. Model matching is scoped to the linked PDF and pack. Preserve `recommended`, `optional` and `alternative` groups. Explicit aliases cover archive names and inner folder names that differ from the PDF headings.

Keep this feed authoritative for deployed applications. Review each palette against its source PDF and validate with `FilamentGuideCatalogueService.ParseFeed` before committing changes. Invalid updates are ignored by clients. An empty `guides` array deliberately clears the active catalogue; removal does not fall back to bundled recommendations after a successful download.

The initial feed was exported from MeshVault's reviewed `data/filament-guides` JSON using `scripts/export-filament-guide-feed.py`. Those source files support repeatable PDF extraction and first-use fallback. Do not export stale source files over subsequent reviewed changes to this public feed.

Each guide can supply optional `purchaseUrl` and `purchaseLabel` fields. `purchaseUrl` must be an absolute HTTPS URL without embedded credentials. The initial Nostalgic 3D entry uses Polymaker's official PLA collection and the label `Polymaker PLA`; replace the URL with your approved affiliate link when available. Windows checks the feed on the first palette load each app session, so published changes can be picked up after restarting the app. Links are shown only for matched guide recommendations, never guessed from 3MF colours.

Publish JSON data only. Do not add source PDFs, affiliate credentials or guessed product URLs. The source PDF may describe recommendations differing from the slicer profiles; guide list order never assigns 3MF filament slots.
