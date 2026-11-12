// Turns a dream-home profile into Zillow search criteria.
//
// Zillow has no public API for creating saved searches or alerts, so the app
// produces (1) a zillow.com search URL the user opens and saves with alerts
// turned on, and (2) a request body for the Zillow connector's
// `zillow_property_search` tool, so an assistant can run the same search.
//
// The zillow.com URL uses the `searchQueryState` parameter that the site
// itself writes to the address bar. It is not a documented API and Zillow can
// change it; if a filter stops applying, adjust it on the site before saving.
import { EXTERIOR_STYLES } from './styles-data.js';

const LOT_MIN = { quarter: 10890, half: 21780, acre: 43560 }; // sq ft per ¼, ½, 1 acre
const FLEX = {
  exact: { sqftLo: 1.0, sqftHi: 1.0, bedDrop: 0, bathDrop: 0 },
  some: { sqftLo: 0.9, sqftHi: 1.1, bedDrop: 1, bathDrop: 0.5 },
  loose: { sqftLo: 0.8, sqftHi: null, bedDrop: 1, bathDrop: 1 },
};

export function buildCriteria(p) {
  const must = new Set(p.mustHaves || []);
  const f = FLEX[p.flex] || FLEX.some;
  const [sqMin, sqMax] = p.sqft;
  const c = {
    location: (p.location || '').trim(),
    price: { min: p.budget[0], max: p.budget[1] },
    beds: { min: Math.max(1, p.bedrooms - f.bedDrop) },
    baths: { min: Math.max(1, Math.floor((p.bathrooms - f.bathDrop) * 2) / 2) },
    sqft: { min: Math.round(sqMin * f.sqftLo / 50) * 50, max: f.sqftHi ? Math.round(sqMax * f.sqftHi / 50) * 50 : null },
    homeType: p.homeType,
    keywords: [],
    singleStory: must.has('singleStory'),
    pool: must.has('pool'),
    garage: must.has('garage') ? Number(p.garage) : null,
    finishedBasement: must.has('basement'),
    view: must.has('view') ? p.view : null,
    lotMin: must.has('lot') ? (LOT_MIN[p.lot] ?? null) : null,
    builtMin: must.has('age') ? (p.age === 'new' ? new Date().getFullYear() - 1 : Number(p.age)) : null,
  };
  if (must.has('style')) c.keywords.push(EXTERIOR_STYLES[p.exteriorStyle].keyword);
  if (must.has('fireplace')) c.keywords.push('fireplace');
  if (must.has('primaryMain')) c.keywords.push('main floor primary');
  return c;
}

export function describeCriteria(c) {
  const money = (n) => '$' + n.toLocaleString('en-US');
  const lines = [
    `${c.location || '(no location yet)'}`,
    `${money(c.price.min)} – ${money(c.price.max)}`,
    `${c.beds.min}+ beds, ${c.baths.min}+ baths`,
    `${c.sqft.min.toLocaleString()}${c.sqft.max ? ' – ' + c.sqft.max.toLocaleString() : '+'} sq ft`,
    { singleFamily: 'Houses only', townhome: 'Townhomes only', condo: 'Condos only' }[c.homeType],
  ];
  if (c.singleStory) lines.push('Single story');
  if (c.garage) lines.push(`${c.garage}+ parking spots`);
  if (c.pool) lines.push('Pool');
  if (c.finishedBasement) lines.push('Finished basement');
  if (c.view) lines.push(`${c.view} view`);
  if (c.lotMin) lines.push(`Lot ≥ ${(c.lotMin / 43560).toFixed(2)} acres`);
  if (c.builtMin) lines.push(`Built ${c.builtMin}+`);
  if (c.keywords.length) lines.push(`Keywords: ${c.keywords.join(', ')}`);
  return lines;
}

export function zillowUrl(c) {
  const fs = {
    sort: { value: 'days' }, // newest first
    price: { min: c.price.min, max: c.price.max },
    beds: { min: c.beds.min },
    baths: { min: c.baths.min },
    sqft: c.sqft.max ? { min: c.sqft.min, max: c.sqft.max } : { min: c.sqft.min },
  };
  if (c.lotMin) fs.lot = { min: c.lotMin };
  if (c.builtMin) fs.built = { min: c.builtMin };
  if (c.singleStory) fs.singleStory = { value: true };
  if (c.pool) fs.pool = { value: true };
  if (c.garage) fs.parkingSpots = { min: c.garage };
  // Home types: switch off the ones not wanted.
  const off = { singleFamily: ['tow', 'mf', 'con', 'land', 'apa', 'manu', 'apco'],
    townhome: ['sf', 'mf', 'con', 'land', 'apa', 'manu', 'apco'],
    condo: ['sf', 'tow', 'mf', 'land', 'manu'] }[c.homeType] || [];
  for (const k of off) fs[k] = { value: false };
  const kw = [...c.keywords];
  if (c.finishedBasement) kw.push('finished basement');
  if (c.view) kw.push(`${c.view} view`);
  if (kw.length) fs.att = { value: kw.join(' ') };

  const state = { usersSearchTerm: c.location, isMapVisible: true, isListVisible: true, filterState: fs };
  const slug = c.location ? encodeURIComponent(c.location.replace(/\s+/g, '-')) + '_rb/' : '';
  return `https://www.zillow.com/homes/${slug}?searchQueryState=${encodeURIComponent(JSON.stringify(state))}`;
}

// Request body for the Zillow connector's zillow_property_search tool.
export function connectorRequest(c) {
  const pf = {
    salePrice: { min: c.price.min, max: c.price.max },
    bedrooms: { min: c.beds.min },
    bathrooms: { min: c.baths.min },
    livingAreaSqft: c.sqft.max ? { min: c.sqft.min, max: c.sqft.max } : { min: c.sqft.min },
    homeTypes: [c.homeType],
  };
  const showOnly = [];
  if (c.singleStory) showOnly.push('singleStory');
  if (c.pool) showOnly.push('pool');
  if (c.garage) { showOnly.push('garage'); pf.parkingSpots = { min: c.garage }; }
  if (showOnly.length) pf.saleShowOnly = showOnly;
  if (c.finishedBasement) pf.basementStatuses = ['finished'];
  if (c.view) pf.viewTypes = [c.view];
  if (c.lotMin) pf.lotSizeSqft = { min: c.lotMin };
  if (c.builtMin) pf.yearBuilt = { min: c.builtMin };
  if (c.keywords.length) pf.keywords = c.keywords.join(', ');
  return {
    request: {
      propertySearchRegionFiltersRequest: {
        propertySearchRegions: [{ name: c.location, regionDisplayName: c.location }],
        userSpecifiedPivotArea: c.location,
      },
      propertyFiltersRequest: pf,
    },
  };
}
