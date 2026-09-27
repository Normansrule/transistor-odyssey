"""Carrier statistics in a non-degenerate semiconductor.

Band gap vs temperature follows Varshni (1967):  Eg(T) = Eg0 - a T^2 / (T + b).
Effective densities of states scale as T^(3/2):  Nc(T) = Nc300 (T/300)^1.5.
Intrinsic density:  ni = sqrt(Nc Nv) exp(-Eg / 2kT)       (Sze & Ng, ch. 1)
With full ionization of Nd donors and Na acceptors, charge neutrality gives
    n = (Nd - Na)/2 + sqrt(((Nd - Na)/2)^2 + ni^2),   p = ni^2 / n.
Fermi level measured from the intrinsic level:  EF - Ei = kT ln(n / ni).
Material constants: Ioffe NSM archive; Sze & Ng, Physics of Semiconductor
Devices, 3rd ed.; Vurgaftman et al., J. Appl. Phys. 89, 5815 (2001).
"""
from __future__ import annotations

import math

import numpy as np

K_B = 8.617333262e-5  # eV/K

# Eg0 (eV), Varshni a (eV/K), b (K), Nc and Nv at 300 K (cm^-3), eps_r, chi (eV)
MATERIALS = {
    "Si":      dict(Eg0=1.170, a=4.73e-4, b=636,  Nc=3.2e19, Nv=1.8e19, eps=11.7, chi=4.05),
    "Ge":      dict(Eg0=0.7437, a=4.774e-4, b=235, Nc=1.04e19, Nv=6.0e18, eps=16.0, chi=4.0),
    "GaAs":    dict(Eg0=1.519, a=5.405e-4, b=204, Nc=4.7e17, Nv=9.0e18, eps=12.9, chi=4.07),
    "GaN":     dict(Eg0=3.47,  a=7.7e-4,  b=600,  Nc=2.3e18, Nv=4.6e19, eps=8.9,  chi=4.1),
    "4H-SiC":  dict(Eg0=3.265, a=6.5e-4,  b=1300, Nc=1.7e19, Nv=2.5e19, eps=9.7,  chi=3.7),
    "Diamond": dict(Eg0=5.47,  a=0.0,     b=1.0,  Nc=1.0e20, Nv=1.8e19, eps=5.7,  chi=0.0),
}


def band_gap(mat: str, T: float = 300.0) -> float:
    m = MATERIALS[mat]
    return m["Eg0"] - m["a"] * T * T / (T + m["b"])


def dos(mat: str, T: float = 300.0):
    m = MATERIALS[mat]
    s = (T / 300.0) ** 1.5
    return m["Nc"] * s, m["Nv"] * s


def intrinsic_density(mat: str, T: float = 300.0) -> float:
    Nc, Nv = dos(mat, T)
    return math.sqrt(Nc * Nv) * math.exp(-band_gap(mat, T) / (2 * K_B * T))


def intrinsic_level(mat: str, T: float = 300.0) -> float:
    """Ei - midgap (eV); positive when Nv > Nc."""
    Nc, Nv = dos(mat, T)
    return 0.5 * K_B * T * math.log(Nv / Nc)


def equilibrium(mat: str, T: float = 300.0, Nd: float = 0.0, Na: float = 0.0) -> dict:
    """Electron and hole densities and Fermi-level positions (full ionization)."""
    ni = intrinsic_density(mat, T)
    h = 0.5 * (Nd - Na)
    # Numerically stable root for either sign of h
    if h >= 0:
        n = h + math.sqrt(h * h + ni * ni)
        p = ni * ni / n
    else:
        p = -h + math.sqrt(h * h + ni * ni)
        n = ni * ni / p
    kT = K_B * T
    Eg = band_gap(mat, T)
    Ei = Eg / 2 + intrinsic_level(mat, T)      # from Ev
    EF = Ei + kT * math.log(n / ni)            # from Ev
    return dict(ni=ni, n=n, p=p, Eg=Eg, Ei=Ei, EF=EF, kT=kT)


def occupancy(E, EF, T=300.0):
    """Fermi-Dirac occupation f(E)."""
    x = (np.asarray(E, dtype=float) - EF) / (K_B * T)
    return 0.5 * (1 - np.tanh(0.5 * x))


def carrier_spectrum(mat: str, T: float = 300.0, Nd=0.0, Na=0.0, npts=400):
    """Energy grid (eV from Ev) with g_c f and g_v (1-f), normalized for plotting."""
    eq = equilibrium(mat, T, Nd, Na)
    Eg, EF, kT = eq["Eg"], eq["EF"], eq["kT"]
    E = np.linspace(-0.3, Eg + 0.3, npts)
    gc = np.sqrt(np.clip(E - Eg, 0, None))
    gv = np.sqrt(np.clip(-E, 0, None))
    f = occupancy(E, EF, T)
    return dict(E=E, gc=gc, gv=gv, n=gc * f, p=gv * (1 - f), **eq)
