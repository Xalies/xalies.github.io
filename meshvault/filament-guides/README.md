# MeshVault filament guide catalogue

`catalogue.json` is the generated public feed of reviewed creator colour-guide recommendations. MeshVault fetches it from this repository's `main` branch through `raw.githubusercontent.com`, validates it and retains the last valid copy for offline use. Apps normally check again after 24 hours. Updating this JSON requires no app rebuild.

The version 1 envelope contains `schemaVersion: 1`, a `guides` array and an optional `brands` product array. Each guide identifies its source PDF by SHA-256, creator, brand and release, then lists pack sections, model names/aliases and colour-name/hex pairs. Model matching is scoped to the linked PDF and pack. Preserve `recommended`, `optional` and `alternative` groups. Explicit aliases cover archive names and inner folder names that differ from the PDF headings.

Keep this feed authoritative for deployed applications. Review each palette against its source PDF and validate with `FilamentGuideCatalogueService.ParseFeed` before committing changes. Invalid updates are ignored by clients. An empty `guides` array deliberately clears the active catalogue; removal does not fall back to bundled recommendations after a successful download.

The initial feed was exported from MeshVault's reviewed `data/filament-guides` JSON using `scripts/export-filament-guide-feed.py`. Those source files support repeatable PDF extraction and first-use fallback. Do not export stale source files over subsequent reviewed changes to this public feed.

Each guide can supply optional `purchaseUrl` and `purchaseLabel` fields. `purchaseUrl` must be an absolute HTTPS URL without embedded credentials. The initial Nostalgic 3D entry uses Polymaker's official PLA collection and the label `Polymaker PLA`; replace the URL with your approved affiliate link when available. Windows checks the feed on the first palette load each app session, so published changes can be picked up after restarting the app. Links are shown for matched guide recommendations or exact manufacturer metadata matches in a 3MF.

Publish JSON data only. Do not add source PDFs, affiliate credentials or guessed product URLs. The source PDF may describe recommendations differing from the slicer profiles; guide list order never assigns 3MF filament slots.

## Editing guides and filament brands

- `guides/*.json`: creator palettes, pack/model names and aliases.
- `brands/polymaker.json`: the full Polymaker filament product catalogue.
- Add another file under `brands/` for each new brand. Its `brand` must match the guide brand; guide colours reference exact product codes within that brand.

Each brand file has `schemaVersion: 1`, `brand`, optional `purchaseUrl` and `purchaseLabel`, and a `products` array. Each product has `range`, `profileId`, `code`, `name`, `hexes` and an optional `purchaseUrl`. Keep unverified slicer IDs null and unpublished colour palettes empty. A guide colour uses `productCode` to select a single product within its brand. This reference is independent of the PDF label and hex, so historical recommendations remain accurate. An explicit guide/colour URL overrides the product URL. Missing or ambiguous product references block export. Guide swatches without a product link can fall back to their collection link; unmatched embedded colours remain unlinked.

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

## Nostalgic 3D Welcome Pack

`guides/nostalgic-3d-welcome-pack.json` contains all 45 palettes from pages 2–9 of **01 Welcome Pack Color Recommendations.pdf**, verified against the rendered pages. Its source SHA-256 is `067db165f987d4db4799a64fa554814a5060eb8fa25f012fc2d0933d449bc9f9`. All eight sections have aliases for the imported pack/model filenames, including spelling differences. The Young Pokémon 3MF previews were visually compared with the Back-to-School page before adding that pack alias.

| Imported pack | Guide palettes |
| --- | ---: |
| Power Rangers x Pokemon | 6 |
| TMNT x Pokemon | 6 |
| Young Pokemon (Back-to-School) | 4 |
| Kirby SuperSmash Flexi | 5 |
| World of Warcraft Flexi | 6 |
| Halloween Flexi | 6 |
| Christmas Flexi | 7 |
| Thanksgiving Flexi | 5 |

**Mario Themed Clickers**, **Pooh Hunny Jar Magnet Set** and **Kirby Sonic** have no palette in this PDF and retain 3MF fallback. Extracted parts inherit the enclosing design's guide palette through the existing Core rule; Candy Cane is inside Elf and has no separate PDF palette.

Product links were verified on 4 October 2026 against Polymaker's Basic, Matte and Silk PLA product data. Preserve the PDF's `Aque Blue` and `Forrest Green` spelling, mapping them explicitly to Aqua Blue and Matte Forest Green. `Dark Olive` maps to Dark Olive Drab; Wood Brown maps to Matte Wood Brown. Silk Gold and Silver point to the available new-formula spools; their current colour codes differ from the old-formula codes printed in the PDF. Keep the original guide hex values as recommendations, rather than changing them to match the shop. The combined brand map now contains 41 colour-name keys (Aqua/Aque share one variant).

## Bambu embedded filament catalogue

`brands/bambu.json` contains all 318 colour entries across 46 ranges in Bambu Studio's official `filaments_color_codes.json`, including legacy ranges. The feed carries these as manufacturer products, separate from PDF recommendations. Each product stores its range, family profile ID, supplier colour code, name, RGB/RGBA palette and optional purchase URL. Reviewed creator guides still take priority.

A 3MF fallback links only when vendor, profile family ID, named range and exact colour agree with one product. Preserve unknown/custom colours without a purchase link. Multi-colour products need the complete stored palette. Transparency metadata does not cause colour guessing; duplicate RGB matches remain unlinked.

274 colour entries have current AU-store SKU links. The remaining 44 retain their official colour data without an invented link. This includes retired ranges and colours absent from the AU storefront. Links use `https://store.bambulab.com/products/<handle>?id=<sku>` so Bambu can redirect to the visitor's region. On 4 October 2026, neutral links retained the selected SKU in AU page responses for PLA Basic Orange, PETG HF Orange and TPU 90A Black; the user confirmed PETG Basic. Other regional stores and Chrome clicks need separate verification. Bambu's current storefront is not treated as Shopify: its Buy filament link opens the filament collection, and individual swatches select their SKU.

To refresh manually, run `python meshvault/filament-guides/update-bambu.py`, review the generated brand file, then rebuild and test the feed with the commands above. The script uses only Python's standard library and Bambu's official GitHub colour file and public storefront product data. It waits between requests and stops on failed inspection, preserving the prior catalogue. Verify new links before publishing; availability and regional redirect behaviour can change. Copy the reviewed Bambu file to MeshVault's `data/filament-guides/brands/` for its next bundled offline snapshot. Older apps ignore the product array; embedded product matching requires the updated MeshVault app.

## Full Polymaker catalogue

`brands/polymaker.json` uses the same product schema as Bambu and includes all 78 individual filament product ranges and 974 purchasable variants listed by the official US shop on 4 October 2026. This includes Panchroma, Fiberon, legacy ranges, support materials, engineering polymers and TPU, plus all listed weights, diameters, spools and refills. Accessories and multi-product bundle packs are excluded from the filament colour catalogue. Out-of-stock variants remain listed with their availability flag.

Products come from the paginated official `/products.json` feed. Hex values come from each product page's published `custom.hex_code` variant metadata. Comma-separated supplier multi-colour values are preserved as complete hex arrays. Missing or non-hex swatch values remain an empty palette, rather than an invented colour. Shopify variant IDs supply each product's stable `code`; the manufacturer's SKU is retained separately as `sku`. No verified slicer-family IDs are supplied by this source, so `profileId` remains null and these records do not enable embedded Polymaker matching by themselves.

The former pack-only `colourPurchaseUrls` map has been removed. Both Nostalgic 3D guides now reference the exact prior product variants through `productCode`, preserving all 41 reviewed colour links and their cart behaviour even where different ranges share a colour name. Guides keep their original PDF colour names and swatches.

Refresh with `python meshvault/filament-guides/update-polymaker.py`, review the output, then rebuild/test the feed. The standard-library importer waits between product requests and writes the catalogue only after all pages have been inspected successfully. Updating storefront data can change availability; native Store/Chrome navigation remains a separate runtime check. Updated clients accept null profile IDs and empty hex palettes without discarding otherwise valid catalogue data.
