// Lab 14 — Ballistic transistor: the top-of-barrier model and how close real devices get.
import * as B from '../physics/ballistic.js';
import { panel, tiles, experiments, hiCanvas, loop, sci, frame, axes, linear, log, path, el, C, hover, tipRows, txt, clamp, fw, onWidth, reduceMotion } from './ui.js';

const CH = Object.entries(B.CHANNELS).map(([k, v]) => [k, v.name.replace(' (100)', '')]);
const CHCOL = { Si: C.s1, InGaAs: C.s3, Ge: C.s4, MoS2: C.s5 };

export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'ch', type: 'seg', label: 'Channel material', options: CH, value: 'Si' },
    { key: 'vg', label: 'Gate voltage V_G', min: 0, max: 1, step: 0.01, value: 0.7, fmt: v => v.toFixed(2) + ' V' },
    { key: 'vd', label: 'Drain voltage V_D', min: 0, max: 1, step: 0.01, value: 0.7, fmt: v => v.toFixed(2) + ' V' },
    { key: 'L', label: 'Channel length L', min: 5, max: 200, log: true, value: 18, fmt: v => v.toFixed(v < 10 ? 1 : 0) + ' nm' },
    { key: 'mu', label: 'Low-field mobility µ', min: 20, max: 5000, log: true, value: 250, fmt: v => Math.round(v) + ' cm²/V·s' },
    { key: 'bal', type: 'toggle', label: 'Force the ballistic limit (T = 1)', value: false },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'I', label: 'Drain current', unit: 'µA/µm (intrinsic)' }, { key: 'Ib', label: 'Ballistic limit', unit: 'µA/µm' },
    { key: 'Bal', label: 'Ballisticity I/I_ball', unit: '' }, { key: 'T', label: 'Transmission T', unit: 'λ/(λ + ℓ)' },
    { key: 'v', label: 'Injection velocity', unit: 'cm/s' }, { key: 'lam', label: 'Mean free path λ', unit: 'nm' },
  ]);
  const anim = sec.querySelector('[data-role=balanim]'), cv = hiCanvas(anim.querySelector('canvas'));
  const ivHost = sec.querySelector('[data-role=baliv]'), lHost = sec.querySelector('[data-role=ball]');
  let p, R, Rb, parts = [], counts = { f: 0, b: 0, d: 0 };

  ctl.on((k, final) => { if (k === 'ch') ctl.set('mu', B.CHANNELS[ctl.state.ch].mu, false); compute(final); });

  function compute(final = true) {
    const s = ctl.state;
    p = B.params({ channel: s.ch, L: s.L, mu: s.mu });
    R = B.solve(p, s.vg, s.vd, s.bal); Rb = B.solve(p, s.vg, s.vd, true);
    show({ I: R.I.toFixed(0), Ib: Rb.I.toFixed(0), Bal: Rb.I > 0 ? (R.I / Rb.I).toFixed(2) : '—', T: R.T.toFixed(2), v: sci(R.vinj * 100, 2), lam: (p.lam * 1e9).toFixed(1) });
    drawIV(); if (final) drawL();
  }

  // ---------------- animation: electrons at the top of the barrier
  const spawn = fromDrain => ({ x: fromDrain ? 1 : 0.02, dir: fromDrain ? -1 : 1, e: -0.6 * Math.log(Math.max(Math.random(), 1e-4)), back: false, fromDrain, v: 0.32 + Math.random() * 0.25, decided: false });
  function band(x, s) {       // conduction band (eV, source Fermi level = 0); top of barrier at x = 0.22
    const top = R.Etop_eV, xs = 0.22;
    if (x < xs) { const u = x / xs; return top - 0.18 * (1 - u * u * (3 - 2 * u)) + (u < 0.15 ? 0 : 0); }
    const u = (x - xs) / (1 - xs); return top - s.vd * (1 - Math.pow(1 - Math.min(u, 1), 1.6)) - 0;
  }
  function paint(dt) {
    if (!R) return;
    cv.resize(); const { ctx, w, h } = cv; ctx.clearRect(0, 0, w, h);
    const s = ctl.state, pad = { l: 46, r: 16, t: 30, b: 34 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b;
    const top = Math.max(R.Etop_eV, 0) + 0.25, bot = Math.min(R.Etop_eV - s.vd - 0.3, -0.35);
    const X = x => pad.l + x * W, Y = E => pad.t + (top - E) / (top - bot) * H;
    // Fermi seas
    ctx.fillStyle = 'rgba(242,184,75,.16)'; ctx.fillRect(X(0), Y(0), X(0.12) - X(0), Y(bot) - Y(0));
    ctx.fillRect(X(0.9), Y(-s.vd), X(1) - X(0.9), Y(bot) - Y(-s.vd));
    ctx.strokeStyle = '#f2b84b'; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(0.3), Y(0)); ctx.moveTo(X(0.75), Y(-s.vd)); ctx.lineTo(X(1), Y(-s.vd)); ctx.stroke(); ctx.setLineDash([]);
    // kT layer
    const ell = (p.L * Math.pow((p.kT / 1.602e-19) / (p.kT / 1.602e-19 + s.vd), 0.75)) / p.L;
    ctx.fillStyle = 'rgba(213,81,129,.10)'; ctx.fillRect(X(0.22), pad.t, (1 - 0.22) * W * ell, H);
    // band
    ctx.beginPath(); for (let i = 0; i <= 200; i++) { const x = i / 200; i ? ctx.lineTo(X(x), Y(band(x, s))) : ctx.moveTo(X(x), Y(band(x, s))); }
    ctx.strokeStyle = '#3987e5'; ctx.lineWidth = 2.6; ctx.stroke();
    // electrons
    const rate = (R.I / Math.max(Rb.I, 1)) * 0.6 + 0.15, drainRate = Math.exp(-s.vd / 0.0259) * 0.8;
    if (parts.length < 70 && Math.random() < dt * 30 * rate) parts.push(spawn(false));
    if (parts.length < 70 && Math.random() < dt * 30 * drainRate) parts.push(spawn(true));
    const sp = dt * (reduceMotion ? 0.3 : 1);
    parts = parts.filter(q => {
      const E = q.fromDrain ? -s.vd + q.e * 0.04 : q.e * 0.04;     // kinetic energy distribution ~ kT
      q.x += q.dir * q.v * sp;
      if (!q.fromDrain && !q.decided && q.x > 0.22) {
        q.decided = true;
        if (E < band(0.22, s)) { q.dir = -1; q.reflect = true; }                         // below the top: thermionic reflection
        else if (!s.bal && Math.random() > R.T) { q.back = true; q.turnAt = 0.22 + Math.random() * ell * 0.78; }
        else counts.f++;
      }
      if (q.back && q.dir > 0 && q.x >= q.turnAt) { q.dir = -1; counts.b++; }
      if (q.fromDrain && q.x < 0.24 && !q.decided) { q.decided = true; if (E < band(0.22, s)) { q.dir = 1; q.reflect = true; } else counts.d++; }
      if (q.x < 0 || q.x > 1) return false;
      const y = Math.max(E, band(q.x, s) + 0.01);
      ctx.beginPath(); ctx.arc(X(q.x), Y(y) - 4, 3.2, 0, 7);
      ctx.fillStyle = q.fromDrain ? '#7fd3d0' : q.back ? '#d55181' : q.reflect ? 'rgba(138,148,163,.8)' : '#5aa2ff'; ctx.fill();
      return true;
    });
    // labels
    ctx.font = '11px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#8a94a3';
    ctx.fillText('source', X(0.06), pad.t - 10); if (w >= 560) ctx.fillText('top of barrier', X(0.22), pad.t - 10); ctx.fillText('channel', X(0.55), pad.t - 10); ctx.fillText('drain', X(0.95), pad.t - 10);
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffd27a'; ctx.fillText('E_F,source', X(0.01), Y(0) - 6); ctx.fillText('E_F,drain', X(0.78), Y(-s.vd) - 6);
    ctx.fillStyle = '#e8ecf1'; ctx.fillText(`E_top − E_F,source = ${(R.Etop_eV * 1000).toFixed(0)} meV`, X(0.24), Y(band(0.22, s)) + 20);
    ctx.fillStyle = 'rgba(213,81,129,.9)'; if (!s.bal && ell * W > 50) ctx.fillText('kT layer', X(0.225), pad.t + 14);
    const lx = w - 300; ctx.textAlign = 'left'; if (w < 560) { ctx.fillStyle = '#8a94a3'; ctx.textAlign = 'center'; ctx.fillText('position along the channel →', pad.l + W / 2, h - 8); return; }
    [['injected, transmitted', '#5aa2ff'], ['backscattered', '#d55181'], ['injected from drain', '#7fd3d0'], ['reflected (below the top)', '#8a94a3']].forEach(([t, c], i) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(lx, h - 66 + i * 15, 3.2, 0, 7); ctx.fill(); ctx.fillStyle = '#aab3c0'; ctx.fillText(t, lx + 9, h - 62 + i * 15);
    });
    ctx.fillStyle = '#8a94a3'; ctx.textAlign = 'center'; ctx.fillText('position along the channel →', pad.l + W / 2, h - 8);
  }
  loop(anim, dt => paint(dt));

  function drawIV() {
    const f = frame(ivHost, { w: fw(ivHost), h: 290, m: { t: 14, r: 16, b: 40, l: 58 } }), s = ctl.state;
    const VGs = [0.4, 0.55, 0.7, 0.85, 1.0], VDs = Array.from({ length: 31 }, (_, i) => i / 30);
    const cur = VGs.map(vg => VDs.map(vd => B.solve(p, vg, vd, s.bal).I)), bal = VGs.map(vg => VDs.map(vd => B.solve(p, vg, vd, true).I));
    const ymax = Math.max(100, ...bal.flat()) * 1.08;
    const xs = linear(0, 1, f.x0, f.x1), ys = linear(0, ymax, f.y0, f.y1);
    const yt = [0, ymax / 4, ymax / 2, 3 * ymax / 4].map(v => Math.round(v / 100) * 100);
    axes(f, xs, ys, { xt: [0, 0.25, 0.5, 0.75, 1], yt, xl: 'drain voltage V_D (V)', yl: 'I_D (µA/µm)', xf: v => v.toFixed(2), yf: v => String(v) });
    VGs.forEach((vg, k) => {
      el('path', { d: path(VDs.map((vd, i) => [xs(vd), ys(bal[k][i])])), fill: 'none', stroke: C.muted, 'stroke-width': 1, 'stroke-dasharray': '4 4' }, f.svg);
      el('path', { d: path(VDs.map((vd, i) => [xs(vd), ys(cur[k][i])])), fill: 'none', stroke: CHCOL[s.ch], 'stroke-width': 2, opacity: 0.45 + 0.55 * (k + 1) / VGs.length }, f.svg);
      txt(f.svg, f.x1 - 2, ys(cur[k][VDs.length - 1]) - 5, `V_G ${vg.toFixed(2)}`, { 'text-anchor': 'end', fill: C.ink2 });
    });
    el('circle', { cx: xs(s.vd), cy: ys(R.I), r: 5.5, fill: '#f2b84b', stroke: C.surface, 'stroke-width': 1.5 }, f.svg);
    hover(f, ivHost, xs, vd => tipRows(`V_D = ${vd.toFixed(2)} V`, VGs.map((vg, k) => [`V_G ${vg}`, `${Math.round(cur[k][Math.round(vd * 30)])} µA/µm`])));
  }

  function drawL() {
    const f = frame(lHost, { w: fw(lHost), h: 290, m: { t: 14, r: 16, b: 40, l: 50 } }), s = ctl.state;
    const xs = log(5, 200, f.x0, f.x1), ys = linear(0, 1, f.y0, f.y1);
    axes(f, xs, ys, { xt: [5, 10, 20, 50, 100, 200], yt: [0, 0.25, 0.5, 0.75, 1], xl: 'channel length L (nm)', yl: 'ballisticity  I / I_ballistic', xf: String, yf: v => v.toFixed(2) });
    const Ls = Array.from({ length: 40 }, (_, i) => 5 * 40 ** (i / 39));
    for (const [ch] of CH) {
      const pts = Ls.map(L => { const q = B.params({ channel: ch, L }); return [xs(L), ys(B.solve(q, s.vg, s.vd).I / Math.max(B.solve(q, s.vg, s.vd, true).I, 1e-9))]; });
      el('path', { d: path(pts), fill: 'none', stroke: CHCOL[ch], 'stroke-width': ch === s.ch ? 2.8 : 1.6, opacity: ch === s.ch ? 1 : 0.6 }, f.svg);
      const last = pts[pts.length - 1]; txt(f.svg, last[0] - 4, last[1] - 6, B.CHANNELS[ch].name.replace(' (100)', ''), { 'text-anchor': 'end', fill: CHCOL[ch] });
    }
    el('line', { x1: xs(s.L), x2: xs(s.L), y1: f.y0, y2: f.y1, stroke: '#f2b84b', 'stroke-dasharray': '3 4' }, f.svg);
  }

  experiments(sec.querySelector('.lab-exp'), [
    { label: 'Switch on the ballistic limit', set: { bal: true }, note: 'With no scattering every electron that clears the top of the barrier reaches the drain. The current is then set only by how many electrons sit at the top (the gate charge) and how fast they leave (the thermal injection velocity), not by mobility or channel length at all.' },
    { label: 'Shrink the channel from 100 nm to 10 nm', run: api => { api.set('bal', false); api.set('L', 100); setTimeout(() => api.animate({ L: 10 }, 1400), 300); }, note: 'Only electrons that scatter within the first "kT layer" past the top, where the potential has dropped by less than kT, can make it back to the source. As the channel shrinks, that layer becomes comparable to the mean free path and the transistor approaches the ballistic limit.' },
    { label: 'Try InGaAs', run: api => { api.set('bal', false); api.set('ch', 'InGaAs'); }, note: 'The light electron mass of InGaAs gives a very long mean free path and a fast injection velocity, so it is almost ballistic. But its low density of states limits how much charge the gate can put at the top of the barrier: the "density-of-states bottleneck" that kept III-V channels out of logic.' },
    { label: 'Drain at a few kT', run: api => api.animate({ vd: 0.05, bal: false }, 700), note: 'At low drain bias electrons are injected from both ends and the currents nearly cancel; the device behaves like a resistor whose resistance has a minimum set by the number of conducting modes, not by the channel length.' },
  ], ctl);

  compute(true);
  onWidth([ivHost, lHost], () => { drawIV(); drawL(); });
}
