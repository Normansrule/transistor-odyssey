// Diamond lab: dopant ionization vs temperature (JS twin of sim/transistor_sim/dopants.py)
import { el, frame, axes, linear, log, logTicks, path, tooltip, svgPoint, C } from './svgchart.js';

const KB = 8.617333262e-5;
export function ionized(d, N, T) {
  const neff = d.N_eff_300 * (T / 300) ** 1.5;
  const K = neff / d.g * Math.exp(-d.Ea_eV / (KB * T));
  const p = 0.5 * (-K + Math.sqrt(K * K + 4 * K * N));
  return p / N;
}
const pct = f => f >= 0.1 ? (f * 100).toFixed(1) + ' %' : f >= 1e-3 ? (f * 100).toFixed(3) + ' %' : (f * 100).toExponential(1) + ' %';
const sci = v => { const e = Math.floor(Math.log10(v)); const m = v / 10 ** e; return `${m.toFixed(1)}×10${String(e).split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c] ?? (c === '-' ? '⁻' : c)).join('')}`; };

export function initDiamond(DATA) {
  const D = DATA.dopants; if (!D || !Object.keys(D).length) return;
  const sel = document.getElementById('dopSel'), nIn = document.getElementById('dopN'), tIn = document.getElementById('dopT');
  const nOut = document.getElementById('dopNOut'), tOut = document.getElementById('dopTOut');
  const tiles = document.getElementById('dopTiles'), host = document.getElementById('dopChart');
  const tip = tooltip(host.parentElement);
  sel.innerHTML = Object.entries(D).map(([k, d]) => `<option value="${k}">${d.label} · ${d.kind}, ${d.Ea_eV} eV</option>`).join('');
  sel.value = 'C:B';
  function draw() {
    const d = D[sel.value], ref = D['Si:B'], N = 10 ** +nIn.value, T = +tIn.value;
    nOut.textContent = sci(N) + ' cm⁻³'; tOut.textContent = `${T} K (${Math.round(T - 273.15)} °C)`;
    const f = ionized(d, N, T), fr = ionized(ref, N, T);
    const carrier = d.kind === 'acceptor' ? 'holes' : 'electrons';
    tiles.innerHTML = [
      ['Dopants ionized', pct(f), `${d.label} at ${T} K`],
      [`Free ${carrier}`, sci(f * N) + ' cm⁻³', `from ${sci(N)} cm⁻³ dopants`],
      ['Boron in silicon, same conditions', pct(fr), 'reference (0.045 eV)'],
    ].map(([l, v, u]) => `<div class="card tile"><span class="l">${l}</span><span class="v">${v}</span><span class="u">${u}</span></div>`).join('');
    const f0 = frame(host, { w: 560, h: 320, m: { t: 12, r: 16, b: 40, l: 56 } });
    const xs = linear(150, 900, f0.x0, f0.x1), ys = log(1e-5, 100, f0.y0, f0.y1);
    axes(f0, xs, ys, { xt: [200, 300, 400, 500, 600, 700, 800, 900], yt: logTicks(1e-5, 100), xl: 'Temperature (K)', yl: 'Ionized (%)', yf: v => v >= 1 ? String(v) : v >= 0.01 ? String(v) : '10' + String(Math.round(Math.log10(v))).replace('-', '⁻').replace(/\d/g, c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]) });
    const Ts = Array.from({ length: 151 }, (_, i) => 150 + i * 5);
    const line = (dd, color) => el('path', { d: path(Ts.map(t => [xs(t), ys(Math.max(ionized(dd, N, t) * 100, 1e-5))])), fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round' }, f0.svg);
    line(ref, C.s2); line(d, C.s1);
    el('line', { x1: xs(300), x2: xs(300), y1: f0.y1, y2: f0.y0, stroke: C.axis }, f0.svg);
    el('text', { x: xs(300) + 4, y: f0.y1 + 12, fill: C.muted, 'font-size': 11 }, f0.svg).textContent = '300 K';
    el('circle', { cx: xs(T), cy: ys(Math.max(f * 100, 1e-5)), r: 6, fill: '#f2b84b', stroke: C.surface, 'stroke-width': 2 }, f0.svg);
    const hit = el('rect', { x: f0.x0, y: f0.y1, width: f0.x1 - f0.x0, height: f0.y0 - f0.y1, fill: 'transparent' }, f0.svg);
    hit.addEventListener('pointermove', e => { const t = Math.round(Math.min(Math.max(xs.inv(svgPoint(f0.svg, e).x), 150), 900)); tip.show(`<b>${t} K</b><div class="row"><span>${d.label}</span><span>${pct(ionized(d, N, t))}</span></div><div class="row"><span>${ref.label}</span><span>${pct(ionized(ref, N, t))}</span></div>`, e.clientX, e.clientY); });
    hit.addEventListener('pointerleave', () => tip.hide());
    document.getElementById('dopLegend').innerHTML = `<span><i style="background:${C.s1}"></i>${d.label}</span><span><i style="background:${C.s2}"></i>${ref.label} (reference)</span>`;
  }
  [sel, nIn, tIn].forEach(x => x.addEventListener('input', draw));
  draw();

  const refById = Object.fromEntries(DATA.refs.map(r => [r.id, r]));
  document.getElementById('diaTimeline').innerHTML = DATA.diamond.map(m => `<li class="dia-item"><span class="dia-year">${m.year}</span><div><b>${m.event}</b><p>${m.detail}</p><div class="refchips">${m.refs.map(r => refById[r] ? `<a href="${refById[r].link}" target="_blank" rel="noopener">${r}</a>` : '').join('')}</div></div></li>`).join('');
}
