// Side-by-side comparison: up to three devices driven by the same gate and drain fractions.
import { LateralView } from './bandview.js';
import { lateral, onFraction } from './bands.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const GEOM = { mos: 'gate on one side (planar)', dg: 'gate on 2–4 sides (thin body)', hemt: 'Schottky gate over a quantum well', diamond: 'gate over a surface hole sheet',
  jfet: 'reverse-biased junction gate', mesfet: 'Schottky metal gate', tft: 'bottom gate on a thin film', flash: 'control gate over a floating gate', none: 'no insulated gate (junction control)' };

function ends(dev) {
  const [a, b] = dev.model.vg;
  return onFraction(dev, a) <= onFraction(dev, b) ? { off: a, on: b } : { off: b, on: a };
}

export function initCompare(DEVICES, { onOpen } = {}) {
  const host = document.querySelector('#cmp');
  if (!host) return;
  const BY = Object.fromEntries(DEVICES.map(d => [d.id, d]));
  let chosen = ['planar_mosfet', 'finfet', 'gaa'];
  const st = { g: 0.08, d: 0.9 };
  const chips = host.querySelector('#cmpChips'), cards = host.querySelector('#cmpCards'), table = host.querySelector('#cmpTable');
  chips.innerHTML = DEVICES.map(d => `<button type="button" data-id="${d.id}">${esc(d.short)}</button>`).join('');
  const views = new Map();

  const presets = host.querySelector('#cmpPresets');
  const P = [
    ['The FinFET argument', ['planar_mosfet', 'finfet', 'gaa'], 0.08, 0.9, 'Gate off, drain high: the drain pulls the planar barrier down furthest. More gate sides, less drain-induced barrier lowering (DIBL).'],
    ['Over the barrier or through it', ['planar_mosfet', 'tfet', 'cnt_fet'], 0.6, 0.6, 'A MOSFET lowers a barrier; the tunnel FET opens an energy window; the nanotube FET thins a Schottky barrier until electrons tunnel.'],
    ['Junction versus gate', ['bjt', 'jfet', 'planar_mosfet'], 0.7, 0.6, 'The bipolar transistor opens a junction barrier, the JFET narrows a depletion region, the MOSFET builds an inversion channel.'],
    ['Power switches', ['sic_mosfet', 'igbt', 'gan_hemt'], 0.9, 0.5, 'Three ways to switch hundreds of volts: a SiC MOSFET, a silicon IGBT flooded with both carriers, and a GaN electron-gas channel.'],
  ];
  presets.innerHTML = P.map((p, i) => `<button type="button" data-i="${i}">${esc(p[0])}</button>`).join('');
  const note = host.querySelector('#cmpNote');
  presets.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const p = P[+b.dataset.i]; chosen = [...p[1]]; st.g = p[2]; st.d = p[3]; sync(); note.textContent = p[4];
    presets.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  };

  const gIn = host.querySelector('#cmpG'), dIn = host.querySelector('#cmpD');
  const showSliders = () => {
    gIn.value = st.g; dIn.value = st.d;
    gIn.style.setProperty('--fill', st.g * 100 + '%'); dIn.style.setProperty('--fill', st.d * 100 + '%');
    host.querySelector('#cmpGo').textContent = `${Math.round(st.g * 100)}%`; host.querySelector('#cmpDo').textContent = `${Math.round(st.d * 100)}%`;
  };
  gIn.oninput = () => { st.g = +gIn.value; showSliders(); };
  dIn.oninput = () => { st.d = +dIn.value; showSliders(); };
  chips.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const id = b.dataset.id;
    if (chosen.includes(id)) { if (chosen.length > 1) chosen = chosen.filter(x => x !== id); }
    else { chosen.push(id); if (chosen.length > 3) chosen.shift(); }
    presets.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', 'false')); note.textContent = '';
    sync();
  };

  function sync() {
    chips.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(chosen.includes(b.dataset.id))));
    cards.innerHTML = chosen.map(id => `<figure class="card cmp-card" data-id="${id}"><figcaption><b>${esc(BY[id].short)}</b><span>${BY[id].year} · ${esc(BY[id].material)}</span></figcaption><canvas></canvas><div class="cmp-read"></div><button type="button" class="linkish">Open in the atlas →</button></figure>`).join('');
    views.clear();
    cards.querySelectorAll('.cmp-card').forEach(c => {
      const v = new LateralView(c.querySelector('canvas')); v.reset(BY[c.dataset.id]); views.set(c.dataset.id, { v, read: c.querySelector('.cmp-read') });
      c.querySelector('button').onclick = () => onOpen?.(c.dataset.id);
    });
    const row = (label, f) => `<tr><th>${label}</th>${chosen.map(id => `<td>${f(BY[id])}</td>`).join('')}</tr>`;
    const swing = d => d.model.vscale ? '—' : d.model.lateral === 'tfet' ? '< 60 (steep)' : d.model.lateral === 'bjt' ? '60' : Math.round(60 * (d.model.n || 1));
    table.innerHTML = `<table class="dv-facts cmp-tbl"><thead><tr><th></th>${chosen.map(id => `<th>${esc(BY[id].short)}</th>`).join('')}</tr></thead><tbody>
      ${row('Year', d => d.year)}${row('Family', d => esc(d.family))}${row('Channel material', d => esc(d.material))}${row('Band gap (eV)', d => d.model.Eg.toFixed(2))}
      ${row('Current carried by', d => d.carrier === 'e' ? 'electrons' : 'holes')}${row('Gate geometry', d => esc(GEOM[d.model.vertical] || ''))}
      ${row('Model swing (mV/dec)', swing)}${row('Model DIBL (mV/V)', d => d.model.lateral === 'fet' ? Math.round((d.model.eta ?? 0.05) * 1000 / (d.model.vscale || 1)) : '—')}
      ${row('Drain range (V)', d => `0–${d.model.vd[1]}`)}</tbody></table>`;
    showSliders();
  }
  sync();

  let last = performance.now(), vis = false;
  new IntersectionObserver(([en]) => { vis = en.isIntersecting; }, { rootMargin: '80px' }).observe(cards);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tick = now => {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (vis && !document.hidden) {
      for (const id of chosen) {
        const d = BY[id], e = ends(d), vg = e.off + (e.on - e.off) * st.g, vd = d.model.vd[1] * st.d, f = onFraction(d, vg);
        const L = lateral(d, vg, vd, 181), item = views.get(id); if (!item) continue;
        try { item.v.draw(L, { dt: reduce ? dt * 0.3 : dt, speed: 1, vd01: st.d, f }); } catch (err) { console.error(err); }
        const bar = d.model.lateral === 'tfet' ? L.window : d.model.lateral === 'sbfet' ? L.barrierMid : L.barrier;
        const drop = d.model.lateral === 'fet' ? lateral(d, vg, 0, 61).barrier - L.barrier : null;
        const txt = `gate ${vg.toFixed(Math.abs(e.on - e.off) > 5 ? 1 : 2)} V · drain ${vd.toFixed(vd > 5 ? 1 : 2)} V · on-fraction ${f < 1e-3 ? f.toExponential(1) : f.toFixed(3)}${bar !== undefined && isFinite(bar) ? ` · ${d.model.lateral === 'tfet' ? 'window' : 'barrier'} ${bar.toFixed(2)} eV` : ''}${drop !== null && drop > 0.001 ? ` · drain lowers it ${Math.round(drop * 1000)} meV` : ''}`;
        if (item.read.textContent !== txt) item.read.textContent = txt;
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
