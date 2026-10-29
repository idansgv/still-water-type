// Torn: the name cut from cloth and hung from a row of pegs along the top of each letter, so it drapes: the arms of S, E and G
// droop and sway. Moving the pointer pushes air at the cloth. Drag pulls it; pull hard and it rips along the line of most
// stress, and the pieces fall and pile on the floor. A tap pulls out the nearest peg; double tap lets the old cloth fall away
// and lowers a fresh set on its pegs.
//
// Under the picture: each letter is a triangle mesh cut from the glyph and stepped by a position-based solver in 3D, so spare
// cloth folds out of the page. Every triangle edge is a thread that snaps past `tear` times its length and takes its triangles
// with it. A peg holds a small patch, not one point, or the cloth would tear off under its own weight. The cloth is drawn with
// WebGL on an offscreen canvas and laid onto the stage canvas (2D) with the pegs, so one canvas holds the picture.
//
// gestures: tap = pull out the nearest peg (a beat later, so a double or triple tap does not unpeg); hold or drag = take hold
// of the cloth; double tap = a fresh set (REFORM_DELAY_MS after, so a third tap can still mean reveal). Intro: the name comes
// down on its pegs once (off under reduced motion). Colour: the framework's colour pass, on the first press.

import { createReveal, corners, titleBlock, ink as rvInk } from './reveal.js';
import { pressTracker, TAP, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';
import { linesFor } from '../name.js';

// The face: Alfa Slab One (open licence, from Google Fonts), loaded before the first layout; a slab serif stands in if it does not arrive.
const FACE = new URLSearchParams(location.search).get('font') || 'Alfa Slab One';
{
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(FACE).replace(/%20/g, '+')}&display=swap`;
  await new Promise((r) => { l.onload = r; l.onerror = r; setTimeout(r, 2500); document.head.appendChild(l); });
  try { await Promise.race([document.fonts.load(`400 100px "${FACE}"`, 'IDANSEGV'), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* the stand-in */ }
}
const FONT = (px) => `400 ${px}px "${FACE}", Rockwell, "Arial Black", serif`;

// Idan's tuned values (21 Oct 2026)
const DEF = { pegs: 6, tear: 2.25, slack: 1.05, bend: 0.05, grav: 1650, air: 0.6, detail: 5200, sheen: 0.15 };
const STRUCT = new Set(['pegs', 'slack', 'detail']);

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
  let alive = true;

  // ---------- canvases: the stage canvas holds the picture; the cloth is drawn offscreen with WebGL and laid on it ----------
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

  // ---------- the cloth ----------
  let settled = false;                                                 // set by sim(): the cloth has stopped moving
  let LN = [], LC = [], awake = new Uint8Array(0), quiet = new Uint16Array(0), BB = new Float32Array(0), pegOn = [], floorWas = true;   // per letter: points, threads, awake, quiet steps, bounds
  // Starch: an untouched letter keeps a gentle pull back to its own shape, so the name reads at rest (SEGEV used to hang as SFCFV).
  // The first touch takes it out for that letter (a peg pulled, a hand on it, a thread torn) and from then on it is plain cloth.
  const STARCH = 0.04;
  let starch = new Uint8Array(0);
  let W = stage.W, H = stage.H, N = 0, X, Y, Z, PX, PY, PZ, IM, HX, HY, LAB, CA, CB, CR, CK, NC = 0, TRI, ALIVE, TRIC, ECNT, EBEND, IDX, nIdx = 0, idxDirty = true;
  let NRM, POS, pegs = [], capH = 100, s = 8, letters = [], ready = false, floorOn = true, lower = null, grab = null, air = null, tears = 0;

  function build() {
    ready = false; W = stage.W; H = stage.H;
    const w = Math.ceil(W), h = Math.ceil(H), m = document.createElement('canvas'); m.width = w; m.height = h;
    const x = m.getContext('2d', { willReadFrequently: true });
    const portrait = W / H < 0.8, lines = linesFor(stage, portrait ? ['IDAN', 'SE', 'GEV'] : ['IDAN', 'SEGEV'], { upper: true }), TR = 0.07;
    x.font = FONT(100);
    const adv = {}; for (const ch of lines.join('')) adv[ch] = x.measureText(ch).width / 100;
    const lw = (l, sz) => [...l].reduce((a, ch) => a + adv[ch] * sz, 0) + TR * sz * (l.length - 1);
    const cap = x.measureText('H').actualBoundingBoxAscent / 100 || 0.72;
    let size = Math.min(...lines.map((l) => W * 0.84 / lw(l, 1)));
    const lead = 1.45, total = (sz) => cap * sz * (1 + (lines.length - 1) * lead);
    if (total(size) > H * 0.66) size *= H * 0.66 / total(size);
    capH = cap * size;
    x.font = FONT(size); x.textBaseline = 'alphabetic';
    const base0 = (H - total(size)) / 2 + capH - H * 0.07;
    let li = 0; letters = [];
    lines.forEach((l, k) => {                                          // each letter its own red: up to 15 letters (a visitor's name is at most 14)
      let cx = (W - lw(l, size)) / 2; const by = base0 + k * capH * lead;
      for (const ch of l) { x.fillStyle = `rgb(${(li + 1) * 16},0,0)`; x.fillText(ch, cx, by); letters.push(ch); cx += adv[ch] * size + TR * size; li++; }
    });
    const d = x.getImageData(0, 0, w, h).data, A = new Uint8Array(w * h), Lb = new Int8Array(w * h).fill(-1);
    let area = 0, bx0 = w, by0 = h, bx1 = 0, by1 = 0;
    for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] > 110) {
      A[i] = 1; Lb[i] = Math.round(d[i * 4] / 16) - 1; area++;
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
    const rz = mulberry(5);
    for (let i = 0; i < nx.length; i++) if (used[i] >= 0) { const k = used[i]; HX[k] = X[k] = PX[k] = nx[i]; HY[k] = Y[k] = PY[k] = ny[i]; LAB[k] = nl[i]; Z[k] = PZ[k] = (rz() - 0.5) * 0.8; }
    TRI = new Uint16Array(tris.map((v) => used[v])); const NT = TRI.length / 3;
    ALIVE = new Uint8Array(NT).fill(1); TRIC = new Int32Array(NT * 3);
    // threads: every triangle edge; across each shared edge the two far corners (folding). Who owns what, so a rip can spread.
    const em = new Map(), key = (a, b) => (a < b ? a * 65536 + b : b * 65536 + a);
    for (let t = 0; t < NT; t++) for (let e = 0; e < 3; e++) {
      const a = TRI[t * 3 + e], b = TRI[t * 3 + (e + 1) % 3], o = TRI[t * 3 + (e + 2) % 3], k = key(a, b);
      const r = em.get(k); if (r) { r.opp.push(o); r.tris.push(t); r.slots.push(t * 3 + e); } else em.set(k, { a, b, opp: [o], tris: [t], slots: [t * 3 + e] });
    }
    const ca = [], cb = [], ck = [], ecnt = [], ebend = [];
    for (const r of em.values()) {
      const id = ca.length; ca.push(r.a); cb.push(r.b); ck.push(1); ecnt.push(r.tris.length); ebend.push(-1);
      for (const sl of r.slots) TRIC[sl] = id;
      if (r.opp.length === 2) { ebend[id] = ca.length; ca.push(r.opp[0]); cb.push(r.opp[1]); ck.push(-1); ecnt.push(0); ebend.push(-1); }
    }
    NC = ca.length; CA = new Uint16Array(ca); CB = new Uint16Array(cb); CK = new Float32Array(ck); CR = new Float32Array(NC);
    ECNT = new Int32Array(ecnt); EBEND = new Int32Array(ebend);
    for (let c = 0; c < NC; c++) CR[c] = Math.hypot(HX[CB[c]] - HX[CA[c]], HY[CB[c]] - HY[CA[c]]) * P.slack;
    // the pegs: along the top edge of each letter, spread evenly between its leftmost and rightmost top points, each holding a small patch
    const bnd = new Uint8Array(N); for (const r of em.values()) if (r.opp.length === 1) { bnd[r.a] = 1; bnd[r.b] = 1; }
    pegs = [];
    for (let l = 0; l < letters.length; l++) {
      let top = 1e9; for (let i = 0; i < N; i++) if (LAB[i] === l && bnd[i] && HY[i] < top) top = HY[i];
      const band = []; for (let i = 0; i < N; i++) if (LAB[i] === l && bnd[i] && HY[i] < top + capH * 0.07) band.push(i);
      if (!band.length) continue;
      band.sort((a, b) => HX[a] - HX[b]);
      const x0 = HX[band[0]], x1 = HX[band[band.length - 1]], k = x1 - x0 < capH * 0.15 ? 1 : P.pegs;
      const picked = new Set();
      for (let j = 0; j < k; j++) {
        const tx = k === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * (j / (k - 1)) * 0.94 + (x1 - x0) * 0.03;
        let bi = band[0]; for (const i of band) if (Math.abs(HX[i] - tx) < Math.abs(HX[bi] - tx)) bi = i;
        if (picked.has(bi)) continue; picked.add(bi);
        const patch = [], pr = Math.max(s * 1.3, capH * 0.03);
        for (let i = 0; i < N; i++) if (LAB[i] === l && (HX[i] - HX[bi]) ** 2 + (HY[i] - HY[bi]) ** 2 < pr * pr) { patch.push({ i, ox: HX[i] - HX[bi], oy: HY[i] - HY[bi] }); IM[i] = 0; }
        pegs.push({ v: bi, patch, x: HX[bi], y: HY[bi], on: true, label: l });
      }
    }
    POS = new Float32Array(N * 3); NRM = new Float32Array(N * 3); IDX = new Uint16Array(TRI.length); idxDirty = true;
    // each letter is its own cloth: its points and threads, so a letter that has come to rest can sleep while another moves
    const NL = letters.length, ln = Array.from({ length: NL }, () => []), lc = Array.from({ length: NL }, () => []);
    for (let i = 0; i < N; i++) ln[LAB[i]].push(i);
    for (let c = 0; c < NC; c++) lc[LAB[CA[c]]].push(c);
    LN = ln.map((a) => Int32Array.from(a)); LC = lc.map((a) => Int32Array.from(a));
    awake = new Uint8Array(NL).fill(1); starch = new Uint8Array(NL).fill(1); quiet = new Uint16Array(NL); BB = new Float32Array(NL * 4).fill(1e9); for (let l = 0; l < NL; l++) { BB[l * 4] = BB[l * 4 + 1] = -1e9; }
    pegOn = pegs.map((p) => p.on);
    grab = null; tears = 0; floorOn = true; floorWas = true; lower = null; settled = false; ready = true;
  }
  const wake = (l) => { if (l >= 0 && l < awake.length) { awake[l] = 1; quiet[l] = 0; } };

  // a snapped thread takes its triangles; their other threads go when no triangle is left to hold them
  function killTri(t) {
    if (!ALIVE[t]) return; ALIVE[t] = 0; idxDirty = true;
    for (let e = 0; e < 3; e++) { const id = TRIC[t * 3 + e]; if (--ECNT[id] <= 0) CK[id] = 0; if (EBEND[id] >= 0) CK[EBEND[id]] = 0; }
  }
  function snap(id) {
    starch[LAB[CA[id]]] = 0;
    for (let t = 0; t < ALIVE.length; t++) if (ALIVE[t] && (TRIC[t * 3] === id || TRIC[t * 3 + 1] === id || TRIC[t * 3 + 2] === id)) killTri(t);
    CK[id] = 0; tears++;
  }

  // ---------- the solver ----------
  function sim(dt) {
    const SUB = 4, ITER = 3, h = dt / SUB, g = P.grav * h * h, damp = 0.993, floor = H - 3, tear = lower ? 99 : P.tear, broke = [];
    let lowOff = 0;                                                    // how far above home the set still hangs while it comes down (the starch follows it)
    if (lower) {                                                       // a fresh set comes down on its pegs (on simulation time; no tearing meanwhile)
      lower.t += dt * 1000; const k = Math.min(1, lower.t / lower.ms), e = 0.5 - 0.5 * Math.cos(Math.PI * k);
      lowOff = lower.drop * (1 - e);
      for (const p of pegs) p.y = HY[p.v] - lowOff;
      if (k >= 1 && lower.t > lower.ms + 900) lower = null;
    }
    // what wakes a sleeping letter: a set coming down, the floor opening, a peg coming out, a hand on it, air near it
    const NL = awake.length, held = grab && grab.nodes.length ? LAB[grab.nodes[0].i] : -1;
    if (lower || floorOn !== floorWas) { floorWas = floorOn; awake.fill(1); quiet.fill(0); }
    for (let k = 0; k < pegs.length; k++) if (pegs[k].on !== pegOn[k]) { pegOn[k] = pegs[k].on; wake(pegs[k].label); if (!pegs[k].on) starch[pegs[k].label] = 0; }
    wake(held); if (held >= 0) starch[held] = 0;
    if (air) for (let l = 0; l < NL; l++) { const o = l * 4, r = air.r; if (air.x > BB[o] - r && air.x < BB[o + 2] + r && air.y > BB[o + 1] - r && air.y < BB[o + 3] + r) wake(l); }
    for (let sI = 0; sI < SUB; sI++) {
      for (let l = 0; l < NL; l++) {
        if (!awake[l]) continue; const pts = LN[l];
        for (let k = 0; k < pts.length; k++) {
          const i = pts[k]; if (IM[i] === 0) continue;
          const vx = (X[i] - PX[i]) * damp, vy = (Y[i] - PY[i]) * damp, vz = (Z[i] - PZ[i]) * damp;
          PX[i] = X[i]; PY[i] = Y[i]; PZ[i] = Z[i]; X[i] += vx; Y[i] += vy + g; Z[i] += vz;
        }
        if (air) {                                                      // air pushed by the moving pointer: along its path and out of the page
          const r2 = air.r * air.r;
          for (let k = 0; k < pts.length; k++) {
            const i = pts[k]; if (!IM[i]) continue; const dx = X[i] - air.x, dy = Y[i] - air.y, q = dx * dx + dy * dy; if (q > r2) continue;
            const f = (1 - q / r2) * P.air * h * 60;
            PX[i] -= air.vx * f * 0.05; PY[i] -= air.vy * f * 0.05; PZ[i] -= air.sp * f * 0.06 * air.sign;
          }
        }
      }
      for (const p of pegs) if (p.on && awake[p.label]) for (const q of p.patch) { X[q.i] = p.x + q.ox; Y[q.i] = p.y + q.oy; Z[q.i] = 0; }
      for (let it = 0; it < ITER; it++) {
        for (let l = 0; l < NL; l++) {
          if (!awake[l]) continue; const cs = LC[l];
          for (let m = 0; m < cs.length; m++) {
            const c = cs[m], kc = CK[c]; if (kc === 0) continue;
            const a = CA[c], b = CB[c], wa = IM[a], wb = IM[b], ws = wa + wb; if (!ws) continue;
            const k = kc < 0 ? P.bend : 1;
            const dx = X[b] - X[a], dy = Y[b] - Y[a], dz = Z[b] - Z[a], d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d < 1e-6) continue;
            if (kc > 0 && it === ITER - 1 && d > CR[c] * tear) { broke.push(c); continue; }
            const f = (d - CR[c]) / (d * ws) * k;
            X[a] += dx * f * wa; Y[a] += dy * f * wa; Z[a] += dz * f * wa; X[b] -= dx * f * wb; Y[b] -= dy * f * wb; Z[b] -= dz * f * wb;
          }
        }
        if (grab) for (const g2 of grab.nodes) { X[g2.i] = grab.x + g2.ox; Y[g2.i] = grab.y + g2.oy; }
      }
      for (let l = 0; l < NL; l++) {
        if (!awake[l] || !starch[l]) continue; const pts = LN[l];
        for (let k = 0; k < pts.length; k++) { const i = pts[k]; if (!IM[i]) continue; X[i] += (HX[i] - X[i]) * STARCH; Y[i] += (HY[i] - lowOff - Y[i]) * STARCH; Z[i] -= Z[i] * STARCH; }
      }
      if (floorOn) for (let l = 0; l < NL; l++) { if (!awake[l]) continue; const pts = LN[l]; for (let k = 0; k < pts.length; k++) { const i = pts[k]; if (Y[i] > floor) { Y[i] = floor; PX[i] += (X[i] - PX[i]) * 0.6; PZ[i] += (Z[i] - PZ[i]) * 0.6; } } }
      for (const c of broke) if (CK[c] > 0) snap(c);
      broke.length = 0;
    }
    if (air) { air.sp *= 0.5; air.vx *= 0.5; air.vy *= 0.5; if (air.sp < 0.05) air = null; }
    // a letter that has stopped moving for 30 steps sleeps; the whole cloth at rest lets the frame loop skip the solver and the redraw
    let any = false;
    for (let l = 0; l < NL; l++) {
      if (!awake[l]) continue; const pts = LN[l], o = l * 4;
      let mv = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let k = 0; k < pts.length; k++) {
        const i = pts[k], x = X[i], y = Y[i];
        if (IM[i]) mv = Math.max(mv, Math.abs(x - PX[i]) + Math.abs(y - PY[i]) + Math.abs(Z[i] - PZ[i]));   // pinned points (pegs, the hand) never integrate, so they say nothing about motion
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      BB[o] = x0; BB[o + 1] = y0; BB[o + 2] = x1; BB[o + 3] = y1;
      if (mv < 0.005 && l !== held && !lower) { if (++quiet[l] > 30) awake[l] = 0; } else quiet[l] = 0;   // under a pixel of drift left: invisible when it stops
      if (awake[l]) any = true;
    }
    settled = !any && !grab && !air && !lower;
  }

  // ---------- drawing ----------
  function render() {
    if (idxDirty) { nIdx = 0; for (let t = 0; t < ALIVE.length; t++) if (ALIVE[t]) { IDX[nIdx++] = TRI[t * 3]; IDX[nIdx++] = TRI[t * 3 + 1]; IDX[nIdx++] = TRI[t * 3 + 2]; } gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufI); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, IDX.subarray(0, nIdx), gl.DYNAMIC_DRAW); idxDirty = false; }
    NRM.fill(0);
    for (let q = 0; q < nIdx; q += 3) {
      const a = IDX[q], b = IDX[q + 1], c = IDX[q + 2];
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
    if (nIdx) gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_SHORT, 0);
    rx.setTransform(1, 0, 0, 1, 0, 0); rx.fillStyle = css(bg); rx.fillRect(0, 0, stage.pw, stage.ph);
    rx.drawImage(glc, 0, 0);
    rx.setTransform(stage.pw / W, 0, 0, stage.ph / H, 0, 0);
    const r = Math.max(2, capH * 0.018);                               // the pegs: small pin heads in the page colour, ringed in ink
    rx.fillStyle = css(bg); rx.strokeStyle = css(fg); rx.lineWidth = 1;
    for (const p of pegs) { if (!p.on) continue; rx.beginPath(); rx.arc(p.x, p.y, r, 0, Math.PI * 2); rx.fill(); rx.stroke(); }
  }

  // ---------- reveal: every thread, drawn by how hard it is pulled (the thick ones are the next to go) ----------
  const rv = createReveal(stage, (c, W_, H_, k) => {
    const colr = (a) => rvInk(stage, a);
    corners(c, W_, H_, 16, colr, k);
    const bands = [[], [], []];
    for (let i = 0; i < NC; i++) {
      if (CK[i] <= 0) continue; const a = CA[i], b = CB[i];
      const st = (Math.hypot(X[b] - X[a], Y[b] - Y[a], Z[b] - Z[a]) / CR[i] - 1) / (P.tear - 1);
      bands[st > 0.5 ? 2 : st > 0.15 ? 1 : 0].push(a, b);
    }
    [[0.35, 0.5], [0.8, 1.2], [1, 2.4]].forEach(([al, lw], j) => {
      c.strokeStyle = colr(al * k); c.lineWidth = lw; c.beginPath();
      const L = bands[j]; for (let q = 0; q < L.length; q += 2) { c.moveTo(X[L[q]], Y[L[q]]); c.lineTo(X[L[q + 1]], Y[L[q + 1]]); }
      c.stroke();
    });
    titleBlock(c, W_, H_, ['TORN · STRUCTURE', '─ a thread, heavier the harder it is pulled', `${pegs.filter((p) => p.on).length} pegs · ${tears} threads torn · snaps at ${P.tear}×`], colr, k);
  });

  // ---------- re-hang: the floor opens, the old cloth falls away, a fresh set comes down on its pegs ----------
  const unpeg = (p) => { if (!p.on) return; p.on = false; for (const q of p.patch) IM[q.i] = 1; };
  function lowerFresh() {
    build(); if (!ready) return;
    const drop = H * 0.9;
    for (let i = 0; i < N; i++) { Y[i] -= drop; PY[i] = Y[i]; }
    for (const p of pegs) p.y = HY[p.v] - drop;
    lower = { t: 0, ms: 1600, drop };
  }
  function rehang() { floorOn = false; grab = null; for (const p of pegs) unpeg(p); later(() => { if (alive) lowerFresh(); }, 520); }

  // ---------- touch ----------
  const press = pressTracker();
  let pointer = null, start = null, lastMove = null, tapT = 0, reformT = 0, taps = 0;
  const nearest = (q, r) => { let bi = -1, bd = r * r; for (let i = 0; i < N; i++) { const d = (X[i] - q.x) ** 2 + (Y[i] - q.y) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; };
  function startGrab(q) {
    const i = nearest(q, Math.max(28, s * 3)); if (i < 0) return;
    const r = Math.max(s * 2.5, capH * 0.12), nodes = [];
    for (let k = 0; k < N; k++) if (IM[k] && LAB[k] === LAB[i] && (X[k] - X[i]) ** 2 + (Y[k] - Y[i]) ** 2 < r * r) { nodes.push({ i: k, ox: X[k] - q.x, oy: Y[k] - q.y }); IM[k] = 0; }
    grab = { x: q.x, y: q.y, vx: 0, vy: 0, nodes };
  }
  function endGrab() { if (!grab) return; for (const g2 of grab.nodes) { IM[g2.i] = 1; PX[g2.i] = X[g2.i] - grab.vx / 4; PY[g2.i] = Y[g2.i] - grab.vy / 4; } grab = null; }
  function unpegNear(at) {
    let bp = null, bd = (capH * 0.6) ** 2;
    for (const p of pegs) { if (!p.on) continue; const d = (p.x - at.x) ** 2 + (p.y - at.y) ** 2; if (d < bd) { bd = d; bp = p; } }
    if (!bp) { const i = nearest(at, capH * 0.5); if (i >= 0) for (const p of pegs) if (p.on && p.label === LAB[i]) { const d = (p.x - at.x) ** 2 + (p.y - at.y) ** 2; if (!bp || d < (bp.x - at.x) ** 2 + (bp.y - at.y) ** 2) bp = p; } }
    if (bp) unpeg(bp);
  }
  offs.push(stage.on('down', (q, e) => { if (!ready || !press.down(q, e.pointerId)) return; pointer = e.pointerId; start = { x: q.x, y: q.y }; }));
  offs.push(stage.on('move', (q, e) => {
    const t = performance.now();
    if (lastMove && !grab) {                                            // the air a moving pointer pushes
      const dt = Math.max(1, t - lastMove.t), vx = (q.x - lastMove.x) / dt * 16, vy = (q.y - lastMove.y) / dt * 16, sp = Math.hypot(vx, vy);
      if (sp > 1) air = { x: q.x, y: q.y, vx, vy, sp: Math.min(sp, 60), r: capH * 0.55, sign: stage.rand() < 0.5 ? -1 : 1 };
    }
    lastMove = { x: q.x, y: q.y, t };
    if (e.pointerId !== pointer) return;
    press.move(q, e.pointerId);
    if (!grab && press.moved >= TAP.px) startGrab(start);
    if (grab) { grab.vx = q.x - grab.x; grab.vy = q.y - grab.y; grab.x = q.x; grab.y = q.y; }
  }));
  offs.push(stage.on('up', (q, e) => {
    if (e.pointerId !== pointer) return;
    const r = press.up(q, e.pointerId); pointer = null; endGrab();
    if (!r || !r.tap) return;
    const at = { x: q.x, y: q.y }; taps++; clearTimeout(tapT);
    if (taps === 2) { clearTimeout(reformT); reformT = later(() => { if (!stage.revealed) rehang(); }, REFORM_DELAY_MS); }   // double tap: a fresh set
    tapT = later(() => { if (taps === 1 && !stage.revealed) unpegNear(at); taps = 0; }, DOUBLE_MS);                       // one tap: a peg comes out
  }));
  offs.push(stage.on('reveal', () => { clearTimeout(reformT); clearTimeout(tapT); taps = 0; }));

  // ---------- settings ----------
  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  const tune = {
    title: 'Torn', values: P, defaults: DEF,
    groups: [
      { name: 'Cloth', items: [Ctl('pegs', 'Pegs per letter', 1, 6, 1), Ctl('tear', 'How easily it tears (stretch before a rip)', 1.15, 3, 0.05), Ctl('slack', 'Spare cloth (slack)', 0.96, 1.25, 0.01), Ctl('bend', 'Fold stiffness', 0, 0.4, 0.01), Ctl('detail', 'Cloth detail (points)', 1000, 6000, 100)] },
      { name: 'World', items: [Ctl('grav', 'Gravity', 200, 3000, 50), Ctl('air', 'Air from the pointer', 0, 3, 0.05), Ctl('sheen', 'Fold light', 0, 2, 0.05)] },
    ],
    actions: { 'Hang a fresh set': () => rehang() },
    set(key, v) { P[key] = v; if (STRUCT.has(key)) { build(); for (let k = 0; k < 120; k++) sim(1 / 60); } },
    reset() { Object.assign(P, DEF); build(); for (let k = 0; k < 120; k++) sim(1 / 60); },
  };

  // ---------- go: the intro (the name comes down on its pegs), then the frame ----------
  if (stage.reduced) { build(); for (let k = 0; k < 240; k++) sim(1 / 60); } else lowerFresh();
  let rt = 0;
  offs.push(stage.on('resize', () => { clearTimeout(rt); rt = later(() => { if (alive) { build(); for (let k = 0; k < 120; k++) sim(1 / 60); } }, 150); }));
  offs.push(stage.frame(() => {
    if (!ready) return;
    if (press.holding && !grab && start) startGrab(start);
    if (press.active || grab || air || lower || !settled) { sim(1 / 60); render(); }
    rv.draw();
  }));

  return {
    tune,
    debug: { rehang, run: (k = 1) => { for (let i = 0; i < k; i++) sim(1 / 60); render(); }, counts: () => ({ N, NC, tris: nIdx / 3, pegs: pegs.filter((p) => p.on).length, tears, awake: awake.reduce((a, b) => a + b, 0), settled }),
      motion: () => LN.map((pts) => { let mv = 0; for (const i of pts) if (IM[i]) mv = Math.max(mv, Math.abs(X[i] - PX[i]) + Math.abs(Y[i] - PY[i]) + Math.abs(Z[i] - PZ[i])); return +mv.toFixed(4); }),
      bench: (k = 60) => { let a = performance.now(); for (let i = 0; i < k; i++) sim(1 / 60); const s = (performance.now() - a) / k; a = performance.now(); for (let i = 0; i < k; i++) render(); return { simMs: +s.toFixed(2), renderMs: +((performance.now() - a) / k).toFixed(2) }; } },
    destroy() {
      alive = false; timers.forEach(clearTimeout); rv.destroy(); offs.forEach((f) => f());
      for (const b of [bufP, bufN, bufI]) gl.deleteBuffer(b); gl.deleteProgram(prog);
      const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      stage.setBackdrop(null);
    },
  };
}
