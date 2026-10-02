"""Ensemble Monte Carlo of electron drift in bulk silicon (teaching model).

Each electron flies freely under the field, its velocity changing by
-qE/m* per unit time, then scatters. Three processes, all isotropic:

* acoustic phonons (elastic):   rate = C_ac (T/300) sqrt(E)
* optical phonon absorption:    rate = C_op  N_op      sqrt(E + hw)
* optical phonon emission:      rate = C_op (N_op + 1) sqrt(E - hw)   (E > hw)

with hw = 63 meV (Si optical phonon) and N_op the Bose-Einstein occupation.
The square-root energy dependence is the parabolic density of final states
(Jacoboni & Reggiani, Rev. Mod. Phys. 55, 645 (1983)). A single isotropic
valley with conductivity mass 0.26 m0 stands in for silicon's six valleys, so
C_ac and C_op are calibrated to reproduce two measured numbers: low-field
mobility ~1400 cm^2/V s and saturation velocity ~1e7 cm/s (Canali et al.,
IEEE Trans. Electron Devices 22, 1045 (1975)). Time stepping uses the
constant-total-rate (self-scattering) method of Rees (1969). Bands are
non-parabolic, E(1 + alpha E) = p^2/2m*, alpha = 0.5 /eV, so hot electrons
get heavier, as they do in real silicon.
"""
from __future__ import annotations

import math

import numpy as np

QE = 1.602176634e-19
M0 = 9.1093837015e-31
KB = 1.380649e-23

HW = 0.063          # eV
MSTAR = 0.26
C_AC = 9.5e12       # 1/s/eV^0.5  (calibrated, see docstring)
C_OP = 4.0e13       # 1/s/eV^0.5
ALPHA = 0.5         # non-parabolicity (1/eV): E(1 + alpha E) = p^2 / 2m*


def _dos(E, alpha):
    """Non-parabolic density-of-states factor sqrt(g)(1 + 2 alpha E), g = E(1 + alpha E)."""
    E = np.clip(E, 0, None)
    return np.sqrt(E * (1 + alpha * E)) * (1 + 2 * alpha * E)


def rates(E, T=300.0, c_ac=C_AC, c_op=C_OP, hw=HW, alpha=ALPHA):
    """Scattering rates (1/s) at kinetic energy E (eV)."""
    N = 1.0 / math.expm1(hw / (KB * T / QE))
    E = np.asarray(E, dtype=float)
    ac = c_ac * (T / 300.0) * _dos(E, alpha)   # acoustic phonon population ∝ T (equipartition)
    ab = c_op * N * _dos(E + hw, alpha)
    em = c_op * (N + 1) * np.where(E > hw, _dos(E - hw, alpha), 0.0)
    return ac, ab, em


def caughey_thomas(F_Vcm, mu0=1417.0, vsat=1.07e7, beta=1.1):
    """Empirical v(F) fit to Si electron data (Canali 1975), cm/s."""
    F = np.asarray(F_Vcm, dtype=float)
    return mu0 * F / (1 + (mu0 * F / vsat) ** beta) ** (1 / beta)


def _energy(p, m, alpha):
    g = np.sum(p * p, axis=1) / (2 * m) / QE          # gamma = E(1 + alpha E), eV
    return (np.sqrt(1 + 4 * alpha * g) - 1) / (2 * alpha) if alpha > 0 else g


def _pmag(E, m, alpha):
    return np.sqrt(2 * m * E * (1 + alpha * E) * QE)


def simulate(F_Vcm, n=4000, t_ps=4.0, T=300.0, seed=0, c_ac=C_AC, c_op=C_OP, alpha=ALPHA, record=False):
    """Mean drift velocity (cm/s) and mean energy (eV) after t_ps at field F."""
    rng = np.random.default_rng(seed)
    m = MSTAR * M0
    kT = KB * T
    p = rng.normal(0, math.sqrt(m * kT), size=(n, 3))   # Maxwellian start (momentum)
    dp = -QE * F_Vcm * 100.0                              # N; electrons drift against the field
    Emax = 1.0
    G0 = sum(r for r in rates(Emax, T, c_ac, c_op, alpha=alpha)) * 1.05
    dt = 0.1 / G0
    steps = int(t_ps * 1e-12 / dt)
    vx_hist, e_hist = [], []
    p_scat = 1 - math.exp(-G0 * dt)
    for s in range(steps):
        p[:, 0] += dp * dt
        E = _energy(p, m, alpha)
        ac, ab, em = rates(np.minimum(E, Emax), T, c_ac, c_op, alpha=alpha)
        hit = rng.random(n) < p_scat
        if hit.any():
            r = rng.random(n) * G0
            newE = E.copy()
            sel_ac = hit & (r < ac)
            sel_ab = hit & (r >= ac) & (r < ac + ab)
            sel_em = hit & (r >= ac + ab) & (r < ac + ab + em)
            newE[sel_ab] += HW
            newE[sel_em] -= HW
            real = sel_ac | sel_ab | sel_em
            k = int(real.sum())
            if k:
                pm = _pmag(np.maximum(newE[real], 1e-6), m, alpha)
                cos_t = rng.uniform(-1, 1, k)
                phi = rng.uniform(0, 2 * math.pi, k)
                sin_t = np.sqrt(1 - cos_t ** 2)
                p[real] = np.stack([pm * cos_t, pm * sin_t * np.cos(phi), pm * sin_t * np.sin(phi)], axis=1)
                E[real] = newE[real]
        if s > steps // 2 or record:
            vx = p[:, 0] / (m * (1 + 2 * alpha * E))
            vx_hist.append(-vx.mean())
            e_hist.append(E.mean())
    half = len(vx_hist) // 2 if record else 0
    return dict(v_cm_s=float(np.mean(vx_hist[half:])) * 100.0, E_eV=float(np.mean(e_hist[half:])),
                trace=np.array(vx_hist) * 100.0 if record else None, dt=dt)


def mobility(F_Vcm=500.0, **kw):
    r = simulate(F_Vcm, **kw)
    return r["v_cm_s"] / F_Vcm
