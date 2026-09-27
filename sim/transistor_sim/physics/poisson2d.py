"""Two-dimensional electrostatics of a short-channel MOSFET (subthreshold).

Solves  div(eps grad psi) = -rho  on a rectangular grid by red-black
successive over-relaxation (SOR). In subthreshold the channel holds few
mobile carriers, so rho is the ionized body doping only (-q Na in silicon).

Geometry (y down):
  single gate  : gate | oxide t_ox | silicon t_si | buried oxide t_box | grounded substrate
  double gate  : gate | oxide t_ox | silicon t_si | oxide t_ox | gate
Source and drain are ideal n+ contacts on the left and right silicon edges,
held at psi = Vbi and Vbi + Vds; oxide side walls are zero-flux.

The electron barrier seen from the source is Eb = Vbi - max_y min_x psi(x, y):
the leakiest horizontal path sets the off-current. DIBL is the drop in Eb per
volt of drain bias; a smaller natural length
    lambda = sqrt(eps_si t_si t_ox / (N eps_ox))     (Yan, Ourmazd & Lee 1992)
(N = 1 single gate, 2 double gate) means less drain influence.
"""
from __future__ import annotations

import math

import numpy as np

EPS0 = 8.8541878128e-12  # F/m
Q = 1.602176634e-19
KT = 0.025852


def build(L_nm=20.0, t_si_nm=6.0, t_ox_nm=1.0, t_box_nm=20.0, double_gate=False,
          eps_ox=3.9, eps_si=11.7, Na=1e17, nx=81, dy_nm=0.25):
    layers = [("ox", t_ox_nm), ("si", t_si_nm)]
    layers.append(("ox", t_ox_nm) if double_gate else ("box", t_box_nm))
    ny_layers = [max(2, int(round(t / dy_nm))) for _, t in layers]
    ny = sum(ny_layers) + 1
    dx = L_nm / (nx - 1) * 1e-9
    y_edges = [0]
    for n in ny_layers:
        y_edges.append(y_edges[-1] + n)
    eps = np.empty((ny, nx))
    region = np.empty((ny, nx), dtype="U3")
    for (name, _), a, b in zip(layers, y_edges[:-1], y_edges[1:]):
        region[a:b + 1, :] = name
        eps[a:b + 1, :] = eps_si if name == "si" else eps_ox
    # interface rows belong to silicon for doping purposes
    si_rows = np.arange(y_edges[1], y_edges[2] + 1)
    region[si_rows, :] = "si"
    eps[si_rows, :] = eps_si
    dy = np.full(ny - 1, 0.0)
    for (name, t), n, a in zip(layers, ny_layers, y_edges[:-1]):
        dy[a:a + n] = t / n * 1e-9
    return dict(L_nm=L_nm, nx=nx, ny=ny, dx=dx, dy=dy, eps=eps * EPS0, region=region,
                si_rows=si_rows, double_gate=double_gate, Na=Na, t_si_nm=t_si_nm, t_ox_nm=t_ox_nm)


def solve(g, Vgs=0.0, Vds=0.05, Vbi=0.56, phi_ms=-0.35, omega=1.85, tol=1e-6, max_iter=20000, psi0=None):
    """Return psi (V) on the grid."""
    nx, ny, dx, dy, eps = g["nx"], g["ny"], g["dx"], g["dy"], g["eps"]
    psi = np.zeros((ny, nx)) if psi0 is None else psi0.copy()
    vg = Vgs + phi_ms
    rho = np.where(g["region"] == "si", -Q * g["Na"] * 1e6, 0.0)  # C/m^3
    fixed = np.zeros((ny, nx), dtype=bool)
    val = np.zeros((ny, nx))
    fixed[0, :] = True; val[0, :] = vg
    fixed[-1, :] = True; val[-1, :] = vg if g["double_gate"] else 0.0
    rows = g["si_rows"]
    fixed[rows, 0] = True; val[rows, 0] = Vbi
    fixed[rows, -1] = True; val[rows, -1] = Vbi + Vds
    if psi0 is None:
        # initial guess: linear in x between contacts inside silicon, gate elsewhere
        psi[:] = vg
        psi[rows, :] = np.linspace(Vbi, Vbi + Vds, nx)[None, :] * 0.5 + vg * 0.5
    psi[fixed] = val[fixed]
    # face permittivities (harmonic mean)
    eE = np.zeros((ny, nx)); eW = np.zeros((ny, nx)); eN = np.zeros((ny, nx)); eS = np.zeros((ny, nx))
    hm = lambda a, b: 2 * a * b / (a + b)
    eE[:, :-1] = hm(eps[:, :-1], eps[:, 1:]); eW[:, 1:] = eE[:, :-1]
    eS[:-1, :] = hm(eps[:-1, :], eps[1:, :]); eN[1:, :] = eS[:-1, :]
    dyS = np.zeros(ny); dyN = np.zeros(ny)
    dyS[:-1] = dy; dyN[1:] = dy
    dyc = 0.5 * (dyS + dyN)
    aE = eE / dx ** 2; aW = eW / dx ** 2
    with np.errstate(divide="ignore", invalid="ignore"):
        aS = np.where(dyS[:, None] > 0, eS / (dyS[:, None] * dyc[:, None]), 0)
        aN = np.where(dyN[:, None] > 0, eN / (dyN[:, None] * dyc[:, None]), 0)
    # zero-flux side walls: mirror neighbour
    aE[:, -1] = 0; aW[:, 0] = 0
    aE[:, 0] = eE[:, 0] / dx ** 2 * 2
    aW[:, -1] = eW[:, -1] / dx ** 2 * 2
    aS[-1, :] = 0; aN[0, :] = 0
    diag = aE + aW + aN + aS
    free = ~fixed
    jj, ii = np.meshgrid(np.arange(nx), np.arange(ny))
    red = free & ((ii + jj) % 2 == 0)
    black = free & ((ii + jj) % 2 == 1)
    for it in range(max_iter):
        maxd = 0.0
        for mask in (red, black):
            pE = np.empty_like(psi); pW = np.empty_like(psi); pN = np.empty_like(psi); pS = np.empty_like(psi)
            pE[:, :-1] = psi[:, 1:]; pE[:, -1] = 0
            pW[:, 1:] = psi[:, :-1]; pW[:, 0] = 0
            pS[:-1, :] = psi[1:, :]; pS[-1, :] = 0
            pN[1:, :] = psi[:-1, :]; pN[0, :] = 0
            # side-wall mirrors (x = 0 uses east twice, x = L uses west twice)
            new = (aE * pE + aW * pW + aN * pN + aS * pS + rho) / diag
            d = omega * (new - psi)
            psi[mask] += d[mask]
            maxd = max(maxd, float(np.abs(d[mask]).max()))
        if maxd < tol:
            break
    return psi


def barrier(g, psi, Vbi=0.56):
    """Source-referenced electron barrier (eV) along the leakiest path, plus Ec(x) there."""
    rows = g["si_rows"]
    sub = psi[rows, :]
    mins = sub.min(axis=1)
    j = int(np.argmax(mins))
    return Vbi - mins[j], -(sub[j, :] - Vbi), rows[j]


def off_current_proxy(g, psi, Vbi=0.56):
    """sum_y exp(-Eb(y)/kT): proportional to the subthreshold current."""
    sub = psi[g["si_rows"], :]
    return float(np.sum(np.exp(-(Vbi - sub.min(axis=1)) / KT)))


def dibl(L_nm=20.0, double_gate=False, vd_lo=0.05, vd_hi=0.7, **kw):
    g = build(L_nm=L_nm, double_gate=double_gate, **kw)
    p1 = solve(g, 0.0, vd_lo)
    p2 = solve(g, 0.0, vd_hi, psi0=p1)
    e1, _, _ = barrier(g, p1)
    e2, _, _ = barrier(g, p2)
    return (e1 - e2) / (vd_hi - vd_lo) * 1000.0  # mV/V


def swing(L_nm=20.0, double_gate=False, vds=0.05, dv=0.05, **kw):
    g = build(L_nm=L_nm, double_gate=double_gate, **kw)
    p1 = solve(g, 0.0, vds)
    p2 = solve(g, dv, vds, psi0=p1)
    i1, i2 = off_current_proxy(g, p1), off_current_proxy(g, p2)
    return dv / math.log10(i2 / i1) * 1000.0  # mV/dec


def natural_length(t_si_nm, t_ox_nm, double_gate=False, eps_si=11.7, eps_ox=3.9):
    N = 2 if double_gate else 1
    return math.sqrt(eps_si * t_si_nm * t_ox_nm / (N * eps_ox))
