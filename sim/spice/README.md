# SPICE netlists

Run with [ngspice](https://ngspice.sourceforge.io/) (`sudo apt install ngspice`), or `make spice` from the repo root.

| File | What it shows |
|---|---|
| `inverter_1p5um.cir` | Level-1 CMOS inverter at 1.5 µm / 5 V; DC transfer curve and switching threshold |
| `ring_oscillator_1p5um.cir` | 5-stage ring oscillator; prints oscillation frequency in MHz |
| `inverter_180nm.cir` | Level-3 inverter with velocity saturation at 180 nm / 1.8 V; VTC and propagation delays |
| `gan_hemt_dc.cir` | Behavioural depletion-mode GaN HEMT output family (mirrors `hemt.py`) |

Parameters are educational. For real 130/180 nm work, use the BSIM4 models in the SKY130 or GF180MCU open PDKs.
