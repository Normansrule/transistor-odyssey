// Hero: a transistor cross-section built step by step (oxidation → … → copper wiring).
export const STEPS = [
  { name: 'Bare wafer', short: 'Wafer', desc: 'A polished slice of single-crystal silicon, grown from a melt and doped lightly p-type. Everything that follows happens in the top few micrometres.' },
  { name: 'Oxidation', short: 'Oxidise', desc: 'Steam at 1000 °C turns the surface into silicon dioxide. The oxide grows downward, consuming 0.44 nm of silicon for every nanometre (Lab 01).' },
  { name: 'Lithography', short: 'Litho', desc: 'Photoresist is spun on and exposed through a mask. Developing it opens windows where the next step will act.' },
  { name: 'Implant', short: 'Implant', desc: 'Arsenic ions at tens of keV are fired through the openings. They stop at a depth set by their energy (Lab 02).' },
  { name: 'Anneal', short: 'Anneal', desc: 'A short anneal repairs the crystal damage and activates the dopants, which diffuse a little and form the n-type source and drain.' },
  { name: 'Gate stack', short: 'Gate', desc: 'A thin gate dielectric and a metal gate are deposited and patterned between source and drain: the transistor is complete.' },
  { name: 'Contacts', short: 'Contacts', desc: 'An insulating layer covers the device and tungsten plugs drop through it onto the source, drain and gate.' },
  { name: 'Copper wiring', short: 'Copper', desc: 'Layer after layer of copper lines and vias connect billions of transistors. At high current densities those wires slowly wear out (Lab 04).' },
];

const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);

export class Hero {
  constructor(cv) { this.cv = cv; this.ctx = cv.getContext('2d'); this.w = 0; this.h = 0; this.ions = []; }
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = this.cv.clientWidth, h = this.cv.clientHeight;
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr); this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Object.assign(this, { w, h, dpr });
  }
  /** s: continuous step position in [0, STEPS.length); t: seconds. focus: horizontal centre (0..1). */
  draw(s, t, focus = 0.68) {
    this.resize();
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    const W = Math.min(w * (focus === 0.5 ? 0.9 : 0.6), 760), cx = w * focus, x0 = cx - W / 2, x1 = cx + W / 2;
    const ySurf = h * 0.63, k = Math.min(W / 640, ySurf / (410 * 1.2));                                   // drawing units: 760 px wide
    const p = i => ease(s - i);                                           // progress of step i (0..1)
    const VS = 1.2;                                                      // vertical exaggeration of the cross-section
    ctx.save(); ctx.translate(0, ySurf); ctx.scale(1, VS); ctx.translate(0, -ySurf);
    // ---- silicon
    const g = ctx.createLinearGradient(0, ySurf, 0, h);
    g.addColorStop(0, '#3a4658'); g.addColorStop(1, '#1b2129');
    const consumed = 10 * k * p(1);
    ctx.fillStyle = g; ctx.fillRect(x0, ySurf + consumed * 0.0, W, h - ySurf);
    // lattice shimmer
    ctx.fillStyle = 'rgba(160,180,210,.10)';
    for (let yy = ySurf + 10; yy < h; yy += 14 * k) for (let xx = x0 + ((yy / 14) % 2) * 7 * k; xx < x1; xx += 14 * k) ctx.fillRect(xx, yy, 2, 2);
    const sdL = [x0 + W * 0.12, x0 + W * 0.38], sdR = [x0 + W * 0.62, x0 + W * 0.88], gate = [x0 + W * 0.40, x0 + W * 0.60];
    // ---- doped regions (implant → anneal)
    const imp = p(3), ann = p(4);
    if (imp > 0) {
      for (const [a, b] of [sdL, sdR]) {
        const depth = (26 + 22 * ann) * k, spread = 10 * k * ann;
        const gr = ctx.createLinearGradient(0, ySurf, 0, ySurf + depth + 16 * k);
        gr.addColorStop(0, `rgba(80,150,255,${0.25 * imp + 0.35 * ann})`); gr.addColorStop(0.6, `rgba(80,150,255,${0.45 * imp + 0.25 * ann})`); gr.addColorStop(1, 'rgba(80,150,255,0)');
        ctx.fillStyle = gr; ctx.beginPath();
        ctx.moveTo(a - spread, ySurf); ctx.lineTo(b + spread, ySurf);
        ctx.quadraticCurveTo(b + spread, ySurf + depth + 14 * k, (a + b) / 2, ySurf + depth + 14 * k);
        ctx.quadraticCurveTo(a - spread, ySurf + depth + 14 * k, a - spread, ySurf); ctx.fill();
        if (ann > 0.5) { ctx.fillStyle = `rgba(190,215,255,${(ann - 0.5) * 1.2})`; ctx.font = `600 ${Math.round(12 * Math.max(k, 0.8))}px "IBM Plex Mono", monospace`; ctx.textAlign = 'center'; ctx.fillText('n+', (a + b) / 2, ySurf + 24 * k); }
      }
    }
    // anneal glow
    const glow = Math.max(0, 1 - Math.abs(s - 4.5) * 2);
    if (glow > 0) { ctx.fillStyle = `rgba(255,140,60,${0.18 * glow})`; ctx.fillRect(x0, ySurf - 120 * k, W, h - ySurf + 120 * k); }
    // ---- field oxide (from oxidation step), removed over S/D/gate after litho
    const ox = p(1), tox = 22 * k * ox;
    if (ox > 0) {
      ctx.fillStyle = 'rgba(224,177,77,.55)';
      const open = p(2.6);       // etch after litho
      const segs = [[x0, sdL[0]], [sdR[1], x1]];
      if (open < 1) segs.push([sdL[0], sdR[1]]);
      for (const [a, b] of segs) {
        const keep = (a === sdL[0] && b === sdR[1]) ? 1 - open : 1;
        ctx.globalAlpha = keep; ctx.fillRect(a, ySurf - tox * 0.56, b - a, tox); ctx.globalAlpha = 1;
      }
    }
    // ---- resist + light during litho
    const lit = p(2), unlit = 1 - p(3.6);
    if (lit > 0 && unlit > 0) {
      ctx.globalAlpha = Math.min(lit, unlit);
      ctx.fillStyle = 'rgba(214,81,129,.55)';
      ctx.fillRect(x0, ySurf - tox * 0.56 - 26 * k, sdL[0] - x0, 26 * k); ctx.fillRect(sdR[1], ySurf - tox * 0.56 - 26 * k, x1 - sdR[1], 26 * k);
      ctx.fillRect(gate[0], ySurf - tox * 0.56 - 26 * k, gate[1] - gate[0], 26 * k);
      const beam = Math.max(0, 1 - Math.abs(s - 2.4) * 2.5);
      if (beam > 0) for (const [a, b] of [[sdL[0], gate[0]], [gate[1], sdR[1]]]) {
        const lg = ctx.createLinearGradient(0, ySurf - 200 * k, 0, ySurf);
        lg.addColorStop(0, `rgba(160,120,255,0)`); lg.addColorStop(1, `rgba(160,120,255,${0.45 * beam})`);
        ctx.fillStyle = lg; ctx.fillRect(a, ySurf - 200 * k, b - a, 200 * k - tox * 0.56);
      }
      ctx.globalAlpha = 1;
    }
    // ---- ions during implant
    const ionOn = s > 3.02 && s < 3.95;
    if (ionOn && this.ions.length < 140 && Math.random() < 0.9) for (let n = 0; n < 3; n++) {
      const left = Math.random() < 0.5, [a, b] = left ? sdL : sdR;
      this.ions.push({ x: a + Math.random() * (b - a), y: ySurf - 220 * k, stop: ySurf + (12 + 26 * Math.random() + 8 * (Math.random() - 0.5)) * k, v: 1400 * k });
    }
    ctx.fillStyle = '#bcd8ff';
    this.ions = this.ions.filter(io => s < 4.6);
    for (const io of this.ions) {
      if (io.y < io.stop) { io.y = Math.min(io.y + io.v / 60, io.stop); io.x += (io.y > ySurf ? (Math.random() - 0.5) * 3 * k : 0); }
      ctx.globalAlpha = io.y >= io.stop ? 0.55 : 1;
      ctx.beginPath(); ctx.arc(io.x, io.y, 2.2 * Math.max(k, 0.7), 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // ---- gate stack
    const gs = p(5);
    if (gs > 0) {
      const gh = 54 * k * gs;
      ctx.fillStyle = '#e0b14d'; ctx.fillRect(gate[0], ySurf - 4 * k, gate[1] - gate[0], 4 * k);
      ctx.fillStyle = '#9a6fe0'; ctx.fillRect(gate[0], ySurf - 4 * k - gh, gate[1] - gate[0], gh);
      ctx.fillStyle = 'rgba(160,170,190,.6)'; ctx.fillRect(gate[0] - 8 * k, ySurf - 4 * k - gh, 8 * k, gh + 4 * k); ctx.fillRect(gate[1], ySurf - 4 * k - gh, 8 * k, gh + 4 * k);
    }
    // ---- dielectric + contacts
    const ct = p(6), yIld = ySurf - 110 * k;
    if (ct > 0) {
      ctx.fillStyle = `rgba(120,140,170,${0.22 * ct})`; ctx.fillRect(x0, yIld, W, ySurf - yIld - tox * 0.56);
      ctx.fillStyle = '#8a94a3';
      for (const xc of [(sdL[0] + sdL[1]) / 2, (sdR[0] + sdR[1]) / 2]) ctx.fillRect(xc - 9 * k, ySurf - (ySurf - yIld) * ct, 18 * k, (ySurf - yIld) * ct);
      if (gs > 0) ctx.fillRect((gate[0] + gate[1]) / 2 - 8 * k, yIld + (ySurf - 58 * k - yIld) * (1 - ct), 16 * k, (ySurf - 58 * k - yIld) * ct);
    }
    // ---- copper layers
    const cu = s - 7;
    if (cu > 0) {
      const layers = 4;
      for (let L = 0; L < layers; L++) {
        const f = ease(cu * layers - L), y = yIld - 30 * k - L * 46 * k, th = (14 + L * 4) * k, pitch = (60 + L * 34) * k;
        if (f <= 0) continue;
        ctx.fillStyle = `rgba(120,140,170,${0.18 * f})`; ctx.fillRect(x0, y - 24 * k, W, 46 * k);
        ctx.fillStyle = `rgba(217,130,91,${0.9 * f})`;
        for (let xx = x0 + 10 * k + (L % 2) * pitch / 2; xx < x1 - pitch * 0.4; xx += pitch) ctx.fillRect(xx, y - th / 2, pitch * 0.55, th);
        ctx.fillStyle = `rgba(217,130,91,${0.8 * f})`;
        for (let xx = x0 + 30 * k + (L % 2) * pitch / 3; xx < x1 - 20; xx += pitch * 1.7) ctx.fillRect(xx, y + th / 2, 8 * k, 24 * k);
        // electrons in the top wire
        if (L === layers - 1 && f >= 1) { ctx.fillStyle = 'rgba(188,216,255,.9)'; for (let n = 0; n < 12; n++) { const xx = x0 + ((n / 12 + t * 0.15) % 1) * W; ctx.beginPath(); ctx.arc(xx, y, 1.8, 0, 7); ctx.fill(); } }
      }
    }
    ctx.restore();
    // labels
    ctx.font = `600 ${Math.round(12 * Math.max(k, 0.85))}px "IBM Plex Sans", sans-serif`; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(200,214,229,.8)';
    ctx.fillText('silicon', x0 + 8, h - 18);
    if (ox > 0.5) { ctx.fillStyle = '#ffd27a'; ctx.fillText('SiO₂', x0 + 8, ySurf - (tox * 0.56 + 6) * VS); }
  }
}
