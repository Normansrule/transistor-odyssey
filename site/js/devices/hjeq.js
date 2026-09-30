// Equilibrium heterojunction view: solved band diagram with animated carriers, plus carrier densities.
import { solve } from '../physics/hetero.js';

const EC = '#3987e5', EV = '#d95926', EFC = '#f2b84b', MUTED = '#8a94a3', E_COL = '#5aa2ff', H_COL = '#ff8a55';

function hi(cv) {
  const ctx = cv.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { ctx, w, h };
}
const lerpAt = (xs, ys, x) => {
  let lo = 0, hi = xs.length - 1;
  if (x <= xs[0]) return ys[0]; if (x >= xs[hi]) return ys[hi];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] > x) hi = m; else lo = m; }
  const t = (x - xs[lo]) / (xs[hi] - xs[lo]); return ys[lo] + (ys[hi] - ys[lo]) * t;
};

export class EqView {
  constructor(cvBands, cvDens, rnd = Math.random) { this.cb = cvBands; this.cd = cvDens; this.rnd = rnd; this.parts = []; this.t = 0; this.zoom = 'auto'; }

  update(A, B, dopA, dopB, V) {
    this.A = A; this.B = B; this.dopA = dopA; this.dopB = dopB;
    this.r = solve(A, B, dopA, dopB, V);
    const r = this.r, maxX = r.x_nm[r.x_nm.length - 1];
    this.span = Math.min(this.zoom === 'auto' ? this.autoSpan() : +this.zoom, maxX);
    this.sample();
    return r;
  }

  autoSpan() { const r = this.r; return (r.ns > 1e11 || r.ps > 1e11) ? 40 : Math.min(Math.max(1.3 * Math.max(r.wA_nm, r.wB_nm), 20), 3000); }
  setZoom(z) { this.zoom = z; if (this.r) { this.span = Math.min(z === 'auto' ? this.autoSpan() : +z, this.r.x_nm[this.r.x_nm.length - 1]); this.sample(); } }

  // place carrier markers with probability proportional to the local density in view
  sample() {
    const r = this.r, xs = r.x_nm, s = this.span, pick = (dens) => {
      const cum = []; let tot = 0, peak = 0;
      for (let i = 1; i < xs.length; i++) { const a = Math.max(xs[i - 1], -s), b = Math.min(xs[i], s); const w = b > a ? (b - a) * 0.5 * (dens[i] + dens[i - 1]) : 0; tot += w; cum.push(tot); if (b > a) peak = Math.max(peak, dens[i]); }
      if (peak < 1e12) return [];
      const n = 38, out = [];
      for (let k = 0; k < n; k++) {
        const u = this.rnd() * tot; let lo = 0, hi = cum.length - 1;
        while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < u) lo = m + 1; else hi = m; }
        const x = Math.max(Math.min(xs[lo] + this.rnd() * (xs[lo + 1] - xs[lo]), s), -s);
        out.push({ x, e: -0.03 * Math.log(Math.max(this.rnd(), 1e-4)), ph: this.rnd() * 6.28 });
      }
      return out;
    };
    this.el = pick(r.n); this.ho = pick(r.p);
  }

  draw(dt = 0) {
    if (!this.r) return;
    this.t += dt;
    const r = this.r, xs = r.x_nm, s = this.span;
    const { ctx, w, h } = hi(this.cb); ctx.clearRect(0, 0, w, h);
    const pad = { l: 52, r: 16, t: 34, b: 34 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b;
    let lo = Infinity, hiE = -Infinity;
    for (let i = 0; i < xs.length; i++) if (Math.abs(xs[i]) <= s) { lo = Math.min(lo, r.Ev[i]); hiE = Math.max(hiE, r.Ec[i]); }
    lo = Math.min(lo, r.EFA, r.EFB); hiE = Math.max(hiE, r.EFA, r.EFB);
    const pd = (hiE - lo) * 0.1; lo -= pd; hiE += pd;
    const X = x => pad.l + (x + s) / (2 * s) * W, Y = E => pad.t + (hiE - E) / (hiE - lo) * H;
    // material regions
    ctx.fillStyle = 'rgba(127,211,208,.05)'; ctx.fillRect(pad.l, pad.t, W / 2, H);
    ctx.fillStyle = 'rgba(181,143,214,.05)'; ctx.fillRect(pad.l + W / 2, pad.t, W / 2, H);
    ctx.font = '600 12px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#e8ecf1';
    const lab = (m, d) => `${m.name.split(' (')[0]}${m.kind === 'insulator' ? '' : d > 0 ? `  n ${sciShort(d)}` : d < 0 ? `  p ${sciShort(-d)}` : '  undoped'}`;
    ctx.fillText(lab(this.A, this.dopA), pad.l + W / 4, pad.t - 12); ctx.fillText(lab(this.B, this.dopB), pad.l + 3 * W / 4, pad.t - 12);
    // space-charge region
    const xa = Math.max(-r.wA_nm, -s), xb = Math.min(r.wB_nm, s);
    ctx.fillStyle = 'rgba(242,184,75,.06)'; ctx.fillRect(X(xa), pad.t, X(xb) - X(xa), H);
    ctx.strokeStyle = 'rgba(242,184,75,.35)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(X(xa), pad.t); ctx.lineTo(X(xa), pad.t + H); ctx.moveTo(X(xb), pad.t); ctx.lineTo(X(xb), pad.t + H); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(232,236,241,.25)'; ctx.beginPath(); ctx.moveTo(X(0), pad.t); ctx.lineTo(X(0), pad.t + H); ctx.stroke();
    // bands (split at the interface so the offset shows as a step)
    const band = (arr, col) => {
      ctx.strokeStyle = col; ctx.lineWidth = 2.4;
      for (const side of [-1, 1]) {
        ctx.beginPath(); let pen = false;
        for (let i = 0; i < xs.length; i++) {
          const x = xs[i]; if (Math.abs(x) > s || (side < 0 ? i >= r.i0 : i < r.i0)) continue;
          pen ? ctx.lineTo(X(x), Y(arr[i])) : ctx.moveTo(X(x), Y(arr[i])); pen = true;
        }
        ctx.stroke();
      }
      ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(X(0), Y(arr[r.i0 - 1])); ctx.lineTo(X(0), Y(arr[r.i0])); ctx.stroke();
    };
    ctx.fillStyle = 'rgba(57,135,229,.07)';
    band(r.Ec, EC); band(r.Ev, EV);
    // Fermi / quasi-Fermi levels
    ctx.setLineDash([6, 5]); ctx.lineWidth = 1.4; ctx.strokeStyle = EFC; ctx.beginPath();
    ctx.moveTo(X(-s), Y(r.EFA)); ctx.lineTo(X(xa), Y(r.EFA)); ctx.moveTo(X(xb), Y(r.EFB)); ctx.lineTo(X(s), Y(r.EFB));
    if (Math.abs(r.EFA - r.EFB) < 1e-9) { ctx.moveTo(X(xa), Y(r.EFA)); ctx.lineTo(X(xb), Y(r.EFA)); ctx.stroke(); }
    else {
      ctx.stroke(); ctx.setLineDash([2, 4]);
      ctx.strokeStyle = '#86b6ef'; ctx.beginPath(); ctx.moveTo(X(xa), Y(r.EFn)); ctx.lineTo(X(xb), Y(r.EFn)); ctx.stroke();
      ctx.strokeStyle = '#ff9c73'; ctx.beginPath(); ctx.moveTo(X(xa), Y(r.EFp)); ctx.lineTo(X(xb), Y(r.EFp)); ctx.stroke();
      ctx.font = '11px "IBM Plex Mono", monospace'; ctx.textAlign = 'left';
      ctx.fillStyle = '#86b6ef'; ctx.fillText('EFn', X(xb) + 4, Y(r.EFn) - 4); ctx.fillStyle = '#ff9c73'; ctx.fillText('EFp', X(xb) + 4, Y(r.EFp) + 12);
    }
    ctx.setLineDash([]);
    // carriers
    for (const q of this.el || []) {
      const jx = q.x + Math.sin(this.t * 1.7 + q.ph) * s * 0.004, ec = lerpAt(xs, r.Ec, Math.max(Math.min(jx, s), -s));
      this.dot(ctx, X(jx), Y(ec + q.e) - 4, false);
    }
    for (const q of this.ho || []) {
      const jx = q.x + Math.sin(this.t * 1.5 + q.ph) * s * 0.004, ev = lerpAt(xs, r.Ev, Math.max(Math.min(jx, s), -s));
      this.dot(ctx, X(jx), Y(ev - q.e) + 4, true);
    }
    // labels and axes
    ctx.font = '11.5px "IBM Plex Mono", monospace'; ctx.textAlign = 'right';
    const iL = xs.findIndex(x => x >= -s);
    ctx.fillStyle = '#86b6ef'; ctx.fillText('Ec', pad.l - 6, Y(r.Ec[iL]) + 4);
    ctx.fillStyle = '#ff9c73'; ctx.fillText('Ev', pad.l - 6, Y(r.Ev[iL]) + 4);
    ctx.fillStyle = EFC; ctx.fillText('EF', pad.l - 6, Y(r.EFA) + (Math.abs(Y(r.EFA) - Y(r.Ec[iL])) < 12 ? 16 : 4));
    // offsets at the interface
    const dEc = r.dEc, dEv = r.dEv;
    ctx.textAlign = 'left'; ctx.font = '11px "IBM Plex Mono", monospace';
    if (Math.abs(dEc) > 0.02) { ctx.fillStyle = '#86b6ef'; ctx.fillText(`ΔEc ${Math.abs(dEc).toFixed(2)}`, X(0) + 6, Y(Math.max(r.Ec[r.i0], r.Ec[r.i0 - 1])) - 6); }
    if (Math.abs(dEv) > 0.02) { ctx.fillStyle = '#ff9c73'; ctx.fillText(`ΔEv ${Math.abs(dEv).toFixed(2)}`, X(0) + 6, Y(Math.min(r.Ev[r.i0], r.Ev[r.i0 - 1])) + 16); }
    ctx.fillStyle = MUTED; ctx.textAlign = 'center';
    ctx.fillText(`position (nm) · ${fmtLen(-s)} … ${fmtLen(s)}`, pad.l + W / 2, h - 10);
    ctx.save(); ctx.translate(14, pad.t + H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('electron energy (eV)', 0, 0); ctx.restore();
    this.drawDensity(s);
  }

  drawDensity(s) {
    const r = this.r, xs = r.x_nm, { ctx, w, h } = hi(this.cd); ctx.clearRect(0, 0, w, h);
    const pad = { l: 52, r: 16, t: 12, b: 26 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b, lo = 0, top = 21;
    const X = x => pad.l + (x + s) / (2 * s) * W, Y = lg => pad.t + (top - lg) / (top - lo) * H;
    ctx.font = '10.5px "IBM Plex Mono", monospace'; ctx.textAlign = 'right'; ctx.fillStyle = MUTED;
    for (let k = 0; k <= 20; k += 5) { ctx.strokeStyle = '#1d2530'; ctx.beginPath(); ctx.moveTo(pad.l, Y(k)); ctx.lineTo(pad.l + W, Y(k)); ctx.stroke(); ctx.fillText(`10${sup(k)}`, pad.l - 5, Y(k) + 4); }
    ctx.strokeStyle = 'rgba(232,236,241,.25)'; ctx.beginPath(); ctx.moveTo(X(0), pad.t); ctx.lineTo(X(0), pad.t + H); ctx.stroke();
    const curve = (arr, col, dash = []) => {
      ctx.beginPath(); let pen = false;
      for (let i = 0; i < xs.length; i++) { if (Math.abs(xs[i]) > s) continue; if (arr[i] < 1) { pen = false; continue; } const lg = Math.log10(arr[i]); pen ? ctx.lineTo(X(xs[i]), Y(lg)) : ctx.moveTo(X(xs[i]), Y(lg)); pen = true; }
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
    };
    curve(r.n, E_COL); curve(r.p, H_COL);
    const dA = Math.abs(this.dopA), dB = Math.abs(this.dopB);
    ctx.strokeStyle = 'rgba(170,179,192,.5)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath();
    if (dA > 1) { ctx.moveTo(X(-s), Y(Math.log10(dA))); ctx.lineTo(X(0), Y(Math.log10(dA))); }
    if (dB > 1) { ctx.moveTo(X(0), Y(Math.log10(dB))); ctx.lineTo(X(s), Y(Math.log10(dB))); }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign = 'left'; let lx = pad.l + 6;
    for (const [txt, col] of [['n (electrons, cm⁻³)', E_COL], ['p (holes)', H_COL], ['dashed: doping', MUTED]]) { ctx.fillStyle = col; ctx.fillText(txt, lx, pad.t + 12); lx += ctx.measureText(txt).width + 16; }
  }

  dot(ctx, x, y, hole) {
    ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7);
    if (hole) { ctx.strokeStyle = H_COL; ctx.lineWidth = 1.7; ctx.stroke(); } else { ctx.fillStyle = E_COL; ctx.shadowColor = '#3987e5'; ctx.shadowBlur = 6; ctx.fill(); ctx.shadowBlur = 0; }
  }
}

const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = k => String(k).split('').map(c => SUPS[+c]).join('');
function sciShort(v) { const e = Math.floor(Math.log10(v)), m = v / 10 ** e; return `${m >= 1.05 ? m.toFixed(m < 9.95 ? 1 : 0) + '×' : ''}10${sup(e)}`; }
function fmtLen(nm) { const a = Math.abs(nm); return a >= 1000 ? `${(nm / 1000).toFixed(a >= 1e4 ? 0 : 1)} µm` : `${Math.round(nm)} nm`; }
export { sciShort };
