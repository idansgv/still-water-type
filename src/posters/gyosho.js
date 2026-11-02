// Gyosho: an album title written huge with a dry brush of many bristles, over its song names in a plain sans, after the Amiens
// jazz festival poster. The letters come from a face (Inter Tight 800), thinned to their centre line (Zhang-Suen) and walked into
// strokes; a hand places them big and overlapping, turns and scales each a little, wobbles the line, and joins strokes into
// movements with thin hairlines (the Gyosho part: the brush rarely lifts). Each bristle carries its own ink and breaks on its
// own in short runs; fibre cuts open thin white streaks along the stroke as the brush dries. Each piece is painted in a scratch
// canvas so the cuts never open ink already down.
//
// Ported from the test page docs/posters/prototypes/gyosho.html (the dry version); DEF holds Idan's tuned values (2 Nov 2026).
// Words: the ink writes stage.words. With no name the shell gives an album title (src/albums.js) and its songs go underneath
// (src/posters/data/tracklists.js, from Wikipedia); a title with no songs there is written alone (stage.album tells an album from
// a name). A visitor's name goes in ink over a random album's songs.
//
// gestures: on load the brush writes the title in one breath. Drag paints with the same brush: slow is heavy and wet, fast goes
// thin and dry, a quick release flicks off. Tap writes it again with a new hand (after REFORM_DELAY_MS, so a second tap is the
// same rewrite and a third means reveal). Hold does nothing. Under reduced motion the still is drawn at once.

import { pressTracker, TAP, REFORM_DELAY_MS } from '../gestures.js';
import { createReveal, corners, titleBlock, ink as rvInk } from './reveal.js';
import { lettersFor } from '../name.js';
import { TRACKLISTS } from './data/tracklists.js';

// Defaults saved from the settings panel (Save as defaults, local dev server): src/posters/params/gyosho.json, over the built-in ones below.
const SAVED = await fetch(new URL('./params/gyosho.json', import.meta.url)).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
// Idan's tuned values, 2 Nov 2026 (tuned on Pink Moon). album -1 follows the words (random: the shell's album, or one of ours for a name); 0.. forces one of ALBUMS (settings only).
const DEF = { album: -1, face: 0, brush: 1.4, exag: 0.55, flow: 0.3, dry: 0.3, grain: 0.85, speed: 7.3, overlap: 0, type: 1, seed: 304174 };

// ---------- albums: the title goes in ink, the songs go underneath, each after its length ----------
const ALBUMS = TRACKLISTS.filter((a) => a[2].length);   // every title the shell can give (src/albums.js) that has its songs
const FACES = [
  { label: 'Sans skeleton (Inter Tight)', family: 'Inter Tight', weight: 800 },
  { label: 'Hand (Caveat)', family: 'Caveat', weight: 700 },
  { label: 'Monoline hand (Nothing You Could Do)', family: 'Nothing You Could Do', weight: 400 },
];
const SONG = { family: 'Inter Tight', weight: 500 };
const ALL_TEXT = [...new Set(ALBUMS.map(([t, , tr]) => t + tr.map(([n, l]) => n + l).join('')).join('') + '0123456789:- ')].join('');   // the letters to ask Google Fonts for

// ---------- small maths ----------
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hash = (i, j) => { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vn = (x, y) => {   // value noise, 0..1
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
};
const n1 = (x, o) => vn(x, o * 17.13);

// ---------- a letter's centre line, from the face ----------
const SK = new Map(), F = 200;
function skeleton(ch, f) {
  const key = f.family + '|' + ch; if (SK.has(key)) return SK.get(key);
  const w = Math.round(F * 2), h = Math.round(F * 1.7), ox = F * 0.3, base = F * 1.25;
  const m = document.createElement('canvas'); m.width = w; m.height = h;
  const x = m.getContext('2d', { willReadFrequently: true });
  x.font = `${f.weight} ${F}px "${f.family}"`; x.fillStyle = '#000'; x.textBaseline = 'alphabetic';
  x.fillText(ch, ox, base);
  const adv = x.measureText(ch).width / F;
  const d = x.getImageData(0, 0, w, h).data, img = new Uint8Array(w * h);
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] > 110) { img[i] = 1; const px = i % w, py = (i / w) | 0; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; }
  const out = { adv, strokes: [] };
  if (x1 <= x0) { SK.set(key, out); return out; }
  x0 = Math.max(1, x0 - 2); y0 = Math.max(1, y0 - 2); x1 = Math.min(w - 2, x1 + 2); y1 = Math.min(h - 2, y1 + 2);
  // blobs too small to thin (the dot on an i) become a short dab
  const lab = new Int32Array(w * h), blobs = [];
  for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
    const i0 = py * w + px; if (!img[i0] || lab[i0]) continue;
    const st = [i0], b = { n: 0, sx: 0, sy: 0, maxD: 0, x0: px, x1: px, y0: py, y1: py }; lab[i0] = blobs.length + 1;
    while (st.length) { const i = st.pop(), qx = i % w, qy = (i / w) | 0; b.n++; b.sx += qx; b.sy += qy; b.x0 = Math.min(b.x0, qx); b.x1 = Math.max(b.x1, qx); b.y0 = Math.min(b.y0, qy); b.y1 = Math.max(b.y1, qy);
      for (const j of [i - 1, i + 1, i - w, i + w]) if (img[j] && !lab[j]) { lab[j] = blobs.length + 1; st.push(j); } }
    blobs.push(b);
  }
  // thin to a one-pixel centre line (Zhang-Suen)
  for (let changed = true; changed;) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      const del = [];
      for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
        const i = py * w + px; if (!img[i]) continue;
        const p2 = img[i - w], p3 = img[i - w + 1], p4 = img[i + 1], p5 = img[i + w + 1], p6 = img[i + w], p7 = img[i + w - 1], p8 = img[i - 1], p9 = img[i - w - 1];
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9; if (B < 2 || B > 6) continue;
        const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2); if (A !== 1) continue;
        if (pass === 0 ? (p2 && p4 && p6) || (p4 && p6 && p8) : (p2 && p4 && p8) || (p2 && p6 && p8)) continue;
        del.push(i);
      }
      for (const i of del) img[i] = 0; if (del.length) changed = true;
    }
  }
  for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
    const i = py * w + px; if (!img[i]) continue;
    const p2 = img[i - w], p3 = img[i - w + 1], p4 = img[i + 1], p5 = img[i + w + 1], p6 = img[i + w], p7 = img[i + w - 1], p8 = img[i - 1], p9 = img[i - w - 1];
    if (p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9 !== 2) continue;
    if ((p2 && p4) || (p4 && p6) || (p6 && p8) || (p8 && p2)) img[i] = 0;
  }
  // walk the centre line into strokes, as straight as the line allows, each from its leftmost loose end
  const N8 = [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1], DX = [-1, 0, 1, -1, 1, -1, 0, 1], DY = [-1, -1, -1, 0, 0, 1, 1, 1];
  const used = new Uint8Array(w * h), pix = [];
  for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) if (img[py * w + px]) pix.push(py * w + px);
  const free = (i) => { const r = []; for (let k = 0; k < 8; k++) { const j = i + N8[k]; if (img[j] && !used[j]) r.push(k); } return r; };
  const paths = [];
  for (;;) {
    let start = -1, bs = Infinity;
    for (const i of pix) if (!used[i] && free(i).length <= 1) { const sc = (i % w) + ((i / w) | 0) * 0.35; if (sc < bs) { bs = sc; start = i; } }
    if (start < 0) for (const i of pix) if (!used[i]) { start = i; break; }
    if (start < 0) break;
    const path = [start]; used[start] = 1; let cur = start, dx = 0, dy = 0;
    for (;;) {
      const fr = free(cur); if (!fr.length) break;
      let best = fr[0], sb = -9;
      for (const k of fr) { const sc = (DX[k] * dx + DY[k] * dy) / Math.hypot(DX[k], DY[k]) + (DX[k] && DY[k] ? 0 : 0.05); if (sc > sb) { sb = sc; best = k; } }
      const nx = cur + N8[best];
      for (const k of fr) used[cur + N8[k]] = 1;
      dx = dx * 0.6 + DX[best] * 0.4; dy = dy * 0.6 + DY[best] * 0.4;
      path.push(nx); used[nx] = 1; cur = nx;
    }
    paths.push(path);
  }
  const covered = new Set();
  for (const path of paths) {
    if (path.length < 10) continue;
    for (const i of path) covered.add(lab[i]);
    let q = path.map((i) => [i % w, (i / w) | 0]);
    for (let it = 0; it < 4; it++) q = q.map((p, k) => (k === 0 || k === q.length - 1 ? p : [(q[k - 1][0] + 2 * p[0] + q[k + 1][0]) / 4, (q[k - 1][1] + 2 * p[1] + q[k + 1][1]) / 4]));
    out.strokes.push(q.map(([a, b]) => [(a - ox) / F, (b - base) / F]));
  }
  blobs.forEach((b, k) => {
    if (covered.has(k + 1) || b.n < F * F * 0.0015) return;
    const cx0 = b.sx / b.n, cy0 = b.sy / b.n, r = Math.max(Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.35, F * 0.07);
    out.strokes.push([[cx0 - r, cy0 - r * 0.7], [cx0, cy0], [cx0 + r * 0.5, cy0 + r * 0.8]].map(([a, c]) => [(a - ox) / F, (c - base) / F]));
  });
  SK.set(key, out); return out;
}

// ---------- the hand: place letters, join strokes, warp, flick ----------
function splitRows(title, aspect) {
  const k = Math.max(3, Math.round(1.6 + 3 * aspect)), words = [];
  for (const wd of title.split(/\s+/)) {
    if (wd.length <= k + 1) { words.push(wd); continue; }
    const n = Math.ceil(wd.length / k), m = Math.ceil(wd.length / n);
    for (let i = 0; i < wd.length; i += m) words.push(wd.slice(i, i + m));
  }
  const rows = [];
  for (let i = 0; i < words.length; i++) {
    const wd = words[i];
    if (wd.length <= 2 && i + 1 < words.length && (wd + words[i + 1]).length <= k) { rows.push(wd + ' ' + words[i + 1]); i++; }
    else rows.push(wd);
  }
  return rows;
}
const lenOf = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };
function resample(pts, ds) {   // pts: [x, y, hair]
  const out = [pts[0].slice()]; let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue;
    let t = ds - carry;
    while (t <= L) { const u = t / L; out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]); t += ds; }
    carry = L - (t - ds);
  }
  const last = pts[pts.length - 1]; if (Math.hypot(last[0] - out[out.length - 1][0], last[1] - out[out.length - 1][1]) > ds * 0.3) out.push(last.slice());
  return out;
}
const tangentAt = (pts, i, back) => {
  const a = pts[Math.max(0, back ? i - 4 : i)], b = pts[Math.min(pts.length - 1, back ? i : i + 4)];
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [dx / L, dy / L];
};
function connector(a, b, ta, tb) {   // a thin hairline swing from the end of one stroke into the start of the next
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]), k = d * 0.4, out = [], n = Math.max(4, Math.ceil(d / 3));
  const c1 = [a[0] + ta[0] * k, a[1] + ta[1] * k], c2 = [b[0] - tb[0] * k, b[1] - tb[1] * k];
  for (let i = 1; i < n; i++) {
    const t = i / n, mt = 1 - t, hair = Math.min(1, Math.min(t, 1 - t) * 4);
    out.push([mt * mt * mt * a[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t * t * t * b[0], mt * mt * mt * a[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t * t * t * b[1], hair]);
  }
  return out;
}

function compose(P, title, rng, W, H) {
  const f = FACES[P.face] || FACES[0], rows = splitRows(title, W / H), ex = P.exag;
  const KERN = 0.86;   // letters crowd and overlap
  const rowEm = rows.map((r) => [...r].reduce((s, ch) => s + (ch === ' ' ? 0.22 : skeleton(ch, f).adv * KERN), 0));
  const e = Math.min(W * 0.98 / Math.max(...rowEm), H * 1.2 / rows.length, H * 0.75, W * 0.9);
  const lead = e * 0.7, W0 = e * 0.13 * P.brush;
  const letters = [];
  rows.forEach((r, ri) => {
    const base = H / 2 + (ri - (rows.length - 1) / 2) * lead + e * 0.28;
    let x = (W - rowEm[ri] * e) / 2 + (rng() - 0.5) * W * 0.04 + (ri % 2 ? 1 : -1) * W * 0.025 * ex;
    for (const ch of r) {
      if (ch === ' ') { x += 0.22 * e; continue; }
      const sk = skeleton(ch, f), aw = sk.adv * e;
      const s = e * (1 + (rng() - 0.5) * 0.3 * ex), rot = (rng() - 0.5) * 0.4 * ex, dy = (rng() - 0.5) * 0.16 * e * ex;
      const pcx = x + aw / 2, pcy = base - 0.33 * e + dy, co = Math.cos(rot), si = Math.sin(rot);
      const strokes = sk.strokes.map((st) => st.map(([u, v]) => { const px = (u - sk.adv / 2) * s, py = (v + 0.33) * s; return [pcx + px * co - py * si, pcy + px * si + py * co, 0]; }));
      letters.push(strokes);
      x += aw * KERN;
    }
  });
  // join strokes into movements (Gyosho: the brush rarely lifts)
  const pIn = Math.min(1, P.flow * 1.6), pAcross = Math.max(0, P.flow * 2 - 1);
  const moves = [];
  let cur = null;
  letters.forEach((strokes, li) => {
    strokes.forEach((st, si) => {
      if (cur) {
        const end = cur.pts[cur.pts.length - 1];
        const dA = Math.hypot(st[0][0] - end[0], st[0][1] - end[1]), dB = Math.hypot(st[st.length - 1][0] - end[0], st[st.length - 1][1] - end[1]);
        if (dB < dA * 0.7) st = st.slice().reverse();
        const join = si === 0 ? rng() < pAcross : rng() < pIn;
        if (join) {
          const rs = resample(st, 2), rc = resample(cur.pts, 2);
          cur.pts = cur.pts.concat(connector(end, st[0], tangentAt(rc, rc.length - 1, true), tangentAt(rs, 0, false)), st);
          return;
        }
        moves.push(cur);
      }
      cur = { pts: st.slice(), letter: li };
    });
  });
  if (cur) moves.push(cur);
  return { moves, e, W0, rng, ex };
}

// each movement becomes samples: position, tangent, width, how dry, whether it is a hairline or a flick
function shape(mv, C) {
  const { e, W0, rng, ex } = C, ds = Math.max(1.2, W0 / 16);
  let pts = resample(mv.pts, ds);
  for (let it = 0; it < 7; it++) pts = pts.map((p, k) => (k === 0 || k === pts.length - 1 ? p : [(pts[k - 1][0] + 2 * p[0] + pts[k + 1][0]) / 4, (pts[k - 1][1] + 2 * p[1] + pts[k + 1][1]) / 4, p[2]]));
  // a slow wobble across the line: the hand's own movement
  const o = rng() * 100, amp = ex * W0 * 0.9;
  let s = 0;
  pts = pts.map((p, k) => {
    if (k) s += ds; const t = tangentAt(pts, k, false), w = (n1(s / (e * 0.45), o) - 0.5) * 2 * amp;
    return [p[0] - t[1] * w, p[1] + t[0] * w, p[2]];
  });
  // the end: a flick that curls off, or a blunt stop
  const flick = pts[pts.length - 1][2] < 0.5 && rng() < 0.55;
  const tail = [];
  if (flick) {
    let [tx, ty] = tangentAt(pts, pts.length - 1, true), [x, y] = pts[pts.length - 1];
    const L = W0 * (1.2 + 2.6 * ex * rng()), n = Math.ceil(L / ds), curl = (rng() - 0.5) * 2.6 * (0.4 + ex);
    for (let j = 1; j <= n; j++) {
      const a = curl / n, c = Math.cos(a), sn = Math.sin(a); [tx, ty] = [tx * c - ty * sn, tx * sn + ty * c];
      x += tx * ds; y += ty * ds; tail.push([x, y, 0, j / n]);
    }
  }
  pts = pts.map((p) => [p[0], p[1], p[2], 0]).concat(tail);
  // per sample: tangent, speed (straight runs are fast), width, dryness
  const n = pts.length, out = new Array(n);
  let dep = 0; s = 0;
  const o2 = rng() * 100, press = 1.15 + rng() * 0.2;
  const ang = (i) => { const t = tangentAt(pts, i, false); return Math.atan2(t[1], t[0]); };
  let prevA = ang(0), speedS = 0.6;
  for (let i = 0; i < n; i++) {
    const p = pts[i]; if (i) s += ds;
    const t = tangentAt(pts, i, false), a = ang(i);
    let da = a - prevA; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; prevA = a;
    const speed = 1 - Math.min(1, Math.abs(da) / ds * W0 * 1.3);
    speedS = speedS * 0.9 + speed * 0.1;
    const hair = p[2], tl = p[3];
    const wf = (1 - hair * 0.9) * (tl ? Math.pow(1 - tl, 1.3) * 0.92 + 0.04 : 1);
    const w = W0 * wf * (1 + (press - 1) * Math.exp(-s / (W0 * 0.9))) * (0.86 + 0.28 * n1(s / (W0 * 3), o2)) * (1.08 - 0.18 * speedS);
    dep += ds / (e * 1.3) * (0.45 + speedS) * (1 + hair * 2.5);
    out[i] = { x: p[0], y: p[1], tx: t[0], ty: t[1], w, s, dep: Math.min(1.3, dep), hair, tl, sp: speedS };
  }
  return { S: out, blunt: !flick && pts[n - 1][2] < 0.5, ds };
}

export async function mount(stage) {
  const c = stage.canvas.getContext('2d');
  const P = { ...DEF, ...SAVED };
  const offs = [], timers = [];
  let alive = true;
  const later = (fn, ms) => { const t = setTimeout(() => { if (alive) fn(); }, ms); timers.push(t); return t; };
  const dark = stage.theme.name === 'dark';
  const css = (f) => `rgb(${f[0] * 255 | 0},${f[1] * 255 | 0},${f[2] * 255 | 0})`;
  const bg = css(stage.colors.bg), fg = css(stage.colors.fg);

  // ---------- the words: an album the shell gave (its songs when we have them), or a name over one of our albums ----------
  const byTitle = (t) => ALBUMS.findIndex((a) => a[0].toLowerCase() === String(t || '').toLowerCase());
  const given = stage.words ? stage.words.join(' ') : null;
  const fromShell = !!(stage.album && given === stage.album.title);
  let pick = given ? byTitle(given) : -1;
  const songless = pick < 0 && fromShell;                             // Idan (2 Nov 2026): an album we have no songs for is its title alone
  if (pick < 0) pick = Math.floor(stage.rand() * ALBUMS.length);
  const albumIx = () => (P.album >= 0 ? P.album | 0 : pick) % ALBUMS.length;
  const title = () => (P.album >= 0 || !given ? ALBUMS[albumIx()][0] : given);   // the ink: the visitor's name, the album given, or ours
  const songs = () => P.type && (P.album >= 0 || !songless);

  // ---------- faces: Inter Tight from Google Fonts (the letters the poster can set); the hands only when chosen in settings ----------
  const links = [];
  async function loadFace(f, text) {
    const id = f.family + f.weight;
    if (!links.some((l) => l.dataset.id === id)) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.id = id;
      l.href = `https://fonts.googleapis.com/css2?family=${f.family.replace(/ /g, '+')}:wght@${f.weight}&text=${encodeURIComponent([...new Set(text)].join(''))}&display=block`;
      document.head.appendChild(l); links.push(l);
      await Promise.race([new Promise((r) => { l.onload = r; l.onerror = r; }), new Promise((r) => setTimeout(r, 2500))]);
    }
    try { await Promise.race([document.fonts.load(`${f.weight} 100px "${f.family}"`, text.slice(0, 40)), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* the fallback face */ }
  }
  const letters = lettersFor(stage, ALL_TEXT);
  await Promise.all([loadFace(SONG, letters), loadFace(FACES[P.face] || FACES[0], letters)]);
  if (!alive) return { destroy() {} };

  // ---------- the brush: many bristles, each with its own ink ----------
  let Nb = 60, C = null, dpr = 1, list = [];
  function brushFor(S, blunt, ds, rng, W0) {   // one stroke ready to paint: its samples and its bristles
    const sd1 = rng() * 1000, sd2 = rng() * 1000, sd3 = rng() * 1000, br = [];
    for (let b = 0; b < Nb; b++) {
      const u = -1 + 2 * (b + 0.5) / Nb + (rng() - 0.5) * 0.9 / Nb, au = Math.abs(u);
      br.push({ u, au, wobA: 0.012 + 0.03 * au * au, wobF: 0.5 + rng(), wobP: rng() * 6.28, bo: b * 3.7 + sd3,
        late: au > 0.75 ? rng() * W0 * 0.5 * (au - 0.75) * 4 : 0,   // edge hairs touch down a little late: a ragged start
        load: (0.7 + rng() * 0.6) * (1 - 0.3 * au * au), gl: rng(), state: true, lastI: -1, lastV: true });
    }
    return { S, blunt, ds, W0, sd1, sd2, sd3, br };
  }
  // Each piece is painted into a small scratch canvas first, so the fibre cuts open white only in the stroke being painted, never in ink already down.
  const scratch = document.createElement('canvas'), sc = scratch.getContext('2d');
  // paints samples a..b; a === 0 adds the press, last adds the blunt stop
  function paintRange(ctx, st, a, b, last) {
    const { S, W0, sd1, sd3, ds } = st, dry = P.dry;
    if (b <= a) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = a; i <= b; i++) { const p = S[i], r = p.w; x0 = Math.min(x0, p.x - r); y0 = Math.min(y0, p.y - r); x1 = Math.max(x1, p.x + r); y1 = Math.max(y1, p.y + r); }
    const pad = W0 * 0.7, bx = Math.floor((x0 - pad) * dpr), by = Math.floor((y0 - pad) * dpr), bw = Math.ceil((x1 - x0 + 2 * pad) * dpr) + 2, bh = Math.ceil((y1 - y0 + 2 * pad) * dpr) + 2;
    if (scratch.width < bw || scratch.height < bh) { scratch.width = Math.max(scratch.width, bw); scratch.height = Math.max(scratch.height, bh); }
    sc.setTransform(1, 0, 0, 1, 0, 0); sc.globalCompositeOperation = 'source-over'; sc.globalAlpha = 1; sc.clearRect(0, 0, bw, bh);
    sc.setTransform(1, 0, 0, 1, -bx, -by);
    sc.strokeStyle = fg; sc.lineCap = 'round'; sc.lineJoin = 'round'; sc.lineWidth = Math.max(0.6, W0 * dpr / Nb * 1.5);
    const fresh = (p) => Math.exp(-p.s / (W0 * 0.8));
    sc.beginPath();
    for (const br of st.br) {
      const { u, au, wobA, wobF, wobP, bo, late, load, gl } = br;
      const vis = (i) => {
        if (i === br.lastI) return br.lastV;
        const p = S[i], fr = fresh(p); br.lastI = i;
        if (p.s < late) return (br.lastV = false);
        // big dry patches: neighbouring bristles run out together as the brush empties
        const coarse = 0.6 * vn(u * 13 + sd1, p.s / (W0 * 1.1)) + 0.4 * vn(u * 31 + sd3, p.s / (W0 * 0.5));
        const thr = dry * (0.55 * Math.pow(Math.min(1, p.dep), 1.8) + 0.2 * Math.pow(au, 6)) + p.tl * p.tl * 0.65 + p.hair * 0.3 - 0.35 * fr;
        // each bristle also skips on its own, in short runs: broken fibres rather than parallel lines
        const pOff = Math.min(0.9, (dry * (0.04 + 0.4 * Math.pow(Math.min(1, p.dep), 1.5)) * (1 - fr) + 0.3 * dry * Math.pow(au, 8) + p.tl * 0.35 + p.hair * 0.2) / load);
        const gap = W0 * (0.1 + 0.35 * gl);
        if (br.state) { if (pOff > 0.001 && Math.random() < ds / (gap * (1 - pOff) / pOff)) br.state = false; }
        else if (Math.random() < ds / gap) br.state = true;
        return (br.lastV = coarse > thr && br.state);
      };
      const pos = (i) => { const p = S[i], spl = (vn(bo, p.s / (W0 * 1.4)) - 0.5) * 0.32 * Math.min(1, p.dep + p.tl) * dry, off = (u + spl + wobA * Math.sin(p.s / W0 * wobF + wobP)) * p.w / 2; return [(p.x - p.ty * off) * dpr, (p.y + p.tx * off) * dpr]; };
      let on = false;
      // the press: a round start (and a round stop when the stroke ends blunt)
      if (a === 0) { if (vis(0)) { const p = S[0], cc = Math.sqrt(Math.max(0, 1 - u * u)) * p.w * 0.5, q = pos(0); sc.moveTo(q[0] - p.tx * cc * dpr, q[1] - p.ty * cc * dpr); sc.lineTo(q[0], q[1]); on = true; } }
      else if (vis(a)) { const q = pos(a); sc.moveTo(q[0], q[1]); on = true; }
      for (let i = a + 1; i <= b; i++) {
        const v = vis(i), q = pos(i);
        if (v) { if (on) sc.lineTo(q[0], q[1]); else sc.moveTo(q[0], q[1]); }
        else if (on && Math.random() < 0.3 * dry) {   // a bristle running out flicks a speck just past where it lifted
          const p = S[i], d = W0 * (0.08 + 0.3 * Math.random()) * dpr, j = (Math.random() - 0.5) * 2;
          sc.moveTo(q[0] + p.tx * d - p.ty * j, q[1] + p.ty * d + p.tx * j); sc.lineTo(q[0] + p.tx * (d + 0.4), q[1] + p.ty * (d + 0.4));
        }
        on = v;
      }
      if (last && st.blunt && on) { const p = S[b], cc = Math.sqrt(Math.max(0, 1 - u * u)) * p.w * 0.5 * (0.6 + 0.4 * vn(u * 5 + sd3, 3)), q = pos(b); sc.lineTo(q[0] + p.tx * cc * dpr, q[1] + p.ty * cc * dpr); }
    }
    sc.stroke();
    // fibre cuts: thin white streaks that run with the stroke, long and fine, more of them as the brush dries
    sc.globalCompositeOperation = 'destination-out'; sc.lineCap = 'butt';
    for (let i = a; i < b; i++) {
      const p = S[i];
      let k = (dry * (0.2 + 1.7 * Math.pow(Math.min(1, p.dep), 1.5)) * (1 - fresh(p)) + p.tl * 2 + p.hair * 1.2) * ds / W0 * 8;
      for (; k > 0 && Math.random() < k; k--) {
        const long = Math.random() < 0.35, L = W0 * (long ? 0.4 + 1.2 * Math.random() : 0.08 + 0.25 * Math.random());
        const u = (Math.random() * 2 - 1) * 0.95, drift = (Math.random() - 0.5) * 0.12;
        sc.lineWidth = (long ? 0.45 + Math.random() * 0.8 : 0.6 + Math.random() * 1.3) * Math.max(1, dpr * 0.8);
        sc.globalAlpha = 0.55 + 0.45 * Math.random();
        sc.beginPath();
        for (let j = i; j <= b && S[j].s - p.s <= L; j++) {
          const q = S[j], off = (u + drift * (q.s - p.s) / W0) * q.w / 2, x = (q.x - q.ty * off) * dpr, y = (q.y + q.tx * off) * dpr;
          if (j === i) sc.moveTo(x, y); else sc.lineTo(x, y);
        }
        sc.stroke();
      }
    }
    sc.globalCompositeOperation = 'source-over'; sc.globalAlpha = 1;
    ctx.drawImage(scratch, 0, 0, bw, bh, bx, by, bw, bh);
  }

  let grainTile = null;
  function grain(ctx, w, h) {
    if (P.grain <= 0) return;
    if (!grainTile) {
      const t = document.createElement('canvas'); t.width = t.height = 256; const g = t.getContext('2d'), r = mulberry32(99);
      for (let i = 0; i < 1800; i++) { g.globalAlpha = 0.3 + r() * 0.7; g.beginPath(); g.arc(r() * 256, r() * 256, 0.3 + r() * r() * 1.1, 0, 6.283); g.fill(); }
      for (let i = 0; i < 90; i++) { const x = r() * 256, y = r() * 256, a = r() * 6.283, L = 3 + r() * 9; g.globalAlpha = 0.5; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
      grainTile = t;
    }
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = Math.min(1, P.grain * 0.85);
    ctx.fillStyle = ctx.createPattern(grainTile, 'repeat'); ctx.setTransform(Math.max(1, dpr * 0.75), 0, 0, Math.max(1, dpr * 0.75), 0, 0); ctx.fillRect(0, 0, w, h); ctx.restore();
  }

  // ---------- the song names: plain, big, hyphenated where a word won't fit ----------
  function paintType(ctx, W, H) {
    const tracks = ALBUMS[albumIx()][2], x0 = Math.max(16, W * 0.06), maxW = W - 2 * x0;
    const font = (s) => `${SONG.weight} ${s}px "${SONG.family}"`;
    const set = (s) => {
      ctx.font = font(s); if ('letterSpacing' in ctx) ctx.letterSpacing = `${-0.035 * s}px`;
      const m = (t) => ctx.measureText(t).width, lines = [];
      for (const [name, len] of tracks) {
        let line = '';
        for (const wd of `${len ? len.replace(/^0(?=\d)/, '') + ' ' : ''}${name}`.split(' ')) {
          const test = line ? line + ' ' + wd : wd;
          if (m(test) <= maxW) { line = test; continue; }
          if (line) lines.push(line);
          let rest = wd;
          while (m(rest) > maxW && rest.length > 3) { let k = rest.length - 1; while (k > 2 && m(rest.slice(0, k) + '-') > maxW) k--; lines.push(rest.slice(0, k) + '-'); rest = rest.slice(k); }
          line = rest;
        }
        if (line) lines.push(line);
      }
      return lines;
    };
    let s = Math.min(H * 0.085, W * 0.11), lines;
    for (;;) { lines = set(s); if (lines.length * s * 0.9 <= H * 0.74 || s < 11) break; s *= 0.95; }
    ctx.save(); ctx.scale(dpr, dpr); ctx.fillStyle = fg; ctx.textBaseline = 'alphabetic';
    const lead = s * 0.9, top = (H - lines.length * lead) / 2 + s * 0.78;
    lines.forEach((l, i) => ctx.fillText(l, x0, top + i * lead));
    ctx.restore();
  }

  // ---------- build: lay out the poster, then write it (live, or all at once) ----------
  const ink = document.createElement('canvas'), typ = document.createElement('canvas'), view = document.createElement('canvas');
  let dirty = false, writer = null, user = null;
  function present() {
    const v = view.getContext('2d');
    v.globalCompositeOperation = 'source-over'; v.clearRect(0, 0, view.width, view.height); v.drawImage(ink, 0, 0); grain(v, view.width, view.height);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, stage.pw, stage.ph);
    c.drawImage(typ, 0, 0);
    c.globalCompositeOperation = P.overlap ? 'xor' : 'source-over'; c.drawImage(view, 0, 0);
    c.globalCompositeOperation = 'destination-over'; c.fillStyle = bg; c.fillRect(0, 0, stage.pw, stage.ph);
    c.globalCompositeOperation = 'source-over';
  }
  const inkCtx = () => { const x = ink.getContext('2d'); x.strokeStyle = fg; x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = Math.max(0.6, C.W0 * dpr / Nb * 1.7); return x; };
  // time to cross one sample: slow through turns, quick on straight runs and through flicks and hairlines
  const cost = (st, i) => { const p = st.S[i]; return st.ds / (P.speed * C.e * (0.3 + 1.2 * p.sp) * (1 + p.tl * 1.6 + p.hair * 0.9)); };
  function build(live) {
    const W = stage.W, H = stage.H; dpr = stage.pw / W;
    for (const cv of [ink, typ, view]) { cv.width = stage.pw; cv.height = stage.ph; }
    const rng = mulberry32(P.seed * 9973 + albumIx() * 131 + P.face * 7);
    C = compose(P, title(), rng, W, H);
    Nb = Math.round(Math.max(40, Math.min(170, C.W0 * dpr / 1.3)));
    list = [];
    for (const mv of C.moves) {
      if (lenOf(mv.pts) < 2) continue;
      const { S, blunt, ds } = shape(mv, C); if (S.length < 2) continue;
      const st = brushFor(S, blunt, ds, rng, C.W0); st.letter = mv.letter; list.push(st);
    }
    user = null;
    if (songs()) paintType(typ.getContext('2d'), W, H);
    if (live && !stage.reduced) writer = { list, k: 0, i: 0, acc: 0, pause: 0.35 };
    else { writer = null; const x = inkCtx(); for (const st of list) paintRange(x, st, 0, st.S.length - 1, true); }
    present();
  }
  function rewrite() { P.seed = (Math.random() * 1e6) | 0; build(true); }

  // ---------- your brush: the same brush, on your drag ----------
  // slow drags lay heavy wet ink, fast ones go thin and dry; a quick release flicks off
  const press = pressTracker();
  const ptr = { id: null, x: 0, y: 0, sx: 0, sy: 0, moved: 0, v: 0, vx: 0, vy: 0, lt: 0 };
  let tapT = 0;
  function userSample(x, y) {
    const st = user.st, S = st.S, W0 = C.W0, e = C.e;
    const last = S[S.length - 1], dx = x - last.x, dy = y - last.y, L = Math.hypot(dx, dy);
    if (L < st.ds) return;
    const k = Math.floor(L / st.ds), ux = dx / L, uy = dy / L;
    for (let j = 1; j <= k; j++) {
      const p = S[S.length - 1];
      const tx = p.tx * 0.6 + ux * 0.4, ty = p.ty * 0.6 + uy * 0.4, tl = Math.hypot(tx, ty) || 1;
      const s = p.s + st.ds, sp = Math.min(1.6, ptr.v / (e * 2.2));
      const w = W0 * Math.max(0.3, Math.min(1.3, 1.3 - sp * 0.75)) * (1 + 0.25 * Math.exp(-s / (W0 * 0.9))) * (0.9 + 0.2 * n1(s / (W0 * 3), st.sd1));
      S.push({ x: p.x + ux * st.ds, y: p.y + uy * st.ds, tx: tx / tl, ty: ty / tl, w, s, dep: Math.min(1.3, p.dep + st.ds / (e * 1.3) * (0.35 + sp)), hair: 0, tl: 0, sp });
    }
  }
  offs.push(stage.on('down', (q, e) => {
    if (!C || ptr.id !== null) return;                                // one pointer
    press.down(q, e.pointerId);
    const now = performance.now();
    Object.assign(ptr, { id: e.pointerId, x: q.x, y: q.y, sx: q.x, sy: q.y, lt: now, moved: 0, v: 0, vx: 0, vy: 0 });
    user = null;
  }));
  offs.push(stage.on('move', (q, e) => {
    if (ptr.id !== e.pointerId || !C) return;
    press.move(q, e.pointerId);
    const now = performance.now(), dt = Math.max(1, now - ptr.lt) / 1000, dx = q.x - ptr.x, dy = q.y - ptr.y;
    ptr.moved += Math.hypot(dx, dy); ptr.vx = ptr.vx * 0.7 + dx / dt * 0.3; ptr.vy = ptr.vy * 0.7 + dy / dt * 0.3; ptr.v = Math.hypot(ptr.vx, ptr.vy);
    ptr.x = q.x; ptr.y = q.y; ptr.lt = now;
    if (!user && ptr.moved > TAP.px) {
      const ux = (ptr.x - ptr.sx) / (ptr.moved || 1), uy = (ptr.y - ptr.sy) / (ptr.moved || 1), ul = Math.hypot(ux, uy) || 1;
      const S = [{ x: ptr.sx, y: ptr.sy, tx: ux / ul, ty: uy / ul, w: C.W0 * 1.25, s: 0, dep: 0, hair: 0, tl: 0, sp: 0 }];
      user = { st: brushFor(S, true, Math.max(1.2, C.W0 / 16), Math.random, C.W0), done: 0 };
      clearTimeout(tapT);                                             // a drag after a tap: the tap's rewrite would wipe it
    }
    if (user) userSample(ptr.x, ptr.y);
  }));
  offs.push(stage.on('up', (q, e) => {
    if (ptr.id !== e.pointerId) return;
    ptr.id = null;
    const r = press.up(q, e.pointerId);
    if (!user) {                                                      // a tap writes it again, a beat later (a second tap is the same rewrite; three mean reveal)
      if (r && r.tap) { clearTimeout(tapT); tapT = later(rewrite, REFORM_DELAY_MS); }
      return;
    }
    const st = user.st, S = st.S, fast = performance.now() - ptr.lt < 60 && ptr.v > C.e * 1.4;
    if (fast) {   // a flick: the brush leaves the paper still moving
      st.blunt = false;
      let p = S[S.length - 1];
      const tx = p.tx, ty = p.ty, L = C.W0 * Math.min(3.5, 0.8 + ptr.v / (C.e * 1.5)), n = Math.ceil(L / st.ds);
      for (let j = 1; j <= n; j++) { p = S[S.length - 1]; S.push({ x: p.x + tx * st.ds, y: p.y + ty * st.ds, tx, ty, w: p.w, s: p.s + st.ds, dep: p.dep, hair: 0, tl: j / n, sp: p.sp }); }
      for (let j = S.length - n; j < S.length; j++) S[j].w = S[S.length - n - 1].w * (Math.pow(1 - S[j].tl, 1.3) * 0.92 + 0.04);
    }
    paintRange(inkCtx(), st, user.done, S.length - 1, true); user = null; dirty = true;
  }));
  offs.push(stage.on('reveal', () => clearTimeout(tapT)));

  // ---------- reveal: what the ink is made of. Each movement's centre line, the width the brush gives it, where it presses and lifts ----------
  const rv = createReveal(stage, (x, W, H, k) => {
    const col = (a) => rvInk(stage, a);
    corners(x, W, H, 14, col, k);
    x.lineWidth = 1;
    for (const st of list) {
      const S = st.S;
      x.strokeStyle = col(0.22 * k); x.beginPath();                  // the brush's width, both edges
      for (const side of [1, -1]) { S.forEach((p, i) => { const o = side * p.w / 2, px = p.x - p.ty * o, py = p.y + p.tx * o; if (i) x.lineTo(px, py); else x.moveTo(px, py); }); }
      x.stroke();
      x.strokeStyle = col(0.85 * k); x.beginPath();                  // the centre line; hairlines and flicks dashed
      S.forEach((p, i) => { if (!i || p.hair > 0.5 !== S[i - 1].hair > 0.5) x.moveTo(p.x, p.y); else x.lineTo(p.x, p.y); });
      x.stroke();
      x.fillStyle = col(0.9 * k); x.beginPath(); x.arc(S[0].x, S[0].y, 3, 0, Math.PI * 2); x.fill();   // the press
      const L = S[S.length - 1]; x.beginPath(); x.moveTo(L.x - 4, L.y - 4); x.lineTo(L.x + 4, L.y + 4); x.moveTo(L.x + 4, L.y - 4); x.lineTo(L.x - 4, L.y + 4); x.stroke();   // the lift
    }
    if (C) titleBlock(x, W, H, ['GYOSHO', `${list.length} movements`, `${Nb} bristles`, `${FACES[P.face] ? FACES[P.face].family : ''} centre line`, `flow ${P.flow}  dry ${P.dry}`], col, k);
  });

  // ---------- settings ----------
  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  const tune = {
    title: 'Gyosho', values: P, defaults: DEF, persist: true,
    groups: [
      { name: 'Words', items: [Ctl('album', 'Album (-1 follows the words)', -1, ALBUMS.length - 1, 1), Ctl('face', 'Letters from (0 sans, 1 Caveat, 2 monoline)', 0, FACES.length - 1, 1), { key: 'type', label: 'Song names underneath', type: 'toggle' }, { key: 'overlap', label: 'Ink knocks out the type', type: 'toggle' }] },
      { name: 'Hand', items: [Ctl('brush', 'Brush width', 0.4, 2.2, 0.05), Ctl('exag', 'Movement', 0, 1.6, 0.05), Ctl('flow', 'Flow (strokes run together)', 0, 1, 0.05), Ctl('speed', 'Writing speed', 0.5, 8, 0.1)] },
      { name: 'Ink', items: [Ctl('dry', 'Dry brush', 0, 2, 0.05), Ctl('grain', 'Paper grain', 0, 1, 0.05)] },
    ],
    actions: {
      'Write it again': rewrite,
      'Next album': () => { P.album = (albumIx() + 1) % ALBUMS.length; P.seed = (Math.random() * 1e6) | 0; build(true); },
    },
    async set(key, v) {
      P[key] = key === 'album' || key === 'face' ? Math.round(v) : v;
      if (key === 'face') await loadFace(FACES[P.face], letters);
      if (!alive) return;
      if (key === 'overlap' || key === 'grain') { dirty = true; return; }
      clearTimeout(soonT); soonT = later(() => build(key === 'album' || key === 'face'), 90);
    },
    reset() { Object.assign(P, DEF, SAVED); build(false); },
  };
  let soonT = 0;

  // ---------- the frame: the live writer, then your brush ----------
  build(true);
  let rz = 0;
  offs.push(stage.on('resize', () => { if (C) present(); clearTimeout(rz); rz = later(() => build(false), 250); }));   // the stage clears its canvas on resize
  offs.push(stage.frame((dt) => {
    let budget = dt;
    while (writer && budget > 0) {
      if (writer.pause > 0) { const d = Math.min(writer.pause, budget); writer.pause -= d; budget -= d; continue; }
      const st = writer.list[writer.k]; if (!st) { writer = null; break; }
      const n = st.S.length, i0 = writer.i; let i = i0;
      writer.acc += budget; budget = 0;
      while (i < n - 1 && writer.acc >= cost(st, i)) { writer.acc -= cost(st, i); i++; }
      if (i > i0) { paintRange(inkCtx(), st, i0, i, i >= n - 1); dirty = true; }
      writer.i = i;
      if (i >= n - 1) { writer.k++; writer.i = 0; budget = writer.acc; writer.acc = 0; const nx = writer.list[writer.k]; writer.pause = nx && nx.letter !== st.letter ? 0.16 : 0.07; }
    }
    if (user && user.st.S.length - 1 > user.done) { const b = user.st.S.length - 1; paintRange(inkCtx(), user.st, user.done, b, false); user.done = b; dirty = true; }
    if (dirty) { dirty = false; present(); }
    rv.draw(performance.now());
  }));

  return {
    tune,
    debug: { get writing() { return !!writer; }, get moves() { return list.length; }, finish() { while (writer) { const st = writer.list[writer.k]; if (!st) { writer = null; break; } paintRange(inkCtx(), st, writer.i, st.S.length - 1, true); writer.k++; writer.i = 0; } present(); }, dark },
    destroy() {
      alive = false; timers.forEach(clearTimeout);
      rv.destroy(); offs.forEach((f) => f()); links.forEach((l) => l.remove());
      for (const cv of [ink, typ, view, scratch]) { cv.width = cv.height = 0; }
      writer = user = null;
    },
  };
}
