// Breath. Frosted glass. The type is behind it, legible but soft; a finger wipes a clear path through
// and the fog finds its way back, closing from the edges and leaving specks last.
//
// Under the flat graphic: a fog field (a small grid the finger writes into) that regrows from its own
// neighbours, and a shader that reads that field through a fixed grain map. Where fog is thin the grain
// decides which pixels are still fogged, so it breaks into patches the way real condensation does.

import { getGL, compile, texture, uploadCanvas, VS_TRI } from '../engine.js';

export function mount(ctx) {
  const { canvas } = ctx;
  const gl = getGL(canvas);
  if (!gl) throw new Error('webgl2 unavailable');
  const offs = [];

  const FS = `#version 300 es
  precision highp float;
  in vec2 uv;
  uniform sampler2D uMask, uFog;
  uniform vec2 uRes;
  uniform float uPx;
  uniform vec3 uBg, uFg;
  out vec4 o;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }

  void main() {
    vec2 px = uv * uRes;
    vec2 p = px / uPx;
    // the grain map: a fixed field of condensation thresholds
    float n = 0.5 * vnoise(p * 0.85) + 0.3 * vnoise(p * 0.24 + 13.0) + 0.2 * vnoise(p * 0.06 + 5.0);
    float F = texture(uFog, uv).r;
    float fogA = smoothstep(n - 0.075, n + 0.075, F * 0.8 + 0.12);

    float S = smoothstep(0.42, 0.58, textureLod(uMask, uv, 0.0).r);
    vec3 clear = mix(uBg, uFg, S);

    // frosted type: the mask, softened and roughened by the grain
    vec2 j = (vec2(vnoise(p * 1.4), vnoise(p * 1.4 + 31.0)) - 0.5) * 9.0 * uPx;
    float B = 0.0;
    for (int i = 0; i < 16; i++) {
      float a = float(i) * 2.39996;
      float r = sqrt((float(i) + 0.5) / 16.0) * 15.0 * uPx;
      B += textureLod(uMask, (px + j + vec2(cos(a), sin(a)) * r) / uRes, 1.6).r;
    }
    B /= 16.0;
    vec3 fog = vec3(0.105) + uFg * B * 0.58;

    vec3 col = mix(clear, fog, fogA);
    float edge = fogA * (1.0 - fogA) * 4.0;                  // water catching the light where fog meets glass
    col += edge * 0.14;
    o = vec4(col, 1.0);
  }`;

  const prog = compile(gl, VS_TRI, FS);
  const maskTex = texture(gl, { w: 1, h: 1 });
  const FONT = '"Archivo", "Arial Black", "Helvetica Neue", sans-serif';

  function drawMask() {
    const W = ctx.pw, H = ctx.ph, k = W / ctx.W;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    const pad = Math.max(16 * k, W * 0.045);
    const maxW = (W - pad * 2) * (W / H > 1 ? 0.7 : 1);
    g.font = '900 100px ' + FONT;
    const w100 = g.measureText('Clear.').width || 1;
    const size = Math.min((maxW / w100) * 100, H * 0.4);
    g.font = `900 ${size}px ${FONT}`;
    const m = g.measureText('Clear.');
    const base = H * 0.5 + m.actualBoundingBoxAscent * 0.5;
    g.fillText('Clear.', pad + m.actualBoundingBoxLeft, base);
    uploadCanvas(gl, maskTex, c, { mipmap: true });
  }

  // ---------- the fog field ----------
  let GW = 0, GH = 0, fog = null, next = null, bytes = null, fogTex = null;
  function rebuild() {
    drawMask();
    GW = 128; GH = Math.max(48, Math.round(GW * ctx.H / ctx.W));
    fog = new Float32Array(GW * GH).fill(1);
    next = new Float32Array(GW * GH);
    bytes = new Uint8Array(GW * GH).fill(255);
    if (fogTex) gl.deleteTexture(fogTex);
    fogTex = texture(gl, { w: GW, h: GH, internal: gl.R8, format: gl.RED, type: gl.UNSIGNED_BYTE, filter: gl.LINEAR });
  }
  offs.push(ctx.on('resize', rebuild));
  rebuild();

  function wipeAt(u, v, radiusPx, amount) {
    const sx = radiusPx / ctx.W * GW, sy = radiusPx / ctx.H * GH;
    const cx = u * GW, cy = v * GH;
    const x0 = Math.max(0, Math.floor(cx - sx * 1.3)), x1 = Math.min(GW - 1, Math.ceil(cx + sx * 1.3));
    const y0 = Math.max(0, Math.floor(cy - sy * 1.3)), y1 = Math.min(GH - 1, Math.ceil(cy + sy * 1.3));
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - cy) / sy;
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / sx;
        const d2 = dx * dx + dy * dy;
        if (d2 > 1.5) continue;
        const f = 1 - Math.min(1, d2 / 1.0) * 0.0;                   // flat core, soft shoulder below
        const w = d2 < 1 ? 1 : Math.max(0, 1 - (Math.sqrt(d2) - 1) / 0.22);   // a finger leaves a clean edge
        const i = y * GW + x;
        fog[i] = Math.max(0, fog[i] - amount * w * f);
      }
    }
  }
  const stroke = (u0, v0, u1, v1, radiusPx, amount) => {
    const dx = (u1 - u0) * ctx.W, dy = (v1 - v0) * ctx.H;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (radiusPx * 0.35)));
    for (let s = 0; s <= steps; s++) wipeAt(u0 + (u1 - u0) * (s / steps), v0 + (v1 - v0) * (s / steps), radiusPx, amount);
  };
  const finger = () => Math.min(ctx.W, ctx.H) * 0.085;

  let last = null;
  offs.push(ctx.on('down', (p) => { last = [p.u, p.v]; wipeAt(p.u, p.v, finger(), 1); }));
  offs.push(ctx.on('move', (p) => {
    if (!last) last = [p.u, p.v];
    if (p.down) stroke(last[0], last[1], p.u, p.v, finger(), 1);
    else if (p.type === 'mouse') stroke(last[0], last[1], p.u, p.v, finger() * 0.62, 0.55);
    last = [p.u, p.v];
  }));
  offs.push(ctx.on('up', () => { /* keep last for hover */ }));

  // ---------- frame ----------
  let ip = null;
  offs.push(ctx.frame((dt, t) => {
    // one slow pass of an invisible finger at the start, so the glass shows that it wipes
    if (!ctx.reduced && t > 0.35 && t < 1.9) {
      const k = (t - 0.35) / 1.55, e = k * k * (3 - 2 * k);
      const u = 0.08 + 0.78 * e, v = 0.5 + 0.03 * Math.sin(k * 5);
      if (ip) stroke(ip[0], ip[1], u, v, finger(), 1);
      ip = [u, v];
    }

    // the fog regrows from its neighbours, so a cleared path closes from its edges inward
    const grow = ctx.reduced ? 0.5 : 0.28, seed = ctx.reduced ? 0.014 : 0.017;
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const i = y * GW + x;
        const f = fog[i];
        if (f >= 1) { next[i] = 1; continue; }
        const l = x > 0 ? fog[i - 1] : 1, r = x < GW - 1 ? fog[i + 1] : 1;
        const d = y > 0 ? fog[i - GW] : 1, u = y < GH - 1 ? fog[i + GW] : 1;
        const avg = (l + r + d + u) * 0.25;
        next[i] = Math.min(1, f + dt * (seed + grow * avg * avg) * (1 - f * 0.3));
      }
    }
    const tmp = fog; fog = next; next = tmp;
    for (let i = 0; i < fog.length; i++) bytes[i] = Math.min(255, (fog[i] * 255 + 0.5) | 0);
    gl.bindTexture(gl.TEXTURE_2D, fogTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GW, GH, gl.RED, gl.UNSIGNED_BYTE, bytes);

    prog.use(); const u = prog.u;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, ctx.pw, ctx.ph);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, maskTex); gl.uniform1i(u.uMask, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fogTex); gl.uniform1i(u.uFog, 1);
    gl.uniform2f(u.uRes, ctx.pw, ctx.ph);
    gl.uniform1f(u.uPx, ctx.pw / ctx.W);
    gl.uniform3f(u.uBg, ...ctx.colors.bg);
    gl.uniform3f(u.uFg, ...ctx.colors.fg);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }));

  return { debug: { wipeAt, stroke, get fog() { return fog; } }, destroy() { offs.forEach((off) => off()); } };
}
