"""Combine reviewed guides and brand purchase links into catalogue.json.

Run: python meshvault/filament-guides/build-catalogue.py
"""
import json
import copy
import re
from pathlib import Path
from urllib.parse import urlsplit


def validate_url(url):
    if url is None:
        return
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username is not None or parsed.password is not None:
        raise ValueError("Purchase URLs must use HTTPS without credentials.")


def validate_affiliate_links(entry):
    for standard, affiliate in (("purchaseUrl", "affiliateUrl"), ("cartUrl", "affiliateCartUrl")):
        validate_url(entry.get(standard))
        validate_url(entry.get(affiliate))
        if entry.get(affiliate) and not entry.get(standard):
            raise ValueError("Affiliate links require a standard destination.")


def build(root):
    brands = {}
    for path in sorted((root / "brands").glob("*.json")):
        brand = json.loads(path.read_text(encoding="utf-8"))
        key = brand["brand"].casefold()
        if brand["schemaVersion"] != 2 or not key or key in brands:
            raise ValueError("Invalid or duplicate brand: " + str(path))
        validate_affiliate_links(brand)
        identities = [p["code"] for p in brand.get("products", [])]
        if len(set(identities)) != len(identities):
            raise ValueError("Duplicate filament identity")
        codes = []
        for product in brand.get("products", []):
            if product.get("kind", "filament") not in ("filament", "resin"):
                raise ValueError("Invalid material kind")
            options = product.get("purchaseOptions", [])
            preferred = product.get("preferredPurchaseCode")
            if (options and sum(o["code"] == preferred for o in options) != 1) or (not options and preferred is not None):
                raise ValueError("Missing or ambiguous preferred purchase option")
            for option in product.get("purchaseOptions", []):
                validate_url(option.get("purchaseUrl"))
                validate_url(option.get("affiliateUrl"))
                if not option.get("purchaseUrl"):
                    raise ValueError("Missing purchase URL")
                codes.append(option["code"])
        if len(set(codes)) != len(codes):
            raise ValueError("Duplicate purchase option")
        brands[key] = brand

    guides = []
    for path in sorted((root / "guides").glob("*.json")):
        guide = json.loads(path.read_text(encoding="utf-8"))
        brand = brands.get(guide["brand"].casefold(), {})
        for field in ("purchaseUrl", "purchaseLabel", "cartUrl", "affiliateUrl", "affiliateCartUrl"):
            if field in brand and field not in guide:
                guide[field] = brand[field]
        validate_affiliate_links(guide)
        for pack in guide["packs"]:
            for model in pack["models"]:
                for colour in model["colours"]:
                    product_url = None
                    affiliate_url = None
                    if "filamentCode" in colour:
                        matches = [p for p in brand.get("products", []) if p["code"] == colour["filamentCode"]]
                        if len(matches) != 1:
                            raise ValueError("Missing or ambiguous guide filament: " + colour["filamentCode"])
                        identity = matches[0]
                        # Guide RGB takes priority. Only an exact reviewed identity
                        # with one published swatch can fill a missing guide hex.
                        if (colour.get("hex") is None and len(identity.get("hexes", [])) == 1
                                and re.fullmatch(r"#[0-9a-fA-F]{6}", identity["hexes"][0])):
                            colour["hex"] = identity["hexes"][0]
                            if identity.get("hexSourceUrl"):
                                colour["hexSourceUrl"] = identity["hexSourceUrl"]
                        code = colour.get("purchaseCode", identity.get("preferredPurchaseCode"))
                        options = [o for o in identity["purchaseOptions"] if o["code"] == code]
                        if len(options) != 1:
                            raise ValueError("Missing or ambiguous guide purchase option: " + str(code))
                        product_url = options[0]["purchaseUrl"]
                        affiliate_url = options[0].get("affiliateUrl")
                    if "purchaseUrl" not in colour and affiliate_url is not None:
                        colour.setdefault("affiliateUrl", affiliate_url)
                    validate_url(colour.get("affiliateUrl"))
                    url = colour.get("purchaseUrl", product_url)
                    validate_url(url)
                    if url is not None:
                        colour["purchaseUrl"] = url
                    validate_affiliate_links(colour)
        guides.append(guide)
    if not guides:
        raise ValueError("No reviewed guides found; preserve the existing feed.")
    return {"schemaVersion": 1, "guides": guides,
            "brands": [brand for brand in brands.values() if "products" in brand]}


def legacy_feed(feed):
    """Keep older clients' default affiliate destinations on the original feed."""
    result = copy.deepcopy(feed)
    for entry in result["guides"] + result["brands"]:
        for standard, affiliate in (("purchaseUrl", "affiliateUrl"), ("cartUrl", "affiliateCartUrl")):
            if affiliate in entry:
                entry[standard] = entry.pop(affiliate)
    for guide in result["guides"]:
        for pack in guide["packs"]:
            for model in pack["models"]:
                for colour in model["colours"]:
                    if "affiliateUrl" in colour:
                        colour["purchaseUrl"] = colour.pop("affiliateUrl")
    return result


if __name__ == "__main__":
    root = Path(__file__).resolve().parent
    feed = build(root)
    (root / "catalogue.json").write_text(json.dumps(legacy_feed(feed), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (root / "catalogue-v2.json").write_text(json.dumps(feed, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Built catalogue.json with {len(feed['guides'])} guides.")
