// MOS capacitor on p-type silicon — twin of moscap.py
import { K_B, MATERIALS, intrinsicDensity } from './carriers.js';
import { Q, EPS0 } from './junction.js';

export function params({ Na = 1e17, toxNm = 5, T = 300, Vfb = -0.9, mat = 'Si', kox = 3.9 } = {}) {
  const eps_s = MATERIALS[mat].eps * EPS0, ni = intrinsicDensity(mat, T), kT = K_B * T;
  return { eps_s, ni, kT, p0: Na, n0: ni * ni / Na, phiB: kT * Math.log(Na / ni), Cox: kox * EPS0 / (toxNm * 1e-7),
    LD: Math.sqrt(eps_s * kT / (Q * Na)), Vfb, Na, toxNm, kox };
}
export function F(psi, p) {
  const x = psi / p.kT;
  const t = (Math.exp(-x) + x - 1) + (p.n0 / p.p0) * (Math.exp(x) - x - 1);
  return Math.sqrt(Math.max(t, 0));
}
export const Qs = (psi, p) => -Math.sign(psi) * Math.sqrt(2 * p.eps_s * Q * p.kT * p.p0) * F(psi, p);
function QsMaj(psi, p) { const x = psi / p.kT; return -Math.sign(psi) * Math.sqrt(2 * p.eps_s * Q * p.kT * p.p0) * Math.sqrt(Math.max(Math.exp(-x) + x - 1, 0)); }
export const gateVoltage = (psi, p) => p.Vfb + psi - Qs(psi, p) / p.Cox;
export const threshold = p => p.Vfb + 2 * p.phiB + Math.sqrt(4 * p.eps_s * Q * p.Na * p.phiB) / p.Cox;

/** Surface potential for a gate voltage (bisection; Vg(psi) is monotonic). */
export function surfacePotential(Vg, p) {
  let lo = -1.2, hi = 2 * p.phiB + 0.6;
  for (let i = 0; i < 80; i++) { const m = 0.5 * (lo + hi); (gateVoltage(m, p) > Vg ? (hi = m) : (lo = m)); }
  return 0.5 * (lo + hi);
}

export function capacitance(psi, p, hf = false) {
  const h = 1e-5;
  let Cs;
  if (!hf) Cs = Math.abs(-(Qs(psi + h, p) - Qs(psi - h, p)) / (2 * h));
  else { const ps = Math.min(psi, 2 * p.phiB); Cs = Math.abs(-(QsMaj(ps + h, p) - QsMaj(ps - h, p)) / (2 * h)); }
  Cs += 1e-30;
  return 1 / (1 / p.Cox + 1 / Cs) / p.Cox;
}

export function bandBending(psiS, p, depthNm, npts = 240) {
  if (!depthNm) { const W = Math.sqrt(2 * p.eps_s * Math.max(Math.abs(psiS), 0.05) / (Q * p.Na)); depthNm = 1.8 * W * 1e7; }
  const dx = depthNm * 1e-7 / (npts - 1), k = Math.SQRT2 * p.kT / p.LD;
  const f = y => -Math.sign(y) * k * F(y, p);
  const psi = new Float64Array(npts); psi[0] = psiS;
  for (let i = 1; i < npts; i++) {
    const y = psi[i - 1];
    const k1 = f(y), k2 = f(y + 0.5 * dx * k1), k3 = f(y + 0.5 * dx * k2), k4 = f(y + dx * k3);
    let yn = y + dx * (k1 + 2 * k2 + 2 * k3 + k4) / 6;
    if (psiS !== 0 && Math.sign(yn) !== Math.sign(psiS)) yn = 0;
    psi[i] = yn;
  }
  return { depthNm, dxNm: depthNm / (npts - 1), psi };
}
