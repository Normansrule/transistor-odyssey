"""The transistor as an amplifier: small-signal parameters, a common-source stage,
distortion, frequency response and noise, all from the compact MOSFET model.

Small signal (numerical derivatives of the compact model, per µm of width W):
    gm = ∂I_D/∂V_GS,  g_ds = ∂I_D/∂V_DS,  intrinsic gain A_0 = gm / g_ds
    gm/I_D is the transconductance efficiency: 1/(n φt) ≈ 25–30 /V in weak
    inversion, falling as the device is driven harder (Silveira, Flandre & Jespers 1996).
Capacitances (saturation, quasi-static): C_gs = (2/3) C_ox W L + C_ov W,  C_gd = C_ov W
with an overlap/fringe capacitance C_ov per µm of width; f_T = gm / 2π(C_gs + C_gd).

Common-source stage with a resistor load R_L from V_DD and a source resistance R_S:
    large signal:  I_D(V_in, V_out) = (V_DD − V_out) / R_L, solved by bisection
    small signal:  A_v(s) = −gm R_out (1 − s C_gd/gm) / (1 + a s + b s²),  R_out = r_o || R_L
                   a = R_S [C_gs + C_gd (1 + gm R_out)] + R_out (C_gd + C_L)
                   b = R_S R_out (C_gs C_gd + C_gs C_L + C_gd C_L)
    The C_gd (1 + gm R_out) term is the Miller effect (Miller 1920).
Noise, input-referred (V²/Hz):  S_v(f) = 4 k T γ / gm + K_f / (C_ox W L f)
with γ = 2/3 (long channel, van der Ziel) and a flicker coefficient K_f; the
1/f "corner" where both are equal is f_c = K_f gm / (4 k T γ C_ox W L).
"""
from __future__ import annotations

import math

import numpy as np

from .. import mosfet

KB = 1.380649e-23
C_OV_F_PER_UM = 0.25e-15      # overlap + fringe capacitance per µm of width (teaching value)
KF = 1e-25                    # flicker coefficient, V² F (teaching value of the right order for Si CMOS)


def _id(p, vgs, vds, W=1.0):
    return float(mosfet.drain_current(p, vgs, vds)) * W


def small_signal(p, vgs: float, vds: float, W: float = 1.0, h: float = 1e-4) -> dict:
    """Operating point and small-signal parameters for a device of width W µm."""
    i = _id(p, vgs, vds, W)
    gm = (_id(p, vgs + h, vds, W) - _id(p, vgs - h, vds, W)) / (2 * h)
    gds = (_id(p, vgs, vds + h, W) - _id(p, vgs, vds - h, W)) / (2 * h)
    L = p.L_nm * 1e-3                                         # µm
    cox_area = p.Cox * 1e-12                                  # F/µm²
    weff = W * p.W_factor
    cgs = 2 / 3 * cox_area * weff * L + C_OV_F_PER_UM * W
    cgd = C_OV_F_PER_UM * W
    return dict(I=i, gm=gm, gds=gds, gm_id=gm / i if i > 0 else 0.0, A0=gm / gds if gds > 0 else float("inf"),
                cgs=cgs, cgd=cgd, fT=gm / (2 * math.pi * (cgs + cgd)))


def vgs_for_current(p, I_uA_um: float, vds: float) -> float:
    """Gate voltage giving a drain current density (µA/µm) at vds, by bisection."""
    lo, hi = -0.5, max(p.VDD * 1.5, 1.0)
    for _ in range(80):
        mid = 0.5 * (lo + hi)
        if _id(p, mid, vds) * 1e6 < I_uA_um:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


def cs_output(p, vin, vdd: float, RL_kohm: float, W: float = 1.0):
    """Large-signal output of a resistor-loaded common-source stage (vectorised over vin)."""
    vin = np.atleast_1d(np.asarray(vin, dtype=float))
    lo, hi = np.zeros_like(vin), np.full_like(vin, vdd)
    R = RL_kohm * 1e3
    for _ in range(60):
        mid = 0.5 * (lo + hi)
        f = mosfet.drain_current(p, vin, mid) * W - (vdd - mid) / R     # > 0: device sinks more than the resistor supplies
        hi = np.where(f > 0, mid, hi)
        lo = np.where(f > 0, lo, mid)
    return 0.5 * (lo + hi)


def bias_for_midrail(p, vdd: float, RL_kohm: float, W: float = 1.0) -> float:
    """Input bias that puts the output at V_DD/2."""
    lo, hi = 0.0, vdd
    for _ in range(60):
        mid = 0.5 * (lo + hi)
        if cs_output(p, mid, vdd, RL_kohm, W)[0] > vdd / 2:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


def cs_stage(p, vdd: float, RL_kohm: float, vbias: float, W: float = 1.0) -> dict:
    vout = float(cs_output(p, vbias, vdd, RL_kohm, W)[0])
    ss = small_signal(p, vbias, vout, W)
    R = RL_kohm * 1e3
    rout = 1 / (ss["gds"] + 1 / R)
    return dict(vout=vout, gain=-ss["gm"] * rout, rout=rout, **ss)


def sine_response(p, vdd, RL_kohm, vbias, amp, W=1.0, n=256):
    """Output over one period of a sine input; returns (vin, vout, THD) with THD from harmonics 2–9."""
    t = np.arange(n) / n
    vin = vbias + amp * np.sin(2 * np.pi * t)
    vout = cs_output(p, vin, vdd, RL_kohm, W)
    spec = np.fft.rfft(vout - vout.mean())
    h = np.abs(spec)
    thd = float(np.sqrt(np.sum(h[2:10] ** 2)) / h[1]) if h[1] > 0 else 0.0
    return vin, vout, thd


def bode(p, vdd, RL_kohm, vbias, RS_kohm=1.0, CL_fF=5.0, W=1.0, f=None):
    """Frequency response (Hz, |A| in dB, phase in degrees) and the −3 dB bandwidth."""
    st = cs_stage(p, vdd, RL_kohm, vbias, W)
    gm, cgs, cgd, R, RS, CL = st["gm"], st["cgs"], st["cgd"], st["rout"], RS_kohm * 1e3, CL_fF * 1e-15
    a = RS * (cgs + cgd * (1 + gm * R)) + R * (cgd + CL)
    b = RS * R * (cgs * cgd + cgs * CL + cgd * CL)
    if f is None:
        f = np.logspace(3, 13, 401)
    s = 2j * np.pi * np.asarray(f)
    H = -gm * R * (1 - s * cgd / gm) / (1 + a * s + b * s * s)
    mag = 20 * np.log10(np.abs(H))
    a0 = 20 * math.log10(abs(gm * R))
    # −3 dB point: bisection on the analytic magnitude
    lo, hi = 1.0, 1e15
    for _ in range(200):
        mid = math.sqrt(lo * hi)
        sm = 2j * math.pi * mid
        m = 20 * math.log10(abs(gm * R * (1 - sm * cgd / gm) / (1 + a * sm + b * sm * sm)))
        if m > a0 - 3.0103:
            lo = mid
        else:
            hi = mid
    f3 = math.sqrt(lo * hi)
    miller = cgd * (1 + gm * R)
    return dict(f=np.asarray(f), mag=mag, phase=np.degrees(np.unwrap(np.angle(H))), A0_dB=a0, f3dB=f3,
                GBW=abs(gm * R) * f3, a=a, b=b, C_miller=miller, p_in=1 / (2 * math.pi * RS * (cgs + miller)), **{k: st[k] for k in ("gm", "rout", "gain")})


def noise_psd(p, gm: float, W: float, f, gamma: float = 2 / 3, T: float = 300.0, Kf: float = KF):
    """Input-referred noise voltage density (V²/Hz): thermal + flicker."""
    area = W * p.W_factor * p.L_nm * 1e-3 * 1e-12               # m² (µm² → m²)
    cox = p.Cox                                                  # F/m²
    f = np.asarray(f, dtype=float)
    return 4 * KB * T * gamma / gm + Kf / (cox * area * f)


def noise_corner(p, gm: float, W: float, gamma: float = 2 / 3, T: float = 300.0, Kf: float = KF) -> float:
    area = W * p.W_factor * p.L_nm * 1e-3 * 1e-12
    return Kf * gm / (4 * KB * T * gamma * p.Cox * area)


def noise_rms(p, gm: float, W: float, f1: float, f2: float, gamma: float = 2 / 3, T: float = 300.0, Kf: float = KF) -> float:
    """RMS input noise (V) integrated from f1 to f2 (closed form)."""
    area = W * p.W_factor * p.L_nm * 1e-3 * 1e-12
    v2 = 4 * KB * T * gamma / gm * (f2 - f1) + Kf / (p.Cox * area) * math.log(f2 / f1)
    return math.sqrt(v2)
