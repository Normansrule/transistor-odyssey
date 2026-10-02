"""Abrupt pn junction in the depletion approximation, plus the Shockley diode.

    Vbi  = (kT/q) ln(Na Nd / ni^2)
    W    = sqrt( 2 eps (Vbi - V) / q * (Na + Nd) / (Na Nd) )
    xn   = W Na / (Na + Nd),   xp = W Nd / (Na + Nd)
    Emax = q Nd xn / eps
    J    = q ni^2 (Dn / (Ln Na) + Dp / (Lp Nd)) (exp(V / kT) - 1)       (long-base)
Mobility follows the Caughey-Thomas fit for silicon (Arora-style constants).
Sources: Sze & Ng ch. 2; Shockley, Bell Syst. Tech. J. 28, 435 (1949);
Caughey & Thomas, Proc. IEEE 55, 2192 (1967).
"""
from __future__ import annotations

import math

import numpy as np

from .carriers import K_B, MATERIALS, intrinsic_density

Q = 1.602176634e-19
EPS0 = 8.8541878128e-14  # F/cm


def mobility_si(N: float, carrier: str = "n") -> float:
    """Caughey-Thomas low-field mobility in Si at 300 K (cm^2/V s)."""
    if carrier == "n":
        mu_min, mu_max, Nref, alpha = 68.5, 1414.0, 9.2e16, 0.711
    else:
        mu_min, mu_max, Nref, alpha = 44.9, 470.5, 2.23e17, 0.719
    return mu_min + (mu_max - mu_min) / (1 + (N / Nref) ** alpha)


def solve(Na: float, Nd: float, V: float = 0.0, T: float = 300.0, mat: str = "Si", npts: int = 401) -> dict:
    """Depletion-approximation solution; x in µm, psi in V, E in V/cm."""
    eps = MATERIALS[mat]["eps"] * EPS0
    ni = intrinsic_density(mat, T)
    kT = K_B * T
    vbi = kT * math.log(Na * Nd / ni ** 2)
    vj = max(vbi - V, 1e-3)
    W = math.sqrt(2 * eps * vj / Q * (Na + Nd) / (Na * Nd))  # cm
    xn = W * Na / (Na + Nd)
    xp = W * Nd / (Na + Nd)
    Emax = Q * Nd * xn / eps
    span = 1.6 * W
    x = np.linspace(-xp - 0.3 * span, xn + 0.3 * span, npts)
    E = np.where((x >= -xp) & (x <= 0), -Emax * (x + xp) / xp, 0.0)
    E = np.where((x > 0) & (x <= xn), -Emax * (xn - x) / xn, E)
    # potential (0 on the p side far away, vj on the n side)
    psi = np.where(x < -xp, 0.0, 0.0)
    psi = np.where((x >= -xp) & (x <= 0), Q * Na * (x + xp) ** 2 / (2 * eps), psi)
    psi = np.where((x > 0) & (x <= xn), vj - Q * Nd * (xn - x) ** 2 / (2 * eps), psi)
    psi = np.where(x > xn, vj, psi)
    rho = np.where((x >= -xp) & (x <= 0), -Q * Na, 0.0)
    rho = np.where((x > 0) & (x <= xn), Q * Nd, rho)
    return dict(x_um=x * 1e4, E=E, psi=psi, rho=rho, Vbi=vbi, W_um=W * 1e4,
                xn_um=xn * 1e4, xp_um=xp * 1e4, Emax=Emax, ni=ni)


def saturation_current(Na: float, Nd: float, T: float = 300.0, tau_n=1e-6, tau_p=1e-6) -> float:
    """Long-base saturation current density J0 (A/cm^2) for a silicon diode."""
    ni = intrinsic_density("Si", T)
    kT = K_B * T
    Dn = mobility_si(Na, "n") * kT
    Dp = mobility_si(Nd, "p") * kT
    Ln, Lp = math.sqrt(Dn * tau_n), math.sqrt(Dp * tau_p)
    return Q * ni ** 2 * (Dn / (Ln * Na) + Dp / (Lp * Nd))


def diode_iv(V, Na: float, Nd: float, T: float = 300.0, n: float = 1.0, Rs: float = 0.0, area=1e-4):
    """Diode current (A) for area in cm^2; series resistance Rs (ohm) solved by fixed point."""
    J0 = saturation_current(Na, Nd, T)
    I0 = J0 * area
    vt = n * K_B * T
    V = np.atleast_1d(np.asarray(V, dtype=float))
    I = I0 * np.expm1(np.minimum(V, 1.2) / vt)
    if Rs > 0:
        for _ in range(200):
            I = 0.5 * I + 0.5 * I0 * np.expm1(np.minimum(V - I * Rs, 1.2) / vt)
    return I
