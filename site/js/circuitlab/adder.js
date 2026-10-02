// Lab 02 — event-driven 8-bit ripple-carry adder with a logic-analyser view.
import * as LG from '../physics/logic.js';
import { ERAS, tauPs } from './gates.js';
import { panel, tiles, experiments, hiCanvas, loop, frame, axes, linear, log, path, el, C, txt, fw, onWidth, hover, tipRows, clamp, reduceMotion } from '../physlab/ui.js';

const N = 8;
const at = (w, t) => { let v = w[0][1]; for (const [tt, vv] of w) { if (tt <= t) v = vv; else break; } return v; };
export function glitches(r) {
  const sigs = [...r.S, ...r.C.slice(1)];
  return sigs.reduce((s, w) => s + (w.length - 1) - (w[w.length - 1][1] !== w[0][1] ? 1 : 0), 0);
}

export class AdderView {
  constructor(canvas) { this.c = hiCanvas(canvas); this.r = null; }
  set(r, a, b, aOld, bOld, tau) { Object.assign(this, { r, a, b, aOld, bOld, tau }); this.tEnd = Math.max(r.settle, 1) * 1.12 + 4; }
  draw(t) {
    const { c, r } = this; c.resize(); const { ctx, w, h } = c; ctx.clearRect(0, 0, w, h); if (!r) return;
    const narrow = w < 620, padX = narrow ? 10 : 24, top = 44;
    const bw = (w - 2 * padX) / N, boxW = Math.min(bw * 0.7, 92), boxH = narrow ? 44 : 54, yBox = top + 46;
    const X = i => padX + (N - 1 - i + 0.5) * bw;                    // bit 7 on the left
    const fs = narrow ? 10 : 12;
    const ON = '#f2b84b', OFF = '#56739e';
    ctx.font = `600 ${fs}px "IBM Plex Mono", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // operands
    for (let i = 0; i < N; i++) {
      const x = X(i), ai = (this.a >> i) & 1, bi = (this.b >> i) & 1;
      for (const [k, v, dx] of [['A', ai, -boxW * 0.22], ['B', bi, boxW * 0.22]]) {
        ctx.fillStyle = v ? ON : '#2a3442'; ctx.fillRect(x + dx - 9, top, 18, 18);
        ctx.fillStyle = v ? '#1a1206' : '#8a94a3'; ctx.fillText(String(v), x + dx, top + 9.5);
        ctx.strokeStyle = v ? ON : OFF; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + dx, top + 18); ctx.lineTo(x + dx, yBox); ctx.stroke();
        if (i === N - 1) { ctx.fillStyle = '#8a94a3'; ctx.fillText(k, x + dx, top - 9); }
      }
    }
    // carries (between boxes) and boxes
    for (let i = 0; i <= N; i++) {
      const v = at(r.C[i], t), w0 = r.C[i];
      const lastChange = w0.length > 1 ? Math.max(...w0.slice(1).map(e => e[0]).filter(x => x <= t), -1e9) : -1e9;
      const fresh = clamp(1 - (t - lastChange) / (this.tEnd * 0.08), 0, 1);
      const xa = i === 0 ? X(0) + boxW / 2 : X(i - 1) - boxW / 2, xb = i === 0 ? X(0) + bw / 2 - 2 : (i === N ? padX : X(i) + boxW / 2);
      const y = yBox + boxH / 2;
      ctx.strokeStyle = v ? ON : OFF; ctx.lineWidth = 2.5 + 4 * fresh;
      if (fresh > 0) { ctx.shadowColor = ON; ctx.shadowBlur = 16 * fresh; }
      ctx.beginPath(); ctx.moveTo(xb, y); ctx.lineTo(xa, y); ctx.stroke(); ctx.shadowBlur = 0;
      if (!narrow || i % 2 === 0) { ctx.fillStyle = v ? '#ffd27a' : '#8a94a3'; ctx.font = `600 ${fs - 1}px "IBM Plex Mono", monospace`; ctx.fillText(`C${i}`, (xa + xb) / 2, y - 10); }
    }
    for (let i = 0; i < N; i++) {
      const x = X(i), s = at(r.S[i], t), fin = r.S[i][r.S[i].length - 1][1];
      ctx.fillStyle = '#1b2230'; ctx.strokeStyle = '#4c6a96'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(x - boxW / 2, yBox, boxW, boxH, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c3cede'; ctx.font = `600 ${fs}px "IBM Plex Sans", sans-serif`; ctx.fillText(narrow ? `${i}` : `FA ${i}`, x, yBox + boxH / 2);
      // sum output
      const ys = yBox + boxH + 30, wrong = s !== fin;
      ctx.strokeStyle = s ? ON : OFF; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, yBox + boxH); ctx.lineTo(x, ys - 10); ctx.stroke();
      ctx.fillStyle = s ? ON : '#2a3442'; ctx.fillRect(x - 10, ys - 10, 20, 20);
      if (wrong) { ctx.strokeStyle = '#ff5d5d'; ctx.lineWidth = 2; ctx.strokeRect(x - 12, ys - 12, 24, 24); }
      ctx.fillStyle = s ? '#1a1206' : '#8a94a3'; ctx.font = `700 ${fs}px "IBM Plex Mono", monospace`; ctx.fillText(String(s), x, ys + 0.5);
    }
    // carry out / sum readout
    const cur = r.S.reduce((acc, wv, i) => acc + (at(wv, t) << i), 0) + (at(r.C[N], t) << N), fin = r.sum;
    const yR = yBox + boxH + 58;
    ctx.textAlign = 'left'; ctx.font = `600 ${fs + 1}px "IBM Plex Mono", monospace`;
    ctx.fillStyle = '#aab3c0'; ctx.fillText(`${this.a} + ${this.b} =`, padX, yR);
    const tw = ctx.measureText(`${this.a} + ${this.b} = `).width;
    ctx.fillStyle = cur === fin ? '#7fe0c8' : '#ff8a7a'; ctx.fillText(`${cur}${cur === fin ? (t >= r.settle ? '  ✓ settled' : '') : '  (not yet)'}`, padX + tw, yR);
    ctx.textAlign = 'right'; ctx.fillStyle = '#8a94a3';
    ctx.fillText(`t = ${t.toFixed(1)} τ = ${(t * this.tau).toFixed(1)} ps`, w - padX, yR);
    // logic analyser: S7..S0 and the carry chain
    const la0 = yR + 18, la1 = h - 22, rows = narrow ? [...r.S.map((wv, i) => [`S${i}`, wv])].reverse() : [...r.S.map((wv, i) => [`S${i}`, wv]).reverse(), ['C8', r.C[N]]];
    const rh = (la1 - la0) / rows.length, lx0 = padX + 30, lx1 = w - padX, T = this.tEnd;
    const TX = tt => lx0 + clamp((tt + 2) / (T + 2), 0, 1) * (lx1 - lx0);
    ctx.fillStyle = 'rgba(10,13,17,.55)'; ctx.fillRect(lx0, la0 - 2, lx1 - lx0, la1 - la0 + 4);
    rows.forEach(([name, wv], k) => {
      const y0 = la0 + k * rh, yH = y0 + rh * 0.2, yL = y0 + rh * 0.8;
      ctx.fillStyle = '#8a94a3'; ctx.textAlign = 'right'; ctx.font = `500 ${Math.min(fs, rh * 0.8)}px "IBM Plex Mono", monospace`; ctx.fillText(name, lx0 - 6, (yH + yL) / 2);
      ctx.beginPath(); let v = wv[0][1]; ctx.moveTo(TX(-2), v ? yH : yL);
      for (const [tt, vv] of wv.slice(1)) { if (tt > t) break; ctx.lineTo(TX(tt), v ? yH : yL); ctx.lineTo(TX(tt), vv ? yH : yL); v = vv; }
      ctx.lineTo(TX(Math.min(t, T)), v ? yH : yL);
      ctx.strokeStyle = name[0] === 'C' ? '#7fd3d0' : ON; ctx.lineWidth = 1.6; ctx.stroke();
      const n = wv.slice(1).filter(e => e[0] <= t).length, fin2 = wv[wv.length - 1][1] !== wv[0][1] ? 1 : 0;
      if (n > fin2 && n > 1 || (fin2 === 0 && n > 0)) { ctx.fillStyle = '#ff8a7a'; ctx.textAlign = 'left'; ctx.fillText('glitch', TX(Math.min(t, T)) + 4 > lx1 - 40 ? lx1 - 40 : TX(Math.min(t, T)) + 4, (yH + yL) / 2); }
    });
    ctx.strokeStyle = '#e8ecf1'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(TX(t), la0 - 4); ctx.lineTo(TX(t), la1 + 4); ctx.stroke();
    ctx.setLineDash([3, 4]); ctx.strokeStyle = '#7fe0c8'; ctx.beginPath(); ctx.moveTo(TX(r.settle), la0 - 4); ctx.lineTo(TX(r.settle), la1 + 4); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#8a94a3'; ctx.textAlign = 'left'; ctx.font = `500 ${fs - 1}px "IBM Plex Mono", monospace`;
    ctx.fillText('inputs change at t = 0', TX(0) + 4, la1 + 12);
    ctx.textAlign = 'right'; ctx.fillStyle = '#7fe0c8'; ctx.fillText('settled', TX(r.settle) - 4, la1 + 12);
    ctx.textAlign = 'left'; ctx.fillStyle = '#e8ecf1'; ctx.font = `600 ${fs}px "IBM Plex Sans", sans-serif`;
    ctx.fillText('carry ripples right → left', padX, 18);
  }
}

export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'era', type: 'seg', label: 'Transistors', options: ERAS, value: '2025_2nm_gaa' },
    { key: 'speed', label: 'Slow motion', min: 1, max: 6, step: 0.1, value: 3, fmt: v => `${v.toFixed(1)} s per add` },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'sum', label: 'Result', unit: 'A + B' }, { key: 'settle', label: 'Settling time', unit: 'τ (gate delays)' },
    { key: 'ps', label: 'Settling time', unit: 'ps' }, { key: 'tr', label: 'Output transitions', unit: 'each costs C·V²' },
    { key: 'gl', label: 'Glitches', unit: 'transitions that are undone' }, { key: 'worst', label: '8-bit worst case', unit: 'ps (carry through all 8)' },
  ]);
  const bitsHost = sec.querySelector('#caBits');
  bitsHost.innerHTML = ['A', 'B'].map(k => `<div class="ca-row"><div class="pl-label">Operand ${k} <output id="ca${k}"></output></div><div class="ca-byte" data-op="${k}">${[7, 6, 5, 4, 3, 2, 1, 0].map(i => `<button type="button" data-bit="${i}" aria-label="${k} bit ${i}" aria-pressed="false">${i}</button>`).join('')}</div></div>`).join('');
  const view = new AdderView(sec.querySelector('[data-role=adder] canvas'));
  const scHost = sec.querySelector('[data-role=scaling]'), cnHost = sec.querySelector('[data-role=count]');
  let A = 0, B = 0, prevA = 0, prevB = 0, t = 0, r = null;
  const tau = {}; ERAS.forEach(([k]) => { tau[k] = tauPs(k); });

  function run(aOld, bOld, a, b) {
    prevA = aOld; prevB = bOld; A = a; B = b;
    r = LG.rippleAdd(aOld, bOld, a, b, N);
    view.set(r, a, b, aOld, bOld, tau[ctl.state.era]); t = -2;
    bitsHost.querySelectorAll('.ca-byte').forEach(row => { const v = row.dataset.op === 'A' ? A : B; row.querySelectorAll('button').forEach(bt => bt.setAttribute('aria-pressed', String(!!((v >> +bt.dataset.bit) & 1)))); });
    sec.querySelector('#caA').textContent = A; sec.querySelector('#caB').textContent = B;
    const tp = tau[ctl.state.era];
    show({ sum: `${A} + ${B} = ${r.sum}`, settle: r.settle.toFixed(1), ps: (r.settle * tp).toFixed(1), tr: r.transitions, gl: `${glitches(r)}${r.transitions ? ` <small>(${Math.round(100 * glitches(r) / r.transitions)} %)</small>` : ''}`, worst: (LG.rippleWorst(N) * tp).toFixed(1) });
  }
  bitsHost.addEventListener('click', e => {
    const bt = e.target.closest('[data-bit]'); if (!bt) return;
    const op = bt.closest('[data-op]').dataset.op, m = 1 << +bt.dataset.bit;
    run(A, B, op === 'A' ? A ^ m : A, op === 'B' ? B ^ m : B);
  });
  sec.querySelector('#caGo').addEventListener('click', () => run(prevA, prevB, A, B));
  sec.querySelector('#caRand').addEventListener('click', () => run(A, B, Math.random() * 256 | 0, Math.random() * 256 | 0));
  ctl.on(k => { if (k === 'era') { run(prevA, prevB, A, B); drawScaling(); } });
  loop(sec.querySelector('[data-role=adder]'), dt => {
    if (!r) return;
    const span = view.tEnd + 2; t = Math.min(t + dt * span / (reduceMotion ? 0.5 : ctl.state.speed), view.tEnd);
    view.draw(t);
  });

  function drawScaling() {
    const tp = tau[ctl.state.era], Ns = [4, 8, 16, 32, 64];
    const f = frame(scHost, { w: fw(scHost), h: 260, m: { t: 14, r: 16, b: 40, l: 54 } });
    const rip = Ns.map(n => LG.rippleWorst(n) * tp), ks = Ns.map(n => LG.koggeStoneDelay(n) * tp);
    const ymax = Math.max(...rip) * 1.1;
    const xs = log(4, 64, f.x0, f.x1), ys = linear(0, ymax, f.y0, f.y1);
    const step = ymax > 2000 ? 1000 : ymax > 800 ? 200 : ymax > 300 ? 100 : ymax > 100 ? 50 : ymax > 40 ? 10 : 5;
    const yt = []; for (let v = 0; v <= ymax; v += step) yt.push(v);
    axes(f, xs, ys, { xt: Ns, yt, xl: 'word width (bits)', yl: 'worst-case delay (ps)', xf: String, yf: String });
    el('path', { d: path(Ns.map((n, i) => [xs(n), ys(rip[i])])), fill: 'none', stroke: '#f2b84b', 'stroke-width': 2.4 }, f.svg);
    el('path', { d: path(Ns.map((n, i) => [xs(n), ys(ks[i])])), fill: 'none', stroke: C.s1, 'stroke-width': 2.4 }, f.svg);
    Ns.forEach((n, i) => { el('circle', { cx: xs(n), cy: ys(rip[i]), r: 3.5, fill: '#f2b84b' }, f.svg); el('circle', { cx: xs(n), cy: ys(ks[i]), r: 3.5, fill: C.s1 }, f.svg); });
    txt(f.svg, xs(32), ys(rip[3]) - 10, 'ripple-carry', { fill: '#ffd27a', 'text-anchor': 'end' });
    txt(f.svg, xs(64) - 4, ys(ks[4]) - 10, 'Kogge–Stone', { fill: '#86b6ef', 'text-anchor': 'end' });
    hover(f, scHost, xs, x => { const n = Ns.reduce((a, b) => Math.abs(Math.log(b / x)) < Math.abs(Math.log(a / x)) ? b : a); const i = Ns.indexOf(n);
      return tipRows(`${n}-bit adder`, [['ripple', rip[i].toFixed(1) + ' ps'], ['Kogge–Stone', ks[i].toFixed(1) + ' ps'], ['speed-up', (rip[i] / ks[i]).toFixed(1) + '×']]); });
    // transistor counts
    const g = frame(cnHost, { w: fw(cnHost), h: 260, m: { t: 14, r: 16, b: 40, l: 54 } });
    const rc = Ns.map(LG.rippleCount), kc = Ns.map(LG.koggeStoneCount);
    const xs2 = log(4, 64, g.x0, g.x1), ys2 = log(50, 10000, g.y0, g.y1);
    axes(g, xs2, ys2, { xt: Ns, yt: [100, 1000, 10000], xl: 'word width (bits)', yl: 'transistors', xf: String, yf: v => v >= 1000 ? (v / 1000) + 'k' : String(v) });
    el('path', { d: path(Ns.map((n, i) => [xs2(n), ys2(rc[i])])), fill: 'none', stroke: '#f2b84b', 'stroke-width': 2.4 }, g.svg);
    el('path', { d: path(Ns.map((n, i) => [xs2(n), ys2(kc[i])])), fill: 'none', stroke: C.s1, 'stroke-width': 2.4 }, g.svg);
    Ns.forEach((n, i) => { el('circle', { cx: xs2(n), cy: ys2(rc[i]), r: 3.5, fill: '#f2b84b' }, g.svg); el('circle', { cx: xs2(n), cy: ys2(kc[i]), r: 3.5, fill: C.s1 }, g.svg); });
    el('line', { x1: g.x0, x2: g.x1, y1: ys2(2300), y2: ys2(2300), stroke: C.s3, 'stroke-dasharray': '4 4' }, g.svg);
    txt(g.svg, g.x0 + 6, ys2(2300) - 6, 'the whole Intel 4004: ~2,300', { fill: '#7fd3d0' });
    hover(g, cnHost, xs2, x => { const n = Ns.reduce((a, b) => Math.abs(Math.log(b / x)) < Math.abs(Math.log(a / x)) ? b : a); const i = Ns.indexOf(n);
      return tipRows(`${n}-bit adder`, [['ripple', rc[i].toLocaleString()], ['Kogge–Stone', kc[i].toLocaleString()]]); });
  }

  experiments(sec.querySelector('.lab-exp'), [
    { label: 'Worst case: 255 + 1', run: () => run(0, 0, 255, 1), note: 'Every bit generates or propagates a carry, so the carry must ripple through all eight stages before the top bits are right. Watch the sum bits light up as soon as A ⊕ B arrives and go dark again as the carry passes: 14 of the 22 transitions are glitches that burn energy for nothing.' },
    { label: 'No carries at all: 170 + 85', run: () => run(0, 0, 170, 85), note: '10101010 + 01010101: no bit position has two 1s, so no carry is ever generated. Every sum bit settles after just two XOR delays, whatever the word width.' },
    { label: 'Change one bit of a settled sum', run: () => run(255, 1, 255, 0), note: 'Starting from the settled 255 + 1, clearing B₀ kills the carry chain: the carries fall one stage at a time and the result walks back down to 255. A single input bit can still disturb the whole word.' },
    { label: 'Same adder, 180 nm transistors', run: api => { api.set('era', '1999_180nm'); run(0, 0, 255, 1); }, note: 'The logic and the number of gate delays are identical; only τ changes. At 180 nm the worst case takes about 270 ps, a large slice of a 600 MHz processor’s 1.7 ns clock cycle, which is why such chips used carry-lookahead adders. With 2 nm-class transistors the same ripple adder settles in about 30 ps.' },
  ], ctl);
  run(0, 0, 255, 1); drawScaling();
  onWidth([scHost, cnHost], drawScaling);
}

/** Record mode: 0 + 0 → 255 + 1, then 255 + 1 → 170 + 85. */
export function record(stage, next) {
  stage.innerHTML = `<div class="rec-head"><span class="eyebrow">Event-driven simulation</span><h2>An 8-bit adder: the carry ripples</h2><span class="rec-state" id="rs"></span></div><canvas></canvas>
    <div class="rec-foot"><span style="color:#f2b84b">— logic 1</span><span style="color:#56739e">— logic 0</span><span style="color:#ff8a7a">□ wrong for now</span><span class="rec-brand">Transistor Odyssey · Circuit Lab</span></div>`;
  const v = new AdderView(stage.querySelector('canvas')), tp = tauPs('2025_2nm_gaa');
  const cases = [[0, 0, 255, 1], [255, 1, 170, 85]]; let cur = -1;
  return (n = 144) => {
    const k = next(), half = n / 2, ci = Math.floor(k / half) % 2;
    if (ci !== cur) { cur = ci; const c = cases[ci]; v.set(LG.rippleAdd(...c, N), c[2], c[3], c[0], c[1], tp); }
    const f = (k % half) / (half * 0.82), t = -2 + Math.min(f, 1) * (v.tEnd + 2);
    v.draw(t);
    stage.querySelector('#rs').textContent = `${cases[ci][2]} + ${cases[ci][3]}`;
    return k + 1;
  };
}
