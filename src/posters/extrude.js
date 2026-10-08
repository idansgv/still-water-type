// Extrude. The letters are cut-outs in the page, like the die of a children's dough toy (a Fun Factory). Press a letter and
// dough is squeezed out through its hole: a solid prism of the letter, growing toward you, sagging under its own weight,
// wobbling like jelly. Let go and the cutter snips it off; the piece drops down the page and lands on the ledge at the bottom,
// where it stays (the oldest ones sink away when there are too many). Tap for a short squirt.
//
// The material takes its cue from a translucent jelly study: soft, glossy, with light creeping through thin edges. Here it is
// strictly one colour: black dough on a white page, or white dough on a black page (it swaps on every second shuffle).
//
// How it is made. Each piece of dough is a chain of ring frames (a spine of particles, simulated with position-based
// dynamics: fixed segment length, a little bending stiffness, gravity, sticky damping). The letter's outline (traced from a
// real font, see glyph-contours.js) is swept along the spine on the GPU: the vertex shader reads the ring frames and the
// outline points from textures and builds the surface, with normals from neighbouring points. A flat cap closes the free
// end (and the cut end), drawn from a small picture of the letter.

import { getGL, compile, uploadCanvas, texture } from '../engine.js';
import { glyphContours } from './glyph-contours.js';

const FACE = '"Archivo", "Arial Black", sans-serif', FACE_W = 900;
const K = 44;                         // most rings in a piece of dough
const SLOTS = 10;                     // most pieces at once (one is feeding at a time per letter; the rest sit on the ledge)
const NEEDS = ['I', 'D', 'A', 'N', 'S', 'E', 'G', 'V'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const VS = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uFrames, uContour;
uniform int uM, uSlot, uLetter, uN;
uniform float uH, uFlip, uShrink;
uniform vec2 uRes;
uniform float uD;
out vec3 vN;
out vec3 vP;
out float vS;
out vec2 vQ;

vec4 frame(int i, int k) { return texelFetch(uFrames, ivec2(i * 3 + k, uSlot), 0); }
vec3 ringPoint(int i, vec2 c) {
  vec4 a = frame(i, 0); vec3 X = frame(i, 1).xyz, Y = frame(i, 2).xyz;
  return a.xyz + (X * c.x + Y * c.y) * uH * a.w * uShrink;
}
void main() {
  int v = gl_VertexID / uM, u = gl_VertexID - v * uM;
  vec4 cp = texelFetch(uContour, ivec2(u, uLetter), 0);
  vec2 prevC = texelFetch(uContour, ivec2(int(cp.z), uLetter), 0).xy, nextC = texelFetch(uContour, ivec2(int(cp.w), uLetter), 0).xy;
  vec3 P = ringPoint(v, cp.xy);
  vec3 dU = ringPoint(v, nextC) - ringPoint(v, prevC);
  vec3 dV = ringPoint(min(v + 1, uN - 1), cp.xy) - ringPoint(max(v - 1, 0), cp.xy);
  vec3 n = cross(dV, dU) * uFlip;
  vN = normalize(n + 1e-9);
  vP = P; vS = float(v) / float(max(uN - 1, 1)); vQ = vec2(0.0);
  float k = uD / (uD - P.z);
  gl_Position = vec4(P.x / (uRes.x * 0.5) * k, P.y / (uRes.y * 0.5) * k, 1.0 - clamp((P.z + 600.0) / 1200.0, 0.0, 1.0), 1.0);
}`;
const CAP_VS = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uFrames;
uniform int uSlot, uRing;
uniform float uH, uSign, uShrink;
uniform vec2 uRes;
uniform float uD;
out vec2 vQ;
out vec3 vN;
out vec3 vP;
out float vS;
void main() {
  vec2 q = vec2(float(gl_VertexID & 1) * 2.0 - 1.0, float((gl_VertexID >> 1) & 1) * 2.0 - 1.0) * 0.78;
  vec4 a = texelFetch(uFrames, ivec2(uRing * 3, uSlot), 0); vec3 X = texelFetch(uFrames, ivec2(uRing * 3 + 1, uSlot), 0).xyz, Y = texelFetch(uFrames, ivec2(uRing * 3 + 2, uSlot), 0).xyz;
  vec3 P = a.xyz + (X * q.x + Y * q.y) * uH * a.w * uShrink;
  vQ = q; vN = normalize(cross(X, Y)) * uSign; vP = P; vS = 0.0;
  float k = uD / (uD - P.z);
  gl_Position = vec4(P.x / (uRes.x * 0.5) * k, P.y / (uRes.y * 0.5) * k, 1.0 - clamp((P.z + 600.0) / 1200.0, 0.0, 1.0) - 0.0005, 1.0);
}`;
const DOUGH_FS = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform float uMode;                  // 0 black dough on a white page, 1 white dough on a black page
uniform float uCap;
uniform sampler2D uTile;
uniform float uTileIdx;
in vec2 vQ;
in vec3 vN;
in vec3 vP;
in float vS;
out vec4 o;
void main() {
  if (uCap > 0.5) {
    vec2 t = vec2((uTileIdx + vQ.x / 1.56 + 0.5) / 8.0, 0.5 - vQ.y / 1.56);
    if (texture(uTile, t).r < 0.5) discard;
  }
  vec3 n = normalize(vN); if (!gl_FrontFacing && uCap < 0.5) n = -n;
  vec3 V = vec3(0.0, 0.0, 1.0), L = normalize(vec3(-0.45, 0.62, 0.64));
  float wrap = clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0), diff = wrap * wrap;
  vec3 hv = normalize(L + V);
  float spec = pow(max(dot(n, hv), 0.0), 70.0) + 0.28 * pow(max(dot(n, hv), 0.0), 14.0);
  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.6);          // thin edges let the light through
  float near = smoothstep(0.0, 60.0, vP.z);                  // where it leaves the page it is in the page's shadow
  float c;
  if (uMode < 0.5) c = 0.035 + 0.20 * diff + 0.85 * spec + 0.26 * rim * near + 0.10 * (1.0 - near) * 0.0;
  else c = (0.97 - 0.60 * pow(1.0 - diff, 1.2) - 0.22 * pow(1.0 - clamp(n.z, 0.0, 1.0), 1.5)) * mix(0.62, 1.0, near) + 0.10 * spec;
  c *= mix(0.55, 1.0, near) * 0.0 + 1.0;
  o = vec4(vec3(clamp(c, 0.0, 1.0)), 1.0);
}`;
const PLATE_VS = `#version 300 es
out vec2 vUv;
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.9999, 1.0); }`;
const PLATE_FS = `#version 300 es
precision highp float;
uniform sampler2D uMask;
uniform vec2 uTexel;
uniform float uMode;
in vec2 vUv;
out vec4 o;
void main() {
  vec2 uv = vec2(vUv.x, vUv.y);
  float m = texture(uMask, uv).r;
  float e = 0.0; for (int i = 0; i < 4; i++) { vec2 d = vec2(i < 2 ? (i == 0 ? 1.0 : -1.0) : 0.0, i >= 2 ? (i == 2 ? 1.0 : -1.0) : 0.0) * uTexel * 5.0; e += texture(uMask, uv + d).r; }
  e *= 0.25;
  float ink = mix(0.0, 1.0, uMode), paper = 1.0 - ink;
  float hole = smoothstep(0.4, 0.6, m);
  float lip = hole * (1.0 - e) * 0.0;
  float c = mix(paper, ink, hole);
  o = vec4(vec3(c), 1.0);
}`;

export function mount(stage) {
  const canvas = stage.canvas, gl = getGL(canvas, { depth: true });
  if (!gl) throw new Error('webgl2 unavailable');
  if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('OES_texture_float_linear')) { /* float textures are read with texelFetch only, no filtering needed */ }
  const offs = [];
  // Motion settings (panel: ?tune, or T). Distances are in letter heights, so they scale with the screen.
  const DEFAULTS = {
    feed: 0.95, reach: 1.15, tap: 0.5, ramp: 0.25,                // how fast dough comes out, how far a hold goes, a tap's length, how long it takes to build up speed (s)
    sagFeed: 0.12, stiffFeed: 0.75, dampFeed: 0.96, lean: 0.1,      // while it comes out: how much it sags, how stiff it is, how much motion it keeps, how far it leans sideways
    gravity: 9.5, stiffFree: 0.85, dampFree: 0.99, cutKick: 0.1,   // once cut: gravity, stiffness, motion kept, the push the cutter gives
    ledge: 0.34, stick: 0.82, squash: 0.35, swell: 0.07,           // landing: the radius it rests on, how much sideways speed is lost, how much it squashes on impact, swell at the die
    keep: 6,                                                       // pieces kept on the ledge
  };
  const P = { ...DEFAULTS };
  const mode = stage.flip ? 1 : 0;
  stage.setBackdrop(mode ? 0 : 1);

  const dough = compile(gl, VS, DOUGH_FS), cap = compile(gl, CAP_VS, DOUGH_FS), plate = compile(gl, PLATE_VS, PLATE_FS);
  const emptyVao = gl.createVertexArray();

  // ---------- layout ----------
  let W = 1, H = 1, letters = [], D = 2000, floorY = 0;
  const maskTex = texture(gl, { w: 1, h: 1 });
  let hitPix = null, hitW = 1;
  const contourTex = gl.createTexture(), tileTex = gl.createTexture(), frameTex = gl.createTexture();
  let letterGeom = new Map();                                              // ch -> { M, indexBuf, vao, count, row }

  function layout() {
    W = stage.W; H = stage.H;
    const portrait = W / H < 0.85, rows = portrait ? ['IDAN', 'SE', 'GEV'] : ['IDAN', 'SEGEV'];
    const padX = Math.max(14, W * 0.045), top = Math.max(18, H * 0.04), bottom = 96, availW = W - 2 * padX, availH = H - top - bottom, gap = 0.1, rowGap = 0.12;
    const adv = (c) => glyphContours(c, FACE, FACE_W).adv + gap;
    let h = Infinity;
    for (const row of rows) h = Math.min(h, availW / [...row].reduce((s, c) => s + adv(c), 0));
    h = Math.min(h, availH / (rows.length * (1 + rowGap)));
    const total = rows.length * h * (1 + rowGap) - h * rowGap;
    let y = top + (availH - total) / 2 + h / 2;
    letters = [];
    for (const row of rows) {
      const rowW = [...row].reduce((s, c) => s + adv(c) * h, 0) - gap * h;
      let x = (W - rowW) / 2;
      for (const c of row) {
        const gc = glyphContours(c, FACE, FACE_W);
        letters.push({ ch: c, cx: x + gc.lb * h, cy: y, h, gc, noodle: null });
        x += adv(c) * h;
      }
      y += h * (1 + rowGap);
    }
    D = 0.95 * Math.max(W, H);
    floorY = H / 2 - (H - 90);                                              // the ledge, in world coordinates (y up from the middle of the screen)
  }
  const toWorld = (x, y) => [x - W / 2, H / 2 - y];

  function drawMasks() {
    // the page picture of the cut-outs (white where there is a hole), at device resolution
    const sc = stage.pw / W, c = document.createElement('canvas'); c.width = stage.pw; c.height = stage.ph;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
    g.font = `${FACE_W} 100px ${FACE}`; const cap100 = g.measureText('H').actualBoundingBoxAscent || 72;
    for (const L of letters) {
      const fs = L.h * sc / (cap100 / 100); g.font = `${FACE_W} ${fs}px ${FACE}`;
      const m = g.measureText(L.ch);
      g.fillText(L.ch, (L.cx * sc) - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2 + m.actualBoundingBoxLeft - m.actualBoundingBoxLeft, (L.cy + L.h / 2) * sc);
    }
    uploadCanvas(gl, maskTex, c);
    hitW = stage.pw; hitPix = g.getImageData(0, 0, c.width, c.height).data;
    // a small picture of each letter, for the caps
    const T = 256, tile = document.createElement('canvas'); tile.width = T * NEEDS.length; tile.height = T;
    const tg = tile.getContext('2d'); tg.fillStyle = '#000'; tg.fillRect(0, 0, tile.width, tile.height); tg.fillStyle = '#fff'; tg.textBaseline = 'alphabetic';
    const per = T / 1.56;                                                    // pixels per cap unit
    NEEDS.forEach((ch, i) => {
      tg.font = `${FACE_W} 100px ${FACE}`; const capA = tg.measureText('H').actualBoundingBoxAscent || 72;
      tg.font = `${FACE_W} ${per / (capA / 100)}px ${FACE}`;
      const m = tg.measureText(ch);
      tg.fillText(ch, i * T + T / 2 - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2 + m.actualBoundingBoxLeft - m.actualBoundingBoxLeft, T / 2 + per / 2);
    });
    gl.bindTexture(gl.TEXTURE_2D, tileTex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tile);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  }
  // the outline points of every letter, in one float texture (a row per letter), and the index buffer that sweeps them
  function buildGeometry() {
    const chars = [...new Set(letters.map((l) => l.ch))];
    let Mmax = 1; for (const ch of chars) Mmax = Math.max(Mmax, glyphContours(ch, FACE, FACE_W).loops.reduce((s, l) => s + l.pts.length, 0));
    const data = new Float32Array(Mmax * chars.length * 4);
    letterGeom = new Map();
    chars.forEach((ch, row) => {
      const gc = glyphContours(ch, FACE, FACE_W); let start = 0; const idx = [], M = gc.loops.reduce((s, l) => s + l.pts.length, 0);
      for (const lp of gc.loops) {
        const n = lp.pts.length;
        for (let j = 0; j < n; j++) { const o = (row * Mmax + start + j) * 4; data[o] = lp.pts[j][0]; data[o + 1] = lp.pts[j][1]; data[o + 2] = start + (j - 1 + n) % n; data[o + 3] = start + (j + 1) % n; }
        for (let v = 0; v < K - 1; v++) for (let j = 0; j < n; j++) {
          const a = v * M + start + j, b = v * M + start + (j + 1) % n, a2 = (v + 1) * M + start + j, b2 = (v + 1) * M + start + (j + 1) % n;
          idx.push(a, b, a2, b, b2, a2);
        }
        start += n;
      }
      // the index buffer is ring-major only per loop here, so order the indices by ring to let a draw stop early
      const per = idx.length / (K - 1), ordered = new Uint32Array(idx.length);
      const loopsIdx = []; let st = 0; for (const lp of gc.loops) { loopsIdx.push([st, lp.pts.length]); st += lp.pts.length; }
      let w = 0;
      for (let v = 0; v < K - 1; v++) for (const [s0, n] of loopsIdx) for (let j = 0; j < n; j++) {
        const a = v * M + s0 + j, b = v * M + s0 + (j + 1) % n, a2 = (v + 1) * M + s0 + j, b2 = (v + 1) * M + s0 + (j + 1) % n;
        ordered[w++] = a; ordered[w++] = b; ordered[w++] = a2; ordered[w++] = b; ordered[w++] = b2; ordered[w++] = a2;
      }
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf);
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ordered, gl.STATIC_DRAW); gl.bindVertexArray(null);
      letterGeom.set(ch, { M, row, perRing: per, vao, tile: NEEDS.indexOf(ch) });
    });
    gl.bindTexture(gl.TEXTURE_2D, contourTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, Mmax, chars.length, 0, gl.RGBA, gl.FLOAT, data);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.bindTexture(gl.TEXTURE_2D, frameTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, K * 3, SLOTS, 0, gl.RGBA, gl.FLOAT, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  }

  // ---------- the dough ----------
  // A piece: a chain of particles. While it feeds, the first particle is the die (pinned in the hole, its distance to the next
  // one growing as dough comes out); once cut every particle is free.
  const pieces = [];
  const freeSlots = () => { const used = new Set(pieces.map((p) => p.slot)); for (let s = 0; s < SLOTS; s++) if (!used.has(s)) return s; return -1; };
  const frames = new Float32Array(K * 3 * 4);

  function startPiece(L) {
    const slot = freeSlots();
    if (slot < 0) { const old = pieces.find((p) => !p.feeding && !p.dying); if (old) old.dying = 0.0001; return null; }
    const [bx, by] = toWorld(L.cx, L.cy), h = L.h, ds = h * 0.05;
    const p = { L, slot, feeding: true, cut: false, n: 2, ds, d0: ds * 0.2, base: [bx, by, 0], lean: [(Math.random() - 0.5) * 0.5, -0.5 - Math.random() * 0.3], x: new Float32Array(K), y: new Float32Array(K), z: new Float32Array(K), vx: new Float32Array(K), vy: new Float32Array(K), vz: new Float32Array(K), age: 0, hold: 0, dying: 0, shrink: 1,
      X0: [1, 0, 0], T0: [0, 0, 1], target: Infinity, pressed: true, release: 0 };
    p.x[0] = bx; p.y[0] = by; p.z[0] = 0; p.x[1] = bx; p.y[1] = by; p.z[1] = ds * 0.2;
    pieces.push(p); L.noodle = p;
    return p;
  }
  // The cutter: the piece comes away from the die and drops straight, keeping its letter facing you (it is moved clear of the page first,
  // so the page does not fold it).
  function detach(p) {
    if (p.free) return;
    const h = p.L.h; p.free = true; p.feeding = false; p.cut = true; p.L.noodle = null;
    let zmin = Infinity; for (let i = 0; i < p.n; i++) zmin = Math.min(zmin, p.z[i]);
    const dz = Math.max(0, h * 0.46 - zmin); for (let i = 0; i < p.n; i++) { p.z[i] += dz; p.vy[i] -= h * P.cutKick; }
  }
  function stepPiece(p, dt) {
    const L = p.L, h = L.h, ds = p.ds, g = h * P.gravity;
    p.age += dt;
    if (p.squashT > 0) p.squashT = Math.max(0, p.squashT - dt * 2.2);
    if (p.cut && !p.feeding && !p.free) detach(p);
    if (p.dying) { p.dying += dt; p.shrink = Math.max(0, 1 - p.dying / 0.7); if (p.dying > 0.7) return false; }
    const n = p.n;
    if (p.feeding) {
      const reach = Math.min(p.target, h * P.reach);
      if ((n - 1) * ds + p.d0 < reach) {
        p.d0 += h * P.feed * Math.min(1, p.age / Math.max(0.01, P.ramp)) * dt;                     // dough comes out slowly at first, then at full speed
        if (p.d0 >= ds && n < K - 1) {                                   // a new ring of dough comes through the die
          for (let i = n; i > 1; i--) { p.x[i] = p.x[i - 1]; p.y[i] = p.y[i - 1]; p.z[i] = p.z[i - 1]; p.vx[i] = p.vx[i - 1]; p.vy[i] = p.vy[i - 1]; p.vz[i] = p.vz[i - 1]; }
          p.x[1] = p.base[0]; p.y[1] = p.base[1]; p.z[1] = ds * 0.3; p.vx[1] = p.vy[1] = 0; p.vz[1] = 0; p.n++; p.d0 = ds * 0.3;
        }
      } else if (!p.pressed && !p.cut) detach(p);
    }
    const nn = p.n, damp = p.feeding ? P.dampFeed : P.dampFree;
    // forces
    for (let i = p.feeding ? 1 : 0; i < nn; i++) {
      p.vy[i] += -g * dt * (p.feeding ? P.sagFeed : 1); 
      if (p.feeding) { p.vx[i] += p.lean[0] * g * 0.18 * P.lean * 2.5 * dt; }
    }
    for (let i = p.feeding ? 1 : 0; i < nn; i++) {
      p.vx[i] *= damp; p.vy[i] *= damp; p.vz[i] *= damp;
      p.x[i] += p.vx[i] * dt; p.y[i] += p.vy[i] * dt; p.z[i] += p.vz[i] * dt;
    }
    // constraints
    for (let it = 0; it < 10; it++) {
      if (p.feeding) { p.x[0] = p.base[0]; p.y[0] = p.base[1]; p.z[0] = 0; }
      for (let i = 0; i < nn - 1; i++) {                                  // fixed segment length (the first one grows while feeding)
        const rest = i === 0 && p.feeding ? p.d0 : ds;
        let dx = p.x[i + 1] - p.x[i], dy = p.y[i + 1] - p.y[i], dz = p.z[i + 1] - p.z[i]; const d = Math.hypot(dx, dy, dz) || 1e-6, k = (d - rest) / d;
        const w0 = i === 0 && p.feeding ? 0 : 0.5, w1 = i === 0 && p.feeding ? 1 : 0.5;
        p.x[i] += dx * k * w0; p.y[i] += dy * k * w0; p.z[i] += dz * k * w0; p.x[i + 1] -= dx * k * w1; p.y[i + 1] -= dy * k * w1; p.z[i + 1] -= dz * k * w1;
      }
      for (let i = 1; i < nn - 1; i++) {                                  // bending stiffness: a prism of dough is not a rope
        const tx = p.x[i] - p.x[i - 1], ty = p.y[i] - p.y[i - 1], tz = p.z[i] - p.z[i - 1], tl = Math.hypot(tx, ty, tz) || 1e-6;
        const kb = p.feeding ? P.stiffFeed : P.stiffFree, ex = p.x[i] + tx / tl * ds, ey = p.y[i] + ty / tl * ds, ez = p.z[i] + tz / tl * ds;
        p.x[i + 1] += (ex - p.x[i + 1]) * kb; p.y[i + 1] += (ey - p.y[i + 1]) * kb; p.z[i + 1] += (ez - p.z[i + 1]) * kb;
      }
      if (p.feeding) for (let i = 1; i < nn; i++) if (p.z[i] < ds * 1.6) { const w = 1 - p.z[i] / (ds * 1.6); p.x[i] += (p.base[0] - p.x[i]) * 0.5 * w; p.y[i] += (p.base[1] - p.y[i]) * 0.5 * w; }   // the barrel of the die: dough leaves straight
      for (let i = 0; i < nn; i++) {                                      // the page behind (z >= 0) and the ledge below
        const rr = h * P.ledge, minZ = p.feeding ? 0 : h * 0.46;
        if (p.z[i] < minZ) { p.z[i] = minZ; p.vz[i] = Math.max(0, p.vz[i]); }
        if (!p.feeding && p.y[i] < floorY + rr) { if (p.vy[i] < -h * 1.5) p.squashT = 1;                         // a hard landing squashes it
          p.y[i] = floorY + rr; p.vy[i] = Math.max(0, p.vy[i]) * 0.1; p.vx[i] *= P.stick; p.vz[i] *= P.stick; }
      }
    }
    return true;
  }
  function writeFrames(p) {
    const n = p.n, h = p.L.h;
    const T = (i) => { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); const x = p.x[b] - p.x[a], y = p.y[b] - p.y[a], z = p.z[b] - p.z[a], l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
    let t0 = T(0);
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
    const transport = (X, ta, tb) => {                                      // turn X by the smallest rotation taking ta to tb
      const ax = cross(ta, tb), s = Math.hypot(...ax), c = dot(ta, tb);
      if (s < 1e-6) return X;
      const k = [ax[0] / s, ax[1] / s, ax[2] / s], ang = Math.atan2(s, c), cs = Math.cos(ang), sn = Math.sin(ang), kd = dot(k, X), kx = cross(k, X);
      return [X[0] * cs + kx[0] * sn + k[0] * kd * (1 - cs), X[1] * cs + kx[1] * sn + k[1] * kd * (1 - cs), X[2] * cs + kx[2] * sn + k[2] * kd * (1 - cs)];
    };
    let X = transport(p.X0, p.T0, t0); X = norm([X[0] - t0[0] * dot(X, t0), X[1] - t0[1] * dot(X, t0), X[2] - t0[2] * dot(X, t0)]); p.X0 = X; p.T0 = t0;
    let prevT = t0;
    for (let i = 0; i < n; i++) {
      const t = T(i);
      if (i > 0) { X = transport(X, prevT, t); X = norm([X[0] - t[0] * dot(X, t), X[1] - t[1] * dot(X, t), X[2] - t[2] * dot(X, t)]); }
      const Y = cross(t, X), swell = 1 + P.swell * Math.exp(-p.z[i] / (h * 0.25)) + (p.feeding && i === n - 1 ? 0.03 : 0) - (p.squashT > 0 ? P.squash * p.squashT * Math.sin(i / Math.max(1, n - 1) * Math.PI) * 0.35 : 0), o = i * 12;
      frames[o] = p.x[i]; frames[o + 1] = p.y[i]; frames[o + 2] = p.z[i]; frames[o + 3] = swell;
      frames[o + 4] = X[0]; frames[o + 5] = X[1]; frames[o + 6] = X[2]; frames[o + 7] = 0;
      frames[o + 8] = Y[0]; frames[o + 9] = Y[1]; frames[o + 10] = Y[2]; frames[o + 11] = 0;
      prevT = t;
    }
    gl.bindTexture(gl.TEXTURE_2D, frameTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, p.slot, K * 3, 1, gl.RGBA, gl.FLOAT, frames);
  }

  // ---------- touch ----------
  let press = null;
  const letterAt = (q) => {
    const sc = hitW / W, x = Math.floor(q.x * sc), y = Math.floor(q.y * sc);
    if (!hitPix || hitPix[(y * hitW + x) * 4] < 128) return null;
    let best = null, bd = 1e9; for (const L of letters) { const d = Math.hypot(q.x - L.cx, q.y - L.cy); if (d < bd) { bd = d; best = L; } }
    return best;
  };
  offs.push(stage.on('down', (q) => {
    const L = letterAt(q); if (!L || L.noodle) return;
    const p = startPiece(L); if (p) press = { p, t: performance.now() };
  }));
  const release = () => {
    if (!press) return;
    const p = press.p; p.pressed = false;
    if (performance.now() - press.t < 260) p.target = p.L.h * P.tap;   // a tap: a short squirt, then cut
    else p.target = (p.n - 1) * p.ds + p.d0;                                                                   // a hold: cut where it is
    press = null;
  };
  offs.push(stage.on('up', release));

  function resize() { layout(); drawMasks(); buildGeometry(); for (const p of pieces.splice(0)) { p.L.noodle = null; } }
  offs.push(stage.on('resize', resize));
  resize();

  // ---------- frame ----------
  let acc = 0;
  function stepAll() {
    {
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        if (!p.feeding && p.L.noodle === p) p.L.noodle = null;
        if (!stepPiece(p, 1 / 120)) pieces.splice(i, 1);
        else if (p.cut === false && !p.pressed && !p.feeding) p.cut = true;
      }
      // a piece that has reached its length with the finger up is cut
      for (const p of pieces) if (p.feeding && !p.pressed && (p.n - 1) * p.ds + p.d0 >= p.target - 1e-3) detach(p);
      const resting = pieces.filter((p) => !p.feeding && !p.dying);
      if (resting.length > P.keep) resting[0].dying = 0.0001;
    }
  }
  function render() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, stage.pw, stage.ph);
    gl.clearColor(mode ? 0 : 1, mode ? 0 : 1, mode ? 0 : 1, 1); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // the page
    gl.disable(gl.DEPTH_TEST); plate.use(); gl.bindVertexArray(emptyVao);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, maskTex); gl.uniform1i(plate.u.uMask, 0);
    gl.uniform2f(plate.u.uTexel, 1 / stage.pw, 1 / stage.ph); gl.uniform1f(plate.u.uMode, mode);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // the dough
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.CULL_FACE);
    for (const p of pieces) {
      const geo = letterGeom.get(p.L.ch); if (!geo || p.n < 3) continue;
      writeFrames(p);
      dough.use(); const u = dough.u;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, frameTex); gl.uniform1i(u.uFrames, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, contourTex); gl.uniform1i(u.uContour, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tileTex); gl.uniform1i(u.uTile, 2);
      gl.uniform1i(u.uM, geo.M); gl.uniform1i(u.uSlot, p.slot); gl.uniform1i(u.uLetter, geo.row); gl.uniform1i(u.uN, p.n);
      gl.uniform1f(u.uH, p.L.h); gl.uniform1f(u.uFlip, 1); gl.uniform1f(u.uShrink, p.shrink); gl.uniform2f(u.uRes, W, H); gl.uniform1f(u.uD, D); gl.uniform1f(u.uMode, mode); gl.uniform1f(u.uCap, 0);
      gl.bindVertexArray(geo.vao);
      gl.drawElements(gl.TRIANGLES, geo.perRing * (p.n - 1), gl.UNSIGNED_INT, 0);
      // caps: the free end, and the cut end once it is cut
      cap.use(); const c = cap.u;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, frameTex); gl.uniform1i(c.uFrames, 0);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tileTex); gl.uniform1i(c.uTile, 2);
      gl.uniform1i(c.uSlot, p.slot); gl.uniform1f(c.uH, p.L.h); gl.uniform1f(c.uShrink, p.shrink); gl.uniform2f(c.uRes, W, H); gl.uniform1f(c.uD, D);
      gl.uniform1f(c.uMode, mode); gl.uniform1f(c.uCap, 1); gl.uniform1f(c.uTileIdx, geo.tile);
      gl.bindVertexArray(emptyVao);
      gl.uniform1i(c.uRing, p.n - 1); gl.uniform1f(c.uSign, 1); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!p.feeding) { gl.uniform1i(c.uRing, 0); gl.uniform1f(c.uSign, -1); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
    }
  }
  offs.push(stage.frame((dt) => {
    acc = Math.min(acc + dt, 0.05);
    while (acc >= 1 / 120) { acc -= 1 / 120; stepAll(); }
    render();
  }));

  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  const squirt = (i, hold) => { const p = startPiece(letters[i]); if (!p) return; if (hold === 0) { p.pressed = false; p.target = p.L.h * P.tap; } else { setTimeout(() => { p.pressed = false; p.target = (p.n - 1) * p.ds + p.d0; }, hold * 1000); } };
  return {
    tune: {
      title: 'Extrude', values: P, defaults: DEFAULTS,
      groups: [
        { name: 'Coming out', items: [Ctl('feed', 'Feed speed (letter heights per s)', 0.2, 3, 0.05), Ctl('ramp', 'Time to reach full speed (s)', 0.01, 1.2, 0.01), Ctl('reach', 'Longest it gets (letter heights)', 0.3, 2.2, 0.05), Ctl('tap', 'Length of a tap', 0.15, 1.2, 0.05), Ctl('swell', 'Swell at the die', 0, 0.3, 0.01)] },
        { name: 'While attached', items: [Ctl('stiffFeed', 'Stiffness', 0.05, 0.95, 0.01), Ctl('sagFeed', 'Sag', 0, 1.2, 0.02), Ctl('lean', 'Sideways lean', 0, 1.5, 0.05), Ctl('dampFeed', 'Motion kept (1 = wobbles on)', 0.85, 0.999, 0.001)] },
        { name: 'After the cut', items: [Ctl('gravity', 'Gravity', 2, 24, 0.5), Ctl('stiffFree', 'Stiffness', 0.05, 0.95, 0.01), Ctl('dampFree', 'Motion kept (1 = wobbles on)', 0.9, 0.999, 0.001), Ctl('cutKick', 'Push from the cutter', 0, 2, 0.05)] },
        { name: 'Landing', items: [Ctl('ledge', 'Rests on a radius of', 0.1, 0.6, 0.01), Ctl('stick', 'Stickiness (1 = slides)', 0.3, 1, 0.01), Ctl('squash', 'Squash on impact', 0, 1.5, 0.05), Ctl('keep', 'Pieces kept', 1, 9, 1)] },
      ],
      actions: {
        'Tap D': () => squirt(1, 0), 'Hold E for 1 s': () => squirt(5, 1), 'Tap A': () => squirt(2, 0), 'Sweep up': () => { for (const p of pieces.splice(0)) p.L.noodle = null; },
      },
      set(key, value) { P[key] = value; },
      reset() { Object.assign(P, DEFAULTS); },
    },
    debug: { pieces: () => pieces, letters: () => letters, start: (i) => startPiece(letters[i]), run: (n) => { for (let i = 0; i < n; i++) stepAll(); render(); }, P },
    destroy() { offs.forEach((f) => f()); stage.setBackdrop(null); },
  };
}
