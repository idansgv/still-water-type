// Rain, colour test (draft). Same poster as rain.js (the published one is untouched); the ink is a gradient from src/posters/palette.js
// instead of black or white, with the palette, mapping and light/dark background in the settings panel. Colour is outside the house
// black-and-white rule, so this stays a draft. "Block" = the whole word (top of the first line to the bottom of the last); "line" = one row
// of type (found from the rows of the mask that carry ink); depth fade uses how far behind the front face a mark sits (0 front, 1 back).
//
// Rain. Heavy 3D type in exactly the colour of the page, so at first there is nothing to see. Rain follows the cursor and
// every drop that lands leaves a mark on the letters; the marks pile up (they never fade) until the name stands there in ink.
// A press makes it pour.
//
// Under the graphic: the word is an extruded mask (two lines of type, a slab of depth D), ray-marched in the fragment shader with
// an orthographic camera that tilts a little with the cursor. Drops are simulated on the CPU as straight falls with a slant;
// each is tested against the same mask, and where it lands it is stamped into the paint: a 2D picture for the front faces and a
// small 3D volume for tops and sides. The shader reads the paint through a noisy threshold, which gives splatter-shaped edges.
// The body of the type is the page colour on its front face; only its tops and sides are tinted a few per cent so the form is
// there if you look for it.

import { getGL, compile, texture, uploadCanvas, VS_TRI, typeMask, clamp } from '../engine.js';
import { pressTracker, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';
import { createReveal, ink } from './reveal.js';
import { COLOUR_DEF, colourGroups, gradientUniforms, GLSL_GRADIENT, paperGrey } from './palette.js';

const MAXD = 4000;              // most drops in the air
const TOP = 0.8;                // drops enter from here (above the frame)
const FW = 1024;                // front paint width, px
const VXN = 300, VZN = 22;      // paint volume: width and depth in voxels

// Defaults saved from the settings panel (Save as defaults, local dev server): src/posters/params/rain.json, over the built-in ones below.
const SAVED = await fetch(new URL('./params/rain-color.json', import.meta.url)).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
const DEFAULTS = {
  font: 'Leida', weight: 700, words: 'Idan\nSegev', pad: 0.07, gap: 0.12, center: 0,
  depth: 0.12,
  yaw: 14, pitch: 17, zoom: 1, panX: 0, panY: 0, followX: 6, followY: 3.5,
  body: 0, sides: 0.1, lightTurn: -35, lightHeight: 53, ink: 1, gloss: 0, streakOpacity: 0.35,
  rate: 40, pour: 1100, spread: 0.028, pourSpread: 0.17, linger: 1.3, fall: 1.9, slant: 0.4, slantVar: 0.6, wind: 0.3,
  dropSize: 0.0058, sizeVar: 0.005, splash: 2, reach: 1.8, streakLen: 0.026,
  ragged: 0.24, grain: 45, edge: 0.04, demo: 1,
};

// The face: Leida (a trial licence, local files only) when present, else Bitter, the same pair Still Water uses. Any Google font can be typed into the panel.
const loaded = new Set(['Leida', 'Archivo']);
async function ensureFont(name, weight) {
  name = (name || '').trim(); if (!name) return;
  if (!loaded.has(name)) {
    loaded.add(name);
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@200..900&display=swap`;
    await new Promise((r) => { l.onload = r; l.onerror = r; setTimeout(r, 2500); document.head.appendChild(l); });
  }
  try { await Promise.race([document.fonts.load(`${weight} 100px "${name}"`), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* use the fallback */ }
}

export async function mount(ctx) {
  const { canvas } = ctx;
  const gl = getGL(canvas);
  if (!gl) throw new Error('webgl2 unavailable');
  const offs = [];
  const rand = ctx.rand;
  const P = { ...DEFAULTS, ...COLOUR_DEF, dark: ctx.theme.name === 'dark' ? 1 : 0, ...SAVED };
  const applyBg = () => ctx.setBackdrop(paperGrey(P));
  applyBg();
  const askedFont = new URLSearchParams(location.search).get('font'); if (askedFont) P.font = askedFont;
  let D = P.depth;
  await ensureFont('Bitter', 400); await ensureFont(P.font, P.weight);
  const fg = ctx.colors.fg;

  // ---------- shaders ----------
  const FS = `#version 300 es
  precision highp float;
  precision highp sampler3D;
  in vec2 uv;
  uniform sampler2D uMask, uPaintF;
  uniform sampler3D uPaintV;
  uniform float uA, uD, uAmb, uZoom, uInk, uGloss, uRag, uGrain, uEdge, uBody;
  uniform vec2 uPan;
  uniform vec3 uX, uU, uF, uBg, uFg, uL;
  uniform vec2 uBlock; uniform vec2 uLn[4]; uniform int uNLn;
  ${GLSL_GRADIENT}
  out vec4 o;

  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  vec2 toUV(vec2 p) { return vec2(p.x / uA + 0.5, p.y + 0.5); }
  bool inside(vec2 p) { vec2 q = toUV(p); if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) return false; return textureLod(uMask, q, 0.0).r > 0.5; }
  float lod(vec2 q) { return textureLod(uMask, q, 2.5).r; }

  void main() {
    vec2 s = (uv - 0.5) * vec2(uA, 1.0) / uZoom + uPan;
    vec3 O = uX * s.x + uU * s.y - uF * 4.0;
    float t0 = (0.0 - O.z) / uF.z, t1 = (-uD - O.z) / uF.z;
    bool hit = false, front = false;
    float th = t0;
    vec3 P0 = O + uF * t0;
    if (inside(P0.xy)) { hit = true; front = true; }
    else {
      float prev = t0;
      for (int i = 1; i <= 110; i++) {
        float t = mix(t0, t1, float(i) / 110.0);
        if (inside((O + uF * t).xy)) {
          float lo = prev, hi = t;
          for (int k = 0; k < 7; k++) { float m = 0.5 * (lo + hi); if (inside((O + uF * m).xy)) hi = m; else lo = m; }
          th = hi; hit = true; break;
        }
        prev = t;
      }
    }
    vec3 col = uBg;
    if (hit) {
      vec3 p = O + uF * th;
      vec3 n = vec3(0.0, 0.0, 1.0);
      if (!front) {
        vec2 q = toUV(p.xy); float e = 4.0 / 1024.0;
        vec2 g = vec2(lod(q + vec2(e, 0.0)) - lod(q - vec2(e, 0.0)), (lod(q + vec2(0.0, e)) - lod(q - vec2(0.0, e))));
        n = length(g) < 1e-4 ? vec3(0.0, 1.0, 0.0) : vec3(-normalize(g), 0.0);
      }
      vec3 L = uL;
      float lum = max(dot(n, L), 0.0), lumF = max(L.z, 0.0);
      vec3 body = mix(uBg, uFg, clamp(uBody + uAmb * abs(lum - lumF), 0.0, 1.0));
      float v;
      if (front) v = texture(uPaintF, toUV(p.xy)).r;
      else v = texture(uPaintV, vec3(toUV(p.xy), clamp(-p.z / uD, 0.0, 1.0))).r;
      float nz = vnoise(p * uGrain) * 0.65 + vnoise(p * uGrain * 2.9) * 0.35;
      float vv = v + (nz - 0.5) * uRag * smoothstep(0.0, 0.5, v);
      float k = smoothstep(0.51 - uEdge, 0.51 + uEdge, vv);
      vec3 N = normalize(n - (dFdx(vv) * uX + dFdy(vv) * uU) * 6.0);
      float spec = pow(max(dot(N, normalize(uL - uF)), 0.0), 50.0) * k;
      float vq = p.y + 0.5, bestD = 1e9; int li = 0;
      for (int i = 0; i < 4; i++) {
        if (i >= uNLn) break;
        float d = vq < uLn[i].x ? uLn[i].x - vq : (vq > uLn[i].y ? vq - uLn[i].y : 0.0);
        if (d < bestD) { bestD = d; li = i; }
      }
      vec2 LN = uLn[li];
      float tB = clamp((uBlock.y - vq) / max(uBlock.y - uBlock.x, 1e-4), 0.0, 1.0), tL = clamp((LN.y - vq) / max(LN.y - LN.x, 1e-4), 0.0, 1.0);
      vec3 inkC = gradientColour(vec3(tB, tL, float(li)), front ? 0.0 : clamp(-p.z / uD, 0.0, 1.0), uBg);
      col = mix(body, mix(inkC, uBg, spec * uGloss), k * uInk);
    }
    o = vec4(col, 1.0);
  }`;

  const SVS = `#version 300 es
  in vec4 aP;
  uniform vec3 uX, uU; uniform float uA, uZoom; uniform vec2 uPan;
  out float vA;
  void main() { vA = aP.w; gl_Position = vec4((dot(aP.xyz, uX) - uPan.x) * uZoom / (uA * 0.5), (dot(aP.xyz, uU) - uPan.y) * uZoom / 0.5, 0.0, 1.0); }`;
  const SFS = `#version 300 es
  precision highp float;
  in float vA; uniform vec3 uCol; uniform float uAlpha; out vec4 o;
  void main() { o = vec4(uCol, vA * uAlpha); }`;

  const prog = compile(gl, VS_TRI, FS);
  const sprog = compile(gl, SVS, SFS);
  const maskTex = texture(gl, { w: 1, h: 1 });
  const pF = texture(gl, { w: 1, h: 1 });
  const pV = gl.createTexture();
  const sbuf = gl.createBuffer(), svao = gl.createVertexArray();
  const sdata = new Float32Array(MAXD * 8);
  gl.bindVertexArray(svao); gl.bindBuffer(gl.ARRAY_BUFFER, sbuf);
  gl.bufferData(gl.ARRAY_BUFFER, sdata.byteLength, gl.DYNAMIC_DRAW);
  const aP = gl.getAttribLocation(sprog.p, 'aP');
  gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 4, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // ---------- world ----------
  let A = 1.6, MW = 1024, MH = 640, Mc = null, mask = null;
  let paintC = null, pg = null, VX = VXN, VY = 200, vol = null, volDirty = false, fDirty = false, lastUp = 0;
  let tint = null, bands = [], lnArr = new Float32Array(8), nLn = 1, blockV = [0, 1];

  function build() {
    A = ctx.W / ctx.H;
    MW = 1024; MH = Math.max(256, Math.round(MW / A));
    const lines = String(P.words).split('\n').map((l) => l.trim()).filter(Boolean);
    const fam = P.font === 'Bitter' ? 'Bitter' : `${P.font}", "Bitter`;
    mask = typeMask(MW, MH, { lines: lines.length ? lines : ['Idan'], mode: 'fit', weight: P.weight, family: fam, pad: P.pad, valign: 'middle', align: P.center ? 'center' : 'left', gap: P.gap });
    D = P.depth;
    const id = mask.getContext('2d').getImageData(0, 0, MW, MH).data;
    Mc = new Uint8Array(MW * MH);
    for (let i = 0; i < Mc.length; i++) Mc[i] = id[i * 4];
    uploadCanvas(gl, maskTex, mask, { mipmap: true });
    // line bands (rows with ink), for the self-demo and the reveal
    bands = []; let inBand = false, y0 = 0;
    for (let y = 0; y < MH; y++) {
      let s = 0; for (let x = 0; x < MW; x += 4) s += Mc[y * MW + x];
      if (s > 0 && !inBand) { inBand = true; y0 = y; } else if (s === 0 && inBand) { inBand = false; bands.push([y0, y]); }
    }
    if (inBand) bands.push([y0, MH]);
    lnArr = new Float32Array(8);
    const bs = bands.length ? bands.slice(0, 4) : [[0, MH]];
    if (bands.length > 4) bs[3] = [bs[3][0], bands[bands.length - 1][1]];
    bs.forEach(([a, c], i) => { lnArr[i * 2] = 1 - c / MH; lnArr[i * 2 + 1] = 1 - a / MH; });
    nLn = bs.length; blockV = [1 - bs[bs.length - 1][1] / MH, 1 - bs[0][0] / MH];
    // reveal tint: the letters in the foreground colour, as alpha
    tint = document.createElement('canvas'); tint.width = MW; tint.height = MH;
    const tc = tint.getContext('2d'), td = tc.createImageData(MW, MH);
    for (let i = 0; i < Mc.length; i++) { td.data[i * 4] = fg[0] * 255; td.data[i * 4 + 1] = fg[1] * 255; td.data[i * 4 + 2] = fg[2] * 255; td.data[i * 4 + 3] = Mc[i]; }
    tc.putImageData(td, 0, 0);

    const FH = Math.max(256, Math.round(FW / A));
    paintC = document.createElement('canvas'); paintC.width = FW; paintC.height = FH;
    pg = paintC.getContext('2d'); pg.fillStyle = '#000'; pg.fillRect(0, 0, FW, FH);
    VX = VXN; VY = Math.max(64, Math.round(VX / A));
    vol = new Uint8Array(VX * VY * VZN);
    gl.bindTexture(gl.TEXTURE_3D, pV);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, VX, VY, VZN, 0, gl.RED, gl.UNSIGNED_BYTE, vol);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_3D, k, v);
    uploadCanvas(gl, pF, paintC);
    gl.bindTexture(gl.TEXTURE_2D, pF); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    n = 0; nd = 0;
  }

  function solid(x, y, z) {
    if (z > 0 || z < -D) return false;
    const u = x / A + 0.5, v = y + 0.5;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
    return Mc[(((1 - v) * MH) | 0) * MW + ((u * MW) | 0)] > 127;
  }

  // ---------- camera ----------
  const cam = { X: [1, 0, 0], U: [0, 1, 0], F: [0, 0, -1] };
  function setCam() {
    const R = Math.PI / 180, yaw = (P.yaw + ctx.look.x * P.followX) * R, pitch = (P.pitch - ctx.look.y * P.followY) * R;
    const cp = Math.cos(pitch), f = [-Math.sin(yaw) * cp, -Math.sin(pitch), -Math.cos(yaw) * cp];
    const X = [f[1] * 0 - f[2] * 1, 0, f[0] * 1 - 0]; // cross(f, up(0,1,0)) = (fy*0 - fz*1, fz*0 - fx*0, fx*1 - fy*0)
    const xl = Math.hypot(X[0], X[2]); X[0] /= xl; X[2] /= xl;
    const U = [X[1] * f[2] - X[2] * f[1], X[2] * f[0] - X[0] * f[2], X[0] * f[1] - X[1] * f[0]];
    cam.X = X; cam.U = U; cam.F = f;
  }

  /** where the cursor's ray first meets the type (or the front plane if it misses) */
  function pick(u, v) {
    const sx = (u - 0.5) * A / P.zoom + P.panX, sy = (v - 0.5) / P.zoom + P.panY, { X, U, F } = cam;
    const O = [X[0] * sx + U[0] * sy - F[0] * 4, X[1] * sx + U[1] * sy - F[1] * 4, X[2] * sx + U[2] * sy - F[2] * 4];
    const t0 = -O[2] / F[2], t1 = (-D - O[2]) / F[2];
    for (let i = 0; i <= 90; i++) {
      const t = t0 + (t1 - t0) * i / 90, x = O[0] + F[0] * t, y = O[1] + F[1] * t, z = O[2] + F[2] * t;
      if (solid(x, y, Math.min(z, -0.0005))) return { x, y, z: Math.min(z, 0), hit: true };
    }
    return { x: O[0] + F[0] * t0, y: O[1] + F[1] * t0, z: 0, hit: false };
  }

  // ---------- paint ----------
  function stampFront(x, y, r, a = 1) {
    const FH = paintC.height, cx = (x / A + 0.5) * FW, cy = (0.5 - y) * FH, R = r * FH;
    if (R < 0.4 || cx < -R || cx > FW + R || cy < -R || cy > FH + R) return;
    const g = pg.createRadialGradient(cx, cy, 0, cx, cy, R), L = (d) => { const c = Math.round(255 * a * Math.max(0, 1 - d * d * d * d)); return `rgb(${c},${c},${c})`; };
    for (const d of [0, 0.3, 0.5, 0.7, 0.85, 1]) g.addColorStop(d, L(d));
    pg.fillStyle = g; pg.globalCompositeOperation = 'lighten';
    pg.beginPath(); pg.arc(cx, cy, R, 0, 6.2832); pg.fill();
    fDirty = true;
  }
  function stampVol(x, y, z, r) {
    const vx = (x / A + 0.5) * VX, vy = (y + 0.5) * VY, vz = (-z / D) * (VZN - 1);
    const rx = r / A * VX, ry = r * VY, rz = r / D * (VZN - 1) * 0.9 + 0.8;
    const x0 = Math.max(0, Math.floor(vx - rx)), x1 = Math.min(VX - 1, Math.ceil(vx + rx));
    const y0 = Math.max(0, Math.floor(vy - ry)), y1 = Math.min(VY - 1, Math.ceil(vy + ry));
    const z0 = Math.max(0, Math.floor(vz - rz)), z1 = Math.min(VZN - 1, Math.ceil(vz + rz));
    for (let k = z0; k <= z1; k++) for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
      const d2 = ((i - vx) / rx) ** 2 + ((j - vy) / ry) ** 2 + ((k - vz) / rz) ** 2;
      if (d2 >= 1) continue;
      const val = (1 - d2 * d2) * 255 | 0, idx = (k * VY + j) * VX + i;
      if (val > vol[idx]) vol[idx] = val;
    }
    volDirty = true;
  }
  let n = 0;
  function splat(x, y, z, front, r) {
    const put = (px, py, pz, pr) => { if (front) stampFront(px, py, pr); else stampVol(px, py, pz, pr); };
    put(x, y, z, r);
    const k = Math.round(P.splash * (0.35 + rand() * 0.9));
    for (let i = 0; i < k; i++) {
      const a = rand() * 6.2832, d = r * (0.8 + rand() * 1.4) * P.reach, rr = r * (0.12 + rand() * 0.26);
      put(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.9, z + (front ? 0 : (rand() - 0.5) * d), rr);
    }
    n++;
  }

  // ---------- rain ----------
  const dx = new Float32Array(MAXD), dy = new Float32Array(MAXD), dz = new Float32Array(MAXD),
    dvx = new Float32Array(MAXD), dvz = new Float32Array(MAXD), dr = new Float32Array(MAXD);
  let nd = 0, acc = 0;
  function spawn(T, jit) {
    if (nd >= MAXD) return;
    const sp = P.fall * (0.85 + rand() * 0.3), slope = P.slant + rand() * P.slantVar, wx = (rand() - 0.5) * P.wind * sp;
    const a = rand() * 6.2832, rr = Math.sqrt(rand()) * jit;
    const ax = T.x + Math.cos(a) * rr, ay = T.y + Math.sin(a) * rr, az = T.z - 0.012;      // aim a hair into the surface
    const tau = (TOP - ay) / sp;
    const i = nd++;
    dvx[i] = wx; dvz[i] = -slope * sp;
    dx[i] = ax - wx * tau; dy[i] = TOP; dz[i] = az + slope * sp * tau;
    dr[i] = P.dropSize + rand() * P.sizeVar;
    dvy[i] = -sp;
  }
  const dvy = new Float32Array(MAXD);

  function stepRain(dt) {
    for (let i = nd - 1; i >= 0; i--) {
      const x0 = dx[i], y0 = dy[i], z0 = dz[i];
      const x1 = x0 + dvx[i] * dt, y1 = y0 + dvy[i] * dt, z1 = z0 + dvz[i] * dt;
      let hitF = -1;
      for (let s = 1; s <= 4; s++) { const f = s / 4; if (solid(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, z0 + (z1 - z0) * f)) { hitF = f; break; } }
      if (hitF >= 0) {
        let lo = hitF - 0.25, hi = hitF;
        for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (solid(x0 + (x1 - x0) * m, y0 + (y1 - y0) * m, z0 + (z1 - z0) * m)) hi = m; else lo = m; }
        const hx = x0 + (x1 - x0) * hi, hy = y0 + (y1 - y0) * hi, hz = z0 + (z1 - z0) * hi;
        const front = hz > -0.006 || !solid(hx, hy, -0.5 * D) && hz > -0.012;
        splat(hx, hy, front ? 0 : hz, front, dr[i]);
        dx[i] = dx[nd - 1]; dy[i] = dy[nd - 1]; dz[i] = dz[nd - 1]; dvx[i] = dvx[nd - 1]; dvy[i] = dvy[nd - 1]; dvz[i] = dvz[nd - 1]; dr[i] = dr[nd - 1]; nd--;
        continue;
      }
      dx[i] = x1; dy[i] = y1; dz[i] = z1;
      if (y1 < -0.75) { dx[i] = dx[nd - 1]; dy[i] = dy[nd - 1]; dz[i] = dz[nd - 1]; dvx[i] = dvx[nd - 1]; dvy[i] = dvy[nd - 1]; dvz[i] = dvz[nd - 1]; dr[i] = dr[nd - 1]; nd--; }
    }
  }

  // ---------- input ----------
  const press = pressTracker();
  let pid = null, pouring = false, linger = 0, pourK = 0, touched = false, taps = [], resetTimer = 0;
  const target = { u: 0.5, v: 0.5 };
  function dry() {
    pg.globalCompositeOperation = 'source-over'; pg.fillStyle = '#000'; pg.fillRect(0, 0, paintC.width, paintC.height);
    vol.fill(0); volDirty = true; fDirty = true; nd = 0; n = 0;
  }
  offs.push(ctx.on('down', (q, e) => {
    if (pid !== null) return;
    pid = e.pointerId; touched = true; pouring = true; press.down(q, e.pointerId);
    target.u = q.u; target.v = q.v;
  }));
  offs.push(ctx.on('move', (q, e) => {
    if (pid !== null && e.pointerId !== pid) return;
    press.move(q, e.pointerId);
    target.u = q.u; target.v = q.v;
    if (q.type === 'mouse') touched = true;
  }));
  offs.push(ctx.on('up', (q, e) => {
    if (e.pointerId !== pid) return;
    const r = press.up(q, e.pointerId); pid = null; pouring = false; linger = P.linger;
    if (r && r.tap) {
      const now = performance.now();
      taps = taps.filter((t) => now - t < DOUBLE_MS); taps.push(now);
      clearTimeout(resetTimer);
      if (taps.length === 2) resetTimer = setTimeout(() => { taps = []; dry(); }, REFORM_DELAY_MS);
      else if (taps.length >= 3) taps = [];
    }
  }));

  // ---------- frame ----------
  let demoT = 0;
  const DEMO_LEN = 9.5;
  function demoTarget(t) {
    const b = bands.length ? bands : [[MH * 0.25, MH * 0.5], [MH * 0.55, MH * 0.8]];
    const half = DEMO_LEN / 2, line = t < half ? 0 : 1, f = (t < half ? t : t - half) / half;
    const [a, c] = b[Math.min(line, b.length - 1)];
    target.u = 0.08 + f * 0.62; target.v = 1 - ((a + c) / 2 + Math.sin(f * 9) * (c - a) * 0.14) / MH;
  }
  function advance(dt, demo) {
    setCam();
    if (demo && P.demo) { demoT += dt; if (demoT < DEMO_LEN) demoTarget(demoT); }
    const wantPour = pouring || linger > 0;
    if (linger > 0) linger -= dt;
    pourK += ((wantPour ? 1 : 0) - pourK) * Math.min(1, dt * (wantPour ? 14 : 2.4));
    const hover = touched && (ctx.ptr.type === 'mouse' || wantPour);
    const demoOn = demo && P.demo && demoT < DEMO_LEN && !touched;
    const rate = (hover || demoOn ? P.rate : 0) + P.pour * pourK * pourK;
    if (rate > 0) {
      const T = pick(target.u, target.v), jit = P.spread + (P.pourSpread - P.spread) * pourK;
      acc += rate * dt;
      while (acc >= 1) { acc -= 1; spawn(T, jit); }
    }
    stepRain(dt);
  }

  function upload(now, force) {
    if (force) lastUp = -1e9;
    if (fDirty && now - lastUp > 40) {
      uploadCanvas(gl, pF, paintC); fDirty = false;
      gl.bindTexture(gl.TEXTURE_2D, pF); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    if (volDirty && now - lastUp > 40) {
      gl.bindTexture(gl.TEXTURE_3D, pV);
      gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, VX, VY, VZN, gl.RED, gl.UNSIGNED_BYTE, vol); volDirty = false;
    }
    if (!fDirty && !volDirty) lastUp = now; else if (now - lastUp > 40) lastUp = now;
  }

  const reveal = createReveal(ctx, (c, W, H, k) => {
    const z = P.zoom * H, w = A * z;
    const x0 = W / 2 - (A / 2 + P.panX) * z, y0 = H / 2 - (0.5 - P.panY) * z;
    const bx = -D * cam.X[2] * z, by = D * cam.U[2] * z;                     // where the back face lands relative to the front
    c.save();
    c.globalAlpha = 0.28 * k; c.drawImage(tint, x0 + bx, y0 + by, w, z);
    c.globalAlpha = 0.5 * k; c.drawImage(tint, x0, y0, w, z);
    c.restore();
    c.strokeStyle = ink(ctx, 0.45 * k); c.lineWidth = 1;
    for (let i = 1; i <= 7; i++) {
      const x = W * (0.12 + i * 0.11), y = H * 0.08;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + cam.F[0] / cam.F[1] * -H * 0.14, y + H * 0.14); c.stroke();
    }
  }, { dim: 0.55 });

  const sc = [0, 0, 0];
  function render() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, ctx.pw, ctx.ph);
    gl.disable(gl.BLEND);
    prog.use(); const u = prog.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, maskTex); gl.uniform1i(u.uMask, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, pF); gl.uniform1i(u.uPaintF, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_3D, pV); gl.uniform1i(u.uPaintV, 2);
    const R = Math.PI / 180, lt = P.lightTurn * R, lh = P.lightHeight * R;
    gl.uniform1f(u.uA, A); gl.uniform1f(u.uD, D); gl.uniform1f(u.uAmb, P.sides); gl.uniform1f(u.uBody, P.body);
    gl.uniform1f(u.uZoom, P.zoom); gl.uniform2f(u.uPan, P.panX, P.panY);
    gl.uniform1f(u.uInk, P.ink); gl.uniform1f(u.uGloss, P.gloss); gl.uniform1f(u.uRag, P.ragged); gl.uniform1f(u.uGrain, P.grain); gl.uniform1f(u.uEdge, P.edge);
    gl.uniform3f(u.uL, Math.cos(lh) * Math.sin(lt), Math.sin(lh), Math.cos(lh) * Math.cos(lt));
    gl.uniform3fv(u.uX, cam.X); gl.uniform3fv(u.uU, cam.U); gl.uniform3fv(u.uF, cam.F);
    const bgG = paperGrey(P), fgG = P.dark ? 1 : 0;
    gl.uniform3f(u.uBg, bgG, bgG, bgG); gl.uniform3f(u.uFg, fgG, fgG, fgG);
    gradientUniforms(gl, u, P);
    gl.uniform2f(u.uBlock, blockV[0], blockV[1]); gl.uniform2fv(u['uLn[0]'], lnArr); gl.uniform1i(u.uNLn, nLn);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (nd > 0) {
      for (let i = 0; i < nd; i++) {
        const o = i * 8, ex = dvx[i] / P.fall * P.streakLen, ey = dvy[i] / P.fall * P.streakLen, ez = dvz[i] / P.fall * P.streakLen;
        sdata[o] = dx[i]; sdata[o + 1] = dy[i]; sdata[o + 2] = dz[i]; sdata[o + 3] = 0.9;
        sdata[o + 4] = dx[i] - ex; sdata[o + 5] = dy[i] - ey; sdata[o + 6] = dz[i] - ez; sdata[o + 7] = 0;
      }
      sprog.use(); const su = sprog.u;
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform3fv(su.uX, cam.X); gl.uniform3fv(su.uU, cam.U); gl.uniform1f(su.uA, A); gl.uniform1f(su.uZoom, P.zoom); gl.uniform2f(su.uPan, P.panX, P.panY);
      sc[0] = sc[1] = sc[2] = P.dark ? 1 : 0; gl.uniform3fv(su.uCol, sc); gl.uniform1f(su.uAlpha, P.streakOpacity);
      gl.bindVertexArray(svao); gl.bindBuffer(gl.ARRAY_BUFFER, sbuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, sdata.subarray(0, nd * 8));
      gl.drawArrays(gl.LINES, 0, nd * 2);
      gl.bindVertexArray(null); gl.disable(gl.BLEND);
    }
  }

  build();
  setCam();
  if (ctx.reduced) { const was = touched; for (let i = 0; i < 480; i++) advance(1 / 60, true); touched = was; demoT = DEMO_LEN; nd = 0; }
  offs.push(ctx.on('resize', () => { build(); }));
  offs.push(ctx.frame((dt) => {
    advance(ctx.reduced ? 0 : dt, !ctx.reduced && !touched);
    if (ctx.reduced && pouring) advance(dt, false);
    upload(performance.now());
    render();
    reveal.draw();
  }));

  // ---------- settings panel (?p=rain&tune, or T) ----------
  const REBUILD = new Set(['font', 'weight', 'words', 'pad', 'gap', 'center', 'depth']);
  let rb = 0;
  const C = (key, label, min, max, step) => ({ key, label, min, max, step });
  const setView = (o) => Object.assign(P, o);
  return {
    tune: {
      title: 'Rain', persist: true, values: P, defaults: { ...DEFAULTS, ...COLOUR_DEF },
      groups: [
        { name: 'Type (rebuilds, dries the word)', items: [{ key: 'words', label: 'Words (one line per row)', type: 'text', rows: 2 }, { key: 'font', label: 'Font family (Leida, Bitter, Archivo, or any Google font)', type: 'text', rows: 1 }, C('weight', 'Weight', 200, 900, 50), C('pad', 'Margin', 0.02, 0.22, 0.005), C('gap', 'Line gap', 0, 0.5, 0.01), { key: 'center', label: 'Centre the lines', type: 'toggle' }] },
        { name: '3D', items: [C('depth', 'Depth of the letters', 0.01, 0.5, 0.005)] },
        { name: 'Camera', items: [C('yaw', 'Turn (deg)', -80, 80, 1), C('pitch', 'Tilt down (deg)', -20, 80, 1), C('zoom', 'Zoom', 0.3, 3, 0.01), C('panX', 'Shift left / right', -0.8, 0.8, 0.005), C('panY', 'Shift up / down', -0.8, 0.8, 0.005), C('followX', 'Follows cursor, turn (deg)', 0, 40, 0.5), C('followY', 'Follows cursor, tilt (deg)', 0, 30, 0.5)] },
        { name: 'Tone (black and white only)', items: [C('body', 'Body shade (0 = the page colour)', 0, 0.5, 0.005), C('sides', 'Tint on tops and sides', 0, 0.6, 0.005), C('lightTurn', 'Light turn (deg)', -180, 180, 1), C('lightHeight', 'Light height (deg)', 5, 89, 1), C('ink', 'Ink strength', 0.1, 1, 0.01), C('gloss', 'Wet gloss on the ink', 0, 1, 0.01), C('streakOpacity', 'Rain streaks, strength', 0, 1, 0.01)] },
        { name: 'Rain', items: [C('rate', 'Light rain at the cursor (drops/s)', 0, 400, 1), C('pour', 'Pour (drops/s)', 0, 4000, 10), C('spread', 'Light rain spread', 0.005, 0.25, 0.001), C('pourSpread', 'Pour spread', 0.02, 0.6, 0.005), C('linger', 'Pour lingers after release (s)', 0, 5, 0.1), C('fall', 'Fall speed', 0.5, 5, 0.05), C('slant', 'Slant toward the type (min)', 0, 1.6, 0.01), C('slantVar', 'Slant variation', 0, 1.5, 0.01), C('wind', 'Sideways wind', 0, 1.5, 0.01), C('streakLen', 'Streak length', 0.005, 0.12, 0.001)] },
        { name: 'Marks', items: [C('dropSize', 'Drop size', 0.002, 0.025, 0.0005), C('sizeVar', 'Size variation', 0, 0.02, 0.0005), C('splash', 'Splatter droplets', 0, 8, 1), C('reach', 'Splatter reach', 0.5, 6, 0.1), C('ragged', 'Ragged edges', 0, 0.8, 0.01), C('grain', 'Edge grain (fine to coarse)', 10, 200, 1), C('edge', 'Edge softness', 0.005, 0.25, 0.005)] },
        { name: 'Behaviour', items: [{ key: 'demo', label: 'Self-demo before the first touch', type: 'toggle' }] },
        ...colourGroups(),
      ],
      actions: {
        'X  Dry the word': dry,
        'Pour on the word': () => { target.u = 0.5; target.v = 0.5; touched = true; linger = 3; pouring = false; },
        'Face on': () => setView({ yaw: 0, pitch: 0, followX: 0, followY: 0 }), 'From above': () => setView({ yaw: 20, pitch: 55 }), 'Default camera': () => setView({ yaw: DEFAULTS.yaw, pitch: DEFAULTS.pitch, zoom: 1, panX: 0, panY: 0, followX: DEFAULTS.followX, followY: DEFAULTS.followY }),
      },
      set(key, value) {
        P[key] = value;
        if (key === 'dark' || key === 'bgTone') applyBg();
        if (!REBUILD.has(key)) return;
        clearTimeout(rb);
        rb = setTimeout(async () => { if (key === 'font' || key === 'weight') await ensureFont(P.font, P.weight); build(); }, 220);
      },
      reset() { Object.assign(P, DEFAULTS, COLOUR_DEF, { dark: ctx.theme.name === 'dark' ? 1 : 0 }); applyBg(); build(); },
    },
    debug: {
      stats: () => ({ drops: nd, marks: n, bands: bands.length }),
      pour(u, v, secs = 1) { target.u = u; target.v = v; touched = true; linger = secs; for (let i = 0; i < secs * 60; i++) advance(1 / 60, false); upload(performance.now(), true); },
      run(sec = 1) { for (let i = 0; i < sec * 60; i++) advance(1 / 60, true); upload(performance.now(), true); render(); },
      dry,
      pick,
      paintSum: () => { const d = pg.getImageData(0, 0, paintC.width, paintC.height).data; let t = 0; for (let i = 0; i < d.length; i += 4) t += d[i]; return { t, volSum: vol.reduce((a, b) => a + b, 0) }; },
    },
    destroy() {
      clearTimeout(resetTimer); clearTimeout(rb); ctx.setBackdrop(null);
      offs.forEach((off) => off());
      reveal.destroy();
    },
  };
}
