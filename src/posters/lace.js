// Lace: the name in sea foam. At rest it is solid, crisp type. Touched, the foam ages the way real foam does (after Open Water,
// github.com/Leonxlnx/open-water, MIT): a whitecap does not shrink as a blob, it opens up along its bubble network. Bubble middles
// open first and the films between them last, so heavy type thins into lace that still reads as the name.
//
// Under the picture (WebGL2, float textures at screen size): foam density, how fast each bit is ageing, and where that bit of foam
// started (so the bubble pattern travels and stretches with the foam instead of sliding under it); a wind field that drags push and
// that decays in a quarter of a second. Drawing: foam shows where a two-scale bubble-raft pattern (Voronoi films) lies below the
// local density; thin films a little dimmer than solid cores. White foam on black, black foam on white (stage.theme).
//
// Gestures (src/gestures.js): hover breathes on it (ages a little); drag ages faster and pulls a little; tap opens a patch of lace;
// hold is a gale that ages everything and blows it along in rows; double tap (after the re-form beat) sends a breaker across that
// lays fresh foam. Reveal: the bubble raft drawn over the page, with the touch's reach. Self-demo: once, after 3.5 s untouched, a slow
// breath crosses the middle and opens some lace; off under reduced motion.

import { pressTracker, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';
import { createReveal, grid, corners, label, titleBlock, ink as rvInk } from './reveal.js';

const FAMILY = 'Bitter', NAME = 'IdanSegv';
const DEF = { big: 8, small: 15, rate: 0.2, floor: 0.11, pull: 1.25, brush: 65, weight: 840 };   // Idan's tuning, 24 Oct 2026

const VS = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
const NOISE = `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + 17.31)); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }`;

// wind: drags push the foam; a gale blows it along in rows; tiny drift is zeroed so still foam stays sharp
const VEL = `#version 300 es
precision highp float;
uniform sampler2D uV; uniform vec2 uRes, uCss; uniform float uDt, uGale, uT;
uniform vec4 uP[8]; uniform vec2 uPv[8]; uniform int uNP;
out vec4 o;
${NOISE}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes, x = uv * uCss;
  vec2 v = texture(uV, uv - texture(uV, uv).xy * uDt / uCss).xy * exp(-uDt / 0.25);
  for (int i = 0; i < 8; i++) { if (i >= uNP) break;
    vec2 d = x - uP[i].xy; v = mix(v, uPv[i], 0.35 * exp(-dot(d, d) / (0.3 * uP[i].z * uP[i].z))); }
  float rowN = vnoise(vec2(x.x * 0.004 - uT * 0.3, x.y * 0.02));
  v = mix(v, vec2(uCss.x * 0.22 * (0.4 + 1.2 * rowN), (vnoise(x * 0.01 + uT) - 0.5) * 40.0), min(1.0, uGale * uDt * 2.0));
  float l = length(v); if (l > 1500.0) v *= 1500.0 / l;
  v *= smoothstep(3.0, 8.0, l);
  o = vec4(v, 0.0, 1.0);
}`;

// foam: R density, G how fast it is ageing, BA where this bit of foam started
const FOAM = `#version 300 es
precision highp float;
uniform sampler2D uS, uV, uMask; uniform vec2 uRes, uCss; uniform float uDt, uRate, uFloor, uGale, uSweep;
uniform vec4 uP[8]; uniform int uNP;
out vec4 o;
${NOISE}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes, x = uv * uCss, px = 1.0 / uRes;
  vec2 src = uv - texture(uV, uv).xy * uDt / uCss;
  vec4 s = texture(uS, src);
  float F = s.r, A = s.g; vec2 X = s.ba;
  float An = 0.25 * (texture(uS, src + vec2(px.x, 0)).g + texture(uS, src - vec2(px.x, 0)).g + texture(uS, src + vec2(0, px.y)).g + texture(uS, src - vec2(0, px.y)).g);
  A = mix(A, An, 0.06) * exp(-uDt / 2.5);
  for (int i = 0; i < 8; i++) { if (i >= uNP) break;
    vec2 d = x - uP[i].xy; A += uP[i].w * exp(-dot(d, d) / (uP[i].z * uP[i].z)); }
  A = min(A + uGale * uDt * 0.6, 3.0);
  float floorF = uFloor * (1.0 - uGale) * (0.7 + 0.6 * vnoise(X * 0.05));
  F = F > floorF ? max(floorF, F - uDt * uRate * A * (0.25 + F)) : F - uDt * 0.05;
  F = max(F, 0.0);
  if (uSweep > -1.0) {                                                 // the breaker: fresh foam where it passes
    float fresh = smoothstep(70.0, 0.0, abs(x.x - uSweep));
    F = mix(F, texture(uMask, uv).r * 1.12, fresh); X = mix(X, x, fresh); A *= 1.0 - fresh;
  }
  o = vec4(F, A, X);
}`;

// drawing: foam shows where a bubble-raft pattern lies below the density; bubble middles open first, the films between them last
const DRAW = `#version 300 es
precision highp float;
uniform sampler2D uS; uniform vec2 uRes; uniform float uBig, uSmall, uLight;
out vec4 o;
${NOISE}
float edge(vec2 p) {
  vec2 c = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(i, j), r = g + 0.15 + 0.7 * hash2(c + g) - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  return sqrt(d2) - sqrt(d1);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec4 s = texture(uS, uv); float F = s.r; vec2 X = s.ba;
  float r1 = clamp(edge(X / uBig) * 2.4, 0.0, 1.0), r2 = clamp(edge(X / uSmall + 9.7) * 2.4, 0.0, 1.0);
  float r = max(max(r1 * 0.97, r2 * 0.72) + (vnoise(X * 0.35) - 0.5) * 0.08, 0.02);
  float e = F - r, a = clamp(e / max(fwidth(e), 0.01) + 0.5, 0.0, 1.0) * step(0.004, F);
  float c = a * mix(0.74, 1.0, smoothstep(0.0, 0.12, e));            // thin films a little dimmer than the cores
  c = uLight > 0.5 ? 1.0 - c : c;
  o = vec4(vec3(c), 1.0);
}`;

export async function mount(stage) {
  const canvas = stage.canvas;
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('webgl2 unavailable');
  const f32 = !!gl.getExtension('EXT_color_buffer_float');
  if (!f32) throw new Error('float render targets unavailable');
  const linear = !!gl.getExtension('OES_texture_float_linear');
  const light = stage.theme.name !== 'dark';                          // light: black foam on white (Idan's pick); dark: white on black
  const P = { ...DEF };
  const offs = [];
  let alive = true;
  stage.setBackdrop(light ? 1 : 0);

  // ---------- the face: Bitter from Google Fonts, only the letters of the name ----------
  const link = document.createElement('link'); link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${FAMILY}:wght@100..900&text=${encodeURIComponent(NAME)}&display=block`;
  document.head.appendChild(link);
  await Promise.race([new Promise((r) => { link.onload = r; link.onerror = r; }), new Promise((r) => setTimeout(r, 2500))]);
  try { await Promise.race([document.fonts.load(`${P.weight} 100px "${FAMILY}"`, NAME), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* the fallback face */ }

  // ---------- GL ----------
  const progs = [];
  const prog = (fs) => {
    const p = gl.createProgram();
    for (const [t, s] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); gl.attachShader(p, x); gl.deleteShader(x); }
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    progs.push(p); const c = {}; return { p, u: (n) => c[n] ?? (c[n] = gl.getUniformLocation(p, n)) };
  };
  const velP = prog(VEL), foamP = prog(FOAM), drawP = prog(DRAW);
  const vao = gl.createVertexArray();
  const target = (w, h, init) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, init || null);
    const f = linear ? gl.LINEAR : gl.NEAREST;
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, f], [gl.TEXTURE_MAG_FILTER, f], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    if (!init) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    return { t, f: fb };
  };
  const free = (x) => { if (x) { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.f); } };

  // ---------- the name: Idan over Segev, as the first foam ----------
  const mc = document.createElement('canvas'), mx = mc.getContext('2d', { willReadFrequently: true });
  const maskT = gl.createTexture();
  let W = stage.W, H = stage.H, sw = 1, shh = 1, S = [], V = [], si = 0, vi = 0;
  function build() {
    W = stage.W; H = stage.H; sw = Math.max(64, W); shh = Math.max(64, H);
    mc.width = sw; mc.height = shh; mx.fillStyle = '#000'; mx.fillRect(0, 0, sw, shh);
    const face = (s) => `${P.weight} ${s}px "${FAMILY}", Georgia, serif`;
    mx.font = face(100);
    const a = mx.measureText('Idan'), b = mx.measureText('Segev'), lead = 92;
    const blockH = a.actualBoundingBoxAscent + lead + b.actualBoundingBoxDescent, blockW = Math.max(a.width, b.width);
    const m = Math.max(24, Math.min(W, H) * 0.07), foot = 48;
    const s = Math.min((sw - 2 * m) / blockW, (shh - 2 * m - foot) / blockH) * 100;
    mx.font = face(s); mx.fillStyle = '#fff'; mx.textAlign = 'center';
    const top = (shh - foot - blockH * s / 100) / 2 + a.actualBoundingBoxAscent * s / 100;
    mx.fillText('Idan', sw / 2, top); mx.fillText('Segev', sw / 2, top + lead * s / 100);
    const img = mx.getImageData(0, 0, sw, shh).data, n = sw * shh;
    const state = new Float32Array(n * 4), mk = new Float32Array(n * 4);
    for (let y = 0; y < shh; y++) for (let x = 0; x < sw; x++) {
      const m2 = img[((shh - 1 - y) * sw + x) * 4] / 255, o = (y * sw + x) * 4;
      state[o] = m2 * 1.12; state[o + 2] = (x + 0.5) / sw * W; state[o + 3] = (y + 0.5) / shh * H; mk[o] = m2;
    }
    S.forEach(free); V.forEach(free);
    S = [target(sw, shh, state), target(sw, shh)]; V = [target(sw, shh), target(sw, shh)]; si = 0; vi = 0;
    gl.bindTexture(gl.TEXTURE_2D, maskT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, sw, shh, 0, gl.RGBA, gl.FLOAT, mk);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  // ---------- input ----------
  let puffs = [], gale = 0, sweep = -1e9, touched = false, demoT = -1, demoDone = !!stage.reduced;
  const born = performance.now();
  const touch = (x, y, age, vx, vy, rad = P.brush) => puffs.push([x, H - y, rad, age, vx, -vy]);
  const take = () => { touched = true; demoT = -1; demoDone = true; };
  const press = pressTracker();
  let lastTap = -1, reform = 0, last = null;
  offs.push(stage.on('down', (q, e) => { take(); press.down(q, e.pointerId); last = { x: q.x, y: q.y, t: performance.now() }; }));
  offs.push(stage.on('move', (q, e) => {
    press.move(q, e.pointerId);
    if (q.type !== 'mouse' && !q.down) return;
    const now = performance.now();
    if (!last) { last = { x: q.x, y: q.y, t: now }; return; }
    const dx = q.x - last.x, dy = q.y - last.y, d = Math.hypot(dx, dy), dt = Math.max(8, now - last.t) / 1000;
    if (d < 2) return;
    take();
    const drag = q.down, k = stage.reduced ? 0.5 : 1;
    const vx = Math.max(-700, Math.min(700, dx / dt)), vy = Math.max(-700, Math.min(700, dy / dt));
    touch(q.x, q.y, (drag ? 0.35 : 0.06) * k, vx * P.pull * (drag ? 0.14 : 0.03) * k, vy * P.pull * (drag ? 0.14 : 0.03) * k, drag ? P.brush : P.brush * 0.8);
    last = { x: q.x, y: q.y, t: now };
  }));
  offs.push(stage.on('up', (q, e) => {
    const r = press.up(q, e.pointerId);
    if (q.type !== 'mouse') last = null;
    if (!r || !r.tap) return;
    const now = performance.now();
    clearTimeout(reform);
    if (lastTap >= 0 && now - lastTap < DOUBLE_MS) { lastTap = -1; reform = setTimeout(() => { if (alive && !stage.revealed) sweep = -80; }, REFORM_DELAY_MS); }
    else { lastTap = now; touch(q.x, q.y, 1.2 * (stage.reduced ? 0.5 : 1), 0, 0, P.brush * 0.9); }
  }));

  // ---------- reveal: the bubble raft, both scales, and the touch's reach ----------
  const rv = createReveal(stage, (c, W_, H_, k) => {
    const colr = (a) => rvInk(stage, a);
    grid(c, W_, H_, 24, colr, k); corners(c, W_, H_, 16, colr, k);
    c.strokeStyle = colr(0.35 * k); c.lineWidth = 1; c.beginPath();                 // the raft: a sketch of bubbles at the small scale
    const step = Math.max(12, P.small * 1.6), r0 = P.small * 0.45;
    for (let yy = step / 2, j = 0; yy < H_; yy += step, j++) for (let xx = (j % 2) * step / 2; xx < W_; xx += step) { c.moveTo(xx + r0, yy); c.arc(xx, yy, r0, 0, Math.PI * 2); }
    c.stroke();
    c.strokeStyle = colr(0.8 * k);
    const x = stage.ptr.x, y = stage.ptr.y;
    c.beginPath(); c.arc(x, y, P.brush, 0, Math.PI * 2); c.stroke();
    label(c, `touch  ${P.brush} px`, x + P.brush + 8, y, colr, k);
    titleBlock(c, W_, H_, ['LACE · STRUCTURE', `bubbles ${P.big} px and ${P.small} px`, 'foam shows where its density', 'is above the bubble pattern', `ageing ${P.rate} · lace kept ${P.floor}`], colr, k);
  }, { dim: 0.5 });

  // ---------- settings ----------
  const Ctl = (key, label2, min, max, step) => ({ key, label: label2, min, max, step });
  const tune = {
    title: 'Lace', values: P, defaults: DEF,
    groups: [
      { name: 'Foam', items: [Ctl('big', 'Big bubbles (px)', 4, 60, 1), Ctl('small', 'Small bubbles (px)', 3, 20, 0.5), Ctl('rate', 'How fast foam ages', 0.05, 4, 0.05), Ctl('floor', 'How much lace survives', 0, 0.6, 0.01)] },
      { name: 'Touch', items: [Ctl('pull', 'Pull (drag strength)', 0, 3, 0.05), Ctl('brush', 'Touch size (px)', 20, 200, 5), Ctl('weight', 'Type weight', 300, 900, 10)] },
    ],
    set(key, v) { P[key] = v; if (key === 'weight') document.fonts.load(`${v} 100px "${FAMILY}"`, NAME).then(build, build); },
    reset() { Object.assign(P, DEF); build(); },
  };

  // ---------- the frame ----------
  const pass = (p, tgt, w, h) => { gl.bindFramebuffer(gl.FRAMEBUFFER, tgt ? tgt.f : null); gl.viewport(0, 0, w, h); gl.useProgram(p.p); };
  const bindT = (unit, t, loc) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); };
  let t = 0;
  function frame(dt0) {
    if (!S.length) return;
    const dt = Math.min(0.033, dt0), now = performance.now(); t += dt;
    // the self-demo: once, after 3.5 s untouched, a slow breath across the middle
    if (!touched && !demoDone && demoT < 0 && now - born > 3500) demoT = 0;
    if (demoT >= 0) {
      demoT += dt; const f = demoT / 2.4;
      if (f > 1) { demoT = -1; demoDone = true; } else touch(W * (0.1 + 0.8 * f), H * (0.45 + 0.08 * Math.sin(f * 6)), 0.025, 30, 0, P.brush * 1.2);
    }
    gale = press.holding ? Math.min(1, gale + dt / 3.5) : Math.max(0, gale - dt / 2);
    if (sweep > -1e8) { sweep += dt * W / 1.1; if (sweep > W + 100) sweep = -1e9; }
    const pp = puffs.slice(-8); puffs = [];
    const PA = new Float32Array(32), PV = new Float32Array(16);
    pp.forEach((q, i) => { PA.set([q[0], q[1], q[2], q[3] * Math.min(1, dt * 30)], i * 4); PV.set([q[4], q[5]], i * 2); });
    gl.disable(gl.BLEND); gl.bindVertexArray(vao);

    pass(velP, V[1 - vi], sw, shh); let u = velP.u;
    bindT(0, V[vi].t, u('uV')); gl.uniform2f(u('uRes'), sw, shh); gl.uniform2f(u('uCss'), W, H); gl.uniform1f(u('uDt'), dt);
    gl.uniform1f(u('uGale'), gale * (stage.reduced ? 0.5 : 1)); gl.uniform1f(u('uT'), t);
    gl.uniform4fv(u('uP[0]'), PA); gl.uniform2fv(u('uPv[0]'), PV); gl.uniform1i(u('uNP'), pp.length);
    gl.drawArrays(gl.TRIANGLES, 0, 3); vi = 1 - vi;

    pass(foamP, S[1 - si], sw, shh); u = foamP.u;
    bindT(0, S[si].t, u('uS')); bindT(1, V[vi].t, u('uV')); bindT(2, maskT, u('uMask'));
    gl.uniform2f(u('uRes'), sw, shh); gl.uniform2f(u('uCss'), W, H); gl.uniform1f(u('uDt'), dt); gl.uniform1f(u('uRate'), P.rate);
    gl.uniform1f(u('uFloor'), P.floor); gl.uniform1f(u('uGale'), gale); gl.uniform1f(u('uSweep'), sweep > -1e8 ? sweep : -2);
    gl.uniform4fv(u('uP[0]'), PA); gl.uniform1i(u('uNP'), pp.length);
    gl.drawArrays(gl.TRIANGLES, 0, 3); si = 1 - si;

    pass(drawP, null, stage.pw, stage.ph); u = drawP.u;
    bindT(0, S[si].t, u('uS')); gl.uniform2f(u('uRes'), stage.pw, stage.ph);
    gl.uniform1f(u('uBig'), P.big); gl.uniform1f(u('uSmall'), P.small); gl.uniform1f(u('uLight'), light ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
    rv.draw(now);
  }

  build();
  offs.push(stage.frame((dt) => frame(dt)));
  let rt = 0; offs.push(stage.on('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (alive && (stage.W !== W || stage.H !== H)) build(); }, 150); }));

  return {
    tune,
    debug: { get gale() { return gale; }, touch, breaker: () => { sweep = -80; }, build,
      foam() { const o = new Float32Array(sw * shh * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, S[si].f); gl.readPixels(0, 0, sw, shh, gl.RGBA, gl.FLOAT, o); let n = 0, mx = 0; for (let i = 0; i < sw * shh; i++) { if (o[i * 4] > 0.5) n++; mx = Math.max(mx, o[i * 4]); } return { share: n / (sw * shh), max: mx, sw, shh, err: gl.getError() }; } },
    destroy() {
      alive = false; clearTimeout(rt); clearTimeout(reform);
      rv.destroy(); offs.forEach((f) => f());
      S.forEach(free); V.forEach(free); gl.deleteTexture(maskT); progs.forEach((p) => gl.deleteProgram(p)); gl.deleteVertexArray(vao);
      link.remove(); stage.setBackdrop(null);
    },
  };
}
