// On-chip wires: size-effect resistivity, capacitance, RC delay — twin of sim/transistor_sim/physics/interconnect.py
const EPS0 = 8.8541878128e-12;
export const METALS = {
  Cu: { rho0: 1.68, lam: 39.9, barrier: 2.0, name: 'Copper' }, Co: { rho0: 5.6, lam: 11.8, barrier: 0.3, name: 'Cobalt' },
  Ru: { rho0: 7.1, lam: 6.6, barrier: 0.3, name: 'Ruthenium' }, W: { rho0: 5.3, lam: 15.5, barrier: 0.3, name: 'Tungsten' },
};
const C_FS = 1.2, P_SPEC = 0, R_GB = 0.4;
export function resistivity(metal, w, h) {
  const m = METALS[metal], D = Math.min(w, h), a = m.lam / D * R_GB / (1 - R_GB);
  const ms = 1 - 1.5 * a + 3 * a * a - 3 * a ** 3 * Math.log(1 + 1 / a);
  return m.rho0 / ms + m.rho0 * 0.375 * C_FS * (1 - P_SPEC) * m.lam * (1 / w + 1 / h);
}
export function rPerUm(metal, w, h, barrier = null) {
  const t = barrier ?? METALS[metal].barrier, wc = Math.max(w - 2 * t, 0.5), hc = Math.max(h - t, 0.5);
  return resistivity(metal, wc, hc) * 1e-8 / (wc * hc * 1e-18) * 1e-6;
}
export const cPerUm = (w, h, s, k = 2.7) => EPS0 * k * (2 * h / s + 2 * w / h + 1.8) * 1e-6;
export const elmoreDelay = (r, c, L, Rd, CL) => 0.69 * Rd * (c * L + CL) + 0.38 * r * c * L * L + 0.69 * r * L * CL;
export function repeatedDelay(r, c, L, Rd, Cd) {
  const k = Math.max(1, Math.round(Math.sqrt(0.38 * r * c * L * L / (0.69 * Rd * Cd))));
  return [k * elmoreDelay(r, c, L / k, Rd, Cd), k];
}
/** Crank–Nicolson RC line stepper (tridiagonal). Returns { x, step(dt) -> V } with V a Float64Array. */
export function lineSim(r, c, L, Rd, CL, nx = 101) {
  const dx = L / (nx - 1), Cn = new Float64Array(nx).fill(c * dx); Cn[0] *= 0.5; Cn[nx - 1] = 0.5 * c * dx + CL;
  const G = 1 / (r * dx), V = new Float64Array(nx), x = Float64Array.from({ length: nx }, (_, i) => i * dx);
  const Kd = new Float64Array(nx), Ko = -G; for (let i = 0; i < nx; i++) Kd[i] = (i === 0 || i === nx - 1 ? G : 2 * G); Kd[0] += 1 / Rd;
  let src = 1;
  const step = (dt, n = 1) => {
    for (let s = 0; s < n; s++) {
      const a = new Float64Array(nx), b = new Float64Array(nx), cc = new Float64Array(nx), d = new Float64Array(nx);
      for (let i = 0; i < nx; i++) {
        b[i] = Cn[i] / dt + 0.5 * Kd[i]; a[i] = i > 0 ? 0.5 * Ko : 0; cc[i] = i < nx - 1 ? 0.5 * Ko : 0;
        let rhs = (Cn[i] / dt - 0.5 * Kd[i]) * V[i];
        if (i > 0) rhs -= 0.5 * Ko * V[i - 1]; if (i < nx - 1) rhs -= 0.5 * Ko * V[i + 1];
        d[i] = rhs + (i === 0 ? src / Rd : 0);
      }
      for (let i = 1; i < nx; i++) { const m = a[i] / b[i - 1]; b[i] -= m * cc[i - 1]; d[i] -= m * d[i - 1]; }
      V[nx - 1] = d[nx - 1] / b[nx - 1];
      for (let i = nx - 2; i >= 0; i--) V[i] = (d[i] - cc[i] * V[i + 1]) / b[i];
    }
    return V;
  };
  return { x, V, step, setSource(v) { src = v; } };
}
