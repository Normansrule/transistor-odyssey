"""Render every figure used by README.md and docs/ from the data and models.

    python sim/make_figures.py          # writes figures/*.png and figures/*.svg

All charts share one dark theme and a colour-blind-validated categorical
palette (validated with the dataviz six-check validator against #10141a).
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))

from transistor_sim import mosfet, hemt, materials, scaling, bjt, crosssection, layout  # noqa: E402

FIG = ROOT / "figures"
FIG.mkdir(exist_ok=True)

SURFACE, PAGE = "#10141a", "#0b0e12"
INK, INK2, MUTED, GRID, AXIS = "#e8ecf1", "#aab3c0", "#8a94a3", "#232a34", "#3a4350"
SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"]
RAMP = ["#86b6ef", "#5598e7", "#3987e5", "#256abf", "#1c5cab"]  # sequential blue, light -> dark

plt.rcParams.update({
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
    "axes.edgecolor": AXIS, "axes.labelcolor": INK2, "axes.titlecolor": INK,
    "xtick.color": MUTED, "ytick.color": MUTED, "text.color": INK,
    "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.8, "grid.linestyle": "-",
    "axes.spines.top": False, "axes.spines.right": False,
    "font.family": ["DejaVu Sans"], "font.size": 10.5, "axes.titlesize": 13, "axes.titleweight": "semibold",
    "axes.titlelocation": "left", "axes.titlepad": 24, "legend.frameon": False, "legend.labelcolor": INK2,
    "lines.linewidth": 2, "lines.solid_capstyle": "round", "lines.solid_joinstyle": "round",
})


def save(fig, name):
    for ext in ("png", "svg"):
        fig.savefig(FIG / f"{name}.{ext}", dpi=160, bbox_inches="tight", pad_inches=0.25)
    plt.close(fig)
    print("figures/" + name + ".png")


def subtitle(ax, text):
    ax.text(0, 1.012, text, transform=ax.transAxes, color=MUTED, fontsize=9.5, va="bottom")


def num(v):
    if v in (None, ""):
        return None
    m = re.search(r"[\d.]+", str(v))
    return float(m.group()) if m else None


# ---------------------------------------------------------------------------
def fig_moore():
    chips = scaling.load_chips()
    dt, slope, icpt = scaling.moore_fit(chips)
    fig, ax = plt.subplots(figsize=(10, 5.8))
    fams = [("planar", "Planar silicon", SERIES[0]), ("3d", "FinFET / GAA / stacked silicon", SERIES[1]),
            ("beyond", "Beyond-silicon research (CNT, MoS₂)", SERIES[2])]
    for fam, label, c in fams:
        pts = [(ch["year"], ch["transistors"]) for ch in chips if ch["family"] == fam]
        ax.scatter(*zip(*pts), s=46, color=c, edgecolor=SURFACE, linewidth=2, zorder=3, label=label)
    yrs = np.array([1970, 2027])
    ax.plot(yrs, 2 ** (slope * yrs + icpt), color=MUTED, lw=1.2, zorder=2)
    ax.text(2008, 2 ** (slope * 2008 + icpt) * 0.06, f"fit: doubling every {dt:.2f} years", color=INK2, fontsize=9.5, rotation=0)
    ax.set_yscale("log")
    ax.set_ylim(40, 2e13)
    ax.set_xlim(1969, 2028)
    ax.set_ylabel("Transistors per chip")
    for cid, dx, dy in (("i4004", 1, 0.5), ("i80486", -2, 3), ("ivy", -9, 1.5), ("m1max", -10, 1), ("b200", -9, 2),
                        ("wse3", -16, 1.2), ("ibm07", -2.5, 12), ("wuji", -4, 0.04), ("rv16x", -16, 3), ("cnt2013", -14, 0.9)):
        ch = next(c for c in chips if c["id"] == cid)
        ax.annotate(ch["name"], (ch["year"], ch["transistors"]), xytext=(ch["year"] + dx, ch["transistors"] * dy),
                    color=INK2, fontsize=8.5, arrowprops=dict(arrowstyle="-", color=MUTED, lw=0.8))
    ax.set_title("Transistors per chip, 1971–2026")
    subtitle(ax, "Log scale. Production chips follow Moore's law; 2D and nanotube processors restart the curve at thousands.")
    ax.legend(loc="upper left")
    save(fig, "moores_law")


def fig_node_vs_pitch():
    rows = list(csv.DictReader(open(ROOT / "data" / "nodes.csv", encoding="utf-8")))
    fig, ax = plt.subplots(figsize=(10, 5.4))
    series = [("node_nm", "Node name", SERIES[0]), ("cpp_nm", "Contacted gate pitch", SERIES[1]),
              ("mmp_nm", "Minimum metal pitch", SERIES[2])]
    for key, label, c in series:
        pts = [(int(r["year"]), num(r[key])) for r in rows if num(r[key]) and "research" not in r["node_label"] and "MoS2" not in r["node_label"]]
        xs, ys = zip(*pts)
        ax.plot(xs, ys, color=c, marker="o", ms=5, mec=SURFACE, mew=1.5, label=label)
        ax.text(xs[-1] + 0.6, ys[-1], label, color=INK2, fontsize=9, va="center")
    ax.scatter([2026], [0.7], color=SERIES[0], s=46, marker="o", facecolor=SURFACE, lw=2, zorder=4)
    ax.annotate("IBM 0.7 nm research node", (2026, 0.7), xytext=(2010, 0.35), color=INK2, fontsize=9,
                arrowprops=dict(arrowstyle="-", color=MUTED, lw=0.8))
    ax.axhline(0.543, color=MUTED, lw=1)
    ax.text(1972, 0.6, "silicon lattice constant 0.543 nm", color=MUTED, fontsize=8.5)
    ax.set_yscale("log"); ax.set_ylim(0.25, 20000); ax.set_xlim(1969, 2034)
    ax.set_ylabel("nanometres")
    ax.set_title("The node name stopped being a physical length")
    subtitle(ax, "Until the 1990s the label matched the gate. After 2010, gate and metal pitches level off near 45 nm and 20 nm while the label keeps shrinking.")
    ax.legend(loc="upper right")
    save(fig, "node_vs_pitch")


def fig_iv_families():
    keys = ["1985_1p5um_cmos", "2007_45nm_hkmg", "2011_22nm_finfet", "2026_mos2_2d"]
    fig, axes = plt.subplots(2, 2, figsize=(10, 7.2))
    for ax, k in zip(axes.flat, keys):
        p = mosfet.PRESETS[k]
        vds, vgs_list, fam = mosfet.output_family(p, steps=5)
        for i, (vg, ids) in enumerate(zip(vgs_list, fam)):
            ax.plot(vds, ids * 1e6, color=RAMP[i])
            ax.text(vds[-1] * 1.01, ids[-1] * 1e6, f"{vg:.2g} V", color=INK2, fontsize=8, va="center")
        ax.set_title(p.name, fontsize=11)
        ax.set_xlim(0, p.VDD * 1.16)
        ax.set_xlabel("V_DS (V)"); ax.set_ylabel("I_D (µA/µm)")
    fig.suptitle("Output characteristics from the compact model", x=0.02, ha="left", color=INK, fontsize=13, weight="semibold")
    fig.text(0.02, 0.945, "Curves labelled with V_GS. Short-channel devices saturate early (velocity saturation) and tilt (DIBL, CLM).", color=MUTED, fontsize=9.5)
    fig.tight_layout(rect=(0, 0, 1, 0.93))
    save(fig, "iv_families")


def fig_transfer():
    keys = [("2007_45nm_hkmg", SERIES[0]), ("2011_22nm_finfet", SERIES[1]), ("2025_2nm_gaa", SERIES[2]), ("2026_mos2_2d", SERIES[3])]
    fig, ax = plt.subplots(figsize=(10, 5.6))
    for k, c in keys:
        p = mosfet.PRESETS[k]
        m = mosfet.metrics(p)
        vgs = np.linspace(-0.2, p.VDD, 300)
        ids = mosfet.drain_current(p, vgs, p.VDD)
        ax.plot(vgs - p.VT0, ids * 1e6, color=c, label=f"{p.name} — SS {m['SS_mV_dec']:.0f} mV/dec")
    x = np.linspace(-0.45, -0.05, 2)
    ax.plot(x, 1e-2 * 10 ** ((x + 0.45) / 0.0595), color=MUTED, lw=1)
    ax.text(-0.44, 3e-2, "60 mV/dec Boltzmann limit", color=MUTED, fontsize=9)
    ax.set_yscale("log"); ax.set_ylim(1e-4, 5e3); ax.set_xlim(-0.5, 0.8)
    ax.set_xlabel("V_GS − V_T (V)"); ax.set_ylabel("I_D at V_DS = V_DD (µA/µm)")
    ax.set_title("Turning a transistor off: subthreshold swing by structure")
    subtitle(ax, "Wrapping the gate around the channel (FinFET, GAA) or thinning it to one molecule (MoS₂) steepens the off-to-on slope.")
    ax.legend(loc="lower right")
    save(fig, "transfer_log")


def fig_vtc():
    keys = [("1985_1p5um_cmos", SERIES[0]), ("1999_180nm", SERIES[1]), ("2011_22nm_finfet", SERIES[2]), ("2025_2nm_gaa", SERIES[3])]
    fig, ax = plt.subplots(figsize=(7.5, 5.6))
    for k, c in keys:
        p = mosfet.PRESETS[k]
        vin, vout = mosfet.cmos_inverter_vtc(p, n_points=161)
        ax.plot(vin / p.VDD, vout / p.VDD, color=c, label=f"{p.name} (V_DD = {p.VDD:g} V)")
    ax.set_xlabel("V_in / V_DD"); ax.set_ylabel("V_out / V_DD")
    ax.set_title("CMOS inverter transfer curves")
    subtitle(ax, "Normalised to supply. Lower V_DD with high DIBL softens the switching edge; better gate control restores it.")
    ax.legend(loc="lower left", fontsize=9)
    save(fig, "inverter_vtc")


def fig_hemt():
    x = np.linspace(0.1, 0.45, 200)
    fig, ax = plt.subplots(figsize=(9, 5.2))
    for d, c in ((10, SERIES[0]), (20, SERIES[1]), (30, SERIES[2])):
        ns = hemt.sheet_density(x, d)
        ax.plot(x, ns / 1e13, color=c, label=f"barrier {d} nm")
        ax.text(x[-1] + 0.005, ns[-1] / 1e13, f"{d} nm", color=INK2, fontsize=9, va="center")
    ax.set_xlabel("Al fraction x in AlₓGa₁₋ₓN"); ax.set_ylabel("2DEG density (10¹³ cm⁻²)")
    ax.set_xlim(0.1, 0.5)
    ax.set_title("GaN makes its own channel: polarization-induced 2DEG")
    subtitle(ax, "Ambacher et al. (1999, 2000) model. No dopants: the charge comes from spontaneous + piezoelectric polarization.")
    ax.legend(loc="upper left")
    save(fig, "hemt_2deg")


def fig_bfom():
    rows = [r for r in materials.normalised_table() if r["BFOM_rel_Si"]]
    rows.sort(key=lambda r: r["BFOM_rel_Si"])
    fig, ax = plt.subplots(figsize=(9, 4.8))
    y = np.arange(len(rows))
    ax.barh(y, [r["BFOM_rel_Si"] for r in rows], height=0.55, color=SERIES[0])
    ax.set_yticks(y, [r["name"] for r in rows])
    ax.set_xscale("log"); ax.grid(axis="y", visible=False)
    for yi, r in zip(y, rows):
        ax.text(r["BFOM_rel_Si"] * 1.15, yi, f"{r['BFOM_rel_Si']:,.3g}×", va="center", color=INK2, fontsize=9)
    ax.set_xlim(0.05, 3e5)
    ax.set_xlabel("Baliga figure of merit, relative to silicon (ε·µ·E_c³)")
    ax.set_title("Why power electronics left silicon")
    subtitle(ax, "Higher is lower conduction loss at the same blocking voltage. Computed from data/materials.json.")
    save(fig, "materials_bfom")


def fig_gap_field():
    mats = [m for m in materials.load_materials() if m.get("Ec_MVcm")]
    fig, ax = plt.subplots(figsize=(9, 5.2))
    ax.scatter([m["Eg_eV"] for m in mats], [m["Ec_MVcm"] for m in mats], s=[20 + 12 * m["k_WcmK"] for m in mats],
               color=SERIES[0], edgecolor=SURFACE, linewidth=2, zorder=3)
    for m in mats:
        ax.text(m["Eg_eV"] + 0.12, m["Ec_MVcm"] * 1.06, m["formula"], color=INK2, fontsize=9.5)
    g = np.linspace(0.5, 6, 50)
    ax.plot(g, 0.2 * g ** 2.0, color=MUTED, lw=1)
    ax.text(3.6, 1.1, "E_c ≈ 0.2·E_g² trend", color=MUTED, fontsize=9)
    ax.set_yscale("log"); ax.set_xlim(0, 6.3); ax.set_ylim(0.05, 20)
    ax.set_xlabel("Bandgap (eV)"); ax.set_ylabel("Critical field (MV/cm)")
    ax.set_title("Wider bandgap, higher breakdown field")
    subtitle(ax, "Marker area scales with thermal conductivity. Diamond leads on every axis but is hardest to dope and grow.")
    save(fig, "bandgap_vs_field")


def fig_litho():
    steps = [(1965, 436, "contact / g-line 436 nm"), (1985, 365, "i-line 365 nm"), (1995, 248, "KrF 248 nm"),
             (2001, 193, "ArF 193 nm"), (2007, 134, "ArF immersion (193/1.44 ≈ 134 nm effective)"), (2019, 13.5, "EUV 13.5 nm"),
             (2025, 13.5, "High-NA EUV (NA 0.55)")]
    fig, ax = plt.subplots(figsize=(10, 4.8))
    xs = [s[0] for s in steps] + [2027]
    ys = [s[1] for s in steps] + [13.5]
    ax.step(xs, ys, where="post", color=SERIES[0])
    for x, y, t in steps:
        ax.scatter([x], [y], color=SERIES[0], s=36, edgecolor=SURFACE, lw=2, zorder=3)
        ax.text(x + 0.4, y * 1.13, t, color=INK2, fontsize=8.8)
    ax.set_yscale("log"); ax.set_ylim(8, 700); ax.set_xlim(1962, 2029)
    ax.set_ylabel("Exposure wavelength (nm)")
    ax.set_title("Printing smaller: lithography wavelength by era")
    subtitle(ax, "Resolution ≈ k₁·λ/NA. Immersion raised NA above 1; EUV cut λ fourteen-fold; High-NA raises NA from 0.33 to 0.55.")
    save(fig, "lithography")


def fig_dennard():
    rows = list(csv.DictReader(open(ROOT / "data" / "nodes.csv", encoding="utf-8")))
    v = [(int(r["year"]), float(r["vdd_v"])) for r in rows if r["vdd_v"] and "research" not in r["node_label"] and "MoS2" not in r["node_label"]]
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4.6))
    a1.plot(*zip(*v), color=SERIES[0], marker="o", ms=4, mec=SURFACE)
    a1.set_yscale("log"); a1.set_ylabel("Supply voltage (V)"); a1.set_title("Supply voltage", fontsize=11)
    c = scaling.CLOCK_MHZ
    a2.plot(*zip(*c), color=SERIES[0], marker="o", ms=4, mec=SURFACE)
    a2.set_yscale("log"); a2.set_ylabel("Top desktop clock (MHz)"); a2.set_title("Clock frequency", fontsize=11)
    for a in (a1, a2):
        a.axvspan(2004, 2026, color=SERIES[1], alpha=0.08, lw=0)
        a.text(2005, a.get_ylim()[1] * 0.6, "post-Dennard", color=INK2, fontsize=9)
    fig.suptitle("Dennard scaling ends around 2005", x=0.02, ha="left", fontsize=13, weight="semibold")
    fig.text(0.02, 0.9, "Voltage stalls near 1 V because threshold voltage cannot drop without exponential leakage; clocks stall with it.", color=MUTED, fontsize=9.5)
    fig.tight_layout(rect=(0, 0, 1, 0.88))
    save(fig, "dennard_breakdown")


def fig_gummel():
    vbe, ic, ib = bjt.gummel()
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.plot(vbe, ic, color=SERIES[0], label="Collector current I_C")
    ax.plot(vbe, ib, color=SERIES[1], label="Base current I_B")
    ax.text(vbe[-1] + 0.01, ic[-1], "I_C", color=INK2, va="center"); ax.text(vbe[-1] + 0.01, ib[-1], "I_B", color=INK2, va="center")
    ax.set_yscale("log"); ax.set_ylim(1e-13, 1e-1)
    ax.set_xlabel("V_BE (V)"); ax.set_ylabel("Current (A)")
    ax.set_title("Gummel plot of a junction transistor")
    subtitle(ax, "I_C rises one decade per 60 mV: the same Boltzmann limit that caps MOSFET subthreshold swing.")
    ax.legend(loc="lower right")
    save(fig, "gummel")


def export_model_json():
    """Model parameters + metrics for the website's live device lab."""
    out = {k: {**p.as_dict(), "metrics": mosfet.metrics(p)} for k, p in mosfet.PRESETS.items()}
    (ROOT / "data" / "model_presets.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print("data/model_presets.json")


if __name__ == "__main__":
    crosssection.write_all()
    layout.write_all()
    for f in (fig_moore, fig_node_vs_pitch, fig_iv_families, fig_transfer, fig_vtc, fig_hemt,
              fig_bfom, fig_gap_field, fig_litho, fig_dennard, fig_gummel):
        f()
    export_model_json()
