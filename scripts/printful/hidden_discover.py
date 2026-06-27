#!/usr/bin/env python3
"""
The Hidden — Printful discovery (Stage 1).
Validates the token, finds heavyweight tee blanks, and prints
Black/White S-2XL variant IDs + Printful base cost.

Run on the Mac (Printful API is reachable there):
    export PRINTFUL_TOKEN='...'
    python3 hidden_discover.py
"""
import os, sys, json, urllib.request, urllib.error

TOKEN = os.environ.get("PRINTFUL_TOKEN")
if not TOKEN:
    sys.exit("ERROR: set PRINTFUL_TOKEN env var first:  export PRINTFUL_TOKEN='...'")

BASE = "https://api.printful.com"
HDRS = {"Authorization": f"Bearer {TOKEN}", "User-Agent": "clear-cut/1.0"}

# Candidate heavyweight / premium blanks to look for (substring match on catalog title)
CANDIDATES = [
    "comfort colors 1717",
    "comfort colors",
    "heavyweight",
    "heavy",
    "lane seven",
    "as colour",
    "bella + canvas 3001",
    "unisex staple",
]
SIZES = {"S", "M", "L", "XL", "2XL", "XXL"}
COLORS = {"black", "white"}


def get(path):
    req = urllib.request.Request(BASE + path, headers=HDRS)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        print(f"  ! HTTP {e.code} on {path}: {e.read().decode()[:200]}")
        return None


def main():
    print("=== 1. Validating token / store ===")
    stores = get("/stores")
    if not stores:
        sys.exit("Token rejected. Re-check the token + scopes in developers.printful.com.")
    for s in stores.get("result", []):
        print(f"  store_id={s.get('id')}  name={s.get('name')}  type={s.get('type')}")

    print("\n=== 2. Searching catalog for heavyweight blanks ===")
    catalog = get("/products")
    if not catalog:
        sys.exit("Could not load catalog.")
    products = catalog.get("result", [])
    seen = {}
    for p in products:
        title = (p.get("title") or "").lower()
        for kw in CANDIDATES:
            if kw in title:
                seen[p["id"]] = p["title"]
                break
    if not seen:
        print("  (no keyword hits — dumping all t-shirt-type products instead)")
        for p in products:
            if "t-shirt" in (p.get("type_name") or "").lower() or "shirt" in (p.get("title") or "").lower():
                seen[p["id"]] = p["title"]
    for pid, title in sorted(seen.items()):
        print(f"  [{pid}] {title}")

    print("\n=== 3. Variant + base cost for each candidate (Black/White, S-2XL) ===")
    for pid, title in sorted(seen.items()):
        detail = get(f"/products/{pid}")
        if not detail:
            continue
        variants = detail.get("result", {}).get("variants", [])
        rows = []
        for v in variants:
            color = (v.get("color") or "").lower()
            size = (v.get("size") or "").upper()
            if color in COLORS and size in SIZES:
                rows.append((color, size, v.get("id"), v.get("price")))
        if rows:
            print(f"\n  >>> [{pid}] {title}")
            for color, size, vid, price in sorted(rows):
                print(f"      {color:5s} {size:3s}  variant_id={vid}  base=${price}")
    print("\nDONE. Paste this whole output back to Claude.")


if __name__ == "__main__":
    main()
