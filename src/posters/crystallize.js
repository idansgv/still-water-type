// Crystallize: the page is a Voronoi diagram, and the name is never drawn. It starts as an even, coarse crackle; every frame the
// cells relax toward the weighted centre of what they cover (Lloyd's method) and any cell holding too much of the name splits.
// Inside the letters the cells keep splitting, outside they stay large, so "Idan Segev" condenses out of the pattern.
//
// Under the picture: seeds in one Float64Array that d3-delaunay reads in place; a fixed set of sample points, kept with a
// probability equal to the name's density (dense in the letters, sparse outside) so a Lloyd step costs one find() per sample.
// Ported from the test page docs/posters/prototypes/voronoi.html (direction 1); DEF holds Idan's tuned values (24 Oct 2026).
//
// Gestures (src/gestures.js): drag or hover stirs the cells; tap knocks a coarse hole that crystallizes back; hold melts the
// cells under the finger; double tap on the page starts over (a beat later, so a third tap can still mean reveal).
// Three taps (reveal) switch to dots only: the page inverts and only the seeds are drawn, still alive to every gesture.
// The crystallization on load is the intro; once settled and left alone for REBOOT_MS it melts back to coarse cells and grows again (Idan, 29 Oct 2026).
// Under reduced motion the poster opens already settled and never restarts on its own.

import { Delaunay } from '../vendor/d3-delaunay.es.js';
import { pressTracker, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';
import { createReveal, ink as rvInk } from './reveal.js';
import { linesFor, lettersFor } from '../name.js';

const FAMILY = 'Fraunces', WEIGHT = 900, NAME = 'Idan Segev';
const DEF = { cells: 9000, out: 0.28, speed: 0.35, line: 1.3 };
const DOT = 1;                                     // reveal: the radius of a seed, Idan's dot size from the test page
const REBOOT_MS = 5000;                            // Idan (29 Oct 2026): once the name has condensed and nobody touches it, it starts over after this long
const MELT = 0.03;                                // the share of cells that merge away each frame while it starts over (about 2 s back to coarse)

export async function mount(stage) {
  const c = stage.canvas.getContext('2d');
  const P = { ...DEF };
  const rand = stage.rand;
  const offs = [];
  let alive = true;
  const dark = stage.theme.name === 'dark';

  // ---------- the face: Fraunces from Google Fonts, only the letters of the name ----------
  const link = document.createElement('link'); link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,${WEIGHT}&text=${encodeURIComponent(lettersFor(stage, 'IdanSegv'))}&display=block`;
  document.head.appendChild(link);
  await Promise.race([new Promise((r) => { link.onload = r; link.onerror = r; }), new Promise((r) => setTimeout(r, 2500))]);
  try { await Promise.race([document.fonts.load(`${WEIGHT} 100px "${FAMILY}"`, NAME), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* the fallback face */ }

  // ---------- the name: a mask the cells sample, never drawn ----------
  let W = stage.W, H = stage.H, mask = new Uint8Array(1), mw = 1, mh = 1;
  const mcv = document.createElement('canvas'), mctx = mcv.getContext('2d', { willReadFrequently: true });
  function buildMask() {
    W = stage.W; H = stage.H; mw = Math.ceil(W / 2); mh = Math.ceil(H / 2);
    mcv.width = mw; mcv.height = mh;
    const face = (px) => `${WEIGHT} ${px}px "${FAMILY}", Georgia, serif`;
    mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.clearRect(0, 0, mw, mh);
    mctx.font = face(100);
    const lines = linesFor(stage, ['Idan', 'Segev']), ms = lines.map((l) => mctx.measureText(l));   // a visitor's name: one line per word
    const wmax = Math.max(...ms.map((m) => m.width)) / 100;
    const asc = ms[0].actualBoundingBoxAscent / 100, desc = ms[ms.length - 1].actualBoundingBoxDescent / 100, lh = 0.92, total = asc + lh * (lines.length - 1) + desc;
    const fs = Math.min(W * 0.84 / wmax, H * 0.70 / total);
    const b1 = (H - total * fs) / 2 + asc * fs;
    mctx.scale(0.5, 0.5); mctx.font = face(fs); mctx.textAlign = 'center'; mctx.fillStyle = '#000';
    lines.forEach((l, i) => mctx.fillText(l, W / 2, b1 + i * lh * fs));
    const d = mctx.getImageData(0, 0, mw, mh).data;
    mask = new Uint8Array(mw * mh);
    for (let i = 0; i < mask.length; i++) mask[i] = d[i * 4 + 3];
  }
  const maskAt = (x, y) => { const i = x >> 1, j = y >> 1; return (i < 0 || j < 0 || i >= mw || j >= mh) ? 0 : mask[j * mw + i] / 255; };

  // ---------- the cells ----------
  const areaScale = () => Math.max(0.35, Math.min(2, W * H / (1440 * 900)));
  let pts = new Float64Array(2), n = 0, cap = 0, del = null, acc = new Float64Array(3), smp = null, target = 0, still = 0;
  const rebuild = () => { del = new Delaunay(pts.subarray(0, n * 2)); };
  const add = (x, y) => { if (n >= cap + 64) return; pts[2 * n] = x; pts[2 * n + 1] = y; n++; };
  function remove(test) {
    let j = 0;
    for (let i = 0; i < n; i++) { const x = pts[2 * i], y = pts[2 * i + 1]; if (test(x, y)) continue; pts[2 * j] = x; pts[2 * j + 1] = y; j++; }
    n = j;
  }
  const hash = (i, j) => { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  // Samples kept with a probability equal to the name's density, each counting as 1; in a serpentine so each find() walks from its neighbour.
  function samples() {
    const s = Math.max(1.5, Math.sqrt(W * H / 520000)), xs = [], ys = [];
    for (let y = s / 2, row = 0; y < H; y += s, row++) {
      const r = [];
      for (let x = s / 2, col = 0; x < W; x += s, col++) if (hash(col, row) < P.out + (1 - P.out) * maskAt(x, y)) r.push(x + (hash(row, col) - 0.5) * s);
      if (row & 1) r.reverse();
      for (const x of r) { xs.push(x); ys.push(y); }
    }
    smp = { x: Float32Array.from(xs), y: Float32Array.from(ys) };
    target = smp.x.length / cap;                                   // samples per cell at full growth
  }
  function seedCoarse() {
    n = 0;
    const n0 = Math.round(160 * areaScale());
    for (let i = 0; i < n0; i++) add(rand() * W, rand() * H);
    rebuild(); still = 0;
  }
  function build() {
    buildMask();
    cap = Math.round(P.cells * areaScale());
    pts = new Float64Array((cap + 64) * 2); acc = new Float64Array((cap + 64) * 3);
    samples(); seedCoarse();
    if (stage.reduced) settle();
    dirty = true;
  }
  // One step: each seed moves to the centre of its samples; the heaviest cells split.
  function step(fast, grow = true) {                               // grow: false relaxes the cells without splitting any (while they melt)
    acc.fill(0, 0, n * 3);
    let k = 0;
    for (let s = 0; s < smp.x.length; s++) { const x = smp.x[s], y = smp.y[s]; k = del.find(x, y, k); const o = 3 * k; acc[o] += x; acc[o + 1] += y; acc[o + 2] += 1; }
    let mx = 0;
    for (let i = 0; i < n; i++) {
      const w = acc[3 * i + 2]; if (w <= 0) continue;
      const dx = acc[3 * i] / w - pts[2 * i], dy = acc[3 * i + 1] / w - pts[2 * i + 1];
      pts[2 * i] += dx; pts[2 * i + 1] += dy;
      mx = Math.max(mx, dx * dx + dy * dy);
    }
    const budget = !grow ? 0 : fast ? n : Math.max(6, Math.round(n * 0.05 * Math.min(1, P.speed)));
    const heavy = [];
    for (let i = 0; i < n; i++) if (acc[3 * i + 2] > target * 1.6) heavy.push(i);
    heavy.sort((a, b) => acc[3 * b + 2] - acc[3 * a + 2]);
    let split = 0;
    for (let h = 0; h < heavy.length && h < budget && n < cap; h++) {
      const i = heavy[h], r = Math.sqrt(acc[3 * i + 2] / target) * 0.6 + 0.5, a = rand() * Math.PI * 2;
      add(pts[2 * i] + Math.cos(a) * r, pts[2 * i + 1] + Math.sin(a) * r);
      pts[2 * i] -= Math.cos(a) * r; pts[2 * i + 1] -= Math.sin(a) * r;
      split++;
    }
    rebuild();
    still = (Math.sqrt(mx) < 0.04 && split === 0) ? still + 1 : 0;
  }
  function settle() { for (let i = 0; i < 90 && still <= 40; i++) step(true); }

  // ---------- input ----------
  const press = pressTracker();
  let lastTap = -1, reform = 0, dirty = true, lastInput = performance.now(), restAt = 0, melting = false;
  function stir(x, y, dx, dy) {
    const R = 80, R2 = R * R;
    for (let i = 0; i < n; i++) {
      const ex = pts[2 * i] - x, ey = pts[2 * i + 1] - y, d2 = ex * ex + ey * ey;
      if (d2 > R2) continue;
      const f = (1 - Math.sqrt(d2) / R) ** 2 * 2.7;
      pts[2 * i] += dx * f; pts[2 * i + 1] += dy * f;
    }
    del.update(); still = 0; dirty = true;
  }
  function knock(x, y) {                                           // the refined cells go, a few big ones take their place
    const R = Math.min(W, H) * 0.2;
    remove((px, py) => (px - x) ** 2 + (py - y) ** 2 < R * R);
    for (let i = 0; i < 6; i++) { const a = rand() * Math.PI * 2, r = R * Math.sqrt(rand()); add(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    rebuild(); still = 0; dirty = true;
  }
  function melt(x, y) {
    for (let i = 0; i < n; i++) {
      const dx = pts[2 * i] - x, dy = pts[2 * i + 1] - y;
      if (dx * dx + dy * dy < 3600) { pts[2 * i] += (rand() - 0.5) * 10; pts[2 * i + 1] += (rand() - 0.5) * 10; }
    }
    remove((px, py) => (px - x) ** 2 + (py - y) ** 2 < 400 && rand() < 0.2);
    rebuild(); still = 0; dirty = true;
  }
  offs.push(stage.on('down', (q, e) => { press.down(q, e.pointerId); lastInput = performance.now(); melting = false; }));
  offs.push(stage.on('move', (q, e) => {
    press.move(q, e.pointerId);
    if (q.type === 'mouse' || q.down) lastInput = performance.now();
    if ((q.type === 'mouse' || q.down) && (q.vx || q.vy) && !(q.down && press.active && press.moved < 8)) stir(q.x, q.y, q.vx, q.vy);
  }));
  offs.push(stage.on('up', (q, e) => {
    const r = press.up(q, e.pointerId);
    if (!r || !r.tap) return;
    const now = performance.now();
    clearTimeout(reform);
    if (lastTap >= 0 && now - lastTap < DOUBLE_MS) { lastTap = -1; reform = setTimeout(() => { if (alive && !stage.revealed) { seedCoarse(); dirty = true; } }, REFORM_DELAY_MS); }
    else {
      if (!undo || now - undo.t > 800) undo = { pts: pts.slice(0, n * 2), n, t: now };   // the first tap of what may be three
      lastTap = now; knock(q.x, q.y);
    }
  }));
  // Three taps mean reveal, not three holes: put back the seeds as they were before the first tap.
  let undo = null;
  offs.push(stage.on('reveal', () => {
    clearTimeout(reform); lastTap = -1;
    if (!undo || performance.now() - undo.t > 1200) return;
    pts.set(undo.pts); n = undo.n; undo = null;
    rebuild(); still = 0; dirty = true;
  }));

  // ---------- reveal: dots only. The cell edges go and only the seeds stay, still moving with the cells ----------
  const rv = createReveal(stage, (cx, W_, H_, k) => {
    cx.fillStyle = rvInk(stage, k); cx.beginPath();
    for (let i = 0; i < n; i++) { const x = pts[2 * i], y = pts[2 * i + 1]; cx.moveTo(x + DOT, y); cx.arc(x, y, DOT, 0, Math.PI * 2); }
    cx.fill();
  }, { dim: 0 });

  // ---------- settings ----------
  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  const tune = {
    title: 'Crystallize', values: P, defaults: DEF,
    groups: [{ name: 'Cells', items: [Ctl('cells', 'Cells (at 1440x900)', 2000, 30000, 250), Ctl('out', 'Density outside the letters', 0.005, 0.5, 0.005), Ctl('speed', 'Growth speed', 0.1, 1, 0.05), Ctl('line', 'Line', 0.2, 2.5, 0.05)] }],
    set(key, v) { P[key] = v; if (key === 'cells') build(); else if (key === 'out') { samples(); still = 0; } dirty = true; },
    reset() { Object.assign(P, DEF); build(); },
  };

  // ---------- the frame ----------
  function draw() {
    const fg = stage.colors.fg, bg = stage.colors.bg, rgb = (f) => `rgb(${f[0] * 255 | 0},${f[1] * 255 | 0},${f[2] * 255 | 0})`;
    c.setTransform(stage.pw / W, 0, 0, stage.ph / H, 0, 0);
    c.fillStyle = rgb(bg); c.fillRect(0, 0, W, H);
    const v = del.voronoi([0, 0, W, H]);
    c.beginPath(); v.render(c);
    c.strokeStyle = rgb(fg); c.lineWidth = P.line; c.lineJoin = 'round'; c.stroke();
  }
  build();
  let rt = 0;
  offs.push(stage.on('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (alive && (stage.W !== W || stage.H !== H)) build(); else dirty = true; }, 150); }));
  offs.push(stage.frame(() => {
    if (press.holding) melt(stage.ptr.x, stage.ptr.y);
    if (melting) {                                                  // starting over: cells merge a few at a time back to the coarse crackle, then the name grows again
      const n0 = Math.round(160 * areaScale());
      remove(() => rand() < MELT); if (n <= n0) melting = false;
      rebuild(); step(false, false); still = 0; dirty = true; restAt = 0;
    } else if (still <= 40) { step(false); dirty = true; restAt = 0; }
    else {                                                          // condensed: after REBOOT_MS of rest with no input it crackles back to coarse and grows again
      const now = performance.now();
      if (!restAt) restAt = now;
      if (!stage.reduced && !stage.revealed && !press.active && now - Math.max(restAt, lastInput) > REBOOT_MS) { melting = true; restAt = 0; }
    }
    if (dirty) { draw(); dirty = false; }
    rv.draw(performance.now());
  }));

  return {
    tune,
    debug: { get n() { return n; }, get still() { return still; }, settle, knock, dark },
    destroy() {
      alive = false; clearTimeout(rt); clearTimeout(reform);
      rv.destroy(); offs.forEach((f) => f()); link.remove();
    },
  };
}
