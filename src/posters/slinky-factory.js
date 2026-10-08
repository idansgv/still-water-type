// Slinky factory. A machine with a spout turned sideways (a 90 degree elbow). Hold the mouse (or a finger) and it streams coils out
// of the spout, one after another, straight at first and then bending down under their own weight; let go and the cutter snips the
// stream: the loose piece drops, bounces on its springs and piles up on the floor. Real springs: every coil is a point mass joined to
// the next by a zero-length spring (so it stretches a long way and stacks tight), a coil cannot get closer to the next than the
// wire, coils that are not neighbours cannot sit on top of each other (so a pile builds up), the floor grips.
// One colour: black on white, white on black on every second shuffle. Letters come later.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createFactory(stage, V) {
  const ctx = stage.canvas.getContext('2d');
  const dark = !!stage.flip;
  const ink = dark ? '#fff' : '#000', paper = dark ? '#000' : '#fff';
  const offs = [];

  const DEFAULTS = {                                 // Idan's set (9 Oct 2026)
    feed: 560, gravity: 1400, spring: 200,           // how fast coils leave the spout (px/s), gravity (px/s^2), spring stiffness
    gap: 0.02, size: 0.07, tilt: 0.34,               // closest two neighbouring coils get (of the screen height), coil radius (of the shorter side), how round the rings look
    damping: 6.5, loose: 0.12, air: 0.06, grip: 0.5, bounce: 0.55,              // damping along the springs, air drag, how much the floor grips
    keep: 3, longest: 150,                           // pieces kept on the floor, most coils in one piece
    wire: 0.075,                                     // drawn wire thickness (of the coil radius)
  };
  const P = { ...DEFAULTS };

  let W = 1, H = 1, R = 50, gap = 12, floorY = 600, nozzle = { x: 0, y: 0 }, barrel = 40;
  const pieces = [];                                  // each: { x[], y[], vx[], vy[], n, live, fade }
  let live = null, pressed = false, emitAcc = 0, grab = null, pid = null, acc = 0;

  function build() {
    W = stage.W; H = stage.H; R = Math.min(W, H) * P.size; gap = Math.max(3, H * P.gap);
    floorY = H - 92; nozzle = { x: W * 0.22, y: H * 0.27 }; barrel = R * 1.6;
    pieces.length = 0; live = null; pressed = false; grab = null; cam = { x: 0, y: 0 };
  }
  const newPiece = () => ({ x: [], y: [], vx: [], vy: [], n: 0, fade: 1, dying: false });
  function emit(p) {
    p.x.push(nozzle.x - R * 0.4); p.y.push(nozzle.y); p.vx.push(P.feed); p.vy.push(0); p.n++;
  }

  function stepPiece(p, h) {
    const n = p.n; if (!n) return;
    const k = P.spring, kc = k * 30, c = p === live && pressed ? P.damping : P.loose;   // a stream coming out of the spout is damped like a hose; a loose slinky hardly at all
    const fx = new Float32Array(n), fy = new Float32Array(n);
    for (let i = 0; i < n - 1; i++) {                         // a zero-length spring between neighbours, and the wire in the way when they touch
      const dx = p.x[i + 1] - p.x[i], dy = p.y[i + 1] - p.y[i], d = Math.hypot(dx, dy) || 1e-4, nx = dx / d, ny = dy / d;
      let f = k * d; if (d < gap) f -= kc * (gap - d);
      f += c * ((p.vx[i + 1] - p.vx[i]) * nx + (p.vy[i + 1] - p.vy[i]) * ny) * 20;
      fx[i] += nx * f; fy[i] += ny * f; fx[i + 1] -= nx * f; fy[i + 1] -= ny * f;
    }
    // coils that are not neighbours cannot sit on one another: this is what makes a pile
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
      const dx = p.x[j] - p.x[i];
      if (dx > gap || dx < -gap) continue;
      const dy = p.y[j] - p.y[i], d = Math.hypot(dx, dy);
      if (d < gap) { const nn = d || 1e-4, f = kc * (gap - d) / nn; fx[i] -= dx * f; fy[i] -= dy * f; fx[j] += dx * f; fy[j] += dy * f; }
    }
    if (grab && grab.p === p) { const i = grab.i; fx[i] += (grab.x - p.x[i]) * 900 - p.vx[i] * 30; fy[i] += (grab.y - p.y[i]) * 900 - p.vy[i] * 30; }
    const drag = Math.exp(-P.air * h * 10);
    for (let i = 0; i < n; i++) {
      if (p.pin && i === 0) continue;                                     // (a test: hold the top coil)
      const inBarrel = p === live && pressed && p.x[i] < nozzle.x + barrel && p.y[i] < nozzle.y + R * 0.5;   // the first stretch is the spout: coils are pushed straight out
      if (inBarrel) { p.vx[i] = P.feed; p.vy[i] = 0; p.y[i] = nozzle.y; p.x[i] += P.feed * h; continue; }
      p.vx[i] = (p.vx[i] + fx[i] * h) * drag; p.vy[i] = (p.vy[i] + (fy[i] + P.gravity) * h) * drag;
      p.x[i] += p.vx[i] * h; p.y[i] += p.vy[i] * h;
      // The floor. A coil is a ring, so it lands on its rim: it rests on its middle when the chain runs straight down, and on the edge of
      // the ring (a whole radius above the floor) when the chain runs sideways. The hit sends the bounce back up the chain, and that is
      // what starts the wave of the next coil, and the next.
      { const a0 = Math.max(0, i - 1), b0 = Math.min(n - 1, i + 1), tx = p.x[b0] - p.x[a0], ty = p.y[b0] - p.y[a0], tl = Math.hypot(tx, ty) || 1, off = R * Math.abs(tx) / tl;
        if (p.y[i] + off > floorY) { p.y[i] = floorY - off; if (p.vy[i] > 0) p.vy[i] *= -P.bounce; p.vx[i] *= 1 - P.grip * 0.08; } }
      p.x[i] = clamp(p.x[i], R * 0.5, W - R * 0.5);
    }
  }

  function stepAll(dt) {
    // the feed: while the button is down a new coil leaves the spout every `gap * 1.3` of travel
    if (pressed && live) {
      emitAcc += P.feed * dt;
      const step = gap * 1.3;
      while (emitAcc >= step && live.n < P.longest) { emitAcc -= step; emit(live); }
      if (live.n >= P.longest) release();
    }
    const sub = 6, h = dt / sub;
    for (const p of pieces) for (let s = 0; s < sub; s++) stepPiece(p, h);
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

  // The scene lives in the physics' own pixels (y down); it is drawn through the shared camera, in a world with y up and the middle of the
  // screen at the origin. Rings are circles in 3D, perpendicular to the chain.
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
    const kf = Math.hypot(tx - cam.x, ty - cam.y) > R * 10 ? 1 : 0.12; cam.x += (tx - cam.x) * kf; cam.y += (ty - cam.y) * kf;
    ctx.setTransform(stage.pw / W, 0, 0, stage.ph / H, 0, 0);
    ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H);
    const r = V.rot(), [ox, oy] = V.origin(r, cam, W, H), d = R * 1.5;
    ctx.strokeStyle = ink; ctx.fillStyle = paper; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2.4, R * 0.06);
    const fy = wy(floorY);                                                  // the floor: a slab
    box(r, ox, oy, -W * 1.2, fy - R * 0.6, -d * 1.6, W * 1.2, fy, d * 1.6);
    // the factory: a body, and a spout turned sideways
    const nx = wx(nozzle.x), ny = wy(nozzle.y), bx = nx - R * 3.2, bw = R * 2.6, bh = R * 3.2;
    box(r, ox, oy, bx, ny - bh / 2, -R * 1.2, bx + bw, ny + bh / 2, R * 1.2);
    box(r, ox, oy, bx + bw, ny - R * 1.02, -R * 1.02, nx + barrel * 0.35, ny + R * 1.02, R * 1.02);
    // the coils: circles perpendicular to the chain, far ones first
    const list = [];
    for (const p of pieces) for (let i = 0; i < p.n; i++) {
      const a = i + 1 < p.n ? Math.atan2(p.y[i + 1] - p.y[i], p.x[i + 1] - p.x[i]) : i > 0 ? Math.atan2(p.y[i] - p.y[i - 1], p.x[i] - p.x[i - 1]) : 0;
      list.push({ c: [wx(p.x[i]), wy(p.y[i]), 0], a, fade: p.fade, z: V.project([wx(p.x[i]), wy(p.y[i]), 0], r, 0, 0)[2] });
    }
    list.sort((a, b) => a.z - b.z);
    ctx.lineWidth = Math.max(1.8, R * P.wire);
    for (const it of list) {
      ctx.globalAlpha = Math.max(0, it.fade);
      const tgx = Math.cos(it.a), tgy = -Math.sin(it.a), ux = -tgy, uy = tgx;      // the chain's direction in world (y up), and the way across it
      ctx.beginPath();
      for (let i = 0; i <= 36; i++) {
        const t = i / 36 * Math.PI * 2, cs = Math.cos(t) * R, sn = Math.sin(t) * R, q = V.project([it.c[0] + ux * cs, it.c[1] + uy * cs, sn], r, ox, oy);
        i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
      }
      ctx.stroke();
    }
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
  let down = null, orbiting = false, holdTimer = 0;
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

  offs.push(stage.frame((dt) => {
    if (V.mode !== 'factory') return;
    if (down && !orbiting && !grab && !pressed && performance.now() - down.t > 140) press();       // held still for a moment: the stream starts
    acc = Math.min(acc + dt, 0.05); while (acc >= 1 / 60) { acc -= 1 / 60; stepAll(1 / 60); } draw();
  }));

  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  return {
    tune: {
      title: 'Slinky factory', values: P, defaults: DEFAULTS,
      groups: [
        { name: 'Stream', items: [Ctl('feed', 'Feed speed (px/s)', 100, 1400, 10), Ctl('longest', 'Longest piece (coils)', 20, 300, 5), Ctl('keep', 'Pieces kept on the floor', 1, 6, 1)] },
        { name: 'Spring', items: [Ctl('spring', 'Stiffness', 10, 5000, 10), Ctl('gap', 'Coil spacing when stacked (re-forms)', 0.006, 0.05, 0.001), Ctl('damping', 'Damping while streaming', 0, 8, 0.1), Ctl('loose', 'Damping once cut (low = lively)', 0, 4, 0.01), Ctl('gravity', 'Gravity', 200, 4000, 50), Ctl('air', 'Air drag', 0, 1, 0.01), Ctl('grip', 'Grip of the floor', 0, 1, 0.05), Ctl('bounce', 'Bounce off the floor', 0, 0.95, 0.01)] },
        { name: 'Look', items: [Ctl('size', 'Coil radius (re-forms)', 0.03, 0.14, 0.005), Ctl('wire', 'Wire thickness', 0.02, 0.2, 0.005)] },
      ],
      actions: { 'Sweep up': () => { pieces.length = 0; live = null; pressed = false; } },
      set(key, value) { P[key] = value; if (['gap', 'size'].includes(key)) { const keepPieces = pieces.slice(); build(); } },
      reset() { Object.assign(P, DEFAULTS); build(); },
    },
    debug: { drop: (n = 24, hang = 240) => { pieces.length = 0; live = null; pressed = false; const p = newPiece(); const x0 = W * 0.72; for (let i = 0; i < n; i++) { p.x.push(x0); p.y.push(H * 0.12 + i * gap * 1.4); p.vx.push(0); p.vy.push(0); p.n++; } p.pin = true; pieces.push(p); for (let i = 0; i < hang; i++) stepAll(1 / 60); return p; }, press, release, run: (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) stepAll(dt); draw(); }, pieces: () => pieces, P },
    destroy() { offs.forEach((f) => f()); },
  };
}
