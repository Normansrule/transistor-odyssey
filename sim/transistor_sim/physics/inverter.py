"""CMOS inverter built from the compact MOSFET model: transfer curve, noise
margins, switching delay, energy and leakage.

The pull-down nFET and pull-up pFET share one parameter set; the pFET is
scaled by a strength ratio beta (holes are slower in planar silicon, beta ~0.5;
FinFET and nanosheet pFETs are closer to 1).

    Transfer curve:  I_n(Vin, Vout) = beta I_p(VDD - Vin, VDD - Vout), solved by bisection
    Noise margins:   V_IL, V_IH where dVout/dVin = -1;  NM_L = V_IL - V_OL, NM_H = V_OH - V_IH
    Step delay:      t_pHL = C_L * integral_{VDD/2}^{VDD} dV / (I_n(VDD, V) - beta I_p(0, VDD - V))
    Energy:          C_L VDD^2 per charge-discharge cycle (half stored, half lost in the pFET)
    Ring oscillator: f = 1 / (2 N t_p) for N stages

Load: fan-out FO of identical inverters, each presenting the gate capacitance of
its nFET and pFET (C_ox L W per µm of width), plus a fixed parasitic for
contacts, fringe fields and local wire.
Sources: Rabaey, Chandrakasan & Nikolić, Digital Integrated Circuits, ch. 5;
Sakurai & Newton, IEEE JSSC 25, 584 (1990).
"""
from __future__ import annotations

import math
from dataclasses import replace

import numpy as np

from .. import mosfet

C_PAR_FF = 0.6       # fF per µm: contacts, fringe and local wire at the output node


def gate_cap_ff(p: mosfet.MOSParams) -> float:
    """Gate capacitance of one transistor per µm of footprint width, in fF."""
    return p.Cox * p.L_nm * 1e-9 * 1e-6 * p.W_factor * 1e15


def load_cap_ff(p: mosfet.MOSParams, fanout: float = 4.0, beta: float = 1.0) -> float:
    """C_L per µm: fan-out inverters (nFET + pFET gates) plus a fixed parasitic."""
    return fanout * gate_cap_ff(p) * (1.0 + beta) + C_PAR_FF


def vtc(p: mosfet.MOSParams, vdd: float | None = None, beta: float = 1.0, n: int = 201):
    """Inverter transfer curve; vectorised bisection over all input points."""
    vdd = p.VDD if vdd is None else vdd
    vin = np.linspace(0.0, vdd, n)
    lo, hi = np.zeros(n), np.full(n, vdd)
    for _ in range(60):
        mid = 0.5 * (lo + hi)
        f = mosfet.drain_current(p, vin, mid) - beta * mosfet.drain_current(p, vdd - vin, vdd - mid)
        hi = np.where(f > 0, mid, hi)
        lo = np.where(f > 0, lo, mid)
    return vin, 0.5 * (lo + hi)


def metrics(p: mosfet.MOSParams, vdd: float | None = None, beta: float = 1.0, fanout: float = 4.0, stages: int = 11) -> dict:
    vdd = p.VDD if vdd is None else vdd
    vin, vout = vtc(p, vdd, beta, 401)
    g = np.gradient(vout, vin)
    VM = float(np.interp(0.0, (vout - vin)[::-1], vin[::-1]))       # vout - vin falls through 0
    unity = np.where(g <= -1)[0]
    VIL = float(vin[unity[0]]) if unity.size else VM
    VIH = float(vin[unity[-1]]) if unity.size else VM
    VOL, VOH = float(vout[-1]), float(vout[0])
    CL = load_cap_ff(p, fanout, beta) * 1e-15
    tphl = step_delay(p, vdd, beta, CL, falling=True)
    tplh = step_delay(p, vdd, beta, CL, falling=False)
    tp = 0.5 * (tphl + tplh)
    ioff = 0.5 * (float(mosfet.drain_current(p, 0.0, vdd)) + beta * float(mosfet.drain_current(p, 0.0, vdd)))
    return dict(VM=VM, VIL=VIL, VIH=VIH, VOL=VOL, VOH=VOH, NML=VIL - VOL, NMH=VOH - VIH, gain=float(-g.min()),
                CL_fF=CL * 1e15, tpHL_ps=tphl * 1e12, tpLH_ps=tplh * 1e12, tp_ps=tp * 1e12,
                E_fJ=CL * vdd * vdd * 1e15, f_ring_GHz=1e-9 / (2 * stages * tp), Pleak_nW=ioff * vdd * 1e9)


def step_delay(p, vdd, beta, CL, falling=True, n=400):
    """50% delay for an ideal input step, by integrating C dV / I(V)."""
    V = np.linspace(vdd / 2, vdd, n) if falling else np.linspace(0.0, vdd / 2, n)
    if falling:   # input jumps to VDD: nFET on (Vgs = VDD), pFET off (Vsg = 0)
        I = mosfet.drain_current(p, vdd, V) - beta * mosfet.drain_current(p, 0.0, vdd - V)
    else:         # input drops to 0: pFET on, nFET off
        I = beta * mosfet.drain_current(p, vdd, vdd - V) - mosfet.drain_current(p, 0.0, V)
    I = np.maximum(I, 1e-15)
    return float(CL * np.trapezoid(1.0 / I, V))


def waveform(p, vdd=None, beta=1.0, fanout=4.0, n=200):
    """Output voltage versus time after an input step (falling output), for animation."""
    vdd = p.VDD if vdd is None else vdd
    CL = load_cap_ff(p, fanout, beta) * 1e-15
    V = np.linspace(vdd, 0.02 * vdd, n)
    I = np.maximum(mosfet.drain_current(p, vdd, V) - beta * mosfet.drain_current(p, 0.0, vdd - V), 1e-15)
    t = np.concatenate([[0.0], np.cumsum(CL * 0.5 * (1 / I[1:] + 1 / I[:-1]) * -np.diff(V))])
    return t, V
