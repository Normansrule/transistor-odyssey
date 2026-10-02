# 12 · How the simulations in this repository work

Everything under `figures/` and the website's interactive parts is generated from code and data in this repository.

## Compact MOSFET model — `sim/transistor_sim/mosfet.py`

One smooth equation set, continuous from subthreshold to saturation:

1. **Inversion charge** — V_GT = nφ_t·ln(1 + exp((V_GS − V_T)/(nφ_t))), with φ_t = kT/q. Below threshold this gives a subthreshold swing of n·59.5 mV/decade; above, V_GT → V_GS − V_T (cf. EKV [@enz1995] and the virtual-source model [@khakifirooz2009]).
2. **DIBL** — V_T = V_T0 − η·V_DS.
3. **Mobility degradation** — µ_eff = µ₀/(1 + θ·V_GT).
4. **Velocity saturation** — E_sat = 2v_sat/µ_eff; V_DSAT = E_sat·L·V_GT/(E_sat·L + V_GT) [@taur2013; @sakurai1990].
5. **Smooth V_DS → V_DSAT** transition, channel-length modulation λ, inversion-layer offset added to EOT, and first-order source-resistance degeneration.

Eight presets span 1971–2026. They are **educational approximations**, lightly tuned to published anchors:

| Check (tests/test_physics.py) | Published anchor |
|---|---|
| Subthreshold swing ≥ 59.5 mV/dec for every preset | Boltzmann limit at 300 K |
| FinFET SS < planar; GAA SS < FinFET | multigate electrostatics [@ferain2011] |
| 45 nm HKMG: 1.0–1.6 mA/µm on, 20–300 nA/µm off | Mistry et al. 2007 [@mistry2007] |
| MoS₂ preset peak gₘ ≈ 0.45 mS/µm (±15%) | NYCU/TSMC 2026 [@nycu2026] |

For real design work use BSIM4 / BSIM-CMG [@bsim] with an open PDK: SKY130 [@sky130], GF180MCU [@gf180] or IHP SG13G2 [@ihp_sg13g2].

The website runs a JavaScript twin (`site/js/model.js`) so the Python and the browser draw identical curves.

## GaN HEMT — `hemt.py`

Ambacher's polarization model with Vegard interpolation of lattice, piezoelectric and elastic constants [@ambacher1999; @ambacher2000]; a charge-control I–V on top.

## Materials — `materials.py`

Baliga and Johnson figures of merit and ideal drift-region on-resistance R_on = 4V_B²/(ε·µ·E_c³) [@baliga1982; @johnson1965].

## Cross-sections — `crosssection.py`

Twenty-one labelled SVGs, one per architecture, sharing a single material palette with the 3D explorer. Labels are placed in a column with leader lines so they never overlap the device.

## Layouts — `layout.py`

A CMOS inverter drawn with Mead–Conway λ rules [@mead1980] at three micron-era nodes and as gridded FinFET/GAA cells using CPP/MMP from `data/nodes.csv`. GDS output opens in KLayout [@klayout] or Magic [@magic]; the same geometry is rendered to SVG.

## SPICE — `sim/spice/*.cir`

Level-1 and Level-3 netlists for ngspice [@ngspice; @nagel1973]: inverter transfer curves at 1.5 µm and 180 nm, a 5-stage ring oscillator and a behavioural GaN HEMT. CI installs ngspice and runs them.

## Going further

* **TCAD**: SUPREM [@suprem] and PISCES [@pisces] started process and device simulation at Stanford; DEVSIM is an open successor [@devsim]; Sentaurus is the industry tool [@sentaurus]. nanoHUB hosts free web simulators for nanowires and 2D FETs [@nanohub].
* **Transistor-level chips**: Visual6502 simulates every transistor of the 6502 from its die photo [@visual6502].
* **Tape out**: Tiny Tapeout puts a small design on real SKY130 silicon [@tinytapeout].
* **Ballistic limits**: Natori and Lundstrom explain why nanoscale transistors behave as injection-limited devices [@natori1994; @lundstrom2017].

## Website internals

* Hero: WebGL2 implementation of Stam's stable-fluids solver [@stam1999] (inspired by [@inspo_fluid]).
* Timeline: GSAP ScrollTrigger horizontal pin [@inspo_gsap].
* 3D explorer: three.js [@threejs] with OrbitControls; carrier flow rate comes from the compact model.
* Charts: hand-written SVG with hover tooltips, legends and a data-table view.
* Design references: [@inspo_reactbits; @inspo_magicui; @inspo_animateui; @inspo_motionprimitives; @inspo_folio; @inspo_remotion; @inspo_llmviz; @inspo_transformer; @inspo_godseye; @inspo_worldmonitor].
