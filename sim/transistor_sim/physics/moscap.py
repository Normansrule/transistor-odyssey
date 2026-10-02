"""MOS capacitor on a p-type substrate: exact charge, band bending, C-V.

Surface charge for surface potential psi_s (Sze & Ng eq. 4.14-4.19):
    F(psi) = sqrt( (e^{-b psi} + b psi - 1) + (n0/p0)(e^{b psi} - b psi - 1) ),  b = q/kT
    Qs     = -sign(psi) sqrt(2 eps_s kT p0) F(psi)
Gate voltage:  Vg = Vfb + psi_s - Qs / Cox
Low-frequency capacitance: series combination of Cox and Cs = -dQs/dpsi_s.
High-frequency capacitance: minority carriers cannot follow the AC signal, so
Cs uses only the majority/depletion terms, and past psi_s = 2 phi_B the
depletion edge is pinned at W_max (the classic approximation).
Threshold, from the depletion approximation:
    Vt = Vfb + 2 phi_B + sqrt(4 eps_s q Na phi_B) / Cox
"""
from __future__ import annotations

import math

import numpy as np

from .carriers import K_B, MATERIALS, intrinsic_density
from .junction import EPS0, Q

EPS_OX = 3.9 * EPS0


def params(Na=1e17, tox_nm=5.0, T=300.0, Vfb=-0.9, mat="Si", k_ox=3.9):
    eps_s = MATERIALS[mat]["eps"] * EPS0
    ni = intrinsic_density(mat, T)
    kT = K_B * T
    p0 = Na
    n0 = ni * ni / Na
    phiB = kT * math.log(Na / ni)
    Cox = k_ox * EPS0 / (tox_nm * 1e-7)
    LD = math.sqrt(eps_s * kT / (Q * p0))  # cm (kT in volts -> eps kT/(q p0))
    return dict(eps_s=eps_s, ni=ni, kT=kT, p0=p0, n0=n0, phiB=phiB, Cox=Cox, LD=LD, Vfb=Vfb, Na=Na)


def F(psi, p):
    b = 1.0 / p["kT"]
    psi = np.asarray(psi, dtype=float)
    x = b * psi
    term = (np.exp(-x) + x - 1) + (p["n0"] / p["p0"]) * (np.exp(x) - x - 1)
    return np.sqrt(np.maximum(term, 0.0))


def Qs(psi, p):
    """Semiconductor charge per area (C/cm^2)."""
    psi = np.asarray(psi, dtype=float)
    return -np.sign(psi) * math.sqrt(2 * p["eps_s"] * Q * p["kT"] * p["p0"]) * F(psi, p)


def Qs_majority(psi, p):
    b = 1.0 / p["kT"]
    x = b * np.asarray(psi, dtype=float)
    term = np.exp(-x) + x - 1
    return -np.sign(psi) * math.sqrt(2 * p["eps_s"] * Q * p["kT"] * p["p0"]) * np.sqrt(np.maximum(term, 0))


def gate_voltage(psi, p):
    return p["Vfb"] + np.asarray(psi) - Qs(psi, p) / p["Cox"]


def threshold(p):
    return p["Vfb"] + 2 * p["phiB"] + math.sqrt(4 * p["eps_s"] * Q * p["Na"] * p["phiB"]) / p["Cox"]


def cv_curves(p, vg_min=-3.0, vg_max=3.0, npts=241):
    """Return Vg, C_lf/Cox, C_hf/Cox, psi_s on a uniform Vg grid."""
    psi = np.linspace(-0.45, 2 * p["phiB"] + 0.35, 4000)
    vg = gate_voltage(psi, p)
    h = 1e-5
    Cs_lf = -(Qs(psi + h, p) - Qs(psi - h, p)) / (2 * h)
    psi_hf = np.minimum(psi, 2 * p["phiB"])
    Cs_hf = -(Qs_majority(psi_hf + h, p) - Qs_majority(psi_hf - h, p)) / (2 * h)
    Cs_lf = np.abs(Cs_lf) + 1e-30
    Cs_hf = np.abs(Cs_hf) + 1e-30
    c_lf = 1 / (1 / p["Cox"] + 1 / Cs_lf) / p["Cox"]
    c_hf = 1 / (1 / p["Cox"] + 1 / Cs_hf) / p["Cox"]
    V = np.linspace(vg_min, vg_max, npts)
    order = np.argsort(vg)
    return dict(Vg=V, C_lf=np.interp(V, vg[order], c_lf[order]), C_hf=np.interp(V, vg[order], c_hf[order]),
                psi_s=np.interp(V, vg[order], psi[order]))


def band_bending(psi_s, p, depth_nm=None, npts=300):
    """psi(x) vs depth by integrating d psi/dx = -sign(psi) sqrt(2) (kT/q) F / LD (RK4)."""
    if depth_nm is None:
        W = math.sqrt(2 * p["eps_s"] * max(abs(psi_s), 0.05) / (Q * p["Na"]))
        depth_nm = 1.8 * W * 1e7
    x = np.linspace(0, depth_nm * 1e-7, npts)
    dx = x[1] - x[0]
    k = math.sqrt(2) * p["kT"] / p["LD"]

    def f(ps):
        return -np.sign(ps) * k * float(F(ps, p))

    psi = np.empty(npts)
    psi[0] = psi_s
    for i in range(1, npts):
        y = psi[i - 1]
        k1 = f(y); k2 = f(y + 0.5 * dx * k1); k3 = f(y + 0.5 * dx * k2); k4 = f(y + dx * k3)
        y_new = y + dx * (k1 + 2 * k2 + 2 * k3 + k4) / 6
        if np.sign(y_new) != np.sign(psi_s) and psi_s != 0:
            y_new = 0.0
        psi[i] = y_new
    n = p["n0"] * np.exp(psi / p["kT"])
    pp = p["p0"] * np.exp(-psi / p["kT"])
    return dict(x_nm=x * 1e7, psi=psi, n=n, p=pp)
