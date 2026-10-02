// Lab 1 — Bands and carriers: band gap, intrinsic density, Fermi level, n and p.
import * as P from '../physics/carriers.js';
import { panel, tiles, experiments, hiCanvas, loop, sci, fix, frame, axes, linear, log, niceTicks, fmtPow, path, el, C, hover, tipRows, txt, clamp, fw, onWidth } from './ui.js';

const MATS = ['Si', 'Ge', 'GaAs', 'GaN', '4H-SiC', 'Diamond'];
const MCOL = { 'Si': C.s1, 'Ge': '#9085e9', 'GaAs': C.s5, 'GaN': C.s3, '4H-SiC': C.s4, 'Diamond': '#7fd3d0' };

function perCarrier(n) {
  // side of the cube that holds one carrier on average
  const V = 1 / n, side = Math.cbrt(V); // cm
  if (V > 1.08e27 * 0.01) return `${sci(V / 1.08e27)} Earth volumes`;
  const L = side < 1e-4 ? (side * 1e7).toPrecision(2) + ' nm' : side < 0.1 ? (side * 1e4).toPrecision(2) + ' µm' : side < 100 ? (side * 10).toPrecision(2) + ' mm' : side < 1e5 ? (side / 100).toPrecision(2) + ' m' : (side / 1e5).toPrecision(2) + ' km';
  return `${L} cube`;
}
function gamma15(r) { const u = Math.max(r(), 1e-9); const v = r(), w = Math.max(r(), 1e-9); const g = Math.sqrt(-2 * Math.log(w)) * Math.cos(2 * Math.PI * v); return -Math.log(u) + 0.5 * g * g; }

export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'mat', type: 'seg', label: 'Material', options: MATS.map(m => [m, m === '4H-SiC' ? '4H‑SiC' : m]), value: 'Si' },
    { key: 'T', label: 'Temperature', min: 80, max: 1000, step: 1, value: 300, fmt: v => Math.round(v) + ' K' },
    { key: 'type', type: 'seg', label: 'Doping type', options: [['n', 'n-type (donors)'], ['i', 'intrinsic'], ['p', 'p-type (acceptors)']], value: 'n' },
    { key: 'N', label: 'Dopant density', min: 1e13, max: 1e20, log: true, value: 1e16, fmt: v => sci(v) + ' cm⁻³' },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'Eg', label: 'Band gap E_g', unit: 'eV' }, { key: 'ni', label: 'Intrinsic density n_i', unit: 'cm⁻³' },
    { key: 'n', label: 'Electrons n', unit: 'cm⁻³' }, { key: 'p', label: 'Holes p', unit: 'cm⁻³' },
    { key: 'ef', label: 'E_F − E_i', unit: 'eV' }, { key: 'one', label: 'One free electron per', unit: '' },
  ].map(t => ({ ...t, label: t.label.replace(/_([a-zA-Z]+)/g, '<sub>$1</sub>') })));
  const warn = sec.querySelector('.pl-warn');

  // ---- band canvas with thermal carriers
  const host = sec.querySelector('[data-role=bands]'), cv = hiCanvas(host.querySelector('canvas'));
  let seed = 1; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const MAXP = 90;
  const elec = Array.from({ length: MAXP }, () => ({ x: r(), vx: (r() - .5) * .08, e: gamma15(r), te: gamma15(r), life: r() * 2 }));
  const hole = Array.from({ length: MAXP }, () => ({ x: r(), vx: (r() - .5) * .08, e: gamma15(r), te: gamma15(r), life: r() * 2 }));
  let S = null;

  function compute() {
    const s = ctl.state, Nd = s.type === 'n' ? s.N : 0, Na = s.type === 'p' ? s.N : 0;
    S = { ...P.equilibrium(s.mat, s.T, Nd, Na), mat: s.mat, T: s.T, Nd, Na };
    const ne = s => clamp(Math.round(5.2 * (Math.log10(Math.max(s, 1)) - 2.6)), 0, MAXP);
    S.nE = ne(S.n); S.nH = ne(S.p);
    show({ Eg: fix(S.Eg, 3), ni: sci(S.ni), n: sci(S.n), p: sci(S.p), ef: (S.EF - S.Ei >= 0 ? '+' : '') + fix(S.EF - S.Ei, 3), one: perCarrier(S.n) });
    const deg = S.EF > S.Eg - 3 * S.kT || S.EF < 3 * S.kT;
    warn.hidden = !deg;
    drawNi();
  }

  function drawBands(dt) {
    cv.resize();
    const { ctx, w, h } = cv; if (!S) return;
    ctx.clearRect(0, 0, w, h);
    const split = Math.round(w * 0.64), padL = 58, padR = 16, top = 18, bot = 26;
    const Emin = -0.55, Emax = S.Eg + 0.55;
    const y = E => top + (Emax - E) / (Emax - Emin) * (h - top - bot);
    // bands
    const g1 = ctx.createLinearGradient(0, y(Emax), 0, y(S.Eg)); g1.addColorStop(0, 'rgba(57,135,229,.28)'); g1.addColorStop(1, 'rgba(57,135,229,.06)');
    ctx.fillStyle = g1; ctx.fillRect(padL, y(Emax), split - padL, y(S.Eg) - y(Emax));
    const g2 = ctx.createLinearGradient(0, y(0), 0, y(Emin)); g2.addColorStop(0, 'rgba(217,89,38,.06)'); g2.addColorStop(1, 'rgba(217,89,38,.28)');
    ctx.fillStyle = g2; ctx.fillRect(padL, y(0), split - padL, y(Emin) - y(0));
    ctx.lineWidth = 2; ctx.strokeStyle = '#aab3c0';
    for (const E of [S.Eg, 0]) { ctx.beginPath(); ctx.moveTo(padL, y(E)); ctx.lineTo(split, y(E)); ctx.stroke(); }
    ctx.setLineDash([2, 4]); ctx.strokeStyle = '#8a94a3'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y(S.Ei)); ctx.lineTo(split, y(S.Ei)); ctx.stroke();
    ctx.setLineDash([7, 5]); ctx.strokeStyle = '#f2b84b'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(padL, y(S.EF)); ctx.lineTo(w - padR, y(S.EF)); ctx.stroke(); ctx.setLineDash([]);
    // dopant levels
    ctx.strokeStyle = 'rgba(232,236,241,.5)'; ctx.lineWidth = 2;
    const lev = S.Nd ? S.Eg - 0.045 : S.Na ? 0.045 : null;
    if (lev !== null) for (let X = padL + 10; X < split - 10; X += 26) { ctx.beginPath(); ctx.moveTo(X, y(lev)); ctx.lineTo(X + 12, y(lev)); ctx.stroke(); }
    // labels
    ctx.font = '12px "IBM Plex Mono", monospace'; ctx.textAlign = 'right'; ctx.fillStyle = '#aab3c0';
    ctx.fillText('Ec', padL - 8, y(S.Eg) + 4); ctx.fillText('Ev', padL - 8, y(0) + 4);
    ctx.fillStyle = '#8a94a3'; ctx.fillText('Ei', padL - 8, y(S.Ei) + 4);
    ctx.fillStyle = '#f2b84b'; ctx.fillText('EF', padL - 8, y(S.EF) + 4);
    ctx.textAlign = 'left'; ctx.fillStyle = '#8a94a3';
    ctx.fillText(`Eg = ${S.Eg.toFixed(2)} eV`, padL + 8, y(S.Eg) + (y(0) - y(S.Eg)) * 0.3);
    if (lev !== null) ctx.fillText(S.Nd ? 'donor levels' : 'acceptor levels', padL + 8, y(lev) + (S.Nd ? 16 : -8));
    // carriers
    const kT = S.kT, spanE = (Emax - Emin);
    const drawSet = (arr, count, isE) => {
      for (let i = 0; i < count; i++) {
        const p = arr[i];
        p.x += p.vx * dt; if (p.x < 0) { p.x = 0; p.vx *= -1; } if (p.x > 1) { p.x = 1; p.vx *= -1; }
        p.life -= dt; if (p.life < 0) { p.te = gamma15(r); p.life = 1 + r() * 2; p.vx = (r() - .5) * .1; }
        p.e += (p.te - p.e) * Math.min(dt * 2, 1);
        const E = isE ? S.Eg + p.e * kT : -p.e * kT;
        if (isE ? E > Emax - 0.02 : E < Emin + 0.02) continue;
        const X = padL + 8 + p.x * (split - padL - 16), Y = y(E) + (isE ? -4 : 4);
        ctx.beginPath(); ctx.arc(X, Y, 4, 0, Math.PI * 2);
        if (isE) { ctx.fillStyle = '#5aa2ff'; ctx.shadowColor = '#3987e5'; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0; }
        else { ctx.strokeStyle = '#ff8a55'; ctx.lineWidth = 1.8; ctx.stroke(); }
      }
    };
    drawSet(elec, S.nE, true); drawSet(hole, S.nH, false);
    // right: occupancy and carrier distributions on the same energy axis
    const x0 = split + 24, x1 = w - padR - 4;
    ctx.strokeStyle = '#2f3845'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(x0, h - bot); ctx.stroke();
    const N = 220; let maxN = 0, maxP = 0; const gn = [], gp = [], fE = [];
    for (let k = 0; k <= N; k++) {
      const E = Emin + spanE * k / N, f = P.occupancy(E, S.EF, S.T);
      const a = E > S.Eg ? Math.sqrt(E - S.Eg) * f : 0, b = E < 0 ? Math.sqrt(-E) * (1 - f) : 0;
      gn.push(a); gp.push(b); fE.push(f); maxN = Math.max(maxN, a); maxP = Math.max(maxP, b);
    }
    const W = x1 - x0;
    const area = (arr, mx, col) => {
      if (mx <= 0) return; ctx.beginPath(); ctx.moveTo(x0, y(Emin));
      arr.forEach((v, k) => ctx.lineTo(x0 + v / mx * W * 0.9, y(Emin + spanE * k / N))); ctx.lineTo(x0, y(Emax)); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
    };
    area(gn, maxN, 'rgba(57,135,229,.45)'); area(gp, maxP, 'rgba(217,89,38,.45)');
    ctx.beginPath(); fE.forEach((f, k) => { const X = x0 + f * W, Y = y(Emin + spanE * k / N); k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
    ctx.strokeStyle = '#e8ecf1'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#8a94a3'; ctx.font = '11px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText('f(E): 0 → 1', (x0 + x1) / 2, h - 8);
    ctx.textAlign = 'left'; ctx.fillStyle = '#86b6ef'; ctx.fillText('electrons gc·f', x0 + 6, y(S.Eg) - 8);
    ctx.fillStyle = '#ff9c73'; ctx.fillText('holes gv·(1−f)', x0 + 6, y(0) + 16);
  }

  // ---- n_i(T) plot
  const niHost = sec.querySelector('[data-role=ni]');
  function drawNi() {
    const f = frame(niHost, { w: fw(niHost), h: 300, m: { t: 12, r: 64, b: 40, l: 58 } });
    const xs = linear(80, 1000, f.x0, f.x1), ys = log(1e-12, 1e20, f.y0, f.y1);
    axes(f, xs, ys, { xt: niceTicks(100, 1000, 6), yt: [1e-12, 1e-8, 1e-4, 1, 1e4, 1e8, 1e12, 1e16, 1e20], xl: 'temperature (K)', yl: 'n_i (cm⁻³)', yf: fmtPow });
    const Ts = Array.from({ length: 93 }, (_, i) => 80 + i * 10);
    const labels = [];
    for (const m of MATS) {
      const pts = Ts.map(T => [T, P.intrinsicDensity(m, T)]).filter(([, n]) => n >= 1e-12).map(([T, n]) => [xs(T), ys(Math.min(n, 1e20))]);
      if (pts.length < 2) continue;
      const cur = m === S.mat;
      el('path', { d: path(pts), fill: 'none', stroke: MCOL[m], 'stroke-width': cur ? 2.6 : 1.2, opacity: cur ? 1 : 0.45 }, f.svg);
      labels.push({ m, x: pts[pts.length - 1][0], y: pts[pts.length - 1][1], cur });
    }
    labels.sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + 13);
    for (const l of labels) txt(f.svg, l.x + 6, l.y + 4, l.m, { fill: MCOL[l.m], opacity: l.cur ? 1 : .75 });
    const Nd = S.Nd || S.Na;
    if (Nd) { el('line', { x1: f.x0, x2: f.x1, y1: ys(Nd), y2: ys(Nd), stroke: '#f2b84b', 'stroke-dasharray': '5 5', 'stroke-width': 1.2 }, f.svg); txt(f.svg, f.x0 + 6, ys(Nd) - 6, 'doping level: intrinsic above this', { fill: '#f2b84b' }); }
    el('circle', { cx: xs(S.T), cy: ys(clamp(S.ni, 1e-12, 1e20)), r: 6, fill: '#f2b84b', stroke: C.surface, 'stroke-width': 2 }, f.svg);
    hover(f, niHost, xs, T => tipRows(`${Math.round(T)} K`, MATS.map(m => [m, sci(P.intrinsicDensity(m, T))])));
  }

  experiments(sec.querySelector('.lab-exp'), [
    { label: 'Heat lightly doped silicon to 650 K', set: { mat: 'Si', type: 'n', N: 1e14, T: 650 }, note: 'n<sub>i</sub> overtakes the doping: the crystal makes its own carriers and the Fermi level slides back to midgap. The transistor stops obeying its gate. Silicon power chips are limited to about 175 °C junction temperature for this reason.' },
    { label: 'Same test on GaN at 1000 K', set: { mat: 'GaN', type: 'n', N: 1e14, T: 1000 }, note: 'GaN\'s 3.4 eV gap keeps n<sub>i</sub> many orders below the doping even at 1000 K — part of why wide-gap semiconductors suit hot, high-power electronics.' },
    { label: 'Why diamond is an insulator', set: { mat: 'Diamond', type: 'i', T: 300 }, note: 'With a 5.47 eV gap, pure diamond at room temperature has roughly one thermally excited electron per several Earth volumes. Every useful diamond device needs dopants — and diamond\'s dopants are deep (Chapter 13).' },
    { label: 'Dope silicon to 10²⁰ cm⁻³', set: { mat: 'Si', type: 'n', N: 1e20, T: 300 }, note: 'The Fermi level moves into the conduction band. Boltzmann statistics (and this model) break down; real device simulators switch to Fermi–Dirac integrals and band-gap narrowing here.' },
    { label: 'Cool silicon to 80 K', set: { mat: 'Si', type: 'n', N: 1e16, T: 80 }, note: 'n<sub>i</sub> collapses but the electron density stays at the doping level because this model assumes every donor is ionized. Real silicon starts to “freeze out” below ~100 K as electrons fall back onto donors.' },
  ], ctl);

  ctl.on(() => compute());
  compute();
  onWidth([niHost], drawNi);
  loop(host, dt => drawBands(dt));
  addEventListener('resize', () => cv.resize());
}
