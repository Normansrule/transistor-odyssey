// Lab 6 — Electron drift: a live ensemble Monte Carlo of hot electrons in silicon.
import { Ensemble, caugheyThomas, HW } from '../physics/montecarlo.js';
import { panel, tiles, experiments, hiCanvas, loop, sci, fix, frame, axes, linear, log, path, el, C, hover, tipRows, txt, clamp, ramp, rgb, reduceMotion, fw, onWidth } from './ui.js';

const N = 500, NM_PER_PX = 0.9;
const KIND = [['acoustic phonon', '#5aa2ff'], ['optical absorption', '#35c28f'], ['optical emission', '#ff8a55']];

export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'F', label: 'Electric field F', min: 100, max: 3e5, log: true, value: 3e3, fmt: v => sci(v) + ' V/cm' },
    { key: 'T', label: 'Lattice temperature', min: 77, max: 500, step: 1, value: 300, fmt: v => Math.round(v) + ' K' },
    { key: 'speed', label: 'Simulation speed', min: 0.25, max: 3, step: 0.05, value: 1, fmt: v => v.toFixed(2) + '×' },
    { key: 'trails', type: 'toggle', label: 'Show trails', value: true },
  ]);
  const btns = sec.querySelector('.pl-btns');
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'v', label: 'Drift velocity ⟨v⟩', unit: 'cm/s' }, { key: 'mu', label: 'Apparent mobility v/F', unit: 'cm²/V·s' },
    { key: 'E', label: 'Mean energy ⟨E⟩', unit: 'meV' }, { key: 'Te', label: 'Electron temperature', unit: 'K' },
    { key: 'mix', label: 'Scattering mix', unit: 'ac / abs / emit' }, { key: 't', label: 'Simulated time', unit: 'ps' },
  ]);
  const host = sec.querySelector('[data-role=gas]'), cv = hiCanvas(host.querySelector('canvas'));
  const vfHost = sec.querySelector('[data-role=vf]'), trHost = sec.querySelector('[data-role=trace]');
  let ens, pos, trace = [], avg = 0, avgN = 0, stepsSinceF = 0, points = [], running = true, flashes = [];

  function reset() {
    ens = new Ensemble(N, ctl.state.T, 11);
    pos = new Float32Array(2 * N); for (let i = 0; i < 2 * N; i++) pos[i] = Math.random();
    trace = []; avg = 0; avgN = 0; stepsSinceF = 0;
  }
  reset();

  ctl.on(k => {
    if (k === 'T' || (k === '*' && Math.abs(ens.T - ctl.state.T) > 0.5)) { const keepTrace = trace; reset(); trace = keepTrace; }
    if (k === 'F' || k === '*') { avg = 0; avgN = 0; stepsSinceF = 0; }
    drawVF();
  });
  btns.querySelector('[data-act=pause]').addEventListener('click', e => { running = !running; e.currentTarget.textContent = running ? 'Pause' : 'Play'; e.currentTarget.setAttribute('aria-pressed', String(!running)); });
  btns.querySelector('[data-act=reset]').addEventListener('click', () => { reset(); points = []; drawVF(); });

  function frameStep(dt) {
    if (!running) return;
    const F = ctl.state.F;
    const steps = Math.round(24 * ctl.state.speed * (reduceMotion ? 0.5 : 1));
    const { ctx, w, h } = cv;
    const pxPerM = 1 / (NM_PER_PX * 1e-9);
    let vs = 0;
    for (let s = 0; s < steps; s++) {
      const v = ens.step(F); vs += v; stepsSinceF++;
      for (let i = 0; i < N; i++) {
        pos[2 * i] += ens.vx(i) * ens.dt * pxPerM / w; pos[2 * i + 1] += ens.vy(i) * ens.dt * pxPerM / h;
        if (ens.last[i] >= 0 && flashes.length < 50 && Math.random() < (ens.last[i] === 0 ? 0.03 : 0.12)) flashes.push({ x: pos[2 * i], y: pos[2 * i + 1], k: ens.last[i], life: 0.35 });
      }
    }
    for (let i = 0; i < 2 * N; i++) pos[i] -= Math.floor(pos[i]);
    const vNow = vs / steps;
    trace.push([ens.t * 1e12, vNow]); if (trace.length > 900) trace.shift();
    // steady-state average after ~1.5 ps at this field
    if (ens.dt * stepsSinceF > 1.5e-12) { avg += vNow; avgN++; if (avgN === 60) { points = points.filter(p => Math.abs(Math.log10(p[0] / F)) > 0.03 || p[2] !== Math.round(ens.T)); points.push([F, avg / avgN, Math.round(ens.T)]); drawVF(); } }
  }

  function paint(dt) {
    cv.resize(); const { ctx, w, h } = cv;
    const trails = ctl.state.trails;
    ctx.fillStyle = trails ? 'rgba(16,20,26,.28)' : '#10141a'; ctx.fillRect(0, 0, w, h);
    // lattice
    ctx.fillStyle = 'rgba(138,148,163,.10)';
    const a = 0.543 / NM_PER_PX * 8; for (let y = a / 2; y < h; y += a) for (let x = (Math.round(y / a) % 2) * a / 2; x < w; x += a) ctx.fillRect(x - 1, y - 1, 2, 2);
    // electrons coloured by energy
    for (let i = 0; i < N; i++) {
      const E = ens.E[i], c = ramp(clamp(E / 0.35, 0, 1) * 0.85 + 0.12);
      ctx.fillStyle = rgb(c); ctx.beginPath(); ctx.arc(pos[2 * i] * w, pos[2 * i + 1] * h, 2.3, 0, 6.283); ctx.fill();
    }
    // scattering flashes
    for (const f of flashes) { f.life -= dt; ctx.strokeStyle = KIND[f.k][1]; ctx.globalAlpha = clamp(f.life / 0.35, 0, 1); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(f.x * w, f.y * h, 3 + (0.35 - f.life) * 22, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1; flashes = flashes.filter(f => f.life > 0);
    // field arrow (field points +x; electrons drift −x)
    ctx.fillStyle = 'rgba(10,13,17,.75)'; ctx.fillRect(10, 10, 212, 44);
    ctx.strokeStyle = '#f2b84b'; ctx.fillStyle = '#f2b84b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(20, 24); ctx.lineTo(80, 24); ctx.stroke(); ctx.beginPath(); ctx.moveTo(86, 24); ctx.lineTo(78, 19); ctx.lineTo(78, 29); ctx.fill();
    ctx.font = '11px "IBM Plex Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText(`F = ${sci(ctl.state.F)} V/cm`, 94, 28);
    ctx.fillStyle = '#86b6ef'; ctx.fillText('← electrons drift against F', 20, 46);
    // legend
    ctx.fillStyle = 'rgba(10,13,17,.75)'; ctx.fillRect(w - 176, h - 62, 166, 52);
    ctx.textAlign = 'right'; KIND.forEach(([n, c], i) => { ctx.fillStyle = c; ctx.fillText('○ ' + n, w - 16, h - 44 + 15 * i); });
  }

  let last = 0;
  function readouts(now) {
    if (now - last < 200) return; last = now;
    const v = avgN ? avg / avgN : trace.length ? trace[trace.length - 1][1] : 0, E = ens.meanE();
    const tot = ens.counts.reduce((a, b) => a + b, 0) || 1;
    show({ v: sci(v, 3), mu: Math.round(v / ctl.state.F).toString(), E: (E * 1000).toFixed(1), Te: Math.round(E * 2 / 3 / 8.617e-5).toString(),
      mix: ens.counts.map(c => Math.round(c / tot * 100)).join(' / ') + ' %', t: (ens.t * 1e12).toFixed(2) });
    drawTrace();
  }

  function drawVF() {
    const f = frame(vfHost, { w: fw(vfHost), h: 280, m: { t: 14, r: 16, b: 40, l: 58 } });
    const xs = log(100, 3e5, f.x0, f.x1), ys = log(1e5, 3e7, f.y0, f.y1);
    axes(f, xs, ys, { xt: [100, 1e3, 1e4, 1e5], yt: [1e5, 1e6, 1e7], xl: 'field F (V/cm)', yl: 'drift velocity (cm/s)', xf: v => sci(v, 1), yf: v => sci(v, 1) });
    const Fs = Array.from({ length: 120 }, (_, i) => 10 ** (2 + 3.48 * i / 119));
    el('path', { d: path(Fs.map(F => [xs(F), ys(caugheyThomas(F))])), fill: 'none', stroke: C.muted, 'stroke-width': 1.6 }, f.svg);
    el('path', { d: path(Fs.map(F => [xs(F), ys(clamp(1400 * F, 1e5, 3e7))])), fill: 'none', stroke: C.s4, 'stroke-width': 1, 'stroke-dasharray': '4 4' }, f.svg);
    txt(f.svg, xs(150), ys(1400 * 150 * 1.1) - 8, 'µ = 1400', { fill: '#c98500' });
    txt(f.svg, f.x1 - 4, ys(1.07e7) - 8, 'measured (Canali 1975)', { 'text-anchor': 'end', fill: C.muted });
    for (const [F, v, T] of points) el('circle', { cx: xs(F), cy: ys(clamp(v, 1e5, 3e7)), r: 5, fill: T === 300 ? C.s1 : T < 300 ? '#7fd3d0' : C.s2, stroke: C.surface, 'stroke-width': 1.5 }, f.svg);
    el('line', { x1: xs(ctl.state.F), x2: xs(ctl.state.F), y1: f.y1, y2: f.y0, stroke: '#f2b84b', 'stroke-dasharray': '3 4' }, f.svg);
    txt(f.svg, f.x1 - 4, f.y0 - 10, '● your Monte Carlo runs (steady state)', { fill: '#86b6ef', 'text-anchor': 'end' });
    hover(f, vfHost, xs, F => tipRows(`F = ${sci(F)} V/cm`, [['measured fit', sci(caugheyThomas(F), 3) + ' cm/s']]));
  }

  function drawTrace() {
    const f = frame(trHost, { w: fw(trHost), h: 200, m: { t: 12, r: 16, b: 38, l: 58 } });
    if (!trace.length) return;
    const t0 = trace[0][0], t1 = Math.max(trace[trace.length - 1][0], t0 + 0.5);
    const vmax = Math.max(2e6, ...trace.map(p => p[1])) * 1.1;
    const xs = linear(t0, t1, f.x0, f.x1), ys = linear(Math.min(0, ...trace.map(p => p[1])), vmax, f.y0, f.y1);
    axes(f, xs, ys, { xt: [t0, (t0 + t1) / 2, t1], yt: [0, vmax / 2, vmax].map(v => +v.toPrecision(2)), xl: 'time (ps)', yl: 'mean v (cm/s)', xf: v => v.toFixed(1), yf: v => sci(v, 1) });
    // smooth for display
    const k = 6, sm = trace.map((p, i) => { let s = 0, c = 0; for (let j = Math.max(0, i - k); j <= Math.min(trace.length - 1, i + k); j++) { s += trace[j][1]; c++; } return [p[0], s / c]; });
    el('path', { d: path(sm.map(p => [xs(p[0]), ys(p[1])])), fill: 'none', stroke: C.s1, 'stroke-width': 1.8 }, f.svg);
    const vss = caugheyThomas(ctl.state.F);
    if (vss < vmax) { el('line', { x1: f.x0, x2: f.x1, y1: ys(vss), y2: ys(vss), stroke: C.muted, 'stroke-dasharray': '4 4' }, f.svg); txt(f.svg, f.x0 + 4, ys(vss) - 5, 'measured steady state', { fill: C.muted }); }
  }

  experiments(sec.querySelector('.lab-exp'), [
    { label: 'Low field: the mobility regime (1 kV/cm)', set: { F: 1e3, T: 300 }, note: 'Electrons are barely heated; they gain a little momentum along the field between collisions and lose it to acoustic phonons. Velocity is proportional to field: v = µF with µ ≈ 1400 cm²/V·s. Wait ~2 ps for a steady-state point to appear on the chart.' },
    { label: 'High field: velocity saturation (100 kV/cm)', set: { F: 1e5, T: 300 }, note: 'Electrons now gain energy faster than acoustic scattering removes it. Once they reach 63 meV they emit optical phonons (orange flashes) — each emission dumps a large chunk of energy and randomizes direction. Velocity stalls near 10⁷ cm/s no matter how hard you push.' },
    { label: 'Step the field up suddenly', run: api => { api.set('F', 1e3); setTimeout(() => api.set('F', 5e4), 1800); }, note: 'Watch the time trace: velocity briefly overshoots the steady-state value. Momentum relaxes in ~0.1 ps but energy takes longer, so for a moment electrons are fast but not yet hot enough to emit phonons. Sub-50 nm transistors exploit this “velocity overshoot”.' },
    { label: 'Cool the crystal to 77 K', set: { T: 77, F: 1e3 }, note: 'Fewer phonons means fewer collisions, so low-field mobility rises about sixfold in this model; measured pure silicon exceeds 20 000 cm²/V·s at 77 K. Cryogenic CMOS for quantum-computer control electronics leans on this.' },
  ], ctl);

  drawVF();
  onWidth([vfHost, trHost], () => { drawVF(); drawTrace(); });
  loop(host, (dt, now) => { frameStep(dt); paint(dt); readouts(now); });
}
