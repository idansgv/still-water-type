// Slinky, physical. A Slinky as a real simulation, not an animation. In side view every coil is a rigid ring (a rod, the ring edge-on): a body with a centre, an angle and a spin
// (slinky-rings.js has the solver). The wire joining the coils is a zero-length spring from top to top and bottom to bottom (pre-tensioned: it stretches a long way and stacks tight),
// a ring leans off square to the path through its neighbours only so far, rings push each other off and the steps and their corners push back, with friction and a bounce, and gravity pulls.
// Nothing here knows about walking: if the slinky tips over the edge of a step and a wave of flipping coils runs down it and it lands on the next step, that is the physics doing it.
//
// Drawing: each rod becomes a 3D ring (a circle whose plane holds the rod and the depth axis), seen in an isometric tilt.
// Touch: take hold of either end of the slinky (first or last coil) and pull; a quick tap on the top coil nudges it forward.
// One colour: black on white, white on black on every second shuffle.

import { createRings } from './slinky-rings.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createPhys(stage, V) {
  const ctx = stage.canvas.getContext('2d');
  const dark = !!stage.flip;
  const ink = dark ? '#fff' : '#000', paper = dark ? '#000' : '#fff';
  const offs = [];

  const DEFAULTS = {                                 // wide rings, many coils, a flowing walk: found by a random search on the rigid-ring solver (tools/slinky-bench.js, search3), 10 Oct 2026
    coils: 40, size: 0.11, wire: 0.03,                 // number of coils, coil radius (of the shorter screen side), wire thickness drawn (of the radius)
    spring: 2131, gap: 0.12, arch: 14.7, pack: 0.12, archW: 1.2, archH: 1.1,   // wire stiffness, closest approach between coils, coils on the arch at the start, stack spacing, arch width and height
    gravity: 22.5, grip: 0.42, damping: 0.21, bounce: 0.6,             // gravity (radii per s^2), friction of the steps, air drag (per s), bounce off the steps
    wireDamp: 5.35, contact: 14.7, contactDamp: 0.02, inertia: 0.49, lean: 42.4, leanK: 0.66, spin: 2.07, shear: 0, square: 0, endFlat: 0.6, capInertia: 3,   // damping along the wire, stiffness of a ring pressed on a ring (times the wire's) and its damping, the ring's inertia (of mass x radius^2), most a ring may lean off square (deg) and how hard it is held, spin damping, diagonal wire, how firmly the end rings lie flat
    stepW: 6.9, drop: 2.3, push: 2.4,                 // width and drop of a step (radii), the strength of the tap
    yaw: 50, pitch: 32,                                // the view (degrees)
  };
  const P = { ...DEFAULTS };

  let W = 1, H = 1, R = 60, N = 20, L = 120, rw = 4, stepW = 450, Hs = 70;
  let px = [], py = [], cam = { x: 0, y: 0 }, grab = null, pid = null, acc = 0, tapT = 0, ring = null;

  const top = (k) => -k * Hs;                                   // the top of step k (step 0 is the upper one, x from -inf to 0; step k covers x in [(k-1) stepW, k stepW])
  const stepX = (k) => [(k - 1) * stepW, k * stepW];

  function build() {
    W = stage.W; H = stage.H;
    R = Math.min(W, H) * P.size; N = Math.round(P.coils); L = 2 * R; rw = Math.max(3, R * P.wire * 0.5); stepW = R * P.stepW; Hs = R * P.drop;
    px = new Float32Array(2 * N); py = new Float32Array(2 * N);
    // The starting pose: the slinky is already draped over the edge of the upper step, the way a slinky is when it is about to walk: its
    // front coils hang over the edge on an arch, the rest stand in a stack on the upper step. Every coil is a rod across the path
    // (so a stacked coil stands upright, and a coil on the hanging part lies flat). From here it is only physics.
    const s = R * P.pack, Wa = R * P.archW, Ha = R * P.archH, E = [0, R + rw], Lp = [Wa, R - Hs + rw], C = [Wa * 0.1, R + Ha * 1.9];
    const curve = []; let total = 0, prev = null;
    for (let i = 0; i <= 120; i++) {
      const t = i / 120, x = (1 - t) * (1 - t) * E[0] + 2 * (1 - t) * t * C[0] + t * t * Lp[0], y = (1 - t) * (1 - t) * E[1] + 2 * (1 - t) * t * C[1] + t * t * Lp[1];
      if (prev) total += Math.hypot(x - prev[0], y - prev[1]);
      curve.push([x, y, total]); prev = [x, y];
    }
    const A = Math.min(N - 1, Math.max(3, Math.round(P.arch)));              // how many coils are on the arch at the start
    for (let i = 0; i < N; i++) {
      let cx, cy, tx, ty;
      if (i >= A) { cx = -(i - A) * s; cy = R + rw; tx = 1; ty = 0; }        // standing on the upper step
      else {                                                                   // on the arch: coil A at the edge, coil 0 at the landing
        const d = total * (A - i) / A; let k = 1; while (k < curve.length - 1 && curve[k][2] < d) k++;
        const c0 = curve[k - 1], c1 = curve[k], f = (d - c0[2]) / ((c1[2] - c0[2]) || 1), dx = c1[0] - c0[0], dy = c1[1] - c0[1], dl = Math.hypot(dx, dy) || 1;
        cx = c0[0] + dx * f; cy = c0[1] + dy * f; tx = dx / dl; ty = dy / dl;
      }
      const ux = -ty, uy = tx;                                                  // the rod runs across the path
      px[2 * i] = cx + ux * R; py[2 * i] = cy + uy * R; px[2 * i + 1] = cx - ux * R; py[2 * i + 1] = cy - uy * R;
    }
    cam = { x: -N * s * 0.3, y: 0 }; grab = null;
    ring = createRings(N); ring.setFromEnds(N, px, py); ring.setCaps(P.capInertia); ring.endsOf(R, px, py);
  }
  // index: top of coil i is 2i, bottom 2i+1

  // the world for the solver: step 0 is the upper one (to the left), the last goes on for ever
  const boxes = () => { const out = []; for (let k = 0; k <= 5; k++) out.push([k === 0 ? -1e5 : (k - 1) * stepW, k === 0 ? 0 : k === 5 ? 1e5 : k * stepW, top(k)]); return out; };
  function envNow() {
    const k = P.spring, kw = k * 60, kc = k * P.contact, e = clamp(P.bounce, 0.02, 0.98), zeta = -Math.log(e) / Math.sqrt(Math.PI * Math.PI + Math.log(e) ** 2), dmin = R * P.gap + rw, I = R * R * P.inertia, kl = k * R * R * P.leanK;
    return { R, g: P.gravity * R, k, kd: P.shear * k, l0: Math.hypot(L, dmin), cw: P.wireDamp, kc, cc: 2 * Math.sqrt(kc) * P.contactDamp, dmin, rw, kw, cwall: 2 * zeta * Math.sqrt(kw), mu: P.grip, cf: 60, inertia: P.inertia, lean: P.lean * Math.PI / 180, kl, kla: 2 * Math.sqrt(kl * I) * 0.5, endFlat: kl * P.endFlat, square: P.square, wdamp: P.spin, air: P.damping, reach: 5, boxes: boxes(),
      grab: grab ? { pt: grab.i, x: grab.x, y: grab.y } : null };
  }
  function stepAll() { const h = 1 / 960, env = envNow(); for (let s = 0; s < 16; s++) ring.step(h, env); ring.endsOf(R, px, py); }
  const tapImpulse = (pt, f) => ring.impulseAt(pt, R * 18 * f, R * 6 * f, R, R * R * P.inertia);

  // ---------- the view ----------
  // the camera is shared with the factory (slinky-view.js)
  const rot = () => V.rot(), project = (v, r, ox, oy) => V.project(v, r, ox, oy);
  function origin(r) { return V.origin(r, cam, W, H); }

  function draw() {
    V.ease();
    ctx.setTransform(stage.pw / W, 0, 0, stage.ph / H, 0, 0);
    ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H);
    // the camera follows the slinky
    let mx = 0, my = 0; for (let i = 0; i < 2 * N; i++) { mx += px[i]; my += py[i]; } mx /= 2 * N; my /= 2 * N;
    if (V.focus === 'front') { mx = (px[0] + px[1]) / 2; my = (py[0] + py[1]) / 2; }
    const far = Math.hypot(mx - cam.x, my - cam.y) > R * 10;                 // if it has run far ahead (or a view was just chosen) catch up at once
    const kf = far ? 1 : 0.1; cam.x += (mx - cam.x) * kf; cam.y += (my - cam.y) * kf;
    const r = rot(), [ox, oy] = origin(r), depth = R * 1.6;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = ink; ctx.fillStyle = paper; ctx.lineWidth = Math.max(2, R * 0.05);
    for (let k = 6; k >= -1; k--) {                                        // steps, far to near
      const xa = k === 0 ? -stepW * 3 : (k - 1) * stepW, xb = k === 0 ? 0 : k * stepW, tp = top(k), bt = tp - Hs * 1.4;
      const quad = (pts) => { ctx.beginPath(); pts.forEach((q, i) => { const s2 = project(q, r, ox, oy); i ? ctx.lineTo(s2[0], s2[1]) : ctx.moveTo(s2[0], s2[1]); }); ctx.closePath(); ctx.fill(); ctx.stroke(); };
      quad([[xa, tp, -depth], [xb, tp, -depth], [xb, tp, depth], [xa, tp, depth]]);
      quad([[xa, tp, depth], [xb, tp, depth], [xb, bt, depth], [xa, bt, depth]]);
    }
    // the coils, far ones first
    const list = [];
    for (let i = 0; i < N; i++) {
      const cx = (px[2 * i] + px[2 * i + 1]) / 2, cy = (py[2 * i] + py[2 * i + 1]) / 2, ux = (px[2 * i] - px[2 * i + 1]) / L, uy = (py[2 * i] - py[2 * i + 1]) / L;
      list.push({ i, cx, cy, ux, uy, z: project([cx, cy, 0], r, 0, 0)[2] });
    }
    list.sort((a, b) => a.z - b.z);
    // the two end rings (the caps) are drawn heavier and carry a marker along their axis, pointing away from the body, so you can tell which way each faces
    const capDir = (i) => { const a = ring.a[i], sg = ring.capSign[i] || 1; return [-Math.sin(a) * sg, Math.cos(a) * sg]; };      // the cap's facing turns with the ring (it has its own inertia), it does not snap
    const caps = new Map([[0, capDir(0)], [N - 1, capDir(N - 1)]]), markers = [];
    for (const c of list) {
      const cap = caps.get(c.i);
      ctx.lineWidth = Math.max(1.6, R * P.wire) * (cap ? 2.2 : 1);
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = i / 40 * Math.PI * 2, cs = Math.cos(a) * R, sn = Math.sin(a) * R, q = project([c.cx + c.ux * cs, c.cy + c.uy * cs, sn], r, ox, oy);
        i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
      }
      ctx.stroke();
      if (cap) markers.push([project([c.cx, c.cy, 0], r, ox, oy), project([c.cx + cap[0] * R * 1.25, c.cy + cap[1] * R * 1.25, 0], r, ox, oy)]);
    }
    for (const [a0, a1] of markers) {                                        // the markers last, on top, with a halo: a stick from the middle of the cap pointing away from the body, ending in a dot
      for (const [col, wm, rm] of [[paper, 3.2, 1.9], [ink, 1.4, 1]]) {
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(2, R * 0.04) * wm; ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.stroke();
        ctx.beginPath(); ctx.arc(a1[0], a1[1], Math.max(3.5, R * 0.1) * rm, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.strokeStyle = ink; ctx.fillStyle = paper;
  }

  // ---------- touch ----------
  const endPoint = (q) => {
    const r = rot(), [ox, oy] = origin(r); let best = null, bd = (R * 1.1) ** 2;
    for (const i of [0, 1, 2 * (N - 1), 2 * (N - 1) + 1]) { const s2 = project([px[i], py[i], 0], r, ox, oy), d = (s2[0] - q.x) ** 2 + (s2[1] - q.y) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  };
  const onPlane = (q) => V.onPlane(q, cam, W, H);
  offs.push(stage.on('down', (q, e) => {
    if (V.mode !== 'stairs') return;
    if (pid !== null) return;
    pid = e.pointerId; const i = endPoint(q); tapT = performance.now();
    const w = i !== null ? onPlane(q) : null;
    if (w) grab = { i, x: w[0], y: w[1], t: performance.now() };
    else V.orbit.start(q);                                                              // empty space: drag to turn the view
  }));
  offs.push(stage.on('move', (q, e) => {
    if (V.mode !== 'stairs') return;
    if (e.pointerId !== pid) return;
    if (grab) { const w = onPlane(q); if (w) { grab.x = w[0]; grab.y = w[1]; } }
    else if (V.orbit.s) V.orbit.move(q);
  }));
  offs.push(stage.on('up', (q, e) => {
    if (V.mode !== 'stairs') return;
    if (e.pointerId !== pid) return;
    if (grab && performance.now() - grab.t < 250) tapImpulse(grab.i, P.push);   // a tap: nudge that end forward
    grab = null; V.orbit.end(); pid = null;
  }));
  offs.push(stage.on('resize', build));
  build();

  offs.push(stage.frame((dt) => { if (V.mode !== 'stairs') return; acc = Math.min(acc + dt, 0.05); while (acc >= 1 / 60) { acc -= 1 / 60; stepAll(); } draw(); }));

  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  return {
    tune: {
      title: 'Slinky (physical)', values: P, defaults: DEFAULTS,
      groups: [
        { name: 'Wire', items: [Ctl('spring', 'Spring stiffness (low = soft)', 5, 4000, 1), Ctl('gap', 'Closest the coils get (re-forms)', 0.02, 0.3, 0.005), Ctl('arch', 'Coils on the arch at the start (re-forms)', 3, 14, 1), Ctl('pack', 'Spacing in the stack (re-forms)', 0.1, 0.6, 0.01), Ctl('archW', 'Arch width (re-forms)', 1, 4, 0.1), Ctl('archH', 'Arch height (re-forms)', 0.5, 3, 0.1), Ctl('coils', 'Coils (re-forms)', 8, 40, 1), Ctl('size', 'Coil radius (re-forms)', 0.05, 0.14, 0.005)] },
        { name: 'Rings', items: [Ctl('lean', 'Most a ring may lean off the path (deg)', 15, 85, 1), Ctl('leanK', 'How hard that limit is held', 0.05, 3, 0.05), Ctl('square', 'Rings square to the path (they lean down a bend)', 0, 2, 0.05), Ctl('shear', 'Diagonal wire (tension squares the rings)', 0, 3, 0.05), Ctl('wireDamp', 'Wire damping', 0, 60, 1), Ctl('contact', 'Ring on ring stiffness', 5, 80, 1), Ctl('contactDamp', 'Ring on ring damping', 0, 1.5, 0.02), Ctl('inertia', 'Ring inertia', 0.1, 2, 0.05), Ctl('spin', 'Spin damping', 0, 10, 0.1), Ctl('endFlat', 'End rings lie flat', 0, 3, 0.05), Ctl('capInertia', 'Weight of the cap rings (to turn over)', 1, 12, 0.5)] },
        { name: 'World', items: [Ctl('gravity', 'Gravity', 4, 60, 1), Ctl('grip', 'Friction of the steps', 0, 1.5, 0.05), Ctl('bounce', 'Bounce off the steps', 0.05, 0.95, 0.01), Ctl('damping', 'Air drag', 0, 4, 0.05), Ctl('stepW', 'Step width (re-forms)', 3, 14, 0.1), Ctl('drop', 'Step drop (re-forms)', 0.4, 2.5, 0.05)] },
        { name: 'Touch', items: [Ctl('push', 'Tap push', 0, 3, 0.05)] },
        { name: 'View', items: [Ctl('wire', 'Wire thickness', 0.02, 0.2, 0.005), Ctl('yaw', 'Turn (degrees)', 0, 90, 1), Ctl('pitch', 'Tilt (degrees)', 0, 70, 1)] },
      ],
      actions: { 'Nudge it': () => tapImpulse(0, P.push), 'Re-form': build },
      set(key, value) { P[key] = value; if (key === 'yaw' || key === 'pitch') { V.iso.yaw = P.yaw; V.iso.pitch = P.pitch; V.setView('iso'); } if (['coils', 'size', 'gap', 'arch', 'pack', 'archW', 'archH', 'stepW', 'drop'].includes(key)) build(); },
      reset() { Object.assign(P, DEFAULTS); build(); },
    },
    debug: { cam: () => ({ ...cam }), kick: (i, ax, ay) => ring.impulseAt(i, R * ax, R * ay, R, R * R * P.inertia), run: (n) => { for (let i = 0; i < n; i++) stepAll(); draw(); }, state: () => ({ N, R, px: Array.from(px), py: Array.from(py), stepW, Hs }), nudge: (f = 1) => tapImpulse(0, f), ring: () => ring },
    destroy() { offs.forEach((f) => f()); },
  };
}
