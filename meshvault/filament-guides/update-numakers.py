"""Import Numakers individual filament variants from its official Shopify feed.

Import exact named website swatch hexes; slicer IDs remain unverified.
Subscription/bundle packs, swatch sets, hardware and landing pages are excluded.
Run build-identities.py afterwards, review, then rebuild the public feed.
"""
import json
import re
import time
from pathlib import Path
from urllib.request import Request, urlopen

STORE = "https://numakers.com"


def parse_swatches(html):
    match = re.search(r'product_colors:\s*("(?:\\.|[^"\\])*")', html)
    if not match:
        raise ValueError("Numakers website swatch configuration missing; preserve the previous snapshot.")
    values = {}
    for line in json.loads(match[1]).splitlines():
        name, separator, value = line.partition(":")
        value = value.strip().rstrip(",").strip()
        if separator and re.fullmatch(r"#[0-9a-fA-F]{6}", value):
            values.setdefault(name.strip().casefold(), set()).add(value.upper())
    # Conflicting or image-only colours stay unknown; never sample photographs.
    return {name: next(iter(hexes)) for name, hexes in values.items() if len(hexes) == 1}


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
            source = STORE + "/products/" + product["handle"]
            with urlopen(Request(source, headers={"User-Agent": "Mozilla/5.0"}), timeout=30) as response:
                swatches = parse_swatches(response.read().decode("utf-8"))
            time.sleep(1)
            for variant in product["variants"]:
                code = str(variant["id"])
                name = variant["option" + str(index)] if index else product["title"]
                hex_value = swatches.get(name.strip().casefold())
                row = {"range": product["title"], "name": name,
                    "profileId": None, "hexes": [hex_value] if hex_value else [], "code": code, "sku": variant["sku"],
                    "variant": variant["title"], "available": variant["available"],
                    "purchaseUrl": source + "?variant=" + code}
                if hex_value:
                    row["hexSourceUrl"] = source
                rows.append(row)
        if len(products) < 250:
            break
        page += 1
        time.sleep(2)
    if not rows:
        raise ValueError("No Numakers filament variants found; preserve the previous snapshot.")
    return {"schemaVersion": 1, "brand": "Numakers", "sourceUrl": STORE + "/products.json",
            "cartUrl": STORE + "/cart",
            "purchaseUrl": STORE + "/collections/all", "purchaseLabel": "Numakers", "products": rows}


if __name__ == "__main__":
    snapshot = build()
    target = Path(__file__).resolve().parent / "store-catalogues" / "numakers.json"
    target.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(len(snapshot["products"]), "variants;", len({p["range"] for p in snapshot["products"]}), "ranges")
