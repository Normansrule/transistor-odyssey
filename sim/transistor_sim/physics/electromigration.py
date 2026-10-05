"""Electromigration in a copper line: Korhonen stress model, Blech length, Black's law.

The electron wind pushes metal atoms toward the anode. In a line whose ends are
blocked (vias with barriers), the atoms pile up and build hydrostatic stress σ
(tensile at the cathode, compressive at the anode). Korhonen et al. (1993):
    ∂σ/∂t = ∂/∂x [ κ (∂σ/∂x + G) ],   κ = D_a B Ω / kT,   G = e Z* ρ j / Ω
with zero atom flux at both ends: ∂σ/∂x = −G there.
Steady state: σ is linear in x with slope −G, so the peak tensile stress is G L / 2.
A void nucleates when the cathode stress reaches σ_crit; if G L / 2 < σ_crit the
line never fails (Blech 1976):  (j L)_crit = 2 Ω σ_crit / (e Z* ρ).
In a long line the cathode stress grows like 2 G sqrt(κ t / π), so the time to
nucleate scales as (σ_crit / G)² / κ ∝ j⁻² exp(Ea / kT): Black's law with n = 2.

Parameters are teaching values for Cu with a dielectric cap: Ea = 0.9 eV, an
effective D0 calibrated so a 1 MA/cm² line at 105 °C lasts decades, B = 28 GPa,
Z* = 5 and σ_crit = 300 MPa, which give (jL)_crit ≈ 4000 A/cm, close to
measured copper values.
"""
from __future__ import annotations

import math

import numpy as np

KB_EV = 8.617333262e-5
KB = 1.380649e-23
QE = 1.602176634e-19

CU = dict(Ea=0.9, D0=1e-8, B=28e9, Omega=1.18e-29, Zstar=5.0, sigma_c=300e6, rho20=1.72e-8, alpha_T=0.0039)


def resistivity(T_C: float, p=CU) -> float:
    return p["rho20"] * (1 + p["alpha_T"] * (T_C - 20.0))


def kappa(T_C: float, p=CU) -> float:
    T = T_C + 273.15
    Da = p["D0"] * math.exp(-p["Ea"] / (KB_EV * T))
    return Da * p["B"] * p["Omega"] / (KB * T)


def G(j_MA_cm2: float, T_C: float, p=CU) -> float:
    """Stress gradient driving force (Pa/m)."""
    return QE * p["Zstar"] * resistivity(T_C, p) * j_MA_cm2 * 1e10 / p["Omega"]


def blech_product(T_C: float = 105.0, p=CU) -> float:
    """(j L)_crit in A/cm."""
    return 2 * p["Omega"] * p["sigma_c"] / (QE * p["Zstar"] * resistivity(T_C, p)) / 100.0


def blech_length_um(j_MA_cm2: float, T_C: float = 105.0, p=CU) -> float:
    return blech_product(T_C, p) / (j_MA_cm2 * 1e6) * 1e4


def t_nucleation_long(j_MA_cm2: float, T_C: float, p=CU) -> float:
    """Void nucleation time (s) for a semi-infinite line: σ(0,t) = 2 G sqrt(κ t/π) reaches σ_crit."""
    return math.pi / kappa(T_C, p) * (p["sigma_c"] / (2 * G(j_MA_cm2, T_C, p))) ** 2


def black_ratio(j1, T1, j2, T2, n: float = 2.0, Ea: float = CU["Ea"]) -> float:
    """MTTF(j2, T2) / MTTF(j1, T1) from Black's equation."""
    return (j1 / j2) ** n * math.exp(Ea / KB_EV * (1 / (T2 + 273.15) - 1 / (T1 + 273.15)))


class Line:
    """Finite-volume Korhonen solver (implicit Euler, tridiagonal), stress in Pa, x from cathode (0) to anode (L)."""

    def __init__(self, L_um: float, j_MA_cm2: float, T_C: float, nx: int = 81, p=CU):
        self.L = L_um * 1e-6
        self.nx = nx
        self.dx = self.L / nx
        self.x = (np.arange(nx) + 0.5) * self.dx
        self.k = kappa(T_C, p)
        self.G = G(j_MA_cm2, T_C, p)
        self.sigma = np.zeros(nx)
        self.t = 0.0
        self.p = p

    def step(self, dt: float, n: int = 1):
        """Advance n implicit steps. Flux between cells i, i+1: F = -κ((σ_{i+1}-σ_i)/dx + G); end fluxes are zero."""
        nx, r = self.nx, self.k * dt / self.dx ** 2
        a = np.full(nx, -r); c = np.full(nx, -r); b = np.full(nx, 1 + 2 * r)
        a[0] = 0; c[-1] = 0; b[0] = b[-1] = 1 + r
        src = np.zeros(nx)
        src[0] = self.k * self.G * dt / self.dx       # atoms leave the cathode cell: tension builds
        src[-1] = -self.k * self.G * dt / self.dx     # and pile up in the anode cell: compression
        for _ in range(n):
            self.sigma = _thomas(a, b, c, self.sigma + src)
            self.t += dt
        return self.sigma

    def cathode(self) -> float:
        """Stress at the cathode wall: the end cell plus half a cell of the boundary gradient (∂σ/∂x = −G)."""
        return float(self.sigma[0] + self.G * self.dx / 2)

    def steady(self) -> np.ndarray:
        return self.G * (self.L / 2 - self.x)


def _thomas(a, b, c, d):
    n = len(d)
    cp = np.empty(n); dp = np.empty(n)
    cp[0] = c[0] / b[0]; dp[0] = d[0] / b[0]
    for i in range(1, n):
        m = b[i] - a[i] * cp[i - 1]
        cp[i] = c[i] / m if i < n - 1 else 0.0
        dp[i] = (d[i] - a[i] * dp[i - 1]) / m
    x = np.empty(n); x[-1] = dp[-1]
    for i in range(n - 2, -1, -1):
        x[i] = dp[i] - cp[i] * x[i + 1]
    return x


def grid_cells(L_um: float, j_MA_cm2: float, T_C: float, p=CU) -> int:
    """Cells needed to resolve the stress boundary layer sqrt(κ t_nuc) with ~10 cells (between 81 and 1201)."""
    ell = math.sqrt(kappa(T_C, p) * t_nucleation_long(j_MA_cm2, T_C, p))
    return int(min(max(math.ceil(L_um * 1e-6 / (ell / 10)), 81), 1201))


def time_to_fail(L_um: float, j_MA_cm2: float, T_C: float, p=CU, nx: int | None = None, max_steps: int = 6000) -> float:
    """Simulated void-nucleation time (s); inf if the line is Blech-immortal."""
    if G(j_MA_cm2, T_C, p) * L_um * 1e-6 / 2 < p["sigma_c"]:
        return float("inf")
    line = Line(L_um, j_MA_cm2, T_C, nx or grid_cells(L_um, j_MA_cm2, T_C, p), p)
    t_est = min(t_nucleation_long(j_MA_cm2, T_C, p), line.L ** 2 / line.k)
    dt = t_est / 400
    prev_s, prev_t = 0.0, 0.0
    for _ in range(max_steps):
        line.step(dt)
        s1 = line.cathode()
        if s1 >= p["sigma_c"]:
            return prev_t + dt * (p["sigma_c"] - prev_s) / (s1 - prev_s)
        prev_s, prev_t = s1, line.t
    return float("inf")
