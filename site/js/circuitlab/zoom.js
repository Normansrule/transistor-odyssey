// Powers-of-ten zoom from a 300 mm wafer to a silicon–silicon bond.
// Ten procedural scenes, each covering one decade of scale. Scene i spans a
// field of view FOV_i = 0.45 m / 10^i; scene i+1 is drawn into the centre of
// scene i and cross-faded in through a radial mask as the zoom passes ~60 %.
// Dimensions in the captions are real (2 nm-class process, 300 mm wafer);
// the drawings are schematic.

export const LEVELS = [
  { name: 'Wafer', fov: 0.45, desc: 'A 300 mm silicon wafer carries about 600 dies of 100 mm². Each is built up through 70-plus patterned layers before the wafer is sawn apart.' },
  { name: 'Die', fov: 0.045, desc: 'One die, about 12 × 10 mm: CPU cores across the middle, cache above, graphics below, I/O around the edge. Tens of billions of transistors.' },
  { name: 'Core', fov: 4.5e-3, desc: 'A CPU core of a few mm²: fetch and decode, execution units, and private caches. The regular grids are SRAM arrays.' },
  { name: 'Block', fov: 4.5e-4, desc: 'Inside the execution units: register-file and cache macros, a sea of standard cells, and a grid of thick power straps above them.' },
  { name: 'Cells', fov: 4.5e-5, desc: 'Rows of standard cells, each one a gate or flip-flop, sharing a supply rail with the row above and below. A dozen-plus metal layers route the signals.' },
  { name: 'Gates', fov: 4.5e-6, desc: 'Every vertical line is a transistor gate, 48 nm apart (the contacted gate pitch of a 2 nm-class process). Coloured lines are the lowest metal wires.' },
  { name: 'NAND', fov: 4.5e-7, desc: 'One NAND2 cell: four transistors under two gates. p-type nanosheets on top, n-type below; contacts drop between the gates onto the source and drain.' },
  { name: 'Nanosheet', fov: 4.5e-8, desc: 'Cut along the channel: three silicon sheets about 5 nm thick, wrapped by the metal gate on every side. Gate length about 14 nm.' },
  { name: 'Atoms', fov: 4.5e-9, desc: 'Silicon atoms in the sheet (0.543 nm lattice), with the high-k HfO₂ gate dielectric above and below. Conduction electrons drift through the crystal.' },
  { name: 'Bond', fov: 4.5e-10, desc: 'Two silicon atoms 0.235 nm apart, sharing a pair of electrons: the covalent bond that makes silicon a crystal. Nine powers of ten below the wafer.' },
];
export const ZMAX = LEVELS.length - 1;

// ------------------------------------------------------------------ helpers
const hash = (a, b = 0, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
export const fmtLen = m => {
  const u = [[1, 'm'], [1e-3, 'mm'], [1e-6, 'µm'], [1e-9, 'nm'], [1e-12, 'pm']];
  for (const [s, n] of u) if (m >= s * 0.999) { const v = m / s; return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(0) : v.toFixed(1)) + ' ' + n; }
  return (m / 1e-12).toFixed(0) + ' pm';
};
function niceBar(mPerPx, target = 110) {
  const raw = mPerPx * target, e = Math.floor(Math.log10(raw)), f = raw / 10 ** e;
  const n = f >= 5 ? 5 : f >= 2 ? 2 : 1;
  const len = n * 10 ** e; return { len, px: len / mPerPx };
}

// tile cache for dense textures (standard-cell seas, rows)
const tiles = new Map();
function tile(key, size, paint) {
  if (tiles.has(key)) return tiles.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size;
  paint(c.getContext('2d'), size); tiles.set(key, c); return c;
}
/** Fill normalized rect [x0,x1]×[y0,y1] with a repeating tile of normalized period `per`. */
function tiled(ctx, V, img, per, x0, y0, x1, y1, alpha = 1) {
  const ix0 = Math.max(x0, V.x0), ix1 = Math.min(x1, V.x1), iy0 = Math.max(y0, V.y0), iy1 = Math.min(y1, V.y1);
  if (ix1 <= ix0 || iy1 <= iy0) return;
  ctx.save(); ctx.beginPath(); ctx.rect(V.X(ix0), V.Y(iy0), (ix1 - ix0) * V.k, (iy1 - iy0) * V.k); ctx.clip();
  ctx.globalAlpha *= alpha;
  const px = per * V.k;
  if (px < 10) { ctx.restore(); return; }
  const a0 = Math.floor((ix0 - x0) / per), a1 = Math.ceil((ix1 - x0) / per), b0 = Math.floor((iy0 - y0) / per), b1 = Math.ceil((iy1 - y0) / per);
  if ((a1 - a0) * (b1 - b0) > 4000) { ctx.restore(); return; }
  for (let a = a0; a < a1; a++) for (let b = b0; b < b1; b++) ctx.drawImage(img, V.X(x0 + a * per), V.Y(y0 + b * per), px + 0.6, px + 0.6);
  ctx.restore();
}
const rect = (ctx, V, x0, y0, x1, y1, fill, stroke) => {
  if (x1 < V.x0 || x0 > V.x1 || y1 < V.y0 || y0 > V.y1) return;
  const X = V.X(x0), Y = V.Y(y0), W = (x1 - x0) * V.k, H = (y1 - y0) * V.k;
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(X, Y, W, H); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.strokeRect(X + .5, Y + .5, W - 1, H - 1); }
};
function label(ctx, V, x, y, text, { col = '#e8ecf1', size = 12, align = 'left', min = 0, max = 1e9, alpha = 1 } = {}) {
  const sx = V.X(x), sy = V.Y(y);
  if (V.k < min || V.k > max || sx < -200 || sx > V.w + 200 || sy < -40 || sy > V.h + 40) return;
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.font = `600 ${size}px "IBM Plex Sans", sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(7,9,12,.85)'; ctx.strokeText(text, sx, sy);
  ctx.fillStyle = col; ctx.fillText(text, sx, sy); ctx.restore();
}

// ------------------------------------------------------------------ scenes
// Each scene draws in normalized units (1 = its field of view) around the origin.
const DIE_W = 12 / 450, DIE_H = 10 / 450, LANE = 0.12 / 450;

function dieColor(i, j, t) {
  // thin-film interference: hue shifts across the wafer and slowly with time
  const hue = (215 + 70 * Math.sin(i * 0.23 + j * 0.17 + t * 0.12) + 25 * hash(i, j)) % 360;
  return `hsl(${hue}, 28%, ${34 + 7 * hash(j, i) + 6 * Math.sin(i * 0.4 - j * 0.3)}%)`;
}

const seaTile = () => tile('sea', 512, (c, n) => {
  c.fillStyle = '#1a222d'; c.fillRect(0, 0, n, n);
  for (let r = 0; r < 64; r++) { // 64 rows per tile, cells of random width
    let x = 0; const y = r * n / 64;
    c.fillStyle = r % 2 ? '#2a3442' : '#26303c'; c.fillRect(0, y, n, n / 64 - 1);
    while (x < n) { const w = 3 + hash(r, x) * 14; c.fillStyle = `rgba(${90 + 80 * hash(x, r)},${120 + 60 * hash(r, x, 3)},${170},.18)`; c.fillRect(x, y + 1, w - 1, n / 64 - 3); x += w; }
  }
});

const SCENES = [
  // 0 · wafer
  (ctx, V) => {
    const R = 150 / 450;
    ctx.fillStyle = '#07090c'; ctx.fillRect(0, 0, V.w, V.h);
    const g = ctx.createRadialGradient(V.X(-0.08), V.Y(-0.1), 0, V.X(0), V.Y(0), R * V.k * 1.1);
    g.addColorStop(0, '#5a6b86'); g.addColorStop(0.6, '#2c3546'); g.addColorStop(1, '#161b24');
    ctx.save(); ctx.beginPath(); ctx.arc(V.X(0), V.Y(0), R * V.k, 0, 7);
    // notch
    ctx.fillStyle = g; ctx.fill(); ctx.clip();
    const nI = Math.ceil(R / DIE_W) + 1, nJ = Math.ceil(R / DIE_H) + 1;
    for (let i = -nI; i < nI; i++) for (let j = -nJ; j < nJ; j++) {
      const x0 = (i - 0.5) * DIE_W, y0 = (j - 0.5) * DIE_H, x1 = x0 + DIE_W, y1 = y0 + DIE_H;
      const far = Math.max(Math.hypot(x0, y0), Math.hypot(x1, y0), Math.hypot(x0, y1), Math.hypot(x1, y1));
      if (far > R - 3 / 450) continue;
      rect(ctx, V, x0 + LANE, y0 + LANE, x1 - LANE, y1 - LANE, dieColor(i, j, V.t));
      if (DIE_W * V.k > 14) {   // hint of the floorplan: the core band
        rect(ctx, V, x0 + DIE_W * 0.06, y0 + DIE_H * 0.36, x1 - DIE_W * 0.06, y0 + DIE_H * 0.64, 'rgba(255,255,255,.08)');
        rect(ctx, V, x0 + DIE_W * 0.1, y0 + DIE_H * 0.1, x1 - DIE_W * 0.1, y0 + DIE_H * 0.33, 'rgba(0,0,0,.18)');
      }
    }
    // specular sweep
    const s = ctx.createLinearGradient(V.X(-R), V.Y(-R), V.X(R), V.Y(R));
    const p = (Math.sin(V.t * 0.4) + 1) / 2;
    s.addColorStop(Math.max(0, p - 0.15), 'rgba(255,255,255,0)'); s.addColorStop(p, 'rgba(255,255,255,.14)'); s.addColorStop(Math.min(1, p + 0.15), 'rgba(255,255,255,0)');
    ctx.fillStyle = s; ctx.fillRect(V.X(-R), V.Y(-R), 2 * R * V.k, 2 * R * V.k);
    ctx.restore();
    ctx.beginPath(); ctx.arc(V.X(0), V.Y(R), 3 / 450 * V.k, Math.PI, 0); ctx.fillStyle = '#07090c'; ctx.fill();
    ctx.strokeStyle = 'rgba(200,210,230,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(V.X(0), V.Y(0), R * V.k, 0, 7); ctx.stroke();
    label(ctx, V, R * 0.72, -R * 0.86, '300 mm', { col: '#ffd27a', size: 14, min: 300 });
  },
  // 1 · die (12 × 10 mm) — floorplan, neighbours across scribe lanes
  (ctx, V) => {
    ctx.fillStyle = '#0d1016'; ctx.fillRect(0, 0, V.w, V.h);
    const W = 12 / 45, H = 10 / 45, L = 0.12 / 45;
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
      const ox = i * W, oy = j * H;
      if (ox + W / 2 < V.x0 || ox - W / 2 > V.x1 || oy + H / 2 < V.y0 || oy - H / 2 > V.y1) continue;
      drawDie(ctx, V, ox - W / 2 + L, oy - H / 2 + L, W - 2 * L, H - 2 * L, i, j);
    }
    label(ctx, V, 0, -H * 0.5 - 0.02, 'one die ≈ 12 × 10 mm', { col: '#ffd27a', size: 13, align: 'center', min: 500 });
  },
  // 2 · core (≈ 1.56 × 2.8 mm) with its neighbours
  (ctx, V) => {
    ctx.fillStyle = '#0c0f15'; ctx.fillRect(0, 0, V.w, V.h);
    const s = 10;  // scene-1 normalized units → this scene (FOV/10)
    const W = 12 / 45 * s, H = 10 / 45 * s;
    drawDie(ctx, V, -W / 2, -H / 2, W, H, 0, 0, true);
    label(ctx, V, 0.2, -0.29, 'core', { col: '#ffd27a', size: 14, min: 300 });
    label(ctx, V, -0.03, -0.42, 'L3 cache (SRAM)', { col: '#c8d0dc', size: 12, align: 'center', min: 300 });
  },
  // 3 · block: macros, standard-cell sea, power straps
  (ctx, V) => {
    ctx.fillStyle = '#10141b'; ctx.fillRect(0, 0, V.w, V.h);
    const sea = seaTile();
    const per = 0.04;  // 18 µm tile
    tiled(ctx, V, sea, per, -2, -2, 2, 2);
    // macros (register files, small SRAMs)
    const macros = [[-0.42, -0.36, -0.12, -0.12], [0.14, -0.4, 0.44, -0.22], [-0.46, 0.18, -0.24, 0.44], [0.22, 0.16, 0.48, 0.42]];
    for (const [a, b, c2, d] of macros) {
      rect(ctx, V, a, b, c2, d, '#1c2a3d', '#3c5f8f');
      const sram = tile('sram', 256, (c, n) => { c.fillStyle = '#20324a'; c.fillRect(0, 0, n, n); c.strokeStyle = 'rgba(120,170,240,.35)'; for (let i = 0; i <= 32; i++) { c.beginPath(); c.moveTo(i * n / 32, 0); c.lineTo(i * n / 32, n); c.stroke(); c.beginPath(); c.moveTo(0, i * n / 32); c.lineTo(n, i * n / 32); c.stroke(); } });
      tiled(ctx, V, sram, 0.02, a + 0.01, b + 0.01, c2 - 0.01, d - 0.01, 0.9);
    }
    // power straps (top metal)
    ctx.globalAlpha = 0.28;
    for (let i = -30; i <= 30; i++) { const x = i * 0.05; rect(ctx, V, x - 0.0025, -2, x + 0.0025, 2, '#c99a4a'); }
    for (let j = -30; j <= 30; j++) { const y = j * 0.08; rect(ctx, V, -2, y - 0.002, 2, y + 0.002, '#a07a3c'); }
    ctx.globalAlpha = 1;
    label(ctx, V, -0.27, -0.24, 'register file', { size: 12, align: 'center', min: 400 });
    label(ctx, V, 0.08, 0.06, 'standard-cell logic', { size: 12, col: '#ffd27a', min: 400 });
  },
  // 4 · rows of standard cells
  (ctx, V) => {
    ctx.fillStyle = '#121822'; ctx.fillRect(0, 0, V.w, V.h);
    const rowH = 0.135e-6 / 4.5e-5;     // 0.135 µm row in 45 µm FOV
    const rows = tile('rows', 512, (c, n) => {
      const R = 16, h = n / R;
      for (let r = 0; r < R; r++) {
        const y = r * h;
        c.fillStyle = '#1f2835'; c.fillRect(0, y, n, h);
        let x = 0;
        while (x < n) { const w = 6 + Math.floor(hash(r, x, 7) * 5) * 6; c.fillStyle = `hsl(${205 + 40 * hash(x, r)}, 30%, ${18 + 10 * hash(r, x)}%)`; c.fillRect(x + 1, y + 1.5, w - 2, h - 3); x += w; }
        c.fillStyle = r % 2 ? '#c99a4a' : '#6f88a8'; c.fillRect(0, y, n, 1.2);  // VDD / VSS rail
      }
    });
    tiled(ctx, V, rows, rowH * 16, -2, -2, 2, 2);
    // signal routing on M2–M4: a few longer wires
    ctx.lineWidth = Math.max(1, 0.012 * V.k * 0.05);
    for (let i = 0; i < 90; i++) {
      const y = (hash(i, 1) - 0.5) * 2.4, x0 = (hash(i, 2) - 0.5) * 2.4, len = 0.1 + hash(i, 3) * 0.5;
      if (y < V.y0 || y > V.y1) continue;
      ctx.strokeStyle = `rgba(${hash(i, 4) > 0.5 ? '90,190,180' : '160,130,230'},.55)`;
      ctx.beginPath(); ctx.moveTo(V.X(x0), V.Y(y)); ctx.lineTo(V.X(x0 + len), V.Y(y)); ctx.stroke();
      const x = (hash(i, 5) - 0.5) * 2.4;
      ctx.strokeStyle = 'rgba(242,184,75,.4)'; ctx.beginPath(); ctx.moveTo(V.X(x), V.Y(y)); ctx.lineTo(V.X(x), V.Y(y + (hash(i, 6) - 0.5) * 0.6)); ctx.stroke();
    }
    label(ctx, V, -0.3, -0.3, 'one row ≈ 0.14 µm tall', { col: '#ffd27a', size: 12, min: 400 });
  },
  // 5 · gates and lowest metal
  (ctx, V) => {
    ctx.fillStyle = '#141b26'; ctx.fillRect(0, 0, V.w, V.h);
    const rowH = 0.135 / 4.5, cpp = 0.048 / 4.5;
    const r0 = Math.floor(V.y0 / rowH) - 1, r1 = Math.ceil(V.y1 / rowH) + 1;
    const g0 = Math.floor(V.x0 / cpp) - 1, g1 = Math.ceil(V.x1 / cpp) + 1;
    for (let r = r0; r <= r1; r++) {
      const y = r * rowH - 0.7 * rowH;            // row 0's n-type region is centred on the origin
      // active (nanosheet) regions: p on top half, n on bottom half (mirrored on alternate rows)
      const flip = r & 1;
      rect(ctx, V, V.x0, y + rowH * (flip ? 0.58 : 0.14), V.x1, y + rowH * (flip ? 0.86 : 0.42), 'rgba(255,138,85,.14)');
      rect(ctx, V, V.x0, y + rowH * (flip ? 0.14 : 0.58), V.x1, y + rowH * (flip ? 0.42 : 0.86), 'rgba(90,162,255,.14)');
      // gates (with diffusion breaks)
      for (let g = g0; g <= g1; g++) {
        const x = g * cpp, brk = hash(g, r) < 0.12;
        rect(ctx, V, x - cpp * 0.16, y + rowH * 0.08, x + cpp * 0.16, y + rowH * 0.92, brk ? 'rgba(120,130,150,.35)' : 'rgba(176,122,232,.62)');
      }
      // M0 tracks
      for (let k = 1; k <= 4; k++) {
        const ty = y + rowH * (0.12 + 0.19 * k);
        let x = g0 * cpp;
        while (x < g1 * cpp) { const len = cpp * (1 + Math.floor(hash(r, k, Math.round(x / cpp)) * 4)); if (hash(Math.round(x / cpp), r, k) > 0.35) rect(ctx, V, x + cpp * 0.1, ty - rowH * 0.035, x + len - cpp * 0.1, ty + rowH * 0.035, 'rgba(90,200,190,.5)'); x += len; }
      }
      rect(ctx, V, V.x0, y - rowH * 0.05, V.x1, y + rowH * 0.05, r & 1 ? '#c99a4a' : '#6f88a8');
    }
    label(ctx, V, -0.25, -0.35, 'gate pitch 48 nm', { col: '#ffd27a', size: 12, min: 400 });
  },
  // 6 · one NAND2 cell (gates at x = 0 and 1 pitch; the origin sits on gate A over the n-type sheets)
  (ctx, V) => {
    ctx.fillStyle = '#151d29'; ctx.fillRect(0, 0, V.w, V.h);
    const cpp = 0.048 / 0.45, rowH = 0.135 / 0.45;
    for (let r = Math.floor(V.y0 / rowH) - 1; r <= Math.ceil(V.y1 / rowH) + 1; r++) {
      const y = r * rowH - 0.7 * rowH, flip = r & 1, here = r === 0;
      const pY = flip ? [0.58, 0.86] : [0.14, 0.42], nY = flip ? [0.14, 0.42] : [0.58, 0.86];
      rect(ctx, V, V.x0, y + rowH * pY[0], V.x1, y + rowH * pY[1], here ? 'rgba(255,138,85,.42)' : 'rgba(255,138,85,.15)');
      rect(ctx, V, V.x0, y + rowH * nY[0], V.x1, y + rowH * nY[1], here ? 'rgba(90,162,255,.42)' : 'rgba(90,162,255,.15)');
      for (let g = Math.floor(V.x0 / cpp) - 1; g <= Math.ceil(V.x1 / cpp) + 1; g++) {
        const x = g * cpp, brk = here ? (g === -1 || g === 2) : hash(g, r) < 0.15, cell = here && (g === 0 || g === 1);
        rect(ctx, V, x - cpp * 0.15, y + rowH * 0.06, x + cpp * 0.15, y + rowH * 0.94, brk ? 'rgba(120,130,150,.6)' : cell ? '#c391ff' : 'rgba(176,122,232,.5)');
      }
      rect(ctx, V, V.x0, y - rowH * 0.04, V.x1, y + rowH * 0.04, flip ? '#6f88a8' : '#c99a4a');   // VDD on top of row 0
      rect(ctx, V, V.x0, y + rowH * 0.96, V.x1, y + rowH * 1.04, flip ? '#c99a4a' : '#6f88a8');
      if (!here) continue;
      // contacts: pFETs in parallel (VDD, Y, VDD), nFETs in series (GND … Y)
      const ct = (u, Y2, col) => rect(ctx, V, (u - 0.13) * cpp, y + rowH * Y2[0], (u + 0.13) * cpp, y + rowH * Y2[1], col);
      ct(-0.5, [0.0, pY[1]], '#2fb6a6'); ct(0.5, pY, '#2fb6a6'); ct(1.5, [0.0, pY[1]], '#2fb6a6');
      ct(-0.5, [nY[0], 1.0], '#2fb6a6'); ct(1.5, nY, '#2fb6a6');
      // output wire Y on M0
      rect(ctx, V, 0.38 * cpp, y + rowH * 0.47, 1.62 * cpp, y + rowH * 0.53, '#5fd8c8');
      rect(ctx, V, 1.42 * cpp, y + rowH * 0.47, 1.58 * cpp, y + rowH * nY[0], '#5fd8c8');
      rect(ctx, V, 0.42 * cpp, y + rowH * pY[1], 0.58 * cpp, y + rowH * 0.5, '#5fd8c8');
    }
    const y0 = -0.7 * rowH;
    ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(255,210,122,.8)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(V.X(-cpp), V.Y(y0), 3 * cpp * V.k, rowH * V.k); ctx.setLineDash([]);
    const o = { size: 12, min: 380, max: 2600 };
    label(ctx, V, -1.15 * cpp, y0 + rowH * 0.28, 'p-type sheets (in parallel)', { ...o, col: '#ffb38a', align: 'right' });
    label(ctx, V, -1.15 * cpp, y0 + rowH * 0.72, 'n-type sheets (in series)', { ...o, col: '#86b6ef', align: 'right' });
    label(ctx, V, 0, y0 - rowH * 0.1, 'A', { ...o, col: '#d7b8ff', align: 'center', size: 14 });
    label(ctx, V, cpp, y0 - rowH * 0.1, 'B', { ...o, col: '#d7b8ff', align: 'center', size: 14 });
    label(ctx, V, 2.1 * cpp, y0 + rowH * 0.5, 'Y', { ...o, col: '#5fd8c8', size: 14 });
    label(ctx, V, 0.5 * cpp, y0 + rowH * 1.13, 'NAND2: 4 transistors in 3 gate pitches', { ...o, col: '#ffd27a', align: 'center' });
  },
  // 7 · nanosheet cross-section (along the channel)
  (ctx, V) => {
    ctx.fillStyle = '#0f141c'; ctx.fillRect(0, 0, V.w, V.h);
    const nm = 1 / 45, Lg = 14 * nm, sp = 6 * nm, tS = 5 * nm, gap = 10 * nm;
    const ys = [-gap + tS / 2, tS / 2, gap + tS / 2];   // sheet centres; the origin is the top surface of the middle sheet
    const top = -gap - 8 * nm, bot = gap + tS + 6 * nm;
    // substrate
    rect(ctx, V, -3, bot + 4 * nm, 3, 3, '#2a3240');
    // source/drain epitaxy
    const sd = '#3f6fb5';
    rect(ctx, V, -3, top + 2 * nm, -Lg / 2 - sp, bot + 4 * nm, sd); rect(ctx, V, Lg / 2 + sp, top + 2 * nm, 3, bot + 4 * nm, sd);
    // gate metal block with inner spacers
    rect(ctx, V, -Lg / 2 - sp, top - 14 * nm, Lg / 2 + sp, top, '#3a4352');            // outer spacer column
    rect(ctx, V, -Lg / 2, top - 14 * nm, Lg / 2, bot + 4 * nm, '#9a6fe0');              // gate metal
    for (const y of ys) {
      // high-k around each sheet
      rect(ctx, V, -Lg / 2, y - tS / 2 - 1.6 * nm, Lg / 2, y + tS / 2 + 1.6 * nm, '#e0b14d');
      rect(ctx, V, -3, y - tS / 2, 3, y + tS / 2, '#9fb3c8');                           // silicon sheet through S/D
      rect(ctx, V, -Lg / 2 - sp, y - tS / 2 - 2.5 * nm, -Lg / 2, y - tS / 2, '#3a4352'); // inner spacers
      rect(ctx, V, Lg / 2, y - tS / 2 - 2.5 * nm, Lg / 2 + sp, y - tS / 2, '#3a4352');
      rect(ctx, V, -Lg / 2 - sp, y + tS / 2, -Lg / 2, y + tS / 2 + 2.5 * nm, '#3a4352');
      rect(ctx, V, Lg / 2, y + tS / 2, Lg / 2 + sp, y + tS / 2 + 2.5 * nm, '#3a4352');
    }
    // contacts
    rect(ctx, V, -3, top - 14 * nm, -Lg / 2 - sp - 4 * nm, top + 2 * nm, '#2fb6a6'); rect(ctx, V, Lg / 2 + sp + 4 * nm, top - 14 * nm, 3, top + 2 * nm, '#2fb6a6');
    // electrons streaming through the sheets
    ctx.fillStyle = 'rgba(134,182,239,.9)';
    for (let i = 0; i < 90; i++) {
      const y = ys[i % 3] + (hash(i, 9) - 0.5) * tS * 0.7, x = ((hash(i, 8) * 2.4 + V.t * 0.12) % 2.4) - 1.2;
      if (x < V.x0 || x > V.x1) continue;
      ctx.beginPath(); ctx.arc(V.X(x), V.Y(y), Math.max(1.2, 0.35 * nm * V.k), 0, 7); ctx.fill();
    }
    const o = { size: 12, min: 380, max: 2200 };
    label(ctx, V, 0, top - 18 * nm, 'gate wraps every sheet · L ≈ 14 nm', { ...o, col: '#d7b8ff', align: 'center' });
    label(ctx, V, -0.62, top - 6 * nm, 'source', { ...o, col: '#86b6ef', align: 'center' });
    label(ctx, V, 0.62, top - 6 * nm, 'drain', { ...o, col: '#86b6ef', align: 'center' });
    label(ctx, V, 0.62, gap + 1.9 * tS, 'Si sheet, 5 nm', { ...o, col: '#c8d6e5', align: 'center' });
  },
  // 8 · atoms: the top of the silicon sheet ([110] projection) under the gate stack
  (ctx, V) => {
    ctx.fillStyle = '#0a0d12'; ctx.fillRect(0, 0, V.w, V.h);
    const nm = 1 / 4.5, a = 0.543 * nm, ax = a / Math.SQRT2, dz = a / 4;
    const yi = -0.45 * nm, yIL = yi - 0.5 * nm, yHK = yIL - 1.8 * nm;   // Si | SiO2 interlayer | HfO2 | metal
    rect(ctx, V, -3, -3, 3, yHK, '#3b2f55');
    for (let i = 0; i < 1400; i++) {                       // amorphous oxides
      const x = (hash(i, 1) - 0.5) * 3, hk = i % 3 !== 0, y = hk ? yHK + hash(i, 2) * (yIL - yHK) : yIL + hash(i, 2) * (yi - yIL);
      if (x < V.x0 - 0.1 || x > V.x1 + 0.1 || y < V.y0 - 0.1 || y > V.y1 + 0.1) continue;
      const big = hk && hash(i, 3) < 0.34;
      ctx.fillStyle = big ? '#d6a646' : hk ? '#c75b5b' : '#e07f7f';
      ctx.beginPath(); ctx.arc(V.X(x), V.Y(y), (big ? 0.11 : 0.066) * nm * V.k, 0, 7); ctx.fill();
    }
    const i0 = Math.floor(V.x0 / ax) - 1, i1 = Math.ceil(V.x1 / ax) + 1;
    const j0 = Math.ceil((yi + 0.15 * nm) / (a / 2)), j1 = Math.ceil(V.y1 / (a / 2)) + 1;
    const rAt = 0.085 * nm * V.k;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = i * ax + (j & 1 ? ax / 2 : 0), y = j * a / 2;
      const p = [V.X(x), V.Y(y - dz / 2)], q = [V.X(x), V.Y(y + dz / 2)];
      ctx.strokeStyle = 'rgba(150,180,220,.35)'; ctx.lineWidth = Math.max(1, rAt * 0.4);
      ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q);
      ctx.moveTo(...q); ctx.lineTo(V.X(x - ax / 2), V.Y(y + a / 2 - dz / 2)); ctx.moveTo(...q); ctx.lineTo(V.X(x + ax / 2), V.Y(y + a / 2 - dz / 2)); ctx.stroke();
      for (const s2 of [p, q]) {
        const g = ctx.createRadialGradient(s2[0] - rAt * 0.3, s2[1] - rAt * 0.3, 0, s2[0], s2[1], rAt);
        g.addColorStop(0, '#dfe8f4'); g.addColorStop(1, '#5d7896'); ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(s2[0], s2[1], rAt, 0, 7); ctx.fill();
      }
    }
    for (let i = 0; i < 30; i++) {                          // conduction electrons drifting toward the drain
      const x = ((hash(i, 4) * 3 + V.t * 0.05) % 3) - 1.5, y = yi + 0.4 * nm + hash(i, 5) * 3 * nm;
      if (x < V.x0 || x > V.x1) continue;
      const g = ctx.createRadialGradient(V.X(x), V.Y(y), 0, V.X(x), V.Y(y), 0.25 * nm * V.k);
      g.addColorStop(0, 'rgba(120,190,255,.9)'); g.addColorStop(1, 'rgba(120,190,255,0)'); ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(V.X(x), V.Y(y), 0.25 * nm * V.k, 0, 7); ctx.fill();
    }
    const o = { size: 12, min: 380, max: 2400 };
    label(ctx, V, -0.62, (yHK + yIL) / 2, 'HfO₂ (high-k)', { ...o, col: '#ffd27a' });
    label(ctx, V, -0.62, (yIL + yi) / 2, 'SiO₂ interlayer', { ...o, col: '#f0a0a0', size: 11 });
    label(ctx, V, -0.62, yHK - 0.4 * nm, 'metal gate', { ...o, col: '#d7b8ff' });
    label(ctx, V, -0.62, 1.2 * nm, 'silicon channel', { ...o, col: '#c8d6e5' });
  },
  // 9 · one Si–Si bond
  (ctx, V) => {
    ctx.fillStyle = '#07090c'; ctx.fillRect(0, 0, V.w, V.h);
    const nm = 1 / 0.45, d = 0.235 * nm / 2, ang = -Math.PI / 2;
    const A = [Math.cos(ang) * d, Math.sin(ang) * d], B = [-A[0], -A[1]];
    // electron density: two atoms plus a bond charge in between
    const blob = (x, y, r, c0, c1) => { const g = ctx.createRadialGradient(V.X(x), V.Y(y), 0, V.X(x), V.Y(y), r * V.k); g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(V.X(x), V.Y(y), r * V.k, 0, 7); ctx.fill(); };
    ctx.globalCompositeOperation = 'lighter';
    blob(A[0], A[1], 0.14 * nm, 'rgba(90,140,220,.55)', 'rgba(90,140,220,0)');
    blob(B[0], B[1], 0.14 * nm, 'rgba(90,140,220,.55)', 'rgba(90,140,220,0)');
    const pulse = 0.8 + 0.2 * Math.sin(V.t * 2);
    blob(0, 0, 0.06 * nm * pulse, 'rgba(242,184,75,.85)', 'rgba(242,184,75,0)');
    ctx.globalCompositeOperation = 'source-over';
    // other three bonds of each tetrahedral atom (projected)
    ctx.strokeStyle = 'rgba(150,180,220,.35)'; ctx.lineWidth = 2;
    for (const [P, s] of [[A, -1], [B, 1]]) for (const t of [0, 1, 2]) {
      const th = ang + (s > 0 ? Math.PI : 0) + (t - 1) * 1.1 + Math.PI;
      ctx.beginPath(); ctx.moveTo(V.X(P[0]), V.Y(P[1])); ctx.lineTo(V.X(P[0] + Math.cos(th) * 0.5), V.Y(P[1] + Math.sin(th) * 0.5)); ctx.stroke();
    }
    for (const P of [A, B]) blob(P[0], P[1], 0.022 * nm, '#ffffff', 'rgba(200,220,255,.15)');
    // two orbiting electrons in the bond
    for (const k of [0, 1]) {
      const th = V.t * 1.6 + k * Math.PI, x = Math.cos(th) * 0.025 * nm, y = Math.sin(th) * d * 0.5;
      ctx.fillStyle = '#ffe2a6'; ctx.beginPath(); ctx.arc(V.X(x), V.Y(y), Math.max(3, 0.006 * nm * V.k), 0, 7); ctx.fill();
    }
    const o = { size: 12, min: 380, max: 2400 };
    label(ctx, V, 0.08, 0, 'shared electron pair', { ...o, col: '#ffd27a' });
    label(ctx, V, 0.05, A[1], 'Si', { ...o, col: '#e8ecf1', size: 14 });
    label(ctx, V, 0.05, B[1], 'Si', { ...o, col: '#e8ecf1', size: 14 });
    label(ctx, V, -0.05, 0, '0.235 nm', { ...o, col: '#aab3c0', align: 'right' });
  },
];

// Die floorplan (used by scenes 1 and 2). (x, y, w, h) in normalized units; i, j pick colours.
function drawDie(ctx, V, x, y, w, h, i, j, detail = false) {
  rect(ctx, V, x, y, w, h, '#1b2230');
  const B = (u0, v0, u1, v1, fill, stroke) => rect(ctx, V, x + u0 * w, y + v0 * h, x + u1 * w, y + v1 * h, fill, stroke);
  // pad ring
  const pad = 0.025;
  B(0, 0, 1, pad, '#3b3424'); B(0, 1 - pad, 1, 1, '#3b3424'); B(0, 0, pad, 1, '#3b3424'); B(1 - pad, 0, 1, 1, '#3b3424');
  if (w * V.k > 120) for (let k = 0; k < 60; k++) { const u = (k + 0.5) / 60; B(u - 0.004, 0.004, u + 0.004, pad - 0.004, '#c9a45a'); B(u - 0.004, 1 - pad + 0.004, u + 0.004, 1 - 0.004, '#c9a45a'); }
  // L3 cache band (SRAM)
  B(0.05, 0.06, 0.95, 0.335, '#1d3048', '#2f4f78');
  const sram = tile('sramL', 256, (c, n) => { c.fillStyle = '#1f3552'; c.fillRect(0, 0, n, n); c.fillStyle = 'rgba(110,160,230,.28)'; for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) if ((a + b) % 2 === 0) c.fillRect(a * n / 16 + 1, b * n / 16 + 1, n / 16 - 2, n / 16 - 2); });
  tiled(ctx, V, sram, Math.max(w * 0.018, 1e-6), x + 0.055 * w, y + 0.065 * h, x + 0.945 * w, y + 0.33 * h, 0.9);
  // core band: 5 cores, the middle one centred on the die
  const cw = 0.13, gap = 0.035;
  for (let c = -2; c <= 2; c++) {
    const u0 = 0.5 + c * (cw + gap) - cw / 2;
    coreFloor(ctx, V, x + u0 * w, y + 0.36 * h, cw * w, 0.28 * h, detail && c === 0, i * 7 + j * 3 + c);
  }
  // GPU array
  B(0.05, 0.665, 0.95, 0.94, '#2a1f38', '#4d3a6b');
  if (w * V.k > 60) for (let a = 0; a < 24; a++) for (let b = 0; b < 6; b++) B(0.06 + a * 0.0371, 0.675 + b * 0.044, 0.06 + a * 0.0371 + 0.031, 0.675 + b * 0.044 + 0.036, `rgba(${150 + 40 * hash(a, b)},110,${200 + 40 * hash(b, a)},.28)`);
  // I/O PHY blocks at the sides of the core band
  B(0.03, 0.37, 0.06, 0.63, '#2c3a2c'); B(0.94, 0.37, 0.97, 0.63, '#2c3a2c');
}

function coreFloor(ctx, V, x, y, w, h, detail, seed) {
  rect(ctx, V, x, y, w, h, '#26334a', '#4c6a96');
  const B = (u0, v0, u1, v1, fill, stroke) => rect(ctx, V, x + u0 * w, y + v0 * h, x + u1 * w, y + v1 * h, fill, stroke);
  if (w * V.k < 30) return;
  // L2 (SRAM) at the top of the core
  B(0.06, 0.04, 0.94, 0.3, '#1d3048', '#365a8a');
  if (w * V.k > 80) { const sram = tile('sramC', 128, (c, n) => { c.fillStyle = '#20344f'; c.fillRect(0, 0, n, n); c.strokeStyle = 'rgba(120,170,240,.4)'; for (let a = 0; a <= 8; a++) { c.beginPath(); c.moveTo(a * n / 8, 0); c.lineTo(a * n / 8, n); c.stroke(); c.beginPath(); c.moveTo(0, a * n / 8); c.lineTo(n, a * n / 8); c.stroke(); } }); tiled(ctx, V, sram, w * 0.11, x + 0.07 * w, y + 0.05 * h, x + 0.93 * w, y + 0.29 * h, 0.85); }
  B(0.06, 0.32, 0.46, 0.42, '#2f3d54');                     // fetch / branch prediction
  B(0.54, 0.32, 0.94, 0.42, '#33405a');                     // decode
  B(0.06, 0.44, 0.94, 0.79, '#3a4a64');                     // execution (contains the core centre)
  B(0.06, 0.82, 0.46, 0.96, '#24364e', '#3c5f8f');          // L1 I
  B(0.54, 0.82, 0.94, 0.96, '#24364e', '#3c5f8f');          // L1 D
  if (w * V.k > 160) { const sea = seaTile(); { tiled(ctx, V, sea, w * 0.06, x + 0.07 * w, y + 0.45 * h, x + 0.93 * w, y + 0.78 * h, 0.55); tiled(ctx, V, sea, w * 0.06, x + 0.07 * w, y + 0.325 * h, x + 0.45 * w, y + 0.415 * h, 0.4); tiled(ctx, V, sea, w * 0.06, x + 0.55 * w, y + 0.325 * h, x + 0.93 * w, y + 0.415 * h, 0.4); } }
  if (w * V.k > 160) for (let a = 0; a < 12; a++) B(0.1 + a * 0.07, 0.47, 0.1 + a * 0.07 + 0.05, 0.76, `rgba(${200 + 40 * hash(a, seed)},${150 + 40 * hash(seed, a)},90,.2)`);
  if (detail) {
    const o = { size: 12, min: 600 };
    label(ctx, V, (x + 0.5 * w), y + 0.17 * h, 'L2 cache', { ...o, align: 'center' });
    label(ctx, V, (x + 0.26 * w), y + 0.37 * h, 'fetch', { ...o, align: 'center', size: 11 });
    label(ctx, V, (x + 0.74 * w), y + 0.37 * h, 'decode', { ...o, align: 'center', size: 11 });
    label(ctx, V, (x + 0.5 * w), y + 0.64 * h, 'execution units', { ...o, align: 'center', col: '#ffd27a' });
    label(ctx, V, (x + 0.26 * w), y + 0.89 * h, 'L1 I', { ...o, align: 'center', size: 11 });
    label(ctx, V, (x + 0.74 * w), y + 0.89 * h, 'L1 D', { ...o, align: 'center', size: 11 });
  }
}

// ------------------------------------------------------------------ renderer
export class Zoom {
  constructor(cv, { focusX = 0.5, focusY = 0.48 } = {}) {
    this.cv = cv; this.ctx = cv.getContext('2d'); this.off = document.createElement('canvas'); this.octx = this.off.getContext('2d');
    this.focusX = focusX; this.focusY = focusY; this.w = 0; this.h = 0;
  }
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = this.cv.clientWidth, h = this.cv.clientHeight;
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    for (const c of [this.cv, this.off]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Object.assign(this, { w, h, dpr });
  }
  view(level, mag, t) {
    const { w, h } = this, S = Math.min(w, h * 1.15), k = S * mag, cx = w * this.focusX, cy = h * this.focusY;
    return { w, h, t, k, cx, cy, X: x => cx + x * k, Y: y => cy + y * k, x0: -cx / k, x1: (w - cx) / k, y0: -cy / k, y1: (h - cy) / k, level };
  }
  /** Draw zoom position z in [0, ZMAX]; returns {fov (m), mPerPx}. */
  draw(z, t) {
    this.resize();
    const { ctx, octx, w, h } = this;
    z = Math.min(Math.max(z, 0), ZMAX);
    const i = Math.min(Math.floor(z), ZMAX), f = z - i, m = 10 ** f;
    ctx.save(); SCENES[i](ctx, this.view(i, m, t)); ctx.restore();
    const a = i < ZMAX ? smooth(0.55, 0.97, f) : 0;
    if (a > 0) {
      octx.save(); octx.globalCompositeOperation = 'source-over'; octx.clearRect(0, 0, w, h);
      SCENES[i + 1](octx, this.view(i + 1, m / 10, t));
      const V = this.view(i + 1, m / 10, t), R = 1.4 * V.k;
      const g = octx.createRadialGradient(V.cx, V.cy, 0, V.cx, V.cy, R);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.75, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      octx.globalCompositeOperation = 'destination-in'; octx.fillStyle = g; octx.fillRect(0, 0, w, h); octx.restore();
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(this.off, 0, 0); ctx.restore();
    }
    const S = Math.min(w, h * 1.15), fov = LEVELS[i].fov / m;
    return { fov: fov * w / S, mPerPx: fov / S, bar: niceBar(fov / S) };
  }
}
