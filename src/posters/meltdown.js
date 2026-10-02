// Meltdown. Crisp two-tone type that runs when it is touched.
//
// Under the flat graphic: a heat field (a small grid the finger writes into, decaying over a few
// seconds) and a fragment shader that, for every pixel, looks "upstream" along gravity for the nearest
// letter and, if the heat at that spot allows, lets it pour down as a round-tipped drip. Output is
// still two flat tones, so however far it runs, it reads as printed type, not as a smear.
// Tilt a phone and the drips follow the device's real gravity.

import { getGL, compile, texture, uploadCanvas, typeMask, VS_TRI, clamp } from '../engine.js';

export function mount(ctx) {
  const { canvas } = ctx;
  const gl = getGL(canvas);
  if (!gl) throw new Error('webgl2 unavailable');
  ctx.adaptive = true;
  const offs = [];

  const FS = `#version 300 es
  precision highp float;
  in vec2 uv;
  uniform sampler2D uText, uHeat;
  uniform vec2 uRes;          // canvas px
  uniform vec2 uDir;          // unit vector the material runs toward (y up)
  uniform float uMax;         // longest possible drip, px
  uniform float uPx;          // canvas px per css px, so drips keep their size across screens
  uniform float uSeed;
  uniform vec3 uBg, uFg;
  out vec4 o;

  float h11(float n) { return fract(sin(n * 127.1 + uSeed * 17.31) * 43758.5453); }

  // One layer of drips: cells of width cw along the cross axis, each with its own reach, round-tipped.
  float layer(float c, float cw, float lo, float hi, float salt) {
    float id = floor(c / cw);
    float f = fract(c / cw) * 2.0 - 1.0;
    float reach = mix(lo, hi, h11(id + salt));
    float body = 0.62;                                   // drip width as a share of its cell; the rest is gap
    if (abs(f) > body) return 0.0;
    float r = body * cw * 0.5;                           // cap radius, px
    float x = f / body;
    float Lfull = reach * uMax;
    return max(0.0, Lfull - r + r * sqrt(max(0.0, 1.0 - x * x)));
  }

  void main() {
    vec2 px = uv * uRes;
    float base = smoothstep(0.42, 0.58, texture(uText, uv).r);
    float a = base;

    if (base < 0.99) {
      const int N = 56;
      float stepPx = uMax / float(N);
      float d = -1.0;
      for (int i = 1; i <= N; i++) {
        float s = stepPx * float(i);
        if (texture(uText, (px - uDir * s) / uRes).r > 0.5) { d = s; break; }
      }
      if (d > 0.0) {
        float lo = d - stepPx, hi = d;
        for (int k = 0; k < 6; k++) {
          float mid = 0.5 * (lo + hi);
          if (texture(uText, (px - uDir * mid) / uRes).r > 0.5) hi = mid; else lo = mid;
        }
        d = hi;
        vec2 src = (px - uDir * d) / uRes;
        float heat = texture(uHeat, src).r;
        if (heat > 0.004) {
          vec2 perp = vec2(-uDir.y, uDir.x);
          float c = dot(px, perp);
          float L = max(layer(c, 13.0 * uPx, 0.12, 0.55, 3.0), layer(c, 31.0 * uPx, 0.35, 1.0, 11.0));
          L *= smoothstep(0.0, 0.85, heat);
          a = max(a, clamp((L - d) / 1.5 + 0.5, 0.0, 1.0));
        }
      }
    }
    o = vec4(mix(uBg, uFg, a), 1.0);
  }`;

  const prog = compile(gl, VS_TRI, FS);
  const textTex = texture(gl, { w: 1, h: 1 });
  let heatTex = null, heat = null, bytes = null, GW = 0, GH = 0;
  const gdir = { x: 0, y: -1 };
  const intro = { x: 0.2 + ctx.rand() * 0.6, until: ctx.reduced ? 0 : 0.7 };

  function rebuild() {
    const chrome = document.querySelector('.chrome');
    const reserve = (((chrome && chrome.offsetHeight) || 56) + 28) * (ctx.pw / ctx.W);
    const mask = typeMask(ctx.pw, ctx.ph, {
      lines: ['MELT', 'DOWN'], mode: 'justify', valign: 'top', gap: 0.12, bottomReserve: reserve, pad: 0.05,
    });
    uploadCanvas(gl, textTex, mask);
    intro.y = 1 - ((mask.info.padding + (ctx.ph - reserve) * 0.4) / ctx.ph);

    GW = 72; GH = Math.max(36, Math.round(GW * ctx.H / ctx.W));
    heat = new Float32Array(GW * GH);
    bytes = new Uint8Array(GW * GH);
    if (heatTex) gl.deleteTexture(heatTex);
    heatTex = texture(gl, { w: GW, h: GH, internal: gl.R8, format: gl.RED, type: gl.UNSIGNED_BYTE, filter: gl.LINEAR });
  }
  offs.push(ctx.on('resize', rebuild));
  rebuild();

  function deposit(u, v, sigmaPx, amount) {
    const sx = sigmaPx / ctx.W * GW, sy = sigmaPx / ctx.H * GH;   // grid cells per sigma, per axis
    const cx = u * GW, cy = v * GH;
    const x0 = Math.max(0, Math.floor(cx - sx * 3)), x1 = Math.min(GW - 1, Math.ceil(cx + sx * 3));
    const y0 = Math.max(0, Math.floor(cy - sy * 3)), y1 = Math.min(GH - 1, Math.ceil(cy + sy * 3));
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - cy) / sy;
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / sx;
        const f = Math.exp(-(dx * dx + dy * dy) * 0.5);
        const i = y * GW + x;
        heat[i] = Math.min(1, heat[i] + amount * f);
      }
    }
  }

  const sigma = () => Math.min(ctx.W, ctx.H) * 0.13;
  let tapBurst = 0;
  offs.push(ctx.on('down', (p) => { tapBurst = 0.35; deposit(p.u, p.v, sigma() * 1.2, 0.35); }));

  offs.push(ctx.frame((dt, t) => {
    // heat: decays, and is written by a pressed finger (full) or a hovering mouse (a little)
    const decay = Math.exp(-dt / (ctx.reduced ? 1.4 : 2.8));
    for (let i = 0; i < heat.length; i++) heat[i] *= decay;
    const p = ctx.ptr;
    if (p.down) deposit(p.u, p.v, sigma(), dt * 1.15);
    else if (p.type === 'mouse' && ctx.interacted) deposit(p.u, p.v, sigma() * 0.8, dt * 0.22);
    if (t < intro.until) deposit(intro.x, intro.y, Math.min(ctx.W, ctx.H) * 0.22, dt * 2.2);

    for (let i = 0; i < heat.length; i++) bytes[i] = Math.min(255, (heat[i] * 255) | 0);
    gl.bindTexture(gl.TEXTURE_2D, heatTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GW, GH, gl.RED, gl.UNSIGNED_BYTE, bytes);

    // gravity: down, unless the phone says otherwise
    const g = ctx.tilt.active && !ctx.reduced ? ctx.tilt : { gx: 0, gy: -1 };
    gdir.x += (g.gx - gdir.x) * Math.min(1, dt * 6); gdir.y += (g.gy - gdir.y) * Math.min(1, dt * 6);
    const gl2 = Math.hypot(gdir.x, gdir.y) || 1;

    prog.use(); const u = prog.u;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, ctx.pw, ctx.ph);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textTex); gl.uniform1i(u.uText, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, heatTex); gl.uniform1i(u.uHeat, 1);
    gl.uniform2f(u.uRes, ctx.pw, ctx.ph);
    gl.uniform2f(u.uDir, gdir.x / gl2, gdir.y / gl2);
    gl.uniform1f(u.uMax, ctx.ph * 0.62);
    gl.uniform1f(u.uPx, ctx.pw / ctx.W);
    gl.uniform1f(u.uSeed, ctx.seed % 997);
    gl.uniform3f(u.uBg, ...ctx.colors.bg);
    gl.uniform3f(u.uFg, ...ctx.colors.fg);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }));

  return {
    debug: { get heat() { return heat; }, deposit },
    destroy() { offs.forEach((off) => off()); },
  };
}
