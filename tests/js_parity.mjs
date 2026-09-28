// Checks that the browser physics (site/js/physics) matches the Python reference
// numbers in data/physics_reference.json. Run: node tests/js_parity.mjs
import { readFileSync } from 'node:fs';
import * as C from '../site/js/physics/carriers.js';
import * as J from '../site/js/physics/junction.js';
import * as M from '../site/js/physics/moscap.js';
import * as T from '../site/js/physics/tunnel.js';
import * as P from '../site/js/physics/poisson2d.js';
import * as MC from '../site/js/physics/montecarlo.js';
import * as KP from '../site/js/physics/bandstructure.js';
import * as QW from '../site/js/physics/qwell.js';
import * as CS from '../site/js/physics/chargesheet.js';
import * as TH from '../site/js/physics/thermal.js';
import * as LI from '../site/js/physics/litho.js';
import * as BA from '../site/js/devices/bands.js';

const ref = JSON.parse(readFileSync(new URL('../data/physics_reference.json', import.meta.url)));
let fails = 0;
const check = (name, got, want, rel = 1e-6) => {
  const ok = Math.abs(got - want) <= rel * Math.abs(want) + 1e-300;
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: js=${got.toPrecision(6)} py=${want.toPrecision(6)}`);
};
for (const m of Object.keys(ref.ni)) { check(`ni ${m}`, C.intrinsicDensity(m), ref.ni[m]); check(`Eg ${m}`, C.bandGap(m), ref.Eg[m]); }
const pn = J.solve(1e16, 5e16, -1.0);
for (const k of ['Vbi', 'W_um', 'xn_um', 'xp_um', 'Emax']) check(`pn ${k}`, pn[k], ref.pn[k]);
check('J0', J.saturationCurrent(1e17, 1e16), ref.J0);
const mp = M.params({ Na: 1e17, toxNm: 5 });
check('MOS Vt', M.threshold(mp), ref.mos.Vt);
check('MOS Vg(0.5)', M.gateVoltage(0.5, mp), ref.mos['Vg_at_0.5']);
check('TMM rect', T.transfer(0.5, [1.0], [0.5]).T, ref.tunnel['rect_0.5_1_0.5'], 1e-9);
check('SiO2 1nm', T.stackTransmission(1.0, 'SiO2'), ref.tunnel.sio2_1nm, 1e-6);
check('HfO2 1nm/IL0.5', T.stackTransmission(1.0, 'HfO2', 0.5), ref.tunnel['hfo2_1nm_il0.5'], 1e-6);
for (const [key, dg] of [['SG20', false], ['DG20', true]]) {
  const g = P.build({ L: 20, dg });
  const a = P.solve(g, { Vgs: 0, Vds: 0.05 }), b = P.solve(g, { Vgs: 0, Vds: 0.7, psi0: a.psi });
  check(`DIBL ${key}`, (P.barrier(g, a.psi).Eb - P.barrier(g, b.psi).Eb) / 0.65 * 1000, ref.dibl[key], 0.02);
}
const g1 = KP.gaps(2.0, 0.5, 0.2)[0];
check('KP gap lower edge', g1[0], ref.kp.gap1[0], 1e-6); check('KP gap upper edge', g1[1], ref.kp.gap1[1], 1e-6);
check('KP m*', KP.effectiveMass(2.0, 0.5, 0.2)[0], ref.kp.mstar, 1e-4);
QW.finiteWell(5.0).E.forEach((e, i) => check(`well E${i}`, e, ref.qwell.E5[i], 1e-6));
const sp = QW.hemtSP(0.25, 20.0);
check('2DEG ns', sp.ns, ref.qwell.ns_25_20, 1e-4); check('2DEG E0', sp.E[0], ref.qwell.E0_25_20, 1e-4);
const csp = CS.params();
for (const [k, v] of Object.entries(ref.chargesheet)) { const [vg, vd] = k.split('_').map(Number); check(`charge-sheet I(${vg},${vd})`, CS.drainCurrent(vg, vd, csp), v, 1e-6); }
check('thermal Si', TH.peakRise('Si', 5.0).rise, ref.thermal.Si, 1e-6);
check('thermal diamond', TH.peakRise('Diamond', 5.0).rise, ref.thermal.Diamond, 1e-6);
check('thermal diamond+TBR', TH.peakRise('Diamond', 5.0, { tbr: 25 }).rise, ref.thermal.Diamond_tbr25, 1e-6);
check('litho conventional', LI.contrast(LI.aerialImage(100, { sigma: 0.9 }).I), ref.litho.conv100, 1e-6);
check('litho dipole', LI.contrast(LI.aerialImage(80, { kind: 'dipole', sigmaC: 0.89, sigmaW: 0.05 }).I), ref.litho.dip80, 1e-6);
check('litho defocus', LI.contrast(LI.aerialImage(120, { sigma: 0.7, defocus: 80 }).I), ref.litho.def120, 1e-6);
const devs = JSON.parse(readFileSync(new URL('../data/devices.json', import.meta.url))).devices;
for (const d of devs) {
  const r = ref.atlas[d.id], vg = 0.5 * (d.model.vg[0] + d.model.vg[1]), vd = 0.3 * d.model.vd[1];
  check(`atlas ${d.id} barrier`, BA.barrier(d, vg, vd), r.barrier_mid, 1e-9);
  check(`atlas ${d.id} on-fraction`, BA.onFraction(d, d.model.vt + 0.1 * (d.model.vg[1] - d.model.vg[0])), r.f_vt, 1e-9);
  const L = BA.lateral(d, vg, vd, 21); let worst = 0;
  L.Ec.forEach((e, i) => { const want = r.Ec_mid[i], got = isNaN(e) ? -99 : e; worst = Math.max(worst, Math.abs(got - want)); });
  if (worst > 1e-9) fails++;
  console.log(`${worst > 1e-9 ? 'FAIL' : 'ok  '} atlas ${d.id} lateral Ec (max diff ${worst.toExponential(1)})`);
  if (r.vert0 !== null) { const V = BA.vertical(d, vg); check(`atlas ${d.id} vertical Ec(0)`, V.Ec[0], r.vert0, d.model.vertical === 'hemt' ? 1e-3 : 1e-6); }
}
const v = MC.simulate(1e5, { n: 1000, tPs: 3 });
check('MC v(1e5 V/cm) within 25% of 1.07e7', v, 1.07e7, 0.25);
if (fails) { console.error(`${fails} parity check(s) failed`); process.exit(1); }
console.log('all parity checks passed');
