import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent

def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / (name + ".py"))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value

builder = module("build-catalogue")
identities = module("build-identities")

class CatalogueTests(unittest.TestCase):
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
        expected = {"Bambu Lab": (318, 274, 46), "Polymaker": (730, 974, 78), "Numakers": (151, 156, 16)}
        for brand in feed["brands"]:
            products = brand["products"]
            self.assertEqual(brand["schemaVersion"], 2)
            self.assertEqual((len(products), sum(len(p["purchaseOptions"]) for p in products), len({p["range"] for p in products})), expected[brand["brand"]])
            self.assertEqual(len({p["code"] for p in products}), len(products))
            self.assertEqual(sorted(o["purchaseUrl"] for p in products for o in p["purchaseOptions"]),
                             sorted(p["purchaseUrl"] for p in snapshots[brand["brand"]]["products"] if p.get("purchaseUrl")))
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

if __name__ == "__main__": unittest.main()
