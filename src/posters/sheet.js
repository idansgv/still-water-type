// Sheet. A flat poster that is not: the type is projected onto a lightly wrinkled sheet of paper.
//
// Head-on, the camera sits exactly where the projector is, so the type lands as a perfectly flat, crisp
// print and the paper shows no relief at all. Tilt the view (cursor, finger, or a phone) and the same
// type, still projected from where you started, slides across the folds: the wrinkles appear as warps
// in the lettering and a trace of shading, and the sheet's own edge curls.
//
// Click and the sheet crumples, is thrown off the screen, and a new one (new folds, new line) slides in.
//
// Under the graphic: the paper is a cloud of GPU point sprites laid out from gl_VertexID. Its shape is a real
// cloth simulation (Houdini Vellum, baked by Toi Nagasawa as a Vertex Animation Texture; MIT, see
// data/crumple.LICENSE.txt): the resting wrinkles are an early frame of the paper buckling, and the crumple
// is that simulation played forward (and back, when a new sheet unfolds). Method after the Codrops article
// "Building an Interactive Crumpled Paper Effect with Houdini VAT and Three.js". The idea of a flat image that
// is secretly a point cloud revealed by camera movement follows cullenwebber/three-ml-sharp.

import { getGL, compile, texture, uploadCanvas, mulberry32, clamp } from '../engine.js';

const D = 3.2;   // camera distance, also the projector's

const PHRASES = [
  'Nothing to see here.',
  'Still flat.',
  'Look again.',
  'Handle with care.',
  'Version 7. Final.',
  'Please do not fold.',
  'Draft.',
  'Not a poster.',
].join('\n');

const FONT = '"Archivo", "Arial Black", "Helvetica Neue", sans-serif';

export async function mount(ctx) {
  const { canvas } = ctx;
  const gl = getGL(canvas, { depth: true });
  if (!gl) throw new Error('webgl2 unavailable');
  ctx.adaptive = true;
  const offs = [];
  const rand = ctx.rand;

  // ---------- settings ----------
  const tuning = new URLSearchParams(location.search).has('tune');
  const KEY = 'swt:tune:sheet';
  const DEFAULTS = {
    relief: 0, restFrame: 21, extra: 1.2, creases: 11, reach: 1.45, width: 0.75, softness: 0.004, align: 0.45, bow: 0, edge: 0.5,
    size: 0.91, density: ctx.W < 600 ? 170 : 210,
    shadows: 0, bgL: 0.95, paperL: 1, inkL: 0,
    shading: 0, ao: 0, yaw: 0.22, pitch: 0.16, damping: 19, sway: 0.28,
    typeSize: 1, margin: 0.075, phrases: ['Nothing to see here.', 'Version 7. Final.', 'Draft.', 'Not a poster.'].join('\n'),
    crumpleTime: 0.8, exitTime: 0.7, unfoldTime: 0.9,
  };

  const P = { ...DEFAULTS };
  if (tuning) { try { Object.assign(P, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* none */ } }

  // ---------- shaders ----------
  const VS = `#version 300 es
  precision highp float;
  precision highp sampler2DArray;
  uniform sampler2D uHeight;
  uniform sampler2DArray uVatD, uVatN;
  uniform vec2 uGrid, uSheetHalf, uCenter, uFlip;
  uniform mat3 uRot, uSpin;
  uniform vec3 uMove;               // slide x, y and spin (unused z)
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
    vec2 uvg = (fid - 0.5 + jit * 0.7) / (uGrid - 2.0);          // one extra ring: the fragment test trims the edge
    vec2 xyLoc = vec2(uvg.x * 2.0 - 1.0, 1.0 - uvg.y * 2.0) * uSheetHalf;
    vec2 hu = clamp(vec2(uvg.x, 1.0 - uvg.y), 0.0, 1.0);
    vec2 tc = vatUV(hu);
    float sheetH = 2.0 * uSheetHalf.y;

    // a little extra, hand-made wrinkling on top of the simulation, so no two sheets match
    float e = 0.004;
    float fibre = sin(uvg.x * 913.1 + uvg.y * 227.7) * sin(uvg.y * 611.3 - uvg.x * 331.9) * 0.0012;
    float calm = 1.0 - smoothstep(0.0, 0.15, uCrumple);
    float hExtra = (texture(uHeight, hu).r * uExtra + fibre) * uAmp * calm;
    float hx = (texture(uHeight, hu + vec2(e, 0.0)).r - texture(uHeight, hu - vec2(e, 0.0)).r) / (2.0 * e * 2.0 * uSheetHalf.x);
    float hy = (texture(uHeight, hu + vec2(0.0, e)).r - texture(uHeight, hu - vec2(0.0, e)).r) / (2.0 * e * 2.0 * uSheetHalf.y);

    // where the projector sees this point: the resting pose
    vec3 dR = vatDisp(tc, uRestFrame) * sheetH;
    vec3 P0 = vec3(xyLoc + uCenter, dR.z * uAmp + hExtra);          // the outline at rest stays a clean rectangle

    // where it is now: the simulation at the current frame
    vec3 d = vatDisp(tc, uFrame) * sheetH;
    vec3 L = vec3(xyLoc + (d.xy - dR.xy), d.z * mix(uAmp, 1.0, uCrumple) + hExtra);   // sideways motion measured from the resting pose
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

    // the type is glued to the paper: it comes from where the projector sees the resting point
    vec2 tex = P0.xy * ${D.toFixed(2)} / (${D.toFixed(2)} - P0.z);
    vTex = (tex / vec2(uA, 1.0)) * 0.5 + 0.5;
    vSheet = xyLoc;

    vec3 vNow = normalize(uRot * vec3(0.0, 0.0, ${D.toFixed(2)}) - P);
    vec3 vRest = normalize(vec3(0.0, 0.0, ${D.toFixed(2)}) - P0);
    float delta = (dot(n, vNow) - dot(n, vRest)) * uShade;       // zero at rest, grows as the view moves
    float blend = smoothstep(0.0, 0.25, uCrumple);
    float light = 0.42 + 0.58 * abs(dot(n, normalize(vec3(0.35, 0.55, 1.0))));
    vShade = uShadows > 0.5 ? mix(delta, light - 1.0, blend) : 0.0;
    vAO = uShadows > 0.5 ? 1.0 - uAO * nn.w * max(uReveal, blend) : 1.0;   // creases darken once the view moves, or the paper balls up
  }`;
  const FS = `#version 300 es
  precision highp float;
  in vec2 vTex;
  in vec2 vSheet;
  in float vShade;
  in float vAO;
  uniform sampler2D uMask;
  uniform vec2 uRes, uSheetHalf, uCos;
  uniform float uSize;
  uniform vec3 uPaper, uInk;
  out vec4 o;
  void main() {
    vec2 pc = gl_PointCoord - 0.5;
    // each fragment looks up the type a little way off its point, so edges stay crisp between points
    vec2 off = vec2(pc.x, -pc.y) * uSize * (2.0 / uRes.y) / uCos;     // a tilted sheet covers more of itself per pixel
    vec2 sh = vSheet + off;
    if (abs(sh.x) > uSheetHalf.x || abs(sh.y) > uSheetHalf.y) discard;   // the sheet's own edge
    vec2 uvt = vTex + vec2(off.x * uRes.y / uRes.x, off.y) * 0.5;
    float ink = smoothstep(0.42, 0.58, texture(uMask, uvt).r);
    float paper = clamp((1.0 + vShade) * vAO, 0.14, 1.0);
    o = vec4(mix(uPaper * paper, uInk, ink), 1.0);
  }`;

  const prog = compile(gl, VS, FS);
  gl.bindVertexArray(gl.createVertexArray());   // no attributes: every point comes from gl_VertexID

  // ---------- the baked simulation (see tools/vat-extract.mjs) ----------
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
    const dispH = new Uint16Array(n * 4);                                   // zeros: a flat sheet, if the data cannot load
    const nrmU = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) { nrmU[i * 4] = 128; nrmU[i * 4 + 1] = 128; nrmU[i * 4 + 2] = 255; }
    try {
      const res = await fetch(new URL('./data/crumple.bin', import.meta.url));
      if (!res.ok) throw new Error(`crumple.bin: ${res.status}`);
      const buf = await res.arrayBuffer();
      if (new DataView(buf).getUint32(0, true) !== 0x504d5243) throw new Error('crumple.bin: bad header');
      const d16 = new Int16Array(buf, 16, n * 3), nr = new Uint8Array(buf, 16 + n * 6, n * 4);
      for (let i = 0; i < n; i++) {
        dispH[i * 4] = half(d16[i * 3] / 16384); dispH[i * 4 + 1] = half(d16[i * 3 + 1] / 16384); dispH[i * 4 + 2] = half(d16[i * 3 + 2] / 16384);
      }
      nrmU.set(nr);
    } catch (e) { console.warn('[sheet] crumple data unavailable, using a flat sheet', e); }
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

  // ---------- layout ----------
  let A = 1, sheetHalf = [0.4, 0.55], center = [0, 0], nx = 2, ny = 2, sizePx = 4, geom = null;
  function layout() {
    const W = ctx.pw, H = ctx.ph, k = W / ctx.W;
    A = W / H;
    const chrome = document.querySelector('.chrome');
    const reserve = (((chrome && chrome.offsetHeight) || 56) + 20) * k;
    const usable = H - reserve;
    const ratio = 1 / 1.414;                                    // A4
    let sh = Math.min(usable, H) * P.size, sw = sh * ratio;
    if (sw > W * 0.96 * P.size) { sw = W * 0.96 * P.size; sh = sw / ratio; }
    const cx = W / 2, cy = usable / 2 + H * 0.01;
    const px2w = 2 / H;
    sheetHalf = [sw * 0.5 * px2w, sh * 0.5 * px2w];
    center = [(cx - W / 2) * px2w, (H / 2 - cy) * px2w];
    const spacing = Math.max(1.4 * k, Math.sqrt((sw * sh) / (P.density * 1000)));
    sizePx = spacing * 1.9;
    nx = Math.ceil(sw / spacing) + 2; ny = Math.ceil(sh / spacing) + 2;
    geom = { sw, sh, cx, cy, W, H };
  }

  // ---------- one sheet of paper ----------
  const GX = 200;
  const GY = () => Math.max(80, Math.round(GX * sheetHalf[1] / sheetHalf[0]));
  function heightField(seed) {
    const r = mulberry32(seed);
    const [halfW, halfH] = sheetHalf;
    const gy = GY();
    const base = r() * Math.PI;
    const creases = [];
    for (let i = 0; i < Math.round(P.creases); i++) {
      const long = i < 3;
      const ang = base + (r() - 0.5) * (i % 3 === 0 ? 2.4 : 0.9) * (0.2 + 1.6 * P.align) + (r() < 0.3 ? Math.PI / 2 : 0) * P.align;
      creases.push({
        cx: (r() * 2 - 1) * halfW, cy: (r() * 2 - 1) * halfH,
        dx: Math.cos(ang), dy: Math.sin(ang),
        a: (r() < 0.5 ? -1 : 1) * (0.07 + r() * 0.15),
        w0: (0.07 + r() * 0.22) * P.width,
        T: (long ? 0.7 + r() * 0.5 : 0.22 + r() * 0.35) * P.reach,
      });
    }
    const eps = P.softness;
    const bowX = (r() - 0.5) * P.bow, bowY = (r() - 0.5) * P.bow;
    const f = new Float32Array((GX + 1) * (gy + 1));
    for (let j = 0; j <= gy; j++) {
      for (let i = 0; i <= GX; i++) {
        const x = (i / GX * 2 - 1) * halfW, y = (j / gy * 2 - 1) * halfH;
        let h = bowX * Math.cos(Math.PI * 0.5 * x / halfW) + bowY * Math.cos(Math.PI * 0.5 * y / halfH);
        for (const c of creases) {
          const px = x - c.cx, py = y - c.cy;
          const t = px * c.dx + py * c.dy, d = -px * c.dy + py * c.dx;
          let tent = c.w0 - Math.sqrt(d * d + eps * eps);
          tent = 0.5 * (tent + Math.sqrt(tent * tent + eps * eps));
          h += c.a * tent * Math.exp(-(t * t) / (c.T * c.T));
        }
        const ex = Math.max(0, Math.abs(x) / halfW - 0.86), ey = Math.max(0, Math.abs(y) / halfH - 0.86);
        h += P.edge * (ex * ex + ey * ey);
        f[j * (GX + 1) + i] = h;
      }
    }
    return { f, gy };
  }

  // wrap a phrase into lines at the largest size that fits the sheet's inner box
  function typeset(g, phrase, boxW, boxH) {
    const words = phrase.split(/\s+/).filter(Boolean);
    let size = boxH * 0.34 * P.typeSize, lines = [];
    for (let i = 0; i < 60; i++) {
      g.font = `900 ${size}px ${FONT}`;
      lines = []; let cur = '';
      for (const w of words) {
        const t = cur ? cur + ' ' + w : w;
        if (cur && g.measureText(t).width > boxW) { lines.push(cur); cur = w; } else cur = t;
      }
      if (cur) lines.push(cur);
      const widest = Math.max(...lines.map((l) => g.measureText(l).width));
      if (widest <= boxW && lines.length * size * 0.9 <= boxH * 0.62) break;
      size *= 0.94;
    }
    return { lines, size };
  }

  function drawMask(sheet) {
    const { sw, sh, cx, cy, W, H } = geom;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    const pad = sw * P.margin;
    const { lines, size } = typeset(g, sheet.phrase, sw - pad * 2, sh - pad * 2);
    g.font = `900 ${size}px ${FONT}`;
    const cap = g.measureText('H').actualBoundingBoxAscent || size * 0.72;
    const left = cx - sw / 2 + pad, top = cy - sh / 2 + pad;
    lines.forEach((l, i) => {
      const m = g.measureText(l);
      g.fillText(l, left + m.actualBoundingBoxLeft, top + cap + i * cap * 1.06);
    });
    uploadCanvas(gl, sheet.mask, c);
  }

  function fillHeights(sheet) {
    const { f, gy } = heightField(sheet.seed);
    if (sheet.hGY !== gy) {
      if (sheet.hTex) gl.deleteTexture(sheet.hTex);
      sheet.hTex = texture(gl, { w: GX + 1, h: gy + 1, internal: gl.R16F, format: gl.RED, type: gl.FLOAT, filter: gl.LINEAR });
      sheet.hGY = gy;
    }
    gl.bindTexture(gl.TEXTURE_2D, sheet.hTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GX + 1, gy + 1, gl.RED, gl.FLOAT, f);
  }

  let phraseBag = [], lastPhrase = '';
  function nextPhrase(first) {
    const all = P.phrases.split('\n').map((x) => x.trim()).filter(Boolean);
    if (!all.length) return 'Nothing to see here.';
    let pick;
    if (first) pick = all[0];
    else {
      if (!phraseBag.length) phraseBag = all.map((_, i) => i).sort(() => rand() - 0.5);
      pick = all[phraseBag.pop() % all.length];
      if (all.length > 1 && pick === lastPhrase) pick = all[(all.indexOf(pick) + 1) % all.length];   // never the same line twice running
    }
    lastPhrase = pick;
    return pick;
  }

  function makeSheet(seed, phrase) {
    const r = mulberry32(seed ^ 0x5bd1e995);
    const ax = [r() - 0.5, r() - 0.5, (r() - 0.5) * 0.6]; const al = Math.hypot(...ax) || 1;
    const s = {
      seed, phrase, mask: texture(gl, { w: 1, h: 1 }), hTex: null, hGY: -1,
      crumple: 0, mx: 0, my: 0, angle: 0, axis: ax.map((v) => v / al),
      flipX: r() < 0.5 ? -1 : 1, flipY: r() < 0.5 ? -1 : 1, restJ: (r() - 0.5) * 2.4,
    };
    fillHeights(s); drawMask(s);
    return s;
  }
  function freeSheet(s) { gl.deleteTexture(s.mask); if (s.hTex) gl.deleteTexture(s.hTex); }

  layout();
  let current = makeSheet(ctx.seed, nextPhrase(true));
  let outgoing = null;
  let anim = null;                                                // { t, dx, dy, spin, incoming }
  const relayoutAll = () => { for (const s of [current, outgoing, anim && anim.incoming]) if (s) { fillHeights(s); drawMask(s); } };
  offs.push(ctx.on('resize', () => { layout(); relayoutAll(); }));

  let dirtyHeights = false, dirtyLayout = false;

  // ---------- the click: crumple, throw, replace ----------
  const ease = {
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    in: (t) => t * t * t,
    out: (t) => 1 - Math.pow(1 - t, 3),
  };
  function toss() {
    if (anim) return;
    const a = rand() * Math.PI * 2;
    anim = { t: 0, dx: Math.cos(a), dy: Math.sin(a), w: (rand() < 0.5 ? -1 : 1) * (4 + rand() * 4), incoming: null };
    outgoing = current;
    const n = anim.incoming = makeSheet((rand() * 4294967296) >>> 0, nextPhrase(false));
    n.crumple = 1; n.mx = -anim.dx * 9; n.my = -anim.dy * 9;           // arrives as a ball, parked off screen until its turn
  }
  const reach = () => Math.max(A, 1) + 1.2;                      // far enough to be off screen
  function stepAnim(dt) {
    anim.t += dt;
    const tc = Math.max(0.05, P.crumpleTime), te = Math.max(0.05, P.exitTime), tu = Math.max(0.05, P.unfoldTime);
    const o = outgoing, n = anim.incoming;
    // the old sheet crumples (the baked simulation, played forward), then is thrown
    o.crumple = ease.inOut(clamp(anim.t / tc, 0, 1));
    const tt = Math.max(0, anim.t - tc * 0.85);
    const ex = clamp(tt / te, 0, 1), e = ease.in(ex) * reach();
    o.mx = anim.dx * e; o.my = anim.dy * e; o.angle = anim.w * tt;
    // the new one comes in as a ball from the other side, tumbling to a stop, and unfolds as it lands
    const tin = anim.t - tc * 0.9, tf = te * 1.15;
    const f = clamp(tin / tf, 0, 1), ie = (1 - ease.out(f)) * reach();
    n.mx = -anim.dx * ie; n.my = -anim.dy * ie; n.angle = anim.w * (1 - ease.out(f)) * 0.9;
    const u = clamp((tin - tf * 0.72) / tu, 0, 1);
    n.crumple = 1 - ease.inOut(u);
    if (anim.t > tc * 0.85 + te && u >= 1) {
      freeSheet(outgoing); outgoing = null; n.angle = 0; current = n; anim = null;
    }
  }

  let down = null;
  offs.push(ctx.on('down', (p) => { down = { x: p.x, y: p.y, t: performance.now() }; }));
  offs.push(ctx.on('up', (p) => {
    if (down && Math.hypot(p.x - down.x, p.y - down.y) < 10 && performance.now() - down.t < 450) toss();
    down = null;
  }));

  // ---------- tuning panel ----------
  const save = () => { if (tuning) { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* ignore */ } } };
  const R = (key, label, min, max, step) => ({ key, label, min, max, step });
  const HEIGHT_KEYS = new Set(['creases', 'reach', 'width', 'softness', 'align', 'bow', 'edge']);   // the hand-made extras
  const LAYOUT_KEYS = new Set(['size', 'density', 'typeSize', 'margin']);
  const tune = {
    title: 'Sheet',
    values: P,
    defaults: DEFAULTS,
    groups: [
      { name: 'Paper', items: [
        R('relief', 'Relief', 0, 4, 0.05), R('restFrame', 'Wrinkle depth (frame)', 13, 30, 0.25), R('extra', 'Extra creases', 0, 2, 0.05),
        R('creases', 'Extra: count', 0, 24, 1), R('reach', 'Crease length', 0.3, 2.2, 0.05),
        R('width', 'Crease width', 0.3, 2.2, 0.05), R('softness', 'Crease softness', 0.004, 0.06, 0.002),
        R('align', 'Fold scatter', 0, 1, 0.05), R('bow', 'Bow', 0, 0.15, 0.005), R('edge', 'Edge lift', 0, 1.5, 0.05)] },
      { name: 'Sheet', items: [R('size', 'Sheet size', 0.5, 1, 0.01), R('density', 'Points (thousands)', 40, 400, 10)] },
      { name: 'Look', items: [
        { key: 'shadows', label: 'Shadows and shading', type: 'toggle' },
        R('bgL', 'Background (0 black, 1 white)', 0, 1, 0.05), R('paperL', 'Paper', 0, 1, 0.05), R('inkL', 'Type', 0, 1, 0.05)] },
      { name: 'View', items: [
        R('shading', 'Shading', 0, 2, 0.05), R('ao', 'Crease shadow', 0, 1.5, 0.05), R('yaw', 'Tilt sideways', 0, 1.2, 0.02), R('pitch', 'Tilt up and down', 0, 1, 0.02),
        R('damping', 'Follow speed', 3, 30, 1), R('sway', 'Opening sway', 0, 1, 0.02)] },
      { name: 'Type', items: [
        { key: 'phrases', label: 'Lines, one per sheet', type: 'text', rows: 6 },
        R('typeSize', 'Type size', 0.5, 1.4, 0.02), R('margin', 'Margin', 0.02, 0.2, 0.005)] },
      { name: 'Crumple', items: [
        R('crumpleTime', 'Crumple time (s)', 0.2, 2, 0.05), R('exitTime', 'Throw time (s)', 0.2, 2, 0.05),
        R('unfoldTime', 'Unfold time (s)', 0.2, 2.5, 0.05)] },
    ],
    actions: {
      'New paper': () => {
        current.seed = (rand() * 4294967296) >>> 0; current.flipX = rand() < 0.5 ? -1 : 1; current.flipY = rand() < 0.5 ? -1 : 1;
        current.restJ = (rand() - 0.5) * 2.4; fillHeights(current);
      },
      'Crumple now': () => toss(),
    },
    set(key, value) {
      P[key] = value;
      if (HEIGHT_KEYS.has(key)) dirtyHeights = true;
      if (LAYOUT_KEYS.has(key)) dirtyLayout = true;
      if (key === 'phrases') phraseBag = [];
      if (key === 'bgL') ctx.setBackdrop(P.bgL);
      save();
    },
    reset() { Object.assign(P, DEFAULTS); dirtyHeights = dirtyLayout = true; phraseBag = []; ctx.setBackdrop(P.bgL); save(); },
  };

  ctx.setBackdrop(P.bgL);

  // ---------- frame ----------
  const rot = new Float32Array(9);
  const ang = { x: 0, y: 0 };
  const spin = new Float32Array(9);
  function drawSheet(s) {
    const u = prog.u;
    const rf = clamp(P.restFrame + s.restJ, 12, 30);
    gl.uniform3f(u.uMove, s.mx, s.my, 0);
    gl.uniform1f(u.uLift, 0.18 * s.crumple);
    gl.uniform1f(u.uCrumple, s.crumple);
    gl.uniform1f(u.uRestFrame, rf);
    gl.uniform1f(u.uFrame, rf + s.crumple * (FRAMES - 1 - rf));
    gl.uniform2f(u.uFlip, s.flipX, s.flipY);
    gl.uniformMatrix3fv(u.uSpin, false, spinMat(s.axis, s.angle, spin));
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.hTex); gl.uniform1i(u.uHeight, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, s.mask); gl.uniform1i(u.uMask, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D_ARRAY, vat.d); gl.uniform1i(u.uVatD, 2);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D_ARRAY, vat.n); gl.uniform1i(u.uVatN, 3);
    gl.drawArrays(gl.POINTS, 0, nx * ny);
  }
  offs.push(ctx.frame((dt, t) => {
    if (dirtyLayout) { layout(); relayoutAll(); dirtyLayout = dirtyHeights = false; }
    else if (dirtyHeights) { for (const s of [current, outgoing, anim && anim.incoming]) if (s) fillHeights(s); dirtyHeights = false; }
    if (anim) stepAnim(dt);

    // one slow sway at the start, so a flat sheet admits that it is not
    const nudge = ctx.reduced ? 0 : P.sway * Math.sin(t * 2.7) * Math.exp(-t * 1.5);
    const tx = ctx.look.x * P.yaw + nudge, ty = -ctx.look.y * P.pitch + nudge * 0.4;
    const k = Math.min(1, dt * P.damping);
    ang.x += (tx - ang.x) * k; ang.y += (ty - ang.y) * k;
    const cy = Math.cos(ang.x), sy = Math.sin(ang.x), cp = Math.cos(ang.y), sp = Math.sin(ang.y);
    rot[0] = cy;      rot[1] = 0;   rot[2] = -sy;
    rot[3] = sy * sp; rot[4] = cp;  rot[5] = cy * sp;
    rot[6] = sy * cp; rot[7] = -sp; rot[8] = cy * cp;

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
    gl.uniform2f(u.uGrid, nx, ny);
    gl.uniform2f(u.uRes, ctx.pw, ctx.ph);
    gl.uniform2f(u.uSheetHalf, sheetHalf[0], sheetHalf[1]);
    gl.uniform2f(u.uCenter, center[0], center[1]);
    gl.uniform2f(u.uCos, Math.max(0.35, Math.cos(ang.x)), Math.max(0.35, Math.cos(ang.y)));
    gl.uniform3f(u.uPaper, P.paperL, P.paperL, P.paperL);
    gl.uniform3f(u.uInk, P.inkL, P.inkL, P.inkL);
    gl.uniform1f(u.uShadows, P.shadows ? 1 : 0);
    if (outgoing) drawSheet(outgoing);
    drawSheet(anim ? anim.incoming : current);
  }));

  return {
    tune,
    debug: { toss, get sheet() { return current; }, get anim() { return anim; }, get count() { return nx * ny; } },
    destroy() { offs.forEach((off) => off()); ctx.setBackdrop(null); },
  };
}
