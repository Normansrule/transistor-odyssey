// Lab 3 — MOS capacitor: band bending, charge and C–V.
import * as M from '../physics/moscap.js';
import { bandGap } from '../physics/carriers.js';
import { panel, tiles, experiments, sci, fix, frame, axes, linear, log, niceTicks, fmtPow, path, el, C, hover, tipRows, txt, clamp, fw, onWidth } from './ui.js';

const VMIN = -3, VMAX = 5;

export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'Vg', label: 'Gate voltage V<sub>G</sub>', min: VMIN, max: VMAX, step: 0.01, value: 0.6, fmt: v => (v >= 0 ? '+' : '') + v.toFixed(2) + ' V' },
    { key: 'Na', label: 'Body doping N<sub>A</sub> (p-type)', min: 1e15, max: 1e18, log: true, value: 1e17, fmt: v => sci(v) + ' cm⁻³' },
    { key: 'tox', label: 'Oxide thickness t<sub>ox</sub> (SiO₂)', min: 1, max: 20, step: 0.1, value: 5, fmt: v => v.toFixed(1) + ' nm' },
    { key: 'Vfb', label: 'Flat-band voltage V<sub>FB</sub>', min: -1.2, max: 0.6, step: 0.01, value: -0.9, fmt: v => v.toFixed(2) + ' V' },
    { key: 'hf', type: 'seg', label: 'Measurement frequency', options: [['lf', 'low (quasi-static)'], ['hf', 'high (1 MHz)']], value: 'lf' },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'reg', label: 'Surface is in', unit: '' }, { key: 'psi', label: 'Surface potential ψ<sub>s</sub>', unit: 'V' },
    { key: 'vt', label: 'Threshold V<sub>T</sub>', unit: 'V' }, { key: 'cox', label: 'C<sub>ox</sub>', unit: 'µF/cm²' },
    { key: 'c', label: 'C / C<sub>ox</sub>', unit: '' }, { key: 'ns', label: 'Surface electrons n<sub>s</sub>', unit: 'cm⁻³' },
  ]);
  const bandHost = sec.querySelector('[data-role=band]'), cvHost = sec.querySelector('[data-role=cv]'), nHost = sec.querySelector('[data-role=dens]');
  let S;

  function regionOf(psi, phiB) {
    if (psi < -0.02) return ['accumulation', '#ff9c73'];
    if (psi < phiB) return ['depletion', '#aab3c0'];
    if (psi < 2 * phiB) return ['weak inversion', '#86b6ef'];
    return ['strong inversion', '#5aa2ff'];
  }

  function compute() {
    const s = ctl.state;
    const p = M.params({ Na: s.Na, toxNm: s.tox, Vfb: s.Vfb });
    const psi = M.surfacePotential(s.Vg, p);
    const bb = M.bandBending(psi, p);
    const [reg, col] = regionOf(psi, p.phiB);
    const c = M.capacitance(psi, p, s.hf === 'hf');
    S = { p, psi, bb, reg, col, c, Vt: M.threshold(p), Eg: bandGap('Si') };
    show({ reg: `<span style="color:${col}">${reg}</span>`, psi: fix(psi, 3), vt: fix(S.Vt, 2), cox: (p.Cox * 1e6).toPrecision(3), c: c.toFixed(3), ns: sci(p.n0 * Math.exp(psi / p.kT)) });
    drawBand(); drawCV(); drawDens();
  }

  function drawBand() {
    const { p, psi, bb, Eg } = S, Vg = ctl.state.Vg;
    const f = frame(bandHost, { w: fw(bandHost), h: 330, m: { t: 16, r: 16, b: 36, l: 50 } });
    const xm0 = f.x0, xm1 = f.x0 + 56, xo1 = xm1 + 58;
    const xs = linear(0, bb.depthNm, xo1, f.x1);
    const Ei = i => p.phiB - bb.psi[i];
    const Ec0 = p.phiB - psi + Eg / 2, Ev0 = p.phiB - psi - Eg / 2;
    const EFm = -Vg;
    const lo = Math.min(Ev0, p.phiB - Eg / 2, EFm) - 0.45, hi = Math.max(Ec0, p.phiB + Eg / 2, EFm) + 0.6;
    const ys = linear(lo, hi, f.y0, f.y1);
    // clip
    const cid = 'clip' + Math.random().toString(36).slice(2, 7);
    const defs = el('defs', {}, f.svg), cp = el('clipPath', { id: cid }, defs); el('rect', { x: f.x0, y: f.y1, width: f.x1 - f.x0, height: f.y0 - f.y1 }, cp);
    const G = el('g', { 'clip-path': `url(#${cid})` }, f.svg);
    // metal
    el('rect', { x: xm0, y: ys(EFm), width: xm1 - xm0, height: Math.max(f.y0 - ys(EFm), 0), fill: 'rgba(170,179,192,.22)' }, G);
    el('line', { x1: xm0, x2: xm1, y1: ys(EFm), y2: ys(EFm), stroke: '#f2b84b', 'stroke-width': 2 }, G);
    // oxide (SiO2 conduction band 3.1 eV above Si Ec, valence 4.8 eV below Si Ev)
    const Vox = Vg - p.Vfb - psi;
    const ecs = Ec0 + 3.1, ecg = ecs - Vox, evs = Ev0 - 4.8, evg = evs - Vox;
    el('path', { d: `M${xm1} ${ys(ecg)}L${xo1} ${ys(ecs)}L${xo1} ${ys(evs)}L${xm1} ${ys(evg)}Z`, fill: 'rgba(181,143,214,.14)', stroke: '#b58fd6', 'stroke-width': 1.5 }, G);
    // semiconductor bands
    const pts = off => path(Array.from(bb.psi, (_, i) => [xs(i * bb.dxNm), ys(Ei(i) + off)]));
    // inversion / accumulation charge shading near surface
    const nS = p.n0 * Math.exp(psi / p.kT);
    if (psi > p.phiB) {
      const edge = bb.psi.findIndex(v => v < p.phiB); const k = edge < 0 ? bb.psi.length - 1 : edge;
      el('path', { d: `M${xs(0)} ${ys(Ei(0) + Eg / 2)}` + Array.from({ length: k + 1 }, (_, i) => `L${xs(i * bb.dxNm)} ${ys(Ei(i) + Eg / 2)}`).join('') + `L${xs(k * bb.dxNm)} ${ys(0)}L${xs(0)} ${ys(0)}Z`, fill: 'rgba(57,135,229,.28)' }, G);
      txt(f.svg, xs(0) + 6, ys(0) + 14, 'inversion layer (electrons)', { fill: '#86b6ef' });
    } else if (psi < -0.02) {
      txt(f.svg, xs(0) + 6, ys(Ev0) + 14, 'accumulated holes', { fill: '#ff9c73' });
    }
    el('path', { d: pts(Eg / 2), fill: 'none', stroke: C.s1, 'stroke-width': 2 }, G);
    el('path', { d: pts(-Eg / 2), fill: 'none', stroke: C.s2, 'stroke-width': 2 }, G);
    el('path', { d: pts(0), fill: 'none', stroke: C.muted, 'stroke-width': 1, 'stroke-dasharray': '2 4' }, G);
    el('line', { x1: xo1, x2: f.x1, y1: ys(0), y2: ys(0), stroke: '#f2b84b', 'stroke-width': 1.6, 'stroke-dasharray': '7 5' }, G);
    // depletion edge
    const Wd = Math.sqrt(2 * p.eps_s * Math.min(Math.max(psi, 0), 2 * p.phiB) / (1.602e-19 * p.Na)) * 1e7;
    if (psi > 0.02) { el('line', { x1: xs(Wd), x2: xs(Wd), y1: f.y1, y2: f.y0, stroke: C.muted, 'stroke-dasharray': '3 4' }, G); txt(f.svg, xs(Wd) + 4, f.y1 + 12, 'depletion edge', { fill: C.muted }); }
    // labels
    txt(f.svg, (xm0 + xm1) / 2, f.y0 + 16, 'gate', { 'text-anchor': 'middle', fill: C.ink2 });
    txt(f.svg, (xm1 + xo1) / 2, f.y0 + 16, 'SiO₂', { 'text-anchor': 'middle', fill: '#b58fd6' });
    txt(f.svg, xo1 + 14, f.y0 + 16, 'silicon →', { fill: C.muted });
    txt(f.svg, f.x1, f.y0 + 16, `${bb.depthNm.toFixed(0)} nm deep`, { 'text-anchor': 'end', fill: C.muted });
    txt(f.svg, f.x1 - 4, ys(p.phiB + Eg / 2) - 6, 'Ec', { 'text-anchor': 'end', fill: '#86b6ef' });
    txt(f.svg, f.x1 - 4, ys(p.phiB - Eg / 2) + 14, 'Ev', { 'text-anchor': 'end', fill: '#ff9c73' });
    txt(f.svg, f.x1 - 4, ys(p.phiB) - 5, 'Ei', { 'text-anchor': 'end', fill: C.muted });
    txt(f.svg, f.x1 - 28, ys(0) - 5, 'EF', { 'text-anchor': 'end', fill: '#f2b84b' });
    txt(f.svg, xm0 + 4, ys(EFm) - 6, 'EF,gate', { fill: '#f2b84b' });
    txt(f.svg, 14, (f.y0 + f.y1) / 2, 'electron energy (eV)', { transform: `rotate(-90 14 ${(f.y0 + f.y1) / 2})`, 'text-anchor': 'middle', fill: C.ink2 });
    for (const t of niceTicks(lo, hi, 5)) { el('line', { x1: f.x0 - 4, x2: f.x0, y1: ys(t), y2: ys(t), stroke: C.axis }, f.svg); txt(f.svg, f.x0 - 7, ys(t) + 4, String(+t.toFixed(2)), { 'text-anchor': 'end', fill: C.muted }); }
  }

  function drawCV() {
    const { p } = S, hf = ctl.state.hf === 'hf';
    const f = frame(cvHost, { w: fw(cvHost), h: 280, m: { t: 14, r: 16, b: 40, l: 54 } });
    const xs = linear(VMIN, VMAX, f.x0, f.x1), ys = linear(0, 1.05, f.y0, f.y1);
    axes(f, xs, ys, { xt: niceTicks(VMIN, VMAX, 8), yt: [0, .2, .4, .6, .8, 1], xl: 'gate voltage V_G (V)', yl: 'C / C_ox', xf: v => +v.toFixed(1), yf: v => v.toFixed(1) });
    // shade regions
    const vfb = p.Vfb, vt = S.Vt;
    el('rect', { x: f.x0, y: f.y1, width: Math.max(xs(clamp(vfb, VMIN, VMAX)) - f.x0, 0), height: f.y0 - f.y1, fill: 'rgba(217,89,38,.06)' }, f.svg);
    el('rect', { x: xs(clamp(vt, VMIN, VMAX)), y: f.y1, width: Math.max(f.x1 - xs(clamp(vt, VMIN, VMAX)), 0), height: f.y0 - f.y1, fill: 'rgba(57,135,229,.06)' }, f.svg);
    if (vfb > VMIN + 0.4) txt(f.svg, xs(vfb) - 6, f.y0 - 34, 'accumulation', { 'text-anchor': 'end', fill: '#ff9c73' });
    if (vt < VMAX - 0.4) txt(f.svg, xs(vt) + 6, f.y0 - 34, 'inversion', { fill: '#86b6ef' });
    for (const [v, n] of [[vfb, 'V_FB'], [vt, 'V_T']]) if (v > VMIN && v < VMAX) { el('line', { x1: xs(v), x2: xs(v), y1: f.y1, y2: f.y0, stroke: C.axis }, f.svg); txt(f.svg, xs(v) + 3, f.y0 - 6, n, { fill: C.muted }); }
    const Vs = Array.from({ length: 241 }, (_, i) => VMIN + (VMAX - VMIN) * i / 240);
    const psis = Vs.map(v => M.surfacePotential(v, p));
    const lf = psis.map(ps => M.capacitance(ps, p, false)), hfc = psis.map(ps => M.capacitance(ps, p, true));
    el('path', { d: path(Vs.map((v, i) => [xs(v), ys(lf[i])])), fill: 'none', stroke: C.s1, 'stroke-width': hf ? 1.3 : 2.4, opacity: hf ? .5 : 1 }, f.svg);
    el('path', { d: path(Vs.map((v, i) => [xs(v), ys(hfc[i])])), fill: 'none', stroke: C.s2, 'stroke-width': hf ? 2.4 : 1.3, 'stroke-dasharray': hf ? null : '5 4', opacity: hf ? 1 : .6 }, f.svg);
    txt(f.svg, f.x1 - 4, ys(lf[lf.length - 1]) + 16, 'low frequency', { 'text-anchor': 'end', fill: '#86b6ef' });
    txt(f.svg, f.x1 - 4, ys(hfc[hfc.length - 1]) - 6, 'high frequency', { 'text-anchor': 'end', fill: '#ff9c73' });
    el('circle', { cx: xs(ctl.state.Vg), cy: ys(S.c), r: 6, fill: '#f2b84b', stroke: C.surface, 'stroke-width': 2 }, f.svg);
    hover(f, cvHost, xs, v => { const ps = M.surfacePotential(v, p); return tipRows(`V_G = ${v.toFixed(2)} V`.replace('V_G', 'V<sub>G</sub>'), [['ψs', ps.toFixed(3) + ' V'], ['C/Cox (LF)', M.capacitance(ps, p).toFixed(3)], ['C/Cox (HF)', M.capacitance(ps, p, true).toFixed(3)]]); });
  }

  function drawDens() {
    const { p, bb } = S;
    const f = frame(nHost, { w: fw(nHost), h: 220, m: { t: 12, r: 16, b: 38, l: 58 } });
    const xs = linear(0, bb.depthNm, f.x0, f.x1), ys = log(1e2, 1e21, f.y0, f.y1);
    axes(f, xs, ys, { xt: niceTicks(0, bb.depthNm, 6), yt: [1e3, 1e6, 1e9, 1e12, 1e15, 1e18, 1e21], xl: 'depth below the oxide (nm)', yl: 'density (cm⁻³)', yf: fmtPow, xf: v => +v.toFixed(1) });
    const n = Array.from(bb.psi, v => p.n0 * Math.exp(v / p.kT)), pp = Array.from(bb.psi, v => p.p0 * Math.exp(-v / p.kT));
    el('path', { d: path(n.map((v, i) => [xs(i * bb.dxNm), ys(clamp(v, 1e2, 1e21))])), fill: 'none', stroke: C.s1, 'stroke-width': 2 }, f.svg);
    el('path', { d: path(pp.map((v, i) => [xs(i * bb.dxNm), ys(clamp(v, 1e2, 1e21))])), fill: 'none', stroke: C.s2, 'stroke-width': 2 }, f.svg);
    el('line', { x1: f.x0, x2: f.x1, y1: ys(p.Na), y2: ys(p.Na), stroke: C.muted, 'stroke-dasharray': '4 4' }, f.svg);
    txt(f.svg, f.x1 - 4, ys(p.Na) - 6, 'N_A', { 'text-anchor': 'end', fill: C.muted });
    txt(f.svg, f.x1 - 4, ys(clamp(n[n.length - 1], 1e2, 1e21)) - 6, 'electrons n', { 'text-anchor': 'end', fill: '#86b6ef' });
    txt(f.svg, f.x0 + 60, ys(clamp(pp[pp.length - 1], 1e2, 1e21)) + 14, 'holes p', { fill: '#ff9c73' });
    hover(f, nHost, xs, x => { const i = clamp(Math.round(x / bb.dxNm), 0, bb.psi.length - 1); return tipRows(`${x.toFixed(1)} nm`, [['n', sci(n[i])], ['p', sci(pp[i])], ['ψ', bb.psi[i].toFixed(3) + ' V']]); });
  }

  experiments(sec.querySelector('.lab-exp'), [
    { label: 'Sweep the gate from −2.5 V to +2.5 V', run: api => { api.set('Vg', -2.5); setTimeout(() => api.animate({ Vg: 2.5 }, 4200), 250); }, note: 'Watch the bands: negative gate pulls holes to the surface (accumulation), small positive gate pushes them away (depletion), and past V<sub>T</sub> the bands bend enough that electrons pile up at the surface — the inversion layer that is the channel of every MOSFET.' },
    { label: 'Thin the oxide to 2 nm', set: { tox: 2, Vg: 1.0 }, note: 'C<sub>ox</sub> grows as 1/t<sub>ox</sub>, so the gate controls the surface more strongly and V<sub>T</sub> drops. This is the lever planar scaling pulled until tunnelling leakage (Lab 07) stopped it around 1.2 nm.' },
    { label: 'Dope the body to 10¹⁸ cm⁻³', set: { Na: 1e18, Vg: 1.5 }, note: 'More acceptors mean more depletion charge to uncover before inversion, so V<sub>T</sub> rises and the depletion layer gets thinner. Planar MOSFETs tuned V<sub>T</sub> this way; FinFETs and nanosheets use undoped channels and set V<sub>T</sub> with the gate metal instead.' },
    { label: 'Measure at high frequency', set: { hf: 'hf', Vg: 3 }, note: 'At 1 MHz the minority electrons cannot be generated fast enough to follow the AC signal, so the capacitance stays at its depletion minimum even in inversion. The gap between the curves is how engineers measure doping and interface quality.' },
    { label: 'Change the gate metal (V<sub>FB</sub> → +0.3 V)', set: { Vfb: 0.3, hf: 'lf' }, note: 'The flat-band voltage is set by the work-function difference between gate and body. Shifting it slides the whole C–V curve. High-k/metal-gate processes pick different metals for n- and p-type transistors to place V<sub>T</sub>.' },
  ], ctl);

  ctl.on(() => compute());
  compute();
  onWidth([bandHost, cvHost, nHost], () => { drawBand(); drawCV(); drawDens(); });
}
