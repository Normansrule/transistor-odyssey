// "Read the band diagram" self-test: questions generated from the same band models as the atlas.
import { lateral, onFraction, heterojunction } from './bands.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const EC = '#3987e5', EV = '#d95926', EF = '#f2b84b', MUTED = '#8a94a3';

function ends(dev) {
  const [a, b] = dev.model.vg;
  return onFraction(dev, a) <= onFraction(dev, b) ? { off: a, on: b } : { off: b, on: a };
}
function canvasCtx(cv) {
  const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
  cv.width = w * dpr; cv.height = h * dpr; const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { ctx, w, h };
}
function drawLateral(cv, L, { labels = true, tag = '' } = {}) {
  const { ctx, w, h } = canvasCtx(cv), pad = { l: 36, r: 12, t: labels ? 26 : 14, b: 14 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b;
  let lo = Infinity, hi = -Infinity; for (let i = 0; i < L.x.length; i++) if (!isNaN(L.Ec[i])) { lo = Math.min(lo, L.Ev[i]); hi = Math.max(hi, L.Ec[i]); }
  const sp = hi - lo; lo -= sp * 0.08; hi += sp * 0.1;
  const X = x => pad.l + x * W, Y = E => pad.t + (hi - E) / (hi - lo) * H;
  ctx.font = '11px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
  (L.regions || []).forEach(([a, b, name], i) => { ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.055)'; ctx.fillRect(X(a), pad.t, (b - a) * W, H); if (labels) { ctx.fillStyle = MUTED; ctx.fillText(name, X((a + b) / 2), pad.t - 9); } });
  const line = (arr, col) => { ctx.beginPath(); let pen = false; L.x.forEach((x, i) => { const v = arr[i]; if (isNaN(v)) { pen = false; return; } pen ? ctx.lineTo(X(x), Y(v)) : ctx.moveTo(X(x), Y(v)); pen = true; }); ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.stroke(); };
  line(L.Ec, EC); line(L.Ev, EV);
  ctx.setLineDash([6, 5]); ctx.strokeStyle = EF; ctx.lineWidth = 1.3; ctx.beginPath();
  if (L.EF) L.x.forEach((x, i) => (i ? ctx.lineTo(X(x), Y(L.EF[i])) : ctx.moveTo(X(x), Y(L.EF[i]))));
  else { ctx.moveTo(X(0), Y(L.EFs)); ctx.lineTo(X(0.3), Y(L.EFs)); ctx.moveTo(X(0.7), Y(L.EFd)); ctx.lineTo(X(1), Y(L.EFd)); }
  ctx.stroke(); ctx.setLineDash([]);
  ctx.textAlign = 'right'; ctx.fillStyle = '#86b6ef'; ctx.fillText('Ec', pad.l - 5, Y(L.Ec.find(v => !isNaN(v))) + 4);
  ctx.fillStyle = '#ff9c73'; ctx.fillText('Ev', pad.l - 5, Y(L.Ev.find(v => !isNaN(v))) + 4);
  if (tag) { ctx.font = '700 15px "Oxanium", sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#e8ecf1'; ctx.fillText(tag, pad.l + 8, pad.t + 18); }
}
function drawAlign(cv, A, B) {
  const { ctx, w, h } = canvasCtx(cv), r = heterojunction(A, B), pad = 30, xm = w / 2;
  const top = Math.max(r.Ec1, r.Ec2) + 0.5, bot = Math.min(r.Ev1, r.Ev2) - 0.5, Y = E => pad + (top - E) / (top - bot) * (h - 2 * pad);
  const blk = (x0, x1, ec, ev, m) => {
    ctx.fillStyle = m.kind === 'insulator' ? 'rgba(181,143,214,.12)' : 'rgba(127,211,208,.10)'; ctx.fillRect(x0 + 4, Y(ec), x1 - x0 - 8, Y(ev) - Y(ec));
    ctx.lineWidth = 3; ctx.strokeStyle = EC; ctx.beginPath(); ctx.moveTo(x0, Y(ec)); ctx.lineTo(x1, Y(ec)); ctx.stroke();
    ctx.strokeStyle = EV; ctx.beginPath(); ctx.moveTo(x0, Y(ev)); ctx.lineTo(x1, Y(ev)); ctx.stroke();
    ctx.fillStyle = '#e8ecf1'; ctx.font = '600 13px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'center'; const nm = m.name.split(' (')[0]; ctx.fillText(ctx.measureText(nm).width > x1 - x0 - 8 ? m.id.replace('C-H', 'H-diamond') : nm, (x0 + x1) / 2, 18);
  };
  blk(40, xm, r.Ec1, r.Ev1, A); blk(xm, w - 40, r.Ec2, r.Ev2, B);
}
const shuffle = (a, rnd) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function initQuiz(DEVICES, ALIGN, { onOpen } = {}) {
  const host = document.querySelector('#quiz'); if (!host) return;
  const BY = Object.fromEntries(DEVICES.map(d => [d.id, d])), rnd = Math.random;
  const FETS = DEVICES.filter(d => d.model.lateral === 'fet' && d.carrier === 'e' && !d.model.vscale && !d.model.flash).map(d => d.id);
  const DISTINCT = ['point_contact', 'bjt', 'tfet', 'cnt_fet', 'diamond_fet', 'planar_mosfet'];
  const PAIRS = [['GaN', 'AlGaN'], ['Si', 'Ge'], ['InAs', 'C-H'], ['GaAs', 'AlGaAs'], ['Si', 'SiGe'], ['InGaAs', 'InP'], ['Si', 'GaAs'], ['Ge', 'GaAs'], ['InAs', 'GaAs'], ['GaN', '4H-SiC']];
  const MAT = Object.fromEntries(ALIGN.materials.map(m => [m.id, m]));

  const gen = {
    state() {
      const d = BY[FETS[Math.floor(rnd() * FETS.length)]], e = ends(d), on = rnd() < 0.5, vg = on ? e.off + 0.95 * (e.on - e.off) : e.off, L = lateral(d, vg, d.model.vd[1] * 0.5, 181);
      return { draw: [cv => drawLateral(cv, L)], q: `This is the ${esc(d.name)} along its current path, with the drain biased. Is the transistor on or off?`,
        opts: ['Off: electrons from the source face a barrier', 'On: electrons flow over a low barrier to the drain'], ans: on ? 1 : 0,
        why: on ? `On. The conduction-band hump between source and channel is only ${L.barrier.toFixed(2)} eV high, so a large share of electrons have the thermal energy to cross it.`
          : `Off. The source barrier is ${L.barrier.toFixed(2)} eV, about ${Math.round(L.barrier / 0.0259)} kT at room temperature; only about 1 electron in 10^${Math.round(L.barrier / 0.0259 / 2.303)} gets over.`, dev: d.id };
    },
    identify() {
      const ids = shuffle([...DISTINCT], rnd).slice(0, 4), d = BY[ids[0]], e = ends(d), L = lateral(d, e.off + 0.9 * (e.on - e.off), d.model.vd[1] * 0.4, 181);
      const opts = shuffle([...ids], rnd);
      return { draw: [cv => drawLateral(cv, L, { labels: false })], q: 'Which device produces this band diagram (switched on, along the current path)?',
        opts: opts.map(i => BY[i].name), ans: opts.indexOf(d.id), why: `${esc(d.name)}: ${esc(d.summary.split('. ')[0])}.`, dev: d.id };
    },
    hetero() {
      const [a, b] = PAIRS[Math.floor(rnd() * PAIRS.length)], A = MAT[a], B = MAT[b], r = heterojunction(A, B), k = ['I', 'II', 'III'].indexOf(r.type.split(' ')[0]);
      const why = ['Type I: one material\'s conduction and valence edges both sit inside the other\'s gap, so electrons and holes collect on the same side (quantum wells, HEMTs).',
        'Type II: both edges step the same way, so electrons collect on one side and holes on the other.',
        'Type III: one conduction band lies below the other\'s valence band, so charge crosses with no voltage applied.'][k];
      return { draw: [cv => drawAlign(cv, A, B)], q: `${esc(A.name)} meets ${esc(B.name)}. What kind of band alignment is this?`,
        opts: ['Type I (straddling)', 'Type II (staggered)', 'Type III (broken gap)'], ans: k, why: `${why} Offsets: ΔEc = ${Math.abs(r.dEc).toFixed(2)} eV, ΔEv = ${Math.abs(r.dEv).toFixed(2)} eV.` };
    },
    dibl() {
      const pairs = [['planar_mosfet', 'finfet'], ['planar_mosfet', 'gaa'], ['fdsoi', 'gaa'], ['planar_mosfet', 'fdsoi']];
      const [p, q] = pairs[Math.floor(rnd() * pairs.length)], flip = rnd() < 0.5, left = BY[flip ? q : p], right = BY[flip ? p : q];
      const La = lateral(left, ends(left).off, left.model.vd[1], 181), Lb = lateral(right, ends(right).off, right.model.vd[1], 181);
      const ans = La.barrier < Lb.barrier ? 0 : 1, dA = lateral(left, ends(left).off, 0, 61).barrier - La.barrier, dB = lateral(right, ends(right).off, 0, 61).barrier - Lb.barrier;
      return { draw: [cv => drawLateral(cv, La, { tag: 'A' }), cv => drawLateral(cv, Lb, { tag: 'B' })],
        q: 'Both transistors are switched off with the full drain voltage applied. Which one leaks more current?',
        opts: ['A', 'B'], ans, why: `${ans === 0 ? 'A' : 'B'} (${esc((ans === 0 ? left : right).name)}): its off-state barrier is ${Math.min(La.barrier, Lb.barrier).toFixed(2)} eV against ${Math.max(La.barrier, Lb.barrier).toFixed(2)} eV. Leakage grows about tenfold for every 60 meV of barrier lost. The drain alone lowers A's barrier by ${Math.round(dA * 1000)} meV and B's by ${Math.round(dB * 1000)} meV: drain-induced barrier lowering (DIBL), which shrinks as the gate wraps more sides of the channel; the rest of the difference comes from each device's threshold voltage.` };
    },
  };
  const ROUND = ['state', 'identify', 'hetero', 'dibl', 'state', 'identify', 'hetero', 'dibl'];
  let qs = [], k = 0, score = 0, answered = false;
  const view = host.querySelector('#quizView'), bar = host.querySelector('#quizBar'), out = host.querySelector('#quizScore');
  function start() { qs = shuffle([...ROUND], rnd).map(t => gen[t]()); k = 0; score = 0; show(); }
  function show() {
    answered = false;
    bar.style.setProperty('--p', `${(k / qs.length) * 100}%`);
    out.textContent = `Question ${k + 1} of ${qs.length} · score ${score}`;
    const q = qs[k];
    view.innerHTML = `<div class="qz-figs qz-n${q.draw.length}">${q.draw.map(() => '<canvas></canvas>').join('')}</div><p class="qz-q">${q.q}</p><div class="qz-opts">${q.opts.map((o, i) => `<button type="button" data-i="${i}">${o}</button>`).join('')}</div><p class="qz-why" hidden></p><div class="qz-next" hidden><button type="button" class="btn sm" data-next>${k + 1 < qs.length ? 'Next question →' : 'See your score'}</button>${q.dev ? '<button type="button" class="linkish" data-open>Open this device in the atlas →</button>' : ''}</div>`;
    view.querySelectorAll('.qz-figs canvas').forEach((cv, i) => q.draw[i](cv));
    view.querySelector('.qz-opts').onclick = e => {
      const b = e.target.closest('button'); if (!b || answered) return; answered = true;
      const i = +b.dataset.i, ok = i === q.ans; if (ok) score++;
      view.querySelectorAll('.qz-opts button').forEach((x, j) => { x.classList.toggle('right', j === q.ans); x.classList.toggle('wrong', j === i && !ok); x.disabled = true; });
      const why = view.querySelector('.qz-why'); why.hidden = false; why.innerHTML = `<b>${ok ? 'Correct.' : 'Not quite.'}</b> ${q.why}`;
      view.querySelector('.qz-next').hidden = false;
      out.textContent = `Question ${k + 1} of ${qs.length} · score ${score}`;
    };
    view.querySelector('[data-next]').onclick = () => { k++; if (k < qs.length) show(); else finish(); };
    const op = view.querySelector('[data-open]'); if (op) op.onclick = () => onOpen?.(q.dev);
  }
  function finish() {
    bar.style.setProperty('--p', '100%');
    const msg = score === qs.length ? 'Perfect: you read band diagrams like a device engineer.' : score >= qs.length * 0.6 ? 'Good. The explanations cover the ones you missed; try another round.' : 'Worth another look at the primer at the top of the page, then try again.';
    out.textContent = `Finished · score ${score} / ${qs.length}`;
    view.innerHTML = `<div class="qz-done"><b>${score} / ${qs.length}</b><p>${msg}</p><button type="button" class="btn primary" data-again>New round (new questions)</button></div>`;
    view.querySelector('[data-again]').onclick = start;
  }
  start();
  let t; new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => { const q = qs[k]; if (q) view.querySelectorAll('.qz-figs canvas').forEach((cv, i) => q.draw[i](cv)); }, 150); }).observe(view);
}
