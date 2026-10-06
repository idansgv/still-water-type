// The shell: picks a poster at random, mounts it, and keeps the page furniture honest.

import { POSTERS, PUBLISHED, bySlug, pickTheme } from './posters/index.js';
import { createStage, THEMES, fontsReady, mulberry32 } from './engine.js';
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
    panel = createPanel(current.inst.tune, { toast, onClose: () => { wantPanel = false; panel = null; } });
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
  return pickOther(last);
}
function seedFromHash() {
  const m = /[#&]s=([0-9a-z]+)/i.exec(location.hash);
  return m ? parseInt(m[1], 36) >>> 0 : null;
}
function chooseTheme(poster, seed) {
  const forced = params.get('theme');
  if (forced === 'light' || forced === 'dark') return forced;
  return pickTheme(poster, mulberry32(seed ^ 0x9e3779b9));
}

// ---------- mounting ----------
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme.name;
  const root = document.documentElement.style;
  ['--bg', '--fg', '--dim'].forEach((k) => root.removeProperty(k));
  stageEl.style.background = '';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.bg);
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
  const theme = THEMES[themeName || chooseTheme(poster, seed)];

  if (panel) { panel.destroy(); panel = null; }
  if (current) {
    stageEl.classList.add('swap');
    await wait(reduced ? 0 : 100);
    if (current.stage) current.stage.destroy();
    stageEl.querySelectorAll('.fallback').forEach((n) => n.remove());
  }
  applyTheme(theme);
  setChrome(poster);

  const stage = createStage(stageEl, { seed, theme, toast, setBackdrop });
  stage.flip = shuffles % 2 === 1;
  current = { poster, stage, seed, theme };
  let inst = null;
  try {
    await fontsReady();
    const mod = await poster.load();
    inst = await mod.mount(stage);
    current.inst = inst;
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
  window.__poster = { slug: poster.slug, seed, theme: theme.name, stage: current.stage, inst };
  try { localStorage.setItem('swt:last', poster.slug); } catch (e) { /* ignore */ }
  requestAnimationFrame(() => stageEl.classList.remove('swap'));
  busy = false;
}

async function shuffle() {
  if (busy || !current) return;
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

// ---------- wiring ----------
$('btn-shuffle').addEventListener('click', shuffle);
$('btn-share').addEventListener('click', share);
$('tagline').textContent = ASIDES[Math.floor(Math.random() * ASIDES.length)];

addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
  const onControl = e.target.closest && e.target.closest('button, a');
  if (e.key === ' ' || e.key === 'Enter') { if (onControl) return; e.preventDefault(); shuffle(); }
  else if (e.key === 'ArrowRight' || e.key === 'r' || e.key === 'R') { e.preventDefault(); shuffle(); }
  else if (e.key === 's' || e.key === 'S') { share(); }
  else if (e.key === 't' || e.key === 'T') { togglePanel(); }
});

const first = pickFirst();
show(first, { seed: seedFromHash() ?? randomSeed() });
