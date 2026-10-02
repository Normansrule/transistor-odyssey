"""Atom positions for the crystal structures behind each transistor material.

* diamond cubic (Fd-3m): Si, Ge, C (diamond) — fcc lattice + basis (0,0,0), (1/4,1/4,1/4)
* zincblende (F-43m): GaAs — same sites, two species
* wurtzite (P6_3mc): GaN — hexagonal, u ~ 0.377
* 4H polytype (P6_3mc): 4H-SiC — Si-C bilayers stacked ABCB
* 2H monolayer: MoS2 — trigonal-prismatic Mo between two S planes
Lattice constants (Å) at room temperature: Ioffe NSM archive; Wilson & Yoffe,
Adv. Phys. 18, 193 (1969) for MoS2.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np

STRUCTURES = {
    "Si":      dict(kind="diamond", a=5.431, species=("Si", "Si"), label="Silicon", group="Fd-3m (diamond cubic)"),
    "Ge":      dict(kind="diamond", a=5.658, species=("Ge", "Ge"), label="Germanium", group="Fd-3m (diamond cubic)"),
    "Diamond": dict(kind="diamond", a=3.567, species=("C", "C"), label="Diamond", group="Fd-3m (diamond cubic)"),
    "GaAs":    dict(kind="diamond", a=5.653, species=("Ga", "As"), label="Gallium arsenide", group="F-43m (zincblende)"),
    "GaN":     dict(kind="wurtzite", a=3.189, c=5.185, u=0.377, species=("Ga", "N"), label="Gallium nitride", group="P6_3mc (wurtzite)"),
    "4H-SiC":  dict(kind="4H", a=3.073, c=10.053, species=("Si", "C"), label="4H silicon carbide", group="P6_3mc (4H polytype)"),
    "MoS2":    dict(kind="mos2", a=3.16, dz=1.56, species=("Mo", "S"), label="Molybdenum disulfide (monolayer)", group="P-6m2 (2H monolayer)"),
}


def _diamond(a, sp, n=(2, 2, 2)):
    fcc = np.array([[0, 0, 0], [0, .5, .5], [.5, 0, .5], [.5, .5, 0]])
    basis = [(fcc, sp[0]), (fcc + 0.25, sp[1])]
    atoms = []
    for i in range(n[0] + 1):
        for j in range(n[1] + 1):
            for k in range(n[2] + 1):
                for pos, el in basis:
                    for p in pos:
                        f = p + (i, j, k)
                        if np.all(f <= np.array(n) + 1e-6):
                            atoms.append((el, *(f * a)))
    return atoms


def _hex_layers(a, stacking, n=(3, 3), extra=()):
    """stacking: list of (site 'A'|'B'|'C', z, element)."""
    shift = {"A": (0, 0), "B": (1 / 3, 1 / 3), "C": (2 / 3, 2 / 3)}  # 60-degree basis
    a1 = np.array([a, 0, 0]); a2 = np.array([a / 2, a * math.sqrt(3) / 2, 0])
    atoms = []
    for i in range(n[0]):
        for j in range(n[1]):
            for site, z, el in stacking:
                s = shift[site]
                r = (i + s[0]) * a1 + (j + s[1]) * a2
                atoms.append((el, r[0], r[1], z))
    return atoms


def atoms(key: str):
    s = STRUCTURES[key]
    sp = s["species"]
    if s["kind"] == "diamond":
        return _diamond(s["a"], sp)
    if s["kind"] == "wurtzite":
        c, u = s["c"], s["u"]
        st = []
        for cell in range(2):
            z0 = cell * c
            st += [("A", z0, sp[0]), ("A", z0 + u * c, sp[1]),
                   ("B", z0 + c / 2, sp[0]), ("B", z0 + c / 2 + u * c, sp[1])]
        return _hex_layers(s["a"], st, (4, 4))
    if s["kind"] == "4H":
        c = s["c"]; h = c / 4; bond = 0.75 * h
        st = []
        for i, site in enumerate("ABCB"):
            st += [(site, i * h, sp[0]), (site, i * h + bond, sp[1])]
        return _hex_layers(s["a"], st, (4, 4))
    if s["kind"] == "mos2":
        dz = s["dz"]
        st = [("A", 0.0, sp[0]), ("B", dz, sp[1]), ("B", -dz, sp[1])]
        return _hex_layers(s["a"], st, (6, 6))
    raise KeyError(key)


def bonds(at, cutoff):
    xyz = np.array([a[1:] for a in at])
    d = np.linalg.norm(xyz[:, None, :] - xyz[None, :, :], axis=2)
    i, j = np.where((d > 0.1) & (d < cutoff))
    return [(int(a), int(b)) for a, b in zip(i, j) if a < b], float(d[(d > 0.1)].min())


def structure(key: str) -> dict:
    at = atoms(key)
    xyz = np.array([a[1:] for a in at])
    d = np.linalg.norm(xyz[:, None, :] - xyz[None, :, :], axis=2)
    nn = float(d[d > 0.1].min())
    b, _ = bonds(at, nn * 1.12)
    center = xyz.mean(axis=0)
    s = STRUCTURES[key]
    # bond angle from the first atom with >= 2 bonds
    angle = None
    nb = {}
    for i, j in b:
        nb.setdefault(i, []).append(j); nb.setdefault(j, []).append(i)
    for i, js in nb.items():
        if len(js) >= 2:
            v1 = xyz[js[0]] - xyz[i]; v2 = xyz[js[1]] - xyz[i]
            angle = math.degrees(math.acos(np.dot(v1, v2) / np.linalg.norm(v1) / np.linalg.norm(v2)))
            break
    return dict(key=key, label=s["label"], group=s["group"], a=s["a"], c=s.get("c"),
                bond_A=round(nn, 3), angle_deg=round(angle, 1) if angle else None,
                atoms=[[el, round(x - center[0], 3), round(y - center[1], 3), round(z - center[2], 3)] for el, x, y, z in at],
                bonds=b)


def write_json(path: Path):
    data = {k: structure(k) for k in STRUCTURES}
    path.write_text(json.dumps(data, separators=(",", ":")))
    return data
