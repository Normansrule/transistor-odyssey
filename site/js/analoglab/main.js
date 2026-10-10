// Analog & RF Lab entry: spectrum hero, lazy labs, KaTeX, table of contents, sources, record mode.
import { REFS } from './data.js';
import { Hero, uToF, fmtHz, regionAt } from './hero.js';

const $ = (s, r = document) => r.querySelector(s);
const safe = (fn, name) => { try { return fn(); } catch (e) { console.error(name, e); } };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const RECORD = new URLSearchParams(location.search).get('record');
const LABS = { amp: './amp.js', gain: './gain.js', bode: './bode.js', noise: './noise.js' };
const SWEEP = 34;                                               // seconds for one sweep from 10 Hz to 2 THz

function hero() {
  const cv = $('#azCanvas'); if (!cv) return;
  const H = new Hero(cv), range = $('#azRange'), play = $('#azPlay');
  let u = reduce ? 0.62 : 0.05, playing = !reduce, t = 0, lastNow = 0, visible = true, lastReg = null, lastF = '';
  const setPlaying = p => { playing = p; play.setAttribute('aria-pressed', String(p)); play.textContent = p ? 'Pause' : 'Play'; };
  setPlaying(playing);
  play.addEventListener('click', () => setPlaying(!playing));
  range.addEventListener('input', () => { setPlaying(false); u = +range.value; });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) requestAnimationFrame(tick); }).observe(cv.closest('header') || cv);
  const narrow = () => innerWidth < 900;
  function frame(dt) {
    t += reduce ? 0 : dt;
    if (playing) { u += dt / SWEEP; if (u > 1) u = 0; }
    H.draw(u, t, narrow() ? 0.52 : 0.44);
    range.value = u; range.style.setProperty('--fill', (u * 100) + '%');
    const f = uToF(u), reg = regionAt(f), fs = fmtHz(f);
    if (fs !== lastF) { lastF = fs; $('#azFreq').textContent = fs; }
    if (reg !== lastReg) { lastReg = reg; $('#azName').textContent = reg.name; $('#azDesc').textContent = reg.desc; }
  }
  function tick(now) { if (!visible) { lastNow = 0; return; } const dt = Math.min((now - (lastNow || now)) / 1000, 0.05); lastNow = now; frame(dt); requestAnimationFrame(tick); }
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
    recordFonts(1.1); stage.className = 'rec-panel rec-hero';
    stage.innerHTML = `<div class="rec-head"><span class="eyebrow">Radio spectrum</span><h2>From audio to a terahertz</h2><span class="rec-state" id="rs"></span></div><canvas></canvas>
      <div class="rec-foot"><span id="rd"></span><span class="rec-brand">Transistor Odyssey · Analog &amp; RF Lab</span></div>`;
    const H = new Hero(stage.querySelector('canvas'));
    window.__frame = (n = 160) => { const u = 0.02 + 0.96 * (k % n) / (n - 1), f = uToF(u); k++;
      H.draw(u, k / 12, 0.5); stage.querySelector('#rs').textContent = `${fmtHz(f)} · ${regionAt(f).name}`; return k; };
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
