// 2D Poisson solve of a short-channel MOSFET in subthreshold — twin of poisson2d.py
const EPS0 = 8.8541878128e-12, Q = 1.602176634e-19;
export const KT = 0.025852;

export function build({ L = 20, tsi = 6, tox = 1, tbox = 20, dg = false, epsOx = 3.9, epsSi = 11.7, Na = 1e17, nx = 81, dy = 0.25 } = {}) {
  const layers = [['ox', tox], ['si', tsi], dg ? ['ox', tox] : ['box', tbox]];
  const nyL = layers.map(([, t]) => Math.max(2, Math.round(t / dy)));
  const ny = nyL.reduce((a, b) => a + b, 0) + 1;
  const dx = L / (nx - 1) * 1e-9;
  const edges = [0]; for (const n of nyL) edges.push(edges[edges.length - 1] + n);
  const eps = new Float64Array(nx * ny), isSi = new Uint8Array(ny);
  layers.forEach(([name], li) => { for (let j = edges[li]; j <= edges[li + 1]; j++) for (let i = 0; i < nx; i++) eps[j * nx + i] = (name === 'si' ? epsSi : epsOx) * EPS0; });
  const siRows = []; for (let j = edges[1]; j <= edges[2]; j++) { siRows.push(j); isSi[j] = 1; for (let i = 0; i < nx; i++) eps[j * nx + i] = epsSi * EPS0; }
  const dyArr = new Float64Array(ny - 1);
  layers.forEach(([, t], li) => { for (let j = edges[li]; j < edges[li] + nyL[li]; j++) dyArr[j] = t / nyL[li] * 1e-9; });
  const yNm = new Float64Array(ny); for (let j = 1; j < ny; j++) yNm[j] = yNm[j - 1] + dyArr[j - 1] * 1e9;
  return { L, nx, ny, dx, dy: dyArr, yNm, eps, isSi, siRows, dg, Na, tsi, tox, edges, layers };
}

export function solve(g, { Vgs = 0, Vds = 0.05, Vbi = 0.56, phiMs = -0.35, omega = 1.85, tol = 1e-6, maxIter = 20000, psi0 = null } = {}) {
  const { nx, ny, dx, dy, eps } = g, N = nx * ny;
  const vg = Vgs + phiMs;
  const psi = psi0 ? Float64Array.from(psi0) : new Float64Array(N);
  const fixed = new Uint8Array(N), rho = new Float64Array(N);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (g.isSi[j]) rho[j * nx + i] = -Q * g.Na * 1e6;
  const setFix = (j, i, v) => { fixed[j * nx + i] = 1; psi[j * nx + i] = v; };
  for (let i = 0; i < nx; i++) { setFix(0, i, vg); setFix(ny - 1, i, g.dg ? vg : 0); }
  if (!psi0) for (const j of g.siRows) for (let i = 0; i < nx; i++) psi[j * nx + i] = 0.5 * (Vbi + Vds * i / (nx - 1)) + 0.5 * vg;
  for (const j of g.siRows) { setFix(j, 0, Vbi); setFix(j, nx - 1, Vbi + Vds); }
  // coefficients
  const hm = (a, b) => 2 * a * b / (a + b);
  const aE = new Float64Array(N), aW = new Float64Array(N), aN = new Float64Array(N), aS = new Float64Array(N);
  for (let j = 0; j < ny; j++) {
    const dS = j < ny - 1 ? dy[j] : 0, dN = j > 0 ? dy[j - 1] : 0, dc = 0.5 * (dS + dN);
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i, e = eps[k];
      if (i < nx - 1) aE[k] = hm(e, eps[k + 1]) / (dx * dx);
      if (i > 0) aW[k] = hm(e, eps[k - 1]) / (dx * dx);
      if (i === 0) aE[k] *= 2;
      if (i === nx - 1) aW[k] = hm(e, eps[k - 1]) / (dx * dx) * 2;
      if (j < ny - 1 && dS > 0) aS[k] = hm(e, eps[k + nx]) / (dS * dc);
      if (j > 0 && dN > 0) aN[k] = hm(e, eps[k - nx]) / (dN * dc);
    }
  }
  let it = 0;
  for (; it < maxIter; it++) {
    let maxd = 0;
    for (let color = 0; color < 2; color++) {
      for (let j = 1; j < ny - 1; j++) {
        for (let i = (j + color) & 1; i < nx; i += 2) {
          const k = j * nx + i; if (fixed[k]) continue;
          const pE = i < nx - 1 ? psi[k + 1] : 0, pW = i > 0 ? psi[k - 1] : 0;
          const nw = (aE[k] * pE + aW[k] * pW + aN[k] * psi[k - nx] + aS[k] * psi[k + nx] + rho[k]) / (aE[k] + aW[k] + aN[k] + aS[k]);
          const d = omega * (nw - psi[k]); psi[k] += d;
          const ad = d < 0 ? -d : d; if (ad > maxd) maxd = ad;
        }
      }
    }
    if (maxd < tol) break;
  }
  return { psi, iters: it };
}

export function barrier(g, psi, Vbi = 0.56) {
  let best = -1e9, row = g.siRows[0];
  for (const j of g.siRows) { let mn = 1e9; for (let i = 0; i < g.nx; i++) mn = Math.min(mn, psi[j * g.nx + i]); if (mn > best) { best = mn; row = j; } }
  const ec = new Float64Array(g.nx); for (let i = 0; i < g.nx; i++) ec[i] = -(psi[row * g.nx + i] - Vbi);
  return { Eb: Vbi - best, ec, row };
}

export function offCurrentProxy(g, psi, Vbi = 0.56) {
  let s = 0;
  for (const j of g.siRows) { let mn = 1e9; for (let i = 0; i < g.nx; i++) mn = Math.min(mn, psi[j * g.nx + i]); s += Math.exp(-(Vbi - mn) / KT); }
  return s;
}

export const naturalLength = (tsi, tox, dg = false, epsSi = 11.7, epsOx = 3.9) => Math.sqrt(epsSi * tsi * tox / ((dg ? 2 : 1) * epsOx));
