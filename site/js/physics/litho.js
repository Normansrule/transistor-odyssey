// Fourier-optics aerial image of a line/space mask — twin of litho.py
export function sourcePoints(kind = 'conventional', sigma = 0.5, sigmaC = 0.7, sigmaW = 0.1, n = 41) {
  if (kind === 'coherent' || (kind === 'conventional' && sigma <= 1e-6)) return [[0], [1]];
  let s = [], w = [];
  if (kind === 'conventional') { for (let i = 0; i < n; i++) { const v = -sigma + 2 * sigma * i / (n - 1); s.push(v); w.push(Math.sqrt(Math.max(1 - (v / sigma) ** 2, 0))); } }
  else { const h = Math.floor(n / 2); const half = Array.from({ length: h }, (_, i) => -sigmaW + 2 * sigmaW * i / (h - 1));
    for (const c of [-sigmaC, sigmaC]) for (const v of half) { s.push(c + v); w.push(Math.sqrt(Math.max(1 - (v / sigmaW) ** 2, 0))); } }
  const tot = w.reduce((a, b) => a + b, 0); return [s, w.map(v => v / tot)];
}

export function aerialImage(pitch, { lam = 193, NA = 1.35, duty = 0.5, kind = 'conventional', sigma = 0.5, sigmaC = 0.7, sigmaW = 0.1, defocus = 0, npts = 256, periods = 2 } = {}) {
  const x = new Float64Array(npts), I = new Float64Array(npts), fc = NA / lam;
  for (let i = 0; i < npts; i++) x[i] = periods * pitch * i / (npts - 1);
  const nmax = Math.ceil(2 * fc * pitch) + 1, orders = [];
  for (let n = -nmax; n <= nmax; n++) orders.push([n / pitch, n === 0 ? duty : Math.sin(Math.PI * n * duty) / (Math.PI * n)]);
  const [s, w] = sourcePoints(kind, sigma, sigmaC, sigmaW);
  for (let k = 0; k < s.length; k++) {
    const fs = s[k] * fc, pass = orders.filter(([f]) => Math.abs(f + fs) <= fc + 1e-12);
    if (!pass.length) continue;
    const ph = pass.map(([f, c]) => { const a = Math.PI * lam * defocus * ((f + fs) ** 2 - fs ** 2); return [c * Math.cos(a), c * Math.sin(a), f]; });
    for (let i = 0; i < npts; i++) {
      let re = 0, im = 0;
      for (const [cr, ci, f] of ph) { const t = 2 * Math.PI * f * x[i], c = Math.cos(t), sn = Math.sin(t); re += cr * c - ci * sn; im += cr * sn + ci * c; }
      I[i] += w[k] * (re * re + im * im);
    }
  }
  return { x, I };
}
export function contrast(I) { let mx = -Infinity, mn = Infinity; for (const v of I) { mx = Math.max(mx, v); mn = Math.min(mn, v); } return (mx - mn) / (mx + mn + 1e-300); }
export function printedCD(x, I, pitch, th = 0.3) { let n = 0, a = 0; for (let i = 0; i < x.length; i++) if (x[i] <= pitch) { n++; if (I[i] > th) a++; } return a / n * pitch; }
export const k1 = (pitch, lam, NA) => pitch / 2 * NA / lam;
