# MeshVault filament guide catalogue

`catalogue.json` is the generated public feed of reviewed creator colour-guide recommendations. MeshVault fetches it from this repository's `main` branch through `raw.githubusercontent.com`, validates it and retains the last valid copy for offline use. Apps normally check again after 24 hours. Updating this JSON requires no app rebuild.

The version 1 envelope contains `schemaVersion: 1` and a `guides` array. Each guide identifies its source PDF by SHA-256, creator, brand and release, then lists pack sections, model names/aliases and colour-name/hex pairs. Model matching is scoped to the linked PDF and pack. Preserve `recommended`, `optional` and `alternative` groups. Explicit aliases cover archive names and inner folder names that differ from the PDF headings.

Keep this feed authoritative for deployed applications. Review each palette against its source PDF and validate with `FilamentGuideCatalogueService.ParseFeed` before committing changes. Invalid updates are ignored by clients. An empty `guides` array deliberately clears the active catalogue; removal does not fall back to bundled recommendations after a successful download.

The initial feed was exported from MeshVault's reviewed `data/filament-guides` JSON using `scripts/export-filament-guide-feed.py`. Those source files support repeatable PDF extraction and first-use fallback. Do not export stale source files over subsequent reviewed changes to this public feed.

Each guide can supply optional `purchaseUrl` and `purchaseLabel` fields. `purchaseUrl` must be an absolute HTTPS URL without embedded credentials. The initial Nostalgic 3D entry uses Polymaker's official PLA collection and the label `Polymaker PLA`; replace the URL with your approved affiliate link when available. Windows checks the feed on the first palette load each app session, so published changes can be picked up after restarting the app. Links are shown only for matched guide recommendations, never guessed from 3MF colours.

Publish JSON data only. Do not add source PDFs, affiliate credentials or guessed product URLs. The source PDF may describe recommendations differing from the slicer profiles; guide list order never assigns 3MF filament slots.

## Editing guides and filament brands

- `guides/*.json`: creator palettes, pack/model names and aliases.
- `brands/polymaker.json`: Polymaker collection URL and individual colour links.
- Add another file under `brands/` for each new brand. Its `brand` must match the guide brand; colour link names must match the guide colour names (comparison ignores case).

Each brand file has `schemaVersion: 1`, `brand`, optional `purchaseUrl` and `purchaseLabel`, and a `colourPurchaseUrls` object. Add a colour name and its verified product or affiliate URL to that object when available. An explicit guide/colour URL overrides the brand default. Swatches open the colour-specific link, falling back to the brand collection link. Unmatched 3MF colours have no purchase links.

After editing, run from the website repository root:

```sh
python meshvault/filament-guides/build-catalogue.py
python meshvault/filament-guides/test_build_catalogue.py
```

Commit the editable source files and generated `catalogue.json` together, then publish. Keep the generated feed in place for deployed apps; do not edit it directly or overwrite these reviewed sources with an older MeshVault export. Brand names and purchase URLs remain data, with no brand-specific app code.

## Verified Polymaker links

On 3 October 2026, all 24 colours in the Nostalgic 3D August guide were matched to current Polymaker product variants using the official `/products/panchroma-pla.js`, `/products/matte-pla.js` and `/products/metallic-pla.js` data. Links select 1 kg spools: 15 Basic PLA colours, six specifically named Matte PLA colours and three Metallic PLA colours. Orange selects Basic PLA variant `44863271665721`. Matte variants select the new packaging. These are direct product URLs; replace them with verified affiliate links when available. Variant availability can change independently of this catalogue.

## Buy filament carts

A brand can supply `cartUrl` for a verified Shopify cart endpoint, such as `https://shop.polymaker.com/cart`. The app keeps the **Buy filament** label and constructs a cart containing one spool per unique recommended product variant. Optional and alternative colours remain individual swatch links. Cart construction requires every recommended colour to supply a numeric `variant` in its product URL on the same shop; otherwise the existing collection link is used. Brands without a configured cart endpoint also retain their normal purchase link.
