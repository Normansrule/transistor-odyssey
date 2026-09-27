// Shared helpers for the Physics Lab: control panels, readouts, tweened
// experiments, canvas setup, number formatting and plot helpers.
import { el, frame, axes, linear, log, niceTicks, logTicks, fmtPow, path, tooltip, svgPoint, label, C } from '../svgchart.js';
export { el, frame, axes, linear, log, niceTicks, logTicks, fmtPow, path, tooltip, svgPoint, label, C };

export const $ = (s, r = document) => r.querySelector(s);
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
export const lerp = (a, b, t) => a + (b - a) * t;

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
/** 3.2×10¹⁷ style scientific notation */
export function sci(v, digits = 2) {
  if (!isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 0.01 && a < 1e4) return (+v.toPrecision(digits + 1)).toString();
  const e = Math.floor(Math.log10(a)), m = v / 10 ** e;
  const ms = (+m.toFixed(digits - 1)).toString();
  const es = String(e).split('').map(c => SUP[c]).join('');
  return (ms === '1' ? '' : ms + '×') + '10' + es;
}
export const fix = (v, d = 2) => (isFinite(v) ? v.toFixed(d) : '—');

/** Build a control panel from a spec. Returns { state, set(key, v), on(fn) }. */
export function panel(host, spec) {
  const state = {}, inputs = {}, listeners = [];
  const emit = (key, final) => listeners.forEach(fn => fn(key, final));
  for (const s of spec) {
    if (s.type === 'heading') { const h = document.createElement('div'); h.className = 'pl-subhead'; h.textContent = s.label; host.appendChild(h); continue; }
    const wrap = document.createElement('div'); wrap.className = 'ctl'; host.appendChild(wrap);
    if (s.type === 'seg') {
      const lab = document.createElement('div'); lab.className = 'pl-label'; lab.textContent = s.label; wrap.appendChild(lab);
      const seg = document.createElement('div'); seg.className = 'seg'; seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', s.label); wrap.appendChild(seg);
      const btns = s.options.map(([val, text]) => {
        const b = document.createElement('button'); b.type = 'button'; b.innerHTML = text; b.dataset.v = val;
        b.addEventListener('click', () => api.set(s.key, val, true)); seg.appendChild(b); return b;
      });
      inputs[s.key] = { seg: true, btns, spec: s, show: v => btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(v)))) };
      state[s.key] = s.value; inputs[s.key].show(s.value);
      continue;
    }
    if (s.type === 'toggle') {
      const lab = document.createElement('label'); lab.className = 'switch';
      lab.innerHTML = `<input type="checkbox"${s.value ? ' checked' : ''}> <span>${s.label}</span>`;
      wrap.appendChild(lab);
      const inp = lab.querySelector('input');
      inp.addEventListener('change', () => { state[s.key] = inp.checked; emit(s.key, true); });
      inputs[s.key] = { toggle: true, inp, show: v => (inp.checked = !!v), spec: s };
      state[s.key] = !!s.value; continue;
    }
    // range (linear or log)
    const id = 'pl-' + s.key + '-' + Math.random().toString(36).slice(2, 7);
    const lab = document.createElement('label'); lab.setAttribute('for', id);
    lab.innerHTML = `<span>${s.label}</span><output></output>`;
    const inp = document.createElement('input'); inp.type = 'range'; inp.id = id;
    const toSlider = v => s.log ? Math.log10(v) : v, fromSlider = x => s.log ? 10 ** x : x;
    inp.min = toSlider(s.min); inp.max = toSlider(s.max); inp.step = s.step ?? (s.log ? 0.01 : (s.max - s.min) / 200);
    wrap.append(lab, inp);
    const out = lab.querySelector('output');
    const fmt = s.fmt || (v => (s.log ? sci(v) : (+v.toFixed(3)).toString()) + (s.unit ? ' ' + s.unit : ''));
    inputs[s.key] = { inp, out, spec: s, show: v => { inp.value = toSlider(v); out.textContent = fmt(v); inp.style.setProperty('--fill', ((toSlider(v) - inp.min) / (inp.max - inp.min) * 100) + '%'); } };
    state[s.key] = s.value; inputs[s.key].show(s.value);
    inp.addEventListener('input', () => { state[s.key] = fromSlider(+inp.value); inputs[s.key].show(state[s.key]); emit(s.key, false); });
    inp.addEventListener('change', () => emit(s.key, true));
  }
  const extra = host.querySelector(':scope > .pl-extra'); if (extra) host.appendChild(extra);
  const api = {
    state, inputs,
    set(key, v, final = true) { state[key] = v; inputs[key]?.show(v); emit(key, final); },
    on(fn) { listeners.push(fn); return api; },
    /** Tween numeric keys to target values; set discrete keys immediately. */
    animate(target, ms = 900, done) {
      const from = {}, to = {};
      for (const [k, v] of Object.entries(target)) {
        const sp = inputs[k]?.spec;
        if (typeof v === 'number' && sp && !sp.type) { from[k] = sp.log ? Math.log10(state[k]) : state[k]; to[k] = sp.log ? Math.log10(v) : v; }
        else { state[k] = v; inputs[k]?.show(v); }
      }
      emit('*', false);
      const keys = Object.keys(to);
      if (!keys.length || reduceMotion) { keys.forEach(k => { const sp = inputs[k].spec; state[k] = sp.log ? 10 ** to[k] : to[k]; inputs[k].show(state[k]); }); emit('*', true); done?.(); return; }
      const t0 = performance.now();
      const tick = now => {
        const t = Math.min((now - t0) / ms, 1), e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
        for (const k of keys) { const sp = inputs[k].spec, x = lerp(from[k], to[k], e); state[k] = sp.log ? 10 ** x : x; inputs[k].show(state[k]); }
        emit('*', t >= 1);
        if (t < 1) requestAnimationFrame(tick); else done?.();
      };
      requestAnimationFrame(tick);
    },
  };
  return api;
}

/** Readout tiles: spec [{key, label, unit}] → update({key: html}) */
export function tiles(host, spec) {
  host.classList.add('pl-tiles');
  const map = {};
  for (const s of spec) {
    const d = document.createElement('div'); d.className = 'pl-tile';
    d.innerHTML = `<span class="l">${s.label}</span><span class="v tabnum">—</span>${s.unit ? `<span class="u">${s.unit}</span>` : ''}`;
    host.appendChild(d); map[s.key] = d.querySelector('.v');
  }
  return vals => { for (const [k, v] of Object.entries(vals)) if (map[k]) map[k].innerHTML = v; };
}

/** Experiment buttons: [{label, set, note, run?}] */
export function experiments(host, list, api) {
  const ol = document.createElement('ol'); ol.className = 'pl-exp'; host.appendChild(ol);
  const note = document.createElement('p'); note.className = 'pl-exp-note'; note.setAttribute('aria-live', 'polite');
  for (const [i, x] of list.entries()) {
    const li = document.createElement('li');
    const b = document.createElement('button'); b.type = 'button';
    b.innerHTML = `<span class="n">${i + 1}</span><span>${x.label}</span>`;
    b.addEventListener('click', () => {
      ol.querySelectorAll('button').forEach(o => o.classList.toggle('on', o === b));
      note.innerHTML = x.note || '';
      if (x.run) x.run(api); else api.animate(x.set, x.ms || 900);
    });
    li.appendChild(b); ol.appendChild(li);
  }
  host.appendChild(note);
}

/** HiDPI canvas that tracks its CSS size. Returns {ctx, w, h, resize()} */
export function hiCanvas(cv) {
  const ctx = cv.getContext('2d');
  const o = { cv, ctx, w: 0, h: 0, dpr: 1 };
  o.resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
    if (w === o.w && h === o.h && dpr === o.dpr) return false;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Object.assign(o, { w, h, dpr }); return true;
  };
  o.resize();
  return o;
}

/** Run fn every animation frame while host is on screen and the tab is visible. */
export function loop(host, fn) {
  let visible = false, raf = 0, last = 0;
  const tick = now => { raf = 0; if (!visible || document.hidden) return; const dt = Math.min((now - (last || now)) / 1000, 0.05); last = now; fn(dt, now); raf = requestAnimationFrame(tick); };
  const start = () => { if (!raf && visible) { last = 0; raf = requestAnimationFrame(tick); } };
  new IntersectionObserver(es => { visible = es[0].isIntersecting; start(); }, { rootMargin: '100px' }).observe(host);
  document.addEventListener('visibilitychange', start);
  return { kick: start };
}

/** rAF-coalesced callback */
export function coalesce(fn) { let q = false, args; return (...a) => { args = a; if (q) return; q = true; requestAnimationFrame(() => { q = false; fn(...args); }); }; }

// perceptual colour ramp (dark → blue → teal → amber → light) for heatmaps
const STOPS = [[16, 20, 26], [28, 72, 150], [57, 135, 229], [60, 190, 180], [242, 184, 75], [255, 236, 190]];
export function ramp(t) {
  t = clamp(t, 0, 1) * (STOPS.length - 1); const i = Math.min(Math.floor(t), STOPS.length - 2), f = t - i;
  const a = STOPS[i], b = STOPS[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
export const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

/** Hover crosshair + tooltip over an x-y plot. getRows(x) → html */
export function hover(f, host, xs, getRows) {
  const tip = tooltip(host);
  const line = el('line', { y1: f.y1, y2: f.y0, stroke: C.muted, 'stroke-width': 1, opacity: 0 }, f.svg);
  const hit = el('rect', { x: f.x0, y: f.y1, width: f.x1 - f.x0, height: f.y0 - f.y1, fill: 'transparent' }, f.svg);
  hit.addEventListener('pointermove', e => {
    const pt = svgPoint(f.svg, e), x = xs.inv(clamp(pt.x, f.x0, f.x1));
    line.setAttribute('x1', xs(x)); line.setAttribute('x2', xs(x)); line.setAttribute('opacity', 1);
    tip.show(getRows(x), e.clientX, e.clientY);
  });
  hit.addEventListener('pointerleave', () => { line.setAttribute('opacity', 0); tip.hide(); });
}

export const tipRows = (title, rows) => `<b>${title}</b>` + rows.map(([k, v]) => `<div class="row"><span>${k}</span><span>${v}</span></div>`).join('');

/** Small text in SVG */
export function txt(svg, x, y, s, attrs = {}) {
  const t = el('text', { x, y, fill: C.ink2, 'font-size': 11, 'font-family': 'IBM Plex Mono, monospace', ...attrs }, svg);
  label(t, s); return t;
}

/** Chart width in CSS pixels so SVG text renders at its natural size. */
export const fw = (host, min = 300) => Math.max(min, Math.round((host.clientWidth || 560) - 28));

/** Call fn when any of the hosts changes width (coalesced per frame). */
export function onWidth(hosts, fn) {
  const last = new WeakMap(); let queued = false;
  const ro = new ResizeObserver(es => {
    let changed = false;
    for (const e of es) { const w = Math.round(e.contentRect.width); if (last.get(e.target) !== w) { if (last.has(e.target)) changed = true; last.set(e.target, w); } }
    if (changed && !queued) { queued = true; requestAnimationFrame(() => { queued = false; fn(); }); }
  });
  hosts.forEach(h => h && ro.observe(h));
}
