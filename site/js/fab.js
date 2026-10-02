// Fab stepper: animated walk through the GAA nanosheet process flow
export function initFab(DATA) {
  const steps = DATA.process; if (!steps || !steps.length) return;
  const A = document.getElementById('fabImgA'), B = document.getElementById('fabImgB');
  const range = document.getElementById('fabRange'), count = document.getElementById('fabCount');
  const title = document.getElementById('fabTitle'), tool = document.getElementById('fabTool'), detail = document.getElementById('fabDetail');
  const list = document.getElementById('fabList'), play = document.getElementById('fabPlay'), frame = document.getElementById('fabFrame');
  range.max = steps.length;
  steps.forEach(s => { const i = new Image(); i.src = s.svg; });   // preload
  list.innerHTML = steps.map(s => `<li><button data-i="${s.step}"><span>${String(s.step).padStart(2, '0')}</span>${s.title}</button></li>`).join('');
  let cur = 0, front = A, back = B, timer = null;
  B.style.opacity = 0;
  function go(n) {
    n = Math.min(Math.max(n, 1), steps.length); if (n === cur) return; cur = n;
    const s = steps[n - 1];
    back.src = s.svg; back.alt = `Step ${n}: ${s.title}`;
    back.style.opacity = 1; front.style.opacity = 0; [front, back] = [back, front];
    range.value = n; count.textContent = `${n} / ${steps.length}`;
    title.textContent = s.title; tool.textContent = s.tool; detail.textContent = s.detail;
    list.querySelectorAll('button').forEach(b => b.toggleAttribute('aria-current', +b.dataset.i === n));
    list.querySelector('[aria-current]')?.setAttribute('aria-current', 'step');
  }
  function stop() { clearInterval(timer); timer = null; play.textContent = 'Play'; }
  play.addEventListener('click', () => {
    if (timer) return stop();
    if (cur >= steps.length) go(1);
    play.textContent = 'Pause';
    timer = setInterval(() => { if (cur >= steps.length) stop(); else go(cur + 1); }, 1800);
  });
  document.getElementById('fabPrev').addEventListener('click', () => { stop(); go(cur - 1); });
  document.getElementById('fabNext').addEventListener('click', () => { stop(); go(cur + 1); });
  range.addEventListener('input', () => { stop(); go(+range.value); });
  list.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { stop(); go(+b.dataset.i); } });
  frame.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { stop(); go(cur + 1); } if (e.key === 'ArrowLeft') { stop(); go(cur - 1); } });
  go(1);
}
