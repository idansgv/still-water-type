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
    rodSpring: 1330, rodGap: 0.19, hold: 0.85, rebound: 0.35,   // once cut the piece is a row of rods (as on the stairs): wire stiffness, closest coils (of the radius), grip, how much of a landing comes back
    bend: 0.9, steps: 5, run: 0.12, start: 0.45,        // how much a bent stretch of the slinky resists folding (an arch holds), and the stairs beyond the spout: how many, how high, how wide
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
  // the floor: flat, or (steps > 0) a flight of stairs going down to the right, starting a little past the spout. y grows downward.
  // The stairs start as a shelf level with the foot of the spout (the stream lands on it and is pushed along to the edge), then go down in equal steps to the floor.
  const stairs = () => { const top = nozzle.y + R * 1.7, st = (floorY - top) / P.steps; return { x0: W * P.start, top, st, wd: Math.max(R, W * P.run * 0.5) }; };
  const floorAt = (x) => { if (!P.steps) return floorY; const g = stairs(), i = Math.max(0, Math.min(P.steps, Math.floor((x - g.x0) / g.wd) + 1)); return g.top + g.st * i; };
  const newPiece = () => ({ x: [], y: [], vx: [], vy: [], n: 0, fade: 1, dying: false, rod: true, px: [], py: [], pvx: [], pvy: [], rx: [], ry: [] });
  function emit(p) {
    const cx = nozzle.x - R * 0.4;                                                    // a coil leaves the spout standing up: a rod across the barrel
    p.x.push(cx); p.y.push(nozzle.y); p.vx.push(P.feed); p.vy.push(0); p.n++;
    p.px.push(cx, cx); p.py.push(nozzle.y - R, nozzle.y + R); p.pvx.push(P.feed, P.feed); p.pvy.push(0, 0); p.rx.push(0); p.ry.push(1);
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
    // a slinky is a helix, so a stretch of it does not fold like a string: it keeps its arch. A pull that straightens three neighbours in a row.
    const kb = k * P.bend;
    if (kb > 0) for (let i = 1; i < n - 1; i++) {
      const mx = (p.x[i - 1] + p.x[i + 1]) / 2 - p.x[i], my = (p.y[i - 1] + p.y[i + 1]) / 2 - p.y[i];
      fx[i] += kb * mx; fy[i] += kb * my; fx[i - 1] -= kb * mx / 2; fy[i - 1] -= kb * my / 2; fx[i + 1] -= kb * mx / 2; fy[i + 1] -= kb * my / 2;
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
        const fl = floorAt(p.x[i]); if (p.y[i] + off > fl) { p.y[i] = fl - off; if (p.vy[i] > 0) p.vy[i] *= -P.bounce; p.vx[i] *= 1 - P.grip * 0.08; } }
      p.x[i] = clamp(p.x[i], R * 0.5, W - R * 0.5);
    }
  }

  // ---- once cut: every coil a rigid rod (the ring edge-on), two end masses, zero-length springs top to top and bottom to bottom ----
  const boxesNow = () => {                                                   // the floor as boxes: [xa, xb, top] (y down)
    if (!P.steps) return [[-1e6, 1e6, floorY]];
    const g = stairs(), x0 = g.x0, wd = g.wd, out = [[-1e6, x0, g.top]];
    for (let k = 1; k <= P.steps; k++) out.push([x0 + (k - 1) * wd, k === P.steps ? 1e6 : x0 + k * wd, g.top + g.st * k]);
    return out;
  };
  function toRods(p) {
    const n = p.n; if (n < 2 || p.rod) return;
    p.px = new Float32Array(2 * n); p.py = new Float32Array(2 * n); p.pvx = new Float32Array(2 * n); p.pvy = new Float32Array(2 * n); p.rx = []; p.ry = [];
    for (let i = 0; i < n; i++) {
      const a0 = Math.max(0, i - 1), b0 = Math.min(n - 1, i + 1), tx = p.x[b0] - p.x[a0], ty = p.y[b0] - p.y[a0], tl = Math.hypot(tx, ty) || 1, ux = -ty / tl, uy = tx / tl;
      p.px[2 * i] = p.x[i] - ux * R; p.py[2 * i] = p.y[i] - uy * R; p.px[2 * i + 1] = p.x[i] + ux * R; p.py[2 * i + 1] = p.y[i] + uy * R;
      for (const e of [0, 1]) { p.pvx[2 * i + e] = p.vx[i]; p.pvy[2 * i + e] = p.vy[i]; }
      p.rx.push(-ux); p.ry.push(-uy);
    }
    p.rod = true;
  }
  const clampSeg = (v) => Math.max(0, Math.min(1, v));
  function rodSub(p, h) {
    const n = p.n, M = 2 * n, px = p.px, py = p.py, vx = p.pvx, vy = p.pvy, L = 2 * R, rw = Math.max(2, R * P.wire * 0.5), dmin = R * P.rodGap + rw, k = P.rodSpring, bx = boxesNow();
    const x0 = Float32Array.from(px), y0 = Float32Array.from(py), vyPre = Float32Array.from(vy), landed = new Uint8Array(M);
    for (let i = 0; i < M; i++) vy[i] += P.gravity * h;
    for (let i = 0; i < n - 1; i++) for (const e of [0, 1]) { const a = 2 * i + e, b = 2 * (i + 1) + e, dx = px[b] - px[a], dy = py[b] - py[a]; vx[a] += k * dx * h; vy[a] += k * dy * h; vx[b] -= k * dx * h; vy[b] -= k * dy * h; }
    if (grab && grab.p === p) { const i = 2 * grab.i; vx[i] += (grab.x - px[i]) * 900 * h - vx[i] * 12 * h; vy[i] += (grab.y - py[i]) * 900 * h - vy[i] * 12 * h; }
    const streaming = p === live && pressed, damp = Math.exp(-(streaming ? P.damping : P.loose) * h), inB = (i) => streaming && p.x[i >> 1] < nozzle.x + barrel && p.y[i >> 1] < nozzle.y + R * 1.5;
    for (let i = 0; i < M; i++) { if (inB(i)) { vx[i] = P.feed; vy[i] = 0; px[i] += P.feed * h; py[i] = nozzle.y + (i & 1 ? R : -R); continue; } vx[i] *= damp; vy[i] *= damp; px[i] += vx[i] * h; py[i] += vy[i] * h; }
    const pushPoint = (q, a, b, r) => {
      const sx = px[b] - px[a], sy = py[b] - py[a], l2 = sx * sx + sy * sy || 1e-6, t = clampSeg(((px[q] - px[a]) * sx + (py[q] - py[a]) * sy) / l2);
      const cx = px[a] + sx * t, cy = py[a] + sy * t, dx = px[q] - cx, dy = py[q] - cy, d = Math.hypot(dx, dy) || 1e-6;
      if (d < r) { const c = (r - d) / d; px[q] += dx * c * 0.5; py[q] += dy * c * 0.5; px[a] -= dx * c * 0.5 * (1 - t); py[a] -= dy * c * 0.5 * (1 - t); px[b] -= dx * c * 0.5 * t; py[b] -= dy * c * 0.5 * t; }
    };
    for (let it = 0; it < 6; it++) {
      for (let i = 0; i < n; i++) { const t = 2 * i, b = t + 1, dx = px[t] - px[b], dy = py[t] - py[b], d = Math.hypot(dx, dy) || 1e-6, c = (d - L) / d * 0.5; px[t] -= dx * c; py[t] -= dy * c; px[b] += dx * c; py[b] += dy * c; }
      for (let i = 0; i < n - 1; i++) {
        for (const e of [0, 1]) { const a = 2 * i + e, b = 2 * (i + 1) + e, dx = px[b] - px[a], dy = py[b] - py[a], d = Math.hypot(dx, dy) || 1e-6; if (d < dmin) { const c = (dmin - d) / d * 0.5; px[a] -= dx * c; py[a] -= dy * c; px[b] += dx * c; py[b] += dy * c; } }
        for (const [sa, sb, q] of [[2 * i, 2 * i + 1, 2 * (i + 1)], [2 * i, 2 * i + 1, 2 * (i + 1) + 1], [2 * (i + 1), 2 * (i + 1) + 1, 2 * i], [2 * (i + 1), 2 * (i + 1) + 1, 2 * i + 1]]) pushPoint(q, sa, sb, dmin * 0.9);
      }
      for (let i = 0; i < M; i++) for (const [xa, xb, tp] of bx) {                  // the floor and the steps
        if (px[i] > xa - rw && px[i] < xb + rw && py[i] > tp - rw) {
          const up = py[i] - (tp - rw), left = px[i] - (xa - rw), right = (xb + rw) - px[i];
          if (up <= left && up <= right) { py[i] -= up; landed[i] = 1; if (vy[i] > 0) vy[i] = 0; vx[i] *= 1 - P.hold * 0.05; }
          else if (left < right) { px[i] -= left; if (vx[i] > 0) vx[i] = 0; } else { px[i] += right; if (vx[i] < 0) vx[i] = 0; }
        }
      }
      for (let i = 0; i < n; i++) for (let b = 0; b < bx.length - 1; b++) {         // the edge of each step
        const a = 2 * i, c = a + 1, cx0 = bx[b][1], cy0 = bx[b][2], sx = px[c] - px[a], sy = py[c] - py[a], l2 = sx * sx + sy * sy || 1e-6, t = clampSeg(((cx0 - px[a]) * sx + (cy0 - py[a]) * sy) / l2);
        const qx = px[a] + sx * t, qy = py[a] + sy * t, dx = qx - cx0, dy = qy - cy0, d = Math.hypot(dx, dy) || 1e-6;
        if (d < rw) { const f = (rw - d) / d; px[a] += dx * f * (1 - t); py[a] += dy * f * (1 - t); px[c] += dx * f * t; py[c] += dy * f * t; }
      }
    }
    for (let i = 0; i < M; i++) { const lo = R * 0.5, hi = W - R * 0.5; if (px[i] < lo) px[i] = lo; else if (px[i] > hi) px[i] = hi; }   // the edges of the page are walls
    for (let i = 0; i < M; i++) if (inB(i)) { py[i] = nozzle.y + (i & 1 ? R : -R); }                      // (the barrel is not pushed out of shape)
    for (let i = 0; i < M; i++) {                                                  // velocities come from where the constraints left the points; a landing gives some back
      vx[i] = (px[i] - x0[i]) / h; vy[i] = (py[i] - y0[i]) / h;
      if (landed[i] && vyPre[i] > R * 2) vy[i] = -vyPre[i] * P.rebound;
      const sp = Math.hypot(vx[i], vy[i]); if (sp > 40 * R) { vx[i] *= 40 * R / sp; vy[i] *= 40 * R / sp; }
    }
    for (let i = 0; i < n; i++) {
      p.x[i] = (px[2 * i] + px[2 * i + 1]) / 2; p.y[i] = (py[2 * i] + py[2 * i + 1]) / 2; p.vx[i] = (vx[2 * i] + vx[2 * i + 1]) / 2; p.vy[i] = (vy[2 * i] + vy[2 * i + 1]) / 2;
      const dx = px[2 * i + 1] - px[2 * i], dy = py[2 * i + 1] - py[2 * i], d = Math.hypot(dx, dy) || 1; p.rx[i] = dx / d; p.ry[i] = dy / d;
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
    for (const p of pieces) { if (p.rod) { for (let s = 0; s < 4; s++) rodSub(p, dt / 4); } else for (let s = 0; s < sub; s++) stepPiece(p, h); }
    for (let i = pieces.length - 1; i >= 0; i--) { const p = pieces[i]; if (p.dying) { p.fade -= dt * 1.6; if (p.fade <= 0) pieces.splice(i, 1); } }
    const finished = pieces.filter((p) => p !== live && !p.dying);
    if (finished.length > P.keep) finished[0].dying = true;
  }
  function press() {
    if (pressed) return;
    live = newPiece(); pieces.push(live); pressed = true; emitAcc = 0;
    emit(live);
  }
  function release() { if (!pressed) return; pressed = false; if (live) toRods(live); live = null; }

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
    if (!P.steps) box(r, ox, oy, -W * 1.2, fy - R * 0.6, -d * 1.6, W * 1.2, fy, d * 1.6);
    else {
      const g = stairs(), x0 = g.x0, st = g.st, wd = g.wd, top = g.top;
      box(r, ox, oy, -W * 1.2, wy(top) - R * 0.6, -d * 1.6, wx(x0), wy(top), d * 1.6);
      for (let k2 = 1; k2 <= P.steps; k2++) { const a = wx(x0 + (k2 - 1) * wd), b = k2 === P.steps ? W * 1.2 : wx(x0 + k2 * wd), y = wy(top + st * k2); box(r, ox, oy, a, y - Math.max(R * 0.6, st * 2), -d * 1.6, b, y, d * 1.6); }
    }
    // the factory: a body, and a spout turned sideways
    const nx = wx(nozzle.x), ny = wy(nozzle.y), bx = nx - R * 3.2, bw = R * 2.6, bh = R * 3.2;
    box(r, ox, oy, bx, ny - bh / 2, -R * 1.2, bx + bw, ny + bh / 2, R * 1.2);
    box(r, ox, oy, bx + bw, ny - R * 1.02, -R * 1.02, nx + barrel * 0.35, ny + R * 1.02, R * 1.02);
    // the coils: circles perpendicular to the chain, far ones first
    const list = [];
    for (const p of pieces) for (let i = 0; i < p.n; i++) {
      const a = i + 1 < p.n ? Math.atan2(p.y[i + 1] - p.y[i], p.x[i + 1] - p.x[i]) : i > 0 ? Math.atan2(p.y[i] - p.y[i - 1], p.x[i] - p.x[i - 1]) : 0;
      list.push({ c: [wx(p.x[i]), wy(p.y[i]), 0], a, rod: p.rod ? [p.rx[i], -p.ry[i]] : null, fade: p.fade, z: V.project([wx(p.x[i]), wy(p.y[i]), 0], r, 0, 0)[2] });
    }
    list.sort((a, b) => a.z - b.z);
    ctx.lineWidth = Math.max(1.8, R * P.wire);
    for (const it of list) {
      ctx.globalAlpha = Math.max(0, it.fade);
      const tgx = Math.cos(it.a), tgy = -Math.sin(it.a), ux = it.rod ? it.rod[0] : -tgy, uy = it.rod ? it.rod[1] : tgx;      // the chain's direction in world (y up), and the way across it
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
        { name: 'Spring', items: [Ctl('gap', 'Coil spacing when stacked (re-forms)', 0.006, 0.05, 0.001), Ctl('damping', 'Damping while streaming', 0, 8, 0.1), Ctl('loose', 'Air damping once cut', 0, 4, 0.01), Ctl('rodSpring', 'Wire stiffness', 2, 4000, 2), Ctl('rodGap', 'Closest coils', 0.05, 0.5, 0.01), Ctl('hold', 'Grip of the floor', 0, 1, 0.05), Ctl('rebound', 'Rebound off the floor', 0, 0.95, 0.01), Ctl('gravity', 'Gravity', 200, 4000, 50), ] },
        { name: 'Stairs', items: [Ctl('steps', 'Steps (0 = flat floor)', 0, 8, 1), Ctl('run', 'Step depth', 0.08, 0.4, 0.01), Ctl('start', 'Where the shelf ends', 0.3, 0.8, 0.01)] },
        { name: 'Look', items: [Ctl('size', 'Coil radius (re-forms)', 0.03, 0.14, 0.005), Ctl('wire', 'Wire thickness', 0.02, 0.2, 0.005)] },
      ],
      actions: { 'Sweep up': () => { pieces.length = 0; live = null; pressed = false; } },
      set(key, value) { P[key] = value; if (['gap', 'size'].includes(key)) { const keepPieces = pieces.slice(); build(); } },
      reset() { Object.assign(P, DEFAULTS); build(); },
    },
    debug: { drop: (n = 24, hang = 240) => { pieces.length = 0; live = null; pressed = false; const p = newPiece(); p.rod = false; const x0 = W * 0.72; for (let i = 0; i < n; i++) { p.x.push(x0); p.y.push(H * 0.12 + i * gap * 1.4); p.vx.push(0); p.vy.push(0); p.n++; } p.pin = true; pieces.push(p); for (let i = 0; i < hang; i++) stepAll(1 / 60); return p; }, press, release, run: (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) stepAll(dt); draw(); }, pieces: () => pieces, P },
    destroy() { offs.forEach((f) => f()); },
  };
}
