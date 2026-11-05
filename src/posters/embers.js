// Embers: a few thousand glowing strands curl through a slow noise field, held inside the letters; their trails are blurred and
// thresholded like a metaball field, so neighbouring strands merge into soft white blobs: the name as a slow lava lamp. Nothing
// draws the letters; they are only the place the strands can't leave. Black only (darkOnly), like Glitter. Port of the test page
// docs/posters/prototypes/embers.html with Idan's tuning (5 Nov 2026). Idea after prinzipiell/tsl "Ember Flow" (no license:
// the idea only, our own code). Its unblurred sibling is the test page Strands.
//
// Under the picture: the text mask (Inter Tight 600) becomes a full-page signed distance field on the CPU (exact Euclidean
// distance transform, Felzenszwalb); its gradient says "out" everywhere. Particles follow the curl of 3D Perlin noise (x, y, time),
// so they swirl rather than bunch. While held, the field's walls stop them leaving a letter and outside they are pulled back along
// the distance field; they live and fade inside the letters and are reborn at random inside them. Render (raw WebGL2): each
// strand's last step as a line into a fading half-float trail buffer, repeated small Gaussian blurs at half resolution, then a
// smooth threshold in white on black.
//
// Gestures (src/gestures.js): drag stirs; tap lets go of the hold (they drift out into the black and are drawn back); hold is a
// gust, faster and brighter; double tap calls them back at once (a beat later, so a third tap can still mean reveal). Reveal: the
// distance field's contours and every strand. Self-demo: one release until the first touch. The flow moves at rest (Idan's call,
// as Jet); under reduced motion the picture is built once and then stands still.

import { getGL, mulberry32 } from '../engine.js';
import { pressTracker, TAP, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';
import { createReveal, grid as rvGrid, corners, titleBlock, ink as rvInk } from './reveal.js';
import { linesFor, lettersFor } from '../name.js';

const FAMILY = 'Inter Tight', WEIGHT = 600, OWN = ['Idan', 'Segev'];
// Idan's tuning from the test page (5 Nov 2026)
const DEF = { blob: 2.9, th: 0.95, soft: 0.07, mix: 0, count: 8300, speed: 1.18, curl: 1.15, evolve: 0.5, life: 4.6, trail: 1.18, bright: 2.23, gain: 1.6, spark: 0.66, wall: 1.45, push: 0.45, away: 3.1, back: 0.5, pull: 1.5, stir: 0.65, blow: 1.2 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- the shape: text mask -> full-page signed distance field, in CSS px ----------
function edt1(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s;
    do { const r = v[k]; s = ((f[q] + q * q) - (f[r] + r * r)) / (2 * q - 2 * r); } while (s <= z[k] && --k >= 0);
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const r = v[k]; d[q] = (q - r) * (q - r) + f[r]; }
}
function edt(grid, w, h) {
  const n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = grid[y * w + x]; edt1(f, h, d, v, z); for (let y = 0; y < h; y++) grid[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = grid[y * w + x]; edt1(f, w, d, v, z); for (let x = 0; x < w; x++) grid[y * w + x] = d[x]; }
}
function field(lines, W, H) {
  const gs = 0.5;   // grid cells per CSS px
  const gw = Math.ceil(W * gs), gh = Math.ceil(H * gs);
  const c = document.createElement('canvas'); c.width = gw; c.height = gh;
  const x = c.getContext('2d', { willReadFrequently: true });
  const font = (s) => `${WEIGHT} ${s}px "${FAMILY}", "Helvetica Neue", Arial, sans-serif`;
  x.font = font(200);
  const cap200 = x.measureText('H').actualBoundingBoxAscent;
  const maxW = Math.max(...lines.map((t) => { const m = x.measureText(t); return m.actualBoundingBoxLeft + m.actualBoundingBoxRight; }));
  const lh = 1.12;
  const k = Math.min(0.86 * W / maxW, (lines.length > 1 ? 0.58 : 0.4) * H / (cap200 * (1 + (lines.length - 1) * lh * 1.2)));
  const fs = 200 * k, cap = cap200 * k, step = cap * lh * 1.2;
  x.font = font(fs * gs); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  lines.forEach((t, i) => { const yc = H * 0.46 + (i - (lines.length - 1) / 2) * step; x.fillText(t, W / 2 * gs, (yc + cap / 2) * gs); });
  const a = x.getImageData(0, 0, gw, gh).data;
  const n = gw * gh, o = new Float64Array(n), ii = new Float64Array(n), sd = new Float32Array(n);
  const cells = [];
  for (let i = 0; i < n; i++) { const inside = a[i * 4 + 3] > 127; o[i] = inside ? 0 : 1e20; ii[i] = inside ? 1e20 : 0; if (inside) cells.push(i); }
  edt(o, gw, gh); edt(ii, gw, gh);
  for (let i = 0; i < n; i++) sd[i] = (o[i] > 0 ? Math.sqrt(o[i]) - 0.5 : 0.5 - Math.sqrt(ii[i])) / gs;
  return { sd, gw, gh, gs, cap, cells: Int32Array.from(cells.length ? cells : [((gh >> 1) * gw + (gw >> 1))]) };
}
// distance (CSS px) at a point, with its unit gradient in G; off the grid it keeps growing
const G = [0, 0];
function sample(F, px, py) {
  const fx = clamp(px * F.gs - 0.5, 0, F.gw - 1.001), fy = clamp(py * F.gs - 0.5, 0, F.gh - 1.001);
  const x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0, i = y0 * F.gw + x0, s = F.sd;
  const a = s[i], b = s[i + 1], c = s[i + F.gw], d = s[i + F.gw + 1];
  let gx = (b - a) * (1 - ty) + (d - c) * ty, gy = (c - a) * (1 - tx) + (d - b) * tx;
  const l = Math.hypot(gx, gy) || 1; G[0] = gx / l; G[1] = gy / l;
  const ox = px * F.gs - 0.5 - fx, oy = py * F.gs - 0.5 - fy;
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty + Math.hypot(ox, oy) / F.gs;
}

// ---------- the flow: curl of 3D Perlin noise ----------
function makeNoise(rand) {
  const perm = new Uint8Array(512), p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + t * (b - a);
function grad(h, x, y, z) { const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z); return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); }
function noise(perm, x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z, B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
  return lerp(lerp(lerp(grad(perm[AA] & 15, x, y, z), grad(perm[BA] & 15, x - 1, y, z), u), lerp(grad(perm[AB] & 15, x, y - 1, z), grad(perm[BB] & 15, x - 1, y - 1, z), u), v),
    lerp(lerp(grad(perm[AA + 1] & 15, x, y, z - 1), grad(perm[BA + 1] & 15, x - 1, y, z - 1), u), lerp(grad(perm[AB + 1] & 15, x, y - 1, z - 1), grad(perm[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
}

// ---------- strands (module level: small hot functions over typed arrays stay fast) ----------
function spawn(S, F, i) {
  const c = F.cells[(S.rand() * F.cells.length) | 0];
  S.x[i] = ((c % F.gw) + S.rand()) / F.gs; S.y[i] = (((c / F.gw) | 0) + S.rand()) / F.gs;
  S.px[i] = S.x[i]; S.py[i] = S.y[i]; S.vx[i] = 0; S.vy[i] = 0;
  S.age[i] = 0; S.life[i] = S.P.life * (0.5 + S.rand());
  S.br[i] = S.rand() < S.P.spark * 0.25 ? 2.5 + S.rand() * 2 : 0.35 + S.rand() * 0.65;
}
// one step: h is the hold (0 let go .. 1 held), pull the recall strength, gust the hold's speed-up
function stepStrands(S, F, dt, h, pull, gust, stir) {
  const P = S.P, cap = F.cap, f = 1 / (P.curl * cap), zt = S.t * P.evolve * 0.4, perm = S.perm;
  const sp = P.speed * cap * gust, e = 0.01, rad = P.stir * 0.6 * cap, m = 0.03 * cap, k = Math.min(1, dt * 3);
  const x = S.x, y = S.y, vx = S.vx, vy = S.vy;
  for (let i = 0; i < S.N; i++) {
    S.px[i] = x[i]; S.py[i] = y[i];
    const nx = x[i] * f, ny = y[i] * f;
    const cx = (noise(perm, nx, ny + e, zt) - noise(perm, nx, ny - e, zt)) / (2 * e), cy = -(noise(perm, nx + e, ny, zt) - noise(perm, nx - e, ny, zt)) / (2 * e);
    vx[i] += (cx * sp - vx[i]) * k; vy[i] += (cy * sp - vy[i]) * k;
    const d = sample(F, x[i], y[i]), gx = G[0], gy = G[1];
    if (d < 0) S.age[i] += dt;
    if (h > 0 && d > -m) {
      const vn = vx[i] * gx + vy[i] * gy;
      if (vn > 0) { vx[i] -= gx * vn * h * P.wall; vy[i] -= gy * vn * h * P.wall; }
      if (d > 0) {
        const a = pull * (0.4 + Math.min(1, d / cap)), damp = 1 - Math.min(1, dt * 1.5 * h);
        vx[i] = (vx[i] - gx * a * dt * 3) * damp; vy[i] = (vy[i] - gy * a * dt * 3) * damp;
      } else { const w = (d + m) / m * cap * P.wall * h * dt * 1.5; vx[i] -= gx * w; vy[i] -= gy * w; }
    }
    if (stir) {
      const dx = x[i] - stir.x, dy = y[i] - stir.y, w = Math.exp(-(dx * dx + dy * dy) / (rad * rad));
      if (w > 0.01) { const kk = w * Math.min(1, dt * 10); vx[i] += (stir.vx - vx[i]) * kk; vy[i] += (stir.vy - vy[i]) * kk; }
    }
    x[i] += vx[i] * dt; y[i] += vy[i] * dt;
    if (S.age[i] > S.life[i] && h > 0.98) spawn(S, F, i);
  }
}
// each strand's last step as a line segment, brightest mid-life
function segments(S, glow, buf) {
  let n = 0;
  for (let i = 0; i < S.N; i++) {
    const L = S.life[i], a = S.age[i];
    if (a > L) continue;
    const u = clamp(a / L, 0, 0.999), v = S.br[i] * glow * (u > 0 ? Math.sqrt(Math.sin(Math.PI * u)) : 1);
    if (v <= 0) continue;
    buf[n++] = S.px[i]; buf[n++] = S.py[i]; buf[n++] = v; buf[n++] = S.x[i]; buf[n++] = S.y[i]; buf[n++] = v;
  }
  return n;
}

const QVS = `#version 300 es
out vec2 uv; void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); uv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
const FADE = `#version 300 es
precision highp float; uniform float uK; out vec4 o; void main(){ o = vec4(0.0, 0.0, 0.0, uK); }`;
const LVS = `#version 300 es
layout(location = 0) in vec3 a; uniform vec2 uView; out float v;
void main(){ v = a.z; gl_Position = vec4(a.x / uView.x * 2.0 - 1.0, 1.0 - a.y / uView.y * 2.0, 0.0, 1.0); }`;
const LFS = `#version 300 es
precision highp float; in float v; out vec4 o; void main(){ o = vec4(v, v, v, 1.0); }`;
const BLUR = `#version 300 es
precision highp float; in vec2 uv; uniform sampler2D uT; uniform vec2 uStep; out vec4 o;
void main(){
  float w[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
  float s = texture(uT, uv).r * w[0];
  for (int i = 1; i < 5; i++) { vec2 d = uStep * float(i); s += (texture(uT, uv + d).r + texture(uT, uv - d).r) * w[i]; }
  o = vec4(s, 0.0, 0.0, 1.0);
}`;
const SHOW = `#version 300 es
precision highp float; in vec2 uv; uniform sampler2D uT, uB; uniform float uGain, uTh, uSoft, uMix; uniform vec3 uBg, uInk; out vec4 o;
void main(){
  float raw = 1.0 - exp(-texture(uT, uv).r * uGain);
  float f = 1.0 - exp(-texture(uB, uv).r * uGain);
  float b = smoothstep(uTh - uSoft, uTh + uSoft, f);
  o = vec4(mix(uBg, uInk, max(b, raw * uMix)), 1.0);
}`;

export async function mount(stage) {
  const canvas = stage.canvas, gl = getGL(canvas);
  if (!gl) throw new Error('webgl2 unavailable');
  if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) throw new Error('no float render targets');
  const dark = stage.theme.name === 'dark';          // black only: the shell always shows it dark (darkOnly)
  const P = { ...DEF };
  const offs = [];
  const reduced = !!stage.reduced;
  let alive = true;
  stage.setBackdrop(dark ? 0 : 1);

  // ---------- the face: Inter Tight 600, only the letters needed ----------
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
  const pFade = prog(QVS, FADE), pLine = prog(LVS, LFS), pBlur = prog(QVS, BLUR), pShow = prog(QVS, SHOW);
  const U = (p, n) => gl.getUniformLocation(p, n);
  const uni = { k: U(pFade, 'uK'), view: U(pLine, 'uView'), bt: U(pBlur, 'uT'), step: U(pBlur, 'uStep'),
    t: U(pShow, 'uT'), b: U(pShow, 'uB'), gain: U(pShow, 'uGain'), th: U(pShow, 'uTh'), soft: U(pShow, 'uSoft'), mix: U(pShow, 'uMix'), bg: U(pShow, 'uBg'), ink: U(pShow, 'uInk') };
  const vbo = gl.createBuffer(), vao = gl.createVertexArray(), emptyVao = gl.createVertexArray();
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  const targets = [];   // [tex, fbo] pairs: the trail at full size, two blur buffers at half
  let bw = 1, bh = 1;
  function target(w, h) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    return [t, f];
  }
  function makeTargets() {
    for (const [t, f] of targets) { gl.deleteTexture(t); gl.deleteFramebuffer(f); }
    targets.length = 0;
    bw = Math.max(1, stage.pw >> 1); bh = Math.max(1, stage.ph >> 1);
    targets.push(target(stage.pw, stage.ph), target(bw, bh), target(bw, bh));
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  const ink = stage.colors.fg, bg = stage.colors.bg;
  let vbuf = new Float32Array(0);
  function draw(dt, still) {
    const [[trail, trailF], [b1, b1F], [b2, b2F]] = targets;
    gl.bindFramebuffer(gl.FRAMEBUFFER, trailF); gl.viewport(0, 0, stage.pw, stage.ph);
    if (!still) {
      // the trail fades a little, then each strand draws its last step into it
      const glow = P.bright * (1 + S.pres * P.blow * 0.8), n = segments(S, glow, vbuf);
      gl.enable(gl.BLEND);
      gl.useProgram(pFade); gl.blendFunc(gl.ZERO, gl.SRC_ALPHA); gl.uniform1f(uni.k, Math.exp(-dt / P.trail));
      gl.bindVertexArray(emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.useProgram(pLine); gl.blendFunc(gl.ONE, gl.ONE); gl.uniform2f(uni.view, W, H);
      gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, vbuf.subarray(0, n), gl.STREAM_DRAW);
      gl.drawArrays(gl.LINES, 0, n / 3);
      gl.disable(gl.BLEND);
    }
    // blur: repeated small horizontal + vertical passes; more passes, bigger blobs
    const passes = Math.max(1, Math.round(P.blob * P.blob)), r = 1.25;
    gl.useProgram(pBlur); gl.viewport(0, 0, bw, bh); gl.uniform1i(uni.bt, 0); gl.activeTexture(gl.TEXTURE0); gl.bindVertexArray(emptyVao);
    for (let k = 0; k < passes; k++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, b1F); gl.bindTexture(gl.TEXTURE_2D, k ? b2 : trail); gl.uniform2f(uni.step, (k ? r : r * 2) / bw, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, b2F); gl.bindTexture(gl.TEXTURE_2D, b1); gl.uniform2f(uni.step, 0, r / bh); gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, stage.pw, stage.ph);
    gl.useProgram(pShow);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, b2); gl.uniform1i(uni.b, 1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, trail); gl.uniform1i(uni.t, 0);
    gl.uniform1f(uni.gain, P.gain); gl.uniform1f(uni.th, P.th); gl.uniform1f(uni.soft, P.soft); gl.uniform1f(uni.mix, P.mix);
    gl.uniform3fv(uni.bg, bg); gl.uniform3fv(uni.ink, ink);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  // ---------- state ----------
  let W = 1, H = 1, F = null;
  const S = { P, N: 0, t: 0, rand: mulberry32((stage.seed | 0) + 11), perm: null, pres: 0, holdAt: 0, recall: 0, hold: 1 };
  S.perm = makeNoise(S.rand);
  function alloc() {
    // fewer strands on a small screen: the same density, and a phone keeps its frame rate
    const n = Math.round(P.count * clamp((W * H) / (1200 * 750), 0.35, 1));
    S.N = n;
    for (const k of ['x', 'y', 'px', 'py', 'vx', 'vy', 'age', 'life', 'br']) S[k] = new Float32Array(n);
    for (let i = 0; i < n; i++) { spawn(S, F, i); S.age[i] = S.rand() * S.life[i]; }
    vbuf = new Float32Array(n * 6);
  }
  function build() {
    W = stage.W; H = stage.H;
    F = field(W / H < 1 && words.length > 1 ? words.slice() : [words.join(' ')], W, H);
    S.hold = 1; S.holdAt = 0; S.recall = 0;
    alloc(); makeTargets();
    // under reduced motion: let the strands lay down their trails once, then hold that picture still
    if (reduced) { for (let k = 0; k < 90; k++) { tick(1 / 60); draw(1 / 60, false); } }
  }
  function tick(dt) {
    S.t += dt;
    const since = S.t - S.holdAt;
    S.hold = S.recall > 0 ? 1 : (S.holdAt ? clamp((since - P.away) / P.back, 0, 1) : 1);
    S.recall = Math.max(0, S.recall - dt);
    const h = S.hold * S.hold * (3 - 2 * S.hold), pull = P.pull * F.cap * (S.recall > 0 ? 4 : 1.2) * h;
    stepStrands(S, F, dt, h, pull, (1 + S.pres * P.blow) * (reduced ? 0.35 : 1), stirP);
  }
  // a tap lets go: every strand gets a nudge out of its letter, and the walls open
  function letGo() {
    S.holdAt = S.t || 1e-6; S.recall = 0;
    for (let i = 0; i < S.N; i++) {
      sample(F, S.x[i], S.y[i]);
      const ox = S.x[i] - W / 2, oy = S.y[i] - H / 2, ol = Math.hypot(ox, oy) || 1;
      const a = P.push * F.cap * (0.4 + S.rand() * 0.9);
      S.vx[i] += (G[0] * 0.6 + ox / ol * 0.4) * a; S.vy[i] += (G[1] * 0.6 + oy / ol * 0.4) * a;
    }
  }
  const callBack = () => { S.recall = 1.6; S.holdAt = 0; };

  // ---------- gestures: drag stirs, tap lets go, hold blows on them, double tap calls them back ----------
  const press = pressTracker();
  let ptr = null, stirP = null, lastTap = 0, pending = 0, demoAt = 0, touched = false, wakeUntil = 0;
  offs.push(stage.on('down', (q, e) => {
    if (!press.down(q, e.pointerId)) return;
    touched = true; demoAt = 0; wakeUntil = performance.now() + 1e9;
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
      stirP = { x: q.x, y: q.y, vx: ptr.vx, vy: ptr.vy };
    }
    ptr.lx = q.x; ptr.ly = q.y; ptr.lt = now;
  }));
  offs.push(stage.on('up', (q, e) => {
    const r = press.up(q, e.pointerId);
    stirP = null; wakeUntil = performance.now() + 6000;
    if (!r || !ptr) return;
    ptr = null;
    if (!r.tap || e.type === 'pointercancel' || stage.revealed) return;
    const now = performance.now();
    if (now - lastTap < DOUBLE_MS) { lastTap = 0; clearTimeout(pending); pending = setTimeout(() => { if (alive && !stage.revealed) callBack(); }, REFORM_DELAY_MS - DOUBLE_MS + 40); }
    else { lastTap = now; letGo(); }
  }));
  offs.push(stage.on('reveal', () => { clearTimeout(pending); lastTap = 0; }));

  // ---------- reveal: the distance field's contours and every strand ----------
  const rv = createReveal(stage, (c, W_, H_, k) => {
    const colr = (a) => rvInk(stage, a);
    rvGrid(c, W_, H_, 24, colr, k); corners(c, W_, H_, 16, colr, k);
    if (!F) return;
    const st = 6;
    for (let yy = 0; yy < H_; yy += st) for (let xx = 0; xx < W_; xx += st) {
      const d = sample(F, xx, yy), band = Math.abs(d % (F.cap * 0.12));
      if (d > -2 && d < F.cap * 0.5 && band < 1.4) { c.fillStyle = colr((d < 2 ? 0.9 : 0.35) * k); c.fillRect(xx - 1, yy - 1, 2, 2); }
    }
    c.fillStyle = colr(0.7 * k);
    for (let i = 0; i < S.N; i += 2) c.fillRect(S.x[i] - 0.75, S.y[i] - 0.75, 1.5, 1.5);
    titleBlock(c, W_, H_, ['EMBERS · THE HOLD', `· ${S.N.toLocaleString()} strands on the curl of a noise field`, '— contours: the distance to the letters, the walls they meet', `| hold ${S.hold.toFixed(2)}: a tap lets go`], colr, k);
  }, { dim: 0.6 });

  // ---------- the frame ----------
  function frame(dt) {
    if (!F) return;
    const now = performance.now();
    dt = Math.min(dt, 1 / 30);
    if (demoAt && now >= demoAt) { demoAt = 0; letGo(); }
    const holding = press.active && ptr && !ptr.drag && press.holding;
    S.pres += ((holding ? 1 : 0) - S.pres) * (1 - Math.exp(-dt * (holding ? 2 : 3)));
    // under reduced motion the picture stands still until touched, and settles again a few seconds after
    const still = reduced && now > wakeUntil;
    if (!still) tick(dt);
    draw(dt, still);
    rv.draw(now);
  }

  build();
  if (!reduced && !touched) demoAt = performance.now() + 1600;   // the one self-demo: a single release, until the first touch
  offs.push(stage.frame((dt) => { if (alive) frame(dt); }));
  let rt = 0;
  offs.push(stage.on('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (alive) build(); }, 200); }));

  const Ctl = (key, lbl, min, max, step) => ({ key, label: lbl, min, max, step });
  let bt = 0;
  const tune = {
    title: 'Embers', values: P, defaults: DEF,
    groups: [
      { name: 'Blobs', items: [Ctl('blob', 'Blob size', 1, 4, 0.1), Ctl('th', 'Threshold', 0.05, 0.95, 0.01), Ctl('soft', 'Edge softness', 0.005, 0.3, 0.005), Ctl('mix', 'Strands on top', 0, 1, 0.01)] },
      { name: 'Strands', items: [Ctl('count', 'Strands (rebuilds)', 300, 12000, 100), Ctl('speed', 'Flow speed', 0.05, 2, 0.01), Ctl('curl', 'Curl size', 0.05, 1.5, 0.01), Ctl('evolve', 'Field change', 0, 1.5, 0.01), Ctl('life', 'Strand life (s)', 0.5, 12, 0.1)] },
      { name: 'Glow', items: [Ctl('trail', 'Trail length (s)', 0.02, 1.5, 0.01), Ctl('bright', 'Brightness', 0.05, 3, 0.01), Ctl('gain', 'Exposure', 0.2, 6, 0.05), Ctl('spark', 'Bright sparks (rebuilds)', 0, 1, 0.01)] },
      { name: 'Hold and release', items: [Ctl('wall', 'Wall strength', 0, 3, 0.05), Ctl('push', 'Release push', 0, 3, 0.05), Ctl('away', 'Time let go (s)', 0.2, 6, 0.1), Ctl('back', 'Drawn back over (s)', 0.5, 12, 0.1), Ctl('pull', 'Pull back', 0.1, 4, 0.05), Ctl('stir', 'Stir reach', 0.2, 3, 0.05), Ctl('blow', 'Hold gust', 0, 3, 0.05)] },
    ],
    set(key, v) { P[key] = v; if (key === 'count' || key === 'spark') { clearTimeout(bt); bt = setTimeout(() => { if (alive) alloc(); }, 250); } },
    reset() { Object.assign(P, DEF); build(); },
  };

  return {
    tune,
    debug: { P, S, get F() { return F; }, letGo, callBack, stats() { let out = 0; for (let i = 0; i < S.N; i++) if (sample(F, S.x[i], S.y[i]) > 0) out++; return { N: S.N, out, hold: +S.hold.toFixed(2) }; } },
    destroy() {
      alive = false; clearTimeout(rt); clearTimeout(bt); clearTimeout(pending);
      rv.destroy(); offs.forEach((f) => f());
      for (const [t, f] of targets) { gl.deleteTexture(t); gl.deleteFramebuffer(f); }
      gl.deleteBuffer(vbo); gl.deleteVertexArray(vao); gl.deleteVertexArray(emptyVao);
      for (const s of shaders) gl.deleteShader(s);
      for (const p of [pFade, pLine, pBlur, pShow]) gl.deleteProgram(p);
      link.remove(); stage.setBackdrop(null);
    },
  };
}
