// Emboss. Paper that is flat, mostly.
//
// The type is blind-embossed: same tone as the paper, shown only by relief. The cursor is a raking light,
// so shadows and highlights slide across the letters as it moves. A pressed finger dents the soft stock,
// and the paper slowly relaxes. Under the flat graphic: a height field built from the type mask, finite
// difference normals, a point light held low over the surface, and a little paper tooth.

import { getGL, compile, texture, uploadCanvas, VS_TRI, clamp } from '../engine.js';

export function mount(ctx) {
  const { canvas } = ctx;
  const gl = getGL(canvas);
  if (!gl) throw new Error('webgl2 unavailable');
  const offs = [];

  const FS = `#version 300 es
  precision highp float;
  in vec2 uv;
  uniform sampler2D uMask, uDent;
  uniform vec2 uRes;
  uniform float uPx;            // canvas px per css px
  uniform float uRelief;        // height of the type above the paper, canvas px
  uniform float uDentAmp;       // depth of a full dent, canvas px
  uniform vec3 uLight;          // light position: x, y in canvas px, z = height above the paper
  uniform float uBase, uGain;   // paper lightness, and how strongly slope shows
  out vec4 o;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }

  float height(vec2 px) {
    vec2 q = px / uRes;
    float a = textureLod(uMask, q, 1.5).r;
    float b = textureLod(uMask, q, 3.4).r;
    float relief = 0.72 * smoothstep(0.22, 0.78, a) + 0.28 * smoothstep(0.03, 0.97, b);
    float dent = texture(uDent, q).r;
    float tooth = (vnoise(px / uPx * 0.9) - 0.5) * 0.5 + (vnoise(px / uPx * 0.22) - 0.5) * 0.55;
    return uRelief * relief - uDentAmp * dent + tooth * 0.09 * uPx;
  }

  void main() {
    vec2 px = uv * uRes;
    float e = 1.0;
    vec2 g = vec2(height(px + vec2(e, 0.0)) - height(px - vec2(e, 0.0)),
                  height(px + vec2(0.0, e)) - height(px - vec2(0.0, e))) / (2.0 * e);
    vec3 N = normalize(vec3(-g, 1.0));
    vec3 L = normalize(uLight - vec3(px, 0.0));
    float lz = max(L.z, 0.02);
    float r = dot(N, L) / lz;                                // 1 on flat paper, more on lit slopes, less in shade
    vec2 d = (px - uLight.xy) / uRes.y;
    float pool = exp(-dot(d, d) * 0.9);                      // a soft pool of light under the lamp
    float s = r - 1.0;
    s = s / (1.0 + abs(s) * 0.7);                           // soft shoulders: no hard black, no blown white
    float v = uBase * (0.965 + 0.07 * pool) + s * uGain * (0.85 + 0.3 * pool);
    o = vec4(vec3(clamp(v, 0.0, 1.0)), 1.0);
  }`;

  const prog = compile(gl, VS_TRI, FS);
  const maskTex = texture(gl, { w: 1, h: 1 });
  const dark = ctx.theme.name === 'dark';

  // ---------- the type ----------
  const FONT = '"Archivo", "Arial Black", "Helvetica Neue", sans-serif';
  function drawMask() {
    const W = ctx.pw, H = ctx.ph, k = W / ctx.W;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    const pad = Math.max(16 * k, W * 0.045);
    const maxW = (W - pad * 2) * (W / H > 1 ? 0.62 : 1);

    g.font = '900 100px ' + FONT;
    const w100 = g.measureText('Flat.').width || 1;
    const size = Math.min((maxW / w100) * 100, H * 0.34);
    g.font = `900 ${size}px ${FONT}`;
    const m = g.measureText('Flat.');
    const base = pad + m.actualBoundingBoxAscent;
    g.fillText('Flat.', pad + m.actualBoundingBoxLeft, base);

    const s2 = Math.max(size * 0.34, 22 * k);
    g.font = `800 ${s2}px ${FONT}`;
    const m2 = g.measureText('Not entirely.');
    g.fillText('Not entirely.', pad + m2.actualBoundingBoxLeft, base + s2 * 1.5);
    uploadCanvas(gl, maskTex, c, { mipmap: true });
  }

  // ---------- dents: a small grid the finger writes into, relaxing over a few seconds ----------
  let GW = 0, GH = 0, dent = null, bytes = null, dentTex = null;
  function rebuild() {
    drawMask();
    GW = 128; GH = Math.max(48, Math.round(GW * ctx.H / ctx.W));
    dent = new Float32Array(GW * GH); bytes = new Uint8Array(GW * GH);
    if (dentTex) gl.deleteTexture(dentTex);
    dentTex = texture(gl, { w: GW, h: GH, internal: gl.R8, format: gl.RED, type: gl.UNSIGNED_BYTE, filter: gl.LINEAR });
  }
  offs.push(ctx.on('resize', rebuild));
  rebuild();

  function press(u, v, sigmaPx, amount) {
    const sx = sigmaPx / ctx.W * GW, sy = sigmaPx / ctx.H * GH;
    const cx = u * GW, cy = v * GH;
    const x0 = Math.max(0, Math.floor(cx - sx * 3)), x1 = Math.min(GW - 1, Math.ceil(cx + sx * 3));
    const y0 = Math.max(0, Math.floor(cy - sy * 3)), y1 = Math.min(GH - 1, Math.ceil(cy + sy * 3));
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - cy) / sy;
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / sx;
        const i = y * GW + x;
        dent[i] = Math.min(1, dent[i] + amount * Math.exp(-(dx * dx + dy * dy) * 0.5));
      }
    }
  }
  const sigma = () => Math.min(ctx.W, ctx.H) * 0.06;
  offs.push(ctx.on('down', (p) => press(p.u, p.v, sigma(), 0.4)));

  // ---------- frame ----------
  const light = { x: 0, y: 0 };
  offs.push(ctx.frame((dt, t) => {
    // dents: pressed finger digs, everything relaxes
    const relax = Math.exp(-dt / (ctx.reduced ? 1.2 : 3.4));
    for (let i = 0; i < dent.length; i++) dent[i] *= relax;
    if (ctx.ptr.down) press(ctx.ptr.u, ctx.ptr.v, sigma(), dt * 0.9);
    for (let i = 0; i < dent.length; i++) bytes[i] = Math.min(255, (dent[i] * 255) | 0);
    gl.bindTexture(gl.TEXTURE_2D, dentTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GW, GH, gl.RED, gl.UNSIGNED_BYTE, bytes);

    // the lamp: rests up and to the left, follows the pointer, and slides in once at the start
    const k = ctx.pw / ctx.W;
    const intro = ctx.reduced ? 0 : Math.exp(-t * 2.2);
    const lx = 0.5 + (-0.38 + ctx.look.x * 0.55) * 0.5 - intro * 0.9;
    const ly = 0.5 + (0.30 + ctx.look.y * 0.55) * 0.5;
    light.x += (lx * ctx.pw - light.x) * Math.min(1, dt * 14);
    light.y += (ly * ctx.ph - light.y) * Math.min(1, dt * 14);
    if (t < 0.02) { light.x = lx * ctx.pw; light.y = ly * ctx.ph; }

    prog.use(); const u = prog.u;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, ctx.pw, ctx.ph);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, maskTex); gl.uniform1i(u.uMask, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, dentTex); gl.uniform1i(u.uDent, 1);
    gl.uniform2f(u.uRes, ctx.pw, ctx.ph);
    gl.uniform1f(u.uPx, k);
    gl.uniform1f(u.uRelief, 6.5 * k);
    gl.uniform1f(u.uDentAmp, 46 * k);
    gl.uniform3f(u.uLight, light.x, light.y, 0.2 * ctx.ph);
    gl.uniform1f(u.uBase, dark ? 0.09 : 0.94);
    gl.uniform1f(u.uGain, dark ? 0.46 : 0.5);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }));

  return { debug: { press, stats: () => ({ max: Math.max(...dent), GW, GH }) }, destroy() { offs.forEach((off) => off()); } };
}
