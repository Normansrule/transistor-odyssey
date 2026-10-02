"""Compact MOSFET model used for every era in this repo.

One smooth equation set covers subthreshold, linear and saturation so that a
10 µm 1971 device and a 2 nm-class nanosheet can be drawn on the same axes.

Physics included (and cited in docs/12-simulation.md):
  * smooth inversion charge, V_GT = n φt ln(1 + exp((V_GS - V_T) / (n φt)))
    (BSIM-style unified charge; gives an ideal n·60 mV/decade subthreshold slope)
  * drain-induced barrier lowering, V_T = V_T0 - η V_DS
  * vertical-field mobility degradation, µ_eff = µ0 / (1 + θ V_GT)
  * velocity saturation, E_sat = 2 v_sat / µ_eff  (Taur & Ning ch. 3)
  * smooth V_DS -> V_DSAT transition and channel-length modulation λ
  * inversion-layer offset added to EOT (C_inv < C_ox) and first-order
    source series resistance degeneration

The parameter sets are educational approximations that land near the
published on-current, leakage and subthreshold swing of each era. They are
not foundry models; use a real PDK (SKY130, GF180, IHP SG13G2) or BSIM for
design work.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict, replace
import math

import numpy as np

Q = 1.602176634e-19       # C
KB = 1.380649e-23         # J/K
EPS0 = 8.8541878128e-12   # F/m
EPS_SIO2 = 3.9


def thermal_voltage(T: float = 300.0) -> float:
    return KB * T / Q


@dataclass(frozen=True)
class MOSParams:
    name: str
    year: int
    L_nm: float            # effective channel length
    EOT_nm: float          # equivalent oxide thickness
    VDD: float
    VT0: float             # long-channel threshold (magnitude)
    n: float               # subthreshold ideality (1.0 -> 60 mV/dec at 300 K)
    mu0: float             # low-field mobility, cm^2/(V s)
    vsat: float            # saturation / injection velocity, cm/s
    eta: float = 0.0       # DIBL coefficient (V/V)
    theta: float = 0.0     # mobility degradation (1/V)
    lam: float = 0.0       # channel-length modulation (1/V)
    W_factor: float = 1.0  # effective width per µm of footprint (fins/sheets)
    Rs_ohm_um: float = 0.0 # source series resistance x width (contacts, extensions)
    dT_inv_nm: float = 0.4 # inversion-layer centroid + gate depletion added to EOT
    structure: str = "planar"
    note: str = ""

    @property
    def Cox(self) -> float:
        """Gate capacitance per area, F/m^2."""
        return EPS_SIO2 * EPS0 / ((self.EOT_nm + self.dT_inv_nm) * 1e-9)

    def as_dict(self) -> dict:
        d = asdict(self)
        d["Cox_uF_cm2"] = self.Cox * 1e2  # F/m^2 -> µF/cm^2
        return d


def drain_current(p: MOSParams, vgs, vds, T: float = 300.0):
    """Drain current in A per µm of layout width (vectorised).

    Works for nFET polarity with positive V_GS, V_DS (use magnitudes for pFETs).
    """
    vgs = np.asarray(vgs, dtype=float)
    vds = np.maximum(np.asarray(vds, dtype=float), 0.0)
    phit = thermal_voltage(T)
    L = p.L_nm * 1e-9
    vt = p.VT0 - p.eta * vds
    x = (vgs - vt) / (p.n * phit)
    # log1p(exp(x)) without overflow
    vgt = p.n * phit * np.where(x > 30, x, np.log1p(np.exp(np.minimum(x, 30))))
    mu = p.mu0 * 1e-4 / (1.0 + p.theta * vgt)        # m^2/(V s)
    esat_l = 2.0 * (p.vsat * 1e-2) / mu * L            # E_sat * L  (V)
    vdsat = esat_l * vgt / (esat_l + vgt) + 2 * phit   # floor keeps subthreshold continuous
    delta = 0.02
    a = vdsat - vds - delta
    vds_eff = vdsat - 0.5 * (a + np.sqrt(a * a + 4.0 * delta * vdsat))
    W = 1e-6 * p.W_factor
    ids = (mu * p.Cox * W / L) * (vgt - 0.5 * vds_eff * vgt / (vgt + 2 * phit)) * vds_eff
    ids = ids / (1.0 + vds_eff / esat_l)
    ids = ids * (1.0 + p.lam * (vds - vds_eff))
    if p.Rs_ohm_um > 0:
        # first-order source degeneration: the drop I*Rs subtracts from V_GT
        r = p.Rs_ohm_um / p.W_factor
        ids = ids / (1.0 + ids * r / (vgt + 2.0 * phit))
    return ids  # A per µm footprint


def transfer_curve(p: MOSParams, vds: float | None = None, n_points: int = 241):
    vds = p.VDD if vds is None else vds
    vgs = np.linspace(0.0, p.VDD, n_points)
    return vgs, drain_current(p, vgs, vds)


def output_family(p: MOSParams, steps: int = 5, n_points: int = 161):
    vds = np.linspace(0.0, p.VDD, n_points)
    vg_list = np.linspace(p.VT0 + (p.VDD - p.VT0) / steps, p.VDD, steps)
    return vds, vg_list, np.array([drain_current(p, vg, vds) for vg in vg_list])


def metrics(p: MOSParams) -> dict:
    """Ion, Ioff, subthreshold swing, DIBL and peak gm for a device."""
    ion = float(drain_current(p, p.VDD, p.VDD))
    ioff = float(drain_current(p, 0.0, p.VDD))
    phit = thermal_voltage()
    # subthreshold swing from two points deep in weak inversion
    v1, v2 = p.VT0 - 0.30, p.VT0 - 0.20
    i1 = float(drain_current(p, v1, 0.05))
    i2 = float(drain_current(p, v2, 0.05))
    ss = (v2 - v1) / math.log10(i2 / i1) * 1e3
    vgs = np.linspace(0, p.VDD, 801)
    ids = drain_current(p, vgs, p.VDD)
    gm = np.gradient(ids, vgs)
    return {
        "Ion_uA_um": ion * 1e6,
        "Ioff_nA_um": ioff * 1e9,
        "Ion_Ioff": ion / ioff if ioff > 0 else float("inf"),
        "SS_mV_dec": ss,
        "DIBL_mV_V": p.eta * 1e3,
        "gm_max_mS_um": float(gm.max()) * 1e3,
        "ideal_SS_mV_dec": 1e3 * phit * math.log(10),
    }


# --------------------------------------------------------------------------
# Era presets. Values chosen from the era's published oxide thickness, supply
# voltage and gate length (see data/nodes.csv) and lightly tuned to land near
# reported drive currents. Educational approximations.
# --------------------------------------------------------------------------
PRESETS: dict[str, MOSParams] = {
    "1971_10um_pmos": MOSParams("10 µm pMOS (4004-class)", 1971, 10000, 120, 15.0, 2.0, 1.6, 190, 8e6,
                                eta=0.0, theta=0.01, lam=0.01, structure="planar_mosfet_poly",
                                note="Silicon-gate pMOS, ~120 nm oxide, 15 V supply; hole mobility"),
    "1975_8um_nmos": MOSParams("8 µm nMOS (6502-class)", 1975, 6000, 120, 5.0, 1.0, 1.5, 600, 8e6,
                               eta=0.0, theta=0.02, lam=0.02, structure="planar_mosfet_poly"),
    "1985_1p5um_cmos": MOSParams("1.5 µm CMOS (80386-class)", 1985, 1200, 25, 5.0, 0.8, 1.3, 550, 8e6,
                                 eta=0.005, theta=0.05, lam=0.03, structure="planar_mosfet_poly"),
    "1999_180nm": MOSParams("180 nm CMOS", 1999, 130, 3.0, 1.8, 0.42, 1.35, 400, 8e6,
                            eta=0.04, theta=0.25, lam=0.05, Rs_ohm_um=350, structure="planar_mosfet_sti"),
    "2007_45nm_hkmg": MOSParams("45 nm HKMG + strain", 2007, 35, 1.0, 1.0, 0.33, 1.45, 330, 1.1e7,
                                eta=0.12, theta=0.35, lam=0.08, Rs_ohm_um=220, structure="planar_hkmg",
                                note="Planar; short-channel effects visible as high DIBL and SS"),
    "2011_22nm_finfet": MOSParams("22 nm tri-gate FinFET", 2011, 26, 0.9, 0.8, 0.28, 1.08, 280, 1.1e7,
                                  eta=0.045, theta=0.3, lam=0.05, W_factor=1.35, Rs_ohm_um=260, structure="finfet",
                                  note="Fin height adds width per footprint (W_factor)"),
    "2025_2nm_gaa": MOSParams("2 nm-class GAA nanosheet", 2025, 14, 0.8, 0.70, 0.25, 1.05, 220, 1.25e7,
                              eta=0.03, theta=0.3, lam=0.04, W_factor=2.6, Rs_ohm_um=420, structure="gaa",
                              note="3 stacked sheets; illustrative, vendors do not publish full I-V"),
    "2026_mos2_2d": MOSParams("Monolayer MoS2, 0.42 nm AlOx + HfO2", 2026, 100, 1.0, 1.0, 0.30, 1.25, 44, 3.0e6,
                              eta=0.02, theta=0.12, lam=0.03, Rs_ohm_um=240, dT_inv_nm=0.2, structure="mos2",
                              note="Tuned to reported ~1 nm EOT and ~0.45 mS/µm peak gm at ~100 nm channel"),
}


def preset(key: str, **overrides) -> MOSParams:
    return replace(PRESETS[key], **overrides) if overrides else PRESETS[key]


def cmos_inverter_vtc(p: MOSParams, n_points: int = 201, pn_ratio: float = 1.0):
    """Voltage transfer curve of a CMOS inverter built from a symmetric n/p pair.

    Solves I_n(Vin, Vout) = I_p(VDD - Vin, VDD - Vout) by bisection per point.
    pn_ratio scales the pFET strength (1.0 = perfectly matched).
    """
    vin = np.linspace(0.0, p.VDD, n_points)
    vout = np.empty_like(vin)
    for i, v in enumerate(vin):
        lo, hi = 0.0, p.VDD
        for _ in range(60):
            mid = 0.5 * (lo + hi)
            f = drain_current(p, v, mid) - pn_ratio * drain_current(p, p.VDD - v, p.VDD - mid)
            if f > 0:
                hi = mid
            else:
                lo = mid
        vout[i] = 0.5 * (lo + hi)
    return vin, vout
