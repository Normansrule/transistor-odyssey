// Equilibrium and biased heterojunction band diagram (1D Poisson + Boltzmann, Newton) — twin of hetero.py
export const K_B = 8.617333262e-5, Q = 1.602176634e-19, EPS0 = 8.8541878128e-14;

export function neutral(mat, dop, T = 300) {
  const kT = K_B * T, ni2 = mat.Nc * mat.Nv * Math.exp(-mat.Eg / kT);
  let n = dop >= 0 ? 0.5 * dop + Math.sqrt(0.25 * dop * dop + ni2) : ni2 / (-0.5 * dop + Math.sqrt(0.25 * dop * dop + ni2));
  n = Math.max(n, 1e-300);
  return [n, ni2 / n, kT * Math.log(mat.Nc / n)];
}

export function grid(L, npts = 601, a = 6) {
  const x = new Float64Array(npts), s = Math.sinh(a);
  for (let i = 0; i < npts; i++) { const t = -1 + 2 * i / (npts - 1); x[i] = L * Math.sinh(a * t) / s; }
  x[(npts - 1) / 2] = 0;
  return x;
}

function thomas(a, b, c, d) {
  const n = b.length, cp = new Float64Array(n), dp = new Float64Array(n), out = new Float64Array(n);
  cp[0] = n > 1 ? c[0] / b[0] : 0; dp[0] = d[0] / b[0];
  for (let i = 1; i < n; i++) { const m = b[i] - a[i - 1] * cp[i - 1]; cp[i] = i < n - 1 ? c[i] / m : 0; dp[i] = (d[i] - a[i - 1] * dp[i - 1]) / m; }
  out[n - 1] = dp[n - 1];
  for (let i = n - 2; i >= 0; i--) out[i] = dp[i] - cp[i] * out[i + 1];
  return out;
}
const clipExp = v => Math.exp(Math.min(Math.max(v, -700), 700));

export function solve(A, B, dopA, dopB, V = 0, T = 300, npts = 601, tol = 1e-9, maxIter = 200) {
  const kT = K_B * T;
  let [nA, pA, dA] = neutral(A, dopA, T), [nB, pB, dB] = neutral(B, dopB, T);
  const insA = A.kind === 'insulator', insB = B.kind === 'insulator';
  if (insA || insB) {
    V = 0;
    if (insB) dB = A.chi + dA - B.chi; else dA = B.chi + dB - A.chi;
    nA = A.Nc * Math.exp(-dA / kT); pA = A.Nv * Math.exp(-(A.Eg - dA) / kT);
    nB = B.Nc * Math.exp(-dB / kT); pB = B.Nv * Math.exp(-(B.Eg - dB) / kT);
    if (insA) dopA = nA - pA; if (insB) dopB = nB - pB;
  }
  const EFA = -V, EFB = 0, EFn = nA > nB ? EFA : EFB, EFp = pA > pB ? EFA : EFB;
  const evacA = EFA + dA + A.chi, evacB = EFB + dB + B.chi, Vbi = (A.chi + dA) - (B.chi + dB);
  const U = Math.abs(evacA - evacB) + 0.1;
  const Nmin = Math.max(Math.min(Math.abs(dopA) + Math.sqrt(nA * pA), Math.abs(dopB) + Math.sqrt(nB * pB)), 1e13);
  const epsm = Math.max(A.eps, B.eps) * EPS0;
  const Wg = Math.sqrt(2 * epsm * U / (Q * Nmin)), LD = Math.sqrt(epsm * kT / (Q * Nmin));
  const L = Math.min(Math.max(2.2 * Wg + 8 * LD, 6e-6), 4e-3);
  let ga = 6;
  while (ga < 12 && L * ga / Math.sinh(ga) * 2 / (npts - 1) > 3e-8) ga += 0.25;
  const x = grid(L, npts, ga), N = npts;
  const P = k => Float64Array.from(x, v => (v < 0 ? A[k] : B[k]));
  const chi = P('chi'), Eg = P('Eg'), Nc = P('Nc'), Nv = P('Nv'), eps = Float64Array.from(P('eps'), v => v * EPS0);
  const dop = Float64Array.from(x, v => (v < 0 ? dopA : dopB));
  const h = new Float64Array(N - 1), em = new Float64Array(N - 1);
  for (let i = 0; i < N - 1; i++) { h[i] = x[i + 1] - x[i]; em[i] = 0.5 * (eps[i] + eps[i + 1]); }
  const E = Float64Array.from(x, v => evacB + (evacA - evacB) * 0.5 * (1 - Math.tanh(v / Math.max(Wg, 1e-7))));
  E[0] = evacA; E[N - 1] = evacB;
  const m = N - 2, lower = new Float64Array(m), upper = new Float64Array(m), diag = new Float64Array(m), rhs = new Float64Array(m);
  const n = new Float64Array(N), p = new Float64Array(N);
  let it = 0;
  for (; it < maxIter; it++) {
    for (let i = 0; i < N; i++) { const ec = E[i] - chi[i]; n[i] = Nc[i] * clipExp((EFn - ec) / kT); p[i] = Nv[i] * clipExp((ec - Eg[i] - EFp) / kT); }
    for (let j = 0; j < m; j++) {
      const i = j + 1, hc = 0.5 * (h[i - 1] + h[i]);
      const fl = em[i - 1] * (E[i] - E[i - 1]) / h[i - 1], fr = em[i] * (E[i + 1] - E[i]) / h[i];
      rhs[j] = -((fr - fl) / hc - Q * (p[i] - n[i] + dop[i]));
      lower[j] = em[i - 1] / h[i - 1] / hc; upper[j] = em[i] / h[i] / hc;
      diag[j] = -(lower[j] + upper[j]) - Q * (n[i] + p[i]) / kT;
    }
    const dE = thomas(lower.subarray(1), diag, upper.subarray(0, m - 1), rhs);
    let mx = 0;
    for (let j = 0; j < m; j++) { const d = dE[j]; mx = Math.max(mx, Math.abs(d)); E[j + 1] += Math.min(Math.max(d, -0.25), 0.25); }
    if (mx < tol) break;
  }
  const Ec = new Float64Array(N), Ev = new Float64Array(N), rho = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    Ec[i] = E[i] - chi[i]; Ev[i] = Ec[i] - Eg[i];
    n[i] = Nc[i] * clipExp((EFn - Ec[i]) / kT); p[i] = Nv[i] * clipExp((Ev[i] - EFp) / kT);
    rho[i] = Q * (p[i] - n[i] + dop[i]);
  }
  const i0 = (N - 1) / 2;
  const VA = E[i0] - E[0], VB = E[N - 1] - E[i0];
  const edge = (from, to, bulk, Vs) => {
    if (Math.abs(Vs) <= 1e-4) return 0;
    let far = -1;
    for (let i = from; i < to; i++) if (Math.abs(E[i] - bulk) > 0.1 * Math.abs(Vs) + 1e-6) far = Math.max(far, Math.abs(x[i]));
    return far < 0 ? 0 : far / (1 - Math.sqrt(0.1));
  };
  const wA = edge(0, i0, evacA, VA), wB = edge(i0, N, evacB, VB);
  let ns = 0, ps = 0;
  for (let i = 0; i < N; i++) {
    if (Math.abs(x[i]) >= 3e-6) continue;
    const w = i === 0 ? x[1] - x[0] : i === N - 1 ? x[N - 1] - x[N - 2] : 0.5 * (x[i + 1] - x[i - 1]);
    ns += Math.max(n[i] - (x[i] < 0 ? nA : nB), 0) * w; ps += Math.max(p[i] - (x[i] < 0 ? pA : pB), 0) * w;
  }
  return {
    x_nm: Float64Array.from(x, v => v * 1e7), Ec, Ev, Evac: E, EFA, EFB, EFn, EFp, n, p, rho,
    Vbi, VA, VB, W_nm: (wA + wB) * 1e7, wA_nm: wA * 1e7, wB_nm: wB * 1e7, ns, ps, iters: it + 1,
    dEc: A.chi - B.chi, dEv: (A.chi + A.Eg) - (B.chi + B.Eg), i0,
  };
}
