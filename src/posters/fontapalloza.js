// Fontapalloza: "Idan Segev", every letter its own cell, every cell a different typeface.
//
// Hover a letter and it swaps to a new font and stays there. Press anywhere and every letter thrashes through the
// whole collection, a new face on nearly every frame, until you let go (it keeps the last one it landed on).
// Each glyph is scaled to fill its cell, so the letters stay a solid wall of type whatever the font does to the width.
// Fonts are Google Fonts, requested with `text=` so each family downloads only the nine glyphs this poster needs.

import { pressTracker } from '../gestures.js';
import { createReveal, ink, corners } from './reveal.js';

const WORDS = ['Idan', 'Segev'];
const CHARS = 'IdanSegv';

const FONTS = [
  'Abril Fatface', 'Alfa Slab One', 'Anton', 'Archivo Black', 'Bangers', 'Bebas Neue', 'Black Ops One', 'Bungee', 'Bungee Shade',
  'Bungee Inline', 'Caesar Dressing', 'Chango', 'Cinzel Decorative', 'Creepster', 'Damion', 'DM Serif Display', 'Fascinate',
  'Fascinate Inline', 'Faster One', 'Fredericka the Great', 'Gloock', 'Monoton', 'Lobster', 'Limelight', 'Megrim', 'Nosifer',
  'Orbitron', 'Pacifico', 'Permanent Marker', 'Playfair Display', 'Press Start 2P', 'Righteous', 'Rubik Mono One', 'Shrikhand',
  'Special Elite', 'Staatliches', 'Unica One', 'UnifrakturMaguntia', 'VT323', 'Wallpoet', 'Yeseva One', 'Zilla Slab Highlight',
  'Bowlby One', 'Rye', 'Sancreek', 'Ultra', 'Titan One', 'Squada One', 'Rubik Glitch', 'Rubik Wet Paint', 'Eater', 'Butcherman',
  'Codystar', 'Monofett', 'Londrina Outline', 'Londrina Solid', 'Kumar One Outline', 'Rubik Dirt', 'Rubik Burned', 'Bigelow Rules',
  'Gravitas One', 'Emblema One', 'Train One', 'Nabla', 'Honk', 'Tilt Warp', 'Climate Crisis', 'Workbench', 'Foldit', 'Bagel Fat One',
  'Rubik Microbe', 'Rubik Maze', 'Sixtyfour', 'Jacquard 24', 'Jersey 10', 'Pixelify Sans', 'Silkscreen', 'Smokum', 'Ewert',
  'Vast Shadow', 'Metal Mania', 'New Rocker', 'Diplomata', 'Elsie Swash Caps', 'Oi', 'Modak', 'Kablammo', 'Rubik Scribble', 'Chicle',
  'Lacquer', 'Sedgwick Ave Display', 'Syne', 'Bodoni Moda', 'Fraunces', 'Unbounded',
];
const START = 'Archivo Black';
const FIT = { I: 0.68 };                          // the I is a bar that fills its cell's height, so it reads far bigger than the rest; pull it in

const SIZE = 200;                                  // measuring size; glyphs are then scaled into their cell

export function mount(stage) {
  const c = stage.canvas.getContext('2d');
  const reduced = stage.reduced;
  const dark = stage.theme.name === 'dark';          // colours come from stage.colors (the shell's black and white sequence); the Reveal ink follows the same theme

  // --- fonts: one stylesheet per batch, each family subset to the letters we use ---
  const ready = [];                                // families that have loaded, so the pool grows as the network answers
  let alive = true;
  const loadFace = (f) => document.fonts.load(`${SIZE}px "${f}"`, CHARS).then((r) => { if (alive && r.length && !ready.includes(f)) ready.push(f); }).catch(() => {});
  const links = [];
  for (let i = 0; i < FONTS.length; i += 30) {
    const fam = FONTS.slice(i, i + 30).map((f) => 'family=' + f.replace(/ /g, '+')).join('&');
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = `https://fonts.googleapis.com/css2?${fam}&text=${CHARS}&display=block`;
    const fams = FONTS.slice(i, i + 30);
    l.onload = () => fams.forEach(loadFace);          // the faces exist only once the stylesheet is parsed
    document.head.appendChild(l); links.push(l);
  }
  const metric = new Map();                        // "font|char" -> glyph box at SIZE; only ever filled for loaded fonts

  // --- cells ---
  const cells = [];
  WORDS.forEach((w, row) => [...w].forEach((ch, col) => cells.push({ ch, row, col, n: w.length, font: START, next: 0, x: 0, y: 0, w: 0, h: 0 })));
  function box(font, ch) {
    const k = font + '|' + ch;
    let m = metric.get(k);
    if (!m) {
      c.font = `${SIZE}px "${font}"`;
      const t = c.measureText(ch);
      m = { l: t.actualBoundingBoxLeft, r: t.actualBoundingBoxRight, a: t.actualBoundingBoxAscent, d: t.actualBoundingBoxDescent };
      m.w = Math.max(1, m.l + m.r); m.h = Math.max(1, m.a + m.d);
      metric.set(k, m);
    }
    return m;
  }

  // Each row is packed by the glyphs' real widths, nearly touching, then scaled up to fill the row (or down to fit it).
  const TIGHT = 0.004;                              // gap between letters, as a share of the short side
  function layout() {
    const W = stage.W, H = stage.H, pad = Math.min(W, H) * 0.04, gap = Math.min(W, H) * TIGHT, rowGap = Math.min(W, H) * 0.02;
    const rowH = (H - pad * 2 - rowGap) / 2, avail = W - pad * 2;
    const rows = [];
    for (let row = 0; row < WORDS.length; row++) {
      const rc = cells.filter((q) => q.row === row), cw = avail / rc.length;
      for (const q of rc) {
        const m = ready.includes(q.font) ? box(q.font, q.ch) : { w: cw, h: rowH };
        q.s = Math.min(cw / m.w, rowH / m.h) * (FIT[q.ch] ?? 1);
      }
      const total = () => rc.reduce((a, q) => a + (box0(q).w * q.s), 0) + gap * (rc.length - 1);
      const g = Math.min(avail / total(), rowH / Math.max(...rc.map((q) => box0(q).h * q.s)));
      let x = pad + (avail - total() * g) / 2;
      for (const q of rc) { q.s *= g; q.w = box0(q).w * q.s; q.x = x; x += q.w + gap; }
      rows.push({ rc, h: Math.max(...rc.map((q) => box0(q).h * q.s)) });
    }
    // rows sit close together under their own glyph heights (a phone is tall and the type is wide), the pair centred on the page
    const used = rows.reduce((a, r) => a + r.h, 0) + rowGap * (rows.length - 1);
    let y = (H - used) / 2;
    for (const r of rows) { for (const q of r.rc) { q.y = y; q.h = r.h; } y += r.h + rowGap; }
  }
  const box0 = (q) => (ready.includes(q.font) ? box(q.font, q.ch) : { w: 1, h: 1 });
  layout();
  const offResize = stage.on('resize', () => { layout(); });

  const pick = (not) => {
    if (ready.length < 2) return not;
    let f; do f = ready[(stage.rand() * ready.length) | 0]; while (f === not);
    return f;
  };
  const swap = (q) => { q.font = pick(q.font); };

  // --- input ---
  const press = pressTracker();
  let thrashing = false, hover = -1;
  const cellAt = (p) => cells.findIndex((q) => p.x >= q.x && p.x <= q.x + q.w && p.y >= q.y && p.y <= q.y + q.h);
  const offDown = stage.on('down', (p, e) => { press.down(p, e.pointerId); thrashing = true; cells.forEach((q) => { q.next = performance.now() + stage.rand() * 60; }); hover = cellAt(p); });
  const offMove = stage.on('move', (p, e) => {
    press.move(p, e.pointerId);
    if (p.type !== 'mouse' && !p.down) return;
    const i = cellAt(p);
    if (i !== hover) { hover = i; if (i >= 0 && !thrashing) swap(cells[i]); }      // hover: swap once on entering, and hold
  });
  const offUp = stage.on('up', (p, e) => { press.up(p, e.pointerId); thrashing = false; });

  // --- draw ---
  const rgb = (a = 1) => { const f = stage.colors.fg; return `rgba(${f[0] * 255 | 0},${f[1] * 255 | 0},${f[2] * 255 | 0},${a})`; };
  const bg = () => { const f = stage.colors.bg; return `rgb(${f[0] * 255 | 0},${f[1] * 255 | 0},${f[2] * 255 | 0})`; };

  function draw() {
    const k = stage.pw / stage.W, ky = stage.ph / stage.H;
    c.setTransform(k, 0, 0, ky, 0, 0);
    c.fillStyle = bg(); c.fillRect(0, 0, stage.W, stage.H);
    c.fillStyle = rgb(); c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    if (!ready.includes(START) && ready.length) cells.forEach((q) => { q.font = ready[0]; });
    layout();
    for (const q of cells) {
      if (!ready.includes(q.font)) continue;
      const m = box(q.font, q.ch);
      const s = q.s;
      c.font = `${SIZE}px "${q.font}"`;
      c.save();
      c.translate(q.x + q.w / 2, q.y + q.h / 2);
      c.scale(s, s);
      c.fillText(q.ch, -(m.r - m.l) / 2, (m.a - m.d) / 2);
      c.restore();
    }
  }

  const rv = createReveal(stage, (cx, W, H, kk) => {
    const col = (a) => ink(stage, a);
    corners(cx, W, H, 18, col, kk);
    cx.lineWidth = 2; cx.textBaseline = 'top';
    cx.font = '500 14px "IBM Plex Mono", monospace';
    for (const q of cells) {
      cx.fillStyle = col((dark ? 0.12 : 0.1) * kk); cx.fillRect(q.x, q.y, q.w, q.h);                    // each cell, tinted, with the face it holds
      cx.strokeStyle = col(0.6 * kk); cx.strokeRect(q.x, q.y, q.w, q.h);
      cx.fillStyle = col(0.9 * kk); cx.fillText(q.font, q.x + 8, q.y + 8);
    }
    cx.textAlign = 'right'; cx.fillStyle = col(0.9 * kk);
    cx.fillText(`${ready.length} of ${FONTS.length} faces loaded`, W - 22, H - 24);
    cx.textAlign = 'left';
  });

  const offFrame = stage.frame(() => {
    const now = performance.now();
    if (thrashing && ready.length > 1) {
      for (const q of cells) {                                                      // each letter on its own clock: a random beat, now and then a longer pause
        if (now < q.next) continue;
        q.font = pick(q.font);
        q.next = now + (reduced ? 150 + stage.rand() * 300 : stage.rand() < 0.15 ? 40 + stage.rand() * 110 : stage.rand() * 34);
      }
    }
    draw();
    rv.draw(now);
  });

  return {
    destroy() {
      alive = false;
      offFrame(); offDown(); offMove(); offUp(); offResize(); rv.destroy();
      links.forEach((l) => l.remove());
    },
  };
}
