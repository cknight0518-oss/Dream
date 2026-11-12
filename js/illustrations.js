// SVG illustrations for the style cards. Generated from the same data the
// 3D builder uses, so a card and the model stay visually consistent.
import { EXTERIOR_STYLES, INTERIOR_STYLES, EXTERIOR_PALETTES, CABINET_COLORS } from './styles-data.js';

const SKY = '#dfeaf2';
const GRASS = '#8fae74';
const GLASS = '#9cc0d6';

function win(x, y, w, h, trim) {
  return `<rect x="${x - 1}" y="${y - 1}" width="${w + 2}" height="${h + 2}" fill="${trim}"/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${GLASS}"/>`;
}

export function exteriorSVG(key) {
  const s = EXTERIOR_STYLES[key];
  const W = 200, H = 140, ground = 118;
  const bodyW = s.aspect && s.aspect > 2 ? 140 : 110;
  const x0 = (W - bodyW) / 2;
  const storyH = 30;
  const stories = s.stories;
  const bodyTop = ground - storyH * stories;
  let out = `<rect width="${W}" height="${H}" fill="${SKY}"/>`;
  out += `<rect y="${ground}" width="${W}" height="${H - ground}" fill="${GRASS}"/>`;

  // roof
  const ov = 8;
  const L = x0 - ov, R = x0 + bodyW + ov, mid = W / 2;
  const roofH = { 'gable-low': 22, gable: 30, 'gable-steep': 44, 'hip-low': 20, flat: 0, shed: 0 }[s.roof] ?? 26;
  if (s.roof.startsWith('gable')) {
    out += `<polygon points="${L},${bodyTop} ${mid},${bodyTop - roofH} ${R},${bodyTop}" fill="${s.roofColor}"/>`;
  } else if (s.roof === 'hip-low') {
    out += `<polygon points="${L},${bodyTop} ${x0 + 30},${bodyTop - roofH} ${x0 + bodyW - 30},${bodyTop - roofH} ${R},${bodyTop}" fill="${s.roofColor}"/>`;
  }

  // body
  out += `<rect x="${x0}" y="${bodyTop}" width="${bodyW}" height="${ground - bodyTop}" fill="${s.body}"/>`;
  if (s.accent) out += `<rect x="${x0 + bodyW * 0.55}" y="${bodyTop}" width="${bodyW * 0.45}" height="${storyH}" fill="${s.accent}"/>`;
  if (s.roof === 'flat') out += `<rect x="${x0 - 4}" y="${bodyTop - 5}" width="${bodyW + 8}" height="6" fill="${s.roofColor}"/>`;
  if (s.roof === 'shed') out += `<polygon points="${L},${bodyTop + 2} ${R},${bodyTop - 14} ${R},${bodyTop - 9} ${L},${bodyTop + 7}" fill="${s.roofColor}"/>` +
    `<polygon points="${x0},${bodyTop + 4} ${x0 + bodyW},${bodyTop - 10} ${x0 + bodyW},${bodyTop}" fill="${s.body}"/>`;

  // half timbering
  if (s.halfTimber) {
    for (let i = 0; i <= 6; i++) out += `<rect x="${x0 + i * (bodyW / 6) - 1.5}" y="${bodyTop}" width="3" height="${storyH}" fill="${s.trim}"/>`;
    out += `<rect x="${x0}" y="${bodyTop + storyH - 2}" width="${bodyW}" height="3" fill="${s.trim}"/>`;
    out += `<line x1="${x0 + 10}" y1="${bodyTop - 2}" x2="${mid}" y2="${bodyTop - roofH + 12}" stroke="${s.trim}" stroke-width="3"/>`;
    out += `<line x1="${x0 + bodyW - 10}" y1="${bodyTop - 2}" x2="${mid}" y2="${bodyTop - roofH + 12}" stroke="${s.trim}" stroke-width="3"/>`;
  }

  // windows
  for (let st = 0; st < stories; st++) {
    const wy = ground - storyH * (st + 1) + 7;
    const n = s.bigWindows ? 2 : 4;
    const ww = s.bigWindows ? 34 : 12;
    for (let i = 0; i < n; i++) {
      const cx = x0 + (bodyW / (n + 1)) * (i + 1);
      if (st === 0 && Math.abs(cx - mid) < 14 && !s.bigWindows) continue;
      out += win(cx - ww / 2, wy, ww, s.bigWindows ? 18 : 15, s.trim);
      if (s.shutters) out += `<rect x="${cx - ww / 2 - 6}" y="${wy}" width="4" height="15" fill="${s.shutters}"/><rect x="${cx + ww / 2 + 2}" y="${wy}" width="4" height="15" fill="${s.shutters}"/>`;
    }
  }
  // door
  const doorX = s.bigWindows ? x0 + bodyW / 2 - 7 : mid - 7;
  out += `<rect x="${doorX}" y="${ground - 22}" width="14" height="22" fill="${s.trim === '#ffffff' || s.trim === '#efe9dc' || s.trim === '#f1e6d2' || s.trim === '#f4efe6' ? '#5a3b2a' : s.trim}"/>`;
  if (key === 'mediterranean') out += `<path d="M${doorX - 3},${ground} v-20 a10,10 0 0 1 20,0 v20" fill="none" stroke="${s.trim}" stroke-width="2"/>`;

  // dormers
  if (s.dormers) {
    for (const dx of [-30, 30]) {
      const cx = mid + dx, by = bodyTop - 14;
      out += `<rect x="${cx - 8}" y="${by}" width="16" height="12" fill="${s.body}"/>`;
      out += `<polygon points="${cx - 11},${by} ${cx},${by - 9} ${cx + 11},${by}" fill="${s.roofColor}"/>`;
      out += win(cx - 4, by + 2, 8, 8, s.trim);
    }
  }
  // turret
  if (s.turret) {
    const tx = x0 - 6, tw = 26, ty = bodyTop - 10;
    out += `<rect x="${tx}" y="${ty}" width="${tw}" height="${ground - ty}" fill="${s.body}" stroke="${s.trim}" stroke-width="1"/>`;
    out += `<polygon points="${tx - 4},${ty} ${tx + tw / 2},${ty - 34} ${tx + tw + 4},${ty}" fill="${s.roofColor}"/>`;
    out += win(tx + 8, ty + 10, 10, 14, s.trim) + win(tx + 8, ty + 42, 10, 14, s.trim);
  }
  // porch
  if (s.porch) {
    const py = ground - storyH + 2;
    const pL = s.porch === 'wrap' ? x0 - 4 : mid - 34, pR = s.porch === 'wrap' ? x0 + bodyW + 4 : mid + 34;
    out += `<rect x="${pL}" y="${py - 4}" width="${pR - pL}" height="5" fill="${s.roofColor}"/>`;
    for (let px = pL + 3; px <= pR - 3; px += (pR - pL - 6) / 4) out += `<rect x="${px - 1.5}" y="${py}" width="3" height="${ground - py}" fill="${s.trim === '#1f1f1f' ? '#1f1f1f' : '#f4f1ea'}"/>`;
    out += `<rect x="${pL}" y="${ground - 3}" width="${pR - pL}" height="3" fill="#8c7b6b"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${s.label} house">${out}</svg>`;
}

export function interiorSVG(key) {
  const s = INTERIOR_STYLES[key];
  const W = 200, H = 140, floorY = 96;
  let out = `<rect width="${W}" height="${floorY}" fill="${s.wall}"/>`;
  out += `<polygon points="0,${floorY} ${W},${floorY} ${W},${H} 0,${H}" fill="${s.floor}"/>`;
  switch (s.motif) {
    case 'shiplap':
      for (let y = 8; y < floorY; y += 9) out += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#00000014" stroke-width="1"/>`;
      break;
    case 'brick':
      for (let y = 0, r = 0; y < floorY; y += 8, r++)
        for (let x = (r % 2) * -10; x < W; x += 20) out += `<rect x="${x + 1}" y="${y + 1}" width="18" height="6" fill="#9d5a45"/>`;
      break;
    case 'wainscot':
      out += `<rect y="${floorY - 34}" width="${W}" height="34" fill="#ffffff"/>`;
      for (let x = 8; x < W; x += 32) out += `<rect x="${x}" y="${floorY - 28}" width="24" height="22" fill="none" stroke="#d8d0c2"/>`;
      break;
    case 'stripes':
      for (let x = 0; x < W; x += 16) out += `<rect x="${x}" y="0" width="7" height="${floorY}" fill="#e3eef2"/>`;
      break;
  }
  // window
  const big = s.motif === 'window';
  out += `<rect x="${big ? 20 : 120}" y="12" width="${big ? 160 : 56}" height="${big ? 56 : 46}" fill="#ffffff"/>`;
  out += `<rect x="${big ? 23 : 123}" y="15" width="${big ? 154 : 50}" height="${big ? 50 : 40}" fill="#cfe3ee"/>`;
  // rug
  out += `<ellipse cx="80" cy="${floorY + 26}" rx="60" ry="9" fill="${s.accent}" opacity="0.35"/>`;
  // sofa
  out += `<rect x="30" y="${floorY - 6}" width="96" height="22" rx="5" fill="${s.accent}"/>`;
  out += `<rect x="30" y="${floorY - 20}" width="96" height="18" rx="5" fill="${s.accent}" opacity="0.85"/>`;
  if (s.motif === 'legs') {
    out += `<line x1="38" y1="${floorY + 16}" x2="34" y2="${floorY + 26}" stroke="#5a3b22" stroke-width="3"/>`;
    out += `<line x1="118" y1="${floorY + 16}" x2="122" y2="${floorY + 26}" stroke="#5a3b22" stroke-width="3"/>`;
  }
  if (s.motif === 'pendant') {
    out += `<line x1="160" y1="0" x2="160" y2="30" stroke="#555"/><path d="M150,40 a10,10 0 0 1 20,0 z" fill="#e6d8bf"/>`;
  }
  if (s.motif === 'plants') {
    out += `<rect x="150" y="${floorY + 2}" width="14" height="16" fill="#b5492f"/>`;
    for (const [dx, dy] of [[-8, -12], [0, -20], [8, -12], [-4, -6], [5, -7]]) out += `<ellipse cx="${157 + dx}" cy="${floorY + dy}" rx="6" ry="9" fill="#4f7a3a"/>`;
  }
  // side table + lamp
  out += `<rect x="140" y="${floorY + 6}" width="${s.motif === 'plants' ? 0 : 20}" height="14" fill="${s.cabinet}" stroke="#00000020"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${s.label} interior">${out}</svg>`;
}

export function swatchSVG(colors) {
  const W = 200, H = 140;
  const n = colors.length;
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">` +
    colors.map((c, i) => `<rect x="${(W / n) * i}" y="0" width="${W / n + 1}" height="${H}" fill="${c}"/>`).join('') + '</svg>';
}

export function paletteSVG(key) {
  const p = EXTERIOR_PALETTES[key];
  if (!p.colors) return swatchSVG(['#c8d0d8', '#7d8b6a', '#ead9bd', '#f6f6f2']);
  return swatchSVG([p.colors.body, p.colors.body, p.colors.trim, p.colors.roofColor]);
}

export function cabinetSVG(key) {
  const c = CABINET_COLORS[key];
  const W = 200, H = 140;
  const upper = c.color, lower = c.color2 || c.color;
  let out = `<rect width="${W}" height="${H}" fill="#eeeae4"/>`;
  out += `<rect x="10" y="62" width="180" height="6" fill="#e9e6e1" stroke="#cfcac2"/>`;
  for (let i = 0; i < 4; i++) {
    out += `<rect x="${12 + i * 45}" y="10" width="41" height="40" fill="${upper}" stroke="#00000030"/>`;
    out += `<rect x="${12 + i * 45}" y="70" width="41" height="56" fill="${lower}" stroke="#00000030"/>`;
    out += `<rect x="${28 + i * 45}" y="78" width="10" height="2" fill="#555"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${out}</svg>`;
}
