"""Band structure of a one-dimensional crystal: the Kronig–Penney model.

A periodic array of square barriers (height V0, width b) separated by wells of
width a, period d = a + b. Bloch's theorem turns the Schrödinger equation into
one transcendental condition (Kronig & Penney 1931; Kittel ch. 7):

  E < V0:  cos(k d) = cos(α a) cosh(β b) + (β² − α²)/(2αβ) sin(α a) sinh(β b)
  E > V0:  cos(k d) = cos(α a) cos(γ b) − (α² + γ²)/(2αγ) sin(α a) sin(γ b)

with α = √(2mE)/ħ, β = √(2m(V0 − E))/ħ, γ = √(2m(E − V0))/ħ. Energies where the
right-hand side lies outside [−1, 1] have no propagating state: band gaps.
In the weak-potential limit the first gap equals 2|V₁|, twice the first
Fourier coefficient of the potential, V₁ = V0 sin(π b/d)/π (nearly-free
electron model, Ashcroft & Mermin ch. 9).
"""
from __future__ import annotations

import math

import numpy as np

HBAR = 1.054571817e-34
M0 = 9.1093837015e-31
QE = 1.602176634e-19


def rhs(E, V0, a_nm, b_nm, m=1.0):
    """Right-hand side of the Kronig–Penney condition (dimensionless)."""
    E = np.atleast_1d(np.asarray(E, dtype=float))
    a, b = a_nm * 1e-9, b_nm * 1e-9
    mm = m * M0
    out = np.empty_like(E)
    for i, e in enumerate(E):
        e = max(e, 1e-9)
        al = math.sqrt(2 * mm * e * QE) / HBAR
        if V0 <= 0 or b <= 0:
            out[i] = math.cos(al * (a + b)); continue
        if abs(e - V0) < 1e-9:
            e = V0 + 1e-9
        if e < V0:
            be = math.sqrt(2 * mm * (V0 - e) * QE) / HBAR
            out[i] = math.cos(al * a) * math.cosh(be * b) + (be ** 2 - al ** 2) / (2 * al * be) * math.sin(al * a) * math.sinh(be * b)
        else:
            ga = math.sqrt(2 * mm * (e - V0) * QE) / HBAR
            out[i] = math.cos(al * a) * math.cos(ga * b) - (al ** 2 + ga ** 2) / (2 * al * ga) * math.sin(al * a) * math.sin(ga * b)
    return out


def bands(V0, a_nm, b_nm, m=1.0, Emax=None, n=4000):
    """Energy grid, RHS, reduced wavevector k·d/π (NaN in gaps) and band edges."""
    d = (a_nm + b_nm) * 1e-9
    if Emax is None:
        Emax = max(3 * V0, 4 * (HBAR * math.pi / d) ** 2 / (2 * m * M0) / QE)
    E = np.linspace(1e-6, Emax, n)
    f = rhs(E, V0, a_nm, b_nm, m)
    allowed = np.abs(f) <= 1
    kd = np.where(allowed, np.arccos(np.clip(f, -1, 1)) / math.pi, np.nan)
    edges = []
    start = None
    for i in range(n):
        if allowed[i] and start is None:
            start = i
        if (not allowed[i] or i == n - 1) and start is not None:
            end = i - 1 if not allowed[i] else i
            edges.append((_edge(E, f, start, V0, a_nm, b_nm, m, lo=True), _edge(E, f, end, V0, a_nm, b_nm, m, lo=False)))
            start = None
    return dict(E=E, f=f, kd=kd, edges=edges, d_nm=a_nm + b_nm)


def _edge(E, f, i, V0, a, b, m, lo):
    """Refine a band edge (|f| = 1) by bisection between grid points."""
    j = i - 1 if lo else i + 1
    if j < 0 or j >= len(E):
        return float(E[i])
    x0, x1 = E[j], E[i]  # x0 outside, x1 inside
    for _ in range(60):
        xm = 0.5 * (x0 + x1)
        if abs(rhs(xm, V0, a, b, m)[0]) <= 1:
            x1 = xm
        else:
            x0 = xm
    return float(0.5 * (x0 + x1))


def gaps(V0, a_nm, b_nm, m=1.0, **kw):
    ed = bands(V0, a_nm, b_nm, m, **kw)["edges"]
    return [(ed[i][1], ed[i + 1][0]) for i in range(len(ed) - 1)]


def nfe_first_gap(V0, a_nm, b_nm):
    """Nearly-free-electron estimate of the first gap: 2|V1|."""
    d = a_nm + b_nm
    return 2 * abs(V0 * math.sin(math.pi * b_nm / d) / math.pi)


def effective_mass(V0, a_nm, b_nm, m=1.0):
    """Effective mass (units of m0) at the bottom of band 1 from the band curvature.

    Near the band bottom cos(kd) ≈ f(E) with f(E0) = 1, so
    E − E0 ≈ (kd)² / (2 |f'(E0)|) and m* = ħ² |f'(E0)| / d² (f' in 1/J).
    """
    E0 = bands(V0, a_nm, b_nm, m)["edges"][0][0]
    h = 1e-5
    fp = (rhs(E0 + h, V0, a_nm, b_nm, m)[0] - rhs(E0, V0, a_nm, b_nm, m)[0]) / (h * QE)
    d = (a_nm + b_nm) * 1e-9
    return HBAR ** 2 * abs(fp) / d ** 2 / M0, E0
