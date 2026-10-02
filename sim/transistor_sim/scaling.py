"""Scaling laws: Moore's doubling time and Dennard's constant-field rules."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]


def load_chips() -> list[dict]:
    return json.loads((ROOT / "data" / "chips.json").read_text())["chips"]


def moore_fit(chips: list[dict] | None = None, family: tuple[str, ...] = ("planar", "3d"),
              exclude: tuple[str, ...] = ("wse3", "ibm07")):
    """Least-squares fit of log2(transistors) vs year for production chips.

    Returns (doubling_time_years, slope, intercept).
    """
    chips = chips or load_chips()
    pts = [(c["year"], c["transistors"]) for c in chips
           if c["family"] in family and c["id"] not in exclude]
    years = np.array([p[0] for p in pts], dtype=float)
    logs = np.log2(np.array([p[1] for p in pts], dtype=float))
    slope, intercept = np.polyfit(years, logs, 1)
    return 1.0 / slope, slope, intercept


def dennard(k: float) -> dict:
    """Constant-field scaling by factor k > 1 (Dennard et al. 1974, Table I)."""
    return {
        "dimensions (L, W, tox)": 1 / k,
        "voltage V": 1 / k,
        "doping N_A": k,
        "current I": 1 / k,
        "capacitance C": 1 / k,
        "gate delay CV/I": 1 / k,
        "power per circuit VI": 1 / k ** 2,
        "circuit density": k ** 2,
        "power density": 1.0,
    }


def dennard_breakdown_note() -> str:
    return ("Subthreshold swing is fixed near 60 mV/decade at 300 K, so V_T cannot fall "
            "with V_DD without exponential leakage. Once supply voltage stalled near 1 V "
            "(~2005), power density rose with density and clock frequency plateaued.")


# Supply voltage and representative top clock by year (Intel desktop parts),
# used for the Dennard-breakdown figure. Sources: data/nodes.csv, chip datasheets.
CLOCK_MHZ = [
    (1971, 0.74), (1974, 2), (1978, 10), (1982, 12), (1985, 33), (1989, 50), (1993, 66),
    (1995, 200), (1997, 300), (1999, 733), (2000, 1500), (2002, 3060), (2004, 3800),
    (2006, 2930), (2008, 3200), (2011, 3500), (2014, 4000), (2017, 4500), (2020, 5300),
    (2022, 5800), (2024, 6000),
]
