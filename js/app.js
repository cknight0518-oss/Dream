import { TOPICS, defaultProfile, mustHaveOptions } from './questions.js';
import { EXTERIOR_STYLES, EXTERIOR_PALETTES, INTERIOR_STYLES, CABINET_COLORS } from './styles-data.js';
import { buildCriteria, describeCriteria, zillowUrl, connectorRequest } from './zillow.js';
import { HouseViewer } from './house3d.js';
import { PHOTOS } from './photos.js';

const STORE = 'dreamhome.v1';
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let state = load();
let viewer = null;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    if (saved?.profile) return { step: saved.step ?? 0, profile: { ...defaultProfile(), ...saved.profile }, visited: saved.visited || [] };
  } catch { /* storage unavailable or corrupt */ }
  return { step: 0, profile: defaultProfile(), visited: [] };
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* ignore */ }
}

// ---------- Sidebar ----------

function renderNav() {
  const nav = $('#topics');
  nav.innerHTML = TOPICS.map((t, i) => {
    const cls = [i === state.step ? 'current' : '', state.visited.includes(t.id) ? 'done' : ''].join(' ');
    return `<li><button class="${cls}" data-step="${i}"><span class="num">${i + 1}</span>${esc(t.title)}</button></li>`;
  }).join('') + `<li><button class="${state.step === 'results' ? 'current' : ''} results-link" data-step="results"><span class="num">★</span>Your dream home</button></li>`;
  nav.querySelectorAll('button').forEach((b) => b.onclick = () => go(b.dataset.step === 'results' ? 'results' : Number(b.dataset.step)));
  const pct = state.step === 'results' ? 100 : Math.round((state.step / TOPICS.length) * 100);
  $('#progress-bar').style.width = pct + '%';
}

function go(step) {
  if (typeof state.step === 'number') markVisited(TOPICS[state.step].id);
  state.step = step;
  save();
  render();
  window.scrollTo({ top: 0 });
}
function markVisited(id) { if (!state.visited.includes(id)) state.visited.push(id); }

// ---------- Interview screen ----------

function optionList(q) { return typeof q.options === 'function' ? q.options(state.profile) : q.options; }

// Photo for a card option, if one is on file. Records it for the credits list.
let creditsOnPage = new Map();
function cardVisual(o, p) {
  const key = typeof o.photo === 'function' ? o.photo(p) : o.photo;
  const ph = key && PHOTOS[key];
  if (!ph) return o.visual(p);
  creditsOnPage.set(key, ph);
  const sw = o.swatch ? `<div class="swatch">${o.swatch.map((c) => `<span style="background:${c}"></span>`).join('')}</div>` : '';
  return `<img src="assets/cards/${key}.jpg" alt="" loading="lazy" title="${esc(credit(ph))}">${sw}`;
}
const credit = (ph) => `${ph.artist || 'Unknown'}, ${ph.license}`;

function creditsBlock() {
  if (!creditsOnPage.size) return '';
  const items = [...creditsOnPage.values()].map((ph) =>
    `<li><a href="${esc(ph.page)}" target="_blank" rel="noopener">${esc(ph.title.replace(/^File:/, ''))}</a> by ${esc(ph.artist || 'unknown')}, ` +
    (ph.licenseUrl ? `<a href="${esc(ph.licenseUrl)}" target="_blank" rel="noopener">${esc(ph.license)}</a>` : esc(ph.license)) + '</li>').join('');
  return `<details class="credits"><summary>Photo credits</summary><ul>${items}</ul></details>`;
}

function renderQuestion(q) {
  const p = state.profile;
  const v = p[q.id];
  const head = `<h3>${esc(q.prompt)}</h3>${q.help ? `<p class="help">${esc(q.help)}</p>` : ''}`;
  switch (q.type) {
    case 'cards':
      return head + `<div class="cards ${q.small ? 'small' : ''}" role="radiogroup">` + optionList(q).map((o) => `
        <button class="card ${v === o.value ? 'selected' : ''}" role="radio" aria-checked="${v === o.value}" data-q="${q.id}" data-v="${o.value}">
          <div class="visual">${cardVisual(o, p)}</div>
          <div class="card-text"><strong>${esc(o.label)}</strong>${o.desc ? `<span>${esc(o.desc)}</span>` : ''}</div>
        </button>`).join('') + '</div>';
    case 'choice':
      return head + '<div class="chips" role="radiogroup">' + optionList(q).map((o) =>
        `<button class="chip ${v === o.value ? 'selected' : ''}" role="radio" aria-checked="${v === o.value}" data-q="${q.id}" data-v="${o.value}">${esc(o.label)}</button>`).join('') + '</div>';
    case 'multi': {
      const opts = optionList(q);
      if (!opts.length) return head + '<p class="help">Nothing to choose here yet. Your earlier answers didn\'t include any optional features that could be hard filters.</p>';
      return head + '<div class="chips">' + opts.map((o) =>
        `<button class="chip multi ${v.includes(o.value) ? 'selected' : ''}" aria-pressed="${v.includes(o.value)}" data-q="${q.id}" data-v="${o.value}" data-multi="1">${esc(o.label)}</button>`).join('') + '</div>';
    }
    case 'number':
      return head + `<div class="stepper"><button data-q="${q.id}" data-step="-1" aria-label="Decrease">−</button>
        <output id="out-${q.id}">${v}</output><button data-q="${q.id}" data-step="1" aria-label="Increase">+</button></div>`;
    case 'range':
      return head + `<div class="range">
        <label>Min <span class="affix">${q.prefix || ''}</span><input type="number" inputmode="numeric" data-q="${q.id}" data-i="0" value="${v[0]}" step="${q.step}" min="${q.min}" max="${q.max}"></label>
        <label>Max <span class="affix">${q.prefix || ''}</span><input type="number" inputmode="numeric" data-q="${q.id}" data-i="1" value="${v[1]}" step="${q.step}" min="${q.min}" max="${q.max}"></label>
      </div>`;
    case 'text':
      return head + `<input class="text" type="text" data-q="${q.id}" value="${esc(v)}" placeholder="${esc(q.placeholder || '')}">`;
  }
  return '';
}

function renderTopic() {
  const t = TOPICS[state.step];
  // Drop must-haves that no longer apply.
  if (t.id === 'priorities') {
    const valid = new Set(mustHaveOptions(state.profile).map((o) => o.value));
    state.profile.mustHaves = state.profile.mustHaves.filter((m) => valid.has(m));
  }
  const qs = t.questions.filter((q) => !q.showIf || q.showIf(state.profile));
  const last = state.step === TOPICS.length - 1;
  creditsOnPage = new Map();
  const body = qs.map((q) => `<div class="question" id="q-${q.id}">${renderQuestion(q)}</div>`).join('');
  $('#main').innerHTML = `
    <section class="topic">
      <p class="eyebrow">Step ${state.step + 1} of ${TOPICS.length}</p>
      <h2>${esc(t.title)}</h2>
      ${t.intro ? `<p class="intro">${esc(t.intro)}</p>` : ''}
      ${body}
      <div class="nav-buttons">
        ${state.step > 0 ? '<button class="secondary" id="back">Back</button>' : '<span></span>'}
        <button class="primary" id="next">${last ? 'Build my dream home' : 'Next'}</button>
      </div>
      ${creditsBlock()}
    </section>`;
  $('#back')?.addEventListener('click', () => go(state.step - 1));
  $('#next').onclick = () => go(last ? 'results' : state.step + 1);
  bindInputs(t);
}

function bindInputs(t) {
  const main = $('#main');
  main.querySelectorAll('[data-v]').forEach((b) => b.onclick = () => {
    const id = b.dataset.q;
    let val = b.dataset.v;
    if (b.dataset.multi) {
      const cur = new Set(state.profile[id]);
      cur.has(val) ? cur.delete(val) : cur.add(val);
      state.profile[id] = [...cur];
    } else state.profile[id] = val;
    save();
    // Re-render because some questions depend on others (showIf, inherit cards).
    const y = window.scrollY;
    renderTopic();
    window.scrollTo({ top: y });
  });
  main.querySelectorAll('[data-step]').forEach((b) => b.onclick = () => {
    const q = t.questions.find((x) => x.id === b.dataset.q);
    const nv = Math.min(q.max, Math.max(q.min, state.profile[q.id] + q.step * Number(b.dataset.step)));
    state.profile[q.id] = nv;
    $(`#out-${q.id}`).textContent = nv;
    save();
  });
  main.querySelectorAll('input[data-i]').forEach((inp) => inp.onchange = () => {
    const q = t.questions.find((x) => x.id === inp.dataset.q);
    const arr = [...state.profile[q.id]];
    const n = Math.min(q.max, Math.max(q.min, Number(inp.value) || q.min));
    arr[Number(inp.dataset.i)] = n;
    if (arr[0] > arr[1]) arr.sort((a, b) => a - b);
    state.profile[q.id] = arr;
    save();
    renderTopic();
  });
  main.querySelectorAll('input.text').forEach((inp) => inp.oninput = () => { state.profile[inp.dataset.q] = inp.value; save(); });
}

// ---------- Results ----------

function label(topicId, qid, value) {
  const q = TOPICS.find((t) => t.id === topicId).questions.find((x) => x.id === qid);
  const list = typeof q.options === 'function' ? q.options(state.profile) : q.options || [];
  const one = (v) => list.find((o) => o.value === v)?.label ?? v;
  return Array.isArray(value) ? (value.length ? value.map(one).join(', ') : 'None') : one(value);
}

function summarySections() {
  const p = state.profile;
  const rs = (field) => p[field] === 'inherit' ? `${INTERIOR_STYLES[p.interiorStyle].label} (same as house)` : INTERIOR_STYLES[p[field]].label;
  const money = (n) => '$' + Number(n).toLocaleString('en-US');
  return [
    { topic: 0, title: 'Basics', rows: [
      ['Location', p.location || 'Not set'], ['Budget', `${money(p.budget[0])} – ${money(p.budget[1])}`],
      ['Type', label('location', 'homeType', p.homeType)], ['Size', `${p.sqft[0].toLocaleString()} – ${p.sqft[1].toLocaleString()} sq ft`],
      ['Stories', p.stories], ['Lot', label('size', 'lot', p.lot)], ['Age', label('size', 'age', p.age)] ] },
    { topic: 2, title: 'Exterior', rows: [
      ['Style', EXTERIOR_STYLES[p.exteriorStyle].label], ['Colors', EXTERIOR_PALETTES[p.exteriorPalette].label],
      ['Material', label('exterior', 'siding', p.siding)], ['Roof', label('exterior', 'roofMaterial', p.roofMaterial)] ] },
    { topic: 3, title: 'Outdoor', rows: [
      ['Garage', label('outdoor', 'garage', p.garage)], ['Porch', label('outdoor', 'porch', p.porch)],
      ['Features', label('outdoor', 'outdoorFeatures', p.outdoorFeatures)] ] },
    { topic: 4, title: 'Interior & living', rows: [
      ['Style', INTERIOR_STYLES[p.interiorStyle].label], ['Floor plan', label('interior', 'floorPlan', p.floorPlan)],
      ['Ceilings', label('interior', 'ceilings', p.ceilings)], ['Flooring', label('interior', 'flooring', p.flooring)],
      ['Living', label('living', 'livingFeatures', p.livingFeatures)] ] },
    { topic: 6, title: 'Kitchen', rows: [
      ['Style', rs('kitchenStyle')], ['Layout', label('kitchen', 'kitchenLayout', p.kitchenLayout)],
      ['Cabinets', CABINET_COLORS[p.cabinets].label], ['Counters', label('kitchen', 'countertops', p.countertops)],
      ['Features', label('kitchen', 'kitchenFeatures', p.kitchenFeatures)] ] },
    { topic: 7, title: 'Bedrooms', rows: [
      ['Count', p.bedrooms], ['Style', rs('bedroomStyle')],
      ...(p.stories !== '1' ? [['Primary', label('bedrooms', 'primaryLocation', p.primaryLocation)]] : []),
      ['Primary suite', label('bedrooms', 'primaryFeatures', p.primaryFeatures)] ] },
    { topic: 8, title: 'Bathrooms', rows: [
      ['Count', p.bathrooms], ['Style', rs('bathroomStyle')], ['Primary bath', label('bathrooms', 'primaryBath', p.primaryBath)] ] },
    { topic: 9, title: 'Bonus rooms', rows: [
      ['Rooms', label('bonus', 'bonusRooms', p.bonusRooms)], ['Basement', label('bonus', 'basement', p.basement)], ['Style', rs('bonusStyle')] ] },
  ];
}

function renderResults() {
  const p = state.profile;
  const c = buildCriteria(p);
  const url = zillowUrl(c);
  $('#main').innerHTML = `
    <section class="results">
      <p class="eyebrow">Your dream home</p>
      <h2>${esc(EXTERIOR_STYLES[p.exteriorStyle].label)} · ${p.bedrooms} bed · ${p.bathrooms} bath</h2>
      <div class="viewer-wrap">
        <div class="view-tabs" id="view-tabs"></div>
        <div id="viewer" aria-label="3D model of your dream home"></div>
        <p class="hint">Drag to rotate · scroll or pinch to zoom · right-drag to pan</p>
      </div>

      <div class="panel zillow">
        <h3>Find it on Zillow</h3>
        ${!c.location ? '<p class="warn">Add a location in step 1 so the search covers the right area.</p>' : ''}
        <ul class="criteria">${describeCriteria(c).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
        <a class="primary button" href="${esc(url)}" target="_blank" rel="noopener">Open this search on Zillow</a>
        <h4>Get notified when a match is listed</h4>
        <ol class="steps">
          <li>Open the search above and sign in to Zillow.</li>
          <li>Check that the filters look right (Zillow sometimes drops a filter from a link).</li>
          <li>Click <strong>Save search</strong>.</li>
          <li>Set email frequency to <strong>Instant</strong>. Zillow then emails you as soon as a matching home is listed.</li>
        </ol>
        <details>
          <summary>Search request for the Zillow connector in Claude</summary>
          <p class="help">Paste this into a Claude chat that has the Zillow connector to run the same search there.</p>
          <pre id="connector-json">${esc(JSON.stringify(connectorRequest(c), null, 2))}</pre>
          <button class="secondary" id="copy-json">Copy</button>
        </details>
      </div>

      <div class="summary">
        ${summarySections().map((s) => `
          <div class="panel">
            <div class="panel-head"><h3>${s.title}</h3><button class="link" data-edit="${s.topic}">Edit</button></div>
            <dl>${s.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
          </div>`).join('')}
      </div>

      <div class="actions">
        <button class="secondary" id="download">Download my answers (JSON)</button>
        <button class="secondary" id="snapshot">Save 3D image</button>
        <label class="secondary button">Load answers<input type="file" accept="application/json" id="upload" hidden></label>
        <button class="link danger" id="reset">Start over</button>
      </div>
    </section>`;

  const host = $('#viewer');
  if (!viewer) viewer = new HouseViewer(host);
  else viewer.attach(host);
  viewer.build(p);
  renderViewTabs();

  document.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => go(Number(b.dataset.edit)));
  $('#copy-json').onclick = async () => {
    try { await navigator.clipboard.writeText($('#connector-json').textContent); $('#copy-json').textContent = 'Copied'; }
    catch { $('#copy-json').textContent = 'Copy failed: select the text instead'; }
  };
  $('#download').onclick = () => download('dream-home.json', new Blob([JSON.stringify({ profile: p, criteria: c, zillowUrl: url }, null, 2)], { type: 'application/json' }));
  $('#snapshot').onclick = () => { const a = document.createElement('a'); a.href = viewer.screenshot(); a.download = 'dream-home.png'; a.click(); };
  $('#upload').onchange = async (e) => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      state.profile = { ...defaultProfile(), ...(data.profile || data) };
      save(); render();
    } catch { alert('That file could not be read as a dream-home JSON export.'); }
  };
  $('#reset').onclick = () => {
    if (!confirm('Clear all your answers and start over?')) return;
    state = { step: 0, profile: defaultProfile(), visited: [] };
    save(); render();
  };
}

function renderViewTabs() {
  const tabs = [{ mode: 'exterior', label: 'Exterior' }, ...viewer.floors.map((f, i) => ({ mode: 'plan', i, label: f.name }))];
  const el = $('#view-tabs');
  el.innerHTML = tabs.map((t, k) => {
    const on = viewer.mode === t.mode && (t.mode === 'exterior' || viewer.floorIndex === t.i);
    return `<button class="chip ${on ? 'selected' : ''}" data-k="${k}">${esc(t.label)}</button>`;
  }).join('');
  el.querySelectorAll('button').forEach((b) => b.onclick = () => {
    const t = tabs[Number(b.dataset.k)];
    viewer.setMode(t.mode, t.i ?? viewer.floorIndex);
    renderViewTabs();
  });
}

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function render() {
  renderNav();
  if (state.step === 'results') renderResults();
  else renderTopic();
}

render();
