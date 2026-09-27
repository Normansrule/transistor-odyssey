// Lab 2 — pn junction: depletion region, field, band bending and the diode law.
import * as J from '../physics/junction.js';
import { bandGap, K_B } from '../physics/carriers.js';
import { panel, tiles, experiments, hiCanvas, loop, sci, fix, frame, axes, linear, log, niceTicks, fmtPow, path, el, C, hover, tipRows, txt, clamp, lerp, fw, onWidth } from './ui.js';

const AREA = 1e-4; // cm² (100 µm × 100 µm)

export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'Na', label: 'Acceptors N<sub>A</sub> (p side)', min: 1e14, max: 1e19, log: true, value: 1e16, fmt: v => sci(v) + ' cm⁻³' },
    { key: 'Nd', label: 'Donors N<sub>D</sub> (n side)', min: 1e14, max: 1e19, log: true, value: 5e16, fmt: v => sci(v) + ' cm⁻³' },
    { key: 'V', label: 'Applied bias V', min: -5, max: 0.75, step: 0.005, value: 0, fmt: v => (v >= 0 ? '+' : '') + v.toFixed(2) + ' V' },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'vbi', label: 'Built-in V<sub>bi</sub>', unit: 'V' }, { key: 'W', label: 'Depletion width W', unit: 'µm' },
    { key: 'x', label: 'x<sub>p</sub> : x<sub>n</sub>', unit: 'µm' }, { key: 'E', label: 'Peak field', unit: 'kV/cm' },
    { key: 'I', label: 'Current, 100 × 100 µm', unit: '' }, { key: 'ideal', label: 'Bias regime', unit: '' },
  ]);
  const warn = sec.querySelector('.pl-warn');
  let S;

  // Device canvas: ions fixed in the depletion region, mobile carriers outside it.
  const dev = sec.querySelector('[data-role=device]'), cv = hiCanvas(dev.querySelector('canvas'));
  const R = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const ions = Array.from({ length: 900 }, () => ({ u: R(), v: R() }));
  const car = Array.from({ length: 160 }, (_, i) => ({ side: i < 80 ? -1 : 1, x: R(), y: R(), vx: 0, vy: 0, cross: 0 }));
  let span = 1, xpD = 0, xnD = 0;

  function compute() {
    const { Na, Nd, V } = ctl.state;
    const s = J.solve(Na, Nd, V);
    const I = J.diodeCurrent(V, Na, Nd, 300, 1, AREA);
    const lighter = Math.min(Na, Nd);
    const Ecrit = 4.0e5 / (1 - (1 / 3) * Math.log10(lighter / 1e16)); // Sze & Ng empirical, Si
    S = { ...s, I, Na, Nd, V, Ecrit };
    span = 1.35 * Math.max(J.solve(Na, Nd, -5).W_um, s.W_um); // µm shown across the device (fixed per doping)
    const reg = V > 0.05 ? 'forward' : V < -0.05 ? 'reverse' : 'zero bias';
    show({ vbi: fix(s.Vbi, 3), W: (s.W_um).toPrecision(3), x: `${s.xp_um.toPrecision(2)} : ${s.xn_um.toPrecision(2)}`, E: s.Emax >= 1e6 ? sci(s.Emax / 1e3, 3) : (s.Emax / 1e3).toPrecision(3),
      I: (Math.abs(I) < 1e-12 ? sci(I, 2) : sci(I, 3)) + ' A', ideal: reg });
    warn.hidden = !(s.Emax > Ecrit);
    warn.innerHTML = s.Emax > Ecrit ? (Math.max(Na, Nd) > 3e18 && Math.min(Na, Nd) > 3e18 ? 'Peak field exceeds ~' + sci(Ecrit, 2) + ' V/cm with both sides heavily doped: <b>Zener (band-to-band) tunnelling</b> breakdown — the idea behind Esaki\'s tunnel diode and today\'s TFETs.' : 'Peak field exceeds the ~' + sci(Ecrit, 2) + ' V/cm critical field: <b>avalanche breakdown</b> would set in. The ideal-diode current shown here ignores it.') : '';
    drawPlots();
  }

  function drawDevice(dt) {
    cv.resize(); const { ctx, w, h } = cv; if (!S) return;
    ctx.clearRect(0, 0, w, h);
    const mid = w / 2, pxPerUm = (w - 40) / span, top = 34, bot = h - 16, H = bot - top;
    xpD = lerp(xpD, S.xp_um * pxPerUm, Math.min(dt * 8, 1)); xnD = lerp(xnD, S.xn_um * pxPerUm, Math.min(dt * 8, 1));
    // regions
    ctx.fillStyle = 'rgba(217,89,38,.10)'; ctx.fillRect(20, top, mid - 20, H);
    ctx.fillStyle = 'rgba(57,135,229,.10)'; ctx.fillRect(mid, top, w - 20 - mid, H);
    ctx.fillStyle = 'rgba(16,20,26,.85)'; ctx.fillRect(mid - xpD, top, xpD + xnD, H);
    ctx.strokeStyle = '#2f3845'; ctx.strokeRect(20.5, top + .5, w - 41, H - 1);
    ctx.setLineDash([4, 4]); ctx.strokeStyle = '#8a94a3';
    for (const X of [mid - xpD, mid + xnD]) { ctx.beginPath(); ctx.moveTo(X, top); ctx.lineTo(X, bot); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.font = '12px "IBM Plex Mono", monospace'; ctx.fillStyle = '#ff9c73'; ctx.textAlign = 'left'; ctx.fillText('p-type', 26, 22);
    ctx.fillStyle = '#86b6ef'; ctx.textAlign = 'right'; ctx.fillText('n-type', w - 26, 22);
    ctx.fillStyle = '#aab3c0'; ctx.textAlign = 'center'; ctx.fillText(`depletion W = ${S.W_um.toPrecision(3)} µm`, mid, 22);
    // ions (density ∝ doping, capped)
    const dens = N => clamp(0.35 + 0.1 * Math.log10(N / 1e14), 0.35, 0.95);
    ions.forEach((o, i) => {
      const left = i % 2 === 0;
      if (o.v > (left ? dens(S.Na) : dens(S.Nd))) return;
      const X = left ? mid - o.u * xpD : mid + o.u * xnD, Y = top + 6 + ((i * 0.618) % 1) * (H - 12);
      if (left && o.u * xpD < 2 || !left && o.u * xnD < 2) return;
      ctx.fillStyle = left ? 'rgba(255,156,115,.85)' : 'rgba(134,182,239,.85)';
      ctx.font = '10px "IBM Plex Mono", monospace'; ctx.fillText(left ? '−' : '+', X, Y + 3);
    });
    // mobile carriers: holes on p side, electrons on n side; forward bias lets some cross
    const inj = S.V > 0 ? clamp(Math.log10(Math.max(S.I, 1e-20) / 1e-9) / 6, 0, 1) : 0;
    const Lp = 20, Rn = w - 20;
    for (const c of car) {
      c.vx += (R() - .5) * 60 * dt; c.vy += (R() - .5) * 60 * dt; c.vx *= 0.96; c.vy *= 0.96;
      let X = c.side < 0 ? Lp + c.x * (w - 40) : Lp + c.x * (w - 40), Y = top + 6 + c.y * (H - 12);
      X += c.vx * dt * 30; Y += c.vy * dt * 30;
      const edgeL = mid - xpD, edgeR = mid + xnD;
      if (c.side < 0) { // hole
        if (c.cross > 0) { X += 90 * dt; c.cross -= dt; if (X > Rn - 4) { c.cross = 0; X = Lp + 4 + R() * 30; } }
        else if (X > edgeL - 3) { if (R() < inj * 0.08) c.cross = 3; else { X = edgeL - 3; c.vx = -Math.abs(c.vx); } }
        if (X < Lp + 3) { X = Lp + 3; c.vx = Math.abs(c.vx); }
      } else {
        if (c.cross > 0) { X -= 90 * dt; c.cross -= dt; if (X < Lp + 4) { c.cross = 0; X = Rn - 4 - R() * 30; } }
        else if (X < edgeR + 3) { if (R() < inj * 0.08) c.cross = 3; else { X = edgeR + 3; c.vx = Math.abs(c.vx); } }
        if (X > Rn - 3) { X = Rn - 3; c.vx = -Math.abs(c.vx); }
      }
      Y = clamp(Y, top + 5, bot - 5);
      c.x = (X - Lp) / (w - 40); c.y = (Y - top - 6) / (H - 12);
      ctx.beginPath(); ctx.arc(X, Y, 3.4, 0, Math.PI * 2);
      if (c.side < 0) { ctx.strokeStyle = '#ff8a55'; ctx.lineWidth = 1.6; ctx.stroke(); }
      else { ctx.fillStyle = '#5aa2ff'; ctx.fill(); }
    }
    // field arrow
    ctx.strokeStyle = '#f2b84b'; ctx.fillStyle = '#f2b84b'; ctx.lineWidth = 1.5;
    const ay = bot - 10, a0 = mid + Math.min(xnD, 40) * 0.8, a1 = mid - Math.min(xpD, 40) * 0.8;
    if (xpD + xnD > 24) { ctx.beginPath(); ctx.moveTo(a0, ay); ctx.lineTo(a1, ay); ctx.stroke(); ctx.beginPath(); ctx.moveTo(a1, ay); ctx.lineTo(a1 + 6, ay - 4); ctx.lineTo(a1 + 6, ay + 4); ctx.fill(); }
  }

  // Charge, field and band diagram stacked on one x axis + I–V
  const stack = sec.querySelector('[data-role=stack]'), ivHost = sec.querySelector('[data-role=iv]');
  function drawPlots() {
    const xmin = -span / 2, xmax = span / 2;
    const xsU = Array.from({ length: 401 }, (_, i) => xmin + (xmax - xmin) * i / 400); // µm
    const f = frame(stack, { w: fw(stack), h: 430, m: { t: 10, r: 16, b: 38, l: 60 } });
    const xs = linear(xmin, xmax, f.x0, f.x1);
    const bandsH = 150, gap = 16, ph = (f.y0 - f.y1 - bandsH - 2 * gap) / 2;
    const rows = [
      { y0: f.y1 + ph, y1: f.y1, name: 'charge ρ/q', data: xsU.map(x => S.rho(x * 1e-4) / J.Q) },
      { y0: f.y1 + 2 * ph + gap, y1: f.y1 + ph + gap, name: '|E| (kV/cm)', data: xsU.map(x => -S.field(x * 1e-4) / 1e3) },
    ];
    const g = el('g', { class: 'axis' }, f.svg);
    for (const [k, rw] of rows.entries()) {
      const mx = Math.max(...rw.data.map(Math.abs)) || 1;
      const lo = k === 0 ? -mx * 1.15 : 0, hi = mx * 1.15;
      const ys = linear(lo, hi, rw.y0, rw.y1);
      el('line', { x1: f.x0, x2: f.x1, y1: ys(0), y2: ys(0), stroke: C.axis }, g);
      if (k === 0) {
        el('path', { d: path(xsU.map((x, i) => [xs(x), ys(Math.min(rw.data[i], 0))])) + `L${f.x1} ${ys(0)}L${f.x0} ${ys(0)}Z`, fill: 'rgba(217,89,38,.35)', stroke: 'none' }, f.svg);
        el('path', { d: path(xsU.map((x, i) => [xs(x), ys(Math.max(rw.data[i], 0))])) + `L${f.x1} ${ys(0)}L${f.x0} ${ys(0)}Z`, fill: 'rgba(57,135,229,.35)', stroke: 'none' }, f.svg);
        txt(f.svg, f.x0 + 4, rw.y1 + 12, `−qN_A`, { fill: '#ff9c73' }); txt(f.svg, f.x1 - 4, rw.y1 + 12, '+qN_D', { fill: '#86b6ef', 'text-anchor': 'end' });
      } else {
        el('path', { d: path(xsU.map((x, i) => [xs(x), ys(rw.data[i])])) + `L${f.x1} ${ys(0)}L${f.x0} ${ys(0)}Z`, fill: 'rgba(242,184,75,.18)', stroke: '#f2b84b', 'stroke-width': 1.8 }, f.svg);
        txt(f.svg, xs(0) + 6, ys(mx) + 4, `${mx >= 1000 ? sci(mx * 1e3, 3) + ' V/cm' : mx.toPrecision(3) + ' kV/cm'}`, { fill: '#f2b84b' });
      }
      txt(f.svg, 10, (rw.y0 + rw.y1) / 2, rw.name, { transform: `rotate(-90 10 ${(rw.y0 + rw.y1) / 2})`, 'text-anchor': 'middle', fill: C.ink2 });
    }
    // band diagram: Ec, Ev, quasi-Fermi levels
    const Eg = bandGap('Si'), kT = K_B * 300, ni = S.ni;
    const EcP = Eg / 2 + kT * Math.log(S.Na / ni); // Ec above EFp on p side
    const Ec = x => EcP - S.psi(x * 1e-4);
    const yb0 = f.y0, yb1 = f.y0 - bandsH;
    const lo = Math.min(Ec(xmax) - Eg - 0.15, -Eg), hi = EcP + 0.15;
    const ys = linear(lo, hi, yb0, yb1);
    const bandPath = off => path(xsU.map(x => [xs(x), ys(Ec(x) - off)]));
    el('path', { d: bandPath(0), fill: 'none', stroke: C.s1, 'stroke-width': 2 }, f.svg);
    el('path', { d: bandPath(Eg), fill: 'none', stroke: C.s2, 'stroke-width': 2 }, f.svg);
    const EFp = 0, EFn = S.V; // forward bias raises the n-side electron energy by qV
    el('line', { x1: f.x0, x2: xs(S.xn_um), y1: ys(EFp), y2: ys(EFp), stroke: '#f2b84b', 'stroke-dasharray': '6 4', 'stroke-width': 1.4 }, f.svg);
    el('line', { x1: xs(-S.xp_um), x2: f.x1, y1: ys(EFn), y2: ys(EFn), stroke: '#ffd27a', 'stroke-dasharray': '2 3', 'stroke-width': 1.4 }, f.svg);
    txt(f.svg, f.x0 + 4, ys(Ec(xmin)) - 6, 'Ec', { fill: '#86b6ef' }); txt(f.svg, f.x0 + 4, ys(Ec(xmin) - Eg) + 14, 'Ev', { fill: '#ff9c73' });
    txt(f.svg, f.x0 + 4, ys(EFp) - 5, Math.abs(S.V) < 0.005 ? 'EF (flat)' : 'EFp', { fill: '#f2b84b' });
    if (Math.abs(S.V) >= 0.005) txt(f.svg, f.x1 - 4, ys(EFn) + (S.V > 0 ? 13 : -5), `EFn  (qV = ${S.V.toFixed(2)} eV)`, { fill: '#ffd27a', 'text-anchor': 'end' });
    txt(f.svg, 10, (yb0 + yb1) / 2, 'energy (eV)', { transform: `rotate(-90 10 ${(yb0 + yb1) / 2})`, 'text-anchor': 'middle', fill: C.ink2 });
    const tk = niceTicks(xmin, xmax, 6);
    for (const t of tk) { el('line', { x1: xs(t), x2: xs(t), y1: f.y0, y2: f.y0 + 5, stroke: C.axis }, g); txt(f.svg, xs(t), f.y0 + 18, String(+t.toFixed(3)), { 'text-anchor': 'middle', fill: C.muted }); }
    txt(f.svg, (f.x0 + f.x1) / 2, f.h - 4, 'position (µm) — metallurgical junction at 0', { 'text-anchor': 'middle', fill: C.ink2 });
    for (const X of [-S.xp_um, S.xn_um]) el('line', { x1: xs(X), x2: xs(X), y1: f.y1, y2: f.y0, stroke: C.muted, 'stroke-dasharray': '2 4', opacity: .6 }, f.svg);
    hover(f, stack, xs, x => tipRows(`x = ${x.toFixed(3)} µm`, [['ρ/q', sci(S.rho(x * 1e-4) / J.Q) + ' cm⁻³'], ['|E|', (Math.abs(S.field(x * 1e-4)) / 1e3).toPrecision(3) + ' kV/cm'], ['ψ', S.psi(x * 1e-4).toFixed(3) + ' V']]));

    // I–V
    const g2 = frame(ivHost, { w: fw(ivHost), h: 260, m: { t: 12, r: 16, b: 40, l: 58 } });
    const xv = linear(-1, 0.8, g2.x0, g2.x1), yv = log(1e-16, 1e-1, g2.y0, g2.y1);
    axes(g2, xv, yv, { xt: niceTicks(-1, 0.8, 6), yt: [1e-16, 1e-13, 1e-10, 1e-7, 1e-4, 1e-1], xl: 'bias V (V)', yl: '|I| (A)', yf: fmtPow, xf: v => +v.toFixed(2) });
    const Vs = Array.from({ length: 361 }, (_, i) => -1 + 1.8 * i / 360);
    const I = v => Math.abs(J.diodeCurrent(v, S.Na, S.Nd, 300, 1, AREA));
    el('path', { d: path(Vs.map(v => [xv(v), yv(clamp(I(v), 1e-16, 1e-1))])), fill: 'none', stroke: C.s1, 'stroke-width': 2 }, g2.svg);
    // 60 mV/dec guide
    const I0 = J.saturationCurrent(S.Na, S.Nd) * AREA;
    txt(g2.svg, xv(0.05), yv(clamp(I0 * 1e3, 1e-16, 1e-1)) - 8, 'slope: 10× per 59.5 mV', { fill: C.muted });
    txt(g2.svg, xv(-0.95), yv(clamp(I0, 1e-16, 1e-1)) - 8, 'reverse: saturates at I₀', { fill: C.muted });
    if (S.V >= -1) el('circle', { cx: xv(S.V), cy: yv(clamp(I(S.V), 1e-16, 1e-1)), r: 6, fill: '#f2b84b', stroke: C.surface, 'stroke-width': 2 }, g2.svg);
    hover(g2, ivHost, xv, v => tipRows(`V = ${v.toFixed(3)} V`, [['I', sci(J.diodeCurrent(v, S.Na, S.Nd, 300, 1, AREA), 3) + ' A']]));
  }

  experiments(sec.querySelector('.lab-exp'), [
    { label: 'One-sided junction: p⁺ on lightly doped n', set: { Na: 1e19, Nd: 1e15, V: 0 }, note: 'Charge balance (N<sub>A</sub>x<sub>p</sub> = N<sub>D</sub>x<sub>n</sub>) pushes almost the whole depletion region into the lightly doped side. Power devices use this to hold hundreds of volts across a thick, lightly doped drift layer.' },
    { label: 'Reverse bias to −5 V', set: { V: -5 }, note: 'W grows as √(V<sub>bi</sub> − V), the peak field climbs and the current stays pinned at the tiny saturation current I₀. This is how every drain-to-body junction in a CMOS chip spends its life.' },
    { label: 'Forward bias to +0.60 V', set: { V: 0.6 }, note: 'The barrier drops by qV, the quasi-Fermi levels split by 0.6 eV and carriers flood across (watch the particles). Current rises tenfold every 59.5 mV — the same Boltzmann factor that sets the 60 mV/decade MOSFET limit.' },
    { label: 'Dope both sides to 10¹⁹ cm⁻³', set: { Na: 1e19, Nd: 1e19, V: -1 }, note: 'The depletion region shrinks to about 20 nm and the field passes 10⁶ V/cm: electrons tunnel straight through the gap. Esaki found this in 1958 and won the Nobel Prize for it.' },
  ], ctl);

  ctl.on(() => compute());
  compute();
  onWidth([stack, ivHost], drawPlots);
  loop(dev, dt => drawDevice(dt));
}
