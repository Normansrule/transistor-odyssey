// Lab — From capacitor to transistor: the charge-sheet MOSFET.
import * as M from '../physics/chargesheet.js';
import { panel, tiles, experiments, hiCanvas, loop, sci, fix, frame, axes, linear, log, niceTicks, fmtPow, path, el, C, hover, tipRows, txt, clamp, lerp, fw, onWidth, reduceMotion } from './ui.js';

export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'Vgs', label: 'Gate voltage V<sub>GS</sub>', min: 0, max: 1.5, step: 0.005, value: 1.0, fmt: v => v.toFixed(2) + ' V' },
    { key: 'Vds', label: 'Drain voltage V<sub>DS</sub>', min: 0, max: 1.5, step: 0.005, value: 0.3, fmt: v => v.toFixed(2) + ' V' },
    { key: 'Na', label: 'Body doping N<sub>A</sub>', min: 1e16, max: 1e18, log: true, value: 3e17, fmt: v => sci(v) + ' cm⁻³' },
    { key: 'tox', label: 'Oxide thickness t<sub>ox</sub>', min: 1, max: 10, step: 0.1, value: 2, fmt: v => v.toFixed(1) + ' nm' },
    { key: 'Vfb', label: 'Gate metal: V<sub>FB</sub>', min: -1.1, max: 0, step: 0.01, value: -0.7, fmt: v => v.toFixed(2) + ' V' },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'id', label: 'Drain current I<sub>D</sub>', unit: 'µA per µm width' }, { key: 'reg', label: 'Operating region', unit: '' },
    { key: 'vt', label: 'Threshold V<sub>T</sub>', unit: 'V (2φ_F definition)' }, { key: 'vdsat', label: 'Pinch-off V<sub>DSAT</sub>', unit: 'V' },
    { key: 'ss', label: 'Subthreshold swing', unit: 'mV/dec' }, { key: 'gm', label: 'Transconductance g<sub>m</sub>', unit: 'µS/µm' },
  ]);
  const dev = sec.querySelector('[data-role=channel]'), cv = hiCanvas(dev.querySelector('canvas'));
  const outHost = sec.querySelector('[data-role=out]'), trHost = sec.querySelector('[data-role=tr]');
  let P, S;

  function vdsat(Vgs) { // where the drain-end inversion charge first vanishes
    let lo = 0, hi = 3; const vg = Vgs - P.Vfb;
    for (let i = 0; i < 50; i++) { const m = 0.5 * (lo + hi); const ps = M.surfacePotential(Vgs, m, P); if (M.inversionCharge(ps, vg, P) > 1e-3 * P.Cox * P.phit) lo = m; else hi = m; }
    return 0.5 * (lo + hi);
  }

  function compute() {
    const s = ctl.state;
    P = M.params({ Na: s.Na, toxNm: s.tox, Vfb: s.Vfb });
    const id = M.drainCurrent(s.Vgs, s.Vds, P);
    const prof = M.channelProfile(s.Vgs, s.Vds, P, 81);
    const vds = s.Vgs > P.Vt ? vdsat(s.Vgs) : 0;
    const reg = s.Vgs < P.Vt ? 'subthreshold' : s.Vds < vds ? 'linear' : 'saturation';
    const gm = (M.drainCurrent(s.Vgs + 0.01, s.Vds, P) - M.drainCurrent(s.Vgs - 0.01, s.Vds, P)) / 0.02;
    S = { id, prof, vds, reg };
    // per µm of width: W = 1 µm in params
    show({ id: id * 1e6 < 0.01 ? sci(id * 1e6, 2) : (id * 1e6).toPrecision(3), reg: `<span style="color:${reg === 'saturation' ? '#f2b84b' : reg === 'linear' ? '#86b6ef' : '#aab3c0'}">${reg}</span>`,
      vt: fix(P.Vt, 3), vdsat: s.Vgs > P.Vt ? fix(vds, 3) : '—', ss: M.swing(P).toFixed(1), gm: (gm * 1e6).toPrecision(3) });
    drawOut(); drawTr();
  }

  // ---- channel animation
  const R = (() => { let s = 3; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const e = Array.from({ length: 260 }, () => ({ x: R(), y: R(), ph: R() }));
  let qiDraw = null;
  function paint(dt) {
    cv.resize(); const { ctx, w, h } = cv; if (!S) return;
    ctx.clearRect(0, 0, w, h);
    const sdW = Math.max(60, w * 0.12), x0 = sdW + 20, x1 = w - sdW - 20, Ly = x1 - x0;
    const top = 70, siTop = top + 26;
    const n = S.prof.Qi.length;
    if (!qiDraw || qiDraw.length !== n) qiDraw = Float64Array.from(S.prof.Qi);
    for (let i = 0; i < n; i++) qiDraw[i] = lerp(qiDraw[i], S.prof.Qi[i], Math.min(dt * 8, 1));
    const qref = P.Cox * 1.2;
    // silicon body + depletion
    ctx.fillStyle = 'rgba(217,89,38,.08)'; ctx.fillRect(10, siTop, w - 20, h - siTop - 10);
    const depth = i => 14 + 60 * Math.sqrt(Math.max(S.prof.psi[i], 0) / 1.6);
    ctx.beginPath(); ctx.moveTo(x0, siTop);
    for (let i = 0; i < n; i++) ctx.lineTo(x0 + Ly * i / (n - 1), siTop + depth(i));
    ctx.lineTo(x1, siTop); ctx.closePath(); ctx.fillStyle = 'rgba(16,20,26,.8)'; ctx.fill();
    ctx.strokeStyle = 'rgba(138,148,163,.5)'; ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]);
    // source / drain
    ctx.fillStyle = 'rgba(57,135,229,.35)'; ctx.strokeStyle = '#3987e5';
    ctx.fillRect(10, siTop, sdW + 10, 70); ctx.strokeRect(10.5, siTop + .5, sdW + 10, 70);
    ctx.fillRect(w - sdW - 20, siTop, sdW + 10, 70); ctx.strokeRect(w - sdW - 20.5, siTop + .5, sdW + 10, 70);
    // oxide + gate
    ctx.fillStyle = 'rgba(181,143,214,.35)'; ctx.fillRect(x0, top + 12, Ly, 14);
    ctx.fillStyle = '#f2b84b'; ctx.fillRect(x0, top - 18, Ly, 30);
    ctx.font = '12px "IBM Plex Mono", monospace'; ctx.fillStyle = '#1a1305'; ctx.textAlign = 'center';
    ctx.fillText(`gate  V_GS = ${ctl.state.Vgs.toFixed(2)} V`.replace('_GS', 'GS'), (x0 + x1) / 2, top + 2);
    ctx.fillStyle = '#aab3c0'; ctx.fillText('source (0 V)', 10 + sdW / 2, siTop + 88); ctx.fillText(`drain (${ctl.state.Vds.toFixed(2)} V)`, w - sdW / 2 - 10, siTop + 88);
    ctx.fillStyle = '#8a94a3'; ctx.fillText('depletion region', (x0 + x1) / 2, siTop + depth(Math.floor(n / 2)) + 16);
    // inversion layer thickness ∝ charge
    ctx.beginPath(); ctx.moveTo(x0, siTop);
    for (let i = 0; i < n; i++) ctx.lineTo(x0 + Ly * i / (n - 1), siTop + 1 + 16 * Math.min(qiDraw[i] / qref, 1.4));
    ctx.lineTo(x1, siTop); ctx.closePath();
    const grad = ctx.createLinearGradient(0, siTop, 0, siTop + 22); grad.addColorStop(0, 'rgba(90,162,255,.85)'); grad.addColorStop(1, 'rgba(90,162,255,.15)');
    ctx.fillStyle = grad; ctx.fill();
    // electrons: speed ∝ local field (dV/dy); density ∝ charge
    const I = S.id;
    for (const p of e) {
      const i = clamp(Math.round(p.x * (n - 1)), 0, n - 1), q = qiDraw[i] / qref;
      const v = I > 0 ? clamp(I / Math.max(qiDraw[i], 1e-9 * P.Cox) / (P.W / P.L * P.mu * P.Cox) * 0.004, 0, 3) : 0;
      if (!reduceMotion) p.x += (0.02 + v * 0.18) * dt * (I > 1e-9 ? 1 : 0);
      if (p.x > 1) { p.x -= 1; p.y = R(); }
      if (p.ph > Math.min(q * 1.2, 1) + 0.02) continue;
      const X = x0 + Ly * p.x, Y = siTop + 2 + p.y * 14 * Math.min(q, 1.4);
      ctx.beginPath(); ctx.arc(X, Y, 2, 0, 6.283); ctx.fillStyle = '#9cc6ff'; ctx.fill();
    }
    if (S.reg === 'saturation') { const X = x0 + Ly * 0.97; ctx.fillStyle = '#f2b84b'; ctx.textAlign = 'right'; ctx.fillText('pinch-off ↓', X, siTop + 40); }
    ctx.textAlign = 'left'; ctx.fillStyle = '#86b6ef'; ctx.fillText('inversion layer (electrons)', x0 + 4, siTop + 36);
  }

  function drawOut() {
    const s = ctl.state;
    const f = frame(outHost, { w: fw(outHost), h: 280, m: { t: 14, r: 16, b: 40, l: 58 } });
    const Vds = Array.from({ length: 61 }, (_, i) => 1.5 * i / 60);
    const gates = [0.4, 0.6, 0.8, 1.0, 1.2, 1.4].filter(v => v > P.Vt + 0.05);
    const imax = Math.max(M.drainCurrent(1.5, 1.5, P), M.drainCurrent(s.Vgs, 1.5, P)) * 1.08;
    const xs = linear(0, 1.5, f.x0, f.x1), ys = linear(0, imax * 1e6, f.y0, f.y1);
    axes(f, xs, ys, { xt: niceTicks(0, 1.5, 6), yt: niceTicks(0, imax * 1e6, 5), xl: 'V_DS (V)', yl: 'I_D (µA/µm)', xf: v => +v.toFixed(2), yf: v => +v.toPrecision(3) });
    gates.forEach((vg, k) => {
      el('path', { d: path(Vds.map(v => [xs(v), ys(M.drainCurrent(vg, v, P) * 1e6)])), fill: 'none', stroke: ['#86b6ef', '#5598e7', '#3987e5', '#256abf', '#1c5cab', '#15498a'][k], 'stroke-width': 1.6 }, f.svg);
      txt(f.svg, f.x1 - 2, ys(M.drainCurrent(vg, 1.5, P) * 1e6) - 4, `${vg.toFixed(1)} V`, { 'text-anchor': 'end', fill: C.muted });
    });
    el('path', { d: path(Vds.map(v => [xs(v), ys(M.drainCurrent(s.Vgs, v, P) * 1e6)])), fill: 'none', stroke: '#f2b84b', 'stroke-width': 2.4 }, f.svg);
    // saturation locus
    const loc = []; for (let vg = P.Vt + 0.05; vg <= 1.5; vg += 0.05) { const vd = vdsat(vg); if (vd <= 1.5) loc.push([xs(vd), ys(M.drainCurrent(vg, vd, P) * 1e6)]); }
    if (loc.length > 1) el('path', { d: path(loc), fill: 'none', stroke: C.muted, 'stroke-dasharray': '3 4' }, f.svg);
    txt(f.svg, f.x0 + 6, f.y1 + 12, 'dashed: V_DS = V_DSAT (pinch-off)', { fill: C.muted });
    el('circle', { cx: xs(s.Vds), cy: ys(S.id * 1e6), r: 6, fill: '#f2b84b', stroke: C.surface, 'stroke-width': 2 }, f.svg);
    hover(f, outHost, xs, v => tipRows(`V_DS = ${v.toFixed(2)} V`.replace('V_DS', 'V<sub>DS</sub>'), [[`I_D at V_GS = ${s.Vgs.toFixed(2)}`, (M.drainCurrent(s.Vgs, v, P) * 1e6).toPrecision(3) + ' µA/µm']]));
  }

  function drawTr() {
    const s = ctl.state;
    const f = frame(trHost, { w: fw(trHost), h: 280, m: { t: 14, r: 16, b: 40, l: 58 } });
    const vd = Math.max(s.Vds, 0.05);
    const Vg = Array.from({ length: 76 }, (_, i) => 1.5 * i / 75);
    const I = Vg.map(v => Math.max(M.drainCurrent(v, vd, P), 1e-15));
    const xs = linear(0, 1.5, f.x0, f.x1), ys = log(1e-12, 1e-3, f.y0, f.y1);
    axes(f, xs, ys, { xt: niceTicks(0, 1.5, 6), yt: [1e-12, 1e-10, 1e-8, 1e-6, 1e-4], xl: 'V_GS (V)', yl: 'I_D (A/µm)', yf: fmtPow, xf: v => +v.toFixed(2) });
    el('path', { d: path(Vg.map((v, i) => [xs(v), ys(clamp(I[i], 1e-12, 1e-3))])), fill: 'none', stroke: C.s1, 'stroke-width': 2 }, f.svg);
    el('line', { x1: xs(P.Vt), x2: xs(P.Vt), y1: f.y1, y2: f.y0, stroke: C.axis, 'stroke-dasharray': '3 4' }, f.svg);
    txt(f.svg, xs(P.Vt) + 4, f.y1 + 12, 'V_T', { fill: C.muted });
    txt(f.svg, f.x1 - 4, f.y0 - 10, `V_DS = ${vd.toFixed(2)} V · diffusion below V_T, drift above`, { 'text-anchor': 'end', fill: C.muted });
    el('circle', { cx: xs(s.Vgs), cy: ys(clamp(M.drainCurrent(s.Vgs, vd, P), 1e-12, 1e-3)), r: 6, fill: '#f2b84b', stroke: C.surface, 'stroke-width': 2 }, f.svg);
    hover(f, trHost, xs, v => tipRows(`V_GS = ${v.toFixed(2)} V`.replace('V_GS', 'V<sub>GS</sub>'), [['I_D', sci(M.drainCurrent(v, vd, P), 3) + ' A/µm']]));
  }

  experiments(sec.querySelector('.lab-exp'), [
    { label: 'Raise V<sub>DS</sub> until the channel pinches off', run: api => { api.animate({ Vgs: 1.0, Vds: 0.02 }, 400, () => setTimeout(() => api.animate({ Vds: 1.2 }, 3000), 250)); }, note: 'At small V<sub>DS</sub> the channel is uniform and the transistor is a resistor. As the drain rises the electron sheet thins near the drain; when it vanishes (pinch-off) extra drain voltage drops across a short depleted region and the current stops growing — saturation.' },
    { label: 'Turn the gate down into subthreshold', set: { Vgs: 0.2, Vds: 0.5 }, note: 'Below V<sub>T</sub> the inversion charge is exponentially small and current flows by diffusion, not drift. The log plot is a straight line with slope n·60 mV/decade, n = 1 + C<sub>dep</sub>/C<sub>ox</sub> — the same thermal limit the steep-slope devices of Chapter 15 try to beat.' },
    { label: 'Thicken the oxide to 8 nm', set: { tox: 8, Vgs: 1.2, Vds: 1.2 }, note: 'A thicker oxide means less gate capacitance: less charge per volt, lower current, higher threshold and a worse swing. Thinning the oxide was the main scaling lever from the 1970s until tunnelling stopped it (Lab 07).' },
    { label: 'Swap the gate metal (V<sub>FB</sub> → −0.2 V)', set: { Vfb: -0.2 }, note: 'The work function of the gate shifts every curve sideways. High-k/metal-gate processes choose different metals for n- and p-type transistors, and several work-function variants per type, to offer designers multiple threshold voltages.' },
  ], ctl);

  ctl.on(() => compute());
  compute();
  onWidth([outHost, trHost], () => { drawOut(); drawTr(); });
  loop(dev, dt => paint(dt));
}
