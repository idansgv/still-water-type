// Shadow. A sculpture planned by the shadow it casts. A frame of bold rods and bars hangs at planned heights and tilts in front of a wall
// under one low, directional light; their long shadows are the letters of IDAN SEGEV (after Kumi Yamashita's wall pieces). At first glance it
// reads as clean type with an object hung in front of it; move the light and the type turns out to be nothing but shadow, because every
// rod is the only thing making its stroke, so each one pulls its piece of letter away.
//
// The light is one far lamp from the right, low, so shadows are long. A point at height z above the wall throws its shadow to
// (x - z * lx, y - z * ly), with |l| large. Moving the light slides every shadow by z times the change: the high rods swing far, the low
// ones barely.
//
// The plan: every stroke of every letter (from lettering.js) is cut into straight runs (curves become short runs). Each run becomes one
// rod (a square beam), whose ends are at the heights the plan gives them, and whose
// screen position follows: a rod end that must shade the point S at height z goes at S + z * l. So the rod's shadow lands exactly on the
// run, and its radius is fitted until the shadow is as wide as the stroke. Heights follow a plane per letter: each letter has its own base
// height (lower in the top row) and its own tilt, so every letter hangs as its own leaning frame, sheared a different way from its
// neighbours, and none of the frames reads as a letter.
//
// Look: shadows are solid ink on the wall; the rods are lit solids (faces tinted by how squarely the light meets them, hairline edges).
// Black on white, then white on black.
//
// Touch: the light's slant follows the pointer (a dragging finger, or a tilt: stage.look); a small plateau around home snaps the letters
// back. A tap on a rod turns it (and its neighbours) a full turn about a random axis. Left alone, the light eases home. Double tap on
// empty space: a new plan (new tilts). Three quick taps: reveal (the page inverts; a ray from every rod to its shadow, and the light). The
// hint: until the first touch, the light swings once, slowly, now and then and returns.
import { createReveal, ink as rvInk, grid, corners, titleBlock } from './reveal.js';
import { SKELETON, radiusFor } from './lettering.js';
import { pressTracker, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';

const smooth = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };

// ---------- the rods ----------
function build3(v, f, round) {                              // faces with outward normals (vertices in px, relative to the part's centre)
  const n = f.map((face) => {
    const [a, b, c] = face.map((i) => v[i]);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
    let x = uy * wz - uz * wy, y = uz * wx - ux * wz, z = ux * wy - uy * wx; const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
    let cx = 0, cy = 0, cz = 0; for (const i of face) { cx += v[i][0]; cy += v[i][1]; cz += v[i][2]; }
    if (x * cx + y * cy + z * cz < 0) { x = -x; y = -y; z = -z; }
    return [x, y, z];
  });
  return { v, f, n, round };
}
// a rod from A to B (3D, px), radius rho, with k sides (12: a cylinder, 4: a square bar), lengthened by ext at both ends
function rodMesh(A, B, rho, k, phase, ext) {
  const ax = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], L = Math.hypot(...ax) || 1, u = ax.map((q) => q / L);
  const t = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  let vx = u[1] * t[2] - u[2] * t[1], vy = u[2] * t[0] - u[0] * t[2], vz = u[0] * t[1] - u[1] * t[0]; const vl = Math.hypot(vx, vy, vz) || 1; vx /= vl; vy /= vl; vz /= vl;
  const wx = u[1] * vz - u[2] * vy, wy = u[2] * vx - u[0] * vz, wz = u[0] * vy - u[1] * vx, h = L / 2 + ext, v = [];
  const R = k === 4 ? rho * Math.SQRT2 : rho;                                // a square bar's rho is its half side
  for (const sgn of [-1, 1]) for (let i = 0; i < k; i++) {
    const a = phase + i / k * Math.PI * 2, c = Math.cos(a) * R, d = Math.sin(a) * R;
    v.push([c * vx + d * wx + sgn * h * u[0], c * vy + d * wy + sgn * h * u[1], c * vz + d * wz + sgn * h * u[2]]);
  }
  const f = []; for (let i = 0; i < k; i++) f.push([i, (i + 1) % k, k + (i + 1) % k, k + i]);
  f.push([...Array(k).keys()]); f.push([...Array(k).keys()].map((i) => k + i));
  return build3(v, f, k > 4);
}
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
// Douglas-Peucker: a curve as straight runs, to within eps
function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length - 1], dx = b.x - a.x, dy = b.y - a.y, dl = Math.hypot(dx, dy) || 1;
  let m = 0, mi = 0; for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((pts[i].x - a.x) * dy - (pts[i].y - a.y) * dx) / dl; if (d > m) { m = d; mi = i; } }
  if (m <= eps) return [a, b];
  return simplify(pts.slice(0, mi + 1), eps).slice(0, -1).concat(simplify(pts.slice(mi), eps));
}

// ---------- small 3x3 rotation helpers ----------
const rotAxis = (ax, ay, az, a) => {
  const l = Math.hypot(ax, ay, az) || 1; ax /= l; ay /= l; az /= l;
  const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [t * ax * ax + c, t * ax * ay - s * az, t * ax * az + s * ay, t * ax * ay + s * az, t * ay * ay + c, t * ay * az - s * ax, t * ax * az - s * ay, t * ay * az + s * ax, t * az * az + c];
};
const mul3 = (A, B) => [A[0] * B[0] + A[1] * B[3] + A[2] * B[6], A[0] * B[1] + A[1] * B[4] + A[2] * B[7], A[0] * B[2] + A[1] * B[5] + A[2] * B[8],
  A[3] * B[0] + A[4] * B[3] + A[5] * B[6], A[3] * B[1] + A[4] * B[4] + A[5] * B[7], A[3] * B[2] + A[4] * B[5] + A[5] * B[8],
  A[6] * B[0] + A[7] * B[3] + A[8] * B[6], A[6] * B[1] + A[7] * B[4] + A[8] * B[7], A[6] * B[2] + A[7] * B[5] + A[8] * B[8]];

function hull(pts) {                                       // convex hull of [x, y] points (monotone chain)
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const inside = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };

// a block's outline on the screen and its shadow on the wall, for the light slant (lx, ly)
function project(mesh, M, x, y, z, r, lx, ly) {          // r scales the mesh (1: it is already in px)
  const v = mesh.v, V = new Array(v.length), SH = new Array(v.length);
  for (let i = 0; i < v.length; i++) {
    const p = v[i], a = M[0] * p[0] + M[1] * p[1] + M[2] * p[2], b = M[3] * p[0] + M[4] * p[1] + M[5] * p[2], c = M[6] * p[0] + M[7] * p[1] + M[8] * p[2];
    const X = x + a * r, Y = y + b * r, Z = Math.max(0, z + c * r);
    V[i] = [X, Y]; SH[i] = [X - Z * lx, Y - Z * ly];
  }
  return { V, SH };
}

export function mount(stage) {
  const c2 = stage.canvas.getContext('2d');
  const dark = !!stage.flip;
  const bg = dark ? '#000' : '#fff', fg = dark ? '#fff' : '#000';
  stage.setBackdrop(dark ? 0 : 1);
  const offs = [];
  let seedBump = 0;

  const DEFAULTS = { slant: 1.5, depth: 0.3, size: 1, tilt: 1, range: 0.5, snap: 0.07, rest: 4 };
  const P = { ...DEFAULTS };
  const DIR = [0.96, -0.28];                                                  // where the light comes from: the upper right, so shadows fall to the lower left
  const home = () => [DIR[0] * P.slant, DIR[1] * P.slant];

  let W = 1, H = 1, shapes = [], tR = 20;
  let dirty = true, now = 0, lastMove = 0, calm = 1, touched = false, idleT = 0, nextDemo = 3.5, demo = null, reformT = 0, lastEmpty = 0, revealed = false, lastLook = [0, 0], lampPos = [0, 0];
  const press = pressTracker();

  // ---------- layout: the same composition as the other type posters ----------
  function layout() {
    const portrait = W / H < 0.85;
    const rows = portrait ? ['IDAN', 'SE', 'GEV'] : ['IDAN', 'SEGEV'];
    const padX = Math.max(14, W * 0.045), top = Math.max(18, H * 0.04), bottom = 96;
    const availW = (W - 2 * padX) * (W / H < 0.85 ? 0.86 : 0.8), availH = H - top - bottom, gap = 0.06;
    const advance = (c, h) => h * (0.6 * SKELETON[c].wf + 2 * (c === 'I' ? 0.11 : Math.min(SKELETON[c].wf * 0.6 * 0.25, c === 'E' ? 0.1 : 0.118)) + gap);
    let h = Infinity;
    for (const row of rows) h = Math.min(h, availW / [...row].reduce((s, c) => s + advance(c, 1), 0));
    const rowGap = 0.02;
    h = Math.min(h, availH / (rows.length * (1.02 + rowGap)));
    const total = rows.length * h * 1.02 + (rows.length - 1) * h * rowGap;
    let y = top + (availH - total) / 2 + h * 0.51;
    const out = [];
    for (const row of rows) {
      const rowW = [...row].reduce((s, c) => s + advance(c, h), 0);
      let x = padX + (availW - rowW) / 2;
      for (const c of row) { const a = advance(c, h); out.push({ ch: c, x: x + a / 2, y, w: SKELETON[c].wf * h, h }); x += a; }
      y += h * (1.02 + rowGap);
    }
    return out;
  }

  // ---------- the plan ----------
  function build() {
    const rand = (() => { let a = (stage.seed ^ (seedBump * 0x9e3779b1)) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
    const poses = layout(), [lx, ly] = home();
    tR = radiusFor(poses[0].ch, poses[0].w, poses[0].h) * 0.8;               // the stroke's half thickness
    const wTarget = tR * 1.75 * P.size, zmax = P.depth * H, zmin = zmax * 0.15, rows = [...new Set(poses.map((q) => Math.round(q.y)))].sort((a, b) => a - b);
    const list = [];
    for (const pose of poses) {
      // this letter's own frame: a base height by row, and a tilt in a direction of its own
      const row = rows.indexOf(Math.round(pose.y)), base = zmax * (rows.length > 1 ? 0.55 + 0.35 * row / (rows.length - 1) : 0.7) * (0.92 + 0.16 * rand());
      // the frame is squeezed along the light: the further a point is toward the light, the lower it hangs, so the rod positions
      // (S + z * l) bunch up along the light's direction by (1 - gam), and a letter's frame stops looking like a letter
      const ln = Math.hypot(lx, ly) || 1, ux = lx / ln, uy = ly / ln, gam = Math.min(0.9, (0.62 + 0.28 * rand()) * P.tilt), gp = (rand() < 0.5 ? -1 : 1) * (0.45 + 0.4 * rand()) * P.tilt;
      const zAt = (X, Y) => { const dx = X - pose.x, dy = Y - pose.y; return Math.max(zmin, Math.min(zmax, base - gam * (dx * ux + dy * uy) / ln + gp * (dx * -uy + dy * ux) / ln)); };
      for (const st of SKELETON[pose.ch].s()) {
        let pts = st.pts.map((q) => ({ x: pose.x + q.x * pose.w, y: pose.y + q.y * pose.h }));
        const curved = !st.sharp;
        if (curved) pts = simplify(pts, tR * 0.36);
        for (let i = 0; i < pts.length - 1; i++) {
          const Sa = pts[i], Sb = pts[i + 1], len = Math.hypot(Sb.x - Sa.x, Sb.y - Sa.y); if (len < tR * 0.4) continue;
          const za = zAt(Sa.x, Sa.y), zb = zAt(Sb.x, Sb.y);
          const A = [Sa.x + za * lx, Sa.y + za * ly, za], B = [Sb.x + zb * lx, Sb.y + zb * ly, zb];
          const k = 4, phase = rand() * Math.PI / 2, ext = wTarget * 0.45;           // square beams throughout: crisp shadows, one material
          // fit the radius so the shadow is as wide as the stroke
          let rho = wTarget * 0.5, m = rodMesh(A, B, rho, k, phase, ext);
          const dx = (Sb.x - Sa.x) / len, dy = (Sb.y - Sa.y) / len, C = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
          for (let it = 0; it < 3; it++) {
            let lo = Infinity, hi = -Infinity;
            for (const v of m.v) { const Z = Math.max(0, C[2] + v[2]), X = C[0] + v[0] - Z * lx, Y = C[1] + v[1] - Z * ly, q = -X * dy + Y * dx; if (q < lo) lo = q; if (q > hi) hi = q; }
            rho *= wTarget / Math.max(1, hi - lo); m = rodMesh(A, B, rho, k, phase, ext);
          }
          list.push({ x: C[0], y: C[1], z: C[2], r: 1, mesh: m, M0: I3, spin: null, hull: null, sh: null, row: i });
        }
      }
    }
    shapes = list.sort((a, b) => a.z - b.z);                                  // low to high, for drawing
    dirty = true;
  }
  const reform = () => { shapes = []; seedBump++; build(); };

  // ---------- the light ----------
  function lamp() {                                                           // the slant: home, plus what the pointer adds (zero on the home plateau)
    const [hx, hy] = home();
    let dx = stage.look.x, dy = -stage.look.y;
    if (demo) { const u = demo.t / demo.dur, a = Math.sin(u * Math.PI) * Math.sin(u * Math.PI * 2); dx += Math.cos(demo.ang) * a * 0.22; dy += Math.sin(demo.ang) * a * 0.22; }
    const r = Math.hypot(dx, dy), s0 = P.snap * 0.5, s1 = P.snap * 1.6;
    const k = r < 1e-6 ? 0 : smooth((r - s0) / (s1 - s0)) * calm;            // a plateau at home, where the letters are exact
    return [hx + dx * k * P.range * P.slant, hy + dy * k * P.range * P.slant];
  }

  // ---------- the frame ----------
  function frame(t) {
    const [lx, ly] = lamp(), ll = Math.hypot(lx, ly, 1);
    c2.setTransform(stage.pw / W, 0, 0, stage.ph / H, 0, 0);
    c2.fillStyle = bg; c2.fillRect(0, 0, W, H);
    for (const s of shapes) {
      let M = s.M0;
      if (s.spin) { const u = (t - s.spin.t0) / s.spin.dur; if (u >= 1) s.spin = null; else if (u > 0) M = mul3(rotAxis(s.spin.ax, s.spin.ay, s.spin.az, Math.PI * 2 * smooth(u)), s.M0); }
      const { V, SH } = project(s.mesh, M, s.x, s.y, s.z, s.r, lx, ly);
      s.V = V; s.M = M; s.sh = hull(SH); s.hull = hull(V);
    }
    c2.beginPath();
    for (const s of shapes) { c2.moveTo(s.sh[0][0], s.sh[0][1]); for (let i = 1; i < s.sh.length; i++) c2.lineTo(s.sh[i][0], s.sh[i][1]); c2.closePath(); }
    c2.fillStyle = fg; c2.fill();                                             // the shadows: solid ink on the wall
    // the blocks, low first; each face is tinted by how squarely the light meets it
    c2.lineJoin = 'round'; c2.lineWidth = 1; const edge = dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)';
    for (const s of shapes) {
      const { f, n, round } = s.mesh, M = s.M, nf = f.length;
      for (let k = 0; k < nf; k++) {
        const nz = M[6] * n[k][0] + M[7] * n[k][1] + M[8] * n[k][2];
        if (nz <= 0.01) continue;                                             // facing away
        const nx = M[0] * n[k][0] + M[1] * n[k][1] + M[2] * n[k][2], ny = M[3] * n[k][0] + M[4] * n[k][1] + M[5] * n[k][2];
        const lit = Math.max(0, (nx * lx + ny * ly + nz) / ll);
        const tone = Math.round(255 * (dark ? 0.1 + 0.42 * lit : 0.42 + 0.56 * lit));
        const q = f[k].map((i) => s.V[i]);
        c2.beginPath(); c2.moveTo(q[0][0], q[0][1]); for (let i = 1; i < q.length; i++) c2.lineTo(q[i][0], q[i][1]); c2.closePath();
        c2.fillStyle = `rgb(${tone},${tone},${tone})`; c2.fill();
        c2.strokeStyle = round && q.length === 4 ? `rgb(${tone},${tone},${tone})` : edge; c2.stroke();   // a round block shows edges on its ends only
      }
    }
    lampPos = [lx, ly];
  }

  // ---------- reveal: a ray from each block to its shadow, the light and its slant ----------
  const rv = createReveal(stage, (c, W_, H_, k) => {
    const col = (x) => rvInk(stage, x), [lx, ly] = lampPos;
    grid(c, W_, H_, 24, col, k); corners(c, W_, H_, 16, col, k);
    c.lineWidth = 0.8;
    for (const s of shapes) {
      const q = s.sh && s.sh.length ? s.sh.reduce((a, p) => [a[0] + p[0] / s.sh.length, a[1] + p[1] / s.sh.length], [0, 0]) : [s.x, s.y];
      c.strokeStyle = col(0.55 * k); c.setLineDash([3, 3]); c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(q[0], q[1]); c.stroke(); c.setLineDash([]);
      c.fillStyle = col(0.9 * k); c.beginPath(); c.arc(s.x, s.y, 2.2, 0, 7); c.fill();
      c.strokeStyle = col(0.9 * k); c.beginPath(); c.moveTo(q[0] - 3.5, q[1]); c.lineTo(q[0] + 3.5, q[1]); c.moveTo(q[0], q[1] - 3.5); c.lineTo(q[0], q[1] + 3.5); c.stroke();
    }
    const cx = W_ - 70, cy = 120, len = Math.hypot(lx, ly) || 1;               // the light: a sun in the corner it comes from, with the way its shadows fall
    c.strokeStyle = col(k); c.lineWidth = 1.4; c.beginPath(); c.arc(cx, cy, 14, 0, 7); c.stroke();
    for (let a = 0; a < 8; a++) { const an = a / 8 * Math.PI * 2; c.beginPath(); c.moveTo(cx + Math.cos(an) * 19, cy + Math.sin(an) * 19); c.lineTo(cx + Math.cos(an) * 26, cy + Math.sin(an) * 26); c.stroke(); }
    c.setLineDash([4, 3]); c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx - lx / len * 70, cy - ly / len * 70); c.stroke(); c.setLineDash([]);
    const z0 = shapes.length ? Math.round(Math.min(...shapes.map((s) => s.z)) / H * 100) : 0, z1 = shapes.length ? Math.round(Math.max(...shapes.map((s) => s.z)) / H * 100) : 0;
    titleBlock(c, W_, H_, ['SHADOW · PLAN', '● rod  ┄ ray  + shadow', `${shapes.length} rods · height ${z0}–${z1}% of the wall`, `light ${Math.round(Math.atan(len) * 57.3)}° from the wall`], col, k);
  });
  offs.push(stage.on('reveal', (on) => { revealed = on; dirty = true; }));

  // ---------- input ----------
  const hitShape = (q) => { for (let i = shapes.length - 1; i >= 0; i--) { const s = shapes[i]; if (s.hull && inside(s.hull, q.x, q.y)) return s; } return null; };
  offs.push(stage.on('down', (q, e) => { press.down(q, e.pointerId); lastMove = now; touched = true; demo = null; dirty = true; }));
  offs.push(stage.on('move', (q, e) => { press.move(q, e.pointerId); lastMove = now; dirty = true; }));
  offs.push(stage.on('up', (q, e) => {
    const r = press.up(q, e.pointerId); lastMove = now; dirty = true;
    if (!r || !r.tap) return;
    const s = hitShape(q);
    if (s) {                                                                  // a tap on a rod: it and its neighbours turn a full turn, the nearest first
      const ax = Math.random() - 0.5, ay = Math.random() - 0.5, az = Math.random() - 0.5;
      for (const o of shapes) { const d = Math.hypot(o.x - s.x, o.y - s.y); if (d < tR * 6) o.spin = { t0: now + d / (tR * 14), dur: 1.1, ax, ay, az }; }
    } else {                                                                  // empty space: two quick taps make a new plan (a beat later, so a third tap can mean reveal)
      const t = performance.now();
      if (t - lastEmpty < DOUBLE_MS) { clearTimeout(reformT); reformT = setTimeout(reform, REFORM_DELAY_MS); }
      lastEmpty = t;
    }
  }));
  offs.push(stage.on('reveal', () => clearTimeout(reformT)));
  function resize() { W = stage.W; H = stage.H; shapes = []; build(); }
  offs.push(stage.on('resize', resize));
  resize();

  offs.push(stage.frame((dt, t) => {
    now = t;
    // the light eases home when left alone, and a finger's drag offset is let go after the same wait
    const idle = now - lastMove;
    if (P.rest > 0 && idle > P.rest) { calm = Math.max(0, calm - dt / 1.2); if (stage.ptr.type !== 'mouse' && !stage.ptr.down) { stage.look.tx *= 1 - Math.min(1, dt * 2.5); stage.look.ty *= 1 - Math.min(1, dt * 2.5); } }
    else calm = Math.min(1, calm + dt / 0.25);
    // the hint: until the first touch, the light swings once, slowly, now and then
    if (!touched && !stage.interacted && !stage.reduced) {
      idleT += dt;
      if (!demo && idleT > nextDemo) demo = { t: 0, dur: 3.4, ang: Math.random() * 6.28 };
      if (demo) { demo.t += dt; if (demo.t >= demo.dur) { demo = null; nextDemo = idleT + 9 + Math.random() * 4; } }
    } else demo = null;
    const spinning = shapes.some((s) => s.spin);
    const moving = Math.abs(stage.look.x - lastLook[0]) + Math.abs(stage.look.y - lastLook[1]) > 1e-4 || (calm < 1 && calm > 0) || demo || spinning;
    lastLook = [stage.look.x, stage.look.y];
    if (dirty || moving || revealed) { frame(now); dirty = false; }
    rv.draw();
  }));

  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  return {
    tune: {
      title: 'Shadow', values: P, defaults: DEFAULTS,
      groups: [
        { name: 'Light', items: [Ctl('slant', 'How low the light sits (longer shadows, re-forms)', 0.5, 4, 0.05), Ctl('range', 'How far the light swings', 0.1, 1.2, 0.01), Ctl('snap', 'Snap-to-home plateau', 0, 0.2, 0.005), Ctl('rest', 'Light returns home after (s, 0 = never)', 0, 20, 0.5)] },
        { name: 'Blocks', items: [Ctl('size', 'Rod thickness (re-forms)', 0.5, 1.6, 0.05), Ctl('depth', 'How far rods stand from the wall (re-forms)', 0.08, 0.6, 0.01), Ctl('tilt', 'How much each letter leans (re-forms)', 0, 3, 0.05)] },
      ],
      actions: { 'New plan': reform },
      set(key, value) { P[key] = value; if (key === 'size' || key === 'depth' || key === 'slant' || key === 'tilt') reform(); dirty = true; },
      reset() { Object.assign(P, DEFAULTS); reform(); },
    },
    debug: { shapes: () => shapes, lamp: () => lampPos, frame: () => frame(now), count: () => shapes.length },
    destroy() { clearTimeout(reformT); rv.destroy(); offs.forEach((f) => f()); stage.setBackdrop(null); },
  };
}
