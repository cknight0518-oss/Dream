// Procedural 3D house built from the interview profile. Units are feet.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { RGBELoader } from 'three/addons/RGBELoader.js';
import { EXTERIOR_STYLES, EXTERIOR_PALETTES, INTERIOR_STYLES, CABINET_COLORS } from './styles-data.js';
import { roomStyle } from './questions.js';
import { surface, prepare, GLASS, WATER, setMaxAnisotropy } from './materials.js';

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

function doubleSided(m) {
  const c = m.clone(); c.side = THREE.DoubleSide; return c;
}

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

function textSprite(text, scale = 1) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = 'bold 44px system-ui, sans-serif';
  ctx.font = font;
  const tw = ctx.measureText(text).width;
  c.width = tw + 30; c.height = 64;
  ctx.font = font;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.roundRect(0, 0, c.width, c.height, 14); ctx.fill();
  ctx.fillStyle = '#222'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 15, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.scale.set((c.width / 64) * 2.4 * scale, 2.4 * scale, 1);
  s.renderOrder = 10;
  return s;
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
  main.rooms.push({ name: 'Laundry', type: 'utility', w: 0.35 });

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
    const room = { name: BONUS_LABELS[b], type: 'bonus', w: b === 'mudroom' ? 0.35 : 0.8 };
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

export class HouseViewer {
  constructor(container) {
    this.container = container;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.85;
    setMaxAnisotropy(r.capabilities.getMaxAnisotropy());
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#c9d9e6');
    this.scene.fog = new THREE.Fog('#c9d6e0', 350, 1100);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 3000);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.maxDistance = 600;

    // Sky lighting from a CC0 HDRI; the hemisphere light covers the moment before it loads.
    this.hemi = new THREE.HemisphereLight('#ffffff', '#6f7d5c', 1.2);
    this.scene.add(this.hemi);
    const pmrem = new THREE.PMREMGenerator(r);
    new RGBELoader().load('assets/textures/sky.hdr', (hdr) => {
      this.scene.environment = pmrem.fromEquirectangular(hdr).texture;
      hdr.dispose(); pmrem.dispose();
      this.hemi.intensity = 0.15;
    });
    new THREE.TextureLoader().load('assets/textures/sky.jpg', (t) => {
      t.mapping = THREE.EquirectangularReflectionMapping;
      t.colorSpace = THREE.SRGBColorSpace;
      this.scene.background = t;
      this.scene.backgroundIntensity = 1.15;
    });

    const sun = this.sun = new THREE.DirectionalLight('#fff3e0', 2.6);
    sun.position.set(90, 120, 110);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun, sun.target);

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.mode = 'exterior';
    this.floorIndex = 0;
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    const loop = () => { this.controls.update(); r.render(this.scene, this.camera); this.raf = requestAnimationFrame(loop); };
    loop();
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  clear() {
    // Materials and textures are cached and shared, so only geometry is freed.
    this.root.traverse((o) => { o.geometry?.dispose(); if (o.isSprite) o.material.map.dispose(); });
    this.root.clear();
  }

  build(profile) {
    this.profile = profile;
    this.floors = roomProgram(profile);
    if (this.floorIndex >= this.floors.length) this.floorIndex = 0;
    this.render();
  }

  setMode(mode, floorIndex = this.floorIndex) {
    this.mode = mode; this.floorIndex = floorIndex;
    this.render();
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

  render() {
    this.clear();
    if (!this.profile) return;
    const { w, d } = this.dims();
    this.addGround();
    if (this.mode === 'exterior') this.buildExterior();
    else this.buildPlan(this.floors[this.floorIndex]);
    // Frame the house (and garage) rather than the whole lot.
    const center = this.bounds.getCenter(new THREE.Vector3());
    const size = this.bounds.getSize(new THREE.Vector3());
    const r = Math.max(size.x, size.z, w, d);
    if (this.mode === 'exterior') {
      center.y = size.y * 0.35;
      this.camera.position.set(center.x + r * 0.75, r * 0.42, center.z + r * 1.35);
    } else {
      center.y = 0;
      this.camera.position.set(center.x, r * 1.5, center.z + r * 0.85);
    }
    this.controls.target.copy(center);
    this.controls.update();
    // Fit the shadow camera to the scene for sharp shadows.
    const sc = this.sun.shadow.camera, ext = Math.max(r * 1.6, this.lotSide * 0.75);
    Object.assign(sc, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 600 });
    sc.updateProjectionMatrix();
    this.sun.target.position.copy(center);
    this.sun.position.copy(center).add(new THREE.Vector3(90, 130, 110));
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
      const driveLen = this.lotSide / 2 - d / 2;
      const drive = prepare(new THREE.Mesh(new THREE.PlaneGeometry(gw, driveLen), surface('concrete')));
      drive.rotation.x = -Math.PI / 2;
      drive.position.set(gx, 0.05, d / 2 + driveLen / 2);
      drive.userData.yard = true;
      g.add(drive);
    }
    this.bounds = new THREE.Box3();
    for (const child of g.children) if (!child.userData.yard) this.bounds.expandByObject(child);

    // walkway
    const walkLen = this.lotSide / 2 - d / 2 - (porch ? 8 : 2);
    const walk = prepare(new THREE.Mesh(new THREE.PlaneGeometry(4, walkLen), surface('pavers')));
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(doorX, 0.06, this.lotSide / 2 - walkLen / 2);
    g.add(walk);

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
    for (const [tx, tz, hgt] of [[-0.42, 0.36, 34], [0.43, -0.4, 40], [-0.4, -0.38, 30], [-0.1, -0.47, 36], [-0.46, 0.05, 28], [0.47, 0.05, 32]]) {
      const x = tx * this.lotSide, z = tz * this.lotSide;
      if (gx != null && Math.abs(x - gx) < gw / 2 + 8 && z > 0) continue; // keep the driveway clear
      const t = tree(hgt * (0.85 + rng() * 0.3), rng);
      t.position.set(x, 0, z);
      g.add(t);
    }
    this.root.add(g);
  }

  buildPlan(floor) {
    const p = this.profile;
    const { w, d } = this.dims();
    const rooms = squarify(floor.rooms, -w / 2, -d / 2, w, d);
    const g = new THREE.Group();
    g.add(box(w + 1, 0.5, d + 1, surface('concrete'), 0, -0.5));
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
    for (const r of rooms) {
      const st = styleFor(r);
      const cx = r.x + r.w / 2, cz = r.y + r.h / 2;
      g.add(box(r.w - 0.3, 0.2, r.h - 0.3, floorMat(r, st), cx, 0, cz));
      const wallM = paint(st.wall);
      const wh = r.open ? 1.2 : 8;
      g.add(box(r.w, wh, 0.4, wallM, cx, 0, r.y));
      g.add(box(r.w, wh, 0.4, wallM, cx, 0, r.y + r.h));
      g.add(box(0.4, wh, r.h, wallM, r.x, 0, cz));
      g.add(box(0.4, wh, r.h, wallM, r.x + r.w, 0, cz));
      this.addFurniture(g, r, st, cx, cz);
      const label = textSprite(r.name, Math.min(1, Math.max(0.55, Math.min(r.w, r.h) / 14)));
      label.position.set(cx, 10, cz);
      g.add(label);
    }
    this.bounds = new THREE.Box3(new THREE.Vector3(-w / 2, 0, -d / 2), new THREE.Vector3(w / 2, 8, d / 2));
    this.root.add(g);
  }

  addFurniture(g, r, st, cx, cz) {
    const p = this.profile;
    const fabric = surface('matte', st.accent), wood = surface('wood_floor', '#8a6a4a'), linen = surface('matte', '#f2f0eb');
    const fit = (fw, fd) => fw < r.w - 2 && fd < r.h - 2;
    if (r.type === 'bedroom' && fit(6, 7)) {
      const bw = r.primary ? 6.5 : 5;
      g.add(box(bw, 1.6, 6.7, wood, cx, 0, cz));
      g.add(box(bw - 0.2, 0.8, 6.4, linen, cx, 1.6, cz + 0.1));
      g.add(box(bw * 0.8, 0.5, 1.4, linen, cx, 2.4, cz - 2.4));
      g.add(box(bw, 3.8, 0.4, fabric, cx, 0, cz - 3.4));
    } else if (r.type === 'living' && fit(8, 6)) {
      g.add(box(8, 1.5, 3, fabric, cx, 0, cz + 1.8));
      g.add(box(8, 1.5, 0.8, fabric, cx, 1.5, cz + 2.9));
      g.add(box(4, 1.3, 2, wood, cx, 0, cz - 1.3));
      g.add(box(7, 0.05, 5, surface('matte', st.accent, { roughness: 1 }), cx, 0.2, cz));
    } else if (r.type === 'kitchen') {
      const cab = CABINET_COLORS[p.cabinets] || CABINET_COLORS.white;
      const counterM = surface('paint', { quartz: '#eeeeec', granite: '#57534f', marble: '#f2f1ee', butcher: '#b07c48', concrete: '#a9a6a1' }[p.countertops] || '#eeeeec', { roughness: 0.25 });
      if (fit(3, 3)) {
        const cw = Math.min(r.w - 1, 12);
        g.add(box(cw, 3, 2, paint(cab.color), cx, 0, r.y + 1.3));
        g.add(box(cw, 0.15, 2.2, counterM, cx, 3, r.y + 1.3));
      }
      if (p.kitchenLayout === 'island' && fit(8, 7)) {
        const iw = Math.min(8, r.w - 4);
        g.add(box(iw, 3, 3.5, paint(cab.color2 || cab.color), cx, 0, cz + 1));
        g.add(box(iw + 0.4, 0.15, 4, counterM, cx, 3, cz + 1));
      }
    } else if (r.type === 'dining' && fit(6, 4)) {
      g.add(box(6, 0.2, 3.5, wood, cx, 2.4, cz));
      for (const [x, z] of [[-2.6, -1.4], [2.6, -1.4], [-2.6, 1.4], [2.6, 1.4]]) g.add(box(0.25, 2.4, 0.25, wood, cx + x, 0, cz + z));
    } else if (r.type === 'bath' && fit(3, 3)) {
      if (r.primary && (p.primaryBath || []).includes('tub') && fit(5.5, 3)) g.add(box(5.5, 2, 3, surface('paint', '#fbfbfa', { roughness: 0.15 }), cx, 0, r.y + 2));
      const vw = Math.min(r.w - 1.5, r.primary && (p.primaryBath || []).includes('doubleVanity') ? 6 : 3);
      g.add(box(vw, 2.8, 1.8, paint(st.cabinet), cx, 0, r.y + r.h - 1.3));
      g.add(box(vw + 0.2, 0.15, 1.9, surface('paint', '#f4f4f2', { roughness: 0.2 }), cx, 2.8, r.y + r.h - 1.3));
    }
  }

  screenshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
}
