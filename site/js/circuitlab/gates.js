// Lab 01 — static CMOS gate builder with a switch-level simulator and logical effort.
import * as LG from '../physics/logic.js';
import * as INV from '../physics/inverter.js';
import { DATA } from '../data.js';
import { panel, tiles, experiments, hiCanvas, loop, frame, axes, linear, el, C, txt, fw, onWidth, tipRows, tooltip, svgPoint, clamp, reduceMotion } from '../physlab/ui.js';

export const ERAS = [['1999_180nm', '180 nm'], ['2007_45nm_hkmg', '45 nm'], ['2011_22nm_finfet', '22 nm FinFET'], ['2025_2nm_gaa', '2 nm GAA']];
const BETA0 = { '1999_180nm': 0.5, '2007_45nm_hkmg': 0.6, '2011_22nm_finfet': 0.8, '2025_2nm_gaa': 0.9 };
const ORDER = ['inv', 'nand2', 'nor2', 'nand3', 'nor3', 'aoi21', 'oai21', 'aoi22', 'xor2', 'maj'];
const SHORT = { inv: 'INV', nand2: 'NAND2', nor2: 'NOR2', nand3: 'NAND3', nor3: 'NOR3', aoi21: 'AOI21', oai21: 'OAI21', aoi22: 'AOI22', xor2: 'XOR2', maj: 'Carry' };
/** τ in ps for an era: a fan-out-of-4 inverter is 5τ (g = 1, h = 4, p = 1). */
export const tauPs = key => INV.metrics(DATA.presets[key], DATA.presets[key].VDD, BETA0[key], 4).tp_ps / 5;

const COL = { one: '#f2b84b', zero: '#56739e', x: '#ff5d5d', n: '#5aa2ff', p: '#ff8a55' };
const nodeCol = v => v === '1' ? COL.one : v === '0' ? COL.zero : COL.x;
const pretty = g => g[0] === '!' ? g.slice(1) + '̅' : g;   // Ā with a combining overline

// ---------------------------------------------------------------- layout (mirrors LG.netlist order)
function measure(e) {
  if (typeof e === 'string') return { w: 1, h: 1 };
  const k = e.slice(1).map(measure);
  return e[0] === 's' ? { w: Math.max(...k.map(q => q.w)), h: k.reduce((s, q) => s + q.h, 0) + 0.25 * (k.length - 1) }
    : { w: k.reduce((s, q) => s + q.w, 0) + 0.35 * (k.length - 1), h: Math.max(...k.map(q => q.h)) };
}
export function layout(key) {
  const g = LG.GATES[key], T = [], W = []; let count = 0;
  const place = (e, x0, y0, typ, top, bot) => {
    const m = measure(e);
    if (typeof e === 'string') {
      const cx = x0 + 0.5;
      T.push({ x: cx, y: y0 + 0.5, type: typ, g: e });
      W.push({ node: top, pts: [[cx, y0], [cx, y0 + 0.22]] }, { node: bot, pts: [[cx, y0 + 0.78], [cx, y0 + 1]] });
      return { top: [cx, y0], bot: [cx, y0 + 1] };
    }
    const kids = e.slice(1);
    if (e[0] === 's') {
      const nodes = [top]; for (let i = 0; i < kids.length - 1; i++) nodes.push('n' + (++count)); nodes.push(bot);
      let y = y0, prev = null, first = null;
      kids.forEach((c, i) => {
        const cm = measure(c), t = place(c, x0 + (m.w - cm.w) / 2, y, typ, nodes[i], nodes[i + 1]);
        if (prev) W.push({ node: nodes[i], pts: [prev, t.top] });
        first ??= t.top; prev = t.bot; y += cm.h + 0.25;
      });
      return { top: first, bot: prev };
    }
    let x = x0; const tops = [], bots = [];
    for (const c of kids) {
      const cm = measure(c), t = place(c, x, y0, typ, top, bot);
      tops.push(t.top); bots.push(t.bot);
      if (t.bot[1] < y0 + m.h) W.push({ node: bot, pts: [t.bot, [t.bot[0], y0 + m.h]] });
      x += cm.w + 0.35;
    }
    const cx = x0 + m.w / 2;
    W.push({ node: top, pts: [[Math.min(tops[0][0], cx), y0], [Math.max(tops[tops.length - 1][0], cx), y0]] });
    W.push({ node: bot, pts: [[Math.min(bots[0][0], cx), y0 + m.h], [Math.max(bots[bots.length - 1][0], cx), y0 + m.h]] });
    return { top: [cx, y0], bot: [cx, y0 + m.h] };
  };
  const pu = LG.dual(g.pd), mu = measure(pu), md = measure(g.pd);
  const comps = [...new Set(JSON.stringify(g.pd).match(/"![A-D]"/g) || [])].map(s => s.slice(2, -1)).sort();
  const left = comps.length ? 1.9 : 0.9, wid = Math.max(mu.w, md.w), Xc = left + wid / 2;
  const yU = 0.55, tu = place(pu, Xc - mu.w / 2, yU, 'p', 'vdd', 'y');
  const yO = yU + mu.h + 0.5, yD = yO + 0.5, td = place(g.pd, Xc - md.w / 2, yD, 'n', 'y', 'gnd');
  const yG = yD + md.h + 0.45;
  W.push({ node: 'vdd', pts: [[Xc, 0], tu.top] }, { node: 'y', pts: [tu.bot, [Xc, yO], td.top] }, { node: 'gnd', pts: [td.bot, [Xc, yG]] });
  W.push({ node: 'y', pts: [[Xc, yO], [left + wid + 0.6, yO]] });
  // complement inverters (drawn as symbols; their transistors follow in netlist order: p then n)
  const aux = comps.map((x, i) => ({ x, cx: 0.75, cy: yO - 0.55 + i * 1.1 }));
  for (const a of aux) T.push({ aux: true, type: 'p', g: a.x }, { aux: true, type: 'n', g: a.x });
  return { T, W, aux, width: left + wid + 1.5, height: yG, yO, xOut: left + wid + 0.6, rails: [0, yG], Xc, left, wid };
}

// ---------------------------------------------------------------- renderer
export class GateView {
  constructor(canvas) { this.c = hiCanvas(canvas); this.dots = []; this.flow = 0; this.vals = null; this.prevY = null; this.tSwitch = -9; }
  setGate(key) { this.key = key; this.net = LG.netlist(key); this.L = layout(key); this.vals = null; this.dots = []; }
  setInputs(inputs, t) {
    const prev = this.vals;
    this.vals = LG.simulate(this.net, inputs, prev);
    this.inputs = inputs;
    const parent = Object.fromEntries(this.net.nodes.map(n => [n, n]));
    const find = n => { while (parent[n] !== n) n = parent[n] = parent[parent[n]]; return n; };
    this.on = new Set(LG.onTransistors(this.net, this.vals));
    for (const i of this.on) { const tr = this.net.transistors[i], a = find(tr.a), b = find(tr.b); if (a !== b) parent[a] = b; }
    const src = new Set(['vdd', 'gnd', ...Object.keys(inputs)].map(find));
    this.driven = Object.fromEntries(this.net.nodes.map(n => [n, src.has(find(n))]));
    const rail = this.vals.y === '1' ? 'vdd' : 'gnd';
    this.path = new Set([...this.on].filter(i => { const tr = this.net.transistors[i]; return !tr.aux && find(tr.a) === find(rail) && find(tr.a) === find('y'); }));
    if (prev && prev.y !== this.vals.y) { this.tSwitch = t; this.prevY = prev.y; }
  }
  draw(t, opts = {}) {
    const { c } = this; c.resize(); const { ctx, w, h } = c; ctx.clearRect(0, 0, w, h);
    const L = this.L, V = this.vals; if (!L || !V) return;
    const pad = { l: 18, r: 18, t: 30, b: 26 };
    const u = Math.min((w - pad.l - pad.r) / L.width, (h - pad.t - pad.b) / L.height, opts.maxU || 92);
    const ox = pad.l + (w - pad.l - pad.r - L.width * u) / 2, oy = pad.t + (h - pad.t - pad.b - L.height * u) / 2;
    const X = x => ox + x * u, Y = y => oy + y * u;
    const since = t - this.tSwitch, surge = clamp(1 - since / 1.6, 0, 1);
    // node value while the output is charging: blend old → new over the first 0.6 s
    const ny = n => (n === 'y' && since < 0.6 && this.prevY) ? (since < 0.3 ? this.prevY : V.y) : V[n];
    // rails
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(3, u * 0.07);
    ctx.strokeStyle = COL.one; ctx.beginPath(); ctx.moveTo(X(L.Xc - L.wid / 2 - 0.4), Y(0)); ctx.lineTo(X(L.Xc + L.wid / 2 + 0.4), Y(0)); ctx.stroke();
    ctx.strokeStyle = COL.zero; ctx.beginPath(); ctx.moveTo(X(L.Xc - L.wid / 2 - 0.4), Y(L.rails[1])); ctx.lineTo(X(L.Xc + L.wid / 2 + 0.4), Y(L.rails[1])); ctx.stroke();
    const fs = Math.round(clamp(u * 0.2, 11, 15));
    ctx.font = `600 ${fs}px "IBM Plex Mono", monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd27a'; ctx.fillText('V_DD', X(L.Xc + L.wid / 2 + 0.5), Y(0));
    ctx.fillStyle = '#9fb3d1'; ctx.fillText('ground', X(L.Xc + L.wid / 2 + 0.5), Y(L.rails[1]));
    // wires
    ctx.lineWidth = Math.max(2, u * 0.045);
    for (const wv of L.W) {
      const v = ny(wv.node), drv = this.driven[wv.node];
      ctx.strokeStyle = !drv && v === 'X' ? '#6b7480' : nodeCol(v); ctx.globalAlpha = drv ? 1 : 0.5; ctx.setLineDash(drv ? [] : [5, 5]);
      ctx.beginPath(); wv.pts.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.setLineDash([]);
    // output node + label
    const yv = ny('y');
    ctx.fillStyle = nodeCol(yv); ctx.beginPath(); ctx.arc(X(L.Xc), Y(L.yO), Math.max(4, u * 0.07), 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(X(L.xOut), Y(L.yO), Math.max(5, u * 0.09), 0, 7); ctx.fill();
    ctx.font = `700 ${Math.round(fs * 1.25)}px "IBM Plex Mono", monospace`; ctx.fillStyle = '#e8ecf1';
    ctx.fillText(`Y = ${V.y}`, X(L.xOut) + u * 0.18, Y(L.yO));
    // transistors
    this.net.transistors.forEach((tr, i) => {
      const P = L.T[i]; if (!P || P.aux) return;
      const on = this.on.has(i), cx = X(P.x), cy = Y(P.y), chw = Math.max(8, u * 0.2), chh = u * 0.56;
      const col = tr.type === 'n' ? COL.n : COL.p;
      ctx.fillStyle = on ? col : 'rgba(138,148,163,.12)'; ctx.globalAlpha = on ? 0.92 : 1;
      ctx.fillRect(cx - chw / 2, cy - chh / 2, chw, chh); ctx.globalAlpha = 1;
      ctx.strokeStyle = on ? col : '#3a4452'; ctx.lineWidth = 1.5; ctx.strokeRect(cx - chw / 2 + .5, cy - chh / 2 + .5, chw - 1, chh - 1);
      // gate plate, bubble for pFETs, input label
      const gx = cx - chw / 2 - u * 0.1, gv = tr.g[0] === '!' ? V[tr.g] : V[tr.g];
      ctx.fillStyle = nodeCol(gv); ctx.fillRect(gx - u * 0.05, cy - chh / 2 + 2, u * 0.05, chh - 4);
      if (tr.type === 'p') { ctx.strokeStyle = nodeCol(gv); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(gx - u * 0.1, cy, u * 0.045, 0, 7); ctx.stroke(); }
      ctx.font = `600 ${fs}px "IBM Plex Mono", monospace`; ctx.textAlign = 'right'; ctx.fillStyle = gv === '1' ? '#ffd27a' : '#c3cede';
      ctx.fillText(pretty(tr.g), gx - u * (tr.type === 'p' ? 0.18 : 0.1), cy);
      // current during a switching event: dots flowing down the conducting path
      if (this.path.has(i) && surge > 0) {
        ctx.fillStyle = tr.type === 'n' ? '#bcd8ff' : '#ffd0b8';
        for (let k = 0; k < 4; k++) {
          const f = ((t * 1.4 + k / 4 + i * 0.13) % 1);
          ctx.globalAlpha = surge; ctx.beginPath(); ctx.arc(cx, cy - chh / 2 + f * chh, Math.max(2, u * 0.035), 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    });
    // complement inverters
    for (const a of L.aux) {
      const x = X(a.cx), y = Y(a.cy), s = u * 0.32, inV = V[a.x], outV = V['!' + a.x];
      ctx.strokeStyle = nodeCol(inV); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - s * 1.3, y); ctx.lineTo(x - s * 0.6, y); ctx.stroke();
      ctx.fillStyle = '#1b2230'; ctx.strokeStyle = '#8a94a3'; ctx.beginPath(); ctx.moveTo(x - s * 0.6, y - s * 0.6); ctx.lineTo(x + s * 0.4, y); ctx.lineTo(x - s * 0.6, y + s * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + s * 0.52, y, s * 0.12, 0, 7); ctx.stroke();
      ctx.strokeStyle = nodeCol(outV); ctx.beginPath(); ctx.moveTo(x + s * 0.66, y); ctx.lineTo(x + s * 1.2, y); ctx.stroke();
      ctx.font = `600 ${fs}px "IBM Plex Mono", monospace`; ctx.fillStyle = '#c3cede'; ctx.textAlign = 'center';
      ctx.fillText(a.x, x - s * 1.5, y - s * 0.5); ctx.fillText(pretty('!' + a.x), x + s * 1.2, y - s * 0.5);
    }
    // caption
    ctx.textAlign = 'left'; ctx.font = `500 ${Math.max(11, fs - 1)}px "IBM Plex Sans", sans-serif`;
    ctx.fillStyle = surge > 0 ? '#ffd27a' : '#8a94a3';
    const sm = w < 560;
    ctx.fillText(surge > 0 ? (yv === '1' ? (sm ? 'output charging from V_DD' : 'pull-up conducting: the output charges from V_DD') : (sm ? 'output discharging to ground' : 'pull-down conducting: the output discharges to ground'))
      : (sm ? 'at rest: no current flows' : 'at rest no path joins V_DD to ground: static CMOS draws (almost) no current'), 14, 16);
  }
}

// ---------------------------------------------------------------- lab
export function init(sec) {
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'gate', type: 'seg', label: 'Gate', options: ORDER.map(k => [k, SHORT[k]]), value: 'nand2' },
    { key: 'era', type: 'seg', label: 'Transistors (for the delay in ps)', options: ERAS, value: '2025_2nm_gaa' },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'fn', label: 'Function', unit: '' }, { key: 'n', label: 'Transistors', unit: 'nFETs + pFETs' },
    { key: 'g', label: 'Logical effort g', unit: 'per input (inverter = 1)' }, { key: 'p', label: 'Parasitic delay p', unit: 'τ' },
    { key: 'd', label: 'Delay at fan-out 4', unit: 'd = 4g + p, in τ' }, { key: 'ps', label: 'In picoseconds', unit: '' },
  ]);
  const inHost = sec.querySelector('#cgInputs'), truthHost = sec.querySelector('#cgTruth'), effHost = sec.querySelector('[data-role=effort]');
  const view = new GateView(sec.querySelector('[data-role=gate] canvas'));
  let ins = {}, now = 0;
  const tau = {}; ERAS.forEach(([k]) => { tau[k] = tauPs(k); });

  function setGate(key) {
    view.setGate(key);
    const g = LG.GATES[key];
    ins = Object.fromEntries(g.inputs.map(x => [x, ins[x] ?? 0]));
    inHost.innerHTML = g.inputs.map(x => `<button type="button" class="cg-in" data-in="${x}" aria-pressed="false">${x}<small>0</small></button>`).join('');
    view.setInputs(ins, now); refresh(); drawEffort();
  }
  function toggle(x) { if (!(x in ins)) return; ins[x] ^= 1; view.setInputs(ins, now); refresh(); }
  inHost.addEventListener('click', e => { const b = e.target.closest('[data-in]'); if (b) toggle(b.dataset.in); });
  addEventListener('keydown', e => {
    if (e.target.closest?.('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
    const r = sec.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
    const k = e.key.toUpperCase(); if ('ABCD'.includes(k) && k in ins) { toggle(k); e.preventDefault(); }
  });
  function refresh() {
    const key = ctl.state.gate, g = LG.GATES[key], e = LG.effort(key), d = 4 * Math.max(...Object.values(e.g)) + e.p;
    inHost.querySelectorAll('[data-in]').forEach(b => { const v = ins[b.dataset.in]; b.setAttribute('aria-pressed', String(!!v)); b.querySelector('small').textContent = v; });
    const gs = Object.entries(e.g), same = gs.every(([, v]) => Math.abs(v - gs[0][1]) < 1e-9);
    const frac = v => { for (const q of [1, 2, 3, 6]) { const n = Math.round(v * q); if (Math.abs(n / q - v) < 1e-9) return q === 1 ? String(n) : `${n}/${q}`; } return v.toFixed(2); };
    show({ fn: `<small style="font-size:13px;display:inline">${g.fn}</small>`, n: e.n, g: same ? frac(gs[0][1]) : gs.map(([k, v]) => `${k} ${frac(v)}`).join(' · '),
      p: frac(e.p), d: d.toFixed(2), ps: (d * tau[ctl.state.era]).toFixed(d * tau[ctl.state.era] < 10 ? 2 : 1) });
    const rows = LG.truth(key), cur = g.inputs.map(x => ins[x]).join('');
    truthHost.innerHTML = `<table><thead><tr>${g.inputs.map(x => `<th>${x}</th>`).join('')}<th class="y">Y</th></tr></thead><tbody>${rows.map(([b, y]) =>
      `<tr class="${b.join('') === cur ? 'on' : ''}" data-b="${b.join('')}">${b.map(v => `<td>${v}</td>`).join('')}<td class="y">${y}</td></tr>`).join('')}</tbody></table>`;
  }
  truthHost.addEventListener('click', e => {
    const r = e.target.closest('tr[data-b]'); if (!r) return;
    const g = LG.GATES[ctl.state.gate]; g.inputs.forEach((x, i) => { ins[x] = +r.dataset.b[i]; }); view.setInputs(ins, now); refresh();
  });
  function drawEffort() {
    const f = frame(effHost, { w: fw(effHost), h: 290, m: { t: 18, r: 12, b: 52, l: 44 } });
    const rows = ORDER.map(k => { const e = LG.effort(k); return { k, d: 4 * Math.max(...Object.values(e.g)) + e.p, p: e.p, g: Math.max(...Object.values(e.g)), n: e.n }; });
    const xs = linear(-0.6, rows.length - 0.4, f.x0, f.x1), ys = linear(0, 30, f.y0, f.y1), bw = (f.x1 - f.x0) / rows.length * 0.62;
    axes(f, xs, ys, { xt: [], yt: [0, 10, 20, 30], yl: 'delay at FO4 (τ)', yf: String });
    const tip = tooltip(effHost);
    rows.forEach((r, i) => {
      const on = r.k === ctl.state.gate, x = xs(i);
      el('rect', { x: x - bw / 2, y: ys(r.p), width: bw, height: ys(0) - ys(r.p), fill: on ? '#b88a2e' : '#2b3a52' }, f.svg);
      const top = el('rect', { x: x - bw / 2, y: ys(r.d), width: bw, height: ys(r.p) - ys(r.d), fill: on ? '#f2b84b' : C.s1, opacity: on ? 1 : 0.75 }, f.svg);
      txt(f.svg, x + 3, f.y0 + 12, SHORT[r.k], { 'text-anchor': 'end', 'font-size': 10.5, fill: on ? '#ffd27a' : C.ink2, transform: `rotate(-38 ${x + 3} ${f.y0 + 12})` });
      txt(f.svg, x, ys(r.d) - 6, r.d.toFixed(1), { 'text-anchor': 'middle', 'font-size': 10.5, fill: on ? '#ffd27a' : C.muted });
      const hit = el('rect', { x: x - bw / 2 - 4, y: f.y1, width: bw + 8, height: f.y0 - f.y1, fill: 'transparent', style: 'cursor:pointer' }, f.svg);
      hit.addEventListener('pointermove', e => tip.show(tipRows(LG.GATES[r.k].name, [['logical effort g', r.g.toFixed(2)], ['parasitic p', r.p.toFixed(2)], ['delay 4g + p', r.d.toFixed(2) + ' τ'], ['transistors', r.n]]), e.clientX, e.clientY));
      hit.addEventListener('pointerleave', () => tip.hide());
      hit.addEventListener('click', () => ctl.set('gate', r.k));
      void top;
    });
  }
  ctl.on(k => { if (k === 'gate') setGate(ctl.state.gate); else refresh(); });
  loop(sec.querySelector('[data-role=gate]'), (dt) => { now += dt; view.draw(now); });
  experiments(sec.querySelector('.lab-exp'), [
    { label: 'NAND: only both inputs high pull the output low', run: api => { api.set('gate', 'nand2'); ins = { A: 1, B: 0 }; view.setInputs(ins, now); refresh(); setTimeout(() => toggle('B'), 900); },
      note: 'The two nFETs are in series, so the output only reaches ground when A and B are both 1; the two pFETs are in parallel, so either input at 0 pulls it high. Two switching events, one per input change, and no current in between.' },
    { label: 'Why NOR is slower than NAND', run: api => api.set('gate', 'nor2'),
      note: 'Swap series and parallel and the pFETs end up stacked. Each must be twice as wide again to keep the pull-up as strong as an inverter, so every input carries 5/3 of an inverter\'s capacitance against NAND\'s 4/3. With three inputs the gap widens (7/3 against 5/3), which is why CMOS libraries prefer NAND.' },
    { label: 'XOR needs twelve transistors', run: api => { api.set('gate', 'xor2'); },
      note: 'XOR is not a single series/parallel function of A and B; it needs both polarities of each input. Here it is an AOI22 fed by A, B and their complements, which two input inverters supply: 8 + 4 transistors and the highest logical effort on the chart.' },
    { label: 'The carry gate of an adder', run: api => { api.set('gate', 'maj'); ins = { A: 1, B: 0, C: 0 }; view.setInputs(ins, now); refresh(); setTimeout(() => toggle('C'), 900); },
      note: 'The carry out of a full adder is 1 when at least two of A, B and the incoming carry C are 1. Built as one inverting gate, the carry input C sees only two transistors (g = 2), which matters because C is the signal that ripples through the whole adder in Lab 02.' },
    { label: 'Compare a 180 nm and a 2 nm NAND', run: api => { api.set('gate', 'nand2'); api.set('era', '1999_180nm'); setTimeout(() => api.set('era', '2025_2nm_gaa'), 1500); },
      note: 'Logical effort is the same in every generation: it depends only on the topology. What scaling changes is τ, the delay unit: about 3.3 ps at 180 nm and under 0.4 ps for a nanosheet transistor at its own supply in this model.' },
  ], ctl);
  setGate('nand2');
  onWidth([effHost], drawEffort);
}

/** Record mode: a NAND2 cycling through its truth table. */
export function record(stage, next) {
  stage.innerHTML = `<div class="rec-head"><span class="eyebrow">Switch-level simulation</span><h2>A CMOS NAND gate, switch by switch</h2><span class="rec-state" id="rs"></span></div><canvas></canvas>
    <div class="rec-foot"><span style="color:#5aa2ff">■ nFET on</span><span style="color:#ff8a55">■ pFET on</span><span style="color:#f2b84b">— logic 1</span><span style="color:#56739e">— logic 0</span><span class="rec-brand">Transistor Odyssey · Circuit Lab</span></div>`;
  const v = new GateView(stage.querySelector('canvas')); v.setGate('nand2');
  const seq = [[0, 0], [1, 0], [1, 1], [0, 1]]; let last = -1;
  return (n = 96) => {
    const k = next(), t = k / 12, step = Math.floor(k / (n / 4)) % 4;
    if (step !== last) { last = step; v.setInputs({ A: seq[step][0], B: seq[step][1] }, t); }
    v.draw(t, { maxU: 70 });
    stage.querySelector('#rs').textContent = `A = ${seq[step][0]}  B = ${seq[step][1]}  →  Y = ${v.vals.y}`;
    return k + 1;
  };
}
