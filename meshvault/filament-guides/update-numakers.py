"""Import Numakers individual filament variants from its official Shopify feed.

Store metadata has no verified slicer IDs or colour hexes; leave them unset.
Subscription/bundle packs, swatch sets, hardware and landing pages are excluded.
Run build-identities.py afterwards, review, then rebuild the public feed.
"""
import json
import time
from pathlib import Path
from urllib.request import Request, urlopen

STORE = "https://numakers.com"


def build():
    rows = []
    page = 1
    while True:
        with urlopen(Request(f"{STORE}/products.json?limit=250&page={page}", headers={"User-Agent": "Mozilla/5.0"}), timeout=30) as response:
            products = json.load(response)["products"]
        for product in products:
            index = next((i + 1 for i, option in enumerate(product["options"]) if option["name"].casefold() == "color"), None)
            if index is None and product["handle"] != "pla-wood":
                continue
            for variant in product["variants"]:
                code = str(variant["id"])
                rows.append({"range": product["title"], "name": variant["option" + str(index)] if index else product["title"],
                    "profileId": None, "hexes": [], "code": code, "sku": variant["sku"],
                    "variant": variant["title"], "available": variant["available"],
                    "purchaseUrl": STORE + "/products/" + product["handle"] + "?variant=" + code})
        if len(products) < 250:
            break
        page += 1
        time.sleep(2)
    if not rows:
        raise ValueError("No Numakers filament variants found; preserve the previous snapshot.")
    return {"schemaVersion": 1, "brand": "Numakers", "sourceUrl": STORE + "/products.json",
            "purchaseUrl": STORE + "/collections/all", "purchaseLabel": "Numakers", "products": rows}


if __name__ == "__main__":
    snapshot = build()
    target = Path(__file__).resolve().parent / "store-catalogues" / "numakers.json"
    target.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(len(snapshot["products"]), "variants;", len({p["range"] for p in snapshot["products"]}), "ranges")
