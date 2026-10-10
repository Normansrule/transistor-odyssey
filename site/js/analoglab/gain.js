// Lab 02 — transconductance efficiency gm/ID and intrinsic gain gm·ro across transistor generations.
import * as AN from '../physics/analog.js';
import { id, PHIT } from '../model.js';
import { DATA } from '../data.js';
import { niceTicks, panel, tiles, experiments, hiCanvas, loop, frame, axes, linear, log, path, el, C, txt, fw, onWidth, hover, tipRows, clamp, coalesce, reduceMotion } from '../physlab/ui.js';

export const GERAS = [['1985_1p5um_cmos', '1.5 µm'], ['1999_180nm', '180 nm'], ['2007_45nm_hkmg', '45 nm'], ['2011_22nm_finfet', '22 nm FinFET'], ['2025_2nm_gaa', '2 nm GAA'], ['2026_mos2_2d', 'MoS₂ 2D']];
const COL = { '1985_1p5um_cmos': '#9a80dc', '1999_180nm': '#5598e7', '2007_45nm_hkmg': '#3cc0b4', '2011_22nm_finfet': '#f2b84b', '2025_2nm_gaa': '#ff8a55', '2026_mos2_2d': '#d55181' };
const BAR = { '1985_1p5um_cmos': ['1.5 µm'], '1999_180nm': ['180 nm'], '2007_45nm_hkmg': ['45 nm'], '2011_22nm_finfet': ['22 nm', 'FinFET'], '2025_2nm_gaa': ['2 nm', 'GAA'], '2026_mos2_2d': ['MoS₂', '2D'] };
const nameOf = k => GERAS.find(e => e[0] === k)[1];
const fmtI = v => v >= 1 ? v.toFixed(v >= 10 ? 0 : 1) : v >= 0.1 ? v.toFixed(2) : v.toFixed(3);
const fmtF = f => f >= 1e9 ? (f / 1e9).toFixed(f >= 1e10 ? 0 : 1) + ' GHz' : (f / 1e6).toFixed(0) + ' MHz';

export function opPoint(key, I, frac) {
  const p = DATA.presets[key], vds = frac * p.VDD, vgs = AN.vgsForCurrent(p, I, vds), ss = AN.smallSignal(p, vgs, vds);
  return { key, p, vds, vgs, I, ss, dv: clamp(0.5 / Math.max(ss.gm_id, 1e-3), 0.01, 0.08 * p.VDD) };
}

export class IVView {
  constructor(cv) { this.c = hiCanvas(cv); this.t = 0; this.o = null; }
  set(o) { this.o = o; this.cache = null; }
  draw(dt) {
    const { c, o } = this; c.resize(); const { ctx, w, h } = c; ctx.clearRect(0, 0, w, h); if (!o) return;
    this.t += dt * (reduceMotion ? 0.25 : 1);
    const { p, vgs, vds, dv, ss } = o, vdd = p.VDD, narrow = w < 640;
    const m = { l: 58, r: narrow ? 50 : w * 0.34, t: 18, b: 40 }, X0 = m.l, X1 = w - m.r, Y0 = h - m.b, Y1 = m.t;
    if (!this.cache) {
      const ks = [-2, -1, 0, 1, 2], N = 90;
      const curves = ks.map(k => Array.from({ length: N + 1 }, (_, i) => { const v = vdd * i / N; return [v, id(p, vgs + k * dv, v) * 1e6]; }));
      this.cache = { ks, curves, imax: Math.max(...curves[4].map(q => q[1])) * 1.12 };
    }
    const { ks, curves, imax } = this.cache, X = v => X0 + v / vdd * (X1 - X0), Y = i => Y0 - i / imax * (Y0 - Y1);
    // axes
    ctx.strokeStyle = '#2f3845'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X0, Y1); ctx.lineTo(X0, Y0); ctx.lineTo(X1, Y0); ctx.stroke();
    ctx.font = '10.5px "IBM Plex Mono", monospace'; ctx.fillStyle = '#8a94a3'; ctx.textAlign = 'center';
    for (let k = 0; k <= 4; k++) { const v = vdd * k / 4; ctx.fillText(+v.toFixed(2) + '', X(v), Y0 + 16); }
    ctx.fillText('V_DS (V)'.replace('_', ''), (X0 + X1) / 2, Y0 + 32);
    ctx.textAlign = 'right';
    for (const i of niceTicks(0, imax, 4)) { if (i > imax) continue; ctx.fillText(+i.toPrecision(3) + '', X0 - 6, Y(i) + 4); }
    ctx.save(); ctx.translate(14, (Y0 + Y1) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText('I_D (µA/µm)'.replace('_', ''), 0, 0); ctx.restore();
    // curves
    curves.forEach((cv, j) => {
      const on = ks[j] === 0; ctx.strokeStyle = on ? '#f2b84b' : '#5d6b80'; ctx.lineWidth = on ? 2.4 : 1.4;
      ctx.beginPath(); cv.forEach(([v, i], n) => n ? ctx.lineTo(X(v), Y(i)) : ctx.moveTo(X(v), Y(i))); ctx.stroke();
      { ctx.fillStyle = on ? '#f2b84b' : '#7d8db0'; ctx.textAlign = 'left'; ctx.fillText(`${(vgs + ks[j] * dv).toFixed(2)} V`, X1 + 4, Y(cv[cv.length - 1][1]) + 4); }
    });
    // tangent: slope g_ds through the operating point
    const i0 = o.I, g = ss.gds * 1e6;
    ctx.strokeStyle = 'rgba(232,236,241,.7)'; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.4; ctx.beginPath();
    ctx.moveTo(X(0), Y(i0 - g * vds)); ctx.lineTo(X(vdd), Y(i0 + g * (vdd - vds))); ctx.stroke(); ctx.setLineDash([]);
    // the gate wiggles: the point moves between curves, ΔI = gm ΔV_GS
    const s = Math.sin(this.t * 2 * Math.PI / 1.6), vg = vgs + 0.9 * dv * s, ii = id(p, vg, vds) * 1e6;
    ctx.strokeStyle = 'rgba(60,192,180,.5)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(X(vds), Y(id(p, vgs - 0.9 * dv, vds) * 1e6)); ctx.lineTo(X(vds), Y(id(p, vgs + 0.9 * dv, vds) * 1e6)); ctx.stroke();
    ctx.fillStyle = '#e8ecf1'; ctx.beginPath(); ctx.arc(X(vds), Y(i0), 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#3cc0b4'; ctx.beginPath(); ctx.arc(X(vds), Y(ii), 6, 0, 7); ctx.fill();
    // read-out block
    ctx.textAlign = 'left'; ctx.font = '600 12px "IBM Plex Mono", monospace';
    const bx = narrow ? X0 + 8 : X1 + 74, by = narrow ? Y1 + 14 : Y1 + 28, lh = 19;
    const lines = [['#e8ecf1', `${nameOf(o.key)}, ${fmtI(o.I)} µA/µm`], ['#3cc0b4', `gm   ${(ss.gm * 1e6).toFixed(ss.gm * 1e6 < 10 ? 2 : 0)} µS/µm`], ['#c8d0db', `g_ds ${(ss.gds * 1e6).toPrecision(3)} µS/µm`.replace('_', '')],
      ['#f2b84b', `A0 = gm/gds = ${ss.A0.toFixed(1)}`], ['#9a80dc', `gm/I_D = ${ss.gm_id.toFixed(1)} /V`.replace('_', '')]];
    if (narrow) { ctx.font = '600 11px "IBM Plex Mono", monospace'; lines.splice(1, 2); }
    lines.forEach(([col, s2], k) => { ctx.fillStyle = col; ctx.fillText(s2, bx, by + k * lh); });
    if (!narrow) {
      ctx.font = '11px "IBM Plex Sans", sans-serif'; ctx.fillStyle = '#8a94a3';
      ctx.fillText('Teal: the gate wiggles.', bx, by + lines.length * lh + 14);
      ctx.fillText('Dashed: slope gds = 1/ro.', bx, by + lines.length * lh + 32);
      ctx.fillText('Flatter curves mean more gain.', bx, by + lines.length * lh + 50);
    }
  }
}

export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'era', type: 'seg', label: 'Transistor generation', options: GERAS, value: '1999_180nm' },
    { key: 'I', label: 'Current density I<sub>D</sub>', min: 0.01, max: 300, log: true, value: 10, fmt: v => fmtI(v) + ' µA/µm' },
    { key: 'frac', label: 'Drain voltage V<sub>DS</sub>', min: 0.08, max: 1, step: 0.01, value: 0.5, fmt: v => (v * 100).toFixed(0) + ' % of V<sub>DD</sub>' },
  ]);
  // the panel writes outputs with textContent; allow the subscript in this one
  const outFrac = ctl.inputs.frac.out, showFrac = ctl.inputs.frac.show;
  ctl.inputs.frac.show = v => { showFrac(v); outFrac.innerHTML = (v * 100).toFixed(0) + ' % of V<sub>DD</sub>'; }; ctl.inputs.frac.show(0.5);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'vgs', label: 'Gate voltage', unit: 'V' }, { key: 'gmid', label: 'gm/I<sub>D</sub>', unit: 'per volt' },
    { key: 'gm', label: 'Transconductance', unit: 'µS/µm' }, { key: 'ro', label: 'Output resistance r<sub>o</sub>', unit: 'kΩ·µm' },
    { key: 'A0', label: 'Intrinsic gain', unit: '' }, { key: 'fT', label: 'Transit frequency f<sub>T</sub>', unit: 'intrinsic' },
  ]);
  const view = new IVView(sec.querySelector('[data-role=iv] canvas'));
  const gHost = sec.querySelector('[data-role=gmid]'), aHost = sec.querySelector('[data-role=a0]');
  let o = null;
  const plots = coalesce(() => { drawGmid(); drawA0(); });
  ctl.on(() => { compute(); plots(); });
  function compute() {
    const st = ctl.state; o = opPoint(st.era, st.I, st.frac); view.set(o);
    show({ vgs: o.vgs.toFixed(3), gmid: o.ss.gm_id.toFixed(1), gm: (o.ss.gm * 1e6).toPrecision(3), ro: (1 / o.ss.gds / 1e3 * 1).toPrecision(3),
      A0: `${o.ss.A0.toFixed(1)}× <small>(${(20 * Math.log10(o.ss.A0)).toFixed(0)} dB)</small>`, fT: fmtF(o.ss.fT) });
  }
  const gmidCache = {};
  function gmidCurve(key) {
    if (gmidCache[key]) return gmidCache[key];
    const p = DATA.presets[key], vds = p.VDD / 2, out = [];
    for (let k = 0; k <= 90; k++) { const v = -0.4 + (p.VDD * 1.2 + 0.4) * k / 90, s = AN.smallSignal(p, v, vds), I = s.I * 1e6; if (I > 1e-3 && I < 1000) out.push([I, s.gm_id]); }
    return (gmidCache[key] = out);
  }
  function drawGmid() {
    const f = frame(gHost, { w: fw(gHost), h: 290, m: { t: 14, r: 16, b: 40, l: 46 } });
    const xs = log(0.001, 1000, f.x0, f.x1), ys = linear(0, 40, f.y0, f.y1);
    axes(f, xs, ys, { xt: [0.001, 0.01, 0.1, 1, 10, 100, 1000], yt: [0, 10, 20, 30, 40], xl: 'I_D (µA/µm)', yl: 'gm/I_D (1/V)', xf: v => v < 1 ? String(v) : String(v), yf: String });
    for (const [k] of GERAS) {
      const on = k === o.key;
      el('path', { d: path(gmidCurve(k).map(([I, g]) => [xs(I), ys(g)])), fill: 'none', stroke: COL[k], 'stroke-width': on ? 2.6 : 1.3, opacity: on ? 1 : 0.55 }, f.svg);
    }
    const lim = 1 / (o.p.n * PHIT);
    el('line', { x1: f.x0, x2: f.x1, y1: ys(lim), y2: ys(lim), stroke: COL[o.key], 'stroke-dasharray': '4 4', opacity: 0.8 }, f.svg);
    txt(f.svg, f.x1 - 4, ys(lim) - 6, `1/(nφt) = ${lim.toFixed(1)} /V`, { 'text-anchor': 'end', fill: COL[o.key] });
    el('circle', { cx: xs(o.I), cy: ys(o.ss.gm_id), r: 5.5, fill: '#e8ecf1', stroke: C.surface, 'stroke-width': 2 }, f.svg);
    txt(f.svg, f.x0 + 6, f.y0 - 10, 'weak inversion ←', { fill: C.muted, 'font-size': 10 });
    txt(f.svg, f.x1 - 4, f.y0 - 10, '→ strong inversion', { fill: C.muted, 'font-size': 10, 'text-anchor': 'end' });
    hover(f, gHost, xs, I => tipRows(`${fmtI(I)} µA/µm`, GERAS.map(([k, n]) => { const c = gmidCurve(k), q = c.find(([x]) => x >= I); return [n, q ? q[1].toFixed(1) + ' /V' : '—']; })));
  }
  function drawA0() {
    const f = frame(aHost, { w: fw(aHost), h: 290, m: { t: 22, r: 12, b: 52, l: 46 } });
    const vals = GERAS.map(([k, n]) => { const op = opPoint(k, o.I, ctl.state.frac); return [k, n, op.ss.A0]; });
    const top = Math.max(...vals.map(v => v[2])), ys = log(1, Math.max(300, top * 1.4), f.y0, f.y1), bw = (f.x1 - f.x0) / vals.length;
    axes(f, linear(0, 1, f.x0, f.x1), ys, { xt: [], yt: [1, 3, 10, 30, 100, 300], yl: 'gm·r_o', yf: String });
    vals.forEach(([k, n, a], i) => {
      const x = f.x0 + bw * i + bw * 0.18, on = k === o.key, y = ys(clamp(a, 1, 1e4));
      el('rect', { x, y, width: bw * 0.64, height: f.y0 - y, rx: 3, fill: COL[k], opacity: on ? 1 : 0.55 }, f.svg);
      txt(f.svg, x + bw * 0.32, y - 5, a.toFixed(a < 10 ? 1 : 0), { 'text-anchor': 'middle', fill: on ? '#e8ecf1' : C.ink2, 'font-weight': on ? 700 : 400 });
      const [l1, l2] = BAR[k];
      txt(f.svg, x + bw * 0.32, f.y0 + 16, l1, { 'text-anchor': 'middle', fill: on ? '#e8ecf1' : C.muted, 'font-size': 10.5 });
      if (l2) txt(f.svg, x + bw * 0.32, f.y0 + 29, l2, { 'text-anchor': 'middle', fill: C.muted, 'font-size': 10 });
    });
    txt(f.svg, f.x1 - 2, f.y1 - 8, `at ${fmtI(o.I)} µA/µm, V_DS = ${(ctl.state.frac * 100).toFixed(0)} % of V_DD`, { 'text-anchor': 'end', fill: C.muted, 'font-size': 10 });
  }
  loop(sec.querySelector('[data-role=iv]'), dt => view.draw(dt));
  experiments(sec.querySelector('.lab-exp'), [
    { label: 'Weak inversion: the most gm per microampere', run: api => api.animate({ I: 0.05, frac: 0.5 }, 900), note: 'Below threshold the current is exponential in V_GS, so gm/I_D reaches its ceiling 1/(nφ_t): about 29 per volt for the 180 nm device and 36 for the near-ideal FinFET. Low-power sensors and biomedical circuits live here, at the price of speed: f_T drops below 1 GHz.' },
    { label: 'Strong inversion: speed instead of efficiency', run: api => api.animate({ I: 200, frac: 0.5 }, 900), note: 'Push hard and the current grows more slowly than exponentially, so gm/I_D falls toward a few per volt. Each microampere buys less gm, but f_T climbs because gm is large for the same gate capacitance. Radio-frequency circuits run here.' },
    { label: '180 nm to 45 nm: the gain collapse', run: api => { api.set('era', '1999_180nm'); api.animate({ I: 10, frac: 0.5 }, 700); setTimeout(() => api.set('era', '2007_45nm_hkmg'), 1800); }, note: 'At the same 10 µA/µm the intrinsic gain falls from about 24 to 8. The 45 nm device’s drain pulls on the channel (drain-induced barrier lowering), so its curves tilt and r_o drops. A single 45 nm transistor cannot even make a gain of 10.' },
    { label: 'FinFETs bring the gain back', run: api => { api.set('era', '2011_22nm_finfet'); api.animate({ I: 10, frac: 0.5 }, 700); }, note: 'Wrapping the gate around a fin shields the channel from the drain. The output curves flatten again and intrinsic gain recovers to about 22; nanosheets at 2 nm reach about 33 in this model.' },
    { label: 'Starve the drain', run: api => api.animate({ frac: 0.1 }, 1000), note: 'At low V_DS the transistor leaves saturation and behaves like a resistor: the curves rise steeply, g_ds soars and the gain collapses. With supplies under 1 V, keeping every transistor in saturation is a daily fight for analog designers.' },
  ], ctl);
  compute(); drawGmid(); drawA0();
  onWidth([gHost, aHost], () => { drawGmid(); drawA0(); });
}

export function record(stage, next) {
  stage.innerHTML = `<div class="rec-head"><span class="eyebrow">Intrinsic gain</span><h2>Why analog got harder, then easier</h2><span class="rec-state" id="rs"></span></div><canvas></canvas>
    <div class="rec-foot"><span style="color:#f2b84b">— operating curve</span><span style="color:#e8ecf1">- - slope g<sub>ds</sub></span><span class="rec-brand">Transistor Odyssey · Analog &amp; RF Lab</span></div>`;
  const v = new IVView(stage.querySelector('canvas')), seq = ['1999_180nm', '2007_45nm_hkmg', '2011_22nm_finfet', '2025_2nm_gaa'];
  let cur = null;
  return (n = 160) => {
    const k = next(), key = seq[Math.floor((k % n) / (n / seq.length))];
    if (key !== cur) { cur = key; v.set(opPoint(key, 10, 0.5)); }
    v.draw(1 / 12); stage.querySelector('#rs').textContent = `${nameOf(key)} · gm·rₒ = ${v.o.ss.A0.toFixed(1)}`; return k + 1;
  };
}
