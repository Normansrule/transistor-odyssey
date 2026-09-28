// Kronig–Penney band structure — twin of bandstructure.py
export const HBAR = 1.054571817e-34, M0 = 9.1093837015e-31, QE = 1.602176634e-19;

export function rhs(E, V0, aNm, bNm, m = 1) {
  const a = aNm * 1e-9, b = bNm * 1e-9, mm = m * M0;
  let e = Math.max(E, 1e-9);
  const al = Math.sqrt(2 * mm * e * QE) / HBAR;
  if (V0 <= 0 || b <= 0) return Math.cos(al * (a + b));
  if (Math.abs(e - V0) < 1e-9) e = V0 + 1e-9;
  if (e < V0) {
    const be = Math.sqrt(2 * mm * (V0 - e) * QE) / HBAR;
    return Math.cos(al * a) * Math.cosh(be * b) + (be * be - al * al) / (2 * al * be) * Math.sin(al * a) * Math.sinh(be * b);
  }
  const ga = Math.sqrt(2 * mm * (e - V0) * QE) / HBAR;
  return Math.cos(al * a) * Math.cos(ga * b) - (al * al + ga * ga) / (2 * al * ga) * Math.sin(al * a) * Math.sin(ga * b);
}

export const freeZoneEnergy = (dNm, m = 1) => (HBAR * Math.PI / (dNm * 1e-9)) ** 2 / (2 * m * M0) / QE;

function edge(E0, E1, V0, a, b, m) { // E0 outside, E1 inside
  let x0 = E0, x1 = E1;
  for (let i = 0; i < 60; i++) { const xm = 0.5 * (x0 + x1); if (Math.abs(rhs(xm, V0, a, b, m)) <= 1) x1 = xm; else x0 = xm; }
  return 0.5 * (x0 + x1);
}

export function bands(V0, aNm, bNm, m = 1, Emax = null, n = 4000) {
  const d = aNm + bNm;
  if (Emax === null) Emax = Math.max(3 * V0, 4 * freeZoneEnergy(d, m));
  const E = new Float64Array(n), f = new Float64Array(n), kd = new Float64Array(n);
  for (let i = 0; i < n; i++) { E[i] = 1e-6 + (Emax - 1e-6) * i / (n - 1); f[i] = rhs(E[i], V0, aNm, bNm, m); kd[i] = Math.abs(f[i]) <= 1 ? Math.acos(Math.max(-1, Math.min(1, f[i]))) / Math.PI : NaN; }
  const edges = []; let start = -1;
  for (let i = 0; i < n; i++) {
    const ok = Math.abs(f[i]) <= 1;
    if (ok && start < 0) start = i;
    if ((!ok || i === n - 1) && start >= 0) {
      const end = ok ? i : i - 1;
      const lo = start > 0 ? edge(E[start - 1], E[start], V0, aNm, bNm, m) : E[start];
      const hi = end < n - 1 ? edge(E[end + 1], E[end], V0, aNm, bNm, m) : E[end];
      edges.push([lo, hi]); start = -1;
    }
  }
  return { E, f, kd, edges, dNm: d, Emax };
}

export function gaps(V0, aNm, bNm, m = 1) { const ed = bands(V0, aNm, bNm, m).edges; return ed.slice(0, -1).map((e, i) => [e[1], ed[i + 1][0]]); }
export const nfeFirstGap = (V0, aNm, bNm) => 2 * Math.abs(V0 * Math.sin(Math.PI * bNm / (aNm + bNm)) / Math.PI);

export function effectiveMass(V0, aNm, bNm, m = 1) {
  const E0 = bands(V0, aNm, bNm, m).edges[0][0], h = 1e-5;
  const fp = (rhs(E0 + h, V0, aNm, bNm, m) - rhs(E0, V0, aNm, bNm, m)) / (h * QE);
  const d = (aNm + bNm) * 1e-9;
  return [HBAR * HBAR * Math.abs(fp) / (d * d) / M0, E0];
}
