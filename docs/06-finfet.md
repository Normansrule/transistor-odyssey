# 6 · FinFET: the transistor stands up (2011–2022)

## Why go 3D

A planar gate controls the channel from one side. The drain field fringes underneath, lowering the barrier (drain-induced barrier lowering, DIBL) and degrading subthreshold swing. A channel that is **thin** and gated from **several sides** keeps the gate in charge [@ferain2011; @colinge2008].

## From DELTA to tri-gate

* 1989 — Hitachi's DELTA: a vertical ultrathin SOI channel gated on both sides [@hisamoto1989].
* 2000 — Berkeley (Hisamoto, Hu, King and colleagues) name and scale the FinFET to 20 nm [@hisamoto2000].
* 2011–12 — Intel ships 22 nm tri-gate transistors in Ivy Bridge, the first FinFETs in high-volume manufacturing [@auth2012].

![FinFET](../figures/cross_sections/finfet.svg)

Fins are ~8 nm wide and ~40 nm tall; the effective width is 2·H_fin + W_fin per fin, so tall fins pack more current into the footprint. Width is quantized (you can only add whole fins), which constrains designers.

## FinFET nodes

| Node | Year | CPP (nm) | MMP (nm) | Notes |
|---|---|---|---|---|
| Intel 22 nm | 2011 | 90 | 80 | first FinFET [@auth2012] |
| Intel 14 nm | 2014 | 70 | 52 | 37.5 MTr/mm² [@natarajan2014] |
| Intel 10 nm (Intel 7) | 2018 | 54 | 36 | SAQP, cobalt local interconnect [@auth2017] |
| TSMC N7 | 2018 | 57 | 40 | 91.2 MTr/mm² |
| TSMC N5 | 2020 | 51 | 28 | full EUV, SiGe pFET fins [@yeap2019] |

(CPP = contacted gate pitch, MMP = minimum metal pitch; see [`data/nodes.csv`](../data/nodes.csv).)

![Node name vs pitch](../figures/node_vs_pitch.png)

Notice that pitches shrink by ~10% per node after 2014 while node names keep dropping by ~30%. From here on the node label is a marketing generation, a point Chapter 8 makes concrete.

<p align="center">
<img src="https://commons.wikimedia.org/wiki/Special:FilePath/Zen2_Matisse_Ryzen_7nm_Core_Die_shot.jpg?width=700" width="440" alt="AMD Zen 2 7 nm core die shot">
<img src="../figures/layout/inverter_5_nm_FinFET.svg" width="240" alt="Gridded FinFET inverter layout">
<br><sub>Left: AMD Zen 2 core on TSMC N7, Fritzchens Fritz, CC0. Right: a gridded FinFET inverter at 51 nm CPP from <code>layout.py</code>.</sub></p>
