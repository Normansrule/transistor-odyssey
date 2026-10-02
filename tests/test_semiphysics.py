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


# --- band structure (Kronig–Penney) ----------------------------------------
from transistor_sim.physics import bandstructure, qwell, chargesheet, thermal, litho  # noqa: E402


def test_weak_potential_gap_matches_nearly_free_electrons():
    g = bandstructure.gaps(0.05, 0.4, 0.1)[0]
    assert g[1] - g[0] == pytest.approx(bandstructure.nfe_first_gap(0.05, 0.4, 0.1), rel=0.03)
    # and the gap sits at the free-electron zone-boundary energy ħ²(π/d)²/2m
    E_zb = (bandstructure.HBAR * math.pi / 0.5e-9) ** 2 / (2 * bandstructure.M0) / bandstructure.QE
    assert 0.5 * (g[0] + g[1]) == pytest.approx(E_zb, rel=0.02)


def test_free_electron_mass_and_heavier_bands_in_strong_crystals():
    assert bandstructure.effective_mass(1e-3, 0.4, 0.1)[0] == pytest.approx(1.0, rel=0.01)
    assert bandstructure.effective_mass(5.0, 0.5, 0.3)[0] > 2.0


def test_stronger_barriers_open_wider_gaps():
    assert (lambda a, b: a[1] - a[0] < b[1] - b[0])(bandstructure.gaps(0.5, 0.5, 0.2)[0], bandstructure.gaps(2.0, 0.5, 0.2)[0])


# --- quantum wells ----------------------------------------------------------
def test_finite_well_matches_transcendental_solution():
    E = qwell.finite_well(5.0)["E"][0]
    assert E == pytest.approx(qwell.finite_well_exact(5.0, 3.1, 0.916, 0.5), rel=0.01)
    assert E < qwell.infinite_well_levels(5.0)[0]                      # leakage into the barrier lowers E


def test_confinement_energy_scales_like_inverse_square():
    e3, e6 = qwell.finite_well(3.0)["E"][0], qwell.finite_well(6.0)["E"][0]
    assert 3.0 < e3 / e6 < 4.2                                          # 4 for an infinite well


def test_algan_gan_2deg_density():
    s = qwell.hemt_sp(0.25, 20.0)
    assert 7e12 < s["ns"] < 1.4e13                                      # measured ~1e13 cm⁻² (Ambacher 1999)
    assert s["E"][0] < 0                                                # ground subband below E_F
    assert s["ns"] < s["sigma"] / qwell.QE * 1e-4                       # cannot exceed the polarization charge
    assert qwell.hemt_sp(0.25, 30.0)["ns"] > s["ns"] > qwell.hemt_sp(0.25, 10.0)["ns"]


# --- charge-sheet MOSFET ----------------------------------------------------
def test_charge_sheet_linear_region_transconductance():
    p = chargesheet.params()
    vd = 0.01
    gm = (chargesheet.drain_current(1.2, vd, p) - chargesheet.drain_current(1.0, vd, p)) / 0.2
    # slightly below µC_ox(W/L)V_DS because ψ_s still creeps up with V_G in strong inversion
    assert 0.85 < gm / (p["W"] / p["L"] * p["mu"] * p["Cox"] * vd) < 1.0


def test_charge_sheet_saturates_and_matches_square_law():
    p = chargesheet.params()
    i1, i2 = chargesheet.drain_current(1.0, 1.2, p), chargesheet.drain_current(1.0, 1.8, p)
    assert i2 == pytest.approx(i1, rel=1e-3)                            # flat in saturation (long channel)
    # square law: √I_Dsat is a straight line in V_GS with slope √(µC_ox W / 2nL)
    vgs = [0.9, 1.1, 1.3]
    r = [math.sqrt(chargesheet.drain_current(v, 2.0, p)) for v in vgs]
    assert (r[2] - r[1]) == pytest.approx(r[1] - r[0], rel=0.03)
    n = 1 + p["gamma"] / (2 * math.sqrt(2 * p["phiF"]))
    slope2 = ((r[2] - r[0]) / 0.4) ** 2
    assert slope2 == pytest.approx(p["W"] / p["L"] * p["mu"] * p["Cox"] / (2 * n), rel=0.15)


def test_charge_sheet_subthreshold_swing():
    p = chargesheet.params()
    assert 60 < chargesheet.swing(p) < 75                               # n·60 mV/dec with n ≈ 1.1


# --- heat -------------------------------------------------------------------
def test_thermal_solver_matches_1d_limit():
    g = thermal.build("Si", w_um=300, half_width_um=150, t_sub_um=100, tbr_m2K_GW=20)
    T = thermal.solve(g, 5.0)
    exact = thermal.one_d_rise(5.0, 300, [(2, 130), (100, 150)]) + 5e3 / 300e-6 * 20e-9
    assert T.max() - 300 == pytest.approx(exact, rel=1e-3)


def test_better_substrates_run_cooler():
    r = {s: thermal.peak_rise(s, 5.0)[0] for s in ("Sapphire", "Si", "SiC", "Diamond")}
    assert r["Sapphire"] > r["Si"] > r["SiC"] > r["Diamond"]
    assert thermal.peak_rise("Diamond", 5.0, tbr_m2K_GW=25)[0] > r["Diamond"]   # boundary resistance costs


# --- lithography ------------------------------------------------------------
def test_coherent_cutoff_at_lambda_over_na():
    lam, NA = 193.0, 1.35
    assert litho.contrast(litho.aerial_image(lam / NA * 1.05, lam, NA, kind="coherent")[1]) > 0.9
    assert litho.contrast(litho.aerial_image(lam / NA * 0.95, lam, NA, kind="coherent")[1]) < 1e-9


def test_off_axis_illumination_extends_resolution_to_k1_quarter():
    lam, NA, p = 193.0, 1.35, 76.0                                      # k1 ≈ 0.266
    dip = litho.aerial_image(p, lam, NA, kind="dipole", sigma_c=lam / (2 * p * NA), sigma_w=0.05)[1]
    conv = litho.aerial_image(p, lam, NA, kind="conventional", sigma=0.5)[1]
    assert litho.contrast(dip) > 0.5 and litho.contrast(conv) < 0.05
    below = litho.aerial_image(lam / (2 * NA) * 0.95, lam, NA, kind="dipole", sigma_c=0.99, sigma_w=0.01)[1]
    assert litho.contrast(below) < 1e-9                                 # nothing below k1 = 0.25


def test_defocus_degrades_contrast():
    a = litho.contrast(litho.aerial_image(120, 193, 1.35, sigma=0.7)[1])
    b = litho.contrast(litho.aerial_image(120, 193, 1.35, sigma=0.7, defocus_nm=80)[1])
    assert b < a


# --- device atlas (bands for every transistor) ------------------------------
from transistor_sim import bandatlas  # noqa: E402

DEVICES = bandatlas.load_devices()


def test_device_atlas_entries_are_complete():
    import json
    refs = {r["id"] for r in json.loads((Path(__file__).resolve().parents[1] / "data" / "references.json").read_text(encoding="utf-8"))["references"]}
    assert len(DEVICES) >= 18
    for k, d in DEVICES.items():
        for f in ("name", "short", "family", "year", "summary", "steps", "facts", "refs", "model", "labels", "where"):
            assert f in d, (k, f)
        assert len(d["steps"]) == 4 and {s["when"] for s in d["steps"]} <= {"off", "sub", "on", "sat"}
        assert set(d["refs"]) <= refs, (k, set(d["refs"]) - refs)
        assert d["model"]["lateral"] in ("fet", "bjt", "tfet", "sbfet")


@pytest.mark.parametrize("key", sorted(DEVICES))
def test_every_device_switches_off_and_on(key):
    d = DEVICES[key]; m = d["model"]
    lo, hi = m["vg"]
    f_lo, f_hi = bandatlas.on_fraction(d, lo), bandatlas.on_fraction(d, hi)
    assert min(f_lo, f_hi) < 0.06 and max(f_lo, f_hi) > 0.94
    L = bandatlas.lateral(d, lo, m["vd"][1] * 0.5)
    assert np.all(np.nan_to_num(L["Ec"], nan=1e9) > np.nan_to_num(L["Ev"], nan=-1e9))   # gap everywhere


def test_fet_barrier_falls_with_gate_and_drain():
    d = DEVICES["planar_mosfet"]
    b = [bandatlas.barrier(d, v, 0.05) for v in (0.0, 0.3, 0.6)]
    assert b[0] > b[1] > b[2]
    assert bandatlas.barrier(d, 0.2, 1.0) < bandatlas.barrier(d, 0.2, 0.05)      # DIBL
    # better electrostatics → less DIBL
    dibl = {k: bandatlas.barrier(DEVICES[k], 0.1, 0.05) - bandatlas.barrier(DEVICES[k], 0.1, 0.8) for k in ("planar_mosfet", "finfet", "gaa")}
    assert dibl["planar_mosfet"] > dibl["finfet"] > dibl["gaa"]


def test_bjt_barrier_is_vbi_minus_vbe():
    d = DEVICES["bjt"]
    for vbe in (0.2, 0.5, 0.7):
        assert bandatlas.lateral(d, vbe, 2.0)["barrier"] == pytest.approx(0.9 - vbe, abs=1e-9)


def test_hbt_valence_step_in_base():
    d = DEVICES["hbt"]; L = bandatlas.lateral(d, 0.6, 2.0)
    base = (L["x"] > 0.42) & (L["x"] < 0.54)
    assert np.allclose((L["Ec"] - L["Ev"])[base], 1.12 - 0.15)


def test_tfet_window_opens_with_gate():
    d = DEVICES["tfet"]
    assert bandatlas.lateral(d, 0.1, 0.5)["window"] < 0 < bandatlas.lateral(d, 0.9, 0.5)["window"]


def test_hemt_vertical_subband_crosses_fermi_level():
    d = DEVICES["gan_hemt"]
    on, off = bandatlas.vertical(d, 0.0), bandatlas.vertical(d, -5.0)
    assert on["E"][0] < 0 < off["E"][0] and on["ns"] > 5e12 and off["ns"] < 1e11


def test_mos_vertical_inverts_above_threshold():
    d = DEVICES["planar_mosfet"]
    lo, hi = bandatlas.vertical(d, 0.0), bandatlas.vertical(d, 1.2)
    assert hi["psi_s"] > lo["psi_s"]
    assert hi["Ec"][0] < 0.15                                     # conduction band near E_F at the surface


def test_flash_programming_raises_threshold():
    d = DEVICES["flash"]
    assert bandatlas.on_fraction(d, 2.5, prog=1.0) < bandatlas.on_fraction(d, 2.5, prog=0.0)


def test_band_alignment_offsets():
    h = bandatlas.heterojunction("GaAs", "AlGaAs")
    assert h["type"].startswith("I ") and h["dEc"] == pytest.approx(0.22, abs=0.01)
    assert bandatlas.heterojunction("Si", "Ge")["type"].startswith("II")          # Si/Ge is staggered
    from transistor_sim.physics import tunnel
    for ox in ("SiO2", "HfO2", "Al2O3"):                                          # consistent with the tunnelling lab
        assert bandatlas.heterojunction("Si", ox)["dEc"] == pytest.approx(tunnel.DIELECTRICS[ox]["phiB"], abs=0.02)


def test_device_atlas_links_resolve():
    """Every atlas device has a scene, an engineering cross-section, a chapter and a Physics Lab section."""
    import re
    from pathlib import Path
    root = Path(__file__).resolve().parent.parent
    scenes = (root / "site/js/devices/scenes.js").read_text(encoding="utf-8")
    physics = (root / "site/physics.html").read_text(encoding="utf-8")
    lab_ids = set(re.findall(r'<section class="lab-sec" id="([a-z]+)"', physics))
    for k, d in bandatlas.load_devices().items():
        assert re.search(rf"^\s+{k}: ", scenes, re.M) or f"{k}:" in scenes, k
        assert (root / "site/assets/xsec" / f"{d['xsec']}.svg").exists(), d["xsec"]
        assert (root / "docs" / d["docs"]).exists(), d["docs"]
        assert d["lab"] in lab_ids, d["lab"]
        assert (root / "figures/bands" / f"{k}.png").exists(), k


# ---------------------------------------------------------------------------
# Equilibrium heterojunction solver
def _hj(a, b, da, db, V=0.0):
    from transistor_sim.physics import hetero
    M = bandatlas.alignment()
    return hetero.solve(M[a], M[b], da, db, V)


def test_hetero_homojunction_matches_depletion_theory():
    import math
    from transistor_sim.physics import hetero
    M = bandatlas.alignment()
    r = _hj("Si", "Si", -1e17, 1e17)
    nA, pA, dA = hetero.neutral(M["Si"], -1e17)
    nB, pB, dB = hetero.neutral(M["Si"], 1e17)
    kT = hetero.K_B * 300
    ni2 = M["Si"]["Nc"] * M["Si"]["Nv"] * math.exp(-M["Si"]["Eg"] / kT)
    assert abs(r["Vbi"] - kT * math.log(1e34 / ni2)) < 1e-3          # qVbi = kT ln(Na Nd / ni^2)
    assert abs((r["VA"] + r["VB"]) + r["Vbi"]) < 1e-6                # all of Vbi drops across the junction
    assert abs(r["VA"] - r["VB"]) < 1e-3                             # symmetric doping splits it evenly
    eps = M["Si"]["eps"] * hetero.EPS0
    W = math.sqrt(2 * eps * r["Vbi"] / hetero.Q * 2 / 1e17) * 1e7
    assert 0.95 < r["W_nm"] / W < 1.2                                # Boltzmann tails widen it slightly
    rb = _hj("Si", "Si", -1e17, 1e17, -2.0)
    Wb = W * math.sqrt((r["Vbi"] + 2.0) / r["Vbi"])
    assert abs(rb["W_nm"] / Wb - 1) < 0.06                           # reverse bias: W grows as sqrt(Vbi - V)
    assert abs(rb["VA"] + rb["VB"] + r["Vbi"] + 2.0) < 1e-6


def test_hetero_charge_neutral_and_offsets():
    import numpy as np
    for case in [("GaAs", "AlGaAs", 1e15, 2e18), ("Si", "SiGe", 1e18, -1e18), ("InGaAs", "InP", 1e15, 1e18)]:
        r = _hj(*case)
        Q = np.trapezoid(r["rho"], r["x_nm"] * 1e-7) / 1.602e-19
        dep = abs(r["VA"]) + abs(r["VB"])
        assert abs(Q) < 1e-3 * 1e18 * r["W_nm"] * 1e-7 + 1e9, case   # net charge ~ 0
        i0 = r["i0"]
        assert abs((r["Ec"][i0] - r["Ec"][i0 - 1]) - (r["Evac"][i0] - r["Evac"][i0 - 1]) - r["dEc"]) < 1e-9
        assert dep > 0.05


def test_hetero_modulation_doping_accumulates_electrons():
    """n-AlGaAs next to undoped GaAs: electrons transfer into the GaAs side of the interface."""
    r = _hj("GaAs", "AlGaAs", 1e15, 2e18)
    i0 = r["i0"]
    assert r["n"][i0 - 1] > 1e17                     # far above the 1e15 background
    assert r["ns"] > 5e11                            # a sheet of electrons (no polarization in this model)
    assert r["VA"] < -0.1 and r["VB"] < -0.1         # GaAs bends down, AlGaAs is depleted


def test_hetero_insulator_gives_flat_bands_and_true_offsets():
    r = _hj("Si", "SiO2", -1e17, 0.0)
    assert abs(r["VA"]) < 1e-9 and abs(r["VB"]) < 1e-9
    assert abs(r["dEc"] - (4.05 - 0.95)) < 1e-9       # 3.1 eV electron barrier


def test_hetero_forward_bias_narrows_junction():
    w = [_hj("Si", "Si", -1e17, 1e17, V)["W_nm"] for V in (-1.0, 0.0, 0.4)]
    assert w[0] > w[1] > w[2]
