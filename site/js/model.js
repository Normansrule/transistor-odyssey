// JavaScript twin of sim/transistor_sim/mosfet.py — keep the two in sync.
const Q = 1.602176634e-19, KB = 1.380649e-23, EPS0 = 8.8541878128e-12;
export const PHIT = KB * 300 / Q;

export function cox(p) { return 3.9 * EPS0 / ((p.EOT_nm + (p.dT_inv_nm ?? 0.4)) * 1e-9); }

export function id(p, vgs, vds) {
  vds = Math.max(vds, 0);
  const L = p.L_nm * 1e-9;
  const vt = p.VT0 - p.eta * vds;
  const x = (vgs - vt) / (p.n * PHIT);
  const vgt = p.n * PHIT * (x > 30 ? x : Math.log1p(Math.exp(Math.min(x, 30))));
  const mu = p.mu0 * 1e-4 / (1 + p.theta * vgt);
  const esatL = 2 * (p.vsat * 1e-2) / mu * L;
  const vdsat = esatL * vgt / (esatL + vgt) + 2 * PHIT;
  const d = 0.02, a = vdsat - vds - d;
  const vde = vdsat - 0.5 * (a + Math.sqrt(a * a + 4 * d * vdsat));
  const W = 1e-6 * p.W_factor;
  let i = (mu * cox(p) * W / L) * (vgt - 0.5 * vde * vgt / (vgt + 2 * PHIT)) * vde;
  i = i / (1 + vde / esatL);
  i = i * (1 + p.lam * (vds - vde));
  if (p.Rs_ohm_um > 0) { const r = p.Rs_ohm_um / p.W_factor; i = i / (1 + i * r / (vgt + 2 * PHIT)); }
  return i; // A per µm of footprint
}

export function metrics(p) {
  const ion = id(p, p.VDD, p.VDD), ioff = id(p, 0, p.VDD);
  const v1 = p.VT0 - 0.3, v2 = p.VT0 - 0.2;
  const ss = (v2 - v1) / Math.log10(id(p, v2, 0.05) / id(p, v1, 0.05)) * 1e3;
  let gm = 0; const N = 400;
  for (let k = 1; k < N; k++) { const a = p.VDD * (k - 1) / N, b = p.VDD * k / N; gm = Math.max(gm, (id(p, b, p.VDD) - id(p, a, p.VDD)) / (b - a)); }
  return { ion, ioff, ss, gm };
}
