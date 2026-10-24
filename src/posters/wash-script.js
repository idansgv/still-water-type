// Wash script: a wet brush writes the name in black watercolour along the centre line of a script face; your finger is a brush
// of clear water that carries colour. Drag and the water lifts the ink and drags it along, the colour running into it; it dries
// with a darker rim and a paler middle. Hold to flood. Double tap blots it all up and writes it again in the next face.
//
// The paper is a small simulation on the GPU (ping-pong float textures, three written at once): water; ink floating in the
// water; ink settled into the paper. Ink is a vec4: black, plus colour as absorbance per channel, so colours mix like paint,
// stain a white page and glow on a black one. Water bleeds into dry paper where the fibres let it; floating ink runs down the
// water to the shallow edge as it dries (a flux between neighbours, so the middle pales as the rim darkens); ink settles more
// in the paper's valleys; wet water lifts a little settled ink back up. The centre line comes from the face rendered and
// thinned to one pixel (Zhang-Suen), as in Unravel's test page. Kynd's "Wet and material strokes" was the reference (look only).
//
// Colour: its own, always, on your brush (Idan, 24 Oct 2026: "perhaps we can include color on user interaction"); the writing is
// black. Each press picks the next colour from the palette for the page, never the same twice running.
// gestures: drag = a wet brush, hold = flood, double tap = blot and write again (REFORM_DELAY_MS after, so a third tap can still
// mean reveal).

import { getGL } from '../engine.js';
import { createReveal, grid, corners, titleBlock, ink as rvInk } from './reveal.js';
import { pressTracker, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';

const DEF = { brush: 8.5, speed: 650, water: 0.9, pigment: 0.86, bleed: 0.095, rim: 1.5, dry: 1.2, gran: 0.68, reach: 0.9, lift: 0.013, colour: true, colourAmt: 0.7, newFace: true };   // Idan's tuned values, 24 Oct 2026
const FACES = [
  { family: 'Sacramento', weight: 400, size: 1.12 },
  { family: 'Great Vibes', weight: 400, size: 1.0 },
  { family: 'Allura', weight: 400, size: 1.05 },
  { family: 'Parisienne', weight: 400, size: 0.95 },
  { family: 'Pinyon Script', weight: 400, size: 0.9 },
  { family: 'Dancing Script', weight: 400, size: 0.95 },
];
const PAL = { dark: ['#2ee6ff', '#6fe0a0', '#d4f01a', '#ff4fe0', '#ff5a9a', '#ff6b5e'], light: ['#0a7fb5', '#0f9d8a', '#4a9a1a', '#c2185b', '#e0455a', '#e8652e'] };
const SUB = 3;
const REF_SCALE = 1.5;                                           // the sim cells per css px Idan tuned at (a retina laptop)                                                   // simulation steps per frame

// the faces, only the letters of the name, from Google Fonts: the stylesheet first, then the faces
let faces = null;
function loadFaces() {
  if (faces) return faces;
  const l = document.createElement('link'); l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?' + FACES.map((f) => 'family=' + f.family.replace(/ /g, '+')).join('&') + '&text=' + encodeURIComponent('IdanSegv') + '&display=block';
  faces = new Promise((r) => { l.onload = r; l.onerror = r; setTimeout(r, 2500); document.head.appendChild(l); });
  return faces;
}

const VS = `#version 300 es
  in vec2 a; out vec2 uv; void main() { uv = a * 0.5 + 0.5; gl_Position = vec4(a, 0, 1); }`;
const COMMON = `#version 300 es
precision highp float; in vec2 uv;
uniform vec2 uRes;                   // sim size in px
uniform vec2 uA, uB; uniform float uR, uWater; uniform vec4 uPig; uniform vec2 uBV; uniform int uMode;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float paper(vec2 p) { return 0.5 * vn(p / 7.0) + 0.3 * vn(p / 2.6 + 9.1) + 0.2 * vn(p / 23.0 + 3.7); }
float seg(vec2 p, vec2 a, vec2 b) { vec2 ab = b - a; float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0); return length(p - a - ab * t); }
`;
// velocity: decays each step; a moving wet brush pushes the water along with it
const VEL = COMMON + `out vec4 o; uniform sampler2D uV; uniform float uDecay;
void main() {
  vec2 p = uv * uRes; vec2 v = texture(uV, uv).xy * uDecay;
  if (uMode > 0) { float d = seg(p, uA, uB); float f = smoothstep(uR * 1.15, uR * 0.2, d); v = mix(v, uBV, f * (uMode == 2 ? 0.85 : 0.35)); }
  o = vec4(v, 0, 1);
}`;
// state, three textures: uS = (water, black ink floating, black ink settled); uF = colour floating (rgb); uD = colour settled (rgb).
// Ink is a vec4 below: x black, yzw colour (as absorbance per channel, so colours mix like paint).
const STATE = COMMON + `layout(location = 0) out vec4 o0; layout(location = 1) out vec4 o1; layout(location = 2) out vec4 o2;
uniform sampler2D uS, uF, uD, uV; uniform float uBleed, uRim, uDry, uGran, uLift, uKeep;
void main() {
  vec2 px = 1.0 / uRes, p = uv * uRes;
  vec4 S = texture(uS, uv);
  float pp = paper(p);
  vec2 v = texture(uV, uv).xy;
  vec2 ub = uv - v * px;                                  // what a moving brush pushed here
  float W = texture(uS, ub).r;
  vec4 F = vec4(texture(uS, ub).g, texture(uF, ub).rgb);
  vec4 D = vec4(S.b, texture(uD, uv).rgb);
  // the edge pulls: floating ink runs down the water toward the shallow edge, where it piles up as it dries (the dark rim).
  // Done as a flux between neighbours, so ink leaves the middle as it arrives at the edge.
  float k = uRim * 0.25, Wi = S.r, wi = step(0.01, Wi), sumW = 0.0;
  vec4 Fi = vec4(S.g, texture(uF, uv).rgb), flow = vec4(0), sumF = vec4(0);
  vec2 o4[4] = vec2[4](vec2(px.x, 0), vec2(-px.x, 0), vec2(0, px.y), vec2(0, -px.y));
  for (int n = 0; n < 4; n++) {
    vec4 N = texture(uS, uv + o4[n]); vec4 NF = vec4(N.g, texture(uF, uv + o4[n]).rgb);
    flow += k * max(0.0, N.r - Wi) * NF * wi;              // in, from deeper water
    flow -= k * max(0.0, Wi - N.r) * Fi * step(0.01, N.r); // out, to shallower water
    sumW += N.r; sumF += NF;
  }
  F = max(vec4(0), F + flow);
  // bleed: water spreads into its neighbours; into dry paper only where the fibres let it (ragged edges)
  float avgW = 0.25 * sumW;
  float into = S.r > 0.02 ? 1.0 : smoothstep(0.0, 0.2, avgW - pp * 0.22);
  W += uBleed * into * (avgW - W);
  float wet = smoothstep(0.0, 0.06, W);
  F += uBleed * 0.3 * wet * (0.25 * sumF - F);
  // drying
  W = max(0.0, W - uDry * 0.001 * (0.55 + 0.9 * pp) * (1.0 + 2.5 * (1.0 - smoothstep(0.0, 0.3, W))));   // thin water at the edge goes first
  wet = smoothstep(0.0, 0.06, W);
  // settling: a little all the time, all of it once the paper is dry; more in the paper's valleys (granulation)
  float g = mix(1.0, 0.35 + 1.4 * (1.0 - pp), uGran);
  vec4 dep = min(F, F * (0.0004 * g + (1.0 - wet)));
  F -= dep; D += dep * g;
  // wet water lifts some settled ink back up, so a wet brush can move ink that has dried
  vec4 lift = D * uLift * smoothstep(0.08, 0.5, W);
  D -= lift; F += lift;
  // the brush: the writer lays black ink; your brush lays water and, when it carries colour, colour
  if (uMode > 0) {
    float d = seg(p, uA, uB) + (pp - 0.5) * uR * 0.35;
    float f = smoothstep(uR, uR * 0.82, d);
    W = max(W, uWater * f);
    F = max(F, uPig * f);
  }
  o0 = vec4(W, F.x, D.x, 1) * uKeep; o1 = vec4(F.yzw, 1) * uKeep; o2 = vec4(D.yzw, 1) * uKeep;
}`;
const DRAW = COMMON + `out vec4 o; uniform sampler2D uS, uF, uD; uniform vec3 uBg, uInk; uniform float uDark;
void main() {
  vec4 S = texture(uS, uv);
  float dens = S.b + S.g * 0.8;
  float a = 1.0 - exp(-dens * 1.9);
  a += (1.0 - a) * smoothstep(0.0, 0.4, S.r) * 0.045;   // wet paper reads a touch darker
  vec3 col = mix(uBg, uInk, clamp(a, 0.0, 1.0));
  // colour: subtractive on white paper (it stains), the same pigment glowing on black
  vec3 T = exp(-(texture(uD, uv).rgb + texture(uF, uv).rgb * 0.8) * 1.6);
  col = uDark > 0.5 ? clamp(col + (1.0 - T) * (1.0 - a), 0.0, 1.0) : col * T;
  o = vec4(col, 1);
}`;

export async function mount(stage) {
  const gl = getGL(stage.canvas);
  if (!gl) throw new Error('webgl2 unavailable');
  if (!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))) throw new Error('float targets unavailable');
  gl.getExtension('OES_texture_float_linear');
  const dark = stage.flip;                                       // black on white, and white on black on every second shuffle
  stage.setBackdrop(dark ? 0 : 1);
  const bg = stage.colors.bg, ink = stage.colors.fg;
  const P = { ...DEF };
  const offs = [], timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  let alive = true;

  // ---------- GL ----------
  const shaders = [];
  function prog(fs) {
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); shaders.push(o); return o; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'a'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
    return { p, u };
  }
  const pVel = prog(VEL), pState = prog(STATE), pDraw = prog(DRAW);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  let W = stage.W, H = stage.H, SW = 1, SH = 1, scale = 1;
  function tex() {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, SW, SH, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function target(n = 1) {                                          // a framebuffer over n textures (the state writes three at once)
    const t = Array.from({ length: n }, tex), f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    t.forEach((x, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, x, 0));
    gl.drawBuffers(t.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { t, f };
  }
  let S = [], V = [];
  function free() { for (const x of [...S, ...V]) { x.t.forEach((t) => gl.deleteTexture(t)); gl.deleteFramebuffer(x.f); } S = []; V = []; }
  function allocate() {
    free();
    scale = Math.min(stage.dpr * stage.scale, Math.sqrt(2.2e6 / (W * H)));
    SW = Math.max(1, Math.round(W * scale)); SH = Math.max(1, Math.round(H * scale));
    S = [target(3), target(3)]; V = [target(), target()];
  }

  // ---------- one step of the paper ----------
  // mode 0: nothing; 1: the writing brush (water and black ink); 2: your brush (water and colour; pushes what is wet)
  let br = { mode: 0, ax: 0, ay: 0, bx: 0, by: 0, r: 1, water: 0, pig: [0, 0, 0, 0], vx: 0, vy: 0 };
  let keep = 1, steps = 0;
  const bind = (unit, t, loc) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); };
  function step() {
    gl.viewport(0, 0, SW, SH);
    const setBrush = (u) => {
      gl.uniform2f(u.uRes, SW, SH); gl.uniform1i(u.uMode, br.mode);
      gl.uniform2f(u.uA, br.ax * scale, SH - br.ay * scale); gl.uniform2f(u.uB, br.bx * scale, SH - br.by * scale);
      gl.uniform1f(u.uR, br.r * scale); gl.uniform1f(u.uWater, br.water); gl.uniform4fv(u.uPig, br.pig);
      gl.uniform2f(u.uBV, br.vx * scale, -br.vy * scale);
    };
    gl.useProgram(pVel.p); setBrush(pVel.u);
    bind(0, V[0].t[0], pVel.u.uV); gl.uniform1f(pVel.u.uDecay, P.reach);
    gl.bindFramebuffer(gl.FRAMEBUFFER, V[1].f); gl.drawArrays(gl.TRIANGLES, 0, 3); V.reverse();
    gl.useProgram(pState.p); setBrush(pState.u);
    bind(0, S[0].t[0], pState.u.uS); bind(1, S[0].t[1], pState.u.uF); bind(2, S[0].t[2], pState.u.uD); bind(3, V[0].t[0], pState.u.uV);
    const res = scale / REF_SCALE;                                      // rim and bleed move ink a cell a step: keep them the same in css px at any resolution
    gl.uniform1f(pState.u.uBleed, P.bleed * res); gl.uniform1f(pState.u.uRim, P.rim * res); gl.uniform1f(pState.u.uDry, P.dry);
    gl.uniform1f(pState.u.uGran, P.gran); gl.uniform1f(pState.u.uLift, P.lift); gl.uniform1f(pState.u.uKeep, keep);
    gl.bindFramebuffer(gl.FRAMEBUFFER, S[1].f); gl.drawArrays(gl.TRIANGLES, 0, 3); S.reverse();
    steps++;
  }
  function draw() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, stage.pw, stage.ph);
    gl.useProgram(pDraw.p); gl.uniform2f(pDraw.u.uRes, SW, SH);
    bind(0, S[0].t[0], pDraw.u.uS); bind(1, S[0].t[1], pDraw.u.uF); bind(2, S[0].t[2], pDraw.u.uD);
    gl.uniform3fv(pDraw.u.uBg, bg); gl.uniform3fv(pDraw.u.uInk, ink); gl.uniform1f(pDraw.u.uDark, dark ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---------- colour on your brush: absorbance, so it stains white paper in that colour and glows in it on black ----------
  const hex = (s) => { const n = parseInt(s.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  let hue = -1, brushColour = [0, 0, 0];
  function nextColour() {
    const list = PAL[dark ? 'dark' : 'light']; let h; do h = Math.floor(stage.rand() * list.length); while (h === hue && list.length > 1); hue = h;
    const c = hex(list[h]), k = c.map((x) => -Math.log(Math.max(0.03, dark ? 1 - x : x))), m = Math.max(...k);
    return k.map((x) => x / m * P.colourAmt);
  }

  // ---------- the name's centre line ----------
  let face = 0;
  async function fontStrokes(f) {
    await loadFaces();
    const NAME = 'Idan Segev';                                       // the stylesheet only has these letters, so ask for them (the default test string is not in it)
    try { await Promise.race([document.fonts.load(`${f.weight} 100px "${f.family}"`, NAME), new Promise((r) => setTimeout(r, 3000))]); } catch (e) { return null; }
    if (!document.fonts.check(`${f.weight} 100px "${f.family}"`, NAME)) return null;
    const w = Math.ceil(W), h = Math.ceil(H), m = document.createElement('canvas'); m.width = w; m.height = h;
    const x = m.getContext('2d', { willReadFrequently: true }), font = (px) => `${f.weight} ${px}px "${f.family}"`;
    const words = W / H < 0.8 ? ['Idan', 'Segev'] : ['Idan Segev'];
    x.font = font(100); const widest = Math.max(...words.map((t) => x.measureText(t).width));
    const size = Math.min(W * 0.8 / widest * 100, H * (words.length > 1 ? 0.3 : 0.42) * f.size);
    x.font = font(size); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#000';
    const lead = size * 0.9, top = H / 2 - (words.length - 1) * lead / 2;
    words.forEach((t, i) => x.fillText(t, W / 2, top + i * lead));
    const d = x.getImageData(0, 0, w, h).data, img = new Uint8Array(w * h);
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] > 36) { img[i] = 1; const px = i % w, py = (i / w) | 0; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; }
    if (x1 <= x0) return null;
    x0 = Math.max(1, x0 - 2); y0 = Math.max(1, y0 - 2); x1 = Math.min(w - 2, x1 + 2); y1 = Math.min(h - 2, y1 + 2);
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
    // walk the centre line into strokes, as straight as the line allows
    const N8 = [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1], DX = [-1, 0, 1, -1, 1, -1, 0, 1], DY = [-1, -1, -1, 0, 0, 1, 1, 1];
    const used = new Uint8Array(w * h), pix = [];
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) if (img[py * w + px]) pix.push(py * w + px);
    const free = (i) => { const r = []; for (let k = 0; k < 8; k++) { const j = i + N8[k]; if (img[j] && !used[j]) r.push(k); } return r; };
    const paths = [];
    for (;;) {
      let start = -1;
      // start each stroke from its leftmost loose end, the way a hand would
      let bx = Infinity;
      for (const i of pix) if (!used[i] && free(i).length <= 1 && i % w < bx) { bx = i % w; start = i; }
      if (start < 0) for (const i of pix) if (!used[i]) { start = i; break; }
      if (start < 0) break;
      const path = [start]; used[start] = 1; let cur = start, dx = 0, dy = 0;
      for (;;) {
        const fr = free(cur); if (!fr.length) break;
        let best = fr[0], bs = -9;
        for (const k of fr) { const sc = (DX[k] * dx + DY[k] * dy) / Math.hypot(DX[k], DY[k]) + (DX[k] && DY[k] ? 0 : 0.05); if (sc > bs) { bs = sc; best = k; } }
        const nx = cur + N8[best];
        for (const k of fr) used[cur + N8[k]] = 1;
        dx = dx * 0.6 + DX[best] * 0.4; dy = dy * 0.6 + DY[best] * 0.4;
        path.push(nx); used[nx] = 1; cur = nx;
      }
      paths.push(path);
    }
    const strokes = [];
    for (const path of paths) {
      if (path.length < 6) continue;
      let q = path.map((i) => [i % w, (i / w) | 0]);
      for (let it = 0; it < 3; it++) q = q.map((p, k) => (k === 0 || k === q.length - 1 ? p : [(q[k - 1][0] + 2 * p[0] + q[k + 1][0]) / 4, (q[k - 1][1] + 2 * p[1] + q[k + 1][1]) / 4]));
      strokes.push(q);
    }
    // write in reading order: by line, then left to right
    const lineOf = (st) => Math.round(((st[0][1] + st[st.length - 1][1]) / 2 - top) / lead);
    strokes.sort((a, b) => lineOf(a) - lineOf(b) || Math.min(...a.map((p) => p[0])) - Math.min(...b.map((p) => p[0])));
    return strokes;
  }

  // ---------- the writer: a brush that follows the strokes ----------
  let strokes = [], wi = 0, wt = 0, writing = false, lifting = 0, last = null;
  function writerAdvance(dist) {
    // returns the segment the brush paints this step, or null while it is lifted between strokes
    while (writing) {
      if (lifting > 0) { lifting -= dist; last = null; return null; }
      const st = strokes[wi]; if (!st) { writing = false; return null; }
      const n = st.length - 1, t1 = Math.min(n, wt + dist);
      const at = (t) => { const i = Math.min(n - 1, Math.floor(t)), u = t - i; return [st[i][0] + (st[i + 1][0] - st[i][0]) * u, st[i][1] + (st[i + 1][1] - st[i][1]) * u]; };
      const a = last || at(wt), b = at(t1);
      // pressure: press in at the start, lift off at the end, heavier on downstrokes
      const dy = (b[1] - a[1]) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1);
      const ramp = Math.min(1, t1 / 10) * Math.min(1, (n - t1) / 14 + 0.25);
      const press = (0.72 + 0.38 * Math.max(0, dy)) * (0.35 + 0.65 * ramp);
      wt = t1; last = b;
      const pool = 1 + 0.55 * Math.max(0, 1 - t1 / 18) + 0.25 * Math.max(0, 1 - (n - t1) / 10);
      const run = (0.82 + 0.3 * Math.sin(wi * 2.3 + 1)) * (0.9 + 0.18 * Math.sin(t1 * 0.045 + wi));
      if (wt >= n) { wi++; wt = 0; lifting = 40; last = null; }
      return { a, b, r: P.brush * press, ink: pool * run };
    }
    return null;
  }

  // ---------- the brushes, this step ----------
  function paint(s, mode) {
    if (!s) { br.mode = 0; return; }
    const pig = mode === 1 ? [P.pigment * (s.ink || 1), 0, 0, 0] : [0, ...(P.colour ? brushColour : [0, 0, 0])];
    br = { mode, ax: s.a[0], ay: s.a[1], bx: s.b[0], by: s.b[1], r: s.r, water: P.water, pig, vx: s.vx || 0, vy: s.vy || 0 };
    if (mode === 1) { const d = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) || 1; br.vx = (s.b[0] - s.a[0]) / d * 0.6; br.vy = (s.b[1] - s.a[1]) / d * 0.6; }
  }

  let wetUntil = 0, built = 0;
  async function build(next) {
    W = stage.W; H = stage.H; allocate();
    const me = ++built;
    if (next) face = (face + 1) % FACES.length;
    let got = null;
    for (let k = 0; k < FACES.length && !got; k++) { got = await fontStrokes(FACES[face]); if (!got || !got.length) { got = null; face = (face + 1) % FACES.length; } }
    if (!alive || me !== built) return;
    strokes = got || []; wi = 0; wt = 0; lifting = 0; last = null; writing = strokes.length > 0;
    if (stage.reduced) {                                            // stand still: write and dry it all at once
      while (writing) { paint(writerAdvance(30), 1); step(); }
      br.mode = 0; for (let i = 0; i < 1400; i++) step();
      draw(); wetUntil = 0;
    } else wetUntil = performance.now() + 9000;
  }

  // ---------- touch: your brush ----------
  const press = pressTracker();
  const ptr = { down: false, id: null, x: 0, y: 0, px: 0, py: 0, held: 0 };
  let lastTap = 0, reformT = 0, blotting = 0;
  offs.push(stage.on('down', (q, e) => {
    if (!press.down(q, e.pointerId)) return;
    brushColour = nextColour();
    Object.assign(ptr, { down: true, id: e.pointerId, x: q.x, y: q.y, px: q.x, py: q.y, held: 0 });
  }));
  offs.push(stage.on('move', (q, e) => { if (!ptr.down || e.pointerId !== ptr.id) return; press.move(q, e.pointerId); ptr.x = q.x; ptr.y = q.y; }));
  offs.push(stage.on('up', (q, e) => {
    if (!ptr.down || e.pointerId !== ptr.id) return;
    const r = press.up(q, e.pointerId); ptr.down = false; ptr.id = null; wetUntil = performance.now() + 9000;
    if (r && r.tap) {
      const now = performance.now();
      if (now - lastTap < DOUBLE_MS) {                                // two taps: blot it all up and write it again, a beat later so a third tap can still mean reveal
        clearTimeout(reformT); reformT = later(() => { if (!stage.revealed) blotting = 34; }, REFORM_DELAY_MS); lastTap = 0;
      } else lastTap = now;
    }
  }));
  offs.push(stage.on('reveal', () => clearTimeout(reformT)));

  // ---------- reveal: the centre line the brush follows, and where it is now ----------
  const rv = createReveal(stage, (c, W_, H_, k) => {
    const colr = (a) => rvInk(stage, a);
    grid(c, W_, H_, 24, colr, k); corners(c, W_, H_, 16, colr, k);
    c.lineWidth = 1; let pts = 0;
    strokes.forEach((st, i) => {
      pts += st.length;
      c.strokeStyle = colr((i < wi || !writing ? 0.8 : 0.3) * k); c.beginPath(); c.moveTo(st[0][0], st[0][1]); for (const p of st) c.lineTo(p[0], p[1]); c.stroke();
      c.fillStyle = colr(0.9 * k); c.fillRect(st[0][0] - 2, st[0][1] - 2, 4, 4);
      for (let j = 12; j < st.length; j += 12) c.fillRect(st[j][0] - 1, st[j][1] - 1, 2, 2);
    });
    titleBlock(c, W_, H_, ['WASH SCRIPT · STRUCTURE', '— the centre line the brush follows ■ where a stroke starts', `${FACES[face].family} · ${strokes.length} strokes · ${pts} points`], colr, k);
  });

  // ---------- settings ----------
  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  const tune = {
    title: 'Wash script', values: P, defaults: DEF,
    groups: [
      { name: 'Brush', items: [Ctl('brush', 'Brush width', 2, 30, 0.5), Ctl('speed', 'Writing speed', 200, 4000, 50), Ctl('water', 'Water on the brush', 0.1, 1, 0.01), Ctl('pigment', 'Ink on the brush', 0.1, 2, 0.01)] },
      { name: 'Paper', items: [Ctl('bleed', 'Bleed', 0, 0.24, 0.005), Ctl('rim', 'Dark rim', 0, 3, 0.05), Ctl('dry', 'Drying speed', 0.2, 6, 0.1), Ctl('gran', 'Granulation', 0, 1, 0.01)] },
      { name: 'Your brush', items: [Ctl('reach', 'Drag reach', 0.5, 0.99, 0.01), Ctl('lift', 'Water lifts dried ink', 0, 0.05, 0.001), { key: 'colour', label: 'Colour on your brush', type: 'toggle' }, Ctl('colourAmt', 'Colour strength', 0.1, 2, 0.05), { key: 'newFace', label: 'A new face every blot', type: 'toggle' }] },
    ],
    actions: { 'Write it again': () => { blotting = 34; } },
    set(key, v) { P[key] = v; },
    reset() { Object.assign(P, DEF); },
  };

  loadFaces();
  await build(false);
  let rz = 0;
  offs.push(stage.on('resize', () => { clearTimeout(rz); rz = later(() => build(false), 250); }));
  offs.push(stage.frame((dt) => {
    dt = Math.min(0.05, dt);
    const now = performance.now();
    if (blotting > 0) {
      keep = 0.86; br.mode = 0; for (let i = 0; i < SUB; i++) step(); keep = 1;
      if (--blotting === 0) build(P.newFace);
      draw();
    } else if (writing || ptr.down || now < wetUntil) {             // nothing moves at rest: the paper only steps while something is wet
      for (let i = 0; i < SUB; i++) {
        if (ptr.down) {
          // your brush: water and colour; it pushes what is wet the way you move; holding still floods and spreads
          const ax = ptr.px + (ptr.x - ptr.px) * (i / SUB), ay = ptr.py + (ptr.y - ptr.py) * (i / SUB);
          const bx = ptr.px + (ptr.x - ptr.px) * ((i + 1) / SUB), by = ptr.py + (ptr.y - ptr.py) * ((i + 1) / SUB);
          const grow = 1 + Math.min(1.6, ptr.held * 1.1);
          paint({ a: [ax, ay], b: [bx, by], r: P.brush * 1.7 * grow, vx: (bx - ax) * 1.1, vy: (by - ay) * 1.1 }, 2);
          br.water = Math.min(1, P.water * (0.8 + 0.3 * grow));
        } else if (writing) paint(writerAdvance(P.speed * dt / SUB), 1);
        else br.mode = 0;
        step();
      }
      if (ptr.down) { const still = Math.hypot(ptr.x - ptr.px, ptr.y - ptr.py) < 1.5; ptr.held = still ? ptr.held + dt : Math.max(0, ptr.held - dt * 2); ptr.px = ptr.x; ptr.py = ptr.y; }
      if (writing) wetUntil = now + 9000;
      draw();
    }
    rv.draw();
  }));

  return {
    tune,
    debug: { P, get writing() { return writing; }, get steps() { return steps; }, blot: () => { blotting = 34; } },
    destroy() {
      alive = false; timers.forEach(clearTimeout); clearTimeout(reformT); rv.destroy(); offs.forEach((f) => f());
      free(); for (const p of [pVel, pState, pDraw]) gl.deleteProgram(p.p); shaders.forEach((s) => gl.deleteShader(s)); gl.deleteBuffer(vb);
      stage.setBackdrop(null);
    },
  };
}
