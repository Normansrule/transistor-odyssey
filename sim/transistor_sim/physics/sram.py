"""Six-transistor (6T) SRAM cell from the compact MOSFET model.

Two cross-coupled inverters hold a bit on nodes Q and QB; two access nFETs
connect them to the bitlines when the word line is high. Widths are relative to
the access transistor (width 1):
    pull-down nFET  CR  (cell ratio)       pull-up pFET  PR  (pull-up ratio)
The pFET carries beta times the current of an nFET of the same width.

Hold:  each inverter alone,  CR I_n(Vin, Vout) = beta PR I_p(VDD - Vin, VDD - Vout)
Read:  both bitlines precharged to VDD and the word line on, so the access nFET
       also pushes current into the node holding 0:
       CR I_n(Vin, Vout) = beta PR I_p(VDD - Vin, VDD - Vout) + I_n(VDD - Vout, VDD - Vout)
       The '0' node rises to V_read (read disturb); if it rises past the other
       inverter's switching point the cell flips (a read upset).
Static noise margin (Seevinck, List & Lohstroh 1987): plot one inverter's curve
and the mirror image of the other (the "butterfly"); the side of the largest
square that fits inside the smaller lobe is the SNM. Rotating the axes by 45 deg,
it is the largest vertical gap between the two curves divided by sqrt(2).
Read current and bitline swing: the access and pull-down transistors in series
discharge the bitline; time to develop a sense margin dV on C_BL is C_BL dV / I_read.
"""
from __future__ import annotations

import math
from dataclasses import replace

import numpy as np

from .. import mosfet

# p/n strength per width by era (FinFET and nanosheet pFETs are nearly as strong as nFETs)
BETA = {"1999_180nm": 0.5, "2007_45nm_hkmg": 0.6, "2011_22nm_finfet": 0.8, "2025_2nm_gaa": 0.9, "2026_mos2_2d": 0.5}


def _I(p, vgs, vds):
    return mosfet.drain_current(p, vgs, vds)


def vtc(p, vdd, cr=2.0, pr=1.0, beta=0.8, read=False, n=241, dvt=0.0):
    """Inverter curve inside the cell: (vin, vout). read=True adds the access transistor to VDD.
    dvt shifts the threshold of this half's nFETs (pull-down and access), modelling mismatch."""
    pn = replace(p, VT0=p.VT0 + dvt) if dvt else p
    vin = np.linspace(0.0, vdd, n)
    lo, hi = np.zeros(n), np.full(n, vdd)
    for _ in range(60):
        mid = 0.5 * (lo + hi)
        f = cr * _I(pn, vin, mid) - beta * pr * _I(p, vdd - vin, vdd - mid)
        if read:
            f = f - _I(pn, vdd - mid, vdd - mid)
        hi = np.where(f > 0, mid, hi)
        lo = np.where(f > 0, lo, mid)
    return vin, 0.5 * (lo + hi)


def snm(vin, vout, vin2=None, vout2=None):
    """Seevinck static noise margin from the two inverter curves (the second defaults to the first).

    Curve 1: (x, f1(x)); curve 2 (mirror): (f2(y), y). In rotated coordinates u = (x - y)/sqrt2,
    v = (x + y)/sqrt2 both are single-valued in u; the SNM is the smaller of the two lobes'
    largest gaps, divided by sqrt2. Returns (snm, details) with both lobes.
    """
    vin2 = vin if vin2 is None else vin2
    vout2 = vout if vout2 is None else vout2
    s = math.sqrt(2.0)
    u1, v1 = (vin - vout) / s, (vin + vout) / s
    u2, v2 = (vout2 - vin2) / s, (vout2 + vin2) / s
    o2 = np.argsort(u2)
    u = np.linspace(max(u1.min(), u2.min()), min(u1.max(), u2.max()), 801)
    g = np.interp(u, u1, v1) - np.interp(u, u2[o2], v2[o2])
    right, left = g[u > 1e-9], g[u < -1e-9]
    a = float(max(-right.min(), 0.0)) if right.size else 0.0     # mirror curve lies above in the x > y lobe
    b = float(max(left.max(), 0.0)) if left.size else 0.0
    return min(a, b) / s, dict(u=u, gap=g, lobes=(a / s, b / s))


def cell(p, vdd=None, cr=2.0, pr=1.0, beta=0.8, rows=256, dv=0.1, w_ax_um=None, dvt=0.0):
    """Hold and read margins, read-disturb voltage, read current and bitline timing.
    dvt: threshold mismatch between the two halves (+dvt/2 on one side, -dvt/2 on the other)."""
    vdd = p.VDD if vdd is None else vdd
    vh, oh = vtc(p, vdd, cr, pr, beta, read=False, dvt=dvt / 2)
    vh2, oh2 = vtc(p, vdd, cr, pr, beta, read=False, dvt=-dvt / 2)
    vr, orr = vtc(p, vdd, cr, pr, beta, read=True, dvt=dvt / 2)
    vr2, orr2 = vtc(p, vdd, cr, pr, beta, read=True, dvt=-dvt / 2)
    hold, _ = snm(vh, oh, vh2, oh2)
    read, _ = snm(vr, orr, vr2, orr2)
    v_read = float(orr[-1])                      # '0' node with the other node at VDD
    w = w_ax_um if w_ax_um is not None else 2 * p.L_nm * 1e-3     # access width ~ 2 L (µm of footprint)
    i_read = float(_I(p, vdd - v_read, vdd - v_read)) * w         # A
    c_cell = 4.0 * w * 1e-15                                      # F per cell on the bitline (junction + wire)
    t_sense = rows * c_cell * dv / max(i_read, 1e-15)
    return dict(hold_snm=hold, read_snm=read, v_read=v_read, i_read_uA=i_read * 1e6,
                c_bl_fF=rows * c_cell * 1e15, t_sense_ps=t_sense * 1e12, vdd=vdd)


def snm_vs_vdd(p, vdds, cr=2.0, pr=1.0, beta=0.8):
    hold, read = [], []
    for v in vdds:
        a, b = vtc(p, v, cr, pr, beta, False), vtc(p, v, cr, pr, beta, True)
        hold.append(snm(*a)[0])
        read.append(snm(*b)[0])
    return np.array(hold), np.array(read)
