"""Refresh the entire Polymaker US-shop filament catalogue from official data.

Run build-identities.py, review brands/polymaker.json, then rebuild/test the public feed.
Each purchasable variant is retained, including sizes, refills and legacy lines.
"""
import json
import re
import time
from pathlib import Path
from urllib.request import Request, urlopen

STORE = "https://shop.polymaker.com"


def read(url):
    with urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30) as response:
        return response.read().decode("utf-8")


def swatch_hexes(html):
    marker = re.search(r'"formatted"\s*:\s*\{', html)
    if not marker:
        raise ValueError("Missing variant metafields; review storefront format.")
    variants, _ = json.JSONDecoder().raw_decode(html[marker.end() - 1:])
    return {key: item.get("metafields", {}).get("custom", {}).get("hex_code") for key, item in variants.items()}


def parse_hexes(value):
    if not isinstance(value, str):
        return []
    colours = [part.strip().upper() for part in value.split(",")]
    return colours if all(re.fullmatch(r"#[0-9A-F]{6}(?:[0-9A-F]{2})?", colour) for colour in colours) else []


def build():
    products = []
    page = 1
    while True:
        batch = json.loads(read(f"{STORE}/products.json?limit=250&page={page}"))["products"]
        products.extend(batch)
        if len(batch) < 250:
            break
        page += 1
        time.sleep(2)
    filaments = [p for p in products if "Filament" in p["product_type"] or p["product_type"] == "Polymaker"]
    if not filaments:
        raise ValueError("No filament products found; preserve the existing catalogue.")
    rows = []
    for product in filaments:
        time.sleep(2)
        url = STORE + "/products/" + product["handle"]
        hexes = swatch_hexes(read(url))
        colour_index = next((i + 1 for i, option in enumerate(product["options"])
                             if option["name"].casefold() in ("color", "colour")), None)
        for variant in product["variants"]:
            code = str(variant["id"])
            raw = hexes.get(code)
            palette = parse_hexes(raw)
            rows.append({"range": product["title"].replace("™", "").replace("®", ""),
                         "profileId": None, "code": code, "sku": variant["sku"],
                         "name": variant.get("option" + str(colour_index)) if colour_index else variant["title"],
                         "hexes": palette, "variant": variant["title"], "available": variant["available"],
                         "purchaseUrl": url + "?variant=" + code})
        print(product["handle"], len(product["variants"]), flush=True)
    return {"schemaVersion": 1, "brand": "Polymaker", "sourceUrl": STORE + "/products.json",
            "purchaseUrl": STORE + "/collections/polymaker-3d-printer-filament", "purchaseLabel": "Polymaker",
            "cartUrl": STORE + "/cart", "products": rows}


if __name__ == "__main__":
    catalogue = build()
    target = Path(__file__).resolve().parent / "store-catalogues" / "polymaker.json"
    target.write_text(json.dumps(catalogue, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(len(catalogue["products"]), "variants;", len({p["range"] for p in catalogue["products"]}), "ranges")
