// Process Lab entry: hero, lazy labs, KaTeX, table of contents, sources, record mode.
import { REFS } from './data.js';
import { Hero, STEPS } from './hero.js';

const $ = (s, r = document) => r.querySelector(s);
const safe = (fn, name) => { try { return fn(); } catch (e) { console.error(name, e); } };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const RECORD = new URLSearchParams(location.search).get('record');
const LABS = { oxide: './oxide.js', implant: './implant.js', yield: './yield.js', em: './em.js' };
const DWELL = 3.2, MOVE = 1.1;                              // seconds per step: hold, then animate to the next

function hero() {
  const cv = $('#pzCanvas'); if (!cv) return;
  const H = new Hero(cv), chips = $('#pzChips');
  chips.innerHTML = STEPS.map((s, i) => `<li><button type="button" data-s="${i}" title="${s.name}">${i + 1} ${s.short}</button></li>`).join('');
  let s = 0, target = null, playing = !reduce, t = 0, hold = 0, last = -1, lastNow = 0, visible = true;
  chips.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; playing = false; const v = +b.dataset.s; target = v + 1; if (v + 1 <= s) { s = v; H.ions = []; } });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) requestAnimationFrame(tick); }).observe(cv.closest('header') || cv);
  const narrow = () => innerWidth < 900;
  function frame(dt) {
    t += dt;
    if (target !== null) { s = Math.min(s + dt * Math.max(1 / MOVE, (target - s) / 1.2), target); if (s >= target) target = null; }
    else if (playing) { if (hold > 0) hold -= dt; else { const n = Math.floor(s); s += dt / MOVE; if (Math.floor(s) > n) { s = n + 1; hold = s >= STEPS.length ? DWELL * 2 : DWELL; } } if (s >= STEPS.length && hold <= 0) { s = 0; H.ions = []; hold = 0.8; } }
    H.draw(s, t, narrow() ? 0.5 : 0.68);
    const i = Math.min(Math.max(Math.ceil(s) - 1, 0), STEPS.length - 1);
    if (i !== last) { last = i; $('#pzStep').textContent = `Step ${i + 1}`; $('#pzName').textContent = STEPS[i].name; $('#pzDesc').textContent = STEPS[i].desc; chips.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k === i)); }
  }
  function tick(now) { if (!visible) { lastNow = 0; return; } const dt = Math.min((now - (lastNow || now)) / 1000, 0.05); lastNow = now; frame(dt); requestAnimationFrame(tick); }
  if (reduce) s = STEPS.length;
  frame(0); requestAnimationFrame(tick);
}

function renderTeX() { if (!window.katex) return; document.querySelectorAll('[data-tex]').forEach(n => safe(() => window.katex.render(n.dataset.tex, n, { displayMode: n.classList.contains('eq'), throwOnError: false, strict: 'ignore' }), 'tex')); }
function labs() {
  const started = new Set();
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; const id = e.target.id; if (started.has(id)) return; started.add(id); io.unobserve(e.target);
    import(LABS[id]).then(m => safe(() => m.init(e.target), id)).catch(err => { console.error(id, err); e.target.querySelector('.lab-view')?.insertAdjacentHTML('afterbegin', '<p class="pl-warn">This simulation failed to load in your browser.</p>'); });
  }), { rootMargin: '600px 0px' });
  Object.keys(LABS).forEach(id => { const s = document.getElementById(id); if (s) io.observe(s); });
}
function toc() {
  const links = [...document.querySelectorAll('.pl-toc a')], secs = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean), bar = $('.pl-progress i');
  const on = () => { const y = scrollY + innerHeight * 0.35; let cur = 0; secs.forEach((s, i) => { if (s.offsetTop <= y) cur = i; });
    links.forEach((a, i) => { a.classList.toggle('active', i === cur); a.classList.toggle('done', i < cur); });
    const max = document.documentElement.scrollHeight - innerHeight; if (bar) bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`; };
  addEventListener('scroll', on, { passive: true }); on();
}
function refs() {
  const host = $('#plRefs'); if (!host) return;
  const used = new Set([...document.querySelectorAll('[data-refs]')].flatMap(n => n.dataset.refs.split(/\s+/)));
  host.innerHTML = Object.values(REFS).filter(r => used.has(r.id)).sort((a, b) => a.cite.localeCompare(b.cite)).map(r => `<li id="ref-${r.id}">${r.cite} ${r.link ? `<a href="${r.link}" rel="noopener">${r.doi ? 'doi:' + r.doi : 'link'}</a>` : ''}</li>`).join('');
  document.querySelectorAll('[data-refs]').forEach(n => { n.innerHTML = n.dataset.refs.split(/\s+/).filter(k => REFS[k]).map(k => `<a href="#ref-${k}" title="${REFS[k].cite.replace(/"/g, '&quot;')}">${k}</a>`).join(''); });
}

function recordFonts(scale) {
  const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font');
  Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, String(v).replace(/([\d.]+)px/, (m, n) => (n * scale).toFixed(1) + 'px')); } });
}
async function recordMode(id) {
  document.body.classList.add('record');
  const stage = document.createElement('div'); stage.id = 'rec'; document.body.appendChild(stage);
  let k = 0; window.__reset = () => { k = 0; };
  if (id === 'hero') {
    recordFonts(1.15); stage.className = 'rec-panel rec-hero';
    stage.innerHTML = `<div class="rec-head"><span class="eyebrow">Process flow</span><h2>Building a transistor, step by step</h2><span class="rec-state" id="rs"></span></div><canvas></canvas>
      <div class="rec-foot"><span id="rd"></span><span class="rec-brand">Transistor Odyssey · Process Lab</span></div>`;
    const H = new Hero(stage.querySelector('canvas'));
    Math.random = (() => { let a = 12345; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; })();
    window.__frame = (n = 192) => { if (k === 0) H.ions = []; const per = n / (STEPS.length + 0.5), s = Math.min(k / per, STEPS.length - 0.001), fs = Math.floor(s), f = s - fs, se = fs + Math.min(f * 2.2, 0.999); k++;
      H.draw(se, k / 12, 0.5); stage.querySelector('#rs').textContent = `${fs + 1} · ${STEPS[fs].name}`; return k; };
  } else {
    recordFonts(1.2); stage.className = 'rec-panel';
    const mod = await import(LABS[id]); window.__frame = mod.record(stage, () => k++);
  }
  window.__ready = true;
}

if (RECORD) document.fonts.ready.then(() => recordMode(RECORD));
else {
  safe(hero, 'hero'); safe(labs, 'labs'); safe(toc, 'toc'); safe(refs, 'refs');
  if (window.katex) renderTeX(); else addEventListener('load', renderTeX);
}
