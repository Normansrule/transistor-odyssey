"""Step-by-step process flow of a gate-all-around (GAA) nanosheet transistor.

Each step is drawn along the channel with the same geometry, so flipping
through the SVGs is a slow-motion movie of a 2 nm-class front end. Step list
and tool names follow published GAA flows (Loubet et al. 2017; imec and
foundry descriptions) simplified for teaching.

Run:  python -m transistor_sim.process   (writes figures/process/*.svg,
      site/assets/process/*.svg and data/process.json)
"""
from __future__ import annotations

import json
from pathlib import Path

from .crosssection import Drawing, ROOT, INK, MUTED

# Geometry (px) shared by every step
X0, X1 = 40, 500          # device window
SUB_Y = 330               # top of substrate
LAYER = 16                # sheet / SiGe thickness
N_SHEETS = 3
GX0, GX1 = 210, 330       # gate footprint
SP = 18                   # spacer width


def _stack_y(i):
    """Top y of layer i (0 = bottom SiGe) in the Si/SiGe superlattice."""
    return SUB_Y - (i + 1) * LAYER


def _base(d: Drawing, step: int):
    d.rect(X0, SUB_Y, X1 - X0, 64, "si", "Silicon wafer (p-type, 300 mm)")
    if step >= 14:
        d.rect(X0, SUB_Y + 44, X1 - X0, 20, "bspdn", "Backside power rail")


def _superlattice(d: Drawing, x0=X0, x1=X1, released=False, label=True):
    for k in range(2 * N_SHEETS):
        y = _stack_y(k)
        if k % 2 == 0:   # SiGe sacrificial
            if not released:
                d.rect(x0, y, x1 - x0, LAYER, "sige", "SiGe sacrificial layer" if (label and k == 0) else False)
        else:            # Si channel sheet
            d.rect(x0, y, x1 - x0, LAYER, "si_ch", "Si channel sheet (~5 nm)" if (label and k == 1) else False)


STEPS = [
    ("Start with a silicon wafer", "A 300 mm single-crystal silicon wafer, polished flat to a few atoms.", "Czochralski crystal growth, CMP"),
    ("Grow the Si/SiGe superlattice", "Alternating layers of silicon-germanium and silicon are grown epitaxially, three of each. The SiGe layers are placeholders that will later be etched away.", "Epitaxy (RPCVD)"),
    ("Pattern the dummy gate", "Polysilicon dummy gates are printed at the contacted gate pitch (~45 nm) with EUV lithography and etched.", "EUV lithography, plasma etch"),
    ("Add gate spacers", "A thin dielectric film is deposited conformally and etched back to leave spacers on the gate walls.", "ALD, anisotropic etch"),
    ("Etch the source/drain cavities", "The stack is etched away beside the spacers, down to the substrate.", "Plasma etch"),
    ("Indent the SiGe layers", "A selective etch recesses only the SiGe under the spacers, leaving the silicon sheets sticking out.", "Selective isotropic etch"),
    ("Form inner spacers", "Dielectric fills the indents. These inner spacers isolate the future metal gate from the source/drain.", "ALD, etch-back"),
    ("Grow source and drain", "Phosphorus-doped silicon (nFET) or boron-doped SiGe (pFET) grows epitaxially from the exposed sheet ends.", "Selective epitaxy"),
    ("Fill and planarize", "An inter-layer dielectric fills the gaps and is polished down to the top of the dummy gate.", "CVD oxide, CMP"),
    ("Remove the dummy gate", "The polysilicon placeholder is etched out, opening a trench to the superlattice.", "Wet/dry etch"),
    ("Release the nanosheets", "A highly selective etch removes the SiGe between the sheets. The silicon sheets now hang free between the source and drain.", "Selective SiGe etch"),
    ("Wrap high-k and metal gate", "HfO₂ and work-function metals coat every sheet surface, then metal fills the gaps: the gate is all around.", "ALD, CVD/PVD metal, CMP"),
    ("Contacts and wiring", "Trench contacts land on source/drain, then a dozen or more copper layers wire transistors together.", "Middle-of-line + BEOL (dual damascene)"),
    ("Optional: backside power", "The wafer is bonded to a carrier, flipped, thinned to ~µm, and power rails are built on the back (PowerVia, Super Power Rail).", "Wafer bonding, thinning, backside litho"),
]


def draw_step(step: int) -> Drawing:
    title, desc, tool = STEPS[step - 1]
    d = Drawing(f"Step {step} of {len(STEPS)} · {title}", f"{tool}. Along-channel view of one GAA transistor (not to scale).")
    _base(d, step)
    top = _stack_y(2 * N_SHEETS - 1)       # top y of stack
    if step >= 2:
        if step < 5:
            _superlattice(d)
        else:
            released = step >= 11
            _superlattice(d, GX0 - SP, GX1 + SP, released=released, label=True)
    if 3 <= step <= 9:
        d.rect(GX0, top - 70, GX1 - GX0, 70, "poly", "Dummy poly gate")
        if step <= 8:
            d.rect(GX0, top - 86, GX1 - GX0, 16, "nitride", "Hard mask")
    if step >= 4:
        d.rect(GX0 - SP, top - 70, SP, 70, "spacer", "Gate spacer")
        d.rect(GX1, top - 70, SP, 70, "spacer", False)
        if step == 4:
            d.rect(X0, top - 4, GX0 - SP - X0, 4, "spacer", False)
            d.rect(GX1 + SP, top - 4, X1 - GX1 - SP, 4, "spacer", False)
    if step >= 6:
        for k in range(0, 2 * N_SHEETS, 2):   # indents at SiGe ends
            y = _stack_y(k)
            if step >= 7:
                d.rect(GX0 - SP, y, SP, LAYER, "spacer", "Inner spacer" if k == 0 else False)
                d.rect(GX1, y, SP, LAYER, "spacer", False)
            else:
                d.rect(GX0 - SP, y, SP, LAYER, "void", False)
                d.rect(GX1, y, SP, LAYER, "void", False)
        if step == 6:
            d.labels.append((GX0 - SP / 2, _stack_y(0) + LAYER / 2, "Indent (SiGe recessed)"))
    if step >= 8:
        d.rect(X0 + 10, top - 10, GX0 - SP - X0 - 10, SUB_Y - top + 10, "n", "Epitaxial source (Si:P)")
        d.rect(GX1 + SP, top - 10, X1 - GX1 - SP - 10, SUB_Y - top + 10, "n", "Epitaxial drain")
    if step >= 9:
        d.rect(X0, top - 70, GX0 - SP - X0, 60, "oxide", "Inter-layer dielectric")
        d.rect(GX1 + SP, top - 70, X1 - GX1 - SP, 60, "oxide", False)
    if step == 10 or step == 11:
        d.rect(GX0, top - 70, GX1 - GX0, 70, "void", False)
        if step == 11:
            for k in range(0, 2 * N_SHEETS, 2):
                d.rect(GX0, _stack_y(k), GX1 - GX0, LAYER, "void", False)
            d.labels.append((GX0 + 60, _stack_y(0) + LAYER / 2, "Empty gaps (SiGe removed)"))
        else:
            d.labels.append((GX0 + 60, top - 35, "Open gate trench"))
    if step >= 12:
        d.rect(GX0, top - 70, GX1 - GX0, SUB_Y - top + 70, "metal", "Metal gate (all around)")
        for k in range(1, 2 * N_SHEETS, 2):
            y = _stack_y(k)
            d.rect(GX0, y - 3, GX1 - GX0, 3, "highk", "High-k HfO₂" if k == 1 else False)
            d.rect(GX0, y + LAYER, GX1 - GX0, 3, "highk", False)
            d.rect(GX0, y, GX1 - GX0, LAYER, "si_ch", False)
    if step >= 13:
        d.rect(80, top - 96, 60, 86, "cu", "Trench contact")
        d.rect(400, top - 96, 60, 86, "cu", False)
        for j in range(3):
            y = top - 100 - (j + 1) * 22
            d.rect(X0, y, X1 - X0, 9, "cu", "Copper wiring (BEOL)" if j == 0 else False, opacity=0.8)
            d.rect(X0, y + 9, X1 - X0, 13, "oxide", "Low-k dielectric" if j == 0 else False, opacity=0.35)
    if step == 14:
        d.rect(80, SUB_Y, 60, 44, "cu", "Backside contact")
    return d


def write_all():
    outs = [ROOT / "figures" / "process", ROOT / "site" / "assets" / "process"]
    for o in outs:
        o.mkdir(parents=True, exist_ok=True)
    meta = []
    for i in range(1, len(STEPS) + 1):
        svg = draw_step(i).svg()
        for o in outs:
            (o / f"step_{i:02d}.svg").write_text(svg, encoding="utf-8")
        t, desc, tool = STEPS[i - 1]
        meta.append({"step": i, "title": t, "detail": desc, "tool": tool, "svg": f"assets/process/step_{i:02d}.svg"})
    (ROOT / "data" / "process.json").write_text(json.dumps({"_about": "GAA nanosheet process flow (sim/transistor_sim/process.py)",
                                                           "refs": ["loubet2017", "plummer2000", "tsmc_a16", "intel_18a"],
                                                           "steps": meta}, indent=1, ensure_ascii=False), encoding="utf-8")
    return meta


if __name__ == "__main__":
    for m in write_all():
        print(m["step"], m["title"])
