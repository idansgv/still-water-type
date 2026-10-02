// Sheet. A flat poster that is not: the type is projected onto a lightly wrinkled sheet of paper.
//
// Head-on, the camera sits exactly where the projector is, so the type lands as a perfectly flat, crisp
// print and the paper shows no relief at all. Tilt the view (cursor, finger, or a phone) and the same
// type, still projected from where you started, slides across the folds: the wrinkles appear as warps
// in the lettering and a trace of shading, and the sheet's own edge curls.
//
// Under the graphic: a dense point cloud of the paper (a height field of soft facets and fine fibre),
// drawn as GPU point sprites. The idea, a flat image that is secretly a cloud of points revealed by camera
// movement, follows cullenwebber/three-ml-sharp; the code is independent and the paper is procedural.

import { getGL, compile, texture, uploadCanvas, clamp } from '../engine.js';

const D = 3.2;   // camera distance (also the projector's)

export function mount(ctx) {
  const { canvas } = ctx;
  const gl = getGL(canvas, { depth: true });
  if (!gl) throw new Error('webgl2 unavailable');
  ctx.adaptive = true;
  const offs = [];
  const rand = ctx.rand;

  // ---------- shaders ----------
  const VS = `#version 300 es
  precision highp float;
  in vec3 aPos;                 // x, y on the sheet, height above it
  in vec2 aNrm;                 // surface normal's x, y
  uniform mat3 uRot;            // camera orbit
  uniform float uA;             // viewport aspect
  uniform float uSize;          // sprite size, canvas px
  uniform float uShade;         // how much relief shows as shading while tilted
  uniform vec2 uSheetHalf;      // sheet half extents, world
  out vec2 vTex;                // where the projector put the type, 0..1
  out vec2 vSheet;              // position on the sheet, world
  out float vShade;
  out float vWorldPx;           // world units per sprite pixel, for per-fragment lookups
  void main() {
    vec3 P = aPos;
    vec3 Pc = transpose(uRot) * P;
    float dz = ${D.toFixed(2)} - Pc.z;
    vec2 ndc = vec2(Pc.x * ${D.toFixed(2)} / (dz * uA), Pc.y * ${D.toFixed(2)} / dz);
    gl_Position = vec4(ndc, (dz - 0.5) / 6.0 * 2.0 - 1.0, 1.0);
    gl_PointSize = uSize * ${D.toFixed(2)} / dz;

    // projector: at rest the camera is the projector, so this is exactly where the point is drawn
    vec2 tex = P.xy * ${D.toFixed(2)} / (${D.toFixed(2)} - P.z);
    vTex = (tex / vec2(uA, 1.0)) * 0.5 + 0.5;
    vSheet = P.xy;

    vec3 n = normalize(vec3(aNrm, sqrt(max(0.0, 1.0 - dot(aNrm, aNrm)))));
    vec3 vNow = normalize(uRot * vec3(0.0, 0.0, ${D.toFixed(2)}) - P);
    vec3 vRest = normalize(vec3(0.0, 0.0, ${D.toFixed(2)}) - P);
    vShade = (dot(n, vNow) - dot(n, vRest)) * uShade;
  }`;
  const FS = `#version 300 es
  precision highp float;
  in vec2 vTex;
  in vec2 vSheet;
  in float vShade;
  uniform sampler2D uMask;
  uniform vec2 uRes;
  uniform float uSize;
  uniform vec2 uSheetHalf, uCenter, uCos;
  uniform vec3 uBg, uFg;
  out vec4 o;
  void main() {
    vec2 pc = gl_PointCoord - 0.5;                              // -0.5..0.5 across the sprite
    // each fragment looks up the type a little way off its point, so edges stay crisp between points
    vec2 off = vec2(pc.x, -pc.y) * uSize * (2.0 / uRes.y) / uCos;   // a tilted sheet covers more of itself per pixel
    vec2 sh = vSheet + off - uCenter;
    if (abs(sh.x) > uSheetHalf.x || abs(sh.y) > uSheetHalf.y) discard;   // the sheet's own edge
    vec2 uvt = vTex + vec2(off.x * uRes.y / uRes.x, off.y) * 0.5;
    float ink = smoothstep(0.42, 0.58, texture(uMask, uvt).r);
    float paper = clamp(1.0 + vShade, 0.0, 1.0);
    vec3 col = mix(uFg * paper, uBg, ink);                      // paper is the foreground tone, ink the background tone
    o = vec4(col, 1.0);
  }`;

  const prog = compile(gl, VS, FS);
  const maskTex = texture(gl, { w: 1, h: 1 });

  // ---------- the paper ----------
  // A height field of a few long, soft creases (tent-shaped ridges and valleys that fade with distance),
  // a gentle bow across the sheet, and the edges lifting a little. Nothing here repeats, so the paper
  // looks handled rather than tiled.
  function makePaper(halfW, halfH) {
    const GX = 200, GY = Math.max(80, Math.round(GX * halfH / halfW));
    const base = rand() * Math.PI;                              // creases lean the way a hand folds
    const creases = [];
    for (let i = 0; i < 11; i++) {
      const long = i < 3;
      const ang = base + (rand() - 0.5) * (i % 3 === 0 ? 2.4 : 0.9) + (rand() < 0.3 ? Math.PI / 2 : 0);
      creases.push({
        cx: (rand() * 2 - 1) * halfW, cy: (rand() * 2 - 1) * halfH,
        dx: Math.cos(ang), dy: Math.sin(ang),
        a: (rand() < 0.5 ? -1 : 1) * (0.07 + rand() * 0.15),
        w0: 0.07 + rand() * 0.22,
        T: long ? 0.7 + rand() * 0.5 : 0.22 + rand() * 0.35,
      });
    }
    const eps = 0.012;
    const bowX = (rand() - 0.5) * 0.05, bowY = (rand() - 0.5) * 0.05;
    const field = new Float32Array((GX + 1) * (GY + 1));
    for (let j = 0; j <= GY; j++) {
      for (let i = 0; i <= GX; i++) {
        const x = (i / GX * 2 - 1) * halfW, y = (j / GY * 2 - 1) * halfH;
        let h = bowX * Math.cos(Math.PI * 0.5 * x / halfW) + bowY * Math.cos(Math.PI * 0.5 * y / halfH);
        for (const c of creases) {
          const px = x - c.cx, py = y - c.cy;
          const t = px * c.dx + py * c.dy, d = -px * c.dy + py * c.dx;
          let tent = c.w0 - Math.sqrt(d * d + eps * eps);
          tent = 0.5 * (tent + Math.sqrt(tent * tent + eps * eps));          // soft floor at zero
          h += c.a * tent * Math.exp(-(t * t) / (c.T * c.T));
        }
        const ex = Math.max(0, Math.abs(x) / halfW - 0.86), ey = Math.max(0, Math.abs(y) / halfH - 0.86);
        h += 0.5 * (ex * ex + ey * ey);
        field[j * (GX + 1) + i] = h;
      }
    }
    return { field, GX, GY };
  }
  const bilinear = (f, GX, GY, u, v) => {
    const x = clamp(u, 0, 1) * GX, y = clamp(v, 0, 1) * GY;
    const i = Math.min(GX - 1, x | 0), j = Math.min(GY - 1, y | 0), fx = x - i, fy = y - j;
    const w = GX + 1;
    return (f[j * w + i] * (1 - fx) + f[j * w + i + 1] * fx) * (1 - fy) + (f[(j + 1) * w + i] * (1 - fx) + f[(j + 1) * w + i + 1] * fx) * fy;
  };

  const FONT = '"Archivo", "Arial Black", "Helvetica Neue", sans-serif';
  const AMP = 1.1;
  let vao = null, buf = null, count = 0, A = 1, sheetHalf = [0.4, 0.55], sizePx = 4;
  const rot = new Float32Array(9);

  function rebuild() {
    const W = ctx.pw, H = ctx.ph, k = W / ctx.W;
    A = W / H;
    const chrome = document.querySelector('.chrome');
    const reserve = (((chrome && chrome.offsetHeight) || 56) + 20) * k;
    const usable = H - reserve;

    // an A4 sheet, as large as fits above the page furniture
    const ratio = 1 / 1.414;
    let sh = Math.min(usable * 0.92, H * 0.92), sw = sh * ratio;
    if (sw > W * 0.9) { sw = W * 0.9; sh = sw / ratio; }
    const cx = W / 2, cy = usable / 2 + H * 0.01;
    const px2w = 2 / H;                                         // canvas px to world
    sheetHalf = [sw * 0.5 * px2w, sh * 0.5 * px2w];
    const wy = (H / 2 - cy) * px2w;                             // world y of the sheet's centre
    const wx = (cx - W / 2) * px2w;

    // the projector's picture: type on a flat plane, shown only where the sheet is
    const mask = document.createElement('canvas'); mask.width = W; mask.height = H;
    const g = mask.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    const pad = sw * 0.075;
    const lines = ['Nothing', 'to see', 'here.'];
    g.font = `900 100px ${FONT}`;
    const w100 = Math.max(...lines.map((l) => g.measureText(l).width));
    const cap100 = g.measureText('H').actualBoundingBoxAscent || 72;
    let size = ((sw - pad * 2) / w100) * 100;
    const lineH = 1.02;
    if (cap100 * size / 100 * lineH * lines.length > sh - pad * 2) size = (sh - pad * 2) / (cap100 / 100 * lineH * lines.length);
    g.font = `900 ${size}px ${FONT}`;
    const cap = (cap100 * size) / 100;
    const left = cx - sw / 2 + pad, top = cy - sh / 2 + pad;
    lines.forEach((l, i) => {
      const m = g.measureText(l);
      g.fillText(l, left + m.actualBoundingBoxLeft, top + cap + i * cap * lineH * 1.04);
    });
    uploadCanvas(gl, maskTex, mask);

    // the cloud
    const area = sw * sh;
    const target = ctx.W < 600 ? 170000 : 250000;
    const spacing = Math.max(2.4 * k * 0.6, Math.sqrt(area / target));          // canvas px
    sizePx = spacing * 1.9;
    const nx = Math.ceil(sw / spacing) + 2, ny = Math.ceil(sh / spacing) + 2;     // one extra ring: the fragment test trims the edge exactly
    count = nx * ny;
    const paper = makePaper(sheetHalf[0], sheetHalf[1]);
    const data = new Float32Array(count * 5);
    const e = 0.004;
    let o = 0;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const ux = ((i - 1) + 0.5 + (rand() - 0.5) * 0.7) / (nx - 2), uy = ((j - 1) + 0.5 + (rand() - 0.5) * 0.7) / (ny - 2);
        const x = (ux * 2 - 1) * sheetHalf[0], y = (1 - uy * 2) * sheetHalf[1];
        const gu = ux, gv = 1 - uy;
        const fibre = (Math.sin(ux * 913.1 + uy * 227.7) * Math.sin(uy * 611.3 - ux * 331.9)) * 0.0012;
        const h = (bilinear(paper.field, paper.GX, paper.GY, gu, gv) + fibre) * AMP;
        const hx = bilinear(paper.field, paper.GX, paper.GY, gu + e, gv) - bilinear(paper.field, paper.GX, paper.GY, gu - e, gv);
        const hy = bilinear(paper.field, paper.GX, paper.GY, gu, gv + e) - bilinear(paper.field, paper.GX, paper.GY, gu, gv - e);
        const gxw = hx / (2 * e * 2 * sheetHalf[0]) * AMP, gyw = hy / (2 * e * 2 * sheetHalf[1]) * AMP;
        const nxn = -gxw, nyn = -gyw;
        data[o++] = x + wx; data[o++] = y + wy; data[o++] = h;
        data[o++] = nxn; data[o++] = nyn;
      }
    }
    if (!vao) vao = gl.createVertexArray();
    if (buf) gl.deleteBuffer(buf);
    buf = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const loc = (n, s, off) => { const l = gl.getAttribLocation(prog.p, n); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, s, gl.FLOAT, false, 20, off); };
    loc('aPos', 3, 0); loc('aNrm', 2, 12);
    gl.bindVertexArray(null);
    rebuild.center = [wx, wy];
  }
  offs.push(ctx.on('resize', rebuild));
  rebuild();

  // ---------- frame ----------
  const ang = { x: 0, y: 0 };
  offs.push(ctx.frame((dt, t) => {
    // one slow sway at the start, so a flat sheet admits that it is not
    let nudge = 0;
    if (!ctx.reduced) nudge = 0.36 * Math.sin(t * 2.7) * Math.exp(-t * 1.5);
    const tx = ctx.look.x * 0.62 + nudge, ty = -ctx.look.y * 0.42 + nudge * 0.4;
    ang.x += (tx - ang.x) * Math.min(1, dt * 14); ang.y += (ty - ang.y) * Math.min(1, dt * 14);
    const cy = Math.cos(ang.x), sy = Math.sin(ang.x), cp = Math.cos(ang.y), sp = Math.sin(ang.y);
    // R = Ry * Rx, column-major
    rot[0] = cy;       rot[1] = 0;   rot[2] = -sy;
    rot[3] = sy * sp;  rot[4] = cp;  rot[5] = cy * sp;
    rot[6] = sy * cp;  rot[7] = -sp; rot[8] = cy * cp;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, ctx.pw, ctx.ph);
    gl.clearColor(...ctx.colors.bg, 1); gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
    prog.use(); const u = prog.u;
    gl.uniformMatrix3fv(u.uRot, false, rot);
    gl.uniform1f(u.uA, A);
    gl.uniform1f(u.uSize, sizePx);
    gl.uniform1f(u.uShade, 0.85);
    gl.uniform2f(u.uRes, ctx.pw, ctx.ph);
    gl.uniform2f(u.uSheetHalf, sheetHalf[0] + 0.004, sheetHalf[1] + 0.004);
    gl.uniform2f(u.uCenter, rebuild.center[0], rebuild.center[1]);
    gl.uniform2f(u.uCos, Math.max(0.35, Math.cos(ang.x)), Math.max(0.35, Math.cos(ang.y)));
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, maskTex); gl.uniform1i(u.uMask, 0);
    gl.uniform3f(u.uBg, ...ctx.colors.bg);
    gl.uniform3f(u.uFg, ...ctx.colors.fg);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.POINTS, 0, count);
    gl.bindVertexArray(null);
  }));

  return { debug: { get count() { return count; } }, destroy() { offs.forEach((off) => off()); } };
}
