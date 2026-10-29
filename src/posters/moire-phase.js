// Phases (was Moiré phase): Steve Reich's phasing as moiré. Two voices of fine lines, each line bent in 3D and seen in perspective. Voice 1
// holds tempo; voice 2 is the same lines with their bends lagging behind, in Reich's steps (12 per cycle, held a moment on each).
// Inside the letters voice 1 sits half a line over, so the name exists only between the two voices: when they fall back into
// step once a cycle it appears by gestalt, and as voice 2 slips it dissolves into moiré and folds. The bends travel slowly
// through space all the while (Idan's standing drift; frozen under reduced motion). Port of the test page
// docs/posters/prototypes/moire-phase.html; Idan's tuning as defaults.
//
// Under the picture (WebGL2, no buffers): each line is an instanced screen-space ribbon worked out in the vertex shader from its
// ids. Voice 1 samples a screen-space mask of the name and steps half a line over in the field (so it lands between its
// neighbours on the bent surface). Voice 2's spacing and angle part only away from unison (scaled by sin(pi * lag)), so it is
// exactly back in step once a cycle. Width follows depth and the light; lines finer than a pixel fade instead of vanishing.
//
// Gestures (src/gestures.js): drag turns the view through the lines and springs back; tap one beat ahead; hold settles into
// unison and waits; double tap starts over (after the re-form beat). Reveal: voice 2 lifts off, so you see the one plain set of
// lines carrying the name, under a drawing of the two voices.

import { getGL } from '../engine.js';
import { pressTracker, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';
import { createReveal, grid, corners, label, titleBlock, ink as rvInk } from './reveal.js';

const FAMILY = 'Alfa Slab One', NAME = 'IdanSegv';
const DEF = { fold: 0.51, scale: 0.65, breath: 1.07, pitch: 28, yaw: -8, zoom: 2, lines: 178, weight: 0.28, light: 0.69,
  tempo: 0.018, tilt: 1.15, cycle: 50, steps: 12, pause: 0.4, size: 0.79 };   // Idan's tuning on the site, 29 Oct 2026
const PX = 5, PY = 4;                                    // half-extent of the line field in world units; the view is 2 units tall
const SEG = 360;                                         // segments per line
const FOV = 30 * Math.PI / 180;

const VS = `#version 300 es
uniform mat4 uMVP; uniform vec2 uRes; uniform sampler2D uMask;
uniform float uFold, uScale, uT, uPh, uSp, uEps, uTilt, uW, uLight, uFocal, uLetters;
uniform int uN;
out float vD; out float vHalf; out float vA;
vec3 strand(float s, float y0) {
  vec2 q = vec2(s, y0);
  float c = cos(uTilt), si = sin(uTilt);
  q = vec2(c * q.x - si * q.y, si * q.x + c * q.y) / uScale;   // voice 2 leans a hair against voice 1 while it is out of step
  float a = uPh * 6.28318;
  float z = uFold * (0.60 * sin(q.x * 1.10 + q.y * 0.85 + a + uT * 0.6)
                   + 0.24 * sin(q.x * 2.55 - q.y * 1.50 + 1.3 * a + uT)
                   + 0.16 * sin((q.x + q.y) * 1.60 + 2.0 - uT * 0.7));
  float y = y0 + uFold * 0.10 * sin(q.x * 1.65 + q.y * 2.0 + a + uT * 0.5);
  return vec3(s, y, z);
}
vec2 scr(vec4 c) { return c.xy / c.w * 0.5 * uRes; }
// voice 1 steps half a line over wherever it crosses a letter on screen; voice 2 never does
float y0At(float s, float i) {
  float y0 = (i - float(uN) * 0.5) * uSp * (1.0 + uEps);
  if (uLetters > 0.5) {
    vec4 c = uMVP * vec4(strand(s, y0), 1.0);
    y0 += 0.5 * uSp * textureLod(uMask, c.xy / c.w * 0.5 + 0.5, 0.0).r;
  }
  return y0;
}
void main() {
  int k = gl_VertexID / 2; float side = float(gl_VertexID % 2) * 2.0 - 1.0;
  float i = float(gl_InstanceID);
  float ds = ${(2 * PX / SEG).toFixed(6)};
  float s = -${PX.toFixed(1)} + float(k) * ds;
  float y0 = y0At(s, i);
  vec3 p = strand(s, y0), pn = strand(s + ds * 0.5, y0At(s + ds * 0.5, i));
  vec4 c = uMVP * vec4(p, 1.0), cn = uMVP * vec4(pn, 1.0);
  vec2 a = scr(c), t = scr(cn) - a;
  vec2 n = length(t) > 1e-5 ? normalize(vec2(-t.y, t.x)) : vec2(0.0, 1.0);
  // lines thicken in shade and thin where the light hits, from the slope of the bends
  vec3 nrm = normalize(cross(pn - p, strand(s, y0 + uSp) - p)); if (nrm.z < 0.0) nrm = -nrm;
  float lit = clamp(dot(nrm, normalize(vec3(-0.5, 0.6, 0.65))), 0.0, 1.0);
  float w = clamp(uW * mix(1.0, 1.6 - 1.2 * lit, uLight), 0.06, 0.94);
  float wpx = w * uSp * uFocal / c.w;                    // width in device pixels, shrinking with depth
  vHalf = max(wpx, 1.0) * 0.5; vA = min(wpx, 1.0);        // finer than a pixel: keep a pixel, fade it
  float hw = vHalf + 1.0; vD = side * hw;
  gl_Position = vec4((a + n * side * hw) / (0.5 * uRes) * c.w, 0.0, c.w);
}`;
const FS = `#version 300 es
precision highp float;
in float vD; in float vHalf; in float vA;
uniform vec3 uInk; uniform float uAlpha;
out vec4 o;
void main() { o = vec4(uInk, clamp(vHalf + 0.5 - abs(vD), 0.0, 1.0) * vA * uAlpha); }`;

// camera
const mul = (a, b) => { const r = new Float32Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; r[i * 4 + j] = s; } return r; };
const persp = (fov, asp, n, f) => { const t = 1 / Math.tan(fov / 2);
  return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]); };
const look = (e) => {
  const nrm = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
  const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const f = nrm(e.map((x) => -x)), s = nrm(cr(f, [0, 1, 0])), v = cr(s, f);
  return new Float32Array([s[0], v[0], -f[0], 0, s[1], v[1], -f[1], 0, s[2], v[2], -f[2], 0, -dot(s, e), -dot(v, e), dot(f, e), 1]);
};

export async function mount(stage) {
  const canvas = stage.canvas, gl = getGL(canvas);
  if (!gl) throw new Error('webgl2 unavailable');
  const dark = stage.theme.name === 'dark';
  const P = { ...DEF };
  const offs = [];
  let alive = true;
  stage.setBackdrop(dark ? 0 : 1);

  // ---------- the face: Alfa Slab One from Google Fonts, only the letters of the name ----------
  const link = document.createElement('link'); link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${FAMILY.replace(/ /g, '+')}&text=${encodeURIComponent(NAME)}&display=block`;
  document.head.appendChild(link);
  await Promise.race([new Promise((r) => { link.onload = r; link.onerror = r; }), new Promise((r) => setTimeout(r, 2500))]);
  try { await Promise.race([document.fonts.load(`400 100px "${FAMILY}"`, 'Idan Segev'), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* the fallback face */ }

  // ---------- GL ----------
  const prog = gl.createProgram();
  for (const [t, s] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]]) { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); gl.attachShader(prog, x); gl.deleteShader(x); }
  gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  const uc = {}, u = (n) => uc[n] ?? (uc[n] = gl.getUniformLocation(prog, n));
  const vao = gl.createVertexArray();                    // no attributes: every vertex is worked out from its ids

  // ---------- the name, on the screen, so it reads from any angle; only voice 1 knows about it ----------
  const mc = document.createElement('canvas'), mx = mc.getContext('2d');
  const maskT = gl.createTexture();
  let W = stage.W, H = stage.H;
  function buildMask() {
    W = stage.W; H = stage.H;
    mc.width = W; mc.height = H; mx.fillStyle = '#000'; mx.fillRect(0, 0, W, H);
    const lines = W / H < 1.3 ? ['Idan', 'Segev'] : ['Idan Segev'];
    const face = (s) => `400 ${s}px "${FAMILY}", "Arial Black", serif`;
    mx.font = face(100); const wide = Math.max(...lines.map((l) => mx.measureText(l).width));
    const lh = 0.98, px = Math.min(100 * W * P.size / wide, H * 0.7 / (lines.length * lh));
    mx.font = face(px); mx.fillStyle = '#fff'; mx.textAlign = 'center';
    const met = mx.measureText('ISg'), cap = met.actualBoundingBoxAscent, desc = met.actualBoundingBoxDescent;
    const top = (H - (cap + desc + (lines.length - 1) * px * lh)) / 2 + cap;
    lines.forEach((l, i) => mx.fillText(l, W / 2, top + i * px * lh));
    gl.bindTexture(gl.TEXTURE_2D, maskT); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, mc); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  }

  // ---------- the second player: a clock that drifts ahead in Reich's steps, plus whatever the hand adds ----------
  let tau = 0, off = 0, offT = 0, lock = 0, t = 0, lift = 0;
  let orbX = 0, orbY = 0, orbXT = 0, orbYT = 0;
  const sched = (x) => {
    const n = P.steps; if (!n) return x;
    const s = x * n, k = Math.floor(s), f = s - k, h = P.pause;
    const g = f < h ? 0 : (f - h) / (1 - h);
    return (k + g * g * (3 - 2 * g)) / n;
  };
  const beat = () => 1 / (P.steps || 12);

  // ---------- input ----------
  const press = pressTracker();
  let lastTap = -1, tapT = 0, drag = null;
  offs.push(stage.on('down', (q, e) => { if (press.down(q, e.pointerId)) drag = { x: q.x, y: q.y, ox: orbXT, oy: orbYT }; }));
  offs.push(stage.on('move', (q, e) => {
    press.move(q, e.pointerId);
    if (!drag || !press.active || press.moved < 8) return;          // a drag turns the view through the lines, then springs back
    orbXT = Math.max(-50, Math.min(50, drag.ox + (q.x - drag.x) / W * 90));
    orbYT = Math.max(-P.pitch, Math.min(58 - P.pitch, drag.oy - (q.y - drag.y) / H * 70));
  }));
  offs.push(stage.on('up', (q, e) => {
    const r = press.up(q, e.pointerId);
    if (!r) return;
    drag = null;
    if (!r.tap || stage.revealed) return;
    const now = performance.now();
    clearTimeout(tapT);
    if (lastTap >= 0 && now - lastTap < DOUBLE_MS) {                                                      // start over, from unison
      lastTap = -1; tapT = setTimeout(() => { if (alive && !stage.revealed) { tau = 0; offT = Math.round(off); } }, REFORM_DELAY_MS);
    } else { lastTap = now; tapT = setTimeout(() => { if (alive && !stage.revealed) offT += beat(); }, DOUBLE_MS); }   // one beat ahead
  }));

  // ---------- reveal: voice 2 lifts off; drawn: the two voices ----------
  const rv = createReveal(stage, (c, W_, H_, k) => {
    const colr = (a) => rvInk(stage, a);
    grid(c, W_, H_, 24, colr, k); corners(c, W_, H_, 16, colr, k);
    const ph = sched(tau) + off, lag = ph - Math.floor(ph);
    // the two voices as a score: voice 1 solid, voice 2 dashed, its bends behind by the lag
    c.lineWidth = 1.2;
    for (let r = 0; r < 7; r++) {
      const y0 = H_ * (0.14 + r * 0.11);
      [[0, []], [lag, [5, 5]]].forEach(([l, dash]) => {
        c.setLineDash(dash); c.strokeStyle = colr(0.75 * k); c.beginPath();
        for (let x = 0; x <= W_; x += 8) { const y = y0 + 14 * Math.sin(x / W_ * 9 + r * 0.8 + l * 6.283); x ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.stroke();
      });
    }
    c.setLineDash([]);
    label(c, 'voice 1 · holds tempo · half a line over inside the letters', 40, 50, colr, k);
    label(c, '- - voice 2 · the same lines, lagging', 40, 66, colr, k);
    titleBlock(c, W_, H_, ['PHASES · STRUCTURE', 'voice 2 lifted off: one set of lines', `voice 2 lags ${Math.round(lag * (P.steps || 12))} of ${P.steps || 12} beats`, `${P.lines} lines · cycle ${P.cycle} s`], colr, k);
  }, { dim: 0.6 });

  // ---------- settings ----------
  const Ctl = (key, label2, min, max, step) => ({ key, label: label2, min, max, step });
  const tune = {
    title: 'Phases', values: P, defaults: DEF,
    groups: [
      { name: 'Space', items: [Ctl('fold', 'Bend depth', 0, 0.8, 0.01), Ctl('scale', 'Bend size (small to large)', 0.2, 2, 0.05), Ctl('breath', 'Bends travel (0 = still)', 0, 1.5, 0.01),
        Ctl('pitch', 'View tilt (deg)', 0, 58, 1), Ctl('yaw', 'View turn (deg)', -45, 45, 1), Ctl('zoom', 'Zoom', 0.5, 2.5, 0.05)] },
      { name: 'Lines', items: [Ctl('lines', 'Lines across the height', 40, 260, 2), Ctl('weight', 'Line weight', 0.1, 0.8, 0.01), Ctl('light', 'Light shapes the weight', 0, 1, 0.01)] },
      { name: 'Voice 2', items: [Ctl('tempo', 'Spacing apart at half cycle', -0.06, 0.06, 0.001), Ctl('tilt', 'Angle apart at half cycle (deg)', -8, 8, 0.05),
        Ctl('cycle', 'One full cycle (s)', 6, 120, 1), Ctl('steps', 'Reich steps per cycle (0 = smooth)', 0, 16, 1), Ctl('pause', 'Time held on each step', 0, 0.9, 0.05)] },
      { name: 'Name', items: [Ctl('size', 'Name width', 0.4, 0.96, 0.01)] },
    ],
    set(key, v) { P[key] = v; if (key === 'size') buildMask(); },
    reset() { Object.assign(P, DEF); buildMask(); },
  };

  // ---------- the frame ----------
  const ink = dark ? 1 : 0;
  function frame(dt) {
    const holding = press.holding;
    lock = holding ? Math.min(1, lock + dt * 1.6) : Math.max(0, lock - dt * 1.2);
    if (!stage.reduced && !holding) { tau += dt / P.cycle; t += dt * P.breath; }
    if (holding) { const total = sched(tau) + offT; offT += Math.round(total) - total; }   // hold: back into unison, and wait
    if (!press.active) { orbXT *= Math.exp(-dt / 1.4); orbYT *= Math.exp(-dt / 1.4); }
    const k = 1 - Math.exp(-dt * (drag && press.moved >= 8 ? 18 : 4));
    off += (offT - off) * k; orbX += (orbXT - orbX) * k; orbY += (orbYT - orbY) * k;
    lift += ((stage.revealed ? 1 : 0) - lift) * Math.min(1, dt * (stage.reduced ? 40 : 4));

    const ph = sched(tau) + off, lag = ph - Math.floor(ph), apart = Math.sin(Math.PI * lag);
    const sp = 2 / P.lines, n = Math.ceil(2 * PY / sp);
    const d = 1 / Math.tan(FOV / 2) / P.zoom, pr = (P.pitch + orbY) * Math.PI / 180, yw = (P.yaw + orbX) * Math.PI / 180;
    const mvp = mul(persp(FOV, W / H, 0.05, 40), look([d * Math.sin(pr) * Math.sin(yw), -d * Math.sin(pr) * Math.cos(yw), d * Math.cos(pr)]));

    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, stage.pw, stage.ph);
    gl.clearColor(1 - ink, 1 - ink, 1 - ink, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(prog); gl.bindVertexArray(vao);
    gl.uniformMatrix4fv(u('uMVP'), false, mvp);
    gl.uniform2f(u('uRes'), stage.pw, stage.ph); gl.uniform1f(u('uFocal'), stage.ph / 2 / Math.tan(FOV / 2));
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, maskT); gl.uniform1i(u('uMask'), 0);
    gl.uniform1f(u('uFold'), P.fold); gl.uniform1f(u('uScale'), P.scale); gl.uniform1f(u('uT'), t);
    gl.uniform1f(u('uSp'), sp); gl.uniform1i(u('uN'), n);
    gl.uniform1f(u('uW'), P.weight); gl.uniform1f(u('uLight'), P.light); gl.uniform3f(u('uInk'), ink, ink, ink);
    // voice 1: holds tempo, carries the name
    gl.uniform1f(u('uPh'), 0); gl.uniform1f(u('uEps'), 0); gl.uniform1f(u('uTilt'), 0); gl.uniform1f(u('uLetters'), 1); gl.uniform1f(u('uAlpha'), 1);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, (SEG + 1) * 2, n);
    // voice 2: the same lines, its bends lagging behind; back in step once a cycle
    if (lift < 0.999) {
      const lk = 1 - lock;
      gl.uniform1f(u('uPh'), lag); gl.uniform1f(u('uEps'), P.tempo * apart * lk); gl.uniform1f(u('uTilt'), P.tilt * Math.PI / 180 * apart * lk);
      gl.uniform1f(u('uLetters'), 0); gl.uniform1f(u('uAlpha'), 1 - lift);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, (SEG + 1) * 2, n);
    }
    gl.disable(gl.BLEND);
    rv.draw(performance.now());
  }

  buildMask();
  offs.push(stage.frame((dt) => frame(dt)));
  let rt = 0; offs.push(stage.on('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (alive) buildMask(); }, 120); }));

  return {
    tune,
    debug: { get lag() { const ph = sched(tau) + off; return ph - Math.floor(ph); }, beat: () => { offT += beat(); }, unison: () => { tau = 0; offT = Math.round(off); } },
    destroy() {
      alive = false; clearTimeout(rt); clearTimeout(tapT);
      rv.destroy(); offs.forEach((f) => f());
      gl.deleteTexture(maskT); gl.deleteProgram(prog); gl.deleteVertexArray(vao);
      link.remove(); stage.setBackdrop(null);
    },
  };
}
