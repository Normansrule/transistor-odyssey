// Animated cross-section renderer: shapes, dynamic channel/depletion, gate glow, carriers on paths.
import { MAT } from './scenes.js';

const E_COL = '#5aa2ff', H_COL = '#ff8a55';

function pathLen(p) { const seg = []; let L = 0; for (let i = 1; i < p.length; i++) { const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); seg.push(d); L += d; } return { seg, L }; }
function pointAt(p, meta, s) {
  let d = Math.min(Math.max(s, 0), 1) * meta.L;
  for (let i = 0; i < meta.seg.length; i++) {
    if (d <= meta.seg[i] || i === meta.seg.length - 1) {
      const t = meta.seg[i] ? d / meta.seg[i] : 0, a = p[i], b = p[i + 1];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])];
    }
    d -= meta.seg[i];
  }
  return [...p[p.length - 1], 0];
}

export class XSec {
  constructor(canvas, rnd = Math.random) { this.cv = canvas; this.ctx = canvas.getContext('2d'); this.rnd = rnd; this.parts = []; this.hover = null; this.flashT = 0; }
  setScene(scene, dev) {
    this.scene = scene; this.dev = dev;
    this.flows = (scene.flows || []).map(fl => ({ ...fl, meta: pathLen(fl.p) }));
    this.parts = [];
    this.flows.forEach((fl, k) => { const n = Math.round(26 * (fl.w ?? 1)) + 4; for (let i = 0; i < n; i++) this.parts.push({ k, s: this.rnd() * 0.22, v: 0.8 + this.rnd() * 0.4, off: (this.rnd() - 0.5) * 1.2, back: false, a: 1 }); });
    this.inj = [];
  }
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = this.cv.clientWidth, h = this.cv.clientHeight;
    if (w !== this.w || h !== this.h || dpr !== this.dpr) { this.cv.width = w * dpr; this.cv.height = h * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); Object.assign(this, { w, h, dpr }); }
    const pad = 14, sc = Math.min((w - 2 * pad) / 100, (h - 2 * pad - 8) / 60);
    this.sc = sc; this.ox = (w - 100 * sc) / 2; this.oy = (h - 60 * sc) / 2 + 6;
  }
  X(x) { return this.ox + x * this.sc; } Y(y) { return this.oy + y * this.sc; }
  // state: {f, vd01, vg01, prog, t, dt, speed, labels, volts}
  draw(st) {
    this.resize(); const { ctx, w, h } = this; const sc = this.scene; if (!sc) return;
    ctx.clearRect(0, 0, w, h);
    const alphaOf = s => s.a ?? 1;
    // shapes
    for (const s of sc.shapes) {
      ctx.globalAlpha = alphaOf(s); ctx.fillStyle = MAT[s.m] || '#555';
      ctx.beginPath();
      if (s.r) { const [x, y, ww, hh] = s.r; ctx.roundRect ? ctx.roundRect(this.X(x), this.Y(y), ww * this.sc, hh * this.sc, 1.5) : ctx.rect(this.X(x), this.Y(y), ww * this.sc, hh * this.sc); }
      else if (s.p) { s.p.forEach(([x, y], i) => i ? ctx.lineTo(this.X(x), this.Y(y)) : ctx.moveTo(this.X(x), this.Y(y))); ctx.closePath(); }
      else if (s.c) ctx.arc(this.X(s.c[0]), this.Y(s.c[1]), s.c[2] * this.sc, 0, 7);
      ctx.fill();
      if (s.gate) { // glow proportional to gate drive
        ctx.globalAlpha = 0.55 * Math.abs(st.vg01); ctx.fillStyle = st.vg01 >= 0 ? '#fff2c4' : '#8ab8ff'; ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // depletion regions (grow as the device turns off)
    for (const d of sc.dep || []) {
      const [x, y, ww, hh] = d.r, k = 0.12 + 0.88 * (1 - st.f), H = hh * k;
      const yy = d.from === 'bottom' ? y + hh - H : y;
      ctx.fillStyle = 'rgba(10,13,17,.62)'; ctx.fillRect(this.X(x), this.Y(yy), ww * this.sc, H * this.sc);
      ctx.strokeStyle = 'rgba(232,236,241,.35)'; ctx.setLineDash([3, 3]); ctx.strokeRect(this.X(x) + .5, this.Y(yy) + .5, ww * this.sc - 1, H * this.sc - 1); ctx.setLineDash([]);
    }
    // conducting channel(s)
    for (const c of sc.chan || []) {
      const f = c.inv ? 1 - st.f : st.f, [x, y, ww, hh] = c.r, col = MAT[c.color || 'chan'];
      const H = c.fill ? hh : hh * (0.35 + 0.65 * f);
      ctx.globalAlpha = (c.a ?? 0.9) * (c.fill ? 0.55 * f : 0.08 + 0.92 * f);
      const g = ctx.createLinearGradient(0, this.Y(y), 0, this.Y(y + H));
      g.addColorStop(0, col); g.addColorStop(1, c.fill ? col : 'rgba(255,224,102,0.15)');
      ctx.fillStyle = g; ctx.fillRect(this.X(x), this.Y(y), ww * this.sc, H * this.sc);
      ctx.globalAlpha = 1;
    }
    // flash: stored electrons on the floating gate
    if (sc.store) {
      const [x, y, ww, hh] = sc.store.r, n = Math.round(st.prog * 18);
      for (let i = 0; i < n; i++) { const px = x + ((i * 0.618 + 0.1) % 1) * ww, py = y + ((i * 0.37 + 0.3) % 1) * hh; this.dot(px, py, 'e', 1); }
    }
    // carriers
    const drive = st.vd01, dt = st.dt * st.speed;
    for (const p of this.parts) {
      const fl = this.flows[p.k];
      let F = fl.inv ? 1 - st.f : st.f;
      if (fl.on === 'hole-inj') F = st.f * st.f;
      const flowing = drive > 0.01;
      const gateAt = 0.24;
      if (!p.back) {
        p.s += dt * p.v * (flowing ? (0.08 + 0.3 * Math.min(drive * 2, 1)) : 0.02) * (p.s < gateAt ? 1 : (0.35 + 0.65 * F));
        if (p.s > gateAt && p.s - dt * 0.4 < gateAt && !p.checked) { p.checked = true; if (!flowing || this.rnd() > F) { p.back = true; } }
        if (p.s >= 1) { p.s = this.rnd() * 0.1; p.checked = false; }
      } else {
        p.s -= dt * p.v * 0.18; if (p.s <= 0.02 + this.rnd() * 0.1) { p.back = false; p.checked = false; }
      }
      const [x, y, ang] = pointAt(fl.p, fl.meta, p.s);
      const nx = -Math.sin(ang), ny = Math.cos(ang);
      const vis = p.s < 0.26 ? 1 : Math.max(F, 0.08);
      this.dot(x + nx * p.off, y + ny * p.off, fl.c, vis);
    }
    // programming electrons (flash)
    if (this.inj.length) {
      this.inj = this.inj.filter(q => (q.t += dt * 0.8) < 1);
      for (const q of this.inj) if (q.t >= 0) this.dot(q.x, q.y0 + (q.y1 - q.y0) * q.t, "e", 1);
    }
    // terminals
    for (const t of sc.terms || []) this.term(t, st);
    // inset label
    if (sc.inset) { const i = sc.inset; ctx.strokeStyle = 'rgba(138,148,163,.5)'; ctx.setLineDash([3, 3]); ctx.strokeRect(this.X(i.x), this.Y(i.y), i.w * this.sc, i.h * this.sc); ctx.setLineDash([]); ctx.font = '11px "IBM Plex Mono", monospace'; const tw = ctx.measureText(i.label).width; const lx = Math.min(this.X(i.x), this.w - tw - 6); ctx.fillStyle = 'rgba(10,13,17,.75)'; ctx.fillRect(lx - 3, this.Y(i.y) - 14, tw + 6, 15); ctx.fillStyle = '#aab3c0'; ctx.textAlign = 'left'; ctx.fillText(i.label, lx, this.Y(i.y) - 3); }
    // hover label
    if (this.hover) { const s = this.hit(this.hover[0], this.hover[1]); if (s) this.tag((this.hover[0] - this.ox) / this.sc + 2, (this.hover[1] - this.oy) / this.sc - 2, s, '#e8ecf1', 'left', true); }
    // direct labels for big shapes
    if (st.labels) this.labels();
  }
  dot(x, y, c, a) {
    const { ctx } = this; ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(this.X(x), this.Y(y), Math.max(1.8, this.sc * 0.55), 0, 7);
    if (c === 'e') { ctx.fillStyle = E_COL; ctx.shadowColor = '#3987e5'; ctx.shadowBlur = 6; ctx.fill(); ctx.shadowBlur = 0; }
    else { ctx.strokeStyle = H_COL; ctx.lineWidth = 1.6; ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  tag(x, y, text, color, align = 'center', box = false) {
    const { ctx } = this; ctx.font = '11px "IBM Plex Mono", monospace'; ctx.textAlign = align;
    if (box) { const tw = ctx.measureText(text).width + 10; ctx.fillStyle = 'rgba(10,13,17,.9)'; ctx.fillRect(this.X(x) - 5, this.Y(y) - 12, tw, 17); }
    ctx.fillStyle = color; ctx.fillText(text, this.X(x), this.Y(y));
  }
  term(t, st) {
    const { ctx } = this, lab0 = st.termLabels[t.k] || t.k, lab = this.w < 560 ? lab0.split(/[ (]/)[0] : lab0, v = st.termVolts[t.k];
    const text = v === undefined ? lab : `${lab}  ${v}`;
    ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
    const tw = ctx.measureText(text).width + 14, X = Math.min(Math.max(this.X(t.x) - tw / 2, 4), this.w - tw - 4), Y = Math.min(Math.max(this.Y(t.y) - 10, 2), this.h - 22);
    ctx.fillStyle = 'rgba(10,13,17,.82)'; ctx.strokeStyle = t.k === 'g' ? '#f2b84b' : '#3a4350'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(X, Y, tw, 20, 10) : ctx.rect(X, Y, tw, 20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = t.k === 'g' ? '#ffd27a' : '#e8ecf1'; ctx.textAlign = 'left'; ctx.fillText(text, X + 7, Y + 14);
  }
  labels() {
    const { ctx } = this; ctx.font = '10.5px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'center';
    for (const s of this.scene.shapes) {
      if (!s.l || !s.r) continue;
      const [x, y, ww, hh] = s.r, tw = ctx.measureText(s.l).width;
      if (ww * this.sc < tw + 10 || hh * this.sc < 13) continue;
      ctx.fillStyle = 'rgba(10,13,17,.72)';
      const cx = this.X(x + ww / 2), cy = this.Y(y + hh / 2) + 4;
      ctx.fillStyle = 'rgba(232,236,241,.82)'; ctx.fillText(s.l, cx, cy);
    }
  }
  hit(px, py) {
    const x = (px - this.ox) / this.sc, y = (py - this.oy) / this.sc;
    let label = null;
    for (const c of this.scene.chan || []) { const [a, b, ww, hh] = c.r; if (c.l && x >= a && x <= a + ww && y >= b - 0.6 && y <= b + hh + 0.6) return c.l; }
    for (const s of this.scene.shapes) {
      if (s.r) { const [a, b, ww, hh] = s.r; if (x >= a && x <= a + ww && y >= b && y <= b + hh) label = s.l || label; }
    }
    return label;
  }
  program(n = 10) {
    const st = this.scene.store; if (!st) return;
    const [x, y, ww, hh] = st.r;
    for (let i = 0; i < n; i++) this.inj.push({ x: x + 2 + this.rnd() * (ww - 4), y0: 29, y1: y + 2 + this.rnd() * (hh - 3), t: -i * 0.08 });
  }
}
