// 6T SRAM cell: butterfly curves, static noise margin, read disturb and read current.
// Twin of sim/transistor_sim/physics/sram.py.
import { id } from '../model.js';

export const BETA = { '1999_180nm': 0.5, '2007_45nm_hkmg': 0.6, '2011_22nm_finfet': 0.8, '2025_2nm_gaa': 0.9, '2026_mos2_2d': 0.5 };

/** Inverter curve inside the cell; read adds the access nFET to a bitline at VDD; dvt shifts this half's nFETs. */
export function vtc(p, vdd, cr = 2, pr = 1, beta = 0.8, read = false, n = 241, dvt = 0) {
  const pn = dvt ? { ...p, VT0: p.VT0 + dvt } : p;
  const vin = new Float64Array(n), vout = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = vdd * i / (n - 1); let lo = 0, hi = vdd;
    for (let k = 0; k < 60; k++) {
      const mid = 0.5 * (lo + hi);
      let f = cr * id(pn, v, mid) - beta * pr * id(p, vdd - v, vdd - mid);
      if (read) f -= id(pn, vdd - mid, vdd - mid);
      if (f > 0) hi = mid; else lo = mid;
    }
    vin[i] = v; vout[i] = 0.5 * (lo + hi);
  }
  return { vin, vout };
}

function interp(x, xs, ys) {
  if (x <= xs[0]) return ys[0];
  const n = xs.length; if (x >= xs[n - 1]) return ys[n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
  return ys[lo] + (ys[hi] - ys[lo]) * (x - xs[lo]) / (xs[hi] - xs[lo]);
}

/** Seevinck SNM from two inverter curves (second defaults to the first). Returns {snm, lobes, u, gap}. */
export function snm(c1, c2 = c1) {
  const s = Math.SQRT2, n1 = c1.vin.length, n2 = c2.vin.length;
  const u1 = new Float64Array(n1), v1 = new Float64Array(n1);
  for (let i = 0; i < n1; i++) { u1[i] = (c1.vin[i] - c1.vout[i]) / s; v1[i] = (c1.vin[i] + c1.vout[i]) / s; }
  const pts = []; for (let i = 0; i < n2; i++) pts.push([(c2.vout[i] - c2.vin[i]) / s, (c2.vout[i] + c2.vin[i]) / s]);
  pts.sort((a, b) => a[0] - b[0]);   // stable, like numpy argsort on distinct keys
  const u2 = pts.map(q => q[0]), v2 = pts.map(q => q[1]);
  const lo = Math.max(u1[0], u2[0]), hi = Math.min(u1[n1 - 1], u2[n2 - 1]), N = 801;
  const u = new Float64Array(N), gap = new Float64Array(N);
  let a = 0, b = 0;
  for (let i = 0; i < N; i++) {
    u[i] = lo + (hi - lo) * i / (N - 1);
    gap[i] = interp(u[i], u1, v1) - interp(u[i], u2, v2);
    if (u[i] > 1e-9) a = Math.max(a, -gap[i]); else if (u[i] < -1e-9) b = Math.max(b, gap[i]);
  }
  return { snm: Math.min(a, b) / s, lobes: [a / s, b / s], u, gap };
}

export function cell(p, { vdd = p.VDD, cr = 2, pr = 1, beta = 0.8, rows = 256, dv = 0.1, wAx = null, dvt = 0 } = {}) {
  const h1 = vtc(p, vdd, cr, pr, beta, false, 241, dvt / 2), h2 = vtc(p, vdd, cr, pr, beta, false, 241, -dvt / 2);
  const r1 = vtc(p, vdd, cr, pr, beta, true, 241, dvt / 2), r2 = vtc(p, vdd, cr, pr, beta, true, 241, -dvt / 2);
  const hold = snm(h1, h2), read = snm(r1, r2);
  const vRead = r1.vout[r1.vout.length - 1];
  const w = wAx ?? 2 * p.L_nm * 1e-3;
  const iRead = id(p, vdd - vRead, vdd - vRead) * w;
  const cCell = 4 * w * 1e-15;
  return { hold_snm: hold.snm, read_snm: read.snm, v_read: vRead, i_read_uA: iRead * 1e6, c_bl_fF: rows * cCell * 1e15,
    t_sense_ps: rows * cCell * dv / Math.max(iRead, 1e-15) * 1e12, vdd, curves: { h1, h2, r1, r2 }, hold, read };
}
