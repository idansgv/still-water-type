// Jet: the name written by a stream of water flowing in mid-air along the letters' centre lines, as if a hose could write.
// Each letter's water rises from its lowest point and runs out to the stroke ends; pulses ride with it so you see it flow.
// Port of the test page docs/posters/prototypes/jet.html with Idan's tuning (5 Nov 2026). Idea after prinzipiell/tsl
// "Splish Splash" (no license: the idea only, our own code).
//
// Under the picture (raw WebGL2): Inter Tight 600 mask -> Zhang-Suen thinning -> a tree from each letter's lowest pixel -> short
// spurs pruned -> smoothed chains (as Arboretum). Particles in the stream are kinematic: emitted at each chain's start at the flow
// rate, carried along it, offset across the jet's width. Knocked-out water is a live 2D liquid (Clavet double-density relaxation,
// as Rewind, run per frame) under gravity; it fades and goes back into a shared reserve that feeds the sources, so a cut gap is
// carried downstream and the stream re-forms by itself. Render: Rewind's metaball splat (Gaussian field plus droplet discs,
// thresholded) in pure ink on the page colour.
//
// Gestures (src/gestures.js): drag cuts the stream; tap on the water splashes it; tap on the page away from the water drains it:
// as if held, with the sources shut, until the letters are empty, then they fill again (Idan, 5 Nov 2026); hold turns up the pressure (faster, wider, the stroke ends spray); double tap sends
// the loose water back into the stream (a beat later, so a third tap can still mean reveal). Reveal: the centre lines, each
// source and every particle. Self-demo: one cut across the name until the first touch. The water flows at rest (Idan's call, like
// Arboretum's wind); under reduced motion it stands still until touched.

import { getGL, mulberry32 } from '../engine.js';
import { pressTracker, TAP, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';
import { createReveal, grid as rvGrid, corners, titleBlock, ink as rvInk } from './reveal.js';
import { linesFor, lettersFor } from '../name.js';

const FAMILY = 'Inter Tight', WEIGHT = 600, OWN = ['Idan', 'Segev'];
// Idan's tuning from the test page (5 Nov 2026)
const DEF = { width: 1.25, speed: 1.3, pulse: 0.29, shine: 0, spray: 1, cut: 2.15, fling: 0.75, splash: 1.85, grav: 0.55, life: 3.2, tens: 1.35, visc: 1, th: 0.29, blur: 1.8, drop: 0.3, k: 0.3, kn: 0.5, dmax: 0.05 };
const FREE = 0, ON = 1, LOOSE = 2, HOME = 3;
const M = 28, SIM_H = 2.1;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- centre lines ----------
function thin(m, W, x0, y0, x1, y1) {
  const del = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = Math.max(1, y0); y <= Math.min(y1, (m.length / W) - 2); y++) for (let x = Math.max(1, x0); x <= x1; x++) {
        const i = y * W + x; if (!m[i]) continue;
        const p2 = m[i - W], p3 = m[i - W + 1], p4 = m[i + 1], p5 = m[i + W + 1], p6 = m[i + W], p7 = m[i + W - 1], p8 = m[i - 1], p9 = m[i - W - 1];
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (B < 2 || B > 6) continue;
        const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2);
        if (A !== 1) continue;
        if (pass === 0 ? (p2 && p4 && p6) || (p4 && p6 && p8) : (p2 && p4 && p8) || (p2 && p6 && p8)) continue;
        del.push(i);
      }
      if (del.length) { changed = true; for (const i of del) m[i] = 0; }
    }
  }
}
function smooth(pts) {
  if (pts.length < 5) return pts;
  const r = 3, o = pts.map((p) => ({ ...p }));
  for (let i = 1; i < pts.length - 1; i++) {
    const k = Math.min(r, i, pts.length - 1 - i);
    let sx = 0, sy = 0;
    for (let j = -k; j <= k; j++) { sx += pts[i + j].x; sy += pts[i + j].y; }
    o[i].x = sx / (2 * k + 1); o[i].y = sy / (2 * k + 1);
  }
  return o;
}
function buildSkeleton(lines) {
  const fs = 220, font = `${WEIGHT} ${fs}px "${FAMILY}", "Helvetica Neue", Arial, sans-serif`;
  const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
  g.font = font;
  const cap = g.measureText('H').actualBoundingBoxAscent;
  const lh = fs * 1.12, pad = Math.round(fs * 0.3);
  const W = Math.ceil(Math.max(...lines.map((l) => g.measureText(l).width))) + pad * 2;
  const H = Math.ceil(cap + (lines.length - 1) * lh + fs * 0.32) + pad * 2;
  c.width = W; c.height = H;
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#000';
  lines.forEach((l, i) => g.fillText(l, W / 2, pad + cap + i * lh));
  const px = g.getImageData(0, 0, W, H).data;
  const m = new Uint8Array(W * H);
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3] > 127) {
    m[y * W + x] = 1; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  thin(m, W, x0, y0, x1, y1);
  const N8 = [-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1];
  const seen = new Uint8Array(W * H), parent = new Int32Array(W * H).fill(-1), dist = new Float32Array(W * H);
  const comps = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const s = y * W + x;
    if (!m[s] || seen[s]) continue;
    // flood the component; its lowest pixel (closest to centre on ties) is the root: the water's source
    const pix = [s]; seen[s] = 1;
    for (let k = 0; k < pix.length; k++) for (const o of N8) { const j = pix[k] + o; if (m[j] && !seen[j]) { seen[j] = 1; pix.push(j); } }
    if (pix.length < 10) continue;
    let root = pix[0], ry = -1, rcx = 0;
    for (const p of pix) rcx += p % W; rcx /= pix.length;
    for (const p of pix) { const py = (p / W) | 0, pxx = p % W; if (py > ry || (py === ry && Math.abs(pxx - rcx) < Math.abs(root % W - rcx))) { ry = py; root = p; } }
    const order = [root], inT = new Set([root]); dist[root] = 0;
    for (let k = 0; k < order.length; k++) {
      const p = order[k];
      for (const o of [-W, -1, 1, W, -W - 1, -W + 1, W - 1, W + 1]) {
        const j = p + o;
        if (m[j] && !inT.has(j)) { inT.add(j); parent[j] = p; dist[j] = dist[p] + (o === -W || o === W || o === 1 || o === -1 ? 1 : Math.SQRT2); order.push(j); }
      }
    }
    comps.push({ root, order });
  }
  // prune short leaf spurs (thinning artefacts at corners and terminals)
  const alive = new Uint8Array(W * H), kidsN = new Int32Array(W * H);
  for (const cp of comps) for (const p of cp.order) { alive[p] = 1; if (parent[p] >= 0) kidsN[parent[p]]++; }
  const minSpur = cap * 0.13;
  for (let pass = 0; pass < 3; pass++) for (const cp of comps) for (const leaf of cp.order) {
    if (!alive[leaf] || kidsN[leaf] > 0) continue;
    const path = [leaf]; let cur = parent[leaf];
    while (cur >= 0 && kidsN[cur] === 1) { path.push(cur); cur = parent[cur]; }
    if (cur < 0 || dist[leaf] - dist[cur] >= minSpur) continue;
    for (const p of path) alive[p] = 0;
    kidsN[cur]--;
  }
  const out = { chains: [], cap, bbox: [x0, y0, x1, y1] };
  for (const cp of comps) {
    const ord = cp.order.filter((p) => alive[p]);
    const kids = new Map();
    for (const p of ord) if (parent[p] >= 0) { if (!kids.has(parent[p])) kids.set(parent[p], []); kids.get(parent[p]).push(p); }
    const pt = (p) => ({ x: p % W, y: (p / W) | 0 });
    const stack = [cp.root];
    while (stack.length) {
      const s = stack.pop();
      for (const c0 of kids.get(s) || []) {
        const ch = [s, c0]; let cur = c0;
        while ((kids.get(cur) || []).length === 1) { cur = kids.get(cur)[0]; ch.push(cur); }
        if ((kids.get(cur) || []).length > 1) stack.push(cur);
        const sm = smooth(ch.map(pt));
        sm.terminal = !(kids.get(cur) || []).length;
        out.chains.push(sm);
      }
    }
  }
  return out;
}
function resample(pts, k, ox0, oy0, step) {
  const sx = pts.map((p) => p.x * k + ox0), sy = pts.map((p) => p.y * k + oy0);
  const cum = [0];
  for (let i = 1; i < sx.length; i++) cum.push(cum[i - 1] + Math.hypot(sx[i] - sx[i - 1], sy[i] - sy[i - 1]));
  const len = cum[cum.length - 1], n = Math.max(2, Math.ceil(len / step) + 1);
  const X = new Float32Array(n), Y = new Float32Array(n), NX = new Float32Array(n), NY = new Float32Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.min(len, i * step);
    while (j < cum.length - 2 && cum[j + 1] < a) j++;
    const seg = cum[j + 1] - cum[j] || 1, f = (a - cum[j]) / seg;
    X[i] = sx[j] + (sx[j + 1] - sx[j]) * f; Y[i] = sy[j] + (sy[j + 1] - sy[j]) * f;
  }
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 2);
    let tx = X[b] - X[a], ty = Y[b] - Y[a]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    NX[i] = -ty; NY[i] = tx;
  }
  return { X, Y, NX, NY, n, len, step };
}
function latticeSum(fn, R) {
  let sum = 0; const dy = Math.sqrt(3) / 2;
  for (let r = -R; r <= R; r++) for (let c = -R; c <= R; c++) {
    const xx = c + (r & 1 ? 0.5 : 0), yy = r * dy, d = Math.hypot(xx, yy);
    if (d > 0) sum += fn(d);
  }
  return sum;
}
const RHO0 = latticeSum((d) => (d < SIM_H ? (1 - d / SIM_H) ** 2 : 0), 6);
const RHON0 = latticeSum((d) => (d < SIM_H ? (1 - d / SIM_H) ** 3 : 0), 6);

const VS_SPLAT = `#version 300 es
layout(location=0) in vec3 aP; uniform vec2 uRes; uniform float uSize; out float vW;
void main() { vW = aP.z; gl_Position = vec4(aP.x / uRes.x * 2.0 - 1.0, 1.0 - aP.y / uRes.y * 2.0, 0.0, 1.0); gl_PointSize = uSize; }`;
const FS_SPLAT = `#version 300 es
precision highp float; in float vW; uniform float uR; uniform float uSig; uniform float uDisc; uniform float uScale; out vec4 o;
void main() {
  float d = length(gl_PointCoord * 2.0 - 1.0) * uR;
  if (d > uR) discard;
  float w = exp(-d * d / (uSig * uSig)) * uScale * vW;
  float a = clamp(uDisc * vW - d + 0.5, 0.0, 1.0);
  o = vec4(w, 0.0, 0.0, a);
}`;
const VS_FULL = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
const FS_COMP = `#version 300 es
precision highp float; uniform sampler2D uField; uniform vec2 uPx; uniform float uInv; uniform float uTh; uniform float uShine; uniform float uRad;
uniform vec3 uBg; uniform vec3 uInk; out vec4 o;
float hv(vec2 uv) { return smoothstep(0.5, 1.6, texture(uField, uv).r * uInv * 0.5 / uTh); }
void main() {
  vec2 uv = gl_FragCoord.xy * uPx;
  vec4 f = texture(uField, uv);
  float v = max(f.r * uInv * 0.5 / uTh, f.a);
  float aa = max(fwidth(v), 1e-4);
  float c = clamp((v - 0.5) / (aa * 1.4) + 0.5, 0.0, 1.0);
  // the water's highlight: the body read as a height field, lit from the upper left, its glint cut out in the page colour
  vec2 e = uPx * uRad;
  float gx = hv(uv + vec2(e.x, 0.0)) - hv(uv - vec2(e.x, 0.0)), gy = hv(uv + vec2(0.0, e.y)) - hv(uv - vec2(0.0, e.y));
  vec3 n = normalize(vec3(-gx * 4.0, -gy * 4.0, 1.0));
  vec3 l = normalize(vec3(-0.55, 0.65, 0.55));
  float spec = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 10.0);
  float g = spec * uShine;
  float sa = max(fwidth(g), 1e-4);
  float hi = clamp((g - 0.5) / (sa * 1.4) + 0.5, 0.0, 1.0) * c;
  o = vec4(mix(mix(uBg, uInk, c), uBg, hi), 1.0);
}`;

export async function mount(stage) {
  const canvas = stage.canvas, gl = getGL(canvas);
  if (!gl) throw new Error('webgl2 unavailable');
  const dark = stage.theme.name === 'dark';
  const P = { ...DEF };
  const offs = [];
  const rand = mulberry32((stage.seed | 0) + 7);
  const rnd = () => rand() - 0.5;
  const reduced = !!stage.reduced;
  let alive = true;
  stage.setBackdrop(dark ? 0 : 1);

  // ---------- the face: Inter Tight 600 from Google Fonts, only the letters needed ----------
  const words = linesFor(stage, OWN);
  const link = document.createElement('link'); link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=Inter+Tight:wght@600&text=${encodeURIComponent(lettersFor(stage, OWN.join('') + ' '))}&display=block`;
  document.head.appendChild(link);
  await Promise.race([new Promise((r) => { link.onload = r; link.onerror = r; }), new Promise((r) => setTimeout(r, 2500))]);
  try { await Promise.race([document.fonts.load(`${WEIGHT} 100px "${FAMILY}"`, words.join('')), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* the fallback face */ }

  // ---------- WebGL ----------
  const shaders = [];
  function prog(vs, fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
      gl.attachShader(p, s); shaders.push(s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    return p;
  }
  const splatP = prog(VS_SPLAT, FS_SPLAT), compP = prog(VS_FULL, FS_COMP);
  const U = (p, n) => gl.getUniformLocation(p, n);
  const uS = { res: U(splatP, 'uRes'), size: U(splatP, 'uSize'), r: U(splatP, 'uR'), sig: U(splatP, 'uSig'), disc: U(splatP, 'uDisc'), scale: U(splatP, 'uScale') };
  const uC = { field: U(compP, 'uField'), px: U(compP, 'uPx'), inv: U(compP, 'uInv'), th: U(compP, 'uTh'), shine: U(compP, 'uShine'), rad: U(compP, 'uRad'), bg: U(compP, 'uBg'), ink: U(compP, 'uInk') };
  const floatOK = !!gl.getExtension('EXT_color_buffer_float');
  const maxPoint = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];
  const vao = gl.createVertexArray(), buf = gl.createBuffer(), emptyVao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  let fieldTex = null, fbo = null, pts = new Float32Array(0);
  function makeTargets() {
    const w = stage.pw, h = stage.ph;
    if (fieldTex) gl.deleteTexture(fieldTex);
    if (fbo) gl.deleteFramebuffer(fbo);
    fieldTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, fieldTex);
    if (floatOK) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fieldTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // ---------- layout: one line on a wide screen, a word a line on a tall one ----------
  let W = 1, H = 1, dpr = 1, L = null;
  function layoutLines() { return W / H < 1 && words.length > 1 ? words.slice() : [words.join(' ')]; }
  function layout() {
    const lines = layoutLines();
    const sk = buildSkeleton(lines);
    const [x0, y0, x1, y1] = sk.bbox, bw = x1 - x0, bh = y1 - y0;
    const narrow = W < 640;
    const k = Math.min((narrow ? 0.84 : 0.72) * W / bw, (lines.length > 1 ? 0.5 : 0.34) * H / bh);
    const ox0 = W / 2 - (x0 + bw / 2) * k, oy0 = H * 0.44 - (y0 + bh / 2) * k;
    const cap = sk.cap * k;
    const R = Math.max(2.5, P.width * cap * 0.05);           // half the stream's width
    const s = clamp(R / 1.9, 1.6, 8);                         // particle spacing: about four across
    const chains = [];
    for (const c of sk.chains) {
      if (c.length < 2) continue;
      const ch = resample(c, k, ox0, oy0, 1.5);
      if (ch.len < 2) continue;
      ch.terminal = c.terminal; ch.acc = 0; ch.seq = rand();
      chains.push(ch);
    }
    const dens = (2 * R) / (s * s) * 1.15;                    // particles per px of stream
    const total = chains.reduce((a, c) => a + c.len, 0) * dens;
    return { chains, R, s, cap, dens, total };
  }

  // ---------- the stream ----------
  let N = 0, x, y, vx, vy, ox, oy, st, chI, arc, lat, age, life, wgt;
  let freeList = new Int32Array(0), nFree = 0, act = new Int32Array(0), nAct = 0;
  let rho, rhoN, pr, prN, cell, idx, start, cur, nb, nq, nux, nuy, cnt, gw = 0, gh = 0, gcell = 1;
  function alloc(n) {
    N = n;
    x = new Float32Array(N); y = new Float32Array(N); vx = new Float32Array(N); vy = new Float32Array(N); ox = new Float32Array(N); oy = new Float32Array(N);
    st = new Uint8Array(N); chI = new Int32Array(N); arc = new Float32Array(N); lat = new Float32Array(N); age = new Float32Array(N); life = new Float32Array(N); wgt = new Float32Array(N);
    rho = new Float32Array(N); rhoN = new Float32Array(N); pr = new Float32Array(N); prN = new Float32Array(N);
    cell = new Int32Array(N); idx = new Int32Array(N); act = new Int32Array(N);
    nb = new Int32Array(N * M); nq = new Float32Array(N * M); nux = new Float32Array(N * M); nuy = new Float32Array(N * M); cnt = new Int32Array(N);
    freeList = new Int32Array(N); nFree = 0;
    for (let i = N - 1; i >= 0; i--) freeList[nFree++] = i;
    pts = new Float32Array(3 * N);
  }
  const take = () => (nFree > 0 ? freeList[--nFree] : -1);
  const release = (i) => { st[i] = FREE; wgt[i] = 0; freeList[nFree++] = i; };

  let simT = 0, pres = 0, wakeUntil = 0, drain = false, nOn = 0;
  // under reduced motion the water stands still, and flows only for a few seconds after a touch so a cut can mend
  const flowPx = () => (reduced && performance.now() > wakeUntil ? 0 : (reduced ? 0.3 : 1)) * P.speed * L.cap * 0.9 * (1 + 1.6 * pres);
  // where the stream puts a particle: on the chain at arc length a, across the jet by lat
  const PL = [0, 0];
  function place(i, ch, a) {
    const f = clamp(a / ch.step, 0, ch.n - 1.001), j = f | 0, u = f - j;
    const cx = ch.X[j] + (ch.X[j + 1] - ch.X[j]) * u, cy = ch.Y[j] + (ch.Y[j + 1] - ch.Y[j]) * u;
    // pulses ride with the water (phase in the water's frame), so they show the flow
    const ph = (a - flowT) / (L.R * 12);
    const wob = 1 + P.pulse * (0.7 * Math.sin(ph * 6.2832) + 0.3 * Math.sin(ph * 2.3 * 6.2832 + 1.3));
    const r = L.R * (1 + 0.35 * pres) * wob;
    PL[0] = cx + ch.NX[j] * lat[i] * r; PL[1] = cy + ch.NY[j] * lat[i] * r;
  }
  let flowT = 0;   // how far the water has run: the pulses' phase
  const tangentAt = (ch, a) => { const j = clamp((a / ch.step) | 0, 0, ch.n - 1); return [ch.NY[j], -ch.NX[j]]; };
  function emit(ch, ci, a) {
    const i = take(); if (i < 0) return;
    st[i] = ON; chI[i] = ci; arc[i] = a; ch.seq = (ch.seq + 0.6180339887) % 1; lat[i] = ch.seq * 2 - 1; age[i] = 0; wgt[i] = 1;
    place(i, ch, a); x[i] = ox[i] = PL[0]; y[i] = oy[i] = PL[1];
    const [tx, ty] = tangentAt(ch, a), f = flowPx(); vx[i] = tx * f; vy[i] = ty * f;
  }
  function fill() { L.chains.forEach((ch, ci) => { for (let a = 0; a < ch.len; a += 1 / L.dens) emit(ch, ci, a); }); }
  function loosen(i, vxi, vyi) { st[i] = LOOSE; vx[i] = vxi; vy[i] = vyi; age[i] = 0; life[i] = P.life * (0.7 + 0.6 * rand()); }

  function grid() {
    start.fill(0);
    const ih = 1 / gcell;
    for (let k = 0; k < nAct; k++) {
      const i = act[k];
      const cx = clamp((x[i] * ih + 2) | 0, 0, gw - 1), cy = clamp((y[i] * ih + 2) | 0, 0, gh - 1);
      const c = cy * gw + cx; cell[i] = c; start[c + 1]++;
    }
    for (let c = 0; c < gw * gh; c++) { start[c + 1] += start[c]; cur[c] = start[c]; }
    for (let k = 0; k < nAct; k++) { const i = act[k]; idx[cur[cell[i]]++] = i; }
  }
  const HX = [0, 1, -1, 0, 1], HY = [0, 0, 1, 1, 1];
  function neighbours() {
    const h = gcell, h2 = h * h, ih = 1 / h;
    for (let k0 = 0; k0 < nAct; k0++) {
      const i = act[k0], xi = x[i], yi = y[i], c = cell[i], cx = c % gw, cy = (c / gw) | 0, base = i * M, onI = st[i] === ON;
      let n = 0;
      for (let s4 = 0; s4 < 5; s4++) {
        const xx = cx + HX[s4], yy = cy + HY[s4];
        if (xx < 0 || xx >= gw || yy >= gh) continue;
        const cc = yy * gw + xx, e = start[cc + 1];
        for (let k = start[cc]; k < e; k++) {
          const j = idx[k];
          if (s4 === 0 && j <= i) continue;
          if (onI && st[j] === ON) continue;   // the stream is kinematic: no forces inside it
          const dx = x[j] - xi, dy = y[j] - yi, r2 = dx * dx + dy * dy;
          if (r2 >= h2 || n >= M) continue;
          const r = Math.sqrt(r2) || 1e-6;
          nb[base + n] = j; nq[base + n] = r * ih; nux[base + n] = dx / r; nuy[base + n] = dy / r; n++;
        }
      }
      cnt[i] = n;
    }
  }
  function move(dt, f, g, spray) {
    nAct = 0; nOn = 0;
    for (let i = 0; i < N; i++) {
      const s0 = st[i]; if (s0 === FREE) continue;
      const ch = L.chains[chI[i]];
      arc[i] += f * dt;   // loose water remembers where it would have been
      ox[i] = x[i]; oy[i] = y[i];
      if (s0 === ON) {
        if (arc[i] >= ch.len) {
          if (spray && ch.terminal) {
            const [tx, ty] = tangentAt(ch, ch.len), jit = (rand() - 0.5) * 0.35;
            loosen(i, (tx - ty * jit) * f * 1.05, (ty + tx * jit) * f * 1.05 - f * 0.25);
          } else { release(i); continue; }
        } else { place(i, ch, arc[i]); x[i] = PL[0]; y[i] = PL[1]; nOn++; }
      } else if (s0 === HOME) {
        if (arc[i] >= ch.len) { release(i); continue; }
        nOn++; age[i] += dt;
        place(i, ch, arc[i]);
        const kk = 1 - Math.exp(-dt * (4 + age[i] * 14));
        x[i] += (PL[0] - x[i]) * kk; y[i] += (PL[1] - y[i]) * kk;
        if (Math.hypot(PL[0] - x[i], PL[1] - y[i]) < L.s * 0.6) { st[i] = ON; x[i] = PL[0]; y[i] = PL[1]; }
      } else {
        age[i] += dt;
        if (age[i] > life[i] || y[i] > H + 60 || x[i] < -60 || x[i] > W + 60) { release(i); continue; }
        vy[i] += g * dt; vx[i] *= 0.998; vy[i] *= 0.998;
        x[i] += vx[i] * dt; y[i] += vy[i] * dt;
        // loose water draws a little heavier, so small drops stay round instead of turning to dust
        const fade = clamp((life[i] - age[i]) / 0.5, 0, 1); wgt[i] = 1.5 * fade * fade * (3 - 2 * fade);
      }
      act[nAct++] = i;
    }
  }
  function forces(dt) {
    const s = L.s, K = P.k, KN = P.kn, TENS = P.tens, DMAX = P.dmax * s, rho0 = RHO0 * 0.98, SIG = P.visc * 0.6, BETA = P.visc * 0.4;
    for (let k0 = 0; k0 < nAct; k0++) { const i = act[k0]; rho[i] = 0; rhoN[i] = 0; }
    for (let k0 = 0; k0 < nAct; k0++) {
      const i = act[k0], base = i * M, n = cnt[i];
      for (let k = 0; k < n; k++) {
        const j = nb[base + k], a = 1 - nq[base + k], a2 = a * a, a3 = a2 * a;
        rho[i] += a2; rho[j] += a2; rhoN[i] += a3; rhoN[j] += a3;
      }
    }
    for (let k0 = 0; k0 < nAct; k0++) {
      const i = act[k0]; let p = K * (rho[i] - rho0); if (p < 0) p *= TENS;
      const pn = rhoN[i] - RHON0; pr[i] = p; prN[i] = pn > 0 ? KN * pn : 0;
    }
    for (let k0 = 0; k0 < nAct; k0++) {
      const i = act[k0], base = i * M, n = cnt[i], fi = st[i] !== ON;
      for (let k = 0; k < n; k++) {
        const j = nb[base + k], fj = st[j] !== ON, a = 1 - nq[base + k];
        const ux = nux[base + k], uy = nuy[base + k];
        const u = (vx[i] - vx[j]) * ux + (vy[i] - vy[j]) * uy;
        if (u > 0) {   // viscosity
          let fv = a * (SIG + BETA * u * dt / s); if (fv > 0.5) fv = 0.5;
          const I = fv * u * dt;
          if (fi && fj) { x[i] -= I * ux * 0.5; y[i] -= I * uy * 0.5; x[j] += I * ux * 0.5; y[j] += I * uy * 0.5; }
          else if (fi) { x[i] -= I * ux; y[i] -= I * uy; } else { x[j] += I * ux; y[j] += I * uy; }
        }
        // pressure and surface tension
        let D = 0.25 * ((pr[i] + pr[j]) * a + (prN[i] + prN[j]) * a * a) * s;
        if (D > DMAX) D = DMAX; else if (D < -DMAX) D = -DMAX;
        const dx = D * ux, dy = D * uy;
        if (fi && fj) { x[i] -= dx; y[i] -= dy; x[j] += dx; y[j] += dy; }
        else if (fi) { x[i] -= 2 * dx; y[i] -= 2 * dy; } else { x[j] += 2 * dx; y[j] += 2 * dy; }
      }
    }
    for (let k0 = 0; k0 < nAct; k0++) { const i = act[k0]; if (st[i] !== HOME) { vx[i] = (x[i] - ox[i]) / dt; vy[i] = (y[i] - oy[i]) / dt; } }
  }
  function step(dt) {
    simT += dt;
    const f = flowPx(), g = 1.3 * H * P.grav, spray = drain || (P.spray > 0 && (P.spray > 1.5 || pres > 0.3));
    flowT += f * dt;
    // 1. sources: each chain emits at the flow rate
    if (f > 0 && !drain) L.chains.forEach((ch, ci) => {
      ch.acc += f * dt * L.dens;
      while (ch.acc >= 1) { ch.acc -= 1; emit(ch, ci, ch.acc / L.dens); }
    });
    // 2. move the stream along its chains and loose water under gravity; 3. liquid forces between loose water and anything near it
    move(dt, f, g, spray);
    grid(); neighbours(); forces(dt);
  }

  // ---------- what touch does ----------
  function cut(ax, ay, bx, by, pvx, pvy) {
    const rc = P.cut * Math.max(L.R * 1.6, 12), rc2 = rc * rc;
    const ex = bx - ax, ey = by - ay, el = ex * ex + ey * ey || 1;
    const sp = Math.min(3200, Math.hypot(pvx, pvy)), sc = sp > 0 ? sp / Math.hypot(pvx, pvy) : 0;
    const tvx = pvx * sc * P.fling, tvy = pvy * sc * P.fling;
    for (let i = 0; i < N; i++) {
      if (st[i] === FREE) continue;
      const t = clamp(((x[i] - ax) * ex + (y[i] - ay) * ey) / el, 0, 1);
      const dx = x[i] - (ax + ex * t), dy = y[i] - (ay + ey * t), d2 = dx * dx + dy * dy;
      if (d2 > rc2) continue;
      const w = 1 - Math.sqrt(d2) / rc;
      if (st[i] === ON || st[i] === HOME) {
        const side = Math.sign(dx * -ey + dy * ex) || 1;   // a little push away from the blade on either side
        const nx = -ey / Math.sqrt(el) * side, ny = ex / Math.sqrt(el) * side;
        // the knocked-out piece leaves as one slug; surface tension then breaks it into drops
        loosen(i, vx[i] * 0.6 + tvx * (0.5 + 0.5 * w) + nx * sp * 0.05 + rnd() * 25, vy[i] * 0.6 + tvy * (0.5 + 0.5 * w) + ny * sp * 0.05 + rnd() * 25);
      } else { vx[i] += (tvx - vx[i]) * 0.25 * w; vy[i] += (tvy - vy[i]) * 0.25 * w; }
    }
  }
  function splash(px, py) {
    const rs = P.splash * L.cap * 0.22, v0 = P.splash * L.cap * 3.2;
    for (let i = 0; i < N; i++) {
      if (st[i] === FREE) continue;
      const dx = x[i] - px, dy = y[i] - py, d = Math.hypot(dx, dy);
      if (d > rs) continue;
      const w = 1 - d / rs, ux = dx / (d || 1), uy = dy / (d || 1), v = v0 * (0.35 + 0.65 * w) * (0.7 + 0.6 * rand());
      loosen(i, ux * v + rnd() * 30, uy * v - v0 * 0.35 * w + rnd() * 30);
    }
  }
  // a tap on the page, away from the water: as if held until the letters are empty (the sources shut, the ends spray), then they fill again
  function nearWater(px, py) {
    const r2 = (L.R * 3 + 14) ** 2;
    for (let i = 0; i < N; i++) if (st[i] === ON || st[i] === HOME) { const dx = x[i] - px, dy = y[i] - py; if (dx * dx + dy * dy < r2) return true; }
    return false;
  }
  function empty() { drain = true; }
  function regather() { for (let i = 0; i < N; i++) if (st[i] === LOOSE) { st[i] = HOME; age[i] = 0; wgt[i] = 1; } }

  // ---------- drawing ----------
  const ink = stage.colors.fg, bg = stage.colors.bg;
  function draw() {
    let n = 0;
    for (let k = 0; k < nAct; k++) { const i = act[k]; if (wgt[i] <= 0.01) continue; pts[3 * n] = x[i]; pts[3 * n + 1] = y[i]; pts[3 * n + 2] = wgt[i]; n++; }
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, pts.subarray(0, 3 * n), gl.STREAM_DRAW);
    const s = L.s, sig = P.blur * s * dpr, disc = P.drop * 0.5 * s * dpr;
    const R = Math.min(Math.max(3 * sig, disc + 1), maxPoint / 2);
    const interior = 1 + latticeSum((d) => Math.exp(-(d * d) / (P.blur * P.blur)), 6);
    const scale = floatOK ? 1 : 0.35 / interior;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, stage.pw, stage.ph);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendEquationSeparate(gl.FUNC_ADD, gl.MAX); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(splatP);
    gl.uniform2f(uS.res, W, H); gl.uniform1f(uS.size, 2 * R); gl.uniform1f(uS.r, R);
    gl.uniform1f(uS.sig, sig); gl.uniform1f(uS.disc, disc); gl.uniform1f(uS.scale, scale);
    gl.bindVertexArray(vao); gl.drawArrays(gl.POINTS, 0, n);
    gl.disable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, stage.pw, stage.ph);
    gl.useProgram(compP);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fieldTex); gl.uniform1i(uC.field, 0);
    gl.uniform2f(uC.px, 1 / stage.pw, 1 / stage.ph);
    gl.uniform1f(uC.inv, 1 / (interior * scale)); gl.uniform1f(uC.th, P.th);
    gl.uniform1f(uC.shine, P.shine * 1.6); gl.uniform1f(uC.rad, Math.max(2, L.R * 0.9 * dpr));
    gl.uniform3fv(uC.bg, bg); gl.uniform3fv(uC.ink, ink);
    gl.bindVertexArray(emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  function build() {
    W = stage.W; H = stage.H; dpr = stage.pw / stage.W;
    L = layout();
    alloc(Math.ceil(L.total * 1.9) + 600);
    gcell = SIM_H * L.s; gw = Math.ceil(W / gcell) + 5; gh = Math.ceil(H / gcell) + 5;
    start = new Int32Array(gw * gh + 1); cur = new Int32Array(gw * gh);
    simT = 0; flowT = 0; pres = 0; drain = false;
    fill();
    makeTargets();
    move(0, 0, 0, false);
  }

  // ---------- the one self-demo: a single cut across the name, until the first touch ----------
  const T = { touched: false, demo: null };
  function startDemo() {
    if (reduced || T.touched) return;
    const now = performance.now(), ax = W * 0.12, ay = H * 0.3, bx = W * 0.88, by = H * 0.56;
    T.demo = { t0: now + 900, dur: 520, ax, ay, bx, by, lx: ax, ly: ay, lt: now + 900 };
  }
  function demoStep(now) {
    const d = T.demo, u = clamp((now - d.t0) / d.dur, 0, 1);
    if (u <= 0) return;
    const e = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);
    const px = d.ax + (d.bx - d.ax) * e, py = d.ay + (d.by - d.ay) * e;
    const dts = Math.max(1e-3, (now - d.lt) / 1000);
    cut(d.lx, d.ly, px, py, (px - d.lx) / dts, (py - d.ly) / dts);
    d.lx = px; d.ly = py; d.lt = now;
    if (u >= 1) T.demo = null;
  }

  // ---------- gestures: drag cuts, tap splashes (or sprays it all), hold opens the tap, double tap gathers the loose water ----------
  const press = pressTracker();
  let ptr = null, lastTap = 0, gatherT = 0;
  const wake = () => { wakeUntil = performance.now() + 4000; };
  offs.push(stage.on('down', (q, e) => {
    if (!press.down(q, e.pointerId) || !L) return;
    T.touched = true; T.demo = null; wake();
    ptr = { lx: q.x, ly: q.y, lt: performance.now(), drag: false, vx: 0, vy: 0 };
  }));
  offs.push(stage.on('move', (q, e) => {
    press.move(q, e.pointerId);
    if (!press.active || !ptr) return;
    const now = performance.now();
    if (!ptr.drag && press.moved >= TAP.px) ptr.drag = true;
    if (ptr.drag) {
      const dts = Math.max(4, now - ptr.lt) / 1000;
      ptr.vx = ptr.vx * 0.4 + ((q.x - ptr.lx) / dts) * 0.6; ptr.vy = ptr.vy * 0.4 + ((q.y - ptr.ly) / dts) * 0.6;
      cut(ptr.lx, ptr.ly, q.x, q.y, ptr.vx, ptr.vy); wake();
    }
    ptr.lx = q.x; ptr.ly = q.y; ptr.lt = now;
  }));
  offs.push(stage.on('up', (q, e) => {
    const r = press.up(q, e.pointerId);
    if (!r || !ptr) return;
    ptr = null;
    if (!r.tap || e.type === 'pointercancel' || stage.revealed) return;
    const now = performance.now();
    if (now - lastTap < DOUBLE_MS) {
      lastTap = 0; clearTimeout(gatherT);
      gatherT = setTimeout(() => { if (alive && !stage.revealed) { regather(); wake(); } }, REFORM_DELAY_MS - DOUBLE_MS + 40);
    } else {
      lastTap = now;
      if (nearWater(q.x, q.y)) splash(q.x, q.y); else { empty(); wake(); }
    }
  }));
  offs.push(stage.on('reveal', () => { clearTimeout(gatherT); lastTap = 0; }));

  // ---------- reveal: the centre lines, each source, and every particle ----------
  const rv = createReveal(stage, (c, W_, H_, k) => {
    const colr = (a) => rvInk(stage, a);
    rvGrid(c, W_, H_, 24, colr, k); corners(c, W_, H_, 16, colr, k);
    if (!L) return;
    c.strokeStyle = colr(0.9 * k); c.lineWidth = 1.5;
    for (const ch of L.chains) {
      c.beginPath(); c.moveTo(ch.X[0], ch.Y[0]);
      for (let i = 1; i < ch.n; i++) c.lineTo(ch.X[i], ch.Y[i]);
      c.stroke();
      c.fillStyle = colr(0.9 * k); c.beginPath(); c.arc(ch.X[0], ch.Y[0], 3.5, 0, 6.2832); c.fill();
    }
    c.fillStyle = colr(0.6 * k);
    for (let k0 = 0; k0 < nAct; k0 += 2) { const i = act[k0]; c.fillRect(x[i] - 0.75, y[i] - 0.75, 1.5, 1.5); }
    titleBlock(c, W_, H_, ['JET · THE STREAM', `· ${L.chains.length} centre lines, each fed from its root`, `— ${nAct.toLocaleString()} particles: the stream is carried, loose water is a liquid`, '| cut it and the gap flows away'], colr, k);
  }, { dim: 0.6 });

  // ---------- the frame ----------
  function frame(dt) {
    if (!L) return;
    const now = performance.now();
    dt = Math.min(dt, 1 / 30);
    const holding = (press.active && ptr && !ptr.drag && press.holding) || drain;
    if (holding) wake();
    pres += ((holding ? 1 : 0) - pres) * (1 - Math.exp(-dt * (holding ? 2.2 : 3.5)));
    if (T.demo) demoStep(now);
    const n = Math.max(1, Math.ceil(dt * 180));
    for (let k = 0; k < n; k++) step(dt / n);
    if (drain && nOn === 0) drain = false;   // empty: the sources open again
    draw();
    rv.draw(now);
  }

  build();
  startDemo();
  offs.push(stage.frame((dt) => { if (alive) frame(dt); }));
  let rt = 0;
  offs.push(stage.on('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (alive) build(); }, 200); }));

  const Ctl = (key, lbl, min, max, step) => ({ key, label: lbl, min, max, step });
  let bt = 0;
  const tune = {
    title: 'Jet', values: P, defaults: DEF,
    groups: [
      { name: 'Stream', items: [Ctl('width', 'Stream width (rebuilds)', 0.4, 2.5, 0.05), Ctl('speed', 'Flow speed', 0.1, 2.5, 0.05), Ctl('pulse', 'Pulses', 0, 0.8, 0.01), Ctl('spray', 'Ends spray: 0 never, 1 held, 2 always', 0, 2, 1)] },
      { name: 'Cut and splash', items: [Ctl('cut', 'Cut reach', 0.4, 3, 0.05), Ctl('fling', 'Cut throw', 0, 1.5, 0.05), Ctl('splash', 'Tap splash', 0.3, 2.5, 0.05), Ctl('grav', 'Gravity', 0.2, 2, 0.05), Ctl('life', 'Loose water lasts (s)', 0.6, 5, 0.1)] },
      { name: 'Liquid', items: [Ctl('tens', 'Surface tension', 0, 2, 0.05), Ctl('visc', 'Viscosity', 0, 1, 0.01), Ctl('th', 'Metaball threshold', 0.15, 0.8, 0.01), Ctl('blur', 'Metaball blur', 0.5, 1.8, 0.05), Ctl('shine', 'Highlight', 0, 1.5, 0.05), Ctl('drop', 'Droplet size', 0, 1.2, 0.05)] },
    ],
    set(key, v) { P[key] = v; if (key === 'width') { clearTimeout(bt); bt = setTimeout(() => { if (alive) build(); }, 250); } },
    reset() { Object.assign(P, DEF); build(); },
  };

  return {
    tune,
    debug: { P, get L() { return L; }, stats() { const c = [0, 0, 0, 0]; for (let i = 0; i < N; i++) c[st[i]]++; return { N, free: c[0], on: c[1], loose: c[2], home: c[3] }; }, cut, splash, empty, regather, get draining() { return drain; } },
    destroy() {
      alive = false; clearTimeout(rt); clearTimeout(bt); clearTimeout(gatherT);
      rv.destroy(); offs.forEach((f) => f());
      gl.deleteBuffer(buf); gl.deleteVertexArray(vao); gl.deleteVertexArray(emptyVao);
      if (fieldTex) gl.deleteTexture(fieldTex); if (fbo) gl.deleteFramebuffer(fbo);
      for (const s of shaders) gl.deleteShader(s);
      gl.deleteProgram(splatP); gl.deleteProgram(compP);
      link.remove(); stage.setBackdrop(null);
    },
  };
}
