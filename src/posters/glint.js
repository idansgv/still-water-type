// Glint: the name as a bevelled slab, black on black, nearly invisible. A small lamp low over the page catches only the edges of
// the letters, with a soft bloom; the air is lit too: a light-scattering pass marched from every pixel toward the lamp, which the
// letters block, so beams spread from the lamp and the letters throw shafts of shadow away from it. The lamp follows the pointer
// (a finger, or the mouse). On the light page the whole picture is inverted.
//
// Under the picture (WebGL2): a height field of the type with a smooth bevel; a light pass (specular on the bevel, a small
// diffuse term); a bloom from a blurred copy; the rays; and a composite with the lamp itself. Optional: the light in a cone (a lamp
// with a shade, aimed at the name or at a fixed angle), and a flat look that cuts the picture to two tones.
//
// Colour (about one showing in twenty, src/colour.js): from the first touch, the light takes the palette along the page.
// gestures: n/a (the lamp follows the pointer; nothing else is pressable). Self-demo: once, after 3.5 s untouched, the lamp
// takes a slow turn through the name and stops; off under reduced motion.

import { getGL } from '../engine.js';
import { colourOf, GLSL_PAGE_GRADIENT } from '../colour.js';
import { createReveal, grid, corners, label, titleBlock, ink as rvInk } from './reveal.js';

const FACE = '900 100px Archivo, "Arial Black", "Helvetica Neue", sans-serif';
const DEF = { haze: 1.9, height: 80, reach: 300, sharp: 120, bloom: 1.4, bevel: 2, face: 0,
  cone: 0, coneW: 35, coneSoft: 0.35, aim: 0, aimName: 1,      // the cone: a lamp with a shade, aimed at the name or at a fixed angle
  flat: 0, cut: 0.3 };                                         // flat: the picture cut to two tones, no greys

const CONE = `uniform float uCone, uConeW, uConeSoft; uniform vec2 uAim;
float coneAt(vec2 px, vec2 lamp) {
  if (uCone < 0.5) return 1.0;
  vec2 d = px - lamp; float l = length(d);
  float a = acos(clamp(dot(d / max(l, 1e-3), uAim), -1.0, 1.0));
  float s = max(uConeSoft * uConeW, 0.004);
  return mix(1.0, smoothstep(uConeW + s * 0.5, uConeW - s * 0.5, a), smoothstep(4.0, 28.0, l));
}`;
const VS = `#version 300 es
out vec2 uv; void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); uv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
const LIGHT = `#version 300 es
precision highp float;
in vec2 uv; uniform sampler2D uH; uniform vec2 uCss, uTex; uniform vec3 uLamp; uniform float uSharp, uReach, uFace, uDepth;
${CONE}
out vec4 o;
void main() {
  float h = texture(uH, uv).r;
  float hx = texture(uH, uv + vec2(uTex.x, 0.0)).r - texture(uH, uv - vec2(uTex.x, 0.0)).r;
  float hy = texture(uH, uv + vec2(0.0, uTex.y)).r - texture(uH, uv - vec2(0.0, uTex.y)).r;
  float mask = step(0.002, texture(uH, uv).g);
  vec2 px = vec2(uv.x, 1.0 - uv.y) * uCss;
  vec2 scale = uDepth / (2.0 * uTex * uCss);
  vec3 N = normalize(vec3(-hx * scale.x, hy * scale.y, 1.0));
  vec3 L = vec3(uLamp.xy - px, uLamp.z - h * uDepth); float dist = length(L); L /= dist;
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float fall = pow(clamp(1.0 - dist / uReach, 0.0, 1.0), 1.5) * coneAt(px, uLamp.xy);
  float spec = pow(max(dot(N, H), 0.0), uSharp) * 4.0 * fall;
  float diff = max(dot(N, L), 0.0) * fall * 0.10 * smoothstep(0.02, 0.2, abs(hx) + abs(hy));
  o = vec4((spec + diff) * mask + uFace * mask, h, 0.0, 1.0);
}`;
const BLUR = `#version 300 es
precision highp float;
in vec2 uv; uniform sampler2D uS; uniform vec2 uDir; out vec4 o;
void main() { float w[5] = float[5](0.227, 0.195, 0.122, 0.054, 0.016); float s = texture(uS, uv).r * w[0];
  for (int i = 1; i < 5; i++) { vec2 d = uDir * float(i) * 1.25; s += (texture(uS, uv + d).r + texture(uS, uv - d).r) * w[i]; } o = vec4(s, 0.0, 0.0, 1.0); }`;
const RAYS = `#version 300 es
precision highp float;
in vec2 uv; uniform sampler2D uH; uniform vec2 uLampUV, uCss; uniform float uReach; out vec4 o;
${CONE}
void main() {
  vec2 d = (uv - uLampUV) / 72.0; vec2 p = uv; float lit = 0.0, w = 1.0, sum = 0.0;
  for (int i = 0; i < 72; i++) { p -= d; lit += (1.0 - texture(uH, p).g) * w; sum += w; w *= 0.985; }
  lit /= sum;
  float dist = length((uv - uLampUV) * uCss);
  float fall = pow(clamp(1.0 - dist / (uReach * 1.15), 0.0, 1.0), 2.8) + 0.25 * exp(-dist / 60.0);
  fall *= coneAt(vec2(uv.x, 1.0 - uv.y) * uCss, vec2(uLampUV.x, 1.0 - uLampUV.y) * uCss);
  o = vec4(lit * lit * fall, 0.0, 0.0, 1.0);
}`;
const COMP = `#version 300 es
precision highp float;
in vec2 uv; uniform sampler2D uL, uB, uR; uniform float uBloom, uHaze, uCol, uInv, uFlat, uCut; uniform vec2 uCss; uniform vec3 uLamp;
${GLSL_PAGE_GRADIENT}
out vec4 o;
void main() {
  float v = texture(uL, uv).r + texture(uB, uv).r * uBloom + texture(uR, uv).r * uHaze * 0.55;
  vec2 px = vec2(uv.x, 1.0 - uv.y) * uCss; float d2 = dot(px - uLamp.xy, px - uLamp.xy);
  float lamp = exp(-d2 / 18.0) + 0.16 * exp(-d2 / 900.0);
  vec3 c;
  if (uFlat > 0.5) { float t = v + lamp; float fw = max(fwidth(t), 1e-3); c = vec3(smoothstep(uCut - fw, uCut + fw, t)); }   // two tones
  else { c = vec3(pow(clamp(v, 0.0, 1.0), 1.0 / 1.4)); c += lamp; }
  c = mix(c, c * gradientAt(1.0 - uv.y) * (uFlat > 0.5 ? 1.0 : 1.25), uCol);
  o = vec4(mix(c, vec3(1.0) - c, uInv), 1.0);
}`;

export async function mount(stage) {
  const canvas = stage.canvas, gl = getGL(canvas);
  if (!gl) throw new Error('webgl2 unavailable');
  const dark = stage.theme.name === 'dark';
  const P = { ...DEF };
  const col = colourOf(stage);
  const offs = [];
  if (col) offs.push(col.wakeOnPress({ move: true }));
  stage.setBackdrop(dark ? 0 : 1);
  const mk = (fs) => { const p = gl.createProgram(); for (const [t, s] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); gl.attachShader(p, x); } gl.linkProgram(p); const c = {}; return { p, u: (n) => c[n] ?? (c[n] = gl.getUniformLocation(p, n)) }; };
  const pL = mk(LIGHT), pB = mk(BLUR), pC = mk(COMP), pR = mk(RAYS);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const fmt = gl.getExtension('EXT_color_buffer_float') ? gl.RGBA16F : gl.RGBA8;
  const target = (w, h) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, gl.RGBA, fmt === gl.RGBA8 ? gl.UNSIGNED_BYTE : gl.HALF_FLOAT, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f, w, h };
  };
  let hTex = null, TL, TA, TB, TR, texW = 1, texH = 1, W = stage.W, H = stage.H, alive = true;
  const gUni = col ? col.uniform() : new Float32Array(18);

  // ---------- the slab ----------
  async function build() {
    W = stage.W; H = stage.H;
    try { await Promise.race([document.fonts.load('900 100px Archivo'), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* the fallback face */ }
    if (!alive) return;
    const k = Math.min(1, 1400 / Math.max(W, H)); texW = Math.round(W * k); texH = Math.round(H * k);
    const m = document.createElement('canvas'); m.width = texW; m.height = texH; const x = m.getContext('2d', { willReadFrequently: true });
    const portrait = W / H < 0.8, lines = portrait ? ['IDAN', 'SE', 'GEV'] : ['IDAN', 'SEGEV'];
    x.font = FACE; const widest = Math.max(...lines.map((l) => x.measureText(l).width));
    const size = Math.min(texW * 0.84 / widest * 100, texH * (portrait ? 0.22 : 0.34));
    x.font = FACE.replace('100px', size + 'px'); x.textAlign = 'center'; x.fillStyle = '#fff';
    const lead = size * 0.93, top = texH / 2 - (lines.length * lead) / 2 + size * 0.78 - texH * 0.02;
    lines.forEach((l, i) => x.fillText(l, texW / 2, top + i * lead));
    const src = x.getImageData(0, 0, texW, texH).data, n = texW * texH, mask = new Float32Array(n);
    for (let i = 0; i < n; i++) mask[i] = src[i * 4 + 3] / 255;
    let a = mask.slice(), b = new Float32Array(n); const r = Math.round(P.bevel * k);   // 0: no bevel, a hard edge
    for (let pass = 0; pass < (r > 0 ? 3 : 0); pass++) {                              // three box blurs make a gaussian: the bevel
      for (let y = 0; y < texH; y++) { let s = 0; const o = y * texW; for (let i = -r; i <= r; i++) s += a[o + Math.min(texW - 1, Math.max(0, i))];
        for (let xx = 0; xx < texW; xx++) { b[o + xx] = s / (2 * r + 1); s += a[o + Math.min(texW - 1, xx + r + 1)] - a[o + Math.max(0, xx - r)]; } }
      for (let xx = 0; xx < texW; xx++) { let s = 0; for (let i = -r; i <= r; i++) s += b[Math.min(texH - 1, Math.max(0, i)) * texW + xx];
        for (let y = 0; y < texH; y++) { a[y * texW + xx] = s / (2 * r + 1); s += b[Math.min(texH - 1, y + r + 1) * texW + xx] - b[Math.max(0, y - r) * texW + xx]; } }
    }
    const data = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { let h = Math.min(1, Math.max(0, (a[i] - 0.5) * 2.2)) * mask[i]; h = h * h * (3 - 2 * h); data[i * 2] = h; data[i * 2 + 1] = mask[i]; }
    hTex = hTex || gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, hTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, texW, texH, 0, gl.RG, gl.FLOAT, data);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    for (const [kk, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, kk, v);
    TL = target(stage.pw, stage.ph); TA = target(stage.pw >> 2, stage.ph >> 2); TB = target(stage.pw >> 2, stage.ph >> 2); TR = target(stage.pw >> 1, stage.ph >> 1);
    lamp.x = lamp.tx = lamp.x || W * 0.18; lamp.y = lamp.ty = lamp.y || H * 0.42;
  }

  // ---------- the lamp: rests at the left; one slow turn after a few seconds untouched; then it is yours ----------
  const lamp = { x: 0, y: 0, tx: 0, ty: 0, held: false };
  const born = performance.now(); let demoT = -1;
  const take = (q) => { lamp.held = true; demoT = -1; lamp.tx = q.x; lamp.ty = q.y; };
  offs.push(stage.on('down', (q) => take(q)));
  offs.push(stage.on('move', (q) => { if (q.type === 'mouse' || q.down) take(q); }));

  // ---------- reveal: the lamp, the heights, the rays ----------
  const rv = createReveal(stage, (c, W_, H_, k) => {
    const colr = (a) => rvInk(stage, a);
    grid(c, W_, H_, 24, colr, k); corners(c, W_, H_, 16, colr, k);
    c.strokeStyle = colr(0.7 * k); c.lineWidth = 1;
    for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; c.beginPath(); c.moveTo(lamp.x + Math.cos(a) * 12, lamp.y + Math.sin(a) * 12); c.lineTo(lamp.x + Math.cos(a) * P.reach, lamp.y + Math.sin(a) * P.reach); c.stroke(); }
    c.strokeStyle = colr(k); c.lineWidth = 1.4; c.beginPath(); c.arc(lamp.x, lamp.y, 9, 0, 7); c.stroke();
    label(c, `lamp  ${Math.round(lamp.x)}, ${Math.round(lamp.y)}  height ${P.height}`, lamp.x + 16, lamp.y - 12, colr, k);
    titleBlock(c, W_, H_, ['GLINT · STRUCTURE', '○ lamp  ─ the light it throws', `bevel ${P.bevel} px · reach ${P.reach} px`], colr, k);
  });

  // ---------- settings ----------
  const Ctl = (key, label2, min, max, step) => ({ key, label: label2, min, max, step });
  const tune = {
    title: 'Glint', values: P, defaults: DEF,
    groups: [
      { name: 'Light', items: [Ctl('haze', 'Light in the air (beams)', 0, 3, 0.02), Ctl('height', 'Lamp height (low: grazing)', 20, 400, 5), Ctl('reach', 'How far the lamp reaches', 100, 2400, 20), Ctl('sharp', 'Glint (soft to sharp)', 4, 300, 1), Ctl('bloom', 'Bloom', 0, 3, 0.05), Ctl('bevel', 'Bevel width (px)', 0, 24, 0.5), Ctl('face', 'The face, seen at all', 0, 0.12, 0.002)] },
      { name: 'Cone', items: [{ key: 'cone', label: 'Light in a cone', type: 'toggle' }, Ctl('coneW', 'Cone width (half angle, deg)', 3, 90, 1), Ctl('coneSoft', 'Cone edge (hard to soft)', 0, 1, 0.01), { key: 'aimName', label: 'Aim at the name', type: 'toggle' }, Ctl('aim', 'Aim (deg, when not at the name)', 0, 360, 1)] },
      { name: 'Look', items: [{ key: 'flat', label: 'Flat black and white', type: 'toggle' }, Ctl('cut', 'Where white begins', 0.01, 0.9, 0.01)] },
    ],
    set(key, v) { P[key] = v; if (key === 'bevel') build(); },
    reset() { Object.assign(P, DEF); build(); },
  };

  // ---------- the frame ----------
  let last = performance.now();
  const frame = (now) => {
    if (!hTex || !TL) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (col) col.update(dt);
    if (!lamp.held && !stage.reduced) {
      if (demoT < 0 && now - born > 3500 && !frame.done) { demoT = 0; frame.done = true; }
      if (demoT >= 0) { demoT += dt; const u = Math.min(1, demoT / 11); lamp.tx = W * (0.18 + 0.64 * u); lamp.ty = H * (0.5 + 0.22 * Math.sin(u * Math.PI * 2.0)); if (u >= 1) demoT = -1; }
    }
    lamp.x += (lamp.tx - lamp.x) * Math.min(1, dt * 9); lamp.y += (lamp.ty - lamp.y) * Math.min(1, dt * 9);
    const lampZ = P.height;
    let ax = Math.cos(P.aim * Math.PI / 180), ay = Math.sin(P.aim * Math.PI / 180);   // the cone's direction, on the page (y down)
    if (P.aimName) { const dx = W / 2 - lamp.x, dy = H / 2 - lamp.y, l = Math.hypot(dx, dy); if (l > 1) { ax = dx / l; ay = dy / l; } }
    const cone = (pp) => { gl.uniform1f(pp.u('uCone'), P.cone ? 1 : 0); gl.uniform1f(pp.u('uConeW'), P.coneW * Math.PI / 180); gl.uniform1f(pp.u('uConeSoft'), P.coneSoft); gl.uniform2f(pp.u('uAim'), ax, ay); };
    gl.disable(gl.BLEND); gl.bindVertexArray(vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, TL.f); gl.viewport(0, 0, TL.w, TL.h); gl.useProgram(pL.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, hTex); gl.uniform1i(pL.u('uH'), 0);
    gl.uniform2f(pL.u('uCss'), W, H); gl.uniform2f(pL.u('uTex'), 1 / texW, 1 / texH); gl.uniform3f(pL.u('uLamp'), lamp.x, lamp.y, lampZ);
    gl.uniform1f(pL.u('uSharp'), P.sharp); gl.uniform1f(pL.u('uReach'), P.reach); gl.uniform1f(pL.u('uFace'), P.face); gl.uniform1f(pL.u('uDepth'), 30 * (W / texW) / 2); cone(pL);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.useProgram(pB.p);                                                // bloom: a quarter-size blur, there and back, twice
    for (let pass = 0; pass < 2; pass++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, TA.f); gl.viewport(0, 0, TA.w, TA.h); gl.bindTexture(gl.TEXTURE_2D, pass ? TB.t : TL.t); gl.uniform1i(pB.u('uS'), 0); gl.uniform2f(pB.u('uDir'), 1 / TA.w, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, TB.f); gl.bindTexture(gl.TEXTURE_2D, TA.t); gl.uniform2f(pB.u('uDir'), 0, 1 / TA.h); gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, TR.f); gl.viewport(0, 0, TR.w, TR.h); gl.useProgram(pR.p);   // the air
    gl.bindTexture(gl.TEXTURE_2D, hTex); gl.uniform1i(pR.u('uH'), 0);
    gl.uniform2f(pR.u('uLampUV'), lamp.x / W, 1 - lamp.y / H); gl.uniform2f(pR.u('uCss'), W, H); gl.uniform1f(pR.u('uReach'), P.reach); cone(pR);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, stage.pw, stage.ph); gl.useProgram(pC.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, TL.t); gl.uniform1i(pC.u('uL'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, TB.t); gl.uniform1i(pC.u('uB'), 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, TR.t); gl.uniform1i(pC.u('uR'), 2); gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(pC.u('uBloom'), P.bloom); gl.uniform1f(pC.u('uHaze'), P.haze); gl.uniform1f(pC.u('uCol'), col ? col.amount : 0); gl.uniform1f(pC.u('uInv'), dark ? 0 : 1);
    gl.uniform1f(pC.u('uFlat'), P.flat ? 1 : 0); gl.uniform1f(pC.u('uCut'), P.cut);
    gl.uniform2f(pC.u('uCss'), W, H); gl.uniform3f(pC.u('uLamp'), lamp.x, lamp.y, lampZ); gl.uniform3fv(pC.u('uG[0]'), gUni);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    rv.draw(now);
  };
  await build();
  offs.push(stage.frame((dt, t) => frame(performance.now())));
  let rt = 0; offs.push(stage.on('resize', () => { clearTimeout(rt); rt = setTimeout(build, 120); }));

  return {
    tune,
    debug: { lamp, build },
    destroy() { alive = false; clearTimeout(rt); rv.destroy(); offs.forEach((f) => f()); stage.setBackdrop(null); },
  };
}
