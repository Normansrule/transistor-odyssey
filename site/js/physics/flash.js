// Floating-gate flash: Fowler–Nordheim programming, ISPP and multi-level threshold
// distributions. Twin of sim/transistor_sim/physics/flash.py.
const Q = 1.602176634e-19, H = 6.62607015e-34, M0 = 9.1093837015e-31, EPS_OX = 3.9 * 8.8541878128e-12;
export const DEFAULT = { t_ox_nm: 8, alpha: 0.6, phi_b: 3.1, m_ox: 0.42 };
export const ERASED_SIGMA = 0.45;

export function fnCoeffs(phiB = 3.1, mOx = 0.42) {
  const A = Q ** 3 / (8 * Math.PI * H * phiB * Q) / mOx;
  const B = 8 * Math.PI * Math.sqrt(2 * mOx * M0) * (phiB * Q) ** 1.5 / (3 * Q * H);
  return { A, B };
}

export function fnCurrent(E, phiB = 3.1, mOx = 0.42) {
  const { A, B } = fnCoeffs(phiB, mOx), a = Math.abs(E);
  return a > 1e6 ? Math.sign(E) * A * a * a * Math.exp(-B / a) : 0;
}

export function rate(dvt, vcg, c = DEFAULT) {
  const t = c.t_ox_nm * 1e-9, E = c.alpha * (vcg - dvt) / t;
  return fnCurrent(E, c.phi_b, c.m_ox) * t * (1 - c.alpha) / (c.alpha * EPS_OX);
}

/** Threshold shift after one pulse, integrating dt = d(dVT) / rate in 1 mV steps. */
export function pulse(dvt0, vcg, width, c = DEFAULT, dv = 1e-3) {
  const dir = vcg > dvt0 ? 1 : -1;
  let t = 0, v = dvt0; const ts = [0], vs = [dvt0];
  for (let k = 0; k < 200000; k++) {
    const r = Math.abs(rate(v + dir * dv / 2, vcg, c));
    if (r <= 0) break;
    const dt = dv / r;
    if (t + dt >= width) { v += dir * dv * (width - t) / dt; t = width; ts.push(t); vs.push(v); break; }
    t += dt; v += dir * dv; ts.push(t); vs.push(v);
  }
  return { v, ts, vs };
}

export function ispp(target, { start = 14, step = 0.5, width = 10e-6, vt0 = -2, vtNeutral = 0, c = DEFAULT, maxPulses = 400 } = {}) {
  let dvt = vt0 - vtNeutral; const vcg = [], vt = [];
  for (let k = 0; k < maxPulses; k++) {
    const g = start + k * step;
    dvt = pulse(dvt, g, width, c).v;
    vcg.push(g); vt.push(vtNeutral + dvt);
    if (vtNeutral + dvt >= target) break;
  }
  return { vcg, vt, pulses: vt.length };
}

export function levels(bits, { window = [-2.5, 4.5], step = 0.5, sigma = 0.04 } = {}) {
  const n = 2 ** bits, [lo, hi] = window, first = 0;
  const spacing = n > 2 ? (hi - first) / (n - 2) : 0;
  const centres = [lo]; if (n > 2) for (let i = 0; i < n - 1; i++) centres.push(first + i * spacing); else centres.push(1.0);
  const width = step + 6 * sigma;
  const gapErased = (centres[1] - width / 2) - (lo + 3 * ERASED_SIGMA);
  const margin = n > 2 ? Math.min(spacing - width, gapErased) : gapErased;
  const reads = []; for (let i = 0; i < n - 1; i++) reads.push((centres[i] + centres[i + 1]) / 2);
  reads[0] = 0.5 * ((lo + 3 * ERASED_SIGMA) + (centres[1] - width / 2));
  return { n, centres, spacing, width, margin, reads };
}

// Abramowitz–Stegun 7.1.26 erf (|error| < 1.5e-7): plenty for drawing distributions
function erf(x) {
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
export function distribution(x, centre, step, sigma, erased = false) {
  if (erased) return Math.exp(-0.5 * ((x - centre) / ERASED_SIGMA) ** 2);
  const a = centre - step / 2, b = centre + step / 2;
  return 0.5 * (erf((x - a) / (Math.SQRT2 * sigma)) - erf((x - b) / (Math.SQRT2 * sigma)));
}
