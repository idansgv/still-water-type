// Slinky, walk mode. A Slinky going down a staircase, after the CSS case study "A CSS Slinky in 3D": the walk is a wave of
// flips. Coils leave the stack on the upper step one after another, go up and over an arch, and land on the lower step, where
// they stack up. When the last one has landed, the stack is the new upper stack and the arch forms over the next edge.
//
// How it is built. Every coil is a circle in 3D whose plane is perpendicular to the path at that point, so as a coil travels over the
// arch it turns over. All the coils share one path: the stack on the upper step, the arch (stretched: the coils are far apart there),
// the stack on the lower step (squeezed together). A single number, the progress p, says how far the coils have travelled; coil j sits
// at the place for "j minus p", so the wave of coils is just p growing. A tap walks one full step, holding keeps walking, and
// dragging an end of the slinky sideways scrubs it forward or back. One colour: black on white, or white on black on every second shuffle.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function mountWalk(stage) {
  const ctx = stage.canvas.getContext('2d');
  const dark = !!stage.flip;
  const ink = dark ? '#fff' : '#000', paper = dark ? '#000' : '#fff';
  stage.setBackdrop(dark ? 0 : 1);
  const offs = [];

  const DEFAULTS = {
    coils: 22, size: 0.085, wire: 0.045,              // number of coils, coil radius (of the shorter screen side), wire thickness (of the radius)
    pack: 0.17, arch: 3.4, archW: 2.3, archH: 1.7, drop: 1.05,  // spacing of a stacked coil, arch width and height, and the step's drop (all in coil radii)
    speed: 7, ease: 0.9,                              // coils per second at full speed, how gently it starts (s)
    yaw: 32, pitch: 24, follow: 3,                    // the view (degrees), how closely the camera follows
  };
  const P = { ...DEFAULTS };

  let W = 1, H = 1, R = 60, N = 24, A = 8, cycle = 0, p = -8, vp = 0, target = null, holding = false, cam = { x: 0, y: 0 }, pointerId = null, drag = null, acc = 0;
  let archPts = [], archLen = 0;

  // the world: x to the right, y up, z toward you (all in pixels). The view is an orthographic tilt, as in the case study.
  const rot = () => { const y = P.yaw * Math.PI / 180, x = -P.pitch * Math.PI / 180; return { cy: Math.cos(y), sy: Math.sin(y), cx: Math.cos(x), sx: Math.sin(x) }; };
  const project = (v, r, cx, cy) => {
    const x1 = r.cy * v[0] + r.sy * v[2], z1 = -r.sy * v[0] + r.cy * v[2];
    const y2 = r.cx * v[1] - r.sx * z1, z2 = r.sx * v[1] + r.cx * z1;
    return [cx + x1, cy - y2, z2];
  };

  // the arch: a curve from the edge of the upper step up and over to the landing on the lower step, with the coil centres on it
  function frameGeom() {
    R = Math.min(W, H) * P.size; N = Math.round(P.coils);
    const gp = R * P.pack, Wa = R * P.archW, Ha = R * P.archH, Hs = R * P.drop;
    const E = [0, R], L = [Wa, R - Hs], C = [Wa * 0.12, R + Ha * 1.9];
    archPts = []; archLen = 0;
    let prev = null;
    for (let i = 0; i <= 80; i++) {
      const s = i / 80, x = (1 - s) * (1 - s) * E[0] + 2 * (1 - s) * s * C[0] + s * s * L[0], y = (1 - s) * (1 - s) * E[1] + 2 * (1 - s) * s * C[1] + s * s * L[1];
      if (prev) archLen += Math.hypot(x - prev[0], y - prev[1]);
      archPts.push([x, y, archLen]); prev = [x, y];
    }
    A = Math.max(4, Math.round(archLen / (gp * P.arch)));              // the arch holds about this many coils, spread this many times as far apart as when stacked
    return { gp, Wa, Ha, Hs };
  }
  let geom = null;
  function build() { W = stage.W; H = stage.H; geom = frameGeom(); cycle = 0; p = -A; vp = 0; target = null; cam = { x: geom.Wa * 0.5 + N * geom.gp * 0.3, y: -geom.Hs * 0.2 }; }

  // where coil number j is, for the current progress: position (x, y), and the direction of the path there
  function coilAt(j) {
    const u = j - p, { gp, Wa } = geom;
    if (u < 0) return { x: Wa + (-u) * gp, y: geom.Hs * -1 + R, tx: 1, ty: 0 };                       // landed: the stack on the lower step, oldest farthest
    if (u >= A) return { x: -(u - A) * gp, y: R, tx: 1, ty: 0 };                                       // not yet gone: the stack on the upper step
    const w = u / A, d = archLen * (1 - w);                                                              // on the arch: u = 0 at the landing, u = A at the edge
    let k = 1; while (k < archPts.length - 1 && archPts[k][2] < d) k++;
    const a0 = archPts[k - 1], a1 = archPts[k], t = (d - a0[2]) / ((a1[2] - a0[2]) || 1);
    const dx = a1[0] - a0[0], dy = a1[1] - a0[1], dl = Math.hypot(dx, dy) || 1;
    return { x: a0[0] + (a1[0] - a0[0]) * t, y: a0[1] + (a1[1] - a0[1]) * t, tx: -dx / dl, ty: -dy / dl };   // the path runs from the edge to the landing, but the coils travel the other way round the arch
  }

  function ring(c, r, ox, oy) {
    // a circle perpendicular to the direction (tx, ty, 0): the basis is the depth axis and the third axis
    const T = [c.tx, c.ty, 0], U = [0, 0, 1], V = [T[1] * U[2] - T[2] * U[1], T[2] * U[0] - T[0] * U[2], T[0] * U[1] - T[1] * U[0]];
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = i / 40 * Math.PI * 2, cs = Math.cos(a) * R, sn = Math.sin(a) * R;
      pts.push(project([c.x + U[0] * cs + V[0] * sn, c.y + U[1] * cs + V[1] * sn, U[2] * cs + V[2] * sn], r, ox, oy));
    }
    return pts;
  }

  function draw() {
    ctx.setTransform(stage.pw / W, 0, 0, stage.ph / H, 0, 0);
    ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H);
    const r = rot(), { gp, Wa, Hs } = geom, stepW = Wa + N * gp, depth = R * 2.1;
    // the camera follows the slinky down the stairs
    const wx = cycle * stepW + cam.x, wy = -cycle * Hs + cam.y;
    const ox = W / 2 - project([wx, wy, 0], r, 0, 0)[0], oy = H / 2 + project([wx, wy, 0], r, 0, 0)[1];
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // the stairs: from a couple of steps behind to a couple ahead
    ctx.strokeStyle = ink; ctx.fillStyle = paper; ctx.lineWidth = Math.max(2, R * 0.05);
    for (let rel = 3; rel >= -2; rel--) {                                // steps: rel 0 is the upper step (the stack's), rel 1 the lower one
      const gx = cycle * stepW, gy = -cycle * Hs;
      const xa = gx + (rel - 1) * stepW, xb = gx + rel * stepW, yTop = gy - rel * Hs, yBot = yTop - Hs * 1.4;
      const quad = (pts) => { ctx.beginPath(); pts.forEach((q, i) => { const s2 = project(q, r, ox, oy); i ? ctx.lineTo(s2[0], s2[1]) : ctx.moveTo(s2[0], s2[1]); }); ctx.closePath(); ctx.fill(); ctx.stroke(); };
      quad([[xa, yTop, -depth], [xb, yTop, -depth], [xb, yTop, depth], [xa, yTop, depth]]);                     // the tread
      quad([[xa, yTop, depth], [xb, yTop, depth], [xb, yBot, depth], [xa, yBot, depth]]);                       // the riser facing you
    }
    // the coils, far ones first
    const list = [];
    for (let j = 0; j < N; j++) {
      const c = coilAt(j); c.x += cycle * stepW; c.y += -cycle * Hs; list.push({ c, j, z: project([c.x, c.y, 0], r, 0, 0)[2] });
    }
    list.sort((a, b) => a.z - b.z);
    ctx.lineWidth = Math.max(2, R * P.wire);
    for (const it of list) {
      const pts = ring(it.c, r, ox, oy);
      ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.fillStyle = paper; ctx.globalAlpha = 0.0; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
    }
  }

  // ---------- the walk ----------
  function advance(dt) {
    const full = N, endP = full;                                           // a cycle runs p from -A to N
    let want = vp;
    if (holding || target !== null) {
      const goal = holding ? P.speed : P.speed * (target !== null && p < target - 0.5 ? 1 : Math.max(0.2, (target - p)));
      want = goal;
    } else want = 0;
    vp += (want - vp) * (1 - Math.exp(-dt / Math.max(0.05, P.ease * 0.25)));
    if (target !== null && p >= target) { p = target; vp = 0; target = null; }
    p += vp * dt;
    while (p >= endP) { p -= (endP + A); cycle++; if (target !== null) target -= (endP + A); }       // the stack on the lower step is the new upper stack
    while (p < -A) { p += (endP + A); cycle--; if (target !== null) target += (endP + A); }
  }

  // ---------- touch ----------
  const endCoils = () => { const r = rot(), { gp, Wa, Hs } = geom, stepW = Wa + N * gp; const wx = cycle * stepW + cam.x, wy = -cycle * Hs + cam.y; const o0 = project([wx, wy, 0], r, 0, 0), ox = W / 2 - o0[0], oy = H / 2 + o0[1]; return [0, N - 1].map((j) => { const c = coilAt(j), s = project([c.x + cycle * stepW, c.y - cycle * Hs, 0], r, ox, oy); return { j, x: s[0], y: s[1] }; }); };
  offs.push(stage.on('down', (q, e) => {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    const near = endCoils().find((c) => Math.hypot(q.x - c.x, q.y - c.y) < R * 1.4);
    if (near) drag = { x: q.x, p0: p, moved: 0 };
    else { holding = false; pressT = performance.now(); pressed = true; }
  }));
  let pressT = 0, pressed = false;
  offs.push(stage.on('move', (q, e) => {
    if (e.pointerId !== pointerId) return;
    if (drag) { const dx = q.x - drag.x; drag.moved = Math.max(drag.moved, Math.abs(dx)); p = drag.p0 + dx / (R * 0.28); vp = 0; target = null; }
  }));
  offs.push(stage.on('up', (q, e) => {
    if (e.pointerId !== pointerId) return;
    if (pressed && performance.now() - pressT < 300) { target = Math.max(p, -A) + (N + A) * 1; }            // a tap: walk one whole step
    pressed = false; holding = false; drag = null; pointerId = null;
  }));
  // holding keeps walking
  const holdTick = () => { if (pressed && !drag && performance.now() - pressT > 300) { holding = true; target = null; } };

  offs.push(stage.on('resize', build));
  build();

  function stepAll(dt) { holdTick(); advance(dt); }
  offs.push(stage.frame((dt) => { stepAll(Math.min(dt, 0.05)); draw(); }));

  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  return {
    tune: {
      title: 'Slinky (walk)', values: P, defaults: DEFAULTS,
      groups: [
        { name: 'Walk', items: [Ctl('speed', 'Speed (coils per s)', 1, 24, 0.5), Ctl('ease', 'How gently it starts (s)', 0.1, 3, 0.1)] },
        { name: 'Slinky', items: [Ctl('coils', 'Coils (re-forms)', 8, 60, 1), Ctl('size', 'Coil radius (re-forms)', 0.05, 0.2, 0.005), Ctl('wire', 'Wire thickness', 0.02, 0.2, 0.005), Ctl('pack', 'Spacing when stacked (re-forms)', 0.03, 0.2, 0.005)] },
        { name: 'Stairs', items: [Ctl('arch', 'Coil spacing in the arch (re-forms)', 1.5, 9, 0.1), Ctl('archW', 'Arch width (re-forms)', 1, 4, 0.1), Ctl('archH', 'Arch height (re-forms)', 0.5, 3.5, 0.1), Ctl('drop', 'Step drop (re-forms)', 0.3, 2.2, 0.05)] },
        { name: 'View', items: [Ctl('yaw', 'Turn (degrees)', 0, 90, 1), Ctl('pitch', 'Tilt (degrees)', 0, 70, 1)] },
      ],
      actions: { 'Walk one step': () => { target = Math.max(p, -A) + (N + A); }, 'Re-form': build },
      set(key, value) { P[key] = value; if (['coils', 'size', 'pack', 'arch', 'archW', 'archH', 'drop'].includes(key)) build(); },
      reset() { Object.assign(P, DEFAULTS); build(); },
    },
    debug: { world: (j) => { const c = coilAt(j), { Wa, Hs } = geom, stepW = Wa + N * geom.gp; return [+(c.x + cycle * stepW).toFixed(1), +(c.y - cycle * Hs).toFixed(1)]; }, setP: (v, c = 0) => { p = v; vp = 0; target = null; cycle = c; draw(); }, run: (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) stepAll(dt); draw(); }, state: () => ({ p, vp, cycle, A, N, target }), walk: () => { target = Math.max(p, -A) + (N + A); } },
    destroy() { offs.forEach((f) => f()); stage.setBackdrop(null); },
  };
}
