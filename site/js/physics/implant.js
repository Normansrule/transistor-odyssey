// Ion implantation (LSS ranges) and dopant diffusion in silicon. Twin of sim/transistor_sim/physics/implant.py.
const Q = 1.602176634e-19, KB = 8.617333262e-5, N_SI = 4.996e22, Z2 = 14, M2 = 28.086;
export const IONS = {
  B: { Z: 5, M: 11.009, type: 'p', name: 'Boron', D0: 10.5, Ea: 4.28e4 / 11604.5 },
  P: { Z: 15, M: 30.974, type: 'n', name: 'Phosphorus', D0: 10.5, Ea: 4.28e4 / 11604.5 },
  As: { Z: 33, M: 74.922, type: 'n', name: 'Arsenic', D0: 0.058, Ea: 3.83e4 / 11604.5 },
  Sb: { Z: 51, M: 121.76, type: 'n', name: 'Antimony', D0: 3.94, Ea: 4.49e4 / 11604.5 },
};

export function stopping(ion, E) {
  const { Z: Z1, M: M1 } = IONS[ion], a = Z1 ** 0.23 + Z2 ** 0.23;
  const eps = 32.53 * M2 * (E / 1e3) / (Z1 * Z2 * (M1 + M2) * a);
  const sn = Math.log(1 + 1.1383 * eps) / (2 * (eps + 0.01321 * eps ** 0.21226 + 0.19593 * eps ** 0.5));
  const Sn = 8.462e-15 * Z1 * Z2 * M1 * sn / ((M1 + M2) * a);
  const Se = 1.212 * Z1 ** (7 / 6) * Z2 / (Z1 ** (2 / 3) + Z2 ** (2 / 3)) ** 1.5 * Math.sqrt(E / M1) * 1e-16;
  return [Sn, Se];
}
const geom = (a, b, n) => { const la = Math.log(a), lb = Math.log(b); return Array.from({ length: n }, (_, i) => i === 0 ? a : i === n - 1 ? b : Math.exp(la + (lb - la) * i / (n - 1))); };

export function rangeStats(ion, E_keV, n = 1200) {
  const M1 = IONS[ion].M, Es = geom(1, E_keV * 1e3, n);
  const f = Es.map(e => { const [a, b] = stopping(ion, e); return 1 / (N_SI * (a + b)); });
  let R = 0; for (let i = 1; i < n; i++) R += 0.5 * (f[i] + f[i - 1]) * (Es[i] - Es[i - 1]);
  R = R * 1e7 + f[0] * 1e7;
  const Rp = R / (1 + M2 / (3 * M1));
  return { R, Rp, dRp: (2 / 3) * Rp * Math.sqrt(M1 * M2) / (M1 + M2) };
}
export function crossoverKeV(ion) {
  let lo = 1e3, hi = 1e8;
  // first grid point where Se > Sn, then bisect in log space
  const Es = geom(1e3, 1e8, 4001); let k = Es.findIndex(e => { const [a, b] = stopping(ion, e); return b > a; });
  lo = Es[k - 1]; hi = Es[k];
  for (let i = 0; i < 60; i++) { const mid = Math.sqrt(lo * hi), [a, b] = stopping(ion, mid); if (b > a) hi = mid; else lo = mid; }
  return Math.sqrt(lo * hi) / 1e3;
}
export const diffusivity = (ion, T_C) => IONS[ion].D0 * Math.exp(-IONS[ion].Ea / (KB * (T_C + 273.15)));

export function sigmaNm(ion, E_keV, T_C = null, t_s = 0) {
  const r = rangeStats(ion, E_keV);
  return Math.sqrt((r.dRp * 1e-7) ** 2 + (T_C != null && t_s > 0 ? 2 * diffusivity(ion, T_C) * t_s : 0)) * 1e7;
}
/** Concentration (cm⁻³) at depth x (nm). Pass precomputed {Rp, s} via opts.r to avoid recomputing ranges. */
export function profileAt(x, dose, Rp, sNm) { const s = sNm * 1e-7; return dose / (Math.sqrt(2 * Math.PI) * s) * Math.exp(-(((x - Rp) * 1e-7) ** 2) / (2 * s * s)); }
export function mobility(N, carrier) { return carrier === 'n' ? 65 + 1265 / (1 + (N / 8.5e16) ** 0.72) : 47.7 + 447.3 / (1 + (N / 6.3e16) ** 0.76); }

export function junction(ion, E_keV, dose, Nbg, T_C = null, t_s = 0, n = 4000) {
  const r = rangeStats(ion, E_keV), s = sigmaNm(ion, E_keV, T_C, t_s), xmax = r.Rp + 8 * s;
  const x = Array.from({ length: n }, (_, i) => xmax * i / (n - 1)), N = x.map(v => profileAt(v, dose, r.Rp, s));
  const peak = Math.max(...N);
  let k = -1; for (let i = 0; i < n; i++) if (N[i] > Nbg) k = i;
  if (k < 0) return { xj: 0, peak, Rs: Infinity, sigma_nm: s, Rp: r.Rp };
  const xj = k + 1 < n ? x[k] + (x[k + 1] - x[k]) * (N[k] - Nbg) / (N[k] - N[k + 1]) : x[k];
  const g = N.map(v => Q * mobility(v + Nbg, IONS[ion].type) * Math.max(v - Nbg, 0));
  let G = 0; for (let i = 1; i < n; i++) G += 0.5 * (g[i] + g[i - 1]) * (x[i] - x[i - 1]);
  G *= 1e-7;
  return { xj, peak, Rs: G > 0 ? 1 / G : Infinity, sigma_nm: s, Rp: r.Rp };
}
