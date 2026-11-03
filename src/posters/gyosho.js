// Gyosho: an album title written huge with a dry brush of many bristles, over its song names in a plain sans, after the Amiens
// jazz festival poster. The letters come from a face (Inter Tight 800), thinned to their centre line (Zhang-Suen) and walked into
// strokes; a hand places them big and overlapping, turns and scales each a little, wobbles the line, and joins strokes into
// movements with thin hairlines (the Gyosho part: the brush rarely lifts). Each bristle carries its own ink and breaks on its
// own in short runs; fibre cuts open thin white streaks along the stroke as the brush dries. Each piece is painted in a scratch
// canvas so the cuts never open ink already down. The brush carries a load of ink: it empties along the strokes and goes back to
// the inkstone at each letter. Where it went down loaded and slow it is wet, and a WebGL pass lets that ink creep into the paper
// along its fibres and close nearby streaks before it sets (without WebGL the ink stays as the brush left it).
//
// Ported from the test page docs/posters/prototypes/gyosho-wet.html; DEF holds Idan's tuned wet values (2 Nov 2026).
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
// Idan's tuned wet values, 2 Nov 2026. album -1 follows the words (random: the shell's album, or one of ours for a name); 0.. forces one of ALBUMS (settings only).
const DEF = { album: -1, face: 0, brush: 1, exag: 0.75, flow: 0.5, dry: 0.35, grain: 0, speed: 6.2, wetAmt: 0.65, empty: 0.2, load: 1.05, runout: 0.85, speedDry: 1.35, redip: 1, edgeDry: 1, cuts: 1, wetLoad: 0.4, wetSlow: 0.75, press: 0.25, reach: 0.66, wetTime: 0.2, pull: 0.7, ease: 0.1, lenFast: 0, rhythm: 0.05, lift: 2.55, breath: 0.06, overlap: 0, type: 1, seed: 253133 };

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
function shape(mv, C, P) {
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
    dep += ds / (e * 1.3 * P.runout) * (0.45 + speedS * P.speedDry) * (1 + hair * 2.5);
    out[i] = { x: p[0], y: p[1], tx: t[0], ty: t[1], w, s, dep, use: dep, hair, tl, sp: speedS };   // dep is set again from use by the ink carriage (build)
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
  const scratch = document.createElement('canvas'), sc = scratch.getContext('2d'), wetMap = document.createElement('canvas');
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
        const thr = P.empty * 0.55 * Math.pow(Math.min(1, p.dep), 1.8) + dry * 0.2 * P.edgeDry * Math.pow(au, 6) + p.tl * p.tl * 0.65 + p.hair * 0.3 - 0.35 * fr;
        // each bristle also skips on its own, in short runs: broken fibres rather than parallel lines
        const pOff = Math.min(0.9, ((dry * 0.04 + P.empty * 0.4 * Math.pow(Math.min(1, p.dep), 1.5)) * (1 - fr) + 0.3 * dry * P.edgeDry * Math.pow(au, 8) + p.tl * 0.35 + p.hair * 0.2) / load);
        const gap = W0 * (0.1 + 0.35 * gl);
        if (br.state) { if (pOff > 0.001 && Math.random() < ds / (gap * (1 - pOff) / pOff)) br.state = false; }
        else if (Math.random() < ds / gap) br.state = true;
        return (br.lastV = coarse > thr && br.state);
      };
      const pos = (i) => { const p = S[i], spl = (vn(bo, p.s / (W0 * 1.4)) - 0.5) * 0.32 * Math.min(1, p.dep + p.tl) * Math.max(dry, P.empty), off = (u + spl + wobA * Math.sin(p.s / W0 * wobF + wobP)) * p.w / 2; return [(p.x - p.ty * off) * dpr, (p.y + p.tx * off) * dpr]; };
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
      let k = ((dry * 0.2 + P.empty * 1.7 * Math.pow(Math.min(1, p.dep), 1.5)) * (1 - fresh(p)) + p.tl * 2 + p.hair * 1.2) * ds / W0 * 8 * P.cuts;
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
    // how wet each part goes down: a loaded brush moving slowly is wet, a fast or empty one is dry
    const m = wetMap.getContext('2d'); m.globalCompositeOperation = 'lighten'; m.lineCap = 'round';
    for (let i = a; i < b; i++) {
      const p = S[i], q = S[i + 1], full = 1 - Math.min(1, p.dep), slow = 1 - Math.min(1, p.sp);
      const wl = Math.min(1, ((1 - P.wetLoad + P.wetLoad * full) * (1 - P.wetSlow + P.wetSlow * slow) + P.press * Math.exp(-p.s / (W0 * 1.2))) * (1 - p.tl) * (1 - p.hair) * (1 - 0.4 * dry));
      const gv = Math.round(255 * Math.pow(wl, 1.4)); if (gv < 4) continue;
      m.strokeStyle = `rgb(${gv},${gv},${gv})`; m.lineWidth = p.w * dpr; m.beginPath(); m.moveTo(p.x * dpr, p.y * dpr); m.lineTo(q.x * dpr, q.y * dpr); m.stroke();
    }
    m.globalCompositeOperation = 'source-over';
  }

  // ---------- the paper: one sheet, both for the pinholes the ink skips and for the fibres wet ink runs along ----------
  const PAPER = 512;
  const paper = (() => {
    const r = mulberry32(99), fibres = [];
    for (let i = 0; i < 2200; i++) {
      let x = r() * PAPER, y = r() * PAPER, a = r() * 6.283; const L = 8 + r() * 55, pts = [[x, y]];
      for (let j = 0; j < L; j += 4) { a += (r() - 0.5) * 0.4; x += Math.cos(a) * 4; y += Math.sin(a) * 4; pts.push([x, y]); }
      fibres.push({ pts, w: 0.6 + r() * 1.3, k: r() });
    }
    const line = (g, pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const q of pts) g.lineTo(q[0], q[1]); g.stroke(); };
    const tile = () => { const t = document.createElement('canvas'); t.width = t.height = PAPER; return [t, t.getContext('2d')]; };
    // pinholes: specks where the ink doesn't take, and the odd fibre that lifts it
    const [holes, h] = tile();
    for (let i = 0; i < 3200; i++) { h.globalAlpha = 0.3 + r() * 0.7; h.beginPath(); h.arc(r() * PAPER, r() * PAPER, 0.45 + r() * r() * 1.6, 0, 6.283); h.fill(); }
    h.globalAlpha = 0.5; h.lineWidth = 0.7; h.strokeStyle = '#000'; for (const f of fibres) if (f.k < 0.06) line(h, f.pts);
    // soak: the same fibres carry wet ink further than the sheet between them
    const [soak, k] = tile();
    k.fillStyle = 'rgb(70,70,70)'; k.fillRect(0, 0, PAPER, PAPER);
    for (const f of fibres) { k.strokeStyle = `rgba(255,255,255,${0.35 + f.k * 0.6})`; k.lineWidth = f.w; line(k, f.pts); }
    return { holes, soak };
  })();
  function grain(ctx, w, h) {
    if (P.grain <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = Math.min(1, P.grain * 0.85);
    ctx.fillStyle = ctx.createPattern(paper.holes, 'repeat'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillRect(0, 0, w, h); ctx.restore();
  }

  // ---------- wet ink: where the brush went down wet, ink creeps into the paper, closes the nearby streaks, then sets ----------
  // A full-resolution WebGL pass. Each pixel keeps the darker of itself and what a wet neighbour gives it, so ink only spreads, never thins.
  // Wetness comes from the wet map (the brush's load and speed), and the spread follows the same paper as the pinholes. No WebGL: no bleed.
  const wet = (() => {
    const cv = document.createElement('canvas');
    const gl = cv.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false, alpha: true });
    if (!gl) return null;
    const VS = 'attribute vec2 p; varying vec2 v; void main() { v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';
    const STEP = `precision highp float; varying vec2 v;
      uniform sampler2D uS, uI, uM, uP; uniform vec2 uPx, uPs, uPo; uniform float uAmt, uDecay, uReach, uPull;
      void main() {
        vec4 s = texture2D(uS, v); float ink = texture2D(uI, v).a, src = texture2D(uM, v).r * uAmt;
        float d = max(s.r, ink), w = max(s.g * uDecay, src > s.a + 0.01 ? src : 0.0);
        float paper = texture2D(uP, v * uPs + uPo).r;
        for (int k = 0; k < 8; k++) {
          float a = float(k) * 0.7853982; vec2 o = vec2(cos(a), sin(a)); o /= max(abs(o.x), abs(o.y));
          vec4 n = texture2D(uS, v + o * uPx);
          float give = n.r * n.g * uReach * (1.0 - uPull + uPull * paper * paper);
          if (give > d) { d = give; w = max(w, n.g * 0.94); }
        }
        gl_FragColor = vec4(d, w, max(s.b, ink), max(s.a, src));
      }`;
    const SHOW = `precision highp float; varying vec2 v; uniform sampler2D uS; uniform vec3 uFg;
      void main() { float a = smoothstep(0.3, 0.55, texture2D(uS, v).r); gl_FragColor = vec4(uFg * a, a); }`;   // ink in paper has an edge, not a glow
    const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    const prog = (fs) => {
      const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
      const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
      return { p, u };
    };
    let step, show;
    try { step = prog(STEP); show = prog(SHOW); } catch (e) { return null; }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const tex = (w, h, src, repeat) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, !!src);
      if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      return t;
    };
    const soak = tex(PAPER, PAPER, paper.soak, true);
    let W = 1, H = 1, S = [], F = [], cur = 0, inkT = null, mapT = null;
    const put = (t, src) => { gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); };
    return {
      canvas: cv, active: 0,
      reset(w, h) {
        W = cv.width = Math.max(1, w); H = cv.height = Math.max(1, h);
        for (const t of [...S, inkT, mapT]) if (t) gl.deleteTexture(t); for (const f of F) gl.deleteFramebuffer(f);
        S = [tex(W, H), tex(W, H)]; F = S.map((t) => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); return f; });
        inkT = tex(W, H); mapT = tex(W, H); cur = 0; this.active = 0;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      },
      upload(inkSrc, mapSrc) { put(inkT, inkSrc); put(mapT, mapSrc); },
      run(n, amount) {
        gl.viewport(0, 0, W, H); gl.useProgram(step.p); const u = step.u;
        gl.uniform1i(u.uS, 0); gl.uniform1i(u.uI, 1); gl.uniform1i(u.uM, 2); gl.uniform1i(u.uP, 3);
        gl.uniform2f(u.uPx, 1 / W, 1 / H); gl.uniform2f(u.uPs, W / PAPER, H / PAPER); gl.uniform2f(u.uPo, 0, -H / PAPER);
        gl.uniform1f(u.uAmt, amount); gl.uniform1f(u.uDecay, 0.9 + 0.095 * P.wetTime); gl.uniform1f(u.uReach, 0.9 + 0.095 * P.reach); gl.uniform1f(u.uPull, P.pull);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, inkT);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, mapT);
        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, soak);
        for (let i = 0; i < n; i++) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, F[1 - cur]); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, S[cur]);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); cur = 1 - cur;
        }
      },
      draw(f) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.useProgram(show.p);
        gl.uniform1i(show.u.uS, 0); gl.uniform3f(show.u.uFg, f[0], f[1], f[2]);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, S[cur]);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
      destroy() { const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); cv.width = cv.height = 0; },
    };
  })();
  const wetOn = () => wet && P.wetAmt > 0;

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
    v.globalCompositeOperation = 'source-over'; v.clearRect(0, 0, view.width, view.height);
    if (wetOn()) v.drawImage(wet.canvas, 0, 0, view.width, view.height);
    v.drawImage(ink, 0, 0); grain(v, view.width, view.height);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, stage.pw, stage.ph);
    c.drawImage(typ, 0, 0);
    c.globalCompositeOperation = P.overlap ? 'xor' : 'source-over'; c.drawImage(view, 0, 0);
    c.globalCompositeOperation = 'destination-over'; c.fillStyle = bg; c.fillRect(0, 0, stage.pw, stage.ph);
    c.globalCompositeOperation = 'source-over';
  }
  const inkCtx = () => { const x = ink.getContext('2d'); x.strokeStyle = fg; x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = Math.max(0.6, C.W0 * dpr / Nb * 1.7); return x; };
  // time to cross one sample: slow through turns, quick on straight runs and through flicks and hairlines. Over the whole stroke the
  // hand eases in from the press, peaks mid-stroke and eases out into a blunt stop (a flick keeps its speed); long strokes run faster
  // than short ones, and each stroke has its own tempo
  const cost = (st, i) => {
    const p = st.S[i], u = st.L > 0 ? p.s / st.L : 0.5, k = st.blunt || u < 0.5 ? 16 * u * u * (1 - u) * (1 - u) : 1;
    return st.ds / (P.speed * C.e * st.tempo * (1 - 0.78 * P.ease * (1 - k)) * (1 + 0.45 * P.ease) * (0.3 + 1.2 * p.sp) * (1 + p.tl * 1.6 + p.hair * 0.9));
  };
  // between strokes the brush lifts and travels through the air; a new letter takes a breath
  const gap = (st, nx) => {
    const a = st.S[st.S.length - 1], b = nx.S[0], air = Math.hypot(b.x - a.x, b.y - a.y);
    return (0.05 + air / (P.speed * C.e * 2.4)) * P.lift * nx.breath + (nx.letter !== st.letter ? P.breath * nx.breath : 0);
  };
  function build(live) {
    const W = stage.W, H = stage.H; dpr = stage.pw / W;
    for (const cv of [ink, typ, view]) { cv.width = stage.pw; cv.height = stage.ph; }
    const rng = mulberry32(P.seed * 9973 + albumIx() * 131 + P.face * 7);
    C = compose(P, title(), rng, W, H);
    Nb = Math.round(Math.max(40, Math.min(170, C.W0 * dpr / 1.3)));
    list = [];
    for (const mv of C.moves) {
      if (lenOf(mv.pts) < 2) continue;
      const { S, blunt, ds } = shape(mv, C, P); if (S.length < 2) continue;
      const st = brushFor(S, blunt, ds, rng, C.W0); st.letter = mv.letter; list.push(st);
    }
    { // pacing, from its own seed so the strokes keep their look
      const pr = mulberry32(P.seed * 31 + 7), Ls = list.map((st) => st.S[st.S.length - 1].s).sort((a, b) => a - b), mid = Ls[Ls.length >> 1] || 1;
      for (const st of list) { st.L = st.S[st.S.length - 1].s; st.tempo = Math.min(1.6, Math.max(0.6, Math.pow(st.L / mid, P.lenFast))) * (1 + (pr() - 0.5) * P.rhythm); st.breath = 1 + (pr() - 0.5) * P.rhythm * 2; }
    }
    // ink carriage: how full the brush starts, and when it goes back to the inkstone (0 every stroke, 1 every letter, 2 once for the title)
    let carry = 0, lastLetter = -1;
    for (const st of list) {
      if (P.redip === 0 || (P.redip === 1 && st.letter !== lastLetter)) carry = 0;
      lastLetter = st.letter;
      for (const p of st.S) p.dep = Math.max(0, Math.min(1.3, carry + p.use - (P.load - 1)));
      carry += st.S[st.S.length - 1].use;
    }
    user = null;
    { const m = wetMap.getContext('2d'); wetMap.width = ink.width; wetMap.height = ink.height; m.fillStyle = '#000'; m.fillRect(0, 0, wetMap.width, wetMap.height); }
    if (wet) wet.reset(ink.width, ink.height);
    if (songs()) paintType(typ.getContext('2d'), W, H);
    if (live && !stage.reduced) writer = { list, k: 0, i: 0, acc: 0, pause: 0.35 };
    else {
      writer = null; const x = inkCtx(); for (const st of list) paintRange(x, st, 0, st.S.length - 1, true);
      if (wetOn()) { wet.upload(ink, wetMap); wet.run(90, P.wetAmt); wet.draw(stage.colors.fg); }
    }
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
      S.push({ x: p.x + ux * st.ds, y: p.y + uy * st.ds, tx: tx / tl, ty: ty / tl, w, s, dep: Math.min(1.3, p.dep + st.ds / (e * 1.3 * P.runout) * (0.35 + sp * P.speedDry)), hair: 0, tl: 0, sp });
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
      const S = [{ x: ptr.sx, y: ptr.sy, tx: ux / ul, ty: uy / ul, w: C.W0 * 1.25, s: 0, dep: Math.max(0, 1 - P.load), hair: 0, tl: 0, sp: 0 }];
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
    if (C) titleBlock(x, W, H, ['GYOSHO', `${list.length} movements`, `${Nb} bristles`, `${FACES[P.face] ? FACES[P.face].family : ''} centre line`, `flow ${P.flow}  dry ${P.dry}`, wet ? `wet ${P.wetAmt}  reach ${P.reach}` : 'no WebGL: no bleed'], col, k);
  });

  // ---------- settings ----------
  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  const tune = {
    title: 'Gyosho', values: P, defaults: DEF, persist: true,
    groups: [
      { name: 'Words', items: [Ctl('album', 'Album (-1 follows the words)', -1, ALBUMS.length - 1, 1), Ctl('face', 'Letters from (0 sans, 1 Caveat, 2 monoline)', 0, FACES.length - 1, 1), { key: 'type', label: 'Song names underneath', type: 'toggle' }, { key: 'overlap', label: 'Ink knocks out the type', type: 'toggle' }] },
      { name: 'Hand', items: [Ctl('brush', 'Brush width', 0.4, 2.2, 0.05), Ctl('exag', 'Movement', 0, 1.6, 0.05), Ctl('flow', 'Flow (strokes run together)', 0, 1, 0.05), Ctl('speed', 'Writing speed', 0.5, 8, 0.1)] },
      { name: 'Pace', items: [Ctl('ease', 'Ease (slow press and stop)', 0, 1.2, 0.05), Ctl('lenFast', 'Long strokes run faster', 0, 1, 0.05), Ctl('rhythm', 'Rhythm (tempo varies)', 0, 0.9, 0.05), Ctl('lift', 'Lift (time in the air)', 0, 3, 0.05), Ctl('breath', 'Breath before a letter', 0, 0.8, 0.02)] },
      { name: 'Ink', items: [Ctl('dry', 'Dry brush', 0, 2, 0.05), Ctl('grain', 'Paper grain', 0, 1, 0.05)] },
      { name: 'Ink carriage', items: [Ctl('load', 'Ink on the brush', 0.2, 2, 0.05), Ctl('runout', 'How far a load lasts', 0.3, 3, 0.05), Ctl('speedDry', 'Speed dries the brush', 0, 2.5, 0.05), Ctl('redip', 'Back to the inkstone (0 every stroke, 1 every letter, 2 once)', 0, 2, 1), Ctl('empty', 'Streaks as it empties', 0, 2, 0.05), Ctl('edgeDry', 'Edges dry first', 0, 3, 0.05), Ctl('cuts', 'White fibre streaks', 0, 3, 0.05)] },
      { name: 'Wet', items: [Ctl('wetAmt', 'Wet ink', 0, 1, 0.05), Ctl('wetLoad', 'Wet follows the load', 0, 1, 0.05), Ctl('wetSlow', 'Wet follows slowness', 0, 1, 0.05), Ctl('press', 'Wet press at the start', 0, 1.5, 0.05), Ctl('reach', 'How far it bleeds', 0, 1, 0.02), Ctl('wetTime', 'How long it stays wet', 0, 1, 0.02), Ctl('pull', 'Paper fibres pull the ink', 0, 1, 0.05)] },
    ],
    actions: {
      'Write it again': rewrite,
      'Next album': () => { P.album = (albumIx() + 1) % ALBUMS.length; P.seed = (Math.random() * 1e6) | 0; build(true); },
    },
    async set(key, v) {
      P[key] = key === 'album' || key === 'face' || key === 'redip' ? Math.round(v) : v;
      if (key === 'face') await loadFace(FACES[P.face], letters);
      if (!alive) return;
      if (key === 'overlap' || key === 'grain') { dirty = true; return; }
      clearTimeout(soonT); soonT = later(() => build(key === 'album' || key === 'face' || PACE.includes(key)), key === 'speed' || PACE.includes(key) ? 400 : 90);   // pace shows only while writing, so it writes again
    },
    reset() { Object.assign(P, DEF, SAVED); build(false); },
  };
  let soonT = 0;
  const PACE = ['ease', 'lenFast', 'rhythm', 'lift', 'breath'];

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
      if (i >= n - 1) { writer.k++; writer.i = 0; budget = writer.acc; writer.acc = 0; const nx = writer.list[writer.k]; writer.pause = nx ? gap(st, nx) : 0; }
    }
    if (user && user.st.S.length - 1 > user.done) { const b = user.st.S.length - 1; paintRange(inkCtx(), user.st, user.done, b, false); user.done = b; dirty = true; }
    // the wet ink spreads for a couple of seconds after each new ink, then sets (under reduced motion it settles at once)
    if (wetOn()) {
      if (dirty) { wet.upload(ink, wetMap); wet.active = 150; }
      if (wet.active > 0) { const n = stage.reduced ? Math.min(wet.active, 90) : 1; wet.active -= stage.reduced ? wet.active : 1; wet.run(n, P.wetAmt); wet.draw(stage.colors.fg); dirty = true; }
    }
    if (dirty) { dirty = false; present(); }
    rv.draw(performance.now());
  }));

  return {
    tune,
    debug: { get writing() { return !!writer; }, get moves() { return list.length; }, finish() { while (writer) { const st = writer.list[writer.k]; if (!st) { writer = null; break; } paintRange(inkCtx(), st, writer.i, st.S.length - 1, true); writer.k++; writer.i = 0; } dirty = true; }, dark },
    destroy() {
      alive = false; timers.forEach(clearTimeout);
      rv.destroy(); offs.forEach((f) => f()); links.forEach((l) => l.remove());
      for (const cv of [ink, typ, view, scratch, wetMap]) { cv.width = cv.height = 0; }
      if (wet) wet.destroy();
      writer = user = null;
    },
  };
}
