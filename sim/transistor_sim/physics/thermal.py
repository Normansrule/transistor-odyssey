"""Self-heating: 2D steady-state heat conduction under a transistor hot spot.

Solves ∇·(k ∇T) = −q on a cross-section through a device (x across, y down).
A heater of width w at the top of the active layer dissipates P′ watts per
millimetre of gate width; the bottom of the substrate is held at the
heat-sink temperature; the other faces are insulated. Layers:

    active layer (GaN, 2 µm) → thermal boundary resistance → substrate → heat sink

The boundary resistance (TBR) between GaN and a foreign substrate is modelled
as a thin layer with k = t / TBR. The grid is graded so that it is fine near
the heater and coarse far away. The linear system is block-tridiagonal (one
block per column of nodes) and is solved directly by block Gaussian
elimination, so thin, low-conductivity layers cause no convergence trouble.

Conductivities near room temperature (W/m·K): GaN 130, Si 150, 4H-SiC 490,
diamond (CVD) 1500–2000, sapphire 35, SiO₂ 1.4. Real k falls with temperature
(k ∝ T^−1.2…−1.5 for Si and GaN), so hot devices are hotter than this
constant-k model says.
"""
from __future__ import annotations

import numpy as np

from .qwell import thomas

K = {"GaN": 130.0, "Si": 150.0, "SiC": 490.0, "Diamond": 1800.0, "Sapphire": 35.0, "SiO2": 1.4, "Cu": 400.0}


def graded(total, fine, n_fine, n):
    """Node positions from 0 to total: n_fine uniform cells of size `fine`, then geometric growth."""
    if fine * n_fine >= total:
        return np.linspace(0.0, total, n + 1)
    x = [0.0]
    for _ in range(n_fine):
        x.append(x[-1] + fine)
    rem = total - x[-1]
    m = n - n_fine
    if m <= 0 or rem <= 0:
        return np.array(x)
    # find growth ratio r with fine*r*(r^m - 1)/(r - 1) = rem
    lo, hi = 1.0 + 1e-9, 2.0
    for _ in range(100):
        r = 0.5 * (lo + hi)
        s = fine * r * (r ** m - 1) / (r - 1)
        (lo, hi) = (r, hi) if s < rem else (lo, r)
    h = fine
    for _ in range(m):
        h *= r
        x.append(x[-1] + h)
    x = np.array(x); x[-1] = total
    return x


def build(substrate="SiC", t_sub_um=100.0, t_act_um=2.0, w_um=1.0, half_width_um=150.0, tbr_m2K_GW=0.0,
          active="GaN", nx=70, ny_act=24, ny_sub=46):
    """Half-domain (symmetric about the heater centre)."""
    xs = graded(half_width_um * 1e-6, w_um * 1e-6 / 8, 8, nx)                   # x ≥ 0
    ys_act = np.linspace(0, t_act_um * 1e-6, ny_act + 1)
    t_tbr = 0.02e-6
    ys = list(ys_act)
    layers = []
    if tbr_m2K_GW > 0:
        ys.append(ys[-1] + t_tbr)
    y_sub = graded(t_sub_um * 1e-6, (ys_act[1] - ys_act[0]) * 2, 4, ny_sub)
    ys += list(ys[-1] + y_sub[1:])
    ys = np.array(ys)
    # conductivity at cell centres (between nodes) in y; nodes carry the lower cell's k
    yc = 0.5 * (ys[:-1] + ys[1:])
    kc = np.where(yc < t_act_um * 1e-6, K[active], K[substrate])
    if tbr_m2K_GW > 0:
        tb = (yc > t_act_um * 1e-6) & (yc < t_act_um * 1e-6 + t_tbr)
        kc = np.where(tb, t_tbr / (tbr_m2K_GW * 1e-9), kc)
    return dict(x=xs, y=ys, kc=kc, w=w_um * 1e-6, t_act=t_act_um * 1e-6, substrate=substrate, tbr=tbr_m2K_GW)


def system(g, P_W_per_mm=5.0, T_sink=300.0):
    """Finite-volume coefficients: per column i a tridiagonal block (lo, di, up) in y,
    the coupling to column i+1 (east, a diagonal block) and the source vector."""
    x, y, kc = g["x"], g["y"], g["kc"]
    nx, ny = len(x), len(y)
    flux = P_W_per_mm * 1e3 / g["w"]                           # W/m² into the top over the heater
    dx = np.diff(x); dy = np.diff(y)
    wx = np.empty(nx); wx[0] = dx[0] / 2; wx[-1] = dx[-1] / 2; wx[1:-1] = 0.5 * (dx[:-1] + dx[1:])
    wy = np.empty(ny); wy[0] = dy[0] / 2; wy[-1] = dy[-1] / 2; wy[1:-1] = 0.5 * (dy[:-1] + dy[1:])
    # conductance of horizontal faces: each node row spans half of the cell above and below
    kx = np.empty(ny); kx[0] = kc[0] * dy[0] / 2; kx[-1] = kc[-1] * dy[-1] / 2
    kx[1:-1] = (kc[:-1] * dy[:-1] + kc[1:] * dy[1:]) / 2                   # = k·(face height)
    gv = kc / dy                                                          # vertical conductance per unit x-width
    xl = np.r_[0, 0.5 * (x[:-1] + x[1:])]; xr = np.r_[0.5 * (x[:-1] + x[1:]), x[-1]]
    heat_w = np.clip(np.minimum(xr, g["w"] / 2) - xl, 0, None)
    E = [kx / dx[i] for i in range(nx - 1)]                               # east coupling of column i
    blocks, rhs = [], []
    for i in range(nx):
        di = np.zeros(ny); lo = np.zeros(ny); up = np.zeros(ny)
        di[:-1] += gv * wx[i]; di[1:] += gv * wx[i]
        up[:-1] = -gv * wx[i]; lo[1:] = -gv * wx[i]
        if i > 0: di += E[i - 1]
        if i < nx - 1: di += E[i]
        r = np.zeros(ny); r[0] = flux * heat_w[i]
        di[-1] = 1.0; lo[-1] = 0.0; r[-1] = T_sink                         # heat-sink node
        blocks.append((lo, di, up)); rhs.append(r)
    # the heat-sink row must not couple sideways
    E = [e.copy() for e in E]
    for e in E: e[-1] = 0.0
    return blocks, E, rhs


def solve(g, P_W_per_mm=5.0, T_sink=300.0):
    """Direct solve by block-tridiagonal Gaussian elimination (columns are blocks). Returns T[ny, nx]."""
    blocks, E, rhs = system(g, P_W_per_mm, T_sink)
    nx, ny = len(blocks), len(blocks[0][1])
    def dense(b):
        lo, di, up = b
        return np.diag(di) + np.diag(up[:-1], 1) + np.diag(lo[1:], -1)
    Cp, dp = [], []
    M = dense(blocks[0])
    for i in range(nx):
        if i > 0:
            M = dense(blocks[i]) - (-E[i - 1])[:, None] * Cp[i - 1]       # L_i = −E_{i−1} (diagonal)
            r = rhs[i] - (-E[i - 1]) * dp[i - 1]
        else:
            r = rhs[0]
        U = -np.diag(E[i]) if i < nx - 1 else np.zeros((ny, ny))
        sol = np.linalg.solve(M, np.column_stack([U, r]))
        Cp.append(sol[:, :ny]); dp.append(sol[:, ny])
    T = np.empty((ny, nx)); T[:, -1] = dp[-1]
    for i in range(nx - 2, -1, -1):
        T[:, i] = dp[i] - Cp[i] @ T[:, i + 1]
    # heat-sink row sits in the matrix as Dirichlet: fix sideways coupling of the row above
    return T


def peak_rise(substrate="SiC", P=5.0, **kw):
    g = build(substrate=substrate, **kw)
    T = solve(g, P)
    return float(T.max() - 300.0), g, T


def one_d_rise(P_W_per_mm, w_um, layers):
    """ΔT for uniform heating across the whole top: Σ q″ t/k (exact 1D check)."""
    q = P_W_per_mm * 1e3 / (w_um * 1e-6)
    return sum(q * t_um * 1e-6 / k for t_um, k in layers)
