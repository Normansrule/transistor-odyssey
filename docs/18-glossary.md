# 18 · Glossary

| Term | Meaning |
|---|---|
| **2DEG / 2DHG** | Two-dimensional electron (hole) gas: a sheet of mobile carriers confined at an interface, e.g. AlGaN/GaN or H-terminated diamond. |
| **Backside power delivery (BSPDN)** | Supplying power through the thinned back of the wafer (Intel PowerVia, TSMC Super Power Rail). |
| **BFOM** | Baliga figure of merit, ε·µ·E_c³; lower conduction loss for a power switch. |
| **BJT** | Bipolar junction transistor; current controlled by base current/voltage. |
| **Blech length** | The line length below which back-stress stops electromigration entirely; (j·L)_crit ≈ 3,000–4,000 A/cm for copper. |
| **CFET** | Complementary FET: pFET stacked directly on nFET. |
| **CMOS** | Complementary metal-oxide-semiconductor logic: n- and p-type MOSFETs in pairs. |
| **Coulomb blockade** | Suppression of current through a tiny island until one extra electron's charging energy is overcome. |
| **CoWoS** | Chip-on-Wafer-on-Substrate: TSMC's 2.5D silicon-interposer packaging. |
| **CPP** | Contacted (poly) gate pitch: distance between neighbouring gates. |
| **Deal–Grove model** | x² + A·x = B·(t + τ): thermal oxide growth, reaction-limited when thin and diffusion-limited when thick. |
| **Defect density (D₀)** | Killer defects per cm² of wafer; with die area it sets the yield. |
| **DIBL** | Drain-induced barrier lowering: V_T falls as V_DS rises; a short-channel effect. |
| **Dummy gate** | Sacrificial polysilicon gate that holds the place of the final metal gate during processing. |
| **Electromigration** | Metal atoms pushed along a wire by the electron wind, eventually opening voids; lifetime follows Black's law, MTTF ∝ j⁻ⁿ·e^(Eₐ/kT). |
| **EOT** | Equivalent oxide thickness: the SiO₂ thickness giving the same capacitance as a high-k stack. |
| **Epitaxy** | Growing a crystal layer that continues the lattice of the crystal underneath. |
| **EUV** | Extreme-ultraviolet lithography at 13.5 nm. |
| **FD-SOI** | Fully depleted silicon-on-insulator: a thin silicon film over buried oxide. |
| **FeFET / NC-FET** | Transistors with a ferroelectric gate layer, used for memory (FeFET) or voltage amplification (negative capacitance). |
| **FinFET** | Transistor whose channel is a vertical fin gated on three sides. |
| **Fowler–Nordheim tunnelling** | Field emission of electrons through a triangular oxide barrier, J = A·E²·exp(−B/E); how flash cells are programmed and erased. |
| **GAA** | Gate-all-around: gate surrounds the channel (nanosheet, nanowire). |
| **Glitch** | A transient wrong value on a logic signal before it settles; it costs switching energy without doing work. |
| **gₘ** | Transconductance, ∂I_D/∂V_GS. |
| **HBM** | High-bandwidth memory: stacked DRAM connected by through-silicon vias. |
| **HEMT** | High-electron-mobility transistor: a heterojunction FET using a 2DEG channel. |
| **HKMG** | High-k dielectric with metal gate. |
| **HVM** | High-volume manufacturing. |
| **Hybrid bonding** | Direct copper-to-copper and oxide-to-oxide bonding of two dies without solder. |
| **I_on / I_off** | Drive current at full gate voltage / leakage with gate off. |
| **IGBT** | Insulated-gate bipolar transistor: MOS-gated, bipolar-conducting power switch. |
| **IGZO** | Amorphous indium–gallium–zinc oxide, a thin-film transistor semiconductor for displays and flexible circuits. |
| **Inner spacer** | Dielectric plug between gate and source/drain in a nanosheet stack. |
| **Ionization energy (dopant)** | Energy to free a carrier from a dopant; 0.045 eV for B in Si, 0.37 eV for B in diamond. |
| **ISPP** | Incremental step pulse programming: raising a flash cell's gate voltage by a fixed step each pulse, with a verify read in between. |
| **Logical effort** | How much more input capacitance a gate needs than an inverter to deliver the same output current; delay d = g·h + p. |
| **MESFET** | Metal-semiconductor (Schottky-gate) FET, common in GaAs. |
| **MMP** | Minimum metal pitch. |
| **MOSFET** | Metal-oxide-semiconductor field-effect transistor. |
| **NA** | Numerical aperture of the lithography lens. |
| **Nanostack** | IBM's 2026 stacked-and-staggered nanosheet architecture (7 Å node). |
| **Node** | A process generation label (e.g. "2 nm"); no longer a physical dimension. |
| **NV centre** | Nitrogen-vacancy defect in diamond with an optically readable spin. |
| **PDK** | Process design kit: device models, rules and cells for a fab process. |
| **Projected range (R_p)** | The mean depth of implanted ions; ΔR_p is its standard deviation (straggle). |
| **Read disturb (SRAM)** | The rise of a cell's 0 node when the access transistor connects it to a precharged bitline during a read. |
| **Sheet resistance (R_s)** | Resistance of a thin layer per square, in Ω/□, set by dose and mobility. |
| **SLC / MLC / TLC / QLC** | One, two, three or four bits per flash cell, stored as 2, 4, 8 or 16 threshold levels. |
| **SNM** | Static noise margin: the largest DC noise an SRAM cell tolerates, the side of the largest square in its butterfly curve. |
| **SS** | Subthreshold swing: gate voltage per decade of current below threshold; ≥ 59.5 mV/dec at 300 K for thermionic devices. |
| **STI** | Shallow-trench isolation between transistors. |
| **Surface transfer doping** | Doping a surface by electron transfer to adsorbed acceptors, as on H-terminated diamond. |
| **Switch-level simulation** | Treating each transistor as an on/off switch and finding which nodes are connected to the supplies; fast enough for whole chips. |
| **TCAD** | Technology computer-aided design: process and device physics simulation. |
| **TFET** | Tunnel FET: switches by band-to-band tunnelling and can beat 60 mV/decade. |
| **TFT** | Thin-film transistor: deposited semiconductor on glass or plastic. |
| **TSV** | Through-silicon via: a vertical copper connection through a thinned die. |
| **V_T** | Threshold voltage. |
| **Yield** | The fraction of dies on a wafer that work. |
| **λ rules** | Mead–Conway scalable design rules in units of λ (half the minimum gate length). |
