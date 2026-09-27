"""Tests for sim/transistor_sim/physics: each solver is pinned to a closed form
or a measured number from the literature."""
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "sim"))
from transistor_sim.physics import carriers, junction, moscap, tunnel, poisson2d, montecarlo, crystal  # noqa: E402

KT = 0.025852


# --- carriers ---------------------------------------------------------------
@pytest.mark.parametrize("mat,eg", [("Si", 1.12), ("Ge", 0.66), ("GaAs", 1.42), ("GaN", 3.39), ("4H-SiC", 3.23)])
def test_varshni_room_temperature_gap(mat, eg):
    assert carriers.band_gap(mat, 300) == pytest.approx(eg, abs=0.015)


def test_silicon_intrinsic_density():
    # Accepted values 9.65e9 (Altermatt 2003) to 1.0e10 cm^-3
    assert 8e9 < carriers.intrinsic_density("Si") < 1.1e10


def test_wide_gap_intrinsic_density_is_negligible():
    assert carriers.intrinsic_density("GaN") < 1e-6
    assert carriers.intrinsic_density("Diamond") < 1e-20


def test_charge_neutrality_and_mass_action():
    for Nd, Na in [(1e16, 0), (0, 1e17), (1e15, 3e15), (1e10, 0)]:
        e = carriers.equilibrium("Si", 300, Nd, Na)
        assert e["n"] - e["p"] == pytest.approx(Nd - Na, rel=1e-6, abs=1e-3 * e["ni"])
        assert e["n"] * e["p"] == pytest.approx(e["ni"] ** 2, rel=1e-9)


def test_fermi_level_shift():
    e = carriers.equilibrium("Si", 300, Nd=1e16)
    assert e["EF"] - e["Ei"] == pytest.approx(KT * math.log(1e16 / e["ni"]), rel=1e-3)
    assert 0.34 < e["EF"] - e["Ei"] < 0.37


# --- pn junction ------------------------------------------------------------
def test_built_in_potential_symmetric_junction():
    s = junction.solve(1e17, 1e17)
    assert 0.80 < s["Vbi"] < 0.88


def test_depletion_charge_balance_and_field():
    s = junction.solve(1e16, 1e18, V=-2.0)
    assert 1e16 * s["xp_um"] == pytest.approx(1e18 * s["xn_um"], rel=1e-9)
    # triangle field: area = junction voltage
    assert 0.5 * s["Emax"] * s["W_um"] * 1e-4 == pytest.approx(s["Vbi"] + 2.0, rel=1e-6)


def test_forward_bias_shrinks_depletion():
    assert junction.solve(1e17, 1e17, 0.4)["W_um"] < junction.solve(1e17, 1e17, 0)["W_um"] < junction.solve(1e17, 1e17, -3)["W_um"]


def test_ideal_diode_60mv_per_decade():
    I = junction.diode_iv([0.40, 0.46], 1e17, 1e16)
    assert 60.0 / math.log10(I[1] / I[0]) == pytest.approx(59.5, abs=0.3)


def test_caughey_thomas_mobility_limits():
    assert junction.mobility_si(1e13) == pytest.approx(1414, rel=0.01)
    assert junction.mobility_si(1e20) < 120


# --- MOS capacitor ----------------------------------------------------------
def test_threshold_matches_depletion_formula():
    p = moscap.params(Na=1e17, tox_nm=5)
    assert float(moscap.gate_voltage(2 * p["phiB"], p)) == pytest.approx(moscap.threshold(p), abs=2e-3)


def test_cv_limits():
    p = moscap.params(Na=1e17, tox_nm=5)
    cv = moscap.cv_curves(p)
    assert cv["C_lf"][0] > 0.95 and cv["C_hf"][0] > 0.95          # accumulation -> Cox
    assert cv["C_lf"][-1] > 0.95                                 # low-frequency inversion -> Cox
    assert cv["C_hf"][-1] < 0.3                                  # high-frequency stays at C_min
    assert cv["C_hf"].min() == pytest.approx(cv["C_hf"][-1], rel=0.05)


def test_band_bending_profile():
    p = moscap.params(Na=1e17)
    b = moscap.band_bending(0.6, p)
    assert b["psi"][0] == pytest.approx(0.6)
    assert np.all(np.diff(b["psi"]) <= 1e-12) and b["psi"][-1] < 0.01


# --- tunnelling -------------------------------------------------------------
@pytest.mark.parametrize("E,V0,a", [(0.1, 1.0, 0.5), (0.5, 1.0, 1.0), (1.5, 1.0, 0.8), (0.1, 3.0, 3.0)])
def test_transfer_matrix_matches_rectangular_barrier(E, V0, a):
    assert tunnel.transfer(E, [V0], [a])[0] == pytest.approx(tunnel.rect_analytic(E, V0, a), rel=1e-8)


def test_sio2_leakage_about_one_decade_per_two_angstrom():
    T = tunnel.leakage_vs_eot([1.0, 1.2], "SiO2")
    assert 0.8 < math.log10(T[0] / T[1]) < 1.4


def test_high_k_cuts_leakage_at_equal_eot():
    si = tunnel.leakage_vs_eot([1.0], "SiO2")[0]
    hk = tunnel.leakage_vs_eot([1.0], "HfO2", il_nm=0.5)[0]
    assert si / hk > 100


def test_resonant_tunnelling_peak():
    Es = np.linspace(0.02, 0.5, 500)
    Ts = [tunnel.transfer(E, [0.6, 0, 0.6], [1, 4, 1], m=[0.067] * 3, m_out=0.067)[0] for E in Es]
    assert max(Ts) > 0.99


# --- 2D Poisson -------------------------------------------------------------
def test_dibl_falls_with_length_and_double_gate_wins():
    sg = [poisson2d.dibl(L) for L in (15, 30)]
    dg = [poisson2d.dibl(L, True) for L in (15, 30)]
    assert sg[0] > sg[1] and dg[0] > dg[1]
    assert dg[0] < sg[0] and dg[1] < sg[1]


def test_long_double_gate_swing_near_ideal():
    assert 58 < poisson2d.swing(50, True) < 66


# --- Monte Carlo ------------------------------------------------------------
def test_monte_carlo_low_field_mobility():
    assert 1100 < montecarlo.mobility(1000, n=1500, t_ps=4) < 1800


def test_monte_carlo_velocity_saturation():
    v = montecarlo.simulate(1e5, n=1500, t_ps=3)["v_cm_s"]
    assert 0.8e7 < v < 1.5e7


# --- crystals ---------------------------------------------------------------
@pytest.mark.parametrize("key,bond", [("Si", 2.35), ("Diamond", 1.54), ("GaAs", 2.45), ("GaN", 1.95), ("4H-SiC", 1.89), ("MoS2", 2.41)])
def test_crystal_bond_lengths(key, bond):
    assert crystal.structure(key)["bond_A"] == pytest.approx(bond, abs=0.03)


def test_tetrahedral_angle():
    assert crystal.structure("Si")["angle_deg"] == pytest.approx(109.47, abs=0.1)


# --- browser twins ----------------------------------------------------------
def test_javascript_physics_matches_python():
    """site/js/physics/*.js must reproduce data/physics_reference.json."""
    import shutil
    import subprocess
    node = shutil.which("node")
    if not node:
        pytest.skip("Node.js not installed")
    root = Path(__file__).resolve().parents[1]
    r = subprocess.run([node, str(root / "tests" / "js_parity.mjs")], capture_output=True, text=True, timeout=120)
    assert r.returncode == 0, r.stdout + r.stderr
