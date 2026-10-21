// Rigged: the name as cloth, held by a sparse rig drawn like a page of Leonardo's mechanical studies. Only the outer corners of
// each letter are rigged and every rope runs straight up or straight down: a corner facing up is hoisted over a pulley on a rail
// above the line to a counterweight that rests on a small ledge (the ledge is what holds the corner exactly); a corner facing
// down carries a plumb bob that swings. The rig is drawn pale, behind the cloth, so a rope vanishes behind a letter.
//
// Under the picture: each letter is a triangle mesh cut from the glyph and stepped by a position-based solver in 3D, so spare
// cloth folds out of the page; long weak ties across each letter (hidden battens) keep its shape between the few rigged corners.
// The cloth is drawn with WebGL on an offscreen canvas and laid over the rig on the stage canvas (2D), so one canvas holds the picture.
//
// gestures: tap = cut the nearest rope (it is tied again and reeled in after a pause); hold or drag = pull the cloth against the
// weights; double tap = tie every rope now (REFORM_DELAY_MS after, so a third tap can still mean reveal). Intro: the ropes start
// slack and the rig hoists the name once (off under reduced motion). Colour: the framework's colour pass, on the first press.

import { createReveal, corners, titleBlock, ink as rvInk } from './reveal.js';
import { pressTracker, TAP, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';

// The face: Alfa Slab One (open licence, from Google Fonts), loaded before the first layout; a slab serif stands in if it does not arrive.
const FACE = new URLSearchParams(location.search).get('font') || 'Alfa Slab One';
{
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(FACE).replace(/%20/g, '+')}&display=swap`;
  await new Promise((r) => { l.onload = r; l.onerror = r; setTimeout(r, 2500); document.head.appendChild(l); });
  try { await Promise.race([document.fonts.load(`400 100px "${FACE}"`, 'IDANSEGV'), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* the stand-in */ }
}
const FONT = (px) => `400 ${px}px "${FACE}", Rockwell, "Arial Black", serif`;

// Idan's tuned values (21 Oct 2026)
const DEF = { counter: 2.25, plumb: 0.075, slack: 0.97, corner: 0.95, bend: 0.26, brace: 0.25, grav: 1400, reel: 240, hold: 1.6, detail: 4700, sheen: 0.1, tone: 0.15 };
const STRUCT = new Set(['counter', 'plumb', 'slack', 'corner', 'brace', 'detail']);

const VS = `attribute vec3 p; attribute vec3 n; uniform vec2 res; varying vec3 vn;
void main(){ vn = n; gl_Position = vec4(p.x / res.x * 2. - 1., 1. - p.y / res.y * 2., clamp(-p.z / 4000., -1., 1.), 1.); }`;
const FS = `precision mediump float; varying vec3 vn; uniform vec3 ink, page; uniform float dark, amt; uniform vec2 L;
void main(){
  vec3 n = normalize(vn); if (n.z < 0.) n = -n;
  float v = dot(n.xy, L);
  float t = (dark > .5 ? max(0., -v) : max(0., v)) * .9 + (1. - n.z) * .35;
  gl_FragColor = vec4(mix(ink, page, clamp(t * amt, 0., 1.) * .72), 1.);
}`;

const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export async function mount(stage) {
  const dark = stage.theme.name === 'dark';
  const P = { ...DEF };
  const fg = stage.colors.fg, bg = stage.colors.bg;
  const css = (c, a = 1) => `rgba(${c[0] * 255 | 0},${c[1] * 255 | 0},${c[2] * 255 | 0},${a})`;
  stage.setBackdrop(dark ? 0 : 1);
  const offs = [], timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  let alive = true, clock = 0;                                       // clock: simulation time in ms (cuts are tied again on it)

  // ---------- canvases: the stage canvas holds the picture (the page, the rig, then the cloth from an offscreen WebGL canvas on top) ----------
  const rx = stage.canvas.getContext('2d');
  const glc = document.createElement('canvas'); glc.width = stage.pw; glc.height = stage.ph;
  const gl = glc.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, depth: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error('webgl2 unavailable');
  const prog = gl.createProgram();
  for (const [t, s] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]]) { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); gl.attachShader(prog, x); }
  gl.linkProgram(prog); gl.useProgram(prog);
  const aP = gl.getAttribLocation(prog, 'p'), aN = gl.getAttribLocation(prog, 'n');
  const U = (n) => gl.getUniformLocation(prog, n), uRes = U('res'), uInk = U('ink'), uPage = U('page'), uDark = U('dark'), uAmt = U('amt'), uL = U('L');
  const bufP = gl.createBuffer(), bufN = gl.createBuffer(), bufI = gl.createBuffer();
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);

  // ---------- the cloth and the rig ----------
  let W = stage.W, H = stage.H, N = 0, X, Y, Z, PX, PY, PZ, IM, HX, HY, LAB, CA, CB, CR, CK, NC = 0, TRI, NRM, POS;
  let hoists = [], plumbs = [], rails = [], capH = 100, s = 8, rp = 4, letters = [], ready = false, grab = null, queue = [];

  function build() {
    ready = false; W = stage.W; H = stage.H;
    const w = Math.ceil(W), h = Math.ceil(H), m = document.createElement('canvas'); m.width = w; m.height = h;
    const x = m.getContext('2d', { willReadFrequently: true });
    const portrait = W / H < 0.8, lines = portrait ? ['IDAN', 'SE', 'GEV'] : ['IDAN', 'SEGEV'], TR = 0.1;
    x.font = FONT(100);
    const adv = {}; for (const ch of 'IDANSEGV') adv[ch] = x.measureText(ch).width / 100;
    const lw = (l, sz) => [...l].reduce((a, ch) => a + adv[ch] * sz, 0) + TR * sz * (l.length - 1);
    const cap = x.measureText('H').actualBoundingBoxAscent / 100 || 0.72;
    let size = Math.min(...lines.map((l) => W * 0.8 / lw(l, 1)));
    const lead = 1.85, total = (sz) => cap * sz * (1 + (lines.length - 1) * lead + 0.75);
    if (total(size) > H * 0.78) size *= H * 0.78 / total(size);
    capH = cap * size; rp = Math.max(3, capH * 0.032);
    x.font = FONT(size); x.textBaseline = 'alphabetic';
    const base0 = (H - total(size)) / 2 + capH * 1.6 - H * 0.03;
    let li = 0; letters = []; rails = [];
    const lineOf = [];
    lines.forEach((l, k) => {
      let cx = (W - lw(l, size)) / 2; const by = base0 + k * capH * lead;
      rails.push({ y: by - capH * 1.42, x0: 1e9, x1: -1e9 });
      for (const ch of l) { x.fillStyle = `rgb(${(li + 1) * 20},0,0)`; x.fillText(ch, cx, by); letters.push(ch); lineOf.push(k); cx += adv[ch] * size + TR * size; li++; }
    });
    const d = x.getImageData(0, 0, w, h).data, A = new Uint8Array(w * h), Lb = new Int8Array(w * h).fill(-1);
    let area = 0, bx0 = w, by0 = h, bx1 = 0, by1 = 0;
    for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] > 110) {
      A[i] = 1; Lb[i] = Math.round(d[i * 4] / 20) - 1; area++;
      const px = i % w, py = (i / w) | 0; if (px < bx0) bx0 = px; if (px > bx1) bx1 = px; if (py < by0) by0 = py; if (py > by1) by1 = py;
    }
    if (!area) return;
    const ins = (px, py) => { px |= 0; py |= 0; return px >= 0 && py >= 0 && px < w && py < h && A[py * w + px] === 1; };
    const lab = (px, py) => Lb[(py | 0) * w + (px | 0)];
    const insTol = (px, py, l) => { for (const [ox, oy] of [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) if (ins(px + ox, py + oy) && lab(px + ox, py + oy) === l) return true; return false; };
    s = Math.sqrt(area / P.detail);
    // a grid over the ink: inside points stay, points just outside snap onto the nearest ink pixel, so the mesh edge follows the outline
    const gx0 = bx0 - s, gy0 = by0 - s, cols = Math.ceil((bx1 - bx0) / s) + 3, rows = Math.ceil((by1 - by0) / s) + 3;
    const gid = new Int32Array(cols * rows).fill(-1), nx = [], ny = [], nl = [], rr = Math.ceil(s * 0.72);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      let px = gx0 + i * s, py = gy0 + j * s;
      if (!ins(px, py)) {
        let best = 1e9, bx = 0, by = 0;
        for (let oy = -rr; oy <= rr; oy++) for (let ox = -rr; ox <= rr; ox++) { const q = ox * ox + oy * oy; if (q < best && q <= rr * rr && ins(px + ox, py + oy)) { best = q; bx = (px | 0) + ox + 0.5; by = (py | 0) + oy + 0.5; } }
        if (best === 1e9) continue; px = bx; py = by;
      }
      gid[j * cols + i] = nx.length; nx.push(px); ny.push(py); nl.push(lab(px, py));
    }
    const tris = [];
    const tryTri = (a, b, c) => {
      if (a < 0 || b < 0 || c < 0 || nl[a] !== nl[b] || nl[a] !== nl[c] || nl[a] < 0) return;
      const ar = Math.abs((nx[b] - nx[a]) * (ny[c] - ny[a]) - (nx[c] - nx[a]) * (ny[b] - ny[a])) / 2;
      if (ar < 0.12 * s * s) return;
      const l = nl[a], mid = (p, q) => insTol((nx[p] + nx[q]) / 2, (ny[p] + ny[q]) / 2, l);
      if (!insTol((nx[a] + nx[b] + nx[c]) / 3, (ny[a] + ny[b] + ny[c]) / 3, l) || !mid(a, b) || !mid(b, c) || !mid(a, c)) return;
      tris.push(a, b, c);
    };
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
      const a = gid[j * cols + i], b = gid[j * cols + i + 1], c = gid[(j + 1) * cols + i], e = gid[(j + 1) * cols + i + 1];
      if ((i + j) & 1) { tryTri(a, b, e); tryTri(a, e, c); } else { tryTri(a, b, c); tryTri(b, e, c); }
    }
    const used = new Int32Array(nx.length).fill(-1); let n = 0;
    for (const v of tris) if (used[v] < 0) used[v] = n++;
    N = n; X = new Float32Array(N); Y = new Float32Array(N); Z = new Float32Array(N); PX = new Float32Array(N); PY = new Float32Array(N); PZ = new Float32Array(N);
    IM = new Float32Array(N).fill(1); HX = new Float32Array(N); HY = new Float32Array(N); LAB = new Int8Array(N);
    const rz = mulberry(3);
    for (let i = 0; i < nx.length; i++) if (used[i] >= 0) { const k = used[i]; HX[k] = X[k] = PX[k] = nx[i]; HY[k] = Y[k] = PY[k] = ny[i]; LAB[k] = nl[i]; Z[k] = PZ[k] = (rz() - 0.5) * 0.6; }
    TRI = new Uint16Array(tris.map((v) => used[v]));
    // threads: every triangle edge; across each shared edge the two far corners (folding); and the hidden battens
    const em = new Map(), key = (a, b) => (a < b ? a * 65536 + b : b * 65536 + a);
    for (let t = 0; t < TRI.length; t += 3) for (let e = 0; e < 3; e++) {
      const a = TRI[t + e], b = TRI[t + (e + 1) % 3], o = TRI[t + (e + 2) % 3], k = key(a, b);
      const r = em.get(k); if (r) r.opp.push(o); else em.set(k, { a, b, opp: [o] });
    }
    const ca = [], cb = [], ck = [];
    for (const r of em.values()) { ca.push(r.a); cb.push(r.b); ck.push(1); if (r.opp.length === 2) { ca.push(r.opp[0]); cb.push(r.opp[1]); ck.push(-1); } }
    if (P.brace > 0) {                                                // long, weak ties between points a third to two thirds of a cap height apart, like battens in a sail
      const byL = letters.map(() => []); for (let i = 0; i < N; i++) byL[LAB[i]].push(i);
      const rnd = mulberry(11), lo = capH * 0.3, hi = capH * 0.75;
      for (const list of byL) for (const i of list) for (let tries = 0; tries < 8; tries++) {
        const j = list[(rnd() * list.length) | 0]; if (j <= i) continue;
        const dd = Math.hypot(HX[j] - HX[i], HY[j] - HY[i]); if (dd < lo || dd > hi) continue;
        ca.push(i); cb.push(j); ck.push(-2); break;
      }
    }
    NC = ca.length; CA = new Uint16Array(ca); CB = new Uint16Array(cb); CK = new Float32Array(ck); CR = new Float32Array(NC);
    for (let c = 0; c < NC; c++) CR[c] = Math.hypot(HX[CB[c]] - HX[CA[c]], HY[CB[c]] - HY[CA[c]]) * P.slack;
    // the outline loops
    const badj = new Map();
    for (const r of em.values()) if (r.opp.length === 1) for (const [p, q] of [[r.a, r.b], [r.b, r.a]]) { if (!badj.has(p)) badj.set(p, []); badj.get(p).push(q); }
    const seen = new Set(), loops = [];
    for (const [v0, nb] of badj) for (const v1 of nb) {
      if (seen.has(key(v0, v1))) continue;
      const loop = [v0]; let prev = v0, cur = v1; seen.add(key(v0, v1));
      while (cur !== v0 && loop.length < 20000) {
        loop.push(cur);
        const nxt = (badj.get(cur) || []).find((q) => q !== prev && !seen.has(key(cur, q)));
        if (nxt === undefined) break; seen.add(key(cur, nxt)); prev = cur; cur = nxt;
      }
      if (loop.length > 6) loops.push(loop);
    }
    // the rig: on each letter's outer loop, its outermost top and bottom points and its sharp convex corners
    hoists = []; plumbs = [];
    const kW = Math.max(2, Math.round(capH * 0.05 / s)), mB = Math.max(1, Math.round(capH * 0.03 / s));
    const counts = letters.map(() => 0); for (let i = 0; i < N; i++) counts[LAB[i]]++;
    for (let l = 0; l < letters.length; l++) {
      const mine = loops.filter((lp) => LAB[lp[0]] === l); if (!mine.length) continue;
      const span = (lp) => { let a = 1e9, b = -1e9, c = 1e9, e = -1e9; for (const v of lp) { a = Math.min(a, HX[v]); b = Math.max(b, HX[v]); c = Math.min(c, HY[v]); e = Math.max(e, HY[v]); } return (b - a) * (e - c); };
      const loop = mine.sort((p, q) => span(q) - span(p))[0], L = loop.length, at = (i) => loop[(i % L + L) % L];
      const sc = loop.map((v, i) => {
        const a = at(i - kW), c = at(i + kW);
        const a1 = Math.atan2(HY[v] - HY[a], HX[v] - HX[a]), a2 = Math.atan2(HY[c] - HY[v], HX[c] - HX[v]);
        let t = a2 - a1; while (t > Math.PI) t -= 2 * Math.PI; while (t < -Math.PI) t += 2 * Math.PI;
        return ins((HX[a] + HX[c]) / 2, (HY[a] + HY[c]) / 2) ? Math.abs(t) : 0;   // convex corners only
      });
      const cand = [];
      for (let i = 0; i < L; i++) {
        if (sc[i] < P.corner) continue;
        let peak = true; for (let j = -kW; j <= kW; j++) if (j && sc[(i + j + L) % L] > sc[i]) { peak = false; break; }
        if (!peak) continue;
        const v = loop[i], a = at(i - kW), c = at(i + kW), ox = HX[v] - (HX[a] + HX[c]) / 2, oy = HY[v] - (HY[a] + HY[c]) / 2, ol = Math.hypot(ox, oy) || 1;
        cand.push({ i, v, ny: oy / ol, score: sc[i] });
      }
      const take = (list) => { const out = []; for (const c of list.sort((p, q) => q.score - p.score)) if (!out.some((o) => Math.hypot(HX[o.v] - HX[c.v], HY[o.v] - HY[c.v]) < capH * 0.16)) out.push(c); return out; };
      // a plumb only where it hangs clear of the letter (a hoist may run behind an arm above it: the cloth hides it)
      const clear = (v, dir) => { for (let yy = HY[v] + dir * s * 1.5; yy > 0 && yy < H; yy += dir * 2) if (ins(HX[v], yy) && lab(HX[v], yy) === l) return false; return true; };
      const ends = (dir) => {
        let ext = dir < 0 ? 1e9 : -1e9; for (const v of loop) ext = dir < 0 ? Math.min(ext, HY[v]) : Math.max(ext, HY[v]);
        const band = loop.map((v, i) => ({ v, i })).filter((o) => Math.abs(HY[o.v] - ext) < capH * 0.06).sort((p, q) => HX[p.v] - HX[q.v]);
        const a = band[0], b = band[band.length - 1], out = [{ i: a.i, v: a.v, score: 9 }];
        if (HX[b.v] - HX[a.v] > capH * 0.2) out.push({ i: b.i, v: b.v, score: 9 });
        return out;
      };
      const up = take([...ends(-1), ...cand.filter((c) => c.ny < -0.25)]);
      const dn = take([...ends(1), ...cand.filter((c) => c.ny > 0.25 && clear(c.v, 1))]);
      const bridle = (c) => { const vs = []; for (let j = -mB; j <= mB; j++) vs.push(at(c.i + j)); return vs; };
      const rail = rails[lineOf[l]];
      for (const c of up) {
        const vs = bridle(c), px = HX[c.v] + rp, py = rail.y, ws = capH * 0.34;
        rail.x0 = Math.min(rail.x0, px); rail.x1 = Math.max(rail.x1, px);
        hoists.push({ v: c.v, vs, L0s: new Float32Array(vs.map((v) => Math.hypot(HX[v] - px, HY[v] - py) + ws)), px, py, ws, w: ws, wp: ws, extra: 0, on: true, m: 1, label: l, ang: 0 });
      }
      for (const c of dn) {
        const vs = bridle(c), Lp = capH * 0.2;
        plumbs.push({ v: c.v, vs, len: new Float32Array(vs.map((v) => Math.hypot(HX[v] - HX[c.v], HY[v] - (HY[c.v] + Lp)))), x: HX[c.v], y: HY[c.v] + Lp, xp: HX[c.v], yp: HY[c.v] + Lp, on: true, m: 1, label: l });
      }
      // the plumbs a share of the letter's weight; the counterweights enough to lift letter and plumbs together
      const myP = plumbs.filter((p) => p.label === l), myH = hoists.filter((t) => t.label === l);
      for (const p of myP) p.m = Math.max(1, counts[l] * P.plumb);
      const load = counts[l] + myP.reduce((a, p) => a + p.m, 0);
      for (const t of myH) t.m = P.counter * load / myH.length;
    }
    POS = new Float32Array(N * 3); NRM = new Float32Array(N * 3);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufI); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, TRI, gl.STATIC_DRAW);
    queue = []; grab = null; ready = true;
  }

  // ---------- the solver ----------
  function sim(dt) {
    const SUB = 4, ITER = 3, h = dt / SUB, g = P.grav * h * h, damp = 0.993, floor = H - 3, wMin = rp * 1.2, stop = capH * 0.04;
    for (let sI = 0; sI < SUB; sI++) {
      for (let i = 0; i < N; i++) {
        if (IM[i] === 0) continue;
        const vx = (X[i] - PX[i]) * damp, vy = (Y[i] - PY[i]) * damp, vz = (Z[i] - PZ[i]) * damp;
        PX[i] = X[i]; PY[i] = Y[i]; PZ[i] = Z[i]; X[i] += vx; Y[i] += vy + g; Z[i] += vz;
      }
      for (const t of hoists) {                                         // the counterweight falls until its ledge stops it
        const v = (t.w - t.wp) * 0.99; t.wp = t.w; t.w += v + g;
        if (t.extra > 0) t.extra = Math.max(0, t.extra - P.reel * h);
      }
      for (const p of plumbs) { const vx = (p.x - p.xp) * 0.997, vy = (p.y - p.yp) * 0.997; p.xp = p.x; p.yp = p.y; p.x += vx; p.y += vy + g; }
      for (let it = 0; it < ITER; it++) {
        for (let c = 0; c < NC; c++) {
          const a = CA[c], b = CB[c], wa = IM[a], wb = IM[b], ws = wa + wb; if (!ws) continue;
          const k = CK[c] === -2 ? P.brace : CK[c] < 0 ? P.bend : 1;
          const dx = X[b] - X[a], dy = Y[b] - Y[a], dz = Z[b] - Z[a], d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d < 1e-6) continue;
          const f = (d - CR[c]) / (d * ws) * k;
          X[a] += dx * f * wa; Y[a] += dy * f * wa; Z[a] += dz * f * wa; X[b] -= dx * f * wb; Y[b] -= dy * f * wb; Z[b] -= dz * f * wb;
        }
        for (const t of hoists) {                                       // one rope: cloth to pulley plus pulley to weight is one length
          if (t.on) for (let k = 0; k < t.vs.length; k++) {
            const v = t.vs[k], dx = X[v] - t.px, dy = Y[v] - t.py, d = Math.hypot(dx, dy) || 1;
            const C = d + t.w - (t.L0s[k] + t.extra);
            if (C < -stop && IM[v] && !t.extra) { X[v] -= dx / d * (C + stop); Y[v] -= dy / d * (C + stop); continue; }   // a knot stops the cloth riding up into the pulley
            if (C <= 0) continue;
            const wn = IM[v], ww = t.w > wMin ? 1 / t.m : 0, sum = wn + ww; if (!sum) continue;
            const lam = C / sum; X[v] -= dx / d * lam * wn; Y[v] -= dy / d * lam * wn; t.w -= lam * ww;
          }
          if (t.w > t.ws) { t.w = t.ws; t.wp = Math.max(t.wp, t.w); }   // resting on its ledge
          if (t.w < wMin) { t.w = wMin; t.wp = t.w; }                     // jammed against the pulley
        }
        for (const p of plumbs) {
          if (!p.on) continue;
          for (let k = 0; k < p.vs.length; k++) {
            const v = p.vs[k], dx = p.x - X[v], dy = p.y - Y[v], d = Math.hypot(dx, dy) || 1, C = d - p.len[k]; if (C <= 0) continue;
            const wn = IM[v], wb = 1 / p.m, lam = C / (wn + wb);
            X[v] += dx / d * lam * wn; Y[v] += dy / d * lam * wn; p.x -= dx / d * lam * wb; p.y -= dy / d * lam * wb;
          }
        }
        if (grab) for (const g2 of grab.nodes) { X[g2.i] += (grab.x + g2.ox - X[g2.i]) * 0.3; Y[g2.i] += (grab.y + g2.oy - Y[g2.i]) * 0.3; }   // a hand, not a clamp
      }
      for (let i = 0; i < N; i++) if (Y[i] > floor) { Y[i] = floor; PX[i] += (X[i] - PX[i]) * 0.5; }
    }
    for (const t of hoists) t.ang = Math.hypot(X[t.v] - t.px, Y[t.v] - t.py) / rp;
    clock += dt * 1000;
    for (let k = queue.length - 1; k >= 0; k--) if (queue[k].at <= clock) { tie(queue[k].r); queue.splice(k, 1); }
  }

  // ---------- cutting and tying ----------
  function cutRope(r) {
    if (!r || !r.on) return; r.on = false;
    if (r.ws === undefined) r.xp = r.x - (stage.rand() - 0.5) * 2;    // a cut plumb just falls
    queue = queue.filter((q) => q.r !== r); queue.push({ r, at: clock + P.hold * 1000 });
  }
  function tie(r) {
    if (r.on) return; r.on = true;
    if (r.ws !== undefined) { let ex = 0; r.vs.forEach((v, k) => { ex = Math.max(ex, Math.hypot(X[v] - r.px, Y[v] - r.py) + r.w - r.L0s[k]); }); r.extra = ex; }   // reel the slack in
    else { r.x = r.xp = X[r.v]; r.y = r.yp = Y[r.v] + rp; }          // a new bob is hung on and drops
  }
  function tieAll() { [...hoists].sort((a, b) => a.px - b.px).forEach((r, k) => { const q = queue.find((o) => o.r === r); if (q) q.at = clock + k * 40; }); queue.forEach((q) => { if (q.r.ws === undefined) q.at = clock + 300; }); }

  // ---------- drawing ----------
  function render() {
    NRM.fill(0);
    for (let t = 0; t < TRI.length; t += 3) {
      const a = TRI[t], b = TRI[t + 1], c = TRI[t + 2];
      const ux = X[b] - X[a], uy = Y[b] - Y[a], uz = Z[b] - Z[a], vx = X[c] - X[a], vy = Y[c] - Y[a], vz = Z[c] - Z[a];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      NRM[a * 3] += nx; NRM[a * 3 + 1] += ny; NRM[a * 3 + 2] += nz; NRM[b * 3] += nx; NRM[b * 3 + 1] += ny; NRM[b * 3 + 2] += nz; NRM[c * 3] += nx; NRM[c * 3 + 1] += ny; NRM[c * 3 + 2] += nz;
    }
    for (let i = 0; i < N; i++) { POS[i * 3] = X[i]; POS[i * 3 + 1] = Y[i]; POS[i * 3 + 2] = Z[i]; }
    if (glc.width !== stage.pw || glc.height !== stage.ph) { glc.width = stage.pw; glc.height = stage.ph; }
    gl.viewport(0, 0, stage.pw, stage.ph);
    gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufP); gl.bufferData(gl.ARRAY_BUFFER, POS, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufN); gl.bufferData(gl.ARRAY_BUFFER, NRM, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(aN); gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufI);
    gl.uniform2f(uRes, W, H); gl.uniform3fv(uInk, fg); gl.uniform3fv(uPage, bg); gl.uniform1f(uDark, dark ? 1 : 0); gl.uniform1f(uAmt, P.sheen); gl.uniform2f(uL, -0.6, -0.8);
    gl.drawElements(gl.TRIANGLES, TRI.length, gl.UNSIGNED_SHORT, 0);
    rx.setTransform(1, 0, 0, 1, 0, 0); rx.fillStyle = css(bg); rx.fillRect(0, 0, stage.pw, stage.ph);
    rx.setTransform(stage.pw / W, 0, 0, stage.ph / H, 0, 0); drawRig(rx, (a) => css(fg, a), P.tone, false);
    rx.setTransform(1, 0, 0, 1, 0, 0); rx.drawImage(glc, 0, 0);
  }

  // a da Vinci plate, kept quiet like the other posters' hidden parts (Slinky's ledge, Rain's sides): pale hairlines, the weights
  // and bobs filled with a faint tint of the ink. On reveal the same drawing comes up at full strength with the hidden runs dashed.
  function drawRig(c, colr, tone, hidden) {
    const tint = bg.map((v, i) => v + (fg[i] - v) * tone * 0.28);
    c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = colr(tone); c.fillStyle = hidden ? 'rgba(0,0,0,0)' : css(tint); c.lineWidth = 0.9;
    if (hidden) c.setLineDash([3, 3]);
    for (const r of rails) {                                            // a beam with a hatched fixing at each end
      if (r.x1 < r.x0) continue; const y = r.y - rp * 2.6, x0 = r.x0 - capH * 0.18, x1 = r.x1 + capH * 0.18;
      c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y);
      for (const xe of [x0, x1]) for (let k = 0; k < 4; k++) { c.moveTo(xe + (k - 1.5) * rp * 0.9, y); c.lineTo(xe + (k - 1.5) * rp * 0.9 + rp * 0.7, y - rp * 0.9); }
      c.stroke();
    }
    for (const t of hoists) {
      const wx = t.px + rp, wy = t.py + t.w, ledge = t.py + t.ws + rp * 2.8;
      c.beginPath(); c.moveTo(t.px, t.py - rp * 2.6); c.lineTo(t.px, t.py);
      c.moveTo(t.px + rp * 0.4, t.py); c.arc(t.px, t.py, rp * 0.4, 0, Math.PI * 2);
      c.moveTo(t.px + rp, t.py); c.arc(t.px, t.py, rp, 0, Math.PI * 2);
      for (let k = 0; k < 3; k++) { const a = t.ang + k * Math.PI / 3; c.moveTo(t.px + Math.cos(a) * rp * 0.4, t.py + Math.sin(a) * rp * 0.4); c.lineTo(t.px + Math.cos(a) * rp, t.py + Math.sin(a) * rp); }
      if (t.on) { const nx = X[t.v], ny = Y[t.v]; c.moveTo(t.px - rp, t.py); c.lineTo(nx, ny); if (hidden) for (const v of t.vs) { c.moveTo(nx, ny); c.lineTo(X[v], Y[v]); } }
      c.moveTo(wx, t.py); c.lineTo(wx, wy);
      c.moveTo(wx - rp * 1.6, ledge); c.lineTo(wx + rp * 1.6, ledge);
      c.stroke();
      weight(c, wx, wy, rp, false);
    }
    for (const p of plumbs) {
      if (p.y > H + 40) continue;
      if (p.on) { c.beginPath(); c.moveTo(X[p.v], Y[p.v]); c.lineTo(p.x, p.y); c.stroke(); }
      weight(c, p.x, p.y, rp, true, p.on ? Math.atan2(p.x - X[p.v], p.y - Y[p.v]) : 0);
    }
    c.setLineDash([]);
  }
  function weight(c, x, y, r, bob, tilt = 0) {
    c.save(); c.translate(x, y); c.rotate(-tilt); c.beginPath();
    if (bob) { c.moveTo(0, 0); c.bezierCurveTo(r * 1.3, r * 0.2, r * 1.2, r * 1.8, 0, r * 3.2); c.bezierCurveTo(-r * 1.2, r * 1.8, -r * 1.3, r * 0.2, 0, 0); }
    else { c.moveTo(0, 0); c.bezierCurveTo(r * 1.1, r * 0.6, r * 1.1, r * 2.4, 0, r * 2.6); c.bezierCurveTo(-r * 1.1, r * 2.4, -r * 1.1, r * 0.6, 0, 0); }
    c.fill(); c.stroke(); c.restore();
  }

  // ---------- reveal: the whole rig at full strength, and the parts the cloth hides, dashed ----------
  const rv = createReveal(stage, (c, W_, H_, k) => {
    const colr = (a) => rvInk(stage, a);
    corners(c, W_, H_, 16, colr, k);
    drawRig(c, colr, 0.85 * k, false); drawRig(c, colr, 0.6 * k, true);
    titleBlock(c, W_, H_, ['RIGGED · STRUCTURE', '○ pulley  ◊ counterweight on its ledge  ▽ plumb', `${hoists.length} hoists · ${plumbs.length} plumbs · ${N} points`], colr, k);
  });

  // ---------- touch ----------
  const press = pressTracker();
  let pointer = null, lastTap = 0, reformT = 0, touched = false;
  const segD = (qx, qy, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, l = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((qx - ax) * vx + (qy - ay) * vy) / l)); return Math.hypot(qx - ax - vx * t, qy - ay - vy * t); };
  const nearest = (q, r) => { let bi = -1, bd = r * r; for (let i = 0; i < N; i++) { const d = (X[i] - q.x) ** 2 + (Y[i] - q.y) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; };
  function nearestRope(q) {
    let best = null, bd = capH * 0.35;
    for (const t of hoists) if (t.on) { const d = Math.min(segD(q.x, q.y, X[t.v], Y[t.v], t.px, t.py), Math.hypot(q.x - t.px - rp, q.y - t.py - t.w)); if (d < bd) { bd = d; best = t; } }
    for (const p of plumbs) if (p.on) { const d = segD(q.x, q.y, X[p.v], Y[p.v], p.x, p.y + rp * 1.5); if (d < bd) { bd = d; best = p; } }
    if (best) return best;
    const i = nearest(q, capH * 0.4); if (i < 0) return null;            // on the cloth: that letter's nearest rope
    for (const r of [...hoists, ...plumbs]) if (r.on && r.label === LAB[i]) { const d = Math.hypot(X[r.v] - q.x, Y[r.v] - q.y); if (!best || d < bd) { bd = d; best = r; } }
    return best;
  }
  function startGrab(q) {
    const i = nearest(q, Math.max(28, s * 3)); if (i < 0) return;
    const r = Math.max(s * 1.7, 12), nodes = [];
    for (let k = 0; k < N; k++) if (LAB[k] === LAB[i] && (X[k] - X[i]) ** 2 + (Y[k] - Y[i]) ** 2 < r * r) nodes.push({ i: k, ox: X[k] - q.x, oy: Y[k] - q.y });
    grab = { x: q.x, y: q.y, nodes };
  }
  offs.push(stage.on('down', (q, e) => { if (!ready || !press.down(q, e.pointerId)) return; touched = true; pointer = e.pointerId; }));
  offs.push(stage.on('move', (q, e) => {
    if (e.pointerId !== pointer) return;
    press.move(q, e.pointerId);
    if (!grab && press.moved >= TAP.px) startGrab(press_start);
    if (grab) { grab.x = q.x; grab.y = q.y; }
  }));
  let press_start = null;
  offs.push(stage.on('down', (q) => { press_start = { x: q.x, y: q.y }; }));
  offs.push(stage.on('up', (q, e) => {
    if (e.pointerId !== pointer) return;
    const r = press.up(q, e.pointerId); pointer = null; grab = null;
    if (!r || !r.tap) return;
    cutRope(nearestRope(q));
    const now = performance.now();
    if (now - lastTap < DOUBLE_MS) { clearTimeout(reformT); reformT = later(() => { if (!stage.revealed) tieAll(); }, REFORM_DELAY_MS); lastTap = 0; }   // double tap: tie every rope now
    else lastTap = now;
  }));
  offs.push(stage.on('reveal', () => clearTimeout(reformT)));

  // ---------- settings ----------
  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  const tune = {
    title: 'Rigged', values: P, defaults: DEF,
    groups: [
      { name: 'Rig', items: [Ctl('counter', 'Counterweight (times the load)', 1.05, 3, 0.05), Ctl('plumb', 'Plumb weight', 0, 0.2, 0.005), Ctl('corner', 'Corner sharpness for a rope', 0.4, 1.6, 0.05), Ctl('reel', 'Reel speed', 60, 1200, 20), Ctl('hold', 'Pause before it ties again (s)', 0.3, 5, 0.1), Ctl('tone', 'Rig tone (how much ink)', 0.04, 1, 0.01)] },
      { name: 'Cloth', items: [Ctl('slack', 'Spare cloth (slack)', 0.96, 1.2, 0.01), Ctl('bend', 'Fold stiffness', 0, 0.6, 0.01), Ctl('brace', 'Hidden battens', 0, 1, 0.01), Ctl('grav', 'Gravity', 200, 3000, 50), Ctl('detail', 'Cloth detail (points)', 1000, 6000, 100), Ctl('sheen', 'Fold light', 0, 2, 0.05)] },
    ],
    actions: { 'Cut every rope': () => [...hoists, ...plumbs].forEach(cutRope), 'Tie them now': () => tieAll() },
    set(key, v) { P[key] = v; if (STRUCT.has(key)) build(); },
    reset() { Object.assign(P, DEF); build(); },
  };

  // ---------- go: the intro (ropes start slack and the rig hoists the name), then the frame ----------
  function intro() { for (const t of hoists) t.extra = capH * 0.9; const r = P.reel; P.reel = 0; for (let k = 0; k < 120; k++) sim(1 / 60); P.reel = r; }
  build();
  if (!stage.reduced) intro(); else for (let k = 0; k < 90; k++) sim(1 / 60);
  let rt = 0;
  offs.push(stage.on('resize', () => { clearTimeout(rt); rt = later(() => { if (alive) { build(); for (let k = 0; k < 90; k++) sim(1 / 60); } }, 150); }));
  offs.push(stage.frame((dt) => {
    if (!ready) return;
    if (press.holding && !grab && press_start) startGrab(press_start);
    sim(1 / 60); render(); rv.draw();
  }));

  return {
    tune,
    debug: { cut: (k) => cutRope(hoists[k]), tieAll, run: (k = 1) => { for (let i = 0; i < k; i++) sim(1 / 60); render(); }, counts: () => ({ N, hoists: hoists.length, plumbs: plumbs.length }), touched: () => touched },
    destroy() {
      alive = false; timers.forEach(clearTimeout); clearTimeout(reformT); rv.destroy(); offs.forEach((f) => f());
      for (const b of [bufP, bufN, bufI]) gl.deleteBuffer(b); gl.deleteProgram(prog);
      const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      stage.setBackdrop(null);
    },
  };
}
