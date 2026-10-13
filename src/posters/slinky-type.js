// Slinky type. IDAN SEGEV on an upright backdrop, each letter a condensed slinky stood out from the wall, its solid cap facing you: the type, flat and still. Click a letter and it lets go
// of the wall, drops onto the ledge in front and bounces there. Click it again and it is pushed off the ledge and falls off the screen; a moment later it is back on the wall.
// (After Idan's sketch, 13 Oct 2026.) The same rigid-ring solver and settings as the other Slinky scenes (slinky-rings.js, slinky-params.js), one chain for each letter, each in its own
// vertical plane running out from the wall toward you. Drag empty space to turn the view, keys 1 to 6 for the views, X puts every letter back on the wall, L locks the camera.
// One colour: black on white, white on black on every second shuffle.

import { createRings, trackHand } from './slinky-rings.js';
import { SHARED_DEFAULTS, POSTER_DEFAULTS, bindParams } from './slinky-params.js';
import { ringShape } from './slinky-shape.js';
import { createView } from './slinky-view.js';
import { createReveal, ink as rvInk, grid, corners, label, titleBlock } from './reveal.js';
import { TAP } from '../gestures.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TH = -Math.PI / 2;                       // every chain runs along -z: out of the wall, toward you

export function mount(stage) {
  const ctx = stage.canvas.getContext('2d');
  const dark = !!stage.flip;
  const ink = dark ? '#fff' : '#000', paper = dark ? '#000' : '#fff';
  stage.setBackdrop(dark ? 0 : 1);
  const offs = [];

  const shared = { ...SHARED_DEFAULTS, ...POSTER_DEFAULTS };                      // Idan's tuned Slinky: the rings, the wire, the contact, gravity and friction (13 Oct 2026)
  const OWN = { coils: 12, ledge: 2.6, push: 8.5 };                                // rings in a letter; how deep the ledge is (radii); how hard the second click shoves it (radii per second)
  const DEFAULTS = { ...shared, ...OWN };
  const P = bindParams(shared, OWN);
  const V = createView(stage, { yaw: 50, pitch: 20 }); V.setView('iso');          // Idan's camera for the Slinky (13 Oct 2026)

  let W = 1, H = 1, R = 40, rw = 3, wallW = 1, wallH = 1, acc = 0;
  let auto = null, letters = [], cam = { x: 0, y: 0 }, pid = null, down = null, orbiting = false, grab = null;

  // the plane: x across the wall, y up, z toward the viewer is -z; the wall stands at z = 0, the ledge top is y = 0
  const edge = () => P.ledge * R;
  const floorNow = () => [[-1e5, edge(), 0], [-1e5, 0, 1e5]];                         // in a chain's own coordinates: lx runs out from the wall; the ledge ends at its front edge; the wall is a tall box behind lx = 0
  const wp = (L, lx, y, d) => [L.X + d, y, -lx];

  function poseWall(L) {                                                            // the condensed stack, rings upright, the head ring (0) farthest from the wall and facing you
    const N = L.N, sp = (R * P.gap + rw) * 1.3;
    for (let i = 0; i < N; i++) { const k = N - 1 - i; L.ring.x[i] = rw + k * sp; L.ring.y[i] = L.Y; L.ring.a[i] = Math.PI / 2; L.ring.vx[i] = L.ring.vy[i] = L.ring.w[i] = 0; }
    L.ring.n = N; L.ring.setCaps(P.capInertia);
    L.state = 'wall'; L.clicks = 0; L.awake = false; L.q = 0; L.f = 0; L.snap = null; L.hand = null;
  }

  // the backdrop and the ledge, centred and fitted on the screen whatever the view
  const corners3 = () => { const E = edge(), T = R * 0.9; return [[-wallW, 0, 0], [wallW, 0, 0], [wallW, wallH, 0], [-wallW, wallH, 0], [-wallW, 0, -E], [wallW, 0, -E], [wallW, -T, -E], [-wallW, -T, -E]]; };
  function origin2(r) {
    const [ox0, oy0] = V.origin(r, cam, W, H); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const c of corners3()) { const q = V.project(c, r, ox0, oy0); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    return [ox0 + W / 2 - (x0 + x1) / 2, oy0 + (H - 40) / 2 - (y0 + y1) / 2, x1 - x0, y1 - y0];
  }
  function fit() { const r = V.rot(), [, , w, h] = origin2(r), f = Math.min(0.92 * W / (w / r.z), 0.8 * H / (h / r.z)) / (r.z / V.zoomMul); V.zoomMul += (f - V.zoomMul) * 0.15; }
  function layout() {
    W = stage.W; H = stage.H;
    const portrait = W / H < 0.85, rows = portrait ? ['IDAN', 'SE', 'GEV'] : ['IDAN', 'SEGEV'], colK = 2.6, rowK = 3.7, maxRow = Math.max(...rows.map((r) => r.length));
    R = Math.min(W * 0.78 / (maxRow * colK), H * 0.62 / (rows.length * rowK + 1.6), Math.min(W, H) * 0.11 * 1.6);
    rw = Math.max(2, R * P.wire * 0.5);
    wallW = (maxRow * colK + 1.2) * R / 2; wallH = (rows.length * rowK + 0.8) * R;
    letters = [];
    rows.forEach((row, k) => {
      [...row].forEach((ch, j) => {
        const X = (j - (row.length - 1) / 2) * R * colK, N = Math.round(P.coils), L = { ch, X, Y: R * 1.3 + (rows.length - 1 - k) * R * rowK + R * 0.9, ring: createRings(N + 2), N, shape: ringShape(ch), hand: null, awake: false };
        poseWall(L); letters.push(L);
      });
    });
    cam = { x: 0, y: wallH * 0.42 }; grab = null; auto = null;
    for (let i = 0; i < 60; i++) fit();                                                                  // frame it at once
  }

  function envNow() {
    const k = P.spring, kw = k * 60, kc = k * P.contact, e = clamp(P.bounce, 0.02, 0.98), zeta = -Math.log(e) / Math.sqrt(Math.PI * Math.PI + Math.log(e) ** 2), dmin = R * P.gap + rw, I = R * R * P.inertia, kl = k * R * R * P.leanK;
    return { R, g: P.gravity * R, k, kd: P.shear * k, l0: Math.hypot(2 * R, dmin), cw: P.wireDamp, kc, cc: 2 * Math.sqrt(kc) * P.contactDamp, dmin, rw, kw, cwall: 2 * zeta * Math.sqrt(kw), mu: P.grip, cf: 60, inertia: P.inertia, lean: P.lean * Math.PI / 180,
      kl, kla: 2 * Math.sqrt(kl * I) * 0.5, endFlat: kl * P.endFlat, square: P.square, bend: P.bend, turn: P.turn, turnReach: P.turnReach, turnDelay: P.turnDelay, wdamp: P.spin, air: P.damping, reach: 5, boxes: floorNow(), grab: null };
  }
  // A letter at rest does not move: it starts asleep on the wall, wakes when it is clicked, and sleeps again once its rings have stayed put for 1.5 s.
  const wake = (L) => { L.awake = true; L.q = 0; L.f = 0; L.snap = null; };
  function restCheck(L) {
    if (++L.f % 30) return;
    const a = new Float32Array(L.ring.n * 2); for (let i = 0; i < L.ring.n; i++) { a[2 * i] = L.ring.x[i]; a[2 * i + 1] = L.ring.y[i]; }
    if (L.snap) { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - L.snap[i])); if (m < 0.5) { if (++L.q >= 3) { L.awake = false; L.ring.vx.fill(0); L.ring.vy.fill(0); L.ring.w.fill(0); } } else L.q = 0; }
    L.snap = a;
  }
  function stepAll() {
    const env = envNow(), h = 1 / 960;
    if (auto) {
      auto.t += 1 / 60; const u = Math.min(1, auto.t / 1.1);                      // the second click: a hand takes the head ring and carries it out over the edge
      grab = { L: auto.L, x: auto.x0 + R * P.push * u, y: auto.y0 + R * 0.7 * Math.sin(Math.min(1, u * 1.3) * Math.PI) };
      if (auto.t > 1.2) { grab = null; auto = null; }
    }
    for (const L of letters) {
      if (!L.awake) continue;
      env.grab = grab && grab.L === L ? (() => { const g = L.hand || (L.hand = { pt: 0 }); g.x = grab.x; g.y = grab.y; trackHand(g, g.x, g.y, 1 / 60); return g; })() : null;
      for (let s = 0; s < 16; s++) L.ring.step(h, env);
      if (!(grab && grab.L === L)) restCheck(L); else L.q = 0;
      let top = -1e9; for (let i = 0; i < L.ring.n; i++) top = Math.max(top, L.ring.y[i]);
      if (top < -R * 9) poseWall(L);                                              // it has fallen off the screen: back on the wall
    }
  }

  // ---------- drawing ----------
  function draw() {
    V.ease(); fit();
    ctx.setTransform(stage.pw / W, 0, 0, stage.ph / H, 0, 0);
    ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H);
    const r = V.rot(), [ox, oy] = origin2(r), T = R * 0.9, E = edge();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = ink; ctx.fillStyle = paper; ctx.lineWidth = Math.max(1.2, R * 0.03);
    const quad = (pts) => { ctx.beginPath(); pts.forEach((q, i) => { const s2 = V.project(q, r, ox, oy); i ? ctx.lineTo(s2[0], s2[1]) : ctx.moveTo(s2[0], s2[1]); }); ctx.closePath(); ctx.fill(); ctx.stroke(); };
    quad([[-wallW, 0, 0], [wallW, 0, 0], [wallW, wallH, 0], [-wallW, wallH, 0]]);                                   // the backdrop, upright
    quad([[-wallW, 0, 0], [wallW, 0, 0], [wallW, 0, -E], [-wallW, 0, -E]]);                                          // the ledge: its top,
    quad([[-wallW, 0, -E], [wallW, 0, -E], [wallW, -T, -E], [-wallW, -T, -E]]);                                     // its front,
    quad([[wallW, 0, 0], [wallW, 0, -E], [wallW, -T, -E], [wallW, -T, 0]]);                                          // and its end
    ctx.lineWidth = Math.max(1.3, R * P.wire);
    const items = [];
    for (const L of letters) for (let i = 0; i < L.ring.n; i++) items.push({ L, i, z: V.project(wp(L, L.ring.x[i], L.ring.y[i], 0), r, 0, 0)[2] });
    items.sort((a, b) => a.z - b.z);
    for (const { L, i } of items) {
      const a = L.ring.a[i], ux = Math.cos(a), uy = Math.sin(a), cx = L.ring.x[i], cy = L.ring.y[i];
      ctx.beginPath();
      for (const loop of L.shape) {
        for (let k = 0; k <= loop.length; k++) { const pt = loop[k % loop.length], q = V.project(wp(L, cx + ux * pt[0] * R, cy + uy * pt[0] * R, pt[1] * R), r, ox, oy); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
      }
      ctx.fillStyle = ink; if (i === 0) ctx.fill('evenodd');                      // the head ring is a solid cap: the letter itself; the rest of the coil is wire
      ctx.stroke();
    }
  }

  // Reveal (three quick taps): the page inverts and every letter shows what it is: the spine through its ring centres, a tick for each ring's tilt, its head ring ringed.
  const rv = createReveal(stage, (c, W_, H_, k) => {
    const col = (a) => rvInk(stage, a), r = V.rot(), [ox, oy] = origin2(r);
    grid(c, W_, H_, 24, col, k); corners(c, W_, H_, 16, col, k);
    let rings = 0;
    for (const L of letters) {
      const pts = []; rings += L.ring.n;
      for (let i = 0; i < L.ring.n; i++) pts.push(V.project(wp(L, L.ring.x[i], L.ring.y[i], 0), r, ox, oy));
      c.strokeStyle = col(0.9 * k); c.lineWidth = 1; c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke();
      for (let i = 0; i < L.ring.n; i++) {
        const a = L.ring.a[i], q = pts[i], e = V.project(wp(L, L.ring.x[i] + Math.cos(a) * R * 0.5, L.ring.y[i] + Math.sin(a) * R * 0.5, 0), r, ox, oy);
        c.strokeStyle = col(0.7 * k); c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(e[0], e[1]); c.stroke();
        c.fillStyle = col(0.9 * k); c.beginPath(); c.arc(q[0], q[1], 2, 0, 7); c.fill();
      }
      c.strokeStyle = col(k); c.lineWidth = 1.4; c.beginPath(); c.arc(pts[0][0], pts[0][1], 9, 0, 7); c.stroke();
      label(c, L.ch, pts[0][0] + 13, pts[0][1] - 10, col, k);
    }
    titleBlock(c, W_, H_, ['SLINKY TYPE · STRUCTURE', '● ring  ─ spine  ○ head (the cap)', `${letters.length} letters · ${rings} rings`], col, k);
  });

  // ---------- touch: a click lets a letter go, a second one pushes it off; empty space turns the view ----------
  const screenOf = (L, i) => { const r = V.rot(), [ox, oy] = origin2(r), q = V.project(wp(L, L.ring.x[i], L.ring.y[i], 0), r, ox, oy); return [q[0], q[1]]; };
  const hit = (q) => {
    let best = null, bd = (R * 1.5 * V.rot().z) ** 2;
    for (const L of letters) for (const i of [0, L.N >> 1, L.N - 1]) { const s = screenOf(L, i), dd = (s[0] - q.x) ** 2 + (s[1] - q.y) ** 2; if (dd < bd) { bd = dd; best = L; } }
    return best;
  };
  function click(L) {
    if (L.clicks === 0) { L.clicks = 1; L.state = 'drop'; wake(L); }                                       // let go of the wall: it drops onto the ledge and bounces
    else if (L.clicks === 1) {                                                                              // pushed off the ledge: a shove along it and a small hop, so it goes over the edge and falls off the screen
      L.clicks = 2; L.state = 'push'; wake(L);
      for (let i = 0; i < L.ring.n; i++) { L.ring.vx[i] += R * P.push; L.ring.vy[i] += R * 2.2; L.ring.w[i] += 2; }
    }
  }
  offs.push(stage.on('down', (q, e) => { if (pid !== null) return; pid = e.pointerId; down = { x: q.x, y: q.y, t: performance.now() }; orbiting = false; grab = hit(q); }));
  offs.push(stage.on('move', (q, e) => {
    if (e.pointerId !== pid) return;
    if (down && !orbiting && Math.hypot(q.x - down.x, q.y - down.y) > 10) { orbiting = true; V.orbit.start(down); }
    if (orbiting) V.orbit.move(q);
  }));
  offs.push(stage.on('up', (q, e) => {
    if (e.pointerId !== pid) return;
    if (!orbiting && grab && performance.now() - down.t < TAP.ms && Math.hypot(q.x - down.x, q.y - down.y) < TAP.px) click(grab);
    if (orbiting) V.orbit.end(); grab = null; down = null; orbiting = false; pid = null;
  }));
  const onKey = (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'x' || e.key === 'X') layout(); else if (e.key === 'l' || e.key === 'L') V.lock = !V.lock;
  };
  addEventListener('keydown', onKey);
  offs.push(stage.on('resize', layout));
  layout();
  offs.push(stage.frame((dt) => { acc = Math.min(acc + dt, 0.05); while (acc >= 1 / 60) { acc -= 1 / 60; stepAll(); } draw(); rv.draw(); }));

  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  return {
    tune: {
      title: 'Slinky type', values: P, defaults: DEFAULTS,
      groups: [
        { name: 'Scene', items: [Ctl('ledge', 'How deep the ledge is (radii, re-forms)', 1.2, 5, 0.1), Ctl('push', 'How hard the second click shoves (radii / s)', 3, 16, 0.1), Ctl('coils', 'Rings in a letter (re-forms)', 4, 40, 1), Ctl('gap', 'Closest the coils get (re-forms)', 0.02, 0.3, 0.005), Ctl('wire', 'Wire thickness', 0.02, 0.2, 0.005)] },
        { name: 'Rings', items: [Ctl('lean', 'Most a ring may lean off the path (deg)', 15, 85, 1), Ctl('leanK', 'How hard that limit is held', 0.05, 3, 0.05), Ctl('square', 'Rings square to the path', 0, 2, 0.05), Ctl('spring', 'Wire stiffness', 5, 4000, 1), Ctl('inertia', 'Ring inertia', 0.1, 2, 0.05)] },
        { name: 'World', items: [Ctl('gravity', 'Gravity', 4, 60, 1), Ctl('grip', 'Friction', 0, 1.5, 0.05), Ctl('bounce', 'Bounce', 0.05, 0.95, 0.01), Ctl('damping', 'Air drag', 0, 4, 0.05)] },
      ],
      actions: { 'X  Put them back on the wall': layout, 'L  Lock the camera': () => { V.lock = !V.lock; } },
      set(key, value) { P[key] = value; if (['coils', 'size', 'gap', 'wire', 'ledge'].includes(key)) layout(); },
      reset() { Object.assign(P, DEFAULTS); layout(); },
    },
    debug: { run: (n) => { for (let i = 0; i < n; i++) stepAll(); draw(); }, letters: () => letters, V, click: (i) => click(letters[i]), tap: (i) => click(letters[i]) },
    destroy() { removeEventListener('keydown', onKey); rv.destroy(); offs.forEach((f) => f()); V.destroy(); stage.setBackdrop(null); },
  };
}
