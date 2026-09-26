"""Dopant ionization vs temperature — why diamond is hard to dope.

For a single acceptor level at E_A above the valence band (donors are the
mirror case), charge neutrality with compensation N_comp gives

    p (p + N_comp) / (N_A - N_comp - p) = K,   K = (N_V / g) exp(-E_A / kT)

which is a quadratic in p (Sze & Ng, ch. 1). N_V scales as T^1.5.
Boron in silicon (E_A = 0.045 eV) is fully ionized at room temperature;
boron in diamond (0.37 eV) is well under 1 % ionized, phosphorus in diamond
(0.57 eV) far less, and substitutional nitrogen (1.7 eV) essentially never.
That is why diamond FETs lean on surface transfer doping, delta doping or
hopping conduction instead of ordinary bulk doping.

Effective densities of states are representative literature values; treat
the curves as trends, not device specifications.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

KB_EV = 8.617333262e-5


@dataclass(frozen=True)
class Dopant:
    key: str
    label: str
    host: str
    kind: str          # "acceptor" or "donor"
    Ea_eV: float       # ionization energy from the band edge
    N_eff_300: float   # N_V (acceptor) or N_C (donor) at 300 K, cm^-3
    g: float           # degeneracy factor (4 acceptor, 2 donor)
    ref: str = ""


DOPANTS = {
    "Si:B": Dopant("Si:B", "Boron in silicon", "Si", "acceptor", 0.045, 1.83e19, 4, "sze2006"),
    "Si:P": Dopant("Si:P", "Phosphorus in silicon", "Si", "donor", 0.045, 2.8e19, 2, "sze2006"),
    "SiC:Al": Dopant("SiC:Al", "Aluminium in 4H-SiC", "4H-SiC", "acceptor", 0.20, 2.5e19, 4, "kimoto2014"),
    "SiC:N": Dopant("SiC:N", "Nitrogen in 4H-SiC", "4H-SiC", "donor", 0.06, 1.7e19, 2, "kimoto2014"),
    "GaN:Mg": Dopant("GaN:Mg", "Magnesium in GaN", "GaN", "acceptor", 0.17, 4.6e19, 4, "amano1989"),
    "GaN:Si": Dopant("GaN:Si", "Silicon in GaN", "GaN", "donor", 0.015, 2.3e18, 2, "mishra2002"),
    "C:B": Dopant("C:B", "Boron in diamond", "Diamond", "acceptor", 0.37, 1.8e19, 4, "isberg2002"),
    "C:P": Dopant("C:P", "Phosphorus in diamond", "Diamond", "donor", 0.57, 1.0e20, 2, "koizumi1997"),
    "C:N": Dopant("C:N", "Nitrogen in diamond", "Diamond", "donor", 1.7, 1.0e20, 2, "doherty2013"),
}


def ionized_fraction(d: Dopant, N: float, T, N_comp: float = 0.0):
    """Fraction of dopants ionized (free carriers / N) at temperature T (K)."""
    T = np.asarray(T, dtype=float)
    neff = d.N_eff_300 * (T / 300.0) ** 1.5
    K = neff / d.g * np.exp(-d.Ea_eV / (KB_EV * T))
    b = N_comp + K
    c = K * (N - N_comp)
    p = 0.5 * (-b + np.sqrt(b * b + 4 * c))
    return p / N


def carrier_density(d: Dopant, N: float, T, N_comp: float = 0.0):
    return ionized_fraction(d, N, T, N_comp) * N
