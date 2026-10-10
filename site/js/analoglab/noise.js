// Lab 04 — input-referred noise of a MOSFET: thermal (4kTγ/gm) and flicker (K_f / C_ox W L f).
import * as AN from '../physics/analog.js';
import { DATA } from '../data.js';
import { panel, tiles, experiments, hiCanvas, loop, frame, axes, log, path, el, C, txt, fw, onWidth, hover, tipRows, clamp, coalesce, reduceMotion, logTicks, fmtPow } from '../physlab/ui.js';

const NERAS = [['1999_180nm', '180 nm'], ['2007_45nm_hkmg', '45 nm'], ['2011_22nm_finfet', '22 nm FinFET'], ['2025_2nm_gaa', '2 nm GAA']];
const F1 = 10;                                                   // integration starts at 10 Hz
const fmtHz = f => f >= 1e9 ? +(f / 1e9).toPrecision(3) + ' GHz' : f >= 1e6 ? +(f / 1e6).toPrecision(3) + ' MHz' : f >= 1e3 ? +(f / 1e3).toPrecision(3) + ' kHz' : +f.toPrecision(3) + ' Hz';
const fmtV = v => v >= 1e-3 ? +(v * 1e3).toPrecision(3) + ' mV' : v >= 1e-6 ? +(v * 1e6).toPrecision(3) + ' µV' : +(v * 1e9).toPrecision(3) + ' nV';
const fmtW = w => w >= 1 ? +w.toPrecision(3) + ' µm' : (w * 1000).toFixed(0) + ' nm';

export function budget(key, gm_mS, W, BW, A_uV) {
  const p = DATA.presets[key], gm = gm_mS * 1e-3, th = 4 * AN.KB * 300 * (2 / 3) / gm;
  const c = AN.noisePsd(p, gm, W, 1) - th;                     // flicker coefficient: S_f(f) = c / f
  const thr = Math.sqrt(th * (BW - F1)), flr = Math.sqrt(c * Math.log(BW / F1)), tot = AN.noiseRms(p, gm, W, F1, BW);
  const A = A_uV * 1e-6, snr = 20 * Math.log10(A / Math.SQRT2 / tot);
  return { key, p, gm, W, BW, A, th, c, thr, flr, tot, snr, fc: AN.noiseCorner(p, gm, W), name: NERAS.find(e => e[0] === key)[1] };
}

// Gaussian sample (Box–Muller) with a swappable uniform source for reproducible recordings
let rnd = Math.random;
const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };

export class NoiseView {
  constructor(cv) {
    this.c = hiCanvas(cv); this.b = null; this.wh = new Float32Array(720); this.fl = new Float32Array(720); this.ph = new Float32Array(720); this.buf = new Float32Array(720); this.clean = new Float32Array(720); this.n = 0; this.acc = 0; this.ysc = 0;
    this.ar = Array.from({ length: 8 }, (_, j) => ({ a: Math.exp(-2 * Math.PI * 2 ** j / 4000), x: 0 }));   // 1/f from a sum of relaxations
    for (let k = 0; k < 4000 + 720; k++) this.step();
  }
  set(b) { this.b = b; }
  step() {
    let fl = 0;
    for (const r of this.ar) { r.x = r.a * r.x + Math.sqrt(1 - r.a * r.a) * gauss(); fl += r.x; }
    for (const a of [this.wh, this.fl, this.ph]) a.copyWithin(0, 1);
    const L = this.wh.length - 1; this.wh[L] = gauss(); this.fl[L] = fl / Math.sqrt(this.ar.length); this.ph[L] = (this.n++ % 120) / 120;
  }
  /** Rebuild the displayed trace from unit noise samples, so a parameter change applies to the whole window at once. */
  compose() {
    const b = this.b;
    for (let k = 0; k < this.wh.length; k++) { const s = b.A * Math.sin(2 * Math.PI * this.ph[k]); this.clean[k] = s; this.buf[k] = s + b.thr * this.wh[k] + b.flr * this.fl[k]; }
  }
  draw(dt) {
    const { c, b } = this; c.resize(); const { ctx, w, h } = c; ctx.clearRect(0, 0, w, h); if (!b) return;
    this.acc += dt * (reduceMotion ? 20 : 150); while (this.acc >= 1) { this.step(); this.acc--; }
    this.compose();
    const narrow = w < 640, x0 = 56, x1 = narrow ? w - 12 : w * 0.68, y0 = 26, y1 = h - 28, my = (y0 + y1) / 2;
    const want = Math.max(3.2 * b.tot, 1.3 * b.A); this.ysc = this.ysc ? this.ysc + (want - this.ysc) * Math.min(dt * 4, 1) : want;
    const Y = v => my - clamp(v / this.ysc, -1.1, 1.1) * (y1 - y0) / 2, N = this.buf.length, X = k => x0 + (x1 - x0) * k / (N - 1);
    const mono = z => `${z}px "IBM Plex Mono", monospace`;
    ctx.strokeStyle = '#232a34'; ctx.lineWidth = 1;
    for (let k = 0; k <= 8; k++) { const x = x0 + (x1 - x0) * k / 8; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
    for (const q of [-1, -0.5, 0, 0.5, 1]) { ctx.beginPath(); ctx.moveTo(x0, my - q * (y1 - y0) / 2); ctx.lineTo(x1, my - q * (y1 - y0) / 2); ctx.stroke(); }
    ctx.fillStyle = '#8a94a3'; ctx.font = mono(10); ctx.textAlign = 'right';
    ctx.fillText('+' + fmtV(this.ysc), x0 - 6, y0 + 4); ctx.fillText('0', x0 - 6, my + 4); ctx.fillText('−' + fmtV(this.ysc), x0 - 6, y1 + 4);
    // ±1σ band of the noise
    ctx.fillStyle = 'rgba(85,152,231,.1)'; ctx.fillRect(x0, Y(b.tot), x1 - x0, Y(-b.tot) - Y(b.tot));
    ctx.strokeStyle = 'rgba(160,190,230,.85)'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let k = 0; k < N; k++) k ? ctx.lineTo(X(k), Y(this.buf[k])) : ctx.moveTo(X(k), Y(this.buf[k]));
    ctx.stroke();
    ctx.strokeStyle = '#f2b84b'; ctx.lineWidth = 2.4; ctx.beginPath();
    for (let k = 0; k < N; k++) k ? ctx.lineTo(X(k), Y(this.clean[k])) : ctx.moveTo(X(k), Y(this.clean[k]));
    ctx.stroke();
    ctx.textAlign = 'left'; ctx.font = '600 ' + mono(11);
    ctx.fillStyle = '#f2b84b'; ctx.fillText(`signal ${fmtV(b.A)}`, x0 + 6, y0 - 8);
    if (!narrow) { ctx.fillStyle = '#a0bee6'; ctx.fillText('signal + noise', x0 + 160, y0 - 8); }
    ctx.fillStyle = '#8a94a3'; ctx.font = mono(10); ctx.fillText(`band: ±1σ = ${fmtV(b.tot)} rms, ${F1} Hz – ${fmtHz(b.BW)}`, x0 + 6, y1 + 18);
    if (narrow) { ctx.textAlign = 'right'; ctx.font = '600 ' + mono(11); ctx.fillStyle = b.snr > 0 ? '#3cc0b4' : '#ff8a7a'; ctx.fillText(`SNR ${b.snr.toFixed(1)} dB`, x1, y0 - 8); return; }
    // right: where the noise power comes from, and the signal-to-noise ratio
    const rx = w * 0.72, rw = w - rx - 18, by = y0 + 30, bh = 22, pth = b.thr ** 2 / b.tot ** 2;
    ctx.textAlign = 'left'; ctx.fillStyle = '#e8ecf1'; ctx.font = '600 12px "IBM Plex Sans", sans-serif'; ctx.fillText('Noise power from', rx, y0 + 12);
    ctx.fillStyle = '#5598e7'; ctx.fillRect(rx, by, rw * pth, bh); ctx.fillStyle = '#d55181'; ctx.fillRect(rx + rw * pth, by, rw * (1 - pth), bh);
    ctx.font = mono(11); ctx.fillStyle = '#86b6ef'; ctx.fillText(`thermal ${(100 * pth).toFixed(0)} %`, rx, by + bh + 16);
    ctx.textAlign = 'right'; ctx.fillStyle = '#ef8fb3'; ctx.fillText(`1/f ${(100 * (1 - pth)).toFixed(0)} %`, rx + rw, by + bh + 16);
    ctx.textAlign = 'left'; ctx.fillStyle = '#e8ecf1'; ctx.font = '600 12px "IBM Plex Sans", sans-serif'; ctx.fillText('Signal-to-noise ratio', rx, by + 78);
    ctx.font = '700 30px "Space Grotesk", "IBM Plex Sans", sans-serif'; ctx.fillStyle = b.snr > 10 ? '#3cc0b4' : b.snr > 0 ? '#f2b84b' : '#ff8a7a';
    ctx.fillText(`${b.snr.toFixed(1)} dB`, rx, by + 114);
    ctx.font = '11px "IBM Plex Sans", sans-serif'; ctx.fillStyle = '#8a94a3';
    ctx.fillText(b.snr > 10 ? 'The signal stands clear of the noise.' : b.snr > 0 ? 'Visible, but noisy.' : 'Buried: the noise is larger than the signal.', rx, by + 136);
    ctx.font = mono(10.5); ctx.fillStyle = '#aab3c0';
    ctx.fillText(`${b.name}, gm ${+(b.gm * 1e3).toPrecision(3)} mS, W ${fmtW(b.W)}`, rx, y1 + 4);
  }
}

export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'era', type: 'seg', label: 'Transistor generation', options: NERAS, value: '1999_180nm' },
    { key: 'gm', label: 'Transconductance gm', min: 0.01, max: 10, log: true, value: 1, fmt: v => +v.toPrecision(2) + ' mS' },
    { key: 'W', label: 'Transistor width W', min: 0.1, max: 1000, log: true, value: 10, fmt: fmtW },
    { key: 'BW', label: 'Bandwidth (from 10 Hz)', min: 1e3, max: 1e9, log: true, value: 2e4, fmt: fmtHz },
    { key: 'A', label: 'Signal amplitude', min: 0.1, max: 1000, log: true, value: 10, fmt: v => fmtV(v * 1e-6) },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'th', label: 'Thermal noise density', unit: 'nV/√Hz' }, { key: 'fc', label: '1/f corner', unit: '' },
    { key: 'tot', label: 'Total rms noise', unit: '' }, { key: 'fl', label: 'Share from 1/f', unit: 'of noise power' },
    { key: 'snr', label: 'Signal-to-noise', unit: 'dB' }, { key: 'd1k', label: 'Density at 1 kHz', unit: 'nV/√Hz' },
  ]);
  const view = new NoiseView(sec.querySelector('[data-role=noisecv] canvas'));
  const pHost = sec.querySelector('[data-role=psd]'), aHost = sec.querySelector('[data-role=area]');
  let b = null;
  const plots = coalesce(() => { drawPsd(); drawArea(); });
  ctl.on(() => { compute(); plots(); });
  function compute() {
    const s = ctl.state; b = budget(s.era, s.gm, s.W, s.BW, s.A); view.set(b);
    show({ th: (Math.sqrt(b.th) * 1e9).toFixed(2), fc: fmtHz(b.fc), tot: fmtV(b.tot), fl: (100 * b.flr ** 2 / b.tot ** 2).toFixed(0) + ' %', snr: b.snr.toFixed(1), d1k: (Math.sqrt(b.th + b.c / 1e3) * 1e9).toFixed(2) });
  }
  const decTicks = (lo, hi) => logTicks(lo, hi);
  function drawPsd() {
    const f = frame(pHost, { w: fw(pHost), h: 290, m: { t: 14, r: 16, b: 40, l: 56 } });
    const nd = x => Math.sqrt(x) * 1e9, top = 10 ** Math.ceil(Math.log10(nd(b.th + b.c) * 1.5)), bot = 10 ** Math.floor(Math.log10(nd(b.th) / 2));
    const xs = log(1, 1e10, f.x0, f.x1), ys = log(bot, Math.max(top, bot * 1000), f.y0, f.y1);
    axes(f, xs, ys, { xt: [1, 1e2, 1e4, 1e6, 1e8, 1e10], yt: decTicks(bot, Math.max(top, bot * 1000)), xl: 'frequency', yl: 'noise (nV/√Hz)', xf: fmtHz, yf: v => v >= 1 ? String(v) : fmtPow(v) });
    el('rect', { x: xs(F1), y: f.y1, width: xs(b.BW) - xs(F1), height: f.y0 - f.y1, fill: '#f2b84b', opacity: 0.07 }, f.svg);
    txt(f.svg, xs(Math.sqrt(F1 * b.BW)), f.y1 + 12, 'integrated band', { 'text-anchor': 'middle', fill: '#f2b84b', 'font-size': 10, opacity: 0.8 });
    const F = Array.from({ length: 121 }, (_, i) => 10 ** (10 * i / 120));
    el('path', { d: path(F.map(x => [xs(x), ys(nd(b.th))])), stroke: '#5598e7', 'stroke-dasharray': '6 4', fill: 'none', 'stroke-width': 1.5 }, f.svg);
    el('path', { d: path(F.filter(x => nd(b.c / x) > bot).map(x => [xs(x), ys(nd(b.c / x))])), stroke: '#d55181', 'stroke-dasharray': '6 4', fill: 'none', 'stroke-width': 1.5 }, f.svg);
    el('path', { d: path(F.map(x => [xs(x), ys(nd(b.th + b.c / x))])), stroke: '#e8ecf1', fill: 'none', 'stroke-width': 2.4 }, f.svg);
    if (b.fc > 1 && b.fc < 1e10) {
      el('circle', { cx: xs(b.fc), cy: ys(nd(2 * b.th)), r: 5, fill: '#f2b84b', stroke: C.surface, 'stroke-width': 2 }, f.svg);
      txt(f.svg, xs(b.fc) + 8, ys(nd(2 * b.th)) - 8, `corner ${fmtHz(b.fc)}`, { fill: '#f2b84b' });
    }
    txt(f.svg, f.x1 - 4, ys(nd(b.th)) - 6, 'thermal', { 'text-anchor': 'end', fill: '#86b6ef', 'font-size': 10.5 });
    txt(f.svg, xs(3) + 4, ys(nd(b.th + b.c / 3)) + 16, '1/f', { fill: '#ef8fb3', 'font-size': 10.5 });
    hover(f, pHost, xs, x => tipRows(fmtHz(x), [['total', nd(b.th + b.c / x).toPrecision(3) + ' nV/√Hz'], ['thermal', nd(b.th).toPrecision(3)], ['1/f', nd(b.c / x).toPrecision(3)]]));
  }
  function drawArea() {
    const f = frame(aHost, { w: fw(aHost), h: 290, m: { t: 14, r: 16, b: 40, l: 56 } });
    const Ws = Array.from({ length: 61 }, (_, i) => 10 ** (-1 + 4 * i / 60)), rows = Ws.map(w => budget(b.key, b.gm * 1e3, w, b.BW, 1));
    const vals = rows.flatMap(r => [r.tot, r.thr, r.flr]).filter(v => v > 0);
    const lo = 10 ** Math.floor(Math.log10(Math.min(...vals) * 0.8)), hi = 10 ** Math.ceil(Math.log10(Math.max(...vals) * 1.2));
    const xs = log(0.1, 1000, f.x0, f.x1), ys = log(lo, hi, f.y0, f.y1);
    axes(f, xs, ys, { xt: [0.1, 1, 10, 100, 1000], yt: logTicks(lo, hi), xl: 'transistor width W (µm)', yl: 'rms noise (V)', xf: v => String(v), yf: v => fmtV(v) });
    el('path', { d: path(rows.map((r, i) => [xs(Ws[i]), ys(r.thr)])), stroke: '#5598e7', 'stroke-dasharray': '6 4', fill: 'none', 'stroke-width': 1.5 }, f.svg);
    el('path', { d: path(rows.map((r, i) => [xs(Ws[i]), ys(Math.max(r.flr, lo))])), stroke: '#d55181', 'stroke-dasharray': '6 4', fill: 'none', 'stroke-width': 1.5 }, f.svg);
    el('path', { d: path(rows.map((r, i) => [xs(Ws[i]), ys(r.tot)])), stroke: '#e8ecf1', fill: 'none', 'stroke-width': 2.4 }, f.svg);
    el('circle', { cx: xs(b.W), cy: ys(b.tot), r: 5.5, fill: '#e8ecf1', stroke: C.surface, 'stroke-width': 2 }, f.svg);
    txt(f.svg, f.x1 - 4, ys(rows[60].thr) - 6, 'thermal', { 'text-anchor': 'end', fill: '#86b6ef', 'font-size': 10.5 });
    txt(f.svg, xs(0.13), ys(Math.max(rows[1].flr, lo)) + 16, '1/f ∝ 1/√W', { fill: '#ef8fb3', 'font-size': 10.5 });
    txt(f.svg, f.x1 - 4, f.y1 + 12, `${b.name}, gm ${+(b.gm * 1e3).toPrecision(3)} mS, to ${fmtHz(b.BW)}`, { 'text-anchor': 'end', fill: C.muted, 'font-size': 10 });
    hover(f, aHost, xs, w => { const r = budget(b.key, b.gm * 1e3, w, b.BW, 1); return tipRows(`W = ${fmtW(w)}`, [['total', fmtV(r.tot)], ['thermal', fmtV(r.thr)], ['1/f', fmtV(r.flr)]]); });
  }
  loop(sec.querySelector('[data-role=noisecv]'), dt => view.draw(dt));
  experiments(sec.querySelector('.lab-exp'), [
    { label: 'An audio preamplifier', run: api => { api.set('era', '1999_180nm'); api.animate({ BW: 2e4, gm: 1, W: 10, A: 10 }, 900); }, note: 'Over the audio band, 10 Hz to 20 kHz, a 10 µm transistor’s noise is mostly 1/f: its corner sits far above the band. A 10 µV signal is lost in it: the signal-to-noise ratio is below 0 dB.' },
    { label: 'Make the transistor wider', run: api => api.animate({ W: 1000 }, 1200), note: 'Flicker noise comes from charges trapped and released at the oxide interface; a bigger gate averages over more traps, so the 1/f power falls in proportion to the gate area. At 1 mm wide the corner drops a hundredfold. That is why audio and sensor front ends use huge input transistors.' },
    { label: 'Spend current on gm', run: api => api.animate({ gm: 10 }, 1000), note: 'Thermal noise density is 4kTγ/gm: ten times the transconductance (roughly ten times the current) cuts the thermal noise voltage by √10. But 1/f noise referred to the input does not depend on gm at all, so over the audio band the total barely moves and the corner rises tenfold. Low-noise amplifiers pay for their quiet in power, and only where thermal noise dominates.' },
    { label: 'A radio bandwidth', run: api => api.animate({ BW: 1e8, W: 10, gm: 1, A: 100 }, 1200), note: 'Over 100 MHz the flat thermal noise integrates to far more than the 1/f part, which only matters at low frequency. A radio receiver worries about thermal noise and noise figure, an audio amplifier about 1/f.' },
    { label: 'The smallest transistor', run: api => { api.set('era', '2025_2nm_gaa'); api.animate({ W: 0.1, BW: 2e4, gm: 1, A: 10 }, 1000); }, note: 'A 100 nm footprint with a 14 nm gate has a tiny gate area, so its 1/f corner rises to about 90 MHz and the noise swamps a 10 µV signal by over 20 dB. Precision analog blocks on advanced chips therefore use much longer and wider devices than the logic around them.' },
  ], ctl);
  compute(); drawPsd(); drawArea();
  onWidth([pHost, aHost], () => { drawPsd(); drawArea(); });
}

export function record(stage, next) {
  stage.innerHTML = `<div class="rec-head"><span class="eyebrow">Transistor noise</span><h2>A faint signal, and the noise under it</h2><span class="rec-state" id="rs"></span></div><canvas></canvas>
    <div class="rec-foot"><span style="color:#f2b84b">● signal</span><span style="color:#a0bee6">● signal + noise</span><span class="rec-brand">Transistor Odyssey · Analog &amp; RF Lab</span></div>`;
  let a = 99; rnd = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
  const v = new NoiseView(stage.querySelector('canvas'));
  return (n = 160) => {
    const k = next(), q = (k % n) / (n - 1), W = 10 ** (-0.5 + 3 * (0.5 - 0.5 * Math.cos(2 * Math.PI * q)));
    v.set(budget('1999_180nm', 1, W, 2e4, 10)); v.draw(1 / 12);
    stage.querySelector('#rs').textContent = `W = ${fmtW(W)} · SNR ${v.b.snr.toFixed(1)} dB`; return k + 1;
  };
}
