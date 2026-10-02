// Carrier statistics — JavaScript twin of sim/transistor_sim/physics/carriers.py
export const K_B = 8.617333262e-5; // eV/K
export const MATERIALS = {
  'Si':      { Eg0: 1.170, a: 4.73e-4, b: 636, Nc: 3.2e19, Nv: 1.8e19, eps: 11.7, chi: 4.05 },
  'Ge':      { Eg0: 0.7437, a: 4.774e-4, b: 235, Nc: 1.04e19, Nv: 6.0e18, eps: 16.0, chi: 4.0 },
  'GaAs':    { Eg0: 1.519, a: 5.405e-4, b: 204, Nc: 4.7e17, Nv: 9.0e18, eps: 12.9, chi: 4.07 },
  'GaN':     { Eg0: 3.47, a: 7.7e-4, b: 600, Nc: 2.3e18, Nv: 4.6e19, eps: 8.9, chi: 4.1 },
  '4H-SiC':  { Eg0: 3.265, a: 6.5e-4, b: 1300, Nc: 1.7e19, Nv: 2.5e19, eps: 9.7, chi: 3.7 },
  'Diamond': { Eg0: 5.47, a: 0.0, b: 1.0, Nc: 1.0e20, Nv: 1.8e19, eps: 5.7, chi: 0.0 },
};

export const bandGap = (mat, T = 300) => { const m = MATERIALS[mat]; return m.Eg0 - m.a * T * T / (T + m.b); };
export const dos = (mat, T = 300) => { const m = MATERIALS[mat], s = (T / 300) ** 1.5; return [m.Nc * s, m.Nv * s]; };
export function intrinsicDensity(mat, T = 300) {
  const [Nc, Nv] = dos(mat, T);
  return Math.sqrt(Nc * Nv) * Math.exp(-bandGap(mat, T) / (2 * K_B * T));
}
export function intrinsicLevel(mat, T = 300) { const [Nc, Nv] = dos(mat, T); return 0.5 * K_B * T * Math.log(Nv / Nc); }

export function equilibrium(mat, T = 300, Nd = 0, Na = 0) {
  const ni = intrinsicDensity(mat, T), h = 0.5 * (Nd - Na);
  let n, p;
  if (h >= 0) { n = h + Math.sqrt(h * h + ni * ni); p = ni * ni / n; }
  else { p = -h + Math.sqrt(h * h + ni * ni); n = ni * ni / p; }
  const kT = K_B * T, Eg = bandGap(mat, T);
  const Ei = Eg / 2 + intrinsicLevel(mat, T);
  const EF = Ei + kT * Math.log(n / ni);
  return { ni, n, p, Eg, Ei, EF, kT };
}

export const occupancy = (E, EF, T = 300) => 0.5 * (1 - Math.tanh(0.5 * (E - EF) / (K_B * T)));
