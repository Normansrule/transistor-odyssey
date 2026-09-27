// 1D transfer-matrix tunnelling — twin of tunnel.py. Complex numbers as [re, im].
const HBAR = 1.054571817e-34, M0 = 9.1093837015e-31, QE = 1.602176634e-19;
const c = (re, im = 0) => [re, im];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const div = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const cexp = z => { const e = Math.exp(z[0]); return [e * Math.cos(z[1]), e * Math.sin(z[1])]; };
const scale = (a, s) => [a[0] * s, a[1] * s];
const abs2 = a => a[0] * a[0] + a[1] * a[1];
const I = [0, 1];

function kOf(E, V, m) { const v = 2 * m * M0 * (E - V) * QE; const s = Math.sqrt(Math.abs(v)) / HBAR; return v >= 0 ? c(Math.max(s, 1e-3)) : c(0, s); }

/** Transmission through slabs of potential V (eV) and width w (nm); leads at 0 eV. */
export function transfer(E, V, widthsNm, m = null, mOut = 1.0) {
  const pots = [0, ...V, 0];
  const mass = [mOut, ...(m || V.map(() => mOut)), mOut];
  const ks = pots.map((v, j) => kOf(E, v, mass[j]));
  const xs = [0]; for (const w of widthsNm) xs.push(xs[xs.length - 1] + w * 1e-9);
  let M = [[c(1), c(0)], [c(0), c(1)]];
  let det = c(1);
  const mats = [];
  for (let j = 0; j < pots.length - 1; j++) {
    const x = xs[j], k1 = ks[j], k2 = ks[j + 1];
    const r = div(scale(k1, 1 / mass[j]), scale(k2, 1 / mass[j + 1]));
    const onePr = add(c(1), r), oneMr = sub(c(1), r);
    const e1 = cexp(mul(I, scale(sub(k1, k2), x)));
    const e2 = cexp(mul(I, scale(add(k1, k2), -x)));
    const e3 = cexp(mul(I, scale(add(k1, k2), x)));
    const e4 = cexp(mul(I, scale(sub(k1, k2), -x)));
    const D = [[scale(mul(onePr, e1), 0.5), scale(mul(oneMr, e2), 0.5)], [scale(mul(oneMr, e3), 0.5), scale(mul(onePr, e4), 0.5)]];
    mats.push(D);
    det = mul(det, r);
    M = [[add(mul(D[0][0], M[0][0]), mul(D[0][1], M[1][0])), add(mul(D[0][0], M[0][1]), mul(D[0][1], M[1][1]))],
         [add(mul(D[1][0], M[0][0]), mul(D[1][1], M[1][0])), add(mul(D[1][0], M[0][1]), mul(D[1][1], M[1][1]))]];
  }
  const B0 = scale(div(M[1][0], M[1][1]), -1);
  const coeffs = [[c(1), B0]];
  for (const D of mats) { const [A, B] = coeffs[coeffs.length - 1]; coeffs.push([add(mul(D[0][0], A), mul(D[0][1], B)), add(mul(D[1][0], A), mul(D[1][1], B))]); }
  const t = div(det, M[1][1]);
  const kin = ks[0][0] / mass[0], kout = ks[ks.length - 1][0] / mass[mass.length - 1];
  const T = kout / kin * abs2(t);
  return { T, ks, xs, coeffs, pots };
}

export function rectAnalytic(E, V0, aNm, m = 1) {
  const a = aNm * 1e-9;
  if (E < V0) { const kap = Math.sqrt(2 * m * M0 * (V0 - E) * QE) / HBAR; return 1 / (1 + V0 ** 2 * Math.sinh(kap * a) ** 2 / (4 * E * (V0 - E))); }
  const k = Math.sqrt(2 * m * M0 * (E - V0) * QE) / HBAR; return 1 / (1 + V0 ** 2 * Math.sin(k * a) ** 2 / (4 * E * (E - V0)));
}

/** Complex psi on a grid of x (nm). Returns {re, im} Float64Arrays. */
export function wavefunction(res, xNm) {
  const n = xNm.length, re = new Float64Array(n), im = new Float64Array(n);
  const xs = res.xs;
  for (let i = 0; i < n; i++) {
    const x = xNm[i] * 1e-9;
    let j = 0; while (j < xs.length && x >= xs[j]) j++;
    const [A, B] = res.coeffs[j], k = res.ks[j];
    const ikx = mul(I, scale(k, x));
    const v = add(mul(A, cexp(ikx)), mul(B, cexp(scale(ikx, -1))));
    re[i] = v[0]; im[i] = v[1];
  }
  return { re, im };
}

export const DIELECTRICS = {
  SiO2: { phiB: 3.1, m: 0.50, k: 3.9, label: 'SiO₂' },
  Si3N4: { phiB: 2.1, m: 0.50, k: 7.5, label: 'Si₃N₄' },
  Al2O3: { phiB: 2.8, m: 0.35, k: 9.0, label: 'Al₂O₃' },
  HfO2: { phiB: 1.5, m: 0.20, k: 25.0, label: 'HfO₂' },
};

export function stackTransmission(eotNm, diel = 'HfO2', ilNm = 0, Vox = 1.0, E = 0.0259, nslab = 80) {
  const d = DIELECTRICS[diel], il = Math.min(ilNm, eotNm), tHk = (eotNm - il) * d.k / 3.9;
  const layers = [];
  if (il > 0) layers.push([il, DIELECTRICS.SiO2.phiB, DIELECTRICS.SiO2.m, il / eotNm]);
  if (tHk > 0) layers.push([tHk, d.phiB, d.m, (eotNm - il) / eotNm]);
  const tot = layers.reduce((s, l) => s + l[0], 0);
  const V = [], W = [], M = [];
  let drop = 0;
  for (const [t, phiB, m, share] of layers) {
    const n = Math.max(4, Math.floor(nslab * t / tot));
    for (let i = 0; i < n; i++) { const f = (i + 0.5) / n; V.push(phiB - drop - Vox * share * f); W.push(t / n); M.push(m); }
    drop += Vox * share;
  }
  return transfer(E, V, W, M, 0.26).T;
}
