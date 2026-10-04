"""Combine reviewed guides and brand purchase links into catalogue.json.

Run: python meshvault/filament-guides/build-catalogue.py
"""
import json
from pathlib import Path
from urllib.parse import urlsplit


def validate_url(url):
    if url is None:
        return
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username is not None or parsed.password is not None:
        raise ValueError("Purchase URLs must use HTTPS without credentials.")


def build(root):
    brands = {}
    for path in sorted((root / "brands").glob("*.json")):
        brand = json.loads(path.read_text(encoding="utf-8"))
        key = brand["brand"].casefold()
        if brand["schemaVersion"] != 1 or not key or key in brands:
            raise ValueError("Invalid or duplicate brand: " + str(path))
        validate_url(brand.get("purchaseUrl"))
        validate_url(brand.get("cartUrl"))
        for product in brand.get("products", []):
            validate_url(product.get("purchaseUrl"))
        brands[key] = brand

    guides = []
    for path in sorted((root / "guides").glob("*.json")):
        guide = json.loads(path.read_text(encoding="utf-8"))
        brand = brands.get(guide["brand"].casefold(), {})
        for field in ("purchaseUrl", "purchaseLabel", "cartUrl"):
            if field in brand and field not in guide:
                guide[field] = brand[field]
        validate_url(guide.get("purchaseUrl"))
        for pack in guide["packs"]:
            for model in pack["models"]:
                for colour in model["colours"]:
                    product_url = None
                    if "productCode" in colour:
                        matches = [p for p in brand.get("products", []) if p["code"] == colour["productCode"]]
                        if len(matches) != 1:
                            raise ValueError("Missing or ambiguous guide product: " + colour["productCode"])
                        product_url = matches[0].get("purchaseUrl")
                    url = colour.get("purchaseUrl", product_url)
                    validate_url(url)
                    if url is not None:
                        colour["purchaseUrl"] = url
        guides.append(guide)
    if not guides:
        raise ValueError("No reviewed guides found; preserve the existing feed.")
    return {"schemaVersion": 1, "guides": guides,
            "brands": [brand for brand in brands.values() if "products" in brand]}


if __name__ == "__main__":
    root = Path(__file__).resolve().parent
    feed = build(root)
    (root / "catalogue.json").write_text(json.dumps(feed, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Built catalogue.json with {len(feed['guides'])} guides.")
