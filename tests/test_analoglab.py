"""Analog & RF Lab (analog.html): small-signal parameters, the common-source stage,
distortion, frequency response and noise. Checks against closed forms and limits."""
import json
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "sim"))
from transistor_sim import mosfet  # noqa: E402
from transistor_sim.physics import analog as an  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
PHIT = 1.380649e-23 * 300 / 1.602176634e-19


def test_gm_over_id_limits():
    p = mosfet.preset("2011_22nm_finfet")
    weak = an.small_signal(p, p.VT0 - 0.25, p.VDD / 2)
    strong = an.small_signal(p, p.VDD, p.VDD / 2)
    assert weak["gm_id"] == pytest.approx(1 / (p.n * PHIT), rel=0.05)        # weak inversion: 1/(n φt)
    assert strong["gm_id"] < weak["gm_id"] / 2                                 # strong inversion: much less efficient


def test_intrinsic_gain_dips_with_planar_scaling_and_recovers_with_finfet():
    A = {k: an.small_signal(mosfet.preset(k), an.vgs_for_current(mosfet.preset(k), 10, mosfet.preset(k).VDD / 2), mosfet.preset(k).VDD / 2)["A0"]
         for k in ("1999_180nm", "2007_45nm_hkmg", "2011_22nm_finfet")}
    assert A["2007_45nm_hkmg"] < A["1999_180nm"] / 2
    assert A["2011_22nm_finfet"] > 2 * A["2007_45nm_hkmg"]


def test_ft_definition_and_scaling():
    p = mosfet.preset("1999_180nm")
    s = an.small_signal(p, 1.2, 1.8)
    assert s["fT"] == pytest.approx(s["gm"] / (2 * math.pi * (s["cgs"] + s["cgd"])), rel=1e-12)
    peak = {k: max(an.small_signal(mosfet.preset(k), v, mosfet.preset(k).VDD)["fT"] for v in np.linspace(0, mosfet.preset(k).VDD, 40))
            for k in ("1985_1p5um_cmos", "1999_180nm", "2007_45nm_hkmg")}
    assert peak["1985_1p5um_cmos"] < peak["1999_180nm"] < peak["2007_45nm_hkmg"]
    assert 20e9 < peak["1999_180nm"] < 150e9                                   # reported 180 nm fT is ~50–70 GHz


def test_common_source_gain_matches_small_signal_slope():
    p = mosfet.preset("1999_180nm")
    vb = an.bias_for_midrail(p, 1.8, 20)
    st = an.cs_stage(p, 1.8, 20, vb)
    assert st["vout"] == pytest.approx(0.9, abs=1e-3)
    h = 1e-4
    slope = (an.cs_output(p, vb + h, 1.8, 20)[0] - an.cs_output(p, vb - h, 1.8, 20)[0]) / (2 * h)
    assert slope == pytest.approx(st["gain"], rel=0.01)


def test_distortion_grows_with_amplitude():
    p = mosfet.preset("1999_180nm")
    vb = an.bias_for_midrail(p, 1.8, 20)
    thd = [an.sine_response(p, 1.8, 20, vb, a)[2] for a in (0.005, 0.02, 0.08)]
    assert thd[0] < thd[1] < thd[2]
    assert thd[1] / thd[0] == pytest.approx(4, rel=0.15)                       # weak non-linearity: HD2 ∝ amplitude


def test_bode_low_frequency_gain_and_miller():
    p = mosfet.preset("1999_180nm")
    vb = an.bias_for_midrail(p, 1.8, 20)
    b = an.bode(p, 1.8, 20, vb, RS_kohm=10, CL_fF=1)
    assert b["mag"][0] == pytest.approx(b["A0_dB"], abs=0.01)
    assert b["C_miller"] == pytest.approx(an.cs_stage(p, 1.8, 20, vb)["cgd"] * (1 + b["gm"] * b["rout"]), rel=1e-12)
    # with a large source resistance the input (Miller) pole sets the bandwidth
    assert b["f3dB"] == pytest.approx(b["p_in"], rel=0.35)
    b2 = an.bode(p, 1.8, 20, vb, RS_kohm=0.01, CL_fF=50)
    assert b2["f3dB"] == pytest.approx(1 / (2 * math.pi * b2["rout"] * (50e-15 + an.cs_stage(p, 1.8, 20, vb)["cgd"])), rel=0.1)  # output pole


def test_noise_corner_and_integration():
    p = mosfet.preset("1999_180nm")
    gm = 1e-3
    fc = an.noise_corner(p, gm, 10)
    s = an.noise_psd(p, gm, 10, [fc])[0]
    assert s == pytest.approx(2 * 4 * an.KB * 300 * (2 / 3) / gm, rel=1e-9)   # equal parts at the corner
    f = np.logspace(0, 6, 20001)
    num = math.sqrt(np.trapezoid(an.noise_psd(p, gm, 10, f), f))
    assert an.noise_rms(p, gm, 10, 1, 1e6) == pytest.approx(num, rel=1e-3)
    assert an.noise_corner(p, gm, 40) == pytest.approx(fc / 4, rel=1e-12)       # 4× area, 4× lower corner


def test_rf_records_file():
    d = json.loads((ROOT / "data" / "rf_records.json").read_text(encoding="utf-8"))["records"]
    best = max(r.get("fmax", 0) for r in d)
    assert best >= 1000 and all(r.get("fT") or r.get("fmax") for r in d)
