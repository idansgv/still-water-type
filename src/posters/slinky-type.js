// Slinky type. IDAN SEGEV laid across the plane the way the other posters lay it (IDAN / SEGEV, three rows on a phone), each letter a slinky standing on its end: a stack of rings in
// the shape of the letter, read from above (the top view). Tap one and it is kicked over and walks off its place; drag its top ring and carry it over to flip it; drag empty space to turn the
// view, keys 1 to 6 for the views, X stands them all up again, L locks the camera. The same rigid-ring solver and the same settings as the other Slinky scenes (slinky-rings.js,
// slinky-params.js), one chain for each letter, each on its own line of the plane.
// One colour: black on white, white on black on every second shuffle.

import { createRings, trackHand } from './slinky-rings.js';
import { SHARED_DEFAULTS, bindParams } from './slinky-params.js';
import { ringShape } from './slinky-shape.js';
import { createView } from './slinky-view.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function mount(stage) {
  const ctx = stage.canvas.getContext('2d');
  const dark = !!stage.flip;
  const ink = dark ? '#fff' : '#000', paper = dark ? '#000' : '#fff';
  stage.setBackdrop(dark ? 0 : 1);
  const offs = [];

  const shared = { ...SHARED_DEFAULTS, size: 0.06, wire: 0.05, gap: 0.12, gravity: 22.5, turn: 4 };
  const OWN = { coils: 14, lean0: 0.004 };            // rings in a letter; the lean it starts with (a letter stands almost straight)
  const DEFAULTS = { ...shared, ...OWN };
  const P = bindParams(shared, OWN);
  const V = createView(stage, { yaw: 0, pitch: 89 }); V.setView('top');

  let W = 1, H = 1, R = 40, rw = 3;
  let auto = null, letters = [], cam = { x: 0, y: -40 }, grab = null, pid = null, down = null, orbiting = false, acc = 0;
  const FLOOR = [[-1e5, 1e5, 0]];

  function layout() {
    W = stage.W; H = stage.H;
    const portrait = W / H < 0.85, rows = portrait ? ['IDAN', 'SE', 'GEV'] : ['IDAN', 'SEGEV'];
    const padX = Math.max(14, W * 0.045), top = Math.max(18, H * 0.04), bottom = 96, availW = W - 2 * padX, availH = H - top - bottom, colK = 2.3, rowK = 2.3;
    R = Math.min(availW / (Math.max(...rows.map((r) => r.length)) * colK), availH / (rows.length * rowK), Math.min(W, H) * P.size * 1.6);
    rw = Math.max(2, R * P.wire * 0.5);
    letters = [];
    rows.forEach((row, k) => {
      const Z = ((rows.length - 1) / 2 - k) * R * rowK;
      [...row].forEach((ch, j) => {
        const X = (j - (row.length - 1) / 2) * R * colK, N = Math.round(P.coils), ring = createRings(N + 2), sp = (R * P.gap + rw) * 1.3;
        for (let i = 0; i < N; i++) { const k2 = N - 1 - i; ring.x[i] = k2 * R * P.lean0 * (0.6 + Math.random() * 0.8); ring.y[i] = rw + k2 * sp; ring.a[i] = 0; ring.vx[i] = ring.vy[i] = ring.w[i] = 0; }
        ring.n = N; ring.setCaps(P.capInertia);
        letters.push({ ch, X, Z, ring, N, shape: ringShape(ch, { top: true }), hand: null, th: 0 });
      });
    });
    cam = { x: 0, y: 0 }; grab = null;
  }

  // a letter's chain lives in a vertical plane turned th about the vertical axis; lx along it, d across it
  const wp = (L, lx, y, d) => { const c = Math.cos(L.th), s = Math.sin(L.th); return [L.X + c * lx - s * d, y, L.Z + s * lx + c * d]; };
  const standing = (L) => { let a = 1e9, b = -1e9; for (let i = 0; i < L.N; i++) { a = Math.min(a, L.ring.x[i]); b = Math.max(b, L.ring.x[i]); } return b - a < R * 1.5 && L.ring.y[0] > L.N * R * 0.12; };
  function envNow() {
    const k = P.spring, kw = k * 60, kc = k * P.contact, e = clamp(P.bounce, 0.02, 0.98), zeta = -Math.log(e) / Math.sqrt(Math.PI * Math.PI + Math.log(e) ** 2), dmin = R * P.gap + rw, I = R * R * P.inertia, kl = k * R * R * P.leanK;
    return { R, g: P.gravity * R, k, kd: P.shear * k, l0: Math.hypot(2 * R, dmin), cw: P.wireDamp, kc, cc: 2 * Math.sqrt(kc) * P.contactDamp, dmin, rw, kw, cwall: 2 * zeta * Math.sqrt(kw), mu: P.grip, cf: 60, inertia: P.inertia, lean: P.lean * Math.PI / 180,
      kl, kla: 2 * Math.sqrt(kl * I) * 0.5, endFlat: kl * P.endFlat, square: P.square, bend: P.bend, turn: P.turn, turnReach: P.turnReach, turnDelay: P.turnDelay, wdamp: P.spin, air: P.damping, reach: 5, boxes: FLOOR, grab: null };
  }
  function stepAll() {
    const env = envNow(), h = 1 / 960;
    if (auto) { auto.t += 1 / 60; const u = Math.min(1, auto.t / 1.1); grab = { L: auto.L, x: auto.x0 + auto.dir * R * 2.4 * u, y: auto.y0 + R * 0.7 * Math.sin(Math.min(1, u * 1.3) * Math.PI) }; if (auto.t > 1.2) { grab = null; auto = null; } }
    for (const L of letters) {
      env.grab = grab && grab.L === L ? (() => { const g = L.hand || (L.hand = { pt: 0 }); g.x = grab.x; g.y = grab.y; trackHand(g, g.x, g.y, 1 / 60); return g; })() : null;
      for (let s = 0; s < 16; s++) L.ring.step(h, env);
    }
  }

  // ---------- drawing ----------
  function draw() {
    V.ease();
    ctx.setTransform(stage.pw / W, 0, 0, stage.ph / H, 0, 0);
    ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H);
    const r = V.rot(), [ox, oy] = V.origin(r, cam, W, H);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = ink;
    ctx.lineWidth = 1; ctx.globalAlpha = 0.25;                                // the plane: an outline, so that turning the view shows it
    ctx.beginPath(); for (const [x, z] of [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2], [-W / 2, -H / 2]]) { const q = V.project([x, 0, z], r, ox, oy); ctx.lineTo(q[0], q[1]); } ctx.stroke(); ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(1.3, R * P.wire);
    const items = [];
    for (const L of letters) for (let i = 0; i < L.ring.n; i++) items.push({ L, i, z: V.project(wp(L, L.ring.x[i], L.ring.y[i], 0), r, 0, 0)[2] });
    items.sort((a, b) => a.z - b.z);
    for (const { L, i } of items) {
      const a = L.ring.a[i], ux = Math.cos(a), uy = Math.sin(a), cx = L.ring.x[i], cy = L.ring.y[i];
      ctx.beginPath();
      if (L.shape) for (const loop of L.shape) {
        for (let k = 0; k <= loop.length; k++) { const pt = loop[k % loop.length], q = V.project(wp(L, cx + ux * pt[0] * R, cy + uy * pt[0] * R, pt[1] * R), r, ox, oy); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
      } else for (let k = 0; k <= 36; k++) { const t = k / 36 * Math.PI * 2, q = V.project(wp(L, cx + ux * Math.cos(t) * R, cy + uy * Math.cos(t) * R, Math.sin(t) * R), r, ox, oy); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
      ctx.stroke();
    }
  }

  // ---------- touch: a tap kicks a letter over; a drag carries its top ring; empty space turns the view ----------
  const screenOf = (L, i) => { const r = V.rot(), [ox, oy] = V.origin(r, cam, W, H), q = V.project(wp(L, L.ring.x[i], L.ring.y[i], 0), r, ox, oy); return [q[0], q[1]]; };
  const hit = (q) => { let best = null, bd = (R * 1.5 * V.rot().z) ** 2; for (const L of letters) { const s = screenOf(L, 0), dd = (s[0] - q.x) ** 2 + (s[1] - q.y) ** 2; if (dd < bd) { bd = dd; best = L; } } return best; };
  // the point of the horizontal plane at height y under the pointer, as [world x, world z]
  const ground = (q, y) => { const r = V.rot(), [ox, oy] = V.origin(r, cam, W, H); if (Math.abs(r.sx) < 0.2) return null; const a = (q.x - ox) / r.z, z1 = (r.cx * y - (oy - q.y) / r.z) / r.sx; return [r.cy * a - r.sy * z1, r.sy * a + r.cy * z1]; };
  offs.push(stage.on('down', (q, e) => {
    if (pid !== null) return; pid = e.pointerId; down = { x: q.x, y: q.y, t: performance.now() }; orbiting = false;
    const L = hit(q); if (L) grab = { L, x: L.ring.x[0], y: L.ring.y[0], q0: { ...q }, y0: L.ring.y[0], t: performance.now(), free: standing(L), set: false };
  }));
  offs.push(stage.on('move', (q, e) => {
    if (e.pointerId !== pid) return;
    if (grab) {
      const L = grab.L, g = ground(q, grab.y0); if (!g) return;
      if (grab.free && !grab.set && Math.hypot(q.x - grab.q0.x, q.y - grab.q0.y) > 8) { L.th = Math.atan2(g[1] - L.Z, g[0] - L.X); grab.set = true; }   // a standing letter falls the way it is pulled
      const c = Math.cos(L.th), s = Math.sin(L.th); grab.x = (g[0] - L.X) * c + (g[1] - L.Z) * s; grab.y = grab.y0 + R * 0.7 * Math.sin(Math.min(1, Math.abs(grab.x - L.ring.x[0]) / (R * 2.4) * 1.3) * Math.PI); return;
    }
    if (down && !orbiting && Math.hypot(q.x - down.x, q.y - down.y) > 10) { orbiting = true; V.orbit.start(down); }
    if (orbiting) V.orbit.move(q);
  }));
  offs.push(stage.on('up', (q, e) => {
    if (e.pointerId !== pid) return;
    if (grab && performance.now() - grab.t < 250 && Math.hypot(q.x - grab.q0.x, q.y - grab.q0.y) < 8) { if (standing(grab.L)) grab.L.th = Math.random() * Math.PI * 2; auto = { L: grab.L, t: 0, dir: 1, x0: grab.L.ring.x[0], y0: grab.L.ring.y[0] }; }   // a tap: the head ring is lifted and carried over by itself
    if (orbiting) V.orbit.end(); grab = null; down = null; orbiting = false; pid = null;
  }));
  const onKey = (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'x' || e.key === 'X') layout(); else if (e.key === 'l' || e.key === 'L') V.lock = !V.lock;
  };
  addEventListener('keydown', onKey);
  offs.push(stage.on('resize', layout));
  layout();
  offs.push(stage.frame((dt) => { acc = Math.min(acc + dt, 0.05); while (acc >= 1 / 60) { acc -= 1 / 60; stepAll(); } draw(); }));

  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  return {
    tune: {
      title: 'Slinky type', values: P, defaults: DEFAULTS,
      groups: [
        { name: 'Letters', items: [Ctl('coils', 'Rings in a letter (re-forms)', 4, 40, 1), Ctl('lean0', 'Lean at the start (re-forms)', 0, 0.1, 0.002), Ctl('size', 'Size', 0.02, 0.14, 0.005), Ctl('wire', 'Wire thickness', 0.02, 0.2, 0.005)] },
        { name: 'Rings', items: [Ctl('lean', 'Most a ring may lean off the path (deg)', 15, 85, 1), Ctl('leanK', 'How hard that limit is held', 0.05, 3, 0.05), Ctl('square', 'Rings square to the path', 0, 2, 0.05), Ctl('spring', 'Wire stiffness', 5, 4000, 1), Ctl('gap', 'Closest coils (radii, re-forms)', 0.02, 0.5, 0.005), Ctl('wireDamp', 'Wire damping', 0, 60, 0.5), Ctl('contact', 'Ring on ring stiffness', 5, 80, 1), Ctl('inertia', 'Ring inertia', 0.1, 2, 0.05), Ctl('spin', 'Spin damping', 0, 10, 0.1), Ctl('endFlat', 'End rings lie flat', 0, 3, 0.05), Ctl('capInertia', 'Weight of the cap rings', 1, 12, 0.5)] },
        { name: 'World', items: [Ctl('gravity', 'Gravity', 4, 60, 1), Ctl('grip', 'Friction', 0, 1.5, 0.05), Ctl('bounce', 'Bounce', 0.05, 0.95, 0.01), Ctl('damping', 'Air drag', 0, 4, 0.05)] },
        { name: 'Hand', items: [Ctl('turn', 'The ring in hand turns with the move', 0, 14, 0.1), Ctl('turnReach', 'Rings it carries along', 0, 30, 1), Ctl('turnDelay', 'How late each is (frames)', 0, 8, 1)] },
      ],
      actions: { 'X  Stand them up': layout, 'L  Lock the camera': () => { V.lock = !V.lock; } },
      set(key, value) { P[key] = value; if (['coils', 'lean0', 'size', 'gap', 'wire'].includes(key)) layout(); },
      reset() { Object.assign(P, DEFAULTS); layout(); },
    },
    debug: { run: (n) => { for (let i = 0; i < n; i++) stepAll(); draw(); }, letters: () => letters, V, tap: (i) => { auto = { L: letters[i], t: 0, dir: 1, x0: letters[i].ring.x[0], y0: letters[i].ring.y[0] }; } },
    destroy() { removeEventListener('keydown', onKey); offs.forEach((f) => f()); V.destroy(); stage.setBackdrop(null); },
  };
}
