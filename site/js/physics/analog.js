// The transistor as an amplifier. Twin of sim/transistor_sim/physics/analog.py.
import { id, cox } from '../model.js';
export const KB = 1.380649e-23, C_OV = 0.25e-15, KF = 1e-25;

const I = (p, vgs, vds, W = 1) => id(p, vgs, vds) * W;

export function smallSignal(p, vgs, vds, W = 1, h = 1e-4) {
  const i = I(p, vgs, vds, W);
  const gm = (I(p, vgs + h, vds, W) - I(p, vgs - h, vds, W)) / (2 * h);
  const gds = (I(p, vgs, vds + h, W) - I(p, vgs, vds - h, W)) / (2 * h);
  const L = p.L_nm * 1e-3, coxA = cox(p) * 1e-12, weff = W * p.W_factor;
  const cgs = 2 / 3 * coxA * weff * L + C_OV * W, cgd = C_OV * W;
  return { I: i, gm, gds, gm_id: i > 0 ? gm / i : 0, A0: gds > 0 ? gm / gds : Infinity, cgs, cgd, fT: gm / (2 * Math.PI * (cgs + cgd)) };
}
export function vgsForCurrent(p, IuA, vds) {
  let lo = -0.5, hi = Math.max(p.VDD * 1.5, 1);
  for (let k = 0; k < 80; k++) { const m = 0.5 * (lo + hi); if (I(p, m, vds) * 1e6 < IuA) lo = m; else hi = m; }
  return 0.5 * (lo + hi);
}
export function csOutput(p, vin, vdd, RLk, W = 1) {
  let lo = 0, hi = vdd; const R = RLk * 1e3;
  for (let k = 0; k < 60; k++) { const m = 0.5 * (lo + hi); if (id(p, vin, m) * W - (vdd - m) / R > 0) hi = m; else lo = m; }
  return 0.5 * (lo + hi);
}
export function biasForMidrail(p, vdd, RLk, W = 1) {
  let lo = 0, hi = vdd;
  for (let k = 0; k < 60; k++) { const m = 0.5 * (lo + hi); if (csOutput(p, m, vdd, RLk, W) > vdd / 2) lo = m; else hi = m; }
  return 0.5 * (lo + hi);
}
export function csStage(p, vdd, RLk, vbias, W = 1) {
  const vout = csOutput(p, vbias, vdd, RLk, W), ss = smallSignal(p, vbias, vout, W), rout = 1 / (ss.gds + 1 / (RLk * 1e3));
  return { vout, gain: -ss.gm * rout, rout, ...ss };
}
export function sineResponse(p, vdd, RLk, vbias, amp, W = 1, n = 256) {
  const vin = new Float64Array(n), vout = new Float64Array(n);
  for (let i = 0; i < n; i++) { vin[i] = vbias + amp * Math.sin(2 * Math.PI * i / n); vout[i] = csOutput(p, vin[i], vdd, RLk, W); }
  let mean = 0; for (const v of vout) mean += v / n;
  const h = [];
  for (let k = 0; k < 10; k++) { let re = 0, im = 0; for (let i = 0; i < n; i++) { const a = -2 * Math.PI * k * i / n; re += (vout[i] - mean) * Math.cos(a); im += (vout[i] - mean) * Math.sin(a); } h.push(Math.hypot(re, im)); }
  let s = 0; for (let k = 2; k < 10; k++) s += h[k] * h[k];
  return { vin, vout, thd: h[1] > 0 ? Math.sqrt(s) / h[1] : 0, h };
}
export function bode(p, vdd, RLk, vbias, RSk = 1, CLfF = 5, W = 1, f = null) {
  const st = csStage(p, vdd, RLk, vbias, W), { gm, cgs, cgd } = st, R = st.rout, RS = RSk * 1e3, CL = CLfF * 1e-15;
  const a = RS * (cgs + cgd * (1 + gm * R)) + R * (cgd + CL), b = RS * R * (cgs * cgd + cgs * CL + cgd * CL);
  const H = fr => { const w = 2 * Math.PI * fr; // (−gm R (1 − jω cgd/gm)) / (1 − b ω² + j a ω)
    const nr = -gm * R, ni = gm * R * w * cgd / gm, dr = 1 - b * w * w, di = a * w, d2 = dr * dr + di * di;
    return [(nr * dr + ni * di) / d2, (ni * dr - nr * di) / d2]; };
  f = f || Array.from({ length: 401 }, (_, i) => 10 ** (3 + 10 * i / 400));
  const mag = [], phase = []; let prev = null, off = 0;
  for (const fr of f) { const [re, im] = H(fr); mag.push(20 * Math.log10(Math.hypot(re, im))); let ph = Math.atan2(im, re); if (prev !== null) { while (ph + off - prev > Math.PI) off -= 2 * Math.PI; while (ph + off - prev < -Math.PI) off += 2 * Math.PI; } prev = ph + off; phase.push(prev * 180 / Math.PI); }
  const A0 = 20 * Math.log10(Math.abs(gm * R));
  let lo = 1, hi = 1e15;
  for (let k = 0; k < 200; k++) { const m = Math.sqrt(lo * hi), [re, im] = H(m); if (20 * Math.log10(Math.hypot(re, im)) > A0 - 3.0103) lo = m; else hi = m; }
  const f3 = Math.sqrt(lo * hi), miller = cgd * (1 + gm * R);
  return { f, mag, phase, A0_dB: A0, f3dB: f3, GBW: Math.abs(gm * R) * f3, a, b, C_miller: miller, p_in: 1 / (2 * Math.PI * RS * (cgs + miller)), gm, rout: R, gain: st.gain, H };
}
const area = (p, W) => W * p.W_factor * p.L_nm * 1e-3 * 1e-12;
export const noisePsd = (p, gm, W, f, gamma = 2 / 3, T = 300, Kf = KF) => 4 * KB * T * gamma / gm + Kf / (cox(p) * area(p, W) * f);
export const noiseCorner = (p, gm, W, gamma = 2 / 3, T = 300, Kf = KF) => Kf * gm / (4 * KB * T * gamma * cox(p) * area(p, W));
export const noiseRms = (p, gm, W, f1, f2, gamma = 2 / 3, T = 300, Kf = KF) => Math.sqrt(4 * KB * T * gamma / gm * (f2 - f1) + Kf / (cox(p) * area(p, W)) * Math.log(f2 / f1));
