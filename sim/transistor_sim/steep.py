"""Steep-slope switches: tunnel FET (TFET) and an idealized negative-capacitance FET.

A MOSFET turns on by thermionic emission over a barrier, so below threshold
its current can rise no faster than one decade per (kT/q) ln 10 ≈ 59.5 mV at
300 K. Two ways around that limit:

* **Tunnel FET** — the gate bends the bands until electrons tunnel from the
  source valence band into the channel conduction band. Band-to-band
  tunnelling (Kane 1961) goes as E^2 exp(-B/E), which can switch faster than
  60 mV/decade over a few decades of current (Ionescu & Riel 2011). The price
  is low on-current.
* **Negative-capacitance FET** — a ferroelectric layer in the gate stack can
  act as a negative capacitor and amplify the internal gate voltage, giving a
  body factor m < 1 (Salahuddin & Datta 2008). Modeled here by the compact
  MOSFET with n < 1, which is an idealization.
"""
from __future__ import annotations

import numpy as np


def tfet_current(vgs, vds=0.5, v_on=0.05, lam_nm=2.0, A=9.0e-5, B_MVcm=10.0, i_floor=1e-16):
    """Drain current (A/µm) of an idealized n-type TFET.

    The tunnelling field is E = V_ov / lambda with V_ov a smooth overdrive
    above the onset voltage v_on; lambda is the screening (natural) length.
    """
    vgs = np.asarray(vgs, dtype=float)
    vov = 0.03 * np.log1p(np.exp((vgs - v_on) / 0.03))            # smooth, ≥0 (V)
    E = vov / (lam_nm * 1e-7) * 1e-6 + 1e-6                        # MV/cm
    i = A * E ** 2 * np.exp(-B_MVcm / E)
    i = i * (1.0 - np.exp(-np.maximum(vds, 0.0) / 0.06))
    return i + i_floor


def point_swing(vgs, ids):
    """Local subthreshold swing (mV/decade) along a transfer curve."""
    vgs = np.asarray(vgs); ids = np.asarray(ids)
    dlog = np.gradient(np.log10(ids), vgs)
    with np.errstate(divide="ignore"):
        return 1e3 / dlog


def min_swing(vgs, ids, i_min=1e-14, i_max=1e-6):
    ss = point_swing(vgs, ids)
    mask = (ids > i_min) & (ids < i_max) & np.isfinite(ss) & (ss > 0)
    return float(ss[mask].min()) if mask.any() else float("nan")
