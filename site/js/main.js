import { DATA } from './data.js';
import { startFluid } from './fluid.js';
import { initLab } from './lab.js';
import { initMoore, initMaterials } from './charts.js';

const $ = (s, r = document) => r.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const refById = Object.fromEntries(DATA.refs.map(r => [r.id, r]));
const img = f => DATA.images.find(i => i.file === f);
const photoSrc = f => { const i = img(f); return i ? (i.local || i.src) : 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(f) + '?width=960'; };
const fmtLen = nm => nm >= 1e6 ? (nm / 1e6) + ' mm' : nm >= 1000 ? (+(nm / 1000).toPrecision(3)) + ' µm' : (+nm.toPrecision(3)) + ' nm';
const safe = (fn, name) => { try { fn(); } catch (e) { console.error(name, e); } };

// ---------- hero ----------
safe(() => startFluid($('#fluid')), 'fluid');
safe(() => {
  const items = DATA.chips.slice().sort((a, b) => a.year - b.year)
    .map(c => `<span><b>${c.year}</b>${c.name} · ${c.transistors.toLocaleString('en-US')}</span>`).join('');
  $('#marquee').innerHTML = items + items;
}, 'marquee');
safe(() => {
  const els = document.querySelectorAll('[data-count]');
  const fmt = (el, v) => {
    const f = el.dataset.format, s = el.dataset.suffix || '';
    el.textContent = (f === 'dec2' ? v.toFixed(2) : f === 'int' ? Math.round(v).toLocaleString('en-US') : Math.round(v).toLocaleString('en-US')) + s;
  };
  if (reduce) return;
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; io.unobserve(e.target);
    const el = e.target, to = +el.dataset.count, t0 = performance.now(), dur = 1400;
    const step = now => { const k = Math.min((now - t0) / dur, 1), ease = 1 - (1 - k) ** 3; fmt(el, to * ease); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), { threshold: 0.6 });
  els.forEach(el => io.observe(el));
}, 'counters');

// ---------- scale ruler ----------
safe(() => {
  const MARKS = [
    [7e-5, 'Human hair'], [5e-5, 'Point-contact gap, 1947'], [1e-5, 'Intel 4004 gate, 1971'], [7e-6, 'Red blood cell'],
    [2e-6, 'E. coli bacterium'], [1e-6, 'i486 gate, 1989'], [1.3e-7, '180 nm-node gate'], [1e-7, 'MoS₂ FET channel (NYCU/TSMC)'],
    [2.6e-8, '22 nm FinFET gate'], [1.35e-8, 'EUV wavelength'], [5e-9, 'Nanosheet thickness'], [2.5e-9, 'DNA double helix'],
    [1e-9, 'EOT of the MoS₂ gate stack'], [7e-10, 'MoS₂ monolayer'], [5.43e-10, 'Silicon lattice constant'],
    [4.2e-10, 'AlOx interface layer'], [2.35e-10, 'Si–Si bond length'],
  ];
  const cv = $('#ruler'), range = $('#rulerRange'), out = $('#rulerReadout'), what = $('#rulerWhat');
  const ctx = cv.getContext('2d');
  const LO = -10, HI = -3;
  function fmt(m) {
    const nm = m * 1e9;
    if (nm >= 1e6) return [(nm / 1e6).toPrecision(2), 'mm'];
    if (nm >= 1000) return [(+(nm / 1000).toPrecision(3)).toString(), 'µm'];
    return [(+nm.toPrecision(3)).toString(), 'nm'];
  }
  function draw() {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const x = l => 12 + (HI - l) / (HI - LO) * (W - 24);
    const base = H * 0.5;
    ctx.strokeStyle = '#2f3845'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(12, base); ctx.lineTo(W - 12, base); ctx.stroke();
    ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillStyle = '#8a94a3';
    for (let e = HI; e >= LO; e--) {
      const X = x(e); ctx.beginPath(); ctx.moveTo(X, base - 7); ctx.lineTo(X, base + 7); ctx.stroke();
      const [v, u] = fmt(10 ** e); ctx.textAlign = X < 30 ? 'left' : X > W - 30 ? 'right' : 'center'; ctx.fillText(v + ' ' + u, X, base + 20);
      for (let k = 2; k < 10; k++) { const Xm = x(e - 1 + Math.log10(k)); if (e - 1 >= LO - 1 && Xm > 12) { ctx.beginPath(); ctx.moveTo(Xm, base - 3); ctx.lineTo(Xm, base + 3); ctx.stroke(); } }
    }
    const v = +range.value;
    const narrow = W < 640;
    const ROWS = [base - 18, base - 44, base - 70, base + 42, base + 66];
    const lastRight = ROWS.map(() => -1e9);
    ctx.font = '11.5px "IBM Plex Sans", sans-serif';
    MARKS.map(([m, t]) => ({ m, t, X: x(Math.log10(m)) })).sort((a, b) => a.X - b.X).forEach(({ m, t, X }) => {
      const near = Math.abs(Math.log10(m) - v) < 0.15;
      const tw = ctx.measureText(t).width + 12;
      let left = Math.max(12, Math.min(X - tw / 2, W - 12 - tw));
      let row = ROWS.findIndex((_, r) => lastRight[r] < left);
      if (row < 0) row = lastRight.indexOf(Math.min(...lastRight));
      lastRight[row] = left + tw;
      const y = ROWS[row], up = y < base;
      ctx.fillStyle = near ? '#f2b84b' : '#aab3c0'; ctx.strokeStyle = near ? '#f2b84b' : '#3a4350';
      ctx.beginPath(); ctx.moveTo(X, base); ctx.lineTo(X, y + (up ? 4 : -12)); ctx.stroke();
      ctx.beginPath(); ctx.arc(X, base, near ? 4.5 : 3, 0, 7); ctx.fill();
      if (!narrow || near) { ctx.textAlign = 'left'; ctx.font = (near ? '600 ' : '') + '11.5px "IBM Plex Sans", sans-serif'; ctx.fillText(t, left + 6, y); }
    });
    const X = x(v);
    ctx.fillStyle = 'rgba(242,184,75,.12)'; ctx.fillRect(X - 1, 8, 2, H - 16);
    ctx.fillStyle = '#f2b84b'; ctx.beginPath(); ctx.moveTo(X - 7, 6); ctx.lineTo(X + 7, 6); ctx.lineTo(X, 15); ctx.fill();
    const [val, unit] = fmt(10 ** v); out.innerHTML = `${val}<small>${unit}</small>`;
    const nearest = MARKS.reduce((b, mk) => Math.abs(Math.log10(mk[0]) - v) < Math.abs(Math.log10(b[0]) - v) ? mk : b);
    what.textContent = Math.abs(Math.log10(nearest[0]) - v) < 0.2 ? nearest[1] : `About ${Math.round(10 ** (v + 10) / 2.35)} silicon bond lengths`;
  }
  range.addEventListener('input', draw);
  let drag = false;
  const setFrom = e => { const r = cv.getBoundingClientRect(); const f = (e.clientX - r.left - 12) / (r.width - 24); range.value = (HI - f * (HI - LO)).toFixed(3); draw(); };
  cv.addEventListener('pointerdown', e => { drag = true; cv.setPointerCapture(e.pointerId); setFrom(e); });
  cv.addEventListener('pointermove', e => drag && setFrom(e));
  cv.addEventListener('pointerup', () => { drag = false; });
  new ResizeObserver(draw).observe(cv);
  // gentle intro sweep from 10 µm to 0.42 nm
  if (!reduce) {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      const t0 = performance.now(), a = -5, b = Math.log10(4.2e-10);
      const step = now => { const k = Math.min((now - t0) / 2600, 1), s = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; range.value = a + (b - a) * s; draw(); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }, { threshold: 0.5 });
    io.observe(cv);
  }
}, 'ruler');

// ---------- timeline ----------
safe(() => {
  const track = $('#tlTrack');
  track.innerHTML = DATA.eras.map(e => {
    const refs = (e.refs || []).map(r => refById[r]).filter(Boolean).slice(0, 4)
      .map(r => `<a href="${r.link}" target="_blank" rel="noopener" title="${r.cite.replace(/"/g, '&quot;')}">${r.id}</a>`).join('');
    return `<article class="era glow">
      <div class="era-top"><span class="era-year">${e.year}</span><span class="era-size">${fmtLen(e.feature_nm)}</span></div>
      <div><h3>${e.title}</h3><div class="who">${e.who}</div></div>
      <img class="xsec" src="assets/xsec/${e.arch}.svg" alt="Cross-section: ${e.title}" loading="lazy">
      <p class="sum">${e.summary}</p>
      <div class="refchips">${refs}</div>
    </article>`;
  }).join('');
  const bar = $('#tlBar');
  track.addEventListener('scroll', () => { bar.style.transform = `scaleX(${track.scrollLeft / (track.scrollWidth - track.clientWidth || 1)})`; }, { passive: true });
  if (window.gsap && window.ScrollTrigger && !reduce) {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add('(min-width: 900px)', () => {
      const outer = $('#tlOuter'); outer.classList.add('tl-pinned');
      const dist = () => track.scrollWidth - innerWidth + 40;
      const tw = gsap.to(track, { x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: outer, start: 'top 12%', end: () => '+=' + dist(), pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1,
          onUpdate: s => { bar.style.transform = `scaleX(${s.progress})`; } } });
      return () => { outer.classList.remove('tl-pinned'); tw.scrollTrigger?.kill(); tw.kill(); gsap.set(track, { x: 0 }); };
    });
    document.querySelectorAll('.reveal').forEach(el => {
      const r = el.getBoundingClientRect(); if (r.top < innerHeight) return;
      el.classList.add('pre');
      ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true, onEnter: () => el.classList.remove('pre') });
    });
  }
}, 'timeline');

// ---------- lab, charts, 3D ----------
safe(() => initLab(DATA), 'lab');
safe(() => initMoore(DATA), 'moore');
safe(() => initMaterials(DATA), 'materials');
(async () => {
  try {
    const mod = await import('./explorer3d.js');
    mod.initExplorer(DATA);
  } catch (e) {
    console.error('explorer', e);
    $('#stage').insertAdjacentHTML('beforeend', '<div class="stage-fallback">The 3D explorer could not load here. The timeline cross-sections show the same structures.</div>');
  }
})();

// ---------- photo vs simulation ----------
safe(() => {
  const ITEMS = [
    { name: 'Point-contact transistor', sub: '1947 · germanium', photo: 'Replica-of-first-transistor.jpg', sim: 'assets/xsec/point_contact.svg' },
    { name: 'Intel 4004 layout', sub: '1971 · 10 µm pMOS', photo: 'Intel_4004_Chip_Layout_(29983532570).jpg', sim: 'assets/layout/inverter_10_um.svg' },
    { name: 'MOS 6502', sub: '1975 · 8 µm nMOS', photo: 'MOS_6502_die.jpg', sim: 'assets/xsec/planar_mosfet_poly.svg' },
    { name: 'Intel 80386', sub: '1985 · 1.5 µm CMOS', photo: 'Intel_80386_DX_die.JPG', sim: 'assets/layout/inverter_1p5_um.svg' },
    { name: 'Intel 80486 DX2', sub: '1992 · 800 nm CMOS', photo: 'Intel_80486_DX2_die.JPG', sim: 'assets/xsec/cmos_pair.svg' },
    { name: 'Pentium II', sub: '1999 · 250 nm', photo: 'Intel-pentium-ii-dixon-die-shot-high-resolution-stitched.jpg', sim: 'assets/layout/inverter_180_nm.svg' },
    { name: 'AMD Zen 2 core', sub: '2019 · 7 nm FinFET', photo: 'Zen2_Matisse_Ryzen_7nm_Core_Die_shot.jpg', sim: 'assets/xsec/finfet.svg' },
    { name: 'AMD Zen 5 CCD', sub: '2024 · 4 nm FinFET', photo: 'AMD@4nmCCD(6nmIOD)@Zen5@Granite_Ridge@Ryzen_5_9600X@100-000001405_BY_2429SUY_9AEQ579S40073_DSCx14_CCD_poly@5xExt.jpg', sim: 'assets/layout/inverter_5_nm_FinFET.svg' },
  ];
  const list = $('#compareList'), photo = $('#cmpPhoto'), sim = $('#cmpSim'), credit = $('#cmpCredit'), box = $('#compare'), knob = $('#cmpKnob');
  list.innerHTML = ITEMS.map((it, i) => `<button aria-pressed="${i === 0}" data-i="${i}"><b>${it.name}</b><span>${it.sub}</span></button>`).join('');
  const fallback = it => `<div class="photo-fallback"><div><b>${it.name}</b>The photo loads from Wikimedia Commons when this page is online.<br><a href="${img(it.photo)?.page || '#'}" target="_blank" rel="noopener">Open the original on Commons ↗</a></div></div>`;
  function show(i) {
    const it = ITEMS[i];
    list.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.i === i));
    photo.innerHTML = `<img src="${photoSrc(it.photo)}" alt="Photograph: ${it.name}" referrerpolicy="no-referrer">`;
    photo.querySelector('img').addEventListener('error', () => { photo.innerHTML = fallback(it); }, { once: true });
    sim.innerHTML = `<img src="${it.sim}" alt="Generated drawing for ${it.name}">`;
    const m = img(it.photo);
    credit.innerHTML = m ? `Photo: ${m.subject}. ${m.author !== 'see source' ? m.author + ', ' : ''}${m.license}. <a href="${m.page}" target="_blank" rel="noopener">Source ↗</a> · Right side generated by <span class="mono">sim/transistor_sim</span>.` : '';
  }
  list.addEventListener('click', e => { const b = e.target.closest('button'); if (b) show(+b.dataset.i); });
  const set = clientX => { const r = box.getBoundingClientRect(); box.style.setProperty('--split', Math.min(Math.max((clientX - r.left) / r.width * 100, 2), 98) + '%'); };
  let drag = false;
  box.addEventListener('pointerdown', e => { drag = true; box.setPointerCapture(e.pointerId); set(e.clientX); });
  box.addEventListener('pointermove', e => drag && set(e.clientX));
  box.addEventListener('pointerup', () => { drag = false; });
  knob.addEventListener('keydown', e => { const cur = parseFloat(getComputedStyle(box).getPropertyValue('--split')) || 50; if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); box.style.setProperty('--split', Math.min(Math.max(cur + (e.key === 'ArrowLeft' ? -4 : 4), 2), 98) + '%'); } });
  show(0);

  $('#photoGrid').innerHTML = DATA.images.filter(i => i.kind !== 'diagram').map(i => `<figure class="card pcard glow" style="margin:0">
      <div class="img"><img src="${i.local || i.src}" alt="${i.subject}" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'photo-fallback',innerHTML:'<span>Photo from Wikimedia Commons</span>'}))"></div>
      <figcaption class="meta"><b>${i.subject}</b><span>${i.year} · ${i.author !== 'see source' ? i.author + ' · ' : ''}${i.license} · <a href="${i.page}" target="_blank" rel="noopener">Commons</a></span></figcaption></figure>`).join('');
}, 'compare');

// ---------- lithography ----------
safe(() => {
  const SRC = [
    { k: 'g', label: 'g-line 436', lam: 436, na: [0.2, 0.6, 0.45] }, { k: 'i', label: 'i-line 365', lam: 365, na: [0.3, 0.65, 0.6] },
    { k: 'krf', label: 'KrF 248', lam: 248, na: [0.4, 0.85, 0.8] }, { k: 'arf', label: 'ArF 193', lam: 193, na: [0.6, 0.93, 0.93] },
    { k: 'arfi', label: 'ArF immersion', lam: 193, na: [0.93, 1.35, 1.35] }, { k: 'euv', label: 'EUV 13.5', lam: 13.5, na: [0.25, 0.33, 0.33] },
    { k: 'hna', label: 'High-NA EUV', lam: 13.5, na: [0.45, 0.55, 0.55] },
  ];
  const seg = $('#lambdaSeg'), na = $('#na'), k1 = $('#k1');
  let src = SRC[4];
  seg.innerHTML = SRC.map(s => `<button aria-pressed="${s === src}" data-k="${s.k}">${s.label}</button>`).join('');
  seg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); src = SRC.find(s => s.k === b.dataset.k); na.min = src.na[0]; na.max = src.na[1]; na.value = src.na[2]; calc(); });
  const cv = $('#lithoCanvas'), ctx = cv.getContext('2d');
  function calc() {
    const NA = +na.value, K = +k1.value, hp = K * src.lam / NA;
    $('#naOut').textContent = NA.toFixed(2); $('#k1Out').textContent = K.toFixed(2);
    $('#lithoFormula').textContent = `HP = ${K.toFixed(2)} × ${src.lam} nm / ${NA.toFixed(2)} = ${hp.toFixed(1)} nm`;
    $('#lithoBig').textContent = hp.toFixed(1) + ' nm';
    const pitch = 2 * hp;
    const note = pitch < 24 ? 'Tighter than any single-exposure production layer today; needs multi-patterning or High-NA.' :
      pitch < 45 ? 'About the metal pitch of 5 nm–2 nm-class nodes.' : pitch < 100 ? 'About the gate pitch of 14–7 nm FinFET nodes.' : pitch < 400 ? 'Deep-submicron era (250–65 nm).' : 'Micron-era features (1970s–1990s).';
    $('#lithoNote').textContent = `Pitch ${pitch.toFixed(0)} nm. ${note} Below k₁ ≈ 0.25 two lines cannot be resolved in one exposure.`;
    const dpr = Math.min(devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0c0f14'; ctx.fillRect(0, 0, W, H);
    const field = 1000; const pxPerNm = W / field; const pp = pitch * pxPerNm;
    const blur = Math.max(0.5, (src.lam / NA) * 0.15 * pxPerNm);
    ctx.filter = `blur(${Math.min(blur, 6)}px)`;
    ctx.fillStyle = '#f2b84b';
    if (pp >= 1.2) for (let x = 0; x < W; x += pp) ctx.fillRect(x, 24, pp / 2, H - 58);
    else { ctx.fillStyle = 'rgba(242,184,75,.5)'; ctx.fillRect(0, 24, W, H - 58); }
    ctx.filter = 'none';
    ctx.fillStyle = '#8a94a3'; ctx.font = '11px "IBM Plex Mono", monospace'; ctx.textAlign = 'left';
    ctx.fillText('1 µm field · lines = resist after exposure', 8, H - 12);
    ctx.textAlign = 'right'; ctx.fillText(pp < 1.2 ? 'lines too dense to draw at this zoom' : `${Math.round(W / pp)} line pairs`, W - 8, H - 12);
  }
  na.addEventListener('input', calc); k1.addEventListener('input', calc);
  new ResizeObserver(calc).observe(cv);
}, 'litho');

// ---------- sources ----------
safe(() => {
  const list = $('#srcList'), q = $('#srcSearch'), cats = $('#srcCats'), count = $('#srcCount');
  const CATS = ['All', ...new Set(DATA.refs.map(r => r.cat))];
  let cat = 'All';
  cats.innerHTML = CATS.map(c => `<button aria-pressed="${c === cat}" data-c="${c}">${c}</button>`).join('');
  cats.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; cat = b.dataset.c; cats.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); render(); });
  q.addEventListener('input', render);
  function render() {
    const s = q.value.trim().toLowerCase();
    const rows = DATA.refs.map((r, i) => ({ ...r, n: i + 1 })).filter(r => (cat === 'All' || r.cat === cat) && (!s || (r.cite + ' ' + r.id + ' ' + r.cat).toLowerCase().includes(s)));
    count.textContent = `${rows.length} of ${DATA.refs.length}`;
    list.innerHTML = rows.map(r => `<li class="src-item"><span class="n">[${r.n}]</span><span><span class="cat">${r.cat} · ${r.id}</span>${r.cite}${r.link ? ` <a href="${r.link}" target="_blank" rel="noopener">${r.doi ? 'doi:' + r.doi : 'link'} ↗</a>` : ''}</span></li>`).join('');
  }
  render();
  $('#inspo').innerHTML = DATA.refs.filter(r => r.cat === 'Design inspiration').slice(0, 8).map(r => `<li><a href="${r.link}" target="_blank" rel="noopener">${r.cite.split(' — ')[0].replace(/\.$/, '')}</a></li>`).join('');
}, 'sources');

// ---------- small UX ----------
document.addEventListener('pointermove', e => {
  const g = e.target.closest?.('.glow'); if (!g) return;
  const r = g.getBoundingClientRect(); g.style.setProperty('--mx', (e.clientX - r.left) + 'px'); g.style.setProperty('--my', (e.clientY - r.top) + 'px');
}, { passive: true });
safe(() => {
  const links = [...document.querySelectorAll('.nav-links a')];
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
  links.forEach(a => { const s = document.querySelector(a.getAttribute('href')); if (s) io.observe(s); });
}, 'nav');
