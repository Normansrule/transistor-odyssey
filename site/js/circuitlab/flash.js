// Lab 04 — floating-gate flash: Fowler–Nordheim programming, ISPP, multi-level cells, 3D NAND history.
import * as FL from '../physics/flash.js';
import { MEMORY } from './data.js';
import { panel, tiles, experiments, hiCanvas, loop, frame, axes, linear, path, el, C, txt, fw, onWidth, hover, tipRows, clamp, coalesce, reduceMotion } from '../physlab/ui.js';

const MODES = [[1, 'SLC · 1 bit'], [2, 'MLC · 2'], [3, 'TLC · 3'], [4, 'QLC · 4']];
const STEP0 = { 1: 0.5, 2: 0.3, 3: 0.15, 4: 0.05 };
const VERIFY_US = 2, PULSE_US = 10, CELL_NM = 20;
const LEVEL_COLS = ['#8a94a3', '#5aa2ff', '#3cc0b4', '#f2b84b', '#ff8a55', '#d55181', '#9a80dc', '#7fe0c8'];
const levelCol = i => LEVEL_COLS[i % LEVEL_COLS.length];

/** Compute everything for a setting. */
export function model(s) {
  const c = { ...FL.DEFAULT, t_ox_nm: s.tox, alpha: s.alpha };
  const L = FL.levels(s.bits, { step: s.step, sigma: s.sigma });
  const target = L.centres[L.centres.length - 1] - s.step / 2;
  const P = FL.ispp(target, { step: s.step, c, width: PULSE_US * 1e-6 });
  const eps = 3.9 * 8.8541878128e-12, CT = eps / (s.tox * 1e-9) / (1 - s.alpha), area = (CELL_NM * 1e-9) ** 2;
  const electrons = L.centres[L.centres.length - 1] * s.alpha * CT * area / 1.602176634e-19;
  const E0 = s.alpha * (14 - (-2)) / (s.tox * 1e-9);     // first pulse, erased cell
  const reached = P.vt[P.vt.length - 1] >= target;
  const tProg = P.pulses * (PULSE_US + VERIFY_US * (L.n - 1));
  return { c, L, P, target, electrons, E0, reached, tProg, s };
}

export class CellView {
  constructor(canvas) { this.c = hiCanvas(canvas); this.m = null; this.t = 0; this.e = []; }
  set(m) { this.m = m; this.t = 0; this.e = []; }
  draw(dt) {
    const { c, m } = this; c.resize(); const { ctx, w, h } = c; ctx.clearRect(0, 0, w, h); if (!m) return;
    const P = m.P, n = P.pulses, per = 0.36, total = n * per + 1.4;
    this.t = (this.t + dt) % total;
    const k = Math.min(Math.floor(this.t / per), n - 1), inPulse = this.t < n * per && (this.t % per) < per * 0.7;
    const vt = this.t >= n * per ? P.vt[n - 1] : k > 0 ? P.vt[k - 1] + (inPulse ? (P.vt[k] - P.vt[k - 1]) * ((this.t % per) / (per * 0.7)) : P.vt[k] - P.vt[k - 1]) : -2 + (inPulse ? (P.vt[0] + 2) * ((this.t % per) / (per * 0.7)) : P.vt[0] + 2);
    const vcg = inPulse ? P.vcg[k] : 0;
    const narrow = w < 640, sw = narrow ? w : Math.min(w * 0.52, 470), x0 = 16;
    // ---- cross-section
    const gw = Math.min(sw * 0.45, 200), cx = x0 + (narrow ? sw / 2 : Math.min(70 + gw / 2, sw / 2)), yCG = 46, hCG = 42, yONO = yCG + hCG, hONO = 12, yFG = yONO + hONO, hFG = 34, yTox = yFG + hFG, hTox = 14, ySi = yTox + hTox;
    ctx.fillStyle = '#20262f'; ctx.fillRect(x0, ySi, sw - 8, h - ySi - 8);                                  // p-type silicon
    ctx.fillStyle = '#2f4f7e'; ctx.fillRect(x0 + 4, ySi, cx - gw / 2 - x0 - 6, 30); ctx.fillRect(cx + gw / 2 + 2, ySi, sw - 8 - (cx + gw / 2 + 2 - x0) - 4, 30);   // n+ source / drain
    ctx.fillStyle = inPulse ? 'rgba(90,162,255,.5)' : 'rgba(90,162,255,.12)'; ctx.fillRect(cx - gw / 2, ySi, gw, 6);                  // inversion channel
    ctx.fillStyle = '#e0b14d'; ctx.globalAlpha = 0.55; ctx.fillRect(cx - gw / 2, yTox, gw, hTox); ctx.globalAlpha = 1;                // tunnel oxide
    // floating gate: fill shows stored electrons
    const fill = clamp((vt + 2.5) / 7.5, 0, 1);
    ctx.fillStyle = '#3a4352'; ctx.fillRect(cx - gw / 2, yFG, gw, hFG);
    ctx.fillStyle = `rgba(90,162,255,${0.25 + 0.6 * fill})`; ctx.fillRect(cx - gw / 2, yFG + hFG * (1 - fill), gw, hFG * fill);
    ctx.fillStyle = '#9a80dc'; ctx.globalAlpha = 0.45; ctx.fillRect(cx - gw / 2, yONO, gw, hONO); ctx.globalAlpha = 1;                 // inter-poly dielectric
    ctx.fillStyle = inPulse ? '#f2b84b' : '#6b5a34'; ctx.fillRect(cx - gw / 2, yCG, gw, hCG);                                          // control gate
    // electrons: tunnelling up through the oxide during pulses
    const Jlog = inPulse ? Math.log10(Math.max(Math.abs(FL.rate(vt, vcg, m.c)), 1e-30)) : -99;
    if (inPulse && this.e.length < 40 && Math.random() < clamp((Jlog - 2) / 6, 0.05, 0.9)) this.e.push({ x: cx + (Math.random() - 0.5) * gw * 0.9, y: ySi + 3, v: 60 + Math.random() * 60 });
    this.e = this.e.filter(p => (p.y -= p.v * dt) > yFG + hFG * (1 - fill) + 4);
    ctx.fillStyle = '#bcd8ff'; for (const p of this.e) { ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, 7); ctx.fill(); }
    ctx.font = '600 11px "IBM Plex Mono", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const lab = (y, s2, col) => { ctx.fillStyle = col; ctx.fillText(s2, cx + gw / 2 + 8, y); };
    if (!narrow || sw - gw > 220) {
      lab(yCG + hCG / 2, `control gate ${vcg ? vcg.toFixed(1) + ' V' : '0 V'}`, inPulse ? '#ffd27a' : '#aab3c0');
      lab(yONO + hONO / 2, 'blocking oxide', '#c7b6f0'); lab(yFG + hFG / 2, 'floating gate', '#86b6ef'); lab(yTox + hTox / 2, `tunnel oxide ${m.s.tox} nm`, '#e0b14d');
    }
    ctx.fillStyle = '#aab3c0'; ctx.textAlign = 'center'; ctx.fillText('source', x0 + (cx - gw / 2 - x0) / 2, ySi + 15); ctx.fillText('drain', cx + gw / 2 + (sw - (cx + gw / 2 - x0)) / 2, ySi + 15);
    ctx.font = '700 13px "IBM Plex Mono", monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#e8ecf1';
    ctx.fillText(`pulse ${Math.min(k + 1, n)} / ${n}   V_T = ${vt.toFixed(2)} V`, x0 + 4, 20);
    ctx.font = '500 11px "IBM Plex Mono", monospace'; ctx.fillStyle = '#8a94a3';
    ctx.fillText(`target ≥ ${m.target.toFixed(2)} V (top level)`, x0 + 4, h - 16);
    // ---- band diagram across the tunnel oxide
    if (!narrow) {
      const ox = sw + 30, ow = w - ox - 16, oy = 24, oh = h - 52;
      ctx.fillStyle = 'rgba(10,13,17,.6)'; ctx.fillRect(ox, oy, ow, oh); ctx.strokeStyle = '#232a34'; ctx.strokeRect(ox + .5, oy + .5, ow - 1, oh - 1);
      ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, ow, oh); ctx.clip();
      const tox = m.s.tox, Ev = inPulse ? m.s.alpha * (vcg - vt) / tox : 0;   // V/nm across the oxide
      const xL = ox + ow * 0.22, xR = ox + ow * 0.74, E2y = e => oy + oh * 0.28 + (3.4 - e) / 7.5 * oh * 0.62;
      const fg = -Ev * tox;
      ctx.fillStyle = 'rgba(90,162,255,.18)'; ctx.fillRect(ox + 6, E2y(0), xL - ox - 6, oy + oh - 6 - E2y(0));   // Si conduction band (filled with inversion electrons at the edge)
      ctx.fillStyle = 'rgba(90,162,255,.28)'; ctx.fillRect(xR, E2y(fg), ox + ow - 6 - xR, oy + oh - 6 - E2y(fg));
      ctx.strokeStyle = '#e8ecf1'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ox + 6, E2y(0)); ctx.lineTo(xL, E2y(0)); ctx.lineTo(xL, E2y(3.1)); ctx.lineTo(xR, E2y(3.1 + fg)); ctx.lineTo(xR, E2y(fg)); ctx.lineTo(ox + ow - 6, E2y(fg)); ctx.stroke();
      ctx.fillStyle = 'rgba(224,177,77,.12)'; ctx.beginPath(); ctx.moveTo(xL, E2y(0)); ctx.lineTo(xL, E2y(3.1)); ctx.lineTo(xR, E2y(3.1 + fg)); ctx.lineTo(xR, E2y(Math.min(0, fg))); ctx.closePath(); ctx.fill();
      ctx.font = '600 10px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#86b6ef'; ctx.fillText('channel', (ox + xL) / 2, oy + 14); ctx.fillStyle = '#e0b14d'; ctx.fillText('oxide', (xL + xR) / 2, oy + 14); ctx.fillStyle = '#86b6ef'; ctx.fillText('gate (FG)', (xR + ox + ow) / 2, oy + 14);
      ctx.fillStyle = '#aab3c0'; ctx.fillText('φ_B = 3.1 eV', xL + 38, E2y(3.1) - 10);
      if (Ev > 0.05) {
        const d = Math.min(3.1 / Ev, tox), xt = xL + (xR - xL) * d / tox;
        ctx.strokeStyle = '#bcd8ff'; ctx.setLineDash([5, 4]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xL - 10, E2y(0) - 3); ctx.lineTo(xt, E2y(0) - 3); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(xt, E2y(0) - 3); ctx.lineTo(xt - 7, E2y(0) - 8); ctx.moveTo(xt, E2y(0) - 3); ctx.lineTo(xt - 7, E2y(0) + 2); ctx.stroke();
        ctx.fillStyle = '#bcd8ff'; ctx.fillText(`tunnels ${d.toFixed(1)} nm`, (xL + xt) / 2, E2y(0) + 16);
        ctx.fillStyle = '#ffd27a'; ctx.fillText(`E = ${(Ev * 10).toFixed(1)} MV/cm`, (xL + xR) / 2, oy + oh - 12);
      } else { ctx.fillStyle = '#8a94a3'; ctx.fillText('no field: the charge is trapped (retention)', (xL + xR) / 2, oy + oh - 12); }
      ctx.restore();
    }
  }
}

export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'bits', type: 'seg', label: 'Bits per cell', options: MODES, value: 3 },
    { key: 'step', label: 'ISPP step', min: 0.02, max: 0.8, step: 0.01, value: 0.15, fmt: v => (v * 1000).toFixed(0) + ' mV' },
    { key: 'sigma', label: 'Noise and interference σ', min: 0.01, max: 0.15, step: 0.005, value: 0.04, fmt: v => (v * 1000).toFixed(0) + ' mV' },
    { key: 'tox', label: 'Tunnel oxide thickness', min: 6, max: 10, step: 0.1, value: 8, fmt: v => v.toFixed(1) + ' nm' },
    { key: 'alpha', label: 'Gate coupling ratio α_G', min: 0.4, max: 0.75, step: 0.01, value: 0.6, fmt: v => v.toFixed(2) },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'lv', label: 'Threshold levels', unit: '2^bits in one window' }, { key: 'mg', label: 'Read margin', unit: 'mV between levels' },
    { key: 'np', label: 'Pulses for the top level', unit: `ISPP, ${PULSE_US} µs each` }, { key: 'tp', label: 'Program time', unit: 'µs incl. verify reads' },
    { key: 'el', label: 'Stored electrons', unit: `top level, ${CELL_NM} nm planar cell` }, { key: 'E', label: 'Oxide field, 1st pulse', unit: 'MV/cm' },
  ]);
  const view = new CellView(sec.querySelector('[data-role=fgcell] canvas'));
  const ipHost = sec.querySelector('[data-role=ispp]'), dsHost = sec.querySelector('[data-role=dist]'), lyHost = sec.querySelector('[data-role=layers]');
  let M = null;
  const heavy = coalesce(() => { view.set(M); drawISPP(); drawDist(); });
  ctl.on((k, final) => {
    if (k === 'bits') ctl.set('step', STEP0[ctl.state.bits], false);
    compute(); if (final) { view.set(M); drawISPP(); drawDist(); } else heavy();
  });
  function compute() {
    const s = ctl.state; M = model(s);
    const mg = M.L.margin * 1000;
    show({ lv: M.L.n, mg: `<span style="color:${mg < 0 ? '#ff8a7a' : mg < 100 ? '#ffd27a' : '#7fe0c8'}">${mg.toFixed(0)}</span>`,
      np: M.reached ? M.P.pulses : `> ${M.P.pulses}`, tp: M.tProg.toFixed(0), el: Math.round(M.electrons), E: (M.E0 / 1e8).toFixed(1) });
  }
  function drawISPP() {
    const P = M.P, n = P.pulses, f = frame(ipHost, { w: fw(ipHost), h: 300, m: { t: 16, r: 50, b: 40, l: 50 } });
    const xs = linear(0, Math.max(n, 2) + 0.5, f.x0, f.x1), ys = linear(-3, 5.5, f.y0, f.y1);
    const gmin = 13, gmax = Math.max(22, P.vcg[n - 1] + 1), gs = linear(gmin, gmax, f.y0, f.y1);
    const xt = []; const st = n > 60 ? 20 : n > 24 ? 10 : n > 10 ? 4 : 2; for (let i = 0; i <= n; i += st) xt.push(i);
    axes(f, xs, ys, { xt, yt: [-2, 0, 2, 4], xl: 'program pulse', yl: 'threshold V_T (V)', xf: String, yf: String });
    const ax = el('g', { class: 'axis' }, f.svg);
    for (const v of [14, 16, 18, 20, 22].filter(v => v <= gmax)) { const t2 = el('text', { x: f.x1 + 8, y: gs(v) + 4 }, ax); t2.textContent = v + ' V'; }
    el('path', { d: path(P.vcg.flatMap((v, i) => [[xs(i + 0.5), gs(v)], [xs(i + 1.5), gs(v)]])), fill: 'none', stroke: 'rgba(242,184,75,.55)', 'stroke-width': 1.6 }, f.svg);
    el('line', { x1: f.x0, x2: f.x1, y1: ys(M.target), y2: ys(M.target), stroke: '#7fe0c8', 'stroke-dasharray': '5 4' }, f.svg);
    txt(f.svg, f.x0 + 6, ys(M.target) - 6, `verify level ${M.target.toFixed(2)} V`, { fill: '#7fe0c8' });
    el('path', { d: path([[xs(0), ys(-2)], ...P.vt.map((v, i) => [xs(i + 1), ys(v)])]), fill: 'none', stroke: C.s1, 'stroke-width': 2.2 }, f.svg);
    if (n <= 60) P.vt.forEach((v, i) => el('circle', { cx: xs(i + 1), cy: ys(v), r: 3, fill: C.s1 }, f.svg));
    txt(f.svg, xs(0.6), gs(P.vcg[0]) + 16, 'control-gate pulse (right axis)', { fill: '#ffd27a' });
    hover(f, ipHost, xs, x => { const i = clamp(Math.round(x) - 1, 0, n - 1); return tipRows(`pulse ${i + 1}`, [['V_CG', P.vcg[i].toFixed(2) + ' V'], ['V_T after', P.vt[i].toFixed(3) + ' V'], ['ΔV_T', (P.vt[i] - (i ? P.vt[i - 1] : -2)).toFixed(3) + ' V']]); });
  }
  function drawDist() {
    const L = M.L, s = ctl.state, f = frame(dsHost, { w: fw(dsHost), h: 300, m: { t: 16, r: 16, b: 40, l: 30 } });
    const xs = linear(-4.2, 5.6, f.x0, f.x1), ys = linear(0, 1.12, f.y0, f.y1);
    axes(f, xs, ys, { xt: [-4, -2, 0, 2, 4], yt: [], xl: 'threshold voltage V_T (V)', xf: String });
    const N = 500, xsv = Array.from({ length: N }, (_, i) => -4.2 + 9.8 * i / (N - 1));
    const curves = L.centres.map((cc, i) => xsv.map(x => FL.distribution(x, cc, s.step, s.sigma, i === 0)));
    // overlap between neighbours: shade where both exceed 1 %
    for (let i = 0; i + 1 < curves.length; i++) {
      const pts = []; xsv.forEach((x, j) => { const o = Math.min(curves[i][j], curves[i + 1][j]); if (o > 0.01) pts.push([x, o]); });
      if (pts.length > 1) el('path', { d: path([[xs(pts[0][0]), ys(0)], ...pts.map(p => [xs(p[0]), ys(p[1])]), [xs(pts[pts.length - 1][0]), ys(0)]]) + 'Z', fill: 'rgba(255,93,93,.55)' }, f.svg);
    }
    curves.forEach((cv, i) => {
      el('path', { d: path(xsv.map((x, j) => [xs(x), ys(cv[j])])), fill: levelCol(i), 'fill-opacity': 0.18, stroke: levelCol(i), 'stroke-width': 1.6 }, f.svg);
      if (L.n <= 8) txt(f.svg, xs(L.centres[i]), ys(Math.max(...cv)) - 6 - (L.n === 8 && i % 2 ? 12 : 0), i === 0 ? 'erased' : (L.n === 2 ? '0' : i.toString(2).padStart(Math.log2(L.n), '0')), { fill: levelCol(i), 'text-anchor': 'middle', 'font-size': 10.5 });
    });
    for (const r of L.reads) el('line', { x1: xs(r), x2: xs(r), y1: f.y0, y2: f.y1 + 18, stroke: '#e8ecf1', 'stroke-dasharray': '3 4', opacity: 0.6 }, f.svg);
    txt(f.svg, f.x0 + 4, f.y1 + 6, `${L.n} levels · spacing ${L.n > 2 ? (L.spacing * 1000).toFixed(0) + ' mV' : '—'} · width ${(L.width * 1000).toFixed(0)} mV`, { fill: C.ink2 });
  }
  function drawLayers() {
    const rows = MEMORY.nand, f = frame(lyHost, { w: fw(lyHost), h: 280, m: { t: 18, r: 24, b: 40, l: 54 } });
    const xs = linear(1985, 2026, f.x0, f.x1), ys = linear(0, 350, f.y0, f.y1);
    axes(f, xs, ys, { xt: [1987, 1995, 2003, 2007, 2013, 2019, 2024], yt: [0, 100, 200, 300], xl: 'year', yl: 'stacked layers', xf: String, yf: String });
    const v = rows.filter(r => r.layers > 1);
    el('path', { d: path(v.map(r => [xs(r.year), ys(r.layers)])), fill: 'none', stroke: '#f2b84b', 'stroke-width': 2.2 }, f.svg);
    const tip = document.createElement('div'); tip.className = 'chart-tip'; tip.style.display = 'none'; lyHost.appendChild(tip);
    for (const r of rows) {
      const d = el('circle', { cx: xs(r.year), cy: ys(r.layers), r: r.layers > 1 ? 5 : 4, fill: r.layers > 1 ? '#f2b84b' : C.s1, stroke: C.surface, 'stroke-width': 1.5, style: 'cursor:help' }, f.svg);
      if (r.layers > 1 && (r.layers >= 96 || r.layers === 24)) txt(f.svg, xs(r.year) - 6, ys(r.layers) - 9, String(r.layers), { fill: '#ffd27a', 'text-anchor': 'end', 'font-size': 10.5 });
      d.addEventListener('pointerenter', e => { tip.innerHTML = tipRows(`${r.year} · ${r.maker}`, [['layers', r.layers > 1 ? r.layers : 'planar'], ['', r.note]]); tip.style.display = 'block'; const b = lyHost.getBoundingClientRect(); tip.style.left = Math.min(e.clientX - b.left + 12, b.width - 220) + 'px'; tip.style.top = (e.clientY - b.top + 12) + 'px'; });
      d.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
    }
    txt(f.svg, xs(1987) + 8, ys(0) - 12, 'NAND cell string (Toshiba)', { fill: '#86b6ef' });
    txt(f.svg, xs(2007) - 6, ys(0) - 14, 'BiCS 3D concept', { fill: '#86b6ef', 'text-anchor': 'end' });
  }
  loop(sec.querySelector('[data-role=fgcell]'), dt => view.draw(reduceMotion ? dt * 0.3 : dt));
  experiments(sec.querySelector('.lab-exp'), [
    { label: 'One bit per cell (SLC)', run: api => api.set('bits', 1), note: 'Two states, erased (negative V_T) and programmed, separated by volts. SLC is fast to write, survives around 100,000 erase cycles and is what SSD caches and industrial parts use.' },
    { label: 'Four bits: 16 levels in the same window (QLC)', run: api => api.set('bits', 4), note: 'Sixteen levels squeeze into the same ~7 V window, so each must be programmed to within a few tens of millivolts: tiny ISPP steps, about 80 pulses and a read margin of a few tens of mV. QLC is the cheapest storage per bit, and the slowest and least durable.' },
    { label: 'QLC with an MLC-sized step', run: api => { api.set('bits', 4); api.animate({ step: 0.3 }, 700); }, note: 'Larger steps program faster but leave each level one step wide. The distributions now overlap (red): a read cannot tell neighbouring states apart. Every extra bit per cell costs write speed for exactly this reason.' },
    { label: 'Thicker tunnel oxide', run: api => api.animate({ tox: 10 }, 800), note: 'At the same voltages the oxide field drops and Fowler–Nordheim current falls exponentially, so programming needs more pulses (or higher voltages). The payoff is retention: a thicker oxide leaks less charge over ten years at 85 °C. Tunnel oxides have stayed near 7–8 nm since the 1990s, unlike logic gate oxides.' },
    { label: 'Raise the coupling ratio', run: api => api.animate({ alpha: 0.72 }, 800), note: 'A larger share of the control-gate voltage lands across the tunnel oxide, so the same pulse programs harder. Planar NAND wrapped the control gate around the floating gate to get α ≈ 0.6; at 15 nm there was no room to do so, one reason the industry went 3D.' },
  ], ctl);
  compute(); view.set(M); drawISPP(); drawDist(); drawLayers();
  onWidth([ipHost, dsHost, lyHost], () => { drawISPP(); drawDist(); drawLayers(); });
}

/** Record mode: a TLC cell being programmed. */
export function record(stage, next) {
  stage.innerHTML = `<div class="rec-head"><span class="eyebrow">Fowler–Nordheim tunnelling</span><h2>Programming a flash cell</h2><span class="rec-state" id="rs"></span></div><canvas></canvas>
    <div class="rec-foot"><span style="color:#bcd8ff">● electron</span><span style="color:#e0b14d">tunnel oxide</span><span class="rec-brand">Transistor Odyssey · Circuit Lab</span></div>`;
  const v = new CellView(stage.querySelector('canvas'));
  const m = model({ bits: 2, step: 0.3, sigma: 0.04, tox: 8, alpha: 0.6 }); v.set(m);
  return () => { const k = next(); v.draw(1 / 12); stage.querySelector('#rs').textContent = `MLC · ${m.P.pulses} pulses`; return k + 1; };
}
