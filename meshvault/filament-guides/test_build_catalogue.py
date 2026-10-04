import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parent

def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / (name + ".py"))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value

builder = module("build-catalogue")
identities = module("build-identities")

class CatalogueTests(unittest.TestCase):
    def test_october_guide_uses_exact_numakers_references_without_invented_hexes(self):
        guide = next(g for g in builder.build(ROOT)["guides"] if g["release"] == "October 2026")
        self.assertEqual(guide["documentHash"], "039e91f1f60751199b5728388907b5e1e7a13f2a1357591d19eaffafc4eb3deb")
        self.assertEqual([len(p["models"]) for p in guide["packs"]], [10, 8, 8, 8])
        for pack in guide["packs"]:
            for model in pack["models"]:
                for colour in model["colours"]:
                    self.assertIsNone(colour["hex"])
                    self.assertTrue(colour["purchaseUrl"].startswith("https://numakers.com/products/"))
                    self.assertIn("?ref=meshvault&variant=" + colour["purchaseCode"], colour["purchaseUrl"])
        self.assertEqual([c["name"] for c in guide["packs"][3]["models"][3]["colours"]], ["Simply Silver", "Teal Blue"])

    def test_affiliate_rules_preserve_variant_selection_and_survive_refresh(self):
        rules = json.loads((ROOT / "affiliate-links.json").read_text(encoding="utf-8"))
        source = "https://numakers.com/products/abs-filament?variant=46944297451828"
        self.assertEqual(identities.affiliate_url(source, rules["Numakers"]),
                         "https://numakers.com/products/abs-filament?ref=meshvault&variant=46944297451828")
        for brand in builder.build(ROOT)["brands"]:
            rule = rules.get(brand["brand"])
            if not rule: continue
            snapshot = json.loads((ROOT / "store-catalogues" / (brand["brand"].lower() + ".json")).read_text(encoding="utf-8"))
            self.assertEqual(identities.build(snapshot, brand, rule), brand)
            for product in brand["products"]:
                for option in product["purchaseOptions"]:
                    self.assertEqual(option["affiliateUrl"], identities.affiliate_url(option["purchaseUrl"], rule))
                    self.assertEqual(parse_qs(urlsplit(option["affiliateUrl"]).query)["variant"], [option["code"]])
                    self.assertEqual(identities.affiliate_url(option["affiliateUrl"], rule), option["affiliateUrl"])
        self.assertEqual(identities.affiliate_url("https://store.sunlu.com/products/resin", rules["SUNLU"]),
                         "https://store.sunlu.com/products/resin?sca_ref=12477616.r65NSOHEnL")

    def test_variants_become_options_and_reviewed_preferences_survive_refresh(self):
        rows = [{"range": "PLA", "name": "White", "hexes": ["#FFFFFF"], "code": str(i), "profileId": None,
                 "variant": label, "purchaseUrl": "https://shop.example.test/products/pla?variant=" + str(i)}
                for i, label in [(1, "Spool / 1kg"), (2, "Refill / 1kg"), (3, "Spool / 3kg")]]
        snapshot = {"schemaVersion": 1, "brand": "Example", "products": rows}
        brand = identities.build(snapshot)
        self.assertEqual(len(brand["products"]), 1)
        product = brand["products"][0]
        self.assertEqual(len(product["purchaseOptions"]), 3)
        self.assertEqual(product["preferredPurchaseCode"], "1")
        product["preferredPurchaseCode"] = "2"
        product["profileId"] = "verified-id"
        product["aliases"] = ["Old PLA Name"]
        product["purchaseOptions"][1]["affiliateUrl"] = "https://affiliate.example.test/white"
        refreshed = identities.build(snapshot, brand)["products"][0]
        self.assertEqual(refreshed["preferredPurchaseCode"], "2")
        self.assertEqual(refreshed["profileId"], "verified-id")
        self.assertEqual(refreshed["aliases"], ["Old PLA Name"])
        self.assertIn("affiliateUrl", refreshed["purchaseOptions"][1])
        snapshot["products"][1]["hexes"] = ["#FFFFFE"]
        self.assertEqual(len(identities.build(snapshot)["products"]), 2)

    def test_brand_and_identity_scope_and_explicit_purchase_choice(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "brands").mkdir()
            (root / "guides").mkdir()
            for brand in ("Polymaker", "Numakers"):
                products = [{"code": code, "purchaseOptions": [{"code": "spool-" + code, "label": "Spool",
                    "purchaseUrl": "https://example.test/" + brand + "/" + code}], "preferredPurchaseCode": "spool-" + code}
                    for code in ("pla-white", "petg-white")]
                (root / "brands" / (brand + ".json")).write_text(json.dumps({"schemaVersion": 2, "brand": brand, "products": products}))
                (root / "guides" / (brand + ".json")).write_text(json.dumps({"brand": brand, "packs": [{"models": [{"colours": [
                    {"name": "White", "filamentCode": "pla-white", "purchaseCode": "spool-pla-white"}]}]}]}))
            for guide in builder.build(root)["guides"]:
                self.assertEqual(guide["packs"][0]["models"][0]["colours"][0]["purchaseUrl"],
                                 "https://example.test/" + guide["brand"] + "/pla-white")

    def test_missing_references_and_unsafe_options_block_export(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "brands").mkdir()
            (root / "guides").mkdir()
            (root / "guides" / "guide.json").write_text(json.dumps({"brand": "Example", "packs": [{"models": [{"colours": [
                {"name": "White", "filamentCode": "missing"}]}]}]}))
            (root / "brands" / "brand.json").write_text(json.dumps({"schemaVersion": 2, "brand": "Example", "products": []}))
            with self.assertRaises(ValueError): builder.build(root)
        for url in ("http://example.test", "javascript:alert(1)", "https://user:secret@example.test"):
            with self.assertRaises(ValueError): builder.validate_url(url)

    def test_complete_catalogues_keep_all_source_purchase_options(self):
        feed = builder.build(ROOT)
        snapshots = {value["brand"]: value for path in (ROOT / "store-catalogues").glob("*.json")
                     for value in [json.loads(path.read_text(encoding="utf-8"))]}
        expected = {"Bambu Lab": (318, 274, 46), "Polymaker": (730, 974, 78), "Numakers": (151, 156, 16),
                    "Overture": (404, 440, 26), "SUNLU": (599, 2051, 72)}
        for brand in feed["brands"]:
            products = brand["products"]
            self.assertEqual(brand["schemaVersion"], 2)
            self.assertEqual((len(products), sum(len(p["purchaseOptions"]) for p in products), len({p["range"] for p in products})), expected[brand["brand"]])
            self.assertEqual(len({p["code"] for p in products}), len(products))
            self.assertEqual(sorted(o["purchaseUrl"] for p in products for o in p["purchaseOptions"]),
                             sorted(p["purchaseUrl"] for p in snapshots[brand["brand"]]["products"]
                                    if p.get("purchaseUrl") and identities.is_single_item(p)))
            for product in products:
                for option in product["purchaseOptions"]: builder.validate_url(option["purchaseUrl"])

    def test_numakers_has_named_colours_and_no_invented_metadata(self):
        brand = json.loads((ROOT / "brands/numakers.json").read_text(encoding="utf-8"))
        self.assertTrue(any(p["range"] == "PLA+ Filament" and p["name"] == "Pitch Black" for p in brand["products"]))
        for product in brand["products"]:
            self.assertIsNone(product["profileId"])
            self.assertEqual(product["hexes"], [])
        self.assertFalse(any("Build Plate" in p["range"] or "Gift Card" in p["range"] for p in brand["products"]))

    def test_published_multi_colour_values_are_preserved_without_guessing(self):
        importer = module("update-polymaker")
        self.assertEqual(importer.parse_hexes("#F4EFEB, #2F2E30"), ["#F4EFEB", "#2F2E30"])
        self.assertEqual(importer.parse_hexes(None), [])
        self.assertEqual(importer.parse_hexes("#F4EFEB, rainbow"), [])

    def test_overture_keeps_packaging_as_options_and_finishes_distinct(self):
        importer = module("update-overture")
        products = [{"title": title, "handle": "item-" + str(i), "product_type": "3D Printer Filament > PLA > PLA",
                     "options": [{"name": "Size"}, {"name": "Color"}], "variants": [{"id": i, "sku": str(i),
                     "option1": "1.75mm", "option2": "Blue-Red", "title": "1.75mm / Blue-Red / 1 kg", "available": True}]}
                    for i, title in enumerate(["Overture Matte PLA Dual Colors 3D Printer Filament 1.75mm",
                        "Overture Matte PLA Gradient Filament 1.75mm", "Overture PLA 3D Printer Filament 1.75mm",
                        "Overture PLA Refill 3D Printer Filament 1.75mm", "Overture PLA 3D Printer Filament 1.75mm - 2 Pack",
                        "Overture High Speed PLA 3D Printer Filament 1.75mm"], 1)]
        products.append({"options": [{"name": "Title"}], "product_type": "3D Printer Filament > PLA > PLA"})
        products.append({"options": [{"name": "Color"}], "product_type": "Build Plate"})
        rows = importer.rows_from_products(products)
        self.assertEqual(len(rows), 6)
        brand = identities.build({"brand": "Overture", "products": rows})
        self.assertEqual(len(brand["products"]), 4)
        pla = next(p for p in brand["products"] if p["range"] == "PLA")
        self.assertEqual(len(pla["purchaseOptions"]), 2)
        self.assertEqual(pla["preferredPurchaseCode"], "3")
        self.assertEqual({p["range"] for p in brand["products"]},
                         {"PLA", "High Speed PLA", "Matte PLA Dual Colors", "Matte PLA Gradient"})
        self.assertTrue(all(p["hexes"] == [] and p["profileId"] is None for p in brand["products"]))

    def test_sunlu_preserves_regions_and_distinguishes_strands_from_mixed_spools(self):
        importer = module("update-sunlu")
        rules = json.loads((ROOT / "sunlu-ranges.json").read_text(encoding="utf-8"))
        product = {"handle": "combined-listing", "title": "Regional filament choices",
                   "options": [{"name": "Shipment"}, {"name": "Material"}, {"name": "Color"}],
                   "variants": [{"id": i, "sku": str(i), "available": True, "option1": region,
                       "option2": material, "option3": colour, "title": region + " / " + material + " / " + colour}
                       for i, (region, material, colour) in enumerate([
                           ("USA", "PLA+", "PLA+ Black 1KG"), ("Australia", "PLA+ Refill", "Black 1KG"),
                           ("USA", "PA6-CF", "PA6-CF | Black 0.5KG"), ("USA", "PA6-CF", "PA6-CF | Black 1KG"),
                           ("USA", "PLA", "Black+White+Red"), ("USA", "PLA", "Black*2+White*1"),
                           ("USA", "Dual-Color SILK", "Dual-Color | Black+Purple"),
                           ("USA", "Standard Resin", "Grey 1KG"), ("USA", "E2 FilaDryer", "Black")], 1)]}
        rows = importer.rows_from_products([product], rules)
        self.assertEqual(len(rows), 6)
        brand = identities.build({"brand": "SUNLU", "products": rows})
        self.assertEqual(len(brand["products"]), 4)
        pla = next(p for p in brand["products"] if p["range"] == "PLA+")
        self.assertEqual(pla["name"], "Black")
        self.assertEqual(len(pla["purchaseOptions"]), 2)
        self.assertTrue(any("Australia" in o["label"] for o in pla["purchaseOptions"]))
        self.assertEqual(len(next(p for p in brand["products"] if p["range"] == "PA6-CF")["purchaseOptions"]), 2)
        self.assertEqual(next(p for p in brand["products"] if p["range"] == "Dual-Color SILK")["name"], "Black+Purple")
        choices = {"handle": "unknown-listing", "title": "Special choices", "options": [{"name": "Material"}],
                   "variants": [{"id": i, "sku": str(i), "available": True, "option1": label, "title": label}
                                for i, label in enumerate(("Twinkle Blue", "Unknown product"), 1)]}
        self.assertEqual(len(importer.rows_from_products([choices], rules)), 1)
        bundled = json.loads((ROOT / "brands/sunlu.json").read_text(encoding="utf-8"))
        self.assertTrue(any(p["range"] == "PLA-CF" and p["name"] == "Unspecified colour" for p in bundled["products"]))
        self.assertTrue(all(p["profileId"] is None and p["hexes"] == [] for p in bundled["products"]))
        self.assertEqual(sum(p.get("kind") == "resin" for p in bundled["products"]), 101)
        self.assertFalse(any("dryer" in p["range"].lower() for p in bundled["products"]))
        self.assertTrue(all("+" not in p["name"] or p["range"] in
                            ("Dual-Color SILK", "Tri-Color SILK", "Four-Color SILK", "Matte PLA Dual-Color") for p in bundled["products"]))

    def test_purchase_options_are_single_spools_refills_or_bottles(self):
        for label in ("2 Pack / Black", "10 Pack / White", "Pack of 12", "1kg*6", "500g × 8",
                      "[MOQ: 6KG] PLA Black", "Get 3 for the Price of 2", "Bundle White*3"):
            self.assertFalse(identities.is_single_item({"name": "Black", "variant": label}), label)
        for label in ("Spool / 3kg", "Refill / 1 kg", "Bottle / 4000g", "Black / New Packaging / 1kg", "Dual-Color | Black+Purple"):
            self.assertTrue(identities.is_single_item({"name": "Black", "variant": label}), label)
        self.assertEqual(module("update-sunlu").clean("Grey1000G | Not included in Discounts"), "Grey")
        resin = identities.build({"brand": "Example", "products": [{"range": "Standard Resin", "name": "Grey",
            "kind": "resin", "hexes": [], "code": "1"}]})["products"][0]
        self.assertEqual(resin["kind"], "resin")

if __name__ == "__main__": unittest.main()
