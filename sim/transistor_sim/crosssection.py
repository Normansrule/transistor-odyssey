"""Generate labelled SVG cross-sections for every transistor architecture.

These are the "simulation-side" pictures that sit next to the physical die
photos. They are schematic (not to scale between eras) but keep each device's
real layer order and proportions within one drawing; the caption states the
characteristic dimension.

Run:  python -m transistor_sim.crosssection  (writes figures/cross_sections/*.svg)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[2]

# One material palette shared by the SVGs, the 3D explorer and the docs.
MAT = {
    "si": ("#4b596d", "Silicon substrate"),
    "si_ch": ("#7b8ca5", "Silicon channel"),
    "ge": ("#8f96a3", "Germanium"),
    "oxide": ("#8fcfd4", "SiO₂"),
    "sti": ("#6fa9b3", "Trench oxide (STI)"),
    "poly": ("#c95c50", "Polysilicon gate"),
    "metal": ("#e2b650", "Metal gate"),
    "highk": ("#9a80dc", "High-k (HfO₂)"),
    "spacer": ("#cfd6e0", "Spacer (SiN)"),
    "n": ("#3f7fe0", "n⁺ region"),
    "p": ("#e07f3f", "p⁺ region"),
    "pwell": ("#5f6b52", "p-well"),
    "nwell": ("#5a5f7a", "n-well"),
    "al": ("#b9c3cd", "Aluminium"),
    "au": ("#e8c45c", "Gold"),
    "cu": ("#d9825b", "Copper"),
    "sige": ("#b58fd6", "SiGe stressor"),
    "nitride": ("#c3d27a", "Stress liner (SiN)"),
    "mos2": ("#e25fa6", "MoS₂ monolayer (0.7 nm)"),
    "alox": ("#f4ea9c", "AlOx interface (0.42 nm)"),
    "gan": ("#3aa6cf", "GaN"),
    "algan": ("#86cfe6", "AlGaN barrier"),
    "deg": ("#ffe066", "2D electron gas"),
    "dhg": ("#ff9ad5", "2D hole gas (H-terminated)"),
    "diamond": ("#dfe8f3", "Diamond"),
    "sapphire": ("#6d7f99", "Sapphire / SiC substrate"),
    "gaas": ("#5aa6a0", "GaAs"),
    "algaas": ("#9fd1c9", "AlGaAs"),
    "sic": ("#b8964f", "4H-SiC"),
    "cnt": ("#6fc7a0", "Carbon nanotube"),
    "plastic": ("#5b4e44", "Plastic wedge"),
    "bspdn": ("#d9825b", "Backside power rail"),
    "wall": ("#cfd6e0", "Dielectric wall"),
    "void": ("#1a2029", ""),
    "igzo": ("#9fd67a", "IGZO oxide channel"),
    "glass": ("#6d7f99", "Glass / polyimide substrate"),
    "organic": ("#c9a0dc", "Organic semiconductor film"),
    "box": ("#8fcfd4", "Buried oxide (BOX)"),
    "ferro": ("#e07fb0", "Ferroelectric Hf₀.₅Zr₀.₅O₂"),
    "fg": ("#c95c50", "Floating gate (poly-Si)"),
    "trap": ("#c3d27a", "Charge-trap SiN"),
    "pdia": ("#f29fc8", "p⁺ boron-doped diamond"),
    "ndia": ("#9ec7f0", "n-type diamond (P or N doped)"),
    "driftdia": ("#e6dcef", "p⁻ diamond drift layer"),
    "nv": ("#e25f6a", "Nitrogen atom"),
    "carbon": ("#aab3c0", "Carbon atom"),
    "island": ("#e2b650", "Metal island (dot)"),
    "indium": ("#b9c3cd", "Indium alloy dot"),
    "ndrift": ("#5a5f7a", "n⁻ drift region"),
    "heat": ("#e66767", ""),
}

W, H = 840, 420
BG, INK, MUTED, LINE = "#10141a", "#e8ecf1", "#8a94a3", "#2a323e"


@dataclass
class Drawing:
    title: str
    caption: str
    shapes: list = field(default_factory=list)
    labels: list = field(default_factory=list)   # (anchor_x, anchor_y, text)
    notes: list = field(default_factory=list)    # free text (x, y, text, anchor)

    def rect(self, x, y, w, h, mat, label=None, rx=0, opacity=1.0, lx=None, ly=None):
        self.shapes.append(("rect", x, y, w, h, MAT[mat][0], rx, opacity))
        if label is not False:
            text = label if isinstance(label, str) else MAT[mat][1]
            if text:
                self.labels.append((lx if lx is not None else x + w * 0.5,
                                    ly if ly is not None else y + h * 0.5, text))

    def poly(self, pts, mat, label=None, opacity=1.0, lx=None, ly=None):
        self.shapes.append(("poly", pts, MAT[mat][0], opacity))
        if label is not False:
            text = label if isinstance(label, str) else MAT[mat][1]
            if text:
                cx = lx if lx is not None else sum(p[0] for p in pts) / len(pts)
                cy = ly if ly is not None else sum(p[1] for p in pts) / len(pts)
                self.labels.append((cx, cy, text))

    def circle(self, cx, cy, r, mat, label=None):
        self.shapes.append(("circle", cx, cy, r, MAT[mat][0]))
        if label:
            self.labels.append((cx, cy, label if isinstance(label, str) else MAT[mat][1]))

    def line(self, x1, y1, x2, y2, color, width=2, dash=None):
        self.shapes.append(("line", x1, y1, x2, y2, color, width, dash))

    def note(self, x, y, text, anchor="middle", size=12, color=MUTED):
        self.notes.append((x, y, text, anchor, size, color))

    # ------------------------------------------------------------------
    def svg(self) -> str:
        out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
               f'font-family="IBM Plex Sans, Segoe UI, system-ui, sans-serif" role="img" aria-label="{escape(self.title)}">',
               f'<rect width="{W}" height="{H}" rx="14" fill="{BG}"/>',
               f'<text x="24" y="36" fill="{INK}" font-size="19" font-weight="600">{escape(self.title)}</text>',
               f'<text x="24" y="58" fill="{MUTED}" font-size="12.5">{escape(self.caption)}</text>']
        for s in self.shapes:
            if s[0] == "rect":
                _, x, y, w, h, c, rx, op = s
                out.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{c}" fill-opacity="{op}"/>')
            elif s[0] == "poly":
                _, pts, c, op = s
                p = " ".join(f"{a:.1f},{b:.1f}" for a, b in pts)
                out.append(f'<polygon points="{p}" fill="{c}" fill-opacity="{op}"/>')
            elif s[0] == "circle":
                _, cx, cy, r, c = s
                out.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{c}"/>')
            elif s[0] == "line":
                _, x1, y1, x2, y2, c, w_, dash = s
                d = f' stroke-dasharray="{dash}"' if dash else ""
                out.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{c}" stroke-width="{w_}" stroke-linecap="round"{d}/>')
        # label column with leader lines, de-duplicated and spread vertically
        seen, labels = set(), []
        for lx, ly, t in self.labels:
            if t in seen:
                continue
            seen.add(t)
            labels.append((lx, ly, t))
        labels.sort(key=lambda a: a[1])
        col_x, top, bottom = 548, 84, H - 22
        n = len(labels)
        if n:
            gap = min(30.0, (bottom - top) / max(n, 1))
            ys = [l[1] for l in labels]
            placed = []
            for i, y in enumerate(ys):
                y = max(y, top + i * gap if not placed else placed[-1] + gap)
                placed.append(y)
            overflow = placed[-1] - bottom
            if overflow > 0:
                placed = [p - overflow for p in placed]
                for i in range(len(placed) - 2, -1, -1):
                    placed[i] = min(placed[i], placed[i + 1] - gap)
            for (ax, ay, t), y in zip(labels, placed):
                out.append(f'<polyline points="{ax:.1f},{ay:.1f} {col_x - 26:.1f},{y:.1f} {col_x - 8:.1f},{y:.1f}" '
                           f'fill="none" stroke="{MUTED}" stroke-width="1"/>')
                out.append(f'<circle cx="{ax:.1f}" cy="{ay:.1f}" r="2.6" fill="{INK}" stroke="{BG}" stroke-width="1.5"/>')
                out.append(f'<text x="{col_x}" y="{y + 4:.1f}" fill="{INK}" font-size="12.5">{escape(t)}</text>')
        for x, y, t, anchor, size, color in self.notes:
            out.append(f'<text x="{x}" y="{y}" fill="{color}" font-size="{size}" text-anchor="{anchor}">{escape(t)}</text>')
        out.append("</svg>")
        return "\n".join(out)


# ---------------------------------------------------------------------------
# Architecture drawings. Device area: x 30..500, y 80..400
# ---------------------------------------------------------------------------

def point_contact() -> Drawing:
    d = Drawing("Point-contact transistor (1947)", "Two gold contacts ~50 µm apart on germanium. Bell Labs, Bardeen & Brattain.")
    d.rect(60, 300, 400, 60, "ge", "n-type germanium slab")
    d.rect(60, 360, 400, 18, "au", "Base contact (brass/gold)")
    d.poly([(200, 150), (300, 150), (256, 296), (244, 296)], "plastic")
    d.poly([(206, 152), (236, 152), (249, 298), (244, 298)], "au", "Emitter foil (gold)")
    d.poly([(264, 152), (294, 152), (256, 298), (251, 298)], "au", "Collector foil (gold)", lx=268, ly=200)
    d.rect(238, 294, 24, 10, "p", "Inversion layer under contacts", opacity=0.8)
    d.line(250, 110, 250, 148, INK, 2)
    d.note(250, 104, "spring pressure", size=11)
    d.note(250, 400, "slit in the foil ≈ 50 µm", size=11)
    return d


def bjt() -> Drawing:
    d = Drawing("Grown-junction BJT (1951)", "n–p–n layers grown into one crystal; base tens of µm thick.")
    d.rect(170, 90, 160, 110, "n", "Emitter (n)")
    d.rect(170, 200, 160, 26, "p", "Base (p), ~25 µm")
    d.rect(170, 226, 160, 150, "nwell", "Collector (n)")
    for y, t in ((140, "E"), (213, "B"), (300, "C")):
        d.line(90, y, 170, y, "#b9c3cd", 3)
        d.note(80, y + 4, t, anchor="end", size=14, color=INK)
    d.note(250, 404, "Current flows vertically through the thin base", size=11)
    return d


def planar_bjt() -> Drawing:
    d = Drawing("Planar diffused BJT / early IC (1959)", "Oxide masks diffusion and stays on to passivate the junctions (Hoerni).")
    d.rect(40, 250, 440, 140, "nwell", "n-type collector")
    d.poly([(130, 250), (390, 250), (380, 320), (140, 320)], "p", "Diffused p base")
    d.poly([(190, 250), (290, 250), (284, 285), (196, 285)], "n", "Diffused n⁺ emitter")
    d.rect(40, 230, 440, 20, "oxide", "Thermal SiO₂ (passivation)")
    for x0, w in ((215, 50), (320, 40), (420, 40)):
        d.rect(x0, 230, w, 20, "void", False)
    d.rect(205, 208, 70, 30, "al", "Aluminium over oxide", ly=220)
    d.rect(312, 208, 56, 30, "al", False)
    d.rect(412, 208, 56, 30, "al", False)
    d.note(240, 202, "E", size=13, color=INK); d.note(340, 202, "B", size=13, color=INK); d.note(440, 202, "C", size=13, color=INK)
    return d


def _mos_base(d: Drawing, gate_mat: str, oxide_mat: str = "oxide", sti: bool = False, lg_label: str = ""):
    d.rect(40, 250, 440, 140, "si", "p-type silicon")
    d.poly([(70, 250), (200, 250), (196, 292), (74, 292)], "n", "n⁺ source")
    d.poly([(320, 250), (450, 250), (446, 292), (324, 292)], "n", "n⁺ drain")
    if sti:
        d.rect(40, 250, 26, 90, "sti", "Trench oxide (STI)")
        d.rect(454, 250, 26, 90, "sti", False)
    d.rect(200, 250, 120, 6, "deg", "Inversion channel", opacity=0.85)
    d.rect(196, 240, 128, 10, oxide_mat)
    d.rect(200, 170, 120, 70, gate_mat)
    if lg_label:
        d.line(200, 160, 320, 160, MUTED, 1)
        d.note(260, 154, lg_label, size=11)


def planar_mosfet_metal() -> Drawing:
    d = Drawing("MOSFET, aluminium gate (1960)", "Atalla & Kahng: metal–oxide–semiconductor on a clean Si/SiO₂ interface.")
    _mos_base(d, "al", lg_label="L ≈ 20 µm, oxide ≈ 100 nm")
    d.labels = [l for l in d.labels if l[2] != "Aluminium"] + [(260, 205, "Aluminium gate (overlaps S/D)")]
    d.rect(170, 205, 30, 35, "al", False)
    d.rect(320, 205, 30, 35, "al", False)
    return d


def planar_mosfet_poly() -> Drawing:
    d = Drawing("Self-aligned silicon-gate MOSFET (1968–1980s)", "Poly-Si gate masks its own source/drain implant. Intel 4004: 10 µm pMOS.")
    _mos_base(d, "poly", lg_label="L = 10 µm → 1 µm")
    d.rect(70, 226, 110, 24, "oxide", "Field oxide (LOCOS)", rx=10)
    d.rect(340, 226, 110, 24, "oxide", False, rx=10)
    return d


def planar_mosfet_sti() -> Drawing:
    d = Drawing("Deep-submicron CMOS (1997–2003)", "STI, LDD spacers, silicide, copper wiring above. 250–130 nm.")
    _mos_base(d, "poly", sti=True, lg_label="Lg ≈ 130–70 nm, tox ≈ 2–3 nm")
    d.rect(178, 190, 22, 50, "spacer"); d.rect(320, 190, 22, 50, "spacer", False)
    d.rect(200, 160, 120, 12, "cu", "NiSi / CoSi₂ silicide")
    d.rect(90, 240, 90, 10, "cu", False); d.rect(340, 240, 90, 10, "cu", False)
    d.poly([(200, 250), (216, 250), (214, 262), (196, 262)], "n", "Lightly doped extension (LDD)", opacity=0.7)
    return d


def planar_strain() -> Drawing:
    d = Drawing("Strained-silicon pMOS (90 nm, 2003)", "Embedded SiGe source/drain squeezes the channel; holes move faster.")
    d.rect(40, 250, 440, 140, "si", "n-type silicon")
    d.poly([(70, 236), (196, 236), (206, 300), (80, 300)], "sige", "Embedded SiGe S/D")
    d.poly([(324, 236), (450, 236), (440, 300), (314, 300)], "sige", False)
    d.rect(206, 250, 108, 6, "deg", "Compressed channel", opacity=0.85)
    d.rect(204, 240, 112, 10, "oxide", "SiON gate oxide ≈ 1.2 nm")
    d.rect(206, 175, 108, 65, "poly")
    d.rect(186, 175, 20, 65, "spacer"); d.rect(314, 175, 20, 65, "spacer", False)
    d.poly([(60, 236), (186, 236), (186, 170), (334, 170), (334, 236), (460, 236), (460, 226), (344, 226), (344, 160), (176, 160), (176, 226), (60, 226)], "nitride", lx=400, ly=231)
    d.line(150, 268, 196, 268, INK, 2); d.line(370, 268, 324, 268, INK, 2)
    d.note(260, 300, "→ compressive stress ←", size=11, color=INK)
    return d


def planar_hkmg() -> Drawing:
    d = Drawing("High-k metal gate (45 nm, 2007)", "HfO₂ replaces SiO₂; metal replaces poly. Gate-last replacement flow.")
    d.rect(40, 250, 440, 140, "si", "Silicon substrate")
    d.rect(40, 250, 24, 90, "sti", "Trench oxide (STI)"); d.rect(456, 250, 24, 90, "sti", False)
    d.poly([(70, 238), (200, 238), (208, 296), (78, 296)], "n", "Raised / stressed S/D")
    d.poly([(320, 238), (450, 238), (442, 296), (312, 296)], "n", False)
    d.rect(212, 250, 96, 5, "deg", "Channel, Lg ≈ 35 nm", opacity=0.9)
    d.rect(208, 244, 104, 6, "oxide", "Interfacial SiO₂ (~0.5 nm)")
    d.poly([(208, 244), (208, 175), (216, 175), (216, 236), (304, 236), (304, 175), (312, 175), (312, 244)], "highk", "HfO₂ high-k (U-shape)", lx=260, ly=240)
    d.rect(216, 175, 88, 61, "metal", "Work-function metal + fill")
    d.rect(188, 175, 20, 69, "spacer"); d.rect(312, 175, 20, 69, "spacer", False)
    d.rect(100, 150, 50, 88, "cu", "Tungsten / copper contact")
    return d


def cmos_pair() -> Drawing:
    d = Drawing("CMOS inverter pair (1963 → today)", "nMOS in p-well + pMOS in n-well; one is always off, so standby power ≈ 0.")
    d.rect(30, 260, 470, 130, "si", "Substrate")
    d.rect(40, 250, 220, 110, "pwell", "p-well")
    d.rect(270, 250, 220, 110, "nwell", "n-well")
    for (x, dop) in ((40, "n"), (270, "p")):
        d.rect(x + 18, 250, 60, 30, dop, "n⁺ source/drain" if dop == "n" else "p⁺ source/drain")
        d.rect(x + 142, 250, 60, 30, dop, False)
        d.rect(x + 78, 240, 64, 10, "oxide", "Gate oxide")
        d.rect(x + 78, 185, 64, 55, "poly", "Gate (shared input)")
    d.rect(256, 250, 18, 70, "sti", "Isolation")
    d.line(150, 170, 380, 170, "#b9c3cd", 3)
    d.note(265, 162, "IN", size=12, color=INK)
    return d


def finfet() -> Drawing:
    d = Drawing("FinFET / tri-gate (22 nm, 2011)", "View across the fins: gate wraps three sides. Fin ≈ 8 nm wide, ≈ 40 nm tall.")
    d.rect(30, 320, 470, 70, "si", "Bulk silicon")
    d.rect(30, 290, 470, 30, "sti", "Trench oxide (STI)")
    for i, x in enumerate((110, 230, 350)):
        d.rect(x, 190, 34, 130, "si_ch", "Silicon fin" if i == 0 else False, rx=4)
        d.poly([(x - 8, 290), (x - 8, 182), (x + 42, 182), (x + 42, 290), (x + 34, 290), (x + 34, 190), (x, 190), (x, 290)], "highk", "High-k liner" if i == 0 else False, lx=x - 4, ly=240)
    d.rect(40, 130, 450, 52, "metal", "Metal gate over all fins")
    for x in (80, 152, 200, 272, 320, 392, 440):
        pass
    d.rect(40, 182, 62, 108, "metal", False); d.rect(152, 182, 70, 108, "metal", False)
    d.rect(272, 182, 70, 108, "metal", False); d.rect(392, 182, 98, 108, "metal", False)
    d.note(127, 408, "fin pitch ≈ 60 → 30 nm", size=11)
    return d


def gaa() -> Drawing:
    d = Drawing("Gate-all-around nanosheets (3–2 nm class, 2022–2025)", "Along the channel: 3 stacked Si sheets, gate between and around each.")
    d.rect(30, 330, 470, 60, "si", "Substrate")
    d.rect(30, 318, 470, 12, "sti", "Bottom dielectric isolation")
    d.poly([(40, 318), (170, 318), (170, 150), (40, 150)], "n", "Epitaxial S/D (Si:P)")
    d.poly([(360, 318), (490, 318), (490, 150), (360, 150)], "n", False)
    d.rect(170, 150, 190, 168, "metal", "Metal gate fills between sheets")
    for i, y in enumerate((170, 222, 274)):
        d.rect(170, y, 190, 18, "si_ch", "Si nanosheet (~5 nm)" if i == 0 else False)
        d.rect(170, y - 5, 190, 5, "highk", "High-k all around" if i == 0 else False)
        d.rect(170, y + 18, 190, 5, "highk", False)
        d.rect(170, y + 23, 14, 29, "spacer", "Inner spacer" if i == 0 else False)
        d.rect(346, y + 23, 14, 29, "spacer", False)
    d.rect(150, 110, 20, 208, "spacer", "Gate spacer"); d.rect(360, 110, 20, 208, "spacer", False)
    d.rect(170, 110, 190, 40, "metal", False)
    d.note(265, 408, "Lg ≈ 12–15 nm, sheet width tunable per cell", size=11)
    return d


def gaa_bspdn() -> Drawing:
    d = gaa()
    d.title = "Nanosheets + backside power (Intel 18A PowerVia, TSMC A16)"
    d.caption = "Wafer thinned from the back; power reaches the source from below."
    d.shapes = [s for s in d.shapes if not (s[0] == "rect" and s[5] == MAT["si"][0])]
    d.labels = [l for l in d.labels if l[2] != "Substrate"]
    d.rect(30, 330, 470, 26, "oxide", "Thinned wafer / bonding oxide")
    d.rect(30, 356, 470, 40, "bspdn", "Backside power rail")
    d.rect(80, 318, 50, 40, "cu", "Backside contact (A16 direct)")
    d.rect(170, 80, 190, 24, "cu", "Front-side signal wiring only")
    return d


def nanostack() -> Drawing:
    d = Drawing("IBM nanostack (0.7 nm / 7 Å research node, 2026)", "Two nanosheet tiers stacked and staggered vertically; nFET and pFET tuned separately.")
    d.rect(30, 360, 470, 34, "si", "Substrate / bonded carrier")
    d.rect(30, 348, 470, 12, "bspdn", "Backside bitlines / power")
    for tier, (y0, dop, x0) in enumerate(((240, "n", 60), (120, "p", 140))):
        d.rect(x0, y0, 320, 100, "metal", "Shared / split gate" if tier == 0 else False)
        for j in range(3):
            y = y0 + 12 + j * 30
            d.rect(x0 + 40, y, 240, 14, "si_ch", ("Lower tier sheets (nFET)" if tier == 0 else "Upper tier sheets (pFET), staggered") if j == 0 else False)
        d.rect(x0 - 30, y0, 40, 100, dop, "n⁺ S/D (lower)" if dop == "n" else "p⁺ S/D (upper)")
        d.rect(x0 + 310, y0, 40, 100, dop, False)
    d.rect(30, 222, 470, 16, "oxide", "Ultra-thin bonding dielectric")
    d.note(265, 408, "IBM: ~2× density vs its 2 nm, up to 50% faster or 70% more efficient (claims)", size=11)
    return d


def cfet() -> Drawing:
    d = nanostack()
    d.title = "Complementary FET (CFET) — roadmap"
    d.caption = "pFET sheets directly on top of nFET sheets, sharing one gate. imec / IRDS beyond 1 nm."
    d.notes = [n for n in d.notes if "IBM" not in n[2]]
    d.note(265, 408, "Stacking n over p roughly halves the cell footprint", size=11)
    return d


def mos2() -> Drawing:
    d = Drawing("2D MoS₂ FET with 0.42 nm AlOx interface (NYCU + TSMC, 2026)", "Top gate on a one-molecule-thick channel. 0.42 nm is this buffer layer, not a node name.")
    d.rect(30, 320, 470, 70, "sapphire", "Substrate")
    d.rect(60, 300, 410, 8, "mos2")
    d.rect(60, 292, 90, 10, "au", "Semimetal / Au contact")
    d.rect(380, 292, 90, 10, "au", False)
    d.rect(60, 250, 90, 42, "au", False); d.rect(380, 250, 90, 42, "au", False)
    d.rect(150, 296, 230, 4, "alox")
    d.rect(150, 280, 230, 16, "highk", "HfO₂ gate dielectric (EOT ≈ 1 nm total)")
    d.rect(170, 200, 190, 80, "metal", "Top gate, channel ≈ 100 nm")
    # zoom inset
    d.rect(60, 90, 200, 96, "void", False, rx=8)
    d.rect(76, 104, 168, 30, "highk", False)
    d.rect(76, 134, 168, 12, "alox", False)
    d.rect(76, 146, 168, 22, "mos2", False)
    d.note(160, 124, "HfO₂", size=11, color="#10141a")
    d.note(160, 144, "AlOx 0.42 nm", size=10, color="#10141a")
    d.note(160, 162, "MoS₂ 0.7 nm (S–Mo–S)", size=10, color="#10141a")
    d.line(160, 186, 265, 296, MUTED, 1, "3 3")
    return d


def gan_hemt() -> Drawing:
    d = Drawing("AlGaN/GaN HEMT (1993 → today)", "Polarization at the AlGaN/GaN interface creates a 2DEG with no doping (~1e13 cm⁻²).")
    d.rect(30, 350, 470, 44, "sapphire", "SiC or Si substrate")
    d.rect(30, 330, 470, 20, "oxide", "AlN nucleation + buffer")
    d.rect(30, 238, 470, 92, "gan", "GaN channel layer")
    d.rect(30, 236, 470, 5, "deg", "2DEG sheet")
    d.rect(30, 212, 470, 24, "algan", "Al₀.₂₅Ga₀.₇₅N barrier (~20 nm)")
    d.rect(60, 180, 90, 32, "au", "Ohmic source (Ti/Al/Ni/Au)")
    d.rect(380, 180, 90, 32, "au", "Ohmic drain")
    d.rect(150, 196, 230, 16, "spacer", "SiN passivation")
    d.poly([(215, 212), (245, 212), (245, 170), (300, 170), (300, 158), (205, 158), (205, 170), (215, 170)], "metal", "Schottky gate + field plate")
    return d


def gaas_phemt() -> Drawing:
    d = Drawing("GaAs pHEMT (1980 → RF front-ends)", "Mimura's selectively doped heterojunction: electrons fall from AlGaAs into undoped GaAs.")
    d.rect(30, 340, 470, 54, "gaas", "Semi-insulating GaAs substrate")
    d.rect(30, 258, 470, 82, "gaas", False)
    d.rect(30, 250, 470, 10, "si_ch", "InGaAs channel (pseudomorphic)")
    d.rect(30, 248, 470, 3, "deg", "2DEG")
    d.rect(30, 214, 470, 34, "algaas", "n-AlGaAs donor / barrier")
    d.rect(60, 188, 90, 26, "au", "Ohmic contacts")
    d.rect(380, 188, 90, 26, "au", False)
    d.poly([(250, 214), (262, 214), (262, 190), (285, 176), (227, 176), (250, 190)], "metal", "T-gate (Lg ≈ 0.1–0.25 µm)")
    return d


def diamond_fet() -> Drawing:
    d = Drawing("Hydrogen-terminated diamond FET", "C–H surface + adsorbates pull electrons out: a 2D hole gas forms just below the surface.")
    d.rect(30, 250, 470, 140, "diamond", "Single-crystal diamond")
    d.rect(30, 247, 470, 5, "dhg", "2D hole gas (C–H surface)")
    d.rect(60, 212, 90, 35, "au", "Au source")
    d.rect(380, 212, 90, 35, "au", "Au drain")
    d.rect(150, 225, 230, 22, "oxide", "Al₂O₃ gate insulator (ALD)")
    d.rect(180, 175, 170, 50, "metal", "Gate")
    d.note(265, 408, "Ec ≈ 10 MV/cm, k ≈ 22 W/cm·K: best-in-class for heat and voltage", size=11)
    return d


def sic_mosfet() -> Drawing:
    d = Drawing("4H-SiC power MOSFET (vertical, planar gate)", "Current flows down through a thick n⁻ drift layer; blocks 650 V–3.3 kV.")
    d.rect(30, 350, 470, 44, "au", "Drain metal (backside)")
    d.rect(30, 310, 470, 40, "sic", "n⁺ SiC substrate")
    d.rect(30, 200, 470, 110, "nwell", "n⁻ drift layer (µm-thick)")
    d.rect(30, 170, 170, 60, "p", "p-body")
    d.rect(330, 170, 170, 60, "p", False)
    d.rect(60, 170, 110, 16, "n", "n⁺ source")
    d.rect(360, 170, 110, 16, "n", False)
    d.rect(140, 158, 250, 12, "oxide", "Gate oxide")
    d.rect(150, 118, 230, 40, "poly", "Poly gate")
    d.line(265, 200, 265, 300, INK, 2, "4 4")
    d.note(265, 408, "Baliga FOM ≈ 300× silicon", size=11)
    return d


def cnt_fet() -> Drawing:
    d = Drawing("Carbon-nanotube FET (MIT RV16X-NANO, 2019)", "Aligned semiconducting nanotubes (~1.5 nm diameter) bridge source and drain.")
    d.rect(30, 300, 470, 90, "si", "Substrate + oxide")
    d.rect(30, 290, 470, 10, "oxide", False)
    for i, y in enumerate((230, 250, 270)):
        d.rect(80, y, 370, 7, "cnt", "Carbon nanotubes" if i == 0 else False, rx=3.5)
    d.rect(60, 215, 70, 75, "au", "Metal contacts (Pt / Ti)")
    d.rect(400, 215, 70, 75, "au", False)
    d.rect(190, 200, 150, 90, "metal", "Gate (bottom or top)", opacity=0.35)
    return d


def mos2_interface() -> Drawing:
    """Atom-scale stack of the NYCU/TSMC gate: drawn to one vertical scale (1 nm = 60 px)."""
    d = Drawing("The 0.42 nm layer, drawn to scale", "Vertical scale: 1 nm = 60 px. Atoms shown schematically; HfO₂ thickness illustrative.")
    px = 60.0
    y_mos2 = 330.0
    # MoS2: S-Mo-S sandwich 0.7 nm thick (0.31 nm between S planes centres ~ plus radii)
    t_mos2, t_alox, t_hfo2 = 0.65, 0.42, 1.6
    d.rect(40, y_mos2, 460, t_mos2 * px, "mos2", "MoS₂ monolayer ≈ 0.65–0.7 nm")
    y_al = y_mos2 - t_alox * px
    d.rect(40, y_al, 460, t_alox * px, "alox", "AlOx buffer 0.42 nm (from 0.3 nm Al)")
    y_hf = y_al - t_hfo2 * px
    d.rect(40, y_hf, 460, t_hfo2 * px, "highk", "HfO₂ high-k dielectric")
    d.rect(40, y_hf - 70, 460, 70, "metal", "Gate metal")
    d.rect(40, y_mos2 + t_mos2 * px, 460, 40, "sapphire", "Substrate")
    for i in range(12):
        x = 60 + i * 38
        d.circle(x, y_mos2 + 7, 5.5, "alox" if False else "cnt", None)
        d.circle(x + 19, y_mos2 + 20, 7.5, "metal", None)
        d.circle(x, y_mos2 + 33, 5.5, "cnt", None)
    for i in range(22):
        d.circle(52 + i * 21, y_al + 12.6, 5, "spacer", None)
    d.line(512, y_al, 512, y_mos2, INK, 1.5)
    d.note(520, y_al - 6, "", anchor="start")
    d.note(270, 406, "Mo atoms (gold) between two sulfur planes (green); O/Al buffer (grey) above", size=11)
    return d


# ---------------------------------------------------------------------------
# Diamond devices
# ---------------------------------------------------------------------------

def diamond_inversion_mosfet() -> Drawing:
    d = Drawing("Inversion-channel diamond MOSFET (Kanazawa/AIST, 2016)", "p-channel inversion on an n-type (P-doped) body: normally off, like a silicon MOSFET.")
    d.rect(30, 330, 470, 64, "diamond", "Diamond substrate (Ib or IIa)")
    d.rect(30, 250, 470, 80, "ndia", "n-type body (phosphorus-doped)")
    d.poly([(60, 250), (190, 250), (186, 296), (64, 296)], "pdia", "p⁺ source (heavy boron)")
    d.poly([(340, 250), (470, 250), (466, 296), (344, 296)], "pdia", "p⁺ drain")
    d.rect(190, 250, 150, 5, "dhg", "Inversion hole channel (−V_G)")
    d.rect(186, 238, 158, 12, "oxide", "Al₂O₃ on OH-terminated (111) surface")
    d.rect(196, 180, 138, 58, "metal", "Gate")
    d.note(265, 408, "Matsumoto et al., Sci. Rep. 2016: first inversion-type diamond MOSFET", size=11)
    return d


def diamond_vertical_mosfet() -> Drawing:
    d = Drawing("Vertical 2DHG diamond trench MOSFET (Waseda, 2024)", "Hole gas on the C–H trench sidewall; current flows down to a p⁺ substrate drain.")
    d.rect(30, 350, 470, 44, "au", "Drain metal")
    d.rect(30, 300, 470, 50, "pdia", "p⁺ substrate (drain)")
    d.rect(30, 240, 470, 60, "driftdia", "p⁻ drift layer")
    d.rect(30, 150, 170, 90, "ndia", "Nitrogen-doped blocking layer")
    d.rect(330, 150, 170, 90, "ndia", False)
    d.rect(30, 136, 170, 14, "pdia", "p⁺ source contact layer", ly=143)
    d.rect(330, 136, 170, 14, "pdia", False)
    d.rect(200, 136, 5, 110, "dhg", "2D hole gas on trench wall")
    d.rect(325, 136, 5, 110, "dhg", False)
    d.poly([(205, 136), (325, 136), (325, 250), (205, 250)], "oxide", "Al₂O₃ gate insulator", lx=265, ly=244)
    d.rect(218, 110, 94, 132, "metal", "Trench gate")
    d.line(202, 250, 202, 300, INK, 2, "4 4"); d.line(328, 250, 328, 300, INK, 2, "4 4")
    d.note(265, 408, "Oi et al., IEEE EDL 2024: 0.7 A from one device, −1.5 A from two in parallel", size=11)
    return d


def gan_on_diamond() -> Drawing:
    d = Drawing("GaN-on-diamond HEMT", "Swap the SiC substrate for CVD diamond a few tens of nm below the channel to pull heat out.")
    d.rect(30, 300, 470, 94, "diamond", "CVD polycrystalline diamond (~20 W/cm·K)")
    d.rect(30, 290, 470, 10, "spacer", "Thin SiN / AlN bonding interlayer")
    d.rect(30, 236, 470, 54, "gan", "GaN channel (~1 µm)")
    d.rect(30, 234, 470, 4, "deg", "2DEG")
    d.rect(30, 212, 470, 22, "algan", "AlGaN barrier")
    d.rect(60, 184, 90, 28, "au", "Source")
    d.rect(380, 184, 90, 28, "au", "Drain")
    d.rect(250, 174, 30, 38, "metal", "Gate")
    for x in (230, 265, 300):
        d.line(x, 240, x, 380, "#e66767", 2, "5 4")
    d.note(265, 408, "Hot spot sits ~1 µm from diamond; thermal boundary resistance at the interface is the key figure", size=11)
    return d


def nv_center() -> Drawing:
    d = Drawing("Nitrogen-vacancy (NV) centre in diamond", "A nitrogen atom beside a missing carbon: a spin you can set with green light and read by red glow at room temperature.")
    d.rect(40, 90, 450, 300, "void", False, rx=10)
    xs = [70 + i * 52 for i in range(9)]
    ys = [120 + j * 48 for j in range(6)]
    for j, y in enumerate(ys):
        for i, x in enumerate(xs):
            if (i, j) in ((4, 2), (5, 3)):
                continue
            ox = 26 if j % 2 else 0
            if x + ox > 480:
                continue
            d.circle(x + ox, y, 9, "carbon", None)
    d.circle(xs[4] + 0, ys[2], 12, "nv", "Nitrogen atom (substitutional)")
    d.shapes.append(("circle", xs[5] + 26, ys[3], 12, "#10141a"))
    d.line(xs[5] + 14, ys[3], xs[5] + 38, ys[3], MUTED, 1.5, "3 3")
    d.labels.append((xs[5] + 26, ys[3], "Vacancy (missing carbon)"))
    d.labels.append((xs[0], ys[0], "Carbon lattice"))
    d.line(120, 400, 250, 250, "#3aa66e", 3)
    d.note(118, 412, "532 nm green pump", size=11, color="#3aa66e")
    d.line(330, 262, 450, 400, "#e66767", 3, "6 4")
    d.note(440, 412, "637–800 nm red fluorescence", size=11, color="#e66767")
    return d


def diamond_transfer_doping() -> Drawing:
    d = Drawing("Surface transfer doping of H-terminated diamond", "Band picture: an acceptor on the surface sits below diamond's valence band, so electrons leave and holes stay.")
    x0, x1, xs_ = 40, 380, 470
    # conduction and valence bands bending up near the surface (x1)
    cb = [(x0, 130)] + [(x0 + t, 130 - 60 * (t / (x1 - x0)) ** 6) for t in range(0, x1 - x0 + 1, 10)]
    vb = [(x, y + 190) for x, y in cb]
    d.shapes.append(("line", x0, 130, x1, 130, MUTED, 1, "2 4"))
    for a, b in zip(cb[:-1], cb[1:]):
        d.line(a[0], a[1], b[0], b[1], "#3f7fe0", 3)
    for a, b in zip(vb[:-1], vb[1:]):
        d.line(a[0], a[1], b[0], b[1], "#e07f3f", 3)
    d.labels.append((140, 130, "Conduction band E_C"))
    d.labels.append((140, 320, "Valence band E_V (bends up)"))
    d.line(x0, 282, xs_ + 20, 282, "#e2b650", 1.5, "6 4")
    d.labels.append((80, 282, "Fermi level E_F"))
    d.rect(x1, 90, 8, 300, "spacer", "C–H surface dipole (negative electron affinity)")
    d.rect(x1 + 8, 90, 90, 300, "void", False)
    d.rect(x1 + 20, 279, 60, 6, "p", "Acceptor LUMO (NO₂, MoO₃, V₂O₅), below E_V")
    for y in (264, 272):
        d.circle(x1 - 10, y, 4.5, "dhg", None)
    d.labels.append((x1 - 10, 268, "2D hole gas, ~1e13 cm⁻², within ~1 nm"))
    d.note(200, 408, "Strobel et al., Nature 2004; Maier et al., PRL 2000", size=11)
    return d


def diamond_schottky() -> Drawing:
    d = Drawing("Pseudo-vertical diamond Schottky diode", "Lightly doped drift layer on a heavily doped layer; blocks kilovolts in principle at µm thicknesses.")
    d.rect(30, 330, 470, 64, "diamond", "Insulating diamond substrate")
    d.rect(30, 280, 470, 50, "pdia", "p⁺ boron layer (~1e20 cm⁻³)")
    d.rect(140, 180, 250, 100, "driftdia", "p⁻ drift layer (~1e15–16 cm⁻³)")
    d.rect(180, 160, 170, 20, "metal", "Schottky metal (Mo, Pt, Zr)")
    d.rect(50, 260, 70, 20, "au", "Ohmic contact (Ti/Pt/Au)")
    d.rect(410, 260, 70, 20, "au", False)
    d.line(265, 190, 265, 270, INK, 2, "4 4")
    return d


# ---------------------------------------------------------------------------
# Niche and forgotten devices
# ---------------------------------------------------------------------------

def jfet() -> Drawing:
    d = Drawing("Junction FET (Shockley 1952)", "A reverse-biased p–n gate widens its depletion region and pinches the channel. No oxide needed.")
    d.rect(30, 320, 470, 74, "si", "Substrate")
    d.rect(60, 190, 410, 130, "n", "n-type channel bar", opacity=0.75)
    d.rect(190, 170, 150, 28, "p", "p⁺ top gate")
    d.rect(190, 310, 150, 22, "p", "p⁺ bottom gate / substrate junction")
    d.poly([(180, 198), (350, 198), (330, 238), (200, 238)], "void", "Depletion region (grows with −V_G)", lx=265, ly=222)
    d.poly([(200, 310), (330, 310), (320, 282), (210, 282)], "void", False)
    d.rect(60, 150, 50, 40, "al", "Source"); d.rect(420, 150, 50, 40, "al", "Drain")
    return d


def alloy_junction() -> Drawing:
    d = Drawing("Alloy-junction transistor (1950s)", "Indium pellets melted into both faces of a thin n-germanium die form p-regions: a PNP transistor.")
    d.rect(60, 210, 410, 80, "ge", "n-type germanium base wafer")
    d.poly([(200, 210), (330, 210), (310, 240), (220, 240)], "p", "p-type regrown region (emitter)")
    d.poly([(170, 290), (360, 290), (330, 262), (200, 262)], "p", "p-type regrown region (collector)")
    d.circle(265, 190, 30, "indium", "Indium dot (emitter)")
    d.circle(265, 318, 38, "indium", "Indium dot (collector, larger)")
    d.rect(420, 180, 40, 30, "al", "Base tab")
    d.note(265, 408, "Base width set by how deep the indium dissolves: ~10 µm", size=11)
    return d


def igzo_tft() -> Drawing:
    d = Drawing("IGZO thin-film transistor (displays, Flex-RV)", "Amorphous indium–gallium–zinc oxide on glass or plastic, made below ~350 °C.")
    d.rect(30, 330, 470, 64, "glass", "Glass or polyimide substrate")
    d.rect(180, 300, 170, 30, "metal", "Bottom gate (Mo)")
    d.rect(140, 280, 250, 20, "oxide", "SiO₂ gate insulator")
    d.rect(150, 262, 230, 18, "igzo", "a-IGZO channel (~20–50 nm)")
    d.rect(120, 232, 90, 40, "al", "Source")
    d.rect(320, 232, 90, 40, "al", "Drain")
    d.rect(210, 244, 110, 18, "spacer", "Etch-stop / passivation")
    d.note(265, 408, "Nomura et al., Nature 2004; Ozer et al., Nature 2024 (Flex-RV, 0.6 µm IGZO)", size=11)
    return d


def organic_tft() -> Drawing:
    d = Drawing("Organic thin-film transistor (1986 →)", "A polymer or small-molecule semiconductor printed or evaporated at room temperature.")
    d.rect(30, 330, 470, 64, "glass", "Plastic foil")
    d.rect(170, 300, 190, 30, "metal", "Gate")
    d.rect(120, 272, 290, 28, "oxide", "Polymer dielectric")
    d.rect(120, 246, 290, 26, "organic", "Organic semiconductor (e.g. pentacene, P3HT)")
    d.rect(130, 216, 90, 30, "au", "Au source (top contact)")
    d.rect(310, 216, 90, 30, "au", "Au drain")
    d.note(265, 408, "Tsumura, Koezuka & Ando, APL 1986: polythiophene FET", size=11)
    return d


def igbt() -> Drawing:
    d = Drawing("Insulated-gate bipolar transistor (IGBT)", "A MOSFET that injects holes from a p⁺ collector: bipolar current with a voltage-driven gate.")
    d.rect(30, 350, 470, 44, "au", "Collector metal")
    d.rect(30, 318, 470, 32, "p", "p⁺ collector (hole injector)")
    d.rect(30, 200, 470, 118, "ndrift", "n⁻ drift region (conductivity-modulated)")
    d.rect(30, 160, 160, 60, "pwell", "p-body")
    d.rect(340, 160, 160, 60, "pwell", False)
    d.rect(60, 160, 100, 16, "n", "n⁺ emitter")
    d.rect(370, 160, 100, 16, "n", False)
    d.rect(150, 148, 230, 12, "oxide", "Gate oxide")
    d.rect(160, 110, 210, 38, "poly", "Gate")
    d.note(265, 408, "Trains, wind turbines, EV inverters: 600 V to 6.5 kV", size=11)
    return d


def fdsoi() -> Drawing:
    d = Drawing("Fully depleted SOI (FD-SOI / UTBB)", "A ~7 nm silicon film on a ~25 nm buried oxide: the thin body stays fully depleted; the substrate is a back gate.")
    d.rect(30, 300, 470, 94, "si", "Silicon handle (back gate)")
    d.rect(30, 266, 470, 34, "box", "Buried oxide (BOX), ~25 nm")
    d.rect(30, 252, 470, 14, "si_ch", "Ultrathin Si film, ~7 nm")
    d.poly([(70, 252), (200, 252), (200, 214), (70, 214)], "n", "Raised epitaxial S/D")
    d.poly([(330, 252), (460, 252), (460, 214), (330, 214)], "n", False)
    d.rect(212, 242, 106, 10, "highk", "HKMG stack")
    d.rect(216, 180, 98, 62, "metal", "Gate")
    d.note(265, 408, "Used in 28 nm and 22 nm FD-SOI for low-power IoT and RF", size=11)
    return d


def junctionless() -> Drawing:
    d = Drawing("Junctionless nanowire transistor (Colinge 2010)", "Source, channel and drain doped the same: the gate simply squeezes the wire until it empties.")
    d.rect(30, 320, 470, 74, "si", "Substrate")
    d.rect(30, 300, 470, 20, "box", "Buried oxide")
    d.rect(60, 250, 410, 30, "n", "Uniformly n⁺ silicon nanowire")
    d.rect(200, 232, 130, 66, "highk", "Gate dielectric", opacity=0.9)
    d.rect(210, 212, 110, 30, "metal", "Gate (wraps the wire)")
    d.rect(210, 288, 110, 12, "metal", False)
    return d


def vtfet() -> Drawing:
    d = Drawing("Vertical transport FET (IBM + Samsung, 2021)", "Current flows up through a vertical fin; gate length no longer eats horizontal pitch.")
    d.rect(30, 330, 470, 64, "si", "Substrate")
    d.rect(60, 300, 410, 30, "n", "Bottom source/drain")
    d.rect(60, 290, 410, 10, "sti", "Bottom spacer")
    for x in (150, 330):
        d.rect(x, 150, 40, 150, "si_ch", "Vertical Si fin (channel)" if x == 150 else False)
        d.rect(x - 14, 180, 68, 100, "metal", "Gate wraps fin sides" if x == 150 else False, opacity=0.8)
        d.rect(x - 10, 130, 60, 28, "n", "Top source/drain" if x == 150 else False)
    d.line(170, 290, 170, 160, INK, 2, "4 4")
    return d


def tfet() -> Drawing:
    d = Drawing("Tunnel FET (band-to-band tunnelling)", "p⁺ source, intrinsic channel, n⁺ drain: the gate lets electrons tunnel from the source valence band.")
    d.rect(30, 320, 470, 74, "si", "Substrate")
    d.rect(30, 300, 470, 20, "box", "Buried oxide")
    d.rect(60, 252, 140, 48, "p", "p⁺ source")
    d.rect(200, 252, 130, 48, "si_ch", "Intrinsic channel")
    d.rect(330, 252, 140, 48, "n", "n⁺ drain")
    d.rect(196, 240, 138, 12, "highk", "High-k")
    d.rect(200, 180, 130, 60, "metal", "Gate")
    d.line(190, 276, 214, 276, "#ffe066", 3)
    d.labels.append((202, 276, "Tunnelling junction (sub-60 mV/dec)"))
    d.note(265, 408, "Ionescu & Riel, Nature 2011; on-current is the open problem", size=11)
    return d


def ncfet() -> Drawing:
    d = _ncfet_base()
    return d


def _ncfet_base() -> Drawing:
    d = Drawing("Negative-capacitance FET / FeFET", "A ferroelectric layer in the gate stack: steeper switching (NC) or non-volatile memory (FeFET).")
    d.rect(40, 250, 440, 140, "si", "Silicon")
    d.poly([(70, 250), (200, 250), (196, 292), (74, 292)], "n", "n⁺ source")
    d.poly([(320, 250), (450, 250), (446, 292), (324, 292)], "n", "n⁺ drain")
    d.rect(196, 244, 128, 6, "oxide", "Interfacial SiO₂")
    d.rect(196, 226, 128, 18, "ferro")
    d.rect(200, 170, 120, 56, "metal", "Gate metal")
    d.note(265, 408, "Salahuddin & Datta 2008 (NC); ferroelectric HfO₂: Böscke et al. 2011", size=11)
    return d


def flash_fg() -> Drawing:
    d = Drawing("Floating-gate flash cell (Kahng & Sze 1967)", "Electrons tunnel onto an isolated gate and stay for years, shifting V_T: one bit.")
    d.rect(40, 250, 440, 140, "si", "p-type silicon")
    d.poly([(70, 250), (200, 250), (196, 292), (74, 292)], "n", "n⁺ source")
    d.poly([(320, 250), (450, 250), (446, 292), (324, 292)], "n", "n⁺ drain")
    d.rect(196, 242, 128, 8, "oxide", "Tunnel oxide (~8 nm)")
    d.rect(200, 210, 120, 32, "fg")
    d.rect(196, 198, 128, 12, "highk", "ONO inter-poly dielectric")
    d.rect(200, 150, 120, 48, "metal", "Control gate (word line)")
    for x in (225, 255, 285):
        d.circle(x, 226, 5, "n", None)
    return d


def nand3d() -> Drawing:
    d = Drawing("3D NAND string (BiCS, 2007 →)", "Word-line layers stacked 200+ high; a vertical polysilicon channel pierces them all.")
    d.rect(30, 360, 470, 34, "si", "Substrate / source line")
    for k in range(9):
        y = 330 - k * 26
        d.rect(40, y, 450, 16, "metal", "Word-line layers (W)" if k == 0 else False)
        d.rect(40, y + 16, 450, 10, "oxide", "Inter-layer oxide" if k == 0 else False)
    d.rect(220, 94, 90, 266, "trap", "Charge-trap SiN (ONO)")
    d.rect(236, 94, 58, 266, "si_ch", "Vertical poly-Si channel")
    d.rect(254, 94, 22, 266, "oxide", "Core oxide", opacity=0.8)
    d.rect(230, 72, 70, 22, "cu", "Bit-line contact")
    return d


def set_transistor() -> Drawing:
    d = Drawing("Single-electron transistor (Fulton & Dolan 1987)", "A tiny island between two tunnel barriers: current flows one electron at a time (Coulomb blockade).")
    d.rect(40, 330, 450, 64, "si", "Substrate")
    d.rect(60, 230, 140, 60, "al", "Source lead")
    d.rect(330, 230, 140, 60, "al", "Drain lead")
    d.rect(200, 250, 12, 20, "oxide", "Tunnel barrier")
    d.rect(318, 250, 12, 20, "oxide", False)
    d.rect(212, 236, 106, 48, "island")
    d.rect(225, 150, 80, 36, "metal", "Gate (capacitively coupled)")
    d.line(265, 186, 265, 236, MUTED, 1.5, "3 3")
    d.note(265, 408, "Island charging energy e²/2C must beat kT: tens of nm at cryo, ~1 nm at room temperature", size=11)
    return d


ARCHS = {
    "point_contact": point_contact, "bjt": bjt, "planar_bjt": planar_bjt,
    "planar_mosfet_metal": planar_mosfet_metal, "planar_mosfet_poly": planar_mosfet_poly,
    "cmos_pair": cmos_pair, "planar_mosfet_sti": planar_mosfet_sti, "planar_strain": planar_strain,
    "planar_hkmg": planar_hkmg, "finfet": finfet, "gaa": gaa, "gaa_bspdn": gaa_bspdn,
    "nanostack": nanostack, "cfet": cfet, "mos2": mos2, "gan_hemt": gan_hemt,
    "gaas_phemt": gaas_phemt, "diamond_fet": diamond_fet, "sic_mosfet": sic_mosfet, "cnt_fet": cnt_fet,
    "mos2_interface": mos2_interface,
    "diamond_inversion_mosfet": diamond_inversion_mosfet, "diamond_vertical_mosfet": diamond_vertical_mosfet,
    "gan_on_diamond": gan_on_diamond, "nv_center": nv_center, "diamond_transfer_doping": diamond_transfer_doping,
    "diamond_schottky": diamond_schottky, "jfet": jfet, "alloy_junction": alloy_junction, "igzo_tft": igzo_tft,
    "organic_tft": organic_tft, "igbt": igbt, "fdsoi": fdsoi, "junctionless": junctionless, "vtfet": vtfet,
    "tfet": tfet, "ncfet": ncfet, "flash_fg": flash_fg, "nand3d": nand3d, "set_transistor": set_transistor,
}


def write_all(out_dirs=(ROOT / "figures" / "cross_sections", ROOT / "site" / "assets" / "xsec")) -> list[Path]:
    written = []
    for out in out_dirs:
        out.mkdir(parents=True, exist_ok=True)
        for key, fn in ARCHS.items():
            p = out / f"{key}.svg"
            p.write_text(fn().svg(), encoding="utf-8")
            written.append(p)
    return written


if __name__ == "__main__":
    for p in write_all():
        print(p.relative_to(ROOT))
