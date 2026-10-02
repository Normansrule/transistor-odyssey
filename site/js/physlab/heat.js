// Lab — Heat: 2D self-heating under a GaN transistor finger.
import * as H from '../physics/thermal.js';
import { panel, tiles, experiments, hiCanvas, fix, frame, axes, linear, log, niceTicks, path, el, C, hover, tipRows, txt, clamp, ramp, rgb, fw, onWidth } from './ui.js';

const SUBS = ['Sapphire', 'Si', 'SiC', 'Diamond'];
const SCOL = { Sapphire: '#8a94a3', Si: C.s1, SiC: C.s4, Diamond: '#7fd3d0' };

export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'sub', type: 'seg', label: 'Substrate under the GaN', options: SUBS.map(s => [s, s]), value: 'SiC' },
    { key: 'P', label: 'Dissipated power', min: 0.5, max: 15, step: 0.1, value: 5, fmt: v => v.toFixed(1) + ' W/mm' },
    { key: 'w', label: 'Hot-spot width', min: 0.25, max: 5, step: 0.05, value: 1, fmt: v => v.toFixed(2) + ' µm' },
    { key: 'tbr', label: 'Boundary resistance (TBR)', min: 0, max: 60, step: 1, value: 0, fmt: v => v.toFixed(0) + ' m²K/GW' },
    { key: 'tsub', label: 'Substrate thickness', min: 20, max: 400, step: 5, value: 100, fmt: v => v.toFixed(0) + ' µm' },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'dt', label: 'Peak temperature rise', unit: 'K' }, { key: 'tc', label: 'Channel temperature', unit: '°C (sink at 27 °C)' },
    { key: 'rth', label: 'Thermal resistance', unit: 'K·mm/W' }, { key: 'gan', label: 'Drop across the GaN layer', unit: 'K' },
    { key: 'tbr', label: 'Drop across the boundary', unit: 'K' }, { key: 'sub', label: 'Drop in the substrate', unit: 'K' },
  ]);
  const warn = sec.querySelector('.pl-warn');
  const hostA = sec.querySelector('[data-role=heatwide]'), hostB = sec.querySelector('[data-role=heatzoom]');
  const cvA = hiCanvas(hostA.querySelector('canvas')), cvB = hiCanvas(hostB.querySelector('canvas'));
  const profHost = sec.querySelector('[data-role=heatprof]'), barHost = sec.querySelector('[data-role=heatbar]');
  let S, bars = null, barKey = '';

  const opts = s => ({ tSubUm: s.tsub, wUm: s.w, tbr: s.tbr });
  function compute(final) {
    const s = ctl.state;
    const { rise, g, T } = H.peakRise(s.sub, s.P, opts(s));
    // column at the heater centre: find the drop in each layer
    const col = T[0], y = g.y, jAct = y.findIndex(v => v >= g.tAct - 1e-12);
    const jSub = s.tbr > 0 ? jAct + 1 : jAct;
    S = { rise, g, T };
    show({ dt: rise.toFixed(1), tc: (27 + rise).toFixed(0), rth: (rise / s.P).toFixed(2), gan: (col[0] - col[jAct]).toFixed(1), tbr: (col[jAct] - col[jSub]).toFixed(1), sub: (col[jSub] - 300).toFixed(1) });
    warn.hidden = 27 + rise < 175;
    const key = [s.P, s.w, s.tbr, s.tsub].join('|');
    if (final && key !== barKey) { barKey = key; bars = SUBS.map(sb => [sb, H.peakRise(sb, s.P, opts(s)).rise]); }
    paint(); drawProf(); drawBars();
  }

  // bilinear lookup on the graded grid
  function sampler(g, T) {
    const x = g.x, y = g.y;
    const idx = (arr, v) => { let lo = 0, hi = arr.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m] <= v) lo = m; else hi = m; } return lo; };
    return (X, Y) => {
      X = Math.abs(X); if (X > x[x.length - 1]) X = x[x.length - 1];
      const i = idx(x, X), j = idx(y, Y), tx = (X - x[i]) / (x[i + 1] - x[i] || 1), ty = (Y - y[j]) / (y[j + 1] - y[j] || 1);
      const a = T[i][j], b = T[i + 1][j], c = T[i][j + 1], d = T[i + 1][j + 1];
      return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    };
  }
  function heatmap(o, xr, yr, labelFn) {
    o.resize(); const { ctx, w, h } = o; if (!S) return;
    const f = sampler(S.g, S.T), pad = { l: 44, r: 12, t: 12, b: 28 }, W = w - pad.l - pad.r, Hh = h - pad.t - pad.b;
    const img = ctx.createImageData(Math.max(2, Math.round(W / 2)), Math.max(2, Math.round(Hh / 2)));
    const rise = Math.max(S.rise, 1e-6);
    for (let py = 0; py < img.height; py++) {
      const Y = yr[0] + (yr[1] - yr[0]) * py / (img.height - 1);
      for (let px = 0; px < img.width; px++) {
        const X = xr[0] + (xr[1] - xr[0]) * px / (img.width - 1);
        const c = ramp(Math.pow(Math.max((f(X, Y) - 300) / rise, 0), 0.6)), k = 4 * (py * img.width + px);
        img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
      }
    }
    const tmp = document.createElement('canvas'); tmp.width = img.width; tmp.height = img.height; tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.clearRect(0, 0, w, h); ctx.imageSmoothingEnabled = true; ctx.drawImage(tmp, pad.l, pad.t, W, Hh);
    // GaN / substrate boundary
    const yAct = S.g.tAct, Yp = v => pad.t + (v - yr[0]) / (yr[1] - yr[0]) * Hh, Xp = v => pad.l + (v - xr[0]) / (xr[1] - xr[0]) * W;
    if (yAct > yr[0] && yAct < yr[1]) { ctx.strokeStyle = 'rgba(232,236,241,.6)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(pad.l, Yp(yAct)); ctx.lineTo(pad.l + W, Yp(yAct)); ctx.stroke(); ctx.setLineDash([]); }
    // heater
    ctx.fillStyle = '#f2b84b'; ctx.fillRect(Xp(-S.g.w / 2), pad.t - 5, Math.max(Xp(S.g.w / 2) - Xp(-S.g.w / 2), 2), 5);
    ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillStyle = '#aab3c0'; ctx.textAlign = 'left';
    labelFn(ctx, pad, W, Hh, Xp, Yp);
  }
  function paint() {
    const s = ctl.state, g = S.g, half = g.x[g.x.length - 1], depth = g.y[g.y.length - 1];
    heatmap(cvA, [-half, half], [0, depth], (ctx, pad, W, Hh) => {
      ctx.fillText(`${(2 * half * 1e6).toFixed(0)} µm wide`, pad.l, pad.t + Hh + 18);
      ctx.textAlign = 'right'; ctx.fillText(`${s.sub} ${s.tsub.toFixed(0)} µm → heat sink (27 °C)`, pad.l + W, pad.t + Hh + 18);
      ctx.save(); ctx.translate(14, pad.t + Hh / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText('depth', 0, 0); ctx.restore();
    });
    const zx = Math.max(6e-6, s.w * 1e-6 * 3), zy = Math.max(8e-6, s.w * 1e-6 * 3);
    heatmap(cvB, [-zx, zx], [0, zy], (ctx, pad, W, Hh, Xp, Yp) => {
      ctx.fillText(`zoom: ${(2 * zx * 1e6).toFixed(0)} × ${(zy * 1e6).toFixed(0)} µm around the gate`, pad.l, pad.t + Hh + 18);
      ctx.fillStyle = '#e8ecf1'; ctx.fillText('GaN', pad.l + 6, Yp(S.g.tAct) - 6); ctx.fillText(s.sub, pad.l + 6, Yp(S.g.tAct) + 14);
      // colour key
      const kx = pad.l + W - 150, ky = pad.t + 8;
      ctx.fillStyle = 'rgba(10,13,17,.7)'; ctx.fillRect(kx - 6, ky - 4, 156, 30);
      for (let i = 0; i < 120; i++) { ctx.fillStyle = rgb(ramp(Math.pow(i / 119, 0.6))); ctx.fillRect(kx + i, ky, 1, 8); }
      ctx.fillStyle = '#aab3c0'; ctx.textAlign = 'left'; ctx.fillText('+0 K', kx, ky + 22); ctx.textAlign = 'right'; ctx.fillText(`+${S.rise.toFixed(0)} K`, kx + 120, ky + 22);
    });
  }

  function drawProf() {
    const s = ctl.state, g = S.g;
    const f = frame(profHost, { w: fw(profHost), h: 250, m: { t: 14, r: 16, b: 40, l: 54 } });
    const xs = log(0.1, g.x[g.x.length - 1] * 1e6, f.x0, f.x1), ys = linear(0, Math.max(S.rise * 1.1, 1), f.y0, f.y1);
    axes(f, xs, ys, { xt: [0.1, 1, 10, 100], yt: niceTicks(0, Math.max(S.rise * 1.1, 1), 5), xl: 'distance from the gate centre (µm, log)', yl: 'surface ΔT (K)', xf: v => String(v), yf: v => +v.toFixed(0) });
    const pts = g.x.map((x, i) => [x * 1e6, S.T[i][0] - 300]).filter(p => p[0] >= 0.1);
    el('path', { d: path(pts.map(([x, t]) => [xs(x), ys(t)])), fill: 'none', stroke: SCOL[s.sub], 'stroke-width': 2.2 }, f.svg);
    el('line', { x1: xs(Math.max(s.w / 2, 0.1)), x2: xs(Math.max(s.w / 2, 0.1)), y1: f.y1, y2: f.y0, stroke: '#f2b84b', 'stroke-dasharray': '3 4' }, f.svg);
    txt(f.svg, xs(Math.max(s.w / 2, 0.1)) + 4, f.y1 + 12, 'heater edge', { fill: '#f2b84b' });
    hover(f, profHost, xs, x => { let i = 0; while (i < g.x.length - 1 && g.x[i + 1] * 1e6 < x) i++; return tipRows(`${x.toFixed(2)} µm`, [['ΔT', (S.T[i][0] - 300).toFixed(1) + ' K']]); });
  }

  function drawBars() {
    const s = ctl.state;
    const f = frame(barHost, { w: fw(barHost), h: 250, m: { t: 14, r: 16, b: 40, l: 54 } });
    if (!bars) { txt(f.svg, (f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2, 'release a slider to compare substrates', { 'text-anchor': 'middle', fill: C.muted }); return; }
    const mx = Math.max(...bars.map(b => b[1])) * 1.15;
    const ys = linear(0, mx, f.y0, f.y1), bw = (f.x1 - f.x0) / bars.length;
    axes(f, linear(0, 1, f.x0, f.x1), ys, { xt: [], yt: niceTicks(0, mx, 5), yl: 'peak ΔT (K)', yf: v => +v.toFixed(0) });
    bars.forEach(([name, r], i) => {
      const x = f.x0 + i * bw + bw * 0.2, cur = name === s.sub;
      el('rect', { x, y: ys(r), width: bw * 0.6, height: f.y0 - ys(r), rx: 4, fill: SCOL[name], opacity: cur ? 1 : 0.55, stroke: cur ? '#f2b84b' : 'none', 'stroke-width': 2 }, f.svg);
      txt(f.svg, x + bw * 0.3, ys(r) - 6, r.toFixed(0) + ' K', { 'text-anchor': 'middle', fill: C.ink });
      txt(f.svg, x + bw * 0.3, f.y0 + 16, name, { 'text-anchor': 'middle', fill: cur ? '#f2b84b' : C.ink2 });
    });
  }

  experiments(sec.querySelector('.lab-exp'), [
    { label: 'Same 5 W/mm on four substrates', run: api => api.animate({ P: 5, w: 1, tbr: 0, tsub: 100 }, 500), note: 'The hot spot is set mostly by how fast heat spreads just under the gate. Sapphire (35 W/m·K) traps it; silicon and SiC spread it; diamond (≈1800 W/m·K) spreads it best. That is why RF GaN is grown on SiC and why GaN-on-diamond is pursued for the hottest amplifiers.' },
    { label: 'Add a realistic boundary resistance', set: { sub: 'Diamond', tbr: 25 }, note: 'Bonding or growing GaN on diamond leaves an interlayer with a thermal boundary resistance of roughly 10–30 m²K/GW. With a 1 µm heater that thin layer can eat much of diamond\'s advantage — a major research target for GaN-on-diamond.' },
    { label: 'Push 12 W/mm through silicon', set: { sub: 'Si', P: 12, tbr: 0 }, note: 'Channel temperatures above ~175–200 °C cut GaN reliability sharply, and real conductivity falls as temperature rises, so this constant-k model is optimistic. Power density limits RF GaN long before the transistor itself runs out of voltage or current.' },
    { label: 'Spread the heat: a wider hot spot', set: { w: 4, P: 5 }, note: 'The same power over a wider area lowers the peak temperature because heat has more room to leave vertically. Multi-finger layouts with wide gate pitches trade chip area for temperature.' },
  ], ctl);

  ctl.on((k, final) => compute(final || k === 'sub'));
  compute(true);
  onWidth([profHost, barHost, hostA, hostB], () => { paint(); drawProf(); drawBars(); });
}
