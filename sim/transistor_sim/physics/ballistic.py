"""Ballistic and quasi-ballistic MOSFET: the top-of-barrier model.

At the top of the source barrier, states moving toward the drain (+k) are
filled from the source Fermi level; states moving back (-k) are filled by the
drain plus whatever the channel scatters back. In two dimensions:

    N2D = g_v m* kT / (pi hbar^2),   v_T = sqrt(2 kT / (pi m*))   (unidirectional thermal velocity)
    n_s = (N2D/2) [ (2 - T) F0(eta_S) + T F0(eta_D) ],   F0(eta) = ln(1 + e^eta)
    I/W = q v_T (N2D/2) T [ F1/2(eta_S) - F1/2(eta_D) ],   eta_D = eta_S - qV_D/kT

eta_S = (E_F,source - E_top)/kT follows from the gate and drain electrostatics,
    E_top = alpha_G q (V_T0 - V_G) - alpha_D q V_D + q^2 n_s / C_sum,
solved self-consistently by bisection. Transmission T = lambda / (lambda + l)
uses the mean free path lambda = 2 (kT/q) mu / v_T and a "kT layer" l that is
the whole channel at low drain bias and shrinks as (kT/qV_D)^0.75 at high bias.
T = 1 is the ballistic limit (Natori 1994); T < 1 is Lundstrom's scattering theory.
F1/2 here is the Blakemore-normalised Fermi-Dirac integral (-> e^eta when nondegenerate).
Sources: Natori, J. Appl. Phys. 76, 4879 (1994); Lundstrom, IEEE EDL 18, 361 (1997);
Rahman, Guo, Datta & Lundstrom, IEEE TED 50, 1853 (2003); Lundstrom, Fundamentals of Nanotransistors (2017).
"""
from __future__ import annotations

import math

import numpy as np

Q = 1.602176634e-19
KB = 1.380649e-23
HBAR = 1.054571817e-34
M0 = 9.1093837015e-31
EPS0 = 8.8541878128e-12

CHANNELS = {   # transport/DOS mass (m0), valley degeneracy, low-field mobility (cm^2/V s)
    "Si": dict(m=0.19, gv=2, mu=250.0, name="Silicon (100)"),
    "InGaAs": dict(m=0.043, gv=1, mu=3000.0, name="In0.53Ga0.47As"),
    "Ge": dict(m=0.12, gv=4, mu=400.0, name="Germanium"),
    "MoS2": dict(m=0.45, gv=2, mu=60.0, name="Monolayer MoS2"),
}

_X = np.linspace(0.0, 60.0, 2401)


def F0(eta):
    eta = np.asarray(eta, float)
    return np.where(eta > 35, eta, np.log1p(np.exp(np.minimum(eta, 35))))


def F_half(eta: float) -> float:
    """Blakemore-normalised Fermi-Dirac integral of order 1/2 (numerical)."""
    if eta < -30:
        return math.exp(eta)
    x = _X * max(1.0, (eta + 40.0) / 60.0) if eta > 20 else _X
    y = np.sqrt(x) / (1.0 + np.exp(np.clip(x - eta, -700, 700)))
    return float(np.trapezoid(y, x) / (math.sqrt(math.pi) / 2.0))


def params(channel="Si", eot_nm=0.9, L_nm=18.0, alpha_g=0.92, alpha_d=0.04, vt0=0.25, T=300.0, mu=None):
    ch = CHANNELS[channel]
    kT = KB * T
    m = ch["m"] * M0
    N2D = ch["gv"] * m * kT / (math.pi * HBAR ** 2)          # m^-2
    vT = math.sqrt(2 * kT / (math.pi * m))                     # m/s
    mu_ = ch["mu"] if mu is None else mu
    lam = 2 * (kT / Q) * (mu_ * 1e-4) / vT                     # m
    CG = 3.9 * EPS0 / (eot_nm * 1e-9)                          # F/m^2
    return dict(channel=channel, kT=kT, N2D=N2D, vT=vT, lam=lam, CG=CG, Csum=CG / alpha_g, alpha_g=alpha_g,
                alpha_d=alpha_d, vt0=vt0, L=L_nm * 1e-9, mu=mu_)


def transmission(p, VD: float, ballistic: bool = False) -> float:
    if ballistic:
        return 1.0
    phit = p["kT"] / Q
    ell = p["L"] * (phit / (phit + max(VD, 0.0))) ** 0.75
    return p["lam"] / (p["lam"] + ell)


def solve(p, VG: float, VD: float, ballistic: bool = False) -> dict:
    kT, Tr = p["kT"], transmission(p, VD, ballistic)
    uD = Q * VD / kT
    half = p["N2D"] / 2

    def ns_of(eta):
        return half * ((2 - Tr) * float(F0(eta)) + Tr * float(F0(eta - uD)))

    def resid(eta):                       # eta*kT - (E_F - E_top)
        Etop = p["alpha_g"] * Q * (p["vt0"] - VG) - p["alpha_d"] * Q * VD + Q * Q * ns_of(eta) / p["Csum"]
        return eta * kT + Etop

    lo, hi = -80.0, 80.0
    for _ in range(100):
        mid = 0.5 * (lo + hi)
        if resid(mid) > 0:
            hi = mid
        else:
            lo = mid
    eta = 0.5 * (lo + hi)
    ns = ns_of(eta)
    I = Q * p["vT"] * half * Tr * (F_half(eta) - F_half(eta - uD))   # A/m
    return dict(eta=eta, ns=ns, I=I, T=Tr, Etop_eV=-eta * kT / Q, vinj=I / (Q * ns) if ns > 0 else 0.0,
                I_uA_um=I)              # A per m of width is numerically µA per µm


def curves(p, VGs, VD_max=0.8, n=41, ballistic=False):
    VDs = np.linspace(0, VD_max, n)
    return VDs, np.array([[solve(p, vg, vd, ballistic)["I"] for vd in VDs] for vg in VGs])
