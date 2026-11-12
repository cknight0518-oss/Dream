// Style definitions shared by the interview cards and the 3D builder.

export const EXTERIOR_STYLES = {
  modern: {
    label: 'Modern',
    desc: 'Flat roofline, big glass, crisp geometric volumes.',
    roof: 'flat', body: '#f1f0ec', accent: '#2b2b2b', roofColor: '#3a3a3a', trim: '#222222',
    stories: 2, bigWindows: true, keyword: 'modern',
  },
  craftsman: {
    label: 'Craftsman',
    desc: 'Low gables, tapered porch columns, natural materials.',
    roof: 'gable-low', body: '#7d8b6a', roofColor: '#5a4636', trim: '#efe9dc',
    stories: 1, porch: 'front', keyword: 'craftsman',
  },
  farmhouse: {
    label: 'Modern Farmhouse',
    desc: 'Steep gables, white board-and-batten, black accents.',
    roof: 'gable-steep', body: '#f6f6f2', roofColor: '#2a2a2a', trim: '#1f1f1f',
    stories: 2, porch: 'wrap', keyword: 'farmhouse',
  },
  colonial: {
    label: 'Colonial',
    desc: 'Symmetrical two-story facade, shutters, centered door.',
    roof: 'gable', body: '#c8d0d8', roofColor: '#45484d', trim: '#ffffff', shutters: '#2c3e50',
    stories: 2, keyword: 'colonial',
  },
  ranch: {
    label: 'Ranch',
    desc: 'Single story, long and low, hipped roof.',
    roof: 'hip-low', body: '#cdb79e', roofColor: '#5d544c', trim: '#f4efe6',
    stories: 1, aspect: 2.4, keyword: 'ranch',
  },
  mediterranean: {
    label: 'Mediterranean',
    desc: 'Stucco walls, red clay tile roof, arches.',
    roof: 'hip-low', body: '#ead9bd', roofColor: '#b5532f', trim: '#6b4a2f',
    stories: 2, keyword: 'mediterranean',
  },
  victorian: {
    label: 'Victorian',
    desc: 'Steep roofs, a turret, ornate trim, bold color.',
    roof: 'gable-steep', body: '#7c5b8a', roofColor: '#3b3540', trim: '#f1e6d2',
    stories: 2, turret: true, porch: 'front', keyword: 'victorian',
  },
  tudor: {
    label: 'Tudor',
    desc: 'Steep gables, half-timbering, brick and stucco.',
    roof: 'gable-steep', body: '#efe6d2', roofColor: '#4a3f39', trim: '#3e2b1f',
    stories: 2, halfTimber: true, keyword: 'tudor',
  },
  capecod: {
    label: 'Cape Cod',
    desc: 'Compact, steep roof with dormers, shingle siding.',
    roof: 'gable-steep', body: '#a3a8ab', roofColor: '#3b3f43', trim: '#ffffff',
    stories: 1, dormers: true, keyword: 'cape cod',
  },
  midcentury: {
    label: 'Mid-Century Modern',
    desc: 'Single-slope roof, wood and glass, indoor-outdoor flow.',
    roof: 'shed', body: '#9a6b43', roofColor: '#3a3a3a', trim: '#2b2b2b',
    stories: 1, bigWindows: true, aspect: 2.0, keyword: 'mid century',
  },
};

export const EXTERIOR_PALETTES = {
  style: { label: "Style's typical colors", colors: null },
  white: { label: 'Classic white', colors: { body: '#f5f4f0', trim: '#2a2a2a', roofColor: '#3a3a3a' } },
  warm: { label: 'Warm neutral', colors: { body: '#d9c7a8', trim: '#f5efe3', roofColor: '#5b4b3d' } },
  gray: { label: 'Cool gray', colors: { body: '#9ea4a8', trim: '#ffffff', roofColor: '#3d4246' } },
  dark: { label: 'Dark & moody', colors: { body: '#2f3236', trim: '#c9a46a', roofColor: '#1e1f21' } },
  green: { label: 'Earthy green', colors: { body: '#6f7d5c', trim: '#ece6d6', roofColor: '#4a3c30' } },
  brick: { label: 'Red brick', colors: { body: '#9a4a35', trim: '#f2ede4', roofColor: '#3a3532' } },
  blue: { label: 'Coastal blue', colors: { body: '#7f9fb5', trim: '#ffffff', roofColor: '#4b5257' } },
};

export const INTERIOR_STYLES = {
  modern: { label: 'Modern', desc: 'Clean lines, minimal decor, neutral palette.',
    wall: '#f2f2f0', floor: '#bdb7ae', accent: '#2a2a2a', cabinet: '#ffffff', motif: 'window' },
  farmhouse: { label: 'Farmhouse', desc: 'Shiplap, warm wood, black hardware.',
    wall: '#f5f1e8', floor: '#9c7350', accent: '#2f3b2f', cabinet: '#ffffff', motif: 'shiplap' },
  midcentury: { label: 'Mid-Century', desc: 'Walnut, tapered legs, retro color pops.',
    wall: '#efe7da', floor: '#a0672f', accent: '#d98e2b', cabinet: '#8a5a32', motif: 'legs' },
  industrial: { label: 'Industrial', desc: 'Exposed brick, metal, concrete.',
    wall: '#8d6e63', floor: '#6b6560', accent: '#3a2f28', cabinet: '#3d3d3d', motif: 'brick' },
  scandinavian: { label: 'Scandinavian', desc: 'Light woods, white walls, cozy textiles.',
    wall: '#fafafa', floor: '#d9c3a0', accent: '#9fb3b0', cabinet: '#f3efe8', motif: 'pendant' },
  traditional: { label: 'Traditional', desc: 'Rich wood, classic moldings, symmetry.',
    wall: '#e9dcc6', floor: '#6e4527', accent: '#6b1f2a', cabinet: '#f0e6d6', motif: 'wainscot' },
  coastal: { label: 'Coastal', desc: 'Airy whites, soft blues, natural fibers.',
    wall: '#f4f8f9', floor: '#cdb995', accent: '#4f8fae', cabinet: '#ffffff', motif: 'stripes' },
  bohemian: { label: 'Bohemian', desc: 'Layered patterns, plants, global textiles.',
    wall: '#f1e3cf', floor: '#a8754a', accent: '#b5492f', cabinet: '#c9a77c', motif: 'plants' },
};

export const CABINET_COLORS = {
  white: { label: 'White', color: '#f7f7f5' },
  wood: { label: 'Natural wood', color: '#a0703f' },
  navy: { label: 'Navy', color: '#2d3e5c' },
  green: { label: 'Sage green', color: '#8a9a7b' },
  black: { label: 'Black', color: '#222222' },
  twotone: { label: 'Two-tone', color: '#f7f7f5', color2: '#2d3e5c' },
};

export const ROOF_MATERIAL_COLORS = {
  asphalt: null, // keep style/palette color
  metal: '#4a5056',
  tile: '#b5532f',
  slate: '#3c4148',
};
