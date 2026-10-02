import { id, metrics } from './model.js';
import { el, frame, axes, linear, log, niceTicks, logTicks, fmtPow, path, tooltip, svgPoint, label, subHTML, C, RAMP } from './svgchart.js';

const fmtI = (a) => { const u = a * 1e6; return u >= 100 ? u.toFixed(0) + ' µA/µm' : u >= 1 ? u.toFixed(1) + ' µA/µm' : u >= 1e-3 ? (u * 1e3).toFixed(1) + ' nA/µm' : (u * 1e6).toPrecision(2) + ' pA/µm'; };

export function initLab(DATA, onPresetChange) {
  const presets = DATA.presets;
  const keys = Object.keys(presets);
  const sel = document.getElementById('preset');
  sel.innerHTML = keys.map(k => `<option value="${k}">${presets[k].year} · ${presets[k].name}</option>`).join('');
  sel.value = '2011_22nm_finfet';
  const vg = document.getElementById('labVg'), vd = document.getElementById('labVd');
  const vgOut = document.getElementById('labVgOut'), vdOut = document.getElementById('labVdOut');
  const tiles = document.getElementById('labTiles');
  const hostOut = document.getElementById('plotOut'), hostTr = document.getElementById('plotTr');
  const tipOut = tooltip(hostOut), tipTr = tooltip(hostTr);
  let p;

  function setPreset(k, keepRatio) {
    const rg = keepRatio ? +vg.value / +vg.max : 0.9, rd = keepRatio ? +vd.value / +vd.max : 1;
    p = presets[k];
    for (const s of [vg, vd]) { s.max = p.VDD; s.step = p.VDD / 400; }
    vg.value = (p.VDD * rg).toFixed(4); vd.value = (p.VDD * rd).toFixed(4);
    document.getElementById('presetNote').textContent = p.note || '';
    const kv = [['Channel length', p.L_nm >= 1000 ? (p.L_nm / 1000) + ' µm' : p.L_nm + ' nm'], ['EOT', p.EOT_nm + ' nm'], ['V_DD', p.VDD + ' V'],
      ['V_T0', p.VT0 + ' V'], ['Mobility µ₀', p.mu0 + ' cm²/V·s'], ['DIBL η', (p.eta * 1000).toFixed(0) + ' mV/V'], ['Structure', p.structure.replaceAll('_', ' ')]];
    document.getElementById('presetKv').innerHTML = kv.map(([a, b]) => `<dt>${subHTML(a)}</dt><dd>${b}</dd>`).join('');
    const m = metrics(p);
    const t = [['On-current', fmtI(m.ion), 'at V_GS = V_DS = V_DD'], ['Off-current', fmtI(m.ioff), 'at V_GS = 0'],
      ['Subthreshold swing', m.ss.toFixed(0) + ' mV/dec', 'ideal 59.5 at 300 K'], ['Peak gₘ', (m.gm * 1e3).toFixed(2) + ' mS/µm', 'at V_DS = V_DD']];
    tiles.innerHTML = t.map(([l, v, u]) => `<div class="card tile"><span class="l">${l}</span><span class="v">${v}</span><span class="u">${subHTML(u)}</span></div>`).join('');
    onPresetChange?.(p);
    draw();
  }

  function draw() {
    const g = +vg.value, d = +vd.value;
    vgOut.textContent = g.toFixed(2) + ' V'; vdOut.textContent = d.toFixed(2) + ' V';
    // ---- output family
    let f = frame(hostOut, { w: 440, h: 300, m: { t: 12, r: 14, b: 40, l: 54 } });
    const steps = 5, vgs = Array.from({ length: steps }, (_, i) => p.VT0 + (p.VDD - p.VT0) * (i + 1) / steps);
    const N = 90, xsV = Array.from({ length: N + 1 }, (_, i) => p.VDD * i / N);
    let imax = id(p, p.VDD, p.VDD) * 1.08;
    const xs = linear(0, p.VDD, f.x0, f.x1), ys = linear(0, imax * 1e6, f.y0, f.y1);
    axes(f, xs, ys, { xt: niceTicks(0, p.VDD, 5), yt: niceTicks(0, imax * 1e6, 5), xl: 'V_DS (V)', yl: 'I_D (µA/µm)', xf: v => +v.toFixed(2), yf: v => +v.toFixed(1) });
    const curves = vgs.map((v, i) => { const pts = xsV.map(x => [xs(x), ys(id(p, v, x) * 1e6)]); el('path', { d: path(pts), fill: 'none', stroke: RAMP[i], 'stroke-width': 2, 'stroke-linecap': 'round' }, f.svg); return v; });
    vgs.forEach((v, i) => { label(el('text', { x: f.x1 - 2, y: ys(id(p, v, p.VDD) * 1e6) - 6, 'text-anchor': 'end', fill: C.ink2, 'font-size': 11, 'font-family': 'IBM Plex Mono, monospace' }, f.svg), `${v.toFixed(2)} V`); });
    const bi = id(p, g, d);
    el('path', { d: path(xsV.map(x => [xs(x), ys(id(p, g, x) * 1e6)])), fill: 'none', stroke: '#f2b84b', 'stroke-width': 1.5, opacity: 0.9 }, f.svg);
    el('circle', { cx: xs(d), cy: ys(bi * 1e6), r: 5.5, fill: '#f2b84b', stroke: C.surface, 'stroke-width': 2 }, f.svg);
    const cross = el('line', { y1: f.y1, y2: f.y0, stroke: C.muted, 'stroke-width': 1, opacity: 0 }, f.svg);
    const hit = el('rect', { x: f.x0, y: f.y1, width: f.x1 - f.x0, height: f.y0 - f.y1, fill: 'transparent' }, f.svg);
    hit.addEventListener('pointermove', e => {
      const pt = svgPoint(f.svg, e); const x = Math.min(Math.max(xs.inv(pt.x), 0), p.VDD);
      cross.setAttribute('x1', xs(x)); cross.setAttribute('x2', xs(x)); cross.setAttribute('opacity', 1);
      tipOut.show(`<b>V<sub>DS</sub> = ${x.toFixed(2)} V</b>` + vgs.slice().reverse().map(v => `<div class="row"><span>V<sub>GS</sub> ${v.toFixed(2)}</span><span>${fmtI(id(p, v, x))}</span></div>`).join(''), e.clientX, e.clientY);
    });
    hit.addEventListener('pointerleave', () => { cross.setAttribute('opacity', 0); tipOut.hide(); });

    // ---- transfer (log)
    f = frame(hostTr, { w: 440, h: 300, m: { t: 12, r: 14, b: 40, l: 54 } });
    const xs2 = linear(0, p.VDD, f.x0, f.x1);
    const lo = Math.max(id(p, 0, d) / 5, 1e-13), hi = id(p, p.VDD, Math.max(d, 1e-3)) * 3;
    const ys2 = log(Math.max(lo, hi / 1e12), hi, f.y0, f.y1);
    axes(f, xs2, ys2, { xt: niceTicks(0, p.VDD, 5), yt: logTicks(ys2.domain[0], hi, 2), xl: 'V_GS (V)', yl: 'I_D (A/µm)', xf: v => +v.toFixed(2), yf: fmtPow });
    const pts = xsV.map(x => [xs2(x), ys2(Math.max(id(p, x, d), ys2.domain[0]))]);
    el('path', { d: path(pts), fill: 'none', stroke: C.s1, 'stroke-width': 2 }, f.svg);
    el('line', { x1: xs2(p.VT0), x2: xs2(p.VT0), y1: f.y1, y2: f.y0, stroke: C.axis, 'stroke-width': 1 }, f.svg);
    label(el('text', { x: xs2(p.VT0) + 4, y: f.y1 + 12, fill: C.muted, 'font-size': 11, 'font-family': 'IBM Plex Mono, monospace' }, f.svg), 'V_T0');
    el('circle', { cx: xs2(g), cy: ys2(Math.max(id(p, g, d), ys2.domain[0])), r: 5.5, fill: '#f2b84b', stroke: C.surface, 'stroke-width': 2 }, f.svg);
    const cross2 = el('line', { y1: f.y1, y2: f.y0, stroke: C.muted, 'stroke-width': 1, opacity: 0 }, f.svg);
    const hit2 = el('rect', { x: f.x0, y: f.y1, width: f.x1 - f.x0, height: f.y0 - f.y1, fill: 'transparent' }, f.svg);
    hit2.addEventListener('pointermove', e => {
      const pt = svgPoint(f.svg, e); const x = Math.min(Math.max(xs2.inv(pt.x), 0), p.VDD);
      cross2.setAttribute('x1', xs2(x)); cross2.setAttribute('x2', xs2(x)); cross2.setAttribute('opacity', 1);
      tipTr.show(`<b>V<sub>GS</sub> = ${x.toFixed(2)} V</b><div class="row"><span>I<sub>D</sub></span><span>${fmtI(id(p, x, d))}</span></div><div class="row"><span>V<sub>DS</sub></span><span>${d.toFixed(2)} V</span></div>`, e.clientX, e.clientY);
    });
    hit2.addEventListener('pointerleave', () => { cross2.setAttribute('opacity', 0); tipTr.hide(); });
  }

  sel.addEventListener('change', () => setPreset(sel.value, true));
  vg.addEventListener('input', draw); vd.addEventListener('input', draw);
  setPreset(sel.value, false);
}
