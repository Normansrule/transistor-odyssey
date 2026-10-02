// Abrupt pn junction (depletion approximation) — twin of junction.py
import { K_B, MATERIALS, intrinsicDensity } from './carriers.js';
export const Q = 1.602176634e-19;
export const EPS0 = 8.8541878128e-14; // F/cm

export function mobilitySi(N, carrier = 'n') {
  const [mn, mx, Nr, al] = carrier === 'n' ? [68.5, 1414, 9.2e16, 0.711] : [44.9, 470.5, 2.23e17, 0.719];
  return mn + (mx - mn) / (1 + (N / Nr) ** al);
}

export function solve(Na, Nd, V = 0, T = 300, mat = 'Si') {
  const eps = MATERIALS[mat].eps * EPS0, ni = intrinsicDensity(mat, T), kT = K_B * T;
  const Vbi = kT * Math.log(Na * Nd / (ni * ni));
  const vj = Math.max(Vbi - V, 1e-3);
  const W = Math.sqrt(2 * eps * vj / Q * (Na + Nd) / (Na * Nd));
  const xn = W * Na / (Na + Nd), xp = W * Nd / (Na + Nd);
  const Emax = Q * Nd * xn / eps;
  const psi = x => x < -xp ? 0 : x <= 0 ? Q * Na * (x + xp) ** 2 / (2 * eps) : x <= xn ? vj - Q * Nd * (xn - x) ** 2 / (2 * eps) : vj;
  const field = x => (x >= -xp && x <= 0) ? -Emax * (x + xp) / xp : (x > 0 && x <= xn) ? -Emax * (xn - x) / xn : 0;
  const rho = x => (x >= -xp && x <= 0) ? -Q * Na : (x > 0 && x <= xn) ? Q * Nd : 0;
  return { Vbi, vj, W_um: W * 1e4, xn_um: xn * 1e4, xp_um: xp * 1e4, Emax, ni, psi, field, rho, W, xn, xp };
}

export function saturationCurrent(Na, Nd, T = 300, tn = 1e-6, tp = 1e-6) {
  const ni = intrinsicDensity('Si', T), kT = K_B * T;
  const Dn = mobilitySi(Na, 'n') * kT, Dp = mobilitySi(Nd, 'p') * kT;
  return Q * ni * ni * (Dn / (Math.sqrt(Dn * tn) * Na) + Dp / (Math.sqrt(Dp * tp) * Nd));
}

export function diodeCurrent(V, Na, Nd, T = 300, n = 1, area = 1e-4) {
  return saturationCurrent(Na, Nd, T) * area * Math.expm1(Math.min(V, 1.2) / (n * K_B * T));
}
