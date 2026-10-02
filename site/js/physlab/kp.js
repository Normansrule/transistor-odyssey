// Lab — Band structure: the Kronig–Penney crystal.
import * as B from '../physics/bandstructure.js';
import { panel, tiles, experiments, fix, frame, linear, niceTicks, path, el, C, hover, tipRows, txt, clamp, fw, onWidth } from './ui.js';

const BAND_COL = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9'];

export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'V0', label: 'Barrier height V<sub>0</sub>', min: 0, max: 5, step: 0.01, value: 2.0, fmt: v => v.toFixed(2) + ' eV' },
    { key: 'a', label: 'Well width a', min: 0.1, max: 1.5, step: 0.01, value: 0.5, fmt: v => v.toFixed(2) + ' nm' },
    { key: 'b', label: 'Barrier width b', min: 0.02, max: 0.8, step: 0.01, value: 0.2, fmt: v => v.toFixed(2) + ' nm' },
    { key: 'm', label: 'Electron mass m/m₀', min: 0.1, max: 1.0, step: 0.01, value: 1.0, fmt: v => v.toFixed(2) },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'd', label: 'Lattice period d', unit: 'nm' }, { key: 'g1', label: 'First band gap', unit: 'eV' },
    { key: 'g2', label: 'Second band gap', unit: 'eV' }, { key: 'w1', label: 'Width of band 1', unit: 'eV' },
    { key: 'ms', label: 'Effective mass m*/m', unit: 'band-1 bottom' }, { key: 'nfe', label: 'Weak-potential estimate 2|V₁|', unit: 'eV' },
  ]);
  const bandHost = sec.querySelector('[data-role=kp]'), fHost = sec.querySelector('[data-role=kpf]');
  let S;

  function compute() {
    const { V0, a, b, m } = ctl.state;
    const d = a + b, Ezb = B.freeZoneEnergy(d, m);
    const Emax = Math.max(V0 * 1.5, Ezb * 6.5);
    const r = B.bands(V0, a, b, m, Emax, 2400);
    const edges = r.edges.slice(0, 6);
    const gaps = edges.slice(0, -1).map((e, i) => [e[1], edges[i + 1][0]]);
    const [ms] = V0 > 0 ? B.effectiveMass(V0, a, b, m) : [1];
    S = { ...r, edges, gaps, Emax, Ezb, d, ms };
    show({ d: d.toFixed(2), g1: gaps[0] ? fix(gaps[0][1] - gaps[0][0], 3) : '—', g2: gaps[1] ? fix(gaps[1][1] - gaps[1][0], 3) : '—',
      w1: edges[0] ? fix(edges[0][1] - edges[0][0], 3) : '—', ms: ms.toFixed(3), nfe: fix(B.nfeFirstGap(V0, a, b), 3) });
    draw(); drawF();
  }

  function draw() {
    const { V0, a, b, m } = ctl.state;
    const f = frame(bandHost, { w: fw(bandHost), h: 380, m: { t: 16, r: 16, b: 40, l: 52 } });
    const split = f.x0 + (f.x1 - f.x0) * 0.52, gapPx = 34;
    const ys = linear(0, S.Emax, f.y0, f.y1);
    // left: crystal potential with allowed bands
    const P = 4, d = S.d, xs = linear(0, P * d, f.x0, split - gapPx / 2);
    S.edges.forEach((e, i) => el('rect', { x: f.x0, width: split - gapPx / 2 - f.x0, y: ys(e[1]), height: Math.max(ys(e[0]) - ys(e[1]), 1), fill: BAND_COL[i % 6], opacity: 0.22 }, f.svg));
    S.gaps.forEach(([lo, hi]) => { if (hi - lo > S.Emax * 0.02) txt(f.svg, f.x0 + 6, ys((lo + hi) / 2) + 4, `gap ${(hi - lo).toFixed(2)} eV`, { fill: C.muted }); });
    let dpath = `M${xs(0)} ${ys(0)}`;
    for (let k = 0; k < P; k++) { const x0 = k * d; dpath += `L${xs(x0 + a)} ${ys(0)}L${xs(x0 + a)} ${ys(Math.min(V0, S.Emax))}L${xs(x0 + d)} ${ys(Math.min(V0, S.Emax))}L${xs(x0 + d)} ${ys(0)}`; }
    el('path', { d: dpath, fill: 'none', stroke: '#aab3c0', 'stroke-width': 1.8 }, f.svg);
    const g = el('g', { class: 'axis' }, f.svg);
    for (const t of niceTicks(0, S.Emax, 6)) { el('line', { x1: f.x0, x2: f.x1, y1: ys(t), y2: ys(t), class: 'gridline' }, g); txt(f.svg, f.x0 - 7, ys(t) + 4, String(+t.toFixed(2)), { 'text-anchor': 'end', fill: C.muted }); }
    txt(f.svg, 12, (f.y0 + f.y1) / 2, 'energy (eV)', { transform: `rotate(-90 12 ${(f.y0 + f.y1) / 2})`, 'text-anchor': 'middle', fill: C.ink2 });
    txt(f.svg, (f.x0 + split) / 2, f.h - 6, `position: ${P} unit cells`, { 'text-anchor': 'middle', fill: C.ink2 });
    // right: E(k) in the reduced zone, with the free-electron parabola folded in
    const kx = linear(0, 1, split + gapPx / 2, f.x1);
    const Ezb = S.Ezb, free = [];
    for (let zone = 0; zone < 10; zone++) {
      const pts = [];
      for (let t = 0; t <= 40; t++) { const q = zone + t / 40, E = Ezb * q * q; if (E > S.Emax) break; const k = zone % 2 === 0 ? q - zone : zone + 1 - q; pts.push([kx(k), ys(E)]); }
      if (pts.length > 1) free.push(path(pts));
    }
    free.forEach(dd => el('path', { d: dd, fill: 'none', stroke: C.muted, 'stroke-dasharray': '3 4', 'stroke-width': 1 }, f.svg));
    S.edges.forEach((e, bi) => {
      const pts = [];
      for (let t = 0; t <= 80; t++) { const E = e[0] + (e[1] - e[0]) * t / 80, v = B.rhs(E, V0, a, b, m); pts.push([kx(Math.acos(clamp(v, -1, 1)) / Math.PI), ys(E)]); }
      el('path', { d: path(pts), fill: 'none', stroke: BAND_COL[bi % 6], 'stroke-width': 2.4 }, f.svg);
    });
    el('line', { x1: kx(0), x2: kx(0), y1: f.y1, y2: f.y0, stroke: C.axis }, f.svg);
    el('line', { x1: kx(1), x2: kx(1), y1: f.y1, y2: f.y0, stroke: C.axis }, f.svg);
    txt(f.svg, kx(0), f.y0 + 16, 'Γ (k = 0)', { 'text-anchor': 'middle', fill: C.muted });
    txt(f.svg, kx(1), f.y0 + 16, 'π/d', { 'text-anchor': 'middle', fill: C.muted });
    txt(f.svg, (kx(0) + kx(1)) / 2, f.h - 6, 'wavevector k (reduced zone)', { 'text-anchor': 'middle', fill: C.ink2 });
    txt(f.svg, f.x1 - 4, f.y1 + 12, '- - free electron', { 'text-anchor': 'end', fill: C.muted });
  }

  function drawF() {
    const { V0, a, b, m } = ctl.state;
    const f = frame(fHost, { w: fw(fHost), h: 240, m: { t: 12, r: 16, b: 40, l: 52 } });
    const xs = linear(0, S.Emax, f.x0, f.x1), ys = linear(-4, 4, f.y0, f.y1);
    el('rect', { x: f.x0, width: f.x1 - f.x0, y: ys(1), height: ys(-1) - ys(1), fill: 'rgba(25,158,112,.12)' }, f.svg);
    const g = el('g', { class: 'axis' }, f.svg);
    for (const t of [-4, -2, -1, 0, 1, 2, 4]) { el('line', { x1: f.x0, x2: f.x1, y1: ys(t), y2: ys(t), class: 'gridline' }, g); txt(f.svg, f.x0 - 7, ys(t) + 4, String(t), { 'text-anchor': 'end', fill: C.muted }); }
    for (const t of niceTicks(0, S.Emax, 6)) txt(f.svg, xs(t), f.y0 + 16, String(+t.toFixed(2)), { 'text-anchor': 'middle', fill: C.muted });
    txt(f.svg, (f.x0 + f.x1) / 2, f.h - 4, 'energy E (eV)', { 'text-anchor': 'middle', fill: C.ink2 });
    const pts = []; for (let i = 0; i < S.E.length; i += 3) pts.push([xs(S.E[i]), ys(clamp(S.f[i], -4.2, 4.2))]);
    el('path', { d: path(pts), fill: 'none', stroke: C.s1, 'stroke-width': 2 }, f.svg);
    txt(f.svg, f.x1 - 4, ys(1) - 6, 'allowed: −1 ≤ f(E) ≤ 1', { 'text-anchor': 'end', fill: '#35c28f' });
    hover(f, fHost, xs, E => tipRows(`E = ${E.toFixed(3)} eV`, [['f(E)', B.rhs(E, V0, a, b, m).toFixed(3)], ['state', Math.abs(B.rhs(E, V0, a, b, m)) <= 1 ? 'allowed band' : 'band gap']]));
  }

  experiments(sec.querySelector('.lab-exp'), [
    { label: 'Switch the crystal off (V₀ → 0)', set: { V0: 0, a: 0.5, b: 0.2, m: 1 }, note: 'With no potential the solid lines lie exactly on the folded free-electron parabola: no gaps, effective mass equal to the free mass. Every band gap in every semiconductor comes from the periodic potential.' },
    { label: 'A weak crystal: gaps open at the zone edge', set: { V0: 0.3, a: 0.5, b: 0.2, m: 1 }, note: 'Gaps appear exactly at k = π/d, where an electron wave is Bragg-reflected by the lattice. Their size is close to 2|V₁|, twice the first Fourier coefficient of the potential — the nearly-free-electron picture of metals and of silicon\'s upper bands.' },
    { label: 'Strong barriers: bands flatten into atomic levels', set: { V0: 5, b: 0.6 }, note: 'Electrons now tunnel only weakly between wells, so each band shrinks toward the energy of an isolated well and the band bottom becomes heavy (large m*). This tight-binding limit is how chemists describe covalent crystals like diamond.' },
    { label: 'Shrink the period', set: { V0: 2, a: 0.25, b: 0.1 }, note: 'Shorter periods push the zone boundary π/d outward in k, so bands spread to higher energies and gaps widen. Real lattice constants (Si 0.543 nm, diamond 0.357 nm) set the scale of real band gaps.' },
  ], ctl);

  ctl.on(() => compute());
  compute();
  onWidth([bandHost, fHost], () => { draw(); drawF(); });
}
