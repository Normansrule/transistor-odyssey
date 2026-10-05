// Lab 04 — electromigration: Korhonen stress, Blech length, Black's law.
import * as EM from '../physics/electromigration.js';
import { panel, tiles, experiments, hiCanvas, loop, frame, axes, linear, log, path, el, C, txt, fw, onWidth, hover, tipRows, clamp, coalesce, reduceMotion } from '../physlab/ui.js';

export const fmtTime = s => !isFinite(s) ? 'never (immortal)' : s < 60 ? s.toFixed(0) + ' s' : s < 3600 ? (s / 60).toFixed(0) + ' min' : s < 86400 * 2 ? (s / 3600).toFixed(1) + ' h' : s < 3.15e7 * 2 ? (s / 86400).toFixed(0) + ' days' : (s / 3.15e7).toFixed(s < 3.15e8 ? 1 : 0) + ' years';
const stressCol = (sig, sc) => { const u = clamp(sig / sc, -1.2, 1.2); return u >= 0 ? `rgb(${120 + 135 * Math.min(u, 1)},${110 - 50 * Math.min(u, 1)},${90 - 40 * Math.min(u, 1)})` : `rgb(${90 + 20 * u},${120 - 10 * u},${170 - 60 * u})`; };

export class LineView {
  constructor(cv) { this.c = hiCanvas(cv); this.s = null; this.u = 0; this.e = []; }
  set(s) {
    this.s = s; this.u = 0;
    this.line = new EM.Line(s.L, s.j, s.T, 81);
    this.ttf = EM.timeToFail(s.L, s.j, s.T);
    const tau = this.line.L ** 2 / this.line.k;
    this.tEnd = isFinite(this.ttf) ? this.ttf * 1.6 : 0.6 * tau;
    this.tNuc = isFinite(this.ttf) ? this.ttf : Infinity;
  }
  draw(dt, dur = 9) {
    const { c, s } = this; c.resize(); const { ctx, w, h } = c; ctx.clearRect(0, 0, w, h); if (!s) return;
    this.u = Math.min(this.u + dt / (reduceMotion ? dur / 3 : dur), 1);
    const target = this.tEnd * this.u * this.u, ln = this.line;
    if (target > ln.t) { const n = 24, d = (target - ln.t) / n; ln.step(d, n); }
    const sc = ln.p.sigma_c, failed = ln.t >= this.tNuc;
    const x0 = 40, x1 = w - 40, yL = h * 0.34, th = Math.max(26, h * 0.1), lw = x1 - x0;
    // vias
    ctx.fillStyle = '#8a94a3'; ctx.fillRect(x0 - 26, yL - th / 2 - 30, 26, th + 30); ctx.fillRect(x1, yL - th / 2 - 30, 26, th + 30);
    // stress-coloured line
    const N = ln.nx;
    for (let i = 0; i < N; i++) { ctx.fillStyle = stressCol(ln.sigma[i], sc); ctx.fillRect(x0 + lw * i / N, yL - th / 2, lw / N + 1, th); }
    // grain boundaries
    ctx.strokeStyle = 'rgba(10,13,17,.35)'; ctx.lineWidth = 1;
    let gx = x0; let a = 17; while (gx < x1) { a = (a * 1103515245 + 12345) & 0x7fffffff; gx += 18 + (a % 30); if (gx < x1) { ctx.beginPath(); ctx.moveTo(gx, yL - th / 2); ctx.lineTo(gx + ((a >> 8) % 9) - 4, yL + th / 2); ctx.stroke(); } }
    // void at cathode, hillock at anode
    const grow = failed ? clamp((ln.t - this.tNuc) / (this.tEnd - this.tNuc + 1e-30), 0, 1) : 0;
    if (grow > 0) {
      ctx.fillStyle = '#07090c'; ctx.beginPath(); ctx.ellipse(x0 + 4, yL - th / 2 + th * 0.1, 10 + 40 * grow, th * (0.25 + 0.75 * grow) / 1.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d9825b'; ctx.beginPath(); ctx.moveTo(x1 - 50, yL - th / 2); ctx.quadraticCurveTo(x1 - 25, yL - th / 2 - 22 * grow, x1, yL - th / 2); ctx.fill();
    }
    // electrons (cathode → anode, left to right) and drifting atoms
    if (this.e.length < 60 && Math.random() < 0.7) this.e.push({ x: 0, y: (Math.random() - 0.5) * 0.8, v: 0.35 + Math.random() * 0.3 });
    this.e = this.e.filter(p => (p.x += p.v * dt * (failed && grow > 0.6 ? 0.1 : 1)) < 1);
    ctx.fillStyle = '#bcd8ff'; for (const p of this.e) { ctx.beginPath(); ctx.arc(x0 + p.x * lw, yL + p.y * th / 2, 2, 0, 7); ctx.fill(); }
    ctx.font = '600 12px "IBM Plex Mono", monospace'; ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.fillStyle = '#e8ecf1'; ctx.fillText('cathode', x0 - 26, yL - th / 2 - 42);
    ctx.textAlign = 'right'; ctx.fillText('anode', x1 + 26, yL - th / 2 - 42);
    ctx.textAlign = 'center'; ctx.fillStyle = '#bcd8ff'; ctx.fillText(w < 560 ? 'electron wind →' : 'electron wind → atoms drift toward the anode', (x0 + x1) / 2, yL - th / 2 - 16);
    // stress profile plot
    const py0 = yL + th / 2 + 34, py1 = h - 30, smax = 1.7 * sc, Y = v => (py0 + py1) / 2 - v / smax * (py1 - py0) / 2;
    ctx.save(); ctx.beginPath(); ctx.rect(0, py0 - 4, w, py1 - py0 + 8); ctx.clip();
    ctx.strokeStyle = '#2f3845'; ctx.beginPath(); ctx.moveTo(x0, Y(0)); ctx.lineTo(x1, Y(0)); ctx.stroke();
    ctx.setLineDash([5, 4]); ctx.strokeStyle = '#ff8a7a'; ctx.beginPath(); ctx.moveTo(x0, Y(sc)); ctx.lineTo(x1, Y(sc)); ctx.stroke();
    ctx.strokeStyle = 'rgba(232,236,241,.45)'; ctx.beginPath(); for (let i = 0; i <= 60; i++) { const xx = x0 + lw * i / 60, v = ln.G * ln.L * (0.5 - i / 60); i ? ctx.lineTo(xx, Y(v)) : ctx.moveTo(xx, Y(v)); } ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#f2b84b'; ctx.lineWidth = 2.4; ctx.beginPath();
    for (let i = 0; i < N; i++) { const xx = x0 + lw * (i + 0.5) / N, yy = Y(ln.sigma[i]); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); ctx.lineWidth = 1;
    ctx.restore();
    ctx.font = '500 11px "IBM Plex Mono", monospace'; ctx.textAlign = 'left';
    ctx.fillStyle = '#ff8a7a'; ctx.fillText('void nucleates (σ_crit)', x0 + 4, Y(sc) - 8);
    ctx.fillStyle = '#aab3c0'; ctx.fillText(w < 1000 ? 'steady state' : 'steady state (never reached if a void forms first)', x0 + lw * 0.5 + 8, Y(0) + 14);
    ctx.fillStyle = '#ffd27a'; ctx.fillText('stress along the line (tension +)', x0 + 4, py1 + 14);
    ctx.textAlign = 'right'; ctx.font = '700 13px "IBM Plex Mono", monospace';
    ctx.fillStyle = failed ? '#ff8a7a' : '#e8ecf1';
    ctx.fillText(failed ? `VOID at ${fmtTime(this.tNuc)}` : `t = ${fmtTime(ln.t)}`, x1 + 26, 18);
    ctx.textAlign = 'left'; ctx.fillStyle = '#aab3c0'; ctx.font = '500 11px "IBM Plex Mono", monospace';
    ctx.fillText(`${s.L.toFixed(0)} µm · ${s.j.toFixed(1)} MA/cm² · ${s.T.toFixed(0)} °C`, x0 - 26, 18);
  }
}

export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'j', label: 'Current density', min: 0.2, max: 6, log: true, value: 2, fmt: v => v.toFixed(2) + ' MA/cm²' },
    { key: 'T', label: 'Temperature', min: 60, max: 350, step: 1, value: 300, fmt: v => v.toFixed(0) + ' °C' },
    { key: 'L', label: 'Line length (via to via)', min: 5, max: 500, log: true, value: 100, fmt: v => v.toFixed(v < 10 ? 1 : 0) + ' µm' },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'lb', label: 'Blech length', unit: 'shorter lines never fail' }, { key: 'jl', label: 'j·L of this line', unit: 'A/cm, critical ≈ 3,900' },
    { key: 'st', label: 'Status', unit: '' }, { key: 'ttf', label: 'Time to void', unit: 'simulated' },
    { key: 'use', label: 'Same line at use conditions', unit: '1 MA/cm², 105 °C (Black)' }, { key: 'sig', label: 'Steady-state peak stress', unit: 'MPa, G·L/2' },
  ]);
  const view = new LineView(sec.querySelector('[data-role=line] canvas'));
  const tHost = sec.querySelector('[data-role=ttf]'), bHost = sec.querySelector('[data-role=black]');
  const later = coalesce(() => { view.set(ctl.state); drawTTF(); drawBlack(); });
  ctl.on((k, final) => { tilesOnly(); if (final) { view.set(ctl.state); drawTTF(); drawBlack(); } else later(); });
  function tilesOnly() {
    const s = ctl.state, Lb = EM.blechLengthUm(s.j, s.T), ttf = EM.timeToFail(s.L, s.j, s.T), jL = s.j * 1e6 * s.L * 1e-4;
    const use = EM.timeToFail(s.L, 1, 105);
    show({ lb: Lb.toFixed(Lb < 10 ? 1 : 0) + ' µm', jl: Math.round(jL).toLocaleString('en-US'), st: isFinite(ttf) ? '<span style="color:#ff8a7a">will fail</span>' : '<span style="color:#7fe0c8">immortal</span>',
      ttf: fmtTime(ttf), use: fmtTime(use), sig: (EM.G(s.j, s.T) * s.L * 1e-6 / 2 / 1e6).toFixed(0) });
  }
  function drawTTF() {
    const s = ctl.state, f = frame(tHost, { w: fw(tHost), h: 300, m: { t: 14, r: 16, b: 40, l: 60 } });
    const Lb = EM.blechLengthUm(s.j, s.T), tl = EM.tNucleationLong(s.j, s.T);
    const xs = log(5, 500, f.x0, f.x1), ys = log(tl / 3, tl * 30, f.y0, f.y1);
    const yt = [60, 600, 3600, 10800, 36000, 86400, 864000, 3.15e6, 3.15e7, 3.15e8, 3.15e9, 3.15e10].filter(v => v >= tl / 3 && v <= tl * 30);
    axes(f, xs, ys, { xt: [5, 10, 20, 50, 100, 200, 500], yt, xl: 'line length (µm)', yl: 'time to void', xf: String, yf: fmtTime });
    const Ls = Array.from({ length: 60 }, (_, i) => 5 * 100 ** (i / 59)).filter(L => L > Lb * 1.002);
    const pts = Ls.map(L => [L, EM.timeToFail(L, s.j, s.T)]).filter(p => isFinite(p[1]) && p[1] < tl * 30);
    el('rect', { x: f.x0, y: f.y1, width: Math.max(xs(clamp(Lb, 5, 500)) - f.x0, 0), height: f.y0 - f.y1, fill: 'rgba(60,192,180,.12)' }, f.svg);
    if (Lb > 5) txt(f.svg, f.x0 + 6, f.y1 + 14, 'immortal', { fill: '#7fe0c8' });
    el('line', { x1: f.x0, x2: f.x1, y1: ys(tl), y2: ys(tl), stroke: C.muted, 'stroke-dasharray': '4 4' }, f.svg);
    txt(f.svg, f.x1 - 4, ys(tl) - 6, 'long-line limit', { 'text-anchor': 'end', fill: C.ink2 });
    if (pts.length > 1) el('path', { d: path(pts.map(p => [xs(p[0]), ys(p[1])])), fill: 'none', stroke: '#f2b84b', 'stroke-width': 2.4 }, f.svg);
    const ttf = EM.timeToFail(s.L, s.j, s.T);
    if (isFinite(ttf) && ttf < tl * 30) el('circle', { cx: xs(s.L), cy: ys(ttf), r: 5.5, fill: '#e8ecf1', stroke: C.surface, 'stroke-width': 2 }, f.svg);
    else el('circle', { cx: xs(s.L), cy: f.y1 + 4, r: 5.5, fill: '#7fe0c8' }, f.svg);
  }
  function drawBlack() {
    const s = ctl.state, f = frame(bHost, { w: fw(bHost), h: 300, m: { t: 14, r: 16, b: 40, l: 60 } });
    const xs = log(0.2, 6, f.x0, f.x1), ys = log(60, 3.15e10, f.y0, f.y1);
    axes(f, xs, ys, { xt: [0.2, 0.5, 1, 2, 5], yt: [60, 3600, 86400 * 10, 3.15e8, 3.15e10], xl: 'current density (MA/cm²)', yl: 'lifetime, long line', xf: String, yf: v => ({ 60: '1 min', 3600: '1 h', 864000: '10 days', 315000000: '10 y', 31500000000: '1000 y' })[Math.round(v)] ?? '' });
    const js = Array.from({ length: 30 }, (_, i) => 0.2 * 30 ** (i / 29)), Ts = [105, 200, 250, 300], cols = ['#3cc0b4', '#5598e7', '#f2b84b', '#ff8a55'];
    Ts.forEach((T, i) => {
      el('path', { d: path(js.map(j => [xs(j), ys(clamp(EM.tNucleationLong(j, T), 60, 3.15e10))])), fill: 'none', stroke: cols[i], 'stroke-width': Math.abs(T - s.T) < 6 ? 2.6 : 1.5 }, f.svg);
      const jl = js.find(j => EM.tNucleationLong(j, T) < 3.15e10) ?? 0.2;
      txt(f.svg, xs(Math.max(jl, 0.25)) + 4, ys(clamp(EM.tNucleationLong(Math.max(jl, 0.25), T), 60, 3.15e10)) + 14, `${T} °C`, { fill: cols[i], 'font-size': 10.5 });
    });
    el('line', { x1: f.x0, x2: f.x1, y1: ys(3.15e8), y2: ys(3.15e8), stroke: '#7fe0c8', 'stroke-dasharray': '3 4' }, f.svg);
    txt(f.svg, f.x1 - 4, ys(3.15e8) - 6, '10-year target', { 'text-anchor': 'end', fill: '#7fe0c8' });
    const t = EM.tNucleationLong(s.j, s.T);
    if (t > 60 && t < 3.15e10) el('circle', { cx: xs(s.j), cy: ys(t), r: 5.5, fill: '#e8ecf1', stroke: C.surface, 'stroke-width': 2 }, f.svg);
    hover(f, bHost, xs, j => tipRows(`${j.toFixed(2)} MA/cm²`, Ts.map(T => [`${T} °C`, fmtTime(EM.tNucleationLong(j, T))])));
  }
  loop(sec.querySelector('[data-role=line]'), dt => view.draw(dt));
  experiments(sec.querySelector('.lab-exp'), [
    { label: 'An accelerated test: 300 °C, 2 MA/cm²', run: api => api.animate({ T: 300, j: 2, L: 200 }, 800), note: 'Reliability engineers cannot wait ten years, so they stress lines at 250–350 °C and several MA/cm² until they fail in hours, then use Black’s law to extrapolate back to use conditions. The thousands-fold acceleration comes almost entirely from temperature.' },
    { label: 'Shorten the line below the Blech length', run: api => api.animate({ L: 10 }, 800), note: 'Back-stress from the atoms piling up at the anode pushes atoms back toward the cathode. In a short line it balances the electron wind before the cathode stress reaches the void threshold, and the line never fails. Designers exploit this by keeping high-current segments short between vias.' },
    { label: 'Double the current', run: api => api.animate({ j: Math.min(api.state.j * 2, 6) }, 800), note: 'The driving force G doubles, so the stress needed for a void is reached with half the atom transport, and the time scales as (σ_crit/G)²: four times shorter. That is the j⁻² in Black’s law, emerging here from the stress equation itself.' },
    { label: 'Use conditions: 105 °C', run: api => api.animate({ T: 105, j: 1, L: 200 }, 900), note: 'At chip operating temperature the atoms diffuse about ten thousand times more slowly, and the same line lasts over a decade. Design rules set the maximum current density per wire width so that the worst wire on the chip still meets the lifetime target.' },
  ], ctl);
  tilesOnly(); view.set(ctl.state); drawTTF(); drawBlack();
  onWidth([tHost, bHost], () => { drawTTF(); drawBlack(); });
}

export function record(stage, next) {
  stage.innerHTML = `<div class="rec-head"><span class="eyebrow">Korhonen stress model</span><h2>Electromigration in a copper line</h2><span class="rec-state" id="rs"></span></div><canvas></canvas>
    <div class="rec-foot"><span style="color:#ff8a55">■ tension</span><span style="color:#5598e7">■ compression</span><span style="color:#bcd8ff">● electrons</span><span class="rec-brand">Transistor Odyssey · Process Lab</span></div>`;
  let a = 3; Math.random = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
  const v = new LineView(stage.querySelector('canvas')), s = { L: 100, j: 2, T: 300 }; v.set(s);
  return (n = 108) => { const k = next(); if (k % n === 0) v.set(s); v.draw(1 / 12, n / 12 * 0.9); stage.querySelector('#rs').textContent = '100 µm · 2 MA/cm² · 300 °C'; return k + 1; };
}
