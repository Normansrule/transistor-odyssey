"""Physics sanity tests: each check ties a model output to a published number."""
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "sim"))
from transistor_sim import mosfet, hemt, materials, scaling, bjt, dopants, steep  # noqa: E402


def test_ideal_subthreshold_limit():
    # kT/q ln10 at 300 K = 59.5 mV/dec
    assert mosfet.metrics(mosfet.PRESETS["2011_22nm_finfet"])["ideal_SS_mV_dec"] == pytest.approx(59.5, abs=0.2)


@pytest.mark.parametrize("key", list(mosfet.PRESETS))
def test_subthreshold_swing_never_beats_boltzmann(key):
    m = mosfet.metrics(mosfet.PRESETS[key])
    assert m["SS_mV_dec"] >= m["ideal_SS_mV_dec"] - 0.5


def test_multigate_improves_swing_over_planar():
    planar = mosfet.metrics(mosfet.PRESETS["2007_45nm_hkmg"])["SS_mV_dec"]
    fin = mosfet.metrics(mosfet.PRESETS["2011_22nm_finfet"])["SS_mV_dec"]
    gaa = mosfet.metrics(mosfet.PRESETS["2025_2nm_gaa"])["SS_mV_dec"]
    assert fin < planar and gaa < fin


def test_45nm_drive_current_near_published():
    # Mistry et al. IEDM 2007: NMOS ~1.36 mA/µm at 100 nA/µm, 1.0 V
    m = mosfet.metrics(mosfet.PRESETS["2007_45nm_hkmg"])
    assert 1000 < m["Ion_uA_um"] < 1600
    assert 20 < m["Ioff_nA_um"] < 300


def test_mos2_transconductance_matches_nycu_tsmc():
    # NYCU/TSMC 2026: peak gm ~0.45 mS/µm at ~100 nm channel, EOT ~1 nm
    m = mosfet.metrics(mosfet.PRESETS["2026_mos2_2d"])
    assert m["gm_max_mS_um"] == pytest.approx(0.45, rel=0.15)


def test_current_monotonic_in_vgs_and_vds():
    p = mosfet.PRESETS["1999_180nm"]
    vg = np.linspace(0, p.VDD, 50)
    assert np.all(np.diff(mosfet.drain_current(p, vg, p.VDD)) > 0)
    vd = np.linspace(0, p.VDD, 50)
    assert np.all(np.diff(mosfet.drain_current(p, p.VDD, vd)) >= 0)
    assert mosfet.drain_current(p, p.VDD, 0.0) == pytest.approx(0.0, abs=1e-15)


def test_inverter_switches_near_midpoint():
    p = mosfet.PRESETS["2011_22nm_finfet"]
    vin, vout = mosfet.cmos_inverter_vtc(p, n_points=81)
    assert vout[0] == pytest.approx(p.VDD, rel=0.02)
    assert vout[-1] == pytest.approx(0.0, abs=0.02 * p.VDD)
    vm = vin[np.argmin(np.abs(vout - vin))]
    assert vm == pytest.approx(p.VDD / 2, abs=0.05 * p.VDD)


def test_algan_polarization_matches_ambacher():
    # Ambacher 2000: |sigma|/q ≈ 1.6–1.7e13 cm^-2 at x = 0.3
    s = hemt.polarization_charge(0.3) / hemt.Q * 1e-4
    assert 1.5e13 < s < 1.8e13


def test_2deg_density_and_critical_thickness():
    assert 0.9e13 < hemt.sheet_density(0.25, 25) < 1.5e13
    assert 2.0 < hemt.critical_thickness_nm(0.25) < 5.0
    assert hemt.sheet_density(0.3, 30) > hemt.sheet_density(0.3, 10)


def test_hemt_current_density_realistic():
    i, voff = hemt.hemt_iv(0.0, 10.0)
    assert 0.5 < float(i) < 1.5      # A/mm, typical GaN HEMT
    assert -8 < voff < -2


def test_baliga_ranking():
    rows = {r["id"]: r for r in materials.normalised_table()}
    order = ["Si", "GaAs", "SiC", "GaN", "Ga2O3", "C"]
    vals = [rows[k]["BFOM_rel_Si"] for k in order]
    assert vals == sorted(vals)
    assert 500 < rows["GaN"]["BFOM_rel_Si"] < 1500


def test_on_resistance_scales_with_vb_squared():
    si = next(m for m in materials.load_materials() if m["id"] == "Si")
    r1, r2 = materials.specific_on_resistance(si, 600), materials.specific_on_resistance(si, 1200)
    assert r2 / r1 == pytest.approx(4.0)


def test_moore_doubling_time():
    dt, *_ = scaling.moore_fit()
    assert 1.8 < dt < 2.5


def test_dennard_constant_power_density():
    assert scaling.dennard(1.4)["power density"] == 1.0
    assert scaling.dennard(2.0)["circuit density"] == 4.0


def test_bjt_60mv_per_decade():
    vbe, ic, _ = bjt.gummel()
    i1, i2 = np.searchsorted(vbe, 0.5), np.searchsorted(vbe, 0.6)
    decades = math.log10(ic[i2] / ic[i1])
    mv_per_dec = (vbe[i2] - vbe[i1]) / decades * 1e3
    assert mv_per_dec == pytest.approx(59.5, abs=1.5)


def test_boron_ionization_silicon_vs_diamond():
    si = dopants.ionized_fraction(dopants.DOPANTS["Si:B"], 1e17, 300.0)
    dia = dopants.ionized_fraction(dopants.DOPANTS["C:B"], 1e17, 300.0)
    assert si > 0.8          # essentially fully ionized
    assert dia < 0.02        # well under 2 % (literature: ~0.1-1 %)
    hot = dopants.ionized_fraction(dopants.DOPANTS["C:B"], 1e17, 600.0)
    assert hot > 10 * dia    # heating helps diamond a lot


def test_diamond_donor_depths_ordered():
    p300 = dopants.ionized_fraction(dopants.DOPANTS["C:P"], 1e17, 300.0)
    n300 = dopants.ionized_fraction(dopants.DOPANTS["C:N"], 1e17, 300.0)
    b300 = dopants.ionized_fraction(dopants.DOPANTS["C:B"], 1e17, 300.0)
    assert n300 < p300 < b300


def test_tfet_beats_boltzmann_but_ideal_mosfet_cannot():
    v = np.linspace(0, 0.8, 801)
    assert steep.min_swing(v, steep.tfet_current(v)) < 59.5
    ideal = mosfet.preset("2011_22nm_finfet", n=1.0, eta=0.0, Rs_ohm_um=0)
    ss = mosfet.metrics(ideal)["SS_mV_dec"]
    assert ss == pytest.approx(59.5, abs=1.5)


def test_tfet_on_current_is_low():
    # The known TFET weakness: far less drive than a FinFET at similar voltage
    assert float(steep.tfet_current(0.7)) < 0.1 * mosfet.metrics(mosfet.PRESETS["2011_22nm_finfet"])["Ion_uA_um"] * 1e-6
