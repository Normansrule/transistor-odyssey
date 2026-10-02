// CMOS inverter from the compact MOSFET model — twin of sim/transistor_sim/physics/inverter.py
import { id, cox } from '../model.js';
export const C_PAR_FF = 0.6;

export const gateCapFF = p => cox(p) * p.L_nm * 1e-9 * 1e-6 * p.W_factor * 1e15;
export const loadCapFF = (p, fanout = 4, beta = 1) => fanout * gateCapFF(p) * (1 + beta) + C_PAR_FF;

export function vtc(p, vdd = p.VDD, beta = 1, n = 201) {
  const vin = new Float64Array(n), vout = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = vdd * i / (n - 1); let lo = 0, hi = vdd;
    for (let k = 0; k < 60; k++) { const mid = 0.5 * (lo + hi); if (id(p, v, mid) - beta * id(p, vdd - v, vdd - mid) > 0) hi = mid; else lo = mid; }
    vin[i] = v; vout[i] = 0.5 * (lo + hi);
  }
  return { vin, vout };
}

const trap = (ys, xs) => { let s = 0; for (let i = 1; i < xs.length; i++) s += 0.5 * (ys[i] + ys[i - 1]) * (xs[i] - xs[i - 1]); return s; };

export function stepDelay(p, vdd, beta, CL, falling = true, n = 400) {
  const V = [], inv = [];
  for (let i = 0; i < n; i++) {
    const v = falling ? vdd / 2 + (vdd / 2) * i / (n - 1) : (vdd / 2) * i / (n - 1);
    const I = falling ? id(p, vdd, v) - beta * id(p, 0, vdd - v) : beta * id(p, vdd, vdd - v) - id(p, 0, v);
    V.push(v); inv.push(1 / Math.max(I, 1e-15));
  }
  return CL * trap(inv, V);
}

export function metrics(p, vdd = p.VDD, beta = 1, fanout = 4, stages = 11) {
  const { vin, vout } = vtc(p, vdd, beta, 401), n = vin.length;
  const g = Array.from(vin, (_, i) => i === 0 ? (vout[1] - vout[0]) / (vin[1] - vin[0]) : i === n - 1 ? (vout[n - 1] - vout[n - 2]) / (vin[n - 1] - vin[n - 2]) : (vout[i + 1] - vout[i - 1]) / (vin[i + 1] - vin[i - 1]));
  let VM = vdd / 2;
  for (let i = 1; i < n; i++) { const a = vout[i - 1] - vin[i - 1], b = vout[i] - vin[i]; if (a >= 0 && b < 0) { VM = vin[i - 1] + (vin[i] - vin[i - 1]) * a / (a - b); break; } }
  const unity = g.map((v, i) => (v <= -1 ? i : -1)).filter(i => i >= 0);
  const VIL = unity.length ? vin[unity[0]] : VM, VIH = unity.length ? vin[unity[unity.length - 1]] : VM;
  const VOL = vout[n - 1], VOH = vout[0];
  const CL = loadCapFF(p, fanout, beta) * 1e-15;
  const tphl = stepDelay(p, vdd, beta, CL, true), tplh = stepDelay(p, vdd, beta, CL, false), tp = 0.5 * (tphl + tplh);
  const ioff = 0.5 * (id(p, 0, vdd) + beta * id(p, 0, vdd));
  return { VM, VIL, VIH, VOL, VOH, NML: VIL - VOL, NMH: VOH - VIH, gain: -Math.min(...g), CL_fF: CL * 1e15,
    tpHL_ps: tphl * 1e12, tpLH_ps: tplh * 1e12, tp_ps: tp * 1e12, E_fJ: CL * vdd * vdd * 1e15, f_ring_GHz: 1e-9 / (2 * stages * tp), Pleak_nW: ioff * vdd * 1e9, vin, vout };
}

/** Output voltage vs time after an input step: falling (input rises) or rising (input falls). */
export function waveform(p, vdd = p.VDD, beta = 1, fanout = 4, falling = true, n = 200) {
  const CL = loadCapFF(p, fanout, beta) * 1e-15, V = [], t = [0];
  for (let i = 0; i < n; i++) V.push(falling ? vdd - (vdd * 0.98) * i / (n - 1) : 0.02 * vdd + (vdd * 0.96) * i / (n - 1));
  const I = V.map(v => Math.max(falling ? id(p, vdd, v) - beta * id(p, 0, vdd - v) : beta * id(p, vdd, vdd - v) - id(p, 0, v), 1e-15));
  for (let i = 1; i < n; i++) t.push(t[i - 1] + CL * 0.5 * (1 / I[i] + 1 / I[i - 1]) * Math.abs(V[i] - V[i - 1]));
  return { t, V };
}
