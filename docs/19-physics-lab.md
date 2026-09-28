# 19 · The Physics Lab: semiconductor physics you can run

The [Physics Lab](https://normansrule.github.io/transistor-odyssey/physics.html) is a second page of the site with twelve live simulations in five parts.

Each simulation solves its governing equations in the browser (`site/js/physics/`) and has a Python twin in `sim/transistor_sim/physics/`. `tests/test_semiphysics.py` pins every Python model to a closed form or a measured number. `tests/js_parity.mjs` then checks that the JavaScript reproduces the Python results (`data/physics_reference.json`). CI runs both.

This chapter explains what each lab computes, what it leaves out, and which experiment to try first. Section numbers match the lab numbers on the page.

| Part | Labs |
|---|---|
| I · Materials | 01 crystal structure · 02 band structure · 03 bands and carriers |
| II · Junctions and gates | 04 pn junction · 05 MOS capacitor · 06 charge-sheet MOSFET |
| III · Quantum effects | 07 tunnelling · 08 quantum wells and the GaN 2DEG |
| IV · Scaling and transport | 09 short-channel electrostatics · 10 hot electrons · 11 self-heating |
| V · Manufacturing | 12 lithography optics |

---

## Part I · Materials

### 01 · Crystal structures

Atom positions are generated in Python from lattice constants for these structures:

* diamond cubic (Si, Ge, C)
* zincblende (GaAs)
* wurtzite (GaN)
* the 4H polytype (SiC)
* a monolayer of 2H-MoS₂ [@wilson1969]

The positions are drawn in three.js. The generated bond lengths (Si 2.35 Å, GaN 1.95 Å, MoS₂ 2.40 Å) and the tetrahedral angle of 109.47° are unit-tested.

### 02 · Band structure (Kronig–Penney)

This lab models a crystal as a one-dimensional row of square barriers. Bloch's theorem reduces the Schrödinger equation to one condition, cos(kd) = f(E) [@kronig1931]. An energy is allowed only where |f(E)| ≤ 1; everywhere else is a band gap. The lab draws the bands in real space and as E(k), with a free electron folded into the zone for comparison.

Two limits are tested:

* In a weak crystal, the first gap equals 2|V₁|, twice the first Fourier coefficient of the potential [@ashcroft1976].
* With no potential, the effective mass at the bottom of band 1 returns exactly to the free-electron mass.

![Kronig–Penney bands](../figures/kronig_penney.png)

**Try:** raise V₀ from 0 to 5 eV. The gaps open at the zone edge, then the bands flatten into isolated-atom levels, and the effective mass rises.

### 03 · Bands and carriers

The band gap follows Varshni's fit, E<sub>g</sub>(T) = E<sub>g0</sub> − αT²/(T + β) [@varshni1967]. The intrinsic density is n<sub>i</sub> = √(N<sub>c</sub>N<sub>v</sub>) exp(−E<sub>g</sub>/2kT). With every dopant ionized, charge neutrality gives n and p, and the Fermi level sits at kT ln(n/n<sub>i</sub>) from midgap [@sze2006].

Constants come from the Ioffe archive and Vurgaftman's III–V review [@ioffe_nsm; @vurgaftman2001]. Silicon's n<sub>i</sub> comes out at 8.6 × 10⁹ cm⁻³ at 300 K, against the accepted 9.65 × 10⁹ [@altermatt2003].

![Intrinsic density vs temperature](../figures/intrinsic_density.png)

**Try:** heat lightly doped silicon to 650 K. The crystal produces more carriers than the doping, so it no longer behaves as a doped device. GaN, SiC and diamond do not reach that point in this temperature range.

**Leaves out:**
* Incomplete ionization (see Chapter 13 for diamond).
* Degeneracy and band-gap narrowing. The page warns when E<sub>F</sub> comes within 3kT of a band edge.

## Part II · Junctions and gates

### 04 · The pn junction

The lab uses the depletion approximation. It gives:

* the built-in voltage V<sub>bi</sub> = (kT/q) ln(N<sub>A</sub>N<sub>D</sub>/n<sub>i</sub>²);
* a depletion width W that grows as √(V<sub>bi</sub> − V);
* the triangular field and the parabolic potential that bends the bands.

The current–voltage curve is Shockley's long-base diode [@shockley1949], with mobilities from Caughey and Thomas [@caughey1967].

![pn junction](../figures/pn_junction.png)

**Try:** dope both sides to 10¹⁹ cm⁻³. The depletion region shrinks to about 20 nm and the field passes 10⁶ V/cm. That is Esaki's tunnel-diode regime [@esaki1958]. For a fuller simulator, see nanoHUB's PN Junction Lab [@nanohub_pntoy].

### 05 · The MOS capacitor

This lab uses the exact surface-charge function F(ψ<sub>s</sub>), not the depletion approximation. The gate voltage is V<sub>G</sub> = V<sub>FB</sub> + ψ<sub>s</sub> − Q<sub>s</sub>/C<sub>ox</sub> [@sze2006; @taur2013].

* The band profile comes from integrating dψ/dx into the substrate.
* The low-frequency capacitance is C<sub>ox</sub> in series with dQ<sub>s</sub>/dψ<sub>s</sub>.
* The high-frequency curve drops the minority-carrier term and pins the depletion edge at W<sub>max</sub>.

At ψ<sub>s</sub> = 2φ<sub>B</sub> the exact solution reproduces the textbook threshold formula, and a test checks this.

![MOS C–V](../figures/mos_cv.png)

**Try:** sweep the gate from −2.5 V to +2.5 V and watch the surface go through accumulation, depletion and inversion. Then switch to high frequency.

### 06 · From capacitor to transistor: the charge-sheet MOSFET

This lab adds a source and drain to Lab 05. The inversion layer is treated as a sheet with no thickness, but its charge comes from the exact surface potential. That potential is solved at the source end (quasi-Fermi level V = 0) and at the drain end (V = V<sub>DS</sub>) from the Pao–Sah relation [@paosah1966]. Integrating drift plus diffusion along the channel gives Brews' closed form [@brews1978]. It covers subthreshold, the linear region and saturation with no fitted parameters.

Tests check the following:

* **Linear region:** the transconductance matches µC<sub>ox</sub>(W/L)V<sub>DS</sub> to within 15%.
* **Saturation:** √I<sub>DSAT</sub> is a straight line in V<sub>GS</sub>, with slope √(µC<sub>ox</sub>W/2nL).
* **Subthreshold:** the swing is n·60 mV/dec.

![Charge-sheet MOSFET](../figures/charge_sheet_mosfet.png)

**Try:** raise V<sub>DS</sub> at a fixed gate voltage and watch the animated channel thin toward the drain until it pinches off.

**Leaves out:** short-channel effects (Lab 09), velocity saturation (Lab 10), series resistance and quantum confinement (Lab 08).

## Part III · Quantum effects

### 07 · Quantum tunnelling

The Schrödinger equation is solved exactly for a stack of flat slabs with the transfer-matrix method [@ando1987]. For a single rectangular barrier the result matches the closed form to machine precision [@griffiths2018].

With a double barrier, the lab shows resonant tunnelling, first proposed by Tsu and Esaki and then measured [@tsu1973; @chang1974]. Tilting the barrier by the oxide voltage gives the gate-leakage curve:

* Leakage falls about 10× for every 2 Å of added SiO₂.
* HfO₂ at the same equivalent oxide thickness leaks orders of magnitude less, even with a 0.5 nm SiO₂ interlayer [@lo1997; @robertson2006].

![Gate-oxide tunnelling](../figures/oxide_leakage.png)

**Numerics note:** multiplying the interface matrices directly loses precision when T falls below about 10⁻¹⁶. The code instead computes the transmission amplitude as det(M)/M₂₂ and takes each interface determinant from its closed form. This keeps T accurate to about 10⁻³⁰.

### 08 · Quantum wells: nanosheets and the GaN 2DEG

The one-dimensional Schrödinger equation is solved by finite differences. The effective mass changes across material boundaries, handled with the BenDaniel–Duke condition [@bendaniel1966].

**Nanosheet mode:** a silicon film between SiO₂ walls. The two valleys with the heavy mass (0.916 m₀) across the film form the lowest level. That level rises roughly as 1/t², reaching about 15 meV at the 5 nm of production nanosheets. The result matches the transcendental finite-well solution to within 1%.

**GaN mode:** a self-consistent Schrödinger–Poisson solution of an AlGaN/GaN heterostructure [@tan1990].

* **Inputs:**
  * the polarization sheet charge σ(x) [@ambacher1999; @ambacher2000];
  * the surface barrier;
  * the conduction-band offset.
* **Method:** each outer step solves Schrödinger, then a nonlinear Poisson equation by Newton's method in which the electron density responds to potential changes. This is the predictor–corrector method of Trellakis and colleagues [@trellakis1997]. It converges in 10–40 steps.
* **Result:** a 20 nm Al₀.₂₅Ga₀.₇₅N barrier gives 1.0 × 10¹³ cm⁻². That matches measured values, sitting a little below the analytic formula, which ignores where the electrons actually sit [@mishra2002].

![GaN 2DEG](../figures/gan_2deg.png)

**Try:** drive the gate negative until the ground subband crosses E<sub>F</sub> and the 2DEG empties. That is how a depletion-mode HEMT switches off.

## Part IV · Scaling and transport

### 09 · Short-channel electrostatics

This lab solves ∇·(ε∇ψ) = qN<sub>A</sub> on the cross-section of a thin-body MOSFET by red-black successive over-relaxation [@selberherr1984]. The gates, source and drain are fixed-potential boundaries. The grid is 81 × up to 110 points and is re-solved whenever you move a slider, starting from the previous solution to save time.

The electron barrier is read along the leakiest horizontal path. Drain-induced barrier lowering (DIBL) is how much that barrier drops per volt of drain bias.

The natural length λ = √(ε<sub>Si</sub>t<sub>Si</sub>t<sub>ox</sub>/(Nε<sub>ox</sub>)) explains the trends [@yan1992; @frank1998]. A second gate (N = 2), a thinner body and a thinner oxide all shorten λ, so the gate can be shorter.

![DIBL from the 2D solver](../figures/dibl_2d.png)

**Try:** shrink L from 40 nm to 12 nm with one gate, then add a second gate. This is the argument for the FinFET in Chapter 6 and for gate-all-around in Chapter 8.

**Leaves out:** mobile charge (so it is valid only in subthreshold), quantum confinement and source/drain doping gradients.

### 10 · Hot-electron transport

This is an ensemble Monte Carlo simulation of electrons in one isotropic, non-parabolic valley (m* = 0.26 m₀, α = 0.5 eV⁻¹). Electrons scatter off acoustic phonons and absorb or emit 63 meV optical phonons [@jacoboni1983; @lundstrom2000]. Real silicon has six valleys. Here two coupling constants stand in for that, calibrated to silicon's measured low-field mobility (about 1400 cm²/V·s) and saturation velocity (about 10⁷ cm/s) [@canali1975].

The browser runs 500 electrons live and flashes each scattering event. The lab reproduces velocity saturation and the brief velocity overshoot after a sudden rise in field.

![Velocity saturation](../figures/velocity_saturation.png)

### 11 · Self-heating

This lab solves the 2D steady-state heat equation under a 1 µm hot spot in a 2 µm GaN layer on a 100 µm substrate.

* **Grid:** finite volumes on a grid graded from an eighth of the heater width near the hot spot to tens of micrometres far away.
* **Solver:** a direct block-tridiagonal solve, so there are no convergence issues with thin, poorly conducting layers.
* **Boundary resistance:** the thermal boundary resistance between GaN and a foreign substrate is modelled as a 20 nm layer with k = t / TBR.
* **Check:** a test confirms the exact one-dimensional limit, boundary resistance included.

At 5 W/mm the peak rise is about 180 K on sapphire, 75 K on silicon, 46 K on SiC and 36 K on diamond. A boundary resistance of 25 m²K/GW puts GaN-on-diamond back to about 49 K. That is why interface engineering dominates GaN-on-diamond research [@felbinger2007; @gan_diamond_tbr; @gan_diamond_tbr2021].

![GaN self-heating](../figures/gan_self_heating.png)

**Leaves out:** the fall of thermal conductivity with temperature, so real hot devices run hotter; 3D spreading along the gate width; packaging.

## Part V · Manufacturing

### 12 · Lithography optics

A line/space mask of pitch p diffracts light into orders at spatial frequencies n/p. The projection lens passes only those inside NA/λ. The lab builds the aerial image by Abbe's method, summing coherent images over the points of the source, which is equivalent to Hopkins' partially coherent theory [@hopkins1953; @mack2007]. It covers:

* conventional and dipole sources;
* defocus;
* a resist threshold, so you can see what actually prints.

Tests check two things:

* With coherent light, nothing images below p = λ/NA.
* With tilted (dipole) light, the limit extends to p = λ/2NA (k₁ = 0.25) and no further.

![Lithography aerial images](../figures/litho_aerial.png)

**Try:** switch from ArF immersion to EUV at 28 nm pitch, then to High-NA EUV at 16 nm pitch [@levinson2019; @bakshi2018; @asml_euv].

---

## Running the models yourself

```bash
python3 -c "import sys; sys.path.insert(0, 'sim'); \
from transistor_sim.physics import poisson2d, qwell; \
print(poisson2d.dibl(20), poisson2d.dibl(20, double_gate=True), qwell.hemt_sp(0.25, 20)['ns'])"
node tests/js_parity.mjs          # browser physics vs Python reference
make figures && make test         # regenerate every figure, run every test
```

Further study: Lundstrom's *Fundamentals of Nanotransistors* [@lundstrom2017] and nanoHUB's MOSCap tool [@nanohub_moscap].
