# Changelog

All notable changes to Transistor Odyssey. Versions follow the `version` field in [CITATION.cff](CITATION.cff); `scripts/setup_ubuntu.sh` uses the newest entry as the commit message.

## v1.8 — Circuit Lab: from transistor to computer

- New page, [`circuits.html`](site/circuits.html), with a powers-of-ten zoom from a 300 mm wafer to a silicon–silicon bond (ten procedural scenes, real dimensions for a 2 nm-class process).
- **Gate builder:** ten static CMOS gates built from series/parallel expressions, a switch-level simulator (after Bryant 1984), truth tables, and logical effort derived from the netlists.
- **8-bit adder:** event-driven ripple-carry simulation with transport delays and glitch counting, compared with a Kogge–Stone parallel-prefix adder.
- **Six-transistor SRAM:** butterfly curves, Seevinck static noise margins for hold and read, read disturb, threshold mismatch, bitline timing, and published bitcell areas from 90 nm to N2.
- **Floating-gate flash:** Fowler–Nordheim programming, incremental step pulse programming (ISPP), SLC to QLC threshold distributions, a tunnel-oxide band diagram, and 3D NAND layer counts to 321.
- Python models `logic.py`, `sram.py` and `flash.py` with JavaScript twins; 25 new tests (157 in total) and new parity checks.
- Three new charts (33 in total), five new animations (16 in total), Chapter 21, 20 new references (282 in total) and `data/memory.json`.
- The release zip ships without `.git`; the setup script now rebuilds on top of GitHub's history, so the history stays linear.

## v1.7 — Physics Lab Part VI: from transistor to circuit
- CMOS inverter, ballistic MOSFET and interconnect labs (15 labs in total), with Python twins and tests.

## v1.6 — Junction solver, device comparison, quiz and a visual README
- 1D Poisson heterojunction solver, side-by-side device comparison, band-diagram quiz, and 11 README animations.

## v1.5 — Device Atlas
- 19 animated transistors with live band diagrams along the current path and through the gate.

## v1.4 — Physics Lab: twelve labs in five parts

## v1.3 — Physics Lab: seven interactive semiconductor simulations

## v1.2 — Fab stepper (14-step GAA process flow) and packaging/3D chapter

## v1.1 — Diamond deep dive, niche atlas, steep-slope devices and Ubuntu setup script

## v1.0 — History, simulations and interactive site
