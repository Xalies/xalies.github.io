"""Import named filament variants from Overture's official all-filaments feed.

Keep packaging in option labels; exclude bundles without an explicit colour.
No verified hexes or slicer IDs are supplied. Rebuild/review identities afterwards.
"""
import json
import re
import time
from pathlib import Path
from urllib.request import Request, urlopen

STORE = "https://overture3d.com"
SOURCE = STORE + "/collections/all/products.json"


def rows_from_products(products):
    rows = []
    for product in products:
        index = next((i + 1 for i, option in enumerate(product["options"])
                      if option["name"].casefold() in ("color", "colour")), None)
        if index is None or not product["product_type"].startswith("3D Printer Filament >"):
            continue
        # Use the published material title, removing packaging only. In particular,
        # PLA and High Speed PLA, and solid/dual/gradient finishes remain distinct.
        material = re.sub(r"^Overture\s+", "", product["title"])
        material = re.sub(r"\s*(?:3D Printer |3D Printing )?Filament\s*1\.75mm.*$", "", material)
        material = re.sub(r"\s+Refill\b", "", material).strip()
        for variant in product["variants"]:
            code = str(variant["id"])
            rows.append({"range": material, "name": variant["option" + str(index)],
                "profileId": None, "hexes": [], "code": code, "sku": variant["sku"],
                "variant": product["title"] + " / " + variant["title"], "available": variant["available"],
                "purchaseUrl": STORE + "/products/" + product["handle"] + "?variant=" + code})
    return rows


def build():
    rows = []
    page = 1
    while True:
        with urlopen(Request(f"{SOURCE}?limit=250&page={page}", headers={"User-Agent": "Mozilla/5.0"}), timeout=30) as response:
            products = json.load(response)["products"]
        rows.extend(rows_from_products(products))
        if len(products) < 250:
            break
        page += 1
        time.sleep(2)
    if not rows:
        raise ValueError("No Overture filament variants found; preserve the previous snapshot.")
    return {"schemaVersion": 1, "brand": "Overture", "sourceUrl": SOURCE,
            "purchaseUrl": STORE + "/collections/all", "purchaseLabel": "Overture", "products": rows}


if __name__ == "__main__":
    snapshot = build()
    target = Path(__file__).resolve().parent / "store-catalogues" / "overture.json"
    target.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(len(snapshot["products"]), "variants;", len({p["range"] for p in snapshot["products"]}), "ranges")
