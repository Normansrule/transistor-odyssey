// Lab — Lithography optics: the aerial image of lines and spaces.
import * as L from '../physics/litho.js';
import { panel, tiles, experiments, hiCanvas, fix, frame, axes, linear, log, niceTicks, path, el, C, hover, tipRows, txt, clamp, fw, onWidth } from './ui.js';

const TOOLS = {
  iline: { lam: 365, NA: 0.6, label: 'i-line 365 nm, NA 0.60' },
  krf: { lam: 248, NA: 0.8, label: 'KrF 248 nm, NA 0.80' },
  arfi: { lam: 193, NA: 1.35, label: 'ArF immersion 193 nm, NA 1.35' },
  euv: { lam: 13.5, NA: 0.33, label: 'EUV 13.5 nm, NA 0.33' },
  hna: { lam: 13.5, NA: 0.55, label: 'High-NA EUV 13.5 nm, NA 0.55' },
};

export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'tool', type: 'seg', label: 'Scanner', options: [['iline', 'i-line'], ['krf', 'KrF'], ['arfi', 'ArF-i'], ['euv', 'EUV'], ['hna', 'High-NA EUV']], value: 'arfi' },
    { key: 'pitch', label: 'Line pitch', min: 10, max: 800, log: true, value: 120, fmt: v => v.toFixed(v < 100 ? 1 : 0) + ' nm' },
    { key: 'illum', type: 'seg', label: 'Illumination', options: [['coherent', 'coherent'], ['conventional', 'conventional'], ['dipole', 'dipole']], value: 'conventional' },
    { key: 'sigma', label: 'Source size σ (conventional)', min: 0.05, max: 1, step: 0.01, value: 0.6, fmt: v => v.toFixed(2) },
    { key: 'sc', label: 'Dipole pole position σ<sub>c</sub>', min: 0.2, max: 0.98, step: 0.01, value: 0.7, fmt: v => v.toFixed(2) },
    { key: 'df', label: 'Defocus', min: -150, max: 150, step: 1, value: 0, fmt: v => v.toFixed(0) + ' nm' },
    { key: 'th', label: 'Resist threshold', min: 0.1, max: 0.6, step: 0.01, value: 0.3, fmt: v => v.toFixed(2) },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'k1', label: 'k₁ = half-pitch · NA / λ', unit: 'limit 0.25' }, { key: 'con', label: 'Image contrast', unit: '' },
    { key: 'cd', label: 'Printed space width', unit: 'nm (target = half-pitch)' }, { key: 'ord', label: 'Diffraction orders captured', unit: '' },
    { key: 'lim', label: 'Smallest pitch, this tool', unit: 'nm (λ / 2NA)' }, { key: 'verdict', label: 'Prints?', unit: '' },
  ]);
  const pupHost = sec.querySelector('[data-role=pupil]'), cvP = hiCanvas(pupHost.querySelector('canvas'));
  const wafHost = sec.querySelector('[data-role=wafer]'), cvW = hiCanvas(wafHost.querySelector('canvas'));
  const imgHost = sec.querySelector('[data-role=aerial]'), curHost = sec.querySelector('[data-role=pitchcurve]');
  let S, lastTool = 'arfi';

  const cfg = s => ({ lam: TOOLS[s.tool].lam, NA: TOOLS[s.tool].NA, kind: s.illum, sigma: s.sigma, sigmaC: s.sc, sigmaW: 0.08, defocus: s.df });
  function compute() {
    const s = ctl.state, t = TOOLS[s.tool];
    if (s.tool !== lastTool) { lastTool = s.tool; ctl.set('pitch', clamp(t.lam / t.NA * 1.1, 10, 800), false); return; }
    const c = cfg(s), r = L.aerialImage(s.pitch, { ...c, npts: 400 });
    const con = L.contrast(r.I), cd = L.printedCD(r.x, r.I, s.pitch, s.th);
    const [src] = L.sourcePoints(s.illum, s.sigma, s.sc, 0.08);
    const fcP = s.pitch * t.NA / t.lam; // orders at n / fcP in pupil units
    const cap = new Set(); for (const sp of src) for (let n = -8; n <= 8; n++) if (Math.abs(n / fcP + sp) <= 1 + 1e-9) cap.add(n);
    S = { ...r, con, cd, cap, fcP, src };
    const ok = con > 0.3 && cd > 0.15 * s.pitch && cd < 0.85 * s.pitch;
    show({ k1: L.k1(s.pitch, t.lam, t.NA).toFixed(3), con: con.toFixed(3), cd: cd.toFixed(1), ord: cap.size ? [...cap].sort((a, b) => a - b).join(', ') : 'none',
      lim: (t.lam / (2 * t.NA)).toFixed(1), verdict: ok ? '<span style="color:#35c28f">yes</span>' : con < 0.05 ? '<span style="color:#ff9c73">no image</span>' : '<span style="color:#f2b84b">marginal</span>' });
    drawPupil(); drawWafer(); drawImage(); drawCurve();
  }

  function drawPupil() {
    cvP.resize(); const { ctx, w, h } = cvP; if (!S) return;
    ctx.clearRect(0, 0, w, h);
    const R = Math.min(w, h) * (w >= 520 ? 0.3 : 0.33), cx = w / 2, cy = h / 2 + (w >= 520 ? 6 : 2);
    ctx.strokeStyle = '#aab3c0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.stroke();
    ctx.fillStyle = 'rgba(57,135,229,.06)'; ctx.fill();
    ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillStyle = '#8a94a3'; ctx.textAlign = 'center';
    ctx.fillText('lens pupil (radius NA/λ)', cx, cy - R - 10);
    // source shape centred on each diffraction order
    const s = ctl.state;
    for (let n = -6; n <= 6; n++) {
      const ox = cx + n / S.fcP * R; if (ox < -R || ox > w + R) continue;
      const captured = S.cap.has(n);
      ctx.globalAlpha = captured ? 0.9 : 0.35;
      if (s.illum === 'coherent') { ctx.beginPath(); ctx.arc(ox, cy, 5, 0, 6.283); ctx.fillStyle = captured ? '#f2b84b' : '#8a94a3'; ctx.fill(); }
      else if (s.illum === 'conventional') { ctx.beginPath(); ctx.arc(ox, cy, s.sigma * R, 0, 6.283); ctx.fillStyle = captured ? 'rgba(242,184,75,.35)' : 'rgba(138,148,163,.18)'; ctx.fill(); ctx.strokeStyle = captured ? '#f2b84b' : '#8a94a3'; ctx.stroke(); }
      else for (const sg of [-1, 1]) { ctx.beginPath(); ctx.arc(ox + sg * s.sc * R, cy, 0.08 * R + 2, 0, 6.283); ctx.fillStyle = captured ? '#f2b84b' : '#8a94a3'; ctx.fill(); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = captured ? '#f2b84b' : '#8a94a3'; ctx.fillText(n === 0 ? '0' : (n > 0 ? '+' : '') + n, ox, cy + R + 22);
    }
    if (w >= 520) { ctx.fillStyle = '#aab3c0'; ctx.textAlign = 'left'; ctx.fillText('mask diffraction orders, each with a copy of the source', 10, h - 10); }
  }

  function drawWafer() {
    cvW.resize(); const { ctx, w, h } = cvW; if (!S) return;
    const s = ctl.state, per = S.x[S.x.length - 1];
    ctx.clearRect(0, 0, w, h);
    const top = 10, mid = h / 2, bot = h - 22;
    for (let px = 0; px < w; px++) {
      const X = px / w * per, i = Math.min(Math.round(X / per * (S.I.length - 1)), S.I.length - 1), v = clamp(S.I[i] / 1.2, 0, 1);
      ctx.fillStyle = `rgb(${40 + v * 215 | 0},${35 + v * 175 | 0},${20 + v * 55 | 0})`; ctx.fillRect(px, top, 1, mid - top - 4);
      ctx.fillStyle = S.I[i] > s.th ? '#0c0f14' : '#b58fd6'; ctx.fillRect(px, mid + 4, 1, bot - mid - 4);
    }
    ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillStyle = '#e8ecf1'; ctx.textAlign = 'left';
    ctx.fillText('light reaching the resist (aerial image)', 8, top + 14);
    ctx.fillText('developed resist: violet = lines left behind', 8, mid + 18);
    ctx.fillStyle = '#8a94a3'; ctx.fillText(`${(per).toFixed(0)} nm field of view`, 8, h - 6);
  }

  function drawImage() {
    const s = ctl.state;
    const f = frame(imgHost, { w: fw(imgHost), h: 250, m: { t: 14, r: 16, b: 40, l: 50 } });
    const per = S.x[S.x.length - 1], mx = Math.max(1.2, ...S.I);
    const xs = linear(0, per, f.x0, f.x1), ys = linear(0, mx, f.y0, f.y1);
    // mask pattern (lines = chrome) as shading
    for (let k = 0; k < 2; k++) el('rect', { x: xs(k * s.pitch + 0.5 * s.pitch), y: f.y1, width: xs(0.5 * s.pitch) - xs(0), height: f.y0 - f.y1, fill: 'rgba(181,143,214,.08)' }, f.svg);
    axes(f, xs, ys, { xt: niceTicks(0, per, 6), yt: niceTicks(0, mx, 4), xl: 'position on the wafer (nm)', yl: 'intensity (clear field = 1)', xf: v => +v.toFixed(1), yf: v => +v.toFixed(1) });
    el('line', { x1: f.x0, x2: f.x1, y1: ys(s.th), y2: ys(s.th), stroke: '#f2b84b', 'stroke-dasharray': '6 4' }, f.svg);
    txt(f.svg, f.x1 - 4, ys(s.th) - 6, 'resist threshold', { 'text-anchor': 'end', fill: '#f2b84b' });
    el('path', { d: path(Array.from(S.x, (x, i) => [xs(x), ys(S.I[i])])), fill: 'none', stroke: C.s1, 'stroke-width': 2.2 }, f.svg);
    txt(f.svg, f.x0 + 6, f.y1 + 12, 'shaded: chrome lines on the mask', { fill: '#b58fd6' });
    hover(f, imgHost, xs, x => { const i = clamp(Math.round(x / per * (S.I.length - 1)), 0, S.I.length - 1); return tipRows(`x = ${x.toFixed(1)} nm`, [['intensity', S.I[i].toFixed(3)]]); });
  }

  function drawCurve() {
    const s = ctl.state, t = TOOLS[s.tool], c = cfg(s);
    const f = frame(curHost, { w: fw(curHost), h: 250, m: { t: 14, r: 16, b: 40, l: 50 } });
    const pmin = t.lam / (2 * t.NA) * 0.8, pmax = t.lam / t.NA * 3;
    const xs = log(pmin, pmax, f.x0, f.x1), ys = linear(0, 1.05, f.y0, f.y1);
    const ticks = [10, 20, 50, 100, 200, 500, 1000].filter(v => v >= pmin && v <= pmax);
    axes(f, xs, ys, { xt: ticks, yt: [0, 0.25, 0.5, 0.75, 1], xl: 'pitch (nm, log)', yl: 'image contrast', xf: v => String(v), yf: v => v.toFixed(2) });
    const ps = Array.from({ length: 90 }, (_, i) => pmin * (pmax / pmin) ** (i / 89));
    for (const [kind, col, dash] of [['coherent', C.muted, '2 3'], ['conventional', C.s1, null], ['dipole', C.s2, null]]) {
      const cc = { ...c, kind, npts: 96 };
      if (kind === 'dipole' && s.illum !== 'dipole') cc.sigmaC = s.sc;
      el('path', { d: path(ps.map(p => [xs(p), ys(L.contrast(L.aerialImage(p, cc).I))])), fill: 'none', stroke: col, 'stroke-width': kind === s.illum ? 2.4 : 1.3, 'stroke-dasharray': dash, opacity: kind === s.illum ? 1 : 0.7 }, f.svg);
    }
    for (const [p, lab] of [[t.lam / t.NA, 'λ/NA'], [t.lam / (2 * t.NA), 'λ/2NA']]) { el('line', { x1: xs(p), x2: xs(p), y1: f.y1, y2: f.y0, stroke: C.axis, 'stroke-dasharray': '3 4' }, f.svg); txt(f.svg, xs(p) + 3, f.y1 + 12, lab, { fill: C.muted }); }
    if (s.pitch >= pmin && s.pitch <= pmax) el('circle', { cx: xs(s.pitch), cy: ys(S.con), r: 6, fill: '#f2b84b', stroke: C.surface, 'stroke-width': 2 }, f.svg);
    txt(f.svg, f.x1 - 4, f.y0 - 38, '··· coherent', { 'text-anchor': 'end', fill: C.muted });
    txt(f.svg, f.x1 - 4, f.y0 - 24, '— conventional', { 'text-anchor': 'end', fill: '#86b6ef' });
    txt(f.svg, f.x1 - 4, f.y0 - 10, '— dipole', { 'text-anchor': 'end', fill: '#ff9c73' });
  }

  experiments(sec.querySelector('.lab-exp'), [
    { label: 'Coherent light and the λ/NA cut-off', run: api => api.animate({ tool: 'arfi', illum: 'coherent', pitch: 200, df: 0 }, 400, () => setTimeout(() => api.animate({ pitch: 130 }, 2600), 300)), note: 'With on-axis coherent light the lens must catch the ±1 orders to form any image. Below pitch = λ/NA (143 nm here) they fall outside the pupil and the image goes flat: the lines simply vanish.' },
    { label: 'Tilt the light: dipole illumination', set: { tool: 'arfi', illum: 'dipole', pitch: 80, sc: 0.89, df: 0 }, note: 'Illuminating from an angle lets the 0 and +1 orders both pass the pupil, halving the smallest pitch to λ/2NA (k₁ = 0.25). Tuning the poles to σ<sub>c</sub> = λ/(2·pitch·NA) puts both orders symmetrically in the lens. Immersion ArF with dipoles printed ~80 nm pitch in one exposure.' },
    { label: 'Switch to EUV at 28 nm pitch', set: { tool: 'euv', illum: 'dipole', pitch: 28, sc: 0.73, df: 0 }, note: 'At 13.5 nm wavelength, EUV prints 28 nm pitch (the metal pitch of 5–3 nm-class nodes) in a single exposure at k₁ ≈ 0.34. ArF immersion needed four exposures (SAQP) for the same result.' },
    { label: 'Defocus by 60 nm', set: { tool: 'arfi', illum: 'conventional', sigma: 0.6, pitch: 120, df: 60 }, note: 'Out of focus, each diffraction order picks up a different phase and the image washes out. The range of focus that still prints — the depth of focus — shrinks with NA²; High-NA EUV has well under 100 nm, which makes wafer flatness critical.' },
    { label: 'High-NA EUV: 16 nm pitch', set: { tool: 'hna', illum: 'dipole', pitch: 16, sc: 0.77, df: 0 }, note: 'NA 0.55 pushes the single-exposure limit to λ/2NA ≈ 12 nm pitch. ASML\'s EXE scanners target ~16 nm pitch for the 2 nm-class and beyond (Chapter 7).' },
  ], ctl);

  ctl.on(() => compute());
  compute();
  onWidth([imgHost, curHost, pupHost, wafHost], () => { drawPupil(); drawWafer(); drawImage(); drawCurve(); });
}
