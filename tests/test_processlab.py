"""Process Lab (process.html): Deal–Grove oxidation, ion implantation and diffusion,
die yield and cost, and electromigration. Each check ties a model to a closed form,
a limiting case or a published number."""
import json
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "sim"))
from transistor_sim.physics import oxidation as ox, implant as im, yieldcost as yc, electromigration as em  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]


# --- oxidation -----------------------------------------------------------------
def test_deal_grove_satisfies_its_own_equation_and_limits():
    B, BA = ox.rate_constants("wet", 1000)
    A = B / BA
    t = np.array([0.01, 0.1, 1, 10, 100])
    x = ox.thickness("wet", 1000, t)
    assert np.allclose(x * x + A * x, B * t, rtol=1e-12)
    assert x[0] == pytest.approx(BA * t[0], rel=0.05)                  # thin: linear, x ≈ (B/A) t
    assert x[-1] == pytest.approx(math.sqrt(B * t[-1]), rel=0.05)      # thick: parabolic, x ≈ sqrt(B t)


def test_textbook_thicknesses():
    # wet 1000 °C for 1 h on (100) Si grows ~0.4 µm; dry grows ~0.05 µm (Jaeger / Plummer oxidation charts)
    assert 0.3 < ox.thickness("wet", 1000, 1.0) < 0.5
    assert 0.03 < ox.thickness("dry", 1000, 1.0) < 0.08
    assert ox.thickness("dry", 1000, 1.0, orient="111") > ox.thickness("dry", 1000, 1.0, orient="100")
    assert ox.time_to("wet", 1000, float(ox.thickness("wet", 1000, 2.5))) == pytest.approx(2.5, rel=1e-9)


def test_arrhenius_activation_energy_recovered():
    k = ox.KB
    b1, _ = ox.rate_constants("dry", 900); b2, _ = ox.rate_constants("dry", 1100)
    Ea = math.log(b2 / b1) * k / (1 / 1173.15 - 1 / 1373.15)
    assert Ea == pytest.approx(1.23, rel=1e-9)


# --- implantation and diffusion ---------------------------------------------------
@pytest.mark.parametrize("ion,E,rp,drp", [("B", 80, 240, 63), ("P", 100, 120, 45), ("B", 100, 300, 70)])
def test_lss_ranges_near_tabulated(ion, E, rp, drp):
    r = im.range_stats(ion, E)
    assert r["Rp"] == pytest.approx(rp, rel=0.2)
    assert r["dRp"] == pytest.approx(drp, rel=0.35)


def test_heavier_ions_stop_shorter_and_cross_over_later():
    assert im.range_stats("As", 50)["Rp"] < im.range_stats("P", 50)["Rp"] < im.range_stats("B", 50)["Rp"]
    c = {k: im.crossover_keV(k) for k in ("B", "P", "As")}
    assert 5 < c["B"] < 30 and 80 < c["P"] < 250 and c["As"] > 400              # ~17, ~150, ~700 keV in textbooks


def test_profile_conserves_dose_through_anneal():
    x = np.linspace(-2000, 4000, 30001)
    for T, t in [(None, 0), (1000, 10), (1000, 600)]:
        N = im.profile(x, "B", 20, 1e15, T, t)
        assert np.trapezoid(N, x * 1e-7) == pytest.approx(1e15, rel=1e-4)


def test_anneal_deepens_junction_and_lowers_peak():
    a = im.junction("B", 10, 1e15, 1e17)
    b = im.junction("B", 10, 1e15, 1e17, 1000, 60)
    assert b["xj"] > a["xj"] and b["peak"] < a["peak"]
    # Gaussian closed form for x_j
    s = a["sigma_nm"]; peak = 1e15 / (math.sqrt(2 * math.pi) * s * 1e-7)
    assert a["xj"] == pytest.approx(a["Rp"] + s * math.sqrt(2 * math.log(peak / 1e17)), rel=1e-3)


def test_sheet_resistance_falls_with_dose_and_mobility_limits():
    r1, r2 = im.junction("As", 30, 1e14, 1e16)["Rs"], im.junction("As", 30, 1e15, 1e16)["Rs"]
    assert r2 < r1 / 5                                                          # ×10 dose, mobility drops: less than ×10
    assert im.mobility(1e14, "n") == pytest.approx(1330, rel=0.01) and im.mobility(1e21, "n") < 100


# --- yield and cost --------------------------------------------------------------
def test_dies_per_wafer_formula_matches_grid_count():
    for s in (5, 10, 20):
        n, f = len(yc.die_grid(s, s)), yc.dies_per_wafer(s * s, 300 - 6)
        assert f * 0.95 < n < f * 1.12                                         # grid includes 0.1 mm scribe lanes


def test_yield_models_order_and_limits():
    A, D = 100, 0.5
    p, m, n = (yc.yield_model(A, D, k) for k in ("poisson", "murphy", "negbin"))
    assert p < m < n                                                            # clustering helps big dies
    assert yc.yield_model(A, D, "negbin", alpha=1e6) == pytest.approx(p, rel=1e-4)
    assert yc.yield_model(A, 0.0) == 1.0


def test_monte_carlo_wafer_matches_negative_binomial():
    ys = [yc.simulate_wafer(10, 10, 0.5, 3, seed=s)["yield_"] for s in range(1, 9)]
    assert np.mean(ys) == pytest.approx(yc.yield_model(100, 0.5, "negbin", 3), abs=0.03)


def test_cost_per_transistor_stopped_falling():
    d = json.loads((ROOT / "data" / "fab_economics.json").read_text(encoding="utf-8"))
    rows = [w for w in d["wafers"] if "chips_per_wafer" in w]
    cost = [w["wafer_usd"] / w["chips_per_wafer"] for w in rows]
    assert cost[0] / cost[3] > 3                                               # 90 → 28 nm: big drop
    assert cost[-1] / cost[-2] > 0.95                                          # 7 → 5 nm: roughly flat


# --- electromigration ------------------------------------------------------------
def test_blech_product_in_copper_range_and_immortal_short_lines():
    assert 2500 < em.blech_product(105) < 6000
    L = em.blech_length_um(2, 300)
    assert em.time_to_fail(0.9 * L, 2, 300) == float("inf")
    assert math.isfinite(em.time_to_fail(1.5 * L, 2, 300))


def test_korhonen_steady_state_is_linear_with_peak_GL_over_2():
    line = em.Line(20, 1, 105, nx=81)
    tau = line.L ** 2 / line.k
    line.step(tau / 20, 200)
    assert np.allclose(line.sigma, line.steady(), rtol=0, atol=1e-3 * line.G * line.L)
    assert abs(line.sigma.sum()) < 1e-6 * line.G * line.L * line.nx          # atoms are conserved


def test_long_line_reproduces_black_n2_and_activation_energy():
    t1, t2 = em.time_to_fail(1000, 1, 300), em.time_to_fail(1000, 2, 300)
    assert t1 / t2 == pytest.approx(4.0, rel=0.03)                            # Black's exponent n = 2
    assert t2 == pytest.approx(em.t_nucleation_long(2, 300), rel=0.02)
    assert em.black_ratio(1, 300, 1, 105) > 1e3                               # use conditions last thousands × longer
