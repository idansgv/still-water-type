// Point of view. The type only reads from one place, and that place is different every time.
//
// Under the flat graphic: tens of thousands of points, each placed at a random depth along the sight
// line from one secret viewpoint to its spot in the lettering. From there they line up into solid type
// (an anamorphosis). From anywhere else, the poster is a cloud with real parallax. Move with the cursor,
// a dragging finger, or the tilt of a phone, and the cloud pulls itself into the word when you are close.

import { getGL, compile, texture, uploadCanvas, typeMask, coverage, VS_TRI, smoothstep, clamp } from '../engine.js';

const CAM_Z = 4;

export function mount(ctx) {
  const { canvas } = ctx;
  const gl = getGL(canvas, { depth: true });
  if (!gl) throw new Error('webgl2 unavailable');
  ctx.adaptive = true;
  const offs = [];
  const rand = ctx.rand;

  // ---------- shaders ----------
  const PT_VS = `#version 300 es
  precision highp float;
  in vec3 aPos;      // where the point really is
  in vec2 aTgt;      // where it sits on the poster
  in float aNear;    // 0 far .. 1 near
  uniform vec2 uCam;       // camera position (x, y)
  uniform vec2 uSweet;     // the secret viewpoint (x, y)
  uniform float uA;
  uniform float uSnap;
  uniform float uSize;
  out float vNear;
  out float vId;
  void main() {
    vec3 P = mix(aPos, vec3(aTgt, 0.0), uSnap);
    vec2 p = (P.xy - uCam) / (${CAM_Z.toFixed(1)} - P.z);
    vec2 ndc = (p + uSweet / ${CAM_Z.toFixed(1)}) * ${CAM_Z.toFixed(1)} / vec2(uA, 1.0);
    gl_Position = vec4(ndc, clamp(-P.z * 0.1, -0.95, 0.95), 1.0);
    gl_PointSize = uSize * (1.0 + 0.28 * (aNear - 0.5) * (1.0 - uSnap));
    vNear = aNear;
    vId = fract(sin(float(gl_VertexID) * 12.9898) * 43758.5453);
  }`;
  const PT_FS = `#version 300 es
  precision highp float;
  in float vNear;
  in float vId;
  uniform vec3 uBg, uFg;
  uniform float uSnap;
  out vec4 o;
  void main() {
    if (vId < smoothstep(0.78, 1.0, uSnap)) discard;   // once locked, the crisp type takes over
    float b = mix(0.32, 1.0, vNear);
    b = mix(b, 1.0, uSnap);
    o = vec4(mix(uBg, uFg, b), 1.0);
  }`;
  const MASK_FS = `#version 300 es
  precision highp float;
  in vec2 uv;
  uniform sampler2D uMask;
  uniform float uSolid;
  uniform vec3 uBg, uFg;
  out vec4 o;
  void main() { o = vec4(mix(uBg, uFg, smoothstep(0.42, 0.58, texture(uMask, uv).r) * uSolid), 1.0); }`;

  const pts = compile(gl, PT_VS, PT_FS);
  const maskP = compile(gl, VS_TRI, MASK_FS);
  const maskTex = texture(gl, { w: 1, h: 1 });

  // ---------- the secret viewpoint ----------
  // somewhere in look space, never dead centre, so the first glance is always a cloud
  const ang = rand() * Math.PI * 2;
  const rad = 0.38 + rand() * 0.3;
  const sweetLook = { x: Math.cos(ang) * rad, y: Math.sin(ang) * rad * 0.75 };
  let range = { x: 0.5, y: 0.42 };
  const sweetCam = { x: 0, y: 0 };

  // ---------- points ----------
  let vao = null, buf = null, count = 0, A = 1;
  function rebuild() {
    A = ctx.pw / ctx.ph;
    const chrome = document.querySelector('.chrome');
    const k = ctx.pw / ctx.W;
    const reserve = (((chrome && chrome.offsetHeight) || 56) + 24) * k;
    const mask = typeMask(ctx.pw, ctx.ph, { lines: ['POINT', 'OF', 'VIEW'], mode: 'fit', valign: 'center', gap: 0.14, pad: 0.07, bottomReserve: reserve });
    uploadCanvas(gl, maskTex, mask);

    // sample points from the lit pixels of a small copy of the mask
    const sw = 420, sh = Math.max(1, Math.round(sw * ctx.ph / ctx.pw));
    const sc = document.createElement('canvas'); sc.width = sw; sc.height = sh;
    const sg = sc.getContext('2d'); sg.drawImage(mask, 0, 0, sw, sh);
    const d = sg.getImageData(0, 0, sw, sh).data;
    const lit = [];
    for (let i = 0; i < d.length; i += 4) if (d[i] > 128) lit.push(i >> 2);

    const sizeCss = ctx.W < 600 ? 3.4 : 4.2;
    const litArea = coverage(mask) * ctx.W * ctx.H;
    count = Math.round(clamp((litArea / (sizeCss * sizeCss)) * 1.3, 6000, ctx.W < 600 ? 26000 : 40000));
    const data = new Float32Array(count * 6);
    const cx0 = sweetCam.x, cy0 = sweetCam.y;
    for (let i = 0; i < count; i++) {
      const idx = lit[(rand() * lit.length) | 0];
      const px = (idx % sw) + rand(), py = ((idx / sw) | 0) + rand();
      const tx = (px / sw * 2 - 1) * A, ty = 1 - (py / sh) * 2;
      const zn = rand();                                  // 0 far .. 1 near
      const z = -1.5 + zn * 2.7;
      const lam = (CAM_Z - z) / CAM_Z;
      const o = i * 6;
      data[o] = cx0 + lam * (tx - cx0);
      data[o + 1] = cy0 + lam * (ty - cy0);
      data[o + 2] = z;
      data[o + 3] = tx; data[o + 4] = ty;
      data[o + 5] = zn;
    }
    if (!vao) vao = gl.createVertexArray();
    if (buf) gl.deleteBuffer(buf);
    buf = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const bind = (name, size, off) => {
      const loc = gl.getAttribLocation(pts.p, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 24, off);
    };
    bind('aPos', 3, 0); bind('aTgt', 2, 12); bind('aNear', 1, 20);
    gl.bindVertexArray(null);
    rebuild.sizePx = sizeCss * k;
  }
  function setRange() {
    A = ctx.pw / ctx.ph;
    range = { x: 0.55 * clamp(A, 0.5, 1.2), y: 0.42 };
    sweetCam.x = sweetLook.x * range.x; sweetCam.y = sweetLook.y * range.y;
  }
  setRange();
  offs.push(ctx.on('resize', () => { setRange(); rebuild(); }));
  rebuild();

  // ---------- frame ----------
  const cam = { x: 0, y: 0 };
  let snap = 0, wasLocked = false;
  offs.push(ctx.frame((dt, t) => {
    // a slow sweep at the start, so the cloud shows that it moves
    const sweep = ctx.reduced ? 0 : 0.34 * Math.sin(t * 2.6) * Math.exp(-t * 0.9);
    const lx = ctx.look.x, ly = ctx.look.y;
    cam.x = (lx + sweep) * range.x; cam.y = (ly + sweep * 0.5) * range.y;
    const dist = Math.hypot(lx - sweetLook.x, ly - sweetLook.y);
    const target = smoothstep(0.26, 0.06, dist);
    snap += (target - snap) * Math.min(1, dt * (target > snap ? 9 : 5));
    const locked = snap > 0.92;
    if (locked && !wasLocked && navigator.vibrate) { try { navigator.vibrate(10); } catch (e) { /* ignore */ } }
    wasLocked = locked;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, ctx.pw, ctx.ph);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(...ctx.colors.bg, 1); gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // the solid word fades in as the cloud locks on
    maskP.use();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, maskTex); gl.uniform1i(maskP.u.uMask, 0);
    gl.uniform1f(maskP.u.uSolid, snap * snap);
    gl.uniform3f(maskP.u.uBg, ...ctx.colors.bg); gl.uniform3f(maskP.u.uFg, ...ctx.colors.fg);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
    pts.use(); const u = pts.u;
    gl.uniform2f(u.uCam, cam.x, cam.y);
    gl.uniform2f(u.uSweet, sweetCam.x, sweetCam.y);
    gl.uniform1f(u.uA, A);
    gl.uniform1f(u.uSnap, snap);
    gl.uniform1f(u.uSize, rebuild.sizePx);
    gl.uniform3f(u.uBg, ...ctx.colors.bg); gl.uniform3f(u.uFg, ...ctx.colors.fg);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.POINTS, 0, count);
    gl.bindVertexArray(null);
  }));

  return {
    debug: { sweetLook, get snap() { return snap; } },
    destroy() { offs.forEach((off) => off()); },
  };
}
