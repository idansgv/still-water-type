// Sheet. A flat poster that is not: the type is projected onto a lightly wrinkled sheet of paper.
//
// Head-on, the camera sits exactly where the projector is, so the type lands as a perfectly flat, crisp
// print and the paper shows no relief at all. Tilt the view (cursor, finger, or a phone) and the same
// type, still projected from where you started, slides across the folds: the wrinkles appear as warps
// in the lettering and a trace of shading, and the sheet's own edge curls.
//
// Click and the sheet crumples, is thrown off the screen, and a new one (new folds, new line) slides in.
//
// Under the graphic: the paper is a cloud of GPU point sprites laid out from gl_VertexID; heights come from
// a small texture, so a new sheet or a changed setting costs almost nothing. The idea, a flat image that is
// secretly a cloud of points revealed by camera movement, follows cullenwebber/three-ml-sharp; the code is
// independent and the paper is procedural.

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

export function mount(ctx) {
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
    relief: 1.1, creases: 11, reach: 1, width: 1, softness: 0.012, align: 0.5, bow: 0.05, edge: 0.5,
    size: 0.92, density: ctx.W < 600 ? 170 : 250,
    shading: 0.85, yaw: 0.62, pitch: 0.42, damping: 14, sway: 0.36,
    typeSize: 1, margin: 0.075, phrases: PHRASES,
    crumpleTime: 0.8, exitTime: 0.7, tight: 0.78, wild: 1,
  };
  const P = { ...DEFAULTS };
  if (tuning) { try { Object.assign(P, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* none */ } }

  // ---------- shaders ----------
  const VS = `#version 300 es
  precision highp float;
  uniform sampler2D uHeight;
  uniform vec2 uGrid, uSheetHalf, uCenter;
  uniform mat3 uRot;
  uniform vec3 uMove;               // slide x, y and spin
  uniform float uA, uSize, uShade, uAmp, uLift;
  uniform float uCrumple, uTight, uWild, uSeedC;
  out vec2 vTex;
  out vec2 vSheet;
  out float vShade;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float ridged(vec2 p) {
    float a = 0.0, w = 0.55;
    for (int i = 0; i < 3; i++) { a += w * (1.0 - abs(2.0 * vn(p) - 1.0)); p = p * 2.07 + 3.1; w *= 0.5; }
    return a;
  }
  // the sheet balled up: pulled in, thrown into creases
  vec3 crumple(vec2 p, float c, float h0) {
    float s = 1.0 - uTight * c;
    vec2 q = p * 2.4 + uSeedC * 37.0;
    float r = ridged(q) * 0.62 + ridged(q * 2.1 + 5.3) * 0.38;
    vec2 lat = vec2(vn(q * 1.3 + 2.0), vn(q * 1.3 + 9.0)) - 0.5;
    vec2 xy = p * s + lat * (0.5 * c * s * uWild);
    float belly = 0.3 * c * (1.0 - clamp(dot(p, p) / dot(uSheetHalf, uSheetHalf), 0.0, 1.0));
    float z = h0 * (1.0 - c) + (r - 0.5) * 0.55 * c * uWild + belly;
    return vec3(xy, z);
  }

  void main() {
    int nxI = int(uGrid.x);
    vec2 fid = vec2(float(gl_VertexID % nxI), float(gl_VertexID / nxI));
    vec2 jit = vec2(hash(fid + 0.17), hash(fid.yx + 3.31)) - 0.5;
    vec2 uvg = (fid - 0.5 + jit * 0.7) / (uGrid - 2.0);          // one extra ring: the fragment test trims the edge
    vec2 xyLoc = vec2(uvg.x * 2.0 - 1.0, 1.0 - uvg.y * 2.0) * uSheetHalf;
    vec2 hu = clamp(vec2(uvg.x, 1.0 - uvg.y), 0.0, 1.0);

    float e = 0.004;
    float fibre = sin(uvg.x * 913.1 + uvg.y * 227.7) * sin(uvg.y * 611.3 - uvg.x * 331.9) * 0.0012;
    float h0 = (texture(uHeight, hu).r + fibre) * uAmp;
    float hx = (texture(uHeight, hu + vec2(e, 0.0)).r - texture(uHeight, hu - vec2(e, 0.0)).r) / (2.0 * e * 2.0 * uSheetHalf.x) * uAmp;
    float hy = (texture(uHeight, hu + vec2(0.0, e)).r - texture(uHeight, hu - vec2(0.0, e)).r) / (2.0 * e * 2.0 * uSheetHalf.y) * uAmp;
    vec2 nrm = vec2(-hx, -hy);

    vec3 P0 = vec3(xyLoc + uCenter, h0);                         // where the point rests, and where the projector sees it
    vec3 L = vec3(xyLoc, h0);
    float size = uSize;
    if (uCrumple > 0.001) {
      vec3 Lc = crumple(xyLoc, uCrumple, h0);
      vec3 Lx = crumple(xyLoc + vec2(0.012, 0.0), uCrumple, h0);
      vec3 Ly = crumple(xyLoc + vec2(0.0, 0.012), uCrumple, h0);
      vec3 nn = normalize(cross(Lx - Lc, Ly - Lc));
      if (nn.z < 0.0) nn = -nn;
      nrm = mix(nrm, 2.2 * nn.xy / max(nn.z, 0.25), smoothstep(0.0, 0.25, uCrumple));
      L = Lc;
      size *= mix(1.0, 0.72, uCrumple);
    }
    float cs = cos(uMove.z), sn = sin(uMove.z);
    L.xy = vec2(L.x * cs - L.y * sn, L.x * sn + L.y * cs);
    nrm = vec2(nrm.x * cs - nrm.y * sn, nrm.x * sn + nrm.y * cs);
    vec3 P = vec3(L.xy + uCenter + uMove.xy, L.z + uLift);

    vec3 Pc = transpose(uRot) * P;
    float dz = ${D.toFixed(2)} - Pc.z;
    vec2 ndc = vec2(Pc.x * ${D.toFixed(2)} / (dz * uA), Pc.y * ${D.toFixed(2)} / dz);
    gl_Position = vec4(ndc, (dz - 0.5) / 6.0 * 2.0 - 1.0, 1.0);
    gl_PointSize = size * ${D.toFixed(2)} / dz;

    // the type is glued to the paper: it comes from where the projector sees the resting point
    vec2 tex = P0.xy * ${D.toFixed(2)} / (${D.toFixed(2)} - P0.z);
    vTex = (tex / vec2(uA, 1.0)) * 0.5 + 0.5;
    vSheet = xyLoc;

    vec3 n = normalize(vec3(nrm, sqrt(max(0.0, 1.0 - min(0.9, dot(nrm, nrm))))));
    if (uCrumple > 0.001) n = normalize(vec3(nrm, 1.0));
    vec3 vNow = normalize(uRot * vec3(0.0, 0.0, ${D.toFixed(2)}) - P);
    vec3 vRest = normalize(vec3(0.0, 0.0, ${D.toFixed(2)}) - P0);
    vShade = (dot(n, vNow) - dot(n, vRest)) * uShade;
  }`;
  const FS = `#version 300 es
  precision highp float;
  in vec2 vTex;
  in vec2 vSheet;
  in float vShade;
  uniform sampler2D uMask;
  uniform vec2 uRes, uSheetHalf, uCos;
  uniform float uSize;
  uniform vec3 uBg, uFg;
  out vec4 o;
  void main() {
    vec2 pc = gl_PointCoord - 0.5;
    // each fragment looks up the type a little way off its point, so edges stay crisp between points
    vec2 off = vec2(pc.x, -pc.y) * uSize * (2.0 / uRes.y) / uCos;     // a tilted sheet covers more of itself per pixel
    vec2 sh = vSheet + off;
    if (abs(sh.x) > uSheetHalf.x || abs(sh.y) > uSheetHalf.y) discard;   // the sheet's own edge
    vec2 uvt = vTex + vec2(off.x * uRes.y / uRes.x, off.y) * 0.5;
    float ink = smoothstep(0.42, 0.58, texture(uMask, uvt).r);
    float paper = clamp(1.0 + vShade, 0.22, 1.0);
    o = vec4(mix(uFg * paper, uBg, ink), 1.0);
  }`;

  const prog = compile(gl, VS, FS);
  gl.bindVertexArray(gl.createVertexArray());   // no attributes: every point comes from gl_VertexID

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

  let phraseBag = [];
  function nextPhrase(first) {
    const all = P.phrases.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!all.length) return 'Nothing to see here.';
    if (first) return all[0];
    if (!phraseBag.length) phraseBag = all.map((_, i) => i).sort(() => rand() - 0.5);
    return all[phraseBag.pop() % all.length];
  }

  function makeSheet(seed, phrase) {
    const s = { seed, phrase, mask: texture(gl, { w: 1, h: 1 }), hTex: null, hGY: -1, crumple: 0, mx: 0, my: 0, spin: 0, lift: 0, seedC: rand() };
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
    anim = { t: 0, dx: Math.cos(a), dy: Math.sin(a), spin: (rand() < 0.5 ? -1 : 1) * (2 + rand() * 3), incoming: null };
    outgoing = current;
    anim.incoming = makeSheet((rand() * 4294967296) >>> 0, nextPhrase(false));
    const n = anim.incoming; n.mx = -anim.dx * 9; n.my = -anim.dy * 9;   // parked off screen until its turn
  }
  const reach = () => Math.max(A, 1) + 1.2;                      // far enough to be off screen
  function stepAnim(dt) {
    anim.t += dt;
    const tc = Math.max(0.05, P.crumpleTime), te = Math.max(0.05, P.exitTime);
    const o = outgoing, n = anim.incoming;
    o.crumple = ease.inOut(clamp(anim.t / tc, 0, 1));
    o.lift = 0.18 * o.crumple;
    const ex = clamp((anim.t - tc * 0.82) / te, 0, 1), e = ease.in(ex) * reach();
    o.mx = anim.dx * e; o.my = anim.dy * e; o.spin = anim.spin * ease.in(ex);
    // the new sheet slides in from the opposite side while the old one leaves
    const ti = clamp((anim.t - tc * 0.7) / (te * 1.2), 0, 1), ie = (1 - ease.out(ti)) * reach();
    n.mx = -anim.dx * ie; n.my = -anim.dy * ie; n.spin = 0;
    if (anim.t > tc * 0.82 + te && ti >= 1) {
      freeSheet(outgoing); outgoing = null; current = n; anim = null;
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
  const HEIGHT_KEYS = new Set(['creases', 'reach', 'width', 'softness', 'align', 'bow', 'edge']);
  const LAYOUT_KEYS = new Set(['size', 'density', 'typeSize', 'margin']);
  const tune = {
    title: 'Sheet',
    values: P,
    defaults: DEFAULTS,
    groups: [
      { name: 'Paper', items: [
        R('relief', 'Relief', 0, 3, 0.05), R('creases', 'Creases', 0, 24, 1), R('reach', 'Crease length', 0.3, 2.2, 0.05),
        R('width', 'Crease width', 0.3, 2.2, 0.05), R('softness', 'Crease softness', 0.004, 0.06, 0.002),
        R('align', 'Fold scatter', 0, 1, 0.05), R('bow', 'Bow', 0, 0.15, 0.005), R('edge', 'Edge lift', 0, 1.5, 0.05)] },
      { name: 'Sheet', items: [R('size', 'Sheet size', 0.5, 1, 0.01), R('density', 'Points (thousands)', 40, 400, 10)] },
      { name: 'View', items: [
        R('shading', 'Shading', 0, 2, 0.05), R('yaw', 'Tilt sideways', 0, 1.2, 0.02), R('pitch', 'Tilt up and down', 0, 1, 0.02),
        R('damping', 'Follow speed', 3, 30, 1), R('sway', 'Opening sway', 0, 1, 0.02)] },
      { name: 'Type', items: [
        { key: 'phrases', label: 'Lines, one per sheet', type: 'text', rows: 6 },
        R('typeSize', 'Type size', 0.5, 1.4, 0.02), R('margin', 'Margin', 0.02, 0.2, 0.005)] },
      { name: 'Crumple', items: [
        R('crumpleTime', 'Crumple time (s)', 0.2, 2, 0.05), R('exitTime', 'Throw time (s)', 0.2, 2, 0.05),
        R('tight', 'Tightness', 0.3, 0.95, 0.01), R('wild', 'Wildness', 0, 2, 0.05)] },
    ],
    actions: {
      'New paper': () => { current.seed = (rand() * 4294967296) >>> 0; current.seedC = rand(); fillHeights(current); },
      'Crumple now': () => toss(),
    },
    set(key, value) {
      P[key] = value;
      if (HEIGHT_KEYS.has(key)) dirtyHeights = true;
      if (LAYOUT_KEYS.has(key)) dirtyLayout = true;
      if (key === 'phrases') phraseBag = [];
      save();
    },
    reset() { Object.assign(P, DEFAULTS); dirtyHeights = dirtyLayout = true; phraseBag = []; save(); },
  };

  // ---------- frame ----------
  const rot = new Float32Array(9);
  const ang = { x: 0, y: 0 };
  function drawSheet(s) {
    const u = prog.u;
    gl.uniform3f(u.uMove, s.mx, s.my, s.spin);
    gl.uniform1f(u.uLift, s.lift);
    gl.uniform1f(u.uCrumple, s.crumple);
    gl.uniform1f(u.uSeedC, s.seedC);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.hTex); gl.uniform1i(u.uHeight, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, s.mask); gl.uniform1i(u.uMask, 1);
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
    gl.clearColor(...ctx.colors.bg, 1); gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
    prog.use(); const u = prog.u;
    gl.uniformMatrix3fv(u.uRot, false, rot);
    gl.uniform1f(u.uA, A);
    gl.uniform1f(u.uSize, sizePx);
    gl.uniform1f(u.uShade, P.shading);
    gl.uniform1f(u.uAmp, P.relief);
    gl.uniform1f(u.uTight, P.tight);
    gl.uniform1f(u.uWild, P.wild);
    gl.uniform2f(u.uGrid, nx, ny);
    gl.uniform2f(u.uRes, ctx.pw, ctx.ph);
    gl.uniform2f(u.uSheetHalf, sheetHalf[0], sheetHalf[1]);
    gl.uniform2f(u.uCenter, center[0], center[1]);
    gl.uniform2f(u.uCos, Math.max(0.35, Math.cos(ang.x)), Math.max(0.35, Math.cos(ang.y)));
    gl.uniform3f(u.uBg, ...ctx.colors.bg);
    gl.uniform3f(u.uFg, ...ctx.colors.fg);
    if (outgoing) drawSheet(outgoing);
    drawSheet(anim ? anim.incoming : current);
  }));

  return {
    tune,
    debug: { toss, get sheet() { return current; }, get anim() { return anim; }, get count() { return nx * ny; } },
    destroy() { offs.forEach((off) => off()); },
  };
}
