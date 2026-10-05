"""Thermal oxidation of silicon: the Deal–Grove model.

Oxidant diffuses through the oxide already grown and reacts at the Si/SiO2
interface. Balancing the flux through the oxide with the reaction rate gives
    x^2 + A x = B (t + tau)
with parabolic constant B (diffusion-limited) and linear constant B/A
(reaction-limited). Both follow Arrhenius laws (Deal & Grove 1965):
    B = C1 exp(-E1/kT),   B/A = C2 exp(-E2/kT)
Values for (111) silicon at 1 atm (Hollauer, after Deal & Grove); for (100)
silicon C2 is divided by 1.68. Both constants scale linearly with oxidant
partial pressure. Dry oxidation starts from an effective initial thickness of
25 nm (the fast initial regime that Deal–Grove does not describe); wet starts
from zero. Each nanometre of oxide consumes 0.44 nm of silicon.
"""
from __future__ import annotations

import math

import numpy as np

KB = 8.617333262e-5  # eV/K

AMBIENTS = {
    "dry": dict(C1=7.72e2, E1=1.23, C2=6.23e6, E2=2.00, xi_um=0.025, name="Dry O₂"),
    "wet": dict(C1=3.86e2, E1=0.78, C2=1.63e8, E2=2.05, xi_um=0.0, name="Wet H₂O (steam)"),
}
ORIENT = {"111": 1.0, "100": 1.0 / 1.68}
SI_CONSUMED = 0.44


def rate_constants(ambient: str, T_C: float, orient: str = "100", p_atm: float = 1.0) -> tuple[float, float]:
    """(B in µm²/h, B/A in µm/h) at temperature T_C (°C)."""
    a = AMBIENTS[ambient]
    T = T_C + 273.15
    B = a["C1"] * math.exp(-a["E1"] / (KB * T)) * p_atm
    BA = a["C2"] * math.exp(-a["E2"] / (KB * T)) * ORIENT[orient] * p_atm
    return B, BA


def thickness(ambient: str, T_C: float, t_h, orient: str = "100", p_atm: float = 1.0, x0_um: float | None = None):
    """Oxide thickness (µm) after t_h hours, starting from x0 (default: the ambient's initial thickness)."""
    B, BA = rate_constants(ambient, T_C, orient, p_atm)
    A = B / BA
    xi = AMBIENTS[ambient]["xi_um"] if x0_um is None else x0_um
    tau = (xi * xi + A * xi) / B
    t = np.asarray(t_h, dtype=float)
    return (-A + np.sqrt(A * A + 4 * B * (t + tau))) / 2


def time_to(ambient: str, T_C: float, x_um: float, orient: str = "100", p_atm: float = 1.0, x0_um: float | None = None) -> float:
    """Hours needed to reach x_um."""
    B, BA = rate_constants(ambient, T_C, orient, p_atm)
    A = B / BA
    xi = AMBIENTS[ambient]["xi_um"] if x0_um is None else x0_um
    return max((x_um * x_um + A * x_um - xi * xi - A * xi) / B, 0.0)


def growth_rate(ambient: str, T_C: float, x_um: float, orient: str = "100", p_atm: float = 1.0) -> float:
    """dx/dt (µm/h) at thickness x: B / (2x + A)."""
    B, BA = rate_constants(ambient, T_C, orient, p_atm)
    return B / (2 * x_um + B / BA)


def regime(ambient: str, T_C: float, x_um: float, orient: str = "100") -> float:
    """Fraction of the 'resistance' due to diffusion: 2x / (2x + A); 0 = reaction-limited, 1 = diffusion-limited."""
    B, BA = rate_constants(ambient, T_C, orient)
    A = B / BA
    return 2 * x_um / (2 * x_um + A)
