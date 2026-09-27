// Lab 7 — Crystal structures in 3D (three.js). Positions come from
// sim/transistor_sim/physics/crystal.py via data/crystals.json.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { CRYSTALS } from '../physics/data.js';
import { panel, tiles, reduceMotion } from './ui.js';

const EL = {
  Si: ['#9fb3c8', 0.42, 'silicon'], Ge: ['#7fa7a0', 0.44, 'germanium'], C: ['#e8ecf1', 0.30, 'carbon'],
  Ga: ['#b58fd6', 0.44, 'gallium'], As: ['#d9825b', 0.44, 'arsenic'], N: ['#3987e5', 0.30, 'nitrogen'],
  Mo: ['#7fd3d0', 0.50, 'molybdenum'], S: ['#f2b84b', 0.40, 'sulfur'],
};
const INFO = {
  Si: { gap: '1.12 eV (indirect)', why: 'Every bond is a covalent sp³ bond at 109.5°: four neighbours per atom. The same lattice holds the dopants, the channel and, oxidised, the gate dielectric of 70 years of chips.' },
  Ge: { gap: '0.66 eV (indirect)', why: 'The first transistor\'s material. Same diamond lattice as silicon, but a smaller gap and no stable native oxide — which is why silicon won in the 1960s. SiGe returns in modern p-channels for its hole mobility.' },
  Diamond: { gap: '5.47 eV (indirect)', why: 'The same lattice as silicon with tiny carbon atoms: 1.54 Å bonds make it the stiffest, most thermally conductive crystal known — and a 5.5 eV gap, great for high voltage, hard to dope.' },
  GaAs: { gap: '1.42 eV (direct)', why: 'Zincblende: the diamond lattice with gallium and arsenic alternating. The direct gap makes it emit light; light electrons (m* = 0.067) make it fast. RF front-ends and lasers, not logic.' },
  GaN: { gap: '3.4 eV (direct)', why: 'Wurtzite is hexagonal and lacks inversion symmetry, so the crystal is spontaneously polarized along c. At an AlGaN/GaN interface that polarization creates a 2D electron gas with no doping at all — the HEMT channel.' },
  '4H-SiC': { gap: '3.26 eV (indirect)', why: 'Silicon–carbon bilayers stacked in an ABCB sequence repeat every four layers (hence “4H”). More than 200 polytypes exist; 4H wins for power MOSFETs thanks to its high, nearly isotropic electron mobility.' },
  MoS2: { gap: '≈1.8 eV (direct, monolayer)', why: 'A plane of molybdenum sandwiched between two sulfur planes, 0.65 nm thick, with no dangling bonds on its surfaces. It stays a semiconductor at one layer, which is why it is a candidate channel beyond silicon nanosheets.' },
};

export function init(sec) {
  const stage = sec.querySelector('[data-role=crystal]');
  const ctl = panel(sec.querySelector('.lab-ctl'), [
    { key: 'k', type: 'seg', label: 'Crystal', options: Object.keys(CRYSTALS).map(k => [k, k === 'MoS2' ? 'MoS₂' : k === '4H-SiC' ? '4H‑SiC' : k]), value: 'Si' },
    { key: 'scale', label: 'Atom size', min: 0.4, max: 1.6, step: 0.01, value: 1, fmt: v => v.toFixed(2) + '×' },
    { key: 'bonds', type: 'toggle', label: 'Show bonds', value: true },
    { key: 'spin', type: 'toggle', label: 'Auto-rotate', value: !reduceMotion },
  ]);
  const show = tiles(sec.querySelector('.lab-tiles'), [
    { key: 'grp', label: 'Space group', unit: '' }, { key: 'a', label: 'Lattice constant', unit: 'Å' },
    { key: 'b', label: 'Nearest-neighbour bond', unit: 'Å' }, { key: 'ang', label: 'Bond angle', unit: '' },
    { key: 'gap', label: 'Band gap (300 K)', unit: '' }, { key: 'n', label: 'Atoms shown', unit: '' },
  ]);
  const why = sec.querySelector('.pl-why'), legend = sec.querySelector('.pl-legend'), tip = stage.querySelector('.stage-tip');

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch { stage.insertAdjacentHTML('beforeend', '<div class="stage-fallback">The 3D viewer needs WebGL, which this browser has turned off.</div>'); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
  camera.position.set(18, 12, 22);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 8; controls.maxDistance = 80; controls.autoRotateSpeed = 0.9;
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x141008, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(10, 16, 12); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fd3d0, 0.9); rim.position.set(-12, -4, -10); scene.add(rim);
  const group = new THREE.Group(); scene.add(group);
  const sphere = new THREE.SphereGeometry(1, 28, 20), cyl = new THREE.CylinderGeometry(0.09, 0.09, 1, 10, 1);
  let atomMeshes = [], bondMesh = null, current = null;

  function buildCrystal(k) {
    group.clear(); atomMeshes = [];
    const c = CRYSTALS[k]; current = c;
    const byEl = {};
    c.atoms.forEach((a, i) => (byEl[a[0]] ??= []).push(i));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (const [el, idx] of Object.entries(byEl)) {
      const [col, r] = EL[el];
      const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.15 });
      const mesh = new THREE.InstancedMesh(sphere, mat, idx.length);
      idx.forEach((ai, j) => { const a = c.atoms[ai]; p.set(a[1], a[3], a[2]); s.setScalar(r * ctl.state.scale); m4.compose(p, q.identity(), s); mesh.setMatrixAt(j, m4); });
      mesh.userData = { el, idx }; group.add(mesh); atomMeshes.push(mesh);
    }
    // bonds: two half-cylinders per bond, coloured by each end
    const halves = [];
    for (const [i, j] of c.bonds) { const A = c.atoms[i], B = c.atoms[j]; const a = new THREE.Vector3(A[1], A[3], A[2]), b = new THREE.Vector3(B[1], B[3], B[2]), mid = a.clone().add(b).multiplyScalar(0.5); halves.push([a, mid, A[0]], [mid, b, B[0]]); }
    bondMesh = new THREE.InstancedMesh(cyl, new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1 }), halves.length);
    const up = new THREE.Vector3(0, 1, 0), color = new THREE.Color();
    halves.forEach(([a, b, el], n) => {
      const d = b.clone().sub(a), len = d.length();
      q.setFromUnitVectors(up, d.clone().normalize()); p.copy(a).add(b).multiplyScalar(0.5); s.set(1, len, 1);
      m4.compose(p, q, s); bondMesh.setMatrixAt(n, m4); bondMesh.setColorAt(n, color.set(EL[el][0]).multiplyScalar(0.8));
    });
    bondMesh.visible = ctl.state.bonds; group.add(bondMesh);
    // frame the camera
    const box = new THREE.Box3().setFromObject(group), size = box.getSize(new THREE.Vector3()).length();
    controls.target.set(0, 0, 0); camera.position.setLength(size * 1.25 + 6);
    const [sym, nm] = c.group.split(' ('); show({ grp: `${sym}<small>${(nm || '').replace(')', '')}</small>`, a: c.c ? `a ${c.a.toFixed(3)}, c ${c.c.toFixed(3)}` : c.a.toFixed(3), b: c.bond_A.toFixed(3), ang: c.angle_deg ? c.angle_deg.toFixed(1) + '°' : '—', gap: INFO[k].gap, n: String(c.atoms.length) });
    why.textContent = INFO[k].why;
    legend.innerHTML = Object.keys(byEl).map(e => `<div><i style="background:${EL[e][0]}"></i>${e} — ${EL[e][2]}</div>`).join('');
  }

  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  renderer.domElement.addEventListener('pointermove', e => {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(atomMeshes)[0];
    if (hit) {
      const { el, idx } = hit.object.userData, a = current.atoms[idx[hit.instanceId]];
      tip.hidden = false; tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px';
      tip.textContent = `${el} (${EL[el][2]}) at (${a[1].toFixed(2)}, ${a[2].toFixed(2)}, ${a[3].toFixed(2)}) Å`;
    } else tip.hidden = true;
  });
  renderer.domElement.addEventListener('pointerleave', () => { tip.hidden = true; });

  ctl.on(k => {
    if (k === 'k' || k === '*') buildCrystal(ctl.state.k);
    if (k === 'scale') buildCrystal(ctl.state.k);
    if (bondMesh) bondMesh.visible = ctl.state.bonds;
    controls.autoRotate = ctl.state.spin;
  });
  sec.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
    const d = camera.position.length(), v = b.dataset.view;
    const dir = v === 'top' ? new THREE.Vector3(0.001, 1, 0) : v === 'side' ? new THREE.Vector3(1, 0.001, 0) : new THREE.Vector3(1, 1, 1);
    camera.position.copy(dir.normalize().multiplyScalar(d)); controls.update();
  }));

  function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(stage); resize();
  controls.autoRotate = ctl.state.spin;
  buildCrystal('Si');
  let visible = false, running = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !running) { running = true; requestAnimationFrame(tick); } }).observe(stage);
  function tick() { if (!visible) { running = false; return; } controls.update(); renderer.render(scene, camera); requestAnimationFrame(tick); }
}
