// Drape: flat white type that is projected onto a cloth stretched over hidden balls.
//
// Head-on, the camera is exactly where the projector is, so however lumpy the cloth is the print lands as a
// perfectly flat, crisp "Idan Segev" and the black gives nothing away. Move the cursor, drag a finger or tilt
// the phone and the print stays where the projector put it while the cloth moves under it: the lettering slides
// over the lumps and the balls underneath are revealed. Touch near one and it is kicked up through the cloth,
// rolls on, and bumps the others.
//
// Under the graphic: a height field (a membrane: a damped wave equation pinned at the edge, so it is stretched
// like a drum skin) with a handful of spheres under it. Each sphere is a small rigid body of its own on a hidden
// floor: it can jump, fall back, roll and collide. Wherever a sphere pushes through, the cloth is held up by it.
// The cloth is drawn from a grid laid out in the vertex shader (no vertex buffer), the height field is a float
// texture, and the type is a mask looked up through the projector.

import { getGL, compile, texture, uploadCanvas, typeMask, clamp } from '../engine.js';

const FOV = 0.7, D = 5;                       // vertical field of view, camera and projector distance
const TAN = Math.tan(FOV / 2);

const VS = `#version 300 es
precision highp float;
uniform sampler2D uH;
uniform ivec2 uN;
uniform vec2 uHalf;
uniform mat4 uVP;
uniform float uD, uTan, uAspect;
out vec2 vUv;
out vec3 vN;
const vec2 CORNER[6] = vec2[6](vec2(0.0,0.0), vec2(1.0,0.0), vec2(0.0,1.0), vec2(1.0,0.0), vec2(1.0,1.0), vec2(0.0,1.0));
float H(ivec2 c) { return texelFetch(uH, clamp(c, ivec2(0), uN - 1), 0).r; }
void main() {
  int q = gl_VertexID / 6, k = gl_VertexID % 6;
  int cx = q % (uN.x - 1), cy = q / (uN.x - 1);
  ivec2 c = ivec2(cx, cy) + ivec2(CORNER[k]);
  float z = H(c);
  vec2 d = 2.0 * uHalf / vec2(uN - 1);
  vec2 xy = -uHalf + vec2(c) * d;
  float hx = H(c + ivec2(1, 0)) - H(c - ivec2(1, 0)), hy = H(c + ivec2(0, 1)) - H(c - ivec2(0, 1));
  vN = normalize(vec3(-hx / (2.0 * d.x), -hy / (2.0 * d.y), 1.0));
  vec3 p = vec3(xy, z);
  vec2 ndc = (p.xy / (uD - p.z)) / vec2(uTan * uAspect, uTan);      // where the projector (at the resting camera) puts this point
  vUv = ndc * 0.5 + 0.5;
  gl_Position = uVP * vec4(p, 1.0);
}`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D uType;
uniform float uReveal;
in vec2 vUv;
in vec3 vN;
out vec4 o;
void main() {
  float ink = texture(uType, vUv).r;
  vec3 n = normalize(vN);
  vec3 L = normalize(vec3(-0.45, 0.55, 0.7));
  float d = max(dot(n, L), 0.0) / L.z;                              // 1 on the flat, less on a slope facing away
  float lit = clamp(1.0 + 1.25 * (d - 1.0), 0.1, 1.0);
  o = vec4(vec3(ink * mix(1.0, lit, uReveal)), 1.0);
}`;

function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
function lookAt(e, t, up) {
  let zx = e[0] - t[0], zy = e[1] - t[1], zz = e[2] - t[2]; const zl = Math.hypot(zx, zy, zz); zx /= zl; zy /= zl; zz /= zl;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx; const xl = Math.hypot(xx, xy, xz); xx /= xl; xy /= xl; xz /= xl;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
}
function mul(a, b) {
  const o = new Float32Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; }
  return o;
}

export function mount(ctx) {
  const { canvas } = ctx;
  const gl = getGL(canvas, { depth: false });
  if (!gl) throw new Error('webgl2 unavailable');
  const offs = [];

  const P = { yaw: 0.34, pitch: 0.24, kick: 1, tension: 2.2, balls: 8 };
  const prog = compile(gl, VS, FS);
  const vao = gl.createVertexArray();
  const hTex = gl.createTexture();
  let typeTex = null;

  let W = 1, H = 1, Wc = 6, Hc = 3.6, Ws = 8, Hs = 5, dx = 0.045, Nx = 2, Ny = 2, z = null, v = null, balls = [], touch = null;
  let steps = 0, activity = 0, camX = 0, camY = 0, acc = 0, reveal = 0;

  // ---------- the balls ----------
  function layBalls() {
    const rnd = ctx.rand, n = Math.max(5, Math.round(P.balls * clamp(Wc * Hc / 23, 0.55, 1.2))), sc = clamp(Wc / 5, 0.5, 1);   // smaller balls on a narrow screen
    balls = [];
    let tries = 0;
    while (balls.length < n && tries++ < 400) {
      const r = (0.3 + rnd() * 0.26) * sc, x = (rnd() - 0.5) * (Wc - 1.1 * sc), y = (rnd() - 0.5) * (Hc - 1.1 * sc);
      if (balls.some((b) => Math.hypot(b.x - x, b.y - y) < b.r + r + 0.1 * sc)) continue;
      const top = 0.1 + rnd() * 0.32;                               // how far it pushes the cloth up at rest
      balls.push({ x, y, r, vx: 0, vy: 0, zc: top - r, z0: top - r, vz: 0 });
    }
  }

  // ---------- the cloth ----------
  function build() {
    W = ctx.W; H = ctx.H;
    Hc = 2 * D * TAN; Wc = Hc * W / H;
    Ws = Wc * 1.35; Hs = Hc * 1.35;
    dx = Math.max(0.045, Math.sqrt(Ws * Hs / 26000));
    Nx = Math.round(Ws / dx) + 1; Ny = Math.round(Hs / dx) + 1;
    z = new Float32Array(Nx * Ny); v = new Float32Array(Nx * Ny);
    gl.bindTexture(gl.TEXTURE_2D, hTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, Nx, Ny, 0, gl.RED, gl.FLOAT, z);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    layBalls();
    for (let i = 0; i < 260; i++) stepSim(1 / 120, true);          // let the cloth settle over the balls
    for (const b of balls) { b.vx = b.vy = b.vz = 0; b.zc = b.z0; }
    // the print: the type is drawn in screen space and looked up through the projector
    if (typeTex) gl.deleteTexture(typeTex);
    typeTex = texture(gl, { w: 1, h: 1, filter: gl.LINEAR });
    const mask = typeMask(Math.round(W * ctx.dpr), Math.round(H * ctx.dpr), { lines: ['Idan', 'Segev'], mode: 'justify', pad: 0.06, valign: 'middle', bottomReserve: Math.round(96 * ctx.dpr), gap: 0.12 });
    uploadCanvas(gl, typeTex, mask, { mipmap: true });
  }

  const pinned = (i, j) => i < 6 || j < 6 || i >= Nx - 6 || j >= Ny - 6;

  function stepSim(dt, settling) {
    const c2 = P.tension * P.tension / (dx * dx), eps = 1.4, gam = settling ? 3.2 : 0.9;
    for (let j = 1; j < Ny - 1; j++) {
      let idx = j * Nx + 1;
      for (let i = 1; i < Nx - 1; i++, idx++) {
        const lap = z[idx - 1] + z[idx + 1] + z[idx - Nx] + z[idx + Nx] - 4 * z[idx];
        v[idx] += (c2 * lap - eps * z[idx] - gam * v[idx]) * dt;
      }
    }
    for (let j = 1; j < Ny - 1; j++) {
      let idx = j * Nx + 1;
      for (let i = 1; i < Nx - 1; i++, idx++) z[idx] += v[idx] * dt;
    }
    for (let j = 0; j < Ny; j++) for (let i = 0; i < Nx; i++) if (pinned(i, j)) { z[j * Nx + i] = 0; v[j * Nx + i] = 0; }
    // wherever a ball reaches through the cloth, the cloth is held up by it
    for (const b of balls) {
      const bi = (b.x + Ws / 2) / dx, bj = (b.y + Hs / 2) / dx, rr = Math.ceil(b.r / dx) + 1;
      for (let j = Math.max(1, Math.floor(bj - rr)); j <= Math.min(Ny - 2, Math.ceil(bj + rr)); j++) {
        for (let i = Math.max(1, Math.floor(bi - rr)); i <= Math.min(Nx - 2, Math.ceil(bi + rr)); i++) {
          const ddx = (i - bi) * dx, ddy = (j - bj) * dx, d2 = ddx * ddx + ddy * ddy;
          if (d2 >= b.r * b.r) continue;
          const s = b.zc + Math.sqrt(b.r * b.r - d2), idx = j * Nx + i;
          if (z[idx] < s) { z[idx] = s; if (v[idx] < b.vz) v[idx] = b.vz; }
        }
      }
    }
  }

  function stepBalls(dt) {
    const lx = Wc / 2 - 0.15, ly = Hc / 2 - 0.15;
    for (const b of balls) {
      b.vz -= 14 * dt; b.zc += b.vz * dt;
      if (b.zc <= b.z0) { b.zc = b.z0; b.vz = b.vz < -1.5 ? -b.vz * 0.3 : 0; }
      if (touch) {                                                   // a finger sweeping under the cloth drags what it touches
        const dxp = touch.x - b.x, dyp = touch.y - b.y, d = Math.hypot(dxp, dyp), reach = b.r + 0.7;
        if (d < reach) { const f = (1 - d / reach) * 9 * dt; b.vx += dxp * f; b.vy += dyp * f; }
      }
      const damp = Math.exp(-0.7 * dt); b.vx *= damp; b.vy *= damp;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < -lx + b.r) { b.x = -lx + b.r; b.vx = Math.abs(b.vx) * 0.7; } else if (b.x > lx - b.r) { b.x = lx - b.r; b.vx = -Math.abs(b.vx) * 0.7; }
      if (b.y < -ly + b.r) { b.y = -ly + b.r; b.vy = Math.abs(b.vy) * 0.7; } else if (b.y > ly - b.r) { b.y = ly - b.r; b.vy = -Math.abs(b.vy) * 0.7; }
    }
    for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {   // balls bump each other
      const a = balls[i], c = balls[j], dxp = c.x - a.x, dyp = c.y - a.y, d = Math.hypot(dxp, dyp) || 1e-3, min = a.r + c.r;
      if (d >= min) continue;
      const nx = dxp / d, ny = dyp / d, over = (min - d) / 2;
      a.x -= nx * over; a.y -= ny * over; c.x += nx * over; c.y += ny * over;
      const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
      if (rv < 0) { const m1 = a.r * a.r, m2 = c.r * c.r, j2 = -(1.7) * rv / (1 / m1 + 1 / m2); a.vx -= nx * j2 / m1; a.vy -= ny * j2 / m1; c.vx += nx * j2 / m2; c.vy += ny * j2 / m2; }
    }
  }

  const toWorld = (q) => [(q.x - W / 2) / (W / 2) * (Wc / 2), -(q.y - H / 2) / (H / 2) * (Hc / 2)];
  function kick(x, y) {                                              // a poke from below: nearby balls jump and are shoved aside
    for (const b of balls) {
      const dxp = b.x - x, dyp = b.y - y, d = Math.hypot(dxp, dyp), reach = b.r + 1.5;
      if (d > reach) continue;
      const f = 1 - d / reach;
      b.vz = Math.max(b.vz, (2.6 + Math.random() * 1.4) * f * P.kick + 0.6);
      b.vx += (dxp / (d || 1)) * 1.6 * f * P.kick; b.vy += (dyp / (d || 1)) * 1.6 * f * P.kick;
    }
  }
  offs.push(ctx.on('down', (q) => { const [x, y] = toWorld(q); touch = { x, y }; kick(x, y); }));
  offs.push(ctx.on('move', (q) => { if (touch) { const [x, y] = toWorld(q); touch.x = x; touch.y = y; } }));
  offs.push(ctx.on('up', () => { touch = null; }));

  // ---------- frame ----------
  offs.push(ctx.on('resize', () => { build(); }));
  build();

  offs.push(ctx.frame((dt) => {
    acc = Math.min(acc + dt, 0.05);
    while (acc >= 1 / 120) {
      acc -= 1 / 120;
      stepBalls(1 / 120);
      stepSim(1 / 120, false);
    }
    // how disturbed the cloth is: the print gets its shading back while things are moving
    let act = 0; for (const b of balls) act += Math.abs(b.vz) * 0.25 + Math.hypot(b.vx, b.vy) * 0.12 + Math.abs(b.zc - b.z0) * 0.8;
    activity += (clamp(act * 0.45, 0, 1) - activity) * (1 - Math.exp(-dt * 6));

    const k = 1 - Math.exp(-dt * 9);
    camX += (ctx.look.x * P.yaw - camX) * k; camY += (ctx.look.y * P.pitch - camY) * k;
    reveal = Math.max(clamp(Math.hypot(camX, camY) / 0.2, 0, 1), activity);

    gl.bindTexture(gl.TEXTURE_2D, hTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, Nx, Ny, gl.RED, gl.FLOAT, z);

    const yaw = camX, pitch = -camY;
    const eye = [D * Math.sin(yaw) * Math.cos(pitch), D * Math.sin(pitch), D * Math.cos(yaw) * Math.cos(pitch)];
    const vp = mul(perspective(FOV, W / H, 0.5, 40), lookAt(eye, [0, 0, 0], [0, 1, 0]));

    gl.viewport(0, 0, ctx.pw, ctx.ph);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    prog.use();
    const u = prog.u;
    gl.uniform2i(u.uN, Nx, Ny); gl.uniform2f(u.uHalf, Ws / 2, Hs / 2);
    gl.uniformMatrix4fv(u.uVP, false, vp);
    gl.uniform1f(u.uD, D); gl.uniform1f(u.uTan, TAN); gl.uniform1f(u.uAspect, W / H);
    gl.uniform1f(u.uReveal, reveal);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, hTex); gl.uniform1i(u.uH, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, typeTex); gl.uniform1i(u.uType, 1);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6 * (Nx - 1) * (Ny - 1));
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
  }));

  const reroll = () => { build(); };
  return {
    tune: {
      title: 'Drape',
      values: { ...P }, defaults: { ...P },
      groups: [
        { name: 'View', items: [{ key: 'yaw', label: 'Camera sideways', min: 0, max: 0.8, step: 0.02 }, { key: 'pitch', label: 'Camera up and down', min: 0, max: 0.6, step: 0.02 }] },
        { name: 'Cloth', items: [{ key: 'tension', label: 'Tension', min: 0.8, max: 3.4, step: 0.1 }, { key: 'kick', label: 'Poke strength', min: 0.3, max: 2.5, step: 0.05 }] },
        { name: 'Balls', items: [{ key: 'balls', label: 'How many (re-roll)', min: 3, max: 14, step: 1 }] },
      ],
      actions: { 'Re-roll': reroll },
      set(k, val) { P[k] = val; this.values[k] = val; },
      reset() { Object.assign(P, this.defaults); Object.assign(this.values, this.defaults); },
    },
    debug: { balls: () => balls, z: () => z, grid: () => [Nx, Ny], activity: () => activity, reveal: () => reveal, kick },
    destroy() {
      offs.forEach((f) => f());
      try { gl.deleteTexture(hTex); if (typeTex) gl.deleteTexture(typeTex); } catch (e) { /* ignore */ }
    },
  };
}
