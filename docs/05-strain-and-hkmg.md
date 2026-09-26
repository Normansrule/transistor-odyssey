# 5 · Strained silicon and high-k metal gates (2003–2011)

When geometric scaling alone stopped delivering, the industry changed **materials** inside the same planar shape.

## Strain (90 nm, 2003)

Stretching or compressing the silicon lattice changes its band structure and carrier effective mass. Intel's 90 nm process used embedded SiGe in the pMOS source/drain to compress the channel (faster holes) and a tensile silicon-nitride cap over nMOS (faster electrons) [@thompson2004].

![Strained pMOS](../figures/cross_sections/planar_strain.svg)

## High-k metal gate (45 nm, 2007)

By 65 nm the SiO₂-based gate dielectric was about 1.2 nm thick, roughly five atomic layers, and direct tunnelling current was enormous. Gate capacitance depends on κ/t, so a dielectric with higher permittivity can be physically thicker for the same capacitance. The *equivalent oxide thickness* is

$$\text{EOT} = t_{high\text{-}k}\,\frac{\kappa_{SiO_2}}{\kappa_{high\text{-}k}} = t_{high\text{-}k}\,\frac{3.9}{\kappa}$$

HfO₂ (κ ≈ 20–25) at 2–3 nm gives an EOT near 0.5 nm [@wilk2001; @robertson2006]. Poly-Si gates deplete and pin their work function on HfO₂, so they were replaced with metal, formed last in a replacement-metal-gate flow. Intel shipped HKMG in 2007's 45 nm Penryn [@mistry2007].

![HKMG](../figures/cross_sections/planar_hkmg.svg)

The 45 nm device lab preset lands near Mistry et al.'s ~1.36 mA/µm on-current at ~100 nA/µm leakage (a test in `tests/test_physics.py` checks this range). Its subthreshold swing (~86 mV/dec) and DIBL (120 mV/V) show why planar devices ran out of road: the drain reaches under the gate.

![Transfer curves](../figures/transfer_log.png)
