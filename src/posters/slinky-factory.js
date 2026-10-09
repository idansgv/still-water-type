// Slinky factory. A machine with a spout turned sideways (a 90 degree elbow). Hold the mouse (or a finger) and it streams coils out of the spout, one after another, pushed straight
// out and then falling under their own weight; let go and the cutter snips the stream: the loose piece lands on the shelf under the spout, is carried to its edge by the coils behind it
// and goes down the stairs. Every coil is a rigid ring (slinky-rings.js has the solver, shared with the stairs scene): the wire between coils is a zero-length spring, a ring leans
// off square to the path only so far, rings push each other off, the shelf and the steps push back with friction and a bounce.
// One colour: black on white, white on black on every second shuffle. Letters come later.

import { createRings, trackHand } from './slinky-rings.js';
import { SHARED_DEFAULTS, bindParams } from './slinky-params.js';
import { ringShape } from './slinky-shape.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createFactory(stage, V, shared = { ...SHARED_DEFAULTS }) {
  const ctx = stage.canvas.getContext('2d');
  const dark = !!stage.flip;
  const ink = dark ? '#fff' : '#000', paper = dark ? '#000' : '#fff';
  const offs = [];

  const OWN = {                                      // the factory's own: the stream and the stairs beyond the shelf
    feed: 560, pitch: 0.18, keep: 3, longest: 90,    // how fast coils leave the spout (px/s), their spacing as they leave (of the radius), pieces kept, most coils in one piece
    steps: 5, run: 0.17, start: 0.32,                // how many steps, how deep, where the shelf ends (of the width)
  };
  const DEFAULTS = { ...SHARED_DEFAULTS, ...OWN };
  const P = bindParams(shared, OWN);

  let W = 1, H = 1, R = 50, rw = 3, floorY = 600, nozzle = { x: 0, y: 0 }, barrel = 40;     // the scene is in pixels with y DOWN (the page's way); the solver wants y up, so it is fed -y
  const pieces = [];                                  // each: { ring, n, x[], y[] (y down), rx[], ry[], fade, dying, hold0 }
  let live = null, pressed = false, emitAcc = 0, grab = null, pid = null, acc = 0;

  function build() {
    W = stage.W; H = stage.H; R = Math.min(W, H) * P.size; rw = Math.max(2, R * P.wire * 0.5);
    floorY = H - 92; nozzle = { x: W * 0.22, y: H * 0.27 }; barrel = R * 1.6;
    pieces.length = 0; live = null; pressed = false; grab = null; cam = { x: 0, y: 0 };
  }
  // The floor: flat, or (steps > 0) a shelf level with the foot of the spout (the stream lands on it and is carried to its edge), then equal steps down to the floor.
  const stairs = () => { const top = nozzle.y + R * 1.7, st = (floorY - top) / P.steps; return { x0: W * P.start, top, st, wd: Math.max(R, W * P.run * 0.5) }; };
  const boxes = () => {                                                       // [xa, xb, top] with the top in y UP
    if (!P.steps) return [[-1e6, 1e6, -floorY]];
    const g = stairs(), out = [[-1e6, g.x0, -g.top]];
    for (let k = 1; k <= P.steps; k++) out.push([g.x0 + (k - 1) * g.wd, k === P.steps ? 1e6 : g.x0 + k * g.wd, -(g.top + g.st * k)]);
    return out;
  };
  const newPiece = (cap = P.longest + 4) => {
    const ring = createRings(cap);
    return { ring, n: 0, x: new Float64Array(cap), y: new Float64Array(cap), vx: new Float64Array(cap), vy: new Float64Array(cap), rx: new Float64Array(cap), ry: new Float64Array(cap), fade: 1, dying: false };
  };
  function emit(p) {
    const r = p.ring, i = r.n++; p.n = r.n;
    r.x[i] = nozzle.x - R * 0.4; r.y[i] = -nozzle.y; r.a[i] = Math.PI / 2; r.vx[i] = P.feed; r.vy[i] = 0; r.w[i] = 0; r.kin[i] = 1; r.im[i] = 1; r.capSign[i] = 0;      // a coil leaves the spout standing up
    if (i === 0) { r.capSign[0] = -1; r.im[0] = P.capInertia; }                    // the first coil is the head cap: it faces forward
    else { if (i - 1 > 0) { r.capSign[i - 1] = 0; r.im[i - 1] = 1; } r.capSign[i] = 1; r.im[i] = P.capInertia; }       // the newest is the tail cap: it faces back
  }
  const refresh = (p) => {                                                    // the page's view of a ring chain: centres (y down), speeds, and the rod's direction from top to bottom
    const r = p.ring; p.n = r.n;
    for (let i = 0; i < r.n; i++) { p.x[i] = r.x[i]; p.y[i] = -r.y[i]; p.vx[i] = r.vx[i]; p.vy[i] = -r.vy[i]; p.rx[i] = -Math.cos(r.a[i]); p.ry[i] = Math.sin(r.a[i]); }
  };

  function envNow() {
    const k = P.spring, kw = k * 60, kc = k * P.contact, e = clamp(P.bounce, 0.02, 0.98), zeta = -Math.log(e) / Math.sqrt(Math.PI * Math.PI + Math.log(e) ** 2), dmin = R * P.gap + rw, I = R * R * P.inertia, kl = k * R * R * P.leanK;
    return { R, g: P.gravity * R, k, kd: P.shear * k, l0: Math.hypot(2 * R, dmin), cw: P.wireDamp, kc, cc: 2 * Math.sqrt(kc) * P.contactDamp, dmin, rw, kw, cwall: 2 * zeta * Math.sqrt(kw), mu: P.grip, cf: 60, inertia: P.inertia, lean: P.lean * Math.PI / 180,
      kl, kla: 2 * Math.sqrt(kl * I) * 0.5, endFlat: kl * P.endFlat, square: P.square, bend: P.bend, turn: P.turn, turnReach: P.turnReach, turnDelay: P.turnDelay, wdamp: P.spin, air: P.damping, reach: 5, boxes: boxes(), grab: null };
  }
  function stepAll(dt) {
    // the feed: while the button is down a new coil leaves the spout every `pitch` radii of travel
    if (pressed && live) {
      emitAcc += P.feed * dt; const step = Math.max(2, R * P.pitch);
      while (emitAcc >= step && live.ring.n < P.longest) { emitAcc -= step; emit(live); }
      if (live.ring.n >= P.longest) release();
    }
    const env = envNow(), h = 1 / 960, nsub = 16;
    for (const p of pieces) {
      const r = p.ring; if (!r.n) continue;
      for (let i = 0; i < r.n; i++) {                                         // the first stretch is the spout: coils are pushed straight out, by hand, until they leave it
        if (p === live && pressed && r.x[i] < nozzle.x + barrel && r.kin[i] !== 2) { r.kin[i] = 1; r.vx[i] = P.feed; r.vy[i] = 0; r.w[i] = 0; r.y[i] = -nozzle.y; r.a[i] = Math.PI / 2; }
        else if (p.hold0 && i === 0) { r.kin[i] = 1; r.vx[i] = r.vy[i] = r.w[i] = 0; }                                  // (a test: the first coil held)
        else r.kin[i] = 0;
      }
      if (grab && grab.p === p) { const g = grab.hand || (grab.hand = { pt: 0 }); g.x = grab.x; g.y = -grab.y; trackHand(g, g.x, g.y, dt); env.grab = g; } else env.grab = null;
      for (let s = 0; s < nsub; s++) r.step(h, env);
      for (let i = 0; i < r.n; i++) {                                         // the edges of the page are walls
        const lo = R * 0.5, hi = W - R * 0.5; if (r.x[i] < lo) { r.x[i] = lo; if (r.vx[i] < 0) r.vx[i] = 0; } else if (r.x[i] > hi) { r.x[i] = hi; if (r.vx[i] > 0) r.vx[i] = 0; }
      }
      refresh(p);
    }
    for (let i = pieces.length - 1; i >= 0; i--) { const p = pieces[i]; if (p.dying) { p.fade -= dt * 1.6; if (p.fade <= 0) pieces.splice(i, 1); } }
    const finished = pieces.filter((p) => p !== live && !p.dying);
    if (finished.length > P.keep) finished[0].dying = true;
  }
  function press() {
    if (pressed) return;
    live = newPiece(); pieces.push(live); pressed = true; emitAcc = 0;
    emit(live);
  }
  function release() { if (!pressed) return; pressed = false; live = null; }
  function standing(n = 16, h0 = 260, spacing = 2) {         // a slinky standing on its end, above the floor, ready to fall
    pieces.length = 0; live = null; pressed = false; const p = newPiece(Math.max(n + 4, 40)), r = p.ring, x0 = W * 0.72, s0 = Math.max(2, R * P.gap + rw) * spacing;
    for (let i = 0; i < n; i++) { r.x[i] = x0; r.y[i] = -(floorY - h0 - (n - 1 - i) * s0); r.a[i] = 0; r.vx[i] = r.vy[i] = r.w[i] = 0; } r.n = n; r.setCaps(P.capInertia);
    refresh(p); pieces.push(p); return p;
  }
  function hanging(n = 30, settle = 360) {                    // hung by the first coil, settled; `delete p.hold0` lets go
    pieces.length = 0; live = null; pressed = false; const p = newPiece(Math.max(n + 4, 40)), r = p.ring, x0 = W * 0.7, s0 = R * P.gap + rw;
    for (let i = 0; i < n; i++) { r.x[i] = x0; r.y[i] = -(H * 0.1 + i * s0); r.a[i] = 0; r.vx[i] = r.vy[i] = r.w[i] = 0; } r.n = n; r.setCaps(P.capInertia); p.hold0 = true; refresh(p); pieces.push(p);
    for (let i = 0; i < settle; i++) stepAll(1 / 60); return p;
  }

  // The scene is drawn through the shared camera, in a world with y up and the middle of the screen at the origin. Rings are circles in 3D, perpendicular to the chain.
  const wx = (x) => x - W / 2, wy = (y) => H / 2 - y;
  let cam = { x: 0, y: 0 };
  function box(r, ox, oy, x0, y0, z0, x1, y1, z1) {                       // a solid box, faces far to near, so it hides what is behind it
    const c = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]];
    const ps = c.map((v) => V.project(v, r, ox, oy)), order = faces.map((f, i) => ({ f, z: f.reduce((t, k) => t + ps[k][2], 0) / 4 })).sort((a, b) => a.z - b.z);
    for (const { f } of order) { ctx.beginPath(); f.forEach((k, i) => (i ? ctx.lineTo(ps[k][0], ps[k][1]) : ctx.moveTo(ps[k][0], ps[k][1]))); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  }
  function draw() {
    V.ease();
    // the camera: the middle of the scene, or (the Close view) the head of the newest piece
    let tx = 0, ty = 0;
    if (V.focus === 'front') { const p = pieces.slice().reverse().find((q) => q.n && !q.dying); if (p) { tx = wx(p.x[0]); ty = wy(p.y[0]); } }
    const kf = Math.hypot(tx - cam.x, ty - cam.y) > R * 10 ? 1 : 0.12; if (!V.lock) { cam.x += (tx - cam.x) * kf; cam.y += (ty - cam.y) * kf; }
    ctx.setTransform(stage.pw / W, 0, 0, stage.ph / H, 0, 0);
    ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H);
    const r = V.rot(), [ox, oy] = V.origin(r, cam, W, H), d = R * 1.5;
    ctx.strokeStyle = ink; ctx.fillStyle = paper; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2.4, R * 0.06);
    if (!P.steps) box(r, ox, oy, -W * 1.2, wy(floorY) - R * 0.6, -d * 1.6, W * 1.2, wy(floorY), d * 1.6);
    else {
      const g = stairs(), top = g.top;
      box(r, ox, oy, -W * 1.2, wy(top) - R * 0.6, -d * 1.6, wx(g.x0), wy(top), d * 1.6);
      for (let k2 = 1; k2 <= P.steps; k2++) { const a = wx(g.x0 + (k2 - 1) * g.wd), b = k2 === P.steps ? W * 1.2 : wx(g.x0 + k2 * g.wd), y = wy(top + g.st * k2); box(r, ox, oy, a, y - Math.max(R * 0.6, g.st * 2), -d * 1.6, b, y, d * 1.6); }
    }
    // the factory: a body, and a spout turned sideways
    const nx = wx(nozzle.x), ny = wy(nozzle.y), bx = nx - R * 3.2, bw = R * 2.6, bh = R * 3.2;
    box(r, ox, oy, bx, ny - bh / 2, -R * 1.2, bx + bw, ny + bh / 2, R * 1.2);
    box(r, ox, oy, bx + bw, ny - R * 1.02, -R * 1.02, nx + barrel * 0.35, ny + R * 1.02, R * 1.02);
    // the coils: circles perpendicular to the chain, far ones first
    const list = [];
    for (const p of pieces) for (let i = 0; i < p.n; i++) {
      const a = p.ring.a[i]; let cap = null;
      if (p.n > 1 && p.ring.capSign[i]) { const sg = p.ring.capSign[i]; cap = [-Math.sin(a) * sg, Math.cos(a) * sg]; }       // the two end rings (the caps): a marker along the ring's own facing, which turns with it
      list.push({ c: [wx(p.x[i]), wy(p.y[i]), 0], u: [Math.cos(a), Math.sin(a)], cap, fade: p.fade, z: V.project([wx(p.x[i]), wy(p.y[i]), 0], r, 0, 0)[2] });
    }
    list.sort((a, b) => a.z - b.z);
    const markers = [], shape = ringShape(P.letter);
    for (const it of list) {
      ctx.globalAlpha = Math.max(0, it.fade);
      ctx.lineWidth = Math.max(1.6, R * P.wire) * (it.cap ? 2.2 : 1);
      ctx.beginPath();
      if (shape) for (const loop of shape) {                              // a letter-shaped ring: its loops (a hole is a loop too)
        for (let i = 0; i <= loop.length; i++) { const pt = loop[i % loop.length], q = V.project([it.c[0] + it.u[0] * pt[0] * R, it.c[1] + it.u[1] * pt[0] * R, pt[1] * R], r, ox, oy); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
      } else for (let i = 0; i <= 36; i++) {
        const t = i / 36 * Math.PI * 2, cs = Math.cos(t) * R, sn = Math.sin(t) * R, q = V.project([it.c[0] + it.u[0] * cs, it.c[1] + it.u[1] * cs, sn], r, ox, oy);
        i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
      }
      ctx.stroke();
      if (it.cap) markers.push([V.project(it.c, r, ox, oy), V.project([it.c[0] + it.cap[0] * R * 1.25, it.c[1] + it.cap[1] * R * 1.25, 0], r, ox, oy), it.fade]);
    }
    for (const [a0, a1, fade] of markers) {                                  // the markers last, on top, with a halo: a stick from the middle of the cap pointing away from the body, ending in a dot
      ctx.globalAlpha = Math.max(0, fade);
      for (const [col, wm, rm] of [[paper, 3.2, 1.9], [ink, 1.4, 1]]) {
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(2, R * 0.04) * wm; ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.stroke();
        ctx.beginPath(); ctx.arc(a1[0], a1[1], Math.max(3.5, R * 0.1) * rm, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.strokeStyle = ink; ctx.fillStyle = paper;
    ctx.globalAlpha = 1;
  }

  // ---------- touch ----------
  offs.push(stage.on('down', (q, e) => {
    if (V.mode !== 'factory' || pid !== null) return;
    pid = e.pointerId;
    const w = V.onPlane(q, cam, W, H);
    if (w) {
      const px = w[0] + W / 2, py = H / 2 - w[1];
      // taking hold of the loose end of a piece on the floor: its first coil
      let best = null, bd = (R * 1.2) ** 2;
      for (const p of pieces) if (p.n && !p.dying && p !== live) { const dd = (p.x[0] - px) ** 2 + (p.y[0] - py) ** 2; if (dd < bd) { bd = dd; best = p; } }
      if (best) { grab = { p: best, i: 0, x: px, y: py }; return; }
    }
    // anywhere else: hold to stream coils. A drag that starts on the machine's own side would also orbit; here a hold streams, a drag orbits.
    down = { x: q.x, y: q.y, t: performance.now() }; orbiting = false;
  }));
  let down = null, orbiting = false;
  offs.push(stage.on('move', (q, e) => {
    if (V.mode !== 'factory' || e.pointerId !== pid) return;
    if (grab) { const w = V.onPlane(q, cam, W, H); if (w) { grab.x = w[0] + W / 2; grab.y = H / 2 - w[1]; } return; }
    if (down && !orbiting && Math.hypot(q.x - down.x, q.y - down.y) > 10) { orbiting = true; release(); V.orbit.start(down); }
    if (orbiting) V.orbit.move(q);
  }));
  offs.push(stage.on('up', (q, e) => {
    if (V.mode !== 'factory' || e.pointerId !== pid) return;
    release(); if (orbiting) V.orbit.end(); down = null; orbiting = false; grab = null; pid = null;
  }));
  offs.push(stage.on('resize', build));
  build();

  let seenGeom = shared.__geom || 0;
  offs.push(stage.frame((dt) => {
    if (V.mode !== 'factory') return;
    if ((shared.__geom || 0) !== seenGeom) { seenGeom = shared.__geom || 0; build(); }                // the size or the gap was changed in the other scene
    if (down && !orbiting && !grab && !pressed && performance.now() - down.t > 140) press();       // held still for a moment: the stream starts
    acc = Math.min(acc + dt, 0.05); while (acc >= 1 / 60) { acc -= 1 / 60; stepAll(1 / 60); } draw();
  }));

  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  return {
    tune: {
      title: 'Slinky factory', values: P, defaults: DEFAULTS,
      groups: [
        { name: 'Stream', items: [Ctl('feed', 'Feed speed (px/s)', 100, 1400, 10), Ctl('pitch', 'Spacing as they leave (radii)', 0.15, 1.2, 0.01), Ctl('longest', 'Longest piece (coils)', 20, 300, 5), Ctl('keep', 'Pieces kept on the floor', 1, 6, 1)] },
        { name: 'Rings', items: [Ctl('lean', 'Most a ring may lean off the path (deg)', 15, 85, 1), Ctl('leanK', 'How hard that limit is held', 0.05, 3, 0.05), Ctl('bend', 'Stiffness against bending (1 straight, 0 rope)', 0, 1, 0.01), Ctl('square', 'Rings square to the path (they lean down a bend)', 0, 2, 0.05), Ctl('turn', 'The ring in hand turns with the move', 0, 14, 0.1), Ctl('turnReach', 'Rings it carries along', 0, 30, 1), Ctl('turnDelay', 'How late each is (frames)', 0, 8, 1), Ctl('shear', 'Diagonal wire (tension squares the rings)', 0, 3, 0.05), Ctl('spring', 'Wire stiffness', 5, 6000, 1), Ctl('gap', 'Closest coils (radii, re-forms)', 0.02, 0.5, 0.005), Ctl('wireDamp', 'Wire damping', 0, 60, 0.5), Ctl('contact', 'Ring on ring stiffness', 5, 80, 1), Ctl('contactDamp', 'Ring on ring damping', 0, 1.5, 0.02), Ctl('inertia', 'Ring inertia', 0.1, 2, 0.05), Ctl('spin', 'Spin damping', 0, 10, 0.1), Ctl('endFlat', 'End rings lie flat', 0, 3, 0.05), Ctl('capInertia', 'Weight of the cap rings (to turn over)', 1, 12, 0.5)] },
        { name: 'World', items: [Ctl('gravity', 'Gravity', 4, 60, 1), Ctl('grip', 'Friction', 0, 1.5, 0.05), Ctl('bounce', 'Bounce off the floor', 0.05, 0.95, 0.01), Ctl('damping', 'Air drag', 0, 4, 0.05)] },
        { name: 'Stairs', items: [Ctl('steps', 'Steps (0 = flat floor)', 0, 8, 1), Ctl('run', 'Step depth', 0.08, 0.4, 0.01), Ctl('start', 'Where the shelf ends', 0.3, 0.8, 0.01)] },
        { name: 'Look', items: [Ctl('size', 'Coil radius (re-forms)', 0.03, 0.14, 0.005), Ctl('wire', 'Wire thickness', 0.02, 0.2, 0.005), { key: 'letter', label: 'Ring shape: type a letter (empty = round)', type: 'text', rows: 1 }] },
      ],
      actions: {
        'Stand one up (drag its top over)': () => { const p = standing(40, 0, 1); refresh(p); },     // an upright slinky on the floor: take the top ring by its rim and carry it over in an arch; the coils flip over by their momentum
        'Drop one standing': () => { const p = standing(16, 260, 2), r = p.ring, lean = R * 0.06; for (let i = 0; i < r.n; i++) r.x[i] += i * lean; refresh(p); },   // the trick: it lands on its end, recoils and falls over into an arch
        'Hang it (the Slinky drop)': () => { Object.assign(P, { spring: 150 }); hanging(14, 600); if (stage.refreshPanel) stage.refreshPanel(); },     // a soft Slinky hung by its top coil: let go and the bottom hovers while the top falls
        'Let go': () => { for (const p of pieces) delete p.hold0; },
        'Bouncy slinky': () => { Object.assign(P, { bounce: 0.6, wireDamp: 0.3, spring: 1200 }); if (stage.refreshPanel) stage.refreshPanel(); },
        'Calm slinky': () => { Object.assign(P, { bounce: DEFAULTS.bounce, wireDamp: DEFAULTS.wireDamp, spring: DEFAULTS.spring }); if (stage.refreshPanel) stage.refreshPanel(); },
        'Sweep up': () => { pieces.length = 0; live = null; pressed = false; } },
      set(key, value) { P[key] = value; if (key === 'size' || key === 'gap') build(); },
      reset() { Object.assign(P, DEFAULTS); build(); },
    },
    debug: { grabFirst: (p, x, y) => { grab = { p, i: 0, x, y }; }, moveGrab: (x, y) => { if (grab) { grab.x = x; grab.y = y; } }, dropGrab: () => { grab = null; }, cap: (p, i) => { const r = p.ring, a = r.a[i], sg = r.capSign[i] || 1; return [-Math.sin(a) * sg, Math.cos(a) * sg]; }, stand: standing, hang: hanging, press, release, run: (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) stepAll(dt); draw(); }, pieces: () => pieces, P },
    destroy() { offs.forEach((f) => f()); },
  };
}
