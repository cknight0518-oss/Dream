// The interview script. Each topic is one screen; each question records one
// field in the profile. `showIf` hides a question based on earlier answers.
import { EXTERIOR_STYLES, INTERIOR_STYLES, EXTERIOR_PALETTES, CABINET_COLORS } from './styles-data.js';
import { exteriorSVG, interiorSVG, paletteSVG, cabinetSVG } from './illustrations.js';

const exteriorCards = Object.entries(EXTERIOR_STYLES).map(([value, s]) => ({
  value, label: s.label, desc: s.desc, photo: `ext_${value}`, visual: () => exteriorSVG(value),
}));

const interiorCards = (withInherit) => [
  ...(withInherit ? [{ value: 'inherit', label: 'Same as the rest of the house', desc: 'Use the overall interior style.',
    photo: (p) => `int_${p.interiorStyle || 'modern'}`, visual: (p) => interiorSVG(p.interiorStyle || 'modern') }] : []),
  ...Object.entries(INTERIOR_STYLES).map(([value, s]) => ({
    value, label: s.label, desc: s.desc, photo: `int_${value}`, visual: () => interiorSVG(value),
  })),
];

const opts = (pairs) => pairs.map(([value, label]) => ({ value, label }));

export const TOPICS = [
  {
    id: 'location', title: 'Location & budget',
    intro: 'Start with where and how much. These drive the Zillow search more than anything else.',
    questions: [
      { id: 'location', type: 'text', prompt: 'Where do you want to live?', placeholder: 'City, ST or ZIP (e.g. Denver, CO)', default: '' },
      { id: 'budget', type: 'range', prompt: 'What price range?', prefix: '$', step: 25000, min: 50000, max: 10000000, default: [400000, 700000] },
      { id: 'homeType', type: 'choice', prompt: 'What type of home?', default: 'singleFamily',
        options: opts([['singleFamily', 'Single-family house'], ['townhome', 'Townhome'], ['condo', 'Condo']]) },
      { id: 'view', type: 'choice', prompt: 'Any view you want?', default: 'none',
        options: opts([['none', 'No preference'], ['water', 'Water'], ['mountain', 'Mountain'], ['city', 'City'], ['park', 'Park']]) },
    ],
  },
  {
    id: 'size', title: 'Size & layout',
    questions: [
      { id: 'sqft', type: 'range', prompt: 'How much living space (square feet)?', step: 100, min: 400, max: 20000, default: [2200, 3200] },
      { id: 'stories', type: 'choice', prompt: 'How many stories?', default: '2',
        options: opts([['1', 'One'], ['2', 'Two'], ['3', 'Three']]) },
      { id: 'lot', type: 'choice', prompt: 'Lot size?', default: 'quarter',
        options: opts([['any', 'No preference'], ['small', 'Under ¼ acre'], ['quarter', '¼ – ½ acre'], ['half', '½ – 1 acre'], ['acre', '1+ acres']]) },
      { id: 'age', type: 'choice', prompt: 'How new should it be?', default: 'any',
        options: opts([['any', 'Any age'], ['1990', 'Built 1990 or later'], ['2010', 'Built 2010 or later'], ['new', 'New construction']]) },
    ],
  },
  {
    id: 'exterior', title: 'Exterior',
    intro: 'Pick the look that feels most like home from the street.',
    questions: [
      { id: 'exteriorStyle', type: 'cards', prompt: 'Which exterior style?', default: 'craftsman', options: exteriorCards },
      { id: 'exteriorPalette', type: 'cards', small: true, prompt: 'Color scheme?', default: 'style',
        options: Object.entries(EXTERIOR_PALETTES).map(([value, p]) => ({ value, label: p.label, photo: (prof) => value === 'style' ? `ext_${prof.exteriorStyle}` : `pal_${value}`,
          swatch: p.colors ? [p.colors.body, p.colors.trim, p.colors.roofColor] : null, visual: () => paletteSVG(value) })) },
      { id: 'siding', type: 'choice', prompt: 'Main exterior material?', default: 'siding',
        options: opts([['siding', 'Lap siding'], ['batten', 'Board & batten'], ['brick', 'Brick'], ['stone', 'Stone'], ['stucco', 'Stucco'], ['wood', 'Natural wood'], ['mixed', 'Mixed']]) },
      { id: 'roofMaterial', type: 'choice', prompt: 'Roof material?', default: 'asphalt',
        options: opts([['asphalt', 'Asphalt shingle'], ['metal', 'Standing-seam metal'], ['tile', 'Clay tile'], ['slate', 'Slate']]) },
    ],
  },
  {
    id: 'outdoor', title: 'Outdoor spaces',
    questions: [
      { id: 'garage', type: 'choice', prompt: 'Garage?', default: '2',
        options: opts([['0', 'None'], ['1', '1 car'], ['2', '2 car'], ['3', '3 car'], ['4', '4+ car']]) },
      { id: 'porch', type: 'choice', prompt: 'Front porch?', default: 'style',
        options: opts([['style', 'Whatever fits the style'], ['none', 'No porch'], ['front', 'Front porch'], ['wrap', 'Wraparound porch']]) },
      { id: 'outdoorFeatures', type: 'multi', prompt: 'What else outside?', default: ['patio'],
        options: opts([['pool', 'Pool'], ['deck', 'Deck'], ['patio', 'Patio'], ['fence', 'Fenced yard'], ['garden', 'Garden beds'], ['outdoorKitchen', 'Outdoor kitchen'], ['hottub', 'Hot tub']]) },
    ],
  },
  {
    id: 'interior', title: 'Interior style',
    intro: 'This sets the default look for every room. You can change individual rooms later.',
    questions: [
      { id: 'interiorStyle', type: 'cards', prompt: 'Which interior style?', default: 'scandinavian', options: interiorCards(false) },
      { id: 'floorPlan', type: 'choice', prompt: 'Floor plan?', default: 'open',
        options: opts([['open', 'Open concept'], ['semi', 'Semi-open'], ['separate', 'Separate rooms']]) },
      { id: 'ceilings', type: 'choice', prompt: 'Ceilings?', default: '9',
        options: opts([['9', 'Standard (8–9 ft)'], ['10', '10 ft'], ['vaulted', 'Vaulted / high']]) },
      { id: 'flooring', type: 'choice', prompt: 'Main flooring?', default: 'hardwood',
        options: opts([['hardwood', 'Hardwood'], ['lvp', 'Luxury vinyl plank'], ['tile', 'Tile'], ['concrete', 'Polished concrete'], ['mixed', 'Mixed']]) },
    ],
  },
  {
    id: 'living', title: 'Living areas',
    questions: [
      { id: 'livingFeatures', type: 'multi', prompt: 'What do you want in the living spaces?', default: ['light'],
        options: opts([['fireplace', 'Fireplace'], ['builtins', 'Built-in shelving'], ['light', 'Lots of natural light'], ['formalDining', 'Formal dining room'], ['wetbar', 'Wet bar'], ['smartHome', 'Smart home wiring']]) },
    ],
  },
  {
    id: 'kitchen', title: 'Kitchen',
    questions: [
      { id: 'kitchenStyle', type: 'cards', small: true, prompt: 'Kitchen style?', default: 'inherit', options: interiorCards(true) },
      { id: 'kitchenLayout', type: 'choice', prompt: 'Layout?', default: 'island',
        options: opts([['island', 'Island'], ['peninsula', 'Peninsula'], ['lshape', 'L-shaped'], ['ushape', 'U-shaped'], ['galley', 'Galley']]) },
      { id: 'cabinets', type: 'cards', small: true, prompt: 'Cabinet color?', default: 'white',
        options: Object.entries(CABINET_COLORS).map(([value, c]) => ({ value, label: c.label, photo: `cab_${value}`,
          swatch: [c.color, c.color2 || c.color], visual: () => cabinetSVG(value) })) },
      { id: 'countertops', type: 'choice', prompt: 'Countertops?', default: 'quartz',
        options: opts([['quartz', 'Quartz'], ['granite', 'Granite'], ['marble', 'Marble'], ['butcher', 'Butcher block'], ['concrete', 'Concrete']]) },
      { id: 'kitchenFeatures', type: 'multi', prompt: 'Kitchen must-haves?', default: ['pantry'],
        options: opts([['pantry', 'Walk-in pantry'], ['doubleOven', 'Double ovens'], ['gasRange', 'Gas range'], ['butlers', "Butler's pantry"], ['nook', 'Breakfast nook'], ['islandSeating', 'Island seating']]) },
    ],
  },
  {
    id: 'bedrooms', title: 'Bedrooms',
    questions: [
      { id: 'bedrooms', type: 'number', prompt: 'How many bedrooms?', min: 1, max: 8, step: 1, default: 4 },
      { id: 'primaryLocation', type: 'choice', prompt: 'Where should the primary bedroom be?', default: 'any',
        showIf: (p) => p.stories !== '1',
        options: opts([['any', 'No preference'], ['main', 'Main floor'], ['upper', 'Upstairs with the other bedrooms']]) },
      { id: 'bedroomStyle', type: 'cards', small: true, prompt: 'Bedroom style?', default: 'inherit', options: interiorCards(true) },
      { id: 'primaryFeatures', type: 'multi', prompt: 'Primary suite features?', default: ['walkin'],
        options: opts([['walkin', 'Walk-in closet'], ['sitting', 'Sitting area'], ['balcony', 'Balcony'], ['fireplace', 'Fireplace']]) },
    ],
  },
  {
    id: 'bathrooms', title: 'Bathrooms',
    questions: [
      { id: 'bathrooms', type: 'number', prompt: 'How many bathrooms?', help: 'Use .5 for a half bath (toilet + sink).', min: 1, max: 7, step: 0.5, default: 2.5 },
      { id: 'bathroomStyle', type: 'cards', small: true, prompt: 'Bathroom style?', default: 'inherit', options: interiorCards(true) },
      { id: 'primaryBath', type: 'multi', prompt: 'Primary bathroom features?', default: ['shower', 'doubleVanity'],
        options: opts([['tub', 'Soaking tub'], ['shower', 'Walk-in shower'], ['doubleVanity', 'Double vanity'], ['heatedFloors', 'Heated floors'], ['wc', 'Separate water closet'], ['steam', 'Steam shower']]) },
    ],
  },
  {
    id: 'bonus', title: 'Bonus rooms',
    questions: [
      { id: 'bonusRooms', type: 'multi', prompt: 'Which extra rooms do you want?', default: ['office'],
        options: opts([['office', 'Home office'], ['gym', 'Gym'], ['media', 'Media room'], ['playroom', 'Playroom'], ['library', 'Library'], ['guest', 'Guest suite'], ['mudroom', 'Mudroom'], ['sunroom', 'Sunroom'], ['wine', 'Wine cellar'], ['craft', 'Craft room'], ['workshop', 'Workshop']]) },
      { id: 'basement', type: 'choice', prompt: 'Basement?', default: 'none',
        options: opts([['none', 'No basement'], ['unfinished', 'Unfinished'], ['finished', 'Finished'], ['walkout', 'Finished walkout']]) },
      { id: 'bonusStyle', type: 'cards', small: true, prompt: 'Bonus room style?', default: 'inherit', options: interiorCards(true) },
    ],
  },
  {
    id: 'priorities', title: 'Deal-breakers',
    intro: 'Real listings rarely match everything. Pick only the things a home must have. These become hard filters in the Zillow search; everything else is just for your 3D model.',
    questions: [
      { id: 'mustHaves', type: 'multi', prompt: 'A listing must have…', default: [], options: (p) => mustHaveOptions(p) },
      { id: 'flex', type: 'choice', prompt: 'How strict on size and bedrooms?', default: 'some',
        options: opts([['exact', 'Exact: at least what I asked for'], ['some', 'A little flexible (±10% size, 1 fewer bedroom ok)'], ['loose', 'Very flexible']]) },
    ],
  },
];

export function mustHaveOptions(p) {
  const o = [];
  const style = EXTERIOR_STYLES[p.exteriorStyle];
  if (style) o.push({ value: 'style', label: `${style.label} style` });
  if (p.stories === '1') o.push({ value: 'singleStory', label: 'Single story' });
  if (p.garage && p.garage !== '0') o.push({ value: 'garage', label: `${p.garage}+ car garage` });
  if ((p.outdoorFeatures || []).includes('pool')) o.push({ value: 'pool', label: 'Pool' });
  if (p.basement === 'finished' || p.basement === 'walkout') o.push({ value: 'basement', label: 'Finished basement' });
  if ((p.livingFeatures || []).includes('fireplace')) o.push({ value: 'fireplace', label: 'Fireplace' });
  if (p.view && p.view !== 'none') o.push({ value: 'view', label: `${p.view[0].toUpperCase()}${p.view.slice(1)} view` });
  if (p.lot && p.lot !== 'any') o.push({ value: 'lot', label: 'Minimum lot size' });
  if (p.age && p.age !== 'any') o.push({ value: 'age', label: p.age === 'new' ? 'New construction' : `Built ${p.age}+` });
  if (p.primaryLocation === 'main') o.push({ value: 'primaryMain', label: 'Main-floor primary bedroom' });
  return o;
}

export function defaultProfile() {
  const p = {};
  for (const t of TOPICS) for (const q of t.questions) p[q.id] = structuredClone(q.default);
  return p;
}

// Resolve "inherit" room styles to an actual style key.
export function roomStyle(p, field) {
  const v = p[field];
  return !v || v === 'inherit' ? p.interiorStyle : v;
}
