// Physics Lab entry: hero animation, lazy lab loading, KaTeX, table of contents.
import { REFS } from '../physics/data.js';
import { hiCanvas, reduceMotion, ramp, rgb } from './ui.js';

const $ = (s, r = document) => r.querySelector(s);
const safe = (fn, name) => { try { return fn(); } catch (e) { console.error(name, e); } };

// ---------- hero: an electron gas drifting through a crystal ----------
safe(() => {
  const cv = $('#plHero'); if (!cv) return;
  const c = hiCanvas(cv), N = 260;
  const P = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), vx: 0, vy: 0, e: Math.random() * 0.3 }));
  let fx = -0.35, fy = 0, mx = null, my = null, t = 0;
  cv.parentElement.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width; my = (e.clientY - r.top) / r.height; });
  cv.parentElement.addEventListener('pointerleave', () => { mx = my = null; });
  const draw = dt => {
    c.resize(); const { ctx, w, h } = c; t += dt;
    ctx.fillStyle = 'rgba(10,13,17,.22)'; ctx.fillRect(0, 0, w, h);
    // lattice sites (diamond-cubic projected along [110] looks like a hexagonal dumbbell grid)
    const a = 46;
    ctx.fillStyle = 'rgba(138,148,163,.22)';
    for (let y = 0, row = 0; y < h + a; y += a * 0.866, row++) for (let x = (row % 2) * a / 2; x < w + a; x += a) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.arc(x + 6, y + 8, 1.6, 0, 7); ctx.fill(); }
    // field: toward the pointer if present, else a slow rotating field
    let gx = Math.cos(t * 0.15) * 0.35, gy = Math.sin(t * 0.15) * 0.12;
    if (mx !== null) { gx = (mx - 0.5) * 1.2; gy = (my - 0.5) * 1.2; }
    fx += (gx - fx) * Math.min(dt * 3, 1); fy += (gy - fy) * Math.min(dt * 3, 1);
    for (const p of P) {
      p.vx += fx * dt * 0.9 + (Math.random() - .5) * dt * 1.4; p.vy += fy * dt * 0.9 + (Math.random() - .5) * dt * 1.4;
      if (Math.random() < dt * 3) { const s = Math.hypot(p.vx, p.vy) * 0.6, th = Math.random() * 6.283; p.vx = Math.cos(th) * s; p.vy = Math.sin(th) * s; p.flash = 0.3; }
      p.vx *= 0.995; p.vy *= 0.995;
      p.x += p.vx * dt * 0.09; p.y += p.vy * dt * 0.09 * w / h;
      p.x -= Math.floor(p.x); p.y -= Math.floor(p.y);
      const sp = Math.min(Math.hypot(p.vx, p.vy) / 1.6, 1);
      ctx.fillStyle = rgb(ramp(0.25 + sp * 0.75));
      ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 1.8 + sp * 1.2, 0, 7); ctx.fill();
      if (p.flash > 0) { p.flash -= dt; ctx.strokeStyle = `rgba(242,184,75,${p.flash * 1.5})`; ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 4 + (0.3 - p.flash) * 30, 0, 7); ctx.stroke(); }
    }
  };
  if (reduceMotion) { for (let i = 0; i < 60; i++) draw(0.016); return; }
  let last = 0, on = true;
  new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on) requestAnimationFrame(loop); }).observe(cv);
  function loop(now) { if (!on) return; const dt = Math.min((now - (last || now)) / 1000, 0.05); last = now; draw(dt); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
}, 'hero');

// ---------- equations ----------
function renderTeX() {
  if (!window.katex) return;
  document.querySelectorAll('[data-tex]').forEach(n => {
    safe(() => window.katex.render(n.dataset.tex, n, { displayMode: n.classList.contains('eq'), throwOnError: false, strict: 'ignore' }), 'tex');
  });
}
if (window.katex) renderTeX(); else addEventListener('load', renderTeX);

// ---------- labs: load each module when its section approaches the viewport ----------
const LABS = { bands: './bands.js', pn: './junction.js', mos: './moscap.js', tunnel: './tunnel.js', short: './shortchannel.js', drift: './drift.js', crystal: './crystal.js' };
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

// ---------- table of contents: active section + reading progress ----------
safe(() => {
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
}, 'toc');

// ---------- spotlight borders ----------
document.addEventListener('pointermove', e => {
  const g = e.target.closest?.('.glow'); if (!g) return;
  const r = g.getBoundingClientRect(); g.style.setProperty('--mx', (e.clientX - r.left) + 'px'); g.style.setProperty('--my', (e.clientY - r.top) + 'px');
});

// ---------- references ----------
safe(() => {
  const host = $('#plRefs'); if (!host) return;
  const used = new Set([...document.querySelectorAll('[data-refs]')].flatMap(n => n.dataset.refs.split(/\s+/)));
  const list = Object.values(REFS).filter(r => used.has(r.id)).sort((a, b) => a.cite.localeCompare(b.cite));
  host.innerHTML = list.map(r => `<li id="ref-${r.id}">${r.cite} ${r.link ? `<a href="${r.link}" rel="noopener">${r.doi ? 'doi:' + r.doi : 'link'}</a>` : ''}</li>`).join('');
  document.querySelectorAll('[data-refs]').forEach(n => {
    n.innerHTML = n.dataset.refs.split(/\s+/).filter(k => REFS[k]).map(k => `<a href="#ref-${k}" title="${REFS[k].cite.replace(/"/g, '&quot;')}">${k}</a>`).join('');
  });
}, 'refs');
