// Lab 01 — Deal–Grove thermal oxidation.
import * as OX from '../physics/oxidation.js';
import { panel, tiles, experiments, hiCanvas, loop, frame, axes, linear, log, path, el, C, txt, fw, onWidth, hover, tipRows, clamp, coalesce, reduceMotion } from '../physlab/ui.js';

const fmtX = um => um < 0.1 ? (um * 1000).toFixed(um < 0.01 ? 2 : 1) + ' nm' : um.toFixed(3) + ' µm';
const fmtT = h => h < 1 / 60 ? (h * 3600).toFixed(0) + ' s' : h < 1 ? (h * 60).toFixed(h < 0.1 ? 1 : 0) + ' min' : h.toFixed(h < 10 ? 2 : 1) + ' h';

export class OxideView {
  constructor(cv) { this.c = hiCanvas(cv); this.mol = []; this.s = null; this.phase = 0; }
  set(s) { this.s = s; }
  /** Draws the cross-section at a fraction f of the anneal time (0..1). */
  draw(dt, f) {
    const { c, s } = this; c.resize(); const { ctx, w, h } = c; ctx.clearRect(0, 0, w, h); if (!s) return;
    const tNow = s.t * f * f, x = OX.thickness(s.amb, s.T, tNow, s.orient, s.p), xEnd = OX.thickness(s.amb, s.T, s.t, s.orient, s.p);
    const narrow = w < 560, sw = narrow ? w - 24 : w * 0.56, x0 = 12;
    const scale = (h * 0.55) / Math.max(xEnd, 0.02);               // px per µm, fit the final oxide into ~55 % of the height
    const y0 = h * 0.30;                                             // original silicon surface
    const yTop = y0 - (1 - OX.SI_CONSUMED) * x * scale, yInt = y0 + OX.SI_CONSUMED * x * scale;
    // ambient
    ctx.fillStyle = 'rgba(255,140,60,.06)'; ctx.fillRect(x0, 0, sw, yTop);
    // silicon
    const g = ctx.createLinearGradient(0, yInt, 0, h); g.addColorStop(0, '#3a4658'); g.addColorStop(1, '#1d232c');
    ctx.fillStyle = g; ctx.fillRect(x0, yInt, sw, h - yInt);
    ctx.fillStyle = 'rgba(160,180,210,.12)';
    for (let yy = yInt + 6; yy < h; yy += 12) for (let xx = x0 + ((yy / 12 | 0) % 2) * 6; xx < x0 + sw; xx += 12) ctx.fillRect(xx, yy, 2, 2);
    // oxide
    ctx.fillStyle = 'rgba(224,177,77,.42)'; ctx.fillRect(x0, yTop, sw, yInt - yTop);
    ctx.strokeStyle = '#e0b14d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, yInt); ctx.lineTo(x0 + sw, yInt); ctx.stroke();
    ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(232,236,241,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + sw, y0); ctx.stroke(); ctx.setLineDash([]);
    // oxidant molecules: arrive at the top, random-walk down, react at the interface
    const reg = OX.regime(s.amb, s.T, Math.max(x, 1e-4), s.orient);           // 0 reaction-limited … 1 diffusion-limited
    const want = 40 + 60 * reg;
    if (this.mol.length < want && Math.random() < 0.8) this.mol.push({ x: x0 + Math.random() * sw, u: 0, v: 0 });
    const col = s.amb === 'wet' ? '#7fd3d0' : '#ff7a7a';
    this.mol = this.mol.filter(m => {
      m.u += (0.25 + 0.9 * (1 - reg)) * dt * (reduceMotion ? 0.3 : 1) + (Math.random() - 0.45) * 0.06;
      m.x += (Math.random() - 0.5) * 3;
      if (m.u >= 1) { m.v += dt * 3; if (m.v > 0.4) return false; }
      return true;
    });
    for (const m of this.mol) {
      const y = yTop - 14 + clamp(m.u, 0, 1) * (yInt - yTop + 14);
      ctx.fillStyle = m.u >= 1 ? `rgba(255,236,190,${1 - m.v * 2.5})` : col;
      ctx.beginPath(); ctx.arc(clamp(m.x, x0 + 3, x0 + sw - 3), y, m.u >= 1 ? 4 * (1 - m.v) + 1 : 2.4, 0, 7); ctx.fill();
      if (s.amb === 'dry' && m.u < 1) { ctx.beginPath(); ctx.arc(clamp(m.x, x0 + 3, x0 + sw - 3) + 4, y, 2.4, 0, 7); ctx.fill(); }
    }
    // labels
    ctx.font = '600 12px "IBM Plex Mono", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(7,9,12,.8)';
    const yLab = yInt - yTop > 22 ? (yTop + yInt) / 2 : yTop - 12;
    ctx.strokeText(`SiO₂ ${fmtX(x)}`, x0 + 10, yLab); ctx.fillStyle = '#ffd27a'; ctx.fillText(`SiO₂ ${fmtX(x)}`, x0 + 10, yLab);
    ctx.fillStyle = '#c8d6e5'; ctx.fillText('silicon', x0 + 10, Math.min(yInt + 22, h - 12));
    ctx.textAlign = 'right'; ctx.strokeText('original surface', x0 + sw - 8, y0 + 10); ctx.fillStyle = '#aab3c0'; ctx.fillText('original surface', x0 + sw - 8, y0 + 10);
    ctx.fillStyle = col; ctx.fillText(s.amb === 'wet' ? 'H₂O' : 'O₂', x0 + sw - 8, Math.max(yTop - 22, 12));
    ctx.textAlign = 'left'; ctx.fillStyle = '#e8ecf1'; ctx.font = '600 13px "IBM Plex Mono", monospace';
    ctx.fillText(`t = ${fmtT(tNow)} at ${s.T.toFixed(0)} °C`, x0 + 10, 16);
    // regime meter
    if (!narrow) {
      const ox = sw + 36, ow = w - ox - 20;
      ctx.font = '600 12px "IBM Plex Sans", sans-serif'; ctx.fillStyle = '#e8ecf1'; ctx.textAlign = 'left';
      ctx.fillText('What limits growth right now?', ox, 30);
      const by = 52, bh = 18;
      ctx.fillStyle = '#1b2230'; ctx.fillRect(ox, by, ow, bh);
      ctx.fillStyle = '#3cc0b4'; ctx.fillRect(ox, by, ow * (1 - reg), bh);
      ctx.fillStyle = '#f2b84b'; ctx.fillRect(ox + ow * (1 - reg), by, ow * reg, bh);
      ctx.font = '500 11px "IBM Plex Mono", monospace';
      ctx.fillStyle = '#7fd3d0'; ctx.fillText(`reaction ${(100 * (1 - reg)).toFixed(0)} %`, ox, by + bh + 16);
      ctx.fillStyle = '#ffd27a'; ctx.textAlign = 'right'; ctx.fillText(`diffusion ${(100 * reg).toFixed(0)} %`, ox + ow, by + bh + 16);
      // growth rate gauge
      const r = OX.growthRate(s.amb, s.T, Math.max(x, 1e-4), s.orient, s.p);
      ctx.textAlign = 'left'; ctx.fillStyle = '#e8ecf1'; ctx.font = '600 12px "IBM Plex Sans", sans-serif';
      ctx.fillText('Growth rate', ox, 130);
      ctx.font = '700 26px "Space Grotesk", "IBM Plex Sans", sans-serif'; ctx.fillStyle = '#f2b84b';
      ctx.fillText(r * 1000 >= 1 ? `${(r * 1000 / 60).toFixed(r * 1000 / 60 < 1 ? 3 : 2)} nm/min` : `${(r * 1e6 / 60).toFixed(1)} pm/min`, ox, 162);
      ctx.font = '500 11px "IBM Plex Mono", monospace'; ctx.fillStyle = '#8a94a3';
      ctx.fillText('dx/dt = B / (2x + A)', ox, 186);
      ctx.fillText(`A = ${fmtX(s.A)},  B = ${s.B.toExponential(2)} µm²/h`, ox, 206);
      ctx.fillText(`silicon consumed: ${fmtX(OX.SI_CONSUMED * x)}`, ox, 226);
      ctx.fillStyle = '#aab3c0'; ctx.fillText(narrow ? '' : 'Thicker oxide → longer diffusion path → slower growth', ox, h - 20);
    }
  }
}

export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'amb', type: 'seg', label: 'Ambient', options: [['dry', 'Dry O₂'], ['wet', 'Wet (steam)']], value: 'wet' },
    { key: 'orient', type: 'seg', label: 'Wafer orientation', options: [['100', '(100)'], ['111', '(111)']], value: '100' },
    { key: 'T', label: 'Temperature', min: 800, max: 1200, step: 5, value: 1000, fmt: v => v.toFixed(0) + ' °C' },
    { key: 't', label: 'Time', min: 1 / 60, max: 24, log: true, value: 1, fmt: fmtT },
    { key: 'p', label: 'Oxidant pressure', min: 1, max: 20, step: 0.5, value: 1, fmt: v => v.toFixed(1) + ' atm' },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'x', label: 'Oxide thickness', unit: '' }, { key: 'si', label: 'Silicon consumed', unit: '0.44 × oxide' },
    { key: 'B', label: 'Parabolic constant B', unit: 'µm²/h' }, { key: 'BA', label: 'Linear constant B/A', unit: 'µm/h' },
    { key: 'reg', label: 'Diffusion-limited', unit: 'share of the total resistance' }, { key: 'tg', label: 'Time to 100 nm', unit: '' },
  ]);
  const view = new OxideView(sec.querySelector('[data-role=ox] canvas'));
  const grHost = sec.querySelector('[data-role=growth]'), arHost = sec.querySelector('[data-role=arrh]');
  let f = 0;
  const redraw = coalesce(() => { drawGrowth(); drawArrh(); });
  ctl.on(() => { compute(); f = 0; redraw(); });
  function compute() {
    const s = ctl.state, [B, BA] = OX.rateConstants(s.amb, s.T, s.orient, s.p), x = OX.thickness(s.amb, s.T, s.t, s.orient, s.p);
    view.set({ ...s, A: B / BA, B });
    show({ x: fmtX(x), si: fmtX(OX.SI_CONSUMED * x), B: B.toExponential(2), BA: BA.toExponential(2), reg: (100 * OX.regime(s.amb, s.T, x, s.orient)).toFixed(0) + ' %', tg: fmtT(OX.timeTo(s.amb, s.T, 0.1, s.orient, s.p)) });
  }
  function drawGrowth() {
    const s = ctl.state, f2 = frame(grHost, { w: fw(grHost), h: 300, m: { t: 14, r: 16, b: 40, l: 56 } });
    const xs = log(1 / 60, 30, f2.x0, f2.x1), ys = log(0.001, 5, f2.y0, f2.y1);
    axes(f2, xs, ys, { xt: [1 / 60, 0.1, 1, 10], yt: [0.001, 0.01, 0.1, 1], xl: 'time (h)', yl: 'oxide thickness (µm)', xf: v => v < 0.05 ? '1 min' : String(v), yf: v => v < 0.01 ? '1 nm' : v < 0.1 ? '10 nm' : v < 1 ? '100 nm' : '1 µm' });
    const ts = Array.from({ length: 80 }, (_, i) => 10 ** (Math.log10(1 / 60) + (Math.log10(30) - Math.log10(1 / 60)) * i / 79));
    const Ts = [800, 900, 1000, 1100, 1200], cols = ['#5598e7', '#3cc0b4', '#f2b84b', '#ff8a55', '#d55181'];
    Ts.forEach((T, i) => {
      const on = Math.abs(T - s.T) < 1;
      el('path', { d: path(ts.map(t => [xs(t), ys(Math.max(OX.thickness(s.amb, T, t, s.orient, s.p), 1e-3))])), fill: 'none', stroke: cols[i], 'stroke-width': on ? 2.6 : 1.4, opacity: on ? 1 : 0.7 }, f2.svg);
      txt(f2.svg, xs(1 / 60) + 16, ys(Math.max(OX.thickness(s.amb, T, 1 / 60, s.orient, s.p), 1.3e-3)) - 6, `${T} °C`, { fill: cols[i], 'font-size': 10.5 });
    });
    if (!Ts.includes(s.T)) el('path', { d: path(ts.map(t => [xs(t), ys(Math.max(OX.thickness(s.amb, s.T, t, s.orient, s.p), 1e-3))])), fill: 'none', stroke: '#e8ecf1', 'stroke-width': 2, 'stroke-dasharray': '5 4' }, f2.svg);
    el('circle', { cx: xs(s.t), cy: ys(OX.thickness(s.amb, s.T, s.t, s.orient, s.p)), r: 5.5, fill: '#e8ecf1', stroke: C.surface, 'stroke-width': 2 }, f2.svg);
    // slope guides
    el('path', { d: path([[xs(0.03), ys(0.002)], [xs(0.3), ys(0.02)]]), stroke: C.muted, 'stroke-dasharray': '3 3', fill: 'none' }, f2.svg);
    txt(f2.svg, xs(0.3) + 4, ys(0.02) + 4, 'slope 1', { fill: C.muted, 'font-size': 10 });
    hover(f2, grHost, xs, t => tipRows(fmtT(t), Ts.map(T => [`${T} °C`, fmtX(OX.thickness(s.amb, T, t, s.orient, s.p))])));
  }
  function drawArrh() {
    const s = ctl.state, f2 = frame(arHost, { w: fw(arHost), h: 300, m: { t: 14, r: 16, b: 40, l: 56 } });
    const inv = T => 1000 / (T + 273.15), xs = linear(0.68, 0.94, f2.x0, f2.x1), ys = log(1e-4, 10, f2.y0, f2.y1);
    axes(f2, xs, ys, { xt: [0.7, 0.75, 0.8, 0.85, 0.9], yt: [1e-4, 1e-3, 1e-2, 0.1, 1, 10], xl: '1000 / T (1/K)', yl: 'B (µm²/h), B/A (µm/h)', xf: v => v.toFixed(2), yf: v => v >= 1 ? String(v) : '10' + { 1: '⁻¹', 2: '⁻²', 3: '⁻³', 4: '⁻⁴' }[Math.round(-Math.log10(v))] });
    const Ts = Array.from({ length: 40 }, (_, i) => 780 + 440 * i / 39);
    const series = [['wet', 0, '#7fd3d0', 'B wet'], ['wet', 1, '#3cc0b4', 'B/A wet'], ['dry', 0, '#ff8a7a', 'B dry'], ['dry', 1, '#d95926', 'B/A dry']];
    for (const [a, k, col, lab] of series) {
      const on = a === s.amb;
      el('path', { d: path(Ts.map(T => [xs(inv(T)), ys(OX.rateConstants(a, T, s.orient)[k])])), fill: 'none', stroke: col, 'stroke-width': on ? 2.4 : 1.3, 'stroke-dasharray': k ? '6 4' : null, opacity: on ? 1 : 0.6 }, f2.svg);
      const Tl = k ? 840 : 1170;
      txt(f2.svg, xs(inv(Tl)) + (k ? -4 : 4), ys(OX.rateConstants(a, Tl, s.orient)[k]) + (k ? 14 : -7), lab, { 'text-anchor': k ? 'end' : 'start', fill: col, 'font-size': 10.5 });
    }
    el('line', { x1: xs(inv(s.T)), x2: xs(inv(s.T)), y1: f2.y0, y2: f2.y1, stroke: '#e8ecf1', 'stroke-dasharray': '3 4', opacity: 0.6 }, f2.svg);
    txt(f2.svg, xs(inv(s.T)) + 4, f2.y1 + 12, `${s.T} °C`, { fill: '#e8ecf1' });
  }
  loop(sec.querySelector('[data-role=ox]'), dt => { f = Math.min(f + dt / (reduceMotion ? 0.5 : 6), 1); if (f >= 1) f = 1; view.draw(dt, f); });
  experiments(sec.querySelector('.lab-exp'), [
    { label: 'A 1980s gate oxide', run: api => { api.set('amb', 'dry'); api.animate({ T: 900, t: 0.5, p: 1 }, 800); }, note: 'Dry oxygen at 900 °C for half an hour grows about 20 nm, a gate oxide from the 1 µm era. Growth is still mostly reaction-limited, so the thickness is set precisely by time and temperature. Dry oxide is slower but denser, with fewer traps than steam oxide.' },
    { label: 'Field oxide: steam, 1100 °C, 4 h', run: api => { api.set('amb', 'wet'); api.animate({ T: 1100, t: 4, p: 1 }, 800); }, note: 'Well over a micrometre, the thick isolation oxide (LOCOS) that separated transistors until shallow-trench isolation replaced it in the 1990s. By now growth is diffusion-limited: doubling the time adds only about 40 % more oxide.' },
    { label: 'Dry versus wet at the same settings', run: api => { api.set('amb', 'dry'); setTimeout(() => api.set('amb', 'wet'), 1600); }, note: 'Water dissolves in silicon dioxide several hundred times more than oxygen does, so B and B/A are much larger for steam. Wet oxidation is 5–10 times faster, which is why thick oxides are grown wet and thin gate oxides dry.' },
    { label: '(111) versus (100) silicon', run: api => { api.set('orient', '111'); setTimeout(() => api.set('orient', '100'), 1600); }, note: 'A (111) surface has more bonds per area to react with, so its linear rate constant is 1.68 times larger. MOS technology settled on (100) wafers because they also have far fewer interface traps.' },
    { label: 'High-pressure oxidation', run: api => api.animate({ p: 10, T: 900 }, 900), note: 'Both rate constants scale with pressure, so ten atmospheres at 900 °C can replace a much hotter process. Lower temperature means less dopant diffusion, which mattered as junctions became shallow.' },
  ], ctl);
  compute(); drawGrowth(); drawArrh();
  onWidth([grHost, arHost], () => { drawGrowth(); drawArrh(); });
}

export function record(stage, next) {
  stage.innerHTML = `<div class="rec-head"><span class="eyebrow">Deal–Grove model</span><h2>Growing silicon dioxide in steam</h2><span class="rec-state" id="rs"></span></div><canvas></canvas>
    <div class="rec-foot"><span style="color:#7fd3d0">● H₂O</span><span style="color:#ffd27a">■ SiO₂</span><span class="rec-brand">Transistor Odyssey · Process Lab</span></div>`;
  const v = new OxideView(stage.querySelector('canvas')), s = { amb: 'wet', orient: '100', T: 1000, t: 2, p: 1 };
  const [B, BA] = OX.rateConstants('wet', 1000); v.set({ ...s, A: B / BA, B });
  Math.random = (() => { let a = 7; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; })();
  return (n = 96) => { const k = next(), f = Math.min((k % n) / (n * 0.85), 1); v.draw(1 / 12, f); stage.querySelector('#rs').textContent = 'wet O₂, 1000 °C, 2 h'; return k + 1; };
}
