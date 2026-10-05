// Columns: the name looks like plain flat type. It is standing columns, solid blocks cut from the letter shapes,
// seen straight down through an orthographic camera, so the tops are all you can see. Touch them and the camera
// has been looking at a real rigid-body world the whole time.
//
//   tap a letter    a push at the top, away from where you touched: it tips over, falls on its neighbours, and
//                   they fall on theirs
//   drag a letter   the letter is pulled toward your finger by a spring at the point you grabbed it
//   hold a letter   it starts to shudder, harder and harder, and then it bursts into shards; the blast knocks
//                   over whatever is near, and the shards collide with everything
//
// The physics is cannon-es (MIT, vendored in src/vendor). The letters are the same skeletons Soft type uses,
// thickened into overlapping boxes. World units: a letter is 2 high.

import * as CANNON from '../vendor/cannon-es.js';
import { SKELETON, ratio } from './lettering.js';
import { compile } from '../engine.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const UNIT_H = 2.0;            // letter height in world units
const COL_H = 3.4;             // column height
const MAX_INST = 4000;
const DT = 1 / 180;            // small steps: columns hit each other fast, and cannon's contacts are soft
const MAT = { floor: new CANNON.Material('floor'), letter: new CANNON.Material('letter') };

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec3 iPos;
layout(location=3) in vec4 iQuat;
layout(location=4) in vec3 iHalf;
uniform vec2 uView;
out vec3 vN;
out float vTop;
vec3 rot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
void main() {
  vec3 p = rot(iQuat, aPos * iHalf) + iPos;
  vN = rot(iQuat, aNrm);
  vTop = aNrm.z > 0.9 ? 1.0 : 0.0;     // the face the letter is cut into, whichever way the column lies
  gl_Position = vec4(p.x / uView.x, p.y / uView.y, -p.z / 40.0, 1.0);   // orthographic, looking straight down
}`;
const FS = `#version 300 es
precision highp float;
in vec3 vN;
in float vTop;
uniform float uFade;
uniform float uInk;
out vec4 o;
void main() {
  vec3 n = normalize(vN);
  float lit = clamp(dot(n.xy, vec2(-0.6, 0.8)), 0.0, 1.0);
  float c = vTop > 0.5 ? 0.5 + 0.5 * clamp(n.z, 0.0, 1.0) : 0.1 + 0.22 * clamp(n.z, 0.0, 1.0) + 0.3 * lit;
  c = clamp(c, 0.0, 1.0) * uFade;
  o = vec4(vec3(uInk > 0.5 ? c : 1.0 - c), 1.0);
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

export function mount(stage) {
  const canvas = stage.canvas;
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL2 unavailable');
  const dark = stage.theme.name === 'dark';
  stage.setBackdrop(dark ? 0 : 1);

  const prog = compile(gl, VS, FS);
  const cube = cubeMesh();
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, cube.v, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cube.i, gl.STATIC_DRAW);
  const inst = new Float32Array(MAX_INST * 10), instBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instBuf); gl.bufferData(gl.ARRAY_BUFFER, inst.byteLength, gl.DYNAMIC_DRAW);
  [[2, 3, 0], [3, 4, 12], [4, 3, 28]].forEach(([loc, size, off]) => {
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 40, off); gl.vertexAttribDivisor(loc, 1);
  });
  gl.bindVertexArray(null);

  // a 2D layer on top for the burst lines
  const overlay = document.createElement('canvas');
  overlay.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  overlay.setAttribute('aria-hidden', 'true');
  stage.root.appendChild(overlay);
  const octx = overlay.getContext('2d');

  const P = { gravity: 12, topple: 26, charge: 1.5, blast: 1 };
  let W = 1, H = 1, S = 100, world = null, solids = [], letters = [], bursts = [], shake = 0, fade = 1;
  let press = null, pid = null, lastEmptyTap = 0, acc = 0;

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
  const toPx = (x, y) => [x * S + W / 2, -y * S + H / 2];

  // ---------- world ----------
  function newWorld() {
    const w = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, -P.gravity) });
    w.allowSleep = true;
    w.broadphase = new CANNON.SAPBroadphase(w);
    w.solver.iterations = 20;
    // the floor grips, so a push makes a column tip instead of slide; letters are slippery against each other
    w.addContactMaterial(new CANNON.ContactMaterial(MAT.floor, MAT.letter, { friction: 1.0, restitution: 0.04 }));
    w.addContactMaterial(new CANNON.ContactMaterial(MAT.letter, MAT.letter, { friction: 0.18, restitution: 0.55 }));
    const floor = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: MAT.floor });
    floor.isWall = true; w.addBody(floor);
    // low walls round the edge keep shards and sliding bodies in, but a tall column can still lean out over them
    const wall = (x, y, hx, hy) => {
      const b = new CANNON.Body({ mass: 0, material: MAT.floor });
      b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, 0.9))); b.position.set(x, y, 0.9); b.isWall = true; w.addBody(b);
    };
    const ex = W / 2 / S, ey = H / 2 / S, floorY = -(H / 2 - (W < 720 ? 80 : 72)) / S, big = 40;
    wall(-ex - big, 0, big, big); wall(ex + big, 0, big, big);
    wall(0, ey - 0.15 + big, big, big); wall(0, floorY - big, big, big);
    return w;
  }

  function addLetter(p) {
    const w = p.w, h = p.h, t = 2 * ratio(p.ch, w, h);
    const boxes = [];
    for (const st of SKELETON[p.ch].s()) {
      const pts = st.pts.map((q) => [q.x * w, -q.y * h]);               // pixels, y up
      const dirs = [];
      for (let i = 1; i < pts.length; i++) { const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1], l = Math.hypot(dx, dy); dirs.push(l < 0.5 ? null : [dx / l, dy / l, l]); }
      // each segment becomes a box; where two meet, the box is lengthened just enough to fill the mitre, and the stroke ends are squared off
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
    let vol = 0; for (const b of boxes) vol += 8 * b.hx * b.hy * (COL_H / 2);
    const [wx, wy] = toWorld(p.x, p.y);
    const body = new CANNON.Body({ material: MAT.letter, mass: 3, position: new CANNON.Vec3(wx, wy, COL_H / 2), linearDamping: 0.04, angularDamping: 0.06, allowSleep: true, sleepSpeedLimit: 0.08, sleepTimeLimit: 0.6 });
    for (const b of boxes) {
      const q = new CANNON.Quaternion(); q.setFromEuler(0, 0, b.a);
      body.addShape(new CANNON.Box(new CANNON.Vec3(b.hx, b.hy, COL_H / 2)), new CANNON.Vec3(b.x, b.y, 0), q);
    }
    body.isLetter = true; body.ch = p.ch; body.vol = vol;
    world.addBody(body); solids.push(body); letters.push(body);
    body.sleep();
  }

  function build() {
    world = newWorld(); solids = []; letters = []; press = null; pid = null;
    S = 1; // placeholder so the layout can be measured in pixels
    const poses = layoutPx();
    S = poses[0].h / UNIT_H;
    for (const p of poses) addLetter(p);
    fade = 0;
  }

  // ---------- interaction ----------
  const wake = (b) => { try { b.wakeUp(); } catch (e) { /* ignore */ } };
  function pick(q) {
    const [x, y] = toWorld(q.x, q.y), res = new CANNON.RaycastResult();
    world.raycastClosest(new CANNON.Vec3(x, y, 8), new CANNON.Vec3(x, y, -1), { skipBackfaces: true }, res);
    if (res.hasHit && res.body && !res.body.isWall) return { body: res.body, point: res.hitPointWorld.clone() };
    return null;
  }

  // A tap is a firm knock at the top, away from where you touched. Every letter weighs the same, so a falling one
  // can carry the next.
  function topple(body, point) {
    wake(body);
    let dx = body.position.x - point.x, dy = body.position.y - point.y, d = Math.hypot(dx, dy);
    if (d < 0.08) { const a = Math.random() * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a); d = 1; }
    dx /= d; dy /= d;
    const J = body.mass * P.topple;                                // a firm knock at the top: every letter weighs the same, so one can carry the next
    body.applyImpulse(new CANNON.Vec3(dx * J, dy * J, 0), new CANNON.Vec3(point.x - body.position.x, point.y - body.position.y, point.z - body.position.z));
  }

  function explode(body) {
    const cx = body.position.x, cy = body.position.y;
    const R = 5.5 * P.blast, qb = body.quaternion;
    const shards = [];
    const c1 = new CANNON.Vec3(), c2 = new CANNON.Vec3(), sub = new CANNON.Vec3();
    body.shapes.forEach((sh, i) => {
      const o = body.shapeOffsets[i], so = body.shapeOrientations[i];
      const wq = new CANNON.Quaternion(); qb.mult(so, wq); qb.vmult(o, c1);
      const hx = sh.halfExtents.x, hy = sh.halfExtents.y, hz = sh.halfExtents.z;
      const nx = clamp(Math.ceil(hx * 2 / 0.6), 1, 3), ny = hy * 2 > 0.5 ? 2 : 1, nz = 2;
      for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) {
        sub.set(((ix + 0.5) / nx * 2 - 1) * hx, ((iy + 0.5) / ny * 2 - 1) * hy, ((iz + 0.5) / nz * 2 - 1) * hz);
        wq.vmult(sub, c2);
        const px = body.position.x + c1.x + c2.x, py = body.position.y + c1.y + c2.y, pz = body.position.z + c1.z + c2.z;
        const half = new CANNON.Vec3(hx / nx, hy / ny, hz / nz);
        const sb = new CANNON.Body({ material: MAT.letter, mass: Math.max(0.02, 8 * half.x * half.y * half.z * 0.6), position: new CANNON.Vec3(px, py, pz), quaternion: wq.clone(), linearDamping: 0.05, angularDamping: 0.1, allowSleep: true, sleepSpeedLimit: 0.15, sleepTimeLimit: 0.5 });
        sb.addShape(new CANNON.Box(half));
        let dx = px - cx, dy = py - cy; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
        const sp = (3.5 + Math.random() * 6) * Math.sqrt(P.blast);
        sb.velocity.set(dx * sp + (Math.random() - 0.5) * 2, dy * sp + (Math.random() - 0.5) * 2, 2 + Math.random() * 6);
        sb.angularVelocity.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16);
        shards.push(sb);
      }
    });
    world.removeBody(body);
    solids.splice(solids.indexOf(body), 1); letters.splice(letters.indexOf(body), 1);
    for (const s of shards) { world.addBody(s); solids.push(s); }
    // the blast: knock over everything near, harder the closer it is
    for (const b of solids) {
      if (b === body || shards.includes(b) || !b.isLetter) continue;
      let dx = b.position.x - cx, dy = b.position.y - cy; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const f = Math.max(0, 1 - d / R) ** 1.1; if (f <= 0) continue;
      wake(b);
      const j = b.mass * 11 * f * Math.sqrt(P.blast);
      b.applyImpulse(new CANNON.Vec3(dx * j, dy * j, 0), new CANNON.Vec3(0, 0, COL_H * 0.45));
    }
    // cartoon lines, in pixels
    const [bx, by] = toPx(cx, cy), size = S * UNIT_H, lines = [], N = 16;
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2 + (Math.random() - 0.5) * 0.3, long = i % 2 === 0;
      const s0 = size * (0.5 + Math.random() * 0.15), e0 = s0 + size * (long ? 0.7 + Math.random() * 0.6 : 0.28 + Math.random() * 0.2);
      lines.push({ a, s0, e0, bend: (Math.random() - 0.5) * 0.35, w: long ? 7 + Math.random() * 2.5 : 5 });
    }
    bursts.push({ x: bx, y: by, t: 0, lines });
    shake = 0.4;
  }

  const offs = [];
  offs.push(stage.on('down', (q, e) => {
    if (pid !== null) return;
    pid = e.pointerId;
    const hit = pick(q);
    if (!hit) {
      pid = null;
      const now = performance.now();
      if (now - lastEmptyTap < 380) { build(); resize2(); } lastEmptyTap = now;   // a double tap on empty space re-forms the letters
      return;
    }
    wake(hit.body);
    press = { body: hit.body, local: hit.body.pointToLocalFrame(hit.point), point: hit.point, x: q.x, y: q.y, t: 0, mode: 'pending', charge: 0, tx: q.x, ty: q.y };
  }));
  offs.push(stage.on('move', (q, e) => {
    if (pid !== null && e.pointerId !== pid) return;
    if (!press) { if (q.type === 'mouse') stage.root.style.cursor = pick(q) ? 'grab' : ''; return; }
    press.tx = q.x; press.ty = q.y;
    if (press.mode !== 'drag' && Math.hypot(q.x - press.x, q.y - press.y) > 8) press.mode = 'drag';
  }));
  offs.push(stage.on('up', (q, e) => {
    if (e.pointerId !== pid) return;
    if (press && press.mode === 'pending' && press.t < 0.22) topple(press.body, press.point);
    press = null; pid = null;
  }));

  function interact(dt) {
    if (!press || !press.body.world) { if (press && !press.body.world) press = null; return; }
    const b = press.body;
    press.t += dt;
    if (press.mode === 'pending' && press.t > 0.22) press.mode = 'hold';
    if (press.mode === 'drag') {                                    // a spring from the grabbed point to the finger
      wake(b);
      const wp = b.pointToWorldFrame(press.local), [tx, ty] = toWorld(press.tx, press.ty);
      const rel = new CANNON.Vec3(wp.x - b.position.x, wp.y - b.position.y, wp.z - b.position.z);
      const v = b.velocity, k = 70 * b.mass, c = 7 * b.mass;
      const f = new CANNON.Vec3(clamp((tx - wp.x) * k - v.x * c, -60 * b.mass, 60 * b.mass), clamp((ty - wp.y) * k - v.y * c, -60 * b.mass, 60 * b.mass), 0);
      b.applyForce(f, rel);
    } else if (press.mode === 'hold') {                             // it shudders harder and harder, then bursts
      wake(b);
      press.charge += dt;
      const u = clamp(press.charge / P.charge, 0, 1), amp = b.mass * (0.5 + 5 * u * u);
      b.applyImpulse(new CANNON.Vec3((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp, 0), new CANNON.Vec3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, COL_H / 2));
      if (press.charge >= P.charge) { explode(b); press = null; }
    }
  }

  // ---------- drawing ----------
  const qa = new CANNON.Quaternion(), vv = new CANNON.Vec3();
  function draw() {
    let n = 0;
    for (const b of solids) {
      for (let i = 0; i < b.shapes.length && n < MAX_INST; i++) {
        const sh = b.shapes[i];
        b.quaternion.mult(b.shapeOrientations[i], qa); b.quaternion.vmult(b.shapeOffsets[i], vv);
        const o = n * 10;
        inst[o] = b.position.x + vv.x; inst[o + 1] = b.position.y + vv.y; inst[o + 2] = b.position.z + vv.z;
        inst[o + 3] = qa.x; inst[o + 4] = qa.y; inst[o + 5] = qa.z; inst[o + 6] = qa.w;
        inst[o + 7] = sh.halfExtents.x; inst[o + 8] = sh.halfExtents.y; inst[o + 9] = sh.halfExtents.z;
        n++;
      }
    }
    gl.viewport(0, 0, stage.pw, stage.ph);
    gl.clearColor(dark ? 0 : 1, dark ? 0 : 1, dark ? 0 : 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.enable(gl.CULL_FACE);
    prog.use();
    gl.uniform2f(prog.u.uView, W / 2 / S, H / 2 / S);
    gl.uniform1f(prog.u.uFade, fade); gl.uniform1f(prog.u.uInk, dark ? 0 : 1);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst, 0, n * 10);
    gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, n);
    gl.bindVertexArray(null);

    // burst lines
    octx.setTransform(stage.pw / W, 0, 0, stage.ph / H, 0, 0);
    octx.clearRect(0, 0, W, H);
    octx.strokeStyle = dark ? '#fff' : '#000'; octx.lineCap = 'round';
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
    while (acc >= DT) { acc -= DT; interact(DT); world.step(DT); }
    for (const b of bursts) b.t += dt;
    bursts = bursts.filter((b) => b.t < 0.8);
    fade = Math.min(1, fade + dt * 2.2);
    if (shake > 0) { shake = Math.max(0, shake - dt); const a = shake / 0.4 * 9; canvas.style.transform = shake ? `translate(${(Math.random() - 0.5) * a}px, ${(Math.random() - 0.5) * a}px)` : ''; if (!shake) canvas.style.transform = ''; }
    draw();
  }));

  const reform = () => { build(); resize2(); };
  return {
    tune: {
      title: 'Columns',
      values: { ...P }, defaults: { ...P },
      groups: [
        { name: 'World', items: [{ key: 'gravity', label: 'Gravity', min: 4, max: 40, step: 1 }] },
        { name: 'Touch', items: [{ key: 'topple', label: 'Tap push', min: 6, max: 50, step: 1 }, { key: 'charge', label: 'Hold to burst (s)', min: 0.6, max: 4, step: 0.1 }, { key: 'blast', label: 'Blast', min: 0.4, max: 2.5, step: 0.05 }] },
      ],
      actions: { 'Re-form': reform },
      set(k, v) { P[k] = v; this.values[k] = v; if (k === 'gravity') world.gravity.set(0, 0, -v); },
      reset() { Object.assign(P, this.defaults); Object.assign(this.values, this.defaults); world.gravity.set(0, 0, -P.gravity); },
    },
    debug: { world: () => world, letters: () => letters, solids: () => solids, topple, explode, S: () => S, pick },
    destroy() {
      offs.forEach((f) => f());
      overlay.remove(); canvas.style.transform = ''; stage.root.style.cursor = '';
      stage.setBackdrop(null);
    },
  };
}
