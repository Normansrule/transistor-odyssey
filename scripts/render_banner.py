"""Render assets/banner.png from scripts/banner.html with the site's own fonts.

    python3 -m http.server 8766 &        # from the repository root
    python3 scripts/render_banner.py
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1600, "height": 600}, device_scale_factor=1.5)
        await pg.goto("http://localhost:8766/scripts/banner.html")
        await pg.wait_for_function("window.__ready === true")
        await pg.wait_for_timeout(400)
        await pg.screenshot(path=str(ROOT / "assets" / "banner.png"))
        await b.close()
    print("assets/banner.png")

asyncio.run(main())
