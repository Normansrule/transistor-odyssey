"""Energy band diagrams for every device in data/devices.json.

Two cuts per device:

* lateral  — conduction and valence band along the current path
  (source → channel → drain, or emitter → base → collector), energies in eV
  relative to the source/emitter Fermi level. Families:
    fet    a gate-controlled barrier with drain-induced lowering (MOSFET, HEMT,
           JFET, MESFET, TFT…). Barrier height at the source:
           E_b = softplus(E_th − pol·(V_G − V_T)/n) − η·V_D
    bjt    emitter/base/collector with barrier V_bi − V_BE (optionally a
           valence-band step in the base for an HBT)
    tfet   p⁺ source / gated channel / n⁺ drain; current flows when the
           channel conduction band drops below the source valence band
    sbfet  metal contacts with Schottky barriers pinned at mid-gap whose
           thickness the gate controls (carbon-nanotube FET)
* vertical — a cut through the gate stack. The MOS types use the exact
  MOS-capacitor solution (physics/moscap.py); the GaN HEMT uses the
  self-consistent Schrödinger–Poisson solver (physics/qwell.py); the others
  are schematic.

The lateral shapes are schematic (smooth steps in place of the exact 2D
solution of Lab 09) but every level is placed from the device's band gap and
bias, so barrier heights, band offsets and quasi-Fermi-level splits are right
to first order. The browser twin is site/js/devices/bands.js.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np

from .physics import moscap, qwell

ROOT = Path(__file__).resolve().parents[2]
E_TH = 0.28      # source barrier (eV) at V_G = V_T
PHI = 0.035      # softplus smoothing (eV)


def load_devices():
    return {d["id"]: d for d in json.loads((ROOT / "data" / "devices.json").read_text(encoding="utf-8"))["devices"]}


def _S(t):
    t = np.clip(t, 0.0, 1.0)
    return t * t * (3 - 2 * t)


def softplus(x, w=PHI):
    return w * np.log1p(np.exp(np.asarray(x, float) / w))


MAT_KEY = {"Si": "Si", "4H-SiC": "4H-SiC", "GaN": "GaN", "GaAs": "GaAs"}


def vt_eff(dev, prog=0.0):
    """Threshold including charge stored on a flash cell's floating gate (prog = 0…1)."""
    m = dev["model"]
    return m["vt"] + (2.5 * prog if m.get("flash") else 0.0)


def on_fraction(dev, Vg, Vd=None, prog=0.0):
    """0…1 conduction indicator used by the animation (not a current in amperes)."""
    m = dev["model"]
    if m["lateral"] == "tfet":
        win = _tfet_window(m, Vg)
        return float(1 / (1 + math.exp(-win / 0.03)))
    if m["lateral"] == "bjt":
        return float(1 / (1 + math.exp(-(Vg - m["vt"]) / 0.03)))
    w = 0.06 * m.get("n", 1.0) * m.get("vscale", 1.0)
    return float(1 / (1 + math.exp(-m["pol"] * (Vg - vt_eff(dev, prog)) / w)))


def barrier(dev, Vg, Vd, prog=0.0):
    """Source-side barrier height (eV) for the fet family."""
    m = dev["model"]
    raw = E_TH - m["pol"] * (Vg - vt_eff(dev, prog)) / (m.get("n", 1.0) * m.get("vscale", 1.0))
    return float(softplus(raw) + 0.02 - m.get("eta", 0.05) * Vd / m.get("vscale", 1.0))


def _tfet_window(m, Vg):
    """Overlap (eV) of the source valence band above the channel conduction band; > 0 lets electrons tunnel."""
    return m["pol"] * (Vg - m["vt"]) * 0.9


def lateral(dev, Vg, Vd, n=241, prog=0.0):
    m = dev["model"]
    x = np.linspace(0, 1, n)
    fam = m["lateral"]
    Eg = m["Eg"]
    vs = m.get("vscale", 1.0)
    out = dict(x=x, family=fam, carrier=dev["carrier"])
    if fam == "fet":
        f = on_fraction(dev, Vg, prog=prog)
        vd = Vd / vs
        Eb = max(barrier(dev, Vg, Vd, prog), 0.0)
        xs, xd = 0.24, 0.76
        u = np.clip((x - xs) / (xd - xs), 0, 1)
        bump = _S(u / 0.2) * (1 - _S((u - 0.62) / 0.38))
        ramp = (1 - f) * _S((u - 0.7) / 0.3) + f * u ** 2
        Ec_src = 0.04
        Ec = Ec_src + Eb * bump - vd * np.where(x >= xd, 1.0, ramp)
        Ec = np.where(x < xs, Ec_src, Ec)
        if m["pol"] < 0:                               # p-channel: mirror into a valence-band barrier for holes
            Ev = -Ec
            Ec = Ev + Eg
            EFs, EFd = 0.0, vd
        else:
            Ev = Ec - Eg
            EFs, EFd = 0.0, -vd
        out.update(Ec=Ec, Ev=Ev, EFs=EFs, EFd=EFd, regions=[(0, xs, dev["labels"]["s"]), (xs, xd, "channel"), (xd, 1, dev["labels"]["d"])],
                   barrier=Eb, f=f)
    elif fam == "bjt":
        vbe, vce = Vg, Vd
        vbi = m.get("vbi", 0.9)
        xe, xb0, xb1, xc = 0.30, 0.38, 0.58, 0.66
        EcE = 0.04
        EcB = EcE + max(vbi - vbe, 0.04)
        vcb = vce - vbe
        EcC = EcB - (0.75 + max(vcb, -0.6))
        Ec = np.where(x < xe, EcE, 0.0)
        Ec = Ec + np.where((x >= xe) & (x < xb0), EcE + (EcB - EcE) * _S((x - xe) / (xb0 - xe)), 0)
        Ec = Ec + np.where((x >= xb0) & (x < xb1), EcB, 0)
        Ec = Ec + np.where((x >= xb1) & (x < xc), EcB + (EcC - EcB) * _S((x - xb1) / (xc - xb1)), 0)
        Ec = Ec + np.where(x >= xc, EcC, 0)
        Ev = Ec - Eg
        het = m.get("hetero", 0.0)
        if het:                                        # narrower-gap base: valence band raised by ΔE_v
            Ev = Ev + het * np.where((x >= xb0 - 0.02) & (x < xb1 + 0.02), 1.0, 0.0)
        EF = np.where(x < xe + 0.04, 0.0, np.where(x < xb1 + 0.04, -vbe, -vce))
        if m["pol"] < 0:                               # pnp: mirror
            Ec, Ev = -Ev, -Ec
            EF = -EF
        out.update(Ec=Ec, Ev=Ev, EF=EF, regions=[(0, xe, dev["labels"]["s"]), (xb0, xb1, dev["labels"]["g"]), (xc, 1, dev["labels"]["d"])],
                   barrier=float(EcB - EcE), f=on_fraction(dev, Vg))
    elif fam == "tfet":
        xs, xd = 0.34, 0.78
        Ev_s = 0.03
        win = _tfet_window(m, Vg)
        Ec_ch = Ev_s - win
        Ec = np.where(x < xs - 0.03, Ev_s + Eg, 0.0)
        tt = (x - (xs - 0.03)) / 0.05
        Ec = np.where((x >= xs - 0.03) & (x < xs + 0.02), Ev_s + Eg + (Ec_ch - Ev_s - Eg) * _S(tt), Ec)
        Ec_d = 0.03 - Vd
        Ec = np.where((x >= xs + 0.02) & (x < xd), Ec_ch + (Ec_d - Ec_ch) * _S((x - xd + 0.12) / 0.12) * (x > xd - 0.12), Ec)
        Ec = np.where(x >= xd, Ec_d, Ec)
        Ev = Ec - Eg
        out.update(Ec=Ec, Ev=Ev, EFs=0.0, EFd=-Vd, regions=[(0, xs, dev["labels"]["s"]), (xs, xd, "channel"), (xd, 1, dev["labels"]["d"])],
                   window=float(win), f=on_fraction(dev, Vg))
    elif fam == "sbfet":
        xs, xd = 0.18, 0.82
        phiB = Eg / 2
        Ec_mid = phiB + 0.25 - (Vg - m["vt"]) * 0.9
        lam = 0.035
        u = x
        Ec = Ec_mid + (phiB - Ec_mid) * np.exp(-np.clip(u - xs, 0, None) / lam) + ((phiB - Vd) - (Ec_mid - Vd * 0.5)) * np.exp(-np.clip(xd - u, 0, None) / lam) - Vd * 0.5 * _S((u - xs) / (xd - xs))
        Ec = np.where(x < xs, np.nan, Ec)
        Ec = np.where(x > xd, np.nan, Ec)
        Ev = Ec - Eg
        out.update(Ec=Ec, Ev=Ev, EFs=0.0, EFd=-Vd, metal=(xs, xd), regions=[(0, xs, "metal"), (xs, xd, "nanotube"), (xd, 1, "metal")],
                   f=on_fraction(dev, Vg), barrier_mid=float(Ec_mid))
    else:
        raise ValueError(fam)
    return out


def vertical(dev, Vg, n=200, prog=0.0):
    """Cut through the gate stack. Returns z (nm), Ec, Ev and labelled regions (gate at z < 0)."""
    m = dev["model"]
    kind = m["vertical"]
    Eg = m["Eg"]
    if kind == "none":
        return None
    if kind == "mos":
        tox = m.get("tox", 2.0)
        Na = m.get("Na", 3e17)
        mat = MAT_KEY.get(dev["material"], "Si")
        p0 = moscap.params(Na=Na, tox_nm=tox, Vfb=0.0, mat=mat)
        Vfb = vt_eff(dev, prog) - moscap.threshold(p0)            # place the capacitor's V_T at the device's V_T
        p = moscap.params(Na=Na, tox_nm=tox, Vfb=Vfb, mat=mat)
        vg = Vg
        lo, hi = -1.0, 2 * p["phiB"] + 0.6
        for _ in range(80):
            mid = 0.5 * (lo + hi)
            (hi, lo) = (mid, lo) if float(moscap.gate_voltage(mid, p)) > vg else (hi, mid)
        psi_s = 0.5 * (lo + hi)
        bb = moscap.band_bending(psi_s, p)
        Eg_si = Eg
        Ei = p["phiB"] - bb["psi"]
        Ec = Ei + Eg_si / 2
        Ev = Ei - Eg_si / 2
        return dict(kind=kind, z=bb["x_nm"], Ec=Ec, Ev=Ev, EF=0.0, psi_s=psi_s, gate_EF=-(Vg - Vfb) + 0.0,
                    regions=[("gate", -1), ("oxide", tox), ("semiconductor", float(bb["x_nm"][-1]))])
    if kind == "hemt":
        r = qwell.hemt_sp(m.get("x", 0.25), m.get("d", 20.0), Vg=Vg, depth_nm=45.0, dz_nm=0.25)
        return dict(kind=kind, z=r["z_nm"], Ec=r["Ec"], Ev=r["Ec"] - np.where(r["z_nm"] < r["d_nm"], 3.91, 3.4), EF=0.0,
                    E=r["E"], ns=r["ns"], regions=[("gate", -1), ("AlGaN", r["d_nm"]), ("GaN", float(r["z_nm"][-1]))])
    z = np.linspace(0, 1, n)
    f = on_fraction(dev, Vg, prog=prog)
    if kind == "dg":           # thin body gated from both sides (or one side on a buried oxide when single=True)
        Eb = barrier(dev, Vg, 0.0, prog)
        t = m.get("tsi", 6.0)
        zz = z * t
        edge = Eb - 0.07 * f
        if m.get("single"):
            Ec = edge + (Eb + 0.05 * (1 - f) - edge) * _S(z)
        else:
            Ec = Eb - (Eb - edge) * (2 * z - 1) ** 2
        return dict(kind=kind, z=zz, Ec=Ec, Ev=Ec - Eg, EF=0.0, regions=[("gate", -1), ("oxide", 1.0), ("channel body", t)], single=bool(m.get("single")))
    if kind == "diamond":
        Ev_s = -0.25 + 0.75 * f
        zz = z * 12.0
        Ev = -1.9 + (Ev_s + 1.9) * np.exp(-zz / 2.0)
        return dict(kind=kind, z=zz, Ec=Ev + Eg, Ev=Ev, EF=0.0, regions=[("gate", -1), ("Al₂O₃ / acceptors", 2.0), ("diamond", 12.0)])
    if kind in ("jfet", "mesfet"):
        vbi = 0.8 if kind == "jfet" else 0.7
        zz = z * 200.0
        wd = 60.0 * math.sqrt(max(vbi - Vg, 0.02)) / math.sqrt(vbi)
        wd = min(wd, 190.0)
        Ec = np.where(zz < wd, 0.05 + (vbi - Vg) * (1 - zz / wd) ** 2, 0.05)
        return dict(kind=kind, z=zz, Ec=Ec, Ev=Ec - Eg, EF=0.0, wd=wd,
                    regions=[("gate", -1), ("depleted", wd), ("open channel", 200.0)])
    if kind == "tft":
        zz = z * 40.0
        Ec_s = 0.35 - 0.33 * f
        Ec = 0.35 + (Ec_s - 0.35) * np.exp(-zz / 4.0)
        return dict(kind=kind, z=zz, Ec=Ec, Ev=Ec - Eg, EF=0.0, regions=[("bottom gate", -1), ("gate insulator", 100), ("IGZO", 40.0)])
    if kind == "flash":
        # channel surface only; the stack (control gate | oxide | floating gate | tunnel oxide) is drawn by the page
        zz = z * 30.0
        Ec_s = 0.6 - 0.55 * f
        Ec = 0.6 + (Ec_s - 0.6) * np.exp(-zz / 5.0)
        return dict(kind=kind, z=zz, Ec=Ec, Ev=Ec - Eg, EF=0.0, stored=prog,
                    regions=[("control gate", -1), ("blocking oxide", 8), ("floating gate", 10), ("tunnel oxide", 8), ("channel", 30.0)])
    raise ValueError(kind)


def alignment():
    d = json.loads((ROOT / "data" / "band_alignment.json").read_text(encoding="utf-8"))
    return {m["id"]: m for m in d["materials"]}


def heterojunction(a, b):
    """Anderson's rule: offsets (eV) and alignment type for materials a | b."""
    A, B = alignment()[a], alignment()[b]
    Ec1, Ev1 = -A["chi"], -A["chi"] - A["Eg"]
    Ec2, Ev2 = -B["chi"], -B["chi"] - B["Eg"]
    dEc, dEv = Ec2 - Ec1, Ev2 - Ev1
    if (Ec1 <= Ec2 and Ev1 >= Ev2) or (Ec2 <= Ec1 and Ev2 >= Ev1):
        kind = "I (straddling)"
    elif Ec1 < Ev2 or Ec2 < Ev1:
        kind = "III (broken gap)"
    else:
        kind = "II (staggered)"
    return dict(dEc=dEc, dEv=dEv, type=kind)
