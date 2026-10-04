# MeshVault filament catalogue

The website/GitHub feed is the authoritative catalogue. MeshVault downloads a validated snapshot, caches it locally and matches in memory. Selecting a model does not scrape a shop. Valid snapshots replace the whole catalogue atomically; failed updates retain the last good copy. The app bundles a first-use offline snapshot. A separate app catalogue database is unnecessary at this size.

## Source data and reviewed identities

- `store-catalogues/*.json`: complete maintenance snapshots from official supplier sources. These store variants are not app matching candidates.
- `brands/*.json`: reviewed filament identities and their purchase options, using brand schema version 2.
- `guides/*.json`: separate reviewed PDF recommendations. PDF extraction and further matching work are outside this catalogue restructuring pass.
- `catalogue.json`: the generated public feed. Its version 1 envelope carries `guides` and `brands`; individual brand entries use schema version 2.
- `affiliate-links.json`: supplier affiliate query parameters. Rebuilds apply these to every eligible purchase option and collection fallback, retaining exact variant IDs and original option source URLs. Configured supplier rules take precedence over option-level affiliate overrides; brands without a rule retain reviewed overrides. Numakers places `ref=meshvault` before `variant`; other parameters append to existing queries. Merchant attribution is not verified by catalogue tests.

An identity describes one filament or printing-resin material/colour. Optional `kind` is `resin`; omission means `filament`. Resin identities cannot match embedded filament profiles. An identity contains a stable `code`, `range`, colour `name`, published `hexes`, optional verified slicer `profileId`, and optional reviewed range `aliases`. Individual spool sizes, single refills and resin bottle sizes belong in its `purchaseOptions`. Multipacks, bulk/minimum-order offers and mixed bundles are excluded. Identities available only in those offers may remain without a purchase link; maintenance snapshots retain the underlying supplier evidence. Each option has its store `code`, `label`, `purchaseUrl`, optional `sku` and snapshot `available` flag. `preferredPurchaseCode` explicitly chooses the default option. Optional `affiliateUrl` overrides that option's outbound link; keep the supplier URL as its source reference. All links must be HTTPS without credentials.

Identity grouping uses the supplier's range, colour name and published palette. Different published palettes remain separate, including unknown palettes: incomplete evidence never gets guessed into a known colour. Supplier label/hex changes can create a new identity and need review before publication. Matching evaluates each identity once, regardless of the number of purchase options. Exact vendor/profile/colour evidence is required for embedded filament matching; resin matching is separate work; unverified identities remain available for explicit guide references and manual catalogue maintenance.

The initial preferred-option rule favours a complete spool, 1 kg, then availability. Review this choice before publishing. Subsequent rebuilds preserve reviewed preferred options, aliases, slicer IDs and affiliate overrides when the identity and option still exist. Availability is a snapshot, not a promise of current stock. Do not add credentials or infer physical filament colour from a photograph.

## Current catalogues (4 October 2026)

| Supplier | Filament identities | Purchase options | Ranges/listings |
| --- | ---: | ---: | ---: |
| Bambu Lab | 318 | 274 | 46 |
| Polymaker | 730 | 974 | 78 |
| Numakers | 151 | 156 | 16 |
| Overture | 404 | 440 | 26 |
| SUNLU | 599 | 2051 | 72 |

Bambu colour/range evidence comes from its official Bambu Studio `filaments_color_codes.json`. Links reviewed against the AU store use the neutral `store.bambulab.com` domain with `id=` SKU selection. Retired or regionally absent colours retain their identity without purchase options. AU redirects were checked previously; other regions and native Chrome navigation remain separate runtime checks.

Polymaker source data includes every individual filament variant in its official US Shopify shop: Panchroma, Fiberon, engineering materials, support, TPU and legacy lines. Published `custom.hex_code` values provide single/multi-colour palettes. Unpublished values remain empty and slicer family IDs remain null. Different palettes and missing evidence are kept separate rather than merging uncertain older stock.

Numakers uses its official paginated Shopify product feed. Included products cover PLA+, Matte, CF, Metallic, Silk, dual/tri-colour Silk, Marble, Starlight, Glow, Wood, PETG-HS, Translucent PETG, PETG-CF, ABS, ASA and the older-formula clearance listing. Hardware, swatch sets, gift cards, subscriptions, bundle packs and Printopia landing pages are excluded. The importer also reads the published `product_colors` swatch configuration from each product page. Exact case-insensitive colour names with a single unambiguous six-digit hex are retained with `hexSourceUrl`; conflicting names, missing values and image/multicolour swatches stay unknown. This supplies website display colours for 129 of 151 identities, not measured physical colours or verified slicer family IDs; profile IDs remain null. Product and colour names, SKUs, availability and exact variant purchase links are retained. Adding this supplier does not invent 3MF matching evidence.

Overture uses the official paginated all-filaments collection feed. Named colour variants include larger individual spools and single refills as purchase options. Multipacks are excluded. Bundles without explicit colour choices are excluded. Published material titles keep regular and High Speed PLA, dual-colour and gradient finishes distinct; differently named ranges are not assumed equivalent. The source provides no verified filament hexes or slicer IDs, so these stay empty/null. Exact variant links, SKUs and availability are retained. No unverified cart endpoint is configured.

SUNLU uses its official paginated store product feed, including regional and clearance listings. Reviewed supplier labels and listing ranges live in `sunlu-ranges.json`, outside the app. Individual filaments include regular, high-speed, aesthetic and engineering ranges; printing resins include Standard, Standard Plus, ABS-Like, Water-Wash, Nylon-Like, High Clear, High Toughness, High Temperature, Red Wax and 14K variants. Classic Formula resin remains distinct from current formulas. There are 498 filament and 101 resin identities. Shipping region, weight and refill wording stay in eligible purchase option labels. Exact URLs and SKUs are retained. Bulk/minimum-order offers, multipacks, mixed-spool bundles, hardware, mystery packs and resin mixing kits are excluded from purchase options. Named dual/tri/four-colour strands remain valid individual filaments. Entries with no published colour label use `Unspecified colour`; unknown synonyms stay separate for later review. No unverified filament hexes, slicer IDs or cart endpoint are assumed. Regional selection and stock still need checking on the store page.

## Refresh and publish

`guides/nostalgic-3d-2026-10.json` covers the October Final Fantasy VII Pure/Monthly Mashup, LowPoly, Flexi and Clicker packs. It preserves the five-page PDF's Numakers material names, exact product references, pack-specific aliases and shared white/black requirements. The PDF supplies no RGB values, so source `hex` remains null. Feed export fills missing hexes only from an exact reviewed identity with one published six-digit supplier swatch; `hexSourceUrl` records supplier provenance. This gives 216 of 218 October recommendations clickable swatches with name/hex tooltips; the two Dark Gray recommendations remain named links because the website configuration conflicts. Explicit PDF hexes always retain priority. Pure models on page 3 retain their own source page. `Apricot (Skin)` is explicitly reviewed against Numakers `Apricot` in PLA+; PLA Silk Gold/Silver stay separate from PLA+ Simply Silver. The repeated Tonberry Simply Silver recommendation is deduplicated. Named-colour extraction is reproducible with MeshVault's `scripts/extract-filament-guide.py` and the guide's data-driven extraction rules; review/reapply product references before publishing a new draft.

Run the appropriate importer, then rebuild identities and the feed:

```sh
python meshvault/filament-guides/update-bambu.py
python meshvault/filament-guides/update-polymaker.py
python meshvault/filament-guides/update-numakers.py
python meshvault/filament-guides/update-overture.py
python meshvault/filament-guides/update-sunlu.py
python meshvault/filament-guides/build-identities.py
python meshvault/filament-guides/build-catalogue.py
python meshvault/filament-guides/test_build_catalogue.py
```

Importers write maintenance snapshots only after successful inspection. They use Python's standard library and official supplier sources, with delays between product requests. Review source changes, new identities, preferred options and URLs before committing and publishing. Commit maintenance snapshots, reviewed identities and generated feed together. Copy reviewed brands to MeshVault's `data/filament-guides/brands/` for the next bundled app snapshot. Future data updates require no app rebuild once this schema is supported.

Guide references use `filamentCode` and an optional `purchaseCode`, independently of PDF labels/hexes. The export resolves these into existing guide URLs. Missing or ambiguous references block export. A supplier palette change creates a new identity code: review and update guide references by exact material/name and purchase option IDs before publishing; never resolve stale references by colour similarity. Guide recommendations still take priority, but no new PDF interpretation or profile matching is introduced here. Polymaker retains its previously configured Shopify cart endpoint; cart construction still requires complete same-shop numeric variants and otherwise uses the collection fallback. Numakers uses its verified Shopify cart permalink endpoint with `ref=meshvault`. Buy filament adds one spool per distinct recommended variant for the selected model; individual swatches retain their colour-specific affiliate product links. Optional and alternative recommendations are excluded from automatic carts. Bambu retains its collection fallback.

This filament feature has not been published. Brand schema version 1 drafts are intentionally unsupported by the revised app; no migration or backwards compatibility layer is provided. Runtime Store/Chrome verification remains separate from catalogue tests and builds.
