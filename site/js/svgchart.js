// Tiny SVG chart helpers: scales, axes, hover tooltips. No dependencies.
export const NS = 'http://www.w3.org/2000/svg';
export const C = { s1: '#3987e5', s2: '#d95926', s3: '#199e70', s4: '#c98500', s5: '#d55181', ink: '#e8ecf1', ink2: '#aab3c0', muted: '#8a94a3', grid: '#232a34', axis: '#2f3845', surface: '#10141a' };
export const RAMP = ['#86b6ef', '#5598e7', '#3987e5', '#256abf', '#1c5cab'];

export function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

export function linear(d0, d1, r0, r1) { const f = v => r0 + (v - d0) / (d1 - d0) * (r1 - r0); f.inv = p => d0 + (p - r0) / (r1 - r0) * (d1 - d0); f.domain = [d0, d1]; return f; }
export function log(d0, d1, r0, r1) {
  const l0 = Math.log10(d0), l1 = Math.log10(d1);
  const f = v => r0 + (Math.log10(Math.max(v, 1e-300)) - l0) / (l1 - l0) * (r1 - r0);
  f.inv = p => 10 ** (l0 + (p - r0) / (r1 - r0) * (l1 - l0)); f.domain = [d0, d1]; f.log = true; return f;
}

export function niceTicks(a, b, n = 5) {
  const span = b - a, step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= n + 0.5);
  const out = []; for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
export function logTicks(a, b, every = 1) {
  const out = []; for (let e = Math.ceil(Math.log10(a)); e <= Math.floor(Math.log10(b)); e += every) out.push(10 ** e); return out;
}
export function sup(e) { const m = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }; return String(e).split('').map(c => m[c]).join(''); }
export function fmtPow(v) { const e = Math.round(Math.log10(v)); return e === 0 ? '1' : e === 1 ? '10' : '10' + sup(e); }

export function frame(host, { w = 560, h = 340, m = { t: 14, r: 18, b: 38, l: 52 } } = {}) {
  host.querySelector('svg')?.remove();
  const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img' });
  host.appendChild(svg);
  return { svg, w, h, m, x0: m.l, x1: w - m.r, y0: h - m.b, y1: m.t };
}

export function axes(f, xs, ys, { xt, yt, xl, yl, xf = String, yf = String } = {}) {
  const g = el('g', { class: 'axis' }, f.svg);
  for (const t of yt) {
    const y = ys(t); if (y < f.y1 - 0.5 || y > f.y0 + 0.5) continue;
    el('line', { x1: f.x0, x2: f.x1, y1: y, y2: y, class: 'gridline' }, g);
    el('text', { x: f.x0 - 8, y: y + 4, 'text-anchor': 'end' }, g).textContent = yf(t);
  }
  for (const t of xt) {
    const x = xs(t); if (x < f.x0 - 0.5 || x > f.x1 + 0.5) continue;
    el('line', { x1: x, x2: x, y1: f.y0, y2: f.y0 + 5, stroke: C.axis }, g);
    el('text', { x, y: f.y0 + 18, 'text-anchor': 'middle' }, g).textContent = xf(t);
  }
  el('line', { x1: f.x0, x2: f.x1, y1: f.y0, y2: f.y0, stroke: C.axis }, g);
  if (xl) label(el('text', { x: (f.x0 + f.x1) / 2, y: f.h - 4, 'text-anchor': 'middle', fill: C.ink2 }, g), xl);
  if (yl) { label(el('text', { x: 12, y: (f.y0 + f.y1) / 2, 'text-anchor': 'middle', transform: `rotate(-90 12 ${(f.y0 + f.y1) / 2})`, fill: C.ink2 }, g), yl); }
  return g;
}

export function label(t, text) {
  // "V_DS (V)" -> V<tspan>DS</tspan> (V); underscores mark subscripts
  t.textContent = '';
  const parts = String(text).split(/([A-Za-z]_[A-Za-z0-9]+)/);
  for (const part of parts) {
    const m = part.match(/^([A-Za-z])_([A-Za-z0-9]+)$/);
    if (m) { t.appendChild(document.createTextNode(m[1])); const s = el('tspan', { 'baseline-shift': 'sub', 'font-size': '75%' }, t); s.textContent = m[2]; }
    else if (part) t.appendChild(document.createTextNode(part));
  }
  return t;
}
export const subHTML = s => String(s).replace(/([VI])_([A-Za-z0-9]+)/g, '$1<sub>$2</sub>');

export function path(pts) { return pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(''); }

export function tooltip(host) {
  let tip = host.querySelector(':scope > .chart-tip');
  if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tip'; tip.hidden = true; host.appendChild(tip); }
  return {
    show(html, clientX, clientY) {
      tip.innerHTML = html; tip.hidden = false;
      const r = host.getBoundingClientRect();
      let x = clientX - r.left + 14, y = clientY - r.top + 14;
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      if (x + tw > r.width - 4) x = clientX - r.left - tw - 14;
      if (y + th > r.height - 4) y = clientY - r.top - th - 14;
      tip.style.left = Math.max(4, x) + 'px'; tip.style.top = Math.max(4, y) + 'px';
    },
    hide() { tip.hidden = true; },
  };
}

export function svgPoint(svg, evt) {
  const p = svg.createSVGPoint(); p.x = evt.clientX; p.y = evt.clientY;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}
