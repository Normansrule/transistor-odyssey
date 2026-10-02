// Niche atlas: filterable cards of forgotten, niche and exotic transistors
export function initNiche(DATA) {
  const devs = DATA.niche; if (!devs) return;
  const refById = Object.fromEntries(DATA.refs.map(r => [r.id, r]));
  const cats = ['All', ...new Set(devs.map(d => d.cat))];
  const statusLabel = { museum: 'Museum piece', niche: 'Niche product', mainstream: 'In most devices', research: 'Research' };
  const seg = document.getElementById('nicheCats'), grid = document.getElementById('nicheGrid'), count = document.getElementById('nicheCount');
  let cat = 'All';
  seg.innerHTML = cats.map(c => `<button aria-pressed="${c === cat}" data-c="${c}">${c}</button>`).join('');
  seg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; cat = b.dataset.c; seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); render(); });
  function render() {
    const rows = devs.filter(d => cat === 'All' || d.cat === cat).sort((a, b) => a.year - b.year);
    count.textContent = `${rows.length} devices`;
    grid.innerHTML = rows.map(d => `<article class="card ncard glow">
      <img src="assets/xsec/${d.arch}.svg" alt="Cross-section: ${d.name}" loading="lazy">
      <div class="nmeta"><span class="nyear">${d.year}</span><span class="pill ${d.status}">${statusLabel[d.status]}</span></div>
      <h3>${d.name}</h3>
      <span class="ncat">${d.cat}</span>
      <p>${d.summary}</p>
      <div class="refchips">${d.refs.map(r => refById[r] ? `<a href="${refById[r].link}" target="_blank" rel="noopener" title="${refById[r].cite.replace(/"/g, '&quot;')}">${r}</a>` : '').join('')}</div>
    </article>`).join('');
  }
  render();
}
