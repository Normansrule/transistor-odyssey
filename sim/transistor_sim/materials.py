"""Material figures of merit for switching and RF devices.

* Baliga figure of merit (BFOM) = eps_r * mu * Ec^3  — conduction loss of a
  unipolar power switch at a given blocking voltage (Baliga 1982).
* Johnson figure of merit (JFOM) = (Ec * vsat / 2 pi)^2 — power-frequency
  product of an RF transistor (Johnson 1965).
* Thermal figure: k, because heat leaves the channel through the substrate.

All values are normalised to silicon so that Si = 1.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "data" / "materials.json"


def load_materials(path: Path = DATA) -> list[dict]:
    return json.loads(Path(path).read_text())["materials"]


def bfom(m: dict) -> float | None:
    if m.get("Ec_MVcm") is None or m.get("eps_r") is None:
        return None
    return m["eps_r"] * m["mu_n"] * m["Ec_MVcm"] ** 3


def jfom(m: dict) -> float | None:
    if m.get("Ec_MVcm") is None or m.get("vsat") is None:
        return None
    return (m["Ec_MVcm"] * 1e6 * m["vsat"] * 1e7 / (2 * math.pi)) ** 2


def normalised_table(materials: list[dict] | None = None) -> list[dict]:
    mats = materials or load_materials()
    si = next(m for m in mats if m["id"] == "Si")
    b0, j0 = bfom(si), jfom(si)
    rows = []
    for m in mats:
        b, j = bfom(m), jfom(m)
        rows.append({
            "id": m["id"], "name": m["name"], "Eg_eV": m["Eg_eV"],
            "BFOM_rel_Si": None if b is None else b / b0,
            "JFOM_rel_Si": None if j is None else j / j0,
            "k_rel_Si": None if m.get("k_WcmK") is None else m["k_WcmK"] / si["k_WcmK"],
        })
    return rows


def breakdown_voltage_drift(ec_mvcm: float, thickness_um: float) -> float:
    """Ideal punch-through-free blocking voltage of a triangular-field drift region, V."""
    return 0.5 * ec_mvcm * 1e6 * thickness_um * 1e-4


def specific_on_resistance(m: dict, vb: float) -> float | None:
    """Ideal drift-region R_on,sp = 4 V_B^2 / (eps mu Ec^3) in mOhm*cm^2."""
    b = bfom(m)
    if b is None:
        return None
    eps = m["eps_r"] * 8.8541878128e-14            # F/cm
    ec = m["Ec_MVcm"] * 1e6                        # V/cm
    ron = 4 * vb ** 2 / (eps * m["mu_n"] * ec ** 3)  # Ohm*cm^2
    return ron * 1e3
