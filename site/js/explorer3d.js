import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { id } from './model.js';

// Material colours match sim/transistor_sim/crosssection.py (MAT)
const M = {
  si: ['#4b596d', 'Silicon substrate'], sich: ['#7b8ca5', 'Silicon channel'], sti: ['#6fa9b3', 'Trench oxide'],
  n: ['#3f7fe0', 'n⁺ source / drain'], p: ['#e07f3f', 'p⁺ source / drain'], highk: ['#9a80dc', 'High-k HfO₂'],
  metal: ['#e2b650', 'Metal gate'], spacer: ['#cfd6e0', 'Spacer / passivation'], cu: ['#d9825b', 'Copper contact'],
  chan: ['#ffe066', 'Inversion channel'], deg: ['#ffe066', '2D electron gas'], mos2: ['#e25fa6', 'MoS₂ monolayer'],
  alox: ['#f4ea9c', 'AlOx 0.42 nm'], sapphire: ['#6d7f99', 'Sapphire substrate'], au: ['#e8c45c', 'Gold contact'],
  gan: ['#3aa6cf', 'GaN channel layer'], algan: ['#86cfe6', 'AlGaN barrier'], sic: ['#b8964f', 'SiC substrate'],
  buffer: ['#8fcfd4', 'AlN / buffer'], oxide: ['#8fcfd4', 'Bonding oxide'], bspdn: ['#d9825b', 'Backside power rail'],
  poly: ['#c95c50', 'Poly-Si gate'],
};

// [material, cx, cy, cz, sx, sy, sz, explodeLevel, opacity]
const ARCH = {
  planar: {
    label: 'Planar HKMG', preset: '2007_45nm_hkmg',
    caption: 'Planar MOSFET (45 nm HKMG): the gate only touches the top of the channel, so the drain can reach under it and leak.',
    boxes: [['si', 0, -1, 0, 8, 2, 4, 0], ['n', -2.5, -0.2, 0, 2.6, 0.42, 3.6, 1], ['n', 2.5, -0.2, 0, 2.6, 0.42, 3.6, 1],
      ['chan', 0, -0.01, 0, 2.4, 0.04, 3.2, 1], ['highk', 0, 0.08, 0, 2.4, 0.14, 3.2, 2], ['metal', 0, 0.65, 0, 2.2, 1.0, 3.2, 3],
      ['spacer', -1.3, 0.55, 0, 0.3, 1.1, 3.2, 3], ['spacer', 1.3, 0.55, 0, 0.3, 1.1, 3.2, 3], ['cu', -2.6, 0.65, 0, 0.7, 1.3, 0.8, 4], ['cu', 2.6, 0.65, 0, 0.7, 1.3, 0.8, 4]],
    paths: [{ y: -0.03, z: [-1.4, 1.4], x: [-3.6, 3.6] }],
  },
  finfet: {
    label: 'FinFET', preset: '2011_22nm_finfet',
    caption: 'FinFET (22 nm): the gate wraps three sides of each silicon fin. Three fins act as one wider transistor.',
    boxes: [['si', 0, -1.4, 0, 8, 1.6, 5, 0], ['sti', 0, -0.35, 0, 8, 0.5, 5, 1],
      ...[-1.4, 0, 1.4].flatMap(z => [['sich', 0, 0.2, z, 7, 1.6, 0.36, 1], ['n', -2.9, 0.3, z, 1.8, 1.3, 0.72, 2], ['n', 2.9, 0.3, z, 1.8, 1.3, 0.72, 2]]),
      ['highk', 0, 0.4, 0, 1.4, 1.5, 4.4, 3, 0.35], ['metal', 0, 0.62, 0, 1.2, 2.0, 4.6, 4, 0.82]],
    paths: [-1.4, 0, 1.4].map(z => ({ y: [0.0, 0.95], z: [z - 0.14, z + 0.14], x: [-3.4, 3.4] })),
  },
  gaa: {
    label: 'GAA nanosheet', preset: '2025_2nm_gaa',
    caption: 'Gate-all-around (2 nm class): three stacked silicon sheets, each fully surrounded by high-k and metal gate.',
    boxes: [['si', 0, -1.2, 0, 8, 1.4, 4, 0], ['sti', 0, -0.4, 0, 8, 0.2, 4, 1],
      ['n', -3.1, 0.6, 0, 1.6, 1.7, 3, 1], ['n', 3.1, 0.6, 0, 1.6, 1.7, 3, 1],
      ...[0.1, 0.6, 1.1].flatMap((y, i) => [['sich', 0, y, 0, 5.2, 0.18, 2.6, 2 + i * 0.6], ['highk', 0, y, 0, 2.0, 0.32, 2.8, 2.3 + i * 0.6, 0.5]]),
      ['metal', 0, 0.7, 0, 1.8, 1.9, 3.2, 4.2, 0.78]],
    paths: [0.1, 0.6, 1.1].map(y => ({ y, z: [-1.2, 1.2], x: [-3.6, 3.6] })),
  },
  stack: {
    label: 'Nanostack / CFET', preset: '2025_2nm_gaa',
    caption: 'Stacked nanosheets (IBM 7 Å nanostack, CFET roadmap): a pFET tier sits above an nFET tier, staggered, sharing the footprint.',
    boxes: [['bspdn', 0, -1.55, 0, 8, 0.3, 4, 0], ['si', 0, -0.95, 0, 8, 0.9, 4, 0.5],
      ['n', -3.0, 0.45, 0, 1.4, 1.5, 3, 1.5], ['n', 3.0, 0.45, 0, 1.4, 1.5, 3, 1.5],
      ...[0.0, 0.45, 0.9].map((y, i) => ['sich', 0, y, 0, 4.8, 0.16, 2.6, 2 + i * 0.4]),
      ['oxide', 0, 1.45, 0, 8, 0.14, 4, 3.2, 0.7],
      ['p', -2.4, 2.45, 0, 1.4, 1.5, 3, 4], ['p', 3.6, 2.45, 0, 1.4, 1.5, 3, 4],
      ...[2.0, 2.45, 2.9].map((y, i) => ['sich', 0.6, y, 0, 4.8, 0.16, 2.6, 4.4 + i * 0.4]),
      ['metal', 0.3, 1.45, 0, 1.8, 3.8, 3.2, 6, 0.7]],
    paths: [0.0, 0.45, 0.9].map(y => ({ y, z: [-1.2, 1.2], x: [-3.4, 3.4] })).concat([2.0, 2.45, 2.9].map(y => ({ y, z: [-1.2, 1.2], x: [-2.8, 4.0] }))),
  },
  mos2: {
    label: '2D MoS₂', preset: '2026_mos2_2d',
    caption: 'Monolayer MoS₂ FET (NYCU + TSMC, 2026): a 0.7 nm channel under a 0.42 nm AlOx buffer and HfO₂. Thicknesses exaggerated to be visible.',
    boxes: [['sapphire', 0, -0.6, 0, 8, 1.2, 4, 0], ['mos2', 0, 0.04, 0, 7, 0.08, 3.4, 1],
      ['au', -2.8, 0.4, 0, 1.6, 0.64, 3.4, 2], ['au', 2.8, 0.4, 0, 1.6, 0.64, 3.4, 2],
      ['alox', 0, 0.11, 0, 3.8, 0.06, 3.4, 2.5], ['highk', 0, 0.24, 0, 3.8, 0.2, 3.4, 3], ['metal', 0, 0.75, 0, 3.2, 0.8, 3.2, 4]],
    paths: [{ y: 0.04, z: [-1.5, 1.5], x: [-3.4, 3.4] }],
  },
  hemt: {
    label: 'GaN HEMT', preset: null,
    caption: 'AlGaN/GaN HEMT: polarization forms a sheet of electrons (2DEG) under the barrier with no doping. Normally on; negative gate voltage pinches it off.',
    boxes: [['sic', 0, -1.6, 0, 8, 0.8, 4, 0], ['buffer', 0, -1.05, 0, 8, 0.3, 4, 0.6], ['gan', 0, -0.5, 0, 8, 0.8, 4, 1],
      ['deg', 0, -0.08, 0, 8, 0.04, 4, 1.6], ['algan', 0, 0.1, 0, 8, 0.3, 4, 2.2],
      ['au', -3, 0.45, 0, 1.4, 0.4, 3.2, 3], ['au', 3, 0.45, 0, 1.4, 0.4, 3.2, 3], ['spacer', 0, 0.33, 0, 4, 0.16, 4, 3, 0.55],
      ['metal', 0, 0.7, 0, 0.4, 0.8, 3.2, 4], ['metal', 0.25, 1.15, 0, 1.4, 0.2, 3.2, 4]],
    paths: [{ y: -0.08, z: [-1.6, 1.6], x: [-3.8, 3.8] }],
  },
};

export function initExplorer(DATA) {
  const stage = document.getElementById('stage');
  const seg = document.getElementById('archSeg');
  const legend = document.getElementById('legend');
  const caption = document.getElementById('stageCaption');
  const vgIn = document.getElementById('vg'), exIn = document.getElementById('explode'), spin = document.getElementById('spin');
  const vgOut = document.getElementById('vgOut'), exOut = document.getElementById('explodeOut');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch (e) { stage.insertAdjacentHTML('beforeend', '<div class="stage-fallback">3D needs WebGL, which this browser has turned off. The cross-sections in the timeline show the same structures.</div>'); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(8.5, 6.2, 9.5);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.target.set(0, 0.2, 0); controls.autoRotate = true; controls.autoRotateSpeed = 0.6;
  controls.minDistance = 5; controls.maxDistance = 24; controls.enablePan = false;
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1208, 1.1));
  const key = new THREE.DirectionalLight(0xffe2b0, 2.2); key.position.set(6, 10, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fd3d0, 1.0); rim.position.set(-8, 4, -6); scene.add(rim);
  const grid = new THREE.GridHelper(20, 40, 0x2f3845, 0x1b222c); grid.position.y = -2.6; scene.add(grid);

  const group = new THREE.Group(); scene.add(group);
  const N = 700;
  const pGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3); pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0xffe066, size: 0.07, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const points = new THREE.Points(pGeo, pMat); scene.add(points);
  const parts = Array.from({ length: N }, () => ({ t: Math.random(), path: 0, dy: Math.random(), z: Math.random(), speed: 0.6 + Math.random() * 0.8 }));

  let arch = 'finfet', meshes = [], flow = 0.5;
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  const tipEl = document.createElement('div'); tipEl.className = 'stage-tip'; tipEl.hidden = true; stage.appendChild(tipEl);

  seg.innerHTML = Object.entries(ARCH).map(([k, a]) => `<button aria-pressed="${k === arch}" data-k="${k}">${a.label}</button>`).join('');
  seg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); build(b.dataset.k); });

  function build(k) {
    arch = k; const A = ARCH[k];
    for (const m of meshes) { group.remove(m); m.geometry.dispose(); m.material.dispose(); m.children.forEach(c => { c.geometry.dispose(); c.material.dispose(); }); }
    meshes = [];
    for (const [mat, cx, cy, cz, sx, sy, sz, lvl, op = 1] of A.boxes) {
      const col = new THREE.Color(M[mat][0]);
      const glow = mat === 'chan' || mat === 'deg';
      const material = new THREE.MeshStandardMaterial({ color: col, roughness: mat === 'metal' || mat === 'au' || mat === 'cu' ? 0.35 : 0.7, metalness: mat === 'metal' || mat === 'au' || mat === 'cu' ? 0.55 : 0.05,
        transparent: op < 1, opacity: op, emissive: glow ? col : new THREE.Color(0x000000), emissiveIntensity: glow ? 0.9 : 0, depthWrite: op >= 1 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
      mesh.position.set(cx, cy, cz);
      mesh.userData = { base: cy, lvl, name: M[mat][1], mat };
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 }));
      mesh.add(edges);
      group.add(mesh); meshes.push(mesh);
    }
    const seen = new Map(); for (const [mat] of A.boxes) if (!seen.has(M[mat][1])) seen.set(M[mat][1], M[mat][0]);
    legend.innerHTML = [...seen].map(([n, c]) => `<div><i style="background:${c}"></i>${n}</div>`).join('') + '<div><i style="background:#ffe066;border-radius:50%"></i>Carriers (animated)</div>';
    caption.textContent = A.caption;
    parts.forEach(p => { p.path = (Math.random() * A.paths.length) | 0; });
    applyExplode(); updateFlow();
  }

  function applyExplode() {
    const e = +exIn.value; exOut.textContent = Math.round(e * 100) + '%';
    for (const m of meshes) m.position.y = m.userData.base + m.userData.lvl * e * 0.9;
  }

  function updateFlow() {
    const v = +vgIn.value; const A = ARCH[arch];
    if (A.preset) {
      const p = DATA.presets[A.preset]; const vg = v * p.VDD;
      vgOut.textContent = vg.toFixed(2) + ' V';
      const ion = id(p, p.VDD, p.VDD), ioff = id(p, 0, p.VDD), i = id(p, vg, p.VDD);
      flow = Math.min(Math.max(Math.log10(i / ioff) / Math.log10(ion / ioff), 0), 1);
    } else { // HEMT: slider maps −6 V … +1 V, pinch-off near −4.5 V
      const vg = -6 + 7 * v; vgOut.textContent = vg.toFixed(2) + ' V';
      flow = Math.min(Math.max((vg + 4.5) / 5.5, 0), 1) ** 0.8;
    }
  }

  vgIn.addEventListener('input', updateFlow);
  exIn.addEventListener('input', applyExplode);
  spin.addEventListener('change', () => { controls.autoRotate = spin.checked; });

  renderer.domElement.addEventListener('pointermove', e => {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(meshes, false)[0];
    meshes.forEach(m => { if (!['chan', 'deg'].includes(m.userData.mat)) m.material.emissiveIntensity = 0; });
    if (hit) {
      const m = hit.object; if (!['chan', 'deg'].includes(m.userData.mat)) { m.material.emissive = new THREE.Color(0xf2b84b); m.material.emissiveIntensity = 0.25; }
      tipEl.textContent = m.userData.name; tipEl.hidden = false; tipEl.style.left = (e.clientX - r.left) + 'px'; tipEl.style.top = (e.clientY - r.top) + 'px';
    } else tipEl.hidden = true;
  });
  renderer.domElement.addEventListener('pointerleave', () => { tipEl.hidden = true; });

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage); resize();

  let visible = true; new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(stage);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { controls.autoRotate = false; spin.checked = false; }
  let last = performance.now();
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (visible) {
      const A = ARCH[arch]; const e = +exIn.value;
      const active = Math.round(N * flow);
      const CH = ['sich', 'chan', 'deg', 'mos2'];
      const lifts = A.paths.map(P => {
        const yy = Array.isArray(P.y) ? P.y[1] : P.y; let best = null, bd = 9;
        for (const m of meshes) { const d = Math.abs(m.userData.base - yy) + Math.abs(m.position.x - (P.x[0] + P.x[1]) / 2) * 0.01; if (CH.includes(m.userData.mat) && d < bd) { bd = d; best = m; } }
        return best ? best.userData.lvl * e * 0.9 : 0;
      });
      for (let i = 0; i < N; i++) {
        const p = parts[i];
        if (i >= active) { pos[i * 3 + 1] = -999; continue; }
        p.t += dt * p.speed * (0.25 + 0.9 * flow) * (reduce ? 0 : 1);
        if (p.t > 1) { p.t -= 1; p.dy = Math.random(); p.z = Math.random(); }
        const P = A.paths[p.path];
        const lvlLift = lifts[p.path];
        const y = Array.isArray(P.y) ? P.y[0] + (P.y[1] - P.y[0]) * p.dy : P.y;
        pos[i * 3] = P.x[0] + (P.x[1] - P.x[0]) * p.t;
        pos[i * 3 + 1] = y + lvlLift;
        pos[i * 3 + 2] = P.z[0] + (P.z[1] - P.z[0]) * p.z;
      }
      pGeo.attributes.position.needsUpdate = true;
      controls.update(); renderer.render(scene, camera);
    }
    requestAnimationFrame(tick);
  }
  build(arch); requestAnimationFrame(tick);
}
