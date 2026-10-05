"""Ion implantation and dopant diffusion in silicon.

Range (LSS theory, Lindhard, Scharff & Schiøtt 1963): an ion of energy E slows
by nuclear collisions S_n (ZBL universal reduced stopping, Ziegler et al. 1985)
and electronic drag S_e = k sqrt(E) (Lindhard). The total path length is
    R = ∫ dE / (N [S_n(E) + S_e(E)])
and the projected range and straggle follow the standard corrections
    R_p ≈ R / (1 + M2 / 3M1),     ΔR_p ≈ (2/3) R_p sqrt(M1 M2) / (M1 + M2).
These land within ~20 % of tabulated values above ~30 keV (worse for light
ions at low energy, where channelling and the approximations matter).

Profile: a Gaussian of dose Q,  N(x) = Q / (sqrt(2π) ΔR_p) exp(-(x - R_p)² / 2ΔR_p²).
An anneal of diffusion length sqrt(Dt) broadens it: ΔR_p² → ΔR_p² + 2Dt (the
surface is ignored). D = D0 exp(-Ea/kT) with intrinsic values from the Illinois
table; high-concentration enhancement and transient-enhanced diffusion are left out.

Junction depth: the deeper point where N(x) equals the background doping.
Sheet resistance: R_s = 1 / (q ∫ μ(N(x)) N(x) dx) over the layer above x_j,
with Caughey–Thomas mobility.
"""
from __future__ import annotations

import math

import numpy as np

Q = 1.602176634e-19
KB = 8.617333262e-5
N_SI = 4.996e22           # atoms/cm³
Z2, M2 = 14, 28.086

IONS = {
    "B": dict(Z=5, M=11.009, type="p", name="Boron", D0=10.5, Ea=4.28e4 / 11604.5),
    "P": dict(Z=15, M=30.974, type="n", name="Phosphorus", D0=10.5, Ea=4.28e4 / 11604.5),
    "As": dict(Z=33, M=74.922, type="n", name="Arsenic", D0=0.058, Ea=3.83e4 / 11604.5),
    "Sb": dict(Z=51, M=121.76, type="n", name="Antimony", D0=3.94, Ea=4.49e4 / 11604.5),
}


def stopping(ion: str, E_eV):
    """Nuclear and electronic stopping cross-sections (eV cm²) in silicon."""
    Z1, M1 = IONS[ion]["Z"], IONS[ion]["M"]
    E = np.asarray(E_eV, dtype=float)
    a = Z1 ** 0.23 + Z2 ** 0.23
    eps = 32.53 * M2 * (E / 1e3) / (Z1 * Z2 * (M1 + M2) * a)
    sn = np.log(1 + 1.1383 * eps) / (2 * (eps + 0.01321 * eps ** 0.21226 + 0.19593 * eps ** 0.5))
    Sn = 8.462e-15 * Z1 * Z2 * M1 * sn / ((M1 + M2) * a)
    Se = 1.212 * Z1 ** (7 / 6) * Z2 / (Z1 ** (2 / 3) + Z2 ** (2 / 3)) ** 1.5 * np.sqrt(E / M1) * 1e-16
    return Sn, Se


def range_stats(ion: str, E_keV: float, n: int = 1200) -> dict:
    """Projected range and straggle (nm), total path R (nm), and the energy where S_n = S_e (keV)."""
    M1 = IONS[ion]["M"]
    Es = np.geomspace(1.0, E_keV * 1e3, n)
    Sn, Se = stopping(ion, Es)
    f = 1.0 / (N_SI * (Sn + Se))
    R = float(np.sum(0.5 * (f[1:] + f[:-1]) * np.diff(Es))) * 1e7 + 1.0 / (N_SI * (Sn[0] + Se[0])) * 1e7  # first eV
    Rp = R / (1 + M2 / (3 * M1))
    dRp = (2 / 3) * Rp * math.sqrt(M1 * M2) / (M1 + M2)
    return dict(R=R, Rp=Rp, dRp=dRp)


def crossover_keV(ion: str) -> float:
    """Energy (keV) above which electronic stopping exceeds nuclear stopping."""
    Es = np.geomspace(1e3, 1e8, 4001)
    Sn, Se = stopping(ion, Es)
    k = int(np.argmax(Se > Sn))
    lo, hi = Es[k - 1], Es[k]
    for _ in range(60):
        mid = math.sqrt(lo * hi)
        a, b = stopping(ion, mid)
        if b > a: hi = mid
        else: lo = mid
    return float(math.sqrt(lo * hi) / 1e3)


def diffusivity(ion: str, T_C: float) -> float:
    """Intrinsic diffusivity (cm²/s)."""
    d = IONS[ion]
    return d["D0"] * math.exp(-d["Ea"] / (KB * (T_C + 273.15)))


def profile(x_nm, ion: str, E_keV: float, dose_cm2: float, T_C: float | None = None, t_s: float = 0.0):
    """Dopant concentration (cm⁻³) at depths x_nm after implant and an optional anneal."""
    r = range_stats(ion, E_keV)
    s2 = (r["dRp"] * 1e-7) ** 2
    if T_C is not None and t_s > 0:
        s2 += 2 * diffusivity(ion, T_C) * t_s
    s = math.sqrt(s2)
    x = np.asarray(x_nm, dtype=float) * 1e-7
    return dose_cm2 / (math.sqrt(2 * math.pi) * s) * np.exp(-((x - r["Rp"] * 1e-7) ** 2) / (2 * s2))


def mobility(N, carrier: str):
    """Caughey–Thomas mobility (cm²/V s) in silicon at 300 K."""
    N = np.asarray(N, dtype=float)
    if carrier == "n":
        return 65.0 + 1265.0 / (1 + (N / 8.5e16) ** 0.72)
    return 47.7 + 447.3 / (1 + (N / 6.3e16) ** 0.76)


def junction(ion: str, E_keV: float, dose_cm2: float, N_bg: float, T_C: float | None = None, t_s: float = 0.0, n: int = 4000) -> dict:
    """Junction depth (nm), peak (cm⁻³) and sheet resistance (Ω/□) of the implanted layer."""
    r = range_stats(ion, E_keV)
    s = math.sqrt((r["dRp"] * 1e-7) ** 2 + (2 * diffusivity(ion, T_C) * t_s if T_C is not None and t_s > 0 else 0.0)) * 1e7
    xmax = r["Rp"] + 8 * s
    x = np.linspace(0, xmax, n)
    N = profile(x, ion, E_keV, dose_cm2, T_C, t_s)
    peak = float(N.max())
    above = np.where(N > N_bg)[0]
    if above.size == 0:
        return dict(xj=0.0, peak=peak, Rs=float("inf"), sigma_nm=s, Rp=r["Rp"])
    k = above[-1]
    xj = float(x[k] + (x[k + 1] - x[k]) * (N[k] - N_bg) / (N[k] - N[k + 1])) if k + 1 < n else float(x[k])
    net = np.clip(N - N_bg, 0, None)
    mu = mobility(N + N_bg, IONS[ion]["type"])
    g = Q * mu * net
    G = float(np.sum(0.5 * (g[1:] + g[:-1]) * np.diff(x))) * 1e-7
    return dict(xj=xj, peak=peak, Rs=1.0 / G if G > 0 else float("inf"), sigma_nm=s, Rp=r["Rp"])
