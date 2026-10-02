// Static CMOS logic: netlists, switch-level simulation, logical effort and an
// event-driven ripple-carry adder. Twin of sim/transistor_sim/physics/logic.py.
export const GAMMA = 2;

export const GATES = {
  inv:   { name: 'Inverter', inputs: ['A'], pd: 'A', fn: 'NOT A' },
  nand2: { name: 'NAND2', inputs: ['A', 'B'], pd: ['s', 'A', 'B'], fn: 'NOT (A·B)' },
  nor2:  { name: 'NOR2', inputs: ['A', 'B'], pd: ['p', 'A', 'B'], fn: 'NOT (A + B)' },
  nand3: { name: 'NAND3', inputs: ['A', 'B', 'C'], pd: ['s', 'A', 'B', 'C'], fn: 'NOT (A·B·C)' },
  nor3:  { name: 'NOR3', inputs: ['A', 'B', 'C'], pd: ['p', 'A', 'B', 'C'], fn: 'NOT (A + B + C)' },
  aoi21: { name: 'AOI21', inputs: ['A', 'B', 'C'], pd: ['p', ['s', 'A', 'B'], 'C'], fn: 'NOT (A·B + C)' },
  oai21: { name: 'OAI21', inputs: ['A', 'B', 'C'], pd: ['s', ['p', 'A', 'B'], 'C'], fn: 'NOT ((A + B)·C)' },
  aoi22: { name: 'AOI22', inputs: ['A', 'B', 'C', 'D'], pd: ['p', ['s', 'A', 'B'], ['s', 'C', 'D']], fn: 'NOT (A·B + C·D)' },
  xor2:  { name: 'XOR2', inputs: ['A', 'B'], pd: ['p', ['s', 'A', 'B'], ['s', '!A', '!B']], fn: 'A ⊕ B' },
  maj:   { name: 'Carry (inverting majority)', inputs: ['A', 'B', 'C'], pd: ['p', ['s', 'A', 'B'], ['s', 'C', ['p', 'A', 'B']]], fn: 'NOT MAJ(A, B, C)' },
};

export const dual = e => typeof e === 'string' ? e : [e[0] === 's' ? 'p' : 's', ...e.slice(1).map(dual)];

export function conducts(e, val) {
  if (typeof e === 'string') return e[0] === '!' ? !val[e.slice(1)] : !!val[e];
  const k = e.slice(1).map(c => conducts(c, val));
  return e[0] === 's' ? k.every(Boolean) : k.some(Boolean);
}

export function truth(key) {
  const g = GATES[key], n = g.inputs.length, rows = [];
  for (let m = 0; m < 1 << n; m++) {
    const bits = g.inputs.map((_, i) => (m >> (n - 1 - i)) & 1);
    const val = Object.fromEntries(g.inputs.map((x, i) => [x, bits[i]]));
    rows.push([bits, conducts(g.pd, val) ? 0 : 1]);
  }
  return rows;
}

/** Sized transistor netlist. Pull-up from vdd to y (pFETs, dual network), pull-down y to gnd. */
export function netlist(key) {
  const g = GATES[key], T = []; let count = 0;
  const build = (e, top, bot, type, budget) => {
    if (typeof e === 'string') { T.push({ type, g: e, a: top, b: bot, w: (type === 'p' ? GAMMA : 1) / budget }); return; }
    const kids = e.slice(1);
    if (e[0] === 'p') { kids.forEach(c => build(c, top, bot, type, budget)); return; }
    const nodes = [top]; for (let i = 0; i < kids.length - 1; i++) nodes.push('n' + (++count)); nodes.push(bot);
    kids.forEach((c, i) => build(c, nodes[i], nodes[i + 1], type, budget / kids.length));
  };
  build(dual(g.pd), 'vdd', 'y', 'p', 1);
  build(g.pd, 'y', 'gnd', 'n', 1);
  const comps = [...new Set(T.map(t => t.g).filter(x => x[0] === '!').map(x => x.slice(1)))].sort();
  for (const x of comps) {
    T.push({ type: 'p', g: x, a: 'vdd', b: '!' + x, w: GAMMA, aux: true });
    T.push({ type: 'n', g: x, a: '!' + x, b: 'gnd', w: 1, aux: true });
  }
  const nodes = [...new Set(T.flatMap(t => [t.a, t.b, t.g]))].sort();
  return { transistors: T, nodes, inputs: [...g.inputs] };
}

/** Switch-level steady state: values '0', '1' or 'X'. Floating groups keep prev values. */
export function simulate(net, inputs, prev = null, iters = 40) {
  const fixed = { vdd: '1', gnd: '0' };
  for (const [k, v] of Object.entries(inputs)) fixed[k] = String(+v);
  const stored = prev || {};
  let val = Object.fromEntries(net.nodes.map(n => [n, fixed[n] ?? stored[n] ?? 'X']));
  for (let it = 0; it < iters; it++) {
    const parent = Object.fromEntries(net.nodes.map(n => [n, n]));
    const find = n => { while (parent[n] !== n) { parent[n] = parent[parent[n]]; n = parent[n]; } return n; };
    const maybe = [];
    for (const t of net.transistors) {
      const gv = val[t.g], on = t.type === 'n' ? gv === '1' : gv === '0';
      if (on) { const ra = find(t.a), rb = find(t.b); if (ra !== rb) parent[ra] = rb; }
      else if (gv === 'X') maybe.push(t);
    }
    const groups = {};
    for (const n of net.nodes) (groups[find(n)] ||= []).push(n);
    const nw = {};
    for (const members of Object.values(groups)) {
      const srcs = new Set(members.filter(n => n in fixed).map(n => fixed[n]));
      let v;
      if (srcs.size) v = srcs.size === 1 ? [...srcs][0] : 'X';
      else { const held = new Set(members.map(n => stored[n] ?? 'X')); v = held.size === 1 ? [...held][0] : 'X'; }
      for (const n of members) nw[n] = fixed[n] ?? v;
    }
    for (const t of maybe) if (nw[t.a] !== nw[t.b]) for (const n of [t.a, t.b]) if (!(n in fixed)) nw[n] = 'X';
    const same = net.nodes.every(n => nw[n] === val[n]);
    val = nw;
    if (same) break;
  }
  return val;
}

export const onTransistors = (net, val) => net.transistors.map((t, i) => ((val[t.g] === '1') === (t.type === 'n') && val[t.g] !== 'X') ? i : -1).filter(i => i >= 0);

export function effort(key) {
  const net = netlist(key), cin = Object.fromEntries(net.inputs.map(x => [x, 0]));
  let pdiff = 0;
  for (const t of net.transistors) {
    if (t.aux) { cin[t.g] += t.w; continue; }
    if (t.g[0] !== '!') cin[t.g] += t.w;
    if (t.a === 'y' || t.b === 'y') pdiff += t.w;
  }
  return { g: Object.fromEntries(Object.entries(cin).map(([k, v]) => [k, v / 3])), p: pdiff / 3, n: net.transistors.length };
}

export function delay(key, h = 4, inp = null) {
  const e = effort(key), g = inp ? e.g[inp] : Math.max(...Object.values(e.g));
  return g * h + e.p;
}

// ------------------------------------------------------------------ adder
export const adderDelays = () => ({ t_p: delay('xor2', 1), t_c: delay('maj', 2, 'C'), t_s: delay('xor2', 4) });

function waveGate(fn, waves, d) {
  const times = [...new Set(waves.flatMap(w => w.map(e => e[0])))].sort((a, b) => a - b);
  const at = (w, t) => { let v = w[0][1]; for (const [tt, vv] of w) { if (tt <= t) v = vv; else break; } return v; };
  const out = [[-1, fn(...waves.map(w => at(w, times[0])))]];
  for (const t of times.slice(1)) { const v = fn(...waves.map(w => at(w, t))); if (v !== out[out.length - 1][1]) out.push([t + d, v]); }
  return out;
}

/** Inputs switch from (aOld, bOld) to (a, b) at t = 0. Waveforms are [[t, v], ...] with t in tau. */
export function rippleAdd(aOld, bOld, a, b, n = 8, d = adderDelays()) {
  const bit = (x, i) => (x >> i) & 1;
  const A = [], B = [], C = [[[-1, 0]]], S = [], P = [];
  for (let i = 0; i < n; i++) { A.push([[-1, bit(aOld, i)], [0, bit(a, i)]]); B.push([[-1, bit(bOld, i)], [0, bit(b, i)]]); }
  for (let i = 0; i < n; i++) {
    P.push(waveGate((x, y) => x ^ y, [A[i], B[i]], d.t_p));
    S.push(waveGate((x, y) => x ^ y, [P[i], C[i]], d.t_s));
    C.push(waveGate((x, y, z) => (x & y) | (z & (x | y)), [A[i], B[i], C[i]], d.t_c));
  }
  const events = [...S, ...C.slice(1)].flatMap(w => w.slice(1).map(e => e[0]));
  const settle = events.length ? Math.max(...events) : 0;
  const sum = S.reduce((s, w, i) => s + (w[w.length - 1][1] << i), 0) + (C[n][C[n].length - 1][1] << n);
  return { S, C, P, A, B, settle, transitions: events.length, sum };
}

export const rippleWorst = (n, d = adderDelays()) => Math.max(Math.max(d.t_p, (n - 1) * d.t_c) + d.t_s, n * d.t_c);

export function koggeStoneDelay(n) {
  const levels = n > 1 ? Math.ceil(Math.log2(n)) : 0;
  return delay('nand2', 2) + levels * (0.5 * delay('aoi21', 2) + 0.5 * delay('oai21', 2)) + delay('xor2', 4);
}
export function koggeStoneCount(n) {
  const levels = n > 1 ? Math.ceil(Math.log2(n)) : 0;
  let cells = 0; for (let k = 0; k < levels; k++) cells += n - 2 ** k;
  return n * (effort('nand2').n + effort('xor2').n) + cells * (effort('aoi21').n + effort('nand2').n) + n * effort('xor2').n;
}
export const rippleCount = n => n * (2 * effort('xor2').n + effort('maj').n);
