"""AlGaN/GaN high-electron-mobility transistor (HEMT) model.

The 2D electron gas (2DEG) at an AlGaN/GaN interface forms with no doping at
all: the difference in spontaneous + piezoelectric polarization between the
strained Al(x)Ga(1-x)N barrier and the GaN buffer leaves a fixed sheet charge
sigma(x) that electrons rush in to screen.

Sheet density follows Ambacher et al., J. Appl. Phys. 85, 3222 (1999) and
87, 334 (2000):

    n_s(x) = sigma(x)/q - (eps0 eps(x) / (q^2 d)) [q phi_b(x) + E_F - dE_c(x)]

with linear (Vegard) interpolation of lattice constant, piezoelectric and
elastic constants between GaN and AlN.
"""
from __future__ import annotations

import numpy as np

Q = 1.602176634e-19
EPS0 = 8.8541878128e-12

# GaN / AlN parameters (Ambacher 1999/2000, Table I)
A_GAN, A_ALN = 3.189, 3.112          # Å, in-plane lattice constant
PSP_GAN, PSP_ALN = -0.029, -0.081    # C/m^2 spontaneous polarization
E31_GAN, E31_ALN = -0.49, -0.60      # C/m^2
E33_GAN, E33_ALN = 0.73, 1.46        # C/m^2
C13_GAN, C13_ALN = 103.0, 108.0      # GPa
C33_GAN, C33_ALN = 405.0, 373.0      # GPa


def _lerp(a0, a1, x):
    return a0 + (a1 - a0) * x


def polarization_charge(x):
    """Bound sheet charge |sigma| (C/m^2) at the AlGaN/GaN interface for Al fraction x."""
    x = np.asarray(x, dtype=float)
    a = _lerp(A_GAN, A_ALN, x)
    e31 = _lerp(E31_GAN, E31_ALN, x)
    e33 = _lerp(E33_GAN, E33_ALN, x)
    c13 = _lerp(C13_GAN, C13_ALN, x)
    c33 = _lerp(C33_GAN, C33_ALN, x)
    p_pe = 2.0 * (A_GAN - a) / a * (e31 - e33 * c13 / c33)
    p_sp = _lerp(PSP_GAN, PSP_ALN, x)
    sigma = p_sp + p_pe - PSP_GAN
    return np.abs(sigma)


def bandgap_algan(x):
    """AlGaN bandgap (eV) with bowing parameter 1.0 eV."""
    x = np.asarray(x, dtype=float)
    return 6.13 * x + 3.42 * (1 - x) - 1.0 * x * (1 - x)


def sheet_density(x, d_nm, ef_ev: float = 0.0):
    """2DEG sheet density in cm^-2 for Al fraction x and barrier thickness d (nm)."""
    x = np.asarray(x, dtype=float)
    d = np.asarray(d_nm, dtype=float) * 1e-9
    eps = -0.5 * x + 9.5
    phi_b = 1.3 * x + 0.84
    dec = 0.7 * (bandgap_algan(x) - bandgap_algan(0.0))
    ns = polarization_charge(x) / Q - EPS0 * eps / (Q * d) * (phi_b + ef_ev - dec)
    return np.maximum(ns, 0.0) * 1e-4   # m^-2 -> cm^-2


def critical_thickness_nm(x):
    """Minimum barrier thickness for a 2DEG to exist (n_s = 0)."""
    x = np.asarray(x, dtype=float)
    eps = -0.5 * x + 9.5
    phi_b = 1.3 * x + 0.84
    dec = 0.7 * (bandgap_algan(x) - bandgap_algan(0.0))
    return EPS0 * eps * (phi_b - dec) / polarization_charge(x) * 1e9


def hemt_iv(vgs, vds, x=0.25, d_nm=20.0, L_um=0.25, mu=1800.0, vsat=1.4e7, Rs_ohm_mm=0.4):
    """Drain current (A/mm) of a depletion-mode AlGaN/GaN HEMT.

    Gate charge control n_s(V_G) = n_s0 + eps (V_G)/(q d); pinch-off where n_s = 0.
    Transport uses the same velocity-saturation form as mosfet.py.
    """
    vgs = np.asarray(vgs, dtype=float)
    vds = np.maximum(np.asarray(vds, dtype=float), 0.0)
    eps = (-0.5 * x + 9.5) * EPS0
    d = d_nm * 1e-9
    c = eps / d                                    # F/m^2
    ns0 = sheet_density(x, d_nm) * 1e4             # m^-2
    voff = -Q * ns0 / c                            # pinch-off voltage (negative)
    phit = 0.02585
    vgt = 1.5 * phit * np.log1p(np.exp(np.clip((vgs - voff) / (1.5 * phit), -50, 50)))
    L = L_um * 1e-6
    m = mu * 1e-4
    esat_l = 2 * vsat * 1e-2 / m * L
    vdsat = esat_l * vgt / (esat_l + vgt) + 2 * phit
    delta = 0.05
    a = vdsat - vds - delta
    vde = vdsat - 0.5 * (a + np.sqrt(a * a + 4 * delta * vdsat))
    W = 1e-3                                       # 1 mm
    i = m * c * W / L * vgt * vde * (1 - vde / (2 * (vgt + 2 * phit))) / (1 + vde / esat_l)
    i = i / (1 + i * Rs_ohm_mm / (vgt + 2 * phit))
    return i, voff
