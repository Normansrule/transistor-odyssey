// Lab 03 — six-transistor SRAM cell: read animation, butterfly curves, noise margins, bitcell scaling.
import * as SR from '../physics/sram.js';
import { DATA } from '../data.js';
import { MEMORY } from './data.js';
import { panel, tiles, experiments, hiCanvas, loop, frame, axes, linear, log, path, el, C, txt, fw, onWidth, hover, tipRows, clamp, coalesce, reduceMotion } from '../physlab/ui.js';

const ERAS = [['1999_180nm', '180 nm'], ['2007_45nm_hkmg', '45 nm'], ['2011_22nm_finfet', '22 nm FinFET'], ['2025_2nm_gaa', '2 nm GAA'], ['2026_mos2_2d', 'MoS₂']];
const ON = '#f2b84b', OFF = '#56739e';

/** Largest-square corners for both wings, from SR.snm output and curve 1. */
function squares(res, c1) {
  const s = Math.SQRT2, u1 = Array.from(c1.vin, (x, i) => (x - c1.vout[i]) / s), v1 = Array.from(c1.vin, (x, i) => (x + c1.vout[i]) / s);
  const iv = u => { let k = 1; while (k < u1.length - 1 && u1[k] < u) k++; const f = (u - u1[k - 1]) / (u1[k] - u1[k - 1] || 1); return v1[k - 1] + f * (v1[k] - v1[k - 1]); };
  const out = [];
  for (const side of [1, -1]) {
    let best = -1, bi = -1;
    res.u.forEach((u, i) => { const g = side > 0 ? -res.gap[i] : res.gap[i]; if (side * u > 1e-9 && g > best) { best = g; bi = i; } });
    if (bi < 0 || best <= 0) continue;
    const u = res.u[bi], a = iv(u), b = a - res.gap[bi];
    const P = v => [(u + v) / s, (v - u) / s], p1 = P(a), p2 = P(b);
    out.push({ x0: Math.min(p1[0], p2[0]), x1: Math.max(p1[0], p2[0]), y0: Math.min(p1[1], p2[1]), y1: Math.max(p1[1], p2[1]), side: best / s });
  }
  return out;
}

export class CellView {
  constructor(canvas) { this.c = hiCanvas(canvas); this.M = null; }
  set(M) { this.M = M; }
  /** phase in [0,1): precharge, word line on (read), word line off. */
  draw(phase) {
    const { c, M } = this; c.resize(); const { ctx, w, h } = c; ctx.clearRect(0, 0, w, h); if (!M) return;
    const vdd = M.vdd, narrow = w < 640, sw = narrow ? w : Math.min(w * 0.52, 470);
    const upset = M.read_snm < 0.004;
    // timeline: 0–0.12 idle, 0.12–0.8 WL high, 0.8–1 precharge
    const wl = phase > 0.12 && phase < 0.8, tr = clamp((phase - 0.12) / 0.68, 0, 1);
    const tSense = M.t_sense_ps, tWin = Math.max(tSense * 2.2, 1);
    const dBL = wl ? Math.min(vdd * 0.9, 0.1 * tr * tWin / tSense) : 0;   // volts dropped on the bitline
    const vQ0 = upset ? (wl ? clamp(M.v_read + tr * 3 * vdd, 0, vdd) : (phase >= 0.8 ? vdd : 0)) : wl ? M.v_read * clamp(tr * 6, 0, 1) : 0;
    const vQ = vQ0, vQB = upset && (wl ? tr > 0.15 : phase >= 0.8) ? 0 : vdd;
    const vBL = vdd - (upset ? 0 : dBL), vBLB = vdd;
    // schematic
    const x0 = 18, xBL = x0 + 18, xBLB = x0 + sw - 30, yWL = 34, yTop = 70, yBot = h - 28, yMid = (yTop + yBot) / 2;
    const xQ = x0 + sw * 0.36, xQB = x0 + sw * 0.64;
    const col = v => (v > vdd / 2 ? ON : OFF);
    const line = (pts, cc, lw = 2.5) => { ctx.strokeStyle = cc; ctx.lineWidth = lw; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke(); };
    // supply rails
    line([[xQ - 40, yTop - 12], [xQB + 40, yTop - 12]], ON, 3); line([[xQ - 40, yBot], [xQB + 40, yBot]], OFF, 3);
    ctx.font = '600 11px "IBM Plex Mono", monospace'; ctx.fillStyle = '#ffd27a'; ctx.textAlign = 'center'; ctx.fillText(`V_DD ${vdd.toFixed(2)} V`, (xQ + xQB) / 2, yTop - 20);
    // word line
    line([[xBL - 10, yWL], [xBLB + 10, yWL]], wl ? ON : OFF, 3);
    ctx.textAlign = 'left'; ctx.fillStyle = wl ? '#ffd27a' : '#8a94a3'; ctx.fillText(`word line ${wl ? 'ON' : 'off'}`, xBL + 6, yWL - 10);
    // bitlines (brightness = voltage)
    const blc = v => `rgba(242,184,75,${0.25 + 0.75 * v / vdd})`;
    line([[xBL, yWL + 10], [xBL, yBot + 8]], blc(vBL), 4); line([[xBLB, yWL + 10], [xBLB, yBot + 8]], blc(vBLB), 4);
    ctx.fillStyle = '#c3cede'; ctx.textAlign = 'center'; ctx.fillText('BL', xBL, yBot + 22); ctx.fillText('BL̅', xBLB, yBot + 22);
    // inverters as transistor pairs
    const fet = (x, y, type, on, lbl) => {
      const cw = 12, ch = 30; ctx.fillStyle = on ? (type === 'n' ? '#5aa2ff' : '#ff8a55') : 'rgba(138,148,163,.15)';
      ctx.fillRect(x - cw / 2, y - ch / 2, cw, ch); ctx.strokeStyle = '#3a4452'; ctx.lineWidth = 1; ctx.strokeRect(x - cw / 2 + .5, y - ch / 2 + .5, cw - 1, ch - 1);
      ctx.fillStyle = '#8a94a3'; ctx.font = '500 10px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(lbl, x + (lbl.endsWith('L') ? -24 : 24), y + 4);
    };
    // left inverter drives Q (input QB); right drives QB (input Q)
    for (const [x, vout, vin, nm] of [[xQ, vQ, vQB, 'L'], [xQB, vQB, vQ, 'R']]) {
      line([[x, yTop - 12], [x, yBot]], 'rgba(170,179,192,.25)', 1.5);
      fet(x, yMid - 38, 'p', vin < vdd / 2, `PU${nm}`); fet(x, yMid + 38, 'n', vin > vdd / 2, `PD${nm}`);
      line([[x, yMid - 20], [x, yMid + 20]], col(vout), 3);
      ctx.fillStyle = col(vout); ctx.beginPath(); ctx.arc(x, yMid, 6, 0, 7); ctx.fill();
    }
    // cross-coupling
    line([[xQ, yMid], [xQ + 22, yMid], [xQB - 30, yMid + 38], [xQB - 14, yMid + 38]], col(vQ), 1.8);
    line([[xQ + 22, yMid], [xQB - 30, yMid - 38], [xQB - 14, yMid - 38]], col(vQ), 1.8);
    line([[xQB, yMid], [xQB - 22, yMid], [xQ + 30, yMid + 38], [xQ + 14, yMid + 38]], col(vQB), 1.8);
    line([[xQB - 22, yMid], [xQ + 30, yMid - 38], [xQ + 14, yMid - 38]], col(vQB), 1.8);
    // access transistors
    const ax = (xa, xb, v) => { line([[xa, yMid], [xb, yMid]], col(v), 2.5); const xm = (xa + xb) / 2; ctx.fillStyle = wl ? '#5aa2ff' : 'rgba(138,148,163,.15)'; ctx.fillRect(xm - 15, yMid - 6, 30, 12); line([[xm, yMid - 8], [xm, yWL]], wl ? ON : OFF, 1.5); };
    ax(xBL, xQ, vQ); ax(xQB, xBLB, vQB);
    ctx.font = '700 13px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#e8ecf1'; ctx.fillText(`Q ${vQ.toFixed(2)} V`, xQ, yMid + 82 > yBot - 6 ? yBot - 6 : yMid + 82); ctx.fillText(`Q̅ ${vQB.toFixed(2)} V`, xQB, yMid + 82 > yBot - 6 ? yBot - 6 : yMid + 82);
    // read current dots from BL into the cell and down to ground
    if (wl && !upset) {
      ctx.fillStyle = '#bcd8ff';
      for (let k = 0; k < 6; k++) { const f = (phase * 9 + k / 6) % 1, x = xBL + f * (xQ - xBL); ctx.beginPath(); ctx.arc(x, yMid, 2.5, 0, 7); ctx.fill(); }
      for (let k = 0; k < 4; k++) { const f = (phase * 9 + k / 4) % 1; ctx.beginPath(); ctx.arc(xQ, yMid + f * (yBot - yMid), 2.5, 0, 7); ctx.fill(); }
    }
    // waveforms
    if (!narrow) {
      const ox = sw + 30, ow = w - ox - 16, oy = 24, oh = h - 52;
      ctx.fillStyle = 'rgba(10,13,17,.6)'; ctx.fillRect(ox, oy, ow, oh); ctx.strokeStyle = '#232a34'; ctx.strokeRect(ox + .5, oy + .5, ow - 1, oh - 1);
      const X = p => ox + 10 + p * (ow - 20), Y = v => oy + oh - 14 - v / vdd * (oh - 40);
      const sig = (fn, cc, name, dy) => {
        ctx.beginPath(); for (let i = 0; i <= 200; i++) { const p = i / 200, v = fn(p); i ? ctx.lineTo(X(p), Y(v)) : ctx.moveTo(X(p), Y(v)); }
        ctx.strokeStyle = cc; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = cc; ctx.textAlign = 'left'; ctx.font = '600 11px "IBM Plex Mono", monospace'; ctx.fillText(name, ox + 12, oy + 14 + dy);
      };
      const blAt = p => { const on = p > 0.12 && p < 0.8, f = clamp((p - 0.12) / 0.68, 0, 1); return upset ? vdd : vdd - (on ? Math.min(vdd * 0.9, 0.1 * f * tWin / tSense) : 0); };
      const qAt = p => { const on = p > 0.12 && p < 0.8, f = clamp((p - 0.12) / 0.68, 0, 1); return upset ? (on ? clamp(M.v_read + f * 3 * vdd, 0, vdd) : p >= 0.8 ? vdd : 0) : on ? M.v_read * clamp(f * 6, 0, 1) : 0; };
      sig(p => (p > 0.12 && p < 0.8 ? vdd : 0), 'rgba(242,184,75,.8)', 'WL', 0);
      sig(blAt, '#7fd3d0', 'BL', 14); sig(qAt, '#86b6ef', 'Q', 28);
      const pS = 0.12 + 0.68 * tSense / tWin;
      if (!upset && pS < 0.8) { ctx.setLineDash([3, 4]); ctx.strokeStyle = '#e8ecf1'; ctx.beginPath(); ctx.moveTo(X(pS), oy + 6); ctx.lineTo(X(pS), oy + oh - 6); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#e8ecf1'; ctx.textAlign = 'left'; ctx.fillText(`100 mV after ${tSense.toFixed(0)} ps → sense`, X(pS) + 4, oy + oh - 20); }
      ctx.strokeStyle = '#e8ecf1'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(phase), oy + 4); ctx.lineTo(X(phase), oy + oh - 4); ctx.stroke();
      ctx.fillStyle = upset ? '#ff8a7a' : '#8a94a3'; ctx.textAlign = 'right'; ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.fillText(upset ? 'READ UPSET: the cell flipped' : `read window ≈ ${tWin.toFixed(0)} ps, slowed down`, ox + ow - 8, oy + 14);
    }
  }
}

export function init(sec) {
  const P = DATA.presets;
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'era', type: 'seg', label: 'Transistor generation', options: ERAS, value: '2011_22nm_finfet' },
    { key: 'vdd', label: 'Supply voltage V_DD', min: 0.2, max: 1.8, step: 0.01, value: 0.8, fmt: v => v.toFixed(2) + ' V' },
    { key: 'cr', label: 'Cell ratio (pull-down / access)', min: 0.6, max: 3, step: 0.05, value: 2, fmt: v => v.toFixed(2) + '×' },
    { key: 'pr', label: 'Pull-up ratio (pull-up / access)', min: 0.3, max: 2, step: 0.05, value: 1, fmt: v => v.toFixed(2) + '×' },
    { key: 'dvt', label: 'Threshold mismatch ΔV_T', min: 0, max: 0.25, step: 0.005, value: 0, fmt: v => (v * 1000).toFixed(0) + ' mV' },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'hold', label: 'Hold noise margin', unit: 'mV (standby)' }, { key: 'read', label: 'Read noise margin', unit: 'mV (word line on)' },
    { key: 'vr', label: 'Read disturb', unit: 'mV on the 0 node' }, { key: 'ir', label: 'Read current', unit: 'µA (cell width ≈ 2L)' },
    { key: 'ts', label: 'Bitline swing 100 mV', unit: 'ps, 256 cells' }, { key: 'st', label: 'Status', unit: '' },
  ]);
  const view = new CellView(sec.querySelector('[data-role=cell] canvas'));
  const bfHost = sec.querySelector('[data-role=butterfly]'), svHost = sec.querySelector('[data-role=snmv]'), arHost = sec.querySelector('[data-role=area]');
  let M = null, phase = 0;
  ctl.on((k, final) => {
    if (k === 'era') { const p = P[ctl.state.era]; ctl.inputs.vdd.inp.max = Math.max(p.VDD * 1.25, 1); ctl.set('vdd', p.VDD, false); }
    compute(); if (final !== false || k === 'era') drawSweep(); else sweepLater();
  });
  const sweepLater = coalesce(() => drawSweep());
  function compute() {
    const s = ctl.state, p = P[s.era], beta = SR.BETA[s.era];
    M = SR.cell(p, { vdd: Math.min(s.vdd, p.VDD * 1.25), cr: s.cr, pr: s.pr, beta, dvt: s.dvt });
    view.set(M);
    const upset = M.read_snm < 0.004;
    show({ hold: (M.hold_snm * 1000).toFixed(0) + ` <small>${(100 * M.hold_snm / M.vdd).toFixed(0)} % of V_DD</small>`, read: (M.read_snm * 1000).toFixed(0) + ` <small>${(100 * M.read_snm / M.vdd).toFixed(0)} % of V_DD</small>`,
      vr: (M.v_read * 1000).toFixed(0), ir: M.i_read_uA.toFixed(M.i_read_uA < 10 ? 2 : 1), ts: upset ? '—' : M.t_sense_ps.toFixed(0),
      st: upset ? '<span style="color:#ff8a7a">read upset</span>' : M.read_snm < 0.08 * M.vdd ? '<span style="color:#ffd27a">marginal</span>' : '<span style="color:#7fe0c8">stable</span>' });
    drawButterfly();
  }
  function drawButterfly() {
    const vdd = M.vdd, f = frame(bfHost, { w: fw(bfHost), h: 320, m: { t: 14, r: 16, b: 40, l: 50 } });
    const side = Math.min(f.x1 - f.x0, f.y0 - f.y1), xs = linear(0, vdd, f.x0, f.x0 + side), ys = linear(0, vdd, f.y0, f.y0 - side);
    const t = [0, vdd / 4, vdd / 2, 3 * vdd / 4, vdd].map(v => +v.toFixed(2));
    axes(f, xs, ys, { xt: t, yt: t, xl: 'V_Q̅ (V)', yl: 'V_Q (V)', xf: v => v.toFixed(2), yf: v => v.toFixed(2) });
    const { h1, h2, r1, r2 } = M.curves;
    const curve = (c, mirror, stroke, dash, wdt) => el('path', { d: path(Array.from(c.vin, (v, i) => mirror ? [xs(c.vout[i]), ys(v)] : [xs(v), ys(c.vout[i])])), fill: 'none', stroke, 'stroke-width': wdt, 'stroke-dasharray': dash }, f.svg);
    curve(h1, false, C.muted, '4 4', 1.3); curve(h2, true, C.muted, '4 4', 1.3);
    for (const sq of squares(M.read, r1)) el('rect', { x: xs(sq.x0), y: ys(sq.y1), width: xs(sq.x1) - xs(sq.x0), height: ys(sq.y0) - ys(sq.y1), fill: 'rgba(242,184,75,.16)', stroke: '#f2b84b', 'stroke-width': 1.5 }, f.svg);
    curve(r1, false, C.s1, null, 2.4); curve(r2, true, '#ff8a55', null, 2.4);
    const lx = f.x0 + side + 12;
    if (f.x1 - lx > 110) {
      txt(f.svg, lx, f.y1 + 14, 'read: inverter L', { fill: '#86b6ef' }); txt(f.svg, lx, f.y1 + 30, 'read: inverter R', { fill: '#ffb38a' });
      txt(f.svg, lx, f.y1 + 46, 'hold (dashed)', { fill: C.muted });
      txt(f.svg, lx, f.y1 + 70, `SNM wings: ${M.read.lobes.map(v => (v * 1000).toFixed(0)).join(' / ')} mV`, { fill: '#ffd27a' });
    }
  }
  function drawSweep() {
    const s = ctl.state, p = P[s.era], beta = SR.BETA[s.era], vmax = p.VDD * 1.25, vs = [];
    for (let i = 0; i <= 12; i++) vs.push(0.15 + (vmax - 0.15) * i / 12);
    const rows = vs.map(v => { const m = SR.cell(p, { vdd: v, cr: s.cr, pr: s.pr, beta, dvt: s.dvt }); return [v, m.hold_snm, m.read_snm]; });
    const f = frame(svHost, { w: fw(svHost), h: 320, m: { t: 14, r: 16, b: 40, l: 54 } });
    const ymax = Math.max(...rows.map(r => r[1])) * 1.15 || 0.1;
    const xs = linear(0, vmax, f.x0, f.x1), ys = linear(0, ymax * 1000, f.y0, f.y1);
    const step = ymax * 1000 > 400 ? 100 : ymax * 1000 > 150 ? 50 : 20, yt = []; for (let v = 0; v <= ymax * 1000; v += step) yt.push(v);
    axes(f, xs, ys, { xt: [0, vmax / 4, vmax / 2, 3 * vmax / 4, vmax].map(v => +v.toFixed(2)), yt, xl: 'V_DD (V)', yl: 'noise margin (mV)', xf: v => v.toFixed(2), yf: String });
    el('path', { d: path(rows.map(r => [xs(r[0]), ys(r[1] * 1000)])), fill: 'none', stroke: C.muted, 'stroke-width': 2 }, f.svg);
    el('path', { d: path(rows.map(r => [xs(r[0]), ys(r[2] * 1000)])), fill: 'none', stroke: '#f2b84b', 'stroke-width': 2.4 }, f.svg);
    txt(f.svg, xs(rows[9][0]), ys(rows[9][1] * 1000) - 8, 'hold', { fill: C.ink2, 'text-anchor': 'end' });
    txt(f.svg, xs(rows[11][0]), ys(rows[11][2] * 1000) + 16, 'read', { fill: '#ffd27a', 'text-anchor': 'end' });
    el('circle', { cx: xs(M.vdd), cy: ys(M.read_snm * 1000), r: 5, fill: 'none', stroke: '#e8ecf1', 'stroke-width': 1.5 }, f.svg);
    hover(f, svHost, xs, x => { const r = rows.reduce((a, b) => Math.abs(b[0] - x) < Math.abs(a[0] - x) ? b : a); return tipRows(`V_DD ${r[0].toFixed(2)} V`, [['hold', (r[1] * 1000).toFixed(0) + ' mV'], ['read', (r[2] * 1000).toFixed(0) + ' mV']]); });
  }
  function drawArea() {
    const rows = MEMORY.sram, f = frame(arHost, { w: fw(arHost), h: 300, m: { t: 16, r: 20, b: 40, l: 60 } });
    const xs = linear(2002, 2026.5, f.x0, f.x1), ys = log(0.01, 1.5, f.y0, f.y1);
    axes(f, xs, ys, { xt: [2003, 2007, 2011, 2015, 2019, 2023], yt: [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1], xl: 'year of volume production', yl: 'bitcell area (µm²)', xf: String, yf: v => String(v) });
    // the trend it was on: 0.5× per two years from 90 nm
    el('path', { d: path([[xs(2003), ys(1)], [xs(2017.5), ys(1 * 0.5 ** 7.25)]]), fill: 'none', stroke: C.muted, 'stroke-dasharray': '5 5', 'stroke-width': 1.3 }, f.svg);
    txt(f.svg, xs(2016.6), ys(0.012), '≈ 0.5× every two years', { fill: C.muted, 'text-anchor': 'end' });
    el('path', { d: path(rows.map(r => [xs(r.year), ys(r.area_um2)])), fill: 'none', stroke: C.axis, 'stroke-width': 1.2 }, f.svg);
    const tip = (() => { const t = document.createElement('div'); t.className = 'chart-tip'; t.style.display = 'none'; arHost.appendChild(t); return t; })();
    for (const r of rows) {
      const c = r.maker === 'Intel' ? C.s1 : '#f2b84b';
      const dot = el('circle', { cx: xs(r.year), cy: ys(r.area_um2), r: 5.5, fill: c, stroke: C.surface, 'stroke-width': 1.5, style: 'cursor:help' }, f.svg);
      const below = r.node === 'N3B' || r.node === 'N7';
      txt(f.svg, xs(r.year) + (below ? 4 : 8), ys(r.area_um2) + (below ? 18 : -8), r.node, { fill: c, 'text-anchor': 'start', 'font-size': 10.5 });
      dot.addEventListener('pointerenter', e => { tip.innerHTML = tipRows(`${r.maker} ${r.node} (${r.year})`, [['bitcell', r.area_um2 + ' µm²'], ['cells per mm² (array only)', (1 / r.area_um2).toFixed(1) + ' million']]); tip.style.display = 'block'; const b = arHost.getBoundingClientRect(); tip.style.left = (e.clientX - b.left + 12) + 'px'; tip.style.top = (e.clientY - b.top + 12) + 'px'; });
      dot.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
    }
    txt(f.svg, xs(2020.2), ys(0.034), 'N5 → N3E: no shrink', { fill: '#ff8a7a' });
    txt(f.svg, f.x0 + 8, ys(0.016), '● Intel', { fill: '#86b6ef' }); txt(f.svg, f.x0 + 70, ys(0.016), '● TSMC', { fill: '#ffd27a' });
  }
  loop(sec.querySelector('[data-role=cell]'), dt => { phase = (phase + dt * (reduceMotion ? 0.05 : 0.22)) % 1; view.draw(phase); });
  experiments(sec.querySelector('.lab-exp'), [
    { label: 'Weaken the pull-down (cell ratio 1)', run: api => api.animate({ cr: 1.0 }, 800), note: 'With the pull-down no stronger than the access transistor, the bitline lifts the 0 node much higher during a read and the read wing of the butterfly shrinks. Planar cells used a cell ratio of 1.5–2.5 for exactly this reason; FinFET cells can only change width in whole fins, so they use 2:1 fin ratios or assist circuits instead.' },
    { label: 'Lower the supply toward 0.4 V', run: api => api.animate({ vdd: 0.45 }, 900), note: 'Both margins fall with V_DD. Because SRAM fails first, chips often power their caches from a separate, higher supply rail, and the SRAM sets the chip’s minimum operating voltage (V_min).' },
    { label: 'Add 120 mV of mismatch', run: api => api.animate({ dvt: 0.12 }, 900), note: 'Random dopant and work-function variation make the two halves unequal. One wing of the butterfly grows, the other shrinks, and only the smaller one counts. With six transistors per bit and billions of bits, designers budget for the 6-sigma worst cell, not the average one.' },
    { label: 'Make it fail: mismatch + low supply + weak pull-down', run: api => api.animate({ dvt: 0.2, vdd: P[api.state.era].VDD * 0.6, cr: 0.9 }, 1000), note: 'Push all three and one wing closes completely: reading the cell flips it (a read upset). Assist circuits (word-line underdrive, negative bitline for writes) and 8-transistor cells with a separate read port exist to avoid this.' },
  ], ctl);
  compute(); drawSweep(); drawArea();
  onWidth([bfHost, svHost, arHost], () => { drawButterfly(); drawSweep(); drawArea(); });
}

/** Record mode: the read cycle with the butterfly beside it. */
export function record(stage, next) {
  stage.innerHTML = `<div class="rec-head"><span class="eyebrow">Six-transistor SRAM · 22 nm FinFET model</span><h2>Reading a bit without destroying it</h2><span class="rec-state" id="rs" hidden></span></div><canvas></canvas>
    <div class="rec-foot"><span style="color:#f2b84b">— 1 / V_DD</span><span style="color:#56739e">— 0</span><span style="color:#7fd3d0">BL: bitline</span><span class="rec-brand">Transistor Odyssey · Circuit Lab</span></div>`;
  const v = new CellView(stage.querySelector('canvas')), p = DATA.presets['2011_22nm_finfet'];
  v.set(SR.cell(p, { cr: 2, beta: 0.8 }));
  return (n = 72) => { const k = next(); v.draw((k % n) / n); stage.querySelector('#rs').textContent = 'stores Q = 0'; return k + 1; };
}
