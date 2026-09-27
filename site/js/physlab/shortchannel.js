// Lab 5 — Short-channel electrostatics: a live 2D Poisson solve of a MOSFET.
import * as P from '../physics/poisson2d.js';
import { panel, tiles, experiments, hiCanvas, sci, fix, frame, axes, linear, log, niceTicks, path, el, C, hover, tipRows, txt, clamp, ramp, rgb, fw, onWidth } from './ui.js';

const VBI = 0.56;

export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'arch', type: 'seg', label: 'Gate architecture', options: [['sg', 'single gate (UTB SOI)'], ['dg', 'double gate (FinFET-like)']], value: 'sg' },
    { key: 'L', label: 'Gate length L', min: 8, max: 60, step: 1, value: 20, fmt: v => Math.round(v) + ' nm' },
    { key: 'tsi', label: 'Silicon body t<sub>Si</sub>', min: 2, max: 14, step: 0.25, value: 6, fmt: v => v.toFixed(2) + ' nm' },
    { key: 'tox', label: 'Oxide t<sub>ox</sub> (EOT)', min: 0.5, max: 3, step: 0.25, value: 1, fmt: v => v.toFixed(2) + ' nm' },
    { key: 'Vds', label: 'Drain voltage V<sub>DS</sub>', min: 0.05, max: 1.0, step: 0.01, value: 0.7, fmt: v => v.toFixed(2) + ' V' },
    { key: 'Vgs', label: 'Gate voltage V<sub>GS</sub>', min: -0.4, max: 0.4, step: 0.01, value: 0, fmt: v => (v >= 0 ? '+' : '') + v.toFixed(2) + ' V' },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'eb', label: 'Source barrier E<sub>b</sub>', unit: 'eV' }, { key: 'dibl', label: 'DIBL', unit: 'mV/V' },
    { key: 'ss', label: 'Subthreshold swing', unit: 'mV/dec' }, { key: 'lam', label: 'Natural length λ', unit: 'nm' },
    { key: 'ratio', label: 'L / λ', unit: 'aim for ≳ 5' }, { key: 'it', label: 'SOR iterations', unit: '' },
  ]);
  const host = sec.querySelector('[data-role=heat]'), cv = hiCanvas(host.querySelector('canvas'));
  const ecHost = sec.querySelector('[data-role=ec]'), swHost = sec.querySelector('[data-role=sweep]');
  const off = document.createElement('canvas');
  let G = null, key = '', warm = {}, S = null;

  const geomKey = s => [s.arch, s.L, s.tsi, s.tox].join('|');
  function grid(s) {
    const k = geomKey(s);
    if (k !== key) {
      key = k;
      const g = P.build({ L: Math.round(s.L), tsi: s.tsi, tox: s.tox, dg: s.arch === 'dg', Na: 1e17, nx: 81 });
      if (!G || g.ny !== G.ny || g.dg !== G.dg) warm = {}; // same grid shape → old solution is a good warm start
      G = g;
    }
    return G;
  }
  function run(slot, Vgs, Vds) {
    const r = P.solve(G, { Vgs, Vds, Vbi: VBI, tol: 1e-5, psi0: warm[slot] || null });
    warm[slot] = r.psi; return r;
  }

  function compute(final) {
    const s = ctl.state; grid(s);
    const main = run('main', s.Vgs, s.Vds);
    const bar = P.barrier(G, main.psi, VBI);
    const ref = run('ref', s.Vgs, 0.05), barRef = P.barrier(G, ref.psi, VBI);
    S = { psi: main.psi, bar, barRef, it: main.iters };
    const lam = P.naturalLength(s.tsi, s.tox, s.arch === 'dg');
    const upd = { eb: fix(bar.Eb, 3), lam: lam.toFixed(2), ratio: (s.L / lam).toFixed(1), it: String(main.iters) };
    if (final) {
      const hi = run('hi', s.Vgs, 0.7), lo = run('lo', s.Vgs, 0.05);
      const dibl = (P.barrier(G, lo.psi, VBI).Eb - P.barrier(G, hi.psi, VBI).Eb) / 0.65 * 1000;
      const up = run('ss', s.Vgs + 0.05, 0.05);
      const ss = 0.05 / Math.log10(P.offCurrentProxy(G, up.psi, VBI) / P.offCurrentProxy(G, lo.psi, VBI)) * 1000;
      const punch = P.barrier(G, hi.psi, VBI).Eb < 0.02;
      upd.dibl = punch ? '<span style="color:#ff9c73">punch-through</span>' : dibl.toFixed(0);
      upd.ss = ss > 0 && ss < 1000 ? ss.toFixed(1) : '> 300';
      S.dibl = dibl; sweep(s);
    }
    show(upd); drawEc(); paint();
  }

  function paint() {
    cv.resize(); const { ctx, w, h } = cv; if (!S) return;
    ctx.clearRect(0, 0, w, h);
    const { nx, ny, yNm, L } = G, psi = S.psi;
    let mn = 1e9, mx = -1e9; for (const v of psi) { if (v < mn) mn = v; if (v > mx) mx = v; }
    off.width = nx; off.height = ny; const oc = off.getContext('2d'), img = oc.createImageData(nx, ny);
    for (let k = 0; k < nx * ny; k++) { const c = ramp((psi[k] - mn) / (mx - mn || 1)); img.data[4 * k] = c[0]; img.data[4 * k + 1] = c[1]; img.data[4 * k + 2] = c[2]; img.data[4 * k + 3] = 255; }
    oc.putImageData(img, 0, 0);
    const depth = yNm[ny - 1], sdW = Math.max(w * 0.1, 40), pad = 26;
    const sc = Math.min((w - 2 * sdW - 20) / L, (h - 2 * pad) / depth);
    const X0 = (w - L * sc) / 2, Y0 = (h - depth * sc) / 2 + 4;
    const X = x => X0 + x * sc, Y = y => Y0 + y * sc;
    ctx.imageSmoothingEnabled = true; ctx.drawImage(off, X(0), Y(0), L * sc, depth * sc);
    // layer outlines
    const e = G.edges.map(j => yNm[j]);
    ctx.strokeStyle = 'rgba(232,236,241,.35)'; ctx.lineWidth = 1;
    for (const yy of e.slice(1, 3)) { ctx.beginPath(); ctx.moveTo(X(0), Y(yy)); ctx.lineTo(X(L), Y(yy)); ctx.stroke(); }
    // source / drain blocks beside the silicon
    ctx.fillStyle = 'rgba(57,135,229,.35)'; ctx.strokeStyle = '#3987e5';
    ctx.fillRect(X(0) - sdW, Y(e[1]), sdW, Y(e[2]) - Y(e[1])); ctx.strokeRect(X(0) - sdW, Y(e[1]), sdW, Y(e[2]) - Y(e[1]));
    ctx.fillRect(X(L), Y(e[1]), sdW, Y(e[2]) - Y(e[1])); ctx.strokeRect(X(L), Y(e[1]), sdW, Y(e[2]) - Y(e[1]));
    // gates
    ctx.fillStyle = '#f2b84b'; ctx.fillRect(X(0), Y(0) - 8, L * sc, 8);
    if (G.dg) ctx.fillRect(X(0), Y(depth), L * sc, 8); else { ctx.fillStyle = '#4b596d'; ctx.fillRect(X(0) - sdW, Y(depth), L * sc + 2 * sdW, 8); }
    // equipotentials (marching squares, every 0.05 V)
    ctx.strokeStyle = 'rgba(10,13,17,.55)'; ctx.lineWidth = 1;
    const xAt = i => X(i / (nx - 1) * L);
    for (let lev = Math.ceil(mn / 0.05) * 0.05; lev < mx; lev += 0.05) {
      ctx.beginPath();
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const a = psi[j * nx + i], b = psi[j * nx + i + 1], c = psi[(j + 1) * nx + i + 1], d = psi[(j + 1) * nx + i];
        const pts = [];
        const edge = (p, q, x1, y1, x2, y2) => { if ((p - lev) * (q - lev) < 0) { const t = (lev - p) / (q - p); pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]); } };
        const xa = xAt(i), xb = xAt(i + 1), ya = Y(yNm[j]), yb = Y(yNm[j + 1]);
        edge(a, b, xa, ya, xb, ya); edge(b, c, xb, ya, xb, yb); edge(d, c, xa, yb, xb, yb); edge(a, d, xa, ya, xa, yb);
        if (pts.length >= 2) { ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); if (pts.length === 4) { ctx.moveTo(pts[2][0], pts[2][1]); ctx.lineTo(pts[3][0], pts[3][1]); } }
      }
      ctx.stroke();
    }
    // leakiest path and barrier top
    const row = S.bar.row, yRow = Y(yNm[row]);
    ctx.setLineDash([5, 4]); ctx.strokeStyle = '#e8ecf1'; ctx.beginPath(); ctx.moveTo(X(0), yRow); ctx.lineTo(X(L), yRow); ctx.stroke(); ctx.setLineDash([]);
    let im = 0; for (let i = 1; i < nx; i++) if (S.bar.ec[i] > S.bar.ec[im]) im = i;
    ctx.beginPath(); ctx.arc(xAt(im), yRow, 5, 0, Math.PI * 2); ctx.fillStyle = '#e8ecf1'; ctx.fill();
    // labels
    ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillStyle = '#aab3c0'; ctx.textAlign = 'center';
    ctx.fillText('source', X(0) - sdW / 2, Y(e[2]) + 14); ctx.fillText('drain', X(L) + sdW / 2, Y(e[2]) + 14);
    ctx.fillStyle = '#f2b84b'; ctx.fillText(`gate  L = ${L} nm`, X(L / 2), Y(0) - 13);
    ctx.textAlign = 'left'; ctx.fillStyle = '#e8ecf1'; ctx.fillText('barrier top', xAt(im) + 8, yRow - 7);
    if (!G.dg) { ctx.fillStyle = '#8a94a3'; ctx.fillText('buried oxide', X(0) + 6, Y((e[2] + depth) / 2) + 4); }
    // colour key
    const kx = w - 210, ky = h - 18;
    for (let i = 0; i < 120; i++) { ctx.fillStyle = rgb(ramp(i / 119)); ctx.fillRect(kx + i, ky, 1, 8); }
    ctx.fillStyle = '#8a94a3'; ctx.textAlign = 'right'; ctx.fillText(`${mn.toFixed(2)} V`, kx - 4, ky + 8); ctx.textAlign = 'left'; ctx.fillText(`${mx.toFixed(2)} V`, kx + 124, ky + 8);
  }

  function drawEc() {
    const s = ctl.state, L = G.L;
    const f = frame(ecHost, { w: fw(ecHost), h: 260, m: { t: 14, r: 16, b: 40, l: 54 } });
    const all = [...S.bar.ec, ...S.barRef.ec];
    const lo = Math.min(...all, -0.1), hi = Math.max(...all, 0.1) + 0.08;
    const xs = linear(0, L, f.x0, f.x1), ys = linear(lo, hi, f.y0, f.y1);
    axes(f, xs, ys, { xt: niceTicks(0, L, 6), yt: niceTicks(lo, hi, 5), xl: 'position along the channel (nm)', yl: 'Ec − Ec,source (eV)', yf: v => +v.toFixed(2) });
    const xsN = Array.from(S.bar.ec, (_, i) => i / (G.nx - 1) * L);
    el('path', { d: path(xsN.map((x, i) => [xs(x), ys(S.barRef.ec[i])])), fill: 'none', stroke: C.muted, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, f.svg);
    el('path', { d: path(xsN.map((x, i) => [xs(x), ys(S.bar.ec[i])])), fill: 'none', stroke: C.s1, 'stroke-width': 2.4 }, f.svg);
    txt(f.svg, f.x0 + 6, f.y0 - 24, `dashed: V_DS = 0.05 V, barrier ${S.barRef.Eb.toFixed(3)} eV`, { fill: C.muted });
    txt(f.svg, f.x0 + 6, f.y0 - 10, `solid: V_DS = ${s.Vds.toFixed(2)} V, barrier ${S.bar.Eb.toFixed(3)} eV`, { fill: '#86b6ef' });
    hover(f, ecHost, xs, x => { const i = clamp(Math.round(x / L * (G.nx - 1)), 0, G.nx - 1); return tipRows(`x = ${x.toFixed(1)} nm`, [['Ec (V_DS = 0.05)', S.barRef.ec[i].toFixed(3) + ' eV'], [`Ec (V_DS = ${s.Vds.toFixed(2)})`, S.bar.ec[i].toFixed(3) + ' eV']]); });
  }

  // DIBL vs L sweep in a worker
  let worker = null, reqId = 0, sweepData = null;
  const LS = [10, 12, 15, 20, 25, 32, 40, 50, 60];
  function sweep(s) {
    const k = [s.tsi, s.tox].join('|');
    if (sweepData && sweepData.k === k) return drawSweep();
    try { worker ??= new Worker(new URL('./dibl-worker.js', import.meta.url), { type: 'module' }); }
    catch { return; }
    const id = ++reqId;
    swHost.dataset.busy = '1'; drawSweep();
    worker.onmessage = e => { if (e.data.id !== reqId) return; sweepData = { k, ...e.data }; delete swHost.dataset.busy; drawSweep(); };
    worker.postMessage({ id, tsi: s.tsi, tox: s.tox, Na: 1e17, Ls: LS });
  }
  function drawSweep() {
    const s = ctl.state;
    const f = frame(swHost, { w: fw(swHost), h: 260, m: { t: 14, r: 16, b: 40, l: 54 } });
    const xs = linear(8, 62, f.x0, f.x1), ys = log(1, 1000, f.y0, f.y1);
    axes(f, xs, ys, { xt: [10, 20, 30, 40, 50, 60], yt: [1, 10, 100, 1000], xl: 'gate length L (nm)', yl: 'DIBL (mV/V)', yf: v => String(v) });
    if (!sweepData || swHost.dataset.busy) { txt(f.svg, (f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2, 'solving 36 Poisson problems in a background worker…', { 'text-anchor': 'middle', fill: C.muted }); return; }
    for (const [arr, col, name] of [[sweepData.sg, C.s1, 'single gate'], [sweepData.dg, C.s2, 'double gate']]) {
      const ok = arr.filter(r => r[2] && r[1] > 0.5);
      el('path', { d: path(ok.map(([L, d]) => [xs(L), ys(clamp(d, 1, 1000))])), fill: 'none', stroke: col, 'stroke-width': 2 }, f.svg);
      ok.forEach(([L, d]) => el('circle', { cx: xs(L), cy: ys(clamp(d, 1, 1000)), r: 3.5, fill: col }, f.svg));
    }
    [[C.s1, 'single gate'], [C.s2, 'double gate']].forEach(([col, name], j) => { const ly = f.y1 + 30 + j * 15; el('line', { x1: f.x1 - 110, x2: f.x1 - 94, y1: ly - 4, y2: ly - 4, stroke: col, 'stroke-width': 2 }, f.svg); txt(f.svg, f.x1 - 88, ly, name, { fill: col }); });
    el('line', { x1: f.x0, x2: f.x1, y1: ys(100), y2: ys(100), stroke: C.muted, 'stroke-dasharray': '3 4' }, f.svg);
    txt(f.svg, f.x0 + 4, ys(100) + 14, '~100 mV/V: practical limit', { fill: C.muted });
    if (S.dibl > 0.5) el('circle', { cx: xs(s.L), cy: ys(clamp(S.dibl, 1, 1000)), r: 6.5, fill: '#f2b84b', stroke: C.surface, 'stroke-width': 2 }, f.svg);
    txt(f.svg, f.x1 - 4, f.y1 + 12, `t_Si = ${s.tsi} nm, t_ox = ${s.tox} nm`, { 'text-anchor': 'end', fill: C.muted });
  }

  experiments(sec.querySelector('.lab-exp'), [
    { label: 'Shrink the gate from 40 nm to 12 nm', run: api => api.animate({ arch: 'sg', L: 40, Vds: 0.7 }, 500, () => setTimeout(() => api.animate({ L: 12 }, 2200), 300)), note: 'As L approaches a few λ, the drain\'s field reaches under the gate (watch the equipotentials bend toward the source) and pulls the barrier down. The gate is losing control: that is short-channel effect and DIBL.' },
    { label: 'Add a second gate', set: { arch: 'dg' }, note: 'Gating the body from both sides shrinks λ by √2 and cuts DIBL several-fold at the same L. That is the FinFET\'s whole argument (Hisamoto, Hu and colleagues, 1998–2000); gate-all-around nanosheets extend it to four sides.' },
    { label: 'Thin the body to 3 nm', set: { tsi: 3 }, note: 'λ scales with √t<sub>Si</sub>, so thinner bodies tolerate shorter gates. Nanosheets are ~5 nm thick for this reason; 2D semiconductors like MoS₂ (0.65 nm) are the extreme.' },
    { label: 'Thicken the oxide to 3 nm', set: { tox: 3 }, note: 'A thick oxide weakens the gate\'s grip relative to the drain\'s. This is why high-k dielectrics mattered for electrostatics as well as leakage: they keep the equivalent oxide thin.' },
    { label: 'Sweep V<sub>DS</sub> from 0.05 V to 1 V', run: api => { api.set('Vds', 0.05); setTimeout(() => api.animate({ Vds: 1.0 }, 2600), 250); }, note: 'The barrier drops almost linearly with drain voltage — DIBL is its slope. In a circuit this makes the threshold voltage depend on V<sub>DD</sub> and raises off-state leakage.' },
  ], ctl);

  ctl.on((k, final) => compute(final));
  compute(true);
  onWidth([ecHost, swHost], () => { drawEc(); drawSweep(); });
  new ResizeObserver(() => paint()).observe(host);
}
