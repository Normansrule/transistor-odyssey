"""Mirror the Wikimedia Commons photos locally and refresh author/license metadata.

    python scripts/fetch_images.py            # downloads 1280 px versions
    python scripts/fetch_images.py --width 640

Writes site/assets/photos/<file> and updates data/images.json with the
Artist and LicenseShortName fields reported by the Commons API, then run
scripts/build_data.py to regenerate CREDITS.md. Requires network access.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = "https://commons.wikimedia.org/w/api.php"
UA = "transistor-odyssey/1.0 (educational repository; https://github.com/)"


def api_info(file: str, width: int) -> dict:
    q = {
        "action": "query", "format": "json", "prop": "imageinfo", "titles": "File:" + file,
        "iiprop": "url|extmetadata", "iiurlwidth": str(width),
        "iiextmetadatafilter": "Artist|LicenseShortName|LicenseUrl",
    }
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(q), headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        pages = json.load(r)["query"]["pages"]
    page = next(iter(pages.values()))
    return page["imageinfo"][0]


def strip_tags(s: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--width", type=int, default=1280)
    args = ap.parse_args()
    path = ROOT / "data" / "images.json"
    doc = json.loads(path.read_text(encoding="utf-8"))
    out = ROOT / "site" / "assets" / "photos"
    out.mkdir(parents=True, exist_ok=True)
    for im in doc["images"]:
        try:
            info = api_info(im["file"], args.width)
        except Exception as e:  # keep going; the site falls back to hot-linking
            print("skip", im["file"], e)
            continue
        meta = info.get("extmetadata", {})
        im["author"] = strip_tags(meta.get("Artist", {}).get("value")) or im["author"]
        im["license"] = strip_tags(meta.get("LicenseShortName", {}).get("value")) or im["license"]
        url = info.get("thumburl") or info["url"]
        target = out / im["file"].replace("/", "_")
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            target.write_bytes(r.read())
        im["local"] = f"assets/photos/{target.name}"
        print("ok  ", im["file"], "—", im["author"], "—", im["license"])
    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
