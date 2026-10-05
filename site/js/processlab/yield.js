// Lab 03 — die yield, wafer map and cost per chip.
import * as YC from '../physics/yieldcost.js';
import { FAB } from './data.js';
import { panel, tiles, experiments, hiCanvas, loop, frame, axes, linear, log, path, el, C, txt, fw, onWidth, hover, tipRows, clamp, coalesce, reduceMotion } from '../physlab/ui.js';

const usd = v => v >= 1000 ? '$' + Math.round(v).toLocaleString('en-US') : '$' + v.toFixed(v < 10 ? 2 : 0);

export class WaferView {
  constructor(cv) { this.c = hiCanvas(cv); this.sim = null; this.t = 0; }
  set(sim, die, D0) {
    this.sim = sim; this.die = die; this.D0 = D0; this.t = 0;
    // place each die's defects at stable random positions inside it, with arrival times
    let a = 1234567; const rnd = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
    this.dots = []; sim.dies.forEach(([cx, cy], i) => { for (let k = 0; k < sim.defects[i]; k++) this.dots.push({ x: cx + (rnd() - 0.5) * die[0], y: cy + (rnd() - 0.5) * die[1], at: rnd(), die: i }); });
    this.dots.sort((p, q) => p.at - q.at);
  }
  draw(dt, speed = 1) {
    const { c, sim } = this; c.resize(); const { ctx, w, h } = c; ctx.clearRect(0, 0, w, h); if (!sim) return;
    this.t = Math.min(this.t + dt * speed * (reduceMotion ? 5 : 1) / 3.5, 1);
    const narrow = w < 640, R = Math.min(h * 0.46, (narrow ? w : w * 0.6) * 0.46), cx = narrow ? w / 2 : 22 + R, cy = h / 2, s = R / 150;
    // wafer
    const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, 0, cx, cy, R * 1.05);
    g.addColorStop(0, '#59677c'); g.addColorStop(1, '#232b37');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(200,210,230,.4)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#07090c'; ctx.beginPath(); ctx.arc(cx, cy + R, 3 * s, Math.PI, 0); ctx.fill();
    // dies
    const hit = new Uint8Array(sim.dies.length); let shown = 0;
    for (const d of this.dots) { if (d.at <= this.t) { hit[d.die] = 1; shown++; } }
    const [dw, dh] = this.die;
    sim.dies.forEach(([x, y], i) => {
      const X = cx + (x - dw / 2) * s, Y = cy + (y - dh / 2) * s, W = dw * s, H = dh * s;
      ctx.fillStyle = hit[i] ? 'rgba(217,89,38,.75)' : this.t >= 1 ? 'rgba(60,192,180,.55)' : 'rgba(120,150,190,.35)';
      ctx.fillRect(X + 0.5, Y + 0.5, Math.max(W - 1, 0.5), Math.max(H - 1, 0.5));
    });
    // defects
    ctx.fillStyle = '#ffe2a6';
    for (const d of this.dots) if (d.at <= this.t) { const age = (this.t - d.at) * 30; ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(cx + d.x * s, cy + d.y * s, Math.max(1.4, 4 - age), 0, 7); ctx.fill(); }
    // edge exclusion ring
    ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(cx, cy, (150 - 3) * s, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    // stats
    const good = sim.dies.length - hit.reduce((a, b) => a + b, 0);
    if (!narrow) {
      const ox = cx + R + 30;
      ctx.textAlign = 'left'; ctx.font = '600 12px "IBM Plex Sans", sans-serif'; ctx.fillStyle = '#e8ecf1'; ctx.fillText('This wafer', ox, 40);
      const row = (y, k, v, col = '#e8ecf1') => { ctx.font = '500 12px "IBM Plex Mono", monospace'; ctx.fillStyle = '#8a94a3'; ctx.fillText(k, ox, y); ctx.font = '700 22px "Space Grotesk", "IBM Plex Sans", sans-serif'; ctx.fillStyle = col; ctx.fillText(v, ox, y + 26); };
      row(76, 'dies on the wafer', String(sim.dies.length));
      row(136, 'defects landed', String(shown), '#ffd27a');
      row(196, 'good dies', String(good), '#7fe0c8');
      row(256, 'yield', `${(100 * good / sim.dies.length).toFixed(1)} %`, '#7fe0c8');
      ctx.font = '500 11px "IBM Plex Mono", monospace'; ctx.fillStyle = '#8a94a3';
      ctx.fillText(`die ${dw.toFixed(1)} × ${dh.toFixed(1)} mm`, ox, h - 40);
      ctx.fillText(`D₀ = ${this.D0.toFixed(2)} defects/cm²`, ox, h - 22);
    } else {
      ctx.textAlign = 'left'; ctx.font = '600 12px "IBM Plex Mono", monospace'; ctx.fillStyle = '#7fe0c8';
      ctx.fillText(`${good} / ${sim.dies.length} good`, 10, 18);
    }
  }
}

export function init(sec) {
  const W = FAB.wafers;
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'node', type: 'seg', label: 'Process node (wafer price)', options: W.map((r, i) => [String(i), r.node]), value: String(W.findIndex(r => r.node === '5 nm')) },
    { key: 'area', label: 'Die area', min: 10, max: 800, log: true, value: 100, fmt: v => v.toFixed(0) + ' mm²' },
    { key: 'D0', label: 'Defect density D₀', min: 0.02, max: 2, log: true, value: 0.1, fmt: v => v.toFixed(2) + ' /cm²' },
    { key: 'alpha', label: 'Defect clustering α', min: 0.3, max: 30, log: true, value: 3, fmt: v => v.toFixed(1) + (v > 20 ? ' (≈ Poisson)' : '') },
    { key: 'model', type: 'seg', label: 'Yield model for the cost', options: [['negbin', 'Neg. binomial'], ['murphy', 'Murphy'], ['poisson', 'Poisson']], value: 'negbin' },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'dpw', label: 'Gross dies per wafer', unit: 'formula' }, { key: 'y', label: 'Yield (model)', unit: '' },
    { key: 'mc', label: 'Yield (this wafer)', unit: 'Monte Carlo' }, { key: 'wc', label: 'Wafer price', unit: '' },
    { key: 'cd', label: 'Cost per good die', unit: 'silicon only' }, { key: 'cm', label: 'Cost per good mm²', unit: '' },
  ]);
  const view = new WaferView(sec.querySelector('[data-role=wafer] canvas'));
  const yHost = sec.querySelector('[data-role=ycurve]'), cHost = sec.querySelector('[data-role=cost]');
  let seed = 1, sim = null;
  sec.querySelector('#ycSeed').addEventListener('click', () => { seed++; run(); });
  const later = coalesce(() => run());
  ctl.on((k, final) => { if (final) run(); else { tilesOnly(); later(); } });
  function dims() { const a = ctl.state.area, w = Math.sqrt(a * 1.25); return [w, a / w]; }
  function tilesOnly() {
    const s = ctl.state, wr = W[+s.node], dpw = YC.diesPerWafer(s.area), y = YC.yieldModel(s.area, s.D0, s.model, s.alpha), cd = wr.wafer_usd / (dpw * y);
    show({ dpw: dpw.toFixed(0), y: (100 * y).toFixed(1) + ' %', mc: sim ? (100 * sim.yield_).toFixed(1) + ' %' : '—', wc: usd(wr.wafer_usd) + (wr.approx ? ' <small>reported</small>' : ''), cd: usd(cd), cm: usd(cd / s.area) });
  }
  function run() {
    const s = ctl.state, d = dims();
    sim = YC.simulateWafer(d[0], d[1], s.D0, s.alpha, seed);
    view.set(sim, d, s.D0); tilesOnly(); drawY(); drawCost();
  }
  function drawY() {
    const s = ctl.state, f = frame(yHost, { w: fw(yHost), h: 300, m: { t: 14, r: 16, b: 40, l: 50 } });
    const xs = log(10, 1000, f.x0, f.x1), ys = linear(0, 1, f.y0, f.y1);
    axes(f, xs, ys, { xt: [10, 30, 100, 300, 1000], yt: [0, 0.25, 0.5, 0.75, 1], xl: 'die area (mm²)', yl: 'yield', xf: String, yf: v => (v * 100) + ' %' });
    const As = Array.from({ length: 60 }, (_, i) => 10 ** (1 + 2 * i / 59));
    const series = [['poisson', '#d95926', 'Poisson'], ['murphy', '#f2b84b', 'Murphy'], ['negbin', '#3cc0b4', `neg. binomial α = ${s.alpha.toFixed(1)}`]];
    series.forEach(([m, col, lab], i) => {
      el('path', { d: path(As.map(A => [xs(A), ys(YC.yieldModel(A, s.D0, m, s.alpha))])), fill: 'none', stroke: col, 'stroke-width': m === s.model ? 2.6 : 1.5 }, f.svg);
      txt(f.svg, f.x0 + 8, f.y0 - 10 - 16 * i, lab, { fill: col, 'font-size': 10.5 });
    });
    el('circle', { cx: xs(s.area), cy: ys(YC.yieldModel(s.area, s.D0, s.model, s.alpha)), r: 5.5, fill: '#e8ecf1', stroke: C.surface, 'stroke-width': 2 }, f.svg);
    if (sim) el('circle', { cx: xs(s.area), cy: ys(sim.yield_), r: 7, fill: 'none', stroke: '#e8ecf1', 'stroke-width': 1.5 }, f.svg);
    hover(f, yHost, xs, A => tipRows(`${A.toFixed(0)} mm²`, series.map(([m, , lab]) => [lab.split(' α')[0], (100 * YC.yieldModel(A, s.D0, m, s.alpha)).toFixed(1) + ' %'])));
  }
  function drawCost() {
    const rows = W.filter(r => r.chips_per_wafer), f = frame(cHost, { w: fw(cHost), h: 300, m: { t: 16, r: 52, b: 46, l: 66 } });
    const xs = linear(-0.6, W.length - 0.4, f.x0, f.x1), ys = log(100, 5000, f.y0, f.y1), yw = log(1000, 40000, f.y0, f.y1);
    axes(f, xs, ys, { xt: [], yt: [100, 200, 500, 1000, 2000, 5000], yl: 'cost of the chip ($)', yf: v => '$' + v.toLocaleString('en-US') });
    const ax = el('g', { class: 'axis' }, f.svg);
    for (const v of [1000, 3000, 10000, 30000]) { const t2 = el('text', { x: f.x1 + 6, y: yw(v) + 4 }, ax); t2.textContent = '$' + (v / 1000) + 'k'; }
    const bw = (f.x1 - f.x0) / W.length * 0.6, sel = +ctl.state.node;
    W.forEach((r, i) => {
      const x = xs(i);
      if (r.chips_per_wafer) { const v = r.wafer_usd / r.chips_per_wafer; el('rect', { x: x - bw / 2, y: ys(v), width: bw, height: f.y0 - ys(v), fill: i === sel ? '#f2b84b' : C.s1, opacity: i === sel ? 1 : 0.8 }, f.svg); txt(f.svg, x, ys(v) - 5, '$' + Math.round(v), { 'text-anchor': 'middle', 'font-size': 9.5, fill: C.ink2 }); }
      txt(f.svg, x + 3, f.y0 + 12, r.node, { 'text-anchor': 'end', 'font-size': 10, fill: i === sel ? '#ffd27a' : C.ink2, transform: `rotate(-35 ${x + 3} ${f.y0 + 12})` });
    });
    el('path', { d: path(W.map((r, i) => [xs(i), yw(r.wafer_usd)])), fill: 'none', stroke: '#d55181', 'stroke-width': 2 }, f.svg);
    W.forEach((r, i) => el('circle', { cx: xs(i), cy: yw(r.wafer_usd), r: r.approx ? 4 : 3, fill: r.approx ? 'none' : '#d55181', stroke: '#d55181', 'stroke-width': 1.5 }, f.svg));
    txt(f.svg, xs(W.length - 1) - 4, yw(30000) - 8, 'wafer price', { fill: '#e889a8', 'text-anchor': 'end' });
    txt(f.svg, xs(7.5), ys(1100), '7 → 5 nm:', { fill: '#ff8a7a', 'text-anchor': 'middle', 'font-size': 10.5 }); txt(f.svg, xs(7.5), ys(1100) + 13, 'no cheaper', { fill: '#ff8a7a', 'text-anchor': 'middle', 'font-size': 10.5 });
  }
  loop(sec.querySelector('[data-role=wafer]'), dt => view.draw(dt));
  experiments(sec.querySelector('.lab-exp'), [
    { label: 'A phone chip on a mature process', run: api => api.animate({ area: 100, D0: 0.08, alpha: 3 }, 800), note: 'About 600 dies of 100 mm² fit on a 300 mm wafer, and at 0.08 defects/cm² over nine in ten work. Mature processes reach defect densities below 0.1 per cm²; a new node starts several times higher and is "learned down" over a year or two.' },
    { label: 'A reticle-sized AI chip', run: api => api.animate({ area: 800, D0: 0.1, alpha: 3 }, 800), note: 'An 800 mm² die is close to the largest a scanner can print in one exposure. Only about 60 fit on a wafer and nearly half are hit by a defect. Big GPUs survive this by disabling the damaged cores or memory blocks, which is why products ship with some units switched off.' },
    { label: 'Split it into four chiplets', run: api => api.animate({ area: 200, D0: 0.1, alpha: 3 }, 800), note: 'Four 200 mm² dies give the same silicon area, but each one yields over 80 %, and bad chiplets are discarded before packaging. AMD, Intel and Nvidia now build their largest processors this way.' },
    { label: 'A brand-new node: D₀ = 0.5', run: api => api.animate({ D0: 0.5, area: 100 }, 800), note: 'Early in a node’s life defect densities are high: at 0.5 per cm² a 100 mm² die yields about 63 % instead of 92 %, so each good die costs about 50 % more. That is one reason the first chips on a node are small phone processors: small dies tolerate high defect densities best.' },
    { label: 'No clustering (Poisson)', run: api => { api.animate({ alpha: 30 }, 800); api.set('model', 'poisson'); }, note: 'If defects landed completely independently, large dies would yield far worse. Real defects cluster (scratches, particle showers, edge problems), so many land on dies that are already dead; the negative-binomial α captures this, with α ≈ 1–5 typical.' },
  ], ctl);
  run();
  onWidth([yHost, cHost], () => { drawY(); drawCost(); });
}

export function record(stage, next) {
  stage.innerHTML = `<div class="rec-head"><span class="eyebrow">Monte Carlo yield</span><h2>Defects landing on a 300 mm wafer</h2><span class="rec-state" id="rs"></span></div><canvas></canvas>
    <div class="rec-foot"><span style="color:#7fe0c8">■ good die</span><span style="color:#ff8a55">■ killed by a defect</span><span class="rec-brand">Transistor Odyssey · Process Lab</span></div>`;
  const v = new WaferView(stage.querySelector('canvas')), dd = [Math.sqrt(150 * 1.25), 150 / Math.sqrt(150 * 1.25)];
  v.set(YC.simulateWafer(dd[0], dd[1], 0.3, 2, 5), dd, 0.3);
  return (n = 96) => { const k = next(); if (k % n === 0) v.t = 0; v.draw(1 / 12, 1.25); stage.querySelector('#rs').textContent = '150 mm² dies, D₀ = 0.3 /cm²'; return k + 1; };
}
