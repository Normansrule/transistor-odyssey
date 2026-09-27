// Web worker: sweeps gate length and reports DIBL for single- and double-gate
// devices without blocking the page.
import { build, solve, barrier } from '../physics/poisson2d.js';

self.onmessage = e => {
  const { id, tsi, tox, Na, Ls } = e.data;
  const out = { id, sg: [], dg: [] };
  for (const dg of [false, true]) {
    for (const L of Ls) {
      const g = build({ L, tsi, tox, Na, dg });
      const a = solve(g, { Vgs: 0, Vds: 0.05, tol: 1e-5 });
      const b = solve(g, { Vgs: 0, Vds: 0.7, psi0: a.psi, tol: 1e-5 });
      const e1 = barrier(g, a.psi).Eb, e2 = barrier(g, b.psi).Eb;
      (dg ? out.dg : out.sg).push([L, (e1 - e2) / 0.65 * 1000, e2 > 0.02]);
    }
  }
  self.postMessage(out);
};
