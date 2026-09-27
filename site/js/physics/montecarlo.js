// Ensemble Monte Carlo of electron drift in silicon — twin of montecarlo.py.
// Same rates and calibration; the UI runs it live and draws each electron.
const QE = 1.602176634e-19, M0 = 9.1093837015e-31, KB = 1.380649e-23;
export const HW = 0.063, MSTAR = 0.26, C_AC = 9.5e12, C_OP = 4.0e13, ALPHA = 0.5;

const dosf = (E, a) => { E = Math.max(E, 0); return Math.sqrt(E * (1 + a * E)) * (1 + 2 * a * E); };
export function rates(E, T = 300, cac = C_AC, cop = C_OP, a = ALPHA) {
  const N = 1 / Math.expm1(HW / (KB * T / QE));
  return [cac * (T / 300) * dosf(E, a), cop * N * dosf(E + HW, a), E > HW ? cop * (N + 1) * dosf(E - HW, a) : 0];
}
export const caugheyThomas = (F, mu0 = 1417, vsat = 1.07e7, beta = 1.1) => mu0 * F / (1 + (mu0 * F / vsat) ** beta) ** (1 / beta);

// small seeded RNG so runs are repeatable
export function rng(seed = 1) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export class Ensemble {
  constructor(n = 600, T = 300, seed = 7) {
    this.n = n; this.T = T; this.r = rng(seed); this.m = MSTAR * M0;
    this.p = new Float64Array(n * 3); this.E = new Float64Array(n); this.last = new Int8Array(n).fill(-1);
    const s = Math.sqrt(this.m * KB * T);
    for (let i = 0; i < 3 * n; i++) this.p[i] = gauss(this.r) * s;
    this.Emax = 1.0;
    this.G0 = rates(this.Emax, T).reduce((a, b) => a + b, 0) * 1.05;
    this.dt = 0.1 / this.G0; this.pScat = 1 - Math.exp(-this.G0 * this.dt);
    this.counts = [0, 0, 0]; this.t = 0;
    this.updateE();
  }
  updateE() { const { p, m, n } = this; for (let i = 0; i < n; i++) { const g = (p[3 * i] ** 2 + p[3 * i + 1] ** 2 + p[3 * i + 2] ** 2) / (2 * m) / QE; this.E[i] = (Math.sqrt(1 + 4 * ALPHA * g) - 1) / (2 * ALPHA); } }
  vx(i) { return this.p[3 * i] / (this.m * (1 + 2 * ALPHA * this.E[i])); }
  vy(i) { return this.p[3 * i + 1] / (this.m * (1 + 2 * ALPHA * this.E[i])); }
  /** advance one step at field F (V/cm); returns mean drift velocity (cm/s, along -field) */
  step(F) {
    const { p, n, r, m } = this, dp = -QE * F * 100 * this.dt;
    let sv = 0;
    for (let i = 0; i < n; i++) {
      p[3 * i] += dp;
      const g = (p[3 * i] ** 2 + p[3 * i + 1] ** 2 + p[3 * i + 2] ** 2) / (2 * m) / QE;
      let E = (Math.sqrt(1 + 4 * ALPHA * g) - 1) / (2 * ALPHA);
      this.last[i] = -1;
      if (r() < this.pScat) {
        const [ac, ab, em] = rates(Math.min(E, this.Emax), this.T), x = r() * this.G0;
        let kind = -1;
        if (x < ac) kind = 0; else if (x < ac + ab) { kind = 1; E += HW; } else if (x < ac + ab + em) { kind = 2; E -= HW; }
        if (kind >= 0) {
          E = Math.max(E, 1e-6);
          const pm = Math.sqrt(2 * m * E * (1 + ALPHA * E) * QE), ct = 2 * r() - 1, st = Math.sqrt(1 - ct * ct), ph = 2 * Math.PI * r();
          p[3 * i] = pm * ct; p[3 * i + 1] = pm * st * Math.cos(ph); p[3 * i + 2] = pm * st * Math.sin(ph);
          this.last[i] = kind; this.counts[kind]++;
        }
      }
      this.E[i] = E;
      sv += -p[3 * i] / (m * (1 + 2 * ALPHA * E));
    }
    this.t += this.dt;
    return sv / n * 100;
  }
  meanE() { let s = 0; for (let i = 0; i < this.n; i++) s += this.E[i]; return s / this.n; }
}

/** Steady-state drift velocity (cm/s) — for tests and the v(F) sweep. */
export function simulate(F, { n = 1500, tPs = 3, seed = 3 } = {}) {
  const ens = new Ensemble(n, 300, seed), steps = Math.floor(tPs * 1e-12 / ens.dt);
  let s = 0, c = 0;
  for (let k = 0; k < steps; k++) { const v = ens.step(F); if (k > steps / 2) { s += v; c++; } }
  return s / c;
}
