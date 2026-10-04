"""Refresh Bambu colours and AU product variants from official public sources.

Run this manually, review bambu.json and rebuild catalogue.json before publishing.
Unavailable/retired colours stay in the catalogue without a purchase URL.
"""
import json
import re
import time
from pathlib import Path
from urllib.request import Request, urlopen

COLOURS = "https://raw.githubusercontent.com/bambulab/BambuStudio/master/resources/profiles/BBL/filament/filaments_color_codes.json"
STORE = "https://au.store.bambulab.com"


def read(url):
    with urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30) as response:
        return response.read().decode("utf-8-sig")


def product_variants(html):
    # The store publishes its product data as Next.js server-rendered JSON.
    chunks = [json.loads(s) for s in re.findall(r'self\.__next_f\.push\(\[1,(".*?")\]\)', html, re.S)]
    nodes = {}
    for line in "".join(chunks).splitlines():
        key, _, value = line.partition(":")
        try:
            nodes[key] = json.loads(value)
        except ValueError:
            pass

    def resolve(value):
        if isinstance(value, str) and value.startswith("$"):
            return nodes.get(value[1:])
        return value

    products = [n for n in nodes.values() if isinstance(n, dict) and n.get("isFilament") and "productSkuList" in n]
    for product in products:
        for item in resolve(product["productSkuList"]) or []:
            sku = resolve(item)
            if not isinstance(sku, dict):
                continue
            props = [resolve(p) for p in resolve(sku.get("productSkuPropertyList")) or []]
            values = {p["propertyKey"]: p["propertyValue"] for p in props if isinstance(p, dict)}
            code = re.search(r"\((\d{5})\)", values.get("Color", ""))
            if code:
                yield code[1], str(sku["id"]), values, sku.get("isSoldOut", False)


def build():
    colours = json.loads(read(COLOURS))["data"]
    sitemap = read(STORE + "/sitemap_products_1.xml")
    urls = set(re.findall(r"<loc>([^<]+)</loc>", sitemap))
    # Fetch individual filament products, excluding equipment and bundles.
    handles = {"abs-filament", "pc-filament", "asa-filament", "tpu-85a-tpu-90a", "support-for-pla-new", "support-for-pa-pet", "support-for-pla-petg", "pla-silk-upgrade", "pla-tough-upgrade", "pla-silk-multi-color", "pla-basic-gradient"}
    for row in colours:
        handles.add(row["fila_type"].lower().replace(" ", "-").replace("+", ""))
    handles.add("pla-basic-filament")
    variants = {}
    for url in sorted(urls):
        if url.rsplit("/", 1)[-1] not in handles:
            continue
        try:
            time.sleep(4)  # Respect the storefront's rate limit during manual refreshes.
            found = list(product_variants(read(url)))
            if not found:
                raise ValueError("No filament variants found; review the storefront data format.")
        except (OSError, ValueError) as error:
            raise RuntimeError("Could not inspect " + url) from error
        print(url.rsplit("/", 1)[-1], len(found))
        for code, variant, props, sold_out in found:
            # Prefer a complete spool, then an available variant. Never select bundles.
            rank = ("spool" not in props.get("Type", "").lower(), sold_out, variant)
            if code not in variants or rank < variants[code][0]:
                variants[code] = (rank, url.replace(STORE, "https://store.bambulab.com") + "?id=" + variant)
    products = []
    for row in colours:
        product = {"range": row["fila_type"], "profileId": row["fila_id"], "code": row["fila_color_code"],
                   "name": row["fila_color_name"]["en"], "hexes": [h.upper() for h in row["fila_color"]]}
        if row["fila_color_code"] in variants:
            product["purchaseUrl"] = variants[row["fila_color_code"]][1]
        products.append(product)
    return {"schemaVersion": 1, "brand": "Bambu Lab", "profilePrefix": "Bambu ", "sourceUrl": COLOURS,
            "purchaseUrl": "https://store.bambulab.com/collections/bambu-lab-3d-printer-filament",
            "store": STORE, "products": products}


if __name__ == "__main__":
    catalogue = build()
    target = Path(__file__).resolve().parent / "brands" / "bambu.json"
    target.write_text(json.dumps(catalogue, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(len(catalogue["products"]), "colours;", sum("purchaseUrl" in p for p in catalogue["products"]), "linked")
