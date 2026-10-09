// Slinky, physical. A Slinky as a real simulation, not an animation. In side view every coil is a rigid rod (the ring seen edge-on):
// two end points, a fixed distance apart, each with a mass. The wire that joins one coil to the next is a spring from the top end of a rod
// to the top end of the next, and another from bottom end to bottom end. Those springs have zero rest length (they are pre-tensioned), so
// they pull the coils together until the wire gets in the way. Rods cannot pass through each other or through the stairs, the stairs
// grip, and gravity pulls on everything. Nothing here knows about walking: if the slinky tips over the edge of a step and a wave of
// flipping coils runs down it and it lands on the next step, that is the physics doing it.
//
// Drawing: each rod becomes a 3D ring (a circle whose plane holds the rod and the depth axis), seen in an isometric tilt.
// Touch: take hold of either end of the slinky (first or last coil) and pull; a quick tap on the top coil nudges it forward.
// One colour: black on white, white on black on every second shuffle.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createPhys(stage, V) {
  const ctx = stage.canvas.getContext('2d');
  const dark = !!stage.flip;
  const ink = dark ? '#fff' : '#000', paper = dark ? '#000' : '#fff';
  const offs = [];

  const DEFAULTS = {                                 // refined 10 Oct 2026 (tools/slinky-bench.js, look2); before: lean unlimited (77), spring 1453, gap 0.231, arch 10, pack 0.25, archW 2.935, archH 1.204, gravity 39.9, grip 0.877, damping 0.415, bounce 0.239, push 0.965, cross 1
    coils: 25, size: 0.085, wire: 0.065,               // number of coils, coil radius (of the shorter screen side), wire thickness drawn (of the radius)
    spring: 1238, gap: 0.236, arch: 9, pack: 0.237, archW: 2.562, archH: 1.478,   // wire stiffness, closest approach between coils, coils on the arch at the start, stack spacing, arch width and height
    gravity: 31.5, grip: 0.913, damping: 0.59, bounce: 0.36,             // gravity (radii per s^2), how much the stairs grip (0 slides), air damping (per s)
    stepW: 6.9, drop: 2.3, push: 0.864,                // width and drop of a step (radii), the strength of the tap
    lean: 35, settle: 0, shear: 0, align: 0, cross: 0.88, flat: 0,   // most a ring may lean off square to the path (deg), settle frames, diagonal wire, torque, crossing push-apart, lie-flat pull
    yaw: 50, pitch: 32,                                // the view (degrees)
  };
  const P = { ...DEFAULTS };

  let W = 1, H = 1, R = 60, N = 20, L = 120, rw = 4, g = 1500, stepW = 450, Hs = 70;
  let px = [], py = [], vx = [], vy = [], cam = { x: 0, y: 0 }, grab = null, pid = null, acc = 0, tapT = 0;

  const top = (k) => -k * Hs;                                   // the top of step k (step 0 is the upper one, x from -inf to 0; step k covers x in [(k-1) stepW, k stepW])
  const stepX = (k) => [(k - 1) * stepW, k * stepW];

  function build() {
    W = stage.W; H = stage.H;
    R = Math.min(W, H) * P.size; N = Math.round(P.coils); L = 2 * R; rw = Math.max(3, R * P.wire * 0.5); g = P.gravity * R; stepW = R * P.stepW; Hs = R * P.drop;
    px = new Float32Array(2 * N); py = new Float32Array(2 * N); vx = new Float32Array(2 * N); vy = new Float32Array(2 * N);
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
    // The pose above is only a sketch of a slinky hanging over the edge; let it settle under its own weight with heavy damping so it starts at rest, without the flung rods of an unsettled start.
    if (P.settle) { const dsave = P.damping; P.damping = 8; for (let f = 0; f < P.settle * 4; f++) substep(1 / 240); P.damping = dsave; vx.fill(0); vy.fill(0); }
  }
  // index: top of coil i is 2i, bottom 2i+1

  function step(h) {
    const k = P.spring, dmin = R * P.gap + rw, M = 2 * N;
    // forces: gravity, and the zero-length springs between neighbouring coils (top to top, bottom to bottom)
    for (let i = 0; i < M; i++) { vy[i] -= g * h; }
    // A ring standing on its rim is not steady: if only one end of a coil rests on the stairs, the raised end is pulled down harder (the more upright the coil, the harder), so loose coils tip and lie flat on the step.
    if (P.flat) for (let i = 0; i < N; i++) { const t = 2 * i, b = t + 1; if (!!landedPrev[t] === !!landedPrev[b]) continue; const lo = landedPrev[t] ? t : b, hi = landedPrev[t] ? b : t; vy[hi] -= g * h * P.flat * Math.min(1, Math.abs(py[hi] - py[lo]) / L); }
    for (let i = 0; i < N - 1; i++) for (const e of [0, 1]) {
      const a = 2 * i + e, b = 2 * (i + 1) + e, dx = px[b] - px[a], dy = py[b] - py[a];
      vx[a] += k * dx * h; vy[a] += k * dy * h; vx[b] -= k * dx * h; vy[b] -= k * dy * h;
    }
    // The wire of a helix pulls from the top of one ring to the bottom of the next as well (the diagonals). Their rest length is that of two rings stacked square, so a ring that tilts against its
    // neighbours stretches one diagonal and squeezes the other, and the more the slinky is stretched the harder it is pulled back square (tension squares the rings; a sheared stack costs energy).
    if (P.shear) { const l0 = Math.hypot(L, R * P.gap + rw), ks = P.shear * k; for (let i = 0; i < N - 1; i++) for (const [a, b] of [[2 * i, 2 * i + 3], [2 * i + 1, 2 * i + 2]]) { const dx = px[b] - px[a], dy = py[b] - py[a], d = Math.hypot(dx, dy) || 1e-6, f = ks * (d - l0) / d * h; vx[a] += f * dx; vy[a] += f * dy; vx[b] -= f * dx; vy[b] -= f * dy; } }
    if (P.align) tiltTorque(h);
    if (grab) { const i = grab.i; vx[i] += (grab.x - px[i]) * 900 * h - vx[i] * 12 * h; vy[i] += (grab.y - py[i]) * 900 * h - vy[i] * 12 * h; }
    const damp = Math.exp(-P.damping * h);
    for (let i = 0; i < M; i++) { vx[i] *= damp; vy[i] *= damp; px[i] += vx[i] * h; py[i] += vy[i] * h; }
    // constraints, a few passes
    const ox = new Float32Array(M), oy = new Float32Array(M);
    for (let it = 0; it < 6; it++) {
      for (let i = 0; i < N; i++) {                                         // each coil is a rod of fixed length
        const t = 2 * i, b = t + 1, dx = px[t] - px[b], dy = py[t] - py[b], d = Math.hypot(dx, dy) || 1e-6, c = (d - L) / d * 0.5;
        px[t] -= dx * c; py[t] -= dy * c; px[b] += dx * c; py[b] += dy * c;
      }
      keepOrder(M);
      if (P.cross) separateCrossed();
      for (let i = 0; i < N - 1; i++) {                                     // the wire is in the way: neighbouring coils cannot get closer than its thickness
        for (const e of [0, 1]) {
          const a = 2 * i + e, b = 2 * (i + 1) + e, dx = px[b] - px[a], dy = py[b] - py[a], d = Math.hypot(dx, dy) || 1e-6;
          if (d < dmin) { const c = (dmin - d) / d * 0.5; px[a] -= dx * c; py[a] -= dy * c; px[b] += dx * c; py[b] += dy * c; }
        }
        // a rod cannot pass through its neighbour: each end of one against the segment of the other
        const pairs = [[2 * i, 2 * i + 1, 2 * (i + 1)], [2 * i, 2 * i + 1, 2 * (i + 1) + 1], [2 * (i + 1), 2 * (i + 1) + 1, 2 * i], [2 * (i + 1), 2 * (i + 1) + 1, 2 * i + 1]];
        for (const [sa, sb, q] of pairs) pushPointOffSegment(q, sa, sb, dmin * 0.9);
      }
      for (let i = 0; i < M; i++) collideStairs(i);                          // the stairs
      for (let i = 0; i < N; i++) for (let k2 = -1; k2 <= 3; k2++) pushSegmentOffCorner(2 * i, 2 * i + 1, stepX(k2 + 1)[1], top(k2));   // the edges of the steps
    }
  }
  // A coil can lean either way, but it can never turn through its neighbours: seen from the path, the top of every rod stays on the same side. A rod that
  // has been forced across (the X in the middle of a stack) is turned back, by the shortest way, to the nearest lean it may have.
  // Tension lines the rings up: the wire pulls each ring square to the slinky's axis (the rim at the end of a hanging slinky lies parallel to the floor, the rings of an arch fan out
  // across the path). A torque on each coil, stronger the more it is stretched from its neighbours (the two end coils always); damped so it does not ring. (y up here)
  function tiltTorque(h) {
    const Kt = P.align * 3000, c = 2 * Math.sqrt(Kt) * 0.8, dmin = R * P.gap + rw;
    for (let i = 0; i < N; i++) {
      const t = 2 * i, b = t + 1, a0 = Math.max(0, i - 1), b0 = Math.min(N - 1, i + 1);
      const dx = (px[2 * b0] + px[2 * b0 + 1] - px[2 * a0] - px[2 * a0 + 1]) / 2, dy = (py[2 * b0] + py[2 * b0 + 1] - py[2 * a0] - py[2 * a0 + 1]) / 2, sp = Math.hypot(dx, dy) / (b0 - a0);
      const w = i === 0 || i === N - 1 ? 1 : Math.max(0, Math.min(1, (sp / dmin - 1.2) / 1.0)); if (w <= 0) continue;
      const hx = (px[t] - px[b]) / 2, hy = (py[t] - py[b]) / 2, hl = Math.hypot(hx, hy) || 1, rx = 2 * hx, ry = 2 * hy;
      const al = -Math.atan2(rx * dy - ry * dx, rx * dx + ry * dy); if (al < 0.05 || al > Math.PI - 0.05) continue;     // (a rod on the wrong side is the coil order rule's job)
      const qx = -hy / hl, qy = hx / hl, wr = ((vx[t] - vx[b]) / 2 * qx + (vy[t] - vy[b]) / 2 * qy) / hl;
      const acc = (Kt * (Math.PI / 2 - al) * w - c * wr) * hl * h;
      vx[t] += qx * acc; vy[t] += qy * acc; vx[b] -= qx * acc; vy[b] -= qy * acc;
    }
  }
  function keepOrder() {
    const am = Math.PI / 2 - P.lean * Math.PI / 180;                                  // a ring may lean up to P.lean degrees off square to the path, no further
    for (let i = 0; i < N; i++) {
      const a0 = Math.max(0, i - 1), b0 = Math.min(N - 1, i + 1);
      const dx = (px[2 * b0] + px[2 * b0 + 1]) / 2 - (px[2 * a0] + px[2 * a0 + 1]) / 2, dy = (py[2 * b0] + py[2 * b0 + 1]) / 2 - (py[2 * a0] + py[2 * a0 + 1]) / 2;
      const rx = px[2 * i] - px[2 * i + 1], ry = py[2 * i] - py[2 * i + 1];
      const al = -Math.atan2(rx * dy - ry * dx, rx * dx + ry * dy);              // the angle from the rod to the path, signed so that the allowed side is positive
      if (al >= am && al <= Math.PI - am) continue;
      const target = al < -Math.PI / 2 ? Math.PI - am : al > Math.PI - am ? Math.PI - am : am, del = -(al - target);   // turn the rod by this (counter-clockwise, y up)
      const cs = Math.cos(del), sn = Math.sin(del), mx = (px[2 * i] + px[2 * i + 1]) / 2, my = (py[2 * i] + py[2 * i + 1]) / 2, hx = rx / 2, hy = ry / 2;
      const nx = hx * cs - hy * sn, ny = hx * sn + hy * cs;
      px[2 * i] = mx + nx; py[2 * i] = my + ny; px[2 * i + 1] = mx - nx; py[2 * i + 1] = my - ny;
    }
  }
  // two rods that cross are pushed apart, centre from centre (neighbours and the next few)
  function separateCrossed() {
    for (let i = 0; i < N; i++) for (let j = i + 1; j < Math.min(N, i + 5); j++) {
      const ax = px[2 * i], ay = py[2 * i], bx = px[2 * i + 1], by = py[2 * i + 1], cx = px[2 * j], cy = py[2 * j], dx = px[2 * j + 1], dy = py[2 * j + 1];
      const o1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), o2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax), o3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), o4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
      if (o1 * o2 >= 0 || o3 * o4 >= 0) continue;
      let nx = (cx + dx - ax - bx) / 2, ny = (cy + dy - ay - by) / 2; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const m = Math.min(R * P.gap + rw, R * 0.25) * 0.5 * P.cross;
      px[2 * i] -= nx * m; py[2 * i] -= ny * m; px[2 * i + 1] -= nx * m; py[2 * i + 1] -= ny * m; px[2 * j] += nx * m; py[2 * j] += ny * m; px[2 * j + 1] += nx * m; py[2 * j + 1] += ny * m;
    }
  }
  function pushPointOffSegment(q, a, b, r) {
    const sx = px[b] - px[a], sy = py[b] - py[a], l2 = sx * sx + sy * sy || 1e-6;
    let t = ((px[q] - px[a]) * sx + (py[q] - py[a]) * sy) / l2; t = clamp(t, 0, 1);
    const cx = px[a] + sx * t, cy = py[a] + sy * t, dx = px[q] - cx, dy = py[q] - cy, d = Math.hypot(dx, dy) || 1e-6;
    if (d < r) {
      const c = (r - d) / d, wq = 0.5, ws = 0.5;
      px[q] += dx * c * wq; py[q] += dy * c * wq;
      px[a] -= dx * c * ws * (1 - t); py[a] -= dy * c * ws * (1 - t); px[b] -= dx * c * ws * t; py[b] -= dy * c * ws * t;
    }
  }
  function pushSegmentOffCorner(a, b, cx0, cy0) {
    const sx = px[b] - px[a], sy = py[b] - py[a], l2 = sx * sx + sy * sy || 1e-6;
    let t = ((cx0 - px[a]) * sx + (cy0 - py[a]) * sy) / l2; t = clamp(t, 0, 1);
    const qx = px[a] + sx * t, qy = py[a] + sy * t, dx = qx - cx0, dy = qy - cy0, d = Math.hypot(dx, dy) || 1e-6;
    if (d < rw) { const c = (rw - d) / d; px[a] += dx * c * (1 - t); py[a] += dy * c * (1 - t); px[b] += dx * c * t; py[b] += dy * c * t; }
  }
  const landed = [], landedPrev = [];
  function collideStairs(i) {
    for (let k = -1; k <= 5; k++) {
      const xa = k === 0 ? -1e5 : (k - 1) * stepW, xb = k === 0 ? 0 : k === 5 ? 1e5 : k * stepW, tp = top(k), bt = tp - 4 * R;
      if (px[i] > xa - rw && px[i] < xb + rw && py[i] < tp + rw && py[i] > bt) {
        const up = tp + rw - py[i], left = px[i] - (xa - rw), right = (xb + rw) - px[i];
        if (up <= left && up <= right) { py[i] += up; landed[i] = 1; if (vy[i] < 0) vy[i] = 0; vx[i] *= 1 - P.grip * 0.05; }
        else if (left < right) { px[i] -= left; if (vx[i] > 0) vx[i] = 0; } else { px[i] += right; if (vx[i] < 0) vx[i] = 0; }
      }
    }
  }
  // the substep: velocities come from the positions the constraints settled on
  function substep(h) {
    const M = 2 * N, x0 = new Float32Array(px), y0 = new Float32Array(py), vyPre = Float32Array.from(vy);
    landedPrev.length = M; for (let i = 0; i < M; i++) landedPrev[i] = landed[i] || 0;
    landed.length = M; landed.fill(0);
    step(h);
    // landing on a step: some of the fall comes back
    for (let i = 0; i < M; i++) { vx[i] = (px[i] - x0[i]) / h; vy[i] = (py[i] - y0[i]) / h; if (landed[i] && vyPre[i] < -R * 2) vy[i] = -vyPre[i] * P.bounce; const sp = Math.hypot(vx[i], vy[i]); if (sp > 40 * R) { vx[i] *= 40 * R / sp; vy[i] *= 40 * R / sp; } }
  }

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
      list.push({ cx, cy, ux, uy, z: project([cx, cy, 0], r, 0, 0)[2] });
    }
    list.sort((a, b) => a.z - b.z);
    ctx.lineWidth = Math.max(2, R * P.wire);
    for (const c of list) {
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = i / 40 * Math.PI * 2, cs = Math.cos(a) * R, sn = Math.sin(a) * R, q = project([c.cx + c.ux * cs, c.cy + c.uy * cs, sn], r, ox, oy);
        i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
      }
      ctx.stroke();
    }
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
    if (grab && performance.now() - grab.t < 250) { const i = grab.i; vx[i] += R * 18 * P.push; vy[i] += R * 6 * P.push; }   // a tap: nudge that end forward
    grab = null; V.orbit.end(); pid = null;
  }));
  offs.push(stage.on('resize', build));
  build();

  function stepAll() { for (let s = 0; s < 4; s++) substep(1 / 240); }
  offs.push(stage.frame((dt) => { if (V.mode !== 'stairs') return; acc = Math.min(acc + dt, 0.05); while (acc >= 1 / 60) { acc -= 1 / 60; stepAll(); } draw(); }));

  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  return {
    tune: {
      title: 'Slinky (physical)', values: P, defaults: DEFAULTS,
      groups: [
        { name: 'Wire', items: [Ctl('spring', 'Spring stiffness (low = soft)', 20, 2000, 10), Ctl('gap', 'Closest the coils get (re-forms)', 0.02, 0.3, 0.005), Ctl('arch', 'Coils on the arch at the start (re-forms)', 3, 14, 1), Ctl('pack', 'Spacing in the stack (re-forms)', 0.1, 0.6, 0.01), Ctl('archW', 'Arch width (re-forms)', 1, 4, 0.1), Ctl('archH', 'Arch height (re-forms)', 0.5, 3, 0.1), Ctl('coils', 'Coils (re-forms)', 8, 40, 1), Ctl('size', 'Coil radius (re-forms)', 0.05, 0.14, 0.005)] },
        { name: 'World', items: [Ctl('gravity', 'Gravity', 4, 60, 1), Ctl('grip', 'Grip of the stairs', 0, 1, 0.05), Ctl('bounce', 'Bounce off the steps', 0, 0.95, 0.01), Ctl('damping', 'Air damping', 0, 4, 0.1), Ctl('flat', 'Loose coils lie flat', 0, 2, 0.05), Ctl('lean', 'Most a ring may lean off the path (deg)', 20, 85, 1), Ctl('shear', 'Diagonal wire (tension squares the rings)', 0, 3, 0.05), Ctl('align', 'Tension squares the rings to the axis', 0, 0.5, 0.01), Ctl('stepW', 'Step width (re-forms)', 3, 14, 0.1), Ctl('drop', 'Step drop (re-forms)', 0.4, 2.5, 0.05)] },
        { name: 'Touch', items: [Ctl('push', 'Tap push', 0, 3, 0.05)] },
        { name: 'View', items: [Ctl('wire', 'Wire thickness', 0.02, 0.2, 0.005), Ctl('yaw', 'Turn (degrees)', 0, 90, 1), Ctl('pitch', 'Tilt (degrees)', 0, 70, 1)] },
      ],
      actions: { 'Nudge it': () => { const i = 0; vx[i] += R * 18 * P.push; vy[i] += R * 6 * P.push; }, 'Re-form': build },
      set(key, value) { P[key] = value; if (key === 'yaw' || key === 'pitch') { V.iso.yaw = P.yaw; V.iso.pitch = P.pitch; V.setView('iso'); } if (['coils', 'size', 'gap', 'arch', 'pack', 'archW', 'archH', 'stepW', 'drop', 'settle', 'shear', 'cross'].includes(key)) build(); else { g = P.gravity * R; } },
      reset() { Object.assign(P, DEFAULTS); build(); },
    },
    debug: { cam: () => ({ ...cam }), kick: (i, ax, ay) => { vx[i] += R * ax; vy[i] += R * ay; }, run: (n) => { for (let i = 0; i < n; i++) stepAll(); draw(); }, state: () => ({ N, R, px: Array.from(px), py: Array.from(py), stepW, Hs }), nudge: (f = 1) => { vx[0] += R * 18 * f; vy[0] += R * 6 * f; } },
    destroy() { offs.forEach((f) => f()); },
  };
}
