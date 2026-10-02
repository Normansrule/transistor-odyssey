// Energy band diagrams for every device — twin of sim/transistor_sim/bandatlas.py.
import * as MOS from '../physics/moscap.js';
import * as QW from '../physics/qwell.js';

export const E_TH = 0.28, PHI = 0.035;
const S = t => { t = Math.min(Math.max(t, 0), 1); return t * t * (3 - 2 * t); };
const softplus = (x, w = PHI) => w * Math.log1p(Math.exp(x / w));
const MAT_KEY = { 'Si': 'Si', '4H-SiC': '4H-SiC', 'GaN': 'GaN', 'GaAs': 'GaAs' };
const lin = n => Array.from({ length: n }, (_, i) => i / (n - 1));

export const vtEff = (dev, prog = 0) => dev.model.vt + (dev.model.flash ? 2.5 * prog : 0);
const tfetWindow = (m, Vg) => m.pol * (Vg - m.vt) * 0.9;

export function onFraction(dev, Vg, prog = 0) {
  const m = dev.model;
  if (m.lateral === 'tfet') return 1 / (1 + Math.exp(-tfetWindow(m, Vg) / 0.03));
  if (m.lateral === 'bjt') return 1 / (1 + Math.exp(-(Vg - m.vt) / 0.03));
  const w = 0.06 * (m.n || 1) * (m.vscale || 1);
  return 1 / (1 + Math.exp(-m.pol * (Vg - vtEff(dev, prog)) / w));
}

export function barrier(dev, Vg, Vd, prog = 0) {
  const m = dev.model, vs = m.vscale || 1;
  const raw = E_TH - m.pol * (Vg - vtEff(dev, prog)) / ((m.n || 1) * vs);
  return softplus(raw) + 0.02 - (m.eta ?? 0.05) * Vd / vs;
}

export function lateral(dev, Vg, Vd, n = 241, prog = 0) {
  const m = dev.model, x = lin(n), Eg = m.Eg, vs = m.vscale || 1, fam = m.lateral;
  const Ec = new Float64Array(n), Ev = new Float64Array(n);
  const out = { x, family: fam, carrier: dev.carrier, Ec, Ev };
  if (fam === 'fet') {
    const f = onFraction(dev, Vg, prog), vd = Vd / vs, Eb = Math.max(barrier(dev, Vg, Vd, prog), 0);
    const xs = 0.24, xd = 0.76, Ecs = 0.04;
    for (let i = 0; i < n; i++) {
      const u = Math.min(Math.max((x[i] - xs) / (xd - xs), 0), 1);
      const bump = S(u / 0.2) * (1 - S((u - 0.62) / 0.38));
      const ramp = (1 - f) * S((u - 0.7) / 0.3) + f * u * u;
      let e = Ecs + Eb * bump - vd * (x[i] >= xd ? 1 : ramp);
      if (x[i] < xs) e = Ecs;
      if (m.pol < 0) { Ev[i] = -e; Ec[i] = -e + Eg; } else { Ec[i] = e; Ev[i] = e - Eg; }
    }
    Object.assign(out, { EFs: 0, EFd: m.pol < 0 ? vd : -vd, regions: [[0, xs, dev.labels.s], [xs, xd, 'channel'], [xd, 1, dev.labels.d]], barrier: Eb, f });
  } else if (fam === 'bjt') {
    const vbe = Vg, vce = Vd, vbi = m.vbi ?? 0.9, xe = 0.30, xb0 = 0.38, xb1 = 0.58, xc = 0.66;
    const EcE = 0.04, EcB = EcE + Math.max(vbi - vbe, 0.04), EcC = EcB - (0.75 + Math.max(vce - vbe, -0.6)), het = m.hetero || 0;
    const EF = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const X = x[i];
      let e = X < xe ? EcE : X < xb0 ? EcE + (EcB - EcE) * S((X - xe) / (xb0 - xe)) : X < xb1 ? EcB : X < xc ? EcB + (EcC - EcB) * S((X - xb1) / (xc - xb1)) : EcC;
      let v = e - Eg + (het && X >= xb0 - 0.02 && X < xb1 + 0.02 ? het : 0);
      let ef = X < xe + 0.04 ? 0 : X < xb1 + 0.04 ? -vbe : -vce;
      if (m.pol < 0) { const t = e; e = -v; v = -t; ef = -ef; }
      Ec[i] = e; Ev[i] = v; EF[i] = ef;
    }
    Object.assign(out, { EF, regions: [[0, xe, dev.labels.s], [xb0, xb1, dev.labels.g], [xc, 1, dev.labels.d]], barrier: EcB - EcE, f: onFraction(dev, Vg) });
  } else if (fam === 'tfet') {
    const xs = 0.34, xd = 0.78, Evs = 0.03, win = tfetWindow(m, Vg), Ecch = Evs - win, Ecd = 0.03 - Vd;
    for (let i = 0; i < n; i++) {
      const X = x[i];
      let e;
      if (X < xs - 0.03) e = Evs + Eg;
      else if (X < xs + 0.02) e = Evs + Eg + (Ecch - Evs - Eg) * S((X - (xs - 0.03)) / 0.05);
      else if (X < xd) e = Ecch + (Ecd - Ecch) * S((X - xd + 0.12) / 0.12) * (X > xd - 0.12 ? 1 : 0);
      else e = Ecd;
      Ec[i] = e; Ev[i] = e - Eg;
    }
    Object.assign(out, { EFs: 0, EFd: -Vd, regions: [[0, xs, dev.labels.s], [xs, xd, 'channel'], [xd, 1, dev.labels.d]], window: win, f: onFraction(dev, Vg) });
  } else if (fam === 'sbfet') {
    const xs = 0.18, xd = 0.82, phiB = Eg / 2, Ecm = phiB + 0.25 - (Vg - m.vt) * 0.9, lam = 0.035;
    for (let i = 0; i < n; i++) {
      const u = x[i];
      if (u < xs || u > xd) { Ec[i] = NaN; Ev[i] = NaN; continue; }
      const e = Ecm + (phiB - Ecm) * Math.exp(-Math.max(u - xs, 0) / lam) + ((phiB - Vd) - (Ecm - Vd * 0.5)) * Math.exp(-Math.max(xd - u, 0) / lam) - Vd * 0.5 * S((u - xs) / (xd - xs));
      Ec[i] = e; Ev[i] = e - Eg;
    }
    Object.assign(out, { EFs: 0, EFd: -Vd, metal: [xs, xd], regions: [[0, xs, 'metal'], [xs, xd, 'nanotube'], [xd, 1, 'metal']], f: onFraction(dev, Vg), barrierMid: Ecm });
  }
  return out;
}

const hemtCache = new Map();
export function vertical(dev, Vg, n = 200, prog = 0) {
  const m = dev.model, kind = m.vertical, Eg = m.Eg;
  if (kind === 'none') return null;
  if (kind === 'mos') {
    const tox = m.tox ?? 2, Na = m.Na ?? 3e17, mat = MAT_KEY[dev.material] || 'Si';
    const p0 = MOS.params({ Na, toxNm: tox, Vfb: 0, mat });
    const Vfb = vtEff(dev, prog) - MOS.threshold(p0);
    const p = MOS.params({ Na, toxNm: tox, Vfb, mat });
    let lo = -1, hi = 2 * p.phiB + 0.6;
    for (let i = 0; i < 80; i++) { const mid = 0.5 * (lo + hi); if (MOS.gateVoltage(mid, p) > Vg) hi = mid; else lo = mid; }
    const psiS = 0.5 * (lo + hi), bb = MOS.bandBending(psiS, p);
    const z = Array.from(bb.psi, (_, i) => i * bb.dxNm);
    const Ec = Float64Array.from(bb.psi, v => p.phiB - v + Eg / 2), Ev = Float64Array.from(bb.psi, v => p.phiB - v - Eg / 2);
    return { kind, z, Ec, Ev, EF: 0, psiS, gateEF: -(Vg - Vfb), tox, regions: [['gate', -1], ['oxide', tox], ['semiconductor', z[z.length - 1]]] };
  }
  if (kind === 'hemt') {
    const key = (Math.round(Vg * 10) / 10).toFixed(1);
    let r = hemtCache.get(key);
    if (!r) { r = QW.hemtSP(m.x ?? 0.25, m.d ?? 20, { Vg: +key, depthNm: 45, dzNm: 0.25 }); hemtCache.set(key, r); }
    const Ev = Float64Array.from(r.Ec, (v, i) => v - (r.z[i] < r.dNm ? 3.91 : 3.4));
    return { kind, z: Array.from(r.z), Ec: r.Ec, Ev, EF: 0, E: r.E, psi: r.psi, ns: r.ns, dNm: r.dNm, regions: [['gate', -1], ['AlGaN', r.dNm], ['GaN', r.z[r.z.length - 1]]] };
  }
  const z = lin(n), f = onFraction(dev, Vg, prog);
  const Ec = new Float64Array(n);
  if (kind === 'dg') {
    const Eb = barrier(dev, Vg, 0, prog), t = m.tsi ?? 6, edge = Eb - 0.07 * f;
    for (let i = 0; i < n; i++) Ec[i] = m.single ? edge + (Eb + 0.05 * (1 - f) - edge) * S(z[i]) : Eb - (Eb - edge) * (2 * z[i] - 1) ** 2;
    return { kind, z: z.map(v => v * t), Ec, Ev: Ec.map(v => v - Eg), EF: 0, single: !!m.single, regions: [['gate', -1], ['oxide', 1], ['channel body', t]] };
  }
  if (kind === 'diamond') {
    const Evs = -0.25 + 0.75 * f, Ev = new Float64Array(n);
    for (let i = 0; i < n; i++) Ev[i] = -1.9 + (Evs + 1.9) * Math.exp(-z[i] * 12 / 2);
    return { kind, z: z.map(v => v * 12), Ec: Ev.map(v => v + Eg), Ev, EF: 0, regions: [['gate', -1], ['Al₂O₃ / acceptors', 2], ['diamond', 12]] };
  }
  if (kind === 'jfet' || kind === 'mesfet') {
    const vbi = kind === 'jfet' ? 0.8 : 0.7, wd = Math.min(60 * Math.sqrt(Math.max(vbi - Vg, 0.02)) / Math.sqrt(vbi), 190);
    for (let i = 0; i < n; i++) { const zz = z[i] * 200; Ec[i] = zz < wd ? 0.05 + (vbi - Vg) * (1 - zz / wd) ** 2 : 0.05; }
    return { kind, z: z.map(v => v * 200), Ec, Ev: Ec.map(v => v - Eg), EF: 0, wd, regions: [['gate', -1], ['depleted', wd], ['open channel', 200]] };
  }
  if (kind === 'tft') {
    const Ecs = 0.35 - 0.33 * f;
    for (let i = 0; i < n; i++) Ec[i] = 0.35 + (Ecs - 0.35) * Math.exp(-z[i] * 40 / 4);
    return { kind, z: z.map(v => v * 40), Ec, Ev: Ec.map(v => v - Eg), EF: 0, regions: [['bottom gate', -1], ['gate insulator', 100], ['IGZO', 40]] };
  }
  if (kind === 'flash') {
    const Ecs = 0.6 - 0.55 * f;
    for (let i = 0; i < n; i++) Ec[i] = 0.6 + (Ecs - 0.6) * Math.exp(-z[i] * 30 / 5);
    return { kind, z: z.map(v => v * 30), Ec, Ev: Ec.map(v => v - Eg), EF: 0, stored: prog, regions: [['control gate', -1], ['blocking oxide', 8], ['floating gate', 10], ['tunnel oxide', 8], ['channel', 30]] };
  }
  return null;
}

export function heterojunction(A, B) {
  const Ec1 = -A.chi, Ev1 = -A.chi - A.Eg, Ec2 = -B.chi, Ev2 = -B.chi - B.Eg;
  const dEc = Ec2 - Ec1, dEv = Ev2 - Ev1;
  let type = 'II (staggered)';
  if ((Ec1 <= Ec2 && Ev1 >= Ev2) || (Ec2 <= Ec1 && Ev2 >= Ev1)) type = 'I (straddling)';
  else if (Ec1 < Ev2 || Ec2 < Ev1) type = 'III (broken gap)';
  return { dEc, dEv, type, Ec1, Ev1, Ec2, Ev2 };
}
