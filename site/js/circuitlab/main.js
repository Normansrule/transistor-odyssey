// Circuit Lab entry: powers-of-ten hero, lazy lab loading, KaTeX, table of contents, sources, record mode.
import { REFS } from './data.js';
import { Zoom, LEVELS, ZMAX, fmtLen } from './zoom.js';

const $ = (s, r = document) => r.querySelector(s);
const safe = (fn, name) => { try { return fn(); } catch (e) { console.error(name, e); } };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search), RECORD = params.get('record');

// eased position: lingers on each power of ten so the captions can be read
const ease = u => { const i = Math.floor(u), f = u - i; return i + f * f * f * (f * (f * 6 - 15) + 10); };

function hero() {
  const cv = $('#czCanvas'); if (!cv) return;
  const narrow = () => innerWidth < 900;
  const zoom = new Zoom(cv, { focusX: narrow() ? 0.5 : 0.7, focusY: 0.46 });
  addEventListener('resize', () => { zoom.focusX = narrow() ? 0.5 : 0.7; });
  const range = $('#czRange'), play = $('#czPlay'), chips = $('#czChips');
  chips.innerHTML = LEVELS.map((L, i) => `<li><button type="button" data-z="${i}" title="${fmtLen(L.fov)} across">${L.name}</button></li>`).join('');
  let u = 0, dir = 1, playing = !reduce, target = null, hold = 0, t = 0, lastLevel = -1;
  const setPlaying = p => { playing = p; play.setAttribute('aria-pressed', String(p)); play.textContent = p ? 'Pause' : 'Play'; };
  setPlaying(playing);
  play.addEventListener('click', () => { target = null; setPlaying(!playing); });
  range.addEventListener('input', () => { setPlaying(false); target = null; u = +range.value; });
  chips.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; setPlaying(false); target = +b.dataset.z; });
  let visible = true, last = 0;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) requestAnimationFrame(tick); }).observe(cv);
  function frame(dt) {
    t += dt;
    if (target !== null) { const d = target - u; u += Math.sign(d) * Math.min(Math.abs(d), dt * Math.max(1.2, Math.abs(d) * 1.6)); if (Math.abs(d) < 1e-3) { u = target; target = null; } }
    else if (playing) {
      if (hold > 0) hold -= dt;
      else { u += dir * dt * (dir > 0 ? 0.16 : 1.4); if (u >= ZMAX) { u = ZMAX; dir = -1; hold = 3; } if (u <= 0) { u = 0; dir = 1; hold = 1.5; } }
    }
    const z = target === null && playing ? ease(u) : u;
    const r = zoom.draw(z, t);
    range.value = u; range.style.setProperty('--fill', (u / ZMAX * 100) + '%');
    $('#czScale').textContent = fmtLen(r.fov);
    $('#czBar').style.width = Math.round(r.bar.px) + 'px'; $('#czBarLabel').textContent = fmtLen(r.bar.len);
    const lv = Math.min(Math.round(z), ZMAX);
    if (lv !== lastLevel) {
      lastLevel = lv; $('#czLevel').textContent = `${LEVELS[lv].name} · 10${['⁰', '⁻¹', '⁻²', '⁻³', '⁻⁴', '⁻⁵', '⁻⁶', '⁻⁷', '⁻⁸', '⁻⁹'][lv]}`;
      $('#czDesc').textContent = LEVELS[lv].desc;
      chips.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === lv));
    }
  }
  function tick(now) {
    if (!visible) { last = 0; return; }
    const dt = Math.min((now - (last || now)) / 1000, 0.05); last = now;
    frame(dt); requestAnimationFrame(tick);
  }
  frame(0); requestAnimationFrame(tick);
}

// ---------- equations ----------
function renderTeX() {
  if (!window.katex) return;
  document.querySelectorAll('[data-tex]').forEach(n => safe(() => window.katex.render(n.dataset.tex, n, { displayMode: n.classList.contains('eq'), throwOnError: false, strict: 'ignore' }), 'tex'));
}

// ---------- labs ----------
const LABS = { gates: './gates.js', adder: './adder.js', sram: './sram.js', flash: './flash.js' };
function labs() {
  const started = new Set();
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const id = e.target.id; if (started.has(id)) return; started.add(id); io.unobserve(e.target);
    import(LABS[id]).then(m => safe(() => m.init(e.target), id)).catch(err => {
      console.error(id, err);
      e.target.querySelector('.lab-view')?.insertAdjacentHTML('afterbegin', '<p class="pl-warn">This simulation failed to load in your browser.</p>');
    });
  }), { rootMargin: '600px 0px' });
  Object.keys(LABS).forEach(id => { const s = document.getElementById(id); if (s) io.observe(s); });
}

function toc() {
  const links = [...document.querySelectorAll('.pl-toc a')];
  const secs = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  const bar = $('.pl-progress i');
  const onScroll = () => {
    const y = scrollY + innerHeight * 0.35;
    let cur = 0; secs.forEach((s, i) => { if (s.offsetTop <= y) cur = i; });
    links.forEach((a, i) => { a.classList.toggle('active', i === cur); a.classList.toggle('done', i < cur); });
    const max = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
}

function refs() {
  const host = $('#plRefs'); if (!host) return;
  const used = new Set([...document.querySelectorAll('[data-refs]')].flatMap(n => n.dataset.refs.split(/\s+/)));
  const list = Object.values(REFS).filter(r => used.has(r.id)).sort((a, b) => a.cite.localeCompare(b.cite));
  host.innerHTML = list.map(r => `<li id="ref-${r.id}">${r.cite} ${r.link ? `<a href="${r.link}" rel="noopener">${r.doi ? 'doi:' + r.doi : 'link'}</a>` : ''}</li>`).join('');
  document.querySelectorAll('[data-refs]').forEach(n => {
    n.innerHTML = n.dataset.refs.split(/\s+/).filter(k => REFS[k]).map(k => `<a href="#ref-${k}" title="${REFS[k].cite.replace(/"/g, '&quot;')}">${k}</a>`).join('');
  });
}

// ---------- record mode: deterministic frames for GIF capture ----------
function recordFonts(scale) {
  const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font');
  Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', { configurable: true, get() { return d.get.call(this); },
    set(v) { d.set.call(this, String(v).replace(/([\d.]+)px/, (m, n) => (n * scale).toFixed(1) + 'px')); } });
}
async function recordMode(id) {
  document.body.classList.add('record');
  const stage = document.createElement('div'); stage.id = 'rec'; document.body.appendChild(stage);
  let k = 0; window.__reset = () => { k = 0; };
  if (id === 'zoom') {
    recordFonts(1.15);
    stage.innerHTML = `<canvas></canvas><div class="rec-head"><span class="eyebrow">Powers of ten</span><h2>From wafer to atom</h2></div>
      <div class="rec-zoomhud"><span id="rl"></span><b id="rs"></b><p id="rd"></p></div><div class="rec-foot"><span></span><span class="rec-brand">Transistor Odyssey · Circuit Lab</span></div>`;
    const z = new Zoom(stage.querySelector('canvas'), { focusX: 0.36, focusY: 0.5 });
    window.__frame = (n = 240) => {
      const u = Math.min(k / n * (ZMAX + 0.6), ZMAX), zz = ease(u); k++;
      const r = z.draw(zz, k / 12), lv = Math.min(Math.round(zz), ZMAX);
      $('#rs').textContent = fmtLen(r.fov) + ' across'; $('#rl').textContent = LEVELS[lv].name; $('#rd').textContent = LEVELS[lv].desc;
      return k;
    };
  } else {
    recordFonts(1.2);
    stage.className = 'rec-panel';
    const mod = await import(LABS[id]);
    window.__frame = mod.record(stage, () => k++, recordFonts);
  }
  window.__ready = true;
}

if (RECORD) document.fonts.ready.then(() => recordMode(RECORD));
else {
  safe(hero, 'hero'); safe(labs, 'labs'); safe(toc, 'toc'); safe(refs, 'refs');
  if (window.katex) renderTeX(); else addEventListener('load', renderTeX);
  document.addEventListener('pointermove', e => {
    const g = e.target.closest?.('.glow'); if (!g) return;
    const r = g.getBoundingClientRect(); g.style.setProperty('--mx', (e.clientX - r.left) + 'px'); g.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
}
