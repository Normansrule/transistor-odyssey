"""Circuit Lab (circuits.html): switch-level gates, logical effort, ripple-carry adder,
6T SRAM margins and floating-gate flash. Each check ties the model to a textbook
number or a closed form."""
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "sim"))
from transistor_sim import mosfet  # noqa: E402
from transistor_sim.physics import logic, sram, flash  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]


# --- gates ---------------------------------------------------------------------
BOOL = {
    "inv": lambda a: not a, "nand2": lambda a, b: not (a and b), "nor2": lambda a, b: not (a or b),
    "nand3": lambda a, b, c: not (a and b and c), "nor3": lambda a, b, c: not (a or b or c),
    "aoi21": lambda a, b, c: not ((a and b) or c), "oai21": lambda a, b, c: not ((a or b) and c),
    "aoi22": lambda a, b, c, d: not ((a and b) or (c and d)), "xor2": lambda a, b: a != b,
    "maj": lambda a, b, c: not ((a and b) or (c and (a or b))),
}


@pytest.mark.parametrize("key", list(logic.GATES))
def test_switch_level_matches_boolean_function(key):
    net = logic.netlist(key)
    for bits, y in logic.truth(key):
        assert y == int(BOOL[key](*bits))
        v = logic.simulate(net, dict(zip(net["inputs"], bits)))
        assert v["y"] == str(y)                      # never X: complementary CMOS has no fights


def test_logical_effort_textbook_values():
    # Sutherland, Sproull & Harris, Table 4.1 (gamma = 2)
    want = {"inv": (1, 1), "nand2": (4 / 3, 2), "nor2": (5 / 3, 2), "nand3": (5 / 3, 3), "nor3": (7 / 3, 3)}
    for k, (g, p) in want.items():
        e = logic.effort(k)
        assert max(e["g"].values()) == pytest.approx(g) and e["p"] == pytest.approx(p)
    a = logic.effort("aoi21")
    assert a["g"]["A"] == pytest.approx(2) and a["g"]["C"] == pytest.approx(5 / 3) and a["p"] == pytest.approx(7 / 3)
    assert logic.effort("maj")["g"]["C"] == pytest.approx(2)                  # mirror-adder carry input
    assert logic.delay("inv", 4) == pytest.approx(5)                          # FO4 inverter = 5 tau


def test_transistor_counts():
    assert [logic.effort(k)["n"] for k in ("inv", "nand2", "aoi21", "aoi22", "xor2", "maj")] == [2, 4, 6, 8, 12, 10]


def test_floating_node_keeps_charge_and_short_gives_x():
    # pass transistor: an nFET from input D to node q, gate EN. EN = 0 leaves q floating with its old value.
    net = dict(transistors=[dict(type="n", g="EN", a="D", b="q", w=1)], nodes=["D", "EN", "q"], inputs=["D", "EN"])
    v1 = logic.simulate(net, {"D": 1, "EN": 1})
    assert v1["q"] == "1"
    v2 = logic.simulate(net, {"D": 0, "EN": 0}, prev=v1)
    assert v2["q"] == "1"                            # dynamic storage, the idea behind DRAM
    fight = dict(transistors=[dict(type="n", g="vdd", a="vdd", b="q", w=1), dict(type="n", g="vdd", a="q", b="gnd", w=1)],
                 nodes=["vdd", "gnd", "q"], inputs=[])
    assert logic.simulate(fight, {})["q"] == "X"


# --- adder ---------------------------------------------------------------------
def test_ripple_adder_adds_every_4bit_pair():
    for a in range(16):
        for b in range(16):
            r = logic.ripple_add(0, 0, a, b, n=4)
            assert r["sum"] == a + b


def test_worst_case_carry_ripples_through_every_stage():
    d = logic.adder_delays()
    for n in (4, 8, 16):
        r = logic.ripple_add(0, 0, 2 ** n - 1, 1, n=n)
        assert r["settle"] == pytest.approx(logic.ripple_worst(n, d))
        assert r["settle"] == pytest.approx(max((n - 1) * d["t_c"] + d["t_s"], n * d["t_c"]))
    # glitches: 0+0 -> 255+1 toggles some sum bits more than once
    r = logic.ripple_add(0, 0, 255, 1, n=8)
    assert r["transitions"] > bin(r["sum"]).count("1")


def test_prefix_adder_beats_ripple_for_wide_words():
    assert logic.kogge_stone_delay(64) < logic.ripple_worst(64) / 5
    assert logic.kogge_stone_count(64) > logic.ripple_count(64)               # speed costs transistors
    # log2 growth: each doubling adds one prefix level
    d1, d2, d3 = (logic.kogge_stone_delay(n) for n in (16, 32, 64))
    assert d2 - d1 == pytest.approx(d3 - d2)


# --- SRAM ----------------------------------------------------------------------
def test_sram_butterfly_snm_is_symmetric_and_bounded():
    p = mosfet.preset("2011_22nm_finfet")
    vin, vout = sram.vtc(p, p.VDD, cr=2.0, beta=0.8)
    s, d = sram.snm(vin, vout)
    assert d["lobes"][0] == pytest.approx(d["lobes"][1], rel=0.02)
    assert 0.2 * p.VDD < s < 0.5 * p.VDD                                      # ideal limit is VDD / 2


def test_ideal_inverter_snm_approaches_half_vdd():
    # a perfect step inverter gives a square butterfly lobe of side VDD/2
    vin = np.linspace(0, 1, 2001)
    vout = 1 / (1 + np.exp((vin - 0.5) / 0.002))
    assert sram.snm(vin, vout)[0] == pytest.approx(0.5, abs=0.02)


def test_read_disturb_and_cell_ratio():
    p = mosfet.preset("2011_22nm_finfet")
    lo, hi = sram.cell(p, cr=1.0, beta=0.8), sram.cell(p, cr=3.0, beta=0.8)
    assert lo["read_snm"] < lo["hold_snm"]                                     # reading is the risky moment
    assert hi["read_snm"] > lo["read_snm"] and hi["v_read"] < lo["v_read"]     # stronger pull-down resists disturb
    h, r = sram.snm_vs_vdd(p, np.array([0.3, 0.5, 0.8]), beta=0.8)
    assert np.all(np.diff(h) > 0) and np.all(np.diff(r) > 0)


def test_mismatch_shrinks_the_weaker_lobe():
    p = mosfet.preset("2025_2nm_gaa")
    m = [sram.cell(p, beta=0.9, dvt=d)["read_snm"] for d in (0.0, 0.1, 0.2)]
    assert m[0] > m[1] > m[2]


def test_sram_area_data_monotone_until_n3():
    import json
    d = json.loads((ROOT / "data" / "memory.json").read_text(encoding="utf-8"))
    a = [c["area_um2"] for c in d["sram"]]
    assert a[0] == 1.0 and min(a) == pytest.approx(0.0175)
    i3 = [c["node"] for c in d["sram"]].index("N3E")
    assert a[i3] > a[i3 - 1]                                                   # N3E is larger than N3B: SRAM stalled
    layers = [x["layers"] for x in d["nand"]]
    assert layers == sorted(layers) and layers[-1] >= 300


# --- flash ---------------------------------------------------------------------
def test_fowler_nordheim_slope_and_magnitude():
    A, B = flash.fn_coeffs(3.1, 0.42)
    assert B == pytest.approx(2.42e10, rel=0.03)                               # ~240 MV/cm for Si/SiO2
    # a straight FN plot: ln(J/E^2) vs 1/E has slope -B
    E = np.array([8e8, 1.0e9, 1.2e9])
    y = np.log(flash.fn_current(E) / E ** 2)
    slope = np.polyfit(1 / E, y, 1)[0]
    assert slope == pytest.approx(-B, rel=1e-6)
    assert 1e-4 < flash.fn_current(1e9) * 1e-4 < 1e-1                          # mA/cm^2 range at 10 MV/cm


def test_ispp_converges_to_one_step_per_pulse():
    r = flash.ispp(3.0, step_v=0.5)
    steps = np.diff(r["vt"])
    assert steps[-1] == pytest.approx(0.5, abs=0.02)
    assert r["vt"][-1] >= 3.0 and r["vt"][-2] < 3.0


def test_program_then_erase_is_symmetric():
    up, _, _ = flash.pulse(-2.0, 18.0, 1e-4)
    down, _, _ = flash.pulse(up, -18.0 + 2 * up, 1e-4)   # mirror field
    assert up > 3 and down < up


def test_more_bits_need_smaller_steps_and_more_pulses():
    rows = []
    for b, st in ((1, 0.5), (2, 0.3), (3, 0.15), (4, 0.05)):
        L = flash.levels(b, step_v=st)
        rows.append((L["n"], L["margin"], flash.ispp(L["centres"][-1] - st / 2, step_v=st)["pulses"]))
    assert [r[0] for r in rows] == [2, 4, 8, 16]
    assert all(rows[i][1] > rows[i + 1][1] for i in range(3))                  # margins shrink
    assert all(rows[i][2] < rows[i + 1][2] for i in range(3))                  # writes get slower
    assert flash.levels(4, step_v=0.3)["margin"] < 0                           # QLC with an MLC step cannot be read
