"""Teaching-grade semiconductor physics solvers.

Each module is small, documented and tested against a textbook closed form.
The site's Physics Lab (site/physics.html) runs JavaScript twins of the same
equations in the browser; tests/test_semiphysics.py pins both to the same
reference numbers.

Modules
-------
carriers   Band gap vs temperature, intrinsic density, Fermi level, n and p.
junction   Abrupt pn junction in the depletion approximation, diode I-V.
moscap     MOS capacitor: exact surface charge, band bending, C-V curves.
tunnel     1D transfer-matrix tunnelling and gate-oxide leakage.
poisson2d  2D Poisson solve of a short-channel MOSFET (DIBL, single vs double gate).
montecarlo Ensemble Monte Carlo of electron drift in silicon (mobility, saturation).
crystal    Atom positions for diamond, zincblende, wurtzite and MoS2 lattices.
bandstructure  Kronig–Penney bands, gaps and effective mass of a 1D crystal.
qwell      Quantum wells: nanosheet confinement, self-consistent AlGaN/GaN 2DEG.
chargesheet    Brews charge-sheet MOSFET: I–V from the exact surface potential.
thermal    2D heat spreading under a hot spot on Si, SiC, diamond or sapphire.
litho      Fourier-optics aerial image of a line/space mask (Abbe imaging).
logic      Static CMOS gates, switch-level simulation, logical effort, ripple and prefix adders.
sram       Six-transistor SRAM: butterfly curves, static noise margin, read disturb.
flash      Floating-gate flash: Fowler-Nordheim programming, ISPP, multi-level cells.
"""

