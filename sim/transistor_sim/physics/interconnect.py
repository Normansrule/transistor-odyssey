"""On-chip wires: resistivity size effects, capacitance, RC delay and repeaters.

Resistivity of a line of width w and height h (Matthiessen's rule):
    rho = rho_MS(D) + rho0 (3/8) C (1 - p) lambda (1/w + 1/h)          surface scattering (Fuchs-Sondheimer, wire form)
    rho0 / rho_MS = 1 - 3a/2 + 3a^2 - 3a^3 ln(1 + 1/a),  a = (lambda/D) R/(1 - R)   grain boundaries (Mayadas-Shatzkes)
with grain size D ~ min(w, h), specularity p = 0, C = 1.2 and reflection R = 0.4.
Copper needs a barrier and liner (~2 nm of TaN/Ta or TaN/Co) that carries almost no
current, so its conducting cross-section is (w - 2t)(h - t); Ru, Co and W can be used
without one (0.3 nm adhesion layer assumed).

Capacitance per length to neighbours at spacing s and planes at distance t (= h):
    c = eps0 k [ 2 h/s + 2 w/t + 1.8 ]                      (parallel plates + fringe)
Delay of a driver R_d into a distributed line (r, c per length) of length L with load C_L (Elmore):
    t50 = 0.69 R_d (cL + C_L) + 0.38 r c L^2 + 0.69 r L C_L
Optimally repeated line: t ~ 2.5 L sqrt(R_d C_d r c)  (Rabaey et al., ch. 9).
The line itself obeys the diffusion equation  dV/dt = (1 / r c) d^2V/dx^2, solved here with
Crank-Nicolson for the animation; for an ideal step source the solution is erfc(x / 2 sqrt(t / r c)).
Sources: Sondheimer, Adv. Phys. 1, 1 (1952); Mayadas & Shatzkes, Phys. Rev. B 1, 1382 (1970);
Gall, J. Appl. Phys. 119, 085101 (2016); Elmore, J. Appl. Phys. 19, 55 (1948).
"""
from __future__ import annotations

import math

import numpy as np

EPS0 = 8.8541878128e-12

# bulk resistivity (µOhm cm) and bulk electron mean free path (nm), after Gall (2016)
METALS = {
    "Cu": dict(rho0=1.68, lam=39.9, barrier=2.0, name="Copper"),
    "Co": dict(rho0=5.6, lam=11.8, barrier=0.3, name="Cobalt"),
    "Ru": dict(rho0=7.1, lam=6.6, barrier=0.3, name="Ruthenium"),
    "W": dict(rho0=5.3, lam=15.5, barrier=0.3, name="Tungsten"),
}
C_FS, P_SPEC, R_GB = 1.2, 0.0, 0.4


def resistivity(metal: str, w_nm: float, h_nm: float) -> float:
    """Effective resistivity (µOhm cm) of the metal core of a w x h line."""
    m = METALS[metal]
    lam, rho0 = m["lam"], m["rho0"]
    D = min(w_nm, h_nm)
    a = lam / D * R_GB / (1 - R_GB)
    ms = 1 - 1.5 * a + 3 * a * a - 3 * a ** 3 * math.log(1 + 1 / a)
    rho = rho0 / ms + rho0 * 0.375 * C_FS * (1 - P_SPEC) * lam * (1 / w_nm + 1 / h_nm)
    return rho


def r_per_um(metal: str, w_nm: float, h_nm: float, barrier_nm: float | None = None) -> float:
    """Line resistance in Ohm per µm, counting only the conducting core."""
    t = METALS[metal]["barrier"] if barrier_nm is None else barrier_nm
    wc, hc = max(w_nm - 2 * t, 0.5), max(h_nm - t, 0.5)
    rho = resistivity(metal, wc, hc) * 1e-8                 # Ohm m
    return rho / (wc * hc * 1e-18) * 1e-6


def c_per_um(w_nm: float, h_nm: float, s_nm: float, k: float = 2.7) -> float:
    """Line capacitance in F per µm (neighbours on both sides plus layers above and below)."""
    return EPS0 * k * (2 * h_nm / s_nm + 2 * w_nm / h_nm + 1.8) * 1e-6


def elmore_delay(r: float, c: float, L_um: float, Rd: float, CL: float) -> float:
    """50% delay (s) of a driver Rd (Ohm) into a line r, c per µm, length L_um, load CL (F)."""
    return 0.69 * Rd * (c * L_um + CL) + 0.38 * r * c * L_um ** 2 + 0.69 * r * L_um * CL


def repeated_delay(r: float, c: float, L_um: float, Rd: float, Cd: float) -> tuple[float, int]:
    """Delay with the optimum number of identical repeaters (each Rd, Cd), and that number."""
    k = max(1, round(math.sqrt(0.38 * r * c * L_um ** 2 / (0.69 * Rd * Cd))))
    seg = L_um / k
    return k * elmore_delay(r, c, seg, Rd, Cd), k


def line_step(r: float, c: float, L_um: float, Rd: float, CL: float, t_end: float, nx: int = 101, nt: int = 400):
    """Crank-Nicolson solution of the RC line driven through Rd by a 1 V step; returns x (µm), t (s), V[t, x]."""
    dx = L_um / (nx - 1)
    Cn = np.full(nx, c * dx); Cn[0] *= 0.5; Cn[-1] = 0.5 * c * dx + CL
    G = 1 / (r * dx)
    # nodal matrix  C dV/dt = -K V + b
    K = np.zeros((nx, nx))
    for i in range(nx - 1):
        K[i, i] += G; K[i + 1, i + 1] += G; K[i, i + 1] -= G; K[i + 1, i] -= G
    K[0, 0] += 1 / Rd
    b = np.zeros(nx); b[0] = 1 / Rd
    dt = t_end / nt
    A = np.diag(Cn / dt) + 0.5 * K
    Bm = np.diag(Cn / dt) - 0.5 * K
    V = np.zeros(nx); out = [V.copy()]
    Ainv = np.linalg.inv(A)
    for _ in range(nt):
        V = Ainv @ (Bm @ V + b)
        out.append(V.copy())
    return np.linspace(0, L_um, nx), np.linspace(0, t_end, nt + 1), np.array(out)


def erfc_step(x_um, t, r, c):
    """Ideal-source step response of a semi-infinite RC line."""
    from math import erfc
    return np.array([erfc(xx / (2 * math.sqrt(t / (r * c)))) if t > 0 else 0.0 for xx in np.atleast_1d(x_um)])
