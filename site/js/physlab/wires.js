// Lab 15 — Interconnect: why the wires, not the transistors, now limit speed.
import * as WR from '../physics/interconnect.js';
import { panel, tiles, experiments, hiCanvas, loop, sci, frame, axes, linear, log, logTicks, path, el, C, hover, tipRows, txt, clamp, ramp, rgb, fw, onWidth, reduceMotion } from './ui.js';

const MCOL = { Cu: '#d9825b', Co: '#7fd3d0', Ru: '#b58fd6', W: '#8a94a3' };
const R0 = 6e3, C0 = 0.3e-15;       // minimum inverter: output resistance (Ohm) and input capacitance (F)

export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'metal', type: 'seg', label: 'Wire metal', options: Object.keys(WR.METALS).map(k => [k, WR.METALS[k].name]), value: 'Cu' },
    { key: 'w', label: 'Line width', min: 6, max: 200, log: true, value: 14, fmt: v => v.toFixed(v < 10 ? 1 : 0) + ' nm' },
    { key: 'ar', label: 'Aspect ratio h/w', min: 1, max: 3, step: 0.05, value: 2, fmt: v => v.toFixed(2) },
    { key: 'bar', label: 'Barrier + liner thickness', min: 0, max: 4, step: 0.1, value: 2, fmt: v => v.toFixed(1) + ' nm' },
    { key: 'k', label: 'Dielectric constant k', min: 1.5, max: 4.2, step: 0.05, value: 2.7, fmt: v => v.toFixed(2) },
    { key: 'L', label: 'Wire length', min: 1, max: 5000, log: true, value: 100, fmt: v => v >= 1000 ? (v / 1000).toFixed(2) + ' mm' : v.toFixed(v < 10 ? 1 : 0) + ' µm' },
    { key: 'drv', label: 'Driver size (× minimum)', min: 1, max: 64, log: true, value: 4, fmt: v => v.toFixed(v < 10 ? 1 : 0) + '×' },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'rho', label: 'Resistivity in the line', unit: 'µΩ·cm' }, { key: 'r', label: 'Resistance', unit: 'Ω per µm' },
    { key: 'c', label: 'Capacitance', unit: 'fF per µm' }, { key: 'd', label: 'Wire delay (no repeaters)', unit: 'ps' },
    { key: 'rep', label: 'With optimal repeaters', unit: 'ps' }, { key: 'x', label: 'Length where wire = gate delay', unit: 'µm' },
  ]);
  const anim = sec.querySelector('[data-role=wireanim]'), cv = hiCanvas(anim.querySelector('canvas'));
  const rhoHost = sec.querySelector('[data-role=rho]'), delHost = sec.querySelector('[data-role=delay]');
  let S = null, sim = null, simT = 0, simPeriod = 1, grains = [], electrons = [];

  ctl.on((k, final) => { if (k === 'metal') ctl.set('bar', WR.METALS[ctl.state.metal].barrier, false); compute(); });

  function geom(s) { const h = s.w * s.ar; return { w: s.w, h, sp: s.w, r: WR.rPerUm(s.metal, s.w, h, s.bar), c: WR.cPerUm(s.w, h, s.w, s.k) }; }
  function compute() {
    const s = ctl.state, g = geom(s), Rd = R0 / s.drv, Cd = C0 * s.drv;
    const d = WR.elmoreDelay(g.r, g.c, s.L, Rd, Cd), [rep, nrep] = WR.repeatedDelay(g.r, g.c, s.L, R0 * 0.25, C0 * 4);
    const gate = 0.69 * R0 * 5 * C0;                                        // fan-out-4 gate delay of the minimum inverter
    let lo = 0.1, hi = 1e5; for (let i = 0; i < 60; i++) { const m = Math.sqrt(lo * hi); if (WR.elmoreDelay(g.r, g.c, m, R0, C0) - 0.69 * R0 * C0 > gate) hi = m; else lo = m; }
    const wc = Math.max(s.w - 2 * s.bar, 0.5), hc = Math.max(g.h - s.bar, 0.5);
    S = { g, d, rep, nrep, gate, xeq: Math.sqrt(lo * hi), rho: WR.resistivity(s.metal, wc, hc), wc, hc };
    show({ rho: S.rho.toFixed(1) + ` <small>${(S.rho / WR.METALS[s.metal].rho0).toFixed(1)}× bulk</small>`, r: g.r < 10 ? g.r.toFixed(2) : g.r.toFixed(0), c: (g.c * 1e15).toFixed(3),
      d: d < 1e-9 ? (d * 1e12).toFixed(1) : (d * 1e9).toFixed(2) + ' n', rep: (rep * 1e12 < 1000 ? (rep * 1e12).toFixed(1) : (rep * 1e9).toFixed(2) + ' n') + ` <small>${nrep} repeater${nrep > 1 ? 's' : ''}</small>`, x: S.xeq.toFixed(S.xeq < 10 ? 1 : 0) });
    // restart the line simulation (time runs so one pulse spans ~3 RC-limited delays)
    sim = WR.lineSim(g.r, g.c, s.L, Rd, Cd, 81); simPeriod = 3 * d; simT = 0; sim.setSource(1);
    grains = []; const D = Math.min(wc, hc);
    for (let i = 0; i < 40; i++) grains.push([Math.random(), Math.random()]);
    grains.D = D;
    drawRho(); drawDelay();
  }

  function paint(dt) {
    if (!S) return;
    cv.resize(); const { ctx, w, h } = cv; ctx.clearRect(0, 0, w, h);
    const s = ctl.state;
    // advance the RC line in slow motion: one period every ~3 s
    const frac = dt * (reduceMotion ? 0.08 : 0.33);
    const dtSim = frac * simPeriod; simT += frac;
    if (simT > 1) { simT = 0; sim.setSource(sim.V[0] > 0.5 ? 0 : 1); }
    if (dtSim > 0) sim.step(dtSim / 4, 4);
    // cross-section (left)
    const box = Math.min(h - 70, 200, w * 0.3), bx = w < 560 ? 18 : 30, by = 44, sc = box / Math.max(S.g.h, s.w) * 0.9;
    const W = s.w * sc, H = S.g.h * sc, x0 = bx + (box - W) / 2, y0 = by + (box - H);
    ctx.fillStyle = 'rgba(181,143,214,.12)'; ctx.fillRect(bx - 10, by - 10, box + 20, box + 20);
    ctx.fillStyle = '#5b5070'; ctx.fillRect(x0, y0, W, H);                            // barrier/liner
    const bw = s.bar * sc; ctx.fillStyle = MCOL[s.metal]; ctx.fillRect(x0 + bw, y0, Math.max(W - 2 * bw, 0), Math.max(H - bw, 0));
    // grain boundaries (Voronoi-ish dots) and bouncing electrons
    ctx.strokeStyle = 'rgba(10,13,17,.45)'; ctx.lineWidth = 1;
    const gD = grains.D * sc;
    for (let y = y0 + gD; y < y0 + H - bw; y += gD) { ctx.beginPath(); ctx.moveTo(x0 + bw, y); ctx.lineTo(x0 + W - bw, y + (Math.sin(y) * 3)); ctx.stroke(); }
    if (electrons.length < 14) electrons.push({ x: Math.random(), y: Math.random(), a: Math.random() * 6.28 });
    for (const e of electrons) {
      e.x += Math.cos(e.a) * dt * 0.6; e.y += Math.sin(e.a) * dt * 0.6;
      if (e.x < 0 || e.x > 1) { e.a = Math.PI - e.a; e.x = clamp(e.x, 0, 1); }
      if (e.y < 0 || e.y > 1) { e.a = -e.a; e.y = clamp(e.y, 0, 1); }
      if (Math.random() < dt * 4 * (WR.METALS[s.metal].lam / Math.max(grains.D, 1)) * 0.2) e.a = Math.random() * 6.28;
      ctx.beginPath(); ctx.arc(x0 + bw + e.x * Math.max(W - 2 * bw, 1), y0 + e.y * Math.max(H - bw, 1), 2.4, 0, 7); ctx.fillStyle = '#5aa2ff'; ctx.fill();
    }
    ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillStyle = '#aab3c0'; ctx.textAlign = 'center';
    ctx.fillText(w < 560 ? `${s.w.toFixed(0)}×${S.g.h.toFixed(0)} nm` : `${s.w.toFixed(0)} × ${S.g.h.toFixed(0)} nm cross-section`, bx + box / 2, by - 18);
    ctx.fillText(w < 560 ? `grains ~${grains.D.toFixed(0)} nm` : `barrier ${s.bar.toFixed(1)} nm · grains ~${grains.D.toFixed(0)} nm`, bx + box / 2, by + box + 26);
    // the wire (right): voltage along it as colour and as a curve
    const lx = bx + box + (w < 560 ? 22 : 40), lw = w - lx - (w < 560 ? 10 : 20), ly = 60, lh = 40;
    if (lw > 120) {
      const V = sim.V, n = V.length;
      for (let i = 0; i < n - 1; i++) { ctx.fillStyle = rgb(ramp(0.12 + 0.8 * clamp(V[i], 0, 1))); ctx.fillRect(lx + lw * i / (n - 1), ly, lw / (n - 1) + 1, lh); }
      ctx.strokeStyle = '#2f3845'; ctx.strokeRect(lx + .5, ly + .5, lw - 1, lh - 1);
      ctx.fillStyle = '#e8ecf1'; ctx.textAlign = 'left'; ctx.fillText('driver →', lx, ly - 10); ctx.textAlign = 'right'; ctx.fillText('→ load', lx + lw, ly - 10);
      ctx.textAlign = 'center'; ctx.fillStyle = '#8a94a3'; ctx.fillText(`${s.L >= 1000 ? (s.L / 1000).toFixed(2) + ' mm' : s.L.toFixed(0) + ' µm'} of wire${w < 560 ? ', slowed' : ', slowed so one transition takes ~3 s'}`, lx + lw / 2, ly + lh + 16);
      const py = ly + lh + 34, ph = h - py - 30;
      ctx.strokeStyle = '#232a34'; ctx.strokeRect(lx + .5, py + .5, lw - 1, ph - 1);
      ctx.beginPath(); for (let i = 0; i < n; i++) { const X = lx + lw * i / (n - 1), Y = py + ph - 4 - clamp(V[i], 0, 1) * (ph - 8); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
      ctx.strokeStyle = '#5aa2ff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.setLineDash([3, 4]); ctx.strokeStyle = '#f2b84b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx, py + ph / 2); ctx.lineTo(lx + lw, py + ph / 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#aab3c0'; ctx.textAlign = 'left'; ctx.fillText(w < 560 ? 'V(x) along the wire' : 'V(x): the edge diffuses rather than travels — delay grows as length²', lx + 8, py + 14);
    }
  }
  loop(anim, dt => paint(dt));

  function drawRho() {
    const f = frame(rhoHost, { w: fw(rhoHost), h: 290, m: { t: 14, r: 16, b: 40, l: 58 } }), s = ctl.state;
    const xs = log(6, 200, f.x0, f.x1), ys = log(0.1, 1e4, f.y0, f.y1);
    axes(f, xs, ys, { xt: [6, 10, 20, 50, 100, 200], yt: [0.1, 1, 10, 100, 1e3, 1e4], xl: 'line width (nm), aspect ratio as set', yl: 'resistance (Ω/µm)', xf: String, yf: v => sci(v, 1) });
    const ws = Array.from({ length: 60 }, (_, i) => 6 * (200 / 6) ** (i / 59));
    for (const m of Object.keys(WR.METALS)) {
      const pts = ws.map(w => [xs(w), ys(clamp(WR.rPerUm(m, w, w * s.ar, m === s.metal ? s.bar : null), 0.1, 1e4))]);
      el('path', { d: path(pts), fill: 'none', stroke: MCOL[m], 'stroke-width': m === s.metal ? 2.8 : 1.6, opacity: m === s.metal ? 1 : 0.7 }, f.svg);
      txt(f.svg, pts[pts.length - 1][0] - 2, pts[pts.length - 1][1] + ({ Cu: 14, Co: -18, Ru: -5, W: 14 })[m], m, { 'text-anchor': 'end', fill: MCOL[m] });
    }
    el('circle', { cx: xs(s.w), cy: ys(clamp(S.g.r, 0.1, 1e4)), r: 5.5, fill: '#f2b84b', stroke: C.surface, 'stroke-width': 1.5 }, f.svg);
    hover(f, rhoHost, xs, w => tipRows(`width ${w.toFixed(1)} nm`, Object.keys(WR.METALS).map(m => [m, WR.rPerUm(m, w, w * s.ar).toFixed(0) + ' Ω/µm'])));
  }

  function drawDelay() {
    const f = frame(delHost, { w: fw(delHost), h: 290, m: { t: 14, r: 16, b: 40, l: 58 } }), s = ctl.state, g = S.g;
    const xs = log(1, 5000, f.x0, f.x1), ys = log(0.1, 1e5, f.y0, f.y1);
    axes(f, xs, ys, { xt: [1, 10, 100, 1000, 5000], yt: [0.1, 1, 10, 100, 1e3, 1e4, 1e5], xl: 'wire length (µm)', yl: 'delay (ps)', xf: v => v >= 1000 ? v / 1000 + ' mm' : String(v), yf: v => sci(v, 1) });
    const Ls = Array.from({ length: 60 }, (_, i) => 5000 ** (i / 59));
    const Rd = R0 / s.drv, Cd = C0 * s.drv;
    el('path', { d: path(Ls.map(L => [xs(L), ys(clamp(WR.elmoreDelay(g.r, g.c, L, Rd, Cd) * 1e12, 0.1, 1e5))])), fill: 'none', stroke: C.s2, 'stroke-width': 2.4 }, f.svg);
    el('path', { d: path(Ls.map(L => [xs(L), ys(clamp(WR.repeatedDelay(g.r, g.c, L, R0 * 0.25, C0 * 4)[0] * 1e12, 0.1, 1e5))])), fill: 'none', stroke: C.s3, 'stroke-width': 2 }, f.svg);
    el('line', { x1: f.x0, x2: f.x1, y1: ys(S.gate * 1e12), y2: ys(S.gate * 1e12), stroke: '#f2b84b', 'stroke-dasharray': '5 4' }, f.svg);
    txt(f.svg, f.x0 + 6, ys(S.gate * 1e12) - 6, `one gate delay (${(S.gate * 1e12).toFixed(1)} ps)`, { fill: '#ffd27a' });
    txt(f.svg, xs(1500), ys(clamp(WR.elmoreDelay(g.r, g.c, 1500, Rd, Cd) * 1e12, 0.1, 1e5)) - 8, 'no repeaters (∝ L²)', { 'text-anchor': 'end', fill: '#ff9c73' });
    txt(f.svg, xs(4000), ys(clamp(WR.repeatedDelay(g.r, g.c, 4000, R0 * 0.25, C0 * 4)[0] * 1e12, 0.1, 1e5)) + 16, 'with repeaters (∝ L)', { 'text-anchor': 'end', fill: '#7fd3d0' });
    el('line', { x1: xs(s.L), x2: xs(s.L), y1: f.y0, y2: f.y1, stroke: C.ink2, 'stroke-dasharray': '3 4' }, f.svg);
    hover(f, delHost, xs, L => tipRows(`L = ${L < 1000 ? L.toFixed(0) + ' µm' : (L / 1000).toFixed(2) + ' mm'}`, [['no repeaters', (WR.elmoreDelay(g.r, g.c, L, Rd, Cd) * 1e12).toFixed(1) + ' ps'], ['repeated', (WR.repeatedDelay(g.r, g.c, L, R0 * 0.25, C0 * 4)[0] * 1e12).toFixed(1) + ' ps']]));
  }

  experiments(sec.querySelector('.lab-exp'), [
    { label: 'A 1990s wire: 500 nm copper', run: api => api.animate({ w: 200, ar: 1.8, L: 1000 }, 900), note: 'Wide lines sit close to bulk resistivity and a millimetre of wire costs tens of picoseconds: in the 1990s the gates were the slow part.' },
    { label: 'Today: 12 nm copper with its barrier', run: api => { api.set('metal', 'Cu'); api.animate({ w: 12, ar: 2, L: 100 }, 900); }, note: 'Two effects stack up: electrons scatter off surfaces and grain boundaries once the line is narrower than copper\'s 40 nm mean free path, and the 2 nm barrier eats a third of the cross-section. Resistance per micrometre rises roughly a hundredfold, and 100 µm of local wire is now slower than a gate.' },
    { label: 'Swap in ruthenium', run: api => { api.set('metal', 'Ru'); api.animate({ w: 12 }, 600); }, note: 'Ruthenium is four times worse than copper in bulk, but its 6.6 nm mean free path and lack of a barrier make it competitive below about 15–20 nm: the reason Ru, Co and W are entering the lowest metal layers.' },
    { label: 'Break a long wire with repeaters', run: api => api.animate({ L: 3000, w: 40 }, 900), note: 'An unbuffered wire\'s delay grows as length squared because both resistance and capacitance grow with length. Inserting inverters every so often restarts the edge and turns the dependence linear; a modern chip contains millions of repeaters for exactly this reason.' },
  ], ctl);

  compute();
  onWidth([rhoHost, delHost], () => { drawRho(); drawDelay(); });
}
