"""One-dimensional quantum tunnelling by the transfer-matrix method.

The potential is split into piecewise-constant slabs. In slab j the solution is
    psi = A_j e^{i k_j x} + B_j e^{-i k_j x},   k_j = sqrt(2 m_j (E - V_j)) / hbar
(k is imaginary inside a barrier). Continuity of psi and psi'/m at each
interface links (A, B) across it; multiplying the interface matrices gives the
total transmission T = (k_out m_in / k_in m_out) |1 / M_22 ...|^2.
Checked against the analytic rectangular barrier (Griffiths, Introduction to
Quantum Mechanics, eq. 2.169):
    T = [1 + V0^2 sinh^2(kappa a) / (4 E (V0 - E))]^-1.
The gate-leakage helper puts a trapezoidal barrier (conduction-band offset
phi_B, field V_ox / t) between two silicon electrodes and reports T at the
conduction-band edge energy plus kT; leakage current scales with it.
"""
from __future__ import annotations

import math

import numpy as np

HBAR = 1.054571817e-34
M0 = 9.1093837015e-31
QE = 1.602176634e-19


def _k(E, V, m):
    return np.sqrt(2 * m * M0 * (E - V) * QE + 0j) / HBAR


def transfer(E, V, widths_nm, m=None, m_out=1.0):
    """Transmission through slabs.

    E : energy (eV); V : list of slab potentials (eV); widths_nm : slab widths.
    Leads on both sides sit at V=0 with mass m_out. Returns (T, coeffs) where
    coeffs are the (A, B) amplitudes in every region, incident amplitude 1.
    """
    V = list(V)
    w = [x * 1e-9 for x in widths_nm]
    if m is None:
        m = [m_out] * len(V)
    pots = [0.0] + V + [0.0]
    mass = [m_out] + list(m) + [m_out]
    ks = [_k(E, v, mm) for v, mm in zip(pots, mass)]
    ks = [k if abs(k) > 1e-12 else 1e-12 + 0j for k in ks]
    xs = np.concatenate([[0.0], np.cumsum(w)])  # interface positions
    M = np.eye(2, dtype=complex)
    det = 1.0 + 0j  # det of each interface matrix is r exactly; avoids cancellation
    mats = []
    for j in range(len(pots) - 1):
        x = xs[j]
        k1, k2 = ks[j], ks[j + 1]
        r = (k1 / mass[j]) / (k2 / mass[j + 1])
        # (A2,B2) = D (A1,B1)
        D = 0.5 * np.array([
            [(1 + r) * np.exp(1j * (k1 - k2) * x), (1 - r) * np.exp(-1j * (k1 + k2) * x)],
            [(1 - r) * np.exp(1j * (k1 + k2) * x), (1 + r) * np.exp(-1j * (k1 - k2) * x)],
        ])
        mats.append(D)
        det *= r
        M = D @ M
    # outgoing: B_N = 0 -> M21 A0 + M22 B0 = 0 -> B0 = -M21/M22 (A0 = 1)
    B0 = -M[1, 0] / M[1, 1]
    coeffs = [np.array([1.0 + 0j, B0])]
    for D in mats:
        coeffs.append(D @ coeffs[-1])
    t = det / M[1, 1]  # stable even when T is tiny
    T = float(np.real(ks[-1] / mass[-1]) / np.real(ks[0] / mass[0]) * abs(t) ** 2)
    return T, dict(k=ks, x=xs, coeffs=coeffs, pots=pots)


def rect_analytic(E, V0, a_nm, m=1.0):
    a = a_nm * 1e-9
    if E < V0:
        kap = math.sqrt(2 * m * M0 * (V0 - E) * QE) / HBAR
        return 1.0 / (1 + V0 ** 2 * math.sinh(kap * a) ** 2 / (4 * E * (V0 - E)))
    k = math.sqrt(2 * m * M0 * (E - V0) * QE) / HBAR
    return 1.0 / (1 + V0 ** 2 * math.sin(k * a) ** 2 / (4 * E * (E - V0)))


def wavefunction(E, V, widths_nm, m=None, lead_nm=3.0, npts=600):
    """psi(x) (complex) on a grid spanning the structure plus leads."""
    T, info = transfer(E, V, widths_nm, m)
    xs = info["x"]
    x = np.linspace(-lead_nm * 1e-9, xs[-1] + lead_nm * 1e-9, npts)
    psi = np.zeros(npts, dtype=complex)
    region = np.searchsorted(xs, x, side="right")
    for j in range(len(info["k"])):
        sel = region == j
        A, B = info["coeffs"][j]
        k = info["k"][j]
        psi[sel] = A * np.exp(1j * k * x[sel]) + B * np.exp(-1j * k * x[sel])
    return x * 1e9, psi, T


# Gate dielectrics: conduction-band offset to Si (eV), tunnelling mass, k
DIELECTRICS = {
    "SiO2": dict(phiB=3.1, m=0.50, k=3.9),
    "Si3N4": dict(phiB=2.1, m=0.50, k=7.5),
    "Al2O3": dict(phiB=2.8, m=0.35, k=9.0),
    "HfO2": dict(phiB=1.5, m=0.20, k=25.0),
}


def oxide_transmission(t_nm, diel="SiO2", Vox=1.0, E=0.0259, nslab=60):
    """Transmission through a trapezoidal barrier of physical thickness t_nm."""
    d = DIELECTRICS[diel]
    xs = (np.arange(nslab) + 0.5) / nslab
    V = d["phiB"] - Vox * xs
    T, _ = transfer(E, list(V), [t_nm / nslab] * nslab, m=[d["m"]] * nslab, m_out=0.26)
    return T


def stack_transmission(eot_nm, diel="HfO2", il_nm=0.0, Vox=1.0, E=0.0259, nslab=80):
    """Transmission through an interfacial SiO2 layer (il_nm) plus a high-k film.

    The high-k thickness is chosen so the stack has the requested EOT; the
    oxide voltage drops across each layer in proportion to its EOT share.
    """
    d = DIELECTRICS[diel]
    il = min(il_nm, eot_nm)
    t_hk = (eot_nm - il) * d["k"] / 3.9
    layers = []  # (thickness, phiB, m, eot share)
    if il > 0:
        layers.append((il, DIELECTRICS["SiO2"]["phiB"], DIELECTRICS["SiO2"]["m"], il / eot_nm))
    if t_hk > 0:
        layers.append((t_hk, d["phiB"], d["m"], (eot_nm - il) / eot_nm))
    V, W, M = [], [], []
    drop = 0.0
    for t, phiB, m, share in layers:
        n = max(4, int(nslab * t / sum(l[0] for l in layers)))
        for i in range(n):
            f = (i + 0.5) / n
            V.append(phiB - drop - Vox * share * f)
            W.append(t / n)
            M.append(m)
        drop += Vox * share
    T, _ = transfer(E, V, W, m=M, m_out=0.26)
    return T


def leakage_vs_eot(eot_nm, diel="SiO2", Vox=1.0, il_nm=0.0):
    """T at each EOT; a pure film has physical thickness EOT * k / 3.9."""
    return np.array([stack_transmission(e, diel, il_nm, Vox) for e in np.atleast_1d(eot_nm)])
