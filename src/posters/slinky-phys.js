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

export function mountPhys(stage) {
  const ctx = stage.canvas.getContext('2d');
  const dark = !!stage.flip;
  const ink = dark ? '#fff' : '#000', paper = dark ? '#000' : '#fff';
  stage.setBackdrop(dark ? 0 : 1);
  const offs = [];

  const DEFAULTS = {
    coils: 20, size: 0.085, wire: 0.05,               // number of coils, coil radius (of the shorter screen side), wire thickness drawn (of the radius)
    spring: 900, gap: 0.075, arch: 7, pack: 0.3, archW: 2.4, archH: 1.6,                // stiffness of the wire between coils, closest approach between coils (of the radius), starting lean of the stack (degrees from upright)
    gravity: 26, grip: 0.55, damping: 0.6,             // gravity (radii per s^2), how much the stairs grip (0 slides), air damping (per s)
    stepW: 7.5, drop: 1.15, push: 1.0,                 // width and drop of a step (radii), the strength of the tap
    yaw: 32, pitch: 24,                                // the view (degrees)
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
  }
  // index: top of coil i is 2i, bottom 2i+1

  function step(h) {
    const k = P.spring, dmin = R * P.gap + rw, M = 2 * N;
    // forces: gravity, and the zero-length springs between neighbouring coils (top to top, bottom to bottom)
    for (let i = 0; i < M; i++) { vy[i] -= g * h; }
    for (let i = 0; i < N - 1; i++) for (const e of [0, 1]) {
      const a = 2 * i + e, b = 2 * (i + 1) + e, dx = px[b] - px[a], dy = py[b] - py[a];
      vx[a] += k * dx * h; vy[a] += k * dy * h; vx[b] -= k * dx * h; vy[b] -= k * dy * h;
    }
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
      for (let i = 0; i < N; i++) for (let k2 = -1; k2 <= 4; k2++) pushSegmentOffCorner(2 * i, 2 * i + 1, stepX(k2 + 1)[1], top(k2));   // the edges of the steps
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
  function collideStairs(i) {
    for (let k = -1; k <= 5; k++) {
      const xa = k === 0 ? -1e5 : (k - 1) * stepW, xb = k === 0 ? 0 : k * stepW, tp = top(k), bt = tp - 4 * R;
      if (px[i] > xa - rw && px[i] < xb + rw && py[i] < tp + rw && py[i] > bt) {
        const up = tp + rw - py[i], left = px[i] - (xa - rw), right = (xb + rw) - px[i];
        if (up <= left && up <= right) { py[i] += up; if (vy[i] < 0) vy[i] = 0; vx[i] *= 1 - P.grip * 0.05; }
        else if (left < right) { px[i] -= left; if (vx[i] > 0) vx[i] = 0; } else { px[i] += right; if (vx[i] < 0) vx[i] = 0; }
      }
    }
  }
  // the substep: velocities come from the positions the constraints settled on
  function substep(h) {
    const M = 2 * N, x0 = new Float32Array(px), y0 = new Float32Array(py);
    step(h);
    for (let i = 0; i < M; i++) { vx[i] = (px[i] - x0[i]) / h; vy[i] = (py[i] - y0[i]) / h; const sp = Math.hypot(vx[i], vy[i]); if (sp > 40 * R) { vx[i] *= 40 * R / sp; vy[i] *= 40 * R / sp; } }
  }

  // ---------- the view ----------
  const rot = () => { const y = P.yaw * Math.PI / 180, x = -P.pitch * Math.PI / 180; return { cy: Math.cos(y), sy: Math.sin(y), cx: Math.cos(x), sx: Math.sin(x) }; };
  const project = (v, r, ox, oy) => { const x1 = r.cy * v[0] + r.sy * v[2], z1 = -r.sy * v[0] + r.cy * v[2], y2 = r.cx * v[1] - r.sx * z1; return [ox + x1, oy - y2, r.sx * v[1] + r.cx * z1]; };
  function origin(r) { const o = project([cam.x, cam.y, 0], r, 0, 0); return [W / 2 - o[0], H / 2 + o[1]]; }

  function draw() {
    ctx.setTransform(stage.pw / W, 0, 0, stage.ph / H, 0, 0);
    ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H);
    // the camera follows the slinky
    let mx = 0, my = 0; for (let i = 0; i < 2 * N; i++) { mx += px[i]; my += py[i]; } mx /= 2 * N; my /= 2 * N;
    cam.x += (mx - cam.x) * 0.06; cam.y += (my - cam.y) * 0.06;
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
  // the pointer's position on the plane of the slinky (z = 0), inverting the view
  function onPlane(q) { const r = rot(), [ox, oy] = origin(r), x = (q.x - ox) / r.cy, y = ((oy - q.y) - r.sx * r.sy * x) / r.cx; return [x, y]; }
  offs.push(stage.on('down', (q, e) => {
    if (pid !== null) return;
    pid = e.pointerId; const i = endPoint(q); tapT = performance.now();
    if (i !== null) { const [wx, wy] = onPlane(q); grab = { i, x: wx, y: wy, t: performance.now() }; }
  }));
  offs.push(stage.on('move', (q, e) => { if (grab && e.pointerId === pid) { const [wx, wy] = onPlane(q); grab.x = wx; grab.y = wy; } }));
  offs.push(stage.on('up', (q, e) => {
    if (e.pointerId !== pid) return;
    if (grab && performance.now() - grab.t < 250) { const i = grab.i; vx[i] += R * 18 * P.push; vy[i] += R * 6 * P.push; }   // a tap: nudge that end forward
    grab = null; pid = null;
  }));
  offs.push(stage.on('resize', build));
  build();

  function stepAll() { for (let s = 0; s < 4; s++) substep(1 / 240); }
  offs.push(stage.frame((dt) => { acc = Math.min(acc + dt, 0.05); while (acc >= 1 / 60) { acc -= 1 / 60; stepAll(); } draw(); }));

  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  return {
    tune: {
      title: 'Slinky (physical)', values: P, defaults: DEFAULTS,
      groups: [
        { name: 'Wire', items: [Ctl('spring', 'Spring stiffness (low = soft)', 20, 2000, 10), Ctl('gap', 'Closest the coils get (re-forms)', 0.02, 0.3, 0.005), Ctl('arch', 'Coils on the arch at the start (re-forms)', 3, 14, 1), Ctl('pack', 'Spacing in the stack (re-forms)', 0.1, 0.6, 0.01), Ctl('archW', 'Arch width (re-forms)', 1, 4, 0.1), Ctl('archH', 'Arch height (re-forms)', 0.5, 3, 0.1), Ctl('coils', 'Coils (re-forms)', 8, 40, 1), Ctl('size', 'Coil radius (re-forms)', 0.05, 0.14, 0.005)] },
        { name: 'World', items: [Ctl('gravity', 'Gravity', 4, 60, 1), Ctl('grip', 'Grip of the stairs', 0, 1, 0.05), Ctl('damping', 'Air damping', 0, 4, 0.1), Ctl('stepW', 'Step width (re-forms)', 3, 14, 0.1), Ctl('drop', 'Step drop (re-forms)', 0.4, 2.5, 0.05)] },
        { name: 'Touch', items: [Ctl('push', 'Tap push', 0, 3, 0.05)] },
        { name: 'View', items: [Ctl('wire', 'Wire thickness', 0.02, 0.2, 0.005), Ctl('yaw', 'Turn (degrees)', 0, 90, 1), Ctl('pitch', 'Tilt (degrees)', 0, 70, 1)] },
      ],
      actions: { 'Nudge it': () => { const i = 0; vx[i] += R * 18 * P.push; vy[i] += R * 6 * P.push; }, 'Re-form': build },
      set(key, value) { P[key] = value; if (['coils', 'size', 'gap', 'arch', 'pack', 'archW', 'archH', 'stepW', 'drop'].includes(key)) build(); else { g = P.gravity * R; } },
      reset() { Object.assign(P, DEFAULTS); build(); },
    },
    debug: { kick: (i, ax, ay) => { vx[i] += R * ax; vy[i] += R * ay; }, run: (n) => { for (let i = 0; i < n; i++) stepAll(); draw(); }, state: () => ({ N, R, px: Array.from(px), py: Array.from(py), stepW, Hs }), nudge: (f = 1) => { vx[0] += R * 18 * f; vy[0] += R * 6 * f; } },
    destroy() { offs.forEach((f) => f()); stage.setBackdrop(null); },
  };
}
