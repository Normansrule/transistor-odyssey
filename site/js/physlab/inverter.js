// Lab 13 — CMOS inverter: from one transistor to a logic gate.
import * as INV from '../physics/inverter.js';
import { DATA } from '../data.js';
import { panel, tiles, experiments, hiCanvas, loop, sci, fix, frame, axes, linear, log, path, el, C, hover, tipRows, txt, clamp, fw, onWidth, reduceMotion } from './ui.js';

const ERAS = [['1999_180nm', '180 nm'], ['2007_45nm_hkmg', '45 nm'], ['2011_22nm_finfet', '22 nm FinFET'], ['2025_2nm_gaa', '2 nm GAA'], ['2026_mos2_2d', 'MoS₂']];
const BETA0 = { '1999_180nm': 0.5, '2007_45nm_hkmg': 0.6, '2011_22nm_finfet': 0.8, '2025_2nm_gaa': 0.9, '2026_mos2_2d': 0.5 };

export function init(sec) {
  const P = DATA.presets;
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'era', type: 'seg', label: 'Transistor generation', options: ERAS, value: '2011_22nm_finfet' },
    { key: 'vdd', label: 'Supply voltage V_DD', min: 0.2, max: 1.8, step: 0.01, value: 0.8, fmt: v => v.toFixed(2) + ' V' },
    { key: 'beta', label: 'pFET strength (p/n)', min: 0.2, max: 1.5, step: 0.01, value: 0.8, fmt: v => v.toFixed(2) + '×' },
    { key: 'fo', label: 'Fan-out (gates driven)', min: 1, max: 8, step: 1, value: 4, fmt: v => v.toFixed(0) },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'vm', label: 'Switching threshold V_M', unit: 'V' }, { key: 'nm', label: 'Noise margins low / high', unit: 'V' },
    { key: 'gain', label: 'Peak voltage gain', unit: '|dV_out/dV_in|' }, { key: 'tp', label: 'Gate delay t_p', unit: 'ps (step input)' },
    { key: 'e', label: 'Energy per cycle C·V²', unit: 'fJ per µm' }, { key: 'f', label: '11-stage ring oscillator', unit: 'GHz' },
  ]);
  const anim = sec.querySelector('[data-role=invanim]'), cv = hiCanvas(anim.querySelector('canvas'));
  const vtcHost = sec.querySelector('[data-role=vtc]'), eraHost = sec.querySelector('[data-role=eras]');
  let M = null, wf = null, phase = 0, dots = [];

  ctl.on((k, final) => {
    if (k === 'era') { const p = P[ctl.state.era]; ctl.inputs.vdd.inp.max = Math.max(p.VDD * 1.25, 1.0); ctl.set('vdd', p.VDD, false); ctl.set('beta', BETA0[ctl.state.era], false); }
    compute();
  });

  function compute() {
    const s = ctl.state, p = P[s.era];
    const vdd = Math.min(s.vdd, p.VDD * 1.25);
    M = INV.metrics(p, vdd, s.beta, s.fo);
    wf = { fall: INV.waveform(p, vdd, s.beta, s.fo, true, 120), rise: INV.waveform(p, vdd, s.beta, s.fo, false, 120), vdd };
    show({ vm: M.VM.toFixed(3), nm: `${M.NML.toFixed(2)} / ${M.NMH.toFixed(2)}`, gain: M.gain.toFixed(1), tp: M.tp_ps < 10 ? M.tp_ps.toFixed(2) : M.tp_ps.toFixed(1),
      e: M.E_fJ < 10 ? M.E_fJ.toFixed(2) : M.E_fJ.toFixed(1), f: M.f_ring_GHz.toFixed(1) });
    drawVTC(); drawEras();
  }

  // ---------------- animated schematic + slow-motion oscilloscope
  function vOutAt(tNorm) {            // tNorm in [0,1): first half input high (output falls), second half input low (output rises)
    const half = tNorm < 0.5, w = half ? wf.fall : wf.rise, tEnd = 3.2 * M.tp_ps * 1e-12;
    const t = (half ? tNorm : tNorm - 0.5) * 2 * tEnd;
    const i = w.t.findIndex(x => x >= t);
    const v = i < 0 ? w.V[w.V.length - 1] : i === 0 ? w.V[0] : w.V[i - 1] + (w.V[i] - w.V[i - 1]) * (t - w.t[i - 1]) / (w.t[i] - w.t[i - 1]);
    return { vin: half ? wf.vdd : 0, vout: v, t };
  }
  function paint(dt) {
    if (!M) return;
    cv.resize(); const { ctx, w, h } = cv; ctx.clearRect(0, 0, w, h);
    phase = (phase + dt * (reduceMotion ? 0.05 : 0.16)) % 1;
    const { vin, vout } = vOutAt(phase), vdd = wf.vdd;
    const narrow = w < 560, sw = narrow ? w - 48 : Math.min(w * 0.45, 360), x0 = 24, cx = x0 + sw * (narrow ? 0.38 : 0.5);
    const yT = 34, yB = h - 30, yO = (yT + yB) / 2;
    // rails
    ctx.strokeStyle = '#e2b650'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0 + 10, yT); ctx.lineTo(x0 + sw - 10, yT); ctx.stroke();
    ctx.strokeStyle = '#5b6573'; ctx.beginPath(); ctx.moveTo(x0 + 10, yB); ctx.lineTo(x0 + sw - 10, yB); ctx.stroke();
    ctx.font = '600 12px "IBM Plex Mono", monospace'; ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd27a'; ctx.fillText(`V_DD ${vdd.toFixed(2)} V`, x0 + 12, yT - 10); ctx.fillStyle = '#aab3c0'; ctx.fillText('ground', x0 + 12, yB + 20);
    // transistors as channels whose brightness follows conduction
    const pOn = vin < vdd / 2, nOn = !pOn;
    const tr = (y0, y1, on, label, col) => {
      const xa = cx - 18, H = y1 - y0;
      ctx.fillStyle = on ? col : 'rgba(138,148,163,.18)'; ctx.globalAlpha = on ? 0.9 : 1;
      ctx.fillRect(xa, y0, 36, H); ctx.globalAlpha = 1;
      ctx.strokeStyle = '#2f3845'; ctx.lineWidth = 1; ctx.strokeRect(xa + .5, y0 + .5, 35, H - 1);
      ctx.fillStyle = '#f2b84b'; ctx.fillRect(xa - 14, y0 + 4, 6, H - 8);       // gate plate
      ctx.fillStyle = '#e8ecf1'; ctx.font = '600 12px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'left'; ctx.fillText(label, cx + 26, (y0 + y1) / 2 + 4);
      ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillStyle = on ? '#ffd27a' : '#8a94a3'; ctx.fillText(on ? 'on' : 'off', cx + 26, (y0 + y1) / 2 + 19);
    };
    tr(yT + 6, yO - 22, pOn, 'pFET (pull-up)', '#ff8a55');
    tr(yO + 22, yB - 6, nOn, 'nFET (pull-down)', '#5aa2ff');
    // input wire to both gates
    ctx.strokeStyle = vin > 0 ? '#f2b84b' : '#5b6573'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, yO); ctx.lineTo(cx - 40, yO); ctx.moveTo(cx - 40, yT + 18); ctx.lineTo(cx - 40, yB - 18); ctx.stroke();
    ctx.fillStyle = '#e8ecf1'; ctx.textAlign = 'left'; ctx.fillText(`in ${vin.toFixed(2)} V`, x0, yO - 8);
    // output node and load capacitor (fill shows stored charge)
    const capX = cx + sw * 0.43, fill = clamp(vout / vdd, 0, 1);
    ctx.strokeStyle = '#aab3c0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, yO); ctx.lineTo(capX, yO); ctx.lineTo(capX, yO + 12); ctx.stroke();
    ctx.fillStyle = 'rgba(57,135,229,.15)'; ctx.fillRect(capX - 22, yO + 14, 44, 46);
    ctx.fillStyle = `rgba(90,162,255,${0.25 + 0.6 * fill})`; ctx.fillRect(capX - 22, yO + 14 + 46 * (1 - fill), 44, 46 * fill);
    ctx.strokeStyle = '#aab3c0'; ctx.strokeRect(capX - 22 + .5, yO + 14.5, 43, 45);
    ctx.beginPath(); ctx.moveTo(capX, yO + 60); ctx.lineTo(capX, yB); ctx.stroke();
    ctx.fillStyle = '#e8ecf1'; ctx.font = '11px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText(`C_L ${M.CL_fF.toFixed(1)} fF`, capX, yO + 76); ctx.fillText(`out ${vout.toFixed(2)} V`, capX, yO - 8);
    // charge flow: dots along the active path
    const flowing = Math.abs(vout - (pOn ? vdd : 0)) > 0.02 * vdd;
    if (flowing && dots.length < 26 && Math.random() < 0.5) dots.push({ s: 0, v: 0.6 + Math.random() * 0.6, up: pOn });
    dots = dots.filter(d => (d.s += dt * d.v * (reduceMotion ? 0.3 : 1)) < 1 && d.up === pOn);
    for (const d of dots) {
      const pts = d.up ? [[cx, yT], [cx, yO], [capX, yO], [capX, yO + 30]] : [[capX, yO + 30], [capX, yO], [cx, yO], [cx, yB]];
      const seg = d.s * 3, k = Math.min(Math.floor(seg), 2), f = seg - k, a = pts[k], b = pts[k + 1];
      ctx.beginPath(); ctx.arc(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 3, 0, 7); ctx.fillStyle = d.up ? '#ffb38a' : '#86b6ef'; ctx.fill();
    }
    // oscilloscope
    const ox = x0 + sw + 24, ow = w - ox - 16, oy = 30, oh = h - 64;
    if (!narrow && ow > 160) {
      ctx.fillStyle = 'rgba(10,13,17,.6)'; ctx.fillRect(ox, oy, ow, oh); ctx.strokeStyle = '#232a34'; ctx.strokeRect(ox + .5, oy + .5, ow - 1, oh - 1);
      const X = u => ox + 8 + u * (ow - 16), Y = v => oy + oh - 10 - v / vdd * (oh - 28);
      ctx.strokeStyle = '#2f3845'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(ox, Y(vdd / 2)); ctx.lineTo(ox + ow, Y(vdd / 2)); ctx.stroke(); ctx.setLineDash([]);
      const trace = (fn, col) => { ctx.beginPath(); for (let i = 0; i <= 200; i++) { const u = i / 200, v = fn(u); i ? ctx.lineTo(X(u), Y(v)) : ctx.moveTo(X(u), Y(v)); } ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); };
      trace(u => vOutAt(u).vin, 'rgba(242,184,75,.85)'); trace(u => vOutAt(u).vout, '#5aa2ff');
      ctx.strokeStyle = '#e8ecf1'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(phase), oy + 4); ctx.lineTo(X(phase), oy + oh - 4); ctx.stroke();
      // delay markers
      const tEnd = 3.2 * M.tp_ps * 1e-12;
      const mk = (u0, tp) => { const u = u0 + tp / tEnd / 2; ctx.fillStyle = '#e8ecf1'; ctx.beginPath(); ctx.arc(X(u), Y(vdd / 2), 3.5, 0, 7); ctx.fill(); };
      mk(0, M.tpHL_ps * 1e-12); mk(0.5, M.tpLH_ps * 1e-12);
      ctx.font = '11px "IBM Plex Mono", monospace'; ctx.textAlign = 'left';
      ctx.fillStyle = '#ffd27a'; ctx.fillText('V_in', ox + 10, oy + 14); ctx.fillStyle = '#86b6ef'; ctx.fillText('V_out', ox + 52, oy + 14);
      ctx.fillStyle = '#8a94a3'; ctx.textAlign = 'right'; ctx.fillText(`one period = ${(2 * tEnd * 1e12).toFixed(tEnd < 1e-11 ? 1 : 0)} ps, slowed ~10¹¹×`, ox + ow - 8, oy + 14);
      ctx.textAlign = 'left'; ctx.fillStyle = '#aab3c0'; ctx.fillText(`t_pHL ${M.tpHL_ps.toFixed(2)} ps · t_pLH ${M.tpLH_ps.toFixed(2)} ps`, ox + 10, oy + oh - 14);
    }
  }
  loop(anim, dt => paint(dt));

  function drawVTC() {
    const f = frame(vtcHost, { w: fw(vtcHost), h: 300, m: { t: 14, r: 16, b: 40, l: 50 } }), vdd = wf.vdd;
    const xs = linear(0, vdd, f.x0, f.x1), ys = linear(0, vdd, f.y0, f.y1);
    const t = [0, vdd / 4, vdd / 2, 3 * vdd / 4, vdd].map(v => +v.toFixed(2));
    axes(f, xs, ys, { xt: t, yt: t, xl: 'input voltage (V)', yl: 'output voltage (V)', xf: v => v.toFixed(2), yf: v => v.toFixed(2) });
    // noise-margin bands
    el('rect', { x: xs(0), y: f.y1, width: xs(M.VIL) - xs(0), height: f.y0 - f.y1, fill: C.s3, opacity: 0.08 }, f.svg);
    el('rect', { x: xs(M.VIH), y: f.y1, width: xs(vdd) - xs(M.VIH), height: f.y0 - f.y1, fill: C.s3, opacity: 0.08 }, f.svg);
    const pts = Array.from(M.vin, (v, i) => [xs(v), ys(M.vout[i])]);
    el('path', { d: path(Array.from(M.vin, (v, i) => [xs(M.vout[i]), ys(v)])), fill: 'none', stroke: C.muted, 'stroke-width': 1.2, 'stroke-dasharray': '4 4' }, f.svg);
    el('path', { d: path(pts), fill: 'none', stroke: C.s1, 'stroke-width': 2.4 }, f.svg);
    el('line', { x1: xs(0), y1: ys(0), x2: xs(vdd), y2: ys(vdd), stroke: C.axis, 'stroke-dasharray': '2 4' }, f.svg);
    el('circle', { cx: xs(M.VM), cy: ys(M.VM), r: 5, fill: '#f2b84b' }, f.svg);
    for (const v of [M.VIL, M.VIH]) el('line', { x1: xs(v), x2: xs(v), y1: f.y0, y2: f.y1, stroke: C.s3, 'stroke-dasharray': '3 3' }, f.svg);
    txt(f.svg, xs(M.VM) + 8, ys(M.VM) - 8, `V_M ${M.VM.toFixed(2)} V`, { fill: '#ffd27a' });
    txt(f.svg, xs(M.VIL / 2), f.y1 + 14, 'reads 0', { 'text-anchor': 'middle', fill: '#7fd3d0' });
    txt(f.svg, xs((M.VIH + vdd) / 2), f.y1 + 14, 'reads 1', { 'text-anchor': 'middle', fill: '#7fd3d0' });
    hover(f, vtcHost, xs, v => { const i = Math.round(v / vdd * (M.vin.length - 1)); return tipRows(`V_in = ${v.toFixed(3)} V`, [['V_out', M.vout[clamp(i, 0, M.vout.length - 1)].toFixed(3) + ' V']]); });
  }

  function drawEras() {
    const f = frame(eraHost, { w: fw(eraHost), h: 300, m: { t: 14, r: 16, b: 40, l: 56 } });
    const s = ctl.state;
    const rows = ERAS.map(([k, name]) => { const p = P[k], m = INV.metrics(p, p.VDD, BETA0[k], 4); return { k, name, tp: m.tp_ps, e: m.E_fJ, leak: m.Pleak_nW }; });
    const xs = log(0.5, 200, f.x0, f.x1), ys = log(1, 100, f.y0, f.y1);
    axes(f, xs, ys, { xt: [0.5, 1, 2, 5, 10, 20, 50, 100, 200], yt: [1, 2, 5, 10, 20, 50, 100], xl: 'gate delay t_p (ps), fan-out 4', yl: 'energy per cycle (fJ/µm)', xf: v => String(v), yf: v => String(v) });
    el('path', { d: path(rows.map(r => [xs(r.tp), ys(r.e)])), fill: 'none', stroke: C.axis, 'stroke-width': 1.2 }, f.svg);
    for (const r of rows) {
      const on = r.k === s.era;
      el('circle', { cx: xs(r.tp), cy: ys(r.e), r: on ? 7 : 5, fill: on ? '#f2b84b' : C.s1, stroke: C.surface, 'stroke-width': 1.5 }, f.svg);
      txt(f.svg, xs(r.tp) + 9, ys(r.e) + 4, r.name, { fill: on ? '#ffd27a' : C.ink2 });
    }
    if (M) el('circle', { cx: xs(clamp(M.tp_ps, 0.5, 200)), cy: ys(clamp(M.E_fJ, 1, 100)), r: 4, fill: 'none', stroke: '#e8ecf1', 'stroke-width': 1.5 }, f.svg);
  }

  experiments(sec.querySelector('.lab-exp'), [
    { label: 'Halve the supply voltage', run: api => api.animate({ vdd: P[ctl.state.era].VDD / 2 }, 700), note: 'Energy per switch falls as V², a factor of four, but the transistors now run close to threshold and the delay grows several-fold. This trade is why phones drop V_DD when idle and why a chip cannot simply run at 0.3 V.' },
    { label: 'Make the pFET weak', run: api => api.animate({ beta: 0.25 }, 700), note: 'With a weak pull-up the input must fall further before the pFET wins: the switching threshold V_M moves toward ground and the low-to-high delay grows. Designers widen pFETs (about 2× in planar silicon) to rebalance; FinFETs and nanosheets made pFETs nearly as strong as nFETs.' },
    { label: 'Compare 45 nm planar with 22 nm FinFET', run: api => { api.set('era', '2007_45nm_hkmg'); setTimeout(() => api.set('era', '2011_22nm_finfet'), 1600); }, note: 'Watch the peak gain: the 45 nm planar device has strong drain-induced barrier lowering, so its output pulls on its own current and the transfer curve softens (gain ~7). The FinFET roughly triples the gain and widens the noise margins at a lower supply.' },
    { label: 'Drive a heavy load', run: api => api.animate({ fo: 8 }, 600), note: 'Delay grows almost linearly with load capacitance, t ≈ C·V/(2·I): that is why logical effort and buffer chains exist, and why wires (Lab 15) dominate delay in modern chips.' },
  ], ctl);

  compute();
  onWidth([vtcHost, eraHost], () => { drawVTC(); drawEras(); });
}
