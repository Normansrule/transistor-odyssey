// 2D heat spreading under a hot spot — twin of thermal.py (direct block-tridiagonal solve).
export const K = { GaN: 130, Si: 150, SiC: 490, Diamond: 1800, Sapphire: 35, SiO2: 1.4, Cu: 400 };

export function graded(total, fine, nFine, n) {
  if (fine * nFine >= total) return Array.from({ length: n + 1 }, (_, i) => total * i / n);
  const x = [0]; for (let i = 0; i < nFine; i++) x.push(x[x.length - 1] + fine);
  const rem = total - x[x.length - 1], m = n - nFine;
  if (m <= 0 || rem <= 0) return x;
  let lo = 1 + 1e-9, hi = 2, r = 1;
  for (let i = 0; i < 100; i++) { r = 0.5 * (lo + hi); const s = fine * r * (r ** m - 1) / (r - 1); if (s < rem) lo = r; else hi = r; }
  let h = fine; for (let i = 0; i < m; i++) { h *= r; x.push(x[x.length - 1] + h); }
  x[x.length - 1] = total; return x;
}

export function build({ substrate = 'SiC', tSubUm = 100, tActUm = 2, wUm = 1, halfWidthUm = 150, tbr = 0, active = 'GaN', nx = 70, nyAct = 24, nySub = 46 } = {}) {
  const x = graded(halfWidthUm * 1e-6, wUm * 1e-6 / 8, 8, nx);
  const ys = []; for (let i = 0; i <= nyAct; i++) ys.push(tActUm * 1e-6 * i / nyAct);
  const tT = 0.02e-6; if (tbr > 0) ys.push(ys[ys.length - 1] + tT);
  const ySub = graded(tSubUm * 1e-6, (ys[1] - ys[0]) * 2, 4, nySub), base = ys[ys.length - 1];
  for (let i = 1; i < ySub.length; i++) ys.push(base + ySub[i]);
  const kc = []; for (let i = 0; i < ys.length - 1; i++) {
    const yc = 0.5 * (ys[i] + ys[i + 1]);
    let k = yc < tActUm * 1e-6 ? K[active] : K[substrate];
    if (tbr > 0 && yc > tActUm * 1e-6 && yc < tActUm * 1e-6 + tT) k = tT / (tbr * 1e-9);
    kc.push(k);
  }
  return { x, y: ys, kc, w: wUm * 1e-6, tAct: tActUm * 1e-6, substrate, tbr };
}

/** Dense Gaussian elimination solving M X = B (M n×n, B n×k), in place. */
function gauss(M, B, n, k) {
  for (let c = 0; c < n; c++) {
    const piv = M[c * n + c];
    for (let r = c + 1; r < n; r++) {
      const f = M[r * n + c] / piv; if (f === 0) continue;
      for (let j = c; j < n; j++) M[r * n + j] -= f * M[c * n + j];
      for (let j = 0; j < k; j++) B[r * k + j] -= f * B[c * k + j];
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    for (let j = 0; j < k; j++) { let s = B[r * k + j]; for (let c = r + 1; c < n; c++) s -= M[r * n + c] * B[c * k + j]; B[r * k + j] = s / M[r * n + r]; }
  }
  return B;
}

export function solve(g, P = 5, Tsink = 300) {
  const { x, y, kc } = g, nx = x.length, ny = y.length, flux = P * 1e3 / g.w;
  const dx = x.slice(1).map((v, i) => v - x[i]), dy = y.slice(1).map((v, i) => v - y[i]);
  const wx = x.map((_, i) => i === 0 ? dx[0] / 2 : i === nx - 1 ? dx[nx - 2] / 2 : 0.5 * (dx[i - 1] + dx[i]));
  const kx = y.map((_, j) => j === 0 ? kc[0] * dy[0] / 2 : j === ny - 1 ? kc[ny - 2] * dy[ny - 2] / 2 : (kc[j - 1] * dy[j - 1] + kc[j] * dy[j]) / 2);
  const gv = kc.map((k, j) => k / dy[j]);
  const E = dx.map(d => { const e = kx.map(v => v / d); e[ny - 1] = 0; return e; });
  const Eraw = dx.map(d => kx.map(v => v / d));
  const Cp = [], dp = [];
  for (let i = 0; i < nx; i++) {
    const xl = i === 0 ? 0 : 0.5 * (x[i - 1] + x[i]), xr = i === nx - 1 ? x[nx - 1] : 0.5 * (x[i] + x[i + 1]);
    const heat = Math.max(Math.min(xr, g.w / 2) - xl, 0);
    const M = new Float64Array(ny * ny), rhs = new Float64Array(ny);
    for (let j = 0; j < ny - 1; j++) { const c = gv[j] * wx[i]; M[j * ny + j] += c; M[(j + 1) * ny + j + 1] += c; M[j * ny + j + 1] -= c; M[(j + 1) * ny + j] -= c; }
    for (let j = 0; j < ny; j++) { if (i > 0) M[j * ny + j] += Eraw[i - 1][j]; if (i < nx - 1) M[j * ny + j] += Eraw[i][j]; }
    rhs[0] = flux * heat;
    for (let j = 0; j < ny; j++) M[(ny - 1) * ny + j] = 0; M[(ny - 1) * ny + ny - 1] = 1; rhs[ny - 1] = Tsink;
    if (i > 0) { // M -= L_i Cp_{i-1}, r -= L_i dp_{i-1}, with L_i = −E_{i−1}
      const L = E[i - 1], C = Cp[i - 1], d = dp[i - 1];
      for (let j = 0; j < ny; j++) { if (!L[j]) continue; for (let c = 0; c < ny; c++) M[j * ny + c] += L[j] * C[j * ny + c]; rhs[j] += L[j] * d[j]; }
    }
    const k = ny + 1, B = new Float64Array(ny * k);
    for (let j = 0; j < ny; j++) { if (i < nx - 1) B[j * k + j] = -E[i][j]; B[j * k + ny] = rhs[j]; }
    gauss(M, B, ny, k);
    const C = new Float64Array(ny * ny), d = new Float64Array(ny);
    for (let j = 0; j < ny; j++) { for (let c = 0; c < ny; c++) C[j * ny + c] = B[j * k + c]; d[j] = B[j * k + ny]; }
    Cp.push(C); dp.push(d);
  }
  const T = Array.from({ length: nx }, () => new Float64Array(ny));
  T[nx - 1].set(dp[nx - 1]);
  for (let i = nx - 2; i >= 0; i--) for (let j = 0; j < ny; j++) { let s = dp[i][j]; for (let c = 0; c < ny; c++) s -= Cp[i][j * ny + c] * T[i + 1][c]; T[i][j] = s; }
  return T; // T[i][j]: column i (x), row j (y)
}

export function peakRise(substrate = 'SiC', P = 5, opts = {}) {
  const g = build({ substrate, ...opts }), T = solve(g, P);
  let mx = -Infinity; for (const col of T) for (const v of col) mx = Math.max(mx, v);
  return { rise: mx - 300, g, T };
}
