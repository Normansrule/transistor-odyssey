// Lab 4 — Quantum tunnelling: transfer-matrix wavefunctions, T(E), gate leakage.
import * as T from '../physics/tunnel.js';
import { panel, tiles, experiments, hiCanvas, loop, sci, fix, frame, axes, linear, log, niceTicks, fmtPow, path, el, C, hover, tipRows, txt, clamp, fw, onWidth } from './ui.js';

const HBAR = 1.054571817e-34, M0 = 9.1093837015e-31, QE = 1.602176634e-19;

function build(s) {
  if (s.shape === 'rtd') return { V: [s.V0, 0, s.V0], W: [s.a, s.w, s.a] };
  if (s.shape === 'tilt') { const n = 40; return { V: Array.from({ length: n }, (_, i) => s.V0 - s.bias * (i + 0.5) / n), W: Array(n).fill(s.a / n) }; }
  return { V: [s.V0], W: [s.a] };
}

export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'shape', type: 'seg', label: 'Barrier', options: [['single', 'single'], ['rtd', 'double (resonant)'], ['tilt', 'tilted (biased oxide)']], value: 'single' },
    { key: 'E', label: 'Electron energy E', min: 0.01, max: 2.5, step: 0.001, value: 0.5, fmt: v => v.toFixed(3) + ' eV' },
    { key: 'V0', label: 'Barrier height V<sub>0</sub>', min: 0.1, max: 4, step: 0.01, value: 1.0, fmt: v => v.toFixed(2) + ' eV' },
    { key: 'a', label: 'Barrier width a', min: 0.1, max: 4, step: 0.01, value: 0.8, fmt: v => v.toFixed(2) + ' nm' },
    { key: 'w', label: 'Well width (double barrier)', min: 1, max: 10, step: 0.05, value: 4, fmt: v => v.toFixed(2) + ' nm' },
    { key: 'bias', label: 'Voltage across barrier (tilted)', min: 0, max: 3, step: 0.01, value: 1, fmt: v => v.toFixed(2) + ' V' },
    { key: 'm', label: 'Effective mass m*/m₀', min: 0.05, max: 1.0, step: 0.005, value: 1.0, fmt: v => v.toFixed(3) },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'T', label: 'Transmission T', unit: '' }, { key: 'R', label: 'Reflection R = 1 − T', unit: '' },
    { key: 'kap', label: 'Decay length 1/κ', unit: 'nm' }, { key: 'lam', label: 'de Broglie λ (outside)', unit: 'nm' },
    { key: 'ang', label: 'T change per +1 Å width', unit: '' }, { key: 'cls', label: 'Classically', unit: '' },
  ]);
  const host = sec.querySelector('[data-role=wave]'), cv = hiCanvas(host.querySelector('canvas'));
  const teHost = sec.querySelector('[data-role=te]'), lkHost = sec.querySelector('[data-role=leak]');
  let S;

  function compute(final) {
    const s = ctl.state, { V, W } = build(s), m = W.map(() => s.m);
    const res = T.transfer(s.E, V, W, m, s.m);
    const total = W.reduce((a, b) => a + b, 0), lead = Math.max(2.5, total * 0.5);
    const N = 700, xN = Array.from({ length: N }, (_, i) => -lead + (total + 2 * lead) * i / (N - 1));
    const wf = T.wavefunction(res, xN);
    const kap = s.E < s.V0 ? Math.sqrt(2 * s.m * M0 * (s.V0 - s.E) * QE) / HBAR : 0;
    const k = Math.sqrt(2 * s.m * M0 * s.E * QE) / HBAR;
    const b2 = build({ ...s, a: s.a + 0.1 }), T2 = T.transfer(s.E, b2.V, b2.W, b2.W.map(() => s.m), s.m).T;
    S = { res, V, W, total, lead, xN, wf, Tv: res.T };
    const maxV = Math.max(...V);
    show({ T: sci(res.T, 3), R: sci(Math.max(1 - res.T, 0), 3), kap: kap ? (1e9 / kap).toFixed(3) : '— (above barrier)', lam: (2 * Math.PI / k * 1e9).toFixed(2),
      ang: T2 > 0 ? '×' + sci(T2 / res.T, 2) : '—', cls: s.E < maxV ? '<span style="color:#ff9c73">reflected (T = 0)</span>' : '<span style="color:#86b6ef">transmitted (T = 1)</span>' });
    drawTE();
  }

  function drawWave(dt, now) {
    cv.resize(); const { ctx, w, h } = cv; if (!S) return;
    ctx.clearRect(0, 0, w, h);
    const s = ctl.state, padL = 40, padR = 14, top = 16, bot = 30;
    const x0 = -S.lead, x1 = S.total + S.lead;
    const X = x => padL + (x - x0) / (x1 - x0) * (w - padL - padR);
    const Emax = Math.max(s.V0, s.E) * 1.45 + 0.1;
    const Y = E => top + (Emax - E) / (Emax + 0.08) * (h - top - bot);
    // potential
    ctx.fillStyle = 'rgba(170,179,192,.13)'; ctx.strokeStyle = '#aab3c0'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X(x0), Y(0)); let xc = 0; ctx.lineTo(X(0), Y(0));
    S.V.forEach((v, i) => { ctx.lineTo(X(xc), Y(v)); xc += S.W[i]; ctx.lineTo(X(xc), Y(v)); });
    ctx.lineTo(X(xc), Y(0)); ctx.lineTo(X(x1), Y(0)); ctx.lineTo(X(x1), Y(-0.08)); ctx.lineTo(X(x0), Y(-0.08)); ctx.closePath(); ctx.fill(); ctx.stroke();
    // energy line
    ctx.setLineDash([6, 5]); ctx.strokeStyle = '#f2b84b'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(padL, Y(s.E)); ctx.lineTo(w - padR, Y(s.E)); ctx.stroke(); ctx.setLineDash([]);
    // wave: Re[psi e^{-i w t}] about the energy line
    const om = reduceSpeed(now);
    const cs = Math.cos(om), sn = Math.sin(om);
    const amp = (h - top - bot) * 0.14;
    const { re, im } = S.wf, xN = S.xN;
    // |psi|^2
    ctx.beginPath(); ctx.moveTo(X(xN[0]), Y(s.E));
    for (let i = 0; i < xN.length; i++) ctx.lineTo(X(xN[i]), Y(s.E) - (re[i] * re[i] + im[i] * im[i]) * amp * 0.5);
    ctx.lineTo(X(xN[xN.length - 1]), Y(s.E)); ctx.closePath(); ctx.fillStyle = 'rgba(57,135,229,.22)'; ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < xN.length; i++) { const v = re[i] * cs + im[i] * sn; const yy = Y(s.E) - v * amp; i ? ctx.lineTo(X(xN[i]), yy) : ctx.moveTo(X(xN[i]), yy); }
    ctx.strokeStyle = '#5aa2ff'; ctx.lineWidth = 2; ctx.stroke();
    // magnified transmitted wave
    const t = Math.sqrt(S.Tv);
    if (t < 0.25 && t > 1e-9) {
      const mag = 0.8 / t; ctx.beginPath(); let first = true;
      for (let i = 0; i < xN.length; i++) { if (xN[i] < S.total) continue; const v = (re[i] * cs + im[i] * sn) * mag; const yy = Y(s.E) - v * amp; first ? ctx.moveTo(X(xN[i]), yy) : ctx.lineTo(X(xN[i]), yy); first = false; }
      ctx.setLineDash([3, 3]); ctx.strokeStyle = '#7fd3d0'; ctx.lineWidth = 1.4; ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#7fd3d0'; ctx.font = '11px "IBM Plex Mono", monospace'; ctx.textAlign = 'right'; ctx.fillText(`transmitted wave ×${sci(mag, 2)}`, w - padR - 2, Y(s.E) - amp * 1.3);
    }
    // axes labels
    ctx.fillStyle = '#8a94a3'; ctx.font = '11px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
    for (let xv = Math.ceil(x0); xv <= x1; xv += Math.max(1, Math.round((x1 - x0) / 8))) ctx.fillText(xv + '', X(xv), h - 12);
    ctx.fillText('position (nm)', (padL + w) / 2, h - 0);
    ctx.textAlign = 'left'; ctx.fillStyle = '#f2b84b'; ctx.fillText(`E = ${s.E.toFixed(3)} eV`, padL + 4, Y(s.E) - 8 - amp * 1.1 < top ? Y(s.E) + 16 : Y(s.E) - 8 - amp * 1.1);
    ctx.fillStyle = '#aab3c0'; ctx.fillText(`V₀ = ${s.V0.toFixed(2)} eV`, X(0) + 4, Y(s.V0) - 6);
    ctx.fillStyle = '#86b6ef'; ctx.fillText('incident + reflected →', padL + 4, Y(-0.08) - 8);
  }
  let phase = 0, lastNow = 0;
  function reduceSpeed(now) { const dt = lastNow ? Math.min((now - lastNow) / 1000, 0.05) : 0; lastNow = now; phase += dt * 2.4; return phase; }

  function drawTE() {
    const s = ctl.state;
    const f = frame(teHost, { w: fw(teHost), h: 260, m: { t: 12, r: 16, b: 40, l: 58 } });
    const Emx = Math.max(2.5, s.V0 * 1.6);
    const xs = linear(0, Emx, f.x0, f.x1), ys = log(1e-14, 1.5, f.y0, f.y1);
    axes(f, xs, ys, { xt: niceTicks(0, Emx, 6), yt: [1e-14, 1e-11, 1e-8, 1e-5, 1e-2, 1], xl: 'electron energy E (eV)', yl: 'transmission T', yf: fmtPow, xf: v => +v.toFixed(1) });
    const { V, W } = build(s), m = W.map(() => s.m);
    const Es = Array.from({ length: 400 }, (_, i) => 0.003 + (Emx - 0.003) * i / 399);
    const Tv = Es.map(E => T.transfer(E, V, W, m, s.m).T);
    el('line', { x1: xs(s.V0), x2: xs(s.V0), y1: f.y1, y2: f.y0, stroke: C.axis, 'stroke-dasharray': '3 4' }, f.svg);
    txt(f.svg, xs(s.V0) + 4, f.y0 - 8, 'V_0', { fill: C.muted });
    el('path', { d: path(Es.map((E, i) => [xs(E), ys(clamp(Tv[i], 1e-14, 1.5))])), fill: 'none', stroke: C.s1, 'stroke-width': 2 }, f.svg);
    if (s.shape === 'single') {
      for (let i = 8; i < Es.length; i += 24) { const Ta = T.rectAnalytic(Es[i], s.V0, s.a, s.m); if (Ta > 1e-14) el('circle', { cx: xs(Es[i]), cy: ys(Ta), r: 3, fill: 'none', stroke: '#f2b84b', 'stroke-width': 1.3 }, f.svg); }
      txt(f.svg, f.x1 - 4, f.y0 - 10, '○ closed-form rectangular barrier', { 'text-anchor': 'end', fill: '#f2b84b' });
    }
    txt(f.svg, f.x1 - 4, f.y0 - 24, '— transfer matrix', { 'text-anchor': 'end', fill: '#86b6ef' });
    el('circle', { cx: xs(s.E), cy: ys(clamp(S.Tv, 1e-14, 1.5)), r: 6, fill: '#f2b84b', stroke: C.surface, 'stroke-width': 2 }, f.svg);
    hover(f, teHost, xs, E => tipRows(`E = ${E.toFixed(3)} eV`, [['T', sci(T.transfer(E, V, W, m, s.m).T, 3)]]));
  }

  function drawLeak() {
    const f = frame(lkHost, { w: fw(lkHost), h: 260, m: { t: 12, r: 16, b: 40, l: 58 } });
    const xs = linear(0.5, 2.5, f.x0, f.x1), ys = log(1e-22, 1e-2, f.y0, f.y1);
    axes(f, xs, ys, { xt: niceTicks(0.5, 2.5, 5), yt: [1e-22, 1e-18, 1e-14, 1e-10, 1e-6, 1e-2], xl: 'equivalent oxide thickness, EOT (nm)', yl: 'tunnelling probability', yf: fmtPow, xf: v => v.toFixed(1) });
    const eots = Array.from({ length: 41 }, (_, i) => 0.5 + 2 * i / 40);
    const sets = [['SiO₂', 'SiO2', 0, C.s1], ['Si₃N₄', 'Si3N4', 0, C.s4], ['HfO₂ on 0.5 nm SiO₂', 'HfO2', 0.5, C.s2], ['HfO₂ (no interlayer)', 'HfO2', 0, C.s3]];
    const data = sets.map(([, d, il]) => eots.map(e => T.stackTransmission(e, d, il)));
    sets.forEach(([name, , , col], j) => {
      const pts = eots.map((e, i) => [e, data[j][i]]).filter(p => p[1] >= 1e-22);
      el('path', { d: path(pts.map(([e, t]) => [xs(e), ys(Math.min(t, 1e-2))])), fill: 'none', stroke: col, 'stroke-width': 2 }, f.svg);
      const ly = f.y1 + 12 + j * 15;
      el('line', { x1: f.x1 - 176, x2: f.x1 - 160, y1: ly - 4, y2: ly - 4, stroke: col, 'stroke-width': 2 }, f.svg);
      txt(f.svg, f.x1 - 154, ly, name, { fill: col });
    });
    el('line', { x1: xs(1.2), x2: xs(1.2), y1: f.y1, y2: f.y0, stroke: C.muted, 'stroke-dasharray': '3 4' }, f.svg);
    txt(f.svg, xs(1.2) - 4, f.y1 + 12, 'SiO₂ limit', { fill: C.muted, 'text-anchor': 'end' });
    hover(f, lkHost, xs, e => tipRows(`EOT ${e.toFixed(2)} nm`, sets.map(([n, d, il]) => [n, sci(T.stackTransmission(e, d, il), 2)])));
  }

  experiments(sec.querySelector('.lab-exp'), [
    { label: 'Add one ångström to a 1 nm barrier', run: api => { api.animate({ shape: 'single', E: 0.3, V0: 3.1, a: 1.0, m: 0.5 }, 700, () => setTimeout(() => api.animate({ a: 1.1 }, 900), 500)); }, note: 'With SiO₂-like numbers (3.1 eV barrier, m* = 0.5) one extra ångström cuts transmission roughly 3–4×. Tunnelling is exponential in thickness: T ≈ e<sup>−2κa</sup>. That is why gate oxides could not keep thinning.' },
    { label: 'Send the electron over the barrier', set: { shape: 'single', E: 1.3, V0: 1.0, a: 0.8, m: 1.0 }, note: 'Classically the electron would sail through with T = 1. Quantum mechanically it still partly reflects, and T oscillates with energy: whenever the barrier holds a whole number of half-wavelengths, reflections cancel and T = 1.' },
    { label: 'Find the resonance of a double barrier', set: { shape: 'rtd', E: 0.141, V0: 0.6, a: 1.0, w: 4.0, m: 0.067 }, note: 'Each barrier alone passes less than 1% of electrons, but at E ≈ 0.141 eV the well between them holds a standing wave and T reaches 1. This is the resonant-tunnelling diode (Tsu, Esaki & Chang, 1973–74), made with GaAs/AlGaAs (m* = 0.067).' },
    { label: 'Tilt the barrier: a biased gate oxide', set: { shape: 'tilt', E: 0.03, V0: 3.1, a: 1.5, bias: 1.0, m: 0.5 }, note: 'Across a real gate oxide the applied voltage tilts the barrier into a trapezoid. Raise the voltage past 3.1 V and it becomes a triangle: Fowler–Nordheim tunnelling, the mechanism that programs flash memory.' },
    { label: 'Heavier electrons tunnel less', set: { shape: 'single', E: 0.3, V0: 1.0, a: 1.5, m: 1.0 }, run: api => api.animate({ shape: 'single', E: 0.3, V0: 1.0, a: 1.5, m: 0.05 }, 1800), note: 'κ grows as √m*. Light-mass materials (InAs, InGaAs: m* ≈ 0.02–0.04) tunnel easily, which is good for tunnel FETs but bad for source-to-drain leakage in very short channels.' },
  ], ctl);

  ctl.on(() => compute());
  compute(); drawLeak();
  onWidth([teHost, lkHost], () => { drawTE(); drawLeak(); });
  loop(host, (dt, now) => drawWave(dt, now));
}
