"""Mask-layout view of a CMOS inverter through the eras (the "layout editor" side).

The same inverter is drawn with Mead–Conway scalable λ rules (Mead & Conway
1980): every width and spacing is an integer multiple of λ, so shrinking λ
shrinks the whole cell. Output:

  * figures/layout/inverter_<node>.gds   (open in KLayout or Magic)
  * figures/layout/inverter_<node>.svg   (KLayout-like stipple-free rendering)
  * figures/layout/shrink.svg            (all cells drawn to one scale)

For the FinFET/GAA eras the cell is drawn on a fixed gate/fin grid (the
"gridded" 1-D layout style that multi-patterning forced after ~20 nm), with
dimensions taken from data/nodes.csv (CPP, MMP).
"""
from __future__ import annotations

import datetime

from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "figures" / "layout"

# GDS layer numbers loosely follow a generic teaching PDK
LAYERS = {
    "nwell": (1, "#5a5f7a", 0.45),
    "active": (2, "#3aa66e", 0.85),
    "pselect": (3, "#e07f3f", 0.25),
    "nselect": (4, "#3f7fe0", 0.25),
    "poly": (5, "#c95c50", 0.9),
    "fin": (6, "#7b8ca5", 0.95),
    "contact": (7, "#f2f4f7", 0.92),
    "metal1": (8, "#8fb6e0", 0.55),
    "via": (9, "#e8ecf1", 1.0),
}

# Inverter geometry in λ units: (layer, x0, y0, x1, y1)
INV_LAMBDA = [
    ("nwell", 0, 22, 26, 44),
    ("pselect", 2, 26, 24, 40),
    ("nselect", 2, 4, 24, 16),
    ("active", 5, 29, 21, 37),     # pMOS diffusion
    ("active", 5, 7, 21, 13),      # nMOS diffusion
    ("poly", 12, 3, 14, 41),       # shared gate
    ("poly", 6, 19, 14, 23),       # input landing
    ("contact", 7, 32, 9, 34), ("contact", 17, 32, 19, 34),
    ("contact", 7, 9, 9, 11), ("contact", 17, 9, 19, 11),
    ("contact", 8, 20, 10, 22),
    ("metal1", 0, 40, 26, 44),     # VDD rail
    ("metal1", 0, 0, 26, 4),       # GND rail
    ("metal1", 6, 31, 10, 44), ("metal1", 6, 0, 10, 12),
    ("metal1", 16, 8, 20, 35),     # output
    ("metal1", 6, 19, 11, 23),     # input pin
]

NODES_LAMBDA = [  # label, year, λ in nm (λ = half the minimum drawn gate length)
    ("10 µm (1971)", 1971, 5000.0),
    ("1.5 µm (1985)", 1985, 750.0),
    ("180 nm (1999)", 1999, 90.0),
]


def finfet_inverter(cpp_nm: float, fin_pitch_nm: float, mmp_nm: float, n_fins: int = 2):
    """Gridded FinFET inverter: 3 gate pitches wide, 2 fins per device."""
    shapes = []
    width = 3 * cpp_nm
    rail = 1.5 * mmp_nm
    y_n = rail + mmp_nm
    for k in range(n_fins):
        y = y_n + k * fin_pitch_nm
        shapes.append(("fin", 0, y, width, y + 0.25 * fin_pitch_nm))
    y_p = y_n + (n_fins + 1.5) * fin_pitch_nm
    for k in range(n_fins):
        y = y_p + k * fin_pitch_nm
        shapes.append(("fin", 0, y, width, y + 0.25 * fin_pitch_nm))
    top = y_p + (n_fins + 0.5) * fin_pitch_nm + mmp_nm
    shapes.append(("nwell", 0, y_p - 0.8 * fin_pitch_nm, width, top + rail))
    for g in range(4):  # gate lines every CPP (outer two are dummy gates on cell edge)
        x = g * cpp_nm - 0.18 * cpp_nm / 2 + (0 if g else 0.09 * cpp_nm)
        shapes.append(("poly", g * cpp_nm - 0.09 * cpp_nm, rail * 0.6, g * cpp_nm + 0.09 * cpp_nm, top + rail * 0.4))
    shapes.append(("metal1", 0, 0, width, rail))
    shapes.append(("metal1", 0, top, width, top + rail))
    shapes.append(("metal1", 2.2 * cpp_nm, y_n, 2.2 * cpp_nm + 0.5 * mmp_nm, y_p + fin_pitch_nm))
    shapes.append(("contact", 0.4 * cpp_nm, y_n - 0.2 * fin_pitch_nm, 0.6 * cpp_nm, y_n + 1.2 * fin_pitch_nm))
    shapes.append(("contact", 0.4 * cpp_nm, y_p - 0.2 * fin_pitch_nm, 0.6 * cpp_nm, y_p + 1.2 * fin_pitch_nm))
    shapes.append(("contact", 1.4 * cpp_nm, y_n - 0.2 * fin_pitch_nm, 1.6 * cpp_nm, y_p + 1.2 * fin_pitch_nm))
    return shapes, width, top + rail


def lambda_inverter(lam_nm: float):
    shapes = [(l, x0 * lam_nm, y0 * lam_nm, x1 * lam_nm, y1 * lam_nm) for l, x0, y0, x1, y1 in INV_LAMBDA]
    return shapes, 26 * lam_nm, 44 * lam_nm


def all_cells():
    cells = []
    for label, year, lam in NODES_LAMBDA:
        s, w, h = lambda_inverter(lam)
        cells.append({"label": label, "year": year, "shapes": s, "w": w, "h": h, "style": "λ rules" + (", CMOS-equivalent" if year < 1980 else "")})
    s, w, h = finfet_inverter(cpp_nm=90, fin_pitch_nm=60, mmp_nm=80)
    cells.append({"label": "22 nm FinFET (2011)", "year": 2011, "shapes": s, "w": w, "h": h, "style": "gridded"})
    s, w, h = finfet_inverter(cpp_nm=51, fin_pitch_nm=28, mmp_nm=28)
    cells.append({"label": "5 nm FinFET (2020)", "year": 2020, "shapes": s, "w": w, "h": h, "style": "gridded"})
    s, w, h = finfet_inverter(cpp_nm=45, fin_pitch_nm=24, mmp_nm=21, n_fins=1)
    cells.append({"label": "2 nm GAA (2025, est.)", "year": 2025, "shapes": s, "w": w, "h": h, "style": "gridded, 1 sheet stack"})
    return cells


def cell_svg(cell, px_w=360, title=True) -> str:
    w, h = cell["w"], cell["h"]
    scale = px_w / w
    ph = h * scale
    pad = 48 if title else 8
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {px_w + 32} {ph + pad + 40}" '
           f'font-family="IBM Plex Sans, Segoe UI, system-ui, sans-serif">',
           f'<rect width="100%" height="100%" rx="12" fill="#10141a"/>']
    if title:
        out.append(f'<text x="16" y="28" fill="#e8ecf1" font-size="15" font-weight="600">{escape(cell["label"])}</text>')
    order = ["nwell", "pselect", "nselect", "active", "fin", "poly", "metal1", "contact", "via"]
    for layer in order:
        _, color, op = LAYERS[layer]
        for l, x0, y0, x1, y1 in cell["shapes"]:
            if l != layer:
                continue
            X = 16 + x0 * scale
            Y = pad + (h - y1) * scale
            out.append(f'<rect x="{X:.2f}" y="{Y:.2f}" width="{(x1 - x0) * scale:.2f}" height="{(y1 - y0) * scale:.2f}" '
                       f'fill="{color}" fill-opacity="{op}" stroke="{color}" stroke-width="1"/>')
    w_txt = f"{w / 1000:.2f} µm" if w >= 1000 else f"{w:.0f} nm"
    h_txt = f"{h / 1000:.2f} µm" if h >= 1000 else f"{h:.0f} nm"
    out.append(f'<text x="16" y="{ph + pad + 26:.0f}" fill="#8a94a3" font-size="12">cell {w_txt} × {h_txt} · {escape(cell["style"])}</text>')
    out.append("</svg>")
    return "\n".join(out)


def shrink_svg(cells) -> str:
    """All inverters at one scale, as nested squares from the 10 µm cell down."""
    big = cells[0]
    W, Hh = 900, 520
    scale = 420 / big["h"]
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {Hh}" font-family="IBM Plex Sans, Segoe UI, system-ui, sans-serif">',
           '<rect width="100%" height="100%" rx="14" fill="#10141a"/>',
           '<text x="24" y="36" fill="#e8ecf1" font-size="19" font-weight="600">One CMOS inverter, drawn to the same scale</text>',
           '<text x="24" y="58" fill="#8a94a3" font-size="12.5">Area of the 1971 cell vs today: roughly a 10⁶× shrink. Most modern cells are sub-pixel here.</text>']
    x = 40
    for i, c in enumerate(cells):
        w, h = c["w"] * scale, c["h"] * scale
        area = c["w"] * c["h"] / 1e6  # µm²
        y = 80 + 420 - h
        out.append(f'<rect x="{x:.2f}" y="{y:.2f}" width="{max(w, 0.6):.2f}" height="{max(h, 0.6):.2f}" fill="#e2b650" fill-opacity="{0.22 if i == 0 else 0.9}" stroke="#e2b650"/>')
        lx = x + max(w, 1) + 10 if i else x + 12
        ly = 110 + i * 62 if i else 110
        out.append(f'<text x="{lx if i else x + 12:.1f}" y="{ly}" fill="#e8ecf1" font-size="13" font-weight="600">{escape(c["label"])}</text>')
        a_txt = f"{area:,.0f}" if area >= 10 else f"{area:.3g}"
        out.append(f'<text x="{lx if i else x + 12:.1f}" y="{ly + 17}" fill="#8a94a3" font-size="12">{a_txt} µm²</text>')
        if i:
            out.append(f'<line x1="{x + max(w, 1):.1f}" y1="{y:.1f}" x2="{lx - 4:.1f}" y2="{ly - 4}" stroke="#8a94a3" stroke-width="1"/>')
        if i == 0:
            x = x + w + 20
    out.append("</svg>")
    return "\n".join(out)


def write_all() -> list[Path]:
    OUT.mkdir(parents=True, exist_ok=True)
    site = ROOT / "site" / "assets" / "layout"
    site.mkdir(parents=True, exist_ok=True)
    cells = all_cells()
    written = []
    try:
        import gdstk
    except ImportError:  # GDS export is optional
        gdstk = None
    for c in cells:
        slug = c["label"].split(" (")[0].replace(" ", "_").replace("µ", "u").replace(".", "p")
        svg = cell_svg(c)
        for d in (OUT, site):
            (d / f"inverter_{slug}.svg").write_text(svg, encoding="utf-8")
        written.append(OUT / f"inverter_{slug}.svg")
        if gdstk:
            lib = gdstk.Library(unit=1e-9, precision=1e-12)
            cell = lib.new_cell(f"INV_{slug}")
            for l, x0, y0, x1, y1 in c["shapes"]:
                cell.add(gdstk.rectangle((x0, y0), (x1, y1), layer=LAYERS[l][0]))
            p = OUT / f"inverter_{slug}.gds"
            lib.write_gds(str(p), timestamp=datetime.datetime(2026, 1, 1))  # fixed stamp: reproducible files
            written.append(p)
    s = shrink_svg(cells)
    (OUT / "shrink.svg").write_text(s, encoding="utf-8")
    (site / "shrink.svg").write_text(s, encoding="utf-8")
    written.append(OUT / "shrink.svg")
    return written


if __name__ == "__main__":
    for p in write_all():
        print(p.relative_to(ROOT))
