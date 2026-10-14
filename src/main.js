// The shell: picks a poster at random, mounts it, and keeps the page furniture honest.

import { POSTERS, PUBLISHED, bySlug } from './posters/index.js';
import { createStage, THEMES, fontsReady } from './engine.js';
import { rollColour, colourPass } from './colour.js';
import { createPanel } from './panel.js';

const $ = (id) => document.getElementById(id);
const stageEl = $('stage');
const hintEl = $('hint');
const toastEl = $('toast');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);

let shuffles = 0;         // counts shuffles; posters that can swap black and white do so on every odd one
let current = null;       // { poster, stage, seed, theme }
let busy = false;
let hintTimer = 0;
let panel = null, wantPanel = params.has('tune');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const randomSeed = () => (Math.random() * 4294967296) >>> 0;

// ---------- small things ----------
let toastTimer = 0;
export function toast(msg, ms = 2200) {
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('on'), ms);
}

// ---------- settings panel (posters that offer one: ?tune, or press T) ----------
function syncPanel() {
  if (panel) { panel.destroy(); panel = null; }
  if (wantPanel && current && current.inst && current.inst.tune) {
    panel = createPanel(current.inst.tune, { toast, slug: current.poster.slug, onClose: () => { wantPanel = false; panel = null; } });
  }
}
function togglePanel() {
  wantPanel = !wantPanel;
  if (wantPanel && !(current && current.inst && current.inst.tune)) { toast('This poster has no settings'); wantPanel = false; }
  syncPanel();
}

// The footer reads: name, a fixed role line, then one of these asides, chosen at random on each load.
const ASIDES = [
  'Teams, systems, and things that break on purpose.',
  'Craft is the credential.',
  'Prototypes over decks.',
  'Handle with care.',
  'Mostly flat.',
  'Some cracks are intentional.',
  'Load-bearing.',
  'Please refresh.',
];

// ---------- the click spark ----------
const GLYPHS = "~*+.:;'^-/\\".split('');
function spark(x, y) {
  if (reduced) return;
  for (let i = 0; i < 6; i++) {
    const el = document.createElement('span');
    el.className = 'spark';
    el.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    el.setAttribute('aria-hidden', 'true');
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.fontSize = (11 + Math.random() * 9).toFixed(1) + 'px';
    document.body.appendChild(el);
    const ang = Math.random() * Math.PI * 2;
    const dist = 14 + Math.random() * 20;
    const dx = (Math.cos(ang) * dist).toFixed(1);
    const dy = (Math.sin(ang) * dist).toFixed(1);
    const rot = (Math.random() * 60 - 30).toFixed(0);
    const a = el.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.3) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: 420 + Math.random() * 140, delay: Math.random() * 40, easing: 'cubic-bezier(0.19, 1, 0.22, 1)', fill: 'both' },
    );
    a.onfinish = () => el.remove();
  }
}
stageEl.addEventListener('pointerdown', (e) => spark(e.clientX, e.clientY));
stageEl.addEventListener('contextmenu', (e) => e.preventDefault());   // no long-press menu or selection on the poster

// ---------- picking ----------
function pickOther(slug) {
  const pool = PUBLISHED.filter((p) => p.slug !== slug);
  if (!pool.length) return PUBLISHED[0];            // only one poster is published: shuffle just reloads it
  return pool[Math.floor(Math.random() * pool.length)];
}
function pickFirst() {
  const fixed = document.documentElement.dataset.poster || params.get('p');
  if (fixed && bySlug(fixed)) return bySlug(fixed);
  let last = null;
  try { last = localStorage.getItem('swt:last'); } catch (e) { /* private mode */ }
  const pool = PUBLISHED.filter((p) => p.slug !== last);
  if (!pool.length) return PUBLISHED[0];
  const w = (p) => (p.slug === 'still-water' ? 2.5 : 1);                          // Still Water opens the site 2.5 times as often as each of the others
  let r = Math.random() * pool.reduce((a, p) => a + w(p), 0);
  for (const p of pool) { r -= w(p); if (r < 0) return p; }
  return pool[pool.length - 1];
}
function seedFromHash() {
  const m = /[#&]s=([0-9a-z]+)/i.exec(location.hash);
  return m ? parseInt(m[1], 36) >>> 0 : null;
}
// One rule for every poster: the first poster is black on white, and each shuffle swaps (white on black, then black on white...).
// ?theme=light|dark overrides it. Posters read it as stage.theme.name (and stage.flip, which is true on white-on-black).
function chooseTheme() {
  const forced = params.get('theme');
  if (forced === 'light' || forced === 'dark') return forced;
  return shuffles % 2 === 1 ? 'dark' : 'light';
}

// Favicon follows the page background: black tile on dark, white tile on light.
function setFavicon(light) {
  const link = document.querySelector('link[rel="icon"]');
  const href = `/assets/favicon-${light ? 'light' : 'dark'}.svg`;
  if (link && link.getAttribute('href') !== href) link.setAttribute('href', href);
}

// ---------- mounting ----------
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme.name;
  const root = document.documentElement.style;
  ['--bg', '--fg', '--dim'].forEach((k) => root.removeProperty(k));
  stageEl.style.background = '';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.bg);
  setFavicon(theme.name === 'light');
}

// A poster that lets the page background be tuned (grey level 0..1) calls this; null hands it back to the theme.
function setBackdrop(level) {
  if (level == null) { if (current) applyTheme(current.theme); return; }
  const v = Math.round(Math.min(1, Math.max(0, level)) * 255), light = level > 0.5;
  const root = document.documentElement.style;
  const bg = `rgb(${v},${v},${v})`;
  root.setProperty('--bg', bg);
  root.setProperty('--fg', light ? '#000' : '#fff');
  root.setProperty('--dim', light ? '#767676' : '#8a8a8a');
  stageEl.style.background = bg;
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', bg);
  setFavicon(light);
}

function showFallback(poster) {
  const el = document.createElement('div');
  el.className = 'fallback';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = poster.words.map((w) => `<span>${w}</span>`).join('');
  stageEl.appendChild(el);
}

function setChrome(poster) {
  const i = PUBLISHED.indexOf(poster);
  $('folio-title').textContent = poster.title;
  $('folio-count').textContent = i >= 0 ? ` ${i + 1}/${PUBLISHED.length}` : ' draft';
  document.title = `${poster.title} · Idan Segev`;
}

function armHint(poster, stage) {
  clearTimeout(hintTimer);
  hintEl.classList.remove('on');
  if (!poster.hint) return;
  const hide = () => { hintEl.classList.remove('on'); clearTimeout(hintTimer); };
  stage.on('down', hide);
  stage.on('move', () => { if (stage.ptr.down) hide(); });
  hintTimer = setTimeout(() => {
    if (!stage.interacted) { hintEl.textContent = poster.hint; hintEl.classList.add('on'); }
  }, 6500);
}

async function show(poster, { seed = randomSeed(), themeName } = {}) {
  busy = true;
  const theme = THEMES[themeName || chooseTheme()];

  if (panel) { panel.destroy(); panel = null; }
  if (current) {
    stageEl.classList.add('swap');
    await wait(reduced ? 0 : 100);
    try { if (current.inst && current.inst.destroy) current.inst.destroy(); } catch (err) { console.error('[poster destroy]', err); }   // the poster's own listeners, overlays and backdrop
    if (current.stage) current.stage.destroy();
    stageEl.querySelectorAll('.fallback').forEach((n) => n.remove());
  }
  applyTheme(theme);
  setChrome(poster);
  stageEl.querySelectorAll('.colour-pass').forEach((n) => n.remove()); stageEl.classList.remove('colour-dark');

  const stage = createStage(stageEl, { seed, theme, toast, setBackdrop });
  stage.refreshPanel = syncPanel;                                   // a poster whose settings change (a mode switch) asks for the panel to be rebuilt
  stage.flip = theme.name === 'dark';
  stage.colour = poster.standalone ? null : rollColour(params);          // about one showing in ten is in colour (src/colour.js)
  current = { poster, stage, seed, theme };
  let inst = null;
  try {
    await fontsReady();
    const mod = await poster.load();
    inst = await mod.mount(stage);
    current.inst = inst;
    if (stage.colour && poster.colour !== 'native') colourPass(stageEl, stage.colour, { dark: stage.flip });
    stage.start();
    syncPanel();
    armHint(poster, stage);
  } catch (err) {
    console.error(`[poster:${poster.slug}]`, err);
    if (params.has('tune') || params.has('debug')) toast(`${poster.slug}: ${String(err && err.message || err).slice(0, 140)}`, 12000);
    stage.destroy();
    current.stage = null;
    showFallback(poster);
  }
  window.__poster = { slug: poster.slug, seed, theme: theme.name, colour: stage.colour ? stage.colour.name : null, stage: current.stage, inst };
  try { localStorage.setItem('swt:last', poster.slug); } catch (e) { /* ignore */ }
  requestAnimationFrame(() => stageEl.classList.remove('swap'));
  busy = false;
}

async function shuffle() {
  if (busy || !current || document.documentElement.dataset.bare !== undefined) return;       // a standalone page does not shuffle
  const next = pickOther(current.poster.slug);
  shuffles++;
  if (location.pathname !== '/') history.replaceState(null, '', '/');
  await show(next);
}

async function share() {
  if (!current) return;
  const { poster, seed } = current;
  const url = `${location.origin}/p/${poster.slug}/#s=${seed.toString(36)}`;
  const data = { title: `${poster.title} · Idan Segev`, text: poster.blurb, url };
  if (navigator.share) {
    try { await navigator.share(data); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast('Link copied'); }
  catch (e) { toast(url, 4000); }
}

// A row's Copy prompt button copies a brief for recreating that poster in the visitor's own AI tool; true when it was copied.
async function copyPrompt(poster) {
  const text = `Build "${poster.title}", an interactive typographic poster, as a single self-contained HTML file with no build step.\n\n${poster.prompt || poster.blurb}\n\nMake it work with mouse and touch, size it to the full viewport, keep the composition simple and bold, and respect prefers-reduced-motion. Start with the flat look and let the behaviour be a discovery.`;
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall through */ }
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
  ta.remove();
  return ok;
}

// The name swaps the tagline for the social links (on hover with a mouse, on tap with a finger).
const nameBtn = $('btn-name'), whoEl = $('who');
function setLinks(open) {
  whoEl.classList.toggle('open', open);
  nameBtn.setAttribute('aria-expanded', String(open));
}

// ---------- the menu: hover the top-left corner, click, and the posters are listed in large type with a preview following the pointer ----------
const menuBtn = $('menu-corner'), indexEl = $('index'), listEl = $('index-list'), peekEl = $('peek'), peekImg = peekEl.querySelector('img');
let indexOpen = false, peekRaf = 0;
const peek = { x: 0, y: 0, tx: 0, ty: 0, slug: '' };
function buildIndex() {
  listEl.textContent = '';
  listEl.style.setProperty('--rows', PUBLISHED.length);                         // the type shrinks so every row fits the window (see .index-list a)
  PUBLISHED.forEach((p, i) => {
    const li = document.createElement('li'), a = document.createElement('a');
    a.href = `/p/${p.slug}/`; a.dataset.slug = p.slug; a.innerHTML = `<span class="t"></span><span class="n">${String(i + 1).padStart(2, '0')}</span>`;
    a.querySelector('.t').textContent = p.title; li.appendChild(a);
    const cp = document.createElement('button'); cp.type = 'button'; cp.className = 'cp'; cp.dataset.slug = p.slug; cp.textContent = 'Copy prompt'; cp.setAttribute('aria-label', `Copy the prompt for ${p.title}`); li.appendChild(cp);
    listEl.appendChild(li);
  });
}
function peekLoop() {
  peek.x += (peek.tx - peek.x) * 0.16; peek.y += (peek.ty - peek.y) * 0.16;
  peekEl.style.transform = `translate3d(${peek.x.toFixed(1)}px, ${peek.y.toFixed(1)}px, 0)`;
  peekRaf = indexOpen ? requestAnimationFrame(peekLoop) : 0;
}
function peekShow(slug, e) {
  if (e && e.pointerType === 'touch') return;                                  // no hover on touch: the list alone
  if (peek.slug !== slug) {
    peek.slug = slug; peekImg.src = `/assets/previews/${slug}.jpg`;
    peekEl.classList.remove('swap'); void peekEl.offsetWidth; if (!reduced) peekEl.classList.add('swap');
  }
  peekEl.classList.add('on');
}
function openIndex() {
  if (indexOpen || document.documentElement.dataset.bare !== undefined) return;
  indexOpen = true; if (!listEl.children.length) buildIndex();
  indexEl.hidden = false; document.body.classList.add('index-open'); menuBtn.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => indexEl.classList.add('on'));
  if (!peekRaf) peekRaf = requestAnimationFrame(peekLoop);
  PUBLISHED.forEach((p) => { const im = new Image(); im.src = `/assets/previews/${p.slug}.jpg`; });   // warm the previews
}
function closeIndex() {
  if (!indexOpen) return;
  indexOpen = false; indexEl.classList.remove('on'); peekEl.classList.remove('on'); peek.slug = ''; document.body.classList.remove('index-open'); menuBtn.setAttribute('aria-expanded', 'false');
  setTimeout(() => { if (!indexOpen) indexEl.hidden = true; }, reduced ? 0 : 300);
}
async function openPoster(slug) {
  closeIndex();
  const poster = bySlug(slug);
  if (!poster || busy || !current || current.poster.slug === slug) return;
  shuffles++;
  if (location.pathname !== '/') history.replaceState(null, '', '/');
  await show(poster);
}
menuBtn.addEventListener('click', () => (indexOpen ? closeIndex() : openIndex()));
listEl.addEventListener('pointerover', (e) => {
  if (e.target.closest('.cp')) { peekEl.classList.remove('on'); peek.slug = ''; return; }          // on the copy button the preview steps aside
  const li = e.target.closest('li'); if (li) peekShow(li.querySelector('a').dataset.slug, e);
});
listEl.addEventListener('focusin', (e) => { if (e.target.closest('.cp')) return; const li = e.target.closest('li'); if (li) peekShow(li.querySelector('a').dataset.slug); });
listEl.addEventListener('pointerleave', () => { peekEl.classList.remove('on'); peek.slug = ''; });
indexEl.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; peek.tx = e.clientX + 18; peek.ty = e.clientY + 18; if (!peekEl.classList.contains('on')) { peek.x = peek.tx; peek.y = peek.ty; } });
indexEl.addEventListener('click', async (e) => {
  const cp = e.target.closest('.cp');
  if (cp) {                                                                    // copy this poster's prompt; the button says so, then goes back
    const ok = await copyPrompt(bySlug(cp.dataset.slug)); cp.textContent = ok ? 'Copied' : 'Copy failed'; cp.classList.add('done');
    clearTimeout(cp._t); cp._t = setTimeout(() => { cp.textContent = 'Copy prompt'; cp.classList.remove('done'); }, 1800); return;
  }
  const a = e.target.closest('a');
  if (a) { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); openPoster(a.dataset.slug); }
  else if (!e.target.closest('.index-list')) closeIndex();                      // a click beside the list closes it
});

// ---------- wiring ----------
nameBtn.addEventListener('click', () => setLinks(!whoEl.classList.contains('open')));
addEventListener('pointerdown', (e) => { if (whoEl.classList.contains('open') && !e.target.closest('.who')) setLinks(false); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') { setLinks(false); closeIndex(); } });
$('btn-shuffle').addEventListener('click', shuffle);
$('btn-share').addEventListener('click', share);
// Parked (7 Oct 2026): the rotating aside after the role line is off for now (see docs/PROJECT.md, "To reconsider"). To bring it back, restore <span id="tagline"> in index.html and uncomment:
// $('tagline').textContent = ASIDES[Math.floor(Math.random() * ASIDES.length)];

addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
  if (indexOpen) {                                                              // the menu is open: the arrows walk the list, nothing else shuffles
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const rows = [...listEl.querySelectorAll('a')], i = rows.indexOf(document.activeElement), n = e.key === 'ArrowDown' ? (i + 1) % rows.length : (i <= 0 ? rows.length - 1 : i - 1); rows[n].focus(); }
    return;
  }
  const onControl = e.target.closest && e.target.closest('button, a');
  if (e.key === ' ' || e.key === 'Enter') { if (onControl) return; e.preventDefault(); shuffle(); }
  else if (e.key === 'ArrowRight' || e.key === 'r' || e.key === 'R') { e.preventDefault(); shuffle(); }
  else if ((e.key === 's' || e.key === 'S') && !$('btn-share').hidden) { share(); }
  else if (e.key === 't' || e.key === 'T') { togglePanel(); }
});

const first = pickFirst();
show(first, { seed: seedFromHash() ?? randomSeed() });
