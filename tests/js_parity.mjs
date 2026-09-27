// Checks that the browser physics (site/js/physics) matches the Python reference
// numbers in data/physics_reference.json. Run: node tests/js_parity.mjs
import { readFileSync } from 'node:fs';
import * as C from '../site/js/physics/carriers.js';
import * as J from '../site/js/physics/junction.js';
import * as M from '../site/js/physics/moscap.js';
import * as T from '../site/js/physics/tunnel.js';
import * as P from '../site/js/physics/poisson2d.js';
import * as MC from '../site/js/physics/montecarlo.js';

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
const v = MC.simulate(1e5, { n: 1000, tPs: 3 });
check('MC v(1e5 V/cm) within 25% of 1.07e7', v, 1.07e7, 0.25);
if (fails) { console.error(`${fails} parity check(s) failed`); process.exit(1); }
console.log('all parity checks passed');
