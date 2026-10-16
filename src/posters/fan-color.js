// Fan color (draft): the colour test of Fan. Same strips, springs and camera; the ink is a gradient (per line or across the block), with palettes
// from the festival reference and a dark/light toggle in the settings panel. Colour is outside the house rule (black and white), so this stays a draft.
// Fan: IDAN / SEGEV in the heaviest Archivo, cut into thin horizontal strips that live in 3D.
// Each strip is a textured quad with its own springs: an in-plane swing about a pivot (the fan), a yaw and a pitch
// (so the strips leave the page and the perspective stretches them into rays), a lengthening, and a sideways slide
// of the type itself (a reel). Idea from a motion piece in a festival identity (docs/posters/fan.md). Black and white.
//
//   rest      the word, whole, hairline gaps between strips
//   drag      pressed where you want the pivot; drag right/left to swing the fan, up/down to tip it into depth; let go and it springs home
//   move      a moving mouse nudges the strips it passes
//   tap       a stab: a wave of flicks runs away from the tap, row by row
//   self-demo until the first touch: fan, hold, scatter, resolve, repeat
import { createReveal, grid, corners, label, titleBlock, ink as rvInk } from './reveal.js';
import { pressTracker } from '../gestures.js';
import { compile } from '../engine.js';
import { COLOUR_DEF, colourGroups, gradientUniforms, GLSL_GRADIENT, paperGrey } from './palette.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FONT = '900 100px Archivo, "Arial Black", Helvetica, sans-serif';
const MAXN = 96, COLS = 28;

const VS = `#version 300 es
in vec4 aA;   // x: strip index, y: along the strip 0..1, z: 0 bottom edge / 1 top edge of the strip, w: strip centre y (css px, from top)
in vec2 aH;   // x: strip height (css px), y: pivot baseline of its line (css px from top)
uniform vec2 uWH; uniform vec4 uP[${MAXN}]; uniform vec4 uQ[${MAXN}]; uniform vec4 uCam; uniform vec4 uCR; uniform vec2 uCT;   // uP: swing, yaw, pitch, length. uQ: slide px. uCam: focal length, pivot x, pivot y (css px from the top: the split line), 0
out vec2 vUV; out vec3 vG; out float vDepth;
void main() {
  int i = int(aA.x); vec4 p = uP[i]; vec4 q = uQ[i];
  float X = (aA.y - 0.5) * uWH.x, y = aA.w + (0.5 - aA.z) * aH.x, Y = uWH.y * 0.5 - y;
  float pY = uWH.y * 0.5 - uCam.z; vec2 r = vec2(X - uCam.y, Y - pY);
  r.x *= p.w;
  float ca = cos(p.x), sa = sin(p.x); r = vec2(ca * r.x - sa * r.y, sa * r.x + ca * r.y);
  float z = -r.x * sin(p.y); r.x *= cos(p.y);
  z += r.y * sin(p.z); r.y *= cos(p.z);
  z = min(z, uCam.x * 0.8);
  vec3 c3 = vec3(uCam.y + r.x, pY + r.y, z);
  float cy = cos(uCR.x), sy = sin(uCR.x), cp = cos(uCR.y), sp = sin(uCR.y), cr = cos(uCR.z), sr = sin(uCR.z);   // camera: orbit the scene about the middle of the page
  c3 = vec3(cy * c3.x + sy * c3.z, c3.y, -sy * c3.x + cy * c3.z);
  c3 = vec3(c3.x, cp * c3.y - sp * c3.z, sp * c3.y + cp * c3.z);
  c3 = vec3(cr * c3.x - sr * c3.y, sr * c3.x + cr * c3.y, c3.z);
  c3 = c3 * uCR.w; c3.xy += uCT;
  c3.z = min(c3.z, uCam.x * 0.8);
  float pw = (uCam.x - c3.z) / uCam.x;
  gl_Position = vec4(c3.x / (uWH.x * 0.5), c3.y / (uWH.y * 0.5), clamp(-c3.z / (uCam.x * 2.0), -0.95, 0.95) * pw, pw);
  vG = q.yzw; vDepth = clamp(-c3.z / (uCam.x * 0.6), 0.0, 1.0);
  vUV = vec2(aA.y + q.x / uWH.x, y / uWH.y);
}`;
const FS = `#version 300 es
precision highp float; in vec2 vUV; in vec3 vG; in float vDepth; uniform sampler2D uTex; uniform vec3 uPaper; out vec4 o;
${GLSL_GRADIENT}
void main() { float a = texture(uTex, vUV).a; o = vec4(mix(uPaper, gradientColour(vG, vDepth, uPaper), a), 1.0); }`;

export function mount(stage) {
  const dark0 = stage.theme.name === 'dark';
  const inkC = '#000';                                                           // only the alpha of the type texture is used; colour comes from the gradient
  const COL = { ...COLOUR_DEF, dark: dark0 ? 1 : 0 };
  let paperV = [0, 0, 0];
  const applyBg = () => { const g = paperGrey(P); paperV = [g, g, g]; stage.setBackdrop(g); dirty = true; };
  const gl = stage.canvas.getContext('webgl2', { antialias: true, alpha: false, depth: true, preserveDrawingBuffer: true });
  const prog = compile(gl, VS, FS);
  const tex = gl.createTexture(), vbo = gl.createBuffer(), ibo = gl.createBuffer(), vao = gl.createVertexArray();

  const DEF = { rows: 45, gap: 0.3, stiff: 155, damp: 0.28, fan: 2, yaw: 0.62, pitch: 0.81, stretch: 2, persp: 2.78, camYaw: -0.27, camPitch: 0.09, camRoll: -0.04, zoom: 0.72, panX: -0.06, panY: 0.01, randomCam: 1 };
  const P = { ...DEF, ...COL };
  let W = 1, H = 1, PW = 1, PH = 1, strips = [], block = { y0: 0, y1: 0 }, nIdx = 0;
  let touched = false, idle = 0, demoT = 0, dirty = true, alive = true, demoK = 0, demoV = 0, demoTarget = 0, pivX = 0;
  let kicks = [], drag = null, last = null, drive = { fan: 0, yaw: 0, pitch: 0, stretch: 0, px: 0, py: 0 }, pivY = 0;
  const press = pressTracker();
  const rc = () => (stage.rand() - 0.5) * 2;                                     // seeded, so a shared link opens on the same view
  function rollCamera() { Object.assign(P, { camYaw: DEF.camYaw + rc() * 0.4, camPitch: DEF.camPitch + rc() * 0.25, camRoll: DEF.camRoll + rc() * 0.1, panX: DEF.panX + rc() * 0.08, panY: DEF.panY + rc() * 0.05, zoom: DEF.zoom + rc() * 0.08 }); dirty = true; }
  if (P.randomCam) rollCamera();
  const pa = new Float32Array(MAXN * 4), qa = new Float32Array(MAXN * 4);

  function layout() {
    const portrait = W / H < 0.85;
    const words = portrait ? ['IDAN', 'SE', 'GEV'] : ['IDAN', 'SEGEV'];
    const padX = Math.max(14, W * 0.045), maxW = W - padX * 2, gapL = H * 0.035, topPad = H * 0.04, avail = H - 120 - topPad;
    const m = document.createElement('canvas').getContext('2d'); m.font = FONT;
    const lines = words.map((t) => {
      m.font = FONT; const w = m.measureText(t).width, size = (maxW / w) * 100;
      const cap = ((m.measureText('H').actualBoundingBoxAscent || 72) / 100) * size;
      return { t, size, cap };
    });
    let total = lines.reduce((a, l) => a + l.cap, 0) + gapL * (lines.length - 1);
    const k = Math.min(1, avail / total); total *= k;
    let y = topPad + (avail - total) / 2; block = { y0: y, y1: y + total, mid: y + total / 2, half: total / 2 };
    if (!pivY) pivY = block.mid;
    const src = document.createElement('canvas'); src.width = PW; src.height = PH;
    const c = src.getContext('2d'); c.setTransform(PW / W, 0, 0, PH / H, 0, 0); c.fillStyle = inkC; c.textBaseline = 'alphabetic'; c.textAlign = 'center';
    for (const l of lines) { const s = l.size * k, cap = l.cap * k; c.font = FONT.replace('100px', s + 'px'); c.fillText(l.t, W / 2, y + cap); y += cap + gapL * k; }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const mid = block.y0 + total / 2, half = total / 2;
    const per = Math.min(Math.floor(MAXN / lines.length), P.rows), old = strips; strips = [];
    let yy = topPad + (avail - total) / 2;
    let lineNo = 0;
    for (const l of lines) {
      const cap = l.cap * k, pitch = cap / per;
      for (let i = 0; i < per; i++) {
        const o = old[strips.length], u = (mid - (yy + (i + 0.5) * pitch)) / half;   // signed: +1 at the top of the block, 0 on the centre line, -1 at the bottom
        strips.push({ y: yy + (i + 0.5) * pitch, h: pitch * (1 - P.gap), u, t: (yy + (i + 0.5) * pitch - block.y0) / total, z: (i + 0.5) / per, li: lineNo, base: mid, rnd: ((strips.length * 7919) % 101) / 101 - 0.5, c: o ? o.c : [0, 0, 0, 1, 0], v: o ? o.v : [0, 0, 0, 0, 0] });
      }
      yy += cap + gapL * k; lineNo++;
    }
    const n = strips.length;
    // mesh: COLS segments along each strip so a strip can bend through perspective
    const vs = new Float32Array(n * (COLS + 1) * 2 * 6), ix = new Uint32Array(n * COLS * 6);
    let vi = 0, ii = 0;
    for (let i = 0; i < n; i++) {
      const base = vi / 6;
      for (let j = 0; j <= COLS; j++) for (const z of [0, 1]) { vs.set([i, j / COLS, z, strips[i].y, strips[i].h, strips[i].base], vi); vi += 6; }
      for (let j = 0; j < COLS; j++) { const a = base + j * 2; ix.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], ii); ii += 6; }
    }
    nIdx = ii;
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, vs, gl.STATIC_DRAW);
    const la = gl.getAttribLocation(prog.p, 'aA'), lh = gl.getAttribLocation(prog.p, 'aH');
    gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 4, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(lh); gl.vertexAttribPointer(lh, 2, gl.FLOAT, false, 24, 16);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ix, gl.STATIC_DRAW);
    dirty = true;
  }

  
  function stab(x, y) {                                                         // a wave of flicks running out from the tap
    const dir = x < W / 2 ? 1 : -1;
    strips.forEach((s) => kicks.push({ s, t: Math.abs(s.y - y) / H * 0.5 + stage.rand() * 0.012, da: dir * (7 + 5 * Math.abs(s.rnd)) * (0.35 + 0.65 * Math.abs(s.u)) * Math.sign(s.u), db: dir * 3 * s.u, dox: dir * W * (1.2 + 2 * Math.abs(s.rnd)) * (s.rnd > 0 ? 1 : -0.8) }));
  }
  function scatter() { strips.forEach((s) => { s.v[4] += s.rnd * 2 * W * 5; s.v[0] += s.rnd * 4 * s.u; }); }

  function step(dt) {
    const dk = demoTarget - demoK; demoV += (dk * 60 - demoV * 9) * dt; demoK += demoV * dt;
    if (drag) { drive.fan = drag.fan; drive.yaw = drag.yaw; drive.pitch = drag.pitch; drive.stretch = Math.abs(drag.fan) * 0.8 + Math.abs(drag.pitch) * 0.5; drive.px = drag.px; drive.py = drag.py; }
    else { drive.fan = demoK; drive.yaw = demoK * 0.55; drive.pitch = demoK * 0.45; drive.stretch = demoK * 0.85; drive.px = 0; drive.py = block.mid; }
    pivX += (drive.px - pivX) * Math.min(1, dt * 9);
    pivY += (drive.py - pivY) * Math.min(1, dt * 9);                             // the split line follows the pointer's height while dragging, and glides back to the middle
    for (let j = kicks.length - 1; j >= 0; j--) { const k = kicks[j]; k.t -= dt; if (k.t <= 0) { k.s.v[0] += k.da; k.s.v[1] += k.db; k.s.v[4] += k.dox; kicks.splice(j, 1); } }
    let moving = Math.abs(demoV) > 0.01 || Math.abs(demoTarget - demoK) > 0.002 || kicks.length > 0 || !!drag;
    for (const s of strips) {
      const ud = clamp((pivY - s.y) / block.half, -1.5, 1.5), au = Math.abs(ud), g = Math.sign(ud) * Math.pow(au, 1.15), kk = P.stiff * (1 - 0.45 * au), cc = 2 * P.damp * Math.sqrt(kk);   // the top lags, so a move flows up the word
      const tg = [drive.fan * P.fan * g, drive.yaw * P.yaw * g, drive.pitch * P.pitch * g, 1 + drive.stretch * P.stretch * Math.abs(g), 0];
      for (let k = 0; k < 5; k++) {
        const kx = k === 4 ? P.stiff : kk, cx = k === 4 ? 2 * P.damp * Math.sqrt(P.stiff) : cc;
        s.v[k] += ((tg[k] - s.c[k]) * kx - s.v[k] * cx) * dt; s.c[k] += s.v[k] * dt;
        if (Math.abs(s.v[k]) > (k === 4 ? 0.05 : 0.0005) || Math.abs(tg[k] - s.c[k]) > (k === 4 ? 0.05 : 0.0004)) moving = true;
        else { s.c[k] = tg[k]; s.v[k] = 0; }
      }
    }
    return moving;
  }

  applyBg();

  function draw() {
    gl.viewport(0, 0, PW, PH);
    gl.clearColor(paperV[0], paperV[1], paperV[2], 1); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND);
    prog.use();
    strips.forEach((s, i) => { pa.set([s.c[0], s.c[1], s.c[2], s.c[3]], i * 4); qa[i * 4] = s.c[4]; qa[i * 4 + 1] = s.t; qa[i * 4 + 2] = s.z; qa[i * 4 + 3] = s.li; });
    gl.uniform4fv(prog.u['uP[0]'], pa); gl.uniform4fv(prog.u['uQ[0]'], qa);
    gl.uniform2f(prog.u.uWH, W, H); gl.uniform4f(prog.u.uCam, P.persp * H, pivX, pivY, 0);
    gl.uniform4f(prog.u.uCR, P.camYaw, P.camPitch, P.camRoll, P.zoom); gl.uniform2f(prog.u.uCT, P.panX * W, P.panY * H);
    gradientUniforms(gl, prog.u, P); gl.uniform3fv(prog.u.uPaper, paperV);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(prog.u.uTex, 0);
    gl.bindVertexArray(vao); gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_INT, 0);
  }

  // ---- input ----
  let pid = null, orbit = null;
  const onWheel = (e) => { e.preventDefault(); P.zoom = clamp(P.zoom * Math.exp(-e.deltaY * 0.0015), 0.3, 4); touched = true; dirty = true; };
  stage.root.addEventListener('wheel', onWheel, { passive: false });
  const offs = [];
  offs.push(stage.on('down', (q, e) => {
    if (pid !== null) return; pid = e.pointerId; touched = true; idle = 0; demoTarget = 0;
    if (e.altKey || e.shiftKey) { orbit = { x: q.x, y: q.y, shift: e.shiftKey && !e.altKey }; return; }
    press.down(q, e.pointerId); drag = { x0: q.x, y0: q.y, fan: 0, yaw: 0, pitch: 0, px: q.x - W / 2, py: q.y }; last = q;
  }));
  offs.push(stage.on('move', (q, e) => {
    if (pid !== null && e.pointerId !== pid) return;
    press.move(q, e.pointerId);
    if (orbit) { const dx = q.x - orbit.x, dy = q.y - orbit.y; orbit.x = q.x; orbit.y = q.y; if (orbit.shift) { P.panX += dx / W; P.panY -= dy / H; } else { P.camYaw += dx * 0.006; P.camPitch += dy * 0.006; } dirty = true; return; }
    if (drag) { const dx = (q.x - drag.x0) / (W * 0.5), dy = (q.y - drag.y0) / (H * 0.5); drag.fan = clamp(dx, -1.3, 1.3); drag.yaw = clamp(dx, -1.3, 1.3) * 0.8; drag.pitch = clamp(-dy, -1.2, 1.2); drag.py = clamp(q.y, block.y0, block.y1); dirty = true; }
    else if (q.type === 'mouse' && last) {                                      // hover: a moving mouse nudges the strips it passes
      const vx = q.x - last.x, R = H * 0.14;
      if (vx) for (const s of strips) { const d = (s.y - q.y) / R; if (Math.abs(d) < 2.5) s.v[4] += vx * 16 * Math.exp(-d * d); }
      dirty = true;
    }
    last = q;
  }));
  offs.push(stage.on('up', (q, e) => {
    if (e.pointerId !== pid) return;
    if (orbit) { orbit = null; pid = null; return; }
    const r = press.up(q, e.pointerId); pid = null; drag = null;
    if (r && r.tap) stab(q.x, q.y);
    dirty = true;
  }));

  // ---- reveal: the cut, the rows, and the swing of each (flat approximation of the 3D pose) ----
  const rv = createReveal(stage, (c, W_, H_, k) => {
    const col = (a) => rvInk(stage, a);
    grid(c, W_, H_, 24, col, k); corners(c, W_, H_, 16, col, k);
    const px = W_ / 2 + pivX;
    c.lineWidth = 0.9;
    for (let i = 0; i < strips.length; i++) {
      const s = strips[i], a = s.c[0], len = s.c[3];
      const py = pivY, f = (x) => { const rx = (x - px) * len, ry = s.y - py; return [px + Math.cos(a) * rx + Math.sin(a) * ry, py - Math.sin(a) * rx + Math.cos(a) * ry]; };
      const A = f(14), B = f(W_ - 14);
      c.strokeStyle = col(0.65 * k); c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke();
      if (i % 6 === 0) label(c, String(i).padStart(2, '0'), 18, s.y + 3, col, k);
    }
    c.strokeStyle = col(k); c.beginPath(); c.arc(px, pivY, 6, 0, 7); c.moveTo(px - 10, pivY); c.lineTo(px + 10, pivY); c.stroke();
    label(c, 'split line (follows the pointer)', px + 12, pivY - 8, col, k);
    titleBlock(c, W_, H_, ['FAN COLOR · STRIPS', `${strips.length} quads, 5 springs each`, 'swing · yaw · pitch · length · slide', 'o = pivot (where you pressed)'], col, k);
  });

  function resize() { W = stage.W; H = stage.H; PW = stage.pw; PH = stage.ph; layout(); draw(); }
  offs.push(stage.on('resize', resize));
  if (document.fonts && document.fonts.load) document.fonts.load('900 100px Archivo', 'IDANSEGEV').then(() => { if (alive) { layout(); draw(); } }, () => {});
  resize();

  offs.push(stage.frame((dt) => {
    rv.draw();
    if (stage.reduced && !dirty && !drag && !kicks.length) return;
    if (!touched && !stage.reduced) {                                           // the self-demo: fan, hold, scatter, resolve; repeats until the first touch
      idle += dt;
      if (idle > 3.2) {
        const prev = demoT; demoT += dt;
        if (prev === 0) demoTarget = 1;
        else if (demoT > 2.2 && prev <= 2.2) { scatter(); demoTarget = 0; }
        else if (demoT > 7) demoT = 0;
      }
    }
    let moving = false, left = Math.min(dt, 0.05);
    while (left > 1e-6) { const h = Math.min(left, 1 / 240); moving = step(h) || moving; left -= h; }
    if (moving || dirty) { draw(); dirty = false; }
  }));

  return {
    tune: {
      title: 'Fan color', values: P, defaults: { ...DEF, ...COLOUR_DEF, dark: dark0 ? 1 : 0 },
      groups: [
        { name: 'Cut', items: [{ key: 'rows', label: 'Rows per line', min: 12, max: 45, step: 1 }, { key: 'gap', label: 'Gap', min: 0.05, max: 0.7, step: 0.01 }] },
        { name: 'Fan', items: [{ key: 'fan', label: 'Swing', min: 0, max: 2, step: 0.01 }, { key: 'yaw', label: 'Yaw', min: 0, max: 1.5, step: 0.01 }, { key: 'pitch', label: 'Pitch', min: 0, max: 1.4, step: 0.01 }, { key: 'stretch', label: 'Length', min: 0, max: 2, step: 0.01 }, { key: 'persp', label: 'Perspective', min: 0.6, max: 3, step: 0.01 }] },
        { name: 'Camera (wheel zoom · alt-drag orbit · shift-drag pan)', items: [{ key: 'camYaw', label: 'Orbit left/right', min: -1.5, max: 1.5, step: 0.01 }, { key: 'camPitch', label: 'Orbit up/down', min: -1.5, max: 1.5, step: 0.01 }, { key: 'camRoll', label: 'Roll', min: -1.6, max: 1.6, step: 0.01 }, { key: 'zoom', label: 'Zoom', min: 0.3, max: 4, step: 0.01 }, { key: 'panX', label: 'Pan x', min: -1, max: 1, step: 0.01 }, { key: 'panY', label: 'Pan y', min: -1, max: 1, step: 0.01 }, { key: 'randomCam', label: 'Random start camera', type: 'toggle' }] },
        ...colourGroups(),
        { name: 'Springs', items: [{ key: 'stiff', label: 'Stiffness', min: 30, max: 220, step: 1 }, { key: 'damp', label: 'Damping', min: 0.1, max: 1, step: 0.01 }] },
      ],
      actions: { 'Fan': () => { demoTarget = demoTarget ? 0 : 1; }, 'Stab': () => stab(W / 2, H / 2), 'Scatter': () => scatter(), 'New camera': () => rollCamera(), 'Reset camera': () => { Object.assign(P, { camYaw: DEF.camYaw, camPitch: DEF.camPitch, camRoll: DEF.camRoll, zoom: DEF.zoom, panX: DEF.panX, panY: DEF.panY }); dirty = true; } },
      set(k, v) { P[k] = +v; if (k === 'rows' || k === 'gap') layout(); if (k === 'dark' || k === 'bgTone') applyBg(); dirty = true; },
      reset() { Object.assign(P, DEF, COLOUR_DEF, { dark: dark0 ? 1 : 0 }); applyBg(); layout(); },
    },
    debug: { strips: () => strips, fan: (v) => { demoTarget = v; }, stab, scatter, draw },
    destroy() {
      alive = false; offs.forEach((f) => f()); stage.root.removeEventListener('wheel', onWheel); rv.destroy(); stage.setBackdrop(null);
      gl.deleteTexture(tex); gl.deleteBuffer(vbo); gl.deleteBuffer(ibo); gl.deleteVertexArray(vao); gl.deleteProgram(prog.p);
    },
  };
}
