// Quantum wells and the self-consistent AlGaN/GaN 2DEG — twin of qwell.py.
// Eigenstates of the symmetric tridiagonal Hamiltonian come from Sturm-sequence
// bisection (eigenvalues) and inverse iteration (eigenvectors).
const HBAR = 1.054571817e-34, M0 = 9.1093837015e-31, QE = 1.602176634e-19, EPS0 = 8.8541878128e-12, KB_EV = 8.617333262e-5;

export function hamiltonian(V, m, dz) {
  const N = V.length, c = HBAR * HBAR / (2 * M0 * dz * dz) / QE;
  const d = Float64Array.from(V), off = new Float64Array(N - 1);
  for (let i = 0; i < N - 1; i++) { const mh = 2 / (1 / m[i] + 1 / m[i + 1]); off[i] = -c / mh; d[i] += c / mh; d[i + 1] += c / mh; }
  d[0] += c / m[0]; d[N - 1] += c / m[N - 1];
  return [d, off];
}

function sturmCount(d, e, x) { // number of eigenvalues < x
  let q = d[0] - x, k = q < 0 ? 1 : 0;
  for (let i = 1; i < d.length; i++) { q = d[i] - x - e[i - 1] * e[i - 1] / (q === 0 ? 1e-300 : q); if (q < 0) k++; }
  return k;
}
export function thomas(a, b, c, r) {
  const n = b.length, cp = new Float64Array(n), dp = new Float64Array(n), x = new Float64Array(n);
  cp[0] = c[0] / b[0]; dp[0] = r[0] / b[0];
  for (let i = 1; i < n; i++) { const den = b[i] - a[i] * cp[i - 1]; cp[i] = i < n - 1 ? c[i] / den : 0; dp[i] = (r[i] - a[i] * dp[i - 1]) / den; }
  x[n - 1] = dp[n - 1]; for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1];
  return x;
}

export function solveStates(V, m, dz, nstates = 4) {
  const [d, e] = hamiltonian(V, m, dz), N = d.length;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < N; i++) { const r = (i > 0 ? Math.abs(e[i - 1]) : 0) + (i < N - 1 ? Math.abs(e[i]) : 0); lo = Math.min(lo, d[i] - r); hi = Math.max(hi, d[i] + r); }
  const E = [], psi = [];
  for (let k = 0; k < nstates; k++) {
    let a = lo, b = hi;
    for (let it = 0; it < 100; it++) { const mid = 0.5 * (a + b); if (sturmCount(d, e, mid) > k) b = mid; else a = mid; }
    const lam = 0.5 * (a + b); E.push(lam);
    // inverse iteration with a tiny shift
    const sh = lam - 1e-10 * Math.max(1, Math.abs(lam));
    const A = new Float64Array(N), B = new Float64Array(N), Cc = new Float64Array(N);
    for (let i = 0; i < N; i++) { B[i] = d[i] - sh; if (i > 0) A[i] = e[i - 1]; if (i < N - 1) Cc[i] = e[i]; }
    let v = new Float64Array(N).fill(1);
    for (let it = 0; it < 4; it++) {
      v = thomas(A, B, Cc, v);
      let s = 0; for (let i = 0; i < N; i++) s += v[i] * v[i]; s = Math.sqrt(s); for (let i = 0; i < N; i++) v[i] /= s;
    }
    // sign convention: positive where largest; normalise ∫|ψ|² dz = 1
    let im = 0; for (let i = 1; i < N; i++) if (Math.abs(v[i]) > Math.abs(v[im])) im = i;
    const sg = Math.sign(v[im]) / Math.sqrt(dz);
    for (let i = 0; i < N; i++) v[i] *= sg;
    psi.push(v);
  }
  return { E, psi };
}

export function finiteWell(tNm, { V0 = 3.1, mWell = 0.916, mBarrier = 0.5, padNm = 2, dzNm = 0.02, nstates = 3 } = {}) {
  const nPad = Math.round(padNm / dzNm), nW = Math.round(tNm / dzNm), N = 2 * nPad + nW;
  const z = new Float64Array(N), V = new Float64Array(N), m = new Float64Array(N);
  for (let i = 0; i < N; i++) { z[i] = (i - nPad + 0.5) * dzNm; const inside = z[i] >= 0 && z[i] <= tNm; V[i] = inside ? 0 : V0; m[i] = inside ? mWell : mBarrier; }
  return { z, V, ...solveStates(V, m, dzNm * 1e-9, nstates) };
}
export const infiniteWellLevel = (tNm, m = 0.916, n = 1) => (n * Math.PI * HBAR / (tNm * 1e-9)) ** 2 / (2 * m * M0) / QE;

// ---- AlGaN/GaN (constants as in hemt.py, Ambacher 1999/2000)
const lerp = (a, b, x) => a + (b - a) * x;
export function polarizationCharge(x) {
  const a = lerp(3.189, 3.112, x), e31 = lerp(-0.49, -0.60, x), e33 = lerp(0.73, 1.46, x), c13 = lerp(103, 108, x), c33 = lerp(405, 373, x);
  const ppe = 2 * (3.189 - a) / a * (e31 - e33 * c13 / c33), psp = lerp(-0.029, -0.081, x);
  return Math.abs(psp + ppe + 0.029);
}
export const bandgapAlGaN = x => 6.13 * x + 3.42 * (1 - x) - 1.0 * x * (1 - x);
export function alganParams(x) { return { eps: -0.5 * x + 9.5, phiB: 1.3 * x + 0.84, dEc: 0.7 * (bandgapAlGaN(x) - bandgapAlGaN(0)), sigma: polarizationCharge(x) }; }
export function analyticNs(x, dNm) { const p = alganParams(x); return Math.max(p.sigma / QE - EPS0 * p.eps / (QE * dNm * 1e-9) * (p.phiB - p.dEc), 0) * 1e-4; }

export function hemtSP(x = 0.25, dNm = 20, { T = 300, depthNm = 50, dzNm = 0.2, mGaN = 0.2, mAlGaN = null, nstates = 4, iters = 60, Vg = 0, tol = 1e-7 } = {}) {
  if (mAlGaN === null) mAlGaN = 0.2 + 0.2 * x;
  const { eps: epsB, phiB, dEc, sigma } = alganParams(x);
  const N = Math.round(depthNm / dzNm) + 1, dz = dzNm * 1e-9, iface = Math.round(dNm / dzNm);
  const epsr = new Float64Array(N), m = new Float64Array(N), dEcP = new Float64Array(N), z = new Float64Array(N);
  for (let i = 0; i < N; i++) { z[i] = i * dzNm; const b = i < iface; epsr[i] = b ? epsB : 8.9; m[i] = b ? mAlGaN : mGaN; dEcP[i] = b ? dEc : 0; }
  const kT = KB_EV * T, g2d = mGaN * M0 * kT * QE / (Math.PI * HBAR * HBAR);
  const ef = new Float64Array(N - 1); for (let i = 0; i < N - 1; i++) ef[i] = 2 * epsr[i] * epsr[i + 1] / (epsr[i] + epsr[i + 1]) * EPS0;
  const lo = new Float64Array(N), di = new Float64Array(N), up = new Float64Array(N);
  for (let i = 1; i < N; i++) { di[i] += ef[i - 1]; lo[i] = -ef[i - 1]; if (i < N - 1) { di[i] += ef[i]; up[i] = -ef[i]; } }
  const rhoFix = new Float64Array(N); rhoFix[iface] = sigma / dz;
  const phi0 = -(phiB - Vg);
  // initial depletion solution
  { const b = Float64Array.from(di), r = new Float64Array(N), u = Float64Array.from(up), l = Float64Array.from(lo); b[0] = 1; u[0] = 0; r[0] = phi0; for (let i = 1; i < N; i++) r[i] = rhoFix[i] * dz * dz; var phi = thomas(l, b, u, r); }
  let Ec = new Float64Array(N); for (let i = 0; i < N; i++) Ec[i] = dEcP[i] - phi[i];
  let st, it = 0;
  for (; it < iters; it++) {
    st = solveStates(Ec, m, dz, nstates);
    const Ek = Float64Array.from(Ec);
    for (let nw = 0; nw < 30; nw++) {
      const n = new Float64Array(N), dn = new Float64Array(N);
      for (let k = 0; k < nstates; k++) {
        const Ei = st.E[k], ps = st.psi[k];
        for (let i = 0; i < N; i++) {
          const arg = Math.max(-200, Math.min(200, (Ei + (dEcP[i] - phi[i]) - Ek[i]) / kT));
          const p2 = ps[i] * ps[i];
          n[i] += g2d * Math.log1p(Math.exp(-arg)) * p2; dn[i] += g2d / kT * p2 / (1 + Math.exp(arg));
        }
      }
      const F = new Float64Array(N), Jd = new Float64Array(N), Jl = Float64Array.from(lo), Ju = Float64Array.from(up);
      for (let i = 0; i < N; i++) {
        F[i] = di[i] * phi[i] + (i > 0 ? lo[i] * phi[i - 1] : 0) + (i < N - 1 ? up[i] * phi[i + 1] : 0) - dz * dz * (rhoFix[i] - QE * n[i]);
        Jd[i] = di[i] + dz * dz * QE * dn[i];
      }
      F[0] = phi[0] - phi0; Jd[0] = 1; Ju[0] = 0;
      for (let i = 0; i < N; i++) F[i] = -F[i];
      const step = thomas(Jl, Jd, Ju, F);
      let mx = 0; for (let i = 0; i < N; i++) { const s = Math.max(-0.2, Math.min(0.2, step[i])); phi[i] += s; mx = Math.max(mx, Math.abs(step[i])); }
      if (mx < 1e-9) break;
    }
    let change = 0; const EcN = new Float64Array(N);
    for (let i = 0; i < N; i++) { EcN[i] = dEcP[i] - phi[i]; change = Math.max(change, Math.abs(EcN[i] - Ec[i])); }
    Ec = EcN;
    if (change < tol) break;
  }
  st = solveStates(Ec, m, dz, nstates);
  const n = new Float64Array(N); const occ = st.E.map(E => g2d * Math.log1p(Math.exp(-Math.max(-200, Math.min(200, E / kT)))));
  let ns = 0;
  for (let k = 0; k < nstates; k++) for (let i = 0; i < N; i++) n[i] += occ[k] * st.psi[k][i] ** 2;
  for (let i = 0; i < N; i++) ns += n[i] * dz;
  return { z, Ec, E: st.E, psi: st.psi, n: n.map(v => v * 1e-6), ns: ns * 1e-4, iters: it + 1, sigma, phiB, dEc, dNm, x, occ: occ.map(o => o * 1e-4), iface };
}
