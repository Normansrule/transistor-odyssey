// Brews charge-sheet MOSFET — twin of chargesheet.py
import { K_B, intrinsicDensity } from './carriers.js';
import { EPS0, Q } from './junction.js';

export function params({ Na = 3e17, toxNm = 2, Vfb = -0.7, mu = 300, Wum = 1, Lum = 1, T = 300, kox = 3.9 } = {}) {
  const eps_s = 11.7 * EPS0, Cox = kox * EPS0 / (toxNm * 1e-7), ni = intrinsicDensity('Si', T), phit = K_B * T;
  const phiF = phit * Math.log(Na / ni), gamma = Math.sqrt(2 * Q * eps_s * Na) / Cox;
  return { Na, Cox, phit, phiF, gamma, Vfb, mu, W: Wum * 1e-4, L: Lum * 1e-4, eps_s, Vt: Vfb + 2 * phiF + gamma * Math.sqrt(2 * phiF) };
}
export function surfacePotential(Vgb, V, p) {
  const vg = Vgb - p.Vfb; if (vg <= 0) return 0;
  const f = ps => (vg - ps) - p.gamma * Math.sqrt(ps + p.phit * Math.exp(Math.min((ps - 2 * p.phiF - V) / p.phit, 700)));
  let lo = 0, hi = vg;
  for (let i = 0; i < 80; i++) { const m = 0.5 * (lo + hi); if (f(m) > 0) lo = m; else hi = m; }
  return 0.5 * (lo + hi);
}
const G = (ps, vg, p) => vg * ps - 0.5 * ps * ps - (2 / 3) * p.gamma * ps ** 1.5 + p.phit * (ps + p.gamma * Math.sqrt(ps));
export function drainCurrent(Vgs, Vds, p, Vsb = 0) {
  const Vgb = Vgs + Vsb, vg = Vgb - p.Vfb;
  const ps0 = surfacePotential(Vgb, Vsb, p), psL = surfacePotential(Vgb, Vsb + Vds, p);
  return p.W / p.L * p.mu * p.Cox * (G(psL, vg, p) - G(ps0, vg, p));
}
export const inversionCharge = (ps, vg, p) => Math.max(p.Cox * (vg - ps) - p.Cox * p.gamma * Math.sqrt(Math.max(ps, 0)), 0);
export function channelProfile(Vgs, Vds, p, n = 101) {
  const vg = Vgs - p.Vfb, ps0 = surfacePotential(Vgs, 0, p), psL = surfacePotential(Vgs, Vds, p);
  const G0 = G(ps0, vg, p), GL = G(psL, vg, p);
  const y = new Float64Array(n), psi = new Float64Array(n), V = new Float64Array(n), Qi = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), target = G0 + t * (GL - G0);
    let lo = Math.min(ps0, psL), hi = Math.max(ps0, psL);
    for (let k = 0; k < 60; k++) { const m = 0.5 * (lo + hi); if (G(m, vg, p) < target) lo = m; else hi = m; }
    const ps = 0.5 * (lo + hi), r = ((vg - ps) / p.gamma) ** 2 - ps;
    y[i] = t; psi[i] = ps;
    V[i] = Math.min(Math.max(r > 0 ? ps - 2 * p.phiF - p.phit * Math.log(Math.max(r, 1e-300) / p.phit) : Vds, 0), Vds);
    Qi[i] = inversionCharge(ps, vg, p);
  }
  return { y, psi, V, Qi };
}
export function swing(p, Vds = 0.05) { const v1 = p.Vt - 0.35, v2 = v1 + 0.05; return 0.05 / Math.log10(drainCurrent(v2, Vds, p) / drainCurrent(v1, Vds, p)) * 1000; }
