// Turn. A plain luminous panel, and in front of it nine thin black letters, each turned edge-on, so the panel looks
// empty but for a few hairlines. Turn a letter (drag it sideways, or tap it to spin it like a coin) and it comes out
// of the dark: a black silhouette against the light, its sides catching the glow as it turns. Each letter is its own
// object with its own spin and momentum; the light does not move. Letters settle on a quarter turn: facing you,
// edge-on again, or (truthfully) back to front.
//
// Drawn by ray-marching, one pass: each letter is an extruded signed-distance field (a small distance-field texture per
// letter, computed once on the CPU) rotated about its own vertical axis.

import { getGL, compile, clamp } from '../engine.js';

const FONT = '"Archivo", "Arial Black", "Helvetica Neue", sans-serif';
const LINES = ['Idan', 'Segev'];
const N = LINES.join('').length;
const CELL = 384;            // texels per letter cell
const CELL_W = 3.0;          // world units a cell covers

export async function mount(ctx) {
  const { canvas } = ctx;
  const gl = getGL(canvas);
  if (!gl) throw new Error('webgl2 unavailable');
  ctx.adaptive = true;
  const offs = [], rand = ctx.rand;

  const DEFAULTS = { depth: 0.035, panelPad: 0.5, panelZ: -1.1, glow: 0.6, fov: 0.16, glide: 0.55, snap: 7, drag: 1, flick: 8, peek: 0.3, edge: 0.8 };
  const P = { ...DEFAULTS };

  // ---------- the letters: layout, and one distance field each ----------
  const TYPE_W = 6.4, LW = 1024;
  const letters = [];                                                    // { ch, cx, cy, hw, hh, th, w, g, hover, peek }
  let blockH = 2, sdfTex = null;
  function build() {
    const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
    g.font = `900 100px ${FONT}`;
    const cap100 = g.measureText('H').actualBoundingBoxAscent || 72;
    const availW = LW * 0.96, sizes = LINES.map((l) => (availW / (g.measureText(l).width || 1)) * 100);
    const caps = sizes.map((s) => cap100 * s / 100), gap = Math.min(...caps) * 0.14;
    const total = caps.reduce((a, b) => a + b, 0) + gap * (LINES.length - 1);
    const wpp = TYPE_W / LW, scale = CELL * wpp / CELL_W;               // layout px to world, and layout px to cell texels
    blockH = total * wpp;
    const data = new Float32Array(CELL * CELL * N);
    let y = 0, idx = 0;
    LINES.forEach((line, li) => {
      g.font = `900 ${sizes[li]}px ${FONT}`;
      const lineW = g.measureText(line).width, left = (LW - lineW) / 2, base = y + caps[li];
      for (let i = 0; i < line.length; i++) {
        const pre = g.measureText(line.slice(0, i)).width, m = g.measureText(line[i]);
        const x0 = left + pre - m.actualBoundingBoxLeft, x1 = left + pre + m.actualBoundingBoxRight;
        const y0 = base - m.actualBoundingBoxAscent, y1 = base + m.actualBoundingBoxDescent;
        const cxl = (x0 + x1) / 2, cyl = (y0 + y1) / 2;
        const L = { ch: line[i], cx: (cxl - LW / 2) * wpp, cy: (total / 2 - cyl) * wpp, hw: (x1 - x0) / 2 * wpp, hh: (y1 - y0) / 2 * wpp, th: Math.PI / 2, w: 0, grab: false, hover: false, peek: 0 };
        letters.push(L);
        // its distance field, with the ink's bounding-box centre at the middle of the cell
        const cc = document.createElement('canvas'); cc.width = cc.height = CELL;
        const cg = cc.getContext('2d', { willReadFrequently: true });
        cg.fillStyle = '#000'; cg.fillRect(0, 0, CELL, CELL); cg.fillStyle = '#fff'; cg.textBaseline = 'alphabetic';
        cg.font = `900 ${sizes[li] * scale}px ${FONT}`;
        const mm = cg.measureText(line[i]);
        const ox = CELL / 2 - (mm.actualBoundingBoxRight - mm.actualBoundingBoxLeft) / 2;
        const oy = CELL / 2 + (mm.actualBoundingBoxAscent - mm.actualBoundingBoxDescent) / 2;
        cg.fillText(line[i], ox, oy);
        const px = cg.getImageData(0, 0, CELL, CELL).data, ink = new Uint8Array(CELL * CELL);
        for (let k = 0; k < CELL * CELL; k++) ink[k] = px[k * 4] > 127 ? 1 : 0;
        const dOut = edt(ink, CELL, CELL, 1), dIn = edt(ink, CELL, CELL, 0), wpt = CELL_W / CELL, off = idx * CELL * CELL;
        for (let k = 0; k < CELL * CELL; k++) data[off + k] = ink[k] ? -(Math.sqrt(dIn[k]) - 0.5) * wpt : (Math.sqrt(dOut[k]) - 0.5) * wpt;
        idx++;
      }
      y = base + gap;
    });
    sdfTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, sdfTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R16F, CELL, CELL, N, 0, gl.RED, gl.FLOAT, data);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D_ARRAY, k, v);
  }
  // exact squared Euclidean distance transform (Felzenszwalb and Huttenlocher); `src` is the value that counts as a source
  function edt(grid, w, h, src) {
    const INF = 1e12, m = Math.max(w, h), f = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1), out = new Float64Array(w * h);
    const pass = (n, get, set) => {
      for (let i = 0; i < n; i++) f[i] = get(i);
      let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < n; q++) {
        let s;
        for (;;) { const p = v[k]; s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p); if (s <= z[k] && k > 0) k--; else break; }
        if (s <= z[k]) { v[k] = q; z[k] = -INF; z[k + 1] = INF; continue; }
        k++; v[k] = q; z[k] = s; z[k + 1] = INF;
      }
      k = 0;
      for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const p = v[k]; set(q, (q - p) * (q - p) + f[p]); }
    };
    for (let i = 0; i < w * h; i++) out[i] = grid[i] === src ? 0 : INF;
    for (let x = 0; x < w; x++) pass(h, (y) => out[y * w + x], (y, val) => { out[y * w + x] = val; });
    for (let y = 0; y < h; y++) pass(w, (x) => out[y * w + x], (x, val) => { out[y * w + x] = val; });
    return out;
  }
  build();

  // ---------- the scene ----------
  const FS = `#version 300 es
  precision highp float;
  precision highp sampler2DArray;
  uniform sampler2DArray uSDF;
  uniform vec2 uRes;
  uniform vec4 uL[${N}];                   // x, y of the centre, angle about the vertical, and the thickness
  uniform vec2 uH[${N}];                   // half width and height of the letter's box
  uniform float uA, uTan, uPanelZ, uGlow, uEdge;
  uniform vec4 uPanel;                     // centre x, y, half width, half height
  uniform vec3 uCam;
  out vec4 o;

  float gMin;                              // how close the ray came to a letter, for the edge
  vec2 rotY(vec2 xz, float c, float s) { return vec2(c * xz.x - s * xz.y, s * xz.x + c * xz.y); }

  float sdf(int i, vec3 q, float th) {
    vec2 uv = vec2(q.x / ${CELL_W.toFixed(2)} + 0.5, 0.5 - q.y / ${CELL_W.toFixed(2)});
    float d2 = textureLod(uSDF, vec3(clamp(uv, 0.004, 0.996), float(i)), 0.0).r;
    d2 += length(max(abs(q.xy) - 0.5 * ${CELL_W.toFixed(2)} + 0.03, 0.0));
    vec2 w = vec2(d2, abs(q.z) - th);
    return min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
  }
  // the ray in the letter's own frame; returns distance or -1, with the letter's normal in n (world frame)
  float hitLetter(int i, vec3 ro, vec3 rd, float tmax, out vec3 n) {
    float c = cos(uL[i].z), s = sin(uL[i].z);
    vec3 d0 = ro - vec3(uL[i].xy, 0.0);
    vec3 lo = vec3(rotY(d0.xz, c, s).x, d0.y, rotY(d0.xz, c, s).y);
    vec2 rr = rotY(rd.xz, c, s); vec3 ld = vec3(rr.x, rd.y, rr.y);
    vec3 h = vec3(uH[i] + 0.05, uL[i].w + 0.05), inv = 1.0 / ld, a = (-h - lo) * inv, b = (h - lo) * inv;
    vec3 mn = min(a, b), mx = max(a, b);
    float t0 = max(max(mn.x, mn.y), max(mn.z, 0.0)), t1 = min(min(mx.x, mx.y), min(mx.z, tmax));
    n = vec3(0.0);
    if (t1 < t0) return -1.0;
    float t = t0;
    for (int k = 0; k < 56; k++) {
      float d = sdf(i, lo + ld * t, uL[i].w);
      gMin = min(gMin, max(d, 0.0) / t);
      if (d < 0.0012) {
        const vec2 e = vec2(1.0, -1.0); const float ep = 0.01; vec3 p = lo + ld * t;
        vec3 ln = normalize(e.xyy * sdf(i, p + e.xyy * ep, uL[i].w) + e.yyx * sdf(i, p + e.yyx * ep, uL[i].w) + e.yxy * sdf(i, p + e.yxy * ep, uL[i].w) + e.xxx * sdf(i, p + e.xxx * ep, uL[i].w));
        n = vec3(c * ln.x + s * ln.z, ln.y, -s * ln.x + c * ln.z);       // back to the world frame
        return t;
      }
      t += d;
      if (t > t1) return -1.0;
    }
    return -1.0;
  }
  float sdRect(vec2 p, vec2 h) { vec2 d = abs(p) - h; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }

  void main() {
    vec2 ndc = (gl_FragCoord.xy / uRes) * 2.0 - 1.0;
    vec3 rd = normalize(vec3(ndc.x * uA * uTan, ndc.y * uTan, -1.0)), ro = uCam;
    float tl = (uPanelZ - ro.z) / rd.z;
    gMin = 1e3;
    float best = 1e9; vec3 bn = vec3(0.0);
    for (int i = 0; i < ${N}; i++) {
      vec3 n; float t = hitLetter(i, ro, rd, min(tl, best), n);
      if (t > 0.0 && t < best) { best = t; bn = n; }
    }
    // the panel behind: a bright rectangle with a soft halo
    vec2 pp = (ro + rd * tl).xy - uPanel.xy;
    float d = sdRect(pp, uPanel.zw), px = fwidth(d) * 1.2;
    float body = 1.0 - smoothstep(-px, px, d);
    vec3 bg = vec3(body * 0.97 + uGlow * 0.16 / (1.0 + d * d * 3.0) * (1.0 - body));
    vec3 col = bg;
    if (best < 1e8) {
      float side = 1.0 - abs(bn.z);                                         // faces turned away from you catch the light from behind
      col = vec3(smoothstep(0.35, 1.0, side) * uEdge * 0.9);
    } else {
      float pxA = uTan * 2.0 / uRes.y;
      col = bg * smoothstep(0.0, pxA * 1.1, gMin);                           // soft silhouette edge
    }
    col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
    o = vec4(col.rrr, 1.0);
  }`;
  const VS = `#version 300 es
  void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
  const prog = compile(gl, VS, FS);
  gl.bindVertexArray(gl.createVertexArray());

  // ---------- turning the letters ----------
  let cam = { dist: 10, A: 1, tan: 0.3 };
  function layoutCam() {
    const A = ctx.pw / ctx.ph, tanH = Math.tan(P.fov / 2), k = ctx.pw / ctx.W;
    const reserve = 1 + (((document.querySelector('.chrome') || {}).offsetHeight || 56) + 24) * k / ctx.ph;
    const panelH = blockH + P.panelPad * 1.6, panelW = TYPE_W + P.panelPad * 1.6;
    cam = { A, tan: tanH, dist: Math.max(panelH * 1.05 * reserve / (2 * tanH), panelW * 1.04 / (2 * tanH * A)) + 0.0 };
  }
  function pointAtPlane(q) {                                              // where a pointer is on the letters' plane, in world units
    const nx = q.u * 2 - 1, ny = q.v * 2 - 1;       // v runs bottom to top
    const rd = [nx * cam.A * cam.tan, ny * cam.tan, -1], t = cam.dist;     // z = 0 is `dist` away
    return [rd[0] * t, rd[1] * t];
  }
  const letterAt = (q) => {
    const [x, y] = pointAtPlane(q); let best = null, bd = 1e9;
    for (const L of letters) {
      const dx = Math.abs(x - L.cx) / Math.max(L.hw, 0.32), dy = Math.abs(y - L.cy) / Math.max(L.hh, 0.32);
      if (dx < 1.05 && dy < 1.05 && dx + dy < bd) { bd = dx + dy; best = L; }
    }
    return best;
  };

  let grab = null;
  offs.push(ctx.on('down', (q) => {
    const L = letterAt(q); if (!L) return;
    L.grab = true; L.w = 0;
    grab = { L, x: q.x, y: q.y, t: performance.now(), moved: 0, lastX: q.x, lastT: performance.now(), v: 0, side: pointAtPlane(q)[0] - L.cx };
  }));
  offs.push(ctx.on('move', (q) => {
    if (grab) {
      const L = grab.L, now = performance.now(), dx = q.x - grab.lastX, scalePx = Math.max(40, L.hw * 2 * (ctx.W / (2 * cam.tan * cam.A * cam.dist)));
      const dth = dx / scalePx * Math.PI * P.drag;
      L.th += dth; grab.moved += Math.abs(dx);
      const dt = Math.max(0.004, (now - grab.lastT) / 1000); grab.v += (dth / dt - grab.v) * 0.4;
      grab.lastX = q.x; grab.lastT = now;
    } else if (q.type === 'mouse') {
      const h = letterAt(q);
      for (const L of letters) L.hover = L === h;
      canvas.style.cursor = h ? 'grab' : '';
    }
  }));
  offs.push(ctx.on('up', () => {
    if (!grab) return;
    const { L } = grab, quick = performance.now() - grab.t < 380;
    L.grab = false;
    if (grab.moved < 8 && quick) L.w = (grab.side >= 0 ? 1 : -1) * P.flick * (0.8 + rand() * 0.4);           // a tap pushes the letter at the side you touched
    else L.w = clamp(grab.v, -22, 22);
    grab = null;
  }));

  // ---------- settings ----------
  const R = (key, label, min, max, step) => ({ key, label, min, max, step });
  const tune = {
    title: 'Turn',
    values: P, defaults: DEFAULTS,
    groups: [
      { name: 'Letters', items: [R('depth', 'Thickness', 0.01, 0.4, 0.005), R('edge', 'Side glow', 0, 1.2, 0.02), R('peek', 'Peek on hover', 0, 0.8, 0.02)] },
      { name: 'Turning', items: [R('drag', 'Drag turns', 0.3, 2.5, 0.05), R('flick', 'Tap spin', 2, 16, 0.5), R('glide', 'Friction', 0.1, 2.5, 0.05), R('snap', 'Settle speed', 2, 14, 0.5)] },
      { name: 'Light', items: [R('glow', 'Glow', 0, 1.5, 0.05), R('panelPad', 'Panel margin', 0.1, 1.5, 0.05), R('panelZ', 'Panel distance', -3, -0.5, 0.05), R('fov', 'Lens (small = flatter)', 0.08, 0.9, 0.01)] },
    ],
    actions: { 'Hide all': () => { for (const L of letters) { L.th = Math.PI / 2; L.w = 0; } } },
    set(key, value) { P[key] = value; },
    reset() { Object.assign(P, DEFAULTS); },
  };

  // ---------- frame ----------
  const uL = new Float32Array(N * 4), uH = new Float32Array(N * 2);
  offs.push(ctx.frame((dt) => {
    layoutCam();
    for (const L of letters) {
      if (!L.grab) {
        L.th += L.w * dt;
        L.w *= Math.exp(-P.glide * dt);
        if (Math.abs(L.w) < 1.1) {                                       // slow enough: settle on the nearest quarter turn
          let q = Math.round(L.th / (Math.PI / 2));
          if (((q % 4) + 4) % 4 === 2) q += L.th / (Math.PI / 2) > q ? 1 : -1;          // never come to rest back to front (a mirrored name): settle edge-on instead
          const target = q * (Math.PI / 2), k = 1 - Math.exp(-dt * P.snap);
          L.th += (target - L.th) * k; L.w *= 1 - k * 0.6;
        }
      }
      const edgeOn = Math.abs(Math.cos(L.th)) < 0.02 && Math.abs(L.w) < 0.3;
      const want = L.hover && !L.grab && edgeOn ? P.peek : 0;
      L.peek += (want - L.peek) * (1 - Math.exp(-dt * 10));
    }
    letters.forEach((L, i) => { uL[i * 4] = L.cx; uL[i * 4 + 1] = L.cy; uL[i * 4 + 2] = L.th + L.peek; uL[i * 4 + 3] = P.depth; uH[i * 2] = L.hw; uH[i * 2 + 1] = L.hh; });

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, ctx.pw, ctx.ph);
    prog.use(); const u = prog.u;
    gl.uniform2f(u.uRes, ctx.pw, ctx.ph);
    gl.uniform4fv(u['uL[0]'], uL); gl.uniform2fv(u['uH[0]'], uH);
    gl.uniform1f(u.uA, cam.A); gl.uniform1f(u.uTan, cam.tan);
    gl.uniform1f(u.uPanelZ, P.panelZ); gl.uniform1f(u.uGlow, P.glow); gl.uniform1f(u.uEdge, P.edge);
    gl.uniform4f(u.uPanel, 0, 0, TYPE_W / 2 + P.panelPad, blockH / 2 + P.panelPad);
    gl.uniform3f(u.uCam, 0, 0, cam.dist);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, sdfTex); gl.uniform1i(u.uSDF, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }));

  return {
    tune,
    debug: { letters: () => letters, cam: () => cam },
    destroy() { offs.forEach((off) => off()); canvas.style.cursor = ''; if (sdfTex) gl.deleteTexture(sdfTex); },
  };
}
