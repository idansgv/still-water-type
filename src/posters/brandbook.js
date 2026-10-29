// Brandbook: a black-and-white brand book for a venture that does not exist, named after Idan.
//
// Every showing rolls a venture (Records, Swimming Club, Hardware, ...), a display face with its own case and tracking,
// and a signature device: a field (sphere, letter or monogram, waves, burst, rings) drawn through a screen (halftone,
// engraved lines, ordered dither, contour bands, coarse bitmap). Twelve 16:9 slides: cover, idea, contents, logo, misuse,
// typography, tone, device, imagery, two pages of it in use, and the end. Section titles are fitted past the slide edge.
//
// Hold: the brand morphs into the next one. Each display letter changes face at its own moment, the device melts into the
// next shape, then the new brand shows through growing dots (or thickening lines) of its own screen. Let go before halfway
// and it rewinds. Drag a lockup on the misuse slide and you break that rule by hand; let go and it springs back, corrected.
// Three taps: the construction (grid, baselines and cap heights, the mark's geometry, how each device is built).
// Layout (settings): 0 a wall you scroll inside the poster, 1 the whole book on one screen, 2 one slide at a time.
// Prototype and history: docs/posters/brandbook.md, docs/posters/prototypes/brandbook.html.

import { pressTracker, REFORM_DELAY_MS } from '../gestures.js';
import { createReveal, ink, label } from './reveal.js';

// ---------- the world ----------
const CONCEPTS = [
  { v: 'Records', what: 'an independent record label for music that is too loud for the radio', slogans: ['Pressed loud.', 'Side A only.', 'Turn it up. Then once more.'], item: 'sleeve', tags: ['Vinyl', 'Tape', 'Live'] },
  { v: 'Swimming Club', what: 'a members-only outdoor pool, open from the first heatwave to the last', slogans: ['Lane four, forever.', 'Cold water. Warm people.', 'Jump in.'], item: 'ticket', tags: ['Members', 'Lanes', 'Summer'] },
  { v: 'Hardware', what: 'a hardware store for people who want to do it properly, once', slogans: ['Measure twice.', 'Tools for doing it right.', 'Built to be fixed.'], item: 'sign', tags: ['Tools', 'Timber', 'Advice'] },
  { v: 'Observatory', what: 'a public observatory on a hill outside the city, open after dark', slogans: ['Open after dark.', 'Look up.', 'Clear skies only.'], item: 'ticket', tags: ['Night', 'Stars', 'Talks'] },
  { v: 'Bakery', what: 'a neighbourhood bakery that sells out by ten', slogans: ['Out of the oven at six.', 'Sold out by ten.', 'Flour, water, time.'], item: 'cup', tags: ['Bread', 'Coffee', 'Early'] },
  { v: 'Radio 88.4', what: 'a late-night radio station run by people who like talking too much', slogans: ['On air, off script.', 'Nobody sleeps.', 'Stay tuned.'], item: 'sleeve', tags: ['Night', 'Talk', 'Static'] },
  { v: 'Transit', what: 'a fictional city transit authority with one line that goes everywhere', slogans: ['Next stop: everywhere.', 'Mind the gap.', 'Always on time. Mostly.'], item: 'sign', tags: ['Lines', 'Stops', 'Tickets'] },
  { v: 'Type Foundry', what: 'a small type foundry that draws letters for hire', slogans: ['Letters for hire.', 'Every glyph, by hand.', 'Kerned with love.'], item: 'sleeve', tags: ['Fonts', 'Custom', 'Lettering'] },
  { v: 'Boxing Gym', what: 'a basement boxing gym with one rule: show up', slogans: ['Show up.', 'Hit back.', 'Round twelve.'], item: 'ticket', tags: ['Rounds', 'Ring', 'Sweat'] },
  { v: 'Hotel', what: 'a twelve-room hotel by the sea with no televisions', slogans: ['Check in. Slow down.', 'Twelve rooms. One sea.', 'Do not disturb.'], item: 'card', tags: ['Rooms', 'Sea', 'Quiet'] },
];
// display face, weight, style, case, tracking (em), leading, text face
const TYPES = [
  ['Anton', 400, 'normal', 'upper', 0, 0.86, 'Archivo'],
  ['Archivo Black', 400, 'normal', 'upper', -0.03, 0.84, 'IBM Plex Mono'],
  ['Big Shoulders Display', 800, 'normal', 'upper', 0, 0.82, 'IBM Plex Mono'],
  ['Unbounded', 800, 'normal', 'upper', -0.03, 0.9, 'Hanken Grotesk'],
  ['Syne', 800, 'normal', 'lower', -0.04, 0.86, 'Hanken Grotesk'],
  ['Instrument Serif', 400, 'italic', 'none', -0.02, 0.86, 'Libre Caslon Text'],
  ['Fraunces', 900, 'italic', 'none', -0.03, 0.86, 'Hanken Grotesk'],
  ['Rubik Mono One', 400, 'normal', 'upper', -0.05, 0.92, 'IBM Plex Mono'],
  ['Dela Gothic One', 400, 'normal', 'upper', -0.02, 0.95, 'Hanken Grotesk'],
  ['Climate Crisis', 400, 'normal', 'upper', -0.02, 0.88, 'IBM Plex Mono'],
  ['Bodoni Moda', 700, 'italic', 'none', -0.04, 0.84, 'Hanken Grotesk'],
  ['Bricolage Grotesque', 800, 'normal', 'lower', -0.05, 0.84, 'Archivo'],
  ['Six Caps', 400, 'normal', 'upper', 0, 0.84, 'IBM Plex Mono'],
  ['Michroma', 400, 'normal', 'upper', 0.02, 1, 'IBM Plex Mono'],
];
const CSS = {                     // Google Fonts families, each requested only when a brand needs it
  'Anton': 'Anton', 'Archivo Black': 'Archivo+Black', 'Big Shoulders Display': 'Big+Shoulders+Display:wght@800', 'Unbounded': 'Unbounded:wght@800',
  'Syne': 'Syne:wght@800', 'Instrument Serif': 'Instrument+Serif:ital@1', 'Fraunces': 'Fraunces:ital,opsz,wght@1,9..144,900', 'Rubik Mono One': 'Rubik+Mono+One',
  'Dela Gothic One': 'Dela+Gothic+One', 'Climate Crisis': 'Climate+Crisis', 'Bodoni Moda': 'Bodoni+Moda:ital,opsz,wght@1,6..96,700',
  'Bricolage Grotesque': 'Bricolage+Grotesque:opsz,wght@12..96,800', 'Six Caps': 'Six+Caps', 'Michroma': 'Michroma',
  'Archivo': 'Archivo:wght@400;600', 'IBM Plex Mono': 'IBM+Plex+Mono:wght@400;500', 'Hanken Grotesk': 'Hanken+Grotesk:wght@400;600', 'Libre Caslon Text': 'Libre+Caslon+Text',
};
const FIELDS = ['sphere', 'letter', 'waves', 'burst', 'rings', 'letter', 'sphere'];
const RENDERS = ['halftone', 'lines', 'dither', 'contour', 'pixels'];
const RENDER_NAMES = { halftone: '45° halftone', lines: 'engraved line screen', dither: 'ordered dither', contour: 'contour bands', pixels: 'coarse bitmap' };
const GREYS = [['Ink', 'Graphite', 'Fog', 'Paper'], ['Night', 'Smoke', 'Mist', 'Chalk'], ['Coal', 'Iron', 'Ash', 'Salt'], ['Black', 'Lead', 'Concrete', 'Bone'], ['Tar', 'Slate', 'Dust', 'Milk']];
const RATIOS = [[6, 3, 1, 1.4], [4, 3, 2, 2], [5, 1.4, 1.4, 3]];
const SECTIONS = ['The idea', 'Contents', 'Logo', 'Misuse', 'Typography', 'Tone', 'Device', 'Imagery', 'In use', 'In use, again'];
const NAME = 'Idan Segev';
// misuse: each rule, its caption, and the drag (x, y in tile widths) it starts from
const DONT = {
  stretch: { c: 'Don’t stretch it', rest: [0.3, 0] },
  squash: { c: 'Don’t squash it', rest: [0, 0.3] },
  tilt: { c: 'Don’t tilt it', rest: [-0.18, 0] },
  fade: { c: 'Don’t fade it', rest: [0.4, 0] },
  shadow: { c: 'Don’t add a shadow', rest: [0.05, 0.05] },
  outline: { c: 'Don’t outline it', rest: [0.34, 0] },
  crowd: { c: 'Don’t crowd it', rest: [0.3, 0.24] },
};
const PRAISE = ['Better.', 'Thank you.', 'Much better.', 'That’s the one.'];
const FULL = new Set([0, 11]);    // cover and end span the wall
const SURFACE = new Set([9, 10]);

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (v) => v * v * (3 - 2 * v);
const hash = (a, b, c) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };

// ---------- a brand, rolled from a seeded random ----------
function makeBrand(rnd, not) {
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const rr = (a, b) => a + rnd() * (b - a);
  const shuffle = (a) => a.map((v) => [rnd(), v]).sort((x, y) => x[0] - y[0]).map((v) => v[1]);
  let c, t;
  do { c = pick(CONCEPTS); t = pick(TYPES); } while (not && (c === not.c || t === not.t));
  const render = pick(RENDERS);
  return {
    c, t, field: pick(FIELDS), render,
    alt: shuffle(RENDERS.filter((r) => r !== render)).slice(0, 3),
    letter: pick(['S', 'IS', 'I', 'S', 'IS']),
    light: [rr(-0.8, 0.8), rr(-0.9, -0.2)],
    cell: Math.round(rr(30, 70)),
    vol: 1 + Math.floor(rnd() * 12),
    slogan: pick(c.slogans),
    mark: pick(['circle', 'square', 'ring', 'none']),
    markText: pick(['IS', 'S', 'I·S']),
    lock: pick(['stack', 'line', 'stack']),
    crops: [0, 0, pick(['bl', 'br', 'tl', 'tr', 'bl']), 0, pick(['bl', 'br', 'tl', 'tr', 'bl']), pick(['bl', 'br', 'tl', 'tr', 'bl'])],
    inv: rnd() < 0.5 ? [0, 2, 5, 7, 11] : [1, 3, 4, 8],
    greys: pick(GREYS), gv: [100, Math.round(rr(66, 80)), Math.round(rr(18, 34)), 0],
    cover: pick(['right', 'top']),
    ratio: pick(RATIOS),
    donts: shuffle(Object.keys(DONT)).slice(0, 4),
    imgs: shuffle(['horizon', 'spheres', 'folds', 'noise']).slice(0, 3),
    ticket: 100 + Math.floor(rnd() * 899),
  };
}

// ---------- fields: darkness 0..1 over a box (u, v in 0..1), aspect = w / h ----------
const masks = new Map();
function letterMask(B) {
  const key = B.letter + B.t[0];
  if (masks.has(key)) return masks.get(key);
  const S = 300, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.textAlign = 'center';
  let fs = S * 0.9; g.font = `${B.t[2]} ${B.t[1]} ${fs}px "${B.t[0]}"`;
  const m = g.measureText(B.letter), h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  fs *= Math.min(S * 0.86 / Math.max(1, m.width), S * 0.86 / Math.max(1, h)); g.font = `${B.t[2]} ${B.t[1]} ${fs}px "${B.t[0]}"`;
  const m2 = g.measureText(B.letter);
  g.filter = 'blur(6px)'; g.fillText(B.letter, S / 2, S / 2 + (m2.actualBoundingBoxAscent - m2.actualBoundingBoxDescent) / 2);
  const d = g.getImageData(0, 0, S, S).data, a = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) a[i] = d[i * 4 + 3] / 255;
  const out = { S, a }; masks.set(key, out); return out;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const h = (p, q) => { const s = Math.sin(p * 127.1 + q * 311.7) * 43758.5453; return s - Math.floor(s); };
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) { let s = 0, a = 0.5; for (let i = 0; i < 4; i++) { s += a * vnoise(x, y); x *= 2; y *= 2; a *= 0.5; } return s; }

function field(kind, B, aspect, opt = {}) {
  const L = B.light, ll = Math.hypot(L[0], L[1], 0.8), lx = L[0] / ll, ly = L[1] / ll, lz = 0.8 / ll;
  const cx = opt.cx ?? 0.5, cy = opt.cy ?? 0.5, R = opt.r ?? 0.42, k1 = Math.min(aspect, 1);
  const shade = (x, y) => { const q = x * x + y * y; if (q > 1) return -1; const z = Math.sqrt(1 - q); return Math.min(1, 0.1 + (1 - Math.max(0, x * lx + y * ly + z * lz)) * 0.95); };
  if (kind === 'sphere') return (u, v) => Math.max(0, shade((u - cx) * aspect / (R * 2 * k1), (v - cy) / (R * 2 * k1)));
  if (kind === 'letter') {
    const M = letterMask(B), z = (opt.zoom || 1) * k1;
    return (u, v) => { const xx = (u - cx) * aspect / z + 0.5, yy = (v - cy) / z + 0.5; if (xx < 0 || yy < 0 || xx >= 1 || yy >= 1) return 0; return M.a[Math.floor(yy * M.S) * M.S + Math.floor(xx * M.S)]; };
  }
  if (kind === 'waves') { const k = 6 + B.cell % 5; return (u, v) => { const x = u * aspect; return 0.5 + 0.5 * Math.sin(k * x + 2.4 * Math.sin(k * 0.6 * v + x * 2)) * (0.35 + 0.65 * v); }; }
  if (kind === 'burst') { const n = 9 + 2 * (B.vol % 5); return (u, v) => { const x = (u - cx) * aspect / k1, y = (v - cy) / k1, r = Math.hypot(x, y), a = Math.atan2(y, x), edge = R * 1.05 * (0.74 + 0.26 * Math.cos(a * n)); return clamp((edge - r) * 14 + 0.5) * (1 - r * 0.5); }; }
  if (kind === 'rings') return (u, v) => Math.max(0, 1 - Math.hypot((u - cx) * aspect / k1, (v - cy) / k1) * 1.3);
  if (kind === 'horizon') {
    const sy = 0.32 + (B.vol % 4) * 0.05, sx = 0.3 + (B.cell % 5) * 0.1;
    return (u, v) => { if (Math.hypot((u - sx) * aspect, v - sy) < 0.15) return 0.04; if (v > 0.62 + 0.05 * Math.sin(u * 9) * fbm(u * 3, 1)) return 0.5 + 0.45 * fbm(u * 8, v * 30); return 0.12 + v * 0.6; };
  }
  if (kind === 'spheres') { const S = [[0.32, 0.52, 0.3], [0.74, 0.4, 0.18], [0.56, 0.8, 0.11]]; return (u, v) => { for (const [sx, sy, r] of S) { const s = shade((u - sx) * aspect / r, (v - sy) / r); if (s >= 0) return s; } return 0.06 + 0.12 * v; }; }
  if (kind === 'folds') return (u, v) => 0.5 + 0.45 * Math.sin(u * aspect * 7 + Math.sin(v * 5) * 2.2 + fbm(u * 2, v * 2) * 3);
  return (u, v) => clamp((fbm(u * aspect * 3, v * 3) - 0.25) * 1.8);
}

// ---------- screens: draw a field into a box ----------
const BAYER = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map((v) => (v + 0.5) / 64);
function screen(g, kind, f, X, Y, w, h, n, fast) {
  const q = fast ? 2 : 1, s = Math.max(w, h) / n;
  g.save(); g.beginPath(); g.rect(X, Y, w, h); g.clip();
  if (kind === 'halftone') {
    const c = Math.SQRT1_2, D = Math.hypot(w, h);
    g.beginPath();
    for (let a = -D; a < D; a += s) for (let b = -D; b < D; b += s) {
      const x = w / 2 + (a - b) * c, y = h / 2 + (a + b) * c; if (x < -s || y < -s || x > w + s || y > h + s) continue;
      const d = f(x / w, y / h); if (d < 0.02) continue;
      const r = Math.sqrt(d) * s * 0.72; g.moveTo(X + x + r, Y + y); g.arc(X + x, Y + y, r, 0, 6.2832);
    }
    g.fill();
  } else if (kind === 'lines') {
    const st = s * 0.8, dx = 1.5 * q;
    for (let y = st / 2; y < h; y += st) for (let x = 0; x < w; x += dx) { const d = f(x / w, y / h); if (d > 0.03) g.fillRect(X + x, Y + y - d * st * 0.48, dx + 0.1, d * st * 0.96); }
  } else if (kind === 'dither') {
    const p = Math.max(1.5, s / 5) * q;
    for (let y = 0, j = 0; y < h; y += p, j++) for (let x = 0, i = 0; x < w; x += p, i++) if (f(x / w, y / h) > BAYER[(j & 7) * 8 + (i & 7)]) g.fillRect(X + x, Y + y, p + 0.3, p + 0.3);
  } else if (kind === 'contour') {
    const p = 1.25 * q;
    for (let y = 0; y < h; y += p) for (let x = 0; x < w; x += p) { const d = f(x / w, y / h); if (d > 0.03 && ((d * 8) % 1) < 0.5) g.fillRect(X + x, Y + y, p + 0.2, p + 0.2); }
  } else {
    const p = s * 0.9;
    for (let y = 0; y < h; y += p) for (let x = 0; x < w; x += p) if (f((x + p / 2) / w, (y + p / 2) / h) > 0.45) g.fillRect(X + x, Y + y, p - 0.5, p - 0.5);
  }
  g.restore();
}

// ---------- one slide, drawn into a 2D context at (0,0) w x h ----------
// M (morph) = { p, N }: the slide is p of the way into brand N. D = the misuse drags. Returns what the reveal needs.
function paintSlide(g, i, B, w, h, M, D) {
  const u = w / 100, meta = { texts: [], marks: [], devs: [], tiles: [] };
  const inv = B.inv.includes(i), sur = SURFACE.has(i);
  const K = sur ? { ink: '#000', paper: '#cfcfcf', grey: '#444', line: '#bdbdbd' } : inv ? { ink: '#fff', paper: '#000', grey: '#9a9a9a', line: '#2a2a2a' } : { ink: '#000', paper: '#fff', grey: '#555', line: '#e2e2e2' };
  const p = M ? M.p : 0, N = M && M.N;
  const LS = 'letterSpacing' in g;
  const setLS = (px) => { if (LS) g.letterSpacing = `${px}px`; };
  const bodyB = N && p > 0.3 ? N : B;
  const dfont = (Bx, size) => `${Bx.t[2]} ${Bx.t[1]} ${size}px "${Bx.t[0]}", Impact, sans-serif`;
  const bfont = (size, wgt = 400) => `${wgt} ${size}px "${bodyB.t[6]}", "Helvetica Neue", Arial, sans-serif`;
  const cased = (s, Bx) => (Bx.t[3] === 'upper' ? s.toUpperCase() : Bx.t[3] === 'lower' ? s.toLowerCase() : s);
  const capOf = (Bx, size) => { g.font = dfont(Bx, 100); return g.measureText('H').actualBoundingBoxAscent / 100 * size; };
  let item = 0;

  // display line: whole when still; glyph by glyph (each with its own moment to change face) while morphing
  function dline(str, x, y, size, align = 'left', color = K.ink, opt = {}) {
    const id = item++, chars = [...str];
    const glyphs = chars.map((ch, j) => { const Bx = N && p > 0.04 + hash(i, id, j) * 0.5 ? N : B; const c = opt.raw ? ch : cased(ch, Bx); g.font = dfont(Bx, size); setLS(0); return { c, Bx, w: g.measureText(c).width + Bx.t[4] * size }; });
    const total = glyphs.reduce((a, q) => a + q.w, 0);
    let x0 = align === 'left' ? x : align === 'right' ? x - total : x - total / 2;
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    for (const q of glyphs) {
      g.font = dfont(q.Bx, size);
      if (opt.stroke) { g.lineWidth = opt.stroke; g.strokeStyle = color; g.strokeText(q.c, x0, y); }
      if (opt.fillA !== 0) { g.globalAlpha *= opt.fillA ?? 1; g.fillStyle = color; g.fillText(q.c, x0, y); g.globalAlpha /= opt.fillA ?? 1; }
      x0 += q.w;
    }
    return total;
  }
  const measureD = (lines, size, Bx = B, raw) => { g.font = dfont(Bx, size); setLS(Bx.t[4] * size); const w2 = Math.max(...lines.map((s) => g.measureText(raw ? s : cased(s, Bx)).width)); setLS(0); return w2; };
  const fitSize = (lines, maxW, maxH, raw) => {
    const w100 = measureD(lines, 100, B, raw), cap = capOf(B, 100), h100 = cap + (lines.length - 1) * B.t[5] * 100;
    return Math.min(100 * maxW / Math.max(1, w100), maxH ? 100 * maxH / h100 : Infinity);
  };
  // a block of display lines; y is the first baseline
  function dblock(lines, x, y, size, align = 'left', color = K.ink, opt = {}) {
    const lead = B.t[5] * size, cap = capOf(B, size); let wmax = 0;
    lines.forEach((s, k) => { wmax = Math.max(wmax, dline(s, x, y + k * lead, size, align, color, opt)); });
    g.font = dfont(B, size); const xh = g.measureText('x').actualBoundingBoxAscent;
    meta.texts.push({ x: align === 'left' ? x : align === 'right' ? x - wmax : x - wmax / 2, w: wmax, size, cap, xh: B.t[3] === 'upper' ? 0 : xh, bases: lines.map((_, k) => y + k * lead) });
    return { bottom: y + (lines.length - 1) * lead, w: wmax, cap };
  }
  function wrap(str, maxW, font) {
    g.font = font; const words = str.split(' '), out = []; let line = '';
    for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > maxW && line) { out.push(line); line = wd; } else line = t; }
    if (line) out.push(line); return out;
  }
  function body(str, x, y, maxW, size, color = K.ink, lh = 1.4, align = 'left') {
    const lines = wrap(str, maxW, bfont(size)); g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic'; setLS(0);
    lines.forEach((l, k) => g.fillText(l, x, y + size + k * size * lh)); return y + lines.length * size * lh;
  }
  function lab(str, x, y, color = K.grey, size = u, align = 'left', track = 0.08) {
    g.font = bfont(size, 400); setLS(size * track); g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic';
    g.fillText(str.toUpperCase(), x, y); setLS(0);
  }
  function mono(str, x, y, size, color, align = 'left') { g.font = `500 ${size}px "IBM Plex Mono", ui-monospace, monospace`; setLS(0); g.fillStyle = color; g.textAlign = align; g.fillText(str, x, y); }
  function dev(kind, rk, x, y, w2, h2, opt = {}, color = K.ink) {
    meta.devs.push({ x, y, w: w2, h: h2, kind, opt });
    if (w2 < 2 || h2 < 2) return;
    const fa = field(kind, B, w2 / h2, opt);
    let f = fa, fast = false;
    if (N && p > 0) { const m = ease(clamp(p / 0.6)); if (m > 0) { const fb = field(kind === B.field ? N.field : kind, N, w2 / h2, opt); f = (a, b) => fa(a, b) * (1 - m) + fb(a, b) * m; fast = m < 1; } }
    g.fillStyle = color;
    screen(g, rk, f, x, y, w2, h2, Math.max(12, Math.round(B.cell * Math.max(w2, h2) / 900)), fast);
  }
  function mark(cx, cy, s, color, bg, opt = {}) {
    meta.marks.push({ x: cx - s / 2, y: cy - s / 2, s });
    const fs = B.mark === 'none' ? s * 0.62 : B.mark === 'ring' ? s * 0.42 : s * 0.46;
    g.save(); g.globalAlpha *= opt.fillA ?? 1;
    if (B.mark === 'circle' || B.mark === 'square') { g.fillStyle = color; g.beginPath(); if (B.mark === 'circle') g.arc(cx, cy, s / 2, 0, 6.2832); else g.rect(cx - s / 2, cy - s / 2, s, s); g.fill(); }
    if (B.mark === 'ring') { g.strokeStyle = color; g.lineWidth = s * 0.06; g.beginPath(); g.arc(cx, cy, s / 2 - s * 0.03, 0, 6.2832); g.stroke(); }
    g.restore();
    if (opt.stroke) { g.strokeStyle = color; g.lineWidth = opt.stroke; g.beginPath(); if (B.mark === 'square') g.rect(cx - s / 2, cy - s / 2, s, s); else g.arc(cx, cy, s / 2, 0, 6.2832); g.stroke(); }
    const tc = B.mark === 'circle' || B.mark === 'square' ? bg : color;
    g.font = dfont(B, fs); const m = g.measureText(B.markText);
    const y = cy + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    dline(B.markText, cx, y, fs, 'center', tc, { raw: true, fillA: opt.fillA, stroke: opt.stroke });
  }
  // the lockup: mark, name, venture; centred on (cx, cy) or left-aligned at x
  function lockup(cx, cy, scale, center, color, bg, opt = {}) {
    const ms = scale * 0.22 * u, ns = scale / 4.6 * u, lines = B.lock === 'stack' ? ['Idan', 'Segev'] : [NAME];
    const lead = B.t[5] * ns, cap = capOf(B, ns), subS = 0.9 * u, gap = 0.6 * u;
    const H2 = ms + gap + cap + (lines.length - 1) * lead + gap + subS;
    let y = cy - H2 / 2;
    const nw = measureD(lines, ns), x = center ? cx : cx;
    mark(center ? cx : x + ms / 2, y + ms / 2, ms, color, bg, opt); y += ms + gap + cap;
    dblock(lines, center ? cx : x, y, ns, center ? 'center' : 'left', color, opt);
    y += (lines.length - 1) * lead + gap + subS;
    lab(B.c.v, center ? cx : x, y, color, subS, center ? 'center' : 'left', 0.3);
    return { w: Math.max(nw, ms), h: H2 };
  }
  const rh = (n, title, crop) => {
    if (!crop || crop[0] === 'b') { lab(`${NAME} ${B.c.v}`, 4 * u, 3.2 * u); lab(`${n} — ${title}`, 96 * u, 3.2 * u, K.grey, u, 'right'); }
    if (!crop || crop[0] === 't') { lab(`Brand guidelines Vol. ${B.vol}`, 4 * u, h - 2 * u); lab(n, 96 * u, h - 2 * u, K.grey, u, 'right'); }
  };
  // a section title fitted past the slide, cropped at a corner; returns the content box opposite it
  const huge = (txt, crop, raw) => {
    const size = Math.min(fitSize([txt], 1.18 * w, 0, raw), 0.42 * h / (capOf(B, 100) / 100));
    const cap = capOf(B, size), right = crop[1] === 'r', bottom = crop[0] === 'b';
    const y = bottom ? h + size * 0.03 : cap - size * 0.02;
    dblock([txt], right ? w + size * 0.03 : -size * 0.03, y, size, right ? 'right' : 'left', K.ink, { raw });
    return bottom ? { x: 4 * u, y: 5 * u, w: 92 * u, h: 27 * u } : { x: 4 * u, y: h - 32 * u, w: 92 * u, h: 27 * u };
  };
  const shadowed = (fn) => { g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 1.6 * u; g.shadowOffsetY = 0.6 * u; fn(); g.restore(); };
  const box = (x, y, w2, h2, col) => { g.fillStyle = col; g.fillRect(x, y, w2, h2); };

  g.save();
  box(0, 0, w, h, K.paper);

  if (i === 0) {                                                                   // cover
    const L = B.cover === 'right' ? [50, -4, 56, 64] : [50, -14, 58, 46];
    dev(B.field, B.render, L[0] * u, L[1] * u, L[2] * u, L[3] * u, { r: 0.46 });
    const metaRow = [`${NAME} ${B.c.v}`, 'Brand guidelines', `Vol. ${String(B.vol).padStart(2, '0')}`, '2026'];
    metaRow.forEach((s, k) => lab(s, (3 + k * 94 / 3) * u, 3.2 * u, K.ink, 0.8 * u, k === 0 ? 'left' : k === 3 ? 'right' : 'center', 0.1));
    body(`${NAME} ${B.c.v} is ${B.c.what}.`, 3 * u, 4.6 * u, 24 * u, 0.95 * u, K.ink, 1.35);
    const lines = ['Idan', 'Segev'], size = fitSize(lines, 1.04 * w, 0.76 * h);
    dblock(lines, -size * 0.02, h + size * 0.03 - B.t[5] * size, size);
  } else if (i === 1) {                                                            // the idea
    rh('01', 'The idea');
    dev(B.field, B.alt[0], 60 * u, -4 * u, 46 * u, 64 * u, { r: 0.5 });
    const lines = B.slogan.replace(/\. /g, '.\n').replace(/: /g, ':\n').split('\n'), size = fitSize(lines, 0.6 * w, 0.48 * h);
    dblock(lines, 4 * u, 7 * u + capOf(B, size), size);
    const para = `${NAME} ${B.c.v} is ${B.c.what}. Everything we make should feel like it came from the same place: one device, one face, ${B.t[3] === 'lower' ? 'all lowercase' : B.t[3] === 'upper' ? 'all capitals' : 'set in sentence case'}, and nothing in colour.`;
    const n = wrap(para, 25.5 * u, bfont(1.25 * u)).length, top = h - 4 * u - n * 1.25 * u * 1.4;
    body(para, 4 * u, top, 25.5 * u, 1.25 * u);
    B.c.tags.forEach((t, k) => { const y = top + k * 2.2 * u; box(32.5 * u, y, 25 * u, 0.1 * u, K.ink); lab(t, 32.5 * u, y + 1.5 * u, K.ink); });
  } else if (i === 2) {                                                            // contents
    const crop = B.crops[2]; rh('02', 'Contents', crop); const C = huge('Contents', crop);
    SECTIONS.forEach((t, k) => {
      const col = k % 3, row = Math.floor(k / 3), cw = (C.w - 6 * u) / 3, x = C.x + col * (cw + 3 * u), y = C.y + row * 4.4 * u;
      box(x, y, cw, 0.12 * u, K.ink); mono(String(k + 1).padStart(2, '0'), x, y + 2 * u, u, K.grey);
      g.font = bfont(1.5 * u); g.fillStyle = K.ink; g.textAlign = 'left'; g.fillText(t, x + 4 * u, y + 2.3 * u);
    });
  } else if (i === 3) {                                                            // logo
    const gap = 1.2 * u, fr = (w - 2 * gap) / 3.7, c1 = 1.7 * fr;
    box(0, 0, c1, h, K.paper); box(c1 + gap, 0, fr, h, '#000'); box(c1 + gap * 2 + fr, 0, fr, h, '#fff');
    g.save(); g.strokeStyle = K.ink; g.globalAlpha = 0.45; g.setLineDash([0.5 * u, 0.4 * u]); g.lineWidth = Math.max(1, 0.12 * u); g.strokeRect(c1 * 0.14, h * 0.14, c1 * 0.72, h * 0.72); g.restore();
    lockup(c1 / 2, h / 2, 22, true, K.ink, K.paper);
    lockup(c1 + gap + fr / 2, h / 2, 13, true, '#fff', '#000');
    mark(c1 + gap * 2 + fr * 1.5, h / 2, 9 * u, '#000', '#fff');
    g.globalAlpha = 0.6; lab('03 — Primary lockup · clear space = height of the mark', u, h - 0.9 * u, K.ink, 0.9 * u);
    lab('On black', c1 + gap + u, h - 0.9 * u, '#fff', 0.9 * u); lab('Mark alone · min 16 px', c1 + 2 * gap + fr + u, h - 0.9 * u, '#000', 0.9 * u); g.globalAlpha = 1;
  } else if (i === 4) {                                                            // misuse
    const crop = B.crops[4]; rh('04', 'Misuse', crop); const C = huge('Don’t', crop, true);
    const tw = (C.w - 3.6 * u) / 4, th = C.h - 2.4 * u;
    B.donts.forEach((k, j) => {
      const x = C.x + j * (tw + 1.2 * u), y = C.y, st = (D && D[k]) || { x: DONT[k].rest[0], y: DONT[k].rest[1], ok: false };
      meta.tiles.push({ x, y, w: tw, h: th, kind: k });
      box(x, y, tw, th, K.line);
      g.save(); g.beginPath(); g.rect(x, y, tw, th); g.clip();
      const cx = x + tw / 2, cy = y + th / 2, hy = Math.hypot(st.x, st.y);
      g.translate(cx, cy);
      const o = {};
      if (k === 'stretch') g.scale(clamp(1 + st.x * 2.2, 0.2, 4), 1);
      if (k === 'squash') g.scale(1, clamp(1 - st.y * 1.6, 0.1, 3));
      if (k === 'tilt') g.rotate((st.x * 80 + st.y * 40) * Math.PI / 180);
      if (k === 'fade') g.globalAlpha = clamp(1 - hy * 2);
      if (k === 'crowd') { g.translate(st.x * tw * 0.6, st.y * tw * 0.6); g.scale(1 + hy * 1.2, 1 + hy * 1.2); }
      if (k === 'outline') { const v = clamp(hy * 3); o.fillA = 1 - v; o.stroke = v > 0.01 ? Math.max(0.8, v * 0.1 * u) : 0; }
      if (k === 'shadow') lockup(st.x * 12 * u, st.y * 12 * u, 9, true, '#8a8a8a', K.line);
      lockup(0, 0, 9, true, K.ink, K.line, o);
      g.restore();
      if (!st.ok) { g.save(); g.strokeStyle = K.ink; g.lineWidth = Math.max(1, 0.2 * u); g.beginPath(); g.moveTo(x, y + th); g.lineTo(x + tw, y); g.stroke(); g.restore(); }
      g.font = bfont(1.05 * u); g.fillStyle = K.ink; g.textAlign = 'left'; g.fillText(st.ok ? st.praise : DONT[k].c, x, y + th + 1.8 * u);
    });
  } else if (i === 5) {                                                            // typography
    const crop = B.crops[5]; rh('05', 'Typography', crop); const C = huge(B.t[3] === 'lower' ? 'aa' : 'Ag', crop, true);
    const fr = (C.w - 6 * u) / 3.1, x1 = C.x, x2 = x1 + 1.1 * fr + 3 * u, x3 = x2 + fr + 3 * u;
    lab(`Display · ${B.t[0]}`, x1, C.y + u);
    const spec = cased('ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 &!?', B), ss = 2.4 * u; g.font = dfont(B, ss);
    let line = '', yy = C.y + 2 * u + ss; const lines = [];
    for (const ch of spec) { if (g.measureText(line + ch).width > 1.1 * fr) { lines.push(line); line = ''; } line += ch; }
    lines.push(line); lines.forEach((l, k) => dline(l, x1, yy + k * ss * 1.12, ss, 'left', K.ink, { raw: true }));
    lab('Hierarchy', x2, C.y + u);
    const h1 = 3 * u, h1l = wrap(cased(B.slogan, B), fr, dfont(B, h1));
    let y2 = C.y + 2 * u + capOf(B, h1); h1l.forEach((l, k) => dline(l, x2, y2 + k * h1 * 0.95, h1, 'left', K.ink, { raw: true }));
    y2 += (h1l.length - 1) * h1 * 0.95 + 1.2 * u + capOf(B, 1.7 * u); dline(B.c.tags.join(' / '), x2, y2, 1.7 * u);
    body(`Body copy is set in ${B.t[6]}, ${B.t[6].includes('Mono') ? 'a monospace that keeps everything feeling filed and counted' : 'quiet enough to let the display face shout'}.`, x2, y2 + 0.4 * u, fr, 1.25 * u);
    lab(`Text · ${B.t[6]}`, x3, C.y + u);
    const end = body('Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt', x3, C.y + 1.6 * u, fr, 2 * u, K.ink, 1.15);
    lab(`Tracking ${B.t[4] ? B.t[4] + ' em' : 'neutral'} · leading ${B.t[5]}`, x3, end + 1.6 * u);
  } else if (i === 6) {                                                            // tone
    const sum = B.ratio.reduce((a, b) => a + b, 0); let x = 0;
    B.greys.forEach((n, k) => {
      const cw = w * B.ratio[k] / sum, kv = B.gv[k], gv = Math.round(255 * (1 - kv / 100)), fg = kv > 45 ? '#fff' : '#000';
      box(x, 0, cw + 1, h, `rgb(${gv},${gv},${gv})`);
      const s = 2.6 * u; dline(n, x + 1.6 * u, 2.4 * u + capOf(B, s), s, 'left', fg);
      mono(`K ${kv}`, x + 1.6 * u, 2.4 * u + capOf(B, s) + 1.6 * u, 0.9 * u, fg); mono(`#${gv.toString(16).padStart(2, '0').repeat(3)}`, x + 1.6 * u, 2.4 * u + capOf(B, s) + 2.8 * u, 0.9 * u, fg);
      x += cw;
    });
    lab('06 — Tone · no colour, ever', 4 * u, h - 2 * u, '#fff');
    lab(['60 / 30 / 10', '70 / 20 / 10', '50 / 40 / 10'][B.vol % 3], 96 * u, h - 2 * u, B.gv[3] > 45 ? '#fff' : '#000', u, 'right');
  } else if (i === 7) {                                                            // the device
    dev(B.field, B.render, 0, 0, 0.58 * w, h, { r: 0.44 });
    const vx = 61 * u, vw = 36 * u, rowH = (h - 6 * u - 2.4 * u) / 3, bw = (vw - 1.2 * u) / 2.2;
    B.alt.forEach((rk, k) => {
      const y = 3 * u + k * (rowH + 1.2 * u);
      box(vx, y, bw, rowH, K.line); dev(B.field, rk, vx, y, bw, rowH, { r: 0.42 });
      lab(RENDER_NAMES[rk], vx + bw + 1.2 * u, y + rowH - 1.6 * u, K.ink); lab('Allowed for secondary use', vx + bw + 1.2 * u, y + rowH - 0.2 * u);
    });
    lab(`07 — The device · ${B.field === 'letter' ? (B.letter.length > 1 ? 'the monogram' : 'the letter ' + B.letter) : 'a ' + B.field}, ${RENDER_NAMES[B.render]}, ${B.cell} cells across`, 2 * u, h - 1.8 * u);
  } else if (i === 8) {                                                            // imagery
    const gap = 0.8 * u, fr = (w - gap) / 2.6, c1 = 1.6 * fr, rh2 = (h - gap) / 2;
    const R = [[0, 0, c1, h], [c1 + gap, 0, fr, rh2], [c1 + gap, rh2 + gap, fr, rh2]];
    R.forEach(([x, y, w2, h2], k) => {
      box(x, y, w2, h2, K.line); dev(B.imgs[k], B.render, x, y, w2, h2, {});
      const cap = k === 0 ? `08 — All imagery: ${RENDER_NAMES[B.render]}` : ['', 'Crop tight', 'Never full tone'][k];
      g.font = `500 ${0.85 * u}px "IBM Plex Mono", monospace`; const tw = g.measureText(cap).width;
      box(x + u, y + h2 - 2.4 * u, tw + 1.2 * u, 1.6 * u, K.paper); mono(cap, x + 1.6 * u, y + h2 - 1.25 * u, 0.85 * u, K.ink);
    });
  } else if (i === 9) {                                                            // in use
    lab('09 — In use', 3 * u, 3.4 * u, K.ink);
    const P = [5 * u, 6 * u, 24 * u, 24 * 1.4142 * u];
    shadowed(() => box(...P, '#000')); dev(B.field, B.render, ...P, { r: 0.48 }, '#fff');
    lab(B.c.tags[0], P[0] + 0.06 * P[2], P[1] + 0.07 * P[3], '#fff', 0.9 * u, 'left', 0.1); lab(B.c.tags[1], P[0] + 0.94 * P[2], P[1] + 0.07 * P[3], '#fff', 0.9 * u, 'right', 0.1);
    dblock(['Idan', 'Segev'], P[0] + 0.06 * P[2], P[1] + P[3] * 0.96 - B.t[5] * 5 * u, 5 * u, 'left', '#fff');
    const T = [36 * u, 16 * u, 26 * u, 32 * u];
    g.save(); g.strokeStyle = '#e6e6e2'; g.lineWidth = 1.1 * u; g.beginPath(); g.ellipse(T[0] + T[2] / 2, T[1], T[2] * 0.18, T[3] * 0.22, 0, Math.PI, 0); g.stroke(); g.restore();
    shadowed(() => box(...T, '#f4f4f2')); dev(B.field, B.alt[1], T[0] + 0.12 * T[2], T[1] + 0.08 * T[3], 0.76 * T[2], 0.62 * T[3], { r: 0.46 }, '#000');
    const sl = wrap(cased(B.slogan, B), 0.76 * T[2], dfont(B, 2 * u)); sl.forEach((l, k) => dline(l, T[0] + 0.12 * T[2], T[1] + T[3] * 0.93 - (sl.length - 1 - k) * 2 * u * B.t[5], 2 * u, 'left', '#000', { raw: true }));
    const C1 = [68 * u, 10 * u, 26 * u, 26 * 55 / 85 * u];
    g.save(); g.translate(C1[0] + C1[2] / 2, C1[1] + C1[3] / 2); g.rotate(-4 * Math.PI / 180);
    shadowed(() => box(-C1[2] / 2, -C1[3] / 2, C1[2], C1[3], '#fff'));
    lockup(-C1[2] / 2 + 0.08 * C1[2], 0, 9, false, '#000', '#fff');
    mono('Idan Segev', C1[2] / 2 - 0.08 * C1[2], C1[3] / 2 - 0.1 * C1[3] - 1.1 * u, 0.8 * u, '#000', 'right'); mono('idansegev.com', C1[2] / 2 - 0.08 * C1[2], C1[3] / 2 - 0.1 * C1[3], 0.8 * u, '#000', 'right');
    g.restore();
    const C2 = [72 * u, 31 * u, 22 * u, 22 * 55 / 85 * u];
    g.save(); g.translate(C2[0] + C2[2] / 2, C2[1] + C2[3] / 2); g.rotate(5 * Math.PI / 180);
    shadowed(() => box(-C2[2] / 2, -C2[3] / 2, C2[2], C2[3], '#000')); dev(B.field, B.render, -C2[2] / 2, -C2[3] / 2, C2[2], C2[3], { r: 0.5 }, '#fff');
    g.restore();
  } else if (i === 10) {                                                           // in use, again
    lab('10 — In use, again', 3 * u, 3.4 * u, K.ink);
    const it = B.c.item;
    if (it === 'sleeve') {
      shadowed(() => { g.fillStyle = '#060606'; g.beginPath(); g.arc(34 * u, 23 * u, 14 * u, 0, 6.2832); g.fill(); });
      g.fillStyle = '#ddd'; g.beginPath(); g.arc(34 * u, 23 * u, 2.1 * u, 0, 6.2832); g.fill();
      const S = [5 * u, 8 * u, 30 * u, 30 * u]; shadowed(() => box(...S, '#fff')); dev(B.field, B.render, ...S, { r: 0.5 }, '#000');
      dblock(['Idan', 'Segev'], S[0] + 0.05 * S[2], S[1] + S[3] * 0.96 - B.t[5] * 4.2 * u, 4.2 * u, 'left', '#000');
    } else if (it === 'ticket') {
      const T = [4 * u, 14 * u, 46 * u, 46 / 2.4 * u]; shadowed(() => box(...T, '#fff'));
      dev(B.field, B.render, T[0], T[1], 0.74 * 0.44 * T[2], T[3], { r: 0.5 }, '#000');
      g.save(); g.setLineDash([0.5 * u, 0.4 * u]); g.strokeStyle = '#999'; g.lineWidth = 0.2 * u; g.beginPath(); g.moveTo(T[0] + 0.74 * T[2], T[1]); g.lineTo(T[0] + 0.74 * T[2], T[1] + T[3]); g.stroke(); g.restore();
      dblock([NAME], T[0] + 0.74 * 0.48 * T[2], T[1] + 0.14 * T[3] + capOf(B, 2.3 * u), 2.3 * u, 'left', '#000');
      lab(`${B.c.v} · Admit one`, T[0] + 0.74 * 0.48 * T[2], T[1] + 0.14 * T[3] + capOf(B, 2.3 * u) + 2 * u, '#000');
      [`No. ${B.ticket}`, `Row ${String.fromCharCode(65 + B.vol)}`, `Seat ${B.vol + 3}`].forEach((s, k) => mono(s, T[0] + 0.96 * T[2], T[1] + 0.3 * T[3] + k * 1.6 * u, u, '#000', 'right'));
    } else if (it === 'cup') {
      const C = [12 * u, 8 * u, 24 * u, 24 / 0.78 * u];
      g.save(); g.beginPath(); g.moveTo(C[0], C[1]); g.lineTo(C[0] + C[2], C[1]); g.lineTo(C[0] + 0.88 * C[2], C[1] + C[3]); g.lineTo(C[0] + 0.12 * C[2], C[1] + C[3]); g.closePath();
      g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 1.6 * u; g.shadowOffsetY = 0.6 * u; g.fillStyle = '#fff'; g.fill(); g.restore();
      dev(B.field, B.render, C[0] + 0.1 * C[2], C[1] + 0.14 * C[3], 0.8 * C[2], 0.52 * C[3], { r: 0.5 }, '#000');
      dblock([NAME], C[0] + C[2] / 2, C[1] + 0.88 * C[3], 2.2 * u, 'center', '#000');
    } else if (it === 'card') {
      const K2 = [6 * u, 12 * u, 38 * u, 38 * 55 / 85 * u];
      g.save(); g.translate(K2[0] + K2[2] / 2, K2[1] + K2[3] / 2); g.rotate(-3 * Math.PI / 180);
      shadowed(() => box(-K2[2] / 2, -K2[3] / 2, K2[2], K2[3], '#000')); dev(B.field, B.render, -K2[2] / 2, -K2[3] / 2, 0.48 * K2[2], K2[3], { r: 0.5 }, '#fff');
      dblock(['Room', String(B.vol + 1)], 0.04 * K2[2], -K2[3] / 2 + 0.12 * K2[3] + capOf(B, 5 * u), 5 * u, 'left', '#fff');
      lab(`Key card · ${B.c.v}`, 0.04 * K2[2], K2[3] / 2 - 0.12 * K2[3], '#fff');
      g.restore();
    } else {
      box(21 * u, 20 * u, 0.7 * u, h - 20 * u, '#777');
      const S = [4 * u, 8 * u, 38 * u, 38 / 3 * u]; shadowed(() => box(...S, '#000')); dev(B.field, B.render, S[0], S[1], 0.33 * S[2], S[3], { r: 0.5 }, '#fff');
      const s = 3.4 * u, c = capOf(B, s); dblock([B.c.tags[0], B.c.tags[1]], S[0] + 0.38 * S[2], S[1] + S[3] / 2 - (B.t[5] * s) / 2 + c / 2 - 0.2 * u, s, 'left', '#fff');
    }
    shadowed(() => { g.fillStyle = '#fff'; g.beginPath(); g.arc(61.5 * u, 12.5 * u, 7.5 * u, 0, 6.2832); g.fill(); });
    mark(61.5 * u, 12.5 * u, 8 * u, '#000', '#fff');
    const Bn = [55 * u, 24 * u, 40 * u, 40 / 2.6 * u]; shadowed(() => box(...Bn, '#000')); dev(B.field, B.alt[2], Bn[0], Bn[1], 0.4 * Bn[2], Bn[3], { r: 0.5 }, '#fff');
    const sl = wrap(cased(B.slogan, B), 0.52 * Bn[2], dfont(B, 2.6 * u));
    sl.forEach((l, k) => dline(l, Bn[0] + 0.44 * Bn[2], Bn[1] + 0.12 * Bn[3] + capOf(B, 2.6 * u) + k * 2.6 * u * B.t[5], 2.6 * u, 'left', '#fff', { raw: true }));
    lab(`${NAME} ${B.c.v}`, Bn[0] + 0.44 * Bn[2], Bn[1] + 0.9 * Bn[3], '#bbb');
  } else if (i === 11) {                                                           // the end
    const size = fitSize([NAME], 1.06 * w, 0.8 * h), cap = capOf(B, size);
    dblock([NAME], -size * 0.02, h / 2 + cap / 2, size);
    [`${NAME} ${B.c.v}`, B.slogan, 'idansegev.com'].forEach((s, k) => lab(s, (3 + k * 47) * u, h - 2.4 * u, K.ink, 0.85 * u, k === 0 ? 'left' : k === 2 ? 'right' : 'center', 0.1));
  }
  g.restore();
  return meta;
}

// ---------- the poster ----------
export function mount(stage) {
  const c = stage.canvas.getContext('2d');
  const dark = stage.theme.name === 'dark';          // the shell's black and white sequence: the desk the slides sit on follows it
  const offs = [], timers = [], links = [];
  let alive = true;
  const later = (fn, ms) => { const id = setTimeout(() => { if (alive) fn(); }, ms); timers.push(id); return id; };
  const loaded = new Map();
  function ensureFont(name, spec) {
    if (!loaded.has(name)) {
      const l = document.createElement('link'); l.rel = 'stylesheet';
      l.href = `https://fonts.googleapis.com/css2?family=${CSS[name]}&display=block`;
      const css = new Promise((r) => { l.onload = r; l.onerror = r; setTimeout(r, 2500); });
      document.head.appendChild(l); links.push(l);
      loaded.set(name, css.then(() => Promise.race([document.fonts.load(spec, 'IdanSegvHAgx'), new Promise((r) => setTimeout(r, 2500))])).catch(() => {}));
    }
    return loaded.get(name);
  }
  const fontsFor = (B) => Promise.all([ensureFont(B.t[0], `${B.t[2]} ${B.t[1]} 100px "${B.t[0]}"`), ensureFont(B.t[6], `400 16px "${B.t[6]}"`)]);

  // ---------- settings ----------
  const DEF = { layout: 1 };                         // Idan's pick (24 Oct 2026): the whole book on one screen
  const P = { ...DEF };
  try { const s = JSON.parse(localStorage.getItem('tune:brandbook') || 'null'); if (s && typeof s.layout === 'number') P.layout = s.layout; } catch (e) { /* defaults */ }

  // ---------- layout: where each slide sits on the stage ----------
  let rects = [], sy = 0, maxSy = 0, cur = 0, slideX = 0;   // scroll offset (wall), current slide and its sliding offset (one at a time)
  function layout() {
    const W = stage.W, H = stage.H, m = Math.min(16, W * 0.04), gap = W < 760 ? 10 : 14, L = Math.round(P.layout);
    rects = [];
    if (L === 0) {
      const cols = W < 760 ? 1 : 2, ww = Math.min(W - 2 * m, 1600), x0 = (W - ww) / 2, cw = (ww - (cols - 1) * gap) / cols;
      let y = m, col = 0;
      for (let i = 0; i < 12; i++) {
        if (FULL.has(i) || cols === 1) { if (col) { y += cw * 9 / 16 + gap; col = 0; } rects.push({ x: x0, y, w: ww, h: ww * 9 / 16 }); y += ww * 9 / 16 + gap; continue; }
        rects.push({ x: x0 + col * (cw + gap), y, w: cw, h: cw * 9 / 16 });
        if (++col === cols) { col = 0; y += cw * 9 / 16 + gap; }
      }
      maxSy = Math.max(0, y - gap + m - H); sy = clamp(sy, 0, maxSy);
    } else if (L === 1) {
      let best = null;                                                     // the cover takes 2 x 2 cells, everything else one; pick the column count with the biggest cells
      for (let cols = 2; cols <= 6; cols++) {
        const rows = 2 + Math.ceil(Math.max(0, 11 - 2 * (cols - 2)) / cols);
        const cw = Math.min((W - 2 * m - (cols - 1) * gap) / cols, ((H - 2 * m - (rows - 1) * gap) / rows) * 16 / 9);
        if (!best || cw > best.cw) best = { cols, rows, cw };
      }
      if (W < H) { const cols = 2; best = { cols, rows: 2 + Math.ceil(11 / cols), cw: (W - 2 * m - gap) / cols }; }   // a phone: fill the width, and the book scrolls if it runs taller
      const { cols, rows, cw } = best, ch = cw * 9 / 16, tw = cols * cw + (cols - 1) * gap, th = rows * ch + (rows - 1) * gap, x0 = (W - tw) / 2, y0 = Math.max(m, (H - th) / 2);
      const taken = new Set(['0,0', '1,0', '0,1', '1,1']), at = (cx, cy, s) => ({ x: x0 + cx * (cw + gap), y: y0 + cy * (ch + gap), w: s * cw + (s - 1) * gap, h: s * ch + (s - 1) * gap });
      rects.push(at(0, 0, 2));
      for (let cy = 0; cy < rows && rects.length < 12; cy++) for (let cx = 0; cx < cols && rects.length < 12; cx++) { if (!taken.has(`${cx},${cy}`)) rects.push(at(cx, cy, 1)); }
      maxSy = W < H ? Math.max(0, y0 + th + Math.max(m, 72) - H) : 0; sy = clamp(sy, 0, maxSy);   // a phone scrolls, with room at the end to clear the footer
    } else {
      const sw = Math.min(W - 2 * m, (H - 2 * m) * 16 / 9), sh = sw * 9 / 16;
      for (let i = 0; i < 12; i++) rects.push({ x: (W - sw) / 2 + (i - cur) * (W) + slideX, y: (H - sh) / 2, w: sw, h: sh });
      sy = 0; maxSy = 0;
    }
  }
  const placed = (i) => { const r = rects[i]; return { x: r.x, y: r.y - sy, w: r.w, h: r.h }; };
  const visible = (i) => { const r = placed(i); return r.y + r.h > 0 && r.y < stage.H && r.x + r.w > 0 && r.x < stage.W; };

  // ---------- slide caches ----------
  let B = null, N = null, job = 0;
  const dpr = () => Math.min(2, stage.dpr || 1);
  const A = [], NX = [];                       // per slide: { cv, meta, w, h, dirty }
  function cacheFor(list, i, br, M) {
    const r = placed(i), k = dpr();
    let s = list[i];
    if (!s) s = list[i] = { cv: document.createElement('canvas'), meta: null, w: 0, h: 0, dirty: true };
    const w = Math.max(1, Math.round(r.w)), h = Math.max(1, Math.round(r.h));   // a stage can report a zero or negative size mid-resize; never paint with it
    if (s.w !== w || s.h !== h) { s.w = w; s.h = h; s.cv.width = Math.max(1, Math.round(w * k)); s.cv.height = Math.max(1, Math.round(h * k)); s.dirty = true; }
    if (s.dirty || M) {
      const g = s.cv.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0);
      s.meta = paintSlide(g, i, br, s.w, s.h, M, list === A ? drags : null); s.dirty = !!M;
    }
    return s;
  }
  const dirtyAll = (list) => list.forEach((s) => { if (s) s.dirty = true; });

  // ---------- the next brand, prepared offscreen a slide at a time ----------
  let seedN = stage.seed >>> 0;
  const rnd = () => { seedN = (seedN + 0x6d2b79f5) >>> 0; let t = seedN; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  async function prepareNext() {
    const my = job, nb = makeBrand(rnd, B);
    await fontsFor(nb); if (!alive || my !== job) return;
    NX.length = 0;
    for (let i = 0; i < 12; i++) { await new Promise((r) => later(r, 16)); if (!alive || my !== job) return; cacheFor(NX, i, nb); }
    N = nb;
    if (!stage.interacted && !stage.reduced && !demoDone) later(() => { if (!stage.interacted && N && !demoDone) { demo = 1; ox = stage.W * 0.7; oy = stage.H * 0.3; } }, 2000);
  }
  async function show(nb) {
    job++; N = null; morphT = 0;
    await fontsFor(nb); if (!alive) return;
    B = nb; drags = {}; A.length = 0; dirty = true;
    prepareNext();
  }

  // ---------- morph state: t runs 0..1 while held; everything is a function of t ----------
  let morphT = 0, dir = 0, speed = 2200, ox = 0, oy = 0, demo = 0, demoDone = false, dirty = true;
  const pOf = (i) => { const r = placed(i), diag = Math.hypot(stage.W, stage.H * 2); return clamp((morphT - Math.min(1, Math.hypot(r.x + r.w / 2 - ox, r.y + r.h / 2 - oy) / diag) * 0.35) / 0.65); };
  const pattern = document.createElement('canvas'), tmp = document.createElement('canvas');
  function revealThrough(nb, s, r, pr) {               // the next brand shows through its own screen: dots that grow, or lines that thicken
    const k = dpr(), cell = Math.max(6, r.w / 58) * k;
    tmp.width = s.cv.width; tmp.height = s.cv.height;
    const t = tmp.getContext('2d'); t.globalCompositeOperation = 'source-over'; t.drawImage(s.cv, 0, 0);
    pattern.width = pattern.height = Math.max(2, Math.round(cell));
    const pg = pattern.getContext('2d'); pg.clearRect(0, 0, pattern.width, pattern.height); pg.fillStyle = '#000';
    if (nb.render === 'lines' || nb.render === 'contour') pg.fillRect(0, 0, pattern.width, pr * pattern.height);
    else { pg.beginPath(); pg.arc(pattern.width / 2, pattern.height / 2, pr * pattern.width * 0.75, 0, 6.2832); pg.fill(); }
    t.globalCompositeOperation = 'destination-in'; t.fillStyle = t.createPattern(pattern, 'repeat'); t.fillRect(0, 0, tmp.width, tmp.height);
    c.drawImage(tmp, r.x, r.y, r.w, r.h);
  }
  function commit() {
    for (let i = 0; i < 12; i++) A[i] = NX[i];
    NX.length = 0; B = N; N = null; job++; morphT = 0; dir = 0; drags = {}; dirty = true;
    prepareNext();
  }

  // ---------- misuse drags ----------
  let drags = {}, tileDrag = null;
  function tileAt(q) {
    if (!B) return null;
    const r = placed(4), s = A[4]; if (!s || !s.meta || q.x < r.x || q.y < r.y || q.x > r.x + r.w || q.y > r.y + r.h) return null;
    const lx = (q.x - r.x) * s.w / r.w, ly = (q.y - r.y) * s.h / r.h;
    return s.meta.tiles.find((t) => lx >= t.x && ly >= t.y && lx <= t.x + t.w && ly <= t.y + t.h) || null;
  }
  const springs = new Set();

  // ---------- gestures ----------
  const press = pressTracker();
  let down = null, panning = false, swipe = 0, vy = 0, holding = false;
  offs.push(stage.on('down', (q, e) => {
    if (!press.down(q, e.pointerId)) return;
    if (demo) { demo = 0; dir = -1; speed = 500; }                          // the self-demo stops at the first touch and rewinds
    demoDone = true;
    const t = tileAt(q);
    down = { x: q.x, y: q.y, sy, tile: t };
    if (t) {
      const st = drags[t.kind] || { x: DONT[t.kind].rest[0], y: DONT[t.kind].rest[1], vx: 0, vy: 0, ok: false };
      drags[t.kind] = st; st.ok = false; springs.delete(t.kind);
      tileDrag = { k: t.kind, st, x0: st.x, y0: st.y, w: t.w * placed(4).w / A[4].w };
      A[4].dirty = true; dirty = true;
    }
  }));
  offs.push(stage.on('move', (q, e) => {
    press.move(q, e.pointerId);
    if (!down) return;
    if (tileDrag) { tileDrag.st.x = tileDrag.x0 + (q.x - down.x) / tileDrag.w; tileDrag.st.y = tileDrag.y0 + (q.y - down.y) / tileDrag.w; A[4].dirty = true; dirty = true; return; }
    if (holding) return;
    if (press.moved >= 8) {
      panning = true;
      if (Math.round(P.layout) !== 2 && maxSy > 0) { const ny = clamp(down.sy - (q.y - down.y), 0, maxSy); vy = ny - sy; sy = ny; dirty = true; }
      else if (Math.round(P.layout) === 2) { slideX = q.x - down.x; layout(); dirty = true; }
    }
  }));
  offs.push(stage.on('up', (q, e) => {
    const r = press.up(q, e.pointerId); if (!r) return;
    const onTile = !!(down && down.tile);
    if (tileDrag) { springs.add(tileDrag.k); tileDrag = null; }
    if (r.tap && !onTile) tapped(q);
    if (holding) { holding = false; dir = morphT >= 0.5 ? 1 : -1; speed = morphT >= 0.5 ? 700 : 600; }
    if (panning && Math.round(P.layout) === 2) { if (Math.abs(slideX) > Math.min(80, stage.W * 0.12)) step(slideX < 0 ? 1 : -1); slideX = 0; layout(); dirty = true; }
    panning = false; down = null;
  }));
  // a tap: the brand turns into the next one, played through. A beat later, so two or three quick taps (reveal) never start it
  let lastTap = 0, tapT = 0;
  function tapped(q) {
    const now = performance.now(), quick = now - lastTap < REFORM_DELAY_MS; lastTap = now;
    clearTimeout(tapT);
    if (quick) return;
    tapT = later(() => { if (stage.revealed || !N || dir > 0 || holding) return; ox = q.x; oy = q.y; dir = 1; speed = stage.reduced ? 900 : 1700; demo = 0; demoDone = true; dirty = true; }, REFORM_DELAY_MS);
  }
  function step(d) { cur = clamp(cur + d, 0, 11); slideX = 0; layout(); dirty = true; }
  let wheelAcc = 0, wheelT = 0;
  const onWheel = (e) => {
    const L = Math.round(P.layout);
    if (L !== 2 && maxSy > 0) { sy = clamp(sy + e.deltaY, 0, maxSy); dirty = true; e.preventDefault(); }
    else if (L === 2) { e.preventDefault(); const now = performance.now(); if (now - wheelT < 350) return; wheelAcc += e.deltaY + e.deltaX; if (Math.abs(wheelAcc) > 40) { step(wheelAcc > 0 ? 1 : -1); wheelAcc = 0; wheelT = now; } }
  };
  stage.root.addEventListener('wheel', onWheel, { passive: false });
  offs.push(() => stage.root.removeEventListener('wheel', onWheel));
  const onKey = (e) => { if (Math.round(P.layout) !== 2) return; if (e.key === 'ArrowDown' || e.key === 'PageDown') step(1); if (e.key === 'ArrowUp' || e.key === 'PageUp') step(-1); };
  addEventListener('keydown', onKey); offs.push(() => removeEventListener('keydown', onKey));

  // ---------- reveal: the construction behind every visible slide ----------
  const rv = createReveal(stage, (cx, W, H, k) => {
    const col = (a) => ink(stage, a);
    for (let i = 0; i < 12; i++) {
      const s = A[i]; if (!s || !s.meta || !visible(i)) continue;
      const r = placed(i), z = r.w / s.w, X = (x) => r.x + x * z, Y = (y) => r.y + y * z;
      cx.save(); cx.beginPath(); cx.rect(r.x, r.y, r.w, r.h); cx.clip();
      const u = s.w / 100, m = 4 * u, gp = 1.2 * u, cw = (s.w - 2 * m - 11 * gp) / 12;
      cx.lineWidth = 1;
      cx.strokeStyle = col(0.18 * k);
      for (let j = 0; j < 12; j++) { const a = m + j * (cw + gp); cx.beginPath(); cx.moveTo(X(a), r.y); cx.lineTo(X(a), r.y + r.h); cx.moveTo(X(a + cw), r.y); cx.lineTo(X(a + cw), r.y + r.h); cx.stroke(); }
      cx.strokeStyle = col(0.4 * k); cx.strokeRect(X(m), Y(m), (s.w - 2 * m) * z, (s.h - 2 * m) * z);
      if (r.w > 260) label(cx, `12 col · gutter ${(gp * z).toFixed(0)} · margin ${(m * z).toFixed(0)}`, X(m) + 3, Y(m) - 4, col, k, 'left', 9);
      for (const t of s.meta.texts) {
        if (t.size < 3.5 * u) { cx.strokeStyle = col(0.45 * k); cx.strokeRect(X(t.x), Y(t.bases[0] - t.cap), t.w * z, (t.bases[t.bases.length - 1] - t.bases[0] + t.cap) * z); continue; }
        t.bases.forEach((b, j) => {
          cx.strokeStyle = col(0.8 * k); cx.beginPath(); cx.moveTo(r.x, Y(b)); cx.lineTo(r.x + r.w, Y(b)); cx.moveTo(r.x, Y(b - t.cap)); cx.lineTo(r.x + r.w, Y(b - t.cap)); cx.stroke();
          if (t.xh) { cx.setLineDash([3, 3]); cx.strokeStyle = col(0.5 * k); cx.beginPath(); cx.moveTo(r.x, Y(b - t.xh)); cx.lineTo(r.x + r.w, Y(b - t.xh)); cx.stroke(); cx.setLineDash([]); }
          if (j === 0 && r.w > 260) { const lx = Math.min(X(t.x + t.w) + 6, r.x + r.w - 70); label(cx, 'baseline', lx, Y(b) - 4, col, k, 'left', 9); label(cx, `cap ${(t.cap / t.size).toFixed(2)} em`, lx, Y(b - t.cap) - 4, col, k, 'left', 9); }
        });
      }
      for (const mk of s.meta.marks) {
        const x = X(mk.x), y = Y(mk.y), sz = mk.s * z, mx = x + sz / 2, my = y + sz / 2;
        cx.strokeStyle = col(0.85 * k); cx.strokeRect(x, y, sz, sz); cx.beginPath(); cx.arc(mx, my, sz / 2, 0, 6.2832); cx.stroke();
        cx.strokeStyle = col(0.45 * k); cx.beginPath(); cx.arc(mx, my, sz / 2 * Math.SQRT1_2, 0, 6.2832); cx.moveTo(x, y); cx.lineTo(x + sz, y + sz); cx.moveTo(x + sz, y); cx.lineTo(x, y + sz);
        cx.moveTo(mx - sz * 0.7, my); cx.lineTo(mx + sz * 0.7, my); cx.moveTo(mx, my - sz * 0.7); cx.lineTo(mx, my + sz * 0.7); cx.stroke();
        cx.setLineDash([3, 3]); cx.strokeStyle = col(0.55 * k); cx.strokeRect(x - sz / 2, y - sz / 2, sz * 2, sz * 2); cx.setLineDash([]);
        if (sz > 30) label(cx, 'x = ½ mark', x - sz / 2, y - sz / 2 - 4, col, k, 'left', 9);
      }
      for (const d of s.meta.devs) {
        const x = X(d.x), y = Y(d.y), w2 = d.w * z, h2 = d.h * z, asp = d.w / d.h, k1 = Math.min(asp, 1), cxp = x + w2 * (d.opt.cx ?? 0.5), cyp = y + h2 * (d.opt.cy ?? 0.5), R = d.opt.r ?? 0.42;
        cx.strokeStyle = col(0.85 * k); cx.beginPath(); cx.moveTo(cxp - 10, cyp); cx.lineTo(cxp + 10, cyp); cx.moveTo(cxp, cyp - 10); cx.lineTo(cxp, cyp + 10); cx.stroke();
        if (d.kind === 'sphere') {
          const rad = 2 * R * k1 * h2, L = B.light, ll = Math.hypot(L[0], L[1]), ex = cxp + L[0] / ll * rad * 0.9, ey = cyp + L[1] / ll * rad * 0.9;
          cx.beginPath(); cx.arc(cxp, cyp, rad, 0, 6.2832); cx.moveTo(cxp, cyp); cx.lineTo(ex, ey); cx.stroke(); cx.beginPath(); cx.arc(ex, ey, 4, 0, 6.2832); cx.stroke();
          if (w2 > 120) label(cx, 'light', ex + 8, ey, col, k, 'left', 9);
        } else if (d.kind === 'burst') {
          const ro = R * 1.05 * h2 * k1, n = 9 + 2 * (B.vol % 5);
          cx.setLineDash([3, 3]); cx.beginPath(); cx.arc(cxp, cyp, ro, 0, 6.2832); cx.moveTo(cxp + ro * 0.74, cyp); cx.arc(cxp, cyp, ro * 0.74, 0, 6.2832); cx.stroke(); cx.setLineDash([]);
          cx.strokeStyle = col(0.45 * k); cx.beginPath(); for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2; cx.moveTo(cxp, cyp); cx.lineTo(cxp + Math.cos(a) * ro, cyp + Math.sin(a) * ro); } cx.stroke();
          if (w2 > 120) label(cx, `${n} rays`, cxp + ro * 0.75, cyp - ro * 0.75, col, k, 'left', 9);
        } else if (d.kind === 'rings') {
          const ro = h2 * k1 / 1.3; cx.strokeStyle = col(0.45 * k); cx.beginPath(); for (let j = 1; j <= 8; j++) { cx.moveTo(cxp + ro * j / 8, cyp); cx.arc(cxp, cyp, ro * j / 8, 0, 6.2832); } cx.stroke();
        } else if (d.kind === 'letter') {
          const zz = (d.opt.zoom || 1) * k1 * h2; cx.setLineDash([3, 3]); cx.strokeRect(cxp - zz / 2, cyp - zz / 2, zz, zz); cx.setLineDash([]); cx.strokeRect(cxp - zz * 0.43, cyp - zz * 0.43, zz * 0.86, zz * 0.86);
          if (w2 > 120) label(cx, `${B.letter} · 86% of the square`, cxp - zz * 0.43, cyp - zz * 0.43 - 4, col, k, 'left', 9);
        } else if (d.kind === 'waves') {
          const kk = 6 + B.cell % 5; cx.beginPath(); for (let px = 0; px <= w2; px += 6) { const uu = px / w2, yy = y + h2 * (0.5 - 0.35 * Math.sin(kk * uu * asp)); if (px) cx.lineTo(x + px, yy); else cx.moveTo(x + px, yy); } cx.stroke();
        } else { cx.strokeStyle = col(0.45 * k); cx.strokeRect(x, y, w2, h2); }
      }
      cx.restore();
    }
  }, { dim: 0.6 });

  // ---------- frame ----------
  let lastNow = performance.now();
  offs.push(stage.on('resize', () => { layout(); dirtyAll(A); dirtyAll(NX); dirty = true; }));
  offs.push(stage.frame(() => {
    const now = performance.now(), dt = Math.min(50, now - lastNow); lastNow = now;
    if (!B) { c.setTransform(1, 0, 0, 1, 0, 0); const f = stage.colors.bg; c.fillStyle = `rgb(${f[0] * 255 | 0},${f[1] * 255 | 0},${f[2] * 255 | 0})`; c.fillRect(0, 0, stage.pw, stage.ph); rv.draw(now); return; }
    // hold: start the morph once the press is still for HOLD_MS (not on a tile, not a pan)
    if (press.holding && down && !down.tile && !panning && !holding && N) { holding = true; ox = down.x; oy = down.y; dir = 1; speed = stage.reduced ? 900 : 2200; demo = 0; }
    if (demo === 1) { morphT += dt / 1500; if (morphT >= 0.3) demo = 2; dirty = true; }
    else if (demo === 2) { morphT -= dt / 900; if (morphT <= 0) { morphT = 0; demo = 0; demoDone = true; dirtyAll(A); } dirty = true; }
    else if (dir) { morphT = clamp(morphT + dir * dt / speed); dirty = true; if (morphT <= 0 && dir < 0) { dir = 0; dirtyAll(A); } }
    if (morphT >= 1 && N) commit();
    // inertia after a pan of the wall
    if (!down && Math.abs(vy) > 0.3 && maxSy > 0) { sy = clamp(sy + vy, 0, maxSy); vy *= 0.92; dirty = true; } else if (!down) vy = 0;
    // misuse springs
    for (const kd of springs) {
      const st = drags[kd], dts = Math.min(0.032, dt / 1000);
      st.vx += (-260 * st.x - 15 * st.vx) * dts; st.vy += (-260 * st.y - 15 * st.vy) * dts; st.x += st.vx * dts; st.y += st.vy * dts;
      if (Math.hypot(st.x, st.y) < 0.002 && Math.hypot(st.vx, st.vy) < 0.02) { st.x = st.y = st.vx = st.vy = 0; st.ok = true; st.praise = PRAISE[(Math.random() * PRAISE.length) | 0]; springs.delete(kd); }
      if (A[4]) A[4].dirty = true; dirty = true;
    }
    if (!dirty && !rv.k && !stage.revealed) { rv.draw(now); return; }
    dirty = false;
    const k = stage.pw / stage.W;
    c.setTransform(k, 0, 0, k, 0, 0);
    c.fillStyle = dark ? '#121212' : '#ececec'; c.fillRect(0, 0, stage.W, stage.H);
    for (let i = 0; i < 12; i++) {
      if (!visible(i)) continue;
      const r = placed(i), p = morphT > 0 && N ? pOf(i) : 0;
      const s = cacheFor(A, i, B, p > 0 ? { p, N } : null);
      c.drawImage(s.cv, r.x, r.y, r.w, r.h);
      if (p > 0.42 && NX[i]) revealThrough(N, cacheFor(NX, i, N), r, clamp((p - 0.42) / 0.58));
    }
    rv.draw(now);
  }));

  // ---------- settings panel ----------
  const tune = {
    title: 'Brandbook', values: P, defaults: DEF,
    groups: [{ name: 'Wall', items: [{ key: 'layout', label: 'Layout: 0 scroll the wall · 1 whole book · 2 one slide', min: 0, max: 2, step: 1 }] }],
    actions: {
      'New brand': () => show(makeBrand(rnd, B)),
      'Morph now': () => { if (N) { ox = stage.W / 2; oy = stage.H / 2; dir = 1; speed = 2200; } },
    },
    set(key, v) { P[key] = v; try { localStorage.setItem('tune:brandbook', JSON.stringify(P)); } catch (e) { /* private mode */ } cur = 0; slideX = 0; layout(); dirtyAll(A); dirtyAll(NX); dirty = true; },
    reset() { Object.assign(P, DEF); tune.set('layout', DEF.layout); },
  };

  layout();
  show(makeBrand(rnd));

  return {
    tune,
    debug: {
      setT: (v) => { if (!N) return 'no next'; ox = stage.W / 2; oy = stage.H / 2; morphT = clamp(v); dirty = true; if (morphT <= 0) dirtyAll(A); return morphT; },
      state: () => ({ brand: B && `${B.c.v} · ${B.t[0]} · ${B.field}/${B.render}`, next: N && `${N.c.v} · ${N.t[0]}`, t: morphT, layout: P.layout, sy, maxSy }),
      tiles: () => (A[4] && A[4].meta ? A[4].meta.tiles.map((t) => { const r = placed(4), z = r.w / A[4].w; return { kind: t.kind, x: r.x + (t.x + t.w / 2) * z, y: r.y + (t.y + t.h / 2) * z, ok: !!(drags[t.kind] && drags[t.kind].ok) }; }) : []),
      scrollTo: (i) => { sy = clamp(rects[i].y - 16, 0, maxSy); dirty = true; },
    },
    destroy() {
      alive = false; job++;
      timers.forEach(clearTimeout); offs.forEach((f) => f()); rv.destroy();
      links.forEach((l) => l.remove());
    },
  };
}
