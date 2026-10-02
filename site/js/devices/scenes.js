// Cross-section geometry for every device, in a 100 × 56 box (x right, y down).
// shapes: {m, r:[x,y,w,h]} | {m, p:[[x,y]…]} | {m, c:[cx,cy,r]}; optional l (label), a (alpha), gate:true
// chan:  dynamic conducting layers (brightness and thickness follow the on-fraction)
// dep:   dynamic depletion regions (grow as the device turns off)
// flows: carrier paths {c:'e'|'h', p:[[x,y]…], w:weight, on:'n'|'p'|'bjt'|'hole-inj'|'tunnel'}
// terms: terminal labels {k:'s'|'g'|'d'|'b', x, y}
export const MAT = {
  si: '#4b596d', sich: '#7b8ca5', ge: '#8f96a3', oxide: '#8fcfd4', sti: '#6fa9b3', poly: '#c95c50', metal: '#e2b650',
  highk: '#9a80dc', spacer: '#cfd6e0', n: '#3f7fe0', p: '#e07f3f', pwell: '#6b5a4a', nwell: '#46557a', al: '#b9c3cd', au: '#e8c45c',
  cu: '#d9825b', sige: '#b58fd6', mos2: '#e25fa6', alox: '#f4ea9c', gan: '#3aa6cf', algan: '#86cfe6', deg: '#ffe066', dhg: '#ff9ad5',
  diamond: '#dfe8f3', sapphire: '#6d7f99', gaas: '#3f7f7a', ngaas: '#5aa6a0', sic: '#b8964f', cnt: '#6fc7a0', box: '#8fcfd4',
  igzo: '#9fd67a', glass: '#56657a', fg: '#c95c50', ndrift: '#3b4766', nplus: '#3f7fe0', psub: '#5c4d42', chan: '#ffe066',
};

const S = (m, x, y, w, h, extra = {}) => ({ m, r: [x, y, w, h], ...extra });

function planar({ sd = 'n', srcM = null, gateM = 'metal', ox = 'highk', sub = 'psub', tunnelFET = false } = {}) {
  return {
    shapes: [
      S(sub, 0, 26, 100, 30, { l: tunnelFET ? 'intrinsic Si' : 'p-type Si body' }),
      S(srcM || sd, 6, 26, 26, 9, { l: tunnelFET ? 'p⁺ source' : 'n⁺ source' }),
      S(sd, 68, 26, 26, 9, { l: 'n⁺ drain' }),
      S(ox, 32, 23.4, 36, 2.6, { l: ox === 'highk' ? 'HfO₂ gate dielectric' : 'SiO₂' }),
      S(gateM, 32, 11, 36, 12.4, { gate: true, l: 'gate' }),
      S('spacer', 28.6, 11, 3.4, 15), S('spacer', 68, 11, 3.4, 15),
      S('cu', 13, 12, 10, 14), S('cu', 77, 12, 10, 14),
    ],
    chan: [{ r: [32, 26, 36, 1.8] }],
    flows: [{ c: 'e', p: [[18, 27.2], [26, 27.4], [32, 26.9], [68, 26.9], [74, 27.4], [82, 27.2]], w: 1, from: tunnelFET ? 'valence' : 'band' }],
    terms: [{ k: 's', x: 18, y: 7 }, { k: 'g', x: 50, y: 7 }, { k: 'd', x: 82, y: 7 }],
  };
}

export const SCENES = {
  point_contact: {
    shapes: [
      { m: 'sapphire', p: [[30, 4], [70, 4], [52, 25.2], [48, 25.2]], l: 'plastic wedge', a: 0.9 },
      { m: 'au', p: [[40, 12], [44, 12], [47.6, 25.6], [46.6, 25.6]], l: 'emitter point (gold)' },
      { m: 'au', p: [[56, 12], [60, 12], [53.4, 25.6], [52.4, 25.6]], l: 'collector point (gold)' },
      S('ge', 12, 26, 76, 24, { l: 'n-type germanium' }),
      S('al', 12, 50, 76, 5, { l: 'base contact' }),
    ],
    chan: [{ r: [36, 26, 28, 1.2] }],
    flows: [{ c: 'h', p: [[47, 26.6], [48.4, 28.2], [50, 28.8], [51.6, 28.2], [53, 26.6]], w: 1 }],
    terms: [{ k: 's', x: 38, y: 9 }, { k: 'd', x: 62, y: 9 }, { k: 'g', x: 50, y: 58 }],
  },
  bjt: {
    shapes: [
      S('n', 6, 22, 28, 14, { l: 'n⁺ emitter' }), S('p', 34, 22, 14, 14, { l: 'p base (thin)' }), S('nwell', 48, 22, 46, 14, { l: 'n collector' }),
      S('al', 10, 16, 16, 6), S('al', 37, 16, 8, 6), S('al', 76, 16, 14, 6),
    ],
    chan: [],
    flows: [{ c: 'e', p: [[12, 29], [34, 29], [41, 29.5], [48, 29], [88, 29]], w: 1, on: 'bjt' },
            { c: 'h', p: [[41, 22.4], [41, 26], [36, 29.5], [20, 30]], w: 0.18, on: 'bjt' }],
    terms: [{ k: 's', x: 18, y: 12 }, { k: 'g', x: 41, y: 12 }, { k: 'd', x: 83, y: 12 }],
  },
  hbt: {
    shapes: [
      S('n', 6, 22, 28, 14, { l: 'n⁺ Si emitter' }), S('sige', 34, 22, 12, 14, { l: 'p⁺ SiGe base' }), S('nwell', 46, 22, 48, 14, { l: 'n collector' }),
      S('al', 10, 16, 16, 6), S('al', 36, 16, 8, 6), S('al', 76, 16, 14, 6),
    ],
    chan: [],
    flows: [{ c: 'e', p: [[12, 29], [34, 29], [40, 29.5], [46, 29], [88, 29]], w: 1, on: 'bjt' },
            { c: 'h', p: [[40, 22.4], [40, 26], [36, 29.5], [28, 30]], w: 0.05, on: 'bjt' }],
    terms: [{ k: 's', x: 18, y: 12 }, { k: 'g', x: 40, y: 12 }, { k: 'd', x: 83, y: 12 }],
  },
  jfet: {
    shapes: [
      S('psub', 0, 36, 100, 20, { l: 'p substrate (bottom gate)' }), S('n', 0, 22, 100, 14, { l: 'n channel', a: 0.55 }),
      S('p', 36, 18, 28, 6, { gate: true, l: 'p⁺ top gate' }), S('al', 6, 16, 14, 6), S('al', 80, 16, 14, 6),
    ],
    chan: [{ r: [0, 22, 100, 14], fill: true }],
    dep: [{ r: [34, 24, 32, 10], from: 'top' }, { r: [34, 26, 32, 10], from: 'bottom' }],
    flows: [{ c: 'e', p: [[13, 23], [20, 29], [80, 29], [87, 23]], w: 1 }],
    terms: [{ k: 's', x: 13, y: 12 }, { k: 'g', x: 50, y: 12 }, { k: 'd', x: 87, y: 12 }],
  },
  mesfet: {
    shapes: [
      S('gaas', 0, 31, 100, 25, { l: 'semi-insulating GaAs', a: 0.8 }), S('ngaas', 0, 24, 100, 7, { l: 'n-GaAs channel' }),
      S('au', 8, 18, 14, 6, { l: 'ohmic contact' }), S('au', 78, 18, 14, 6), S('metal', 44, 16, 12, 8, { gate: true, l: 'Schottky gate' }),
    ],
    chan: [{ r: [0, 24, 100, 7], fill: true }],
    dep: [{ r: [42, 24, 16, 7], from: 'top' }],
    flows: [{ c: 'e', p: [[15, 24.5], [22, 29], [78, 29], [85, 24.5]], w: 1 }],
    terms: [{ k: 's', x: 15, y: 12 }, { k: 'g', x: 50, y: 11 }, { k: 'd', x: 85, y: 12 }],
  },
  planar_mosfet: planar({ gateM: 'metal', ox: 'highk' }),
  tfet: planar({ gateM: 'metal', ox: 'highk', srcM: 'p', tunnelFET: true }),
  fdsoi: {
    shapes: [
      S('psub', 0, 36, 100, 20, { l: 'silicon substrate (back gate)' }), S('box', 0, 31, 100, 5, { l: 'buried oxide (~25 nm)' }),
      S('sich', 28, 27, 44, 4, { l: 'ultra-thin Si film (~7 nm)' }), S('n', 6, 22, 24, 9, { l: 'raised n⁺ source' }), S('n', 70, 22, 24, 9, { l: 'raised n⁺ drain' }),
      S('highk', 32, 24.6, 36, 2.4), S('metal', 32, 12, 36, 12.6, { gate: true, l: 'gate' }), S('spacer', 28.6, 12, 3.4, 15), S('spacer', 68, 12, 3.4, 15),
    ],
    chan: [{ r: [30, 27, 40, 3.8], fill: true }],
    flows: [{ c: 'e', p: [[16, 27], [30, 28.6], [70, 28.6], [84, 27]], w: 1 }],
    terms: [{ k: 's', x: 16, y: 8 }, { k: 'g', x: 50, y: 8 }, { k: 'd', x: 84, y: 8 }],
  },
  finfet: {
    shapes: [
      S('psub', 0, 38, 100, 18, { l: 'substrate' }), S('sti', 0, 33, 100, 5, { l: 'trench oxide' }),
      S('sich', 14, 21, 72, 12, { l: 'silicon fin' }), S('n', 8, 19, 20, 14, { l: 'n⁺ source (epi)' }), S('n', 72, 19, 20, 14, { l: 'n⁺ drain (epi)' }),
      S('highk', 34, 16, 32, 18, { a: 0.45 }), S('metal', 36, 8, 28, 26, { gate: true, a: 0.78, l: 'gate wraps the fin' }),
      // inset: cut across the fin
      S('sti', 76, 46, 22, 8, { a: 0.9 }), S('metal', 80, 37, 14, 11, { gate: true }), S('sich', 85, 40, 4, 12),
    ],
    chan: [{ r: [28, 21.2, 44, 11.6], fill: true, a: 0.5 }, { r: [85, 40, 4, 8], fill: true }],
    flows: [{ c: 'e', p: [[18, 24], [28, 24.5], [72, 24.5], [82, 24]], w: 1 }, { c: 'e', p: [[18, 29], [28, 29.5], [72, 29.5], [82, 29]], w: 1 }],
    terms: [{ k: 's', x: 18, y: 6 }, { k: 'g', x: 50, y: 4 }, { k: 'd', x: 82, y: 6 }],
    inset: { x: 76, y: 35, w: 22, h: 20, label: 'cut across the fin' },
  },
  gaa: {
    shapes: [
      S('psub', 0, 40, 100, 16, { l: 'substrate' }), S('sti', 0, 36, 100, 4),
      S('n', 6, 12, 18, 24, { l: 'n⁺ source (epi)' }), S('n', 76, 12, 18, 24, { l: 'n⁺ drain (epi)' }),
      S('metal', 30, 8, 40, 28, { gate: true, a: 0.9, l: 'gate surrounds every sheet' }),
      S('highk', 24, 15.2, 52, 3.6, { a: 0.8 }), S('highk', 24, 22.2, 52, 3.6, { a: 0.8 }), S('highk', 24, 29.2, 52, 3.6, { a: 0.8 }),
      S('sich', 24, 16, 52, 2, { l: 'Si nanosheets (~5 nm)' }), S('sich', 24, 23, 52, 2), S('sich', 24, 30, 52, 2),
      S('spacer', 24, 8, 6, 28, { a: 0.35 }), S('spacer', 70, 8, 6, 28, { a: 0.35 }),
    ],
    chan: [{ r: [24, 16, 52, 2], fill: true }, { r: [24, 23, 52, 2], fill: true }, { r: [24, 30, 52, 2], fill: true }],
    flows: [17, 24, 31].map(y => ({ c: 'e', p: [[14, y], [24, y], [76, y], [86, y]], w: 1 })),
    terms: [{ k: 's', x: 15, y: 6 }, { k: 'g', x: 50, y: 4 }, { k: 'd', x: 85, y: 6 }],
  },
  cfet: {
    shapes: [
      S('psub', 0, 44, 100, 12), S('sti', 0, 41, 100, 3),
      S('n', 6, 27, 18, 14, { l: 'n⁺ S/D (bottom nFET)' }), S('n', 76, 27, 18, 14),
      S('p', 6, 9, 18, 14, { l: 'p⁺ S/D (top pFET)' }), S('p', 76, 9, 18, 14),
      S('oxide', 6, 23.5, 18, 3), S('oxide', 76, 23.5, 18, 3),
      S('metal', 30, 6, 40, 36, { gate: true, a: 0.9, l: 'one shared gate' }),
      ...[12, 17, 29, 34].map((y, i) => S('sich', 24, y, 52, 2, i === 0 ? { l: 'stacked Si sheets' } : {})),
    ],
    chan: [{ r: [24, 29, 52, 2], fill: true }, { r: [24, 34, 52, 2], fill: true }, { r: [24, 12, 52, 2], fill: true, inv: true }, { r: [24, 17, 52, 2], fill: true, inv: true }],
    flows: [{ c: 'e', p: [[14, 30], [24, 30], [76, 30], [86, 30]], w: 1 }, { c: 'e', p: [[14, 35], [24, 35], [76, 35], [86, 35]], w: 1 },
            { c: 'h', p: [[14, 13], [24, 13], [76, 13], [86, 13]], w: 1, inv: true }, { c: 'h', p: [[14, 18], [24, 18], [76, 18], [86, 18]], w: 1, inv: true }],
    terms: [{ k: 's', x: 15, y: 5 }, { k: 'g', x: 50, y: 3 }, { k: 'd', x: 85, y: 5 }],
  },
  gan_hemt: {
    shapes: [
      S('sic', 0, 42, 100, 14, { l: 'SiC substrate' }), S('gan', 0, 25, 100, 17, { l: 'GaN' }), S('algan', 0, 20, 100, 5, { l: 'AlGaN barrier (20 nm)' }),
      S('spacer', 22, 16, 56, 4, { a: 0.6, l: 'SiN passivation' }), S('au', 6, 12, 16, 10, { l: 'ohmic source' }), S('au', 78, 12, 16, 10, { l: 'ohmic drain' }),
      S('metal', 44, 12, 10, 8, { gate: true, l: 'Schottky gate' }),
    ],
    chan: [{ r: [0, 25, 100, 1.4], color: 'deg', l: '2D electron gas' }],
    dep: [{ r: [42, 20, 14, 6.5], from: 'top' }],
    flows: [{ c: 'e', p: [[14, 22], [20, 25.6], [80, 25.6], [86, 22]], w: 1 }],
    terms: [{ k: 's', x: 14, y: 8 }, { k: 'g', x: 49, y: 8 }, { k: 'd', x: 86, y: 8 }],
  },
  sic_mosfet: {
    shapes: [
      S('nplus', 0, 49, 100, 7, { l: 'n⁺ SiC substrate → drain' }), S('ndrift', 0, 24, 100, 25, { l: 'n⁻ drift layer (~10 µm)' }),
      S('pwell', 0, 16, 40, 12, { l: 'p-body' }), S('pwell', 60, 16, 40, 12),
      S('n', 10, 16, 22, 4, { l: 'n⁺ source' }), S('n', 68, 16, 22, 4),
      S('oxide', 26, 13.6, 48, 2.4), S('poly', 28, 6, 44, 7.6, { gate: true, l: 'gate' }), S('al', 4, 8, 20, 8), S('al', 76, 8, 20, 8),
    ],
    chan: [{ r: [32, 16, 8, 1.4] }, { r: [60, 16, 8, 1.4] }],
    flows: [{ c: 'e', p: [[18, 17], [32, 17], [40, 17.2], [46, 20], [49, 30], [49, 52]], w: 1 }, { c: 'e', p: [[82, 17], [68, 17], [60, 17.2], [54, 20], [51, 30], [51, 52]], w: 1 }],
    terms: [{ k: 's', x: 14, y: 4 }, { k: 'g', x: 50, y: 3 }, { k: 'd', x: 50, y: 60 }],
  },
  igbt: {
    shapes: [
      S('p', 0, 49, 100, 7, { l: 'p⁺ collector (backside)' }), S('ndrift', 0, 24, 100, 25, { l: 'n⁻ drift (conductivity-modulated)' }),
      S('pwell', 0, 16, 40, 12, { l: 'p-body' }), S('pwell', 60, 16, 40, 12),
      S('n', 10, 16, 22, 4, { l: 'n⁺ emitter' }), S('n', 68, 16, 22, 4),
      S('oxide', 26, 13.6, 48, 2.4), S('poly', 28, 6, 44, 7.6, { gate: true, l: 'gate' }), S('al', 4, 8, 20, 8), S('al', 76, 8, 20, 8),
    ],
    chan: [{ r: [32, 16, 8, 1.4] }, { r: [60, 16, 8, 1.4] }, { r: [0, 24, 100, 25], fill: true, a: 0.25, color: 'dhg' }],
    flows: [{ c: 'e', p: [[18, 17], [32, 17], [40, 17.2], [46, 20], [49, 30], [49, 50]], w: 1 }, { c: 'e', p: [[82, 17], [68, 17], [60, 17.2], [54, 20], [51, 30], [51, 50]], w: 1 },
            { c: 'h', p: [[30, 50], [34, 36], [38, 26], [22, 20]], w: 0.8, on: 'hole-inj' }, { c: 'h', p: [[70, 50], [66, 36], [62, 26], [78, 20]], w: 0.8, on: 'hole-inj' }],
    terms: [{ k: 's', x: 14, y: 4 }, { k: 'g', x: 50, y: 3 }, { k: 'd', x: 50, y: 60 }],
  },
  diamond_fet: {
    shapes: [
      S('diamond', 0, 27, 100, 29, { l: 'undoped diamond', a: 0.85 }), S('oxide', 26, 21, 48, 6, { l: 'Al₂O₃ (acceptor layer)' }),
      S('metal', 38, 12, 24, 9, { gate: true, l: 'gate' }), S('au', 8, 19, 18, 8, { l: 'Au source' }), S('au', 74, 19, 18, 8, { l: 'Au drain' }),
    ],
    chan: [{ r: [0, 27, 100, 1.3], color: 'dhg', l: '2D hole gas (H-terminated surface)' }],
    flows: [{ c: 'h', p: [[17, 25], [24, 27.7], [76, 27.7], [83, 25]], w: 1 }],
    terms: [{ k: 's', x: 17, y: 14 }, { k: 'g', x: 50, y: 8 }, { k: 'd', x: 83, y: 14 }],
  },
  mos2_fet: {
    shapes: [
      S('sapphire', 0, 34, 100, 22, { l: 'sapphire / SiO₂ substrate' }), S('mos2', 10, 32.2, 80, 1.8, { l: 'MoS₂ monolayer (0.65 nm)' }),
      S('alox', 26, 31.4, 48, 0.8, { l: '0.42 nm AlOx' }), S('highk', 26, 27, 48, 4.4, { l: 'HfO₂' }),
      S('metal', 36, 16, 28, 11, { gate: true, l: 'gate' }), S('au', 6, 26, 20, 6.2, { l: 'metal contact' }), S('au', 74, 26, 20, 6.2),
    ],
    chan: [{ r: [26, 32.2, 48, 1.8], color: 'mos2' }],
    flows: [{ c: 'e', p: [[16, 31], [26, 33.1], [74, 33.1], [84, 31]], w: 1 }],
    terms: [{ k: 's', x: 16, y: 20 }, { k: 'g', x: 50, y: 11 }, { k: 'd', x: 84, y: 20 }],
  },
  cnt_fet: {
    shapes: [
      S('psub', 0, 38, 100, 18, { l: 'Si / SiO₂ substrate' }), S('oxide', 0, 32, 100, 6),
      S('cnt', 12, 29.6, 76, 2.4, { l: 'carbon nanotube (~1.5 nm)' }),
      S('highk', 34, 25, 32, 7, { a: 0.8 }), S('metal', 38, 14, 24, 11, { gate: true, l: 'gate' }),
      S('au', 4, 22, 16, 10, { l: 'metal contact' }), S('au', 80, 22, 16, 10),
    ],
    chan: [{ r: [20, 29.6, 60, 2.4], color: 'cnt' }],
    flows: [{ c: 'e', p: [[14, 30.8], [20, 30.8], [80, 30.8], [86, 30.8]], w: 1 }],
    terms: [{ k: 's', x: 12, y: 18 }, { k: 'g', x: 50, y: 9 }, { k: 'd', x: 88, y: 18 }],
  },
  igzo_tft: {
    shapes: [
      S('glass', 0, 44, 100, 12, { l: 'glass / polyimide' }), S('metal', 30, 38, 40, 6, { gate: true, l: 'bottom gate' }),
      S('oxide', 8, 33, 84, 5, { l: 'gate insulator (SiO₂)' }), S('igzo', 16, 29, 68, 4, { l: 'IGZO film (~40 nm)' }),
      S('al', 10, 23, 24, 7, { l: 'source' }), S('al', 66, 23, 24, 7, { l: 'drain' }), S('spacer', 34, 25, 32, 4, { a: 0.4, l: 'etch stop' }),
    ],
    chan: [{ r: [30, 31.6, 40, 1.4] }],
    flows: [{ c: 'e', p: [[22, 29.5], [30, 32.2], [70, 32.2], [78, 29.5]], w: 1 }],
    terms: [{ k: 's', x: 22, y: 18 }, { k: 'g', x: 50, y: 58 }, { k: 'd', x: 78, y: 18 }],
  },
  flash: {
    shapes: [
      S('psub', 0, 28, 100, 28, { l: 'p-type Si' }), S('n', 6, 28, 26, 9, { l: 'n⁺ source' }), S('n', 68, 28, 26, 9, { l: 'n⁺ drain' }),
      S('oxide', 32, 26, 36, 2, { l: 'tunnel oxide (~8 nm)' }), S('fg', 32, 19, 36, 7, { l: 'floating gate (isolated)' }),
      S('oxide', 32, 16.4, 36, 2.6, { l: 'ONO blocking layer' }), S('poly', 32, 6, 36, 10.4, { gate: true, l: 'control gate' }),
      S('spacer', 28.6, 6, 3.4, 22), S('spacer', 68, 6, 3.4, 22),
    ],
    chan: [{ r: [32, 28, 36, 1.6] }],
    flows: [{ c: 'e', p: [[18, 29], [32, 28.9], [68, 28.9], [82, 29]], w: 1 }],
    store: { r: [33, 20, 34, 5] },
    terms: [{ k: 's', x: 18, y: 4 }, { k: 'g', x: 50, y: 3 }, { k: 'd', x: 82, y: 4 }],
  },
};
