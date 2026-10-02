# 7 · Lithography: printing the pattern

Everything above is printed with light. The Rayleigh criterion sets the smallest half-pitch a single exposure can resolve [@levinson2019]:

$$HP = k_1\,\frac{\lambda}{NA}$$

with λ the wavelength, NA the numerical aperture of the projection lens, and k₁ a process factor whose theoretical floor for dense lines is 0.25.

![Lithography wavelength by era](../figures/lithography.png)

| Era | Source | λ (nm) | Max NA | Typical HP (k₁≈0.3) |
|---|---|---|---|---|
| 1970s | Hg g-line | 436 | ~0.45 | ~290 nm |
| late 1980s | Hg i-line | 365 | ~0.65 | ~170 nm |
| mid 1990s | KrF excimer | 248 | ~0.85 | ~90 nm |
| 2000s | ArF excimer | 193 | 0.93 | ~62 nm |
| 2007– | ArF immersion (water) | 193 | 1.35 | ~43 nm |
| 2019– | EUV (Sn plasma) | 13.5 | 0.33 | ~12 nm |
| 2025– | High-NA EUV | 13.5 | 0.55 | ~7 nm |

Immersion lithography put water between lens and wafer (n = 1.44) to raise NA above 1. Below ~40 nm pitch, fabs split one layer into two, three or four exposures (LELE, SADP, SAQP) — Intel's 10 nm used self-aligned quad patterning [@auth2017]. EUV's 13.5 nm light, produced by laser-heated tin droplets and reflected by multilayer mirrors, entered production with TSMC N7+ and Samsung 7LPP in 2019 [@bakshi2018; @asml_euv]. Intel reports using ASML's EXE High-NA EUV on part of Panther Lake production [@intel_8k_2026].

The website's lithography tool computes HP live and draws the resulting line/space pattern blurred by the optical point-spread.
