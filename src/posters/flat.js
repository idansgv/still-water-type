// Flat. A flat poster, probably.
//
// Head-on it is a flat, two-tone word. Under the graphic: the word is a solid slab, ray-marched in a
// fragment shader straight from a type mask: real side walls, real cast shadows, a camera that orbits
// with the cursor, a dragging finger, or the tilt of a phone. Nothing is 3D until you move.

import { getGL, compile, texture, uploadCanvas, typeMask, VS_TRI } from '../engine.js';

export function mount(ctx) {
  const { canvas } = ctx;
  const gl = getGL(canvas);
  if (!gl) throw new Error('webgl2 unavailable');
  ctx.adaptive = true;
  const offs = [];

  const FS = `#version 300 es
  precision highp float;
  in vec2 uv;
  uniform sampler2D uMask;
  uniform vec2 uRes;
  uniform float uA;            // world half-width (the poster is x in [-uA, uA], y in [-1, 1])
  uniform vec2 uAng;           // yaw, pitch
  uniform float uDepth;        // slab thickness
  uniform vec3 uBg, uFg;
  uniform float uPx;
  out vec4 o;

  const float R = 3.2;
  const vec3 LIGHT = normalize(vec3(-0.5, 0.62, 0.95));

  float M(vec2 p) {
    vec2 q = p / vec2(uA, 1.0) * 0.5 + 0.5;
    if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) return 0.0;
    return textureLod(uMask, q, 0.0).r;   // explicit level: derivatives are meaningless inside the march
  }
  float Mb(vec2 p) {
    vec2 q = clamp(p / vec2(uA, 1.0) * 0.5 + 0.5, 0.0, 1.0);
    return textureLod(uMask, q, 1.6).r;
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    vec2 ndc = uv * 2.0 - 1.0;
    float cy = cos(uAng.x), sy = sin(uAng.x), cp = cos(uAng.y), sp = sin(uAng.y);
    // yaw about y, then pitch about x
    mat3 Ry = mat3(cy, 0.0, -sy,  0.0, 1.0, 0.0,  sy, 0.0, cy);
    mat3 Rx = mat3(1.0, 0.0, 0.0,  0.0, cp, sp,  0.0, -sp, cp);
    mat3 Rm = Ry * Rx;
    vec3 O = Rm * vec3(0.0, 0.0, R);
    vec3 D = Rm * normalize(vec3(ndc.x * uA, ndc.y, -(R - uDepth)));   // the top face, not the floor, fills the frame

    float lum = dot(uBg, vec3(0.3333));
    bool dark = lum < 0.5;
    vec3 ground = dark ? mix(uBg, uFg, 0.085) : uBg;
    vec3 shadowC = dark ? uBg : mix(uBg, uFg, 0.15);
    vec3 col = ground;

    if (D.z < -0.001) {
      float t0 = (uDepth - O.z) / D.z;
      float t1 = (0.0 - O.z) / D.z;
      const int N = 72;
      float dt = (t1 - t0) / float(N);
      float hitT = -1.0;
      bool top = false;
      if (M((O + D * t0).xy) > 0.5) { hitT = t0; top = true; }
      else {
        float tp = t0;
        for (int i = 1; i <= N; i++) {
          float t = t0 + dt * float(i);
          if (M((O + D * t).xy) > 0.5) {
            float a = tp, b = t;
            for (int k = 0; k < 5; k++) { float m = 0.5 * (a + b); if (M((O + D * m).xy) > 0.5) b = m; else a = m; }
            hitT = b; break;
          }
          tp = t;
        }
      }

      if (hitT >= 0.0) {
        vec3 p = O + D * hitT;
        if (top) {
          col = uFg;
        } else {
          float e = 2.5 / uRes.y;
          vec2 g = vec2(Mb(p.xy + vec2(e, 0.0)) - Mb(p.xy - vec2(e, 0.0)), Mb(p.xy + vec2(0.0, e)) - Mb(p.xy - vec2(0.0, e)));
          vec2 n2 = -g / (length(g) + 1e-5);
          float diff = clamp(dot(vec3(n2, 0.0), LIGHT) * 1.15, 0.0, 1.0);
          float ao = mix(0.5, 1.0, clamp(p.z / uDepth, 0.0, 1.0));
          float k = (0.3 + 0.55 * diff) * ao;
          col = mix(uBg, uFg, k);
          if (dark) col = mix(ground, uFg, k);
        }
      } else {
        // ground, with the slab's shadow thrown across it
        vec3 g0 = O + D * t1;
        float tz = uDepth / LIGHT.z;
        float sh = 0.0;
        const int S = 36;
        float j = hash(gl_FragCoord.xy) * 0.9;
        for (int i = 1; i <= S; i++) {
          float s = tz * (float(i) - j * 0.0) / float(S);
          vec3 q = g0 + LIGHT * s;
          sh = max(sh, smoothstep(0.35, 0.65, M(q.xy)));
        }
        col = mix(ground, shadowC, sh);
      }
    }
    o = vec4(col, 1.0);
  }`;

  const prog = compile(gl, VS_TRI, FS);
  const maskTex = texture(gl, { w: 1, h: 1 });
  const ang = { x: 0, y: 0 };

  function rebuild() {
    const chrome = document.querySelector('.chrome');
    const reserve = (((chrome && chrome.offsetHeight) || 56) + 24) * (ctx.pw / ctx.W);
    const mask = typeMask(ctx.pw, ctx.ph, { lines: ['FLAT'], mode: 'fit', rotate: 'auto', valign: 'center', pad: 0.07, bottomReserve: reserve });
    uploadCanvas(gl, maskTex, mask, { mipmap: true });
  }
  offs.push(ctx.on('resize', rebuild));
  rebuild();

  offs.push(ctx.frame((dt, t) => {
    // a single breath at the start, so a flat poster admits it is not
    let nudge = 0;
    if (!ctx.reduced) nudge = 0.42 * Math.sin(t * 3.4) * Math.exp(-t * 1.7);
    const tx = ctx.look.x * 0.75 + nudge, ty = -ctx.look.y * 0.5 + nudge * 0.35;
    ang.x += (tx - ang.x) * Math.min(1, dt * 14); ang.y += (ty - ang.y) * Math.min(1, dt * 14);

    prog.use(); const u = prog.u;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, ctx.pw, ctx.ph);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, maskTex); gl.uniform1i(u.uMask, 0);
    gl.uniform2f(u.uRes, ctx.pw, ctx.ph);
    gl.uniform1f(u.uA, ctx.pw / ctx.ph);
    gl.uniform2f(u.uAng, ang.x, ang.y);
    gl.uniform1f(u.uDepth, 0.34);
    gl.uniform1f(u.uPx, ctx.pw / ctx.W);
    gl.uniform3f(u.uBg, ...ctx.colors.bg);
    gl.uniform3f(u.uFg, ...ctx.colors.fg);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }));

  return { destroy() { offs.forEach((off) => off()); } };
}
