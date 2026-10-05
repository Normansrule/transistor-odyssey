// Deal–Grove thermal oxidation of silicon. Twin of sim/transistor_sim/physics/oxidation.py.
export const KB = 8.617333262e-5;
export const AMBIENTS = {
  dry: { C1: 7.72e2, E1: 1.23, C2: 6.23e6, E2: 2.00, xi: 0.025, name: 'Dry O₂' },
  wet: { C1: 3.86e2, E1: 0.78, C2: 1.63e8, E2: 2.05, xi: 0.0, name: 'Wet H₂O (steam)' },
};
export const ORIENT = { 111: 1.0, 100: 1.0 / 1.68 };
export const SI_CONSUMED = 0.44;

/** [B µm²/h, B/A µm/h] */
export function rateConstants(amb, T_C, orient = '100', p = 1) {
  const a = AMBIENTS[amb], T = T_C + 273.15;
  return [a.C1 * Math.exp(-a.E1 / (KB * T)) * p, a.C2 * Math.exp(-a.E2 / (KB * T)) * ORIENT[orient] * p];
}
export function thickness(amb, T_C, t_h, orient = '100', p = 1, x0 = null) {
  const [B, BA] = rateConstants(amb, T_C, orient, p), A = B / BA, xi = x0 ?? AMBIENTS[amb].xi;
  const tau = (xi * xi + A * xi) / B;
  return (-A + Math.sqrt(A * A + 4 * B * (t_h + tau))) / 2;
}
export function timeTo(amb, T_C, x, orient = '100', p = 1, x0 = null) {
  const [B, BA] = rateConstants(amb, T_C, orient, p), A = B / BA, xi = x0 ?? AMBIENTS[amb].xi;
  return Math.max((x * x + A * x - xi * xi - A * xi) / B, 0);
}
export function growthRate(amb, T_C, x, orient = '100', p = 1) { const [B, BA] = rateConstants(amb, T_C, orient, p); return B / (2 * x + B / BA); }
export function regime(amb, T_C, x, orient = '100') { const [B, BA] = rateConstants(amb, T_C, orient); const A = B / BA; return 2 * x / (2 * x + A); }
