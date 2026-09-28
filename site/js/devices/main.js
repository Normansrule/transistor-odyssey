// Device Atlas: animated cross-sections, live band diagrams, gallery, band alignment and heterojunction builder.
import { DEVICES, ALIGN, REFS } from './data.js';
import { SCENES } from './scenes.js';
import { XSec } from './xsec.js';
import { LateralView, VerticalView } from './bandview.js';
import { lateral, vertical, onFraction, vtEff, heterojunction } from './bands.js';
import { panel, tiles, sci, clamp } from '../physlab/ui.js';

const $ = (s, r = document) => r.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const RECORD = params.get('record');
const BY_ID = Object.fromEntries(DEVICES.map(d => [d.id, d]));
const MATS = Object.fromEntries(ALIGN.materials.map(m => [m.id, m]));
const safe = (fn, tag) => { try { fn(); } catch (e) { console.error('[devices]', tag, e); } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sub = s => esc(s).replace(/([VIE])_([A-Za-z,]+)/g, '$1<sub>$2</sub>');

function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = RECORD ? mulberry(7) : Math.random;

// Materials that make up each device (for the per-device band line-up).
const STACK = {
  point_contact: ['Ge'], bjt: ['Si', 'SiO2'], hbt: ['Si', 'SiGe', 'InP', 'InGaAs'], jfet: ['Si'], mesfet: ['GaAs', 'AlGaAs'],
  planar_mosfet: ['Si', 'SiO2', 'HfO2'], fdsoi: ['Si', 'SiO2', 'HfO2'], finfet: ['Si', 'SiO2', 'HfO2'], gaa: ['Si', 'SiGe', 'SiO2', 'HfO2'],
  cfet: ['Si', 'SiGe', 'HfO2'], gan_hemt: ['GaN', 'AlGaN', 'Si3N4'], sic_mosfet: ['4H-SiC', 'SiO2'], igbt: ['Si', 'SiO2'],
  diamond_fet: ['C-H', 'C-O', 'Al2O3'], mos2_fet: ['MoS2', 'SiO2', 'HfO2'], cnt_fet: ['CNT', 'HfO2'], tfet: ['Si', 'Ge', 'HfO2'],
  igzo_tft: ['IGZO', 'SiO2', 'Si3N4'], flash: ['Si', 'SiO2', 'Si3N4'],
};

const LAT_CAP = {
  fet: 'Conduction band from source to drain. The hump is the barrier the carriers must climb: the gate pulls it down, and the drain voltage tilts the right-hand side down. Current grows by about 10× for every 60 meV the barrier falls.',
  bjt: 'Emitter → base → collector. Forward bias on the emitter–base junction lowers its barrier; injected carriers diffuse across the thin base (a few recombine) and fall down the reverse-biased collector junction.',
  tfet: 'Carriers do not climb over a barrier here. Once the gate pulls the channel conduction band below the source valence band, an energy window opens and electrons tunnel sideways through the thin gap (yellow traces).',
  sbfet: 'Metal contacts form Schottky barriers at both ends of the nanotube. The gate does not remove the barrier; it thins it, until electrons tunnel straight through the spike (yellow traces).',
};
const VER_CAP = {
  mos: ['solved', 'Gate → oxide → semiconductor, from the exact metal-oxide-semiconductor (MOS) charge equation. A gate voltage bends the bands at the surface; once the conduction band nears the Fermi level, a thin inversion layer of electrons forms: the channel.'],
  hemt: ['solved', 'Through the AlGaN barrier into GaN, from a self-consistent Schrödinger–Poisson solution. Polarization charge at the interface builds a triangular quantum well; the dashed lines are the quantized subbands E0, E1, E2 and their wavefunctions. A negative gate lifts the well above the Fermi level and empties it.'],
  dg: ['schematic', 'Across the thin body between the gates. Because the gate reaches the body from two, three or four sides, the whole body moves together: there is no deep region the drain can reach around the gate.'],
  diamond: ['schematic', 'Hydrogen-terminated diamond: the valence band bends up to the Fermi level right at the surface, giving a two-dimensional sheet of holes without any dopant atoms (surface transfer doping).'],
  jfet: ['schematic', 'From the gate junction into the channel. The depleted region (bent bands) widens as the gate goes negative, until it meets the far side and pinches the channel off.'],
  mesfet: ['schematic', 'From the Schottky metal gate into the n-type GaAs channel. The depletion region under the metal widens with negative gate voltage and pinches the channel off.'],
  tft: ['schematic', 'Up from the bottom gate through the insulator into the amorphous indium gallium zinc oxide (IGZO) film. A positive gate accumulates electrons at the interface, pulling the conduction band down to the Fermi level.'],
  flash: ['schematic', 'Control gate → blocking oxide → floating gate → tunnel oxide → channel. Electrons stored in the floating-gate well screen the control gate, so the threshold voltage rises by several volts: that shift is the stored bit.'],
};
const STATE_TXT = {
  default: { off: 'Off', sub: 'Subthreshold', on: 'On · linear', sat: 'On · saturation' },
  bjt: { off: 'Cut-off', sub: 'Turning on', on: 'Forward active', sat: 'Active · high collector bias' },
  tfet: { off: 'Off', sub: 'Window opening', on: 'On · tunnelling', sat: 'On · saturation' },
  flash: { off: 'Erased · off', sub: 'Programming…', on: 'Programmed · reads 0', sat: 'Erased · reads 1' },
};
const STATE_COL = { off: '#8a94a3', sub: '#c98500', on: '#199e70', sat: '#3987e5' };

// ---------------------------------------------------------------- state
const S = { dev: null, vg: 0, vd: 0, prog: 0, progTarget: 0, playing: false, phase: 0, speed: 1, labels: true, key: '', L: null, V: null, state: 'off', stepPin: null };
let xsec, latView, verView, ctl, setTiles;

function ends(dev) {
  const [a, b] = dev.model.vg, fa = onFraction(dev, a), fb = onFraction(dev, b);
  return fa <= fb ? { off: a, on: b } : { off: b, on: a };
}
function vgAtF(dev, target, prog = 0) {
  let { off: lo, on: hi } = ends(dev);
  for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (onFraction(dev, mid, prog) < target) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
function overdrive(dev, Vg, prog) { const m = dev.model; return m.lateral === 'tfet' ? m.pol * (Vg - m.vt) : m.pol * (Vg - vtEff(dev, prog)); }

function classify(dev, Vg, Vd, prog) {
  const f = onFraction(dev, Vg, prog), m = dev.model, vd01 = Vd / (m.vd[1] || 1);
  if (m.flash) {
    if (Math.abs(S.progTarget - S.prog) > 0.02) return 'sub';
    if (S.prog >= 0.5) return 'on';
    return f > 0.5 ? 'sat' : 'off';
  }
  if (f < 0.03) return 'off';
  if (f < 0.5) return 'sub';
  if (m.lateral === 'bjt') return vd01 > 0.5 ? 'sat' : 'on';
  return Vd > 0.02 && Vd >= overdrive(dev, Vg, prog) ? 'sat' : 'on';
}

function presets(dev) {
  const m = dev.model, e = ends(dev), vmax = m.vd[1];
  if (m.flash) return {
    off: { vg: 0.5, vd: 0.5, prog: 0 }, sub: { program: true }, on: { vg: 2.5, vd: 0.5, prog: 1 }, sat: { vg: 2.5, vd: 0.5, prog: 0 },
  };
  const od = Math.max(overdrive(dev, e.on, 0), 0.05);
  return {
    off: { vg: e.off, vd: 0.5 * vmax }, sub: { vg: vgAtF(dev, 0.12), vd: 0.5 * vmax },
    on: { vg: e.on, vd: m.lateral === 'bjt' ? 0.2 * vmax : Math.min(0.2 * vmax, 0.45 * od) }, sat: { vg: e.on, vd: vmax },
  };
}

// ---------------------------------------------------------------- UI build
function buildPicker() {
  const host = $('#dvPicker'), sel = $('#dvSelect');
  const fams = [...new Set(DEVICES.map(d => d.family))];
  host.innerHTML = fams.map(f => `<div class="dv-fam"><span class="dv-fam-h">${esc(f)}</span><div class="dv-fam-b">${DEVICES.filter(d => d.family === f).map(d => `<button type="button" role="tab" data-id="${d.id}" aria-selected="false"><b>${d.year}</b>${esc(d.short)}</button>`).join('')}</div></div>`).join('');
  sel.innerHTML = fams.map(f => `<optgroup label="${esc(f)}">${DEVICES.filter(d => d.family === f).map(d => `<option value="${d.id}">${d.year} · ${esc(d.short)}</option>`).join('')}</optgroup>`).join('');
  host.addEventListener('click', e => { const b = e.target.closest('button[data-id]'); if (b) select(b.dataset.id, true); });
  sel.addEventListener('change', () => select(sel.value, true));
}

function buildControls(dev) {
  const m = dev.model, host = $('#dvSliders'); host.innerHTML = '';
  const gl = m.gl ? sub(m.gl) : (dev.model.lateral === 'bjt' ? 'V<sub>BE</sub>' : 'V<sub>GS</sub>');
  const dl = m.dl ? sub(m.dl) : (dev.model.lateral === 'bjt' ? 'V<sub>CE</sub>' : 'V<sub>DS</sub>');
  const gname = m.lateral === 'bjt' ? 'Base–emitter voltage' : m.flash ? 'Control-gate voltage' : 'Gate voltage';
  const dname = m.lateral === 'bjt' ? 'Collector voltage' : 'Drain voltage';
  const step = v => Math.max((v[1] - v[0]) / 400, 0.001);
  ctl = panel(host, [
    { key: 'vg', label: `${gname} ${gl}`, min: m.vg[0], max: m.vg[1], step: step(m.vg), value: S.vg, fmt: v => v.toFixed(Math.abs(m.vg[1] - m.vg[0]) > 5 ? 1 : 2) + ' V' },
    { key: 'vd', label: `${dname} ${dl}`, min: m.vd[0], max: m.vd[1], step: step(m.vd), value: S.vd, fmt: v => v.toFixed(m.vd[1] > 5 ? 1 : 2) + ' V' },
  ]);
  ctl.on((k) => { if (k === 'vg' || k === '*') S.vg = ctl.state.vg; if (k === 'vd' || k === '*') S.vd = ctl.state.vd; });
  ctl.inputs.vg.inp.addEventListener('pointerdown', () => setPlaying(false));
  $('#dvFlash').hidden = !m.flash;
}

function buildTiles() {
  setTiles = tiles($('#dvTiles'), [
    { key: 'state', label: 'State' }, { key: 'barrier', label: 'Barrier', unit: 'eV' },
    { key: 'f', label: 'On-fraction' }, { key: 'i', label: 'Current (relative)' },
  ]);
}

function renderHead(dev) {
  const mat = MATS[dev.material];
  $('#dvHead').innerHTML = `
    <div><span class="eyebrow">${esc(dev.family)} · ${dev.year}</span><h3>${esc(dev.name)}</h3><p class="dv-who">${esc(dev.who)}</p></div>
    <div class="dv-badges"><span class="dv-badge">${esc(mat ? mat.name : dev.material)}</span><span class="dv-badge ${dev.carrier}">${dev.carrier === 'e' ? 'electron' : 'hole'} current</span>${dev.model.lateral === 'bjt' ? '<span class="dv-badge">bipolar</span>' : '<span class="dv-badge">field-effect</span>'}</div>
    <p class="dv-summary">${esc(dev.summary)}</p>`;
}

function renderSteps(dev) {
  const P = presets(dev);
  $('#dvSteps').innerHTML = dev.steps.map((s, i) => `<li><button type="button" data-when="${s.when}" data-i="${i}"><span class="n">${i + 1}</span><span class="w">${STATE_TXT[stateSet(dev)][s.when]}</span><span class="t">${sub(s.text)}</span></button></li>`).join('');
  $('#dvSteps').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const p = P[b.dataset.when]; setPlaying(false); S.stepPin = +b.dataset.i;
    if (p.program) { program(); return; }
    if (p.prog !== undefined && p.prog !== S.progTarget) { S.progTarget = p.prog; if (p.prog > S.prog) xsec.program(14); }
    ctl.animate({ vg: p.vg, vd: p.vd }, 900);
  };
}
const stateSet = dev => dev.model.flash ? 'flash' : dev.model.lateral === 'bjt' ? 'bjt' : dev.model.lateral === 'tfet' ? 'tfet' : 'default';

function renderDetail(dev) {
  const docs = `https://github.com/Normansrule/transistor-odyssey/blob/main/docs/${dev.docs}`;
  $('#dvAbout').innerHTML = `<h3>Where you find it</h3><p>${esc(dev.where)}</p>
    <h3>Go deeper</h3><ul class="dv-links">
      <li><a href="physics.html#${dev.lab}">Physics Lab: the physics behind it →</a></li>
      <li><a href="${docs}" rel="noopener">Read the chapter (${esc(dev.docs.replace('.md', ''))}) →</a></li>
      <li><a href="assets/xsec/${dev.xsec}.svg">Engineering cross-section (SVG) →</a></li>
      <li><a href="https://github.com/Normansrule/transistor-odyssey/blob/main/sim/transistor_sim/bandatlas.py" rel="noopener">Band-diagram model in Python →</a></li>
    </ul>`;
  $('#dvFacts').innerHTML = `<h3>Key numbers</h3><table class="dv-facts">${dev.facts.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${sub(v)}</td></tr>`).join('')}</table>
    <h3>Sources</h3><div class="refchips">${dev.refs.filter(k => REFS[k]).map(k => `<a href="#ref-${k}" title="${esc(REFS[k].cite)}">${k}</a>`).join('')}</div>`;
  renderStack(dev);
}

function renderStack(dev) {
  const ids = (STACK[dev.id] || [dev.material]).filter(k => MATS[k]);
  const W = 320, H = 190, pad = { l: 34, r: 8, t: 12, b: 34 };
  let lo = Infinity, hi = -Infinity; ids.forEach(k => { const m = MATS[k]; lo = Math.min(lo, -m.chi - m.Eg); hi = Math.max(hi, -m.chi); });
  lo = Math.floor(lo - 0.3); hi = Math.ceil(hi + 0.3);
  const Y = E => pad.t + (hi - E) / (hi - lo) * (H - pad.t - pad.b), bw = (W - pad.l - pad.r) / ids.length;
  let g = '';
  for (let e = Math.ceil(lo); e <= hi; e += (hi - lo > 6 ? 2 : 1)) g += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${Y(e)}" y2="${Y(e)}" stroke="#232a34"/><text x="${pad.l - 5}" y="${Y(e) + 4}" text-anchor="end" class="ax">${e}</text>`;
  ids.forEach((k, i) => {
    const m = MATS[k], x = pad.l + i * bw + bw * 0.18, w = bw * 0.64, ec = -m.chi, ev = -m.chi - m.Eg;
    g += `<rect x="${x}" y="${Y(ec)}" width="${w}" height="${Y(ev) - Y(ec)}" fill="${m.kind === 'insulator' ? '#b58fd6' : '#7fd3d0'}" opacity=".13"/>
      <line x1="${x}" x2="${x + w}" y1="${Y(ec)}" y2="${Y(ec)}" stroke="#3987e5" stroke-width="2.4"/><line x1="${x}" x2="${x + w}" y1="${Y(ev)}" y2="${Y(ev)}" stroke="#d95926" stroke-width="2.4"/>
      <text x="${x + w / 2}" y="${(Y(ec) + Y(ev)) / 2 + 4}" text-anchor="middle" class="gap">${m.Eg.toFixed(2)}</text>
      <text x="${x + w / 2}" y="${H - pad.b + 16}" text-anchor="middle" class="nm">${esc(k.replace('2', '₂').replace('3N4', '₃N₄').replace('O3', 'O₃'))}</text>`;
  });
  $('#dvStack').innerHTML = `<h3>Band line-up of its materials</h3><svg viewBox="0 0 ${W} ${H}" class="dv-stack-svg" role="img" aria-label="Band edges of the materials in this device">${g}<text x="6" y="${pad.t + 8}" class="ax">eV</text></svg>
    <p class="small">Conduction (blue) and valence (orange) band edges relative to the vacuum level; the number is the gap in eV. ${ids.length > 1 ? `<button type="button" class="linkish" id="dvToHj">Open ${esc(ids[0])} / ${esc(ids[1])} in the builder →</button>` : ''}</p>`;
  const b = $('#dvToHj'); if (b) b.onclick = () => { setHJ(ids[1], ids[0]); $('#hetero').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); };
}

// ---------------------------------------------------------------- selection
function select(id, scroll = false) {
  const dev = BY_ID[id] || DEVICES[0]; S.dev = dev;
  const e = ends(dev);
  S.prog = 0; S.progTarget = 0; S.stepPin = null; S.key = '';
  S.vg = dev.model.flash ? 2.5 : vgAtF(dev, 0.97); S.vd = dev.model.vd[1] * 0.5; S.phase = Math.acos(clamp(1 - 2 * (S.vg - e.off) / (e.on - e.off), -1, 1));
  document.querySelectorAll('#dvPicker button').forEach(b => { const on = b.dataset.id === dev.id; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  $('#dvSelect').value = dev.id;
  buildControls(dev); renderHead(dev); renderSteps(dev); renderDetail(dev);
  xsec.setScene(SCENES[dev.id], dev); latView.reset(dev);
  $('#dvLatH').textContent = dev.model.lateral === 'bjt' ? 'Along the current path: emitter → base → collector' : 'Along the current path: source → drain';
  $('#dvLatKind').textContent = dev.model.lateral === 'fet' || dev.model.lateral === 'bjt' ? 'model' : 'model · tunnelling';
  $('#dvLatCap').textContent = LAT_CAP[dev.model.lateral];
  const vc = VER_CAP[dev.model.vertical];
  $('#dvVerH').textContent = dev.model.vertical === 'none' ? 'Down through the gate' : dev.model.vertical === 'tft' ? 'Up through the bottom gate' : 'Down through the gate';
  $('#dvVerKind').textContent = vc ? vc[0] : '';
  $('#dvVerKind').classList.toggle('solved', vc?.[0] === 'solved');
  $('#dvVerCap').textContent = vc ? vc[1] : 'Bipolar devices have no insulated gate: the base is a doped junction, so everything happens in the diagram above.';
  document.querySelectorAll('.dv-gal-card').forEach(c => c.classList.toggle('on', c.dataset.id === dev.id));
  if (!RECORD) history.replaceState(null, '', '#' + dev.id);
  if (scroll) { const t = $('#dvHead'); if (t.getBoundingClientRect().top < 0 || t.getBoundingClientRect().top > innerHeight * 0.6) t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
}

function setPlaying(on) { S.playing = on; const b = $('#dvPlay'); if (b) { b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '❚❚ Pause the sweep' : '▶ Sweep the gate'; } }

function program() {
  setPlaying(false);
  ctl.animate({ vg: 6, vd: 0 }, 600, () => { xsec.program(16); S.progTarget = 1; setTimeout(() => ctl.animate({ vg: 2.5, vd: 0.5 }, 800), 1500); });
}
function erase() {
  setPlaying(false);
  ctl.animate({ vg: -2, vd: 0 }, 600, () => { S.progTarget = 0; setTimeout(() => ctl.animate({ vg: 2.5, vd: 0.5 }, 800), 1500); });
}

// ---------------------------------------------------------------- frame
function frame(dt) {
  const dev = S.dev, m = dev.model;
  if (S.playing) {
    S.phase += dt * S.speed * 0.85;
    const e = ends(dev); S.vg = e.off + (e.on - e.off) * (0.5 - 0.5 * Math.cos(S.phase));
    ctl.state.vg = S.vg; ctl.inputs.vg.show(S.vg);
  }
  if (S.prog !== S.progTarget) { const d = S.progTarget - S.prog, stepv = dt * 0.8; S.prog = Math.abs(d) < stepv ? S.progTarget : S.prog + Math.sign(d) * stepv; }
  const key = `${dev.id}|${S.vg.toFixed(3)}|${S.vd.toFixed(3)}|${S.prog.toFixed(3)}`;
  if (key !== S.key) { S.key = key; S.L = lateral(dev, S.vg, S.vd, 241, S.prog); S.V = vertical(dev, S.vg, 200, S.prog); }
  const f = onFraction(dev, S.vg, S.prog), e = ends(dev);
  const g01 = clamp((S.vg - e.off) / (e.on - e.off || 1), 0, 1);
  const st = {
    f, vd01: S.vd / (m.vd[1] || 1), vg01: m.pol < 0 ? -g01 : g01, prog: S.prog, dt, speed: S.speed, labels: S.labels, vgDisp: S.vg,
    termLabels: dev.labels, termVolts: { g: `${S.vg.toFixed(Math.abs(m.vg[1] - m.vg[0]) > 5 ? 1 : 2)} V`, d: `${S.vd.toFixed(m.vd[1] > 5 ? 1 : 2)} V`, s: '0 V' },
  };
  xsec.draw(st); latView.draw(S.L, st); verView.draw(S.V, st, dev);
  // readouts
  const state = classify(dev, S.vg, S.vd, S.prog);
  if (state !== S.state || !setTiles.last || setTiles.lastKey !== key) {
    S.state = state; setTiles.lastKey = key; setTiles.last = true;
    const bar = m.lateral === 'tfet' ? S.L.window : m.lateral === 'sbfet' ? S.L.barrierMid : S.L.barrier;
    const vdsat = m.lateral === 'bjt' ? 0.2 : Math.max(overdrive(dev, S.vg, S.prog), 0.05 * (m.vscale || 1));
    const irel = f * Math.tanh(S.vd / vdsat);
    setTiles({
      state: `<span style="color:${STATE_COL[state]}">${STATE_TXT[stateSet(dev)][state]}</span>`,
      barrier: bar === undefined || !isFinite(bar) ? '—' : (m.lateral === 'tfet' ? (bar > 0 ? '+' : '') : '') + bar.toFixed(2),
      f: sci(f, 2), i: sci(irel, 2),
    });
    $('#dvTiles .pl-tile:nth-child(2) .l').textContent = m.lateral === 'tfet' ? 'Tunnelling window' : m.lateral === 'sbfet' ? 'Channel band (mid)' : 'Barrier';
    document.querySelectorAll('#dvSteps button').forEach(b => b.classList.toggle('on', b.dataset.when === state));
    drawTransfer();
  }
}

function drawTransfer() {
  const cv = $('#dvTf'); if (!cv) return;
  const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr)) { cv.width = w * dpr; cv.height = h * dpr; }
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const dev = S.dev, [a, b] = dev.model.vg, pad = { l: 40, r: 12, t: 10, b: 24 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b;
  let bottom = 0; for (let i = 0; i <= 60; i++) bottom = Math.min(bottom, Math.log10(onFraction(dev, a + (b - a) * i / 60, 0)), Math.log10(onFraction(dev, a + (b - a) * i / 60, 1)));
  const D = clamp(Math.ceil(-bottom), 3, 8);
  const X = v => pad.l + (v - a) / (b - a) * W, Y = lg => pad.t + (-lg) / D * H;
  ctx.font = '10.5px "IBM Plex Mono", monospace'; ctx.fillStyle = '#8a94a3'; ctx.textAlign = 'right';
  for (let k = 0; k <= D; k += (D > 5 ? 2 : 1)) { ctx.strokeStyle = '#1d2530'; ctx.beginPath(); ctx.moveTo(pad.l, Y(-k)); ctx.lineTo(pad.l + W, Y(-k)); ctx.stroke(); ctx.fillText(k ? `10⁻${'⁰¹²³⁴⁵⁶⁷⁸'[k]}` : '1', pad.l - 5, Y(-k) + 4); }
  ctx.textAlign = 'center'; ctx.fillText(`${a} V`, pad.l + 10, h - 6); ctx.fillText(`${b} V`, pad.l + W - 12, h - 6);
  ctx.fillText('gate voltage →', pad.l + W / 2, h - 6);
  const curve = (prog, col, dash) => { ctx.beginPath(); for (let i = 0; i <= 120; i++) { const v = a + (b - a) * i / 120, lg = Math.max(Math.log10(onFraction(dev, v, prog)), -D); i ? ctx.lineTo(X(v), Y(lg)) : ctx.moveTo(X(v), Y(lg)); } ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]); };
  if (dev.model.flash) { curve(0, 'rgba(138,148,163,.6)', [4, 4]); curve(1, 'rgba(138,148,163,.6)', [4, 4]); }
  curve(S.prog, '#f2b84b', []);
  const lg = Math.max(Math.log10(onFraction(dev, S.vg, S.prog)), -D);
  ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(X(S.vg), Y(lg), 4.5, 0, 7); ctx.fill();
  const n = dev.model.n || 1, ss = dev.model.lateral === 'tfet' ? 'steeper than 60' : dev.model.lateral === 'bjt' ? '60' : Math.round(60 * n * (dev.model.vscale || 1));
  ctx.textAlign = 'left'; ctx.fillStyle = '#aab3c0'; ctx.fillText(dev.model.vscale ? 'log current (schematic)' : `swing ≈ ${ss} mV/dec`, pad.l + 6, pad.t + 12);
}

// ---------------------------------------------------------------- gallery
function drawThumb(cv, dev) {
  const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight; if (!w) return;
  cv.width = w * dpr; cv.height = h * dpr; const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const e = ends(dev), vd = dev.model.vd[1] * (dev.model.lateral === 'bjt' ? 0.3 : 0.5);
  const off = lateral(dev, e.off, vd, 121), on = lateral(dev, e.on, vd, 121);
  let lo = Infinity, hi = -Infinity; for (const L of [off, on]) for (let i = 0; i < L.x.length; i++) if (!isNaN(L.Ec[i])) { lo = Math.min(lo, L.Ev[i]); hi = Math.max(hi, L.Ec[i]); }
  const span = hi - lo; lo -= span * 0.06; hi += span * 0.06;
  const X = x => 6 + x * (w - 12), Y = E => 6 + (hi - E) / (hi - lo) * (h - 12);
  const line = (L, arr, col, wd, dash) => { ctx.beginPath(); let pen = false; L.x.forEach((x, i) => { const v = arr[i]; if (isNaN(v)) { pen = false; return; } pen ? ctx.lineTo(X(x), Y(v)) : ctx.moveTo(X(x), Y(v)); pen = true; }); ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]); };
  (on.regions || []).forEach(([a, b], i) => { if (i % 2 === 1) { ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fillRect(X(a), 0, X(b) - X(a), h); } });
  line(off, off.Ec, 'rgba(170,179,192,.55)', 1.4, [4, 3]); line(off, off.Ev, 'rgba(170,179,192,.55)', 1.4, [4, 3]);
  line(on, on.Ec, '#3987e5', 2, []); line(on, on.Ev, '#d95926', 2, []);
}
function buildGallery() {
  const host = $('#dvGallery');
  host.innerHTML = DEVICES.map(d => `<button type="button" class="card dv-gal-card" data-id="${d.id}"><span class="dv-gal-top"><b>${d.year}</b><span>${esc(d.family)}</span></span><canvas></canvas><span class="dv-gal-name">${esc(d.short)}</span><span class="dv-gal-key"><i class="off"></i>off <i class="on"></i>on</span></button>`).join('');
  const draw = () => host.querySelectorAll('.dv-gal-card').forEach(c => drawThumb(c.querySelector('canvas'), BY_ID[c.dataset.id]));
  draw(); let t; new ResizeObserver(() => { clearTimeout(t); t = setTimeout(draw, 120); }).observe(host);
  host.addEventListener('click', e => { const c = e.target.closest('.dv-gal-card'); if (!c) return; select(c.dataset.id); $('#atlas').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); });
}

// ---------------------------------------------------------------- band alignment chart
const pretty = id => (MATS[id]?.name || id);
const shortName = id => ({ SiO2: 'SiO₂', Si3N4: 'Si₃N₄', Al2O3: 'Al₂O₃', HfO2: 'HfO₂', Ga2O3: 'Ga₂O₃', MoS2: 'MoS₂', 'C-H': 'C:H', 'C-O': 'C:O' }[id] || id);
let hjPick = [];
function buildAlign() {
  const svg = $('#dvAlign'), tip = $('#dvAlignTip');
  const mats = [...ALIGN.materials].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'insulator' ? 1 : -1));
  const W = 980, H = 470, pad = { l: 56, r: 16, t: 26, b: 64 }, top = 2, bot = -10.5;
  const Y = E => pad.t + (top - E) / (top - bot) * (H - pad.t - pad.b), bw = (W - pad.l - pad.r) / mats.length;
  let g = '';
  for (let e = 2; e >= -10; e -= 2) g += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${Y(e)}" y2="${Y(e)}" stroke="#1d2530"/><text x="${pad.l - 8}" y="${Y(e) + 4}" text-anchor="end" class="ax">${e}</text>`;
  g += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="#e8ecf1" stroke-dasharray="6 5" opacity=".6"/><text x="${W - pad.r}" y="${Y(0) - 6}" text-anchor="end" class="lab">vacuum level</text>`;
  const si = MATS.Si; g += `<rect x="${pad.l}" y="${Y(-si.chi)}" width="${W - pad.l - pad.r}" height="${Y(-si.chi - si.Eg) - Y(-si.chi)}" fill="#7fd3d0" opacity=".05"/>`;
  const firstIns = mats.findIndex(m => m.kind === 'insulator');
  g += `<line x1="${pad.l + firstIns * bw}" x2="${pad.l + firstIns * bw}" y1="${pad.t - 16}" y2="${H - pad.b + 44}" stroke="#2f3845"/><text x="${pad.l + 4}" y="${pad.t - 10}" class="lab">semiconductors</text><text x="${pad.l + firstIns * bw + 6}" y="${pad.t - 10}" class="lab">gate dielectrics</text>`;
  mats.forEach((m, i) => {
    const x = pad.l + i * bw + bw * 0.16, w = bw * 0.68, ec = -m.chi, ev = -m.chi - m.Eg;
    g += `<g class="dv-bar" data-id="${m.id}" tabindex="0" role="button" aria-label="${esc(m.name)}: electron affinity ${m.chi} eV, band gap ${m.Eg} eV">
      <rect x="${pad.l + i * bw}" y="${pad.t}" width="${bw}" height="${H - pad.t - pad.b + 40}" fill="transparent"/>
      <rect class="fillr" x="${x}" y="${Y(ec)}" width="${w}" height="${Y(ev) - Y(ec)}" fill="${m.kind === 'insulator' ? '#b58fd6' : '#7fd3d0'}" opacity=".16" rx="2"/>
      <line x1="${x}" x2="${x + w}" y1="${Y(ec)}" y2="${Y(ec)}" stroke="#3987e5" stroke-width="3"/>
      <line x1="${x}" x2="${x + w}" y1="${Y(ev)}" y2="${Y(ev)}" stroke="#d95926" stroke-width="3"/>
      ${Y(ev) - Y(ec) > 18 ? `<text x="${x + w / 2}" y="${(Y(ec) + Y(ev)) / 2 + 4}" text-anchor="middle" class="gap">${m.Eg.toFixed(m.Eg < 1 ? 2 : 1)}</text>` : ''}
      <text x="${x + w / 2}" y="${H - pad.b + 18}" text-anchor="end" transform="rotate(-40 ${x + w / 2} ${H - pad.b + 18})" class="nm">${esc(shortName(m.id))}</text></g>`;
  });
  g += `<text x="16" y="${(pad.t + H - pad.b) / 2}" transform="rotate(-90 16 ${(pad.t + H - pad.b) / 2})" text-anchor="middle" class="lab">energy relative to vacuum (eV)</text>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = g;
  const show = (el, ev) => {
    const m = MATS[el.dataset.id], r = svg.parentElement.parentElement.getBoundingClientRect(), br = el.getBoundingClientRect();
    tip.hidden = false;
    tip.innerHTML = `<b>${esc(m.name)}</b><br>χ = ${m.chi} eV · E<sub>g</sub> = ${m.Eg} eV<br>E<sub>c</sub> = ${(-m.chi).toFixed(2)} · E<sub>v</sub> = ${(-m.chi - m.Eg).toFixed(2)} eV${m.note ? `<br><span class="muted">${esc(m.note)}</span>` : ''}`;
    const x = Math.min(Math.max(br.left - r.left + br.width / 2 - 130, 8), r.width - 270);
    tip.style.left = x + 'px'; tip.style.top = Math.max(br.top - r.top + 40, 8) + 'px';
  };
  svg.querySelectorAll('.dv-bar').forEach(el => {
    el.addEventListener('pointerenter', e => show(el, e)); el.addEventListener('focus', e => show(el, e));
    el.addEventListener('pointerleave', () => (tip.hidden = true)); el.addEventListener('blur', () => (tip.hidden = true));
    const pick = () => { hjPick.push(el.dataset.id); if (hjPick.length > 2) hjPick = hjPick.slice(-2); markPicks(); if (hjPick.length === 2) setHJ(hjPick[0], hjPick[1]); };
    el.addEventListener('click', pick); el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });
  $('#dvAlignNote').textContent = 'The faint horizontal strip marks silicon\'s gap for reference. ' + ALIGN._about;
}
function markPicks() { document.querySelectorAll('#dvAlign .dv-bar').forEach(b => b.classList.toggle('picked', hjPick.includes(b.dataset.id))); }

// ---------------------------------------------------------------- heterojunction builder
const HJ_PRESETS = [
  ['GaN', 'AlGaN', 'AlGaN / GaN (HEMT)'], ['GaAs', 'AlGaAs', 'AlGaAs / GaAs'], ['Si', 'SiGe', 'Si / SiGe (HBT)'], ['InGaAs', 'InP', 'InP / InGaAs'],
  ['Si', 'SiO2', 'Si / SiO₂'], ['Si', 'HfO2', 'Si / HfO₂'], ['Si', 'Ge', 'Si / Ge'], ['InAs', 'C-H', 'InAs / H-diamond'],
];
function buildHJ() {
  const opts = ALIGN.materials.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
  $('#hjA').innerHTML = opts; $('#hjB').innerHTML = opts;
  $('#hjPresets').innerHTML = HJ_PRESETS.map(([a, b, l], i) => `<button type="button" data-i="${i}">${l}</button>`).join('');
  $('#hjPresets').onclick = e => { const b = e.target.closest('button'); if (!b) return; const [A, B] = HJ_PRESETS[+b.dataset.i]; setHJ(A, B); };
  $('#hjA').onchange = $('#hjB').onchange = () => drawHJ();
  setHJ('GaN', 'AlGaN');
}
function setHJ(a, b) { $('#hjA').value = a; $('#hjB').value = b; drawHJ(); }
function drawHJ() {
  const A = MATS[$('#hjA').value], B = MATS[$('#hjB').value], r = heterojunction(A, B);
  document.querySelectorAll('#hjPresets button').forEach((btn, i) => btn.setAttribute('aria-pressed', String(HJ_PRESETS[i][0] === A.id && HJ_PRESETS[i][1] === B.id)));
  const W = 720, H = 420, pad = { l: 60, r: 60, t: 40, b: 40 }, xm = W / 2;
  const top = Math.max(0.6, Math.max(r.Ec1, r.Ec2) + 0.6), bot = Math.min(r.Ev1, r.Ev2) - 0.6;
  const Y = E => pad.t + (top - E) / (top - bot) * (H - pad.t - pad.b);
  const xa = pad.l, xb = W - pad.r;
  let g = `<rect x="${xa}" y="${pad.t}" width="${xm - xa}" height="${H - pad.t - pad.b}" fill="rgba(255,255,255,.03)"/>
    <text x="${(xa + xm) / 2}" y="${pad.t - 14}" text-anchor="middle" class="nm">${esc(A.name)}</text><text x="${(xm + xb) / 2}" y="${pad.t - 14}" text-anchor="middle" class="nm">${esc(B.name)}</text>
    <line x1="${xa}" x2="${xb}" y1="${Y(0)}" y2="${Y(0)}" stroke="#e8ecf1" stroke-dasharray="6 5" opacity=".55"/><text x="${xb}" y="${Y(0) - 6}" text-anchor="end" class="lab">vacuum level</text>`;
  const band = (x0, x1, ec, ev, m) => `<rect x="${x0 + 4}" y="${Y(ec)}" width="${x1 - x0 - 8}" height="${Y(ev) - Y(ec)}" fill="${m.kind === 'insulator' ? '#b58fd6' : '#7fd3d0'}" opacity=".1"/>
      <line x1="${x0}" x2="${x1}" y1="${Y(ec)}" y2="${Y(ec)}" stroke="#3987e5" stroke-width="3"/><line x1="${x0}" x2="${x1}" y1="${Y(ev)}" y2="${Y(ev)}" stroke="#d95926" stroke-width="3"/>
      <text x="${(x0 + x1) / 2}" y="${(Y(ec) + Y(ev)) / 2 + 5}" text-anchor="middle" class="gapb">E<tspan dy="3" font-size="10">g</tspan><tspan dy="-3"> = ${m.Eg.toFixed(2)} eV</tspan></text>`;
  g += band(xa, xm, r.Ec1, r.Ev1, A) + band(xm, xb, r.Ec2, r.Ev2, B);
  g += `<line x1="${xm}" x2="${xm}" y1="${Y(Math.max(r.Ec1, r.Ec2))}" y2="${Y(Math.min(r.Ec1, r.Ec2))}" stroke="#3987e5" stroke-width="3"/><line x1="${xm}" x2="${xm}" y1="${Y(Math.max(r.Ev1, r.Ev2))}" y2="${Y(Math.min(r.Ev1, r.Ev2))}" stroke="#d95926" stroke-width="3"/>`;
  // χ arrows
  const arrow = (x, e0, e1, col, label, side) => Math.abs(e1 - e0) < 0.02 ? '' : `<line x1="${x}" x2="${x}" y1="${Y(e0)}" y2="${Y(e1)}" stroke="${col}" stroke-width="1.3" marker-end="url(#hjA2)" marker-start="url(#hjA1)"/><text x="${x + (side < 0 ? -6 : 6)}" y="${(Y(e0) + Y(e1)) / 2 + 4}" text-anchor="${side < 0 ? 'end' : 'start'}" class="lab" fill="${col}">${label}</text>`;
  g += `<defs><marker id="hjA2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker><marker id="hjA1" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs>`;
  g += arrow(xa + 26, 0, r.Ec1, '#aab3c0', `χ = ${A.chi.toFixed(2)}`, 1) + arrow(xb - 26, 0, r.Ec2, '#aab3c0', `χ = ${B.chi.toFixed(2)}`, -1);
  g += arrow(xm + 14, r.Ec1, r.Ec2, '#86b6ef', '', 1) + arrow(xm - 14, r.Ev1, r.Ev2, '#ff9c73', '', -1);
  const offLab = (x, e0, e1, col, sym, above, anchor) => { const yy = Math.abs(Y(e0) - Y(e1)) > 30 ? (Y(e0) + Y(e1)) / 2 + 4 : above ? Math.min(Y(e0), Y(e1)) - 10 : Math.max(Y(e0), Y(e1)) + 18; return `<text x="${x}" y="${yy}" text-anchor="${anchor}" class="lab" fill="${col}">ΔE<tspan dy="3" font-size="10">${sym}</tspan><tspan dy="-3"> = ${Math.abs(e1 - e0).toFixed(2)} eV</tspan></text>`; };
  g += offLab(xm + 22, r.Ec1, r.Ec2, '#86b6ef', 'c', true, 'start') + offLab(xm - 22, r.Ev1, r.Ev2, '#ff9c73', 'v', false, 'end');
  g += `<text x="${xa}" y="${H - 12}" class="lab">flat-band alignment before any charge moves (Anderson's rule)</text>`;
  const svg = $('#hjSvg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = g;
  // explanation
  const ins = A.kind === 'insulator' || B.kind === 'insulator';
  const low = r.Ec1 < r.Ec2 ? A : B, lowV = r.Ev1 > r.Ev2 ? A : B;
  let why;
  if (ins) why = `The conduction-band offset of ${Math.abs(r.dEc).toFixed(2)} eV is the barrier gate-leakage electrons must tunnel through, and the valence-band offset of ${Math.abs(r.dEv).toFixed(2)} eV is the barrier for holes. A dielectric needs both above roughly 1 eV: this is why hafnium oxide (1.5 eV to silicon) replaced silicon dioxide (3.1 eV) only because its higher permittivity allows a physically thicker layer. Try it in <a href="physics.html#tunnel">Physics Lab 07</a>.`;
  else if (r.type.startsWith('I ')) why = `Type I (straddling): both band edges of ${esc(low.name)} sit inside the gap of the other material, so electrons and holes both collect on the ${esc(low.name)} side. This is the geometry of quantum wells, semiconductor lasers and the HEMT channel${A.id === 'GaN' || B.id === 'GaN' ? '; in AlGaN/GaN, polarization charge fills the well with electrons even without doping' : ''}.`;
  else if (r.type.startsWith('II')) why = `Type II (staggered): electrons prefer ${esc(low.name)} (lower E<sub>c</sub>) while holes prefer ${esc(lowV.name)} (higher E<sub>v</sub>), so the two carriers are separated across the interface. Useful for tunnel FET junctions, where the effective gap across the interface is smaller than either material's own gap.`;
  else why = `Type III (broken gap): the conduction band on one side lies below the valence band on the other, so electrons flow across with no voltage at all until the charge built up stops them. Hydrogen-terminated diamond's surface conductivity works in a related way: electrons leave diamond's valence band for surface acceptors, leaving a sheet of holes.`;
  $('#hjOut').innerHTML = `<div class="pl-tiles dv-hj-tiles"><div class="pl-tile"><span class="l">ΔE<sub>c</sub></span><span class="v tabnum">${r.dEc >= 0 ? '+' : ''}${r.dEc.toFixed(2)}</span><span class="u">eV (B − A)</span></div><div class="pl-tile"><span class="l">ΔE<sub>v</sub></span><span class="v tabnum">${r.dEv >= 0 ? '+' : ''}${r.dEv.toFixed(2)}</span><span class="u">eV (B − A)</span></div><div class="pl-tile"><span class="l">Alignment</span><span class="v">Type ${esc(r.type.split(' ')[0])}</span><span class="u">${esc(r.type.split(' ').slice(1).join(' ').replace(/[()]/g, ''))}</span></div></div><p>${why}</p><p class="small">Anderson's rule ignores interface dipoles and strain, so measured offsets can differ by a few tenths of an eV (for AlGaN/GaN the measured ΔE<sub>c</sub> is about 70% of the gap difference).</p>`;
}

// ---------------------------------------------------------------- references
function buildRefs() {
  const used = new Set([...DEVICES.flatMap(d => d.refs), ...ALIGN.materials.flatMap(m => m.refs)]);
  const list = [...used].filter(k => REFS[k]).map(k => REFS[k]).sort((a, b) => a.cite.localeCompare(b.cite));
  $('#dvRefs').innerHTML = list.map(r => `<li id="ref-${r.id}">${esc(r.cite)} ${r.link ? `<a href="${r.link}" rel="noopener">${r.doi ? 'doi:' + esc(r.doi) : 'link'}</a>` : ''}</li>`).join('');
}

// ---------------------------------------------------------------- hero animation
function hero() {
  const cv = $('#dvHero'); if (!cv) return;
  const dev = BY_ID.planar_mosfet, parts = Array.from({ length: 70 }, () => ({ x: Math.random() * 0.3, e: -0.05 * Math.log(Math.random()), v: 0.1 + Math.random() * 0.12, dir: 1 }));
  let t = 0, last = performance.now(), visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(cv);
  const tick = now => {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (visible && !document.hidden) {
      t += reduce ? 0 : dt;
      const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = w * dpr; cv.height = h * dpr; }
      const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const vg = 0.2 + 0.8 * (0.5 - 0.5 * Math.cos(t * 0.5)), L = lateral(dev, vg, 0.6, 161);
      const X = x => w * (0.02 + x * 0.96), Y = E => h * 0.3 + (0.45 - E) / 2.3 * h * 0.62;
      const I = x => { const n = L.x.length, tt = clamp(x, 0, 1) * (n - 1), i = Math.min(Math.floor(tt), n - 2), f = tt - i; return L.Ec[i] + (L.Ec[i + 1] - L.Ec[i]) * f; };
      for (const [arr, col] of [[L.Ec, '57,135,229'], [L.Ev, '217,89,38']]) {
        ctx.beginPath(); L.x.forEach((x, i) => (i ? ctx.lineTo(X(x), Y(arr[i])) : ctx.moveTo(X(x), Y(arr[i]))));
        ctx.strokeStyle = `rgba(${col},.55)`; ctx.lineWidth = 3; ctx.shadowColor = `rgba(${col},.8)`; ctx.shadowBlur = 18; ctx.stroke(); ctx.shadowBlur = 0;
      }
      for (const p of parts) {
        const H = 0.04 + p.e, nx = p.x + p.dir * p.v * dt;
        if (I(nx) > H) p.dir = -1; else p.x = nx;
        if (p.x < 0.01 || p.x > 0.99 || (p.dir < 0 && Math.random() < dt * 1.5)) Object.assign(p, { x: Math.random() * 0.2, e: -0.05 * Math.log(Math.random()), dir: 1 });
        const y = p.x > 0.6 ? I(p.x) + 0.02 : H;
        ctx.beginPath(); ctx.arc(X(p.x), Y(y), 2.6, 0, 7); ctx.fillStyle = 'rgba(90,162,255,.8)'; ctx.fill();
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------------------------------------------------------------- progress bar
function progress() {
  const bar = $('.pl-progress i'); if (!bar) return;
  const on = () => { const m = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${m > 0 ? scrollY / m : 0})`; };
  addEventListener('scroll', on, { passive: true }); on();
}

// ---------------------------------------------------------------- record mode (deterministic frames for GIF capture)
function recordMode(id) {
  document.body.classList.add('record');
  const dev = BY_ID[id] || DEVICES[0];
  const stage = document.createElement('div'); stage.id = 'rec';
  stage.innerHTML = `<div class="rec-head"><span class="eyebrow">${esc(dev.family)} · ${dev.year}</span><h2>${esc(dev.name)}</h2><span class="rec-state" id="recState"></span></div>
    <canvas id="recX"></canvas><canvas id="recL"></canvas><div class="rec-foot"><span><i class="e"></i>electron</span><span><i class="h"></i>hole</span><span id="recV"></span><span class="rec-brand">Transistor Odyssey · Device Atlas</span></div>`;
  document.body.appendChild(stage);
  xsec = new XSec($('#recX'), rnd); latView = new LateralView($('#recL'), rnd);
  S.dev = dev; xsec.setScene(SCENES[dev.id], dev); latView.reset(dev);
  const e = ends(dev), m = dev.model, FR = 15;
  S.vd = m.vd[1] * (m.lateral === 'bjt' ? 0.4 : 0.6);
  let k = 0;
  window.__reset = () => { k = 0; };
  window.__frame = (nFrames = 90) => {
    const ph = (k / nFrames) * 2 * Math.PI; k++;
    S.vg = e.off + (e.on - e.off) * (0.5 - 0.5 * Math.cos(ph));
    const L = lateral(dev, S.vg, S.vd, 241, 0), f = onFraction(dev, S.vg), g01 = clamp((S.vg - e.off) / (e.on - e.off), 0, 1);
    const st = { f, vd01: S.vd / m.vd[1], vg01: m.pol < 0 ? -g01 : g01, prog: 0, dt: 1 / FR, speed: 1, labels: true, termLabels: dev.labels, termVolts: { g: `${S.vg.toFixed(Math.abs(m.vg[1] - m.vg[0]) > 5 ? 1 : 2)} V`, d: `${S.vd.toFixed(1)} V` } };
    xsec.draw(st); latView.draw(L, st);
    const s = classify(dev, S.vg, S.vd, 0);
    $('#recState').textContent = STATE_TXT[stateSet(dev)][s]; $('#recState').style.color = STATE_COL[s];
    $('#recV').textContent = `gate ${S.vg.toFixed(2)} V`;
    return k;
  };
  window.__ready = true;
}

// ---------------------------------------------------------------- boot
if (RECORD) {
  document.fonts.ready.then(() => recordMode(RECORD));
} else {
  safe(progress, 'progress'); safe(hero, 'hero');
  xsec = new XSec($('#dvXsec'), rnd); latView = new LateralView($('#dvLat'), rnd); verView = new VerticalView($('#dvVer'), rnd);
  safe(buildPicker, 'picker'); safe(buildTiles, 'tiles');
  const initial = BY_ID[location.hash.slice(1)] ? location.hash.slice(1) : 'finfet';
  select(initial);
  if (BY_ID[location.hash.slice(1)]) requestAnimationFrame(() => $('#atlas').scrollIntoView());
  safe(buildGallery, 'gallery'); safe(buildAlign, 'align'); safe(buildHJ, 'hetero'); safe(buildRefs, 'refs');

  $('#dvPlay').onclick = () => setPlaying(!S.playing);
  $('#dvSpeed').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.speed = +b.dataset.v; $('#dvSpeed').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
  $('#dvLabels').onchange = e => { S.labels = e.target.checked; };
  $('#dvProg').onclick = program; $('#dvErase').onclick = erase;
  const cx = $('#dvXsec');
  cx.addEventListener('pointermove', e => { const r = cx.getBoundingClientRect(); xsec.hover = [e.clientX - r.left, e.clientY - r.top]; });
  cx.addEventListener('pointerleave', () => { xsec.hover = null; });
  addEventListener('hashchange', () => { const id = location.hash.slice(1); if (BY_ID[id] && id !== S.dev.id) { select(id); $('#atlas').scrollIntoView(); } });

  let visible = true, last = performance.now();
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { rootMargin: '100px' }).observe($('#atlas .dv-grid'));
  if (!reduce) setPlaying(true);
  const tick = now => {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (visible && !document.hidden) safe(() => frame(reduce ? dt * 0.3 : dt), 'frame');
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
