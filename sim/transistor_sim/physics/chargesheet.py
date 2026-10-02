"""From capacitor to transistor: the charge-sheet MOSFET model (Brews 1978).

The inversion layer is treated as a sheet with no thickness, but its charge
comes from the exact surface potential, so one set of equations covers
subthreshold (diffusion) and strong inversion (drift), linear region and
saturation, with no fitted parameters.

Surface potential ψ_s at a point where the electron quasi-Fermi level sits V
below the source (Pao & Sah 1966, depletion + inversion terms):
    (V_GB − V_FB − ψ_s)² = γ² [ ψ_s + φ_t e^{(ψ_s − 2φ_F − V)/φ_t} ],   γ = √(2qε_s N_A)/C_ox
Drain current, with ψ_s0 at the source (V = 0) and ψ_sL at the drain (V = V_DS):
    I_D = (W/L) µ C_ox [ (V_GB − V_FB)(ψ_sL − ψ_s0) − ½(ψ_sL² − ψ_s0²) − ⅔γ(ψ_sL^{3/2} − ψ_s0^{3/2}) ]
        + (W/L) µ C_ox φ_t [ (ψ_sL − ψ_s0) + γ(√ψ_sL − √ψ_s0) ]
The first bracket is drift, the second diffusion. Constant mobility and no
velocity saturation: this is the long-channel limit that textbooks build on.
"""
from __future__ import annotations

import math

import numpy as np

from .carriers import K_B, intrinsic_density
from .junction import EPS0, Q


def params(Na=3e17, tox_nm=2.0, Vfb=-0.7, mu=300.0, W_um=1.0, L_um=1.0, T=300.0, k_ox=3.9):
    eps_s = 11.7 * EPS0
    Cox = k_ox * EPS0 / (tox_nm * 1e-7)
    ni = intrinsic_density("Si", T)
    phit = K_B * T
    phiF = phit * math.log(Na / ni)
    gamma = math.sqrt(2 * Q * eps_s * Na) / Cox
    return dict(Na=Na, Cox=Cox, phit=phit, phiF=phiF, gamma=gamma, Vfb=Vfb, mu=mu, W=W_um * 1e-4, L=L_um * 1e-4, eps_s=eps_s,
                Vt=Vfb + 2 * phiF + gamma * math.sqrt(2 * phiF))


def surface_potential(Vgb, V, p):
    """ψ_s (V) solving the implicit charge-sheet equation (bisection, ψ_s ≥ 0)."""
    vg = Vgb - p["Vfb"]
    if vg <= 0:
        return 0.0
    f = lambda ps: (vg - ps) - p["gamma"] * math.sqrt(ps + p["phit"] * math.exp(min((ps - 2 * p["phiF"] - V) / p["phit"], 700)))
    lo, hi = 0.0, vg
    for _ in range(80):
        mid = 0.5 * (lo + hi)
        (lo, hi) = (mid, hi) if f(mid) > 0 else (lo, mid)
    return 0.5 * (lo + hi)


def _G(ps, vg, p):
    """Antiderivative such that I_D = (W/L) µ C_ox [G(ψ_sL) − G(ψ_s0)] (sign arranged so I_D ≥ 0)."""
    g = p["gamma"]
    drift = vg * ps - 0.5 * ps * ps - (2 / 3) * g * ps ** 1.5
    diff = p["phit"] * (ps + g * math.sqrt(ps))
    return drift + diff


def drain_current(Vgs, Vds, p, Vsb=0.0):
    """I_D (A) for gate–source and drain–source voltages; body tied to source unless Vsb."""
    Vgb = Vgs + Vsb
    vg = Vgb - p["Vfb"]
    ps0 = surface_potential(Vgb, Vsb, p)
    psL = surface_potential(Vgb, Vsb + Vds, p)
    return p["W"] / p["L"] * p["mu"] * p["Cox"] * (_G(psL, vg, p) - _G(ps0, vg, p))


def inversion_charge(ps, vg, p):
    """|Q_i| (C/cm²) from gate charge minus depletion charge (charge-sheet)."""
    return max(p["Cox"] * (vg - ps) - p["Cox"] * p["gamma"] * math.sqrt(max(ps, 0.0)), 0.0)


def channel_profile(Vgs, Vds, p, n=101):
    """ψ_s(y), quasi-Fermi V(y) and |Q_i(y)| along the channel (y/L from 0 to 1)."""
    vg = Vgs - p["Vfb"]
    ps0 = surface_potential(Vgs, 0.0, p); psL = surface_potential(Vgs, Vds, p)
    G0, GL = _G(ps0, vg, p), _G(psL, vg, p)
    y = np.linspace(0, 1, n)
    ps = np.empty(n); V = np.empty(n); Qi = np.empty(n)
    for i, t in enumerate(y):
        target = G0 + t * (GL - G0)
        lo, hi = min(ps0, psL), max(ps0, psL)
        for _ in range(60):                     # G is monotonic in ψ_s over [ψ_s0, ψ_sL]
            mid = 0.5 * (lo + hi)
            (lo, hi) = (mid, hi) if _G(mid, vg, p) < target else (lo, mid)
        ps[i] = 0.5 * (lo + hi)
        # invert the implicit equation for V at this ψ_s
        rhs = ((vg - ps[i]) / p["gamma"]) ** 2 - ps[i]
        V[i] = ps[i] - 2 * p["phiF"] - p["phit"] * math.log(max(rhs, 1e-300) / p["phit"]) if rhs > 0 else Vds
        V[i] = min(max(V[i], 0.0), Vds)
        Qi[i] = inversion_charge(ps[i], vg, p)
    return dict(y=y, psi=ps, V=V, Qi=Qi)


def swing(p, Vds=0.05):
    """Subthreshold swing (mV/dec) from two gate voltages well below V_T."""
    v1 = p["Vt"] - 0.35; v2 = v1 + 0.05
    return 0.05 / math.log10(drain_current(v2, Vds, p) / drain_current(v1, Vds, p)) * 1000
