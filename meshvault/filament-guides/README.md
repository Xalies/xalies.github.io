# MeshVault filament catalogue

The website/GitHub feed is the authoritative catalogue. MeshVault downloads a validated snapshot, caches it locally and matches in memory. Selecting a model does not scrape a shop. Valid snapshots replace the whole catalogue atomically; failed updates retain the last good copy. The app bundles a first-use offline snapshot. A separate app catalogue database is unnecessary at this size.

## Source data and reviewed identities

- `store-catalogues/*.json`: complete maintenance snapshots from official supplier sources. These store variants are not app matching candidates.
- `brands/*.json`: reviewed filament identities and their purchase options, using brand schema version 2.
- `guides/*.json`: separate reviewed PDF recommendations. PDF extraction and further matching work are outside this catalogue restructuring pass.
- `catalogue.json`: the generated public feed. Its version 1 envelope carries `guides` and `brands`; individual brand entries use schema version 2.

An identity contains a stable `code`, `range`, colour `name`, published `hexes`, optional verified slicer `profileId`, and optional reviewed range `aliases`. Spool size, packaging and refill choices belong in its `purchaseOptions`. Each option has its store `code`, `label`, `purchaseUrl`, optional `sku` and snapshot `available` flag. `preferredPurchaseCode` explicitly chooses the default option. Optional `affiliateUrl` overrides that option's outbound link; keep the supplier URL as its source reference. All links must be HTTPS without credentials.

Identity grouping uses the supplier's range, colour name and published palette. Different published palettes remain separate, including unknown palettes: incomplete evidence never gets guessed into a known colour. Supplier label/hex changes can create a new identity and need review before publication. Matching evaluates each identity once, regardless of the number of purchase options. Exact vendor/profile/colour evidence is required for 3MF matching; unverified identities remain available for explicit guide references and manual catalogue maintenance.

The initial preferred-option rule favours a complete spool, 1 kg, then availability. Review this choice before publishing. Subsequent rebuilds preserve reviewed preferred options, aliases, slicer IDs and affiliate overrides when the identity and option still exist. Availability is a snapshot, not a promise of current stock. Do not add credentials or infer physical filament colour from a photograph.

## Current catalogues (4 October 2026)

| Supplier | Filament identities | Purchase options | Ranges/listings |
| --- | ---: | ---: | ---: |
| Bambu Lab | 318 | 274 | 46 |
| Polymaker | 730 | 974 | 78 |
| Numakers | 151 | 156 | 16 |

Bambu colour/range evidence comes from its official Bambu Studio `filaments_color_codes.json`. Links reviewed against the AU store use the neutral `store.bambulab.com` domain with `id=` SKU selection. Retired or regionally absent colours retain their identity without purchase options. AU redirects were checked previously; other regions and native Chrome navigation remain separate runtime checks.

Polymaker source data includes every individual filament variant in its official US Shopify shop: Panchroma, Fiberon, engineering materials, support, TPU and legacy lines. Published `custom.hex_code` values provide single/multi-colour palettes. Unpublished values remain empty and slicer family IDs remain null. Different palettes and missing evidence are kept separate rather than merging uncertain older stock.

Numakers uses its official paginated Shopify product feed. Included products cover PLA+, Matte, CF, Metallic, Silk, dual/tri-colour Silk, Marble, Starlight, Glow, Wood, PETG-HS, Translucent PETG, PETG-CF, ABS, ASA and the older-formula clearance listing. Hardware, swatch sets, gift cards, subscriptions, bundle packs and Printopia landing pages are excluded. The source has no verified colour hexes or slicer family IDs, so those fields remain empty/null. Product and colour names, SKUs, availability and exact variant purchase links are retained. Adding this supplier does not invent 3MF matching evidence.

## Refresh and publish

Run the appropriate importer, then rebuild identities and the feed:

```sh
python meshvault/filament-guides/update-bambu.py
python meshvault/filament-guides/update-polymaker.py
python meshvault/filament-guides/update-numakers.py
python meshvault/filament-guides/build-identities.py
python meshvault/filament-guides/build-catalogue.py
python meshvault/filament-guides/test_build_catalogue.py
```

Importers write maintenance snapshots only after successful inspection. They use Python's standard library and official supplier sources, with delays between product requests. Review source changes, new identities, preferred options and URLs before committing and publishing. Commit maintenance snapshots, reviewed identities and generated feed together. Copy reviewed brands to MeshVault's `data/filament-guides/brands/` for the next bundled app snapshot. Future data updates require no app rebuild once this schema is supported.

Guide references use `filamentCode` and an optional `purchaseCode`, independently of PDF labels/hexes. The export resolves these into existing guide URLs. Missing or ambiguous references block export. Guide recommendations still take priority, but no new PDF interpretation or profile matching is introduced here. Polymaker retains its previously configured Shopify cart endpoint; cart construction still requires complete same-shop numeric variants and otherwise uses the collection fallback. Bambu and Numakers do not acquire unverified cart endpoints from this restructuring.

This filament feature has not been published. Brand schema version 1 drafts are intentionally unsupported by the revised app; no migration or backwards compatibility layer is provided. Runtime Store/Chrome verification remains separate from catalogue tests and builds.
