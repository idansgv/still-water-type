// Liquid metal, with mercury's temper. Ink's cousin: the same droplets, but the material does not remember where it came from. Pull a letter
// and the metal follows your finger, thins to a thread, and beads into droplets that stay where they land. Push two
// letters together and they fuse and stay fused. Tap and it scatters into beads. Nothing flows back; what you do is
// what is left (double-tap empty space to pour it back into the name).
//
// Mercury behaviour: the metal has two moods. Left alone it holds its shape (letters stay letters). Disturbed (pulled, splashed,
// shoved by another bead) it becomes agitated, and agitation spreads through whatever is touching: then the home is forgotten,
// the surface tension takes over at full strength, it stops being sticky and flows freely. Strong tension and little friction
// make it pull into round beads that roll, skitter, hit each other and merge, and trail off into smaller beads when it is
// stretched. When the agitation dies away (a few seconds) everything stays where it ended. On a phone, tilting it rolls the beads.
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
uniform float uT, uK, uRim, uBase, uInv, uChrome;
uniform vec3 uLamp1, uLamp2;                                       // brightness, and the two edges of the highlight
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
  float lamp1 = smoothstep(uLamp1.y, uLamp1.z, dot(r, normalize(vec3(-0.50, 0.62, 0.60)))) * uLamp1.x;        // upper left, a small round lamp
  float lamp2 = smoothstep(uLamp2.y, uLamp2.z, dot(r, normalize(vec3(0.58, -0.42, 0.70)))) * uLamp2.x;  // lower right, smaller and dimmer
  float edge = pow(1.0 - n.z, 3.0) * uRim;                         // the rim, where the surface turns toward the horizon
  float base = uBase + 0.03 * n.z;
  float c = clamp(base + lamp1 + lamp2 + edge, 0.0, 1.0);
  float chrome = 0.03 + 0.80 * smoothstep(0.04, 0.34, r.y) + 0.45 * smoothstep(0.30, 0.62, -r.x) * smoothstep(-0.2, 0.2, r.y + 0.1);   // a bright sky above and to the left, a dark room below
  chrome = clamp(chrome * (0.55 + 0.45 * smoothstep(0.55, 0.95, r.z) * 0.0 + 0.45) + lamp1 + lamp2, 0.0, 1.0);
  float v = uInv > 0.5 ? mix(1.0 - c, chrome, uChrome) : c;          // on a black page: chrome (dark middle, bright edges), or the inverted metal
  o = vec4(mix(uPaper, vec3(v), mask), 1.0);
}`;

export function mount(stage) {
  const canvas = stage.canvas, gl = getGL(canvas);
  if (!gl) throw new Error('webgl2 unavailable');
  const dark = stage.theme.name === 'dark';
  const ink = dark ? [1, 1, 1] : [0, 0, 0], paper = dark ? [0, 0, 0] : [1, 1, 1];
  stage.setBackdrop(dark ? 0 : 1);
  const offs = [];

  let W = 1, H = 1, N = 0;
  let H0X = new Float32Array(1), H0Y = H0X, X = new Float32Array(1), Y = X, VX = X, VY = X, HX = X, HY = X, FX = X, FY = X, GR = new Int16Array(1), DP = X, AG = X, AG2 = X;   // per droplet: position, velocity, home, force, glyph, distance from home
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
    FX = new Float32Array(N); FY = new Float32Array(N); H0X = new Float32Array(N); H0Y = new Float32Array(N); GR = new Int16Array(N); DP = new Float32Array(N); AG = new Float32Array(N); AG2 = new Float32Array(N); nextIn = new Int32Array(N);
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
  // The settings (panel: ?tune or T). Defaults are deliberately calm; raise tension and agitation for wilder mercury.
  const DEFAULTS = {
    tension: 400, volume: 6200, sticky: 5, friction: 12.5, spread: 0.92, calm: 1.1, trigger: 240, bounce: 0.5, tilt: 300,
    home: 70, forget: 0.15, maxV: 1000,
    splash: 0.6, splashR: 4.2, grabR: 2.6, grabK: 1500,
    shine: 6, chrome: 1, lamp1: 1.05, lamp1Size: 0.075, lamp2: 0.7, lamp2Size: 0.04, rim: 0.18, base: 0.02,
  };
  const P = { ...DEFAULTS };
  const tilting = matchMedia('(pointer: coarse)').matches;
  function stepOnce(h) {
    FX.fill(0); FY.fill(0);
    const d0 = sp * 0.86, rc = sp * 2.5;
    // the grab: droplets near the finger are pulled to where the finger has carried them
    if (grab) {
      for (let k = 0; k < grab.ids.length; k++) {
        const i = grab.ids[k], w = grab.w[k];
        FX[i] += (grab.x + grab.ox[k] - X[i]) * P.grabK * w; FY[i] += (grab.y + grab.oy[k] - Y[i]) * P.grabK * w; AG[i] = 1;
      }
    }
    for (let i = 0; i < N; i++) {
      const dx = HX[i] - X[i], dy = HY[i] - Y[i], disp = Math.hypot(dx, dy);
      DP[i] = disp;
      const a = AG[i], k = P.home * (grab ? 0.55 : 1) * (1 - a) * (1 - a);                 // an agitated drop has forgotten where it lives
      FX[i] += dx * k; FY[i] += dy * k;
      AG2[i] = a * Math.exp(-h / P.calm);
      if (tilting && a > 0.02) { FX[i] += stage.look.x * P.tilt * a; FY[i] -= stage.look.y * P.tilt * a; }   // tilt the table: loose beads roll downhill
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
          if (d < d0) f = P.volume * (d0 - d) / d0;                                         // keep the volume
          const am = Math.max(AG[i], AG[j]);
          if (d >= d0) {                                                                    // surface tension, at full strength once it is agitated, absent while it rests
            const u = (d - d0) / (rc - d0), t = clamp((am - 0.05) / 0.45, 0, 1);
            f = -P.tension * t * t * (3 - 2 * t) * 4 * u * (1 - u);
          }
          if (AG2[i] < am * P.spread) AG2[i] = am * P.spread; if (AG2[j] < am * P.spread) AG2[j] = am * P.spread;   // agitation spreads to whatever touches
          const rvx = VX[i] - VX[j], rvy = VY[i] - VY[j], vf = -P.sticky * (1 - d / rc) * (1 - 0.75 * am);   // and agitated metal is barely sticky
          FX[i] += nx * f + rvx * vf; FY[i] += ny * f + rvy * vf; FX[j] -= nx * f + rvx * vf; FY[j] -= ny * f + rvy * vf;
        }
      }
      const hh = (gx * 73856093 ^ gy * 19349663) & M; nextIn[i] = head[hh]; head[hh] = i;
    }
    const floor = H - (W < 720 ? 78 : 70), follow = grab ? 0 : 1 - Math.exp(-h / P.forget);   // while held the old shape is kept; after, it is forgotten
    let e = 0;
    for (let i = 0; i < N; i++) {
      const damp = Math.exp(-P.friction * (1 - 0.7 * AG[i]) * h);                            // mercury has almost no friction
      VX[i] = (VX[i] + FX[i] * h) * damp; VY[i] = (VY[i] + FY[i] * h) * damp;
      const sp2 = Math.abs(VX[i]) + Math.abs(VY[i]); if (sp2 > P.trigger && AG2[i] < 1) AG2[i] = Math.min(1, AG2[i] + (sp2 - P.trigger) / 600);   // a bead that is moving fast keeps itself agitated
      AG[i] = AG2[i];
      const v = Math.hypot(VX[i], VY[i]); if (v > P.maxV) { VX[i] *= P.maxV / v; VY[i] *= P.maxV / v; }
      X[i] += VX[i] * h; Y[i] += VY[i] * h;
      const fl = ripple && GR[i] === ripple.g ? 0 : follow; HX[i] += (X[i] - HX[i]) * fl; HY[i] += (Y[i] - HY[i]) * fl;
      const m = R * 0.4;
      if (X[i] < m) { X[i] = m; VX[i] = Math.abs(VX[i]) * P.bounce; } else if (X[i] > W - m) { X[i] = W - m; VX[i] = -Math.abs(VX[i]) * P.bounce; }
      if (Y[i] < m) { Y[i] = m; VY[i] = Math.abs(VY[i]) * P.bounce; } else if (Y[i] > floor) { Y[i] = floor; VY[i] = -Math.abs(VY[i]) * P.bounce; }
      e += VX[i] * VX[i] + VY[i] * VY[i] + DP[i] * DP[i] * 0.01 + AG[i] * AG[i] * 4;
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
    gl.uniform3fv(show.u.uInk, ink); gl.uniform3fv(show.u.uPaper, paper); gl.uniform1f(show.u.uT, 0.25); gl.uniform2f(show.u.uTexel, 1 / FW, 1 / FH); gl.uniform1f(show.u.uInv, dark ? 1 : 0); gl.uniform1f(show.u.uChrome, P.chrome); gl.uniform1f(show.u.uK, P.shine); gl.uniform1f(show.u.uRim, P.rim); gl.uniform1f(show.u.uBase, P.base);
    gl.uniform3f(show.u.uLamp1, P.lamp1, 1 - P.lamp1Size * 1.35, 1 - P.lamp1Size * 0.35); gl.uniform3f(show.u.uLamp2, P.lamp2, 1 - P.lamp2Size * 1.5, 1 - P.lamp2Size * 0.4);
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
    const rg = tR * P.grabR, ids = [], ox = [], oy = [], w = [];
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
      const rs = tR * P.splashR;
      for (let k = 0; k < N; k++) {
        const dx = X[k] - q.x, dy = Y[k] - q.y, d = Math.hypot(dx, dy) || 1;
        if (d < rs) { const f = (1 - d / rs) ** 1.1 * (760 + Math.random() * 560) * P.splash; VX[k] += dx / d * f + (Math.random() - 0.5) * 220 * P.splash; VY[k] += dy / d * f + (Math.random() - 0.5) * 220 * P.splash; AG[k] = AG2[k] = 1; }
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

  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  const reform = () => { for (let i = 0; i < N; i++) { X[i] = HX[i] = H0X[i]; Y[i] = HY[i] = H0Y[i]; VX[i] = VY[i] = 0; } quiet = 0; };
  return {
    tune: {
      title: 'Liquid metal', values: P, defaults: DEFAULTS,
      groups: [
        { name: 'Mercury', items: [Ctl('tension', 'Surface tension (beading)', 100, 3500, 50), Ctl('spread', 'How far agitation spreads', 0.5, 0.995, 0.005), Ctl('calm', 'Calm-down time (s)', 0.2, 6, 0.1), Ctl('trigger', 'Speed that agitates a bead', 60, 700, 10), Ctl('bounce', 'Bounce off the edges', 0, 0.95, 0.05), Ctl('tilt', 'Tilt (touch devices)', 0, 900, 20)] },
        { name: 'Feel', items: [Ctl('sticky', 'Stickiness', 0, 14, 0.5), Ctl('friction', 'Friction', 1, 16, 0.5), Ctl('volume', 'Firmness (volume)', 2000, 12000, 200), Ctl('home', 'Pull to the name (while calm)', 0, 200, 5), Ctl('forget', 'Forgets its shape (s)', 0.05, 2, 0.05), Ctl('maxV', 'Top speed', 400, 3000, 100)] },
        { name: 'Touch', items: [Ctl('splash', 'Splash power', 0, 2, 0.05), Ctl('splashR', 'Splash radius', 1, 9, 0.1), Ctl('grabR', 'Grab radius', 1, 5, 0.1), Ctl('grabK', 'Grab strength', 300, 4000, 100)] },
        { name: 'Look', items: [Ctl('shine', 'Surface relief (highlight spread)', 1, 20, 0.5), Ctl('lamp1', 'Main highlight', 0, 1.5, 0.05), Ctl('lamp1Size', 'Main highlight size', 0.01, 0.2, 0.005), Ctl('lamp2', 'Second highlight', 0, 1.5, 0.05), Ctl('lamp2Size', 'Second highlight size', 0.01, 0.2, 0.005), Ctl('rim', 'Rim light', 0, 0.6, 0.01), Ctl('base', 'Base grey (0 = pure black)', 0, 0.2, 0.005), Ctl('chrome', 'Black page: chrome (1) or inverted (0)', 0, 1, 1)] },
      ],
      actions: { 'Re-form': reform },
      set(key, value) { P[key] = value; quiet = 0; },
      reset() { Object.assign(P, DEFAULTS); reform(); },
    },
    debug: { pull: (cx, cy, r, dx, dy) => { for (let i = 0; i < N; i++) { const d = Math.hypot(X[i] - cx, Y[i] - cy); if (d < r) { const w = (1 - (d / r) ** 2) ** 2; X[i] += dx * w; Y[i] += dy * w; } } quiet = 0; }, count: () => N, step: () => stepOnce(1 / 180), draw: () => draw(), state: () => ({ sp, R, tR, Tfield, scale, grab: !!grab, far: Array.from(DP).filter((v) => v > 25).length, maxDp: Math.max(...DP), vmax: Math.max(...VX.map(Math.abs)) }) },
    destroy() { offs.forEach((f) => f()); stage.root.style.cursor = ''; stage.setBackdrop(null); },
  };
}
