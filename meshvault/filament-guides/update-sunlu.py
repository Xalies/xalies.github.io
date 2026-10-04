"""Import Sunlu individual filament/resin identities using reviewed label rules.

Warehouse, weight and offer labels remain in the maintenance snapshot.
Export excludes bulk offers; mixed-colour packs and hardware are not identities.
"""
import json
import re
import time
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
STORE = "https://store.sunlu.com"


def clean(value):
    value = re.sub(r"\s*\|\s*Not included in Discounts$", "", value, flags=re.I)
    value = re.sub(r"\([^)]*(?:spool|/kg|roll)[^)]*\)", "", value, flags=re.I)
    value = re.sub(r"(?<!\d)\d+(?:\.\d+)?\s*(?:kg|g)\b(?:\s*[/x*]\s*(?:roll|\d+))?", "", value, flags=re.I)
    value = re.sub(r"\b(?:spool|refill)\b", "", value, flags=re.I)
    value = re.sub(r"\*\d+$", "", value)
    return value.strip(" /|*")


def rows_from_products(products, rules):
    aliases = rules["materials"]
    rows = []
    for product in products:
        for variant in product["variants"]:
            default = rules["products"].get(product["handle"])
            fields = {o["name"].strip().casefold(): variant.get("option" + str(i + 1), "")
                      for i, o in enumerate(product["options"])}
            material = next((fields[k] for k in ("material", "material type", "resin type", "style", "product type", "type") if k in fields), "")
            colour = next((fields[k] for k in ("color", "material/color", "color/type", "size/color", "muti-color silk", "types") if k in fields), "")
            if not colour and "type" in fields and "|" in fields["type"]:
                colour = fields["type"]
                material = ""
            if not colour and "material" in fields and re.search(r"[|/]", material):
                colour, material = material, ""
            if not colour and (default or clean(material).casefold() in aliases):
                colour = "Unspecified colour"
            choice = rules.get("choices", {}).get(colour or material)
            if choice:
                default, colour, material = choice["range"], choice["name"], ""
            # Reject whole packs rather than interpreting several spools as a
            # dual/tri-colour filament. Strand colour '+' labels remain intact.
            if not colour or re.search(r"CMYK|\*\d+.*\+|\+.*\*\d+", colour, re.I):
                continue
            parts = re.split(r"\s*[|/]\s*", colour, maxsplit=1)
            if len(parts) == 2 and clean(parts[0]).casefold() in aliases:
                material, colour = parts
            elif len(parts) == 2 and re.fullmatch(r"\d+kg\s+spool", parts[0], re.I):
                colour = parts[1]
            range_name = aliases.get(clean(material).casefold(), default)
            if not range_name:
                prefix = next((k for k in sorted(aliases, key=len, reverse=True)
                               if colour.casefold().startswith(k + " ")), None)
                if prefix:
                    range_name = aliases[prefix]
            # Combined warehouse/clearance listings require explicit material
            # evidence. Unknown choices must not become guessed identities.
            if not range_name:
                continue
            colour = clean(colour)
            prefixes = sorted([k for k, v in aliases.items() if v == range_name], key=len, reverse=True)
            for prefix in prefixes:
                if colour.casefold().startswith(prefix + " "):
                    colour = colour[len(prefix):].strip(" /|")
                    break
            if "+" in colour and range_name not in ("Dual-Color SILK", "Tri-Color SILK", "Four-Color SILK", "Matte PLA Dual-Color"):
                continue
            if not colour or re.search(r"resin|curing box|epoxy|dryer|connector|storage|build plate|\*\d+.*\+", colour, re.I):
                continue
            range_name = rules.get("rangePrefixes", {}).get(product["handle"], "") + range_name
            code = str(variant["id"])
            rows.append({"range": range_name, "name": colour, "profileId": None, "hexes": [],
                "code": code, "sku": variant["sku"], "variant": product["title"] + " / " + variant["title"],
                "available": variant["available"], "purchaseUrl": STORE + "/products/" + product["handle"] + "?variant=" + code})
            if range_name.endswith(" Resin"):
                rows[-1]["kind"] = "resin"
    return rows


def build():
    rules = json.loads((ROOT / "sunlu-ranges.json").read_text(encoding="utf-8"))
    rows = []
    page = 1
    while True:
        with urlopen(Request(f"{STORE}/products.json?limit=250&page={page}", headers={"User-Agent": "Mozilla/5.0"}), timeout=30) as response:
            products = json.load(response)["products"]
        rows.extend(rows_from_products(products, rules))
        if len(products) < 250:
            break
        page += 1
        time.sleep(2)
    if not rows:
        raise ValueError("No Sunlu material variants found; preserve the previous snapshot.")
    return {"schemaVersion": 1, "brand": "SUNLU", "sourceUrl": STORE + "/products.json",
            "purchaseUrl": STORE + "/collections/", "purchaseLabel": "SUNLU", "products": rows}


if __name__ == "__main__":
    snapshot = build()
    target = ROOT / "store-catalogues" / "sunlu.json"
    target.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(len(snapshot["products"]), "variants;", len({p["range"] for p in snapshot["products"]}), "ranges")
