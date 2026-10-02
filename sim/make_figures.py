"""Render every figure used by README.md and docs/ from the data and models.

    python sim/make_figures.py          # writes figures/*.png and figures/*.svg

All charts share one dark theme and a colour-blind-validated categorical
palette (validated with the dataviz six-check validator against #10141a).
"""
from __future__ import annotations

import csv
import math
import json
import re
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker
import matplotlib.patches
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))

from transistor_sim import mosfet, hemt, materials, scaling, bjt, crosssection, layout, dopants, steep, process  # noqa: E402
from transistor_sim.physics import carriers, junction, moscap, tunnel, poisson2d, montecarlo, crystal  # noqa: E402
from transistor_sim.physics import bandstructure, qwell, chargesheet, thermal, litho, hetero, inverter, ballistic, interconnect  # noqa: E402
from transistor_sim import bandatlas  # noqa: E402

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
    "font.family": ["DejaVu Sans"], "font.size": 10.5, "axes.titlesize": 13, "axes.titleweight": "bold",
    "axes.titlelocation": "left", "axes.titlepad": 24, "legend.frameon": False, "legend.labelcolor": INK2,
    "lines.linewidth": 2, "lines.solid_capstyle": "round", "lines.solid_joinstyle": "round",
    "svg.hashsalt": "transistor-odyssey",  # stable SVG ids so regenerating does not churn git
})


def save(fig, name):
    for ext in ("png", "svg"):
        meta = {"Date": None} if ext == "svg" else {"Software": None}
        fig.savefig(FIG / f"{name}.{ext}", dpi=160, bbox_inches="tight", pad_inches=0.25, metadata=meta)
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
    fig.suptitle("Output characteristics from the compact model", x=0.02, ha="left", color=INK, fontsize=13, weight="bold")
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
    fig.suptitle("Dennard scaling ends around 2005", x=0.02, ha="left", fontsize=13, weight="bold")
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


def fig_ionization():
    T = np.linspace(150, 900, 300)
    keys = [("Si:B", SERIES[0]), ("SiC:Al", SERIES[1]), ("GaN:Mg", SERIES[2]), ("C:B", SERIES[3]), ("C:P", SERIES[4])]
    fig, ax = plt.subplots(figsize=(10, 5.4))
    for k, c in keys:
        d = dopants.DOPANTS[k]
        f = dopants.ionized_fraction(d, 1e17, T) * 100
        ax.plot(T, f, color=c, label=f"{d.label} (E = {d.Ea_eV} eV)")
    ax.axvline(300, color=MUTED, lw=1)
    ax.text(305, 2e-4, "room temperature", color=MUTED, fontsize=9)
    ax.set_yscale("log"); ax.set_ylim(1e-4, 150); ax.set_xlim(150, 900)
    ax.set_xlabel("Temperature (K)"); ax.set_ylabel("Dopants ionized (%)")
    ax.set_title("Why diamond is hard to dope")
    subtitle(ax, "Acceptor/donor ionization at 10¹⁷ cm⁻³. Boron in diamond is ~0.5% ionized at 300 K; phosphorus ~0.04%.")
    ax.legend(loc="lower right", fontsize=9)
    save(fig, "dopant_ionization")


def fig_steep():
    fig, ax = plt.subplots(figsize=(10, 5.6))
    v = np.linspace(0, 0.8, 600)
    ideal = mosfet.preset("2011_22nm_finfet", n=1.0, eta=0.0, VT0=0.3, Rs_ohm_um=0)
    ax.plot(v, mosfet.drain_current(ideal, v, 0.5), color=SERIES[0], label="Ideal MOSFET (n = 1): 59.5 mV/dec floor")
    nc = mosfet.preset("2011_22nm_finfet", n=0.8, eta=0.0, VT0=0.3, Rs_ohm_um=0)
    ax.plot(v, mosfet.drain_current(nc, v, 0.5), color=SERIES[1], label="Negative-capacitance FET, idealized (n = 0.8)")
    it = steep.tfet_current(v)
    ax.plot(v, it, color=SERIES[2], label=f"Tunnel FET (Kane model): min SS {steep.min_swing(v, it):.0f} mV/dec")
    ax.set_yscale("log"); ax.set_ylim(1e-15, 1e-2); ax.set_xlim(0, 0.8)
    ax.set_xlabel("V_GS (V)"); ax.set_ylabel("I_D (A/µm), V_DS = 0.5 V")
    ax.set_title("Beating 60 mV/decade")
    subtitle(ax, "Tunnel FETs switch steeply at low current but deliver far less on-current; NC-FETs amplify the gate voltage.")
    ax.legend(loc="lower right", fontsize=9)
    save(fig, "steep_slope")


def export_model_json():
    """Model parameters + metrics for the website's live device lab."""
    out = {k: {**p.as_dict(), "metrics": mosfet.metrics(p)} for k, p in mosfet.PRESETS.items()}
    (ROOT / "data" / "model_presets.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print("data/model_presets.json")
    dp = {k: {"label": d.label, "host": d.host, "kind": d.kind, "Ea_eV": d.Ea_eV, "N_eff_300": d.N_eff_300, "g": d.g, "ref": d.ref}
          for k, d in dopants.DOPANTS.items()}
    (ROOT / "data" / "dopants.json").write_text(json.dumps(dp, indent=1, ensure_ascii=False), encoding="utf-8")
    print("data/dopants.json")


# --- semiconductor physics (sim/transistor_sim/physics) ----------------------
def fig_intrinsic():
    fig, ax = plt.subplots(figsize=(10, 5.6))
    T = np.linspace(200, 900, 200)
    for i, m in enumerate(["Ge", "Si", "GaAs", "4H-SiC", "GaN", "Diamond"]):
        ni = [carriers.intrinsic_density(m, t) for t in T]
        ax.plot(1000 / T, ni, color=SERIES[i], label=m)
    ax.axhline(1e15, color=MUTED, lw=1, ls="--")
    ax.text(1.18, 2.2e15, "typical background doping: above this line the device stops working", color=INK2, fontsize=9)
    ax.set_yscale("log"); ax.set_ylim(1e-10, 1e19); ax.set_xlim(1.1, 5)
    ax.set_xlabel("1000 / T (1/K)   ← hotter"); ax.set_ylabel("intrinsic density n_i (cm⁻³)")
    ax.set_title("Why wide band gaps survive heat")
    subtitle(ax, "n_i = √(Nc Nv) exp(−Eg/2kT) with Varshni Eg(T). Silicon reaches 10¹⁵ cm⁻³ near 560 K; GaN, SiC and diamond never do here.")
    ax.legend(loc="lower left", fontsize=9, ncol=3)
    save(fig, "intrinsic_density")


def fig_pn():
    fig, axs = plt.subplots(3, 1, figsize=(10, 8.4), sharex=True, gridspec_kw=dict(hspace=0.25))
    for V, c, lab in [(0.0, SERIES[0], "0 V (equilibrium)"), (-2.0, SERIES[1], "−2 V (reverse)")]:
        sj = junction.solve(1e16, 5e16, V)
        x = sj["x_um"]
        axs[0].plot(x, sj["rho"] / 1.602e-19 / 1e16, color=c, label=lab)
        axs[1].plot(x, -sj["E"] / 1e3, color=c)
        Eg = carriers.band_gap("Si")
        Ec = 0.5 - sj["psi"]
        axs[2].plot(x, Ec, color=c); axs[2].plot(x, Ec - Eg, color=c, alpha=0.7)
    axs[0].set_ylabel("ρ / q (10¹⁶ cm⁻³)"); axs[1].set_ylabel("|E| (kV/cm)"); axs[2].set_ylabel("energy (eV)")
    axs[2].set_xlabel("position (µm), p side left, n side right")
    axs[0].legend(loc="upper left", fontsize=9)
    axs[0].set_title("Abrupt pn junction, depletion approximation")
    subtitle(axs[0], "Na = 10¹⁶, Nd = 5×10¹⁶ cm⁻³. Charge → field → band bending; reverse bias widens the depletion region.")
    save(fig, "pn_junction")


def fig_cv():
    fig, ax = plt.subplots(figsize=(10, 5.6))
    for i, t in enumerate([10, 5, 2]):
        p = moscap.params(Na=1e17, tox_nm=t, Vfb=-0.9)
        cv = moscap.cv_curves(p, -3, 3)
        ax.plot(cv["Vg"], cv["C_lf"], color=SERIES[i], label=f"t_ox = {t} nm, low frequency")
        ax.plot(cv["Vg"], cv["C_hf"], color=SERIES[i], ls="--", label=f"t_ox = {t} nm, high frequency")
    ax.set_xlabel("gate voltage V_G (V)"); ax.set_ylabel("C / C_ox"); ax.set_ylim(0, 1.05)
    ax.set_title("MOS capacitor C–V")
    subtitle(ax, "Exact surface-charge solution, p-Si 10¹⁷ cm⁻³. Accumulation → depletion → inversion; minority carriers can't follow at high frequency.")
    ax.legend(loc="center right", fontsize=8.5, bbox_to_anchor=(1.0, 0.52))
    save(fig, "mos_cv")


def fig_leakage():
    fig, ax = plt.subplots(figsize=(10, 5.6))
    eot = np.linspace(0.6, 2.2, 41)
    ax.plot(eot, tunnel.leakage_vs_eot(eot, "SiO2"), color=SERIES[0], label="SiO₂")
    ax.plot(eot, tunnel.leakage_vs_eot(eot, "Si3N4"), color=SERIES[3], label="Si₃N₄")
    ax.plot(eot, tunnel.leakage_vs_eot(eot, "HfO2", il_nm=0.5), color=SERIES[1], label="HfO₂ on 0.5 nm SiO₂")
    ax.plot(eot, tunnel.leakage_vs_eot(eot, "HfO2"), color=SERIES[2], label="HfO₂ alone (ideal)")
    ax.set_yscale("log"); ax.set_xlabel("equivalent oxide thickness (nm)"); ax.set_ylabel("tunnelling probability at the band edge")
    ax.set_title("Why high-k arrived in 2007")
    subtitle(ax, "Transfer-matrix tunnelling through a trapezoidal barrier, V_ox = 1 V. SiO₂ leaks ~10× more per 2 Å thinner.")
    ax.legend(loc="upper right", fontsize=9)
    save(fig, "oxide_leakage")


def fig_dibl():
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 5.4), gridspec_kw=dict(wspace=0.28))
    g = poisson2d.build(L_nm=20)
    for i, vd in enumerate([0.05, 0.4, 0.8]):
        psi = poisson2d.solve(g, 0.0, vd)
        eb, ec, _ = poisson2d.barrier(g, psi)
        x = np.linspace(0, 20, g["nx"])
        a1.plot(x, ec, color=RAMP[1 + i], label=f"V_DS = {vd} V (barrier {eb:.2f} eV)")
    a1.set_xlabel("position along channel (nm)"); a1.set_ylabel("conduction band, source-referenced (eV)")
    a1.set_title("Drain pulls the barrier down"); a1.legend(fontsize=8.5, loc="lower left")
    subtitle(a1, "2D Poisson, single gate, L = 20 nm, t_Si = 6 nm")
    Ls = [14, 18, 24, 32, 45, 60]
    a2.plot(Ls, [poisson2d.dibl(L) for L in Ls], "o-", color=SERIES[0], label="single gate (UTB SOI)")
    a2.plot(Ls, [poisson2d.dibl(L, True) for L in Ls], "o-", color=SERIES[1], label="double gate (FinFET-like)")
    a2.set_yscale("log"); a2.set_xlabel("gate length (nm)"); a2.set_ylabel("DIBL (mV/V)")
    a2.set_title("Two gates beat one"); a2.legend(fontsize=9)
    subtitle(a2, "Same body and oxide; a second gate shrinks λ by √2")
    save(fig, "dibl_2d")


def fig_montecarlo():
    fig, ax = plt.subplots(figsize=(10, 5.6))
    F = np.logspace(2.5, 5.5, 13)
    v = [montecarlo.simulate(f, n=1500, t_ps=3)["v_cm_s"] for f in F]
    Fs = np.logspace(2.5, 5.5, 200)
    ax.plot(Fs, montecarlo.caughey_thomas(Fs), color=MUTED, lw=1.4, label="measured fit (Canali 1975)")
    ax.plot(F, v, "o", color=SERIES[0], label="ensemble Monte Carlo (this repo)")
    ax.plot(Fs, 1400 * Fs, color=SERIES[3], lw=1, ls="--", label="µ = 1400 cm²/V·s")
    ax.set_xscale("log"); ax.set_yscale("log"); ax.set_ylim(3e5, 3e7)
    ax.set_xlabel("electric field (V/cm)"); ax.set_ylabel("drift velocity (cm/s)")
    ax.set_title("Velocity saturation in silicon")
    subtitle(ax, "Acoustic + optical-phonon scattering, non-parabolic band. Hot electrons shed energy as 63 meV phonons.")
    ax.legend(loc="lower right", fontsize=9)
    save(fig, "velocity_saturation")


def fig_kronig_penney():
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 5.4), gridspec_kw=dict(wspace=0.25, width_ratios=[1, 1.1]))
    a, b = 0.5, 0.2
    Ezb = (bandstructure.HBAR * math.pi / ((a + b) * 1e-9)) ** 2 / (2 * bandstructure.M0) / bandstructure.QE
    for i, V0 in enumerate([0.0, 1.0, 3.0]):
        r = bandstructure.bands(V0, a, b, 1.0, Emax=6 * Ezb, n=3000)
        a1.plot(r["kd"], r["E"], ".", ms=1.6, color=SERIES[i], label=f"V₀ = {V0:g} eV")
    a1.set_xlim(0, 1); a1.set_ylim(0, 6 * Ezb)
    a1.set_xlabel("wavevector k (units of π/d)"); a1.set_ylabel("energy (eV)")
    a1.set_title("Bands and gaps from a periodic potential")
    a1.legend(loc="upper left", fontsize=9, markerscale=6, frameon=True, facecolor=SURFACE, edgecolor=GRID, framealpha=1)
    subtitle(a1, "Kronig–Penney, a = 0.5 nm wells, b = 0.2 nm barriers")
    V = np.linspace(0.05, 5, 40)
    a2.plot(V, [bandstructure.gaps(v, a, b)[0][1] - bandstructure.gaps(v, a, b)[0][0] for v in V], color=SERIES[0], label="first gap (exact)")
    a2.plot(V, [bandstructure.nfe_first_gap(v, a, b) for v in V], color=MUTED, ls="--", label="2|V₁| (weak-potential theory)")
    a2.plot(V, [bandstructure.effective_mass(v, a, b)[0] for v in V], color=SERIES[3], label="band-1 effective mass m*/m")
    a2.set_xlabel("barrier height V₀ (eV)"); a2.set_title("Stronger crystal, wider gap, heavier electron")
    subtitle(a2, "Weak-potential theory holds only while V₀ is small")
    a2.legend(fontsize=9, loc="upper left")
    save(fig, "kronig_penney")


def fig_2deg():
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12.5, 5.4), gridspec_kw=dict(wspace=0.42))
    r = qwell.hemt_sp(0.25, 20.0)
    a1.plot(r["z_nm"], r["Ec"], color=INK2, lw=2)
    a1.axhline(0, color=SERIES[3], ls="--", lw=1.2); a1.text(48, 0.05, "E_F", color=SERIES[3], ha="right")
    sel = (r["z_nm"] > 17) & (r["z_nm"] < 42)
    for k in range(3):
        psi = r["psi"][k]; a1.plot(r["z_nm"][sel], r["E"][k] + psi[sel] / np.abs(psi).max() * 0.12, color=SERIES[k], lw=1.6, label=f"E{k} = {r['E'][k] * 1000:.0f} meV")
    ax2 = a1.twinx(); ax2.fill_between(r["z_nm"], r["n"] / 1e19, color=SERIES[0], alpha=0.25, lw=0); ax2.set_ylabel("electron density (10¹⁹ cm⁻³)", color=INK2); ax2.grid(False)
    a1.axvspan(0, 20, color="#7fd3d0", alpha=0.06); a1.set_ylim(-0.4, 1.4); a1.set_xlim(0, 50)
    a1.set_xlabel("depth below the gate (nm)"); a1.set_ylabel("energy relative to E_F (eV)")
    a1.set_title("AlGaN/GaN two-dimensional electron gas"); a1.legend(fontsize=9, loc="upper right")
    subtitle(a1, f"Self-consistent, Al₀.₂₅Ga₀.₇₅N 20 nm: n_s = {r['ns'] / 1e13:.2f}×10¹³ cm⁻²")
    d = [4, 6, 8, 10, 13, 16, 20, 25, 30, 35, 40]
    for i, x in enumerate([0.15, 0.25, 0.35]):
        a2.plot(d, [qwell.hemt_sp(x, dd)["ns"] / 1e13 for dd in d], "o-", ms=4, color=SERIES[i], label=f"x = {x:.2f}, self-consistent")
        a2.plot(d, [float(hemt.sheet_density(x, dd)) / 1e13 for dd in d], "--", color=SERIES[i], lw=1, alpha=0.7)
    a2.set_xlabel("AlGaN thickness d (nm)"); a2.set_ylabel("n_s (10¹³ cm⁻²)"); a2.set_title("Sheet density vs barrier")
    subtitle(a2, "dashed: Ambacher analytic formula"); a2.legend(fontsize=9)
    save(fig, "gan_2deg")


def fig_chargesheet():
    p = chargesheet.params()
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 5.2), gridspec_kw=dict(wspace=0.28))
    vd = np.linspace(0, 1.5, 61)
    for i, vg in enumerate([0.6, 0.8, 1.0, 1.2, 1.4]):
        a1.plot(vd, [chargesheet.drain_current(vg, v, p) * 1e6 for v in vd], color=RAMP[i], label=f"V_GS = {vg} V")
    a1.set_xlabel("V_DS (V)"); a1.set_ylabel("I_D (µA/µm)"); a1.set_title("Charge-sheet MOSFET: output"); a1.legend(fontsize=9)
    subtitle(a1, "Long channel, N_A = 3×10¹⁷ cm⁻³, t_ox = 2 nm, µ = 300 cm²/V·s")
    vg = np.linspace(0, 1.5, 151)
    for i, v in enumerate([0.05, 1.0]):
        a2.plot(vg, [max(chargesheet.drain_current(g, v, p), 1e-15) for g in vg], color=SERIES[i], label=f"V_DS = {v} V")
    a2.set_yscale("log"); a2.set_ylim(1e-13, 1e-3); a2.axvline(p["Vt"], color=MUTED, ls=":", lw=1)
    a2.set_xlabel("V_GS (V)"); a2.set_ylabel("I_D (A/µm)"); a2.set_title("Transfer"); a2.legend(fontsize=9)
    subtitle(a2, f"Subthreshold swing {chargesheet.swing(p):.0f} mV/dec: diffusion below V_T, drift above")
    save(fig, "charge_sheet_mosfet")


def fig_thermal():
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 5.2), gridspec_kw=dict(wspace=0.28))
    subs = ["Sapphire", "Si", "SiC", "Diamond"]; cols = [MUTED, SERIES[0], SERIES[3], "#7fd3d0"]
    P = np.linspace(1, 12, 12)
    for s, c in zip(subs, cols):
        r = thermal.peak_rise(s, 1.0)[0]
        a1.plot(P, r * P, color=c, label=s)
    a1.axhline(150, color=SERIES[1], ls="--", lw=1); a1.text(1.2, 158, "≈175 °C channel from a 27 °C sink", color=SERIES[1], fontsize=9)
    a1.set_xlabel("dissipated power (W/mm)"); a1.set_ylabel("peak temperature rise (K)"); a1.set_ylim(0, 400)
    a1.set_title("GaN hot spot vs substrate"); a1.legend(fontsize=9); subtitle(a1, "2D heat conduction, 1 µm heater, 2 µm GaN, 100 µm substrate, constant k")
    tb = np.linspace(0, 60, 13)
    a2.plot(tb, [thermal.peak_rise("Diamond", 5.0, tbr_m2K_GW=t)[0] for t in tb], color="#7fd3d0", label="GaN on diamond")
    a2.plot(tb, [thermal.peak_rise("SiC", 5.0, tbr_m2K_GW=t)[0] for t in tb], color=SERIES[3], label="GaN on SiC")
    a2.set_xlabel("thermal boundary resistance (m²K/GW)"); a2.set_ylabel("peak ΔT at 5 W/mm (K)")
    a2.set_title("The interface can erase diamond's advantage"); a2.legend(fontsize=9)
    subtitle(a2, "A 20-nm-thin interlayer, modelled as k = t / TBR")
    save(fig, "gan_self_heating")


def fig_litho():
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 5.2), gridspec_kw=dict(wspace=0.28))
    lam, NA = 193.0, 1.35
    ps = np.geomspace(60, 400, 90)
    for kind, kw, c, lab in [("coherent", {}, MUTED, "coherent"), ("conventional", dict(sigma=0.7), SERIES[0], "conventional σ = 0.7"),
                             ("dipole", dict(sigma_c=0.85, sigma_w=0.08), SERIES[1], "dipole σc = 0.85")]:
        a1.plot(ps, [litho.contrast(litho.aerial_image(p, lam, NA, kind=kind, npts=128, **kw)[1]) for p in ps], color=c, label=lab)
    for p, t in [(lam / NA, "λ/NA"), (lam / (2 * NA), "λ/2NA")]:
        a1.axvline(p, color=MUTED, ls=":", lw=1); a1.text(p * 1.02, 1.02, t, color=MUTED, fontsize=9)
    a1.set_xscale("log"); a1.set_xticks([60, 80, 100, 150, 200, 300, 400]); a1.xaxis.set_major_formatter(matplotlib.ticker.ScalarFormatter()); a1.minorticks_off()
    a1.set_ylim(0, 1.1); a1.set_xlabel("pitch (nm)"); a1.set_ylabel("aerial-image contrast")
    a1.set_title("Resolution of 193 nm immersion (NA 1.35)"); a1.legend(fontsize=9, loc="lower right")
    subtitle(a1, "Abbe imaging of equal lines and spaces")
    for i, dz in enumerate([0, 40, 80]):
        x, I = litho.aerial_image(110, lam, NA, sigma=0.7, defocus_nm=dz, npts=200)
        a2.plot(x, I, color=SERIES[i], lw=2, label=f"defocus {dz} nm (contrast {litho.contrast(I):.2f})")
    a2.axhline(0.3, color=SERIES[3], ls="--", lw=1); a2.text(218, 0.275, "resist threshold", color=SERIES[3], ha="right", fontsize=9)
    a2.set_ylim(0.1, 0.6)
    a2.set_xlabel("position on the wafer (nm)"); a2.set_ylabel("intensity (clear field = 1)"); a2.set_title("Depth of focus")
    subtitle(a2, "110 nm pitch, conventional σ = 0.7: the image washes out within ~0.1 µm"); a2.legend(fontsize=9, loc="upper right")
    save(fig, "litho_aerial")


HETERO_CASES = [("Si", "Si", -1e17, 1e17, 0.0), ("Si", "Si", -1e17, 1e17, -2.0), ("GaAs", "AlGaAs", 1e15, 2e18, 0.0),
                ("Si", "SiGe", 1e18, -1e18, 0.3), ("InAs", "C-H", 1e16, 0.0, 0.0), ("Si", "HfO2", -1e17, 0.0, 0.0)]


def export_physics_json():
    crystal.write_json(ROOT / "data" / "crystals.json")
    print("data/crystals.json")
    ref = {
        "ni": {m: carriers.intrinsic_density(m) for m in carriers.MATERIALS},
        "Eg": {m: carriers.band_gap(m) for m in carriers.MATERIALS},
        "pn": {k: junction.solve(1e16, 5e16, -1.0)[k] for k in ("Vbi", "W_um", "xn_um", "xp_um", "Emax")},
        "J0": junction.saturation_current(1e17, 1e16),
        "mos": {"Vt": moscap.threshold(moscap.params(Na=1e17, tox_nm=5)),
                "Vg_at_0.5": float(moscap.gate_voltage(0.5, moscap.params(Na=1e17, tox_nm=5)))},
        "tunnel": {"rect_0.5_1_0.5": tunnel.transfer(0.5, [1.0], [0.5])[0],
                   "sio2_1nm": float(tunnel.leakage_vs_eot([1.0], "SiO2")[0]),
                   "hfo2_1nm_il0.5": float(tunnel.leakage_vs_eot([1.0], "HfO2", il_nm=0.5)[0])},
        "dibl": {"SG20": poisson2d.dibl(20), "DG20": poisson2d.dibl(20, True)},
        "kp": {"gap1": list(bandstructure.gaps(2.0, 0.5, 0.2)[0]), "mstar": bandstructure.effective_mass(2.0, 0.5, 0.2)[0]},
        "qwell": {"E5": [float(e) for e in qwell.finite_well(5.0)["E"]], "ns_25_20": qwell.hemt_sp(0.25, 20.0)["ns"],
                  "E0_25_20": float(qwell.hemt_sp(0.25, 20.0)["E"][0])},
        "chargesheet": {f"{vg}_{vd}": chargesheet.drain_current(vg, vd, chargesheet.params()) for vg, vd in [(0.2, 0.05), (0.8, 0.1), (1.0, 1.5)]},
        "thermal": {s_: thermal.peak_rise(s_, 5.0)[0] for s_ in ("Si", "Diamond")} | {"Diamond_tbr25": thermal.peak_rise("Diamond", 5.0, tbr_m2K_GW=25)[0]},
        "atlas": {k: {"barrier_mid": bandatlas.barrier(d, 0.5 * sum(d["model"]["vg"]), 0.3 * d["model"]["vd"][1]),
                      "f_vt": bandatlas.on_fraction(d, d["model"]["vt"] + 0.1 * (d["model"]["vg"][1] - d["model"]["vg"][0])),
                      "Ec_mid": [float(v) for v in np.nan_to_num(bandatlas.lateral(d, 0.5 * sum(d["model"]["vg"]), 0.3 * d["model"]["vd"][1], n=21)["Ec"], nan=-99)],
                      "vert0": (lambda V: None if V is None else float(np.asarray(V["Ec"])[0]))(bandatlas.vertical(d, 0.5 * sum(d["model"]["vg"])))}
                  for k, d in bandatlas.load_devices().items()},
        "hetero": [(lambda r, c: {"case": c, "Ec": [float(r["Ec"][i]) for i in range(0, 601, 60)], "VA": r["VA"], "VB": r["VB"],
                                  "W_nm": r["W_nm"], "ns": r["ns"], "ps": r["ps"], "iters": r["iters"]})(
                       hetero.solve(bandatlas.alignment()[c[0]], bandatlas.alignment()[c[1]], c[2], c[3], c[4]), c)
                   for c in HETERO_CASES],
        "inverter": {k: {kk: v for kk, v in inverter.metrics(mosfet.preset(k), beta=0.6).items()} for k in ("1999_180nm", "2025_2nm_gaa")},
        "ballistic": [{"case": [ch, vg, vd, b], **{kk: ballistic.solve(ballistic.params(ch), vg, vd, b)[kk] for kk in ("eta", "ns", "I", "T")}}
                      for ch, vg, vd, b in [("Si", 0.6, 0.6, False), ("Si", 0.6, 0.6, True), ("Si", 0.1, 0.05, False), ("InGaAs", 0.5, 0.5, False), ("MoS2", 0.7, 0.3, False)]],
        "wires": {"rho": {f"{m}_{w}": interconnect.resistivity(m, w, 2 * w) for m in interconnect.METALS for w in (8, 20, 100)},
                  "r_Cu_14": interconnect.r_per_um("Cu", 14, 28), "r_Ru_14": interconnect.r_per_um("Ru", 14, 28), "c_14": interconnect.c_per_um(14, 28, 14),
                  "elmore": interconnect.elmore_delay(458.0, 1.6e-16, 100.0, 5e3, 1e-15),
                  "line": [float(v) for v in interconnect.line_step(458.0, 1.6e-16, 50.0, 2e3, 1e-15, 4e-11, nx=51, nt=200)[2][-1][::10]]},
        "litho": {"conv100": litho.contrast(litho.aerial_image(100, 193, 1.35, sigma=0.9)[1]),
                  "dip80": litho.contrast(litho.aerial_image(80, 193, 1.35, kind="dipole", sigma_c=0.89, sigma_w=0.05)[1]),
                  "def120": litho.contrast(litho.aerial_image(120, 193, 1.35, sigma=0.7, defocus_nm=80)[1])},
    }
    (ROOT / "data" / "physics_reference.json").write_text(json.dumps(ref, indent=1), encoding="utf-8")
    print("data/physics_reference.json")


# ---------------------------------------------------------------------------
# Device atlas: band diagrams for every transistor and the material line-up.
def _ends(d):
    a, b = d["model"]["vg"]
    return (a, b) if bandatlas.on_fraction(d, a) <= bandatlas.on_fraction(d, b) else (b, a)


def _lat_axes(ax, d, show_labels=True, lw=2.0):
    off_v, on_v = _ends(d)
    vd = d["model"]["vd"][1] * (0.3 if d["model"]["lateral"] == "bjt" else 0.5)
    off, on = bandatlas.lateral(d, off_v, vd), bandatlas.lateral(d, on_v, vd)
    for i, (a, b_, name) in enumerate(on["regions"]):
        if i % 2 == 1:
            ax.axvspan(a, b_, color="#ffffff", alpha=0.035, lw=0)
        if show_labels:
            ax.text((a + b_) / 2, 1.01, name, transform=ax.get_xaxis_transform(), ha="center", va="bottom", color=MUTED, fontsize=8.5)
    ax.plot(off["x"], off["Ec"], color=INK2, lw=1.2, ls="--", alpha=0.7, label="off")
    ax.plot(off["x"], off["Ev"], color=INK2, lw=1.2, ls="--", alpha=0.7)
    ax.plot(on["x"], on["Ec"], color=SERIES[0], lw=lw, label="on: E_c")
    ax.plot(on["x"], on["Ev"], color=SERIES[1], lw=lw, label="on: E_v")
    if "EF" in on:
        ax.plot(on["x"], on["EF"], color=SERIES[3], lw=1, ls=":")
    else:
        ax.plot([0, 0.3], [on["EFs"]] * 2, color=SERIES[3], lw=1, ls=":")
        ax.plot([0.7, 1], [on["EFd"]] * 2, color=SERIES[3], lw=1, ls=":")
    ax.set_xlim(0, 1); ax.set_xticks([]); ax.grid(False)
    return off_v, on_v, vd


def fig_band_atlas():
    devs = list(bandatlas.load_devices().values())
    cols = 5
    rows = math.ceil(len(devs) / cols)
    fig, axs = plt.subplots(rows, cols, figsize=(15, 2.55 * rows), gridspec_kw=dict(hspace=0.62, wspace=0.14))
    for ax, d in zip(axs.flat, devs):
        _lat_axes(ax, d, show_labels=False, lw=1.8)
        ax.set_yticks([])
        ax.set_title(f"{d['short']}  ·  {d['year']}", fontsize=10.5, pad=6)
        ax.text(0, -0.1, d["family"], transform=ax.transAxes, color=MUTED, fontsize=8, va="top")
    for ax in list(axs.flat)[len(devs):]:
        ax.axis("off")
    ax = list(axs.flat)[-1]
    ax.plot([], [], color=INK2, ls="--", lw=1.2, label="gate off"); ax.plot([], [], color=SERIES[0], label="gate on: E_c")
    ax.plot([], [], color=SERIES[1], label="gate on: E_v"); ax.plot([], [], color=SERIES[3], ls=":", lw=1, label="Fermi level")
    ax.legend(loc="center", fontsize=10)
    fig.suptitle("Band edges along the current path for all 19 devices, gate off and on", x=0.125, ha="left", fontsize=14, fontweight="bold", y=0.995)
    fig.text(0.125, 0.965, "sim/transistor_sim/bandatlas.py · source (left) → drain (right) · electron energy up", color=MUTED, fontsize=9.5)
    save(fig, "band_atlas")


def fig_band_alignment():
    mats = sorted(bandatlas.alignment().values(), key=lambda m: m["kind"] == "insulator")
    fig, ax = plt.subplots(figsize=(13, 5.6))
    for i, m in enumerate(mats):
        ec, ev = -m["chi"], -m["chi"] - m["Eg"]
        col = "#b58fd6" if m["kind"] == "insulator" else "#7fd3d0"
        ax.add_patch(matplotlib.patches.Rectangle((i - 0.34, ev), 0.68, m["Eg"], color=col, alpha=0.16, lw=0))
        ax.plot([i - 0.34, i + 0.34], [ec, ec], color=SERIES[0], lw=3)
        ax.plot([i - 0.34, i + 0.34], [ev, ev], color=SERIES[1], lw=3)
        ax.text(i, (ec + ev) / 2, f"{m['Eg']:.2g}", ha="center", va="center", color=INK2, fontsize=8.5)
    ax.axhline(0, color=INK, ls="--", lw=1, alpha=0.5); ax.text(len(mats) - 0.5, 0.15, "vacuum level", ha="right", color=MUTED, fontsize=9)
    si = bandatlas.alignment()["Si"]; ax.axhspan(-si["chi"] - si["Eg"], -si["chi"], color="#7fd3d0", alpha=0.05, lw=0)
    ins = next(i for i, m in enumerate(mats) if m["kind"] == "insulator")
    ax.axvline(ins - 0.5, color=AXIS, lw=1)
    ax.text(-0.4, 1.7, "semiconductors", color=MUTED, fontsize=9); ax.text(ins - 0.4, 1.7, "gate dielectrics", color=MUTED, fontsize=9)
    ax.set_xticks(range(len(mats))); ax.set_xticklabels([m["id"].replace("C-H", "C:H").replace("C-O", "C:O") for m in mats], rotation=40, ha="right")
    ax.set_xlim(-0.6, len(mats) - 0.4); ax.set_ylim(-10.6, 2.2); ax.grid(axis="x", visible=False)
    ax.set_ylabel("energy relative to vacuum (eV)")
    ax.set_title("Band edges of 21 transistor materials on one energy scale")
    subtitle(ax, "E_c = −χ, E_v = −χ − E_g; the number is the gap in eV; the faint strip is silicon's gap")
    save(fig, "band_alignment")


def fig_heterojunction():
    M = bandatlas.alignment()
    fig, axs = plt.subplots(1, 3, figsize=(15.5, 5.0), gridspec_kw=dict(wspace=0.34))
    panels = [
        ("Silicon pn junction, 0 V and −2 V", [("Si", "Si", -1e17, 1e17, 0.0), ("Si", "Si", -1e17, 1e17, -2.0)], 300,
         "p-Si 10¹⁷ | n-Si 10¹⁷ cm⁻³: reverse bias widens the junction"),
        ("Modulation doping: n-AlGaAs on GaAs", [("GaAs", "AlGaAs", 1e15, 2e18, 0.0)], 60,
         "electrons leave their donors and collect in the GaAs well"),
        ("Broken gap: InAs on H-terminated diamond", [("InAs", "C-H", 1e16, 0.0, 0.0)], 60,
         "diamond's valence band sits above InAs's conduction band"),
    ]
    for ax, (title, cases, span, sub) in zip(axs, panels):
        for k, c in enumerate(cases):
            r = hetero.solve(M[c[0]], M[c[1]], c[2], c[3], c[4])
            x = r["x_nm"]; sel = np.abs(x) <= span
            ls, a = ("-", 1.0) if k == 0 else ("--", 0.75)
            ax.plot(x[sel], r["Ec"][sel], color=SERIES[0], ls=ls, alpha=a, label="E_c" if k == 0 else None)
            ax.plot(x[sel], r["Ev"][sel], color=SERIES[1], ls=ls, alpha=a, label="E_v" if k == 0 else None)
            ax.plot([-span, 0], [r["EFA"], r["EFA"]], color=SERIES[3], lw=1, ls=":", alpha=a, label="E_F" if k == 0 else None)
            ax.plot([0, span], [r["EFB"], r["EFB"]], color=SERIES[3], lw=1, ls=":", alpha=a)
            if k == 1:
                ax.text(-span * 0.95, r["Ec"][sel][0] + 0.12, f"{c[4]:+g} V", color=INK2, fontsize=9)
            if c[0] == "GaAs":
                t = ax.twinx(); t.fill_between(x[sel], r["n"][sel] / 1e18, color=SERIES[0], alpha=0.16, lw=0)
                t.set_ylabel("electron density (10¹⁸ cm⁻³)", color=INK2); t.grid(False); t.set_ylim(0, None)
                ax.text(0.02, 0.04, f"sheet density ≈ {r['ns'] / 1e12:.1f}×10¹² cm⁻²", transform=ax.transAxes, color=INK2, fontsize=9)
            if c[1] == "C-H":
                ax.text(0.02, 0.04, f"electrons ≈ {r['ns'] / 1e12:.1f}, holes ≈ {r['ps'] / 1e12:.1f} ×10¹² cm⁻²", transform=ax.transAxes, color=INK2, fontsize=9)
        ax.axvline(0, color=AXIS, lw=1)
        ax.text(0.25, 0.97, cases[0][0], transform=ax.transAxes, ha="center", va="top", color=INK, fontsize=10, fontweight="bold")
        ax.text(0.75, 0.97, cases[0][1], transform=ax.transAxes, ha="center", va="top", color=INK, fontsize=10, fontweight="bold")
        if cases[0][0] == "GaAs":
            ax.set_ylim(-0.3, 0.4); ax.text(0.98, 0.12, "E_v below, off scale", transform=ax.transAxes, ha="right", color=MUTED, fontsize=8.5)
        if cases[0][1] == "C-H":
            ax.set_ylim(-0.7, 0.9); ax.text(0.98, 0.88, "diamond E_c ≈ +5.3 eV, off scale", transform=ax.transAxes, ha="right", color=MUTED, fontsize=8.5)
        ax.set_xlim(-span, span); ax.set_xlabel("position (nm)"); ax.set_title(title, pad=30)
        subtitle(ax, sub)
        ax.set_ylabel("energy (eV, right-hand E_F = 0)")
    axs[0].legend(fontsize=9, loc="lower left")
    save(fig, "heterojunction_equilibrium")


# ---------------------------------------------------------------------------
# Physics Lab Part VI: from transistor to circuit
INV_ERAS = [("1999_180nm", "180 nm", 0.5), ("2007_45nm_hkmg", "45 nm planar", 0.6), ("2011_22nm_finfet", "22 nm FinFET", 0.8), ("2025_2nm_gaa", "2 nm GAA", 0.9)]


def fig_inverter():
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12.5, 5.0), gridspec_kw=dict(wspace=0.3))
    rows = []
    for i, (k, name, beta) in enumerate(INV_ERAS):
        p = mosfet.preset(k)
        vin, vout = inverter.vtc(p, beta=beta)
        m = inverter.metrics(p, beta=beta)
        a1.plot(vin / p.VDD, vout / p.VDD, color=SERIES[i], label=f"{name}: gain {m['gain']:.0f}, V_DD {p.VDD:g} V")
        rows.append((name, m))
    a1.plot([0, 1], [0, 1], color=AXIS, lw=1, ls=":")
    a1.set_xlabel("input voltage / V_DD"); a1.set_ylabel("output voltage / V_DD"); a1.set_title("CMOS inverter transfer curves")
    subtitle(a1, "drain-induced barrier lowering softens the 45 nm switch")
    a1.legend(fontsize=8.5, loc="upper right")
    for i, (name, m) in enumerate(rows):
        a2.scatter(m["tp_ps"], m["E_fJ"], s=70, color=SERIES[i], zorder=3)
        a2.annotate(name, (m["tp_ps"], m["E_fJ"]), xytext=(8, 4), textcoords="offset points", color=INK2, fontsize=9)
    a2.set_xscale("log"); a2.set_yscale("log"); a2.set_xlim(1, 40); a2.set_ylim(2, 60)
    a2.set_xlabel("gate delay t_p (ps), fan-out of 4, step input"); a2.set_ylabel("energy per cycle C·V² (fJ per µm)")
    a2.set_title("Faster and cheaper per switch")
    subtitle(a2, "compact model, ideal step input")
    for ax in (a2.xaxis, a2.yaxis):
        ax.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{v:g}"))
    a2.set_xticks([1, 2, 5, 10, 20, 40]); a2.set_yticks([2, 5, 10, 20, 50])
    save(fig, "cmos_inverter")


def fig_ballistic():
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12.5, 5.0), gridspec_kw=dict(wspace=0.3))
    p = ballistic.params("Si")
    VDs = np.linspace(0, 0.9, 46)
    for i, vg in enumerate([0.4, 0.55, 0.7, 0.85]):
        a1.plot(VDs, [ballistic.solve(p, vg, vd, True)["I"] for vd in VDs], color=SERIES[i], ls="--", lw=1.2)
        a1.plot(VDs, [ballistic.solve(p, vg, vd)["I"] for vd in VDs], color=SERIES[i], label=f"V_G = {vg} V")
    a1.set_xlabel("drain voltage V_D (V)"); a1.set_ylabel("I_D (µA/µm, intrinsic)"); a1.set_title("Silicon, 18 nm: quasi-ballistic vs ballistic")
    subtitle(a1, "solid: with backscattering · dashed: ballistic limit (Natori)"); a1.legend(fontsize=9)
    Ls = np.geomspace(5, 200, 40)
    for ch, col in zip(["InGaAs", "Ge", "Si", "MoS2"], [SERIES[2], SERIES[3], SERIES[0], SERIES[4]]):
        B = [ballistic.solve(ballistic.params(ch, L_nm=L), 0.7, 0.7)["I"] / ballistic.solve(ballistic.params(ch, L_nm=L), 0.7, 0.7, True)["I"] for L in Ls]
        a2.plot(Ls, B, color=col, label=ballistic.CHANNELS[ch]["name"])
    a2.set_xscale("log"); a2.set_ylim(0, 1.02); a2.set_xlabel("channel length L (nm)"); a2.set_ylabel("ballisticity  I / I_ballistic")
    a2.set_title("How close to the ballistic limit?"); subtitle(a2, "top-of-barrier model, V_G = V_D = 0.7 V, each material's mobility"); a2.legend(fontsize=9)
    save(fig, "ballistic_mosfet")


def fig_interconnect():
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12.5, 5.0), gridspec_kw=dict(wspace=0.3))
    ws = np.geomspace(6, 200, 60)
    cols = {"Cu": "#d9825b", "Co": "#7fd3d0", "Ru": "#b58fd6", "W": INK2}
    for m in interconnect.METALS:
        a1.plot(ws, [interconnect.r_per_um(m, w, 2 * w) for w in ws], color=cols[m], label=interconnect.METALS[m]["name"] + (" (2 nm barrier)" if m == "Cu" else ""))
    a1.set_xscale("log"); a1.set_yscale("log"); a1.set_xlabel("line width w (nm), height 2w"); a1.set_ylabel("resistance (Ω/µm)")
    a1.set_title("Narrow lines: copper loses its lead"); subtitle(a1, "surface + grain-boundary scattering (Fuchs–Sondheimer, Mayadas–Shatzkes)"); a1.legend(fontsize=9)
    Ls = np.geomspace(1, 5000, 80)
    R0, C0 = 6e3, 0.3e-15
    for i, (w, lab) in enumerate([(200, "200 nm (1990s)"), (40, "40 nm"), (14, "14 nm (today's lowest layers)")]):
        r, c = interconnect.r_per_um("Cu", w, 2 * w), interconnect.c_per_um(w, 2 * w, w)
        a2.plot(Ls, [interconnect.elmore_delay(r, c, L, R0 / 4, C0 * 4) * 1e12 for L in Ls], color=SERIES[i], label=f"copper, {lab}")
    a2.axhline(0.69 * R0 * 5 * C0 * 1e12, color=SERIES[3], ls="--", lw=1); a2.text(1.2, 0.69 * R0 * 5 * C0 * 1e12 * 1.25, "one gate delay", color=SERIES[3], fontsize=9)
    a2.set_xscale("log"); a2.set_yscale("log"); a2.set_ylim(0.5, 1e5); a2.set_xlabel("wire length (µm)"); a2.set_ylabel("delay (ps), no repeaters")
    a2.set_title("Wire delay grows as length²"); subtitle(a2, "Elmore delay, 4× driver, k = 2.7"); a2.legend(fontsize=9, loc="upper left")
    save(fig, "interconnect_rc")


def fig_device_bands():
    """One PNG per device: lateral off/on plus the gate-stack cut when the device has one."""
    out = FIG / "bands"
    out.mkdir(exist_ok=True)
    for k, d in bandatlas.load_devices().items():
        off_v, on_v = _ends(d)
        V = bandatlas.vertical(d, on_v)
        fig, axs = plt.subplots(1, 2 if V is not None else 1, figsize=(12 if V is not None else 7, 3.9),
                                gridspec_kw=dict(wspace=0.22, width_ratios=[1.25, 1]) if V is not None else None, squeeze=False)
        a1 = axs[0][0]
        _, _, vd = _lat_axes(a1, d)
        a1.set_ylabel("electron energy (eV)")
        a1.set_title(d["name"], pad=22)
        a1.legend(fontsize=8.5, loc="lower left", ncol=3)
        a1.text(0, -0.05, f"along the current path · gate {off_v:g} V (off) → {on_v:g} V (on), drain {vd:g} V", transform=a1.transAxes, color=MUTED, fontsize=8.5, va="top")
        if V is not None:
            a2 = axs[0][1]
            z = np.asarray(V["z"], float)
            a2.plot(z, V["Ec"], color=SERIES[0]); a2.plot(z, V["Ev"], color=SERIES[1])
            a2.axhline(0, color=SERIES[3], lw=1, ls=":")
            if V["kind"] == "hemt":
                for j, E in enumerate(V["E"][:2]):
                    a2.axhline(E, color=SERIES[2 + j], lw=0.9, ls="--", xmin=0.3, xmax=0.75)
                a2.text(0.98, 0.95, f"n_s = {V['ns'] / 1e13:.2f}×10¹³ cm⁻²", transform=a2.transAxes, ha="right", va="top", color=INK2, fontsize=9)
            a2.set_xlabel("depth into the semiconductor (nm)")
            a2.set_title("Through the gate (gate on)", pad=22, fontsize=11.5)
            a2.text(0, 1.01, "solved" if V["kind"] in ("mos", "hemt") else "schematic", transform=a2.transAxes, color=MUTED, fontsize=8.5, va="bottom")
        fig.savefig(out / f"{k}.png", dpi=110, bbox_inches="tight", pad_inches=0.2, metadata={"Software": None})
        plt.close(fig)
    print("figures/bands/*.png")


if __name__ == "__main__":
    crosssection.write_all()
    layout.write_all()
    process.write_all()
    for f in (fig_moore, fig_node_vs_pitch, fig_iv_families, fig_transfer, fig_vtc, fig_hemt,
              fig_bfom, fig_gap_field, fig_litho, fig_dennard, fig_gummel, fig_ionization, fig_steep,
              fig_intrinsic, fig_pn, fig_cv, fig_leakage, fig_dibl, fig_montecarlo,
              fig_kronig_penney, fig_2deg, fig_chargesheet, fig_thermal, fig_litho,
              fig_band_atlas, fig_band_alignment, fig_device_bands, fig_heterojunction,
              fig_inverter, fig_ballistic, fig_interconnect):
        f()
    export_model_json()
    export_physics_json()
