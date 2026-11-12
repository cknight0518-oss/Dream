// Textured PBR materials for the 3D model. Textures are CC0 from Poly Haven
// (see assets/CREDITS.md). UVs are projected in world units (feet) so a
// texture keeps the same scale on every wall, roof and floor.
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const texCache = new Map();
const matCache = new Map();
let maxAniso = 8;
export function setMaxAnisotropy(n) { maxAniso = n; }

function tex(name, srgb) {
  if (!texCache.has(name)) {
    const t = loader.load(`assets/textures/${name}.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(name, t);
  }
  return texCache.get(name);
}

// size: feet covered by one copy of the texture. rotate: turn the pattern 90°.
const KINDS = {
  siding:     { map: 'siding', size: 5, rotate: true, roughness: 0.7 },
  batten:     { map: 'siding', size: 6, roughness: 0.7 },
  wood:       { map: 'deck', size: 6, rotate: true, roughness: 0.75 },
  stucco:     { map: 'stucco', size: 8, roughness: 0.95 },
  brick:      { map: 'brick', size: 3.5, roughness: 0.9 },
  stone:      { map: 'stone', size: 6, roughness: 0.95 },
  shingles:   { map: 'shingles', size: 8, roughness: 0.9 },
  metal_roof: { map: 'metal_roof', size: 6, roughness: 0.45, metalness: 0.5 },
  clay_tile:  { map: 'clay_tile', size: 7, roughness: 0.8 },
  slate:      { map: 'slate', size: 6, roughness: 0.75 },
  concrete:   { map: 'concrete', size: 10, roughness: 0.9 },
  pavers:     { map: 'pavers', size: 6, roughness: 0.9 },
  deck:       { map: 'deck', size: 6, roughness: 0.8 },
  grass:      { map: 'grass', size: 14, roughness: 1 },
  wood_floor: { map: 'wood_floor', size: 6, roughness: 0.55 },
  tile:       { map: 'tile', size: 4, roughness: 0.3 },
  paint:      { roughness: 0.6 },
  matte:      { roughness: 0.9 },
};

// Natural-color textures ignore the tint unless one is passed explicitly.
const NATURAL = new Set(['brick', 'stone', 'clay_tile', 'slate', 'concrete', 'pavers', 'deck', 'grass', 'tile', 'wood']);

export function surface(kind, color = '#ffffff', extra = {}) {
  const key = kind + color + JSON.stringify(extra);
  if (matCache.has(key)) return matCache.get(key);
  const k = KINDS[kind];
  const m = new THREE.MeshStandardMaterial({
    color: NATURAL.has(kind) && color === '#ffffff' ? '#ffffff' : color,
    roughness: k.roughness, metalness: k.metalness || 0, ...extra,
  });
  if (k.map) {
    m.map = tex(k.map, true);
    m.normalMap = tex(k.map + '_n', false);
    m.normalScale.set(1, 1);
    m.userData.uvSize = k.size;
    m.userData.uvRotate = !!k.rotate;
  }
  matCache.set(key, m);
  return m;
}

export const GLASS = new THREE.MeshStandardMaterial({ color: '#2f3d47', roughness: 0.06, metalness: 0.75 });
export const WATER = new THREE.MeshStandardMaterial({ color: '#2a8bbf', roughness: 0.04, metalness: 0.2 });

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _n = new THREE.Vector3(), _u = new THREE.Vector3(), _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// Planar-project UVs per triangle: u runs horizontally in the face, v up the
// face (or along the slope on roofs). Needs non-indexed geometry.
export function projectUVs(geometry, size, rotate) {
  const pos = geometry.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 3) {
    _a.fromBufferAttribute(pos, i); _b.fromBufferAttribute(pos, i + 1); _c.fromBufferAttribute(pos, i + 2);
    _n.subVectors(_c, _b).cross(_u.subVectors(_a, _b)).normalize();
    if (Math.abs(_n.y) > 0.95) _u.set(1, 0, 0);
    else _u.crossVectors(UP, _n).normalize();
    _v.crossVectors(_n, _u).normalize();
    for (let k = 0; k < 3; k++) {
      const p = k === 0 ? _a : k === 1 ? _b : _c;
      let s = p.dot(_u) / size, t = p.dot(_v) / size;
      if (rotate) [s, t] = [t, s];
      uv[(i + k) * 2] = s; uv[(i + k) * 2 + 1] = t;
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// Give a mesh world-scale UVs if its material is textured.
export function prepare(mesh) {
  const m = mesh.material;
  if (m?.userData?.uvSize) {
    if (mesh.geometry.index) mesh.geometry = mesh.geometry.toNonIndexed();
    projectUVs(mesh.geometry, m.userData.uvSize, m.userData.uvRotate);
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
