// Lab — Quantum wells: nanosheet confinement and the self-consistent GaN 2DEG.
import * as Q from '../physics/qwell.js';
import { panel, tiles, experiments, sci, fix, frame, axes, linear, log, niceTicks, path, el, C, hover, tipRows, txt, clamp, fw, onWidth } from './ui.js';

const WCOL = ['#3987e5', '#d95926', '#199e70', '#c98500'];

export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'mode', type: 'seg', label: 'Structure', options: [['sheet', 'silicon nanosheet'], ['gan', 'AlGaN/GaN 2DEG']], value: 'sheet' },
    { type: 'heading', label: 'Nanosheet' },
    { key: 't', label: 'Sheet thickness t', min: 1, max: 12, step: 0.1, value: 5, fmt: v => v.toFixed(1) + ' nm' },
    { key: 'V0', label: 'Barrier (oxide) height', min: 0.5, max: 3.5, step: 0.05, value: 3.1, fmt: v => v.toFixed(2) + ' eV' },
    { type: 'heading', label: 'AlGaN/GaN heterostructure' },
    { key: 'x', label: 'Al fraction x', min: 0.1, max: 0.45, step: 0.01, value: 0.25, fmt: v => (v * 100).toFixed(0) + ' %' },
    { key: 'd', label: 'AlGaN barrier thickness', min: 5, max: 40, step: 0.5, value: 20, fmt: v => v.toFixed(1) + ' nm' },
    { key: 'Vg', label: 'Gate voltage V<sub>G</sub>', min: -5, max: 1, step: 0.05, value: 0, fmt: v => (v >= 0 ? '+' : '') + v.toFixed(2) + ' V' },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'a', label: '', unit: '' }, { key: 'b', label: '', unit: '' }, { key: 'c', label: '', unit: '' },
    { key: 'd', label: '', unit: '' }, { key: 'e', label: '', unit: '' }, { key: 'f', label: '', unit: '' },
  ]);
  const tileEls = [...sec.querySelectorAll('.pl-tile')];
  const setLabels = labels => labels.forEach(([l, u], i) => { tileEls[i].querySelector('.l').innerHTML = l; const ue = tileEls[i].querySelector('.u'); if (ue) ue.textContent = u; else tileEls[i].insertAdjacentHTML('beforeend', `<span class="u">${u}</span>`); });
  const main = sec.querySelector('[data-role=qw]'), side = sec.querySelector('[data-role=qw2]');
  let S, sweep = null, sweepKey = '';

  const groups = { sheet: ['t', 'V0'], gan: ['x', 'd', 'Vg'] };
  const heads = [...sec.querySelectorAll('.lab-ctl .pl-subhead')];
  function visibility() {
    const m = ctl.state.mode;
    for (const [g, keys] of Object.entries(groups)) keys.forEach(k => { const w = ctl.inputs[k].inp.closest('.ctl'); w.hidden = g !== m; });
    heads[0].hidden = m !== 'sheet'; heads[1].hidden = m !== 'gan';
  }
  function compute(final) {
    const s = ctl.state;
    visibility();
    if (s.mode === 'sheet') {
      const d2 = Q.finiteWell(s.t, { V0: s.V0, mWell: 0.916, nstates: 3 });
      const d4 = Q.finiteWell(s.t, { V0: s.V0, mWell: 0.19, nstates: 2 });
      S = { mode: 'sheet', d2, d4 };
      setLabels([['Ground state (Δ₂, m = 0.916)', 'eV above bulk Ec'], ['Ground state (Δ₄, m = 0.19)', 'eV'], ['Valley splitting', 'meV'], ['Second level (Δ₂)', 'eV'], ['Infinite-well estimate', 'eV'], ['Threshold shift ≈ E₀/q', 'mV']]);
      show({ a: fix(d2.E[0], 4), b: fix(d4.E[0], 4), c: ((d4.E[0] - d2.E[0]) * 1000).toFixed(1), d: fix(d2.E[1], 4), e: fix(Q.infiniteWellLevel(s.t), 4), f: (d2.E[0] * 1000).toFixed(0) });
    } else {
      const r = Q.hemtSP(s.x, s.d, { Vg: s.Vg });
      const occN = r.E.filter(E => E < 0.1).length;
      let num = 0, den = 0; for (let i = 0; i < r.z.length; i++) { if (i >= r.iface) { num += r.n[i] * (r.z[i] - s.d); den += r.n[i]; } }
      S = { mode: 'gan', r };
      setLabels([['2DEG density n<sub>s</sub>', 'cm⁻²'], ['Ground subband E₀ − E<sub>F</sub>', 'eV'], ['E₁ − E<sub>F</sub>', 'eV'], ['Electron centroid below interface', 'nm'], ['Polarization charge σ/q', 'cm⁻²'], ['Self-consistent iterations', '']]);
      show({ a: sci(r.ns, 3), b: fix(r.E[0], 3), c: fix(r.E[1], 3), d: den > 0 ? (num / den).toFixed(2) : '—', e: sci(r.sigma / 1.602176634e-19 * 1e-4, 3), f: String(r.iters) });
      const key = s.x.toFixed(2);
      if (final && key !== sweepKey) { sweepKey = key; const ds = [4, 6, 8, 10, 13, 16, 20, 25, 30, 35, 40]; sweep = ds.map(d => [d, Q.hemtSP(s.x, d).ns, Q.analyticNs(s.x, d)]); }
    }
    draw(); drawSide();
  }

  function draw() {
    const f = frame(main, { w: fw(main), h: 360, m: { t: 16, r: 16, b: 40, l: 54 } });
    if (S.mode === 'sheet') {
      const { d2, d4 } = S, z = d2.z, zmax = z[z.length - 1], zmin = z[0];
      const Emax = Math.min(ctl.state.V0 * 1.15, Math.max(d2.E[2] * 1.4, 0.3, d4.E[1] * 1.3));
      const xs = linear(zmin, zmax, f.x0, f.x1), ys = linear(-0.05 * Emax, Emax, f.y0, f.y1);
      axes(f, xs, ys, { xt: niceTicks(zmin, zmax, 7), yt: niceTicks(0, Emax, 5), xl: 'position across the sheet (nm)', yl: 'energy above the bulk band edge (eV)', xf: v => +v.toFixed(1), yf: v => +v.toFixed(3) });
      el('path', { d: path(Array.from(z, (v, i) => [xs(v), ys(Math.min(d2.V[i], Emax))])), fill: 'none', stroke: '#aab3c0', 'stroke-width': 2 }, f.svg);
      el('rect', { x: xs(0), y: f.y1, width: xs(ctl.state.t) - xs(0), height: f.y0 - f.y1, fill: 'rgba(57,135,229,.06)' }, f.svg);
      const amp = (f.y0 - f.y1) * 0.07;
      const drawSet = (st, dash, label) => st.E.forEach((E, k) => {
        if (E > Emax) return;
        const psi = st.psi[k]; let mx = 0; for (const v of psi) mx = Math.max(mx, Math.abs(v));
        el('line', { x1: f.x0, x2: f.x1, y1: ys(E), y2: ys(E), stroke: WCOL[k], 'stroke-dasharray': dash ? '2 4' : '6 4', 'stroke-width': 1, opacity: .7 }, f.svg);
        el('path', { d: path(Array.from(z, (v, i) => [xs(v), ys(E) - psi[i] / mx * amp])), fill: 'none', stroke: WCOL[k], 'stroke-width': dash ? 1.4 : 2.2, 'stroke-dasharray': dash ? '4 3' : null }, f.svg);
        if (!dash) txt(f.svg, f.x1 - 4, ys(E) - 5, `${label} n=${k + 1}: ${(E * 1000).toFixed(0)} meV`, { 'text-anchor': 'end', fill: WCOL[k] });
      });
      drawSet(S.d2, false, 'Δ₂'); drawSet(S.d4, true, 'Δ₄');
      txt(f.svg, xs(zmin) + 4, f.y1 + 12, 'SiO₂', { fill: '#b58fd6' }); txt(f.svg, xs(zmax) - 4, f.y1 + 12, 'SiO₂', { fill: '#b58fd6', 'text-anchor': 'end' });
      txt(f.svg, xs(ctl.state.t / 2), f.y1 + 12, 'silicon', { fill: '#86b6ef', 'text-anchor': 'middle' });
    } else {
      const r = S.r, z = r.z, zmax = z[z.length - 1];
      let lo = 0, hi = 0; for (const v of r.Ec) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      lo = Math.min(lo, r.E[0]) - 0.15; hi = hi + 0.2;
      const xs = linear(0, zmax, f.x0, f.x1), ys = linear(lo, hi, f.y0, f.y1);
      axes(f, xs, ys, { xt: niceTicks(0, zmax, 6), yt: niceTicks(lo, hi, 6), xl: 'depth below the gate (nm)', yl: 'energy relative to E_F (eV)', yf: v => +v.toFixed(2) });
      el('rect', { x: f.x0, y: f.y1, width: xs(r.dNm) - f.x0, height: f.y0 - f.y1, fill: 'rgba(127,211,208,.06)' }, f.svg);
      txt(f.svg, (f.x0 + xs(r.dNm)) / 2, f.y1 + 12, `Al${Math.round(r.x * 100)}GaN`, { 'text-anchor': 'middle', fill: '#7fd3d0' });
      txt(f.svg, xs(r.dNm) + 6, f.y1 + 12, 'GaN', { fill: '#86b6ef' });
      // electron density fill (scaled)
      let nmax = 0; for (const v of r.n) nmax = Math.max(nmax, v);
      nmax = Math.max(nmax, 2e19); // fixed floor so an empty channel looks empty
      if (nmax > 0) el('path', { d: `M${xs(0)} ${ys(lo)}` + Array.from(z, (v, i) => `L${xs(v)} ${ys(lo) - r.n[i] / nmax * (f.y0 - f.y1) * 0.35}`).join('') + `L${xs(zmax)} ${ys(lo)}Z`, fill: 'rgba(57,135,229,.25)' }, f.svg);
      el('line', { x1: f.x0, x2: f.x1, y1: ys(0), y2: ys(0), stroke: '#f2b84b', 'stroke-dasharray': '7 5' }, f.svg);
      txt(f.svg, f.x1 - 4, ys(0) - 6, 'E_F', { 'text-anchor': 'end', fill: '#f2b84b' });
      el('path', { d: path(Array.from(z, (v, i) => [xs(v), ys(r.Ec[i])])), fill: 'none', stroke: '#aab3c0', 'stroke-width': 2.2 }, f.svg);
      const amp = (f.y0 - f.y1) * 0.08;
      r.E.forEach((E, k) => {
        if (E > hi) return;
        const psi = r.psi[k]; let mx = 0; for (const v of psi) mx = Math.max(mx, Math.abs(v));
        const x0 = xs(r.dNm - 2), x1 = xs(Math.min(zmax, r.dNm + 25));
        el('line', { x1: x0, x2: x1, y1: ys(E), y2: ys(E), stroke: WCOL[k], 'stroke-dasharray': '6 4', 'stroke-width': 1 }, f.svg);
        el('path', { d: path(Array.from(z, (v, i) => [xs(v), ys(E) - psi[i] / mx * amp]).filter(p => p[0] >= x0 && p[0] <= x1)), fill: 'none', stroke: WCOL[k], 'stroke-width': 2 }, f.svg);
        txt(f.svg, x1 + 4, ys(E) + 4, `E${k} = ${(E * 1000).toFixed(0)} meV`, { fill: WCOL[k] });
      });
      txt(f.svg, f.x0 + 6, ys(lo) - 8, 'shaded: electron density n(z)', { fill: '#86b6ef' });
      hover(f, main, xs, zz => { const i = clamp(Math.round(zz / (z[1] - z[0])), 0, z.length - 1); return tipRows(`z = ${zz.toFixed(1)} nm`, [['E_c − E_F', r.Ec[i].toFixed(3) + ' eV'], ['n', sci(r.n[i], 2) + ' cm⁻³']]); });
    }
  }

  function drawSide() {
    const f = frame(side, { w: fw(side), h: 260, m: { t: 14, r: 16, b: 40, l: 58 } });
    const s = ctl.state;
    if (S.mode === 'sheet') {
      const ts = Array.from({ length: 45 }, (_, i) => 1 + i * 0.25);
      const e2 = ts.map(t => Q.finiteWell(t, { V0: s.V0, mWell: 0.916, nstates: 1, dzNm: 0.04 }).E[0]);
      const e4 = ts.map(t => Q.finiteWell(t, { V0: s.V0, mWell: 0.19, nstates: 1, dzNm: 0.04 }).E[0]);
      const xs = linear(1, 12, f.x0, f.x1), ys = log(1e-3, 3, f.y0, f.y1);
      axes(f, xs, ys, { xt: [2, 4, 6, 8, 10, 12], yt: [1e-3, 1e-2, 0.1, 1], xl: 'sheet thickness t (nm)', yl: 'ground-state energy (eV)', yf: v => String(v) });
      el('path', { d: path(ts.map(t => [xs(t), ys(clamp(Q.infiniteWellLevel(t), 1e-3, 3))])), fill: 'none', stroke: C.muted, 'stroke-dasharray': '4 4' }, f.svg);
      el('path', { d: path(ts.map((t, i) => [xs(t), ys(clamp(e2[i], 1e-3, 3))])), fill: 'none', stroke: C.s1, 'stroke-width': 2 }, f.svg);
      el('path', { d: path(ts.map((t, i) => [xs(t), ys(clamp(e4[i], 1e-3, 3))])), fill: 'none', stroke: C.s1, 'stroke-width': 1.4, 'stroke-dasharray': '5 3' }, f.svg);
      el('circle', { cx: xs(s.t), cy: ys(clamp(S.d2.E[0], 1e-3, 3)), r: 6, fill: '#f2b84b', stroke: C.surface, 'stroke-width': 2 }, f.svg);
      txt(f.svg, f.x1 - 4, f.y1 + 12, '— Δ₂ valleys  - - Δ₄ valleys  ··· infinite well', { 'text-anchor': 'end', fill: C.ink2 });
      el('line', { x1: xs(5), x2: xs(5), y1: f.y1, y2: f.y0, stroke: C.axis, 'stroke-dasharray': '2 4' }, f.svg);
      txt(f.svg, xs(5) + 4, f.y0 - 8, 'nanosheets (~5 nm)', { fill: C.muted });
      hover(f, side, xs, t => tipRows(`t = ${t.toFixed(1)} nm`, [['E₀ (Δ₂)', (Q.finiteWell(t, { V0: s.V0, nstates: 1, dzNm: 0.04 }).E[0] * 1000).toFixed(1) + ' meV']]));
    } else {
      const xs = linear(0, 42, f.x0, f.x1), ys = linear(0, 2.5e13, f.y0, f.y1);
      axes(f, xs, ys, { xt: [0, 10, 20, 30, 40], yt: [0, 5e12, 1e13, 1.5e13, 2e13, 2.5e13], xl: 'AlGaN thickness d (nm)', yl: 'n_s (cm⁻²)', yf: v => sci(v, 1) });
      if (sweep) {
        el('path', { d: path(sweep.map(([d, , a]) => [xs(d), ys(a)])), fill: 'none', stroke: C.muted, 'stroke-dasharray': '4 4', 'stroke-width': 1.5 }, f.svg);
        el('path', { d: path(sweep.map(([d, n]) => [xs(d), ys(n)])), fill: 'none', stroke: C.s1, 'stroke-width': 2 }, f.svg);
        sweep.forEach(([d, n]) => el('circle', { cx: xs(d), cy: ys(n), r: 3, fill: C.s1 }, f.svg));
        txt(f.svg, f.x1 - 4, f.y0 - 24, '— self-consistent (this lab)', { 'text-anchor': 'end', fill: '#86b6ef' });
        txt(f.svg, f.x1 - 4, f.y0 - 10, '- - Ambacher analytic formula', { 'text-anchor': 'end', fill: C.muted });
      } else txt(f.svg, (f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2, 'release a slider to sweep d', { 'text-anchor': 'middle', fill: C.muted });
      el('circle', { cx: xs(s.d), cy: ys(clamp(S.r.ns, 0, 2.5e13)), r: 6, fill: '#f2b84b', stroke: C.surface, 'stroke-width': 2 }, f.svg);
    }
  }

  experiments(sec.querySelector('.lab-exp'), [
    { label: 'Thin a nanosheet from 10 nm to 3 nm', run: api => api.animate({ mode: 'sheet', t: 10, V0: 3.1 }, 400, () => setTimeout(() => api.animate({ t: 3 }, 2200), 250)), note: 'Confinement pushes the lowest level up roughly as 1/t². At the ~5 nm of production nanosheets the shift is ~15 meV; at 3 nm it is ~40 meV and at 2 nm ~90 meV — a threshold-voltage shift designers must budget for, and very sensitive to thickness variation.' },
    { label: 'Compare the two kinds of valley', set: { mode: 'sheet', t: 4 }, note: 'Silicon has six conduction valleys. In a (100) sheet two of them (Δ₂) present their heavy mass across the film and sit lowest; the other four (Δ₄, light mass across) rise faster. Confinement moves electrons into the Δ₂ valleys, which have a light in-plane mass — one reason thin channels keep good mobility.' },
    { label: 'Build a GaN 2DEG', set: { mode: 'gan', x: 0.25, d: 20, Vg: 0 }, note: 'No dopants anywhere: the polarization sheet charge at the AlGaN/GaN interface bends the band below the Fermi level and ~10¹³ electrons/cm² collect in a triangular well a few nanometres wide. Only one or two subbands are occupied — a true two-dimensional electron gas.' },
    { label: 'Pinch the channel off with the gate', run: api => api.animate({ mode: 'gan', Vg: 0 }, 300, () => setTimeout(() => api.animate({ Vg: -4.5 }, 2600), 250)), note: 'A negative gate lifts the whole band; the ground subband crosses E_F and the 2DEG empties. That is how a depletion-mode GaN HEMT switches off, and why making them normally-off (safe for power converters) takes p-GaN gates or recessed barriers.' },
    { label: 'Thin the barrier below the critical thickness', set: { mode: 'gan', d: 5, Vg: 0 }, note: 'Below a few nanometres the surface barrier pulls the band back above E_F and the 2DEG vanishes. The self-consistent solution (solid) sits a little below the simple Ambacher formula (dashed) because the electrons sit a few nanometres from the interface and fill states above the subband edge.' },
  ], ctl);

  ctl.on((k, final) => compute(final || k === 'mode'));
  compute(true);
  onWidth([main, side], () => { draw(); drawSide(); });
}
