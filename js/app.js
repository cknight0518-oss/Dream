import { TOPICS, defaultProfile, mustHaveOptions, STYLE_SUGGEST, SCALES, sampleProfile } from './questions.js';
import { EXTERIOR_STYLES, EXTERIOR_PALETTES, INTERIOR_STYLES, CABINET_COLORS } from './styles-data.js';
import { buildCriteria, describeCriteria, zillowUrl, connectorRequest } from './zillow.js';
import { HouseViewer, LIGHTING, roomProgram } from './house3d.js';
import { exteriorSVG, interiorSVG, cabinetSVG } from './illustrations.js';
import { PHOTOS } from './photos.js';

const STORE = 'dreamhome.v2';
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
const shortMoney = (n) => n >= 1e6 ? `$${(n / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : `$${Math.round(n / 1000)}K`;
const smallScreen = () => matchMedia('(max-width: 900px)').matches;

const ICON = {
  check: '<svg viewBox="0 0 20 20"><path d="M5 10.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow: '<svg viewBox="0 0 20 20"><path d="M4 10h11m-4-4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  back: '<svg viewBox="0 0 20 20"><path d="M16 10H5m4-4-4 4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  spark: '<svg viewBox="0 0 20 20"><path d="M10 2l1.8 5.2L17 9l-5.2 1.8L10 16l-1.8-5.2L3 9l5.2-1.8z" fill="currentColor"/></svg>',
  rotate: '<svg viewBox="0 0 20 20"><path d="M16 10a6 6 0 1 1-2-4.5M16 3v3.5h-3.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  tag: '<svg viewBox="0 0 20 20"><path d="M3 3h7l7 7-7 7-7-7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="7" cy="7" r="1.4" fill="currentColor"/></svg>',
  expand: '<svg viewBox="0 0 20 20"><path d="M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  camera: '<svg viewBox="0 0 20 20"><path d="M3 6.5h3l1.5-2h5l1.5 2h3v10H3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="10" cy="11" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  cards: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="8" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.9"/><rect x="13" y="5" width="8" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.9"/></svg>',
  cube: '<svg viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
};

// ---------- State ----------

let state = load();
let viewer = null;

function blankState() {
  return { step: 'home', profile: defaultProfile(), visited: [], touched: [], lighting: 'day', calc: null };
}
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE)) || JSON.parse(localStorage.getItem('dreamhome.v1'));
    if (saved?.profile) return { ...blankState(), ...saved, step: 'home', profile: { ...defaultProfile(), ...saved.profile } };
  } catch { /* storage unavailable or corrupt */ }
  return blankState();
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* ignore */ }
}
const hasProgress = () => state.visited.length > 0;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- Share links ----------
// Only answers that differ from the defaults go in the link, base64url-encoded.

function encodeProfile(p) {
  const def = defaultProfile(), diff = {};
  for (const k of Object.keys(p)) if (JSON.stringify(p[k]) !== JSON.stringify(def[k])) diff[k] = p[k];
  return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(diff)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeProfile(code) {
  const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  return { ...defaultProfile(), ...JSON.parse(json) };
}
function shareUrl() {
  return `${location.href.split('#')[0]}#home=${encodeProfile(state.profile)}`;
}

// ---------- Navigation ----------

function go(step, { push = true } = {}) {
  if (typeof state.step === 'number') markVisited(TOPICS[state.step].id);
  const prev = state.step;
  state.step = step;
  save();
  if (push) try { history.pushState({ step }, ''); } catch { /* sandboxed */ }
  render(prev);
  window.scrollTo(0, 0);
}
function markVisited(id) { if (!state.visited.includes(id)) state.visited.push(id); }
window.addEventListener('popstate', (e) => { if (e.state && 'step' in e.state) go(e.state.step, { push: false }); });

function renderTopbar() {
  document.body.classList.toggle('on-home', state.step === 'home');
  const bar = $('#steps-bar');
  bar.innerHTML = TOPICS.map((t, i) => {
    const cls = [i === state.step ? 'current' : '', state.visited.includes(t.id) || state.step === 'results' ? 'done' : ''].join(' ');
    return `<li><button class="${cls}" data-step="${i}" title="${esc(t.title)}" aria-label="Step ${i + 1}: ${esc(t.title)}"><span>${esc(t.title)}</span></button></li>`;
  }).join('') + `<li><button class="${state.step === 'results' ? 'current' : ''}" data-step="results" title="Your dream home" aria-label="Results"><span>Results</span></button></li>`;
  $$('button', bar).forEach((b) => b.onclick = () => go(b.dataset.step === 'results' ? 'results' : Number(b.dataset.step)));
  $('#step-count').textContent = typeof state.step === 'number' ? `${state.step + 1} / ${TOPICS.length}` : state.step === 'results' ? 'Done' : '';
}
$('#brand').onclick = () => go('home');

// ---------- 3D viewer (one instance, moved between pages) ----------

function mountViewer(host, { lighting = state.lighting, autoRotate = false } = {}) {
  if (!viewer) viewer = new HouseViewer(host, { ao: !smallScreen() });
  else viewer.attach(host);
  viewer.stopRotateOnTouch = true;
  viewer.setAutoRotate(autoRotate);
  viewer.lighting = lighting;
  viewer.showLabels = true;
  return viewer;
}

// Which part of the house the live preview shows for each topic.
function previewTarget(topicId, p) {
  const floors = roomProgram(p);
  const find = (pred) => Math.max(0, floors.findIndex((f) => f.rooms.some(pred)));
  const main = find((r) => r.name === 'Kitchen');
  switch (topicId) {
    case 'interior': case 'living': case 'kitchen': return { mode: 'plan', floor: main };
    case 'bedrooms': return { mode: 'plan', floor: find((r) => r.type === 'bedroom' && !r.primary) };
    case 'bathrooms': return { mode: 'plan', floor: find((r) => r.name === 'Primary bath') };
    case 'bonus': return { mode: 'plan', floor: (p.bonusRooms || []).length ? find((r) => r.type === 'bonus') : main };
    default: return { mode: 'exterior', floor: 0 };
  }
}

let previewTimer = null, previewOverride = null;
function syncPreview(delay = 180) {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    if (!viewer || typeof state.step !== 'number') return;
    const t = previewOverride || previewTarget(TOPICS[state.step].id, state.profile);
    if (t.mode !== viewer.mode) viewer.view = t.mode === 'plan' ? 'dollhouse' : 'corner';
    viewer.mode = t.mode;
    viewer.floorIndex = t.floor;
    viewer.build(state.profile, { keepCamera: true });
    $$('#pv-mode button').forEach((b) => b.classList.toggle('on', b.dataset.m === viewer.mode));
  }, delay);
}
// Answers that don't change the model don't need a rebuild.
const NOT_IN_MODEL = new Set(['location', 'budget', 'homeType', 'view', 'age', 'mustHaves', 'flex']);

// ---------- Photo cards ----------

let creditsOnPage = new Map();
function photoFor(key) {
  const ph = key && PHOTOS[key];
  if (ph) creditsOnPage.set(key, ph);
  return ph;
}
function cardVisual(o, p) {
  const key = typeof o.photo === 'function' ? o.photo(p) : o.photo;
  const ph = photoFor(key);
  if (!ph) return o.visual(p);
  const sw = o.swatch ? `<div class="swatch">${o.swatch.map((c) => `<span style="background:${c}"></span>`).join('')}</div>` : '';
  return `<img src="assets/cards/${key}.jpg" alt="" loading="lazy" title="${esc(`${ph.artist || 'Unknown'}, ${ph.license}`)}">${sw}`;
}
function creditsBlock() {
  if (!creditsOnPage.size) return '';
  const items = [...creditsOnPage.values()].map((ph) =>
    `<li><a href="${esc(ph.page)}" target="_blank" rel="noopener">${esc(ph.title.replace(/^File:/, ''))}</a> by ${esc(ph.artist || 'unknown')}, ` +
    (ph.licenseUrl ? `<a href="${esc(ph.licenseUrl)}" target="_blank" rel="noopener">${esc(ph.license)}</a>` : esc(ph.license)) + '</li>').join('');
  return `<details class="credits"><summary>Photo credits</summary><ul>${items}</ul></details>`;
}

// ---------- Home ----------

function renderHome() {
  creditsOnPage = new Map();
  const strip = ['craftsman', 'modern', 'farmhouse', 'mediterranean', 'victorian'].map((k) => {
    photoFor(`ext_${k}`);
    return `<figure><img src="assets/cards/ext_${k}.jpg" alt="${esc(EXTERIOR_STYLES[k].label)} house" loading="lazy"><figcaption>${esc(EXTERIOR_STYLES[k].label)}</figcaption></figure>`;
  }).join('');
  $('#main').innerHTML = `
    <div class="home enter">
      <section class="hero">
        <div>
          <h1>Design your <em>dream home</em>. Then go find it.</h1>
          <p class="lede">Pick styles from real photos, answer a few questions, and watch your house take shape in 3D. When you're done, it becomes a Zillow search that alerts you to matching listings.</p>
          <div class="hero-actions">
            <button class="btn btn-primary btn-lg" id="start">${hasProgress() ? 'Continue designing' : 'Start designing'} ${ICON.arrow}</button>
            <button class="btn btn-secondary btn-lg" id="example">See an example</button>
          </div>
          <p class="hero-note">${hasProgress() ? `You've answered ${state.visited.length} of ${TOPICS.length} sections. <button class="link" id="fresh">Start fresh instead</button>` : 'About 5 minutes. Your answers stay in this browser.'}</p>
        </div>
        <div class="hero-stage"><div id="viewer"></div><span class="glass live-tag stage-tag">${hasProgress() ? 'Your home so far' : 'Drag to look around'}</span></div>
      </section>
      <section class="features">
        <div class="feature"><div class="icon">${ICON.cards}</div><h3>Choose from photos</h3><p>Exterior styles, color schemes, interiors and cabinets, shown with real homes instead of jargon.</p></div>
        <div class="feature"><div class="icon">${ICON.cube}</div><h3>See it in 3D as you go</h3><p>The model updates with every answer. Look around the outside, then step inside room by room.</p></div>
        <div class="feature"><div class="icon">${ICON.bell}</div><h3>Get alerted on Zillow</h3><p>Your must-haves become a saved search, so new listings that match land in your inbox.</p></div>
      </section>
      <section class="style-strip">${strip}</section>
      ${creditsBlock()}
    </div>`;
  const v = mountViewer($('#viewer'), { lighting: 'golden', autoRotate: true });
  v.mode = 'exterior'; v.view = 'corner';
  v.build(hasProgress() ? state.profile : sampleProfile());
  $('#start').onclick = () => go(hasProgress() ? Math.min(state.visited.length, TOPICS.length - 1) : 0);
  $('#example').onclick = () => { state.profile = sampleProfile(); state.visited = TOPICS.map((t) => t.id); state.touched = []; state.calc = null; go('results'); toast('Loaded an example. Edit any section to make it yours.'); };
  $('#fresh')?.addEventListener('click', () => { state = { ...blankState(), lighting: state.lighting }; save(); go(0); });
}

// ---------- Interview ----------

function optionList(q) { return typeof q.options === 'function' ? q.options(state.profile) : q.options; }
const suggestionFor = (qid) => STYLE_SUGGEST[state.profile.exteriorStyle]?.[qid];

function renderQuestion(q) {
  const p = state.profile;
  const v = p[q.id];
  const head = `<h3>${esc(q.prompt)}</h3>${q.help ? `<p class="help">${esc(q.help)}</p>` : ''}`;
  switch (q.type) {
    case 'cards':
      return head + `<div class="cards ${q.small ? 'small' : ''}" role="radiogroup" aria-label="${esc(q.prompt)}">` + optionList(q).map((o) => `
        <button class="card ${v === o.value ? 'selected' : ''}" role="radio" aria-checked="${v === o.value}" data-q="${q.id}" data-v="${o.value}">
          <span class="check">${ICON.check}</span>
          <div class="visual">${cardVisual(o, p)}</div>
          <div class="card-text"><strong>${esc(o.label)}</strong>${o.desc ? `<span>${esc(o.desc)}</span>` : ''}</div>
        </button>`).join('') + '</div>';
    case 'choice': {
      const sug = suggestionFor(q.id);
      return head + `<div class="chips" role="radiogroup" aria-label="${esc(q.prompt)}">` + optionList(q).map((o) =>
        `<button class="chip ${v === o.value ? 'selected' : ''}" role="radio" aria-checked="${v === o.value}" data-q="${q.id}" data-v="${o.value}">${esc(o.label)}${sug === o.value ? `<span class="tag">Fits ${esc(EXTERIOR_STYLES[p.exteriorStyle].label)}</span>` : ''}</button>`).join('') + '</div>';
    }
    case 'multi': {
      const opts = optionList(q);
      if (!opts.length) return head + '<p class="help">Nothing to choose here yet. Your earlier answers didn\'t include any features that could be hard filters.</p>';
      return head + '<div class="chips">' + opts.map((o) =>
        `<button class="chip multi ${v.includes(o.value) ? 'selected' : ''}" aria-pressed="${v.includes(o.value)}" data-q="${q.id}" data-v="${o.value}" data-multi="1">${esc(o.label)}</button>`).join('') + '</div>';
    }
    case 'number':
      return head + `<div class="stepper"><button data-q="${q.id}" data-step="-1" aria-label="Fewer">−</button>
        <output id="out-${q.id}" aria-live="polite">${v}</output><button data-q="${q.id}" data-step="1" aria-label="More">+</button></div>`;
    case 'range': return head + dualRange(q, v);
    case 'text':
      return head + `<input class="text" type="text" data-q="${q.id}" value="${esc(v)}" placeholder="${esc(q.placeholder || '')}">`;
  }
  return '';
}

// Two-thumb slider over a list of stops (see SCALES).
const fmtRange = (q, n) => q.scale === 'budget' ? shortMoney(n) : `${n.toLocaleString('en-US')} sq ft`;
const nearest = (arr, n) => arr.reduce((best, x, i) => Math.abs(x - n) < Math.abs(arr[best] - n) ? i : best, 0);
function dualRange(q, v) {
  const s = SCALES[q.scale], max = s.length - 1;
  const lo = nearest(s, v[0]), hi = nearest(s, v[1]);
  return `<div class="dual" data-dual="${q.id}">
    <div class="dual-values"><span data-lo>${fmtRange(q, s[lo])}</span><span class="to">to</span><span data-hi>${fmtRange(q, s[hi])}</span></div>
    <div class="dual-track"><div class="rail"></div><div class="fill" style="left:${(lo / max) * 100}%;right:${100 - (hi / max) * 100}%"></div>
      <input type="range" min="0" max="${max}" value="${lo}" data-i="0" aria-label="${esc(q.prompt)}: minimum" aria-valuetext="${fmtRange(q, s[lo])}">
      <input type="range" min="0" max="${max}" value="${hi}" data-i="1" aria-label="${esc(q.prompt)}: maximum" aria-valuetext="${fmtRange(q, s[hi])}">
    </div>
    <div class="dual-scale"><span>${fmtRange(q, s[0])}</span><span>${fmtRange(q, s[max])}</span></div>
  </div>`;
}

function renderTopic(fromStep) {
  const sameLayout = !!$('#qbody') && typeof fromStep === 'number';
  if (!sameLayout) {
    $('#main').innerHTML = `
      <div class="interview">
        <section class="qcol"><div id="qbody"></div></section>
        <aside class="pcol" aria-label="Live 3D preview">
          <div class="preview" id="preview">
            <div id="viewer"></div>
            <div class="preview-bar">
              <span class="glass live-tag">Live preview</span>
              <div class="glass seg" id="pv-mode"><button data-m="exterior">Outside</button><button data-m="plan">Inside</button></div>
              <button class="glass btn btn-sm preview-toggle" id="pv-toggle" aria-expanded="true">Hide</button>
            </div>
          </div>
        </aside>
      </div>`;
    mountViewer($('#viewer'), { lighting: 'day' });
    $$('#pv-mode button').forEach((b) => b.onclick = () => {
      const auto = previewTarget(TOPICS[state.step].id, state.profile);
      previewOverride = b.dataset.m === auto.mode ? null : { mode: b.dataset.m, floor: b.dataset.m === 'plan' ? previewTarget('kitchen', state.profile).floor : 0 };
      syncPreview(0);
    });
    $('#pv-toggle').onclick = (e) => {
      const pv = $('#preview'), collapsed = pv.classList.toggle('collapsed');
      e.target.textContent = collapsed ? 'Show' : 'Hide';
      e.target.setAttribute('aria-expanded', String(!collapsed));
    };
  }
  previewOverride = null;
  state.suggestNote = null;
  renderQuestions(true);
  syncPreview(sameLayout ? 120 : 0);
}

function renderQuestions(animate = false) {
  const t = TOPICS[state.step];
  if (t.id === 'priorities') { // drop must-haves that no longer apply
    const valid = new Set(mustHaveOptions(state.profile).map((o) => o.value));
    state.profile.mustHaves = state.profile.mustHaves.filter((m) => valid.has(m));
  }
  const qs = t.questions.filter((q) => !q.showIf || q.showIf(state.profile));
  const last = state.step === TOPICS.length - 1;
  const next = last ? null : TOPICS[state.step + 1];
  creditsOnPage = new Map();
  const body = qs.map((q) => `<div class="question" id="q-${q.id}">${renderQuestion(q)}${q.id === 'exteriorStyle' && state.suggestNote ? `<p class="suggest-note">${ICON.spark}<span>${esc(state.suggestNote)}</span></p>` : ''}</div>`).join('');
  $('#qbody').innerHTML = `
    <div class="${animate ? 'enter' : ''}">
      <header class="topic-head">
        <p class="eyebrow">Step ${state.step + 1} of ${TOPICS.length}</p>
        <h2>${esc(t.title)}</h2>
        ${t.intro ? `<p class="intro">${esc(t.intro)}</p>` : ''}
      </header>
      ${body}
    </div>
    <div class="nav-bar">
      ${state.step > 0 ? `<button class="btn btn-secondary" id="back">${ICON.back} Back</button>` : `<button class="btn btn-ghost" id="back">${ICON.back} Home</button>`}
      <div class="right">
        <span class="kbd-hint">or press <kbd>Enter</kbd></span>
        <button class="btn btn-primary" id="next">${last ? 'See my dream home' : `Next: ${esc(next.title)}`} ${ICON.arrow}</button>
      </div>
    </div>
    ${creditsBlock()}`;
  $('#back').onclick = () => go(state.step > 0 ? state.step - 1 : 'home');
  $('#next').onclick = () => go(last ? 'results' : state.step + 1);
  bindInputs(t);
}

function setAnswer(id, val) {
  const p = state.profile;
  p[id] = val;
  if (!state.touched.includes(id)) state.touched.push(id);
  state.suggestNote = null;
  if (id === 'exteriorStyle') {
    // Switch siding/roof/porch to fit the style unless the user already chose them.
    const sug = STYLE_SUGGEST[val] || {}, changed = [];
    for (const [k, sv] of Object.entries(sug)) if (!state.touched.includes(k) && p[k] !== sv) { p[k] = sv; changed.push(k); }
    if (changed.length) {
      const names = { siding: 'exterior material', roofMaterial: 'roof', porch: 'porch' };
      state.suggestNote = `We set the ${listText(changed.map((k) => names[k]))} to fit a ${EXTERIOR_STYLES[val].label} home. Change ${changed.length > 1 ? 'them' : 'it'} anytime below.`;
    }
  }
  save();
  if (!NOT_IN_MODEL.has(id)) syncPreview();
}

function bindInputs(t) {
  const qb = $('#qbody');
  $$('[data-v]', qb).forEach((b) => b.onclick = () => {
    const id = b.dataset.q, val = b.dataset.v;
    if (b.dataset.multi) {
      const cur = new Set(state.profile[id]);
      cur.has(val) ? cur.delete(val) : cur.add(val);
      setAnswer(id, [...cur]);
    } else setAnswer(id, val);
    // Re-render: some questions depend on others (showIf, inherit cards, suggestions).
    const y = window.scrollY;
    renderQuestions();
    window.scrollTo(0, y);
    $(`[data-q="${id}"][data-v="${val}"]`, qb)?.focus({ preventScroll: true });
  });
  $$('[data-step]', qb).forEach((b) => b.onclick = () => {
    const q = t.questions.find((x) => x.id === b.dataset.q);
    const nv = Math.min(q.max, Math.max(q.min, state.profile[q.id] + q.step * Number(b.dataset.step)));
    $(`#out-${q.id}`).textContent = nv;
    setAnswer(q.id, nv);
  });
  $$('[data-dual]', qb).forEach((wrap) => {
    const q = t.questions.find((x) => x.id === wrap.dataset.dual);
    const s = SCALES[q.scale], max = s.length - 1;
    const [a, b] = $$('input', wrap);
    const update = (commit) => {
      let lo = Number(a.value), hi = Number(b.value);
      if (lo > hi) [lo, hi] = [hi, lo];
      $('[data-lo]', wrap).textContent = fmtRange(q, s[lo]);
      $('[data-hi]', wrap).textContent = fmtRange(q, s[hi]);
      $('.fill', wrap).style.cssText = `left:${(lo / max) * 100}%;right:${100 - (hi / max) * 100}%`;
      a.setAttribute('aria-valuetext', fmtRange(q, s[Number(a.value)]));
      b.setAttribute('aria-valuetext', fmtRange(q, s[Number(b.value)]));
      state.profile[q.id] = [s[lo], s[hi]];
      if (commit) setAnswer(q.id, [s[lo], s[hi]]);
    };
    for (const inp of [a, b]) { inp.oninput = () => update(false); inp.onchange = () => update(true); }
  });
  $$('input.text', qb).forEach((inp) => inp.oninput = () => setAnswer(inp.dataset.q, inp.value));
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || typeof state.step !== 'number' || e.isComposing) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY' || tag === 'SELECT') return;
  e.preventDefault();
  $('#next')?.click();
});

// ---------- Results ----------

function label(topicId, qid, value) {
  const q = TOPICS.find((t) => t.id === topicId).questions.find((x) => x.id === qid);
  const list = typeof q.options === 'function' ? q.options(state.profile) : q.options || [];
  const one = (v) => list.find((o) => o.value === v)?.label ?? v;
  return Array.isArray(value) ? (value.length ? value.map(one).join(', ') : 'None') : one(value);
}
const topicIndex = (id) => TOPICS.findIndex((t) => t.id === id);
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
function listText(arr) { return arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`; }

function roomStyleLabel(field) {
  const p = state.profile;
  return p[field] === 'inherit' ? `${INTERIOR_STYLES[p.interiorStyle].label} (same as house)` : INTERIOR_STYLES[p[field]].label;
}

function summarySections() {
  const p = state.profile;
  return [
    { topic: 'location', title: 'Basics', rows: [
      ['Location', p.location || 'Not set'], ['Budget', `${money(p.budget[0])} – ${money(p.budget[1])}`],
      ['Type', label('location', 'homeType', p.homeType)], ['Size', `${p.sqft[0].toLocaleString()} – ${p.sqft[1].toLocaleString()} sq ft`],
      ['Stories', p.stories], ['Lot', label('size', 'lot', p.lot)], ['Age', label('size', 'age', p.age)] ] },
    { topic: 'exterior', title: 'Exterior', rows: [
      ['Style', EXTERIOR_STYLES[p.exteriorStyle].label], ['Colors', EXTERIOR_PALETTES[p.exteriorPalette].label],
      ['Material', label('exterior', 'siding', p.siding)], ['Roof', label('exterior', 'roofMaterial', p.roofMaterial)] ] },
    { topic: 'outdoor', title: 'Outdoor', rows: [
      ['Garage', label('outdoor', 'garage', p.garage)], ['Porch', label('outdoor', 'porch', p.porch)],
      ['Features', label('outdoor', 'outdoorFeatures', p.outdoorFeatures)] ] },
    { topic: 'interior', title: 'Interior & living', rows: [
      ['Style', INTERIOR_STYLES[p.interiorStyle].label], ['Floor plan', label('interior', 'floorPlan', p.floorPlan)],
      ['Ceilings', label('interior', 'ceilings', p.ceilings)], ['Flooring', label('interior', 'flooring', p.flooring)],
      ['Living', label('living', 'livingFeatures', p.livingFeatures)] ] },
    { topic: 'kitchen', title: 'Kitchen', rows: [
      ['Style', roomStyleLabel('kitchenStyle')], ['Layout', label('kitchen', 'kitchenLayout', p.kitchenLayout)],
      ['Cabinets', CABINET_COLORS[p.cabinets].label], ['Counters', label('kitchen', 'countertops', p.countertops)],
      ['Features', label('kitchen', 'kitchenFeatures', p.kitchenFeatures)] ] },
    { topic: 'bedrooms', title: 'Bedrooms', rows: [
      ['Count', p.bedrooms], ['Style', roomStyleLabel('bedroomStyle')],
      ...(p.stories !== '1' ? [['Primary', label('bedrooms', 'primaryLocation', p.primaryLocation)]] : []),
      ['Primary suite', label('bedrooms', 'primaryFeatures', p.primaryFeatures)] ] },
    { topic: 'bathrooms', title: 'Bathrooms', rows: [
      ['Count', p.bathrooms], ['Style', roomStyleLabel('bathroomStyle')], ['Primary bath', label('bathrooms', 'primaryBath', p.primaryBath)] ] },
    { topic: 'bonus', title: 'Bonus rooms', rows: [
      ['Rooms', label('bonus', 'bonusRooms', p.bonusRooms)], ['Basement', label('bonus', 'basement', p.basement)], ['Style', roomStyleLabel('bonusStyle')] ] },
  ];
}

// A plain-English paragraph describing the home.
function brief(p) {
  const style = EXTERIOR_STYLES[p.exteriorStyle].label;
  const storyWord = { 1: 'single-story', 2: 'two-story', 3: 'three-story' }[p.stories];
  const mid = Math.round((p.sqft[0] + p.sqft[1]) / 2 / 100) * 100;
  const where = p.location ? ` in ${p.location}` : '';
  const lot = { any: '', small: ' on a small lot', quarter: ' on a quarter- to half-acre lot', half: ' on a half- to one-acre lot', acre: ' on an acre or more' }[p.lot];
  const pal = EXTERIOR_PALETTES[p.exteriorPalette];
  const outside = [
    `${p.exteriorPalette === 'style' ? '' : lower(pal.label) + ' '}${lower(label('exterior', 'siding', p.siding))} walls`,
    `a ${lower(label('exterior', 'roofMaterial', p.roofMaterial))} roof`,
  ];
  const porch = p.porch === 'style' ? EXTERIOR_STYLES[p.exteriorStyle].porch : p.porch === 'none' ? null : p.porch;
  if (porch) outside.push(porch === 'wrap' ? 'a wraparound porch' : 'a front porch');
  if (p.garage !== '0') outside.push(`a ${p.garage}-car garage`);
  const yard = (p.outdoorFeatures || []).map((f) => lower(label('outdoor', 'outdoorFeatures', [f])));
  const inside = `${INTERIOR_STYLES[p.interiorStyle].label} style throughout, with ${lower(label('interior', 'floorPlan', p.floorPlan))} living, ${lower(label('interior', 'flooring', p.flooring))} floors${p.ceilings === 'vaulted' ? ' and vaulted ceilings' : p.ceilings === '10' ? ' and 10-foot ceilings' : ''}`;
  const kitchen = `${lower(CABINET_COLORS[p.cabinets].label)} cabinets with ${lower(label('kitchen', 'countertops', p.countertops))} counters${p.kitchenLayout === 'island' ? ' around an island' : ''}`;
  const extras = (p.bonusRooms || []).map((b) => lower(label('bonus', 'bonusRooms', [b])));
  if (p.basement === 'finished' || p.basement === 'walkout') extras.push(p.basement === 'walkout' ? 'a walkout basement' : 'a finished basement');
  return `A ${storyWord} ${style} home${where} with ${p.bedrooms} bedrooms and ${p.bathrooms} baths, about ${mid.toLocaleString()} square feet${lot}. ` +
    `Outside: ${listText(outside)}${yard.length ? `, plus ${listText(yard)} out back` : ''}. ` +
    `Inside: ${inside}. The kitchen has ${kitchen}.` +
    (extras.length ? ` Extra space for ${listText(extras)}.` : '');
}

function moodboard(p) {
  const fig = (key, fallback, caption) => {
    const ph = photoFor(key);
    return `<figure>${ph ? `<img src="assets/cards/${key}.jpg" alt="" loading="lazy">` : fallback}<figcaption class="glass">${esc(caption)}</figcaption></figure>`;
  };
  const kStyle = p.kitchenStyle === 'inherit' ? p.interiorStyle : p.kitchenStyle;
  const bStyle = p.bedroomStyle === 'inherit' ? p.interiorStyle : p.bedroomStyle;
  const fourth = p.exteriorPalette !== 'style'
    ? fig(`pal_${p.exteriorPalette}`, exteriorSVG(p.exteriorStyle), EXTERIOR_PALETTES[p.exteriorPalette].label)
    : fig(`int_${kStyle}`, interiorSVG(kStyle), `${INTERIOR_STYLES[kStyle].label} kitchen`);
  return `<div class="moodboard">
    ${fig(`ext_${p.exteriorStyle}`, exteriorSVG(p.exteriorStyle), EXTERIOR_STYLES[p.exteriorStyle].label)}
    ${fig(`int_${p.interiorStyle}`, interiorSVG(p.interiorStyle), `${INTERIOR_STYLES[p.interiorStyle].label} interior`)}
    ${fig(`cab_${p.cabinets}`, cabinetSVG(p.cabinets), `${CABINET_COLORS[p.cabinets].label} cabinets`)}
    ${fourth}
    ${fig(`int_${bStyle}`, interiorSVG(bStyle), `${INTERIOR_STYLES[bStyle].label} bedrooms`)}
  </div>`;
}

// ---------- Affordability ----------
// Standard amortized payment: M = L·r / (1 − (1 + r)^−n).
function calcDefaults(p) {
  return { price: p.budget[1], down: 20, rate: 6.5, term: 30, tax: 1.0, insurance: 1800, hoa: 0 };
}
function payment(c) {
  const loan = c.price * (1 - c.down / 100);
  const r = c.rate / 100 / 12, n = c.term * 12;
  const pi = r ? loan * r / (1 - (1 + r) ** -n) : loan / n;
  const tax = c.price * c.tax / 100 / 12, ins = c.insurance / 12;
  const pmi = c.down < 20 ? loan * 0.006 / 12 : 0; // rough estimate; real PMI depends on credit and down payment
  return { loan, pi, tax, ins, pmi, hoa: c.hoa, total: pi + tax + ins + pmi + c.hoa };
}
function affordabilityPanel() {
  const c = state.calc;
  const f = (k, lbl, pre, suf, step) => `<label>${lbl}<span class="field">${pre ? `<span>${pre}</span>` : ''}<input type="number" inputmode="decimal" min="0" data-calc="${k}" value="${c[k]}" step="${step}">${suf ? `<span>${suf}</span>` : ''}</span></label>`;
  return `<section class="panel" id="afford">
    <h2>What would it cost?</h2>
    <p class="sub">Estimated monthly payment at the top of your budget. Edit any number.</p>
    <div class="calc">
      ${f('price', 'Home price', '$', '', 5000)}
      ${f('down', 'Down payment', '', '%', 1)}
      ${f('rate', 'Interest rate', '', '%', 0.125)}
      <label>Loan term<span class="field"><select data-calc="term"><option value="30" ${c.term == 30 ? 'selected' : ''}>30 years</option><option value="15" ${c.term == 15 ? 'selected' : ''}>15 years</option></select></span></label>
      ${f('tax', 'Property tax', '', '%/yr', 0.05)}
      ${f('insurance', 'Insurance', '$', '/yr', 100)}
      ${f('hoa', 'HOA', '$', '/mo', 25)}
    </div>
    <div id="afford-out"></div>
    <p class="fine">The 6.5% rate is a placeholder; enter a current quote. Property tax and insurance vary a lot by area. PMI is a rough 0.6%/yr estimate that applies under 20% down. This is an estimate, not financial advice.</p>
  </section>`;
}
function renderAfford() {
  const c = state.calc, r = payment(c);
  const parts = [['Principal & interest', r.pi, 'var(--accent)'], ['Tax', r.tax, 'var(--warm)'], ['Insurance', r.ins, '#7a8fa6'], ['PMI', r.pmi, '#b7a0c9'], ['HOA', r.hoa, '#a9b38f']].filter(([, v]) => v > 0);
  $('#afford-out').innerHTML = `
    <div class="payment"><span>Per month</span><span class="big">${money(r.total)}</span></div>
    <div class="breakdown">${parts.map(([, v, col]) => `<span style="width:${(v / r.total) * 100}%;background:${col}"></span>`).join('')}</div>
    <div class="legend">${parts.map(([n, v, col]) => `<span><i style="background:${col}"></i>${n} ${money(v)}</span>`).join('')}</div>
    <p class="income">Down payment: <strong>${money(c.price - r.loan)}</strong>, plus closing costs.<br>
    Income to keep housing at 28% of gross pay: <strong>${money((r.total * 12) / 0.28)}/yr</strong></p>`;
}

function renderResults() {
  const p = state.profile;
  const c = buildCriteria(p);
  const url = zillowUrl(c);
  state.calc ||= calcDefaults(p);
  creditsOnPage = new Map();
  const loc = p.location ? esc(p.location) : 'your next city';
  const mb = moodboard(p);
  $('#main').innerHTML = `
    <div class="results enter">
      <header class="results-head">
        <div>
          <p class="eyebrow">Your dream home</p>
          <h1>A ${esc(EXTERIOR_STYLES[p.exteriorStyle].label)} in ${loc}</h1>
          <ul class="facts">
            <li>${p.bedrooms} bed</li><li>${p.bathrooms} bath</li>
            <li>${p.sqft[0].toLocaleString()}–${p.sqft[1].toLocaleString()} sq ft</li>
            <li>${shortMoney(p.budget[0])}–${shortMoney(p.budget[1])}</li>
            <li>${{ 1: 'One', 2: 'Two', 3: 'Three' }[p.stories]} ${p.stories === '1' ? 'story' : 'stories'}</li>
          </ul>
        </div>
        <div class="cta-row">
          <button class="btn btn-secondary" id="share">Copy share link</button>
          <a class="btn btn-primary" href="${esc(url)}" target="_blank" rel="noopener">Search on Zillow ${ICON.arrow}</a>
        </div>
      </header>

      <section class="results-stage" id="stage">
        <div id="viewer" aria-label="3D model of your dream home"></div>
        <img class="print-shot" id="print-shot" alt="3D view of the home">
        <div class="stage-toolbar">
          <div class="group">
            <div class="glass seg" id="floor-tabs"></div>
            <div class="glass seg" id="view-tabs"></div>
          </div>
          <div class="group">
            <div class="glass seg" id="light-tabs"></div>
            <button class="glass icon-btn" id="rotate" title="Turntable" aria-label="Turntable" aria-pressed="false">${ICON.rotate}</button>
            <button class="glass icon-btn on" id="labels" title="Room labels" aria-label="Room labels" aria-pressed="true">${ICON.tag}</button>
            <button class="glass icon-btn" id="snapshot" title="Save image" aria-label="Save image">${ICON.camera}</button>
            <button class="glass icon-btn" id="fullscreen" title="Full screen" aria-label="Full screen">${ICON.expand}</button>
          </div>
        </div>
        <div class="stage-bottom"><span class="glass hint-pill">Drag to orbit · scroll or pinch to zoom · right-drag to pan</span></div>
      </section>

      <div class="results-body">
        <div>
          <section class="panel">
            <p class="brief">${esc(brief(p))}</p>
            ${mb}
          </section>
          <section class="panel">
            <h2>Every answer</h2>
            <p class="sub">Change anything and the model and search update.</p>
            <div class="spec-grid">
              ${summarySections().map((s) => `
                <div class="spec">
                  <div class="spec-head"><h3>${s.title}</h3><button class="link" data-edit="${s.topic}">Edit</button></div>
                  <dl>${s.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
                </div>`).join('')}
            </div>
          </section>
          <div class="actions">
            <button class="btn btn-secondary btn-sm" id="print">Print or save PDF</button>
            <button class="btn btn-secondary btn-sm" id="download">Download answers</button>
            <label class="btn btn-secondary btn-sm">Load answers<input type="file" accept="application/json" id="upload" hidden></label>
            <button class="link danger" id="reset">Start over</button>
          </div>
          ${creditsBlock()}
        </div>

        <aside class="side">
          <section class="panel">
            <h2>Find it on Zillow</h2>
            <p class="sub">Your search, built from your answers. Only deal-breakers are hard filters.</p>
            ${!c.location ? `<p class="warn">Add a location so the search covers the right area. <button class="link" data-edit="location">Add one</button></p>` : ''}
            <ul class="criteria">${describeCriteria(c).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
            <p class="not-filtered">Colors, cabinets and room styles stay in your 3D model. Zillow can't filter for them.</p>
            <div class="cta-row">
              <a class="btn btn-primary" href="${esc(url)}" target="_blank" rel="noopener">Open search ${ICON.arrow}</a>
              <button class="btn btn-secondary" id="copy-url">Copy link</button>
            </div>
            <ol class="steps">
              <li><span>Open the search and sign in to Zillow.</span></li>
              <li><span>Check the filters. Zillow sometimes drops one from a link.</span></li>
              <li><span>Click <strong>Save search</strong> and set email to <strong>Instant</strong>. Zillow emails you when a match is listed.</span></li>
            </ol>
            <details class="more">
              <summary>Use with the Zillow connector in Claude</summary>
              <p class="sub">Paste this into a Claude chat that has the Zillow connector to run the same search there.</p>
              <pre id="connector-json">${esc(JSON.stringify(connectorRequest(c), null, 2))}</pre>
              <button class="btn btn-secondary btn-sm" id="copy-json">Copy</button>
            </details>
          </section>
          ${affordabilityPanel()}
        </aside>
      </div>
    </div>`;

  const v = mountViewer($('#viewer'), { lighting: state.lighting });
  v.mode = 'exterior'; v.view = 'corner'; v.floorIndex = 0;
  v.build(p);
  renderStageTabs();
  renderAfford();

  $$('[data-edit]').forEach((b) => b.onclick = () => go(topicIndex(b.dataset.edit)));
  const copy = async (text, done) => {
    try { await navigator.clipboard.writeText(text); toast(done); }
    catch { prompt('Copy this:', text); }
  };
  $('#share').onclick = () => copy(shareUrl(), 'Share link copied. Anyone with it sees this home.');
  $('#copy-url').onclick = () => copy(url, 'Zillow link copied');
  $('#copy-json').onclick = () => copy($('#connector-json').textContent, 'Copied');
  $('#rotate').onclick = (e) => {
    const on = !viewer.controls.autoRotate;
    viewer.stopRotateOnTouch = false;
    viewer.setAutoRotate(on);
    e.currentTarget.classList.toggle('on', on); e.currentTarget.setAttribute('aria-pressed', String(on));
  };
  $('#labels').onclick = (e) => {
    viewer.showLabels = !viewer.showLabels;
    e.currentTarget.classList.toggle('on', viewer.showLabels); e.currentTarget.setAttribute('aria-pressed', String(viewer.showLabels));
  };
  $('#snapshot').onclick = () => { const a = document.createElement('a'); a.href = viewer.screenshot(); a.download = 'dream-home.png'; a.click(); };
  $('#fullscreen').onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else $('#stage').requestFullscreen?.().catch(() => toast('Full screen is not available here'));
  };
  $('#print').onclick = () => { $('#print-shot').src = viewer.screenshot(); setTimeout(() => window.print(), 50); };
  $('#download').onclick = () => download('dream-home.json', new Blob([JSON.stringify({ profile: p, criteria: c, zillowUrl: url }, null, 2)], { type: 'application/json' }));
  $('#upload').onchange = async (e) => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      state.profile = { ...defaultProfile(), ...(data.profile || data) };
      state.calc = null;
      save(); render(); toast('Answers loaded');
    } catch { toast('That file could not be read as a dream-home export'); }
  };
  $('#reset').onclick = () => {
    if (!confirm('Clear all your answers and start over?')) return;
    state = blankState();
    save(); go('home');
  };
  $$('[data-calc]').forEach((inp) => inp.oninput = () => {
    const n = Number(inp.value);
    if (Number.isFinite(n) && n >= 0) { state.calc[inp.dataset.calc] = n; save(); renderAfford(); }
  });
}

function renderStageTabs() {
  const floors = viewer.floors;
  const ft = $('#floor-tabs');
  const tabs = [{ mode: 'exterior', label: 'Outside' }, ...floors.map((f, i) => ({ mode: 'plan', i, label: f.name.replace(' floor', '') }))];
  ft.innerHTML = tabs.map((t, k) => `<button class="${viewer.mode === t.mode && (t.mode === 'exterior' || viewer.floorIndex === t.i) ? 'on' : ''}" data-k="${k}">${esc(t.label)}</button>`).join('');
  $$('button', ft).forEach((b) => b.onclick = () => { const t = tabs[Number(b.dataset.k)]; viewer.setMode(t.mode, t.i ?? viewer.floorIndex); renderStageTabs(); });

  const views = viewer.mode === 'exterior'
    ? [['corner', 'Corner'], ['front', 'Street'], ['aerial', 'Aerial'], ['back', 'Backyard']]
    : [['dollhouse', 'Dollhouse'], ['top', 'Plan']];
  const vt = $('#view-tabs');
  vt.innerHTML = views.map(([k, l]) => `<button class="${viewer.view === k ? 'on' : ''}" data-v="${k}">${l}</button>`).join('');
  $$('button', vt).forEach((b) => b.onclick = () => { viewer.setView(b.dataset.v); renderStageTabs(); });

  const lt = $('#light-tabs');
  lt.hidden = viewer.mode !== 'exterior';
  lt.innerHTML = Object.entries(LIGHTING).map(([k, L]) => `<button class="${viewer.lighting === k ? 'on' : ''}" data-l="${k}">${L.label}</button>`).join('');
  $$('button', lt).forEach((b) => b.onclick = () => { state.lighting = b.dataset.l; save(); viewer.setLighting(b.dataset.l); renderStageTabs(); });
  $('#labels').hidden = viewer.mode === 'exterior';
}

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- Boot ----------

function render(fromStep) {
  renderTopbar();
  if (state.step === 'home') renderHome();
  else if (state.step === 'results') renderResults();
  else renderTopic(fromStep);
}

(function boot() {
  const m = location.hash.match(/home=([\w-]+)/);
  if (m) {
    try {
      state.profile = decodeProfile(m[1]);
      state.visited = TOPICS.map((t) => t.id);
      state.calc = null;
      state.step = 'results';
      save();
      try { history.replaceState({ step: 'results' }, '', location.href.split('#')[0]); } catch { /* sandboxed */ }
      render();
      toast('Showing a shared dream home');
      return;
    } catch { /* bad link: fall through */ }
  }
  try { history.replaceState({ step: state.step }, ''); } catch { /* sandboxed */ }
  render();
})();
