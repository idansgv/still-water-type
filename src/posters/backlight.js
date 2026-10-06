// Backlight. The name is solid, black, standing on a black glossy floor in a black room. Nothing shows. A rectangular
// light hangs behind it: find it, and the letters come out of the dark as silhouettes against the glow, their long
// shadows run toward you across the floor, and the floor shows the light and the type again, upside down.
//
// After three.js's RectAreaLight example (a rectangular emitter, a glossy floor, soft shadows), rebuilt by hand.
//
// How it is drawn: one full-screen pass that ray-marches the scene. The type is a real extrusion: a 2D signed distance
// field of the word (computed once on the CPU from a canvas, a texture) combined with a thickness, so letters have
// depth and side faces, and the camera can move around them. The light is a rectangle at the back: rays that reach it
// see its glow, rays that bounce off the floor reach it too (the reflection), and the floor under the type is lit by the
// nearest point on the rectangle, with a soft shadow marched toward it, which is what gives the long soft shadows.
// With the light off everything is black on black, which is the whole trick.

import { getGL, compile, clamp } from '../engine.js';

const FONT = '"Archivo", "Arial Black", "Helvetica Neue", sans-serif';
const LINES = ['Idan', 'Segev'];

export async function mount(ctx) {
  const { canvas } = ctx;
  const gl = getGL(canvas);
  if (!gl) throw new Error('webgl2 unavailable');
  ctx.adaptive = true;
  const offs = [];

  const DEFAULTS = {
    lightW: 1.5, lightH: 1.6, lightY: 1.8, lightZ: -2.7, range: 3.6, glow: 0.8, power: 1, depth: 0.42, gloss: 1, follow: 5, orbit: 0.16,
  };
  const P = { ...DEFAULTS };

  // ---------- the type: a signed distance field of the word, in world units ----------
  const TYPE_W = 6.4;                                                     // world width of the word
  const CW = 1024;
  let sdfTex = null, typeS = [TYPE_W, 2], typeC = [0, 1];
  function buildType() {
    const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
    g.font = `900 100px ${FONT}`;
    const cap100 = g.measureText('H').actualBoundingBoxAscent || 72;
    const pad = Math.round(CW * 0.03), availW = CW - pad * 2;
    const sizes = LINES.map((l) => (availW / (g.measureText(l).width || 1)) * 100);
    const caps = sizes.map((s) => cap100 * s / 100), gap = Math.min(...caps) * 0.12;
    const descend = Math.round(Math.max(...sizes) * 0.22);
    const CH = Math.ceil(caps.reduce((a, b) => a + b, 0) + gap * (LINES.length - 1) + descend + pad * 2);
    c.width = CW; c.height = CH;
    g.fillStyle = '#000'; g.fillRect(0, 0, CW, CH);
    g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
    let y = pad;
    LINES.forEach((line, i) => {
      g.font = `900 ${sizes[i]}px ${FONT}`;
      y += caps[i];
      g.fillText(line, (CW - g.measureText(line).width) / 2, y);
      y += gap;
    });
    const img = g.getImageData(0, 0, CW, CH).data;
    const n = CW * CH, ink = new Uint8Array(n);
    for (let i = 0; i < n; i++) ink[i] = img[i * 4] > 127 ? 1 : 0;
    const dOut = edt(ink, CW, CH, 1), dIn = edt(ink, CW, CH, 0);       // distance to ink, and distance to not-ink
    const wpp = TYPE_W / CW, data = new Float32Array(n);
    for (let i = 0; i < n; i++) data[i] = ink[i] ? -(Math.sqrt(dIn[i]) - 0.5) * wpp : (Math.sqrt(dOut[i]) - 0.5) * wpp;
    if (sdfTex) gl.deleteTexture(sdfTex);
    sdfTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, sdfTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, CW, CH, 0, gl.RED, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    typeS = [TYPE_W, CH * wpp];
    typeC = [0, CH * wpp / 2 - (pad + descend) * wpp];                   // the lowest ink (the g) touches the floor
  }
  // exact squared Euclidean distance transform (Felzenszwalb and Huttenlocher); `src` is the value that counts as a source
  function edt(grid, w, h, src) {
    const INF = 1e12, f = new Float64Array(Math.max(w, h)), v = new Int32Array(Math.max(w, h)), z = new Float64Array(Math.max(w, h) + 1);
    const out = new Float64Array(w * h);
    const pass = (n, get, set) => {
      for (let i = 0; i < n; i++) f[i] = get(i);
      let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < n; q++) {
        let s;
        for (;;) { const p = v[k]; s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p); if (s <= z[k] && k > 0) k--; else break; }
        if (s <= z[k]) { v[k] = q; z[k] = -INF; z[k + 1] = INF; continue; }
        k++; v[k] = q; z[k] = s; z[k + 1] = INF;
      }
      k = 0;
      for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const p = v[k]; set(q, (q - p) * (q - p) + f[p]); }
    };
    for (let i = 0; i < w * h; i++) out[i] = grid[i] === src ? 0 : INF;
    for (let x = 0; x < w; x++) pass(h, (y) => out[y * w + x], (y, val) => { out[y * w + x] = val; });
    for (let y = 0; y < h; y++) pass(w, (x) => out[y * w + x], (x, val) => { out[y * w + x] = val; });
    return out;
  }
  buildType();

  // ---------- the scene ----------
  const FS = `#version 300 es
  precision highp float;
  uniform sampler2D uSDF;
  uniform vec2 uTypeC, uTypeS;
  uniform vec2 uRes;
  uniform float uDepth, uA, uTan, uI, uGlow, uGloss;
  uniform vec3 uCam, uFwd, uRight, uUp;
  uniform vec4 uLight;                     // x, y of the centre and half width and height
  uniform float uLightZ;
  out vec4 o;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  float typeD(vec3 p) {
    vec2 q = p.xy - uTypeC;
    vec2 uv = vec2(q.x / uTypeS.x + 0.5, 0.5 - q.y / uTypeS.y);
    float d2 = textureLod(uSDF, clamp(uv, 0.002, 0.998), 0.0).r;
    d2 += length(max(abs(q) - 0.5 * uTypeS + 0.02, 0.0));
    float dz = abs(p.z) - uDepth;
    vec2 w = vec2(d2, dz);
    return min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
  }
  vec3 typeN(vec3 p) {
    const vec2 k = vec2(1.0, -1.0); const float e = 0.012;
    return normalize(k.xyy * typeD(p + k.xyy * e) + k.yyx * typeD(p + k.yyx * e) + k.yxy * typeD(p + k.yxy * e) + k.xxx * typeD(p + k.xxx * e));
  }
  // distance along the ray to the type, or -1; only the part inside the type's bounding box is marched
  float traceType(vec3 ro, vec3 rd, float tmax) {
    vec3 c = vec3(uTypeC, 0.0), h = vec3(0.5 * uTypeS, uDepth) + 0.05;
    vec3 inv = 1.0 / rd, a = (c - h - ro) * inv, b = (c + h - ro) * inv;
    vec3 mn = min(a, b), mx = max(a, b);
    float t0 = max(max(mn.x, mn.y), max(mn.z, 0.0)), t1 = min(min(mx.x, mx.y), min(mx.z, tmax));
    if (t1 < t0) return -1.0;
    float t = t0;
    for (int i = 0; i < 64; i++) {
      float d = typeD(ro + rd * t);
      if (d < 0.0015) return t;
      t += d;
      if (t > t1) return -1.0;
    }
    return -1.0;
  }
  float sdRect(vec2 p, vec2 h) { vec2 d = abs(p) - h; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }

  // what a ray sees once it has left the floor: the type (black, a little light on its sides) or the light and its glow
  vec3 sky(vec3 ro, vec3 rd) {
    float tl = rd.z < -1e-4 ? (uLightZ - ro.z) / rd.z : 1e9;
    float tt = traceType(ro, rd, min(tl, 60.0));
    if (tt > 0.0) {
      vec3 p = ro + rd * tt, n = typeN(p);
      vec3 toL = vec3(uLight.xy, uLightZ) - p;
      float dl = length(toL);
      float rim = max(dot(n, toL / dl), 0.0) * uI * 0.9 / (1.0 + 0.12 * dl * dl);
      return vec3(rim);
    }
    if (tl > 1e8) return vec3(0.0);
    vec2 q = (ro + rd * tl).xy - uLight.xy;
    float d = sdRect(q, uLight.zw);
    float body = 1.0 - smoothstep(-0.02, 0.05, d);
    float halo = uGlow * 0.30 / (1.0 + d * d * 1.6) + uGlow * 0.10 / (1.0 + d * d * 0.18);
    return vec3(uI * (body * 5.0 + halo));
  }

  void main() {
    vec2 ndc = (gl_FragCoord.xy / uRes) * 2.0 - 1.0;
    vec3 rd = normalize(uFwd + ndc.x * uA * uTan * uRight + ndc.y * uTan * uUp);
    vec3 ro = uCam;
    float tf = rd.y < -1e-4 ? -ro.y / rd.y : 1e9;
    float tt = traceType(ro, rd, min(tf, 80.0));
    vec3 col = vec3(0.0);
    if (tt > 0.0) {
      vec3 p = ro + rd * tt, n = typeN(p);
      vec3 toL = vec3(uLight.xy, uLightZ) - p; float dl = length(toL);
      col = vec3(max(dot(n, toL / dl), 0.0) * uI * 0.9 / (1.0 + 0.12 * dl * dl));
    } else if (tf < 1e8 && (ro + rd * tf).z > uLightZ) {          // the floor, up to the light; past it the ray sees the glow instead
      vec3 p = ro + rd * tf;
      // the light on the floor: from the nearest point of the rectangle, shadowed by the type
      vec3 lp = vec3(clamp(p.x, uLight.x - uLight.z, uLight.x + uLight.z), clamp(p.y + 0.5, uLight.y - uLight.w, uLight.y + uLight.w), uLightZ);
      vec3 ld = lp - p; float dl = length(ld); ld /= dl;
      float res = 1.0, t = 0.04;
      for (int i = 0; i < 28; i++) { float h = typeD(p + ld * t + vec3(0.0, 0.01, 0.0)); res = min(res, 7.0 * h / t); t += clamp(h, 0.04, 0.5); if (res < 0.001 || t > dl) break; }
      res = clamp(res, 0.0, 1.0);
      float diff = max(ld.y, 0.0) * uI * 2.6 / (1.0 + 0.09 * dl * dl) * res;
      vec3 rr = vec3(rd.x, -rd.y, rd.z);
      float cosT = clamp(-rd.y, 0.0, 1.0);
      float F = mix(0.10, 1.0, pow(1.0 - cosT, 4.0)) * uGloss;
      vec3 refl = sky(p + vec3(0.0, 0.002, 0.0), rr);
      col = vec3(diff * 0.55) + refl * F * 0.85;
      col *= 1.0 - smoothstep(14.0, 40.0, tf);
    } else {
      col = sky(ro, rd);
    }
    col = col / (1.0 + col);
    col = pow(col, vec3(0.9));
    col += (hash(gl_FragCoord.xy) - 0.5) / 255.0 * (uI > 0.001 ? 1.0 : 0.0);
    o = vec4(vec3(col.r), 1.0);
  }`;
  const VS = `#version 300 es
  void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
  const prog = compile(gl, VS, FS);
  gl.bindVertexArray(gl.createVertexArray());

  // ---------- the light and the camera ----------
  let lx = 0, ly = P.lightY, tx = 0, ty = P.lightY, power = 0, awake = false, powerTarget = 0;
  const aim = (q) => {                                                    // the light follows the pointer; moving it at all wakes it
    awake = true; powerTarget = 1;
    tx = (q.u * 2 - 1) * P.range;
    ty = P.lightY - (q.v * 2 - 1) * 0.7;
  };
  offs.push(ctx.on('move', aim), ctx.on('down', aim));

  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const FOV = 0.62;                                                       // vertical, radians

  // ---------- settings ----------
  const R = (key, label, min, max, step) => ({ key, label, min, max, step });
  const tune = {
    title: 'Backlight',
    values: P, defaults: DEFAULTS,
    groups: [
      { name: 'Light', items: [R('power', 'Brightness', 0.2, 2.5, 0.05), R('lightW', 'Width', 0.4, 4, 0.05), R('lightH', 'Height', 0.4, 4, 0.05), R('lightY', 'Height above floor', 0.3, 3.5, 0.05), R('lightZ', 'Distance behind the type', -6, -1.2, 0.05), R('glow', 'Glow', 0, 2.5, 0.05), R('range', 'Travel', 1, 6, 0.1), R('follow', 'Follow speed', 1, 14, 0.5)] },
      { name: 'Scene', items: [R('depth', 'Letter thickness', 0.05, 1.2, 0.01), R('gloss', 'Floor reflection', 0, 1.5, 0.02), R('orbit', 'Camera sway', 0, 0.5, 0.01)] },
    ],
    set(key, value) { P[key] = value; },
    reset() { Object.assign(P, DEFAULTS); },
  };

  // ---------- frame ----------
  offs.push(ctx.frame((dt) => {
    const k = ctx.reduced ? 1 : 1 - Math.exp(-dt * P.follow);
    lx += (tx - lx) * k; ly += (ty - ly) * k;
    power += (powerTarget - power) * (ctx.reduced ? 1 : 1 - Math.exp(-dt * 2.2));

    const W = ctx.pw, H = ctx.ph, A = W / H;
    const tanH = Math.tan(FOV / 2);
    const dist = Math.max((typeS[1] * 1.9) / (2 * tanH), (typeS[0] * 1.3) / (2 * tanH * A));
    const yaw = -ctx.look.x * P.orbit, pitch = 0.10 + ctx.look.y * P.orbit * 0.4;
    const target = [0, typeC[1] * 0.55, 0];
    const cam = [target[0] + Math.sin(yaw) * Math.cos(pitch) * dist, target[1] + Math.sin(pitch) * dist, target[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
    const fwd = norm([target[0] - cam[0], target[1] - cam[1], target[2] - cam[2]]);
    const right = norm(cross(fwd, [0, 1, 0])), up = cross(right, fwd);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    prog.use(); const u = prog.u;
    gl.uniform2f(u.uRes, W, H);
    gl.uniform3fv(u.uCam, cam); gl.uniform3fv(u.uFwd, fwd); gl.uniform3fv(u.uRight, right); gl.uniform3fv(u.uUp, up);
    gl.uniform1f(u.uA, A); gl.uniform1f(u.uTan, tanH);
    gl.uniform2f(u.uTypeC, typeC[0], typeC[1]); gl.uniform2f(u.uTypeS, typeS[0], typeS[1]);
    gl.uniform1f(u.uDepth, P.depth);
    gl.uniform1f(u.uI, power * P.power); gl.uniform1f(u.uGlow, P.glow); gl.uniform1f(u.uGloss, P.gloss);
    gl.uniform4f(u.uLight, lx, ly, P.lightW, P.lightH); gl.uniform1f(u.uLightZ, P.lightZ);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sdfTex); gl.uniform1i(u.uSDF, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }));

  return {
    tune,
    debug: { light: () => ({ lx, ly, power, awake }), aim: (u, v) => aim({ u, v }) },
    destroy() { offs.forEach((off) => off()); if (sdfTex) gl.deleteTexture(sdfTex); },
  };
}
