// Marbled: the name floats as ink on water, like Japanese suminagashi. Drag to comb it into feathered marbled patterns;
// tap to drop more ink (it lands as a ring: ink, then clear water into its middle). It never resets by itself, so every
// visit ends as its own pattern. Double tap on empty water, a beat later, starts again.
//
// The ink is vector: the outline of the type is traced once into closed loops of points, and every move is applied to those
// points, so it stays sharp however far it is pulled. A drop pushes all the ink outward keeping its area (p' = c + (p - c) *
// sqrt(1 + r^2/|p - c|^2), after "Mathematical Marbling"); a comb stroke drags the ink beside it with a fast falloff, so a
// long stroke stays local. Curves are kept smooth by putting a point wherever a stretch has opened a gap.
//
// Colour (about one showing in twenty, src/colour.js): from the first touch, every drop of ink is a colour from the palette.
// gestures: tap = a drop, double tap on empty water = start again (REFORM_DELAY_MS after, so a third tap can still mean reveal).

import { colourOf } from '../colour.js';
import { createReveal, grid, corners, label, titleBlock, ink as rvInk } from './reveal.js';
import { pressTracker, TAP, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';
import { linesFor } from '../name.js';

const MAXPTS = 90000;
const FACE = 'italic 900 100px "Bitter", Georgia, serif';          // Still Water's face (Bitter), in italics
let faceReady = null;
function loadFace() {                                                 // the stylesheet, then the face: the trace waits for it
  if (!faceReady) faceReady = new Promise((r) => {
    const l = document.createElement('link'); l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Bitter:ital,wght@1,900&display=swap';
    l.onload = r; l.onerror = r; setTimeout(r, 2500); document.head.appendChild(l);
  }).then(() => Promise.race([document.fonts.load('italic 900 100px "Bitter"'), new Promise((r) => setTimeout(r, 2500))])).catch(() => {});
  return faceReady;
}
const STIR = { cell: 10, sigma: 32, kick: 14, cap: 10, max: 20, k: 85, c: 7 };   // hover stir: a springy field under the ink, so it is drawn displaced and settles back; the shape is never changed
const DEF = { rings: 1, teeth: 1, gap: 46, sharp: 18, pull: 0.85, drop: 54 };

export async function mount(stage) {
  const canvas = stage.canvas, ctx = canvas.getContext('2d');
  const dark = stage.theme.name === 'dark';
  const P = { ...DEF };
  const col = colourOf(stage);
  stage.setBackdrop(dark ? 0 : 1);
  const rgb = (c, a = 1) => `rgba(${c[0] * 255 | 0},${c[1] * 255 | 0},${c[2] * 255 | 0},${a})`;
  const inkCss = rgb(stage.colors.fg), paperCss = rgb(stage.colors.bg);
  const offs = [];
  let W = stage.W, H = stage.H, shapes = [], dirty = true, drops = 0, alive = true, demo = null, touched = false, born = performance.now(), reformT = 0;
  const timers = new Set(); const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  if (col) offs.push(col.wakeOnPress());

  // ---------- the name as ink ----------
  async function nameShape() {
    await loadFace();
    const G = 1, gw = Math.ceil(W / G) + 2, gh = Math.ceil(H / G) + 2;
    const m = document.createElement('canvas'); m.width = gw; m.height = gh; const x = m.getContext('2d', { willReadFrequently: true });
    const portrait = W / H < 0.8, lines = linesFor(stage, portrait ? ['Idan', 'Se', 'gev'] : ['Idan', 'Segev']);
    x.font = FACE; const widest = Math.max(...lines.map((l) => x.measureText(l).width));
    const size = Math.min(W * 0.82 / widest * 100, H * Math.min(portrait ? 0.22 : 0.33, 0.66 / lines.length)) / G;   // the cap per line shrinks when a visitor's name has more lines
    x.font = FACE.replace('100px', size + 'px'); x.textAlign = 'center'; x.fillStyle = '#000';
    const lead = size * 0.93, top = gh / 2 - (lines.length * lead) / 2 + size * 0.78 - gh * 0.02;
    lines.forEach((l, i) => x.fillText(l, gw / 2, top + i * lead));
    const d = x.getImageData(0, 0, gw, gh).data, av = (i, j) => (i < 0 || j < 0 || i >= gw || j >= gh ? 0 : d[(j * gw + i) * 4 + 3] / 255), on = (i, j) => (av(i, j) > 0.5 ? 1 : 0);
    const cross = (a, b) => (Math.abs(b - a) < 1e-4 ? 0.5 : Math.min(1, Math.max(0, (0.5 - a) / (b - a))));   // where the edge of the type crosses between two samples, from the antialiasing: a smooth outline, not a staircase
    const next = new Map(), pt = new Map();
    const key = (k, i, j) => { const s = k + i + ',' + j; if (!pt.has(s)) pt.set(s, k === 'h' ? [i + cross(av(i, j), av(i + 1, j)), j] : [i, j + cross(av(i, j), av(i, j + 1))]); return s; };
    const link = (a, b) => { (next.get(a) || next.set(a, []).get(a)).push(b); (next.get(b) || next.set(b, []).get(b)).push(a); };
    for (let j = -1; j < gh; j++) for (let i = -1; i < gw; i++) {
      const c = on(i, j) * 8 + on(i + 1, j) * 4 + on(i + 1, j + 1) * 2 + on(i, j + 1); if (!c || c === 15) continue;
      const T = () => key('h', i, j), B = () => key('h', i, j + 1), L = () => key('v', i, j), R = () => key('v', i + 1, j);
      switch (c) { case 1: case 14: link(L(), B()); break; case 2: case 13: link(B(), R()); break; case 3: case 12: link(L(), R()); break; case 4: case 11: link(T(), R()); break;
        case 5: link(L(), T()); link(B(), R()); break; case 6: case 9: link(T(), B()); break; case 7: case 8: link(L(), T()); break; case 10: link(L(), B()); link(T(), R()); break; }
    }
    const seen = new Set(), loops = [];
    for (const s of next.keys()) {
      if (seen.has(s)) continue; const pts = []; let prev = null, cur = s;
      for (;;) { seen.add(cur); pts.push(pt.get(cur)); const n = (next.get(cur) || []).find((k) => k !== prev && !seen.has(k)); if (n == null) break; prev = cur; cur = n; }
      if (pts.length < 6) continue;
      let q = pts.map(([a, b]) => [a * G, b * G]);
      for (let it = 0; it < 4; it++) q = q.map((p, k) => { const a = q[(k - 1 + q.length) % q.length], b = q[(k + 1) % q.length]; return [(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4]; });
      loops.push(resample(q.flat(), 2.5));
    }
    return { loops, tone: 'ink' };
  }
  function resample(a, step) {                                     // even spacing along a closed loop
    const out = []; let carry = 0; const n = a.length / 2;
    for (let k = 0; k < n; k++) {
      const x0 = a[k * 2], y0 = a[k * 2 + 1], x1 = a[((k + 1) % n) * 2], y1 = a[((k + 1) % n) * 2 + 1], len = Math.hypot(x1 - x0, y1 - y0);
      let t = carry; while (t < len) { out.push(x0 + (x1 - x0) * t / len, y0 + (y1 - y0) * t / len); t += step; } carry = t - len;
    }
    return out;
  }
  const total = () => shapes.reduce((s, sh) => s + sh.loops.reduce((a, l) => a + l.length / 2, 0), 0);

  // ---------- the moves of marbling ----------
  const marks = [];                                                 // where ink was dropped, for the reveal
  function drop(cx, cy, r, tone) {
    const r2 = r * r;
    for (const sh of shapes) for (const l of sh.loops) for (let k = 0; k < l.length; k += 2) {
      const dx = l[k] - cx, dy = l[k + 1] - cy, d2 = dx * dx + dy * dy || 1e-6, f = Math.sqrt(1 + r2 / d2);
      l[k] = cx + dx * f; l[k + 1] = cy + dy * f;
    }
    const n = Math.max(24, Math.round(2 * Math.PI * r / 2.5)), loop = [];
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; loop.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    shapes.push({ loops: [loop], tone }); marks.push({ x: cx, y: cy, r, tone });
    refine(); dirty = true;
  }
  function tine(ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy); if (len < 0.5) return;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux, lam = P.sharp, teeth = Math.round(P.teeth);
    const offs2 = Array.from({ length: teeth }, (_, i) => (i - (teeth - 1) / 2) * P.gap);
    for (const sh of shapes) for (const l of sh.loops) for (let k = 0; k < l.length; k += 2) {
      let z = 0;
      for (const o of offs2) {
        const px = l[k] - (ax + nx * o), py = l[k + 1] - (ay + ny * o);
        const along = px * ux + py * uy, across = Math.abs(px * nx + py * ny);
        const t = along < 0 ? -along : along > len ? along - len : 0;
        z += P.pull * len * Math.exp(-Math.hypot(across, t) / (lam * 1.8));
      }
      l[k] += ux * z; l[k + 1] += uy * z;
    }
    refine(); dirty = true;
  }
  function refine() {
    if (total() > MAXPTS) return;
    for (const sh of shapes) for (let li = 0; li < sh.loops.length; li++) {
      const l = sh.loops[li], n = l.length / 2, out = [];
      for (let k = 0; k < n; k++) {
        const x0 = l[k * 2], y0 = l[k * 2 + 1], x1 = l[((k + 1) % n) * 2], y1 = l[((k + 1) % n) * 2 + 1];
        out.push(x0, y0);
        const len = Math.hypot(x1 - x0, y1 - y0); if (len > 4) { const s = Math.min(8, Math.ceil(len / 3)); for (let j = 1; j < s; j++) out.push(x0 + (x1 - x0) * j / s, y0 + (y1 - y0) * j / s); }
      }
      sh.loops[li] = out;
    }
  }

  // ---------- give: a held finger makes the ink yield a little and spring back, drawn only, the shape itself is never changed ----------
  const GIVE_R = 95, GIVE_PX = 4.5;
  const gv = { x: 0, y: 0, a: 0, v: 0, to: 0 };
  let giving = false;
  let sg = null, stirring = false;
  function field() {
    const gw = Math.ceil(W / STIR.cell) + 2, gh = Math.ceil(H / STIR.cell) + 2;
    if (!sg || sg.gw !== gw || sg.gh !== gh) sg = { gw, gh, d: new Float32Array(gw * gh * 2), v: new Float32Array(gw * gh * 2) };
    return sg;
  }
  function stir(ax, ay, bx, by) {                                     // a push into the field: velocity, so the ink swings out and comes back
    const f = field(), dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy); if (len < 0.3) return;
    const m = Math.min(len, STIR.cap) / len, ux = dx * m, uy = dy * m, C = STIR.cell, R = STIR.sigma * 2.2, s2 = STIR.sigma * STIR.sigma;
    const i0 = Math.max(0, Math.floor((bx - R) / C)), i1 = Math.min(f.gw - 1, Math.ceil((bx + R) / C)), j0 = Math.max(0, Math.floor((by - R) / C)), j1 = Math.min(f.gh - 1, Math.ceil((by + R) / C));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const ex = i * C - bx, ey = j * C - by, w = Math.exp(-(ex * ex + ey * ey) / s2) * STIR.kick, o = (j * f.gw + i) * 2;
      f.v[o] += ux * w; f.v[o + 1] += uy * w;
    }
    stirring = true;
  }
  function ripple(x, y, kick) {                                       // a ring of push from a touch: outward, springy, settles back like the stir
    const f = field(), C = STIR.cell, R = STIR.sigma * 2.6, s2 = STIR.sigma * STIR.sigma;
    const i0 = Math.max(0, Math.floor((x - R) / C)), i1 = Math.min(f.gw - 1, Math.ceil((x + R) / C)), j0 = Math.max(0, Math.floor((y - R) / C)), j1 = Math.min(f.gh - 1, Math.ceil((y + R) / C));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const ex = i * C - x, ey = j * C - y, d = Math.hypot(ex, ey) || 1e-3, w = Math.exp(-(d * d) / s2) * kick, o = (j * f.gw + i) * 2;
      f.v[o] += (ex / d) * w; f.v[o + 1] += (ey / d) * w;
    }
    stirring = true;
  }
  function stepStir(dt) {
    if (!stirring || !sg) return;
    const h = Math.min(dt, 1 / 30), { d, v } = sg; let live = 0;
    for (let k = 0; k < d.length; k++) {
      v[k] += (-STIR.k * d[k] - STIR.c * v[k]) * h; d[k] += v[k] * h;
      if (d[k] > STIR.max) d[k] = STIR.max; else if (d[k] < -STIR.max) d[k] = -STIR.max;
      live = Math.max(live, Math.abs(d[k]) + Math.abs(v[k]) * 0.05);
    }
    if (live < 0.02) { d.fill(0); v.fill(0); stirring = false; }
    dirty = true;
  }
  function lift(px, py) {                                             // the field under a point, bilinear
    const C = STIR.cell, fx = px / C, fy = py / C, i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= sg.gw - 1 || j >= sg.gh - 1) return [px, py];
    const tx = fx - i, ty = fy - j, a = (j * sg.gw + i) * 2, b = a + 2, c = a + sg.gw * 2, e = c + 2, d = sg.d;
    const w0 = (1 - tx) * (1 - ty), w1 = tx * (1 - ty), w2 = (1 - tx) * ty, w3 = tx * ty;
    return [px + d[a] * w0 + d[b] * w1 + d[c] * w2 + d[e] * w3, py + d[a + 1] * w0 + d[b + 1] * w1 + d[c + 1] * w2 + d[e + 1] * w3];
  }
  function give(px, py) {
    const dx = px - gv.x, dy = py - gv.y, d2 = dx * dx + dy * dy;
    if (d2 > GIVE_R * GIVE_R * 6) return [px, py];
    const d = Math.sqrt(d2) || 1, w = Math.exp(-d2 / (GIVE_R * GIVE_R)), z = gv.a * w * Math.cos(d / 26);   // a soft ring-shaped swell, like a ripple in gel
    return [px + dx / d * z, py + dy / d * z];
  }
  function stepGive(dt) {
    if (stage.reduced) return;
    const h = Math.min(dt, 1 / 30);
    gv.v += (170 * (gv.to - gv.a) - 7.5 * gv.v) * h; gv.a += gv.v * h;
    const was = giving; giving = Math.abs(gv.a) > 0.02 || Math.abs(gv.v) > 0.2 || gv.to !== 0;
    if (giving || was) dirty = true;
  }

  // ---------- drawing ----------
  function draw() {
    ctx.setTransform(stage.pw / stage.W, 0, 0, stage.ph / stage.H, 0, 0);
    ctx.fillStyle = paperCss; ctx.fillRect(0, 0, W, H);
    for (const sh of shapes) {
      const path = new Path2D();
      for (const l of sh.loops) {
        if (!giving && !stirring) { path.moveTo(l[0], l[1]); for (let k = 2; k < l.length; k += 2) path.lineTo(l[k], l[k + 1]); path.closePath(); continue; }
        for (let k = 0; k < l.length; k += 2) { let q = giving ? give(l[k], l[k + 1]) : [l[k], l[k + 1]]; if (stirring) q = lift(q[0], q[1]); k ? path.lineTo(q[0], q[1]) : path.moveTo(q[0], q[1]); }
        path.closePath();
      }
      ctx.fillStyle = sh.tone === 'water' ? paperCss : sh.tone === 'ink' ? inkCss : sh.tone;
      ctx.fill(path, 'evenodd');
    }
  }

  // ---------- touch ----------
  const press = pressTracker();
  let lastInput = -1e9, breathT = 0, lastRipple = 0;                                // idle breathing: after a quiet spell the water shivers faintly, now and then, and settles
  let hov = null, combing = false, last = null, lastTap = 0, pointer = null;
  const tapDrop = (x, y) => {
    const tone = col && col.woke ? col.css(stage.rand()) : 'ink';
    drop(x, y, P.drop, tone);
    if (P.rings) later(() => { if (alive) drop(x, y, P.drop * 0.62, 'water'); }, 140);   // clear water into the middle: the drop becomes a ring
  };
  offs.push(stage.on('down', (q, e) => {
    if (!press.down(q, e.pointerId)) return;
    touched = true; demo = null; lastInput = performance.now(); pointer = e.pointerId; last = { x: q.x, y: q.y }; combing = false; gv.x = q.x; gv.y = q.y; gv.to = GIVE_PX;
    if (!stage.reduced) ripple(q.x, q.y, STIR.kick * 1.2);                          // every touch sends out a ripple
  }));
  offs.push(stage.on('move', (q, e) => {
    lastInput = performance.now();
    if (pointer === null) {                                           // a mouse moving over the ink, no button: stir it gently
      if (e.pointerType !== 'mouse' || demo || stage.reduced || e.buttons) { hov = null; return; }
      if (hov) { const mv = Math.hypot(q.x - hov.x, q.y - hov.y); if (mv < 90) { stir(hov.x, hov.y, q.x, q.y); touched = true; } }
      hov = { x: q.x, y: q.y }; return;
    }
    if (e.pointerId !== pointer) return;
    press.move(q, e.pointerId);
    if (!combing && press.moved > TAP.px) { combing = true; gv.to = 0; }
    if (combing) {
      tine(last.x, last.y, q.x, q.y); last = { x: q.x, y: q.y };
      const now = performance.now();
      if (!stage.reduced && now - lastRipple > 140) { ripple(q.x, q.y, STIR.kick * 0.5); lastRipple = now; }   // a drag keeps sending ripples, a few a second
    }
  }));
  offs.push(stage.on('up', (q, e) => {
    if (e.pointerId !== pointer) return;
    const r = press.up(q, e.pointerId); pointer = null; gv.to = 0;
    if (combing && !stage.reduced) ripple(q.x, q.y, STIR.kick);                // letting go after a drag sends one last ring from where it ended
    if (!r || combing) { combing = false; return; }
    if (r.tap) {
      tapDrop(q.x, q.y);
      const now = performance.now();
      if (now - lastTap < DOUBLE_MS) {                                // two taps on empty water: start again, a beat later so a third tap can still mean reveal
        clearTimeout(reformT); reformT = later(() => { if (!stage.revealed) restart(); }, REFORM_DELAY_MS); lastTap = 0;
      } else lastTap = now;
    }
  }));
  offs.push(stage.on('reveal', () => clearTimeout(reformT)));

  // ---------- the self-demo: until the first touch, once, after a few seconds, a slow comb stroke through the name ----------
  function startDemo() {
    const y = H * 0.5, x0 = W * 0.2, x1 = W * 0.8;
    demo = { t: 0, len: 1.8, x0, y0: y - H * 0.05, x1, y1: y + H * 0.04, px: x0, py: y - H * 0.05 };
  }
  function stepDemo(dt) {
    if (!demo) return;
    demo.t += dt; const u = Math.min(1, demo.t / demo.len), e = u * u * (3 - 2 * u);
    const x = demo.x0 + (demo.x1 - demo.x0) * e, y = demo.y0 + (demo.y1 - demo.y0) * e;
    tine(demo.px, demo.py, x, y); demo.px = x; demo.py = y;
    if (u >= 1) demo = null;
  }

  async function restart() {
    shapes = [await nameShape()]; marks.length = 0; drops = 0; dirty = true;
  }

  // ---------- reveal: what the ink is made of ----------
  const rv = createReveal(stage, (c, W_, H_, k) => {
    const colr = (a) => rvInk(stage, a);
    grid(c, W_, H_, 24, colr, k); corners(c, W_, H_, 16, colr, k);
    let pts = 0;
    c.lineWidth = 1;
    for (const sh of shapes) for (const l of sh.loops) {
      pts += l.length / 2;
      c.strokeStyle = colr(0.7 * k); c.beginPath(); c.moveTo(l[0], l[1]); for (let i = 2; i < l.length; i += 2) c.lineTo(l[i], l[i + 1]); c.closePath(); c.stroke();
      c.fillStyle = colr(0.9 * k);
      for (let i = 0; i < l.length; i += 24) c.fillRect(l[i] - 1.5, l[i + 1] - 1.5, 3, 3);
    }
    for (const m of marks) {
      c.strokeStyle = colr(0.9 * k); c.beginPath(); c.arc(m.x, m.y, 3, 0, 7); c.stroke();
      c.setLineDash([3, 4]); c.beginPath(); c.arc(m.x, m.y, m.r, 0, 7); c.stroke(); c.setLineDash([]);
    }
    titleBlock(c, W_, H_, ['MARBLED · STRUCTURE', '■ a point on the ink ○ a drop, and its ring', `${shapes.length} shapes · ${pts} points`], colr, k);
  });

  // ---------- settings ----------
  const Ctl = (key, label2, min, max, step) => ({ key, label: label2, min, max, step });
  const tune = {
    title: 'Marbled', values: P, defaults: DEF,
    groups: [
      { name: 'Comb', items: [Ctl('teeth', 'Teeth', 1, 9, 1), Ctl('gap', 'Space between teeth (px)', 12, 140, 2), Ctl('sharp', 'How sharp the feathering is (px)', 4, 80, 1), Ctl('pull', 'How far a stroke drags the ink', 0.2, 1.6, 0.05)] },
      { name: 'Drops', items: [Ctl('drop', 'Size of a drop (px)', 10, 160, 2), { key: 'rings', label: 'A drop lands as a ring', type: 'toggle' }] },
    ],
    actions: { 'Start again': () => restart() },
    set(key, v) { P[key] = v; },
    reset() { Object.assign(P, DEF); },
  };

  await restart();
  offs.push(stage.on('resize', () => { W = stage.W; H = stage.H; restart(); }));
  // idle breathing: a small, springy push into the field at a point on the ink; the shapes never change, it just settles back
  function breathe() {
    const l = shapes.length && shapes[0].loops.length ? shapes[0].loops[Math.floor(stage.rand() * shapes[0].loops.length)] : null;
    if (!l || l.length < 4) return;
    const k = 2 * Math.floor(stage.rand() * (l.length / 2)), a = stage.rand() * Math.PI * 2;
    stir(l[k], l[k + 1], l[k] + Math.cos(a) * 5, l[k + 1] + Math.sin(a) * 5);
  }
  offs.push(stage.frame((dt) => {
    if (!touched && !demo && !stage.reduced && performance.now() - born > 3500 && !startDemo.done) { startDemo.done = true; startDemo(); }
    stepDemo(dt); stepGive(dt); stepStir(dt);
    if (!stage.reduced && !demo && performance.now() - lastInput > 2500 && (breathT -= dt) <= 0) { breathe(); breathT = 3.5 + stage.rand() * 2.5; }
    if (dirty) { dirty = false; draw(); }
    rv.draw();
  }));

  return {
    tune,
    debug: { tine, drop, shapes: () => shapes, restart },
    destroy() { alive = false; timers.forEach(clearTimeout); clearTimeout(reformT); rv.destroy(); offs.forEach((f) => f()); stage.setBackdrop(null); },
  };
}
