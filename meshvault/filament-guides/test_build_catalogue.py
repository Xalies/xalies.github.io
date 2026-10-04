import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("builder", Path(__file__).with_name("build-catalogue.py"))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class CatalogueTests(unittest.TestCase):
    def test_brands_are_scoped_and_colour_links_override_collection_links(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "brands").mkdir()
            (root / "guides").mkdir()
            for brand in ("Polymaker", "Bambu"):
                (root / "brands" / f"{brand}.json").write_text(json.dumps({
                    "schemaVersion": 1, "brand": brand,
                    "purchaseUrl": f"https://example.test/{brand}",
                    "cartUrl": f"https://example.test/{brand}/cart",
                    "colourPurchaseUrls": {"White": f"https://example.test/{brand}/white"}
                }), encoding="utf-8")
                (root / "guides" / f"{brand}.json").write_text(json.dumps({
                    "brand": brand, "packs": [{"models": [{"colours": [
                        {"name": "White"}, {"name": "Black"}
                    ]}]}]
                }), encoding="utf-8")
            for guide in builder.build(root)["guides"]:
                self.assertEqual(guide["purchaseUrl"], f"https://example.test/{guide['brand']}")
                self.assertEqual(guide["cartUrl"], f"https://example.test/{guide['brand']}/cart")
                colours = guide["packs"][0]["models"][0]["colours"]
                self.assertEqual(colours[0]["purchaseUrl"], f"https://example.test/{guide['brand']}/white")
                self.assertNotIn("purchaseUrl", colours[1])

    def test_rejects_unsafe_links(self):
        for url in ("http://example.test", "javascript:alert(1)", "https://user:secret@example.test"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                builder.validate_url(url)

    def test_bambu_products_are_exported_separately_from_creator_guides(self):
        feed = builder.build(Path(__file__).resolve().parent)
        brand = next(b for b in feed["brands"] if b["brand"] == "Bambu Lab")
        self.assertEqual(len(brand["products"]), 318)
        self.assertEqual(len({p["range"] for p in brand["products"]}), 46)
        self.assertEqual(sum("purchaseUrl" in p for p in brand["products"]), 274)
        for product in brand["products"]:
            if "purchaseUrl" in product:
                self.assertRegex(product["purchaseUrl"], r"^https://store\.bambulab\.com/products/[^?]+\?id=\d+$")

    def test_reviewed_polymaker_colours_have_individual_variant_links(self):
        root = Path(__file__).resolve().parent
        colours = [colour for guide in builder.build(root)["guides"] if guide["brand"] == "Polymaker"
                   for pack in guide["packs"] for model in pack["models"] for colour in model["colours"]]
        self.assertEqual(len({colour["name"] for colour in colours}), 41)
        for colour in colours:
            with self.subTest(colour=colour["name"]):
                self.assertRegex(colour.get("purchaseUrl", ""),
                                 r"^https://shop\.polymaker\.com/products/[^?]+\?variant=\d+$")
                if colour["name"] == "Orange":
                    self.assertEqual(colour["purchaseUrl"],
                                     "https://shop.polymaker.com/products/panchroma-pla?variant=44863271665721")


if __name__ == "__main__":
    unittest.main()
