"""Die yield and cost.

Gross dies per wafer of diameter d for a die of area S (a common closed form):
    DPW = π (d/2)² / S − π d / sqrt(2 S)
Yield for defect density D0 (per cm²) on a die of area A:
    Poisson          Y = exp(−A D0)
    Murphy (1964)    Y = ((1 − exp(−A D0)) / (A D0))²
    Neg. binomial    Y = (1 + A D0 / α)^(−α)      (Stapper 1973; α = clustering, α → ∞ is Poisson)
Cost per good die = wafer cost / (DPW · Y).

The wafer map places dies on a square grid, keeps those fully inside the usable
radius (edge exclusion), and scatters defects as a Poisson process whose local
rate is gamma-distributed per die (mean D0, shape α), which reproduces the
negative-binomial yield in expectation.
"""
from __future__ import annotations

import math

import numpy as np


def dies_per_wafer(die_mm2: float, wafer_mm: float = 300.0) -> float:
    return math.pi * (wafer_mm / 2) ** 2 / die_mm2 - math.pi * wafer_mm / math.sqrt(2 * die_mm2)


def yield_model(die_mm2: float, D0_cm2: float, model: str = "negbin", alpha: float = 3.0) -> float:
    AD = die_mm2 / 100.0 * D0_cm2
    if AD <= 0:
        return 1.0
    if model == "poisson":
        return math.exp(-AD)
    if model == "murphy":
        return ((1 - math.exp(-AD)) / AD) ** 2
    return (1 + AD / alpha) ** (-alpha)


def cost_per_good_die(wafer_usd: float, die_mm2: float, D0_cm2: float, model: str = "negbin", alpha: float = 3.0, wafer_mm: float = 300.0) -> float:
    return wafer_usd / (dies_per_wafer(die_mm2, wafer_mm) * yield_model(die_mm2, D0_cm2, model, alpha))


def die_grid(die_w_mm: float, die_h_mm: float, wafer_mm: float = 300.0, edge_mm: float = 3.0, scribe_mm: float = 0.1):
    """Die centres (mm) fully inside the usable radius, on a grid centred to maximise the count."""
    R = wafer_mm / 2 - edge_mm
    px, py = die_w_mm + scribe_mm, die_h_mm + scribe_mm
    best = None
    for ox in (0.0, 0.5):
        for oy in (0.0, 0.5):
            cells = []
            n = int(R / min(px, py)) + 2
            for i in range(-n, n + 1):
                for j in range(-n, n + 1):
                    cx, cy = (i + ox) * px, (j + oy) * py
                    corners = [(cx + sx * die_w_mm / 2, cy + sy * die_h_mm / 2) for sx in (-1, 1) for sy in (-1, 1)]
                    if all(math.hypot(a, b) <= R for a, b in corners):
                        cells.append((cx, cy))
            if best is None or len(cells) > len(best):
                best = cells
    return best


def mulberry32(seed: int):
    """Small deterministic PRNG shared with the browser twin."""
    state = [seed & 0xFFFFFFFF]

    def rnd() -> float:
        state[0] = (state[0] + 0x6D2B79F5) & 0xFFFFFFFF
        t = state[0]
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0
    return rnd


def _gamma(rnd, k: float) -> float:
    """Marsaglia–Tsang gamma(k, 1) using Box–Muller normals."""
    if k < 1:
        return _gamma(rnd, k + 1) * rnd() ** (1 / k)
    d = k - 1 / 3
    c = 1 / math.sqrt(9 * d)
    while True:
        u1, u2 = max(rnd(), 1e-12), rnd()
        x = math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
        v = (1 + c * x) ** 3
        if v <= 0:
            continue
        u = rnd()
        if math.log(max(u, 1e-300)) < 0.5 * x * x + d - d * v + d * math.log(v):
            return d * v


def _poisson(rnd, lam: float) -> int:
    L, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rnd()
        if p <= L:
            return k
        k += 1


def simulate_wafer(die_w_mm: float, die_h_mm: float, D0_cm2: float, alpha: float = 3.0, seed: int = 1, wafer_mm: float = 300.0) -> dict:
    """Monte Carlo wafer: defect count per die. Returns dies, defects per die, and the yield."""
    rnd = mulberry32(seed)
    dies = die_grid(die_w_mm, die_h_mm, wafer_mm)
    A = die_w_mm * die_h_mm / 100.0
    counts = []
    for _ in dies:
        lam = A * D0_cm2 * (_gamma(rnd, alpha) / alpha if math.isfinite(alpha) else 1.0)
        counts.append(_poisson(rnd, lam))
    good = sum(1 for c in counts if c == 0)
    return dict(dies=dies, defects=counts, good=good, yield_=good / max(len(dies), 1))
