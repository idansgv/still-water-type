// The Slinky, as rigid rings. The solver both scenes (the stairs and the factory) share.
//
// Seen from the side every coil is a rod (the ring edge-on) with a centre, an angle, a velocity and a spin: a rigid body with mass 1 and the inertia of two end masses. Nothing is
// constrained and nothing snaps; everything is a force, so a ring can never be flung or turned inside out by a correction:
//   - the wire: zero-length springs from the top of one ring to the top of the next, and bottom to bottom (so it stretches a long way and stacks tight), damped; and optional diagonals;
//   - a ring leans off square to the path through its neighbours only so far (a soft limit, a torque that grows past `lean`): what keeps an arch of rings fanned across its path;
//   - rings push each other off (segment to segment, springs with a little damping), neighbours and the next few, so a pile builds and nothing passes through;
//   - the world (steps as boxes, a floor): penalty contact at the ring's ends and at the corners of the steps, with friction and a bounce.
// Units: pixels and seconds, y up. Gravity and the stiffness are accelerations (mass 1).

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createRings(cap) {
  const S = {
    n: 0, cap,
    x: new Float64Array(cap), y: new Float64Array(cap), a: new Float64Array(cap), vx: new Float64Array(cap), vy: new Float64Array(cap), w: new Float64Array(cap),
    kin: new Uint8Array(cap), im: new Float64Array(cap).fill(1), capSign: new Int8Array(cap),   // im: a ring's inertia scale (the caps are heavier); capSign: +1 or -1 on an end ring, the side of its normal that faces away from the body, fixed when the chain is made
                    // 1: moved by hand (the spout), not by forces
    fx: new Float64Array(cap), fy: new Float64Array(cap), tq: new Float64Array(cap),
    touched: new Uint8Array(2 * cap),            // the end (2i top, 2i+1 bottom) rests on the world
    touchedPrev: new Uint8Array(2 * cap),
    step, endsOf, setFromEnds, impulseAt, point, setCaps,
  };
  const seg = { s: 0, t: 0, d: 0, ax: 0, ay: 0, bx: 0, by: 0 };

  // the closest points of two segments (a..b and c..d); fills seg.{s,t,d,ax,ay,bx,by}
  function segSeg(ax, ay, bx, by, cx, cy, dx, dy) {
    const ux = bx - ax, uy = by - ay, vx = dx - cx, vy = dy - cy, wx = ax - cx, wy = ay - cy;
    const A = ux * ux + uy * uy, B = ux * vx + uy * vy, C = vx * vx + vy * vy, D = ux * wx + uy * wy, E = vx * wx + vy * wy, den = A * C - B * B;
    let s, t;
    s = den > 1e-9 ? clamp((B * E - C * D) / den, 0, 1) : 0;
    t = C > 1e-12 ? (B * s + E) / C : 0;
    if (t < 0) { t = 0; s = A > 1e-12 ? clamp(-D / A, 0, 1) : 0; } else if (t > 1) { t = 1; s = A > 1e-12 ? clamp((B - D) / A, 0, 1) : 0; }
    seg.s = s; seg.t = t; seg.ax = ax + ux * s; seg.ay = ay + uy * s; seg.bx = cx + vx * t; seg.by = cy + vy * t; seg.d = Math.hypot(seg.bx - seg.ax, seg.by - seg.ay);
  }

  function point(i, e, R) { const s = e ? -R : R, c = Math.cos(S.a[i]), sn = Math.sin(S.a[i]); return [S.x[i] + c * s, S.y[i] + sn * s]; }
  // the two ends of every ring into arrays (top 2i, bottom 2i+1)
  function endsOf(R, px, py) { for (let i = 0; i < S.n; i++) { const c = Math.cos(S.a[i]) * R, s = Math.sin(S.a[i]) * R; px[2 * i] = S.x[i] + c; py[2 * i] = S.y[i] + s; px[2 * i + 1] = S.x[i] - c; py[2 * i + 1] = S.y[i] - s; } }
  function setFromEnds(n, px, py) { S.n = n; for (let i = 0; i < n; i++) { S.x[i] = (px[2 * i] + px[2 * i + 1]) / 2; S.y[i] = (py[2 * i] + py[2 * i + 1]) / 2; S.a[i] = Math.atan2(py[2 * i] - py[2 * i + 1], px[2 * i] - px[2 * i + 1]); S.vx[i] = S.vy[i] = S.w[i] = 0; S.kin[i] = 0; } S.touched.fill(0); S.touchedPrev.fill(0); S.im.fill(1); S.capSign.fill(0); }
  // The caps: the first and the last ring, each heavier by `im`, each with a fixed facing (its normal times capSign) chosen to point away from the body as the chain stands now.
  function setCaps(im) {
    const n = S.n; S.capSign.fill(0); S.im.fill(1); if (n < 2) return;
    for (const [i, j] of [[0, 1], [n - 1, n - 2]]) { const nx = -Math.sin(S.a[i]), ny = Math.cos(S.a[i]); S.capSign[i] = nx * (S.x[i] - S.x[j]) + ny * (S.y[i] - S.y[j]) >= 0 ? 1 : -1; S.im[i] = im; }
  }
  // a push at an end of a ring (a tap): linear and angular
  function impulseAt(pt, jx, jy, R, I) { const i = pt >> 1, s = pt & 1 ? -R : R, rx = Math.cos(S.a[i]) * s, ry = Math.sin(S.a[i]) * s; S.vx[i] += jx; S.vy[i] += jy; S.w[i] += (rx * jy - ry * jx) / I; }

  // env: { R, g, k, kd, l0, cw, kc, cc, dmin, rw, kw, cwall, mu, cf, inertia, lean, kl, wdamp, air, boxes:[[xa,xb,top]], grab:{pt,x,y}|null, reach }
  function step(h, env) {
    const n = S.n, R = env.R, x = S.x, y = S.y, a = S.a, vx = S.vx, vy = S.vy, w = S.w, fx = S.fx, fy = S.fy, tq = S.tq, I = R * R * env.inertia;
    S.touchedPrev.set(S.touched); S.touched.fill(0);
    for (let i = 0; i < n; i++) { fx[i] = 0; fy[i] = -env.g; tq[i] = 0; }
    const ux = new Float64Array(n), uy = new Float64Array(n);
    for (let i = 0; i < n; i++) { ux[i] = Math.cos(a[i]); uy[i] = Math.sin(a[i]); }
    const add = (i, rx, ry, Fx, Fy) => { fx[i] += Fx; fy[i] += Fy; tq[i] += rx * Fy - ry * Fx; };

    // ---- the wire ----
    const k = env.k, kd = env.kd, cw = env.cw;
    for (let i = 0; i < n - 1; i++) {
      const j = i + 1;
      for (let e = 0; e < 2; e++) {
        const si = e ? -R : R, rix = ux[i] * si, riy = uy[i] * si, rjx = ux[j] * si, rjy = uy[j] * si;                       // top to top, bottom to bottom
        const dx = (x[j] + rjx) - (x[i] + rix), dy = (y[j] + rjy) - (y[i] + riy);
        const dvx = (vx[j] - w[j] * rjy) - (vx[i] - w[i] * riy), dvy = (vy[j] + w[j] * rjx) - (vy[i] + w[i] * rix);
        const Fx = k * dx + cw * dvx, Fy = k * dy + cw * dvy;
        add(i, rix, riy, Fx, Fy); add(j, rjx, rjy, -Fx, -Fy);
      }
      if (kd > 0) for (let e = 0; e < 2; e++) {                                                                               // the diagonals: top of one to bottom of the next, rest length l0
        const si = e ? -R : R, sj = -si, rix = ux[i] * si, riy = uy[i] * si, rjx = ux[j] * sj, rjy = uy[j] * sj;
        const dx = (x[j] + rjx) - (x[i] + rix), dy = (y[j] + rjy) - (y[i] + riy), d = Math.hypot(dx, dy) || 1e-6, f = kd * (d - env.l0) / d;
        const dvx = (vx[j] - w[j] * rjy) - (vx[i] - w[i] * riy), dvy = (vy[j] + w[j] * rjx) - (vy[i] + w[i] * rix);
        const Fx = f * dx + cw * dvx * 0.5, Fy = f * dy + cw * dvy * 0.5;
        add(i, rix, riy, Fx, Fy); add(j, rjx, rjy, -Fx, -Fy);
      }
    }

    // ---- a ring leans off square to the path only so far ----
    const lean = env.lean, kl = env.kl;
    if (kl > 0) for (let i = 0; i < n; i++) {
      const a0 = i > 0 ? i - 1 : i, b0 = i < n - 1 ? i + 1 : i; if (a0 === b0) continue;
      const dx = x[b0] - x[a0], dy = y[b0] - y[a0], dl2 = dx * dx + dy * dy; if (dl2 < 1e-6) continue;
      let phi = a[i] - Math.atan2(dy, dx) - Math.PI / 2; phi -= Math.PI * 2 * Math.round(phi / (Math.PI * 2));              // into (-pi, pi]
      if (phi > Math.PI / 2) phi -= Math.PI; else if (phi < -Math.PI / 2) phi += Math.PI;                                    // a ring is the same turned over, for this
      const over = Math.abs(phi) - lean; if (over <= 0) continue;
      const sg = phi > 0 ? 1 : -1, t = kl * over * sg;
      tq[i] -= t + env.kla * w[i];                                                                                          // the torque back, a little damped
      const pxn = -dy / dl2, pyn = dx / dl2;                                                                                // the same couple on the chord's ends
      fx[b0] += t * pxn; fy[b0] += t * pyn; fx[a0] -= t * pxn; fy[a0] -= t * pyn;
    }

    // ---- the first and last ring want to lie flat: with nothing on one side to hold them up, a ring on the floor settles square to it (torque toward horizontal, firmer on the floor) ----
    if (env.endFlat > 0 && n > 1) for (let q = 0; q < 2; q++) {
      const i = q ? n - 1 : 0, rest = S.touchedPrev[2 * i] || S.touchedPrev[2 * i + 1] ? 1 : 0.3;
      tq[i] -= env.endFlat * rest * Math.sin(2 * a[i]) + env.kla * 0.5 * rest * w[i];
    }

    // ---- rings push each other off ----
    const dmin = env.dmin, kc = env.kc, cc = env.cc, reach = (2 * R + dmin) * (2 * R + dmin), J = env.reach;
    for (let i = 0; i < n; i++) {
      const ax = x[i] + ux[i] * R, ay = y[i] + uy[i] * R, bx = x[i] - ux[i] * R, by = y[i] - uy[i] * R;
      for (let j = i + 1; j < n && j <= i + J; j++) {
        const cx0 = x[j] - x[i], cy0 = y[j] - y[i]; if (cx0 * cx0 + cy0 * cy0 > reach) continue;
        segSeg(ax, ay, bx, by, x[j] + ux[j] * R, y[j] + uy[j] * R, x[j] - ux[j] * R, y[j] - uy[j] * R);
        if (seg.d >= dmin) continue;
        let nx, ny; if (seg.d > 1e-5) { nx = (seg.bx - seg.ax) / seg.d; ny = (seg.by - seg.ay) / seg.d; } else { const l = Math.hypot(cx0, cy0) || 1; nx = cx0 / l; ny = cy0 / l; }
        const rix = seg.ax - x[i], riy = seg.ay - y[i], rjx = seg.bx - x[j], rjy = seg.by - y[j];
        const vn = ((vx[j] - w[j] * rjy) - (vx[i] - w[i] * riy)) * nx + ((vy[j] + w[j] * rjx) - (vy[i] + w[i] * rix)) * ny;
        const F = kc * (dmin - seg.d) + cc * Math.max(0, -vn);
        add(j, rjx, rjy, F * nx, F * ny); add(i, rix, riy, -F * nx, -F * ny);
      }
    }

    // ---- the world: the ends of the rings, and the corners of the steps ----
    const boxes = env.boxes, kw = env.kw, cwall = env.cwall, mu = env.mu, cf = env.cf, rw = env.rw;
    for (let i = 0; i < n; i++) for (let e = 0; e < 2; e++) {
      const s = e ? -R : R, rx = ux[i] * s, ry = uy[i] * s, px = x[i] + rx, py = y[i] + ry;
      for (let b = 0; b < boxes.length; b++) {
        const xa = boxes[b][0], xb = boxes[b][1], top = boxes[b][2];
        const up = top + rw - py, dl = px - (xa - rw), dr = (xb + rw) - px;
        if (up <= 0 || dl <= 0 || dr <= 0 || py < top - 4 * R) continue;
        let nx = 0, ny = 1, depth = up; if (dl < depth) { depth = dl; nx = -1; ny = 0; } if (dr < depth) { depth = dr; nx = 1; ny = 0; }
        const pvx = vx[i] - w[i] * ry, pvy = vy[i] + w[i] * rx, vn = pvx * nx + pvy * ny;
        const Fn = kw * depth + cwall * Math.max(0, -vn);
        let Fx = Fn * nx, Fy = Fn * ny;
        const tx = -ny, ty = nx, vt = pvx * tx + pvy * ty, Ft = clamp(-cf * vt, -mu * Fn, mu * Fn);                          // friction along the surface, never more than mu of the push
        Fx += Ft * tx; Fy += Ft * ty;
        add(i, rx, ry, Fx, Fy); S.touched[2 * i + e] = 1;
      }
    }
    for (let b = 0; b < boxes.length; b++) for (let side = 0; side < 2; side++) {                                           // corners: the top left and the top right of each box
      if ((side === 0 && boxes[b][0] < -1e5) || (side === 1 && boxes[b][1] > 1e5)) continue;
      const cx = side ? boxes[b][1] : boxes[b][0], cy = boxes[b][2];
      for (let i = 0; i < n; i++) {
        if (Math.abs(x[i] - cx) > R + rw || Math.abs(y[i] - cy) > R + rw) continue;
        const sx = x[i] + ux[i] * R, sy = y[i] + uy[i] * R, ex = x[i] - ux[i] * R, ey = y[i] - uy[i] * R, vx0 = ex - sx, vy0 = ey - sy, l2 = vx0 * vx0 + vy0 * vy0 || 1e-6;
        const t = clamp(((cx - sx) * vx0 + (cy - sy) * vy0) / l2, 0, 1), qx = sx + vx0 * t, qy = sy + vy0 * t, dx = qx - cx, dy = qy - cy, d = Math.hypot(dx, dy);
        if (d >= rw) continue;
        const nx = d > 1e-6 ? dx / d : 0, ny = d > 1e-6 ? dy / d : 1, rx = qx - x[i], ry = qy - y[i], vn = (vx[i] - w[i] * ry) * nx + (vy[i] + w[i] * rx) * ny;
        const F = kw * (rw - d) + cwall * Math.max(0, -vn); add(i, rx, ry, F * nx, F * ny);
      }
    }

    // ---- a hand on one end ----
    if (env.grab) {
      const g = env.grab, i = g.pt >> 1, s = g.pt & 1 ? -R : R, rx = ux[i] * s, ry = uy[i] * s, px = x[i] + rx, py = y[i] + ry;
      const pvx = vx[i] - w[i] * ry, pvy = vy[i] + w[i] * rx;
      add(i, rx, ry, (g.x - px) * 900 - pvx * 14, (g.y - py) * 900 - pvy * 14);
    }

    // ---- move ----
    const air = Math.exp(-env.air * h), wd = Math.exp(-env.wdamp * h), vmax = 70 * R, wmax = 400;
    for (let i = 0; i < n; i++) {
      if (S.kin[i]) { x[i] += vx[i] * h; y[i] += vy[i] * h; a[i] += w[i] * h; continue; }
      vx[i] = (vx[i] + fx[i] * h) * air; vy[i] = (vy[i] + fy[i] * h) * air; w[i] = (w[i] + tq[i] / (I * S.im[i]) * h) * wd;
      const sp = Math.hypot(vx[i], vy[i]); if (sp > vmax) { vx[i] *= vmax / sp; vy[i] *= vmax / sp; } w[i] = clamp(w[i], -wmax, wmax);
      x[i] += vx[i] * h; y[i] += vy[i] * h; a[i] += w[i] * h;
    }
  }
  return S;
}
