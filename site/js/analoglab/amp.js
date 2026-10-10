// Lab 01 — resistor-loaded common-source amplifier: gain, clipping and harmonic distortion.
import * as AN from '../physics/analog.js';
import { DATA } from '../data.js';
import { panel, tiles, experiments, hiCanvas, loop, frame, axes, linear, log, path, el, C, txt, fw, onWidth, hover, tipRows, clamp, coalesce, reduceMotion } from '../physlab/ui.js';

export const ERAS = [['1985_1p5um_cmos', '1.5 µm'], ['1999_180nm', '180 nm'], ['2007_45nm_hkmg', '45 nm'], ['2011_22nm_finfet', '22 nm FinFET'], ['2025_2nm_gaa', '2 nm GAA']];
export const ERA_COL = { '1985_1p5um_cmos': '#9a80dc', '1999_180nm': '#5598e7', '2007_45nm_hkmg': '#3cc0b4', '2011_22nm_finfet': '#f2b84b', '2025_2nm_gaa': '#ff8a55', '1975_8um_nmos': '#7d8db0', '2026_mos2_2d': '#d55181' };
const W = 10;                                                    // device width, µm
const mV = v => (Math.abs(v) < 1 ? (v * 1000).toFixed(Math.abs(v) < 0.01 ? 1 : 0) + ' mV' : v.toFixed(2) + ' V');
const pct = x => x >= 0.1 ? (100 * x).toFixed(0) + ' %' : x >= 0.01 ? (100 * x).toFixed(1) + ' %' : (100 * x).toFixed(2) + ' %';

export function stage(key, RL, off, amp) {
  const p = DATA.presets[key], vdd = p.VDD, vb0 = AN.biasForMidrail(p, vdd, RL, W), vb = vb0 + off;
  const st = AN.csStage(p, vdd, RL, vb, W), sr = AN.sineResponse(p, vdd, RL, vb, amp, W, 128);
  return { key, p, vdd, RL, vb0, vb, amp, st, sr, name: ERAS.find(e => e[0] === key)?.[1] || p.name };
}

export class AmpView {
  constructor(cv) { this.c = hiCanvas(cv); this.th = 0; this.off = 0; this.s = null; }
  set(s) { this.s = s; }
  draw(dt) {
    const { c, s } = this; c.resize(); const { ctx, w, h } = c; ctx.clearRect(0, 0, w, h); if (!s) return;
    this.th += dt * 2 * Math.PI / 1.8 * (reduceMotion ? 0.25 : 1);
    const n = s.sr.vout.length, q = (this.th / (4 * Math.PI)) % 1, idx = Math.floor(q * 2 * n) % n;
    const vin = s.sr.vin[idx], vout = s.sr.vout[idx], I = (s.vdd - vout) / (s.RL * 1e3);
    const narrow = w < 720;
    const sb = narrow ? { x: 8, y: 6, w: w - 16, h: h * 0.4 } : { x: 10, y: 10, w: w * 0.3, h: h - 20 };
    const sc = narrow ? { x: 46, y: h * 0.44, w: w - 58, h: h * 0.34 } : { x: w * 0.34 + 34, y: 18, w: w * 0.66 - 50, h: h * 0.6 };
    const hb = narrow ? { x: 46, y: h * 0.84, w: w - 58, h: h * 0.13 } : { x: w * 0.34 + 34, y: h * 0.74, w: w * 0.66 - 50, h: h * 0.2 };
    this.schematic(ctx, sb, s, vin, vout, I, dt);
    this.scope(ctx, sc, s, q, idx);
    this.harmonics(ctx, hb, s);
  }
  schematic(ctx, b, s, vin, vout, I, dt) {
    const mono = z => `${z}px "IBM Plex Mono", monospace`;
    const dx = b.x + b.w * 0.62, rail = b.y + 16, yr0 = rail + 10, yr1 = b.y + b.h * 0.42, yd = b.y + b.h * 0.5;
    const ch0 = yd + 10, ch1 = yd + b.h * 0.2, gnd = b.y + b.h - 18, gx = dx - 13, srcX = b.x + Math.max(b.w * 0.25, 76), srcY = (ch0 + ch1) / 2 + b.h * 0.1;
    const Imax = s.vdd / (s.RL * 1e3), heat = clamp(I / Imax, 0, 1);
    ctx.lineWidth = 2; ctx.strokeStyle = '#8a94a3'; ctx.lineCap = 'round';
    // rail
    ctx.beginPath(); ctx.moveTo(dx - 40, rail); ctx.lineTo(dx + 40, rail); ctx.stroke();
    ctx.fillStyle = '#e8ecf1'; ctx.font = '600 ' + mono(11); ctx.textAlign = 'right'; ctx.fillText(`VDD ${s.vdd} V`, dx - 46, rail + 4); ctx.textAlign = 'left';
    // resistor
    ctx.strokeStyle = `rgb(${150 + 105 * heat | 0},${148 + 40 * heat | 0},${163 - 80 * heat | 0})`;
    ctx.beginPath(); ctx.moveTo(dx, rail); ctx.lineTo(dx, yr0);
    const zig = 6, zh = (yr1 - yr0) / zig;
    for (let k = 0; k < zig; k++) ctx.lineTo(dx + (k % 2 ? -9 : 9), yr0 + zh * (k + 0.5));
    ctx.lineTo(dx, yr1); ctx.lineTo(dx, ch0); ctx.stroke();
    ctx.fillStyle = '#c8d0db'; ctx.font = mono(11); ctx.fillText(`R_L ${s.RL < 10 ? s.RL.toFixed(1) : s.RL.toFixed(0)} kΩ`.replace('_', ''), dx + 16, (yr0 + yr1) / 2 + 4);
    // transistor: channel, gate plate, drain/source stubs
    ctx.strokeStyle = '#8a94a3'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(dx, ch0); ctx.lineTo(dx - 6, ch0); ctx.moveTo(dx - 6, ch0 - 3); ctx.lineTo(dx - 6, ch1 + 3); ctx.moveTo(dx - 6, ch1); ctx.lineTo(dx, ch1); ctx.lineTo(dx, gnd); ctx.stroke();
    ctx.strokeStyle = '#f2b84b'; ctx.beginPath(); ctx.moveTo(gx, ch0); ctx.lineTo(gx, ch1); ctx.stroke();
    ctx.fillStyle = '#8a94a3'; ctx.beginPath(); ctx.moveTo(dx - 1, ch1); ctx.lineTo(dx - 7, ch1 - 4); ctx.lineTo(dx - 7, ch1 + 4); ctx.fill();
    // ground
    ctx.strokeStyle = '#8a94a3'; ctx.beginPath();
    for (const [k, half] of [[0, 12], [5, 8], [10, 4]]) { ctx.moveTo(dx - half, gnd + k); ctx.lineTo(dx + half, gnd + k); }
    ctx.stroke();
    // gate drive: source circle with the input sine, wired to the gate and to ground
    ctx.strokeStyle = '#3cc0b4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx, (ch0 + ch1) / 2); ctx.lineTo(srcX, (ch0 + ch1) / 2); ctx.lineTo(srcX, srcY - 15); ctx.stroke();
    ctx.beginPath(); ctx.arc(srcX, srcY, 15, 0, 7); ctx.stroke();
    ctx.beginPath(); for (let k = 0; k <= 20; k++) { const x = srcX - 9 + 18 * k / 20, y = srcY - 6 * Math.sin(2 * Math.PI * k / 20 + this.th); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    ctx.strokeStyle = '#8a94a3'; ctx.beginPath(); ctx.moveTo(srcX, srcY + 15); ctx.lineTo(srcX, gnd); ctx.lineTo(dx, gnd); ctx.stroke();
    ctx.fillStyle = '#7fd3d0'; ctx.font = mono(10.5); ctx.textAlign = 'right';
    ctx.fillText(`${s.vb.toFixed(3)} V`, srcX - 20, srcY + 6); ctx.fillText(`± ${mV(s.amp)}`, srcX - 20, srcY + 20);
    ctx.fillStyle = '#3cc0b4'; ctx.font = '600 ' + mono(11); ctx.fillText('in', srcX - 20, srcY - 10);
    // output node
    ctx.strokeStyle = '#f2b84b'; ctx.beginPath(); ctx.moveTo(dx, yd); ctx.lineTo(b.x + b.w - 4, yd); ctx.stroke();
    ctx.fillStyle = '#f2b84b'; ctx.beginPath(); ctx.arc(dx, yd, 3.5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(b.x + b.w - 4, yd, 4, 0, 7); ctx.fill();
    ctx.font = '600 ' + mono(11); ctx.textAlign = 'right'; ctx.fillText(`out ${vout.toFixed(2)} V`, b.x + b.w - 4, yd - 9);
    // current dots: rail → resistor → channel → ground, speed ∝ I
    this.off = (this.off + dt * 30 * (0.1 + 2.5 * heat) * (reduceMotion ? 0.2 : 1)) % 14;
    ctx.fillStyle = `rgba(255,210,122,${0.35 + 0.65 * heat})`;
    for (let y = rail + this.off; y < gnd; y += 14) { if (y > ch0 - 2 && y < ch1 + 2) { ctx.beginPath(); ctx.arc(dx - 3, y, 2.4, 0, 7); ctx.fill(); continue; } if (y > yr0 && y < yr1) continue; ctx.beginPath(); ctx.arc(dx, y, 2.4, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#ffd27a'; ctx.font = mono(11); ctx.textAlign = 'left';
    ctx.fillText(`I_D ${(I * 1e6).toFixed(0)} µA`.replace('_', ''), dx + 16, (ch0 + ch1) / 2 + 4);
    ctx.fillStyle = '#8a94a3'; ctx.font = mono(10); ctx.textAlign = 'left'; ctx.fillText(`${s.name}, W = ${W} µm`, b.x + 2, b.y + b.h - 2);
  }
  scope(ctx, b, s, q, idx) {
    const mono = z => `${z}px "IBM Plex Mono", monospace`, n = s.sr.vout.length;
    const lane = b.h * 0.22, top = b.y, bot = b.y + b.h - lane - 10;
    const Y = v => bot - (v / s.vdd) * (bot - top);
    ctx.fillStyle = 'rgba(16,20,26,.55)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#232a34'; ctx.lineWidth = 1;
    for (let k = 1; k < 8; k++) { const x = b.x + b.w * k / 8; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, b.y + b.h); ctx.stroke(); }
    for (let k = 1; k < 4; k++) { const y = top + (bot - top) * k / 4; ctx.beginPath(); ctx.moveTo(b.x, y); ctx.lineTo(b.x + b.w, y); ctx.stroke(); }
    ctx.strokeStyle = '#4b596d'; ctx.setLineDash([4, 4]);
    for (const v of [0, s.vdd]) { ctx.beginPath(); ctx.moveTo(b.x, Y(v)); ctx.lineTo(b.x + b.w, Y(v)); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.fillStyle = '#8a94a3'; ctx.font = mono(10); ctx.textAlign = 'right';
    ctx.fillText('V_DD'.replace('_', ''), b.x - 4, Y(s.vdd) + 4); ctx.fillText('0 V', b.x - 4, Y(0) + 4);
    const xi = k => b.x + b.w * k / (2 * n);
    // ideal linear output (dashed) and the real one
    ctx.save(); ctx.beginPath(); ctx.rect(b.x, top - 6, b.w, bot - top + 12); ctx.clip();
    ctx.strokeStyle = 'rgba(232,236,241,.45)'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.4; ctx.beginPath();
    for (let k = 0; k <= 2 * n; k++) { const v = s.st.vout + s.st.gain * (s.sr.vin[k % n] - s.vb); k ? ctx.lineTo(xi(k), Y(v)) : ctx.moveTo(xi(k), Y(v)); }
    ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    ctx.strokeStyle = '#f2b84b'; ctx.lineWidth = 2.4; ctx.beginPath();
    for (let k = 0; k <= 2 * n; k++) { const v = s.sr.vout[k % n]; k ? ctx.lineTo(xi(k), Y(v)) : ctx.moveTo(xi(k), Y(v)); }
    ctx.stroke();
    // input lane
    const ly = b.y + b.h - lane / 2 - 4;
    ctx.strokeStyle = '#3cc0b4'; ctx.lineWidth = 2; ctx.beginPath();
    for (let k = 0; k <= 2 * n; k++) { const v = (s.sr.vin[k % n] - s.vb) / s.amp; k ? ctx.lineTo(xi(k), ly - v * lane * 0.4) : ctx.moveTo(xi(k), ly - v * lane * 0.4); }
    ctx.stroke();
    // play head
    const px = b.x + b.w * q;
    ctx.strokeStyle = 'rgba(232,236,241,.35)'; ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, b.y + b.h); ctx.stroke();
    ctx.fillStyle = '#f2b84b'; ctx.beginPath(); ctx.arc(px, Y(s.sr.vout[idx]), 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#3cc0b4'; ctx.beginPath(); ctx.arc(px, ly - (s.sr.vin[idx] - s.vb) / s.amp * lane * 0.4, 3.5, 0, 7); ctx.fill();
    ctx.font = '600 ' + mono(11); ctx.textAlign = 'left';
    ctx.fillStyle = '#f2b84b'; ctx.fillText('output', b.x + 6, top + 14);
    ctx.fillStyle = 'rgba(232,236,241,.6)'; ctx.fillText('- - linear gain', b.x + 70, top + 14);
    ctx.fillStyle = '#3cc0b4'; ctx.fillText(`input ± ${mV(s.amp)}`, b.x + 6, ly - lane * 0.5 + 2);
  }
  harmonics(ctx, b, s) {
    const mono = z => `${z}px "IBM Plex Mono", monospace`, h = s.sr.h, K = 8, bw = b.w / (K + 3);
    ctx.font = '600 ' + mono(11); ctx.fillStyle = '#e8ecf1'; ctx.textAlign = 'left';
    ctx.fillText('harmonics', b.x, b.y + 10);
    ctx.font = mono(10); ctx.fillStyle = '#8a94a3'; ctx.fillText(`THD ${pct(s.sr.thd)}`, b.x, b.y + 26);
    for (let k = 1; k <= K; k++) {
      const db = h[1] > 0 ? 20 * Math.log10(Math.max(h[k] / h[1], 1e-5)) : -100, f = clamp((db + 80) / 80, 0, 1);
      const x = b.x + bw * (k + 1.6), hh = (b.h - 14) * f;
      ctx.fillStyle = k === 1 ? '#f2b84b' : k === 2 ? '#ff8a55' : k === 3 ? '#d55181' : '#9a80dc';
      ctx.globalAlpha = k === 1 ? 1 : 0.85; ctx.fillRect(x, b.y + b.h - 14 - hh, bw * 0.62, hh); ctx.globalAlpha = 1;
      ctx.fillStyle = '#8a94a3'; ctx.textAlign = 'center'; ctx.fillText(k === 1 ? 'f' : k + 'f', x + bw * 0.31, b.y + b.h - 2);
    }
    ctx.textAlign = 'right'; ctx.fillStyle = '#6f7a89'; ctx.fillText('0 dB … −80 dB', b.x + b.w, b.y + 10);
  }
}

export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'era', type: 'seg', label: 'Transistor generation', options: ERAS, value: '1999_180nm' },
    { key: 'RL', label: 'Load resistor R<sub>L</sub>', min: 1, max: 200, log: true, value: 10, fmt: v => (v < 10 ? v.toFixed(1) : v.toFixed(0)) + ' kΩ' },
    { key: 'amp', label: 'Input amplitude', min: 0.001, max: 0.5, log: true, value: 0.02, fmt: mV },
    { key: 'off', label: 'Bias shift from mid-rail', min: -0.15, max: 0.15, step: 0.001, value: 0, fmt: v => (v >= 0 ? '+' : '−') + Math.abs(v * 1000).toFixed(0) + ' mV' },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'gain', label: 'Small-signal gain', unit: '' }, { key: 'swing', label: 'Output swing', unit: 'peak to peak' },
    { key: 'thd', label: 'Distortion (THD)', unit: 'harmonics 2–9' }, { key: 'I', label: 'Bias current', unit: 'µA' },
    { key: 'gm', label: 'Transconductance gm', unit: 'mS' }, { key: 'vo', label: 'Output bias', unit: 'V' },
  ]);
  const view = new AmpView(sec.querySelector('[data-role=amp] canvas'));
  const vtcHost = sec.querySelector('[data-role=vtc]'), thdHost = sec.querySelector('[data-role=thd]');
  let s = null, others = null;
  const plots = coalesce(final => { drawVTC(); drawTHD(final); });
  ctl.on((k, final) => { compute(); if (k === 'era' || k === 'RL' || k === 'off' || k === '*') others = null; plots(final); });
  function compute() {
    const st = ctl.state; s = stage(st.era, st.RL, st.off, st.amp); view.set(s);
    const lo = Math.min(...s.sr.vout), hi = Math.max(...s.sr.vout);
    show({ gain: `${Math.abs(s.st.gain).toFixed(1)}× <small>(${(20 * Math.log10(Math.abs(s.st.gain))).toFixed(1)} dB)</small>`, swing: mV(hi - lo), thd: pct(s.sr.thd),
      I: (s.st.I * 1e6).toFixed(0), gm: (s.st.gm * 1e3).toFixed(2), vo: s.st.vout.toFixed(3) });
  }
  function drawVTC() {
    const f = frame(vtcHost, { w: fw(vtcHost), h: 290, m: { t: 14, r: 16, b: 40, l: 50 } }), p = s.p, vdd = s.vdd;
    const xs = linear(0, vdd, f.x0, f.x1), ys = linear(0, vdd, f.y0, f.y1), tk = vdd > 2 ? [0, 1, 2, 3, 4, 5] : [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8].filter(v => v <= vdd + 1e-9);
    axes(f, xs, ys, { xt: tk, yt: tk, xl: 'V_in (V)', yl: 'V_out (V)', xf: v => +v.toFixed(1) + '', yf: v => +v.toFixed(1) + '' });
    el('rect', { x: xs(s.vb - s.amp), y: f.y1, width: Math.max(xs(s.vb + s.amp) - xs(s.vb - s.amp), 1), height: f.y0 - f.y1, fill: '#3cc0b4', opacity: 0.14 }, f.svg);
    const lo = Math.min(...s.sr.vout), hi = Math.max(...s.sr.vout);
    el('rect', { x: f.x0, y: ys(hi), width: f.x1 - f.x0, height: Math.max(ys(lo) - ys(hi), 1), fill: '#f2b84b', opacity: 0.1 }, f.svg);
    const vin = Array.from({ length: 161 }, (_, i) => vdd * i / 160), vo = vin.map(v => AN.csOutput(p, v, vdd, s.RL, W));
    el('path', { d: path(vin.map((v, i) => [xs(v), ys(vo[i])])), fill: 'none', stroke: '#f2b84b', 'stroke-width': 2.4 }, f.svg);
    const g = s.st.gain, dv = vdd * 0.12 / Math.max(Math.abs(g), 1);
    el('path', { d: path([[xs(s.vb - dv), ys(s.st.vout - g * dv)], [xs(s.vb + dv), ys(s.st.vout + g * dv)]]), stroke: '#e8ecf1', 'stroke-dasharray': '5 4', fill: 'none', opacity: 0.8 }, f.svg);
    el('circle', { cx: xs(s.vb), cy: ys(s.st.vout), r: 5.5, fill: '#e8ecf1', stroke: C.surface, 'stroke-width': 2 }, f.svg);
    txt(f.svg, xs(s.vb) + 9, ys(s.st.vout) - 8, `slope ${g.toFixed(1)}`, { fill: '#e8ecf1' });
    txt(f.svg, f.x1 - 4, f.y1 + 14, `${s.name}, R_L ${s.RL.toFixed(s.RL < 10 ? 1 : 0)} kΩ`, { 'text-anchor': 'end', fill: C.muted });
    hover(f, vtcHost, xs, v => { const o = AN.csOutput(p, v, vdd, s.RL, W), d = (AN.csOutput(p, v + 1e-3, vdd, s.RL, W) - AN.csOutput(p, v - 1e-3, vdd, s.RL, W)) / 2e-3; return tipRows(`V_in ${v.toFixed(3)} V`.replace('_', ''), [['V out', o.toFixed(3) + ' V'], ['local gain', d.toFixed(2)]]); });
  }
  function thdCurve(key, n = 64) {
    const p = DATA.presets[key], vb = AN.biasForMidrail(p, p.VDD, ctl.state.RL, W) + ctl.state.off;
    return AMPS.map(a => [a, AN.sineResponse(p, p.VDD, ctl.state.RL, vb, a, W, n).thd]);
  }
  const AMPS = Array.from({ length: 26 }, (_, i) => 10 ** (-3 + 2.7 * i / 25));
  function drawTHD(final) {
    const f = frame(thdHost, { w: fw(thdHost), h: 290, m: { t: 14, r: 16, b: 40, l: 50 } });
    const xs = log(0.001, 0.5, f.x0, f.x1), ys = log(1e-4, 1, f.y0, f.y1);
    axes(f, xs, ys, { xt: [0.001, 0.01, 0.1], yt: [1e-4, 1e-3, 1e-2, 0.1, 1], xl: 'input amplitude', yl: 'THD', xf: v => v < 0.1 ? (v * 1000) + ' mV' : (v * 1000) + ' mV', yf: v => (v * 100) + ' %' });
    if (final && !others) others = Object.fromEntries(ERAS.filter(e => e[0] !== s.key).map(([k]) => [k, thdCurve(k)]));
    if (others) for (const [k, cur] of Object.entries(others)) {
      if (k === s.key) continue;
      el('path', { d: path(cur.map(([a, t]) => [xs(a), ys(clamp(t, 1e-4, 1))])), fill: 'none', stroke: ERA_COL[k], 'stroke-width': 1.2, opacity: 0.5 }, f.svg);
    }
    const cur = thdCurve(s.key);
    el('path', { d: path(cur.map(([a, t]) => [xs(a), ys(clamp(t, 1e-4, 1))])), fill: 'none', stroke: ERA_COL[s.key], 'stroke-width': 2.6 }, f.svg);
    el('line', { x1: f.x0, x2: f.x1, y1: ys(0.01), y2: ys(0.01), stroke: C.muted, 'stroke-dasharray': '3 4' }, f.svg);
    txt(f.svg, f.x0 + 6, ys(0.01) - 5, '1 %', { fill: C.muted, 'font-size': 10 });
    el('circle', { cx: xs(s.amp), cy: ys(clamp(s.sr.thd, 1e-4, 1)), r: 5.5, fill: '#e8ecf1', stroke: C.surface, 'stroke-width': 2 }, f.svg);
    txt(f.svg, f.x1 - 4, f.y0 - 8, `${s.name} (bold)`, { 'text-anchor': 'end', fill: ERA_COL[s.key] });
    hover(f, thdHost, xs, a => tipRows(mV(a), [[s.name, pct(AN.sineResponse(s.p, s.vdd, s.RL, s.vb, a, W, 64).thd)]]));
  }
  loop(sec.querySelector('[data-role=amp]'), dt => view.draw(dt));
  experiments(sec.querySelector('.lab-exp'), [
    { label: 'A clean, small signal', run: api => api.animate({ amp: 0.005, off: 0, RL: 10 }, 800), note: 'With a 5 mV input the output is a clean, inverted copy about ten times larger. The dashed linear prediction and the real output lie on top of each other, and the harmonics are more than 40 dB below the fundamental.' },
    { label: 'Turn it up until it clips', run: api => api.animate({ amp: 0.3, off: 0 }, 1400), note: 'At a few hundred millivolts the output hits the rails: the transistor turns fully off at the top and runs out of headroom at the bottom. The flattened sine is rich in odd harmonics, and THD climbs past 10 %.' },
    { label: 'Bias off-centre', run: api => api.animate({ amp: 0.04, off: 0.08 }, 900), note: 'Shift the bias up and the output sits closer to ground, so one half of the wave clips before the other. Asymmetric clipping makes even harmonics: the second harmonic bar jumps. Biasing at mid-rail maximises the symmetric swing.' },
    { label: 'More gain from a bigger resistor', run: api => api.animate({ RL: 100, amp: 0.005, off: 0 }, 900), note: 'A larger R_L converts the same current change into more voltage, but less current flows, so gm falls too, and r_o of the transistor caps the total. The gain saturates at the transistor’s intrinsic gain gm·r_o: try the 45 nm generation to see a low ceiling.' },
    { label: '1.5 µm versus 2 nm', run: api => { api.set('era', '1985_1p5um_cmos'); api.animate({ RL: 50, amp: 0.02, off: 0 }, 700); setTimeout(() => api.set('era', '2025_2nm_gaa'), 2200); }, note: 'The 1985 transistor runs from 5 V and swings volts at its output. The 2 nm device has only 0.7 V to work with, so the same input drives it into distortion much sooner: low supply voltage is one of the hardest problems of modern analog design.' },
  ], ctl);
  compute(); drawVTC(); drawTHD(true);
  onWidth([vtcHost, thdHost], () => { drawVTC(); drawTHD(true); });
}

export function record(stage_, next) {
  stage_.innerHTML = `<div class="rec-head"><span class="eyebrow">Common-source amplifier</span><h2>A small signal in, a big one out</h2><span class="rec-state" id="rs"></span></div><canvas></canvas>
    <div class="rec-foot"><span style="color:#3cc0b4">● input</span><span style="color:#f2b84b">● output</span><span class="rec-brand">Transistor Odyssey · Analog &amp; RF Lab</span></div>`;
  const v = new AmpView(stage_.querySelector('canvas'));
  return (n = 144) => {
    const k = next(), f = (k % n) / n, amp = 10 ** (-2.3 + 1.8 * (0.5 - 0.5 * Math.cos(2 * Math.PI * f)));
    const s = stage('1999_180nm', 10, 0, amp); v.set(s); v.th = 2 * Math.PI * 2 * (k % n) / n * 4; v.draw(1 / 12);
    stage_.querySelector('#rs').textContent = `input ± ${mV(amp)} · THD ${pct(s.sr.thd)}`; return k + 1;
  };
}
