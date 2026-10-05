// Columns, the shared core for two posters. The name looks like plain flat type. It is standing columns, solid
// blocks cut from the letter shapes, seen straight down through an orthographic camera, so the tops are all you
// can see. Touch them and the camera has been looking at a real rigid-body world the whole time.
//
//   Collapse  (collapse.js)  the columns are free bodies. Tap one and it is knocked over, and falls on its
//                            neighbours. Drag one and it is pulled by a spring from the point you grabbed it.
//   Explode   (explode.js)   the columns are anchored. Tap one and it blows into triangular slabs. Slabs that hit
//                            another letter hard enough set that one off too, a little weaker each time.
//
// The physics is Rapier (Apache-2.0, WASM, vendored in src/vendor) through the small wrapper in physics.js. The letters are the same skeletons Soft type uses,
// thickened into overlapping boxes. World units: a letter is 2 high.

import { loadRapier, Sim } from './physics.js';
import { perspective, ortho, lookAt, mul, invert, transformPoint } from './lib3d.js';
import { SKELETON, ratio } from './lettering.js';
import { compile } from '../engine.js';
import { shatterBox } from './shatter.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const qmul = (a, b) => ({ x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y, y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x, z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w, w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z });
const qrot = (q, v) => {
  const tx = 2 * (q.y * v.z - q.z * v.y), ty = 2 * (q.z * v.x - q.x * v.z), tz = 2 * (q.x * v.y - q.y * v.x);
  return { x: v.x + q.w * tx + (q.y * tz - q.z * ty), y: v.y + q.w * ty + (q.z * tx - q.x * tz), z: v.z + q.w * tz + (q.x * ty - q.y * tx) };
};
const UNIT_H = 2.0;            // letter height in world units
const COL_H = 3.4;             // column height
const MAX_INST = 4000;
const MAX_SHARDS = 2500, MAX_SHARD_VERTS = 400000;

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec3 iPos;
layout(location=3) in vec4 iQuat;
layout(location=4) in vec3 iHalf;
layout(location=5) in float iDmg;
uniform mat4 uVP;
out vec3 vN;
out float vTop;
out float vDmg;
vec3 rot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
void main() {
  vec3 p = rot(iQuat, aPos * iHalf) + iPos;
  vN = rot(iQuat, aNrm);
  vTop = aNrm.z > 0.9 ? 1.0 : 0.0;     // the face the letter is cut into, whichever way the column lies
  vDmg = iDmg;
  gl_Position = uVP * vec4(p, 1.0);
}`;
// the pieces of a shattered letter: free-form meshes, each vertex tagged with its piece, placed from a transform texture
const VS_SHARD = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in float aShard;
uniform sampler2D uXf;
uniform mat4 uVP;
out vec3 vN;
out float vTop;
out float vDmg;
vec3 rot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
void main() {
  int i = int(aShard + 0.5);
  vec4 a = texelFetch(uXf, ivec2(i * 2, 0), 0), q = texelFetch(uXf, ivec2(i * 2 + 1, 0), 0);
  vec3 p = rot(q, aPos) + a.xyz;
  vN = rot(q, aNrm);
  vTop = aNrm.z > 0.99 ? 1.0 : 0.0;
  vDmg = 0.0;
  gl_Position = uVP * vec4(p, 1.0);
}`;
const FS = `#version 300 es
precision highp float;
in vec3 vN;
in float vTop;
in float vDmg;
uniform float uFade;
uniform float uFg;
uniform float uBg;
out vec4 o;
void main() {
  vec3 n = normalize(vN);
  float lit = clamp(dot(n.xy, vec2(-0.6, 0.8)), 0.0, 1.0);
  float c = vTop > 0.5 ? (0.5 + 0.5 * clamp(n.z, 0.0, 1.0)) * (1.0 - 0.5 * vDmg) : 0.1 + 0.22 * clamp(n.z, 0.0, 1.0) + 0.3 * lit;
  c = clamp(c, 0.0, 1.0);
  o = vec4(vec3(mix(uBg, mix(uBg, uFg, c), uFade)), 1.0);
}`;

function cubeMesh() {
  const v = [], idx = [];
  const faces = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (const n of faces) {
    const a = Math.abs(n[0]) ? [0, 1, 0] : [1, 0, 0], u = a, w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    const base = v.length / 6;
    for (const [s, t] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      v.push(n[0] + u[0] * s + w[0] * t, n[1] + u[1] * s + w[1] * t, n[2] + u[2] * s + w[2] * t, n[0], n[1], n[2]);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { v: new Float32Array(v), i: new Uint16Array(idx) };
}

export async function mountColumns(stage, mode) {
  const EXPLODE = mode === 'explode';
  const R = await loadRapier();
  const canvas = stage.canvas;
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL2 unavailable');

  const prog = compile(gl, VS, FS);
  const cube = cubeMesh();
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, cube.v, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cube.i, gl.STATIC_DRAW);
  const inst = new Float32Array(MAX_INST * 11), instBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instBuf); gl.bufferData(gl.ARRAY_BUFFER, inst.byteLength, gl.DYNAMIC_DRAW);
  [[2, 3, 0], [3, 4, 12], [4, 3, 28], [5, 1, 40]].forEach(([loc, size, off]) => {
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 44, off); gl.vertexAttribDivisor(loc, 1);
  });
  gl.bindVertexArray(null);

  // the pieces (Explode): one growing vertex buffer of free-form meshes, placed each frame from a float texture
  const progS = compile(gl, VS_SHARD, FS);
  const vaoS = gl.createVertexArray(); gl.bindVertexArray(vaoS);
  const shardBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, shardBuf); gl.bufferData(gl.ARRAY_BUFFER, MAX_SHARD_VERTS * 28, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 28, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 24);
  gl.bindVertexArray(null);
  const xfTex = gl.createTexture(), xf = new Float32Array(MAX_SHARDS * 8);
  gl.bindTexture(gl.TEXTURE_2D, xfTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, MAX_SHARDS * 2, 1, 0, gl.RGBA, gl.FLOAT, xf);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  let shardCount = 0, shardVerts = 0;

  // a 2D layer on top for the burst lines
  const overlay = document.createElement('canvas');
  overlay.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  overlay.setAttribute('aria-hidden', 'true');
  stage.root.appendChild(overlay);
  const octx = overlay.getContext('2d');

  const P = EXPLODE ? { gravity: 40, blast: 0.4, speed: 0.3, lift: 0, spin: 0, chain: 20, decay: 0.2, size: 0.4, rough: 1, gap: 0.8, crack: 2.9, crackAt: 0.25, jitter: 1, reach: 3, passive: 1, transfer: 0.7, bounce: 0.05, friction: 0.98, lines: 0, shake: 0, bg: 1, fg: 0, camPitch: 0, camYaw: 0, zoom: 1, persp: 0 } : { gravity: 12, topple: 26, bg: 0, fg: 1, camPitch: 0, camYaw: 0, zoom: 1, persp: 0 };   // Explode's defaults are Idan's tuned values (5 Oct 2026)
  const DT = EXPLODE ? 1 / 90 : 1 / 120;
  let pending = [], timers = [];
  let W = 1, H = 1, S = 100, sim = null, solids = [], letters = [], bursts = [], shake = 0, fade = 1;
  let press = null, pid = null, lastEmptyTap = 0, acc = 0;
  stage.setBackdrop(P.bg);

  // ---------- layout (pixels), same composition as Soft type ----------
  function layoutPx() {
    const portrait = W / H < 0.85;
    const rows = portrait ? ['IDAN', 'SE', 'GEV'] : ['IDAN', 'SEGEV'];
    const padX = Math.max(14, W * 0.045), top = Math.max(18, H * 0.04), bottom = 96;
    const availW = W - 2 * padX, availH = H - top - bottom, gap = 0.12;
    const advance = (c, h) => h * (0.6 * SKELETON[c].wf + 2 * ratio(c, SKELETON[c].wf * h, h) / h + gap);
    let h = Infinity;
    for (const row of rows) h = Math.min(h, availW / [...row].reduce((s, c) => s + advance(c, 1), 0));
    const rowGap = 0.02;
    h = Math.min(h, availH / (rows.length * (1.02 + rowGap)));
    const total = rows.length * h * 1.02 + (rows.length - 1) * h * rowGap;
    let y = top + (availH - total) / 2 + h * 0.51;
    const out = [];
    for (const row of rows) {
      const rowW = [...row].reduce((s, c) => s + advance(c, h), 0);
      let x = (W - rowW) / 2;
      for (const c of row) { const a = advance(c, h); out.push({ ch: c, x: x + a / 2, y, w: SKELETON[c].wf * h, h }); x += a; }
      y += h * (1.02 + rowGap);
    }
    return out;
  }
  const toWorld = (px, py) => [(px - W / 2) / S, -(py - H / 2) / S];
  // ---------- camera ----------
  // Straight down and orthographic by default, so the type reads flat. The camera settings are for setting up and
  // previewing: tilt and turn orbit the centre of the page, zoom scales, and perspective eases from orthographic to a real lens.
  let VP = null, invVP = null;
  function camera() {
    const hh = H / 2 / S / P.zoom, hw = W / 2 / S / P.zoom, pitch = P.camPitch, yaw = P.camYaw;
    const dist = 60, eye = [dist * Math.sin(yaw) * Math.cos(pitch), dist * Math.sin(pitch), dist * Math.cos(yaw) * Math.cos(pitch)];
    const view = lookAt(eye, [0, 0, 0], [0, 1, 0]);
    let proj;
    if (P.persp < 0.01) proj = ortho(hw, hh, 5, 200);
    else {                                                            // a closer camera for more perspective, with the page the same size at the centre
      const d = 60 - P.persp * 50;
      const v2 = lookAt([d * Math.sin(yaw) * Math.cos(pitch), d * Math.sin(pitch), d * Math.cos(yaw) * Math.cos(pitch)], [0, 0, 0], [0, 1, 0]);
      VP = mul(perspective(2 * Math.atan(hh / d), W / H, 1, 300), v2); invVP = invert(VP); return;
    }
    VP = mul(proj, view); invVP = invert(VP);
  }
  /** pixels -> a ray in the world: { o, d } */
  function screenRay(px, py) {
    const nx = (px / W) * 2 - 1, ny = 1 - (py / H) * 2;
    const a = transformPoint(invVP, nx, ny, -1), b = transformPoint(invVP, nx, ny, 1), dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l = Math.hypot(dx, dy, dz) || 1;
    return { o: a, d: [dx / l, dy / l, dz / l] };
  }
  /** where the pixel's ray crosses the plane z = h */
  function planePoint(px, py, h) {
    const r = screenRay(px, py), t = Math.abs(r.d[2]) < 1e-6 ? 0 : (h - r.o[2]) / r.d[2];
    return [r.o[0] + r.d[0] * t, r.o[1] + r.d[1] * t];
  }
  const toPx = (x, y, z = 0) => { const p = transformPoint(VP, x, y, z); return [(p[0] * 0.5 + 0.5) * W, (0.5 - p[1] * 0.5) * H]; };

  // ---------- world ----------
  function newWorld() {
    const w = new Sim(R, P.gravity);
    w.setSolver(EXPLODE ? 6 : 8);
    // the floor grips, so a push makes a column tip instead of slide; letters are slippery against each other
    // (friction takes the larger of two surfaces, restitution the smaller)
    const floor = w.fixed({ x: 0, y: 0, z: -0.5 }); floor.isWall = true;
    w.box(floor, [200, 200, 0.5], { friction: 1, restitution: 0.04 });
    // low walls round the edge keep pieces and sliding bodies in, but a tall column can still lean out over them
    const wall = (x, y, hx, hy) => { const b = w.fixed({ x, y, z: 0.9 }); b.isWall = true; w.box(b, [hx, hy, 0.9], { friction: 1, restitution: 0.04 }); };
    const ex = W / 2 / S, ey = H / 2 / S, floorY = -(H / 2 - (W < 720 ? 80 : 72)) / S, big = 40;
    wall(-ex - big, 0, big, big); wall(ex + big, 0, big, big);
    wall(0, ey - 0.15 + big, big, big); wall(0, floorY - big, big, big);
    w.mat = { friction: EXPLODE ? P.friction : 0.18, restitution: EXPLODE ? P.bounce : 0.55 };
    return w;
  }

  // The letter as boxes in the letter's own frame (world units). Where two strokes meet a box is lengthened just
  // enough to fill the mitre, and stroke ends are squared off. `coarse` samples curves about every half unit
  // instead of finely: that is what the slabs are cut from.
  function strokeBoxes(p, coarse) {
    const w = p.w, h = p.h, t = 2 * ratio(p.ch, w, h), boxes = [];
    for (const st of SKELETON[p.ch].s()) {
      let pts = st.pts.map((q) => [q.x * w, -q.y * h]);               // pixels, y up
      if (coarse && !st.sharp) {
        const keep = [pts[0]]; let acc = 0;
        for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (acc >= 0.55 * S || i === pts.length - 1) { keep.push(pts[i]); acc = 0; } }
        pts = keep;
      }
      const dirs = [];
      for (let i = 1; i < pts.length; i++) { const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1], l = Math.hypot(dx, dy); dirs.push(l < 0.5 ? null : [dx / l, dy / l, l]); }
      const ext = (a, b) => {
        if (!a || !b) return t / 2;
        const turn = Math.acos(clamp(a[0] * b[0] + a[1] * b[1], -1, 1));
        return Math.min(0.36 * t, (t / 2) * Math.tan(turn / 2)) + t * 0.02;
      };
      dirs.forEach((d, i) => {
        if (!d) return;
        const e0 = i === 0 ? t / 2 : ext(dirs[i - 1], d), e1 = i === dirs.length - 1 ? t / 2 : ext(d, dirs[i + 1]);
        const len = d[2] + e0 + e1, shift = (e1 - e0) / 2;
        const mx = (pts[i][0] + pts[i + 1][0]) / 2 + d[0] * shift, my = (pts[i][1] + pts[i + 1][1]) / 2 + d[1] * shift;
        boxes.push({ x: mx / S, y: my / S, a: Math.atan2(d[1], d[0]), hx: len / 2 / S, hy: t / 2 / S });
      });
    }
    return boxes;
  }

  function addLetter(p) {
    const fine = strokeBoxes(p, false), boxes = EXPLODE ? strokeBoxes(p, true) : fine;   // Explode: the physics uses fewer, longer boxes
    let vol = 0; for (const b of boxes) vol += 8 * b.hx * b.hy * (COL_H / 2);
    const [wx, wy] = toWorld(p.x, p.y), pos = { x: wx, y: wy, z: COL_H / 2 };
    const body = EXPLODE ? sim.fixed(pos) : sim.dynamic(pos, { linearDamping: 0.04, angularDamping: 0.06 });
    const colliders = boxes.map((b) => sim.box(body, [b.hx, b.hy, COL_H / 2], { offset: { x: b.x, y: b.y, z: 0 }, angle: b.a, density: EXPLODE ? undefined : 3 / vol, events: EXPLODE }));
    body.isLetter = true; body.ch = p.ch; body.vol = vol;
    if (EXPLODE) {
      body.cells = boxes.map((b, i) => ({ ...b, alive: true, dmg: 0, collider: colliders[i] }));
      for (const f of fine) {                                       // each smooth box belongs to the nearest physics box
        let best = Infinity;
        for (const c of body.cells) {
          const cs = Math.cos(c.a), sn = Math.sin(c.a), dx = f.x - c.x, dy = f.y - c.y, lx = dx * cs + dy * sn, ly = -dx * sn + dy * cs;
          const d = Math.hypot(Math.max(Math.abs(lx) - c.hx, 0), Math.max(Math.abs(ly) - c.hy, 0));
          if (d < best) { best = d; f.cell = c; }
        }
      }
      body.drawn = fine;
    }
    solids.push(body); letters.push(body);
    if (!EXPLODE) body.sleep();
  }

  function build() {
    sim = newWorld(); solids = []; letters = []; pending = []; press = null; pid = null; shardCount = 0; shardVerts = 0;
    S = 1; // placeholder so the layout can be measured in pixels
    const poses = layoutPx();
    S = poses[0].h / UNIT_H;
    camera();
    for (const p of poses) addLetter(p);
    fade = 0;
  }

  // ---------- interaction ----------
  const wake = (b) => b.wake();
  function pick(q) {
    const r = screenRay(q.x, q.y), hit = sim.cast({ x: r.o[0], y: r.o[1], z: r.o[2] }, { x: r.d[0], y: r.d[1], z: r.d[2] }, 400);
    return hit && !hit.body.isWall ? { body: hit.body, point: hit.point } : null;
  }

  // A tap is a firm knock at the top, away from where you touched. Every letter weighs the same, so a falling one
  // can carry the next.
  function topple(body, point) {
    wake(body);
    let dx = body.position.x - point.x, dy = body.position.y - point.y, d = Math.hypot(dx, dy);
    if (d < 0.08) { const a = Math.random() * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a); d = 1; }
    dx /= d; dy /= d;
    const J = body.mass * P.topple;
    body.impulseAt({ x: dx * J, y: dy * J, z: 0 }, point);
  }

  // ---------- Explode ----------
  // Pieces: every box a letter is made of is shattered into irregular convex pieces (see shatter.js), each a rigid body
  // and a free-form mesh. `power` scales how hard they are thrown; `gen` counts how far along a chain they are.
  function spawnPieces(letter, cells, cx, cy, power, gen, kin, opt) {
    const sp0 = Math.sqrt(power), made = [], size = P.size * (1 + shardCount / 1400);   // the more rubble already, the coarser the next pieces
    for (const c of cells) {
      const ca = Math.cos(c.a), sa = Math.sin(c.a), parts = shatterBox(c.hx, c.hy, COL_H / 2, size, P.rough, opt && opt.fit ? opt.fit : P.gap, 140);
      for (const pc of parts) {
        if (shardCount >= MAX_SHARDS || shardVerts + pc.tris.length / 6 > MAX_SHARD_VERTS) break;
        const px = letter.position.x + c.x + ca * pc.c[0] - sa * pc.c[1], py = letter.position.y + c.y + sa * pc.c[0] + ca * pc.c[1], pz = letter.position.z + pc.c[2];
        const jit = opt && opt.jitter;
        const sb = sim.dynamic({ x: px, y: py, z: pz }, jit ? { angle: c.a, linearDamping: 7, angularDamping: 7, lockTilt: true } : { angle: c.a, linearDamping: 0.05, angularDamping: 0.1 });   // cracked pieces can only slide and turn a little, so the letter stays standing
        let ok = null;
        if (size < 0.2) {                                          // the tiniest pieces collide as boxes: cheaper, and nobody can tell
          let mx = 0, my = 0, mz = 0; for (const v of pc.verts) { mx = Math.max(mx, Math.abs(v[0])); my = Math.max(my, Math.abs(v[1])); mz = Math.max(mz, Math.abs(v[2])); }
          ok = sim.box(sb, [Math.max(0.02, mx * 0.82), Math.max(0.02, my * 0.82), Math.max(0.02, mz * 0.82)], { density: 0.6 });
        } else {
          ok = sim.hull(sb, Float32Array.from(pc.verts.flat()), { density: 0.6 });
        }
        if (!ok) { sim.remove(sb); continue; }
        if (opt && opt.jitter) {                                      // cracked in place: a small shove and twist, so the pieces end up slightly out of line
          const j = P.jitter, dd = kin ? Math.exp(-((Math.hypot(px - kin.x, py - kin.y) / 1.4) ** 2)) : 0;
          sb.setVelocity((Math.random() - 0.5) * 0.9 * j + (kin ? kin.vx * 0.06 * dd : 0), (Math.random() - 0.5) * 0.9 * j + (kin ? kin.vy * 0.06 * dd : 0), Math.random() * 0.5 * j);
          sb.setSpin((Math.random() - 0.5) * 1.6 * j, (Math.random() - 0.5) * 1.6 * j, (Math.random() - 0.5) * 2.2 * j);
        } else if (kin) {                                                    // breaking apart: no power of its own, only what the blow hands it
          const d = Math.hypot(px - kin.x, py - kin.y), w = Math.exp(-((d / 1.2) ** 2)) * P.transfer;
          sb.setVelocity(kin.vx * w + (Math.random() - 0.5) * 0.5, kin.vy * w + (Math.random() - 0.5) * 0.5, kin.vz * w + Math.random() * 0.4);
          sb.setSpin((Math.random() - 0.5) * 2 * w, (Math.random() - 0.5) * 2 * w, (Math.random() - 0.5) * 2 * w);
        } else {
          let dx = px - cx, dy = py - cy; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
          const sp = (3.5 + Math.random() * 6) * sp0 * P.speed, spinAmt = 14 * P.spin;
          sb.setVelocity(dx * sp + (Math.random() - 0.5) * 2, dy * sp + (Math.random() - 0.5) * 2, (2 + Math.random() * 5) * sp0 * P.lift);
          sb.setSpin((Math.random() - 0.5) * spinAmt, (Math.random() - 0.5) * spinAmt, (Math.random() - 0.5) * spinAmt);
        }
        sb.isShard = true; sb.gen = gen; sb.sidx = shardCount;
        // the mesh joins the shared buffer, tagged with its index
        const n = pc.tris.length / 6, buf = new Float32Array(n * 7);
        for (let k = 0; k < n; k++) { buf.set(pc.tris.subarray(k * 6, k * 6 + 6), k * 7); buf[k * 7 + 6] = shardCount; }
        gl.bindBuffer(gl.ARRAY_BUFFER, shardBuf); gl.bufferSubData(gl.ARRAY_BUFFER, shardVerts * 28, buf);
        shardVerts += n; shardCount++;
        made.push(sb);
      }
    }
    for (const sb of made) solids.push(sb);
    return made;
  }

  function burstLines(cx, cy, power) {
    if (!P.lines) return;
    const [bx, by] = toPx(cx, cy), size = S * UNIT_H * (0.6 + 0.4 * power), lines = [], N = 16;
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2 + (Math.random() - 0.5) * 0.3, long = i % 2 === 0;
      const s0 = size * (0.5 + Math.random() * 0.15), e0 = s0 + size * (long ? 0.7 + Math.random() * 0.6 : 0.28 + Math.random() * 0.2);
      lines.push({ a, s0, e0, bend: (Math.random() - 0.5) * 0.35, w: long ? 7 + Math.random() * 2.5 : 5 });
    }
    bursts.push({ x: bx, y: by, t: 0, lines });
  }

  // A letter blows apart, thrown from (cx, cy). Letters that are only nearby are cracked rather than destroyed.
  // gen 0 is the letter that was touched: it bursts. A letter that was struck (gen 1 and up) breaks apart if `passive` is
  // on: its pieces start still and only move with the momentum of whatever hit it.
  function detonate(letter, cx, cy, gen, vel) {
    if (letter.blown) return;
    letter.blown = true; letter.detonated = true;
    const power = P.blast * Math.pow(P.decay, gen), passive = P.passive && gen > 0 && vel;
    spawnPieces(letter, letter.cells, cx, cy, power, gen, passive ? { x: cx, y: cy, vx: vel[0], vy: vel[1], vz: vel[2] } : undefined);
    sim.remove(letter);
    solids.splice(solids.indexOf(letter), 1); letters.splice(letters.indexOf(letter), 1);
    if (!passive) burstLines(cx, cy, power);
    if (P.shake) shake = Math.max(shake, passive ? 0.1 : 0.3 * Math.min(1, power + 0.3));
    if (P.crack > 0) {                                              // the blast cracks the nearest columns: whole chunks of them fall away
      const R = P.reach;                                             // how far the shock cracks things, whatever the blast power
      for (const L of letters.slice()) {
        if (L.blown) continue;
        for (const c of L.cells.slice()) {
          const d = Math.hypot(L.position.x + c.x - cx, L.position.y + c.y - cy), f = Math.max(0, 1 - d / R) ** 1.1;
          if (f > 0) { const px = L.position.x + c.x, py = L.position.y + c.y, dd = Math.hypot(px - cx, py - cy) || 1, sp = 4.5 * f * P.speed; hurt(L, c, f ** 1.6 * (0.4 + 0.6 * Math.min(1, power)) * 1.25 * P.crack, cx, cy, [(px - cx) / dd * sp, (py - cy) / dd * sp, 1.2 * f * P.lift]); }
        }
      }
    }
  }

  // Damage accumulates in a column's boxes (their smooth tops darken as it does). Two thresholds:
  //   crackAt  the box cracks in place: it turns into pieces that are shoved and twisted a little, so the letter stays
  //            standing but with slightly offset slabs and dark seams (the "jitter" setting is how far)
  //   1        the box breaks off: its pieces carry the momentum of what hit it and the rest of the letter stands with a hole
  function hurt(letter, cell, amount, sx, sy, vel) {
    if (!cell.alive || letter.blown) return;
    cell.dmg += amount;
    const away = cell.dmg >= 1;
    if (!away && !(P.jitter > 0 && cell.dmg >= P.crackAt)) return;
    cell.alive = false;
    const k = letter.cells.indexOf(cell); if (k < 0) return;
    letter.cells.splice(k, 1); sim.removeCollider(letter, cell.collider);
    const kin = vel ? { x: sx, y: sy, vx: vel[0], vy: vel[1], vz: vel[2] } : undefined;
    if (away) spawnPieces(letter, [cell], sx, sy, 0.55, 3, P.passive ? kin : undefined);
    else spawnPieces(letter, [cell], sx, sy, 0.1, 3, kin, { jitter: true, fit: Math.max(P.gap, 0.93) });
    if (P.shake) shake = Math.max(shake, away ? 0.12 : 0.05);
    if (!letter.cells.length && away) { sim.remove(letter); solids.splice(solids.indexOf(letter), 1); letters.splice(letters.indexOf(letter), 1); letter.blown = true; }
  }

  // A piece that hits another letter hard sets the whole letter off; a lesser hit only damages the box it struck.
  // (Rapier reports that two things touched, not how hard, so the speed is the piece's own, just before the step.)
  function onHit(a, b) {
    const sb = a.isShard ? a : b.isShard ? b : null, o = sb === a ? b : a;
    if (!sb || !o.isLetter || o.blown) return;
    const v = Math.hypot(sb.pv.x, sb.pv.y, sb.pv.z) * 0.85, vel = [sb.pv.x, sb.pv.y, sb.pv.z];
    if (v > P.chain) { if (!o.detonated) { o.detonated = true; pending.push({ letter: o, x: sb.position.x, y: sb.position.y, gen: sb.gen + 1, vel }); } return; }
    if (P.crack > 0 && v > 4.5) {
      let best = null, bd = Infinity;                               // the box nearest to where the piece landed
      for (const c of o.cells) {
        const cs = Math.cos(c.a), sn = Math.sin(c.a), dx = sb.position.x - o.position.x - c.x, dy = sb.position.y - o.position.y - c.y;
        const lx = dx * cs + dy * sn, ly = -dx * sn + dy * cs, d = Math.hypot(Math.max(Math.abs(lx) - c.hx, 0), Math.max(Math.abs(ly) - c.hy, 0));
        if (d < bd) { bd = d; best = c; }
      }
      if (best) pending.push({ hurt: true, letter: o, cell: best, amount: ((v - 4.5) / Math.max(1, P.chain - 4.5)) * 0.55 * P.crack, x: sb.position.x, y: sb.position.y, vel });
    }
  }

  const offs = [];
  offs.push(stage.on('down', (q, e) => {
    if (pid !== null) return;
    pid = e.pointerId;
    const hit = pick(q);
    if (!hit || !hit.body.isLetter) {
      pid = null;
      const now = performance.now();
      if (now - lastEmptyTap < 380) { build(); resize2(); } lastEmptyTap = now;   // a double tap on empty space re-forms the letters
      return;
    }
    if (EXPLODE) { detonate(hit.body, hit.point.x, hit.point.y, 0); pid = null; return; }   // a tap sets it off at once
    wake(hit.body);
    press = { body: hit.body, local: hit.body.toLocal(hit.point), point: hit.point, x: q.x, y: q.y, t: 0, mode: 'pending', tx: q.x, ty: q.y };
  }));
  offs.push(stage.on('move', (q, e) => {
    if (pid !== null && e.pointerId !== pid) return;
    if (!press) { if (q.type === 'mouse') { const h = pick(q); stage.root.style.cursor = h && h.body.isLetter ? (EXPLODE ? 'pointer' : 'grab') : ''; } return; }
    press.tx = q.x; press.ty = q.y;
    if (press.mode !== 'drag' && Math.hypot(q.x - press.x, q.y - press.y) > 8) press.mode = 'drag';
  }));
  offs.push(stage.on('up', (q, e) => {
    if (e.pointerId !== pid) return;
    if (press && press.mode === 'pending' && press.t < 0.22) topple(press.body, press.point);
    press = null; pid = null;
  }));

  function interact(dt) {                                         // Collapse only
    if (!press || !press.body.world) { if (press && !press.body.world) press = null; return; }
    const b = press.body;
    press.t += dt;
    if (press.mode === 'pending' && press.t > 0.22) press.mode = 'hold';
    if (press.mode === 'drag') {                                    // a spring from the grabbed point to the finger
      wake(b);
      const wp = b.toWorld(press.local), [tx, ty] = planePoint(press.tx, press.ty, wp.z);
      const v = b.velocity, m = b.mass, k = 70 * m, c = 7 * m;
      const fx = clamp((tx - wp.x) * k - v.x * c, -60 * m, 60 * m), fy = clamp((ty - wp.y) * k - v.y * c, -60 * m, 60 * m);
      b.impulseAt({ x: fx * dt, y: fy * dt, z: 0 }, wp);              // a force, as an impulse for this step
    }
  }

  // ---------- drawing ----------
  function draw() {
    camera(); const vp = VP;
    let n = 0;
    for (const b of solids) {
      if (b.isShard) continue;
      if (b.drawn) {                                                  // an anchored letter is drawn smooth, from its fine boxes
        for (const f of b.drawn) {
          if (n >= MAX_INST) break;
          if (!f.cell.alive) continue;                               // that part has broken off
          const o = n * 11, a = f.a / 2;
          inst[o] = b.position.x + f.x; inst[o + 1] = b.position.y + f.y; inst[o + 2] = b.position.z;
          inst[o + 3] = 0; inst[o + 4] = 0; inst[o + 5] = Math.sin(a); inst[o + 6] = Math.cos(a);
          inst[o + 7] = f.hx; inst[o + 8] = f.hy; inst[o + 9] = COL_H / 2; inst[o + 10] = Math.min(0.9, f.cell.dmg);
          n++;
        }
        continue;
      }
      for (let i = 0; i < b.shapes.length && n < MAX_INST; i++) {
        const sh = b.shapes[i];
        const qa = qmul(b.quaternion, b.shapeOrientations[i]), vv = qrot(b.quaternion, b.shapeOffsets[i]);
        const o = n * 11;
        inst[o] = b.position.x + vv.x; inst[o + 1] = b.position.y + vv.y; inst[o + 2] = b.position.z + vv.z;
        inst[o + 3] = qa.x; inst[o + 4] = qa.y; inst[o + 5] = qa.z; inst[o + 6] = qa.w;
        inst[o + 7] = sh.halfExtents.x; inst[o + 8] = sh.halfExtents.y; inst[o + 9] = sh.halfExtents.z; inst[o + 10] = 0;
        n++;
      }
    }
    if (shardCount) {
      for (const b of solids) if (b.isShard) { const o = b.sidx * 8, q = b.quaternion; xf[o] = b.position.x; xf[o + 1] = b.position.y; xf[o + 2] = b.position.z; xf[o + 4] = q.x; xf[o + 5] = q.y; xf[o + 6] = q.z; xf[o + 7] = q.w; }
      gl.bindTexture(gl.TEXTURE_2D, xfTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, shardCount * 2, 1, gl.RGBA, gl.FLOAT, xf);
    }
    gl.viewport(0, 0, stage.pw, stage.ph);
    gl.clearColor(P.bg, P.bg, P.bg, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.CULL_FACE);
    if (n) {
      prog.use();
      gl.uniformMatrix4fv(prog.u.uVP, false, vp);
      gl.uniform1f(prog.u.uFade, fade); gl.uniform1f(prog.u.uFg, P.fg); gl.uniform1f(prog.u.uBg, P.bg);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, instBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst, 0, n * 11);
      gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, n);
    }
    if (shardCount) {
      progS.use();
      gl.uniformMatrix4fv(progS.u.uVP, false, vp);
      gl.uniform1f(progS.u.uFade, fade); gl.uniform1f(progS.u.uFg, P.fg); gl.uniform1f(progS.u.uBg, P.bg);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, xfTex); gl.uniform1i(progS.u.uXf, 0);
      gl.bindVertexArray(vaoS);
      gl.drawArrays(gl.TRIANGLES, 0, shardVerts);
    }
    gl.bindVertexArray(null);

    // burst lines
    octx.setTransform(stage.pw / W, 0, 0, stage.ph / H, 0, 0);
    octx.clearRect(0, 0, W, H);
    const fgv = Math.round(P.fg * 255); octx.strokeStyle = `rgb(${fgv},${fgv},${fgv})`; octx.lineCap = 'round';
    const ease = (u) => 1 - (1 - clamp(u, 0, 1)) ** 3;
    for (const b of bursts) for (const l of b.lines) {
      const head = l.s0 + (l.e0 - l.s0) * ease(b.t / 0.32), tail = l.s0 + (l.e0 - l.s0) * ease((b.t - 0.1) / 0.42);
      if (tail >= head - 0.5) continue;
      const c = Math.cos(l.a), sn = Math.sin(l.a), mid = (head + tail) / 2, off = l.bend * (head - tail);
      octx.lineWidth = l.w * (1 - clamp((b.t - 0.3) / 0.4, 0, 0.6));
      octx.beginPath(); octx.moveTo(b.x + c * tail, b.y + sn * tail);
      octx.quadraticCurveTo(b.x + c * mid - sn * off, b.y + sn * mid + c * off, b.x + c * head, b.y + sn * head); octx.stroke();
    }
  }

  function resize2() { overlay.width = stage.pw; overlay.height = stage.ph; }
  function resize() { W = stage.W; H = stage.H; build(); resize2(); }
  offs.push(stage.on('resize', resize));
  resize();

  offs.push(stage.frame((dt) => {
    acc = Math.min(acc + dt, 0.05);
    while (acc >= DT) {
      acc -= DT;
      if (!EXPLODE) interact(DT);
      sim.step(DT, EXPLODE ? onHit : null);
      if (pending.length) { const list = pending; pending = []; for (const p of list) { if (p.hurt) hurt(p.letter, p.cell, p.amount, p.x, p.y, p.vel); else detonate(p.letter, p.x, p.y, p.gen, p.vel); } }
    }
    if (timers.length) { for (const q of timers) { q.t -= dt; if (q.t <= 0 && q.l.world) { detonate(q.l, q.l.position.x, q.l.position.y, 0); q.done = true; } } timers = timers.filter((q) => !q.done); }
    for (const b of bursts) b.t += dt;
    bursts = bursts.filter((b) => b.t < 0.8);
    fade = Math.min(1, fade + dt * 2.2);
    if (shake > 0) { shake = Math.max(0, shake - dt); const a = shake / 0.4 * 9; canvas.style.transform = shake ? `translate(${(Math.random() - 0.5) * a}px, ${(Math.random() - 0.5) * a}px)` : ''; if (!shake) canvas.style.transform = ''; }
    draw();
  }));

  const reform = () => { timers = []; build(); resize2(); };
  const detonateAll = () => { timers = letters.map((l, i) => ({ l, t: i * 0.11 })); };   // one after another, left to right
  const cameraGroup = { name: 'Camera (for setting up)', items: [{ key: 'camPitch', label: 'Tilt', min: 0, max: 1.3, step: 0.01 }, { key: 'camYaw', label: 'Turn', min: -1.6, max: 1.6, step: 0.01 }, { key: 'zoom', label: 'Zoom', min: 0.4, max: 2.5, step: 0.02 }, { key: 'persp', label: 'Perspective (0 = flat)', min: 0, max: 1, step: 0.01 }] };
  const colourGroup = { name: 'Colour (black and white only)', items: [{ key: 'bg', label: 'Background', min: 0, max: 1, step: 0.01 }, { key: 'fg', label: 'Foreground', min: 0, max: 1, step: 0.01 }] };
  const groups = EXPLODE
    ? [{ name: 'World', items: [{ key: 'gravity', label: 'Gravity', min: 4, max: 40, step: 1 }, { key: 'bounce', label: 'Bounce (contacts)', min: 0.05, max: 0.95, step: 0.05 }, { key: 'friction', label: 'Slipperiness (low = grippy)', min: 0.02, max: 1, step: 0.02 }] },
       { name: 'Blast', items: [{ key: 'blast', label: 'Power', min: 0.4, max: 2.5, step: 0.05 }, { key: 'speed', label: 'Outward speed', min: 0.3, max: 2.5, step: 0.05 }, { key: 'lift', label: 'Lift', min: 0, max: 3, step: 0.1 }, { key: 'spin', label: 'Spin', min: 0, max: 3, step: 0.1 }] },
       { name: 'Chain and cracks', items: [{ key: 'chain', label: 'Impact that sets a letter off', min: 2, max: 20, step: 0.5 }, { key: 'decay', label: 'Strength kept per step', min: 0.2, max: 1, step: 0.02 }, { key: 'crack', label: 'Cracking (0 = a letter is whole or gone)', min: 0, max: 3, step: 0.05 }, { key: 'reach', label: 'Crack reach', min: 1, max: 9, step: 0.25 }, { key: 'crackAt', label: 'Damage that starts a crack', min: 0.05, max: 1, step: 0.01 }, { key: 'jitter', label: 'Jitter (0 = boxes only break away)', min: 0, max: 3, step: 0.05 }, { key: 'passive', label: 'Struck letters break apart (no burst of their own)', type: 'toggle' }, { key: 'transfer', label: 'Momentum passed to them', min: 0.2, max: 2, step: 0.05 }] },
       { name: 'Pieces (next blast)', items: [{ key: 'size', label: 'Size (small = many)', min: 0.1, max: 1.6, step: 0.02 }, { key: 'rough', label: 'Irregularity', min: 0, max: 2, step: 0.05 }, { key: 'gap', label: 'Fit (1 = no gaps)', min: 0.8, max: 1, step: 0.01 }] },
       { name: 'Effects', items: [{ key: 'lines', label: 'Burst lines', type: 'toggle' }, { key: 'shake', label: 'Screen shake', type: 'toggle' }] },
       colourGroup, cameraGroup]
    : [{ name: 'World', items: [{ key: 'gravity', label: 'Gravity', min: 4, max: 40, step: 1 }] },
       { name: 'Touch', items: [{ key: 'topple', label: 'Tap push', min: 6, max: 50, step: 1 }] },
       colourGroup, cameraGroup];
  const tuneApi = {
    title: EXPLODE ? 'Explode' : 'Collapse',
    values: { ...P }, defaults: { ...P }, groups,
    actions: Object.assign(EXPLODE ? { 'Re-form': reform, 'Detonate all': detonateAll } : { 'Re-form': reform }, {
      'Reset camera': () => { for (const k of ['camPitch', 'camYaw', 'persp']) tuneApi.set(k, 0); tuneApi.set('zoom', 1); },
    }),
    set(k, v) {
      P[k] = v; this.values[k] = v;
      if (k === 'gravity') sim.setGravity(v);
      if (k === 'bg') stage.setBackdrop(v);
      if (EXPLODE && (k === 'bounce' || k === 'friction')) sim.setMaterial(P.friction, P.bounce);
    },
    reset() { Object.assign(P, this.defaults); Object.assign(this.values, this.defaults); sim.setGravity(P.gravity); stage.setBackdrop(P.bg); },
  };
  return {
    tune: tuneApi,
    debug: { world: () => sim, letters: () => letters, solids: () => solids, topple, detonate, S: () => S, pick, pending: () => pending },
    destroy() {
      offs.forEach((f) => f());
      overlay.remove(); canvas.style.transform = ''; stage.root.style.cursor = '';
      stage.setBackdrop(null);
    },
  };
}
