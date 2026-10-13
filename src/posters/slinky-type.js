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

  const shared = { ...SHARED_DEFAULTS, ...POSTER_DEFAULTS, spring: 958, gravity: 23, bounce: 0.81, inertia: 0.3 };   // Idan's tuned Slinky: the rings, the wire, the contact, gravity and friction (14 Oct 2026)
  const OWN = { coils: 20, ledge: 10, bump: 2.9, push: 9.5, pull: 1.7, pull2: 2.8 };                      // rings in a letter; how deep the ledge is; how far the first and the second bump carry the head (radii)
  const CAM = { yaw: 20, pitch: 10, zoom: 1, panX: 0, panY: 0 };                                    // Idan's camera (14 Oct 2026); zoom and pan are a multiplier on the fitted scene and a share of the screen
  const DEFAULTS = { ...shared, ...OWN, ...CAM };
  const P = bindParams(shared, OWN);
  const V = createView(stage, { yaw: CAM.yaw, pitch: CAM.pitch }); V.setView('iso');
  const cam3 = { zoom: CAM.zoom, panX: CAM.panX, panY: CAM.panY };
  const camGet = { yaw: () => V.target.yaw, pitch: () => V.target.pitch, zoom: () => cam3.zoom, panX: () => cam3.panX, panY: () => cam3.panY };
  const camSet = { yaw: (v) => { V.target.yaw = v; V.name = 'custom'; }, pitch: (v) => { V.target.pitch = v; V.name = 'custom'; }, zoom: (v) => { cam3.zoom = v; }, panX: (v) => { cam3.panX = v; }, panY: (v) => { cam3.panY = v; } };
  for (const k of Object.keys(CAM)) Object.defineProperty(P, k, { enumerable: true, get: camGet[k], set: camSet[k] });   // the camera is part of the settings: it is copied with them
  const setCamera = (c) => { for (const k of Object.keys(CAM)) camSet[k](c[k]); };

  let W = 1, H = 1, R = 40, rw = 3, wallW = 1, wallH = 1, acc = 0;
  let hand = null, letters = [], cam = { x: 0, y: 0 }, pid = null, down = null, orbiting = false, pressed = null;

  // the plane: x across the wall, y up, z toward the viewer is -z; the wall stands at z = 0, the ledge top is y = 0
  const edge = () => P.ledge * R;
  const floorNow = () => [[-1e5, edge(), 0], [-1e5, 0, 1e5]];                         // in a chain's own coordinates: lx runs out from the wall; the ledge ends at its front edge; the wall is a tall box behind lx = 0
  const wp = (L, lx, y, d) => [L.X + d, y, -lx];

  function poseWall(L) {                                                            // the condensed stack, rings upright, the head ring (0) farthest from the wall and facing you
    const N = L.N, sp = (R * P.gap + rw) * 1.3;
    for (let i = 0; i < N; i++) { const k = N - 1 - i; L.ring.x[i] = rw + k * sp; L.ring.y[i] = L.Y; L.ring.a[i] = Math.PI / 2; L.ring.vx[i] = L.ring.vy[i] = L.ring.w[i] = 0; }
    L.S0 = (N - 1) * sp; L.ring.n = N; L.ring.setCaps(P.capInertia);
    L.state = 'wall'; L.open = 0; L.clicks = 0; L.awake = false; L.q = 0; L.f = 0; L.snap = null; L.hand = null;
  }

  // the backdrop and the ledge, centred and fitted on the screen whatever the view
  const corners3 = () => { const E = edge(), T = R * 0.9; return [[-wallW, 0, 0], [wallW, 0, 0], [wallW, wallH, 0], [-wallW, wallH, 0], [-wallW, 0, -E], [wallW, 0, -E], [wallW, -T, -E], [-wallW, -T, -E]]; };
  function origin2(r) {
    const [ox0, oy0] = V.origin(r, cam, W, H); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const c of corners3()) { const q = V.project(c, r, ox0, oy0); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    return [ox0 + W / 2 - (x0 + x1) / 2 + cam3.panX * W, oy0 + (H - 40) / 2 - (y0 + y1) / 2 + cam3.panY * H, x1 - x0, y1 - y0];
  }
  function fit() { const r = V.rot(), [, , w, h] = origin2(r), f = Math.min(0.92 * W / (w / r.z), 0.8 * H / (h / r.z)) / (r.z / V.zoomMul) * cam3.zoom; V.zoomMul += (f - V.zoomMul) * 0.15; }
  function layout() {
    W = stage.W; H = stage.H;
    const portrait = W / H < 0.85, rows = portrait ? ['IDAN', 'SE', 'GEV'] : ['IDAN', 'SEGEV'], rowK = 3.7;
    const ext = (ch) => { let lo = 1e9, hi = -1e9; for (const loop of ringShape(ch) || []) for (const pt of loop) { lo = Math.min(lo, pt[1]); hi = Math.max(hi, pt[1]); } return lo > hi ? [-1, 1] : [lo, hi]; };   // a letter's width, across the wall, in radii
    const GAP = 0.5;                                                                                     // the same space between every pair of letters (not the same pitch): even colour
    const rowW = (row) => [...row].reduce((a, ch) => a + ext(ch)[1] - ext(ch)[0], 0) + GAP * (row.length - 1), maxW = Math.max(...rows.map(rowW));
    R = Math.min(W * 0.78 / maxW, H * 0.62 / (rows.length * rowK + 1.6), Math.min(W, H) * 0.11 * 1.6);
    rw = Math.max(2, R * P.wire * 0.5);
    wallW = (maxW + 1.2) * R / 2; wallH = (rows.length * rowK + 0.8) * R;
    letters = [];
    rows.forEach((row, k) => {
      const gap = GAP; let x = -rowW(row) / 2;
      [...row].forEach((ch, j) => {
        const [lo, hi] = ext(ch), X = (x - lo) * R, N = Math.round(P.coils), L = { ch, X, Y: R * 1.3 + (rows.length - 1 - k) * R * rowK + R * 0.9, ring: createRings(N + 2), N, shape: ringShape(ch), hand: null, awake: false, fade: 1 };
        x += hi - lo + gap;
        poseWall(L); letters.push(L);
      });
    });
    cam = { x: 0, y: wallH * 0.42 }; hand = null; pressed = null;
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
    if (hand && hand.auto) {                                                       // a bump also takes the cap and pulls it ahead for a moment, so the spring opens, then lets go
      hand.t += 1 / 60; const u = Math.min(1, hand.t / 0.32), e = u * u * (3 - 2 * u);
      hand.x = hand.x0 + R * hand.pull * e; hand.y = hand.y0 + R * 0.5 * Math.sin(u * Math.PI);
      if (hand.t > 0.34) { hand.L.state = 'free'; hand = null; }
    }
    for (const L of letters) {
      if (L.fade < 1) L.fade = Math.min(1, L.fade + 1 / 60 / 1.6);
      if (!L.awake) continue;
      env.grab = hand && hand.L === L ? (() => { const g = L.hand || (L.hand = { pt: 0 }); g.x = hand.x; g.y = hand.y; trackHand(g, g.x, g.y, 1 / 60); return g; })() : null;
      for (let s = 0; s < 16; s++) L.ring.step(h, env);
      for (let i = 0; i < L.ring.n; i++) { const hx = R * Math.abs(Math.cos(L.ring.a[i])) + rw; if (L.ring.x[i] < hx) { L.ring.x[i] = hx; if (L.ring.vx[i] < 0) L.ring.vx[i] = 0; } }   // the wall is solid: no ring goes behind it
      if (!(hand && hand.L === L)) restCheck(L); else L.q = 0;
      let top = -1e9; for (let i = 0; i < L.ring.n; i++) top = Math.max(top, L.ring.y[i]);
      if (top < -R * 9) { poseWall(L); L.fade = 0; }                                              // it has fallen off the screen: back on the wall
    }
  }

  // ---------- drawing ----------
  function draw() {
    V.ease(); fit();
    ctx.setTransform(stage.pw / W, 0, 0, stage.ph / H, 0, 0);
    ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H);
    const r = V.rot(), [ox, oy] = origin2(r), T = R * 0.9, E = edge();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = ink; ctx.fillStyle = paper; ctx.lineWidth = Math.max(1.2, R * 0.03);
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';                                          // the ledge's top: a solid 5% tint; the wall and the ledge's sides are not drawn
    ctx.beginPath(); [[-wallW, 0, 0], [wallW, 0, 0], [wallW, 0, -E], [-wallW, 0, -E]].forEach((q, i) => { const s2 = V.project(q, r, ox, oy); i ? ctx.lineTo(s2[0], s2[1]) : ctx.moveTo(s2[0], s2[1]); }); ctx.closePath(); ctx.fill();
    ctx.fillStyle = paper;
    ctx.lineWidth = Math.max(1.3, R * P.wire);
    const items = [];
    for (const L of letters) for (let i = 0; i < L.ring.n; i++) items.push({ L, i, z: V.project(wp(L, L.ring.x[i], L.ring.y[i], 0), r, 0, 0)[2] });
    items.sort((a, b) => a.z - b.z);
    for (const L of letters) L.open += ((L.awake || hand?.L === L ? 1 : 0) - L.open) * 0.22;   // pressed and held: a letter at rest hides its coil behind the cap; the moment it moves the coil shows
    for (const { L, i } of items) {
      const a = L.ring.a[i], ux = Math.cos(a), uy = Math.sin(a), cx = L.ring.x[0] + (L.ring.x[i] - L.ring.x[0]) * L.open, cy = L.ring.y[0] + (L.ring.y[i] - L.ring.y[0]) * L.open;
      ctx.beginPath();
      for (const loop of L.shape) {
        for (let k = 0; k <= loop.length; k++) { const pt = loop[k % loop.length], q = V.project(wp(L, cx + ux * pt[0] * R, cy + uy * pt[0] * R, pt[1] * R), r, ox, oy); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
      }
      ctx.fillStyle = ink;                                                           // the head ring is a solid cap: the letter itself; the rest of the coil is wire
      const oa = Math.min(1, L.fade / 0.4), fa = Math.min(1, Math.max(0, (L.fade - 0.4) / 0.6)), se = (t) => t * t * (3 - 2 * t);   // back on the wall: the outline fades in first, then the letter fills
      if (i === 0) { ctx.globalAlpha = se(fa); ctx.fill('evenodd'); }
      ctx.globalAlpha = se(oa); ctx.stroke(); ctx.globalAlpha = 1;
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
  // A bump: a shove forward and a small hop, the head ring shoved hardest so the coil opens as it goes. The first click bumps gently (onto the ledge, where it bounces and settles); the
  // second bumps hard (over the edge and off the screen).
  function bump(L, v, pull) {
    wake(L); L.state = 'bump'; L.hand = null;
    const N = L.ring.n;
    if (!hand && pull > 0) hand = { L, auto: true, t: 0, x0: L.ring.x[0], y0: L.ring.y[0], pull, x: L.ring.x[0], y: L.ring.y[0] };
    for (let i = 0; i < N; i++) { const t = i / (N - 1); L.ring.vx[i] += R * v * (1 - 0.45 * t); L.ring.vy[i] += R * 1.6 * (1 - 0.4 * t); }   // the head leads (t = 0), the tail is shoved less: the coil opens and follows
  }
  function click(L) {
    if (L.clicks === 0) { L.clicks = 2; bump(L, P.push, P.pull2); }                                  // one click: the whole arc, over the edge and off the screen, then back on the wall
  }
  // the pointer's place in a letter's own vertical plane (lx out from the wall, y up), or null when that plane is seen edge-on
  function onChain(q, L) {
    const r = V.rot(), [ox, oy] = origin2(r); if (Math.abs(r.sy) < 0.25 || r.cx < 0.2) return null;
    const x1 = (q.x - ox) / r.z, vz = (x1 - r.cy * L.X) / r.sy, z1 = -r.sy * L.X + r.cy * vz, y2 = (oy - q.y) / r.z, vy = (y2 + r.sx * z1) / r.cx;
    return [-vz, vy];
  }
  let panning = null;
  offs.push(stage.on('down', (q, e) => { if (pid !== null) return; pid = e.pointerId; down = { x: q.x, y: q.y, t: performance.now() }; orbiting = false; pressed = hit(q); if (e.shiftKey || e.button === 2) { pressed = null; panning = { x: q.x, y: q.y, px: cam3.panX, py: cam3.panY }; } }));
  const onWheel = (e) => { e.preventDefault(); cam3.zoom = clamp(cam3.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), 0.3, 4); };   // wheel or trackpad pinch: zoom
  stage.root.addEventListener('wheel', onWheel, { passive: false }); offs.push(() => stage.root.removeEventListener('wheel', onWheel));
  const noMenu = (e) => e.preventDefault(); stage.root.addEventListener('contextmenu', noMenu); offs.push(() => stage.root.removeEventListener('contextmenu', noMenu));
  offs.push(stage.on('move', (q, e) => {
    if (e.pointerId !== pid) return;
    if (panning) { cam3.panX = panning.px + (q.x - panning.x) / W; cam3.panY = panning.py + (q.y - panning.y) / H; return; }
    const far = down && Math.hypot(q.x - down.x, q.y - down.y) > TAP.px;
    if (pressed && far && !(hand && !hand.auto)) { const w = onChain(q, pressed); if (w) { wake(pressed); pressed.state = 'held'; hand = { L: pressed, x: w[0], y: w[1] }; } }
    if (hand && !hand.auto) { const w = onChain(q, hand.L); if (w) { hand.x = Math.max(rw * 2, w[0]); hand.y = Math.max(rw * 2, w[1]); } return; }       // the cap follows the pointer
    if (!pressed && down && !orbiting && Math.hypot(q.x - down.x, q.y - down.y) > 10) { orbiting = true; V.orbit.start(down); }
    if (orbiting) V.orbit.move(q);
  }));
  offs.push(stage.on('up', (q, e) => {
    if (e.pointerId !== pid) return;
    if (!(hand && !hand.auto) && !orbiting && pressed && performance.now() - down.t < TAP.ms && Math.hypot(q.x - down.x, q.y - down.y) < TAP.px) click(pressed);
    if (hand && !hand.auto) { hand.L.state = 'drop'; hand.L.clicks = Math.max(hand.L.clicks, 1); wake(hand.L); }                                      // let go of the cap: it falls from where it was held
    panning = null; if (orbiting) V.orbit.end(); if (hand && !hand.auto) hand = null; pressed = null; down = null; orbiting = false; pid = null;
  }));
  const onKey = (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'x' || e.key === 'X') layout(); else if (e.key === 'l' || e.key === 'L') V.lock = !V.lock; else if (e.key === '0') setCamera(CAM); else if (e.key === '=' || e.key === '+') cam3.zoom = clamp(cam3.zoom * 1.15, 0.3, 4); else if (e.key === '-') cam3.zoom = clamp(cam3.zoom / 1.15, 0.3, 4);
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
        { name: 'Scene', items: [Ctl('ledge', 'How deep the ledge is (radii, re-forms)', 1.2, 14, 0.1), Ctl('bump', 'How hard the first bump is (radii / s)', 0.5, 8, 0.1), Ctl('pull', 'How far the first bump pulls the cap ahead (radii)', 0, 4, 0.1), Ctl('pull2', 'How far the second bump pulls it (radii)', 0, 5, 0.1), Ctl('push', 'How hard the second bump is (radii / s)', 3, 18, 0.1), Ctl('coils', 'Rings in a letter (re-forms)', 4, 40, 1), Ctl('gap', 'Closest the coils get (re-forms)', 0.02, 0.3, 0.005), Ctl('wire', 'Wire thickness', 0.02, 0.2, 0.005)] },
        { name: 'Rings', items: [Ctl('lean', 'Most a ring may lean off the path (deg)', 15, 85, 1), Ctl('leanK', 'How hard that limit is held', 0.05, 3, 0.05), Ctl('square', 'Rings square to the path', 0, 2, 0.05), Ctl('spring', 'Wire stiffness', 5, 4000, 1), Ctl('inertia', 'Ring inertia', 0.1, 2, 0.05)] },
        { name: 'World', items: [Ctl('gravity', 'Gravity', 4, 60, 1), Ctl('grip', 'Friction', 0, 1.5, 0.05), Ctl('bounce', 'Bounce', 0.05, 0.95, 0.01), Ctl('damping', 'Air drag', 0, 4, 0.05)] },
        { name: 'Camera', items: [Ctl('yaw', 'Turn (deg)', -90, 90, 1), Ctl('pitch', 'Tilt (deg)', 0, 89, 1), Ctl('zoom', 'Zoom', 0.3, 4, 0.01), Ctl('panX', 'Shift left / right', -0.6, 0.6, 0.005), Ctl('panY', 'Shift up / down', -0.6, 0.6, 0.005)] },
      ],
      actions: {
        'X  Put them back on the wall': layout, 'L  Lock the camera': () => { V.lock = !V.lock; },
        'Face on': () => setCamera({ ...CAM, yaw: 0, pitch: 0 }), 'From above': () => setCamera({ ...CAM, yaw: 25, pitch: 55 }), '0  Default camera': () => setCamera(CAM),
      },
      set(key, value) { P[key] = value; if (['coils', 'size', 'gap', 'wire', 'ledge'].includes(key)) layout(); },
      reset() { Object.assign(P, DEFAULTS); setCamera(CAM); layout(); },
    },
    debug: { run: (n) => { for (let i = 0; i < n; i++) stepAll(); draw(); }, letters: () => letters, V, click: (i) => click(letters[i]), tap: (i) => click(letters[i]) },
    destroy() { removeEventListener('keydown', onKey); rv.destroy(); offs.forEach((f) => f()); V.destroy(); stage.setBackdrop(null); },
  };
}
