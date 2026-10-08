// Slinky factory. A machine with a spout turned sideways (a 90 degree elbow). Hold the mouse (or a finger) and it streams coils out
// of the spout, one after another, straight at first and then bending down under their own weight; let go and the cutter snips the
// stream: the loose piece drops, bounces on its springs and piles up on the floor. Real springs: every coil is a point mass joined to
// the next by a zero-length spring (so it stretches a long way and stacks tight), a coil cannot get closer to the next than the
// wire, coils that are not neighbours cannot sit on top of each other (so a pile builds up), the floor grips.
// One colour: black on white, white on black on every second shuffle. Letters come later.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function mountFactory(stage) {
  const ctx = stage.canvas.getContext('2d');
  const dark = !!stage.flip;
  const ink = dark ? '#fff' : '#000', paper = dark ? '#000' : '#fff';
  stage.setBackdrop(dark ? 0 : 1);
  const offs = [];

  const DEFAULTS = {
    feed: 560, gravity: 1700, spring: 1500,          // how fast coils leave the spout (px/s), gravity (px/s^2), spring stiffness
    gap: 0.02, size: 0.07, tilt: 0.34,               // closest two neighbouring coils get (of the screen height), coil radius (of the shorter side), how round the rings look
    damping: 1.2, air: 0.06, grip: 0.5,              // damping along the springs, air drag, how much the floor grips
    keep: 3, longest: 150,                           // pieces kept on the floor, most coils in one piece
    wire: 0.06,                                      // drawn wire thickness (of the coil radius)
  };
  const P = { ...DEFAULTS };

  let W = 1, H = 1, R = 50, gap = 12, floorY = 600, nozzle = { x: 0, y: 0 }, barrel = 40;
  const pieces = [];                                  // each: { x[], y[], vx[], vy[], n, live, fade }
  let live = null, pressed = false, emitAcc = 0, grab = null, pid = null, acc = 0;

  function build() {
    W = stage.W; H = stage.H; R = Math.min(W, H) * P.size; gap = Math.max(3, H * P.gap);
    floorY = H - 92; nozzle = { x: W * 0.22, y: H * 0.27 }; barrel = R * 1.6;
    pieces.length = 0; live = null; pressed = false; grab = null;
  }
  const newPiece = () => ({ x: [], y: [], vx: [], vy: [], n: 0, fade: 1, dying: false });
  function emit(p) {
    p.x.push(nozzle.x - R * 0.4); p.y.push(nozzle.y); p.vx.push(P.feed); p.vy.push(0); p.n++;
  }

  function stepPiece(p, h) {
    const n = p.n; if (!n) return;
    const k = P.spring, kc = k * 30, c = P.damping;
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
      const inBarrel = p === live && pressed && p.x[i] < nozzle.x + barrel && p.y[i] < nozzle.y + R * 0.5;   // the first stretch is the spout: coils are pushed straight out
      if (inBarrel) { p.vx[i] = P.feed; p.vy[i] = 0; p.y[i] = nozzle.y; p.x[i] += P.feed * h; continue; }
      p.vx[i] = (p.vx[i] + fx[i] * h) * drag; p.vy[i] = (p.vy[i] + (fy[i] + P.gravity) * h) * drag;
      p.x[i] += p.vx[i] * h; p.y[i] += p.vy[i] * h;
      if (p.y[i] > floorY) { p.y[i] = floorY; if (p.vy[i] > 0) p.vy[i] *= -0.12; p.vx[i] *= 1 - P.grip * 0.08; }
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

  function draw() {
    ctx.setTransform(stage.pw / W, 0, 0, stage.ph / H, 0, 0);
    ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = ink; ctx.fillStyle = paper; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // the floor
    ctx.lineWidth = Math.max(2, R * 0.06); ctx.beginPath(); ctx.moveTo(0, floorY + R * 0.34); ctx.lineTo(W, floorY + R * 0.34); ctx.stroke();
    // the factory: a body and a spout turned sideways
    const bx = nozzle.x - R * 3.2, bw = R * 2.6, by = nozzle.y - R * 1.6, bh = R * 3.2;
    ctx.lineWidth = Math.max(2.5, R * 0.07);
    ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx + bw, nozzle.y - R * 1.02); ctx.lineTo(nozzle.x + barrel * 0.35, nozzle.y - R * 1.02); ctx.lineTo(nozzle.x + barrel * 0.35, nozzle.y + R * 1.02); ctx.lineTo(bx + bw, nozzle.y + R * 1.02); ctx.fill(); ctx.stroke();   // the spout
    ctx.beginPath(); ctx.ellipse(nozzle.x + barrel * 0.35, nozzle.y, R * 0.34, R * 1.02, 0, 0, Math.PI * 2); ctx.stroke();                                               // its mouth
    ctx.beginPath(); ctx.moveTo(bx, by + bh * 0.3); ctx.lineTo(bx + bw, by + bh * 0.3); ctx.moveTo(bx, by + bh * 0.62); ctx.lineTo(bx + bw, by + bh * 0.62); ctx.stroke();       // panel lines
    // the coils
    ctx.lineWidth = Math.max(1.8, R * P.wire);
    for (const p of pieces) {
      ctx.globalAlpha = Math.max(0, p.fade);
      for (let i = 0; i < p.n; i++) {
        const a = i + 1 < p.n ? Math.atan2(p.y[i + 1] - p.y[i], p.x[i + 1] - p.x[i]) : i > 0 ? Math.atan2(p.y[i] - p.y[i - 1], p.x[i] - p.x[i - 1]) : 0;
        ctx.save(); ctx.translate(p.x[i], p.y[i]); ctx.rotate(a);
        ctx.beginPath(); ctx.ellipse(0, 0, R * P.tilt, R, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- touch ----------
  offs.push(stage.on('down', (q, e) => {
    if (pid !== null) return;
    pid = e.pointerId;
    // taking hold of the loose end of a piece on the floor: its first coil
    let best = null, bd = (R * 1.2) ** 2;
    for (const p of pieces) if (p.n && !p.dying && p !== live) { const d = (p.x[0] - q.x) ** 2 + (p.y[0] - q.y) ** 2; if (d < bd) { bd = d; best = p; } }
    if (best) grab = { p: best, i: 0, x: q.x, y: q.y }; else press();
  }));
  offs.push(stage.on('move', (q, e) => { if (grab && e.pointerId === pid) { grab.x = q.x; grab.y = q.y; } }));
  offs.push(stage.on('up', (q, e) => { if (e.pointerId !== pid) return; release(); grab = null; pid = null; }));
  offs.push(stage.on('resize', build));
  build();

  offs.push(stage.frame((dt) => { acc = Math.min(acc + dt, 0.05); while (acc >= 1 / 60) { acc -= 1 / 60; stepAll(1 / 60); } draw(); }));

  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  return {
    tune: {
      title: 'Slinky factory', values: P, defaults: DEFAULTS,
      groups: [
        { name: 'Stream', items: [Ctl('feed', 'Feed speed (px/s)', 100, 1400, 10), Ctl('longest', 'Longest piece (coils)', 20, 300, 5), Ctl('keep', 'Pieces kept on the floor', 1, 6, 1)] },
        { name: 'Spring', items: [Ctl('spring', 'Stiffness', 200, 5000, 50), Ctl('gap', 'Coil spacing when stacked (re-forms)', 0.006, 0.05, 0.001), Ctl('damping', 'Damping', 0, 8, 0.1), Ctl('gravity', 'Gravity', 200, 4000, 50), Ctl('air', 'Air drag', 0, 1, 0.01), Ctl('grip', 'Grip of the floor', 0, 1, 0.05)] },
        { name: 'Look', items: [Ctl('size', 'Coil radius (re-forms)', 0.03, 0.14, 0.005), Ctl('tilt', 'How round the coils look', 0.1, 0.9, 0.01), Ctl('wire', 'Wire thickness', 0.02, 0.2, 0.005)] },
      ],
      actions: { 'Sweep up': () => { pieces.length = 0; live = null; pressed = false; } },
      set(key, value) { P[key] = value; if (['gap', 'size'].includes(key)) { const keepPieces = pieces.slice(); build(); } },
      reset() { Object.assign(P, DEFAULTS); build(); },
    },
    debug: { press, release, run: (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) stepAll(dt); draw(); }, pieces: () => pieces, P },
    destroy() { offs.forEach((f) => f()); stage.setBackdrop(null); stage.root.style.cursor = ''; },
  };
}
