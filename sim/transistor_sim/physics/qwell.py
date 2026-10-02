"""Quantum confinement: 1D Schrödinger solver and a self-consistent
Schrödinger–Poisson solution of the AlGaN/GaN two-dimensional electron gas.

Schrödinger with position-dependent mass (BenDaniel & Duke 1966), finite
differences on a uniform grid:
    −ħ²/2 d/dz [ (1/m(z)) dψ/dz ] + V(z) ψ = E ψ
The matrix is symmetric tridiagonal. Python uses numpy.linalg.eigh; the browser
twin uses Sturm-sequence bisection, and tests/js_parity.mjs checks they agree.

Nanosheet confinement: a silicon film of thickness t between SiO₂ barriers
(3.1 eV). For (100) films the lowest subband comes from the two Δ valleys with
the heavy mass m_l = 0.916 m₀ across the film; the four others (m_t = 0.19)
sit higher. The ground-state energy rises roughly as 1/t², which shifts the
threshold voltage of thin nanosheets and fins.

AlGaN/GaN 2DEG: polarization sheet charge σ(x) at the interface (hemt.py,
Ambacher 1999/2000), surface barrier φ_b pinning the conduction band at the
top, conduction-band offset ΔE_c. Electrons fill 2D subbands:
    n(z) = Σ_i (m* kT / πħ²) ln(1 + e^{(E_F − E_i)/kT}) |ψ_i(z)|²
Poisson and Schrödinger are iterated with density mixing until the potential
stops changing (Tan, Snider, Chang & Hu 1990).
"""
from __future__ import annotations

import math

import numpy as np

from .. import hemt

HBAR = 1.054571817e-34
M0 = 9.1093837015e-31
QE = 1.602176634e-19
EPS0 = 8.8541878128e-12
KB_EV = 8.617333262e-5


def hamiltonian(V_eV, m_rel, dz_m):
    """Diagonal and off-diagonal (eV) of the BenDaniel–Duke finite-difference Hamiltonian."""
    V = np.asarray(V_eV, float); m = np.asarray(m_rel, float)
    mh = 2.0 / (1.0 / m[:-1] + 1.0 / m[1:])            # mass at half points (harmonic mean)
    c = HBAR ** 2 / (2 * M0 * dz_m ** 2) / QE          # eV
    off = -c / mh
    diag = V.copy()
    diag[:-1] += c / mh
    diag[1:] += c / mh
    diag[0] += c / m[0]; diag[-1] += c / m[-1]          # ψ = 0 just outside the domain
    return diag, off


def solve_states(V_eV, m_rel, dz_m, nstates=4):
    d, e = hamiltonian(V_eV, m_rel, dz_m)
    H = np.diag(d) + np.diag(e, 1) + np.diag(e, -1)
    w, v = np.linalg.eigh(H)
    v = v[:, :nstates] / math.sqrt(dz_m)                # normalise ∫|ψ|² dz = 1
    return w[:nstates], v.T


# ---------------------------------------------------------------- square well
def finite_well(t_nm, V0=3.1, m_well=0.916, m_barrier=0.5, pad_nm=2.0, dz_nm=0.02, nstates=3):
    n_pad = int(round(pad_nm / dz_nm)); n_w = int(round(t_nm / dz_nm))
    N = 2 * n_pad + n_w
    z = (np.arange(N) - n_pad + 0.5) * dz_nm
    inside = (z >= 0) & (z <= t_nm)
    V = np.where(inside, 0.0, V0)
    m = np.where(inside, m_well, m_barrier)
    E, psi = solve_states(V, m, dz_nm * 1e-9, nstates)
    return dict(z_nm=z, V=V, E=E, psi=psi)


def infinite_well_levels(t_nm, m=0.916, n=3):
    return np.array([(k * math.pi * HBAR / (t_nm * 1e-9)) ** 2 / (2 * m * M0) / QE for k in range(1, n + 1)])


def finite_well_exact(t_nm, V0, m_w, m_b):
    """Even ground state of a finite well from the transcendental equation (BenDaniel–Duke matching)."""
    a = t_nm * 1e-9 / 2
    f = lambda E: (math.sqrt(2 * m_w * M0 * E * QE) / HBAR / m_w) * math.tan(math.sqrt(2 * m_w * M0 * E * QE) / HBAR * a) \
        - math.sqrt(2 * m_b * M0 * (V0 - E) * QE) / HBAR / m_b
    lo, hi = 1e-9, min(V0, (math.pi / 2 / a * HBAR) ** 2 / (2 * m_w * M0) / QE) - 1e-12
    for _ in range(200):
        mid = 0.5 * (lo + hi)
        (lo, hi) = (mid, hi) if f(mid) < 0 else (lo, mid)
    return 0.5 * (lo + hi)


# ---------------------------------------------------------------- AlGaN/GaN
def algan_params(x):
    eps = -0.5 * x + 9.5
    phi_b = 1.3 * x + 0.84
    dEc = 0.7 * (float(hemt.bandgap_algan(x)) - float(hemt.bandgap_algan(0.0)))
    sigma = float(hemt.polarization_charge(x))           # C/m²
    return eps, phi_b, dEc, sigma


def thomas(a, b, c, d):
    """Solve a tridiagonal system: a sub-, b main-, c super-diagonal (len N, a[0], c[-1] unused)."""
    n = len(b); cp = np.empty(n); dp = np.empty(n)
    cp[0] = c[0] / b[0]; dp[0] = d[0] / b[0]
    for i in range(1, n):
        den = b[i] - a[i] * cp[i - 1]
        cp[i] = c[i] / den if i < n - 1 else 0.0
        dp[i] = (d[i] - a[i] * dp[i - 1]) / den
    x = np.empty(n); x[-1] = dp[-1]
    for i in range(n - 2, -1, -1):
        x[i] = dp[i] - cp[i] * x[i + 1]
    return x


def hemt_sp(x=0.25, d_nm=20.0, T=300.0, depth_nm=50.0, dz_nm=0.2, m_gan=0.2, m_algan=None,
            nstates=4, iters=60, Vg=0.0, tol=1e-7):
    """Self-consistent conduction band, subbands and 2DEG density.

    z = 0 is the surface (gate), the AlGaN/GaN interface is at z = d, E_F = 0.
    Boundary: E_c(0) = φ_b − V_G; zero field deep in the GaN.
    Each outer step solves Schrödinger in the current potential, then a
    nonlinear Poisson equation by Newton's method in which the electron density
    responds to potential changes through the fixed wavefunctions
    (predictor–corrector of Trellakis et al., J. Appl. Phys. 81, 7880 (1997)).
    """
    if m_algan is None:
        m_algan = 0.2 + 0.2 * x
    eps_b, phi_b, dEc, sigma = algan_params(x)
    N = int(round(depth_nm / dz_nm)) + 1
    z = np.arange(N) * dz_nm
    dz = dz_nm * 1e-9
    iface = int(round(d_nm / dz_nm))
    epsr = np.where(np.arange(N) < iface, eps_b, 8.9)
    m = np.where(np.arange(N) < iface, m_algan, m_gan)
    dEc_prof = np.where(np.arange(N) < iface, dEc, 0.0)
    kT = KB_EV * T
    g2d = m_gan * M0 * kT * QE / (math.pi * HBAR ** 2)          # m⁻²
    ef = 2 * epsr[:-1] * epsr[1:] / (epsr[:-1] + epsr[1:]) * EPS0
    lo = np.zeros(N); di = np.zeros(N); up = np.zeros(N)
    for i in range(1, N):
        di[i] += ef[i - 1]; lo[i] = -ef[i - 1]
        if i < N - 1:
            di[i] += ef[i]; up[i] = -ef[i]
    rho_fix = np.zeros(N); rho_fix[iface] = sigma / dz
    phi0 = -(phi_b - Vg)
    # start: depletion solution with no electrons
    phi = thomas(lo * 0 + np.r_[0, lo[1:]], np.r_[1, di[1:]], np.r_[0, up[1:]], np.r_[phi0, rho_fix[1:] * dz * dz])
    Ec = dEc_prof - phi
    for it in range(iters):
        E, psi = solve_states(Ec, m, dz, nstates)
        Ek = Ec.copy()
        for _ in range(30):                                        # Newton on Poisson
            delta = (dEc_prof - phi) - Ek
            arg = (E[:, None] + delta[None, :]) / kT
            occ = np.log1p(np.exp(-np.clip(arg, -200, 200)))
            fd = 1.0 / (1.0 + np.exp(np.clip(arg, -200, 200)))
            n = g2d * (occ * psi ** 2).sum(0)
            dn = g2d / kT * (fd * psi ** 2).sum(0)                   # dn/dφ (m⁻³ per V)
            F = np.r_[0, 0]
            Aphi = di * phi + lo * np.r_[0, phi[:-1]] + up * np.r_[phi[1:], 0]
            F = Aphi - dz * dz * (rho_fix - QE * n)
            F[0] = phi[0] - phi0
            J_d = di + dz * dz * QE * dn; J_d[0] = 1
            J_l = lo.copy(); J_u = up.copy(); J_u[0] = 0
            step = thomas(J_l, J_d, J_u, -F)
            phi = phi + np.clip(step, -0.2, 0.2)
            if np.max(np.abs(step)) < 1e-9:
                break
        Ec_new = dEc_prof - phi
        change = float(np.max(np.abs(Ec_new - Ec)))
        Ec = Ec_new
        if change < tol:
            break
    E, psi = solve_states(Ec, m, dz, nstates)
    occ = np.log1p(np.exp(-np.clip(E / kT, -200, 200)))
    n = g2d * (occ[:, None] * psi ** 2).sum(0)
    ns = float(n.sum() * dz) * 1e-4
    return dict(z_nm=z, Ec=Ec, E=E, psi=psi, n=n * 1e-6, ns=ns, iters=it + 1, sigma=sigma,
                phi_b=phi_b, dEc=dEc, d_nm=d_nm, x=x, occ=occ * g2d * 1e-4)
