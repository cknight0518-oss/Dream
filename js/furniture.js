// Furniture for the interior "dollhouse" view. Units are feet. Every piece is
// built at the origin facing +z (its front), standing on y = 0.
import * as THREE from 'three';
import { surface, prepare, BULB } from './materials.js';
import { CABINET_COLORS } from './styles-data.js';

function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const mesh = prepare(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m));
  mesh.position.set(x, y + h / 2, z);
  return mesh;
}
function cyl(rt, rb, h, m, x = 0, y = 0, z = 0, seg = 16) {
  const mesh = prepare(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m));
  mesh.position.set(x, y + h / 2, z);
  return mesh;
}
const group = (...kids) => { const g = new THREE.Group(); kids.forEach((k) => g.add(k)); return g; };

const M = {
  white: () => surface('paint', '#f4f3ef'),
  linen: () => surface('matte', '#efece5'),
  black: () => surface('paint', '#232323', { roughness: 0.5 }),
  steel: () => surface('paint', '#c4c8cc', { metalness: 0.85, roughness: 0.3 }),
  porcelain: () => surface('paint', '#fbfbfa', { roughness: 0.12 }),
  screen: () => surface('paint', '#0d0f12', { roughness: 0.15, metalness: 0.4 }),
  wood: (c = '#8a6a4a') => surface('wood_floor', c),
  fabric: (c) => surface('matte', c),
};

// ---------- pieces ----------

export function bed(width, frameColor, accent) {
  const wood = M.wood(frameColor), linen = M.linen();
  const g = group(
    box(width, 1.3, 6.8, wood),
    box(width - 0.2, 0.9, 6.5, linen, 0, 1.3, 0.1),
    box(width - 0.1, 0.25, 4.2, M.fabric(accent), 0, 2.15, 1.2), // throw
    box(width * 0.38, 0.5, 1.3, linen, -width * 0.24, 2.2, -2.6),
    box(width * 0.38, 0.5, 1.3, linen, width * 0.24, 2.2, -2.6),
    box(width + 0.3, 4.2, 0.35, wood, 0, 0, -3.4),
  );
  return g;
}
export function nightstand(color) {
  return group(box(1.8, 2, 1.5, M.wood(color)), cyl(0.15, 0.3, 0.9, M.black(), 0, 2, 0, 10), cyl(0.45, 0.6, 0.7, BULB, 0, 2.9, 0, 14));
}
export function dresser(color) {
  const g = group(box(5, 3, 1.8, M.wood(color)));
  for (let r = 0; r < 3; r++) g.add(box(4.6, 0.06, 0.05, M.black(), 0, 0.9 + r * 0.8, 0.92));
  return g;
}
export function sofa(len, color, depth = 3.2) {
  const f = M.fabric(color);
  const g = group(
    box(len, 1.4, depth, f),
    box(len, 1.6, 0.8, f, 0, 1.4, -depth / 2 + 0.4),
    box(0.7, 1, depth, f, -len / 2 + 0.35, 1.4, 0),
    box(0.7, 1, depth, f, len / 2 - 0.35, 1.4, 0),
  );
  const n = Math.max(2, Math.round(len / 3));
  for (let i = 0; i < n; i++) g.add(box((len - 1.6) / n - 0.1, 0.4, depth - 1, f, -len / 2 + 0.8 + (len - 1.6) * (i + 0.5) / n, 1.4, 0.3));
  return g;
}
export function armchair(color) {
  const f = M.fabric(color);
  return group(box(2.8, 1.4, 2.8, f), box(2.8, 1.5, 0.6, f, 0, 1.4, -1.1), box(0.5, 0.8, 2.8, f, -1.15, 1.4, 0), box(0.5, 0.8, 2.8, f, 1.15, 1.4, 0));
}
export function coffeeTable(color) {
  return group(box(4, 0.25, 2.2, M.wood(color), 0, 1.2, 0), ...[[-1.8, -0.9], [1.8, -0.9], [-1.8, 0.9], [1.8, 0.9]].map(([x, z]) => box(0.18, 1.2, 0.18, M.wood(color), x, 0, z)));
}
export function rug(w, d, color) { return box(w, 0.04, d, surface('matte', color, { roughness: 1 }), 0, 0.12, 0); }
export function tvConsole(len = 6) {
  return group(box(len, 1.8, 1.4, M.wood('#5b4636')), box(len * 0.8, 2.6, 0.15, M.screen(), 0, 2.4, 0));
}
export function plant(scale = 1) {
  const g = group(cyl(0.6 * scale, 0.45 * scale, 1.2 * scale, surface('paint', '#c9b8a3'), 0, 0, 0, 12));
  const leaf = surface('grass', '#5f8c40');
  for (let i = 0; i < 4; i++) {
    const s = prepare(new THREE.Mesh(new THREE.SphereGeometry(0.75 * scale, 10, 8), leaf));
    s.position.set(Math.cos(i * 1.7) * 0.35 * scale, (1.9 + (i % 2) * 0.7) * scale, Math.sin(i * 1.7) * 0.35 * scale);
    g.add(s);
  }
  return g;
}
export function diningSet(seats, woodColor, chairColor) {
  const len = seats > 4 ? 7 : 5;
  const g = group(box(len, 0.2, 3.4, M.wood(woodColor), 0, 2.4, 0));
  for (const [x, z] of [[-len / 2 + 0.3, -1.4], [len / 2 - 0.3, -1.4], [-len / 2 + 0.3, 1.4], [len / 2 - 0.3, 1.4]]) g.add(box(0.22, 2.4, 0.22, M.wood(woodColor), x, 0, z));
  const per = seats / 2;
  for (let i = 0; i < per; i++) {
    const x = -len / 2 + len * (i + 0.5) / per;
    for (const side of [-1, 1]) {
      const c = chair(chairColor); c.position.set(x, 0, side * 2.4); c.rotation.y = side < 0 ? 0 : Math.PI; g.add(c);
    }
  }
  return g;
}
export function chair(color) {
  const m = M.wood(color);
  return group(box(1.5, 0.2, 1.5, m, 0, 1.5, 0), box(1.5, 1.6, 0.15, m, 0, 1.7, -0.68),
    ...[[-0.65, -0.65], [0.65, -0.65], [-0.65, 0.65], [0.65, 0.65]].map(([x, z]) => box(0.14, 1.5, 0.14, m, x, 0, z)));
}
export function stool() { return group(cyl(0.55, 0.55, 0.2, M.wood('#7a5a3a'), 0, 2.5, 0, 14), cyl(0.08, 0.08, 2.5, M.black(), 0, 0, 0, 6)); }

// Kitchen run against the back wall: base cabinets, counter, uppers, range, sink, fridge.
export function kitchenRun(len, cabKey, counterColor) {
  const cab = CABINET_COLORS[cabKey] || CABINET_COLORS.white;
  const base = surface('paint', cab.color, { roughness: 0.45 });
  const upper = surface('paint', cab.color2 ? '#f7f7f5' : cab.color, { roughness: 0.45 });
  const counter = surface('paint', counterColor, { roughness: 0.2 });
  const g = new THREE.Group();
  const runLen = Math.max(4, len - 3.2);
  g.add(box(runLen, 3, 2, base, -1.6, 0, 0));
  g.add(box(runLen + 0.1, 0.15, 2.15, counter, -1.6, 3, 0.05));
  g.add(box(runLen, 2.5, 1.2, upper, -1.6, 5.2, -0.4));
  for (let x = -len / 2 + 1.2; x < len / 2 - 3.4; x += 1.6) g.add(box(0.05, 2.6, 0.05, M.black(), x, 0.2, 1.02)); // door seams
  if (runLen >= 6) {
    g.add(box(2.5, 0.06, 2, M.black(), -1.6 + runLen * 0.15, 3.15, 0)); // cooktop
    for (const [x, z] of [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.5], [0.6, 0.5]]) g.add(cyl(0.35, 0.35, 0.03, M.steel(), -1.6 + runLen * 0.15 + x, 3.21, z, 16));
    g.add(box(2.2, 0.08, 1.4, M.steel(), -1.6 - runLen * 0.25, 3.12, 0)); // sink
  }
  g.add(box(3, 6.8, 2.4, M.steel(), len / 2 - 1.55, 0, 0.2)); // fridge
  return g;
}
export function island(len, cabKey, counterColor, seats) {
  const cab = CABINET_COLORS[cabKey] || CABINET_COLORS.white;
  const g = group(
    box(len, 3, 3, surface('paint', cab.color2 || cab.color, { roughness: 0.45 })),
    box(len + 0.4, 0.15, 4, surface('paint', counterColor, { roughness: 0.2 }), 0, 3, 0.4),
  );
  if (seats) for (let i = 0; i < Math.floor(len / 2.4); i++) { const s = stool(); s.position.set(-len / 2 + 1.2 + i * 2.4, 0, 2.6); g.add(s); }
  for (const x of [-len / 4, len / 4]) { // pendants
    g.add(cyl(0.02, 0.02, 2.2, M.black(), x, 7.2, 0.4, 4));
    g.add(cyl(0.3, 0.6, 0.6, BULB, x, 6.6, 0.4, 14));
  }
  return g;
}
export function vanity(len, color) {
  return group(box(len, 2.8, 1.8, surface('paint', color, { roughness: 0.5 })),
    box(len + 0.2, 0.15, 1.9, M.porcelain(), 0, 2.8, 0),
    box(len * 0.85, 2.6, 0.08, surface('paint', '#c9d4da', { metalness: 0.9, roughness: 0.05 }), 0, 3.8, -0.85));
}
export function toilet() {
  const p = M.porcelain();
  const bowl = prepare(new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), p));
  bowl.scale.set(1, 0.7, 1.3); bowl.position.set(0, 1.1, 0.3);
  return group(box(1.6, 1.4, 0.7, p, 0, 1.1, -0.65), cyl(0.45, 0.55, 1.1, p, 0, 0, 0.2, 14), bowl);
}
export function tub() {
  return group(box(5.4, 2, 2.8, M.porcelain()), box(4.8, 0.1, 2.2, surface('paint', '#bfe1ec', { roughness: 0.05 }), 0, 1.92, 0));
}
export function shower(w = 3.5, d = 3.5) {
  const glass = new THREE.MeshStandardMaterial({ color: '#cfe6ee', transparent: true, opacity: 0.25, roughness: 0.05 });
  return group(box(w, 0.25, d, surface('tile', '#e9e6e0')), box(w, 6.8, 0.05, glass, 0, 0.25, d / 2), box(0.05, 6.8, d, glass, -w / 2, 0.25, 0),
    cyl(0.3, 0.3, 0.06, M.steel(), 0, 6.6, -d / 2 + 0.6, 12));
}
export function desk(color) {
  return group(box(5, 0.2, 2.4, M.wood(color), 0, 2.4, 0), box(0.2, 2.4, 2.2, M.wood(color), -2.3, 0, 0), box(0.2, 2.4, 2.2, M.wood(color), 2.3, 0, 0),
    box(2.4, 1.5, 0.1, M.screen(), 0, 2.9, -0.7), box(0.2, 0.5, 0.2, M.black(), 0, 2.6, -0.75));
}
export function officeChair() {
  return group(cyl(0.9, 0.9, 0.15, M.black(), 0, 0, 0, 5), cyl(0.08, 0.08, 1.4, M.steel(), 0, 0, 0, 6), box(1.7, 0.3, 1.7, M.fabric('#3a3a3a'), 0, 1.5, 0), box(1.6, 2, 0.25, M.fabric('#3a3a3a'), 0, 1.8, -0.8));
}
export function bookshelf(len, color) {
  const g = group(box(len, 7, 1.2, M.wood(color)));
  const bookColors = ['#7b2f2f', '#2f4f6b', '#c9a24a', '#3e5e3a', '#5e4a7b', '#d8d2c4'];
  for (let s = 0; s < 5; s++) for (let i = 0, x = -len / 2 + 0.3; x < len / 2 - 0.3; x += 0.9, i++)
    g.add(box(0.8, 0.95, 0.9, surface('matte', bookColors[(s * 5 + i) % 6]), x + 0.4, 0.4 + s * 1.3, 0.2));
  return g;
}
export function washerDryer() {
  const g = new THREE.Group();
  for (const x of [-1.4, 1.4]) {
    g.add(box(2.5, 3.2, 2.5, M.white(), x, 0, 0));
    g.add(cyl(0.8, 0.8, 0.1, surface('paint', '#9fb3bd', { roughness: 0.1 }), x, 1.6, 1.25, 20).rotateX(Math.PI / 2));
  }
  return g;
}
export function shelves(len) {
  const g = new THREE.Group();
  for (let s = 0; s < 4; s++) g.add(box(len, 0.15, 1.5, M.white(), 0, 1 + s * 1.6, 0));
  return g;
}
export function gym() {
  return group(box(6, 0.1, 3, surface('matte', '#2d2d2d', { roughness: 1 }), 0, 0.1, 0), box(5.5, 0.6, 2.2, M.black(), 0, 0.2, 0),
    box(5, 4.5, 0.2, M.black(), 0, 0.8, -1), cyl(0.05, 0.05, 5, M.steel(), 0, 4.2, 0.2, 6).rotateZ(Math.PI / 2));
}
export function mediaWall(len) { return group(box(len, 4.6, 0.2, M.screen(), 0, 1.6, 0), box(len, 1.4, 1.2, M.black(), 0, 0, 0.4)); }
export function workbench() {
  return group(box(7, 0.4, 2.6, M.wood('#9a7b55'), 0, 3, 0), ...[[-3.2, -1], [3.2, -1], [-3.2, 1], [3.2, 1]].map(([x, z]) => box(0.3, 3, 0.3, M.wood('#9a7b55'), x, 0, z)),
    box(7, 3, 0.15, surface('paint', '#b7a98f'), 0, 4, -1.3));
}
export function wineRack(len) {
  const g = group(box(len, 6.5, 1.4, M.wood('#4b3426')));
  for (let s = 0; s < 6; s++) for (let x = -len / 2 + 0.4; x < len / 2 - 0.3; x += 0.6)
    g.add(cyl(0.2, 0.2, 0.1, surface('paint', '#3a1820', { roughness: 0.3 }), x + 0.2, 0.6 + s * 1, 0.7, 8).rotateX(Math.PI / 2));
  return g;
}
export function bench(color) { return group(box(4.5, 1.6, 1.4, M.wood(color)), box(4.5, 0.15, 0.1, M.black(), 0, 5.5, -0.6)); }
export function toyBoxes() {
  return group(...['#e2574c', '#f1b33b', '#4aa3df', '#6cc070'].map((c, i) => box(1.4, 1.4, 1.4, surface('paint', c), -2.4 + i * 1.6, 0, 0)));
}
