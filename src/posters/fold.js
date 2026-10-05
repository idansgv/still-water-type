// Fold. Each letter is its own piece of folded paper; there is no sheet.
//
// Head-on, the camera is exactly where the projector is, so every letter lands as a flat, crisp shape and the
// creases give nothing away. Tilt the view (cursor, finger, or a phone) and the folds appear in each letter, as
// facets that catch the light. Tap a letter and that letter crumples into a ball and is thrown off the page; a new
// one arrives as a ball and unfolds into its place. The crumpled ones are not thrown away: each stays on the page as a
// ball of paper, tossed aside, and the balls roll, knock into each other and the edges of the page, and settle. Tap a
// ball to knock it.
//
// Under the graphic: every letter is a small patch of GPU point sprites, laid out from gl_VertexID, whose shape is
// a real cloth simulation (Houdini Vellum baked as a Vertex Animation Texture; MIT, see data/crumple.LICENSE.txt).
// The point cloud is cut to the letter (every pixel outside the type is discarded), so the letter is the paper.
// The type is a mask looked up through a projector at the resting camera: three channels, so neighbouring letters
// never see each other's ink. Method after Sheet; the crumple data and the projection are shared with it.

import { getGL, compile, texture, uploadCanvas, mulberry32, clamp } from '../engine.js';

const D = 3.2;   // camera distance, also the projector's
const FONT = '"Archivo", "Arial Black", "Helvetica Neue", sans-serif';

export async function mount(ctx) {
  const { canvas } = ctx;
  const gl = getGL(canvas, { depth: true });
  if (!gl) throw new Error('webgl2 unavailable');
  ctx.adaptive = true;
  const offs = [];
  const rand = ctx.rand;

  const DEFAULTS = {
    relief: 0.65, restFrame: 24.25, extra: 0.3, creases: 4, reach: 1.2, width: 0.6, softness: 0.012, align: 0.4, bow: 0, edge: 0.45,
    density: 330, margin: 0.06, typeSize: 0.96,
    shadows: 1, bgL: 0, paperL: 1, shading: 0.35, ao: 0.1, yaw: 0, pitch: 0.22, damping: 19, sway: 0.25,
    crumpleTime: 0.5, exitTime: 1.15, unfoldTime: 0.9,
    shadowSoft: 0, shadowLevels: 2, shadowCut: 0.05, shadowDepth: 0.5,                     // hard-edged shadows: the shading is cut into a few flat tones (soft = 1 is the old smooth look)
    ballSize: 0.55, bounce: 0.6, drag: 0.5, toss: 2.6, maxBalls: 36, gravity: 11, hop: 0.34, thud: 0.42, roll: 0.35,  };
  const P = { ...DEFAULTS };

  // ---------- shaders (the paper is the letter: points outside the type are discarded) ----------
  const VS = `#version 300 es
  precision highp float;
  precision highp sampler2DArray;
  uniform sampler2D uHeight;
  uniform sampler2DArray uVatD, uVatN;
  uniform vec2 uGrid, uSheetHalf, uCenter, uFlip;
  uniform mat3 uRot, uSpin;
  uniform vec3 uMove;
  uniform float uA, uSize, uShade, uAmp, uExtra, uLift, uFrame, uRestFrame, uCrumple, uAO, uReveal, uShadows;
  out vec2 vTex;
  out vec2 vSheet;
  out float vShade;
  out float vAO;

  const vec2 VAT = vec2(70.0, 50.0);
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec2 vatUV(vec2 hu) {
    vec2 q = vec2(uFlip.x < 0.0 ? 1.0 - hu.x : hu.x, uFlip.y < 0.0 ? 1.0 - hu.y : hu.y);
    return (q * (VAT - 1.0) + 0.5) / VAT;
  }
  vec3 vatDisp(vec2 tc, float fr) {
    float f0 = floor(fr), t = fr - f0, f1 = min(f0 + 1.0, 49.0);
    vec3 d = mix(texture(uVatD, vec3(tc, f0)).xyz, texture(uVatD, vec3(tc, f1)).xyz, t);
    return vec3(d.x * uFlip.x, d.y * uFlip.y, d.z);
  }
  vec4 vatNrm(vec2 tc, float fr) {
    float f0 = floor(fr), t = fr - f0, f1 = min(f0 + 1.0, 49.0);
    vec4 a = texture(uVatN, vec3(tc, f0)), b = texture(uVatN, vec3(tc, f1));
    vec4 m = mix(a, b, t);
    vec3 n = normalize(m.xyz * 2.0 - 1.0);
    return vec4(n.x * uFlip.x, n.y * uFlip.y, n.z, m.w);
  }

  void main() {
    int nxI = int(uGrid.x);
    vec2 fid = vec2(float(gl_VertexID % nxI), float(gl_VertexID / nxI));
    vec2 jit = vec2(hash(fid + 0.17), hash(fid.yx + 3.31)) - 0.5;
    vec2 uvg = (fid - 0.5 + jit * 0.7) / (uGrid - 2.0);
    vec2 xyLoc = vec2(uvg.x * 2.0 - 1.0, 1.0 - uvg.y * 2.0) * uSheetHalf;
    vec2 hu = clamp(vec2(uvg.x, 1.0 - uvg.y), 0.0, 1.0);
    vec2 tc = vatUV(hu);
    float sheetH = 2.0 * uSheetHalf.y;

    float e = 0.004;
    float fibre = sin(uvg.x * 913.1 + uvg.y * 227.7) * sin(uvg.y * 611.3 - uvg.x * 331.9) * 0.0012;
    float calm = 1.0 - smoothstep(0.0, 0.15, uCrumple);
    float hExtra = (texture(uHeight, hu).r * uExtra + fibre) * uAmp * calm;
    float hx = (texture(uHeight, hu + vec2(e, 0.0)).r - texture(uHeight, hu - vec2(e, 0.0)).r) / (2.0 * e * 2.0 * uSheetHalf.x);
    float hy = (texture(uHeight, hu + vec2(0.0, e)).r - texture(uHeight, hu - vec2(0.0, e)).r) / (2.0 * e * 2.0 * uSheetHalf.y);

    vec3 dR = vatDisp(tc, uRestFrame) * sheetH;
    vec3 P0 = vec3(xyLoc + uCenter, dR.z * uAmp + hExtra);

    vec3 d = vatDisp(tc, uFrame) * sheetH;
    vec3 L = vec3(xyLoc + (d.xy - dR.xy), d.z * mix(uAmp, 1.0, uCrumple) + hExtra);
    vec4 nn = vatNrm(tc, uFrame);
    vec3 n = normalize(vec3(nn.xy * mix(uAmp, 1.0, uCrumple) + vec2(-hx, -hy) * uExtra * uAmp * calm, nn.z));

    L = uSpin * L; n = uSpin * n;
    vec3 P = vec3(L.xy + uCenter + uMove.xy, L.z + uLift);

    float size = uSize * mix(1.0, 0.8, uCrumple);
    vec3 Pc = transpose(uRot) * P;
    float dz = ${D.toFixed(2)} - Pc.z;
    vec2 ndc = vec2(Pc.x * ${D.toFixed(2)} / (dz * uA), Pc.y * ${D.toFixed(2)} / dz);
    gl_Position = vec4(ndc, (dz - 0.5) / 6.0 * 2.0 - 1.0, 1.0);
    gl_PointSize = size * ${D.toFixed(2)} / dz;

    vec2 tex = P0.xy * ${D.toFixed(2)} / (${D.toFixed(2)} - P0.z);
    vTex = (tex / vec2(uA, 1.0)) * 0.5 + 0.5;
    vSheet = xyLoc;

    vec3 vNow = normalize(uRot * vec3(0.0, 0.0, ${D.toFixed(2)}) - P);
    vec3 vRest = normalize(vec3(0.0, 0.0, ${D.toFixed(2)}) - P0);
    float delta = (dot(n, vNow) - dot(n, vRest)) * uShade;
    float blend = smoothstep(0.0, 0.25, uCrumple);
    float light = 0.42 + 0.58 * abs(dot(n, normalize(vec3(0.35, 0.55, 1.0))));
    vShade = uShadows > 0.5 ? mix(delta, light - 1.0, blend) : 0.0;
    vAO = uShadows > 0.5 ? 1.0 - uAO * nn.w * max(uReveal, blend) : 1.0;
  }`;
  const FS = `#version 300 es
  precision highp float;
  in vec2 vTex;
  in vec2 vSheet;
  in float vShade;
  in float vAO;
  uniform sampler2D uMask;
  uniform vec2 uRes, uSheetHalf, uCos;
  uniform float uSize, uChan, uSoft, uLevels, uCut, uDepth;
  uniform vec3 uPaper;
  out vec4 o;
  void main() {
    vec2 pc = gl_PointCoord - 0.5;
    vec2 off = vec2(pc.x, -pc.y) * uSize * (2.0 / uRes.y) / uCos;
    vec2 sh = vSheet + off;
    if (abs(sh.x) > uSheetHalf.x || abs(sh.y) > uSheetHalf.y) discard;    // the patch's own edge
    vec2 uvt = vTex + vec2(off.x * uRes.y / uRes.x, off.y) * 0.5;
    vec3 m = texture(uMask, uvt).rgb;
    float ink = uChan < 0.5 ? m.r : (uChan < 1.5 ? m.g : m.b);            // this letter's own channel
    if (smoothstep(0.42, 0.58, ink) < 0.5) discard;                         // outside the letter there is no paper
    float paper = clamp((1.0 + vShade) * vAO, 0.14, 1.0);
    // hard shadows: anything darker than the cut becomes a flat shadow tone (a few of them, deeper where it is darker), anything lighter stays paper
    float dark = 1.0 - paper;
    float step1 = (0.86 - uCut) / uLevels;
    float q = dark > uCut ? min(ceil((dark - uCut) / step1), uLevels) : 0.0;
    float hard = 1.0 - uDepth * q / uLevels;
    o = vec4(uPaper * mix(hard, paper, uSoft), 1.0);
  }`;

  const prog = compile(gl, VS, FS);
  // a hard dark disc on the page under each ball: it grows and drifts away from the light as the ball rises
  const SVS = `#version 300 es
  uniform vec3 uRot3[3]; uniform mat3 uRot; uniform float uA, uPx;
  in vec3 aP;
  void main() {
    vec3 Pc = transpose(uRot) * aP;
    float dz = ${D.toFixed(2)} - Pc.z;
    gl_Position = vec4(Pc.x * ${D.toFixed(2)} / (dz * uA), Pc.y * ${D.toFixed(2)} / dz, (dz - 0.5) / 6.0 * 2.0 - 1.0, 1.0);
    gl_PointSize = uPx * ${D.toFixed(2)} / dz;
  }`;
  const SFS = `#version 300 es
  precision highp float; uniform float uAlpha; out vec4 o;
  void main() { vec2 q = gl_PointCoord - 0.5; if (dot(q, q) > 0.25) discard; o = vec4(0.0, 0.0, 0.0, uAlpha); }`;
  const shadowProg = compile(gl, SVS.replace('uniform vec3 uRot3[3]; ', ''), SFS);
  const shadowBuf = gl.createBuffer();
  gl.bindVertexArray(gl.createVertexArray());

  // ---------- the baked simulation (shared with Sheet; see tools/vat-extract.mjs) ----------
  const FRAMES = 50, VW = 70, VH = 50;
  const half = (() => {
    const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
    return (v) => {
      f32[0] = v; const x = u32[0], sign = (x >>> 16) & 0x8000;
      let exp = ((x >>> 23) & 0xff) - 127 + 15, man = x & 0x7fffff;
      if (exp <= 0) { if (exp < -10) return sign; man = (man | 0x800000) >> (1 - exp); return sign | ((man + 0x1000) >> 13); }
      if (exp >= 31) return sign | 0x7c00;
      return sign | (exp << 10) | ((man + 0x1000) >> 13);
    };
  })();
  async function loadSimulation() {
    const n = FRAMES * VH * VW;
    const dispH = new Uint16Array(n * 4), nrmU = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) { nrmU[i * 4] = 128; nrmU[i * 4 + 1] = 128; nrmU[i * 4 + 2] = 255; }
    try {
      const res = await fetch(new URL('./data/crumple.bin', import.meta.url));
      if (!res.ok) throw new Error(`crumple.bin: ${res.status}`);
      const buf = await res.arrayBuffer();
      if (new DataView(buf).getUint32(0, true) !== 0x504d5243) throw new Error('crumple.bin: bad header');
      const d16 = new Int16Array(buf, 16, n * 3), nr = new Uint8Array(buf, 16 + n * 6, n * 4);
      for (let i = 0; i < n; i++) { dispH[i * 4] = half(d16[i * 3] / 16384); dispH[i * 4 + 1] = half(d16[i * 3 + 1] / 16384); dispH[i * 4 + 2] = half(d16[i * 3 + 2] / 16384); }
      nrmU.set(nr);
    } catch (e) { console.warn('[fold] crumple data unavailable, using flat paper', e); }
    const mk = (internal, type, data) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
      gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, internal, VW, VH, FRAMES, 0, gl.RGBA, type, data);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    return { d: mk(gl.RGBA16F, gl.HALF_FLOAT, dispH), n: mk(gl.RGBA8, gl.UNSIGNED_BYTE, nrmU) };
  }
  const vat = await loadSimulation();
  const spinMat = (ax, a, o) => {
    const c = Math.cos(a), sn = Math.sin(a), t = 1 - c, [x, y, z] = ax;
    o[0] = t * x * x + c;      o[1] = t * x * y + sn * z; o[2] = t * x * z - sn * y;
    o[3] = t * x * y - sn * z; o[4] = t * y * y + c;      o[5] = t * y * z + sn * x;
    o[6] = t * x * z + sn * y; o[7] = t * y * z - sn * x; o[8] = t * z * z + c;
    return o;
  };

  // ---------- the letters ----------
  // "Idan / Segev" justified to the width like the other posters. Each letter gets a patch of paper a little larger than
  // its ink, a channel in the shared mask (three channels, so a letter's neighbours are never in its channel), and its own state.
  let A = 1, k = 1, letters = [], sizePx = 4, maskTex = texture(gl, { w: 1, h: 1 });
  let balls = [], bounds = { x: 1.7, top: 0.97, bottom: -0.9 };   // the crumpled letters left on the page, and the edges they bounce off
  const LINES = ['Idan', 'Segev'];
  function layout() {
    const W = ctx.pw, H = ctx.ph;
    k = W / ctx.W; A = W / H;
    const chrome = document.querySelector('.chrome');
    const reserve = (((chrome && chrome.offsetHeight) || 56) + 20) * k;
    const usable = H - reserve, padX = W * P.margin, availW = W - padX * 2;
    const c = document.createElement('canvas'), g = c.getContext('2d');
    g.textBaseline = 'alphabetic';
    g.font = `900 100px ${FONT}`;
    const cap100 = g.measureText('H').actualBoundingBoxAscent || 72;
    let sizes = LINES.map((l) => (availW / (g.measureText(l).width || 1)) * 100 * P.typeSize);
    const gap = 0.12;
    const total = () => sizes.reduce((a, s) => a + cap100 * s / 100, 0) + gap * Math.min(...sizes.map((s) => cap100 * s / 100)) * (LINES.length - 1);
    if (total() > usable * 0.92) { const f = usable * 0.92 / total(); sizes = sizes.map((s) => s * f); }
    const caps = sizes.map((s) => cap100 * s / 100), gapPx = gap * Math.min(...caps);
    const tot = caps.reduce((a, b) => a + b, 0) + gapPx * (LINES.length - 1);
    let y = (usable - tot) / 2 + H * 0.01;
    letters = [];
    LINES.forEach((line, li) => {
      g.font = `900 ${sizes[li]}px ${FONT}`;
      const lineW = g.measureText(line).width, left = (W - lineW) / 2;
      const base = y + caps[li];
      for (let i = 0; i < line.length; i++) {
        const pre = g.measureText(line.slice(0, i)).width, m = g.measureText(line[i]);
        const x0 = left + pre - m.actualBoundingBoxLeft, x1 = left + pre + m.actualBoundingBoxRight, y0 = base - m.actualBoundingBoxAscent, y1 = base + m.actualBoundingBoxDescent;
        letters.push({ ch: line[i], size: sizes[li], font: g.font, x: left + pre, base, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hw: (x1 - x0) / 2, hh: (y1 - y0) / 2, chan: letters.length % 3 });
      }
      y = base + gapPx;
    });
    // patches in canvas pixels, then world units (the screen is 2 high)
    const px2w = 2 / H, pad = 1.28;
    let area = 0;
    for (const L of letters) { L.phx = L.hw * pad + 6 * k; L.phy = L.hh * pad + 6 * k; area += 4 * L.phx * L.phy; }
    const spacing = Math.max(1.4 * k, Math.sqrt(area / (P.density * 1000)));
    sizePx = spacing * 1.9;
    bounds = { x: A - 0.03, top: 1 - 0.04, bottom: 1 - 2 * usable / H + 0.02 };
    for (const L of letters) {
      L.half = [L.phx * px2w, L.phy * px2w];
      L.center = [(L.cx - W / 2) * px2w, (H / 2 - L.cy) * px2w];
      L.nx = Math.ceil(2 * L.phx / spacing) + 2; L.ny = Math.ceil(2 * L.phy / spacing) + 2;
    }
  }
  function drawMask() {
    const W = ctx.pw, H = ctx.ph;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter'; g.textBaseline = 'alphabetic';
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    for (const L of letters) { g.font = L.font; g.fillStyle = ['#ff0000', '#00ff00', '#0000ff'][L.chan]; g.fillText(L.ch, L.x, L.base); }
    uploadCanvas(gl, maskTex, c);
  }

  // ---------- one piece of paper: the folds in a letter ----------
  const GX = 120;
  function heightField(L, seed) {
    const r = mulberry32(seed);
    const [halfW, halfH] = L.half;
    const gy = Math.max(60, Math.round(GX * halfH / halfW));
    const base = r() * Math.PI, creases = [];
    for (let i = 0; i < Math.round(P.creases); i++) {
      const long = i < 3;
      const ang = base + (r() - 0.5) * (i % 3 === 0 ? 2.4 : 0.9) * (0.2 + 1.6 * P.align) + (r() < 0.3 ? Math.PI / 2 : 0) * P.align;
      creases.push({ cx: (r() * 2 - 1) * halfW, cy: (r() * 2 - 1) * halfH, dx: Math.cos(ang), dy: Math.sin(ang), a: (r() < 0.5 ? -1 : 1) * (0.07 + r() * 0.15), w0: (0.07 + r() * 0.22) * P.width * Math.min(halfW, halfH) * 3, T: (long ? 0.7 + r() * 0.5 : 0.22 + r() * 0.35) * P.reach * Math.max(halfW, halfH) * 1.4 });
    }
    const eps = P.softness * Math.min(halfW, halfH) * 3;
    const f = new Float32Array((GX + 1) * (gy + 1));
    for (let j = 0; j <= gy; j++) for (let i = 0; i <= GX; i++) {
      const x = (i / GX * 2 - 1) * halfW, y = (j / gy * 2 - 1) * halfH;
      let h = 0;
      for (const c of creases) {
        const px = x - c.cx, py = y - c.cy, t = px * c.dx + py * c.dy, d = -px * c.dy + py * c.dx;
        let tent = c.w0 - Math.sqrt(d * d + eps * eps);
        tent = 0.5 * (tent + Math.sqrt(tent * tent + eps * eps));
        h += c.a * tent * Math.exp(-(t * t) / (c.T * c.T));
      }
      const ex = Math.max(0, Math.abs(x) / halfW - 0.86), ey = Math.max(0, Math.abs(y) / halfH - 0.86);
      h += P.edge * (ex * ex + ey * ey) * Math.min(halfW, halfH);
      f[j * (GX + 1) + i] = h;
    }
    return { f, gy };
  }
  function fillHeights(L, s) {
    const { f, gy } = heightField(L, s.seed);
    if (s.hGY !== gy) {
      if (s.hTex) gl.deleteTexture(s.hTex);
      s.hTex = texture(gl, { w: GX + 1, h: gy + 1, internal: gl.R16F, format: gl.RED, type: gl.FLOAT, filter: gl.LINEAR });
      s.hGY = gy;
    }
    gl.bindTexture(gl.TEXTURE_2D, s.hTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GX + 1, gy + 1, gl.RED, gl.FLOAT, f);
  }
  function makePaper(L, seed) {
    const r = mulberry32(seed ^ 0x5bd1e995);
    const ax = [r() - 0.5, r() - 0.5, (r() - 0.5) * 0.6]; const al = Math.hypot(...ax) || 1;
    const s = { seed, hTex: null, hGY: -1, crumple: 0, mx: 0, my: 0, angle: 0, axis: ax.map((v) => v / al), flipX: r() < 0.5 ? -1 : 1, flipY: r() < 0.5 ? -1 : 1, restJ: (r() - 0.5) * 2.4 };
    fillHeights(L, s);
    return s;
  }
  const freePaper = (s) => { if (s && s.hTex) gl.deleteTexture(s.hTex); };

  function build() {
    for (const L of letters) { freePaper(L.cur); freePaper(L.out); if (L.anim) freePaper(L.anim.incoming); }
    for (const b of balls) freePaper(b.s); balls = [];
    layout(); drawMask();
    for (const L of letters) { L.cur = makePaper(L, (rand() * 4294967296) >>> 0); L.out = null; L.anim = null; L.delay = -1; }
  }
  build();
  offs.push(ctx.on('resize', () => build()));

  // ---------- tapping a letter: crumple it, toss it aside, and unfold a new one ----------
  // The crumpled paper becomes a ball that stays on the page. Balls are small circles in the plane of the page: they roll
  // and spin (the orientation is a matrix handed to the paper's shader), push each other apart and bounce off each other
  // and off the edges of the page, and slow down until they stop.
  const ease = {
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    in: (t) => t * t * t,
    out: (t) => 1 - Math.pow(1 - t, 3),
  };
  const identity = () => new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const matMul = (a, b) => { const o = new Float32Array(9); for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2]; return o; };
  const rodrigues = (wx, wy, wz, dt) => {                                  // the rotation made by turning at (wx, wy, wz) for dt
    const w = Math.hypot(wx, wy, wz), a = w * dt; if (a < 1e-6) return identity();
    const x = wx / w, y = wy / w, z = wz / w, c = Math.cos(a), s2 = Math.sin(a), t = 1 - c;
    return new Float32Array([t * x * x + c, t * x * y + s2 * z, t * x * z - s2 * y, t * x * y - s2 * z, t * y * y + c, t * y * z + s2 * x, t * x * z + s2 * y, t * y * z - s2 * x, t * z * z + c]);
  };
  function toss(L) {
    if (L.anim) return;
    const a = rand() * Math.PI * 2;
    L.anim = { t: 0, dx: Math.cos(a), dy: Math.sin(a), spawned: false, incoming: null };
    L.out = L.cur;
    const n = L.anim.incoming = makePaper(L, (rand() * 4294967296) >>> 0);
    n.crumple = 1;
  }
  function spawnBall(L, an) {
    const s = L.out, r = P.ballSize * (L.half[0] + L.half[1]) * 0.5;
    const sp = P.toss * (0.7 + rand() * 0.6);
    const b = { L, s, x: L.center[0], y: L.center[1], vx: an.dx * sp, vy: an.dy * sp, z: 0.05, vz: Math.sqrt(2 * P.gravity * P.hop * (0.8 + rand() * 0.4)), r, m: r * r, hit: 0, R: identity(), wz: (rand() < 0.5 ? -1 : 1) * (3 + rand() * 5) };
    s.crumple = 1; s.mx = 0; s.my = 0; s.angle = 0;
    balls.push(b);
    while (balls.length > P.maxBalls) { freePaper(balls[0].s); balls.shift(); }
  }
  function stepAnim(L, dt) {
    const an = L.anim; an.t += dt;
    const tc = Math.max(0.05, P.crumpleTime), tu = Math.max(0.05, P.unfoldTime);
    const o = L.out, n = an.incoming;
    if (o) {
      o.crumple = ease.inOut(clamp(an.t / tc, 0, 1));
      if (an.t >= tc) { spawnBall(L, an); L.out = null; an.spawned = true; an.t0 = an.t; }
    }
    if (an.spawned) {                                                       // the new one unfolds in place once the old one has left
      const u = clamp((an.t - an.t0 - 0.12) / tu, 0, 1);
      n.crumple = 1 - ease.inOut(u);
      if (u >= 1) { L.cur = n; L.anim = null; }
    }
  }
  // Each ball is a little 3D body over the page: it is thrown up, falls, lands with a thud, hops again lower each time, and
  // only then rolls. Rolling is slowed by a steady rolling resistance as well as drag, so it settles like paper rather than
  // gliding like ice. Balls that touch while near the page trade momentum and spin, and kick each other up a little.
  function stepBalls(dt) {
    const sub = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / sub, drag = Math.exp(-P.drag * h);
    for (let it = 0; it < sub; it++) {
      for (const b of balls) {
        b.vz -= P.gravity * h; b.z += b.vz * h;
        if (b.z <= 0) {                                                       // landed
          b.z = 0;
          if (b.vz < -0.5) {                                                   // a real hit: lose most of the fall, lose some sideways speed, start it turning
            const f = Math.min(1, -b.vz / 3);
            b.vx *= 1 - 0.18 * f; b.vy *= 1 - 0.18 * f; b.wz += (rand() - 0.5) * 6 * f; b.hit = Math.max(b.hit, f);
          }
          b.vz = b.vz < -0.35 ? -b.vz * P.thud : 0;
        }
        const air = b.z > 0.002, g = air ? 0.995 : drag;                      // no drag from the page while in the air
        b.x += b.vx * h; b.y += b.vy * h; b.vx *= g; b.vy *= g; b.wz *= Math.exp(-(air ? 0.2 : 1.2) * h);
        if (!air) { const sp = Math.hypot(b.vx, b.vy); if (sp > 0) { const nsp = Math.max(0, sp - P.roll * h); b.vx *= nsp / sp; b.vy *= nsp / sp; } }
        const wall = (n, v, flip) => { b.vz = Math.max(b.vz, 0.4 + Math.abs(v) * 0.25); b.hit = Math.max(b.hit, 0.4); return flip * Math.abs(v) * P.bounce; };
        if (b.x < -bounds.x + b.r) { b.x = -bounds.x + b.r; b.vx = wall(0, b.vx, 1); } else if (b.x > bounds.x - b.r) { b.x = bounds.x - b.r; b.vx = wall(0, b.vx, -1); }
        if (b.y < bounds.bottom + b.r) { b.y = bounds.bottom + b.r; b.vy = wall(0, b.vy, 1); } else if (b.y > bounds.top - b.r) { b.y = bounds.top - b.r; b.vy = wall(0, b.vy, -1); }
        if (!air && Math.hypot(b.vx, b.vy) < 0.02) { b.vx = b.vy = 0; }
      }
      for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i], c = balls[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 1e-4, min = (a.r + c.r) * 0.92;
        if (d >= min || Math.abs(a.z - c.z) > Math.min(a.r, c.r) * 0.8) continue;
        const nx = dx / d, ny = dy / d, over = min - d, ma = a.m, mc = c.m;
        a.x -= nx * over * mc / (ma + mc); a.y -= ny * over * mc / (ma + mc); c.x += nx * over * ma / (ma + mc); c.y += ny * over * ma / (ma + mc);
        const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
        if (rv < 0) {
          const j2 = -(1 + P.bounce) * rv / (1 / ma + 1 / mc), tn = (ny * (c.vx - a.vx) - nx * (c.vy - a.vy)) * 0.4;
          a.vx -= nx * j2 / ma; a.vy -= ny * j2 / ma; c.vx += nx * j2 / mc; c.vy += ny * j2 / mc; a.wz += tn; c.wz -= tn;
          const kick = Math.min(1.6, -rv * 0.45); a.vz += kick * mc / (ma + mc); c.vz += kick * ma / (ma + mc); a.hit = c.hit = Math.max(a.hit, c.hit, Math.min(1, -rv / 2));
        }
      }
      for (const b of balls) {                                                     // each ball rolls as it moves, and spins
        const spd = Math.hypot(b.vx, b.vy);
        if (spd > 0.01 || Math.abs(b.wz) > 0.05) b.R = matMul(rodrigues(-b.vy / b.r, b.vx / b.r, b.wz, h), b.R);
        b.s.mx = b.x - b.L.center[0]; b.s.my = b.y - b.L.center[1]; b.s.lift = 0.18 + b.z;
        b.hit *= Math.exp(-6 * h);
      }
    }
  }

  let down = null;
  const letterAt = (p) => {
    const x = p.x * k, y = p.y * k; let best = null, bd = Infinity;
    for (const L of letters) { const d = Math.hypot((x - L.cx) / (L.hw * 1.1 + 4 * k), (y - L.cy) / (L.hh * 1.1 + 4 * k)); if (d < 1 && d < bd) { bd = d; best = L; } }
    return best;
  };
  offs.push(ctx.on('down', (p) => { down = { x: p.x, y: p.y, t: performance.now() }; }));
  offs.push(ctx.on('up', (p) => {
    if (down && Math.hypot(p.x - down.x, p.y - down.y) < 10 && performance.now() - down.t < 450) {
      const [wx, wy] = [(p.x * k - ctx.pw / 2) * 2 / ctx.ph, (ctx.ph / 2 - p.y * k) * 2 / ctx.ph];
      const hit = balls.slice().reverse().find((b) => Math.hypot(wx - b.x, wy - b.y) < b.r * 1.1);
      if (hit) { const dx = hit.x - wx, dy = hit.y - wy, d = Math.hypot(dx, dy) || 1; hit.vx += dx / d * P.toss * 1.2; hit.vy += dy / d * P.toss * 1.2; hit.vz += Math.sqrt(2 * P.gravity * P.hop * 0.5); hit.wz += (rand() - 0.5) * 8; }   // knock a ball
      else { const L = letterAt(p); if (L) toss(L); }
    }
    down = null;
  }));

  // ---------- settings ----------
  let dirty = null;
  const R = (key, label, min, max, step) => ({ key, label, min, max, step });
  const HEIGHT_KEYS = new Set(['creases', 'reach', 'width', 'softness', 'align', 'bow', 'edge']);
  const LAYOUT_KEYS = new Set(['density', 'typeSize', 'margin']);
  const tune = {
    title: 'Fold',
    values: P, defaults: DEFAULTS,
    groups: [
      { name: 'Folds', items: [R('relief', 'Relief (how deep the folds are)', 0, 4, 0.05), R('restFrame', 'Fold depth (frame)', 13, 30, 0.25), R('extra', 'Extra creases', 0, 2, 0.05), R('creases', 'Extra: count', 0, 24, 1), R('reach', 'Crease length', 0.3, 2.2, 0.05), R('width', 'Crease width', 0.3, 2.2, 0.05), R('softness', 'Crease softness', 0.004, 0.06, 0.002), R('align', 'Fold scatter', 0, 1, 0.05), R('edge', 'Edge lift', 0, 1.5, 0.05)] },
      { name: 'Letters', items: [R('typeSize', 'Type size', 0.5, 1.2, 0.02), R('margin', 'Margin', 0.02, 0.2, 0.005), R('density', 'Points (thousands)', 40, 400, 10)] },
      { name: 'Look', items: [{ key: 'shadows', label: 'Shadows and shading', type: 'toggle' }, R('bgL', 'Background (0 black, 1 white)', 0, 1, 0.05), R('paperL', 'Paper', 0, 1, 0.05), R('shading', 'Shading', 0, 2, 0.05), R('ao', 'Crease shadow', 0, 1.5, 0.05), R('shadowSoft', 'Shadow edge (0 hard, 1 soft)', 0, 1, 0.01), R('shadowLevels', 'Shadow tones', 1, 6, 1), R('shadowCut', 'Shadow starts at (darkness)', 0.01, 0.5, 0.01), R('shadowDepth', 'Shadow depth', 0.1, 0.9, 0.01)] },
      { name: 'View', items: [R('yaw', 'Tilt sideways', 0, 1.2, 0.02), R('pitch', 'Tilt up and down', 0, 1, 0.02), R('damping', 'Follow speed', 3, 30, 1), R('sway', 'Opening sway', 0, 1, 0.02)] },
      { name: 'Crumple', items: [R('crumpleTime', 'Crumple time (s)', 0.2, 2, 0.05), R('unfoldTime', 'Unfold time (s)', 0.2, 2.5, 0.05)] },
      { name: 'Balls', items: [R('ballSize', 'Ball size', 0.15, 0.9, 0.01), R('toss', 'Toss speed', 0, 6, 0.1), R('bounce', 'Bounce', 0, 1, 0.01), R('drag', 'Drag (how soon they stop)', 0.1, 4, 0.05), R('maxBalls', 'Most balls kept', 4, 60, 1), R('hop', 'Throw height', 0.05, 0.8, 0.01), R('gravity', 'Gravity', 4, 30, 0.5), R('thud', 'Landing bounce', 0, 0.8, 0.01), R('roll', 'Rolling resistance', 0, 1.5, 0.01)] },
    ],
    actions: {
      'New folds': () => { for (const L of letters) { L.cur.seed = (rand() * 4294967296) >>> 0; fillHeights(L, L.cur); } },
      'Crumple all': () => { letters.forEach((L, i) => { L.delay = i * 0.09; }); },
      'Sweep up': () => { for (const b of balls) freePaper(b.s); balls = []; },
    },
    set(key, value) {
      P[key] = value;
      if (HEIGHT_KEYS.has(key)) dirty = dirty || 'heights';
      if (LAYOUT_KEYS.has(key)) dirty = 'layout';
      if (key === 'bgL') ctx.setBackdrop(P.bgL);
    },
    reset() { Object.assign(P, DEFAULTS); dirty = 'layout'; ctx.setBackdrop(P.bgL); },
  };
  ctx.setBackdrop(P.bgL);

  // ---------- frame ----------
  const rot = new Float32Array(9), ang = { x: 0, y: 0 }, spin = new Float32Array(9);
  function drawPaper(L, s) {
    const u = prog.u, rf = clamp(P.restFrame + s.restJ, 12, 30);
    gl.uniform3f(u.uMove, s.mx, s.my, 0);
    gl.uniform1f(u.uLift, s.lift != null ? s.lift : 0.18 * s.crumple);
    gl.uniform1f(u.uCrumple, s.crumple);
    gl.uniform1f(u.uRestFrame, rf);
    gl.uniform1f(u.uFrame, rf + s.crumple * (FRAMES - 1 - rf));
    gl.uniform2f(u.uFlip, s.flipX, s.flipY);
    gl.uniformMatrix3fv(u.uSpin, false, s.R || spinMat(s.axis, s.angle, spin));
    gl.uniform2f(u.uGrid, L.nx, L.ny);
    gl.uniform2f(u.uSheetHalf, L.half[0], L.half[1]);
    gl.uniform2f(u.uCenter, L.center[0], L.center[1]);
    gl.uniform1f(u.uChan, L.chan);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.hTex); gl.uniform1i(u.uHeight, 0);
    gl.drawArrays(gl.POINTS, 0, L.nx * L.ny);
  }
  offs.push(ctx.frame((dt, t) => {
    if (dirty === 'layout') { build(); dirty = null; }
    else if (dirty === 'heights') { for (const L of letters) for (const s of [L.cur, L.out, L.anim && L.anim.incoming]) if (s) fillHeights(L, s); dirty = null; }
    for (const L of letters) {
      if (L.delay >= 0 && (L.delay -= dt) < 0) { L.delay = -1; toss(L); }
      if (L.anim) stepAnim(L, dt);
    }
    stepBalls(Math.min(dt, 0.05));

    const nudge = ctx.reduced ? 0 : P.sway * Math.sin(t * 2.7) * Math.exp(-t * 1.5);
    const tx = ctx.look.x * P.yaw + nudge, ty = -ctx.look.y * P.pitch + nudge * 0.4;
    const kk = Math.min(1, dt * P.damping);
    ang.x += (tx - ang.x) * kk; ang.y += (ty - ang.y) * kk;
    const cy = Math.cos(ang.x), sy = Math.sin(ang.x), cp = Math.cos(ang.y), sp = Math.sin(ang.y);
    rot[0] = cy; rot[1] = 0; rot[2] = -sy; rot[3] = sy * sp; rot[4] = cp; rot[5] = cy * sp; rot[6] = sy * cp; rot[7] = -sp; rot[8] = cy * cp;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, ctx.pw, ctx.ph);
    gl.clearColor(P.bgL, P.bgL, P.bgL, 1); gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
    prog.use(); const u = prog.u;
    gl.uniformMatrix3fv(u.uRot, false, rot);
    gl.uniform1f(u.uA, A);
    gl.uniform1f(u.uSize, sizePx);
    gl.uniform1f(u.uShade, P.shading);
    gl.uniform1f(u.uAmp, P.relief);
    gl.uniform1f(u.uExtra, P.extra);
    gl.uniform1f(u.uAO, P.ao);
    gl.uniform1f(u.uReveal, clamp(Math.hypot(ang.x, ang.y) / 0.22, 0, 1));
    gl.uniform2f(u.uRes, ctx.pw, ctx.ph);
    gl.uniform2f(u.uCos, Math.max(0.35, Math.cos(ang.x)), Math.max(0.35, Math.cos(ang.y)));
    gl.uniform3f(u.uPaper, P.paperL, P.paperL, P.paperL);
    gl.uniform1f(u.uShadows, P.shadows ? 1 : 0);
    gl.uniform1f(u.uSoft, P.shadowSoft); gl.uniform1f(u.uLevels, Math.max(1, Math.round(P.shadowLevels))); gl.uniform1f(u.uCut, P.shadowCut); gl.uniform1f(u.uDepth, P.shadowDepth);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskTex); gl.uniform1i(u.uMask, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D_ARRAY, vat.d); gl.uniform1i(u.uVatD, 2);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D_ARRAY, vat.n); gl.uniform1i(u.uVatN, 3);
    for (const L of letters) {
      if (L.out) drawPaper(L, L.out);                                         // crumpling, before it becomes a ball
      else if (L.anim && !L.anim.spawned) continue;
      else drawPaper(L, L.anim ? L.anim.incoming : L.cur);
    }
    if (balls.length) {                                                         // shadows of the balls on whatever is under them
      const sd = new Float32Array(balls.length * 3), px = new Float32Array(balls.length);
      balls.forEach((b, i) => { const lift = 0.04 + b.z * 0.9; sd[i * 3] = b.x + 0.03 + b.z * 0.22; sd[i * 3 + 1] = b.y - 0.025 - b.z * 0.18; sd[i * 3 + 2] = 0.035; px[i] = b.r * (0.95 + b.z * 0.5) * ctx.ph * (1 + 0 * lift); });
      shadowProg.use(); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.uniformMatrix3fv(shadowProg.u.uRot, false, rot); gl.uniform1f(shadowProg.u.uA, A); gl.uniform1f(shadowProg.u.uAlpha, 0.8);
      gl.bindBuffer(gl.ARRAY_BUFFER, shadowBuf);
      for (let i = 0; i < balls.length; i++) {
        gl.bufferData(gl.ARRAY_BUFFER, sd.subarray(i * 3, i * 3 + 3), gl.DYNAMIC_DRAW);
        const loc = gl.getAttribLocation(shadowProg.p, 'aP');
        gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
        gl.uniform1f(shadowProg.u.uPx, px[i]); gl.drawArrays(gl.POINTS, 0, 1);
        gl.disableVertexAttribArray(loc);
      }
      gl.depthMask(true); gl.disable(gl.BLEND); prog.use();
    }
    for (const b of balls) drawPaper(b.L, b.s);                                // the balls, on top
  }));

  return {
    tune,
    debug: { balls: () => balls, bounds: () => bounds, toss: (i) => toss(letters[i]), letters: () => letters, pointCount: () => letters.reduce((a, L) => a + L.nx * L.ny, 0) },
    destroy() { offs.forEach((off) => off()); ctx.setBackdrop(null); },
  };
}
