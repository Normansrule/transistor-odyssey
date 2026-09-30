// Band-diagram renderers with animated carriers: along the current path (lateral) and through the gate (vertical).
const E_COL = '#5aa2ff', H_COL = '#ff8a55', EC = '#3987e5', EV = '#d95926', EF = '#f2b84b', MUTED = '#8a94a3', INK2 = '#aab3c0';
const KT_VIS = 0.05; // thermal energy used for the animation (≈2 kT, exaggerated for visibility)

function hi(cv) {
  const ctx = cv.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { ctx, w, h };
}
const expo = r => -KT_VIS * Math.log(Math.max(r(), 1e-6));
const interp = (xs, ys, x) => { const n = xs.length, t = Math.min(Math.max(x, 0), 1) * (n - 1), i = Math.min(Math.floor(t), n - 2), f = t - i; const a = ys[i], b = ys[i + 1]; return isNaN(a) || isNaN(b) ? NaN : a + (b - a) * f; };

export class LateralView {
  constructor(cv, rnd = Math.random) { this.cv = cv; this.rnd = rnd; this.parts = []; this.trails = []; }
  reset(dev) { this.dev = dev; this.parts = Array.from({ length: 46 }, () => this.spawn(true)); this.trails = []; }
  spawn(anywhere = false) {
    const fam = this.dev.model.lateral;
    const p = { x: 0.02 + this.rnd() * (fam === 'sbfet' ? 0.14 : 0.2), dir: this.rnd() < 0.7 ? 1 : -1, v: 0.18 + this.rnd() * 0.18, e: expo(this.rnd), relax: false, tunneled: false, H: null };
    return p;
  }
  draw(L, st) {
    const { ctx, w, h } = hi(this.cv); ctx.clearRect(0, 0, w, h);
    const pad = { l: 46, r: 14, t: 26, b: 26 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b;
    const hole = this.dev.carrier === 'h';
    let lo = Infinity, hiE = -Infinity;
    for (let i = 0; i < L.x.length; i++) { if (!isNaN(L.Ec[i])) { lo = Math.min(lo, L.Ev[i]); hiE = Math.max(hiE, L.Ec[i]); } }
    const efs = L.EF ? Array.from(L.EF) : [L.EFs, L.EFd]; efs.forEach(v => { lo = Math.min(lo, v); hiE = Math.max(hiE, v); });
    const span = hiE - lo; lo -= span * 0.08; hiE += span * 0.12;
    const X = x => pad.l + x * W, Y = E => pad.t + (hiE - E) / (hiE - lo) * H;
    this.map = { X, Y };
    // regions
    ctx.font = '11px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
    (L.regions || []).forEach(([a, b, name], i) => {
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.025)' : 'rgba(255,255,255,.05)'; ctx.fillRect(X(a), pad.t, (b - a) * W, H);
      ctx.fillStyle = MUTED; const nm = ctx.measureText(name).width > (b - a) * W - 6 ? name.split(/[ (]/)[0] : name; ctx.fillText(nm, X((a + b) / 2), pad.t - 9);
    });
    // metal Fermi seas (Schottky contacts)
    if (L.metal) {
      ctx.fillStyle = 'rgba(226,182,80,.28)';
      ctx.fillRect(X(0), Y(L.EFs), X(L.metal[0]) - X(0), Y(lo) - Y(L.EFs));
      ctx.fillRect(X(L.metal[1]), Y(L.EFd), X(1) - X(L.metal[1]), Y(lo) - Y(L.EFd));
    }
    // band fills + edges
    const line = (arr, col, wdt) => { ctx.beginPath(); let pen = false; L.x.forEach((x, i) => { const v = arr[i]; if (isNaN(v)) { pen = false; return; } pen ? ctx.lineTo(X(x), Y(v)) : ctx.moveTo(X(x), Y(v)); pen = true; }); ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.stroke(); };
    ctx.fillStyle = 'rgba(57,135,229,.08)'; ctx.beginPath(); ctx.moveTo(X(0), pad.t);
    L.x.forEach((x, i) => { const v = isNaN(L.Ec[i]) ? hiE : L.Ec[i]; ctx.lineTo(X(x), Y(v)); }); ctx.lineTo(X(1), pad.t); ctx.fill();
    ctx.fillStyle = 'rgba(217,89,38,.08)'; ctx.beginPath(); ctx.moveTo(X(0), pad.t + H);
    L.x.forEach((x, i) => { const v = isNaN(L.Ev[i]) ? lo : L.Ev[i]; ctx.lineTo(X(x), Y(v)); }); ctx.lineTo(X(1), pad.t + H); ctx.fill();
    line(L.Ec, EC, 2.2); line(L.Ev, EV, 2.2);
    // Fermi levels
    ctx.setLineDash([6, 5]); ctx.strokeStyle = EF; ctx.lineWidth = 1.4;
    if (L.EF) { ctx.beginPath(); L.x.forEach((x, i) => i ? ctx.lineTo(X(x), Y(L.EF[i])) : ctx.moveTo(X(x), Y(L.EF[i]))); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(X(0), Y(L.EFs)); ctx.lineTo(X(0.3), Y(L.EFs)); ctx.moveTo(X(0.7), Y(L.EFd)); ctx.lineTo(X(1), Y(L.EFd)); ctx.stroke(); }
    ctx.setLineDash([]);
    // TFET tunnelling window
    if (L.family === 'tfet' && L.window > 0) {
      const Evs = L.Ev[0], Ecch = Evs - L.window;
      ctx.fillStyle = 'rgba(242,184,75,.16)'; ctx.fillRect(X(0.26), Y(Evs), X(0.4) - X(0.26), Y(Ecch) - Y(Evs));
      ctx.fillStyle = EF; ctx.textAlign = 'left'; ctx.fillText('tunnelling window', X(0.41), Y((Evs + Ecch) / 2) + 4);
    }
    // labels
    ctx.textAlign = 'right'; ctx.font = '11.5px "IBM Plex Mono", monospace';
    const firstOk = arr => { for (let i = 0; i < arr.length; i++) if (!isNaN(arr[i])) return arr[i]; return 0; };
    ctx.fillStyle = '#86b6ef'; ctx.fillText('Ec', pad.l - 6, Y(firstOk(L.Ec)) + 4);
    ctx.fillStyle = '#ff9c73'; ctx.fillText('Ev', pad.l - 6, Y(firstOk(L.Ev)) + 4);
    { const yf = Y(L.EF ? L.EF[0] : L.EFs), yc = Y(firstOk(L.Ec)), yv = Y(firstOk(L.Ev)); let y = yf + 4; if (Math.abs(yf - yc) < 13) y = yc + 17; if (Math.abs(yf - yv) < 13) y = yv - 11; ctx.fillStyle = EF; ctx.fillText('EF', pad.l - 6, y); }
    // barrier annotation (fet / bjt)
    if (L.barrier !== undefined && L.family !== 'tfet') {
      let im = 0; const base = hole ? L.Ev : L.Ec;
      for (let i = 0; i < L.x.length * 0.6; i++) if (hole ? base[i] < base[im] : base[i] > base[im]) im = i;
      const top = base[im], bot = base[0], xx = X(L.x[im]);
      if (Math.abs(top - bot) > 0.03) {
        ctx.strokeStyle = 'rgba(232,236,241,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xx, Y(bot)); ctx.lineTo(xx, Y(top)); ctx.stroke();
        ctx.fillStyle = '#e8ecf1'; ctx.textAlign = 'left'; ctx.fillText(`barrier ${Math.abs(top - bot).toFixed(2)} eV`, xx + 6, Y((top + bot) / 2) + 4);
      }
    }
    ctx.fillStyle = MUTED; ctx.textAlign = 'center'; ctx.font = '11px "IBM Plex Mono", monospace';
    const xl = 'position along the current path →'; ctx.fillText(ctx.measureText(xl).width > W ? 'source → drain' : xl, pad.l + W / 2, h - 7);
    ctx.save(); ctx.translate(13, pad.t + H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('electron energy (eV)', 0, 0); ctx.restore();
    this.animate(L, st);
  }
  animate(L, st) {
    const { ctx } = hi(this.cv), { X, Y } = this.map, dt = st.dt * st.speed, fam = L.family, hole = this.dev.carrier === 'h';
    const Ec = x => interp(L.x, L.Ec, x), Ev = x => interp(L.x, L.Ev, x);
    const flowing = st.vd01 > 0.01;
    for (const p of this.parts) {
      if (fam === 'fet' || fam === 'bjt') {
        const band = hole ? Ev : Ec;
        if (p.H === null) p.H = hole ? band(p.x) - p.e : band(p.x) + p.e;
        const here = band(p.x); // barrier rose under this carrier: it rides the band edge and rolls downhill
        if (hole ? here < p.H - 0.01 : here > p.H + 0.01) { p.H = hole ? here - 0.01 : here + 0.01; const dl = band(p.x - 0.01) - band(p.x + 0.01); p.dir = (hole ? -dl : dl) > 0 ? 1 : -1; }
        const nx = p.x + p.dir * p.v * dt * (flowing || p.x < 0.25 ? 1 : 0.4);
        const blocked = hole ? band(nx) < p.H : band(nx) > p.H;
        if (fam === 'bjt' && nx > 0.38 && nx < 0.62 && !blocked) { // diffusion through the base
          p.x = nx; p.dir = this.rnd() < 0.62 ? 1 : -1;
          if (this.rnd() < 0.004) { Object.assign(p, this.spawn()); p.H = null; continue; } // recombination
        } else if (blocked) { p.dir = -1; }
        else p.x = nx;
        if (p.x > 0.6 && !blocked) { const target = hole ? band(p.x) - 0.02 : band(p.x) + 0.02; p.H += (target - p.H) * Math.min(dt * 3, 1); }
        if (p.x < 0.03 || p.x > 0.985 || (p.dir < 0 && p.x < 0.22 && this.rnd() < dt * 2)) { Object.assign(p, this.spawn()); p.H = null; continue; }
        this.dotAt(X(p.x), Y(p.H), hole);
      } else if (fam === 'tfet') {
        const Evs = L.Ev[0];
        if (p.H === null) p.H = Evs - p.e * 2.5;
        if (!p.tunneled) {
          p.x += p.dir * p.v * dt;
          if (p.x > 0.30) {
            const ecAfter = Ec(0.42);
            if (L.window > 0 && p.H >= ecAfter && flowing) { this.trails.push({ x0: X(0.30), x1: X(0.42), y: Y(p.H), t: 0.5 }); p.x = 0.42; p.tunneled = true; }
            else p.dir = -1;
          }
          if (p.x < 0.02) { p.dir = 1; p.x = 0.02; }
          this.dotAt(X(p.x), Y(p.H), false, 0.8);
        } else {
          p.x += p.v * dt; const target = Ec(p.x) + 0.02; p.H += (target - p.H) * Math.min(dt * 3, 1);
          if (p.x > 0.985) { Object.assign(p, this.spawn()); p.H = null; continue; }
          this.dotAt(X(p.x), Y(p.H), false);
        }
      } else if (fam === 'sbfet') {
        if (p.H === null) p.H = L.EFs - p.e * 3;
        p.x += p.dir * p.v * dt;
        if (!p.tunneled && p.x > L.metal[0] - 0.005) {
          let th = 0; for (let x = L.metal[0]; x < 0.5; x += 0.004) { if (Ec(x) > p.H) th += 0.004; else break; }
          const T = Math.exp(-th / 0.012);
          if (flowing && this.rnd() < T) { if (th > 0) this.trails.push({ x0: X(L.metal[0]), x1: X(L.metal[0] + th), y: Y(p.H), t: 0.5 }); p.x = L.metal[0] + th + 0.005; p.tunneled = true; }
          else { p.dir = -1; p.x = L.metal[0] - 0.01; }
        }
        if (p.tunneled) { const e = Ec(p.x); if (!isNaN(e) && e > p.H) p.H = e + 0.01; if (p.x > L.metal[1]) p.H += ((L.EFd - 0.05) - p.H) * Math.min(dt * 3, 1); }
        if (p.x < 0.01) { p.dir = 1; p.x = 0.01; }
        if (p.x > 0.985) { Object.assign(p, this.spawn()); p.H = null; continue; }
        this.dotAt(X(p.x), Y(p.H), false);
      }
    }
    // tunnelling trails
    ctx.setLineDash([3, 3]); ctx.lineWidth = 1.2;
    this.trails = this.trails.filter(t => (t.t -= dt) > 0);
    for (const t of this.trails) { ctx.strokeStyle = `rgba(242,184,75,${t.t * 1.6})`; ctx.beginPath(); ctx.moveTo(t.x0, t.y); ctx.lineTo(t.x1, t.y); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  dotAt(x, y, hole, a = 1) {
    const { ctx } = hi(this.cv); ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7);
    if (hole) { ctx.strokeStyle = H_COL; ctx.lineWidth = 1.7; ctx.stroke(); } else { ctx.fillStyle = E_COL; ctx.shadowColor = '#3987e5'; ctx.shadowBlur = 6; ctx.fill(); ctx.shadowBlur = 0; }
    ctx.globalAlpha = 1;
  }
}

export class VerticalView {
  constructor(cv, rnd = Math.random) { this.cv = cv; this.rnd = rnd; this.seed = Array.from({ length: 60 }, () => [rnd(), rnd()]); this.t = 0; }
  draw(V, st, dev) {
    const { ctx, w, h } = hi(this.cv); ctx.clearRect(0, 0, w, h); this.t += st.dt * st.speed;
    if (!V) { ctx.fillStyle = MUTED; ctx.font = '12px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('No gate stack: this device is controlled through junctions — see the diagram along the current path.', w / 2, h / 2); return; }
    const pad = { l: 46, r: 14, t: 38, b: 26 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b;
    const gateW = W * 0.13, oxW = V.kind === 'flash' ? W * 0.34 : V.kind === 'hemt' ? 0 : W * 0.1, x0 = pad.l + gateW + oxW, semW = pad.l + W - x0;
    const zmax = V.z[V.z.length - 1];
    const Xs = z => x0 + z / zmax * semW;
    let lo = Infinity, hiE = -Infinity; for (let i = 0; i < V.Ec.length; i++) { lo = Math.min(lo, V.Ev[i]); hiE = Math.max(hiE, V.Ec[i]); }
    lo = Math.min(lo, -0.3); hiE = Math.max(hiE, 0.4); const span = hiE - lo; lo -= span * 0.1; hiE += span * 0.12;
    const Y = E => pad.t + (hiE - E) / (hiE - lo) * H;
    ctx.font = '11px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
    let lastR = -1e9, row = 0;
    const head = (text, cx) => { const tw = ctx.measureText(text).width; row = cx - tw / 2 < lastR + 6 ? 1 - row : 0; ctx.fillText(text, cx, pad.t - 9 - row * 13); lastR = cx + tw / 2; };
    // gate + dielectric blocks
    ctx.fillStyle = 'rgba(226,182,80,.22)'; ctx.fillRect(pad.l, pad.t, gateW, H);
    const gateEF = V.gateEF ?? (st.vgDisp !== undefined ? -st.vgDisp : 0);
    ctx.fillStyle = MUTED; head(V.regions[0][0], pad.l + gateW / 2);
    if (V.kind === 'flash') {
      const seg = oxW / 3; const names = ['blocking ox', 'floating gate', 'tunnel ox'];
      [0, 1, 2].forEach(i => { ctx.fillStyle = i === 1 ? 'rgba(201,92,80,.25)' : 'rgba(143,207,212,.16)'; ctx.fillRect(pad.l + gateW + i * seg, pad.t, seg, H); ctx.fillStyle = MUTED; head(names[i], pad.l + gateW + (i + 0.5) * seg); });
      // floating-gate well and stored electrons
      const fgE = 0.9 - 0.9 * (st.prog || 0), xL = pad.l + gateW + seg, xR = xL + seg;
      ctx.strokeStyle = EC; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xL, pad.t); ctx.lineTo(xL, Y(fgE)); ctx.lineTo(xR, Y(fgE)); ctx.lineTo(xR, pad.t); ctx.stroke();
      const n = Math.round((st.prog || 0) * 14);
      for (let i = 0; i < n; i++) this.dotAt(xL + 6 + ((i * 0.618) % 1) * (seg - 12), Y(fgE) - 5 - ((i * 0.37) % 1) * 10, false);
      ctx.fillStyle = '#86b6ef'; ctx.textAlign = 'center'; ctx.fillText(`${n ? n + ' stored e⁻' : 'erased'}`, (xL + xR) / 2, Math.min(Math.max(Y(fgE) + 16, pad.t + 16), pad.t + H - 6));
    } else {
      if (oxW > 0) { ctx.fillStyle = 'rgba(181,143,214,.16)'; ctx.fillRect(pad.l + gateW, pad.t, oxW, H);
      ctx.fillStyle = MUTED; head(V.regions[1][0], pad.l + gateW + oxW / 2); }
      else { ctx.fillStyle = 'rgba(134,207,230,.07)'; ctx.fillRect(x0, pad.t, V.dNm / zmax * semW, H); ctx.fillStyle = MUTED; head(V.regions[1][0], x0 + V.dNm / zmax * semW / 2); }
    }
    ctx.fillStyle = MUTED; head(V.regions[V.regions.length - 1][0], V.kind === 'hemt' ? x0 + (V.dNm / zmax + 1) / 2 * semW : x0 + semW / 2);
    if (V.kind !== 'flash' && V.kind !== 'hemt') { ctx.strokeStyle = EF; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pad.l, Y(gateEF)); ctx.lineTo(pad.l + gateW, Y(gateEF)); ctx.stroke(); ctx.fillStyle = EF; ctx.textAlign = 'left'; ctx.fillText('EF,gate', pad.l + 3, Y(gateEF) - 5); }
    // oxide barrier (conduction band high above)
    if (V.kind === 'mos' || V.kind === 'dg' || V.kind === 'tft') { ctx.strokeStyle = '#b58fd6'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(pad.l + gateW, pad.t + 2); ctx.lineTo(pad.l + gateW, pad.t + H); ctx.moveTo(x0, pad.t + 2); ctx.lineTo(x0, pad.t + H); ctx.stroke(); }
    // bands
    const line = (arr, col) => { ctx.beginPath(); V.z.forEach((z, i) => i ? ctx.lineTo(Xs(z), Y(arr[i])) : ctx.moveTo(Xs(z), Y(arr[i]))); ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.stroke(); };
    line(V.Ec, EC); line(V.Ev, EV);
    ctx.setLineDash([6, 5]); ctx.strokeStyle = EF; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x0, Y(0)); ctx.lineTo(pad.l + W, Y(0)); ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign = 'right'; ctx.fillStyle = EF; ctx.fillText('EF', pad.l + W - 2, Y(0) - 5);
    ctx.fillStyle = '#86b6ef'; ctx.fillText('Ec', pad.l + W - 2, Y(V.Ec[V.Ec.length - 1]) - 5);
    ctx.fillStyle = '#ff9c73'; ctx.fillText('Ev', pad.l + W - 2, Y(V.Ev[V.Ev.length - 1]) + 14);
    // HEMT subbands and wavefunctions
    if (V.kind === 'hemt' && V.E) {
      V.E.slice(0, 3).forEach((E, k) => {
        if (E > hiE) return;
        const ps = V.psi[k]; let mx = 0; for (const v of ps) mx = Math.max(mx, v * v);
        ctx.strokeStyle = ['#7fd3d0', '#c98500', '#d55181'][k]; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
        const xa = Xs(V.dNm - 3), xb = Xs(Math.min(zmax, V.dNm + 18));
        ctx.beginPath(); ctx.moveTo(xa, Y(E)); ctx.lineTo(xb, Y(E)); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); V.z.forEach((z, i) => { const xx = Xs(z); if (xx < xa || xx > xb) return; const yy = Y(E) - ps[i] * ps[i] / mx * H * 0.12; ctx.lineTo(xx, yy); }); ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle; ctx.textAlign = 'left'; ctx.fillText(`E${k}`, xb + 4, Y(E) + 4);
      });
      ctx.fillStyle = '#e8ecf1'; ctx.textAlign = 'left'; ctx.fillText(`n_s = ${(V.ns / 1e13).toFixed(2)}×10¹³ cm⁻²`.replace('n_s', 'ns'), x0 + 6, pad.t + 14);
    }
    // carriers: electrons where Ec is close to (or below) EF, holes where Ev is above EF
    const nDots = Math.round(28 * (st.f ?? 0));
    for (let i = 0; i < 60; i++) {
      const [a, b] = this.seed[i];
      if (dev.carrier === 'h') {
        if (i >= nDots) continue;
        const j = Math.floor(a * 0.18 * V.z.length); const z = V.z[j];
        this.dotAt(Xs(z) + Math.sin(this.t * 3 + i) * 2, Y(V.Ev[j]) + 4 + b * 10, true);
      } else {
        if (i >= nDots) continue;
        let j;
        if (V.kind === 'hemt') { j = Math.round((V.dNm + 0.5 + a * 4) / zmax * (V.z.length - 1)); }
        else if (V.kind === 'dg') { j = Math.floor((V.single ? a * 0.35 : a) * (V.z.length - 1)); }
        else if (V.kind === 'jfet' || V.kind === 'mesfet') { j = Math.floor((V.wd / zmax + a * (1 - V.wd / zmax)) * (V.z.length - 1)); }
        else { j = Math.floor(a * 0.12 * V.z.length); }
        j = Math.min(Math.max(j, 0), V.z.length - 1);
        this.dotAt(Xs(V.z[j]) + Math.sin(this.t * 3 + i) * 2, Y(V.Ec[j]) - 4 - b * 8, false);
      }
    }
    ctx.fillStyle = MUTED; ctx.textAlign = 'center';
    ctx.fillText('depth through the gate stack →', pad.l + W / 2, h - 7);
    ctx.save(); ctx.translate(13, pad.t + H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('electron energy (eV)', 0, 0); ctx.restore();
  }
  dotAt(x, y, hole) {
    const { ctx } = hi(this.cv); ctx.beginPath(); ctx.arc(x, y, 3, 0, 7);
    if (hole) { ctx.strokeStyle = H_COL; ctx.lineWidth = 1.6; ctx.stroke(); } else { ctx.fillStyle = E_COL; ctx.fill(); }
  }
}
