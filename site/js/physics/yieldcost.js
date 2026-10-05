// Die yield, cost and a Monte Carlo wafer map. Twin of sim/transistor_sim/physics/yieldcost.py.
export const diesPerWafer = (S, d = 300) => Math.PI * (d / 2) ** 2 / S - Math.PI * d / Math.sqrt(2 * S);
export function yieldModel(S, D0, model = 'negbin', alpha = 3) {
  const AD = S / 100 * D0; if (AD <= 0) return 1;
  if (model === 'poisson') return Math.exp(-AD);
  if (model === 'murphy') return ((1 - Math.exp(-AD)) / AD) ** 2;
  return (1 + AD / alpha) ** (-alpha);
}
export const costPerGoodDie = (wafer, S, D0, model = 'negbin', alpha = 3, d = 300) => wafer / (diesPerWafer(S, d) * yieldModel(S, D0, model, alpha));

export function dieGrid(w, h, d = 300, edge = 3, scribe = 0.1) {
  const R = d / 2 - edge, px = w + scribe, py = h + scribe; let best = null;
  for (const ox of [0, 0.5]) for (const oy of [0, 0.5]) {
    const cells = [], n = Math.floor(R / Math.min(px, py)) + 2;
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
      const cx = (i + ox) * px, cy = (j + oy) * py; let ok = true;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) if (Math.hypot(cx + sx * w / 2, cy + sy * h / 2) > R) ok = false;
      if (ok) cells.push([cx, cy]);
    }
    if (!best || cells.length > best.length) best = cells;
  }
  return best;
}
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gamma(rnd, k) {
  if (k < 1) return gamma(rnd, k + 1) * rnd() ** (1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const u1 = Math.max(rnd(), 1e-12), u2 = rnd();
    const x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2), v = (1 + c * x) ** 3;
    if (v <= 0) continue;
    const u = rnd();
    if (Math.log(Math.max(u, 1e-300)) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
  }
}
function poisson(rnd, lam) { const L = Math.exp(-lam); let k = 0, p = 1; for (;;) { p *= rnd(); if (p <= L) return k; k++; } }

export function simulateWafer(w, h, D0, alpha = 3, seed = 1, d = 300) {
  const rnd = mulberry32(seed), dies = dieGrid(w, h, d), A = w * h / 100;
  const defects = dies.map(() => poisson(rnd, A * D0 * (isFinite(alpha) ? gamma(rnd, alpha) / alpha : 1)));
  const good = defects.filter(c => c === 0).length;
  return { dies, defects, good, yield_: good / Math.max(dies.length, 1) };
}
