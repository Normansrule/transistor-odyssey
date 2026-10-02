import { el, frame, axes, linear, log, logTicks, fmtPow, tooltip, C } from './svgchart.js';

const FAM = [
  { id: 'planar', label: 'Planar silicon', color: C.s1 },
  { id: '3d', label: 'FinFET / GAA / stacked silicon', color: C.s2 },
  { id: 'beyond', label: 'Beyond-silicon research', color: C.s3 },
];
const fmtN = n => n >= 1e12 ? (n / 1e12).toFixed(n >= 1e13 ? 0 : 1) + ' trillion' : n >= 1e9 ? (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + ' billion' : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 2) + ' million' : n.toLocaleString('en-US');
const fmtNode = nm => nm >= 1000 ? (nm / 1000) + ' µm' : nm + ' nm';

export function initMoore(DATA) {
  const host = document.getElementById('mooreChart');
  const card = document.getElementById('mooreCard');
  const tip = tooltip(card);
  const on = new Set(FAM.map(f => f.id));
  const legend = document.getElementById('mooreLegend');
  legend.innerHTML = FAM.map(f => `<button aria-pressed="true" data-f="${f.id}"><i style="background:${f.color}"></i>${f.label}</button>`).join('');
  legend.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const f = b.dataset.f; on.has(f) ? on.delete(f) : on.add(f);
    b.setAttribute('aria-pressed', on.has(f)); draw();
  });
  const chips = DATA.chips;
  // Moore fit on production chips (matches sim/transistor_sim/scaling.py)
  const prod = chips.filter(c => c.family !== 'beyond' && !['wse3', 'ibm07'].includes(c.id));
  const mx = prod.reduce((s, c) => s + c.year, 0) / prod.length, my = prod.reduce((s, c) => s + Math.log2(c.transistors), 0) / prod.length;
  const slope = prod.reduce((s, c) => s + (c.year - mx) * (Math.log2(c.transistors) - my), 0) / prod.reduce((s, c) => s + (c.year - mx) ** 2, 0);
  const icpt = my - slope * mx;
  const LABEL = new Set(['i4004', 'i80486', 'ivy', 'm1max', 'b200', 'wse3', 'ibm07', 'wuji', 'rv16x']);

  function draw() {
    const narrow = host.clientWidth < 640;
    const f = frame(host, narrow ? { w: 480, h: 520, m: { t: 12, r: 12, b: 40, l: 50 } } : { w: 1000, h: 520, m: { t: 16, r: 24, b: 44, l: 64 } });
    const xs = linear(1969, 2028, f.x0, f.x1), ys = log(50, 2e13, f.y0, f.y1);
    axes(f, xs, ys, { xt: narrow ? [1970, 1990, 2010] : [1970, 1980, 1990, 2000, 2010, 2020], yt: logTicks(100, 1e13, 2), yl: 'Transistors per chip', yf: fmtPow });
    const fy = y => 2 ** (slope * y + icpt);
    el('line', { x1: xs(1970), y1: ys(fy(1970)), x2: xs(2027), y2: ys(fy(2027)), stroke: C.muted, 'stroke-width': 1.2 }, f.svg);
    el('text', { x: narrow ? f.x1 : xs(2004), y: narrow ? f.y0 - 12 : ys(fy(2004)) + 38, 'text-anchor': narrow ? 'end' : 'start', fill: C.ink2, 'font-size': 13 }, f.svg).textContent = `fit: doubling every ${(1 / slope).toFixed(2)} years`;
    for (const c of chips) {
      if (!on.has(c.family)) continue;
      const fam = FAM.find(q => q.id === c.family);
      const g = el('g', { tabindex: 0, role: 'button', 'aria-label': `${c.name}, ${c.year}, ${fmtN(c.transistors)} transistors` }, f.svg);
      el('circle', { cx: xs(c.year), cy: ys(c.transistors), r: 14, fill: 'transparent' }, g);
      const dot = el('circle', { cx: xs(c.year), cy: ys(c.transistors), r: 5.5, fill: fam.color, stroke: C.surface, 'stroke-width': 2 }, g);
      if (LABEL.has(c.id) && !narrow) {
        const left = c.year > 2010;
        const OFF = { ibm07: [-12, 22], m1max: [-12, -10], b200: [-12, -6], wse3: [-12, 4], wuji: [-12, 20], rv16x: [-12, -8] };
        const [dx, dy] = OFF[c.id] || [left ? -10 : 10, 4];
        el('text', { x: xs(c.year) + dx, y: ys(c.transistors) + dy, 'text-anchor': dx < 0 ? 'end' : 'start', fill: C.ink2, 'font-size': 12 }, f.svg).textContent = c.name.replace(' (wafer-scale)', '').replace(' test chip', '');
      }
      const show = e => {
        dot.setAttribute('r', 7.5);
        const r = card.getBoundingClientRect(), b = dot.getBoundingClientRect();
        tip.show(`<b>${c.name}</b><div class="row"><span>Year</span><span>${c.year}</span></div><div class="row"><span>Transistors</span><span>${fmtN(c.transistors)}${c.approx ? ' (approx.)' : ''}</span></div><div class="row"><span>Process</span><span>${fmtNode(c.process_nm)}</span></div><div class="row"><span>Material</span><span>${c.material}</span></div>${c.note ? `<div style="margin-top:6px;max-width:260px">${c.note}</div>` : ''}`,
          e?.clientX ?? b.right, e?.clientY ?? b.bottom);
      };
      g.addEventListener('pointerenter', show); g.addEventListener('pointermove', show);
      g.addEventListener('focus', () => show());
      g.addEventListener('pointerleave', () => { dot.setAttribute('r', 5.5); tip.hide(); });
      g.addEventListener('blur', () => { dot.setAttribute('r', 5.5); tip.hide(); });
    }
  }
  draw();
  let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 150); });

  const btn = document.getElementById('mooreTableBtn'), tbl = document.getElementById('mooreTable');
  tbl.innerHTML = `<table class="datatable"><thead><tr><th>Chip</th><th>Year</th><th class="num">Transistors</th><th>Process</th><th>Material / structure</th></tr></thead><tbody>${chips.slice().sort((a, b) => a.year - b.year).map(c => `<tr><td>${c.name}</td><td class="num">${c.year}</td><td class="num">${c.transistors.toLocaleString('en-US')}</td><td>${fmtNode(c.process_nm)}</td><td>${c.material}</td></tr>`).join('')}</tbody></table>`;
  btn.addEventListener('click', () => { tbl.hidden = !tbl.hidden; btn.setAttribute('aria-expanded', !tbl.hidden); btn.textContent = tbl.hidden ? 'Show data table' : 'Hide data table'; });
}

// ---------------------------------------------------------------------------
const PROPS = [
  { k: 'Eg_eV', label: 'Bandgap', unit: 'eV', note: 'Wider gap: lower leakage, higher temperature and voltage. Graphene has none, so it cannot turn off.', log: false },
  { k: 'mu_n', label: 'Electron mobility', unit: 'cm²/V·s', note: 'Speed of electrons in low fields. 2D/1D values are ranges; CVD MoS₂ films measure 10–100.', log: true },
  { k: 'Ec_MVcm', label: 'Breakdown field', unit: 'MV/cm', note: 'Field a material withstands before avalanche. Sets the voltage a thin drift layer can block.', log: true },
  { k: 'k_WcmK', label: 'Thermal conductivity', unit: 'W/cm·K', note: 'How fast heat leaves the channel. Diamond is 15× silicon, which is why GaN-on-diamond exists.', log: true },
  { k: 'bfom', label: 'Baliga FOM (× Si)', unit: '× Si', note: 'ε·µ·E_c³ relative to silicon: conduction loss of a power switch at a fixed blocking voltage (Baliga 1982).', log: true },
];

export function initMaterials(DATA) {
  const mats = DATA.materials;
  const si = mats.find(m => m.id === 'Si');
  const bf = m => (m.Ec_MVcm && m.eps_r) ? (m.eps_r * m.mu_n * m.Ec_MVcm ** 3) / (si.eps_r * si.mu_n * si.Ec_MVcm ** 3) : null;
  mats.forEach(m => { m.bfom = bf(m); });
  const seg = document.getElementById('propSeg');
  seg.innerHTML = PROPS.map((p, i) => `<button aria-pressed="${i === 0}" data-k="${p.k}">${p.label}</button>`).join('');
  const host = document.getElementById('matChart');
  const chartCard = host.parentElement; const tip = tooltip(chartCard);
  let prop = PROPS[0], selected = 'GaN';

  const cards = document.getElementById('matCards');
  cards.innerHTML = mats.map(m => `<button class="card mcard glow" data-id="${m.id}" aria-pressed="${m.id === selected}"><span class="sym"><i style="background:${m.color_hint}"></i><b>${m.formula}</b></span><span class="cls">${m.class}</span><p>${m.status}</p></button>`).join('');
  cards.addEventListener('click', e => { const b = e.target.closest('.mcard'); if (b) select(b.dataset.id); });
  seg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    prop = PROPS.find(p => p.k === b.dataset.k); draw();
  });

  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(draw, 150); });
  function draw() {
    const rows = mats.filter(m => m[prop.k] !== null && m[prop.k] !== undefined && (m[prop.k] > 0 || !prop.log)).sort((a, b) => b[prop.k] - a[prop.k]);
    const rowH = 30, w = Math.max(340, Math.min(620, host.clientWidth || 620)), left = w < 480 ? 96 : 128;
    const f = frame(host, { w, h: rows.length * rowH + 44, m: { t: 8, r: 70, b: 30, l: left } });
    const max = Math.max(...rows.map(r => r[prop.k]));
    const xs = prop.log ? log(prop.k === 'bfom' ? 0.05 : Math.min(...rows.map(r => r[prop.k])) / 2, max * 1.2, f.x0, f.x1) : linear(0, max * 1.1, f.x0, f.x1);
    const ticks = prop.log ? logTicks(xs.domain[0], xs.domain[1]) : [0, 1, 2, 3, 4, 5, 6].filter(v => v <= max * 1.1);
    const g = el('g', { class: 'axis' }, f.svg);
    for (const t of ticks) {
      el('line', { x1: xs(t), x2: xs(t), y1: f.y1, y2: f.y0, class: 'gridline' }, g);
      el('text', { x: xs(t), y: f.y0 + 16, 'text-anchor': 'middle' }, g).textContent = prop.log ? fmtPow(t) : t;
    }
    el('text', { x: (f.x0 + f.x1) / 2, y: f.h - 2, 'text-anchor': 'middle', fill: C.ink2, 'font-size': 12 }, g).textContent = `${prop.label} (${prop.unit})${prop.log ? ', log scale' : ''}`;
    rows.forEach((m, i) => {
      const y = f.y1 + i * rowH + 6, bh = 18;
      const x0 = prop.log ? f.x0 : xs(0), x1 = xs(m[prop.k]);
      const isSel = m.id === selected;
      const gg = el('g', { style: 'cursor:pointer' }, f.svg);
      el('rect', { x: 0, y: y - 5, width: w, height: rowH, fill: 'transparent' }, gg);
      el('path', { d: `M${x0} ${y}H${x1 - 4}a4 4 0 0 1 4 4v${bh - 8}a4 4 0 0 1 -4 4H${x0}Z`, fill: isSel ? '#f2b84b' : C.s1 }, gg);
      el('text', { x: left - 10, y: y + 13, 'text-anchor': 'end', fill: isSel ? C.ink : C.ink2, 'font-size': 13, 'font-weight': isSel ? 600 : 400 }, gg).textContent = m.formula;
      const v = m[prop.k];
      el('text', { x: x1 + 6, y: y + 13, fill: C.ink2, 'font-size': 12, 'font-family': 'IBM Plex Mono, monospace' }, gg).textContent = v >= 100 ? Math.round(v).toLocaleString('en-US') : +v.toPrecision(3);
      gg.addEventListener('click', () => select(m.id));
      gg.addEventListener('pointermove', e => tip.show(`<b>${m.name}</b><div class="row"><span>${prop.label}</span><span>${+v.toPrecision(4)} ${prop.unit}</span></div><div style="margin-top:4px;max-width:240px">${m.logic_role}</div>`, e.clientX, e.clientY));
      gg.addEventListener('pointerleave', () => tip.hide());
    });
    document.getElementById('propNote').textContent = prop.note;
  }

  const XSEC = { GaN: 'gan_hemt', GaAs: 'gaas_phemt', SiC: 'sic_mosfet', C: 'diamond_fet', CNT: 'cnt_fet', MoS2: 'mos2', WSe2: 'mos2', Si: 'gaa', Ge: 'point_contact', InP: 'gaas_phemt', Ga2O3: 'sic_mosfet', Graphene: 'cnt_fet' };
  function select(idm) {
    selected = idm;
    cards.querySelectorAll('.mcard').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === idm));
    const m = mats.find(x => x.id === idm);
    const fmt = (v, u) => v === null || v === undefined ? '—' : `${v} ${u}`;
    document.getElementById('matDetail').innerHTML = `
      <img src="assets/xsec/${XSEC[m.id]}.svg" alt="Cross-section of a representative ${m.name} device" loading="lazy">
      <div style="display:grid;gap:14px">
        <div><span class="eyebrow">${m.class}</span><h3 style="font-size:26px;margin-top:8px">${m.name}</h3></div>
        <p style="color:var(--ink-2)">${m.logic_role}. ${m.status}.</p>
        <dl class="kv">
          <dt>Bandgap</dt><dd>${m.Eg_eV} eV (${m.gap})</dd>
          <dt>Electron / hole mobility</dt><dd>${fmt(m.mu_n, '')} / ${fmt(m.mu_p, 'cm²/V·s')}</dd>
          <dt>Breakdown field</dt><dd>${fmt(m.Ec_MVcm, 'MV/cm')}</dd>
          <dt>Thermal conductivity</dt><dd>${fmt(m.k_WcmK, 'W/cm·K')}</dd>
          <dt>Saturation velocity</dt><dd>${m.vsat ? m.vsat + '×10⁷ cm/s' : '—'}</dd>
          <dt>Baliga FOM</dt><dd>${m.bfom ? (+m.bfom.toPrecision(3)).toLocaleString('en-US') + '× Si' : '—'}</dd>
          <dt>First transistor</dt><dd>${m.first_transistor}</dd>
        </dl>
        ${m.note ? `<p class="small">${m.note}</p>` : ''}
        <div class="refchips">${m.refs.map(r => { const ref = DATA.refs.find(x => x.id === r); return ref ? `<a href="${ref.link}" target="_blank" rel="noopener">${r}</a>` : ''; }).join('')}</div>
      </div>`;
    draw();
  }
  select(selected);
}
