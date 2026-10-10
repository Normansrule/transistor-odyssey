// Analog & RF Lab hero: the spectrum from audio to terahertz as a chirp, the bands that use it,
// and the fastest transistors (record fmax) that can still amplify there.
import { RF } from './data.js';

export const F0 = 10, F1 = 2e12;                              // axis: 10 Hz … 2 THz
const L0 = Math.log10(F0), L1 = Math.log10(F1);
export const uToF = u => 10 ** (L0 + (L1 - L0) * u);
export const fToU = f => (Math.log10(f) - L0) / (L1 - L0);

export function fmtHz(f) {
  const u = [[1e12, 'THz'], [1e9, 'GHz'], [1e6, 'MHz'], [1e3, 'kHz'], [1, 'Hz']].find(([v]) => f >= v * 0.9995) || [1, 'Hz'];
  const v = f / u[0];
  const t = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  return (t.includes('.') ? t.replace(/\.?0+$/, '') : t) + ' ' + u[1];
}

// Contiguous regions for the read-out; `bands` are the allocations drawn on the axis.
export const REGIONS = [
  { to: 2e4, name: 'Audio', col: '#9a80dc', bands: [[20, 2e4]], desc: 'Speech and music, 20 Hz to 20 kHz. Transistors reached consumers here: the first transistorized consumer product in the US was a Sonotone hearing aid, in 1952.' },
  { to: 5.3e5, name: 'Long wave', col: '#7d8db0', bands: [], desc: 'Low frequencies travel far along the ground. Radio clocks set themselves from time stations at 60–77.5 kHz.' },
  { to: 1.7e6, name: 'AM radio', col: '#f2b84b', bands: [[5.3e5, 1.7e6]], desc: 'Medium-wave AM broadcasting, 530–1,700 kHz. The Regency TR-1, the first transistor radio sold in the US (1954), tuned this band with four germanium transistors.' },
  { to: 8.8e7, name: 'Shortwave', col: '#e0a35a', bands: [[3e6, 3e7]], desc: 'High frequencies, 3–30 MHz, bounce off the ionosphere and carry broadcasts and amateur radio around the world.' },
  { to: 1.08e8, name: 'FM radio', col: '#ff8a55', bands: [[8.8e7, 1.08e8]], desc: 'FM broadcasting, 88–108 MHz. Frequency modulation trades bandwidth for noise immunity: stations are 200 kHz apart.' },
  { to: 1.5e9, name: 'TV and mobile', short: 'TV/mobile', col: '#d95926', bands: [[6e8, 9.6e8]], desc: 'UHF television and the low cellular bands, about 600 MHz to 1 GHz. Long wavelengths pass through walls and cover wide areas.' },
  { to: 2.4e9, name: 'GPS', col: '#3cc0b4', bands: [[1.56e9, 1.59e9]], desc: 'GPS L1 at 1575.42 MHz. The satellite signal arrives about 20 dB below the thermal noise floor: a low-noise amplifier and correlation dig it out.' },
  { to: 7.2e9, name: 'Wi-Fi', col: '#5598e7', bands: [[2.4e9, 2.4835e9], [5.15e9, 5.85e9], [5.925e9, 7.125e9]], desc: 'Wi-Fi at 2.4, 5 and 6 GHz. The transceiver is usually CMOS, on the same kind of silicon as the logic; the power amplifier is often gallium arsenide or silicon–germanium.' },
  { to: 2.4e10, name: 'Satellite', col: '#3987e5', bands: [[1.2e10, 1.8e10]], desc: 'Satellite television and internet downlinks in the Ku band, 12–18 GHz. The dish’s receiver starts with a high-electron-mobility transistor (HEMT) amplifier.' },
  { to: 6e10, name: '5G millimetre wave', short: '5G mmWave', col: '#d55181', bands: [[2.425e10, 5.26e10]], desc: '5G frequency range 2, 24.25–52.6 GHz. Wavelengths of about a centimetre let phones and base stations steer beams with arrays of tiny antennas.' },
  { to: 1.1e11, name: 'Car radar', col: '#ff6b8a', bands: [[7.6e10, 8.1e10]], desc: 'Automotive radar at 76–81 GHz measures distance and speed. Single-chip radar sensors moved from silicon–germanium to CMOS in the late 2010s.' },
  { to: 3e11, name: 'D band', col: '#c38bff', bands: [[1.1e11, 1.7e11]], desc: 'D band, 110–170 GHz, is explored for 6G and wireless backhaul. Only the fastest CMOS, silicon–germanium and III–V transistors still have useful gain here.' },
  { to: 3e12, name: 'Terahertz', col: '#e8ecf1', bands: [[3e11, 2e12]], desc: 'Above 300 GHz: imaging, spectroscopy and radio astronomy. An indium phosphide HEMT holds the highest fmax on this chart, 1.5 THz: above fmax a transistor cannot amplify power at all.' },
];
export const regionAt = f => REGIONS.find(r => f < r.to) || REGIONS[REGIONS.length - 1];

const FAM = { CMOS: '#5598e7', SiGe: '#3cc0b4', GaN: '#9a80dc', InP: '#f2b84b' };
const MARKS = RF.filter(r => !r.cryo && r.fmax).map(r => ({ ...r, f: r.fmax * 1e9 })).sort((a, b) => a.f - b.f);
const clampX = (v, a, b) => Math.min(Math.max(v, a), b);
const short = r => r.device.replace(/ \(.*\)/, '').replace('Si CMOS', 'CMOS');

export class Hero {
  constructor(cv) { this.cv = cv; this.ctx = cv.getContext('2d'); this.w = 0; this.h = 0; }
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = this.cv.clientWidth, h = this.cv.clientHeight;
    if (w !== this.w || h !== this.h || dpr !== this.dpr) { this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr); this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); Object.assign(this, { w, h, dpr }); }
  }
  /** u: cursor position 0..1 on the log axis; t: seconds; yAxis: axis height as a fraction of h. */
  draw(u, t, yAxis = 0.44) {
    this.resize(); const { ctx, w, h } = this; ctx.clearRect(0, 0, w, h);
    const narrow = w < 700, padL = narrow ? 14 : 28, padR = narrow ? 14 : 28, W = w - padL - padR;
    const X = f => padL + fToU(f) * W, xc = padL + u * W, fc = uToF(u), reg = regionAt(fc);
    const ay = h * yAxis, wy = ay - h * (narrow ? 0.25 : 0.21), amp = h * (narrow ? 0.11 : 0.09);
    // --- chirp: local period falls geometrically from 0.6 w to 2 px across the axis
    const P0 = W * 0.6, P1 = 2, r = Math.log(P1 / P0) / W, minP = 5;
    const xFill = Math.log(minP / P0) / r;                         // where the period gets too short to draw
    const phase = x => (Math.exp(-r * x) - 1) / (-r * P0);         // ∫ dx / P(x)
    const glow = x => 0.28 + 0.72 * Math.exp(-(((x - xc) / (W * 0.07)) ** 2));
    ctx.lineWidth = 2; ctx.lineJoin = 'round';
    let prev = null;
    for (let x = 0; x <= Math.min(xFill, W); x += 1.5) {
      const y = wy + amp * Math.sin(2 * Math.PI * (phase(x) - t * 0.5));
      const reg2 = regionAt(10 ** (L0 + (L1 - L0) * x / W));
      if (prev) { ctx.strokeStyle = reg2.col; ctx.globalAlpha = glow(padL + x); ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(padL + x, y); ctx.stroke(); }
      prev = [padL + x, y];
    }
    // beyond the drawable limit: a shimmering envelope
    for (let x = Math.max(xFill, 0); x <= W; x += 2) {
      const reg2 = regionAt(10 ** (L0 + (L1 - L0) * x / W)), a = amp * (0.82 + 0.18 * Math.sin(x * 0.9 + t * 9));
      ctx.globalAlpha = glow(padL + x) * 0.55; ctx.fillStyle = reg2.col; ctx.fillRect(padL + x, wy - a, 1.6, 2 * a);
    }
    ctx.globalAlpha = 1;
    // --- cursor
    const g = ctx.createLinearGradient(0, wy - amp * 1.6, 0, ay);
    g.addColorStop(0, 'rgba(242,184,75,0)'); g.addColorStop(0.5, 'rgba(242,184,75,.55)'); g.addColorStop(1, 'rgba(242,184,75,.9)');
    ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xc, wy - amp * 1.6); ctx.lineTo(xc, ay); ctx.stroke();
    // --- bands on the axis
    const mono = s => `${s}px "IBM Plex Mono", monospace`;
    ctx.textBaseline = 'alphabetic';
    const rows = [[], [], [], []], tight = w < 1100;
    ctx.font = '600 ' + mono(11);
    REGIONS.forEach(R => {
      const on = R === reg;
      for (const [a, b] of R.bands) {
        const x0 = X(a), x1 = Math.max(X(b), x0 + 3);
        ctx.fillStyle = R.col; ctx.globalAlpha = on ? 0.95 : 0.42; ctx.fillRect(x0, ay - 9, x1 - x0, 7);
      }
      if (!R.bands.length || (narrow && !on)) return;
      const label = tight && R.short && !on ? R.short : R.name, a = R.bands[0][0], b = R.bands[R.bands.length - 1][1], xm = (X(a) + X(b)) / 2, tw = ctx.measureText(label).width;
      const lx = clampX(xm - tw / 2, padL, w - padR - tw);
      const row = narrow ? 0 : Math.max(0, rows.findIndex(r => r.every(([p, q]) => lx > q + 6 || lx + tw < p - 6)));
      rows[row].push([lx, lx + tw]);
      ctx.globalAlpha = on ? 1 : 0.62; ctx.fillStyle = on ? '#fff' : R.col; ctx.textAlign = 'left';
      ctx.fillText(label, lx, ay - 16 - row * 14);
    });
    ctx.globalAlpha = 1;
    // --- axis and decades
    ctx.strokeStyle = 'rgba(232,236,241,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(padL, ay); ctx.lineTo(padL + W, ay); ctx.stroke();
    ctx.font = mono(narrow ? 10 : 10.5); ctx.textAlign = 'center'; ctx.fillStyle = '#8a94a3';
    const names = { 1: '10 Hz', 3: '1 kHz', 6: '1 MHz', 9: '1 GHz', 12: '1 THz' };
    for (let e = 1; e <= 12; e++) {
      const x = X(10 ** e); ctx.fillRect(x, ay, 1, e % 3 === 0 ? 7 : 4);
      const lab = narrow ? (e % 3 === 0 ? names[e] : null) : names[e] || ({ 2: '100 Hz', 4: '10 kHz', 5: '100 kHz', 7: '10 MHz', 8: '100 MHz', 10: '10 GHz', 11: '100 GHz' })[e];
      if (lab) { ctx.fillStyle = e % 3 === 0 ? '#c8d0db' : '#6f7a89'; ctx.fillText(lab, x, ay + 20); }
    }
    // --- the fastest transistors: lollipops at record fmax, dimmed once the cursor passes them
    const sy = ay + 30, dy = narrow ? 15 : 17;
    ctx.font = mono(narrow ? 10 : 11); ctx.textAlign = 'right';
    MARKS.forEach((m, i) => {
      const x = X(m.f), y = sy + i * dy, live = fc <= m.f, col = FAM[m.family] || '#e8ecf1';
      ctx.globalAlpha = live ? 1 : 0.32;
      ctx.strokeStyle = col; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x, ay + 3); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, live ? 4 : 3, 0, 7); ctx.fill();
      ctx.fillText(`${short(m)} ${fmtHz(m.f)}`, x - 9, y + 4);
    });
    ctx.globalAlpha = 0.85; ctx.fillStyle = '#8a94a3'; ctx.textAlign = 'right'; ctx.font = mono(10);
    ctx.fillText('record fmax, room temperature', X(MARKS[MARKS.length - 1].f) - 9, sy + MARKS.length * dy + 4);
    ctx.globalAlpha = 1;
  }
}
