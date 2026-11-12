// Procedural 3D house built from the interview profile. Units are feet.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { EXTERIOR_STYLES, EXTERIOR_PALETTES, INTERIOR_STYLES, ROOF_MATERIAL_COLORS, CABINET_COLORS } from './styles-data.js';
import { roomStyle } from './questions.js';

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts });
const GLASS = mat('#9cc0d6', { roughness: 0.15, metalness: 0.3 });

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function meshFromTris(tris, material) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(2), 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
const quad = (a, b, c, d) => [[a, b, c], [a, c, d]];

// Gable/hip roof over a w×d rectangle with the ridge running along x.
// inset = 0 gives a gable, inset = d/2 a full hip.
function pitchedRoof(w, d, h, inset, roofMat, endMat) {
  const A = [-w / 2, 0, -d / 2], B = [w / 2, 0, -d / 2], C = [w / 2, 0, d / 2], D = [-w / 2, 0, d / 2];
  const R1 = [-w / 2 + inset, h, 0], R2 = [w / 2 - inset, h, 0];
  const g = new THREE.Group();
  const slopes = [...quad(D, C, R2, R1), ...quad(B, A, R1, R2)];
  const ends = [[A, D, R1], [C, B, R2]];
  if (inset > 0) slopes.push(...ends);
  const roofM = roofMat.clone(); roofM.side = THREE.DoubleSide;
  g.add(meshFromTris(slopes, roofM));
  if (inset === 0) { const e = endMat.clone(); e.side = THREE.DoubleSide; g.add(meshFromTris(ends, e)); }
  return g;
}

function shedRoof(w, d, h, roofMat, wallMat) {
  const g = new THREE.Group();
  const slab = box(w + 3, 0.8, Math.hypot(d + 3, h), roofMat);
  slab.position.set(0, h / 2, 0);
  slab.rotation.x = Math.atan2(h, d + 3); // front edge low, back edge high
  g.add(slab);
  const wm = wallMat.clone(); wm.side = THREE.DoubleSide;
  const L = [-w / 2, 0, d / 2], Lb = [-w / 2, 0, -d / 2], Lt = [-w / 2, h * (d / (d + 3)), -d / 2];
  const Rr = [w / 2, 0, d / 2], Rb = [w / 2, 0, -d / 2], Rt = [w / 2, h * (d / (d + 3)), -d / 2];
  g.add(meshFromTris([[L, Lb, Lt], [Rr, Rt, Rb], ...quad(Lb, Rb, Rt, Lt)], wm));
  return g;
}

function addWindows(group, { w, d, y, h, trim, big, shutters, skipCenter }) {
  const trimM = mat(trim);
  const shutM = shutters ? mat(shutters) : null;
  const ww = big ? 7 : 3, wh = big ? 6 : 4.5;
  const faces = [
    { len: w, place: (t) => [t, d / 2], rot: 0 },
    { len: w, place: (t) => [t, -d / 2], rot: 0 },
    { len: d, place: (t) => [w / 2, t], rot: Math.PI / 2 },
    { len: d, place: (t) => [-w / 2, t], rot: Math.PI / 2 },
  ];
  faces.forEach((f, fi) => {
    const n = Math.max(1, Math.floor(f.len / (big ? 12 : 9)));
    for (let i = 0; i < n; i++) {
      const t = -f.len / 2 + (f.len / n) * (i + 0.5);
      if (fi === 0 && skipCenter && Math.abs(t) < 4) continue;
      const [x, z] = f.place(t);
      const frame = box(ww + 0.6, wh + 0.6, 0.3, trimM, 0, y + h * 0.3 - 0.3);
      const glass = box(ww, wh, 0.4, GLASS, 0, y + h * 0.3);
      for (const m of [frame, glass]) {
        m.position.x += x; m.position.z += z; m.rotation.y = f.rot; group.add(m);
      }
      if (shutM && fi === 0) for (const s of [-1, 1]) {
        const sh = box(1.3, wh, 0.3, shutM, x + s * (ww / 2 + 1), y + h * 0.3, z + 0.1);
        group.add(sh);
      }
    }
  });
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

export class HouseViewer {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#dfeaf2');
    this.camera = new THREE.PerspectiveCamera(40, 1, 1, 2000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#7a8b6a', 1.4));
    const sun = new THREE.DirectionalLight('#fff6e8', 2.2);
    sun.position.set(80, 140, 100);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -150, right: 150, top: 150, bottom: -150, far: 500 });
    this.scene.add(sun);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.mode = 'exterior';
    this.floorIndex = 0;
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    const loop = () => { this.controls.update(); this.renderer.render(this.scene, this.camera); this.raf = requestAnimationFrame(loop); };
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
    this.root.traverse((o) => { o.geometry?.dispose(); if (o.material?.map) o.material.map.dispose(); });
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
    const bounds = this.bounds;
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const r = Math.max(size.x, size.z, w, d);
    if (this.mode === 'exterior') {
      center.y = size.y * 0.35;
      this.camera.position.set(center.x + r * 0.7, r * 0.6, center.z + r * 1.3);
    } else {
      center.y = 0;
      this.camera.position.set(center.x, r * 1.5, center.z + r * 0.85);
    }
    this.controls.target.copy(center);
    this.controls.update();
  }

  addGround() {
    const p = this.profile;
    const lotSide = { any: 140, small: 100, quarter: 140, half: 190, acre: 260 }[p.lot] || 140;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(lotSide * 3, lotSide * 3), mat('#8fae74'));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    this.root.add(ground);
    const lot = new THREE.Mesh(new THREE.PlaneGeometry(lotSide, lotSide), mat('#9cbb80'));
    lot.rotation.x = -Math.PI / 2; lot.position.y = 0.02; lot.receiveShadow = true;
    this.root.add(lot);
    this.lotSide = lotSide;
  }

  colors() {
    const p = this.profile;
    const s = EXTERIOR_STYLES[p.exteriorStyle];
    const pal = EXTERIOR_PALETTES[p.exteriorPalette]?.colors;
    const c = { body: s.body, trim: s.trim, roofColor: s.roofColor, accent: s.accent, shutters: s.shutters, ...(pal || {}) };
    if (p.siding === 'brick' && !pal) c.body = '#9a4a35';
    if (p.siding === 'stone') c.body = '#a59d92';
    if (p.siding === 'wood') c.body = '#9a6b43';
    const rm = ROOF_MATERIAL_COLORS[p.roofMaterial];
    if (rm) c.roofColor = rm;
    return c;
  }

  buildExterior() {
    const p = this.profile;
    const { w, d, stories, wallH, style: s } = this.dims();
    const c = this.colors();
    const g = new THREE.Group();
    const bodyM = mat(c.body, { roughness: p.siding === 'stucco' ? 0.95 : 0.8 });
    const trimM = mat(c.trim);
    const roofM = mat(c.roofColor, { roughness: p.roofMaterial === 'metal' ? 0.4 : 0.9, metalness: p.roofMaterial === 'metal' ? 0.4 : 0 });
    const H = wallH * stories;

    // foundation + body
    g.add(box(w + 0.6, 1.5, d + 0.6, mat('#9b9690')));
    for (let i = 0; i < stories; i++) {
      const m = (s.accent && !EXTERIOR_PALETTES[p.exteriorPalette]?.colors && i === 1) ? mat(s.accent) : bodyM;
      g.add(box(w, wallH, d, m, 0, 1.5 + i * wallH));
      addWindows(g, { w, d, y: 1.5 + i * wallH, h: wallH, trim: c.trim, big: s.bigWindows, shutters: c.shutters, skipCenter: i === 0 });
      if (i > 0) g.add(box(w + 0.4, 0.5, d + 0.4, trimM, 0, 1.5 + i * wallH - 0.25));
    }
    // half timbering on upper story front
    if (s.halfTimber && stories > 1) {
      const tm = mat(c.trim);
      for (let x = -w / 2; x <= w / 2 + 0.1; x += w / 8) g.add(box(0.6, wallH, 0.3, tm, x, 1.5 + wallH, d / 2 + 0.1));
    }
    // door
    const doorX = s.bigWindows ? w * 0.15 : 0;
    g.add(box(4, 7.5, 0.4, mat(['#ffffff', '#efe9dc', '#f1e6d2', '#f4efe6', '#f5efe3', '#f2ede4', '#ece6d6'].includes(c.trim) ? '#5a3b2a' : c.trim), doorX, 1.5, d / 2 + 0.1));

    // roof
    const top = 1.5 + H;
    const ow = w + 3, od = d + 3;
    const pitch = { 'gable-low': 0.33, gable: 0.5, 'gable-steep': 0.85, 'hip-low': 0.33 }[s.roof] ?? 0.5;
    let roof;
    if (s.roof === 'flat') {
      roof = new THREE.Group();
      roof.add(box(w + 2, 1, d + 2, roofM));
      roof.add(box(w + 2, 2.5, 0.6, trimM, 0, 0, (d + 2) / 2));
    } else if (s.roof === 'shed') {
      roof = shedRoof(w, d, d * 0.22, roofM, bodyM);
    } else {
      roof = pitchedRoof(ow, od, (od / 2) * pitch, s.roof.startsWith('hip') ? od / 2 : 0, roofM, bodyM);
    }
    roof.position.y = top;
    g.add(roof);
    this.roofTop = top + (od / 2) * pitch;

    // dormers
    if (s.dormers) {
      const rh = (od / 2) * pitch;
      for (const x of [-w / 4, w / 4]) {
        const dm = new THREE.Group();
        dm.add(box(5, 5, 6, bodyM, 0, 0, 0));
        const glass = box(3, 3, 0.3, GLASS, 0, 1, 3.05); dm.add(glass);
        const dr = pitchedRoof(6.5, 7, 2.5, 0, roofM, bodyM);
        dr.rotation.y = Math.PI / 2; dr.position.y = 5;
        dm.add(dr);
        dm.position.set(x, top + rh * 0.35, od / 4);
        g.add(dm);
      }
    }
    // turret
    if (s.turret) {
      const tr = 5.5, th = H + 6;
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(tr, tr, th, 24), bodyM);
      cyl.position.set(-w / 2, 1.5 + th / 2, d / 2); cyl.castShadow = true; g.add(cyl);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(tr + 1.2, 12, 24), roofM);
      cone.position.set(-w / 2, 1.5 + th + 6, d / 2); cone.castShadow = true; g.add(cone);
    }
    // chimney
    if ((p.livingFeatures || []).includes('fireplace')) {
      g.add(box(4, top + (od / 2) * pitch + 4, 3, mat('#8a4b3a'), -w / 2 + 0.5, 0, -d / 6));
    }
    // porch
    const porch = p.porch === 'style' ? s.porch : p.porch === 'none' ? null : p.porch;
    if (porch) {
      const pd = 8, pw = porch === 'wrap' ? w + 2 : Math.min(w * 0.6, 30);
      const pm = mat('#8c7b6b');
      const colM = mat(c.trim === '#1f1f1f' ? '#1f1f1f' : '#f4f1ea');
      g.add(box(pw, 1.5, pd, pm, 0, 0, d / 2 + pd / 2));
      const roofSlab = box(pw + 1, 0.6, pd + 1, roofM, 0, 1.5 + wallH - 1, d / 2 + pd / 2);
      g.add(roofSlab);
      const n = Math.max(2, Math.round(pw / 8));
      for (let i = 0; i <= n; i++) g.add(box(0.8, wallH - 1, 0.8, colM, -pw / 2 + 0.5 + (pw - 1) * (i / n), 1.5, d / 2 + pd - 0.5));
      if (porch === 'wrap') {
        g.add(box(pd, 1.5, d, pm, -w / 2 - pd / 2 - 1, 0, 0));
        g.add(box(pd + 1, 0.6, d + pd, roofM, -w / 2 - pd / 2 - 1, 1.5 + wallH - 1, pd / 2));
        for (let i = 0; i <= 3; i++) g.add(box(0.8, wallH - 1, 0.8, colM, -w / 2 - pd - 0.5, 1.5, -d / 2 + 0.5 + (d - 1) * (i / 3)));
      }
    }
    // garage
    const spaces = Number(p.garage);
    if (spaces > 0) {
      const gw = 11 * spaces + 2, gd = 22, gh = 10;
      const gx = w / 2 + gw / 2;
      g.add(box(gw, gh, gd, bodyM, gx, 0, d / 2 - gd / 2));
      const gr = s.roof === 'flat' || s.roof === 'shed'
        ? box(gw + 2, 1, gd + 2, roofM)
        : pitchedRoof(gw + 2, gd + 2, ((gd + 2) / 2) * Math.min(pitch, 0.5), s.roof.startsWith('hip') ? (gd + 2) / 2 : 0, roofM, bodyM);
      gr.position.set(gx, gh, d / 2 - gd / 2);
      g.add(gr);
      const doorM = mat(c.trim === '#222222' || c.trim === '#1f1f1f' ? '#3a3a3a' : '#f3f1ec');
      for (let i = 0; i < spaces; i++) {
        const dx = gx - gw / 2 + 1 + 11 * i + 5.5;
        g.add(box(9, 7.5, 0.3, doorM, dx, 0, d / 2 + 0.1));
        for (let k = 1; k < 4; k++) g.add(box(9, 0.15, 0.4, mat('#000000', { transparent: true, opacity: 0.25 }), dx, k * 1.9, d / 2 + 0.15));
      }
      // driveway
      const drive = new THREE.Mesh(new THREE.PlaneGeometry(gw, this.lotSide / 2 - d / 2), mat('#b9b5ae'));
      drive.rotation.x = -Math.PI / 2;
      drive.position.set(gx, 0.04, d / 2 + (this.lotSide / 2 - d / 2) / 2);
      drive.receiveShadow = true;
      drive.userData.yard = true;
      g.add(drive);
    }
    // Frame on the house + garage only, not the driveway or yard items.
    this.bounds = new THREE.Box3();
    for (const child of g.children) if (!child.userData.yard) this.bounds.expandByObject(child);
    // walkway
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(4, this.lotSide / 2 - d / 2), mat('#cfc8bd'));
    walk.rotation.x = -Math.PI / 2; walk.position.set(doorX, 0.05, d / 2 + (this.lotSide / 2 - d / 2) / 2);
    g.add(walk);

    // backyard features
    const of = new Set(p.outdoorFeatures || []);
    const backZ = -d / 2;
    if (of.has('deck') || of.has('patio')) {
      const deckM = of.has('deck') ? mat('#9a7350') : mat('#c9c2b5');
      g.add(box(Math.min(w * 0.6, 28), of.has('deck') ? 1.4 : 0.3, 12, deckM, -w * 0.1, 0, backZ - 6));
    }
    if (of.has('pool')) {
      g.add(box(20, 0.3, 36, mat('#e6e1d6'), w * 0.15, 0, backZ - 34));
      const water = new THREE.Mesh(new THREE.PlaneGeometry(16, 32), mat('#3f9fd1', { roughness: 0.1, metalness: 0.2 }));
      water.rotation.x = -Math.PI / 2; water.position.set(w * 0.15, 0.35, backZ - 34);
      g.add(water);
    }
    if (of.has('hottub')) {
      const tub = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 2.5, 20), mat('#6b5a4a'));
      tub.position.set(-w * 0.35, 1.25, backZ - 20); g.add(tub);
    }
    if (of.has('outdoorKitchen')) g.add(box(10, 3, 2.5, mat('#7d7770'), -w * 0.3, 0, backZ - 9));
    if (of.has('garden')) for (let i = 0; i < 3; i++) g.add(box(4, 1.2, 10, mat('#6b4e34'), -this.lotSide / 2 + 10 + i * 7, 0, -this.lotSide / 2 + 14));
    if (of.has('fence')) {
      const fm = mat('#d8cfbf'), L = this.lotSide / 2 - 1;
      g.add(box(this.lotSide - 2, 5, 0.4, fm, 0, 0, -L));
      g.add(box(0.4, 5, L + backZ, fm, -L, 0, (-L + backZ) / 2));
      g.add(box(0.4, 5, L + backZ, fm, L, 0, (-L + backZ) / 2));
    }
    // a few trees for scale
    const trunkM = mat('#6b4e34'), leafM = mat('#4f7a3a');
    for (const [tx, tz] of [[-0.42, 0.35], [0.42, -0.4], [-0.4, -0.38], [0.44, 0.42]]) {
      const x = tx * this.lotSide, z = tz * this.lotSide;
      g.add(box(1.2, 8, 1.2, trunkM, x, 0, z));
      const crown = new THREE.Mesh(new THREE.SphereGeometry(7, 12, 10), leafM);
      crown.position.set(x, 14, z); crown.castShadow = true; g.add(crown);
    }
    this.root.add(g);
  }

  buildPlan(floor) {
    const p = this.profile;
    const { w, d } = this.dims();
    const rooms = squarify(floor.rooms, -w / 2, -d / 2, w, d);
    const g = new THREE.Group();
    g.add(box(w + 1, 0.5, d + 1, mat('#9b9690'), 0, -0.5));
    const styleFor = (r) => {
      const key = r.type === 'kitchen' ? roomStyle(p, 'kitchenStyle')
        : r.type === 'bedroom' ? roomStyle(p, 'bedroomStyle')
        : r.type === 'bath' ? roomStyle(p, 'bathroomStyle')
        : r.type === 'bonus' ? roomStyle(p, 'bonusStyle') : p.interiorStyle;
      return INTERIOR_STYLES[key] || INTERIOR_STYLES.modern;
    };
    for (const r of rooms) {
      const st = styleFor(r);
      const floorColor = r.type === 'bath' ? '#e8e6e1' : r.type === 'utility' ? '#d6d2cb' : st.floor;
      const cx = r.x + r.w / 2, cz = r.y + r.h / 2;
      const fl = box(r.w - 0.3, 0.2, r.h - 0.3, mat(floorColor), cx, 0, cz);
      g.add(fl);
      const wallM = mat(st.wall);
      const wh = r.open ? 1.2 : 8;
      g.add(box(r.w, wh, 0.35, wallM, cx, 0, r.y));
      g.add(box(r.w, wh, 0.35, wallM, cx, 0, r.y + r.h));
      g.add(box(0.35, wh, r.h, wallM, r.x, 0, cz));
      g.add(box(0.35, wh, r.h, wallM, r.x + r.w, 0, cz));
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
    const accent = mat(st.accent), wood = mat('#8a6a4a'), white = mat('#f5f5f2');
    const fit = (fw, fd) => fw < r.w - 2 && fd < r.h - 2;
    if (r.type === 'bedroom' && fit(6, 7)) {
      g.add(box(r.primary ? 6.5 : 5, 2, 6.7, white, cx, 0, cz));
      g.add(box(r.primary ? 6.5 : 5, 3.5, 0.5, accent, cx, 0, cz - 3.4));
    } else if (r.type === 'living' && fit(8, 6)) {
      g.add(box(8, 2.5, 3, accent, cx, 0, cz + 1.5));
      g.add(box(4, 1.3, 2, wood, cx, 0, cz - 1.5));
    } else if (r.type === 'kitchen') {
      const cab = CABINET_COLORS[p.cabinets] || CABINET_COLORS.white;
      if (fit(3, 3)) g.add(box(Math.min(r.w - 1, 12), 3, 2, mat(cab.color), cx, 0, r.y + 1.3));
      if (p.kitchenLayout === 'island' && fit(8, 7)) g.add(box(Math.min(8, r.w - 4), 3, 3.5, mat(cab.color2 || cab.color), cx, 0, cz + 1));
    } else if (r.type === 'dining' && fit(6, 4)) {
      g.add(box(6, 2.5, 3.5, wood, cx, 0, cz));
    } else if (r.type === 'bath' && fit(3, 3)) {
      if (r.primary && (p.primaryBath || []).includes('tub') && fit(5.5, 3)) g.add(box(5.5, 2, 3, white, cx, 0, r.y + 2));
      g.add(box(Math.min(r.w - 1.5, r.primary && (p.primaryBath || []).includes('doubleVanity') ? 6 : 3), 3, 1.8, mat(st.cabinet), cx, 0, r.y + r.h - 1.3));
    }
  }

  screenshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
}
