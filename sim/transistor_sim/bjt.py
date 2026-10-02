"""Bipolar junction transistor (Ebers–Moll transport form with Early effect).

The 1948-1960s transistors in this repo are BJTs. The Gummel plot
(log Ic and Ib vs V_BE) shows the ideal 60 mV/decade collector current that
bipolar devices get from Boltzmann statistics — the same limit that later
caps MOSFET subthreshold swing.
"""
from __future__ import annotations

import numpy as np

VT = 0.025852


def collector_current(vbe, vce, Is=1e-15, beta_f=100.0, Va=50.0):
    vbe = np.asarray(vbe, dtype=float)
    vce = np.asarray(vce, dtype=float)
    vbc = vbe - vce
    ic = Is * (np.exp(vbe / VT) - np.exp(vbc / VT)) * (1 + vce / Va) - Is / 1.0 * (np.exp(vbc / VT) - 1)
    return ic


def base_current(vbe, Is=1e-15, beta_f=100.0, n_recomb=2.0, Isr=1e-13):
    """Ideal diffusion base current plus low-injection recombination (n = 2)."""
    vbe = np.asarray(vbe, dtype=float)
    return Is / beta_f * (np.exp(vbe / VT) - 1) + Isr * (np.exp(vbe / (n_recomb * VT)) - 1)


def gummel(vbe_max=0.9, n=181, **kw):
    vbe = np.linspace(0.2, vbe_max, n)
    return vbe, collector_current(vbe, 2.0, **{k: v for k, v in kw.items() if k in ("Is", "beta_f", "Va")}), \
        base_current(vbe, **{k: v for k, v in kw.items() if k in ("Is", "beta_f")})
