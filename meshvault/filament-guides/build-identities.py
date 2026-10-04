"""Build matching identities from store-catalogues/*.json (maintenance snapshots).

Review brands/*.json before publishing. Store variants become purchase options,
not competing colour matches. Different published palettes stay distinct.
"""
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import parse_qs, parse_qsl, urlencode, urlsplit, urlunsplit


def is_single_item(row):
    label = row.get("variant", row["name"])
    return not re.search(r"\b(?:MOQ|bundle|bulk|multipack)\b|\bget\s+\d+\s+for\b|"
                         r"\b(?:[2-9]\d*|1\d+)\s*[- ]?\s*(?:pack|rolls|spools|bottles)\b|"
                         r"\b(?:pack|rolls|spools|bottles)\s+of\s+(?:[2-9]\d*|1\d+)\b|"
                         r"(?:kg|g)\s*[x*×]\s*(?:[2-9]\d*|1\d+)\b", label, re.I)


def affiliate_url(url, rule):
    parsed = urlsplit(url)
    parameters = list(rule["parameters"].items())
    query = [(key, value) for key, value in parse_qsl(parsed.query, keep_blank_values=True) if key not in rule["parameters"]]
    query = parameters + query if rule.get("prepend") else query + parameters
    return urlunsplit(parsed._replace(query=urlencode(query)))


def build(snapshot, previous=None, affiliate=None):
    groups = {}
    for row in snapshot["products"]:
        key = (row["range"], row["name"], tuple(row["hexes"]))
        if key not in groups:
            code = "filament-" + hashlib.sha256(json.dumps(key, ensure_ascii=False).encode()).hexdigest()[:20]
            groups[key] = {"range": row["range"], "name": row["name"], "hexes": row["hexes"],
                           "profileId": row.get("profileId"), "code": code, "purchaseOptions": []}
            if row.get("kind") == "resin":
                groups[key]["kind"] = "resin"
            if row.get("hexSourceUrl"):
                groups[key]["hexSourceUrl"] = row["hexSourceUrl"]
        identity = groups[key]
        if row.get("kind", "filament") != identity.get("kind", "filament"):
            raise ValueError("Conflicting material kinds for " + str(key))
        if identity["profileId"] != row.get("profileId"):
            raise ValueError("Conflicting slicer family IDs for " + str(key))
        if row.get("purchaseUrl") and is_single_item(row):
            query = parse_qs(urlsplit(row["purchaseUrl"]).query)
            code = (query.get("variant") or query.get("id") or [row["code"]])[0]
            identity["purchaseOptions"].append({"code": code, "label": row.get("variant", row["name"]),
                "purchaseUrl": row["purchaseUrl"], "available": row.get("available"), "sku": row.get("sku")})
    for identity in groups.values():
        options = identity["purchaseOptions"]
        if options:
            preferred = min(options, key=lambda o: ("refill" in o["label"].lower(),
                "1kg" not in o["label"].replace(" ", "").lower(), o["available"] is False, o["code"]))
            identity["preferredPurchaseCode"] = preferred["code"]
    brand = {k: v for k, v in snapshot.items() if k != "products"}
    brand.update(schemaVersion=2, products=list(groups.values()))
    reviewed = {p["code"]: p for p in (previous or {}).get("products", [])}
    for identity in brand["products"]:
        old = reviewed.get(identity["code"], {})
        if "aliases" in old:
            identity["aliases"] = old["aliases"]
        if identity["profileId"] is None and old.get("profileId"):
            identity["profileId"] = old["profileId"]
        options = {o["code"]: o for o in old.get("purchaseOptions", [])}
        if old.get("preferredPurchaseCode") in {o["code"] for o in identity["purchaseOptions"]}:
            identity["preferredPurchaseCode"] = old["preferredPurchaseCode"]
        for option in identity["purchaseOptions"]:
            if options.get(option["code"], {}).get("affiliateUrl"):
                option["affiliateUrl"] = options[option["code"]]["affiliateUrl"]
            if affiliate:
                option["affiliateUrl"] = affiliate_url(option["purchaseUrl"], affiliate)
    if affiliate and brand.get("purchaseUrl"):
        brand["purchaseUrl"] = affiliate_url(brand["purchaseUrl"], affiliate)
    if affiliate and brand.get("cartUrl"):
        brand["cartUrl"] = affiliate_url(brand["cartUrl"], affiliate)
    return brand


if __name__ == "__main__":
    root = Path(__file__).resolve().parent
    affiliates = json.loads((root / "affiliate-links.json").read_text(encoding="utf-8"))
    for path in sorted((root / "store-catalogues").glob("*.json")):
        target = root / "brands" / path.name
        previous = json.loads(target.read_text(encoding="utf-8")) if target.exists() else None
        snapshot = json.loads(path.read_text(encoding="utf-8"))
        brand = build(snapshot, previous, affiliates.get(snapshot["brand"]))
        target.write_text(json.dumps(brand, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(path.name, len(brand["products"]), "identities")
