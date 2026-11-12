// Procedural 3D house built from the interview profile. Units are feet.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { RGBELoader } from 'three/addons/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { EXTERIOR_STYLES, EXTERIOR_PALETTES, INTERIOR_STYLES, CABINET_COLORS } from './styles-data.js';
import { roomStyle } from './questions.js';
import { surface, prepare, GLASS, WATER, BULB, twoSided, setMaxAnisotropy, setEnvIntensity } from './materials.js';
import * as F from './furniture.js';

const paint = (color) => surface('paint', color);

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = prepare(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material));
  m.position.set(x, y + h / 2, z);
  return m;
}

// A w×h×d box whose long axis (d) runs from point a to point b.
function beam(a, b, w, h, material) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const m = prepare(new THREE.Mesh(new THREE.BoxGeometry(w, h, len), material));
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), B.sub(A).normalize());
  return m;
}

function meshFromTris(tris, material) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(2), 3));
  g.computeVertexNormals();
  return prepare(new THREE.Mesh(g, material));
}
const quad = (a, b, c, d) => [[a, b, c], [a, c, d]];

const doubleSided = twoSided;

// Gable/hip roof over a w×d rectangle with the ridge running along x.
// inset = 0 gives a gable, inset = d/2 a full hip. Adds fascia and rake trim.
function pitchedRoof(w, d, h, inset, roofMat, endMat, trimMat) {
  const A = [-w / 2, 0, -d / 2], B = [w / 2, 0, -d / 2], C = [w / 2, 0, d / 2], D = [-w / 2, 0, d / 2];
  const R1 = [-w / 2 + inset, h, 0], R2 = [w / 2 - inset, h, 0];
  const g = new THREE.Group();
  const slopes = [...quad(D, C, R2, R1), ...quad(B, A, R1, R2)];
  const ends = [[A, D, R1], [C, B, R2]];
  if (inset > 0) slopes.push(...ends);
  g.add(meshFromTris(slopes, doubleSided(roofMat)));
  if (inset === 0) {
    // gable ends sit at the wall line, not the overhang
    const e = (x) => [[x, 0, -d / 2 + 1.5], [x, 0, d / 2 - 1.5], [x, h * (1 - 1.5 / (d / 2)), 0]];
    const L = e(-w / 2 + 1.5), Rt = e(w / 2 - 1.5);
    g.add(meshFromTris([[L[0], L[1], [L[0][0], h - 0.4, 0]], [Rt[1], Rt[0], [Rt[0][0], h - 0.4, 0]]], doubleSided(endMat)));
  }
  if (trimMat) {
    g.add(beam([-w / 2, -0.35, d / 2], [w / 2, -0.35, d / 2], 0.25, 0.9, trimMat));
    g.add(beam([-w / 2, -0.35, -d / 2], [w / 2, -0.35, -d / 2], 0.25, 0.9, trimMat));
    if (inset === 0) for (const x of [-w / 2, w / 2]) {
      g.add(beam([x, -0.3, d / 2], [x, h - 0.3, 0], 0.9, 0.25, trimMat));
      g.add(beam([x, -0.3, -d / 2], [x, h - 0.3, 0], 0.9, 0.25, trimMat));
    }
  }
  return g;
}

function shedRoof(w, d, h, roofMat, wallMat, trimMat) {
  const g = new THREE.Group();
  const slab = box(w + 3, 0.8, Math.hypot(d + 3, h), roofMat);
  slab.position.set(0, h / 2, 0);
  slab.rotation.x = Math.atan2(h, d + 3); // front edge low, back edge high
  g.add(slab);
  const wm = doubleSided(wallMat);
  const L = [-w / 2, 0, d / 2], Lb = [-w / 2, 0, -d / 2], Lt = [-w / 2, h * (d / (d + 3)), -d / 2];
  const Rr = [w / 2, 0, d / 2], Rb = [w / 2, 0, -d / 2], Rt = [w / 2, h * (d / (d + 3)), -d / 2];
  g.add(meshFromTris([[L, Lb, Lt], [Rr, Rt, Rb], ...quad(Lb, Rb, Rt, Lt)], wm));
  // clerestory glass under the high side
  g.add(box(w - 2, h * 0.55, 0.3, GLASS, 0, h * 0.2, -d / 2 - 0.1));
  return g;
}

// One window: frame, glass, muntins, sill. Built facing +z at the origin.
function windowUnit(ww, wh, trimM, { big, shutterM } = {}) {
  const g = new THREE.Group();
  g.add(box(ww + 0.8, wh + 0.8, 0.35, trimM, 0, -0.4, 0.05));
  g.add(box(ww, wh, 0.4, GLASS, 0, 0, 0.1));
  const bar = 0.18;
  if (big) {
    const n = Math.max(1, Math.round(ww / 3.5));
    for (let i = 1; i < n; i++) g.add(box(bar, wh, 0.5, trimM, -ww / 2 + (ww / n) * i, 0, 0.12));
  } else {
    g.add(box(bar, wh, 0.5, trimM, 0, 0, 0.12));
    g.add(box(ww, bar, 0.5, trimM, 0, wh * 0.55, 0.12));
  }
  g.add(box(ww + 1.4, 0.3, 0.8, trimM, 0, -0.65, 0.3)); // sill
  if (shutterM) for (const s of [-1, 1]) {
    g.add(box(1.4, wh + 0.4, 0.25, shutterM, s * (ww / 2 + 1.2), -0.2, 0.15));
    for (let k = 0; k < 6; k++) g.add(box(1.2, 0.08, 0.3, shutterM, s * (ww / 2 + 1.2), wh * (k + 0.5) / 6 - 0.2, 0.2));
  }
  return g;
}

function addWindows(group, { w, d, y, h, trimM, big, shutterM, skipX }) {
  const ww = big ? 8 : 3, wh = big ? 6.5 : 4.8;
  const faces = [
    { len: w, place: (t) => [t, d / 2], rot: 0, front: true },
    { len: w, place: (t) => [-t, -d / 2], rot: Math.PI },
    { len: d, place: (t) => [w / 2, -t], rot: Math.PI / 2 },
    { len: d, place: (t) => [-w / 2, t], rot: -Math.PI / 2 },
  ];
  for (const f of faces) {
    const n = Math.max(1, Math.floor(f.len / (big ? 13 : 8)));
    for (let i = 0; i < n; i++) {
      const t = -f.len / 2 + (f.len / n) * (i + 0.5);
      if (f.front && skipX != null && Math.abs(t - skipX) < 4.5) continue;
      const [x, z] = f.place(t);
      const u = windowUnit(ww, wh, trimM, { big, shutterM: f.front ? shutterM : null });
      u.position.set(x, y + h * 0.28, z);
      u.rotation.y = f.rot;
      group.add(u);
    }
  }
}

function frontDoor(color, trimM) {
  const g = new THREE.Group();
  const doorM = paint(color);
  g.add(box(4.6, 8.3, 0.4, trimM, 0, 0, 0));
  g.add(box(3.4, 7.4, 0.5, doorM, 0, 0.1, 0.05));
  for (const [px, py] of [[-0.75, 0.8], [0.75, 0.8], [-0.75, 4.2], [0.75, 4.2]])
    g.add(box(1.1, 2.6, 0.56, surface('paint', color, { roughness: 0.5 }), px, py, 0.05));
  const knob = prepare(new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), new THREE.MeshStandardMaterial({ color: '#b08d57', metalness: 1, roughness: 0.3 })));
  knob.position.set(1.3, 3.6, 0.4);
  g.add(knob);
  g.add(box(5.4, 0.4, 2.2, surface('concrete'), 0, -0.4, 0.9)); // stoop
  return g;
}

// Foliage: a cluster of lumpy spheres with a leafy texture. The lumps come
// from a function of position, so shared vertices move together (no cracks).
const LEAF_COLORS = ['#6f9a4a', '#7fa856', '#5f8c40', '#86ad5c'];
function foliage(radius, rng, lumps = 6) {
  const g = new THREE.Group();
  for (let i = 0; i < lumps; i++) {
    const r = radius * (0.5 + rng() * 0.3);
    const geo = new THREE.SphereGeometry(r, 14, 10);
    const p = geo.attributes.position, ph = rng() * 10;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
      const n = 1 + 0.12 * Math.sin(x * 3.1 / r + ph) * Math.cos(z * 2.7 / r + ph) + 0.08 * Math.sin(y * 4.3 / r + ph * 2);
      p.setXYZ(k, x * n, y * n * 0.85, z * n);
    }
    geo.computeVertexNormals();
    const m = prepare(new THREE.Mesh(geo, surface('grass', LEAF_COLORS[Math.floor(rng() * LEAF_COLORS.length)])));
    const a = rng() * Math.PI * 2, dist = radius * 0.5 * rng();
    m.position.set(Math.cos(a) * dist, (rng() - 0.3) * radius * 0.6, Math.sin(a) * dist);
    g.add(m);
  }
  return g;
}
function tree(height, rng) {
  const g = new THREE.Group();
  const trunk = prepare(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.1, height * 0.5, 8), surface('matte', '#5b4636')));
  trunk.position.y = height * 0.25;
  g.add(trunk);
  const crown = foliage(height * 0.36, rng, 9);
  crown.position.y = height * 0.66;
  g.add(crown);
  return g;
}
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ---------- Room program & squarified treemap layout ----------

const BONUS_LABELS = { office: 'Office', gym: 'Gym', media: 'Media room', playroom: 'Playroom', library: 'Library',
  guest: 'Guest suite', mudroom: 'Mudroom', sunroom: 'Sunroom', wine: 'Wine cellar', craft: 'Craft room', workshop: 'Workshop' };
const BASEMENT_FRIENDLY = new Set(['gym', 'media', 'wine', 'workshop', 'playroom', 'craft']);

export function roomProgram(p) {
  const stories = Number(p.stories);
  const hasBasement = p.basement === 'finished' || p.basement === 'walkout';
  const floors = Array.from({ length: stories }, (_, i) => ({ name: i === 0 ? 'Main floor' : i === 1 ? 'Second floor' : 'Third floor', rooms: [] }));
  const basement = hasBasement ? { name: 'Basement', rooms: [] } : null;
  const main = floors[0], upper = floors[1] || floors[0];
  const top = floors[floors.length - 1];
  const open = p.floorPlan === 'open';

  main.rooms.push({ name: 'Entry', type: 'hall', w: 0.45 });
  main.rooms.push({ name: open ? 'Great room' : 'Living room', type: 'living', w: open ? 2.2 : 1.6, open });
  main.rooms.push({ name: 'Kitchen', type: 'kitchen', w: 1.2, open });
  if (!open || (p.livingFeatures || []).includes('formalDining')) main.rooms.push({ name: 'Dining', type: 'dining', w: 0.9, open: open && !(p.livingFeatures || []).includes('formalDining') });
  if ((p.kitchenFeatures || []).includes('pantry')) main.rooms.push({ name: 'Pantry', type: 'utility', w: 0.25 });
  main.rooms.push({ name: 'Laundry', type: 'utility', key: 'laundry', w: 0.35 });

  const full = Math.floor(p.bathrooms), half = p.bathrooms % 1 >= 0.5 ? 1 : 0;
  if (half) main.rooms.push({ name: 'Powder', type: 'bath', w: 0.25 });

  const primaryFloor = stories === 1 || p.primaryLocation === 'main' ? main : upper;
  primaryFloor.rooms.push({ name: 'Primary bedroom', type: 'bedroom', w: 1.4, primary: true });
  if (full >= 1) primaryFloor.rooms.push({ name: 'Primary bath', type: 'bath', w: 0.6, primary: true });
  if ((p.primaryFeatures || []).includes('walkin')) primaryFloor.rooms.push({ name: 'Walk-in closet', type: 'utility', w: 0.35 });

  const bedFloor = stories === 1 ? main : upper;
  for (let i = 2; i <= p.bedrooms; i++) bedFloor.rooms.push({ name: `Bedroom ${i}`, type: 'bedroom', w: 0.95 });
  let bathsLeft = full - 1;
  const bathFloors = stories > 1 ? [bedFloor, ...floors.filter((f) => f !== bedFloor)] : [main];
  for (let i = 0; bathsLeft > 0; i++, bathsLeft--) bathFloors[i % bathFloors.length].rooms.push({ name: 'Bath', type: 'bath', w: 0.4 });

  for (const b of p.bonusRooms || []) {
    const room = { name: BONUS_LABELS[b], type: 'bonus', key: b, w: b === 'mudroom' ? 0.35 : 0.8 };
    if (basement && BASEMENT_FRIENDLY.has(b)) basement.rooms.push(room);
    else if (b === 'office' || b === 'mudroom' || b === 'sunroom' || stories === 1) main.rooms.push(room);
    else top.rooms.push(room);
  }
  if (basement) {
    basement.rooms.push({ name: 'Rec room', type: 'living', w: 1.6 });
    basement.rooms.push({ name: 'Storage', type: 'utility', w: 0.5 });
  }
  // Keep upper floors from being nearly empty.
  for (const f of floors) if (f.rooms.length < 2) f.rooms.push({ name: 'Loft', type: 'bonus', w: 1 });
  return basement ? [basement, ...floors] : floors;
}

function squarify(items, x, y, w, h) {
  const total = items.reduce((s, i) => s + i.w, 0);
  const scale = (w * h) / total;
  const rest = items.map((i) => ({ ...i, area: i.w * scale })).sort((a, b) => b.area - a.area);
  const out = [];
  const worst = (row, side) => {
    const s = row.reduce((a, r) => a + r.area, 0);
    return Math.max(...row.map((r) => Math.max((side * side * r.area) / (s * s), (s * s) / (side * side * r.area))));
  };
  let row = [];
  while (rest.length) {
    const side = Math.min(w, h);
    const next = rest[0];
    if (!row.length || worst([...row, next], side) <= worst(row, side)) { row.push(rest.shift()); continue; }
    ({ x, y, w, h } = layoutRow(row, x, y, w, h, out));
    row = [];
  }
  if (row.length) layoutRow(row, x, y, w, h, out);
  return out;
}
function layoutRow(row, x, y, w, h, out) {
  const s = row.reduce((a, r) => a + r.area, 0);
  if (w >= h) {
    const rw = s / h; let cy = y;
    for (const r of row) { const rh = r.area / rw; out.push({ ...r, x, y: cy, w: rw, h: rh }); cy += rh; }
    return { x: x + rw, y, w: w - rw, h };
  }
  const rh = s / w; let cx = x;
  for (const r of row) { const rw = r.area / rh; out.push({ ...r, x: cx, y, w: rw, h: rh }); cx += rw; }
  return { x, y: y + rh, w, h: h - rh };
}

// ---------- Viewer ----------

const LIGHT_TRIMS = new Set(['#ffffff', '#efe9dc', '#f1e6d2', '#f4efe6', '#f5efe3', '#f2ede4', '#ece6d6']);

// Time-of-day presets. sun: direction the light comes from (relative to the house).
export const LIGHTING = {
  day:    { label: 'Day', sun: [-95, 125, 85], color: '#fff3e0', intensity: 2.6, env: 1, bg: 1.15, exposure: 0.85, glass: 0, bulb: 0.2, lamps: 0, fog: '#c9d6e0' },
  golden: { label: 'Golden hour', sun: [160, 38, 30], color: '#ffad5e', intensity: 3.4, env: 0.55, bg: 0.7, exposure: 0.95, glass: 0.35, bulb: 1, lamps: 0.3, fog: '#d6bfa3' },
  dusk:   { label: 'Dusk', sun: [-150, 22, 70], color: '#ff9468', intensity: 0.45, env: 0.14, bg: 0.16, exposure: 1.25, glass: 1.6, bulb: 4, lamps: 1, fog: '#262c3b' },
};

const VIEWS = {
  exterior: {
    corner: (c, r) => [c.x + r * 0.75, r * 0.42, c.z + r * 1.35],
    front:  (c, r, lot) => [c.x, 7, Math.min(c.z + r * 1.55, lot / 2 + 16)], // standing in the street
    aerial: (c, r) => [c.x + r * 0.55, r * 1.35, c.z + r * 0.95],
    back:   (c, r) => [c.x - r * 0.85, r * 0.45, c.z - r * 1.3],
  },
  plan: {
    dollhouse: (c, r) => [c.x + r * 0.12, r * 0.88, c.z + r * 0.8],
    top:       (c, r) => [c.x, r * 1.75, c.z + 0.01],
  },
};

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export class HouseViewer {
  // options.ao: screen-space ambient occlusion (soft contact shadows). Costs GPU time.
  constructor(container, { ao = true } = {}) {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.85;
    setMaxAnisotropy(r.capabilities.getMaxAnisotropy());

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#c9d9e6');
    this.scene.fog = new THREE.Fog('#c9d6e0', 380, 1300);
    this.camera = new THREE.PerspectiveCamera(38, 1, 1, 2600);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.maxDistance = 650;
    this.controls.minDistance = 12;
    this.controls.autoRotateSpeed = 0.5;
    this.controls.addEventListener('start', () => { this.tween = null; if (this.stopRotateOnTouch) this.setAutoRotate(false); });

    this.hemi = new THREE.HemisphereLight('#ffffff', '#6f7d5c', 1.2);
    this.scene.add(this.hemi);
    this.loadSky();

    const sun = this.sun = new THREE.DirectionalLight('#fff3e0', 2.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun, sun.target);

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.lamps = [];
    this.labels = [];
    this.mode = 'exterior';
    this.view = 'corner';
    this.floorIndex = 0;
    this.lighting = 'day';
    this.showLabels = true;

    // Post-processing: render → ambient occlusion → tone mapping/output.
    this.ao = ao;
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(r, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.gtao = new GTAOPass(this.scene, this.camera, 1, 1);
    this.gtao.updateGtaoMaterial({ radius: 3.5, distanceExponent: 1.5, thickness: 2.5, scale: 1.1, samples: 16, distanceFallOff: 1 });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    this.gtao.blendIntensity = 0.9;
    this.composer.addPass(this.gtao);
    this.composer.addPass(new OutputPass());

    this.attach(container);
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      if (!this.container?.isConnected) return; // keep the loop cheap while hidden
      this.stepTween();
      this.controls.update();
      if (this.ao) this.composer.render(); else r.render(this.scene, this.camera);
      this.updateLabels();
    };
    loop();
  }

  // Move the canvas into another element (the app reuses one viewer for the
  // interview preview and the results page).
  attach(container) {
    this.container = container;
    container.classList.add('viewer-host');
    if (!this.labelLayer) { this.labelLayer = document.createElement('div'); this.labelLayer.className = 'viewer-labels'; }
    container.append(this.renderer.domElement, this.labelLayer);
    this.ro?.disconnect();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
  }

  loadSky() {
    const r = this.renderer;
    const pmrem = new THREE.PMREMGenerator(r);
    // The .hdr bytes are stored base64 in JSON so static hosts that only serve
    // common web file types can still deliver them.
    fetch('assets/textures/sky.hdr.json').then((res) => res.json()).then(({ base64 }) => {
      const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
      const d = new RGBELoader().parse(bytes.buffer);
      const hdr = new THREE.DataTexture(d.data, d.width, d.height, THREE.RGBAFormat, d.type);
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      hdr.colorSpace = THREE.LinearSRGBColorSpace;
      hdr.minFilter = hdr.magFilter = THREE.LinearFilter;
      hdr.generateMipmaps = false; hdr.flipY = true; hdr.needsUpdate = true;
      this.scene.environment = pmrem.fromEquirectangular(hdr).texture;
      hdr.dispose(); pmrem.dispose();
      this.skyReady = true;
      this.applyLighting();
    }).catch((e) => console.warn('sky HDR not loaded', e));
    new THREE.TextureLoader().load('assets/textures/sky.jpg', (t) => {
      t.mapping = THREE.EquirectangularReflectionMapping;
      t.colorSpace = THREE.SRGBColorSpace;
      this.scene.background = t;
      this.applyLighting();
    });
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    // Keep the horizontal field of view of a 38° camera at 1.5:1, so narrow
    // viewers (the interview preview, phones) still fit the whole house.
    const hTan = Math.tan(THREE.MathUtils.degToRad(19)) * 1.5;
    this.camera.fov = Math.min(70, Math.max(38, THREE.MathUtils.radToDeg(2 * Math.atan(hTan / this.camera.aspect))));
    this.camera.updateProjectionMatrix();
  }

  setAO(on) { this.ao = on; }
  setAutoRotate(on) { this.controls.autoRotate = on; }

  setLighting(name) {
    if (!LIGHTING[name]) return;
    this.lighting = name;
    this.applyLighting();
  }

  // Interior views always use daylight so rooms are readable.
  applyLighting() {
    const L = LIGHTING[this.mode === 'plan' ? 'day' : this.lighting];
    const center = this.bounds ? this.bounds.getCenter(new THREE.Vector3()) : new THREE.Vector3();
    this.sun.color.set(L.color);
    this.sun.intensity = L.intensity;
    this.sun.position.copy(center).add(new THREE.Vector3(...L.sun));
    this.sun.target.position.copy(center);
    setEnvIntensity(L.env);
    this.scene.backgroundIntensity = L.bg;
    this.renderer.toneMappingExposure = L.exposure;
    this.scene.fog.color.set(L.fog);
    this.hemi.intensity = this.skyReady ? 0.15 * L.env : 1.2;
    GLASS.emissiveIntensity = L.glass;
    BULB.emissiveIntensity = L.bulb;
    for (const l of this.lamps) l.intensity = l.userData.full * L.lamps;
  }

  clear() {
    // Materials and textures are cached and shared, so only geometry is freed.
    this.root.traverse((o) => o.geometry?.dispose());
    this.root.clear();
    this.lamps = [];
    this.labels = [];
    this.labelLayer.replaceChildren();
  }

  // keepCamera: glide to the new framing instead of jumping (used by the live
  // preview, which rebuilds on every answer).
  build(profile, { keepCamera = false } = {}) {
    this.profile = profile;
    this.floors = roomProgram(profile);
    if (this.floorIndex >= this.floors.length) this.floorIndex = 0;
    this.render(keepCamera);
  }

  setMode(mode, floorIndex = this.floorIndex) {
    const changed = mode !== this.mode;
    this.mode = mode; this.floorIndex = floorIndex;
    if (changed) this.view = mode === 'plan' ? 'dollhouse' : 'corner';
    this.render(true);
  }

  setView(view) {
    this.view = view;
    this.frame(true);
  }

  dims() {
    const p = this.profile;
    const s = EXTERIOR_STYLES[p.exteriorStyle];
    const stories = Number(p.stories);
    const sqft = (p.sqft[0] + p.sqft[1]) / 2;
    const area = sqft / stories;
    const aspect = s.aspect || 1.6;
    const w = Math.sqrt(area * aspect), d = area / w;
    const wallH = p.ceilings === '10' ? 11 : p.ceilings === 'vaulted' ? 12 : 10;
    return { w, d, stories, wallH, style: s };
  }

  render(smooth = false) {
    this.clear();
    if (!this.profile) return;
    this.addGround();
    if (this.mode === 'exterior') this.buildExterior();
    else this.buildPlan(this.floors[this.floorIndex]);
    this.applyLighting();
    this.frame(smooth);
  }

  // Point the camera at the house for the current view preset.
  frame(smooth) {
    const { w, d } = this.dims();
    const center = this.bounds.getCenter(new THREE.Vector3());
    const size = this.bounds.getSize(new THREE.Vector3());
    const r = Math.max(size.x, size.z, w, d);
    center.y = this.mode === 'exterior' ? size.y * 0.35 : 0;
    const views = VIEWS[this.mode];
    const pos = new THREE.Vector3(...(views[this.view] || Object.values(views)[0])(center, r, this.lotSide));
    if (smooth) this.tween = { t0: performance.now(), dur: 700, fromPos: this.camera.position.clone(), fromTarget: this.controls.target.clone(), toPos: pos, toTarget: center };
    else { this.tween = null; this.camera.position.copy(pos); this.controls.target.copy(center); this.controls.update(); }
    // Fit the shadow camera to the scene for sharp shadows.
    const sc = this.sun.shadow.camera, ext = Math.max(r * 1.6, this.lotSide * 0.75);
    Object.assign(sc, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 700 });
    sc.updateProjectionMatrix();
  }

  stepTween() {
    const t = this.tween;
    if (!t) return;
    const k = Math.min(1, (performance.now() - t.t0) / t.dur), e = ease(k);
    this.camera.position.lerpVectors(t.fromPos, t.toPos, e);
    this.controls.target.lerpVectors(t.fromTarget, t.toTarget, e);
    if (k === 1) this.tween = null;
  }

  addLabel(text, pos, cls = '') {
    const el = document.createElement('div');
    el.className = 'viewer-label ' + cls;
    el.textContent = text;
    this.labelLayer.append(el);
    this.labels.push({ el, pos: new THREE.Vector3(...pos) });
  }

  updateLabels() {
    const show = this.showLabels && this.mode === 'plan';
    this.labelLayer.hidden = !show;
    if (!show || !this.labels.length) return;
    const { clientWidth: w, clientHeight: h } = this.container;
    const v = new THREE.Vector3();
    for (const l of this.labels) {
      v.copy(l.pos).project(this.camera);
      const off = v.z > 1;
      l.el.style.visibility = off ? 'hidden' : '';
      l.el.style.transform = `translate(-50%, -50%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
    }
  }

  addLamp(x, y, z, full = 140, distance = 45) {
    const l = new THREE.PointLight('#ffcf8a', 0, distance, 2);
    l.userData.full = full;
    l.position.set(x, y, z);
    this.lamps.push(l);
    return l;
  }

  addGround() {
    const p = this.profile;
    this.lotSide = { any: 140, small: 100, quarter: 140, half: 190, acre: 260 }[p.lot] || 140;
    const ground = prepare(new THREE.Mesh(new THREE.CircleGeometry(1400, 48), surface('grass', '#a8cc78')));
    ground.rotation.x = -Math.PI / 2;
    this.root.add(ground);
  }

  colors() {
    const p = this.profile;
    const s = EXTERIOR_STYLES[p.exteriorStyle];
    const pal = EXTERIOR_PALETTES[p.exteriorPalette]?.colors;
    return { body: s.body, trim: s.trim, roofColor: s.roofColor, accent: s.accent, shutters: s.shutters, ...(pal || {}) };
  }

  // Wall material from the chosen siding, tinted with the color scheme.
  wallMaterial(color, story) {
    const p = this.profile;
    if (p.exteriorPalette === 'brick') return surface('brick');
    switch (p.siding) {
      case 'brick': return surface('brick');
      case 'stone': return surface('stone');
      case 'stucco': return surface('stucco', color);
      case 'batten': return surface('batten', color);
      case 'wood': return surface('wood');
      case 'mixed': return story === 0 ? surface('stone') : surface('siding', color);
    }
    const style = this.profile.exteriorStyle;
    if (style === 'mediterranean') return surface('stucco', color);
    if (style === 'farmhouse') return surface('batten', color);
    if (style === 'modern') return surface('stucco', color);
    if (style === 'midcentury') return surface('wood');
    return surface('siding', color);
  }

  roofMaterial(color) {
    switch (this.profile.roofMaterial) {
      case 'metal': return surface('metal_roof', color);
      case 'tile': return surface('clay_tile', '#e8946c');
      case 'slate': return surface('slate');
    }
    if (this.profile.exteriorStyle === 'mediterranean') return surface('clay_tile', '#e8946c');
    return surface('shingles', color);
  }
  buildExterior() {
    const p = this.profile;
    const { w, d, stories, wallH, style: s } = this.dims();
    const c = this.colors();
    const g = new THREE.Group();
    const trimM = paint(c.trim);
    const roofM = this.roofMaterial(c.roofColor);
    const bodyM = this.wallMaterial(c.body, 0);
    const lapLike = ['siding', 'batten', 'wood', 'mixed'].includes(p.siding) || !['brick', 'stone', 'stucco'].includes(p.siding);
    const H = wallH * stories;
    const doorX = s.bigWindows ? w * 0.15 : 0;
    const rng = seeded(w * 1000 + d);

    // foundation + walls
    g.add(box(w + 0.6, 1.5, d + 0.6, surface('concrete')));
    for (let i = 0; i < stories; i++) {
      const accent = s.accent && !EXTERIOR_PALETTES[p.exteriorPalette]?.colors && i === 1;
      const m = accent ? surface('stucco', s.accent) : this.wallMaterial(c.body, i);
      g.add(box(w, wallH, d, m, 0, 1.5 + i * wallH));
      addWindows(g, { w, d, y: 1.5 + i * wallH, h: wallH, trimM, big: s.bigWindows, shutterM: c.shutters ? paint(c.shutters) : null, skipX: i === 0 ? doorX : null });
      if (i > 0) g.add(box(w + 0.5, 0.7, d + 0.5, trimM, 0, 1.5 + i * wallH - 0.35));
    }
    if (lapLike) for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])
      g.add(box(0.7, H, 0.7, trimM, x * (w / 2), 1.5, z * (d / 2)));
    if (s.halfTimber && stories > 1) {
      for (let x = -w / 2; x <= w / 2 + 0.1; x += w / 8) g.add(box(0.7, wallH, 0.35, trimM, x, 1.5 + wallH, d / 2 + 0.1));
      for (let x = -w / 2; x < w / 2 - 0.1; x += w / 4) g.add(beam([x, 1.5 + wallH, d / 2 + 0.15], [x + w / 8, 1.5 + 2 * wallH, d / 2 + 0.15], 0.6, 0.3, trimM));
    }
    const door = frontDoor(LIGHT_TRIMS.has(c.trim) ? '#4a2f22' : c.trim, trimM);
    door.position.set(doorX, 1.5, d / 2 + 0.05);
    g.add(door);
    // porch light beside the door
    g.add(box(0.5, 0.9, 0.4, paint('#222222'), doorX + 3, 7.6, d / 2 + 0.3));
    g.add(box(0.36, 0.6, 0.3, BULB, doorX + 3, 7.75, d / 2 + 0.45));
    g.add(this.addLamp(doorX + 3, 8.4, d / 2 + 2.5, 90, 35));

    // roof
    const top = 1.5 + H;
    const ow = w + 3, od = d + 3;
    const pitch = { 'gable-low': 0.33, gable: 0.5, 'gable-steep': 0.85, 'hip-low': 0.33 }[s.roof] ?? 0.5;
    let roof;
    if (s.roof === 'flat') {
      roof = new THREE.Group();
      roof.add(box(w + 2.5, 1, d + 2.5, surface('concrete', '#6b6b6b')));
      roof.add(box(w + 2.6, 1.6, 0.4, trimM, 0, 0, (d + 2.5) / 2));
      roof.add(box(w + 2.6, 1.6, 0.4, trimM, 0, 0, -(d + 2.5) / 2));
    } else if (s.roof === 'shed') {
      roof = shedRoof(w, d, d * 0.22, roofM, this.wallMaterial(c.body, 1), trimM);
    } else {
      roof = pitchedRoof(ow, od, (od / 2) * pitch, s.roof.startsWith('hip') ? od / 2 : 0, roofM, bodyM, trimM);
    }
    roof.position.y = top;
    g.add(roof);

    if (s.dormers) {
      const rh = (od / 2) * pitch;
      for (const x of [-w / 4, w / 4]) {
        const dm = new THREE.Group();
        dm.add(box(5.5, 5.5, 7, this.wallMaterial(c.body, 1), 0, 0, 0));
        const wu = windowUnit(2.6, 3.2, trimM); wu.position.set(0, 1.2, 3.5); dm.add(wu);
        const dr = pitchedRoof(8, 7, 2.8, 0, roofM, this.wallMaterial(c.body, 1), trimM);
        dr.rotation.y = Math.PI / 2; dr.position.y = 5.5; dm.add(dr);
        dm.position.set(x, top + rh * 0.3, od / 4 - 0.5);
        g.add(dm);
      }
    }
    if (s.turret) {
      const tr = 5.5, th = H + 6;
      const cyl = prepare(new THREE.Mesh(new THREE.CylinderGeometry(tr, tr, th, 32), this.wallMaterial(c.body, 1)));
      cyl.position.set(-w / 2, 1.5 + th / 2, d / 2); g.add(cyl);
      const cone = prepare(new THREE.Mesh(new THREE.ConeGeometry(tr + 1.2, 13, 32), roofM));
      cone.position.set(-w / 2, 1.5 + th + 6.5, d / 2); g.add(cone);
      for (let i = 0; i < stories; i++) {
        const wu = windowUnit(2.4, 4.2, trimM);
        wu.position.set(-w / 2 - 1.5, 1.5 + i * wallH + 3, d / 2 + tr + 0.05);
        g.add(wu);
      }
    }
    if ((p.livingFeatures || []).includes('fireplace')) {
      const chH = top + (od / 2) * pitch + 4;
      g.add(box(4, chH, 3.2, surface('brick'), -w / 2 - 0.6, 0, -d / 6));
      g.add(box(4.6, 0.5, 3.8, surface('concrete'), -w / 2 - 0.6, chH, -d / 6));
    }

    // porch
    const porch = p.porch === 'style' ? s.porch : p.porch === 'none' ? null : p.porch;
    if (porch) {
      const pd = 8, pw = porch === 'wrap' ? w + 2 : Math.min(w * 0.6, 30);
      const floorM = surface('deck');
      const colM = paint(c.trim === '#1f1f1f' ? '#1f1f1f' : '#f4f1ea');
      g.add(box(pw, 1.5, pd, floorM, 0, 0, d / 2 + pd / 2));
      g.add(box(pw + 1, 0.6, pd + 1, roofM, 0, 1.5 + wallH - 1, d / 2 + pd / 2));
      g.add(box(pw + 1.2, 0.8, 0.3, trimM, 0, 1.5 + wallH - 1.2, d / 2 + pd + 0.5));
      const n = Math.max(2, Math.round(pw / 8));
      const colX = [];
      for (let i = 0; i <= n; i++) colX.push(-pw / 2 + 0.5 + (pw - 1) * (i / n));
      for (const x of colX) g.add(box(0.8, wallH - 1, 0.8, colM, x, 1.5, d / 2 + pd - 0.5));
      // railings between columns, leaving a gap at the steps
      for (let i = 0; i < colX.length - 1; i++) {
        const mid = (colX[i] + colX[i + 1]) / 2;
        if (Math.abs(mid - doorX) < 4) continue;
        g.add(box(colX[i + 1] - colX[i], 0.25, 0.3, colM, mid, 4.3, d / 2 + pd - 0.5));
        for (let x = colX[i] + 0.6; x < colX[i + 1] - 0.3; x += 0.6) g.add(box(0.12, 2.6, 0.12, colM, x, 1.5, d / 2 + pd - 0.5));
      }
      g.add(box(5, 0.75, 1.4, surface('concrete'), doorX, 0, d / 2 + pd + 0.7));
      if (porch === 'wrap') {
        g.add(box(pd, 1.5, d, floorM, -w / 2 - pd / 2 - 1, 0, 0));
        g.add(box(pd + 1, 0.6, d + pd, roofM, -w / 2 - pd / 2 - 1, 1.5 + wallH - 1, pd / 2));
        for (let i = 0; i <= 3; i++) g.add(box(0.8, wallH - 1, 0.8, colM, -w / 2 - pd - 0.5, 1.5, -d / 2 + 0.5 + (d - 1) * (i / 3)));
      }
    } else {
      g.add(box(5.4, 0.75, 2.5, surface('concrete'), doorX, 0, d / 2 + 1.3));
    }

    // garage
    const spaces = Number(p.garage);
    let gx = null, gw = 0;
    if (spaces > 0) {
      gw = 11 * spaces + 2;
      const gd = 22, gh = 10;
      gx = w / 2 + gw / 2;
      g.add(box(gw, 1, gd, surface('concrete'), gx, 0, d / 2 - gd / 2));
      g.add(box(gw, gh, gd, bodyM, gx, 1, d / 2 - gd / 2));
      const gr = s.roof === 'flat' || s.roof === 'shed'
        ? box(gw + 2, 1, gd + 2, s.roof === 'flat' ? surface('concrete', '#6b6b6b') : roofM)
        : pitchedRoof(gw + 2, gd + 2, ((gd + 2) / 2) * Math.min(pitch, 0.5), s.roof.startsWith('hip') ? (gd + 2) / 2 : 0, roofM, bodyM, trimM);
      gr.position.set(gx, gh + 1, d / 2 - gd / 2);
      g.add(gr);
      const dark = c.trim === '#222222' || c.trim === '#1f1f1f';
      const doorM = paint(dark ? '#353535' : '#f1efea');
      const grooveM = paint(dark ? '#252525' : '#d9d6cf');
      for (let i = 0; i < spaces; i++) {
        const dx = gx - gw / 2 + 1 + 11 * i + 5.5;
        g.add(box(9.6, 8, 0.3, trimM, dx, 1, d / 2 + 0.05));
        g.add(box(9, 7.6, 0.4, doorM, dx, 1, d / 2 + 0.1));
        for (let k = 1; k < 4; k++) g.add(box(9, 0.12, 0.45, grooveM, dx, 1 + k * 1.9, d / 2 + 0.12));
        for (let k = 0; k < 4; k++) g.add(box(1.8, 0.9, 0.45, GLASS, dx - 3.3 + k * 2.2, 1 + 6.2, d / 2 + 0.12));
      }
      const driveLen = this.lotSide / 2 + 7 - d / 2; // out to the street
      const drive = prepare(new THREE.Mesh(new THREE.PlaneGeometry(gw, driveLen), surface('concrete')));
      drive.rotation.x = -Math.PI / 2;
      drive.position.set(gx, 0.05, d / 2 + driveLen / 2);
      drive.userData.yard = true;
      g.add(drive);
    }
    this.bounds = new THREE.Box3();
    for (const child of g.children) if (!child.userData.yard) this.bounds.expandByObject(child);

    // walkway
    const walkLen = this.lotSide / 2 + 1 - d / 2 - (porch ? 8 : 2);
    const walk = prepare(new THREE.Mesh(new THREE.PlaneGeometry(4, walkLen), surface('pavers')));
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(doorX, 0.06, this.lotSide / 2 + 1 - walkLen / 2);
    g.add(walk);
    // path lights along the walk
    for (const t of [0.3, 0.75]) for (const side of [-1, 1]) {
      const z = this.lotSide / 2 + 1 - walkLen * t;
      g.add(box(0.35, 2, 0.35, paint('#2a2a2a'), doorX + side * 3, 0, z));
      g.add(box(0.45, 0.35, 0.45, BULB, doorX + side * 3, 2, z));
      if (side === 1) g.add(this.addLamp(doorX, 2.5, z, 25, 14));
    }

    // foundation shrubs
    for (let x = -w / 2 + 3; x < w / 2 - 2; x += 5.5) {
      if (Math.abs(x - doorX) < 5) continue;
      const sh = foliage(1.8 + rng() * 0.8, rng, 4);
      sh.position.set(x, 1.4, d / 2 + (porch ? 9.8 : 2.4));
      g.add(sh);
    }

    // backyard
    const of = new Set(p.outdoorFeatures || []);
    const backZ = -d / 2;
    if (of.has('deck')) {
      const dw = Math.min(w * 0.6, 28);
      g.add(box(dw, 2, 12, surface('deck'), -w * 0.1, 0, backZ - 6));
      for (const x of [-dw / 2, dw / 2]) g.add(box(0.4, 3, 0.4, paint('#f2efe8'), -w * 0.1 + x, 2, backZ - 12));
      g.add(box(dw, 0.3, 0.3, paint('#f2efe8'), -w * 0.1, 4.8, backZ - 12));
    } else if (of.has('patio')) {
      g.add(box(Math.min(w * 0.6, 28), 0.35, 14, surface('pavers'), -w * 0.1, 0, backZ - 7));
    }
    if (of.has('pool')) {
      const px = w * 0.15, pz = backZ - 36;
      g.add(box(24, 0.4, 40, surface('pavers'), px, 0, pz));
      g.add(box(16.2, 0.45, 32.2, surface('tile', '#9fd3e6'), px, 0, pz));
      const water = new THREE.Mesh(new THREE.PlaneGeometry(16, 32), WATER);
      water.rotation.x = -Math.PI / 2; water.position.set(px, 0.42, pz);
      g.add(water);
    }
    if (of.has('hottub')) {
      const tub = prepare(new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 2.8, 24), surface('deck')));
      tub.position.set(-w * 0.4, 1.4, backZ - 22); g.add(tub);
      const tw = new THREE.Mesh(new THREE.CircleGeometry(3.1, 24), WATER);
      tw.rotation.x = -Math.PI / 2; tw.position.set(-w * 0.4, 2.82, backZ - 22); g.add(tw);
    }
    if (of.has('outdoorKitchen')) {
      g.add(box(10, 3, 2.6, surface('stone'), -w * 0.3, 0, backZ - 10));
      g.add(box(10.4, 0.25, 3, surface('concrete', '#cfcfcf'), -w * 0.3, 3, backZ - 10));
    }
    if (of.has('garden')) for (let i = 0; i < 3; i++) {
      const gx0 = -this.lotSide / 2 + 10 + i * 7, gz0 = -this.lotSide / 2 + 14;
      g.add(box(4, 1.2, 10, surface('wood'), gx0, 0, gz0));
      for (let k = 0; k < 4; k++) { const f = foliage(0.9, rng, 3); f.position.set(gx0, 1.6, gz0 - 3.6 + k * 2.4); g.add(f); }
    }
    if (of.has('fence')) {
      const fm = surface('wood'), L = this.lotSide / 2 - 1;
      g.add(box(this.lotSide - 2, 6, 0.3, fm, 0, 0, -L));
      g.add(box(0.3, 6, L + backZ, fm, -L, 0, (-L + backZ) / 2));
      g.add(box(0.3, 6, L + backZ, fm, L, 0, (-L + backZ) / 2));
    }

    // trees
    for (const [tx, tz, hgt] of [[-0.47, 0.2, 34], [0.43, -0.4, 40], [-0.4, -0.38, 30], [-0.1, -0.47, 36], [-0.46, 0.05, 28], [0.47, 0.05, 32]]) {
      const x = tx * this.lotSide, z = tz * this.lotSide;
      if (gx != null && Math.abs(x - gx) < gw / 2 + 8 && z > 0) continue; // keep the driveway clear
      const t = tree(hgt * (0.85 + rng() * 0.3), rng);
      t.position.set(x, 0, z);
      g.add(t);
    }
    this.addStreet(g, rng, { gx, gw, doorX });
    this.root.add(g);
  }

  // Sidewalk, street, a street light, a mailbox, neighboring houses and trees,
  // so the house sits in a neighborhood rather than on an empty lawn.
  addStreet(g, rng, { gx, gw, doorX }) {
    const z0 = this.lotSide / 2;
    const yard = (m) => { m.userData.yard = true; g.add(m); return m; };
    const flat = (w, len, mat, x, y, z) => {
      const m = prepare(new THREE.Mesh(new THREE.PlaneGeometry(w, len), mat));
      m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); return yard(m);
    };
    const span = 1100;
    flat(span, 5, surface('concrete', '#d9d6d0'), 0, 0.08, z0 + 3.5);              // sidewalk
    yard(box(span, 0.5, 0.6, surface('concrete', '#cfccc6'), 0, 0, z0 + 6.3));      // curb
    flat(span, 26, surface('concrete', '#5d6063'), 0, 0.04, z0 + 19.6);            // road
    for (let x = -span / 2; x < span / 2; x += 14) flat(6, 0.4, paint('#e8c547'), x, 0.07, z0 + 19.6);
    // street light
    const lx = doorX - 34;
    yard(box(0.6, 18, 0.6, paint('#3a3d40'), lx, 0, z0 + 7.5));
    yard(box(0.4, 0.4, 5, paint('#3a3d40'), lx, 17.6, z0 + 9.8));
    yard(box(1.6, 0.4, 2.2, BULB, lx, 17.2, z0 + 11.8));
    yard(this.addLamp(lx, 16.5, z0 + 11.8, 900, 90));
    // mailbox at the end of the driveway (or the walk)
    const mx = gx != null ? gx - gw / 2 - 2.5 : doorX + 5;
    yard(box(0.4, 3.6, 0.4, paint('#4a3a2c'), mx, 0, z0 + 0.6));
    yard(box(1.1, 1, 1.8, paint('#2b2e33'), mx, 3.6, z0 + 0.6));

    // neighbors: two on each side, three across the street
    const bodies = ['#d8d3c8', '#a9b4ba', '#c9b9a0', '#8f9a86', '#e6e2da', '#b7a593'];
    const neighbor = (x, z, facing, i) => {
      const nw = 38 + rng() * 12, nd = 30, nh = 19 + (i % 2) * 2;
      const n = new THREE.Group();
      n.add(box(nw, nh, nd, surface('siding', bodies[i % bodies.length])));
      const rf = pitchedRoof(nw + 3, nd + 3, (nd + 3) * 0.28, i % 3 === 0 ? (nd + 3) / 2 : 0, surface('shingles', '#4a4744'), surface('siding', bodies[i % bodies.length]), paint('#f2efe8'));
      rf.position.y = nh; n.add(rf);
      for (let k = 0; k < 3; k++) for (const y of [3.5, 13]) n.add(box(3.2, 4.4, 0.5, GLASS, -nw / 3 + k * (nw / 3), y, nd / 2));
      n.add(box(3.4, 7.2, 0.5, paint('#5a3b2c'), nw * 0.18, 0, nd / 2));
      n.position.set(x, 0, z);
      n.rotation.y = facing;
      yard(n);
      const t = tree(30 + rng() * 10, rng); t.position.set(x + nw / 2 + 8, 0, z + (facing ? -10 : 10)); yard(t);
    };
    const side = this.lotSide / 2 + 32;
    neighbor(-side - 10, -4, 0, 0); neighbor(-side - 100, -2, 0, 1);
    neighbor(side + 10 + (gw || 0) * 0.5, -4, 0, 2); neighbor(side + 100 + (gw || 0) * 0.5, -6, 0, 3);
    for (let i = 0; i < 3; i++) neighbor((i - 1) * 95, z0 + 33 + 45, Math.PI, 4 + i);
  }

  // ---------- Interior "dollhouse" view ----------
  // Rooms come from a treemap, so every interior edge is the right/bottom edge
  // of one room and the left/top edge of another. Walls are built per shared
  // edge (one coat of paint per side), with a doorway in each.
  buildPlan(floor) {
    const p = this.profile;
    const { w, d } = this.dims();
    const rooms = squarify(floor.rooms, -w / 2, -d / 2, w, d);
    const g = new THREE.Group();
    const WALL_H = 8, T = 0.22, EPS = 0.05;
    g.add(box(w + 1.4, 0.6, d + 1.4, surface('concrete'), 0, -0.6));

    const styleFor = (r) => {
      const key = r.type === 'kitchen' ? roomStyle(p, 'kitchenStyle')
        : r.type === 'bedroom' ? roomStyle(p, 'bedroomStyle')
        : r.type === 'bath' ? roomStyle(p, 'bathroomStyle')
        : r.type === 'bonus' ? roomStyle(p, 'bonusStyle') : p.interiorStyle;
      return INTERIOR_STYLES[key] || INTERIOR_STYLES.modern;
    };
    const floorMat = (r, st) => {
      if (r.type === 'bath') return surface('tile');
      if (r.type === 'utility') return surface('concrete', '#e2ded8');
      if (p.flooring === 'tile' && r.type !== 'bedroom') return surface('tile', '#efece6');
      if (p.flooring === 'concrete') return surface('concrete', '#d8d4ce');
      return surface('wood_floor', st.floor);
    };
    for (const r of rooms) r.style = styleFor(r);

    // A wall run along x (axis 'x') or z, from a to b at the fixed coordinate c,
    // with optional door gap [g0, g1]. side colors: [-side material, +side material].
    const wallRun = (axis, c, a, b, mats, gap) => {
      const pieces = gap ? [[a, gap[0]], [gap[1], b]] : [[a, b]];
      for (const [s0, s1] of pieces) {
        const len = s1 - s0; if (len < 0.1) continue;
        const mid = (s0 + s1) / 2;
        mats.forEach((m, k) => {
          const off = (k === 0 ? -1 : 1) * T / 2;
          if (axis === 'x') g.add(box(len, WALL_H, T, m, mid, 0, c + off));
          else g.add(box(T, WALL_H, len, m, c + off, 0, mid));
        });
      }
      if (gap) { // header over the doorway
        const mid = (gap[0] + gap[1]) / 2, len = gap[1] - gap[0];
        if (axis === 'x') g.add(box(len, 1, T * 2, mats[0], mid, 7, c)); else g.add(box(T * 2, 1, len, mats[0], c, 7, mid));
      }
    };
    const doorGap = (a, b, wide) => {
      const len = b - a, dw = wide ? Math.min(6, len - 1) : 3;
      if (len < dw + 1.2) return len >= 3.4 ? [a + (len - 3) / 2, a + (len + 3) / 2] : null;
      const start = len >= 8 ? a + 1.5 : a + (len - dw) / 2;
      return [start, start + dw];
    };

    // interior walls
    for (const r of rooms) {
      for (const n of rooms) {
        if (n === r) continue;
        // r's right edge against n's left edge
        if (Math.abs(r.x + r.w - n.x) < EPS) {
          const a = Math.max(r.y, n.y), b = Math.min(r.y + r.h, n.y + n.h);
          if (b - a > 0.5 && !(r.open && n.open)) {
            const wide = r.type === 'hall' || n.type === 'hall' || r.open || n.open;
            wallRun('z', r.x + r.w, a, b, [paint(r.style.wall), paint(n.style.wall)], doorGap(a, b, wide));
          }
        }
        // r's bottom edge against n's top edge
        if (Math.abs(r.y + r.h - n.y) < EPS) {
          const a = Math.max(r.x, n.x), b = Math.min(r.x + r.w, n.x + n.w);
          if (b - a > 0.5 && !(r.open && n.open)) {
            const wide = r.type === 'hall' || n.type === 'hall' || r.open || n.open;
            wallRun('x', r.y + r.h, a, b, [paint(r.style.wall), paint(n.style.wall)], doorGap(a, b, wide));
          }
        }
      }
    }

    // exterior walls with windows; the front door goes in the entry (or the room
    // nearest the middle of the front wall).
    const outside = this.wallMaterial(this.colors().body, 0);
    const front = rooms.filter((r) => Math.abs(r.y + r.h - d / 2) < EPS);
    const doorRoom = front.find((r) => r.type === 'hall') || front.sort((a, b) => Math.abs(a.x + a.w / 2) - Math.abs(b.x + b.w / 2))[0];
    const winM = GLASS;
    for (const r of rooms) {
      const inside = paint(r.style.wall);
      const sides = [
        { on: Math.abs(r.y + d / 2) < EPS, axis: 'x', c: -d / 2, a: r.x, b: r.x + r.w, mats: [outside, inside] },
        { on: Math.abs(r.y + r.h - d / 2) < EPS, axis: 'x', c: d / 2, a: r.x, b: r.x + r.w, mats: [inside, outside], front: true },
        { on: Math.abs(r.x + w / 2) < EPS, axis: 'z', c: -w / 2, a: r.y, b: r.y + r.h, mats: [outside, inside] },
        { on: Math.abs(r.x + r.w - w / 2) < EPS, axis: 'z', c: w / 2, a: r.y, b: r.y + r.h, mats: [inside, outside] },
      ];
      for (const s of sides) {
        if (!s.on) continue;
        const gap = s.front && r === doorRoom ? doorGap(s.a, s.b, false) : null;
        wallRun(s.axis, s.c, s.a, s.b, s.mats, gap);
        if (gap) { // the door, swung open
          const mid = (gap[0] + gap[1]) / 2;
          const dr = box(0.2, 7, 3, paint('#4a2f22'), 0, 0, 0);
          dr.position.set(mid - 1.4, 3.5, s.c - 1.5);
          g.add(dr);
          continue;
        }
        const len = s.b - s.a, n = Math.floor(len / 9);
        for (let i = 0; i < n; i++) {
          if (r.type === 'utility' && i > 0) break;
          const t = s.a + len * (i + 0.5) / n, ww = r.type === 'bath' ? 2.5 : 4;
          if (s.axis === 'x') g.add(box(ww, 4.4, T * 2 + 0.12, winM, t, 2.8, s.c));
          else g.add(box(T * 2 + 0.12, 4.4, ww, winM, s.c, 2.8, t));
        }
      }
    }

    // floors, furniture, labels
    for (const r of rooms) {
      const cx = r.x + r.w / 2, cz = r.y + r.h / 2;
      g.add(box(r.w, 0.2, r.h, floorMat(r, r.style), cx, 0, cz));
      this.furnish(g, r, cx, cz, floor);
      this.addLabel(r.name, [cx, 9.5, cz], r.type === 'hall' || r.type === 'utility' ? 'small' : '');
    }
    this.bounds = new THREE.Box3(new THREE.Vector3(-w / 2, 0, -d / 2), new THREE.Vector3(w / 2, 8, d / 2));
    this.root.add(g);
  }

  // Furnish one room. Pieces are laid out in a local frame: u runs along the
  // room's longer side, v from the back wall (0) toward the front (D).
  furnish(g, r, cx, cz, floor) {
    const p = this.profile, st = r.style;
    const wide = r.w >= r.h;
    const L = wide ? r.w : r.h, D = wide ? r.h : r.w;
    const room = new THREE.Group();
    room.position.set(cx, 0.2, cz);
    room.rotation.y = wide ? 0 : Math.PI / 2;
    g.add(room);
    const put = (obj, u, v, rot = 0) => {
      if (obj.isMesh) { const h = new THREE.Group(); h.add(obj); obj = h; } // keep box()'s height offset
      obj.position.set(u, 0, v - D / 2); obj.rotation.y = rot; room.add(obj); return obj;
    };
    const fits = (l, dd) => L >= l && D >= dd;
    const woodC = { modern: '#9a8a78', farmhouse: '#8a6a4a', midcentury: '#7a4a26', industrial: '#4a3a2e', scandinavian: '#d4b98f', traditional: '#5a3420', coastal: '#c8b08a', bohemian: '#8a5a32' }[p.interiorStyle] || '#8a6a4a';
    const counter = { quartz: '#eeeeec', granite: '#57534f', marble: '#f2f1ee', butcher: '#b07c48', concrete: '#a9a6a1' }[p.countertops] || '#eeeeec';
    const living = new Set(p.livingFeatures || []);

    switch (r.type) {
      case 'bedroom': {
        const bw = r.primary ? 6.5 : 5;
        if (!fits(bw + 1, 8)) break;
        put(F.rug(bw + 4, 8, st.accent), 0, 4.5);
        put(F.bed(bw, woodC, st.accent), 0, 3.6);
        if (L >= bw + 5) for (const s of [-1, 1]) put(F.nightstand(woodC), s * (bw / 2 + 1.3), 1);
        if (D >= 13 && L >= 7) put(F.dresser(woodC), L / 2 - 3.2, D - 1.1, Math.PI);
        if (r.primary && (p.primaryFeatures || []).includes('sitting') && D >= 12 && L >= 12) put(F.armchair(st.accent), -L / 2 + 2.2, D - 2.4, Math.PI * 0.85);
        break;
      }
      case 'living': {
        if (!fits(9, 9)) break;
        const sofaLen = Math.min(10, L - 4), sv = Math.min(D - 2.2, 13);
        put(F.rug(Math.min(L - 2, 12), Math.min(D - 2, 9), st.accent), 0, sv - 4.5);
        if (living.has('fireplace')) {
          put(box(6, 4.5, 1.6, surface('stone')), 0, 0.8);
          put(box(3, 2, 0.4, surface('paint', '#151515')), 0, 1.65);
          put(box(7, 0.3, 1.9, surface('wood_floor', woodC)), 0, 0.95).position.y = 4.5;
        } else put(F.tvConsole(Math.min(6, L - 4)), 0, 0.8);
        if (living.has('builtins') && L >= 16) for (const s of [-1, 1]) put(F.bookshelf(3.6, woodC), s * (L / 2 - 2.2), 0.7);
        put(F.sofa(sofaLen, st.accent === '#2a2a2a' ? '#8a8580' : st.accent), 0, sv, Math.PI);
        put(F.coffeeTable(woodC), 0, sv - 4.2);
        if (L >= 15) put(F.armchair('#d8d2c6'), -sofaLen / 2 - 1.6, sv - 4.5, Math.PI / 2);
        if (L >= 12) put(F.plant(), L / 2 - 1.3, D - 1.3);
        break;
      }
      case 'kitchen': {
        if (!fits(7, 6)) break;
        put(F.kitchenRun(Math.min(L - 0.8, 18), p.cabinets, counter), 0, 1.15);
        if ((p.kitchenLayout === 'island' || p.kitchenLayout === 'peninsula') && fits(10, 11)) {
          const il = Math.min(9, L - 5);
          put(F.island(il, p.cabinets, counter, (p.kitchenFeatures || []).includes('islandSeating')), p.kitchenLayout === 'peninsula' ? -L / 2 + il / 2 + 0.4 : 0, Math.min(D * 0.55, 7.5));
        }
        if ((p.kitchenFeatures || []).includes('nook') && D >= 15 && L >= 12) put(F.diningSet(4, woodC, woodC), L / 2 - 4, D - 3.4);
        break;
      }
      case 'dining': {
        if (!fits(8, 8)) break;
        const seats = L >= 11 && D >= 9 ? 6 : 4;
        put(F.rug(seats > 4 ? 10 : 8, 7.5, st.accent), 0, D / 2);
        put(F.diningSet(seats, woodC, woodC), 0, D / 2);
        const pend = put(F.plant(0.8), L / 2 - 1.2, 1.2);
        pend.visible = L >= 12;
        break;
      }
      case 'bath': {
        if (!fits(4.5, 4.5)) break;
        const feats = new Set(p.primaryBath || []);
        const vw = r.primary && feats.has('doubleVanity') && L >= 9 ? 6 : 3;
        put(F.vanity(vw, st.cabinet), -L / 2 + vw / 2 + 0.4, 1);
        put(F.toilet(), L / 2 - 1.3, 1.1);
        if (r.name === 'Powder') break;
        if (r.primary && feats.has('tub') && fits(10, 8)) put(F.tub(), -L / 2 + 3.2, D - 1.6);
        if ((!r.primary || feats.has('shower') || !feats.has('tub')) && D >= 7 && L >= 7) put(F.shower(3.6, 3.6), L / 2 - 2, D - 2);
        break;
      }
      case 'utility': {
        if (r.key === 'laundry' && fits(5.5, 4)) put(F.washerDryer(), 0, 1.4);
        else if (fits(3, 3)) put(F.shelves(Math.min(L - 1, 8)), 0, 0.9);
        break;
      }
      case 'hall': {
        if (Number(p.stories) > 1 && fits(5, 11) && floor.name !== 'Basement') {
          // straight stair along the back wall
          for (let i = 0; i < 12; i++) put(box(3.2, 0.75 * (i + 1), 0.9, surface('wood_floor', woodC)), -L / 2 + 2, 1 + i * 0.85);
        } else if (fits(5, 5)) {
          put(F.rug(Math.min(L - 1.5, 5), Math.min(D - 1.5, 7), st.accent), 0, D / 2);
          put(F.plant(0.8), L / 2 - 1.2, 1.2);
        }
        break;
      }
      case 'bonus': {
        const k = r.key || 'loft';
        if (!fits(6, 6)) break;
        if (k === 'office' || k === 'craft') { put(F.desk(woodC), 0, 1.5); put(F.officeChair(), 0, 3.6, Math.PI); if (L >= 11) put(F.bookshelf(4, woodC), L / 2 - 2.4, 0.7); }
        else if (k === 'gym') put(F.gym(), 0, 2.2);
        else if (k === 'media') { put(F.mediaWall(Math.min(10, L - 2)), 0, 0.3); put(F.sofa(Math.min(10, L - 3), '#3d3f45', 3.6), 0, Math.min(D - 2.2, 11), Math.PI); }
        else if (k === 'library') { put(F.bookshelf(Math.min(L - 2, 12), woodC), 0, 0.7); put(F.armchair(st.accent), -1.8, D - 3, Math.PI); put(F.armchair(st.accent), 1.8, D - 3, Math.PI); }
        else if (k === 'guest') { put(F.bed(5, woodC, st.accent), 0, 3.6); }
        else if (k === 'mudroom') put(F.bench(woodC), 0, 0.8);
        else if (k === 'sunroom') { put(F.armchair('#e4dccd'), -2, D / 2, Math.PI); put(F.armchair('#e4dccd'), 2, D / 2, Math.PI); put(F.plant(1.2), L / 2 - 1.4, 1.4); put(F.plant(), -L / 2 + 1.4, 1.4); }
        else if (k === 'wine') put(F.wineRack(Math.min(L - 1, 10)), 0, 0.8);
        else if (k === 'workshop') put(F.workbench(), 0, 1.6);
        else if (k === 'playroom') { put(F.rug(Math.min(L - 2, 10), Math.min(D - 2, 8), '#7fb6d9'), 0, D / 2); put(F.toyBoxes(), 0, 0.9); }
        else { put(F.rug(Math.min(L - 2, 10), Math.min(D - 2, 8), st.accent), 0, D / 2); put(F.sofa(Math.min(8, L - 3), st.accent), 0, D / 2 + 1, Math.PI); }
        break;
      }
    }
  }

  screenshot() {
    if (this.ao) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
}
