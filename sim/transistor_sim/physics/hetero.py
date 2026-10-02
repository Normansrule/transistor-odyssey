"""Equilibrium (and biased) band diagram of an abrupt heterojunction.

Solves the one-dimensional Poisson equation with Boltzmann carrier statistics
across two materials joined at x = 0, with Anderson's electron-affinity rule
for the band alignment:

    d/dx( eps dEvac/dx ) = q (p - n + Nd - Na)            (Evac in eV)
    Ec = Evac - chi,  Ev = Ec - Eg
    n  = Nc exp((EF - Ec)/kT),   p = Nv exp((Ev - EF)/kT)

Boundary conditions: charge neutrality far from the junction on each side.
An applied voltage V (left contact relative to right) shifts the left Fermi
level to EF = -V. Inside the junction the electron quasi-Fermi level is taken
flat from the side that has more electrons and the hole quasi-Fermi level from
the side that has more holes: the usual ideal-diode approximation.
Newton's method with a damped update solves the nonlinear equation on a grid
that is fine near the interface and coarse in the neutral regions.

What it leaves out: interface dipoles and traps, polarization charge (GaN;
see qwell.hemt_sp), quantization, degeneracy and incomplete ionization.
Sources: R. L. Anderson, Solid-State Electron. 5, 341 (1962); Sze & Ng,
Physics of Semiconductor Devices, 3rd ed., ch. 2.
"""
from __future__ import annotations

import math

import numpy as np

K_B = 8.617333262e-5          # eV/K
Q = 1.602176634e-19           # C
EPS0 = 8.8541878128e-14       # F/cm


def neutral(mat: dict, dop: float, T: float = 300.0):
    """Bulk carrier densities and Ec - EF (eV) for net doping dop = Nd - Na (cm^-3)."""
    kT = K_B * T
    ni2 = mat["Nc"] * mat["Nv"] * math.exp(-mat["Eg"] / kT)
    n = 0.5 * dop + math.sqrt(0.25 * dop * dop + ni2) if dop >= 0 else ni2 / (-0.5 * dop + math.sqrt(0.25 * dop * dop + ni2))
    n = max(n, 1e-300)
    return n, ni2 / n, kT * math.log(mat["Nc"] / n)


def grid(L_cm: float, npts: int = 601, a: float = 6.0):
    """Symmetric sinh-graded grid on [-L, L] with a node at x = 0."""
    t = np.linspace(-1.0, 1.0, npts)
    x = L_cm * np.sinh(a * t) / math.sinh(a)
    x[npts // 2] = 0.0
    return x


def solve(A: dict, B: dict, dopA: float, dopB: float, V: float = 0.0, T: float = 300.0,
          npts: int = 601, tol: float = 1e-9, max_iter: int = 200) -> dict:
    """A, B: dicts with chi, Eg, eps, Nc, Nv. dop = Nd - Na (cm^-3, sign gives type).

    Returns x (nm), Ec, Ev, Evac (eV), EFA, EFB, EFn, EFp (eV, EF_right = 0), n, p (cm^-3), rho (C/cm^3), field (V/cm)
    and scalars Vbi, VA, VB (band bending on each side, V), W (nm) and the interface sheet
    densities of electrons and holes (cm^-2) in excess of the bulk.
    """
    kT = K_B * T
    nA, pA, dA = neutral(A, dopA, T)
    nB, pB, dB = neutral(B, dopB, T)
    insA, insB = A.get("kind") == "insulator", B.get("kind") == "insulator"
    if insA or insB:          # an insulator holds no charge: no transfer, no bias drop, flat bands
        V = 0.0
        if insB:
            dB = A["chi"] + dA - B["chi"]
        else:
            dA = B["chi"] + dB - A["chi"]
        nA, pA = A["Nc"] * math.exp(-dA / kT), A["Nv"] * math.exp(-(A["Eg"] - dA) / kT)
        nB, pB = B["Nc"] * math.exp(-dB / kT), B["Nv"] * math.exp(-(B["Eg"] - dB) / kT)
        dopA, dopB = (nA - pA if insA else dopA), (nB - pB if insB else dopB)
    EFA, EFB = -V, 0.0
    # quasi-Fermi levels: electrons follow the side that has more of them, holes likewise
    EFn = EFA if nA > nB else EFB
    EFp = EFA if pA > pB else EFB
    evacA = EFA + dA + A["chi"]
    evacB = EFB + dB + B["chi"]
    Vbi = (A["chi"] + dA) - (B["chi"] + dB)          # work-function difference
    U = abs(evacA - evacB) + 0.1
    Nmin = max(min(abs(dopA) + math.sqrt(nA * pA), abs(dopB) + math.sqrt(nB * pB)), 1e13)
    epsm = max(A["eps"], B["eps"]) * EPS0
    W = math.sqrt(2 * epsm * U / (Q * Nmin))
    LD = math.sqrt(epsm * kT / (Q * Nmin))
    L = min(max(2.2 * W + 8 * LD, 6e-6), 4e-3)
    a = 6.0                                           # grade harder for long domains: finest step <= 0.3 nm
    while a < 12.0 and L * a / math.sinh(a) * 2 / (npts - 1) > 3e-8:
        a += 0.25
    x = grid(L, npts, a)
    left = x < 0
    pick = lambda k: np.where(left, A[k], B[k]).astype(float)
    chi, Eg, Nc, Nv = pick("chi"), pick("Eg"), pick("Nc"), pick("Nv")
    eps = pick("eps") * EPS0
    dop = np.where(left, dopA, dopB).astype(float)
    h = np.diff(x)
    em = 0.5 * (eps[:-1] + eps[1:])                   # eps at half nodes
    # initial guess: smooth step between the two neutral vacuum levels
    E = evacB + (evacA - evacB) * 0.5 * (1 - np.tanh(x / max(W, 1e-7)))
    E[0], E[-1] = evacA, evacB
    for it in range(max_iter):
        Ec = E - chi
        n = Nc * np.exp(np.clip((EFn - Ec) / kT, -700, 700))
        p = Nv * np.exp(np.clip((Ec - Eg - EFp) / kT, -700, 700))
        flux = em * np.diff(E) / h
        F = np.zeros_like(E)
        hc = 0.5 * (h[:-1] + h[1:])
        F[1:-1] = (flux[1:] - flux[:-1]) / hc - Q * (p - n + dop)[1:-1]
        lower = em[:-1] / h[:-1] / hc
        upper = em[1:] / h[1:] / hc
        diag = -(lower + upper) - Q * (n + p)[1:-1] / kT
        dE = _thomas(lower[1:], diag, upper[:-1], -F[1:-1])
        step = np.clip(dE, -0.25, 0.25)
        E[1:-1] += step
        if np.max(np.abs(dE)) < tol:
            break
    Ec = E - chi
    Ev = Ec - Eg
    n = Nc * np.exp(np.clip((EFn - Ec) / kT, -700, 700))
    p = Nv * np.exp(np.clip((Ev - EFp) / kT, -700, 700))
    rho = Q * (p - n + dop)
    field = np.gradient(E, x)                         # electric field (V/cm): dEvac/dx = -dphi/dx
    i0 = int(np.searchsorted(x, 0.0))
    VA, VB = E[i0] - E[0], E[-1] - E[i0]
    # space-charge width on each side: where the bending has fallen to 10% of its total,
    # scaled by 1/(1 - sqrt(0.1)) so that a depletion-approximation parabola gives its width
    def edge(sel, bulk, Vs):
        far = np.abs(E[sel] - bulk) > 0.1 * abs(Vs) + 1e-6
        return float(np.max(np.abs(x[sel][far])) / (1 - math.sqrt(0.1))) if far.any() and abs(Vs) > 1e-4 else 0.0
    wA, wB = edge(left, evacA, VA), edge(~left, evacB, VB)
    W_nm = float((wA + wB) * 1e7)
    # interface sheet charge within +/- 30 nm, in excess of the bulk densities
    win = np.abs(x) < 3e-6
    wts = np.gradient(x)
    ns = float(np.sum(np.clip(n - np.where(left, nA, nB), 0, None)[win] * wts[win]))
    ps = float(np.sum(np.clip(p - np.where(left, pA, pB), 0, None)[win] * wts[win]))
    return dict(x_nm=x * 1e7, Ec=Ec, Ev=Ev, Evac=E, EFA=EFA, EFB=EFB, EFn=EFn, EFp=EFp, n=n, p=p, rho=rho, field=field,
                Vbi=Vbi, VA=float(VA), VB=float(VB), W_nm=W_nm, wA_nm=float(wA * 1e7), wB_nm=float(wB * 1e7), ns=ns, ps=ps, iters=it + 1,
                dEc=A["chi"] - B["chi"], dEv=(A["chi"] + A["Eg"]) - (B["chi"] + B["Eg"]), i0=i0)


def _thomas(a, b, c, d):
    """Tridiagonal solve: a sub-diagonal (n-1), b diagonal (n), c super-diagonal (n-1)."""
    n = len(b)
    cp, dp = np.zeros(n), np.zeros(n)
    cp[0] = c[0] / b[0] if n > 1 else 0.0
    dp[0] = d[0] / b[0]
    for i in range(1, n):
        m = b[i] - a[i - 1] * cp[i - 1]
        cp[i] = c[i] / m if i < n - 1 else 0.0
        dp[i] = (d[i] - a[i - 1] * dp[i - 1]) / m
    out = np.zeros(n)
    out[-1] = dp[-1]
    for i in range(n - 2, -1, -1):
        out[i] = dp[i] - cp[i] * out[i + 1]
    return out
