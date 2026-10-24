// Glitter: the name is the only water on a black page, and the pointer is the moon. A calm letter is a black mirror; when the moon
// passes, the letters show as thousands of separate glints, sharp where the light is close and a soft glow further off. After the
// glitter model in Open Water (github.com/Leonxlnx/open-water, MIT): ripples too fine for a pixel become slope variance, and each
// pixel draws a Poisson count of glints from the expected glint radiance.
//
// Under the picture (WebGL2): a quarter-size wake field (moves stir it, it spreads and dies away); the letters, seen from straight
// above, as a sum of 24 ripples from 3 to 240 px; the moon a small light above the page; HDR, a quarter-size bloom, a tone curve.
//
// Gestures (src/gestures.js): hover or drag moves the moon and leaves a wake; tap splashes; hold raises the wind over every letter;
// double tap calms the water (after the re-form beat). Reveal: the moon climbs high and a breeze crosses every letter, under a
// drawing of the moon, its reach and the wake. Self-demo: once, after 3.5 s untouched, the moon crosses low trailing a breeze;
// off under reduced motion. Black only (darkOnly in the registry), like Glint.

import { getGL } from '../engine.js';
import { pressTracker, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';
import { createReveal, grid, corners, label, titleBlock, ink as rvInk } from './reveal.js';

const FAMILY = 'Bitter', NAME = 'IdanSegv';
const DEF = { height: 1.42, moon: 2.7, grain: 0.65, rough: 2.45, last: 3.8, bloom: 0.7, rest: 0, weight: 700 };   // Idan's tuning, 24 Oct 2026
const NW = 24;

const VS = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
const NOISE = `
float ihash(vec2 p) { uvec2 q = uvec2(ivec2(floor(p)) + 65536) * uvec2(1597334673u, 3812015801u); uint n = (q.x ^ q.y) * 1597334673u; return float(n >> 8) / 16777216.0; }
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }`;

// the wake: moves leave ripples that spread a little and die away
const SIM = `#version 300 es
precision highp float;
uniform sampler2D uPrev; uniform vec2 uSimRes, uCss; uniform float uDecay;
uniform vec4 uP[8]; uniform int uNP;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uSimRes, px = 1.0 / uSimRes, x = uv * uCss;
  float c = texture(uPrev, uv).r;
  float nb = 0.25 * (texture(uPrev, uv + vec2(px.x, 0)).r + texture(uPrev, uv - vec2(px.x, 0)).r + texture(uPrev, uv + vec2(0, px.y)).r + texture(uPrev, uv - vec2(0, px.y)).r);
  float E = max(0.0, mix(c, nb, 0.15) * uDecay - 0.0008);
  for (int i = 0; i < 8; i++) { if (i >= uNP) break; vec2 d = x - uP[i].xy; E += uP[i].w * exp(-dot(d, d) / (uP[i].z * uP[i].z)); }
  o = vec4(min(E, 1.5), 0.0, 0.0, 1.0);
}`;

// the letters are water seen from straight above; the moon is a small light above the page
const SCENE = `#version 300 es
precision highp float;
uniform sampler2D uWind, uMask; uniform vec2 uRes, uCss; uniform vec3 uLight; uniform float uT, uMoon, uGrain, uGale, uSwell, uRest, uLR, uFlick, uRough;
uniform vec4 uWa[${NW}]; uniform vec2 uWb[${NW}];
out vec4 o;
${NOISE}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes, p = uv * uCss;
  float m = texture(uMask, uv).r;
  if (m < 0.002) { o = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float E = 1.0 - exp(-2.5 * texture(uWind, uv).r * (0.6 + 0.8 * vnoise(p * 0.02 + uT * 0.3))) + uGale;
  vec2 sl = vec2(0.0);
  for (int i = 0; i < ${NW}; i++) {
    vec4 a = uWa[i]; vec2 b = uWb[i]; float k = length(a.xy);
    float amp = b.x * (b.y < 60.0 ? E : uSwell) * uRough;
    sl += amp * cos(dot(a.xy, p) - a.z * uT + a.w) * a.xy / k;
  }
  float s2 = 0.00025 + 0.045 * E * uRough + uLR * uLR;              // slope variance below a pixel, plus the moon's own size
  vec3 n = normalize(vec3(-sl, 1.0)), V = vec3(0.0, 0.0, 1.0);
  vec3 L = normalize(uLight - vec3(p, 0.0)), H = normalize(L + V);
  vec2 d = H.xy / H.z - n.xy / n.z;
  float F = 0.02 + 0.98 * pow(1.0 - max(dot(H, V), 0.0), 5.0);
  float Es = uMoon * 30.0 * (0.3 + F) * exp(-dot(d, d) / s2) * pow(uLR * uLR / s2, 0.4);
  float lam = Es * uGrain, g = Es;
  if (lam < 6.0) {                                                    // few glints here: draw them, a Poisson count per pixel
    float slot = floor(uT * uFlick + ihash(gl_FragCoord.xy) * 17.0);
    float u = ihash(gl_FragCoord.xy + vec2(slot * 37.0, slot * 11.0)), pr = exp(-lam), cdf = pr, nn = 0.0;
    for (int k = 1; k < 8; k++) { if (u < cdf) break; nn += 1.0; pr *= lam / nn; cdf += pr; }
    g = Es * nn / max(lam, 1e-6);
  }
  float c = (uRest + g) * m;
  o = vec4(c, c, c, 1.0);
}`;

const BRIGHT = `#version 300 es
precision highp float; uniform sampler2D uSrc; uniform vec2 uTex; out vec4 o;
void main() { vec2 uv = gl_FragCoord.xy * uTex; float c = 0.0;
  for (int i = 0; i < 4; i++) { vec2 off = vec2(float(i & 1), float(i >> 1)) - 0.5; c += texture(uSrc, uv + off * uTex * 0.5).r; }
  c *= 0.25; o = vec4(vec3(max(c - 0.3, 0.0)), 1.0); }`;
const BLUR = `#version 300 es
precision highp float; uniform sampler2D uSrc; uniform vec2 uTex, uDir; out vec4 o;
void main() { vec2 uv = gl_FragCoord.xy * uTex; float c = 0.0, wsum = 0.0;
  for (int i = -6; i <= 6; i++) { float w = exp(-float(i * i) / 18.0); c += w * texture(uSrc, uv + uDir * uTex * float(i) * 1.5).r; wsum += w; }
  o = vec4(vec3(c / wsum), 1.0); }`;
const COMP = `#version 300 es
precision highp float; uniform sampler2D uSrc, uBloom; uniform vec2 uRes; uniform float uBloomK, uT; out vec4 o;
${NOISE}
void main() { vec2 uv = gl_FragCoord.xy / uRes;
  float c = texture(uSrc, uv).r + uBloomK * texture(uBloom, uv).r;
  c = 1.0 - exp(-c * 1.6);
  c += (hash(gl_FragCoord.xy) - 0.5) / 255.0;                          // a fixed dither: still water stays still
  o = vec4(vec3(c), 1.0); }`;

export async function mount(stage) {
  const canvas = stage.canvas, gl = getGL(canvas);
  if (!gl) throw new Error('webgl2 unavailable');
  const dark = stage.theme.name === 'dark';                          // black only: the shell always shows it dark (darkOnly)
  const P = { ...DEF };
  const offs = [];
  let alive = true;
  stage.setBackdrop(dark ? 0 : 1);
  const floatOK = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));

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
  const simP = prog(SIM), sceneP = prog(SCENE), brightP = prog(BRIGHT), blurP = prog(BLUR), compP = prog(COMP);
  const vao = gl.createVertexArray();

  // ripples: 3 to 240 css px, all directions; gravity-capillary dispersion in px units. A fixed seed: the same water every time.
  const rnd = (() => { let a = 5; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
  const WA = new Float32Array(NW * 4), WB = new Float32Array(NW * 2);
  for (let i = 0; i < NW; i++) {
    const t = i / (NW - 1), lam = 3 * Math.pow(240 / 3, t), k = 6.2832 / lam, a = rnd() * 6.2832;
    WA.set([Math.cos(a) * k, Math.sin(a) * k, Math.sqrt(75 * k + 120 * k * k * k), rnd() * 6.283], i * 4);
    WB.set([(lam < 60 ? 0.07 : 0.05) * (0.8 + rnd() * 0.4), lam], i * 2);
  }

  const target = (w, h) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    if (floatOK) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { t, f, w, h };
  };
  const free = (x) => { if (x) { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.f); } };

  // ---------- the name: Idan over Segev, as a mask ----------
  const mc = document.createElement('canvas'), mx = mc.getContext('2d');
  const maskT = gl.createTexture();
  let W = stage.W, H = stage.H, simW = 1, simH = 1, sims = [], simI = 0, sceneT = null, bA = null, bB = null;
  function buildMask() {
    mc.width = W; mc.height = H; mx.fillStyle = '#000'; mx.fillRect(0, 0, W, H);
    const face = (s) => `${P.weight} ${s}px "${FAMILY}", Georgia, serif`;
    mx.font = face(100);
    const a = mx.measureText('Idan'), b = mx.measureText('Segev'), lead = 92;
    const blockH = a.actualBoundingBoxAscent + lead + b.actualBoundingBoxDescent, blockW = Math.max(a.width, b.width);
    const m = Math.max(24, Math.min(W, H) * 0.07), foot = 48;
    const s = Math.min((W - 2 * m) / blockW, (H - 2 * m - foot) / blockH) * 100;
    mx.font = face(s); mx.fillStyle = '#fff'; mx.textAlign = 'center';
    const top = (H - foot - blockH * s / 100) / 2 + a.actualBoundingBoxAscent * s / 100;
    mx.fillText('Idan', W / 2, top); mx.fillText('Segev', W / 2, top + lead * s / 100);
    gl.bindTexture(gl.TEXTURE_2D, maskT); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, mc); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  }
  function build() {
    W = stage.W; H = stage.H;
    simW = Math.max(64, Math.round(W / 4)); simH = Math.max(64, Math.round(H / 4));
    [sceneT, bA, bB].forEach(free); sims.forEach(free);
    sceneT = target(stage.pw, stage.ph);
    bA = target(Math.max(1, stage.pw >> 2), Math.max(1, stage.ph >> 2)); bB = target(Math.max(1, stage.pw >> 2), Math.max(1, stage.ph >> 2));
    sims = [target(simW, simH), target(simW, simH)]; simI = 0;
    buildMask();
  }

  // ---------- the moon follows the pointer; moves leave a wake ----------
  const moon = { x: W * 0.5, y: H * 0.2, tx: W * 0.5, ty: H * 0.2 };
  let puffs = [], Eg = 0, gale = 0, calm = 0, rise = 0, touched = false, demoT = -1, demoDone = !!stage.reduced;
  const born = performance.now();
  const wake = (x, y, str, rad) => { puffs.push([x, H - y, rad, str]); Eg = Math.min(1, Eg + str * 0.03); };
  const take = () => { touched = true; demoT = -1; demoDone = true; };
  const press = pressTracker();
  let lastTap = -1, reform = 0, lx = null, ly = null;
  offs.push(stage.on('down', (q, e) => { take(); press.down(q, e.pointerId); moon.tx = q.x; moon.ty = q.y; lx = q.x; ly = q.y; }));
  offs.push(stage.on('move', (q, e) => {
    press.move(q, e.pointerId);
    if (q.type !== 'mouse' && !q.down) return;
    take(); moon.tx = q.x; moon.ty = q.y;
    if (lx === null) { lx = q.x; ly = q.y; return; }
    const d = Math.hypot(q.x - lx, q.y - ly);
    if (d < 2) return;
    wake(q.x, q.y, Math.min(0.5, d * 0.012) * (stage.reduced ? 0.5 : 1), 70);
    lx = q.x; ly = q.y;
  }));
  offs.push(stage.on('up', (q, e) => {
    const r = press.up(q, e.pointerId);
    if (q.type !== 'mouse') lx = ly = null;
    if (!r || !r.tap) return;
    const now = performance.now();
    clearTimeout(reform);
    if (lastTap >= 0 && now - lastTap < DOUBLE_MS) { lastTap = -1; reform = setTimeout(() => { if (alive && !stage.revealed) calm = 1.2; }, REFORM_DELAY_MS); }
    else { lastTap = now; wake(q.x, q.y, 0.9, 90); }
  }));

  // ---------- reveal: the moon climbs and a breeze crosses every letter; drawn: the moon, its reach, the wake ----------
  const rv = createReveal(stage, (c, W_, H_, k) => {
    const colr = (a) => rvInk(stage, a);
    grid(c, W_, H_, 24, colr, k); corners(c, W_, H_, 16, colr, k);
    const reach = P.height * Math.min(W_, H_);
    c.strokeStyle = colr(0.45 * k); c.lineWidth = 1;
    for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; c.beginPath(); c.moveTo(moon.x + Math.cos(a) * 14, moon.y + Math.sin(a) * 14); c.lineTo(moon.x + Math.cos(a) * reach, moon.y + Math.sin(a) * reach); c.stroke(); }
    c.strokeStyle = colr(0.7 * k); c.setLineDash([4, 5]);
    c.beginPath(); c.arc(moon.x, moon.y, reach, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    c.strokeStyle = colr(k); c.lineWidth = 1.4; c.beginPath(); c.arc(moon.x, moon.y, 9, 0, Math.PI * 2); c.stroke();
    label(c, `moon  ${Math.round(moon.x)}, ${Math.round(moon.y)}  height ${Math.round(reach)} px`, moon.x + 16, moon.y - 12, colr, k);
    titleBlock(c, W_, H_, ['GLITTER · STRUCTURE', '○ the moon  ┄ how far its glints reach', '24 ripples, 3 to 240 px', 'glints: a Poisson draw per pixel'], colr, k);
  }, { dim: 0.6, onChange: (on) => { if (on) rise = 2.6; } });

  // ---------- settings ----------
  const Ctl = (key, label2, min, max, step) => ({ key, label: label2, min, max, step });
  const tune = {
    title: 'Glitter', values: P, defaults: DEF,
    groups: [
      { name: 'Moon', items: [Ctl('height', 'Moon height (glitter reach)', 0.1, 2, 0.02), Ctl('moon', 'Moonlight', 0.2, 4, 0.05), Ctl('grain', 'Glints (sparse to dense)', 0.05, 3, 0.05), Ctl('bloom', 'Bloom', 0, 3, 0.05)] },
      { name: 'Water', items: [Ctl('rough', 'Ripples from a move', 0.1, 3, 0.05), Ctl('last', 'How long ripples last (s)', 0.5, 10, 0.1), Ctl('rest', 'The name, seen at rest', 0, 0.15, 0.005), Ctl('weight', 'Type weight', 300, 900, 10)] },
    ],
    set(key, v) { P[key] = v; if (key === 'weight') document.fonts.load(`${v} 100px "${FAMILY}"`, NAME).then(buildMask, buildMask); },
    reset() { Object.assign(P, DEF); buildMask(); },
  };

  // ---------- the frame ----------
  const pass = (p, tgt, w, h) => { gl.bindFramebuffer(gl.FRAMEBUFFER, tgt ? tgt.f : null); gl.viewport(0, 0, w, h); gl.useProgram(p.p); };
  const bindT = (unit, t, loc) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); };
  let t = 0;
  function frame(dt) {
    if (!sceneT) return;
    const now = performance.now(); t += dt;
    // the self-demo: once, after 3.5 s untouched, the moon crosses low trailing a breeze, then rests high above the middle
    if (!touched && !demoDone && demoT < 0 && now - born > 3500) demoT = 0;
    if (demoT >= 0) {
      demoT += dt; const f = demoT / 3.2;
      if (f > 1) { demoT = -1; demoDone = true; moon.tx = W * 0.5; moon.ty = -H * 0.6; }
      else { moon.tx = W * (0.08 + 0.84 * f); moon.ty = H * (0.42 + 0.1 * Math.sin(f * 5)); wake(moon.tx, moon.ty + 30, 0.06, 120); }
    }
    const k = 1 - Math.exp(-dt * 10); moon.x += (moon.tx - moon.x) * k; moon.y += (moon.ty - moon.y) * k;
    gale = press.holding ? Math.min(1, gale + dt / 3) : Math.max(0, gale - dt / 2);
    if (calm > 0) { calm -= dt; gale = 0; }
    if (rise > 0) rise = Math.max(0, rise - dt);
    const lift = rise > 0 && !stage.reduced ? Math.sin(Math.min(1, (2.6 - rise) / 2.6) * Math.PI) : 0;
    Eg *= Math.exp(-dt / P.last);
    gl.disable(gl.BLEND); gl.bindVertexArray(vao);

    const src = sims[simI], dst = sims[1 - simI];
    pass(simP, dst, simW, simH); bindT(0, src.t, simP.u('uPrev'));
    gl.uniform2f(simP.u('uSimRes'), simW, simH); gl.uniform2f(simP.u('uCss'), W, H);
    gl.uniform1f(simP.u('uDecay'), calm > 0 ? Math.exp(-dt * 4) : Math.exp(-dt / P.last));
    const pp = puffs.slice(-8); puffs = []; const PA = new Float32Array(32); pp.forEach((q, i) => PA.set(q, i * 4));
    gl.uniform4fv(simP.u('uP[0]'), PA); gl.uniform1i(simP.u('uNP'), pp.length);
    gl.drawArrays(gl.TRIANGLES, 0, 3); simI = 1 - simI;

    const h = P.height * Math.min(W, H) * (1 + 3 * lift), u = sceneP.u;
    pass(sceneP, sceneT, sceneT.w, sceneT.h);
    bindT(0, dst.t, u('uWind')); bindT(1, maskT, u('uMask'));
    gl.uniform2f(u('uRes'), sceneT.w, sceneT.h); gl.uniform2f(u('uCss'), W, H); gl.uniform3f(u('uLight'), moon.x, H - moon.y, h);
    gl.uniform1f(u('uT'), t); gl.uniform1f(u('uMoon'), P.moon * (1 + 0.5 * lift)); gl.uniform1f(u('uGrain'), P.grain);
    gl.uniform1f(u('uGale'), Math.max(gale, lift * 0.6)); gl.uniform1f(u('uSwell'), Math.min(1, Eg + gale + lift * 0.5) * (stage.reduced ? 0.45 : 1));
    gl.uniform1f(u('uRest'), P.rest); gl.uniform1f(u('uLR'), 0.012); gl.uniform1f(u('uFlick'), stage.reduced ? 0 : 11);
    gl.uniform1f(u('uRough'), P.rough * (stage.reduced ? 0.5 : 1));
    gl.uniform4fv(u('uWa[0]'), WA); gl.uniform2fv(u('uWb[0]'), WB);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    pass(brightP, bA, bA.w, bA.h); bindT(0, sceneT.t, brightP.u('uSrc')); gl.uniform2f(brightP.u('uTex'), 1 / bA.w, 1 / bA.h); gl.drawArrays(gl.TRIANGLES, 0, 3);
    pass(blurP, bB, bB.w, bB.h); bindT(0, bA.t, blurP.u('uSrc')); gl.uniform2f(blurP.u('uTex'), 1 / bB.w, 1 / bB.h); gl.uniform2f(blurP.u('uDir'), 1, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
    pass(blurP, bA, bA.w, bA.h); bindT(0, bB.t, blurP.u('uSrc')); gl.uniform2f(blurP.u('uDir'), 0, 1); gl.drawArrays(gl.TRIANGLES, 0, 3);
    pass(compP, null, stage.pw, stage.ph); bindT(0, sceneT.t, compP.u('uSrc')); bindT(1, bA.t, compP.u('uBloom'));
    gl.uniform2f(compP.u('uRes'), stage.pw, stage.ph); gl.uniform1f(compP.u('uBloomK'), P.bloom); gl.uniform1f(compP.u('uT'), t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
    rv.draw(now);
  }

  build();
  offs.push(stage.frame((dt) => frame(dt)));
  let rt = 0; offs.push(stage.on('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (alive) build(); }, 120); }));

  return {
    tune,
    debug: { moon, get gale() { return gale; }, wake, build },
    destroy() {
      alive = false; clearTimeout(rt); clearTimeout(reform);
      rv.destroy(); offs.forEach((f) => f());
      [sceneT, bA, bB].forEach(free); sims.forEach(free); gl.deleteTexture(maskT); progs.forEach((p) => gl.deleteProgram(p)); gl.deleteVertexArray(vao);
      link.remove(); stage.setBackdrop(null);
    },
  };
}
