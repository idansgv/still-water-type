// Rewind: the name (or an album title) as a block of liquid. A tap lets it go: the letters collapse and splash, in slow motion,
// until the liquid settles on the floor. Hold runs the tape backwards; a double tap rewinds all the way into the letters; a sideways
// drag scrubs. Port of the test page docs/posters/prototypes/rewind.html with Idan's tuning (4 Nov 2026). Idea after
// mjurczyk/alembic, a JS reader for baked Alembic (.abc) caches: the simulation is baked once, frame by frame, and the interaction
// only samples it at a time t, so time runs both ways.
//
// Under the picture (raw WebGL2): a 2D particle liquid (double-density relaxation, Clavet et al. 2005, a uniform-grid spatial hash)
// seeded on a hex lattice inside the letters, baked in a worker (built from the same function, with a main-thread fallback) to
// Float32 positions, 30 frames a second. Playback lerps between baked frames and waits at the baked frontier. Each frame splats the
// particles into a soft field (plus a droplet disc) and thresholds it into one smooth body; near t = 0 the crisp letter mask takes over.
//
// Gestures (src/gestures.js): tap plays forward to the end (a tap at the end plays again from the letters); hold rewinds while held,
// spinning up; a sideways drag scrubs; a double tap rewinds all the way (a beat later, so a third tap can still mean reveal). Reveal:
// every particle as a dot, the tape and where the bake has got to. The letters stand still until the first touch (Idan, 4 Nov 2026):
// no intro, no self-demo.

import { getGL } from '../engine.js';
import { pressTracker, TAP, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';
import { createReveal, grid, corners, label, titleBlock, ink as rvInk } from './reveal.js';
import { linesFor, lettersFor } from '../name.js';

const FAMILY = 'Anton', WEIGHT = 400, OWN = ['Idan', 'Segev'];
// Idan's tuning from the test page (4 Nov 2026)
const DEF = { n: 14500, visc: 0.89, tens: 1.4, grav: 0.5, len: 10, speed: 0.6, sens: 0.3, th: 0.31, blur: 1.15, drop: 0.55, k: 0.3, kn: 0.5, dmax: 0.05 };
const FPS = 30, SUB = 8;            // baked frames per second (playback lerps between them); sim steps per baked frame
const SIM_H = 2.1;                  // interaction radius, in lattice spacings
const FOOT = 52;                    // css px kept clear at the bottom at least: the liquid pools above the site's foot line, so it stays readable

// ---------- the simulation (runs only during the bake; never touched by the interaction) ----------
// Units: lattice spacing = 1. Positions are written out in CSS px, one Float32 (x, y) pair per particle per frame.
function makeSim(o) {
  const N = o.N, W = o.W, H = o.H, sub = o.sub, dt = 1 / (o.fps * sub), h = o.h, ih = 1 / h, h2 = h * h;
  const x = Float32Array.from(o.x), y = Float32Array.from(o.y);
  const vx = new Float32Array(N), vy = new Float32Array(N), ox = new Float32Array(N), oy = new Float32Array(N);
  const rho = new Float32Array(N), rhoN = new Float32Array(N), pr = new Float32Array(N), prN = new Float32Array(N);
  const gw = Math.floor(W * ih) + 1, gh = Math.floor(H * ih) + 1, NC = gw * gh;
  const start = new Int32Array(NC + 1), cur = new Int32Array(NC), cell = new Int32Array(N), idx = new Int32Array(N);
  const M = 40, nb = new Int32Array(N * M), nq = new Float32Array(N * M), nux = new Float32Array(N * M), nuy = new Float32Array(N * M), cnt = new Int32Array(N);
  const g = o.g, K = o.k, KN = o.kn, TENS = o.tens, SIG = o.sig, BETA = o.beta, rho0 = o.rho0, RN0 = o.rhoN0 || 0, vmax = 0.9 * h / dt, s = o.s;
  const id = new Int32Array(N); for (let i = 0; i < N; i++) id[i] = i; // slot -> original particle
  const tmp = new Float32Array(N), tmpI = new Int32Array(N);
  let nstep = 0;
  // every few steps, store particles in grid order so neighbours sit close in memory (output order is unchanged)
  function reorder() {
    for (const A of [x, y, vx, vy, ox, oy]) { for (let k = 0; k < N; k++) tmp[k] = A[idx[k]]; A.set(tmp); }
    for (let k = 0; k < N; k++) tmpI[k] = id[idx[k]]; id.set(tmpI);
    for (let k = 0; k < N; k++) tmpI[k] = cell[idx[k]]; cell.set(tmpI);
    for (let k = 0; k < N; k++) idx[k] = k;
  }
  const m = 0.5, DMAX = o.dmax || 1e9, HX = [0, 1, -1, 0, 1], HY = [0, 0, 1, 1, 1];
  function grid() {
    start.fill(0);
    for (let i = 0; i < N; i++) {
      let cx = (x[i] * ih) | 0, cy = (y[i] * ih) | 0;
      if (cx < 0) cx = 0; else if (cx >= gw) cx = gw - 1;
      if (cy < 0) cy = 0; else if (cy >= gh) cy = gh - 1;
      const c = cy * gw + cx; cell[i] = c; start[c + 1]++;
    }
    for (let c = 0; c < NC; c++) { start[c + 1] += start[c]; cur[c] = start[c]; }
    for (let i = 0; i < N; i++) idx[cur[cell[i]]++] = i;
  }
  function neighbours() {
    for (let i = 0; i < N; i++) {
      const xi = x[i], yi = y[i], c = cell[i], cx = c % gw, cy = (c / gw) | 0, base = i * M;
      let n = 0;
      // half stencil: each pair is found once (own cell with j > i, plus four forward cells)
      for (let s4 = 0; s4 < 5; s4++) {
        const xx = cx + HX[s4], yy = cy + HY[s4];
        if (xx < 0 || xx >= gw || yy >= gh) continue;
        const cc = yy * gw + xx, e = start[cc + 1];
        for (let k = start[cc]; k < e; k++) {
          const j = idx[k];
          if (s4 === 0 && j <= i) continue;
          const dx = x[j] - xi, dy = y[j] - yi, r2 = dx * dx + dy * dy;
          if (r2 >= h2 || n >= M) continue;
          const r = Math.sqrt(r2) || 1e-6;
          nb[base + n] = j; nq[base + n] = r * ih; nux[base + n] = dx / r; nuy[base + n] = dy / r; n++;
        }
      }
      cnt[i] = n;
    }
  }
  function viscosity() {
    if (SIG <= 0 && BETA <= 0) return;
    for (let i = 0; i < N; i++) {
      const base = i * M, n = cnt[i];
      for (let k = 0; k < n; k++) {
        const j = nb[base + k], ux = nux[base + k], uy = nuy[base + k];
        const u = (vx[i] - vx[j]) * ux + (vy[i] - vy[j]) * uy;
        if (u <= 0) continue;
        let f = (1 - nq[base + k]) * (SIG + BETA * u * dt);
        if (f > 0.5) f = 0.5;
        const I = f * u;
        vx[i] -= I * ux; vy[i] -= I * uy; vx[j] += I * ux; vy[j] += I * uy;
      }
    }
  }
  function relax() {
    rho.fill(0); rhoN.fill(0);
    for (let i = 0; i < N; i++) {
      const base = i * M, n = cnt[i];
      for (let k = 0; k < n; k++) {
        const j = nb[base + k], a = 1 - nq[base + k], a2 = a * a, a3 = a2 * a;
        rho[i] += a2; rho[j] += a2; rhoN[i] += a3; rhoN[j] += a3;
      }
    }
    for (let i = 0; i < N; i++) {
      let p = K * (rho[i] - rho0);
      if (p < 0) p *= TENS;
      const pn = rhoN[i] - RN0; pr[i] = p; prN[i] = pn > 0 ? KN * pn : 0;
    }
    for (let i = 0; i < N; i++) {
      const base = i * M, n = cnt[i];
      for (let k = 0; k < n; k++) {
        const j = nb[base + k], a = 1 - nq[base + k];
        let D = 0.25 * ((pr[i] + pr[j]) * a + (prN[i] + prN[j]) * a * a);
        if (D > DMAX) D = DMAX; else if (D < -DMAX) D = -DMAX;
        const dx = D * nux[base + k], dy = D * nuy[base + k];
        x[i] -= dx; y[i] -= dy; x[j] += dx; y[j] += dy;
      }
    }
  }
  let first = true;
  function step() {
    for (let i = 0; i < N; i++) vy[i] += g * dt;
    if (first) { grid(); neighbours(); first = false; }
    if (nstep % 2 === 0) viscosity(); // every other step, at double strength: same feel, less cost
    for (let i = 0; i < N; i++) {
      let a = vx[i], b = vy[i];
      const sp = Math.sqrt(a * a + b * b);
      if (sp > vmax) { a *= vmax / sp; b *= vmax / sp; }
      ox[i] = x[i]; oy[i] = y[i]; x[i] += a * dt; y[i] += b * dt;
    }
    grid(); if (++nstep % 6 === 0) reorder(); neighbours(); relax();
    for (let i = 0; i < N; i++) {
      let xi = x[i], yi = y[i];
      if (yi > H - m) { yi = H - m; xi = ox[i] + (xi - ox[i]) * 0.92; } // floor, a little friction
      else if (yi < m) yi = m;
      if (xi < m) xi = m; else if (xi > W - m) xi = W - m;
      x[i] = xi; y[i] = yi;
      vx[i] = (xi - ox[i]) / dt; vy[i] = (yi - oy[i]) / dt;
    }
  }
  return {
    frame(out, off) {
      for (let k = 0; k < sub; k++) step();
      for (let i = 0; i < N; i++) { const q = off + 2 * id[i]; out[q] = x[i] * s; out[q + 1] = y[i] * s; }
    },
  };
}

// The worker is built from makeSim's own source, so the main-thread fallback and the worker run the same code.
const WORKER_SRC = `'use strict';
const makeSim = ${makeSim.toString()};
self.onmessage = (e) => {
  const o = e.data, N = o.N, sim = makeSim(o);
  let f = 1;
  while (f < o.frames) {
    const n = Math.min(6, o.frames - f), buf = new Float32Array(n * N * 2);
    for (let k = 0; k < n; k++) sim.frame(buf, k * N * 2);
    self.postMessage({ id: o.id, from: f, count: n, buf }, [buf.buffer]);
    f += n;
  }
};`;

// rest density and the splat field of a filled hex lattice (spacing 1): what "inside the liquid" means
function latticeSum(fn, R) {
  let sum = 0; const dy = Math.sqrt(3) / 2;
  for (let r = -R; r <= R; r++) for (let c = -R; c <= R; c++) {
    const x = c + (r & 1 ? 0.5 : 0), y = r * dy, d = Math.hypot(x, y);
    if (d > 0) sum += fn(d);
  }
  return sum;
}
const RHO0 = latticeSum((d) => (d < SIM_H ? (1 - d / SIM_H) ** 2 : 0), 6);
const RHON0 = latticeSum((d) => (d < SIM_H ? (1 - d / SIM_H) ** 3 : 0), 6);

const VS_PTS = `#version 300 es
layout(location=0) in vec2 aA; layout(location=1) in vec2 aB; uniform float uMix; uniform vec2 uRes; uniform float uSize;
void main() { vec2 p = mix(aA, aB, uMix); gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0); gl_PointSize = uSize; }`;
const FS_SPLAT = `#version 300 es
precision highp float; uniform float uR; uniform float uSig; uniform float uDisc; uniform float uScale; out vec4 o;
void main() {
  float d = length(gl_PointCoord * 2.0 - 1.0) * uR;
  if (d > uR) discard;
  float w = exp(-d * d / (uSig * uSig)) * uScale;
  float a = clamp(uDisc - d + 0.5, 0.0, 1.0);
  o = vec4(w, 0.0, 0.0, a);
}`;
const VS_FULL = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
const FS_COMP = `#version 300 es
precision highp float; uniform sampler2D uField; uniform sampler2D uMask; uniform vec2 uPx; uniform float uInv; uniform float uTh; uniform float uW;
uniform vec3 uBg; uniform vec3 uInk; out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy * uPx;
  vec4 f = texture(uField, uv);
  float v = max(f.r * uInv * 0.5 / uTh, f.a);
  float m = texture(uMask, vec2(uv.x, 1.0 - uv.y)).r;
  v = mix(m, v, uW);
  float aa = max(fwidth(v), 1e-4);
  float c = clamp((v - 0.5) / (aa * 1.4) + 0.5, 0.0, 1.0);
  o = vec4(mix(uBg, uInk, c), 1.0);
}`;

export async function mount(stage) {
  const canvas = stage.canvas, gl = getGL(canvas);
  if (!gl) throw new Error('webgl2 unavailable');
  const dark = stage.theme.name === 'dark';
  const P = { ...DEF };
  const offs = [];
  let alive = true;
  stage.setBackdrop(dark ? 0 : 1);

  // ---------- the face: Anton from Google Fonts, only the letters needed ----------
  const words = linesFor(stage, OWN);
  const link = document.createElement('link'); link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=Anton&text=${encodeURIComponent(lettersFor(stage, OWN.join('')))}&display=block`;
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
  const splatP = prog(VS_PTS, FS_SPLAT), compP = prog(VS_FULL, FS_COMP);
  const U = (p, n) => gl.getUniformLocation(p, n);
  const uS = { mix: U(splatP, 'uMix'), res: U(splatP, 'uRes'), size: U(splatP, 'uSize'), r: U(splatP, 'uR'), sig: U(splatP, 'uSig'), disc: U(splatP, 'uDisc'), scale: U(splatP, 'uScale') };
  const uC = { field: U(compP, 'uField'), mask: U(compP, 'uMask'), px: U(compP, 'uPx'), inv: U(compP, 'uInv'), th: U(compP, 'uTh'), w: U(compP, 'uW'), bg: U(compP, 'uBg'), ink: U(compP, 'uInk') };
  const floatOK = !!gl.getExtension('EXT_color_buffer_float');
  const maxPoint = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];
  const vao = gl.createVertexArray(), bufA = gl.createBuffer(), bufB = gl.createBuffer(), emptyVao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, bufA); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, bufB); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  let fieldTex = null, fbo = null;
  const maskTex = gl.createTexture();
  const maskCanvas = document.createElement('canvas'), mctx = maskCanvas.getContext('2d', { willReadFrequently: true });
  const ink = stage.colors.fg, bg = stage.colors.bg;

  // ---------- layout: each word on its own line, the block in the upper middle; the liquid is seeded inside it ----------
  let W = 1, H = 1, dpr = 1, layout = null;
  function drawMask() {
    const mw = stage.pw, mh = stage.ph;
    maskCanvas.width = mw; maskCanvas.height = mh;
    const c = mctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#000'; c.fillRect(0, 0, mw, mh);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ref = 200;
    c.font = `${WEIGHT} ${ref}px "${FAMILY}", Impact, sans-serif`;
    const ms = words.map((l) => c.measureText(l));
    const asc = Math.max(...ms.map((m) => m.actualBoundingBoxAscent)), desc = Math.max(...ms.map((m) => m.actualBoundingBoxDescent));
    const lineH = (asc + desc) * 1.12;
    const blockW = Math.max(...ms.map((m) => m.actualBoundingBoxLeft + m.actualBoundingBoxRight));
    const blockH = lineH * (words.length - 1) + asc + desc;
    const maxW = W - 2 * Math.max(24, W * 0.07), maxH = H * [0.3, 0.42, 0.52, 0.58][Math.min(3, words.length - 1)];
    const sc = Math.min(maxW / blockW, maxH / blockH);
    c.font = `${WEIGHT} ${ref * sc}px "${FAMILY}", Impact, sans-serif`;
    c.fillStyle = '#fff'; c.textBaseline = 'alphabetic';
    const top = H * 0.4 - (blockH * sc) / 2;
    words.forEach((l, k) => {
      const m = ms[k], lw = (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) * sc;
      c.fillText(l, (W - lw) / 2 + m.actualBoundingBoxLeft * sc, top + asc * sc + k * lineH * sc);
    });
    return c.getImageData(0, 0, mw, mh).data;
  }
  function seed(px) {
    const mw = maskCanvas.width, mh = maskCanvas.height;
    const at = (x, y) => { const X = Math.min(mw - 1, Math.round(x * dpr)), Y = Math.min(mh - 1, Math.round(y * dpr)); return px[(Y * mw + X) * 4] > 127; };
    let a = 0; const st = 2;
    for (let y = 0; y < H; y += st) for (let x = 0; x < W; x += st) if (at(x, y)) a += st * st;
    const n = W < 600 ? Math.round(P.n * 0.7) : P.n;   // a phone bakes slower: fewer, larger particles keep the splash ahead of the playhead
    const s = Math.sqrt((2 * Math.max(a, 1)) / (Math.sqrt(3) * n));
    const pts = [], dy = s * Math.sqrt(3) / 2;
    for (let r = 0, y = dy / 2; y < H; r++, y += dy) for (let x = (r & 1 ? s / 2 : 0) + s / 4; x < W; x += s) if (at(x, y)) pts.push(x, y);
    return { s, N: pts.length / 2, x0: Float32Array.from(pts) };
  }
  function makeTargets() {
    const w = stage.pw, h = stage.ph;
    if (fieldTex) gl.deleteTexture(fieldTex);
    if (fbo) gl.deleteFramebuffer(fbo);
    fieldTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, fieldTex);
    if (floatOK) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const lin = () => {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    lin();
    fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fieldTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, maskTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskCanvas);
    lin();
  }

  // ---------- the bake ----------
  let workerURL = null;
  try { workerURL = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })); } catch (e) { workerURL = null; }
  const bake = { id: 0, N: 0, frames: 0, done: 0, data: null, worker: null, timer: 0 };
  function stopBake() { if (bake.worker) { bake.worker.terminate(); bake.worker = null; } clearTimeout(bake.timer); }
  function startBake() {
    stopBake();
    const L = layout, N = L.N, frames = Math.round(P.len * FPS) + 1;
    bake.id++; bake.N = N; bake.frames = frames; bake.done = 1;
    bake.data = new Float32Array(frames * N * 2);
    bake.data.set(L.x0, 0);
    const s = L.s, xs = new Float32Array(N), ys = new Float32Array(N);
    for (let i = 0; i < N; i++) { xs[i] = L.x0[2 * i] / s; ys[i] = L.x0[2 * i + 1] / s; }
    // gravity scales with the screen height, so a fall across the page takes the same time on any device
    const o = {
      id: bake.id, N, frames, fps: FPS, sub: SUB, h: SIM_H, s, W: W / s, H: (H - floorGap()) / s, x: xs, y: ys,
      g: (1.56 * H * P.grav) / s, k: P.k, kn: P.kn, dmax: P.dmax, tens: P.tens, sig: P.visc * 0.6, beta: P.visc * 0.4, rho0: RHO0 * 0.98, rhoN0: RHON0,
    };
    const onChunk = (m) => {
      if (m.id !== bake.id || !alive) return;
      bake.data.set(m.buf instanceof Float32Array ? m.buf : new Float32Array(m.buf), m.from * N * 2);
      bake.done = m.from + m.count;
    };
    let w = null;
    if (workerURL) { try { w = new Worker(workerURL); } catch (e) { w = null; } }
    if (w) {
      bake.worker = w;
      w.onmessage = (e) => onChunk(e.data);
      w.onerror = (e) => { if (e && e.preventDefault) e.preventDefault(); w.terminate(); bake.worker = null; mainThreadBake(o, onChunk); };
      w.postMessage(o, [o.x.buffer, o.y.buffer]);
    } else mainThreadBake(o, onChunk);
  }
  function mainThreadBake(o, onChunk) {
    const sim = makeSim(o), N = o.N, id = o.id;
    let f = bake.done;
    const tick = () => {
      if (id !== bake.id || !alive) return;
      const t0 = performance.now(), from = f, out = [];
      while (f < o.frames && performance.now() - t0 < 8) { const buf = new Float32Array(N * 2); sim.frame(buf, 0); out.push(buf); f++; }
      const all = new Float32Array(out.length * N * 2);
      out.forEach((b, k) => all.set(b, k * N * 2));
      onChunk({ id, from, count: out.length, buf: all });
      if (f < o.frames) bake.timer = setTimeout(tick, 0);
    };
    tick();
  }

  // ---------- drawing ----------
  let lastFrames = [-1, -1];
  const interiorFor = (blur) => 1 + latticeSum((d) => Math.exp(-(d * d) / (blur * blur)), 6);
  let interior = interiorFor(P.blur);
  function draw(t) {
    if (!layout || !bake.data) return;
    const N = bake.N, f = Math.max(0, Math.min(t * FPS, bake.done - 1));
    const i0 = Math.floor(f), i1 = Math.min(i0 + 1, bake.done - 1), mx = f - i0;
    if (lastFrames[0] !== i0 || lastFrames[1] !== i1) {
      gl.bindBuffer(gl.ARRAY_BUFFER, bufA); gl.bufferData(gl.ARRAY_BUFFER, bake.data.subarray(i0 * N * 2, (i0 + 1) * N * 2), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufB); gl.bufferData(gl.ARRAY_BUFFER, bake.data.subarray(i1 * N * 2, (i1 + 1) * N * 2), gl.DYNAMIC_DRAW);
      lastFrames = [i0, i1];
    }
    const s = layout.s, sig = P.blur * s * dpr, disc = P.drop * 0.5 * s * dpr;
    const R = Math.min(Math.max(3 * sig, disc + 1), maxPoint / 2);
    const scale = floatOK ? 1 : 0.35 / interior;
    // 1. splat the particles: red adds a soft field, alpha keeps the largest droplet disc
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, stage.pw, stage.ph);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendEquationSeparate(gl.FUNC_ADD, gl.MAX); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(splatP);
    gl.uniform1f(uS.mix, mx); gl.uniform2f(uS.res, W, H); gl.uniform1f(uS.size, 2 * R); gl.uniform1f(uS.r, R);
    gl.uniform1f(uS.sig, sig); gl.uniform1f(uS.disc, disc); gl.uniform1f(uS.scale, scale);
    gl.bindVertexArray(vao); gl.drawArrays(gl.POINTS, 0, N);
    gl.disable(gl.BLEND);
    // 2. threshold into one smooth body; near t = 0 the true letter mask takes over so the type reads crisp
    const tw = Math.min(1, Math.max(0, t / 0.14)), mixW = tw * tw * (3 - 2 * tw);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, stage.pw, stage.ph);
    gl.useProgram(compP);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fieldTex); gl.uniform1i(uC.field, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskTex); gl.uniform1i(uC.mask, 1);
    gl.uniform2f(uC.px, 1 / stage.pw, 1 / stage.ph);
    gl.uniform1f(uC.inv, 1 / (interior * scale)); gl.uniform1f(uC.th, P.th); gl.uniform1f(uC.w, mixW);
    gl.uniform3fv(uC.bg, bg); gl.uniform3fv(uC.ink, ink);
    gl.bindVertexArray(emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  // ---------- the playhead: the interaction only moves a time t through the bake ----------
  const S = { t: 0, target: 0, mode: 'idle', rewStart: 0, dirty: true, drawnT: -1 };
  const bakedT = () => Math.max(0, (bake.done - 1) / FPS);
  const endT = () => Math.max(0, (bake.frames - 1) / FPS);

  // the floor sits above the footer (three lines on a phone), measured, so the pool never covers its words
  function floorGap() {
    const chrome = document.querySelector('.chrome');
    return Math.max(FOOT, H * 0.07, ((chrome && chrome.offsetHeight) || 0) + 8);
  }

  function build() {
    W = stage.W; H = stage.H; dpr = stage.pw / stage.W;
    layout = seed(drawMask());
    makeTargets();
    lastFrames = [-1, -1];
    startBake();
    S.t = 0; S.target = 0; S.mode = 'idle'; S.dirty = true;
  }

  // ---------- gestures: tap plays, double tap rewinds all the way, hold rewinds, drag scrubs ----------
  const press = pressTracker();
  let drag = null, lastTap = null, reform = 0;
  offs.push(stage.on('down', (q, e) => {
    if (!press.down(q, e.pointerId)) return;
    clearTimeout(reform);
    S.mode = 'idle'; S.target = S.t;   // grabbing the tape stops it
    drag = { lx: q.x, scrub: false, hold: false };
  }));
  offs.push(stage.on('move', (q, e) => {
    press.move(q, e.pointerId);
    if (!press.active || !drag) return;
    if (!drag.scrub && !drag.hold && press.moved >= TAP.px) { drag.scrub = true; S.mode = 'scrub'; S.target = S.t; }
    if (drag.scrub) {
      S.target = Math.max(0, Math.min(bakedT(), S.target + ((q.x - drag.lx) * P.sens * endT()) / Math.max(320, W)));
      drag.lx = q.x;
    }
  }));
  offs.push(stage.on('up', (q, e) => {
    const r = press.up(q, e.pointerId);
    if (!r || !drag) return;
    const d = drag; drag = null;
    if (d.scrub) { S.mode = 'ease'; return; }
    if (d.hold) { S.mode = 'idle'; return; }
    if (!r.tap || e.type === 'pointercancel') return;
    const now = performance.now();
    if (lastTap && now - lastTap.at < DOUBLE_MS) {
      // a double tap rewinds all the way to the letters, from where the first tap found the tape (a beat later: a third tap is reveal)
      S.t = S.target = lastTap.t; S.mode = 'idle'; S.dirty = true; lastTap = null;
      reform = setTimeout(() => { if (alive && !stage.revealed) { S.mode = 'rewind'; S.rewStart = performance.now(); } }, REFORM_DELAY_MS);
    } else {
      // a tap lets the tape run until the liquid settles; at the end it plays again from the letters
      lastTap = { at: now, t: S.t };
      if (S.t >= endT() - 0.02) S.t = 0;
      S.mode = 'play';
    }
  }));

  // ---------- reveal: every particle, the tape and how far the bake has got ----------
  const rv = createReveal(stage, (c, W_, H_, k) => {
    const colr = (a) => rvInk(stage, a);
    grid(c, W_, H_, 24, colr, k); corners(c, W_, H_, 16, colr, k);
    if (bake.data && bake.done > 0) {
      const N = bake.N, f = Math.min(Math.round(S.t * FPS), bake.done - 1), off = f * N * 2, D = bake.data;
      c.fillStyle = colr(0.85 * k);
      const step = N > 9000 ? 2 : 1;
      for (let i = 0; i < N; i += step) c.fillRect(D[off + 2 * i] - 0.75, D[off + 2 * i + 1] - 0.75, 1.5, 1.5);
    }
    // the tape: baked so far, and the playhead
    const x0 = 24, x1 = W_ - 24, y = H_ - 64, E = Math.max(0.001, endT());
    c.strokeStyle = colr(0.3 * k); c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
    c.strokeStyle = colr(0.9 * k); c.lineWidth = 3; c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + (x1 - x0) * Math.min(1, bakedT() / E), y); c.stroke();
    const px = x0 + (x1 - x0) * Math.min(1, S.t / E);
    c.lineWidth = 1; c.beginPath(); c.moveTo(px, y - 9); c.lineTo(px, y + 9); c.stroke();
    label(c, `t ${S.t.toFixed(2)} s`, px + 6, y - 12, colr, k);
    titleBlock(c, W_, H_, ['REWIND · THE BAKE', `· ${bake.N.toLocaleString()} particles, one frame of the cache`, `— baked ${bakedT().toFixed(1)} of ${E.toFixed(0)} s, ${FPS} frames a second`, '| the playhead: time runs both ways'], colr, k);
  }, { dim: 0.6 });

  // ---------- the frame ----------
  function frame(dt) {
    const now = performance.now();
    dt = Math.min(dt, 0.05);
    if (press.active && drag && !drag.scrub && !drag.hold && press.holding) { drag.hold = true; S.mode = 'rewind'; S.rewStart = now; }
    if (S.mode === 'play') {
      S.t = Math.min(S.t + dt * P.speed, bakedT());   // slow motion; the playhead waits at the baked frontier
      if (S.t >= endT() - 1e-6) { S.t = endT(); S.mode = 'idle'; }
      S.target = S.t;
    } else if (S.mode === 'rewind') {
      const held = (now - S.rewStart) / 1000;
      let rate = Math.min(1.7, 0.35 + held * 2.2);   // the motor spins up
      rate = Math.min(rate, 0.06 + S.t * 2.4);      // and eases into the letters
      S.t = Math.max(0, S.t - rate * dt);
      if (S.t <= 0) { S.t = 0; S.mode = 'idle'; }
      S.target = S.t;
    } else if (S.mode === 'scrub' || S.mode === 'ease') {
      S.target = Math.max(0, Math.min(S.target, bakedT()));
      S.t += (S.target - S.t) * (1 - Math.exp(-dt * 13));
      if (S.mode === 'ease' && Math.abs(S.target - S.t) < 2e-4) { S.t = S.target; S.mode = 'idle'; }
    }
    if (S.dirty || S.t !== S.drawnT) { draw(S.t); S.drawnT = S.t; S.dirty = false; }
    rv.draw(now);
  }

  build();
  offs.push(stage.frame((dt) => frame(dt)));
  let rt = 0;
  offs.push(stage.on('resize', () => { S.dirty = true; clearTimeout(rt); rt = setTimeout(() => { if (alive) build(); }, 200); }));

  const Ctl = (key, lbl, min, max, step) => ({ key, label: lbl, min, max, step });
  const BAKE = new Set(['n', 'visc', 'tens', 'grav', 'len']);
  let bt = 0;
  const tune = {
    title: 'Rewind', values: P, defaults: DEF,
    groups: [
      { name: 'Bake (re-bakes)', items: [Ctl('n', 'Particles', 3000, 16000, 500), Ctl('visc', 'Viscosity', 0, 1, 0.01), Ctl('tens', 'Surface tension', 0, 2, 0.05), Ctl('grav', 'Splash (gravity)', 0.4, 2, 0.05), Ctl('len', 'Bake length (s)', 2, 20, 0.5)] },
      { name: 'Playback and look', items: [Ctl('speed', 'Play speed', 0.2, 1, 0.05), Ctl('sens', 'Scrub sensitivity', 0.3, 3, 0.05), Ctl('th', 'Metaball threshold', 0.2, 0.8, 0.01), Ctl('blur', 'Metaball blur', 0.5, 1.8, 0.05), Ctl('drop', 'Droplet size', 0, 1.2, 0.05)] },
    ],
    set(key, v) { P[key] = v; if (key === 'blur') interior = interiorFor(v); if (BAKE.has(key)) { clearTimeout(bt); bt = setTimeout(() => { if (alive) build(); }, 250); } else S.dirty = true; },
    reset() { Object.assign(P, DEF); interior = interiorFor(P.blur); build(); },
  };

  return {
    tune,
    debug: { S, bake, setT(t) { S.mode = 'idle'; S.t = S.target = t; S.dirty = true; }, get layout() { return layout; } },
    destroy() {
      alive = false; clearTimeout(rt); clearTimeout(reform); clearTimeout(bt);
      stopBake(); if (workerURL) URL.revokeObjectURL(workerURL);
      rv.destroy(); offs.forEach((f) => f());
      for (const b of [bufA, bufB]) gl.deleteBuffer(b);
      gl.deleteVertexArray(vao); gl.deleteVertexArray(emptyVao);
      if (fieldTex) gl.deleteTexture(fieldTex); if (fbo) gl.deleteFramebuffer(fbo); gl.deleteTexture(maskTex);
      for (const s of shaders) gl.deleteShader(s);
      gl.deleteProgram(splatP); gl.deleteProgram(compP);
      bake.data = null;
      link.remove(); stage.setBackdrop(null);
    },
  };
}
