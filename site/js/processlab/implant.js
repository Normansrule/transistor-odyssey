// Lab 02 — ion implantation (LSS ranges) and diffusion anneal.
import * as IM from '../physics/implant.js';
import { panel, tiles, experiments, hiCanvas, loop, frame, axes, linear, log, path, el, C, txt, fw, onWidth, hover, tipRows, clamp, coalesce, sci, reduceMotion } from '../physlab/ui.js';

const ION_COL = { B: '#ff8a55', P: '#5aa2ff', As: '#3cc0b4', Sb: '#b58fd6' };
const fmtNm = v => v >= 1000 ? (v / 1000).toFixed(2) + ' µm' : v.toFixed(v < 10 ? 1 : 0) + ' nm';
const fmtS = s => s < 60 ? s.toFixed(s < 10 ? 1 : 0) + ' s' : s < 3600 ? (s / 60).toFixed(s < 600 ? 1 : 0) + ' min' : (s / 3600).toFixed(1) + ' h';

/** Gaussian sample via Box–Muller with a supplied uniform generator. */
const gauss = rnd => Math.sqrt(-2 * Math.log(Math.max(rnd(), 1e-12))) * Math.cos(2 * Math.PI * rnd());

export class ImplantView {
  constructor(cv, rnd = Math.random) { this.c = hiCanvas(cv); this.rnd = rnd; this.ions = []; this.hist = new Float64Array(60); this.m = null; this.ann = 0; }
  set(m) { this.m = m; this.ions = []; this.hist.fill(0); this.ann = 0; this.total = 0; }
  draw(dt) {
    const { c, m, rnd } = this; c.resize(); const { ctx, w, h } = c; ctx.clearRect(0, 0, w, h); if (!m) return;
    const narrow = w < 560, sw = narrow ? w - 24 : w * 0.62, x0 = 12, yS = 66, depthMax = m.Rp + 4.5 * Math.max(m.sigAnn, m.dRp);
    const Y = d => yS + d / depthMax * (h - yS - 26);
    // crystal
    ctx.fillStyle = '#1d242e'; ctx.fillRect(x0, yS, sw, h - yS);
    const a = Math.max(8, 18 * (60 / depthMax) ** 0.3);
    ctx.fillStyle = 'rgba(160,180,210,.22)';
    for (let yy = yS + a / 2, r = 0; yy < h; yy += a * 0.866, r++) for (let xx = x0 + (r % 2) * a / 2 + a / 4; xx < x0 + sw; xx += a) { ctx.beginPath(); ctx.arc(xx, yy, 1.6, 0, 7); ctx.fill(); }
    ctx.strokeStyle = 'rgba(232,236,241,.4)'; ctx.beginPath(); ctx.moveTo(x0, yS); ctx.lineTo(x0 + sw, yS); ctx.stroke();
    // spawn ions while implanting
    const implanting = this.total < 260;
    if (implanting && Math.random() < 0.9) for (let n = 0; n < 2; n++) {
      const stop = Math.max(m.Rp + m.dRp * gauss(rnd), 0.5);
      const xs = x0 + 20 + rnd() * (sw - 40), pts = [[xs, yS - 16]], seg = 8 + Math.floor(rnd() * 6);
      let px = xs, d = 0;
      for (let k = 1; k <= seg; k++) { d = stop * (1 - (1 - k / seg) ** 1.6); px += (rnd() - 0.5) * (k / seg) ** 1.5 * a * 2.2; pts.push([px, d]); }
      this.ions.push({ pts, t: 0, stop, final: px }); this.total++;
    }
    const col = ION_COL[m.ion];
    for (const io of this.ions) {
      io.t = Math.min(io.t + dt * (reduceMotion ? 0.6 : 2.2), 1.6);
      const n = io.pts.length - 1, upto = Math.min(io.t, 1) * n;
      if (io.t < 1.4) {
        ctx.strokeStyle = col; ctx.globalAlpha = Math.max(0, 1 - Math.max(io.t - 1, 0) * 2.5) * 0.7; ctx.lineWidth = 1.2; ctx.beginPath();
        for (let k = 0; k <= Math.floor(upto); k++) { const [x, d] = io.pts[k]; const yy = k === 0 ? yS - 16 : Y(d); k ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
        ctx.stroke(); ctx.globalAlpha = 1;
      }
      if (io.t >= 1 && !io.counted) { io.counted = true; const b = Math.floor(io.stop / depthMax * this.hist.length); if (b >= 0 && b < this.hist.length) this.hist[b]++; }
      const k = Math.min(Math.floor(upto), n), [x, d] = io.pts[k];
      // after the anneal starts, settled ions spread by sqrt(2Dt)
      const spread = io.t >= 1 ? this.ann * (m.sigAnn - m.dRp) * (io.jit ??= gauss(rnd)) : 0;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, k === 0 ? yS - 16 : Y(clamp(d + spread, 0, depthMax)), 2.4, 0, 7); ctx.fill();
    }
    if (!implanting && this.ions.every(io => io.t >= 1)) this.ann = Math.min(this.ann + dt * (m.anneal ? 0.35 : 0), 1);
    // glow during anneal
    if (m.anneal && this.ann > 0 && this.ann < 1) { ctx.fillStyle = `rgba(255,140,60,${0.12 * Math.sin(Math.PI * this.ann)})`; ctx.fillRect(x0, yS, sw, h - yS); }
    // junction line
    if (m.xj > 0 && m.xj < depthMax) { const xj = m.anneal ? m.xj0 + (m.xj - m.xj0) * this.ann : m.xj0; ctx.setLineDash([6, 4]); ctx.strokeStyle = '#e8ecf1'; ctx.beginPath(); ctx.moveTo(x0, Y(xj)); ctx.lineTo(x0 + sw, Y(xj)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#e8ecf1'; ctx.font = '600 11px "IBM Plex Mono", monospace'; ctx.textAlign = 'right'; ctx.fillText(`junction ${fmtNm(xj)}`, x0 + sw - 6, Y(xj) - 7); }
    ctx.textAlign = 'left'; ctx.font = '600 13px "IBM Plex Mono", monospace'; ctx.fillStyle = '#e8ecf1';
    ctx.fillText(`${IM.IONS[m.ion].name} ${m.E.toFixed(m.E < 10 ? 1 : 0)} keV → Si`, x0 + 6, 18);
    ctx.font = '500 11px "IBM Plex Mono", monospace'; ctx.fillStyle = '#aab3c0';
    ctx.fillText(implanting ? 'implanting…' : m.anneal ? (this.ann < 1 ? 'annealing: dopants diffuse' : `annealed ${m.annT} °C, ${fmtS(m.annt)}`) : 'as implanted (no anneal)', x0 + 6, 36);
    // depth axis
    ctx.fillStyle = '#8a94a3'; ctx.textAlign = 'left';
    for (const fr of [0.25, 0.5, 0.75, 1]) { const d = depthMax * fr; ctx.fillText(fmtNm(d), x0 + 4, Y(d) - 3); }
    // histogram
    if (!narrow) {
      const hx = sw + 30, hw = w - hx - 16, mx = Math.max(...this.hist, 1);
      ctx.fillStyle = '#e8ecf1'; ctx.font = '600 12px "IBM Plex Sans", sans-serif'; ctx.fillText('Where the ions stopped', hx, 30);
      const bh = (Y(depthMax) - yS) / this.hist.length;
      for (let i = 0; i < this.hist.length; i++) { ctx.fillStyle = col; ctx.globalAlpha = 0.75; ctx.fillRect(hx, yS + i * bh, this.hist[i] / mx * hw * 0.9, bh - 1); }
      ctx.globalAlpha = 1;
      // Gaussian overlay (current, as-implanted → annealed)
      const sig = m.dRp + (m.sigAnn - m.dRp) * this.ann, pk = m.dRp / sig;
      ctx.strokeStyle = '#e8ecf1'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i <= 120; i++) { const d = depthMax * i / 120, v = pk * Math.exp(-((d - m.Rp) ** 2) / (2 * sig * sig)); const xx = hx + v * hw * 0.9, yy = Y(d); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
      ctx.stroke();
      ctx.font = '500 11px "IBM Plex Mono", monospace'; ctx.fillStyle = '#aab3c0';
      ctx.fillText(`R_p = ${fmtNm(m.Rp)}`, hx, h - 34); ctx.fillText(`ΔR_p = ${fmtNm(sig)}`, hx, h - 18);
    }
  }
}

export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'ion', type: 'seg', label: 'Dopant', options: [['B', 'Boron (p)'], ['P', 'Phosphorus (n)'], ['As', 'Arsenic (n)'], ['Sb', 'Antimony (n)']], value: 'As' },
    { key: 'E', label: 'Implant energy', min: 1, max: 500, log: true, value: 30, fmt: v => v.toFixed(v < 10 ? 1 : 0) + ' keV' },
    { key: 'dose', label: 'Dose', min: 1e12, max: 1e16, log: true, value: 2e15, fmt: v => sci(v) + ' cm⁻²' },
    { key: 'bg', label: 'Background doping (opposite type)', min: 1e14, max: 1e18, log: true, value: 1e17, fmt: v => sci(v) + ' cm⁻³' },
    { key: 'anneal', type: 'toggle', label: 'Anneal after implant', value: true },
    { key: 'annT', label: 'Anneal temperature', min: 800, max: 1150, step: 5, value: 1000, fmt: v => v.toFixed(0) + ' °C' },
    { key: 'annt', label: 'Anneal time', min: 1, max: 36000, log: true, value: 10, fmt: fmtS },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'rp', label: 'Projected range R_p', unit: 'LSS theory' }, { key: 'drp', label: 'Straggle ΔR_p', unit: 'as implanted' },
    { key: 'pk', label: 'Peak concentration', unit: 'cm⁻³ after anneal' }, { key: 'xj', label: 'Junction depth x_j', unit: 'where N = background' },
    { key: 'rs', label: 'Sheet resistance', unit: 'Ω/□' }, { key: 'dl', label: 'Diffusion length √(Dt)', unit: '' },
  ]);
  const view = new ImplantView(sec.querySelector('[data-role=imp] canvas'));
  const pHost = sec.querySelector('[data-role=prof]'), rHost = sec.querySelector('[data-role=range]');
  let M = null;
  const later = coalesce(() => { view.set(M); drawProfile(); drawRange(); });
  ctl.on((k, final) => { compute(); if (final) { view.set(M); drawProfile(); drawRange(); } else later(); });
  function compute() {
    const s = ctl.state, r = IM.rangeStats(s.ion, s.E);
    const j0 = IM.junction(s.ion, s.E, s.dose, s.bg), j = s.anneal ? IM.junction(s.ion, s.E, s.dose, s.bg, s.annT, s.annt) : j0;
    M = { ion: s.ion, E: s.E, Rp: r.Rp, dRp: r.dRp, sigAnn: j.sigma_nm, xj: j.xj, xj0: j0.xj, anneal: s.anneal, annT: s.annT, annt: s.annt, j, j0 };
    const L = s.anneal ? Math.sqrt(IM.diffusivity(s.ion, s.annT) * s.annt) * 1e7 : 0;
    show({ rp: fmtNm(r.Rp), drp: fmtNm(r.dRp), pk: sci(j.peak), xj: j.xj > 0 ? fmtNm(j.xj) : '<span style="color:#ff8a7a">no junction</span>', rs: isFinite(j.Rs) ? (j.Rs < 100 ? j.Rs.toFixed(1) : j.Rs.toFixed(0)) : '—', dl: s.anneal ? fmtNm(L) : 'no anneal' });
  }
  function drawProfile() {
    const s = ctl.state, f = frame(pHost, { w: fw(pHost), h: 300, m: { t: 14, r: 16, b: 40, l: 56 } });
    const dmax = Math.max(M.Rp + 5 * M.sigAnn, M.xj * 1.25, 20), xs = linear(0, dmax, f.x0, f.x1), ys = log(1e14, 1e22, f.y0, f.y1);
    const step = dmax > 2000 ? 500 : dmax > 800 ? 200 : dmax > 300 ? 100 : dmax > 120 ? 50 : dmax > 50 ? 20 : 10, xt = []; for (let v = 0; v <= dmax; v += step) xt.push(v);
    axes(f, xs, ys, { xt, yt: [1e14, 1e16, 1e18, 1e20, 1e22], xl: 'depth (nm)', yl: 'concentration (cm⁻³)', xf: String, yf: v => '10' + ['¹⁴', '¹⁶', '¹⁸', '²⁰', '²²'][Math.round((Math.log10(v) - 14) / 2)] });
    const N = 200, d = Array.from({ length: N }, (_, i) => dmax * i / (N - 1));
    const curve = (sig, dash, col, wdt) => el('path', { d: path(d.map(x => [xs(x), ys(Math.max(IM.profileAt(x, s.dose, M.Rp, sig), 1e14))])), fill: 'none', stroke: col, 'stroke-width': wdt, 'stroke-dasharray': dash }, f.svg);
    curve(M.dRp, '5 4', C.muted, 1.4);
    if (s.anneal) curve(M.sigAnn, null, ION_COL[s.ion], 2.4);
    el('line', { x1: f.x0, x2: f.x1, y1: ys(s.bg), y2: ys(s.bg), stroke: '#8a94a3', 'stroke-width': 1.5 }, f.svg);
    txt(f.svg, f.x1 - 4, ys(s.bg) - 6, 'background', { 'text-anchor': 'end', fill: C.ink2 });
    if (M.xj > 0) { el('line', { x1: xs(M.xj), x2: xs(M.xj), y1: f.y0, y2: f.y1, stroke: '#e8ecf1', 'stroke-dasharray': '3 4' }, f.svg); txt(f.svg, xs(M.xj) + 4, f.y1 + 12, `x_j ${fmtNm(M.xj)}`, { fill: '#e8ecf1' }); }
    el('line', { x1: f.x0, x2: f.x1, y1: ys(5e20), y2: ys(5e20), stroke: '#d55181', 'stroke-dasharray': '2 5', opacity: 0.6 }, f.svg);
    txt(f.svg, f.x1 - 4, ys(5e20) + 13, 'activation saturates above ~5×10²⁰', { 'text-anchor': 'end', fill: '#e889a8', 'font-size': 10 });
    hover(f, pHost, xs, x => tipRows(`depth ${fmtNm(x)}`, [['as implanted', sci(IM.profileAt(x, s.dose, M.Rp, M.dRp)) + ' cm⁻³'], ...(s.anneal ? [['annealed', sci(IM.profileAt(x, s.dose, M.Rp, M.sigAnn)) + ' cm⁻³']] : [])]));
  }
  function drawRange() {
    const s = ctl.state, f = frame(rHost, { w: fw(rHost), h: 300, m: { t: 14, r: 16, b: 40, l: 56 } });
    const xs = log(1, 1000, f.x0, f.x1), ys = log(1, 3000, f.y0, f.y1);
    axes(f, xs, ys, { xt: [1, 10, 100, 1000], yt: [1, 10, 100, 1000], xl: 'energy (keV)', yl: 'projected range R_p (nm)', xf: String, yf: v => v >= 1000 ? '1 µm' : String(v) });
    const Es = Array.from({ length: 30 }, (_, i) => 10 ** (3 * i / 29)), labs = [];
    for (const ion of Object.keys(IM.IONS)) {
      const on = ion === s.ion, col = ION_COL[ion];
      el('path', { d: path(Es.map(E => [xs(E), ys(IM.rangeStats(ion, E, 300).Rp)])), fill: 'none', stroke: col, 'stroke-width': on ? 2.6 : 1.4, opacity: on ? 1 : 0.65 }, f.svg);
      const Ec = IM.crossoverKeV(ion);
      if (Ec <= 1000) el('circle', { cx: xs(Ec), cy: ys(IM.rangeStats(ion, Ec, 300).Rp), r: 4.5, fill: 'none', stroke: col, 'stroke-width': 1.6 }, f.svg);
      labs.push([ion, ys(IM.rangeStats(ion, 1000, 300).Rp), col]);
    }
    labs.sort((a, b) => a[1] - b[1]); for (let i = 1; i < labs.length; i++) labs[i][1] = Math.max(labs[i][1], labs[i - 1][1] + 13);
    for (const [ion, y, col] of labs) txt(f.svg, f.x1 - 6, y + 4, ion, { 'text-anchor': 'end', fill: col, 'font-size': 11 });
    el('circle', { cx: xs(s.E), cy: ys(M.Rp), r: 5.5, fill: '#e8ecf1', stroke: C.surface, 'stroke-width': 2 }, f.svg);
    hover(f, rHost, xs, E => tipRows(`${E.toFixed(E < 10 ? 1 : 0)} keV`, Object.keys(IM.IONS).map(i => [i, fmtNm(IM.rangeStats(i, E, 300).Rp)])));
  }
  loop(sec.querySelector('[data-role=imp]'), dt => view.draw(dt));
  experiments(sec.querySelector('.lab-exp'), [
    { label: 'Shallow arsenic source/drain', run: api => { api.set('ion', 'As'); api.set('anneal', true); api.animate({ E: 5, dose: 2e15, annT: 1050, annt: 2 }, 900); }, note: 'Heavy arsenic at a few keV stops within about 10 nm, and a 2-second spike anneal lets it move only a few nanometres. This is how 2000s-era transistors got junctions shallow enough to fight short-channel effects; a low sheet resistance needs a high dose packed near the surface.' },
    { label: 'Boron goes deep', run: api => { api.set('ion', 'B'); api.animate({ E: 30, dose: 1e15 }, 900); }, note: 'Boron is light, so it loses energy mainly to electrons and travels far: about 100 nm at 30 keV, against about 25 nm for arsenic. It also diffuses fast. Making shallow p-type junctions was hard enough that fabs implanted BF₂ molecules instead, so each boron atom arrives with a fraction of the energy.' },
    { label: 'A deep retrograde well', run: api => { api.set('ion', 'P'); api.animate({ E: 400, dose: 5e12, bg: 1e15 }, 900); }, note: 'Hundreds of keV put phosphorus half a micrometre down, forming the n-well that pFETs sit in. A buried peak keeps the surface lightly doped (good mobility) while suppressing latch-up and punch-through underneath.' },
    { label: 'Over-anneal: an hour at 1100 °C', run: api => { api.set('anneal', true); api.animate({ annT: 1100, annt: 3600 }, 900); }, note: 'The dopants spread by √(Dt), hundreds of nanometres, and the junction runs away. Each generation cut the thermal budget, from hour-long furnace anneals to one-second rapid thermal anneals to millisecond laser and flash anneals.' },
  ], ctl);
  compute(); view.set(M); drawProfile(); drawRange();
  onWidth([pHost, rHost], () => { drawProfile(); drawRange(); });
}

export function record(stage, next) {
  stage.innerHTML = `<div class="rec-head"><span class="eyebrow">LSS theory · Monte Carlo trajectories</span><h2>Implanting arsenic</h2><span class="rec-state" id="rs"></span></div><canvas></canvas>
    <div class="rec-foot"><span style="color:#3cc0b4">— ion path</span><span>histogram: where they stopped</span><span class="rec-brand">Transistor Odyssey · Process Lab</span></div>`;
  let a = 99; const rnd = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
  Math.random = rnd;
  const v = new ImplantView(stage.querySelector('canvas'), rnd);
  const r = IM.rangeStats('As', 40), j0 = IM.junction('As', 40, 2e15, 1e17), j = IM.junction('As', 40, 2e15, 1e17, 1000, 30);
  v.set({ ion: 'As', E: 40, Rp: r.Rp, dRp: r.dRp, sigAnn: j.sigma_nm, xj: j.xj, xj0: j0.xj, anneal: true, annT: 1000, annt: 30 });
  return () => { const k = next(); v.draw(1 / 12); stage.querySelector('#rs').textContent = '40 keV · 2×10¹⁵ cm⁻²'; return k + 1; };
}
