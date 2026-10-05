// Electromigration in a Cu line: Korhonen stress model, Blech length, Black's law.
// Twin of sim/transistor_sim/physics/electromigration.py.
const KB_EV = 8.617333262e-5, KB = 1.380649e-23, QE = 1.602176634e-19;
export const CU = { Ea: 0.9, D0: 1e-8, B: 28e9, Omega: 1.18e-29, Zstar: 5.0, sigma_c: 300e6, rho20: 1.72e-8, alpha_T: 0.0039 };
export const resistivity = (T_C, p = CU) => p.rho20 * (1 + p.alpha_T * (T_C - 20));
export function kappa(T_C, p = CU) { const T = T_C + 273.15; return p.D0 * Math.exp(-p.Ea / (KB_EV * T)) * p.B * p.Omega / (KB * T); }
export const G = (j, T_C, p = CU) => QE * p.Zstar * resistivity(T_C, p) * j * 1e10 / p.Omega;
export const blechProduct = (T_C = 105, p = CU) => 2 * p.Omega * p.sigma_c / (QE * p.Zstar * resistivity(T_C, p)) / 100;
export const blechLengthUm = (j, T_C = 105, p = CU) => blechProduct(T_C, p) / (j * 1e6) * 1e4;
export const tNucleationLong = (j, T_C, p = CU) => Math.PI / kappa(T_C, p) * (p.sigma_c / (2 * G(j, T_C, p))) ** 2;
export const blackRatio = (j1, T1, j2, T2, n = 2, Ea = CU.Ea) => (j1 / j2) ** n * Math.exp(Ea / KB_EV * (1 / (T2 + 273.15) - 1 / (T1 + 273.15)));

export class Line {
  constructor(L_um, j, T_C, nx = 81, p = CU) {
    Object.assign(this, { L: L_um * 1e-6, nx, p, k: kappa(T_C, p), G: G(j, T_C, p), t: 0 });
    this.dx = this.L / nx; this.x = Float64Array.from({ length: nx }, (_, i) => (i + 0.5) * this.dx);
    this.sigma = new Float64Array(nx); this.cp = new Float64Array(nx); this.dp = new Float64Array(nx);
  }
  step(dt, n = 1) {
    const { nx } = this, r = this.k * dt / this.dx ** 2, s0 = this.k * this.G * dt / this.dx, cp = this.cp, dp = this.dp, x = this.sigma;
    for (let it = 0; it < n; it++) {
      // tridiagonal: a = c = -r, b = 1 + 2r (1 + r at the ends); rhs = σ + source at the ends
      const b = i => (i === 0 || i === nx - 1) ? 1 + r : 1 + 2 * r, d = i => x[i] + (i === 0 ? s0 : i === nx - 1 ? -s0 : 0);
      cp[0] = -r / b(0); dp[0] = d(0) / b(0);
      for (let i = 1; i < nx; i++) { const m = b(i) + r * cp[i - 1]; cp[i] = i < nx - 1 ? -r / m : 0; dp[i] = (d(i) + r * dp[i - 1]) / m; }
      x[nx - 1] = dp[nx - 1];
      for (let i = nx - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1];
      this.t += dt;
    }
    return x;
  }
  cathode() { return this.sigma[0] + this.G * this.dx / 2; }
  steady() { return Array.from(this.x, v => this.G * (this.L / 2 - v)); }
}
export function gridCells(L_um, j, T_C, p = CU) { const ell = Math.sqrt(kappa(T_C, p) * tNucleationLong(j, T_C, p)); return Math.trunc(Math.min(Math.max(Math.ceil(L_um * 1e-6 / (ell / 10)), 81), 1201)); }
export function timeToFail(L_um, j, T_C, p = CU, nx = null, maxSteps = 6000) {
  if (G(j, T_C, p) * L_um * 1e-6 / 2 < p.sigma_c) return Infinity;
  const line = new Line(L_um, j, T_C, nx ?? gridCells(L_um, j, T_C, p), p);
  const dt = Math.min(tNucleationLong(j, T_C, p), line.L ** 2 / line.k) / 400;
  let ps = 0, pt = 0;
  for (let s = 0; s < maxSteps; s++) {
    line.step(dt); const s1 = line.cathode();
    if (s1 >= p.sigma_c) return pt + dt * (p.sigma_c - ps) / (s1 - ps);
    ps = s1; pt = line.t;
  }
  return Infinity;
}
