"""Floating-gate flash cell: Fowler–Nordheim programming, incremental step pulse
programming (ISPP) and multi-level threshold distributions.

Capacitor model of the cell: the floating gate (FG) couples to the control gate
(CG) through the inter-poly dielectric and to the channel through the tunnel
oxide. With gate coupling ratio alpha = C_CG / C_total and the channel held at 0 V,
    V_FG = alpha (V_CG - dVT)          (dVT: threshold shift caused by stored charge)
    E_ox = V_FG / t_ox
Fowler–Nordheim current density through the tunnel oxide (Fowler & Nordheim 1928;
Lenzlinger & Snow 1969):
    J = A E^2 exp(-B / E),   A = q^3 m0 / (8 pi h phi_B m_ox),   B = 8 pi sqrt(2 m_ox) (q phi_B)^1.5 / (3 q h)
Stored charge sigma (per tunnel area) shifts the threshold seen at the control
gate by dVT = -sigma / (alpha C_T), with C_T = (eps_ox / t_ox) / (1 - alpha), so
    d(dVT)/dt = J t_ox (1 - alpha) / (alpha eps_ox).
As charge builds up the oxide field drops and programming slows down by itself.
ISPP (Suh et al. 1995): raise V_CG by a fixed step after every pulse and verify
the threshold in between; once the field has settled each pulse adds about one
step to V_T, so the final spread of V_T is about one step wide.
Multi-level cells store b bits as 2^b threshold levels in the same window; the
read margin between neighbouring levels is spacing - (ISPP step + noise spread).
"""
from __future__ import annotations

import math

import numpy as np

Q = 1.602176634e-19
H = 6.62607015e-34
M0 = 9.1093837015e-31
EPS_OX = 3.9 * 8.8541878128e-12


def fn_coeffs(phi_b=3.1, m_ox=0.42):
    """FN prefactor A (A/V^2) and slope B (V/m) for an Si/SiO2 barrier phi_b (eV)."""
    A = Q ** 3 / (8 * math.pi * H * phi_b * Q) / m_ox
    B = 8 * math.pi * math.sqrt(2 * m_ox * M0) * (phi_b * Q) ** 1.5 / (3 * Q * H)
    return A, B


def fn_current(E, phi_b=3.1, m_ox=0.42):
    """FN current density (A/m^2) at oxide field E (V/m); sign follows E."""
    A, B = fn_coeffs(phi_b, m_ox)
    E = np.asarray(E, dtype=float)
    a = np.abs(E)
    with np.errstate(divide="ignore", over="ignore", invalid="ignore"):
        J = np.where(a > 1e6, A * a * a * np.exp(-B / np.maximum(a, 1e6)), 0.0)
    return np.sign(E) * J


DEFAULT = dict(t_ox_nm=8.0, alpha=0.6, phi_b=3.1, m_ox=0.42)


def rate(dvt, vcg, c=DEFAULT):
    """d(dVT)/dt in V/s for the present threshold shift and control-gate voltage."""
    t = c["t_ox_nm"] * 1e-9
    E = c["alpha"] * (vcg - dvt) / t
    return float(fn_current(E, c["phi_b"], c["m_ox"])) * t * (1 - c["alpha"]) / (c["alpha"] * EPS_OX)


def pulse(dvt0, vcg, width_s, c=DEFAULT, dv=1e-3):
    """Threshold shift after one pulse of width_s at vcg, integrating dt = d(dVT) / rate.

    Integrating in voltage rather than time stays stable even though the rate spans many decades.
    Returns (dvt_end, ts, vs) with the trajectory sampled at each voltage step.
    """
    direction = 1.0 if vcg > dvt0 else -1.0
    t, v, ts, vs = 0.0, dvt0, [0.0], [dvt0]
    for _ in range(200000):
        r = abs(rate(v + direction * dv / 2, vcg, c))
        if r <= 0:
            break
        dt = dv / r
        if t + dt >= width_s:
            v += direction * dv * (width_s - t) / dt
            t = width_s
            ts.append(t); vs.append(v)
            break
        t += dt; v += direction * dv
        ts.append(t); vs.append(v)
    return v, np.array(ts), np.array(vs)


def ispp(target, start_v=14.0, step_v=0.5, width_s=10e-6, vt0=-2.0, vt_neutral=0.0, c=DEFAULT, max_pulses=400):
    """Program with stepped pulses until V_T >= target. V_T = vt_neutral + dVT, starting from vt0 (erased).

    Returns dict(vcg, vt) per pulse (after the pulse) and the number of pulses used.
    """
    dvt = vt0 - vt_neutral
    vcg_list, vt_list = [], []
    for k in range(max_pulses):
        vcg = start_v + k * step_v
        dvt, _, _ = pulse(dvt, vcg, width_s, c)
        vcg_list.append(vcg); vt_list.append(vt_neutral + dvt)
        if vt_neutral + dvt >= target:
            break
    return dict(vcg=np.array(vcg_list), vt=np.array(vt_list), pulses=len(vt_list))


ERASED_SIGMA = 0.45   # V, the erased state is left wide (block erase is not verified cell by cell)


def levels(bits, window=(-2.5, 4.5), step_v=0.5, sigma=0.04):
    """Threshold levels for a b-bit cell: the erased level at the bottom of the window, the
    2^b - 1 programmed levels evenly spaced from 0 V to the top.

    Each programmed level is about one ISPP step wide (uniform) blurred by noise sigma, so its full
    width is step + 6 sigma (+-3 sigma). The read margin is the smallest clear gap between neighbours.
    """
    n = 2 ** bits
    lo, hi = window
    first = 0.0
    spacing = (hi - first) / (n - 2) if n > 2 else 0.0
    centres = [lo] + ([first + i * spacing for i in range(n - 1)] if n > 2 else [1.0])
    width = step_v + 6 * sigma
    gap_erased = (centres[1] - width / 2) - (lo + 3 * ERASED_SIGMA)
    margin = min(spacing - width, gap_erased) if n > 2 else gap_erased
    reads = [(centres[i] + centres[i + 1]) / 2 for i in range(n - 1)]
    reads[0] = 0.5 * ((lo + 3 * ERASED_SIGMA) + (centres[1] - width / 2))
    return dict(n=n, centres=np.array(centres), spacing=spacing, width=width, margin=margin, reads=np.array(reads))


def distribution(x, centre, step_v, sigma, erased=False):
    """Threshold histogram (arbitrary units): a step-wide uniform plateau convolved with a Gaussian."""
    x = np.asarray(x, dtype=float)
    if erased:
        return np.exp(-0.5 * ((x - centre) / ERASED_SIGMA) ** 2)
    a, b = centre - step_v / 2, centre + step_v / 2
    from math import erf
    erfv = np.vectorize(erf)
    return 0.5 * (erfv((x - a) / (math.sqrt(2) * sigma)) - erfv((x - b) / (math.sqrt(2) * sigma)))
