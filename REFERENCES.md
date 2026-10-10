# References

316 sources, grouped by topic. Each entry carries its citation key in `code`; the key is what `data/*.json`, `docs/*.md` (as `[@key]`) and the website use. Generated from `data/references.json` by `scripts/build_data.py`; edit the JSON, not this file.

**Contents:** [History](#history) · [Simulation](#simulation) · [Scaling](#scaling) · [Design](#design) · [Device physics](#device-physics) · [Process](#process) · [Lithography](#lithography) · [2020s nodes](#2020s-nodes) · [2D & 1D channels](#2d-1d-channels) · [Compound semiconductors](#compound-semiconductors) · [Diamond](#diamond) · [Beyond CMOS](#beyond-cmos) · [Chip data](#chip-data) · [Image sources](#image-sources) · [Design inspiration](#design-inspiration) · [Niche devices](#niche-devices) · [Steep-slope & exotic](#steep-slope-exotic) · [Packaging](#packaging) · [Physics lab](#physics-lab) · [Circuit lab](#circuit-lab) · [Process lab](#process-lab) · [Analog & RF lab](#analog-rf-lab)

## History

1. `bardeen1948` — J. Bardeen, W. H. Brattain, "The Transistor, A Semi-Conductor Triode," Phys. Rev. 74, 230 (1948). [doi:10.1103/PhysRev.74.230](https://doi.org/10.1103/PhysRev.74.230)
2. `shockley1949` — W. Shockley, "The Theory of p-n Junctions in Semiconductors and p-n Junction Transistors," Bell Syst. Tech. J. 28, 435 (1949). [doi:10.1002/j.1538-7305.1949.tb03645.x](https://doi.org/10.1002/j.1538-7305.1949.tb03645.x)
3. `shockley1951` — W. Shockley, M. Sparks, G. K. Teal, "p-n Junction Transistors," Phys. Rev. 83, 151 (1951). [doi:10.1103/PhysRev.83.151](https://doi.org/10.1103/PhysRev.83.151)
4. `nobel1956` — The Nobel Prize in Physics 1956: Shockley, Bardeen, Brattain "for their researches on semiconductors and their discovery of the transistor effect." [link](https://www.nobelprize.org/prizes/physics/1956/summary/)
5. `riordan1997` — M. Riordan, L. Hoddeson, Crystal Fire: The Birth of the Information Age, W. W. Norton (1997). ISBN 978-0-393-04124-8.
6. `lojek2007` — B. Lojek, History of Semiconductor Engineering, Springer (2007). [doi:10.1007/978-3-540-34258-8](https://doi.org/10.1007/978-3-540-34258-8)
7. `frosch1957` — C. J. Frosch, L. Derick, "Surface Protection and Selective Masking during Diffusion in Silicon," J. Electrochem. Soc. 104, 547 (1957). [doi:10.1149/1.2428650](https://doi.org/10.1149/1.2428650)
8. `atalla1959` — M. M. Atalla, E. Tannenbaum, E. J. Scheibner, "Stabilization of Silicon Surfaces by Thermally Grown Oxides," Bell Syst. Tech. J. 38, 749 (1959). [doi:10.1002/j.1538-7305.1959.tb03907.x](https://doi.org/10.1002/j.1538-7305.1959.tb03907.x)
9. `hoerni1962` — J. A. Hoerni, "Method of Manufacturing Semiconductor Devices," U.S. Patent 3,025,589 (1962; filed 1959). [link](https://patents.google.com/patent/US3025589A)
10. `kilby_patent` — J. S. Kilby, "Miniaturized Electronic Circuits," U.S. Patent 3,138,743 (1964; filed 1959). [link](https://patents.google.com/patent/US3138743A)
11. `noyce_patent` — R. N. Noyce, "Semiconductor Device-and-Lead Structure," U.S. Patent 2,981,877 (1961; filed 1959). [link](https://patents.google.com/patent/US2981877A)
12. `kilby1976` — J. S. Kilby, "Invention of the Integrated Circuit," IEEE Trans. Electron Devices 23(7), 648 (1976). [doi:10.1109/T-ED.1976.18467](https://doi.org/10.1109/T-ED.1976.18467)
13. `kilby_nobel` — J. S. Kilby, Nobel Lecture "Turning Potential into Realities: The Invention of the Integrated Circuit" (2000). [link](https://www.nobelprize.org/prizes/physics/2000/kilby/lecture/)
14. `ethw_ic` — IEEE Milestone: First Semiconductor Integrated Circuit (IC), 1958. Engineering and Technology History Wiki. [link](https://ethw.org/Milestones:First_Semiconductor_Integrated_Circuit_(IC),_1958)
15. `lilienfeld_patent` — J. E. Lilienfeld, "Method and Apparatus for Controlling Electric Currents," U.S. Patent 1,745,175 (1930; filed 1926). [link](https://patents.google.com/patent/US1745175A)
16. `kahng1960` — D. Kahng, M. M. Atalla, "Silicon-Silicon Dioxide Field Induced Surface Devices," IRE-AIEE Solid-State Device Research Conference, Pittsburgh (1960). Retrospective: Computer History Museum, "1960: Metal Oxide Semiconductor (MOS) Transistor Demonstrated." [link](https://www.computerhistory.org/siliconengine/metal-oxide-semiconductor-mos-transistor-demonstrated/)
17. `sah1988` — C.-T. Sah, "Evolution of the MOS Transistor—From Conception to VLSI," Proc. IEEE 76(10), 1280 (1988). [doi:10.1109/5.16328](https://doi.org/10.1109/5.16328)
18. `wanlass1963` — F. M. Wanlass, C. T. Sah, "Nanowatt Logic Using Field-Effect Metal-Oxide Semiconductor Triodes," ISSCC Dig. Tech. Papers, 32 (1963). [doi:10.1109/ISSCC.1963.1157450](https://doi.org/10.1109/ISSCC.1963.1157450)
19. `faggin1970` — F. Faggin, T. Klein, "Silicon Gate Technology," Solid-State Electronics 13, 1125 (1970). [doi:10.1016/0038-1101(70)90124-3](https://doi.org/10.1016/0038-1101(70)90124-3)
20. `faggin1996` — F. Faggin, M. E. Hoff, S. Mazor, M. Shima, "The History of the 4004," IEEE Micro 16(6), 10 (1996). [doi:10.1109/40.546561](https://doi.org/10.1109/40.546561)
21. `intel4004story` — Intel, "The Story of the Intel 4004." [link](https://www.intel.com/content/www/us/en/history/museum-story-of-intel-4004.html)
22. `wiki4004` — Wikipedia, "Intel 4004" (10 µm silicon-gate pMOS, 2,300 transistors, 12 mm² die). [link](https://en.wikipedia.org/wiki/Intel_4004)
23. `wiki486` — Wikipedia, "i486" (first x86 with more than one million transistors). [link](https://en.wikipedia.org/wiki/I486)
24. `chm_siliconengine` — Computer History Museum, "The Silicon Engine: A Timeline of Semiconductors in Computers." [link](https://www.computerhistory.org/siliconengine/)
25. `shirriff` — K. Shirriff, Righto.com — die-level reverse engineering of the 4004, 8008, 8086, 386 and others. [link](https://www.righto.com/)
26. `shirriff2016` — K. Shirriff, "The Surprising Story of the First Microprocessors," IEEE Spectrum (2016). [link](https://spectrum.ieee.org/the-surprising-story-of-the-first-microprocessors)

## Simulation

27. `visual6502` — G. James, B. Silverman, B. Silverman, "Visualizing a Classic CPU in Action: The 6502," ACM SIGGRAPH 2010 Talks; transistor-level simulator at visual6502.org. [link](http://www.visual6502.org/)
28. `nagel1973` — L. W. Nagel, D. O. Pederson, "SPICE (Simulation Program with Integrated Circuit Emphasis)," UC Berkeley ERL Memo M382 (1973). [link](https://www2.eecs.berkeley.edu/Pubs/TechRpts/1973/22871.html)
29. `nagel1975` — IEEE Milestone: SPICE (Simulation Program with Integrated Circuit Emphasis), 1969-1970. Engineering and Technology History Wiki. [link](https://ethw.org/Milestones:SPICE_(Simulation_Program_with_Integrated_Circuit_Emphasis),_1969-1970)
30. `ngspice` — ngspice — open-source mixed-signal circuit simulator. [link](https://ngspice.sourceforge.io/)
31. `klayout` — KLayout — layout viewer and editor (GDSII/OASIS). [link](https://www.klayout.de/)
32. `magic` — Magic VLSI Layout Tool (J. Ousterhout et al., UC Berkeley, 1980s; maintained by R. T. Edwards). [link](http://opencircuitdesign.com/magic/)
33. `openroad` — The OpenROAD Project — open RTL-to-GDS flow. [link](https://theopenroadproject.org/)
34. `gdstk` — L. H. Gabrielli, gdstk — Python/C++ library for GDSII and OASIS. [link](https://github.com/heitzmann/gdstk)
35. `sky130` — SkyWater / Google, SKY130 open-source 130 nm PDK. [link](https://github.com/google/skywater-pdk)
36. `gf180` — GlobalFoundries / Google, GF180MCU open-source 180 nm PDK. [link](https://github.com/google/gf180mcu-pdk)
37. `ihp_sg13g2` — IHP, SG13G2 open-source 130 nm SiGe BiCMOS PDK. [link](https://github.com/IHP-GmbH/IHP-Open-PDK)
38. `tinytapeout` — Tiny Tapeout — shared-shuttle ASIC tapeouts for education. [link](https://tinytapeout.com/)
39. `devsim` — DEVSIM — open-source TCAD semiconductor device simulator. [link](https://devsim.org/)
40. `suprem` — D. A. Antoniadis, S. E. Hansen, R. W. Dutton, "SUPREM II — A Program for IC Process Modeling and Simulation," Stanford Electronics Laboratories Tech. Rep. 5019-2 (1978).
41. `pisces` — M. R. Pinto, C. S. Rafferty, R. W. Dutton, "PISCES-II: Poisson and Continuity Equation Solver," Stanford Electronics Laboratories (1984).
42. `nanohub` — nanoHUB.org — MOSFET, FinFET, nanowire and 2D-FET simulation tools (Purdue / NCN). [link](https://nanohub.org/)
43. `sentaurus` — Synopsys Sentaurus TCAD (industry process and device simulation). [link](https://www.synopsys.com/manufacturing/tcad.html)
44. `stam1999` — J. Stam, "Stable Fluids," Proc. SIGGRAPH '99, 121 (1999) — algorithm behind the site's WebGL fluid hero. [doi:10.1145/311535.311548](https://doi.org/10.1145/311535.311548)

## Scaling

45. `moore1965` — G. E. Moore, "Cramming More Components onto Integrated Circuits," Electronics 38(8) (1965); reprinted Proc. IEEE 86(1), 82 (1998). [doi:10.1109/JPROC.1998.658762](https://doi.org/10.1109/JPROC.1998.658762)
46. `moore1975` — G. E. Moore, "Progress in Digital Integrated Electronics," IEDM Tech. Dig., 11 (1975).
47. `dennard1974` — R. H. Dennard et al., "Design of Ion-Implanted MOSFET's with Very Small Physical Dimensions," IEEE J. Solid-State Circuits 9(5), 256 (1974). [doi:10.1109/JSSC.1974.1050511](https://doi.org/10.1109/JSSC.1974.1050511)
48. `bohr2007` — M. Bohr, "A 30 Year Retrospective on Dennard's MOSFET Scaling Paper," IEEE SSCS Newsletter 12(1), 11 (2007). [doi:10.1109/N-SSC.2007.4785534](https://doi.org/10.1109/N-SSC.2007.4785534)
49. `frank2001` — D. J. Frank et al., "Device Scaling Limits of Si MOSFETs and Their Application Dependencies," Proc. IEEE 89(3), 259 (2001). [doi:10.1109/5.915374](https://doi.org/10.1109/5.915374)
50. `ferain2011` — I. Ferain, C. A. Colinge, J.-P. Colinge, "Multigate Transistors as the Future of Classical Metal–Oxide–Semiconductor Field-Effect Transistors," Nature 479, 310 (2011). [doi:10.1038/nature10676](https://doi.org/10.1038/nature10676)
51. `irds2023` — IEEE International Roadmap for Devices and Systems (IRDS), More Moore chapter. [link](https://irds.ieee.org/editions)
52. `imec_roadmap` — imec, "Smaller, Better, Faster: imec Presents Chip Scaling Roadmap." [link](https://www.imec-int.com/en/articles/smaller-better-faster-imec-presents-chip-scaling-roadmap)
53. `kisee2026` — Hardware Busters, "0.2nm Chips and 3D Transistors Within 15 Years" (on the Korean Institute of Semiconductor Engineers' Semiconductor Technology Roadmap 2026), Dec 2025. [link](https://hwbusters.com/news/0-2nm-chips-and-3d-transistors-within-15-years/)
54. `wiki1nm` — Wikipedia, "1 nm process" (contacted gate pitch vs node naming; 2D and sub-1 nm milestones). [link](https://en.wikipedia.org/wiki/1_nm_process)

## Design

55. `mead1980` — C. Mead, L. Conway, Introduction to VLSI Systems, Addison-Wesley (1980).
56. `weste2010` — N. H. E. Weste, D. M. Harris, CMOS VLSI Design: A Circuits and Systems Perspective, 4th ed., Addison-Wesley (2010).
57. `rabaey2003` — J. M. Rabaey, A. Chandrakasan, B. Nikolić, Digital Integrated Circuits: A Design Perspective, 2nd ed., Prentice Hall (2003).

## Device physics

58. `sze2006` — S. M. Sze, K. K. Ng, Physics of Semiconductor Devices, 3rd ed., Wiley (2006). [doi:10.1002/0470068329](https://doi.org/10.1002/0470068329)
59. `taur2013` — Y. Taur, T. H. Ning, Fundamentals of Modern VLSI Devices, 2nd ed., Cambridge University Press (2009/2013). [doi:10.1017/CBO9781139195065](https://doi.org/10.1017/CBO9781139195065)
60. `hu2010` — C. Hu, Modern Semiconductor Devices for Integrated Circuits, Pearson (2010); free chapters from the author. [link](https://www.chu.berkeley.edu/modern-semiconductor-devices/)
61. `pierret1996` — R. F. Pierret, Semiconductor Device Fundamentals, Addison-Wesley (1996).
62. `lundstrom2017` — M. Lundstrom, Fundamentals of Nanotransistors, World Scientific (2017); nanoHUB course. [doi:10.1142/9018](https://doi.org/10.1142/9018)
63. `natori1994` — K. Natori, "Ballistic Metal-Oxide-Semiconductor Field Effect Transistor," J. Appl. Phys. 76, 4879 (1994). [doi:10.1063/1.357263](https://doi.org/10.1063/1.357263)
64. `khakifirooz2009` — A. Khakifirooz, O. M. Nayfeh, D. Antoniadis, "A Simple Semiempirical Short-Channel MOSFET Current–Voltage Model Continuous Across All Regions of Operation and Employing Only Physical Parameters," IEEE Trans. Electron Devices 56(8), 1674 (2009). [doi:10.1109/TED.2009.2024022](https://doi.org/10.1109/TED.2009.2024022)
65. `enz1995` — C. C. Enz, F. Krummenacher, E. A. Vittoz, "An Analytical MOS Transistor Model Valid in All Regions of Operation," Analog Integr. Circuits Signal Process. 8, 83 (1995). [doi:10.1007/BF01239381](https://doi.org/10.1007/BF01239381)
66. `sakurai1990` — T. Sakurai, A. R. Newton, "Alpha-Power Law MOSFET Model and Its Applications to CMOS Inverter Delay and Other Formulas," IEEE J. Solid-State Circuits 25(2), 584 (1990). [doi:10.1109/4.52187](https://doi.org/10.1109/4.52187)
67. `bsim` — BSIM Group, UC Berkeley — BSIM4, BSIM-CMG (FinFET/GAA) and BSIM-IMG compact models. [link](https://bsim.berkeley.edu/)
68. `fuechsle2012` — M. Fuechsle et al., "A Single-Atom Transistor," Nature Nanotechnology 7, 242 (2012). [doi:10.1038/nnano.2012.21](https://doi.org/10.1038/nnano.2012.21)
69. `anderson1962` — R. L. Anderson, "Experiments on Ge-GaAs Heterojunctions," Solid-State Electron. 5, 341 (1962). [doi:10.1016/0038-1101(62)90115-6](https://doi.org/10.1016/0038-1101(62)90115-6)

## Process

70. `plummer2000` — J. D. Plummer, M. D. Deal, P. B. Griffin, Silicon VLSI Technology: Fundamentals, Practice and Modeling, Prentice Hall (2000).
71. `thompson2004` — S. E. Thompson et al., "A 90-nm Logic Technology Featuring Strained-Silicon," IEEE Trans. Electron Devices 51(11), 1790 (2004). [doi:10.1109/TED.2004.836648](https://doi.org/10.1109/TED.2004.836648)
72. `mistry2007` — K. Mistry et al., "A 45nm Logic Technology with High-k+Metal Gate Transistors, Strained Silicon, 9 Cu Interconnect Layers, 193nm Dry Patterning, and 100% Pb-free Packaging," IEDM (2007). [doi:10.1109/IEDM.2007.4418914](https://doi.org/10.1109/IEDM.2007.4418914)
73. `wilk2001` — G. D. Wilk, R. M. Wallace, J. M. Anthony, "High-κ Gate Dielectrics: Current Status and Materials Properties Considerations," J. Appl. Phys. 89, 5243 (2001). [doi:10.1063/1.1361065](https://doi.org/10.1063/1.1361065)
74. `robertson2006` — J. Robertson, "High Dielectric Constant Gate Oxides for Metal Oxide Si Transistors," Rep. Prog. Phys. 69, 327 (2006). [doi:10.1088/0034-4885/69/2/R02](https://doi.org/10.1088/0034-4885/69/2/R02)
75. `hisamoto1989` — D. Hisamoto et al., "A Fully Depleted Lean-Channel Transistor (DELTA)—A Novel Vertical Ultrathin SOI MOSFET," IEDM (1989). [doi:10.1109/IEDM.1989.74182](https://doi.org/10.1109/IEDM.1989.74182)
76. `hisamoto2000` — D. Hisamoto et al., "FinFET—A Self-Aligned Double-Gate MOSFET Scalable to 20 nm," IEEE Trans. Electron Devices 47(12), 2320 (2000). [doi:10.1109/16.887014](https://doi.org/10.1109/16.887014)
77. `colinge2008` — J.-P. Colinge (ed.), FinFETs and Other Multi-Gate Transistors, Springer (2008). [doi:10.1007/978-0-387-71752-4](https://doi.org/10.1007/978-0-387-71752-4)
78. `auth2012` — C. Auth et al., "A 22nm High Performance and Low-Power CMOS Technology Featuring Fully-Depleted Tri-Gate Transistors, Self-Aligned Contacts and High Density MIM Capacitors," VLSI Technology Symp. (2012). [doi:10.1109/VLSIT.2012.6242496](https://doi.org/10.1109/VLSIT.2012.6242496)
79. `natarajan2014` — S. Natarajan et al., "A 14nm Logic Technology Featuring 2nd-Generation FinFET, Air-Gapped Interconnects, Self-Aligned Double Patterning and a 0.0588 µm² SRAM Cell Size," IEDM (2014). [doi:10.1109/IEDM.2014.7047058](https://doi.org/10.1109/IEDM.2014.7047058)
80. `auth2017` — C. Auth et al., "A 10nm High Performance and Low-Power CMOS Technology Featuring 3rd Generation FinFET Transistors, Self-Aligned Quad Patterning, Contact over Active Gate and Cobalt Local Interconnects," IEDM (2017). [doi:10.1109/IEDM.2017.8268472](https://doi.org/10.1109/IEDM.2017.8268472)
81. `yeap2019` — G. Yeap et al., "5nm CMOS Production Technology Platform Featuring Full-Fledged EUV, and High Mobility Channel FinFETs with Densest 0.021µm² SRAM Cells for Mobile SoC and High Performance Computing Applications," IEDM (2019). [doi:10.1109/IEDM19573.2019.8993577](https://doi.org/10.1109/IEDM19573.2019.8993577)
82. `loubet2017` — N. Loubet et al., "Stacked Nanosheet Gate-All-Around Transistor to Enable Scaling Beyond FinFET," VLSI Technology Symp. (2017). [doi:10.23919/VLSIT.2017.7998183](https://doi.org/10.23919/VLSIT.2017.7998183)
83. `weckx2019` — P. Weckx et al., "Novel Forksheet Device Architecture as Ultimate Logic Scaling Device Towards 2nm," IEDM (2019). [doi:10.1109/IEDM19573.2019.8993635](https://doi.org/10.1109/IEDM19573.2019.8993635)
84. `ryckaert2018` — J. Ryckaert et al., "The Complementary FET (CFET) for CMOS Scaling Beyond N3," VLSI Technology Symp. (2018). [doi:10.1109/VLSIT.2018.8510618](https://doi.org/10.1109/VLSIT.2018.8510618)

## Lithography

85. `levinson2019` — H. J. Levinson, Principles of Lithography, 4th ed., SPIE Press (2019). [doi:10.1117/3.2525306](https://doi.org/10.1117/3.2525306)
86. `bakshi2018` — V. Bakshi (ed.), EUV Lithography, 2nd ed., SPIE Press (2018). [doi:10.1117/3.2305675](https://doi.org/10.1117/3.2305675)
87. `asml_euv` — ASML, EUV lithography systems (NXE and EXE High-NA platforms). [link](https://www.asml.com/en/products/euv-lithography-systems)

## 2020s nodes

88. `samsung2022` — Samsung Newsroom, "Samsung Begins Chip Production Using 3nm Process Technology With GAA Architecture" (30 June 2022). [link](https://news.samsung.com/global/samsung-begins-chip-production-using-3nm-process-technology-with-gaa-architecture)
89. `tsmc_n2` — TSMC, "2nm Technology" (N2: volume production started Q4 2025). [link](https://www.tsmc.com/english/dedicatedFoundry/technology/logic/l_2nm)
90. `tsmc_a16` — TSMC, "A16 Technology" (Super Power Rail backside power delivery). [link](https://www.tsmc.com/english/dedicatedFoundry/technology/logic/l_A16)
91. `intel_18a` — Intel Foundry, "Intel 18A" (RibbonFET gate-all-around + PowerVia backside power). [link](https://www.intel.com/content/www/us/en/foundry/process/18a.html)
92. `semiwiki_n2` — SemiWiki, "TSMC Quietly Begins Volume Production of 2nm-Class Chips" (31 Dec 2025). [link](https://semiwiki.com/forum/threads/tsmc-quietly-begins-volume-production-of-2nm-class-chips.24283/)
93. `semiwiki_a16` — SemiWiki / DIGITIMES, "TSMC Eyes A16 Mass Production in 4Q26 and Intel Refines 18A Roadmap with 18A-P" (July 2026). [link](https://semiwiki.com/forum/threads/tsmc-eyes-a16-mass-production-in-4q26-and-intel-refines-18a-roadmap-with-18a-p.25526/)
94. `toms_18a` — Tom's Hardware, "Intel's 18A Production Starts Before TSMC's Competing N2 Tech" (Oct 2025). [link](https://www.tomshardware.com/pc-components/cpus/intels-18a-production-starts-before-tsmcs-competing-n2-tech-heres-how-the-two-process-nodes-compare)
95. `intel_8k_2026` — Intel Corp., Form 8-K, Q2 2026 earnings release (18A-P risk production; Panther Lake subset using High-NA EUV). [link](https://www.sec.gov/Archives/edgar/data/0000050863/000005086326000155/q226earningsrelease.htm)
96. `panther_lake` — Wikipedia, "Panther Lake (microprocessor)" (Intel 18A, launched January 2026). [link](https://en.wikipedia.org/wiki/Panther_Lake_(microprocessor))
97. `rapidus` — Rapidus, "2nm Semiconductor Challenges" (2nm GAA transistor operation confirmed July 2025; mass production targeted 2027). [link](https://www.rapidus.inc/en/tech/te0006/)
98. `ibm2021` — IBM Newsroom, "IBM Unveils World's First 2 Nanometer Chip Technology" (6 May 2021). [link](https://newsroom.ibm.com/2021-05-06-IBM-Unveils-Worlds-First-2-Nanometer-Chip-Technology,-Opens-a-New-Frontier-for-Semiconductors)
99. `ibm2026` — IBM Newsroom, "IBM Debuts World's First Sub-1 Nanometer Chip Technology" (25 June 2026). [link](https://newsroom.ibm.com/2026-06-25-ibm-debuts-worlds-first-sub-1-nanometer-chip-technology)
100. `register2026` — The Register, "IBM Stacks Up a Sub-Nanometer Chip Future" (25 June 2026). [link](https://www.theregister.com/systems/2026/06/25/ibm-stacks-up-a-sub-nanometer-chip-future/5261555)
101. `futurum2026` — Futurum Group, "Look Past IBM's 0.7nm Label: Nanostack Architecture Is the Real Breakthrough" (26 June 2026). [link](https://futurumgroup.com/insights/look-past-ibms-07nm-label-nanostack-architecture-is-the-real-breakthrough/)
102. `gizmodo2026` — Gizmodo, "IBM Crosses One of Computing's Biggest Barriers with World's First Sub-1-Nanometer Chip" (25 June 2026). [link](https://gizmodo.com/ibm-crosses-one-of-computings-biggest-barriers-with-worlds-first-sub-1-nanometer-chip-2000777736)

## 2D & 1D channels

103. `nycu2026` — NYCU & TSMC Corporate Research (W.-H. Chang, T.-E. Lee, I. Radu et al.), monolayer MoS2 top-gate FETs with a 0.42 nm epitaxial-Al-derived AlOx interface under HfO2, Nature Electronics (Aug 2026). Press summary: Newswise. [link](https://www.newswise.com/articles/nycu-and-tsmc-researchers-engineer-atomic-interface-to-tackle-a-key-transistor-bottleneck)
104. `sciencedaily2026` — ScienceDaily, "A 0.42-Nanometer Breakthrough Could Push Transistors Beyond Silicon" (Aug 2026). [link](https://www.sciencedaily.com/releases/2026/08/260808234943.htm)
105. `intelligentliving2026` — Intelligent Living, "0.42-Nanometer Breakthrough Could Push Transistors Beyond Silicon" (explains node name vs physical thickness), Aug 2026. [link](https://www.intelligentliving.co/transistors-beyond-silicon-042-nanometer/)
106. `scitech2026` — SciTechDaily, "One of the Thinnest Transistor Interfaces Yet Could Reshape Future Chips" (Aug 2026). [link](https://scitechdaily.com/one-of-the-thinnest-transistor-interfaces-yet-could-reshape-future-chips/)
107. `ao2025` — M. Ao et al., "A RISC-V 32-bit Microprocessor Based on Two-Dimensional Semiconductors," Nature 640, 654 (2025). [doi:10.1038/s41586-025-08759-9](https://doi.org/10.1038/s41586-025-08759-9)
108. `semitoday_wuji` — Semiconductor Today, "RISC Processor Based on 2D Semiconductor FETs" (Apr 2025). [link](https://www.semiconductor-today.com/news_items/2025/apr/fudan-170425.shtml)
109. `radisavljevic2011` — B. Radisavljevic, A. Radenovic, J. Brivio, V. Giacometti, A. Kis, "Single-Layer MoS2 Transistors," Nature Nanotechnology 6, 147 (2011). [doi:10.1038/nnano.2010.279](https://doi.org/10.1038/nnano.2010.279)
110. `desai2016` — S. B. Desai et al., "MoS2 Transistors with 1-Nanometer Gate Lengths," Science 354, 99 (2016). [doi:10.1126/science.aah4698](https://doi.org/10.1126/science.aah4698)
111. `chhowalla2016` — M. Chhowalla, D. Jena, H. Zhang, "Two-Dimensional Semiconductors for Transistors," Nature Reviews Materials 1, 16052 (2016). [doi:10.1038/natrevmats.2016.52](https://doi.org/10.1038/natrevmats.2016.52)
112. `li2019` — M.-Y. Li, S.-K. Su, H.-S. P. Wong, L.-J. Li, "How 2D Semiconductors Could Extend Moore's Law," Nature 567, 169 (2019). [doi:10.1038/d41586-019-00793-8](https://doi.org/10.1038/d41586-019-00793-8)
113. `shen2021` — P.-C. Shen et al., "Ultralow Contact Resistance Between Semimetal and Monolayer Semiconductors," Nature 593, 211 (2021). [doi:10.1038/s41586-021-03472-9](https://doi.org/10.1038/s41586-021-03472-9)
114. `das2021` — S. Das et al., "Transistors Based on Two-Dimensional Materials for Future Integrated Circuits," Nature Electronics 4, 786 (2021). [doi:10.1038/s41928-021-00670-1](https://doi.org/10.1038/s41928-021-00670-1)
115. `illarionov2020` — Y. Y. Illarionov et al., "Insulators for 2D Nanoelectronics: The Gap to Bridge," Nature Communications 11, 3385 (2020). [doi:10.1038/s41467-020-16640-8](https://doi.org/10.1038/s41467-020-16640-8)
116. `li2023` — W. Li et al., "Approaching the Quantum Limit in Two-Dimensional Semiconductor Contacts," Nature 613, 274 (2023). [doi:10.1038/s41586-022-05431-4](https://doi.org/10.1038/s41586-022-05431-4)
117. `cleaninterface2025` — "Ultra-Clean Interface Between High-k Dielectric and 2D MoS2," arXiv:2507.18010 (2025). [link](https://arxiv.org/abs/2507.18010)
118. `flatland2026` — "Chips in the Flatland: 2D Semiconductors for Future Computing Electronics," arXiv:2605.26555 (2026). [link](https://arxiv.org/abs/2605.26555)
119. `novoselov2004` — K. S. Novoselov et al., "Electric Field Effect in Atomically Thin Carbon Films," Science 306, 666 (2004). [doi:10.1126/science.1102896](https://doi.org/10.1126/science.1102896)
120. `tans1998` — S. J. Tans, A. R. M. Verschueren, C. Dekker, "Room-Temperature Transistor Based on a Single Carbon Nanotube," Nature 393, 49 (1998). [doi:10.1038/29954](https://doi.org/10.1038/29954)
121. `franklin2012` — A. D. Franklin et al., "Sub-10 nm Carbon Nanotube Transistor," Nano Letters 12, 758 (2012). [doi:10.1021/nl203701g](https://doi.org/10.1021/nl203701g)
122. `shulaker2013` — M. M. Shulaker et al., "Carbon Nanotube Computer," Nature 501, 526 (2013). [doi:10.1038/nature12502](https://doi.org/10.1038/nature12502)
123. `hills2019` — G. Hills et al., "Modern Microprocessor Built from Complementary Carbon Nanotube Transistors," Nature 572, 595 (2019). [doi:10.1038/s41586-019-1493-8](https://doi.org/10.1038/s41586-019-1493-8)

## Compound semiconductors

124. `mead1966` — C. A. Mead, "Schottky Barrier Gate Field Effect Transistor," Proc. IEEE 54(2), 307 (1966). [doi:10.1109/PROC.1966.4661](https://doi.org/10.1109/PROC.1966.4661)
125. `hooper1967` — W. W. Hooper, W. I. Lehrer, "An Epitaxial GaAs Field-Effect Transistor," Proc. IEEE 55(7), 1237 (1967). [doi:10.1109/PROC.1967.5796](https://doi.org/10.1109/PROC.1967.5796)
126. `kroemer1957` — H. Kroemer, "Theory of a Wide-Gap Emitter for Transistors," Proc. IRE 45, 1535 (1957). [doi:10.1109/JRPROC.1957.278348](https://doi.org/10.1109/JRPROC.1957.278348)
127. `mimura1980` — T. Mimura, S. Hiyamizu, T. Fujii, K. Nanbu, "A New Field-Effect Transistor with Selectively Doped GaAs/n-AlxGa1-xAs Heterojunctions," Jpn. J. Appl. Phys. 19, L225 (1980). [doi:10.1143/JJAP.19.L225](https://doi.org/10.1143/JJAP.19.L225)
128. `nobel2000` — The Nobel Prize in Physics 2000: Alferov & Kroemer (semiconductor heterostructures) and Kilby (integrated circuit). [link](https://www.nobelprize.org/prizes/physics/2000/summary/)
129. `khan1993` — M. A. Khan, A. Bhattarai, J. N. Kuznia, D. T. Olson, "High Electron Mobility Transistor Based on a GaN-AlxGa1−xN Heterojunction," Appl. Phys. Lett. 63, 1214 (1993). [doi:10.1063/1.109775](https://doi.org/10.1063/1.109775)
130. `ambacher1999` — O. Ambacher et al., "Two-Dimensional Electron Gases Induced by Spontaneous and Piezoelectric Polarization Charges in N- and Ga-Face AlGaN/GaN Heterostructures," J. Appl. Phys. 85, 3222 (1999). [doi:10.1063/1.369664](https://doi.org/10.1063/1.369664)
131. `ambacher2000` — O. Ambacher et al., "Two Dimensional Electron Gases Induced by Spontaneous and Piezoelectric Polarization in Undoped and Doped AlGaN/GaN Heterostructures," J. Appl. Phys. 87, 334 (2000). [doi:10.1063/1.371866](https://doi.org/10.1063/1.371866)
132. `mishra2002` — U. K. Mishra, P. Parikh, Y.-F. Wu, "AlGaN/GaN HEMTs—An Overview of Device Operation and Applications," Proc. IEEE 90(6), 1022 (2002). [doi:10.1109/JPROC.2002.1021567](https://doi.org/10.1109/JPROC.2002.1021567)
133. `amano1989` — H. Amano, M. Kito, K. Hiramatsu, I. Akasaki, "P-Type Conduction in Mg-Doped GaN Treated with Low-Energy Electron Beam Irradiation (LEEBI)," Jpn. J. Appl. Phys. 28, L2112 (1989). [doi:10.1143/JJAP.28.L2112](https://doi.org/10.1143/JJAP.28.L2112)
134. `nakamura1992` — S. Nakamura, T. Mukai, M. Senoh, N. Iwasa, "Thermal Annealing Effects on P-Type Mg-Doped GaN Films," Jpn. J. Appl. Phys. 31, L139 (1992). [doi:10.1143/JJAP.31.L139](https://doi.org/10.1143/JJAP.31.L139)
135. `nobel2014` — The Nobel Prize in Physics 2014: Akasaki, Amano, Nakamura for efficient blue light-emitting diodes (GaN). [link](https://www.nobelprize.org/prizes/physics/2014/summary/)
136. `then2019` — H. W. Then et al., "3D Heterogeneous Integration of High Performance High-K Metal Gate GaN NMOS and Si PMOS Transistors on 300mm High-Resistivity Si Substrate for Energy-Efficient and Compact Power Delivery, RF (5G and Beyond) and SoC Applications," IEDM (2019). [doi:10.1109/IEDM19573.2019.8993583](https://doi.org/10.1109/IEDM19573.2019.8993583)
137. `bader2020` — S. J. Bader et al., "Prospects for Wide Bandgap and Ultrawide Bandgap CMOS Devices," IEEE Trans. Electron Devices 67(10), 4010 (2020). [doi:10.1109/TED.2020.3010471](https://doi.org/10.1109/TED.2020.3010471)
138. `lidow2019` — A. Lidow, M. de Rooij, J. Strydom, D. Reusch, J. Glaser, GaN Transistors for Efficient Power Conversion, 3rd ed., Wiley (2019). [doi:10.1002/9781119594406](https://doi.org/10.1002/9781119594406)
139. `kimoto2014` — T. Kimoto, J. A. Cooper, Fundamentals of Silicon Carbide Technology, Wiley (2014). [doi:10.1002/9781118313534](https://doi.org/10.1002/9781118313534)
140. `baliga1982` — B. J. Baliga, "Semiconductors for High-Voltage, Vertical Channel Field-Effect Transistors," J. Appl. Phys. 53, 1759 (1982). [doi:10.1063/1.331646](https://doi.org/10.1063/1.331646)
141. `baliga1989` — B. J. Baliga, "Power Semiconductor Device Figure of Merit for High-Frequency Applications," IEEE Electron Device Lett. 10(10), 455 (1989). [doi:10.1109/55.43098](https://doi.org/10.1109/55.43098)
142. `johnson1965` — E. O. Johnson, "Physical Limitations on Frequency and Power Parameters of Transistors," RCA Review 26, 163 (1965).
143. `higashiwaki2012` — M. Higashiwaki et al., "Gallium Oxide (Ga2O3) Metal-Semiconductor Field-Effect Transistors on Single-Crystal β-Ga2O3 (010) Substrates," Appl. Phys. Lett. 100, 013504 (2012). [doi:10.1063/1.3674287](https://doi.org/10.1063/1.3674287)
144. `tsao2018` — J. Y. Tsao et al., "Ultrawide-Bandgap Semiconductors: Research Opportunities and Challenges," Advanced Electronic Materials 4, 1600501 (2018). [doi:10.1002/aelm.201600501](https://doi.org/10.1002/aelm.201600501)

## Diamond

145. `isberg2002` — J. Isberg et al., "High Carrier Mobility in Single-Crystal Plasma-Deposited Diamond," Science 297, 1670 (2002). [doi:10.1126/science.1074374](https://doi.org/10.1126/science.1074374)
146. `landstrass1989` — M. I. Landstrass, K. V. Ravi, "Resistivity of Chemical Vapor Deposited Diamond Films," Appl. Phys. Lett. 55, 975 (1989). [doi:10.1063/1.101694](https://doi.org/10.1063/1.101694)
147. `kawarada1994` — H. Kawarada, M. Aoki, M. Ito, "Enhancement Mode Metal-Semiconductor Field Effect Transistors Using Homoepitaxial Diamonds," Appl. Phys. Lett. 65, 1563 (1994). [doi:10.1063/1.112915](https://doi.org/10.1063/1.112915)
148. `maier2000` — F. Maier, M. Riedel, B. Mantel, J. Ristein, L. Ley, "Origin of Surface Conductivity in Diamond," Phys. Rev. Lett. 85, 3472 (2000). [doi:10.1103/PhysRevLett.85.3472](https://doi.org/10.1103/PhysRevLett.85.3472)
149. `kawarada2017` — H. Kawarada et al., "Durability-Enhanced Two-Dimensional Hole Gas of C-H Diamond Surface for Complementary Power Inverter Applications," Scientific Reports 7, 42368 (2017). [doi:10.1038/srep42368](https://doi.org/10.1038/srep42368)
150. `donato2020` — N. Donato et al., "Diamond Power Devices: State of the Art, Modelling, Figures of Merit and Future Perspective," J. Phys. D: Appl. Phys. 53, 093001 (2020). [doi:10.1088/1361-6463/ab4eab](https://doi.org/10.1088/1361-6463/ab4eab)
151. `koizumi1997` — S. Koizumi, M. Kamo, Y. Sato, H. Ozaki, T. Inuzuka, "Growth and Characterization of Phosphorous Doped {111} Homoepitaxial Diamond Thin Films," Appl. Phys. Lett. 71, 1065 (1997). [doi:10.1063/1.119729](https://doi.org/10.1063/1.119729)
152. `strobel2004` — P. Strobel, M. Riedel, J. Ristein, L. Ley, "Surface Transfer Doping of Diamond," Nature 430, 439 (2004). [doi:10.1038/nature02751](https://doi.org/10.1038/nature02751)
153. `matsumoto2016` — T. Matsumoto et al., "Inversion Channel Diamond Metal-Oxide-Semiconductor Field-Effect Transistor with Normally Off Characteristics," Scientific Reports 6, 31585 (2016). [doi:10.1038/srep31585](https://doi.org/10.1038/srep31585)
154. `schreck2017` — M. Schreck, S. Gsell, R. Brescia, M. Fischer, "Ion Bombardment Induced Buried Lateral Growth: The Key Mechanism for the Synthesis of Single Crystal Diamond Wafers," Scientific Reports 7, 44462 (2017). [doi:10.1038/srep44462](https://doi.org/10.1038/srep44462)
155. `df2023` — Semiconductor Today, "Diamond Foundry Creates First 100mm Single-Crystal Diamond Wafer" (heteroepitaxy; 6 Nov 2023). [link](https://www.semiconductor-today.com/news_items/2023/nov/diamond-foundry-061123.shtml)
156. `orbray_wafers` — Orbray, "Diamond Wafers: Production Technologies and Applications" (heteroepitaxial diamond on sapphire, inch-scale wafers). [link](https://orbray.com/magazine_en/archives/3456)
157. `oi2024` — N. Oi et al., vertical p-channel diamond MOSFETs with 0.7 A single-device drain current, IEEE Electron Device Lett. (Aug 2024); summary in Semiconductor Today, "High-Current Vertical Diamond MOSFETs." [doi:10.1109/LED.2024.3427423](https://doi.org/10.1109/LED.2024.3427423)
158. `jvstb2025_4266` — "High Off-State Voltage (4266 V) Diamond Metal Oxide Semiconductor Field Effect Transistors," J. Vac. Sci. Technol. B 43(4), 042201 (2025). [link](https://pubs.aip.org/avs/jvb/article/43/4/042201/3347764/High-off-state-voltage-4266-V-diamond-metal-oxide)
159. `apl2025_17kv` — "Normally-Off Boron-Doped Diamond MOSFETs with a Breakdown Voltage over 1.7 kV," Appl. Phys. Lett. 127(4), 042601 (2025). [link](https://pubs.aip.org/aip/apl/article/127/4/042601/3356215/Normally-off-boron-doped-diamond-MOSFETs-with-a)
160. `modulation3326` — "3326-V Modulation-Doped Diamond MOSFETs" (2022), ResearchGate record. [link](https://www.researchgate.net/publication/361180454_3326-V_Modulation-Doped_Diamond_MOSFETs)
161. `pds2025` — DIGITIMES, "Japanese Startup Pushes Diamond Semiconductors toward Commercialization in EVs and Satellites" (Power Diamond Systems, Waseda spin-out; SEMICON Japan 2025 demo; JAXA collaboration), Dec 2025. [link](https://www.digitimes.com/news/a20251224PD232/diamond-semiconductors-startup-jaxa-2025.html)
162. `compoundsemi_pds` — Compound Semiconductor, "Japanese Start-Up Demos Diamond MOSFET Breakthroughs." [link](https://compoundsemiconductor.net/article/123734/Japanese_start-up_demos_diamond_MOSFET_breakthroughs)
163. `felbinger2007` — J. G. Felbinger et al., "Comparison of GaN HEMTs on Diamond and SiC Substrates," IEEE Electron Device Lett. 28(11), 948 (2007). [link](https://ieeexplore.ieee.org/document/4367547/)
164. `gan_diamond_tbr` — "Thermal Boundary Resistance Reduction by Interfacial Nanopatterning for GaN-on-Diamond Electronics Applications," ACS Appl. Electron. Mater. (2025). [doi:10.1021/acsaelm.5c00119](https://doi.org/10.1021/acsaelm.5c00119)
165. `gan_diamond_tbr2021` — "Record-Low Thermal Boundary Resistance between Diamond and GaN-on-SiC for Enabling Radiofrequency Device Cooling," ACS Appl. Mater. Interfaces (2021). [doi:10.1021/acsami.1c13833](https://doi.org/10.1021/acsami.1c13833)
166. `doherty2013` — M. W. Doherty et al., "The Nitrogen-Vacancy Colour Centre in Diamond," Physics Reports 528, 1 (2013). [doi:10.1016/j.physrep.2013.02.001](https://doi.org/10.1016/j.physrep.2013.02.001)
167. `csmantech2024` — "Progress in Diamond MOSFET Technologies," CS MANTECH 2024 digest. [link](https://csmantech.org/wp-content/uploads/2024/06/4.1.2.2024-Progress-in-Diamond-MOSFET-Technologies-.pdf)
168. `hterm_review2025` — "Hydrogen-Terminated and Oxygen-Terminated Diamond Metal-Oxide-Semiconductor Field-Effect Transistors," Functional Diamond (2025). [doi:10.1080/26941112.2025.2551496](https://doi.org/10.1080/26941112.2025.2551496)
169. `mpcvd_review2026` — "Advances and Challenges in Single Crystal Diamond Growth via Microwave Plasma Chemical Vapor Deposition," Functional Diamond (2026). [doi:10.1080/26941112.2026.2669069](https://doi.org/10.1080/26941112.2026.2669069)
170. `heteroepi_review2024` — "Recent Progress on Heteroepitaxial Growth of Single Crystal Diamond Films," Electron (Wiley, 2024). [doi:10.1002/elt2.70](https://doi.org/10.1002/elt2.70)
171. `pen_diamond` — Power Electronics News, "The Quest to Make Diamond as Available as Silicon." [link](https://www.powerelectronicsnews.com/the-quest-to-make-diamond-as-available-as-silicon/)
172. `maier2001` — F. Maier, J. Ristein, L. Ley, "Electron Affinity of Plasma-Hydrogenated and Chemically Oxidized Diamond (100) Surfaces," Phys. Rev. B 64, 165411 (2001). [doi:10.1103/PhysRevB.64.165411](https://doi.org/10.1103/PhysRevB.64.165411)

## Beyond CMOS

173. `likharev1991` — K. K. Likharev, V. K. Semenov, "RSFQ Logic/Memory Family: A New Josephson-Junction Technology for Sub-Terahertz-Clock-Frequency Digital Systems," IEEE Trans. Appl. Supercond. 1(1), 3 (1991). [doi:10.1109/77.80745](https://doi.org/10.1109/77.80745)
174. `han2012` — J.-W. Han, J. S. Oh, M. Meyyappan, "Vacuum Nanoelectronics: Back to the Future?—Gate Insulated Nanoscale Vacuum Channel Transistor," Appl. Phys. Lett. 100, 213505 (2012). [doi:10.1063/1.4717751](https://doi.org/10.1063/1.4717751)

## Chip data

175. `apple_a11` — Wikipedia, "Apple A11" (4.3 billion transistors, TSMC 10 nm FinFET). [link](https://en.wikipedia.org/wiki/Apple_A11)
176. `apple_a12` — Wikipedia, "Apple A12" (6.9 billion transistors, TSMC N7); see also Tom's Hardware launch coverage. [link](https://en.wikipedia.org/wiki/Apple_A12)
177. `phonearena_n5` — PhoneArena, TSMC 5 nm density (171.3 MTr/mm²) and A14 (11.8B) / M1 (16B) transistor counts. [link](https://www.phonearena.com/news/apple-a16-bionic-chip-could-use-4nm-process-node-by-2022_id128506)
178. `apple_m1max` — Apple Newsroom, "Introducing M1 Pro and M1 Max" (57 billion transistors), Oct 2021. [link](https://www.apple.com/newsroom/2021/10/introducing-m1-pro-and-m1-max-the-most-powerful-chips-apple-has-ever-built/)
179. `apple_m3` — Apple Newsroom, "Apple Unveils M3, M3 Pro, and M3 Max" (M3 Max: 92 billion transistors, 3 nm), Oct 2023. [link](https://www.apple.com/newsroom/2023/10/apple-unveils-m3-m3-pro-and-m3-max-the-most-advanced-chips-for-a-personal-computer/)
180. `nvidia_h100` — Wikipedia, "Hopper (microarchitecture)" (H100: 80 billion transistors, TSMC 4N, 814 mm²). [link](https://en.wikipedia.org/wiki/Hopper_(microarchitecture))
181. `nvidia_blackwell` — Wikipedia, "Blackwell (microarchitecture)" (B200: 208 billion transistors across two dies, TSMC 4NP). [link](https://en.wikipedia.org/wiki/Blackwell_(microarchitecture))
182. `cerebras_wse3` — Cerebras, WSE-3 announcement (4 trillion transistors, 46,225 mm²), March 2024. [link](https://www.cerebras.ai/press-release/cerebras-announces-third-generation-wafer-scale-engine)

## Image sources

183. `commons_dies` — Wikimedia Commons, Category: Intel microprocessor dies (Pauli Rautakorpi and others). [link](https://commons.wikimedia.org/wiki/Category:Intel_microprocessor_dies)
184. `rautakorpi` — Pauli Rautakorpi (User:Birdman86), die-shot collection on Wikimedia Commons, CC BY 3.0. [link](https://commons.wikimedia.org/wiki/User:Birdman86)
185. `fritzchens` — Fritzchens Fritz, die-shot album on Flickr (CC0 public-domain dedication). [link](https://www.flickr.com/photos/130561288@N04/albums/72157650403404920/)
186. `commons_transistors` — Wikimedia Commons, Category: Early transistors. [link](https://commons.wikimedia.org/wiki/Category:Early_transistors)

## Design inspiration

187. `inspo_reactbits` — DavidHDev, react-bits — animated React components. [link](https://github.com/DavidHDev/react-bits)
188. `inspo_magicui` — magicuidesign, magicui — animated components for design engineers. [link](https://github.com/magicuidesign/magicui)
189. `inspo_animateui` — Animate UI — animated React components. [link](https://animate-ui.com/)
190. `inspo_motionprimitives` — ibelick, motion-primitives — animated UI kit. [link](https://github.com/ibelick/motion-primitives)
191. `inspo_fluid` — PavelDoGreat, WebGL-Fluid-Simulation. [link](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation)
192. `inspo_folio` — Bruno Simon, folio-2019 (three.js portfolio). [link](https://github.com/brunosimon/folio-2019)
193. `inspo_gsap` — GreenSock, GSAP animation platform (used here with ScrollTrigger). [link](https://github.com/greensock/GSAP)
194. `inspo_remotion` — remotion-dev, Remotion — programmatic video with React. [link](https://github.com/remotion-dev/remotion)
195. `inspo_llmviz` — B. Bycroft, llm-viz — 3D visualization of a GPT-style LLM. [link](https://github.com/bbycroft/llm-viz)
196. `inspo_transformer` — Polo Club (Georgia Tech), Transformer Explainer. [link](https://github.com/poloclub/transformer-explainer)
197. `inspo_godseye` — bilawalsidhu, gods-eye-view — 3D globe spatial-intelligence viewer. [link](https://github.com/bilawalsidhu/gods-eye-view)
198. `inspo_worldmonitor` — koala73, worldmonitor — real-time global intelligence dashboard. [link](https://github.com/koala73/worldmonitor)
199. `threejs` — three.js — JavaScript 3D library (used for the architecture explorer). [link](https://threejs.org/)

## Niche devices

200. `shockley1952` — W. Shockley, "A Unipolar 'Field-Effect' Transistor," Proc. IRE 40, 1365 (1952). [doi:10.1109/JRPROC.1952.273964](https://doi.org/10.1109/JRPROC.1952.273964)
201. `bradley1953` — W. E. Bradley, "The Surface-Barrier Transistor: Part I—Principles of the Surface-Barrier Transistor," Proc. IRE 41, 1702 (1953). (Philco)
202. `esaki1958` — L. Esaki, "New Phenomenon in Narrow Germanium p-n Junctions," Phys. Rev. 109, 603 (1958). [doi:10.1103/PhysRev.109.603](https://doi.org/10.1103/PhysRev.109.603)
203. `weimer1962` — P. K. Weimer, "The TFT—A New Thin-Film Transistor," Proc. IRE 50, 1462 (1962). [doi:10.1109/JRPROC.1962.288190](https://doi.org/10.1109/JRPROC.1962.288190)
204. `kahng1967` — D. Kahng, S. M. Sze, "A Floating Gate and Its Application to Memory Devices," Bell Syst. Tech. J. 46, 1288 (1967). [doi:10.1002/j.1538-7305.1967.tb01738.x](https://doi.org/10.1002/j.1538-7305.1967.tb01738.x)
205. `boyle1970` — W. S. Boyle, G. E. Smith, "Charge Coupled Semiconductor Devices," Bell Syst. Tech. J. 49, 587 (1970). [doi:10.1002/j.1538-7305.1970.tb01790.x](https://doi.org/10.1002/j.1538-7305.1970.tb01790.x)
206. `baliga1982igt` — B. J. Baliga, "Creation of the Insulated Gate Bipolar Transistor," in 75th Anniversary of the Transistor, Wiley-IEEE Press (2023); original insulated-gate rectifier reported at IEDM 1982. [doi:10.1002/9781394202478.ch25](https://doi.org/10.1002/9781394202478.ch25)
207. `tsumura1986` — A. Tsumura, H. Koezuka, T. Ando, "Macromolecular Electronic Device: Field-Effect Transistor with a Polythiophene Thin Film," Appl. Phys. Lett. 49, 1210 (1986). [doi:10.1063/1.97417](https://doi.org/10.1063/1.97417)
208. `nomura2004` — K. Nomura et al., "Room-Temperature Fabrication of Transparent Flexible Thin-Film Transistors Using Amorphous Oxide Semiconductors," Nature 432, 488 (2004). [doi:10.1038/nature03090](https://doi.org/10.1038/nature03090)
209. `ozer2024` — E. Ozer et al., "Bendable Non-Silicon RISC-V Microprocessor" (Flex-RV, 0.6 µm IGZO TFTs on polyimide), Nature 634, 341 (2024). [doi:10.1038/s41586-024-07976-y](https://doi.org/10.1038/s41586-024-07976-y)
210. `colinge2010` — J.-P. Colinge et al., "Nanowire Transistors without Junctions," Nature Nanotechnology 5, 225 (2010). [doi:10.1038/nnano.2010.15](https://doi.org/10.1038/nnano.2010.15)
211. `tanaka2007` — H. Tanaka et al., "Bit Cost Scalable Technology with Punch and Plug Process for Ultra High Density Flash Memory," VLSI Technology Symp. (2007). [doi:10.1109/VLSIT.2007.4339708](https://doi.org/10.1109/VLSIT.2007.4339708)
212. `vtfet2021` — IBM Newsroom, "IBM and Samsung Unveil Semiconductor Breakthrough That Defies Conventional Design" (vertical transport FET, VTFET), Dec 2021. [link](https://newsroom.ibm.com/2021-12-14-IBM-and-Samsung-Unveil-Semiconductor-Breakthrough-That-Defies-Conventional-Design)
213. `colinge_soi` — J.-P. Colinge, Silicon-on-Insulator Technology: Materials to VLSI, 3rd ed., Springer (2004). [doi:10.1007/978-1-4419-9106-5](https://doi.org/10.1007/978-1-4419-9106-5)

## Steep-slope & exotic

214. `ionescu2011` — A. M. Ionescu, H. Riel, "Tunnel Field-Effect Transistors as Energy-Efficient Electronic Switches," Nature 479, 329 (2011). [doi:10.1038/nature10679](https://doi.org/10.1038/nature10679)
215. `salahuddin2008` — S. Salahuddin, S. Datta, "Use of Negative Capacitance to Provide Voltage Amplification for Low Power Nanoscale Devices," Nano Letters 8, 405 (2008). [doi:10.1021/nl071804g](https://doi.org/10.1021/nl071804g)
216. `boscke2011` — T. S. Böscke et al., "Ferroelectricity in Hafnium Oxide Thin Films," Appl. Phys. Lett. 99, 102903 (2011). [doi:10.1063/1.3634052](https://doi.org/10.1063/1.3634052)
217. `fulton1987` — T. A. Fulton, G. J. Dolan, "Observation of Single-Electron Charging Effects in Small Tunnel Junctions," Phys. Rev. Lett. 59, 109 (1987). [doi:10.1103/PhysRevLett.59.109](https://doi.org/10.1103/PhysRevLett.59.109)
218. `datta1990` — S. Datta, B. Das, "Electronic Analog of the Electro-Optic Modulator," Appl. Phys. Lett. 56, 665 (1990). [doi:10.1063/1.102730](https://doi.org/10.1063/1.102730)
219. `strukov2008` — D. B. Strukov, G. S. Snider, D. R. Stewart, R. S. Williams, "The Missing Memristor Found," Nature 453, 80 (2008). [doi:10.1038/nature06932](https://doi.org/10.1038/nature06932)
220. `kane1961` — E. O. Kane, "Theory of Tunneling," J. Appl. Phys. 32, 83 (1961). [doi:10.1063/1.1735965](https://doi.org/10.1063/1.1735965)
221. `chua1971` — L. Chua, "Memristor—The Missing Circuit Element," IEEE Trans. Circuit Theory 18(5), 507 (1971). [doi:10.1109/TCT.1971.1083337](https://doi.org/10.1109/TCT.1971.1083337)

## Packaging

222. `tsmc_3dfabric` — TSMC, "3DFabric" (CoWoS, InFO and SoIC packaging family). [link](https://3dfabric.tsmc.com/english/dedicatedFoundry/technology/3DFabric.htm)
223. `tsmc_soic` — TSMC, "TSMC-SoIC" (wafer-level 3D stacking; bond pitch from the sub-10 µm rule; SoIC-X chip-on-wafer and wafer-on-wafer). [link](https://3dfabric.tsmc.com/english/dedicatedFoundry/technology/SoIC.htm)
224. `jedec_hbm4` — JEDEC, "JESD270-4 HBM4 Standard" press release (16 Apr 2025): 2048-bit interface, up to 8 Gb/s per pin, 2 TB/s, 4/8/12/16-high stacks, up to 64 GB. [link](https://www.jedec.org/news/pressreleases/jedec%C2%AE-and-industry-leaders-collaborate-release-jesd270-4-hbm4-standard-advancing)
225. `hybrid_guide2026` — Inside Deep Tech, "Hybrid Bonding: A Full Guide to SoIC & Foveros Direct" (2026). [link](https://www.insidedeeptech.com/hybrid-bonding-soic-foveros-direct-full-guide/)
226. `intel_packaging` — Intel Foundry, "Advanced Process Technologies for Data Center" (Foveros, EMIB, Foveros Direct). [link](https://www.intel.com/content/www/us/en/foundry/library/advanced-process-technologies-for-data-center.html)
227. `iclink2026` — Tech Times, "IC-Link Joins TSMC 3DFabric Alliance; Showcases CoWoS ASIC Co-Design" (23 Sep 2026). [link](https://www.techtimes.com/articles/327952/20260923/ic-link-joins-tsmc-3dfabric-alliance-showcases-cowos-asic-co-design-oip-forum-today.htm)

## Physics lab

228. `varshni1967` — Y. P. Varshni, "Temperature Dependence of the Energy Gap in Semiconductors," Physica 34, 149 (1967). [doi:10.1016/0031-8914(67)90062-6](https://doi.org/10.1016/0031-8914(67)90062-6)
229. `vurgaftman2001` — I. Vurgaftman, J. R. Meyer, L. R. Ram-Mohan, "Band Parameters for III–V Compound Semiconductors and Their Alloys," J. Appl. Phys. 89, 5815 (2001). [doi:10.1063/1.1368156](https://doi.org/10.1063/1.1368156)
230. `altermatt2003` — P. P. Altermatt et al., "Reassessment of the Intrinsic Carrier Density in Crystalline Silicon in View of Band-Gap Narrowing," J. Appl. Phys. 93, 1598 (2003). [doi:10.1063/1.1529297](https://doi.org/10.1063/1.1529297)
231. `ioffe_nsm` — Ioffe Institute, "New Semiconductor Materials: Characteristics and Properties" (NSM archive) — band gaps, effective densities of states, lattice constants. [link](http://www.ioffe.ru/SVA/NSM/Semicond/)
232. `caughey1967` — D. M. Caughey, R. E. Thomas, "Carrier Mobilities in Silicon Empirically Related to Doping and Field," Proc. IEEE 55, 2192 (1967). [doi:10.1109/PROC.1967.6123](https://doi.org/10.1109/PROC.1967.6123)
233. `canali1975` — C. Canali, G. Majni, R. Minder, G. Ottaviani, "Electron and Hole Drift Velocity Measurements in Silicon and Their Empirical Relation to Electric Field and Temperature," IEEE Trans. Electron Devices 22, 1045 (1975). [doi:10.1109/T-ED.1975.18267](https://doi.org/10.1109/T-ED.1975.18267)
234. `jacoboni1983` — C. Jacoboni, L. Reggiani, "The Monte Carlo Method for the Solution of Charge Transport in Semiconductors with Applications to Covalent Materials," Rev. Mod. Phys. 55, 645 (1983). [doi:10.1103/RevModPhys.55.645](https://doi.org/10.1103/RevModPhys.55.645)
235. `lundstrom2000` — M. Lundstrom, Fundamentals of Carrier Transport, 2nd ed., Cambridge University Press (2000). [doi:10.1017/CBO9780511618611](https://doi.org/10.1017/CBO9780511618611)
236. `yan1992` — R.-H. Yan, A. Ourmazd, K. F. Lee, "Scaling the Si MOSFET: From Bulk to SOI to Bulk," IEEE Trans. Electron Devices 39, 1704 (1992). [doi:10.1109/16.141237](https://doi.org/10.1109/16.141237)
237. `frank1998` — D. J. Frank, Y. Taur, H.-S. P. Wong, "Generalized Scale Length for Two-Dimensional Effects in MOSFETs," IEEE Electron Device Lett. 19, 385 (1998). [doi:10.1109/55.720194](https://doi.org/10.1109/55.720194)
238. `selberherr1984` — S. Selberherr, Analysis and Simulation of Semiconductor Devices, Springer (1984). [doi:10.1007/978-3-7091-8752-4](https://doi.org/10.1007/978-3-7091-8752-4)
239. `tsu1973` — R. Tsu, L. Esaki, "Tunneling in a Finite Superlattice," Appl. Phys. Lett. 22, 562 (1973). [doi:10.1063/1.1654509](https://doi.org/10.1063/1.1654509)
240. `chang1974` — L. L. Chang, L. Esaki, R. Tsu, "Resonant Tunneling in Semiconductor Double Barriers," Appl. Phys. Lett. 24, 593 (1974). [doi:10.1063/1.1655067](https://doi.org/10.1063/1.1655067)
241. `ando1987` — Y. Ando, T. Itoh, "Calculation of Transmission Tunneling Current Across Arbitrary Potential Barriers," J. Appl. Phys. 61, 1497 (1987). [doi:10.1063/1.338082](https://doi.org/10.1063/1.338082)
242. `lo1997` — S.-H. Lo, D. A. Buchanan, Y. Taur, W. Wang, "Quantum-Mechanical Modeling of Electron Tunneling Current from the Inversion Layer of Ultra-Thin-Oxide nMOSFETs," IEEE Electron Device Lett. 18, 209 (1997). [doi:10.1109/55.568766](https://doi.org/10.1109/55.568766)
243. `griffiths2018` — D. J. Griffiths, D. F. Schroeter, Introduction to Quantum Mechanics, 3rd ed., Cambridge University Press (2018). [doi:10.1017/9781316995433](https://doi.org/10.1017/9781316995433)
244. `wilson1969` — J. A. Wilson, A. D. Yoffe, "The Transition Metal Dichalcogenides: Discussion and Interpretation of the Observed Optical, Electrical and Structural Properties," Adv. Phys. 18, 193 (1969). [doi:10.1080/00018736900101307](https://doi.org/10.1080/00018736900101307)
245. `nanohub_pntoy` — nanoHUB, "PN Junction Lab" — free online pn-junction simulator (Purdue University). [link](https://nanohub.org/tools/pntoy)
246. `nanohub_moscap` — nanoHUB, "MOSCap" — free online MOS capacitor simulator (Purdue University). [link](https://nanohub.org/tools/moscap)
247. `katex` — KaTeX — fast math typesetting for the web (MIT licence), used for the Physics Lab equations. [link](https://katex.org/)
248. `kronig1931` — R. de L. Kronig, W. G. Penney, "Quantum Mechanics of Electrons in Crystal Lattices," Proc. R. Soc. Lond. A 130, 499 (1931). [doi:10.1098/rspa.1931.0019](https://doi.org/10.1098/rspa.1931.0019)
249. `ashcroft1976` — N. W. Ashcroft, N. D. Mermin, Solid State Physics, Holt, Rinehart and Winston (1976) — chapters 8–9 on Bloch electrons and the nearly-free-electron model.
250. `bendaniel1966` — D. J. BenDaniel, C. B. Duke, "Space-Charge Effects on Electron Tunneling," Phys. Rev. 152, 683 (1966) — boundary conditions for position-dependent effective mass. [doi:10.1103/PhysRev.152.683](https://doi.org/10.1103/PhysRev.152.683)
251. `tan1990` — I.-H. Tan, G. L. Snider, L. D. Chang, E. L. Hu, "A Self-Consistent Solution of Schrödinger–Poisson Equations Using a Nonuniform Mesh," J. Appl. Phys. 68, 4071 (1990). [doi:10.1063/1.346245](https://doi.org/10.1063/1.346245)
252. `trellakis1997` — A. Trellakis, A. T. Galick, A. Pacelli, U. Ravaioli, "Iteration Scheme for the Solution of the Two-Dimensional Schrödinger–Poisson Equations in Quantum Structures," J. Appl. Phys. 81, 7880 (1997). [doi:10.1063/1.365396](https://doi.org/10.1063/1.365396)
253. `paosah1966` — H. C. Pao, C. T. Sah, "Effects of Diffusion Current on Characteristics of Metal-Oxide (Insulator)-Semiconductor Transistors," Solid-State Electron. 9, 927 (1966). [doi:10.1016/0038-1101(66)90068-2](https://doi.org/10.1016/0038-1101(66)90068-2)
254. `brews1978` — J. R. Brews, "A Charge-Sheet Model of the MOSFET," Solid-State Electron. 21, 345 (1978). [doi:10.1016/0038-1101(78)90264-2](https://doi.org/10.1016/0038-1101(78)90264-2)
255. `hopkins1953` — H. H. Hopkins, "On the Diffraction Theory of Optical Images," Proc. R. Soc. Lond. A 217, 408 (1953) — partially coherent imaging. [doi:10.1098/rspa.1953.0071](https://doi.org/10.1098/rspa.1953.0071)
256. `mack2007` — C. Mack, Fundamental Principles of Optical Lithography: The Science of Microfabrication, Wiley (2007). [doi:10.1002/9780470723876](https://doi.org/10.1002/9780470723876)
257. `rahman2003` — A. Rahman, J. Guo, S. Datta, M. Lundstrom, "Theory of Ballistic Nanotransistors," IEEE Trans. Electron Devices 50, 1853 (2003). [doi:10.1109/TED.2003.815366](https://doi.org/10.1109/TED.2003.815366)
258. `lundstrom1997` — M. Lundstrom, "Elementary Scattering Theory of the Si MOSFET," IEEE Electron Device Lett. 18, 361 (1997). [doi:10.1109/55.596937](https://doi.org/10.1109/55.596937)
259. `mayadas1970` — A. F. Mayadas, M. Shatzkes, "Electrical-Resistivity Model for Polycrystalline Films: the Case of Arbitrary Reflection at External Surfaces," Phys. Rev. B 1, 1382 (1970). [doi:10.1103/PhysRevB.1.1382](https://doi.org/10.1103/PhysRevB.1.1382)
260. `sondheimer1952` — E. H. Sondheimer, "The Mean Free Path of Electrons in Metals," Adv. Phys. 1, 1 (1952). [doi:10.1080/00018735200101151](https://doi.org/10.1080/00018735200101151)
261. `gall2016` — D. Gall, "Electron Mean Free Path in Elemental Metals," J. Appl. Phys. 119, 085101 (2016). [doi:10.1063/1.4942216](https://doi.org/10.1063/1.4942216)
262. `elmore1948` — W. C. Elmore, "The Transient Response of Damped Linear Networks with Particular Regard to Wideband Amplifiers," J. Appl. Phys. 19, 55 (1948). [doi:10.1063/1.1697872](https://doi.org/10.1063/1.1697872)

## Circuit lab

263. `sutherland1999` — I. E. Sutherland, R. F. Sproull, D. Harris, "Logical Effort: Designing Fast CMOS Circuits," Morgan Kaufmann (1999). [link](https://books.google.com/books?id=OnlnI3s0vWUC)
264. `bryant1984` — R. E. Bryant, "A Switch-Level Model and Simulator for MOS Digital Systems," IEEE Trans. Computers C-33, 160 (1984). [doi:10.1109/TC.1984.1676408](https://doi.org/10.1109/TC.1984.1676408)
265. `koggestone1973` — P. M. Kogge, H. S. Stone, "A Parallel Algorithm for the Efficient Solution of a General Class of Recurrence Equations," IEEE Trans. Computers C-22, 786 (1973). [doi:10.1109/TC.1973.5009159](https://doi.org/10.1109/TC.1973.5009159)
266. `seevinck1987` — E. Seevinck, F. J. List, J. Lohstroh, "Static-Noise Margin Analysis of MOS SRAM Cells," IEEE J. Solid-State Circuits 22, 748 (1987). [doi:10.1109/JSSC.1987.1052809](https://doi.org/10.1109/JSSC.1987.1052809)
267. `fowler1928` — R. H. Fowler, L. Nordheim, "Electron Emission in Intense Electric Fields," Proc. R. Soc. Lond. A 119, 173 (1928). [doi:10.1098/rspa.1928.0091](https://doi.org/10.1098/rspa.1928.0091)
268. `lenzlinger1969` — M. Lenzlinger, E. H. Snow, "Fowler-Nordheim Tunneling into Thermally Grown SiO2," J. Appl. Phys. 40, 278 (1969). [doi:10.1063/1.1657043](https://doi.org/10.1063/1.1657043)
269. `suh1995` — K.-D. Suh et al., "A 3.3 V 32 Mb NAND Flash Memory with Incremental Step Pulse Programming Scheme," IEEE J. Solid-State Circuits 30, 1149 (1995). [link](https://ui.adsabs.harvard.edu/abs/1995IJSSC..30.1149S/abstract)
270. `masuoka1987` — F. Masuoka, M. Momodomi, Y. Iwata, R. Shirota, "New Ultra High Density EPROM and Flash EEPROM with NAND Structure Cell," IEDM Tech. Dig., 552 (1987). [doi:10.1109/IEDM.1987.191485](https://doi.org/10.1109/IEDM.1987.191485)
271. `park2015vnand` — K.-T. Park et al., "Three-Dimensional 128 Gb MLC Vertical NAND Flash Memory with 24-WL Stacked Layers and 50 MB/s High-Speed Programming," IEEE J. Solid-State Circuits 50, 204 (2015). [link](https://ui.adsabs.harvard.edu/abs/2015IJSSC..50..204P/abstract)
272. `wikichip_sram2022` — WikiChip Fuse, "IEDM 2022: Did We Just Witness the Death of SRAM?" (TSMC N5, N3B and N3E high-density bitcells) (2022). [link](https://fuse.wikichip.org/news/7343/iedm-2022-did-we-just-witness-the-death-of-sram/)
273. `tsmc_n2_sram` — Tom's Hardware, "SRAM scaling isn't dead after all: TSMC's 2nm process tech claims major improvements" (N2 bitcell 0.0175 µm², 38 Mb/mm²) (2025). [link](https://www.tomshardware.com/tech-industry/sram-scaling-isnt-dead-after-all-tsmcs-2nm-process-tech-claims-major-improvements)
274. `skhynix321` — SK hynix, "SK hynix Starts Mass Production of World's First 321-High NAND" (Nov. 2024). [link](https://news.skhynix.com/sk-hynix-starts-mass-production-of-world-first-321-high-nand/)
275. `semieng_3dnand` — Semiconductor Engineering, "3D NAND's Vertical Scaling Race" (2020). [link](https://semiengineering.com/3d-nands-vertical-scaling-race/)
276. `eetimes_sram90` — EE Times, "Intel claims smallest SRAM cell with 90-nm process, preps technology for 2003 production" (1.0 µm² six-transistor cell) (2002). [link](https://www.eetimes.com/intel-claims-smallest-sram-cell-with-90-nm-process-preps-technology-for-2003-production/)
277. `sram65_intel` — Silicon Semiconductor, "Intel produces 65nm SRAM" (0.57 µm² cell) (2003). [link](https://siliconsemiconductor.net/article/66658/Intel_produces_65nm_SRAM)
278. `rwt_intel45` — Real World Technologies, "Intel's 45nm Surprise: High-k Dielectrics and Metal Gates" (0.346 µm² SRAM cell) (2007). [link](https://www.realworldtech.com/intel-45nm-hkmg/4/)
279. `natarajan2008` — S. Natarajan et al., "A 32nm Logic Technology Featuring 2nd-Generation High-k + Metal-Gate Transistors, Enhanced Channel Strain and 0.171 µm² SRAM Cell Size in a 291Mb Array," IEDM Tech. Dig. (2008). [link](https://scholar.google.com/scholar?q=%22A+32nm+logic+technology+featuring+2nd-generation+high-k+%2B+metal-gate+transistors%22)
280. `intel22_pres` — Intel, "Silicon Technology Leadership for the Mobility Era" (22 nm: 0.092 µm² and 0.108 µm² SRAM cells) (2012). [link](https://www.intel.com/content/dam/www/public/us/en/documents/presentation/silicon-technology-leadership-presentation.pdf)
281. `intel10_iedm2017` — Semiconductor Digest (TechInsights), "IEDM 2017: Intel's 10nm Platform Process" (0.0312 µm² high-density SRAM cell) (2017). [link](https://sst.semiconductor-digest.com/chipworks_real_chips_blog/2017/12/18/iedm-2017-intels-10nm-platform-process/)
282. `wu2016_n7` — S.-Y. Wu et al., "A 7nm CMOS Platform Technology Featuring 4th Generation FinFET Transistors with a 0.027 µm² High Density 6-T SRAM Cell for Mobile SoC Applications," IEDM Tech. Dig. (2016). [link](https://www.semanticscholar.org/paper/985acfee298f91e10443efe918388e2adee0325f)
283. `dennard1968` — R. H. Dennard, "Field-Effect Transistor Memory," U.S. Patent 3,387,286 (granted June 4, 1968; the one-transistor, one-capacitor DRAM cell). [link](https://patents.google.com/patent/US3387286A)
284. `chaney1973` — T. J. Chaney, C. E. Molnar, "Anomalous Behavior of Synchronizer and Arbiter Circuits," IEEE Trans. Computers C-22, 421 (1973). [link](https://scholar.google.com/scholar?q=%22Anomalous+Behavior+of+Synchronizer+and+Arbiter+Circuits%22)
285. `veendrick1980` — H. J. M. Veendrick, "The Behavior of Flip-Flops Used as Synchronizers and Prediction of Their Failure Rate," IEEE J. Solid-State Circuits 15, 169 (1980). [link](https://scholar.google.com/scholar?q=%22The+Behavior+of+Flip-Flops+Used+as+Synchronizers+and+Prediction+of+Their+Failure+Rate%22)
286. `ginosar2011` — R. Ginosar, "Metastability and Synchronizers: A Tutorial," IEEE Design & Test of Computers 28(5) (2011). [link](https://webee.technion.ac.il/~ran/papers/MetastabilitySynchronizersTutorialIEEEDT2011.pdf)
287. `bhati2015` — I. Bhati, M.-T. Chang, Z. Chishti, S.-L. Lu, B. Jacob, "DRAM Refresh Mechanisms, Penalties, and Trade-Offs," IEEE Trans. Computers 64 (2015). [link](https://user.eng.umd.edu/~blj/papers/ieeetc65-1.pdf)
288. `liu2012raidr` — J. Liu, B. Jaiyen, R. Veras, O. Mutlu, "RAIDR: Retention-Aware Intelligent DRAM Refresh," Proc. ISCA (2012). [link](https://www.semanticscholar.org/paper/2913004da8f897d20f31c047b46c8cfdcd0eb7d3)
289. `techinsights_dram` — TechInsights, "DRAM Scaling Trend and Beyond" (cell capacitance below 10 fF at D1z/D1a; 6F² cell) (2023). [link](https://www.techinsights.com/blog/dram-scaling-trend-and-beyond)

## Process lab

290. `dealgrove1965` — B. E. Deal, A. S. Grove, "General Relationship for the Thermal Oxidation of Silicon," J. Appl. Phys. 36, 3770 (1965). [doi:10.1063/1.1713945](https://doi.org/10.1063/1.1713945)
291. `hollauer_dg` — C. Hollauer, "Modeling of Thermal Oxidation and Stress Effects," PhD thesis, TU Wien, Sec. 2.6: The Deal-Grove Model (Arrhenius parameters for dry and wet oxidation) (2007). [link](https://www.iue.tuwien.ac.at/phd/hollauer/node16.html)
292. `uiuc_diffusivity` — University of Illinois Holonyak Micro & Nanotechnology Lab, "Silicon Diffusivity Data" (D₀ and Eₐ/k for B, P, As, Sb in Si). [link](https://fabweb.ece.illinois.edu/gt/gt/gt10.aspx)
293. `lindhard1963` — J. Lindhard, M. Scharff, H. E. Schiøtt, "Range Concepts and Heavy Ion Ranges," Mat. Fys. Medd. Dan. Vid. Selsk. 33, no. 14 (1963).
294. `zbl1985` — J. F. Ziegler, J. P. Biersack, U. Littmark, "The Stopping and Range of Ions in Solids," Pergamon (1985); universal nuclear stopping. [link](http://www.srim.org/)
295. `tuttle_implant` — G. Tuttle, "EE 432/532 Ion implantation examples," Iowa State University (B 80 keV: Rp ≈ 0.24 µm; P 100 keV: Rp ≈ 0.12 µm). [link](https://gtuttle.net/fabrication/topics/ion_implantation_examples.pdf)
296. `murphy1964` — B. T. Murphy, "Cost-Size Optima of Monolithic Integrated Circuits," Proc. IEEE 52, 1537 (1964). [doi:10.1109/PROC.1964.3442](https://doi.org/10.1109/PROC.1964.3442)
297. `stapper1973` — C. H. Stapper, "Defect Density Distribution for LSI Yield Calculations," IEEE Trans. Electron Devices 20, 655 (1973). [doi:10.1109/T-ED.1973.17715](https://doi.org/10.1109/T-ED.1973.17715)
298. `cset2020` — S. M. Khan, A. Mann, "AI Chips: What They Are and Why They Matter," Center for Security and Emerging Technology, Appendix D, Table 9 (2020). [link](https://cset.georgetown.edu/wp-content/uploads/AI-Chips%E2%80%94What-They-Are-and-Why-They-Matter-1.pdf)
299. `tsmc_n2_wafer` — Tom's Hardware, "TSMC's 2nm process will reportedly get another price hike: $30,000 per wafer" (N3 ≈ $18,500, reported) (Oct. 2024). [link](https://www.tomshardware.com/tech-industry/tsmcs-2nm-will-reportedly-receive-a-price-hike-once-again-usd30-000-per-wafer)
300. `black1969` — J. R. Black, "Electromigration: A Brief Survey and Some Recent Results," IEEE Trans. Electron Devices 16, 338 (1969). [doi:10.1109/T-ED.1969.16754](https://doi.org/10.1109/T-ED.1969.16754)
301. `blech1976` — I. A. Blech, "Electromigration in Thin Aluminum Films on Titanium Nitride," J. Appl. Phys. 47, 1203 (1976). [doi:10.1063/1.322842](https://doi.org/10.1063/1.322842)
302. `korhonen1993` — M. A. Korhonen, P. Børgesen, K. N. Tu, C.-Y. Li, "Stress Evolution due to Electromigration in Confined Metal Lines," J. Appl. Phys. 73, 3790 (1993). [doi:10.1063/1.354073](https://doi.org/10.1063/1.354073)

## Analog & RF lab

303. `silveira1996` — F. Silveira, D. Flandre, P. G. A. Jespers, "A gm/ID Based Methodology for the Design of CMOS Analog Circuits and Its Application to the Synthesis of a Silicon-on-Insulator Micropower OTA," IEEE J. Solid-State Circuits 31, 1314 (1996). [doi:10.1109/4.535416](https://doi.org/10.1109/4.535416)
304. `razavi2017` — B. Razavi, "Design of Analog CMOS Integrated Circuits," 2nd ed., McGraw-Hill (2017): common-source stage, Miller effect, noise.
305. `miller1920` — J. M. Miller, "Dependence of the Input Impedance of a Three-Electrode Vacuum Tube upon the Load in the Plate Circuit," Scientific Papers of the Bureau of Standards 15, 367 (1920).
306. `vanderziel1986` — A. van der Ziel, "Noise in Solid State Devices and Circuits," Wiley (1986): channel thermal noise, γ = 2/3.
307. `mcwhorter1957` — A. L. McWhorter, "1/f Noise and Germanium Surface Properties," in Semiconductor Surface Physics, Univ. of Pennsylvania Press, 207 (1957).
308. `mei2015` — X. Mei et al., "First Demonstration of Amplification at 1 THz Using 25-nm InP High Electron Mobility Transistor Process," IEEE Electron Device Lett. 36, 327 (2015). [link](https://ieeexplore.ieee.org/document/7047678/)
309. `deal_estf2015` — W. R. Deal et al., "THz InP HEMT Technology for Sub-Millimeter Wave Atmospheric Sensing," NASA Earth Science Technology Forum (2015): fMAX as high as 1.5 THz. [link](https://esto.nasa.gov/forum/estf2015/abstracts/deal.htm)
310. `urteaga2016` — M. Urteaga et al., "THz Bandwidth InP HBT Technologies and Heterogeneous Integration with Si CMOS," IEEE BCTM (2016): 130 nm InP HBT with fT/fmax = 521 GHz / 1.15 THz. [link](https://web.ece.ucsb.edu/Faculty/rodwell/publications_and_presentations/publications/2016_9_BCTM_Urteaga_digest.pdf)
311. `hafez_phbt` — W. Hafez, M. Feng, "Pseudomorphic InP/InGaAs Heterojunction Bipolar Transistors (PHBTs) Experimentally Demonstrating fT = 765 GHz at 25°C Increasing to fT = 845 GHz at −55°C," IEDM Tech. Dig. (2006). [link](https://www.researchgate.net/publication/224697599)
312. `heinemann2016` — B. Heinemann et al., "SiGe HBT with fT/fmax of 505 GHz/720 GHz," IEDM Tech. Dig., 3.1.1 (2016). [link](https://www.semanticscholar.org/paper/8c587860adf01a876a7d6df0acded7582c721e8d)
313. `tang2015` — Y. Tang et al., "Ultrahigh-Speed GaN High-Electron-Mobility Transistors With fT/fmax of 454/444 GHz," IEEE Electron Device Lett. 36, 549 (2015). [link](https://ieeexplore.ieee.org/document/7086311/)
314. `ong2018` — S. N. Ong et al., "A 22nm FDSOI Technology Optimized for RF/mmWave Applications," IEEE RFIC Symp. (2018): nFET fT/fmax = 347/371 GHz. [doi:10.1109/RFIC.2018.8429035](https://doi.org/10.1109/RFIC.2018.8429035)
315. `cryo22fdx` — "Cryogenic RF CMOS on 22nm FDSOI Platform with Record fT = 495 GHz and fMAX = 497 GHz," VLSI Symp. (2021). [link](https://ieeexplore.ieee.org/abstract/document/9508705/)
316. `chm_consumer1952` — Computer History Museum, "1952: Transistorized Consumer Products Appear," The Silicon Engine: the Sonotone hearing aid (1952) and the Regency TR-1 radio (October 1954, four germanium junction transistors). [link](https://www.computerhistory.org/siliconengine/transistorized-consumer-products-appear/)
