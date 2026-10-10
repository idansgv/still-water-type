// Shadow. The letters are not there: they are shadows. A few hundred solid objects (cubes, pyramids, prisms, crystals) hang at different
// depths in front of a wall, each one placed so that its shadow, from one lamp, lands on a stroke of a letter. From the lamp's place
// the shadows join into IDAN SEGEV; from anywhere else the same objects throw a scatter of unrelated shapes.
//
// The geometry is a point light at (L, D) above a wall at depth 0. An object at depth z with centre P casts its shadow, magnified by
// m = D / (D - z), to L + (P - L) * m. So to put a shadow on a target T, the object goes at L0 + (T - L0) / m and is drawn 1/m as big.
// Move the lamp and every object's shadow slides by (m - 1) times the move: nearer objects slide further, which tears the letters apart.
//
// Look: the shadows are solid ink on the wall; the objects are drawn as ghost line drawings that invert whatever is behind them
// (white lines over black shadow, black lines over the white wall), so they never hide a letter. Black on white, then white on black.
//
// Touch: the lamp follows the pointer (or a dragging finger, or a tilt: stage.look); a small plateau around home snaps the letters back.
// A tap on an object spins it (and its neighbours) a full turn. Left alone, the lamp eases home. Double tap on empty space: new objects.
// Three quick taps: reveal (the page inverts; the rays from the lamp through each object to its shadow are drawn).
// The hint: until the first touch, the lamp makes one slow swing now and then and returns.
import { createReveal, ink as rvInk, grid, corners, label, titleBlock } from './reveal.js';
import { SKELETON, radiusFor } from './lettering.js';
import { pressTracker, DOUBLE_MS, REFORM_DELAY_MS } from '../gestures.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };

// ---------- the objects: unit meshes (circumradius 1) with faces and outward normals ----------
function mesh(v, f) {
  const n = f.map((face) => {
    const [a, b, c] = face.map((i) => v[i]);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
    let x = uy * wz - uz * wy, y = uz * wx - ux * wz, z = ux * wy - uy * wx; const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
    let cx = 0, cy = 0, cz = 0; for (const i of face) { cx += v[i][0]; cy += v[i][1]; cz += v[i][2]; }
    if (x * cx + y * cy + z * cz < 0) { x = -x; y = -y; z = -z; }
    return [x, y, z];
  });
  return { v, f, n };
}
const norm = (p) => { const l = Math.hypot(...p); return p.map((q) => q / l); };
const prism = (k, h, rr) => {
  const v = []; for (let i = 0; i < k; i++) { const a = i / k * Math.PI * 2; v.push([Math.cos(a) * rr, Math.sin(a) * rr, -h]); }
  for (let i = 0; i < k; i++) { const a = i / k * Math.PI * 2; v.push([Math.cos(a) * rr, Math.sin(a) * rr, h]); }
  const f = []; for (let i = 0; i < k; i++) f.push([i, (i + 1) % k, k + (i + 1) % k, k + i]);
  f.push([...Array(k).keys()]); f.push([...Array(k).keys()].map((i) => k + i));
  const s = Math.hypot(rr, h); return mesh(v.map((p) => p.map((q) => q / s)), f);
};
const pyramid = (k, rr, h) => {
  const v = []; for (let i = 0; i < k; i++) { const a = i / k * Math.PI * 2 + Math.PI / k; v.push([Math.cos(a) * rr, Math.sin(a) * rr, -h * 0.4]); }
  v.push([0, 0, h * 0.8]);
  const f = []; for (let i = 0; i < k; i++) f.push([i, (i + 1) % k, k]); f.push([...Array(k).keys()]);
  const s = Math.max(...v.map((p) => Math.hypot(...p))); return mesh(v.map((p) => p.map((q) => q / s)), f);
};
const phi = (1 + Math.sqrt(5)) / 2;
const ICO_V = [[-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0], [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi], [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]].map(norm);
const ICO_F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
const s3 = 1 / Math.sqrt(3);
const MESHES = [
  mesh([[-s3, -s3, -s3], [s3, -s3, -s3], [s3, s3, -s3], [-s3, s3, -s3], [-s3, -s3, s3], [s3, -s3, s3], [s3, s3, s3], [-s3, s3, s3]], [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]]),   // cube
  mesh([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [0, 2, 5], [2, 1, 5], [1, 3, 5], [3, 0, 5]]),                       // octahedron
  mesh([[s3, s3, s3], [s3, -s3, -s3], [-s3, s3, -s3], [-s3, -s3, s3]], [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]]),                                                                         // tetrahedron
  mesh(ICO_V, ICO_F),                                                                                                                                                                            // icosahedron
  prism(6, 0.55, 0.85), prism(3, 0.8, 0.6), prism(4, 1.2, 0.5),                                                                                                                                  // hexagonal, triangular, long square prisms
  pyramid(4, 0.9, 1.2), pyramid(5, 0.8, 1.1),                                                                                                                                                    // pyramids
];

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

export function mount(stage) {
  const c2 = stage.canvas.getContext('2d');
  const dark = !!stage.flip;
  const bg = dark ? '#000' : '#fff', fg = dark ? '#fff' : '#000';
  stage.setBackdrop(dark ? 0 : 1);
  const offs = [];
  let seedBump = 0;

  const DEFAULTS = { range: 0.2, spread: 0.3, size: 0.68, snap: 0.05, rest: 4 };
  const P = { ...DEFAULTS };

  let W = 1, H = 1, D = 1, L0 = [0, 0], shapes = [], tR = 20;
  let dirty = true, now = 0, lastMove = 0, calm = 1, touched = false, idleT = 0, nextDemo = 3.5, demo = null, reformT = 0, lastEmpty = 0, revealed = false;
  const press = pressTracker();

  // ---------- layout: the same composition as the other type posters ----------
  function layout() {
    const portrait = W / H < 0.85;
    const rows = portrait ? ['IDAN', 'SE', 'GEV'] : ['IDAN', 'SEGEV'];
    const padX = Math.max(14, W * 0.045), top = Math.max(18, H * 0.04), bottom = 96;
    const availW = W - 2 * padX, availH = H - top - bottom, gap = 0.06;
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
      let x = (W - rowW) / 2;
      for (const c of row) { const a = advance(c, h); out.push({ ch: c, x: x + a / 2, y, w: SKELETON[c].wf * h, h }); x += a; }
      y += h * (1.02 + rowGap);
    }
    return out;
  }

  // ---------- build: points along every stroke, one object for each, placed so its shadow lands there ----------
  function build() {
    const rand = (() => { let a = (stage.seed ^ (seedBump * 0x9e3779b1)) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
    D = Math.max(W, H) * 1.3; L0 = [W / 2, H * 0.5];
    const poses = layout();
    tR = radiusFor(poses[0].ch, poses[0].w, poses[0].h) * 0.8;               // the stroke's half thickness
    const rs = tR * P.size, step = rs * 0.95, list = [];
    const ph1 = rand() * 6.28, ph2 = rand() * 6.28;
    for (const pose of poses) {
      for (const st of SKELETON[pose.ch].s()) {
        const p = st.pts.map((q) => ({ x: pose.x + q.x * pose.w, y: pose.y + q.y * pose.h }));
        const n = p.length, segs = st.closed ? n : n - 1; let total = 0; const cum = [0];
        for (let i = 0; i < segs; i++) { total += Math.hypot(p[(i + 1) % n].x - p[i].x, p[(i + 1) % n].y - p[i].y); cum.push(total); }
        const count = Math.max(2, Math.round(total / step));
        for (let k = 0; k <= count; k++) {
          if (st.closed && k === count) break;
          const d = total * k / count; let j = 1; while (j < cum.length - 1 && cum[j] < d) j++;
          const a = p[(j - 1) % n], b = p[j % n], t = (d - cum[j - 1]) / (cum[j] - cum[j - 1] || 1);
          const tx = a.x + (b.x - a.x) * t, ty = a.y + (b.y - a.y) * t;
          // depth: a slow field over the page (so the objects read as one hung sculpture) plus a jitter
          const field = 0.5 + 0.5 * Math.sin(tx * 0.0045 + ph1) * Math.cos(ty * 0.0052 + ph2);
          const z = D * (0.1 + P.spread * (0.65 * field + 0.35 * rand()));
          const m = D / (D - z), size = rs * (0.85 + 0.35 * rand());
          const M0 = rotAxis(rand() - 0.5, rand() - 0.5, rand() - 0.5 + 0.01, rand() * 6.283);
          shapes.push({ tx, ty, z, m, r: size / m, x: L0[0] + (tx - L0[0]) / m, y: L0[1] + (ty - L0[1]) / m, mesh: MESHES[Math.floor(rand() * MESHES.length)], M0, spin: null, hull: null, sh: null });
        }
      }
    }
    shapes.sort((a, b) => a.z - b.z);                                         // far to near, for drawing
    dirty = true;
  }
  const reform = () => { shapes = []; seedBump++; build(); };

  // ---------- the lamp ----------
  const unit = () => Math.min(W, H);
  function lamp() {                                                           // offset of the lamp from home, in px
    let dx = stage.look.x * P.range * unit(), dy = -stage.look.y * P.range * unit();
    if (demo) { const u = demo.t / demo.dur, a = Math.sin(u * Math.PI) * Math.sin(u * Math.PI * 2); dx += Math.cos(demo.ang) * a * 0.085 * unit(); dy += Math.sin(demo.ang) * a * 0.085 * unit(); }
    const r = Math.hypot(dx, dy), s0 = P.snap * unit() * 0.5, s1 = P.snap * unit() * 1.6;
    const k = r < 1e-6 ? 0 : smooth((r - s0) / (s1 - s0)) * calm;            // a plateau at home, where the letters are exact
    return [dx * k, dy * k];
  }

  // ---------- the frame ----------
  function frame(t) {
    const [ox, oy] = lamp(), Lx = L0[0] + ox, Ly = L0[1] + oy;
    c2.setTransform(stage.pw / W, 0, 0, stage.ph / H, 0, 0);
    c2.globalCompositeOperation = 'source-over';
    c2.fillStyle = bg; c2.fillRect(0, 0, W, H);
    // objects: orientation, screen outline, shadow outline
    const faces = [[], [], [], []];
    c2.beginPath();
    for (const s of shapes) {
      let M = s.M0;
      if (s.spin) { const u = (t - s.spin.t0) / s.spin.dur; if (u >= 1) s.spin = null; else if (u > 0) M = mul3(rotAxis(s.spin.ax, s.spin.ay, s.spin.az, Math.PI * 2 * smooth(u)), s.M0); }
      const v = s.mesh.v, V = new Array(v.length), SH = new Array(v.length);
      for (let i = 0; i < v.length; i++) {
        const p = v[i], x = M[0] * p[0] + M[1] * p[1] + M[2] * p[2], y = M[3] * p[0] + M[4] * p[1] + M[5] * p[2], zz = M[6] * p[0] + M[7] * p[1] + M[8] * p[2];
        const X = s.x + x * s.r, Y = s.y + y * s.r, Z = s.z + zz * s.r, m = D / (D - Z);
        V[i] = [X, Y]; SH[i] = [Lx + (X - Lx) * m, Ly + (Y - Ly) * m];
      }
      s.V = V; s.M = M;
      s.sh = hull(SH); s.hull = hull(V);
      c2.moveTo(s.sh[0][0], s.sh[0][1]); for (let i = 1; i < s.sh.length; i++) c2.lineTo(s.sh[i][0], s.sh[i][1]); c2.closePath();
    }
    c2.fillStyle = fg; c2.fill();                                             // the shadows: solid ink on the wall
    // ghost line drawings of the objects: lines that invert what is under them
    c2.globalCompositeOperation = 'difference';
    c2.beginPath();
    for (const s of shapes) {
      const { f, n } = s.mesh, M = s.M;
      for (let k = 0; k < f.length; k++) {
        const nz = M[6] * n[k][0] + M[7] * n[k][1] + M[8] * n[k][2];
        if (nz <= 0) continue;                                                // facing away
        const nx = M[0] * n[k][0] + M[1] * n[k][1] + M[2] * n[k][2], ny = M[3] * n[k][0] + M[4] * n[k][1] + M[5] * n[k][2];
        const dl = Math.hypot(Lx - s.x, Ly - s.y, D - s.z) || 1, lit = Math.max(0, (nx * (Lx - s.x) + ny * (Ly - s.y) + nz * (D - s.z)) / dl);
        const b = Math.min(3, Math.floor(lit * 4)); const path = faces[b];
        path.push(f[k].map((i) => s.V[i]));
      }
    }
    for (let b = 0; b < 4; b++) {
      c2.beginPath();
      for (const poly of faces[b]) { c2.moveTo(poly[0][0], poly[0][1]); for (let i = 1; i < poly.length; i++) c2.lineTo(poly[i][0], poly[i][1]); c2.closePath(); }
      c2.fillStyle = `rgba(255,255,255,${0.03 + b * 0.05})`; c2.fill();
    }
    c2.beginPath();
    for (const b of faces) for (const poly of b) { c2.moveTo(poly[0][0], poly[0][1]); for (let i = 1; i < poly.length; i++) c2.lineTo(poly[i][0], poly[i][1]); c2.closePath(); }
    c2.strokeStyle = 'rgba(255,255,255,0.7)'; c2.lineWidth = 0.9; c2.lineJoin = 'round'; c2.stroke();
    c2.globalCompositeOperation = 'source-over';
    lampPos = [Lx, Ly];
  }
  let lampPos = [0, 0];

  // ---------- reveal: the plan of the lamp, the rays and the sweet spot ----------
  const rv = createReveal(stage, (c, W_, H_, k) => {
    const col = (x) => rvInk(stage, x), [Lx, Ly] = lampPos;
    grid(c, W_, H_, 24, col, k); corners(c, W_, H_, 16, col, k);
    c.lineWidth = 0.7; c.strokeStyle = col(0.5 * k);
    let n = 0;
    for (let i = 0; i < shapes.length; i += 3) {                              // a ray from the lamp through an object to where its shadow lands
      const s = shapes[i], q = s.sh && s.sh.length ? s.sh.reduce((a, p) => [a[0] + p[0] / s.sh.length, a[1] + p[1] / s.sh.length], [0, 0]) : [s.tx, s.ty];
      c.setLineDash([2, 3]); c.beginPath(); c.moveTo(Lx, Ly); c.lineTo(q[0], q[1]); c.stroke(); c.setLineDash([]);
      c.fillStyle = col(0.9 * k); c.beginPath(); c.arc(s.x, s.y, 1.8, 0, 7); c.fill();
      c.strokeStyle = col(0.9 * k); c.beginPath(); c.moveTo(q[0] - 3, q[1]); c.lineTo(q[0] + 3, q[1]); c.moveTo(q[0], q[1] - 3); c.lineTo(q[0], q[1] + 3); c.stroke(); c.strokeStyle = col(0.5 * k);
      n++;
    }
    c.strokeStyle = col(0.7 * k); c.setLineDash([5, 4]); c.beginPath(); c.arc(L0[0], L0[1], P.snap * unit() * 1.6, 0, 7); c.stroke(); c.setLineDash([]);       // where the letters are exact
    c.strokeStyle = col(k); c.lineWidth = 1.4; c.beginPath(); c.arc(Lx, Ly, 9, 0, 7); c.moveTo(Lx - 16, Ly); c.lineTo(Lx + 16, Ly); c.moveTo(Lx, Ly - 16); c.lineTo(Lx, Ly + 16); c.stroke();
    label(c, 'L', Lx + 13, Ly - 12, col, k, 'left', 11);
    const zs = shapes.map((s) => s.z), z0 = Math.round(Math.min(...zs) / D * 100), z1 = Math.round(Math.max(...zs) / D * 100);
    titleBlock(c, W_, H_, ['SHADOW · PLAN', '○ lamp  ┄ ray  + shadow', `${shapes.length} objects · depth ${z0}–${z1}% of lamp height`, 'the dashed ring: the letters are exact'], col, k);
  });
  offs.push(stage.on('reveal', (on) => { revealed = on; dirty = true; }));

  // ---------- input ----------
  const hitShape = (q) => { for (let i = shapes.length - 1; i >= 0; i--) { const s = shapes[i]; if (s.hull && inside(s.hull, q.x, q.y)) return s; } return null; };
  offs.push(stage.on('down', (q, e) => { press.down(q, e.pointerId); lastMove = now; touched = true; demo = null; dirty = true; }));
  offs.push(stage.on('move', (q, e) => { press.move(q, e.pointerId); lastMove = now; calm = Math.max(calm, 0.0); dirty = true; }));
  offs.push(stage.on('up', (q, e) => {
    const r = press.up(q, e.pointerId); lastMove = now; dirty = true;
    if (!r || !r.tap) return;
    const s = hitShape(q);
    if (s) {                                                                  // a tap on an object: it and its neighbours turn a full turn, the nearest first
      const ax = Math.random() - 0.5, ay = Math.random() - 0.5, az = Math.random() - 0.5;
      for (const o of shapes) { const d = Math.hypot(o.x - s.x, o.y - s.y); if (d < s.r * 4.2 + tR) o.spin = { t0: now + d / (tR * 22), dur: 1.1, ax, ay, az }; }
    } else {                                                                  // empty space: two quick taps make new objects (a beat later, so a third tap can mean reveal)
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
    // the lamp eases home when left alone, and a finger's drag offset is let go after the same wait
    const idle = now - lastMove;
    if (P.rest > 0 && idle > P.rest) { calm = Math.max(0, calm - dt / 1.2); if (stage.ptr.type !== 'mouse' && !stage.ptr.down) { stage.look.tx *= 1 - Math.min(1, dt * 2.5); stage.look.ty *= 1 - Math.min(1, dt * 2.5); } }
    else calm = Math.min(1, calm + dt / 0.25);
    // the hint: until the first touch, the lamp swings once, slowly, now and then
    if (!touched && !stage.interacted && !stage.reduced) {
      idleT += dt;
      if (!demo && idleT > nextDemo) { demo = { t: 0, dur: 3.4, ang: Math.random() * 6.28 }; }
      if (demo) { demo.t += dt; if (demo.t >= demo.dur) { demo = null; nextDemo = idleT + 9 + Math.random() * 4; } }
    } else demo = null;
    const spinning = shapes.some((s) => s.spin);
    const moving = Math.abs(stage.look.x - lastLook[0]) + Math.abs(stage.look.y - lastLook[1]) > 1e-4 || calm < 1 && calm > 0 || demo || spinning;
    lastLook = [stage.look.x, stage.look.y];
    if (dirty || moving || revealed) { frame(now); dirty = false; }
    rv.draw();
  }));
  let lastLook = [0, 0];

  const Ctl = (key, label, min, max, step) => ({ key, label, min, max, step });
  return {
    tune: {
      title: 'Shadow', values: P, defaults: DEFAULTS,
      groups: [
        { name: 'Lamp', items: [Ctl('range', 'How far the lamp moves', 0.05, 0.6, 0.01), Ctl('snap', 'Snap-to-home plateau', 0, 0.15, 0.005), Ctl('rest', 'Lamp returns home after (s, 0 = never)', 0, 20, 0.5)] },
        { name: 'Objects', items: [Ctl('size', 'Object size (re-forms)', 0.5, 1.6, 0.05), Ctl('spread', 'Depth spread (re-forms)', 0.05, 0.6, 0.01)] },
      ],
      actions: { 'New objects': reform },
      set(key, value) { P[key] = value; if (key === 'size' || key === 'spread') reform(); dirty = true; },
      reset() { Object.assign(P, DEFAULTS); reform(); },
    },
    debug: { shapes: () => shapes, lamp: () => lampPos, frame: () => frame(now), count: () => shapes.length },
    destroy() { clearTimeout(reformT); rv.destroy(); offs.forEach((f) => f()); stage.setBackdrop(null); },
  };
}
