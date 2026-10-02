"""Physics Lab Part VI (transistor to circuit): inverter, ballistic MOSFET, interconnect.
Each check ties the model to a closed form or a textbook number."""
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "sim"))
from transistor_sim import mosfet  # noqa: E402
from transistor_sim.physics import inverter, ballistic, interconnect  # noqa: E402

KT = 1.380649e-23 * 300 / 1.602176634e-19


# --- CMOS inverter ------------------------------------------------------------
def test_symmetric_inverter_switches_at_half_supply():
    p = mosfet.preset("2011_22nm_finfet")
    m = inverter.metrics(p, beta=1.0)
    assert m["VM"] == pytest.approx(p.VDD / 2, abs=1e-3)       # matched n and p: VM = VDD/2
    assert m["VOH"] == pytest.approx(p.VDD, abs=0.01) and m["VOL"] == pytest.approx(0.0, abs=0.01)
    assert m["NML"] > 0.3 * p.VDD and m["NMH"] > 0.3 * p.VDD


def test_weak_pfet_pulls_switching_point_down():
    p = mosfet.preset("1999_180nm")
    assert inverter.metrics(p, beta=0.3)["VM"] < inverter.metrics(p, beta=1.0)["VM"] - 0.05


def test_energy_is_CV2_and_delay_falls_with_supply():
    p = mosfet.preset("2025_2nm_gaa")
    a, b = inverter.metrics(p, vdd=0.7), inverter.metrics(p, vdd=0.5)
    assert a["E_fJ"] / b["E_fJ"] == pytest.approx((0.7 / 0.5) ** 2, rel=1e-9)
    assert b["tp_ps"] > a["tp_ps"]                                # lower supply, slower switching


def test_step_delay_matches_constant_current_limit():
    """For a large load the nFET is in saturation for most of the swing: t_pHL ~ C (VDD/2) / I_on."""
    p = mosfet.preset("1999_180nm")
    CL = 1e-12
    t = inverter.step_delay(p, p.VDD, 1.0, CL, falling=True)
    ion = float(mosfet.drain_current(p, p.VDD, p.VDD))
    assert t == pytest.approx(CL * p.VDD / 2 / ion, rel=0.2)


def test_dibl_lowers_inverter_gain():
    p = mosfet.preset("2011_22nm_finfet")
    lo, hi = mosfet.preset("2011_22nm_finfet", eta=0.0), mosfet.preset("2011_22nm_finfet", eta=0.15)
    assert inverter.metrics(lo)["gain"] > inverter.metrics(p)["gain"] > inverter.metrics(hi)["gain"]


# --- ballistic MOSFET -------------------------------------------------------------
def test_unidirectional_thermal_velocity_of_silicon():
    p = ballistic.params("Si")
    assert p["vT"] * 100 == pytest.approx(1.2e7, rel=0.05)       # ~1.2e7 cm/s for m* = 0.19 m0
    assert 5e-9 < p["lam"] < 20e-9                                # mean free path ~10 nm


def test_nondegenerate_ballistic_limit_is_q_ns_vT():
    p = ballistic.params("Si", vt0=0.4)
    r = ballistic.solve(p, 0.25, 0.6, ballistic=True)             # below threshold: nondegenerate
    assert r["eta"] < -3
    assert r["I"] == pytest.approx(1.602176634e-19 * r["ns"] * p["vT"], rel=0.02)


def test_no_drain_bias_no_current_and_saturation():
    p = ballistic.params("Si")
    assert ballistic.solve(p, 0.7, 0.0)["I"] == pytest.approx(0.0, abs=1e-9)
    p0 = ballistic.params("Si", alpha_d=0.0)
    a, b = ballistic.solve(p0, 0.7, 0.4, True)["I"], ballistic.solve(p0, 0.7, 0.8, True)["I"]
    assert b == pytest.approx(a, rel=0.03)                        # ballistic current saturates within a few kT/q


def test_scattering_reduces_current_and_longer_mfp_approaches_ballistic():
    I = [ballistic.solve(ballistic.params("Si", mu=mu), 0.7, 0.7)["I"] for mu in (100, 300, 3000)]
    Ib = ballistic.solve(ballistic.params("Si"), 0.7, 0.7, True)["I"]
    assert I[0] < I[1] < I[2] < Ib and I[2] / Ib > 0.95


def test_gate_charge_bounded_by_oxide_capacitance():
    p = ballistic.params("Si")
    r = ballistic.solve(p, 0.8, 0.0)
    assert 0 < r["ns"] < p["CG"] * (0.8 - p["vt0"] + 0.2) / 1.602176634e-19


# --- interconnect -------------------------------------------------------------------
def test_wide_wires_reach_bulk_resistivity():
    for m, d in interconnect.METALS.items():
        assert interconnect.resistivity(m, 1e5, 1e5) == pytest.approx(d["rho0"], rel=0.01)


def test_copper_size_effect_and_ruthenium_crossover():
    rho10 = interconnect.resistivity("Cu", 10, 20)
    assert rho10 > 3 * interconnect.METALS["Cu"]["rho0"]          # narrow Cu lines are several times worse
    # with copper's barrier, ruthenium wins in narrow lines but not in wide ones
    assert interconnect.r_per_um("Ru", 10, 20) < interconnect.r_per_um("Cu", 10, 20)
    assert interconnect.r_per_um("Ru", 60, 120) > interconnect.r_per_um("Cu", 60, 120)


def test_elmore_delay_grows_as_length_squared_without_driver():
    r, c = 400.0, 1.6e-16
    d1, d2 = interconnect.elmore_delay(r, c, 100, 0, 0), interconnect.elmore_delay(r, c, 200, 0, 0)
    assert d2 / d1 == pytest.approx(4.0, rel=1e-9)
    t, k = interconnect.repeated_delay(r, c, 2000, 5e3, 1e-15)
    assert k > 1 and t < interconnect.elmore_delay(r, c, 2000, 5e3, 1e-15)


def test_rc_line_matches_erfc_solution():
    r, c = 450.0, 1.6e-16
    x, t, V = interconnect.line_step(r, c, 50.0, 1e-3, 0.0, 2e-11, nx=201, nt=800)
    k = 400
    ref = interconnect.erfc_step(x[[10, 40, 80]], t[k], r, c)
    assert np.allclose(V[k][[10, 40, 80]], ref, atol=2e-3)
