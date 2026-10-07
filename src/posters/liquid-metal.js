// Liquid metal. Ink's cousin: the same droplets, but the material does not remember where it came from. Pull a letter
// and the metal follows your finger, thins to a thread, and beads into droplets that stay where they land. Push two
// letters together and they fuse and stay fused. Tap and it scatters into beads. Nothing flows back; what you do is
// what is left (double-tap empty space to pour it back into the name).
//
// The droplets are the same particles as Ink: close pairs push apart, displaced pairs pull together (surface tension),
// neighbours share velocity. The difference is memory: each droplet's "home" slowly follows the droplet, so a new shape
// becomes the rest shape after a moment. While it is still settling the surface tension has time to bead it up.
//
// Look: the metaball field is lit as a mirror. Its slope gives a surface normal, the view is reflected in it, and the
// reflection looks into a black room with two small lamps. So the metal is about 95% black, with a few crisp highlights
// that slide over it as it moves, and a faint bright rim where the surface turns away.

import { getGL, compile } from '../engine.js';
import { SKELETON, ratio, radiusFor } from './lettering.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const SPLAT_VS = `#version 300 es
uniform vec2 uRes;
in vec3 iDrop;                                   // x, y (css px) and kernel radius
out vec2 vU;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1) * 2.0 - 1.0, float((gl_VertexID >> 1) & 1) * 2.0 - 1.0);
  vU = c;
  vec2 p = iDrop.xy + c * iDrop.z;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
}`;
const SPLAT_FS = `#version 300 es
precision highp float;
uniform float uScale;
in vec2 vU;
out vec4 o;
void main() {
  float u2 = dot(vU, vU);
  if (u2 >= 1.0) discard;
  float w = (1.0 - u2); w = w * w * w;
  o = vec4(w * uScale, 0.0, 0.0, 0.0);
}`;
const SHOW_VS = `#version 300 es
out vec2 vUv;
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
const BLUR_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uDir;
in vec2 vUv;
out vec4 o;
void main() {
  float w[5] = float[5](0.2270, 0.1946, 0.1216, 0.0540, 0.0162);
  float sum = texture(uSrc, vUv).r * w[0];
  for (int i = 1; i < 5; i++) { vec2 d = uDir * float(i) * 1.6; sum += (texture(uSrc, vUv + d).r + texture(uSrc, vUv - d).r) * w[i]; }
  o = vec4(sum, 0.0, 0.0, 1.0);
}`;
const SHOW_FS = `#version 300 es
precision highp float;
uniform sampler2D uField, uBlur;
uniform vec2 uTexel;
uniform vec3 uInk, uPaper;
uniform float uT, uK;
in vec2 vUv;
out vec4 o;
void main() {
  float f = texture(uField, vUv).r;
  float aa = fwidth(f) * 0.8 + 0.004;
  float mask = smoothstep(uT - aa, uT + aa, f);
  if (mask <= 0.0) { o = vec4(uPaper, 1.0); return; }
  vec2 e = uTexel * 2.0;
  float gx = texture(uBlur, vUv + vec2(e.x, 0.0)).r - texture(uBlur, vUv - vec2(e.x, 0.0)).r;
  float gy = texture(uBlur, vUv + vec2(0.0, e.y)).r - texture(uBlur, vUv - vec2(0.0, e.y)).r;
  vec3 n = normalize(vec3(-gx * uK, -gy * uK, 1.0));
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);                       // the view, bounced off the surface
  float lamp1 = smoothstep(0.90, 0.975, dot(r, normalize(vec3(-0.50, 0.62, 0.60))));        // upper left, a small round lamp
  float lamp2 = smoothstep(0.94, 0.985, dot(r, normalize(vec3(0.58, -0.42, 0.70)))) * 0.7;  // lower right, smaller and dimmer
  float edge = pow(1.0 - n.z, 3.0) * 0.18;                         // the rim, where the surface turns toward the horizon
  float base = 0.02 + 0.03 * n.z;
  float c = clamp(base + lamp1 + lamp2 + edge, 0.0, 1.0);
  o = vec4(mix(uPaper, vec3(c), mask), 1.0);
}`;

export function mount(stage) {
  const canvas = stage.canvas, gl = getGL(canvas);
  if (!gl) throw new Error('webgl2 unavailable');
  const dark = stage.theme.name === 'dark';
  const ink = dark ? [1, 1, 1] : [0, 0, 0], paper = dark ? [0, 0, 0] : [1, 1, 1];
  stage.setBackdrop(dark ? 0 : 1);
  const offs = [];

  let W = 1, H = 1, N = 0;
  let H0X = new Float32Array(1), H0Y = H0X, X = new Float32Array(1), Y = X, VX = X, VY = X, HX = X, HY = X, FX = X, FY = X, GR = new Int16Array(1), DP = X;   // per droplet: position, velocity, home, force, glyph, distance from home
  let sp = 14, R = 22, tR = 12, Tfield = 0.5, scale = 1;                  // droplet spacing, kernel radius, stroke half-thickness, field threshold and gain
  let glyphBox = [];
  let head = new Int32Array(4096), nextIn = new Int32Array(1);
  let lastEmpty = 0, grab = null, press = null, quiet = 0, touched = false, idle = 0, nextRipple = 3.5, ripple = null, acc = 0;

  // ---------- layout: the same composition as the other type posters ----------
  function layout() {
    const portrait = W / H < 0.85;
    const rows = portrait ? ['IDAN', 'SE', 'GEV'] : ['IDAN', 'SEGEV'];
    const padX = Math.max(14, W * 0.045), top = Math.max(18, H * 0.04), bottom = 96;
    const availW = W - 2 * padX, availH = H - top - bottom, gap = 0.06;
    const advance = (c, h) => h * (0.6 * SKELETON[c].wf + 2 * ratio(c, SKELETON[c].wf * h, h) / h + gap);
    let h = Infinity;
    for (const row of rows) h = Math.min(h, availW / [...row].reduce((s, c) => s + advance(c, 1), 0));
    const rowGap = 0.02;
    h = Math.min(h, availH / (rows.length * (1.02 + rowGap)));
    const total = rows.length * h * 1.02 + (rows.length - 1) * h * rowGap;
    let y = top + (availH - total) / 2 + h * 0.51;
    const out = [];
    for (const row of rows) {
      const rowW = [...row].reduce((s, c) => s + advance(c, h), 0);
      let x = (W - rowW) / 2;
      for (const c of row) { const a = advance(c, h); out.push({ ch: c, x: x + a / 2, y, w: SKELETON[c].wf * h, h }); x += a; }
      y += h * (1.02 + rowGap);
    }
    return out;
  }

  // ---------- the droplets ----------
  // Along every stroke of every letter, rows of droplets across its width, so the stroke is filled and the field is smooth.
  function seed() {
    const poses = layout(), pts = [], lat = new Map();
    tR = radiusFor(poses[0].ch, poses[0].w, poses[0].h) * 0.8;               // the stroke's half thickness: a little finer than a rounded tube
    sp = Math.max(6, tR * 0.62);
    R = sp * 1.7;
    const rowsAcross = Math.max(1, Math.round((2 * tR) / sp));
    const near = (x, y) => {                                                  // skip a droplet that would sit on top of one already placed
      const gx = Math.floor(x / sp), gy = Math.floor(y / sp);
      for (let a = gx - 1; a <= gx + 1; a++) for (let b = gy - 1; b <= gy + 1; b++) {
        const l = lat.get(a * 9973 + b); if (l) for (const q of l) if (Math.hypot(q[0] - x, q[1] - y) < sp * 0.62) return true;
      }
      return false;
    };
    poses.forEach((pose, gi) => {
      const x0 = [], x1 = [];
      for (const st of SKELETON[pose.ch].s()) {
        const p = st.pts.map((q) => ({ x: pose.x + q.x * pose.w, y: pose.y + q.y * pose.h }));
        const n = p.length, segs = st.closed ? n : n - 1; let total = 0; const cum = [0];
        for (let i = 0; i < segs; i++) { total += Math.hypot(p[(i + 1) % n].x - p[i].x, p[(i + 1) % n].y - p[i].y); cum.push(total); }
        const count = Math.max(2, Math.round(total / (sp * 0.9)));
        for (let k = 0; k <= count; k++) {
          if (st.closed && k === count) break;
          const d = total * k / count; let j = 1; while (j < cum.length - 1 && cum[j] < d) j++;
          const a = p[(j - 1) % n], b = p[j % n], t = (d - cum[j - 1]) / (cum[j] - cum[j - 1] || 1);
          const cx = a.x + (b.x - a.x) * t, cy = a.y + (b.y - a.y) * t, dl = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / dl, ny = (b.x - a.x) / dl;
          for (let r = 0; r < rowsAcross; r++) {
            const o = (r - (rowsAcross - 1) / 2) * sp, x = cx + nx * o, y = cy + ny * o;
            if (near(x, y)) continue;
            const key = Math.floor(x / sp) * 9973 + Math.floor(y / sp); (lat.get(key) || lat.set(key, []).get(key)).push([x, y]);
            pts.push([x, y, gi]);
          }
        }
      }
    });
    N = pts.length;
    X = new Float32Array(N); Y = new Float32Array(N); VX = new Float32Array(N); VY = new Float32Array(N); HX = new Float32Array(N); HY = new Float32Array(N);
    FX = new Float32Array(N); FY = new Float32Array(N); H0X = new Float32Array(N); H0Y = new Float32Array(N); GR = new Int16Array(N); DP = new Float32Array(N); nextIn = new Int32Array(N);
    pts.forEach((q, i) => { X[i] = HX[i] = H0X[i] = q[0]; Y[i] = HY[i] = H0Y[i] = q[1]; GR[i] = q[2]; });
    glyphBox = poses.map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h }));
    // the threshold: where an infinite stroke of this lattice should end, half a spacing past its outer row
    const wk = (d) => { const u = d / R; return u >= 1 ? 0 : (1 - u * u) ** 3; };
    let sum = 0; const edge = tR;
    for (let i = -8; i <= 8; i++) for (let r = 0; r < rowsAcross; r++) sum += wk(Math.hypot(i * sp * 0.9, edge - (r - (rowsAcross - 1) / 2) * sp));
    Tfield = Math.max(0.05, sum); scale = 0.25 / Tfield;
    grab = null; press = null; quiet = 0; ripple = null;
  }

  // ---------- the liquid ----------
  const K_HOME = 55, K_REP = 5200, K_ATT = 300, K_VISC = 5, DAMP = 7, MAXV = 1400, TAU = 0.45;
  function stepOnce(h) {
    FX.fill(0); FY.fill(0);
    const d0 = sp * 0.86, rc = sp * 2.5;
    // the grab: droplets near the finger are pulled to where the finger has carried them
    if (grab) {
      for (let k = 0; k < grab.ids.length; k++) {
        const i = grab.ids[k], w = grab.w[k];
        FX[i] += (grab.x + grab.ox[k] - X[i]) * 1500 * w; FY[i] += (grab.y + grab.oy[k] - Y[i]) * 1500 * w;
      }
    }
    for (let i = 0; i < N; i++) {
      const dx = HX[i] - X[i], dy = HY[i] - Y[i], disp = Math.hypot(dx, dy);
      DP[i] = disp;
      const k = K_HOME * (grab ? 0.55 : 1);
      FX[i] += dx * k; FY[i] += dy * k;
    }
    if (ripple) {                                                         // the hint: a slow swell runs along one letter
      const u = ripple.t / 2.4;
      if (u >= 1) ripple = null;
      else for (let i = 0; i < N; i++) if (GR[i] === ripple.g) { const ph = (HX[i] - ripple.x0) / (glyphBox[ripple.g].w + 1) * 6 - u * 9; FY[i] += 520 * Math.sin(ph) * Math.sin(Math.PI * u) ** 2; FX[i] += 160 * Math.cos(ph) * Math.sin(Math.PI * u) ** 2; }
    }
    // pairs, through a hashed grid
    const cell = rc, M = head.length - 1;
    head.fill(-1);
    for (let i = 0; i < N; i++) {
      const gx = Math.floor(X[i] / cell), gy = Math.floor(Y[i] / cell);
      for (let a = gx - 1; a <= gx + 1; a++) for (let b = gy - 1; b <= gy + 1; b++) {
        for (let j = head[(a * 73856093 ^ b * 19349663) & M]; j >= 0; j = nextIn[j]) {
          const dx = X[i] - X[j], dy = Y[i] - Y[j];
          if (dx > rc || dx < -rc || dy > rc || dy < -rc) continue;
          const d2 = dx * dx + dy * dy; if (d2 >= rc * rc) continue;
          const d = Math.sqrt(d2) || 0.001, nx = dx / d, ny = dy / d;
          let f = 0;
          if (d < d0) f = K_REP * (d0 - d) / d0;                                         // keep the volume
          else {                                                                           // surface tension, only once the ink has been moved off its place
            const dm = Math.max(DP[i], DP[j]), away = clamp((dm - sp * 0.35) / (sp * 0.9), 0, 1) * (1 - 0.85 * clamp((dm - sp * 4) / (sp * 5), 0, 1)), u = (d - d0) / (rc - d0);   // a long way from home the pull to its neighbours fades, so the ink can flow back
            f = -K_ATT * away * 4 * u * (1 - u);
          }
          const rvx = VX[i] - VX[j], rvy = VY[i] - VY[j], vf = -K_VISC * (1 - d / rc);    // neighbours share velocity: the ink flows as one
          FX[i] += nx * f + rvx * vf; FY[i] += ny * f + rvy * vf; FX[j] -= nx * f + rvx * vf; FY[j] -= ny * f + rvy * vf;
        }
      }
      const hh = (gx * 73856093 ^ gy * 19349663) & M; nextIn[i] = head[hh]; head[hh] = i;
    }
    const floor = H - (W < 720 ? 78 : 70), damp = Math.exp(-DAMP * h), follow = grab ? 0 : 1 - Math.exp(-h / TAU);   // while held the old shape is kept; after, it is forgotten
    let e = 0;
    for (let i = 0; i < N; i++) {
      VX[i] = (VX[i] + FX[i] * h) * damp; VY[i] = (VY[i] + FY[i] * h) * damp;
      const v = Math.hypot(VX[i], VY[i]); if (v > MAXV) { VX[i] *= MAXV / v; VY[i] *= MAXV / v; }
      X[i] += VX[i] * h; Y[i] += VY[i] * h;
      HX[i] += (X[i] - HX[i]) * follow; HY[i] += (Y[i] - HY[i]) * follow;
      const m = R * 0.4;
      if (X[i] < m) { X[i] = m; VX[i] = Math.abs(VX[i]) * 0.3; } else if (X[i] > W - m) { X[i] = W - m; VX[i] = -Math.abs(VX[i]) * 0.3; }
      if (Y[i] < m) { Y[i] = m; VY[i] = Math.abs(VY[i]) * 0.3; } else if (Y[i] > floor) { Y[i] = floor; VY[i] = -Math.abs(VY[i]) * 0.3; }
      e += VX[i] * VX[i] + VY[i] * VY[i] + DP[i] * DP[i] * 0.01;
    }
    return Math.sqrt(e / Math.max(1, N));
  }

  // ---------- drawing ----------
  const splat = compile(gl, SPLAT_VS, SPLAT_FS), show = compile(gl, SHOW_VS, SHOW_FS), blur = compile(gl, SHOW_VS, BLUR_FS);
  const vaoSplat = gl.createVertexArray(), vaoShow = gl.createVertexArray();
  const dropBuf = gl.createBuffer();
  const dropLoc = gl.getAttribLocation(splat.p, 'iDrop');
  let drops = new Float32Array(3), fieldTex = null, tmpTex = null, blurTex = null, fbo = null, fboTmp = null, fboBlur = null, FW = 1, FH = 1;
  const makeTarget = (old) => {
    if (old.t) gl.deleteTexture(old.t);
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, FW, FH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = old.f || gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f };
  };
  function sizeField() {
    FW = Math.max(2, Math.round(stage.pw * 0.5)); FH = Math.max(2, Math.round(stage.ph * 0.5));
    const a = makeTarget({ t: fieldTex, f: fbo }), b = makeTarget({ t: tmpTex, f: fboTmp }), c = makeTarget({ t: blurTex, f: fboBlur });
    fieldTex = a.t; fbo = a.f; tmpTex = b.t; fboTmp = b.f; blurTex = c.t; fboBlur = c.f;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  function draw() {
    if (drops.length < N * 3) drops = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { drops[i * 3] = X[i]; drops[i * 3 + 1] = Y[i]; drops[i * 3 + 2] = R; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, FW, FH);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.disable(gl.DEPTH_TEST);
    splat.use(); gl.uniform2f(splat.u.uRes, W, H); gl.uniform1f(splat.u.uScale, scale);
    gl.bindVertexArray(vaoSplat);
    gl.bindBuffer(gl.ARRAY_BUFFER, dropBuf); gl.bufferData(gl.ARRAY_BUFFER, drops.subarray(0, N * 3), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(dropLoc); gl.vertexAttribPointer(dropLoc, 3, gl.FLOAT, false, 12, 0); gl.vertexAttribDivisor(dropLoc, 1);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, N);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(vaoShow); blur.use();                                              // smooth the field, so the surface normals (and the highlights) are clean
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboTmp); gl.bindTexture(gl.TEXTURE_2D, fieldTex); gl.uniform1i(blur.u.uSrc, 0); gl.uniform2f(blur.u.uDir, 1 / FW, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboBlur); gl.bindTexture(gl.TEXTURE_2D, tmpTex); gl.uniform2f(blur.u.uDir, 0, 1 / FH); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, stage.pw, stage.ph);
    show.use();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fieldTex); gl.uniform1i(show.u.uField, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, blurTex); gl.uniform1i(show.u.uBlur, 1); gl.activeTexture(gl.TEXTURE0);
    gl.uniform3fv(show.u.uInk, ink); gl.uniform3fv(show.u.uPaper, paper); gl.uniform1f(show.u.uT, 0.25); gl.uniform2f(show.u.uTexel, 1 / FW, 1 / FH); gl.uniform1f(show.u.uK, 7);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---------- touch ----------
  let pid = null;
  const nearest = (q) => { let best = -1, bd = (tR * 2.4) ** 2; for (let i = 0; i < N; i++) { const d = (X[i] - q.x) ** 2 + (Y[i] - q.y) ** 2; if (d < bd) { bd = d; best = i; } } return best; };
  offs.push(stage.on('down', (q, e) => {
    if (pid !== null) return;
    const i = nearest(q);
    if (i < 0) { const now = performance.now(); if (now - lastEmpty < 380) reform(); lastEmpty = now; return; }
    pid = e.pointerId; touched = true; ripple = null; quiet = 0;
    const rg = tR * 2.6, ids = [], ox = [], oy = [], w = [];
    for (let k = 0; k < N; k++) {
      const d = Math.hypot(X[k] - q.x, Y[k] - q.y);
      if (d < rg) { ids.push(k); ox.push(X[k] - q.x); oy.push(Y[k] - q.y); w.push((1 - (d / rg) ** 2) ** 2); }
    }
    grab = { ids, ox, oy, w, x: q.x, y: q.y };
    press = { x: q.x, y: q.y, t: performance.now(), moved: 0 };
  }));
  offs.push(stage.on('move', (q, e) => {
    if (pid !== null && e.pointerId !== pid) return;
    if (grab) { press.moved = Math.max(press.moved, Math.hypot(q.x - press.x, q.y - press.y)); grab.x = clamp(q.x, 4, W - 4); grab.y = clamp(q.y, 4, H - 4); quiet = 0; }
    else if (q.type === 'mouse') stage.root.style.cursor = nearest(q) >= 0 ? 'grab' : '';
  }));
  offs.push(stage.on('up', (q, e) => {
    if (e.pointerId !== pid) return;
    if (press && press.moved < 8 && performance.now() - press.t < 260) {                // a tap: a splash out from where it landed
      const rs = tR * 4.2;
      for (let k = 0; k < N; k++) {
        const dx = X[k] - q.x, dy = Y[k] - q.y, d = Math.hypot(dx, dy) || 1;
        if (d < rs) { const f = (1 - d / rs) ** 1.3 * (520 + Math.random() * 380); VX[k] += dx / d * f + (Math.random() - 0.5) * 140; VY[k] += dy / d * f + (Math.random() - 0.5) * 140; }
      }
    }
    grab = null; press = null; pid = null; quiet = 0;
  }));

  function resize() { W = stage.W; H = stage.H; seed(); sizeField(); draw(); }
  offs.push(stage.on('resize', resize));
  resize();

  offs.push(stage.frame((dt) => {
    if (stage.reduced && quiet > 2) return;
    if (!touched && !stage.reduced) {                                                      // the hint, until the first touch: now and then a slow swell runs along one letter
      idle += dt;
      if (idle > nextRipple && !ripple) { ripple = { g: Math.floor(Math.random() * glyphBox.length), t: 0, x0: 0 }; ripple.x0 = glyphBox[ripple.g].x - glyphBox[ripple.g].w / 2; nextRipple = idle + 5 + Math.random() * 3; quiet = 0; }
    }
    acc = Math.min(acc + dt, 0.05);
    let e = 0, ran = false;
    while (acc >= 1 / 60) {
      acc -= 1 / 60; ran = true;
      if (ripple) ripple.t += 1 / 60;
      for (let s = 0; s < 3; s++) e = stepOnce(1 / 180);
    }
    if (!ran) return;
    quiet = !grab && !ripple && e < 0.25 ? quiet + 1 : 0;
    if (quiet < 30) draw();
    else if (quiet === 30) { VX.fill(0); VY.fill(0); draw(); }
  }));

  const reform = () => { for (let i = 0; i < N; i++) { X[i] = HX[i] = H0X[i]; Y[i] = HY[i] = H0Y[i]; VX[i] = VY[i] = 0; } quiet = 0; };
  return {
    tune: { title: 'Liquid metal', values: {}, defaults: {}, groups: [], actions: { 'Re-form': reform }, set() {}, reset() { reform(); } },
    debug: { pull: (cx, cy, r, dx, dy) => { for (let i = 0; i < N; i++) { const d = Math.hypot(X[i] - cx, Y[i] - cy); if (d < r) { const w = (1 - (d / r) ** 2) ** 2; X[i] += dx * w; Y[i] += dy * w; } } quiet = 0; }, count: () => N, step: () => stepOnce(1 / 180), draw: () => draw(), state: () => ({ sp, R, tR, Tfield, scale, grab: !!grab, far: Array.from(DP).filter((v) => v > 25).length, maxDp: Math.max(...DP), vmax: Math.max(...VX.map(Math.abs)) }) },
    destroy() { offs.forEach((f) => f()); stage.root.style.cursor = ''; stage.setBackdrop(null); },
  };
}
