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
                    "colourPurchaseUrls": {"White": f"https://example.test/{brand}/white"}
                }), encoding="utf-8")
                (root / "guides" / f"{brand}.json").write_text(json.dumps({
                    "brand": brand, "packs": [{"models": [{"colours": [
                        {"name": "White"}, {"name": "Black"}
                    ]}]}]
                }), encoding="utf-8")
            for guide in builder.build(root)["guides"]:
                self.assertEqual(guide["purchaseUrl"], f"https://example.test/{guide['brand']}")
                colours = guide["packs"][0]["models"][0]["colours"]
                self.assertEqual(colours[0]["purchaseUrl"], f"https://example.test/{guide['brand']}/white")
                self.assertNotIn("purchaseUrl", colours[1])

    def test_rejects_unsafe_links(self):
        for url in ("http://example.test", "javascript:alert(1)", "https://user:secret@example.test"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                builder.validate_url(url)


if __name__ == "__main__":
    unittest.main()
