// Lab 03 — frequency response of the common-source stage: Miller effect, poles, f_T and speed records.
import * as AN from '../physics/analog.js';
import { DATA } from '../data.js';
import { RF } from './data.js';
import { ERAS, ERA_COL } from './amp.js';
import { panel, tiles, experiments, hiCanvas, loop, frame, axes, linear, log, path, el, C, txt, fw, onWidth, hover, tipRows, clamp, coalesce, reduceMotion } from '../physlab/ui.js';

const W = 10;
export const fmtHz = f => { const u = [[1e12, 'THz'], [1e9, 'GHz'], [1e6, 'MHz'], [1e3, 'kHz'], [1, 'Hz']].find(([v]) => f >= v * 0.9995) || [1, 'Hz']; const v = f / u[0], t = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2); return (t.includes('.') ? t.replace(/\.?0+$/, '') : t) + ' ' + u[1]; };
const FAM = { CMOS: '#5598e7', SiGe: '#3cc0b4', GaN: '#9a80dc', InP: '#f2b84b' };
const FGRID = Array.from({ length: 301 }, (_, i) => 10 ** (4 + 9 * i / 300));

export function response(key, RL, RS, CL, f) {
  const p = DATA.presets[key], vb = AN.biasForMidrail(p, p.VDD, RL, W), b = AN.bode(p, p.VDD, RL, vb, RS, CL, W, FGRID), st = AN.csStage(p, p.VDD, RL, vb, W);
  const [re, im] = b.H(f), mag = Math.hypot(re, im), ph0 = Math.atan2(b.H(1)[1], b.H(1)[0]);
  let lag = (ph0 - Math.atan2(im, re)) * 180 / Math.PI; while (lag < -1) lag += 360; while (lag > 359) lag -= 360;
  // unwrap the lag continuously along the grid to pick the right branch above 180°
  const lagAt = fr => { let prev = 0, out = 0; for (const x of FGRID) { if (x > fr) break; const [a, c] = b.H(x); let l = (ph0 - Math.atan2(c, a)) * 180 / Math.PI; while (l - prev > 180) l -= 360; while (l - prev < -180) l += 360; prev = l; out = l; } return out; };
  return { key, p, vb, b, st, f, mag, A0: Math.abs(b.gain), lag: lagAt(f), name: ERAS.find(e => e[0] === key)[1] };
}

export class ScopeView {
  constructor(cv) { this.c = hiCanvas(cv); this.t = 0; this.r = null; }
  set(r) { this.r = r; }
  draw(dt) {
    const { c, r } = this; c.resize(); const { ctx, w, h } = c; ctx.clearRect(0, 0, w, h); if (!r) return;
    this.t += dt * (reduceMotion ? 0.1 : 0.45);
    const narrow = w < 640, sx0 = 50, sx1 = narrow ? w - 14 : w * 0.66, sy0 = 24, sy1 = h - 30, my = (sy0 + sy1) / 2, A = Math.max(r.A0, 1) * 1.15, Y = v => my - v / A * (sy1 - sy0) / 2;
    const mono = z => `${z}px "IBM Plex Mono", monospace`;
    ctx.strokeStyle = '#232a34'; ctx.lineWidth = 1;
    for (let k = 0; k <= 8; k++) { const x = sx0 + (sx1 - sx0) * k / 8; ctx.beginPath(); ctx.moveTo(x, sy0); ctx.lineTo(x, sy1); ctx.stroke(); }
    for (const v of [-r.A0, 0, r.A0]) { ctx.beginPath(); ctx.moveTo(sx0, Y(v)); ctx.lineTo(sx1, Y(v)); ctx.stroke(); }
    ctx.fillStyle = '#8a94a3'; ctx.font = mono(10); ctx.textAlign = 'right';
    ctx.fillText(`+${r.A0.toFixed(1)}`, sx0 - 6, Y(r.A0) + 4); ctx.fillText('0', sx0 - 6, my + 4); ctx.fillText(`−${r.A0.toFixed(1)}`, sx0 - 6, Y(-r.A0) + 4);
    const N = 240, ph = this.t * 2 * Math.PI, lagR = r.lag * Math.PI / 180, trace = (fn, col, lw, dash) => {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash || []); ctx.beginPath();
      for (let k = 0; k <= N; k++) { const x = sx0 + (sx1 - sx0) * k / N, th = 4 * Math.PI * k / N - ph, y = Y(fn(th)); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.setLineDash([]);
    };
    trace(th => -r.A0 * Math.sin(th), 'rgba(232,236,241,.4)', 1.4, [5, 4]);       // low-frequency output: inverted, full gain
    trace(th => Math.sin(th), '#3cc0b4', 2);                                       // input, 1 unit
    trace(th => -r.mag * Math.sin(th - lagR), '#f2b84b', 2.6);                    // real output
    ctx.textAlign = 'left'; ctx.font = '600 ' + mono(11);
    ctx.fillStyle = '#3cc0b4'; ctx.fillText('input', sx0 + 6, sy0 + 2);
    ctx.fillStyle = '#f2b84b'; ctx.fillText('output', sx0 + 58, sy0 + 2);
    ctx.fillStyle = 'rgba(232,236,241,.6)'; ctx.fillText('- - at low frequency', sx0 + 118, sy0 + 2);
    const db = 20 * Math.log10(r.mag);
    if (narrow) {
      ctx.font = '600 ' + mono(11); ctx.fillStyle = '#e8ecf1';
      ctx.fillText(`${fmtHz(r.f)}: |A| ${r.mag.toFixed(2)}, lag ${r.lag.toFixed(0)}°`, sx0 + 6, sy1 + 18); return;
    }
    ctx.fillStyle = '#8a94a3'; ctx.font = mono(10); ctx.fillText(`two periods of ${fmtHz(r.f)} = ${fmtT(2 / r.f)}`, sx0 + 6, sy1 + 18);
    // phasor dial: output relative to its low-frequency self
    const cx = w * 0.83, cy = h * 0.4, R = Math.min(w * 0.13, h * 0.3);
    ctx.strokeStyle = '#2f3845'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - R - 6, cy); ctx.lineTo(cx + R + 6, cy); ctx.moveTo(cx, cy - R - 6); ctx.lineTo(cx, cy + R + 6); ctx.stroke();
    ctx.strokeStyle = 'rgba(232,236,241,.5)'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R, cy); ctx.stroke(); ctx.setLineDash([]);
    const L = R * Math.min(r.mag / r.A0, 1.05), a = -lagR;
    ctx.strokeStyle = 'rgba(242,184,75,.35)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, R * 0.32, 0, a, true); ctx.stroke();
    ctx.strokeStyle = '#f2b84b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + L * Math.cos(a), cy - L * Math.sin(a)); ctx.stroke();
    ctx.fillStyle = '#f2b84b'; ctx.beginPath(); ctx.arc(cx + L * Math.cos(a), cy - L * Math.sin(a), 4.5, 0, 7); ctx.fill();
    ctx.textAlign = 'center'; ctx.font = '600 ' + mono(12); ctx.fillStyle = '#e8ecf1';
    ctx.fillText(`${fmtHz(r.f)}`, cx, cy + R + 28);
    ctx.font = mono(11); ctx.fillStyle = '#f2b84b'; ctx.fillText(`|A| = ${r.mag.toFixed(2)}  (${db.toFixed(1)} dB)`, cx, cy + R + 46);
    ctx.fillStyle = '#c8d0db'; ctx.fillText(`lags ${r.lag.toFixed(0)}° behind`, cx, cy + R + 63);
    ctx.fillStyle = '#8a94a3'; ctx.font = mono(10); ctx.fillText('output vs. low frequency', cx, cy - R - 14);
  }
}
const fmtT = s => s >= 1e-3 ? (s * 1e3).toPrecision(3) + ' ms' : s >= 1e-6 ? (s * 1e6).toPrecision(3) + ' µs' : s >= 1e-9 ? (s * 1e9).toPrecision(3) + ' ns' : (s * 1e12).toPrecision(3) + ' ps';

export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'era', type: 'seg', label: 'Transistor generation', options: ERAS, value: '1999_180nm' },
    { key: 'f', label: 'Signal frequency', min: 1e5, max: 1e12, log: true, value: 1e8, fmt: fmtHz },
    { key: 'RS', label: 'Source resistance R<sub>S</sub>', min: 0.01, max: 100, log: true, value: 1, fmt: v => v < 1 ? (v * 1000).toFixed(0) + ' Ω' : v.toFixed(v < 10 ? 1 : 0) + ' kΩ' },
    { key: 'RL', label: 'Load resistor R<sub>L</sub>', min: 0.5, max: 100, log: true, value: 2, fmt: v => v.toFixed(v < 10 ? 1 : 0) + ' kΩ' },
    { key: 'CL', label: 'Load capacitance C<sub>L</sub>', min: 0.1, max: 1000, log: true, value: 10, fmt: v => v.toFixed(v < 1 ? 2 : v < 10 ? 1 : 0) + ' fF' },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'a0', label: 'Low-frequency gain', unit: '' }, { key: 'f3', label: '−3 dB bandwidth', unit: '' },
    { key: 'gbw', label: 'Gain × bandwidth', unit: '' }, { key: 'cm', label: 'Miller capacitance', unit: '' },
    { key: 'ft', label: 'Transistor f<sub>T</sub>', unit: 'intrinsic, at this bias' }, { key: 'af', label: 'Gain at the signal', unit: '' },
  ]);
  const view = new ScopeView(sec.querySelector('[data-role=scope] canvas'));
  const bHost = sec.querySelector('[data-role=bodeplot]'), rHost = sec.querySelector('[data-role=records]');
  let r = null;
  const plots = coalesce(() => { drawBode(); drawRecords(); });
  ctl.on(() => { compute(); plots(); });
  function compute() {
    const s = ctl.state; r = response(s.era, s.RL, s.RS, s.CL, s.f); view.set(r);
    show({ a0: `${r.A0.toFixed(1)}× <small>(${r.b.A0_dB.toFixed(1)} dB)</small>`, f3: fmtHz(r.b.f3dB), gbw: fmtHz(r.b.GBW),
      cm: `${(r.b.C_miller * 1e15).toFixed(1)} fF <small>vs C<sub>gs</sub> ${(r.st.cgs * 1e15).toFixed(1)}</small>`, ft: fmtHz(r.st.fT),
      af: `${r.mag.toFixed(2)}× <small>${r.lag.toFixed(0)}° lag</small>` });
  }
  function drawBode() {
    const f = frame(bHost, { w: fw(bHost), h: 340, m: { t: 14, r: 16, b: 40, l: 50 } }), b = r.b;
    const split = f.y1 + (f.y0 - f.y1) * 0.56, hi = Math.ceil((b.A0_dB + 6) / 20) * 20, lo = hi - 80;
    const xs = log(1e4, 1e13, f.x0, f.x1), ysM = linear(lo, hi, split - 6, f.y1), ysP = linear(-270, 0, f.y0, split + 16);
    axes(f, xs, ysM, { xt: [1e4, 1e6, 1e8, 1e10, 1e12], yt: [lo + 20, lo + 40, lo + 60, hi], xl: 'frequency', xf: fmtHz, yf: v => v + ' dB' });
    axes(f, xs, ysP, { xt: [], yt: [0, -90, -180, -270], yf: v => v + '°' });
    txt(f.svg, f.x0 + 6, split + 12, 'phase, relative to low frequency', { fill: C.muted, 'font-size': 10 });
    const keep = FGRID.map((x, i) => [x, b.mag[i]]).filter(([, m]) => m >= lo);
    el('path', { d: path(keep.map(([x, m]) => [xs(x), ysM(Math.min(m, hi + 4))])), fill: 'none', stroke: '#f2b84b', 'stroke-width': 2.4 }, f.svg);
    const ph0 = b.phase[0];
    el('path', { d: path(FGRID.map((x, i) => [xs(x), ysP(clamp(b.phase[i] - ph0, -270, 0))])), fill: 'none', stroke: '#9a80dc', 'stroke-width': 2 }, f.svg);
    const vline = (x, col, lab, dy, dash = '4 4') => { if (x < 1e4 || x > 1e13) return; el('line', { x1: xs(x), x2: xs(x), y1: f.y1, y2: f.y0, stroke: col, 'stroke-dasharray': dash, opacity: 0.85 }, f.svg); txt(f.svg, xs(x) + 4, f.y1 + dy, lab, { fill: col, 'font-size': 10 }); };
    vline(b.f3dB, '#f2b84b', '−3 dB', 12);
    vline(r.st.fT, '#3cc0b4', 'f_T', 26);
    el('line', { x1: xs(r.f), x2: xs(r.f), y1: f.y1, y2: f.y0, stroke: '#e8ecf1', 'stroke-width': 1.5, opacity: 0.7 }, f.svg);
    el('circle', { cx: xs(r.f), cy: ysM(clamp(20 * Math.log10(r.mag), lo, hi)), r: 5, fill: '#e8ecf1', stroke: C.surface, 'stroke-width': 2 }, f.svg);
    el('circle', { cx: xs(r.f), cy: ysP(clamp(-r.lag, -270, 0)), r: 4.5, fill: '#e8ecf1', stroke: C.surface, 'stroke-width': 2 }, f.svg);
    hover(f, bHost, xs, x => { const [a, c] = b.H(x); return tipRows(fmtHz(x), [['gain', (20 * Math.log10(Math.hypot(a, c))).toFixed(1) + ' dB'], ['|A|', Math.hypot(a, c).toFixed(2)]]); });
  }
  const peakCache = {};
  function peakFT(key) {
    if (peakCache[key]) return peakCache[key];
    const p = DATA.presets[key]; let best = 0;
    for (let k = 0; k <= 40; k++) best = Math.max(best, AN.smallSignal(p, p.VDD * k / 40, p.VDD).fT);
    return (peakCache[key] = best);
  }
  function drawRecords() {
    const f = frame(rHost, { w: fw(rHost), h: 340, m: { t: 14, r: 16, b: 40, l: 60 } });
    const xs = linear(1968, 2030, f.x0, f.x1), ys = log(1e8, 3e12, f.y0, f.y1);
    axes(f, xs, ys, { xt: [1970, 1980, 1990, 2000, 2010, 2020, 2030], yt: [1e8, 1e9, 1e10, 1e11, 1e12], xl: 'year', yf: fmtHz });
    const model = Object.entries(DATA.presets).filter(([k]) => !k.includes('mos2')).map(([k, p]) => [p.year, peakFT(k), k]).sort((a, b) => a[0] - b[0]);
    el('path', { d: path(model.map(([y, v]) => [xs(y), ys(v)])), fill: 'none', stroke: '#e8ecf1', 'stroke-width': 1.6, 'stroke-dasharray': '5 4', opacity: 0.7 }, f.svg);
    for (const [y, v, k] of model) {
      const on = k === r.key, s = on ? 6 : 4;
      const sq = el('rect', { x: xs(y) - s, y: ys(v) - s, width: 2 * s, height: 2 * s, fill: on ? ERA_COL[k] : '#c8d0db', stroke: C.surface, 'stroke-width': 1.5 }, f.svg);
      el('title', {}, sq).textContent = `${DATA.presets[k].name}: model intrinsic peak fT ${fmtHz(v)}`;
    }

    for (const rec of RF) {
      const x = xs(rec.year), col = FAM[rec.family];
      if (rec.fT) { const c = el('circle', { cx: x, cy: ys(rec.fT * 1e9), r: 5, fill: 'none', stroke: col, 'stroke-width': 2, opacity: rec.cryo ? 0.6 : 1 }, f.svg); el('title', {}, c).textContent = `${rec.device} (${rec.year}${rec.cryo ? ', cryogenic' : ''}): fT ${rec.fT} GHz`; }
      if (rec.fmax) { const yy = ys(rec.fmax * 1e9); const d = el('path', { d: `M${x} ${yy - 6}L${x + 6} ${yy}L${x} ${yy + 6}L${x - 6} ${yy}Z`, fill: col, opacity: rec.cryo ? 0.6 : 1 }, f.svg); el('title', {}, d).textContent = `${rec.device} (${rec.year}${rec.cryo ? ', cryogenic' : ''}): fmax ${rec.fmax} GHz`; }
    }
    const best = RF.reduce((a, b) => ((b.fmax || 0) > (a.fmax || 0) ? b : a));
    txt(f.svg, xs(best.year) - 10, ys(best.fmax * 1e9) + 4, `${best.device.replace(/ \(.*\)/, '')}, ${fmtHz(best.fmax * 1e9)}`, { 'text-anchor': 'end', fill: FAM[best.family], 'font-size': 10.5 });
    // legend
    let lx = xs(1992); const ly = ys(1.2e9);
    for (const [fam, col] of Object.entries(FAM)) { el('circle', { cx: lx + 4, cy: ly - 4, r: 4, fill: col }, f.svg); txt(f.svg, lx + 12, ly, fam, { fill: col, 'font-size': 10.5 }); lx += fam.length * 6.6 + 20; }
    txt(f.svg, xs(1992), ly + 16, '○ f_T   ◆ f_max (records)', { fill: C.ink2, 'font-size': 10.5 });
    txt(f.svg, xs(1992), ly + 32, '■ this model: peak f_T', { fill: C.ink2, 'font-size': 10.5 });
  }
  loop(sec.querySelector('[data-role=scope]'), dt => view.draw(dt));
  experiments(sec.querySelector('.lab-exp'), [
    { label: 'Sweep the frequency', run: api => { api.set('f', 1e5); setTimeout(() => api.animate({ f: 1e11 }, 4200), 300); }, note: 'At low frequency the output is an inverted, amplified copy of the input. Past the −3 dB bandwidth it shrinks by 10× per decade and starts to lag. Near f_T the right-half-plane zero (signal leaking forward through C_gd) adds a further lag of up to 90°.' },
    { label: 'The Miller effect', run: api => api.animate({ RS: 50, RL: 10, CL: 10 }, 900), note: 'C_gd is only 2.5 fF here, but the gain swings its far end the opposite way, so the input sees C_gd(1 + gm·R_out): roughly ten times larger. With a 50 kΩ source the input pole set by that Miller capacitance limits the bandwidth to well under 100 MHz.' },
    { label: 'Drive it from a strong source', run: api => api.animate({ RS: 0.01, RL: 10, CL: 10 }, 900), note: 'With a 10 Ω source the input pole moves far up and the output pole, R_out·(C_L + C_gd), takes over: the bandwidth jumps by more than an order of magnitude. Cascode stages and source followers are tricks to dodge the Miller effect in the same way.' },
    { label: 'Trade gain for bandwidth', run: api => api.animate({ RL: 0.6, RS: 1 }, 1000), note: 'A smaller load resistor lowers the gain, the Miller multiplication and the output time constant together, so the bandwidth rises. More current also raises gm and the transistor’s own f_T. Radio-frequency amplifiers accept modest gain per stage for this reason.' },
    { label: 'A faster transistor', run: api => { api.set('era', '1985_1p5um_cmos'); api.animate({ RL: 1, RS: 0.1, CL: 1 }, 700); setTimeout(() => api.set('era', '2025_2nm_gaa'), 2200); }, note: 'The 1.5 µm transistor’s f_T is a few gigahertz; the 2 nm one reaches above 100 GHz at this bias. Shorter channels mean less charge to move and less distance to move it. The records chart shows III–V and silicon–germanium transistors going further still: indium phosphide reaches 1.5 THz f_max.' },
  ], ctl);
  compute(); drawBode(); drawRecords();
  onWidth([bHost, rHost], () => { drawBode(); drawRecords(); });
}

export function record(stage, next) {
  stage.innerHTML = `<div class="rec-head"><span class="eyebrow">Frequency response</span><h2>Faster signals, less gain</h2><span class="rec-state" id="rs"></span></div><canvas></canvas>
    <div class="rec-foot"><span style="color:#3cc0b4">● input</span><span style="color:#f2b84b">● output</span><span class="rec-brand">Transistor Odyssey · Analog &amp; RF Lab</span></div>`;
  const v = new ScopeView(stage.querySelector('canvas'));
  return (n = 144) => {
    const k = next(), q = (k % n) / (n - 1), f = 10 ** (6 + 4.5 * (0.5 - 0.5 * Math.cos(2 * Math.PI * q)));
    v.set(response('1999_180nm', 2, 1, 10, f)); v.draw(1 / 12);
    stage.querySelector('#rs').textContent = `${fmtHz(f)} · gain ${v.r.mag.toFixed(2)}`; return k + 1;
  };
}
