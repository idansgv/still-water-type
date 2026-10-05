// Dust: soft grey puffs kicked up where hard things hit, drawn as one instanced draw of camera-facing quads.
//
// The CPU only decides where and how many (from collision points and from the surface a letter occupied); the GPU does
// the rest. Each particle is born with a position, a velocity, a birth time, a life and a size; the vertex shader works
// out where it is at any moment (drag slows it, a little lift keeps it rising, it grows as it thins out) and fades it,
// so nothing is updated per frame on the CPU. A ring buffer holds the particles, oldest overwritten first.

import { compile } from '../engine.js';

const VS = `#version 300 es
layout(location=0) in vec2 aQ;
layout(location=1) in vec3 iP;
layout(location=2) in vec3 iV;
layout(location=3) in vec4 iM;      // birth time, life, size, seed
uniform mat4 uVP;
uniform vec2 uPx;                   // world units -> clip units at the middle of the page
uniform float uT, uWref;
out vec2 vQ;
out float vA;
out float vSeed;
void main() {
  float age = uT - iM.x, life = iM.y;
  if (age < 0.0 || age > life) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float u = age / life, k = 2.4;
  vec3 p = iP + iV * (1.0 - exp(-k * age)) / k;                  // thrown, then slowed by the air
  p.z += 0.35 * age * (1.0 - 0.5 * u);                            // and drifting up a little
  float size = iM.z * (0.55 + 1.7 * u);                           // it spreads as it thins
  vec4 c = uVP * vec4(p, 1.0);
  c.xy += aQ * size * uPx * (c.w / uWref);
  vQ = aQ; vSeed = iM.w;
  vA = pow(1.0 - u, 1.5) * smoothstep(0.0, 0.07, u);
  gl_Position = c;
}`;
const FS = `#version 300 es
precision highp float;
in vec2 vQ;
in float vA;
in float vSeed;
uniform vec3 uCol;
uniform float uAlpha, uSoft;
out vec4 o;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {                                                // value noise
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  float r = length(vQ);
  if (r > 1.0) discard;
  vec2 q = vQ * 2.2 + vSeed * 31.0;
  float wisp = 0.65 * vn(q) + 0.35 * vn(q * 2.3 + 7.0);              // a puff is ragged, not a disc
  float body = smoothstep(1.0, 0.0, r);
  float v = wisp * (0.55 + 0.9 * body);
  // softness 1: feathered smoke; softness 0: crisp-edged ink blots that still thin out with age
  float a = smoothstep(mix(0.44, 0.28, uSoft), mix(0.47, 0.8, uSoft), v) * mix(step(r, 0.97), body, uSoft);
  o = vec4(uCol, a * mix(step(0.001, vA) * (0.25 + 0.75 * vA), vA, uSoft) * uAlpha);
}`;

export class Dust {
  constructor(gl, max = 9000) {
    this.gl = gl; this.max = max; this.t = 0; this.head = 0; this.live = 0;
    this.prog = compile(gl, VS, FS);
    this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
    const q = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, q); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    this.data = new Float32Array(max * 10);
    this.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    [[1, 3, 0], [2, 3, 12], [3, 4, 24]].forEach(([loc, size, off]) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 40, off); gl.vertexAttribDivisor(loc, 1); });
    gl.bindVertexArray(null);
    this.lo = Infinity; this.hi = -1; this.wrapped = false;
  }
  clear() { this.data.fill(0); this.head = 0; this.live = 0; this.lo = 0; this.hi = this.max - 1; this.wrapped = true; }
  emit(x, y, z, vx, vy, vz, life, size) {
    const i = this.head, o = i * 10, d = this.data;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = vx; d[o + 4] = vy; d[o + 5] = vz;
    d[o + 6] = this.t; d[o + 7] = life; d[o + 8] = size; d[o + 9] = Math.random();
    if (i < this.lo) this.lo = i; if (i > this.hi) this.hi = i;
    this.head = (i + 1) % this.max; if (this.head === 0) this.wrapped = true;
    this.live = Math.min(this.max, this.live + 1);
  }
  /** a burst of `n` puffs at a point: thrown outward at up to `speed`, rising at up to `up` */
  puff(x, y, z, n, { speed = 1.2, up = 0.8, size = 0.4, life = 1.5, spread = 0.15 } = {}) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.2 + Math.random() * 0.8);
      this.emit(x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread, z + Math.random() * spread, Math.cos(a) * s, Math.sin(a) * s, up * Math.random(), life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8));
    }
  }
  tick(dt) { this.t += dt; }
  flush() {
    const gl = this.gl; if (this.hi < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    if (this.wrapped) { gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data); this.wrapped = false; }
    else gl.bufferSubData(gl.ARRAY_BUFFER, this.lo * 40, this.data, this.lo * 10, (this.hi - this.lo + 1) * 10);
    this.lo = Infinity; this.hi = -1;
  }
  draw(vp, px, wref, grey, alpha, soft = 0.6) {
    if (!this.live) return;
    const gl = this.gl, u = this.prog.u;
    this.flush();
    this.prog.use();
    gl.uniformMatrix4fv(u.uVP, false, vp); gl.uniform2f(u.uPx, px[0], px[1]); gl.uniform1f(u.uT, this.t); gl.uniform1f(u.uWref, wref);
    gl.uniform3f(u.uCol, grey, grey, grey); gl.uniform1f(u.uAlpha, alpha); gl.uniform1f(u.uSoft, soft);
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.max);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST);
  }
}
