// Skyline: flat white type that is projected onto a field of hard-edged blocks of different heights.
//
// Head-on, the camera is exactly where the projector is, so the print lands as perfectly flat, crisp
// "Idan Segev" however the blocks stand. Move the cursor, drag a finger or tilt the phone and the print stays
// where the projector put it while the blocks move under it: the lettering is cut at every edge and jumps from
// one height to the next. Touch the poster and the blocks near your finger are thrown up and tumble, land on
// each other, and the print keeps landing on whatever is in front of it, floor included.
//
// Under the graphic: a few dozen real rigid bodies (cannon-es, MIT, vendored) standing on a floor, drawn as one
// instanced WebGL2 draw. The type is a mask that every surface looks up through the projector, per pixel.

import * as CANNON from '../vendor/cannon-es.js';
import { getGL, compile, texture, uploadCanvas, typeMask, clamp } from '../engine.js';

const FOV = 0.7, D = 5, TAN = Math.tan(FOV / 2);
const MAX_INST = 400;

const VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec3 iPos;
layout(location=3) in vec4 iQuat;
layout(location=4) in vec3 iHalf;
uniform mat4 uVP;
out vec3 vW;
out vec3 vN;
vec3 rot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
void main() {
  vec3 p = rot(iQuat, aPos * iHalf) + iPos;
  vW = p;
  vN = rot(iQuat, aNrm);
  gl_Position = uVP * vec4(p, 1.0);
}`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D uType;
uniform float uReveal, uD, uTan, uAspect;
in vec3 vW;
in vec3 vN;
out vec4 o;
void main() {
  vec2 ndc = (vW.xy / (uD - vW.z)) / vec2(uTan * uAspect, uTan);     // where the projector, at the resting camera, puts this point
  float ink = texture(uType, ndc * 0.5 + 0.5).r;
  vec3 n = normalize(vN);
  vec3 L = normalize(vec3(-0.5, 0.6, 0.62));
  float d = max(dot(n, L), 0.0) / L.z;                              // 1 on a top face, less on the sides
  float lit = clamp(1.0 + 1.5 * (d - 1.0), 0.06, 1.0);
  o = vec4(vec3(ink * mix(1.0, lit, uReveal)), 1.0);
}`;

function cubeMesh() {
  const v = [], idx = [];
  const faces = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (const n of faces) {
    const u = Math.abs(n[0]) ? [0, 1, 0] : [1, 0, 0], w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    const base = v.length / 6;
    for (const [s, t] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) v.push(n[0] + u[0] * s + w[0] * t, n[1] + u[1] * s + w[1] * t, n[2] + u[2] * s + w[2] * t, n[0], n[1], n[2]);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { v: new Float32Array(v), i: new Uint16Array(idx) };
}
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
  const gl = getGL(canvas, { depth: true });
  if (!gl) throw new Error('webgl2 unavailable');
  const offs = [];
  const P = { yaw: 0.5, pitch: 0.34, kick: 1, gravity: 14, block: 0.7 };

  // ---------- GL ----------
  const prog = compile(gl, VS, FS);
  const cube = cubeMesh();
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, cube.v, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cube.i, gl.STATIC_DRAW);
  const inst = new Float32Array(MAX_INST * 10), instBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instBuf); gl.bufferData(gl.ARRAY_BUFFER, inst.byteLength, gl.DYNAMIC_DRAW);
  [[2, 3, 0], [3, 4, 12], [4, 3, 28]].forEach(([loc, size, off]) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 40, off); gl.vertexAttribDivisor(loc, 1); });
  gl.bindVertexArray(null);
  let typeTex = null;

  // ---------- the world ----------
  let W = 1, H = 1, Wc = 6, Hc = 3.6, world = null, blocks = [], touch = null, acc = 0, activity = 0, camX = 0, camY = 0, reveal = 0;
  const MAT = new CANNON.Material('block');

  function hashNoise(i, j, seed) { const s = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); }
  function valueNoise(x, y, seed) {                                   // smooth, so heights come in neighbourhoods, then stepped
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    const a = hashNoise(xi, yi, seed), b = hashNoise(xi + 1, yi, seed), c = hashNoise(xi, yi + 1, seed), d = hashNoise(xi + 1, yi + 1, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }

  function build() {
    W = ctx.W; H = ctx.H;
    Hc = 2 * D * TAN; Wc = Hc * W / H;
    world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, -P.gravity) });
    world.allowSleep = true;
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.solver.iterations = 10;
    world.addContactMaterial(new CANNON.ContactMaterial(MAT, MAT, { friction: 0.5, restitution: 0.18 }));
    const floor = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: MAT }); world.addBody(floor);
    const Ws = Wc * 1.3, Hs = Hc * 1.3;
    const wall = (pos, n) => { const b = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: MAT }); b.quaternion.setFromVectors(new CANNON.Vec3(0, 0, 1), new CANNON.Vec3(...n)); b.position.set(...pos); world.addBody(b); };
    wall([-Ws / 2, 0, 0], [1, 0, 0]); wall([Ws / 2, 0, 0], [-1, 0, 0]); wall([0, -Hs / 2, 0], [0, 1, 0]); wall([0, Hs / 2, 0], [0, -1, 0]);

    blocks = [];
    const s = P.block * clamp(Wc / 5, 0.6, 1), cols = Math.ceil(Ws / s), rows = Math.ceil(Hs / s), seed = ctx.rand() * 100;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = -Ws / 2 + (i + 0.5) * Ws / cols, y = -Hs / 2 + (j + 0.5) * Hs / rows;
      const n = valueNoise(i * 0.55, j * 0.55, seed) * 0.7 + hashNoise(i, j, seed) * 0.3;
      const h = 0.12 + Math.round(n * 7) * 0.2;                          // stepped: heights come in whole steps
      const hx = Ws / cols / 2 - 0.012, hy = Hs / rows / 2 - 0.012;
      const body = new CANNON.Body({ mass: hx * hy * h * 8 * 1.4, material: MAT, position: new CANNON.Vec3(x, y, h / 2), allowSleep: true, sleepSpeedLimit: 0.12, sleepTimeLimit: 0.5, linearDamping: 0.05, angularDamping: 0.1 });
      body.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, h / 2)));
      body.half = [hx, hy, h / 2];
      world.addBody(body); blocks.push(body); body.sleep();
    }
    // the print: the type is drawn in screen space and looked up through the projector
    if (typeTex) gl.deleteTexture(typeTex);
    typeTex = texture(gl, { w: 1, h: 1, filter: gl.LINEAR });
    uploadCanvas(gl, typeTex, typeMask(Math.round(W * ctx.dpr), Math.round(H * ctx.dpr), { lines: ['Idan', 'Segev'], mode: 'justify', pad: 0.06, valign: 'middle', bottomReserve: Math.round(96 * ctx.dpr), gap: 0.12 }), { mipmap: true });
  }

  // ---------- touch ----------
  const toWorld = (q) => [(q.x - W / 2) / (W / 2) * (Wc / 2), -(q.y - H / 2) / (H / 2) * (Hc / 2)];
  function kick(x, y) {                                                // thrown up from below, harder the nearer the touch
    const R = 1.5;
    for (const b of blocks) {
      const dx = b.position.x - x, dy = b.position.y - y, d = Math.hypot(dx, dy); if (d > R) continue;
      const f = 1 - d / R; b.wakeUp();
      b.applyImpulse(new CANNON.Vec3(dx / (d || 1) * 2.2 * f * P.kick * b.mass, dy / (d || 1) * 2.2 * f * P.kick * b.mass, (3.2 + Math.random() * 2) * f * P.kick * b.mass), new CANNON.Vec3((Math.random() - 0.5) * b.half[0], (Math.random() - 0.5) * b.half[1], -b.half[2] * 0.6));
    }
  }
  offs.push(ctx.on('down', (q) => { const [x, y] = toWorld(q); touch = { x, y, px: x, py: y }; kick(x, y); }));
  offs.push(ctx.on('move', (q) => { if (touch) { const [x, y] = toWorld(q); touch.x = x; touch.y = y; } }));
  offs.push(ctx.on('up', () => { touch = null; }));

  offs.push(ctx.on('resize', () => build()));
  build();

  const qa = new CANNON.Quaternion(), vv = new CANNON.Vec3();
  offs.push(ctx.frame((dt) => {
    acc = Math.min(acc + dt, 0.05);
    while (acc >= 1 / 90) {
      acc -= 1 / 90;
      if (touch) {                                                     // a finger dragged across pushes the blocks it passes
        const vx = touch.x - touch.px, vy = touch.y - touch.py; touch.px = touch.x; touch.py = touch.y;
        if (vx || vy) for (const b of blocks) {
          const dx = b.position.x - touch.x, dy = b.position.y - touch.y, d = Math.hypot(dx, dy); if (d > 1.1) continue;
          b.wakeUp(); const f = (1 - d / 1.1) * b.mass * 14; b.applyImpulse(new CANNON.Vec3(vx * f, vy * f, 0.4 * f * Math.hypot(vx, vy)), new CANNON.Vec3(0, 0, b.half[2] * 0.5));
        }
      }
      world.step(1 / 90);
    }
    let act = 0; for (const b of blocks) if (b.sleepState !== CANNON.Body.SLEEPING) act += b.velocity.length() * 0.06 + b.angularVelocity.length() * 0.02;
    activity += (clamp(act, 0, 1) - activity) * (1 - Math.exp(-dt * 6));

    const k = 1 - Math.exp(-dt * 9);
    camX += (ctx.look.x * P.yaw - camX) * k; camY += (ctx.look.y * P.pitch - camY) * k;
    reveal = Math.max(clamp(Math.hypot(camX, camY) / 0.18, 0, 1), activity);

    let n = 0;
    for (const b of blocks) {
      const o = n * 10;
      inst[o] = b.position.x; inst[o + 1] = b.position.y; inst[o + 2] = b.position.z;
      inst[o + 3] = b.quaternion.x; inst[o + 4] = b.quaternion.y; inst[o + 5] = b.quaternion.z; inst[o + 6] = b.quaternion.w;
      inst[o + 7] = b.half[0]; inst[o + 8] = b.half[1]; inst[o + 9] = b.half[2];
      n++;
    }
    const fl = n * 10;                                                  // the floor, a thin slab under everything
    inst[fl] = 0; inst[fl + 1] = 0; inst[fl + 2] = -0.02; inst[fl + 3] = 0; inst[fl + 4] = 0; inst[fl + 5] = 0; inst[fl + 6] = 1; inst[fl + 7] = Wc * 1.6; inst[fl + 8] = Hc * 1.6; inst[fl + 9] = 0.02;
    n++;

    const yaw = camX, pitch = -camY;
    const eye = [D * Math.sin(yaw) * Math.cos(pitch), D * Math.sin(pitch), D * Math.cos(yaw) * Math.cos(pitch)];
    const vp = mul(perspective(FOV, W / H, 0.5, 40), lookAt(eye, [0, 0, 0], [0, 1, 0]));
    gl.viewport(0, 0, ctx.pw, ctx.ph);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.CULL_FACE);
    prog.use();
    gl.uniformMatrix4fv(prog.u.uVP, false, vp);
    gl.uniform1f(prog.u.uD, D); gl.uniform1f(prog.u.uTan, TAN); gl.uniform1f(prog.u.uAspect, W / H); gl.uniform1f(prog.u.uReveal, reveal);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, typeTex); gl.uniform1i(prog.u.uType, 0);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst, 0, n * 10);
    gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, n);
    gl.bindVertexArray(null);
  }));

  const reform = () => build();
  return {
    tune: {
      title: 'Skyline',
      values: { ...P }, defaults: { ...P },
      groups: [
        { name: 'View', items: [{ key: 'yaw', label: 'Camera sideways', min: 0, max: 0.9, step: 0.02 }, { key: 'pitch', label: 'Camera up and down', min: 0, max: 0.7, step: 0.02 }] },
        { name: 'Blocks', items: [{ key: 'block', label: 'Block size (re-form)', min: 0.4, max: 1.4, step: 0.05 }, { key: 'kick', label: 'Poke strength', min: 0.3, max: 3, step: 0.05 }, { key: 'gravity', label: 'Gravity', min: 4, max: 40, step: 1 }] },
      ],
      actions: { 'Re-form': reform },
      set(k, val) { P[k] = val; this.values[k] = val; if (k === 'gravity') world.gravity.set(0, 0, -val); },
      reset() { Object.assign(P, this.defaults); Object.assign(this.values, this.defaults); world.gravity.set(0, 0, -P.gravity); },
    },
    debug: { blocks: () => blocks, world: () => world, kick, activity: () => activity, reveal: () => reveal },
    destroy() { offs.forEach((f) => f()); try { if (typeTex) gl.deleteTexture(typeTex); } catch (e) { /* ignore */ } },
  };
}
