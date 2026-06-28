#!/usr/bin/env python3
"""
The Hidden - Printful create (Stage 2).
Hosts print files, builds placements from live print-area dims, creates the
10-variant sync product on the Clear Cut Co. (Shopify) Printful store at $44,
then generates garment mockups for review.

Run on the Mac:
    export PRINTFUL_TOKEN='...'
    export ASSETS_DIR='/path/to/unzipped/package/assets'   # holds hidden_BACK_*/hidden_MARK_*
    python3 hidden_create.py
"""
import os, sys, json, time, uuid, urllib.request, urllib.error

TOKEN = os.environ.get("PRINTFUL_TOKEN") or sys.exit("set PRINTFUL_TOKEN")
ASSETS = os.environ.get("ASSETS_DIR") or sys.exit("set ASSETS_DIR to the folder with the 4 PNGs")

STORE_ID = "18394177"          # Clear Cut Co. (Shopify)
PRODUCT_ID = 586               # Comfort Colors 1717
PRICE = "44.00"
NAME = "The Hidden"

BASE = "https://api.printful.com"
HDRS = {"Authorization": f"Bearer {TOKEN}", "X-PF-Store-Id": STORE_ID,
        "Content-Type": "application/json", "User-Agent": "clear-cut/2.0"}

# colorway -> (catalog variant ids S,M,L,XL,2XL), back file, mark file
VARIANTS = {
    "black": ([15114, 15115, 15116, 15117, 15118], "hidden_BACK_dark.png",  "hidden_MARK_dark.png"),
    "white": ([15124, 15125, 15126, 15127, 15128], "hidden_BACK_light.png", "hidden_MARK_light.png"),
}

# --- placement tuning (fractions of the print area) ---
BACK_RATIO = 5625 / 4500     # h/w of hidden_BACK_*
CHEST_W_FRAC = 0.30          # chest mark width as fraction of front area width
CHEST_TOP_FRAC = 0.10
CHEST_LEFT_FRAC = 0.55       # pushes mark to wearer's-left chest (viewer's right)


def api(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers=HDRS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        print(f"  ! HTTP {e.code} {method} {path}: {e.read().decode()[:300]}")
        return None


def catbox_upload(path):
    """Upload a local file to catbox.moe, return public URL (stdlib multipart)."""
    boundary = uuid.uuid4().hex
    with open(path, "rb") as f:
        filedata = f.read()
    fn = os.path.basename(path)
    parts = []
    parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"reqtype\"\r\n\r\nfileupload\r\n")
    parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"fileToUpload\"; filename=\"{fn}\"\r\n"
                 f"Content-Type: image/png\r\n\r\n")
    body = b"".join(p.encode() for p in parts) + filedata + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request("https://catbox.moe/user/api.php", data=body,
                                 headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=180) as r:
        url = r.read().decode().strip()
    if not url.startswith("http"):
        raise RuntimeError(f"catbox failed for {fn}: {url}")
    return url


def back_pos(aw, ah):
    w, h = aw, round(aw * BACK_RATIO)
    if h > ah:
        h, w = ah, round(ah / BACK_RATIO)
    return {"area_width": aw, "area_height": ah, "width": w, "height": h,
            "top": round((ah - h) / 2), "left": round((aw - w) / 2), "limit_to_print_area": True}


def chest_pos(aw, ah):
    w = round(aw * CHEST_W_FRAC); h = w  # MARK is square
    left = min(round(aw * CHEST_LEFT_FRAC), aw - w)
    return {"area_width": aw, "area_height": ah, "width": w, "height": h,
            "top": round(ah * CHEST_TOP_FRAC), "left": left, "limit_to_print_area": True}


def main():
    # 1. verify files exist
    need = {f for _, b, m in VARIANTS.values() for f in (b, m)}
    for f in need:
        if not os.path.isfile(os.path.join(ASSETS, f)):
            sys.exit(f"Missing asset: {os.path.join(ASSETS, f)}")

    print("=== 1. Hosting print files (catbox) ===")
    urls = {}
    for f in sorted(need):
        urls[f] = catbox_upload(os.path.join(ASSETS, f))
        print(f"  {f} -> {urls[f]}")

    print("\n=== 2. Fetching print-area dimensions for product 586 ===")
    pf = api("GET", f"/mockup-generator/printfiles/{PRODUCT_ID}")
    if not pf:
        sys.exit("Could not load printfiles.")
    res = pf["result"]
    dims = {p["printfile_id"]: (p["width"], p["height"]) for p in res["printfiles"]}
    # map placement -> dims using the first variant's placement->printfile map
    vmap = res["variant_printfiles"][0]["placements"]
    front_dims = dims[vmap["front"]]
    back_dims = dims[vmap["back"]]
    print(f"  front area = {front_dims}   back area = {back_dims}")
    fp = chest_pos(*front_dims)
    bp = back_pos(*back_dims)
    print(f"  chest pos = {fp}")
    print(f"  back  pos = {bp}")

    print("\n=== 3. Creating sync product (10 variants @ $%s) ===" % PRICE)
    sync_variants = []
    for color, (vids, backf, markf) in VARIANTS.items():
        for vid in vids:
            sync_variants.append({
                "variant_id": vid,
                "retail_price": PRICE,
                "files": [
                    {"type": "back",  "url": urls[backf], "position": bp},
                    {"type": "front", "url": urls[markf], "position": fp},
                ],
            })
    payload = {"sync_product": {"name": NAME, "thumbnail": urls[VARIANTS["black"][1]]},
               "sync_variants": sync_variants}
    created = api("POST", "/store/products", payload)
    if not created:
        sys.exit("Product creation failed (see error above).")
    pid = created["result"]["id"]
    print(f"  CREATED sync_product id={pid}")

    print("\n=== 4. Generating garment mockups (black + white, front+back) ===")
    mockups = []
    for color, (vids, backf, markf) in VARIANTS.items():
        task = api("POST", f"/mockup-generator/create-task/{PRODUCT_ID}", {
            "variant_ids": [vids[2]],  # L as representative
            "format": "jpg",
            "files": [
                {"placement": "back",  "image_url": urls[backf], "position": bp},
                {"placement": "front", "image_url": urls[markf], "position": fp},
            ],
        })
        if not task:
            print(f"  ! mockup task failed for {color}"); continue
        key = task["result"]["task_key"]
        for _ in range(30):
            time.sleep(6)
            st = api("GET", f"/mockup-generator/task?task_key={key}")
            if st and st["result"]["status"] == "completed":
                for m in st["result"]["mockups"]:
                    mockups.append((color, m["placement"], m["mockup_url"]))
                break
            if st and st["result"]["status"] == "failed":
                print(f"  ! mockup gen failed for {color}"); break

    print("\n========== SUMMARY ==========")
    print(f"Sync product id : {pid}")
    print(f"Blank           : Comfort Colors 1717 (id 586)")
    print(f"Base cost       : $15.29 S-XL / $17.29 2XL")
    print(f"Retail          : ${PRICE}  (margin ~65% S-XL)")
    print("Mockups:")
    for color, placement, url in mockups:
        print(f"  {color:5s} {placement:5s} {url}")
    print("\nPaste this whole summary back to Claude.")


if __name__ == "__main__":
    main()
