// Moonlit (was Cat's paw): the name is a slick on a moonlit sea, seen from straight above. A slick damps the smallest ripples, so
// where the wind roughens the water it breaks into moon glitter and the letters stay glassy and dark inside it. After Open Water
// (github.com/Leonxlnx/open-water, MIT): ripples too fine for a pixel become slope variance, glints are a Poisson draw per cell,
// foam forms on crests and along the torn edges of the slick in a gale.
//
// Under the picture (WebGL2): a quarter-size wind field (gusts injected by the pointer drift downwind and decay; a second channel
// holds slick damage from a gale, which heals); the sea as a sum of 28 directional waves (5 to 380 px), short ones damped inside
// the slick; a light breeze everywhere outside the letters (Idan's "trace"), so the name shows at rest as dark water in glitter.
//
// Gestures (src/gestures.js): hover or drag is wind; tap a puff; hold a gale (swell, foam, the slick tears and later heals);
// double tap is a storm passing (lightning, rings of wind from the tap, then calm; after the re-form beat). Reveal: lightning beyond the frame and a gust across the whole page, under a
// drawing of the wind. Self-demo: once, after 3.5 s untouched, a gust crosses the page; off under reduced motion, where the sea
// is also frozen (the glitter does not flicker). Black only (darkOnly in the registry): a night sea.

import { getGL } from '../engine.js';
import { pressTracker, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';
import { createReveal, grid, corners, arrow, label, titleBlock, ink as rvInk } from './reveal.js';
import { linesFor, lettersFor } from '../name.js';

const FAMILY = 'Bitter', NAME = 'IdanSegv';
const DEF = { density: 2.6, moon: 50, ripple: 1.25, gust: 50, last: 3.9, edge: 0, weight: 900, trace: 0.16, foam: 0.8 };   // Idan's tuning, 25 Oct 2026
const NW = 28;

const VS = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
const NOISE = `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float ihash(vec2 p) { uvec2 q = uvec2(ivec2(p) + 65536) * uvec2(1597334673u, 3812015801u); uint n = (q.x ^ q.y) * 1597334673u; return float(n >> 8) / 16777216.0; }
float fbm(vec2 p) { return 0.5 * vnoise(p) + 0.3 * vnoise(p * 2.03 + 7.1) + 0.2 * vnoise(p * 4.07 + 3.3); }`;

// the wind: gusts drift downwind and decay; g holds slick damage from a gale
const SIM = `#version 300 es
precision highp float;
uniform sampler2D uPrev; uniform vec2 uSimRes, uAdv; uniform float uDecay, uGale, uDt, uTime, uCalm, uAspect;
uniform vec4 uP[12]; uniform vec2 uPd[12]; uniform int uNP;
out vec4 o;
${NOISE}
void main() {
  vec2 uv = gl_FragCoord.xy / uSimRes, px = 1.0 / uSimRes, src = uv - uAdv;
  vec4 c = texture(uPrev, src);
  float nb = 0.25 * (texture(uPrev, src + vec2(px.x, 0)).r + texture(uPrev, src - vec2(px.x, 0)).r
                   + texture(uPrev, src + vec2(0, px.y)).r + texture(uPrev, src - vec2(0, px.y)).r);
  float E = max(0.0, mix(c.r, nb, 0.2) * uDecay - 0.0012);
  for (int i = 0; i < 12; i++) {
    if (i >= uNP) break;
    vec2 d = (uv - uP[i].xy) * vec2(uAspect, 1.0), m = uPd[i];
    float a = dot(d, m), b = dot(d, vec2(-m.y, m.x)), r = uP[i].z;
    E += uP[i].w * exp(-(a * a / (r * r * 2.4) + b * b / (r * r * 0.7)));
  }
  E = min(E * (1.0 - min(1.0, uCalm * uDt * 3.0)), 1.6);
  float dmg = c.g + uGale * uGale * uDt * 1.1 * smoothstep(0.42, 0.78, fbm(uv * vec2(uAspect, 1.0) * 11.0 + uTime * 0.25));
  dmg *= 1.0 - min(1.0, uDt * (0.14 * (1.0 - uGale) + uCalm * 3.0));
  o = vec4(E, clamp(dmg, 0.0, 1.0), 0.0, 1.0);
}`;

// the sea from straight above: waves damped inside the slick; moon glints as a Poisson draw per cell
const SEA = `#version 300 es
precision highp float;
uniform sampler2D uWind, uMask; uniform vec2 uRes, uCss, uDir; uniform float uDpr, uT, uMoon, uDensity, uRipple, uSwell, uGale, uFlash, uEdge, uFoam, uTrace, uCell, uFlick;
uniform vec4 uWa[${NW}]; uniform vec2 uWb[${NW}];
out vec4 o;
${NOISE}
float slick(vec2 uv) {
  vec2 s = exp2(uEdge) * 0.9 / uCss;
  return 0.4 * textureLod(uMask, uv, uEdge).r + 0.15 * (textureLod(uMask, uv + vec2(s.x, 0), uEdge).r + textureLod(uMask, uv - vec2(s.x, 0), uEdge).r
       + textureLod(uMask, uv + vec2(0, s.y), uEdge).r + textureLod(uMask, uv - vec2(0, s.y), uEdge).r);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes, p = gl_FragCoord.xy / uDpr;
  vec4 w = texture(uWind, uv);
  float sRaw = smoothstep(0.08, 0.92, slick(uv)), s = sRaw * (1.0 - w.g);
  vec2 drift = p - uDir * uT * 38.0;
  float E = w.r * (0.5 + 1.0 * fbm(drift * 0.011)) + uGale * 1.25;     // patchy, like real cat's paws
  E = max(E, uTrace * (1.0 - s));
  float fS = E * (1.0 - s * 0.97) * uRipple, fM = 0.55 * pow(E, 0.8) * (1.0 - s * 0.55) * uRipple, fL = uSwell;
  vec2 sl = vec2(0); float crest = 0.0;
  for (int i = 0; i < ${NW}; i++) {
    vec4 a = uWa[i]; vec2 b = uWb[i];
    float ph = dot(a.xy, p) - a.z * uT + a.w, k = length(a.xy);
    float amp = b.x * (b.y < 40.0 ? fS : b.y < 130.0 ? fM : fL);
    sl += amp * cos(ph) * a.xy / k;
    if (b.y >= 130.0) crest += amp * sin(ph);
  }
  float s2 = 0.0012 + (0.045 * E * (1.0 - s * 0.97) * uRipple + 0.05 * uGale);  // slope variance below a pixel
  vec3 n = normalize(vec3(-sl, 1.0));
  vec3 V = normalize(vec3(0.5 * uCss - p, 1.3 * max(uCss.x, uCss.y)));
  float mir = exp(-s2 * 45.0 - dot(sl, sl) * 8.0);
  vec3 L = vec3(0.0, sin(uMoon), cos(uMoon)), H = normalize(V + L);
  vec2 d = H.xy / H.z - n.xy / n.z;
  float D = exp(-dot(d, d) / s2) / (3.14159 * s2);
  vec2 cp = floor(gl_FragCoord.xy / uCell);
  float slot = floor(uT * uFlick + ihash(cp) * 17.0);
  float lam = uDensity * D * 1.1;
  float g = float(ihash(cp + vec2(slot * 37.0, slot * 11.0)) < 1.0 - exp(-lam)) * (0.5 + 0.5 * ihash(cp.yx + slot * 5.0));
  float lum = 0.006 + g + D * 0.004 * uDensity + uFlash * (0.08 + 0.9 * mir);
  // gale: foam on the crests and along the torn edges of the slick, drawn out downwind in rows
  vec2 dp = vec2(dot(p, uDir), dot(p, vec2(-uDir.y, uDir.x)));
  float rows = fbm(vec2(dp.x * 0.012 - uT * 0.6, dp.y * 0.09));
  float lace = fbm(drift * 0.05 + 3.0);
  float foam = smoothstep(0.62, 0.95, crest * 2.2 + lace * 0.8) * smoothstep(0.5, 0.7, fbm(drift * 0.12)) * uGale * uGale;
  foam += sRaw * w.g * smoothstep(0.42, 0.75, rows * 0.6 + lace * 0.6) * (0.4 + uGale);
  lum = mix(lum, 0.62, clamp(foam * uFoam, 0.0, 1.0) * 0.9);
  lum += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  o = vec4(vec3(clamp(lum, 0.0, 1.0)), 1.0);
}`;

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
  const LETTERS = lettersFor(stage, NAME), LINES = linesFor(stage, ['Idan', 'Segev']);   // a visitor's name: its letters in the subset, one line per word
  link.href = `https://fonts.googleapis.com/css2?family=${FAMILY}:wght@100..900&text=${encodeURIComponent(LETTERS)}&display=block`;
  document.head.appendChild(link);
  await Promise.race([new Promise((r) => { link.onload = r; link.onerror = r; }), new Promise((r) => setTimeout(r, 2500))]);
  try { await Promise.race([document.fonts.load(`${P.weight} 100px "${FAMILY}"`, LETTERS), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* the fallback face */ }

  // ---------- GL ----------
  const progs = [];
  const prog = (fs) => {
    const p = gl.createProgram();
    for (const [t, s] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); gl.attachShader(p, x); gl.deleteShader(x); }
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    progs.push(p); const c = {}; return { p, u: (n) => c[n] ?? (c[n] = gl.getUniformLocation(p, n)) };
  };
  const simP = prog(SIM), seaP = prog(SEA);
  const vao = gl.createVertexArray();

  // waves: log-spaced from 5 to 380 css px, spread wider for the short ones; the wind blows left to right. A fixed seed.
  const windAng = 0, rnd = (() => { let a = 7; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
  const WA = new Float32Array(NW * 4), WB = new Float32Array(NW * 2);
  for (let i = 0; i < NW; i++) {
    const t = i / (NW - 1), j = rnd() * 2 - 1, ph = rnd() * 6.283, amp = 0.8 + rnd() * 0.4;
    const lam = 5 * Math.pow(380 / 5, t), k = 6.2832 / lam, a = windAng + j * (1.6 - 1.2 * t);
    WA.set([Math.cos(a) * k, Math.sin(a) * k, Math.sqrt(75 * k + 120 * k * k * k), ph], i * 4);
    WB.set([(lam < 130 ? 0.05 : 0.07) * amp, lam], i * 2);
  }

  const target = (w, h) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    if (floatOK) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { t, f };
  };
  const free = (x) => { if (x) { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.f); } };

  // ---------- the name: Idan over Segev, as the slick ----------
  const mc = document.createElement('canvas'), mx = mc.getContext('2d');
  const maskT = gl.createTexture();
  let W = stage.W, H = stage.H, simW = 1, simH = 1, sims = [], simI = 0;
  function buildMask() {
    mc.width = W; mc.height = H; mx.fillStyle = '#000'; mx.fillRect(0, 0, W, H);
    const face = (s) => `${P.weight} ${s}px "${FAMILY}", Georgia, serif`;
    mx.font = face(100);
    const ms = LINES.map((l) => mx.measureText(l)), a = ms[0], b = ms[ms.length - 1], lead = 92;
    const blockH = a.actualBoundingBoxAscent + lead * (LINES.length - 1) + b.actualBoundingBoxDescent, blockW = Math.max(...ms.map((x) => x.width));
    const m = Math.max(24, Math.min(W, H) * 0.07), foot = 48;
    const s = Math.min((W - 2 * m) / blockW, (H - 2 * m - foot) / blockH) * 100;
    mx.font = face(s); mx.fillStyle = '#fff'; mx.textAlign = 'center';
    const top = (H - foot - blockH * s / 100) / 2 + a.actualBoundingBoxAscent * s / 100;
    LINES.forEach((l, i) => mx.fillText(l, W / 2, top + i * lead * s / 100));
    gl.bindTexture(gl.TEXTURE_2D, maskT); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, mc); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.generateMipmap(gl.TEXTURE_2D);
  }
  function build() {
    W = stage.W; H = stage.H;
    simW = Math.max(64, Math.round(W / 4)); simH = Math.max(64, Math.round(H / 4));
    sims.forEach(free); sims = [target(simW, simH), target(simW, simH)]; simI = 0;
    buildMask();
  }

  // ---------- wind ----------
  let puffs = [], Eg = 0, gale = 0, calm = 0, flashT = -1, scripted = [];
  const puff = (x, y, str, rad, dx = 1, dy = 0) => {
    const l = Math.hypot(dx, dy) || 1;
    puffs.push([x / W, 1 - y / H, rad / H, str, dx / l, -dy / l]);
    Eg = Math.min(1, Eg + str * 0.12);
  };
  const sweep = (t0, dur, str, size = 1.7) => { for (let i = 0; i <= 34; i++) { const f = i / 34;
    scripted.push({ at: t0 + f * dur, x: (-0.06 + 1.12 * f) * W, y: H * (0.46 + 0.06 * Math.sin(f * 5.3)), str, rad: P.gust * size }); } };

  // ---------- input ----------
  const press = pressTracker();
  const born = performance.now();
  let touched = false, demoDone = !!stage.reduced, lastTap = -1, reform = 0, last = null;
  const take = () => { touched = true; if (!demoDone) { demoDone = true; scripted = []; } };
  offs.push(stage.on('down', (q, e) => { take(); press.down(q, e.pointerId); last = { x: q.x, y: q.y, t: performance.now() }; }));
  offs.push(stage.on('move', (q, e) => {
    press.move(q, e.pointerId);
    if (q.type !== 'mouse' && !q.down) return;
    const now = performance.now();
    if (!last) { last = { x: q.x, y: q.y, t: now }; return; }
    const dx = q.x - last.x, dy = q.y - last.y, d = Math.hypot(dx, dy), dt = Math.max(8, now - last.t);
    if (d <= 2) return;
    take();
    const str = Math.min(0.45, (d / dt) * 0.11) * (stage.reduced ? 0.6 : 1), steps = Math.min(4, Math.ceil(d / 30));
    for (let i = 1; i <= steps; i++) puff(last.x + dx * i / steps, last.y + dy * i / steps, str / steps * 1.6, P.gust, dx, dy);
    last = { x: q.x, y: q.y, t: now };
  }));
  offs.push(stage.on('up', (q, e) => {
    const r = press.up(q, e.pointerId);
    if (q.type !== 'mouse') last = null;
    if (!r || !r.tap) return;
    const now = performance.now();
    clearTimeout(reform);
    if (lastTap >= 0 && now - lastTap < DOUBLE_MS) { lastTap = -1; reform = setTimeout(() => { if (alive && !stage.revealed) storm(q.x, q.y); }, REFORM_DELAY_MS); }
    else { lastTap = now; puff(q.x, q.y, 0.7, P.gust * 1.2); }
  }));
  // Double tap: a storm passes over the tap. Lightning, then the thunder as rings of wind rolling out from the tap, then the sea
  // calms. No sound. Under reduced motion there is no flash and no rings: the sea just calms.
  let calmT = 0;
  function storm(x, y) {
    const now = performance.now();
    clearTimeout(calmT);
    if (stage.reduced) { calm = 1.2; return; }
    flashT = now + 40;
    for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 14; i++) {
      const a = (i / 14 + ring * 0.03) * Math.PI * 2, r = 30 + ring * 120;
      scripted.push({ at: now + 160 + ring * 280, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, str: 0.45 - ring * 0.1, rad: P.gust * 1.1, dx: Math.cos(a), dy: Math.sin(a) });
    }
    calmT = setTimeout(() => { if (alive && !stage.revealed) calm = 1.2; }, 2200);
  }

  // ---------- reveal: lightning beyond the frame and a gust across the page; drawn: the wind and the slick ----------
  const rv = createReveal(stage, (c, W_, H_, k) => {
    const colr = (a) => rvInk(stage, a);
    grid(c, W_, H_, 24, colr, k); corners(c, W_, H_, 16, colr, k);
    c.strokeStyle = colr(0.6 * k); c.lineWidth = 1;
    for (let y = 60; y < H_ - 40; y += 56) for (let x = 40; x < W_ - 60; x += 120) arrow(c, x, y, x + 54, y, 6);   // the wind, left to right
    label(c, 'wind', 40, 50, colr, k);
    titleBlock(c, W_, H_, ['MOONLIT · STRUCTURE', '→ the wind; the name is a slick', 'that damps the smallest ripples', `glitter ${P.density} · moon ${P.moon}° · breeze ${P.trace}`], colr, k);
  }, { dim: 0.6, onChange: (on) => { if (on && !stage.reduced) { sweep(performance.now(), 700, 0.5, 3.2); flashT = performance.now() + 380; } } });

  // ---------- settings ----------
  const Ctl = (key, label2, min, max, step) => ({ key, label: label2, min, max, step });
  const tune = {
    title: 'Moonlit', values: P, defaults: DEF,
    groups: [
      { name: 'Moon', items: [Ctl('density', 'Glitter density', 0.2, 4, 0.05), Ctl('moon', 'Moon (high to low, deg)', 15, 70, 1)] },
      { name: 'Wind', items: [Ctl('ripple', 'Ripple strength', 0.2, 2, 0.05), Ctl('gust', 'Gust size (px)', 30, 200, 5), Ctl('last', 'How long a gust lasts (s)', 0.5, 8, 0.1), Ctl('trace', 'Breeze at rest (the name shows)', 0, 0.3, 0.01), Ctl('foam', 'Gale foam', 0, 2, 0.05)] },
      { name: 'Type', items: [Ctl('edge', 'Slick edge softness', 0, 4, 0.1), Ctl('weight', 'Type weight', 200, 900, 10)] },
    ],
    set(key, v) { P[key] = v; if (key === 'weight') document.fonts.load(`${v} 100px "${FAMILY}"`, LETTERS).then(buildMask, buildMask); },
    reset() { Object.assign(P, DEF); buildMask(); },
  };

  // ---------- the frame ----------
  let t = 0;
  function frame(dt) {
    if (!sims.length) return;
    const now = performance.now();
    if (!stage.reduced) t += dt;                                     // under reduced motion the sea is frozen
    if (!touched && !demoDone && !scripted.length && now - born > 3500) { sweep(now, 2600, 0.38); demoDone = true; }
    scripted = scripted.filter((s) => { if (s.at <= now) { puff(s.x, s.y, s.str, s.rad, s.dx ?? 1, s.dy ?? 0); return false; } return true; });
    gale = press.holding ? Math.min(1, gale + dt / 4.5) : Math.max(0, gale - dt / 3);
    if (calm > 0) { calm -= dt; gale = 0; Eg *= Math.exp(-dt * 3); }
    Eg *= Math.exp(-dt / Math.max(0.8, P.last * 1.6));
    let flash = 0;
    if (flashT > 0) { const f = (now - flashT) / 1000;
      if (f >= 0) { [[0, 1], [0.07, 0.55], [0.19, 0.8], [0.34, 0.4]].forEach(([s0, a]) => { if (f >= s0) flash += a * Math.exp(-(f - s0) / 0.055); });
        flash += 0.22 * Math.exp(-f / 0.5); if (f > 3) flashT = -1; } }
    gl.disable(gl.BLEND); gl.bindVertexArray(vao);

    const src = sims[simI], dst = sims[1 - simI], sp = 42 * dt;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f); gl.viewport(0, 0, simW, simH); gl.useProgram(simP.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.t); gl.uniform1i(simP.u('uPrev'), 0);
    gl.uniform2f(simP.u('uSimRes'), simW, simH); gl.uniform2f(simP.u('uAdv'), Math.cos(windAng) * sp / W, Math.sin(windAng) * sp / H);
    gl.uniform1f(simP.u('uDecay'), Math.exp(-dt / P.last)); gl.uniform1f(simP.u('uGale'), gale); gl.uniform1f(simP.u('uDt'), dt); gl.uniform1f(simP.u('uTime'), t);
    gl.uniform1f(simP.u('uCalm'), calm > 0 ? 1 : 0); gl.uniform1f(simP.u('uAspect'), W / H);
    const pp = puffs.slice(-12); puffs = [];
    const PA = new Float32Array(48), PD = new Float32Array(24);
    pp.forEach((q, i) => { PA.set([q[0], q[1], q[2], q[3]], i * 4); PD.set([q[4], q[5]], i * 2); });
    gl.uniform4fv(simP.u('uP[0]'), PA); gl.uniform2fv(simP.u('uPd[0]'), PD); gl.uniform1i(simP.u('uNP'), pp.length);
    gl.drawArrays(gl.TRIANGLES, 0, 3); simI = 1 - simI;

    const u = seaP.u;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, stage.pw, stage.ph); gl.useProgram(seaP.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, dst.t); gl.uniform1i(u('uWind'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskT); gl.uniform1i(u('uMask'), 1);
    gl.uniform2f(u('uRes'), stage.pw, stage.ph); gl.uniform2f(u('uCss'), W, H); gl.uniform2f(u('uDir'), Math.cos(windAng), Math.sin(windAng));
    gl.uniform1f(u('uDpr'), stage.pw / W); gl.uniform1f(u('uT'), t); gl.uniform1f(u('uMoon'), P.moon * Math.PI / 180);
    gl.uniform1f(u('uDensity'), P.density); gl.uniform1f(u('uRipple'), P.ripple * (stage.reduced ? 0.45 : 1));
    gl.uniform1f(u('uSwell'), Math.min(1, Eg * 0.9 + gale) * (stage.reduced ? 0.45 : 1)); gl.uniform1f(u('uGale'), gale);
    gl.uniform1f(u('uFlash'), flash); gl.uniform1f(u('uEdge'), P.edge); gl.uniform1f(u('uFoam'), P.foam); gl.uniform1f(u('uTrace'), P.trace);
    gl.uniform1f(u('uCell'), Math.max(1, Math.round(1.5 * stage.pw / W))); gl.uniform1f(u('uFlick'), stage.reduced ? 0 : 11);
    gl.uniform4fv(u('uWa[0]'), WA); gl.uniform2fv(u('uWb[0]'), WB);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
    rv.draw(now);
  }

  build();
  offs.push(stage.frame((dt) => frame(dt)));
  let rt = 0; offs.push(stage.on('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (alive) build(); }, 120); }));

  return {
    tune,
    debug: { get gale() { return gale; }, puff, sweep: (d = 2600) => sweep(performance.now(), d, 0.38), build },
    destroy() {
      alive = false; clearTimeout(rt); clearTimeout(reform); clearTimeout(calmT);
      rv.destroy(); offs.forEach((f) => f());
      sims.forEach(free); gl.deleteTexture(maskT); progs.forEach((p) => gl.deleteProgram(p)); gl.deleteVertexArray(vao);
      link.remove(); stage.setBackdrop(null);
    },
  };
}
