// Top-of-barrier ballistic / quasi-ballistic MOSFET — twin of sim/transistor_sim/physics/ballistic.py
const Q = 1.602176634e-19, KB = 1.380649e-23, HBAR = 1.054571817e-34, M0 = 9.1093837015e-31, EPS0 = 8.8541878128e-12;
export const CHANNELS = {
  Si: { m: 0.19, gv: 2, mu: 250, name: 'Silicon (100)' }, InGaAs: { m: 0.043, gv: 1, mu: 3000, name: 'In₀.₅₃Ga₀.₄₇As' },
  Ge: { m: 0.12, gv: 4, mu: 400, name: 'Germanium' }, MoS2: { m: 0.45, gv: 2, mu: 60, name: 'Monolayer MoS₂' },
};
const F0 = e => (e > 35 ? e : Math.log1p(Math.exp(Math.min(e, 35))));
export function Fhalf(eta) {
  if (eta < -30) return Math.exp(eta);
  const n = 2401, scale = eta > 20 ? Math.max(1, (eta + 40) / 60) : 1;
  let s = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const x = 60 * i / (n - 1) * scale, y = Math.sqrt(x) / (1 + Math.exp(Math.min(Math.max(x - eta, -700), 700)));
    if (i) s += 0.5 * (y + prev) * (60 * scale / (n - 1));
    prev = y;
  }
  return s / (Math.sqrt(Math.PI) / 2);
}
export function params({ channel = 'Si', eot = 0.9, L = 18, alphaG = 0.92, alphaD = 0.04, vt0 = 0.25, T = 300, mu = null } = {}) {
  const ch = CHANNELS[channel], kT = KB * T, m = ch.m * M0;
  const N2D = ch.gv * m * kT / (Math.PI * HBAR ** 2), vT = Math.sqrt(2 * kT / (Math.PI * m)), mu_ = mu ?? ch.mu;
  const lam = 2 * (kT / Q) * (mu_ * 1e-4) / vT, CG = 3.9 * EPS0 / (eot * 1e-9);
  return { channel, kT, N2D, vT, lam, CG, Csum: CG / alphaG, alphaG, alphaD, vt0, L: L * 1e-9, mu: mu_ };
}
export function transmission(p, VD, ballistic = false) {
  if (ballistic) return 1;
  const phit = p.kT / Q, ell = p.L * (phit / (phit + Math.max(VD, 0))) ** 0.75;
  return p.lam / (p.lam + ell);
}
export function solve(p, VG, VD, ballistic = false) {
  const kT = p.kT, Tr = transmission(p, VD, ballistic), uD = Q * VD / kT, half = p.N2D / 2;
  const nsOf = eta => half * ((2 - Tr) * F0(eta) + Tr * F0(eta - uD));
  const resid = eta => eta * kT + p.alphaG * Q * (p.vt0 - VG) - p.alphaD * Q * VD + Q * Q * nsOf(eta) / p.Csum;
  let lo = -80, hi = 80;
  for (let k = 0; k < 100; k++) { const mid = 0.5 * (lo + hi); if (resid(mid) > 0) hi = mid; else lo = mid; }
  const eta = 0.5 * (lo + hi), ns = nsOf(eta), I = Q * p.vT * half * Tr * (Fhalf(eta) - Fhalf(eta - uD));
  return { eta, ns, I, T: Tr, Etop_eV: -eta * kT / Q, vinj: ns > 0 ? I / (Q * ns) : 0, I_uA_um: I };
}
