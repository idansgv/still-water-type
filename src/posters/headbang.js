// Headbang: the name grows into a symmetric metal-band logo. Antlers (or thorns, roots, wings) sprout from the letter edges,
// mirrored about the word's centre, and melt into the letters with Embers' blur + threshold. Port of the test page
// docs/posters/prototypes/metal-logo.html with Idan's tuning (5 Nov 2026). Procedural throughout; nothing is drawn by hand.
//
// Under the picture: the text mask (Pirata One) becomes a signed distance field on the CPU (exact Euclidean distance transform,
// Felzenszwalb). Seeds are edge cells weighted by which way they face (tops, bottoms, outer sides). One spike per pair is grown
// on the left; its twin is drawn mirrored about the centre and moved onto the matching right-hand edge, so the ornament is
// exactly symmetric while the letters are not (as hand-drawn logos fake it). A spike is a stream of discs (MAX blend) whose
// radius tapers along it; it turns by a hook that grows toward the tip, Perlin wiggle, a pull to vertical, drip and fan-out,
// steers around other letters and stops if it hits one; antler beams carry tines on one side, knuckles at the joints, a burr
// at the base and bony bumps. Every spike has its own random stream, so the same seed always grows the same logo: a drag can
// regrow it live, and a node can be added or taken back without reshaping the rest.
// It builds up from the text outwards: the name alone (hold), then the spine, the antlers from the middle letters to the
// outer ones (stagger), small thorns last; each antler grows at a steady push that eases into its tip.
//
// Gestures (src/gestures.js): tap = another style and seed; drag = left/right turns the hook, down/up drips or raises the
// beams (live); hold = a new antler (and its mirror) grows toward the finger for as long as it is held; double tap takes the
// last one back (a beat later, so a third tap can still mean reveal). Headbang (the easter egg, Idan's exception to black and
// white): shake the phone, or scribble fast left and right, and the page (only the page) tears down the mirror axis onto
// blood red, with a shake, a punch and one flash frame; again to tear back. Reveal: the seeds, their twins and the axis.
// Self-demo: the logo grows once on load. Nothing moves at rest; under reduced motion it is grown at once and the tear is a cut.

import { getGL, mulberry32 } from '../engine.js';
import { pressTracker, TAP, REFORM_DELAY_MS } from '../gestures.js';
import { createReveal, grid as rvGrid, corners, titleBlock, ink as rvInk } from './reveal.js';
import { linesFor, lettersFor } from '../name.js';

const FAMILY = 'Pirata One', WEIGHT = 400, OWN = ['Idan', 'Segev'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Styles set the spike values; lengths and widths are in cap heights. Antlers is Idan's tuning (5 Nov 2026).
const BASE = { antler: false, tines: 3, blunt: 0, gnarl: 0, knuckle: 1 };
const GENRES = {
  antler: { pairs: 193, thorns: 9, len: 2, lenVar: 0.63, width: 0.085, taper: 0.6, wing: 1.5, up: 1.05, down: 0.3, side: 2.05, curve: 0.85, outward: 1, wiggle: 0.25, vert: 0.7, gravity: 0.73, fan: 0.45, branch: 0, bAngle: 48, bScale: 0.72, melt: 0.9, antler: true, tines: 3, blunt: 0.28, gnarl: 0.12, knuckle: 1.25 },
  death: { pairs: 48, thorns: 60, len: 0.85, lenVar: 0.6, width: 0.1, taper: 1.2, wing: 3, up: 1, down: 0.8, side: 0.7, curve: 1.1, outward: 0.8, wiggle: 0.5, vert: 0.6, gravity: 0, fan: 0.35, branch: 1.2, bAngle: 34, bScale: 0.55, melt: 0.6 },
  black: { pairs: 80, thorns: 20, len: 0.75, lenVar: 0.8, width: 0.05, taper: 0.9, wing: 1.2, up: 0.8, down: 1.6, side: 0.3, curve: 0.3, outward: 0.5, wiggle: 2.4, vert: 1.2, gravity: 0.35, fan: 0.1, branch: 2.6, bAngle: 24, bScale: 0.6, melt: 1.2 },
  wings: { pairs: 16, thorns: 30, len: 0.8, lenVar: 0.5, width: 0.1, taper: 1.4, wing: 5, up: 1, down: 0.5, side: 1.2, curve: 1.6, outward: 1, wiggle: 0.3, vert: 0.2, gravity: 0, fan: 1.1, branch: 1, bAngle: 40, bScale: 0.5, melt: 1.8 },
  brutal: { pairs: 147, thorns: 178, len: 0.97, lenVar: 0.9, width: 0.155, taper: 1.9, wing: 8, up: 0.8, down: 1.75, side: 1.45, curve: 0.95, outward: 0.64, wiggle: 3, vert: 0.65, gravity: 0.71, fan: 0.9, branch: 2.9, bAngle: 45, bScale: 0.6, melt: 2.4 },
};
for (const g in GENRES) GENRES[g] = { ...BASE, ...GENRES[g] };
const ORDER = Object.keys(GENRES);
const DEF = { ...GENRES.antler, axis: true, soft: 0.04, size: 0.5, grow: 1.6, hold: 0.7, stagger: 1.2, sens: 1, reach: 1.4,
  shake: 2.3, tearS: 0.45, jag: 0.5, jolt: 1, punch: 1, flash: 1 };
const BLOOD = [0xa3 / 255, 0x08 / 255, 0x0c / 255];   // #a3080c

// ---------- the shape: text mask -> signed distance field (CSS px) and the letters' edge cells ----------
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
const font = (s) => `${WEIGHT} ${s}px "${FAMILY}", "Helvetica Neue", Arial, sans-serif`;
function field(t, W, H, pw, ph, size) {
  // the full-resolution mask (the letters themselves, drawn into the logo)
  const m = document.createElement('canvas'); m.width = pw; m.height = ph;
  const mx = m.getContext('2d');
  mx.font = font(200);
  const cap200 = mx.measureText('H').actualBoundingBoxAscent;
  const mt = mx.measureText(t), tw200 = mt.actualBoundingBoxLeft + mt.actualBoundingBoxRight;
  // a metal logo is one line; leave room around it for the spikes
  const k = Math.min(size * W / tw200, 0.17 * H / cap200), fs = 200 * k, cap = cap200 * k;
  const left = W / 2 - tw200 * k / 2 + mt.actualBoundingBoxLeft * k, base = H * 0.47 + cap / 2;
  mx.setTransform(pw / W, 0, 0, ph / H, 0, 0); mx.font = font(fs); mx.fillStyle = '#fff'; mx.textBaseline = 'alphabetic';
  mx.fillText(t, left, base);
  // the distance field at half resolution
  const gs = 0.5, gw = Math.ceil(W * gs), gh = Math.ceil(H * gs);
  const c = document.createElement('canvas'); c.width = gw; c.height = gh;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.setTransform(gs, 0, 0, gs, 0, 0); x.font = font(fs); x.fillStyle = '#fff'; x.textBaseline = 'alphabetic';
  x.fillText(t, left, base);
  const a = x.getImageData(0, 0, gw, gh).data;
  const n = gw * gh, o = new Float64Array(n), ii = new Float64Array(n), sd = new Float32Array(n);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < n; i++) {
    const inside = a[i * 4 + 3] > 127; o[i] = inside ? 0 : 1e20; ii[i] = inside ? 1e20 : 0;
    if (inside) { const cx = (i % gw) / gs, cy = ((i / gw) | 0) / gs; x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy); }
  }
  edt(o, gw, gh); edt(ii, gw, gh);
  for (let i = 0; i < n; i++) sd[i] = (o[i] > 0 ? Math.sqrt(o[i]) - 0.5 : 0.5 - Math.sqrt(ii[i])) / gs;
  if (x0 > x1) { x0 = W / 2 - 1; x1 = W / 2 + 1; y0 = H / 2 - 1; y1 = H / 2 + 1; }
  const F = { sd, gw, gh, gs, cap, mask: m, cx: (x0 + x1) / 2 + 1 / gs / 2, hw: Math.max(1, (x1 - x0) / 2), top: y0, bot: y1, edges: [] };
  for (let i = 0; i < n; i++) {
    if (sd[i] > -2.2 && sd[i] <= -0.2) {
      const ex = ((i % gw) + 0.5) / gs, ey = (((i / gw) | 0) + 0.5) / gs;
      sample(F, ex, ey); F.edges.push({ x: ex, y: ey, nx: G[0], ny: G[1] });
    }
  }
  return F;
}
// distance (CSS px) at a point, with its unit gradient in G
const G = [0, 0];
function sample(F, px, py) {
  const fx = clamp(px * F.gs - 0.5, 0, F.gw - 1.001), fy = clamp(py * F.gs - 0.5, 0, F.gh - 1.001);
  const x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0, i = y0 * F.gw + x0, s = F.sd;
  const a = s[i], b = s[i + 1], c = s[i + F.gw], d = s[i + F.gw + 1];
  const gx = (b - a) * (1 - ty) + (d - c) * ty, gy = (c - a) * (1 - tx) + (d - b) * tx, l = Math.hypot(gx, gy) || 1;
  G[0] = gx / l; G[1] = gy / l;
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

// ---------- the wiggle: 3D Perlin noise ----------
function makeNoise(rand) {
  const perm = new Uint8Array(512), p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y, z) => { const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z); return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
  const l = (a, b, t) => a + t * (b - a);
  return (x, y, z) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z, B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
    return l(l(l(grad(perm[AA] & 15, x, y, z), grad(perm[BA] & 15, x - 1, y, z), u), l(grad(perm[AB] & 15, x, y - 1, z), grad(perm[BB] & 15, x - 1, y - 1, z), u), v),
      l(l(grad(perm[AA + 1] & 15, x, y, z - 1), grad(perm[BA + 1] & 15, x - 1, y, z - 1), u), l(grad(perm[AB + 1] & 15, x, y - 1, z - 1), grad(perm[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
  };
}

// ---------- render: discs into a float buffer (MAX blend) over the letters, Embers' blur + threshold, then the tear ----------
const QVS = `#version 300 es
out vec2 uv; void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); uv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
const MASK = `#version 300 es
precision highp float; in vec2 uv; uniform sampler2D uM; out vec4 o; void main(){ o = vec4(texture(uM, uv).a, 0.0, 0.0, 1.0); }`;
const DVS = `#version 300 es
layout(location = 0) in vec3 a; uniform vec2 uView; uniform float uDpr; out float vr; out float vs;
void main(){ vr = a.z * uDpr; vs = (a.z * 2.0 + 3.0) * uDpr; gl_PointSize = vs; gl_Position = vec4(a.x / uView.x * 2.0 - 1.0, 1.0 - a.y / uView.y * 2.0, 0.0, 1.0); }`;
const DFS = `#version 300 es
precision highp float; in float vr; in float vs; out vec4 o;
void main(){ float d = length(gl_PointCoord - 0.5) * vs; o = vec4(clamp(vr - d + 0.5, 0.0, 1.0), 0.0, 0.0, 1.0); }`;
const BLUR = `#version 300 es
precision highp float; in vec2 uv; uniform sampler2D uT; uniform vec2 uStep; out vec4 o;
void main(){
  float w[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
  float s = texture(uT, uv).r * w[0];
  for (int i = 1; i < 5; i++) { vec2 d = uStep * float(i); s += (texture(uT, uv + d).r + texture(uT, uv - d).r) * w[i]; }
  o = vec4(s, 0.0, 0.0, 1.0);
}`;
// The page (only the page) tears down the logo's mirror axis: a crack zips down (uZip), the halves are flung (uD, uA, uDrop)
// with the old background, the new one lies underneath; the logo stays put, inked for whichever page is under it. On impact the
// view shakes (uShake), the logo punches out (uPunch) and one frame flashes (uFlash). uTear 0 = old page whole, 1 = gone.
const SHOW = `#version 300 es
precision highp float; in vec2 uv; uniform sampler2D uT; uniform float uSoft, uTear, uSeed, uZip, uD, uA, uDrop, uPunch, uFlash, uJag;
uniform vec2 uView, uShake, uC; uniform vec3 uFgA, uBgA, uFgB, uBgB; out vec4 o;
float ink(vec2 q){ return smoothstep(0.5 - uSoft, 0.5 + uSoft, texture(uT, vec2(q.x / uView.x, 1.0 - q.y / uView.y)).r); }
float hash(float n){ return fract(sin(n * 12.9898 + uSeed) * 43758.5453); }
float edge(float y){
  float e = sin(y * 0.021 + uSeed) * 14.0 + sin(y * 0.057 + uSeed * 2.0) * 7.0 + sin(y * 0.13 + uSeed * 3.0) * 3.0;
  e += (abs(fract(y * 0.045 + uSeed) - 0.5) - 0.25) * uJag * 40.0; // serrated teeth
  return uView.x * 0.5 + e + (hash(floor(y * 0.5)) - 0.5) * 3.0; // fibres
}
vec2 rot(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
void main(){
  vec2 p = vec2(uv.x, 1.0 - uv.y) * uView + uShake; // CSS px, y down
  float b = ink(uC + (p - uC) / uPunch);
  vec3 col = mix(uBgB, uFgB, b);
  if (uTear < 1.0) {
    // left half pivots about its top-left corner, right half about its top-right
    vec2 ql = rot(p - vec2(-uD, uDrop), uA);
    vec2 qr = rot(p - vec2(uView.x + uD, uDrop), -uA) + vec2(uView.x, 0.0);
    float gap = p.y < uZip ? 2.5 : 0.0; // the crack, before the halves move
    float rim = 2.5 + 2.0 * hash(floor(p.y * 0.7) + 7.0);
    vec3 page = uBgB; bool old = false;
    if (ql.x < edge(ql.y) - gap && ql.y > -uView.y * 0.2) {
      old = true; page = uBgA;
      if (uTear > 0.0 && edge(ql.y) - ql.x < rim) page = mix(page, vec3(0.62), 0.55); // the paper's torn core
    } else if (qr.x > edge(qr.y) + 1.5 + gap && qr.y > -uView.y * 0.2) {
      old = true; page = uBgA;
      if (uTear > 0.0 && qr.x - edge(qr.y) - 1.5 < rim) page = mix(page, vec3(0.62), 0.55);
    }
    col = mix(page, old ? uFgA : uFgB, b);
  }
  o = vec4(mix(col, vec3(1.0), uFlash), 1.0);
}`;

export async function mount(stage) {
  const canvas = stage.canvas, gl = getGL(canvas);
  if (!gl) throw new Error('webgl2 unavailable');
  if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) throw new Error('no float render targets');
  const dark = stage.theme.name === 'dark';
  const P = { ...DEF, genre: 'antler' };
  const offs = [];
  const reduced = !!stage.reduced;
  let alive = true;
  stage.setBackdrop(dark ? 0 : 1);

  // ---------- the face: Pirata One, only the letters needed ----------
  const words = linesFor(stage, OWN), text = words.join(' ');
  const link = document.createElement('link'); link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=Pirata+One&text=${encodeURIComponent(lettersFor(stage, OWN.join('') + ' '))}&display=block`;
  document.head.appendChild(link);
  await Promise.race([new Promise((r) => { link.onload = r; link.onerror = r; }), new Promise((r) => setTimeout(r, 2500))]);
  try { await Promise.race([document.fonts.load(font(100), text), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* the fallback face */ }

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
  const pMask = prog(QVS, MASK), pDot = prog(DVS, DFS), pBlur = prog(QVS, BLUR), pShow = prog(QVS, SHOW);
  const U = (p, n) => gl.getUniformLocation(p, n);
  const uni = { m: U(pMask, 'uM'), view: U(pDot, 'uView'), dpr: U(pDot, 'uDpr'), bt: U(pBlur, 'uT'), step: U(pBlur, 'uStep') };
  for (const n of ['uT', 'uSoft', 'uTear', 'uSeed', 'uZip', 'uD', 'uA', 'uDrop', 'uPunch', 'uFlash', 'uJag', 'uView', 'uShake', 'uC', 'uFgA', 'uBgA', 'uFgB', 'uBgB']) uni['s' + n] = U(pShow, n);
  const vbo = gl.createBuffer(), vao = gl.createVertexArray(), emptyVao = gl.createVertexArray();
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  const targets = [];   // [tex, fbo]: the logo field, two blur buffers
  let maskTex = null;
  function target(w, h) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return [t, f];
  }
  function makeTargets() {
    for (const [t, f] of targets) { gl.deleteTexture(t); gl.deleteFramebuffer(f); }
    targets.length = 0;
    for (let i = 0; i < 3; i++) targets.push(target(stage.pw, stage.ph));
    if (maskTex) gl.deleteTexture(maskTex);
    maskTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, maskTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, F.mask);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  // a fresh field holding only the letters; the spikes are stamped on top
  function clearAcc() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets[0][1]); gl.viewport(0, 0, stage.pw, stage.ph);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(pMask); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, maskTex); gl.uniform1i(uni.m, 0);
    gl.bindVertexArray(emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function drawStamps() {
    if (!stamps.length) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets[0][1]); gl.viewport(0, 0, stage.pw, stage.ph);
    gl.enable(gl.BLEND); gl.blendEquation(gl.MAX); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(pDot); gl.uniform2f(uni.view, W, H); gl.uniform1f(uni.dpr, stage.pw / W);
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(stamps), gl.STREAM_DRAW);
    gl.drawArrays(gl.POINTS, 0, stamps.length / 3);
    gl.disable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD);
    stamps = [];
  }
  // [ink, page] for the plain page or blood red
  const scheme = (blood) => (blood ? [[0, 0, 0], BLOOD] : [stage.colors.fg, stage.colors.bg]);
  function present() {
    const [[acc], [b1, f1], [b2, f2]] = targets;
    // melt: repeated small blur passes, then a threshold at one half
    const passes = Math.round(P.melt * P.melt), r = 0.9 * stage.pw / W;
    let src = acc;
    gl.useProgram(pBlur); gl.viewport(0, 0, stage.pw, stage.ph); gl.uniform1i(uni.bt, 0); gl.activeTexture(gl.TEXTURE0); gl.bindVertexArray(emptyVao);
    for (let k = 0; k < passes; k++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, f1); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform2f(uni.step, r / stage.pw, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, f2); gl.bindTexture(gl.TEXTURE_2D, b1); gl.uniform2f(uni.step, 0, r / stage.ph); gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = b2;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, stage.pw, stage.ph);
    gl.useProgram(pShow); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform1i(uni.suT, 0);
    const B = scheme(S.blood), A = S.tear < 1 ? scheme(!S.blood) : B;
    gl.uniform3fv(uni.suFgA, A[0]); gl.uniform3fv(uni.suBgA, A[1]); gl.uniform3fv(uni.suFgB, B[0]); gl.uniform3fv(uni.suBgB, B[1]);
    gl.uniform1f(uni.suSoft, P.soft); gl.uniform1f(uni.suTear, S.tear); gl.uniform1f(uni.suSeed, S.tearSeed); gl.uniform2f(uni.suView, W, H);
    // the crack zips down over the first 18%, then the halves are flung out (fast start) and fall
    const Z = 0.18, u = clamp((S.tear - Z) / (1 - Z), 0, 1), fling = 1 - (1 - u) ** 3;
    gl.uniform1f(uni.suZip, clamp(S.tear / Z, 0, 1) * H * 1.05);
    gl.uniform1f(uni.suD, fling * W * 0.75); gl.uniform1f(uni.suA, fling * 0.55); gl.uniform1f(uni.suDrop, u * u * H * 0.5);
    gl.uniform1f(uni.suJag, P.jag);
    // the hit: shake, punch, one flash frame
    const since = S.hitAt ? (performance.now() - S.hitAt) / 1000 : -1, hit = since >= 0 ? Math.exp(-since * 11) : 0, amp = P.jolt * 18 * hit;
    gl.uniform2f(uni.suShake, (S.rand() * 2 - 1) * amp, (S.rand() * 2 - 1) * amp);
    gl.uniform1f(uni.suPunch, 1 + 0.12 * P.punch * hit);
    gl.uniform1f(uni.suFlash, since >= 0 && since < 0.05 ? 0.85 * P.flash : 0);
    gl.uniform2f(uni.suC, F.cx, (F.top + F.bot) / 2);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  // ---------- spikes ----------
  // One agent per pair is grown on the left; its twin is drawn mirrored about the word's centre plus an offset, so it starts on
  // the matching edge of the right-hand letters. Each carries its own random stream (adding one never reshapes the rest).
  let W = 1, H = 1, F = null, agents = [], stamps = [], seeds = [];
  const S = { rand: mulberry32((stage.seed | 0) + 23), seed: 0, noise: null, blood: false, tear: 1, tearSeed: 0, hitAt: 0, twist: 0 };
  S.seed = (S.rand() * 2 ** 31) | 0; S.noise = makeNoise(S.rand);
  let rnd = mulberry32(S.seed);
  const nodes = [];
  function spike(o) {
    const R = o.rng || mulberry32((rnd() * 2 ** 31) | 0);
    const L = Math.max(1, o.L), br = [];
    if (P.antler && !o.axis) {
      // tines spaced along the beam, the first (brow) tine near the base; a tine may fork once
      const nt = o.gen === 0 ? Math.round(P.tines) : (o.gen === 1 && R() < 0.35 ? 1 : 0);
      for (let i = 0; i < nt; i++) br.push(L * (o.gen === 0 ? 0.18 + 0.62 * (i + 0.3 * R()) / Math.max(1, nt) : 0.45 + 0.3 * R()));
    } else {
      const nb = o.gen < 3 && o.w0 > 0.9 ? Math.floor(P.branch * L / F.cap + R()) : 0;
      for (let i = 0; i < nb; i++) br.push(L * (0.12 + 0.7 * R()));
    }
    br.sort((a, b) => a - b);
    agents.push({ s: 0, bi: 0, br, z: R() * 100, gen: 0, twin: true, ox: 0, oy: 0, vs: Math.sign(Math.sin(o.th)) || -1, ...o, L, rng: R });
  }
  function pickEdge(weight) {
    const E = F.edges, cum = new Float64Array(E.length); let sum = 0;
    for (let i = 0; i < E.length; i++) { sum += weight(E[i]); cum[i] = sum; }
    return () => { if (sum <= 0) return null; const r = rnd() * sum; let lo = 0, hi = E.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; } return E[lo]; };
  }
  function twinOf(e) {
    // the right-hand edge point nearest the mirror image, facing the mirrored way
    const tx = 2 * F.cx - e.x, ty = e.y; let best = null, bd = (F.cap * 0.22) ** 2;
    for (const q of F.edges) {
      if (q.x < F.cx) continue;
      const d = (q.x - tx) ** 2 + (q.y - ty) ** 2;
      if (d < bd && -q.nx * e.nx + q.ny * e.ny > 0.5) { bd = d; best = q; }
    }
    return best;
  }
  function strokeHalf(e) {
    let lo = 0;
    for (let t = 0; t < F.cap * 0.4; t += 1) { const d = sample(F, e.x - e.nx * t, e.y - e.ny * t); if (d < lo) lo = d; else if (d > lo + 1) break; }
    return Math.max(1, -lo);
  }
  function clearRay(x, y, th, len) {
    const c = Math.cos(th), s = Math.sin(th); let out = false;
    for (let t = 1; t < len; t += 2) { const d = sample(F, x + c * t, y + s * t); if (d > 1.5) out = true; else if (out && d < 0.5) return false; }
    return true;
  }
  function seedPairs(count, small) {
    const cx = F.cx, hw = F.hw, cap = F.cap;
    const pick = pickEdge((e) => {
      if (e.x > cx - 1) return 0;
      const o = Math.abs(e.x - cx) / hw;
      const w = P.up * Math.max(0, -e.ny) ** 2 + P.down * Math.max(0, e.ny) ** 2 + P.side * Math.max(0, -e.nx) ** 2 * (small ? 1 : 0.4 + o * o * 1.6);
      return small ? w + 0.15 : w * (0.5 + o);
    });
    const used = [], gap = (small ? 0.05 : 0.1) * cap;
    for (let n = 0, tries = 0; n < count && tries < count * 30; tries++) {
      const e = pick(); if (!e) break;
      if (used.some((q) => (q.x - e.x) ** 2 + (q.y - e.y) ** 2 < gap * gap)) continue;
      const tw = Math.abs(e.x - cx) < 2 ? e : twinOf(e); if (!tw) continue;
      used.push(e); n++;
      const side = -1, o = Math.abs(e.x - cx) / hw;
      // direction: the edge normal, pulled toward vertical on tops and bottoms, fanned outward
      const dx = e.nx + side * P.fan * 0.3, dy = e.ny + (e.ny < -0.3 ? -1 : e.ny > 0.3 ? 1 : 0) * P.vert * 0.5;
      const th = Math.atan2(dy, dx) + (rnd() - 0.5) * 0.5 + S.twist * (small ? 0.5 : 1);
      // no spikes aimed into a counter or at the next letter (checked for the twin too)
      if (!clearRay(e.x, e.y, th, 0.25 * cap) || !clearRay(tw.x, tw.y, Math.PI - th, 0.25 * cap)) continue;
      const w0 = Math.min(strokeHalf(e) * 0.95, (small ? 0.4 : 1) * P.width * cap * (0.55 + 0.45 * rnd()));
      const L = (small ? 0.14 * (0.5 + rnd()) : P.len * (1 - P.lenVar * rnd()) * (1 + P.wing * o * o * o)) * cap;
      // hooks bend outward (away from the axis) or either way
      const turnOut = Math.sign(-Math.sin(th) * side) || 1;
      const k = P.curve * (rnd() < P.outward ? turnOut : (rnd() < 0.5 ? -1 : 1)) * (0.5 + rnd());
      spike({ x: e.x - e.nx * w0 * 0.6, y: e.y - e.ny * w0 * 0.6, th, w0, L, k, side, ox: tw.x - (2 * cx - e.x), oy: tw.y - e.y, gen: small ? 3 : 0 });
      seeds.push([e.x, e.y, tw.x, tw.y]);
      if (P.antler && !small) {
        // the burr: a ring of knobs where the antler leaves the letter
        // (stamped when the antler starts to grow)
        const a = agents[agents.length - 1]; a.burr = [];
        for (let i = 0; i < 9; i++) { const g = i / 9 * Math.PI * 2 + rnd() * 0.4; a.burr.push(a.x + Math.cos(g) * w0 * 1.05, a.y + Math.sin(g) * w0 * 1.05, w0 * (0.22 + 0.12 * rnd())); }
      }
    }
  }
  function growAll() {
    agents = []; stamps = []; seeds = [];
    if (!F || !F.edges.length) return;
    seedPairs(Math.round(P.pairs), false);
    seedPairs(Math.round(P.thorns), true);
    if (P.axis) {
      // the centre spikes leave from the type's top and bottom edge on the axis, never through the letters,
      // and only where a letter sits on the axis (between two words they would float)
      const w0 = P.width * F.cap * 1.15;
      let y0 = F.top, y1 = F.bot, hit = false;
      for (let y = F.top; y <= F.bot; y++) if (sample(F, F.cx, y) < -w0 * 0.25) { if (!hit) y0 = y; y1 = y; hit = true; }
      if (hit) for (const dir of [-1, 1]) spike({ x: F.cx, y: (dir < 0 ? y0 : y1) - dir * w0 * 0.5, th: dir * Math.PI / 2, w0, L: w0 * 0.5 + P.len * F.cap * 1.3, k: 0, side: 0, twin: false, axis: true });
    }
    for (const n of nodes) growNode(n);
    // the buildup, from the text outwards: the name alone first, then the spine, the antlers from the middle letters
    // to the outer ones, and the small thorns last (its own random stream, so the logo itself is unchanged)
    const tr = mulberry32(S.seed ^ 0x5bd1e995);
    for (const a of agents) {
      const o = Math.min(1, Math.abs(a.x - F.cx) / F.hw);
      a.wait = a.tx != null ? 0 : a.axis ? P.hold * 0.7 : P.hold + P.stagger * (a.gen === 3 ? 1 + 0.5 * tr() : 0.75 * o + 0.25 * tr());
    }
  }
  function stamp(a, x, y, r) {
    stamps.push(x, y, r);
    if (a.twin) stamps.push(2 * F.cx - x + a.ox, y + a.oy, r);
  }
  function stepAgent(a, dt) {
    const cap = F.cap, rem = a.L - a.s;
    if (rem < 0.4) return false;
    if (a.wait > 0) { a.wait = dt >= 1e3 ? 0 : a.wait - dt; if (a.wait > 0) return true; }
    if (a.burr) { for (let i = 0; i < a.burr.length; i += 3) stamp(a, a.burr[i], a.burr[i + 1], a.burr[i + 2]); a.burr = null; }
    // a steady push that eases into the tip, so each antler is seen leaving its letter (not a burst in the first frame)
    let ds = dt >= 1e3 ? rem : Math.max(a.L * (0.25 + 0.75 * rem / a.L) / (0.45 * P.grow) * dt, cap * 0.02 * dt);
    ds = Math.min(ds, rem);
    const f = 2 / cap;
    while (ds > 0) {
      const u = a.s / a.L, fall = Math.pow(Math.max(0, 1 - u), P.taper);
      // antlers keep some width to a rounded tip and swell in bony bumps along the way
      const r = P.antler ? a.w0 * (P.blunt + (1 - P.blunt) * fall) * (1 + P.gnarl * 1.6 * S.noise(a.s * 3 / cap, a.z, 7.3)) : a.w0 * fall;
      const h = Math.min(ds, Math.max(0.5, r * 0.35), 2);
      let turn = a.k * (0.35 + u) * h / cap;
      if (!a.axis) turn += P.wiggle * S.noise(a.x * f, a.y * f, a.z) * 2.2 * h / cap;
      a.th += turn;
      let dx = Math.cos(a.th), dy = Math.sin(a.th);
      const b = h / cap;
      dx += a.side * P.fan * b * 0.6;
      dy += (P.gravity + P.vert * Math.sign(dy) * 0.6) * b;
      // a node the visitor placed reaches for their finger until it gets there
      if (a.tx != null) { const gx = a.tx - a.x, gy = a.ty - a.y, gl2 = Math.hypot(gx, gy); if (gl2 > r + 2) { dx += gx / gl2 * 4 * b; dy += gy / gl2 * 4 * b; } }
      // once clear of its letter, a spike steers around other ink and stops if it still hits it
      if (!a.axis) {
        const d = sample(F, a.x, a.y), reach = r + 0.12 * cap;
        if (d > r + 1) a.out = true;
        if (a.out && d < reach) { const p = (1 - Math.max(0, d) / reach) * 2.5 * b * cap / Math.max(4, d); dx += G[0] * p; dy += G[1] * p; }
        if (a.out && d < 0.5) { a.s = a.L; break; }
        if (a.twin && a.out && sample(F, 2 * F.cx - a.x + a.ox, a.y + a.oy) < 0.5) { a.s = a.L; break; }
      }
      a.th = Math.atan2(dy, dx);
      a.x += Math.cos(a.th) * h; a.y += Math.sin(a.th) * h; a.s += h; ds -= h;
      if (r > 0.3) stamp(a, a.x, a.y, r);
      while (a.bi < a.br.length && a.s >= a.br[a.bi]) {
        a.bi++;
        const ang = P.bAngle * Math.PI / 180 * (0.7 + 0.6 * a.rng());
        // antler tines all rise from the same side of the beam: the one heading further along the beam's own up or down
        const tineSg = Math.sin(a.th + ang) * a.vs > Math.sin(a.th - ang) * a.vs ? 1 : -1;
        const turnTo = a.axis ? [-1, 1] : [P.antler ? tineSg : (a.rng() < 0.5 ? -1 : 1)];
        if (P.antler && !a.axis) stamp(a, a.x, a.y, r * P.knuckle); // a knuckle at the joint
        for (const sg of turnTo) {
          const th = a.th + sg * ang, side = a.axis ? Math.sign(Math.cos(th)) || 1 : a.side;
          const kk = a.axis ? P.curve * 0.6 * Math.sign(-Math.sin(th) * side) : a.k * (P.antler ? 0.4 : 0.6 + 0.6 * a.rng());
          const L = P.antler ? (a.L - a.s) * (0.5 + 0.35 * a.rng()) + cap * 0.18 : (a.L - a.s) * (0.35 + 0.5 * a.rng()) + cap * 0.08;
          if (a.axis && sg > 0) continue;   // an axis branch on the right is the twin of the one on the left
          spike({ x: a.x, y: a.y, th, w0: r * P.bScale, L, k: kk, side, gen: a.gen + 1, twin: a.axis ? true : a.twin, ox: a.axis ? 0 : a.ox, oy: a.axis ? 0 : a.oy, rng: mulberry32((a.rng() * 2 ** 31) | 0) });
        }
      }
    }
    return a.s < a.L - 0.4;
  }
  // nodes the visitor adds by holding: an antler (and its mirror) from the nearest letter edge toward the finger
  function addNode(px, py) {
    const cx = F.cx, lx = px > cx ? 2 * cx - px : px;   // grown on the left; the twin is the right
    let e = null, bd = Infinity;
    for (const q of F.edges) { if (q.x > cx + 1) continue; const d = (q.x - lx) ** 2 + (q.y - py) ** 2; if (d < bd) { bd = d; e = q; } }
    if (!e) return null;
    const tw = Math.abs(e.x - cx) < 2 ? e : twinOf(e) || { x: 2 * cx - e.x, y: e.y };
    const n = { e, tw, tx: lx, ty: py, L: F.cap * 0.1, seed: (S.rand() * 2 ** 31) | 0 };
    nodes.push(n); return n;
  }
  function aimNode(n, px, py) { n.tx = px > F.cx ? 2 * F.cx - px : px; n.ty = py; }
  function growNode(n) {
    const e = n.e, R = mulberry32(n.seed), w0 = Math.min(strokeHalf(e) * 0.95, P.width * F.cap * 1.3);
    spike({ x: e.x - e.nx * w0 * 0.6, y: e.y - e.ny * w0 * 0.6, th: Math.atan2(n.ty - e.y, n.tx - e.x), w0, L: n.L, k: P.curve * 0.3 * (R() < 0.5 ? -1 : 1), side: -1,
      ox: n.tw.x - (2 * F.cx - e.x), oy: n.tw.y - e.y, gen: 0, tx: n.tx, ty: n.ty, rng: R });
  }
  let dirty = true, reshape = false;
  function regrow(newSeed) {
    if (!F) return;
    if (newSeed) S.seed = (S.rand() * 2 ** 31) | 0;
    rnd = mulberry32(S.seed);
    clearAcc(); growAll(); dirty = true;
  }
  // grow to the end in one go (while dragging or holding, and under reduced motion)
  function regrowNow() {
    regrow(false);
    for (let i = 0; i < agents.length; i++) stepAgent(agents[i], 1e9);   // branches append and are stepped too
    agents = [];
  }
  function setGenre(g) { P.genre = g; Object.assign(P, GENRES[g]); regrow(true); if (reduced) regrowNow(); }

  // ---------- the headbang (easter egg): the page tears onto blood red, and back ----------
  function paint() {
    // the shell's own chrome follows the page
    if (S.blood) { const r = document.documentElement.style; r.setProperty('--bg', '#a3080c'); r.setProperty('--fg', '#000'); }
    else stage.setBackdrop(dark ? 0 : 1);
  }
  function headbang() {
    if (S.tear < 1 || stage.revealed) return;   // let the last tear finish
    S.blood = !S.blood; S.tear = reduced ? 1 : 0; S.tearSeed = S.rand() * 100; S.hitAt = 0;
    paint(); dirty = true;
  }
  const flips = [], jolts = [];
  let sx = null, sdir = 0, st = 0, lastA = null, lastJolt = 0;
  function banged(list, need) {
    const now = performance.now(); list.push(now);
    while (list.length && now - list[0] > 900) list.shift();
    if (list.length >= need) { list.length = 0; headbang(); }
  }
  // desktop: scribble fast left and right (5 flips within 0.9 s)
  function scribble(x) {
    const now = performance.now();
    if (sx != null) {
      const v = (x - sx) / Math.max(4, now - st) * 1000, d = Math.sign(x - sx);
      if (Math.abs(v) > 900 / P.shake && d && d !== sdir) { if (sdir) banged(flips, 5); sdir = d; }
    }
    sx = x; st = now;
  }
  // phones: shake (4 jolts within 0.9 s)
  const onMotion = (e) => {
    const a = e.accelerationIncludingGravity; if (!a || a.x == null) return;
    if (lastA) {
      const j = Math.hypot(a.x - lastA.x, a.y - lastA.y, a.z - lastA.z), now = performance.now();
      if (j > 22 / P.shake && now - lastJolt > 110) { lastJolt = now; banged(jolts, 4); }
    }
    lastA = { x: a.x, y: a.y, z: a.z };
  };
  window.addEventListener('devicemotion', onMotion);
  let askedMotion = false;   // iOS can only ask for motion access from inside a touch

  // ---------- gestures ----------
  const press = pressTracker();
  let ptr = null, taps = 0, pending = 0, holdNode = null;
  const AXES = {
    x: [() => P.curve, (v) => { P.curve = v; }, 0, 4],              // left / right: the hook
    y: [() => -P.gravity, (v) => { P.gravity = -v; }, -2, 1.5],     // down / up: drip or rise
  };
  function nudge(a, d) { if (d) a[1](clamp(a[0]() + d * (a[3] - a[2]) * P.sens, a[2], a[3])); }
  offs.push(stage.on('down', (q, e) => {
    if (!press.down(q, e.pointerId)) return;
    ptr = { lx: q.x, ly: q.y, drag: false };
    if (!askedMotion) {
      askedMotion = true;
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') DeviceMotionEvent.requestPermission().catch(() => { /* no shake; the scribble still works */ });
    }
  }));
  offs.push(stage.on('move', (q, e) => {
    press.move(q, e.pointerId);
    if (!press.active || !ptr) return;
    if (holdNode) { aimNode(holdNode, q.x, q.y); reshape = true; return; }
    if (!ptr.drag && press.moved >= TAP.px) ptr.drag = true;
    if (ptr.drag) {
      // each axis drives one attribute; a full screen sweeps its whole range
      nudge(AXES.x, (q.x - ptr.lx) / W); nudge(AXES.y, -(q.y - ptr.ly) / H);
      scribble(q.x);
      reshape = true;
    }
    ptr.lx = q.x; ptr.ly = q.y;
  }));
  offs.push(stage.on('up', (q, e) => {
    const r = press.up(q, e.pointerId);
    holdNode = null;
    if (!r || !ptr) return;
    ptr = null;
    if (!r.tap || e.type === 'pointercancel' || stage.revealed) return;
    // count quick taps, act once they stop: one = another style, two = take the last node back (three are the reveal)
    taps++; clearTimeout(pending);
    pending = setTimeout(() => {
      const n = taps; taps = 0;
      if (!alive || stage.revealed) return;
      if (n === 1) { const o = ORDER.filter((g) => g !== P.genre); setGenre(o[Math.floor(S.rand() * o.length)]); }
      else if (n === 2 && nodes.length) { nodes.pop(); reshape = true; }
    }, REFORM_DELAY_MS);   // a beat longer than DOUBLE_MS, so a third tap can still mean reveal
  }));
  offs.push(stage.on('reveal', () => { clearTimeout(pending); taps = 0; }));

  // ---------- reveal: the seeds, their twins across the axis, and the axis ----------
  const rv = createReveal(stage, (c, W_, H_, k) => {
    const colr = (a) => rvInk(stage, a);
    rvGrid(c, W_, H_, 24, colr, k); corners(c, W_, H_, 16, colr, k);
    if (!F) return;
    c.strokeStyle = colr(0.6 * k); c.lineWidth = 1; c.setLineDash([6, 5]);
    c.beginPath(); c.moveTo(F.cx, 0); c.lineTo(F.cx, H_); c.stroke(); c.setLineDash([]);
    c.strokeStyle = colr(0.18 * k); c.beginPath();
    for (const [x0, y0, x1, y1] of seeds) { c.moveTo(x0, y0); c.lineTo(x1, y1); }
    c.stroke();
    c.fillStyle = colr(0.85 * k);
    for (const [x0, y0, x1, y1] of seeds) { c.fillRect(x0 - 1.5, y0 - 1.5, 3, 3); c.fillRect(x1 - 1.5, y1 - 1.5, 3, 3); }
    titleBlock(c, W_, H_, [`HEADBANG · ${P.genre.toUpperCase()}`, `· ${seeds.length} seeds on the letter edges, grown on the left`, '— each joined to its twin across the mirror', '| the axis: everything right of it is a reflection'], colr, k);
  }, { dim: 0.5 });

  // ---------- the frame: draws only while something grows, tears or shakes ----------
  function frame(dt) {
    if (!F) return;
    dt = Math.min(dt, 1 / 30);
    if (press.active && ptr && !ptr.drag && press.holding && !holdNode) {
      // a hold: finish any growth first, so the new node is not drawn twice, then grow one toward the finger
      if (agents.length) regrowNow();
      holdNode = addNode(ptr.lx, ptr.ly); reshape = true;
    }
    if (holdNode) { holdNode.L += dt * F.cap * P.reach; reshape = true; }
    if (reshape) { reshape = false; regrowNow(); }
    if (S.tear < 1) { S.tear = Math.min(1, S.tear + dt / P.tearS); dirty = true; if (S.tear >= 0.18 && !S.hitAt) S.hitAt = performance.now(); }
    if (S.hitAt && performance.now() - S.hitAt < 600) dirty = true;   // the shake settles
    if (agents.length) {
      const live = [];   // branches spawned this frame are appended to agents, so the loop steps them too
      for (let i = 0; i < agents.length; i++) if (stepAgent(agents[i], dt)) live.push(agents[i]);
      agents = live; dirty = true;
    }
    if (dirty || stage.revealed) { drawStamps(); present(); dirty = false; }
    rv.draw(performance.now());
  }

  function build() {
    W = stage.W; H = stage.H;
    F = field(text, W, H, stage.pw, stage.ph, P.size);
    nodes.length = 0;
    makeTargets(); regrow(false);
    if (reduced) regrowNow();   // grown at once: the picture stands still
  }
  build();
  offs.push(stage.frame((dt) => { if (alive) frame(dt); }));
  let rt = 0;
  offs.push(stage.on('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (alive) build(); }, 200); }));

  const Ctl = (key, lbl, min, max, step) => ({ key, label: lbl, min, max, step });
  const REGROW = new Set(['pairs', 'thorns', 'len', 'lenVar', 'width', 'taper', 'wing', 'up', 'down', 'side', 'curve', 'outward', 'wiggle', 'vert', 'gravity', 'fan', 'branch', 'bAngle', 'bScale', 'tines', 'blunt', 'gnarl', 'knuckle']);
  let bt = 0;
  const tune = {
    title: 'Headbang', values: P, defaults: { ...DEF, genre: 'antler' },
    groups: [
      { name: 'Spikes', items: [Ctl('pairs', 'Spike pairs', 0, 200, 1), Ctl('thorns', 'Small thorn pairs', 0, 200, 1), Ctl('len', 'Length', 0.05, 2.6, 0.01), Ctl('lenVar', 'Length variety', 0, 0.95, 0.01), Ctl('width', 'Base width', 0.01, 0.25, 0.005), Ctl('taper', 'Taper', 0.3, 3, 0.05), Ctl('wing', 'Outer letters longer', 0, 8, 0.1)] },
      { name: 'Where they grow', items: [Ctl('up', 'From tops', 0, 3, 0.05), Ctl('down', 'From bottoms', 0, 3, 0.05), Ctl('side', 'From outer sides', 0, 3, 0.05)] },
      { name: 'Curve', items: [Ctl('curve', 'Hook', 0, 4, 0.05), Ctl('outward', 'Hooks bend outward', 0, 1, 0.01), Ctl('wiggle', 'Wiggle', 0, 6, 0.05), Ctl('vert', 'Pull to vertical', 0, 3, 0.05), Ctl('gravity', 'Drip (below 0: rise)', -2, 2, 0.01), Ctl('fan', 'Fan out', 0, 3, 0.05)] },
      { name: 'Antler', items: [Ctl('tines', 'Tines per beam', 0, 7, 1), Ctl('bAngle', 'Tine angle', 5, 90, 1), Ctl('bScale', 'Tine width', 0.2, 1, 0.01), Ctl('blunt', 'Blunt tips', 0, 0.8, 0.01), Ctl('gnarl', 'Bony bumps', 0, 0.5, 0.01), Ctl('knuckle', 'Knuckles', 1, 2, 0.01)] },
      { name: 'Finish', items: [Ctl('melt', 'Melt', 0, 4, 0.05), Ctl('soft', 'Edge softness', 0.005, 0.2, 0.005), Ctl('grow', 'Grow time (s)', 0.2, 5, 0.05), Ctl('hold', 'Name alone first (s)', 0, 2, 0.05), Ctl('stagger', 'Middle → outside (s)', 0, 3, 0.05), Ctl('sens', 'Drag sensitivity', 0.2, 3, 0.05), Ctl('reach', 'Hold: node growth speed', 0.3, 4, 0.05)] },
      { name: 'Headbang', items: [Ctl('shake', 'Shake sensitivity', 0.4, 3, 0.05), Ctl('tearS', 'Tear time (s)', 0.15, 3, 0.05), Ctl('jag', 'Serrated edge', 0, 2, 0.05), Ctl('jolt', 'Screen shake', 0, 3, 0.05), Ctl('punch', 'Logo punch', 0, 3, 0.05), Ctl('flash', 'Flash', 0, 1, 0.05)] },
    ],
    set(key, v) { P[key] = v; if (REGROW.has(key)) { clearTimeout(bt); bt = setTimeout(() => { if (alive) regrowNow(); }, 120); } else dirty = true; },
    reset() { Object.assign(P, DEF, { genre: 'antler' }); build(); },
  };

  return {
    tune,
    debug: { P, S, nodes, headbang, setGenre, regrowNow, addNode, get F() { return F; }, stats() { return { agents: agents.length, seeds: seeds.length, nodes: nodes.length, blood: S.blood }; } },
    destroy() {
      alive = false; clearTimeout(rt); clearTimeout(bt); clearTimeout(pending);
      window.removeEventListener('devicemotion', onMotion);
      rv.destroy(); offs.forEach((f) => f());
      for (const [t, f] of targets) { gl.deleteTexture(t); gl.deleteFramebuffer(f); }
      if (maskTex) gl.deleteTexture(maskTex);
      gl.deleteBuffer(vbo); gl.deleteVertexArray(vao); gl.deleteVertexArray(emptyVao);
      for (const s of shaders) gl.deleteShader(s);
      for (const p of [pMask, pDot, pBlur, pShow]) gl.deleteProgram(p);
      link.remove(); stage.setBackdrop(null);
    },
  };
}
